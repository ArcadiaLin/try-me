import { interpolate } from "remotion";

/**
 * 统一的缓动、范围归一化、挤压拉伸与呼吸基线规则
 */

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** 归一化线性进度 (0 ~ 1) */
export function linearProg(sec: number, start: number, end: number): number {
  return clamp01((sec - start) / Math.max(0.0001, end - start));
}

/** Hermite 平滑阶跃 (C1 连续，首尾速度均为 0) */
export function smoothStep(sec: number, start: number, end: number): number {
  const t = linearProg(sec, start, end);
  return t * t * (3 - 2 * t);
}

/** 夹紧的线性分段插值简写 */
export function clampedInterpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
): number {
  return interpolate(input, inputRange, outputRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** 默认呼吸垂直位移基线（当外部未传入节拍同步 breathY 时使用） */
export function defaultBreathY(timeSec: number): number {
  return Math.sin(timeSec * Math.PI * 2) * 0.12;
}
