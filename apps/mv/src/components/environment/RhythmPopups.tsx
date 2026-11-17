import React from "react";
import { interpolate } from "remotion";

export type RhythmPopupKind =
  | "clap"
  | "clap-1"
  | "clap-2"
  | "drum"
  | "cymbal"
  | "bass";

export interface RhythmPopupEvent {
  id: string;
  sec: number;
  kind: RhythmPopupKind;
}

/**
 * 严格取自时间轴 trk_claps_v1 (CLAP_0001–CLAP_0066) 与 trk_timbre_candidates_v1 (TC_029)
 * 在 00:00.000 → 00:55.168 区间内的鼓掌、鼓组、镲片与 Bass 点事件。
 */
export const VERSE1_RHYTHM_POPUP_EVENTS: readonly RhythmPopupEvent[] = [
  { id: "CLAP_0001", sec: 0.248, kind: "drum" },
  { id: "CLAP_0002", sec: 0.388, kind: "drum" },
  { id: "CLAP_0003", sec: 1.089, kind: "clap" },
  { id: "CLAP_0004", sec: 2.21, kind: "clap" },
  { id: "CLAP_0005", sec: 3.332, kind: "clap" },
  { id: "CLAP_0006", sec: 4.173, kind: "clap-1" },
  { id: "CLAP_0007", sec: 4.453, kind: "clap-2" },
  { id: "CLAP_0008", sec: 5.575, kind: "clap" },
  { id: "CLAP_0009", sec: 6.696, kind: "clap" },
  { id: "CLAP_0010", sec: 7.818, kind: "clap" },
  { id: "CLAP_0011", sec: 8.519, kind: "drum" },
  { id: "CLAP_0012", sec: 8.939, kind: "clap" },
  { id: "CLAP_0013", sec: 10.061, kind: "clap" },
  { id: "CLAP_0014", sec: 11.182, kind: "clap" },
  { id: "CLAP_0015", sec: 12.304, kind: "clap" },
  { id: "CLAP_0016", sec: 13.145, kind: "clap-1" },
  { id: "CLAP_0017", sec: 13.425, kind: "clap-2" },
  { id: "CLAP_0018", sec: 14.546, kind: "clap" },
  { id: "CLAP_0019", sec: 15.668, kind: "clap" },
  { id: "CLAP_0020", sec: 16.789, kind: "clap" },
  { id: "CLAP_0021", sec: 17.49, kind: "drum" },
  { id: "CLAP_0022", sec: 17.911, kind: "clap" },
  { id: "CLAP_0023", sec: 19.032, kind: "clap" },
  { id: "CLAP_0024", sec: 20.154, kind: "clap" },
  { id: "CLAP_0025", sec: 21.275, kind: "clap" },
  { id: "CLAP_0026", sec: 22.116, kind: "clap-1" },
  { id: "CLAP_0027", sec: 22.397, kind: "clap-2" },
  { id: "CLAP_0028", sec: 23.518, kind: "clap" },
  { id: "CLAP_0029", sec: 24.64, kind: "clap" },
  { id: "CLAP_0030", sec: 25.761, kind: "clap" },
  { id: "CLAP_0031", sec: 26.322, kind: "bass" },
  { id: "CLAP_0032", sec: 26.462, kind: "drum" },
  { id: "CLAP_0033", sec: 26.883, kind: "clap" },
  { id: "CLAP_0034", sec: 28.004, kind: "clap" },
  { id: "CLAP_0035", sec: 29.126, kind: "clap" },
  { id: "CLAP_0036", sec: 29.686, kind: "bass" },
  { id: "CLAP_0037", sec: 30.247, kind: "clap" },
  { id: "CLAP_0038", sec: 31.369, kind: "clap" },
  { id: "CLAP_0039", sec: 32.49, kind: "clap" },
  { id: "CLAP_0040", sec: 33.612, kind: "clap" },
  { id: "CLAP_0041", sec: 34.172, kind: "bass" },
  { id: "CLAP_0042", sec: 34.733, kind: "clap" },
  { id: "CLAP_0043", sec: 35.294, kind: "bass" },
  { id: "CLAP_0044", sec: 35.434, kind: "drum" },
  { id: "CLAP_0045", sec: 35.574, kind: "bass" },
  { id: "CLAP_0046", sec: 35.854, kind: "clap" },
  { id: "CLAP_0047", sec: 36.976, kind: "clap" },
  { id: "CLAP_0048", sec: 38.097, kind: "clap" },
  { id: "CLAP_0049", sec: 39.219, kind: "clap" },
  { id: "CLAP_0050", sec: 40.34, kind: "clap" },
  { id: "CLAP_0051", sec: 41.462, kind: "clap" },
  { id: "CLAP_0052", sec: 42.583, kind: "clap" },
  { id: "CLAP_0053", sec: 43.705, kind: "clap" },
  { id: "CLAP_0054", sec: 44.406, kind: "drum" },
  { id: "CLAP_0055", sec: 44.546, kind: "clap-2" },
  { id: "CLAP_0056", sec: 44.826, kind: "clap" },
  { id: "CLAP_0057", sec: 45.948, kind: "clap" },
  { id: "CLAP_0058", sec: 47.069, kind: "clap" },
  { id: "CLAP_0059", sec: 48.191, kind: "clap" },
  { id: "CLAP_0060", sec: 49.312, kind: "clap" },
  { id: "CLAP_0061", sec: 50.434, kind: "clap" },
  { id: "CLAP_0062", sec: 51.555, kind: "clap" },
  { id: "CLAP_0063", sec: 52.677, kind: "clap" },
  { id: "CLAP_0064", sec: 53.518, kind: "clap-1" },
  { id: "TC_029", sec: 53.78, kind: "cymbal" },
  { id: "CLAP_0065", sec: 53.798, kind: "clap-2" },
  { id: "CLAP_0066", sec: 54.92, kind: "clap" },
];

