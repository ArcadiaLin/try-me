export type PreviewMarker = {
  id: string;
  kind: "point";
  category: string;
  label: string;
  color: string;
  time_sec: number;
  status: "confirmed" | "candidate";
  origin_candidate_id?: string | null;
  linked_shots: string[];
  note: string;
  script_idea: string;
  agent_comment: string;
  agent_status: string;
  agent_reply: string;
};

export type PreviewRegion = {
  id: string;
  kind: "region";
  category: string;
  label: string;
  color: string;
  start_sec: number;
  end_sec: number;
  status: "confirmed" | "candidate";
  linked_shots: string[];
  note: string;
  script_idea: string;
  agent_comment: string;
  agent_status: string;
  agent_reply: string;
};

export type AnnotationsPreviewPayload = {
  schema_version: string;
  updated_at_utc: string;
  audio_hash_mismatch?: boolean;
  audio_asset: {
    asset_id: string;
    path: string;
    sha256: string | null;
    duration_sec: number;
    samplerate?: number;
    total_samples?: number;
    analysis_run_id?: string | null;
  };
  preview_mapping: {
    preview_fps: number;
    audio_offset_seconds: number;
  };
  global_notes: {
    overall_concept: string;
    visual_style_notes: string;
    instructions_for_agent: string;
  };
  markers: PreviewMarker[];
  regions: PreviewRegion[];
};

export type SyncPreviewProps = {
  silentPreview: boolean;
  clipDurationSeconds: number;
  audioOffsetSeconds: number;
};

export type PreviewTimeline = {
  fps: number;
  effectiveOffsetSec: number;
  clipStartSec: number;
  clipEndSec: number;
  clipStartFrame: number;
  clipEndFrame: number;
  durationInFrames: number;
  localFrameToGlobalFrame: (localFrame: number) => number;
  audioSecToGlobalFrame: (audioSec: number) => number;
  videoFrameToAudioSec: (localFrame: number) => number;
  audioSecToVideoFrame: (audioSec: number) => number;
  sequenceFromFrames: number;
  audioTrimBeforeFrames: number;
  audioDurationFrames: number;
};

export declare function audioSecToGlobalFrame(
  audioSec: number,
  offsetSec?: number,
  fps?: number,
): number;

export declare function globalFrameToAudioSec(
  globalFrame: number,
  offsetSec?: number,
  fps?: number,
): number;

export declare function computePreviewTimeline(
  data: AnnotationsPreviewPayload,
  props: SyncPreviewProps,
  fpsOverride?: number,
): PreviewTimeline;
