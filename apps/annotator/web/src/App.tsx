import React, { useCallback, useEffect, useState } from "react";
import { AgentBriefDrawer } from "./components/AgentBriefDrawer.tsx";
import { AudioTimelineStage } from "./components/AudioTimelineStage.tsx";
import { HeaderBar } from "./components/HeaderBar.tsx";
import { LyricsWorkbench } from "./components/LyricsWorkbench.tsx";
import { RhythmWorkbench } from "./components/RhythmWorkbench.tsx";
import { StructureWorkbench } from "./components/StructureWorkbench.tsx";
import { TimelineExplorer } from "./components/TimelineExplorer.tsx";
import {
  addPointMarker,
  applyServerState,
  confirmLyricAndAdvance,
  deleteSelectedItem,
  getAudioDuration,
  notifyStore,
  performRedo,
  performUndo,
  saveAnnotations,
  saveLyrics,
  seekAudio,
  selectTimelineItem,
  setPlaybackRate,
  setSaveStatus,
  stopPlayback,
  storeState,
  togglePlayPause,
  triggerLyricAudition,
  updateLyricEnd,
  updateLyricStart,
  useWorkbenchStore,
} from "./store/workbenchStore.ts";
import type { ServerStatePayload } from "./types.ts";
import { loadIdbDraft } from "./utils/idb-draft.ts";

const EXPLORER_WIDTH_KEY = "try_me_wb_explorer_width";
const DEFAULT_EXPLORER_WIDTH = 290;
const MIN_EXPLORER_WIDTH = 180;
const MAX_EXPLORER_WIDTH = 560;

function readInitialExplorerWidth(): number {
  try {
    const raw = Number(window.localStorage.getItem(EXPLORER_WIDTH_KEY));
    if (Number.isFinite(raw) && raw >= MIN_EXPLORER_WIDTH && raw <= MAX_EXPLORER_WIDTH) {
      return Math.round(raw);
    }
  } catch {
    // Ignore storage read errors
  }
  return DEFAULT_EXPLORER_WIDTH;
}

