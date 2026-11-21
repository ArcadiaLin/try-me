import React from "react";
import { Easing, interpolate } from "remotion";
import { resolveClawdPose } from "../animation/clawd/blend";
import {
  applyHopToPose,
  laggedFollow,
  sampleHopTravel,
  type HopSpec,
} from "../animation/clawd/hop-travel";
import { linearProg } from "../animation/clawd/motion-style";
import type { ClawdPose } from "../components/clawd/types";
import {
  L003_TOOLS_BURST_SEC,
  L004_SHOWCASE_BEAT_SEC,
  L004_TOOLS_FOLD_SEC,
  PromptAndSwissKnife,
  sampleL002PromptLook,
  sampleL003SwissSnapKick,
  sampleSnapFold,
  sampleSnapOpen,
} from "../components/environment";
import {
  HEY_END_SEC,
  heySecToProgress,
  sampleHeyWave,
} from "../timeline/hey-wave";
import {
  sampleVerse1PlanProgress,
  type ClawdRhythmMotion,
} from "../timeline/verse1";
import type {
  ClawdActorState,
  ClawdStagePlacement,
  Verse1StageLightingState,
  Verse1StageTrapdoorState,
} from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 前奏站位（px，相对中线） */
export const VERSE1_PRELUDE_SIDE_X = -320;
/** bass 进入（时间轴 L068 起点，用户标注） */
export const VERSE1_BASS_IN_SEC = 9.512;
/** 键盘最后一音收束，谱面开始收回 */
export const VERSE1_HIGHWAY_CLOSE_SEC = 18.47;
/** 人声 Hey（L001 起点）：聚光灯打到 Clawd 身上 */
const SPOT_ON_SEC = 18.463;

/** let's go：三小跳，落在候选半拍点 20.165 / 20.446 / 20.726s */
const ENTRY_HOPS: HopSpec[] = [
  { takeoffSec: 19.98, landSec: 20.165, toX: -213 },
  { takeoffSec: 20.26, landSec: 20.446, toX: -106 },
  { takeoffSec: 20.54, landSec: 20.726, toX: 0 },
];

/** L064 退场：左侧台面小洞 */
const HOLE_X = -270;
const HOLE_OPEN: [number, number] = [34.55, 34.8];
const HOLE_CLOSE: [number, number] = [35.95, 36.2];
/** 先一小跳靠近洞口（落在候选半拍点 35.017s） */
const EXIT_HOPS: HopSpec[] = [
  { takeoffSec: 34.84, landSec: 35.017, toX: -125 },
];
const DIVE_FROM_X = -125;
/** 起跳前下压 */
const DIVE_LOAD = 35.06;
const DIVE_TAKEOFF = 35.15;
/** 身体越过台面、进入洞口的时刻（候选半拍点 35.578s） */
export const VERSE1_DIVE_ENTER_SEC = 35.578;
const DIVE_HEIGHT = 70;
/** 告别挥手周期：约 1/4 拍（候选拍长 0.561s） */
const WAVE_PERIOD = 0.14;
/** 完全没入后不再显示 */
const DIVE_GONE = DIVE_TAKEOFF + 1.5 * (VERSE1_DIVE_ENTER_SEC - DIVE_TAKEOFF);
/** 掉进去后光束张开，回到全场光 */
const SPOT_RELEASE_START = 35.62;
const SPOT_RELEASE_END = 36.42;
/** 从此刻起交接给 ExitTerminal 的终端内亮相 */
export const VERSE1_EXIT_TERMINAL_SEC = 37.54;

const ALL_HOPS = [...ENTRY_HOPS, ...EXIT_HOPS];

function sampleDive(s: number) {
  const u = (s - DIVE_TAKEOFF) / (VERSE1_DIVE_ENTER_SEC - DIVE_TAKEOFF);
  const xT = Math.max(0, Math.min(1, (s - DIVE_TAKEOFF) / 0.27));
  const ease = xT < 0.5 ? 2 * xT * xT : 1 - (-2 * xT + 2) ** 2 / 2;
  return {
    u,
    x: DIVE_FROM_X + (HOLE_X - DIVE_FROM_X) * ease,
    // 抛物线：u = 1 时脚底回到台面高度，之后继续往下掉进洞里
    y: -DIVE_HEIGHT * 4 * u * (1 - u),
    scale: 1 - 0.2 * Math.max(0, Math.min(1, u / 0.6)),
  };
}

function clawdXAt(s: number) {
  if (s < DIVE_TAKEOFF)
    return sampleHopTravel(s, VERSE1_PRELUDE_SIDE_X, ALL_HOPS).x;
  return sampleDive(s).x;
}

