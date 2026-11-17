import React from "react";
import {
  AbsoluteFill,
  Composition,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  ClawdVerse1Stage,
  type Verse1PropStageId,
} from "../components/ClawdVerse1Stage";

export const ClawdVerse1PropsComposition: React.FC = () => {
  return (
    <Composition
      id="ClawdVerse1Props"
      component={ClawdVerse1PropsShowcase}
      durationInFrames={420}
      fps={60}
      width={1280}
      height={720}
    />
  );
};

interface PropShowcaseItem {
  code: string;
  stageId: Verse1PropStageId;
  timeRange: string;
  title: string;
  cycleSec: number;
  stages: { label: string; end: number }[];
  note: string;
}

const VERSE1_PROP_ITEMS: PropShowcaseItem[] = [
  {
    code: "B1",
    stageId: "L006",
    timeRange: "00:38.4 → 00:40.8",
    title: "365日 GitHub Contribution 热力图",
    cycleSec: 2.8,
    stages: [
      { label: "右侧滑入", end: 0.16 },
      { label: "按周列扫描热力格(1→365)", end: 0.62 },
      { label: "随机深浅绿全勤+点头", end: 0.84 },
      { label: "右侧退场", end: 1.0 },
    ],
    note: "GitHub Contribution Graph 样式，每天热力格随机深浅绿区分",
  },
  {
    code: "B2",
    stageId: "L007",
    timeRange: "00:40.8 → 00:42.9",
    title: "五行气泡四语同时打字推进 + ...",
    cycleSec: 2.8,
    stages: [
      { label: "气泡展开", end: 0.08 },
      { label: "四行四语同时打字推进", end: 0.78 },
      { label: "第五行打出 ... 保留气泡", end: 1.0 },
    ],
    note: "Clawd 不张嘴，单个五行气泡前四行同时打字推进 + 第五行 ...",
  },
  {
    code: "B3",
    stageId: "L008",
    timeRange: "00:42.9 → 00:45.1",
    title: "两侧极简听众理解回应",
    cycleSec: 2.8,
    stages: [
      { label: "左右听众滑入看气泡", end: 0.24 },
      { label: "左听众点头 → 右听众点头", end: 0.6 },
      { label: "Clawd 弯眼点头", end: 0.74 },
      { label: "向两侧退场让位", end: 1.0 },
    ],
    note: "气泡与听众浮现同款 ★ 图形，句尾向两侧退场给眼镜/书让位",
  },
  {
    code: "B4",
    stageId: "L009",
    timeRange: "00:45.3 → 00:47.5",
    title: "左旋入白反光眼镜 + 右下书 + 深绿预训练场",
    cycleSec: 2.8,
    stages: [
      { label: "1.左旋入白反光眼镜", end: 0.28 },
      { label: "2.右下升起书本打开", end: 0.48 },
      { label: "3.背后无框渐淡深绿参数矩阵", end: 1.0 },
    ],
    note: "背后中心展开无边框四周渐淡的深绿半透明预训练参数矩阵",
  },
  {
    code: "B5",
    stageId: "L010",
    timeRange: "00:47.5 → 00:49.8",
    title: "三项能力汇成小奖章 + 有序清场",
    cycleSec: 2.8,
    stages: [
      { label: "Aa / </> / ◇ 依次点亮", end: 0.4 },
      { label: "汇成小奖章 + 抬头挺身", end: 0.7 },
      { label: "书右下退·镜左退·框上收", end: 1.0 },
    ],
    note: "抽象能力合成奖章，句尾按原方向退回道具为小号腾出画面",
  },
  {
    code: "B6",
    stageId: "L011",
    timeRange: "00:49.8 → 00:52.5",
    title: "铜管部小号入场接住与吹奏",
    cycleSec: 2.8,
    stages: [
      { label: "小号从右侧滑入接住", end: 0.22 },
      { label: "轻收吹奏 + 飘出几何音符", end: 0.76 },
      { label: "放低喇叭口向右送出", end: 1.0 },
    ],
    note: "前足接住抬到脸前吹奏，飘出两枚音符后向右送出恢复站姿",
  },
  {
    code: "B7",
    stageId: "L065",
    timeRange: "00:52.5 → 00:55.1",
    title: "(ほら！) 贴地回弹 + 红黄手写艺术字",
    cycleSec: 1.6,
    stages: [
      { label: "极短下压蓄力", end: 0.15 },
      { label: "瞬间回弹(^ ^)+弹出ほら！", end: 0.35 },
      { label: "留白期星形与文字淡出", end: 1.0 },
    ],
    note: "贴地快速回弹最高点从右上弹出红底黄边手写体与星形点缀",
  },
];

