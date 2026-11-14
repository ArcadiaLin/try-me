import React, { useState } from "react";
import {
  DEFAULT_RANGE_DURATION_SEC,
  findGroupById,
  findNodeEntryById,
  findTrackById,
  formatSeconds,
  getCommentSummary,
  isNodeEffectivelyLocked,
  isRangeEvent,
  sortTrackItems,
} from "../../model.ts";
import { useWorkbenchStore } from "../store/workbenchStore.ts";
import type { Comment, EventRef, TimelineEvent } from "../types.ts";

const TRACK_COLOR_SWATCHES = [
  "#166b75",
  "#2b6f77",
  "#3f7468",
  "#5b6e78",
  "#6b7c85",
  "#8a6632",
  "#9a5d3b",
  "#7c7294",
];

interface EventListPaneProps {
  onSeek: (sec: number) => void;
  onAuditionRange: (startSec: number, endSec: number) => void;
}

export const EventListPane: React.FC<EventListPaneProps> = ({
  onSeek,
  onAuditionRange,
}) => {
  const project = useWorkbenchStore((s) => s.project);
  const view = useWorkbenchStore((s) => s.view);
  const transport = useWorkbenchStore((s) => s.transport);
  const layout = useWorkbenchStore((s) => s.layout);
  const colorDraft = useWorkbenchStore((s) => s.edit.colorDraft);
  const eventFilterQuery = useWorkbenchStore((s) => s.eventFilterQuery);
  const eventCommentFilter = useWorkbenchStore((s) => s.eventCommentFilter);

  const selectEvent = useWorkbenchStore((s) => s.selectEvent);
  const runWorkbenchCommand = useWorkbenchStore((s) => s.runWorkbenchCommand);
  const runExplorerCommand = useWorkbenchStore((s) => s.runExplorerCommand);
  const openContextMenu = useWorkbenchStore((s) => s.openContextMenu);
  const setLayout = useWorkbenchStore((s) => s.setLayout);
  const setEventFilterQuery = useWorkbenchStore((s) => s.setEventFilterQuery);
  const setEventCommentFilter = useWorkbenchStore((s) => s.setEventCommentFilter);
  const getEffectiveEventColor = useWorkbenchStore((s) => s.getEffectiveEventColor);
  const getEffectiveTrackColor = useWorkbenchStore((s) => s.getEffectiveTrackColor);
  const startColorDraft = useWorkbenchStore((s) => s.startColorDraft);
  const updateColorDraft = useWorkbenchStore((s) => s.updateColorDraft);
  const commitColorDraft = useWorkbenchStore((s) => s.commitColorDraft);
  const cancelColorDraft = useWorkbenchStore((s) => s.cancelColorDraft);
  const resetColorToAuto = useWorkbenchStore((s) => s.resetColorToAuto);

  const [newNodeCommentText, setNewNodeCommentText] = useState("");
  const [newNodeCommentRole, setNewNodeCommentRole] = useState<Comment["role"]>("human");

  void colorDraft;

  const activeTrack = view.selectedTrackId
    ? findTrackById(project.nodes, view.selectedTrackId)
    : null;
  const activeGroup = view.selectedGroupId
    ? findGroupById(project.nodes, view.selectedGroupId)
    : null;
  const activeEntry = view.selectedTrackId
    ? findNodeEntryById(project.nodes, view.selectedTrackId)
    : view.selectedGroupId
      ? findNodeEntryById(project.nodes, view.selectedGroupId)
      : null;

  const isTrackLocked = activeTrack
    ? isNodeEffectivelyLocked(project.nodes, activeTrack.id, view.lockedNodeIds)
    : false;

  const sortedItems = activeTrack ? sortTrackItems(activeTrack.items) : [];
  const q = eventFilterQuery.trim().toLowerCase();

  const filteredItems = sortedItems.filter((ev) => {
    if (
      eventCommentFilter === "commented" &&
      (!ev.comments || ev.comments.length === 0)
    ) {
      return false;
    }
    if (!q) return true;
    return (
      ev.id.toLowerCase().includes(q) ||
      ev.text.toLowerCase().includes(q) ||
      (ev.comments?.some((c) => c.text.toLowerCase().includes(q)) ?? false)
    );
  });

  const handleCreatePointAtPlayhead = () => {
    if (!activeTrack) return;
    runWorkbenchCommand({
      type: "createEvent",
      trackId: activeTrack.id,
      startSec: transport.currentTimeSec,
      text: "新建点事件",
    });
  };

  const handleCreateRangeAtPlayhead = () => {
    if (!activeTrack) return;
    const start = transport.currentTimeSec;
    runWorkbenchCommand({
      type: "createEvent",
      trackId: activeTrack.id,
      startSec: start,
      endSec: Number((start + DEFAULT_RANGE_DURATION_SEC).toFixed(3)),
      text: "新建区间事件",
    });
  };

  const handleAppendNodeComment = (nodeId: string) => {
    const trimmed = newNodeCommentText.trim();
    if (!trimmed) return;
    runWorkbenchCommand({
      type: "appendComment",
      target: { scope: "node", nodeId },
      comment: { role: newNodeCommentRole, text: trimmed },
    });
    setNewNodeCommentText("");
  };

  const isTrackColorDraftActive =
    colorDraft?.target.kind === "track" &&
    activeTrack &&
    colorDraft.target.trackId === activeTrack.id;

  return (
    <main className="event-list-pane">
      {/* Sub-view tabs */}
      <div className="pane-header pane-header--tabs">
        <div className="pane-tabs">
          <button
            type="button"
            className={`pane-tab ${
              layout.activeCenterSubView === "events" ? "is-active" : ""
            }`}
            onClick={() => setLayout({ activeCenterSubView: "events" })}
          >
            事件 ({sortedItems.length})
          </button>
          <button
            type="button"
            className={`pane-tab ${
              layout.activeCenterSubView === "trackSettings" ? "is-active" : ""
            }`}
            onClick={() => setLayout({ activeCenterSubView: "trackSettings" })}
          >
            时间轴设置与评论
          </button>
        </div>

        <div className="pane-header__actions">
          {activeTrack && (
            <>
              <button
                type="button"
                className="btn btn--ghost btn--xs"
                onClick={handleCreatePointAtPlayhead}
                disabled={isTrackLocked}
                title="在当前播放头新建点事件"
              >
                + 点事件
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--xs"
                onClick={handleCreateRangeAtPlayhead}
                disabled={isTrackLocked}
                title="在当前播放头新建区间事件"
              >
                + 区间
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--xs"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  openContextMenu({
                    scope: "events",
                    x: rect.left,
                    y: rect.bottom + 4,
                    anchorTimeSec: transport.currentTimeSec,
                    targetNodeId: activeTrack.id,
                    targetEventRef: view.selection.primary,
                  });
                }}
                title="打开事件操作菜单（新建 / 切分 / 删除）"
              >
                ···
              </button>
            </>
          )}
        </div>
      </div>

      {layout.activeCenterSubView === "events" ? (
        <>
          {/* Filter bar */}
          <div className="event-list-toolbar">
            <input
              type="search"
              className="input input--sm event-list-toolbar__search"
              placeholder="过滤事件 ID、文本或评论内容…"
              value={eventFilterQuery}
              onChange={(e) => setEventFilterQuery(e.target.value)}
            />
            <div className="event-list-toolbar__filters">
              <button
                type="button"
                className={`pill-btn ${
                  eventCommentFilter === "all" ? "is-active" : ""
                }`}
                onClick={() => setEventCommentFilter("all")}
              >
                全部 ({sortedItems.length})
              </button>
              <button
                type="button"
                className={`pill-btn ${
                  eventCommentFilter === "commented" ? "is-active" : ""
                }`}
                onClick={() => setEventCommentFilter("commented")}
              >
                含评论 (
                {
                  sortedItems.filter((i) => i.comments && i.comments.length > 0)
                    .length
                }
                )
              </button>
            </div>
          </div>

          {/* Table Header */}
          <div className="event-table-head">
            <span className="event-table-col event-table-col--main">
              ID / 文本
            </span>
            <span className="event-table-col event-table-col--time">起点</span>
            <span className="event-table-col event-table-col--time">终点</span>
            <span className="event-table-col event-table-col--comments">
              评论
            </span>
          </div>

          {/* Event Rows */}
          <div
            className="event-table-body"
            onContextMenu={(e) => {
              e.preventDefault();
              openContextMenu({
                scope: "events",
                x: e.clientX,
                y: e.clientY,
                anchorTimeSec: transport.currentTimeSec,
                targetNodeId: activeTrack?.id ?? null,
                targetEventRef: view.selection.primary,
              });
            }}
          >
            {!activeTrack ? (
              <div className="event-table-empty">
                请在左侧资源管理器选择一条时间轴查看事件。
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="event-table-empty">
                当前时间轴暂无匹配事件。可点击上方“+ 点事件 / + 区间”或右键新建。
              </div>
            ) : (
              filteredItems.map((ev: TimelineEvent) => {
                const ref: EventRef = {
                  trackId: activeTrack.id,
                  eventId: ev.id,
                };
                const isSelected = view.selection.selected.some(
                  (r) => r.trackId === ref.trackId && r.eventId === ref.eventId
                );
                const isPrimary =
                  view.selection.primary?.trackId === ref.trackId &&
                  view.selection.primary?.eventId === ref.eventId;
                const swatchColor = getEffectiveEventColor(ev, activeTrack);
                const commentSummary = getCommentSummary(ev.comments);
                const isActivePlayhead =
                  isRangeEvent(ev)
                    ? transport.currentTimeSec >= ev.startSec &&
                      transport.currentTimeSec <= (ev.endSec ?? ev.startSec)
                    : Math.abs(transport.currentTimeSec - ev.startSec) < 0.15;

                return (
                  <div
                    key={ev.id}
                    className={`event-row ${isSelected ? "is-selected" : ""} ${
                      isPrimary ? "is-primary" : ""
                    } ${isActivePlayhead ? "is-playing" : ""}`}
                    onClick={(e) => {
                      selectEvent(ref, e.shiftKey);
                    }}
                    onDoubleClick={() => {
                      selectEvent(ref, false);
                      if (ev.endSec !== undefined) {
                        onAuditionRange(ev.startSec, ev.endSec);
                      } else {
                        onSeek(ev.startSec);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isSelected) {
                        selectEvent(ref, false);
                      }
                      openContextMenu({
                        scope: "events",
                        x: e.clientX,
                        y: e.clientY,
                        anchorTimeSec: transport.currentTimeSec,
                        targetNodeId: activeTrack.id,
                        targetEventRef: ref,
                      });
                    }}
                  >
                    <div className="event-table-col event-table-col--main">
                      <span
                        className="event-row__swatch"
                        style={{ backgroundColor: swatchColor }}
                        title={
                          ev.color
                            ? `事件自定义色 ${ev.color}`
                            : `跟随时间轴默认色 ${swatchColor}`
                        }
                      />
                      <span className="event-row__id">{ev.id}</span>
                      <span className="event-row__text" title={ev.text}>
                        {ev.text || "（未命名事件）"}
                      </span>
                    </div>

                    <div className="event-table-col event-table-col--time">
                      {formatSeconds(ev.startSec)}
                    </div>

                    <div className="event-table-col event-table-col--time">
                      {ev.endSec !== undefined ? (
                        formatSeconds(ev.endSec)
                      ) : (
                        <span className="muted">— (点)</span>
                      )}
                    </div>

                    <div className="event-table-col event-table-col--comments">
                      {commentSummary.count > 0 ? (
                        <span
                          className={`comment-badge ${
                            commentSummary.lastRole === "agent"
                              ? "is-agent"
                              : "is-human"
                          }`}
                          title={commentSummary.lastText}
                        >
                          {commentSummary.count} · {commentSummary.lastRoleLabel}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="event-list-footer">
            <span>已选 {view.selection.selected.length} 条</span>
            <details className="pane-help">
              <summary>操作提示</summary>
              <p>双击试听；Shift+单击连选；右键或点击 ··· 新建、切分、删除。</p>
            </details>
          </div>
        </>
      ) : (
        /* Track & Group Settings Sub-View */
        <div className="track-settings-view">
          {activeTrack ? (
            <div className="settings-card">
              <h3 className="settings-card__title" title={activeTrack.id}>
                {activeTrack.name}
              </h3>
              <p className="settings-card__meta">
                所属路径：{activeEntry?.pathNames.join(" / ")} · 共{" "}
                {activeTrack.items.length} 条事件
              </p>

              <div className="form-group">
                <label className="form-label">时间轴名称</label>
                <input
                  type="text"
                  className="input"
                  value={activeTrack.name}
                  disabled={isTrackLocked}
                  onChange={(e) =>
                    runExplorerCommand({
                      type: "renameNode",
                      nodeId: activeTrack.id,
                      name: e.target.value,
                    })
                  }
                />
              </div>

              <div className="form-group">
                <details key={activeTrack.id}>
                  <summary className="wb-color-summary">
                    <span className="wb-section__title">时间轴颜色</span>
                    <span className="color-swatch-lg" style={{ backgroundColor: getEffectiveTrackColor(activeTrack) }} />
                    <span className="muted">
                      {isTrackColorDraftActive ? "预览中" : activeTrack.color ? "自定义" : "默认"}
                    </span>
                  </summary>
                  <div className="wb-color-options">
                    <div className="color-picker-row">
                      <input
                        type="color"
                        aria-label="选择时间轴颜色"
                        className="color-input-native"
                        disabled={isTrackLocked}
                        value={getEffectiveTrackColor(activeTrack)}
                        onFocus={() => {
                          if (!isTrackColorDraftActive) {
                            startColorDraft({
                              kind: "track",
                              trackId: activeTrack.id,
                            });
                          }
                        }}
                        onChange={(e) => {
                          if (!isTrackColorDraftActive) {
                            startColorDraft({
                              kind: "track",
                              trackId: activeTrack.id,
                            });
                          }
                          updateColorDraft(e.target.value);
                        }}
                      />
                      <span className="color-code-badge">
                        {getEffectiveTrackColor(activeTrack)}
                      </span>
                      <button
                        type="button"
                        className="btn btn--ghost btn--xs"
                        disabled={isTrackLocked || (!activeTrack.color && !isTrackColorDraftActive)}
                        onClick={() =>
                          resetColorToAuto({
                            kind: "track",
                            trackId: activeTrack.id,
                          })
                        }
                      >
                        恢复默认
                      </button>
                    </div>

                    <div className="color-swatches-bar">
                      {TRACK_COLOR_SWATCHES.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          className="color-preset-btn"
                          style={{ backgroundColor: hex }}
                          disabled={isTrackLocked}
                          title={`预览颜色 ${hex}`}
                          onClick={() => {
                            if (!isTrackColorDraftActive) {
                              startColorDraft({ kind: "track", trackId: activeTrack.id });
                            }
                            updateColorDraft(hex);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </details>
                {isTrackColorDraftActive && (
                  <div className="color-picker-row color-draft-actions" role="group" aria-label="时间轴颜色预览操作">
                    <button type="button" className="btn btn--primary btn--xs" disabled={isTrackLocked} onClick={commitColorDraft}>
                      确认颜色
                    </button>
                    <button type="button" className="btn btn--ghost btn--xs" onClick={cancelColorDraft}>
                      取消预览
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  时间轴评论 ({activeTrack.comments?.length ?? 0})
                </label>
                <div className="comments-thread">
                  {(!activeTrack.comments ||
                    activeTrack.comments.length === 0) && (
                    <div className="comments-empty">暂无时间轴级评论。</div>
                  )}
                  {activeTrack.comments?.map((c, idx) => (
                    <div
                      key={idx}
                      className={`comment-item ${
                        c.role === "agent" ? "is-agent" : "is-human"
                      }`}
                    >
                      <span className="comment-item__role">
                        {c.role === "agent" ? "Agent" : "人类"}
                      </span>
                      <span className="comment-item__text">{c.text}</span>
                    </div>
                  ))}
                </div>
                <div className="comment-composer">
                  <select
                    className="select select--sm"
                    value={newNodeCommentRole}
                    onChange={(e) =>
                      setNewNodeCommentRole(e.target.value as Comment["role"])
                    }
                  >
                    <option value="human">人类</option>
                    <option value="agent">Agent</option>
                  </select>
                  <input
                    type="text"
                    className="input input--sm"
                    placeholder="添加关于此时间轴的备注或协作说明…"
                    value={newNodeCommentText}
                    disabled={isTrackLocked}
                    onChange={(e) => setNewNodeCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAppendNodeComment(activeTrack.id);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={isTrackLocked || !newNodeCommentText.trim()}
                    onClick={() => handleAppendNodeComment(activeTrack.id)}
                  >
                    追加
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {activeGroup ? (
            <div className="settings-card">
              <h3 className="settings-card__title" title={activeGroup.id}>
                所属分组：{activeGroup.name}
              </h3>
              <div className="form-group">
                <label className="form-label">
                  分组评论 ({activeGroup.comments?.length ?? 0})
                </label>
                <div className="comments-thread">
                  {(!activeGroup.comments ||
                    activeGroup.comments.length === 0) && (
                    <div className="comments-empty">暂无分组级评论。</div>
                  )}
                  {activeGroup.comments?.map((c, idx) => (
                    <div
                      key={idx}
                      className={`comment-item ${
                        c.role === "agent" ? "is-agent" : "is-human"
                      }`}
                    >
                      <span className="comment-item__role">
                        {c.role === "agent" ? "Agent" : "人类"}
                      </span>
                      <span className="comment-item__text">{c.text}</span>
                    </div>
                  ))}
                </div>
                <div className="comment-composer">
                  <select
                    className="select select--sm"
                    value={newNodeCommentRole}
                    onChange={(e) =>
                      setNewNodeCommentRole(e.target.value as Comment["role"])
                    }
                  >
                    <option value="human">人类</option>
                    <option value="agent">Agent</option>
                  </select>
                  <input
                    type="text"
                    className="input input--sm"
                    placeholder="添加关于此分组的备注或草案说明…"
                    value={newNodeCommentText}
                    onChange={(e) => setNewNodeCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAppendNodeComment(activeGroup.id);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={!newNodeCommentText.trim()}
                    onClick={() => handleAppendNodeComment(activeGroup.id)}
                  >
                    追加分组评论
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
};