export interface RhythmPopupsProps {
  sec: number;
}

const POPUP_LIFETIME_SEC = 0.42;

/**
 * 为每个节奏事件计算舞台两侧环境中的弹出位置，避开中央角色与主要叙事面板
 */
function computePopupPlacement(
  ev: RhythmPopupEvent,
  index: number,
): { x: number; y: number; rotDeg: number } {
  // 在终端/热力图占据右侧的 [36.2s, 40.8s] 区间，偏向左侧环境区弹出
  const forceLeft = ev.sec >= 36.2 && ev.sec <= 40.8;
  const baseSide = forceLeft ? -1 : index % 2 === 0 ? -1 : 1;

  if (ev.kind === "drum") {
    const side = ev.id === "CLAP_0002" ? 1 : ev.id === "CLAP_0001" ? -1 : baseSide;
    return {
      x: side * (365 + (index % 3) * 26),
      y: 355 - (index % 2) * 28,
      rotDeg: side * -6,
    };
  }
  if (ev.kind === "cymbal") {
    return {
      x: -385,
      y: 215,
      rotDeg: -8,
    };
  }
  if (ev.kind === "bass") {
    const side = index % 2 === 0 ? -1 : 1;
    return {
      x: side * (395 + (index % 2) * 24),
      y: 410 - (index % 3) * 18,
      rotDeg: side * 5,
    };
  }
  if (ev.kind === "clap-1") {
    return {
      x: baseSide * 355,
      y: 278,
      rotDeg: baseSide * -7,
    };
  }
  if (ev.kind === "clap-2") {
    // 双声第 2 声紧邻第 1 声向外上方错位弹出，形成“啪-啪”连击感
    const prevSide = forceLeft ? -1 : (index - 1) % 2 === 0 ? -1 : 1;
    return {
      x: prevSide * 412,
      y: 238,
      rotDeg: prevSide * 9,
    };
  }

  // 常规单声鼓掌：在舞台左右两侧中上空交替轻巧弹出
  const tierY = [250, 305, 228, 332][index % 4];
  const spanX = [355, 405, 378, 425][index % 4];
  return {
    x: baseSide * spanX,
    y: tierY,
    rotDeg: baseSide * ((index % 3) * 4 - 4),
  };
}

