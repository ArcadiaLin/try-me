import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ARTIFACTS, executeAgentOperations, planOperations, readAgentProject, withProjectWriteLock } from "../server/agent-operations.ts";
import { createAnnotatorServer, persistProjectArtifacts } from "../server/index.ts";
import type { TimelineProject } from "../web/src/types.ts";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const parent = path.join(repo, "out/agent-operations-tests");
const source: TimelineProject = { version: 1, name: "Synthetic", nodes: [
  { kind: "group", id: "G1", name: "Main", children: [
    { kind: "timeline", id: "T1", name: "Original", items: [
      { id: "E1", startSec: 1.123456, endSec: 2.789123, text: "Original", comments: [
        { role: "human", text: "  原文\n\n第二行 | text  " }, { role: "agent", text: "" },
      ] },
    ] },
  ] },
] };
function fixture() {
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "fixture-"));
  persistProjectArtifacts(structuredClone(source), root);
  return root;
}
function bytes(root: string) { return ARTIFACTS.map(rel => fs.readFileSync(path.join(root, rel))); }
const add = [{ op: "addTrack", parentId: "G1", afterId: "T1", node: {
  kind: "timeline", id: "T2", name: "候选", items: [{ id: "P1", startSec: 3.123456, text: "点" }],
} }];

test("batch preview preserves all human data/precision, adds points and appends notes without writing", () => {
  const root = fixture(), before = bytes(root), snapshot = readAgentProject(root);
  const result = executeAgentOperations(root, { baseRevision: snapshot.revision, operations: [...add,
    { op: "addEvents", trackId: "T2", events: [{ id: "R1", startSec: 4, endSec: 5, text: "区间" }] },
    { op: "appendComment", trackId: "T1", eventId: "E1", comment: { role: "agent", text: "新脚本\n第二行" } },
  ] }, persistProjectArtifacts);
  assert.equal(result.mode, "preview"); assert.deepEqual(bytes(root), before);
  const children = result.project.nodes[0]; assert.equal(children.kind, "group");
  if (children.kind !== "group") return;
  const original = children.children[0]; assert.equal(original.kind, "timeline");
  if (original.kind !== "timeline") return;
  assert.equal(original.items[0].startSec, 1.123456);
  assert.deepEqual(original.items[0].comments?.slice(0, 2), [{ role: "human", text: "  原文\n\n第二行 | text  " }, { role: "agent", text: "" }]);
  assert.equal(result.project.nodes.length, 1);
  assert.deepEqual(snapshot.project, source);
});

test("invalid late operation rejects the entire batch before any save", () => {
  const root = fixture(), before = bytes(root), { revision } = readAgentProject(root);
  assert.throws(() => executeAgentOperations(root, { mode: "apply", baseRevision: revision,
    operations: [...add, { op: "addEvents", trackId: "T2", events: [{ id: "E1", startSec: 3, text: "duplicate" }] }],
  }, persistProjectArtifacts), /Duplicate/);
  assert.deepEqual(bytes(root), before);
  assert.throws(() => planOperations(source, [{ op: "updateEvent", trackId: "T1", eventId: "E1", patch: { comments: [] } }]), /unsupported field/);
  assert.throws(() => planOperations(source, [{ op: "addEvents", trackId: "T1", events: [{ id: "BAD", startSec: "2", text: "bad" }] }]), /startSec/);
});

test("apply backs up all seven artifacts; stale retries cannot duplicate a track", () => {
  const root = fixture(), before = bytes(root), { revision } = readAgentProject(root);
  const request = { mode: "apply", baseRevision: revision, operations: add };
  const result = executeAgentOperations(root, request, persistProjectArtifacts);
  assert.ok("backup" in result && result.backup);
  const backup = path.join(root, result.backup!);
  assert.deepEqual(ARTIFACTS.map(rel => fs.readFileSync(path.join(backup, "before", rel))), before);
  assert.equal(fs.readFileSync(path.join(root, ARTIFACTS[0]), "utf8"), fs.readFileSync(path.join(root, ARTIFACTS[2]), "utf8"));
  assert.equal(readAgentProject(root).revision, result.revision);
  const after = bytes(root);
  assert.throws(() => executeAgentOperations(root, request, persistProjectArtifacts), /changed/);
  assert.deepEqual(bytes(root), after);
});

