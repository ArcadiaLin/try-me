import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import console from "node:console";

// Recompose the approved UI as a single annotated design, not a Q&A archive.
const path = "docs/annotator/design.excalidraw";
const original = fs.readFileSync(path, "utf8");
const doc = JSON.parse(original);
const digest = crypto
  .createHash("sha256")
  .update(original)
  .digest("hex")
  .slice(0, 12);
fs.mkdirSync("local/design", { recursive: true });
const backup = `local/design/design.refined.${digest}.excalidraw`;
if (!fs.existsSync(backup)) fs.writeFileSync(backup, original, { flag: "wx" });

const removed = new Set([
  4, 5, 6, 11, 12, 28, 29, 213, 506, 507, 530, 531, 534, 535, 575, 576, 590,
  591, 592, 605,
]);
// Keep the main UI only. Old questions, replies and the engineering board are
// deliberately removed under the user's latest instruction; backups retain them.
const retainedUi = doc.elements.filter(
  (e) =>
    e.id.startsWith("review-v2-") &&
    ((e.type === "rectangle" && e.x === 2114 && e.y === 299) ||
      (e.type === "text" &&
        ((e.x === 1980 && e.y === 906) ||
          (e.x === 2100 && e.y === 906) ||
          (e.x === 3160 && e.y === 953)))),
);
doc.elements = doc.elements.filter(
  (e) =>
    e.id.startsWith("refined-") &&
    Number(e.id.slice(8)) < 607 &&
    !removed.has(Number(e.id.slice(8))),
);
for (const e of retainedUi)
  doc.elements.push({ ...e, id: `guide-ui-${e.x}-${e.y}` });
for (const e of doc.elements) {
  e.index = undefined;
  e.boundElements = null;
}
let seq = 0;
const ink = "#263238",
  muted = "#637079",
  accent = "#166b75";
