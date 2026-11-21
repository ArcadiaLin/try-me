import React from "react";
import { interpolate } from "remotion";
import { getStumbleLeftKinematics } from "../animation/clawd/actions";
import { Clawd as ClawdMascot } from "./clawd/Clawd";
import {
  getContributionLevel,
  GITHUB_HEAT_COLORS,
  PARAM_TOKENS,
} from "./environment";
import { POP_PALETTE } from "../styles/palette";

export type Verse1PropStageId =
  | "L006"
  | "L007"
  | "L008"
  | "L009"
  | "L010"
  | "L011"
  | "L065";

export interface ClawdVerse1StageProps {
  /** 对应 Verse 1 后半段的歌词事件 ID */
  stageId: Verse1PropStageId;
  /** 句内归一化进度 (0 ~ 1) */
  progress: number;
  /** 舞台缩放比例（默认 1.0，基准舞台尺寸为 280×156） */
  scale?: number;
}

const MULTILANG_LINES = [
  {
    lang: "EN",
    text: "I speak different languages",
    color: POP_PALETTE.mint,
    start: 0.06,
    end: 0.78,
  },
  {
    lang: "ZH",
    text: "我会说不同的语言",
    color: POP_PALETTE.amberMid,
    start: 0.06,
    end: 0.78,
  },
  {
    lang: "JA",
    text: "いろんな言葉が話せるよ",
    color: POP_PALETTE.pinkLight,
    start: 0.06,
    end: 0.78,
  },
  {
    lang: "ES",
    text: "Hablo diferentes idiomas",
    color: POP_PALETTE.lime,
    start: 0.06,
    end: 0.78,
  },
  {
    lang: "MORE",
    text: "...",
    color: "#94A3B8",
    start: 0.76,
    end: 0.94,
  },
];

/**
 * 《Try Me》Verse 1 后半段（L006–L065）原子舞台与画外进出场道具组件
 *
 * 严格遵循脚本与 Agent 建议：
 * - 道具从画外进入，用后向原方向退场，保持 Clawd 本体与舞台连续；
 * - 跨句共享道具状态（L007 气泡交接给 L008 听众；L009 眼镜/书/训练框交接给 L010 奖章与清场）。
 */