export function App(): React.JSX.Element {
  const snap = useWorkbenchStore();
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);
  const [explorerWidth, setExplorerWidth] = useState<number>(readInitialExplorerWidth);
  const [isDraggingExplorer, setIsDraggingExplorer] = useState(false);

  const updateExplorerWidth = useCallback((nextWidth: number) => {
    const clamped = Math.max(
      MIN_EXPLORER_WIDTH,
      Math.min(MAX_EXPLORER_WIDTH, Math.round(nextWidth)),
    );
    setExplorerWidth(clamped);
    try {
      window.localStorage.setItem(EXPLORER_WIDTH_KEY, String(clamped));
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const handleExplorerResizeStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = explorerWidth;
      setIsDraggingExplorer(true);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (moveEv: MouseEvent) => {
        const deltaX = moveEv.clientX - startX;
        updateExplorerWidth(startWidth + deltaX);
      };

      const onMouseUp = () => {
        setIsDraggingExplorer(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [explorerWidth, updateExplorerWidth],
  );

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const res = await fetch("/api/state");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const initial = (await res.json()) as ServerStatePayload;
        if (cancelled) return;
        applyServerState(initial);

        // Check if IndexedDB has an unsynced draft from an earlier disconnected session
        const draft = await loadIdbDraft();
        if (
          draft &&
          draft.hasUnsyncedChanges &&
          draft.revision === initial.revision
        ) {
          if (draft.lyricsLines && draft.lyricsLines.length > 0) {
            storeState.lyrics = {
              ...storeState.lyrics,
              lines: draft.lyricsLines,
            };
            void saveLyrics();
          }
          storeState.offlineDraftRestored = true;
          setSaveStatus("✓ 已自动恢复断连期间的本地草稿并同步");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setSaveStatus(`服务连接异常 (${msg})，尝试读取离线草稿...`, true);
        const draft = await loadIdbDraft();
        if (draft && draft.annotations) {
          storeState.annotations = draft.annotations;
          if (draft.lyricsLines) {
            storeState.lyrics = {
              available: true,
              lines: draft.lyricsLines,
            };
          }
          notifyStore();
        }
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      const isEditingText =
        tag === "input" || tag === "textarea" || tag === "select";

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (storeState.lyricsSaveTimer) {
          clearTimeout(storeState.lyricsSaveTimer);
          storeState.lyricsSaveTimer = null;
        }
        void saveLyrics();
        void saveAnnotations(false);
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

      const keyLower = e.key.toLowerCase();
      if (e.code === "Space") {
        e.preventDefault();
        togglePlayPause();
      } else if (keyLower === "r") {
        e.preventDefault();
        triggerLyricAudition("line");
      } else if (keyLower === "a") {
        e.preventDefault();
        triggerLyricAudition("before_start");
      } else if (keyLower === "s") {
        e.preventDefault();
        triggerLyricAudition("after_start");
      } else if (keyLower === "d") {
        e.preventDefault();
        triggerLyricAudition("before_end");
      } else if (keyLower === "f") {
        e.preventDefault();
        triggerLyricAudition("after_end");
      } else if (keyLower === "q") {
        e.preventDefault();
        if (storeState.selectedLyricId) {
          updateLyricStart(
            storeState.selectedLyricId,
            Number(storeState.currentTimeSec.toFixed(3)),
            undefined,
            true,
          );
        }
      } else if (keyLower === "w") {
        e.preventDefault();
        if (storeState.selectedLyricId) {
          updateLyricEnd(
            storeState.selectedLyricId,
            Number(storeState.currentTimeSec.toFixed(3)),
            true,
          );
        }
      } else if (keyLower === "g") {
        e.preventDefault();
        confirmLyricAndAdvance();
      } else if (keyLower === "b") {
        e.preventDefault();
        addPointMarker({
          timeSec: storeState.currentTimeSec,
          category: "downbeat",
        });
      } else if (keyLower === "m") {
        e.preventDefault();
        addPointMarker({
          timeSec: storeState.currentTimeSec,
          category: "beat",
        });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelectedItem();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const step = e.shiftKey ? 0.1 : e.altKey ? 0.001 : 0.01;
        const next = Math.max(
          0,
          Math.min(getAudioDuration(), storeState.currentTimeSec + dir * step),
        );
        seekAudio(next);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const lines = storeState.lyrics?.lines || [];
        if (storeState.activeTrackId === "lyrics_main" && lines.length > 0) {
          e.preventDefault();
          const curIdx = lines.findIndex(
            (l) => l.id === storeState.selectedLyricId,
          );
          const nextIdx =
            e.key === "ArrowDown"
              ? Math.min(lines.length - 1, curIdx + 1)
              : Math.max(0, curIdx - 1);
          if (lines[nextIdx]) {
            selectTimelineItem("lyric", lines[nextIdx].id, true);
          }
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const renderActiveWorkbench = () => {
    if (
      snap.activeTrackId === "structure_sections" ||
      snap.activeTrackId === "structure_clips"
    ) {
      return <StructureWorkbench />;
    }
    if (
      snap.activeTrackId === "rhythm_downbeats" ||
      snap.activeTrackId === "rhythm_markers"
    ) {
      return <RhythmWorkbench />;
    }
    return <LyricsWorkbench />;
  };

  return (
    <div className="wb-app-shell">
      <HeaderBar
        onPlayPause={togglePlayPause}
        onStop={stopPlayback}
        onRateChange={setPlaybackRate}
      />

      <AudioTimelineStage />

      <main className="wb-bottom-workspace">
        <TimelineExplorer
          width={explorerWidth}
          collapsed={explorerCollapsed}
          onToggleCollapse={() => setExplorerCollapsed((c) => !c)}
        />
        {!explorerCollapsed ? (
          <div
            className={`wb-resizer-v ${isDraggingExplorer ? "is-dragging" : ""}`}
            onMouseDown={handleExplorerResizeStart}
            onDoubleClick={() => updateExplorerWidth(DEFAULT_EXPLORER_WIDTH)}
            role="separator"
            aria-orientation="vertical"
            title="左右拖动调整资源管理器宽度（双击恢复默认宽度）"
          />
        ) : null}
        <section className="wb-main-editor">{renderActiveWorkbench()}</section>
      </main>

      <AgentBriefDrawer />
    </div>
  );
}
