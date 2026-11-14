export function roundSeconds(sec: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(sec * factor) / factor;
}
import type {
  BoundaryLink,
  Comment,
  EventRef,
  ExplorerCommand,
  TimelineEvent,
  TimelineGroup,
  TimelineNode,
  TimelineProject,
  TimelineTrack,
  TimelineViewState,
  WorkbenchCommand,
  WorkbenchEditState,
} from "./src/types.ts";

export type {
  BoundaryLink,
  Comment,
  EventRef,
  ExplorerCommand,
  TimelineEvent,
  TimelineGroup,
  TimelineNode,
  TimelineProject,
  TimelineTrack,
  TimelineViewState,
  WorkbenchCommand,
  WorkbenchEditState,
};

export const DEFAULT_EVENT_COLOR = "#166b75";
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const MIN_EVENT_DURATION_SEC = 0.01;
export const DEFAULT_RANGE_DURATION_SEC = 2.0;

export function isValidHexColor(color: unknown): color is string {
  return typeof color === "string" && HEX_COLOR_RE.test(color.trim());
}

export function normalizeHexColor(color: unknown): string | undefined {
  if (typeof color !== "string") return undefined;
  const trimmed = color.trim();
  if (!HEX_COLOR_RE.test(trimmed)) return undefined;
  return trimmed.toLowerCase();
}

export function resolveEventColor(
  event?: Pick<TimelineEvent, "color"> | null,
  track?: Pick<TimelineTrack, "color"> | null
): string {
  if (event?.color && isValidHexColor(event.color)) {
    return event.color.toLowerCase();
  }
  if (track?.color && isValidHexColor(track.color)) {
    return track.color.toLowerCase();
  }
  return DEFAULT_EVENT_COLOR;
}

export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00.000";
  }
  const rounded = roundSeconds(seconds, 3);
  const mins = Math.floor(rounded / 60);
  const rem = rounded - mins * 60;
  const wholeSecs = Math.floor(rem);
  const millis = Math.round((rem - wholeSecs) * 1000);
  return `${String(mins).padStart(2, "0")}:${String(wholeSecs).padStart(2, "0")}.${String(
    millis
  ).padStart(3, "0")}`;
}

export function parseTimeInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isFinite(num) && num >= 0 ? roundSeconds(num, 3) : null;
  }
  const mmss = trimmed.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
  if (mmss) {
    const mins = Number(mmss[1]);
    const secs = Number(mmss[2]);
    if (Number.isFinite(mins) && Number.isFinite(secs) && secs < 60) {
      return roundSeconds(mins * 60 + secs, 3);
    }
  }
  return null;
}

export function isRangeEvent(event: TimelineEvent): boolean {
  return typeof event.endSec === "number" && Number.isFinite(event.endSec) && event.endSec > event.startSec;
}

export function normalizeComments(raw: unknown): Comment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Comment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const role = obj.role === "agent" ? "agent" : obj.role === "human" ? "human" : null;
    const text = typeof obj.text === "string" ? obj.text.trim() : "";
    if (!role || !text) continue;
    out.push({ role, text });
  }
  return out.length > 0 ? out : undefined;
}

export function getCommentSummary(comments?: Comment[]): {
  count: number;
  lastRole: "human" | "agent" | null;
  lastRoleLabel: "人类" | "Agent" | "—";
  lastText: string;
} {
  if (!comments || comments.length === 0) {
    return { count: 0, lastRole: null, lastRoleLabel: "—", lastText: "" };
  }
  const last = comments[comments.length - 1]!;
  return {
    count: comments.length,
    lastRole: last.role,
    lastRoleLabel: last.role === "agent" ? "Agent" : "人类",
    lastText: last.text,
  };
}

export interface FlattenedTrackEntry {
  track: TimelineTrack;
  parentGroupId: string | null;
  ancestorGroupIds: string[];
  pathNames: string[];
  depth: number;
}

export interface FlattenedNodeEntry {
  node: TimelineNode;
  parentGroupId: string | null;
  ancestorGroupIds: string[];
  pathNames: string[];
  depth: number;
}

export function flattenNodes(
  nodes: TimelineNode[],
  parentGroupId: string | null = null,
  ancestorGroupIds: string[] = [],
  pathNames: string[] = [],
  depth = 0
): FlattenedNodeEntry[] {
  const result: FlattenedNodeEntry[] = [];
  for (const node of nodes) {
    const currentPath = [...pathNames, node.name];
    result.push({
      node,
      parentGroupId,
      ancestorGroupIds,
      pathNames: currentPath,
      depth,
    });
    if (node.kind === "group") {
      result.push(
        ...flattenNodes(
          node.children,
          node.id,
          [...ancestorGroupIds, node.id],
          currentPath,
          depth + 1
        )
      );
    }
  }
  return result;
}

export function flattenTracks(nodes: TimelineNode[]): FlattenedTrackEntry[] {
  return flattenNodes(nodes)
    .filter((entry): entry is FlattenedNodeEntry & { node: TimelineTrack } => entry.node.kind === "timeline")
    .map((entry) => ({
      track: entry.node,
      parentGroupId: entry.parentGroupId,
      ancestorGroupIds: entry.ancestorGroupIds,
      pathNames: entry.pathNames,
      depth: entry.depth,
    }));
}

export function flattenGroups(nodes: TimelineNode[]): Array<FlattenedNodeEntry & { node: TimelineGroup }> {
  return flattenNodes(nodes).filter(
    (entry): entry is FlattenedNodeEntry & { node: TimelineGroup } => entry.node.kind === "group"
  );
}

export function findNodeEntryById(nodes: TimelineNode[], nodeId: string): FlattenedNodeEntry | null {
  return flattenNodes(nodes).find((entry) => entry.node.id === nodeId) ?? null;
}

export function findNodeById(nodes: TimelineNode[], nodeId: string): TimelineNode | null {
  return findNodeEntryById(nodes, nodeId)?.node ?? null;
}

export function findTrackById(nodes: TimelineNode[], trackId: string): TimelineTrack | null {
  const node = findNodeById(nodes, trackId);
  return node && node.kind === "timeline" ? node : null;
}

export function findGroupById(nodes: TimelineNode[], groupId: string): TimelineGroup | null {
  const node = findNodeById(nodes, groupId);
  return node && node.kind === "group" ? node : null;
}

export function findEventByRef(
  project: TimelineProject,
  ref: EventRef | null | undefined
): { track: TimelineTrack; event: TimelineEvent; index: number } | null {
  if (!ref) return null;
  const track = findTrackById(project.nodes, ref.trackId);
  if (!track) return null;
  const index = track.items.findIndex((item) => item.id === ref.eventId);
  if (index === -1) return null;
  return { track, event: track.items[index]!, index };
}

export function findEventByIdGlobal(
  project: TimelineProject,
  eventId: string
): { track: TimelineTrack; event: TimelineEvent; index: number } | null {
  for (const { track } of flattenTracks(project.nodes)) {
    const index = track.items.findIndex((item) => item.id === eventId);
    if (index !== -1) {
      return { track, event: track.items[index]!, index };
    }
  }
  return null;
}

export function isNodeEffectivelyLocked(
  nodes: TimelineNode[],
  nodeId: string,
  lockedNodeIds: ReadonlySet<string> | string[]
): boolean {
  const lockSet = lockedNodeIds instanceof Set ? lockedNodeIds : new Set(lockedNodeIds);
  if (lockSet.has(nodeId)) return true;
  const entry = findNodeEntryById(nodes, nodeId);
  if (!entry) return false;
  return entry.ancestorGroupIds.some((ancestorId) => lockSet.has(ancestorId));
}

export function isNodeEffectivelyVisible(
  nodes: TimelineNode[],
  nodeId: string,
  hiddenNodeIds: ReadonlySet<string> | string[]
): boolean {
  const hiddenSet = hiddenNodeIds instanceof Set ? hiddenNodeIds : new Set(hiddenNodeIds);
  if (hiddenSet.has(nodeId)) return false;
  const entry = findNodeEntryById(nodes, nodeId);
  if (!entry) return true;
  return !entry.ancestorGroupIds.some((ancestorId) => hiddenSet.has(ancestorId));
}

