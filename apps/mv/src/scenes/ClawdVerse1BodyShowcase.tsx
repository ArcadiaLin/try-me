import React from "react";
import {
  AbsoluteFill,
  Composition,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ClawdAction, ClawdMascot } from "../components/ClawdMascot";

export const ClawdVerse1BodyComposition: React.FC = () => {
  return (
    <Composition
      id="ClawdVerse1Body"
      component={ClawdVerse1BodyShowcase}
      durationInFrames={360}
      fps={60}
      width={1280}
      height={720}
    />
  );
};

interface Verse1ActionItem {
  code: string;
  eventId: string;
  timeRange: string;
  title: string;
  action: ClawdAction;
  stages: { label: string; end: number }[];
  note: string;
}

const VERSE1_BODY_ACTIONS: Verse1ActionItem[] = [
  {
    code: "A1",
    eventId: "L066",
    timeRange: "00:00.0 → 00:18.2",
    title: "渐进待机与左右换重心",
    action: "weight-shift",
    stages: [
      { label: "左移重心", end: 0.5 },
      { label: "右移重心", end: 1.0 },
    ],
    note: "足底贴地不动，上半身水平换重心 + 视线跟随",
  },
  {
    code: "A2",
    eventId: "L001",
    timeRange: "00:18.5 → 00:22.7",
    title: "短挥手 + 重心前送 + 小蹲起",
    action: "wave-step",
    stages: [
      { label: "短挥手", end: 0.38 },
      { label: "前送走到面试位", end: 0.64 },
      { label: "自信小蹲起", end: 1.0 },
    ],
    note: "单次短挥手后向前送重心，不連続挥手抢戏",
  },
  {
    code: "A3",
    eventId: "L002",
    timeRange: "00:22.7 → 00:27.1",
    title: "侧身歪头 + 前足邀请等待",
    action: "tilt-invite",
    stages: [
      { label: "歪头伸手邀请", end: 0.28 },
      { label: "停顿等你提问", end: 0.72 },
      { label: "留白视线回正", end: 1.0 },
    ],
    note: "眼神朝空白处等待回应，停顿留出喜感后回正",
  },
  {
    code: "A4",
    eventId: "L003",
    timeRange: "00:27.1 → 00:31.6",
    title: "收拢挺身 + 两次差幅点头",
    action: "posture-nod",
    stages: [
      { label: "收拢姿态", end: 0.24 },
      { label: "抬头挺身", end: 0.46 },
      { label: "轻点头 → 深点头", end: 0.84 },
      { label: "回看镜头", end: 1.0 },
    ],
    note: "两次不同幅度点头形成层次，句尾视线锁回镜头",
  },
  {
    code: "A5",
    eventId: "L004",
    timeRange: "00:31.6 → 00:34.0",
    title: "前足指自己 + 向外展开展示",
    action: "self-present",
    stages: [
      { label: "前足朝自己示意", end: 0.44 },
      { label: "双足向外展开", end: 0.84 },
      { label: "微挺身待命", end: 1.0 },
    ],
    note: "胸前内折示意后向外展开，表现“看看我的本事”",
  },
  {
    code: "A6",
    eventId: "L064",
    timeRange: "00:34.0 → 00:36.3",
    title: "贴地单次下压回正 + 侧向预倾",
    action: "crouch-lean",
    stages: [
      { label: "贴地下压回正", end: 0.42 },
      { label: "轻待机呼吸", end: 0.72 },
      { label: "向旁预倾铺垫", end: 1.0 },
    ],
    note: "足端贴地不跳跃，句尾向右侧预倾衔接 L005",
  },
  {
    code: "A7",
    eventId: "L005",
    timeRange: "00:36.3 → 00:38.4",
    title: "侧向探身张手 + 视线引出日历",
    action: "peek-present",
    stages: [
      { label: "侧移探身张手", end: 0.46 },
      { label: "落回原舞台位", end: 0.74 },
      { label: "视线移向日历侧", end: 1.0 },
    ],
    note: "表达“随叫随到”，句尾视线提前引出右侧日历",
  },
  {
    code: "A8",
    eventId: "L009–L010",
    timeRange: "00:45.3 → 00:49.8",
    title: "低头微翻页阅读 → 抬头挺身",
    action: "read-look-up",
    stages: [
      { label: "低头扫视微翻页", end: 0.56 },
      { label: "书后抬头挺身", end: 1.0 },
    ],
    note: "读书时不大幅蹲起，L010 从书后自信抬头挺身",
  },
  {
    code: "A9",
    eventId: "L065 (ほら！)",
    timeRange: "00:52.5 → 00:55.1",
    title: "贴地蓄力 → 快速弹性回弹 (+微笑弯眼)",
    action: "elastic-pop",
    stages: [
      { label: "极短下压蓄力", end: 0.14 },
      { label: "瞬间弹起(^ ^)!", end: 0.28 },
      { label: "微回摆稳住", end: 1.0 },
    ],
    note: "7% 区间内瞬间回弹 + 原子化微笑弯眼 eyes=\"happy\"",
  },
];

