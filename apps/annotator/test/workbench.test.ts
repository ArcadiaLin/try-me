import test from "node:test";
import assert from "node:assert/strict";
import { useWorkbenchStore as store } from "../web/src/store/workbenchStore.ts";
import { connectAudioTransport } from "../web/src/utils/audio-transport.ts";
import type { TimelineProject } from "../web/src/types.ts";
import { findEventByRef, generateAgentBriefMarkdown, validateAndNormalizeProject } from "../web/model.ts";

const a = { trackId: "track", eventId: "A" };
const b = { trackId: "track", eventId: "B" };

test("manual playhead seek preserves sentence loop, selection, annotations and paused/playing state", () => {
  const { audio, controller, state } = setup();
  try {
    state().selectEvent(a);
    state().loopCurrentEvent();
    const project = JSON.stringify(state().project);
    const selected = structuredClone(state().view.selection);
    controller.seekTo(2.2);
    assert.equal(audio.currentTime, 2.2);
    controller.tick();
    assert.equal(audio.currentTime, 2.2);
    assert.deepEqual(state().transport.loopRange, [1, 3]);
    assert.equal(audio.paused, false);
    audio.currentTime = 3.1; controller.tick();
    assert.equal(audio.currentTime, 1);
    state().setIsPlaying(false);
    controller.seekTo(2.6);
    assert.equal(audio.currentTime, 2.6);
    assert.equal(audio.paused, true);
    assert.deepEqual(state().view.selection, selected);
    assert.equal(JSON.stringify(state().project), project);
    assert.deepEqual(state().transport.loopRange, [1, 3]);
  } finally { controller.dispose(); }
});

test("manual seek cancels an old short audition and clamps media/store to the same position", () => {
  const { audio, controller, state } = setup();
  try {
    state().selectEvent(a); state().loopCurrentEvent();
    controller.setAuditionEnd(1.5);
    controller.seekTo(2);
    audio.currentTime = 2.1; controller.tick();
    assert.equal(audio.paused, false);
    assert.equal(state().transport.currentTimeSec, 2.1);
    controller.seekTo(-2); assert.equal(audio.currentTime, 0);
    controller.seekTo(1e6); assert.equal(audio.currentTime, state().transport.currentTimeSec);
    const position = audio.currentTime;
    controller.seekTo(Number.NaN); assert.equal(audio.currentTime, position);
  } finally { controller.dispose(); }
});
function setup() {
  const project: TimelineProject = { version: 1, name: "isolated", nodes: [
    { kind: "timeline", id: "track", name: "Track", items: [
      { id: "A", startSec: 1, endSec: 3, text: "first" },
      { id: "B", startSec: 4, endSec: 6, text: "second" },
      { id: "C", startSec: 7, text: "point" },
    ] },
    { kind: "timeline", id: "other", name: "Other", items: [
      { id: "D", startSec: 8, endSec: 9, text: "other" },
    ] },
  ] };
  store.getState().hydrate({ project });
  store.getState().setIsPlaying(false);
  store.getState().setCurrentTimeSec(1);
  const audio = { currentTime: 1, paused: true, playCalls: 0,
    play() { this.paused = false; this.playCalls++; return Promise.resolve(); },
    pause() { this.paused = true; } };
  const controller = connectAudioTransport(audio, store);
  return { audio, controller, state: store.getState };
}

test("loop reads edited boundaries, preserves position inside and follows undo/redo", () => {
  const { audio, controller, state } = setup();
  try {
    state().loopCurrentEvent();
    audio.currentTime = 2;
    state().runWorkbenchCommand({ type: "setBoundary", ref: a, edge: "end", timeSec: 3.5 });
    assert.equal(audio.currentTime, 2);
    assert.deepEqual(state().transport.loopRange, [1, 3.5]);
    audio.currentTime = 3.1; controller.tick();
    assert.equal(audio.currentTime, 3.1);
    audio.currentTime = 3.51; controller.tick();
    assert.equal(audio.currentTime, 1);
    state().undo(); assert.deepEqual(state().transport.loopRange, [1, 3]);
    state().redo(); assert.deepEqual(state().transport.loopRange, [1, 3.5]);
  } finally { controller.dispose(); }
});

test("shrinking past the playhead restarts once; paused edits never start playback", () => {
  const { audio, controller, state } = setup();
  try {
    state().loopCurrentEvent(); audio.currentTime = 2.8;
    state().runWorkbenchCommand({ type: "setBoundary", ref: a, edge: "end", timeSec: 2.5 });
    assert.equal(audio.currentTime, 1);
    state().setIsPlaying(false);
    const calls = audio.playCalls;
    state().runWorkbenchCommand({ type: "setBoundary", ref: a, edge: "start", timeSec: 1.5 });
    assert.equal(audio.paused, true); assert.equal(audio.playCalls, calls);
    assert.deepEqual(state().transport.loopRange, [1.5, 2.5]);
  } finally { controller.dispose(); }
});

