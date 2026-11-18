import { beatGridFrame, beatPosition } from "./rhythm-timing.ts";
import { VERSE1_RHYTHM } from "./verse1-rhythm.ts";

/**
 * L001 "Hey" 奋力挥爪段的共享时间表（Clawd 挥爪与 hey 气泡共用同一相位）。
 *
 * - 人声 "Hey" 起点 18.463s（时间轴 L001）；就近候选拍点在连续拍网格上的第 33 拍（约 18.483s）。
 * - 18.43s 起 1 帧预备下沉，人声后 2 帧内抬身到位；
 * - 三次挥爪各占半拍，爪尖最高点落在半拍网格上；
 * - 第 4 个半拍点开始回落，19.9s (F597) 交给 wave 计划继续前送与蹲起。
 * 拍网格为候选数据，尚未人工确认小节第一拍。
 */
const FPS = VERSE1_RHYTHM.fps;
const beats = VERSE1_RHYTHM.beatFrames;

/** 时间轴 L001 人声起点 */
export const HEY_VOCAL_SEC = 18.463;
/** wave-step 接管 Clawd 的时刻（小键盘已在 18.42s 前退场） */
export const HEY_START_SEC = 18.43;
/** 抬身到位（人声后约 2 帧） */
export const HEY_LIFT_PEAK_SEC = 18.533;
/** Hey 段结束、交给 wave 计划的整数帧时刻 (F597)，与 tools/audio-analyzer/plan-verse1-rhythm.ts 保持一致 */
export const HEY_END_SEC = 597 / 30;
/** Hey 段在 wave-step 动作进度中的占比 */
export const HEY_PROGRESS_SPAN = 0.36;

const heyBeatIndex = Math.round(beatPosition(HEY_VOCAL_SEC * FPS, beats));
const halfBeatSec = (beatGridFrame(heyBeatIndex + 0.5, beats) - beatGridFrame(heyBeatIndex, beats)) / FPS;

/** 第一次爪尖最高点（落在 Hey 就近拍点上） */
export const HEY_WAVE_START_SEC = beatGridFrame(heyBeatIndex, beats) / FPS;
/** 挥爪次数（每次半拍） */
export const HEY_WAVE_COUNT = 3;
/** 第三次挥完、爪尖再次到顶的时刻 */
export const HEY_WAVE_END_SEC = HEY_WAVE_START_SEC + HEY_WAVE_COUNT * halfBeatSec;
/** 回落开始（下一个半拍点） */
export const HEY_RELEASE_START_SEC = HEY_WAVE_END_SEC + halfBeatSec;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function smoothStep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export interface HeyWaveState {
  /** 预备下沉 (0 ~ 1 ~ 0) */
  windup: number;
  /** 抬身与举爪包络 (0 ~ 1) */
  lift: number;
  /** 挥爪纵向相位：-1 为爪尖最高（落在半拍点），+1 为最低 */
  waveY: number;
  /** 挥爪横向相位 */
  waveX: number;
}

export function sampleHeyWave(sec: number): HeyWaveState {
  const windupT = clamp01((sec - HEY_START_SEC) / (HEY_VOCAL_SEC + 0.02 - HEY_START_SEC));
  const windup = sec < HEY_START_SEC ? 0 : Math.sin(windupT * Math.PI);
  const lift =
    smoothStep(HEY_VOCAL_SEC, HEY_LIFT_PEAK_SEC, sec) *
    (1 - smoothStep(HEY_RELEASE_START_SEC, HEY_END_SEC, sec));
  const cycles = Math.max(
    0,
    Math.min(HEY_WAVE_COUNT, (sec - HEY_WAVE_START_SEC) / halfBeatSec),
  );
  return {
    windup,
    lift,
    waveY: -Math.cos(cycles * Math.PI * 2),
    waveX: Math.sin(cycles * Math.PI * 2),
  };
}

/** wave-step 进度 (0 ~ HEY_PROGRESS_SPAN) 与 Hey 段秒数的线性映射 */
export function heyProgressToSec(p: number): number {
  return HEY_START_SEC + (p / HEY_PROGRESS_SPAN) * (HEY_END_SEC - HEY_START_SEC);
}

export function heySecToProgress(sec: number): number {
  return clamp01((sec - HEY_START_SEC) / (HEY_END_SEC - HEY_START_SEC)) * HEY_PROGRESS_SPAN;
}