/**
 * L001–L064 (18.430s–37.540s) 聚光灯段落的身体基础动作：
 * - L001 (18.430–22.721s): Hey 高举右爪挥动 + let's go 碎步跳进中央
 * - L002 (22.721–27.161s): 降频休息，身体随节拍轻柔呼吸，眼神依次追随 4 个浮现的 Prompt 气泡（含鹈鹕骑自行车）
 * - L003 (27.161–31.695s): 瑞士军刀式“孔雀开屏”6 件工具从背后按拍“咔哒！”干脆弹锁到位，身体带机械顿点反馈
 * - L004 (31.695–34.026s): 自己アピール全屏高光亮相 (^ ^ 笑眼 + 双臂微张)，句尾干脆合刀收回
 * - L064 (34.026–37.540s): 前半段原地微蹲，随后跳向左侧台面小洞并挥手告别
 */
export function resolveIntroSpotlightActor(
  sec: number,
  authoredFrame: number,
  base: ClawdActorState,
): ClawdActorState {
  if (sec < 22.721) {
    const waveProgress =
      sec < HEY_END_SEC
        ? heySecToProgress(sec)
        : sampleVerse1PlanProgress(authoredFrame, "wave");
    const isHeyStraining = sec < HEY_END_SEC && sampleHeyWave(sec).lift > 0.15;
    return {
      ...base,
      action: "wave-step",
      actionProgress: waveProgress,
      eyes: isHeyStraining ? "wince" : "normal",
    };
  }
  if (sec < 27.161) {
    // L002 前半段 (22.721s–25.18s): 动作降频休息，眼神依次追随 4 个浮现的 Prompt 气泡
    if (sec < 25.18) {
      return {
        ...base,
        action: "idle",
        actionProgress: linearProg(sec, 22.721, 25.18),
      };
    }
    // L002 后半段 (25.18s–27.161s): 最后一个气泡出现后，使用 A3 (tilt-invite) 侧身歪头伸爪 + 右上方冒出无框问号「？」
    return {
      ...base,
      action: "tilt-invite",
      actionProgress: linearProg(sec, 25.18, 27.12),
    };
  }
  if (sec < L004_SHOWCASE_BEAT_SEC) {
    // 27.161s–32.61s: 盯字「と・く・い → 得意な」→ 30.92s 箭头拍（不展开）→ 32.05s 展开拍（淡定普通眼唰地开武装）
    return {
      ...base,
      action: "idle",
      actionProgress: linearProg(sec, 27.161, L004_SHOWCASE_BEAT_SEC),
    };
  }
  if (sec < 34.026) {
    // 32.61s–34.026s: 亮招高潮拍切 ^ ^ 得意笑眼 + self-present 自信展示，33.62s 干脆合刀收回
    const isAppealSmile = sec <= 33.65;
    return {
      ...base,
      action: "self-present",
      actionProgress: sampleVerse1PlanProgress(authoredFrame, "present"),
      eyes: isAppealSmile ? "happy" : "normal",
    };
  }
  // L064 前半段原地微蹲，35.06s 起由跳洞挥手姿态接管
  if (sec < 36.371) {
    return {
      ...base,
      action: "crouch-lean",
      actionProgress:
        sec < 35.34
          ? sampleVerse1PlanProgress(authoredFrame, "crouch")
          : linearProg(sec, 34.026, 35.82) * 0.65,
    };
  }
  return base;
}

/**
 * 合成 0.000s–37.540s（前奏侧边弹琴 + 追光三小跳进中央 + L064 挥手跳进左侧台面洞口）
 * 的舞台位置与完整姿态
 */
