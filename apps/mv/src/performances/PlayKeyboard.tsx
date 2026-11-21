import React from "react";
import { interpolate } from "remotion";
import { clampedInterpolate } from "../animation/clawd/motion-style";
import { sampleStageKeyboard } from "../timeline/verse1";
import {
  HEY_END_SEC,
  HEY_LIFT_PEAK_SEC,
  HEY_RELEASE_START_SEC,
  HEY_START_SEC,
  HEY_VOCAL_SEC,
  sampleHeyWave,
} from "../timeline/hey-wave";
import type { ClawdActorState } from "./types";

/**
 * 编排 L066 前奏 (00:00.000 → 00:18.463) Clawd 亲自弹奏紧凑小合成器键盘的表演：
 * - 0.02s–0.24s：小合成器从左侧滑入 Clawd 身前，双爪移向琴键就位；
 * - 0.254s–18.14s：左爪弹奏低音区 (A3 下切与 B♭3 基准音)，右爪弹奏高八度 (B♭4)，视线随左右手弹奏自然追随；
 * - 18.10s–18.42s：在 L001 "Hey" 开口前收手并将小键盘向右侧轻巧滑出退场，18.43s 交给 Hey 预备下沉与高举挥爪。
 */
export function resolvePlayKeyboardActor(
  sec: number,
  baseActor: ClawdActorState,
): ClawdActorState {
  if (sec >= HEY_START_SEC) {
    return baseActor;
  }

  const rawKeyboard = sampleStageKeyboard(sec);
  if (!rawKeyboard.visible) {
    return baseActor;
  }

  // 在 18.10s -> 18.42s 提前完成小合成器向右侧滑出与收手，确保 18.43s Hey 预备动作开始时双爪完全解放
  const earlyExitSlide =
    sec > 18.1
      ? clampedInterpolate(sec, [18.1, 18.42], [1, 0])
      : rawKeyboard.traySlide;
  const earlyExitUnfold =
    sec > 18.06
      ? clampedInterpolate(sec, [18.06, 18.2], [1, 0])
      : rawKeyboard.trayUnfold;

  const keyboardState = {
    ...rawKeyboard,
    visible: earlyExitSlide > 0.005,
    traySlide: earlyExitSlide,
    trayUnfold: earlyExitUnfold,
  };

  if (!keyboardState.visible) {
    return baseActor;
  }

  const z0 = keyboardState.zones[0].press; // A3 半音下切
  const z1 = keyboardState.zones[1].press; // B♭3 基准低音
  const z2 = keyboardState.zones[2].press; // B♭4 高八度

  const unfold = keyboardState.trayUnfold;
  let lookX = 0;
  let lookY = 0.16 * unfold;

  if (z0 > 0.12) {
    lookX = -0.38 * unfold;
    lookY = 0.28 * unfold;
  } else if (z2 > z1 && z2 > 0.15) {
    lookX = 0.28 * unfold;
    lookY = 0.22 * unfold;
  } else if (z1 > 0.15) {
    lookX = -0.22 * unfold;
    lookY = 0.22 * unfold;
  }

  // 在 9.51s Bass 切入点附近给一次明显的自信律动点按与弯眼呼应
  const isBassEntryWindow = sec >= 9.48 && sec <= 10.15;
  const eyes = isBassEntryWindow ? "happy" : "normal";
  const beatPulse = z2 * 0.12 * unfold;

  return {
    ...baseActor,
    prop: "keyboard",
    keyboardState,
    eyes,
    beatPulse,
    lookOffset: { x: lookX, y: lookY },
  };
}

export interface HeyBubblePerformanceProps {
  sec: number;
  /** 可选水平舞台偏移（当前奏 Clawd 位于左侧 x=-320 时同步偏移气泡） */
  offsetX?: number;
}

/**
 * L001 ("Hey, let's go, I can take it") 开头配合 Clawd 奋力抬高右侧身体、
 * 高举右爪挥动三次时同步弹出的 "hey" 对话气泡：随人声弹出，与挥爪共用同一半拍相位，爪尖到顶时气泡同步上扬。
 */
export const HeyBubblePerformance: React.FC<HeyBubblePerformanceProps> = ({
  sec,
  offsetX = -320,
}) => {
  if (sec < HEY_VOCAL_SEC - 0.02 || sec > HEY_END_SEC + 0.05) return null;

  const enterP = clampedInterpolate(sec, [HEY_VOCAL_SEC, HEY_LIFT_PEAK_SEC + 0.04], [0, 1]);
  const exitP = clampedInterpolate(sec, [HEY_RELEASE_START_SEC, HEY_END_SEC], [0, 1]);
  const activeEnv = enterP * (1 - exitP);

  // 与 Clawd 挥爪共用相位：waveY = -1 时爪尖最高，气泡同步上扬
  const waveBob = sampleHeyWave(sec).waveY * 4.5 * activeEnv;

  const scale =
    interpolate(enterP, [0, 0.7, 1], [0.25, 1.14, 1.0]) *
    interpolate(exitP, [0, 1], [1.0, 0.65]);
  const opacity =
    interpolate(enterP, [0, 0.35, 1], [0, 1, 1]) * (1 - exitP);

  return (
    <div
      style={{
        position: "absolute",
        left: `calc(50% + ${172 + offsetX}px)`,
        bottom: 374 - waveBob,
        transform: `translate(-50%, 0) scale(${scale}) rotate(${-4 + waveBob * 0.45}deg)`,
        transformOrigin: "bottom left",
        opacity,
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      {/* 像素感对话气泡主体 */}
      <div
        style={{
          position: "relative",
          backgroundColor: "#F8FAFC",
          color: "#11131F",
          border: "3.5px solid #11131F",
          borderRadius: 12,
          padding: "8px 20px 10px 20px",
          boxShadow: "5px 5px 0px #D87757",
          fontFamily:
            '"JetBrains Mono", "Fira Code", "Inter", monospace, sans-serif',
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: "0.03em",
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        hey
        {/* 指向左下 Clawd 头部/举起右爪侧的气泡尾巴 */}
        <svg
          width={22}
          height={18}
          viewBox="0 0 22 18"
          style={{
            position: "absolute",
            left: 14,
            bottom: -16,
            overflow: "visible",
          }}
        >
          <polygon
            points="4,0 18,0 2,15"
            fill="#F8FAFC"
            stroke="#11131F"
            strokeWidth={3.5}
            strokeLinejoin="round"
          />
          {/* 遮住气泡底边与尾巴交界处的描边 */}
          <line
            x1={5}
            y1={-1}
            x2={17}
            y2={-1}
            stroke="#F8FAFC"
            strokeWidth={4.5}
          />
        </svg>
      </div>
    </div>
  );
};
