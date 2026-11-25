import React from "react";
import { clamp01 } from "../animation/clawd/motion-style";
import {
  SuperstarSignAndConfetti,
  ThinkingBubbles,
} from "../components/environment";
import type { ClawdActorState, ClawdStagePlacement } from "./types";

/**
 * L065 收尾至 L014 / L069 间奏的草稿关键时间点（秒）：
 * - 人声边界严格对应 annotations/try-me.timeline.json（L013: 55.168–58.317s, L014: 58.317–62.212s, L069: 62.212–62.689s）；
 * - L014 `superstar` 词级命中点暂以候选拍点 beat 108 (60.536s，军鼓+鼓掌强拍) 为草稿占位，
 *   待用户在 Studio 带音轨试听后按实际听辨微调。
 */
export const THINK_RELAX_START_SEC = 54.45;
export const THINK_EYES_CLOSE_SEC = 54.72;
export const L013_THINK_START_SEC = 55.168;
/** 思绪逼近、Clawd 从安详深呼吸转为苦恼 > < 颤抖的切点 */
export const THINK_STRUGGLE_START_SEC = 57.55;
export const L014_START_SEC = 58.317;
/** 用户听辨确认的 Dab 精确卡点：1:01:01 (@ 60fps = 61 + 1/60s = 第 3661 帧) */
export const SUPERSTAR_DAB_HIT_SEC = 61 + 1 / 60;
/** 所有 spinner verbs 在 Dab 精确卡点瞬间同时消失并爆散卡通烟雾 */
export const BUBBLES_FREEZE_SEC = SUPERSTAR_DAB_HIT_SEC;
export const BUBBLES_DEFLATE_START_SEC = SUPERSTAR_DAB_HIT_SEC;
export const BUBBLES_DEFLATE_END_SEC = SUPERSTAR_DAB_HIT_SEC + 0.3;
export const SUPERSTAR_DAB_PREP_START_SEC = SUPERSTAR_DAB_HIT_SEC - 0.13;
export const SUPERSTAR_DAB_END_SEC = 62.56;

/**
 * L013–L014 舞台站位：Clawd 保持中央稳固站立 (x = 0)
 */
export function resolveThinkSuperstarPlacement(): ClawdStagePlacement {
  return {
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
    zIndex: 5,
  };
}

/**
 * L065 收尾间奏（54.45s 起）→ L013 闭眼深呼吸思考 → L014 Superstar 卡点 Dab 的角色表演
 */
export function resolveThinkSuperstarActor(
  sec: number,
  base: ClawdActorState,
): ClawdActorState {
  // 1. 54.45s – 60.376s：从 L065 展示放松下来，闭眼深呼吸 + 叠加主节奏小幅律动
  if (sec < SUPERSTAR_DAB_PREP_START_SEC) {
    const relaxProg = clamp01(
      (sec - THINK_RELAX_START_SEC) /
        (SUPERSTAR_DAB_PREP_START_SEC - THINK_RELAX_START_SEC),
    );
    // 54.45s–55.10s 仍保留 L065 小号最后的轻巧退场收尾，避免道具突变消失
    const keepTrumpetTail = sec < 55.1;
    const holdTail = keepTrumpetTail
      ? 1 + Math.max(0, Math.min(1, (sec - 52.576) / (55.1 - 52.576)))
      : 0;

    const eyes =
      sec >= THINK_STRUGGLE_START_SEC
        ? "wince"
        : sec >= THINK_EYES_CLOSE_SEC
          ? "closed"
          : "happy";

    return {
      ...base,
      action: "deep-breathe",
      actionProgress: relaxProg,
      eyes,
      prop: keepTrumpetTail ? "trumpet" : "none",
      trumpetProgress: holdTail,
    };
  }

  // 2. 60.887s – 62.56s：短促蓄力 → 1:01:01 严格卡点弹跳切入 Dab → 短暂定姿得意展示 → 干脆收势
  if (sec < SUPERSTAR_DAB_END_SEC) {
    const dabSpan = SUPERSTAR_DAB_END_SEC - SUPERSTAR_DAB_PREP_START_SEC;
    const dabP = clamp01((sec - SUPERSTAR_DAB_PREP_START_SEC) / dabSpan);
    // 蓄力瞬间仍保持苦恼 > <，1:01:01 Dab 命中切为闭眼（低头埋入弯臂内侧更酷），收势尾声回到 normal
    const eyes =
      sec < SUPERSTAR_DAB_HIT_SEC
        ? "wince"
        : dabP < 0.86
          ? "closed"
          : "normal";

    return {
      ...base,
      action: "superstar-dab",
      actionProgress: dabP,
      eyes,
      prop: "none",
    };
  }

  // 3. 62.22s – 62.689s (L069 间奏)：回到干净的基础待机站姿，迎接 L015 副歌
  return {
    ...base,
    action: "idle",
    actionProgress: 0,
    eyes: "normal",
    prop: "none",
  };
}

export interface ThinkSuperstarPerformanceProps {
  sec: number;
}

export const ThinkSuperstarPerformance: React.FC<
  ThinkSuperstarPerformanceProps
> = ({ sec }) => {
  return (
    <>
      <ThinkingBubbles
        sec={sec}
        freezeSec={BUBBLES_FREEZE_SEC}
        deflateStartSec={BUBBLES_DEFLATE_START_SEC}
        deflateEndSec={BUBBLES_DEFLATE_END_SEC}
        dabHitSec={SUPERSTAR_DAB_HIT_SEC}
      />
      <SuperstarSignAndConfetti
        sec={sec}
        triggerSec={SUPERSTAR_DAB_HIT_SEC}
        exitStartSec={62.24}
        exitEndSec={SUPERSTAR_DAB_END_SEC}
      />
    </>
  );
};
