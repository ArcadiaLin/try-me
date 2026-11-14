/** Current persisted TimelineProject specification (version: 1).
 * Documentation only; runtime types live in apps/annotator/web/src/types.ts.
 * UI and editing-session state are intentionally excluded.
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

// Complete persistent format; UI state does not belong in this document.
export interface TimelineProject extends Commented {
  version: 1;
  name: string;
  audio?: string; // Project-relative path; no fingerprint or analysis manifest.
  nodes: TimelineNode[];
}
