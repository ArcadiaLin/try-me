import type {
  ClawdAction,
  ClawdEyes,
  ClawdProp,
} from "../components/clawd/types";
import type { StageKeyboardState } from "../timeline/verse1";

export interface ClawdStagePlacement {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  zIndex: number;
}

export interface ClawdActorState {
  action: ClawdAction;
  actionProgress: number;
  eyes: ClawdEyes;
  prop: ClawdProp;
  glassesProgress: number;
  bookProgress: number;
  trumpetProgress: number;
  keyboardState?: StageKeyboardState;
  beatPulse: number;
  lookOffset: { x: number; y: number };
}

export interface Verse1ClawdPerformanceState {
  placement: ClawdStagePlacement;
  actor: ClawdActorState;
}
