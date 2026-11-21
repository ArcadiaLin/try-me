import type {
  ClawdAction,
  ClawdEyes,
  ClawdPose,
  ClawdProp,
} from "../components/clawd/types";
import type { StageKeyboardState } from "../timeline/verse1";

export interface ClawdStagePlacement {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  zIndex: number;
  /** 可选舞台容器裁切（例如 L064 扎进左侧台面洞口时裁掉台面以下身体） */
  clipPath?: string;
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
  /** 可选直接覆盖计算好的完整骨骼姿态（用于叠加碎步跳或跳洞挥手告别） */
  pose?: ClawdPose;
}

export interface Verse1StageLightingState {
  x: number;
  iris: number;
  ambient: number;
  rx: number;
  ry: number;
  lampHalfWidth: number;
  glow: number;
}

export interface Verse1StageTrapdoorState {
  x: number;
  open: number;
  sinceEnter: number;
}

export interface Verse1ClawdPerformanceState {
  placement: ClawdStagePlacement;
  actor: ClawdActorState;
  spotlight: Verse1StageLightingState;
  trapdoor: Verse1StageTrapdoorState;
}
