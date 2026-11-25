import React from "react";
import { interpolate } from "remotion";
import { clamp01, smoothStep } from "../../animation/clawd/motion-style";
import { POP_PALETTE } from "../../styles/palette";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const POP_FONT =
  '"Arial Black", "Impact", "Fredoka", "Hiragino Maru Gothic ProN", sans-serif';

/** 舞台台面上沿 Y 坐标（1280×720 设计坐标） */
const STAGE_TOP_Y = 528;

interface PopLetterSpec {
  ch: string;
  fill: string;
  rot: number;
  dy: number;
  dx?: number;
  scale?: number;
}

/** 第一声 TRY ME!（配合右下角近景探头，位于画面左上方） */
const FIRST_TRY_ME_LETTERS: readonly PopLetterSpec[] = [
  { ch: "T", fill: POP_PALETTE.yellow, rot: -8, dy: 4 },
  { ch: "R", fill: POP_PALETTE.pink, rot: 4, dy: -5 },
  { ch: "Y", fill: POP_PALETTE.mint, rot: -5, dy: 2 },
  { ch: " ", fill: POP_PALETTE.yellow, rot: 0, dy: 0 },
  { ch: "M", fill: POP_PALETTE.pink, rot: 5, dy: -4 },
  { ch: "E", fill: POP_PALETTE.yellow, rot: -6, dy: 3 },
  { ch: "!", fill: POP_PALETTE.mint, rot: 9, dy: -6, scale: 1.12 },
];

/** 第二声 TRY ME!（配合回中落地摆 Pose，位于舞台正上方黄金留白区） */
const SECOND_TRY_ME_LETTERS: readonly PopLetterSpec[] = [
  { ch: "T", fill: POP_PALETTE.mint, rot: -7, dy: 5 },
  { ch: "R", fill: POP_PALETTE.yellow, rot: 5, dy: -5 },
  { ch: "Y", fill: POP_PALETTE.pink, rot: -4, dy: 2 },
  { ch: " ", fill: POP_PALETTE.yellow, rot: 0, dy: 0 },
  { ch: "M", fill: POP_PALETTE.yellow, rot: 4, dy: -4 },
  { ch: "E", fill: POP_PALETTE.mint, rot: -5, dy: 3 },
  { ch: "!", fill: POP_PALETTE.pink, rot: 10, dy: -7, scale: 1.18 },
];

/** 手绘四角星芒路径 */
function fourPointStarPath(r: number): string {
  const inner = r * 0.28;
  return `M 0 ${-r} Q ${inner * 0.45} ${-inner * 0.45} ${r} 0 Q ${inner * 0.45} ${inner * 0.45} 0 ${r} Q ${-inner * 0.45} ${inner * 0.45} ${-r} 0 Q ${-inner * 0.45} ${-inner * 0.45} 0 ${-r} Z`;
}

/** 弹性 Snap-Lock 缩放曲线（过冲锁死，不抢拍） */
function snapPopScale(elapsed: number, dur = 0.16): number {
  if (elapsed <= 0) return 0;
  if (elapsed >= dur) return 1;
  const t = elapsed / dur;
  // 快冲至 ~1.16 再回弹锁死到 1.0
  if (t < 0.52) {
    const u = t / 0.52;
    return (1 - (1 - u) ** 3) * 1.16;
  }
  const u = (t - 0.52) / 0.48;
  return 1.16 - 0.16 * (1 - (1 - u) ** 2);
}

interface PopPhraseProps {
  letters: readonly PopLetterSpec[];
  cx: number;
  cy: number;
  fontSize: number;
  baseRotateDeg: number;
  enterSec: number;
  exitStartSec: number;
  exitEndSec: number;
  sec: number;
  showArcBurst?: boolean;
  starOffsets: readonly { x: number; y: number; r: number; color: string; rot: number }[];
}

/**
 * 单组波普卡通大字：双层贴纸描边（外茄紫深墨 + 内暖奶油）+ 硬偏移投影 + 短促漫画点缀
 */
