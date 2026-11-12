import {
  applyServerState as applyServerStateImpl,
  reloadAnnotations as reloadAnnotationsImpl,
  saveAnnotations as saveAnnotationsImpl,
  saveLyrics as saveLyricsImpl,
  storeState,
} from "./src/store/workbenchStore.ts";

export const state = storeState;

export async function saveAnnotations(
  force = false,
  customFetch: typeof fetch = fetch,
) {
  return saveAnnotationsImpl(force, customFetch);
}

export async function reloadAnnotations(customFetch: typeof fetch = fetch) {
  return reloadAnnotationsImpl(customFetch);
}

export function applyServerState(
  serverState: Parameters<typeof applyServerStateImpl>[0],
) {
  return applyServerStateImpl(serverState);
}

export async function saveLyrics(customFetch: typeof fetch = fetch) {
  return saveLyricsImpl(customFetch);
}
