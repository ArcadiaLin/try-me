import fs from "node:fs";
import console from "node:console";

// Both exports share geometry; all UI parts remain editable Excalidraw elements.
const elements = [];
const svg = [];
const ink = "#263238",
  muted = "#637079",
  line = "#cbd2d6";
const accent = "#166b75",
  pale = "#e7f2f2",
  paper = "#ffffff";
let seq = 0;
const escape = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
function base(type, x, y, width, height, color, fill) {
  const id = `refined-${++seq}`;
  const e = {
    id,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: color,
    backgroundColor: fill,
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: seq * 713,
    version: 1,
    versionNonce: seq * 131,
    isDeleted: false,
    boundElements: null,
    updated: 1794614400000,
    link: null,
    locked: false,
  };
  elements.push(e);
  return e;
}
function rect(x, y, w, h, fill = paper, color = line) {
  base("rectangle", x, y, w, h, color, fill);
  svg.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${color}"/>`,
  );
}
function text(x, y, s, size = 16, color = ink) {
  const lines = s.split("\n");
  const width = Math.max(
    ...lines.map((t) =>
      [...t].reduce(
        (n, c) => n + (c.charCodeAt(0) > 255 ? size : size * 0.56),
        0,
      ),
    ),
  );
  Object.assign(
    base("text", x, y, width, lines.length * size * 1.4, color, "transparent"),
    {
      text: s,
      originalText: s,
      fontSize: size,
      fontFamily: 2,
      textAlign: "left",
      verticalAlign: "top",
      containerId: null,
      autoResize: true,
      lineHeight: 1.4,
    },
  );
  lines.forEach((t, i) =>
    svg.push(
      `<text x="${x}" y="${y + size * 1.08 + i * size * 1.4}" font-size="${size}" fill="${color}">${escape(t)}</text>`,
    ),
  );
}
function ln(x, y, x2, y2, color = line) {
  Object.assign(base("line", x, y, x2 - x, y2 - y, color, "transparent"), {
    points: [
      [0, 0],
      [x2 - x, y2 - y],
    ],
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
  });
  svg.push(`<path d="M${x},${y} L${x2},${y2}" stroke="${color}" fill="none"/>`);
}
function tag(x, y, s, w = 180) {
  rect(x, y, w, 24, pale, pale);
  text(x + 7, y + 3, s, 12, accent);
}
function button(x, y, w, s, active = false) {
  rect(x, y, w, 30, active ? accent : paper, active ? accent : line);
  text(x + 10, y + 5, s, 14, active ? paper : ink);
}

rect(0, 0, 1680, 1850, "#f3f5f5", "#f3f5f5");
text(40, 24, "ANNOTATE / 统一时间线工作台", 30);
text(
  40,
  68,
  "基于原草案的设计提案 v1 · 所有时间、事件与波形均为布局示意，非歌曲分析结果",
  15,
  muted,
);
text(1190, 30, "现有类型 = 代码已定义", 14, muted);
tag(1190, 55, "NEW = 建议新增，尚未接入", 246);

// Desktop canvas: same regions as the user's sketch.
rect(40, 110, 1600, 1010);
rect(40, 110, 1600, 66, "#f8fafa");
text(60, 123, "Try Me", 23);
text(173, 127, "标注工作台", 16, muted);
tag(315, 127, "A · WorkspaceLayoutState NEW", 245);
button(920, 128, 55, "撤销");
button(985, 128, 55, "重做");
text(1060, 135, "已保存 · 本地", 14, accent);
button(1210, 128, 88, "重新载入");
button(1310, 128, 70, "保存");
button(1392, 128, 88, "导出 ▾");
button(1492, 128, 130, "Agent 协作");

