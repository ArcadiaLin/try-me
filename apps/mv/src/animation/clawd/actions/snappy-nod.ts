import { clampedInterpolate } from "../motion-style.ts";
import type { ClawdPoseDelta } from "../poses.ts";

/**
 * L006「365日」句尾轻快明显的双拍弹性点头：干脆利落连点两下（咔-哒！）+ 身体轻快弹性配合
 */
export function sampleSnappyNodAction(
  p: number,
  breathY: number,
): ClawdPoseDelta {
  const nodBlend = clampedInterpolate(p, [0, 0.06, 0.9, 1], [0, 1, 1, 0]);
  const nodY = clampedInterpolate(
    p,
    [0, 0.18, 0.34, 0.54, 0.74, 0.9, 1],
    [0, 0.86, -0.32, 0.96, -0.26, 0.08, 0],
  );
  const snapArm = clampedInterpolate(
    p,
    [0, 0.18, 0.34, 0.54, 0.74, 1],
    [0, 0.28, -0.42, 0.32, -0.38, 0],
  );

  return {
    bodyOffsetY: breathY * (1 - nodBlend) + nodY,
    torsoTiltDeg: clampedInterpolate(
      p,
      [0, 0.18, 0.34, 0.54, 0.74, 1],
      [0, 5.2, -2.0, 6.0, -1.6, 0],
    ),
    scaleX: clampedInterpolate(
      p,
      [0, 0.18, 0.34, 0.54, 0.74, 1],
      [1, 1.09, 0.95, 1.11, 0.96, 1],
    ),
    scaleY: clampedInterpolate(
      p,
      [0, 0.18, 0.34, 0.54, 0.74, 1],
      [1, 0.89, 1.06, 0.88, 1.05, 1],
    ),
    actionLookY: clampedInterpolate(
      p,
      [0, 0.18, 0.34, 0.54, 0.74, 1],
      [0, 0.34, -0.14, 0.38, -0.12, 0],
    ),
    leftArmDeltaY: snapArm,
    rightArmDeltaY: snapArm,
  };
}

/**
 * A9 (L065 ほら！贴地弹性回弹原子动作):
 * 极短下压蓄力 (0~0.14) -> 瞬间弹起伸展 (0.14~0.21) -> 快速微回摆稳住 (0.21~0.42)
 */
export function sampleElasticPopAction(
  p: number,
  breathY: number,
): ClawdPoseDelta {
  const popBlend = clampedInterpolate(p, [0, 0.05, 0.42, 0.55], [0, 1, 1, 0]);
  const popY = clampedInterpolate(
    p,
    [0, 0.11, 0.14, 0.21, 0.3, 0.38, 0.46, 1],
    [0, 0.94, 0.98, -0.48, 0.16, -0.05, 0, 0],
  );
  const popFlare = clampedInterpolate(p, [0.14, 0.21, 0.36], [0, 1, 0]);
  const preload = clampedInterpolate(p, [0, 0.14, 0.19], [0, 1, 0]);
  const popUp = clampedInterpolate(p, [0.14, 0.21, 0.36], [0, 1, 0]);
  const armDelta = preload * 0.34 - popUp * 0.78;

  return {
    bodyOffsetY: breathY * (1 - popBlend) + popY,
    scaleX: clampedInterpolate(
      p,
      [0, 0.14, 0.21, 0.3, 0.4, 1],
      [1, 1.12, 0.91, 1.03, 1, 1],
    ),
    scaleY: clampedInterpolate(
      p,
      [0, 0.14, 0.21, 0.3, 0.4, 1],
      [1, 0.87, 1.11, 0.97, 1, 1],
    ),
    leftArmExtend: 0.48 * popFlare,
    rightArmExtend: 0.48 * popFlare,
    actionLookY: -0.18 * popFlare,
    leftArmDeltaY: armDelta,
    rightArmDeltaY: armDelta,
  };
}
