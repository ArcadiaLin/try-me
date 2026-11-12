export function allocateMarkerId(annotations) {
  if (!annotations.id_counters) {
    annotations.id_counters = { marker_seq: 0, region_seq: 0 };
  }
  const used = new Set((annotations.markers || []).map((m) => m.id));
  for (const m of annotations.markers || []) {
    const match = /^M(\d+)$/.exec(m.id);
    if (match) {
      annotations.id_counters.marker_seq = Math.max(
        annotations.id_counters.marker_seq,
        Number.parseInt(match[1], 10),
      );
    }
  }
  while (true) {
    annotations.id_counters.marker_seq += 1;
    const candidate = `M${String(annotations.id_counters.marker_seq).padStart(4, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
}

export function allocateRegionId(annotations) {
  if (!annotations.id_counters) {
    annotations.id_counters = { marker_seq: 0, region_seq: 0 };
  }
  const used = new Set((annotations.regions || []).map((r) => r.id));
  for (const r of annotations.regions || []) {
    const match = /^P(\d+)$/.exec(r.id);
    if (match) {
      annotations.id_counters.region_seq = Math.max(
        annotations.id_counters.region_seq,
        Number.parseInt(match[1], 10),
      );
    }
  }
  while (true) {
    annotations.id_counters.region_seq += 1;
    const candidate = `P${String(annotations.id_counters.region_seq).padStart(3, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
}

/**
 * Apply loaded or reloaded server state to client state:
 * - Advances loadEpoch so any in-flight save from before reload is ignored
 * - Monotonically advances editSeq and syncs savedSeq = editSeq
 * - Clears undoStack, redoStack, and pendingSaveForce
 */
export function applyServerStateToModel(clientState, serverState) {
  clientState.loadEpoch = (clientState.loadEpoch || 0) + 1;
  clientState.editSeq = (clientState.editSeq || 0) + 1;
  clientState.savedSeq = clientState.editSeq;
  clientState.saveInFlight = false;
  clientState.activeSaveId = 0;
  clientState.revision = serverState.revision;
  clientState.analysis = serverState.analysis;
  clientState.annotations = serverState.annotations;
  clientState.agentBriefMarkdown = serverState.agentBriefMarkdown || "";
  clientState.audioHashMismatch = Boolean(serverState.audioHashMismatch);
  clientState.undoStack = [];
  clientState.redoStack = [];
  clientState.pendingSaveForce = null;
}

/**
 * Pure helper to apply a save response to client state without clobbering
 * newer in-memory edits or a newer reload epoch made while the HTTP request was in flight.
 */
export function reconcileSaveResponse(
  clientState,
  snapshotEpoch,
  snapshotSeq,
  serverResponse,
) {
  if ((clientState.loadEpoch || 0) !== snapshotEpoch) {
    return { status: "ignored_stale_epoch", needsFollowUpSave: false };
  }

  clientState.revision = serverResponse.revision;
  clientState.agentBriefMarkdown = serverResponse.agentBriefMarkdown;

  if (clientState.editSeq === snapshotSeq) {
    clientState.annotations = serverResponse.annotations;
    clientState.savedSeq = snapshotSeq;
    return { status: "clean", needsFollowUpSave: false };
  }

  // Newer local edits occurred while save was in flight: preserve clientState.annotations!
  clientState.annotations.id_counters = {
    marker_seq: Math.max(
      clientState.annotations.id_counters?.marker_seq || 0,
      serverResponse.annotations.id_counters?.marker_seq || 0,
    ),
    region_seq: Math.max(
      clientState.annotations.id_counters?.region_seq || 0,
      serverResponse.annotations.id_counters?.region_seq || 0,
    ),
  };
  return { status: "dirty_preserved", needsFollowUpSave: true };
}

/**
 * Full async save flow with epoch isolation on every response branch (200, 409, 4xx/5xx, catch, finally).
 */
export async function executeSaveFlow(
  clientState,
  {
    force = false,
    customFetch = fetch,
    onStatus = () => {},
    onAlert = () => {},
    onConfirmConflict = () => false,
    onApplyServerState = (s) => applyServerStateToModel(clientState, s),
    onBriefUpdated = () => {},
    onScheduleFollowUp = () => {},
  } = {},
) {
  if (!clientState.annotations) {
    return { status: "noop" };
  }
  if (clientState.saveInFlight) {
    clientState.pendingSaveForce = Boolean(
      clientState.pendingSaveForce || force,
    );
    return { status: "queued" };
  }

  const saveId = (clientState.saveRequestSeq =
    (clientState.saveRequestSeq || 0) + 1);
  clientState.activeSaveId = saveId;
  clientState.saveInFlight = true;
  const snapshotEpoch = clientState.loadEpoch || 0;
  const snapshotSeq = clientState.editSeq || 0;
  const snapshotPayload = structuredClone(clientState.annotations);
  let shouldFollowUpSave = false;
  onStatus("保存中...", false);

  try {
    const res = await customFetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_revision: clientState.revision,
        force,
        annotations: snapshotPayload,
      }),
    });

    if (
      (clientState.loadEpoch || 0) !== snapshotEpoch ||
      clientState.activeSaveId !== saveId
    ) {
      return { status: "ignored_stale_epoch" };
    }

    if (res.status === 409) {
      const conflict = await res.json();
      if (
        (clientState.loadEpoch || 0) !== snapshotEpoch ||
        clientState.activeSaveId !== saveId
      ) {
        return { status: "ignored_stale_epoch" };
      }

      if (conflict.error === "audio_hash_mismatch") {
        clientState.saveInFlight = false;
        clientState.pendingSaveForce = null;
        onStatus("拒绝保存: 音源哈希不匹配", true);
        onAlert(conflict.message);
        return { status: "audio_hash_mismatch" };
      }

      const overwrite = Boolean(onConfirmConflict(conflict));
      if (
        (clientState.loadEpoch || 0) !== snapshotEpoch ||
        clientState.activeSaveId !== saveId
      ) {
        return { status: "ignored_stale_epoch" };
      }

      if (overwrite) {
        clientState.saveInFlight = false;
        return await executeSaveFlow(clientState, {
          force: true,
          customFetch,
          onStatus,
          onAlert,
          onConfirmConflict,
          onApplyServerState,
          onBriefUpdated,
          onScheduleFollowUp,
        });
      }
      clientState.saveInFlight = false;
      clientState.pendingSaveForce = null;
      if (conflict.latest) {
        onApplyServerState(conflict.latest);
        onStatus("已载入外部更新", false);
        return { status: "conflict_reloaded" };
      }
      return { status: "conflict_cancelled" };
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      if (
        (clientState.loadEpoch || 0) !== snapshotEpoch ||
        clientState.activeSaveId !== saveId
      ) {
        return { status: "ignored_stale_epoch" };
      }
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    if (
      (clientState.loadEpoch || 0) !== snapshotEpoch ||
      clientState.activeSaveId !== saveId
    ) {
      return { status: "ignored_stale_epoch" };
    }

    const outcome = reconcileSaveResponse(
      clientState,
      snapshotEpoch,
      snapshotSeq,
      data,
    );
    if (outcome.status === "ignored_stale_epoch") {
      return { status: "ignored_stale_epoch" };
    }

    onBriefUpdated(clientState.agentBriefMarkdown);

    if (outcome.status === "clean") {
      onStatus("✓ 已保存", false);
      shouldFollowUpSave = clientState.pendingSaveForce !== null;
      return { status: "clean" };
    }

    shouldFollowUpSave = true;
    onStatus("保存跟进中...", false);
    return { status: "dirty_preserved" };
  } catch (err) {
    if (
      (clientState.loadEpoch || 0) !== snapshotEpoch ||
      clientState.activeSaveId !== saveId
    ) {
      return { status: "ignored_stale_epoch" };
    }
    clientState.pendingSaveForce = null;
    onStatus(`保存失败: ${err.message}`, true);
    return { status: "error", error: err.message };
  } finally {
    if (
      (clientState.loadEpoch || 0) === snapshotEpoch &&
      clientState.activeSaveId === saveId
    ) {
      clientState.saveInFlight = false;
      if (shouldFollowUpSave) {
        const nextForce = Boolean(clientState.pendingSaveForce);
        clientState.pendingSaveForce = null;
        onScheduleFollowUp(nextForce);
      }
    }
  }
}

