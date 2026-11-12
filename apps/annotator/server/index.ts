import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import ts from "typescript";
import { audioSecToGlobalFrame } from "@try-me/shared";
import { exportLyricsToAss } from "../web/src/utils/ass-lrc.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(__dirname, "../../..");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".ts": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".flac": "audio/flac",
};

const VALID_AGENT_STATUSES = ["none", "open", "in_progress", "resolved"];

export function resolveServerPaths(custom = {}) {
  const repoRoot = custom.repoRoot || DEFAULT_REPO_ROOT;
  const annotationsDir =
    custom.annotationsDir || path.join(repoRoot, "local/annotations");
  const lyricsDir = custom.lyricsDir || path.join(annotationsDir, "lyrics");
  return {
    repoRoot,
    audioFile:
      custom.audioFile ||
      path.join(repoRoot, "public/private/audio/try-me.flac"),
    analysisDir: custom.analysisDir || path.join(repoRoot, "local/analysis"),
    annotationsDir,
    annotationsFile:
      custom.annotationsFile || path.join(annotationsDir, "annotations.json"),
    annotationsBackupFile:
      custom.annotationsBackupFile ||
      path.join(annotationsDir, "annotations.prev.json"),
    agentBriefFile:
      custom.agentBriefFile || path.join(annotationsDir, "agent-brief.md"),
    lyricsDir,
    lyricsJsonFile:
      custom.lyricsJsonFile || path.join(lyricsDir, "try-me-aligned.json"),
    lyricsLrcFile: custom.lyricsLrcFile || path.join(lyricsDir, "try-me.lrc"),
    lyricsAssFile: custom.lyricsAssFile || path.join(lyricsDir, "try-me.ass"),
    previewJsonFile:
      custom.previewJsonFile ||
      path.join(repoRoot, "public/private/annotations-preview.json"),
    annotatorStaticDir:
      custom.annotatorStaticDir || path.join(repoRoot, "apps/annotator/web"),
    sharedSrcDir:
      custom.sharedSrcDir || path.join(repoRoot, "packages/shared/src"),
    wavesurferDistDir:
      custom.wavesurferDistDir ||
      path.join(repoRoot, "node_modules/wavesurfer.js/dist"),
  };
}

function createValidationError(message) {
  const err = new Error(message);
  err.code = "VALIDATION_ERROR";
  return err;
}

function formatTimeSec(sec) {
  const safe = Math.max(0, Number(sec) || 0);
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  return `${String(mins).padStart(2, "0")}:${rem.toFixed(3).padStart(6, "0")}`;
}

async function atomicWriteFile(filePath, content) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fsp.writeFile(tmpPath, content, "utf8");
  await fsp.rename(tmpPath, filePath);
}

async function readJsonStrictIfExists(filePath) {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    try {
      return JSON.parse(raw);
    } catch (parseErr) {
      const err = new Error(
        `Corrupted JSON in ${path.basename(filePath)}: ${parseErr.message}`,
      );
      err.code = "CORRUPTED_JSON";
      throw err;
    }
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Single-read helper that parses JSON and computes its SHA-256 revision from the
 * exact same byte buffer, eliminating read-then-hash race conditions.
 */
export async function readAnnotationsWithRevision(
  annotationsFile,
  readFileFn = (p) => fsp.readFile(p, "utf8"),
) {
  try {
    const raw = await readFileFn(annotationsFile);
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      const err = new Error(
        `Corrupted JSON in ${path.basename(annotationsFile)}: ${parseErr.message}`,
      );
      err.code = "CORRUPTED_JSON";
      throw err;
    }
    const revision = crypto
      .createHash("sha256")
      .update(raw)
      .digest("hex")
      .slice(0, 16);
    return { existing: parsed, revision };
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return { existing: null, revision: "initial" };
    }
    throw err;
  }
}

export async function loadAnalysisBundle(analysisDir) {
  const [summary, waveform, beats, onsets, energy] = await Promise.all([
    readJsonStrictIfExists(path.join(analysisDir, "summary.json")),
    readJsonStrictIfExists(path.join(analysisDir, "waveform.json")),
    readJsonStrictIfExists(path.join(analysisDir, "beats.json")),
    readJsonStrictIfExists(path.join(analysisDir, "onsets.json")),
    readJsonStrictIfExists(path.join(analysisDir, "energy.json")),
  ]);

  if (summary?.analysis_run_id) {
    for (const [name, part] of [
      ["waveform.json", waveform],
      ["beats.json", beats],
      ["onsets.json", onsets],
      ["energy.json", energy],
    ]) {
      if (
        part?.analysis_run_id &&
        part.analysis_run_id !== summary.analysis_run_id
      ) {
        throw createValidationError(
          `Analysis run mismatch in ${name} (${part.analysis_run_id} !== ${summary.analysis_run_id})`,
        );
      }
    }
  }

  return {
    available: Boolean(summary),
    summary,
    waveform,
    beats: beats?.candidates ?? [],
    onsets: onsets?.candidates ?? [],
    energyShifts: energy?.shift_candidates ?? [],
    energyFrames: energy?.frames ?? [],
  };
}

