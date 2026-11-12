import React from "react";
import {
  notifyStore,
  saveAnnotations,
  scheduleAutoSave,
  selectTimelineItem,
  setSaveStatus,
  storeState,
  useWorkbenchStore,
} from "../store/workbenchStore.ts";

export function AgentBriefDrawer(): React.JSX.Element | null {
  const snap = useWorkbenchStore();
  if (!snap.agentDrawerOpen || !snap.annotations) return null;

  const openRegions = snap.annotations.regions.filter(
    (r) => r.agent_comment || r.agent_status === "open",
  );
  const openMarkers = snap.annotations.markers.filter(
    (m) => m.agent_comment || m.agent_status === "open",
  );

  const handleCopyBrief = async () => {
    await saveAnnotations(false);
    await navigator.clipboard.writeText(storeState.agentBriefMarkdown || "");
    setSaveStatus("✓ 已复制 Agent 协作简报到剪贴板");
  };

  return (
    <section className="wb-agent-drawer">
      <div className="wb-agent-drawer-header">
        <div className="wb-toolbar-left">
          <span className="wb-pane-title">
            🤖 Agent 协作与全片创作简报抽屉 (local/annotations/agent-brief.md)
          </span>
          <span className="wb-tree-badge">
            待处理批注: {openRegions.length + openMarkers.length}
          </span>
        </div>
        <div className="wb-toolbar-right">
          <button
            type="button"
            className="btn btn-primary btn-mini"
            onClick={() => {
              void handleCopyBrief();
            }}
          >
            📋 保存并复制简报给 Agent
          </button>
          <button
            type="button"
            className="btn btn-mini"
            onClick={() => {
              storeState.agentDrawerOpen = false;
              notifyStore();
            }}
          >
            收起抽屉 ✕
          </button>
        </div>
      </div>

      <div className="wb-agent-drawer-grid">
        {/* Column 1: Global Notes */}
        <div className="wb-agent-col">
          <h4>1. 全片创意设定与给 Agent 的总要求</h4>
          <label className="wb-block-label">
            <span>全片核心概念 (Overall Concept)</span>
            <textarea
              rows={2}
              value={snap.annotations.global_notes.overall_concept}
              onChange={(e) => {
                if (!storeState.annotations) return;
                storeState.editSeq += 1;
                storeState.annotations.global_notes.overall_concept =
                  e.target.value;
                scheduleAutoSave();
                notifyStore();
              }}
            />
          </label>
          <label className="wb-block-label">
            <span>视觉风格与运动规律 (Visual Style)</span>
            <textarea
              rows={2}
              value={snap.annotations.global_notes.visual_style_notes}
              onChange={(e) => {
                if (!storeState.annotations) return;
                storeState.editSeq += 1;
                storeState.annotations.global_notes.visual_style_notes =
                  e.target.value;
                scheduleAutoSave();
                notifyStore();
              }}
            />
          </label>
          <label className="wb-block-label">
            <span>给 Agent 的下一步指令 (Instructions for Agent)</span>
            <textarea
              rows={2}
              value={snap.annotations.global_notes.instructions_for_agent}
              onChange={(e) => {
                if (!storeState.annotations) return;
                storeState.editSeq += 1;
                storeState.annotations.global_notes.instructions_for_agent =
                  e.target.value;
                scheduleAutoSave();
                notifyStore();
              }}
            />
          </label>
        </div>

        {/* Column 2: Open Action Items */}
        <div className="wb-agent-col">
          <h4>2. 待 Agent 处理的专项批注队列</h4>
          <div className="wb-agent-queue-list">
            {openRegions.length === 0 && openMarkers.length === 0 ? (
              <div className="wb-muted">
                当前没有标记为待处理 (open) 的批注。在任意段落或拍点右侧填写「给
                Agent 的专项指令」后会自动汇总到这里。
              </div>
            ) : null}
            {openRegions.map((r) => (
              <div
                key={r.id}
                className="wb-agent-queue-card"
                onClick={() => selectTimelineItem("region", r.id, true)}
              >
                <div className="wb-agent-queue-top">
                  <strong>
                    {r.id} · {r.label}
                  </strong>
                  <span className="wb-status-pill open">{r.agent_status}</span>
                </div>
                <div className="wb-agent-queue-body">
                  {r.agent_comment || r.script_idea}
                </div>
              </div>
            ))}
            {openMarkers.map((m) => (
              <div
                key={m.id}
                className="wb-agent-queue-card"
                onClick={() => selectTimelineItem("point", m.id, true)}
              >
                <div className="wb-agent-queue-top">
                  <strong>
                    {m.id} · {m.label} ({m.time_sec.toFixed(2)}s)
                  </strong>
                  <span className="wb-status-pill open">{m.agent_status}</span>
                </div>
                <div className="wb-agent-queue-body">
                  {m.agent_comment || m.script_idea}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Markdown Preview */}
        <div className="wb-agent-col">
          <h4>3. 自动生成的 Agent Brief 预览</h4>
          <pre className="wb-agent-md-preview">
            {snap.agentBriefMarkdown || "（保存后自动生成 Markdown 简报）"}
          </pre>
        </div>
      </div>
    </section>
  );
}
