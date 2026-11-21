import React from "react";
import {
  clampedInterpolate,
  linearProg,
  smoothStep,
} from "../animation/clawd/motion-style";
import { MultilangBubble } from "../components/environment";
import { sampleVerse1PlanProgress } from "../timeline/verse1";
import type { ClawdActorState, ClawdStagePlacement } from "./types";

/**
 * L007–L008 (40.800s–45.360s) 角色配合多语言气泡站稳 (-215px) 与听众回应归中 (0px)
 */
export function resolveSpeakLanguagesPlacement(
  sec: number,
): ClawdStagePlacement {
  const toL007 = smoothStep(sec, 40.35, 41.05);
  const toL008 = smoothStep(sec, 42.75, 43.38);
  return {
    x: -195 - 20 * toL007 + 215 * toL008,
    y: 0,
    scale: 1,
    opacity: 1,
    zIndex: 5,
  };
}

/**
 * L007–L008 (40.800s–45.360s) 多语言气泡与两侧听众共鸣的身体与视线协调
 */
export function resolveSpeakLanguagesActor(
  sec: number,
  authoredFrame: number,
  base: ClawdActorState,
): ClawdActorState {
  if (sec < 42.91) {
    // L007: 不张嘴，温和换重心并以眼神配合右上方五行气泡
    return {
      ...base,
      action: "weight-shift",
      actionProgress: sampleVerse1PlanProgress(authoredFrame, "sway"),
      lookOffset: { x: 0.42, y: -0.18 },
    };
  }

  // L008: 眼神先后看向左右听众，随后弯眼 (^ ^) 点头回应
  const replyWindow = sec >= 43.95 && sec <= 44.72;
  return {
    ...base,
    action: replyWindow ? "posture-nod" : "idle",
    actionProgress: replyWindow
      ? sampleVerse1PlanProgress(authoredFrame, "reply")
      : linearProg(sec, 42.91, 45.36),
    eyes: sec >= 43.88 && sec <= 44.92 ? "happy" : "normal",
    lookOffset: {
      x: clampedInterpolate(
        sec,
        [42.91, 43.35, 43.75, 43.95, 44.35, 44.75, 45.36],
        [0.42, -0.32, -0.32, 0.32, 0.32, 0, 0],
      ),
      y: clampedInterpolate(
        sec,
        [42.91, 43.35, 44.75, 45.36],
        [-0.18, -0.06, -0.06, 0],
      ),
    },
  };
}

export interface SpeakLanguagesPerformanceProps {
  sec: number;
}

export const SpeakLanguagesPerformance: React.FC<
  SpeakLanguagesPerformanceProps
> = ({ sec }) => {
  return <MultilangBubble sec={sec} />;
};
