import React, { useState } from "react";
import {
  addCustomTrackItem,
  deleteCustomTrack,
  deleteSelectedItem,
  findCustomTrack,
  findNearestCandidate,
  getAudioDuration,
  notifyStore,
  resetInspectorWidth,
  seekAudio,
  selectTimelineItem,
  startInspectorResize,
  storeState,
  toVideoFrame,
  updateCustomTrackItem,
  updateCustomTrackMeta,
  useWorkbenchStore,
} from "../store/workbenchStore.ts";
import type { AgentStatus, ItemStatus } from "../types.ts";
import { formatTimeDisplay } from "../utils/ass-lrc.ts";

export function CustomTrackWorkbench(): React.JSX.Element {
  const snap = useWorkbenchStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTrackMeta, setEditingTrackMeta] = useState(false);

  const track = findCustomTrack(snap.activeTrackId);
  if (!track) {
    return (
      <div className="wb-empty-inspector">
        未找到时间轴 <code>{snap.activeTrackId}</code>，请在左侧 Explorer 选择其他轨道。
      </div>
    );
  }

  const sections = (snap.annotations?.regions || []).filter(
    (r) => r.category !== "representative_clip",
  );

  const groupFilteredItems = snap.selectedGroupId
    ? track.items.filter(
        (i) =>
          i.group_id === snap.selectedGroupId ||
          i.parent_id === snap.selectedGroupId,
      )
    : track.items;

  const filteredItems = groupFilteredItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const hay =
      `${item.id} ${item.label} ${item.category} ${item.group_id || ""} ${item.parent_id || ""} ${item.note} ${item.script_idea} ${item.agent_comment}`.toLowerCase();
    return hay.includes(q);
  });

  const selectedItem =
    track.items.find(
      (i) => snap.selectedKind === "custom_item" && i.id === snap.selectedId,
    ) ||
    filteredItems[0] ||
    null;

  return (
    <div className="wb-workbench-split">
      {/* Left: Custom Track Items Table + Track Metadata Header */}
      <div className="wb-table-pane">
        <div className="wb-pane-toolbar">
          <div className="wb-toolbar-left">
            <span
              className="wb-inline-dot"
              style={{ backgroundColor: track.color || "#38bdf8" }}
            />
            <span className="wb-pane-title">{track.name}</span>
            <span className="wb-filter-chip">type: {track.type}</span>
            <span className="wb-filter-chip">
              {track.allow_overlap ? "允许重叠覆盖" : "单轨互斥"}
            </span>
            <button
              type="button"
              className="btn btn-mini btn-primary"
              onClick={() => {
                const startSec =
                  snap.loopInSec !== null && snap.loopOutSec !== null
                    ? snap.loopInSec
                    : snap.currentTimeSec;
                const endSec =
                  snap.loopInSec !== null && snap.loopOutSec !== null
                    ? snap.loopOutSec
                    : Math.min(getAudioDuration(), snap.currentTimeSec + 2.0);
                addCustomTrackItem(track.id, {
                  kind: "region",
                  startSec,
                  endSec,
                  group_id: snap.selectedGroupId,
                });
              }}
            >
              + 新建区间标注
            </button>
            <button
              type="button"
              className="btn btn-mini"
              onClick={() =>
                addCustomTrackItem(track.id, {
                  kind: "point",
                  timeSec: snap.currentTimeSec,
                  group_id: snap.selectedGroupId,
                })
              }
            >
              + 在播放头打点
            </button>
            <button
              type="button"
              className={`btn btn-mini ${editingTrackMeta ? "btn-active" : ""}`}
              onClick={() => setEditingTrackMeta((v) => !v)}
            >
              轨道属性与 Agent 说明
            </button>
          </div>
          <div className="wb-toolbar-right">
            <input
              type="search"
              className="wb-search-input"
              placeholder="搜索 ID / 标题 / 分类 / 脚本..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {editingTrackMeta ? (
          <div className="wb-custom-track-meta-bar">
            <div className="wb-form-row-3">
              <label>
                <span>时间轴名称 (Name)</span>
                <input
                  type="text"
                  value={track.name}
                  onChange={(e) =>
                    updateCustomTrackMeta(track.id, { name: e.target.value })
                  }
                />
              </label>
              <label>
                <span>顶层自由类型 (Type，Agent 语义标识)</span>
                <input
                  type="text"
                  placeholder="如 sfx / shot / vocal_fx / choreography"
                  value={track.type}
                  onChange={(e) =>
                    updateCustomTrackMeta(track.id, { type: e.target.value })
                  }
                />
              </label>
              <label>
                <span>轨道颜色 & 重叠规则</span>
                <div className="wb-inline-input-btn">
                  <input
                    type="color"
                    value={track.color || "#38bdf8"}
                    onChange={(e) =>
                      updateCustomTrackMeta(track.id, { color: e.target.value })
                    }
                  />
                  <label className="wb-checkbox-pill">
                    <input
                      type="checkbox"
                      checked={track.allow_overlap}
                      onChange={(e) =>
                        updateCustomTrackMeta(track.id, {
                          allow_overlap: e.target.checked,
                        })
                      }
                    />
                    <span>允许同轨事件重叠</span>
                  </label>
                </div>
              </label>
            </div>
            <div className="wb-custom-track-meta-row2">
              <label className="wb-block-label" style={{ flex: 1 }}>
                <span>给 Agent 的时间轴用途说明 (purpose_for_agent)</span>
                <input
                  type="text"
                  placeholder="告诉 Agent 这条时间轴代表什么，例如：记录铜管与打击乐特色音效点，用于触发画面局部动画..."
                  value={track.purpose_for_agent}
                  onChange={(e) =>
                    updateCustomTrackMeta(track.id, {
                      purpose_for_agent: e.target.value,
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="btn btn-mini btn-danger"
                onClick={() => {
                  if (
                    window.confirm(
                      `确定删除自定义时间轴「${track.name}」及其全部 ${track.items.length} 条标注吗？`,
                    )
                  ) {
                    deleteCustomTrack(track.id);
                  }
                }}
              >
                删除此时间轴
              </button>
            </div>
          </div>
        ) : null}

        <div className="wb-table-scroll">
          <table className="wb-grid-table">
            <thead>
              <tr>
                <th style={{ width: "68px" }}>ID</th>
                <th style={{ width: "64px" }}>形态</th>
                <th style={{ width: "120px" }}>层级分组 / 父节点</th>
                <th style={{ width: "86px" }}>状态</th>
                <th style={{ width: "165px" }}>时间范围 / 时刻 (s)</th>
                <th style={{ width: "120px" }}>画面帧定位</th>
                <th>标题 / 声音备注 / 画面脚本与 Agent 批注</th>
                <th style={{ width: "74px" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="wb-empty-cell">
                    当前时间轴暂无标注项。可点击上方「+ 新建区间标注」或「+ 在播放头打点」添加独立或重叠的时间轴标注。
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  const isPoint = item.kind === "point";
                  const tStart = isPoint
                    ? (item.time_sec ?? 0)
                    : (item.start_sec ?? 0);
                  const tEnd = isPoint
                    ? (item.time_sec ?? 0)
                    : (item.end_sec ?? tStart);
                  return (
                    <tr
                      key={item.id}
                      className={isSelected ? "is-selected" : ""}
                      onClick={() =>
                        selectTimelineItem("custom_item", item.id, true, track.id)
                      }
                    >
                      <td className="wb-mono-cell">
                        <span
                          className="wb-inline-dot"
                          style={{
                            backgroundColor:
                              item.color || track.color || "#38bdf8",
                          }}
                        />
                        <strong>{item.id}</strong>
                      </td>
                      <td>
                        <span className="wb-cat-badge">
                          {isPoint ? "点事件" : "区间"}
                        </span>
                      </td>
                      <td className="wb-mono-cell">
                        {item.group_id || "-"}
                        {item.parent_id ? ` ← ${item.parent_id}` : ""}
                      </td>
                      <td>
                        <span
                          className={`wb-status-pill ${item.status === "confirmed" ? "confirmed" : "candidate"}`}
                        >
                          {item.status}
                        </span>
                        {item.agent_status === "open" ? (
                          <span className="wb-status-pill open">待Agent</span>
                        ) : null}
                      </td>
                      <td className="wb-mono-cell">
                        {isPoint
                          ? formatTimeDisplay(tStart)
                          : `${formatTimeDisplay(tStart)} – ${formatTimeDisplay(tEnd)}`}
                      </td>
                      <td className="wb-mono-cell wb-muted">
                        {isPoint
                          ? `@F${toVideoFrame(tStart)}`
                          : `[F${toVideoFrame(tStart)}, F${toVideoFrame(tEnd)})`}
                      </td>
                      <td>
                        <div className="wb-table-lyric-text">
                          <strong>{item.label}</strong>
                          {item.category && item.category !== track.type
                            ? ` [${item.category}]`
                            : ""}
                        </div>
                        {item.script_idea || item.note || item.agent_comment ? (
                          <div className="wb-table-lyric-note">
                            {item.script_idea || item.agent_comment || item.note}
                          </div>
                        ) : null}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {!isPoint ? (
                          <button
                            type="button"
                            className="btn btn-mini"
                            onClick={() => {
                              storeState.loopInSec = tStart;
                              storeState.loopOutSec = tEnd;
                              storeState.loopEnabled = true;
                              storeState.loopingLyricId = null;
                              seekAudio(tStart);
                              notifyStore();
                            }}
                          >
                            循环
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-mini"
                            onClick={() => seekAudio(tStart)}
                          >
                            定位
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
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

      {/* Right: Custom Track Item Inspector */}
      <div
        className="wb-inspector-pane"
        style={{ width: `${snap.inspectorWidth}px` }}
      >
        {!selectedItem ? (
          <div className="wb-empty-inspector">
            请在左侧选择或新建一条时间轴标注
          </div>
        ) : (
          <div className="wb-inspector-content">
            <div className="wb-inspector-header">
              <div>
                <span className="wb-inspector-badge">
                  {track.name} · {selectedItem.id}
                </span>
                <span className="wb-inspector-sub">
                  {selectedItem.kind === "point"
                    ? `@${(selectedItem.time_sec ?? 0).toFixed(3)}s · F${toVideoFrame(selectedItem.time_sec ?? 0)}`
                    : `时长 ${((selectedItem.end_sec ?? 0) - (selectedItem.start_sec ?? 0)).toFixed(3)}s · [F${toVideoFrame(selectedItem.start_sec ?? 0)}, F${toVideoFrame(selectedItem.end_sec ?? 0)})`}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-mini btn-danger"
                onClick={deleteSelectedItem}
              >
                删除标注
              </button>
            </div>

            <div className="wb-form-row-2">
              <label>
                <span>标注标题 (Label)</span>
                <input
                  type="text"
                  value={selectedItem.label}
                  onChange={(e) =>
                    updateCustomTrackItem(track.id, selectedItem.id, {
                      label: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>确认状态</span>
                <select
                  value={selectedItem.status}
                  onChange={(e) =>
                    updateCustomTrackItem(track.id, selectedItem.id, {
                      status: e.target.value as ItemStatus,
                    })
                  }
                >
                  <option value="confirmed">confirmed (已确认)</option>
                  <option value="candidate">candidate (候选)</option>
                </select>
              </label>
            </div>

            <div className="wb-form-row-3">
              <label>
                <span>标注形态 (Kind)</span>
                <select
                  value={selectedItem.kind}
                  onChange={(e) => {
                    const nextKind = e.target.value as "region" | "point";
                    if (nextKind === "point") {
                      const t =
                        selectedItem.time_sec ??
                        selectedItem.start_sec ??
                        snap.currentTimeSec;
                      updateCustomTrackItem(track.id, selectedItem.id, {
                        kind: "point",
                        time_sec: t,
                      });
                    } else {
                      const s =
                        selectedItem.start_sec ??
                        selectedItem.time_sec ??
                        snap.currentTimeSec;
                      const end =
                        selectedItem.end_sec && selectedItem.end_sec > s + 0.05
                          ? selectedItem.end_sec
                          : Math.min(getAudioDuration(), s + 2.0);
                      updateCustomTrackItem(track.id, selectedItem.id, {
                        kind: "region",
                        start_sec: s,
                        end_sec: end,
                      });
                    }
                  }}
                >
                  <option value="region">region (起止区间)</option>
                  <option value="point">point (瞬时点事件)</option>
                </select>
              </label>
              <label>
                <span>子分类标签 (Category)</span>
                <input
                  type="text"
                  placeholder="如 brass_hit / synth_riser / close_up"
                  value={selectedItem.category}
                  onChange={(e) =>
                    updateCustomTrackItem(track.id, selectedItem.id, {
                      category: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>颜色</span>
                <input
                  type="color"
                  value={selectedItem.color || track.color || "#38bdf8"}
                  onChange={(e) =>
                    updateCustomTrackItem(track.id, selectedItem.id, {
                      color: e.target.value,
                    })
                  }
                />
              </label>
            </div>

            <div className="wb-form-row-3">
              <label>
                <span>所属段落分组 (group_id)</span>
                <select
                  value={selectedItem.group_id || ""}
                  onChange={(e) =>
                    updateCustomTrackItem(track.id, selectedItem.id, {
                      group_id: e.target.value || null,
                    })
                  }
                >
                  <option value="">(无段落分组)</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.id} · {sec.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>父级事件 ID (parent_id 层级嵌套)</span>
                <input
                  type="text"
                  placeholder="如 L011 / P003 / E0001"
                  value={selectedItem.parent_id || ""}
                  onChange={(e) =>
                    updateCustomTrackItem(track.id, selectedItem.id, {
                      parent_id: e.target.value.trim() || null,
                    })
                  }
                />
              </label>
              <label>
                <span>关联镜头 (逗号分隔)</span>
                <input
                  type="text"
                  placeholder="S001, S002"
                  value={(selectedItem.linked_shots || []).join(", ")}
                  onChange={(e) =>
                    updateCustomTrackItem(track.id, selectedItem.id, {
                      linked_shots: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
            </div>

            {selectedItem.kind === "point" ? (
              <div className="wb-form-row-2">
                <label>
                  <span>精确时刻 (Time Sec)</span>
                  <div className="wb-inline-input-btn">
                    <input
                      type="number"
                      step={0.001}
                      value={selectedItem.time_sec ?? 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (Number.isFinite(val) && val >= 0) {
                          updateCustomTrackItem(
                            track.id,
                            selectedItem.id,
                            { time_sec: val, source: "human" },
                            true,
                          );
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-mini"
                      onClick={() =>
                        updateCustomTrackItem(
                          track.id,
                          selectedItem.id,
                          {
                            time_sec: Number(snap.currentTimeSec.toFixed(6)),
                            source: "human",
                          },
                          true,
                        )
                      }
                    >
                      =取播放头
                    </button>
                  </div>
                </label>
                <label>
                  <span>对齐操作</span>
                  <div className="wb-inline-input-btn">
                    <button
                      type="button"
                      className="btn btn-mini"
                      onClick={() => {
                        const cand = findNearestCandidate(
                          selectedItem.time_sec ?? 0,
                          0.12,
                        );
                        if (cand) {
                          updateCustomTrackItem(track.id, selectedItem.id, {
                            time_sec: Number(cand.time_sec.toFixed(6)),
                            origin_candidate_id: cand.id,
                          });
                        }
                      }}
                    >
                      吸附最近候选拍/瞬态
                    </button>
                  </div>
                </label>
              </div>
            ) : (
              <div className="wb-form-row-2">
                <label>
                  <span>起点 (Start Sec)</span>
                  <div className="wb-inline-input-btn">
                    <input
                      type="number"
                      step={0.001}
                      value={selectedItem.start_sec ?? 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const endSec = selectedItem.end_sec ?? val + 1;
                        if (
                          Number.isFinite(val) &&
                          val >= 0 &&
                          val < endSec - 0.02
                        ) {
                          updateCustomTrackItem(track.id, selectedItem.id, {
                            start_sec: val,
                          });
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-mini"
                      onClick={() => {
                        const endSec =
                          selectedItem.end_sec ?? snap.currentTimeSec + 1;
                        if (snap.currentTimeSec < endSec - 0.02) {
                          updateCustomTrackItem(track.id, selectedItem.id, {
                            start_sec: Number(snap.currentTimeSec.toFixed(3)),
                          });
                        }
                      }}
                    >
                      =取播放头
                    </button>
                  </div>
                </label>
                <label>
                  <span>终点 (End Sec)</span>
                  <div className="wb-inline-input-btn">
                    <input
                      type="number"
                      step={0.001}
                      value={selectedItem.end_sec ?? 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const startSec = selectedItem.start_sec ?? 0;
                        if (
                          Number.isFinite(val) &&
                          val > startSec + 0.02 &&
                          val <= getAudioDuration()
                        ) {
                          updateCustomTrackItem(track.id, selectedItem.id, {
                            end_sec: val,
                          });
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-mini"
                      onClick={() => {
                        const startSec = selectedItem.start_sec ?? 0;
                        if (snap.currentTimeSec > startSec + 0.02) {
                          updateCustomTrackItem(track.id, selectedItem.id, {
                            end_sec: Number(snap.currentTimeSec.toFixed(3)),
                          });
                        }
                      }}
                    >
                      =取播放头
                    </button>
                  </div>
                </label>
              </div>
            )}

            <label className="wb-block-label">
              <span>听感特征与声音备注 (Note)</span>
              <textarea
                rows={2}
                placeholder="描述这里的音效、乐器演奏细节或人声特征..."
                value={selectedItem.note}
                onChange={(e) =>
                  updateCustomTrackItem(track.id, selectedItem.id, {
                    note: e.target.value,
                  })
                }
              />
            </label>

            <label className="wb-block-label">
              <span>画面脚本与声画设计构想 (Script Idea)</span>
              <textarea
                rows={2}
                placeholder="描述该时间段或时刻的画面动作、镜头运动、视觉隐喻或排版变化..."
                value={selectedItem.script_idea}
                onChange={(e) =>
                  updateCustomTrackItem(track.id, selectedItem.id, {
                    script_idea: e.target.value,
                  })
                }
              />
            </label>

            <div className="wb-agent-box">
              <div className="wb-agent-box-header">
                <span>给 Agent 的专项指令 (Agent Comment)</span>
                <select
                  value={selectedItem.agent_status}
                  onChange={(e) =>
                    updateCustomTrackItem(track.id, selectedItem.id, {
                      agent_status: e.target.value as AgentStatus,
                    })
                  }
                >
                  <option value="none">无待办 (none)</option>
                  <option value="open">待 Agent 处理 (open)</option>
                  <option value="in_progress">处理中 (in_progress)</option>
                  <option value="resolved">已解决 (resolved)</option>
                </select>
              </div>
              <textarea
                rows={2}
                placeholder="给 Agent 留言，例如：请在此音效点制作 Remotion 弹性缩放关键帧..."
                value={selectedItem.agent_comment}
                onChange={(e) =>
                  updateCustomTrackItem(track.id, selectedItem.id, {
                    agent_comment: e.target.value,
                  })
                }
              />
              {selectedItem.agent_reply ? (
                <div className="wb-agent-reply">
                  <strong>Agent 回复：</strong> {selectedItem.agent_reply}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
