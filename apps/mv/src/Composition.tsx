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
import {
  type AnnotationsPreviewPayload,
  computePreviewTimeline,
  type PreviewMarker,
  type PreviewRegion,
  type SyncPreviewProps,
} from "@try-me/shared";
import {
  ClawdMascot,
  type ClawdAction,
  type ClawdEyes,
  type ClawdMouth,
  type ClawdOutfit,
  type ClawdProp,
} from "./components/ClawdMascot";
import {
  ClawdVerse1Stage,
  type Verse1PropStageId,
} from "./components/ClawdVerse1Stage";

function rangeProgress(sec: number, start: number, end: number): number {
  return Math.max(0, Math.min(1, (sec - start) / Math.max(0.001, end - start)));
}

function getClawdStateForAudioTime(audioSec: number): {
  action: ClawdAction;
  actionProgress?: number;
  verse1Stage?: { stageId: Verse1PropStageId; progress: number };
  eyes?: ClawdEyes;
  mouth: ClawdMouth;
  outfit: ClawdOutfit;
  prop: ClawdProp;
  stageLabel: string;
} {
  // L066 前奏 (0.000 -> 18.224s): 先轻呼吸眨眼，再逐步加入左右换重心 (A1)
  if (audioSec < 6.5) {
    return {
      action: "idle",
      mouth: "none",
      outfit: "none",
      prop: "none",
      stageLabel: "L066 前奏初段 · [A1] 呼吸眨眼待机",
    };
  }
  if (audioSec < 18.525) {
    return {
      action: "weight-shift",
      actionProgress: ((audioSec - 6.5) / 2.8) % 1,
      mouth: "none",
      outfit: "none",
      prop: "none",
      stageLabel: "L066 前奏后段 · [A1] 贴地左右换重心",
    };
  }
  // L001 (18.525 -> 22.721s): 短挥手 + 重心前送 + 自信小蹲起 (A2)
  if (audioSec < 22.721) {
    return {
      action: "wave-step",
      actionProgress: rangeProgress(audioSec, 18.525, 22.721),
      mouth: "none",
      outfit: "none",
      prop: "none",
      stageLabel: "L001 · [A2] 短挥手 → 前送重心 → 小蹲起",
    };
  }
  // L002 (22.721 -> 27.161s 含句后留白): 侧身歪头 + 前足邀请等待 + 视线回正 (A3)
  if (audioSec < 27.161) {
    return {
      action: "tilt-invite",
      actionProgress: rangeProgress(audioSec, 22.721, 27.161),
      mouth: "none",
      outfit: "none",
      prop: "none",
      stageLabel: "L002 · [A3] 歪头邀请提问 + 停顿回正",
    };
  }
  // L003 (27.161 -> 31.695s): 收拢姿态 → 抬头挺身 → 两次差幅点头 (A4)
  if (audioSec < 31.695) {
    return {
      action: "posture-nod",
      actionProgress: rangeProgress(audioSec, 27.161, 31.695),
      mouth: "none",
      outfit: "none",
      prop: "none",
      stageLabel: "L003 · [A4] 收拢挺身 + 两次差幅点头",
    };
  }
  // L004 (31.695 -> 34.026s): 前足朝自己示意 → 向外展开展示 (A5)
  if (audioSec < 34.026) {
    return {
      action: "self-present",
      actionProgress: rangeProgress(audioSec, 31.695, 34.026),
      mouth: "none",
      outfit: "none",
      prop: "none",
      stageLabel: "L004 · [A5] 前足指自己 → 向外展开",
    };
  }
  // L064 间奏 (34.026 -> 36.371s): 贴地单次下压回正 + 句尾侧向预倾 (A6)
  if (audioSec < 36.371) {
    return {
      action: "crouch-lean",
      actionProgress: rangeProgress(audioSec, 34.026, 36.371),
      mouth: "none",
      outfit: "none",
      prop: "none",
      stageLabel: "L064 间奏 · [A6] 贴地下压回正 + 向旁预倾",
    };
  }
  // L005 (36.371 -> 38.429s): 侧向探身张手 + 落回原位 + 视线移向日历侧 (A7)
  if (audioSec < 38.429) {
    return {
      action: "peek-present",
      actionProgress: rangeProgress(audioSec, 36.371, 38.429),
      mouth: "none",
      outfit: "none",
      prop: "none",
      stageLabel: "L005 · [A7] 侧向探身张手 + 视线引出日历",
    };
  }
  // L006 (38.429 -> 40.800s): 365日 单页全勤日历右进右出 + 轻点头 (B1)
  if (audioSec < 40.8) {
    const p = rangeProgress(audioSec, 38.429, 40.8);
    return {
      action: "posture-nod",
      actionProgress: p,
      verse1Stage: { stageId: "L006", progress: p },
      mouth: "none",
      outfit: "none",
      prop: "none",
      stageLabel: "L006 · [B1] 365日 单页日历扫格完成",
    };
  }
  // L007 (40.800 -> 42.910s): 五行气泡逐行打字显示四语歌词 + ...（Clawd 不张嘴）(B2)
  if (audioSec < 42.91) {
    const p = rangeProgress(audioSec, 40.8, 42.91);
    return {
      action: "weight-shift",
      actionProgress: p,
      verse1Stage: { stageId: "L007", progress: p },
      mouth: "none",
      outfit: "none",
      prop: "none",
      stageLabel: "L007 · [B2] 五行气泡打字显示四语歌词 + ...",
    };
  }
  // L008 (42.910 -> 45.360s): 两侧极简听众理解回应点头 + 向两侧退场 (B3)
  if (audioSec < 45.36) {
    const p = rangeProgress(audioSec, 42.91, 45.36);
    return {
      action: "posture-nod",
      actionProgress: p,
      verse1Stage: { stageId: "L008", progress: p },
      mouth: "smile",
      outfit: "none",
      prop: "none",
      stageLabel: "L008 · [B3] 两侧极简听众理解回应点头",
    };
  }
  // L009 (45.360 -> 47.580s): 左旋入白反光眼镜 + 右下书本 + 上方云训练框 (B4)
  if (audioSec < 47.58) {
    const p = rangeProgress(audioSec, 45.36, 47.58);
    return {
      action: "read-look-up",
      actionProgress: p * 0.5,
      verse1Stage: { stageId: "L009", progress: p },
      mouth: "none",
      outfit: "none",
      prop: "book",
      stageLabel: "L009 · [B4] 左旋入反光眼镜 + 右下书本 + 云训练框",
    };
  }
  // L010 (47.580 -> 49.892s): 三项能力汇成小奖章 + 抬头挺身 + 道具按原方向清场 (B5)
  if (audioSec < 49.892) {
    const p = rangeProgress(audioSec, 47.58, 49.892);
    return {
      action: "read-look-up",
      actionProgress: 0.5 + p * 0.5,
      verse1Stage: { stageId: "L010", progress: p },
      mouth: "none",
      outfit: "none",
      prop: "book",
      stageLabel: "L010 · [B5] 三项能力合成小奖章 + 道具清场",
    };
  }
  // L011 (49.892 -> 52.576s): 铜管部小号入场接住吹奏与向右送出 (B6)
  if (audioSec < 52.576) {
    const p = rangeProgress(audioSec, 49.892, 52.576);
    return {
      action: "self-present",
      actionProgress: p,
      verse1Stage: { stageId: "L011", progress: p },
      mouth: "none",
      outfit: "none",
      prop: "trumpet",
      stageLabel: "L011 · [B6] 铜管部小号入场接住吹奏",
    };
  }
  // L065 (52.576 -> 54.750s): (ほら！) 贴地快速回弹 (^ ^) + 红黄手写艺术字弹出消散 (B7)
  if (audioSec < 54.75) {
    const popProg = rangeProgress(audioSec, 52.576, 54.75);
    return {
      action: "elastic-pop",
      actionProgress: popProg,
      verse1Stage: { stageId: "L065", progress: popProg },
      eyes: popProg >= 0.15 ? "happy" : "normal",
      mouth: "none",
      outfit: "none",
      prop: "none",
      stageLabel: "L065 (ほら！) · [B7] 贴地回弹 + 红黄手写艺术字",
    };
  }
  if (audioSec < 63.03) {
    return {
      action: "idle",
      mouth: "smile",
      outfit: "swag",
      prop: "none",
      stageLabel: "P003 Pre-Chorus · [进阶换装] Superstar 潮人装",
    };
  }
  if (audioSec < 81.15) {
    return {
      action: "bounce",
      mouth: "smile",
      outfit: "none",
      prop: "juggle",
      stageLabel: "P004 Chorus 1 · [高潮道具] 全能杂耍 Try Me!",
    };
  }
  if (audioSec < 90.25) {
    return {
      action: "bounce",
      mouth: "smile",
      outfit: "party",
      prop: "dj",
      stageLabel: "P005 Post-Chorus · [高潮大招] 派对帽 + DJ 打碟",
    };
  }
  if (audioSec >= 144.03 && audioSec < 150.8) {
    return {
      action: "walk",
      mouth: "smile",
      outfit: "none",
      prop: "none",
      stageLabel: "P008 Bridge · [极简] Step by step 四足迈步",
    };
  }
  if (audioSec >= 150.8 && audioSec < 157.0) {
    return {
      action: "idle",
      mouth: "smile",
      outfit: "none",
      prop: "coffee",
      stageLabel: "P008 Bridge · [进阶道具] 休憩タイム喝咖啡",
    };
  }
  if (audioSec >= 188.6) {
    return {
      action: "wave",
      mouth: "talk",
      outfit: "gentleman",
      prop: "none",
      stageLabel: "P011/P012 终局 · [进阶换装] Fine Society 绅士",
    };
  }
  return {
    action: "bounce",
    mouth: "smile",
    outfit: "swag",
    prop: "none",
    stageLabel: "Try Me · 音乐拍点联动模式",
  };
}

export {
  type AnnotationsPreviewPayload,
  computePreviewTimeline,
  type PreviewMarker,
  type PreviewRegion,
  type SyncPreviewProps,
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
  const clawdState = getClawdStateForAudioTime(audioSeconds);

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
        {/* Left: Beat Flash Box + Clawd Mascot */}
        <div
          style={{
            backgroundColor: "#23212c",
            border: `3px solid ${
              pulseStrength > 0.05
                ? isDownbeat
                  ? "#f59e0b"
                  : recentMarker?.color || "#d87757"
                : "#353244"
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
          {clawdState.verse1Stage ? (
            <ClawdVerse1Stage
              stageId={clawdState.verse1Stage.stageId}
              progress={clawdState.verse1Stage.progress}
              scale={1.08}
            />
          ) : (
            <ClawdMascot
              width={195}
              action={clawdState.action}
              actionProgress={clawdState.actionProgress}
              eyes={clawdState.eyes}
              mouth={clawdState.mouth}
              outfit={clawdState.outfit}
              prop={clawdState.prop}
              beatPulse={pulseStrength}
            />
          )}
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              fontWeight: 700,
              color: "#d87757",
              textAlign: "center",
            }}
          >
            {clawdState.stageLabel}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 18,
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
