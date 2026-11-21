import React from "react";
import { interpolate } from "remotion";
import { getStumbleLeftKinematics } from "../animation/clawd/actions";
import {
  clampedInterpolate,
  linearProg,
  smoothStep,
} from "../animation/clawd/motion-style";
import { GithubHeatmapCard, TerminalSummon } from "../components/environment";
import type { ClawdActorState, ClawdStagePlacement } from "./types";

/**
 * L005–L006 (37.540s–40.800s) 终端召唤段落的连续舞台位置编排：
 * 终端左侧亮相 -> 跃出终端至左侧 -> 三次递减踮脚跳站稳 -> 向 L007 站位平滑预备
 */
export function resolveExitTerminalPlacement(sec: number): ClawdStagePlacement {
  if (sec < 37.837) {
    const popInTerm = smoothStep(sec, 37.54, 37.66);
    return {
      x: 42,
      y: -263,
      scale: interpolate(popInTerm, [0, 0.75, 1], [0.1, 0.3, 0.28]),
      opacity: interpolate(popInTerm, [0, 0.35, 1], [0, 1, 1]),
      zIndex: 6,
    };
  }
  if (sec < 38.139) {
    const jumpT = linearProg(sec, 37.837, 38.139);
    const startY = -263;
    const linearY = startY * (1 - jumpT);
    const arcLift = -115 * 4 * jumpT * (1 - jumpT);
    return {
      x: interpolate(jumpT, [0, 1], [42, -105]),
      y: linearY + arcLift,
      scale: interpolate(jumpT, [0, 0.65, 1], [0.28, 0.86, 1.0]),
      opacity: 1,
      zIndex: 6,
    };
  }
  // 38.139s ~ 40.800s
  let baseX = -195;
  let stageY = 0;
  if (sec < 39.2) {
    const stumbleP = linearProg(sec, 38.139, 39.2);
    const { hopArc, hopHeightRatio, currentXRatio } =
      getStumbleLeftKinematics(stumbleP);
    baseX = -105 + (-195 - -105) * currentXRatio;
    stageY = -34 * hopArc * hopHeightRatio;
  }
  const toL007 = smoothStep(sec, 40.35, 41.05);
  return {
    x: baseX - 20 * toL007,
    y: stageY,
    scale: 1,
    opacity: 1,
    zIndex: 5,
  };
}

/**
 * L005–L006 (37.540s–40.800s) 角色身体、表情与视线协调
 */
export function resolveExitTerminalActor(
  sec: number,
  _authoredFrame: number,
  base: ClawdActorState,
): ClawdActorState {
  if (sec < 37.837) {
    return {
      ...base,
      action: "idle",
      actionProgress: linearProg(sec, 37.54, 37.837),
      eyes: "normal",
    };
  }
  if (sec < 38.139) {
    return {
      ...base,
      action: "bounce",
      actionProgress: linearProg(sec, 37.837, 38.139),
      lookOffset: { x: -0.35, y: 0.15 },
    };
  }
  if (sec < 39.2) {
    return {
      ...base,
      action: "stumble-left",
      actionProgress: linearProg(sec, 38.139, 39.2),
      eyes: sec < 39.1 ? "wince" : "normal",
    };
  }
  // L006 (365日): 站稳看向右侧热力图 + 双拍弹性点头
  const nodWindow = sec >= 39.74 && sec <= 40.42;
  return {
    ...base,
    action: nodWindow ? "snappy-nod" : "idle",
    actionProgress: nodWindow
      ? linearProg(sec, 39.74, 40.42)
      : linearProg(sec, 39.2, 40.8),
    eyes: sec >= 39.76 && sec <= 40.4 ? "happy" : "normal",
    lookOffset: {
      x: clampedInterpolate(
        sec,
        [39.2, 39.32, 40.35, 40.8],
        [0.48, 0.52, 0.52, 0.42],
      ),
      y: clampedInterpolate(sec, [39.2, 40.35, 40.8], [-0.05, -0.05, -0.18]),
    },
  };
}

export interface ExitTerminalPerformanceProps {
  sec: number;
}

export const ExitTerminalPerformance: React.FC<
  ExitTerminalPerformanceProps
> = ({ sec }) => {
  return (
    <>
      <TerminalSummon sec={sec} />
      <GithubHeatmapCard sec={sec} />
    </>
  );
};
