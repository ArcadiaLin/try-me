import React from "react";
import { interpolate } from "remotion";
import { resolveClawdPose } from "../animation/clawd/blend";
import { clamp01, smoothStep } from "../animation/clawd/motion-style";
import type { ClawdPose } from "../components/clawd/types";
import { ChorusLyrics } from "../components/environment/ChorusLyrics";
import type { ClawdRhythmMotion } from "../timeline/verse1";
import type { ClawdActorState, ClawdStagePlacement } from "./types";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * L015（Try me! Try me!，62.689s–64.982s）首次副歌开场草稿时间点（D037）：
 * - 句级边界严格对应 annotations/try-me.timeline.json；
 * - 两声 Try me! 的词级命中点暂以候选拍点（62.770s / 63.891s 军鼓+鼓掌重合）作初版占位，
 *   待用户在 Studio 带音频试看听辨后再微调。
 */
export const L015_START_SEC = 62.689;
/** 超快速缩回底部终端的完成时刻（约 9 帧 = 0.15s） */
export const L015_DIVE_END_SEC = 62.84;
/** 从整个屏幕右下角近景探头弹出的起始时刻 */
export const L015_PEEK_START_SEC = 62.86;
/** 右下角近景探头开始缩回画外的时刻 */
export const L015_PEEK_RETRACT_START_SEC = 63.64;
/** 右下角完全缩回画外的时刻 */
export const L015_PEEK_RETRACT_END_SEC = 63.77;
/** 从视频窗口底边钻出的起始时刻 */
export const L015_BOTTOM_RISE_START_SEC = 63.79;
/** 第二声 Try me! 底部巨型近景扒窗到位时刻（对齐候选强拍 SD2_PAIR_0057: 63.891s） */
export const L015_LAND_HIT_SEC = 63.891;
/** L015 结束时刻（进入 L016） */
export const L015_END_SEC = 64.982;

/** 右下角近景探头时的屏幕空间坐标与缩放（遮挡约四分之一屏幕，突破舞台边界） */
const PEEK_TARGET_X = 468;
const PEEK_TARGET_Y = 264;
const PEEK_TARGET_SCALE = 2.38;
const PEEK_TARGET_ROT = -21;

/**
 * 第二声从视频底部钻出扒窗的坐标与缩放：
 * - 躯干宽度 12/22.4 * 310 ≈ 166.07px，scale = 4.52 时躯干宽 750px（正好 3/4 终端舞台宽度 1000px）；
 * - placementY = 510 时整体往下靠一些（脑袋顶在 y≈330），双前肢（gy: 4.68..6.83）恰好扒在视频底边 y=720 并露出约 3/4 高度。
 */
const BOTTOM_PEEK_Y = 510;
const BOTTOM_PEEK_SCALE = 4.52;

/**
 * L015 唯一主角 Clawd 的连续舞台/屏幕空间定位：
 * 1) 62.689s–62.84s：超快速向下扎进舞台底部终端（带台面裁切 clipPath）；
 * 2) 62.86s–63.64s：突破舞台边界（zIndex: 12），从整个屏幕右下角以 2.38x 近景斜向探头（不招手）；
 * 3) 63.64s–63.77s：干脆缩回屏幕右下角画外；
 * 4) 63.79s–64.982s：从视频窗口最底边以 4.52x（3/4 终端宽度）钻出，双拳举在胸前扒住视频窗口底边！
 */
