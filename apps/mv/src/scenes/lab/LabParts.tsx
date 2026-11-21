import React from "react";
import { Clawd } from "../../components/clawd/Clawd";
import { CLAWD_MODEL } from "../../components/clawd/model";
import type { ClawdEyes, ClawdPose, ClawdProps } from "../../components/clawd/types";
import { StageDeck, STAGE_FLOOR_Y } from "../../components/environment";

/** 与 TryMeVerse1MV 一致的 Clawd 尺寸与站位 */
export const LAB_CLAWD_WIDTH = 310;
const UNIT = LAB_CLAWD_WIDTH / 22.4;

export const LabBackdrop: React.FC<{ glowX?: number; showGlow?: boolean }> = ({
  glowX = 0,
  showGlow = true,
}) => (
  <>
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(circle at 50% 44%, #1E1C2A 0%, #12111A 68%, #0B0B11 100%)",
      }}
    />
    {showGlow ? (
      <StageDeck clawdStageX={glowX} />
    ) : (
      <div style={{ position: "absolute", inset: 0, opacity: 1 }}>
        <StageDeckNoGlow />
      </div>
    )}
  </>
);

/** 只保留台面、去掉 StageDeck 那层淡柔光，用于聚光灯样片避免两种光叠在一起 */
const StageDeckNoGlow: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 195,
      background:
        "linear-gradient(180deg, rgba(16, 17, 28, 0.35) 0%, rgba(9, 10, 16, 0.85) 100%)",
      borderTop: "1.5px solid rgba(148, 163, 184, 0.14)",
    }}
  >
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 0,
        width: 1000,
        height: 12,
        transform: "translateX(-50%)",
        backgroundColor: "#23263A",
        borderTop: "2px solid rgba(203, 213, 225, 0.42)",
        borderRadius: "2px 2px 6px 6px",
      }}
    />
  </div>
);

export interface LabClawdProps {
  x: number;
  y?: number;
  scale?: number;
  zIndex?: number;
  pose?: ClawdPose;
  eyes?: ClawdEyes;
  lookOffset?: { x: number; y: number };
  opacity?: number;
  extra?: Partial<ClawdProps>;
}

export const LabClawd: React.FC<LabClawdProps> = ({
  x,
  y = 0,
  scale = 1,
  zIndex,
  pose,
  eyes = "normal",
  lookOffset,
  opacity = 1,
  extra,
}) => (
  <div
    style={{
      position: "absolute",
      left: "50%",
      bottom: 162,
      transform: `translateX(-50%) translateX(${x}px) translateY(${y}px) scale(${scale})`,
      transformOrigin: "bottom center",
      opacity,
      zIndex,
    }}
  >
    <Clawd
      width={LAB_CLAWD_WIDTH}
      pose={pose}
      eyes={eyes}
      mouth="none"
      lookOffset={lookOffset}
      {...extra}
    />
  </div>
);

/**
 * 调试脚印：在每个已落地位置画出四足的地面刻度。
 * 若角色着地时脚与刻度错开，就说明在滑步。
 */
export const Footprints: React.FC<{
  plantedXs: number[];
  currentX: number;
  grounded: boolean;
}> = ({ plantedXs, currentX, grounded }) => {
  const feet = CLAWD_MODEL.joints.legBaseX.map((bx) => (bx + 0.5 - 8) * UNIT);
  const marks = (x: number, strong: boolean, key: string) =>
    feet.map((fx, i) => (
      <div
        key={`${key}-${i}`}
        style={{
          position: "absolute",
          left: 640 + x + fx - 7,
          top: STAGE_FLOOR_Y + 3,
          width: 14,
          height: 3,
          backgroundColor: strong ? "#7DD3FC" : "rgba(125, 211, 252, 0.28)",
        }}
      />
    ));
  return (
    <>
      {plantedXs.map((px, i) => marks(px, false, `p${i}`))}
      {grounded && marks(currentX, true, "now")}
    </>
  );
};

/** 画外伸入的采访麦克风（占位造型） */
export const MicProp: React.FC<{ headX: number; headY: number; opacity?: number }> = ({
  headX,
  headY,
  opacity = 1,
}) => {
  const hx = 640 + headX;
  const baseX = hx - 420;
  const baseY = -40;
  return (
    <svg
      width={1280}
      height={720}
      style={{ position: "absolute", left: 0, top: 0, opacity, pointerEvents: "none" }}
    >
      <line x1={baseX} y1={baseY} x2={hx} y2={headY} stroke="#3B3F55" strokeWidth={7} />
      <g transform={`translate(${hx}, ${headY}) rotate(${Math.atan2(headY - baseY, hx - baseX) * (180 / Math.PI) - 90})`}>
        <rect x={-15} y={-6} width={30} height={46} rx={13} fill="#2A2D3E" stroke="#11131F" strokeWidth={3} />
        <line x1={-9} y1={8} x2={9} y2={8} stroke="#5B6078" strokeWidth={2} />
        <line x1={-9} y1={16} x2={9} y2={16} stroke="#5B6078" strokeWidth={2} />
        <line x1={-9} y1={24} x2={9} y2={24} stroke="#5B6078" strokeWidth={2} />
      </g>
    </svg>
  );
};

export const LabCaption: React.FC<{ title: string; lines: string[]; tag?: string }> = ({
  title,
  lines,
  tag,
}) => (
  <div
    style={{
      position: "absolute",
      left: 40,
      top: 32,
      width: 760,
      fontFamily:
        '"Cascadia Mono", "JetBrains Mono", Consolas, "Microsoft YaHei", monospace',
      color: "#E2E8F0",
    }}
  >
    {tag && (
      <div style={{ fontSize: 15, color: "#94A3B8", marginBottom: 6 }}>{tag}</div>
    )}
    <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 10 }}>{title}</div>
    {lines.map((l) => (
      <div key={l} style={{ fontSize: 17, lineHeight: 1.55, color: "#CBD5E1" }}>
        {l}
      </div>
    ))}
  </div>
);

/** 右上角读数（调试用） */
export const LabReadout: React.FC<{ rows: [string, string][] }> = ({ rows }) => (
  <div
    style={{
      position: "absolute",
      right: 40,
      top: 36,
      fontFamily: '"Cascadia Mono", Consolas, monospace',
      fontSize: 16,
      lineHeight: 1.6,
      color: "#94A3B8",
      textAlign: "right",
    }}
  >
    {rows.map(([k, v]) => (
      <div key={k}>
        {k} <span style={{ color: "#F8FAFC" }}>{v}</span>
      </div>
    ))}
  </div>
);

/** 在图上标注某一部位（细线 + 文字） */
export const LabPointer: React.FC<{
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  label: string;
  opacity?: number;
}> = ({ fromX, fromY, toX, toY, label, opacity = 1 }) => (
  <svg
    width={1280}
    height={720}
    style={{ position: "absolute", left: 0, top: 0, opacity, pointerEvents: "none" }}
  >
    <line x1={fromX} y1={fromY} x2={toX} y2={toY} stroke="#7DD3FC" strokeWidth={1.5} />
    <circle cx={toX} cy={toY} r={3.5} fill="#7DD3FC" />
    <text
      x={fromX + (fromX < toX ? -8 : 8)}
      y={fromY + 5}
      fill="#E0F2FE"
      fontSize={17}
      textAnchor={fromX < toX ? "end" : "start"}
      fontFamily='"Microsoft YaHei", sans-serif'
    >
      {label}
    </text>
  </svg>
);
