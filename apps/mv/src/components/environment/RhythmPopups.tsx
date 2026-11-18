import React from "react";
import { interpolate } from "remotion";
import {
  SCORE_DRUMS_V2_EVENTS,
  type ScoreDrumEvent,
  type ScoreDrumKind,
} from "../../timeline/score-drums-v2";

export type RhythmPopupKind = ScoreDrumKind;
export type RhythmPopupEvent = ScoreDrumEvent;

export { SCORE_DRUMS_V2_EVENTS };
export const VERSE1_RHYTHM_POPUP_EVENTS = SCORE_DRUMS_V2_EVENTS;

export interface RhythmPopupsProps {
  sec: number;
}

/** 提前 1 帧开始弹出，命中帧到达缩放峰值 */
const POPUP_LEAD_SEC = 1 / 30;

/** 按声部区分存活时长：踩镲短促干脆，吊镲余音稍长 */
const KIND_LIFETIME_SEC: Record<ScoreDrumKind, number> = {
  hat: 0.34,
  kick: 0.42,
  snare: 0.42,
  clap: 0.44,
  "clap-1": 0.42,
  "clap-2": 0.46,
  cymbal: 0.56,
};

/** 按声部区分缩放强度 */
const KIND_SCALE: Record<ScoreDrumKind, number> = {
  hat: 0.88,
  clap: 0.98,
  "clap-1": 1.0,
  "clap-2": 1.14,
  snare: 1.02,
  kick: 1.08,
  cymbal: 1.18,
};

interface PopupPlacement {
  x: number;
  y: number;
  rotDeg: number;
}

/** 在终端/热力图占据右侧的 [36.2s, 40.8s] 区间，自动避让到左侧环境区弹出 */
function isRightOccupied(sec: number) {
  return sec >= 36.2 && sec <= 40.8;
}

/**
 * 为全曲 952 个打击乐事件预先计算舞台两侧的弹出位置：
 * - 左右两侧各自向外再拉开约 10%（|x| ≈ 440..535px），与中央主舞台彻底分清边界；
 * - 所有声部（鼓掌、军鼓、踩镲、吊镲、底鼓）均在左右两侧交替弹出，且军鼓与同拍鼓掌自动置于异侧（一左一右），保证左右两侧元素数量与视觉重量均匀平衡。
 */
function buildPopupPlacements(
  events: readonly ScoreDrumEvent[],
): PopupPlacement[] {
  let clapCount = 0;
  let lastClapSide = -1;
  let snareCount = 0;
  let kickCount = 0;
  let hatCount = 0;
  let cymbalCount = 0;

  return events.map((ev) => {
    const forceLeft = isRightOccupied(ev.sec);

    if (ev.kind === "snare") {
      const i = snareCount++;
      // 军鼓从 +1（右）开始左右交替，与从 -1（左）开始交替的鼓掌正好在同拍（174 处重合点）一左一右平衡分布
      const side = forceLeft ? -1 : i % 2 === 0 ? 1 : -1;
      const tier = Math.floor(i / 2) % 3;
      return {
        x: side * (445 + tier * 38),
        y: 358 - tier * 32,
        rotDeg: side * (-6 + tier * 5),
      };
    }

    if (ev.kind === "kick") {
      const i = kickCount++;
      // 底鼓也在左右下侧交替弹出，不再堆在右边
      const side = forceLeft ? -1 : i % 2 === 0 ? -1 : 1;
      const tier = Math.floor(i / 2) % 3;
      return {
        x: side * (458 + tier * 36),
        y: 428 - tier * 22,
        rotDeg: side * (4 - tier * 3),
      };
    }

    if (ev.kind === "hat") {
      const i = hatCount++;
      const side = forceLeft ? -1 : i % 2 === 0 ? 1 : -1;
      const tier = Math.floor(i / 2) % 3;
      return {
        x: side * (485 + tier * 26),
        y: 172 + tier * 28,
        rotDeg: side * (-8 + tier * 4),
      };
    }

    if (ev.kind === "cymbal") {
      const i = cymbalCount++;
      const side = forceLeft ? -1 : i % 2 === 0 ? -1 : 1;
      return { x: side * 465, y: 196, rotDeg: side * -10 };
    }

    if (ev.kind === "clap-2") {
      // 双声第 2 声紧邻第 1 声同侧向外上方错位弹出，形成“啪-啪”连击感
      return { x: lastClapSide * 512, y: 234, rotDeg: lastClapSide * 10 };
    }

    const i = clapCount++;
    const side = forceLeft ? -1 : i % 2 === 0 ? -1 : 1;
    lastClapSide = side;
    if (ev.kind === "clap-1") {
      return { x: side * 448, y: 278, rotDeg: side * -7 };
    }

    // 常规单声鼓掌：在舞台左右外侧中上空交替弹出
    const tier = Math.floor(i / 2) % 4;
    return {
      x: side * [442, 488, 464, 510][tier],
      y: [252, 304, 232, 326][tier],
      rotDeg: side * ((tier % 3) * 4 - 4),
    };
  });
}

