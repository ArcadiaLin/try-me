import { useSyncExternalStore } from "react";
import { audioSecToGlobalFrame } from "@try-me/shared";
import {
  allocateCustomItemId,
  allocateMarkerId,
  allocateRegionId,
  applyCandidateProvenance,
  applyServerStateToModel,
  clearCandidateProvenance,
  executeReloadFlow,
  executeSaveFlow,
} from "../../model.ts";
import type {
  AnalysisBundle,
  AnalysisCandidate,
  AnnotationsDocument,
  AuditionMode,
  CustomTimelineTrack,
  LyricLine,
  LyricsBundle,
  PointMarker,
  RegionItem,
  ServerStatePayload,
  TimelineTrackItem,
  TrackId,
  TrackLockMap,
  TrackVisibilityMap,
} from "../types.ts";
import {
  exportLyricsToAss,
  exportLyricsToLrc,
  parseAssToLyrics,
  parseLrcToLyrics,
} from "../utils/ass-lrc.ts";
import { clearIdbDraft, saveIdbDraft } from "../utils/idb-draft.ts";

export const POINT_CATEGORIES = [
  { value: "downbeat", label: "downbeat (小节第一拍)", color: "#f59e0b" },
  { value: "beat", label: "beat (普通拍点)", color: "#eab308" },
  { value: "accent", label: "accent (鼓点/音效重音)", color: "#ec4899" },
  { value: "vocal", label: "vocal (人声关键点)", color: "#a855f7" },
  { value: "cut", label: "cut (候选切镜点)", color: "#22c55e" },
];

export const REGION_CATEGORIES = [
  { value: "section", label: "section (正式音乐段落 P001)", color: "#38bdf8" },
  { value: "phrase", label: "phrase (乐句 / 呼吸区间)", color: "#818cf8" },
  {
    value: "representative_clip",
    label: "representative_clip (10-20s 代表性测试片段)",
    color: "#10b981",
  },
];

export interface WorkbenchState {
  revision: string | null;
  analysis: AnalysisBundle | null;
  annotations: AnnotationsDocument | null;
  lyrics: LyricsBundle;
  agentBriefMarkdown: string;

  // Explorer & Selection
  activeTrackId: TrackId;
  selectedGroupId: string | null;
  selectedKind: "lyric" | "region" | "point" | "custom_item" | null;
  selectedId: string | null;
  selectedLyricId: string | null;

  // Track Visibility & Lock
  trackVisibility: TrackVisibilityMap;
  trackLocks: TrackLockMap;

  // Playback & Transport
  isPlaying: boolean;
  currentTimeSec: number;
  playbackRate: number;
  zoomPxPerSec: number;
  snapEnabled: boolean;
  snapToleranceSec: number;
  clickTrackEnabled: boolean;
  clickCandidatesEnabled: boolean;
  onsetThreshold: number;

  // Loop & Aegisub Audition
  loopEnabled: boolean;
  loopInSec: number | null;
  loopOutSec: number | null;
  loopingLyricId: string | null;
  auditionStopAtSec: number | null;
  activeAuditionLabel: string | null;
  linkAdjacentLyrics: boolean;

  // UI Panels & Status
  agentDrawerOpen: boolean;
  inspectorWidth: number;
  saveStatusText: string;
  saveStatusError: boolean;
  offlineDraftRestored: boolean;

  // Internal concurrency & Undo/Redo
  undoStack: string[];
  redoStack: string[];
  saveTimer: ReturnType<typeof setTimeout> | null;
  lyricsSaveTimer: ReturnType<typeof setTimeout> | null;
  loadEpoch: number;
  reloadRequestSeq: number;
  editSeq: number;
  savedSeq: number;
  saveInFlight: boolean;
  pendingSaveForce: boolean | null;
  audioHashMismatch: boolean;
}

export const storeState: WorkbenchState = {
  revision: null,
  analysis: null,
  annotations: null,
  lyrics: { available: false, lines: [] },
  agentBriefMarkdown: "",

  activeTrackId: "lyrics_main",
  selectedGroupId: null,
  selectedKind: "lyric",
  selectedId: "L011",
  selectedLyricId: "L011",

  trackVisibility: {
    lyrics_main: true,
    structure_sections: true,
    structure_clips: true,
    rhythm_downbeats: true,
    rhythm_markers: true,
    cand_beats: true,
    cand_onsets: true,
    cand_energy: false,
  },
  trackLocks: {
    lyrics_main: false,
    structure_sections: true,
    structure_clips: false,
    rhythm_downbeats: false,
    rhythm_markers: false,
  },

  isPlaying: false,
  currentTimeSec: 0,
  playbackRate: 1,
  zoomPxPerSec: 110,
  snapEnabled: true,
  snapToleranceSec: 0.035,
  clickTrackEnabled: true,
  clickCandidatesEnabled: false,
  onsetThreshold: 2.0,

  loopEnabled: false,
  loopInSec: null,
  loopOutSec: null,
  loopingLyricId: null,
  auditionStopAtSec: null,
  activeAuditionLabel: null,
  linkAdjacentLyrics: true,

  agentDrawerOpen: false,
  inspectorWidth: 420,
  saveStatusText: "初始化中...",
  saveStatusError: false,
  offlineDraftRestored: false,

  undoStack: [],
  redoStack: [],
  saveTimer: null,
  lyricsSaveTimer: null,
  loadEpoch: 0,
  reloadRequestSeq: 0,
  editSeq: 0,
  savedSeq: 0,
  saveInFlight: false,
  pendingSaveForce: null,
  audioHashMismatch: false,
};

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedSnapshot: WorkbenchState = { ...storeState };

