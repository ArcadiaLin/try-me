/** Minimal JSON design proposal. Not imported by the running application. */
export interface Comment {
  role: "human" | "agent";
  text: string;
}

// Comments may describe the project, a group, a timeline or a single event.
export interface Commented {
  comments?: Comment[];
}

export interface TimelineEvent extends Commented {
  id: string;
  startSec: number;
  endSec?: number; // Omit for a point. Present => [startSec, endSec).
  text: string;
}

export interface TimelineTrack extends Commented {
  kind: "timeline";
  id: string;
  name: string;
  items: TimelineEvent[];
}

export interface TimelineGroup extends Commented {
  kind: "group";
  id: string;
  name: string;
  children: TimelineNode[];
}
export type TimelineNode = TimelineGroup | TimelineTrack;

// This is the whole persistent format. Other types below are transient UI state.
export interface TimelineProject extends Commented {
  version: 1;
  name: string;
  audio?: string; // Project-relative path; no fingerprint or analysis manifest.
  nodes: TimelineNode[];
}

export interface EventRef {
  trackId: string;
  eventId: string;
}
export type SelectionState =
  | { kind: "none" }
  | { kind: "group"; groupId: string }
  | { kind: "track"; trackId: string }
  | { kind: "events"; refs: EventRef[]; primary: EventRef };
export interface TimelineViewState {
  startSec: number;
  endSec: number;
  pixelsPerSec: number;
  visibleTrackIds: string[];
  lockedNodeIds: string[];
  collapsedGroupIds: string[];
}
export interface TransportState {
  audioPath: string | null;
  durationSec: number;
  currentTimeSec: number;
  playing: boolean;
  rate: number;
  loop: { startSec: number; endSec: number } | null;
}

// Boundary links are editing-session state, not required JSON fields.
export interface BoundaryLink {
  trackId: string;
  leftEventId: string;
  rightEventId: string;
}
export interface WorkbenchEditState {
  selection: SelectionState;
  previewWindowSec: number;
  boundaryLinks: BoundaryLink[];
  snapEnabled: boolean;
}
export type WorkbenchCommand =
  | { type: "update"; ref: EventRef; patch: Partial<Omit<TimelineEvent, "id">> }
  | { type: "move"; refs: EventRef[]; deltaSec: number }
  | {
      type: "setBoundary";
      ref: EventRef;
      edge: "start" | "end";
      timeSec: number;
    }
  | { type: "split"; ref: EventRef; timeSec: number }
  | { type: "linkBoundary" | "unlinkBoundary"; link: BoundaryLink }
  | { type: "joinBoundary"; link: BoundaryLink; timeSec: number }
  | {
      type: "audition";
      ref: EventRef;
      mode: "whole" | "beforeStart" | "afterStart" | "beforeEnd" | "afterEnd";
    }
  | { type: "appendComment"; targetId: string | null; comment: Comment }
  | { type: "delete"; refs: EventRef[] };
export interface WorkspaceLayoutState {
  explorerWidth: number;
  inspectorWidth: number;
  trackerHeight: number;
  agentOpen: boolean;
}
export interface PersistenceState {
  phase: "saved" | "dirty" | "saving" | "offline" | "error";
  draftAvailable: boolean;
}
export type LegacyEventRef =
  | { source: "lyrics" | "markers" | "regions"; id: string }
  | { source: "custom"; trackId: string; id: string };
export interface EventAdapter {
  readLegacy(): TimelineNode[];
  resolveLegacy(ref: EventRef): LegacyEventRef | null;
  execute(command: WorkbenchCommand): void;
}
