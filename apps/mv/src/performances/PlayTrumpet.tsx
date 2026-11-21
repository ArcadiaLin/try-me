import React from "react";
import { smoothStep } from "../animation/clawd/motion-style";
import { TrumpetMagicStage } from "../components/environment";
import { HoraCallout } from "../components/props";
import {
  sampleVerse1PlanProgress,
  type ClawdRhythmMotion,
} from "../timeline/verse1";
import type { ClawdActorState, ClawdStagePlacement } from "./types";

/**
 * L011–L065 (49.892s–55.168s) 舞台站位：Clawd 全程稳居中央 (x = 0)，不因小号入场向左挤移
 */
export function resolvePlayTrumpetPlacement(): ClawdStagePlacement {
  return {
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
    zIndex: 5,
  };
}

/**
 * L011 (接住＋吹奏＋音符＋送出) 与 L065 (ほら！贴地回弹) 的身体与道具协调
 */
export function resolvePlayTrumpetActor(
  sec: number,
  authoredFrame: number,
  rhythm: ClawdRhythmMotion | undefined,
  base: ClawdActorState,
): ClawdActorState {
  if (sec < 52.576) {
    const p11 = sampleVerse1PlanProgress(authoredFrame, "trumpet");
    let beatPulse = 0;
    if (p11 >= 0.22 && p11 <= 0.76) {
      const playT = (p11 - 0.22) / 0.54;
      beatPulse = rhythm ? rhythm.pulse * Math.sin(playT * Math.PI) * 0.12 : 0;
    }
    // 右上方系绳荡入期间 (49.89s -> 50.36s) 先向右上方看去迎接小号，接住后顺势看向右前方吹奏
    const lookCatch =
      smoothStep(sec, 49.892, 50.06) * (1 - smoothStep(sec, 50.25, 50.43));
    const lookPlay =
      smoothStep(sec, 49.95, 50.35) * (1 - smoothStep(sec, 52.05, 52.55));
    return {
      ...base,
      action: "idle",
      actionProgress: p11,
      prop: "trumpet",
      trumpetProgress: p11,
      beatPulse,
      lookOffset: {
        x: 0.34 * lookCatch + 0.28 * lookPlay,
        y: -0.44 * lookCatch - 0.08 * lookPlay,
      },
    };
  }

  // L065 (52.576~55.168s): 贴地极速回弹 + ^ ^ 微笑弯眼，右手回原位继续帅气拿着小号展示（54.6s 后轻巧收起）
  const popProg = sampleVerse1PlanProgress(authoredFrame, "pop");
  const holdTail = 1 + Math.max(0, Math.min(1, (sec - 52.576) / (55.1 - 52.576)));
  return {
    ...base,
    action: "elastic-pop",
    actionProgress: popProg,
    prop: "trumpet",
    trumpetProgress: holdTail,
    eyes: sec >= 52.83 && sec <= 54.68 ? "happy" : "normal",
  };
}

export interface PlayTrumpetPerformanceProps {
  sec: number;
  clawdX?: number;
  trumpetProgress?: number;
  beatPulse?: number;
}

export const PlayTrumpetPerformance: React.FC<PlayTrumpetPerformanceProps> = ({
  sec,
  clawdX,
  trumpetProgress = 0,
  beatPulse = 0,
}) => {
  const resolvedClawdX = clawdX ?? resolvePlayTrumpetPlacement().x;
  return (
    <>
      <TrumpetMagicStage
        sec={sec}
        clawdX={resolvedClawdX}
        trumpetProgress={trumpetProgress}
        beatPulse={beatPulse}
      />
      <HoraCallout sec={sec} />
    </>
  );
};
