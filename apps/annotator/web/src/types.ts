export type ItemStatus = "candidate" | "confirmed";
export type AgentStatus = "none" | "open" | "in_progress" | "resolved";

export interface LyricLine {
  id: string;
  index?: number;
  section_id: string;
  bar: number;
  start_sec: number;
  end_sec: number;
  lrc_start_sec?: number;
  vocal_onset_sec?: number | null;
  origin_candidate_id?: string | null;
  text: string;
  lang?: string;
  status: ItemStatus;
  note: string;
  script_idea?: string;
  linked_shots?: string[];
  agent_comment?: string;
  agent_status?: AgentStatus;
  agent_reply?: string;
}

export interface LyricsBundle {
  available: boolean;
  updated_at_utc?: string | null;
  status?: ItemStatus;
  lines: LyricLine[];
}

export interface PointMarker {
  id: string;
  kind: "point";
  category: string;
  label: string;
  color: string;
  time_sec: number;
  source: "auto" | "human";
  origin_candidate_id: string | null;
  origin_analysis_run_id: string | null;
  origin_analysis_sha256: string | null;
  origin_candidate_time_sec: number | null;
  origin_candidate_sample_index: number | null;
  status: ItemStatus;
  linked_shots: string[];
  note: string;
  script_idea: string;
  agent_comment: string;
  agent_status: AgentStatus;
  agent_reply: string;
  lyric_hint: string;
}

export interface RegionItem {
  id: string;
  kind: "region";
  category: string;
  label: string;
  color: string;
  start_sec: number;
  end_sec: number;
  source: "auto" | "human";
  status: ItemStatus;
  linked_shots: string[];
  note: string;
  script_idea: string;
  agent_comment: string;
  agent_status: AgentStatus;
  agent_reply: string;
  lyric_hint: string;
}

export interface TimelineCollectionDef {
  id: string;
  title: string;
  description: string;
}

export interface TimelineTrackItem {
  id: string;
  kind: "region" | "point";
  group_id: string | null;
  parent_id: string | null;
  category: string;
  label: string;
  color: string;
  start_sec: number;
  end_sec: number | null;
  time_sec: number | null;
  source: "auto" | "human";
  status: ItemStatus;
  origin_candidate_id: string | null;
  origin_analysis_run_id: string | null;
  origin_analysis_sha256: string | null;
  origin_candidate_time_sec: number | null;
  origin_candidate_sample_index: number | null;
  data: Record<string, unknown>;
  linked_shots: string[];
  note: string;
  script_idea: string;
  agent_comment: string;
  agent_status: AgentStatus;
  agent_reply: string;
}

export interface CustomTimelineTrack {
  id: string;
  collection_id: string;
  name: string;
  type: string;
  purpose_for_agent: string;
  allow_overlap: boolean;
  color: string;
  visible: boolean;
  locked: boolean;
  items: TimelineTrackItem[];
}

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

export interface PreviewMapping {
  preview_fps: number;
  audio_offset_seconds: number;
}

export interface GlobalNotes {
  overall_concept: string;
  visual_style_notes: string;
  instructions_for_agent: string;
}

export interface AnnotationsDocument {
  schema_version: string;
  updated_at_utc: string;
  id_counters: {
    marker_seq: number;
    region_seq: number;
    track_seq?: number;
    custom_item_seq?: number;
  };
  audio_asset: AudioAssetMeta;
  preview_mapping: PreviewMapping;
  global_notes: GlobalNotes;
  markers: PointMarker[];
  regions: RegionItem[];
  collections?: TimelineCollectionDef[];
  custom_tracks?: CustomTimelineTrack[];
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
  revision: string;
  audioHashMismatch: boolean;
  audioAvailable: boolean;
  analysis: AnalysisBundle;
  annotations: AnnotationsDocument;
  lyrics: LyricsBundle;
  agentBriefMarkdown: string;
  timelineFile?: string;
}

export type BuiltinTrackId =
  | "lyrics_main"
  | "structure_sections"
  | "structure_clips"
  | "rhythm_downbeats"
  | "rhythm_markers"
  | "cand_beats"
  | "cand_onsets"
  | "cand_energy";

export type TrackId = BuiltinTrackId | string;

export interface TrackVisibilityMap {
  lyrics_main: boolean;
  structure_sections: boolean;
  structure_clips: boolean;
  rhythm_downbeats: boolean;
  rhythm_markers: boolean;
  cand_beats: boolean;
  cand_onsets: boolean;
  cand_energy: boolean;
  [trackId: string]: boolean;
}

export interface TrackLockMap {
  lyrics_main: boolean;
  structure_sections: boolean;
  structure_clips: boolean;
  rhythm_downbeats: boolean;
  rhythm_markers: boolean;
  [trackId: string]: boolean;
}

export type AuditionMode =
  | "line"
  | "before_start"
  | "after_start"
  | "before_end"
  | "after_end";