const POPUP_PLACEMENTS = buildPopupPlacements(SCORE_DRUMS_V2_EVENTS);

/**
 * 1. Emoji 风格鼓掌图标（👏 造型）：
 * 还原 Apple / Noto 经典 👏 侧视合掌造型——两只手掌上下紧贴合拢在一起（不是左右分开的两只手），
 * 后侧手掌微露指尖与掌背，前侧手掌四指斜向上并拢贴合、外侧带弯曲大拇指，指尖斜上方爆出三道水滴形拍击声波。
 */
const EmojiClapIcon: React.FC<{ isDoubleSecond?: boolean }> = ({
  isDoubleSecond = false,
}) => (
  <svg width={58} height={58} viewBox="0 0 64 64" style={{ overflow: "visible" }}>
    {/* 左上/顶部水滴形拍击光芒（👏 经典三道/五道拍击水滴线） */}
    <g fill={isDoubleSecond ? "#FEF08A" : "#FDBA74"} stroke="#11131F" strokeWidth={1.6}>
      {/* 中央水滴光芒 */}
      <path d="M 27 5 C 28.5 5 30 11 28.5 14.5 C 27 16 25 14.5 25 11.5 C 25 8 25.5 5 27 5 Z" />
      {/* 左侧水滴光芒 */}
      <path d="M 13 11 C 14.5 10 19 14.5 19.5 17.5 C 19 19.5 16.5 19 14.5 16.5 C 12.5 14 11.5 12 13 11 Z" />
      {/* 右侧水滴光芒 */}
      <path d="M 41 8 C 42.8 8.8 41 15 39 17.5 C 37.2 18.5 36 16.5 37.2 13.5 C 38.5 10.5 39.2 7.2 41 8 Z" />
      {isDoubleSecond && (
        <>
          <path d="M 7 22 C 8.2 20.5 14 23 15 25.5 C 14.5 27.2 12 27.2 9.5 25.5 C 7.2 24 5.8 23.5 7 22 Z" />
          <path d="M 51 15 C 52.5 16.2 49 21.5 46.8 23 C 45 23.5 44.5 21.5 46.5 19 C 48.2 16.5 49.5 13.8 51 15 Z" />
        </>
      )}
    </g>

    {/* 整体倾斜约 -28° 的合拢双掌（两掌紧贴重叠在一起） */}
    <g transform="translate(2, 4) rotate(-28, 32, 36)">
      {/* 后侧手掌（稍深暖金橘色，仅在左上方错位露出贴合的半边指排与左掌根，与前掌紧密相贴） */}
      <path
        d="M 19 46 L 19 21 C 19 17.8 23.5 17.8 23.5 21 L 23.5 17.5 C 23.5 14.3 28 14.3 28 17.5 L 28 16 C 28 12.8 32.5 12.8 32.5 16 L 32.5 18.5 C 32.5 15.5 37 15.5 37 18.5 L 37 45 C 37 52 31 55.5 25 55.5 C 20.5 55.5 19 51.5 19 46 Z"
        fill="#E08E45"
        stroke="#11131F"
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      {/* 后掌指缝短线 */}
      <path
        d="M 23.5 21 L 23.5 30 M 28 17.5 L 28 29 M 32.5 18.5 L 32.5 30"
        stroke="#11131F"
        strokeWidth={2.2}
        strokeLinecap="round"
      />

      {/* 前侧主手掌（经典 Emoji 明亮金黄，直接覆盖贴合在后掌之上，间距仅 4px，带外侧大拇指） */}
      <path
        d="M 24 47 L 24 23 C 24 19.8 28.5 19.8 28.5 23 L 28.5 19.5 C 28.5 16.3 33 16.3 33 19.5 L 33 18 C 33 14.8 37.5 14.8 37.5 18 L 37.5 20.5 C 37.5 17.5 42 17.5 42 20.5 L 42 35 L 45.8 29.5 C 48 26.8 52 29.5 49.8 33.2 L 43.8 44.5 C 41.5 51.5 36.8 56 30.8 56 C 25.8 56 24 52 24 47 Z"
        fill="#FFCC4D"
        stroke="#11131F"
        strokeWidth={2.8}
        strokeLinejoin="round"
      />
      {/* 前掌四指并拢分割线与大拇指虎口折线 */}
      <path
        d="M 28.5 23 L 28.5 34.5 M 33 19.5 L 33 33.5 M 37.5 20.5 L 37.5 34.5 M 42 35 L 39.2 41.5"
        fill="none"
        stroke="#11131F"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      {/* 前掌手背圆润高光 */}
      <ellipse
        cx={33.5}
        cy={45}
        rx={5.2}
        ry={3.4}
        fill="#FEF08A"
        opacity={0.78}
      />
    </g>
  </svg>
);

