import type {
  ClawdAction,
  ClawdEyes,
  ClawdProp,
} from "../components/clawd/types";

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
  beatPulse: number;
  lookOffset: { x: number; y: number };
}

export interface Verse1ClawdPerformanceState {
  placement: ClawdStagePlacement;
  actor: ClawdActorState;
}
