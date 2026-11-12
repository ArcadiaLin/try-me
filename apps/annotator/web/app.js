import WaveSurfer from "/vendor/wavesurfer/wavesurfer.esm.js";
import RegionsPlugin from "/vendor/wavesurfer/plugins/regions.esm.js";
import TimelinePlugin from "/vendor/wavesurfer/plugins/timeline.esm.js";
import { audioSecToGlobalFrame } from "/vendor/shared/time-mapping.mjs";
import {
  allocateMarkerId,
  allocateRegionId,
  applyCandidateProvenance,
  applyServerStateToModel,
  clearCandidateProvenance,
  executeReloadFlow,
  executeSaveFlow,
} from "./model.js";

const POINT_CATEGORIES = [
  { value: "downbeat", label: "downbeat (小节第一拍)", color: "#f59e0b" },
  { value: "beat", label: "beat (普通拍点)", color: "#eab308" },
  { value: "accent", label: "accent (鼓点/音效重音)", color: "#ec4899" },
  { value: "vocal", label: "vocal (人声关键点)", color: "#a855f7" },
  { value: "cut", label: "cut (候选切镜点)", color: "#22c55e" },
];

const REGION_CATEGORIES = [
  { value: "section", label: "section (正式音乐段落 P001)", color: "#38bdf8" },
  { value: "phrase", label: "phrase (乐句 / 呼吸区间)", color: "#818cf8" },
  {
    value: "representative_clip",
    label: "representative_clip (10-20s 代表性测试片段)",
    color: "#10b981",
  },
];

export const state = {
  revision: null,
  analysis: null,
  annotations: null,
  agentBriefMarkdown: "",
  selectedKind: null,
  selectedId: null,
  zoomPxPerSec: 90,
  snapEnabled: true,
  snapToleranceSec: 0.035,
  clickTrackEnabled: true,
  clickCandidatesEnabled: false,
  showCandBeats: true,
  showCandOnsets: true,
  showCandEnergy: true,
  onsetThreshold: 2.0,
  loopEnabled: false,
  loopInSec: null,
  loopOutSec: null,
  undoStack: [],
  redoStack: [],
  saveTimer: null,
  loadEpoch: 0,
  reloadRequestSeq: 0,
  editSeq: 0,
  savedSeq: 0,
  saveInFlight: false,
  pendingSaveForce: null,
  audioHashMismatch: false,
  lastClickAudioSec: -1,
};

let ws = null;
let regionsPlugin = null;
let overlayCanvas = null;
let authAudioCtx = null;

function formatTime(sec) {
  const safe = Math.max(0, Number(sec) || 0);
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  return `${String(mins).padStart(2, "0")}:${rem.toFixed(3).padStart(6, "0")}`;
}