test("next and double-click requests preserve editing, playback and loop until confirmed", () => {
  const { audio, controller, state } = setup();
  try {
    state().runWorkbenchCommand({ type: "update", ref: a, patch: { text: "edited" } });
    state().loopCurrentEvent(); audio.currentTime = 2;
    state().selectNextEvent();
    assert.deepEqual(state().view.selection.primary, a);
    assert.deepEqual(state().transport.loopRange, [1, 3]);
    assert.equal(audio.currentTime, 2);
    state().cancelEventSwitch(); assert.equal(state().pendingEventSwitch, null);
    assert.equal(state().selectEvent(b, false, true), false);
    state().confirmEventSwitch();
    assert.deepEqual(state().view.selection.primary, b);
    assert.deepEqual(state().transport.loopRange, [4, 6]);
    assert.equal(audio.currentTime, 4); assert.equal(audio.paused, false);
    assert.equal(state().persistence.dirty, true);
  } finally { controller.dispose(); }
});

test("plain confirmation while paused stays paused and cross-track navigation is guarded", () => {
  const { audio, controller, state } = setup();
  try {
    state().runWorkbenchCommand({ type: "update", ref: a, patch: { text: "edited" } });
    state().selectNode("other");
    assert.deepEqual(state().view.selection.primary, a);
    state().confirmEventSwitch();
    assert.equal(state().view.selection.primary?.eventId, "D");
    assert.equal(audio.currentTime, 8); assert.equal(audio.paused, true);
  } finally { controller.dispose(); }
});

test("latest target wins; shift selection is applied only after confirmation", () => {
  const { controller, state } = setup();
  try {
    state().runWorkbenchCommand({ type: "update", ref: a, patch: { text: "edited" } });
    state().selectEvent(b);
    state().selectEvent({ trackId: "track", eventId: "C" }, true);
    assert.deepEqual(state().view.selection.selected, [a]);
    state().confirmEventSwitch();
    assert.equal(state().view.selection.primary?.eventId, "C");
    assert.equal(state().view.selection.selected.length, 3);
  } finally { controller.dispose(); }
});

test("deleted pending targets are cleared and point conversion disables stale loops", () => {
  const { controller, state } = setup();
  try {
    state().runWorkbenchCommand({ type: "update", ref: a, patch: { text: "edited" } });
    state().loopCurrentEvent(); state().selectEvent(b);
    state().runWorkbenchCommand({ type: "delete", refs: [b] });
    assert.equal(state().pendingEventSwitch, null);
    state().runWorkbenchCommand({ type: "update", ref: a, patch: { endSec: null } });
    assert.equal(state().transport.loopEnabled, false);
    assert.equal(state().transport.loopRange, null);
  } finally { controller.dispose(); }
});

test("unchanged sentences jump immediately and transfer the active loop", () => {
  const { audio, controller, state } = setup();
  try {
    state().loopCurrentEvent(); audio.currentTime = 2;
    assert.equal(state().hasCurrentEventChanges(), false);
    assert.equal(state().selectEvent(b), true);
    assert.equal(state().pendingEventSwitch, null);
    assert.deepEqual(state().view.selection.primary, b);
    assert.deepEqual(state().transport.loopRange, [4, 6]);
    assert.equal(audio.currentTime, 4);
    assert.equal(audio.paused, false);
    // Switching to a point disables the old range, and still needs no confirmation.
    state().selectNextEvent();
    assert.equal(state().view.selection.primary?.eventId, "C");
    assert.equal(state().transport.loopEnabled, false);
  } finally { controller.dispose(); }
});

test("unrelated dirty state and no-op edits do not trigger confirmation", () => {
  const { audio, controller, state } = setup();
  try {
    state().setPersistence({ dirty: true });
    state().runWorkbenchCommand({ type: "setBoundary", ref: a, edge: "start", timeSec: 1 });
    assert.equal(state().hasCurrentEventChanges(), false);
    state().selectNode("other");
    assert.equal(state().view.selection.primary?.eventId, "D");
    assert.equal(state().pendingEventSwitch, null);
    assert.equal(audio.paused, true);
    assert.equal(audio.currentTime, 8);
  } finally { controller.dispose(); }
});

test("undoing or manually reverting to entry values allows direct navigation", () => {
  const { controller, state } = setup();
  try {
    state().runWorkbenchCommand({ type: "setBoundary", ref: a, edge: "end", timeSec: 3.5 });
    assert.equal(state().hasCurrentEventChanges(), true);
    state().undo();
    assert.equal(state().hasCurrentEventChanges(), false);
    state().redo();
    assert.equal(state().hasCurrentEventChanges(), true);
    state().runWorkbenchCommand({ type: "setBoundary", ref: a, edge: "end", timeSec: 3 });
    assert.equal(state().hasCurrentEventChanges(), false);
    assert.equal(state().selectEvent(b), true);
    // The new sentence receives its own baseline despite an unsaved project.
    assert.equal(state().hasCurrentEventChanges(), false);
    assert.equal(state().selectEvent(a), true);
  } finally { controller.dispose(); }
});