const PopLyricPhrase: React.FC<PopPhraseProps> = ({
  letters,
  cx,
  cy,
  fontSize,
  baseRotateDeg,
  enterSec,
  exitStartSec,
  exitEndSec,
  sec,
  showArcBurst = false,
  starOffsets,
}) => {
  if (sec < enterSec - 0.01 || sec > exitEndSec + 0.02) return null;

  const sinceEnter = sec - enterSec;
  const enterScale = snapPopScale(sinceEnter, 0.17);
  const exitT = smoothStep(sec, exitStartSec, exitEndSec);
  const exitScale = 1 - exitT * 0.92;
  const scale = enterScale * exitScale;
  if (scale <= 0.02) return null;

  // 轻微体积守恒 squash & stretch
  const popSquash =
    sinceEnter >= 0 && sinceEnter < 0.17
      ? Math.sin((sinceEnter / 0.17) * Math.PI) * 0.08
      : 0;
  const sx = scale * (1 + popSquash);
  const sy = scale * (1 - popSquash * 0.85);

  // 停留期克制轻快浮动
  const settleGain = smoothStep(sinceEnter, 0.15, 0.24) * (1 - exitT);
  const floatY = Math.sin(sinceEnter * Math.PI * 3.8) * 3.2 * settleGain;
  const floatRot = Math.cos(sinceEnter * Math.PI * 2.4) * 1.1 * settleGain;
  const exitLift = -22 * exitT;
  const opacity = clamp01(sinceEnter / 0.03) * (1 - exitT);

  // 极短促漫画爆发点缀（0.20s）
  const burstRaw = clamp01(sinceEnter / 0.21);
  const burstActive = sinceEnter >= 0 && sinceEnter <= 0.22;
  const burstOpacity = burstActive ? (1 - burstRaw) * (1 - burstRaw * 0.3) : 0;

  // 逐字排版（基于字体大小按比例分布）
  const charStep = fontSize * 0.66;
  const spaceStep = fontSize * 0.34;
  const widths = letters.map((l) => (l.ch === " " ? spaceStep : charStep));
  const totalW = widths.reduce((a, b) => a + b, 0);
  let cursorX = -totalW * 0.5;

  const outerStroke = Math.round(fontSize * 0.24);
  const creamStroke = Math.round(fontSize * 0.13);
  const inkInnerStroke = Math.round(fontSize * 0.06);

  return (
    <g
      transform={`translate(${cx}, ${cy + floatY + exitLift}) rotate(${baseRotateDeg + floatRot}) scale(${sx}, ${sy})`}
      opacity={opacity}
    >
      {/* 极短促上半弧冲击波（仅用于第二声主重音） */}
      {showArcBurst && burstActive && (
        <g opacity={burstOpacity}>
          <path
            d={`M ${-totalW * 0.46 - burstRaw * 24} ${-fontSize * 0.1} A ${totalW * 0.48 + burstRaw * 26} ${fontSize * 0.82 + burstRaw * 16} 0 0 1 ${totalW * 0.46 + burstRaw * 24} ${-fontSize * 0.1}`}
            fill="none"
            stroke={POP_PALETTE.cream}
            strokeWidth={6 * (1 - burstRaw * 0.5)}
            strokeLinecap="round"
            strokeDasharray="18 14"
          />
          <path
            d={`M ${-totalW * 0.54 - burstRaw * 32} ${fontSize * 0.05} A ${totalW * 0.56 + burstRaw * 34} ${fontSize * 0.96 + burstRaw * 20} 0 0 1 ${totalW * 0.54 + burstRaw * 32} ${fontSize * 0.05}`}
            fill="none"
            stroke={POP_PALETTE.yellow}
            strokeWidth={4.5 * (1 - burstRaw * 0.55)}
            strokeLinecap="round"
            strokeDasharray="10 18"
          />
        </g>
      )}

      {/* 极短促动感漫画斜线（爆发瞬间） */}
      {burstActive && (
        <g opacity={burstOpacity}>
          {[
            { x: -totalW * 0.54, y: -fontSize * 0.34, ang: -148, len: 32, c: POP_PALETTE.yellow },
            { x: -totalW * 0.5, y: fontSize * 0.28, ang: 156, len: 26, c: POP_PALETTE.pink },
            { x: totalW * 0.54, y: -fontSize * 0.32, ang: -32, len: 34, c: POP_PALETTE.mint },
            { x: totalW * 0.5, y: fontSize * 0.26, ang: 24, len: 26, c: POP_PALETTE.yellow },
          ].map((ray, i) => {
            const rad = (ray.ang * Math.PI) / 180;
            const d0 = 6 + burstRaw * 16;
            const d1 = d0 + ray.len * (1 - burstRaw * 0.35);
            return (
              <line
                key={i}
                x1={ray.x + Math.cos(rad) * d0}
                y1={ray.y + Math.sin(rad) * d0}
                x2={ray.x + Math.cos(rad) * d1}
                y2={ray.y + Math.sin(rad) * d1}
                stroke={ray.c}
                strokeWidth={5.5 * (1 - burstRaw * 0.4)}
                strokeLinecap="round"
              />
            );
          })}
        </g>
      )}

      {/* 手绘四角星芒（随字弹入，略晚收起） */}
      {starOffsets.map((st, idx) => {
        const starPop = snapPopScale(sinceEnter - 0.02 * idx, 0.18);
        const twinkle = 0.92 + 0.12 * Math.sin(sinceEnter * Math.PI * 5 + idx * 1.7);
        const sScale = starPop * twinkle;
        if (sScale <= 0.05) return null;
        return (
          <g
            key={idx}
            transform={`translate(${st.x}, ${st.y}) rotate(${st.rot}) scale(${sScale})`}
          >
            <path
              d={fourPointStarPath(st.r)}
              fill={st.color}
              stroke={POP_PALETTE.ink}
              strokeWidth={3.2}
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {/* 逐字波普贴纸大字：先统一画硬阴影与外贴纸边，再画字面，保证字间无缝粘连 */}
      {(() => {
        const positioned = letters.map((l, idx) => {
          const w = widths[idx];
          const x = cursorX + w * 0.5 + (l.dx ?? 0);
          cursorX += w;
          const letterBounce =
            sinceEnter >= 0 && sinceEnter < 0.24
              ? Math.sin(clamp01((sinceEnter - idx * 0.012) / 0.16) * Math.PI) * -9
              : 0;
          return { ...l, x, y: l.dy + letterBounce };
        });

        const renderLayer = (
          keyPrefix: string,
          fill: string,
          stroke: string,
          strokeWidth: number,
          offsetX = 0,
          offsetY = 0,
        ) =>
          positioned.map((l, idx) => {
            if (l.ch === " ") return null;
            return (
              <text
                key={`${keyPrefix}-${idx}`}
                x={l.x + offsetX}
                y={l.y + offsetY}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${l.rot}, ${l.x + offsetX}, ${l.y + offsetY}) scale(${l.scale ?? 1})`}
                transform-origin={`${l.x + offsetX}px ${l.y + offsetY}px`}
                fontFamily={POP_FONT}
                fontSize={fontSize}
                fontWeight={900}
                fill={fill === "LETTER" ? l.fill : fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
                paintOrder="stroke fill"
              >
                {l.ch}
              </text>
            );
          });

        return (
          <>
            {/* 1. 硬偏移投影 */}
            {renderLayer("shadow", POP_PALETTE.ink, POP_PALETTE.ink, outerStroke, 6, 8)}
            {/* 2. 外层茄紫深墨粗轮廓 */}
            {renderLayer("ink-outer", POP_PALETTE.ink, POP_PALETTE.ink, outerStroke)}
            {/* 3. 内层暖奶油贴纸边 */}
            {renderLayer("cream", POP_PALETTE.cream, POP_PALETTE.cream, creamStroke)}
            {/* 4. 彩色字面 + 细深墨内描边 */}
            {renderLayer("face", "LETTER", POP_PALETTE.ink, inkInnerStroke)}
          </>
        );
      })()}
    </g>
  );
};

export interface ChorusLyricsProps {
  sec: number;
  diveStartSec: number;
  peekStartSec: number;
  firstExitStartSec: number;
  secondHitSec: number;
  secondExitStartSec: number;
  secondExitEndSec: number;
}

/**
 * 副歌舞台上方卡通歌词与瞬时漫画重音层（D037）：
 * - L015 缩回终端时的短促“咻！”速度线；
 * - 第一声 TRY ME!（左上弹出，避开右下角近景探头大头）；
 * - 探头到位瞬间的头顶漫画星芒；
 * - 第二声 TRY ME!（舞台正上方弹出，配合回中落地摆 Pose）与脚底漫画冲击尘烟。
 */
export const ChorusLyrics: React.FC<ChorusLyricsProps> = ({
  sec,
  diveStartSec,
  peekStartSec,
  firstExitStartSec,
  secondHitSec,
  secondExitStartSec,
  secondExitEndSec,
}) => {
  if (sec < diveStartSec - 0.02 || sec > secondExitEndSec + 0.05) return null;

  // 1. 缩回终端瞬间（~0.18s）：中央台面处极短促速度线 + 收缩扁圆环
  const diveT = clamp01((sec - diveStartSec) / 0.18);
  const showDiveFx = sec >= diveStartSec && sec <= diveStartSec + 0.2;

  // 2. 右下角探头到位瞬间（~0.20s）：大头左上方漫画惊喜线 + 星芒
  const peekFxT = clamp01((sec - (peekStartSec + 0.05)) / 0.2);
  const showPeekFx = sec >= peekStartSec + 0.05 && sec <= peekStartSec + 0.26;

  // 3. 回中落地瞬间（~0.20s）：脚底两侧漫画小冲击波弧
  const landFxT = clamp01((sec - secondHitSec) / 0.2);
  const showLandFx = sec >= secondHitSec && sec <= secondHitSec + 0.22;

  return (
    <svg
      width={1280}
      height={720}
      viewBox="0 0 1280 720"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 8,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {/* 缩回终端的极短促向下收敛速度线（咻！） */}
      {showDiveFx && (
        <g opacity={(1 - diveT) * 0.92}>
          <ellipse
            cx={640}
            cy={STAGE_TOP_Y - 2}
            rx={interpolate(diveT, [0, 1], [118, 22], CLAMP)}
            ry={interpolate(diveT, [0, 1], [14, 4], CLAMP)}
            fill="none"
            stroke={POP_PALETTE.cream}
            strokeWidth={4 * (1 - diveT * 0.5)}
          />
          {[-124, -92, 92, 124].map((dx, i) => {
            const yTop = STAGE_TOP_Y - 156 + diveT * 96 + (i % 2) * 16;
            const yBot = STAGE_TOP_Y - 38 + diveT * 30;
            return (
              <line
                key={i}
                x1={640 + dx * (1 - diveT * 0.22)}
                y1={yTop}
                x2={640 + dx * 0.68}
                y2={yBot}
                stroke={i % 2 === 0 ? POP_PALETTE.yellow : POP_PALETTE.mint}
                strokeWidth={5 * (1 - diveT * 0.45)}
                strokeLinecap="round"
              />
            );
          })}
        </g>
      )}

      {/* 第一声 TRY ME!（左上方 -30° 大倾斜，保留至句尾与第二声形成错落呼应） */}
      <PopLyricPhrase
        letters={FIRST_TRY_ME_LETTERS}
        cx={272}
        cy={178}
        fontSize={82}
        baseRotateDeg={-30}
        enterSec={peekStartSec + 0.02}
        exitStartSec={firstExitStartSec}
        exitEndSec={secondExitEndSec}
        sec={sec}
        starOffsets={[
          { x: -222, y: -36, r: 17, color: POP_PALETTE.yellow, rot: -14 },
          { x: 214, y: 34, r: 14, color: POP_PALETTE.pink, rot: 18 },
        ]}
      />

      {/* 右下角探头瞬间的漫画重音线（围绕大头左上轮廓） */}
      {showPeekFx && (
        <g opacity={1 - peekFxT}>
          {[
            { x: 810, y: 332, ang: -142, len: 34, c: POP_PALETTE.yellow },
            { x: 868, y: 274, ang: -118, len: 38, c: POP_PALETTE.pink },
            { x: 944, y: 242, ang: -92, len: 32, c: POP_PALETTE.mint },
          ].map((ray, i) => {
            const rad = (ray.ang * Math.PI) / 180;
            const d0 = 4 + peekFxT * 18;
            const d1 = d0 + ray.len * (1 - peekFxT * 0.3);
            return (
              <line
                key={i}
                x1={ray.x + Math.cos(rad) * d0}
                y1={ray.y + Math.sin(rad) * d0}
                x2={ray.x + Math.cos(rad) * d1}
                y2={ray.y + Math.sin(rad) * d1}
                stroke={ray.c}
                strokeWidth={6 * (1 - peekFxT * 0.4)}
                strokeLinecap="round"
              />
            );
          })}
          <g
            transform={`translate(${768 - peekFxT * 12}, ${292 - peekFxT * 12}) scale(${1 - peekFxT * 0.35})`}
          >
            <path
              d={fourPointStarPath(18)}
              fill={POP_PALETTE.cream}
              stroke={POP_PALETTE.ink}
              strokeWidth={3.2}
              strokeLinejoin="round"
            />
          </g>
        </g>
      )}

      {/* 第二声 TRY ME!（右上方 +30° 大倾斜，与第一声角度对称但位置更低，视觉上不对称） */}
      <PopLyricPhrase
        letters={SECOND_TRY_ME_LETTERS}
        cx={1012}
        cy={238}
        fontSize={84}
        baseRotateDeg={30}
        enterSec={secondHitSec}
        exitStartSec={secondExitStartSec}
        exitEndSec={secondExitEndSec}
        sec={sec}
        showArcBurst
        starOffsets={[
          { x: -232, y: -34, r: 18, color: POP_PALETTE.pink, rot: -12 },
          { x: 236, y: -28, r: 19, color: POP_PALETTE.yellow, rot: 15 },
          { x: 204, y: 40, r: 13, color: POP_PALETTE.mint, rot: -20 },
        ]}
      />

      {/* 第二声底部巨型扒窗钻出瞬间的左右极短促漫画惊喜线 */}
      {showLandFx && (
        <g opacity={(1 - landFxT) * 0.94}>
          {[
            { x: 232, y: 368, ang: -152, len: 36, c: POP_PALETTE.yellow },
            { x: 262, y: 318, ang: -128, len: 34, c: POP_PALETTE.mint },
            { x: 1048, y: 368, ang: -28, len: 36, c: POP_PALETTE.pink },
            { x: 1018, y: 318, ang: -52, len: 34, c: POP_PALETTE.yellow },
          ].map((ray, i) => {
            const rad = (ray.ang * Math.PI) / 180;
            const d0 = 6 + landFxT * 20;
            const d1 = d0 + ray.len * (1 - landFxT * 0.35);
            return (
              <line
                key={i}
                x1={ray.x + Math.cos(rad) * d0}
                y1={ray.y + Math.sin(rad) * d0}
                x2={ray.x + Math.cos(rad) * d1}
                y2={ray.y + Math.sin(rad) * d1}
                stroke={ray.c}
                strokeWidth={6 * (1 - landFxT * 0.4)}
                strokeLinecap="round"
              />
            );
          })}
        </g>
      )}
    </svg>
  );
};
