import React, { useState } from "react";
import {
  confirmLyricAndAdvance,
  findNearestCandidate,
  findPlayingOrNearestLyric,
  notifyStore,
  resetInspectorWidth,
  selectTimelineItem,
  selectTrackAndGroup,
  startInspectorResize,
  storeState,
  toggleLoopForLyric,
  toVideoFrame,
  triggerLyricAudition,
  updateLyricEnd,
  updateLyricFields,
  updateLyricStart,
  useWorkbenchStore,
} from "../store/workbenchStore.ts";
import type { ItemStatus } from "../types.ts";

export function LyricsWorkbench(): React.JSX.Element {
  const snap = useWorkbenchStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ItemStatus>("all");

  const allLines = snap.lyrics?.lines || [];
  const playingLine = findPlayingOrNearestLyric(snap.currentTimeSec);

  const filteredLines = allLines.filter((l) => {
    if (snap.selectedGroupId && l.section_id !== snap.selectedGroupId) {
      return false;
    }
    if (statusFilter !== "all" && l.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const hay =
        `${l.id} ${l.section_id} bar ${l.bar} ${l.text} ${l.note || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const selectedLine =
    allLines.find((l) => l.id === snap.selectedLyricId) ||
    filteredLines[0] ||
    null;
  const selGlobalIdx = selectedLine
    ? allLines.findIndex((l) => l.id === selectedLine.id)
    : -1;
  const prevLine = selGlobalIdx > 0 ? allLines[selGlobalIdx - 1] : null;
  const nextLine =
    selGlobalIdx !== -1 && selGlobalIdx + 1 < allLines.length
      ? allLines[selGlobalIdx + 1]
      : null;

  return (
    <div className="wb-workbench-split">
      {/* Left: Aegisub-style Lyric Table */}
      <div className="wb-table-pane">
        <div className="wb-pane-toolbar">
          <div className="wb-toolbar-left">
            <span className="wb-pane-title">
              歌词时间轴对齐表{" "}
              {snap.selectedGroupId ? `(${snap.selectedGroupId})` : "(全曲)"}
            </span>
            {snap.selectedGroupId ? (
              <button
                type="button"
                className="btn btn-mini"
                onClick={() => selectTrackAndGroup("lyrics_main", null)}
              >
                显示全曲 63 句 ×
              </button>
            ) : null}
          </div>
          <div className="wb-toolbar-right">
            <input
              type="search"
              className="wb-search-input"
              placeholder="搜索 L011 / 歌词 / 段落..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | ItemStatus)
              }
            >
              <option value="all">全部状态 ({allLines.length})</option>
              <option value="candidate">待复核 (candidate)</option>
              <option value="confirmed">已确认 (confirmed)</option>
            </select>
          </div>
        </div>

        <div className="wb-table-scroll">
          <table className="wb-grid-table">
            <thead>
              <tr>
                <th style={{ width: "64px" }}>ID</th>
                <th style={{ width: "92px" }}>段落 / 小节</th>
                <th style={{ width: "78px" }}>状态</th>
                <th style={{ width: "86px" }}>句首 (s)</th>
                <th style={{ width: "86px" }}>句尾 (s)</th>
                <th style={{ width: "110px" }}>时长 / 帧区间</th>
                <th>官方双语歌词文本 & 备注</th>
                <th style={{ width: "112px" }}>快速预听</th>
              </tr>
            </thead>
            <tbody>
              {filteredLines.map((line) => {
                const isSelected = selectedLine?.id === line.id;
                const isPlaying = playingLine?.id === line.id;
                const dur = line.end_sec - line.start_sec;
                return (
                  <tr
                    key={line.id}
                    className={`${isSelected ? "is-selected" : ""} ${isPlaying ? "is-playing" : ""}`}
                    onClick={() => selectTimelineItem("lyric", line.id, true)}
                  >
                    <td className="wb-mono-cell">
                      <strong>{line.id}</strong>
                    </td>
                    <td className="wb-mono-cell">
                      {line.section_id} · B{line.bar}
                    </td>
                    <td>
                      <span
                        className={`wb-status-pill ${line.status === "confirmed" ? "confirmed" : "candidate"}`}
                      >
                        {line.status}
                      </span>
                    </td>
                    <td className="wb-mono-cell">
                      {line.start_sec.toFixed(3)}
                    </td>
                    <td className="wb-mono-cell">{line.end_sec.toFixed(3)}</td>
                    <td className="wb-mono-cell wb-muted">
                      {dur.toFixed(2)}s · [{toVideoFrame(line.start_sec)},{" "}
                      {toVideoFrame(line.end_sec)})
                    </td>
                    <td>
                      <div className="wb-table-lyric-text">{line.text}</div>
                      {line.note ? (
                        <div className="wb-table-lyric-note">注: {line.note}</div>
                      ) : null}
                    </td>
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className="wb-table-actions-cell"
                    >
                      <button
                        type="button"
                        className="btn btn-mini"
                        onClick={() => triggerLyricAudition("line", line)}
                        title="只播本句并在句尾自动停住"
                      >
                        本句
                      </button>
                      <button
                        type="button"
                        className="btn btn-mini"
                        onClick={() => triggerLyricAudition("before_end", line)}
                        title="预听句尾前 550ms，检查是否吃进下一句的字"
                      >
                        句尾
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="wb-resizer-v"
        onMouseDown={startInspectorResize}
        onDoubleClick={resetInspectorWidth}
        role="separator"
        aria-orientation="vertical"
        title="左右拖动调整检查器宽度（双击恢复默认宽度）"
      />

      {/* Right: Selected Lyric Precision Inspector */}
      <div
        className="wb-inspector-pane"
        style={{ width: `${snap.inspectorWidth}px` }}
      >
        {!selectedLine ? (
          <div className="wb-empty-inspector">请在左侧表格点击选择一句歌词</div>
        ) : (
          <div className="wb-inspector-content">
            <div className="wb-inspector-header">
              <div>
                <span className="wb-inspector-badge">
                  歌词句对轴 · {selectedLine.id}
                </span>
                <span className="wb-inspector-sub">
                  时长 {(selectedLine.end_sec - selectedLine.start_sec).toFixed(3)}s
                  {" · "}帧 [F{toVideoFrame(selectedLine.start_sec)}, F
                  {toVideoFrame(selectedLine.end_sec)})
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-mini"
                onClick={() => confirmLyricAndAdvance(selectedLine.id)}
                title="标记为 confirmed 并跳到下一句 (G)"
              >
                确认并下一句
              </button>
            </div>

            {/* Adjacent Context Strip */}
            <div className="wb-context-strip">
              <div
                className="wb-context-item"
                onClick={() =>
                  prevLine && selectTimelineItem("lyric", prevLine.id, true)
                }
              >
                <span className="wb-context-label">上一句:</span>
                <span>
                  {prevLine
                    ? `${prevLine.id} [${prevLine.start_sec.toFixed(2)}–${prevLine.end_sec.toFixed(2)}s] ${prevLine.text}`
                    : "（无，当前为首句）"}
                </span>
              </div>
              <div
                className="wb-context-item"
                onClick={() =>
                  nextLine && selectTimelineItem("lyric", nextLine.id, true)
                }
              >
                <span className="wb-context-label">下一句:</span>
                <span>
                  {nextLine
                    ? `${nextLine.id} [${nextLine.start_sec.toFixed(2)}–${nextLine.end_sec.toFixed(2)}s] ${nextLine.text}`
                    : "（无，当前为尾句）"}
                </span>
              </div>
            </div>

            <label className="wb-checkbox-banner">
              <input
                type="checkbox"
                checked={snap.linkAdjacentLyrics}
                onChange={(e) => {
                  storeState.linkAdjacentLyrics = e.target.checked;
                  notifyStore();
                }}
              />
              <span>
                <strong>联动相邻歌词句边界</strong>
                （微调本句句尾时，自动同步紧邻下一句的句首，避免两句重叠或脱节）
              </span>
            </label>

            {/* Start Sec Section */}
            <div className="wb-time-card">
              <div className="wb-time-card-header">
                <span className="wb-time-card-title">
                  句首起点 (Start Sec)
                </span>
                <div className="wb-btn-cluster">
                  <button
                    type="button"
                    className="btn btn-mini"
                    onClick={() =>
                      triggerLyricAudition("before_start", selectedLine)
                    }
                    title="听句首前 500ms [A]"
                  >
                    听句首前0.5s
                  </button>
                  <button
                    type="button"
                    className="btn btn-mini"
                    onClick={() =>
                      triggerLyricAudition("after_start", selectedLine)
                    }
                    title="听句首后 500ms [S]"
                  >
                    听句首后0.5s
                  </button>
                </div>
              </div>
              <div className="wb-time-card-body">
                <input
                  type="number"
                  step={0.001}
                  className="wb-sec-input"
                  value={selectedLine.start_sec}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (Number.isFinite(val)) {
                      updateLyricStart(selectedLine.id, val);
                    }
                  }}
                />
                <div className="wb-nudge-grid">
                  {[-0.05, -0.01, 0.01, 0.05].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      className="btn btn-mini"
                      onClick={() =>
                        updateLyricStart(
                          selectedLine.id,
                          selectedLine.start_sec + delta,
                          undefined,
                          true,
                        )
                      }
                    >
                      {delta > 0 ? `+${delta * 1000}ms` : `${delta * 1000}ms`}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-mini"
                    onClick={() =>
                      updateLyricStart(
                        selectedLine.id,
                        Number(snap.currentTimeSec.toFixed(3)),
                        undefined,
                        true,
                      )
                    }
                  >
                    =取播放头(Q)
                  </button>
                  <button
                    type="button"
                    className="btn btn-mini"
                    onClick={() => {
                      const nearest = findNearestCandidate(
                        selectedLine.start_sec,
                        0.25,
                      );
                      if (nearest) {
                        updateLyricStart(
                          selectedLine.id,
                          nearest.time_sec,
                          nearest.id,
                          true,
                        );
                      }
                    }}
                  >
                    吸附候选
                  </button>
                </div>
              </div>
            </div>

            {/* End Sec Section */}
            <div className="wb-time-card wb-time-card-end">
              <div className="wb-time-card-header">
                <span className="wb-time-card-title">
                  句尾终点 (End Sec)
                </span>
                <div className="wb-btn-cluster">
                  <button
                    type="button"
                    className="btn btn-mini"
                    onClick={() =>
                      triggerLyricAudition("before_end", selectedLine)
                    }
                    title="听句尾前 550ms [D]：确认句尾是否把下一句的字吃进来"
                  >
                    听句尾前0.5s
                  </button>
                  <button
                    type="button"
                    className="btn btn-mini"
                    onClick={() =>
                      triggerLyricAudition("after_end", selectedLine)
                    }
                    title="听句尾后 550ms [F]：确认下一句起音刚好从句尾后开始"
                  >
                    听句尾后0.5s
                  </button>
                </div>
              </div>
              <div className="wb-time-card-body">
                <input
                  type="number"
                  step={0.001}
                  className="wb-sec-input"
                  value={selectedLine.end_sec}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (Number.isFinite(val)) {
                      updateLyricEnd(selectedLine.id, val);
                    }
                  }}
                />
                <div className="wb-nudge-grid">
                  {[-0.05, -0.01, 0.01, 0.05].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      className="btn btn-mini"
                      onClick={() =>
                        updateLyricEnd(
                          selectedLine.id,
                          selectedLine.end_sec + delta,
                          true,
                        )
                      }
                    >
                      {delta > 0 ? `+${delta * 1000}ms` : `${delta * 1000}ms`}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-mini"
                    onClick={() =>
                      updateLyricEnd(
                        selectedLine.id,
                        Number(snap.currentTimeSec.toFixed(3)),
                        true,
                      )
                    }
                  >
                    =取播放头(W)
                  </button>
                  <button
                    type="button"
                    className="btn btn-mini"
                    onClick={() => {
                      const nearest = findNearestCandidate(
                        selectedLine.end_sec,
                        0.25,
                      );
                      if (nearest) {
                        updateLyricEnd(selectedLine.id, nearest.time_sec, true);
                      }
                    }}
                  >
                    吸附候选
                  </button>
                </div>
              </div>
            </div>

            {/* Metadata & Text Fields */}
            <div className="wb-form-row-3">
              <label>
                <span>所属段落</span>
                <input
                  type="text"
                  value={selectedLine.section_id}
                  onChange={(e) =>
                    updateLyricFields(selectedLine.id, {
                      section_id: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>起始小节 (Bar)</span>
                <input
                  type="number"
                  min={1}
                  value={selectedLine.bar}
                  onChange={(e) =>
                    updateLyricFields(selectedLine.id, {
                      bar: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                />
              </label>
              <label>
                <span>状态</span>
                <select
                  value={selectedLine.status}
                  onChange={(e) =>
                    updateLyricFields(selectedLine.id, {
                      status: e.target.value as ItemStatus,
                    })
                  }
                >
                  <option value="candidate">candidate (待复核)</option>
                  <option value="confirmed">confirmed (已确认)</option>
                </select>
              </label>
            </div>

            <label className="wb-block-label">
              <span>歌词文本 (官方英日混排)</span>
              <input
                type="text"
                value={selectedLine.text}
                onChange={(e) =>
                  updateLyricFields(selectedLine.id, { text: e.target.value })
                }
              />
            </label>

            <label className="wb-block-label">
              <span>校对备注 / 声画配合提示</span>
              <textarea
                rows={2}
                value={selectedLine.note || ""}
                placeholder="例如：弱起切入、句尾鼓点停顿、对应镜头动作等..."
                onChange={(e) =>
                  updateLyricFields(selectedLine.id, { note: e.target.value })
                }
              />
            </label>

            <div className="wb-inspector-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => triggerLyricAudition("line", selectedLine)}
              >
                单句精听 (R)
              </button>
              <button
                type="button"
                className={`btn ${snap.loopEnabled && snap.loopingLyricId === selectedLine.id ? "active" : ""}`}
                onClick={() => toggleLoopForLyric(selectedLine)}
              >
                循环本句
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