/**
 * 2. 军鼓图标（Snare Drum）：
 * 扁圆柱蓝灰金属鼓腔 + 锯齿三角拉杆 + 顶部白色倾斜鼓面 + 两根鼓槌交叉脆击与星芒。
 */
const SnareDrumIcon: React.FC = () => (
  <svg width={54} height={54} viewBox="0 0 64 64" style={{ overflow: "visible" }}>
    {/* 鼓槌敲击中心脆亮火花 */}
    <polygon
      points="32,15 34.5,20.5 40,21.5 35.5,25 37,30.5 32,27.2 27,30.5 28.5,25 24,21.5 29.5,20.5"
      fill="#FDE047"
    />
    {/* 交叉鼓槌 */}
    <g stroke="#11131F" strokeWidth={5.5} strokeLinecap="round">
      <line x1={10} y1={8} x2={38} y2={26} />
      <line x1={54} y1={8} x2={26} y2={26} />
    </g>
    <g stroke="#FDBA74" strokeWidth={2.8} strokeLinecap="round">
      <line x1={10} y1={8} x2={38} y2={26} />
      <line x1={54} y1={8} x2={26} y2={26} />
    </g>
    <circle cx={38} cy={26} r={3.2} fill="#FEF3C7" stroke="#11131F" strokeWidth={1.8} />
    <circle cx={26} cy={26} r={3.2} fill="#FEF3C7" stroke="#11131F" strokeWidth={1.8} />

    {/* 军鼓扁圆柱鼓腔 */}
    <path
      d="M 11 29 L 11 47 C 11 52 53 52 53 47 L 53 29 Z"
      fill="#69709B"
      stroke="#11131F"
      strokeWidth={3.0}
      strokeLinejoin="round"
    />
    {/* 鼓腔金属三角拉杆与底圈箍 */}
    <polyline
      points="15,34 21,46 27,34 32,47 37,34 43,46 49,34"
      fill="none"
      stroke="#E2E8F0"
      strokeWidth={2.4}
      strokeLinejoin="round"
    />
    {/* 军鼓顶部白色鼓面（带金属压圈） */}
    <ellipse
      cx={32}
      cy={29}
      rx={21}
      ry={6.5}
      fill="#F8FAFC"
      stroke="#11131F"
      strokeWidth={3.0}
    />
    <ellipse
      cx={32}
      cy={29}
      rx={15}
      ry={4.0}
      fill="none"
      stroke="#CBD5E1"
      strokeWidth={1.6}
    />
  </svg>
);

