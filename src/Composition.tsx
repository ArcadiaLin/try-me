import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Composition,
  continueRender,
  delayRender,
  getStaticFiles,
  Html5Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  watchStaticFile,
} from "remotion";

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

const FALLBACK_ANNOTATIONS: AnnotationsPreviewPayload = {
  schema_version: "0.1.0",
  updated_at_utc: "fallback-silent-preview",
  audio_asset: {
    asset_id: "A001",
    path: "public/private/audio/try-me.flac",
    sha256: null,
    duration_sec: 209.719615,
    samplerate: 44100,
    total_samples: 9248635,
    analysis_run_id: null,
  },
  preview_mapping: {
    preview_fps: 30,
    audio_offset_seconds: 0,
  },
  global_notes: {
    overall_concept: "静音兜底预览模式（未检测到私有标注文件时使用内置候选演示）",
    visual_style_notes: "通过帧与秒数统一映射公式验证声画同步",
    instructions_for_agent: "",
  },
  markers: [
    {
      id: "M0001",
      kind: "point",
      category: "downbeat",
      label: "Candidate Beat 1",
      color: "#f59e0b",
      time_sec: 0.58,
      status: "candidate",
      linked_shots: ["S001"],
      note: "候选参考点（待人工听辨确认）",
      script_idea: "验证帧同步触发",
      agent_comment: "",
      agent_status: "none",
      agent_reply: "",
    },
  ],
  regions: [
    {
      id: "CLIP_01",
      kind: "region",
      category: "representative_clip",
      label: "CLIP_01 代表性同步验证区间草稿",
      color: "#10b981",
      start_sec: 0,
      end_sec: 15.65,
      status: "candidate",
      linked_shots: ["S001", "S002"],
      note: "10–20 秒验证区间草稿（待人工听辨确认）",
      script_idea: "验证节拍闪光、段落区间与整数帧换算",
      agent_comment: "",
      agent_status: "none",
      agent_reply: "",
    },
  ],
};

function hasPrivateFile(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return getStaticFiles().some(
    (file) => file.name.replace(/\\/g, "/") === normalized,
  );
}

export function computePreviewTimeline(
  data: AnnotationsPreviewPayload,
  props: SyncPreviewProps,
  fpsOverride?: number,
) {
  const fps = Math.max(
    1,
    Math.round(fpsOverride ?? data.preview_mapping?.preview_fps ?? 30),
  );
  const effectiveOffsetSec =
    props.audioOffsetSeconds !== 0
      ? props.audioOffsetSeconds
      : (data.preview_mapping?.audio_offset_seconds ?? 0);

  const repClip = data.regions?.find(
    (r) => r.category === "representative_clip" || r.id === "CLIP_01",
  );
  const clipStartSec = repClip ? Math.max(0, repClip.start_sec) : 0;
  const clipEndSec =
    repClip && repClip.end_sec > clipStartSec
      ? repClip.end_sec
      : clipStartSec + (props.clipDurationSeconds || 15.65);

  // Canonical global video frame for any audio timestamp (identical to Annotator & agent-brief.md)
  const audioSecToGlobalFrame = (audioSec: number) =>
    Math.round((audioSec + effectiveOffsetSec) * fps);

  const offsetFrames = Math.round(effectiveOffsetSec * fps);
  const clipStartFrame = Math.max(0, audioSecToGlobalFrame(clipStartSec));
  const clipEndFrame = Math.max(
    clipStartFrame + 30,
    audioSecToGlobalFrame(clipEndSec),
  );
  const durationInFrames = Math.max(30, clipEndFrame - clipStartFrame);

  // Convert local Remotion composition frame (0..durationInFrames-1) to canonical global frame
  const localFrameToGlobalFrame = (localFrame: number) =>
    clipStartFrame + localFrame;

  // Convert canonical global frame to local Remotion composition frame
  const audioSecToVideoFrame = (audioSec: number) =>
    audioSecToGlobalFrame(audioSec) - clipStartFrame;

  // Audio time (relative to audio sample 0) at a given local Remotion frame
  const videoFrameToAudioSec = (localFrame: number) =>
    (clipStartFrame + localFrame) / fps - effectiveOffsetSec;

  // Remotion <Sequence> & <Html5Audio> parameters aligned to clipStartFrame
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
    audioSecToGlobalFrame,
    videoFrameToAudioSec,
    audioSecToVideoFrame,
    sequenceFromFrames,
    audioTrimBeforeFrames,
    audioDurationFrames,
  };
}