function hexToRgba(hex, alpha) {
  const clean = (hex || "#38bdf8").replace("#", "");
  const num = Number.parseInt(
    clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean,
    16,
  );
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getDuration() {
  return (
    ws?.getDuration() ||
    state.annotations?.audio_asset?.duration_sec ||
    state.analysis?.summary?.input_audio?.duration_sec ||
    209.719615
  );
}

function getSampleRate() {
  return (
    state.annotations?.audio_asset?.samplerate ||
    state.analysis?.summary?.input_audio?.samplerate ||
    44100
  );
}

function toVideoFrame(audioSec) {
  const fps = Number(state.annotations?.preview_mapping?.preview_fps ?? 30);
  const offset = Number(
    state.annotations?.preview_mapping?.audio_offset_seconds ?? 0,
  );
  return audioSecToGlobalFrame(audioSec, offset, fps);
}

function markEdited() {
  state.editSeq += 1;
}

export function isDirty() {
  return state.editSeq !== state.savedSeq;
}

function pushUndoSnapshot() {
  if (!state.annotations) return;
  const snap = JSON.stringify({
    id_counters: state.annotations.id_counters,
    markers: state.annotations.markers,
    regions: state.annotations.regions,
    global_notes: state.annotations.global_notes,
    preview_mapping: state.annotations.preview_mapping,
  });
  if (
    state.undoStack.length === 0 ||
    state.undoStack[state.undoStack.length - 1] !== snap
  ) {
    state.undoStack.push(snap);
    if (state.undoStack.length > 50) state.undoStack.shift();
    state.redoStack = [];
    updateUndoRedoButtons();
  }
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById("btn-undo");
  const redoBtn = document.getElementById("btn-redo");
  if (undoBtn) undoBtn.disabled = state.undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = state.redoStack.length === 0;
}

function findNearestCandidate(timeSec, maxDistSec = state.snapToleranceSec) {
  if (!state.analysis) return null;
  let best = null;
  let bestDist = maxDistSec;

  for (const b of state.analysis.beats || []) {
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
  for (const o of state.analysis.onsets || []) {
    if (o.onset_strength < state.onsetThreshold) continue;
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

function maybeSnapTime(timeSec) {
  const clamped = Math.max(0, Math.min(getDuration(), Number(timeSec) || 0));
  if (!state.snapEnabled) {
    return { time_sec: Number(clamped.toFixed(6)), candidate: null };
  }
  const nearest = findNearestCandidate(clamped, state.snapToleranceSec);
  if (nearest) {
    return {
      time_sec: Number(nearest.time_sec.toFixed(6)),
      candidate: nearest,
    };
  }
  return { time_sec: Number(clamped.toFixed(6)), candidate: null };
}

function playSynthesizedClick(freq = 920, gainVal = 0.22) {
  try {
    if (!authAudioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      authAudioCtx = new AudioCtx();
    }
    if (authAudioCtx.state === "suspended") {
      authAudioCtx.resume();
    }
    const now = authAudioCtx.currentTime;
    const osc = authAudioCtx.createOscillator();
    const gain = authAudioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + 0.035);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(authAudioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  } catch {
    // Ignore audio context errors before user gesture
  }
}

function checkClickTrackAndLoop(currentSec) {
  if (
    state.loopEnabled &&
    state.loopInSec !== null &&
    state.loopOutSec !== null &&
    state.loopOutSec > state.loopInSec + 0.05
  ) {
    if (currentSec >= state.loopOutSec) {
      ws.setTime(state.loopInSec);
      state.lastClickAudioSec = state.loopInSec;
      return;
    }
  }

  if (!state.clickTrackEnabled || !ws?.isPlaying()) {
    state.lastClickAudioSec = currentSec;
    return;
  }

  const prev = state.lastClickAudioSec;
  state.lastClickAudioSec = currentSec;
  if (prev < 0 || currentSec < prev || currentSec - prev > 0.25) {
    return;
  }

  for (const m of state.annotations?.markers || []) {
    if (m.time_sec > prev && m.time_sec <= currentSec) {
      const isDownbeat = m.category === "downbeat";
      playSynthesizedClick(isDownbeat ? 1360 : 920, isDownbeat ? 0.3 : 0.2);
      return;
    }
  }

  if (state.clickCandidatesEnabled && state.analysis?.beats) {
    for (const b of state.analysis.beats) {
      if (b.time_sec > prev && b.time_sec <= currentSec) {
        playSynthesizedClick(660, 0.12);
        return;
      }
    }
  }
}

function updateTopReadouts(currentSec = ws?.getCurrentTime() || 0) {
  document.getElementById("readout-time").textContent = formatTime(currentSec);
  document.getElementById("readout-sec").textContent =
    `(${currentSec.toFixed(3)}s)`;
  document.getElementById("readout-sample").textContent = String(
    Math.round(currentSec * getSampleRate()),
  );
  document.getElementById("readout-frame").textContent =
    `F${toVideoFrame(currentSec)}`;
  drawMinimap(currentSec);
  drawCandidateOverlay();
}

function syncWaveSurferRegions() {
  if (!regionsPlugin || !state.annotations) return;
  regionsPlugin.clearRegions();

  for (const r of state.annotations.regions) {
    const isSelected =
      state.selectedKind === "region" && state.selectedId === r.id;
    regionsPlugin.addRegion({
      id: `reg_${r.id}`,
      start: r.start_sec,
      end: r.end_sec,
      color: hexToRgba(r.color || "#38bdf8", isSelected ? 0.32 : 0.18),
      content: `${r.id}: ${r.label}`,
      drag: true,
      resize: true,
    });
  }

  for (const m of state.annotations.markers) {
    const isSelected =
      state.selectedKind === "point" && state.selectedId === m.id;
    regionsPlugin.addRegion({
      id: `pt_${m.id}`,
      start: m.time_sec,
      color: isSelected ? "#ffffff" : m.color || "#f59e0b",
      content: `${m.id} (${m.label})`,
      drag: true,
      resize: false,
    });
  }
}

function drawMinimap(currentSec = ws?.getCurrentTime() || 0) {
  const canvas = document.getElementById("minimap-canvas");
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(300, Math.floor(rect.width * dpr));
  const height = Math.floor(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#090e1a";
  ctx.fillRect(0, 0, width, height);

  const duration = getDuration();
  const bins = state.analysis?.waveform?.bins || [];
  if (bins.length > 0) {
    const midY = height / 2;
    ctx.fillStyle = "rgba(56, 189, 248, 0.42)";
    const step = Math.max(1, Math.floor(bins.length / width));
    for (let i = 0; i < bins.length; i += step) {
      const b = bins[i];
      const x = (b.start_sec / duration) * width;
      const top = midY - b.max * (height * 0.46);
      const bottom = midY - b.min * (height * 0.46);
      ctx.fillRect(
        x,
        top,
        Math.max(1, (width / bins.length) * step),
        Math.max(1, bottom - top),
      );
    }
  }

  for (const r of state.annotations?.regions || []) {
    const x1 = (r.start_sec / duration) * width;
    const x2 = (r.end_sec / duration) * width;
    ctx.fillStyle = hexToRgba(r.color || "#38bdf8", 0.28);
    ctx.fillRect(x1, 0, Math.max(2, x2 - x1), height);
  }

  if (state.loopInSec !== null && state.loopOutSec !== null) {
    const lx1 = (state.loopInSec / duration) * width;
    const lx2 = (state.loopOutSec / duration) * width;
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2 * dpr;
    ctx.strokeRect(lx1, 1, Math.max(2, lx2 - lx1), height - 2);
  }

  if (ws) {
    try {
      const wrapper = ws.getWrapper();
      const scrollEl = wrapper?.parentElement;
      if (wrapper && scrollEl && wrapper.scrollWidth > 0) {
        const startRatio = scrollEl.scrollLeft / wrapper.scrollWidth;
        const endRatio =
          (scrollEl.scrollLeft + scrollEl.clientWidth) / wrapper.scrollWidth;
        const vx = startRatio * width;
        const vw = Math.max(4, (endRatio - startRatio) * width);
        ctx.strokeStyle = "rgba(248, 250, 252, 0.65)";
        ctx.lineWidth = 1.2 * dpr;
        ctx.strokeRect(vx, 1, vw, height - 2);
      }
    } catch {
      // Ignore before WaveSurfer ready
    }
  }

  const px = (currentSec / duration) * width;
  ctx.strokeStyle = "#f43f5e";
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, height);
  ctx.stroke();
}

function ensureOverlayCanvas() {
  if (overlayCanvas) return overlayCanvas;
  const stage = document.getElementById("waveform-stage");
  overlayCanvas = document.createElement("canvas");
  overlayCanvas.style.position = "absolute";
  overlayCanvas.style.left = "0";
  overlayCanvas.style.top = "0";
  overlayCanvas.style.width = "100%";
  overlayCanvas.style.height = "158px";
  overlayCanvas.style.pointerEvents = "none";
  overlayCanvas.style.zIndex = "4";
  stage.appendChild(overlayCanvas);
  return overlayCanvas;
}

function getVisibleTimeWindow() {
  const duration = getDuration();
  if (!ws) return { startSec: 0, endSec: duration, clientWidth: 1000 };
  try {
    const wrapper = ws.getWrapper();
    const scrollEl = wrapper?.parentElement;
    if (wrapper && scrollEl && wrapper.scrollWidth > 0) {
      const startSec = (scrollEl.scrollLeft / wrapper.scrollWidth) * duration;
      const endSec =
        ((scrollEl.scrollLeft + scrollEl.clientWidth) / wrapper.scrollWidth) *
        duration;
      return {
        startSec,
        endSec,
        clientWidth: scrollEl.clientWidth,
      };
    }
  } catch {
    // Fallback
  }
  return { startSec: 0, endSec: duration, clientWidth: 1000 };
}

function drawCandidateOverlay() {
  const canvas = ensureOverlayCanvas();
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(100, Math.floor(rect.width * dpr));
  const height = Math.max(60, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  if (!state.analysis) return;

  const { startSec, endSec } = getVisibleTimeWindow();
  const span = Math.max(0.001, endSec - startSec);
  const xForSec = (t) => ((t - startSec) / span) * width;

  if (state.loopInSec !== null) {
    const ix = xForSec(state.loopInSec);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(ix, 0);
    ctx.lineTo(ix, height);
    ctx.stroke();
  }
  if (state.loopOutSec !== null) {
    const ox = xForSec(state.loopOutSec);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, height);
    ctx.stroke();
  }

  if (state.showCandOnsets && state.analysis.onsets) {
    ctx.strokeStyle = "rgba(56, 189, 248, 0.42)";
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    for (const o of state.analysis.onsets) {
      if (o.time_sec < startSec || o.time_sec > endSec) continue;
      if (o.onset_strength < state.onsetThreshold) continue;
      const x = xForSec(o.time_sec);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 18 * dpr);
      ctx.moveTo(x, height - 18 * dpr);
      ctx.lineTo(x, height);
    }
    ctx.stroke();
  }

  if (state.showCandBeats && state.analysis.beats) {
    ctx.save();
    ctx.strokeStyle = "rgba(245, 158, 11, 0.48)";
    ctx.lineWidth = 1.2 * dpr;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.beginPath();
    for (const b of state.analysis.beats) {
      if (b.time_sec < startSec || b.time_sec > endSec) continue;
      const x = xForSec(b.time_sec);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    ctx.stroke();
    ctx.restore();
  }

  if (state.showCandEnergy) {
    if (state.analysis.energyShifts) {
      ctx.save();
      ctx.strokeStyle = "rgba(236, 72, 153, 0.65)";
      ctx.lineWidth = 1.4 * dpr;
      ctx.setLineDash([2 * dpr, 3 * dpr]);
      ctx.beginPath();
      for (const e of state.analysis.energyShifts) {
        if (e.time_sec < startSec || e.time_sec > endSec) continue;
        const x = xForSec(e.time_sec);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      ctx.stroke();
      ctx.restore();
    }

    if (state.analysis.energyFrames?.length) {
      ctx.save();
      ctx.strokeStyle = "rgba(34, 197, 94, 0.7)";
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      let started = false;
      for (const f of state.analysis.energyFrames) {
        if (f.time_sec < startSec - 0.2 || f.time_sec > endSec + 0.2) continue;
        const x = xForSec(f.time_sec);
        const y = height - Math.min(1, f.rms * 2.1) * (height * 0.85);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}

function addPointMarker({
  timeSec,
  category = "beat",
  label = "",
  originCandidate = null,
  status = "confirmed",
  note = "",
}) {
  pushUndoSnapshot();
  markEdited();
  const snapped = originCandidate
    ? {
        time_sec: Number(originCandidate.time_sec.toFixed(6)),
        candidate: originCandidate,
      }
    : maybeSnapTime(timeSec);
  const id = allocateMarkerId(state.annotations);
  const catMeta =
    POINT_CATEGORIES.find((c) => c.value === category) || POINT_CATEGORIES[1];
  const cand = originCandidate || snapped.candidate || null;

  const newMarker = {
    id,
    kind: "point",
    category,
    label: label || (category === "downbeat" ? `Bar (${id})` : id),
    color: catMeta.color,
    time_sec: snapped.time_sec,
    source: "human",
    origin_candidate_id: null,
    origin_analysis_run_id: null,
    origin_analysis_sha256: null,
    origin_candidate_time_sec: null,
    origin_candidate_sample_index: null,
    status,
    linked_shots: [],
    note,
    script_idea: "",
    agent_comment: "",
    agent_status: "none",
    agent_reply: "",
    lyric_hint: "",
  };
  applyCandidateProvenance(
    newMarker,
    cand,
    state.analysis?.summary,
    state.annotations?.audio_asset,
  );

  state.annotations.markers.push(newMarker);
  state.annotations.markers.sort((a, b) => a.time_sec - b.time_sec);
  selectItem("point", id);
  refreshAllViews();
  scheduleAutoSave();
}

function addRegion({
  startSec,
  endSec,
  idOverride = null,
  category = "section",
  status = "candidate",
  label = "",
  note = "",
  scriptIdea = "",
  agentComment = "",
}) {
  pushUndoSnapshot();
  markEdited();
  const sSnap = maybeSnapTime(startSec);
  const eSnap = maybeSnapTime(endSec);
  const id = idOverride || allocateRegionId(state.annotations);
  const catMeta =
    REGION_CATEGORIES.find((c) => c.value === category) || REGION_CATEGORIES[0];

  const newRegion = {
    id,
    kind: "region",
    category,
    label: label || `${id} Section`,
    color: catMeta.color,
    start_sec: sSnap.time_sec,
    end_sec: Math.min(
      getDuration(),
      Math.max(sSnap.time_sec + 0.2, eSnap.time_sec),
    ),
    source: "human",
    status,
    linked_shots: [],
    note,
    script_idea: scriptIdea,
    agent_comment: agentComment,
    agent_status: agentComment ? "open" : "none",
    agent_reply: "",
    lyric_hint: "",
  };

  state.annotations.regions.push(newRegion);
  state.annotations.regions.sort((a, b) => a.start_sec - b.start_sec);
  selectItem("region", id);
  refreshAllViews();
  scheduleAutoSave();
}

function selectItem(kind, id) {
  state.selectedKind = kind;
  state.selectedId = id;
  renderLists();
  renderInspector();
  syncWaveSurferRegions();
}

function getSelectedItem() {
  if (!state.annotations || !state.selectedId) return null;
  if (state.selectedKind === "point") {
    return (
      state.annotations.markers.find((m) => m.id === state.selectedId) || null
    );
  }
  if (state.selectedKind === "region") {
    return (
      state.annotations.regions.find((r) => r.id === state.selectedId) || null
    );
  }
  return null;
}

function createTagSpan(text, extraClass = "") {
  const span = document.createElement("span");
  span.className = `tag ${extraClass}`.trim();
  span.textContent = text;
  return span;
}

function renderLists() {
  if (!state.annotations) return;
  document.getElementById("count-regions").textContent = String(
    state.annotations.regions.length,
  );
  document.getElementById("count-markers").textContent = String(
    state.annotations.markers.length,
  );

  const regQuery = document
    .getElementById("filter-regions")
    .value.trim()
    .toLowerCase();
  const regContainer = document.getElementById("regions-list");
  regContainer.replaceChildren();

  for (const r of state.annotations.regions) {
    const hay =
      `${r.id} ${r.label} ${r.category} ${r.note} ${r.script_idea} ${r.agent_comment}`.toLowerCase();
    if (regQuery && !hay.includes(regQuery)) continue;

    const card = document.createElement("div");
    card.className = `list-card ${state.selectedKind === "region" && state.selectedId === r.id ? "selected" : ""}`;
    card.style.borderLeftColor = r.color || "#38bdf8";

    const top = document.createElement("div");
    top.className = "list-card-top";
    const title = document.createElement("div");
    title.className = "list-card-title";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = `${r.id} · ${r.label}`;
    title.append(nameSpan, createTagSpan(r.status, r.status));
    if (r.agent_status === "open") {
      title.appendChild(createTagSpan("待Agent处理", "open"));
    }

    const timeSpan = document.createElement("span");
    timeSpan.className = "list-card-time";
    timeSpan.textContent = `${formatTime(r.start_sec)} – ${formatTime(r.end_sec)} (${(r.end_sec - r.start_sec).toFixed(2)}s | [${toVideoFrame(r.start_sec)}, ${toVideoFrame(r.end_sec)}))`;

    top.append(title, timeSpan);

    const sub = document.createElement("div");
    sub.className = "list-card-sub";
    sub.textContent =
      r.script_idea ||
      r.agent_comment ||
      r.note ||
      "（点击编辑段落脚本、备注或给 Agent 留言）";

    card.append(top, sub);
    card.addEventListener("click", () => {
      selectItem("region", r.id);
      ws?.setTime(r.start_sec);
      updateTopReadouts(r.start_sec);
    });
    regContainer.appendChild(card);
  }

  const mkQuery = document
    .getElementById("filter-markers")
    .value.trim()
    .toLowerCase();
  const mkCat = document.getElementById("filter-marker-category").value;
  const mkContainer = document.getElementById("markers-list");
  mkContainer.replaceChildren();

  for (const m of state.annotations.markers) {
    if (mkCat !== "all" && m.category !== mkCat) continue;
    const hay =
      `${m.id} ${m.label} ${m.category} ${m.note} ${m.script_idea} ${m.agent_comment}`.toLowerCase();
    if (mkQuery && !hay.includes(mkQuery)) continue;

    const card = document.createElement("div");
    card.className = `list-card ${state.selectedKind === "point" && state.selectedId === m.id ? "selected" : ""}`;
    card.style.borderLeftColor = m.color || "#f59e0b";

    const top = document.createElement("div");
    top.className = "list-card-top";
    const title = document.createElement("div");
    title.className = "list-card-title";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = `${m.id} · ${m.label}`;
    title.append(
      nameSpan,
      createTagSpan(m.category),
      createTagSpan(m.status, m.status),
    );
    if (m.agent_status === "open") {
      title.appendChild(createTagSpan("待Agent处理", "open"));
    }

    const timeSpan = document.createElement("span");
    timeSpan.className = "list-card-time";
    timeSpan.textContent = `${formatTime(m.time_sec)} (${m.time_sec.toFixed(3)}s | F${toVideoFrame(m.time_sec)})`;

    top.append(title, timeSpan);

    const sub = document.createElement("div");
    sub.className = "list-card-sub";
    sub.textContent =
      m.script_idea ||
      m.agent_comment ||
      m.note ||
      (m.origin_candidate_id
        ? `源自自动候选 ${m.origin_candidate_id}`
        : "手动打点");

    card.append(top, sub);
    card.addEventListener("click", () => {
      selectItem("point", m.id);
      ws?.setTime(m.time_sec);
      updateTopReadouts(m.time_sec);
    });
    mkContainer.appendChild(card);
  }
}

function renderInspector() {
  const item = getSelectedItem();
  const emptyEl = document.getElementById("inspector-empty");
  const formEl = document.getElementById("inspector-form");
  const badgeEl = document.getElementById("inspector-badge");

  if (!item) {
    emptyEl.classList.remove("hidden");
    formEl.classList.add("hidden");
    badgeEl.textContent = "未选中";
    return;
  }

  emptyEl.classList.add("hidden");
  formEl.classList.remove("hidden");
  badgeEl.textContent =
    item.kind === "point"
      ? `时间点标记 · ${item.id}`
      : `区间/段落 · ${item.id}`;

  const catSelect = document.getElementById("insp-category");
  catSelect.replaceChildren();
  const categories =
    item.kind === "point" ? POINT_CATEGORIES : REGION_CATEGORIES;
  for (const c of categories) {
    const opt = document.createElement("option");
    opt.value = c.value;
    opt.textContent = c.label;
    catSelect.appendChild(opt);
  }
  if (!categories.some((c) => c.value === item.category)) {
    const customOpt = document.createElement("option");
    customOpt.value = item.category;
    customOpt.textContent = item.category;
    catSelect.appendChild(customOpt);
  }

  document.getElementById("insp-id").value = item.id;
  document.getElementById("insp-label").value = item.label || "";
  catSelect.value = item.category;
  document.getElementById("insp-status").value = item.status || "candidate";
  document.getElementById("insp-color").value = item.color || "#38bdf8";
  document.getElementById("insp-shots").value = (item.linked_shots || []).join(
    ", ",
  );

  const pointRow = document.getElementById("insp-point-time-row");
  const regionRow = document.getElementById("insp-region-time-row");
  if (item.kind === "point") {
    pointRow.classList.remove("hidden");
    regionRow.classList.add("hidden");
    document.getElementById("insp-time-sec").value = item.time_sec.toFixed(3);
    const originInfo = item.origin_candidate_id
      ? `${item.origin_candidate_id} (${item.origin_analysis_run_id || "run"})`
      : "人工新建";
    document.getElementById("insp-meta-info").textContent =
      `预览视频帧: F${toVideoFrame(item.time_sec)} | 来源: ${originInfo}`;
  } else {
    pointRow.classList.add("hidden");
    regionRow.classList.remove("hidden");
    document.getElementById("insp-start-sec").value =
      item.start_sec.toFixed(3);
    document.getElementById("insp-end-sec").value = item.end_sec.toFixed(3);
    document.getElementById("insp-meta-info").textContent =
      `时长: ${(item.end_sec - item.start_sec).toFixed(3)}s | 预览帧区间: [${toVideoFrame(item.start_sec)}, ${toVideoFrame(item.end_sec)})`;
  }

  document.getElementById("insp-note").value = item.note || "";
  document.getElementById("insp-script").value = item.script_idea || "";
  document.getElementById("insp-agent-comment").value =
    item.agent_comment || "";
  document.getElementById("insp-agent-status").value =
    item.agent_status || "none";
  document.getElementById("insp-agent-reply").textContent =
    item.agent_reply ||
    "（尚无 Agent 回复；保存后可让 Agent 读取 local/annotations/agent-brief.md 并写回建议）";
  document.getElementById("insp-lyric-hint").value = item.lyric_hint || "";
}

function renderGlobalTab() {
  if (!state.annotations) return;
  document.getElementById("global-concept").value =
    state.annotations.global_notes?.overall_concept || "";
  document.getElementById("global-style").value =
    state.annotations.global_notes?.visual_style_notes || "";
  document.getElementById("global-agent-instructions").value =
    state.annotations.global_notes?.instructions_for_agent || "";
  document.getElementById("agent-brief-preview").textContent =
    state.agentBriefMarkdown || "";
}

function updateBpmCalcDisplay() {
  const s = Number(document.getElementById("grid-start-sec").value);
  const e = Number(document.getElementById("grid-end-sec").value);
  const intervals = Number(document.getElementById("grid-beat-count").value);
  const outEl = document.getElementById("grid-calc-result");

  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s || intervals < 1) {
    outEl.textContent = "终点秒数必须大于起点秒数，且拍间间隔数 N 至少为 1。";
    return;
  }
  const span = e - s;
  const ibi = span / intervals;
  const bpm = 60 / ibi;
  outEl.textContent = `区间时长: ${span.toFixed(3)}s | 拍间间隔数 N=${intervals} (共生成 ${intervals + 1} 个候选点) | 单拍间隔: ${(ibi * 1000).toFixed(1)}ms | 测算局部 BPM: ${bpm.toFixed(2)} BPM（默认状态: candidate）`;
}

function refreshAllViews() {
  renderLists();
  renderInspector();
  renderGlobalTab();
  syncWaveSurferRegions();
  updateTopReadouts();
}

function setSaveStatus(text, isError = false) {
  const el = document.getElementById("save-status");
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? "#f87171" : "#94a3b8";
}

function scheduleAutoSave(force = false) {
  setSaveStatus("待保存...");
  if (state.saveTimer) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    state.saveTimer = null;
    saveAnnotations(force);
  }, 500);
}

export async function saveAnnotations(force = false, customFetch = fetch) {
  if (!state.annotations) return { status: "noop" };
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }
  return executeSaveFlow(state, {
    force,
    customFetch,
    onStatus: (text, isError) => setSaveStatus(text, isError),
    onAlert: (msg) => {
      if (typeof window !== "undefined" && window.alert) {
        window.alert(msg);
      }
    },
    onConfirmConflict: () =>
      typeof window !== "undefined" && window.confirm
        ? window.confirm(
            "检测到本地文件已被外部（如 Agent）修改！\n点击「确定」用当前页面内容覆盖本地文件；\n点击「取消」放弃未保存修改并载入最新外部修改。",
          )
        : false,
    onApplyServerState: (latest) => applyServerState(latest),
    onBriefUpdated: (md) => {
      if (typeof document !== "undefined") {
        const briefEl = document.getElementById("agent-brief-preview");
        if (briefEl) briefEl.textContent = md;
      }
    },
    onScheduleFollowUp: (nextForce) => scheduleAutoSave(nextForce),
  });
}

export async function reloadAnnotations(customFetch = fetch) {
  return executeReloadFlow(state, {
    customFetch,
    onConfirmDirty: () =>
      typeof window !== "undefined" && window.confirm
        ? window.confirm(
            "当前页面有未保存的编辑内容，重新载入将丢弃未保存内容，确定继续吗？",
          )
        : false,
    onClearTimer: () => {
      if (state.saveTimer) {
        clearTimeout(state.saveTimer);
        state.saveTimer = null;
      }
    },
    onStatus: (text, isError) => setSaveStatus(text, isError),
    onApplyServerState: (latest) => applyServerState(latest),
  });
}

export function applyServerState(serverState) {
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }
  applyServerStateToModel(state, serverState);
  updateUndoRedoButtons();

  if (typeof document === "undefined") return;

  const beatsEl = document.getElementById("count-cand-beats");
  if (beatsEl) beatsEl.textContent = String(state.analysis?.beats?.length || 0);
  const onsetsEl = document.getElementById("count-cand-onsets");
  if (onsetsEl)
    onsetsEl.textContent = String(state.analysis?.onsets?.length || 0);
  const energyEl = document.getElementById("count-cand-energy");
  if (energyEl)
    energyEl.textContent = String(state.analysis?.energyShifts?.length || 0);
  const fpsEl = document.getElementById("input-fps");
  if (fpsEl)
    fpsEl.value = String(state.annotations.preview_mapping?.preview_fps ?? 30);
  const offsetEl = document.getElementById("input-offset");
  if (offsetEl)
    offsetEl.value = String(
      state.annotations.preview_mapping?.audio_offset_seconds ?? 0,
    );

  refreshAllViews();
  if (state.audioHashMismatch) {
    setSaveStatus("⚠ 音源 SHA-256 与标注记录不匹配（已禁止自动覆盖）", true);
  }
}

function buildPeaksFromEnvelope(waveform) {
  if (!waveform?.bins?.length) return undefined;
  const peaks = [];
  for (const b of waveform.bins) {
    peaks.push(b.min, b.max);
  }
  return [peaks];
}

async function initWaveSurfer() {
  regionsPlugin = RegionsPlugin.create();
  const timelinePlugin = TimelinePlugin.create({
    container: "#waveform-timeline",
    primaryLabelInterval: 5,
    secondaryLabelInterval: 1,
    style: {
      fontSize: "11px",
      color: "#94a3b8",
    },
  });

  const peaks = buildPeaksFromEnvelope(state.analysis?.waveform);
  const duration = getDuration();

  ws = WaveSurfer.create({
    container: "#waveform-container",
    url: "/api/audio",
    peaks,
    duration,
    height: 158,
    waveColor: "#334155",
    progressColor: "#0284c7",
    cursorColor: "#f43f5e",
    cursorWidth: 2,
    minPxPerSec: state.zoomPxPerSec,
    autoScroll: true,
    autoCenter: true,
    normalize: false,
    plugins: [regionsPlugin, timelinePlugin],
  });

  ws.on("ready", () => {
    syncWaveSurferRegions();
    updateTopReadouts(0);
  });

  ws.on("timeupdate", (currentSec) => {
    checkClickTrackAndLoop(currentSec);
    updateTopReadouts(currentSec);
  });

  ws.on("scroll", () => {
    drawMinimap();
    drawCandidateOverlay();
  });

  ws.on("zoom", () => {
    drawMinimap();
    drawCandidateOverlay();
  });

  ws.on("play", () => {
    document.getElementById("btn-play").textContent = "⏸ 暂停";
  });

  ws.on("pause", () => {
    document.getElementById("btn-play").textContent = "▶ 播放";
  });

  ws.on("interaction", (newTimeSec) => {
    updateTopReadouts(newTimeSec);
    const nearest = findNearestCandidate(newTimeSec, 0.25);
    const btnAdopt = document.getElementById("btn-adopt-nearest");
    if (nearest) {
      btnAdopt.textContent = `✓ 采纳 ${nearest.id} (${nearest.time_sec.toFixed(3)}s)`;
    } else {
      btnAdopt.textContent = "✓ 采纳最近候选拍";
    }
  });

  document
    .getElementById("waveform-container")
    .addEventListener("click", (e) => {
      if (!e.altKey) return;
      const now = ws?.getCurrentTime() || 0;
      const nearest = findNearestCandidate(now, 0.12);
      if (nearest) {
        addPointMarker({
          timeSec: nearest.time_sec,
          category: nearest.kind === "beat" ? "beat" : "accent",
          originCandidate: nearest,
          status: "confirmed",
          note: `Alt+单击采纳自 ${nearest.id}`,
        });
      }
    });

  regionsPlugin.on("region-clicked", (reg, e) => {
    e.stopPropagation();
    if (reg.id.startsWith("pt_")) {
      const id = reg.id.slice(3);
      selectItem("point", id);
    } else if (reg.id.startsWith("reg_")) {
      const id = reg.id.slice(4);
      selectItem("region", id);
    }
  });

  regionsPlugin.on("region-updated", (reg) => {
    pushUndoSnapshot();
    markEdited();
    if (reg.id.startsWith("pt_")) {
      const id = reg.id.slice(3);
      const item = state.annotations.markers.find((m) => m.id === id);
      if (item) {
        const snapped = maybeSnapTime(reg.start);
        item.time_sec = snapped.time_sec;
        if (snapped.candidate) {
          applyCandidateProvenance(
            item,
            snapped.candidate,
            state.analysis?.summary,
            state.annotations?.audio_asset,
          );
        } else {
          clearCandidateProvenance(item);
        }
        state.annotations.markers.sort((a, b) => a.time_sec - b.time_sec);
        selectItem("point", id);
        refreshAllViews();
        scheduleAutoSave();
      }
    } else if (reg.id.startsWith("reg_")) {
      const id = reg.id.slice(4);
      const item = state.annotations.regions.find((r) => r.id === id);
      if (item) {
        const sSnap = maybeSnapTime(reg.start);
        const eSnap = maybeSnapTime(reg.end);
        item.start_sec = sSnap.time_sec;
        item.end_sec = Math.min(
          getDuration(),
          Math.max(sSnap.time_sec + 0.1, eSnap.time_sec),
        );
        state.annotations.regions.sort((a, b) => a.start_sec - b.start_sec);
        selectItem("region", id);
        refreshAllViews();
        scheduleAutoSave();
      }
    }
  });
}

function updateLoopUi() {
  const btn = document.getElementById("btn-toggle-loop");
  const label = document.getElementById("loop-range-label");
  btn.classList.toggle("active", state.loopEnabled);
  btn.textContent = `🔁 循环: ${state.loopEnabled ? "开" : "关"}`;
  if (state.loopInSec !== null && state.loopOutSec !== null) {
    label.textContent = `${formatTime(state.loopInSec)} – ${formatTime(state.loopOutSec)} (${(state.loopOutSec - state.loopInSec).toFixed(2)}s)`;
  } else if (state.loopInSec !== null) {
    label.textContent = `入点 ${formatTime(state.loopInSec)} – 待设出点`;
  } else {
    label.textContent = "未设循环";
  }
  drawMinimap();
  drawCandidateOverlay();
}

function bindEvents() {
  document.getElementById("btn-play").addEventListener("click", () => {
    ws?.playPause();
  });

  document.getElementById("btn-stop").addEventListener("click", () => {
    ws?.stop();
    updateTopReadouts(0);
  });

  document.getElementById("select-rate").addEventListener("change", (e) => {
    const rate = Number(e.target.value);
    ws?.setPlaybackRate(rate, true);
  });

  document.getElementById("input-fps").addEventListener("change", (e) => {
    const raw = Number(e.target.value);
    if (!Number.isFinite(raw) || raw < 1 || raw > 240) {
      e.target.value = String(
        state.annotations.preview_mapping.preview_fps || 30,
      );
      return;
    }
    pushUndoSnapshot();
    markEdited();
    state.annotations.preview_mapping.preview_fps = Math.round(raw);
    refreshAllViews();
    scheduleAutoSave();
  });

  document.getElementById("input-offset").addEventListener("change", (e) => {
    const raw = Number(e.target.value);
    if (!Number.isFinite(raw)) {
      e.target.value = String(
        state.annotations.preview_mapping.audio_offset_seconds || 0,
      );
      return;
    }
    pushUndoSnapshot();
    markEdited();
    state.annotations.preview_mapping.audio_offset_seconds = raw;
    refreshAllViews();
    scheduleAutoSave();
  });

  document.getElementById("btn-set-in").addEventListener("click", () => {
    state.loopInSec = Number((ws?.getCurrentTime() || 0).toFixed(3));
    if (state.loopOutSec !== null && state.loopOutSec <= state.loopInSec) {
      state.loopOutSec = Number(
        Math.min(getDuration(), state.loopInSec + 15).toFixed(3),
      );
    }
    updateLoopUi();
  });

  document.getElementById("btn-set-out").addEventListener("click", () => {
    const now = Number((ws?.getCurrentTime() || 0).toFixed(3));
    if (state.loopInSec === null || now <= state.loopInSec) {
      state.loopInSec = Math.max(0, Number((now - 10).toFixed(3)));
    }
    state.loopOutSec = now;
    state.loopEnabled = true;
    updateLoopUi();
  });

  document.getElementById("btn-toggle-loop").addEventListener("click", () => {
    if (state.loopInSec === null || state.loopOutSec === null) {
      const now = ws?.getCurrentTime() || 0;
      state.loopInSec = Number(now.toFixed(3));
      state.loopOutSec = Number(Math.min(getDuration(), now + 15).toFixed(3));
    }
    state.loopEnabled = !state.loopEnabled;
    updateLoopUi();
  });

  document.getElementById("btn-toggle-click").addEventListener("click", (e) => {
    state.clickTrackEnabled = !state.clickTrackEnabled;
    e.currentTarget.classList.toggle("active", state.clickTrackEnabled);
    e.currentTarget.textContent = `🔔 节拍音: ${state.clickTrackEnabled ? "开" : "关"}`;
  });

  document.getElementById("btn-toggle-snap").addEventListener("click", (e) => {
    state.snapEnabled = !state.snapEnabled;
    e.currentTarget.classList.toggle("active", state.snapEnabled);
    e.currentTarget.textContent = `🧲 磁吸: ${state.snapEnabled ? "开" : "关"}`;
  });

  document.getElementById("chk-layer-beats").addEventListener("change", (e) => {
    state.showCandBeats = e.target.checked;
    drawCandidateOverlay();
  });

  document
    .getElementById("chk-layer-onsets")
    .addEventListener("change", (e) => {
      state.showCandOnsets = e.target.checked;
      drawCandidateOverlay();
    });

  document
    .getElementById("slider-onset-thresh")
    .addEventListener("input", (e) => {
      state.onsetThreshold = Number(e.target.value);
      document.getElementById("label-onset-thresh").textContent =
        state.onsetThreshold.toFixed(1);
      drawCandidateOverlay();
    });

  document
    .getElementById("chk-layer-energy")
    .addEventListener("change", (e) => {
      state.showCandEnergy = e.target.checked;
      drawCandidateOverlay();
    });

  document
    .getElementById("chk-click-candidates")
    .addEventListener("change", (e) => {
      state.clickCandidatesEnabled = e.target.checked;
    });

  document.getElementById("slider-zoom").addEventListener("input", (e) => {
    state.zoomPxPerSec = Number(e.target.value);
    document.getElementById("label-zoom").textContent =
      `${state.zoomPxPerSec} px/s`;
    ws?.zoom(state.zoomPxPerSec);
  });

  document.getElementById("btn-add-downbeat").addEventListener("click", () => {
    addPointMarker({
      timeSec: ws?.getCurrentTime() || 0,
      category: "downbeat",
    });
  });

  document.getElementById("btn-add-marker").addEventListener("click", () => {
    addPointMarker({
      timeSec: ws?.getCurrentTime() || 0,
      category: "beat",
    });
  });

  document.getElementById("btn-adopt-nearest").addEventListener("click", () => {
    const now = ws?.getCurrentTime() || 0;
    const nearest = findNearestCandidate(now, 1.0);
    if (!nearest) {
      window.alert("附近 1 秒内未找到候选拍点或起音。");
      return;
    }
    addPointMarker({
      timeSec: nearest.time_sec,
      category: nearest.kind === "beat" ? "beat" : "accent",
      originCandidate: nearest,
      status: "confirmed",
      note: `采纳自候选 ${nearest.id}`,
    });
  });

  document.getElementById("btn-add-region").addEventListener("click", () => {
    const now = ws?.getCurrentTime() || 0;
    const startSec =
      state.loopInSec !== null && state.loopOutSec !== null
        ? state.loopInSec
        : now;
    const endSec =
      state.loopInSec !== null && state.loopOutSec !== null
        ? state.loopOutSec
        : Math.min(getDuration(), now + 12);
    addRegion({ startSec, endSec, category: "section", status: "candidate" });
  });

  document.getElementById("btn-quick-15s").addEventListener("click", () => {
    const existing = state.annotations.regions.find(
      (r) => r.id === "CLIP_01" || r.category === "representative_clip",
    );
    if (existing) {
      selectItem("region", existing.id);
      state.loopInSec = existing.start_sec;
      state.loopOutSec = existing.end_sec;
      state.loopEnabled = true;
      updateLoopUi();
      ws?.setTime(existing.start_sec);
      return;
    }
    addRegion({
      startSec: 0.0,
      endSec: 15.0,
      idOverride: "CLIP_01",
      category: "representative_clip",
      status: "candidate",
      label: "CLIP_01 15s 验证区间草稿",
      note: "待试听后调整起止秒数并确认为 confirmed",
      scriptIdea: "",
      agentComment: "",
    });
    state.loopInSec = 0.0;
    state.loopOutSec = 15.0;
    state.loopEnabled = true;
    updateLoopUi();
  });

  const minimap = document.getElementById("minimap-canvas");
  let draggingMinimap = false;
  const seekFromMinimap = (e) => {
    const rect = minimap.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)),
    );
    const targetSec = ratio * getDuration();
    ws?.setTime(targetSec);
    updateTopReadouts(targetSec);
  };
  minimap.addEventListener("mousedown", (e) => {
    draggingMinimap = true;
    seekFromMinimap(e);
  });
  window.addEventListener("mousemove", (e) => {
    if (draggingMinimap) seekFromMinimap(e);
  });
  window.addEventListener("mouseup", () => {
    draggingMinimap = false;
  });

  for (const btn of document.querySelectorAll(".tab-btn")) {
    btn.addEventListener("click", () => {
      for (const b of document.querySelectorAll(".tab-btn"))
        b.classList.remove("active");
      for (const c of document.querySelectorAll(".tab-content"))
        c.classList.remove("active");
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
      updateBpmCalcDisplay();
    });
  }

  document
    .getElementById("filter-regions")
    .addEventListener("input", renderLists);
  document
    .getElementById("filter-markers")
    .addEventListener("input", renderLists);
  document
    .getElementById("filter-marker-category")
    .addEventListener("change", renderLists);

  const updateSelectedFromForm = () => {
    const item = getSelectedItem();
    if (!item) return;
    pushUndoSnapshot();
    markEdited();

    const newId = document.getElementById("insp-id").value.trim() || item.id;
    const list =
      item.kind === "point"
        ? state.annotations.markers
        : state.annotations.regions;
    if (newId !== item.id && list.some((other) => other.id === newId)) {
      setSaveStatus(`ID ${newId} 已存在`, true);
      return;
    }
    item.id = newId;
    state.selectedId = newId;
    item.label = document.getElementById("insp-label").value;
    item.category = document.getElementById("insp-category").value;
    item.status = document.getElementById("insp-status").value;
    item.color = document.getElementById("insp-color").value;
    item.linked_shots = document
      .getElementById("insp-shots")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (item.kind === "point") {
      const rawTime = Number(document.getElementById("insp-time-sec").value);
      if (
        Number.isFinite(rawTime) &&
        rawTime >= 0 &&
        rawTime <= getDuration()
      ) {
        const nextTime = Number(rawTime.toFixed(6));
        if (Math.abs(nextTime - item.time_sec) > 0.0005) {
          item.time_sec = nextTime;
          clearCandidateProvenance(item);
        }
        state.annotations.markers.sort((a, b) => a.time_sec - b.time_sec);
      }
    } else {
      const s = Number(document.getElementById("insp-start-sec").value);
      const e = Number(document.getElementById("insp-end-sec").value);
      if (
        Number.isFinite(s) &&
        Number.isFinite(e) &&
        s >= 0 &&
        e <= getDuration() &&
        e > s
      ) {
        item.start_sec = Number(s.toFixed(6));
        item.end_sec = Number(e.toFixed(6));
        state.annotations.regions.sort((a, b) => a.start_sec - b.start_sec);
      }
    }

    item.note = document.getElementById("insp-note").value;
    item.script_idea = document.getElementById("insp-script").value;
    item.agent_comment = document.getElementById("insp-agent-comment").value;
    item.agent_status = document.getElementById("insp-agent-status").value;
    if (item.agent_comment && item.agent_status === "none") {
      item.agent_status = "open";
      document.getElementById("insp-agent-status").value = "open";
    }
    item.lyric_hint = document.getElementById("insp-lyric-hint").value;

    renderLists();
    syncWaveSurferRegions();
    scheduleAutoSave();
  };

  for (const id of [
    "insp-id",
    "insp-label",
    "insp-category",
    "insp-status",
    "insp-color",
    "insp-shots",
    "insp-time-sec",
    "insp-start-sec",
    "insp-end-sec",
    "insp-note",
    "insp-script",
    "insp-agent-comment",
    "insp-agent-status",
    "insp-lyric-hint",
  ]) {
    document
      .getElementById(id)
      .addEventListener("input", updateSelectedFromForm);
  }

  for (const btn of document.querySelectorAll("[data-nudge]")) {
    btn.addEventListener("click", () => {
      const item = getSelectedItem();
      if (!item || item.kind !== "point") return;
      pushUndoSnapshot();
      markEdited();
      const delta = Number(btn.dataset.nudge);
      item.time_sec = Number(
        Math.max(0, Math.min(getDuration(), item.time_sec + delta)).toFixed(6),
      );
      clearCandidateProvenance(item);
      ws?.setTime(item.time_sec);
      refreshAllViews();
      scheduleAutoSave();
    });
  }

  document
    .getElementById("btn-insp-to-playhead")
    .addEventListener("click", () => {
      const item = getSelectedItem();
      if (!item || item.kind !== "point") return;
      pushUndoSnapshot();
      markEdited();
      item.time_sec = Number((ws?.getCurrentTime() || 0).toFixed(6));
      clearCandidateProvenance(item);
      refreshAllViews();
      scheduleAutoSave();
    });

  document.getElementById("btn-insp-snap").addEventListener("click", () => {
    const item = getSelectedItem();
    if (!item || item.kind !== "point") return;
    const nearest = findNearestCandidate(item.time_sec, 0.25);
    if (!nearest) return;
    pushUndoSnapshot();
    markEdited();
    item.time_sec = nearest.time_sec;
    applyCandidateProvenance(
      item,
      nearest,
      state.analysis?.summary,
      state.annotations?.audio_asset,
    );
    ws?.setTime(item.time_sec);
    refreshAllViews();
    scheduleAutoSave();
  });

  document
    .getElementById("btn-region-start-playhead")
    .addEventListener("click", () => {
      const item = getSelectedItem();
      if (!item || item.kind !== "region") return;
      const now = Number((ws?.getCurrentTime() || 0).toFixed(6));
      if (now >= item.end_sec) return;
      pushUndoSnapshot();
      markEdited();
      item.start_sec = now;
      refreshAllViews();
      scheduleAutoSave();
    });

  document
    .getElementById("btn-region-end-playhead")
    .addEventListener("click", () => {
      const item = getSelectedItem();
      if (!item || item.kind !== "region") return;
      const now = Number((ws?.getCurrentTime() || 0).toFixed(6));
      if (now > item.start_sec + 0.05) {
        pushUndoSnapshot();
        markEdited();
        item.end_sec = now;
        refreshAllViews();
        scheduleAutoSave();
      }
    });

  document.getElementById("btn-region-loop").addEventListener("click", () => {
    const item = getSelectedItem();
    if (!item || item.kind !== "region") return;
    state.loopInSec = item.start_sec;
    state.loopOutSec = item.end_sec;
    state.loopEnabled = true;
    updateLoopUi();
    ws?.setTime(item.start_sec);
    ws?.play();
  });

  document.getElementById("btn-delete-item").addEventListener("click", () => {
    deleteSelectedItem();
  });

  for (const [elId, key] of [
    ["global-concept", "overall_concept"],
    ["global-style", "visual_style_notes"],
    ["global-agent-instructions", "instructions_for_agent"],
  ]) {
    document.getElementById(elId).addEventListener("input", (e) => {
      pushUndoSnapshot();
      markEdited();
      state.annotations.global_notes[key] = e.target.value;
      scheduleAutoSave();
    });
  }

  for (const id of [
    "grid-start-sec",
    "grid-end-sec",
    "grid-beat-count",
    "grid-beats-per-bar",
  ]) {
    document
      .getElementById(id)
      .addEventListener("input", updateBpmCalcDisplay);
  }

  document.getElementById("btn-grid-use-in").addEventListener("click", () => {
    const item = getSelectedItem();
    const val =
      item?.kind === "point"
        ? item.time_sec
        : (state.loopInSec ?? (ws?.getCurrentTime() || 0));
    document.getElementById("grid-start-sec").value = Number(val).toFixed(3);
    updateBpmCalcDisplay();
  });

  document.getElementById("btn-grid-use-out").addEventListener("click", () => {
    const item = getSelectedItem();
    const val =
      item?.kind === "point"
        ? item.time_sec
        : (state.loopOutSec ?? (ws?.getCurrentTime() || 0));
    document.getElementById("grid-end-sec").value = Number(val).toFixed(3);
    updateBpmCalcDisplay();
  });

  document.getElementById("btn-generate-grid").addEventListener("click", () => {
    const s = Number(document.getElementById("grid-start-sec").value);
    const e = Number(document.getElementById("grid-end-sec").value);
    const intervals = Math.round(
      Number(document.getElementById("grid-beat-count").value),
    );
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s || intervals < 1) {
      return;
    }
    pushUndoSnapshot();
    markEdited();
    const ibi = (e - s) / intervals;
    const bpm = 60 / ibi;
    for (let i = 0; i <= intervals; i += 1) {
      const t = Number((s + i * ibi).toFixed(6));
      const id = allocateMarkerId(state.annotations);
      state.annotations.markers.push({
        id,
        kind: "point",
        category: "beat",
        label: `Grid ${i + 1}`,
        color: "#eab308",
        time_sec: t,
        source: "human",
        origin_candidate_id: null,
        origin_analysis_run_id: null,
        origin_analysis_sha256: null,
        origin_candidate_time_sec: null,
        origin_candidate_sample_index: null,
        status: "candidate",
        linked_shots: [],
        note: `均匀补拍候选 (${bpm.toFixed(2)} BPM, N=${intervals})，待人工听辨确认`,
        script_idea: "",
        agent_comment: "",
        agent_status: "none",
        agent_reply: "",
        lyric_hint: "",
      });
    }
    state.annotations.markers.sort((a, b) => a.time_sec - b.time_sec);
    refreshAllViews();
    scheduleAutoSave();
  });

  document.getElementById("btn-undo").addEventListener("click", performUndo);
  document.getElementById("btn-redo").addEventListener("click", performRedo);
  document
    .getElementById("btn-save")
    .addEventListener("click", () => saveAnnotations(false));
  document.getElementById("btn-reload").addEventListener("click", () => {
    reloadAnnotations();
  });

  const copyBrief = async () => {
    await saveAnnotations(false);
    await navigator.clipboard.writeText(state.agentBriefMarkdown || "");
    setSaveStatus("📋 已复制简报!");
  };
  document
    .getElementById("btn-copy-brief")
    .addEventListener("click", copyBrief);
  document
    .getElementById("btn-copy-brief-inline")
    .addEventListener("click", copyBrief);

  window.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    const isEditingText =
      tag === "input" || tag === "textarea" || tag === "select";

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveAnnotations(false);
      return;
    }
    if (
      !isEditingText &&
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "z"
    ) {
      e.preventDefault();
      performUndo();
      return;
    }
    if (
      !isEditingText &&
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "y"
    ) {
      e.preventDefault();
      performRedo();
      return;
    }

    if (isEditingText) return;

    if (e.code === "Space") {
      e.preventDefault();
      ws?.playPause();
    } else if (e.key.toLowerCase() === "m") {
      e.preventDefault();
      addPointMarker({ timeSec: ws?.getCurrentTime() || 0, category: "beat" });
    } else if (e.key.toLowerCase() === "b") {
      e.preventDefault();
      addPointMarker({
        timeSec: ws?.getCurrentTime() || 0,
        category: "downbeat",
      });
    } else if (e.key.toLowerCase() === "r") {
      e.preventDefault();
      document.getElementById("btn-add-region").click();
    } else if (e.key.toLowerCase() === "i") {
      e.preventDefault();
      document.getElementById("btn-set-in").click();
    } else if (e.key.toLowerCase() === "o") {
      e.preventDefault();
      document.getElementById("btn-set-out").click();
    } else if (e.key.toLowerCase() === "l") {
      e.preventDefault();
      document.getElementById("btn-toggle-loop").click();
    } else if (e.key.toLowerCase() === "k") {
      e.preventDefault();
      document.getElementById("btn-toggle-click").click();
    } else if (e.key.toLowerCase() === "s") {
      e.preventDefault();
      document.getElementById("btn-toggle-snap").click();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteSelectedItem();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const step = e.shiftKey ? 0.1 : e.altKey ? 0.001 : 0.01;
      const now = ws?.getCurrentTime() || 0;
      const next = Math.max(0, Math.min(getDuration(), now + dir * step));
      ws?.setTime(next);
      updateTopReadouts(next);
    }
  });

  window.addEventListener("resize", () => {
    drawMinimap();
    drawCandidateOverlay();
  });
}

