import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

import {
  buildSanitizedPreviewPayload,
  createEmptyProject,
  findTrackById,
  generateAgentBriefMarkdown,
  migrateLegacyToTimelineProject,
  validateAndNormalizeProject,
  type TimelineProject,
} from "../web/model.ts";
import { exportEventsToAss, exportEventsToLrc } from "../web/src/utils/ass-lrc.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");

const AUDIO_FILE_PATH = path.join(REPO_ROOT, "public/private/audio/try-me.flac");
const SUMMARY_FILE_PATH = path.join(REPO_ROOT, "local/analysis/summary.json");
const BEATS_FILE_PATH = path.join(REPO_ROOT, "local/analysis/beats.json");
const SECTIONS_FILE_PATH = path.join(REPO_ROOT, "local/analysis/try-me.sections.json");
const WAVEFORM_FILE_PATH = path.join(REPO_ROOT, "local/analysis/waveform.json");

// Git-tracked unified timeline & brief
const UNIFIED_TIMELINE_PATH = path.join(REPO_ROOT, "annotations/try-me.timeline.json");
const UNIFIED_BRIEF_PATH = path.join(REPO_ROOT, "annotations/agent-brief.md");

const WEB_STATIC_DIR = path.join(__dirname, "../web");
const DIST_WEB_DIR = path.join(__dirname, "../dist/web");

function readJsonIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function getKnownAudioDurationSec(): number | undefined {
  const summary = readJsonIfExists<{ audio_file?: { duration_sec?: number } }>(SUMMARY_FILE_PATH);
  const dur = summary?.audio_file?.duration_sec;
  return typeof dur === "number" && Number.isFinite(dur) ? dur : undefined;
}

export function normalizeTimelineProjectInput(
  raw: unknown,
  maxDurationSec?: number
): TimelineProject {
  if (!raw || typeof raw !== "object") {
    throw new Error("Payload must be a JSON object");
  }
  const obj = raw as Record<string, unknown>;
  // If `version` or `nodes` is present, strictly validate as v5 `TimelineProject` (`version: 1`)
  if ("version" in obj || "nodes" in obj) {
    return validateAndNormalizeProject(obj, maxDurationSec);
  }
  // Otherwise allow migrating legacy v0.1.0 / v0.2.0 document
  return migrateLegacyToTimelineProject(obj, maxDurationSec);
}

export function loadOrInitializeProject(repoRoot = REPO_ROOT): {
  project: TimelineProject;
  agentBriefMarkdown: string;
} {
  const timelinePath = path.join(repoRoot, "annotations/try-me.timeline.json");
  const backupPath = path.join(repoRoot, "local/annotations/annotations.json");
  const summaryPath = path.join(repoRoot, "local/analysis/try-me.summary.json");
  const summary = readJsonIfExists<{ audio_file?: { duration_sec?: number } }>(summaryPath);
  const maxDurationSec = summary?.audio_file?.duration_sec;

  const rawPrimary = readJsonIfExists<unknown>(timelinePath);
  if (rawPrimary) {
    const project = normalizeTimelineProjectInput(rawPrimary, maxDurationSec);
    return {
      project,
      agentBriefMarkdown: generateAgentBriefMarkdown(project),
    };
  }

  const rawBackup = readJsonIfExists<unknown>(backupPath);
  if (rawBackup) {
    const project = normalizeTimelineProjectInput(rawBackup, maxDurationSec);
    return {
      project,
      agentBriefMarkdown: generateAgentBriefMarkdown(project),
    };
  }

  const empty = createEmptyProject();
  return {
    project: empty,
    agentBriefMarkdown: generateAgentBriefMarkdown(empty),
  };
}

export function persistProjectArtifacts(
  project: TimelineProject,
  repoRoot = REPO_ROOT
): {
  project: TimelineProject;
  agentBriefMarkdown: string;
  savedAt: string;
} {
  const timelinePath = path.join(repoRoot, "annotations/try-me.timeline.json");
  const briefPath = path.join(repoRoot, "annotations/agent-brief.md");
  const localBackupPath = path.join(repoRoot, "local/annotations/annotations.json");
  const localBriefPath = path.join(repoRoot, "local/annotations/agent-brief.md");
  const assPath = path.join(repoRoot, "local/annotations/lyrics/try-me.ass");
  const lrcPath = path.join(repoRoot, "local/annotations/lyrics/try-me.lrc");
  const previewPath = path.join(repoRoot, "public/private/annotations-preview.json");

  fs.mkdirSync(path.dirname(timelinePath), { recursive: true });
  fs.mkdirSync(path.dirname(localBackupPath), { recursive: true });
  fs.mkdirSync(path.dirname(assPath), { recursive: true });
  fs.mkdirSync(path.dirname(previewPath), { recursive: true });

  const serializedProject = JSON.stringify(project, null, 2) + "\n";
  fs.writeFileSync(timelinePath, serializedProject, "utf-8");
  fs.writeFileSync(localBackupPath, serializedProject, "utf-8");

  const agentBriefMarkdown = generateAgentBriefMarkdown(project);
  fs.writeFileSync(briefPath, agentBriefMarkdown, "utf-8");
  fs.writeFileSync(localBriefPath, agentBriefMarkdown, "utf-8");

  const lyricsTrack = findTrackById(project.nodes, "trk_lyrics");
  const lyricItems = lyricsTrack?.items ?? [];
  fs.writeFileSync(assPath, exportEventsToAss(lyricItems), "utf-8");
  fs.writeFileSync(lrcPath, exportEventsToLrc(lyricItems), "utf-8");

  const previewPayload = buildSanitizedPreviewPayload(project);
  fs.writeFileSync(previewPath, JSON.stringify(previewPayload, null, 2) + "\n", "utf-8");

  return {
    project,
    agentBriefMarkdown,
    savedAt: new Date().toISOString(),
  };
}

