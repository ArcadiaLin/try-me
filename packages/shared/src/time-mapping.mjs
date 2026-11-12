/**
 * Canonical global video frame for any audio timestamp (relative to audio sample 0).
 * Used identically across Annotator UI, agent-brief.md export, and Remotion preview.
 */
export function audioSecToGlobalFrame(audioSec, offsetSec = 0, fps = 30) {
  return Math.round((Number(audioSec) + Number(offsetSec)) * Number(fps));
}

/**
 * Inverse mapping from canonical global video frame to audio timestamp in seconds.
 */
export function globalFrameToAudioSec(globalFrame, offsetSec = 0, fps = 30) {
  return Number(globalFrame) / Number(fps) - Number(offsetSec);
}

/**
 * Compute unified Remotion preview timeline parameters from annotation payload and props.
 */
export function computePreviewTimeline(data, props, fpsOverride) {
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

  const toGlobalFrame = (audioSec) =>
    audioSecToGlobalFrame(audioSec, effectiveOffsetSec, fps);

  const offsetFrames = Math.round(effectiveOffsetSec * fps);
  const clipStartFrame = Math.max(0, toGlobalFrame(clipStartSec));
  const clipEndFrame = Math.max(
    clipStartFrame + 30,
    toGlobalFrame(clipEndSec),
  );
  const durationInFrames = Math.max(30, clipEndFrame - clipStartFrame);

  const localFrameToGlobalFrame = (localFrame) => clipStartFrame + localFrame;
  const audioSecToVideoFrame = (audioSec) =>
    toGlobalFrame(audioSec) - clipStartFrame;
  const videoFrameToAudioSec = (localFrame) =>
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
