import React from "react";
import { smoothStep } from "../animation/clawd/motion-style";
import { HoraCallout } from "../components/props";
import {
  sampleVerse1PlanProgress,
  type ClawdRhythmMotion,
} from "../timeline/verse1";
import type { ClawdActorState, ClawdStagePlacement } from "./types";

/**
 * L011–L065 (49.892s–55.168s) 角色迎接小号与ほら！回中的水平站位过渡
 */
export function resolvePlayTrumpetPlacement(sec: number): ClawdStagePlacement {
  const toL011 = smoothStep(sec, 49.82, 50.38); // 0 -> -44
  const toL065 = smoothStep(sec, 52.1, 52.56); // -44 -> -24
  const toCenter = smoothStep(sec, 54.0, 54.85); // -24 -> 0
  return {
    x: -44 * toL011 + 20 * toL065 + 24 * toCenter,
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
    return {
      ...base,
      action: "idle",
      actionProgress: p11,
      prop: "trumpet",
      trumpetProgress: p11,
      beatPulse,
      lookOffset: {
        x:
          0.28 *
          smoothStep(sec, 49.892, 50.35) *
          (1 - smoothStep(sec, 52.05, 52.55)),
        y:
          -0.08 *
          smoothStep(sec, 49.892, 50.35) *
          (1 - smoothStep(sec, 52.05, 52.55)),
      },
    };
  }

  // L065 (52.576~55.168s): 贴地极速回弹 + ^ ^ 微笑弯眼
  const popProg = sampleVerse1PlanProgress(authoredFrame, "pop");
  return {
    ...base,
    action: "elastic-pop",
    actionProgress: popProg,
    eyes: sec >= 52.83 && sec <= 54.68 ? "happy" : "normal",
  };
}

export interface PlayTrumpetPerformanceProps {
  sec: number;
}

export const PlayTrumpetPerformance: React.FC<PlayTrumpetPerformanceProps> = ({
  sec,
}) => {
  return <HoraCallout sec={sec} />;
};