const calculateMetadata: CalculateMetadataFunction<SyncPreviewProps> = async ({
  props,
}) => {
  let payload = FALLBACK_ANNOTATIONS;

  if (hasPrivateFile("private/annotations-preview.json")) {
    try {
      const res = await fetch(staticFile("private/annotations-preview.json"));
      if (res.ok) {
        payload = (await res.json()) as AnnotationsPreviewPayload;
      }
    } catch {
      // Keep fallback metadata if private preview file cannot be fetched
    }
  }

  const timeline = computePreviewTimeline(payload, props);
  return {
    fps: timeline.fps,
    durationInFrames: timeline.durationInFrames,
  };
};

export const MyComposition = () => {
  return (
    <Composition
      id="MyComp"
      component={MyComponent}
      durationInFrames={470}
      fps={30}
      width={1280}
      height={720}
      calculateMetadata={calculateMetadata}
      defaultProps={{
        silentPreview: false,
        clipDurationSeconds: 15.65,
        audioOffsetSeconds: 0,
      }}
    />
  );
};

export const MyComponent: React.FC<SyncPreviewProps> = (props) => {
  const { silentPreview } = props;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const [data, setData] =
    useState<AnnotationsPreviewPayload>(FALLBACK_ANNOTATIONS);

  const audioFileAvailable = hasPrivateFile("private/audio/try-me.flac");
  const previewJsonAvailable = hasPrivateFile(
    "private/annotations-preview.json",
  );

  useEffect(() => {
    if (!previewJsonAvailable) return;
    let cancelled = false;
    const handle = delayRender("Loading private/annotations-preview.json");

    const loadPreviewJson = async (isInitial: boolean) => {
      try {
        const res = await fetch(
          `${staticFile("private/annotations-preview.json")}?t=${Date.now()}`,
        );
        if (res.ok) {
          const json = (await res.json()) as AnnotationsPreviewPayload;
          if (!cancelled) setData(json);
        }
      } catch {
        // Fallback already in state
      } finally {
        if (isInitial) {
          continueRender(handle);
        }
      }
    };

    loadPreviewJson(true);
    const { cancel } = watchStaticFile(
      "private/annotations-preview.json",
      () => {
        loadPreviewJson(false);
      },
    );

    return () => {
      cancelled = true;
      cancel();
    };
  }, [previewJsonAvailable]);

  const timeline = computePreviewTimeline(data, props, fps);
  const globalFrame = timeline.localFrameToGlobalFrame(frame);
  const audioSeconds = timeline.videoFrameToAudioSec(frame);
  const toGlobalFrame = timeline.audioSecToGlobalFrame;
  const sampleRate = data.audio_asset?.samplerate ?? 44100;
  const currentSample = Math.max(0, Math.round(audioSeconds * sampleRate));

  // Active region by half-open integer global frame interval [startFrame, endFrame)
  const activeRegions = (data.regions || []).filter((r) => {
    const startF = toGlobalFrame(r.start_sec);
    const endF = toGlobalFrame(r.end_sec);
    return globalFrame >= startF && globalFrame < endF;
  });
  const primaryRegion = activeRegions[0] || null;

  // Match point markers by canonical global integer frame so F17/F360 triggers identically to Annotator & agent-brief.md
  const maxDecayFrames = Math.max(4, Math.round(0.35 * fps));
  const recentMarker = (data.markers || [])
    .filter((m) => {
      const mFrame = toGlobalFrame(m.time_sec);
      return globalFrame >= mFrame && globalFrame - mFrame <= maxDecayFrames;
    })
    .sort((a, b) => toGlobalFrame(b.time_sec) - toGlobalFrame(a.time_sec))[0];

  const framesSinceMarker = recentMarker
    ? Math.max(0, globalFrame - toGlobalFrame(recentMarker.time_sec))
    : 999;

  const isDownbeat = recentMarker?.category === "downbeat";
  const pulseStrength = interpolate(
    framesSinceMarker,
    [0, maxDecayFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const hashMismatch = Boolean(data.audio_hash_mismatch);
  const shouldPlayAudio = !silentPreview && audioFileAvailable && !hashMismatch;

  // Scrolling ruler window: [-1.5s, +3.5s] around current audioSeconds
  const rulerStartSec = audioSeconds - 1.5;
  const rulerEndSec = audioSeconds + 3.5;
  const rulerSpan = rulerEndSec - rulerStartSec;
  const visibleMarkers = (data.markers || []).filter(
    (m) => m.time_sec >= rulerStartSec && m.time_sec <= rulerEndSec,
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#090d16",
        color: "#f8fafc",
        fontFamily: "monospace",
        padding: 40,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {shouldPlayAudio && (
        <Sequence
          from={timeline.sequenceFromFrames}
          durationInFrames={timeline.audioDurationFrames}
          layout="none"
        >
          <Html5Audio
            src={staticFile("private/audio/try-me.flac")}
            trimBefore={timeline.audioTrimBeforeFrames}
          />
        </Sequence>
      )}

      {/* Top Status & Time Readout Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#111827",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: "16px 24px",
        }}
      >
        <div>
          <div style={{ fontSize: 14, color: "#94a3b8" }}>
            Try Me — Stage 0.2 声画同步诊断预览 (clip:{" "}
            {timeline.clipStartSec.toFixed(2)}s–{timeline.clipEndSec.toFixed(2)}
            s, offset: {timeline.effectiveOffsetSec.toFixed(2)}s)
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
            {hashMismatch
              ? "⚠️ 音源 SHA-256 与标注记录不匹配 (已静音保护)"
              : shouldPlayAudio
                ? "🔊 本地私有 FLAC 已同步接入"
                : "🔇 静音视觉预览模式 (无需私有音源)"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 28, textAlign: "right" }}>
          <div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>VIDEO FRAME</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#38bdf8" }}>
              F{globalFrame}{" "}
              <span style={{ fontSize: 15, color: "#64748b" }}>
                {timeline.clipStartFrame > 0
                  ? `(clip L${frame}/${durationInFrames} · ${fps}fps)`
                  : `/ ${durationInFrames} (${fps}fps)`}
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>AUDIO SECONDS</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>
              {audioSeconds.toFixed(3)}s
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>SAMPLE INDEX</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#cbd5e1" }}>
              {currentSample}
            </div>
          </div>
        </div>
      </div>

      {/* Center Beat Pulse & Active Region / Script Card */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          gap: 28,
          alignItems: "stretch",
          flex: 1,
          margin: "24px 0",
        }}
      >
        {/* Left: Beat Flash Box */}
        <div
          style={{
            backgroundColor: "#111827",
            border: `3px solid ${
              pulseStrength > 0.05
                ? isDownbeat
                  ? "#f59e0b"
                  : recentMarker?.color || "#38bdf8"
                : "#1e293b"
            }`,
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: 136,
              height: 136,
              borderRadius: "50%",
              backgroundColor: isDownbeat ? "#f59e0b" : "#38bdf8",
              opacity: 0.15 + pulseStrength * 0.85,
              scale: String(0.82 + pulseStrength * 0.36),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#090d16",
              fontWeight: 800,
              fontSize: 22,
            }}
          >
            {recentMarker ? recentMarker.id : "READY"}
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 20,
              fontWeight: 700,
              color: isDownbeat ? "#fbbf24" : "#e2e8f0",
            }}
          >
            {recentMarker
              ? `${recentMarker.label} (${recentMarker.category} · ${recentMarker.status})`
              : "等待拍点触发"}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#94a3b8" }}>
            {recentMarker
              ? `触发于 ${recentMarker.time_sec.toFixed(3)}s · F${toGlobalFrame(recentMarker.time_sec)}`
              : "可在标注台添加或微调标记"}
          </div>
        </div>

        {/* Right: Active Section & Script Design Inspector */}
        <div
          style={{
            backgroundColor: "#111827",
            border: "1px solid #334155",
            borderLeft: `6px solid ${primaryRegion?.color || "#38bdf8"}`,
            borderRadius: 16,
            padding: "24px 28px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: "#38bdf8",
                  backgroundColor: "rgba(56, 189, 248, 0.12)",
                  padding: "4px 10px",
                  borderRadius: 6,
                }}
              >
                当前区间 / 段落:{" "}
                {primaryRegion
                  ? `${primaryRegion.id} (${primaryRegion.category} · ${primaryRegion.status})`
                  : "未覆盖区间"}
              </span>
              {primaryRegion && (
                <span style={{ fontSize: 14, color: "#94a3b8" }}>
                  {primaryRegion.start_sec.toFixed(2)}s –{" "}
                  {primaryRegion.end_sec.toFixed(2)}s · 帧区间 [
                  {toGlobalFrame(primaryRegion.start_sec)},{" "}
                  {toGlobalFrame(primaryRegion.end_sec)})
                </span>
              )}
            </div>

            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 14 }}>
              {primaryRegion ? primaryRegion.label : "Try Me — 待标注段落区间"}
            </div>

            <div
              style={{
                marginTop: 14,
                fontSize: 16,
                color: "#cbd5e1",
                lineHeight: 1.5,
              }}
            >
              <strong>🎵 音乐备注：</strong>
              {primaryRegion?.note ||
                recentMarker?.note ||
                "（可在独立波形标注页填写听感与音乐特征备注）"}
            </div>

            <div
              style={{
                marginTop: 12,
                fontSize: 16,
                color: "#f8fafc",
                backgroundColor: "#1e293b",
                padding: "12px 16px",
                borderRadius: 8,
                lineHeight: 1.5,
              }}
            >
              <strong>🎬 脚本与画面构想：</strong>
              {primaryRegion?.script_idea ||
                recentMarker?.script_idea ||
                data.global_notes?.overall_concept ||
                "（在标注页填写 script_idea 后保存，此处将实时热更新显示）"}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              color: "#94a3b8",
              borderTop: "1px solid #1e293b",
              paddingTop: 12,
            }}
          >
            <span>
              已加载点标记: {data.markers?.length || 0} 个 · 区间:{" "}
              {data.regions?.length || 0} 个
            </span>
            <span>
              关联镜头:{" "}
              {(
                primaryRegion?.linked_shots?.length
                  ? primaryRegion.linked_shots
                  : recentMarker?.linked_shots || []
              ).join(", ") || "待绑定 (如 S001)"}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Scrolling Beat & Marker Ruler */}
      <div
        style={{
          backgroundColor: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 12,
          height: 92,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 14,
            top: 8,
            fontSize: 11,
            color: "#64748b",
          }}
        >
          同步滚动时间尺（窗口: -1.5s 至 +3.5s，红线为当前播放帧 F{globalFrame}）
        </div>

        {/* Playhead crosshair at 30% width (1.5s / 5.0s) */}
        <div
          style={{
            position: "absolute",
            left: "30%",
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: "#f43f5e",
            zIndex: 3,
          }}
        />

        {visibleMarkers.map((m) => {
          const leftPct = ((m.time_sec - rulerStartSec) / rulerSpan) * 100;
          const isDb = m.category === "downbeat";
          return (
            <div
              key={m.id}
              style={{
                position: "absolute",
                left: `${leftPct}%`,
                top: isDb ? 24 : 38,
                bottom: 0,
                borderLeft: `2px solid ${m.color || "#f59e0b"}`,
                paddingLeft: 6,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: isDb ? 700 : 400,
                  color: isDb ? "#fbbf24" : "#cbd5e1",
                  whiteSpace: "nowrap",
                }}
              >
                {m.id} · {m.label}
              </div>
              <div style={{ fontSize: 10, color: "#64748b" }}>
                F{toGlobalFrame(m.time_sec)}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
