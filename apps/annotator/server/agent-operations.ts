import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { validateAndNormalizeProject } from "../web/model.ts";
import type { Comment, TimelineEvent, TimelineNode, TimelineProject, TimelineTrack } from "../web/src/types.ts";

export class OperationError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

type RecordValue = Record<string, unknown>;
export const ARTIFACTS = ["annotations/try-me.timeline.json", "annotations/agent-brief.md",
  "local/annotations/annotations.json", "local/annotations/agent-brief.md",
  "local/annotations/lyrics/try-me.ass", "local/annotations/lyrics/try-me.lrc",
  "public/private/annotations-preview.json"];
const digest = (bytes: Buffer | string) => crypto.createHash("sha256").update(bytes).digest("hex");

function object(raw: unknown, label: string): RecordValue {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new OperationError(`${label} must be an object`);
  return raw as RecordValue;
}
function keys(value: RecordValue, allowed: string[], label: string) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new OperationError(`${label}: unsupported field ${key}`);
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new OperationError(`${label} must be a nonempty string`);
  return value;
}
function comments(value: unknown): Comment[] {
  if (!Array.isArray(value)) throw new OperationError("comments must be an array");
  return value.map(raw => {
    const c = object(raw, "comment"); keys(c, ["role", "text"], "comment");
    if ((c.role !== "human" && c.role !== "agent") || typeof c.text !== "string") throw new OperationError("Invalid comment role or text");
    return { role: c.role, text: c.text };
  });
}
function nodes(all: TimelineNode[]): TimelineNode[] {
  return all.flatMap(n => [n, ...(n.kind === "group" ? nodes(n.children) : [])]);
}
function findNode(project: TimelineProject, id: unknown): TimelineNode {
  const target = nodes(project.nodes).find(n => n.id === text(id, "nodeId"));
  if (!target) throw new OperationError(`Node not found: ${String(id)}`);
  return target;
}
function findTrack(project: TimelineProject, id: unknown): TimelineTrack {
  const target = findNode(project, id);
  if (target.kind !== "timeline") throw new OperationError(`Not a timeline: ${target.id}`);
  return target;
}
function findEvent(project: TimelineProject, trackId: unknown, eventId: unknown): TimelineEvent {
  const target = findTrack(project, trackId).items.find(e => e.id === text(eventId, "eventId"));
  if (!target) throw new OperationError(`Event not found: ${String(eventId)}`);
  return target;
}
function validateEvent(raw: unknown): TimelineEvent {
  const e = object(raw, "event"); keys(e, ["id", "startSec", "endSec", "text", "color", "comments"], "event");
  text(e.id, "event.id");
  if (typeof e.startSec !== "number" || !Number.isFinite(e.startSec) || e.startSec < 0) throw new OperationError("Invalid event.startSec");
  if (e.endSec !== undefined && (typeof e.endSec !== "number" || !Number.isFinite(e.endSec) || e.endSec <= e.startSec)) throw new OperationError("Invalid event.endSec; omit for a point");
  if (typeof e.text !== "string") throw new OperationError("event.text must be a string");
  if (e.comments !== undefined) comments(e.comments);
  return structuredClone(e) as unknown as TimelineEvent;
}

export function readAgentProject(root: string) {
  const bytes = fs.readFileSync(path.join(root, ARTIFACTS[0]));
  const project = JSON.parse(bytes.toString("utf8")) as TimelineProject;
  validateAndNormalizeProject(project); // Validate, but do not round/reorder unrelated human data.
  return { revision: digest(bytes), project };
}