// Tracker / shared clock.
rect(40, 176, 1600, 308, "#fcfdfd");
text(60, 189, "Tracker", 19);
tag(156, 188, "B · TransportState NEW", 206);
button(390, 187, 54, "▶");
button(453, 187, 54, "■");
text(525, 194, "00:12.400", 22);
text(675, 199, "秒 / 预览帧", 13, muted);
button(800, 187, 62, "1.0×");
button(872, 187, 100, "循环选区");
button(982, 187, 86, "吸附 ▾");
text(1090, 197, "缩放  − ━━━ +", 14);
button(1260, 187, 105, "定位所选");
button(1376, 187, 108, "适应全曲");
tag(1495, 189, "秒为主坐标", 125);
text(60, 241, "全曲概览", 13, muted);
rect(218, 239, 1400, 26, "#e7ecee", "#e7ecee");
for (let i = 0; i < 160; i++) {
  const h = 4 + Math.abs(Math.sin(i * 1.73) * Math.cos(i * 0.29)) * 17;
  ln(222 + i * 8.7, 252 - h / 2, 222 + i * 8.7, 252 + h / 2, "#84999e");
}
rect(500, 239, 430, 26, "transparent", accent);
text(60, 281, "主音轨", 14);
text(60, 303, "AudioAssetMeta", 11, muted);
for (let i = 0; i < 8; i++) {
  const x = 220 + i * 198;
  text(x, 278, `00:${String(8 + i * 2).padStart(2, "0")}`, 12, muted);
  ln(x, 300, x, 475, "#e4e9ea");
}
for (let i = 0; i < 260; i++) {
  const h = 6 + Math.abs(Math.sin(i * 1.37) * Math.cos(i * 0.11)) * 58;
  ln(220 + i * 5.37, 340 - h / 2, 220 + i * 5.37, 340 + h / 2, "#78969b");
}
rect(60, 385, 143, 32, "#f3f5f5", "#f3f5f5");
text(70, 391, "段落 / 区间", 13);
rect(220, 385, 555, 32, "#e7ecee");
text(234, 391, "P_DEMO · 段落示例", 13);
rect(60, 428, 143, 34, pale, pale);
text(70, 434, "主唱 / 事件", 13);
rect(418, 428, 158, 34, pale);
text(433, 435, "E_DEMO_01", 13);
rect(616, 428, 198, 34, pale, accent);
text(632, 435, "E_DEMO_02 · 已选中", 13, accent);
rect(864, 428, 158, 34, "#f0f2f3");
text(875, 435, "E_DEMO_03 · 候选", 13, muted);
ln(656, 297, 656, 474, "#b44e32");
text(664, 306, "播放头", 11, "#b44e32");

// Explorer.
rect(40, 484, 270, 594, "#f8fafa");
text(58, 500, "Explorer", 19);
tag(58, 529, "C · TimelineCollection NEW", 230);
rect(58, 569, 232, 30);
text(69, 575, "搜索轨道或事件…", 14, muted);
text(58, 618, "▾ 音乐标注", 16);
text(235, 620, "+  ···", 14, muted);
rect(50, 653, 250, 38, pale, pale);
text(70, 661, "主唱", 15, accent);
text(200, 661, "显  锁", 13, muted);
text(80, 700, "段落", 15);
text(200, 700, "显  锁", 13, muted);
text(80, 739, "拍点", 15);
text(200, 739, "显  锁", 13, muted);
text(58, 790, "▾ 视觉与声音设计", 16);
text(80, 830, "分镜", 15);
text(200, 830, "显  锁", 13, muted);
text(80, 869, "效果音", 15);
text(200, 869, "显  锁", 13, muted);
text(58, 921, "▸ 自动分析候选 · 只读", 15, muted);
button(58, 975, 232, "+ 新建轨道 / 集合");
text(58, 1025, "分组可自由命名与折叠", 13, muted);