/**
 * 3. 镲图标（Hi-Hat 踩镲 / Crash 吊镲）：
 * - 踩镲 (hat)：上下两片金色合击镲片 + 中央踩镲立杆 + 两侧清脆高频抖动短弧；
 * - 吊镲 (cymbal)：大尺寸倾斜单面金铜吊镲 + 放射泛音弧线。
 */
const CymbalHatIcon: React.FC<{ isCrash?: boolean }> = ({
  isCrash = false,
}) => (
  <svg
    width={isCrash ? 60 : 48}
    height={isCrash ? 60 : 48}
    viewBox="0 0 64 64"
    style={{ overflow: "visible" }}
  >
    {/* 高频金属震动声波弧线 */}
    <path
      d={
        isCrash
          ? "M 10 16 Q 32 5 54 16 M 8 44 Q 32 54 56 44"
          : "M 6 25 Q 3 32 6 39 M 58 25 Q 61 32 58 39"
      }
      fill="none"
      stroke="#FDE047"
      strokeWidth={2.8}
      strokeLinecap="round"
    />
    {/* 金属中心立杆与底托 */}
    <line
      x1={32}
      y1={10}
      x2={32}
      y2={56}
      stroke="#94A3B8"
      strokeWidth={3.6}
      strokeLinecap="round"
    />
    {isCrash ? (
      /* 吊镲：大幅倾斜单盘 + 镲帽凸起 */
      <g transform="rotate(-14, 32, 28)">
        <ellipse
          cx={32}
          cy={28}
          rx={25}
          ry={7.5}
          fill="#FACC15"
          stroke="#11131F"
          strokeWidth={3.0}
        />
        <ellipse
          cx={32}
          cy={26.5}
          rx={8.5}
          ry={3.2}
          fill="#FEF08A"
          stroke="#11131F"
          strokeWidth={2.2}
        />
      </g>
    ) : (
      /* 踩镲 (Hi-Hat)：上下两片合击双镲盘 */
      <g>
        {/* 下镲片 */}
        <ellipse
          cx={32}
          cy={35.5}
          rx={22}
          ry={5.2}
          fill="#EAB308"
          stroke="#11131F"
          strokeWidth={2.8}
        />
        {/* 上镲片 */}
        <ellipse
          cx={32}
          cy={29.5}
          rx={22}
          ry={5.2}
          fill="#FDE047"
          stroke="#11131F"
          strokeWidth={2.8}
        />
        {/* 上镲中心镲帽 (Bell) */}
        <path
          d="M 24 29.5 C 24 24 40 24 40 29.5 Z"
          fill="#FEF9C3"
          stroke="#11131F"
          strokeWidth={2.4}
        />
      </g>
    )}
  </svg>
);

/**
 * 4. 底鼓图标（Kick / Bass Drum）：
 * 正面大圆形立式低音大鼓 + 左右双支脚 + 底部踏板鼓槌向上击打鼓心 + 向外扩散的青绿低频圆形冲击波环。
 */
