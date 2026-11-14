import {
  migrateLegacyToTimelineProject,
  validateAndNormalizeProject,
  type TimelineProject,
} from "./model.ts";
import { useWorkbenchStore } from "./src/store/workbenchStore.ts";

export { useWorkbenchStore };

export function getProjectState(): TimelineProject {
  return useWorkbenchStore.getState().project;
}

export function applyServerState(payload: {
  project?: unknown;
  annotations?: unknown;
  agentBriefMarkdown?: string;
  savedAt?: string;
}): TimelineProject {
  const raw = payload.project ?? payload.annotations ?? payload;
  const project =
    raw && typeof raw === "object" && "version" in (raw as Record<string, unknown>)
      ? validateAndNormalizeProject(raw)
      : migrateLegacyToTimelineProject(raw);
  useWorkbenchStore.getState().hydrate({
    project,
    agentBriefMarkdown: payload.agentBriefMarkdown,
    savedAt: payload.savedAt ?? null,
  });
  return project;
}

export async function reloadAnnotations(
  customFetch: typeof fetch = fetch
): Promise<TimelineProject> {
  const res = await customFetch("/api/annotations");
  if (!res.ok) {
    throw new Error(`Failed to reload annotations: ${res.status}`);
  }
  const body = (await res.json()) as {
    project?: unknown;
    annotations?: unknown;
    agentBriefMarkdown?: string;
    savedAt?: string;
  };
  return applyServerState(body);
}

export async function saveAnnotations(
  customFetch: typeof fetch = fetch
): Promise<TimelineProject> {
  const project = useWorkbenchStore.getState().project;
  const res = await customFetch("/api/annotations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project }),
  });
  const body = (await res.json()) as {
    error?: string;
    project?: unknown;
    annotations?: unknown;
    agentBriefMarkdown?: string;
    savedAt?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? `Failed to save annotations: ${res.status}`);
  }
  return applyServerState(body);
}