test("uncommitted time inputs and changed color previews require confirmation; cancelled previews do not", () => {
  const { controller, state } = setup();
  try {
    state().setEventDraftDirty(true);
    assert.equal(state().selectEvent(b), false);
    state().cancelEventSwitch();
    state().setEventDraftDirty(false);
    state().startColorDraft({ kind: "event", ref: a });
    assert.equal(state().hasCurrentEventChanges(), false);
    state().updateColorDraft("#ff0000");
    assert.equal(state().selectEvent(b), false);
    state().cancelEventSwitch();
    state().cancelColorDraft();
    assert.equal(state().selectEvent(b), true);
  } finally { controller.dispose(); }
});

test("confirming changes establishes a fresh baseline without saving or discarding applied edits", () => {
  const { controller, state } = setup();
  try {
    state().runWorkbenchCommand({ type: "appendComment", target: { scope: "event", ref: a }, comment: { role: "human", text: "review" } });
    assert.equal(state().selectEvent(b), false);
    state().confirmEventSwitch();
    assert.equal(state().hasCurrentEventChanges(), false);
    assert.equal(state().persistence.dirty, true);
    assert.equal(state().project.nodes[0].kind === "timeline" && state().project.nodes[0].items[0].comments?.[0].text, "review");
    assert.equal(state().selectEvent(a), true);
    assert.equal(state().hasCurrentEventChanges(), false);
  } finally { controller.dispose(); }
});

test("short audition ignores loop bounds and old audition stops cannot truncate an edited loop", () => {
  const { audio, controller, state } = setup();
  try {
    state().loopCurrentEvent(); controller.setAuditionEnd(3.5);
    audio.currentTime = 3.2; controller.tick();
    assert.equal(audio.currentTime, 3.2);
    audio.currentTime = 3.6; controller.tick();
    assert.equal(audio.paused, true); assert.equal(audio.currentTime, 3.5);
    state().loopCurrentEvent(); controller.setAuditionEnd(3);
    state().runWorkbenchCommand({ type: "setBoundary", ref: a, edge: "end", timeSec: 3.8 });
    audio.currentTime = 3.2; controller.tick();
    assert.equal(audio.paused, false); assert.equal(audio.currentTime, 3.2);
  } finally { controller.dispose(); }
});

test("moving the active event is a change, including redo; undo restores its original baseline", () => {
  const { controller, state } = setup();
  try {
    state().moveEventToAnotherTrack(a, "other");
    assert.equal(state().hasCurrentEventChanges(), true);
    state().undo();
    assert.equal(state().hasCurrentEventChanges(), false);
    state().redo();
    assert.equal(state().hasCurrentEventChanges(), true);
    assert.equal(state().selectEvent(b), false);
  } finally { controller.dispose(); }
});

test("script editing preserves multiline whitespace, empty entries, roles and sibling notes", () => {
  const { controller, state } = setup();
  try {
    const original = [
      { role: "human" as const, text: "first draft" },
      { role: "agent" as const, text: "agent response" },
    ];
    state().runWorkbenchCommand({ type: "update", ref: a, patch: { comments: original } });
    const script = "  开场 opening\n\n    向左移动 move left →\n  ";
    const edited = [{ ...original[0], text: script }, original[1]];
    state().runWorkbenchCommand({ type: "update", ref: a, patch: { comments: edited } });
    const normalized = validateAndNormalizeProject(JSON.parse(JSON.stringify(state().project)));
    assert.deepEqual(findEventByRef(normalized, a)?.event.comments, edited);
    assert.equal(state().selectEvent(b), false);
    state().cancelEventSwitch();
    const cleared = [{ ...edited[0], text: "" }, edited[1]];
    state().runWorkbenchCommand({ type: "update", ref: a, patch: { comments: cleared } });
    assert.deepEqual(findEventByRef(state().project, a)?.event.comments, cleared);
    state().undo();
    assert.deepEqual(findEventByRef(state().project, a)?.event.comments, edited);
    state().runWorkbenchCommand({ type: "update", ref: a, patch: { comments: [edited[1]] } });
    assert.deepEqual(findEventByRef(state().project, a)?.event.comments, [edited[1]]);
  } finally { controller.dispose(); }
});

test("locked script edits are rejected without losing notes", () => {
  const { controller, state } = setup();
  try {
    state().runWorkbenchCommand({ type: "update", ref: a, patch: {
      comments: [{ role: "human", text: "keep this script\n    action" }],
    } });
    const before = JSON.stringify(state().project);
    state().toggleNodeLocked("track");
    state().runWorkbenchCommand({ type: "update", ref: a, patch: { comments: [] } });
    assert.equal(JSON.stringify(state().project), before);
    assert.ok(state().persistence.errorMessage);
  } finally { controller.dispose(); }
});

test("multiline script brief keeps list continuations and escapes table separators", () => {
  const project: TimelineProject = { version: 1, name: "synthetic", nodes: [
    { kind: "timeline", id: "trk_song_parts", name: "Structure", items: [
      { id: "P1", startSec: 1, endSec: 3, text: "part", comments: [
        { role: "human", text: "opening | close\n    move left\n" },
      ] },
    ] },
  ] };
  const brief = generateAgentBriefMarkdown(project);
  assert.ok(brief.includes("opening \\| close<br>    move left<br>"));
  assert.ok(brief.includes("opening | close\n      move left\n  "));
});
