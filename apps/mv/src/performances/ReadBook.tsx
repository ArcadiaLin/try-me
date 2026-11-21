import React from "react";
import { smoothStep } from "../animation/clawd/motion-style";
import { PretrainField } from "../components/environment";
import { sampleVerse1PlanProgress } from "../timeline/verse1";
import type { ClawdActorState, ClawdStagePlacement } from "./types";

/**
 * L009–L010 (45.360s–49.892s) 读书段落舞台站位：全程居中 (x = 0)，49.82s 起提前 2 帧预备向 L011 接小号位置微移
 */
export function resolveReadBookPlacement(sec: number): ClawdStagePlacement {
  const toL011 = smoothStep(sec, 49.82, 50.38);
  return {
    x: -44 * toL011,
    y: 0,
    scale: 1,
    opacity: 1,
    zIndex: 5,
  };
}

/**
 * L009–L010 (45.360s–49.892s) 身体＋3D立体书＋白反光眼镜＋视线的协调：
 * - 入场同时进行（45.36s ~ 45.76s，时长 0.40s = 12 帧，适中速度）：
 *   眼镜从左侧旋入 (0 -> 1)，书本同时从右下侧入场 (0 -> 1)，Clawd 双手同步从身体两侧滑向胸前捧住书本；
 * - 退场同时进行且均从另一侧离开（49.26s ~ 49.66s，时长 0.40s = 12 帧，对齐 RC_BEAT_0089）：
 *   眼镜向右侧飞出 (1 -> 2)，书本同时向左侧飞出 (1 -> 2)，Clawd 双手同步滑回身体两侧。
 */
export function resolveReadBookActor(
  sec: number,
  authoredFrame: number,
  base: ClawdActorState,
): ClawdActorState {
  const enterExitPhase =
    sec < 47.58
      ? smoothStep(sec, 45.36, 45.76)
      : 1 + smoothStep(sec, 49.26, 49.66);

  return {
    ...base,
    action: "read-look-up",
    actionProgress: sampleVerse1PlanProgress(authoredFrame, "read"),
    prop: "book",
    glassesProgress: enterExitPhase,
    bookProgress: enterExitPhase,
  };
}

export interface ReadBookPerformanceProps {
  sec: number;
}

export const ReadBookPerformance: React.FC<ReadBookPerformanceProps> = ({
  sec,
}) => {
  return <PretrainField sec={sec} />;
};
