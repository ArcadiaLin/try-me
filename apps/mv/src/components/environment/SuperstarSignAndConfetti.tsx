import React from "react";
import { interpolate } from "remotion";
import { clamp01, smoothStep } from "../../animation/clawd/motion-style";
import { POP_PALETTE } from "../../styles/palette";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const SIGN_FONT =
  '"Arial Black", "Impact", "Fredoka", "Hiragino Maru Gothic ProN", sans-serif';

/** 舞台台面上沿 Y 坐标（礼炮严格从台面上沿钻出显现） */
const STAGE_TOP_Y = 528;

/** 粗体多彩 SUPERSTAR 逐字配置（汽水糖果 3 核心强调色交替，错落倾角） */
const SUPERSTAR_LETTERS = [
  { ch: "S", fill: POP_PALETTE.yellow, rot: -6, dy: 4 },
  { ch: "U", fill: POP_PALETTE.pink, rot: 3, dy: -5 },
  { ch: "P", fill: POP_PALETTE.mint, rot: -3, dy: 1 },
  { ch: "E", fill: POP_PALETTE.yellow, rot: 4, dy: -4 },
  { ch: "R", fill: POP_PALETTE.pink, rot: -4, dy: 3 },
  { ch: "S", fill: POP_PALETTE.mint, rot: 3, dy: -4 },
  { ch: "T", fill: POP_PALETTE.yellow, rot: -3, dy: 2 },
  { ch: "A", fill: POP_PALETTE.pink, rot: 5, dy: -3 },
  { ch: "R", fill: POP_PALETTE.mint, rot: -5, dy: 4 },
] as const;

/** 招牌正面的波普彩色斜条装饰（裁切在非对称木牌正面，位于木纹之上、大字之下） */
const SIGN_FRONT_STRIPES = [
  { x: -324, y: 4, w: 20, color: POP_PALETTE.pink },
  { x: -290, y: 4, w: 12, color: POP_PALETTE.yellow },
  { x: -264, y: 4, w: 8, color: POP_PALETTE.mint },
  { x: 268, y: -4, w: 8, color: POP_PALETTE.pink },
  { x: 294, y: -4, w: 13, color: POP_PALETTE.mint },
  { x: 328, y: -4, w: 20, color: POP_PALETTE.yellow },
] as const;

/** 招牌外沿点缀的小斜线 */
const SIGN_OUTER_SLASHES = [
  { x: -380, y: -16, len: 36, angle: -50, color: POP_PALETTE.pink, w: 7.5 },
  { x: -362, y: 36, len: 26, angle: -50, color: POP_PALETTE.yellow, w: 6 },
  { x: 382, y: -24, len: 38, angle: -50, color: POP_PALETTE.yellow, w: 7.5 },
  { x: 366, y: 28, len: 26, angle: -50, color: POP_PALETTE.mint, w: 6 },
] as const;

/**
 * 非对称手工波普云朵木牌轮廓（打破左右对称与均匀起伏，大小云瓣错落有机，中间依然保持修长薄度）
 */
const ASYM_CLOUD_LOBES = [
  // 左端大圆弧 + 左上翘起云瓣
  { cx: -302, cy: 10, rx: 56, ry: 44 },
  { cx: -244, cy: -30, rx: 68, ry: 40 },
  // 中左略收低、中右饱满鼓起、右端斜上俏皮收尾
  { cx: -146, cy: -26, rx: 66, ry: 33 },
  { cx: -46, cy: -35, rx: 74, ry: 38 },
  { cx: 58, cy: -29, rx: 68, ry: 34 },
  { cx: 162, cy: -36, rx: 76, ry: 40 },
  { cx: 256, cy: -24, rx: 64, ry: 36 },
  { cx: 306, cy: -2, rx: 54, ry: 42 },
  // 下沿错落起伏（左低右轻扬）
  { cx: -222, cy: 36, rx: 68, ry: 35 },
  { cx: -116, cy: 30, rx: 70, ry: 32 },
  { cx: -8, cy: 38, rx: 76, ry: 36 },
  { cx: 104, cy: 31, rx: 68, ry: 32 },
  { cx: 204, cy: 35, rx: 72, ry: 35 },
  { cx: 278, cy: 24, rx: 52, ry: 32 },
] as const;

