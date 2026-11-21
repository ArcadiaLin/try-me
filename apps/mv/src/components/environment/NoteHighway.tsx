import React from "react";
import { random } from "remotion";
import type { IntroKeyboardNote } from "../../timeline/rhythm-timing";

export interface NoteHighwayLane {
  /** 对应键盘 zone；null 表示空轨（只画轨道，不落方块） */
  zone: 0 | 1 | 2 | null;
  label: string;
  color: string;
}

/** 按音高从左到右：A3、B♭3、（八度空档）、B♭4 */
export const PRELUDE_HIGHWAY_LANES: readonly NoteHighwayLane[] = [
  { zone: 0, label: "A3", color: "#C2562C" },
  { zone: 1, label: "B♭3", color: "#E07A55" },
  { zone: null, label: "", color: "#475569" },
  { zone: 2, label: "B♭4", color: "#F5B072" },
];

export interface NoteHighwayProps {
  sec: number;
  notes: readonly IntroKeyboardNote[];
  /** 拍线 / 小节线（秒） */
  gridLines?: readonly { sec: number; kind: "bar" | "beat" }[];
  lanes?: readonly NoteHighwayLane[];
  /** 谱面中心相对画面中线的水平偏移（px） */
  x?: number;
  /** 判定线高度（自画面顶部，px）；默认落在终端顶边 */
  hitY?: number;
  laneWidth?: number;
  /** 轨道平面内的下落速度（px/s） */
  speed?: number;
  /** 轨道平面长度（px，透视前） */
  planeHeight?: number;
  /** 轨道向后倾倒的角度 */
  tiltDeg?: number;
  /** 轨道从终端升起的时刻 */
  openSec?: number;
  /** 升级时刻（bass 进入）：轨道变亮、两侧导轨点亮、扫光 */
  levelUpSec?: number;
  /** 轨道收回终端的时刻（外侧轨道先收） */
  closeSec?: number;
  showCombo?: boolean;
}

const OUTLINE = "#11131F";
const RECEPTOR_BOTTOM = 6;
const BLOCK_H = 24;

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t ** 3;

/**
 * 音游式下落谱面（透视轨道版）：
 * - 4 条轨道向后倾倒成透视跑道，方块从远处落到终端顶边的判定位；
 * - 像素风斜面方块 + 分段长音尾，与 Clawd 和 3D 像素小键盘同一套造型；
 * - 命中时：判定位弹起点亮、本轨光柱、像素火花、强音横向闪线、两侧导轨脉冲、连击计数；
 * - bass 进入时整体升级（变亮 + 扫光），结束时外侧轨道先收回终端。
 * 纯 props 驱动，不读取帧号。
 */
