import React from "react";
import { findNodeEntryById } from "../../model.ts";
import { useWorkbenchStore } from "../store/workbenchStore.ts";
import { exportEventsToAss, exportEventsToLrc } from "../utils/ass-lrc.ts";
import { findTrackById } from "../../model.ts";

interface HeaderBarProps {
  onSaveServer: () => Promise<void>;
  onReloadServer: () => Promise<void>;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onSaveServer,
  onReloadServer,
}) => {
  const project = useWorkbenchStore((s) => s.project);
  const selectedTrackId = useWorkbenchStore((s) => s.view.selectedTrackId);
  const selectedGroupId = useWorkbenchStore((s) => s.view.selectedGroupId);
  const persistence = useWorkbenchStore((s) => s.persistence);
  const canUndo = useWorkbenchStore((s) => s.edit.canUndo);
  const canRedo = useWorkbenchStore((s) => s.edit.canRedo);
  const undo = useWorkbenchStore((s) => s.undo);
  const redo = useWorkbenchStore((s) => s.redo);

  const activeEntry = selectedTrackId
    ? findNodeEntryById(project.nodes, selectedTrackId)
    : selectedGroupId
      ? findNodeEntryById(project.nodes, selectedGroupId)
      : null;

  const breadcrumb = activeEntry
    ? activeEntry.pathNames.join(" / ")
    : "未选择轨道";

  const triggerDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAss = () => {
    const track =
      (selectedTrackId ? findTrackById(project.nodes, selectedTrackId) : null) ??
      findTrackById(project.nodes, "trk_lyrics");
    const items = track?.items ?? [];
    triggerDownload(`${track?.id ?? "try-me"}.ass`, exportEventsToAss(items));
  };

  const handleExportLrc = () => {
    const track =
      (selectedTrackId ? findTrackById(project.nodes, selectedTrackId) : null) ??
      findTrackById(project.nodes, "trk_lyrics");
    const items = track?.items ?? [];
    triggerDownload(`${track?.id ?? "try-me"}.lrc`, exportEventsToLrc(items));
  };

  return (
    <header className="annotator-header">
      <div className="annotator-header__left">
        <span className="annotator-header__title">{project.name}</span>
        <span className="annotator-header__crumb" title={breadcrumb}>
          {breadcrumb}
        </span>
        <span
          role="status"
          title={persistence.errorMessage ?? undefined}
          className={`annotator-header__status ${
            persistence.errorMessage
              ? "is-error"
              : persistence.dirty
                ? "is-dirty"
                : "is-clean"
          }`}
        >
          {persistence.saving
            ? "正在保存…"
            : persistence.errorMessage
              ? `错误：${persistence.errorMessage}`
              : persistence.dirty
                ? "未保存改动"
                : "已同步"}
        </span>
        {persistence.statusMessage && !persistence.errorMessage && (
          <span className="annotator-header__message">
            {persistence.statusMessage}
          </span>
        )}
      </div>

      <div className="annotator-header__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={undo}
          disabled={!canUndo}
          title="撤销 (Ctrl+Z)"
        >
          撤销
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={redo}
          disabled={!canRedo}
          title="重做 (Ctrl+Y / Ctrl+Shift+Z)"
        >
          重做
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={handleExportAss}
          title="导出当前或歌词轨为 .ASS 字幕"
        >
          导出 ASS
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={handleExportLrc}
          title="导出当前或歌词轨为 .LRC 歌词"
        >
          导出 LRC
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => void onReloadServer()}
          title="从磁盘重新加载 annotations/try-me.timeline.json"
        >
          重载
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void onSaveServer()}
          disabled={persistence.saving}
          title="保存到 annotations/try-me.timeline.json (Ctrl+S)"
        >
          {persistence.saving ? "保存中…" : "保存 (Ctrl+S)"}
        </button>
      </div>
    </header>
  );
};
