import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_EVENT_COLOR,
  countGroupSubtreeImpact,
  createEmptyProject,
  executeExplorerCommand,
  executeWorkbenchCommand,
  findEventByRef,
  findGroupById,
  findTrackById,
  flattenTracks,
  generateAgentBriefMarkdown,
  isNodeEffectivelyLocked,
  migrateLegacyToTimelineProject,
  moveEventToTrack,
  resolveEventColor,
  validateAndNormalizeProject,
  type TimelineProject,
} from "../web/model.ts";
import {
  buildSanitizedPreviewPayload,
  createAnnotatorServer,
  normalizeTimelineProjectInput,
} from "../server/index.ts";
import {
  exportEventsToAss,
  exportEventsToLrc,
  parseAssToEvents,
  parseLrcToEvents,
} from "../web/src/utils/ass-lrc.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

test("1. docs/annotator/example.json and annotations/try-me.timeline.json validate as version 1 TimelineProject", () => {
  const exampleRaw = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "docs/annotator/example.json"), "utf-8")
  );
  const example = validateAndNormalizeProject(exampleRaw);
  assert.equal(example.version, 1);
  assert.equal(example.comments?.[0]?.role, "human");
  assert.equal(findTrackById(example.nodes, "T001")?.items[0]?.id, "E001");

  const realRaw = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "annotations/try-me.timeline.json"), "utf-8")
  );
  const real = validateAndNormalizeProject(realRaw);
  assert.equal(real.version, 1);

  const lyricsTrack = findTrackById(real.nodes, "trk_lyrics");
  assert.ok(lyricsTrack);
  assert.equal(lyricsTrack.items.length, 63);
  assert.equal(lyricsTrack.items[0]?.id, "L001");
  assert.equal(lyricsTrack.items[0]?.startSec, 18.53);
  assert.equal(lyricsTrack.items[0]?.endSec, 22.721);

  const partsTrack = findTrackById(real.nodes, "trk_song_parts");
  assert.ok(partsTrack);
  assert.equal(partsTrack.items.length, 12);

  // Verify no legacy hash/provenance/UI fields leak into persistent JSON
  const serialized = JSON.stringify(real);
  assert.equal(serialized.includes("origin_analysis_sha256"), false);
  assert.equal(serialized.includes("origin_candidate_id"), false);
  assert.equal(serialized.includes("agent_status"), false);
  assert.equal(serialized.includes("visibleStartSec"), false);
});

test("2. validateAndNormalizeProject enforces version, unique IDs, time order, and #RRGGBB color", () => {
  assert.throws(
    () => validateAndNormalizeProject({ version: 2, name: "Bad", nodes: [] }),
    /Unsupported TimelineProject version/
  );

  // Duplicate node IDs
  assert.throws(
    () =>
      validateAndNormalizeProject({
        version: 1,
        name: "DupNode",
        nodes: [
          { kind: "group", id: "G1", name: "Group 1", children: [] },
          { kind: "timeline", id: "G1", name: "Track 1", items: [] },
        ],
      }),
    /Duplicate TimelineNode id: G1/
  );

  // Duplicate event IDs across tracks
  assert.throws(
    () =>
      validateAndNormalizeProject({
        version: 1,
        name: "DupEvent",
        nodes: [
          {
            kind: "timeline",
            id: "T1",
            name: "T1",
            items: [{ id: "E1", startSec: 1, text: "a" }],
          },
          {
            kind: "timeline",
            id: "T2",
            name: "T2",
            items: [{ id: "E1", startSec: 2, text: "b" }],
          },
        ],
      }),
    /Duplicate TimelineEvent id: E1/
  );

  // endSec <= startSec
  assert.throws(
    () =>
      validateAndNormalizeProject({
        version: 1,
        name: "BadEnd",
        nodes: [
          {
            kind: "timeline",
            id: "T1",
            name: "T1",
            items: [{ id: "E1", startSec: 5, endSec: 5, text: "bad" }],
          },
        ],
      }),
    /endSec \(5\) > startSec \(5\)/
  );

  // Invalid color
  assert.throws(
    () =>
      validateAndNormalizeProject({
        version: 1,
        name: "BadColor",
        nodes: [
          {
            kind: "timeline",
            id: "T1",
            name: "T1",
            color: "rgb(1,2,3)",
            items: [],
          },
        ],
      }),
    /invalid hex color/
  );
});

