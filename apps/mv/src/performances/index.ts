import {
  sampleStageKeyboard,
  sampleVerse1PlanProgress,
  type ClawdRhythmMotion,
} from "../timeline/verse1";
import {
  ExitTerminalPerformance,
  resolveExitTerminalActor,
  resolveExitTerminalPlacement,
} from "./ExitTerminal";
import { resolvePlayKeyboardActor } from "./PlayKeyboard";
import {
  PlayTrumpetPerformance,
  resolvePlayTrumpetActor,
  resolvePlayTrumpetPlacement,
} from "./PlayTrumpet";
import { ReadBookPerformance, resolveReadBookActor } from "./ReadBook";
import {
  resolveSpeakLanguagesActor,
  SpeakLanguagesPerformance,
} from "./SpeakLanguages";
import type {
  ClawdActorState,
  ClawdStagePlacement,
  Verse1ClawdPerformanceState,
} from "./types";

export {
  ExitTerminalPerformance,
  PlayTrumpetPerformance,
  ReadBookPerformance,
  resolvePlayKeyboardActor,
  SpeakLanguagesPerformance,
  type ClawdActorState,
  type ClawdStagePlacement,
  type Verse1ClawdPerformanceState,
};

/**
 * 综合编排 Verse 1 (00:00.000 → 00:55.168) 全场唯一 Clawd 实例的舞台位置与动作道具状态
 */
export function resolveVerse1ClawdPerformance(
  sec: number,
  authoredFrame: number,
  rhythm: ClawdRhythmMotion | undefined,
): Verse1ClawdPerformanceState {
  // 1. 舞台位置与缩放/层级编排
  let placement: ClawdStagePlacement = {
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
    zIndex: 3,
  };

  if (sec >= 35.34 && sec < 45.2) {
    placement = resolveExitTerminalPlacement(sec);
  } else if (sec >= 49.82 && sec < 55.0) {
    placement = resolvePlayTrumpetPlacement(sec);
  }

  // 2. 身体动作、表情、视线与近身道具编排
  const baseActor: ClawdActorState = {
    action: "idle",
    actionProgress: 0,
    eyes: "normal",
    prop: "none",
    glassesProgress: 0,
    bookProgress: 0,
    trumpetProgress: 0,
    beatPulse: 0,
    lookOffset: { x: 0, y: 0 },
  };

  let actor = baseActor;

  if (sec < 18.525) {
    actor = resolvePlayKeyboardActor(sec, baseActor);
  } else if (sec < 22.721) {
    const kbTail = sec < 18.95 ? sampleStageKeyboard(sec) : undefined;
    actor = {
      ...baseActor,
      action: "wave-step",
      actionProgress: sampleVerse1PlanProgress(authoredFrame, "wave"),
      prop: kbTail?.visible ? "keyboard" : "none",
      keyboardState: kbTail?.visible ? kbTail : undefined,
    };
  } else if (sec < 27.161) {
    actor = {
      ...baseActor,
      action: "tilt-invite",
      actionProgress: sampleVerse1PlanProgress(authoredFrame, "invite"),
    };
  } else if (sec < 31.695) {
    actor = {
      ...baseActor,
      action: "posture-nod",
      actionProgress: sampleVerse1PlanProgress(authoredFrame, "posture"),
    };
  } else if (sec < 34.026) {
    actor = {
      ...baseActor,
      action: "self-present",
      actionProgress: sampleVerse1PlanProgress(authoredFrame, "present"),
    };
  } else if (sec < 40.8) {
    actor = resolveExitTerminalActor(sec, authoredFrame, baseActor);
  } else if (sec < 45.36) {
    actor = resolveSpeakLanguagesActor(sec, authoredFrame, baseActor);
  } else if (sec < 49.892) {
    actor = resolveReadBookActor(sec, authoredFrame, baseActor);
  } else {
    actor = resolvePlayTrumpetActor(sec, authoredFrame, rhythm, baseActor);
  }

  return {
    placement,
    actor,
  };
}