export function resolvePreludeAndSpotlightStage(
  sec: number,
  rhythm: ClawdRhythmMotion | undefined,
  actor: ClawdActorState,
): { placement: ClawdStagePlacement; actor: ClawdActorState } {
  const hop = sampleHopTravel(sec, VERSE1_PRELUDE_SIDE_X, ALL_HOPS);
  const diving = sec >= DIVE_LOAD;
  const inAir = sec >= DIVE_TAKEOFF;
  const dive = sampleDive(sec);

  const placement: ClawdStagePlacement = inAir
    ? {
        x: dive.x,
        y: dive.y,
        scale: dive.scale,
        opacity: sec >= DIVE_GONE ? 0 : 1,
        zIndex: 5,
        clipPath: "inset(0px 0px 186px 0px)",
      }
    : {
        x: hop.x,
        y: 0,
        scale: 1,
        opacity: 1,
        zIndex: 5,
      };

  let pose: ClawdPose;
  if (diving) {
    const idle = resolveClawdPose({ action: "idle", timeSec: sec });
    const load = interpolate(
      sec,
      [DIVE_LOAD, DIVE_TAKEOFF - 0.02, DIVE_TAKEOFF],
      [0, 1, 0],
      clamp,
    );
    const air = inAir
      ? interpolate(sec, [DIVE_TAKEOFF, DIVE_TAKEOFF + 0.08], [0, 1], clamp)
      : 0;
    const dy = 0.4 * load;
    // 告别挥手：右前爪举到右上方快速挥动，每次约 1/4 拍，一直挥到没入洞口
    const waveEnv = interpolate(
      sec,
      [DIVE_LOAD, DIVE_LOAD + 0.1],
      [0, 1],
      clamp,
    );
    const waveCycles = Math.max(0, (sec - DIVE_LOAD) / WAVE_PERIOD);
    const waveY = -Math.cos(waveCycles * Math.PI * 2);
    const waveX = Math.sin(waveCycles * Math.PI * 2);
    pose = {
      ...idle,
      bodyOffsetX: idle.bodyOffsetX - 0.3 * load,
      bodyOffsetY: idle.bodyOffsetY + dy,
      scaleX: idle.scaleX * (1 + 0.06 * load) * (1 - 0.07 * air),
      scaleY: idle.scaleY * (1 - 0.06 * load) * (1 + 0.08 * air),
      torsoTiltDeg: -6 * air + 1.5 * waveX * waveEnv,
      isAirborneAction: air > 0,
      legLifts: [0.5 * air, 0.5 * air, 0.4 * air, 0.4 * air],
      // 左前爪伸向洞口带路
      leftArmExtend: 0.45 * air,
      leftArmOffsetY: idle.leftArmOffsetY + dy - 0.5 * air,
      rightArmExtend: (0.72 + 0.34 * waveX) * waveEnv,
      rightArmOffsetY:
        idle.rightArmOffsetY + dy + (-2.3 + 0.62 * waveY) * waveEnv,
      // 回头看观众告别，掉下去时再看一眼洞口
      actionLook: {
        x: interpolate(
          sec,
          [
            DIVE_LOAD,
            DIVE_TAKEOFF,
            VERSE1_DIVE_ENTER_SEC - 0.05,
            VERSE1_DIVE_ENTER_SEC + 0.1,
          ],
          [-0.4, 0.2, 0.2, -0.2],
          clamp,
        ),
        y: interpolate(
          sec,
          [VERSE1_DIVE_ENTER_SEC - 0.05, VERSE1_DIVE_ENTER_SEC + 0.1],
          [-0.05, 0.3],
          clamp,
        ),
      },
    };
  } else {
    const base = resolveClawdPose({
      action: actor.action,
      actionProgress: actor.actionProgress,
      prop: actor.prop,
      bookProgress: actor.bookProgress,
      keyboardState: actor.keyboardState,
      beatPulse: actor.beatPulse,
      rhythm,
      timeSec: sec,
    });
    const hopped = applyHopToPose(base, hop);
    // 前奏略看向谱面；灯亮时抬头看光；跳之前看向中央；L064 看向左侧洞口
    const lookX = interpolate(
      sec,
      [0.3, 1.0, 18.3, 18.6, 19.5, 19.8, 20.8, 21.2, 34.45, 34.6],
      [0, 0.25, 0.25, 0, 0, 0.45, 0.45, 0, 0, -0.45],
      clamp,
    );
    const lookUp = interpolate(
      sec,
      [18.5, 18.7, 19.3, 19.6],
      [0, -0.35, -0.35, 0],
      clamp,
    );
    // L002 (22.721s–27.161s) 眼神跟随 4 个逐拍浮现的 Prompt 气泡
    const promptLook = sampleL002PromptLook(sec);
    // L003–L004 (27.161s–34.026s) 瑞士军刀干脆弹锁时的机械顿点反馈
    const swissKick = sampleL003SwissSnapKick(sec);
    // 27.16s–31.95s 盯字、等箭头与瞬间展开时保持克制静谧；
    // 32.05s 亮招拍切 ^ ^ 笑眼时释放回完整律动，让 L004 后半段活泼展示不发呆
    const quiet = interpolate(
      sec,
      [27.161, 27.36, L004_SHOWCASE_BEAT_SEC - 0.12, L004_SHOWCASE_BEAT_SEC + 0.04],
      [1, 0.2, 0.2, 1],
      clamp,
    );

    pose = {
      ...hopped,
      bodyOffsetX: hopped.bodyOffsetX * quiet,
      bodyOffsetY: hopped.bodyOffsetY * quiet + swissKick.kickY,
      torsoTiltDeg:
        hopped.torsoTiltDeg * quiet +
        promptLook.tiltDeg * quiet +
        swissKick.tilt,
      scaleX: (1 + (hopped.scaleX - 1) * quiet) * (1 + swissKick.scaleKick),
      scaleY: (1 + (hopped.scaleY - 1) * quiet) / (1 + swissKick.scaleKick),
      leftArmExtend: hopped.leftArmExtend + swissKick.arm,
      rightArmExtend: hopped.rightArmExtend + swissKick.arm,
      leftArmOffsetY: hopped.leftArmOffsetY * quiet + swissKick.kickY,
      rightArmOffsetY: hopped.rightArmOffsetY * quiet + swissKick.kickY,
      actionLook: {
        x: hopped.actionLook.x + lookX + promptLook.lookX,
        y: hopped.actionLook.y + lookUp + promptLook.lookY,
      },
    };
  }

  return {
    placement,
    actor: {
      ...actor,
      pose,
      eyes: diving ? "happy" : hop.phase === "air" ? "wince" : actor.eyes,
    },
  };
}

