import React, { useEffect, useState } from "react";
import {
  DEFAULT_RANGE_DURATION_SEC,
  findBoundaryLinksForEvent,
  findEventByRef,
  flattenTracks,
  formatSeconds,
  getAdjacentRangeEvents,
  isNodeEffectivelyLocked,
  isRangeEvent,
  parseTimeInput,
} from "../../model.ts";
import { useWorkbenchStore } from "../store/workbenchStore.ts";
import type { BoundaryLink, Comment } from "../types.ts";

const EVENT_COLOR_SWATCHES = [
  "#166b75",
  "#2b6f77",
  "#3f7468",
  "#5b6e78",
  "#6b7c85",
  "#8a6632",
  "#ad754b",
  "#7c7294",
];

interface UnifiedWorkbenchProps {
  onSeek: (sec: number) => void;
  onAuditionWindow: (startSec: number, endSec: number) => void;
}

export const UnifiedWorkbench: React.FC<UnifiedWorkbenchProps> = ({
  onSeek,
  onAuditionWindow,
}) => {
  const project = useWorkbenchStore((s) => s.project);
  const view = useWorkbenchStore((s) => s.view);
  const transport = useWorkbenchStore((s) => s.transport);
  const edit = useWorkbenchStore((s) => s.edit);

  const runWorkbenchCommand = useWorkbenchStore((s) => s.runWorkbenchCommand);
  const moveEventToAnotherTrack = useWorkbenchStore(
    (s) => s.moveEventToAnotherTrack
  );
  const selectNextEvent = useWorkbenchStore((s) => s.selectNextEvent);
  const startColorDraft = useWorkbenchStore((s) => s.startColorDraft);
  const updateColorDraft = useWorkbenchStore((s) => s.updateColorDraft);
  const commitColorDraft = useWorkbenchStore((s) => s.commitColorDraft);
  const cancelColorDraft = useWorkbenchStore((s) => s.cancelColorDraft);
  const resetColorToAuto = useWorkbenchStore((s) => s.resetColorToAuto);
  const getEffectiveEventColor = useWorkbenchStore(
    (s) => s.getEffectiveEventColor
  );

  const primaryRef = view.selection.primary;
  const resolved = findEventByRef(project, primaryRef);
  const track = resolved?.track ?? null;
  const event = resolved?.event ?? null;

  const isLocked = track
    ? isNodeEffectivelyLocked(project.nodes, track.id, view.lockedNodeIds)
    : false;

  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [newCommentRole, setNewCommentRole] = useState<Comment["role"]>("human");
  const [newCommentText, setNewCommentText] = useState("");

  useEffect(() => {
    if (!event) {
      setStartInput("");
      setEndInput("");
      return;
    }
    setStartInput(event.startSec.toFixed(3));
    setEndInput(event.endSec !== undefined ? event.endSec.toFixed(3) : "");
  }, [event]);

  if (!primaryRef || !track || !event) {
    return (
      <aside className="workbench-pane">
        <div className="pane-header">
          <span className="pane-header__title">事件编辑</span>
        </div>
        <div className="workbench-empty">
          <p>当前未选中任何事件。</p>
          <p className="muted">
            请在中间事件列表或上方波形/轨道中单击一条事件进行编辑，或右键新建事件。
          </p>
        </div>
      </aside>
    );
  }

  const allTracks = flattenTracks(project.nodes);
  const isRange = isRangeEvent(event);
  const resolvedColor = getEffectiveEventColor(event, track);
  const isColorDraftForThisEvent =
    edit.colorDraft?.target.kind === "event" &&
    edit.colorDraft.target.ref.trackId === primaryRef.trackId &&
    edit.colorDraft.target.ref.eventId === primaryRef.eventId;

  const { prevEvent, nextEvent } = getAdjacentRangeEvents(track, event.id);
  const { prevLink, nextLink } = findBoundaryLinksForEvent(
    edit.boundaryLinks,
    primaryRef
  );

  const canSplitAtPlayhead =
    !isLocked &&
    isRange &&
    event.endSec !== undefined &&
    transport.currentTimeSec > event.startSec + 0.01 &&
    transport.currentTimeSec < event.endSec - 0.01;

  const handleCommitStartInput = () => {
    const parsed = parseTimeInput(startInput);
    if (parsed === null) {
      setStartInput(event.startSec.toFixed(3));
      return;
    }
    runWorkbenchCommand({
      type: "setBoundary",
      ref: primaryRef,
      edge: "start",
      timeSec: parsed,
    });
  };

  const handleCommitEndInput = () => {
    if (!endInput.trim()) {
      runWorkbenchCommand({
        type: "update",
        ref: primaryRef,
        patch: { endSec: null },
      });
      return;
    }
    const parsed = parseTimeInput(endInput);
    if (parsed === null || parsed <= event.startSec) {
      setEndInput(event.endSec !== undefined ? event.endSec.toFixed(3) : "");
      return;
    }
    runWorkbenchCommand({
      type: "setBoundary",
      ref: primaryRef,
      edge: "end",
      timeSec: parsed,
    });
  };

  const handleNudgeBoundary = (edge: "start" | "end", delta: number) => {
    if (edge === "start") {
      const target = Math.max(0, Number((event.startSec + delta).toFixed(3)));
      runWorkbenchCommand({
        type: "setBoundary",
        ref: primaryRef,
        edge: "start",
        timeSec: target,
      });
    } else if (event.endSec !== undefined) {
      const target = Math.max(
        event.startSec + 0.02,
        Number((event.endSec + delta).toFixed(3))
      );
      runWorkbenchCommand({
        type: "setBoundary",
        ref: primaryRef,
        edge: "end",
        timeSec: target,
      });
    }
  };

  const handleToggleRangeMode = () => {
    if (isRange) {
      runWorkbenchCommand({
        type: "update",
        ref: primaryRef,
        patch: { endSec: null },
      });
    } else {
      runWorkbenchCommand({
        type: "update",
        ref: primaryRef,
        patch: {
          endSec: Number((event.startSec + DEFAULT_RANGE_DURATION_SEC).toFixed(3)),
        },
      });
    }
  };

  const handleAppendComment = () => {
    const trimmed = newCommentText.trim();
    if (!trimmed) return;
    runWorkbenchCommand({
      type: "appendComment",
      target: { scope: "event", ref: primaryRef },
      comment: { role: newCommentRole, text: trimmed },
    });
    setNewCommentText("");
  };

  const handleDeleteCommentAt = (index: number) => {
    const nextComments = (event.comments ?? []).filter((_, i) => i !== index);
    runWorkbenchCommand({
      type: "update",
      ref: primaryRef,
      patch: { comments: nextComments },
    });
  };

  return (
    <aside className="workbench-pane">
      <div className="pane-header">
        <span className="pane-header__title">事件编辑</span>
        <span className="workbench-header-id">
          {event.id} · {isRange ? "区间事件" : "瞬时点事件"}
        </span>
      </div>

      <div className="workbench-body">
        {isLocked && (
          <div className="workbench-lock-banner">
            <strong>已锁定。</strong>请先在左侧解锁此时间轴或其上级分组。
          </div>
        )}

        {/* Section 1: Identity & Track Placement */}
        <div className="wb-section">
          <div className="wb-row-split">
            <div className="wb-field">
              <label className="wb-label">事件 ID</label>
              <div className="wb-readonly-box">{event.id}</div>
            </div>
            <div className="wb-field wb-field--grow">
              <label className="wb-label" htmlFor="event-track">所属时间轴</label>
              <select
                id="event-track"
                className="select select--sm"
                value={track.id}
                disabled={isLocked}
                onChange={(e) =>
                  moveEventToAnotherTrack(primaryRef, e.target.value)
                }
              >
                {allTracks.map((t) => {
                  const targetLocked = isNodeEffectivelyLocked(
                    project.nodes,
                    t.track.id,
                    view.lockedNodeIds
                  );
                  return (
                    <option
                      key={t.track.id}
                      value={t.track.id}
                      disabled={targetLocked}
                    >
                      {t.pathNames.join(" / ")}
                      {targetLocked ? " [已锁]" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="wb-field">
            <label className="wb-label" htmlFor="event-text">标注内容</label>
            <textarea
              id="event-text"
              className="textarea"
              rows={2}
              value={event.text}
              disabled={isLocked}
              placeholder="输入歌词、段落名称、重音说明或镜头描述…"
              onChange={(e) =>
                runWorkbenchCommand({
                  type: "update",
                  ref: primaryRef,
                  patch: { text: e.target.value },
                })
              }
            />
          </div>
        </div>

        {/* Section 2: Time Boundaries */}
        <div className="wb-section">
          <div className="wb-section__header">
            <span className="wb-section__title">时间与微调</span>
            <button
              type="button"
              className="btn btn--ghost btn--xs"
              disabled={isLocked}
              onClick={handleToggleRangeMode}
            >
              {isRange ? "转为点事件" : "转为区间事件"}
            </button>
          </div>

          <div className="wb-time-card">
            <div className="wb-time-card__top">
              <label className="wb-label" htmlFor="event-start">起点</label>
              <input
                id="event-start"
                aria-label="起点（秒）"
                title="秒数或分:秒，精确到毫秒"
                type="text"
                className="input input--sm wb-time-input"
                value={startInput}
                disabled={isLocked}
                onChange={(e) => setStartInput(e.target.value)}
                onBlur={handleCommitStartInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCommitStartInput();
                }}
              />
            </div>
            <div className="wb-nudge-bar">
              <button
                type="button"
                className="btn btn--ghost btn--xs"
                disabled={isLocked}
                onClick={() => handleNudgeBoundary("start", -0.05)}
              >
                -50ms
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--xs"
                disabled={isLocked}
                onClick={() => handleNudgeBoundary("start", -0.01)}
              >
                -10ms
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--xs"
                disabled={isLocked}
                onClick={() => handleNudgeBoundary("start", 0.01)}
              >
                +10ms
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--xs"
                disabled={isLocked}
                onClick={() => handleNudgeBoundary("start", 0.05)}
              >
                +50ms
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--xs"
                disabled={isLocked}
                onClick={() =>
                  runWorkbenchCommand({
                    type: "setBoundary",
                    ref: primaryRef,
                    edge: "start",
                    timeSec: transport.currentTimeSec,
                  })
                }
                title="将起点设为当前播放头位置 ([)"
              >
                设为播放头 [
              </button>
            </div>
          </div>

          {isRange && event.endSec !== undefined && (
            <div className="wb-time-card">
              <div className="wb-time-card__top">
                <label className="wb-label" htmlFor="event-end">
                  终点{" "}
                  <span className="muted">
                    · 时长 {(event.endSec - event.startSec).toFixed(3)} 秒
                  </span>
                </label>
                <input
                  id="event-end"
                  aria-label="终点（秒）"
                  title="秒数或分:秒，精确到毫秒"
                  type="text"
                  className="input input--sm wb-time-input"
                  value={endInput}
                  disabled={isLocked}
                  onChange={(e) => setEndInput(e.target.value)}
                  onBlur={handleCommitEndInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCommitEndInput();
                  }}
                />
              </div>
              <div className="wb-nudge-bar">
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  disabled={isLocked}
                  onClick={() => handleNudgeBoundary("end", -0.05)}
                >
                  -50ms
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  disabled={isLocked}
                  onClick={() => handleNudgeBoundary("end", -0.01)}
                >
                  -10ms
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  disabled={isLocked}
                  onClick={() => handleNudgeBoundary("end", 0.01)}
                >
                  +10ms
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  disabled={isLocked}
                  onClick={() => handleNudgeBoundary("end", 0.05)}
                >
                  +50ms
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  disabled={isLocked}
                  onClick={() =>
                    runWorkbenchCommand({
                      type: "setBoundary",
                      ref: primaryRef,
                      edge: "end",
                      timeSec: transport.currentTimeSec,
                    })
                  }
                  title="将终点设为当前播放头位置 (])"
                >
                  设为播放头 ]
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Color Picker (event.color -> track.color -> #166b75) */}
        <div className="wb-section">
          <details className="wb-color-settings" key={`${track.id}/${event.id}`}>
            <summary className="wb-color-summary">
              <span className="wb-section__title">事件颜色</span>
              <span className="color-swatch-lg" style={{ backgroundColor: resolvedColor }} />
              <span className="muted">
                {isColorDraftForThisEvent ? "预览中" : event.color ? "自定义" : "跟随时间轴"}
              </span>
            </summary>
            <div className="wb-color-options">
              <div className="color-picker-row">
                <input
                  type="color"
                  aria-label="选择事件颜色"
                  className="color-input-native"
                  disabled={isLocked}
                  value={resolvedColor}
                  onFocus={() => {
                    if (!isColorDraftForThisEvent) {
                      startColorDraft({ kind: "event", ref: primaryRef });
                    }
                  }}
                  onChange={(e) => {
                    if (!isColorDraftForThisEvent) {
                      startColorDraft({ kind: "event", ref: primaryRef });
                    }
                    updateColorDraft(e.target.value);
                  }}
                />

                <span className="color-code-badge">{resolvedColor}</span>

                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  disabled={isLocked || (!event.color && !isColorDraftForThisEvent)}
                  onClick={() =>
                    resetColorToAuto({ kind: "event", ref: primaryRef })
                  }
                  title="恢复跟随时间轴默认色"
                >
                  跟随时间轴
                </button>
              </div>

              <div className="color-swatches-bar">
                {EVENT_COLOR_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className="color-preset-btn"
                    style={{ backgroundColor: hex }}
                    disabled={isLocked}
                    title={`预览颜色 ${hex}`}
                    onClick={() => {
                      if (!isColorDraftForThisEvent) {
                        startColorDraft({ kind: "event", ref: primaryRef });
                      }
                      updateColorDraft(hex);
                    }}
                  />
                ))}
              </div>
            </div>
          </details>
          {isColorDraftForThisEvent && (
            <div className="color-picker-row" role="group" aria-label="颜色预览操作">
              <button type="button" className="btn btn--primary btn--xs" disabled={isLocked} onClick={commitColorDraft}>
                确认颜色
              </button>
              <button type="button" className="btn btn--ghost btn--xs" onClick={cancelColorDraft}>
                取消预览
              </button>
            </div>
          )}
        </div>

        {/* Section 4: Boundary Relationship (BoundaryLink) & Split */}
        {isRange && (
          <div className="wb-section">
            <div className="wb-section__header">
              <span className="wb-section__title">相邻边界关系与切分</span>
              <span className="wb-badge">
                {prevLink || nextLink ? "联动公共边界" : "独立边界"}
              </span>
            </div>

            {nextEvent ? (
              <div className="wb-boundary-box">
                <div className="wb-boundary-box__info">
                  与后一条区间 <strong>{nextEvent.id}</strong> (
                  {formatSeconds(nextEvent.startSec)})：
                  {nextLink ? " 已联动公共边界" : " 独立（保留句间空隙）"}
                </div>
                <div className="wb-nudge-bar">
                  <button
                    type="button"
                    className={`btn btn--xs ${
                      !nextLink ? "btn--active" : "btn--ghost"
                    }`}
                    disabled={isLocked || !nextLink}
                    onClick={() => {
                      if (nextLink) {
                        runWorkbenchCommand({
                          type: "unlinkBoundary",
                          link: nextLink,
                        });
                      }
                    }}
                  >
                    独立
                  </button>
                  <button
                    type="button"
                    className={`btn btn--xs ${
                      nextLink ? "btn--active" : "btn--ghost"
                    }`}
                    disabled={isLocked}
                    onClick={() => {
                      const link: BoundaryLink = {
                        trackId: track.id,
                        leftEventId: event.id,
                        rightEventId: nextEvent.id,
                      };
                      runWorkbenchCommand({
                        type: "linkBoundary",
                        link,
                      });
                    }}
                  >
                    联动公共边界
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--xs"
                    disabled={isLocked}
                    onClick={() => {
                      const link: BoundaryLink = {
                        trackId: track.id,
                        leftEventId: event.id,
                        rightEventId: nextEvent.id,
                      };
                      runWorkbenchCommand({
                        type: "joinBoundary",
                        link,
                        boundarySec: transport.currentTimeSec,
                      });
                    }}
                    title="将当前终点与下一条起点紧邻对齐到播放头，并开启联动"
                  >
                    设为紧邻（播放头）
                  </button>
                </div>
              </div>
            ) : (
              <div className="wb-boundary-empty">
                当前事件后方无相邻区间事件。
              </div>
            )}

            {prevEvent && (
              <div className="wb-boundary-box">
                <div className="wb-boundary-box__info">
                  与前一条区间 <strong>{prevEvent.id}</strong>：
                  {prevLink ? " 已联动公共边界" : " 独立"}
                </div>
                <div className="wb-nudge-bar">
                  <button
                    type="button"
                    className={`btn btn--xs ${
                      !prevLink ? "btn--active" : "btn--ghost"
                    }`}
                    disabled={isLocked || !prevLink}
                    onClick={() => {
                      if (prevLink) {
                        runWorkbenchCommand({
                          type: "unlinkBoundary",
                          link: prevLink,
                        });
                      }
                    }}
                  >
                    独立
                  </button>
                  <button
                    type="button"
                    className={`btn btn--xs ${
                      prevLink ? "btn--active" : "btn--ghost"
                    }`}
                    disabled={isLocked}
                    onClick={() =>
                      runWorkbenchCommand({
                        type: "linkBoundary",
                        link: {
                          trackId: track.id,
                          leftEventId: prevEvent.id,
                          rightEventId: event.id,
                        },
                      })
                    }
                  >
                    联动前一条公共边界
                  </button>
                </div>
              </div>
            )}

            <div className="wb-split-row">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={!canSplitAtPlayhead}
                onClick={() =>
                  runWorkbenchCommand({
                    type: "split",
                    ref: primaryRef,
                    atSec: transport.currentTimeSec,
                  })
                }
                title={
                  canSplitAtPlayhead
                    ? `在播放头 ${formatSeconds(transport.currentTimeSec)} 处切分为左右两段`
                    : "播放头需位于当前区间内部方可切分"
                }
              >
                在播放头 {formatSeconds(transport.currentTimeSec)} 切分
              </button>
            </div>
          </div>
        )}

        {/* Section 5: 500ms Cut-Point Audition */}
        <div className="wb-section">
          <div className="wb-section__header">
            <span className="wb-section__title">切点 500ms 试听 (A/S/R/D/F)</span>
          </div>
          <div className="wb-audition-grid">
            <button
              type="button"
              className="btn btn--ghost btn--xs"
              onClick={() =>
                onAuditionWindow(Math.max(0, event.startSec - 0.5), event.startSec)
              }
              title="试听起点前 500ms (快捷键 A)"
            >
              起点前 (A)
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--xs"
              onClick={() =>
                onAuditionWindow(event.startSec, event.startSec + 0.5)
              }
              title="试听起点后 500ms (快捷键 S)"
            >
              起点后 (S)
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--xs"
              onClick={() =>
                onAuditionWindow(
                  event.startSec,
                  event.endSec ?? event.startSec + 0.8
                )
              }
              title="试听完整区间 (快捷键 R)"
            >
              全段 (R)
            </button>
            {isRange && event.endSec !== undefined && (
              <>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  onClick={() =>
                    onAuditionWindow(
                      Math.max(event.startSec, event.endSec! - 0.5),
                      event.endSec!
                    )
                  }
                  title="试听终点前 500ms (快捷键 D)"
                >
                  终点前 (D)
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  onClick={() =>
                    onAuditionWindow(event.endSec!, event.endSec! + 0.5)
                  }
                  title="试听终点后 500ms (快捷键 F)"
                >
                  终点后 (F)
                </button>
              </>
            )}
          </div>
        </div>

        {/* Section 6: Comments Thread (Comment[]) */}
        <div className="wb-section">
          <div className="wb-section__header">
            <span className="wb-section__title">
              评论 ({event.comments?.length ?? 0})
            </span>
          </div>

          <div className="comments-thread">
            {(!event.comments || event.comments.length === 0) && (
              <div className="comments-empty">
                当前事件暂无评论。可添加人类备注、脚本想法或 Agent 协作回复。
              </div>
            )}
            {event.comments?.map((c, idx) => (
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
                {!isLocked && (
                  <button
                    type="button"
                    className="comment-item__del"
                    title="删除此条评论"
                    onClick={() => handleDeleteCommentAt(idx)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="comment-composer">
            <select
              className="select select--sm"
              value={newCommentRole}
              disabled={isLocked}
              onChange={(e) =>
                setNewCommentRole(e.target.value as Comment["role"])
              }
            >
              <option value="human">人类</option>
              <option value="agent">Agent</option>
            </select>
            <input
              type="text"
              className="input input--sm"
              placeholder="输入评论内容，按 Enter 追加…"
              value={newCommentText}
              disabled={isLocked}
              onChange={(e) => setNewCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAppendComment();
              }}
            />
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={isLocked || !newCommentText.trim()}
              onClick={handleAppendComment}
            >
              追加
            </button>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="workbench-footer">
        <button
          type="button"
          className="btn btn--danger btn--sm"
          disabled={isLocked}
          onClick={() =>
            runWorkbenchCommand({
              type: "delete",
              refs: view.selection.selected.length > 0 ? view.selection.selected : [primaryRef],
            })
          }
        >
          删除所选 ({Math.max(1, view.selection.selected.length)})
        </button>

        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => {
            const next = selectNextEvent();
            if (next) {
              const found = findEventByRef(project, next);
              if (found) onSeek(found.event.startSec);
            }
          }}
          title="切换到当前时间轴的下一条标注（不写入确认状态）"
        >
          下一条标注 →
        </button>
      </div>
    </aside>
  );
};