export function hasLockedDescendant(
  group: TimelineGroup,
  lockedNodeIds: ReadonlySet<string> | string[]
): boolean {
  const lockSet = lockedNodeIds instanceof Set ? lockedNodeIds : new Set(lockedNodeIds);
  for (const child of group.children) {
    if (lockSet.has(child.id)) return true;
    if (child.kind === "group" && hasLockedDescendant(child, lockSet)) {
      return true;
    }
  }
  return false;
}

export function countGroupSubtreeImpact(group: TimelineGroup): {
  groupCount: number;
  trackCount: number;
  eventCount: number;
} {
  let groupCount = 0;
  let trackCount = 0;
  let eventCount = 0;
  const walk = (nodes: TimelineNode[]) => {
    for (const child of nodes) {
      if (child.kind === "group") {
        groupCount += 1;
        walk(child.children);
      } else {
        trackCount += 1;
        eventCount += child.items.length;
      }
    }
  };
  walk(group.children);
  return { groupCount, trackCount, eventCount };
}

export function collectAllNodeIds(nodes: TimelineNode[]): Set<string> {
  const ids = new Set<string>();
  for (const entry of flattenNodes(nodes)) {
    ids.add(entry.node.id);
  }
  return ids;
}

export function collectAllEventIds(nodes: TimelineNode[]): Set<string> {
  const ids = new Set<string>();
  for (const { track } of flattenTracks(nodes)) {
    for (const item of track.items) {
      ids.add(item.id);
    }
  }
  return ids;
}

export function allocateStableId(
  prefix: string,
  existingIds: Iterable<string>,
  padLength = 3
): string {
  const used = new Set(existingIds);
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}(\\d+)$`, "i");
  let maxNum = 0;
  for (const id of used) {
    const match = id.match(re);
    if (match) {
      const n = Number.parseInt(match[1]!, 10);
      if (Number.isFinite(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }
  let candidateNum = maxNum + 1;
  while (true) {
    const candidate = `${prefix}${String(candidateNum).padStart(padLength, "0")}`;
    if (!used.has(candidate)) {
      return candidate;
    }
    candidateNum += 1;
  }
}

export function inferEventIdPrefix(track: TimelineTrack): { prefix: string; padLength: number } {
  for (const item of track.items) {
    const match = item.id.match(/^([A-Za-z_]+)(\d+)$/);
    if (match) {
      return {
        prefix: match[1]!,
        padLength: Math.max(2, match[2]!.length),
      };
    }
  }
  const lowerId = track.id.toLowerCase();
  if (lowerId.includes("lyric")) return { prefix: "L", padLength: 3 };
  if (lowerId.includes("phrase") || lowerId.includes("part") || lowerId.includes("section")) {
    return { prefix: "P", padLength: 3 };
  }
  if (lowerId.includes("clip")) return { prefix: "CLIP_", padLength: 2 };
  if (lowerId.includes("downbeat") || lowerId.includes("beat") || lowerId.includes("meter")) {
    return { prefix: "M", padLength: 4 };
  }
  if (lowerId.includes("shot") || lowerId.includes("scene")) return { prefix: "S", padLength: 3 };
  return { prefix: "E", padLength: 3 };
}

export function sortTrackItems(items: TimelineEvent[]): TimelineEvent[] {
  return [...items].sort((a, b) => {
    if (a.startSec !== b.startSec) return a.startSec - b.startSec;
    const aEnd = a.endSec ?? a.startSec;
    const bEnd = b.endSec ?? b.startSec;
    if (aEnd !== bEnd) return aEnd - bEnd;
    return a.id.localeCompare(b.id);
  });
}

export function sanitizeTimelineEvent(
  raw: unknown,
  index: number,
  maxDurationSec?: number
): TimelineEvent {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid TimelineEvent at index ${index}`);
  }
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : "";
  if (!id) {
    throw new Error(`TimelineEvent missing non-empty id at index ${index}`);
  }
  const startRaw = Number(obj.startSec);
  if (!Number.isFinite(startRaw) || startRaw < 0) {
    throw new Error(`TimelineEvent ${id} has invalid startSec: ${String(obj.startSec)}`);
  }
  if (typeof maxDurationSec === "number" && Number.isFinite(maxDurationSec) && startRaw > maxDurationSec + 0.05) {
    throw new Error(`TimelineEvent ${id} startSec (${startRaw}) exceeds duration (${maxDurationSec})`);
  }
  const startSec = roundSeconds(startRaw, 3);

  let endSec: number | undefined;
  if (obj.endSec !== undefined && obj.endSec !== null && obj.endSec !== "") {
    const endRaw = Number(obj.endSec);
    if (!Number.isFinite(endRaw)) {
      throw new Error(`TimelineEvent ${id} has non-finite endSec: ${String(obj.endSec)}`);
    }
    const roundedEnd = roundSeconds(endRaw, 3);
    if (roundedEnd <= startSec) {
      throw new Error(`TimelineEvent ${id} must satisfy endSec (${roundedEnd}) > startSec (${startSec})`);
    }
    if (
      typeof maxDurationSec === "number" &&
      Number.isFinite(maxDurationSec) &&
      roundedEnd > maxDurationSec + 0.5
    ) {
      throw new Error(`TimelineEvent ${id} endSec (${roundedEnd}) exceeds duration (${maxDurationSec})`);
    }
    endSec = roundedEnd;
  }

  const text = typeof obj.text === "string" ? obj.text : "";
  let color: string | undefined;
  if (obj.color !== undefined && obj.color !== null && obj.color !== "") {
    if (!isValidHexColor(obj.color)) {
      throw new Error(`TimelineEvent ${id} has invalid hex color: ${String(obj.color)}`);
    }
    color = obj.color.trim().toLowerCase();
  }

  const comments = normalizeComments(obj.comments);

  const event: TimelineEvent = {
    id,
    startSec,
    ...(endSec !== undefined ? { endSec } : {}),
    text,
    ...(color ? { color } : {}),
    ...(comments ? { comments } : {}),
  };
  return event;
}

export function validateAndNormalizeProject(
  raw: unknown,
  maxDurationSec?: number
): TimelineProject {
  if (!raw || typeof raw !== "object") {
    throw new Error("TimelineProject must be an object");
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) {
    throw new Error(`Unsupported TimelineProject version: ${String(obj.version)} (expected 1)`);
  }
  const name = typeof obj.name === "string" && obj.name.trim() ? obj.name.trim() : "Try Me — Kero Kero Bonito";
  const audio = typeof obj.audio === "string" && obj.audio.trim() ? obj.audio.trim() : undefined;
  if (!Array.isArray(obj.nodes)) {
    throw new Error("TimelineProject.nodes must be an array");
  }

  const seenNodeIds = new Set<string>();
  const seenEventIds = new Set<string>();

  const normalizeNode = (nodeRaw: unknown, pathLabel: string): TimelineNode => {
    if (!nodeRaw || typeof nodeRaw !== "object") {
      throw new Error(`Invalid TimelineNode at ${pathLabel}`);
    }
    const n = nodeRaw as Record<string, unknown>;
    const id = typeof n.id === "string" && n.id.trim() ? n.id.trim() : "";
    if (!id) {
      throw new Error(`TimelineNode at ${pathLabel} is missing id`);
    }
    if (seenNodeIds.has(id)) {
      throw new Error(`Duplicate TimelineNode id: ${id}`);
    }
    seenNodeIds.add(id);

    const nodeName = typeof n.name === "string" && n.name.trim() ? n.name.trim() : id;
    const comments = normalizeComments(n.comments);

    if (n.kind === "group") {
      if (!Array.isArray(n.children)) {
        throw new Error(`TimelineGroup ${id} children must be an array`);
      }
      const children = n.children.map((child, idx) =>
        normalizeNode(child, `${pathLabel}/${id}[${idx}]`)
      );
      const group: TimelineGroup = {
        kind: "group",
        id,
        name: nodeName,
        children,
        ...(comments ? { comments } : {}),
      };
      return group;
    }

    if (n.kind === "timeline") {
      if (!Array.isArray(n.items)) {
        throw new Error(`TimelineTrack ${id} items must be an array`);
      }
      let color: string | undefined;
      if (n.color !== undefined && n.color !== null && n.color !== "") {
        if (!isValidHexColor(n.color)) {
          throw new Error(`TimelineTrack ${id} has invalid hex color: ${String(n.color)}`);
        }
        color = n.color.trim().toLowerCase();
      }
      const items = sortTrackItems(
        n.items.map((itemRaw, idx) => {
          const ev = sanitizeTimelineEvent(itemRaw, idx, maxDurationSec);
          if (seenEventIds.has(ev.id)) {
            throw new Error(`Duplicate TimelineEvent id: ${ev.id}`);
          }
          seenEventIds.add(ev.id);
          return ev;
        })
      );
      const track: TimelineTrack = {
        kind: "timeline",
        id,
        name: nodeName,
        ...(color ? { color } : {}),
        items,
        ...(comments ? { comments } : {}),
      };
      return track;
    }

    throw new Error(`Invalid TimelineNode kind at ${id}: ${String(n.kind)}`);
  };

  const nodes = obj.nodes.map((n, idx) => normalizeNode(n, `root[${idx}]`));
  const comments = normalizeComments(obj.comments);

  return {
    version: 1,
    name,
    ...(audio ? { audio } : {}),
    nodes,
    ...(comments ? { comments } : {}),
  };
}