const now = Date.now();
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
function patch(id, props) {
  const e = doc.elements.find((e) => e.id === id);
  assert.ok(e, id);
  Object.assign(e, props, { version: e.version + 1, updated: now });
  if (e.type === "text") {
    e.originalText = e.text;
    e.width = measure(e.text, e.fontSize);
    e.height = e.text.split("\n").length * e.fontSize * e.lineHeight;
  }
  return e;
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
    backgroundColor: "#f0f7f7",
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

patch("refined-1", { height: 1160 });
patch("refined-3", {
  text: "主界面设计 v5 · 波形、时间与事件均为示意 · 外围箭头说明用途、交互与工程类型",
});
patch("refined-569", { text: "拖动区间边缘调整时间；锁定事件不可修改。" });
patch("refined-568", { text: "点事件只显示单时间，区间事件显示起止。" });
patch("refined-601", { text: "来源与关联镜头可展开查看" });
patch("refined-603", { text: "Agent 协作 ▴" });
patch("refined-574", { text: "Workbench / 标注编辑" });
// UI additions survive regeneration without depending on the old Q&A elements.
if (
  !doc.elements.some((e) => e.type === "text" && e.x === 1980 && e.y === 906)
) {
  text(1980, 906, "效果音", 15);
  text(2100, 906, "显  锁", 13, muted);
  text(3160, 953, "边界：独立 ▾    联动公共边界 / 设为紧邻…", 12, accent);
}
if (
  !doc.elements.some(
    (e) => e.type === "rectangle" && e.x === 2114 && e.y === 299,
  )
)
  shape("rectangle", 2114, 299, 1410, 77, {
    backgroundColor: "#b8cdd2",
    strokeColor: "#b8cdd2",
    id: "guide-ui-wave",
  });
// Restore waveform background before strokes, while labels stay above panels.
const dark = doc.elements.find(
  (e) => e.type === "rectangle" && e.x === 2114 && e.y === 299,
);
doc.elements.splice(doc.elements.indexOf(dark), 1);
doc.elements.splice(
  doc.elements.findIndex(
    (e) => e.type === "line" && e.x === 2120 && e.y > 300 && e.y < 370,
  ),
  0,
  dark,
);
const label = doc.elements.find((e) => e.id === "refined-546");
doc.elements.splice(doc.elements.indexOf(label), 1);
doc.elements.splice(
  doc.elements.findIndex((e) => e.id === "refined-547") + 1,
  0,
  label,
);

const header = box(
  1150,
  -380,
  660,
  300,
  "应用 Header 与布局",
  "显示项目与当前工作台，提供撤销、重做及协作入口。\n顶部固定；左右栏可拖宽，Tracker 可调高度。\n窄屏折叠 Explorer，Workbench 切换为侧边抽屉。\n\n工程：WorkspaceLayoutState（新增）。\n现有布局状态来自 App.tsx / WorkbenchState。",
);
arrow(
  header,
  [
    [1700, -80],
    [1700, -25],
    [2140, -25],
    [2140, 110],
  ],
  "refined-8",
);
const transport = box(
  1850,
  -380,
  820,
  300,
  "播放控制与唯一共享时钟",
  "播放、停止、倍速、循环与定位选中对象共用一个时钟。\n播放头同时驱动波形、事件列表和未来的画面预览。\n暂停恢复、跳转与循环不能各自累计时间，避免漂移。\n\n工程：TransportState（新增），复用 PreviewMapping。\n秒为原始编辑坐标，预览帧统一经 @try-me/shared 换算。",
);
arrow(
  transport,
  [
    [2450, -80],
    [2450, 176],
  ],
  "refined-26",
);
const save = box(
  2710,
  -380,
  830,
  300,
  "保存、重载与导出",
  "JSON 只表达项目、多级分组、多条时间线与事件批注。\n保存、重载保留层级、顺序、ID、时间和批注内容。\n只校验基本结构、ID 唯一及起止合法，不要求 hash。\n\n工程：TimelineProject / PersistenceState（新增）。\nrevision、分析溯源与缓存状态不进入业务 JSON。",
);
arrow(
  save,
  [
    [3245, -80],
    [3245, 128],
  ],
  "refined-20",
);
const overview = box(
  1150,
  20,
  660,
  260,
  "全曲概览与时间窗口",
  "概览显示全曲；框选范围对应下方的放大时间窗口。\n平移或缩放时，所有可见轨道保持同一刻度。\n“定位所选”聚焦事件；“适应全曲”恢复全景。\n\n工程：TimelineViewState（新增）。\nstartSec / endSec / pixelsPerSec 描述统一视窗。",
);
arrow(
  overview,
  [
    [1810, 180],
    [1870, 180],
    [1870, 265],
    [2118, 265],
  ],
  "refined-50",
);
const waveform = box(
  1150,
  330,
  660,
  270,
  "主音轨波形与视觉层次",
  "波形用于定位与试听，不把峰值直接认定为拍点。\n主波形背景加深，刻度与标注轨保持浅色。\n底色 #b8cdd2，波形 #355f69；文字保持不透明。\n\n工程：复用 AudioAssetMeta / AnalysisBundle / WaveformBin。\n机器分析只读，显式采纳后才进入人工标注。",
);
arrow(
  waveform,
  [
    [1810, 450],
    [1880, 450],
    [1880, 337],
    [2114, 337],
  ],
  dark.id,
);
const tree = box(
  1150,
  650,
  660,
  330,
  "Explorer：递归分组与轨道",
  "“音乐标注”和“视觉与声音设计”都是同一种 Group。\nGroup 可包含 Group 或 Track；Track 才持有事件。\n右键新建分组 / 轨道、重命名、删除；空白处建根节点。\nchildren 层级及顺序写入 JSON，重载后保留。\n\n工程：TimelineGroup / TimelineTrack / TimelineNode（新增）。\n单一父节点、稳定 ID；禁止循环和重复挂载。\n工程交互：ExplorerCommand / ContextMenuState。",
);
arrow(
  tree,
  [
    [1810, 820],
    [1940, 820],
  ],
  "refined-504",
);
const visibility = box(
  1150,
  1030,
  660,
  330,
  "轨道可见性、锁与新增入口",
  "“显”控制是否在 Tracker 绘制，不删除数据。\n“锁”阻止画布、列表、属性与快捷键的所有写入。\n分组锁作用于后代；父组锁定时子轨不能绕过。\n新增入口允许创建轨道或任意层级的分组。\n\n工程：TimelineViewState（新增），节点用稳定 ID 寻址。\n可见、锁定与折叠只留在会话或本地 UI 偏好中。\n选择隐藏与折叠不应改变内容或播放位置。",
);
arrow(
  visibility,
  [
    [1810, 1195],
    [1885, 1195],
    [1885, 684],
    [2110, 684],
  ],
  "refined-512",
);
const content = box(
  3660,
  20,
  760,
  300,
  "Workbench：所有标注共用一套编辑器",
  "所有标注统一为 id、startSec、可选 endSec 和 text。\n画面想法、修改意见与 Agent 回复统一放入 comments。\n每条批注只有 role 和 text，按数组顺序排列。\n有 endSec 是区间，省略 endSec 就是瞬时点。\n\n工程：TimelineEvent / Comment（新增）。\n不为歌词、分镜或不同作者建立另一套编辑器。",
);
arrow(
  content,
  [
    [3660, 160],
    [3595, 160],
    [3595, 693],
    [3540, 693],
  ],
  "refined-573",
);
const timing = box(
  3660,
  340,
  760,
  300,
  "时间编辑：点与区间的共用能力",
  "区间编辑起止、整体平移或切分；点事件只编辑单时间。\n吸附只影响本次操作，拖拽与数值输入更新同一对象。\n区间采用 [startSec, endSec)，时间为音频秒数。\n写入时检查时间为有限数值、起止有序且不越界。\n\n工程：TimelineEvent / WorkbenchCommand（新增）。\n不同时保存秒数、帧号、采样位置等多套时间副本。",
);
arrow(
  timing,
  [
    [3660, 490],
    [3610, 490],
    [3610, 762],
    [3540, 762],
  ],
  "refined-573",
);
const boundary = box(
  3660,
  690,
  760,
  330,
  "边界关系：联动与设为紧邻",
  "联动公共边界：A.end = B.start，拖动时两端一起改。\n设为紧邻：用户主动选择连接点，消除原本的间隙。\n默认独立，不按短间隙猜测关系，保留真实人声留白。\n重叠轨须明确选择一对邻居，不能自动猜测。\n\n工程：BoundaryLink / WorkbenchCommand（编辑会话状态）。\nJSON 只保存操作后的起止时间，不存 boundary_links。\n重载后不自动恢复会话中的边界绑定。",
);
arrow(
  boundary,
  [
    [3660, 850],
    [3625, 850],
    [3625, 963],
    [3540, 963],
  ],
  "refined-573",
);
const audition = box(
  3660,
  1070,
  760,
  330,
  "切点预听、循环与快捷键",
  "整段预听 / 循环，用于反复校正当前事件。\n起点前后与终点前后使用固定窗口，默认 500ms。\nA / S / R / D / F 对应预听，文本输入时不截获。\n“下一条标注”只切换选择，不写入额外确认状态。\n\n工程：WorkbenchEditState / WorkbenchCommand（新增）。\n预听和循环属于会话状态，不写入业务 JSON。\n没有音源时禁用试听，仍允许查看和编辑文字。",
);
arrow(
  audition,
  [
    [3660, 1235],
    [3600, 1235],
    [3600, 1036],
    [3540, 1036],
  ],
  "refined-573",
);
const list = box(
  1940,
  1230,
  760,
  370,
  "统一事件列表与选择同步",
  "所有轨道使用相同列表：内容、时间、批注数与最近作者。\n点显示单时间，区间显示起止；批注摘要从 comments 推导。\n点击只选择；双击定位并预听；Shift 扩展为多选。\n筛选改变可见结果，不删除或重排原始数据。\n画布、列表和 Workbench 指向同一个稳定事件 ID。\n\n工程：TimelineEvent / EventRef / SelectionState（新增）。\nEventRef 用 trackId + eventId 定位，不用列表下标。\n多选只改公共字段；未选事件时显示时间线设置。\n右键提供新建、切分、删除；详见下方菜单展开态。",
);
arrow(
  list,
  [
    [2680, 1230],
    [2680, 870],
  ],
  "refined-528",
);
const agent = box(
  2740,
  1230,
  800,
  370,
  "Agent 协作抽屉与全局构想",
  "项目、Group、Timeline 与事件都可以有 comments。\n每条仅含 role: human | agent 与 text，允许多轮追加。\n同一处的意见与回复在同一个数组中，顺序即讨论顺序。\n全局要求写在项目批注，局部问题写在具体事件批注。\n\n工程：Comment / Commented（新增）。\n简报从这些批注生成；不另存第二份任务或回复状态。\n抽屉不会自动调用模型，仍由用户发起 Agent 处理。\n新格式为设计目标，当前程序与真实数据尚未迁移。",
);
arrow(
  agent,
  [
    [3000, 1230],
    [3000, 1160],
    [2180, 1160],
    [2180, 1120],
  ],
  "refined-602",
);

// Product labels reflect the compact data model; counts are derived from comments.
patch("refined-544", { text: "批注" });
patch("refined-539", { text: "筛选：全部作者 ▾     当前轨道 ▾     查找事件…" });
patch("refined-545", { text: "最近作者" });
patch("refined-550", { text: "0" });
patch("refined-558", { text: "3" });
patch("refined-565", { text: "1" });
patch("refined-559", { text: "人类" });
patch("refined-566", { text: "人类" });
patch("refined-578", { text: "3 条批注" });
patch("refined-581", { text: "标注正文" });
patch("refined-593", { text: "人类 / Agent 批注", y: 795 });
patch("refined-594", { y: 820, height: 132 });
patch("refined-595", {
  text: "人类：文字提前出现，但不改人声边界。\nAgent：保留标注时间，只调视觉入场。\n人类：先做预览。",
  y: 832,
});
patch("refined-599", { text: "下一条标注" });
patch("refined-601", { text: "当前作者：人类 ▾    + 添加批注" });
patch("refined-501", { text: "E_DEMO_03" });
patch("refined-606", { text: "已保存 · 本地草稿可恢复" });
const palette = box(
  1150,
  1410,
  660,
  440,
  "配色规范：青绿灰与轻层次",
  "页面 #f3f5f5，编辑面板 #ffffff。\n主波形底 #b8cdd2，波形线 #355f69。\n选中底 #e7f2f2，强调与选中描边 #166b75。\n正文 #263238，辅助字 #637079，边框 #cbd2d6。\n\n文本保持完全不透明，不对整块容器降低 opacity。\n选区可用强调色约 10% 的局部覆盖，文字独立。\n事件颜色：event.color → track.color → 默认青绿。",
);
arrow(
  palette,
  [
    [1810, 1630],
    [1905, 1630],
    [1905, 1115],
    [1940, 1115],
  ],
  "refined-602",
);
["#f3f5f5", "#ffffff", "#b8cdd2", "#355f69", "#e7f2f2", "#166b75"].forEach(
  (c, i) => {
    shape("rectangle", 1172 + i * 98, 1760, 88, 28, {
      backgroundColor: c,
      strokeColor: "#cbd2d6",
    });
    text(1172 + i * 98, 1795, c, 12, muted);
  },
);
const storage = box(
  3660,
  1450,
  760,
  440,
  "存储格式：最小可读 JSON",
  "Project { version, name, audio?, nodes, comments? }\nGroup { kind, id, name, children, comments? }\nTimeline { kind, id, name, items, color?, comments? }\nEvent { id, startSec, endSec?, text, color?, comments? }\nComment { role: human | agent, text }\n\nchildren 保留多层级，items 保留同轨事件，数组保留顺序。\n不要求 hash、revision、分析清单或任务状态字段。\n自定义 color 可选保存；锁、播放偏好不进入业务 JSON。\n参考：docs/annotator/example.json（合成示例）。",
);
arrow(
  storage,
  [
    [4420, 1680],
    [4460, 1680],
    [4460, -35],
    [3245, -35],
    [3245, 128],
  ],
  "refined-20",
);


// v5: approved review comments integrated into the interface and direct callouts.
patch(dark.id, { backgroundColor: "#b8cdd2", strokeColor: "#b8cdd2" });
patch("refined-572", { text: "点击选择 · 双击预听 · Shift 多选 · 右键操作 / ··· 菜单" });
patch("refined-594", { height: 88 });
patch("refined-595", { fontSize: 13 });
text(3160, 918, "事件颜色  自定义 ▾    选色… / 恢复自动", 12, muted);
shape("rectangle", 3485, 917, 22, 18, { backgroundColor: "#ad754b", strokeColor: "#ad754b" });
text(3010, 1010, "···", 18, accent);
// Distinct muted event colors remain independent of selection and the playhead.
patch("refined-504", { backgroundColor: "#f8fafa", strokeColor: "#cbd2d6" });
patch("refined-573", { backgroundColor: "#f8fafa", strokeColor: "#cbd2d6" });
patch("refined-536", { backgroundColor: "#ffffff", strokeColor: "#cbd2d6" });
patch("refined-490", { backgroundColor: "#f8fafa", strokeColor: "#cbd2d6" });
patch("refined-494", { backgroundColor: "#f8fafa", strokeColor: "#cbd2d6" });
for (const e of doc.elements) if (e.type === "line" && e.x >= 2120 && e.y > 299 && e.y < 376) e.strokeColor = "#355f69";
const colorDemo = doc.elements.filter(e => ["refined-492", "refined-496", "refined-498", "refined-500"].includes(e.id));
colorDemo.forEach((e, i) => { e.backgroundColor = ["#e7f2f2", "#f0e4d9", "#e7e4ee"][i % 3]; e.strokeColor = ["#166b75", "#ad754b", "#7c7294"][i % 3]; });
const eventMenu=box(1940, 1660, 760, 470, "事件列表右键：按上下文操作",
  "新建点事件（当前播放头） / 新建区间…\n切分所选区间（打开菜单时的播放头）\n删除所选事件                         ··· 同样可打开菜单\n\n右键未选行先单选；已选行保留多选；空白不误删旧选择。\n切分仅限单个区间，且 start < 播放头 < end。\n多选、点事件、边界外或锁定时禁用切分并显示原因。\n新建明确目标轨道与时间；锁定轨道禁止新建 / 删除。\n工程：ContextMenuState / WorkbenchCommand。\n切分左段保留 ID、批注；右段新 ID，继承颜色与正文。\n每次操作可撤销；菜单打开不跳转、不播放。");
arrow(eventMenu, [[1940,1890],[1820,1890],[1820,1145],[2680,1145],[2680,870]], "refined-528");
const explorerMenu=box(2740, 1660, 800, 470, "Explorer 右键：层级与安全删除",
  "新建分组 / 新建时间线 / 重命名 / 删除\nGroup：在组内新建；轨道：在同级新建。\n空白：新建根节点；只读候选不提供写操作。\n\n删除非空分组时明确提示影响的轨道与事件数量。\n确认后作为一次操作删除整棵子树，可整体撤销。\n父组锁定或后代含锁定节点时禁用删除，不绕过锁。\n右键不改变播放位置，Esc 或点击外部关闭菜单。\n工程：ExplorerCommand / ContextMenuState。\n同一菜单也可从节点旁 ··· 或键盘菜单键打开。\n左右分隔线可拖动；双击恢复默认栏宽。");
arrow(explorerMenu, [[2740,1900],[1840,1900],[1840,860],[1940,860]], "refined-504");
const colors=box(1940, 2180, 1600, 300, "事件配色：自动继承与可选覆盖",
  "默认采用低饱和青绿；轨道可设默认色，事件可独立自定义；选择“自动”即移除覆盖。\n解析顺序 event.color → track.color → 默认 #166b75；只保存可选 #RRGGBB，不存派生填充色。\n同一事件在主波形叠层、轨道、列表色标与 Workbench 使用相同颜色；选中轮廓与播放头仍独立可辨。\n深色波形上采用局部浅色填充与实线边缘，文字完整不透明；颜色不替代作者与锁定提示。\n工程：TimelineEvent.color / TimelineTrack.color；预览、确认、取消、恢复自动共用颜色控件。\n切分继承颜色；移动到其他轨道时，自动色随目标轨道变化，显式覆盖保持不变。");
arrow(colors, [[3540,2330],[3570,2330],[3570,927],[3520,927]], "refined-573");

assert.equal(new Set(doc.elements.map((e) => e.id)).size, doc.elements.length);
assert.ok(
  !doc.elements.some(
    (e) => e.type === "text" && e.text.includes("模块与类型对照"),
  ),
);
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
exportSvg("docs/annotator/design.annotated.svg", [1100, -430, 3420, 2990], () => true);
exportSvg(
  "docs/annotator/design.svg",
  [1900, 0, 1680, 1160],
  (e) =>
    !e.id.startsWith("guide-v3-") ||
    (e.type !== "arrow" && e.x >= 1900 && e.x < 3580 && e.y < 1160),
);
console.log(
  `Recomposed design with 18 direct module callouts; old questions and bottom engineering board removed. Backup: ${backup}`,
);