interface PopperSpec {
  id: string;
  /** 引爆目标位置 X (px) */
  targetX: number;
  /** 引爆目标位置 Y (px) */
  targetY: number;
  /** 礼炮指向方向（SVG 角度：0° 为正上方，正值顺时针偏右，负值逆时针偏左） */
  aimDeg: number;
  /** 整体缩放尺寸 */
  scale: number;
  /** 入场与引爆微错峰 (s) */
  staggerSec: number;
  /** 主色、条纹1、条纹2 */
  bodyColor: string;
  stripeA: string;
  stripeB: string;
  seed: number;
}

/**
 * 左侧 2 门、右侧 2 门大号精致波普礼炮（左右非对称高低错落排列）：
 * 左侧为外低内高，右侧反转为内低外高且角度/间距错开；
 * 每门在卡点前顺着从尾部到顶部的方向从舞台平面上快速钻出滑行到引爆点，并于 1:01:01 齐射喷出缎带！
 */
const PARTY_POPPERS: readonly PopperSpec[] = [
  // 左侧 2 门：外低内高（斜指向右上方）
  {
    id: "left-outer",
    targetX: 640 - 338,
    targetY: 468,
    aimDeg: 44,
    scale: 1.02,
    staggerSec: 0.0,
    bodyColor: POP_PALETTE.yellow,
    stripeA: POP_PALETTE.pink,
    stripeB: POP_PALETTE.mint,
    seed: 1,
  },
  {
    id: "left-inner",
    targetX: 640 - 234,
    targetY: 416,
    aimDeg: 28,
    scale: 0.94,
    staggerSec: 0.018,
    bodyColor: POP_PALETTE.mint,
    stripeA: POP_PALETTE.yellow,
    stripeB: POP_PALETTE.pink,
    seed: 2,
  },
  // 右侧 2 门：内低外高（与左侧完全不同的高低与角度排列，斜指向左上方）
  {
    id: "right-inner-low",
    targetX: 640 + 258,
    targetY: 472,
    aimDeg: -32,
    scale: 0.94,
    staggerSec: 0.012,
    bodyColor: POP_PALETTE.pink,
    stripeA: POP_PALETTE.yellow,
    stripeB: POP_PALETTE.mint,
    seed: 3,
  },
  {
    id: "right-outer-high",
    targetX: 640 + 368,
    targetY: 396,
    aimDeg: -50,
    scale: 1.06,
    staggerSec: 0.026,
    bodyColor: POP_PALETTE.yellow,
    stripeA: POP_PALETTE.mint,
    stripeB: POP_PALETTE.pink,
    seed: 4,
  },
] as const;

interface RibbonParticle {
  kind: "ribbon" | "confetti";
  /** 相对于礼炮瞄准方向的偏转角 (度) */
  spreadDeg: number;
  /** 初始发射速度 (px/s) */
  speed: number;
  gravity: number;
  drag: number;
  rot0: number;
  rotSpeed: number;
  swayAmp: number;
  swayPhase: number;
  color: string;
  scale: number;
  lifeSec: number;
}

