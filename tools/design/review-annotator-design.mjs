import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import console from "node:console";
import { composeCurrentDesign } from "./current-annotator-design.mjs";

// Recompose the approved UI as a single annotated design, not a Q&A archive.
const path = "docs/annotator/design.excalidraw";
const original = fs.readFileSync(path, "utf8");
const doc = JSON.parse(original);
const handwritten = doc.elements.filter(e => !["refined-", "guide-", "review-v2-"].some(p => e.id.startsWith(p)));
const digest = crypto
  .createHash("sha256")
  .update(original)
  .digest("hex")
  .slice(0, 12);
fs.mkdirSync("local/design", { recursive: true });
const backup = `local/design/design.refined.${digest}.excalidraw`;
if (!fs.existsSync(backup)) fs.writeFileSync(backup, original, { flag: "wx" });

let seq = 0;
const ink = "#263238",
  accent = "#166b75";
const now = Date.UTC(2026, 10, 15);
function measure(s, size) {
  return Math.max(
    ...s
      .split("\n")
      .map((t) =>
        [...t].reduce(
          (n, c) => n + (c.charCodeAt(0) > 255 ? size : size * 0.56),
          0,
        ),
      ),
  );
}
function shape(type, x, y, width, height, extra = {}) {
  const e = {
    id: `guide-v3-${++seq}`,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: accent,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1.3,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: seq * 173,
    version: 1,
    versionNonce: seq * 131,
    isDeleted: false,
    boundElements: null,
    updated: now,
    link: null,
    locked: false,
    ...extra,
  };
  doc.elements.push(e);
  return e;
}
function text(x, y, s, size = 18, color = ink, group = null) {
  return shape(
    "text",
    x,
    y,
    measure(s, size),
    s.split("\n").length * size * 1.4,
    {
      text: s,
      originalText: s,
      fontSize: size,
      fontFamily: 2,
      lineHeight: 1.4,
      textAlign: "left",
      verticalAlign: "top",
      containerId: null,
      autoResize: true,
      strokeColor: color,
      groupIds: group ? [group] : [],
    },
  );
}
function box(x, y, w, h, title, body) {
  const group = `guide-card-${seq + 1}`;
  const r = shape("rectangle", x, y, w, h, {
    backgroundColor: "#f8fafa",
    groupIds: [group],
  });
  text(x + 22, y + 18, title, 23, accent, group);
  const b = text(x + 22, y + 65, body, 18, ink, group);
  assert.ok(b.width <= w - 42, title + " width");
  assert.ok(b.height <= h - 82, title + " height");
  return r;
}
function arrow(card, coords, targetId) {
  const target = doc.elements.find((e) => e.id === targetId);
  assert.ok(target, targetId);
  const [x, y] = coords[0];
  const end = coords.at(-1);
  const xs = coords.map((p) => p[0]),
    ys = coords.map((p) => p[1]);
  const a = shape(
    "arrow",
    x,
    y,
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
    {
      points: coords.map(([a, b]) => [a - x, b - y]),
      lastCommittedPoint: null,
      startBinding: {
        elementId: card.id,
        mode: "inside",
        fixedPoint: [(x - card.x) / card.width, (y - card.y) / card.height],
      },
      endBinding: {
        elementId: target.id,
        mode: "inside",
        fixedPoint: [
          (end[0] - target.x) / target.width,
          (end[1] - target.y) / target.height,
        ],
      },
      startArrowhead: null,
      endArrowhead: "arrow",
    },
  );
  card.boundElements = [{ id: a.id, type: "arrow" }];
  target.boundElements = [
    ...(target.boundElements || []),
    { id: a.id, type: "arrow" },
  ];
}

composeCurrentDesign({ doc, shape, text, box, arrow, handwritten });
assert.equal(new Set(doc.elements.map(e => e.id)).size, doc.elements.length);
fs.writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
function render(e) {
  const color = e.strokeColor || ink,
    fill = e.backgroundColor || "transparent";
  const a = `stroke="${color}" stroke-width="${e.strokeWidth || 1}" opacity="${(e.opacity ?? 100) / 100}"`;
  if (e.type === "rectangle")
    return `<rect x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" fill="${fill}" ${a}/>`;
  if (e.type === "ellipse")
    return `<ellipse cx="${e.x+e.width/2}" cy="${e.y+e.height/2}" rx="${e.width/2}" ry="${e.height/2}" fill="${fill}" ${a}/>`;
  if (e.type === "text")
    return e.text
      .split("\n")
      .map(
        (s, i) =>
          `<text data-eid="${e.id}" x="${e.x}" y="${e.y + e.fontSize * 1.08 + i * e.fontSize * (e.lineHeight || 1.25)}" font-size="${e.fontSize}" fill="${color}">${esc(s)}</text>`,
      )
      .join("\n");
  if (e.type === "line" || e.type === "arrow")
    return `<path d="${e.points.map(([x, y], i) => `${i ? "L" : "M"}${e.x + x},${e.y + y}`).join(" ")}" fill="none" ${a} ${e.type === "arrow" ? 'marker-end="url(#arrowhead)"' : ""}/>`;
  return "";
}
function exportSvg(file, viewBox, filter) {
  const live = doc.elements.filter((e) => !e.isDeleted && filter(e));
  const [x, y, w, h] = viewBox;
  fs.writeFileSync(
    file,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox.join(" ")}"><style>text{font-family:'Segoe UI','Microsoft YaHei',sans-serif}</style><defs><marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="#166b75" stroke-width="1.3"/></marker></defs><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>${live.map(render).join("\n")}</svg>\n`,
  );
}
exportSvg("docs/annotator/design.annotated.svg", [0, 0, 3600, 2290], () => true);
exportSvg(
  "docs/annotator/design.svg",
  [880, 290, 1840, 1190],
  (e) => e.customData?.surface === "main",
);
console.log(
  `Synced current interface and 18 callouts; handwritten additions preserved. Backup: ${backup}`,
);
