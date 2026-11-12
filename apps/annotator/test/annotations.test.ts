import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  audioSecToGlobalFrame,
  computePreviewTimeline,
} from "@try-me/shared";
import {
  buildSanitizedPreviewPayload,
  createAnnotationServer,
  normalizeAnnotations,
} from "../server/index.ts";
import {
  allocateMarkerId,
  allocateRegionId,
  applyCandidateProvenance,
  applyServerStateToModel,
  clearCandidateProvenance,
  executeReloadFlow,
  executeSaveFlow,
  reconcileSaveResponse,
} from "../web/model.ts";
import {
  exportLyricsToAss,
  exportLyricsToLrc,
  parseAssToLyrics,
  parseLrcToLyrics,
} from "../web/src/utils/ass-lrc.ts";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

async function createTempFixture() {
  const tmpRoot = await fsp.mkdtemp(
    path.join(os.tmpdir(), "try-me-annotator-test-"),
  );
  const analysisDir = path.join(tmpRoot, "local/analysis");
  const annotationsDir = path.join(tmpRoot, "local/annotations");
  const previewJsonFile = path.join(
    tmpRoot,
    "public/private/annotations-preview.json",
  );
  const audioFile = path.join(tmpRoot, "public/private/audio/try-me.flac");

  await fsp.mkdir(analysisDir, { recursive: true });
  await fsp.mkdir(annotationsDir, { recursive: true });
  await fsp.mkdir(path.dirname(audioFile), { recursive: true });

  // Minimal FLAC magic header stub for range streaming tests
  await fsp.writeFile(audioFile, Buffer.from("fLaC0000111122223333", "ascii"));

  const provenance = {
    schema_version: "0.1.0",
    analysis_run_id: "run_test_fixture_01",
    generated_at_utc: "2026-11-12T00:00:00Z",
    source: "auto",
    status: "candidate",
    confirmed: false,
    input_audio: {
      asset_id: "A001",
      path: "public/private/audio/try-me.flac",
      sha256: "f0ec600dbf3d5571ed37fe58cd6832e697a737a431200df63ba7b6fadf72476d",
      samplerate: 44100,
      channels: 2,
      total_samples: 9248635,
      duration_sec: 209.719615,
    },
  };

  await Promise.all([
    fsp.writeFile(
      path.join(analysisDir, "summary.json"),
      JSON.stringify(provenance, null, 2),
    ),
    fsp.writeFile(
      path.join(analysisDir, "waveform.json"),
      JSON.stringify({ ...provenance, bins_per_sec: 50, bin_count: 1, bins: [] }),
    ),
    fsp.writeFile(
      path.join(analysisDir, "beats.json"),
      JSON.stringify({
        ...provenance,
        candidates: [
          {
            id: "C_BEAT_0001",
            kind: "beat",
            source: "auto",
            status: "candidate",
            time_sec: 0.58,
            sample_index: 25578,
            feature_frame: 50,
            onset_strength: 3.2,
          },
        ],
      }),
    ),
    fsp.writeFile(
      path.join(analysisDir, "onsets.json"),
      JSON.stringify({ ...provenance, candidates: [] }),
    ),
    fsp.writeFile(
      path.join(analysisDir, "energy.json"),
      JSON.stringify({ ...provenance, shift_candidates: [], frames: [] }),
    ),
  ]);

  return {
    tmpRoot,
    audioFile,
    analysisDir,
    annotationsDir,
    annotationsFile: path.join(annotationsDir, "annotations.json"),
    previewJsonFile,
  };
}