function extractNumericSuffix(id, prefix) {
  const match = new RegExp(`^${prefix}(\\d+)$`).exec(String(id || ""));
  return match ? Number.parseInt(match[1], 10) : 0;
}

export function createDefaultAnnotations(summary) {
  const inputAudio = summary?.input_audio ?? {
    asset_id: "A001",
    path: "public/private/audio/try-me.flac",
    sha256: null,
    duration_sec: 209.719615,
    samplerate: 44100,
    total_samples: 9248635,
  };

  return {
    schema_version: "0.1.0",
    updated_at_utc: new Date().toISOString(),
    id_counters: {
      marker_seq: 0,
      region_seq: 0,
    },
    audio_asset: {
      asset_id: inputAudio.asset_id ?? "A001",
      path: inputAudio.path ?? "public/private/audio/try-me.flac",
      sha256: inputAudio.sha256 ?? null,
      duration_sec: Number(inputAudio.duration_sec ?? 209.719615),
      samplerate: Number(inputAudio.samplerate ?? 44100),
      total_samples: Number(inputAudio.total_samples ?? 9248635),
      analysis_run_id: summary?.analysis_run_id ?? null,
      analysis_generated_at_utc: summary?.generated_at_utc ?? null,
    },
    preview_mapping: {
      preview_fps: 30,
      audio_offset_seconds: 0.0,
    },
    global_notes: {
      overall_concept: "",
      visual_style_notes: "",
      instructions_for_agent: "",
    },
    markers: [],
    regions: [],
  };
}