function deleteSelectedItem() {
  if (!state.selectedId || !state.annotations) return;
  pushUndoSnapshot();
  markEdited();
  if (state.selectedKind === "point") {
    state.annotations.markers = state.annotations.markers.filter(
      (m) => m.id !== state.selectedId,
    );
  } else if (state.selectedKind === "region") {
    state.annotations.regions = state.annotations.regions.filter(
      (r) => r.id !== state.selectedId,
    );
  }
  state.selectedId = null;
  state.selectedKind = null;
  refreshAllViews();
  scheduleAutoSave();
}

function performUndo() {
  if (state.undoStack.length === 0) return;
  const currentSnap = JSON.stringify({
    id_counters: state.annotations.id_counters,
    markers: state.annotations.markers,
    regions: state.annotations.regions,
    global_notes: state.annotations.global_notes,
    preview_mapping: state.annotations.preview_mapping,
  });
  state.redoStack.push(currentSnap);
  const prev = JSON.parse(state.undoStack.pop());
  Object.assign(state.annotations, prev);
  markEdited();
  updateUndoRedoButtons();
  refreshAllViews();
  scheduleAutoSave();
}

function performRedo() {
  if (state.redoStack.length === 0) return;
  const currentSnap = JSON.stringify({
    id_counters: state.annotations.id_counters,
    markers: state.annotations.markers,
    regions: state.annotations.regions,
    global_notes: state.annotations.global_notes,
    preview_mapping: state.annotations.preview_mapping,
  });
  state.undoStack.push(currentSnap);
  const next = JSON.parse(state.redoStack.pop());
  Object.assign(state.annotations, next);
  markEdited();
  updateUndoRedoButtons();
  refreshAllViews();
  scheduleAutoSave();
}

async function bootstrap() {
  if (typeof document === "undefined") return;
  bindEvents();
  const res = await fetch("/api/state");
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    setSaveStatus(`加载失败: ${errBody.error || res.status}`, true);
    return;
  }
  const initial = await res.json();
  applyServerState(initial);
  await initWaveSurfer();
  updateBpmCalcDisplay();
}

if (typeof window !== "undefined" && document.getElementById("btn-play")) {
  bootstrap();
}
