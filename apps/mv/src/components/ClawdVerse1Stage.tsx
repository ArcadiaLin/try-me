import React from "react";
import { interpolate } from "remotion";
import { ClawdMascot } from "./ClawdMascot";

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
    color: "#38BDF8",
    start: 0.06,
    end: 0.78,
  },
  {
    lang: "ZH",
    text: "我会说不同的语言",
    color: "#F59E0B",
    start: 0.06,
    end: 0.78,
  },
  {
    lang: "JA",
    text: "いろんな言葉が話せるよ",
    color: "#F472B6",
    start: 0.06,
    end: 0.78,
  },
  {
    lang: "ES",
    text: "Hablo diferentes idiomas",
    color: "#4ADE80",
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
    // 日历从右侧进入，Clawd 偏左站立，句末平滑向更左过渡以衔接 L007 大气泡
    clawdOffsetX = interpolate(p, [0, 0.16, 0.84, 1], [-18, -42, -42, -62], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const nodEnv = p >= 0.55 && p <= 0.88 ? (p - 0.55) / 0.33 : 0;
    mascotProps = {
      width: 110,
      action: nodEnv > 0 ? "posture-nod" : "idle",
      actionProgress: nodEnv > 0 ? 0.48 + nodEnv * 0.36 : p,
      lookOffset: {
        x: interpolate(p, [0, 0.15, 0.85, 1], [0.45, 0.5, 0.5, 0.42]),
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
    // L009: 眼镜从左侧旋入 (0~0.28) -> 书从右下升起 (0.22~0.48) -> 低头微翻页阅读
    const glassesIn = interpolate(p, [0.02, 0.28], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const bookIn = interpolate(p, [0.22, 0.48], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    mascotProps = {
      width: 110,
      action: "read-look-up",
      actionProgress: interpolate(p, [0, 1], [0, 0.52]),
      prop: "book",
      glassesProgress: glassesIn,
      bookProgress: bookIn,
    };
  } else if (stageId === "L010") {
    // L010: 承接眼镜与书本，从书后抬头挺身；句尾 (0.70~0.92) 先把书向右下送出、眼镜向左退回
    clawdOffsetX = interpolate(p, [0, 0.82, 1], [0, 0, -16], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const bookOut = interpolate(p, [0.7, 0.88], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const glassesOut = interpolate(p, [0.74, 0.92], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    mascotProps = {
      width: 110,
      action: "read-look-up",
      actionProgress: interpolate(p, [0, 0.75, 1], [0.52, 0.92, 1]),
      prop: "book",
      glassesProgress: glassesOut,
      bookProgress: bookOut,
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

        {/* ==================== L006: 单页 365 全勤日历（右进右出） ==================== */}
        {stageId === "L006" && (() => {
          const slideEnv = interpolate(
            p,
            [0, 0.16, 0.84, 1],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const calX = interpolate(slideEnv, [0, 1], [110, 0]);
          // 0.16 ~ 0.62 期间按行从左到右、从上到下快速扫过 20 个代表格
          const scanProgress = interpolate(p, [0.16, 0.62], [0, 20], {
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
                right: 22,
                top: 18,
                width: 112,
                backgroundColor: "#1E293B",
                border: `2px solid ${isAllDone ? "#4ADE80" : "#475569"}`,
                borderRadius: 8,
                padding: 6,
                transform: `translateX(${calX}px)`,
                opacity: interpolate(slideEnv, [0, 0.2, 1], [0, 1, 1]),
                boxShadow: isAllDone
                  ? "0 0 12px rgba(74, 222, 128, 0.35)"
                  : "none",
              }}
            >
              {/* 日历页眉 + 清晰的 365 辅助数字 */}
              <div
                style={{
                  backgroundColor: isAllDone ? "#16A34A" : "#D87757",
                  borderRadius: 4,
                  padding: "2px 6px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#FFFFFF",
                  }}
                >
                  {displayDays}
                </span>
                <span
                  style={{
                    fontSize: 8.5,
                    fontWeight: 700,
                    color: "#FFF7ED",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isAllDone ? "ALL DONE ✓" : "DAYS"}
                </span>
              </div>
              {/* 5×4 单页网格（左→右、上→下逐格扫描） */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: 3,
                }}
              >
                {Array.from({ length: 20 }).map((_, idx) => {
                  const isScanned = idx < activeCell || isAllDone;
                  const isCursor = !isAllDone && idx === activeCell && p >= 0.16;
                  return (
                    <div
                      key={idx}
                      style={{
                        height: 11,
                        borderRadius: 2,
                        backgroundColor: isCursor
                          ? "#FACC15"
                          : isScanned
                            ? isAllDone
                              ? "#4ADE80"
                              : "#D87757"
                            : "#334155",
                        transform: isCursor ? "scale(1.18)" : "scale(1)",
                      }}
                    />
                  );
                })}
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
                color: "#0F172A",
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
                          color: "#0F172A",
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
                        color: "#0F172A",
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
                            backgroundColor: "#0F172A",
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
                          color: "#0F172A",
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
                        color: "#0F172A",
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
                    backgroundColor: "#FACC15",
                    border: "1.5px solid #11131F",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: 11,
                    fontWeight: 900,
                    color: "#0F172A",
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
                    backgroundColor: "#FACC15",
                    border: "1px solid #11131F",
                    fontSize: 8,
                    fontWeight: 800,
                    color: "#0F172A",
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
                  <rect x={2} y={0.8} width={6.5} height={1.1} fill="#38BDF8" />
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
                  <rect x={3.8} y={3.1} width={0.8} height={1.5} fill="#0F172A" />
                  <rect x={6.0} y={3.1} width={0.8} height={1.5} fill="#0F172A" />
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
                    backgroundColor: "#FACC15",
                    border: "1px solid #11131F",
                    fontSize: 8,
                    fontWeight: 800,
                    color: "#0F172A",
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
                  <rect x={4.6} y={0.3} width={0.9} height={1.5} fill="#F472B6" />
                  <rect x={3.8} y={0.3} width={2.4} height={0.7} fill="#F472B6" />
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
                  <rect x={3.2} y={3.1} width={0.8} height={1.5} fill="#0F172A" />
                  <rect x={5.4} y={3.1} width={0.8} height={1.5} fill="#0F172A" />
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

          const PARAM_TOKENS = [
            "∇W₁",
            "attn",
            "0.04",
            "qkv",
            "mlp",
            "-0.12",
            "norm",
            "0.87",
            "ffn",
            "loss↓",
            "emb",
            "0.01",
          ];

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
            { sym: "Aa", color: "#38BDF8", start: 0.05, dx: -38 },
            { sym: "</>", color: "#4ADE80", start: 0.17, dx: 0 },
            { sym: "◇", color: "#F472B6", start: 0.29, dx: 38 },
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
                backgroundColor: "#0F172A",
                border: `1.5px solid ${showMedal > 0.3 ? "#FACC15" : "#38BDF8"}`,
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
                        color: done ? "#0F172A" : "#64748B",
                        fontSize: 9,
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: 4,
                        border: "1px solid #0F172A",
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
                      backgroundColor: "#FACC15",
                      border: "2px solid #FEF08A",
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
                      color: "#FEF08A",
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
                { x: -12, y: -6, s: 11, c: "#FACC15" },
                { x: 76, y: -8, s: 13, c: "#FEF08A" },
                { x: 82, y: 20, s: 10, c: "#EF4444" },
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
                  color: "#E11D48",
                  WebkitTextStroke: "4px #FACC15",
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