/** 每门礼炮喷出的 6 枚手绘弯曲缎带与彩纸片（5 门合计 30 枚，错落饱满不杂乱） */
const SINGLE_POPPER_PARTICLES: readonly RibbonParticle[] = [
  {
    kind: "ribbon",
    spreadDeg: -14,
    speed: 620,
    gravity: 610,
    drag: 1.65,
    rot0: -25,
    rotSpeed: 220,
    swayAmp: 18,
    swayPhase: 0.4,
    color: POP_PALETTE.yellow,
    scale: 1.15,
    lifeSec: 1.38,
  },
  {
    kind: "ribbon",
    spreadDeg: 4,
    speed: 560,
    gravity: 580,
    drag: 1.75,
    rot0: 18,
    rotSpeed: -245,
    swayAmp: 20,
    swayPhase: 1.7,
    color: POP_PALETTE.pink,
    scale: 1.1,
    lifeSec: 1.32,
  },
  {
    kind: "ribbon",
    spreadDeg: 18,
    speed: 520,
    gravity: 560,
    drag: 1.8,
    rot0: -40,
    rotSpeed: 195,
    swayAmp: 16,
    swayPhase: 2.9,
    color: POP_PALETTE.mint,
    scale: 1.05,
    lifeSec: 1.4,
  },
  {
    kind: "ribbon",
    spreadDeg: -6,
    speed: 450,
    gravity: 530,
    drag: 1.85,
    rot0: 32,
    rotSpeed: -210,
    swayAmp: 17,
    swayPhase: 4.2,
    color: POP_PALETTE.cream,
    scale: 0.96,
    lifeSec: 1.26,
  },
  {
    kind: "confetti",
    spreadDeg: -22,
    speed: 590,
    gravity: 590,
    drag: 1.7,
    rot0: 12,
    rotSpeed: 390,
    swayAmp: 13,
    swayPhase: 1.1,
    color: POP_PALETTE.yellow,
    scale: 1.05,
    lifeSec: 1.24,
  },
  {
    kind: "confetti",
    spreadDeg: 24,
    speed: 540,
    gravity: 570,
    drag: 1.75,
    rot0: -28,
    rotSpeed: -360,
    swayAmp: 14,
    swayPhase: 3.4,
    color: POP_PALETTE.pink,
    scale: 0.98,
    lifeSec: 1.2,
  },
] as const;

/**
 * 精致大号日系波普手绘礼炮筒（局部坐标：原点在筒身中点，尾部在 +Y = +44，敞口顶部在 -Y = -36）：
 * - 含圆润锥形筒身、彩色斜条纹、立体高光与暗面、敞口卷边与暗腔、尾端金属帽与小拉环；
 * - 引爆瞬间带后坐力回缩与炮口星芒爆闪。
 */
