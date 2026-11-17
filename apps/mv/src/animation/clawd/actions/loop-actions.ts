import type { ClawdPoseDelta } from "../poses.ts";

export type LoopActionName =
  | "static"
  | "idle"
  | "crouch"
  | "nod"
  | "walk"
  | "wave"
  | "bounce";

export function sampleLoopAction(
  action: LoopActionName,
  timeSec: number,
  breathY: number,
): ClawdPoseDelta {
  if (action === "static") {
    return {
      bodyOffsetY: 0,
    };
  }
  if (action === "idle") {
    return {
      bodyOffsetY: breathY,
    };
  }
  if (action === "crouch") {
    const squatWave = Math.max(0, Math.sin(timeSec * Math.PI * 3.5));
    return {
      bodyOffsetY: squatWave * 0.65,
      scaleX: 1 + squatWave * 0.06,
      scaleY: 1 - squatWave * 0.06,
      leftArmDeltaY: -squatWave * 0.25,
      rightArmDeltaY: -squatWave * 0.25,
    };
  }
  if (action === "nod") {
    return {
      bodyOffsetY: Math.abs(Math.sin(timeSec * Math.PI * 3.56)) * 0.32,
      bodyOffsetX: Math.sin(timeSec * Math.PI * 1.78) * 0.25,
      leftArmDeltaY: Math.sin(timeSec * Math.PI * 3.56) * 0.18,
      rightArmDeltaY: -Math.sin(timeSec * Math.PI * 3.56) * 0.18,
    };
  }
  if (action === "walk") {
    const stride = Math.sin(timeSec * Math.PI * 6);
    const leg1Lift = Math.max(0, stride) * 0.75;
    const leg3Lift = Math.max(0, stride) * 0.75;
    const leg2Lift = Math.max(0, -stride) * 0.75;
    const leg4Lift = Math.max(0, -stride) * 0.75;
    return {
      bodyOffsetY: Math.abs(Math.sin(timeSec * Math.PI * 6)) * -0.28,
      leftArmDeltaY: Math.sin(timeSec * Math.PI * 6) * 0.25,
      rightArmDeltaY: -Math.sin(timeSec * Math.PI * 6) * 0.25,
      legLifts: [leg1Lift, leg2Lift, leg3Lift, leg4Lift],
      isAirborneAction: true,
    };
  }
  if (action === "wave") {
    return {
      bodyOffsetY: Math.sin(timeSec * Math.PI * 3) * 0.15,
      rightArmDeltaY: -0.65 + Math.sin(timeSec * Math.PI * 8) * 0.45,
      leftArmDeltaY: Math.sin(timeSec * Math.PI * 3) * 0.15,
    };
  }
  // bounce
  const phase = (timeSec * 2) % 1;
  const jumpArc = Math.sin(phase * Math.PI);
  const bodyOffsetY = -jumpArc * 0.85;
  const lift = Math.max(0, -bodyOffsetY) * 0.65;
  return {
    bodyOffsetY,
    scaleX: phase < 0.12 ? 1.07 : 1 - jumpArc * 0.04,
    scaleY: phase < 0.12 ? 0.93 : 1 + jumpArc * 0.05,
    leftArmDeltaY: bodyOffsetY * 0.35,
    rightArmDeltaY: bodyOffsetY * 0.35,
    legLifts: [lift, lift, lift, lift],
    isAirborneAction: true,
  };
}
