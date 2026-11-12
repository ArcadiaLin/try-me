import React, { useState } from "react";
import {
  addRegion,
  deleteSelectedItem,
  getAudioDuration,
  notifyStore,
  REGION_CATEGORIES,
  seekAudio,
  selectTimelineItem,
  storeState,
  toVideoFrame,
  updateRegion,
  useWorkbenchStore,
} from "../store/workbenchStore.ts";
import type { AgentStatus, ItemStatus } from "../types.ts";
import { formatTimeDisplay } from "../utils/ass-lrc.ts";

export function StructureWorkbench(): React.JSX.Element {
  const snap = useWorkbenchStore();
  const [searchQuery, setSearchQuery] = useState("");

  const isClipTrack = snap.activeTrackId === "structure_clips";
  const allRegions = snap.annotations?.regions || [];
  const trackRegions = allRegions.filter((r) =>
    isClipTrack
      ? r.category === "representative_clip"
      : r.category !== "representative_clip",
  );

  const filteredRegions = trackRegions.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const hay =
      `${r.id} ${r.label} ${r.note} ${r.script_idea} ${r.agent_comment} ${r.lyric_hint}`.toLowerCase();
    return hay.includes(q);
  });

  const selectedRegion =
    allRegions.find(
      (r) => snap.selectedKind === "region" && r.id === snap.selectedId,
    ) ||
    filteredRegions[0] ||
    null;

  return (
    <div className="wb-workbench-split">
      {/* Left: Structure / Regions Table */}
      <div className="wb-table-pane">
        <div className="wb-pane-toolbar">
          <div className="wb-toolbar-left">
            <span className="wb-pane-title">
              {isClipTrack
                ? "🎯 代表性验证片段 (Clips)"
                : "📏 音乐曲式段落划分 (P001–P012)"}
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
                    : Math.min(getAudioDuration(), snap.currentTimeSec + 12);
                addRegion({
                  startSec,
                  endSec,
                  category: isClipTrack ? "representative_clip" : "section",
                  status: "candidate",
                });
              }}
            >
              + 新建区间
            </button>
          </div>
          <div className="wb-toolbar-right">
            <input
              type="search"
              className="wb-search-input"
              placeholder="搜索 P001 / 段落名 / 脚本..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="wb-table-scroll">
          <table className="wb-grid-table">
            <thead>
              <tr>
                <th style={{ width: "68px" }}>ID</th>
                <th style={{ width: "210px" }}>段落标题</th>
                <th style={{ width: "86px" }}>状态</th>
                <th style={{ width: "160px" }}>起止时间 (s)</th>
                <th style={{ width: "110px" }}>时长 / 帧区间</th>
                <th>脚本设计 / 音乐特征备注 / Agent 批注</th>
                <th style={{ width: "88px" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegions.map((reg) => {
                const isSelected = selectedRegion?.id === reg.id;
                const dur = reg.end_sec - reg.start_sec;
                return (
                  <tr
                    key={reg.id}
                    className={isSelected ? "is-selected" : ""}
                    onClick={() => selectTimelineItem("region", reg.id, true)}
                  >
                    <td className="wb-mono-cell">
                      <span
                        className="wb-inline-dot"
                        style={{ backgroundColor: reg.color || "#38bdf8" }}
                      />
                      <strong>{reg.id}</strong>
                    </td>
                    <td>{reg.label}</td>
                    <td>
                      <span
                        className={`wb-status-pill ${reg.status === "confirmed" ? "confirmed" : "candidate"}`}
                      >
                        {reg.status}
                      </span>
                      {reg.agent_status === "open" ? (
                        <span className="wb-status-pill open">待Agent</span>
                      ) : null}
                    </td>
                    <td className="wb-mono-cell">
                      {formatTimeDisplay(reg.start_sec)} –{" "}
                      {formatTimeDisplay(reg.end_sec)}
                    </td>
                    <td className="wb-mono-cell wb-muted">
                      {dur.toFixed(2)}s · [{toVideoFrame(reg.start_sec)},{" "}
                      {toVideoFrame(reg.end_sec)})
                    </td>
                    <td>
                      {reg.lyric_hint ? (
                        <div className="wb-table-lyric-note">
                          ♪ {reg.lyric_hint}
                        </div>
                      ) : null}
                      <div className="wb-table-lyric-text">
                        {reg.script_idea || reg.agent_comment || reg.note || "-"}
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-mini"
                        onClick={() => {
                          storeState.loopInSec = reg.start_sec;
                          storeState.loopOutSec = reg.end_sec;
                          storeState.loopEnabled = true;
                          storeState.loopingLyricId = null;
                          seekAudio(reg.start_sec);
                          notifyStore();
                        }}
                      >
                        🔁 循环
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Region Inspector */}
      <div className="wb-inspector-pane">
        {!selectedRegion ? (
          <div className="wb-empty-inspector">请在左侧选择段落或区间</div>
        ) : (
          <div className="wb-inspector-content">
            <div className="wb-inspector-header">
              <div>
                <span className="wb-inspector-badge">
                  段落/区间 · {selectedRegion.id}
                </span>
                <span className="wb-inspector-sub">
                  时长 {(selectedRegion.end_sec - selectedRegion.start_sec).toFixed(3)}s
                  {" · "}[F{toVideoFrame(selectedRegion.start_sec)}, F
                  {toVideoFrame(selectedRegion.end_sec)})
                </span>
              </div>
              <button
                type="button"
                className="btn btn-mini btn-danger"
                onClick={deleteSelectedItem}
              >
                删除区间
              </button>
            </div>

            <div className="wb-form-row-2">
              <label>
                <span>标题 / 段落名</span>
                <input
                  type="text"
                  value={selectedRegion.label}
                  onChange={(e) =>
                    updateRegion(selectedRegion.id, { label: e.target.value })
                  }
                />
              </label>
              <label>
                <span>状态</span>
                <select
                  value={selectedRegion.status}
                  onChange={(e) =>
                    updateRegion(selectedRegion.id, {
                      status: e.target.value as ItemStatus,
                    })
                  }
                >
                  <option value="candidate">candidate (候选)</option>
                  <option value="confirmed">confirmed (已确认)</option>
                </select>
              </label>
            </div>

            <div className="wb-form-row-3">
              <label>
                <span>类型</span>
                <select
                  value={selectedRegion.category}
                  onChange={(e) =>
                    updateRegion(selectedRegion.id, {
                      category: e.target.value,
                    })
                  }
                >
                  {REGION_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>颜色</span>
                <input
                  type="color"
                  value={selectedRegion.color || "#38bdf8"}
                  onChange={(e) =>
                    updateRegion(selectedRegion.id, { color: e.target.value })
                  }
                />
              </label>
              <label>
                <span>关联镜头 (逗号分隔)</span>
                <input
                  type="text"
                  placeholder="S001, S002"
                  value={(selectedRegion.linked_shots || []).join(", ")}
                  onChange={(e) =>
                    updateRegion(selectedRegion.id, {
                      linked_shots: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
            </div>

            <div className="wb-form-row-2">
              <label>
                <span>起点 (Start Sec)</span>
                <div className="wb-inline-input-btn">
                  <input
                    type="number"
                    step={0.001}
                    value={selectedRegion.start_sec}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (
                        Number.isFinite(val) &&
                        val >= 0 &&
                        val < selectedRegion.end_sec - 0.05
                      ) {
                        updateRegion(selectedRegion.id, { start_sec: val });
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-mini"
                    onClick={() => {
                      if (snap.currentTimeSec < selectedRegion.end_sec - 0.05) {
                        updateRegion(selectedRegion.id, {
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
                    value={selectedRegion.end_sec}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (
                        Number.isFinite(val) &&
                        val > selectedRegion.start_sec + 0.05 &&
                        val <= getAudioDuration()
                      ) {
                        updateRegion(selectedRegion.id, { end_sec: val });
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-mini"
                    onClick={() => {
                      if (
                        snap.currentTimeSec >
                        selectedRegion.start_sec + 0.05
                      ) {
                        updateRegion(selectedRegion.id, {
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

            <label className="wb-block-label">
              <span>听感与音乐特征备注 (Note)</span>
              <textarea
                rows={2}
                value={selectedRegion.note}
                onChange={(e) =>
                  updateRegion(selectedRegion.id, { note: e.target.value })
                }
              />
            </label>

            <label className="wb-block-label">
              <span>画面脚本与声画设计构想 (Script Idea)</span>
              <textarea
                rows={2}
                placeholder="描述该段落的色彩、运动规律、角色表演或转场方式..."
                value={selectedRegion.script_idea}
                onChange={(e) =>
                  updateRegion(selectedRegion.id, {
                    script_idea: e.target.value,
                  })
                }
              />
            </label>

            <div className="wb-agent-box">
              <div className="wb-agent-box-header">
                <span>🤖 给 Agent 的专项指令 (Agent Comment)</span>
                <select
                  value={selectedRegion.agent_status}
                  onChange={(e) =>
                    updateRegion(selectedRegion.id, {
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
                placeholder="给 Agent 留言，例如：请按此段落切分 S001~S004 镜头..."
                value={selectedRegion.agent_comment}
                onChange={(e) =>
                  updateRegion(selectedRegion.id, {
                    agent_comment: e.target.value,
                  })
                }
              />
              {selectedRegion.agent_reply ? (
                <div className="wb-agent-reply">
                  <strong>Agent 回复：</strong> {selectedRegion.agent_reply}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