/** 像素拍手图标（暖橙爪掌合击 + 顶部三道脆亮声波射线） */
const PixelClapIcon: React.FC<{ isDoubleSecond?: boolean }> = ({
  isDoubleSecond = false,
}) => (
  <svg width={52} height={52} viewBox="0 0 16 16" style={{ overflow: "visible" }}>
    {/* 顶部拍击脆亮声波射线 */}
    <g
      stroke={isDoubleSecond ? "#FDE047" : "#FDBA74"}
      strokeWidth={1.15}
      strokeLinecap="square"
    >
      <line x1={8} y1={1.1} x2={8} y2={3.3} />
      <line x1={4.2} y1={2.3} x2={5.5} y2={4.1} />
      <line x1={11.8} y1={2.3} x2={10.5} y2={4.1} />
      {isDoubleSecond && (
        <>
          <line x1={2.1} y1={5.2} x2={3.8} y2={6.0} />
          <line x1={13.9} y1={5.2} x2={12.2} y2={6.0} />
        </>
      )}
    </g>
    {/* 左拍手像素块 */}
    <g transform="rotate(-16, 6.2, 9.5)">
      <rect
        x={2.6}
        y={6.2}
        width={5.2}
        height={6.2}
        rx={0.8}
        fill="#D87757"
        stroke="#11131F"
        strokeWidth={0.95}
      />
      <rect x={3.4} y={7.0} width={3.6} height={1.4} fill="#FDBA74" />
    </g>
    {/* 右拍手像素块 */}
    <g transform="rotate(16, 9.8, 9.5)">
      <rect
        x={8.2}
        y={6.2}
        width={5.2}
        height={6.2}
        rx={0.8}
        fill="#FDBA74"
        stroke="#11131F"
        strokeWidth={0.95}
      />
      <rect x={9.0} y={7.0} width={3.6} height={1.4} fill="#FEF3C7" />
    </g>
  </svg>
);

/** 像素小军鼓图标（蓝灰鼓腔 + 白色鼓面 + 交叉鼓槌敲击） */
const PixelDrumIcon: React.FC = () => (
  <svg width={52} height={52} viewBox="0 0 16 16" style={{ overflow: "visible" }}>
    {/* 交叉鼓槌 */}
    <g stroke="#11131F" strokeWidth={1.6} strokeLinecap="round">
      <line x1={2.4} y1={2.2} x2={9.4} y2={6.6} />
      <line x1={13.6} y1={2.2} x2={6.6} y2={6.6} />
    </g>
    <g stroke="#FDBA74" strokeWidth={0.85} strokeLinecap="round">
      <line x1={2.4} y1={2.2} x2={9.4} y2={6.6} />
      <line x1={13.6} y1={2.2} x2={6.6} y2={6.6} />
    </g>
    {/* 鼓身与鼓面 */}
    <rect
      x={2.5}
      y={7.2}
      width={11}
      height={5.6}
      rx={1.0}
      fill="#69709B"
      stroke="#11131F"
      strokeWidth={0.95}
    />
    <rect
      x={2.5}
      y={6.6}
      width={11}
      height={2.1}
      rx={0.7}
      fill="#F8FAFC"
      stroke="#11131F"
      strokeWidth={0.9}
    />
    {/* 鼓腔金属拉杆折线 */}
    <polyline
      points="4.0,9.0 6.2,12.1 8.0,9.0 9.8,12.1 12.0,9.0"
      fill="none"
      stroke="#CBD5E1"
      strokeWidth={0.75}
      strokeLinejoin="round"
    />
  </svg>
);

/** 像素镲片图标（金色倾斜镲片 + 震动弧线） */
const PixelCymbalIcon: React.FC = () => (
  <svg width={56} height={56} viewBox="0 0 16 16" style={{ overflow: "visible" }}>
    {/* 震动波纹 */}
    <path
      d="M 2.2 4.2 Q 8 1.5 13.8 4.2 M 1.6 9.8 Q 8 12.2 14.4 9.8"
      fill="none"
      stroke="#FDE047"
      strokeWidth={0.9}
      strokeLinecap="round"
    />
    {/* 支架立杆 */}
    <line
      x1={8}
      y1={7.2}
      x2={8}
      y2={14.2}
      stroke="#94A3B8"
      strokeWidth={1.1}
      strokeLinecap="round"
    />
    {/* 金色镲片 */}
    <g transform="rotate(-10, 8, 7)">
      <ellipse
        cx={8}
        cy={7}
        rx={6.2}
        ry={1.9}
        fill="#FACC15"
        stroke="#11131F"
        strokeWidth={0.95}
      />
      <ellipse cx={8} cy={6.7} rx={2.1} ry={0.7} fill="#FEF08A" />
    </g>
  </svg>
);

