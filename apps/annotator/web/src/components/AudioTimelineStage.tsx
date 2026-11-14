import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline.esm.js";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_RANGE_DURATION_SEC,
  findEventByRef,
  findTrackById,
  flattenTracks,
  formatSeconds,
  isNodeEffectivelyLocked,
  isNodeEffectivelyVisible,
  isRangeEvent,
} from "../../model.ts";
import { useWorkbenchStore } from "../store/workbenchStore.ts";
import { StateIcon } from "./StateIcon.tsx";
import type { EventRef, TimelineTrack } from "../types.ts";

interface AudioTimelineStageProps {
  onTogglePlay: () => void;
  onStop: () => void;
  onSeek: (sec: number) => void;
  onAuditionRange: (startSec: number, endSec: number) => void;
}

export const AudioTimelineStage: React.FC<AudioTimelineStageProps> = ({
  onTogglePlay,
  onStop,
  onSeek,
  onAuditionRange,
}) => {
  const project = useWorkbenchStore((s) => s.project);
  const analysis = useWorkbenchStore((s) => s.analysis);
  const view = useWorkbenchStore((s) => s.view);
  const transport = useWorkbenchStore((s) => s.transport);
  const layout = useWorkbenchStore((s) => s.layout);
  const colorDraft = useWorkbenchStore((s) => s.edit.colorDraft);

  const setVisibleWindow = useWorkbenchStore((s) => s.setVisibleWindow);
  const zoomByFactor = useWorkbenchStore((s) => s.zoomByFactor);
  const setLoopEnabled = useWorkbenchStore((s) => s.setLoopEnabled);
  const setLoopRange = useWorkbenchStore((s) => s.setLoopRange);
  const selectNode = useWorkbenchStore((s) => s.selectNode);
  const selectEvent = useWorkbenchStore((s) => s.selectEvent);
  const runWorkbenchCommand = useWorkbenchStore((s) => s.runWorkbenchCommand);
  const openContextMenu = useWorkbenchStore((s) => s.openContextMenu);
  const getEffectiveEventColor = useWorkbenchStore(
    (s) => s.getEffectiveEventColor,
  );
  const getEffectiveTrackColor = useWorkbenchStore(
    (s) => s.getEffectiveTrackColor,
  );

  const [showBeatGuides, setShowBeatGuides] = useState(true);
  const [panningOverview, setPanningOverview] = useState(false);
  const [labelWidth, setLabelWidth] = useState(64);
  const [maxLabelWidth, setMaxLabelWidth] = useState(360);
  const [laneScrollbarWidth, setLaneScrollbarWidth] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lanesRef = useRef<HTMLDivElement | null>(null);
  const labelDragRef = useRef<{ pointerId: number; startX: number; width: number } | null>(null);

  useEffect(() => {
    const content = contentRef.current;
    const lanes = lanesRef.current;
    if (!content || !lanes) return;
    const measure = () => {
      const maximum = Math.max(64, Math.min(360, content.clientWidth - 160));
      setMaxLabelWidth(maximum);
      setLabelWidth((width) => Math.max(64, Math.min(maximum, width)));
      setLaneScrollbarWidth(lanes.offsetWidth - lanes.clientWidth);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    observer.observe(lanes);
    measure();
    return () => observer.disconnect();
  }, []);

  const resizeLabel = (width: number) =>
    setLabelWidth(Math.max(64, Math.min(maxLabelWidth, Math.round(width))));

  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(
    null,
  );
  const [waveReady, setWaveReady] = useState(0);
  const waveformErrorRef = useRef<HTMLDivElement | null>(null);
  const waveformWrapRef = useRef<HTMLDivElement | null>(null);
  const overviewRef = useRef<HTMLDivElement | null>(null);

  const durationSec =
    analysis?.summary?.audio_file?.duration_sec ??
    analysis?.waveform?.duration_sec ??
    205.533;
  const visibleStart = view.visibleStartSec;
  const visibleEnd = Math.max(visibleStart + 1, view.visibleEndSec);
  const visibleSpan = visibleEnd - visibleStart;

  const activeTrack: TimelineTrack | null = view.selectedTrackId
    ? findTrackById(project.nodes, view.selectedTrackId)
    : null;

  const visibleTracks = flattenTracks(project.nodes).filter((entry) =>
    isNodeEffectivelyVisible(project.nodes, entry.track.id, view.hiddenNodeIds),
  );

  // Convert clientX inside waveform/lane area to timeSec
  const clientXToTimeSec = useCallback(
    (clientX: number, element: HTMLElement | null): number => {
      if (!element) return transport.currentTimeSec;
      const rect = element.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)),
      );
      return Number((visibleStart + ratio * visibleSpan).toFixed(3));
    },
    [transport.currentTimeSec, visibleSpan, visibleStart],
  );

  // Restore the renderer/options from Git HEAD (f8208f5), with the unified
  // project supplying regions. App's audio element remains the only playback clock.
  useEffect(() => {
    const container = waveformContainerRef.current;
    const timeline = timelineContainerRef.current;
    const bins = analysis?.waveform?.bins;
    if (!container || !timeline || !bins?.length) return;
    const peaks = bins.flatMap((bin) => [bin.min, bin.max]);
    const regions = RegionsPlugin.create();
    const ws = WaveSurfer.create({
      container,
      peaks: [peaks],
      duration: durationSec,
      height: 138,
      waveColor: "#334155",
      progressColor: "#0284c7",
      cursorColor: "#f43f5e",
      cursorWidth: 2,
      normalize: false,
      interact: false,
      autoScroll: false,
      autoCenter: false,
      hideScrollbar: true,
      plugins: [
        regions,
        TimelinePlugin.create({
          container: timeline,
          primaryLabelInterval: 5,
          secondaryLabelInterval: 1,
          style: { fontSize: "11px", color: "#94a3b8" },
        }),
      ],
    });
    wsRef.current = ws;
    regionsRef.current = regions;
    const fit = () => {
      const current = useWorkbenchStore.getState();
      const span = Math.max(
        1,
        current.view.visibleEndSec - current.view.visibleStartSec,
      );
      if (ws.getDecodedData()) {
        ws.zoom(container.clientWidth / span);
        ws.setScrollTime(current.view.visibleStartSec);
        ws.setTime(current.transport.currentTimeSec);
      }
    };
    ws.on("ready", () => {
      fit();
      setWaveReady((n) => n + 1);
    });
    ws.on("error", () => {
      if (waveformErrorRef.current) waveformErrorRef.current.hidden = false;
    });
    regions.on("region-clicked", (region, e) => {
      e.stopPropagation();
      const state = useWorkbenchStore.getState();
      if (state.view.selectedTrackId)
        state.selectEvent(
          { trackId: state.view.selectedTrackId, eventId: region.id },
          e.shiftKey,
        );
    });
    regions.on("region-double-clicked", (region, e) => {
      e.stopPropagation();
      if (region.end > region.start) onAuditionRange(region.start, region.end);
      else onSeek(region.start);
    });
    regions.on("region-updated", (region, side) => {
      const state = useWorkbenchStore.getState();
      const trackId = state.view.selectedTrackId;
      if (!trackId) return;
      const ref = { trackId, eventId: region.id };
      const found = findEventByRef(state.project, ref);
      if (!found) return;
      if (side)
        state.runWorkbenchCommand({
          type: "setBoundary",
          ref,
          edge: side,
          timeSec: Number(region[side].toFixed(3)),
        });
      else
        state.runWorkbenchCommand({
          type: "move",
          refs: [ref],
          deltaSec: region.start - found.event.startSec,
        });
      // Always restore the authoritative bounds if a command was clamped/rejected.
      setWaveReady((n) => n + 1);
    });
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => {
      observer.disconnect();
      wsRef.current = null;
      regionsRef.current = null;
      ws.destroy();
    };
  }, [analysis?.waveform, durationSec, onAuditionRange, onSeek]);

  useEffect(() => {
    const ws = wsRef.current;
    const container = waveformContainerRef.current;
    if (!ws?.getDecodedData() || !container) return;
    ws.zoom(container.clientWidth / visibleSpan);
    ws.setScrollTime(visibleStart);
  }, [visibleStart, visibleSpan, waveReady]);

  useEffect(() => {
    const ws = wsRef.current;
    if (ws?.getDecodedData()) ws.setTime(transport.currentTimeSec);
  }, [transport.currentTimeSec, waveReady]);

  useEffect(() => {
    const plugin = regionsRef.current;
    if (!plugin || !wsRef.current?.getDecodedData()) return;
    plugin.clearRegions();
    if (!activeTrack) return;
    const locked = isNodeEffectivelyLocked(
      project.nodes,
      activeTrack.id,
      view.lockedNodeIds,
    );
    const primaryIndex = activeTrack.items.findIndex(
      (item) => item.id === view.selection.primary?.eventId,
    );
    const rgba = (hex: string, alpha: number) => {
      const value = Number.parseInt(hex.slice(1), 16);
      return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
    };
    activeTrack.items.forEach((event, index) => {
      const selected = view.selection.selected.some(
        (ref) => ref.trackId === activeTrack.id && ref.eventId === event.id,
      );
      const point = !isRangeEvent(event);
      // Like the old lyric view, show selected regions and immediate neighbors;
      // other starts remain fine ticks rather than full event cards.
      const nearSelection =
        primaryIndex >= 0 && Math.abs(index - primaryIndex) <= 1;
      const region = plugin.addRegion({
        id: event.id,
        start: event.startSec,
        end: point || (!selected && !nearSelection) ? undefined : event.endSec,
        color: rgba(
          getEffectiveEventColor(event, activeTrack),
          selected ? 0.36 : nearSelection ? 0.14 : 0.5,
        ),
        content:
          selected || nearSelection
            ? `${event.id}: ${event.text.slice(0, 18)}`
            : event.id,
        drag: !locked && selected,
        resize: !locked && !point && (selected || nearSelection),
      });
      region.element?.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const state = useWorkbenchStore.getState();
        const ref = { trackId: activeTrack.id, eventId: event.id };
        if (!selected) state.selectEvent(ref, false);
        state.openContextMenu({
          scope: "events",
          x: e.clientX,
          y: e.clientY,
          anchorTimeSec: state.transport.currentTimeSec,
          targetNodeId: activeTrack.id,
          targetEventRef: ref,
        });
      });
    });
  }, [
    project.nodes,
    activeTrack,
    view.selection,
    view.lockedNodeIds,
    colorDraft,
    getEffectiveEventColor,
    waveReady,
  ]);

  // Handle overview bar drag panning
  useEffect(() => {
    if (!panningOverview) return;
    const handleMove = (e: MouseEvent) => {
      const el = overviewRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)),
      );
      const centerSec = ratio * durationSec;
      const half = visibleSpan / 2;
      setVisibleWindow(centerSec - half, centerSec + half);
    };
    const handleUp = () => setPanningOverview(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [durationSec, panningOverview, setVisibleWindow, visibleSpan]);

  const playheadRatio = (transport.currentTimeSec - visibleStart) / visibleSpan;
  const playheadVisible = playheadRatio >= 0 && playheadRatio <= 1;

  const handleJumpToSelection = () => {
    const primary = findEventByRef(project, view.selection.primary);
    if (!primary) return;
    const ev = primary.event;
    onSeek(ev.startSec);
    if (ev.endSec !== undefined) {
      setLoopRange([ev.startSec, ev.endSec]);
    }
    if (ev.startSec < visibleStart || ev.startSec > visibleEnd) {
      const half = visibleSpan / 2;
      setVisibleWindow(ev.startSec - half, ev.startSec + half);
    }
  };

  const handleWaveformWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      if (e.shiftKey) {
        const shiftSec = (e.deltaY > 0 ? 1 : -1) * visibleSpan * 0.15;
        setVisibleWindow(visibleStart + shiftSec, visibleEnd + shiftSec);
      } else {
        const anchor = clientXToTimeSec(e.clientX, waveformWrapRef.current);
        zoomByFactor(e.deltaY > 0 ? 1.2 : 0.82, anchor);
      }
    }
  };

  const handleWaveformContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const clickTimeSec = clientXToTimeSec(e.clientX, waveformWrapRef.current);
    onSeek(clickTimeSec);
    openContextMenu({
      scope: "events",
      x: e.clientX,
      y: e.clientY,
      anchorTimeSec: clickTimeSec,
      targetNodeId: activeTrack?.id ?? null,
      targetEventRef: view.selection.primary,
    });
  };

  return (
    <section
      className="tracker-stage"
      style={{ height: `${layout.trackerHeightPx}px` }}
    >
      {/* 1. Transport Bar */}
      <div className="tracker-transport">
        <div className="tracker-transport__controls">
          <button
            type="button"
            className="btn btn--primary"
            onClick={onTogglePlay}
            title="播放 / 暂停 (Space)"
          >
            {transport.isPlaying ? "暂停 (Space)" : "▶ 播放 (Space)"}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onStop}
            title="停止并回到当前视窗起点"
          >
            ■ 停止
          </button>
          <button
            type="button"
            className={`btn ${transport.loopEnabled ? "btn--active" : "btn--ghost"}`}
            onClick={() => setLoopEnabled(!transport.loopEnabled)}
            title="切换选区/片段循环 (L)"
          >
            循环：{transport.loopEnabled ? "开" : "关"}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleJumpToSelection}
            disabled={!view.selection.primary}
            title="跳转到当前选中标注并设为循环区间"
          >
            跳到选中标注
          </button>
          <span className="tracker-transport__clock">
            <strong>{formatSeconds(transport.currentTimeSec)}</strong>
            <span className="muted"> / {formatSeconds(durationSec)}</span>
          </span>
          {transport.loopRange && (
            <span className={`tracker-transport__loop-badge ${transport.loopEnabled ? "is-active" : ""}`}>
              {transport.loopEnabled ? "循环" : "待循环"}：{formatSeconds(transport.loopRange[0])} –{" "}
              {formatSeconds(transport.loopRange[1])}
            </span>
          )}
        </div>

        <div className="tracker-transport__right">
          <label className="tracker-transport__check">
            <input
              type="checkbox"
              checked={showBeatGuides}
              onChange={(e) => setShowBeatGuides(e.target.checked)}
            />
            <span>拍点参考线</span>
          </label>
          <span className="tracker-transport__window-info">
            视窗：{formatSeconds(visibleStart)} – {formatSeconds(visibleEnd)} (
            {visibleSpan.toFixed(1)}s)
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => zoomByFactor(0.75, transport.currentTimeSec)}
            title="放大波形视窗"
          >
            放大 +
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => zoomByFactor(1.35, transport.currentTimeSec)}
            title="缩小波形视窗"
          >
            缩小 −
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setVisibleWindow(0, durationSec)}
            title="显示全曲范围"
          >
            全曲
          </button>
        </div>
      </div>

      {/* 2. Overview Bar */}
      <div
        ref={overviewRef}
        className="tracker-overview"
        onMouseDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.max(
            0,
            Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)),
          );
          const centerSec = ratio * durationSec;
          const half = visibleSpan / 2;
          setVisibleWindow(centerSec - half, centerSec + half);
          setPanningOverview(true);
        }}
        title="点击或拖动平移全曲视窗"
      >
        <span className="tracker-overview__label">
          总览窗（拖动平移视窗 · 滚轮缩放）
        </span>
        {/* Structure sections mini blocks */}
        {(findTrackById(project.nodes, "trk_song_parts")?.items ?? []).map(
          (sec) => {
            const left = (sec.startSec / durationSec) * 100;
            const width =
              (((sec.endSec ?? sec.startSec + 1) - sec.startSec) /
                durationSec) *
              100;
            return (
              <div
                key={sec.id}
                className="tracker-overview__section"
                style={{ left: `${left}%`, width: `${Math.max(0.5, width)}%` }}
                title={`${sec.id}: ${sec.text}`}
              />
            );
          },
        )}
        {/* Active viewport box */}
        <div
          className="tracker-overview__window"
          style={{
            left: `${(visibleStart / durationSec) * 100}%`,
            width: `${Math.max(1.5, (visibleSpan / durationSec) * 100)}%`,
          }}
        />
        {/* Overview playhead */}
        <div
          className="tracker-overview__playhead"
          style={{ left: `${(transport.currentTimeSec / durationSec) * 100}%` }}
        />
      </div>

      {/* 3. Original WaveSurfer renderer, regions and timeline */}
      <div
        ref={contentRef}
        className="tracker-content"
        style={{ "--tracker-label-width": `${labelWidth}px` } as React.CSSProperties}
      >
      <div
        className="tracker-column-resizer"
        role="separator"
        tabIndex={0}
        aria-label="调整轨道名称栏宽度"
        aria-orientation="vertical"
        aria-valuemin={64}
        aria-valuemax={maxLabelWidth}
        aria-valuenow={labelWidth}
        title="拖动调整轨道名称栏；双击恢复默认；方向键微调"
        onPointerDown={(e) => {
          if (!e.isPrimary || e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.focus();
          labelDragRef.current = { pointerId: e.pointerId, startX: e.clientX, width: labelWidth };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const drag = labelDragRef.current;
          if (drag?.pointerId === e.pointerId) resizeLabel(drag.width + e.clientX - drag.startX);
        }}
        onPointerUp={(e) => {
          if (labelDragRef.current?.pointerId !== e.pointerId) return;
          labelDragRef.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => { labelDragRef.current = null; }}
        onLostPointerCapture={() => { labelDragRef.current = null; }}
        onDoubleClick={() => resizeLabel(64)}
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
          e.preventDefault();
          if (e.key === "Home") resizeLabel(64);
          else if (e.key === "End") resizeLabel(maxLabelWidth);
          else resizeLabel(labelWidth + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : 8));
        }}
      />
      <div
        ref={waveformWrapRef}
        className="tracker-waveform"
        style={{ marginRight: laneScrollbarWidth }}
        onWheel={handleWaveformWheel}
        onClick={(e) => {
          const sec = clientXToTimeSec(e.clientX, waveformWrapRef.current);
          onSeek(sec);
        }}
        onDoubleClick={(e) => {
          if (!activeTrack) return;
          const sec = clientXToTimeSec(e.clientX, waveformWrapRef.current);
          runWorkbenchCommand({
            type: "createEvent",
            trackId: activeTrack.id,
            startSec: sec,
            endSec: e.shiftKey
              ? undefined
              : Number((sec + DEFAULT_RANGE_DURATION_SEC).toFixed(3)),
            text: e.shiftKey ? "新建点事件" : "新建区间",
          });
        }}
        onContextMenu={handleWaveformContextMenu}
      >
        <div
          ref={waveformContainerRef}
          className="tracker-waveform__renderer"
        />
        <div ref={timelineContainerRef} className="tracker-waveform__ruler" />
        <div ref={waveformErrorRef} className="tracker-waveform__empty" hidden>
          波形加载失败，请检查分析数据。
        </div>
        {!analysis?.waveform?.bins?.length && (
          <div className="tracker-waveform__empty">无真实波形数据</div>
        )}
        {showBeatGuides && (
          <div className="tracker-waveform__guides">
            {(findTrackById(project.nodes, "trk_downbeats")?.items ?? [])
              .filter(
                (event) =>
                  event.startSec >= visibleStart &&
                  event.startSec <= visibleEnd,
              )
              .map((event) => (
                <i
                  key={event.id}
                  style={{
                    left: `${((event.startSec - visibleStart) / visibleSpan) * 100}%`,
                  }}
                />
              ))}
          </div>
        )}
      </div>

      {/* 4. Multi-track Lanes */}
      <div className="tracker-lanes" ref={lanesRef}>
        {visibleTracks.map(({ track, pathNames }) => {
          const isSelectedTrack = track.id === view.selectedTrackId;
          const isLocked = isNodeEffectivelyLocked(
            project.nodes,
            track.id,
            view.lockedNodeIds,
          );
          const trackColor = getEffectiveTrackColor(track);
          const itemsInView = track.items.filter((ev) => {
            const end = ev.endSec ?? ev.startSec;
            return end >= visibleStart && ev.startSec <= visibleEnd;
          });

          return (
            <div
              key={track.id}
              className={`tracker-lane ${isSelectedTrack ? "is-active" : ""} ${
                isLocked ? "is-locked" : ""
              }`}
              onClick={() => selectNode(track.id)}
            >
              <div
                className="tracker-lane__header"
                title={`${pathNames.join(" / ")}${isLocked ? "（已锁定）" : ""}`}
              >
                <span
                  className="tracker-lane__swatch"
                  style={{ backgroundColor: isLocked ? "transparent" : trackColor, color: trackColor }}
                >
                  {isLocked && <StateIcon name="lock" off={false} />}
                </span>
                <span className="tracker-lane__name">{track.name}</span>
              </div>

              <div
                className="tracker-lane__timeline"
                onClick={(e) => {
                  const sec = clientXToTimeSec(e.clientX, e.currentTarget);
                  selectNode(track.id);
                  onSeek(sec);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const sec = clientXToTimeSec(e.clientX, e.currentTarget);
                  selectNode(track.id);
                  onSeek(sec);
                  openContextMenu({
                    scope: "events",
                    x: e.clientX,
                    y: e.clientY,
                    anchorTimeSec: sec,
                    targetNodeId: track.id,
                    targetEventRef: view.selection.primary,
                  });
                }}
              >
                {itemsInView.map((ev) => {
                  const ref: EventRef = { trackId: track.id, eventId: ev.id };
                  const isSelected = view.selection.selected.some(
                    (r) =>
                      r.trackId === ref.trackId && r.eventId === ref.eventId,
                  );
                  const evColor = getEffectiveEventColor(ev, track);

                  if (!isRangeEvent(ev)) {
                    const leftPct =
                      ((ev.startSec - visibleStart) / visibleSpan) * 100;
                    return (
                      <div
                        key={ev.id}
                        className={`tracker-lane__point ${
                          isSelected ? "is-selected" : ""
                        }`}
                        style={{
                          left: `${leftPct}%`,
                          backgroundColor: evColor,
                        }}
                        title={`${ev.id}: ${ev.text} (${formatSeconds(ev.startSec)})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectEvent(ref, e.shiftKey);
                          onSeek(ev.startSec);
                        }}
                      />
                    );
                  }

                  const startPct = Math.max(
                    0,
                    ((ev.startSec - visibleStart) / visibleSpan) * 100,
                  );
                  const endPct = Math.min(
                    100,
                    (((ev.endSec ?? ev.startSec) - visibleStart) /
                      visibleSpan) *
                      100,
                  );
                  const widthPct = Math.max(0.35, endPct - startPct);

                  return (
                    <div
                      key={ev.id}
                      className={`tracker-lane__item ${
                        isSelected ? "is-selected" : ""
                      }`}
                      style={{
                        left: `${startPct}%`,
                        width: `${widthPct}%`,
                        borderColor: evColor,
                        backgroundColor: isSelected ? "#e7f2f2" : "#ffffff",
                      }}
                      title={`${ev.id}: ${ev.text} (${formatSeconds(
                        ev.startSec,
                      )} – ${formatSeconds(ev.endSec!)})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectEvent(ref, e.shiftKey);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        selectEvent(ref, false);
                        if (ev.endSec !== undefined) {
                          onAuditionRange(ev.startSec, ev.endSec);
                        }
                      }}
                    >
                      <span
                        className="tracker-lane__item-bar"
                        style={{ backgroundColor: evColor }}
                      />
                      <span className="tracker-lane__item-label">
                        {ev.id} {ev.text}
                      </span>
                    </div>
                  );
                })}

                {playheadVisible && (
                  <div
                    className="tracker-playhead tracker-playhead--lane"
                    style={{ left: `${playheadRatio * 100}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </section>
  );
};