const DetailedPartyPopper: React.FC<{
  spec: PopperSpec;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  recoilY: number;
  flashT: number;
}> = ({ spec, x, y, scale, opacity, recoilY, flashT }) => {
  const clipId = `popper-body-clip-${spec.id}`;
  const flashOpacity =
    flashT > 0 && flashT < 1
      ? interpolate(flashT, [0, 0.22, 1], [0, 1, 0], CLAMP)
      : 0;

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${spec.aimDeg}) translate(0, ${recoilY}) scale(${scale})`}
      opacity={opacity}
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M -22 -30 L 22 -30 L 8 34 Q 0 38 -8 34 Z" />
        </clipPath>
      </defs>

      {/* 1. 尾端金属小底帽（干净收尾，无多余拉环圈） */}
      <rect
        x={-8.5}
        y={31}
        width={17}
        height={9}
        rx={4}
        fill="#CBD5E1"
        stroke={POP_PALETTE.ink}
        strokeWidth={3.6}
      />

      {/* 3. 礼炮硬偏移投影 */}
      <path
        d="M -22 -30 L 22 -30 L 8 34 Q 0 38 -8 34 Z"
        transform="translate(4, 5)"
        fill={POP_PALETTE.ink}
        opacity={0.75}
      />

      {/* 4. 礼炮锥形主筒身（底色 + 内部斜彩条 + 圆柱立体高光/暗面） */}
      <path
        d="M -22 -30 L 22 -30 L 8 34 Q 0 38 -8 34 Z"
        fill={spec.bodyColor}
      />
      <g clipPath={`url(#${clipId})`}>
        {/* 两条清晰鲜明的波普斜彩带 */}
        <path
          d="M -30 -12 L 30 -24 L 30 -9 L -30 3 Z"
          fill={spec.stripeA}
          stroke={POP_PALETTE.ink}
          strokeWidth={2.6}
        />
        <path
          d="M -28 10 L 28 -2 L 28 11 L -28 23 Z"
          fill={spec.stripeB}
          stroke={POP_PALETTE.ink}
          strokeWidth={2.6}
        />
        {/* 右侧微妙暗面阴影，增强圆锥立体感 */}
        <path
          d="M 8 -32 L 26 -32 L 10 38 L 2 38 Z"
          fill={POP_PALETTE.ink}
          opacity={0.18}
        />
        {/* 左侧亮奶油塑料高光条 */}
        <path
          d="M -14 -26 L -8 -26 L -3 28 L -7 28 Z"
          fill={POP_PALETTE.creamLight}
          opacity={0.62}
        />
      </g>

      {/* 5. 筒身茄紫深墨粗外轮廓 */}
      <path
        d="M -22 -30 L 22 -30 L 8 34 Q 0 38 -8 34 Z"
        fill="none"
        stroke={POP_PALETTE.ink}
        strokeWidth={4.2}
        strokeLinejoin="round"
      />

      {/* 6. 顶部立体敞口卷边唇缘与深墨内膛 */}
      <ellipse
        cx={0}
        cy={-30}
        rx={23.5}
        ry={8.5}
        fill={POP_PALETTE.cream}
        stroke={POP_PALETTE.ink}
        strokeWidth={4}
      />
      <ellipse
        cx={0}
        cy={-30}
        rx={17.5}
        ry={5}
        fill={POP_PALETTE.ink}
      />

      {/* 7. 引爆瞬间的炮口波普爆裂光芒 */}
      {flashOpacity > 0.02 && (
        <g opacity={flashOpacity} transform="translate(0, -36)">
          {[-42, -16, 12, 38].map((deg, idx) => {
            const rad = ((deg - 90) * Math.PI) / 180;
            const r0 = 10 + flashT * 10;
            const r1 = r0 + (idx % 2 === 0 ? 28 : 20) + flashT * 14;
            return (
              <g key={deg}>
                <line
                  x1={Math.cos(rad) * r0}
                  y1={Math.sin(rad) * r0}
                  x2={Math.cos(rad) * r1}
                  y2={Math.sin(rad) * r1}
                  stroke={POP_PALETTE.ink}
                  strokeWidth={8.5}
                  strokeLinecap="round"
                />
                <line
                  x1={Math.cos(rad) * r0}
                  y1={Math.sin(rad) * r0}
                  x2={Math.cos(rad) * r1}
                  y2={Math.sin(rad) * r1}
                  stroke={idx % 2 === 0 ? POP_PALETTE.yellow : POP_PALETTE.cream}
                  strokeWidth={4.5}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </g>
      )}
    </g>
  );
};

export interface SuperstarSignAndConfettiProps {
  sec: number;
  triggerSec: number;
  exitStartSec: number;
  exitEndSec: number;
}

/**
 * L014 `superstar` 卡点舞台视觉：
 * 1. 舞台上方垂降非对称手工波普云朵木牌 `SUPERSTAR`（浅暖木纹 + 正面斜向波普彩条 + 多彩粗字）；
 * 2. 左侧 2 门、右侧 3 门大号精致波普礼炮，在卡点前顺着尾部→顶部方向从舞台平面上快速显现冲至引爆点，
 *    并在 1:01:01 瞬间齐射喷出彩色弯曲缎带与彩纸片，随后抛物线下落淡出消失。
 */
export const SuperstarSignAndConfetti: React.FC<
  SuperstarSignAndConfettiProps
> = ({ sec, triggerSec, exitStartSec, exitEndSec }) => {
  // 礼炮提前 0.17s 开始从舞台台面上顺着轴线快速冲出显现，刚好在 triggerSec (1:01:01) 抵达引爆位
  const popperSlideDur = 0.17;
  const earliestSec = triggerSec - popperSlideDur;
  if (sec < earliestSec || sec > exitEndSec + 0.08) return null;

  const elapsed = sec - triggerSec;
  const showSign = elapsed >= 0;

  // --- 1. SUPERSTAR 非对称云朵木牌垂降、轻摆与收起 ---
  const dropT = clamp01(elapsed / 0.24);
  const dropY = interpolate(
    dropT,
    [0, 0.56, 0.78, 0.92, 1],
    [-190, 184, 152, 166, 160],
    CLAMP,
  );
  const exitT = smoothStep(sec, exitStartSec, exitEndSec);
  const signY = dropY - exitT * 360;
  // 整体略向右上俏皮微倾 (-2.2°)，停留期带极克制摇摆
  const settleSway =
    -2.2 +
    Math.sin(Math.max(0, elapsed) * Math.PI * 2.2) *
      1.05 *
      smoothStep(elapsed, 0.16, 0.35) *
      (1 - exitT);
  const signScaleY = interpolate(
    dropT,
    [0, 0.52, 0.72, 1],
    [1.08, 0.91, 1.04, 1.0],
    CLAMP,
  );
  const signScaleX = 1 / signScaleY;

  const slashT = clamp01((elapsed - 0.08) / 0.18);
  const slashScale = interpolate(
    slashT,
    [0, 0.65, 1],
    [0.15, 1.12, 1.0],
    CLAMP,
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 8,
        pointerEvents: "none",
      }}
    >
      <svg
        width={1280}
        height={720}
        viewBox="0 0 1280 720"
        style={{
          position: "absolute",
          inset: 0,
          overflow: "visible",
        }}
      >
        <defs>
          {/* 舞台台面以上裁切区：使礼炮严格从舞台平面上面显现、滑出 */}
          <clipPath id="stage-above-deck-clip">
            <rect x={0} y={0} width={1280} height={STAGE_TOP_Y} />
          </clipPath>
        </defs>

        {/* A. 左 2 右 3 精致大号礼炮（顺着尾部→顶部方向从舞台平面快速显现冲至引爆位 + 1:01:01 齐射缎带） */}
        <g clipPath="url(#stage-above-deck-clip)">
          {PARTY_POPPERS.map((spec) => {
            const fireSec = triggerSec + spec.staggerSec;
            const slideStartSec = fireSec - popperSlideDur;
            const sinceFire = sec - fireSec;
            const popperExitEnd = 0.52;

            // 沿礼炮自身瞄准方向（从尾部指向顶部的单位向量）计算滑出路径
            const aimRad = ((spec.aimDeg - 90) * Math.PI) / 180;
            const dirX = Math.cos(aimRad);
            const dirY = Math.sin(aimRad); // 向上为负

            // 计算从台面下方沿炮身反方向回退的起点距离（确保起点位于舞台平面下沿）
            const travelDist = Math.max(
              140,
              (STAGE_TOP_Y + 46 - spec.targetY) / Math.max(0.35, -dirY),
            );

            // 快速冲出曲线 (0 -> 1)：快出缓停在引爆点
            const slideT = clamp01((sec - slideStartSec) / popperSlideDur);
            const slideEase = 1 - (1 - slideT) ** 2.6;
            const curX = spec.targetX - dirX * travelDist * (1 - slideEase);
            const curY = spec.targetY - dirY * travelDist * (1 - slideEase);

            // 一边移动一边快速显现；发射后 0.34s–0.52s 顺着反方向快速收回淡出
            const appearAlpha = smoothStep(slideT, 0.04, 0.42);
            const exitProg = clamp01((sinceFire - 0.34) / (popperExitEnd - 0.34));
            const exitAlpha = 1 - smoothStep(exitProg, 0, 1);
            const popperVisible =
              sec >= slideStartSec && sinceFire <= popperExitEnd;

            // 引爆瞬间的强烈后坐力回缩（沿炮身向尾部退 18px 再回弹）
            const recoilY =
              sinceFire >= 0
                ? interpolate(sinceFire, [0, 0.055, 0.16], [0, 18, 0], CLAMP) +
                  exitProg * 48
                : 0;
            const popperScale =
              spec.scale *
              interpolate(slideT, [0, 0.6, 1], [0.78, 1.04, 1.0], CLAMP) *
              (1 - exitProg * 0.25);
            const flashT = sinceFire >= 0 ? clamp01(sinceFire / 0.18) : 0;

            // 炮口发射点（在 target 位置沿瞄准方向向前 34px）
            const muzzleX = spec.targetX + dirX * 34 * spec.scale;
            const muzzleY = spec.targetY + dirY * 34 * spec.scale;

            return (
              <g key={spec.id}>
                {/* 1:01:01 喷出并抛物线下落淡出的彩色弯曲缎带与彩纸 */}
                {sinceFire >= 0 &&
                  SINGLE_POPPER_PARTICLES.map((p, idx) => {
                    if (sinceFire > p.lifeSec) return null;

                    const pRad =
                      ((spec.aimDeg + p.spreadDeg - 90) * Math.PI) / 180;
                    const speedJitter = 0.92 + ((spec.seed + idx) % 4) * 0.055;
                    const vx = Math.cos(pRad) * p.speed * speedJitter;
                    const vy = Math.sin(pRad) * p.speed * speedJitter;

                    const k = p.drag;
                    const expTerm = (1 - Math.exp(-k * sinceFire)) / k;
                    const sway =
                      Math.sin(sinceFire * 5.2 + p.swayPhase + spec.seed * 1.1) *
                      p.swayAmp *
                      smoothStep(sinceFire, 0.22, 0.72);

                    const px = muzzleX + vx * expTerm + sway;
                    const py =
                      muzzleY +
                      vy * expTerm +
                      0.5 * p.gravity * sinceFire * sinceFire;

                    const fadeOut =
                      1 - smoothStep(sinceFire, p.lifeSec - 0.32, p.lifeSec);
                    const floorFade = 1 - smoothStep(py, 520, STAGE_TOP_Y);
                    const alpha = fadeOut * floorFade;
                    if (alpha <= 0.01) return null;

                    const signDir = spec.aimDeg >= 0 ? 1 : -1;
                    const rot =
                      p.rot0 * signDir + p.rotSpeed * signDir * sinceFire;
                    const s =
                      p.scale *
                      interpolate(
                        sinceFire,
                        [0, 0.07, p.lifeSec],
                        [0.35, 1.05, 0.82],
                        CLAMP,
                      );

                    return (
                      <g
                        key={`${spec.id}-pt-${idx}`}
                        transform={`translate(${px}, ${py}) rotate(${rot}) scale(${s})`}
                        opacity={alpha}
                      >
                        {p.kind === "ribbon" ? (
                          <path
                            d="M -18 -5 Q -8 -14 0 -2 Q 8 10 18 1 L 16 8 Q 6 17 -2 5 Q -10 -7 -20 2 Z"
                            fill={p.color}
                            stroke={POP_PALETTE.ink}
                            strokeWidth={2.5}
                            strokeLinejoin="round"
                          />
                        ) : (
                          <rect
                            x={-6.5}
                            y={-4.5}
                            width={13}
                            height={9}
                            rx={1.5}
                            fill={p.color}
                            stroke={POP_PALETTE.ink}
                            strokeWidth={2.3}
                          />
                        )}
                      </g>
                    );
                  })}

                {/* 礼炮本体 */}
                {popperVisible && (
                  <DetailedPartyPopper
                    spec={spec}
                    x={curX}
                    y={curY}
                    scale={popperScale}
                    opacity={appearAlpha * exitAlpha}
                    recoilY={recoilY}
                    flashT={flashT}
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* B. 舞台上方垂降的非对称手工云朵木牌 SUPERSTAR 多彩大招牌 */}
        {showSign && (
          <g
            transform={`translate(640, ${signY}) rotate(${settleSway}) scale(${signScaleX}, ${signScaleY})`}
          >
            <defs>
              <clipPath id="superstar-cloud-clip">
                <rect x={-292} y={-32} width={586} height={64} rx={26} />
                {ASYM_CLOUD_LOBES.map((l, i) => (
                  <ellipse
                    key={`cclip-${i}`}
                    cx={l.cx}
                    cy={l.cy}
                    rx={l.rx}
                    ry={l.ry}
                  />
                ))}
              </clipPath>
            </defs>

            {/* 两根从舞台顶棚垂下的冷灰金属吊杆（略微错开位置配合非对称云朵） */}
            {[-218, 210].map((rx) => (
              <g key={rx}>
                <rect
                  x={rx - 4.5}
                  y={-420}
                  width={9}
                  height={378}
                  fill="#7D8799"
                  stroke={POP_PALETTE.ink}
                  strokeWidth={3}
                />
                <rect
                  x={rx - 1.5}
                  y={-420}
                  width={2.5}
                  height={378}
                  fill="#CBD5E1"
                />
                <circle
                  cx={rx}
                  cy={-44}
                  r={7}
                  fill={POP_PALETTE.cream}
                  stroke={POP_PALETTE.ink}
                  strokeWidth={3}
                />
              </g>
            ))}

            {/* 云朵外沿小斜线与星芒点缀 */}
            <g transform={`scale(${slashScale})`}>
              {SIGN_OUTER_SLASHES.map((sl, idx) => (
                <g
                  key={idx}
                  transform={`translate(${sl.x}, ${sl.y}) rotate(${sl.angle})`}
                >
                  <line
                    x1={-sl.len / 2}
                    y1={0}
                    x2={sl.len / 2}
                    y2={0}
                    stroke={POP_PALETTE.ink}
                    strokeWidth={sl.w + 7}
                    strokeLinecap="round"
                  />
                  <line
                    x1={-sl.len / 2}
                    y1={0}
                    x2={sl.len / 2}
                    y2={0}
                    stroke={sl.color}
                    strokeWidth={sl.w}
                    strokeLinecap="round"
                  />
                </g>
              ))}

              {[
                { x: -400, y: 12, s: 16, fill: POP_PALETTE.cream },
                { x: 404, y: -8, s: 19, fill: POP_PALETTE.yellow },
              ].map((st, idx) => (
                <g key={idx} transform={`translate(${st.x}, ${st.y})`}>
                  <path
                    d={`M 0 ${-st.s} Q ${st.s * 0.22} ${-st.s * 0.22} ${st.s} 0 Q ${
                      st.s * 0.22
                    } ${st.s * 0.22} 0 ${st.s} Q ${-st.s * 0.22} ${
                      st.s * 0.22
                    } ${-st.s} 0 Q ${-st.s * 0.22} ${-st.s * 0.22} 0 ${-st.s} Z`}
                    fill={st.fill}
                    stroke={POP_PALETTE.ink}
                    strokeWidth={3.5}
                    strokeLinejoin="round"
                  />
                </g>
              ))}
            </g>

            {/* 非对称云朵木牌底板：硬偏移深墨投影 → 茄紫深墨粗外轮廓 → 浅暖木色实体 */}
            <g>
              <g
                transform="translate(9, 11)"
                fill={POP_PALETTE.ink}
                stroke={POP_PALETTE.ink}
                strokeWidth={16}
              >
                <rect x={-292} y={-32} width={586} height={64} rx={26} />
                {ASYM_CLOUD_LOBES.map((l, i) => (
                  <ellipse
                    key={`csh-${i}`}
                    cx={l.cx}
                    cy={l.cy}
                    rx={l.rx}
                    ry={l.ry}
                  />
                ))}
              </g>

              <g
                fill={POP_PALETTE.ink}
                stroke={POP_PALETTE.ink}
                strokeWidth={16}
              >
                <rect x={-292} y={-32} width={586} height={64} rx={26} />
                {ASYM_CLOUD_LOBES.map((l, i) => (
                  <ellipse
                    key={`cout-${i}`}
                    cx={l.cx}
                    cy={l.cy}
                    rx={l.rx}
                    ry={l.ry}
                  />
                ))}
              </g>

              <g fill="#F4DCB2">
                <rect x={-292} y={-32} width={586} height={64} rx={26} />
                {ASYM_CLOUD_LOBES.map((l, i) => (
                  <ellipse
                    key={`cfill-${i}`}
                    cx={l.cx}
                    cy={l.cy}
                    rx={l.rx}
                    ry={l.ry}
                  />
                ))}
              </g>

              {/* 牌子正面内容（裁切在非对称云朵内）：木纹底纹 + 正面斜向彩条 */}
              <g clipPath="url(#superstar-cloud-clip)">
                <rect
                  x={-370}
                  y={-85}
                  width={740}
                  height={56}
                  fill="#F8E5C3"
                  opacity={0.65}
                />
                <rect
                  x={-370}
                  y={22}
                  width={740}
                  height={64}
                  fill="#E9CB98"
                  opacity={0.45}
                />

                {/* 卡通矢量木纹与小木节 */}
                <g
                  fill="none"
                  stroke="#D8B37C"
                  strokeLinecap="round"
                  opacity={0.68}
                >
                  <path
                    d="M -365 -42 Q -210 -50 -60 -40 T 210 -44 T 370 -38"
                    strokeWidth={2.5}
                  />
                  <path
                    d="M -365 -20 Q -180 -14 -30 -22 T 230 -16 T 370 -22"
                    strokeWidth={2}
                  />
                  <path
                    d="M -365 4 Q -220 12 -80 2 T 180 8 T 370 2"
                    strokeWidth={2.4}
                  />
                  <path
                    d="M -365 28 Q -190 22 -40 30 T 220 24 T 370 30"
                    strokeWidth={2}
                  />
                  <path
                    d="M -365 48 Q -200 54 -50 46 T 200 52 T 370 46"
                    strokeWidth={2.4}
                  />
                  <ellipse cx={-168} cy={-30} rx={22} ry={5.5} strokeWidth={1.8} />
                  <ellipse cx={146} cy={32} rx={26} ry={6} strokeWidth={1.8} />
                </g>

                {/* 正面波普斜向彩色条纹 */}
                <g opacity={0.94}>
                  {SIGN_FRONT_STRIPES.map((st, idx) => (
                    <g
                      key={`fstripe-${idx}`}
                      transform={`translate(${st.x}, ${st.y}) rotate(-32)`}
                    >
                      <rect
                        x={-st.w / 2}
                        y={-130}
                        width={st.w}
                        height={260}
                        fill={st.color}
                        stroke={POP_PALETTE.ink}
                        strokeWidth={3}
                      />
                    </g>
                  ))}
                </g>

                {/* 非对称云朵上沿高光弧 */}
                <g
                  fill="none"
                  stroke={POP_PALETTE.creamLight}
                  strokeWidth={5}
                  strokeLinecap="round"
                  opacity={0.72}
                >
                  <path d="M -274 -52 Q -244 -64 -212 -52" />
                  <path d="M -78 -62 Q -46 -72 -12 -62" />
                  <path d="M 128 -64 Q 162 -74 196 -62" />
                </g>
              </g>
            </g>

            {/* 粗体多彩 SUPERSTAR 字母 */}
            <g>
              <g transform="translate(4, 5)">
                {SUPERSTAR_LETTERS.map((item, idx) => {
                  const lx = (idx - 4) * 63;
                  return (
                    <text
                      key={`lsh-${idx}`}
                      x={lx}
                      y={item.dy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      transform={`rotate(${item.rot}, ${lx}, ${item.dy})`}
                      fontFamily={SIGN_FONT}
                      fontSize={86}
                      fontWeight={900}
                      fill={POP_PALETTE.ink}
                      stroke={POP_PALETTE.ink}
                      strokeWidth={12}
                      strokeLinejoin="round"
                    >
                      {item.ch}
                    </text>
                  );
                })}
              </g>

              {SUPERSTAR_LETTERS.map((item, idx) => {
                const lx = (idx - 4) * 63;
                return (
                  <text
                    key={`fg-${idx}`}
                    x={lx}
                    y={item.dy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${item.rot}, ${lx}, ${item.dy})`}
                    fontFamily={SIGN_FONT}
                    fontSize={86}
                    fontWeight={900}
                    fill={item.fill}
                    stroke={POP_PALETTE.ink}
                    strokeWidth={12}
                    paintOrder="stroke fill"
                    strokeLinejoin="round"
                  >
                    {item.ch}
                  </text>
                );
              })}
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};