test("3. Color fallback chain (event.color -> track.color -> #166b75) & moving events across tracks", () => {
  let project: TimelineProject = {
    version: 1,
    name: "ColorTest",
    nodes: [
      {
        kind: "timeline",
        id: "T1",
        name: "Track 1",
        color: "#2b6f77",
        items: [
          { id: "E_AUTO", startSec: 1, endSec: 2, text: "Auto color" },
          {
            id: "E_CUSTOM",
            startSec: 3,
            endSec: 4,
            text: "Custom color",
            color: "#ad754b",
          },
        ],
      },
      {
        kind: "timeline",
        id: "T2",
        name: "Track 2",
        color: "#7c7294",
        items: [],
      },
      {
        kind: "timeline",
        id: "T3",
        name: "Track 3 (no color)",
        items: [],
      },
    ],
  };

  const t1 = findTrackById(project.nodes, "T1")!;
  const t3 = findTrackById(project.nodes, "T3")!;
  assert.equal(resolveEventColor(t1.items[0], t1), "#2b6f77");
  assert.equal(resolveEventColor(t1.items[1], t1), "#ad754b");
  assert.equal(resolveEventColor({ color: undefined }, t3), DEFAULT_EVENT_COLOR);

  // Move E_AUTO to T2 -> resolves to T2's color (#7c7294)
  project = moveEventToTrack(
    project,
    { trackId: "T1", eventId: "E_AUTO" },
    "T2"
  ).project;
  const movedAuto = findEventByRef(project, {
    trackId: "T2",
    eventId: "E_AUTO",
  })!;
  assert.equal(movedAuto.event.color, undefined);
  assert.equal(resolveEventColor(movedAuto.event, movedAuto.track), "#7c7294");

  // Move E_CUSTOM to T2 -> keeps explicit #ad754b
  project = moveEventToTrack(
    project,
    { trackId: "T1", eventId: "E_CUSTOM" },
    "T2"
  ).project;
  const movedCustom = findEventByRef(project, {
    trackId: "T2",
    eventId: "E_CUSTOM",
  })!;
  assert.equal(
    resolveEventColor(movedCustom.event, movedCustom.track),
    "#ad754b"
  );
});

test("4. Recursive ExplorerCommand: createNode, renameNode, deleteNode, and cascading lock rules", () => {
  let project = createEmptyProject();

  // Create nested subgroup inside col_custom
  const createdGroup = executeExplorerCommand(project, {
    type: "createNode",
    parentGroupId: "col_custom",
    nodeKind: "group",
    name: "合成器层组",
  });
  project = createdGroup.project;
  const subGroupId = createdGroup.createdNodeId!;
  assert.ok(subGroupId);

  // Create timeline inside that nested subgroup
  const createdTrack = executeExplorerCommand(project, {
    type: "createNode",
    parentGroupId: subGroupId,
    nodeKind: "timeline",
    name: "主音合成器轨",
    color: "#3f7468",
  });
  project = createdTrack.project;
  const subTrackId = createdTrack.createdNodeId!;

  // Add an event to that nested track
  project = executeWorkbenchCommand(project, {
    type: "createEvent",
    trackId: subTrackId,
    startSec: 10,
    endSec: 12,
    text: "Arp motif",
  }).project;

  // Verify subtree impact count on col_custom
  const customGroup = findGroupById(project.nodes, "col_custom")!;
  const impact = countGroupSubtreeImpact(customGroup);
  assert.ok(impact.groupCount >= 2);
  assert.ok(impact.trackCount >= 3);
  assert.equal(impact.eventCount, 1);

  // Locking ancestor group col_custom cascades to subGroupId and subTrackId
  const lockedIds = new Set(["col_custom"]);
  assert.equal(
    isNodeEffectivelyLocked(project.nodes, subTrackId, lockedIds),
    true
  );
  assert.throws(
    () =>
      executeExplorerCommand(
        project,
        { type: "renameNode", nodeId: subTrackId, name: "Blocked" },
        lockedIds
      ),
    /锁定/
  );

  // Locking only child track blocks deleting parent group col_custom
  const childLocked = new Set([subTrackId]);
  assert.throws(
    () =>
      executeExplorerCommand(
        project,
        { type: "deleteNode", nodeId: "col_custom" },
        childLocked
      ),
    /已锁定的子项/
  );

  // When unlocked, deleting subGroupId removes both subGroupId and subTrackId
  const delRes = executeExplorerCommand(project, {
    type: "deleteNode",
    nodeId: subGroupId,
  });
  project = delRes.project;
  assert.equal(findTrackById(project.nodes, subTrackId), null);
});

