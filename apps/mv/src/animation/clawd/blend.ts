import { CLAWD_MODEL } from "../../components/clawd/model.ts";
import type {
  ClawdAction,
  ClawdPose,
  ClawdProp,
} from "../../components/clawd/types.ts";
import type {
  ClawdRhythmMotion,
  StageKeyboardState,
} from "../../timeline/rhythm-timing.ts";
import { sampleClawdActionDelta } from "./actions/index.ts";
import { clamp01, defaultBreathY } from "./motion-style.ts";

export interface ResolveClawdPoseInput {
  action?: ClawdAction;
  actionProgress?: number;
  prop?: ClawdProp;
  bookProgress?: number;
  keyboardState?: StageKeyboardState;
  beatPulse?: number;
  rhythm?: ClawdRhythmMotion;
  timeSec: number;
}

/**
 * 动作衔接与局部叠加合成器：
 * 1. 先按 action + actionProgress 采样叙事或循环动作的局部姿态增量；
 * 2. 在非保护期（非 stumble-left / static）叠加连续拍点律动 rhythm（左右重心摆动 + 轻微下压）；
 * 3. 叠加手持道具（dj / juggle / coffee / book / keyboard）对手臂与躯干的局部覆盖；
 * 4. 叠加外部节拍脉冲 beatPulse，最终输出带足底贴地约束的完整 ClawdPose。
 */