export function normalizeAnnotations(
  payload,
  summary,
  {
    existingAudioAsset = null,
    allowAudioMigration = false,
    preserveExistingOnMismatch = false,
  } = {},
) {
  const base = createDefaultAnnotations(summary);
  if (!payload) {
    return base;
  }

  if (
    payload.schema_version !== undefined &&
    payload.schema_version !== "0.1.0"
  ) {
    throw createValidationError(
      `Unsupported schema_version: ${String(payload.schema_version)}`,
    );
  }

  const incomingSha = payload.audio_asset?.sha256 ?? null;
  const currentAnalysisSha = base.audio_asset.sha256 ?? null;
  const referenceSha = existingAudioAsset?.sha256 ?? currentAnalysisSha;

  if (!preserveExistingOnMismatch && !allowAudioMigration) {
    if (incomingSha && referenceSha && incomingSha !== referenceSha) {
      const err = new Error(
        `Audio SHA-256 mismatch: annotation belongs to ${incomingSha}, but reference is ${referenceSha}. Pass allow_audio_migration=true to migrate.`,
      );
      err.code = "AUDIO_HASH_MISMATCH";
      throw err;
    }
    if (
      existingAudioAsset?.sha256 &&
      currentAnalysisSha &&
      existingAudioAsset.sha256 !== currentAnalysisSha
    ) {
      const err = new Error(
        `Existing annotations audio SHA-256 (${existingAudioAsset.sha256}) does not match current analysis audio (${currentAnalysisSha}).`,
      );
      err.code = "AUDIO_HASH_MISMATCH";
      throw err;
    }
  }

  const resolvedAudioAsset = allowAudioMigration
    ? {
        ...base.audio_asset,
        ...(payload.audio_asset || {}),
        sha256: currentAnalysisSha || incomingSha,
        analysis_run_id:
          base.audio_asset.analysis_run_id ||
          payload.audio_asset?.analysis_run_id ||
          null,
      }
    : {
        ...base.audio_asset,
        ...(existingAudioAsset || {}),
        ...(payload.audio_asset || {}),
        sha256:
          incomingSha || existingAudioAsset?.sha256 || currentAnalysisSha,
      };

  const maxDuration = Number(resolvedAudioAsset.duration_sec);
  if (!Number.isFinite(maxDuration) || maxDuration <= 0) {
    throw createValidationError("Invalid audio_asset.duration_sec");
  }

  const rawFps =
    payload.preview_mapping?.preview_fps !== undefined
      ? Number(payload.preview_mapping.preview_fps)
      : 30;
  if (!Number.isFinite(rawFps) || rawFps < 1 || rawFps > 240) {
    throw createValidationError(
      `preview_fps must be a finite number between 1 and 240 (got ${String(payload.preview_mapping?.preview_fps)})`,
    );
  }
  const fps = Math.round(rawFps);

  const offsetSec =
    payload.preview_mapping?.audio_offset_seconds !== undefined
      ? Number(payload.preview_mapping.audio_offset_seconds)
      : 0;
  if (!Number.isFinite(offsetSec) || Math.abs(offsetSec) > 3600) {
    throw createValidationError("Invalid audio_offset_seconds");
  }

  if (payload.markers !== undefined && !Array.isArray(payload.markers)) {
    throw createValidationError("markers must be an array");
  }
  if (payload.regions !== undefined && !Array.isArray(payload.regions)) {
    throw createValidationError("regions must be an array");
  }

  let maxMarkerSeq = Number(payload.id_counters?.marker_seq ?? 0);
  if (!Number.isFinite(maxMarkerSeq) || maxMarkerSeq < 0) maxMarkerSeq = 0;

  const seenMarkerIds = new Set();
  const markers = (payload.markers || [])
    .map((m) => {
      const id = String(m?.id ?? "").trim();
      if (!id) {
        throw createValidationError("Marker id cannot be empty");
      }
      if (seenMarkerIds.has(id)) {
        throw createValidationError(`Duplicate marker id: ${id}`);
      }
      seenMarkerIds.add(id);
      maxMarkerSeq = Math.max(maxMarkerSeq, extractNumericSuffix(id, "M"));

      const rawTime = Number(m.time_sec);
      if (!Number.isFinite(rawTime) || rawTime < 0 || rawTime > maxDuration) {
        throw createValidationError(
          `Marker ${id} time_sec (${String(m.time_sec)}) out of bounds [0, ${maxDuration}]`,
        );
      }

      if (
        m.status !== undefined &&
        m.status !== "confirmed" &&
        m.status !== "candidate"
      ) {
        throw createValidationError(
          `Invalid status on marker ${id}: ${String(m.status)}`,
        );
      }

      const agentStatus =
        m.agent_status !== undefined
          ? String(m.agent_status)
          : m.agent_comment
            ? "open"
            : "none";
      if (!VALID_AGENT_STATUSES.includes(agentStatus)) {
        throw createValidationError(
          `Invalid agent_status on marker ${id}: ${agentStatus}`,
        );
      }

      const hasCandidate = Boolean(m.origin_candidate_id);
      return {
        id,
        kind: "point",
        category: String(m.category || "beat"),
        label: String(m.label || id),
        color: String(m.color || "#f59e0b"),
        time_sec: Number(rawTime.toFixed(6)),
        source: m.source === "auto" ? "auto" : "human",
        origin_candidate_id: hasCandidate ? String(m.origin_candidate_id) : null,
        origin_analysis_run_id: hasCandidate
          ? m.origin_analysis_run_id
            ? String(m.origin_analysis_run_id)
            : (resolvedAudioAsset.analysis_run_id ?? null)
          : null,
        origin_analysis_sha256: hasCandidate
          ? (m.origin_analysis_sha256 ?? resolvedAudioAsset.sha256 ?? null)
          : null,
        origin_candidate_time_sec:
          hasCandidate &&
          m.origin_candidate_time_sec !== undefined &&
          m.origin_candidate_time_sec !== null
            ? Number(Number(m.origin_candidate_time_sec).toFixed(6))
            : null,
        origin_candidate_sample_index:
          hasCandidate &&
          m.origin_candidate_sample_index !== undefined &&
          m.origin_candidate_sample_index !== null
            ? Math.round(Number(m.origin_candidate_sample_index))
            : null,
        status: m.status === "confirmed" ? "confirmed" : "candidate",
        linked_shots: Array.isArray(m.linked_shots)
          ? m.linked_shots.map(String).filter(Boolean)
          : [],
        note: String(m.note ?? ""),
        script_idea: String(m.script_idea ?? ""),
        agent_comment: String(m.agent_comment ?? ""),
        agent_status: agentStatus,
        agent_reply: String(m.agent_reply ?? ""),
        lyric_hint: String(m.lyric_hint ?? ""),
      };
    })
    .sort((a, b) => a.time_sec - b.time_sec);

  let maxRegionSeq = Number(payload.id_counters?.region_seq ?? 0);
  if (!Number.isFinite(maxRegionSeq) || maxRegionSeq < 0) maxRegionSeq = 0;

  const seenRegionIds = new Set();
  const regions = (payload.regions || [])
    .map((r) => {
      const id = String(r?.id ?? "").trim();
      if (!id) {
        throw createValidationError("Region id cannot be empty");
      }
      if (seenRegionIds.has(id)) {
        throw createValidationError(`Duplicate region id: ${id}`);
      }
      seenRegionIds.add(id);
      maxRegionSeq = Math.max(maxRegionSeq, extractNumericSuffix(id, "P"));

      const rawStart = Number(r.start_sec);
      const rawEnd = Number(r.end_sec);
      if (
        !Number.isFinite(rawStart) ||
        !Number.isFinite(rawEnd) ||
        rawStart < 0 ||
        rawEnd > maxDuration ||
        rawEnd <= rawStart
      ) {
        throw createValidationError(
          `Region ${id} interval [${String(r.start_sec)}, ${String(r.end_sec)}] is invalid or out of bounds [0, ${maxDuration}]`,
        );
      }

      if (
        r.status !== undefined &&
        r.status !== "confirmed" &&
        r.status !== "candidate"
      ) {
        throw createValidationError(
          `Invalid status on region ${id}: ${String(r.status)}`,
        );
      }

      const agentStatus =
        r.agent_status !== undefined
          ? String(r.agent_status)
          : r.agent_comment
            ? "open"
            : "none";
      if (!VALID_AGENT_STATUSES.includes(agentStatus)) {
        throw createValidationError(
          `Invalid agent_status on region ${id}: ${agentStatus}`,
        );
      }

      return {
        id,
        kind: "region",
        category: String(r.category || "section"),
        label: String(r.label || id),
        color: String(r.color || "#38bdf8"),
        start_sec: Number(rawStart.toFixed(6)),
        end_sec: Number(rawEnd.toFixed(6)),
        source: r.source === "auto" ? "auto" : "human",
        status: r.status === "confirmed" ? "confirmed" : "candidate",
        linked_shots: Array.isArray(r.linked_shots)
          ? r.linked_shots.map(String).filter(Boolean)
          : [],
        note: String(r.note ?? ""),
        script_idea: String(r.script_idea ?? ""),
        agent_comment: String(r.agent_comment ?? ""),
        agent_status: agentStatus,
        agent_reply: String(r.agent_reply ?? ""),
        lyric_hint: String(r.lyric_hint ?? ""),
      };
    })
    .sort((a, b) => a.start_sec - b.start_sec);

  return {
    schema_version: "0.1.0",
    updated_at_utc: payload.updated_at_utc || new Date().toISOString(),
    id_counters: {
      marker_seq: maxMarkerSeq,
      region_seq: maxRegionSeq,
    },
    audio_asset: resolvedAudioAsset,
    preview_mapping: {
      preview_fps: fps,
      audio_offset_seconds: offsetSec,
    },
    global_notes: {
      overall_concept: String(payload.global_notes?.overall_concept ?? ""),
      visual_style_notes: String(
        payload.global_notes?.visual_style_notes ?? "",
      ),
      instructions_for_agent: String(
        payload.global_notes?.instructions_for_agent ?? "",
      ),
    },
    markers,
    regions,
  };
}