export function planOperations(original: TimelineProject, rawOperations: unknown, maxDurationSec?: number) {
  if (!Array.isArray(rawOperations) || !rawOperations.length) throw new OperationError("operations must be a nonempty array");
  const project = structuredClone(original);
  const changes: string[] = [];
  for (const raw of rawOperations) {
    const op = object(raw, "operation");
    switch (op.op) {
      case "addGroup":
      case "addTrack": {
        keys(op, ["op", "parentId", "afterId", "node"], String(op.op));
        const n = object(op.node, "node");
        const group = op.op === "addGroup";
        keys(n, group ? ["kind", "id", "name", "comments", "children"] : ["kind", "id", "name", "comments", "color", "items"], "node");
        if (n.kind !== (group ? "group" : "timeline")) throw new OperationError("node.kind does not match operation");
        text(n.id, "node.id"); text(n.name, "node.name");
        if (n.comments !== undefined) comments(n.comments);
        if (group && (!Array.isArray(n.children) || n.children.length)) throw new OperationError("addGroup requires empty children; add child nodes with later operations");
        if (!group) {
          if (!Array.isArray(n.items)) throw new OperationError("track.items must be an array");
          n.items.forEach(validateEvent);
        }
        let siblings = project.nodes;
        if (op.parentId !== undefined && op.parentId !== null) {
          const parent = findNode(project, op.parentId);
          if (parent.kind !== "group") throw new OperationError("parentId must name a group");
          siblings = parent.children;
        }
        const after = op.afterId === undefined ? siblings.length - 1 : siblings.findIndex(x => x.id === op.afterId);
        if (op.afterId !== undefined && after < 0) throw new OperationError("afterId must be a sibling in the requested parent");
        siblings.splice(after + 1, 0, structuredClone(n) as unknown as TimelineNode);
        changes.push(`${op.op} ${String(n.id)}`);
        break;
      }
      case "addEvents": {
        keys(op, ["op", "trackId", "events"], "addEvents");
        if (!Array.isArray(op.events) || !op.events.length) throw new OperationError("events must be nonempty");
        findTrack(project, op.trackId).items.push(...op.events.map(validateEvent));
        changes.push(`addEvents ${String(op.trackId)} +${op.events.length}`);
        break;
      }
      case "updateEvent": {
        keys(op, ["op", "trackId", "eventId", "patch"], "updateEvent");
        const e = findEvent(project, op.trackId, op.eventId);
        const patch = object(op.patch, "patch"); keys(patch, ["startSec", "endSec", "text", "color"], "event.patch");
        for (const [key, value] of Object.entries(patch)) {
          if (value === null && (key === "endSec" || key === "color")) delete (e as unknown as RecordValue)[key];
          else (e as unknown as RecordValue)[key] = value;
        }
        validateEvent(e);
        changes.push(`updateEvent ${e.id}`);
        break;
      }
      case "updateTrack": {
        keys(op, ["op", "trackId", "patch"], "updateTrack");
        const t = findTrack(project, op.trackId);
        const patch = object(op.patch, "patch"); keys(patch, ["name", "color"], "track.patch");
        if (patch.name !== undefined) t.name = text(patch.name, "track.name");
        if (patch.color === null) delete t.color;
        else if (patch.color !== undefined) t.color = text(patch.color, "track.color");
        changes.push(`updateTrack ${t.id}`);
        break;
      }
      case "appendComment": {
        keys(op, ["op", "nodeId", "trackId", "eventId", "comment"], "appendComment");
        if (op.nodeId !== undefined && (op.trackId !== undefined || op.eventId !== undefined)) throw new OperationError("Ambiguous comment target");
        const target = op.eventId !== undefined ? findEvent(project, op.trackId, op.eventId)
          : op.nodeId !== undefined ? findNode(project, op.nodeId) : project;
        if (op.trackId !== undefined && op.eventId === undefined) throw new OperationError("Use nodeId for track comments");
        target.comments = [...(target.comments ?? []), ...comments([op.comment])];
        changes.push(`appendComment ${String(op.eventId ?? op.nodeId ?? "project")}`);
        break;
      }
      default: throw new OperationError(`Unsupported operation: ${String(op.op)}`);
    }
    validateAndNormalizeProject(project, maxDurationSec);
    // Enforce a single namespace for newly introduced IDs without changing existing documents.
    const all = nodes(project.nodes);
    const ids = all.flatMap(n => [n.id, ...(n.kind === "timeline" ? n.items.map(e => e.id) : [])]);
    if (new Set(ids).size !== ids.length) throw new OperationError("Duplicate node/event ID");
  }
  return { project, changes };
}

type Persist = (project: TimelineProject, root: string) => unknown;
export interface BatchResult {
  mode: "preview" | "apply";
  baseRevision: string;
  project: TimelineProject;
  changes: string[];
  revision?: string;
  backup?: string;
}
export function withProjectWriteLock<T>(root: string, action: () => T): T {
  const lock = path.join(root, "local/annotations/.write-lock");
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  let handle: number;
  try { handle = fs.openSync(lock, "wx"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new OperationError("Another writer holds the project lock", 409);
    throw error;
  }
  try { return action(); }
  finally { fs.closeSync(handle); fs.unlinkSync(lock); }
}

export function executeAgentOperations(root: string, input: unknown, persist: Persist): BatchResult {
  return object(input, "request").mode === "apply"
    ? withProjectWriteLock(root, () => executeLocked(root, input, persist))
    : executeLocked(root, input, persist);
}

function executeLocked(root: string, input: unknown, persist: Persist): BatchResult {
  const request = object(input, "request"); keys(request, ["baseRevision", "operations", "mode"], "request");
  const baseRevision = text(request.baseRevision, "baseRevision");
  const mode = request.mode ?? "preview";
  if (mode !== "preview" && mode !== "apply") throw new OperationError("mode must be preview or apply");
  const snapshot = readAgentProject(root);
  if (snapshot.revision !== baseRevision) throw new OperationError("Project changed; read latest revision and rebuild the plan", 409);
  const summaryPath = path.join(root, "local/analysis/summary.json");
  const summary = fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, "utf8")) : {};
  const duration = summary.input_audio?.duration_sec ?? summary.audio_file?.duration_sec;
  let plan: ReturnType<typeof planOperations>;
  try { plan = planOperations(snapshot.project, request.operations, duration); }
  catch (error) { throw error instanceof OperationError ? error : new OperationError(error instanceof Error ? error.message : String(error)); }
  if (mode === "preview") return { mode, baseRevision, ...plan };
  const folder = path.join(root, "out", "annotator-operations");
  fs.mkdirSync(folder, { recursive: true });
  const backup = fs.mkdtempSync(path.join(folder, "batch-"));
  for (const rel of ARTIFACTS) {
    const source = path.join(root, rel);
    if (!fs.existsSync(source)) continue;
    const dest = path.join(backup, "before", rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(source, dest);
  }
  fs.writeFileSync(path.join(backup, "request.json"), JSON.stringify(request, null, 2) + "\n");
  if (readAgentProject(root).revision !== baseRevision) throw new OperationError("Project changed during backup; no changes applied", 409);
  try { persist(plan.project, root); }
  catch (error) {
    for (const rel of ARTIFACTS) {
      const before = path.join(backup, "before", rel), target = path.join(root, rel);
      if (fs.existsSync(before)) fs.copyFileSync(before, target);
      else if (fs.existsSync(target)) fs.unlinkSync(target);
    }
    throw error;
  }
  return { mode, baseRevision, revision: readAgentProject(root).revision, backup: path.relative(root, backup), ...plan };
}