const KickDrumIcon: React.FC<{ progress: number }> = ({ progress }) => {
  const ringR = 23 + progress * 11;
  return (
    <svg width={56} height={56} viewBox="0 0 64 64" style={{ overflow: "visible" }}>
      {/* 向外扩散的低频圆形冲击波 */}
      <circle
        cx={32}
        cy={31}
        r={ringR}
        fill="none"
        stroke="#2DD4BF"
        strokeWidth={2.6}
        opacity={Math.max(0, 1 - progress * 1.15)}
      />

      {/* 底鼓左右金属斜撑支脚 */}
      <line
        x1={17}
        y1={44}
        x2={10}
        y2={55}
        stroke="#94A3B8"
        strokeWidth={3.6}
        strokeLinecap="round"
      />
      <line
        x1={47}
        y1={44}
        x2={54}
        y2={55}
        stroke="#94A3B8"
        strokeWidth={3.6}
        strokeLinecap="round"
      />

      {/* 底鼓外圈青绿鼓壳与深色木框 */}
      <circle
        cx={32}
        cy={31}
        r={21}
        fill="#356B75"
        stroke="#11131F"
        strokeWidth={3.2}
      />
      {/* 底鼓正面米白鼓皮 */}
      <circle
        cx={32}
        cy={31}
        r={15.5}
        fill="#F1F5F9"
        stroke="#11131F"
        strokeWidth={2.6}
      />
      {/* 鼓心共振内圈 */}
      <circle
        cx={32}
        cy={31}
        r={7.5}
        fill="#CBD5E1"
        stroke="#356B75"
        strokeWidth={2.0}
      />

      {/* 底部踩槌（Pedal Beater）向上撞击鼓心 */}
      <line
        x1={32}
        y1={56}
        x2={32}
        y2={35}
        stroke="#11131F"
        strokeWidth={3.4}
        strokeLinecap="round"
      />
      <rect
        x={27.5}
        y={53}
        width={9}
        height={4.5}
        rx={1.5}
        fill="#64748B"
        stroke="#11131F"
        strokeWidth={2.0}
      />
      {/* 白色毛毡槌头撞击中心 */}
      <circle
        cx={32}
        cy={32}
        r={4.6}
        fill="#FDBA74"
        stroke="#11131F"
        strokeWidth={2.4}
      />
    </svg>
  );
};

/**
 * 舞台环境中的全曲打击乐动效弹出层（严格对齐 `全曲鼓组 · 鼓谱修订 v2` 全曲 0.248s–206.879s）：
 * - 只要延长或截取任意动画时长，传入当前 `sec` 即可自动演绎全曲对应时刻的鼓掌（👏 Emoji 造型）、军鼓、踩镲/吊镲与底鼓。
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
      {SCORE_DRUMS_V2_EVENTS.map((ev, idx) => {
        const dt = sec - ev.sec;
        const lifetime = KIND_LIFETIME_SEC[ev.kind];
        if (dt < -POPUP_LEAD_SEC || dt > lifetime) return null;

        const p = Math.max(0, Math.min(1, dt / lifetime));
        const { x, y, rotDeg } = POPUP_PLACEMENTS[idx];

        // 提前 1 帧起跳 -> 命中帧到达弹性峰值 -> 回落微颤 -> 干净收拢淡出
        const scale =
          KIND_SCALE[ev.kind] *
          interpolate(
            dt,
            [-POPUP_LEAD_SEC, 0, 0.065, lifetime * 0.68, lifetime],
            [0.45, 1.18, 0.96, 1.0, 0.72],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
        const liftY = interpolate(
          dt,
          [-POPUP_LEAD_SEC, 0.065, lifetime],
          [8, 0, -12],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const opacity = interpolate(
          dt,
          [-POPUP_LEAD_SEC, 0, lifetime * 0.64, lifetime],
          [0.35, 0.96, 0.88, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
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
              <EmojiClapIcon isDoubleSecond={ev.kind === "clap-2"} />
            )}
            {ev.kind === "snare" && <SnareDrumIcon />}
            {(ev.kind === "hat" || ev.kind === "cymbal") && (
              <CymbalHatIcon isCrash={ev.kind === "cymbal"} />
            )}
            {ev.kind === "kick" && <KickDrumIcon progress={p} />}
          </div>
        );
      })}
    </div>
  );
};
