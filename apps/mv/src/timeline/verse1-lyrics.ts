import { audioSecToGlobalFrame } from "@try-me/shared";

/**
 * 舞台底部终端的歌词 stdout 时间表（截至 L065）。
 *
 * - 起止秒数逐条对应 `annotations/try-me.timeline.json` 的 `trk_lyrics`（L001–L014 为人工严格人声轴）；
 *   测试会校验两者一致，修改人声边界后需同步本表。
 * - `log`：终端正常打印；`ghost`：该句由舞台元素承载（如 L007 多语言气泡、L065 手写字），
 *   终端仍记录这一行，但以暗淡残影显示，不与舞台抢焦点。
 * - `input`：终端输入行回车后的命令回显，不是歌词。
 * - 每行在 `startFrame` 一次完整出现（不逐字打出），随后终端整体上滚。
 */
export type LyricTerminalMode = "log" | "ghost" | "input";

export interface LyricTerminalCue {
  id: string;
  startSec: number;
  /** 歌词人声结束秒数；命令回显没有结束时间 */
  endSec?: number;
  text: string;
  mode: LyricTerminalMode;
}

export const VERSE1_LYRIC_CUES: readonly LyricTerminalCue[] = [
  { id: "L001", startSec: 18.463, endSec: 22.721, text: "Hey, let's go, I can take it", mode: "log" },
  { id: "L002", startSec: 22.721, endSec: 25.221, text: "What do you want to know?", mode: "log" },
  { id: "L003", startSec: 27.161, endSec: 31.695, text: "得意なことを", mode: "log" },
  { id: "L004", startSec: 31.695, endSec: 34.026, text: "自己アピール", mode: "log" },
  { id: "L005", startSec: 36.371, endSec: 38.429, text: "I can appear as and when you need", mode: "log" },
  // L005 中段：终端输入 `claude` 回车，触发右侧 Claude Code 窗口（TerminalSummon 37.28s 弹出）
  { id: "SYS_L005_CLAUDE", startSec: 37.28, text: "claude", mode: "input" },
  { id: "L006", startSec: 38.429, endSec: 40.828, text: "365日", mode: "log" },
  { id: "L007", startSec: 40.8, endSec: 42.91, text: "I speak different languages", mode: "ghost" },
  { id: "L008", startSec: 42.91, endSec: 45.151, text: "And people get what I mean", mode: "log" },
  { id: "L009", startSec: 45.36, endSec: 47.58, text: "中学生の頃は", mode: "log" },
  { id: "L010", startSec: 47.58, endSec: 49.892, text: "I was the best in every class", mode: "log" },
  { id: "L011", startSec: 49.892, endSec: 52.576, text: "ブラバン部で楽器も吹けるよ", mode: "log" },
  { id: "L065", startSec: 52.576, endSec: 53.549, text: "ほら！", mode: "ghost" },
];

/** L064 缩入终端后的待命状态（取代原地面 `[ > _ STANDBY ]` 胶囊） */
export const TERMINAL_STANDBY_START_SEC = 35.341;
/** 在终端输入行逐字键入 `claude`，回车时刻即 SYS_L005_CLAUDE 的 startSec */
export const TERMINAL_TYPE_START_SEC = 37.04;
export const TERMINAL_TYPE_END_SEC = 37.24;

/** 可见历史行数（含最新行） */
export const TERMINAL_VISIBLE_ROWS = 4;
/** 换行上滚时长（帧），ease-out，不回弹 */
export const TERMINAL_SCROLL_FRAMES = 4;

const ROW_DEPTH_OPACITY = [1, 0.55, 0.3, 0.14, 0];

export interface TerminalLineState {
  cue: LyricTerminalCue;
  /** 0 为最上一行，TERMINAL_VISIBLE_ROWS - 1 为最新行；连续值用于上滚 */
  row: number;
  /** 由行深度决定的透明度（尚未乘 ghost 衰减） */
  depthOpacity: number;
  isNewest: boolean;
}

export interface TerminalInputState {
  text: string;
  standby: boolean;
  typing: boolean;
}

export interface LyricTerminalState {
  lines: TerminalLineState[];
  input: TerminalInputState;
}

function easeOutCubic(t: number) {
  const c = Math.max(0, Math.min(1, t));
  return 1 - (1 - c) ** 3;
}

export function cueStartFrame(cue: LyricTerminalCue, fps: number): number {
  return audioSecToGlobalFrame(cue.startSec, 0, fps);
}

/** 纯函数：根据视频帧采样终端可见行与输入行状态 */
export function sampleLyricTerminal(
  frame: number,
  fps: number,
  cues: readonly LyricTerminalCue[] = VERSE1_LYRIC_CUES,
): LyricTerminalState {
  const printed = cues.filter((cue) => frame >= cueStartFrame(cue, fps));

  // 连续滚动量：每打印一行贡献 0→1 的 ease-out
  let scroll = 0;
  for (const cue of printed) {
    scroll += easeOutCubic(
      (frame - cueStartFrame(cue, fps)) / TERMINAL_SCROLL_FRAMES,
    );
  }

  const lines: TerminalLineState[] = [];
  printed.forEach((cue, i) => {
    const row = i - scroll + TERMINAL_VISIBLE_ROWS;
    const depth = TERMINAL_VISIBLE_ROWS - 1 - row;
    if (depth > ROW_DEPTH_OPACITY.length - 1) return;
    const lo = Math.max(0, Math.floor(depth));
    const hi = Math.min(ROW_DEPTH_OPACITY.length - 1, lo + 1);
    const f = Math.max(0, depth) - lo;
    const depthOpacity =
      ROW_DEPTH_OPACITY[lo] * (1 - f) + ROW_DEPTH_OPACITY[hi] * f;
    lines.push({
      cue,
      row,
      depthOpacity,
      isNewest: i === printed.length - 1,
    });
  });

  const sec = frame / fps;
  const enterCue = cues.find((cue) => cue.id === "SYS_L005_CLAUDE");
  const enterFrame = enterCue ? cueStartFrame(enterCue, fps) : Infinity;
  let text = "";
  let typing = false;
  if (sec >= TERMINAL_TYPE_START_SEC && frame < enterFrame) {
    typing = true;
    const word = enterCue?.text ?? "";
    const t = Math.max(
      0,
      Math.min(
        1,
        (sec - TERMINAL_TYPE_START_SEC) /
          (TERMINAL_TYPE_END_SEC - TERMINAL_TYPE_START_SEC),
      ),
    );
    text = word.slice(0, Math.round(t * word.length));
  }

  return {
    lines,
    input: {
      text,
      typing,
      standby: sec >= TERMINAL_STANDBY_START_SEC && sec < TERMINAL_TYPE_START_SEC,
    },
  };
}
