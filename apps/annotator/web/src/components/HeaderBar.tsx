import React, { useEffect, useRef, useState } from "react";
import {
  exportSubtitleFile,
  getSampleRate,
  importSubtitleContent,
  notifyStore,
  performRedo,
  performUndo,
  reloadAnnotations,
  saveAnnotations,
  saveLyrics,
  scheduleAutoSave,
  setSaveStatus,
  storeState,
  toVideoFrame,
  useWorkbenchStore,
} from "../store/workbenchStore.ts";
import { formatTimeDisplay } from "../utils/ass-lrc.ts";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface HeaderBarProps {
  onPlayPause: () => void;
  onStop: () => void;
  onRateChange: (rate: number) => void;
}

export function HeaderBar({
  onPlayPause,
  onStop,
  onRateChange,
}: HeaderBarProps): React.JSX.Element {
  const snap = useWorkbenchStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const currentSec = snap.currentTimeSec;
  const sampleIdx = Math.round(currentSec * getSampleRate());
  const frameIdx = toVideoFrame(currentSec);

  const openAgentItemsCount =
    (snap.annotations?.regions.filter(
      (r) => r.agent_comment || r.agent_status === "open",
    ).length || 0) +
    (snap.annotations?.markers.filter(
      (m) => m.agent_comment || m.agent_status === "open",
    ).length || 0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { count } = importSubtitleContent(file.name, text);
      setSaveStatus(`✓ 已从 ${file.name} 导入 ${count} 句时间轴并自动保存`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveStatus(`导入失败: ${msg}`, true);
    } finally {
      e.target.value = "";
    }
  };

  const handleSaveAll = () => {
    if (storeState.lyricsSaveTimer) {
      clearTimeout(storeState.lyricsSaveTimer);
      storeState.lyricsSaveTimer = null;
    }
    void saveLyrics();
    void saveAnnotations(false);
  };

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setDeferredPrompt(null);
  };

  return (
    <header className="wb-header">
      <div className="wb-brand">
        <span className="wb-badge-pwa">PWA</span>
        <span className="wb-brand-title">Try Me · 多轨时间轴对轴台</span>
      </div>

      <div className="wb-transport-group">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onPlayPause}
          title="播放/暂停 (Space)"
        >
          {snap.isPlaying ? "暂停" : "播放"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={onStop}
          title="停止并回到起点"
        >
          停止
        </button>
        <label className="wb-inline-field">
          <span>倍速</span>
          <select
            value={String(snap.playbackRate)}
            onChange={(e) => onRateChange(Number(e.target.value))}
          >
            <option value="0.5">0.5× (精听切点)</option>
            <option value="0.75">0.75× (慢放对轴)</option>
            <option value="1">1.0× (原速)</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
          </select>
        </label>
        <button
          type="button"
          className={`btn ${snap.clickTrackEnabled ? "active" : ""}`}
          onClick={() => {
            storeState.clickTrackEnabled = !storeState.clickTrackEnabled;
            notifyStore();
          }}
          title="开启或关闭已标注拍点的合成节拍器提示音 (K)"
        >
          节拍音: {snap.clickTrackEnabled ? "开" : "关"}
        </button>
        <button
          type="button"
          className={`btn ${snap.snapEnabled ? "active" : ""}`}
          onClick={() => {
            storeState.snapEnabled = !storeState.snapEnabled;
            notifyStore();
          }}
          title="拖拽边界时自动吸附 35ms 内的候选起音/拍点"
        >
          磁吸: {snap.snapEnabled ? "开" : "关"}
        </button>
      </div>

      <div className="wb-readout-box">
        <span className="wb-readout-main">{formatTimeDisplay(currentSec)}</span>
        <span className="wb-readout-sub">({currentSec.toFixed(3)}s)</span>
        <span className="wb-readout-divider">|</span>
        <span className="wb-readout-sub" title="采样帧位置 (44.1kHz)">
          Smp {sampleIdx}
        </span>
        <span className="wb-readout-divider">|</span>
        <span className="wb-readout-frame" title="Remotion 全曲预览帧">
          F{frameIdx}
        </span>
        <label className="wb-inline-field" title="预览帧率 FPS">
          <span>FPS</span>
          <input
            type="number"
            min={1}
            max={240}
            value={snap.annotations?.preview_mapping?.preview_fps ?? 30}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (
                !storeState.annotations ||
                !Number.isFinite(raw) ||
                raw < 1 ||
                raw > 240
              ) {
                return;
              }
              storeState.editSeq += 1;
              storeState.annotations.preview_mapping.preview_fps =
                Math.round(raw);
              scheduleAutoSave();
              notifyStore();
            }}
          />
        </label>
      </div>

      <div className="wb-actions-group">
        <input
          ref={fileInputRef}
          type="file"
          accept=".ass,.lrc"
          style={{ display: "none" }}
          onChange={(e) => {
            void handleFileChange(e);
          }}
        />
        <button
          type="button"
          className="btn btn-subtle"
          onClick={() => fileInputRef.current?.click()}
          title="从 Aegisub (.ass) 或 .lrc 导入歌词时间轴"
        >
          导入 ASS/LRC
        </button>
        <button
          type="button"
          className="btn btn-subtle"
          onClick={() => exportSubtitleFile("ass")}
          title="导出为 Aegisub (.ass) 字幕文件，支持随时在 Aegisub 中编辑后再导回"
        >
          导出 .ass
        </button>
        <button
          type="button"
          className="btn btn-subtle"
          onClick={() => exportSubtitleFile("lrc")}
          title="导出标准 .lrc 歌词文件"
        >
          导出 .lrc
        </button>

        <button
          type="button"
          className="btn"
          disabled={snap.undoStack.length === 0}
          onClick={performUndo}
          title="撤销 (Ctrl+Z)"
        >
          撤销
        </button>
        <button
          type="button"
          className="btn"
          disabled={snap.redoStack.length === 0}
          onClick={performRedo}
          title="重做 (Ctrl+Y)"
        >
          重做
        </button>

        <span
          className={`wb-save-status ${snap.saveStatusError ? "is-error" : ""}`}
        >
          {snap.saveStatusText}
        </span>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSaveAll}
          title="立即保存标注与歌词轴 (Ctrl+S)"
        >
          保存
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            void reloadAnnotations();
          }}
          title="从磁盘重新读取最新标注与歌词"
        >
          重载
        </button>
        <button
          type="button"
          className={`btn ${snap.agentDrawerOpen ? "active" : ""}`}
          onClick={() => {
            storeState.agentDrawerOpen = !storeState.agentDrawerOpen;
            notifyStore();
          }}
          title="展开/收起底部 Agent 协作抽屉"
        >
          Agent 协同
          {openAgentItemsCount > 0 ? ` (${openAgentItemsCount})` : ""}
        </button>
        {deferredPrompt ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              void handleInstallPwa();
            }}
            title="将此工作台安装为独立桌面窗口应用"
          >
            安装桌面端
          </button>
        ) : null}
      </div>
    </header>
  );
}