export function notifyStore(): void {
  cachedSnapshot = { ...storeState };
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getStoreSnapshot(): WorkbenchState {
  return cachedSnapshot;
}

export function useWorkbenchStore(): WorkbenchState {
  return useSyncExternalStore(subscribeStore, getStoreSnapshot, getStoreSnapshot);
}

// External WaveSurfer bridge registered by AudioTimelineStage
interface AudioPlayerBridge {
  seekTo: (sec: number) => void;
  play: () => void;
  pause: () => void;
  playPause: () => void;
  stop: () => void;
  setRate: (rate: number) => void;
  setZoom: (pxPerSec: number) => void;
  getDuration: () => number;
  getCurrentTime: () => number;
}

let playerBridge: AudioPlayerBridge | null = null;

export function registerAudioPlayerBridge(bridge: AudioPlayerBridge | null): void {
  playerBridge = bridge;
}

export function getAudioDuration(): number {
  return (
    playerBridge?.getDuration() ||
    storeState.annotations?.audio_asset?.duration_sec ||
    storeState.analysis?.summary?.input_audio?.duration_sec ||
    209.719615
  );
}

export function getSampleRate(): number {
  return (
    storeState.annotations?.audio_asset?.samplerate ||
    storeState.analysis?.summary?.input_audio?.samplerate ||
    44100
  );
}

export function toVideoFrame(audioSec: number): number {
  const fps = Number(storeState.annotations?.preview_mapping?.preview_fps ?? 30);
  const offset = Number(
    storeState.annotations?.preview_mapping?.audio_offset_seconds ?? 0,
  );
  return audioSecToGlobalFrame(audioSec, offset, fps);
}

export function setSaveStatus(text: string, isError = false): void {
  storeState.saveStatusText = text;
  storeState.saveStatusError = isError;
  notifyStore();
}

function persistLocalDraft(hasUnsyncedChanges: boolean): void {
  void saveIdbDraft({
    savedAtUtc: new Date().toISOString(),
    revision: storeState.revision,
    annotations: storeState.annotations,
    lyricsLines: storeState.lyrics?.lines || null,
    hasUnsyncedChanges,
  });
}

function pushUndoSnapshot(): void {
  if (!storeState.annotations) return;
  const snap = JSON.stringify({
    id_counters: storeState.annotations.id_counters,
    markers: storeState.annotations.markers,
    regions: storeState.annotations.regions,
    collections: storeState.annotations.collections || [],
    custom_tracks: storeState.annotations.custom_tracks || [],
    global_notes: storeState.annotations.global_notes,
    preview_mapping: storeState.annotations.preview_mapping,
    lyrics_lines: storeState.lyrics?.lines || [],
  });
  if (
    storeState.undoStack.length === 0 ||
    storeState.undoStack[storeState.undoStack.length - 1] !== snap
  ) {
    storeState.undoStack.push(snap);
    if (storeState.undoStack.length > 50) storeState.undoStack.shift();
    storeState.redoStack = [];
  }
}

export function findNearestCandidate(
  timeSec: number,
  maxDistSec = storeState.snapToleranceSec,
): AnalysisCandidate | null {
  if (!storeState.analysis) return null;
  let best: AnalysisCandidate | null = null;
  let bestDist = maxDistSec;

  for (const b of storeState.analysis.beats || []) {
    const d = Math.abs(b.time_sec - timeSec);
    if (d <= bestDist) {
      bestDist = d;
      best = {
        time_sec: b.time_sec,
        sample_index: b.sample_index,
        id: b.id,
        kind: "beat",
      };
    }
  }
  for (const o of storeState.analysis.onsets || []) {
    if ((o.onset_strength ?? 99) < storeState.onsetThreshold) continue;
    const d = Math.abs(o.time_sec - timeSec);
    if (d <= bestDist) {
      bestDist = d;
      best = {
        time_sec: o.time_sec,
        sample_index: o.sample_index,
        id: o.id,
        kind: "onset",
      };
    }
  }
  return best;
}

export function maybeSnapTime(timeSec: number): {
  time_sec: number;
  candidate: AnalysisCandidate | null;
} {
  const clamped = Math.max(0, Math.min(getAudioDuration(), Number(timeSec) || 0));
  if (!storeState.snapEnabled) {
    return { time_sec: Number(clamped.toFixed(6)), candidate: null };
  }
  const nearest = findNearestCandidate(clamped, storeState.snapToleranceSec);
  if (nearest) {
    return {
      time_sec: Number(nearest.time_sec.toFixed(6)),
      candidate: nearest,
    };
  }
  return { time_sec: Number(clamped.toFixed(6)), candidate: null };
}

export async function saveLyrics(
  customFetch: typeof fetch = fetch,
): Promise<{ status: string; error?: string }> {
  if (!storeState.lyrics?.lines?.length) return { status: "noop" };
  setSaveStatus("正在保存歌词轴...");
  try {
    const res = await customFetch("/api/lyrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: storeState.lyrics.lines }),
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { lyrics?: LyricsBundle };
    if (data.lyrics) {
      storeState.lyrics = data.lyrics;
    }
    setSaveStatus("✓ 歌词轴已保存");
    persistLocalDraft(false);
    notifyStore();
    return { status: "clean" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setSaveStatus(`歌词保存离线缓存中 (${msg})`, true);
    persistLocalDraft(true);
    return { status: "error", error: msg };
  }
}

export function scheduleLyricsSave(): void {
  setSaveStatus("歌词待保存...");
  persistLocalDraft(true);
  if (storeState.lyricsSaveTimer) clearTimeout(storeState.lyricsSaveTimer);
  storeState.lyricsSaveTimer = setTimeout(() => {
    storeState.lyricsSaveTimer = null;
    void saveLyrics();
  }, 380);
}

export function scheduleAutoSave(force = false): void {
  setSaveStatus("标注待保存...");
  persistLocalDraft(true);
  if (storeState.saveTimer) clearTimeout(storeState.saveTimer);
  storeState.saveTimer = setTimeout(() => {
    storeState.saveTimer = null;
    void saveAnnotations(force);
  }, 450);
}

export async function saveAnnotations(
  force = false,
  customFetch: typeof fetch = fetch,
): Promise<{ status: string }> {
  if (!storeState.annotations) return { status: "noop" };
  if (storeState.saveTimer) {
    clearTimeout(storeState.saveTimer);
    storeState.saveTimer = null;
  }
  const outcome = await executeSaveFlow(storeState, {
    force,
    customFetch,
    onStatus: (text: string, isError?: boolean) => setSaveStatus(text, Boolean(isError)),
    onAlert: (msg: string) => {
      if (typeof window !== "undefined" && window.alert) {
        window.alert(msg);
      }
    },
    onConfirmConflict: () =>
      typeof window !== "undefined" && window.confirm
        ? window.confirm(
            "检测到本地标注文件已被外部（如 Agent）修改！\n点击「确定」用当前页面内容覆盖本地文件；\n点击「取消」放弃未保存修改并载入最新外部修改。",
          )
        : false,
    onApplyServerState: (latest: ServerStatePayload) => applyServerState(latest),
    onBriefUpdated: (md: string) => {
      storeState.agentBriefMarkdown = md;
      notifyStore();
    },
    onScheduleFollowUp: (nextForce: boolean) => scheduleAutoSave(nextForce),
  });
  if (outcome.status === "clean") {
    persistLocalDraft(false);
    void clearIdbDraft();
  }
  notifyStore();
  return outcome;
}

export async function reloadAnnotations(
  customFetch: typeof fetch = fetch,
): Promise<{ status: string }> {
  const outcome = await executeReloadFlow(storeState, {
    customFetch,
    onConfirmDirty: () =>
      typeof window !== "undefined" && window.confirm
        ? window.confirm(
            "当前页面有未保存的编辑内容，重新载入将丢弃未保存内容，确定继续吗？",
          )
        : false,
    onClearTimer: () => {
      if (storeState.saveTimer) {
        clearTimeout(storeState.saveTimer);
        storeState.saveTimer = null;
      }
    },
    onStatus: (text: string, isError?: boolean) => setSaveStatus(text, Boolean(isError)),
    onApplyServerState: (latest: ServerStatePayload) => applyServerState(latest),
  });
  notifyStore();
  return outcome;
}

const BUILTIN_TRACK_IDS = new Set([
  "lyrics_main",
  "structure_sections",
  "structure_clips",
  "rhythm_downbeats",
  "rhythm_markers",
  "cand_beats",
  "cand_onsets",
  "cand_energy",
]);

export function isBuiltInTrackId(trackId: string): boolean {
  return BUILTIN_TRACK_IDS.has(trackId);
}

export function findCustomTrack(trackId: string): CustomTimelineTrack | null {
  return (storeState.annotations?.custom_tracks || []).find((t) => t.id === trackId) || null;
}

export function applyServerState(serverState: ServerStatePayload): void {
  if (storeState.saveTimer) {
    clearTimeout(storeState.saveTimer);
    storeState.saveTimer = null;
  }
  applyServerStateToModel(storeState, serverState);
  for (const trk of storeState.annotations?.custom_tracks || []) {
    if (storeState.trackVisibility[trk.id] === undefined) {
      storeState.trackVisibility[trk.id] = trk.visible !== false;
    }
    if (storeState.trackLocks[trk.id] === undefined) {
      storeState.trackLocks[trk.id] = Boolean(trk.locked);
    }
  }
  if (
    !storeState.selectedLyricId &&
    storeState.lyrics?.lines &&
    storeState.lyrics.lines.length > 0
  ) {
    storeState.selectedLyricId = storeState.lyrics.lines[0].id;
  }
  if (storeState.audioHashMismatch) {
    setSaveStatus("音源 SHA-256 与标注记录不匹配（已禁止自动覆盖）", true);
  } else {
    setSaveStatus("✓ 已同步本地数据");
  }
  notifyStore();
}

export function selectTrackAndGroup(
  trackId: TrackId,
  groupId: string | null = null,
): void {
  storeState.activeTrackId = trackId;
  storeState.selectedGroupId = groupId;

  // Automatically unlock the newly focused editable track so it can be edited right away
  if (trackId === "lyrics_main") {
    storeState.selectedKind = "lyric";
    const lines = storeState.lyrics?.lines || [];
    const candidateLines = groupId
      ? lines.filter((l) => l.section_id === groupId)
      : lines;
    if (
      candidateLines.length > 0 &&
      !candidateLines.some((l) => l.id === storeState.selectedLyricId)
    ) {
      storeState.selectedLyricId = candidateLines[0].id;
    }
    storeState.selectedId = storeState.selectedLyricId;
  } else if (trackId === "structure_sections" || trackId === "structure_clips") {
    storeState.selectedKind = "region";
    const regions = (storeState.annotations?.regions || []).filter((r) =>
      trackId === "structure_clips"
        ? r.category === "representative_clip"
        : r.category !== "representative_clip",
    );
    if (groupId && regions.some((r) => r.id === groupId)) {
      storeState.selectedId = groupId;
    } else if (regions.length > 0 && !regions.some((r) => r.id === storeState.selectedId)) {
      storeState.selectedId = regions[0].id;
    }
  } else if (trackId === "rhythm_downbeats" || trackId === "rhythm_markers") {
    storeState.selectedKind = "point";
    const markers = (storeState.annotations?.markers || []).filter((m) =>
      trackId === "rhythm_downbeats"
        ? m.category === "downbeat"
        : m.category !== "downbeat",
    );
    if (markers.length > 0 && !markers.some((m) => m.id === storeState.selectedId)) {
      storeState.selectedId = markers[0].id;
    }
  } else {
    const customTrk = findCustomTrack(trackId);
    if (customTrk) {
      storeState.selectedKind = "custom_item";
      const items = groupId
        ? customTrk.items.filter((i) => i.group_id === groupId || i.parent_id === groupId)
        : customTrk.items;
      if (items.length > 0 && !items.some((i) => i.id === storeState.selectedId)) {
        storeState.selectedId = items[0].id;
      } else if (items.length === 0) {
        storeState.selectedId = null;
      }
    }
  }
  notifyStore();
}

export function selectTimelineItem(
  kind: "lyric" | "region" | "point" | "custom_item",
  id: string,
  seek = false,
  customTrackId?: string,
): void {
  storeState.selectedKind = kind;
  storeState.selectedId = id;
  if (kind === "lyric") {
    storeState.selectedLyricId = id;
    storeState.activeTrackId = "lyrics_main";
    const line = storeState.lyrics?.lines?.find((l) => l.id === id);
    if (line && seek) {
      seekAudio(line.start_sec);
    }
  } else if (kind === "region") {
    const reg = storeState.annotations?.regions?.find((r) => r.id === id);
    if (reg) {
      storeState.activeTrackId =
        reg.category === "representative_clip"
          ? "structure_clips"
          : "structure_sections";
      if (seek) seekAudio(reg.start_sec);
    }
  } else if (kind === "point") {
    const pt = storeState.annotations?.markers?.find((m) => m.id === id);
    if (pt) {
      storeState.activeTrackId =
        pt.category === "downbeat" ? "rhythm_downbeats" : "rhythm_markers";
      if (seek) seekAudio(pt.time_sec);
    }
  } else if (kind === "custom_item") {
    for (const trk of storeState.annotations?.custom_tracks || []) {
      if (customTrackId && trk.id !== customTrackId) continue;
      const item = trk.items.find((i) => i.id === id);
      if (item) {
        storeState.activeTrackId = trk.id;
        if (seek) {
          const t = item.kind === "point" ? item.time_sec : item.start_sec;
          if (typeof t === "number") seekAudio(t);
        }
        break;
      }
    }
  }
  notifyStore();
}

export function toggleTrackVisibility(trackId: TrackId): void {
  const nextVal = !(storeState.trackVisibility[trackId] !== false);
  storeState.trackVisibility = {
    ...storeState.trackVisibility,
    [trackId]: nextVal,
  };
  const customTrk = findCustomTrack(trackId);
  if (customTrk) {
    customTrk.visible = nextVal;
  }
  notifyStore();
}

export function toggleTrackLock(trackId: keyof TrackLockMap): void {
  const nextVal = !storeState.trackLocks[trackId];
  storeState.trackLocks = {
    ...storeState.trackLocks,
    [trackId]: nextVal,
  };
  const customTrk = findCustomTrack(String(trackId));
  if (customTrk) {
    customTrk.locked = nextVal;
  }
  notifyStore();
}

export function seekAudio(sec: number): void {
  const clamped = Math.max(0, Math.min(getAudioDuration(), Number(sec) || 0));
  storeState.auditionStopAtSec = null;
  storeState.activeAuditionLabel = null;
  storeState.currentTimeSec = clamped;
  playerBridge?.seekTo(clamped);
  notifyStore();
}

export function togglePlayPause(): void {
  storeState.auditionStopAtSec = null;
  storeState.activeAuditionLabel = null;
  playerBridge?.playPause();
}

export function stopPlayback(): void {
  storeState.auditionStopAtSec = null;
  storeState.activeAuditionLabel = null;
  storeState.currentTimeSec = 0;
  playerBridge?.stop();
  notifyStore();
}

export function setPlaybackRate(rate: number): void {
  storeState.playbackRate = rate;
  playerBridge?.setRate(rate);
  notifyStore();
}

export function triggerLyricAudition(
  mode: AuditionMode,
  customLine?: LyricLine,
): void {
  const line =
    customLine ||
    storeState.lyrics?.lines?.find((l) => l.id === storeState.selectedLyricId) ||
    findPlayingOrNearestLyric(storeState.currentTimeSec);
  if (!line) return;

  storeState.selectedLyricId = line.id;
  storeState.selectedKind = "lyric";
  storeState.selectedId = line.id;

  const duration = getAudioDuration();
  let startSec = line.start_sec;
  let stopSec = line.end_sec;
  let label = `${line.id} 全句`;

  if (mode === "before_start") {
    startSec = Math.max(0, line.start_sec - 0.5);
    stopSec = line.start_sec;
    label = `${line.id} 句首前 500ms`;
  } else if (mode === "after_start") {
    startSec = line.start_sec;
    stopSec = Math.min(line.end_sec, line.start_sec + 0.5);
    label = `${line.id} 句首后 500ms`;
  } else if (mode === "before_end") {
    startSec = Math.max(line.start_sec, line.end_sec - 0.55);
    stopSec = line.end_sec;
    label = `${line.id} 句尾前 550ms`;
  } else if (mode === "after_end") {
    startSec = line.end_sec;
    stopSec = Math.min(duration, line.end_sec + 0.55);
    label = `${line.id} 句尾后 550ms (听下一句起音)`;
  }

  storeState.loopEnabled = false;
  storeState.auditionStopAtSec = stopSec;
  storeState.activeAuditionLabel = label;
  storeState.currentTimeSec = startSec;
  playerBridge?.seekTo(startSec);
  playerBridge?.play();
  notifyStore();
}

export function findPlayingOrNearestLyric(currentSec: number): LyricLine | null {
  const lines = storeState.lyrics?.lines || [];
  if (lines.length === 0) return null;
  for (const l of lines) {
    if (currentSec >= l.start_sec - 0.04 && currentSec < l.end_sec) {
      return l;
    }
  }
  return null;
}

export function updateLyricStart(
  lyricId: string,
  newStartSec: number,
  originCandidateId?: string | null,
  previewAfterEdit = false,
): void {
  const lines = storeState.lyrics?.lines || [];
  const idx = lines.findIndex((l) => l.id === lyricId);
  if (idx === -1) return;

  pushUndoSnapshot();
  const line = lines[idx];
  const prevOldEnd = idx > 0 ? lines[idx - 1].end_sec : null;
  const oldStart = line.start_sec;
  const clampedStart = Number(
    Math.max(0, Math.min(line.end_sec - 0.05, newStartSec)).toFixed(3),
  );
  line.start_sec = clampedStart;
  if (originCandidateId !== undefined) {
    line.origin_candidate_id = originCandidateId;
  }

  if (idx > 0 && prevOldEnd !== null) {
    const prev = lines[idx - 1];
    const wasTouching = Math.abs(prevOldEnd - oldStart) <= 0.15;
    if (
      (storeState.linkAdjacentLyrics && wasTouching) ||
      prev.end_sec > clampedStart
    ) {
      prev.end_sec = Number(
        Math.max(prev.start_sec + 0.05, clampedStart).toFixed(3),
      );
    }
  }

  if (storeState.loopEnabled && storeState.loopingLyricId === line.id) {
    storeState.loopInSec = line.start_sec;
    storeState.loopOutSec = line.end_sec;
  }

  storeState.lyrics = {
    ...storeState.lyrics,
    lines: [...lines],
  };
  scheduleLyricsSave();
  if (previewAfterEdit) {
    triggerLyricAudition("after_start", line);
  } else {
    notifyStore();
  }
}

export function updateLyricEnd(
  lyricId: string,
  newEndSec: number,
  previewBeforeEnd = false,
): void {
  const lines = storeState.lyrics?.lines || [];
  const idx = lines.findIndex((l) => l.id === lyricId);
  if (idx === -1) return;

  pushUndoSnapshot();
  const line = lines[idx];
  const nextOldStart =
    idx + 1 < lines.length ? lines[idx + 1].start_sec : null;
  const oldEnd = line.end_sec;
  const clampedEnd = Number(
    Math.min(
      getAudioDuration(),
      Math.max(line.start_sec + 0.05, newEndSec),
    ).toFixed(3),
  );
  line.end_sec = clampedEnd;

  if (idx + 1 < lines.length && nextOldStart !== null) {
    const next = lines[idx + 1];
    const wasTouching = Math.abs(nextOldStart - oldEnd) <= 0.15;
    if (
      (storeState.linkAdjacentLyrics && wasTouching) ||
      next.start_sec < clampedEnd
    ) {
      if (clampedEnd < next.end_sec - 0.05) {
        next.start_sec = clampedEnd;
      }
    }
  }

  if (storeState.loopEnabled && storeState.loopingLyricId === line.id) {
    storeState.loopInSec = line.start_sec;
    storeState.loopOutSec = line.end_sec;
  }

  storeState.lyrics = {
    ...storeState.lyrics,
    lines: [...lines],
  };
  scheduleLyricsSave();
  if (previewBeforeEnd) {
    triggerLyricAudition("before_end", line);
  } else {
    notifyStore();
  }
}

export function updateLyricFields(
  lyricId: string,
  patch: Partial<
    Pick<
      LyricLine,
      | "section_id"
      | "bar"
      | "status"
      | "text"
      | "note"
      | "script_idea"
      | "linked_shots"
      | "agent_comment"
      | "agent_status"
      | "agent_reply"
    >
  >,
): void {
  const lines = storeState.lyrics?.lines || [];
  const idx = lines.findIndex((l) => l.id === lyricId);
  if (idx === -1) return;
  pushUndoSnapshot();
  const nextLine = {
    ...lines[idx],
    ...patch,
  };
  if (
    nextLine.agent_comment &&
    (!nextLine.agent_status || nextLine.agent_status === "none")
  ) {
    nextLine.agent_status = "open";
  }
  lines[idx] = nextLine;
  storeState.lyrics = {
    ...storeState.lyrics,
    lines: [...lines],
  };
  scheduleLyricsSave();
  notifyStore();
}

export function confirmLyricAndAdvance(lyricId?: string): void {
  const lines = storeState.lyrics?.lines || [];
  const targetId = lyricId || storeState.selectedLyricId;
  const idx = lines.findIndex((l) => l.id === targetId);
  if (idx === -1) return;

  pushUndoSnapshot();
  lines[idx].status = "confirmed";
  const nextLine = idx + 1 < lines.length ? lines[idx + 1] : null;
  if (nextLine) {
    storeState.selectedLyricId = nextLine.id;
    storeState.selectedKind = "lyric";
    storeState.selectedId = nextLine.id;
    if (storeState.loopEnabled && storeState.loopingLyricId === lines[idx].id) {
      storeState.loopingLyricId = nextLine.id;
      storeState.loopInSec = nextLine.start_sec;
      storeState.loopOutSec = nextLine.end_sec;
    }
    triggerLyricAudition("line", nextLine);
  } else {
    notifyStore();
  }
  storeState.lyrics = {
    ...storeState.lyrics,
    lines: [...lines],
  };
  scheduleLyricsSave();
}

export function toggleLoopForLyric(lyric: LyricLine): void {
  const isSameLoop =
    storeState.loopEnabled && storeState.loopingLyricId === lyric.id;
  if (isSameLoop) {
    storeState.loopEnabled = false;
    storeState.loopingLyricId = null;
    playerBridge?.pause();
  } else {
    storeState.selectedLyricId = lyric.id;
    storeState.selectedKind = "lyric";
    storeState.selectedId = lyric.id;
    storeState.loopingLyricId = lyric.id;
    storeState.loopInSec = lyric.start_sec;
    storeState.loopOutSec = lyric.end_sec;
    storeState.loopEnabled = true;
    storeState.auditionStopAtSec = null;
    storeState.activeAuditionLabel = `循环 ${lyric.id}`;
    playerBridge?.seekTo(lyric.start_sec);
    playerBridge?.play();
  }
  notifyStore();
}

export function addPointMarker(params: {
  timeSec: number;
  category?: string;
  label?: string;
  originCandidate?: AnalysisCandidate | null;
  status?: "candidate" | "confirmed";
  note?: string;
}): void {
  if (!storeState.annotations) return;
  pushUndoSnapshot();
  storeState.editSeq += 1;

  const category = params.category || "beat";
  const snapped = params.originCandidate
    ? {
        time_sec: Number(params.originCandidate.time_sec.toFixed(6)),
        candidate: params.originCandidate,
      }
    : maybeSnapTime(params.timeSec);
  const id = allocateMarkerId(storeState.annotations);
  const catMeta =
    POINT_CATEGORIES.find((c) => c.value === category) || POINT_CATEGORIES[1];
  const cand = params.originCandidate || snapped.candidate || null;

  const newMarker: PointMarker = {
    id,
    kind: "point",
    category,
    label: params.label || (category === "downbeat" ? `Bar (${id})` : id),
    color: catMeta.color,
    time_sec: snapped.time_sec,
    source: "human",
    origin_candidate_id: null,
    origin_analysis_run_id: null,
    origin_analysis_sha256: null,
    origin_candidate_time_sec: null,
    origin_candidate_sample_index: null,
    status: params.status || "confirmed",
    linked_shots: [],
    note: params.note || "",
    script_idea: "",
    agent_comment: "",
    agent_status: "none",
    agent_reply: "",
    lyric_hint: "",
  };
  applyCandidateProvenance(
    newMarker,
    cand,
    storeState.analysis?.summary,
    storeState.annotations?.audio_asset,
  );

  storeState.annotations.markers.push(newMarker);
  storeState.annotations.markers.sort((a, b) => a.time_sec - b.time_sec);
  selectTimelineItem("point", id);
  scheduleAutoSave();
  notifyStore();
}

export function updatePointMarker(
  id: string,
  patch: Partial<PointMarker>,
  clearProvenance = false,
): void {
  if (!storeState.annotations) return;
  const idx = storeState.annotations.markers.findIndex((m) => m.id === id);
  if (idx === -1) return;
  pushUndoSnapshot();
  storeState.editSeq += 1;
  const target = {
    ...storeState.annotations.markers[idx],
    ...patch,
  };
  if (clearProvenance) {
    clearCandidateProvenance(target);
  }
  if (target.agent_comment && target.agent_status === "none") {
    target.agent_status = "open";
  }
  storeState.annotations.markers[idx] = target;
  storeState.annotations.markers.sort((a, b) => a.time_sec - b.time_sec);
  scheduleAutoSave();
  notifyStore();
}

export function addRegion(params: {
  startSec: number;
  endSec: number;
  idOverride?: string | null;
  category?: string;
  status?: "candidate" | "confirmed";
  label?: string;
  note?: string;
}): void {
  if (!storeState.annotations) return;
  pushUndoSnapshot();
  storeState.editSeq += 1;
  const category = params.category || "section";
  const sSnap = maybeSnapTime(params.startSec);
  const eSnap = maybeSnapTime(params.endSec);
  const id = params.idOverride || allocateRegionId(storeState.annotations);
  const catMeta =
    REGION_CATEGORIES.find((c) => c.value === category) || REGION_CATEGORIES[0];

  const newRegion: RegionItem = {
    id,
    kind: "region",
    category,
    label: params.label || `${id} Section`,
    color: catMeta.color,
    start_sec: sSnap.time_sec,
    end_sec: Math.min(
      getAudioDuration(),
      Math.max(sSnap.time_sec + 0.2, eSnap.time_sec),
    ),
    source: "human",
    status: params.status || "candidate",
    linked_shots: [],
    note: params.note || "",
    script_idea: "",
    agent_comment: "",
    agent_status: "none",
    agent_reply: "",
    lyric_hint: "",
  };

  storeState.annotations.regions.push(newRegion);
  storeState.annotations.regions.sort((a, b) => a.start_sec - b.start_sec);
  selectTimelineItem("region", id);
  scheduleAutoSave();
  notifyStore();
}

export function updateRegion(id: string, patch: Partial<RegionItem>): void {
  if (!storeState.annotations) return;
  const idx = storeState.annotations.regions.findIndex((r) => r.id === id);
  if (idx === -1) return;
  pushUndoSnapshot();
  storeState.editSeq += 1;
  const target = {
    ...storeState.annotations.regions[idx],
    ...patch,
  };
  if (target.agent_comment && target.agent_status === "none") {
    target.agent_status = "open";
  }
  storeState.annotations.regions[idx] = target;
  storeState.annotations.regions.sort((a, b) => a.start_sec - b.start_sec);
  scheduleAutoSave();
  notifyStore();
}

export function addCustomTrack(params: {
  id?: string;
  name: string;
  type: string;
  collection_id?: string;
  allow_overlap?: boolean;
  purpose_for_agent?: string;
  color?: string;
}): string | null {
  if (!storeState.annotations) return null;
  pushUndoSnapshot();
  storeState.editSeq += 1;
  if (!storeState.annotations.custom_tracks) {
    storeState.annotations.custom_tracks = [];
  }
  const seq = (storeState.annotations.id_counters.track_seq || 0) + 1;
  storeState.annotations.id_counters.track_seq = seq;
  const rawSlug = params.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const trackId =
    params.id ||
    (rawSlug && !isBuiltInTrackId(rawSlug)
      ? `${rawSlug}_${seq}`
      : `track_custom_${seq}`);

  const newTrack: CustomTimelineTrack = {
    id: trackId,
    collection_id: params.collection_id || "col_custom",
    name: params.name.trim() || `自定义时间轴 ${seq}`,
    type: params.type.trim() || "custom",
    allow_overlap: params.allow_overlap !== false,
    visible: true,
    locked: false,
    color: params.color || "#38bdf8",
    purpose_for_agent: params.purpose_for_agent || "",
    items: [],
  };

  storeState.annotations.custom_tracks.push(newTrack);
  storeState.trackVisibility[trackId] = true;
  storeState.trackLocks[trackId] = false;
  storeState.activeTrackId = trackId;
  storeState.selectedKind = "custom_item";
  storeState.selectedId = null;
  scheduleAutoSave();
  notifyStore();
  return trackId;
}

export function updateCustomTrackMeta(
  trackId: string,
  patch: Partial<
    Pick<
      CustomTimelineTrack,
      | "name"
      | "type"
      | "collection_id"
      | "allow_overlap"
      | "purpose_for_agent"
      | "color"
      | "visible"
      | "locked"
    >
  >,
): void {
  if (!storeState.annotations?.custom_tracks) return;
  const idx = storeState.annotations.custom_tracks.findIndex((t) => t.id === trackId);
  if (idx === -1) return;
  pushUndoSnapshot();
  storeState.editSeq += 1;
  storeState.annotations.custom_tracks[idx] = {
    ...storeState.annotations.custom_tracks[idx],
    ...patch,
  };
  if (patch.visible !== undefined) {
    storeState.trackVisibility[trackId] = patch.visible;
  }
  if (patch.locked !== undefined) {
    storeState.trackLocks[trackId] = patch.locked;
  }
  scheduleAutoSave();
  notifyStore();
}

export function deleteCustomTrack(trackId: string): void {
  if (!storeState.annotations?.custom_tracks) return;
  pushUndoSnapshot();
  storeState.editSeq += 1;
  storeState.annotations.custom_tracks =
    storeState.annotations.custom_tracks.filter((t) => t.id !== trackId);
  if (storeState.activeTrackId === trackId) {
    storeState.activeTrackId = "lyrics_main";
    storeState.selectedKind = "lyric";
    storeState.selectedId = storeState.selectedLyricId;
  }
  scheduleAutoSave();
  notifyStore();
}

export function addCustomTrackItem(
  trackId: string,
  params: {
    kind: "region" | "point";
    startSec?: number;
    endSec?: number;
    timeSec?: number;
    label?: string;
    group_id?: string | null;
    parent_id?: string | null;
    category?: string;
    note?: string;
  },
): string | null {
  if (!storeState.annotations?.custom_tracks) return null;
  const trk = storeState.annotations.custom_tracks.find((t) => t.id === trackId);
  if (!trk) return null;

  pushUndoSnapshot();
  storeState.editSeq += 1;
  const id = allocateCustomItemId(storeState.annotations);
  const kind = params.kind === "point" ? "point" : "region";

  let newItem: TimelineTrackItem;
  if (kind === "point") {
    const snapped = maybeSnapTime(params.timeSec ?? storeState.currentTimeSec);
    newItem = {
      id,
      kind: "point",
      group_id: params.group_id ?? storeState.selectedGroupId ?? null,
      parent_id: params.parent_id ?? null,
      category: params.category || trk.type || "custom",
      label: params.label || `${trk.name} (${id})`,
      color: trk.color || "#38bdf8",
      time_sec: snapped.time_sec,
      source: "human",
      origin_candidate_id: snapped.candidate?.id ?? null,
      origin_analysis_run_id: storeState.analysis?.summary?.analysis_run_id ?? null,
      origin_analysis_sha256:
        storeState.analysis?.summary?.input_audio?.sha256 ??
        storeState.annotations?.audio_asset?.sha256 ??
        null,
      origin_candidate_time_sec: snapped.candidate?.time_sec ?? null,
      origin_candidate_sample_index: snapped.candidate?.sample_index ?? null,
      status: "confirmed",
      linked_shots: [],
      note: params.note || "",
      script_idea: "",
      agent_comment: "",
      agent_status: "none",
      agent_reply: "",
    };
  } else {
    const rawStart = params.startSec ?? storeState.currentTimeSec;
    const sSnap = maybeSnapTime(rawStart);
    const eSnap = maybeSnapTime(params.endSec ?? rawStart + 2.5);
    newItem = {
      id,
      kind: "region",
      group_id: params.group_id ?? storeState.selectedGroupId ?? null,
      parent_id: params.parent_id ?? null,
      category: params.category || trk.type || "custom",
      label: params.label || `${trk.name} (${id})`,
      color: trk.color || "#38bdf8",
      start_sec: sSnap.time_sec,
      end_sec: Math.min(
        getAudioDuration(),
        Math.max(sSnap.time_sec + 0.08, eSnap.time_sec),
      ),
      source: "human",
      status: "confirmed",
      linked_shots: [],
      note: params.note || "",
      script_idea: "",
      agent_comment: "",
      agent_status: "none",
      agent_reply: "",
    };
  }

  trk.items.push(newItem);
  trk.items.sort((a, b) => {
    const ta = a.kind === "point" ? (a.time_sec ?? 0) : (a.start_sec ?? 0);
    const tb = b.kind === "point" ? (b.time_sec ?? 0) : (b.start_sec ?? 0);
    return ta - tb;
  });
  storeState.activeTrackId = trackId;
  storeState.selectedKind = "custom_item";
  storeState.selectedId = id;
  scheduleAutoSave();
  notifyStore();
  return id;
}

export function updateCustomTrackItem(
  trackId: string,
  itemId: string,
  patch: Partial<TimelineTrackItem>,
  clearProvenance = false,
): void {
  if (!storeState.annotations?.custom_tracks) return;
  const trk = storeState.annotations.custom_tracks.find((t) => t.id === trackId);
  if (!trk) return;
  const idx = trk.items.findIndex((i) => i.id === itemId);
  if (idx === -1) return;

  pushUndoSnapshot();
  storeState.editSeq += 1;
  const target: TimelineTrackItem = {
    ...trk.items[idx],
    ...patch,
  };
  if (clearProvenance) {
    target.origin_candidate_id = null;
    target.origin_analysis_run_id = null;
    target.origin_analysis_sha256 = null;
    target.origin_candidate_time_sec = null;
    target.origin_candidate_sample_index = null;
  }
  if (target.agent_comment && target.agent_status === "none") {
    target.agent_status = "open";
  }
  trk.items[idx] = target;
  trk.items.sort((a, b) => {
    const ta = a.kind === "point" ? (a.time_sec ?? 0) : (a.start_sec ?? 0);
    const tb = b.kind === "point" ? (b.time_sec ?? 0) : (b.start_sec ?? 0);
    return ta - tb;
  });
  scheduleAutoSave();
  notifyStore();
}

export function deleteSelectedItem(): void {
  if (!storeState.selectedId || !storeState.annotations) return;
  if (storeState.selectedKind === "lyric") return; // Lyrics are fixed 63 lines
  pushUndoSnapshot();
  storeState.editSeq += 1;
  if (storeState.selectedKind === "point") {
    storeState.annotations.markers = storeState.annotations.markers.filter(
      (m) => m.id !== storeState.selectedId,
    );
  } else if (storeState.selectedKind === "region") {
    storeState.annotations.regions = storeState.annotations.regions.filter(
      (r) => r.id !== storeState.selectedId,
    );
  } else if (storeState.selectedKind === "custom_item") {
    for (const trk of storeState.annotations.custom_tracks || []) {
      trk.items = trk.items.filter((i) => i.id !== storeState.selectedId);
    }
  }
  storeState.selectedId = null;
  scheduleAutoSave();
  notifyStore();
}

export function performUndo(): void {
  if (storeState.undoStack.length === 0 || !storeState.annotations) return;
  const currentSnap = JSON.stringify({
    id_counters: storeState.annotations.id_counters,
    markers: storeState.annotations.markers,
    regions: storeState.annotations.regions,
    collections: storeState.annotations.collections || [],
    custom_tracks: storeState.annotations.custom_tracks || [],
    global_notes: storeState.annotations.global_notes,
    preview_mapping: storeState.annotations.preview_mapping,
    lyrics_lines: storeState.lyrics?.lines || [],
  });
  storeState.redoStack.push(currentSnap);
  const popped = storeState.undoStack.pop();
  if (!popped) return;
  const prev = JSON.parse(popped) as {
    id_counters: AnnotationsDocument["id_counters"];
    markers: PointMarker[];
    regions: RegionItem[];
    collections?: AnnotationsDocument["collections"];
    custom_tracks?: CustomTimelineTrack[];
    global_notes: AnnotationsDocument["global_notes"];
    preview_mapping: AnnotationsDocument["preview_mapping"];
    lyrics_lines?: LyricLine[];
  };
  storeState.annotations.id_counters = prev.id_counters;
  storeState.annotations.markers = prev.markers;
  storeState.annotations.regions = prev.regions;
  if (prev.collections) storeState.annotations.collections = prev.collections;
  if (prev.custom_tracks) storeState.annotations.custom_tracks = prev.custom_tracks;
  storeState.annotations.global_notes = prev.global_notes;
  storeState.annotations.preview_mapping = prev.preview_mapping;
  if (prev.lyrics_lines) {
    storeState.lyrics = {
      ...storeState.lyrics,
      lines: prev.lyrics_lines,
    };
    scheduleLyricsSave();
  }
  storeState.editSeq += 1;
  scheduleAutoSave();
  notifyStore();
}

export function performRedo(): void {
  if (storeState.redoStack.length === 0 || !storeState.annotations) return;
  const currentSnap = JSON.stringify({
    id_counters: storeState.annotations.id_counters,
    markers: storeState.annotations.markers,
    regions: storeState.annotations.regions,
    collections: storeState.annotations.collections || [],
    custom_tracks: storeState.annotations.custom_tracks || [],
    global_notes: storeState.annotations.global_notes,
    preview_mapping: storeState.annotations.preview_mapping,
    lyrics_lines: storeState.lyrics?.lines || [],
  });
  storeState.undoStack.push(currentSnap);
  const popped = storeState.redoStack.pop();
  if (!popped) return;
  const next = JSON.parse(popped) as {
    id_counters: AnnotationsDocument["id_counters"];
    markers: PointMarker[];
    regions: RegionItem[];
    collections?: AnnotationsDocument["collections"];
    custom_tracks?: CustomTimelineTrack[];
    global_notes: AnnotationsDocument["global_notes"];
    preview_mapping: AnnotationsDocument["preview_mapping"];
    lyrics_lines?: LyricLine[];
  };
  storeState.annotations.id_counters = next.id_counters;
  storeState.annotations.markers = next.markers;
  storeState.annotations.regions = next.regions;
  if (next.collections) storeState.annotations.collections = next.collections;
  if (next.custom_tracks) storeState.annotations.custom_tracks = next.custom_tracks;
  storeState.annotations.global_notes = next.global_notes;
  storeState.annotations.preview_mapping = next.preview_mapping;
  if (next.lyrics_lines) {
    storeState.lyrics = {
      ...storeState.lyrics,
      lines: next.lyrics_lines,
    };
    scheduleLyricsSave();
  }
  storeState.editSeq += 1;
  scheduleAutoSave();
  notifyStore();
}

export async function exportUnifiedTimelineFile(): Promise<void> {
  try {
    const res = await fetch("/api/timeline");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const content = await res.text();
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "try-me.timeline.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSaveStatus("✓ 已导出 try-me.timeline.json");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setSaveStatus(`导出 timeline.json 失败 (${msg})`, true);
  }
}

export function exportSubtitleFile(format: "ass" | "lrc"): void {
  const lines = storeState.lyrics?.lines || [];
  if (lines.length === 0) return;
  const content =
    format === "ass" ? exportLyricsToAss(lines) : exportLyricsToLrc(lines);
  const mime =
    format === "ass"
      ? "text/x-ssa;charset=utf-8"
      : "text/plain;charset=utf-8";
  const filename = format === "ass" ? "try-me.ass" : "try-me.lrc";
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setSaveStatus(`✓ 已导出 ${filename}`);
}

export function importSubtitleContent(
  filename: string,
  content: string,
): { count: number } {
  const lower = filename.toLowerCase();
  const existing = storeState.lyrics?.lines || [];
  const parsed = lower.endsWith(".ass")
    ? parseAssToLyrics(content, existing)
    : parseLrcToLyrics(content, existing, getAudioDuration());

  pushUndoSnapshot();
  storeState.lyrics = {
    ...storeState.lyrics,
    available: true,
    lines: parsed,
  };
  if (parsed.length > 0) {
    storeState.selectedLyricId = parsed[0].id;
    storeState.selectedKind = "lyric";
    storeState.selectedId = parsed[0].id;
  }
  scheduleLyricsSave();
  notifyStore();
  return { count: parsed.length };
}

export function startInspectorResize(e: {
  preventDefault: () => void;
  clientX: number;
  currentTarget: HTMLElement;
}): void {
  e.preventDefault();
  const startX = e.clientX;
  const startWidth = storeState.inspectorWidth;
  const handleEl = e.currentTarget;
  handleEl.classList.add("is-dragging");
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";

  const onMouseMove = (moveEv: MouseEvent) => {
    const deltaX = startX - moveEv.clientX;
    storeState.inspectorWidth = Math.max(
      280,
      Math.min(680, Math.round(startWidth + deltaX)),
    );
    notifyStore();
  };

  const onMouseUp = () => {
    handleEl.classList.remove("is-dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
}

export function resetInspectorWidth(): void {
  storeState.inspectorWidth = 420;
  notifyStore();
}