test("explicit conversion to a point preserves its notes and other events", () => {
  const result = planOperations(source, [{ op: "updateEvent", trackId: "T1", eventId: "E1", patch: { endSec: null, text: "点" } }]);
  const group = result.project.nodes[0]; assert.equal(group.kind, "group");
  if (group.kind !== "group" || group.children[0].kind !== "timeline") return;
  const event = group.children[0].items[0]; assert.equal("endSec" in event, false);
  assert.equal(event.startSec, 1.123456); assert.deepEqual(event.comments, source.nodes[0].kind === "group" && source.nodes[0].children[0].kind === "timeline" ? source.nodes[0].children[0].items[0].comments : []);
});

test("writer conflicts fail closed; a partial save exception restores all seven artifacts", () => {
  const root = fixture(), before = bytes(root), { revision } = readAgentProject(root);
  const request = { mode: "apply", baseRevision: revision, operations: add };
  withProjectWriteLock(root, () => assert.throws(() => executeAgentOperations(root, request, persistProjectArtifacts), /lock/));
  assert.throws(() => executeAgentOperations(root, request, () => {
    fs.writeFileSync(path.join(root, ARTIFACTS[0]), "partial write"); throw new Error("injected disk failure");
  }), /injected disk failure/);
  assert.deepEqual(bytes(root), before);
  assert.equal(fs.existsSync(path.join(root, "local/annotations/.write-lock")), false);
});

test("HTTP preview/apply and browser stale save use an isolated project root", async () => {
  const root = fixture(), before = bytes(root), server = createAnnotatorServer({ repoRoot: root });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  const post = (url: string, value: unknown) => fetch(base + url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  try {
    const snapshot = await (await fetch(base + "/api/agent/project")).json();
    const request = { baseRevision: snapshot.revision, operations: add };
    assert.equal((await post("/api/agent/operations", request)).status, 200);
    assert.deepEqual(bytes(root), before);
    assert.equal((await post("/api/agent/operations", { ...request, mode: "apply" })).status, 200);
    const after = bytes(root);
    assert.equal((await post("/api/agent/operations", { ...request, mode: "apply" })).status, 409);
    assert.equal((await post("/api/annotations", { project: source, baseRevision: snapshot.revision })).status, 409);
    assert.deepEqual(bytes(root), after);
    const current = readAgentProject(root);
    assert.equal((await post("/api/agent/operations", { baseRevision: current.revision, operations: [{ op: "addEvents", trackId: "T1", events: [{ id: "E1", startSec: 9, text: "collision" }] }] })).status, 400);
    assert.deepEqual(bytes(root), after);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test("CLI reads, previews and applies JSON plans; bad output paths cannot cause a write", () => {
  const root = fixture(), before = bytes(root), { revision } = readAgentProject(root);
  const plan = path.join(root, "plan.json");
  fs.writeFileSync(plan, JSON.stringify({ baseRevision: revision, operations: add }));
  const cli = (...args: string[]) => spawnSync(process.execPath, [path.join(repo, "tools/annotator/project-cli.ts"), ...args, "--root", root], { encoding: "utf8" });
  assert.equal(cli("read").status, 0);
  assert.equal(cli("preview", "--input", plan).status, 0); assert.deepEqual(bytes(root), before);
  assert.notEqual(cli("apply", "--input", plan, "--out", path.join(root, ARTIFACTS[0])).status, 0);
  assert.deepEqual(bytes(root), before);
  assert.equal(cli("apply", "--input", plan).status, 0);
  assert.notEqual(cli("apply", "--input", plan).status, 0);
});
