// Compose the current UI from synthetic data. Does not load song/annotation files.
export function composeCurrentDesign({ doc, shape, text, box, arrow, handwritten }) {
  doc.elements = [];
  const c = { panel: "#ffffff", secondary: "#f8fafa", selected: "#e7f2f2", accent: "#166b75", ink: "#263238", muted: "#637079", border: "#cbd2d6" };
  const rect = (x, y, w, h, fill = c.panel, stroke = c.border) => shape("rectangle", x, y, w, h, { backgroundColor: fill, strokeColor: stroke });
  const rule = (x, y, w, color = c.border) => shape("line", x, y, w, 0, { points: [[0, 0], [w, 0]], strokeColor: color });
  const button = (x, y, w, s, primary = false) => {
    const r = rect(x, y, w, 28, primary ? c.accent : c.panel, primary ? c.accent : c.border);
    text(x + 8, y + 4, s, 13, primary ? c.panel : c.ink); return r;
  };
  const icon = (x, y, name, off = false) => {
    if (name === "eye") {
      shape("ellipse", x, y + 3, 16, 10, { strokeColor: c.muted });
      shape("ellipse", x + 6, y + 6, 4, 4, { strokeColor: c.muted });
    } else {
      shape("ellipse", x + 4, y, 8, 11, { strokeColor: c.muted });
      rect(x + 2, y + 7, 12, 10, c.secondary, c.muted);
    }
    if (off) shape("line", x + 1, y + 17, 15, 16, { points: [[0, 0], [15, -16]], strokeColor: c.muted, strokeWidth: 1.8 });
  };
  const X = 900, Y = 380, W = 1800, H = 1080;
  text(X, Y - 76, "Annotator · 当前界面设计", 28);
  text(X, Y - 32, "2026-11-15 · 按实现同步 · 波形、事件、时间和计数均为合成示意；非运行截图", 16, c.muted);
  rect(X, Y, W, H, "#f3f5f5");
  const header = rect(X, Y, W, 44);
  text(X + 12, Y + 12, "Try Me — Kero Kero Bonito", 16);
  text(X + 285, Y + 14, "歌词与主唱 / 歌词轨", 13, c.muted);
  text(X + 505, Y + 14, "已同步", 13, c.muted);
  text(X + 1210, Y + 14, "撤销    重做    导出 ASS    导出 LRC    重载", 13);
  const save = button(X + W - 132, Y + 8, 120, "保存 (Ctrl+S)", true);
  const ty = Y + 44;
  const transport = rect(X, ty, W, 44, c.secondary);
  button(X + 12, ty + 8, 116, "▶ 播放 (Space)", true);
  button(X + 138, ty + 8, 62, "停止"); button(X + 210, ty + 8, 80, "循环：关");
  button(X + 300, ty + 8, 132, "跳到选中标注");
  text(X + 450, ty + 12, "00:12.400 / 03:30.000", 14);
  text(X + 720, ty + 13, "待循环：00:12.000 – 00:14.000", 12, c.muted);
  text(X + 1230, ty + 13, "☑ 拍点参考线", 12);
  button(X + 1514, ty + 8, 76, "放大 +"); button(X + 1600, ty + 8, 76, "缩小 −"); button(X + 1686, ty + 8, 100, "全曲");
  const oy = ty + 44;
  rect(X, oy, W, 22, "#dce6e8");
  rect(X, oy + 1, 390, 20, "#b8cdd2", c.accent);
  text(X + 8, oy + 2, "总览窗（拖动平移视窗 · 滚轮缩放）", 11, c.muted);
  const wy = oy + 22, wx = X + 64, ww = W - 64;
  const wave = rect(wx, wy, ww, 138, "#0c1017", "#0c1017");
  // Fixed synthetic envelope. Not extracted from the song.
  for (let i = 0; i < 260; i++) {
    const amp = 12 + Math.abs(Math.sin(i * 1.73) * Math.cos(i * 0.21)) * 52;
    shape("line", wx + 3 + i * (ww - 6) / 260, wy + 69 - amp, 0, amp * 2, {
      points: [[0, 0], [0, amp * 2]], strokeColor: i < 72 ? "#0284c7" : "#334155", strokeWidth: 3,
    });
  }
  rect(wx + ww * 12 / 45, wy, ww * 2 / 45, 138, "transparent", c.accent);
  text(wx + ww * 12 / 45 + 4, wy + 8, "E_DEMO_02", 11, "#e2e8f0");
  rect(wx, wy + 138, ww, 24, "#131924", "#263145");
  for (let sec = 0; sec <= 40; sec += 5) text(wx + ww * sec / 45 + 4, wy + 141, String(sec), 11, "#94a3b8");
  const ly = wy + 162;
  ["歌…", "段…", "分…"].forEach((name, i) => {
    const y = ly + i * 30;
    rect(X, y, 64, 30, i === 0 ? c.selected : c.secondary);
    rect(X + 7, y + 10, 9, 9, c.accent, c.accent); text(X + 21, y + 6, name, 12);
    rect(wx, y, ww, 30, i === 0 ? c.selected : c.panel);
    const spans = i === 0 ? [[10, 11.6], [12, 14], [14.5, 16.1]] : i === 1 ? [[0, 18], [18, 45]] : [[12, 20]];
    spans.forEach(([start, end], j) => {
      const left = wx + ww * start / 45;
      rect(left, y + 3, ww * (end - start) / 45, 24, c.panel, c.accent);
      text(left + 4, y + 7, i === 0 ? `E0${j + 1}` : `区间示例 ${j + 1}`, 10);
    });
  });
  shape("line", wx + ww * 12.4 / 45, wy, 0, 252, { points: [[0, 0], [0, 252]], strokeColor: "#f43f5e", strokeWidth: 2 });
  const resize = rect(X + 58, wy, 6, 252, c.selected, c.accent);
  const sy = ly + 96, bottom = Y + H - 34;
  const lx = X, lw = 260, cx = X + 266, cw = 700, rx = X + 972, rw = W - 972;
  const tree = rect(lx, sy, lw, bottom - sy);
  const list = rect(cx, sy, cw, bottom - sy);
  const editor = rect(rx, sy, rw, bottom - sy);
  rect(lx, sy, lw, 36, c.secondary); text(lx + 10, sy + 8, "时间轴", 15);
  text(lx + 110, sy + 10, "+ 分组   + 时间轴   ···", 12);
  rect(lx + 8, sy + 44, lw - 16, 28); text(lx + 16, sy + 49, "搜索分组或时间轴…", 12, c.muted);
  const nodes = [[0, "▾ 歌词与主唱", true, false], [1, "歌词轨", true, false], [0, "▾ 结构分析", true, false], [1, "段落边界", true, false], [1, "试听片段", true, true], [0, "▾ 节奏基准", true, false], [1, "小节强拍", true, false], [1, "普通拍点", false, false], [0, "▾ 自定义多轨", true, false], [1, "效果音", true, false], [1, "▾ 分镜草案组", true, false], [2, "画面动作", true, false]];
  nodes.forEach(([depth, name, visible, locked], i) => {
    const y = sy + 88 + i * 30;
    if (i === 1) rect(lx, y - 2, lw, 30, c.selected, c.selected);
    text(lx + 10 + depth * 16, y + 2, name, 13);
    icon(lx + 192, y + 2, "eye", !visible); icon(lx + 219, y + 2, "lock", !locked);
  });
  text(lx + 10, bottom - 28, "▸ 操作提示", 11, c.muted);
  rect(cx, sy, cw, 36, c.secondary); text(cx + 12, sy + 8, "事件 (3)", 15);
  text(cx + 135, sy + 10, "时间轴设置与评论", 13, c.muted);
  text(cx + cw - 155, sy + 10, "+ 点事件   + 区间   ···", 12);
  rect(cx + 10, sy + 44, 390, 28); text(cx + 18, sy + 49, "过滤事件 ID、文本或评论内容…", 12, c.muted);
  text(cx + 460, sy + 50, "全部 (3)    含评论 (2)", 12);
  rect(cx, sy + 80, cw, 28, c.secondary); text(cx + 12, sy + 85, "ID / 文本", 12, c.muted);
  text(cx + 415, sy + 85, "起点         终点         评论", 12, c.muted);
  [["E_DEMO_01", "区间标注示例 A", "00:10.000", "00:11.600", "—"], ["E_DEMO_02", "当前选中的区间标注", "00:12.000", "00:14.000", "2 · 人类"], ["E_DEMO_03", "下一条标注示例", "00:14.500", "00:16.100", "1 · Agent"]].forEach(([id, label, start, end, comment], i) => {
    const y = sy + 108 + i * 44;
    rect(cx, y, cw, 44, i === 1 ? c.selected : c.panel);
    rect(cx + 12, y + 17, 10, 10, c.accent, c.accent); text(cx + 30, y + 12, `${id}  ${label}`, 13);
    text(cx + 405, y + 13, `${start}    ${end}`, 11); text(cx + 610, y + 13, comment, 11, c.muted);
  });
  text(cx + 12, bottom - 42, "已选 1 条", 11, c.muted); text(cx + 12, bottom - 24, "▸ 操作提示", 11, c.muted);
  rect(rx, sy, rw, 36, c.secondary); text(rx + 12, sy + 8, "事件编辑", 15);
  text(rx + rw - 180, sy + 11, "E_DEMO_02 · 区间事件", 12, c.muted);
  text(rx + 16, sy + 48, "事件 ID", 12, c.muted); text(rx + 130, sy + 48, "所属时间轴", 12, c.muted);
  text(rx + 16, sy + 70, "E_DEMO_02", 13);
  rect(rx + 130, sy + 68, rw - 146, 28); text(rx + 140, sy + 73, "歌词与主唱 / 歌词轨", 13);
  text(rx + 16, sy + 109, "标注内容", 12, c.muted); rect(rx + 16, sy + 132, rw - 32, 54);
  text(rx + 26, sy + 145, "当前选中的区间标注", 14); rule(rx + 16, sy + 207, rw - 32);
  text(rx + 16, sy + 220, "时间与微调", 13); text(rx + rw - 115, sy + 222, "转为点事件", 12, c.muted);
  ["起点", "终点 · 时长 2.000 秒"].forEach((label, i) => {
    const y = sy + 250 + i * 72;
    text(rx + 16, y + 3, label, 12, c.muted); rect(rx + rw - 128, y, 112, 28);
    text(rx + rw - 100, y + 5, i ? "14.000" : "12.000", 14);
    text(rx + 16, y + 36, "−50ms     −10ms     +10ms     +50ms     设为播放头", 12);
    if (!i) rule(rx + 16, y + 65, rw - 32);
  });
  rule(rx + 16, sy + 402, rw - 32); text(rx + 16, sy + 416, "▸ 事件颜色", 13);
  rect(rx + 125, sy + 420, 14, 14, c.accent, c.accent); text(rx + 150, sy + 418, "跟随时间轴", 12, c.muted);
  rule(rx + 16, sy + 451, rw - 32); text(rx + 16, sy + 465, "相邻边界关系与切分", 13);
  text(rx + 16, sy + 493, "与后一条 E_DEMO_03：独立（保留句间空隙）", 12);
  text(rx + 16, sy + 521, "独立     联动公共边界     设为紧邻（播放头）", 12, c.accent);
  rule(rx + 16, sy + 554, rw - 32); text(rx + 16, sy + 568, "切点 500ms 试听", 13);
  text(rx + 16, sy + 594, "起点前 (A)    起点后 (S)    整段 (R)    终点前 (D)    终点后 (F)", 12);
  rect(rx, bottom - 42, rw, 42, c.secondary); text(rx + 16, bottom - 30, "删除所选 (1)", 13, "#b44e32");
  button(rx + rw - 128, bottom - 35, 112, "下一条标注 →", true);
  const agent = rect(X, bottom, W, 34, c.secondary); text(X + 12, bottom + 8, "▴  Agent 协作", 13);
  text(X + 160, bottom + 9, "2 处 · 3 条评论", 12, c.muted); text(X + W - 160, bottom + 9, "复制简报     展开", 12);
  const timeAnchor = rect(rx + rw - 1, sy + 250, 1, 24, "transparent", "transparent");
  const colorAnchor = rect(rx + rw - 1, sy + 416, 1, 24, "transparent", "transparent");
  const boundaryAnchor = rect(rx + rw - 1, sy + 493, 1, 24, "transparent", "transparent");
  const auditionAnchor = rect(rx + rw - 1, sy + 568, 1, 24, "transparent", "transparent");
  for (const e of doc.elements) e.customData = { surface: "main" };

  function note(x, y, w, h, title, body, target, route) {
    const card = box(x, y, w, h, title, body);
    arrow(card, route, target.id);
  }
  const top = (i, title, body, target) => {
    const tx = [2260, 2350, save.x + 60][i];
    note(900 + i * 610, 20, 580, 250, title, body, target,
      [[1190 + i * 610, 270], [1190 + i * 610, 280 + i * 5], [tx, 280 + i * 5], [tx, target.y + 10]]);
  };
  top(0, "Header：路径与状态", "路径、同步与评论统计使用普通文字。\n仅保存突出，未保存/错误保留文字强调。\n撤销、重做、ASS/LRC 导出和重载沿用实现。\n不再使用装饰徽章包装状态。", header);
  top(1, "播放与概览：单一时钟", "播放、停止、循环和定位共用 App 音频时钟。\n概览平移同一视窗；波形与轨道共用刻度。\n关闭循环时范围标为“待循环”。\n当前不展示倍速或吸附控件。", transport);
  top(2, "保存：沿用 version: 1", "TimelineProject 已完成真实数据迁移。\n分组、轨道、事件、评论及可选颜色进 JSON。\n播放、显隐、锁定及栏宽为界面状态。\n本轮只同步文档，不修改真实标注。", save);
  const side = (right, i, title, body, target) => {
    const x = right ? 2760 : 40, y = 380 + i * 320;
    const tx = right ? target.x + target.width : target.x;
    const turn = right ? 2740 + i * 3 : 860 - i * 3;
    note(x, y, 800, 280, title, body, target, [[right ? x : x + 800, y + 140], [turn, y + 140], [turn, target.y + 10], [tx, target.y + 10]]);
  };
  side(false, 0, "波形：旧版深色 WaveSurfer", "138px 波形 + 24px 刻度；真实界面只读取真实分析包络。\n底 #0c1017，波形 #334155，播放进度 #0284c7。\n游标 #f43f5e；normalize: false；Regions 呈现选中及相邻区间。\n图中波形为固定公式合成，不代表歌曲分析结果。", wave);
  side(false, 1, "名称栏：最小两个全角字符", "固定 210px 改为默认/最小 64px；长名称显示“歌…”。\n右边界可拖动加宽，最多 360px，并为波形保留空间。\n双击恢复最窄；方向键 8px，Shift 微调 1px，Home/End。\n完整路径在悬停提示中；宽度仅属于当前页面状态。", resize);
  side(false, 2, "时间对齐与锁定轨道", "波形与所有轨道共用名称栏宽度，并补偿纵向滚动条占位。\nResizeObserver 随宽度变化重算缩放和可见起点。\n轨道锁定时，色标位置改为锁图标，避免挤压名称。\n时间输入、跳转和事件位置继续使用音频秒数。", resize);
  side(false, 3, "时间轴：图标与有效继承状态", "Group 可递归包含 Group 或 Timeline；时间轴持有事件。\n眼睛表示可见，锁表示已锁定；关闭态以 / 斜杠划去。\n图标保留文字提示和可访问名称，分组状态作用于下级。\n当前没有“自动分析候选”导航节点。", tree);
  side(false, 4, "更多菜单与操作提示", "桌面 ··· 在悬停、行内聚焦或选中时出现；触屏始终可见。\n预留菜单位置，避免行内容跳动，保留键盘入口。\n右键或 ··· 提供分层新建、重命名和删除。\n底部长说明改为可展开的“操作提示”。", tree);
  side(false, 5, "主题与文字层级", "页面 #f3f5f5，主面板 #ffffff，辅助面板 #f8fafa。\n选中底 #e7f2f2，强调色 #166b75，边框 #cbd2d6。\n正文 #263238，辅助字 #637079；常规按钮不统一加粗。\n正文完整不透明；状态颜色不能替代文字或控件含义。", agent);
  side(true, 0, "事件编辑：共用一套编辑器", "事件 ID、所属时间轴、标注内容和评论共用一套编辑器。\n不按歌词、节拍或分镜切换编辑器。字段不显示实现名。\n未选事件时提示选择；时间轴设置在中间面板标签页。\n界面名为“事件编辑”，类型仍为 TimelineEvent。", editor);
  side(true, 1, "时间与微调：减去套框", "分区使用留白和分隔线，起点/终点不再各套卡片。\n保留输入框和等宽数字，普通微调按钮降低边框重量。\n锁定提醒改为中性底和“已锁定”文字。\n点/区间转换与边界命令沿用原有语义。", timeAnchor);
  side(true, 2, "事件颜色：默认折叠", "收起仅显示色样和来源：跟随时间轴、自定义或预览中。\n展开提供原生选色、精确色值、预设色及跟随时间轴。\n确认/取消在折叠区外；未确认的预览不写入项目颜色。\n颜色解析：事件覆盖 → 时间轴颜色 → 默认 #166b75。", colorAnchor);
  side(true, 3, "相邻边界与切分", "默认独立，保留人声留白；联动与设为紧邻是不同动作。\n前后事件通过稳定 ID 定位，写入时再次检查继承锁。\n切分仅允许播放头位于区间内部。\n边界绑定为会话状态，JSON 保存操作后的起止时间。", boundaryAnchor);
  side(true, 4, "切点试听与评论", "固定 500ms 窗口；A/S/R/D/F 对应起点前后、整段及终点前后。\n评论角色使用普通文字，移除重复徽章和评论套框。\n备注、脚本想法和 Agent 回复统一为 comments。\n输入文字时不拦截试听快捷键；下一条标注只切换选择。", auditionAnchor);
  side(true, 5, "验证边界", "图件按当前源码绘制，为布局说明，不是运行截图。\n构建、lint 和隔离验证不等于实际浏览器交互验收。\n拖动、省略效果、触屏、播放定位和选色弹窗仍待实测。\n本轮不改音源、标注数据、运行逻辑或部署状态。", agent);
  const lower = (i, title, body, target) => note(900 + i * 610, 1540, 580, 420, title, body, target,
    [[1190 + i * 610, 1540], [1190 + i * 610, 1510], [target.x + 30, 1510], [target.x + 30, target.y + target.height]]);
  lower(0, "事件列表：正文与时间优先", "显示 ID/文本、起点、终点与评论摘要。\n点击选择，双击试听，Shift+单击连选。\n评论数量和最近角色从 comments 推导，\n使用普通辅助文字。\n“全部/含评论”筛选不修改原始数据。\n右键及 ··· 提供新建、切分和删除。", list);
  lower(1, "Agent 协作：汇总与定位", "栏名简化为“Agent 协作”。\n汇总项目、分组、时间轴和事件评论。\n提供评论导航、简报预览与复制。\n计数和角色使用普通文字。\n展开按钮保留可访问展开状态。\n简报是派生数据，不是第二份事实来源。", agent);
  lower(2, "设置与布局：当前实现边界", "时间轴颜色也默认折叠；预设色先预览。\n确认/取消在折叠区外，可恢复默认色。\n内部 ID 留在悬停提示，不常驻标题。\n三个工作区可拖动，Tracker 可调高。\n当前没有窄屏自动抽屉或布局持久化。\n完整规范见 README；运行源码为依据。", editor);
  doc.elements.push(...handwritten);
}
