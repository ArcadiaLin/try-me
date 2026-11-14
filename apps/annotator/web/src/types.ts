/**
 * Persistent data model and transient UI state types for Annotator v5.
 * Matches docs/annotator/schema.types.ts & D007–D009.
 */

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
  color?: string; // Optional #RRGGBB override; omit to inherit the track color.
}

export interface TimelineTrack extends Commented {
  kind: "timeline";
  id: string;
  name: string;
  items: TimelineEvent[];
  color?: string; // Optional #RRGGBB default for this track's events.
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

export type ContextMenuState =
  | { kind: "closed" }
  | {
      kind: "events";
      x: number;
      y: number;
      trackId: string;
      refs: EventRef[];
      splitTimeSec: number;
      blankArea?: boolean;
    }
  | { kind: "explorer"; x: number; y: number; nodeId: string | null };

export type ExplorerCommand =
  | { type: "createNode"; parentGroupId: string | null; node: TimelineNode }
  | { type: "renameNode"; nodeId: string; name: string }
  | { type: "deleteNode"; nodeId: string };

export type AuditionMode =
  | "whole"
  | "beforeStart"
  | "afterStart"
  | "beforeEnd"
  | "afterEnd";

export type WorkbenchCommand =
  | { type: "createEvent"; trackId: string; event: TimelineEvent }
  | { type: "setTrackColor"; trackId: string; color: string | null }
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
      mode: AuditionMode;
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

// Read-only local audio analysis candidate types (never embedded into TimelineProject)
export interface AudioAssetMeta {
  asset_id: string;
  path: string;
  sha256: string | null;
  duration_sec: number;
  samplerate: number;
  total_samples: number;
  analysis_run_id: string | null;
  analysis_generated_at_utc?: string | null;
}

export interface AnalysisCandidate {
  id: string;
  kind: "beat" | "onset";
  time_sec: number;
  sample_index: number;
  onset_strength?: number;
}

export interface WaveformBin {
  start_sec: number;
  end_sec: number;
  min: number;
  max: number;
  rms?: number;
}

export interface EnergyShiftCandidate {
  id: string;
  time_sec: number;
  delta_rms?: number;
}

export interface EnergyFrame {
  time_sec: number;
  rms: number;
}

export interface AnalysisBundle {
  available: boolean;
  summary: {
    analysis_run_id?: string;
    generated_at_utc?: string;
    input_audio?: AudioAssetMeta;
  } | null;
  waveform: {
    bins_per_sec?: number;
    bin_count?: number;
    bins: WaveformBin[];
  } | null;
  beats: AnalysisCandidate[];
  onsets: AnalysisCandidate[];
  energyShifts: EnergyShiftCandidate[];
  energyFrames: EnergyFrame[];
}

export interface ServerStatePayload {
  project: TimelineProject;
  audioAvailable: boolean;
  durationSec: number;
  samplerate: number;
  analysis: AnalysisBundle;
  agentBriefMarkdown: string;
  timelineFile?: string;
}