test("5. WorkbenchCommand: split range event, boundary links, comments, and delete", () => {
  let project: TimelineProject = {
    version: 1,
    name: "SplitTest",
    nodes: [
      {
        kind: "timeline",
        id: "T1",
        name: "Vocal",
        color: "#166b75",
        items: [
          {
            id: "L001",
            startSec: 10,
            endSec: 14,
            text: "Hello world",
            color: "#ad754b",
            comments: [{ role: "human", text: "Keep on left segment only" }],
          },
          {
            id: "L002",
            startSec: 15,
            endSec: 18,
            text: "Second line",
          },
        ],
      },
    ],
  };

  // Link boundary between L001 and L002
  let res = executeWorkbenchCommand(project, {
    type: "linkBoundary",
    link: { trackId: "T1", leftEventId: "L001", rightEventId: "L002" },
  });
  project = res.project;
  let links = res.boundaryLinks;
  assert.equal(links.length, 1);
  assert.equal(
    findEventByRef(project, { trackId: "T1", eventId: "L001" })?.event.endSec,
    14.5
  );
  assert.equal(
    findEventByRef(project, { trackId: "T1", eventId: "L002" })?.event.startSec,
    14.5
  );

  // Split L001 at 12.0s:
  // - Left keeps L001 and comments
  // - Right gets L003, inherits text & color, NO comments
  // - BoundaryLink involving L001 is cleared
  res = executeWorkbenchCommand(
    project,
    {
      type: "split",
      ref: { trackId: "T1", eventId: "L001" },
      atSec: 12.0,
    },
    { boundaryLinks: links }
  );
  project = res.project;
  links = res.boundaryLinks;
  assert.equal(links.length, 0);

  const leftEv = findEventByRef(project, {
    trackId: "T1",
    eventId: "L001",
  })!.event;
  const rightEv = findEventByRef(
    project,
    res.splitRightEventRef!
  )!.event;

  assert.equal(leftEv.startSec, 10);
  assert.equal(leftEv.endSec, 12);
  assert.equal(leftEv.comments?.length, 1);

  assert.equal(rightEv.id, "L003");
  assert.equal(rightEv.startSec, 12);
  assert.equal(rightEv.endSec, 14.5);
  assert.equal(rightEv.text, "Hello world");
  assert.equal(rightEv.color, "#ad754b");
  assert.equal(rightEv.comments, undefined);

  // Point event cannot be split
  project = executeWorkbenchCommand(project, {
    type: "createEvent",
    trackId: "T1",
    id: "PT01",
    startSec: 20,
    text: "Point",
  }).project;
  assert.throws(
    () =>
      executeWorkbenchCommand(project, {
        type: "split",
        ref: { trackId: "T1", eventId: "PT01" },
        atSec: 20,
      }),
    /点事件不支持切分/
  );
});

test("6. ASS and LRC subtitle export/import with TimelineEvent[]", () => {
  const events = [
    { id: "L001", startSec: 18.53, endSec: 22.72, text: "Hey, let's go" },
    { id: "L002", startSec: 24.3, endSec: 26.86, text: "Time to start" },
  ];
  const ass = exportEventsToAss(events);
  const parsedAss = parseAssToEvents(ass);
  assert.equal(parsedAss.length, 2);
  assert.equal(parsedAss[0]?.text, "Hey, let's go");

  const lrc = exportEventsToLrc(events);
  const parsedLrc = parseLrcToEvents(lrc);
  assert.equal(parsedLrc.length, 2);
  assert.equal(parsedLrc[1]?.text, "Time to start");

  // Also test legacy v0.1.0 / v0.2.0 migration & Agent Brief Markdown generation
  const migrated = migrateLegacyToTimelineProject({
    schema_version: "0.2.0",
    global_notes: "Global instruction",
    tracks: [
      {
        id: "lyrics_main",
        collection_id: "col_lyrics",
        items: [
          {
            id: "L001",
            start_sec: 18.53,
            end_sec: 22.721,
            label: "Hey, let's go",
            note: "Vocal onset verified",
          },
        ],
      },
    ],
  });
  const normalized = normalizeTimelineProjectInput(migrated);
  assert.equal(normalized.version, 1);
  assert.equal(normalized.comments?.[0]?.text, "Global instruction");
  const md = generateAgentBriefMarkdown(normalized);
  assert.ok(md.includes("Vocal onset verified"));
});

test("7. Server HTTP GET/POST /api/annotations round-trip and validation", async () => {
  const server = createAnnotatorServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const getRes = await fetch(`${baseUrl}/api/annotations`);
    assert.equal(getRes.status, 200);
    const getBody = (await getRes.json()) as {
      project: TimelineProject;
      agentBriefMarkdown: string;
    };
    assert.equal(getBody.project.version, 1);
    assert.ok(flattenTracks(getBody.project.nodes).length >= 5);
    assert.ok(getBody.agentBriefMarkdown.includes("Try Me"));

    // Invalid payload (endSec <= startSec) returns 400
    const badRes = await fetch(`${baseUrl}/api/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: {
          version: 1,
          name: "Bad",
          nodes: [
            {
              kind: "timeline",
              id: "T1",
              name: "T1",
              items: [{ id: "E1", startSec: 10, endSec: 8, text: "bad" }],
            },
          ],
        },
      }),
    });
    assert.equal(badRes.status, 400);

    // Valid round-trip save of current project
    const postRes = await fetch(`${baseUrl}/api/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: getBody.project }),
    });
    assert.equal(postRes.status, 200);

    // Verify index.html, styles.css, and esbuild /bundle.js build and serve cleanly
    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const cssRes = await fetch(`${baseUrl}/styles.css`);
    assert.equal(cssRes.status, 200);
    const cssText = await cssRes.text();
    assert.ok(cssText.includes("#b8cdd2"));
    const bundleRes = await fetch(`${baseUrl}/bundle.js`);
    assert.equal(bundleRes.status, 200);
    const bundleText = await bundleRes.text();
    assert.ok(bundleText.includes("UnifiedWorkbench"));

    const preview = buildSanitizedPreviewPayload(getBody.project);
    assert.equal(preview.phrases.length, 12);
    assert.equal(preview.inspect_clips.length, 1);
    assert.ok(preview.markers.length >= 16);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