export function resolveClawdPose({
  action = "idle",
  actionProgress,
  prop = "none",
  bookProgress,
  keyboardState,
  beatPulse = 0,
  rhythm,
  timeSec,
}: ResolveClawdPoseInput): ClawdPose {
  const p =
    actionProgress !== undefined
      ? clamp01(actionProgress)
      : (timeSec / 3.0) % 1;

  const breathY = rhythm?.breathY ?? defaultBreathY(timeSec);
  const delta = sampleClawdActionDelta(action, p, timeSec, breathY);

  const stageOffsetX = delta.stageOffsetX ?? 0;
  let bodyOffsetX = delta.bodyOffsetX ?? 0;
  let bodyOffsetY = delta.bodyOffsetY ?? breathY;
  let torsoTiltDeg = delta.torsoTiltDeg ?? 0;
  let scaleX = delta.scaleX ?? 1;
  let scaleY = delta.scaleY ?? 1;
  const leftArmExtend = delta.leftArmExtend ?? 0;
  const rightArmExtend = delta.rightArmExtend ?? 0;

  // 当捧书阅读 (prop === "book") 时，双手从身体两侧向胸前连续平移合拢 (handHoldProgress: 0 -> 1 -> 0)
  // bookProgress 支持 0->1 (入场) 与 1->2 (从另一侧退场)
  let handHoldProgress = 0;
  if (prop === "book") {
    const rawBp = bookProgress !== undefined ? bookProgress : 1;
    const holdEnv =
      rawBp <= 1 ? clamp01(rawBp) : clamp01(2 - rawBp);
    handHoldProgress = holdEnv;
  }

  // 当弹奏身前紧凑合成器键盘 (prop === "keyboard") 时，左爪负责低音区 (A3 / B♭3)，右爪负责高八度 (B♭4)
  let handKeyboardProgress = 0;
  let leftKeyShiftX = 0;
  let leftKeyPress = 0;
  let rightKeyPress = 0;
  if (prop === "keyboard" && keyboardState?.visible) {
    handKeyboardProgress = clamp01(keyboardState.traySlide);
    const z0 = keyboardState.zones[0].press; // A3 半音下切
    const z1 = keyboardState.zones[1].press; // B♭3 基准低音
    const z2 = keyboardState.zones[2].press; // B♭4 高八度
    leftKeyPress = Math.max(z0, z1);
    rightKeyPress = z2;
    // 左手在按下 A3 下切音时向左微移 (-1)，按 B♭3 基准音时回到 (0)
    leftKeyShiftX = z0 > 0.05 ? -Math.min(1, z0 * 1.15) : 0;
  }

  // 1. 叠加连续节拍律动（排除 stumble-left 与 static）：
  //    待机窗口为完整律动（左右重心 + 快压慢回下压）；叙事动作期间只保留纵向下压底层 (grooveWeight)
  if (rhythm && action !== "stumble-left" && action !== "static") {
    const weight = rhythm.idleWeight;
    const groove = rhythm.grooveWeight;
    bodyOffsetX += rhythm.sway * weight * 0.24;
    torsoTiltDeg += rhythm.sway * weight * 1.1;
    bodyOffsetY += rhythm.pulse * (weight * 0.13 + groove * 0.2);
    scaleX *= 1 + rhythm.pulse * (weight * 0.016 + groove * 0.012);
    scaleY *= 1 - rhythm.pulse * (weight * 0.016 + groove * 0.012);
  }

  // 2. DJ 台专属身体弹动覆盖
  if (prop === "dj") {
    bodyOffsetY = Math.abs(Math.sin(timeSec * Math.PI * 4)) * -0.26;
  }

  // 3. 叠加外部音乐节拍脉冲 (beatPulse: 0 ~ 1)
  if (beatPulse > 0.01) {
    bodyOffsetY -= beatPulse * 0.55;
    scaleX *= 1 + beatPulse * 0.06;
    scaleY *= 1 - beatPulse * 0.04;
  }

  // 4. 计算双臂垂直偏移（prop 优先，其次使用动作自身的 armDeltaY）
  let leftArmOffsetY = bodyOffsetY;
  let rightArmOffsetY = bodyOffsetY;

  if (prop === "juggle") {
    leftArmOffsetY += Math.sin(timeSec * Math.PI * 6) * 0.35;
    rightArmOffsetY += Math.cos(timeSec * Math.PI * 6) * 0.35;
  } else if (prop === "dj") {
    leftArmOffsetY += Math.sin(timeSec * Math.PI * 8) * 0.22;
    rightArmOffsetY -= Math.sin(timeSec * Math.PI * 8) * 0.22;
  } else if (prop === "coffee") {
    const sipWave = Math.max(0, Math.sin(timeSec * Math.PI * 1.2));
    rightArmOffsetY += -0.25 - sipWave * 0.45;
  } else if (action === "bounce") {
    // bounce 的手臂跟随最终合成后的 bodyOffsetY
    leftArmOffsetY += bodyOffsetY * 0.35;
    rightArmOffsetY += bodyOffsetY * 0.35;
  } else {
    leftArmOffsetY += delta.leftArmDeltaY ?? 0;
    rightArmOffsetY += delta.rightArmDeltaY ?? 0;
  }

  // 5. 四足抬升量（walk / bounce / stumble-left 之外严格为 0，确保足底钉在地面 y=10）
  let legLifts: [number, number, number, number] = delta.legLifts ?? [
    0, 0, 0, 0,
  ];
  if (action === "bounce") {
    const lift = Math.max(0, -bodyOffsetY) * 0.65;
    legLifts = [lift, lift, lift, lift];
  }

  return {
    stageOffsetX,
    bodyOffsetX,
    bodyOffsetY,
    torsoTiltDeg,
    rotPivotX: delta.rotPivotX ?? CLAWD_MODEL.joints.centerPivotX,
    scaleX,
    scaleY,
    leftArmExtend,
    rightArmExtend,
    leftArmOffsetY,
    rightArmOffsetY,
    handHoldProgress,
    handKeyboardProgress,
    leftKeyShiftX,
    leftKeyPress,
    rightKeyPress,
    legLifts,
    isAirborneAction: delta.isAirborneAction ?? false,
    isStumbleHop: delta.isStumbleHop ?? false,
    actionLook: {
      x: delta.actionLookX ?? 0,
      y: delta.actionLookY ?? 0,
    },
    selfPointOpacity: delta.selfPointOpacity ?? 0,
    sweatDropsProgress: delta.sweatDropsProgress ?? null,
  };
}