export function createEmptyProject(audioPath = "public/private/audio/try-me.flac"): TimelineProject {
  return {
    version: 1,
    name: "Try Me — Kero Kero Bonito",
    audio: audioPath,
    nodes: [
      {
        kind: "group",
        id: "col_lyrics",
        name: "歌词与主唱",
        children: [
          {
            kind: "timeline",
            id: "trk_lyrics",
            name: "歌词轨",
            color: "#166b75",
            items: [],
          },
        ],
      },
      {
        kind: "group",
        id: "col_structure",
        name: "结构分析",
        children: [
          {
            kind: "timeline",
            id: "trk_song_parts",
            name: "段落边界",
            color: "#3f7468",
            items: [],
          },
          {
            kind: "timeline",
            id: "trk_inspect_clips",
            name: "试听片段",
            color: "#8a6632",
            items: [],
          },
        ],
      },
      {
        kind: "group",
        id: "col_rhythm",
        name: "节奏基准",
        children: [
          {
            kind: "timeline",
            id: "trk_downbeats",
            name: "小节强拍 (Downbeats)",
            color: "#9a5d3b",
            items: [],
          },
          {
            kind: "timeline",
            id: "trk_beats",
            name: "普通拍点 (Beats)",
            color: "#6b7c85",
            items: [],
          },
        ],
      },
      {
        kind: "group",
        id: "col_custom",
        name: "自定义多轨",
        children: [
          {
            kind: "timeline",
            id: "sfx_accents",
            name: "音效重音轨",
            color: "#5b6e78",
            items: [],
          },
          {
            kind: "group",
            id: "grp_storyboard",
            name: "分镜草案组",
            children: [
              {
                kind: "timeline",
                id: "visual_shots",
                name: "分镜镜头草案",
                color: "#2b6f77",
                items: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

function collectLegacyItemComments(obj: Record<string, unknown>): Comment[] | undefined {
  const comments: Comment[] = [];
  if (Array.isArray(obj.comments)) {
    const existing = normalizeComments(obj.comments);
    if (existing) comments.push(...existing);
  }
  const pushHuman = (val: unknown, prefix = "") => {
    if (typeof val !== "string") return;
    const trimmed = val.trim();
    if (!trimmed) return;
    const text = prefix ? `${prefix}${trimmed}` : trimmed;
    if (!comments.some((c) => c.role === "human" && c.text === text)) {
      comments.push({ role: "human", text });
    }
  };
  const pushAgent = (val: unknown) => {
    if (typeof val !== "string") return;
    const trimmed = val.trim();
    if (!trimmed) return;
    if (!comments.some((c) => c.role === "agent" && c.text === trimmed)) {
      comments.push({ role: "agent", text: trimmed });
    }
  };

  pushHuman(obj.note);
  pushHuman(obj.script_idea, "脚本构想：");
  pushHuman(obj.agent_comment);
  pushAgent(obj.agent_reply);

  return comments.length > 0 ? comments : undefined;
}

export function migrateLegacyToTimelineProject(
  rawDoc: unknown,
  maxDurationSec?: number
): TimelineProject {
  if (!rawDoc || typeof rawDoc !== "object") {
    return createEmptyProject();
  }
  const doc = rawDoc as Record<string, unknown>;
  if (doc.version === 1 && Array.isArray(doc.nodes)) {
    return validateAndNormalizeProject(doc, maxDurationSec);
  }

  const audioFile =
    doc.audio_asset &&
    typeof doc.audio_asset === "object" &&
    typeof (doc.audio_asset as Record<string, unknown>).path === "string"
      ? String((doc.audio_asset as Record<string, unknown>).path)
      : doc.audio_file &&
          typeof doc.audio_file === "object" &&
          typeof (doc.audio_file as Record<string, unknown>).path === "string"
        ? String((doc.audio_file as Record<string, unknown>).path)
        : "public/private/audio/try-me.flac";

  const projectComments: Comment[] = [];
  if (typeof doc.global_notes === "string" && doc.global_notes.trim()) {
    projectComments.push({ role: "human", text: doc.global_notes.trim() });
  }
  if (Array.isArray(doc.comments)) {
    const normalized = normalizeComments(doc.comments);
    if (normalized) projectComments.push(...normalized);
  }

  const usedEventIds = new Set<string>();
  const ensureUniqueEventId = (candidateId: string, fallbackPrefix: string): string => {
    const clean = candidateId.trim();
    if (clean && !usedEventIds.has(clean)) {
      usedEventIds.add(clean);
      return clean;
    }
    const next = allocateStableId(fallbackPrefix, usedEventIds, 3);
    usedEventIds.add(next);
    return next;
  };

  // Helper to lookup v0.2.0 `tracks` array by id
  const v2Tracks = Array.isArray(doc.tracks)
    ? (doc.tracks as Array<Record<string, unknown>>)
    : [];
  const findV2TrackItems = (trackId: string): unknown[] => {
    const found = v2Tracks.find((t) => t && typeof t === "object" && t.id === trackId);
    return found && Array.isArray(found.items) ? (found.items as unknown[]) : [];
  };

  // Legacy default colors that were stamped onto every item in v0.2.0 — omit them so events use "Auto" track color
  const LEGACY_STAMPED_COLORS = new Set([
    "#a855f7",
    "#38bdf8",
    "#10b981",
    "#f59e0b",
    "#eab308",
    "#ec4899",
    "#14b8a6",
  ]);
  const normalizeOptionalEventColor = (rawColor: unknown): string | undefined => {
    const c = normalizeHexColor(rawColor);
    if (!c || LEGACY_STAMPED_COLORS.has(c)) return undefined;
    return c;
  };

  // 1. Lyrics track
  const lyricItems: TimelineEvent[] = [];
  const lyricsBlock = doc.lyrics && typeof doc.lyrics === "object" ? (doc.lyrics as Record<string, unknown>) : null;
  const rawLyrics =
    findV2TrackItems("lyrics_main").length > 0
      ? findV2TrackItems("lyrics_main")
      : Array.isArray(lyricsBlock?.items)
        ? (lyricsBlock!.items as unknown[])
        : Array.isArray(doc.lyrics_items)
          ? (doc.lyrics_items as unknown[])
          : [];

  for (const raw of rawLyrics) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const startSec = roundSeconds(Math.max(0, Number(item.start_sec ?? item.startSec ?? 0)), 3);
    const rawEnd = Number(item.end_sec ?? item.endSec ?? startSec + 0.5);
    const endSec = roundSeconds(Math.max(startSec + MIN_EVENT_DURATION_SEC, rawEnd), 3);
    const id = ensureUniqueEventId(String(item.id ?? ""), "L");
    const text = typeof item.text === "string" ? item.text : String(item.label ?? "");
    const comments = collectLegacyItemComments(item);
    const color = normalizeOptionalEventColor(item.color);
    lyricItems.push({
      id,
      startSec,
      endSec,
      text,
      ...(color ? { color } : {}),
      ...(comments ? { comments } : {}),
    });
  }

  // 2. Structure tracks (sections + inspect_clips)
  const sectionItems: TimelineEvent[] = [];
  const clipItems: TimelineEvent[] = [];
  const structBlock =
    doc.structure && typeof doc.structure === "object"
      ? (doc.structure as Record<string, unknown>)
      : null;
  const rawSections =
    findV2TrackItems("structure_sections").length > 0
      ? findV2TrackItems("structure_sections")
      : Array.isArray(structBlock?.sections)
        ? (structBlock!.sections as unknown[])
        : Array.isArray(doc.phrases)
          ? (doc.phrases as unknown[])
          : [];
  const rawClips =
    findV2TrackItems("structure_clips").length > 0
      ? findV2TrackItems("structure_clips")
      : Array.isArray(structBlock?.inspect_clips)
        ? (structBlock!.inspect_clips as unknown[])
        : Array.isArray(doc.inspect_clips)
          ? (doc.inspect_clips as unknown[])
          : [];

  for (const raw of rawSections) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const startSec = roundSeconds(Math.max(0, Number(item.start_sec ?? item.startSec ?? 0)), 3);
    const rawEnd = Number(item.end_sec ?? item.endSec ?? startSec + 1);
    const endSec = roundSeconds(Math.max(startSec + MIN_EVENT_DURATION_SEC, rawEnd), 3);
    const id = ensureUniqueEventId(String(item.id ?? ""), "P");
    const text =
      typeof item.label === "string"
        ? item.label
        : typeof item.text === "string"
          ? item.text
          : id;
    const comments = collectLegacyItemComments(item);
    const color = normalizeOptionalEventColor(item.color);
    sectionItems.push({
      id,
      startSec,
      endSec,
      text,
      ...(color ? { color } : {}),
      ...(comments ? { comments } : {}),
    });
  }

  for (const raw of rawClips) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const startSec = roundSeconds(Math.max(0, Number(item.start_sec ?? item.startSec ?? 0)), 3);
    const rawEnd = Number(item.end_sec ?? item.endSec ?? startSec + 1);
    const endSec = roundSeconds(Math.max(startSec + MIN_EVENT_DURATION_SEC, rawEnd), 3);
    const id = ensureUniqueEventId(String(item.id ?? ""), "CLIP_");
    const text =
      typeof item.label === "string"
        ? item.label
        : typeof item.text === "string"
          ? item.text
          : id;
    const comments = collectLegacyItemComments(item);
    const color = normalizeOptionalEventColor(item.color);
    clipItems.push({
      id,
      startSec,
      endSec,
      text,
      ...(color ? { color } : {}),
      ...(comments ? { comments } : {}),
    });
  }

  // 3. Rhythm tracks (downbeats + beats)
  const downbeatItems: TimelineEvent[] = [];
  const beatItems: TimelineEvent[] = [];
  const rhythmBlock =
    doc.rhythm && typeof doc.rhythm === "object"
      ? (doc.rhythm as Record<string, unknown>)
      : null;
  const rawDownbeats =
    findV2TrackItems("rhythm_downbeats").length > 0
      ? findV2TrackItems("rhythm_downbeats")
      : Array.isArray(rhythmBlock?.downbeats)
        ? (rhythmBlock!.downbeats as unknown[])
        : [];
  const rawBeats =
    findV2TrackItems("rhythm_markers").length > 0
      ? findV2TrackItems("rhythm_markers")
      : Array.isArray(rhythmBlock?.beats)
        ? (rhythmBlock!.beats as unknown[])
        : [];
  const rawMarkers = Array.isArray(doc.markers) ? (doc.markers as unknown[]) : [];

  for (const raw of rawDownbeats) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const startSec = roundSeconds(
      Math.max(0, Number(item.time_sec ?? item.start_sec ?? item.startSec ?? 0)),
      3
    );
    const id = ensureUniqueEventId(String(item.id ?? ""), "M");
    const text =
      typeof item.label === "string"
        ? item.label
        : typeof item.text === "string"
          ? item.text
          : id;
    const comments = collectLegacyItemComments(item);
    const color = normalizeOptionalEventColor(item.color);
    downbeatItems.push({
      id,
      startSec,
      text,
      ...(color ? { color } : {}),
      ...(comments ? { comments } : {}),
    });
  }

  for (const raw of rawBeats) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const startSec = roundSeconds(
      Math.max(0, Number(item.time_sec ?? item.start_sec ?? item.startSec ?? 0)),
      3
    );
    const id = ensureUniqueEventId(String(item.id ?? ""), "M");
    const text =
      typeof item.label === "string"
        ? item.label
        : typeof item.text === "string"
          ? item.text
          : id;
    const comments = collectLegacyItemComments(item);
    const color = normalizeOptionalEventColor(item.color);
    beatItems.push({
      id,
      startSec,
      text,
      ...(color ? { color } : {}),
      ...(comments ? { comments } : {}),
    });
  }

  if (downbeatItems.length === 0 && beatItems.length === 0 && rawMarkers.length > 0) {
    for (const raw of rawMarkers) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      const startSec = roundSeconds(Math.max(0, Number(item.time_sec ?? item.startSec ?? 0)), 3);
      const id = ensureUniqueEventId(String(item.id ?? ""), "M");
      const text = typeof item.label === "string" ? item.label : id;
      const comments = collectLegacyItemComments(item);
      if (item.kind === "downbeat") {
        downbeatItems.push({ id, startSec, text, ...(comments ? { comments } : {}) });
      } else {
        beatItems.push({ id, startSec, text, ...(comments ? { comments } : {}) });
      }
    }
  }

  // 4. Custom tracks
  const customTrackNodes: TimelineNode[] = [];
  const v2CustomTracks = v2Tracks.filter(
    (t) =>
      t &&
      typeof t === "object" &&
      t.collection_id === "col_custom"
  );
  const rawCustomTracks =
    v2CustomTracks.length > 0
      ? v2CustomTracks
      : Array.isArray(doc.custom_tracks)
        ? (doc.custom_tracks as unknown[])
        : [];
  const storyboardTracks: TimelineTrack[] = [];

  for (const rawTrack of rawCustomTracks) {
    if (!rawTrack || typeof rawTrack !== "object") continue;
    const trk = rawTrack as Record<string, unknown>;
    const trackId = typeof trk.id === "string" && trk.id.trim() ? trk.id.trim() : "custom_track";
    const trackName = typeof trk.name === "string" && trk.name.trim() ? trk.name.trim() : trackId;
    const trackColor =
      normalizeOptionalEventColor(trk.color) ??
      (trackId.includes("shot") ? "#2b6f77" : "#5b6e78");
    const trackComments: Comment[] = [];
    if (typeof trk.description === "string" && trk.description.trim()) {
      trackComments.push({ role: "human", text: trk.description.trim() });
    }
    const rawItems = Array.isArray(trk.items) ? (trk.items as unknown[]) : [];
    const items: TimelineEvent[] = [];
    for (const rawItem of rawItems) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const it = rawItem as Record<string, unknown>;
      const startSec = roundSeconds(
        Math.max(0, Number(it.start_sec ?? it.time_sec ?? it.startSec ?? 0)),
        3
      );
      let endSec: number | undefined;
      if (it.end_sec !== undefined && it.end_sec !== null) {
        const parsedEnd = roundSeconds(Number(it.end_sec), 3);
        if (Number.isFinite(parsedEnd) && parsedEnd > startSec) {
          endSec = parsedEnd;
        }
      }
      const id = ensureUniqueEventId(String(it.id ?? ""), "C");
      const text =
        typeof it.label === "string"
          ? it.label
          : typeof it.text === "string"
            ? it.text
            : id;
      const comments = collectLegacyItemComments(it);
      const color = normalizeOptionalEventColor(it.color);
      items.push({
        id,
        startSec,
        ...(endSec !== undefined ? { endSec } : {}),
        text,
        ...(color ? { color } : {}),
        ...(comments ? { comments } : {}),
      });
    }
    const builtTrack: TimelineTrack = {
      kind: "timeline",
      id: trackId,
      name: trackName,
      color: trackColor,
      items: sortTrackItems(items),
      ...(trackComments.length > 0 ? { comments: trackComments } : {}),
    };
    if (trackId === "visual_shots" || trackId.includes("shot")) {
      storyboardTracks.push(builtTrack);
    } else {
      customTrackNodes.push(builtTrack);
    }
  }

  if (storyboardTracks.length > 0) {
    customTrackNodes.push({
      kind: "group",
      id: "grp_storyboard",
      name: "分镜草案组",
      children: storyboardTracks,
    });
  }

  const project: TimelineProject = {
    version: 1,
    name: "Try Me — Kero Kero Bonito",
    audio: audioFile,
    ...(projectComments.length > 0 ? { comments: projectComments } : {}),
    nodes: [
      {
        kind: "group",
        id: "col_lyrics",
        name: "歌词与主唱",
        children: [
          {
            kind: "timeline",
            id: "trk_lyrics",
            name: "歌词轨",
            color: "#166b75",
            items: sortTrackItems(lyricItems),
          },
        ],
      },
      {
        kind: "group",
        id: "col_structure",
        name: "结构分析",
        children: [
          {
            kind: "timeline",
            id: "trk_song_parts",
            name: "段落边界",
            color: "#3f7468",
            items: sortTrackItems(sectionItems),
          },
          {
            kind: "timeline",
            id: "trk_inspect_clips",
            name: "试听片段",
            color: "#8a6632",
            items: sortTrackItems(clipItems),
          },
        ],
      },
      {
        kind: "group",
        id: "col_rhythm",
        name: "节奏基准",
        children: [
          {
            kind: "timeline",
            id: "trk_downbeats",
            name: "小节强拍 (Downbeats)",
            color: "#9a5d3b",
            items: sortTrackItems(downbeatItems),
          },
          {
            kind: "timeline",
            id: "trk_beats",
            name: "普通拍点 (Beats)",
            color: "#6b7c85",
            items: sortTrackItems(beatItems),
          },
        ],
      },
      {
        kind: "group",
        id: "col_custom",
        name: "自定义多轨",
        children:
          customTrackNodes.length > 0
            ? customTrackNodes
            : [
                {
                  kind: "timeline",
                  id: "sfx_accents",
                  name: "音效重音轨",
                  color: "#5b6e78",
                  items: [],
                },
                {
                  kind: "group",
                  id: "grp_storyboard",
                  name: "分镜草案组",
                  children: [
                    {
                      kind: "timeline",
                      id: "visual_shots",
                      name: "分镜镜头草案",
                      color: "#2b6f77",
                      items: [],
                    },
                  ],
                },
              ],
      },
    ],
  };

  return validateAndNormalizeProject(project, maxDurationSec);
}

// ============================================================================
// Tree Mutation Helpers & Command Execution
// ============================================================================

function cloneNodes(nodes: TimelineNode[]): TimelineNode[] {
  return nodes.map((node) => {
    if (node.kind === "group") {
      return {
        ...node,
        ...(node.comments ? { comments: node.comments.map((c) => ({ ...c })) } : {}),
        children: cloneNodes(node.children),
      };
    }
    return {
      ...node,
      ...(node.comments ? { comments: node.comments.map((c) => ({ ...c })) } : {}),
      items: node.items.map((ev) => ({
        ...ev,
        ...(ev.comments ? { comments: ev.comments.map((c) => ({ ...c })) } : {}),
      })),
    };
  });
}

export function cloneProject(project: TimelineProject): TimelineProject {
  return {
    ...project,
    ...(project.comments ? { comments: project.comments.map((c) => ({ ...c })) } : {}),
    nodes: cloneNodes(project.nodes),
  };
}

export interface ExplorerCommandResult {
  project: TimelineProject;
  createdNodeId?: string;
  deletedNodeIds?: string[];
  deletedEventIds?: string[];
}

export function executeExplorerCommand(
  project: TimelineProject,
  command: ExplorerCommand,
  lockedNodeIds: ReadonlySet<string> | string[] = []
): ExplorerCommandResult {
  const lockSet = lockedNodeIds instanceof Set ? lockedNodeIds : new Set(lockedNodeIds);
  const nextProject = cloneProject(project);

  if (command.type === "createNode") {
    if (command.parentGroupId) {
      if (isNodeEffectivelyLocked(nextProject.nodes, command.parentGroupId, lockSet)) {
        throw new Error(`分组 ${command.parentGroupId} 已被锁定，无法新建子节点`);
      }
      const parent = findGroupById(nextProject.nodes, command.parentGroupId);
      if (!parent) {
        throw new Error(`未找到父分组 ${command.parentGroupId}`);
      }
    }
    const existingIds = collectAllNodeIds(nextProject.nodes);
    const prefix = command.nodeKind === "group" ? "grp_" : "trk_";
    const id =
      command.id && !existingIds.has(command.id)
        ? command.id
        : allocateStableId(prefix, existingIds, 2);
    const name = command.name.trim() || (command.nodeKind === "group" ? "新建分组" : "新建时间轴");
    const newNode: TimelineNode =
      command.nodeKind === "group"
        ? {
            kind: "group",
            id,
            name,
            children: [],
          }
        : {
            kind: "timeline",
            id,
            name,
            color: normalizeHexColor(command.color) ?? DEFAULT_EVENT_COLOR,
            items: [],
          };

    if (!command.parentGroupId) {
      nextProject.nodes.push(newNode);
    } else {
      const parent = findGroupById(nextProject.nodes, command.parentGroupId)!;
      parent.children.push(newNode);
    }
    return { project: nextProject, createdNodeId: id };
  }

  if (command.type === "renameNode") {
    if (isNodeEffectivelyLocked(nextProject.nodes, command.nodeId, lockSet)) {
      throw new Error(`节点 ${command.nodeId} 处于锁定状态，无法重命名`);
    }
    const node = findNodeById(nextProject.nodes, command.nodeId);
    if (!node) {
      throw new Error(`未找到节点 ${command.nodeId}`);
    }
    const trimmed = command.name.trim();
    if (!trimmed) {
      throw new Error("节点名称不能为空");
    }
    node.name = trimmed;
    return { project: nextProject };
  }

  if (command.type === "deleteNode") {
    const entry = findNodeEntryById(nextProject.nodes, command.nodeId);
    if (!entry) {
      throw new Error(`未找到节点 ${command.nodeId}`);
    }
    if (isNodeEffectivelyLocked(nextProject.nodes, command.nodeId, lockSet)) {
      throw new Error(`节点 ${entry.node.name} 或其祖先分组处于锁定状态，无法删除`);
    }
    if (entry.node.kind === "group" && hasLockedDescendant(entry.node, lockSet)) {
      throw new Error(`分组 ${entry.node.name} 内包含已锁定的子项，无法删除该子树`);
    }

    const deletedNodeIds: string[] = [];
    const deletedEventIds: string[] = [];
    for (const sub of flattenNodes([entry.node])) {
      deletedNodeIds.push(sub.node.id);
      if (sub.node.kind === "timeline") {
        for (const ev of sub.node.items) {
          deletedEventIds.push(ev.id);
        }
      }
    }

    const removeFromList = (list: TimelineNode[]): TimelineNode[] =>
      list
        .filter((item) => item.id !== command.nodeId)
        .map((item) =>
          item.kind === "group" ? { ...item, children: removeFromList(item.children) } : item
        );

    nextProject.nodes = removeFromList(nextProject.nodes);
    return {
      project: nextProject,
      deletedNodeIds,
      deletedEventIds,
    };
  }

  return { project: nextProject };
}

export interface WorkbenchCommandResult {
  project: TimelineProject;
  boundaryLinks: BoundaryLink[];
  primaryRef?: EventRef | null;
  createdEventRef?: EventRef;
  splitRightEventRef?: EventRef;
}

export function findBoundaryLinksForEvent(
  links: BoundaryLink[],
  ref: EventRef
): {
  prevLink: BoundaryLink | null;
  nextLink: BoundaryLink | null;
} {
  const prevLink =
    links.find(
      (l) => l.trackId === ref.trackId && l.rightEventId === ref.eventId
    ) ?? null;
  const nextLink =
    links.find(
      (l) => l.trackId === ref.trackId && l.leftEventId === ref.eventId
    ) ?? null;
  return { prevLink, nextLink };
}

export function getAdjacentRangeEvents(
  track: TimelineTrack,
  eventId: string
): {
  prevEvent: TimelineEvent | null;
  nextEvent: TimelineEvent | null;
} {
  const sorted = sortTrackItems(track.items);
  const idx = sorted.findIndex((item) => item.id === eventId);
  if (idx === -1) return { prevEvent: null, nextEvent: null };
  const prev = idx > 0 ? sorted[idx - 1]! : null;
  const next = idx < sorted.length - 1 ? sorted[idx + 1]! : null;
  return {
    prevEvent: prev && isRangeEvent(prev) ? prev : null,
    nextEvent: next && isRangeEvent(next) ? next : null,
  };
}

export function executeWorkbenchCommand(
  project: TimelineProject,
  command: WorkbenchCommand,
  options: {
    lockedNodeIds?: ReadonlySet<string> | string[];
    boundaryLinks?: BoundaryLink[];
    maxDurationSec?: number;
  } = {}
): WorkbenchCommandResult {
  const lockSet =
    options.lockedNodeIds instanceof Set
      ? options.lockedNodeIds
      : new Set(options.lockedNodeIds ?? []);
  let nextLinks = [...(options.boundaryLinks ?? [])];
  const nextProject = cloneProject(project);

  const assertTrackEditable = (trackId: string): TimelineTrack => {
    if (isNodeEffectivelyLocked(nextProject.nodes, trackId, lockSet)) {
      throw new Error(`时间轴 ${trackId}（或其所属分组）已锁定，无法编辑`);
    }
    const track = findTrackById(nextProject.nodes, trackId);
    if (!track) {
      throw new Error(`未找到时间轴 ${trackId}`);
    }
    return track;
  };

  if (command.type === "setTrackColor") {
    const track = assertTrackEditable(command.trackId);
    if (command.color === undefined || command.color === "") {
      delete track.color;
    } else {
      if (!isValidHexColor(command.color)) {
        throw new Error(`颜色格式无效：${command.color}`);
      }
      track.color = command.color.trim().toLowerCase();
    }
    return { project: nextProject, boundaryLinks: nextLinks };
  }

  if (command.type === "createEvent") {
    const track = assertTrackEditable(command.trackId);
    const startSec = roundSeconds(Math.max(0, command.startSec), 3);
    let endSec: number | undefined;
    if (command.endSec !== undefined) {
      const roundedEnd = roundSeconds(command.endSec, 3);
      if (roundedEnd <= startSec) {
        throw new Error(`区间终点 (${roundedEnd}) 必须大于起点 (${startSec})`);
      }
      endSec = roundedEnd;
    }
    const existingIds = collectAllEventIds(nextProject.nodes);
    const { prefix, padLength } = inferEventIdPrefix(track);
    const id =
      command.id && !existingIds.has(command.id)
        ? command.id
        : allocateStableId(prefix, existingIds, padLength);
    const color = command.color ? normalizeHexColor(command.color) : undefined;
    const newEvent: TimelineEvent = {
      id,
      startSec,
      ...(endSec !== undefined ? { endSec } : {}),
      text: command.text ?? (endSec !== undefined ? "新建区间" : "新建标记"),
      ...(color ? { color } : {}),
    };
    track.items = sortTrackItems([...track.items, newEvent]);
    const ref: EventRef = { trackId: track.id, eventId: id };
    return {
      project: nextProject,
      boundaryLinks: nextLinks,
      primaryRef: ref,
      createdEventRef: ref,
    };
  }

  if (command.type === "update") {
    const track = assertTrackEditable(command.ref.trackId);
    const found = findEventByRef(nextProject, command.ref);
    if (!found) {
      throw new Error(`未找到事件 ${command.ref.eventId}`);
    }
    const ev = found.event;
    const nextStart =
      command.patch.startSec !== undefined
        ? roundSeconds(Math.max(0, command.patch.startSec), 3)
        : ev.startSec;

    let nextEnd: number | undefined = ev.endSec;
    if ("endSec" in command.patch) {
      if (command.patch.endSec === null || command.patch.endSec === undefined) {
        nextEnd = undefined;
      } else {
        nextEnd = roundSeconds(command.patch.endSec, 3);
      }
    }
    if (nextEnd !== undefined && nextEnd <= nextStart) {
      throw new Error(`事件 ${ev.id} 的终点 (${nextEnd}) 必须大于起点 (${nextStart})`);
    }

    ev.startSec = nextStart;
    if (nextEnd === undefined) {
      delete ev.endSec;
    } else {
      ev.endSec = nextEnd;
    }

    if (command.patch.text !== undefined) {
      ev.text = command.patch.text;
    }

    if ("color" in command.patch) {
      if (command.patch.color === null || command.patch.color === undefined || command.patch.color === "") {
        delete ev.color;
      } else {
        if (!isValidHexColor(command.patch.color)) {
          throw new Error(`事件颜色格式无效：${command.patch.color}`);
        }
        ev.color = command.patch.color.trim().toLowerCase();
      }
    }

    if ("comments" in command.patch) {
      const normalized = normalizeComments(command.patch.comments);
      if (normalized) {
        ev.comments = normalized;
      } else {
        delete ev.comments;
      }
    }

    track.items = sortTrackItems(track.items);
    return {
      project: nextProject,
      boundaryLinks: nextLinks,
      primaryRef: command.ref,
    };
  }

  if (command.type === "move") {
    const track = assertTrackEditable(command.ref.trackId);
    const found = findEventByRef(nextProject, command.ref);
    if (!found) {
      throw new Error(`未找到事件 ${command.ref.eventId}`);
    }
    const ev = found.event;
    const duration = ev.endSec !== undefined ? roundSeconds(ev.endSec - ev.startSec, 3) : null;
    let nextStart = roundSeconds(Math.max(0, ev.startSec + command.deltaSec), 3);
    if (
      typeof options.maxDurationSec === "number" &&
      Number.isFinite(options.maxDurationSec) &&
      duration !== null &&
      nextStart + duration > options.maxDurationSec
    ) {
      nextStart = roundSeconds(Math.max(0, options.maxDurationSec - duration), 3);
    }
    ev.startSec = nextStart;
    if (duration !== null) {
      ev.endSec = roundSeconds(nextStart + duration, 3);
    }
    // Moving a single event breaks any boundary links attached to it
    nextLinks = nextLinks.filter(
      (l) =>
        !(
          l.trackId === command.ref.trackId &&
          (l.leftEventId === command.ref.eventId || l.rightEventId === command.ref.eventId)
        )
    );
    track.items = sortTrackItems(track.items);
    return {
      project: nextProject,
      boundaryLinks: nextLinks,
      primaryRef: command.ref,
    };
  }

  if (command.type === "setBoundary") {
    const track = assertTrackEditable(command.ref.trackId);
    const found = findEventByRef(nextProject, command.ref);
    if (!found) {
      throw new Error(`未找到事件 ${command.ref.eventId}`);
    }
    const ev = found.event;
    const targetTime = roundSeconds(Math.max(0, command.timeSec), 3);

    if (command.edge === "start") {
      if (ev.endSec !== undefined && targetTime >= ev.endSec - MIN_EVENT_DURATION_SEC) {
        throw new Error("起点不能越过终点");
      }
      const linkedPrev = nextLinks.find(
        (l) => l.trackId === command.ref.trackId && l.rightEventId === ev.id
      );
      if (linkedPrev) {
        const leftEv = track.items.find((item) => item.id === linkedPrev.leftEventId);
        if (leftEv && leftEv.endSec !== undefined) {
          if (targetTime <= leftEv.startSec + MIN_EVENT_DURATION_SEC) {
            throw new Error("联动公共边界不能越过前一条事件的起点");
          }
          leftEv.endSec = targetTime;
        }
      }
      ev.startSec = targetTime;
    } else {
      if (targetTime <= ev.startSec + MIN_EVENT_DURATION_SEC) {
        throw new Error("终点必须大于起点");
      }
      const linkedNext = nextLinks.find(
        (l) => l.trackId === command.ref.trackId && l.leftEventId === ev.id
      );
      if (linkedNext) {
        const rightEv = track.items.find((item) => item.id === linkedNext.rightEventId);
        if (rightEv) {
          if (rightEv.endSec !== undefined && targetTime >= rightEv.endSec - MIN_EVENT_DURATION_SEC) {
            throw new Error("联动公共边界不能越过下一条事件的终点");
          }
          rightEv.startSec = targetTime;
        }
      }
      ev.endSec = targetTime;
    }

    track.items = sortTrackItems(track.items);
    return {
      project: nextProject,
      boundaryLinks: nextLinks,
      primaryRef: command.ref,
    };
  }

  if (command.type === "split") {
    const track = assertTrackEditable(command.ref.trackId);
    const found = findEventByRef(nextProject, command.ref);
    if (!found) {
      throw new Error(`未找到事件 ${command.ref.eventId}`);
    }
    const ev = found.event;
    if (ev.endSec === undefined) {
      throw new Error("点事件不支持切分，仅区间事件可切分");
    }
    const splitAt = roundSeconds(command.atSec, 3);
    if (
      splitAt <= roundSeconds(ev.startSec + MIN_EVENT_DURATION_SEC, 3) ||
      splitAt >= roundSeconds(ev.endSec - MIN_EVENT_DURATION_SEC, 3)
    ) {
      throw new Error(
        `切分时间点 (${formatSeconds(splitAt)}) 必须严格位于区间 (${formatSeconds(
          ev.startSec
        )} – ${formatSeconds(ev.endSec)}) 内部`
      );
    }

    const originalEnd = ev.endSec;
    // Left segment keeps original id and comments
    ev.endSec = splitAt;

    // Right segment gets a new unique ID, inherits text and color, does NOT copy comments
    const existingIds = collectAllEventIds(nextProject.nodes);
    const { prefix, padLength } = inferEventIdPrefix(track);
    const rightId = allocateStableId(prefix, existingIds, padLength);
    const rightEvent: TimelineEvent = {
      id: rightId,
      startSec: splitAt,
      endSec: originalEnd,
      text: ev.text,
      ...(ev.color ? { color: ev.color } : {}),
    };

    // Splitting clears any BoundaryLink involving the split event
    nextLinks = nextLinks.filter(
      (l) =>
        !(
          l.trackId === command.ref.trackId &&
          (l.leftEventId === ev.id || l.rightEventId === ev.id)
        )
    );

    track.items = sortTrackItems([...track.items, rightEvent]);
    const rightRef: EventRef = { trackId: track.id, eventId: rightId };
    return {
      project: nextProject,
      boundaryLinks: nextLinks,
      primaryRef: command.ref,
      splitRightEventRef: rightRef,
    };
  }

  if (command.type === "linkBoundary") {
    const track = assertTrackEditable(command.link.trackId);
    const leftEv = track.items.find((item) => item.id === command.link.leftEventId);
    const rightEv = track.items.find((item) => item.id === command.link.rightEventId);
    if (!leftEv || !rightEv || leftEv.endSec === undefined) {
      throw new Error("联动公共边界需要两条有效的相邻区间事件");
    }
    const shared = roundSeconds((leftEv.endSec + rightEv.startSec) / 2, 3);
    if (
      shared <= leftEv.startSec + MIN_EVENT_DURATION_SEC ||
      (rightEv.endSec !== undefined && shared >= rightEv.endSec - MIN_EVENT_DURATION_SEC)
    ) {
      throw new Error("相邻事件区间过短，无法建立公共边界");
    }
    leftEv.endSec = shared;
    rightEv.startSec = shared;
    const exists = nextLinks.some(
      (l) =>
        l.trackId === command.link.trackId &&
        l.leftEventId === command.link.leftEventId &&
        l.rightEventId === command.link.rightEventId
    );
    if (!exists) {
      nextLinks.push({ ...command.link });
    }
    track.items = sortTrackItems(track.items);
    return {
      project: nextProject,
      boundaryLinks: nextLinks,
    };
  }

  if (command.type === "unlinkBoundary") {
    nextLinks = nextLinks.filter(
      (l) =>
        !(
          l.trackId === command.link.trackId &&
          l.leftEventId === command.link.leftEventId &&
          l.rightEventId === command.link.rightEventId
        )
    );
    return {
      project: nextProject,
      boundaryLinks: nextLinks,
    };
  }

  if (command.type === "joinBoundary") {
    const track = assertTrackEditable(command.link.trackId);
    const leftEv = track.items.find((item) => item.id === command.link.leftEventId);
    const rightEv = track.items.find((item) => item.id === command.link.rightEventId);
    if (!leftEv || !rightEv || leftEv.endSec === undefined) {
      throw new Error("设为紧邻需要两条有效的相邻区间事件");
    }
    const boundary = roundSeconds(command.boundarySec, 3);
    if (
      boundary <= leftEv.startSec + MIN_EVENT_DURATION_SEC ||
      (rightEv.endSec !== undefined && boundary >= rightEv.endSec - MIN_EVENT_DURATION_SEC)
    ) {
      throw new Error("紧邻边界超出相邻事件允许范围");
    }
    leftEv.endSec = boundary;
    rightEv.startSec = boundary;
    const exists = nextLinks.some(
      (l) =>
        l.trackId === command.link.trackId &&
        l.leftEventId === command.link.leftEventId &&
        l.rightEventId === command.link.rightEventId
    );
    if (!exists) {
      nextLinks.push({ ...command.link });
    }
    track.items = sortTrackItems(track.items);
    return {
      project: nextProject,
      boundaryLinks: nextLinks,
    };
  }

  if (command.type === "appendComment") {
    const text = command.comment.text.trim();
    if (!text) {
      throw new Error("评论内容不能为空");
    }
    const role: Comment["role"] = command.comment.role === "agent" ? "agent" : "human";
    const comment: Comment = { role, text };

    if (command.target.scope === "project") {
      nextProject.comments = [...(nextProject.comments ?? []), comment];
      return { project: nextProject, boundaryLinks: nextLinks };
    }
    if (command.target.scope === "node") {
      if (isNodeEffectivelyLocked(nextProject.nodes, command.target.nodeId, lockSet)) {
        throw new Error(`节点 ${command.target.nodeId} 已锁定，无法追加评论`);
      }
      const node = findNodeById(nextProject.nodes, command.target.nodeId);
      if (!node) {
        throw new Error(`未找到节点 ${command.target.nodeId}`);
      }
      node.comments = [...(node.comments ?? []), comment];
      return { project: nextProject, boundaryLinks: nextLinks };
    }
    if (command.target.scope === "event") {
      assertTrackEditable(command.target.ref.trackId);
      const found = findEventByRef(nextProject, command.target.ref);
      if (!found) {
        throw new Error(`未找到事件 ${command.target.ref.eventId}`);
      }
      found.event.comments = [...(found.event.comments ?? []), comment];
      return {
        project: nextProject,
        boundaryLinks: nextLinks,
        primaryRef: command.target.ref,
      };
    }
  }

  if (command.type === "delete") {
    if (command.refs.length === 0) {
      return { project: nextProject, boundaryLinks: nextLinks };
    }
    for (const ref of command.refs) {
      assertTrackEditable(ref.trackId);
    }
    const removeByTrack = new Map<string, Set<string>>();
    for (const ref of command.refs) {
      let set = removeByTrack.get(ref.trackId);
      if (!set) {
        set = new Set();
        removeByTrack.set(ref.trackId, set);
      }
      set.add(ref.eventId);
    }
    for (const [trackId, ids] of removeByTrack.entries()) {
      const track = findTrackById(nextProject.nodes, trackId);
      if (track) {
        track.items = track.items.filter((ev) => !ids.has(ev.id));
      }
      nextLinks = nextLinks.filter(
        (l) => !(l.trackId === trackId && (ids.has(l.leftEventId) || ids.has(l.rightEventId)))
      );
    }
    return {
      project: nextProject,
      boundaryLinks: nextLinks,
      primaryRef: null,
    };
  }

  return { project: nextProject, boundaryLinks: nextLinks };
}

export function moveEventToTrack(
  project: TimelineProject,
  ref: EventRef,
  targetTrackId: string,
  options: {
    lockedNodeIds?: ReadonlySet<string> | string[];
    boundaryLinks?: BoundaryLink[];
  } = {}
): WorkbenchCommandResult {
  if (ref.trackId === targetTrackId) {
    return {
      project,
      boundaryLinks: options.boundaryLinks ?? [],
      primaryRef: ref,
    };
  }
  const lockSet =
    options.lockedNodeIds instanceof Set
      ? options.lockedNodeIds
      : new Set(options.lockedNodeIds ?? []);
  if (isNodeEffectivelyLocked(project.nodes, ref.trackId, lockSet)) {
    throw new Error(`源时间轴 ${ref.trackId} 已锁定`);
  }
  if (isNodeEffectivelyLocked(project.nodes, targetTrackId, lockSet)) {
    throw new Error(`目标时间轴 ${targetTrackId} 已锁定`);
  }
  const nextProject = cloneProject(project);
  const sourceTrack = findTrackById(nextProject.nodes, ref.trackId);
  const targetTrack = findTrackById(nextProject.nodes, targetTrackId);
  if (!sourceTrack || !targetTrack) {
    throw new Error("未找到源时间轴或目标时间轴");
  }
  const idx = sourceTrack.items.findIndex((item) => item.id === ref.eventId);
  if (idx === -1) {
    throw new Error(`未找到事件 ${ref.eventId}`);
  }
  const [movedEvent] = sourceTrack.items.splice(idx, 1);
  // Note: movedEvent.color is preserved if explicitly set; if undefined ("Auto"),
  // resolveEventColor(movedEvent, targetTrack) automatically resolves to targetTrack.color!
  targetTrack.items = sortTrackItems([...targetTrack.items, movedEvent!]);

  const nextLinks = (options.boundaryLinks ?? []).filter(
    (l) =>
      !(
        l.trackId === ref.trackId &&
        (l.leftEventId === ref.eventId || l.rightEventId === ref.eventId)
      )
  );
  const nextRef: EventRef = { trackId: targetTrackId, eventId: ref.eventId };
  return {
    project: nextProject,
    boundaryLinks: nextLinks,
    primaryRef: nextRef,
  };
}

// ============================================================================
// Derived Markdown & Preview Payload Builders
// ============================================================================

export interface CollectedCommentEntry {
  scope: "project" | "group" | "timeline" | "event";
  targetId: string;
  targetLabel: string;
  pathLabel: string;
  timeRangeLabel: string;
  startSec: number;
  endSec?: number;
  eventRef?: EventRef;
  nodeId?: string;
  comments: Comment[];
}

export function collectProjectCommentEntries(project: TimelineProject): CollectedCommentEntry[] {
  const entries: CollectedCommentEntry[] = [];
  if (project.comments && project.comments.length > 0) {
    entries.push({
      scope: "project",
      targetId: "project",
      targetLabel: project.name,
      pathLabel: "工程全局",
      timeRangeLabel: "全局",
      startSec: 0,
      comments: project.comments,
    });
  }

  for (const nodeEntry of flattenNodes(project.nodes)) {
    const { node, pathNames } = nodeEntry;
    const pathLabel = pathNames.join(" / ");
    if (node.comments && node.comments.length > 0) {
      entries.push({
        scope: node.kind === "group" ? "group" : "timeline",
        targetId: node.id,
        targetLabel: `${node.name} (${node.id})`,
        pathLabel,
        timeRangeLabel: node.kind === "group" ? "分组" : "时间轴",
        startSec: 0,
        nodeId: node.id,
        comments: node.comments,
      });
    }
    if (node.kind === "timeline") {
      for (const ev of node.items) {
        if (ev.comments && ev.comments.length > 0) {
          const timeRangeLabel =
            ev.endSec !== undefined
              ? `${formatSeconds(ev.startSec)} → ${formatSeconds(ev.endSec)}`
              : formatSeconds(ev.startSec);
          entries.push({
            scope: "event",
            targetId: ev.id,
            targetLabel: `${ev.id} ${ev.text}`,
            pathLabel,
            timeRangeLabel,
            startSec: ev.startSec,
            endSec: ev.endSec,
            eventRef: { trackId: node.id, eventId: ev.id },
            comments: ev.comments,
          });
        }
      }
    }
  }

  return entries;
}

export function generateAgentBriefMarkdown(project: TimelineProject): string {
  const lines: string[] = [
    "# Try Me — 多轨时间轴与 Agent 协作简报 (v5)",
    "",
    `- **项目名称**：${project.name}`,
    `- **版本 (version)**：\`${project.version}\``,
    `- **音源路径**：\`${project.audio ?? "public/private/audio/try-me.flac"}\``,
    "",
  ];

  if (project.comments && project.comments.length > 0) {
    lines.push("## 全局备注与说明", "");
    for (const c of project.comments) {
      const roleTag = c.role === "agent" ? "[Agent]" : "[人类]";
      lines.push(`- **${roleTag}** ${c.text}`);
    }
    lines.push("");
  }

  const allTracks = flattenTracks(project.nodes);
  lines.push("## 轨道与事件概览", "");
  lines.push("| 轨道路径 | 轨道 ID | 默认色 | 事件数 | 含评论事件数 |");
  lines.push("| :--- | :--- | :--- | ---: | ---: |");
  for (const { track, pathNames } of allTracks) {
    const commentedCount = track.items.filter((ev) => ev.comments && ev.comments.length > 0).length;
    lines.push(
      `| ${pathNames.join(" / ")} | \`${track.id}\` | \`${track.color ?? DEFAULT_EVENT_COLOR}\` | ${
        track.items.length
      } | ${commentedCount} |`
    );
  }
  lines.push("");

  // Structure table if trk_song_parts exists
  const partsTrack = findTrackById(project.nodes, "trk_song_parts");
  if (partsTrack && partsTrack.items.length > 0) {
    lines.push("## 段落结构 (trk_song_parts)", "");
    lines.push("| ID | 起点 | 终点 | 段落名称 | 备注 / 协作摘要 |");
    lines.push("| :--- | :--- | :--- | :--- | :--- |");
    for (const ev of partsTrack.items) {
      const commentSummary = ev.comments
        ? ev.comments.map((c) => `${c.role === "agent" ? "[Agent]" : "[人类]"} ${c.text}`).join(" / ")
        : "—";
      lines.push(
        `| \`${ev.id}\` | \`${ev.startSec.toFixed(3)}s\` | \`${(ev.endSec ?? ev.startSec).toFixed(
          3
        )}s\` | ${ev.text} | ${commentSummary} |`
      );
    }
    lines.push("");
  }

  const commentEntries = collectProjectCommentEntries(project).filter((e) => e.scope !== "project");
  lines.push("## 评论与协作线程汇总", "");
  if (commentEntries.length === 0) {
    lines.push("_当前暂无节点或事件评论。_", "");
  } else {
    for (const entry of commentEntries) {
      lines.push(`### \`${entry.targetId}\` — ${entry.targetLabel} (${entry.timeRangeLabel})`);
      lines.push(`- **所属路径**：${entry.pathLabel}`);
      for (const c of entry.comments) {
        const badge = c.role === "agent" ? "Agent" : "人类";
        lines.push(`- **[${badge}]** ${c.text}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function buildSanitizedPreviewPayload(projectInput: unknown): {
  schema_version: string;
  updated_at: string;
  preview_mapping: {
    fps: number;
    audio_offset_sec: number;
  };
  markers: Array<{
    id: string;
    time_sec: number;
    kind: string;
    label: string;
    confirmed: boolean;
  }>;
  phrases: Array<{
    id: string;
    start_sec: number;
    end_sec: number;
    label: string;
    confirmed: boolean;
  }>;
  inspect_clips: Array<{
    id: string;
    start_sec: number;
    end_sec: number;
    label: string;
    confirmed: boolean;
  }>;
} {
  const project = migrateLegacyToTimelineProject(projectInput);
  const downbeats = findTrackById(project.nodes, "trk_downbeats")?.items ?? [];
  const beats = findTrackById(project.nodes, "trk_beats")?.items ?? [];
  const sections = findTrackById(project.nodes, "trk_song_parts")?.items ?? [];
  const clips = findTrackById(project.nodes, "trk_inspect_clips")?.items ?? [];

  const markers = [
    ...downbeats.map((ev) => ({
      id: ev.id,
      time_sec: ev.startSec,
      kind: "downbeat",
      label: ev.text,
      confirmed: true,
    })),
    ...beats.map((ev) => ({
      id: ev.id,
      time_sec: ev.startSec,
      kind: "beat",
      label: ev.text,
      confirmed: true,
    })),
  ].sort((a, b) => a.time_sec - b.time_sec || a.id.localeCompare(b.id));

  const phrases = sections.map((ev) => ({
    id: ev.id,
    start_sec: ev.startSec,
    end_sec: ev.endSec ?? roundSeconds(ev.startSec + 1, 3),
    label: ev.text,
    confirmed: true,
  }));

  const inspect_clips = clips.map((ev) => ({
    id: ev.id,
    start_sec: ev.startSec,
    end_sec: ev.endSec ?? roundSeconds(ev.startSec + 1, 3),
    label: ev.text,
    confirmed: true,
  }));

  return {
    schema_version: "1.0.0",
    updated_at: new Date().toISOString(),
    preview_mapping: {
      fps: 30,
      audio_offset_sec: 0,
    },
    markers,
    phrases,
    inspect_clips,
  };
}