export { buildSanitizedPreviewPayload, generateAgentBriefMarkdown };

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendError(res: http.ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

function serveAudioWithRange(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (!fs.existsSync(AUDIO_FILE_PATH)) {
    sendError(
      res,
      404,
      "Missing audio file public/private/audio/try-me.flac. Ensure the private audio asset exists."
    );
    return;
  }

  const stat = fs.statSync(AUDIO_FILE_PATH);
  const total = stat.size;
  const range = req.headers.range;

  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    if (!match) {
      res.writeHead(416, { "Content-Range": `bytes */${total}` });
      res.end();
      return;
    }
    const start = match[1] ? Number.parseInt(match[1], 10) : 0;
    const end = match[2] ? Number.parseInt(match[2], 10) : total - 1;
    if (start >= total || end >= total || start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${total}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
      "Content-Length": end - start + 1,
      "Content-Type": "audio/flac",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(AUDIO_FILE_PATH, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    "Content-Length": total,
    "Accept-Ranges": "bytes",
    "Content-Type": "audio/flac",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(AUDIO_FILE_PATH).pipe(res);
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

export function createAnnotatorServer(): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");

      if (req.method === "GET" && url.pathname === "/api/analysis") {
        const summary = readJsonIfExists<Record<string, unknown>>(SUMMARY_FILE_PATH);
        const beats = readJsonIfExists<Record<string, unknown>>(BEATS_FILE_PATH);
        const sections = readJsonIfExists<Record<string, unknown>>(SECTIONS_FILE_PATH);
        const waveform = readJsonIfExists<Record<string, unknown>>(WAVEFORM_FILE_PATH);

        const normalizedSummary = summary ? { ...summary, audio_file: summary.input_audio } : null;
        if (!summary || !beats || !sections || !waveform) {
          sendJson(res, 200, {
            summary: normalizedSummary ?? {
              schema_version: "0.1.0",
              audio_file: {
                path: "public/private/audio/try-me.flac",
                duration_sec: 205.533,
              },
            },
            beats: beats ?? { candidates: [], downbeat_candidates: [] },
            sections: sections ?? { candidates: [], inspect_clips: [] },
            waveform: waveform ?? {
              duration_sec: 205.533,
              bins_per_sec: 50,
              bins: [],
            },
          });
          return;
        }

        sendJson(res, 200, { summary: normalizedSummary, beats, sections, waveform });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/annotations") {
        const { project, agentBriefMarkdown } = loadOrInitializeProject();
        if (!fs.existsSync(UNIFIED_TIMELINE_PATH) || !fs.existsSync(UNIFIED_BRIEF_PATH)) {
          persistProjectArtifacts(project);
        }
        sendJson(res, 200, {
          project,
          annotations: project,
          agentBriefMarkdown,
          savedAt: new Date().toISOString(),
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/annotations") {
        const rawBody = await readRequestBody(req);
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          sendError(res, 400, "Invalid JSON body");
          return;
        }

        const candidatePayload =
          parsed.project && typeof parsed.project === "object"
            ? parsed.project
            : parsed.annotations && typeof parsed.annotations === "object"
              ? parsed.annotations
              : parsed;

        const maxDurationSec = getKnownAudioDurationSec();
        let validatedProject: TimelineProject;
        try {
          validatedProject = normalizeTimelineProjectInput(candidatePayload, maxDurationSec);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          sendError(res, 400, msg);
          return;
        }

        const saved = persistProjectArtifacts(validatedProject);
        sendJson(res, 200, {
          ok: true,
          project: saved.project,
          annotations: saved.project,
          agentBriefMarkdown: saved.agentBriefMarkdown,
          savedAt: saved.savedAt,
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/audio") {
        serveAudioWithRange(req, res);
        return;
      }

      if (req.method === "GET" && url.pathname === "/bundle.js") {
        const entryPoint = path.join(WEB_STATIC_DIR, "src/main.tsx");
        const result = await esbuild.build({
          entryPoints: [entryPoint],
          bundle: true,
          write: false,
          format: "esm",
          target: "es2022",
          jsx: "automatic",
          sourcemap: "inline",
          absWorkingDir: REPO_ROOT,
        });
        const jsOut = result.outputFiles?.[0]?.text ?? "";
        res.writeHead(200, {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(jsOut, "utf-8");
        return;
      }

      if (req.method === "GET") {
        const relativePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
        const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");

        for (const baseDir of [WEB_STATIC_DIR, DIST_WEB_DIR]) {
          const candidate = path.join(baseDir, safePath);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            res.writeHead(200, {
              "Content-Type": getMimeType(candidate),
              "Cache-Control": "no-store",
            });
            fs.createReadStream(candidate).pipe(res);
            return;
          }
        }

        const indexFallback = path.join(WEB_STATIC_DIR, "index.html");
        if (fs.existsSync(indexFallback)) {
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          });
          fs.createReadStream(indexFallback).pipe(res);
          return;
        }
      }

      sendError(res, 404, `Not found: ${url.pathname}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendError(res, 500, message);
    }
  });
}

export const createAnnotationServer = createAnnotatorServer;

const isMain =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const portArgIdx = process.argv.indexOf("--port");
  const port =
    portArgIdx !== -1 && process.argv[portArgIdx + 1]
      ? Number(process.argv[portArgIdx + 1])
      : Number(process.env.ANNOTATOR_PORT ?? process.env.PORT ?? 4321);
  const host = process.env.ANNOTATOR_HOST ?? "127.0.0.1";
  const server = createAnnotatorServer();
  server.listen(port, host, () => {
    console.log(`[annotator] Listening on http://${host}:${port}`);
  });
}