export function buildAgentBriefMarkdown(annotations) {
  const fps = annotations.preview_mapping?.preview_fps ?? 30;
  const offset = annotations.preview_mapping?.audio_offset_seconds ?? 0;
  const toFrame = (sec) => audioSecToGlobalFrame(sec, offset, fps);

  const lines = [
    "# Try Me — 标注、脚本设计与 Agent 协作简报",
    "",
    `> 本文件由 \`apps/annotator/server/index.ts\` 根据 \`local/annotations/annotations.json\` 自动生成，仅保存在本地忽略目录 \`local/annotations/\`。\`lyric_hint\` 私人歌词字段已排除；其余自由文本在转入公开文档前仍需人工复核。`,
    "",
    `- 更新时间 (UTC)：\`${annotations.updated_at_utc}\``,
    `- 音源：\`${annotations.audio_asset.path}\` (SHA-256: \`${annotations.audio_asset.sha256 ?? "unknown"}\`, 采样率: \`${annotations.audio_asset.samplerate}Hz\`, 总采样帧: \`${annotations.audio_asset.total_samples}\`, 时长: \`${annotations.audio_asset.duration_sec}s\`)`,
    `- 关联自动分析轮次：\`${annotations.audio_asset.analysis_run_id ?? "unknown"}\``,
    `- 预览帧映射：\`FPS = ${fps}\` (仅预览，非最终成片规格), \`audioOffsetSeconds = ${offset}s\`, 全片帧公式 \`videoFrame = Math.round((audioSeconds + audioOffsetSeconds) * fps)\``,
    "",
    "## 1. 全局创作设定与给 Agent 的总体指令",
    "",
    `- **核心概念 (Overall Concept)**：${annotations.global_notes?.overall_concept || "（暂未填写）"}`,
    `- **视觉风格与运动规则 (Visual Style)**：${annotations.global_notes?.visual_style_notes || "（暂未填写）"}`,
    `- **给 Agent 的总体要求 (Instructions for Agent)**：${annotations.global_notes?.instructions_for_agent || "（暂未填写）"}`,
    "",
  ];

  const openItems = [
    ...annotations.regions
      .filter((r) => r.agent_comment || r.agent_status === "open")
      .map((r) => ({
        id: r.id,
        type: `区间 (${r.category})`,
        time: `${formatTimeSec(r.start_sec)} - ${formatTimeSec(r.end_sec)} (${r.start_sec.toFixed(3)}s–${r.end_sec.toFixed(3)}s)`,
        frames: `[F${toFrame(r.start_sec)}, F${toFrame(r.end_sec)})`,
        status: r.agent_status,
        comment: r.agent_comment,
        script: r.script_idea,
        reply: r.agent_reply,
      })),
    ...annotations.markers
      .filter((m) => m.agent_comment || m.agent_status === "open")
      .map((m) => ({
        id: m.id,
        type: `时间点 (${m.category})`,
        time: `${formatTimeSec(m.time_sec)} (${m.time_sec.toFixed(3)}s)`,
        frames: `F${toFrame(m.time_sec)}`,
        status: m.agent_status,
        comment: m.agent_comment,
        script: m.script_idea,
        reply: m.agent_reply,
      })),
  ];

  lines.push("## 2. 待 Agent 处理的评论与任务队列 (Agent Action Queue)", "");
  if (openItems.length === 0) {
    lines.push("当前没有待处理的专项评论或指令。", "");
  } else {
    lines.push(
      "| ID | 类型 | 时间范围 / 位置 | 全片预览帧 | 状态 | 用户评论 / 给 Agent 的指令 | 脚本设计构想 | Agent 回复 |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const item of openItems) {
      lines.push(
        `| \`${item.id}\` | ${item.type} | \`${item.time}\` | \`${item.frames}\` | \`${item.status}\` | ${item.comment.replace(/\n/g, " ") || "-"} | ${item.script.replace(/\n/g, " ") || "-"} | ${item.reply.replace(/\n/g, " ") || "-"} |`,
      );
    }
    lines.push("");
  }

  lines.push("## 3. 区间标注与段落脚本设计 (Regions & Sections)", "");
  if (annotations.regions.length === 0) {
    lines.push("尚未添加区间或段落标记。", "");
  } else {
    lines.push(
      "| ID | 标题 | 分类 | 状态 | 起止时间 (秒) | 全片预览帧 `[start, end)` | 关联镜头 | 音乐特征备注 | 画面脚本与设计构想 |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const r of annotations.regions) {
      lines.push(
        `| \`${r.id}\` | ${r.label} | \`${r.category}\` | \`${r.status}\` | \`${r.start_sec.toFixed(3)}s - ${r.end_sec.toFixed(3)}s\` (${formatTimeSec(r.start_sec)}–${formatTimeSec(r.end_sec)}) | \`[F${toFrame(r.start_sec)}, F${toFrame(r.end_sec)})\` | ${r.linked_shots.join(", ") || "-"} | ${r.note.replace(/\n/g, " ") || "-"} | ${r.script_idea.replace(/\n/g, " ") || "-"} |`,
      );
    }
    lines.push("");
  }

  lines.push("## 4. 时间点标记 (Point Markers: 小节第一拍 / 重音 / 切镜点)", "");
  if (annotations.markers.length === 0) {
    lines.push("尚未添加时间点标记。", "");
  } else {
    lines.push(
      "| ID | 标题 | 分类 | 状态 | 时间 (秒) | 全片预览帧 | 来源候选 | 关联镜头 | 音乐备注 | 视觉动作 / 切镜设计 |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const m of annotations.markers) {
      const originDesc = m.origin_candidate_id
        ? `${m.origin_candidate_id}${m.origin_candidate_time_sec !== null ? `@${m.origin_candidate_time_sec}s` : ""}`
        : "manual";
      lines.push(
        `| \`${m.id}\` | ${m.label} | \`${m.category}\` | \`${m.status}\` | \`${m.time_sec.toFixed(3)}s\` (${formatTimeSec(m.time_sec)}) | \`F${toFrame(m.time_sec)}\` | ${originDesc} | ${m.linked_shots.join(", ") || "-"} | ${m.note.replace(/\n/g, " ") || "-"} | ${m.script_idea.replace(/\n/g, " ") || "-"} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function buildSanitizedPreviewPayload(
  annotations,
  { audioHashMismatch = false } = {},
) {
  return {
    schema_version: String(annotations.schema_version),
    updated_at_utc: String(annotations.updated_at_utc),
    audio_hash_mismatch: Boolean(audioHashMismatch),
    audio_asset: {
      asset_id: String(annotations.audio_asset.asset_id),
      path: String(annotations.audio_asset.path),
      sha256: annotations.audio_asset.sha256 ?? null,
      duration_sec: Number(annotations.audio_asset.duration_sec),
      samplerate: Number(annotations.audio_asset.samplerate ?? 44100),
      total_samples: Number(annotations.audio_asset.total_samples ?? 0),
      analysis_run_id: annotations.audio_asset.analysis_run_id ?? null,
    },
    preview_mapping: {
      preview_fps: Number(annotations.preview_mapping.preview_fps),
      audio_offset_seconds: Number(
        annotations.preview_mapping.audio_offset_seconds,
      ),
    },
    global_notes: {
      overall_concept: String(annotations.global_notes?.overall_concept ?? ""),
      visual_style_notes: String(
        annotations.global_notes?.visual_style_notes ?? "",
      ),
      instructions_for_agent: String(
        annotations.global_notes?.instructions_for_agent ?? "",
      ),
    },
    markers: annotations.markers.map((m) => ({
      id: m.id,
      kind: "point",
      category: m.category,
      label: m.label,
      color: m.color,
      time_sec: m.time_sec,
      status: m.status,
      origin_candidate_id: m.origin_candidate_id ?? null,
      origin_analysis_run_id: m.origin_analysis_run_id ?? null,
      origin_candidate_time_sec: m.origin_candidate_time_sec ?? null,
      origin_candidate_sample_index: m.origin_candidate_sample_index ?? null,
      linked_shots: [...m.linked_shots],
      note: m.note,
      script_idea: m.script_idea,
      agent_comment: m.agent_comment,
      agent_status: m.agent_status,
      agent_reply: m.agent_reply,
    })),
    regions: annotations.regions.map((r) => ({
      id: r.id,
      kind: "region",
      category: r.category,
      label: r.label,
      color: r.color,
      start_sec: r.start_sec,
      end_sec: r.end_sec,
      status: r.status,
      linked_shots: [...r.linked_shots],
      note: r.note,
      script_idea: r.script_idea,
      agent_comment: r.agent_comment,
      agent_status: r.agent_status,
      agent_reply: r.agent_reply,
    })),
  };
}

let writeMutex = Promise.resolve();
function runWithWriteLock(fn) {
  const next = writeMutex.then(fn, fn);
  writeMutex = next.catch(() => {});
  return next;
}

function formatLrcTimestamp(sec) {
  const safe = Math.max(0, Number(sec) || 0);
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  return `[${String(mins).padStart(2, "0")}:${rem.toFixed(2).padStart(5, "0")}]`;
}

export async function loadLyricsBundle(lyricsJsonFile) {
  const parsed = await readJsonStrictIfExists(lyricsJsonFile);
  if (!parsed || !Array.isArray(parsed.lines)) {
    return { available: false, lines: [] };
  }
  return {
    available: true,
    updated_at_utc: parsed.updated_at_utc ?? null,
    status: parsed.status ?? "candidate",
    lines: parsed.lines,
  };
}

export async function saveLyricsToDisk(rawLines, customPaths = {}) {
  const paths = resolveServerPaths(customPaths);
  return runWithWriteLock(async () => {
    if (!Array.isArray(rawLines)) {
      throw createValidationError("lines must be an array");
    }
    const existing = (await readJsonStrictIfExists(paths.lyricsJsonFile)) || {
      schema_version: "0.1.0",
      status: "candidate",
      confirmed: false,
      provenance: {},
      sections: [],
      lines: [],
    };

    const seenIds = new Set();
    const normalizedLines = rawLines
      .map((item, idx) => {
        const id = String(item?.id || `L${String(idx + 1).padStart(3, "0")}`).trim();
        if (seenIds.has(id)) {
          throw createValidationError(`Duplicate lyric line id: ${id}`);
        }
        seenIds.add(id);
        const startSec = Number(item?.start_sec);
        const endSec = Number(item?.end_sec);
        if (
          !Number.isFinite(startSec) ||
          !Number.isFinite(endSec) ||
          startSec < 0 ||
          endSec <= startSec
        ) {
          throw createValidationError(
            `Invalid time range for lyric line ${id}: [${String(item?.start_sec)}, ${String(item?.end_sec)}]`,
          );
        }
        return {
          id,
          index: idx + 1,
          section_id: String(item?.section_id || "P001"),
          bar: Number(item?.bar || 1),
          start_sec: Number(startSec.toFixed(3)),
          end_sec: Number(endSec.toFixed(3)),
          lrc_start_sec:
            item?.lrc_start_sec !== undefined
              ? Number(Number(item.lrc_start_sec).toFixed(3))
              : Number(startSec.toFixed(3)),
          vocal_onset_sec:
            item?.vocal_onset_sec !== undefined && item?.vocal_onset_sec !== null
              ? Number(Number(item.vocal_onset_sec).toFixed(3))
              : null,
          origin_candidate_id: item?.origin_candidate_id
            ? String(item.origin_candidate_id)
            : null,
          text: String(item?.text ?? ""),
          lang: String(item?.lang || "en"),
          status: item?.status === "confirmed" ? "confirmed" : "candidate",
          note: String(item?.note ?? ""),
        };
      })
      .sort((a, b) => a.start_sec - b.start_sec);

    const allConfirmed =
      normalizedLines.length > 0 &&
      normalizedLines.every((l) => l.status === "confirmed");
    const updatedPayload = {
      ...existing,
      updated_at_utc: new Date().toISOString(),
      status: allConfirmed ? "confirmed" : "candidate",
      confirmed: allConfirmed,
      lines: normalizedLines,
    };

    const lrcLines = [
      "[ti:Try Me]",
      "[ar:Kero Kero Bonito]",
      "[al:Bonito Generation]",
      "[length:03:29.72]",
      "[by:Try Me Workbench Local Alignment]",
      "",
      ...normalizedLines.map(
        (l) => `${formatLrcTimestamp(l.start_sec)} ${l.text}`,
      ),
    ];
    if (normalizedLines.length > 0) {
      lrcLines.push(
        `${formatLrcTimestamp(normalizedLines[normalizedLines.length - 1].end_sec)} `,
      );
    }

    await Promise.all([
      atomicWriteFile(
        paths.lyricsJsonFile,
        JSON.stringify(updatedPayload, null, 2) + "\n",
      ),
      atomicWriteFile(paths.lyricsLrcFile, lrcLines.join("\n") + "\n"),
      atomicWriteFile(paths.lyricsAssFile, exportLyricsToAss(normalizedLines)),
    ]);

    return {
      available: true,
      updated_at_utc: updatedPayload.updated_at_utc,
      status: updatedPayload.status,
      lines: normalizedLines,
    };
  });
}

export async function loadCurrentState(customPaths = {}) {
  const paths = resolveServerPaths(customPaths);
  return runWithWriteLock(async () => {
    const [analysis, lyrics, { existing, revision }] = await Promise.all([
      loadAnalysisBundle(paths.analysisDir),
      loadLyricsBundle(paths.lyricsJsonFile),
      readAnnotationsWithRevision(paths.annotationsFile),
    ]);

    const existingSha = existing?.audio_asset?.sha256 ?? null;
    const currentAnalysisSha = analysis.summary?.input_audio?.sha256 ?? null;
    const audioHashMismatch = Boolean(
      existingSha && currentAnalysisSha && existingSha !== currentAnalysisSha,
    );

    const annotations = normalizeAnnotations(existing, analysis.summary, {
      existingAudioAsset: existing?.audio_asset ?? null,
      allowAudioMigration: false,
      preserveExistingOnMismatch: true,
    });
    const agentBriefMarkdown = buildAgentBriefMarkdown(annotations);

    // Only write preview file when audio hashes match; on mismatch mark preview as muted/mismatched
    await atomicWriteFile(
      paths.previewJsonFile,
      JSON.stringify(
        buildSanitizedPreviewPayload(annotations, { audioHashMismatch }),
        null,
        2,
      ) + "\n",
    );

    return {
      revision,
      audioHashMismatch,
      audioAvailable: fs.existsSync(paths.audioFile),
      analysis,
      annotations,
      lyrics,
      agentBriefMarkdown,
    };
  });
}

export async function saveAnnotationsToDisk(
  rawPayload,
  {
    baseRevision = null,
    force = false,
    allowAudioMigration = false,
    customPaths = {},
  } = {},
) {
  const paths = resolveServerPaths(customPaths);
  return runWithWriteLock(async () => {
    const { existing, revision: currentDiskRevision } =
      await readAnnotationsWithRevision(paths.annotationsFile);

    if (!force && currentDiskRevision !== "initial") {
      if (!baseRevision || baseRevision !== currentDiskRevision) {
        const analysis = await loadAnalysisBundle(paths.analysisDir);
        const existingNorm = normalizeAnnotations(existing, analysis.summary, {
          existingAudioAsset: existing?.audio_asset ?? null,
          preserveExistingOnMismatch: true,
        });
        const conflictError = new Error(
          "Annotations file on disk was modified externally (e.g. by Agent). Reload or force overwrite.",
        );
        conflictError.code = "REVISION_CONFLICT";
        conflictError.latestState = {
          revision: currentDiskRevision,
          audioHashMismatch: false,
          audioAvailable: fs.existsSync(paths.audioFile),
          analysis,
          annotations: existingNorm,
          agentBriefMarkdown: buildAgentBriefMarkdown(existingNorm),
        };
        throw conflictError;
      }
    }

    const analysis = await loadAnalysisBundle(paths.analysisDir);

    const existingCounters = existing?.id_counters || {
      marker_seq: 0,
      region_seq: 0,
    };
    const mergedPayload = {
      ...rawPayload,
      id_counters: {
        marker_seq: Math.max(
          Number(existingCounters.marker_seq || 0),
          Number(rawPayload?.id_counters?.marker_seq || 0),
        ),
        region_seq: Math.max(
          Number(existingCounters.region_seq || 0),
          Number(rawPayload?.id_counters?.region_seq || 0),
        ),
      },
      updated_at_utc: new Date().toISOString(),
    };

    const normalized = normalizeAnnotations(mergedPayload, analysis.summary, {
      existingAudioAsset: existing?.audio_asset ?? null,
      allowAudioMigration,
    });

    if (fs.existsSync(paths.annotationsFile)) {
      await fsp.copyFile(paths.annotationsFile, paths.annotationsBackupFile);
    }

    const markdown = buildAgentBriefMarkdown(normalized);
    const previewPayload = buildSanitizedPreviewPayload(normalized, {
      audioHashMismatch: false,
    });
    const serializedJson = JSON.stringify(normalized, null, 2) + "\n";

    await atomicWriteFile(paths.annotationsFile, serializedJson);
    await Promise.all([
      atomicWriteFile(paths.agentBriefFile, markdown + "\n"),
      atomicWriteFile(
        paths.previewJsonFile,
        JSON.stringify(previewPayload, null, 2) + "\n",
      ),
    ]);

    const newRevision = crypto
      .createHash("sha256")
      .update(serializedJson)
      .digest("hex")
      .slice(0, 16);
    return {
      revision: newRevision,
      annotations: normalized,
      agentBriefMarkdown: markdown,
    };
  });
}

function isLocalhostRequest(req) {
  const host = req.headers.host || "";
  if (host && !/^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host)) {
    return false;
  }
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)) {
    return false;
  }
  return true;
}

function serveAudioStream(audioFile, req, res) {
  if (!fs.existsSync(audioFile)) {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Local private FLAC file not found." }));
    return;
  }

  const stat = fs.statSync(audioFile);
  const total = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = Number.parseInt(parts[0], 10);
    const end = parts[1] ? Number.parseInt(parts[1], 10) : total - 1;
    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start > end ||
      start < 0 ||
      end >= total
    ) {
      res.writeHead(416, { "Content-Range": `bytes */${total}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Type": "audio/flac",
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(audioFile, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": total,
      "Accept-Ranges": "bytes",
      "Content-Type": "audio/flac",
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(audioFile).pipe(res);
  }
}

async function serveStaticFile(baseDir, relPath, res) {
  const resolvedBase = path.resolve(baseDir);
  const safeRel = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const targetPath = path.resolve(resolvedBase, safeRel);
  if (
    targetPath !== resolvedBase &&
    !targetPath.startsWith(resolvedBase + path.sep)
  ) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const stat = await fsp.stat(targetPath);
    if (!stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    if (ext === ".ts") {
      const rawTs = await fsp.readFile(targetPath, "utf8");
      const { outputText } = ts.transpileModule(rawTs, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: path.basename(targetPath),
      });
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      });
      res.end(outputText, "utf8");
      return;
    }
    const content = await fsp.readFile(targetPath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

export function createAnnotationServer(customPaths = {}) {
  const paths = resolveServerPaths(customPaths);

  return http.createServer(async (req, res) => {
    try {
      if (!isLocalhostRequest(req)) {
        res.writeHead(403, {
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(JSON.stringify({ error: "Localhost access only." }));
        return;
      }

      const url = new URL(req.url || "/", "http://127.0.0.1");
      const pathname = url.pathname;

      if (req.method === "GET" && pathname === "/api/state") {
        const state = await loadCurrentState(paths);
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(state));
        return;
      }

      if (req.method === "POST" && pathname === "/api/annotations") {
        const contentType = String(req.headers["content-type"] || "");
        if (!contentType.toLowerCase().includes("application/json")) {
          res.writeHead(415, {
            "Content-Type": "application/json; charset=utf-8",
          });
          res.end(
            JSON.stringify({
              ok: false,
              error: "Content-Type must be application/json",
            }),
          );
          return;
        }

        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const body = JSON.parse(bodyText);
        const payload = body.annotations ?? body;
        const baseRevision = body.base_revision ?? null;
        const force = Boolean(body.force);
        const allowAudioMigration = Boolean(body.allow_audio_migration);

        try {
          const saved = await saveAnnotationsToDisk(payload, {
            baseRevision,
            force,
            allowAudioMigration,
            customPaths: paths,
          });
          res.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
          });
          res.end(JSON.stringify({ ok: true, ...saved }));
        } catch (err) {
          if (err && err.code === "REVISION_CONFLICT") {
            res.writeHead(409, {
              "Content-Type": "application/json; charset=utf-8",
            });
            res.end(
              JSON.stringify({
                ok: false,
                error: "revision_conflict",
                message: err.message,
                latest: err.latestState,
              }),
            );
            return;
          }
          if (err && err.code === "AUDIO_HASH_MISMATCH") {
            res.writeHead(409, {
              "Content-Type": "application/json; charset=utf-8",
            });
            res.end(
              JSON.stringify({
                ok: false,
                error: "audio_hash_mismatch",
                message: err.message,
              }),
            );
            return;
          }
          throw err;
        }
        return;
      }

      if (req.method === "POST" && pathname === "/api/lyrics") {
        const contentType = String(req.headers["content-type"] || "");
        if (!contentType.toLowerCase().includes("application/json")) {
          res.writeHead(415, {
            "Content-Type": "application/json; charset=utf-8",
          });
          res.end(
            JSON.stringify({
              ok: false,
              error: "Content-Type must be application/json",
            }),
          );
          return;
        }
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const lines = body.lines ?? body;
        const savedLyrics = await saveLyricsToDisk(lines, paths);
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify({ ok: true, lyrics: savedLyrics }));
        return;
      }

      if (req.method === "GET" && pathname === "/api/audio") {
        serveAudioStream(paths.audioFile, req, res);
        return;
      }

      if (req.method === "GET" && pathname === "/bundle.js") {
        const entryPoint = path.join(paths.annotatorStaticDir, "src/main.tsx");
        const result = await esbuild.build({
          entryPoints: [entryPoint],
          bundle: true,
          write: false,
          format: "esm",
          target: "es2022",
          jsx: "automatic",
          sourcemap: "inline",
          absWorkingDir: paths.repoRoot,
        });
        const jsOut = result.outputFiles?.[0]?.text || "";
        res.writeHead(200, {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-cache",
        });
        res.end(jsOut, "utf8");
        return;
      }

      if (req.method === "GET" && pathname.startsWith("/vendor/wavesurfer/")) {
        const rel = pathname.slice("/vendor/wavesurfer/".length);
        await serveStaticFile(paths.wavesurferDistDir, rel, res);
        return;
      }

      if (req.method === "GET" && pathname.startsWith("/vendor/shared/")) {
        const rel = pathname.slice("/vendor/shared/".length);
        await serveStaticFile(paths.sharedSrcDir, rel, res);
        return;
      }

      if (req.method === "GET") {
        const rel = pathname === "/" ? "index.html" : pathname.slice(1);
        await serveStaticFile(paths.annotatorStaticDir, rel, res);
        return;
      }

      res.writeHead(405);
      res.end("Method Not Allowed");
    } catch (err) {
      const status =
        err && err.code === "CORRUPTED_JSON"
          ? 500
          : err && err.code === "VALIDATION_ERROR"
            ? 400
            : 400;
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(
        JSON.stringify({
          ok: false,
          code: err?.code || "BAD_REQUEST",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  });
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const portArgIdx = process.argv.indexOf("--port");
  const port =
    portArgIdx !== -1 && process.argv[portArgIdx + 1]
      ? Number(process.argv[portArgIdx + 1])
      : Number(process.env.PORT || 4321);

  const server = createAnnotationServer();
  server.listen(port, "127.0.0.1", async () => {
    try {
      await loadCurrentState();
    } catch (err) {
      console.error(`[Try Me Annotator] Warning on startup: ${err.message}`);
    }
    console.log(
      `[Try Me Annotator] Local server ready at http://127.0.0.1:${port}`,
    );
  });
}