const SEQUENCE_ORDER: Verse1PropStageId[] = [
  "L006",
  "L007",
  "L008",
  "L009",
  "L010",
  "L011",
  "L065",
];

export const ClawdVerse1PropsShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeSec = frame / fps;

  // 第 8 张卡片：7 秒内按顺序连续演完 L006 -> L065（每段 1.0 秒），用于检查跨句交接
  const seqIndex = Math.min(6, Math.floor(timeSec % 7));
  const seqStageId = SEQUENCE_ORDER[seqIndex];
  const seqLocalProgress = timeSec % 1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#16151d",
        color: "#f8fafc",
        fontFamily: "monospace",
        padding: "16px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* 顶部标题栏 */}
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
            《Try Me》后半段（L006–L065，00:38 → 00:55）画外进出场道具与舞台组件库 (B1–B7)
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            遵循视觉规则：道具从画外进入、用后向原方向退场；跨句共享气泡与训练面板，不直接突变角色主体
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#4ade80",
            backgroundColor: "rgba(74, 222, 128, 0.14)",
            padding: "5px 10px",
            borderRadius: 8,
            whiteSpace: "nowrap",
          }}
        >
          Verse 1 道具舞台 · F{frame}
        </div>
      </div>

      {/* 4×2 舞台网格（前 7 格为独立原子道具卡片，第 8 格为 L006→L065 连续交接总览） */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gridTemplateRows: "repeat(2, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {VERSE1_PROP_ITEMS.map((item) => {
          const itemProgress = (timeSec / item.cycleSec) % 1;
          const activeStage =
            item.stages.find((s) => itemProgress <= s.end) ??
            item.stages[item.stages.length - 1];

          return (
            <div
              key={item.code}
              style={{
                backgroundColor: "#23212c",
                border: "1.5px solid #353244",
                borderRadius: 12,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 0,
              }}
            >
              {/* 卡片头部 */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      backgroundColor: "#d87757",
                      color: "#16151d",
                      fontWeight: 700,
                      fontSize: 10,
                      padding: "1px 5px",
                      borderRadius: 4,
                    }}
                  >
                    {item.code} · {item.stageId}
                  </span>
                  <span style={{ fontSize: 10, color: "#38bdf8" }}>
                    {item.timeRange}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    marginTop: 4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.title}
                </div>
              </div>

              {/* 道具舞台预览区 */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "#191822",
                  borderRadius: 8,
                  border: "1px solid #2d2a3a",
                  overflow: "hidden",
                }}
              >
                <ClawdVerse1Stage
                  stageId={item.stageId}
                  progress={itemProgress}
                  scale={0.95}
                />
              </div>

              {/* 底部阶段与进度 */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: "#f5c542",
                    marginBottom: 4,
                  }}
                >
                  <span>▸ {activeStage.label}</span>
                  <span>{(itemProgress * 100).toFixed(0)}%</span>
                </div>
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
                      backgroundColor: "#38bdf8",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 9.5,
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

        {/* 第 8 格：L006 → L065 连续交接总览舞台 */}
        <div
          style={{
            backgroundColor: "#1e2230",
            border: "1.5px solid #4ade80",
            borderRadius: 12,
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 0,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  backgroundColor: "#4ade80",
                  color: "#0f172a",
                  fontWeight: 800,
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 4,
                }}
              >
                B8 · 连续交接预演
              </span>
              <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 700 }}>
                当前: {seqStageId} ({seqIndex + 1}/7)
              </span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
              L006 → L065 跨句道具连续交接
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "#141722",
              borderRadius: 8,
              border: "1px solid #334155",
              overflow: "hidden",
            }}
          >
            <ClawdVerse1Stage
              stageId={seqStageId}
              progress={seqLocalProgress}
              scale={0.95}
            />
          </div>

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 2,
                marginBottom: 4,
              }}
            >
              {SEQUENCE_ORDER.map((sid, idx) => (
                <span
                  key={sid}
                  style={{
                    fontSize: 8.5,
                    padding: "1px 3px",
                    borderRadius: 3,
                    backgroundColor:
                      idx === seqIndex
                        ? "#4ade80"
                        : idx < seqIndex
                          ? "#334155"
                          : "#14131a",
                    color: idx === seqIndex ? "#0f172a" : "#94a3b8",
                    fontWeight: idx === seqIndex ? 800 : 400,
                  }}
                >
                  {sid}
                </span>
              ))}
            </div>
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
                  width: `${((seqIndex + seqLocalProgress) / 7) * 100}%`,
                  height: "100%",
                  backgroundColor: "#4ade80",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 9.5,
                color: "#cbd5e1",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              自动连播验证：气泡转听众 → 眼镜与书清场 → 小号退出 → ほら回弹
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