/**
 * Full async reload flow that:
 * - Prompts if dirty before fetching
 * - Advances loadEpoch immediately on start so in-flight saves from before reload are fenced off
 * - Guards against out-of-order reload responses via reloadRequestSeq
 * - Checks editSeq on response arrival so edits made while GET /api/state was in flight are never overwritten
 */
export async function executeReloadFlow(
  clientState,
  {
    customFetch = fetch,
    onConfirmDirty = () => false,
    onClearTimer = () => {},
    onStatus = () => {},
    onApplyServerState = (s) => applyServerStateToModel(clientState, s),
  } = {},
) {
  if ((clientState.editSeq || 0) !== (clientState.savedSeq || 0)) {
    const ok = Boolean(onConfirmDirty());
    if (!ok) {
      return { status: "cancelled_dirty" };
    }
  }

  onClearTimer();
  clientState.reloadRequestSeq = (clientState.reloadRequestSeq || 0) + 1;
  const requestSeq = clientState.reloadRequestSeq;

  // Fence off any prior in-flight save immediately when reload starts
  clientState.loadEpoch = (clientState.loadEpoch || 0) + 1;
  clientState.saveInFlight = false;
  clientState.activeSaveId = 0;
  clientState.pendingSaveForce = null;

  const snapshotEpoch = clientState.loadEpoch;
  const snapshotEditSeq = clientState.editSeq || 0;

  try {
    const res = await customFetch("/api/state");
    if (
      clientState.reloadRequestSeq !== requestSeq ||
      (clientState.loadEpoch || 0) !== snapshotEpoch
    ) {
      return { status: "ignored_superseded_reload" };
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      if (
        clientState.reloadRequestSeq !== requestSeq ||
        (clientState.loadEpoch || 0) !== snapshotEpoch
      ) {
        return { status: "ignored_superseded_reload" };
      }
      onStatus(`重载失败: ${errBody.error || res.status}`, true);
      return { status: "error" };
    }

    const latest = await res.json();
    if (
      clientState.reloadRequestSeq !== requestSeq ||
      (clientState.loadEpoch || 0) !== snapshotEpoch
    ) {
      return { status: "ignored_superseded_reload" };
    }

    if ((clientState.editSeq || 0) !== snapshotEditSeq) {
      onStatus("重载已取消：请求等待期间有新编辑，已保留当前修改", true);
      return { status: "preserved_edit_during_reload" };
    }

    onApplyServerState(latest);
    if (!clientState.audioHashMismatch) {
      onStatus("已重载最新数据", false);
    }
    return { status: "reloaded" };
  } catch (err) {
    if (
      clientState.reloadRequestSeq !== requestSeq ||
      (clientState.loadEpoch || 0) !== snapshotEpoch
    ) {
      return { status: "ignored_superseded_reload" };
    }
    onStatus(`重载失败: ${err.message}`, true);
    return { status: "error", error: err.message };
  }
}

export function applyCandidateProvenance(
  marker,
  candidate,
  analysisSummary,
  fallbackAudioAsset = null,
) {
  if (!candidate) {
    clearCandidateProvenance(marker);
    return marker;
  }
  marker.origin_candidate_id = candidate.id || null;
  marker.origin_analysis_run_id =
    analysisSummary?.analysis_run_id ||
    fallbackAudioAsset?.analysis_run_id ||
    null;
  marker.origin_analysis_sha256 =
    analysisSummary?.input_audio?.sha256 || fallbackAudioAsset?.sha256 || null;
  marker.origin_candidate_time_sec =
    candidate.time_sec !== undefined && candidate.time_sec !== null
      ? Number(candidate.time_sec)
      : null;
  marker.origin_candidate_sample_index =
    candidate.sample_index !== undefined && candidate.sample_index !== null
      ? Number(candidate.sample_index)
      : null;
  return marker;
}

export function clearCandidateProvenance(marker) {
  marker.origin_candidate_id = null;
  marker.origin_analysis_run_id = null;
  marker.origin_analysis_sha256 = null;
  marker.origin_candidate_time_sec = null;
  marker.origin_candidate_sample_index = null;
  return marker;
}