async function runTests() {
  const fixture = await createTempFixture();
  const server = createAnnotationServer(fixture);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Initial state & FLAC range check
    const initRes = await fetch(`${baseUrl}/api/state`);
    assert.equal(initRes.status, 200);
    const initData = await initRes.json();
    assert.equal(initData.revision, "initial");
    assert.equal(
      initData.annotations.audio_asset.analysis_run_id,
      "run_test_fixture_01",
    );
    assert.equal(initData.annotations.audio_asset.total_samples, 9248635);

    const rangeRes = await fetch(`${baseUrl}/api/audio`, {
      headers: { Range: "bytes=0-3" },
    });
    assert.equal(rangeRes.status, 206);
    assert.equal(
      Buffer.from(await rangeRes.arrayBuffer()).toString("ascii"),
      "fLaC",
    );

    const sharedModuleRes = await fetch(
      `${baseUrl}/vendor/shared/time-mapping.ts`,
    );
    assert.equal(sharedModuleRes.status, 200);
    const sharedModuleText = await sharedModuleRes.text();
    assert.ok(sharedModuleText.includes("export function audioSecToGlobalFrame"));

    const appModuleRes = await fetch(`${baseUrl}/app.ts`);
    assert.equal(appModuleRes.status, 200);
    assert.ok(
      appModuleRes.headers.get("content-type")?.includes("application/javascript"),
    );
    const appModuleText = await appModuleRes.text();
    assert.ok(appModuleText.includes("export async function saveAnnotations"));

    // 2. First valid save
    const payloadA = structuredClone(initData.annotations);
    payloadA.markers.push({
      id: "M0001",
      kind: "point",
      category: "beat",
      label: "M0001",
      color: "#eab308",
      time_sec: 0.58,
      source: "human",
      origin_candidate_id: "C_BEAT_0001",
      origin_analysis_run_id: "run_test_fixture_01",
      origin_candidate_time_sec: 0.58,
      origin_candidate_sample_index: 25578,
      status: "candidate",
      linked_shots: ["S001"],
      note: "first save",
      script_idea: "",
      agent_comment: "",
      agent_status: "none",
      agent_reply: "",
      lyric_hint: "SECRET_LYRIC_LINE",
      unexpected_extra_field: "MUST_NOT_APPEAR_IN_PREVIEW",
    });

    const saveARes = await fetch(`${baseUrl}/api/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_revision: initData.revision,
        annotations: payloadA,
      }),
    });
    assert.equal(saveARes.status, 200);
    const savedA = await saveARes.json();
    assert.notEqual(savedA.revision, "initial");

    // Verify allowlist in preview JSON
    const previewRaw = await fsp.readFile(fixture.previewJsonFile, "utf8");
    assert.ok(!previewRaw.includes("SECRET_LYRIC_LINE"));
    assert.ok(!previewRaw.includes("MUST_NOT_APPEAR_IN_PREVIEW"));

    // 3. Concurrent CAS race & missing base_revision rejection
    const missingRevRes = await fetch(`${baseUrl}/api/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ annotations: payloadA }),
    });
    assert.equal(missingRevRes.status, 409);

    const payloadB1 = structuredClone(savedA.annotations);
    payloadB1.global_notes.overall_concept = "concurrent-1";
    const payloadB2 = structuredClone(savedA.annotations);
    payloadB2.global_notes.overall_concept = "concurrent-2";

    const [race1, race2] = await Promise.all([
      fetch(`${baseUrl}/api/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_revision: savedA.revision,
          annotations: payloadB1,
        }),
      }),
      fetch(`${baseUrl}/api/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_revision: savedA.revision,
          annotations: payloadB2,
        }),
      }),
    ]);
    const statuses = [race1.status, race2.status].sort();
    assert.deepEqual(statuses, [200, 409]);

    // 4. Validation rejections (unknown schema, NaN FPS, inverted region, duplicate ID, audio hash mismatch)
    const latestState = await (await fetch(`${baseUrl}/api/state`)).json();
    const curRev = latestState.revision;

    // 4a. Unknown schema
    assert.throws(
      () => normalizeAnnotations({ schema_version: "9.9.9" }, null),
      /Unsupported schema_version/,
    );

    // 4b. Invalid FPS (NaN)
    assert.throws(
      () =>
        normalizeAnnotations(
          { preview_mapping: { preview_fps: "invalid" } },
          null,
        ),
      /preview_fps must be a finite number/,
    );

    // 4c. Inverted region [10, 5] must be rejected, not mutated into 50ms
    assert.throws(
      () =>
        normalizeAnnotations(
          {
            regions: [{ id: "P001", start_sec: 10, end_sec: 5 }],
          },
          null,
        ),
      /Region P001 interval/,
    );

    // 4d. Duplicate marker ID must be rejected, not silently renamed
    assert.throws(
      () =>
        normalizeAnnotations(
          {
            markers: [
              { id: "M0001", time_sec: 1.0 },
              { id: "M0001", time_sec: 2.0 },
            ],
          },
          null,
        ),
      /Duplicate marker id: M0001/,
    );

    // 4e. Audio hash mismatch must return 409 audio_hash_mismatch
    const badHashPayload = structuredClone(latestState.annotations);
    badHashPayload.audio_asset.sha256 = "0000_DIFFERENT_AUDIO_SHA256";
    const badHashRes = await fetch(`${baseUrl}/api/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_revision: curRev,
        annotations: badHashPayload,
      }),
    });
    assert.equal(badHashRes.status, 409);
    const badHashBody = await badHashRes.json();
    assert.equal(badHashBody.error, "audio_hash_mismatch");

    // 5. Corrupted JSON on disk must NOT be treated as empty or overwritten
    const validDiskContent = await fsp.readFile(
      fixture.annotationsFile,
      "utf8",
    );
    await fsp.writeFile(fixture.annotationsFile, "{ corrupted json", "utf8");

    const corruptGetRes = await fetch(`${baseUrl}/api/state`);
    assert.equal(corruptGetRes.status, 500);
    const corruptPostRes = await fetch(`${baseUrl}/api/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_revision: curRev,
        force: true,
        annotations: latestState.annotations,
      }),
    });
    assert.equal(corruptPostRes.status, 500);
    // Verify corrupted file was not overwritten
    assert.equal(
      await fsp.readFile(fixture.annotationsFile, "utf8"),
      "{ corrupted json",
    );

    // Restore valid content
    await fsp.writeFile(fixture.annotationsFile, validDiskContent, "utf8");

    // 6. Verify analyze-audio.py --output-dir boundary check rejects local/annotations
    const pyCheck = spawnSync(
      "uv",
      [
        "run",
        "python",
        "tools/audio-analyzer/analyze-audio.py",
        "--verify-only",
        "--output-dir",
        "local/annotations",
      ],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    assert.notEqual(pyCheck.status, 0);
    assert.ok(pyCheck.stderr.includes("must be inside local/analysis/"));

    // 7. Verify buildSanitizedPreviewPayload allowlist
    const sanitized = buildSanitizedPreviewPayload(payloadA);
    assert.equal(sanitized.markers[0].lyric_hint, undefined);
    assert.equal(sanitized.markers[0].unexpected_extra_field, undefined);

    // 8. Verify monotonic ID allocation never reuses deleted IDs
    const mockAnn = {
      id_counters: { marker_seq: 0, region_seq: 0 },
      markers: [],
      regions: [],
    };
    const id1 = allocateMarkerId(mockAnn);
    mockAnn.markers.push({ id: id1 });
    const id2 = allocateMarkerId(mockAnn);
    mockAnn.markers.push({ id: id2 });
    const id3 = allocateMarkerId(mockAnn);
    mockAnn.markers.push({ id: id3 });
    assert.equal(id3, "M0003");
    // Delete M0003 and allocate next -> must be M0004, NOT M0003!
    mockAnn.markers = mockAnn.markers.filter((m) => m.id !== "M0003");
    const id4 = allocateMarkerId(mockAnn);
    assert.equal(id4, "M0004");

    const r1 = allocateRegionId(mockAnn);
    mockAnn.regions.push({ id: r1 });
    const r2 = allocateRegionId(mockAnn);
    mockAnn.regions.push({ id: r2 });
    mockAnn.regions = mockAnn.regions.filter((r) => r.id !== "P002");
    const r3 = allocateRegionId(mockAnn);
    assert.equal(r3, "P003");

    // 9. Verify client save reconciliation preserves in-flight user edits (edit-during-save race)
    const clientState = {
      loadEpoch: 1,
      revision: "rev_0",
      editSeq: 2, // User made edit B (seq 2) while save A (seq 1) was in flight
      savedSeq: 0,
      agentBriefMarkdown: "",
      annotations: {
        id_counters: { marker_seq: 4, region_seq: 1 },
        global_notes: { overall_concept: "new-edit-B" },
      },
    };
    const serverRespForA = {
      revision: "rev_1",
      agentBriefMarkdown: "# brief A",
      annotations: {
        id_counters: { marker_seq: 3, region_seq: 1 },
        global_notes: { overall_concept: "saved-A" },
      },
    };
    const rec = reconcileSaveResponse(clientState, 1, 1, serverRespForA);
    assert.equal(rec.status, "dirty_preserved");
    assert.equal(rec.needsFollowUpSave, true);
    assert.equal(
      clientState.annotations.global_notes.overall_concept,
      "new-edit-B",
    );
    assert.equal(clientState.revision, "rev_1");

    // 10. Verify Reload advances loadEpoch, clears undo/redo, and ignores stale pre-reload save responses
    clientState.undoStack = ["snap_old"];
    clientState.redoStack = ["snap_redo"];
    applyServerStateToModel(clientState, {
      revision: "rev_reloaded",
      analysis: { summary: { analysis_run_id: "run_2" } },
      annotations: {
        id_counters: { marker_seq: 10, region_seq: 2 },
        global_notes: { overall_concept: "from-reload" },
      },
      agentBriefMarkdown: "# brief reloaded",
      audioHashMismatch: false,
    });
    assert.equal(clientState.loadEpoch, 2);
    assert.equal(clientState.undoStack.length, 0);
    assert.equal(clientState.redoStack.length, 0);
    assert.equal(clientState.editSeq, clientState.savedSeq);

    // Late response from pre-reload epoch 1 arrives after reload -> must be ignored!
    const staleOutcome = reconcileSaveResponse(
      clientState,
      1,
      clientState.editSeq,
      serverRespForA,
    );
    assert.equal(staleOutcome.status, "ignored_stale_epoch");
    assert.equal(
      clientState.annotations.global_notes.overall_concept,
      "from-reload",
    );
    assert.equal(clientState.revision, "rev_reloaded");

    // 11. Verify candidate provenance helpers use current analysis summary and clear on manual edit
    const markerItem = {
      id: "M0005",
      time_sec: 1.25,
    };
    applyCandidateProvenance(
      markerItem,
      { id: "C_BEAT_0010", time_sec: 1.25, sample_index: 55125 },
      {
        analysis_run_id: "run_new_analysis_99",
        input_audio: { sha256: "sha256_from_latest_summary" },
      },
      {
        analysis_run_id: "run_stale_annotation",
        sha256: "sha256_stale",
      },
    );
    assert.equal(markerItem.origin_candidate_id, "C_BEAT_0010");
    assert.equal(markerItem.origin_analysis_run_id, "run_new_analysis_99");
    assert.equal(
      markerItem.origin_analysis_sha256,
      "sha256_from_latest_summary",
    );
    assert.equal(markerItem.origin_candidate_sample_index, 55125);

    clearCandidateProvenance(markerItem);
    assert.equal(markerItem.origin_candidate_id, null);
    assert.equal(markerItem.origin_analysis_run_id, null);
    assert.equal(markerItem.origin_analysis_sha256, null);
    assert.equal(markerItem.origin_candidate_time_sec, null);
    assert.equal(markerItem.origin_candidate_sample_index, null);

    // 12. Verify GET /api/state flags audioHashMismatch without silently overwriting annotations.audio_asset.sha256
    const diskJson = JSON.parse(
      await fsp.readFile(fixture.annotationsFile, "utf8"),
    );
    diskJson.audio_asset.sha256 = "old_audio_sha256_on_disk";
    await fsp.writeFile(
      fixture.annotationsFile,
      JSON.stringify(diskJson, null, 2),
      "utf8",
    );
    const mismatchStateRes = await fetch(`${baseUrl}/api/state`);
    assert.equal(mismatchStateRes.status, 200);
    const mismatchState = await mismatchStateRes.json();
    assert.equal(mismatchState.audioHashMismatch, true);
    assert.equal(
      mismatchState.annotations.audio_asset.sha256,
      "old_audio_sha256_on_disk",
    );

    // 13. Full async test: Stale 409 response arriving after reload + new edit D must be completely ignored
    let resolveStale409Fetch;
    const stale409Fetch = () =>
      new Promise((resolve) => {
        resolveStale409Fetch = resolve;
      });

    const asyncState = {
      loadEpoch: 1,
      reloadRequestSeq: 0,
      revision: "rev_old",
      editSeq: 1,
      savedSeq: 0,
      saveInFlight: false,
      pendingSaveForce: null,
      undoStack: [],
      redoStack: [],
      annotations: {
        id_counters: { marker_seq: 1, region_seq: 1 },
        global_notes: { overall_concept: "editA" },
      },
    };

    let confirmConflictCalled = false;
    const saveAPromise = executeSaveFlow(asyncState, {
      customFetch: stale409Fetch,
      onConfirmConflict: () => {
        confirmConflictCalled = true;
        return false;
      },
    });

    // While Save A is in flight, user reloads and makes a new edit D
    applyServerStateToModel(asyncState, {
      revision: "rev_after_reload",
      analysis: {},
      annotations: {
        id_counters: { marker_seq: 2, region_seq: 1 },
        global_notes: { overall_concept: "reloadedBase" },
      },
      agentBriefMarkdown: "# brief",
    });
    asyncState.editSeq += 1;
    asyncState.annotations.global_notes.overall_concept = "newD";

    // Now the old Save A request resolves with HTTP 409 Conflict!
    resolveStale409Fetch({
      status: 409,
      ok: false,
      json: async () => ({
        error: "revision_conflict",
        latest: {
          revision: "rev_stale_conflict",
          annotations: {
            id_counters: { marker_seq: 1, region_seq: 1 },
            global_notes: { overall_concept: "staleConflictSnapshot" },
          },
        },
      }),
    });

    const saveAOutcome = await saveAPromise;
    assert.equal(saveAOutcome.status, "ignored_stale_epoch");
    assert.equal(confirmConflictCalled, false);
    assert.equal(asyncState.annotations.global_notes.overall_concept, "newD");
    assert.equal(asyncState.revision, "rev_after_reload");

    // 14. Full async test: Edit made while reload GET is in flight must NOT be overwritten, plus out-of-order reloads
    // Reset to clean state
    applyServerStateToModel(asyncState, {
      revision: "rev_clean",
      analysis: {},
      annotations: {
        id_counters: { marker_seq: 2, region_seq: 1 },
        global_notes: { overall_concept: "cleanInitial" },
      },
      agentBriefMarkdown: "# brief",
    });

    let resolveReloadGet;
    const slowReloadFetch = () =>
      new Promise((resolve) => {
        resolveReloadGet = resolve;
      });

    const reloadPromise = executeReloadFlow(asyncState, {
      customFetch: slowReloadFetch,
    });

    // User edits while GET /api/state is still waiting
    asyncState.editSeq += 1;
    asyncState.annotations.global_notes.overall_concept =
      "editedWhileReloadInFlight";

    resolveReloadGet({
      status: 200,
      ok: true,
      json: async () => ({
        revision: "rev_server_snapshot",
        annotations: {
          id_counters: { marker_seq: 2, region_seq: 1 },
          global_notes: { overall_concept: "serverSnapshotShouldNotClobber" },
        },
      }),
    });

    const reloadOutcome = await reloadPromise;
    assert.equal(reloadOutcome.status, "preserved_edit_during_reload");
    assert.equal(
      asyncState.annotations.global_notes.overall_concept,
      "editedWhileReloadInFlight",
    );

    // Also test out-of-order reload responses (Reload 1 vs Reload 2)
    applyServerStateToModel(asyncState, {
      revision: "rev_clean_2",
      analysis: {},
      annotations: {
        id_counters: { marker_seq: 2, region_seq: 1 },
        global_notes: { overall_concept: "clean2" },
      },
    });
    let resolveReload1;
    let resolveReload2;
    const r1Promise = executeReloadFlow(asyncState, {
      customFetch: () =>
        new Promise((r) => {
          resolveReload1 = r;
        }),
    });
    const r2Promise = executeReloadFlow(asyncState, {
      customFetch: () =>
        new Promise((r) => {
          resolveReload2 = r;
        }),
    });

    resolveReload2({
      status: 200,
      ok: true,
      json: async () => ({
        revision: "rev_r2",
        annotations: {
          id_counters: { marker_seq: 5, region_seq: 1 },
          global_notes: { overall_concept: "fromReload2" },
        },
      }),
    });
    const r2Res = await r2Promise;
    assert.equal(r2Res.status, "reloaded");
    assert.equal(
      asyncState.annotations.global_notes.overall_concept,
      "fromReload2",
    );

    resolveReload1({
      status: 200,
      ok: true,
      json: async () => ({
        revision: "rev_r1_stale",
        annotations: {
          id_counters: { marker_seq: 3, region_seq: 1 },
          global_notes: { overall_concept: "fromReload1Stale" },
        },
      }),
    });
    const r1Res = await r1Promise;
    assert.equal(r1Res.status, "ignored_superseded_reload");
    assert.equal(
      asyncState.annotations.global_notes.overall_concept,
      "fromReload2",
    );
    assert.equal(asyncState.revision, "rev_r2");

    // 15. Full async test: 409 -> confirm overwrite -> while forced save is in flight, saveInFlight stays true and concurrent save is queued
    applyServerStateToModel(asyncState, {
      revision: "rev_base_15",
      analysis: {},
      annotations: {
        id_counters: { marker_seq: 1, region_seq: 1 },
        global_notes: { overall_concept: "editFor409Overwrite" },
      },
    });
    asyncState.editSeq += 1;

    let fetchCallCount = 0;
    let resolveInitial409;
    let resolveForced200;
    const overwriteFetch = () => {
      fetchCallCount += 1;
      if (fetchCallCount === 1) {
        return new Promise((r) => {
          resolveInitial409 = r;
        });
      }
      return new Promise((r) => {
        resolveForced200 = r;
      });
    };

    let followUpScheduled = false;
    const overwriteFlowPromise = executeSaveFlow(asyncState, {
      customFetch: overwriteFetch,
      onConfirmConflict: () => true, // Confirm overwrite!
      onScheduleFollowUp: () => {
        followUpScheduled = true;
      },
    });

    // Resolve first request with 409 Conflict -> triggers forced save (request #2)
    resolveInitial409({
      status: 409,
      ok: false,
      json: async () => ({
        error: "revision_conflict",
        latest: {
          revision: "rev_other",
          annotations: {
            id_counters: { marker_seq: 1, region_seq: 1 },
            global_notes: { overall_concept: "other" },
          },
        },
      }),
    });

    // Wait microtask ticks for the 409 handler to invoke the recursive forced save
    for (let i = 0; i < 6; i += 1) {
      await Promise.resolve();
    }
    assert.equal(fetchCallCount, 2);
    assert.equal(asyncState.saveInFlight, true);

    // User edits again and triggers save while forced save (#2) is still in flight
    asyncState.editSeq += 1;
    asyncState.annotations.global_notes.overall_concept =
      "editedDuringForcedSave";
    const concurrentSaveRes = await executeSaveFlow(asyncState, {
      customFetch: overwriteFetch,
    });
    assert.equal(concurrentSaveRes.status, "queued");
    assert.equal(fetchCallCount, 2); // Must NOT have sent a 3rd HTTP request!

    // Now resolve the forced save (#2)
    resolveForced200({
      status: 200,
      ok: true,
      json: async () => ({
        revision: "rev_forced_done",
        agentBriefMarkdown: "# forced brief",
        annotations: {
          id_counters: { marker_seq: 1, region_seq: 1 },
          global_notes: { overall_concept: "editFor409Overwrite" },
        },
      }),
    });

    const finalOverwriteRes = await overwriteFlowPromise;
    assert.equal(finalOverwriteRes.status, "dirty_preserved");
    assert.equal(asyncState.saveInFlight, false);
    assert.equal(followUpScheduled, true);
    assert.equal(
      asyncState.annotations.global_notes.overall_concept,
      "editedDuringForcedSave",
    );

    // 16. Verify @try-me/shared time-mapping across non-zero clipStartSec & positive/negative offsets
    const tl = computePreviewTimeline(
      {
        preview_mapping: { preview_fps: 30, audio_offset_seconds: 0 },
        regions: [
          {
            id: "CLIP_01",
            category: "representative_clip",
            start_sec: 10,
            end_sec: 25,
          },
        ],
      },
      { silentPreview: false, clipDurationSeconds: 15, audioOffsetSeconds: 0 },
    );
    assert.equal(tl.clipStartFrame, 300);
    assert.equal(tl.audioSecToGlobalFrame(12), 360);
    assert.equal(tl.audioSecToVideoFrame(12), 60);
    assert.equal(tl.localFrameToGlobalFrame(60), 360);
    assert.equal(audioSecToGlobalFrame(12, 0, 30), 360);

    // 17. Verify POST /api/lyrics persists local/annotations/lyrics/ files without leaking into preview JSON
    const lyricsSaveRes = await fetch(`${baseUrl}/api/lyrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: [
          {
            id: "L001",
            section_id: "P002",
            bar: 9,
            start_sec: 18.53,
            end_sec: 22.82,
            text: "TEST_PRIVATE_LYRIC_LINE_1",
            status: "confirmed",
          },
        ],
      }),
    });
    assert.equal(lyricsSaveRes.status, 200);
    const lyricsSavedBody = await lyricsSaveRes.json();
    assert.equal(lyricsSavedBody.lyrics.available, true);
    assert.equal(lyricsSavedBody.lyrics.lines.length, 1);
    assert.equal(lyricsSavedBody.lyrics.status, "confirmed");

    const stateAfterLyrics = await (await fetch(`${baseUrl}/api/state`)).json();
    assert.equal(stateAfterLyrics.lyrics.available, true);
    assert.equal(
      stateAfterLyrics.lyrics.lines[0].text,
      "TEST_PRIVATE_LYRIC_LINE_1",
    );
    const previewAfterLyrics = await fsp.readFile(
      fixture.previewJsonFile,
      "utf8",
    );
    assert.ok(!previewAfterLyrics.includes("TEST_PRIVATE_LYRIC_LINE_1"));

    // 18. Verify React 19 + PWA bundle endpoint (/bundle.js, /manifest.webmanifest, /sw.js) and ASS/LRC round-trip
    const bundleRes = await fetch(`${baseUrl}/bundle.js`);
    assert.equal(bundleRes.status, 200);
    const bundleCode = await bundleRes.text();
    assert.ok(bundleCode.includes("TimelineExplorer"));
    assert.ok(bundleCode.includes("LyricsWorkbench"));

    const manifestRes = await fetch(`${baseUrl}/manifest.webmanifest`);
    assert.equal(manifestRes.status, 200);
    assert.ok(
      manifestRes.headers
        .get("content-type")
        ?.includes("application/manifest+json"),
    );

    const assText = exportLyricsToAss([
      {
        id: "L011",
        section_id: "P002",
        bar: 23,
        start_sec: 49.92,
        end_sec: 51.03,
        text: "TEST_ASS_LINE_1",
        status: "confirmed",
        note: "note-1",
      },
      {
        id: "L012",
        section_id: "P002",
        bar: 24,
        start_sec: 51.03,
        end_sec: 54.4,
        text: "TEST_ASS_LINE_2",
        status: "candidate",
        note: "",
      },
    ]);
    assert.ok(assText.includes("Dialogue: 0,0:00:49.92,0:00:51.03,Confirmed,L011"));
    const parsedFromAss = parseAssToLyrics(assText, []);
    assert.equal(parsedFromAss.length, 2);
    assert.equal(parsedFromAss[0].id, "L011");
    assert.equal(parsedFromAss[0].start_sec, 49.92);
    assert.equal(parsedFromAss[0].end_sec, 51.03);
    assert.equal(parsedFromAss[0].status, "confirmed");
    assert.equal(parsedFromAss[1].id, "L012");
    assert.equal(parsedFromAss[1].start_sec, 51.03);

    const lrcText = exportLyricsToLrc(parsedFromAss);
    const parsedFromLrc = parseLrcToLyrics(lrcText, parsedFromAss);
    assert.equal(parsedFromLrc.length, 2);
    assert.equal(parsedFromLrc[0].start_sec, 49.92);
    assert.equal(parsedFromLrc[0].end_sec, 51.03);

    console.log(
      "PASS: All isolated annotation server, concurrency, validation & boundary tests passed!",
    );
  } finally {
    server.close();
    await fsp.rm(fixture.tmpRoot, { recursive: true, force: true });
  }
}

runTests();
