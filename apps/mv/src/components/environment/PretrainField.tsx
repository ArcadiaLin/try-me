import React from "react";
import { interpolate } from "remotion";
import { linearProg, smoothStep } from "../../animation/clawd/motion-style";

export const PARAM_TOKENS = [
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
] as const;

export interface PretrainFieldProps {
  sec: number;
}

/**
 * L009–L010: Clawd 背后中心区域无边框、四周渐淡的深绿色半透明预训练参数矩阵背景 + L010 上方 TOP CLASS 能力奖章面板
 */
export const PretrainField: React.FC<PretrainFieldProps> = ({ sec }) => {
  return (
    <>
      {/* 1. 深绿预训练参数场 (45.32s–49.92s) */}
      {sec >= 45.32 &&
        sec <= 49.92 &&
        (() => {
          const fieldOpacity =
            smoothStep(sec, 45.34, 46.12) * (1 - smoothStep(sec, 49.15, 49.88));
          const trainElapsed = Math.max(0, sec - 45.32);
          const wavePos = (trainElapsed * 0.58) % 1;
          const stepTick = Math.floor(trainElapsed * 11);

          return (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 315,
                width: 820,
                height: 450,
                transform: "translate(-50%, -50%)",
                opacity: fieldOpacity,
                zIndex: 1,
                pointerEvents: "none",
                background:
                  "radial-gradient(ellipse 68% 66% at 50% 52%, rgba(6, 78, 59, 0.78) 0%, rgba(6, 78, 59, 0.42) 50%, rgba(6, 78, 59, 0) 92%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 66% 64% at 50% 52%, rgba(0,0,0,1) 18%, rgba(0,0,0,0.58) 54%, rgba(0,0,0,0) 90%)",
                maskImage:
                  "radial-gradient(ellipse 66% 64% at 50% 52%, rgba(0,0,0,1) 18%, rgba(0,0,0,0.58) 54%, rgba(0,0,0,0) 90%)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
              }}
            >
              {/* 底层：神经网络层间权重连线 + 梯度传播波 + Loss 下降收敛曲线 */}
              <svg
                width={740}
                height={390}
                viewBox="0 0 740 390"
                style={{ position: "absolute", inset: 0 }}
              >
                {[86, 228, 370, 512, 654].map((lx, colIdx) =>
                  [64, 148, 232, 316].map((ly, rowIdx) => {
                    const nextX = lx + 142;
                    if (colIdx >= 4) return null;
                    const edgeActive =
                      Math.abs(colIdx / 4 - wavePos) < 0.26 ||
                      (stepTick + colIdx + rowIdx) % 3 === 0;
                    return (
                      <g key={`edge-${colIdx}-${rowIdx}`}>
                        <line
                          x1={lx}
                          y1={ly}
                          x2={nextX}
                          y2={64 + ((rowIdx + 1) % 4) * 84}
                          stroke={
                            edgeActive
                              ? "rgba(52, 211, 153, 0.36)"
                              : "rgba(16, 185, 129, 0.13)"
                          }
                          strokeWidth={edgeActive ? 2.4 : 1.3}
                        />
                        <line
                          x1={lx}
                          y1={ly}
                          x2={nextX}
                          y2={ly}
                          stroke="rgba(16, 185, 129, 0.17)"
                          strokeWidth={1.3}
                          strokeDasharray="5 5"
                        />
                      </g>
                    );
                  }),
                )}

                <rect
                  x={40 + wavePos * 640}
                  y={24}
                  width={76}
                  height={342}
                  fill="rgba(52, 211, 153, 0.14)"
                />

                <polyline
                  fill="none"
                  stroke="rgba(110, 231, 183, 0.45)"
                  strokeWidth={3.2}
                  points="56,74 158,142 264,192 372,232 482,262 590,280 684,290"
                />
              </svg>

              {/* 表层：8×5 参数张量矩阵 */}
              <div
                style={{
                  width: 660,
                  height: 326,
                  display: "grid",
                  gridTemplateColumns: "repeat(8, 1fr)",
                  gridTemplateRows: "repeat(5, 1fr)",
                  gap: 8,
                  padding: 12,
                  fontFamily: "monospace",
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
                        borderRadius: 6,
                        backgroundColor: isWavePeak
                          ? "rgba(52, 211, 153, 0.32)"
                          : hashVal > 5
                            ? "rgba(16, 185, 129, 0.18)"
                            : "rgba(6, 95, 70, 0.24)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        padding: "2px 4px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: isWavePeak
                            ? "rgba(209, 250, 229, 0.88)"
                            : "rgba(110, 231, 183, 0.55)",
                          lineHeight: 1.1,
                        }}
                      >
                        {token}
                      </span>
                      <div
                        style={{
                          width: `${30 + hashVal * 6}%`,
                          height: 4,
                          marginTop: 5,
                          borderRadius: 2,
                          backgroundColor: isWavePeak
                            ? "rgba(167, 243, 208, 0.78)"
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

      {/* 2. L010 上方三项能力符号 → 汇成 TOP CLASS 小奖章 (47.58s–49.88s) */}
      {sec >= 47.58 &&
        sec <= 49.88 &&
        (() => {
          const p10 = linearProg(sec, 47.58, 49.892);
          const panelIn = smoothStep(sec, 47.58, 47.82);
          const panelOut = 1 - smoothStep(sec, 49.32, 49.84);
          const panelPresence = panelIn * panelOut;
          const mergeIcons = smoothStep(sec, 48.35, 48.62);
          const showMedal = smoothStep(sec, 48.56, 48.84);
          const items = [
            { sym: "Aa", color: "#38BDF8", start: 0.05, dx: -105 },
            { sym: "</>", color: "#4ADE80", start: 0.17, dx: 0 },
            { sym: "◇", color: "#F472B6", start: 0.29, dx: 105 },
          ];

          return (
            <div
              style={{
                position: "absolute",
                top: 118,
                left: "50%",
                transform: `translate(-50%, -50%) translateY(${interpolate(
                  panelPresence,
                  [0, 1],
                  [-42, 0],
                )}px)`,
                opacity: panelPresence,
                backgroundColor: "#0F172A",
                border: `3px solid ${showMedal > 0.3 ? "#FACC15" : "#38BDF8"}`,
                borderRadius: 16,
                padding: "10px 28px",
                width: 440,
                height: 82,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 6,
                boxShadow: "0 12px 28px rgba(0, 0, 0, 0.45)",
              }}
            >
              {mergeIcons < 0.99 &&
                items.map((it, idx) => {
                  const done = p10 >= it.start;
                  const xPos = it.dx * (1 - mergeIcons);
                  return (
                    <div
                      key={idx}
                      style={{
                        position: "absolute",
                        transform: `translateX(${xPos}px) scale(${
                          1 - mergeIcons * 0.55
                        })`,
                        opacity: Math.max(0, 1 - mergeIcons * 1.15),
                        backgroundColor: done ? it.color : "#1E293B",
                        color: done ? "#0F172A" : "#64748B",
                        fontSize: 22,
                        fontWeight: 900,
                        padding: "6px 16px",
                        borderRadius: 10,
                        border: "2px solid #0F172A",
                        fontFamily: "monospace",
                      }}
                    >
                      {it.sym}
                    </div>
                  );
                })}

              {showMedal > 0.02 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    transform: `scale(${interpolate(
                      showMedal,
                      [0, 0.7, 1],
                      [0.5, 1.12, 1],
                    )})`,
                    opacity: showMedal,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      backgroundColor: "#FACC15",
                      border: "3px solid #FEF08A",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      fontSize: 26,
                      fontWeight: 900,
                      color: "#78350F",
                      boxShadow: "0 0 18px rgba(250, 204, 21, 0.65)",
                    }}
                  >
                    ★
                  </div>
                  <span
                    style={{
                      fontSize: 26,
                      fontWeight: 900,
                      color: "#FEF08A",
                      letterSpacing: 1.5,
                    }}
                  >
                    TOP CLASS
                  </span>
                </div>
              )}
            </div>
          );
        })()}
    </>
  );
};