export const NoteHighway: React.FC<NoteHighwayProps> = ({
  sec,
  notes,
  gridLines = [],
  lanes = PRELUDE_HIGHWAY_LANES,
  x = 0,
  hitY = 525,
  laneWidth = 72,
  speed = 600,
  planeHeight = 900,
  tiltDeg = 42,
  openSec = 0,
  levelUpSec = Number.POSITIVE_INFINITY,
  closeSec = Number.POSITIVE_INFINITY,
  showCombo = true,
}) => {
  const closeOrder = [0, lanes.length - 1, 1, 2];
  const laneOpen = lanes.map((_, i) => {
    const rise = easeOut(clamp01((sec - openSec - i * 0.05) / 0.45));
    const k = closeOrder.indexOf(i);
    const fall = easeIn(clamp01((sec - closeSec - Math.max(0, k) * 0.06) / 0.32));
    return rise * (1 - fall);
  });
  const maxOpen = Math.max(...laneOpen);
  if (maxOpen <= 0.001) return null;

  const level = clamp01((sec - levelUpSec) / 0.3);
  const intensity = 0.6 + 0.4 * level;
  const sweepT = (sec - levelUpSec) / 0.5;
  const width = laneWidth * lanes.length;
  const left = 640 + x - width / 2;

  // 命中记录
  const zoneLane = new Map<number, number>();
  lanes.forEach((l, i) => {
    if (l.zone !== null) zoneLane.set(l.zone, i);
  });
  const recentHits = notes
    .map((n, idx) => ({ n, idx, lane: zoneLane.get(n.zone) ?? -1, t: sec - n.startSec }))
    .filter((h) => h.lane >= 0 && h.t >= 0 && h.t < 0.6);
  const lastHitT = recentHits.length ? Math.min(...recentHits.map((h) => h.t)) : 1;
  const railPulse = Math.max(0, 1 - lastHitT / 0.16);
  const combo = notes.filter((n) => n.startSec <= sec).length;

  const laneBg = (color: string) =>
    `linear-gradient(0deg, ${color}38 0%, rgba(14,15,26,0.72) 32%, rgba(14,15,26,0.6) 100%)`;

  return (
    <>
      {/* 透视轨道 */}
      <div
        style={{
          position: "absolute",
          left: left - 12,
          top: hitY - planeHeight,
          width: width + 24,
          height: planeHeight,
          perspective: 900,
          perspectiveOrigin: "50% 20%",
          pointerEvents: "none",
          opacity: intensity,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 4,
            bottom: 0,
            width: width + 16,
            height: planeHeight,
            transform: `rotateX(${tiltDeg}deg)`,
            transformOrigin: "50% 100%",
            maskImage: "linear-gradient(0deg, black 55%, transparent 96%)",
            WebkitMaskImage: "linear-gradient(0deg, black 55%, transparent 96%)",
          }}
        >
          {/* 两侧导轨：升级后点亮，命中时脉冲（随外侧轨道同步收起） */}
          {[0, width + 10].map((rx) => (
            <div
              key={rx}
              style={{
                position: "absolute",
                left: rx,
                bottom: 0,
                width: 6,
                height: planeHeight * laneOpen[0],
                backgroundColor: "#E07A55",
                opacity: 0.18 + level * (0.35 + 0.47 * railPulse),
              }}
            />
          ))}

          {lanes.map((lane, i) => {
            const open = laneOpen[i];
            if (open <= 0.001) return null;
            const laneH = planeHeight * open;
            const laneNotes = lane.zone === null ? [] : notes.filter((n) => n.zone === lane.zone);
            const flash = laneNotes.find((n) => sec >= n.startSec && sec < n.startSec + 0.22);
            const flashA = flash ? 1 - (sec - flash.startSec) / 0.22 : 0;
            const holding = laneNotes.some((n) => sec >= n.startSec && sec <= n.endSec);
            const pop = flash ? Math.max(0, 1 - (sec - flash.startSec) / 0.12) : 0;
            return (
              <div
                key={lane.label || `empty-${i}`}
                style={{
                  position: "absolute",
                  left: 8 + i * laneWidth,
                  bottom: 0,
                  width: laneWidth,
                  height: laneH,
                  overflow: "hidden",
                  background: lane.zone === null ? "rgba(14,15,26,0.5)" : laneBg(lane.color),
                  borderRight: "1px solid rgba(148,163,184,0.16)",
                  borderLeft: i === 0 ? "1px solid rgba(148,163,184,0.16)" : undefined,
                }}
              >
                {/* 拍线 / 小节线 */}
                {gridLines.map((g) => {
                  const b = (g.sec - sec) * speed + RECEPTOR_BOTTOM + BLOCK_H / 2;
                  if (b < 0 || b > laneH) return null;
                  return (
                    <div
                      key={g.sec}
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: b,
                        height: g.kind === "bar" ? 3 : 1,
                        backgroundColor:
                          g.kind === "bar" ? "rgba(248,250,252,0.32)" : "rgba(148,163,184,0.16)",
                      }}
                    />
                  );
                })}

                {/* 本轨命中光柱 */}
                {flashA > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: "48%",
                      background: `linear-gradient(0deg, ${lane.color} 0%, transparent 100%)`,
                      opacity: 0.75 * flashA,
                    }}
                  />
                )}

                {/* 方块与长音尾 */}
                {laneNotes.map((n) => {
                  const startB = (n.startSec - sec) * speed + RECEPTOR_BOTTOM;
                  const endB = (n.endSec - sec) * speed + RECEPTOR_BOTTOM;
                  if (endB < RECEPTOR_BOTTOM || startB > laneH + BLOCK_H) return null;
                  const tailFrom = Math.max(startB + BLOCK_H, RECEPTOR_BOTTOM + BLOCK_H / 2);
                  const tailH = endB - tailFrom;
                  return (
                    <React.Fragment key={n.startSec}>
                      {tailH > 4 && (
                        <div
                          style={{
                            position: "absolute",
                            left: laneWidth * 0.34,
                            width: laneWidth * 0.32,
                            bottom: tailFrom,
                            height: tailH,
                            background: `repeating-linear-gradient(0deg, ${lane.color} 0px, ${lane.color} 9px, transparent 9px, transparent 14px)`,
                            opacity: sec >= n.startSec ? 0.95 : 0.55,
                          }}
                        />
                      )}
                      {sec < n.startSec && (
                        <div
                          style={{
                            position: "absolute",
                            left: 6,
                            width: laneWidth - 12,
                            bottom: startB,
                            height: BLOCK_H,
                            backgroundColor: lane.color,
                            border: `2px solid ${OUTLINE}`,
                            boxSizing: "border-box",
                            opacity: 0.6 + 0.4 * n.velocity,
                          }}
                        >
                          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 5, backgroundColor: "rgba(255,255,255,0.42)" }} />
                          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, backgroundColor: "rgba(17,19,31,0.35)" }} />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* 判定位：像小键盘的键帽，命中弹起点亮 */}
                <div
                  style={{
                    position: "absolute",
                    left: 4,
                    width: laneWidth - 8,
                    bottom: RECEPTOR_BOTTOM - 2,
                    height: BLOCK_H + 4,
                    boxSizing: "border-box",
                    border: `3px solid ${lane.zone === null ? "rgba(71,85,105,0.45)" : lane.color}`,
                    backgroundColor:
                      lane.zone === null
                        ? "transparent"
                        : holding || flash
                          ? lane.color
                          : "rgba(17,19,31,0.6)",
                    opacity: lane.zone === null ? 0.6 : holding || flash ? 1 : 0.7,
                    transform: `scale(${1 + 0.14 * pop})`,
                  }}
                />
              </div>
            );
          })}

          {/* 升级扫光：从判定线扫向远端 */}
          {sweepT >= 0 && sweepT <= 1 && (
            <div
              style={{
                position: "absolute",
                left: 8,
                width,
                bottom: planeHeight * maxOpen * sweepT,
                height: 70,
                background: "linear-gradient(0deg, transparent, rgba(255,231,186,0.55), transparent)",
                opacity: 1 - sweepT,
              }}
            />
          )}
        </div>
      </div>

      {/* 屏幕空间：像素火花与强音闪线（判定线在透视平面底边，屏幕坐标不变） */}
      <svg
        width={1280}
        height={720}
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
      >
        {recentHits.map(({ n, idx, lane, t }) => {
          const cx = left + (lane + 0.5) * laneWidth;
          const cy = hitY - RECEPTOR_BOTTOM - BLOCK_H / 2;
          const color = lanes[lane].color;
          const count = n.velocity >= 0.95 ? 10 : 7;
          const life = 0.5;
          if (t > life) return null;
          return (
            <g key={idx} opacity={(1 - t / life) * (0.55 + 0.45 * level) * laneOpen[lane]}>
              {Array.from({ length: count }, (_, k) => {
                const a = (-90 + (random(`a${idx}-${k}`) - 0.5) * 120) * (Math.PI / 180);
                const v = 240 + random(`v${idx}-${k}`) * 300;
                const px = cx + Math.cos(a) * v * t;
                const py = cy + Math.sin(a) * v * t + 0.5 * 1100 * t * t;
                const s = 5 + Math.round(random(`s${idx}-${k}`) * 4);
                return (
                  <rect
                    key={k}
                    x={Math.round(px - s / 2)}
                    y={Math.round(py - s / 2)}
                    width={s}
                    height={s}
                    fill={k % 3 === 0 ? "#FFF3E0" : color}
                  />
                );
              })}
            </g>
          );
        })}
        {recentHits
          .filter((h) => h.n.velocity >= 0.95 && h.t < 0.16)
          .map(({ idx, t }) => (
            <rect
              key={`line-${idx}`}
              x={left - 20 - 30 * (t / 0.16)}
              y={hitY - 3}
              width={width + 40 + 60 * (t / 0.16)}
              height={3}
              fill="#FFF3E0"
              opacity={(1 - t / 0.16) * maxOpen}
            />
          ))}
      </svg>

      {/* 连击计数 */}
      {showCombo && combo > 0 && (
        <div
          style={{
            position: "absolute",
            left: left + width + 30,
            top: hitY - 168,
            fontFamily: '"Cascadia Mono", "JetBrains Mono", Consolas, monospace',
            color: "#F8FAFC",
            opacity: maxOpen * (0.55 + 0.45 * level),
            transformOrigin: "left bottom",
            transform: `scale(${1 + 0.18 * railPulse})`,
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, textShadow: "3px 3px 0 #C2562C" }}>
            {combo}
          </div>
          <div style={{ fontSize: 13, letterSpacing: 4, color: "#CBD5E1", marginTop: 4 }}>COMBO</div>
        </div>
      )}
    </>
  );
};