/**
 * 聚光灯状态：前奏轻微压暗；Hey 打到左侧 Clawd；跟随跳进中央；L064 掉进洞后两侧张开回归初版舞台光
 */
export function resolveVerse1Spotlight(
  sec: number,
  options: { preludeAmbient?: number; spotAmbient?: number } = {},
): Verse1StageLightingState {
  const preludeAmbient = options.preludeAmbient ?? 0.12;
  const spotAmbient = options.spotAmbient ?? 0.5;

  const spotX =
    sec < SPOT_RELEASE_END ? laggedFollow(clawdXAt, sec, 0.12) : HOLE_X;
  const spotIris = interpolate(sec, [SPOT_ON_SEC, SPOT_ON_SEC + 0.18], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const release = interpolate(
    sec,
    [SPOT_RELEASE_START, SPOT_RELEASE_END],
    [0, 1],
    {
      ...clamp,
      easing: Easing.inOut(Easing.cubic),
    },
  );
  const ambient =
    sec < SPOT_ON_SEC
      ? preludeAmbient
      : interpolate(
          sec,
          [SPOT_ON_SEC, SPOT_ON_SEC + 0.18],
          [preludeAmbient, spotAmbient],
          clamp,
        ) *
        (1 - release);

  // L003–L004 (31.49s–33.75s) 瞬间展开全套细金属工具时光圈撑宽；32.05s 亮招拍再轻扩一格
  const fanSpotExpand =
    sampleSnapOpen(sec, L003_TOOLS_BURST_SEC) *
    sampleSnapFold(sec, L004_TOOLS_FOLD_SEC) *
    (1 - release);
  const showcaseSpotBoost =
    sampleSnapOpen(sec, L004_SHOWCASE_BEAT_SEC) *
    sampleSnapFold(sec, L004_TOOLS_FOLD_SEC) *
    (1 - release);

  return {
    x: spotX,
    iris: spotIris * (1 - Math.max(0, (sec - SPOT_RELEASE_END) / 0.1)),
    ambient,
    rx: 150 + 135 * fanSpotExpand + 26 * showcaseSpotBoost + 1150 * release,
    ry: 30 + 10 * fanSpotExpand + 3 * showcaseSpotBoost + 15 * release,
    lampHalfWidth: 14 + 26 * fanSpotExpand + 6 * showcaseSpotBoost + 900 * release,
    glow: (1 - release) ** 2,
  };
}

export interface IntroSpotlightPerformanceProps {
  sec: number;
  clawdX?: number;
  layer: "behind" | "front";
}

/**
 * L002–L004 (22.721s–34.150s) 聚光灯下的舞台交互层：
 * - layer="front": L002 浮现的 4 个 Prompt 提问气泡（含「画一个鹈鹕自行车」SVG 梗）
 * - layer="behind": L003–L004 从 Clawd 背后“咔哒”干脆旋出的瑞士军刀式孔雀开屏工具扇面
 */
export const IntroSpotlightPerformance: React.FC<
  IntroSpotlightPerformanceProps
> = ({ sec, clawdX = 0, layer }) => {
  return <PromptAndSwissKnife sec={sec} clawdX={clawdX} layer={layer} />;
};

/**
 * 左侧台面小洞状态（L064 滑开迎接 Clawd 跳入，落入后闭合）
 */
export function resolveVerse1Trapdoor(sec: number): Verse1StageTrapdoorState {
  const holeOpen =
    interpolate(sec, HOLE_OPEN, [0, 1], {
      ...clamp,
      easing: Easing.out(Easing.cubic),
    }) *
    interpolate(sec, HOLE_CLOSE, [1, 0], {
      ...clamp,
      easing: Easing.in(Easing.cubic),
    });

  return {
    x: HOLE_X,
    open: holeOpen,
    sinceEnter: sec - VERSE1_DIVE_ENTER_SEC,
  };
}
