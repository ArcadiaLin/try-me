import React, { useState } from "react";
import { collectProjectCommentEntries } from "../../model.ts";
import { useWorkbenchStore } from "../store/workbenchStore.ts";
import type { Comment } from "../types.ts";

interface AgentBriefDrawerProps {
  onSeek: (sec: number) => void;
}

export const AgentBriefDrawer: React.FC<AgentBriefDrawerProps> = ({
  onSeek,
}) => {
  const project = useWorkbenchStore((s) => s.project);
  const agentBriefMarkdown = useWorkbenchStore((s) => s.agentBriefMarkdown);
  const layout = useWorkbenchStore((s) => s.layout);

  const setLayout = useWorkbenchStore((s) => s.setLayout);
  const selectNode = useWorkbenchStore((s) => s.selectNode);
  const selectEvent = useWorkbenchStore((s) => s.selectEvent);
  const runWorkbenchCommand = useWorkbenchStore((s) => s.runWorkbenchCommand);
  const setPersistence = useWorkbenchStore((s) => s.setPersistence);

  const [activeTab, setActiveTab] = useState<"threads" | "markdown">("threads");
  const [globalCommentRole, setGlobalCommentRole] =
    useState<Comment["role"]>("human");
  const [globalCommentText, setGlobalCommentText] = useState("");

  const entries = collectProjectCommentEntries(project);
  const totalCommentCount = entries.reduce(
    (acc, entry) => acc + entry.comments.length,
    0
  );

  const handleAppendProjectComment = () => {
    const trimmed = globalCommentText.trim();
    if (!trimmed) return;
    runWorkbenchCommand({
      type: "appendComment",
      target: { scope: "project" },
      comment: { role: globalCommentRole, text: trimmed },
    });
    setGlobalCommentText("");
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(agentBriefMarkdown);
      setPersistence({ statusMessage: "已复制 Agent 协作简报 Markdown" });
    } catch {
      setPersistence({ statusMessage: "复制失败，请手动复制文本" });
    }
  };

  return (
    <footer
      className={`agent-drawer ${layout.agentDrawerOpen ? "is-open" : ""}`}
    >
      <div
        className="agent-drawer__bar"
        onClick={() => setLayout({ agentDrawerOpen: !layout.agentDrawerOpen })}
      >
        <div className="agent-drawer__bar-left">
          <span className="agent-drawer__chevron">
            {layout.agentDrawerOpen ? "▾" : "▴"}
          </span>
          <span className="agent-drawer__title" title="汇总项目、分组、时间轴和事件评论">
            Agent 协作
          </span>
          <span className="agent-drawer__badge">
            {entries.length} 处 · {totalCommentCount} 条评论
          </span>
        </div>

        <div
          className="agent-drawer__bar-right"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="btn btn--ghost btn--xs"
            onClick={handleCopyMarkdown}
          >
            复制简报
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--xs"
            aria-expanded={layout.agentDrawerOpen}
            aria-controls="agent-drawer-content"
            onClick={() =>
              setLayout({ agentDrawerOpen: !layout.agentDrawerOpen })
            }
          >
            {layout.agentDrawerOpen ? "收起" : "展开"}
          </button>
        </div>
      </div>

      {layout.agentDrawerOpen && (
        <div className="agent-drawer__content" id="agent-drawer-content">
          <div className="agent-drawer__tabs">
            <button
              type="button"
              className={`pane-tab ${activeTab === "threads" ? "is-active" : ""}`}
              onClick={() => setActiveTab("threads")}
            >
              评论 ({entries.length})
            </button>
            <button
              type="button"
              className={`pane-tab ${activeTab === "markdown" ? "is-active" : ""}`}
              onClick={() => setActiveTab("markdown")}
            >
              简报预览
            </button>
          </div>

          {activeTab === "threads" ? (
            <div className="agent-drawer__threads-wrap">
              <div className="agent-drawer__global-composer">
                <span className="wb-label">工程全局评论：</span>
                <select
                  className="select select--sm"
                  value={globalCommentRole}
                  onChange={(e) =>
                    setGlobalCommentRole(e.target.value as Comment["role"])
                  }
                >
                  <option value="human">人类</option>
                  <option value="agent">Agent</option>
                </select>
                <input
                  type="text"
                  className="input input--sm"
                  placeholder="追加工程级全局创作说明或给 Agent 的指令…"
                  value={globalCommentText}
                  onChange={(e) => setGlobalCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAppendProjectComment();
                  }}
                />
                <button
                  type="button"
                  className="btn btn--primary btn--xs"
                  disabled={!globalCommentText.trim()}
                  onClick={handleAppendProjectComment}
                >
                  追加全局评论
                </button>
              </div>

              <div className="agent-drawer__grid">
                {entries.map((entry, idx) => (
                  <div
                    key={`${entry.scope}_${entry.targetId}_${idx}`}
                    className="agent-thread-card"
                    onClick={() => {
                      if (entry.eventRef) {
                        selectEvent(entry.eventRef, false);
                        onSeek(entry.startSec);
                      } else if (entry.nodeId) {
                        selectNode(entry.nodeId);
                        setLayout({ activeCenterSubView: "trackSettings" });
                      }
                    }}
                  >
                    <div className="agent-thread-card__head">
                      <span className="agent-thread-card__scope">
                        {entry.scope === "project"
                          ? "全局"
                          : entry.scope === "group"
                            ? "分组"
                            : entry.scope === "timeline"
                              ? "时间轴"
                              : "事件"}
                      </span>
                      <strong className="agent-thread-card__target">
                        {entry.targetLabel}
                      </strong>
                      <span className="agent-thread-card__time">
                        {entry.timeRangeLabel}
                      </span>
                    </div>
                    <div className="agent-thread-card__path">
                      路径：{entry.pathLabel}
                    </div>
                    <div className="agent-thread-card__list">
                      {entry.comments.map((c, cIdx) => (
                        <div key={cIdx} className="agent-thread-card__comment">
                          <span
                            className={`comment-role-pill ${
                              c.role === "agent" ? "is-agent" : "is-human"
                            }`}
                          >
                            {c.role === "agent" ? "Agent" : "人类"}
                          </span>
                          <span>{c.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <pre className="agent-drawer__markdown">{agentBriefMarkdown}</pre>
          )}
        </div>
      )}
    </footer>
  );
};