export function resolveChorusTryMePlacement(sec: number): ClawdStagePlacement {
  // 1. 超快速缩回舞台底部终端
  if (sec < L015_DIVE_END_SEC) {
    const t = clamp01(
      (sec - L015_START_SEC) / (L015_DIVE_END_SEC - L015_START_SEC),
    );
    const drop = t < 0.16 ? -14 * Math.sin((t / 0.16) * Math.PI) : 238 * ((t - 0.16) / 0.84) ** 2.1;
    const scale = t < 0.16 ? 1 : interpolate(t, [0.16, 1], [1, 0.72], CLAMP);
    return {
      x: 0,
      y: drop,
      scale,
      rotateDeg: 0,
      opacity: 1,
      zIndex: 5,
      clipPath: "inset(0px 0px 186px 0px)",
    };
  }

  // 极短留白切换
  if (sec < L015_PEEK_START_SEC) {
    return {
      x: 0,
      y: 250,
      scale: 0.7,
      rotateDeg: 0,
      opacity: 0,
      zIndex: 5,
      clipPath: "inset(0px 0px 186px 0px)",
    };
  }

  // 2. 第一声：屏幕右下角近景探头（不招手，保持当前位置与比例）
  if (sec < L015_PEEK_RETRACT_START_SEC) {
    const sincePeek = sec - L015_PEEK_START_SEC;
    const popT = clamp01(sincePeek / 0.15);
    const popEase =
      popT < 0.58
        ? (1 - (1 - popT / 0.58) ** 3) * 1.1
        : 1.1 - 0.1 * (1 - (1 - (popT - 0.58) / 0.42) ** 2);

    const settle = smoothStep(sincePeek, 0.14, 0.24);
    const bobX = Math.sin(sincePeek * Math.PI * 3.2) * 4.5 * settle;
    const bobY = Math.cos(sincePeek * Math.PI * 3.2) * 5.5 * settle;
    const bobRot = Math.sin(sincePeek * Math.PI * 2.6) * 1.8 * settle;

    const startX = 785;
    const startY = 535;
    const startRot = -34;

    return {
      x: startX + (PEEK_TARGET_X - startX) * popEase + bobX,
      y: startY + (PEEK_TARGET_Y - startY) * popEase + bobY,
      scale: interpolate(popEase, [0, 1.1], [2.05, PEEK_TARGET_SCALE * 1.03], CLAMP),
      rotateDeg: startRot + (PEEK_TARGET_ROT - startRot) * popEase + bobRot,
      opacity: 1,
      zIndex: 12,
    };
  }

  // 3. 缩回屏幕右下角画外
  if (sec < L015_PEEK_RETRACT_END_SEC) {
    const u = clamp01(
      (sec - L015_PEEK_RETRACT_START_SEC) /
        (L015_PEEK_RETRACT_END_SEC - L015_PEEK_RETRACT_START_SEC),
    );
    const easeIn = u * u;
    return {
      x: PEEK_TARGET_X + (820 - PEEK_TARGET_X) * easeIn,
      y: PEEK_TARGET_Y + (570 - PEEK_TARGET_Y) * easeIn,
      scale: PEEK_TARGET_SCALE * (1 - 0.12 * easeIn),
      rotateDeg: PEEK_TARGET_ROT - 14 * easeIn,
      opacity: 1,
      zIndex: 12,
    };
  }

  // 极短 1 帧藏匿，切换至视频正下方
  if (sec < L015_BOTTOM_RISE_START_SEC) {
    return {
      x: 0,
      y: 960,
      scale: BOTTOM_PEEK_SCALE,
      rotateDeg: 0,
      opacity: 0,
      zIndex: 12,
    };
  }

  // 4. 第二声：从视频窗口最底边极速钻出，占据 3/4 终端宽度，双拳扒住窗口底边
  const riseDur = L015_LAND_HIT_SEC - L015_BOTTOM_RISE_START_SEC;
  const riseT = clamp01((sec - L015_BOTTOM_RISE_START_SEC) / riseDur);
  // 命中前加速冲出，63.891s 命中后短促过冲回稳锁死
  const sinceHit = sec - L015_LAND_HIT_SEC;
  const overshootY =
    sinceHit >= 0 && sinceHit < 0.16
      ? -28 * Math.sin((sinceHit / 0.16) * Math.PI) * (1 - sinceHit / 0.16)
      : 0;

  const startBottomY = 930;
  const riseEase = 1 - (1 - riseT) ** 3;
  const baseY = startBottomY + (BOTTOM_PEEK_Y - startBottomY) * riseEase;

  // 停留期克制轻快呼吸起伏（保持双拳始终贴住底部约 3/4 露出，不脱离底部）
  const settle = smoothStep(sinceHit, 0.14, 0.24);
  const microY = Math.sin(Math.max(0, sinceHit) * Math.PI * 3.4) * 5.5 * settle;
  const microRot = Math.cos(Math.max(0, sinceHit) * Math.PI * 2.2) * 0.8 * settle;

  return {
    x: 0,
    y: baseY + overshootY + microY,
    scale: BOTTOM_PEEK_SCALE,
    rotateDeg: microRot,
    opacity: 1,
    zIndex: 12,
  };
}