export const ClawdVerse1Stage: React.FC<ClawdVerse1StageProps> = ({
  stageId,
  progress,
  scale = 1,
}) => {
  const p = Math.max(0, Math.min(1, progress));

  // 1. 计算 Clawd 本体在不同事件阶段的姿态与耦合道具参数（保持固定 width=110，跨句位移平滑衔接）
  let clawdOffsetX = 0;
  let mascotProps: React.ComponentProps<typeof ClawdMascot> = {
    width: 110,
    action: "idle",
    actionProgress: p,
  };

  if (stageId === "L006") {
    // 承接 L005 从偏右落点 (-24) 靠左两足一踮一踮向左连续三小跳到达最终位置 (-62)，落点触地瞬间完全锁定不滑步！
    const isStumble = p < 0.34;
    const isSnappyNod = p >= 0.64 && p <= 0.9;
    const stumbleP = isStumble ? p / 0.34 : 1;
    const { currentXRatio } = getStumbleLeftKinematics(stumbleP);
    clawdOffsetX = -24 + (-62 - -24) * currentXRatio;
    mascotProps = {
      width: 110,
      action: isStumble ? "stumble-left" : isSnappyNod ? "snappy-nod" : "idle",
      actionProgress: isStumble
        ? stumbleP
        : isSnappyNod
          ? (p - 0.64) / 0.26
          : p,
      eyes: p < 0.29 ? "wince" : isSnappyNod ? "happy" : "normal",
      lookOffset: {
        x: interpolate(p, [0, 0.34, 0.85, 1], [-0.25, 0.5, 0.5, 0.42]),
        y: interpolate(p, [0, 0.85, 1], [-0.05, -0.05, -0.18]),
      },
    };
  } else if (stageId === "L007") {
    // 容纳五行的单个大气泡打字显示：Clawd 本体不做张嘴说话，偏左站立，句末略向中回移衔接 L008
    clawdOffsetX = interpolate(p, [0, 0.85, 1], [-62, -62, -46], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    mascotProps = {
      width: 110,
      action: "weight-shift",
      actionProgress: p,
      mouth: "none",
      lookOffset: { x: 0.42, y: -0.18 },
    };
  } else if (stageId === "L008") {
    // 承接 L007 偏左位置平滑移回中央 (0~0.24)，两侧极简听众理解回应，Clawd 弯眼点头回应
    clawdOffsetX = interpolate(p, [0, 0.24, 1], [-46, 0, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const replyNod = p >= 0.48 && p <= 0.78;
    mascotProps = {
      width: 110,
      action: replyNod ? "posture-nod" : "idle",
      actionProgress: replyNod ? 0.62 + ((p - 0.48) / 0.3) * 0.22 : p,
      eyes: p >= 0.45 && p <= 0.85 ? "happy" : "normal",
      lookOffset: {
        x: interpolate(
          p,
          [0, 0.18, 0.42, 0.52, 0.68, 0.85, 1],
          [0.42, -0.28, -0.28, 0.28, 0.28, 0, 0],
        ),
        y: interpolate(p, [0, 0.2, 0.85, 1], [-0.18, -0.08, -0.08, 0]),
      },
    };
  } else if (stageId === "L009") {
    // L009: 眼镜与 3D 书本同时入场 (0.04~0.24，适中速度)，双手从身体两侧滑向胸前捧书阅读
    const simultaneousIn = interpolate(p, [0.04, 0.24], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    mascotProps = {
      width: 110,
      action: "read-look-up",
      actionProgress: interpolate(p, [0, 1], [0, 0.52]),
      prop: "book",
      glassesProgress: simultaneousIn,
      bookProgress: simultaneousIn,
    };
  } else if (stageId === "L010") {
    // L010: 承接眼镜与书本，从书后抬头挺身；句尾 (0.72~0.92) 眼镜与书本同时向另一侧退场离开 (1 -> 2)
    clawdOffsetX = interpolate(p, [0, 0.82, 1], [0, 0, -16], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const simultaneousOutOpposite = interpolate(p, [0.72, 0.92], [1, 2], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    mascotProps = {
      width: 110,
      action: "read-look-up",
      actionProgress: interpolate(p, [0, 0.75, 1], [0.52, 0.92, 1]),
      prop: "book",
      glassesProgress: simultaneousOutOpposite,
      bookProgress: simultaneousOutOpposite,
    };
  } else if (stageId === "L011") {
    // L011: 小号从右侧滑入、接住吹奏、放低送出
    clawdOffsetX = -16;
    const playBody =
      p >= 0.22 && p <= 0.76
        ? Math.sin(((p - 0.22) / 0.54) * Math.PI) * 0.25
        : 0;
    mascotProps = {
      width: 110,
      action: "idle",
      actionProgress: p,
      prop: "trumpet",
      trumpetProgress: p,
      beatPulse: playBody,
      lookOffset: {
        x: interpolate(p, [0, 0.15, 0.82, 1], [0, 0.28, 0.28, 0]),
        y: interpolate(p, [0, 0.15, 0.82, 1], [0, -0.08, -0.08, 0]),
      },
    };
  } else if (stageId === "L065") {
    // L065 (ほら！): 贴地短蓄力 -> 快速伸展回弹 + 微笑弯眼 (^ ^)
    clawdOffsetX = interpolate(p, [0, 0.7, 1], [-16, -16, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    mascotProps = {
      width: 110,
      action: "elastic-pop",
      actionProgress: p,
      eyes: p >= 0.15 && p <= 0.88 ? "happy" : "normal",
    };
  }

  return (
    <div
      style={{
        width: 280 * scale,
        height: 152 * scale,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 280,
          height: 152,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          paddingBottom: 10,
        }}
      >
        {/* 舞台地面贴地参考虚线 */}
        <div
          style={{
            position: "absolute",
            bottom: 18,
            left: 24,
            right: 24,
            borderBottom: "1px dashed rgba(148, 163, 184, 0.28)",
          }}
        />

        {/* ==================== L006: GitHub Contribution Graph 风格 365 全勤热力图（右进右出） ==================== */}
        {stageId === "L006" && (() => {
          const slideEnv = interpolate(
            p,
            [0, 0.16, 0.84, 1],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const calX = interpolate(slideEnv, [0, 1], [130, 0]);
          const totalCols = 18;
          const totalRows = 7;
          const totalCells = totalCols * totalRows;
          // 0.16 ~ 0.62 期间按周列从左到右、从上到下快速扫过全部热力格
          const scanProgress = interpolate(p, [0.16, 0.62], [0, totalCells], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const activeCell = Math.floor(scanProgress);
          const isAllDone = p >= 0.62;
          const displayDays = Math.round(
            interpolate(p, [0.16, 0.62], [1, 365], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          );

          return (
            <div
              style={{
                position: "absolute",
                right: 12,
                top: 14,
                width: 142,
                backgroundColor: "#0D1117",
                border: `2px solid ${isAllDone ? "#39D353" : "#30363D"}`,
                borderRadius: 8,
                padding: "6px 8px",
                transform: `translateX(${calX}px)`,
                opacity: interpolate(slideEnv, [0, 0.2, 1], [0, 1, 1]),
                boxShadow: isAllDone
                  ? "0 0 12px rgba(57, 211, 83, 0.32)"
                  : "none",
                fontFamily: "monospace",
              }}
            >
              {/* 页眉：365 贡献数字 + 全勤状态 */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 5,
                  paddingBottom: 3,
                  borderBottom: "1px solid #21262D",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    color: isAllDone ? "#39D353" : "#F0F6FC",
                    lineHeight: 1,
                  }}
                >
                  {displayDays}d
                </span>
                <span
                  style={{
                    fontSize: 7.5,
                    fontWeight: 800,
                    color: isAllDone ? "#0D1117" : "#8B949E",
                    backgroundColor: isAllDone ? "#39D353" : "#21262D",
                    padding: "1px 4px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                  }}
                >
                  {isAllDone ? "STREAK ✓" : "CONTRIBUTIONS"}
                </span>
              </div>

              {/* 7 行 × 18 列 GitHub 风格贡献热力矩阵（每天有随机深浅区分） */}
              <div
                style={{
                  display: "grid",
                  gridTemplateRows: `repeat(${totalRows}, 5px)`,
                  gridAutoFlow: "column",
                  gridAutoColumns: "5px",
                  gap: 1.8,
                  justifyContent: "center",
                }}
              >
                {Array.from({ length: totalCells }).map((_, idx) => {
                  const isScanned = idx < activeCell || isAllDone;
                  const isFrontier =
                    !isAllDone &&
                    p >= 0.16 &&
                    idx >= activeCell - 1 &&
                    idx <= activeCell;
                  const level = getContributionLevel(idx);
                  return (
                    <div
                      key={idx}
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 1.2,
                        backgroundColor: isFrontier
                          ? "#86EFAC"
                          : isScanned
                            ? GITHUB_HEAT_COLORS[level]
                            : "#161B22",
                        transform: isFrontier ? "scale(1.2)" : "scale(1)",
                      }}
                    />
                  );
                })}
              </div>

              {/* 底部 Less / More 迷你图例 */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 2,
                  marginTop: 5,
                  fontSize: 6.5,
                  fontWeight: 700,
                  color: "#8B949E",
                }}
              >
                <span>Less</span>
                <span
                  style={{
                    width: 4.5,
                    height: 4.5,
                    borderRadius: 1,
                    backgroundColor: "#161B22",
                  }}
                />
                {GITHUB_HEAT_COLORS.map((c) => (
                  <span
                    key={c}
                    style={{
                      width: 4.5,
                      height: 4.5,
                      borderRadius: 1,
                      backgroundColor: c,
                    }}
                  />
                ))}
                <span>More</span>
              </div>
            </div>
          );
        })()}

        {/* ==================== L007: 容纳五行的单个大气泡（前四行打字显示四语歌词，第五行 ...） ==================== */}
        {stageId === "L007" && (() => {
          const bubbleIn = interpolate(p, [0, 0.08], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 188,
                transform: `scale(${interpolate(bubbleIn, [0, 1], [0.85, 1])})`,
                transformOrigin: "bottom left",
                opacity: bubbleIn,
                backgroundColor: "#F8FAFC",
                color: POP_PALETTE.ink,
                border: "2px solid #11131F",
                borderRadius: 9,
                padding: "5px 7px",
                display: "flex",
                flexDirection: "column",
                gap: 2.5,
                zIndex: 5,
                boxShadow: "0 4px 10px rgba(0, 0, 0, 0.3)",
              }}
            >
              {MULTILANG_LINES.map((line, idx) => {
                const lineProg = interpolate(p, [line.start, line.end], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const charsToShow = Math.round(lineProg * line.text.length);
                const visibleText = line.text.slice(0, charsToShow);
                const isTypingNow = p >= line.start && p < line.end;
                const isStarted = p >= line.start;

                return (
                  <div
                    key={line.lang}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      minHeight: 13.5,
                      opacity: isStarted ? 1 : 0.22,
                    }}
                  >
                    {idx < 4 ? (
                      <span
                        style={{
                          fontSize: 7,
                          fontWeight: 800,
                          padding: "0px 3px",
                          borderRadius: 2.5,
                          backgroundColor: isStarted ? line.color : "#CBD5E1",
                          color: POP_PALETTE.ink,
                          flexShrink: 0,
                        }}
                      >
                        {line.lang}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 7.5,
                          fontWeight: 800,
                          color: "#64748B",
                          width: 15,
                          textAlign: "center",
                          flexShrink: 0,
                        }}
                      >
                        +
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: idx === 4 ? 10.5 : 8.2,
                        fontWeight: 700,
                        color: POP_PALETTE.ink,
                        whiteSpace: "nowrap",
                        letterSpacing: -0.2,
                      }}
                    >
                      {visibleText}
                      {isTypingNow && (
                        <span
                          style={{
                            display: "inline-block",
                            width: 3.5,
                            height: 8.5,
                            backgroundColor: POP_PALETTE.ink,
                            marginLeft: 1,
                            verticalAlign: "middle",
                          }}
                        />
                      )}
                    </span>
                  </div>
                );
              })}
              {/* 指向左侧 Clawd 的气泡尖角 */}
              <div
                style={{
                  position: "absolute",
                  left: -7,
                  bottom: 14,
                  width: 0,
                  height: 0,
                  borderTop: "5px solid transparent",
                  borderBottom: "5px solid transparent",
                  borderRight: "7px solid #F8FAFC",
                }}
              />
            </div>
          );
        })()}

        {/* ==================== L008: 延续五行气泡 + 两侧极简听众理解点头与退场 ==================== */}
        {stageId === "L008" && (() => {
          // 0~0.20 两侧听众滑入；0.20~0.72 先后点头理解同一图形；0.72~1.0 向两侧退场让位
          const stagePresence = interpolate(
            p,
            [0, 0.18, 0.74, 0.96, 1],
            [0, 1, 1, 0, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const bubbleExit = interpolate(p, [0.76, 0.96], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          // 左听众在 0.24~0.46 点头，右听众在 0.38~0.60 点头
          const leftNod =
            p >= 0.24 && p <= 0.46
              ? Math.sin(((p - 0.24) / 0.22) * Math.PI) * 5
              : 0;
          const rightNod =
            p >= 0.38 && p <= 0.6
              ? Math.sin(((p - 0.38) / 0.22) * Math.PI) * 5
              : 0;
          const leftGotIt = p >= 0.24 && p <= 0.78;
          const rightGotIt = p >= 0.38 && p <= 0.78;

          const bubbleMove = interpolate(p, [0, 0.22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const bubbleRight = interpolate(bubbleMove, [0, 1], [8, 46]);
          const bubbleTop = interpolate(bubbleMove, [0, 1], [8, 4]);
          const bubbleScale =
            interpolate(bubbleMove, [0, 1], [1, 0.76]) * bubbleExit;

          return (
            <>
              {/* 延续自 L007 的五行多语言气泡（从右侧平滑移至中央上方并缩略，右侧附带代表传达同一含义的 ★ 徽章） */}
              <div
                style={{
                  position: "absolute",
                  top: bubbleTop,
                  right: bubbleRight,
                  transform: `scale(${bubbleScale})`,
                  transformOrigin: "top center",
                  opacity: bubbleExit,
                  backgroundColor: "#F8FAFC",
                  border: "2px solid #11131F",
                  borderRadius: 9,
                  padding: "4px 8px",
                  width: 188,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  zIndex: 5,
                }}
              >
                {MULTILANG_LINES.map((line, idx) => (
                  <div
                    key={line.lang}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      minHeight: 11,
                    }}
                  >
                    {idx < 4 ? (
                      <span
                        style={{
                          fontSize: 6.5,
                          fontWeight: 800,
                          padding: "0px 2.5px",
                          borderRadius: 2,
                          backgroundColor: line.color,
                          color: POP_PALETTE.ink,
                        }}
                      >
                        {line.lang}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 7,
                          fontWeight: 800,
                          color: "#64748B",
                          width: 14,
                          textAlign: "center",
                        }}
                      >
                        +
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 7.8,
                        fontWeight: 700,
                        color: POP_PALETTE.ink,
                        whiteSpace: "nowrap",
                        letterSpacing: -0.2,
                      }}
                    >
                      {line.text}
                    </span>
                  </div>
                ))}
                {/* 气泡右上角浮现同款理解 ★ 图形 */}
                <div
                  style={{
                    position: "absolute",
                    right: -8,
                    bottom: -6,
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    backgroundColor: POP_PALETTE.yellowDeep,
                    border: "1.5px solid #11131F",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: 11,
                    fontWeight: 900,
                    color: POP_PALETTE.ink,
                  }}
                >
                  ★
                </div>
              </div>

              {/* 左侧极简听众（冷灰蓝轮廓 + 小圆帽檐配件） */}
              <div
                style={{
                  position: "absolute",
                  left: 16,
                  bottom: 18,
                  transform: `translateX(${interpolate(
                    stagePresence,
                    [0, 1],
                    [-56, 0],
                  )}px) translateY(${leftNod}px)`,
                  opacity: stagePresence,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                {/* 听众头顶浮现与气泡内完全相同的理解小图形 */}
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    backgroundColor: POP_PALETTE.yellowDeep,
                    border: "1px solid #11131F",
                    fontSize: 8,
                    fontWeight: 800,
                    color: POP_PALETTE.ink,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 4,
                    opacity: leftGotIt ? 1 : 0,
                    transform: `scale(${leftGotIt ? 1 : 0.5})`,
                  }}
                >
                  ★
                </div>
                <svg width={44} height={42} viewBox="0 0 10 10">
                  {/* 极简小帽檐配件 */}
                  <rect x={2} y={0.8} width={6.5} height={1.1} fill={POP_PALETTE.mint} />
                  {/* 极简听众方块主体 */}
                  <rect
                    x={1.5}
                    y={1.8}
                    width={6.5}
                    height={5.8}
                    fill="#64748B"
                    stroke="#11131F"
                    strokeWidth={0.4}
                  />
                  {/* 视线朝向中央气泡 */}
                  <rect x={3.8} y={3.1} width={0.8} height={1.5} fill={POP_PALETTE.ink} />
                  <rect x={6.0} y={3.1} width={0.8} height={1.5} fill={POP_PALETTE.ink} />
                  <rect x={2.5} y={7.6} width={1.1} height={2.2} fill="#64748B" />
                  <rect x={5.8} y={7.6} width={1.1} height={2.2} fill="#64748B" />
                </svg>
              </div>

              {/* 右侧极简听众（青绿灰轮廓 + 头顶小天线配件） */}
              <div
                style={{
                  position: "absolute",
                  right: 16,
                  bottom: 18,
                  transform: `translateX(${interpolate(
                    stagePresence,
                    [0, 1],
                    [56, 0],
                  )}px) translateY(${rightNod}px)`,
                  opacity: stagePresence,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    backgroundColor: POP_PALETTE.yellowDeep,
                    border: "1px solid #11131F",
                    fontSize: 8,
                    fontWeight: 800,
                    color: POP_PALETTE.ink,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 4,
                    opacity: rightGotIt ? 1 : 0,
                    transform: `scale(${rightGotIt ? 1 : 0.5})`,
                  }}
                >
                  ★
                </div>
                <svg width={44} height={42} viewBox="0 0 10 10">
                  {/* 极简小呆毛/发卡配件 */}
                  <rect x={4.6} y={0.3} width={0.9} height={1.5} fill={POP_PALETTE.pinkLight} />
                  <rect x={3.8} y={0.3} width={2.4} height={0.7} fill={POP_PALETTE.pinkLight} />
                  {/* 极简听众方块主体 */}
                  <rect
                    x={2.0}
                    y={1.8}
                    width={6.5}
                    height={5.8}
                    fill="#4D7C73"
                    stroke="#11131F"
                    strokeWidth={0.4}
                  />
                  {/* 视线朝向中央气泡 */}
                  <rect x={3.2} y={3.1} width={0.8} height={1.5} fill={POP_PALETTE.ink} />
                  <rect x={5.4} y={3.1} width={0.8} height={1.5} fill={POP_PALETTE.ink} />
                  <rect x={3.0} y={7.6} width={1.1} height={2.2} fill="#4D7C73" />
                  <rect x={6.3} y={7.6} width={1.1} height={2.2} fill="#4D7C73" />
                </svg>
              </div>
            </>
          );
        })()}

        {/* ==================== L009–L010: Clawd 背后中心区域无边框、四周渐淡的深绿色半透明预训练参数矩阵背景 ==================== */}
        {(stageId === "L009" || stageId === "L010") && (() => {
          // L009: 在眼镜与书本入场时从中心柔和浮现 (0.18->0.46)；L010: 持续在背后收敛演进，并在句尾 (0.74->0.96) 随道具一同渐隐
          const fieldOpacity =
            stageId === "L009"
              ? interpolate(p, [0.16, 0.45], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : interpolate(p, [0, 0.74, 0.96], [1, 1, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
          const globalTrainPhase = stageId === "L009" ? p : 1 + p;
          const wavePos = (globalTrainPhase * 2.6) % 1;
          const stepTick = Math.floor(globalTrainPhase * 24);

          return (
            <div
              style={{
                position: "absolute",
                left: 14,
                right: 14,
                top: 6,
                bottom: 14,
                opacity: fieldOpacity,
                zIndex: 1,
                pointerEvents: "none",
                // 无边框深绿色半透明矩形，四周边缘通过径向渐变与遮罩平滑减淡
                background:
                  "radial-gradient(ellipse 78% 76% at 50% 54%, rgba(6, 78, 59, 0.74) 0%, rgba(6, 78, 59, 0.44) 55%, rgba(6, 78, 59, 0) 100%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 80% 78% at 50% 54%, rgba(0,0,0,1) 34%, rgba(0,0,0,0.68) 68%, rgba(0,0,0,0) 100%)",
                maskImage:
                  "radial-gradient(ellipse 80% 78% at 50% 54%, rgba(0,0,0,1) 34%, rgba(0,0,0,0.68) 68%, rgba(0,0,0,0) 100%)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
              }}
            >
              {/* 底层：神经网络层间权重连线 + 前向/反向梯度传播波 + Loss 下降收敛曲线 */}
              <svg
                width={252}
                height={132}
                viewBox="0 0 252 132"
                style={{ position: "absolute", inset: 0 }}
              >
                {/* 层间参数权重网格连线 */}
                {[28, 76, 126, 176, 224].map((lx, colIdx) =>
                  [22, 50, 78, 106].map((ly, rowIdx) => {
                    const nextX = lx + 48;
                    if (colIdx >= 4) return null;
                    const edgeActive =
                      Math.abs(colIdx / 4 - wavePos) < 0.28 ||
                      (stepTick + colIdx + rowIdx) % 3 === 0;
                    return (
                      <g key={`e-${colIdx}-${rowIdx}`}>
                        <line
                          x1={lx}
                          y1={ly}
                          x2={nextX}
                          y2={22 + ((rowIdx + 1) % 4) * 28}
                          stroke={
                            edgeActive
                              ? "rgba(52, 211, 153, 0.34)"
                              : "rgba(16, 185, 129, 0.12)"
                          }
                          strokeWidth={edgeActive ? 1.1 : 0.6}
                        />
                        <line
                          x1={lx}
                          y1={ly}
                          x2={nextX}
                          y2={ly}
                          stroke="rgba(16, 185, 129, 0.16)"
                          strokeWidth={0.6}
                          strokeDasharray="2 2"
                        />
                      </g>
                    );
                  }),
                )}

                {/* 梯度扫描光带 */}
                <rect
                  x={wavePos * 230}
                  y={8}
                  width={28}
                  height={116}
                  fill="rgba(52, 211, 153, 0.14)"
                />

                {/* 预训练 Loss 衰减收敛折线 */}
                <polyline
                  fill="none"
                  stroke="rgba(110, 231, 183, 0.42)"
                  strokeWidth={1.4}
                  points="18,26 52,48 88,64 126,78 164,88 202,94 234,97"
                />
              </svg>

              {/* 表层：8×5 复杂参数张量矩阵（权重热力色块 + 微缩梯度符号实时跳动） */}
              <div
                style={{
                  width: 224,
                  height: 108,
                  display: "grid",
                  gridTemplateColumns: "repeat(8, 1fr)",
                  gridTemplateRows: "repeat(5, 1fr)",
                  gap: 3,
                  padding: 4,
                }}
              >
                {Array.from({ length: 40 }).map((_, idx) => {
                  const r = Math.floor(idx / 8);
                  const c = idx % 8;
                  const waveDist = Math.abs((c / 7 + r / 9) * 0.5 - wavePos);
                  const isWavePeak = waveDist < 0.16;
                  const hashVal = (idx * 7 + stepTick * 3) % 10;
                  const token =
                    PARAM_TOKENS[(idx + stepTick) % PARAM_TOKENS.length];

                  return (
                    <div
                      key={idx}
                      style={{
                        borderRadius: 2,
                        backgroundColor: isWavePeak
                          ? "rgba(52, 211, 153, 0.32)"
                          : hashVal > 5
                            ? "rgba(16, 185, 129, 0.18)"
                            : "rgba(6, 95, 70, 0.22)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: "0 1px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 6.5,
                          fontWeight: 700,
                          color: isWavePeak
                            ? "rgba(209, 250, 229, 0.85)"
                            : "rgba(110, 231, 183, 0.52)",
                          lineHeight: 1,
                        }}
                      >
                        {token}
                      </span>
                      {/* 参数权重微缩张量条 */}
                      <div
                        style={{
                          width: `${30 + hashVal * 6}%`,
                          height: 2,
                          marginTop: 1.5,
                          borderRadius: 1,
                          backgroundColor: isWavePeak
                            ? "rgba(167, 243, 208, 0.75)"
                            : "rgba(52, 211, 153, 0.38)",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ==================== L010: 上方涌现三项能力符号 → 汇成小奖章 → 收起清场 ==================== */}
        {stageId === "L010" && (() => {
          // 0~0.44 三项抽象能力依次点亮；0.44~0.76 汇成中央金色小奖章；0.80~1.0 向上收起
          const panelOut = interpolate(p, [0.8, 0.98], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const mergeIcons = interpolate(p, [0.38, 0.5], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const showMedal = interpolate(p, [0.47, 0.58], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const items = [
            { sym: "Aa", color: POP_PALETTE.mint, start: 0.05, dx: -38 },
            { sym: "</>", color: POP_PALETTE.lime, start: 0.17, dx: 0 },
            { sym: "◇", color: POP_PALETTE.pinkLight, start: 0.29, dx: 38 },
          ];

          return (
            <div
              style={{
                position: "absolute",
                top: 6,
                left: "50%",
                transform: `translateX(-50%) translateY(${interpolate(
                  panelOut,
                  [0, 1],
                  [-22, 0],
                )}px)`,
                opacity: panelOut,
                backgroundColor: POP_PALETTE.ink,
                border: `1.5px solid ${showMedal > 0.3 ? POP_PALETTE.yellowDeep : POP_PALETTE.mint}`,
                borderRadius: 8,
                padding: "4px 12px",
                width: 176,
                height: 34,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 6,
              }}
            >
              {/* 三项抽象能力符号依次完成并向中心汇聚 */}
              {mergeIcons < 0.99 &&
                items.map((it, idx) => {
                  const done = p >= it.start;
                  const xPos = it.dx * (1 - mergeIcons);
                  return (
                    <div
                      key={idx}
                      style={{
                        position: "absolute",
                        transform: `translateX(${xPos}px) scale(${
                          1 - mergeIcons * 0.5
                        })`,
                        opacity: Math.max(0, 1 - mergeIcons * 1.15),
                        backgroundColor: done ? it.color : "#1E293B",
                        color: done ? POP_PALETTE.ink : "#64748B",
                        fontSize: 9,
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: 4,
                        border: `1px solid ${POP_PALETTE.ink}`,
                      }}
                    >
                      {it.sym}
                    </div>
                  );
                })}

              {/* 汇聚合成的金色小奖章 */}
              {showMedal > 0.02 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transform: `scale(${interpolate(
                      showMedal,
                      [0, 0.7, 1],
                      [0.4, 1.15, 1],
                    )})`,
                    opacity: showMedal,
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      backgroundColor: POP_PALETTE.yellowDeep,
                      border: `2px solid ${POP_PALETTE.yellowLight}`,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      fontSize: 11,
                      fontWeight: 900,
                      color: "#78350F",
                      boxShadow: "0 0 8px rgba(250, 204, 21, 0.6)",
                    }}
                  >
                    ★
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: POP_PALETTE.yellowLight,
                    }}
                  >
                    TOP CLASS
                  </span>
                </div>
              )}
            </div>
          );
        })()}

        {/* ==================== L065: (ほら！) 右上弹出红黄手写风艺术字与星形点缀 ==================== */}
        {stageId === "L065" && (() => {
          // 在 Clawd 快速回弹最明显的瞬间 (p=0.17) 从右上方弹出，随后在留白期 (0.62~0.95) 渐渐消失
          if (p < 0.15) return null;
          const popScale = interpolate(
            p,
            [0.15, 0.23, 0.3, 0.68, 0.95],
            [0.2, 1.18, 1.0, 1.0, 0.85],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const popOpacity = interpolate(
            p,
            [0.15, 0.21, 0.65, 0.95],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const driftY = interpolate(p, [0.15, 0.95], [8, -6], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              style={{
                position: "absolute",
                right: 18,
                top: 14,
                transform: `translateY(${driftY}px) scale(${popScale}) rotate(-7deg)`,
                opacity: popOpacity,
                zIndex: 8,
                pointerEvents: "none",
              }}
            >
              {/* 少量星形点缀 */}
              {[
                { x: -12, y: -6, s: 11, c: POP_PALETTE.yellowDeep },
                { x: 76, y: -8, s: 13, c: POP_PALETTE.yellowLight },
                { x: 82, y: 20, s: 10, c: POP_PALETTE.shoutRedLight },
              ].map((st, idx) => (
                <span
                  key={idx}
                  style={{
                    position: "absolute",
                    left: st.x,
                    top: st.y,
                    fontSize: st.s,
                    color: st.c,
                    fontWeight: 900,
                  }}
                >
                  ✦
                </span>
              ))}
              {/* 红色主体 + 黄色外衬描边的可爱手写风艺术字（paintOrder 确保黄边在红字底层不吞字） */}
              <div
                style={{
                  fontFamily:
                    '"Excalifont", "Segoe Print", "Comic Sans MS", "Hiragino Maru Gothic ProN", cursive, sans-serif',
                  fontSize: 24,
                  fontWeight: 900,
                  color: POP_PALETTE.shoutRed,
                  WebkitTextStroke: `4px ${POP_PALETTE.cream}`,
                  paintOrder: "stroke fill",
                  textShadow: "0px 3px 6px rgba(0,0,0,0.45)",
                  letterSpacing: 1,
                  whiteSpace: "nowrap",
                }}
              >
                ほら！
              </div>
            </div>
          );
        })()}

        {/* Clawd 主角本体 */}
        <div
          style={{
            transform: `translateX(${clawdOffsetX}px)`,
            zIndex: 3,
          }}
        >
          <ClawdMascot {...mascotProps} />
        </div>
      </div>
    </div>
  );
};