// Generic work area.
rect(310, 484, 930, 594);
text(330, 500, "音乐标注 / 主唱", 19);
tag(520, 498, "D · TimelineTrack NEW", 200);
text(330, 540, "事件列表", 15, accent);
text(440, 540, "轨道设置", 15, muted);
tag(735, 537, "SelectionState NEW", 180);
button(1095, 531, 124, "+ 添加事件");
ln(330, 572, 1218, 572);
text(330, 587, "筛选：全部状态 ▾     当前轨道 ▾     查找事件…", 14, muted);
rect(326, 623, 898, 36, "#f3f5f5", "#f3f5f5");
text(341, 631, "ID / 内容", 13, muted);
text(676, 631, "起点 / 时间", 13, muted);
text(826, 631, "终点", 13, muted);
text(976, 631, "状态", 13, muted);
text(1110, 631, "协作", 13, muted);
const rows = [
  ["E_DEMO_01", "事件标题示例", "10.000 s", "11.600 s", "已确认", "—"],
  ["E_DEMO_02", "当前选中的区间事件", "12.000 s", "14.000 s", "候选", "待处理"],
  ["E_DEMO_03", "下一条事件示例", "14.500 s", "16.100 s", "候选", "—"],
];
rows.forEach((r, i) => {
  const y = 660 + i * 70;
  if (i === 1) rect(326, y, 898, 70, pale, pale);
  text(341, y + 10, r[0], 14, i === 1 ? accent : ink);
  text(341, y + 33, r[1], 14, muted);
  text(676, y + 23, r[2], 14);
  text(826, y + 23, r[3], 14);
  text(976, y + 23, r[4], 14);
  text(1110, y + 23, r[5], 14);
  ln(326, y + 70, 1224, y + 70);
});
text(341, 906, "统一列表：点事件只显示时间；区间事件显示起止。", 15, muted);
text(
  341,
  938,
  "业务字段由 EditorProfile 扩展，换轨道保留同一套编辑结构。",
  15,
  muted,
);
ln(330, 985, 1218, 985);
text(341, 1002, "3 个事件 · 已选择 1 个", 13, muted);
text(
  341,
  1033,
  "点击选择 · 双击定位并预听 · Shift 多选 · 锁定时禁止写入",
  13,
  muted,
);

// Inspector.
rect(1240, 484, 400, 594, "#fbfcfc");
text(1260, 500, "Workbench / 属性", 19);
tag(1260, 530, "E · TimelineEvent NEW", 210);
text(1260, 574, "E_DEMO_02", 21);
text(1480, 579, "候选 ▾", 14);
text(1260, 613, "通用      专属      来源", 14, accent);
ln(1260, 642, 1620, 642);
text(1260, 654, "名称", 12, muted);
rect(1260, 676, 360, 33);
text(1271, 682, "当前选中的区间事件", 14);
text(1260, 724, "起点（秒）", 12, muted);
text(1447, 724, "终点（秒）", 12, muted);
rect(1260, 746, 174, 33);
rect(1446, 746, 174, 33);
text(1271, 752, "12.000", 15);
text(1457, 752, "14.000", 15);
text(1260, 795, "专属字段 · 歌词文本 / 小节 / 语言", 13, muted);
rect(1260, 820, 360, 34);
text(1271, 827, "示例文本，不引用歌曲歌词", 14, muted);
text(1260, 867, "备注 / 画面构想", 13, muted);
rect(1260, 891, 360, 61);
text(1271, 903, "描述听感或声画关系…", 14, muted);
button(1260, 974, 108, "预听整段");
button(1380, 974, 240, "确认并选择下一条");
text(1260, 1024, "切点预听  A / S / R / D / F", 13, muted);
text(1260, 1047, "来源与 Agent 指令可展开查看", 12, muted);

// Bottom drawer and persistence status.
rect(40, 1078, 1600, 42, "#edf1f2");
text(60, 1089, "F · Agent 协作 ▴", 15);
text(265, 1091, "当前事件 / 全局构想 / 结构化简报", 13, muted);
text(885, 1091, "G · PersistenceState NEW", 13, accent);
text(1138, 1091, "已保存 · 离线草稿可恢复 · 冲突需处理", 13, muted);

