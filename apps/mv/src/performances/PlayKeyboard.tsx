import { sampleStageKeyboard } from "../timeline/verse1";
import type { ClawdActorState } from "./types";

/**
 * 编排 L066 前奏 (00:00.000 → 00:18.477) Clawd 亲自弹奏紧凑小合成器键盘的表演：
 * - 0.02s–0.24s：小合成器从左侧滑入 Clawd 身前，双爪移向琴键就位；
 * - 0.254s–18.465s：左爪弹奏低音区 (A3 下切与 B♭3 基准音)，右爪弹奏高八度 (B♭4)，视线随左右手弹奏自然追随；
 * - 18.465s–18.88s：末音收束后双爪收回，小键盘向右侧轻巧退场，无缝衔接 L001 挥手入场。
 */
export function resolvePlayKeyboardActor(
  sec: number,
  baseActor: ClawdActorState,
): ClawdActorState {
  const keyboardState = sampleStageKeyboard(sec);
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
    lookX = -0.32 * unfold;
    lookY = 0.28 * unfold;
  } else if (z2 > z1 && z2 > 0.15) {
    lookX = 0.22 * unfold;
    lookY = 0.22 * unfold;
  } else if (z1 > 0.15) {
    lookX = -0.16 * unfold;
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
