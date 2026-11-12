import React, { useCallback, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline.esm.js";
import {
  addPointMarker,
  addRegion,
  confirmLyricAndAdvance,
  findNearestCandidate,
  findPlayingOrNearestLyric,
  getAudioDuration,
  maybeSnapTime,
  notifyStore,
  registerAudioPlayerBridge,
  seekAudio,
  selectTimelineItem,
  storeState,
  toggleLoopForLyric,
  triggerLyricAudition,
  updateLyricEnd,
  updateLyricStart,
  updatePointMarker,
  updateRegion,
  useWorkbenchStore,
} from "../store/workbenchStore.ts";
import type { WaveformBin } from "../types.ts";
import { hexToRgba, playSynthesizedClick } from "../utils/audio-click.ts";

function buildPeaksFromEnvelope(
  bins: WaveformBin[] | undefined,
): number[][] | undefined {
  if (!bins || bins.length === 0) return undefined;
  const peaks: number[] = [];
  for (const b of bins) {
    peaks.push(b.min, b.max);
  }
  return [peaks];
}

export function AudioTimelineStage(): React.JSX.Element {
  const snap = useWorkbenchStore();
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(
    null,
  );
  const lastClickSecRef = useRef<number>(-1);
  const suppressRegionEventRef = useRef<boolean>(false);

  const drawMinimap = useCallback((currentSec: number) => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(300, Math.floor(rect.width * dpr));
    const height = Math.max(24, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#080d19";
    ctx.fillRect(0, 0, width, height);

    const duration = getAudioDuration();
    const bins = storeState.analysis?.waveform?.bins || [];
    if (bins.length > 0) {
      const midY = height / 2;
      ctx.fillStyle = "rgba(56, 189, 248, 0.42)";
      const step = Math.max(1, Math.floor(bins.length / width));
      for (let i = 0; i < bins.length; i += step) {
        const b = bins[i];
        const x = (b.start_sec / duration) * width;
        const top = midY - b.max * (height * 0.45);
        const bottom = midY - b.min * (height * 0.45);
        ctx.fillRect(
          x,
          top,
          Math.max(1, (width / bins.length) * step),
          Math.max(1, bottom - top),
        );
      }
    }

    for (const r of storeState.annotations?.regions || []) {
      const x1 = (r.start_sec / duration) * width;
      const x2 = (r.end_sec / duration) * width;
      ctx.fillStyle = hexToRgba(r.color || "#38bdf8", 0.25);
      ctx.fillRect(x1, 0, Math.max(2, x2 - x1), height);
    }

    if (storeState.loopInSec !== null && storeState.loopOutSec !== null) {
      const lx1 = (storeState.loopInSec / duration) * width;
      const lx2 = (storeState.loopOutSec / duration) * width;
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2 * dpr;
      ctx.strokeRect(lx1, 1, Math.max(2, lx2 - lx1), height - 2);
    }

    const ws = wsRef.current;
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
  }, []);

  const drawCandidateOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(100, Math.floor(rect.width * dpr));
    const height = Math.max(60, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const duration = getAudioDuration();
    let startSec = 0;
    let endSec = duration;
    const ws = wsRef.current;
    if (ws) {
      try {
        const wrapper = ws.getWrapper();
        const scrollEl = wrapper?.parentElement;
        if (wrapper && scrollEl && wrapper.scrollWidth > 0) {
          startSec = (scrollEl.scrollLeft / wrapper.scrollWidth) * duration;
          endSec =
            ((scrollEl.scrollLeft + scrollEl.clientWidth) /
              wrapper.scrollWidth) *
            duration;
        }
      } catch {
        // Fallback
      }
    }

    const span = Math.max(0.001, endSec - startSec);
    const xForSec = (t: number) => ((t - startSec) / span) * width;

    // Loop markers
    if (storeState.loopInSec !== null) {
      const ix = xForSec(storeState.loopInSec);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.moveTo(ix, 0);
      ctx.lineTo(ix, height);
      ctx.stroke();
    }
    if (storeState.loopOutSec !== null) {
      const ox = xForSec(storeState.loopOutSec);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.moveTo(ox, 0);
      ctx.lineTo(ox, height);
      ctx.stroke();
    }

    // Audition stop marker
    if (storeState.auditionStopAtSec !== null) {
      const ax = xForSec(storeState.auditionStopAtSec);
      ctx.save();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2 * dpr;
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.beginPath();
      ctx.moveTo(ax, 0);
      ctx.lineTo(ax, height);
      ctx.stroke();
      ctx.restore();
    }

    // Candidate Onsets
    if (storeState.trackVisibility.cand_onsets && storeState.analysis?.onsets) {
      ctx.strokeStyle = "rgba(56, 189, 248, 0.42)";
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      for (const o of storeState.analysis.onsets) {
        if (o.time_sec < startSec || o.time_sec > endSec) continue;
        if ((o.onset_strength ?? 99) < storeState.onsetThreshold) continue;
        const x = xForSec(o.time_sec);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 16 * dpr);
        ctx.moveTo(x, height - 16 * dpr);
        ctx.lineTo(x, height);
      }
      ctx.stroke();
    }

    // Candidate Beats
    if (storeState.trackVisibility.cand_beats && storeState.analysis?.beats) {
      ctx.save();
      ctx.strokeStyle = "rgba(245, 158, 11, 0.45)";
      ctx.lineWidth = 1.1 * dpr;
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.beginPath();
      for (const b of storeState.analysis.beats) {
        if (b.time_sec < startSec || b.time_sec > endSec) continue;
        const x = xForSec(b.time_sec);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Candidate Energy
    if (
      storeState.trackVisibility.cand_energy &&
      storeState.analysis?.energyFrames?.length
    ) {
      ctx.save();
      ctx.strokeStyle = "rgba(34, 197, 94, 0.65)";
      ctx.lineWidth = 1.4 * dpr;
      ctx.beginPath();
      let started = false;
      for (const f of storeState.analysis.energyFrames) {
        if (f.time_sec < startSec - 0.2 || f.time_sec > endSec + 0.2) continue;
        const x = xForSec(f.time_sec);
        const y = height - Math.min(1, f.rms * 2.1) * (height * 0.84);
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

    // Lyric tick marks across visible window
    if (
      storeState.trackVisibility.lyrics_main &&
      storeState.lyrics?.lines?.length
    ) {
      ctx.save();
      ctx.font = `${10 * dpr}px monospace`;
      for (const l of storeState.lyrics.lines) {
        const isSel = storeState.selectedLyricId === l.id;
        if (l.start_sec >= startSec && l.start_sec <= endSec) {
          const x = xForSec(l.start_sec);
          ctx.strokeStyle = isSel
            ? "#e879f9"
            : l.status === "confirmed"
              ? "rgba(74, 222, 128, 0.72)"
              : "rgba(168, 85, 247, 0.5)";
          ctx.lineWidth = (isSel ? 2.2 : 1.1) * dpr;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
          ctx.fillStyle = isSel ? "#f0abfc" : "rgba(216, 180, 254, 0.85)";
          ctx.fillText(l.id, x + 3 * dpr, 12 * dpr);
        }
        if (isSel && l.end_sec >= startSec && l.end_sec <= endSec) {
          const ex = xForSec(l.end_sec);
          ctx.strokeStyle = "#f472b6";
          ctx.lineWidth = 2 * dpr;
          ctx.setLineDash([4 * dpr, 3 * dpr]);
          ctx.beginPath();
          ctx.moveTo(ex, 0);
          ctx.lineTo(ex, height);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "#f9a8d4";
          ctx.fillText(`${l.id}尾`, ex + 3 * dpr, 24 * dpr);
        }
      }
      ctx.restore();
    }
  }, []);

  // Synchronize WaveSurfer regions with Focus Track & Lock rules
  const syncWaveSurferRegions = useCallback(() => {
    const regionsPlugin = regionsPluginRef.current;
    if (!regionsPlugin || !storeState.annotations) return;
    suppressRegionEventRef.current = true;
    try {
      regionsPlugin.clearRegions();
      const activeTrack = storeState.activeTrackId;

      // 1. Structure Sections & Representative Clips
      for (const r of storeState.annotations.regions) {
        const isClip = r.category === "representative_clip";
        const trackKey = isClip ? "structure_clips" : "structure_sections";
        if (!storeState.trackVisibility[trackKey]) continue;

        const isTrackFocused = activeTrack === trackKey;
        const isLocked = storeState.trackLocks[trackKey];
        const isSelected =
          storeState.selectedKind === "region" &&
          storeState.selectedId === r.id;

        const editable = isTrackFocused && !isLocked;
        const alpha = isSelected ? 0.32 : isTrackFocused ? 0.2 : 0.08;

        regionsPlugin.addRegion({
          id: `reg_${r.id}`,
          start: r.start_sec,
          end: r.end_sec,
          color: hexToRgba(r.color || "#38bdf8", alpha),
          content: isTrackFocused ? `${r.id}: ${r.label}` : r.id,
          drag: editable,
          resize: editable,
        });
      }

      // 2. Point Markers (Downbeats & Beats/Accents)
      for (const m of storeState.annotations.markers) {
        const isDownbeat = m.category === "downbeat";
        const trackKey = isDownbeat ? "rhythm_downbeats" : "rhythm_markers";
        if (!storeState.trackVisibility[trackKey]) continue;

        const isTrackFocused = activeTrack === trackKey;
        const isLocked = storeState.trackLocks[trackKey];
        const isSelected =
          storeState.selectedKind === "point" && storeState.selectedId === m.id;
        const editable = isTrackFocused && !isLocked;

        regionsPlugin.addRegion({
          id: `pt_${m.id}`,
          start: m.time_sec,
          color: isSelected
            ? "#ffffff"
            : hexToRgba(m.color || "#f59e0b", isTrackFocused ? 0.95 : 0.4),
          content: isTrackFocused ? `${m.id} (${m.label})` : "",
          drag: editable,
          resize: false,
        });
      }

      // 3. Selected Lyric Line + Immediate Neighbors (when Lyrics track is visible)
      if (
        storeState.trackVisibility.lyrics_main &&
        storeState.lyrics?.lines?.length
      ) {
        const lines = storeState.lyrics.lines;
        const selIdx = lines.findIndex(
          (l) => l.id === storeState.selectedLyricId,
        );
        const isLyricsFocused = activeTrack === "lyrics_main";
        const isLyricsLocked = storeState.trackLocks.lyrics_main;

        if (selIdx !== -1) {
          // Render previous, current, and next lyric lines so adjacent boundaries are visible & draggable
          const indices = isLyricsFocused
            ? [selIdx - 1, selIdx, selIdx + 1].filter(
                (i) => i >= 0 && i < lines.length,
              )
            : [selIdx];

          for (const i of indices) {
            const l = lines[i];
            const isMainSel = i === selIdx;
            const editable = isLyricsFocused && !isLyricsLocked;
            const baseColor =
              l.status === "confirmed" ? "#10b981" : "#a855f7";
            const alpha = isMainSel
              ? isLyricsFocused
                ? 0.36
                : 0.2
              : 0.14;

            regionsPlugin.addRegion({
              id: `lyric_${l.id}`,
              start: l.start_sec,
              end: l.end_sec,
              color: hexToRgba(baseColor, alpha),
              content: `${l.id}: ${l.text.slice(0, 18)}`,
              drag: editable && isMainSel,
              resize: editable,
            });
          }
        }
      }
    } finally {
      suppressRegionEventRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!waveformContainerRef.current || !timelineContainerRef.current) return;
    const regionsPlugin = RegionsPlugin.create();
    regionsPluginRef.current = regionsPlugin;

    const timelinePlugin = TimelinePlugin.create({
      container: timelineContainerRef.current,
      primaryLabelInterval: 5,
      secondaryLabelInterval: 1,
      style: {
        fontSize: "11px",
        color: "#94a3b8",
      },
    });

    const peaks = buildPeaksFromEnvelope(storeState.analysis?.waveform?.bins);
    const duration = getAudioDuration();

    const ws = WaveSurfer.create({
      container: waveformContainerRef.current,
      url: "/api/audio",
      peaks,
      duration,
      height: 138,
      waveColor: "#334155",
      progressColor: "#0284c7",
      cursorColor: "#f43f5e",
      cursorWidth: 2,
      minPxPerSec: storeState.zoomPxPerSec,
      autoScroll: true,
      autoCenter: true,
      normalize: false,
      plugins: [regionsPlugin, timelinePlugin],
    });
    wsRef.current = ws;

    registerAudioPlayerBridge({
      seekTo: (sec: number) => ws.setTime(sec),
      play: () => {
        void ws.play();
      },
      pause: () => ws.pause(),
      playPause: () => {
        void ws.playPause();
      },
      stop: () => ws.stop(),
      setRate: (rate: number) => ws.setPlaybackRate(rate, true),
      setZoom: (px: number) => ws.zoom(px),
      getDuration: () => ws.getDuration() || duration,
      getCurrentTime: () => ws.getCurrentTime(),
    });

    ws.on("ready", () => {
      syncWaveSurferRegions();
      drawMinimap(0);
      drawCandidateOverlay();
    });

    ws.on("play", () => {
      storeState.isPlaying = true;
      notifyStore();
    });

    ws.on("pause", () => {
      storeState.isPlaying = false;
      notifyStore();
    });

    ws.on("timeupdate", (currentSec: number) => {
      // 1. Check Aegisub one-shot audition stop boundary
      if (
        storeState.auditionStopAtSec !== null &&
        ws.isPlaying() &&
        currentSec >= storeState.auditionStopAtSec
      ) {
        const stopTarget = storeState.auditionStopAtSec;
        storeState.auditionStopAtSec = null;
        ws.pause();
        ws.setTime(stopTarget);
        storeState.currentTimeSec = stopTarget;
        notifyStore();
        return;
      }

      // 2. Check A-B loop boundary
      if (
        storeState.loopEnabled &&
        storeState.loopInSec !== null &&
        storeState.loopOutSec !== null &&
        storeState.loopOutSec > storeState.loopInSec + 0.05 &&
        currentSec >= storeState.loopOutSec
      ) {
        ws.setTime(storeState.loopInSec);
        lastClickSecRef.current = storeState.loopInSec;
        storeState.currentTimeSec = storeState.loopInSec;
        notifyStore();
        return;
      }

      // 3. Check synthesized click track
      if (storeState.clickTrackEnabled && ws.isPlaying()) {
        const prev = lastClickSecRef.current;
        if (prev >= 0 && currentSec >= prev && currentSec - prev <= 0.25) {
          for (const m of storeState.annotations?.markers || []) {
            if (m.time_sec > prev && m.time_sec <= currentSec) {
              const isDownbeat = m.category === "downbeat";
              playSynthesizedClick(
                isDownbeat ? 1360 : 920,
                isDownbeat ? 0.3 : 0.2,
              );
              break;
            }
          }
          if (storeState.clickCandidatesEnabled && storeState.analysis?.beats) {
            for (const b of storeState.analysis.beats) {
              if (b.time_sec > prev && b.time_sec <= currentSec) {
                playSynthesizedClick(660, 0.12);
                break;
              }
            }
          }
        }
      }
      lastClickSecRef.current = currentSec;
      storeState.currentTimeSec = currentSec;
      drawMinimap(currentSec);
      drawCandidateOverlay();
      notifyStore();
    });

    ws.on("scroll", () => {
      drawMinimap(ws.getCurrentTime());
      drawCandidateOverlay();
    });

    ws.on("zoom", () => {
      drawMinimap(ws.getCurrentTime());
      drawCandidateOverlay();
    });

    ws.on("interaction", (newTimeSec: number) => {
      storeState.auditionStopAtSec = null;
      storeState.activeAuditionLabel = null;
      storeState.currentTimeSec = newTimeSec;
      drawMinimap(newTimeSec);
      drawCandidateOverlay();
      notifyStore();
    });

    regionsPlugin.on("region-clicked", (reg, e) => {
      e.stopPropagation();
      if (reg.id.startsWith("lyric_")) {
        selectTimelineItem("lyric", reg.id.slice(6));
      } else if (reg.id.startsWith("reg_")) {
        selectTimelineItem("region", reg.id.slice(4));
      } else if (reg.id.startsWith("pt_")) {
        selectTimelineItem("point", reg.id.slice(3));
      }
    });

    regionsPlugin.on("region-updated", (reg) => {
      if (suppressRegionEventRef.current) return;
      if (reg.id.startsWith("lyric_")) {
        const id = reg.id.slice(6);
        const line = storeState.lyrics?.lines?.find((l) => l.id === id);
        if (!line) return;
        const sSnap = maybeSnapTime(reg.start);
        const eSnap = maybeSnapTime(reg.end);
        if (Math.abs(sSnap.time_sec - line.start_sec) > 0.001) {
          updateLyricStart(
            id,
            sSnap.time_sec,
            sSnap.candidate ? sSnap.candidate.id : line.origin_candidate_id,
          );
        }
        if (Math.abs(eSnap.time_sec - line.end_sec) > 0.001) {
          updateLyricEnd(id, eSnap.time_sec);
        }
        selectTimelineItem("lyric", id);
      } else if (reg.id.startsWith("reg_")) {
        const id = reg.id.slice(4);
        const sSnap = maybeSnapTime(reg.start);
        const eSnap = maybeSnapTime(reg.end);
        updateRegion(id, {
          start_sec: sSnap.time_sec,
          end_sec: Math.min(
            getAudioDuration(),
            Math.max(sSnap.time_sec + 0.1, eSnap.time_sec),
          ),
        });
        selectTimelineItem("region", id);
      } else if (reg.id.startsWith("pt_")) {
        const id = reg.id.slice(3);
        const snapped = maybeSnapTime(reg.start);
        updatePointMarker(
          id,
          { time_sec: snapped.time_sec },
          !snapped.candidate,
        );
        selectTimelineItem("point", id);
      }
    });

    return () => {
      registerAudioPlayerBridge(null);
      ws.destroy();
    };
  }, [drawCandidateOverlay, drawMinimap, syncWaveSurferRegions]);

  // Re-sync regions whenever annotations, lyrics, selection, or track visibility/locks change
  useEffect(() => {
    syncWaveSurferRegions();
    drawMinimap(snap.currentTimeSec);
    drawCandidateOverlay();
  }, [
    snap.annotations,
    snap.lyrics,
    snap.activeTrackId,
    snap.selectedKind,
    snap.selectedId,
    snap.selectedLyricId,
    snap.trackVisibility,
    snap.trackLocks,
    snap.loopInSec,
    snap.loopOutSec,
    snap.onsetThreshold,
    drawCandidateOverlay,
    drawMinimap,
    syncWaveSurferRegions,
    snap.currentTimeSec,
  ]);

  const handleMinimapMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const seekFromEvent = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)),
      );
      seekAudio(ratio * getAudioDuration());
    };
    seekFromEvent(e.clientX);
    const onMove = (moveEv: MouseEvent) => seekFromEvent(moveEv.clientX);
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Determine active/playing lyric line for the Aegisub bar
  const playingLyric = findPlayingOrNearestLyric(snap.currentTimeSec);
  const selectedLyric =
    snap.lyrics.lines.find((l) => l.id === snap.selectedLyricId) ||
    playingLyric ||
    null;
  const selIdx = selectedLyric
    ? snap.lyrics.lines.findIndex((l) => l.id === selectedLyric.id)
    : -1;
  const nextLyric =
    selIdx !== -1 && selIdx + 1 < snap.lyrics.lines.length
      ? snap.lyrics.lines[selIdx + 1]
      : null;

  const focusTrackLabels: Record<string, string> = {
    lyrics_main: "歌词对轴轨道 (可拖拽句首/句尾)",
    structure_sections: "曲式段落轨道 P001–P012",
    structure_clips: "代表性验证片段 CLIP_01",
    rhythm_downbeats: "小节强拍轨道 (Downbeats)",
    rhythm_markers: "拍点与重音轨道",
    cand_beats: "自动拍点参考层 (只读)",
    cand_onsets: "自动起音参考层 (只读)",
    cand_energy: "能量包络参考层 (只读)",
  };

  return (
    <section className="wb-audio-stage">
      {/* Row 1: Minimap & Focus Track Status */}
      <div className="wb-minimap-row">
        <span className="wb-stage-tag">
          焦点轨道: {focusTrackLabels[snap.activeTrackId] || snap.activeTrackId}
        </span>
        <canvas
          ref={minimapRef}
          className="wb-minimap-canvas"
          onMouseDown={handleMinimapMouseDown}
        />
        <div className="wb-zoom-box">
          <span>缩放</span>
          <input
            type="range"
            min={25}
            max={450}
            step={5}
            value={snap.zoomPxPerSec}
            onChange={(e) => {
              const px = Number(e.target.value);
              storeState.zoomPxPerSec = px;
              wsRef.current?.zoom(px);
              notifyStore();
            }}
          />
          <span className="wb-mono-small">{snap.zoomPxPerSec}px/s</span>
        </div>
      </div>

      {/* Row 2: Main Waveform + Candidate Canvas + Timeline */}
      <div className="wb-waveform-wrap">
        <div
          ref={waveformContainerRef}
          className="wb-waveform-container"
          onClick={(e) => {
            if (!e.altKey) return;
            const now = wsRef.current?.getCurrentTime() || 0;
            const nearest = findNearestCandidate(now, 0.15);
            if (nearest) {
              addPointMarker({
                timeSec: nearest.time_sec,
                category: nearest.kind === "beat" ? "beat" : "accent",
                originCandidate: nearest,
                status: "confirmed",
                note: `Alt+单击采纳自 ${nearest.id}`,
              });
            }
          }}
        />
        <canvas ref={overlayCanvasRef} className="wb-overlay-canvas" />
        <div ref={timelineContainerRef} className="wb-timeline-container" />
      </div>

      {/* Row 3: Aegisub Audition & Rapid Timing Bar */}
      <div className="wb-aegisub-bar">
        <div className="wb-aegisub-lyric-info">
          <div className="wb-aegisub-meta">
            <span className="wb-tag-purple">
              {selectedLyric
                ? `${selectedLyric.id} · ${selectedLyric.section_id} · Bar ${selectedLyric.bar}`
                : "未选歌词"}
            </span>
            {selectedLyric ? (
              <span
                className={`wb-status-pill ${selectedLyric.status === "confirmed" ? "confirmed" : "candidate"}`}
              >
                {selectedLyric.status}
              </span>
            ) : null}
            {selectedLyric ? (
              <span className="wb-mono-small">
                [{selectedLyric.start_sec.toFixed(3)}s –{" "}
                {selectedLyric.end_sec.toFixed(3)}s |{" "}
                {(selectedLyric.end_sec - selectedLyric.start_sec).toFixed(2)}s]
              </span>
            ) : null}
            {snap.activeAuditionLabel ? (
              <span className="wb-audition-badge">
                预听: {snap.activeAuditionLabel}
              </span>
            ) : null}
          </div>
          <div className="wb-aegisub-lines">
            <span className="wb-aegisub-cur">
              {selectedLyric ? selectedLyric.text : "[器乐段落 / 点击下方歌词行开始对轴]"}
            </span>
            <span className="wb-aegisub-next">
              {nextLyric
                ? `→ 下一句 (${nextLyric.id} @ ${nextLyric.start_sec.toFixed(2)}s): ${nextLyric.text}`
                : ""}
            </span>
          </div>
        </div>

        {/* Aegisub 500ms Audition Controls */}
        <div className="wb-aegisub-controls">
          <div className="wb-btn-cluster" title="Aegisub 切点预听模式（自动在切点处停住，检验句首/句尾是否吃字）">
            <button
              type="button"
              className="btn"
              disabled={!selectedLyric}
              onClick={() => triggerLyricAudition("before_start")}
              title="播放句首前 500ms 至句首 [快捷键 A]：检查句首前是否漏掉起音"
            >
              句首前0.5s <kbd>A</kbd>
            </button>
            <button
              type="button"
              className="btn"
              disabled={!selectedLyric}
              onClick={() => triggerLyricAudition("after_start")}
              title="播放句首后 500ms [快捷键 S]：检查句首第一个字是否准确"
            >
              句首后0.5s <kbd>S</kbd>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedLyric}
              onClick={() => triggerLyricAudition("line")}
              title="完整播放当前选中句并在句尾自动停住 [快捷键 R]"
            >
              播本句 <kbd>R</kbd>
            </button>
            <button
              type="button"
              className="btn"
              disabled={!selectedLyric}
              onClick={() => triggerLyricAudition("before_end")}
              title="播放句尾前 550ms 至句尾 [快捷键 D]：检查句尾是否把下一句的字吃进来（如 L011 与 L012 的『楽器』）"
            >
              句尾前0.5s <kbd>D</kbd>
            </button>
            <button
              type="button"
              className="btn"
              disabled={!selectedLyric}
              onClick={() => triggerLyricAudition("after_end")}
              title="播放句尾后 550ms [快捷键 F]：确认下一句的第一个字刚好在句尾之后响起"
            >
              句尾后0.5s <kbd>F</kbd>
            </button>
          </div>

          {/* Quick Start / End Nudge & Set */}
          <div className="wb-btn-cluster">
            <button
              type="button"
              className="btn"
              disabled={!selectedLyric}
              onClick={() => {
                if (!selectedLyric) return;
                updateLyricStart(
                  selectedLyric.id,
                  Number(snap.currentTimeSec.toFixed(3)),
                  undefined,
                  true,
                );
              }}
              title="将当前句首设为播放头位置 [快捷键 Q]"
            >
              [句首=当前 <kbd>Q</kbd>
            </button>
            <button
              type="button"
              className="btn"
              disabled={!selectedLyric}
              onClick={() => {
                if (!selectedLyric) return;
                updateLyricStart(
                  selectedLyric.id,
                  selectedLyric.start_sec - 0.02,
                  undefined,
                  true,
                );
              }}
            >
              句首-20ms
            </button>
            <button
              type="button"
              className="btn"
              disabled={!selectedLyric}
              onClick={() => {
                if (!selectedLyric) return;
                updateLyricStart(
                  selectedLyric.id,
                  selectedLyric.start_sec + 0.02,
                  undefined,
                  true,
                );
              }}
            >
              句首+20ms
            </button>

            <button
              type="button"
              className="btn"
              disabled={!selectedLyric}
              onClick={() => {
                if (!selectedLyric) return;
                updateLyricEnd(
                  selectedLyric.id,
                  selectedLyric.end_sec - 0.02,
                  true,
                );
              }}
            >
              句尾-20ms
            </button>
            <button
              type="button"
              className="btn"
              disabled={!selectedLyric}
              onClick={() => {
                if (!selectedLyric) return;
                updateLyricEnd(
                  selectedLyric.id,
                  selectedLyric.end_sec + 0.02,
                  true,
                );
              }}
            >
              句尾+20ms
            </button>
            <button
              type="button"
              className="btn"
              disabled={!selectedLyric}
              onClick={() => {
                if (!selectedLyric) return;
                updateLyricEnd(
                  selectedLyric.id,
                  Number(snap.currentTimeSec.toFixed(3)),
                  true,
                );
              }}
              title="将当前句尾设为播放头位置 [快捷键 W]"
            >
              句尾=当前] <kbd>W</kbd>
            </button>

            <button
              type="button"
              className={`btn ${selectedLyric && snap.loopEnabled && snap.loopingLyricId === selectedLyric.id ? "active" : ""}`}
              disabled={!selectedLyric}
              onClick={() => {
                if (selectedLyric) toggleLoopForLyric(selectedLyric);
              }}
              title="A-B 循环当前句"
            >
              循环本句
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedLyric}
              onClick={() => confirmLyricAndAdvance(selectedLyric?.id)}
              title="确认当前句已对齐并跳到下一句播放 [快捷键 G]"
            >
              确认并下一句 <kbd>G</kbd>
            </button>
          </div>

          {/* Quick Marker / Region creation when in Structure or Rhythm tracks */}
          <div className="wb-btn-cluster">
            <button
              type="button"
              className="btn btn-subtle"
              onClick={() =>
                addPointMarker({
                  timeSec: snap.currentTimeSec,
                  category: "downbeat",
                })
              }
              title="在播放头添加小节第一拍 (B)"
            >
              +强拍(B)
            </button>
            <button
              type="button"
              className="btn btn-subtle"
              onClick={() =>
                addPointMarker({
                  timeSec: snap.currentTimeSec,
                  category: "beat",
                })
              }
              title="在播放头添加普通拍点/重音 (M)"
            >
              +打点(M)
            </button>
            <button
              type="button"
              className="btn btn-subtle"
              onClick={() => {
                const startSec =
                  snap.loopInSec !== null && snap.loopOutSec !== null
                    ? snap.loopInSec
                    : snap.currentTimeSec;
                const endSec =
                  snap.loopInSec !== null && snap.loopOutSec !== null
                    ? snap.loopOutSec
                    : Math.min(getAudioDuration(), snap.currentTimeSec + 10);
                addRegion({
                  startSec,
                  endSec,
                  category: "section",
                  status: "candidate",
                });
              }}
              title="新建音乐段落区间"
            >
              +段落区间
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
