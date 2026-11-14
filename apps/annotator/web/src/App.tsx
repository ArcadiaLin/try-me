import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  findEventByRef,
  migrateLegacyToTimelineProject,
  validateAndNormalizeProject,
} from "../model.ts";
import { AgentBriefDrawer } from "./components/AgentBriefDrawer.tsx";
import { AudioTimelineStage } from "./components/AudioTimelineStage.tsx";
import { ContextMenuLayer } from "./components/ContextMenuLayer.tsx";
import { EventListPane } from "./components/EventListPane.tsx";
import { HeaderBar } from "./components/HeaderBar.tsx";
import { TimelineExplorer } from "./components/TimelineExplorer.tsx";
import { UnifiedWorkbench } from "./components/UnifiedWorkbench.tsx";
import { useWorkbenchStore } from "./store/workbenchStore.ts";
import type { AnalysisBundle, TimelineProject } from "./types.ts";
import { clearLocalDraft, loadLocalDraft } from "./utils/idb-draft.ts";

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return false;
}

export const App: React.FC = () => {
  const view = useWorkbenchStore((s) => s.view);
  const transport = useWorkbenchStore((s) => s.transport);
  const layout = useWorkbenchStore((s) => s.layout);

  const hydrate = useWorkbenchStore((s) => s.hydrate);
  const replaceProject = useWorkbenchStore((s) => s.replaceProject);
  const setCurrentTimeSec = useWorkbenchStore((s) => s.setCurrentTimeSec);
  const setIsPlaying = useWorkbenchStore((s) => s.setIsPlaying);
  const setLoopEnabled = useWorkbenchStore((s) => s.setLoopEnabled);
  const setLoopRange = useWorkbenchStore((s) => s.setLoopRange);
  const setLayout = useWorkbenchStore((s) => s.setLayout);
  const setPersistence = useWorkbenchStore((s) => s.setPersistence);
  const runWorkbenchCommand = useWorkbenchStore((s) => s.runWorkbenchCommand);
  const openContextMenu = useWorkbenchStore((s) => s.openContextMenu);
  const undo = useWorkbenchStore((s) => s.undo);
  const redo = useWorkbenchStore((s) => s.redo);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const auditionStopAtRef = useRef<number | null>(null);
  const [resizingSplitter, setResizingSplitter] = useState<
    "tracker" | "explorer" | "list" | null
  >(null);

  // Load initial data from /api/analysis and /api/annotations
  const loadFromServer = useCallback(async () => {
    try {
      setPersistence({ statusMessage: "正在加载数据…", errorMessage: null });
      const [analysisRes, annotationsRes] = await Promise.all([
        fetch("/api/analysis"),
        fetch("/api/annotations"),
      ]);

      const analysisData: AnalysisBundle | null = analysisRes.ok
        ? ((await analysisRes.json()) as AnalysisBundle)
        : null;

      if (!annotationsRes.ok) {
        throw new Error(`加载 /api/annotations 失败 (${annotationsRes.status})`);
      }

      const payload = (await annotationsRes.json()) as {
        project?: unknown;
        annotations?: unknown;
        agentBriefMarkdown?: string;
        savedAt?: string;
      };

      const rawProject = payload.project ?? payload.annotations ?? payload;
      const loadedProject: TimelineProject =
        rawProject &&
        typeof rawProject === "object" &&
        "version" in (rawProject as Record<string, unknown>)
          ? validateAndNormalizeProject(rawProject)
          : migrateLegacyToTimelineProject(rawProject);

      const draft = await loadLocalDraft().catch(() => null);
      hydrate({
        project: loadedProject,
        analysis: analysisData,
        agentBriefMarkdown: payload.agentBriefMarkdown,
        savedAt: payload.savedAt ?? null,
        hasLocalDraft: Boolean(draft),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPersistence({
        errorMessage: msg,
        statusMessage: `加载失败：${msg}`,
      });
    }
  }, [hydrate, setPersistence]);

  useEffect(() => {
    void loadFromServer();
  }, [loadFromServer]);

  // Save to server
  const handleSaveServer = useCallback(async () => {
    const currentProject = useWorkbenchStore.getState().project;
    try {
      setPersistence({
        saving: true,
        statusMessage: "正在保存到 annotations/try-me.timeline.json…",
        errorMessage: null,
      });
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: currentProject }),
      });
      const body = (await res.json()) as {
        error?: string;
        project?: TimelineProject;
        agentBriefMarkdown?: string;
        savedAt?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await clearLocalDraft().catch(() => undefined);
      if (body.project) {
        replaceProject(body.project, "已保存到磁盘", false);
      }
      setPersistence({
        dirty: false,
        saving: false,
        hasLocalDraft: false,
        lastSavedAt: body.savedAt ?? new Date().toISOString(),
        statusMessage: "已保存至 annotations/try-me.timeline.json",
        errorMessage: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPersistence({
        saving: false,
        errorMessage: msg,
        statusMessage: `保存失败：${msg}`,
      });
    }
  }, [replaceProject, setPersistence]);

  // Audio playback controls
  const handleSeek = useCallback(
    (sec: number) => {
      auditionStopAtRef.current = null;
      const clamped = Math.max(0, sec);
      setCurrentTimeSec(clamped);
      const audio = audioRef.current;
      if (audio) {
        try {
          audio.currentTime = clamped;
        } catch {
          // Ignore seek errors when audio source is not ready
        }
      }
    },
    [setCurrentTimeSec]
  );

  const handleTogglePlay = useCallback(() => {
    auditionStopAtRef.current = null;
    const audio = audioRef.current;
    if (!audio) {
      setIsPlaying(!transport.isPlaying);
      return;
    }
    if (audio.paused) {
      audio.play().then(
        () => setIsPlaying(true),
        () => setIsPlaying(false)
      );
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [setIsPlaying, transport.isPlaying]);

  const handleStop = useCallback(() => {
    auditionStopAtRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      try {
        audio.currentTime = view.visibleStartSec;
      } catch {
        // Ignore
      }
    }
    setIsPlaying(false);
    setCurrentTimeSec(view.visibleStartSec);
  }, [setCurrentTimeSec, setIsPlaying, view.visibleStartSec]);

  const handleAuditionWindow = useCallback(
    (startSec: number, endSec: number) => {
      const safeStart = Math.max(0, startSec);
      const safeEnd = Math.max(safeStart + 0.05, endSec);
      auditionStopAtRef.current = safeEnd;
      setCurrentTimeSec(safeStart);
      const audio = audioRef.current;
      if (audio) {
        try {
          audio.currentTime = safeStart;
          void audio.play().then(
            () => setIsPlaying(true),
            () => setIsPlaying(false)
          );
        } catch {
          // Ignore
        }
      }
    },
    [setCurrentTimeSec, setIsPlaying]
  );

  const handleAuditionRangeLoop = useCallback(
    (startSec: number, endSec: number) => {
      setLoopRange([startSec, endSec]);
      setLoopEnabled(true);
      handleAuditionWindow(startSec, endSec);
    },
    [handleAuditionWindow, setLoopEnabled, setLoopRange]
  );

  // Sync audio element timeupdate with transport & loop/audition bounds
  useEffect(() => {
    const audio = new Audio("/api/audio");
    audio.preload = "metadata";
    audioRef.current = audio;

    const onTimeUpdate = () => {
      const cur = audio.currentTime;
      const state = useWorkbenchStore.getState();
      if (
        auditionStopAtRef.current !== null &&
        cur >= auditionStopAtRef.current
      ) {
        auditionStopAtRef.current = null;
        if (
          state.transport.loopEnabled &&
          state.transport.loopRange &&
          cur >= state.transport.loopRange[1]
        ) {
          audio.currentTime = state.transport.loopRange[0];
          setCurrentTimeSec(state.transport.loopRange[0]);
          return;
        }
        audio.pause();
        setIsPlaying(false);
        setCurrentTimeSec(cur);
        return;
      }

      if (state.transport.loopEnabled && state.transport.loopRange) {
        const [loopStart, loopEnd] = state.transport.loopRange;
        if (cur >= loopEnd) {
          audio.currentTime = loopStart;
          setCurrentTimeSec(loopStart);
          return;
        }
      }

      setCurrentTimeSec(cur);
    };

    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [setCurrentTimeSec, setIsPlaying]);

  // Global keyboard shortcuts (disabled when typing in inputs)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSaveServer();
        return;
      }

      if (isEditableElement(e.target)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === " ") {
        e.preventDefault();
        handleTogglePlay();
        return;
      }

      const state = useWorkbenchStore.getState();
      const primaryRef = state.view.selection.primary;
      const found = findEventByRef(state.project, primaryRef);

      if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
        e.preventDefault();
        openContextMenu({
          scope: "events",
          x: Math.round(window.innerWidth * 0.45),
          y: Math.round(window.innerHeight * 0.45),
          anchorTimeSec: state.transport.currentTimeSec,
          targetNodeId: state.view.selectedTrackId,
          targetEventRef: primaryRef,
        });
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (state.view.selection.selected.length > 0) {
          e.preventDefault();
          runWorkbenchCommand({
            type: "delete",
            refs: state.view.selection.selected,
          });
        }
        return;
      }

      if (!found || !primaryRef) return;
      const ev = found.event;

      if (e.key === "[") {
        e.preventDefault();
        runWorkbenchCommand({
          type: "setBoundary",
          ref: primaryRef,
          edge: "start",
          timeSec: state.transport.currentTimeSec,
        });
        return;
      }
      if (e.key === "]") {
        e.preventDefault();
        runWorkbenchCommand({
          type: "setBoundary",
          ref: primaryRef,
          edge: "end",
          timeSec: state.transport.currentTimeSec,
        });
        return;
      }

      const lower = e.key.toLowerCase();
      if (lower === "a") {
        e.preventDefault();
        handleAuditionWindow(Math.max(0, ev.startSec - 0.5), ev.startSec);
      } else if (lower === "s") {
        e.preventDefault();
        handleAuditionWindow(ev.startSec, ev.startSec + 0.5);
      } else if (lower === "r") {
        e.preventDefault();
        handleAuditionWindow(ev.startSec, ev.endSec ?? ev.startSec + 0.8);
      } else if (lower === "d" && ev.endSec !== undefined) {
        e.preventDefault();
        handleAuditionWindow(Math.max(ev.startSec, ev.endSec - 0.5), ev.endSec);
      } else if (lower === "f" && ev.endSec !== undefined) {
        e.preventDefault();
        handleAuditionWindow(ev.endSec, ev.endSec + 0.5);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    handleAuditionWindow,
    handleSaveServer,
    handleTogglePlay,
    openContextMenu,
    redo,
    runWorkbenchCommand,
    undo,
  ]);

  // Splitter drag handling
  useEffect(() => {
    if (!resizingSplitter) return;
    const onMove = (e: MouseEvent) => {
      if (resizingSplitter === "tracker") {
        const nextHeight = Math.max(210, Math.min(520, e.clientY - 46));
        setLayout({ trackerHeightPx: nextHeight });
      } else if (resizingSplitter === "explorer") {
        const nextWidth = Math.max(220, Math.min(480, e.clientX));
        setLayout({ explorerWidthPx: nextWidth });
      } else if (resizingSplitter === "list") {
        const currentExplorer = useWorkbenchStore.getState().layout.explorerWidthPx;
        const nextListWidth = Math.max(
          360,
          Math.min(960, e.clientX - currentExplorer - 6)
        );
        setLayout({ listWidthPx: nextListWidth });
      }
    };
    const onUp = () => setResizingSplitter(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizingSplitter, setLayout]);

  return (
    <div className="annotator-shell">
      <HeaderBar
        onSaveServer={handleSaveServer}
        onReloadServer={loadFromServer}
      />

      <AudioTimelineStage
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        onSeek={handleSeek}
        onAuditionRange={handleAuditionRangeLoop}
      />

      {/* Horizontal Splitter between Tracker and 3-Column Workspace */}
      <div
        className="splitter splitter--horizontal"
        onMouseDown={() => setResizingSplitter("tracker")}
        title="拖动调整上方多轨时间轴高度"
      />

      {/* 3-Column Workspace: Explorer | Event List | Unified Workbench */}
      <div
        className="annotator-workspace"
        style={{
          gridTemplateColumns: `${layout.explorerWidthPx}px 6px ${layout.listWidthPx}px 6px minmax(340px, 1fr)`,
        }}
      >
        <TimelineExplorer />

        <div
          className="splitter splitter--vertical"
          onMouseDown={() => setResizingSplitter("explorer")}
          title="拖动调整资源管理器宽度"
        />

        <EventListPane
          onSeek={handleSeek}
          onAuditionRange={handleAuditionRangeLoop}
        />

        <div
          className="splitter splitter--vertical"
          onMouseDown={() => setResizingSplitter("list")}
          title="拖动调整事件列表与工作台宽度"
        />

        <UnifiedWorkbench
          onSeek={handleSeek}
          onAuditionWindow={handleAuditionWindow}
        />
      </div>

      <AgentBriefDrawer onSeek={handleSeek} />

      <ContextMenuLayer />
    </div>
  );
};
