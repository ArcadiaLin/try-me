import { interpolate } from "remotion";
import { CLAWD_MODEL } from "../../../components/clawd/model.ts";
import { clamp01, clampedInterpolate } from "../motion-style.ts";
import type { ClawdPoseDelta } from "../poses.ts";

/**
 * 计算 stumble-left（左两足踮脚三小跳 + 右两足悬空）的精确腾空弧度与水平阶梯进度：
 * - 四个离散落点比例：0 (-105px) -> 0.50 (-150px, 跨度 45px) -> 0.822 (-179px, 跨度 29px) -> 1.0 (-195px, 跨度 16px)
 * - 三次踮脚跳的高度与滞空时长依次递减（高度比 1.00 -> 0.62 -> 0.32），触地期间 hopArc === 0 且 X 坐标 100% 锁死不滑步！
 */
export function getStumbleLeftKinematics(pRaw: number): {
  hopArc: number;
  hopHeightRatio: number;
  plantCompression: number;
  xSpots: [number, number, number, number];
  currentXRatio: number;
} {
  const p = clamp01(pRaw);
  const r0 = 0;
  const r1 = 0.5;
  const r2 = 0.822;
  const r3 = 1.0;

  let hopArc = 0;
  let hopHeightRatio = 0;
  let plantCompression = 0;
  let currentXRatio = r0;

  if (p < 0.06) {
    currentXRatio = r0;
    plantCompression = Math.sin((p / 0.06) * Math.PI);
  } else if (p < 0.3) {
    const t = (p - 0.06) / 0.24;
    hopArc = Math.sin(t * Math.PI);
    hopHeightRatio = 1.0;
    currentXRatio = r0 + (r1 - r0) * t;
  } else if (p < 0.37) {
    currentXRatio = r1;
    plantCompression = Math.sin(((p - 0.3) / 0.07) * Math.PI) * 0.8;
  } else if (p < 0.56) {
    const t = (p - 0.37) / 0.19;
    hopArc = Math.sin(t * Math.PI);
    hopHeightRatio = 0.62;
    currentXRatio = r1 + (r2 - r1) * t;
  } else if (p < 0.63) {
    currentXRatio = r2;
    plantCompression = Math.sin(((p - 0.56) / 0.07) * Math.PI) * 0.55;
  } else if (p < 0.77) {
    const t = (p - 0.63) / 0.14;
    hopArc = Math.sin(t * Math.PI);
    hopHeightRatio = 0.32;
    currentXRatio = r2 + (r3 - r2) * t;
  } else {
    currentXRatio = r3;
    plantCompression =
      p < 0.84 ? Math.sin(((p - 0.77) / 0.07) * Math.PI) * 0.35 : 0;
  }

  return {
    hopArc,
    hopHeightRatio,
    plantCompression,
    xSpots: [r0, r1, r2, r3],
    currentXRatio,
  };
}

export function sampleStumbleLeftAction(
  p: number,
  breathY: number,
): ClawdPoseDelta {
  const { hopArc, hopHeightRatio, plantCompression } =
    getStumbleLeftKinematics(p);
  const stumbleBlend = clampedInterpolate(
    p,
    [0, 0.04, 0.86, 1],
    [0, 1, 1, 0],
  );
  const hopBodyY =
    p < 0.77
      ? 0.18 * plantCompression - 1.05 * hopArc * hopHeightRatio
      : interpolate(p, [0.77, 0.84, 1], [0.1, 0, 0]);
  const bodyOffsetY = breathY * (1 - stumbleBlend) + hopBodyY;

  const torsoTiltDeg = clampedInterpolate(
    p,
    [0, 0.05, 0.3, 0.35, 0.56, 0.61, 0.77, 0.93, 1],
    [-13.5, -15.5, -11.5, -12.2, -8.5, -8.8, -6.5, 1.4, 0],
  );
  const armFlail = clampedInterpolate(
    p,
    [0, 0.06, 0.8, 0.93, 1],
    [0, 1, 1, 0.15, 0],
  );
  const flailEnv = clampedInterpolate(
    p,
    [0, 0.08, 0.78, 0.92, 1],
    [0, 1, 1, 0.15, 0],
  );
  const flapWave = Math.sin(p * Math.PI * 10);

  const rightAirEnv = clampedInterpolate(
    p,
    [0, 0.03, 0.35, 0.6, 0.77, 0.94, 1],
    [0.95, 1, 0.82, 0.62, 0.48, 0.1, 0],
  );
  const leg1Lift = hopArc * hopHeightRatio * 1.05;
  const leg2Lift = hopArc * hopHeightRatio * 0.96;
  const leg3Lift = 1.35 * rightAirEnv + hopArc * hopHeightRatio * 0.9;
  const leg4Lift = 1.85 * rightAirEnv + hopArc * hopHeightRatio * 1.0;

  return {
    bodyOffsetX: 0,
    bodyOffsetY,
    torsoTiltDeg,
    rotPivotX: CLAWD_MODEL.joints.stumbleLeftPivotX,
    leftArmExtend: 0.75 * armFlail,
    rightArmExtend: 0.65 * armFlail,
    leftArmDeltaY: -0.42 * flailEnv + flapWave * 0.84 * flailEnv,
    rightArmDeltaY: -0.52 * flailEnv - flapWave * 0.84 * flailEnv,
    legLifts: [leg1Lift, leg2Lift, leg3Lift, leg4Lift],
    isStumbleHop: p < 0.95,
    actionLookX: clampedInterpolate(
      p,
      [0, 0.78, 0.9, 1],
      [-0.35, -0.25, 0.48, 0.5],
    ),
    sweatDropsProgress: p < 0.88 ? p : null,
  };
}
