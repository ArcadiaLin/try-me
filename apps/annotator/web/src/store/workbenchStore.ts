import { useSyncExternalStore } from "react";

type StateUpdater<T> = Partial<T> | ((state: T) => Partial<T>);

interface StoreApi<T> {
  <U>(selector: (state: T) => U): U;
  getState: () => T;
  setState: (updater: StateUpdater<T>) => void;
  subscribe: (listener: () => void) => () => void;
}

function create<T extends object>(
  initializer: (
    set: (updater: StateUpdater<T>) => void,
    get: () => T
  ) => T,
  reconcile: (state: T) => T = (state) => state,
): StoreApi<T> {
  const listeners = new Set<() => void>();
  let state!: T;

  const getState = () => state;
  const setState = (updater: StateUpdater<T>) => {
    const partial = typeof updater === "function" ? updater(state) : updater;
    state = reconcile({ ...state, ...partial });
    for (const listener of listeners) {
      listener();
    }
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  state = initializer(setState, getState);

  const useStore = (<U>(selector: (s: T) => U): U =>
    useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(state)
    )) as StoreApi<T>;

  useStore.getState = getState;
  useStore.setState = setState;
  useStore.subscribe = subscribe;
  return useStore;
}
import {
  cloneProject,
  countGroupSubtreeImpact,
  createEmptyProject,
  executeExplorerCommand,
  executeWorkbenchCommand,
  findEventByRef,
  findNodeEntryById,
  findTrackById,
  flattenTracks,
  generateAgentBriefMarkdown,
  hasLockedDescendant,
  isNodeEffectivelyLocked,
  moveEventToTrack,
  resolveEventColor,
  sortTrackItems,
} from "../../model.ts";
import type {
  AnalysisBundle,
  BoundaryLink,
  ContextMenuState,
  EventRef,
  ExplorerCommand,
  PersistenceState,
  SelectionState,
  TimelineEvent,
  TimelineProject,
  TimelineTrack,
  TimelineViewState,
  TransportState,
  WorkbenchCommand,
  WorkbenchEditState,
  WorkspaceLayoutState,
} from "../types.ts";
import { saveLocalDraft } from "../utils/idb-draft.ts";

interface UndoSnapshot {
  project: TimelineProject;
  boundaryLinks: BoundaryLink[];
  selection: SelectionState;
  selectedTrackId: string | null;
  selectedGroupId: string | null;
}

export interface PendingGroupDeleteConfirm {
  nodeId: string;
  nodeName: string;
  nodeKind: "group" | "timeline";
  groupCount: number;
  trackCount: number;
  eventCount: number;
}

export interface WorkbenchStoreState {
  project: TimelineProject;
  analysis: AnalysisBundle | null;
  agentBriefMarkdown: string;
  view: TimelineViewState;
  transport: TransportState;
  edit: WorkbenchEditState;
  contextMenu: ContextMenuState;
  layout: WorkspaceLayoutState;
  persistence: PersistenceState;

  // UI filter states
  searchQuery: string;
  eventFilterQuery: string;
  eventCommentFilter: "all" | "commented";
  pendingDeleteConfirm: PendingGroupDeleteConfirm | null;
  pendingEventSwitch: { ref: EventRef; shiftRangeSelect: boolean; audition: boolean } | null;
  eventEditBaseline: { ref: EventRef; snapshot: string } | null;
  eventDraftDirty: boolean;

  // Undo / Redo stacks
  undoStack: UndoSnapshot[];
  redoStack: UndoSnapshot[];

  // Actions
  hydrate: (payload: {
    project: TimelineProject;
    analysis?: AnalysisBundle | null;
    agentBriefMarkdown?: string;
    savedAt?: string | null;
    hasLocalDraft?: boolean;
  }) => void;
  replaceProject: (project: TimelineProject, statusMessage?: string, markDirty?: boolean) => void;

  // Selection & navigation
  selectNode: (nodeId: string) => void;
  selectEvent: (ref: EventRef | null, shiftRangeSelect?: boolean, audition?: boolean) => boolean;
  confirmEventSwitch: () => void;
  cancelEventSwitch: () => void;
  loopCurrentEvent: () => void;
  hasCurrentEventChanges: () => boolean;
  setEventDraftDirty: (dirty: boolean) => void;
  selectNextEvent: () => EventRef | null;
  toggleGroupCollapsed: (groupId: string) => void;
  toggleNodeHidden: (nodeId: string) => void;
  toggleNodeLocked: (nodeId: string) => void;

  // Commands
  runExplorerCommand: (cmd: ExplorerCommand) => string | undefined;
  requestDeleteNode: (nodeId: string) => void;
  confirmDeletePendingNode: () => void;
  cancelDeletePendingNode: () => void;
  runWorkbenchCommand: (cmd: WorkbenchCommand) => void;
  moveEventToAnotherTrack: (ref: EventRef, targetTrackId: string) => void;

  // Color draft (live preview -> confirm / cancel / restore auto)
  startColorDraft: (
    target: { kind: "track"; trackId: string } | { kind: "event"; ref: EventRef }
  ) => void;
  updateColorDraft: (draftColor?: string) => void;
  commitColorDraft: () => void;
  cancelColorDraft: () => void;
  resetColorToAuto: (
    target: { kind: "track"; trackId: string } | { kind: "event"; ref: EventRef }
  ) => void;
  getEffectiveEventColor: (event: TimelineEvent, track?: TimelineTrack | null) => string;
  getEffectiveTrackColor: (track?: TimelineTrack | null) => string;

