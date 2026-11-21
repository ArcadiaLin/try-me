import { resolveClawdPose } from "../animation/clawd/blend";
import { HEY_START_SEC } from "../timeline/hey-wave";
import type { ClawdRhythmMotion } from "../timeline/verse1";
import {
  ExitTerminalPerformance,
  resolveExitTerminalActor,
  resolveExitTerminalPlacement,
} from "./ExitTerminal";
import {
  IntroSpotlightPerformance,
  resolveIntroSpotlightActor,
  resolvePreludeAndSpotlightStage,
  resolveVerse1Spotlight,
  resolveVerse1Trapdoor,
  VERSE1_BASS_IN_SEC,
  VERSE1_DIVE_ENTER_SEC,
  VERSE1_EXIT_TERMINAL_SEC,
  VERSE1_HIGHWAY_CLOSE_SEC,
  VERSE1_PRELUDE_SIDE_X,
} from "./IntroSpotlight";
import {
  HeyBubblePerformance,
  resolvePlayKeyboardActor,
} from "./PlayKeyboard";
import {
  PlayTrumpetPerformance,
  resolvePlayTrumpetActor,
  resolvePlayTrumpetPlacement,
} from "./PlayTrumpet";
import {
  ReadBookPerformance,
  resolveReadBookActor,
  resolveReadBookPlacement,
} from "./ReadBook";
import {
  resolveSpeakLanguagesActor,
  resolveSpeakLanguagesPlacement,
  SpeakLanguagesPerformance,
} from "./SpeakLanguages";
import type {
  ClawdActorState,
  ClawdStagePlacement,
  Verse1ClawdPerformanceState,
  Verse1StageLightingState,
  Verse1StageTrapdoorState,
} from "./types";

export {
  ExitTerminalPerformance,
  HeyBubblePerformance,
  IntroSpotlightPerformance,
  PlayTrumpetPerformance,
  ReadBookPerformance,
  resolvePlayKeyboardActor,
  resolveVerse1Spotlight,
  resolveVerse1Trapdoor,
  SpeakLanguagesPerformance,
  VERSE1_BASS_IN_SEC,
  VERSE1_DIVE_ENTER_SEC,
  VERSE1_EXIT_TERMINAL_SEC,
  VERSE1_HIGHWAY_CLOSE_SEC,
  VERSE1_PRELUDE_SIDE_X,
  type ClawdActorState,
  type ClawdStagePlacement,
  type Verse1ClawdPerformanceState,
  type Verse1StageLightingState,
  type Verse1StageTrapdoorState,
};

/**
 * 综合编排 Verse 1 (00:00.000 → 00:55.168) 全场唯一 Clawd 实例的舞台位置、动作道具、聚光灯与台面小洞状态。
 * 按单一时间轴区间顺序同时分发 placement + actor，消除动作与位置的区间错位。
 */
export function resolveVerse1ClawdPerformance(
  sec: number,
  authoredFrame: number,
  rhythm: ClawdRhythmMotion | undefined,
  options: { preludeAmbient?: number; spotAmbient?: number } = {},
): Verse1ClawdPerformanceState {
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

  let placement: ClawdStagePlacement;
  let actor: ClawdActorState;

  if (sec < VERSE1_EXIT_TERMINAL_SEC) {
    // 0.000s – 37.540s: 前奏左侧弹琴 (L066–L068) + 追光入场与中央段落 (L001–L004) + 左侧台面小洞挥手退场 (L064)
    const stageActor =
      sec < HEY_START_SEC
        ? resolvePlayKeyboardActor(sec, baseActor)
        : resolveIntroSpotlightActor(sec, authoredFrame, baseActor);
    ({ placement, actor } = resolvePreludeAndSpotlightStage(
      sec,
      rhythm,
      stageActor,
    ));
  } else if (sec < 40.8) {
    // 37.540s – 40.800s: L005–L006 终端内亮相 -> 跃出终端落地左移 -> 365日热力图点头
    placement = resolveExitTerminalPlacement(sec);
    actor = resolveExitTerminalActor(sec, authoredFrame, baseActor);
  } else if (sec < 45.36) {
    // 40.800s – 45.360s: L007–L008 多语言气泡 (-215px) -> 听众共鸣归中 (0px)
    placement = resolveSpeakLanguagesPlacement(sec);
    actor = resolveSpeakLanguagesActor(sec, authoredFrame, baseActor);
  } else if (sec < 49.892) {
    // 45.360s – 49.892s: L009–L010 舞台中央捧读 3D 书与白反光眼镜
    placement = resolveReadBookPlacement();
    actor = resolveReadBookActor(sec, authoredFrame, baseActor);
  } else {
    // 49.892s – 55.168s: L011–L065 迎接小号吹奏与 ほら！回中回弹
    placement = resolvePlayTrumpetPlacement();
    actor = resolvePlayTrumpetActor(sec, authoredFrame, rhythm, baseActor);
  }

  // 统一在编排出口生成最终 ClawdPose，确保全片姿态管线唯一
  if (!actor.pose) {
    actor = {
      ...actor,
      pose: resolveClawdPose({
        action: actor.action,
        actionProgress: actor.actionProgress,
        prop: actor.prop,
        bookProgress: actor.bookProgress,
        trumpetProgress: actor.trumpetProgress,
        keyboardState: actor.keyboardState,
        beatPulse: actor.beatPulse,
        rhythm,
        timeSec: sec,
      }),
    };
  }

  return {
    placement,
    actor,
    spotlight: resolveVerse1Spotlight(sec, options),
    trapdoor: resolveVerse1Trapdoor(sec),
  };
}
