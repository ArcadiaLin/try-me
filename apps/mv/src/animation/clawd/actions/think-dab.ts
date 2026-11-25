import { clamp01, smoothStep } from "../motion-style.ts";
import type { ClawdPoseDelta } from "../poses.ts";

/**
 * L065 收尾间奏 → L013 思考准备期的放松深呼吸 + 中后段苦恼颤抖动作：
 * - 前半段 (p: 0 -> ~0.53)：缓慢舒展的胸廓深呼吸，叠加在主节奏律动上；
 * - 中后段 (p >= 0.53，对应 L013 后半至 L014 蓄力前)：思绪从外围压来，转为苦恼 `> <` 并带上高频轻微颤抖与微紧绷，四足牢牢贴地。
 */
export function sampleDeepBreatheAction(
  p: number,
  timeSec: number,
  breathY: number,
): ClawdPoseDelta {
  const blendIn = smoothStep(p, 0, 0.14);
  const struggleEnv = smoothStep(p, 0.52, 0.62);
  const struggleBuild = smoothStep(p, 0.54, 0.96);

  const cycleSec = 2.24;
  // 从进入放松时刻附近起缓慢吸气再呼气，呈现明显的深呼吸波浪
  const phase = ((timeSec - 54.55) / cycleSec) * Math.PI * 2;
  const wave = Math.sin(phase - Math.PI * 0.35);
  const inhale = (wave + 1) * 0.5; // 0..1

  // 苦恼阶段的高频轻微颤抖（随时间略微加强）
  const trembleAmp = (0.1 + 0.12 * struggleBuild) * struggleEnv;
  const trembleX = Math.sin(timeSec * Math.PI * 24) * trembleAmp;
  const trembleTilt = Math.sin(timeSec * Math.PI * 20 + 0.6) * (0.9 + 0.9 * struggleBuild) * struggleEnv;

  const calmWeight = 1 - struggleEnv * 0.72;
  const bodyOffsetY =
    breathY * 0.35 +
    (0.28 - inhale * 0.52) * blendIn * calmWeight +
    (0.22 + 0.16 * struggleBuild) * struggleEnv;
  const scaleX =
    1 +
    (inhale * 0.028 - 0.012) * blendIn * calmWeight +
    0.022 * struggleEnv;
  const scaleY =
    1 +
    (inhale * 0.042 - 0.018) * blendIn * calmWeight -
    0.028 * struggleEnv;
  const armRelax =
    (0.14 - inhale * 0.24) * blendIn * calmWeight - 0.26 * struggleEnv;

  return {
    bodyOffsetX: trembleX,
    bodyOffsetY,
    torsoTiltDeg: trembleTilt,
    scaleX,
    scaleY,
    leftArmExtend: -0.18 * blendIn + inhale * 0.12 * blendIn * calmWeight - 0.22 * struggleEnv,
    rightArmExtend: -0.18 * blendIn + inhale * 0.12 * blendIn * calmWeight - 0.22 * struggleEnv,
    leftArmDeltaY: armRelax,
    rightArmDeltaY: armRelax,
    legLifts: [0, 0, 0, 0],
  };
}

/**
 * L014 `superstar` 卡点 Dab 动作（进度 p: 0 -> 1，对应 60.887s -> 62.56s）：
 * - 0.000 -> 0.078（1:01:01 卡点前 0.13s）：明显下蹲蓄力
 * - 0.078（严格对齐 1:01:01）-> 0.125：猛弹冲高 + Snap-Lock 极速甩入 Dab（明显身体弹跳感 + 体积守恒）
 * - 0.125 -> 0.215：弹性回落轻压再回弹锁死
 * - 0.215 -> 0.800：短暂得意定姿（克制呼吸微动）
 * - 0.800 -> 1.000：干脆收势回到基础站姿
 */
export function sampleSuperstarDabAction(
  p: number,
  timeSec: number,
  breathY: number,
): ClawdPoseDelta {
  const t = clamp01(p);
  // 0.13 / (62.56 - 60.8867) ≈ 0.0777，严格对齐 1:01:01 触发点
  const HIT_P = 0.0777;

  // 1. 蓄力下压 (0 -> HIT_P)
  const prepIn = smoothStep(t, 0.0, HIT_P * 0.78);
  const prepOut = 1 - smoothStep(t, HIT_P * 0.85, HIT_P + 0.012);
  const prepEnv = prepIn * prepOut;

  // 2. Dab 动作严格在 HIT_P 瞬间触发，0.032s 内极速甩到位，0.80 -> 0.97 干脆收回
  const snapRaw = clamp01((t - HIT_P) / 0.024);
  const snapOvershoot =
    snapRaw <= 0
      ? 0
      : snapRaw < 1
        ? 1 + Math.sin(snapRaw * Math.PI) * 0.2 * (1 - snapRaw * 0.4) - (1 - snapRaw) ** 3
        : 1;
  const releaseEnv = 1 - smoothStep(t, 0.8, 0.97);
  const dabProgress = clamp01(snapRaw * releaseEnv);
  const dabPoseGain = Math.max(0, snapOvershoot * releaseEnv);

  // 3. 明显的身体弹跳曲线（向上猛弹 → 弹性回落轻压 → 回弹稳锁）
  const upPop =
    t >= HIT_P && t <= HIT_P + 0.075
      ? Math.sin(((t - HIT_P) / 0.075) * Math.PI)
      : 0;
  const landSquash =
    t >= HIT_P + 0.065 && t <= HIT_P + 0.155
      ? Math.sin(((t - (HIT_P + 0.065)) / 0.09) * Math.PI)
      : 0;
  const settleRebound =
    t >= HIT_P + 0.145 && t <= HIT_P + 0.215
      ? Math.sin(((t - (HIT_P + 0.145)) / 0.07) * Math.PI)
      : 0;

  // 定姿期的克制得意微呼吸
  const holdActive = smoothStep(t, 0.24, 0.3) * (1 - smoothStep(t, 0.76, 0.84));
  const holdMicro = Math.sin(timeSec * Math.PI * 2.4) * 0.06 * holdActive;

  // 蓄力下压 + 命中猛弹冲高 + 弹性回落轻压 + 锁死定姿
  const bodyOffsetX = -0.45 * dabPoseGain;
  const bodyOffsetY =
    breathY * (1 - dabProgress) +
    0.62 * prepEnv +
    0.12 * dabPoseGain -
    0.76 * upPop +
    0.34 * landSquash -
    0.12 * settleRebound +
    holdMicro;
  const torsoTiltDeg =
    2.8 * prepEnv -
    13.8 * dabPoseGain -
    3.2 * upPop +
    1.6 * landSquash -
    holdMicro * 8;

  // 体积守恒的明显 squash & stretch
  const scaleY =
    1 -
    0.1 * prepEnv +
    0.13 * upPop -
    0.075 * landSquash +
    0.03 * settleRebound -
    0.015 * dabProgress;
  const scaleX = 1 / scaleY;

  return {
    bodyOffsetX,
    bodyOffsetY,
    torsoTiltDeg,
    scaleX,
    scaleY,
    dabProgress,
    actionLookX: -0.35 * dabProgress,
    actionLookY: 0.48 * dabProgress,
    legLifts: [0, 0, 0, 0],
  };
}