/** 像素 Bass 低音脉冲音箱图标（青绿低音单元 + 扩散方波框） */
const PixelBassIcon: React.FC<{ progress: number }> = ({ progress }) => {
  const waveExpand = 1 + progress * 1.4;
  return (
    <svg width={50} height={50} viewBox="0 0 16 16" style={{ overflow: "visible" }}>
      {/* 向外扩散的低频像素方波框 */}
      <rect
        x={2.5 - waveExpand * 0.7}
        y={2.5 - waveExpand * 0.7}
        width={11 + waveExpand * 1.4}
        height={11 + waveExpand * 1.4}
        rx={1.8}
        fill="none"
        stroke="#2DD4BF"
        strokeWidth={0.75}
        opacity={Math.max(0, 1 - progress * 1.1)}
      />
      {/* 音箱箱体 */}
      <rect
        x={3.2}
        y={2.6}
        width={9.6}
        height={10.8}
        rx={1.2}
        fill="#1E293B"
        stroke="#11131F"
        strokeWidth={0.95}
      />
      {/* 低音锥盆 */}
      <circle
        cx={8}
        cy={8.5}
        r={3.1}
        fill="#2B7A78"
        stroke="#11131F"
        strokeWidth={0.8}
      />
      <circle cx={8} cy={8.5} r={1.25} fill="#5EEAD4" />
      <rect x={6.2} y={3.8} width={3.6} height={0.9} rx={0.4} fill="#2DD4BF" />
    </svg>
  );
};

/**
 * 舞台环境中的节奏音色弹出层：
 * 按时间轴标注的鼓掌 (Clap)、鼓组 (Drum)、镲片 (Cymbal) 与 Bass 点，在舞台两侧环境中随节奏轻巧弹出。
 */
export const RhythmPopups: React.FC<RhythmPopupsProps> = ({ sec }) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      {VERSE1_RHYTHM_POPUP_EVENTS.map((ev, idx) => {
        const dt = sec - ev.sec;
        if (dt < -0.015 || dt > POPUP_LIFETIME_SEC) return null;

        const p = Math.max(0, Math.min(1, dt / POPUP_LIFETIME_SEC));
        const { x, y, rotDeg } = computePopupPlacement(ev, idx);

        // 0 -> 0.16 快速高弹性弹出，0.16 -> 0.55 保持微颤，0.55 -> 1.0 干净收拢淡出
        const scaleBase =
          ev.kind === "clap-2" || ev.kind === "cymbal" ? 1.12 : 0.96;
        const scale =
          scaleBase *
          interpolate(
            p,
            [0, 0.14, 0.28, 0.68, 1],
            [0.35, 1.18, 0.96, 1.0, 0.72],
          );
        const liftY = interpolate(p, [0, 0.25, 1], [10, 0, -14]);
        const opacity = interpolate(
          p,
          [0, 0.08, 0.65, 1],
          [0, 0.94, 0.88, 0],
        );

        return (
          <div
            key={ev.id}
            style={{
              position: "absolute",
              left: `calc(50% + ${x}px)`,
              top: y + liftY,
              transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotDeg}deg)`,
              opacity,
            }}
          >
            {(ev.kind === "clap" ||
              ev.kind === "clap-1" ||
              ev.kind === "clap-2") && (
              <PixelClapIcon isDoubleSecond={ev.kind === "clap-2"} />
            )}
            {ev.kind === "drum" && <PixelDrumIcon />}
            {ev.kind === "cymbal" && <PixelCymbalIcon />}
            {ev.kind === "bass" && <PixelBassIcon progress={p} />}
          </div>
        );
      })}
    </div>
  );
};
