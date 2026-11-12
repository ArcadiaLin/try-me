import React, { useState } from "react";
import { allocateMarkerId, applyCandidateProvenance } from "../../model.ts";
import {
  addPointMarker,
  deleteSelectedItem,
  findNearestCandidate,
  getAudioDuration,
  notifyStore,
  POINT_CATEGORIES,
  scheduleAutoSave,
  seekAudio,
  selectTimelineItem,
  storeState,
  toVideoFrame,
  updatePointMarker,
  useWorkbenchStore,
} from "../store/workbenchStore.ts";
import type { AgentStatus, ItemStatus } from "../types.ts";
import { formatTimeDisplay } from "../utils/ass-lrc.ts";

export function RhythmWorkbench(): React.JSX.Element {
  const snap = useWorkbenchStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [gridStartSec, setGridStartSec] = useState(18.188);
  const [gridEndSec, setGridEndSec] = useState(27.16);
  const [gridIntervals, setGridIntervals] = useState(16);

  const isDownbeatsTrack = snap.activeTrackId === "rhythm_downbeats";
  const allMarkers = snap.annotations?.markers || [];
  const trackMarkers = allMarkers.filter((m) => {
    if (isDownbeatsTrack) return m.category === "downbeat";
    if (snap.selectedGroupId) return m.category === snap.selectedGroupId;
    return m.category !== "downbeat";
  });

  const filteredMarkers = trackMarkers.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const hay =
      `${m.id} ${m.label} ${m.category} ${m.note} ${m.script_idea} ${m.agent_comment}`.toLowerCase();
    return hay.includes(q);
  });

  const selectedMarker =
    allMarkers.find(
      (m) => snap.selectedKind === "point" && m.id === snap.selectedId,
    ) ||
    filteredMarkers[0] ||
    null;

  const spanSec = gridEndSec - gridStartSec;
  const ibiSec = gridIntervals >= 1 ? spanSec / gridIntervals : 0;
  const estBpm = ibiSec > 0 ? 60 / ibiSec : 0;

  const handleGenerateGrid = () => {
    if (
      !storeState.annotations ||
      gridEndSec <= gridStartSec ||
      gridIntervals < 1
    ) {
      return;
    }
    storeState.editSeq += 1;
    for (let i = 0; i <= gridIntervals; i += 1) {
      const t = Number((gridStartSec + i * ibiSec).toFixed(6));
      const id = allocateMarkerId(storeState.annotations);
      storeState.annotations.markers.push({
        id,
        kind: "point",
        category: "beat",
        label: `Grid ${i + 1}`,
        color: "#eab308",
        time_sec: t,
        source: "human",
        origin_candidate_id: null,
        origin_analysis_run_id: null,
        origin_analysis_sha256: null,
        origin_candidate_time_sec: null,
        origin_candidate_sample_index: null,
        status: "candidate",
        linked_shots: [],
        note: `均匀补拍候选 (${estBpm.toFixed(2)} BPM, N=${gridIntervals})`,
        script_idea: "",
        agent_comment: "",
        agent_status: "none",
        agent_reply: "",
        lyric_hint: "",
      });
    }
    storeState.annotations.markers.sort((a, b) => a.time_sec - b.time_sec);
    scheduleAutoSave();
    notifyStore();
  };

  return (
    <div className="wb-workbench-split">
      {/* Left: Markers Table + Local BPM Grid Generator */}
      <div className="wb-table-pane">
        <div className="wb-pane-toolbar">
          <div className="wb-toolbar-left">
            <span className="wb-pane-title">
              {isDownbeatsTrack
                ? "🥁 小节第一拍 (Downbeats)"
                : "⚡ 拍点 / 重音 / 切镜点标记"}
            </span>
            <button
              type="button"
              className="btn btn-mini btn-primary"
              onClick={() =>
                addPointMarker({
                  timeSec: snap.currentTimeSec,
                  category: isDownbeatsTrack
                    ? "downbeat"
                    : snap.selectedGroupId || "beat",
                })
              }
            >
              + 在当前播放头打点
            </button>
          </div>
          <div className="wb-toolbar-right">
            <input
              type="search"
              className="wb-search-input"
              placeholder="搜索 M0002 / Bar / 备注..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Local BPM Calculator & Grid Generator Bar */}
        <div className="wb-bpm-bar">
          <span className="wb-bpm-title">📐 局部 BPM 测算与均匀补拍:</span>
          <label className="wb-inline-field">
            <span>起点(s)</span>
            <input
              type="number"
              step={0.001}
              value={gridStartSec}
              onChange={(e) => setGridStartSec(Number(e.target.value) || 0)}
            />
            <button
              type="button"
              className="btn btn-mini"
              onClick={() =>
                setGridStartSec(Number(snap.currentTimeSec.toFixed(3)))
              }
            >
              =当前
            </button>
          </label>
          <label className="wb-inline-field">
            <span>终点(s)</span>
            <input
              type="number"
              step={0.001}
              value={gridEndSec}
              onChange={(e) => setGridEndSec(Number(e.target.value) || 0)}
            />
            <button
              type="button"
              className="btn btn-mini"
              onClick={() =>
                setGridEndSec(Number(snap.currentTimeSec.toFixed(3)))
              }
            >
              =当前
            </button>
          </label>
          <label className="wb-inline-field">
            <span>拍间隔数 N</span>
            <input
              type="number"
              min={1}
              max={128}
              value={gridIntervals}
              onChange={(e) =>
                setGridIntervals(Math.max(1, Number(e.target.value) || 1))
              }
            />
          </label>
          <span className="wb-mono-small">
            {estBpm > 0
              ? `测算: ${estBpm.toFixed(2)} BPM (单拍 ${(ibiSec * 1000).toFixed(1)}ms)`
              : "终点需大于起点"}
          </span>
          <button
            type="button"
            className="btn btn-mini"
            onClick={handleGenerateGrid}
          >
            生成 {gridIntervals + 1} 个候选拍点
          </button>
        </div>

        <div className="wb-table-scroll">
          <table className="wb-grid-table">
            <thead>
              <tr>
                <th style={{ width: "74px" }}>ID</th>
                <th style={{ width: "160px" }}>标签</th>
                <th style={{ width: "92px" }}>分类</th>
                <th style={{ width: "86px" }}>状态</th>
                <th style={{ width: "110px" }}>时间 (s)</th>
                <th style={{ width: "80px" }}>预览帧</th>
                <th>候选来源 / 备注 / 切镜构想</th>
              </tr>
            </thead>
            <tbody>
              {filteredMarkers.map((m) => {
                const isSelected = selectedMarker?.id === m.id;
                return (
                  <tr
                    key={m.id}
                    className={isSelected ? "is-selected" : ""}
                    onClick={() => selectTimelineItem("point", m.id, true)}
                  >
                    <td className="wb-mono-cell">
                      <span
                        className="wb-inline-dot"
                        style={{ backgroundColor: m.color || "#f59e0b" }}
                      />
                      <strong>{m.id}</strong>
                    </td>
                    <td>{m.label}</td>
                    <td className="wb-mono-cell">{m.category}</td>
                    <td>
                      <span
                        className={`wb-status-pill ${m.status === "confirmed" ? "confirmed" : "candidate"}`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="wb-mono-cell">
                      {formatTimeDisplay(m.time_sec)}
                    </td>
                    <td className="wb-mono-cell wb-muted">
                      F{toVideoFrame(m.time_sec)}
                    </td>
                    <td>
                      <div className="wb-table-lyric-text">
                        {m.script_idea ||
                          m.note ||
                          (m.origin_candidate_id
                            ? `采纳自 ${m.origin_candidate_id}`
                            : "-")}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Point Marker Inspector */}
      <div className="wb-inspector-pane">
        {!selectedMarker ? (
          <div className="wb-empty-inspector">请在左侧表格选择时间点标记</div>
        ) : (
          <div className="wb-inspector-content">
            <div className="wb-inspector-header">
              <div>
                <span className="wb-inspector-badge">
                  时间点标记 · {selectedMarker.id}
                </span>
                <span className="wb-inspector-sub">
                  帧 F{toVideoFrame(selectedMarker.time_sec)} · 来源:{" "}
                  {selectedMarker.origin_candidate_id || "人工打点"}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-mini btn-danger"
                onClick={deleteSelectedItem}
              >
                删除该点
              </button>
            </div>

            <div className="wb-form-row-3">
              <label>
                <span>标签</span>
                <input
                  type="text"
                  value={selectedMarker.label}
                  onChange={(e) =>
                    updatePointMarker(selectedMarker.id, {
                      label: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>分类</span>
                <select
                  value={selectedMarker.category}
                  onChange={(e) =>
                    updatePointMarker(selectedMarker.id, {
                      category: e.target.value,
                    })
                  }
                >
                  {POINT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>状态</span>
                <select
                  value={selectedMarker.status}
                  onChange={(e) =>
                    updatePointMarker(selectedMarker.id, {
                      status: e.target.value as ItemStatus,
                    })
                  }
                >
                  <option value="candidate">candidate (候选)</option>
                  <option value="confirmed">confirmed (已确认)</option>
                </select>
              </label>
            </div>

            <div className="wb-time-card">
              <div className="wb-time-card-header">
                <span className="wb-time-card-title">
                  ⏱️ 时间点位置 (Time Sec)
                </span>
              </div>
              <div className="wb-time-card-body">
                <input
                  type="number"
                  step={0.001}
                  className="wb-sec-input"
                  value={selectedMarker.time_sec}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (
                      Number.isFinite(val) &&
                      val >= 0 &&
                      val <= getAudioDuration()
                    ) {
                      updatePointMarker(
                        selectedMarker.id,
                        { time_sec: val },
                        true,
                      );
                    }
                  }}
                />
                <div className="wb-nudge-grid">
                  {[-0.05, -0.01, 0.01, 0.05].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      className="btn btn-mini"
                      onClick={() => {
                        const next = Number(
                          Math.max(
                            0,
                            Math.min(
                              getAudioDuration(),
                              selectedMarker.time_sec + delta,
                            ),
                          ).toFixed(6),
                        );
                        updatePointMarker(
                          selectedMarker.id,
                          { time_sec: next },
                          true,
                        );
                        seekAudio(next);
                      }}
                    >
                      {delta > 0 ? `+${delta * 1000}ms` : `${delta * 1000}ms`}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-mini"
                    onClick={() => {
                      const now = Number(snap.currentTimeSec.toFixed(6));
                      updatePointMarker(
                        selectedMarker.id,
                        { time_sec: now },
                        true,
                      );
                    }}
                  >
                    =取播放头
                  </button>
                  <button
                    type="button"
                    className="btn btn-mini"
                    onClick={() => {
                      const nearest = findNearestCandidate(
                        selectedMarker.time_sec,
                        0.25,
                      );
                      if (!nearest) return;
                      applyCandidateProvenance(
                        selectedMarker,
                        nearest,
                        storeState.analysis?.summary,
                        storeState.annotations?.audio_asset,
                      );
                      updatePointMarker(selectedMarker.id, {
                        time_sec: nearest.time_sec,
                      });
                      seekAudio(nearest.time_sec);
                    }}
                  >
                    🧲 吸附候选
                  </button>
                </div>
              </div>
            </div>

            <label className="wb-block-label">
              <span>听感与节奏备注 (Note)</span>
              <textarea
                rows={2}
                value={selectedMarker.note}
                onChange={(e) =>
                  updatePointMarker(selectedMarker.id, { note: e.target.value })
                }
              />
            </label>

            <label className="wb-block-label">
              <span>切镜动作与视觉构想 (Script Idea)</span>
              <textarea
                rows={2}
                value={selectedMarker.script_idea}
                onChange={(e) =>
                  updatePointMarker(selectedMarker.id, {
                    script_idea: e.target.value,
                  })
                }
              />
            </label>

            <div className="wb-agent-box">
              <div className="wb-agent-box-header">
                <span>🤖 给 Agent 的专项指令</span>
                <select
                  value={selectedMarker.agent_status}
                  onChange={(e) =>
                    updatePointMarker(selectedMarker.id, {
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
                value={selectedMarker.agent_comment}
                onChange={(e) =>
                  updatePointMarker(selectedMarker.id, {
                    agent_comment: e.target.value,
                  })
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
