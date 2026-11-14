import React, { useEffect, useState } from "react";
import {
  DEFAULT_RANGE_DURATION_SEC,
  findEventByRef,
  findNodeEntryById,
  findTrackById,
  formatSeconds,
  hasLockedDescendant,
  isNodeEffectivelyLocked,
  isRangeEvent,
} from "../../model.ts";
import { useWorkbenchStore } from "../store/workbenchStore.ts";

export const ContextMenuLayer: React.FC = () => {
  const project = useWorkbenchStore((s) => s.project);
  const view = useWorkbenchStore((s) => s.view);
  const transport = useWorkbenchStore((s) => s.transport);
  const contextMenu = useWorkbenchStore((s) => s.contextMenu);
  const pendingDeleteConfirm = useWorkbenchStore((s) => s.pendingDeleteConfirm);

  const closeContextMenu = useWorkbenchStore((s) => s.closeContextMenu);
  const runWorkbenchCommand = useWorkbenchStore((s) => s.runWorkbenchCommand);
  const runExplorerCommand = useWorkbenchStore((s) => s.runExplorerCommand);
  const requestDeleteNode = useWorkbenchStore((s) => s.requestDeleteNode);
  const confirmDeletePendingNode = useWorkbenchStore(
    (s) => s.confirmDeletePendingNode
  );
  const cancelDeletePendingNode = useWorkbenchStore(
    (s) => s.cancelDeletePendingNode
  );

  // Modal state for creating or renaming node from explorer context menu
  const [nodeModal, setNodeModal] = useState<{
    mode: "create" | "rename";
    parentGroupId: string | null;
    nodeKind: "group" | "timeline";
    targetNodeId?: string;
    initialName: string;
  } | null>(null);
  const [modalNameDraft, setModalNameDraft] = useState("");

  useEffect(() => {
    if (!contextMenu.open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeContextMenu();
      }
    };
    const handleClickOutside = () => {
      closeContextMenu();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [closeContextMenu, contextMenu.open]);

  const anchorTime =
    contextMenu.anchorTimeSec !== null
      ? contextMenu.anchorTimeSec
      : transport.currentTimeSec;

  const renderEventsMenu = () => {
    const trackId =
      contextMenu.targetNodeId ??
      view.selection.primary?.trackId ??
      view.selectedTrackId;
    const track = trackId ? findTrackById(project.nodes, trackId) : null;
    const isLocked = track
      ? isNodeEffectivelyLocked(project.nodes, track.id, view.lockedNodeIds)
      : true;

    const selectedRefs = view.selection.selected;
    const singleSelectedRef =
      selectedRefs.length === 1 ? selectedRefs[0]! : null;
    const singleEventEntry = singleSelectedRef
      ? findEventByRef(project, singleSelectedRef)
      : null;

    // Split eligibility & explicit reason
    let canSplit = false;
    let splitReason = "";
    if (!track) {
      splitReason = "未选择目标时间轴";
    } else if (isLocked) {
      splitReason = "当前时间轴已锁定";
    } else if (selectedRefs.length !== 1 || !singleEventEntry) {
      splitReason =
        selectedRefs.length === 0
          ? "未选中区间事件"
          : "多选状态下不可切分（需单选一条区间事件）";
    } else if (!isRangeEvent(singleEventEntry.event)) {
      splitReason = "点事件不支持切分（仅区间事件可切分）";
    } else {
      const ev = singleEventEntry.event;
      if (
        anchorTime <= ev.startSec + 0.01 ||
        anchorTime >= (ev.endSec ?? ev.startSec) - 0.01
      ) {
        splitReason = `播放头 (${formatSeconds(
          anchorTime
        )}) 不在所选区间 (${formatSeconds(ev.startSec)} – ${formatSeconds(
          ev.endSec!
        )}) 内部`;
      } else {
        canSplit = true;
      }
    }

    const canDelete = !isLocked && selectedRefs.length >= 1;
    const deleteReason = isLocked
      ? "当前时间轴已锁定"
      : selectedRefs.length === 0
        ? "未选中任何事件"
        : "";

    return (
      <div className="ctx-menu__list">
        <div className="ctx-menu__header">
          事件操作 · {track ? track.name : "无活动时间轴"}
        </div>

        <button
          type="button"
          className="ctx-menu__item"
          disabled={!track || isLocked}
          onClick={() => {
            if (!track) return;
            runWorkbenchCommand({
              type: "createEvent",
              trackId: track.id,
              startSec: anchorTime,
              text: "新建点事件",
            });
            closeContextMenu();
          }}
        >
          <span>新建点事件（当前播放头 {formatSeconds(anchorTime)}）</span>
          {isLocked && <span className="ctx-menu__hint">已锁定</span>}
        </button>

        <button
          type="button"
          className="ctx-menu__item"
          disabled={!track || isLocked}
          onClick={() => {
            if (!track) return;
            runWorkbenchCommand({
              type: "createEvent",
              trackId: track.id,
              startSec: anchorTime,
              endSec: Number(
                (anchorTime + DEFAULT_RANGE_DURATION_SEC).toFixed(3)
              ),
              text: "新建区间事件",
            });
            closeContextMenu();
          }}
        >
          <span>
            新建区间…（{formatSeconds(anchorTime)} →{" "}
            {formatSeconds(anchorTime + DEFAULT_RANGE_DURATION_SEC)}）
          </span>
          {isLocked && <span className="ctx-menu__hint">已锁定</span>}
        </button>

        <div className="ctx-menu__divider" />

        <button
          type="button"
          className="ctx-menu__item"
          disabled={!canSplit}
          onClick={() => {
            if (!canSplit || !singleSelectedRef) return;
            runWorkbenchCommand({
              type: "split",
              ref: singleSelectedRef,
              atSec: anchorTime,
            });
            closeContextMenu();
          }}
        >
          <span>
            切分所选区间（播放头 {formatSeconds(anchorTime)}）
          </span>
          {!canSplit && splitReason && (
            <span className="ctx-menu__hint">{splitReason}</span>
          )}
        </button>

        <div className="ctx-menu__divider" />

        <button
          type="button"
          className="ctx-menu__item ctx-menu__item--danger"
          disabled={!canDelete}
          onClick={() => {
            if (!canDelete) return;
            runWorkbenchCommand({
              type: "delete",
              refs: selectedRefs,
            });
            closeContextMenu();
          }}
        >
          <span>删除所选事件 ({selectedRefs.length})</span>
          {!canDelete && deleteReason && (
            <span className="ctx-menu__hint">{deleteReason}</span>
          )}
        </button>
      </div>
    );
  };

  const renderExplorerMenu = () => {
    const targetId = contextMenu.targetNodeId;
    const entry = targetId ? findNodeEntryById(project.nodes, targetId) : null;

    if (!entry) {
      // Blank area context menu: create top-level group or timeline
      return (
        <div className="ctx-menu__list">
          <div className="ctx-menu__header">资源管理器 · 顶层</div>
          <button
            type="button"
            className="ctx-menu__item"
            onClick={() => {
              setModalNameDraft("新建顶层分组");
              setNodeModal({
                mode: "create",
                parentGroupId: null,
                nodeKind: "group",
                initialName: "新建顶层分组",
              });
              closeContextMenu();
            }}
          >
            <span>新建顶层分组…</span>
          </button>
          <button
            type="button"
            className="ctx-menu__item"
            onClick={() => {
              setModalNameDraft("新建顶层时间轴");
              setNodeModal({
                mode: "create",
                parentGroupId: null,
                nodeKind: "timeline",
                initialName: "新建顶层时间轴",
              });
              closeContextMenu();
            }}
          >
            <span>新建顶层时间轴…</span>
          </button>
        </div>
      );
    }

    const { node, parentGroupId } = entry;
    const isLocked = isNodeEffectivelyLocked(
      project.nodes,
      node.id,
      view.lockedNodeIds
    );
    const hasLockedSub =
      node.kind === "group" &&
      hasLockedDescendant(node, view.lockedNodeIds);
    const createParentId = node.kind === "group" ? node.id : parentGroupId;
    const isCreateParentLocked = createParentId
      ? isNodeEffectivelyLocked(
          project.nodes,
          createParentId,
          view.lockedNodeIds
        )
      : false;

    return (
      <div className="ctx-menu__list">
        <div className="ctx-menu__header">
          {node.kind === "group" ? "分组操作" : "时间轴操作"} · {node.name}
        </div>

        <button
          type="button"
          className="ctx-menu__item"
          disabled={isCreateParentLocked}
          onClick={() => {
            setModalNameDraft("新建分组");
            setNodeModal({
              mode: "create",
              parentGroupId: createParentId,
              nodeKind: "group",
              initialName: "新建分组",
            });
            closeContextMenu();
          }}
        >
          <span>
            {node.kind === "group" ? "在此分组内新建子分组…" : "在同级新建分组…"}
          </span>
          {isCreateParentLocked && (
            <span className="ctx-menu__hint">父分组已锁定</span>
          )}
        </button>

        <button
          type="button"
          className="ctx-menu__item"
          disabled={isCreateParentLocked}
          onClick={() => {
            setModalNameDraft("新建时间轴");
            setNodeModal({
              mode: "create",
              parentGroupId: createParentId,
              nodeKind: "timeline",
              initialName: "新建时间轴",
            });
            closeContextMenu();
          }}
        >
          <span>
            {node.kind === "group"
              ? "在此分组内新建时间轴…"
              : "在同级新建时间轴…"}
          </span>
          {isCreateParentLocked && (
            <span className="ctx-menu__hint">父分组已锁定</span>
          )}
        </button>

        <div className="ctx-menu__divider" />

        <button
          type="button"
          className="ctx-menu__item"
          disabled={isLocked}
          onClick={() => {
            setModalNameDraft(node.name);
            setNodeModal({
              mode: "rename",
              parentGroupId,
              nodeKind: node.kind,
              targetNodeId: node.id,
              initialName: node.name,
            });
            closeContextMenu();
          }}
        >
          <span>重命名“{node.name}”…</span>
          {isLocked && <span className="ctx-menu__hint">节点已锁定</span>}
        </button>

        <div className="ctx-menu__divider" />

        <button
          type="button"
          className="ctx-menu__item ctx-menu__item--danger"
          disabled={isLocked || hasLockedSub}
          onClick={() => {
            requestDeleteNode(node.id);
            closeContextMenu();
          }}
        >
          <span>
            删除{node.kind === "group" ? "分组" : "时间轴"}“{node.name}”…
          </span>
          {isLocked ? (
            <span className="ctx-menu__hint">自身或父级已锁定</span>
          ) : hasLockedSub ? (
            <span className="ctx-menu__hint">包含已锁定的子项</span>
          ) : null}
        </button>
      </div>
    );
  };

  // Clamp menu coordinates to viewport
  const menuLeft =
    typeof window !== "undefined"
      ? Math.min(contextMenu.x, Math.max(16, window.innerWidth - 320))
      : contextMenu.x;
  const menuTop =
    typeof window !== "undefined"
      ? Math.min(contextMenu.y, Math.max(16, window.innerHeight - 260))
      : contextMenu.y;

  return (
    <>
      {contextMenu.open && (
        <div
          className="ctx-menu"
          style={{ left: `${menuLeft}px`, top: `${menuTop}px` }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {contextMenu.scope === "explorer"
            ? renderExplorerMenu()
            : renderEventsMenu()}
        </div>
      )}

      {/* Create / Rename Node Modal */}
      {nodeModal && (
        <div className="modal-backdrop" onClick={() => setNodeModal(null)}>
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-dialog__title">
              {nodeModal.mode === "create"
                ? `新建${nodeModal.nodeKind === "group" ? "分组" : "时间轴"}`
                : `重命名${nodeModal.nodeKind === "group" ? "分组" : "时间轴"}`}
            </h3>
            <div className="form-group">
              <label className="form-label">名称</label>
              <input
                type="text"
                className="input"
                value={modalNameDraft}
                autoFocus
                onChange={(e) => setModalNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && modalNameDraft.trim()) {
                    if (nodeModal.mode === "create") {
                      runExplorerCommand({
                        type: "createNode",
                        parentGroupId: nodeModal.parentGroupId,
                        nodeKind: nodeModal.nodeKind,
                        name: modalNameDraft.trim(),
                      });
                    } else if (nodeModal.targetNodeId) {
                      runExplorerCommand({
                        type: "renameNode",
                        nodeId: nodeModal.targetNodeId,
                        name: modalNameDraft.trim(),
                      });
                    }
                    setNodeModal(null);
                  }
                  if (e.key === "Escape") {
                    setNodeModal(null);
                  }
                }}
              />
            </div>
            <div className="modal-dialog__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setNodeModal(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!modalNameDraft.trim()}
                onClick={() => {
                  if (nodeModal.mode === "create") {
                    runExplorerCommand({
                      type: "createNode",
                      parentGroupId: nodeModal.parentGroupId,
                      nodeKind: nodeModal.nodeKind,
                      name: modalNameDraft.trim(),
                    });
                  } else if (nodeModal.targetNodeId) {
                    runExplorerCommand({
                      type: "renameNode",
                      nodeId: nodeModal.targetNodeId,
                      name: modalNameDraft.trim(),
                    });
                  }
                  setNodeModal(null);
                }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-Empty Group / Track Deletion Confirmation Dialog */}
      {pendingDeleteConfirm && (
        <div
          className="modal-backdrop"
          onClick={cancelDeletePendingNode}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-dialog__title">
              确认删除
              {pendingDeleteConfirm.nodeKind === "group" ? "非空分组" : "非空时间轴"}
              “{pendingDeleteConfirm.nodeName}”？
            </h3>
            <p className="modal-dialog__body">
              {pendingDeleteConfirm.nodeKind === "group" ? (
                <>
                  此操作将作为一次可撤销命令移除该分组及其整棵子树，共影响：
                  <br />• 子分组：<strong>{pendingDeleteConfirm.groupCount}</strong> 个
                  <br />• 时间轴：<strong>{pendingDeleteConfirm.trackCount}</strong> 条
                  <br />• 标注事件：<strong>{pendingDeleteConfirm.eventCount}</strong> 条
                </>
              ) : (
                <>
                  此时间轴包含 <strong>{pendingDeleteConfirm.eventCount}</strong>{" "}
                  条标注事件。确认后将整条移除（可通过“撤销”恢复）。
                </>
              )}
            </p>
            <div className="modal-dialog__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={cancelDeletePendingNode}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={confirmDeletePendingNode}
              >
                确认删除子树
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