/**
 * L015 角色骨骼姿态与表情编排：
 * - 缩回终端：纵向拉伸钻入；
 * - 右下角探头（不招手）：双爪自然收稳 + ^ ^ 开心弯眼；
 * - 底部巨型扒窗钻出：双拳收进身体内侧举在胸前（peekPawsProgress = 1），露出约 3/4 扒住窗口底边。
 */
export function resolveChorusTryMeActor(
  sec: number,
  rhythm: ClawdRhythmMotion | undefined,
  base: ClawdActorState,
): ClawdActorState {
  const idle = resolveClawdPose({ action: "idle", rhythm, timeSec: sec });

  // 1. 超快速缩回终端
  if (sec < L015_PEEK_START_SEC) {
    const t = clamp01(
      (sec - L015_START_SEC) / (L015_DIVE_END_SEC - L015_START_SEC),
    );
    const stretch = smoothStep(t, 0.1, 0.45);
    const pose: ClawdPose = {
      ...idle,
      scaleX: 1 - 0.2 * stretch,
      scaleY: 1 + 0.24 * stretch,
      leftArmExtend: -0.35 * stretch,
      rightArmExtend: -0.35 * stretch,
      leftArmOffsetY: idle.leftArmOffsetY - 1.1 * stretch,
      rightArmOffsetY: idle.rightArmOffsetY - 1.1 * stretch,
    };
    return {
      ...base,
      action: "idle",
      eyes: t > 0.15 ? "wince" : "normal",
      pose,
    };
  }

  // 2. 第一声右下角近景探头 & 缩回画外（不招手，双爪自然收稳）
  if (sec < L015_BOTTOM_RISE_START_SEC) {
    const pose: ClawdPose = {
      ...idle,
      bodyOffsetX: 0,
      bodyOffsetY: 0,
      torsoTiltDeg: 0,
      scaleX: 1,
      scaleY: 1,
      leftArmExtend: -0.15,
      rightArmExtend: -0.15,
      leftArmOffsetY: idle.leftArmOffsetY,
      rightArmOffsetY: idle.rightArmOffsetY,
    };
    return {
      ...base,
      action: "idle",
      eyes: "happy",
      lookOffset: { x: -0.28, y: -0.14 },
      pose,
    };
  }

  // 3. 第二声底部巨型扒窗钻出（双拳收进身体内侧举在胸前，扒住窗口底边）
  const sinceHit = sec - L015_LAND_HIT_SEC;
  const popSquash =
    sinceHit >= 0 && sinceHit < 0.14
      ? Math.sin((sinceHit / 0.14) * Math.PI) * 0.045
      : 0;

  const pose: ClawdPose = {
    ...idle,
    bodyOffsetX: 0,
    bodyOffsetY: 0,
    torsoTiltDeg: 0,
    scaleX: 1 + popSquash,
    scaleY: 1 - popSquash * 0.85,
    leftArmExtend: 0,
    rightArmExtend: 0,
    leftArmOffsetY: 0,
    rightArmOffsetY: 0,
    peekPawsProgress: 1,
  };

  return {
    ...base,
    action: "idle",
    eyes: "happy",
    lookOffset: { x: 0, y: -0.12 },
    pose,
  };
}

export interface ChorusTryMePerformanceProps {
  sec: number;
}

export const ChorusTryMePerformance: React.FC<ChorusTryMePerformanceProps> = ({
  sec,
}) => {
  return (
    <ChorusLyrics
      sec={sec}
      diveStartSec={L015_START_SEC}
      peekStartSec={L015_PEEK_START_SEC}
      firstExitStartSec={L015_END_SEC - 0.16}
      secondHitSec={L015_LAND_HIT_SEC}
      secondExitStartSec={L015_END_SEC - 0.16}
      secondExitEndSec={L015_END_SEC}
    />
  );
};