export const ClawdVerse1BodyShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeSec = frame / fps;

  // 常规动作 3 秒一周期；A9 贴地回弹按 1.5 秒快速周期演示爆发感
  const cycleProgress = (timeSec / 3.0) % 1;
  const fastPopProgress = (timeSec / 1.5) % 1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#16151d",
        color: "#f8fafc",
        fontFamily: "monospace",
        padding: "16px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* 顶部标题栏与全局句内进度指示器 */}
      <div
        style={{
          backgroundColor: "#1d1b26",
          border: "1px solid #353244",
          borderRadius: 10,
          padding: "10px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>
            《Try Me》前半段（截至「ほら！」00:00 → 00:55）本体动作库 (A1–A9)
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            遵循脚本与 Agent 建议：足端严格贴地 (y=10)、单次叙事包络（挥手→前送→蹲起 / 蹲起→预倾→探身→视线导引）
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#f5c542",
              backgroundColor: "rgba(245, 197, 66, 0.14)",
              padding: "5px 10px",
              borderRadius: 8,
              whiteSpace: "nowrap",
            }}
          >
            actionProgress = {(cycleProgress * 100).toFixed(0)}% (F{frame})
          </div>
        </div>
      </div>

      {/* 3×3 动作网格 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(3, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        {VERSE1_BODY_ACTIONS.map((item) => {
          const itemProgress =
            item.code === "A9" ? fastPopProgress : cycleProgress;
          const activeStage =
            item.stages.find((s) => itemProgress <= s.end) ??
            item.stages[item.stages.length - 1];
          const isHighlightMoment =
            item.code === "A9" && itemProgress >= 0.14 && itemProgress <= 0.34;
          const itemEyes =
            item.code === "A9" && itemProgress >= 0.16 ? "happy" : "normal";

          return (
            <div
              key={item.code}
              style={{
                backgroundColor: "#23212c",
                border: `1.5px solid ${
                  isHighlightMoment ? "#f5c542" : "#353244"
                }`,
                borderRadius: 10,
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                minHeight: 0,
              }}
            >
              {/* 卡片头部：编号 + 事件 ID + 当前阶段胶囊 */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      backgroundColor: "#d87757",
                      color: "#16151d",
                      fontWeight: 700,
                      fontSize: 11,
                      padding: "1px 5px",
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  >
                    {item.code}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.title}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: "#38bdf8",
                    backgroundColor: "rgba(56, 189, 248, 0.12)",
                    padding: "2px 6px",
                    borderRadius: 4,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {item.eventId} ({item.timeRange})
                </span>
              </div>

              {/* 角色舞台与贴地基准线 */}
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: 92,
                }}
              >
                {/* 地面贴地参考虚线 */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 12,
                    left: "18%",
                    right: "18%",
                    borderBottom: "1px dashed rgba(148, 163, 184, 0.3)",
                  }}
                />
                <ClawdMascot
                  width={122}
                  action={item.action}
                  actionProgress={itemProgress}
                  eyes={itemEyes}
                />
              </div>

              {/* 底部阶段进度条与说明 */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: "#e2e8f0",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: "#f5c542" }}>
                    ▸ 当前阶段：{activeStage.label}
                  </span>
                  <span style={{ color: "#94a3b8" }}>
                    action=&quot;{item.action}&quot;
                  </span>
                </div>
                {/* 句内进度条 */}
                <div
                  style={{
                    width: "100%",
                    height: 4,
                    backgroundColor: "#14131a",
                    borderRadius: 2,
                    overflow: "hidden",
                    marginBottom: 4,
                  }}
                >
                  <div
                    style={{
                      width: `${itemProgress * 100}%`,
                      height: "100%",
                      backgroundColor: isHighlightMoment ? "#f5c542" : "#38bdf8",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#94a3b8",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.note}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