// Engineering board.
text(40, 1160, "模块与类型对照", 25);
text(
  40,
  1201,
  "NEW 类型定义见 docs/annotator-design.types.ts；现有类型来自 web/src/types.ts，WorkbenchState 来自 store/workbenchStore.ts。",
  14,
  muted,
);
const cards = [
  [
    40,
    1240,
    510,
    "A · 应用布局与 Header",
    "NEW WorkspaceLayoutState / PersistenceState",
    "现有 WorkbenchState、ServerStatePayload\n布局宽度与抽屉状态只存在 UI 层。",
  ],
  [
    580,
    1240,
    510,
    "B · Tracker / 共享时钟",
    "NEW TransportState / TimelineViewState",
    "现有 AudioAssetMeta、PreviewMapping、AnalysisBundle\n波形使用 WaveformBin；统一秒 ↔ 帧映射。",
  ],
  [
    1120,
    1240,
    520,
    "C · Explorer / 任意集合",
    "NEW TimelineCollection / TimelineTrack",
    "现有 TimelineCollectionDef、CustomTimelineTrack\n集合管轨道；group_id / parent_id 管事件层级。",
  ],
  [
    40,
    1420,
    510,
    "D · 统一事件工作区",
    "NEW TimelineEvent / SelectionState / EventRef",
    "现有 LyricLine、PointMarker、RegionItem、\nTimelineTrackItem，经适配器进入同一列表。",
  ],
  [
    580,
    1420,
    510,
    "E · 通用属性 + 业务扩展",
    "NEW EditorProfile / EventAdapter",
    "现有 ItemStatus、AuditionMode、具体业务类型\n同一属性面板；按 profile 增加字段与动作。",
  ],
  [
    1120,
    1420,
    520,
    "F / G · 协作与保存",
    "现有 GlobalNotes / AgentStatus",
    "事件 agent_comment / agent_reply / script_idea\nNEW PersistenceState：离线、冲突、错误独立呈现。",
  ],
];
cards.forEach(([x, y, w, title, type, body]) => {
  rect(x, y, w, 155);
  text(x + 16, y + 13, title, 18);
  text(x + 16, y + 48, type, 14, accent);
  text(x + 16, y + 80, body, 14, muted);
});
text(40, 1611, "读写路径", 19);
text(
  40,
  1650,
  "现有数据 / API → EventAdapter → TimelineTrack + TimelineEvent → Tracker / Explorer / 列表 / Workbench",
  17,
  accent,
);
text(
  40,
  1685,
  "编辑 → EventRef 定位源对象 → 类型与权限校验 → 现有保存流程。UI 统一不等于立即迁移存储 schema。",
  16,
);
text(40, 1730, "边界与状态", 19);
text(
  40,
  1765,
  "点：单时间值；区间：[start, end)；候选：只读并显式采纳；锁定：禁止编辑；无选择：显示轨道设置；多选：仅编辑公共字段。",
  15,
  muted,
);
text(
  40,
  1795,
  "小屏先折叠 Explorer，Workbench 改抽屉；三栏可拖宽。空轨道提供添加入口；无音源显示提示，保留静音查看标注。",
  15,
  muted,
);

const original = JSON.parse(fs.readFileSync("docs/design.excalidraw", "utf8"));
const shifted = elements.map((e) => ({ ...e, x: e.x + 1900, y: e.y }));
// Excalidraw is now a collaborative source: never regenerate over hand edits.
const output = fs.existsSync("docs/design.refined.excalidraw")
  ? "out/design-review/design.base-v1.excalidraw"
  : "docs/design.refined.excalidraw";
fs.mkdirSync("out/design-review", { recursive: true });
fs.writeFileSync(
  output,
  JSON.stringify(
    { ...original, elements: [...original.elements, ...shifted] },
    null,
    2,
  ) + "\n",
);
fs.writeFileSync(
  output === "docs/design.refined.excalidraw"
    ? "docs/design.refined.svg"
    : "out/design-review/design.base-v1.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" width="1680" height="1850" viewBox="0 0 1680 1850"><style>text{font-family:'Segoe UI','Microsoft YaHei',sans-serif}</style>${svg.join("\n")}</svg>\n`,
);
console.log(
  `Generated ${elements.length} editable elements at ${output}; existing hand edits preserved.`,
);
