import React from "react";
import { interpolate } from "remotion";
import { linearProg, smoothStep } from "../../animation/clawd/motion-style";

export const GITHUB_HEAT_COLORS = [
  "#0E4429", // Level 1: 深林绿
  "#006D32", // Level 2: 祖母绿
  "#26A641", // Level 3: 鲜亮绿
  "#39D353", // Level 4: 荧光高光绿
] as const;

const GITHUB_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** 确定性伪随机每天热力等级 (0~3)，保证 Remotion 逐帧渲染无闪烁且每天深浅自然错落 */
export function getContributionLevel(cellIndex: number): 0 | 1 | 2 | 3 {
  const hash = (((cellIndex + 1) * 2654435761) >>> 0) % 100;
  if (hash < 20) return 0;
  if (hash < 52) return 1;
  if (hash < 80) return 2;
  return 3;
}

export interface GithubHeatmapCardProps {
  sec: number;
}

/**
 * L006: GitHub Contribution Graph 风格 365 天全勤热力图（在 Clawd 39.20s 站稳前一点点提前滑入）
 */
export const GithubHeatmapCard: React.FC<GithubHeatmapCardProps> = ({
  sec,
}) => {
  if (sec < 38.66 || sec > 40.95) return null;

  const enter = smoothStep(sec, 38.7, 39.06);
  const exit = smoothStep(sec, 40.42, 40.9);
  const presence = enter * (1 - exit);
  const calX = interpolate(presence, [0, 1], [340, 0]);

  const totalCols = 28;
  const totalRows = 7;
  const totalCells = totalCols * totalRows; // 196 个热力格

  const scanProgress = interpolate(sec, [39.0, 39.74], [0, totalCells], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const activeCell = Math.floor(scanProgress);
  const isAllDone = sec >= 39.74;
  const displayDays = Math.round(
    interpolate(sec, [39.0, 39.74], [1, 365], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const nodCardPulse =
    sec >= 39.74 && sec <= 40.42
      ? interpolate(
          linearProg(sec, 39.74, 40.42),
          [0, 0.18, 0.34, 0.54, 0.74, 1],
          [1, 1.045, 0.99, 1.05, 0.995, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: "calc(50% + 198px)",
        top: 276,
        width: 446,
        backgroundColor: "#0D1117",
        border: `3px solid ${isAllDone ? "#39D353" : "#30363D"}`,
        borderRadius: 16,
        padding: "14px 18px",
        transform: `translate(-50%, -50%) translateX(${calX}px) scale(${nodCardPulse})`,
        opacity: interpolate(presence, [0, 0.2, 1], [0, 1, 1]),
        boxShadow: isAllDone
          ? "0 0 34px rgba(57, 211, 83, 0.32), 0 14px 32px rgba(0, 0, 0, 0.55)"
          : "0 14px 32px rgba(0, 0, 0, 0.5)",
        zIndex: 5,
        fontFamily: "monospace",
      }}
    >
      {/* 顶部状态栏 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: "1px solid #21262D",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: isAllDone ? "#39D353" : "#F0F6FC",
              lineHeight: 1,
            }}
          >
            {displayDays}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#8B949E",
              whiteSpace: "nowrap",
            }}
          >
            contributions in the last year
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: isAllDone ? "#0D1117" : "#C9D1D9",
            backgroundColor: isAllDone ? "#39D353" : "#21262D",
            padding: "3px 8px",
            borderRadius: 999,
            letterSpacing: 0.3,
            whiteSpace: "nowrap",
          }}
        >
          {isAllDone ? "365 STREAK ✓" : "365 DAYS"}
        </span>
      </div>

      {/* 月份坐标行 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          paddingLeft: 30,
          marginBottom: 5,
          fontSize: 10,
          fontWeight: 700,
          color: "#8B949E",
        }}
      >
        {GITHUB_MONTHS.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>

      {/* 主体：左侧星期标签 + 7×28 按列扫描随机深浅热力网格 */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: 24,
            height: 88,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "11px 0",
            fontSize: 9.5,
            fontWeight: 700,
            color: "#8B949E",
            lineHeight: 1,
          }}
        >
          <span>Mon</span>
          <span>Wed</span>
          <span>Fri</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateRows: `repeat(${totalRows}, 10px)`,
            gridAutoFlow: "column",
            gridAutoColumns: "10px",
            gap: 3,
          }}
        >
          {Array.from({ length: totalCells }).map((_, idx) => {
            const isScanned = idx < activeCell || isAllDone;
            const isFrontier =
              !isAllDone &&
              sec >= 38.8 &&
              idx >= activeCell - 2 &&
              idx <= activeCell;
            const level = getContributionLevel(idx);
            const shadeColor = GITHUB_HEAT_COLORS[level];

            return (
              <div
                key={idx}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2.5,
                  backgroundColor: isFrontier
                    ? "#86EFAC"
                    : isScanned
                      ? shadeColor
                      : "#161B22",
                  border: isScanned
                    ? "1px solid rgba(255, 255, 255, 0.07)"
                    : "1px solid rgba(240, 246, 252, 0.04)",
                  transform: isFrontier ? "scale(1.22)" : "scale(1)",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 底部图例 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 10,
          fontSize: 10.5,
          fontWeight: 700,
          color: "#8B949E",
        }}
      >
        <span>100% uptime · 365/365 days</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ marginRight: 2 }}>Less</span>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: "#161B22",
              border: "1px solid rgba(240, 246, 252, 0.05)",
            }}
          />
          {GITHUB_HEAT_COLORS.map((color) => (
            <span
              key={color}
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: color,
              }}
            />
          ))}
          <span style={{ marginLeft: 2 }}>More</span>
        </div>
      </div>
    </div>
  );
};