  // Undo / Redo
  undo: () => void;
  redo: () => void;

  // Viewport & Transport
  setVisibleWindow: (startSec: number, endSec: number) => void;
  zoomByFactor: (factor: number, anchorSec?: number) => void;
  setCurrentTimeSec: (sec: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setLoopEnabled: (enabled: boolean) => void;
  setLoopRange: (range: [number, number] | null) => void;
  setLoopEvent: (ref: EventRef | null) => void;

  // Context Menu, Layout & Persistence
  openContextMenu: (menu: Omit<ContextMenuState, "open">) => void;
  closeContextMenu: () => void;
  setLayout: (patch: Partial<WorkspaceLayoutState>) => void;
  setPersistence: (patch: Partial<PersistenceState>) => void;
  setSearchQuery: (q: string) => void;
  setEventFilterQuery: (q: string) => void;
  setEventCommentFilter: (filter: "all" | "commented") => void;
}

const DEFAULT_DURATION_SEC = 205.533;

function persistDraftQuietly(project: TimelineProject): void {
  saveLocalDraft(project).catch(() => {
    // Ignore IndexedDB quota/availability errors in non-browser environments
  });
}

function eventSnapshot(event: TimelineEvent, trackId: string): string {
  return JSON.stringify({
    trackId,
    startSec: event.startSec,
    endSec: event.endSec ?? null,
    text: event.text,
    color: event.color ?? null,
    comments: (event.comments ?? []).map(({ role, text }) => ({ role, text })),
  });
}

export const useWorkbenchStore = create<WorkbenchStoreState>((set, get) => ({
  project: createEmptyProject(),
  analysis: null,
  agentBriefMarkdown: "",
  view: {
    visibleStartSec: 0,
    visibleEndSec: 45,
    zoomPxPerSec: 25,
    selectedGroupId: "col_lyrics",
    selectedTrackId: "trk_lyrics",
    collapsedGroupIds: [],
    hiddenNodeIds: [],
    lockedNodeIds: [],
    selection: {
      primary: null,
      selected: [],
    },
  },
  transport: {
    currentTimeSec: 0,
    isPlaying: false,
    loopEnabled: false,
    loopRange: null,
    loopEventRef: null,
  },
  edit: {
    boundaryLinks: [],
    dragging: null,
    colorDraft: null,
    canUndo: false,
    canRedo: false,
  },
  contextMenu: {
    open: false,
    scope: null,
    x: 0,
    y: 0,
    anchorTimeSec: null,
    targetNodeId: null,
    targetEventRef: null,
  },
  layout: {
    trackerHeightPx: 300,
    explorerWidthPx: 292,
    listWidthPx: 660,
    agentDrawerOpen: false,
    activeCenterSubView: "events",
  },
  persistence: {
    dirty: false,
    saving: false,
    lastSavedAt: null,
    hasLocalDraft: false,
    statusMessage: "就绪",
    errorMessage: null,
  },
  searchQuery: "",
  eventFilterQuery: "",
  eventCommentFilter: "all",
  pendingDeleteConfirm: null,
  pendingEventSwitch: null,
  eventEditBaseline: null,
  eventDraftDirty: false,
  undoStack: [],
  redoStack: [],

  hydrate: ({ project, analysis, agentBriefMarkdown, savedAt, hasLocalDraft }) => {
    const tracks = flattenTracks(project.nodes);
    const firstTrackEntry =
      tracks.find((t) => t.track.id === "trk_lyrics") ?? tracks[0] ?? null;
    const selectedTrackId = firstTrackEntry?.track.id ?? null;
    const selectedGroupId = firstTrackEntry?.parentGroupId ?? null;
    const firstEvent = firstTrackEntry?.track.items[0] ?? null;
    const primary: EventRef | null =
      selectedTrackId && firstEvent
        ? { trackId: selectedTrackId, eventId: firstEvent.id }
        : null;

    const clipTrack = findTrackById(project.nodes, "trk_inspect_clips");
    const firstClip = clipTrack?.items[0];
    const loopRange: [number, number] | null =
      firstClip && firstClip.endSec !== undefined
        ? [firstClip.startSec, firstClip.endSec]
        : null;

    set((state) => ({
      project,
      analysis: analysis ?? state.analysis,
      agentBriefMarkdown: agentBriefMarkdown ?? generateAgentBriefMarkdown(project),
      view: {
        ...state.view,
        visibleStartSec: 0,
        visibleEndSec: 45,
        selectedGroupId,
        selectedTrackId,
        selection: {
          primary,
          selected: primary ? [primary] : [],
        },
      },
      transport: {
        ...state.transport,
        loopRange: loopRange ?? state.transport.loopRange,
        loopEventRef: null,
        loopEnabled: false,
      },
      pendingEventSwitch: null,
      eventEditBaseline: null,
      eventDraftDirty: false,
      edit: {
        ...state.edit,
        boundaryLinks: [],
        colorDraft: null,
        canUndo: false,
        canRedo: false,
      },
      persistence: {
        ...state.persistence,
        dirty: false,
        lastSavedAt: savedAt ?? state.persistence.lastSavedAt,
        hasLocalDraft: hasLocalDraft ?? state.persistence.hasLocalDraft,
        statusMessage: "已加载工程时间轴",
        errorMessage: null,
      },
      undoStack: [],
      redoStack: [],
    }));
  },

  replaceProject: (project, statusMessage = "已更新工程数据", markDirty = true) => {
    const state = get();
    const snapshot: UndoSnapshot = {
      project: cloneProject(state.project),
      boundaryLinks: [...state.edit.boundaryLinks],
      selection: {
        primary: state.view.selection.primary ? { ...state.view.selection.primary } : null,
        selected: state.view.selection.selected.map((r) => ({ ...r })),
      },
      selectedTrackId: state.view.selectedTrackId,
      selectedGroupId: state.view.selectedGroupId,
    };
    const nextUndo = [...state.undoStack.slice(-29), snapshot];
    if (markDirty) {
      persistDraftQuietly(project);
    }
    set({
      project,
      agentBriefMarkdown: generateAgentBriefMarkdown(project),
      undoStack: nextUndo,
      redoStack: [],
      edit: {
        ...state.edit,
        colorDraft: null,
        canUndo: nextUndo.length > 0,
        canRedo: false,
      },
      persistence: {
        ...state.persistence,
        dirty: markDirty,
        hasLocalDraft: markDirty ? true : state.persistence.hasLocalDraft,
        statusMessage,
        errorMessage: null,
      },
    });
  },

  selectNode: (nodeId) => {
    const state = get();
    const entry = findNodeEntryById(state.project.nodes, nodeId);
    if (!entry) return;

    const targetTrack = entry.node.kind === "timeline"
      ? entry.node
      : flattenTracks([entry.node])[0]?.track;
    const current = state.view.selection.primary;
    const containsCurrent = entry.node.kind === "group" &&
      flattenTracks([entry.node]).some((t) => t.track.id === current?.trackId);
    if (current && targetTrack?.items[0] && current.trackId !== targetTrack.id && !containsCurrent) {
      state.selectEvent({ trackId: targetTrack.id, eventId: targetTrack.items[0].id });
      return;
    }

    if (entry.node.kind === "group") {
      const subTracks = flattenTracks([entry.node]);
      const currentTrackStillInSubtree = subTracks.some(
        (t) => t.track.id === state.view.selectedTrackId
      );
      const nextTrack = currentTrackStillInSubtree
        ? findTrackById(state.project.nodes, state.view.selectedTrackId!)
        : subTracks[0]?.track ?? null;
      const nextTrackId = nextTrack?.id ?? null;
      const firstEv = nextTrack?.items[0] ?? null;
      const nextPrimary: EventRef | null =
        nextTrackId && firstEv ? { trackId: nextTrackId, eventId: firstEv.id } : null;

      set({
        view: {
          ...state.view,
          selectedGroupId: entry.node.id,
          selectedTrackId: nextTrackId,
          selection: currentTrackStillInSubtree
            ? state.view.selection
            : {
                primary: nextPrimary,
                selected: nextPrimary ? [nextPrimary] : [],
              },
        },
        edit: {
          ...state.edit,
          colorDraft: null,
        },
      });
      return;
    }

    // Node is a timeline track
    const track = entry.node;
    const currentPrimaryOnThisTrack =
      state.view.selection.primary?.trackId === track.id &&
      track.items.some((ev) => ev.id === state.view.selection.primary?.eventId);

    const firstEv = track.items[0] ?? null;
    const nextPrimary: EventRef | null = currentPrimaryOnThisTrack
      ? state.view.selection.primary
      : firstEv
        ? { trackId: track.id, eventId: firstEv.id }
        : null;

    set({
      view: {
        ...state.view,
        selectedGroupId: entry.parentGroupId,
        selectedTrackId: track.id,
        selection: currentPrimaryOnThisTrack
          ? state.view.selection
          : {
              primary: nextPrimary,
              selected: nextPrimary ? [nextPrimary] : [],
            },
      },
      edit: {
        ...state.edit,
        colorDraft: null,
      },
    });
  },

  selectEvent: (ref, shiftRangeSelect = false, audition = false) => {
    const state = get();
    const current = state.view.selection.primary;
    if (ref && !findEventByRef(state.project, ref)) return false;
    if (ref && current && (ref.trackId !== current.trackId || ref.eventId !== current.eventId)) {
      set({ pendingEventSwitch: { ref, shiftRangeSelect, audition } });
      if (!state.hasCurrentEventChanges()) {
        get().confirmEventSwitch();
        return true;
      }
      return false;
    }
    if (!ref) {
      set({
        view: {
          ...state.view,
          selection: { primary: null, selected: [] },
        },
        edit: {
          ...state.edit,
          colorDraft: null,
        },
      });
      return true;
    }

    const trackEntry = findNodeEntryById(state.project.nodes, ref.trackId);
    const track = trackEntry?.node.kind === "timeline" ? trackEntry.node : null;
    if (!track) return false;

    let nextSelected: EventRef[] = [ref];
    if (
      shiftRangeSelect &&
      state.view.selection.primary &&
      state.view.selection.primary.trackId === ref.trackId
    ) {
      const sorted = sortTrackItems(track.items);
      const anchorIdx = sorted.findIndex(
        (item) => item.id === state.view.selection.primary!.eventId
      );
      const targetIdx = sorted.findIndex((item) => item.id === ref.eventId);
      if (anchorIdx !== -1 && targetIdx !== -1) {
        const start = Math.min(anchorIdx, targetIdx);
        const end = Math.max(anchorIdx, targetIdx);
        nextSelected = sorted
          .slice(start, end + 1)
          .map((item) => ({ trackId: track.id, eventId: item.id }));
      }
    }

    set({
      pendingEventSwitch: null,
      view: {
        ...state.view,
        selectedGroupId: trackEntry?.parentGroupId ?? state.view.selectedGroupId,
        selectedTrackId: track.id,
        selection: {
          primary: ref,
          selected: nextSelected,
        },
      },
      edit: {
        ...state.edit,
        colorDraft: null,
      },
    });
    return true;
  },

  cancelEventSwitch: () => set({ pendingEventSwitch: null }),

  setEventDraftDirty: (dirty) => {
    if (get().eventDraftDirty !== dirty) set({ eventDraftDirty: dirty });
  },

  hasCurrentEventChanges: () => {
    const state = get();
    const found = findEventByRef(state.project, state.view.selection.primary);
    if (!found) return false;
    const baseline = state.eventEditBaseline;
    const draft = state.edit.colorDraft;
    const hasColorPreview = draft?.target.kind === "event" &&
      draft.target.ref.trackId === found.track.id && draft.target.ref.eventId === found.event.id &&
      draft.draftColor !== resolveEventColor(found.event, found.track);
    return state.eventDraftDirty || Boolean(hasColorPreview) ||
      (baseline !== null && baseline.snapshot !== eventSnapshot(found.event, found.track.id));
  },

  confirmEventSwitch: () => {
    const state = get();
    const pending = state.pendingEventSwitch;
    if (!pending) return;
    const found = findEventByRef(state.project, pending.ref);
    if (!found) { set({ pendingEventSwitch: null }); return; }
    // Apply selection and transport together after explicit confirmation.
    const trackEntry = findNodeEntryById(state.project.nodes, pending.ref.trackId);
    let selected = [pending.ref];
    if (pending.shiftRangeSelect && state.view.selection.primary?.trackId === pending.ref.trackId) {
      const sorted = sortTrackItems(found.track.items);
      const anchor = sorted.findIndex((e) => e.id === state.view.selection.primary?.eventId);
      const target = sorted.findIndex((e) => e.id === pending.ref.eventId);
      if (anchor >= 0 && target >= 0) selected = sorted.slice(Math.min(anchor, target), Math.max(anchor, target) + 1)
        .map((e) => ({ trackId: found.track.id, eventId: e.id }));
    }
    const range = found.event.endSec !== undefined;
    const followLoop = Boolean(state.transport.loopEventRef) || state.transport.loopEnabled || pending.audition;
    set({
      pendingEventSwitch: null,
      view: { ...state.view, selectedTrackId: found.track.id,
        selectedGroupId: trackEntry?.parentGroupId ?? null,
        selection: { primary: pending.ref, selected } },
      edit: { ...state.edit, colorDraft: null },
      transport: { ...state.transport, currentTimeSec: found.event.startSec,
        loopEventRef: followLoop && range ? pending.ref : null,
        loopRange: followLoop && range ? [found.event.startSec, found.event.endSec!] : null,
        loopEnabled: followLoop && range && (state.transport.loopEnabled || pending.audition),
        isPlaying: (pending.audition && range) || state.transport.isPlaying },
    });
  },

  loopCurrentEvent: () => {
    const state = get();
    const ref = state.view.selection.primary;
    const found = findEventByRef(state.project, ref);
    if (!ref || found?.event.endSec === undefined) return;
    set({ transport: { ...state.transport, loopEventRef: ref, loopEnabled: true,
      loopRange: [found.event.startSec, found.event.endSec],
      currentTimeSec: found.event.startSec, isPlaying: true } });
  },

  selectNextEvent: () => {
    const state = get();
    const trackId = state.view.selection.primary?.trackId ?? state.view.selectedTrackId;
    if (!trackId) return null;
    const track = findTrackById(state.project.nodes, trackId);
    if (!track || track.items.length === 0) return null;
    const sorted = sortTrackItems(track.items);
    const currentId = state.view.selection.primary?.eventId;
    const idx = sorted.findIndex((ev) => ev.id === currentId);
    const nextItem =
      idx === -1 ? sorted[0]! : sorted[Math.min(sorted.length - 1, idx + 1)]!;
    const nextRef: EventRef = { trackId: track.id, eventId: nextItem.id };

    if (nextItem.id === currentId) return null;
    state.selectEvent(nextRef);
    return nextRef;
  },

  toggleGroupCollapsed: (groupId) => {
    set((state) => {
      const exists = state.view.collapsedGroupIds.includes(groupId);
      const next = exists
        ? state.view.collapsedGroupIds.filter((id) => id !== groupId)
        : [...state.view.collapsedGroupIds, groupId];
      return {
        view: {
          ...state.view,
          collapsedGroupIds: next,
        },
      };
    });
  },

  toggleNodeHidden: (nodeId) => {
    set((state) => {
      const exists = state.view.hiddenNodeIds.includes(nodeId);
      const next = exists
        ? state.view.hiddenNodeIds.filter((id) => id !== nodeId)
        : [...state.view.hiddenNodeIds, nodeId];
      return {
        view: {
          ...state.view,
          hiddenNodeIds: next,
        },
      };
    });
  },

  toggleNodeLocked: (nodeId) => {
    set((state) => {
      const exists = state.view.lockedNodeIds.includes(nodeId);
      const next = exists
        ? state.view.lockedNodeIds.filter((id) => id !== nodeId)
        : [...state.view.lockedNodeIds, nodeId];
      return {
        view: {
          ...state.view,
          lockedNodeIds: next,
        },
      };
    });
  },

  runExplorerCommand: (cmd) => {
    const state = get();
    try {
      const snapshot: UndoSnapshot = {
        project: cloneProject(state.project),
        boundaryLinks: [...state.edit.boundaryLinks],
        selection: {
          primary: state.view.selection.primary ? { ...state.view.selection.primary } : null,
          selected: state.view.selection.selected.map((r) => ({ ...r })),
        },
        selectedTrackId: state.view.selectedTrackId,
        selectedGroupId: state.view.selectedGroupId,
      };
      const result = executeExplorerCommand(state.project, cmd, state.view.lockedNodeIds);
      const nextUndo = [...state.undoStack.slice(-29), snapshot];

      let nextSelectedTrackId = state.view.selectedTrackId;
      let nextSelectedGroupId = state.view.selectedGroupId;
      let nextSelection = state.view.selection;
      let nextBoundaryLinks = state.edit.boundaryLinks;

      if (cmd.type === "createNode" && result.createdNodeId) {
        if (cmd.nodeKind === "group") {
          nextSelectedGroupId = result.createdNodeId;
        } else {
          nextSelectedTrackId = result.createdNodeId;
          nextSelectedGroupId = cmd.parentGroupId;
          nextSelection = { primary: null, selected: [] };
        }
      }

      if (cmd.type === "deleteNode" && result.deletedNodeIds) {
        const deletedNodes = new Set(result.deletedNodeIds);
        const remainingTracks = flattenTracks(result.project.nodes);
        if (nextSelectedTrackId && deletedNodes.has(nextSelectedTrackId)) {
          nextSelectedTrackId = remainingTracks[0]?.track.id ?? null;
        }
        if (nextSelectedGroupId && deletedNodes.has(nextSelectedGroupId)) {
          nextSelectedGroupId = remainingTracks[0]?.parentGroupId ?? null;
        }
        if (
          nextSelection.primary &&
          deletedNodes.has(nextSelection.primary.trackId)
        ) {
          const fallbackTrack = nextSelectedTrackId
            ? findTrackById(result.project.nodes, nextSelectedTrackId)
            : null;
          const firstEv = fallbackTrack?.items[0] ?? null;
          const nextPrimary =
            fallbackTrack && firstEv
              ? { trackId: fallbackTrack.id, eventId: firstEv.id }
              : null;
          nextSelection = {
            primary: nextPrimary,
            selected: nextPrimary ? [nextPrimary] : [],
          };
        }
        nextBoundaryLinks = nextBoundaryLinks.filter((l) => !deletedNodes.has(l.trackId));
      }

      persistDraftQuietly(result.project);
      set({
        project: result.project,
        agentBriefMarkdown: generateAgentBriefMarkdown(result.project),
        view: {
          ...state.view,
          selectedGroupId: nextSelectedGroupId,
          selectedTrackId: nextSelectedTrackId,
          selection: nextSelection,
        },
        edit: {
          ...state.edit,
          boundaryLinks: nextBoundaryLinks,
          colorDraft: null,
          canUndo: nextUndo.length > 0,
          canRedo: false,
        },
        undoStack: nextUndo,
        redoStack: [],
        persistence: {
          ...state.persistence,
          dirty: true,
          hasLocalDraft: true,
          statusMessage:
            cmd.type === "createNode"
              ? `已新建${cmd.nodeKind === "group" ? "分组" : "时间轴"}：${cmd.name}`
              : cmd.type === "renameNode"
                ? `已重命名为：${cmd.name}`
                : "已删除节点",
          errorMessage: null,
        },
      });
      return result.createdNodeId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({
        persistence: {
          ...state.persistence,
          errorMessage: msg,
          statusMessage: msg,
        },
      });
      return undefined;
    }
  },

  requestDeleteNode: (nodeId) => {
    const state = get();
    const entry = findNodeEntryById(state.project.nodes, nodeId);
    if (!entry) return;
    if (isNodeEffectivelyLocked(state.project.nodes, nodeId, state.view.lockedNodeIds)) {
      const msg = `无法删除“${entry.node.name}”：该节点或其父分组已锁定`;
      set({
        persistence: {
          ...state.persistence,
          errorMessage: msg,
          statusMessage: msg,
        },
      });
      return;
    }
    if (
      entry.node.kind === "group" &&
      hasLockedDescendant(entry.node, state.view.lockedNodeIds)
    ) {
      const msg = `无法删除分组“${entry.node.name}”：子树内包含已锁定的分组或时间轴`;
      set({
        persistence: {
          ...state.persistence,
          errorMessage: msg,
          statusMessage: msg,
        },
      });
      return;
    }

    if (entry.node.kind === "group") {
      const impact = countGroupSubtreeImpact(entry.node);
      if (impact.groupCount > 0 || impact.trackCount > 0 || impact.eventCount > 0) {
        set({
          pendingDeleteConfirm: {
            nodeId: entry.node.id,
            nodeName: entry.node.name,
            nodeKind: "group",
            ...impact,
          },
        });
        return;
      }
    } else if (entry.node.items.length > 0) {
      set({
        pendingDeleteConfirm: {
          nodeId: entry.node.id,
          nodeName: entry.node.name,
          nodeKind: "timeline",
          groupCount: 0,
          trackCount: 1,
          eventCount: entry.node.items.length,
        },
      });
      return;
    }

    get().runExplorerCommand({ type: "deleteNode", nodeId });
  },

  confirmDeletePendingNode: () => {
    const pending = get().pendingDeleteConfirm;
    if (!pending) return;
    set({ pendingDeleteConfirm: null });
    get().runExplorerCommand({ type: "deleteNode", nodeId: pending.nodeId });
  },

  cancelDeletePendingNode: () => {
    set({ pendingDeleteConfirm: null });
  },

  runWorkbenchCommand: (cmd) => {
    const state = get();
    try {
      const maxDurationSec =
        state.analysis?.summary?.audio_file?.duration_sec ?? DEFAULT_DURATION_SEC;
      const snapshot: UndoSnapshot = {
        project: cloneProject(state.project),
        boundaryLinks: [...state.edit.boundaryLinks],
        selection: {
          primary: state.view.selection.primary ? { ...state.view.selection.primary } : null,
          selected: state.view.selection.selected.map((r) => ({ ...r })),
        },
        selectedTrackId: state.view.selectedTrackId,
        selectedGroupId: state.view.selectedGroupId,
      };
      const result = executeWorkbenchCommand(state.project, cmd, {
        lockedNodeIds: state.view.lockedNodeIds,
        boundaryLinks: state.edit.boundaryLinks,
        maxDurationSec,
      });
      const nextUndo = [...state.undoStack.slice(-29), snapshot];

      let nextSelection = state.view.selection;
      let nextSelectedTrackId = state.view.selectedTrackId;
      if (result.primaryRef !== undefined) {
        if (result.primaryRef === null) {
          const currentTrack = nextSelectedTrackId
            ? findTrackById(result.project.nodes, nextSelectedTrackId)
            : null;
          const fallbackEv = currentTrack?.items[0] ?? null;
          const fallbackRef =
            currentTrack && fallbackEv
              ? { trackId: currentTrack.id, eventId: fallbackEv.id }
              : null;
          nextSelection = {
            primary: fallbackRef,
            selected: fallbackRef ? [fallbackRef] : [],
          };
        } else {
          nextSelectedTrackId = result.primaryRef.trackId;
          nextSelection = {
            primary: result.primaryRef,
            selected: [result.primaryRef],
          };
        }
      }

      persistDraftQuietly(result.project);
      set({
        project: result.project,
        agentBriefMarkdown: generateAgentBriefMarkdown(result.project),
        view: {
          ...state.view,
          selectedTrackId: nextSelectedTrackId,
          selection: nextSelection,
        },
        edit: {
          ...state.edit,
          boundaryLinks: result.boundaryLinks,
          colorDraft: null,
          canUndo: nextUndo.length > 0,
          canRedo: false,
        },
        undoStack: nextUndo,
        redoStack: [],
        persistence: {
          ...state.persistence,
          dirty: true,
          hasLocalDraft: true,
          statusMessage:
            cmd.type === "createEvent"
              ? `已新建事件 ${result.createdEventRef?.eventId ?? ""}`
              : cmd.type === "split"
                ? `已切分事件，新增右段 ${result.splitRightEventRef?.eventId ?? ""}`
                : cmd.type === "delete"
                  ? `已删除 ${cmd.refs.length} 条事件`
                  : cmd.type === "appendComment"
                    ? "已追加评论"
                    : "已更新标注",
          errorMessage: null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({
        persistence: {
          ...state.persistence,
          errorMessage: msg,
          statusMessage: msg,
        },
      });
    }
  },

  moveEventToAnotherTrack: (ref, targetTrackId) => {
    const state = get();
    try {
      const snapshot: UndoSnapshot = {
        project: cloneProject(state.project),
        boundaryLinks: [...state.edit.boundaryLinks],
        selection: {
          primary: state.view.selection.primary ? { ...state.view.selection.primary } : null,
          selected: state.view.selection.selected.map((r) => ({ ...r })),
        },
        selectedTrackId: state.view.selectedTrackId,
        selectedGroupId: state.view.selectedGroupId,
      };
      const result = moveEventToTrack(state.project, ref, targetTrackId, {
        lockedNodeIds: state.view.lockedNodeIds,
        boundaryLinks: state.edit.boundaryLinks,
      });
      const nextUndo = [...state.undoStack.slice(-29), snapshot];
      const nextRef = result.primaryRef ?? { trackId: targetTrackId, eventId: ref.eventId };
      const targetEntry = findNodeEntryById(result.project.nodes, targetTrackId);

      persistDraftQuietly(result.project);
      set({
        project: result.project,
        agentBriefMarkdown: generateAgentBriefMarkdown(result.project),
        view: {
          ...state.view,
          selectedGroupId: targetEntry?.parentGroupId ?? state.view.selectedGroupId,
          selectedTrackId: targetTrackId,
          selection: {
            primary: nextRef,
            selected: [nextRef],
          },
        },
        edit: {
          ...state.edit,
          boundaryLinks: result.boundaryLinks,
          colorDraft: null,
          canUndo: nextUndo.length > 0,
          canRedo: false,
        },
        undoStack: nextUndo,
        redoStack: [],
        persistence: {
          ...state.persistence,
          dirty: true,
          hasLocalDraft: true,
          statusMessage: `已将 ${ref.eventId} 移动到时间轴 ${targetEntry?.node.name ?? targetTrackId}`,
          errorMessage: null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({
        persistence: {
          ...state.persistence,
          errorMessage: msg,
          statusMessage: msg,
        },
      });
    }
  },

  startColorDraft: (target) => {
    const state = get();
    if (target.kind === "track") {
      const track = findTrackById(state.project.nodes, target.trackId);
      if (!track) return;
      set({
        edit: {
          ...state.edit,
          colorDraft: {
            target,
            initialColor: track.color,
            draftColor: track.color ?? resolveEventColor(null, track),
          },
        },
      });
      return;
    }
    const found = findEventByRef(state.project, target.ref);
    if (!found) return;
    set({
      edit: {
        ...state.edit,
        colorDraft: {
          target,
          initialColor: found.event.color,
          draftColor: found.event.color ?? resolveEventColor(found.event, found.track),
        },
      },
    });
  },

  updateColorDraft: (draftColor) => {
    const state = get();
    if (!state.edit.colorDraft) return;
    set({
      edit: {
        ...state.edit,
        colorDraft: {
          ...state.edit.colorDraft,
          draftColor,
        },
      },
    });
  },

  commitColorDraft: () => {
    const state = get();
    const draft = state.edit.colorDraft;
    if (!draft) return;
    if (draft.target.kind === "track") {
      get().runWorkbenchCommand({
        type: "setTrackColor",
        trackId: draft.target.trackId,
        color: draft.draftColor,
      });
    } else {
      get().runWorkbenchCommand({
        type: "update",
        ref: draft.target.ref,
        patch: { color: draft.draftColor ?? null },
      });
    }
  },

  cancelColorDraft: () => {
    set((state) => ({
      edit: {
        ...state.edit,
        colorDraft: null,
      },
    }));
  },

  resetColorToAuto: (target) => {
    if (target.kind === "track") {
      get().runWorkbenchCommand({
        type: "setTrackColor",
        trackId: target.trackId,
        color: undefined,
      });
    } else {
      get().runWorkbenchCommand({
        type: "update",
        ref: target.ref,
        patch: { color: null },
      });
    }
  },

  getEffectiveEventColor: (event, track) => {
    const draft = get().edit.colorDraft;
    if (draft) {
      if (
        draft.target.kind === "event" &&
        draft.target.ref.eventId === event.id &&
        (!track || draft.target.ref.trackId === track.id)
      ) {
        return resolveEventColor({ color: draft.draftColor }, track);
      }
      if (draft.target.kind === "track" && track && draft.target.trackId === track.id) {
        return resolveEventColor(event, { color: draft.draftColor });
      }
    }
    return resolveEventColor(event, track);
  },

  getEffectiveTrackColor: (track) => {
    if (!track) return resolveEventColor(null, null);
    const draft = get().edit.colorDraft;
    if (draft && draft.target.kind === "track" && draft.target.trackId === track.id) {
      return resolveEventColor(null, { color: draft.draftColor });
    }
    return resolveEventColor(null, track);
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;
    const prev = state.undoStack[state.undoStack.length - 1]!;
    const currentSnapshot: UndoSnapshot = {
      project: cloneProject(state.project),
      boundaryLinks: [...state.edit.boundaryLinks],
      selection: {
        primary: state.view.selection.primary ? { ...state.view.selection.primary } : null,
        selected: state.view.selection.selected.map((r) => ({ ...r })),
      },
      selectedTrackId: state.view.selectedTrackId,
      selectedGroupId: state.view.selectedGroupId,
    };
    const nextUndo = state.undoStack.slice(0, -1);
    const nextRedo = [...state.redoStack, currentSnapshot];

    persistDraftQuietly(prev.project);
    set({
      project: prev.project,
      agentBriefMarkdown: generateAgentBriefMarkdown(prev.project),
      view: {
        ...state.view,
        selectedTrackId: prev.selectedTrackId,
        selectedGroupId: prev.selectedGroupId,
        selection: prev.selection,
      },
      edit: {
        ...state.edit,
        boundaryLinks: prev.boundaryLinks,
        colorDraft: null,
        canUndo: nextUndo.length > 0,
        canRedo: nextRedo.length > 0,
      },
      undoStack: nextUndo,
      redoStack: nextRedo,
      persistence: {
        ...state.persistence,
        dirty: true,
        statusMessage: "已撤销上一步操作",
        errorMessage: null,
      },
    });
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;
    const next = state.redoStack[state.redoStack.length - 1]!;
    const currentSnapshot: UndoSnapshot = {
      project: cloneProject(state.project),
      boundaryLinks: [...state.edit.boundaryLinks],
      selection: {
        primary: state.view.selection.primary ? { ...state.view.selection.primary } : null,
        selected: state.view.selection.selected.map((r) => ({ ...r })),
      },
      selectedTrackId: state.view.selectedTrackId,
      selectedGroupId: state.view.selectedGroupId,
    };
    const nextRedo = state.redoStack.slice(0, -1);
    const nextUndo = [...state.undoStack, currentSnapshot];

    persistDraftQuietly(next.project);
    set({
      project: next.project,
      agentBriefMarkdown: generateAgentBriefMarkdown(next.project),
      view: {
        ...state.view,
        selectedTrackId: next.selectedTrackId,
        selectedGroupId: next.selectedGroupId,
        selection: next.selection,
      },
      edit: {
        ...state.edit,
        boundaryLinks: next.boundaryLinks,
        colorDraft: null,
        canUndo: nextUndo.length > 0,
        canRedo: nextRedo.length > 0,
      },
      undoStack: nextUndo,
      redoStack: nextRedo,
      persistence: {
        ...state.persistence,
        dirty: true,
        statusMessage: "已重做操作",
        errorMessage: null,
      },
    });
  },

  setVisibleWindow: (startSec, endSec) => {
    const state = get();
    const duration =
      state.analysis?.summary?.audio_file?.duration_sec ?? DEFAULT_DURATION_SEC;
    const minWindow = 2.0;
    const maxWindow = Math.max(minWindow, duration);
    const span = Math.max(minWindow, Math.min(maxWindow, endSec - startSec));
    const clampedStart = Math.max(0, Math.min(duration - span, startSec));
    const clampedEnd = Math.min(duration, clampedStart + span);

    set({
      view: {
        ...state.view,
        visibleStartSec: Number(clampedStart.toFixed(3)),
        visibleEndSec: Number(clampedEnd.toFixed(3)),
        zoomPxPerSec: Number((1000 / span).toFixed(2)),
      },
    });
  },

  zoomByFactor: (factor, anchorSec) => {
    const state = get();
    const { visibleStartSec, visibleEndSec } = state.view;
    const currentSpan = Math.max(2, visibleEndSec - visibleStartSec);
    const nextSpan = currentSpan * factor;
    const pivot =
      anchorSec !== undefined
        ? anchorSec
        : (visibleStartSec + visibleEndSec) / 2;
    const ratio = (pivot - visibleStartSec) / currentSpan;
    const nextStart = pivot - ratio * nextSpan;
    get().setVisibleWindow(nextStart, nextStart + nextSpan);
  },

  setCurrentTimeSec: (sec) => {
    const state = get();
    const duration =
      state.analysis?.summary?.audio_file?.duration_sec ?? DEFAULT_DURATION_SEC;
    const clamped = Math.max(0, Math.min(duration, sec));
    set({
      transport: {
        ...state.transport,
        currentTimeSec: Number(clamped.toFixed(3)),
      },
    });
  },

  setIsPlaying: (playing) => {
    set((state) => ({
      transport: {
        ...state.transport,
        isPlaying: playing,
      },
    }));
  },

  setLoopEnabled: (enabled) => {
    set((state) => ({
      transport: {
        ...state.transport,
        loopEnabled: enabled,
        loopEventRef: enabled ? state.view.selection.primary : state.transport.loopEventRef,
      },
    }));
  },

  setLoopRange: (range) => {
    set((state) => ({
      transport: {
        ...state.transport,
        loopRange: range,
        loopEventRef: null,
      },
    }));
  },

  setLoopEvent: (ref) => set((state) => ({
    transport: { ...state.transport, loopEventRef: ref },
  })),

  openContextMenu: (menu) => {
    set({
      contextMenu: {
        ...menu,
        open: true,
      },
    });
  },

  closeContextMenu: () => {
    set((state) => ({
      contextMenu: {
        ...state.contextMenu,
        open: false,
      },
    }));
  },

  setLayout: (patch) => {
    set((state) => ({
      layout: {
        ...state.layout,
        ...patch,
      },
    }));
  },

  setPersistence: (patch) => {
    set((state) => ({
      persistence: {
        ...state.persistence,
        ...patch,
      },
    }));
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setEventFilterQuery: (q) => set({ eventFilterQuery: q }),
  setEventCommentFilter: (filter) => set({ eventCommentFilter: filter }),
}), (state) => {
  const primary = state.view.selection.primary;
  const active = findEventByRef(state.project, primary)?.event;
  const baseline = state.eventEditBaseline;
  if (!primary || !active) {
    state = { ...state, eventEditBaseline: null, eventDraftDirty: false };
  } else if (!baseline || baseline.ref.eventId !== primary.eventId) {
    // Event IDs are globally unique. Moving the same event between tracks is an edit.
    state = { ...state, eventEditBaseline: { ref: { ...primary }, snapshot: eventSnapshot(active, primary.trackId) }, eventDraftDirty: false };
  }
  const pending = state.pendingEventSwitch;
  if (pending && !findEventByRef(state.project, pending.ref)) state = { ...state, pendingEventSwitch: null };
  const ref = state.transport.loopEventRef;
  if (!ref) return state;
  const event = findEventByRef(state.project, ref)?.event;
  if (!event || event.endSec === undefined) return {
    ...state, transport: { ...state.transport, loopEventRef: null, loopRange: null, loopEnabled: false },
  };
  const range = state.transport.loopRange;
  if (range?.[0] === event.startSec && range[1] === event.endSec) return state;
  return { ...state, transport: { ...state.transport, loopRange: [event.startSec, event.endSec] } };
});
