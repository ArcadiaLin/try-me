import React, { useState } from "react";
import {
  countGroupSubtreeImpact,
  findNodeEntryById,
  isNodeEffectivelyLocked,
  isNodeEffectivelyVisible,
} from "../../model.ts";
import { useWorkbenchStore } from "../store/workbenchStore.ts";
import { StateIcon } from "./StateIcon.tsx";
import type { TimelineGroup, TimelineNode, TimelineTrack } from "../types.ts";

export const TimelineExplorer: React.FC = () => {
  const project = useWorkbenchStore((s) => s.project);
  const view = useWorkbenchStore((s) => s.view);
  const searchQuery = useWorkbenchStore((s) => s.searchQuery);
  const colorDraft = useWorkbenchStore((s) => s.edit.colorDraft);

  const selectNode = useWorkbenchStore((s) => s.selectNode);
  const toggleGroupCollapsed = useWorkbenchStore((s) => s.toggleGroupCollapsed);
  const toggleNodeHidden = useWorkbenchStore((s) => s.toggleNodeHidden);
  const toggleNodeLocked = useWorkbenchStore((s) => s.toggleNodeLocked);
  const runExplorerCommand = useWorkbenchStore((s) => s.runExplorerCommand);
  const openContextMenu = useWorkbenchStore((s) => s.openContextMenu);
  const setSearchQuery = useWorkbenchStore((s) => s.setSearchQuery);
  const getEffectiveTrackColor = useWorkbenchStore((s) => s.getEffectiveTrackColor);

  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  void colorDraft;

  const q = searchQuery.trim().toLowerCase();

  const nodeMatchesQuery = (node: TimelineNode): boolean => {
    if (!q) return true;
    if (
      node.name.toLowerCase().includes(q) ||
      node.id.toLowerCase().includes(q)
    ) {
      return true;
    }
    if (node.kind === "group") {
      return node.children.some(nodeMatchesQuery);
    }
    return false;
  };

  const handleStartRename = (node: TimelineNode) => {
    if (isNodeEffectivelyLocked(project.nodes, node.id, view.lockedNodeIds)) {
      return;
    }
    setRenamingNodeId(node.id);
    setRenameDraft(node.name);
  };

  const handleCommitRename = () => {
    if (!renamingNodeId) return;
    const trimmed = renameDraft.trim();
    if (trimmed) {
      runExplorerCommand({
        type: "renameNode",
        nodeId: renamingNodeId,
        name: trimmed,
      });
    }
    setRenamingNodeId(null);
  };

  const handleQuickCreate = (nodeKind: "group" | "timeline") => {
    let parentGroupId: string | null = null;
    if (view.selectedGroupId) {
      parentGroupId = view.selectedGroupId;
    } else if (view.selectedTrackId) {
      const entry = findNodeEntryById(project.nodes, view.selectedTrackId);
      parentGroupId = entry?.parentGroupId ?? null;
    }
    const defaultName =
      nodeKind === "group" ? "新建分组" : "新建时间轴";
    runExplorerCommand({
      type: "createNode",
      parentGroupId,
      nodeKind,
      name: defaultName,
    });
  };

  const renderGroupNode = (group: TimelineGroup, depth: number) => {
    if (!nodeMatchesQuery(group)) return null;
    const isCollapsed = !q && view.collapsedGroupIds.includes(group.id);
    const isSelectedGroup =
      view.selectedGroupId === group.id && !view.selectedTrackId;
    const isActiveAncestor = view.selectedGroupId === group.id;
    const effectiveVisible = isNodeEffectivelyVisible(
      project.nodes,
      group.id,
      view.hiddenNodeIds
    );
    const selfLocked = view.lockedNodeIds.includes(group.id);
    const effectiveLocked = isNodeEffectivelyLocked(
      project.nodes,
      group.id,
      view.lockedNodeIds
    );
    const impact = countGroupSubtreeImpact(group);

    return (
      <div key={group.id} className="explorer-group">
        <div
          className={`explorer-row explorer-row--group ${
            isSelectedGroup ? "is-selected" : isActiveAncestor ? "is-ancestor" : ""
          }`}
          style={{ paddingLeft: `${10 + depth * 16}px` }}
          onClick={() => selectNode(group.id)}
          onDoubleClick={() => handleStartRename(group)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            selectNode(group.id);
            openContextMenu({
              scope: "explorer",
              x: e.clientX,
              y: e.clientY,
              anchorTimeSec: null,
              targetNodeId: group.id,
              targetEventRef: null,
            });
          }}
        >
          <button
            type="button"
            className="explorer-row__chevron"
            onClick={(e) => {
              e.stopPropagation();
              toggleGroupCollapsed(group.id);
            }}
            title={isCollapsed ? "展开分组" : "折叠分组"}
          >
            {isCollapsed ? "▸" : "▾"}
          </button>

          {renamingNodeId === group.id ? (
            <input
              type="text"
              className="explorer-row__rename-input"
              value={renameDraft}
              autoFocus
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={handleCommitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCommitRename();
                if (e.key === "Escape") setRenamingNodeId(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="explorer-row__name" title={`${group.name} (${group.id})`}>
              {group.name}
            </span>
          )}

          <span className="explorer-row__count" title="子树包含时间轴数">
            {impact.trackCount} 轨
          </span>

          <div className="explorer-row__actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`explorer-pill ${effectiveVisible ? "is-on" : "is-off"}`}
              aria-label={`${group.name}：${effectiveVisible ? "隐藏分组" : "显示分组"}`}
              aria-pressed={!effectiveVisible}
              onClick={() => toggleNodeHidden(group.id)}
              title={effectiveVisible ? "点击隐藏此分组" : "点击显示此分组"}
            >
              <StateIcon name="eye" off={!effectiveVisible} />
            </button>
            <button
              type="button"
              className={`explorer-pill ${
                effectiveLocked ? "is-locked" : "is-unlocked"
              }`}
              onClick={() => toggleNodeLocked(group.id)}
              aria-label={`${group.name}：${effectiveLocked ? "已锁定" : "未锁定"}`}
              aria-pressed={effectiveLocked}
              title={
                selfLocked
                  ? "分组已直接锁定（点击解锁）"
                  : effectiveLocked
                    ? "继承上级分组锁定"
                    : "点击锁定此分组及全部下级"
              }
            >
              <StateIcon name="lock" off={!effectiveLocked} />
            </button>
            <button
              type="button"
              className="explorer-pill explorer-pill--menu"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                selectNode(group.id);
                openContextMenu({
                  scope: "explorer",
                  x: rect.left,
                  y: rect.bottom + 4,
                  anchorTimeSec: null,
                  targetNodeId: group.id,
                  targetEventRef: null,
                });
              }}
              title="分组菜单（新建 / 重命名 / 删除）"
            >
              ···
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="explorer-group__children">
            {group.children.map((child) =>
              child.kind === "group"
                ? renderGroupNode(child, depth + 1)
                : renderTrackNode(child, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTrackNode = (track: TimelineTrack, depth: number) => {
    if (!nodeMatchesQuery(track)) return null;
    const isSelected = view.selectedTrackId === track.id;
    const effectiveVisible = isNodeEffectivelyVisible(
      project.nodes,
      track.id,
      view.hiddenNodeIds
    );
    const selfLocked = view.lockedNodeIds.includes(track.id);
    const effectiveLocked = isNodeEffectivelyLocked(
      project.nodes,
      track.id,
      view.lockedNodeIds
    );
    const inheritedLock = effectiveLocked && !selfLocked;
    const swatchColor = getEffectiveTrackColor(track);

    return (
      <div
        key={track.id}
        className={`explorer-row explorer-row--track ${
          isSelected ? "is-selected" : ""
        }`}
        style={{ paddingLeft: `${18 + depth * 16}px` }}
        onClick={() => selectNode(track.id)}
        onDoubleClick={() => handleStartRename(track)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          selectNode(track.id);
          openContextMenu({
            scope: "explorer",
            x: e.clientX,
            y: e.clientY,
            anchorTimeSec: null,
            targetNodeId: track.id,
            targetEventRef: null,
          });
        }}
      >
        <span
          className="explorer-row__swatch"
          style={{ backgroundColor: swatchColor }}
        />

        {renamingNodeId === track.id ? (
          <input
            type="text"
            className="explorer-row__rename-input"
            value={renameDraft}
            autoFocus
            onChange={(e) => setRenameDraft(e.target.value)}
            onBlur={handleCommitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCommitRename();
              if (e.key === "Escape") setRenamingNodeId(null);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="explorer-row__name" title={`${track.name} (${track.id})`}>
            {track.name}
          </span>
        )}

        <span className="explorer-row__count" title="事件条数">
          {track.items.length}
        </span>

        <div className="explorer-row__actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`explorer-pill ${effectiveVisible ? "is-on" : "is-off"}`}
            aria-label={`${track.name}：${effectiveVisible ? "隐藏时间轴" : "显示时间轴"}`}
            aria-pressed={!effectiveVisible}
            onClick={() => toggleNodeHidden(track.id)}
            title={effectiveVisible ? "点击隐藏此时间轴" : "点击显示此时间轴"}
          >
            <StateIcon name="eye" off={!effectiveVisible} />
          </button>
          <button
            type="button"
            className={`explorer-pill ${
              effectiveLocked ? "is-locked" : "is-unlocked"
            }`}
            onClick={() => {
              if (!inheritedLock) toggleNodeLocked(track.id);
            }}
            disabled={inheritedLock}
            aria-label={`${track.name}：${effectiveLocked ? "已锁定" : "未锁定"}`}
            aria-pressed={effectiveLocked}
            title={
              inheritedLock
                ? "所属父分组已锁定（需先解锁父分组）"
                : selfLocked
                  ? "时间轴已锁定（点击解锁）"
                  : "点击锁定此时间轴"
            }
          >
            <StateIcon name="lock" off={!effectiveLocked} />
          </button>
          <button
            type="button"
            className="explorer-pill explorer-pill--menu"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              selectNode(track.id);
              openContextMenu({
                scope: "explorer",
                x: rect.left,
                y: rect.bottom + 4,
                anchorTimeSec: null,
                targetNodeId: track.id,
                targetEventRef: null,
              });
            }}
            title="时间轴菜单（同级新建 / 重命名 / 删除）"
          >
            ···
          </button>
        </div>
      </div>
    );
  };

  return (
    <aside
      className="explorer-pane"
      onContextMenu={(e) => {
        e.preventDefault();
        openContextMenu({
          scope: "explorer",
          x: e.clientX,
          y: e.clientY,
          anchorTimeSec: null,
          targetNodeId: null,
          targetEventRef: null,
        });
      }}
    >
      <div className="pane-header">
        <span className="pane-header__title">时间轴</span>
        <div className="pane-header__actions">
          <button
            type="button"
            className="btn btn--ghost btn--xs"
            onClick={() => handleQuickCreate("group")}
            title="在当前分组下新建子分组"
          >
            + 分组
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--xs"
            onClick={() => handleQuickCreate("timeline")}
            title="在当前分组下新建时间轴"
          >
            + 时间轴
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--xs"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              openContextMenu({
                scope: "explorer",
                x: rect.left,
                y: rect.bottom + 4,
                anchorTimeSec: null,
                targetNodeId: view.selectedTrackId ?? view.selectedGroupId ?? null,
                targetEventRef: null,
              });
            }}
            title="打开资源管理器菜单"
          >
            ···
          </button>
        </div>
      </div>

      <div className="explorer-search">
        <input
          type="search"
          className="input input--sm"
          placeholder="搜索分组或时间轴…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="explorer-tree">
        {project.nodes.map((node) =>
          node.kind === "group"
            ? renderGroupNode(node, 0)
            : renderTrackNode(node, 0)
        )}
      </div>

      <div className="explorer-footer">
        <details className="pane-help">
          <summary>操作提示</summary>
          <p>右键或点击 ··· 新建、重命名、删除。双击名称重命名；空白处右键新建顶层项。</p>
          <p>眼睛表示可见，锁表示已锁定；带斜杠表示隐藏或未锁定。上级分组的状态会作用于下级。</p>
        </details>
      </div>
    </aside>
  );
};
