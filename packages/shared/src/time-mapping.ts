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

/**
 * Canonical global video frame for any audio timestamp (relative to audio sample 0).
 * Used identically across Annotator UI, agent-brief.md export, and Remotion preview.
 */
export function audioSecToGlobalFrame(
  audioSec: number,
  offsetSec = 0,
  fps = 30,
): number {
  return Math.round((Number(audioSec) + Number(offsetSec)) * Number(fps));
}

/**
 * Inverse mapping from canonical global video frame to audio timestamp in seconds.
 */
export function globalFrameToAudioSec(
  globalFrame: number,
  offsetSec = 0,
  fps = 30,
): number {
  return Number(globalFrame) / Number(fps) - Number(offsetSec);
}

/**
 * Compute unified Remotion preview timeline parameters from annotation payload and props.
 */
export function computePreviewTimeline(
  data: Partial<AnnotationsPreviewPayload> | null | undefined,
  props: Partial<SyncPreviewProps> | null | undefined,
  fpsOverride?: number,
): PreviewTimeline {
  const fps = Math.max(
    1,
    Math.round(fpsOverride ?? data?.preview_mapping?.preview_fps ?? 30),
  );
  const effectiveOffsetSec =
    props?.audioOffsetSeconds !== undefined && props.audioOffsetSeconds !== 0
      ? props.audioOffsetSeconds
      : (data?.preview_mapping?.audio_offset_seconds ?? 0);

  const repClip = data?.regions?.find(
    (r) => r.category === "representative_clip" || r.id === "CLIP_01",
  );
  const clipStartSec = repClip ? Math.max(0, repClip.start_sec) : 0;
  const clipEndSec =
    repClip && repClip.end_sec > clipStartSec
      ? repClip.end_sec
      : clipStartSec + (props?.clipDurationSeconds || 15.65);

  const toGlobalFrame = (audioSec: number): number =>
    audioSecToGlobalFrame(audioSec, effectiveOffsetSec, fps);

  const offsetFrames = Math.round(effectiveOffsetSec * fps);
  const clipStartFrame = Math.max(0, toGlobalFrame(clipStartSec));
  const clipEndFrame = Math.max(
    clipStartFrame + 30,
    toGlobalFrame(clipEndSec),
  );
  const durationInFrames = Math.max(30, clipEndFrame - clipStartFrame);

  const localFrameToGlobalFrame = (localFrame: number): number =>
    clipStartFrame + localFrame;
  const audioSecToVideoFrame = (audioSec: number): number =>
    toGlobalFrame(audioSec) - clipStartFrame;
  const videoFrameToAudioSec = (localFrame: number): number =>
    globalFrameToAudioSec(
      clipStartFrame + localFrame,
      effectiveOffsetSec,
      fps,
    );

  const audioStartAudioFrames = clipStartFrame - offsetFrames;
  const sequenceFromFrames =
    audioStartAudioFrames < 0 ? -audioStartAudioFrames : 0;
  const audioTrimBeforeFrames =
    audioStartAudioFrames > 0 ? audioStartAudioFrames : 0;
  const clipEndAudioFrames = Math.max(1, Math.round(clipEndSec * fps));
  const audioDurationFrames = Math.max(
    1,
    clipEndAudioFrames - audioTrimBeforeFrames,
  );

  return {
    fps,
    effectiveOffsetSec,
    clipStartSec,
    clipEndSec,
    clipStartFrame,
    clipEndFrame,
    durationInFrames,
    localFrameToGlobalFrame,
    audioSecToGlobalFrame: toGlobalFrame,
    videoFrameToAudioSec,
    audioSecToVideoFrame,
    sequenceFromFrames,
    audioTrimBeforeFrames,
    audioDurationFrames,
  };
}
