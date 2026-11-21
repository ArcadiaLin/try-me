import { VIDEO_FPS } from "../video-spec";
import {
  beatGridFrame,
  beatPosition,
  beatPulseEnvelope,
  fitBeatGrid,
  rhythmMotion,
  sampleRhythmPlan,
  sampleStageKeyboard,
  type BeatGrid,
  type ClawdRhythmMotion,
  type RhythmKey,
  type RhythmPlan,
  type StageKeyboardState,
  type StageKeyboardZoneState,
} from "./rhythm-timing.ts";
import { VERSE1_RHYTHM } from "./verse1-rhythm.ts";

export {
  beatGridFrame,
  beatPosition,
  beatPulseEnvelope,
  fitBeatGrid,
  rhythmMotion,
  sampleRhythmPlan,
  sampleStageKeyboard,
  VERSE1_RHYTHM,
  type BeatGrid,
  type ClawdRhythmMotion,
  type RhythmKey,
  type RhythmPlan,
  type StageKeyboardState,
  type StageKeyboardZoneState,
};

export type Verse1PlanId = (typeof VERSE1_RHYTHM.plans)[number]["id"];

/** 截至 L065 (ほら！) 句后留白结束、L013 开始前的完整时长：55.168s (3310 帧 @ 60fps) */
export const VERSE1_MV_DURATION_SEC = 55.168;
export const VERSE1_MV_FPS = VIDEO_FPS;
export const VERSE1_MV_FRAMES = Math.round(
  VERSE1_MV_DURATION_SEC * VERSE1_MV_FPS,
); // 3310

export interface Verse1EventMeta {
  id: string;
  startSec: number;
  endSec: number;
  lyric: string;
  summary: string;
}

export const VERSE1_EVENTS: readonly Verse1EventMeta[] = [
  {
    id: "L066",
    startSec: 0.0,
    endSec: 18.224,
    lyric: "(Intro — 前奏合成器律动)",
    summary: "呼吸眨眼待机 → 贴地左右换重心",
  },
  {
    id: "L001",
    startSec: 18.525,
    endSec: 22.721,
    lyric: "Hey, let's go, I can take it",
    summary: "看向观众短挥手 → 重心前送 → 自信小幅蹲起",
  },
  {
    id: "L002",
    startSec: 22.721,
    endSec: 25.221,
    lyric: "What do you want to know?",
    summary: "轻侧身歪头 + 前足邀请提问 → 留白停顿与视线回正",
  },
  {
    id: "L003",
    startSec: 27.161,
    endSec: 31.695,
    lyric: "得意なことを",
    summary: "收拢姿态 → 抬头挺身 → 两次差幅点头",
  },
  {
    id: "L004",
    startSec: 31.695,
    endSec: 34.026,
    lyric: "自己アピール",
    summary: "前足朝胸口示意 → 向外展开展示 → 平滑回稳",
  },
  {
    id: "L064",
    startSec: 34.026,
    endSec: 36.371,
    lyric: "(间奏 — 蹲下缩入后台待命)",
    summary: "贴地蹲起 → 缩小钻入地面命令行待命框 [ > _ ]",
  },
  {
    id: "L005",
    startSec: 36.371,
    endSec: 38.429,
    lyric: "I can appear as and when you need",
    summary:
      "Web / Desktop / CLI 三端依次唤出 → 从终端跃出至左侧落地左倾踉跄 (> <)",
  },
  {
    id: "L006",
    startSec: 38.429,
    endSec: 40.828,
    lyric: "365日",
    summary:
      "稳住重心看向右侧 GitHub 热力图 (1→365) → 句尾「日」字轻快双拍明显点头",
  },
  {
    id: "L007",
    startSec: 40.8,
    endSec: 42.91,
    lyric: "I speak different languages",
    summary: "五行气泡四语同时打字推进 + 第五行 ...（Clawd 不张嘴）",
  },
  {
    id: "L008",
    startSec: 42.91,
    endSec: 45.151,
    lyric: "And people get what I mean",
    summary: "气泡平滑移至正上方 + 两侧极简听众滑入点头回应 → 退场",
  },
  {
    id: "L009",
    startSec: 45.36,
    endSec: 47.58,
    lyric: "中学生の頃は",
    summary: "眼镜与3D立体书同时入场 + 双手滑向胸前捧书 + 背后深绿参数场",
  },
  {
    id: "L010",
    startSec: 47.58,
    endSec: 49.892,
    lyric: "I was the best in every class",
    summary: "三项能力汇成 TOP CLASS 小奖章 + 抬头挺身 → 镜右书左同时退场",
  },
  {
    id: "L011",
    startSec: 49.892,
    endSec: 52.576,
    lyric: "ブラバン部で楽器も吹けるよ",
    summary: "小号从右滑入接住 → 抬起吹奏飘出音符 → 放低向右送出",
  },
  {
    id: "L065",
    startSec: 52.576,
    endSec: 53.549,
    lyric: "(ほら！)",
    summary: "极速贴地回弹 + ^ ^ 微笑弯眼 + 右上红底黄边手写『ほら！』",
  },
] as const;

/**
 * 根据当前帧采样指定动作计划 (planId) 的重定时进度
 */
export function sampleVerse1PlanProgress(
  authoredFrame: number,
  planId: Verse1PlanId,
): number {
  const plan = VERSE1_RHYTHM.plans.find((p) => p.id === planId);
  if (!plan) {
    throw new Error(`Unknown Verse 1 rhythm plan: ${planId}`);
  }
  return sampleRhythmPlan(authoredFrame, plan);
}

/**
 * 查找当前秒数激活的歌词事件（供 HUD 检视栏显示）
 */
export function findActiveVerse1Event(sec: number): Verse1EventMeta {
  return (
    VERSE1_EVENTS.find((ev) => sec >= ev.startSec && sec < ev.endSec) ??
    VERSE1_EVENTS.slice()
      .reverse()
      .find((ev) => sec >= ev.startSec) ??
    VERSE1_EVENTS[0]
  );
}
