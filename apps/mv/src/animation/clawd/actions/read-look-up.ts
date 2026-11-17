import { clampedInterpolate } from "../motion-style.ts";
import type { ClawdPoseDelta } from "../poses.ts";

/**
 * A8 (L009–L010 本体): 低头读书配合微翻页 (0~0.56) -> 从书后抬头挺身 (0.56~0.88) -> 平滑回正清场 (0.88~1.0)
 */
export function sampleReadLookUpAction(
  p: number,
  breathY: number,
): ClawdPoseDelta {
  if (p < 0.56) {
    const readEnv = clampedInterpolate(p, [0, 0.12], [0, 1]);
    const readT = p / 0.56;
    const flipPulse = Math.max(0, Math.sin(readT * Math.PI * 3));
    return {
      bodyOffsetY:
        breathY * 0.5 + (0.22 + Math.sin(readT * Math.PI * 2) * 0.05) * readEnv,
      actionLookX: Math.sin(readT * Math.PI * 3) * 0.32 * readEnv,
      actionLookY: 0.32 * readEnv,
      rightArmDeltaY: (-0.2 - flipPulse * 0.28) * readEnv,
      leftArmDeltaY: -0.15 * readEnv,
    };
  }

  const proudBodyEnv = clampedInterpolate(p, [0.56, 0.7, 0.86, 1], [0, 1, 1, 0]);
  const proudArmEnv = clampedInterpolate(
    p,
    [0.56, 0.7, 0.86, 1],
    [0.6, 1, 1, 0],
  );
  return {
    bodyOffsetY:
      breathY * (1 - proudBodyEnv * 0.5) +
      clampedInterpolate(p, [0.56, 0.7, 0.86, 1], [0.22, -0.26, -0.2, 0]),
    scaleY: 1 + 0.045 * proudBodyEnv,
    actionLookX: 0,
    actionLookY: clampedInterpolate(
      p,
      [0.56, 0.7, 0.86, 1],
      [0.32, -0.18, -0.14, 0],
    ),
    leftArmDeltaY: -0.25 * proudArmEnv,
    rightArmDeltaY: -0.25 * proudArmEnv,
  };
}
