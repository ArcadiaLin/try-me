import { interpolate } from "remotion";
import {
  HEY_PROGRESS_SPAN,
  heyProgressToSec,
  sampleHeyWave,
} from "../../../timeline/hey-wave.ts";
import { clampedInterpolate } from "../motion-style.ts";
import type { ClawdPoseDelta } from "../poses.ts";

export type Verse1IntroActionName =
  | "weight-shift"
  | "wave-step"
  | "tilt-invite"
  | "posture-nod"
  | "self-present"
  | "crouch-lean"
  | "peek-present";

export function sampleVerse1IntroAction(
  action: Verse1IntroActionName,
  p: number,
  breathY: number,
): ClawdPoseDelta {
  if (action === "weight-shift") {
    // A1 (L066 前奏 / L007): 左右重心转移（足底贴地不动，首尾 p=0/1 平滑归零）
    const sway = Math.sin(p * Math.PI * 2);
    const cycleEnv = Math.sin(p * Math.PI);
    return {
      bodyOffsetX: sway * 0.48,
      bodyOffsetY: breathY + cycleEnv * (1 - Math.abs(sway)) * 0.22,
      torsoTiltDeg: sway * 1.8,
      actionLookX: sway * 0.22,
      leftArmDeltaY: -sway * 0.18,
      rightArmDeltaY: sway * 0.18,
    };
  }

  if (action === "wave-step") {
    // A2 (L001): "Hey!" 1 帧预备下沉 -> 奋力抬高右侧身体、右侧足部拉伸、右前爪高举挥动三次（每次半拍，爪尖最高点落在半拍网格）(0~0.36)
    // -> 重心向前送走到面试位 (0.36~0.64) -> 自信小幅蹲起 (0.64~1.0)
    if (p < HEY_PROGRESS_SPAN) {
      const hey = sampleHeyWave(heyProgressToSec(p));
      const liftEnv = hey.lift;
      const waveOscY = hey.waveY;
      const waveOscX = hey.waveX;

      return {
        // 以左侧足部 (rotPivotX = 4.2) 为支点向左上昂起躯干，幅度适中偏低但保持右腿拉伸感
        rotPivotX: 4.2,
        torsoTiltDeg: -6.8 * liftEnv,
        bodyOffsetX: -0.26 * liftEnv + waveOscX * 0.08 * liftEnv,
        bodyOffsetY:
          breathY +
          0.16 * hey.windup -
          0.28 * liftEnv -
          Math.abs(waveOscX) * 0.1 * liftEnv,
        scaleX: 1 + 0.035 * hey.windup - 0.02 * liftEnv,
        scaleY: 1 - 0.035 * hey.windup + 0.035 * liftEnv,
        actionLookX: 0.24 * liftEnv,
        actionLookY: -0.16 * liftEnv,
        // 左爪向下微压借力
        leftArmExtend: -0.18 * liftEnv,
        leftArmDeltaY: 0.35 * liftEnv + 0.12 * hey.windup,
        // 右侧前爪举至躯干右上侧并挥动三次（waveOscY = -1 时爪尖最高）
        rightArmExtend: (0.72 + waveOscX * 0.34) * liftEnv,
        rightArmDeltaY: (-2.25 + waveOscY * 0.62) * liftEnv + 0.12 * hey.windup,
      };
    }
    if (p < 0.64) {
      const stepT = (p - 0.36) / 0.28;
      const stepArc = Math.sin(stepT * Math.PI);
      return {
        bodyOffsetY:
          breathY +
          interpolate(stepT, [0, 0.38, 0.76, 1], [0, 0.32, -0.14, 0]),
        scaleX: 1 + stepArc * 0.045,
        scaleY: 1 + stepArc * 0.045,
        leftArmDeltaY: -0.18 * stepArc,
        rightArmDeltaY: -0.18 * stepArc,
      };
    }
    const crouchT = (p - 0.64) / 0.36;
    const squat =
      Math.max(0, Math.sin(crouchT * Math.PI * 2)) *
      Math.sin(crouchT * Math.PI);
    return {
      bodyOffsetY: breathY + squat * 0.52,
      scaleX: 1 + squat * 0.05,
      scaleY: 1 - squat * 0.04,
    };
  }

  if (action === "tilt-invite") {
    // A3 (L002): 轻侧身、歪头，眼神朝一侧空白处等待回应，前足小邀请动作；停一下留喜感；留白期视线回正
    const inviteEnv = clampedInterpolate(
      p,
      [0, 0.2, 0.68, 0.92, 1],
      [0, 1, 1, 0, 0],
    );
    return {
      bodyOffsetX: -0.22 * inviteEnv,
      torsoTiltDeg: 4.6 * inviteEnv,
      bodyOffsetY: breathY - 0.08 * inviteEnv,
      rightArmExtend: 0.72 * inviteEnv,
      actionLookX: 0.48 * inviteEnv,
      actionLookY: -0.08 * inviteEnv,
      rightArmDeltaY: -0.48 * inviteEnv,
      leftArmDeltaY: 0.12 * inviteEnv,
    };
  }

  if (action === "posture-nod") {
    // A4 (L003): 先收拢姿态 (0~0.24) -> 抬头挺身换重心 (0.24~0.46) -> 两次差幅点头 (0.46~0.84) -> 视线回镜头
    if (p < 0.24) {
      const gather = Math.sin((p / 0.24) * Math.PI);
      return {
        bodyOffsetY: breathY + gather * 0.32,
        scaleX: 1 - gather * 0.04,
        leftArmExtend: -0.55 * gather,
        rightArmExtend: -0.55 * gather,
        actionLookY: 0.12 * gather,
        leftArmDeltaY: -0.35 * gather,
        rightArmDeltaY: -0.35 * gather,
      };
    }
    if (p < 0.46) {
      const tall = Math.sin(((p - 0.24) / 0.22) * Math.PI);
      return {
        bodyOffsetY: breathY - tall * 0.32,
        bodyOffsetX: -tall * 0.24,
        scaleY: 1 + tall * 0.04,
        actionLookY: -0.18 * tall,
        leftArmDeltaY: -0.22 * tall,
        rightArmDeltaY: -0.22 * tall,
      };
    }
    if (p < 0.62) {
      const nod1 = Math.sin(((p - 0.46) / 0.16) * Math.PI);
      return {
        bodyOffsetY: breathY + nod1 * 0.26,
        bodyOffsetX: 0.18 * nod1,
        actionLookY: nod1 * 0.2,
      };
    }
    if (p < 0.84) {
      const nod2 = Math.sin(((p - 0.62) / 0.22) * Math.PI);
      return {
        bodyOffsetY: breathY + nod2 * 0.62,
        bodyOffsetX: 0.24 * nod2,
        scaleX: 1 + nod2 * 0.05,
        scaleY: 1 - nod2 * 0.04,
        actionLookY: nod2 * 0.36,
      };
    }
    return {
      bodyOffsetY: breathY,
    };
  }

  if (action === "self-present") {
    // A5 (L004): 前足朝自己示意 (0~0.44) -> 向外展开展示 (0.44~0.82) -> 平滑回稳
    if (p < 0.44) {
      const inward = interpolate(p, [0, 0.14, 0.32, 0.44], [0, 1, 1, 0]);
      const tap = Math.sin((p / 0.44) * Math.PI * 2) * 0.1 * inward;
      return {
        leftArmExtend: -0.75 * inward,
        rightArmExtend: -0.75 * inward,
        selfPointOpacity: inward,
        bodyOffsetY: breathY + 0.14 * inward + tap,
        actionLookY: 0.14 * inward,
        leftArmDeltaY: -0.65 * inward,
        rightArmDeltaY: -0.65 * inward,
      };
    }
    const openEnv = clampedInterpolate(
      p,
      [0.44, 0.58, 0.82, 1],
      [0, 1, 0.85, 0],
    );
    return {
      leftArmExtend: 0.72 * openEnv,
      rightArmExtend: 0.72 * openEnv,
      bodyOffsetY: breathY - 0.26 * openEnv,
      scaleX: 1 + 0.03 * openEnv,
      scaleY: 1 + 0.035 * openEnv,
      actionLookY: -0.08 * openEnv,
      leftArmDeltaY: -0.45 * openEnv,
      rightArmDeltaY: -0.45 * openEnv,
    };
  }

  if (action === "crouch-lean") {
    // A6 (L064 间奏): 贴地下压—回正 (0~0.42) -> 轻待机 (0.42~0.72) -> 句尾向旁预倾铺垫 L005 (0.72~1.0)
    if (p < 0.42) {
      const squat = Math.sin((p / 0.42) * Math.PI);
      return {
        bodyOffsetY: breathY + squat * 0.82,
        scaleX: 1 + squat * 0.075,
        scaleY: 1 - squat * 0.065,
        leftArmDeltaY: -squat * 0.28,
        rightArmDeltaY: -squat * 0.28,
      };
    }
    if (p < 0.72) {
      return {
        bodyOffsetY: breathY,
      };
    }
    const leanT = interpolate(p, [0.72, 0.92, 1], [0, 1, 1]);
    return {
      bodyOffsetX: 0.56 * leanT,
      torsoTiltDeg: 3.8 * leanT,
      bodyOffsetY: breathY + 0.22 * leanT,
      actionLookX: 0.35 * leanT,
      rightArmDeltaY: -0.25 * leanT,
    };
  }

  // A7 (peek-present)
  const armOpen = clampedInterpolate(
    p,
    [0, 0.18, 0.34, 0.5, 1],
    [0, 0.65, 0.65, 0, 0],
  );
  return {
    stageOffsetX: clampedInterpolate(
      p,
      [0, 0.18, 0.34, 0.52, 0.74, 1],
      [0, 1.15, 1.15, 0.16, 0, 0],
    ),
    bodyOffsetX: clampedInterpolate(
      p,
      [0, 0.18, 0.34, 0.52, 0.74, 0.9, 1],
      [0.56, 0.35, 0.35, 0, 0, 0.24, 0.24],
    ),
    torsoTiltDeg: clampedInterpolate(
      p,
      [0, 0.18, 0.34, 0.52, 1],
      [3.8, 4.2, 4.2, 0, 0],
    ),
    bodyOffsetY:
      breathY +
      clampedInterpolate(
        p,
        [0, 0.18, 0.34, 0.52, 0.64, 0.74, 1],
        [0.22, -0.22, -0.22, 0, 0.14, 0, 0],
      ),
    leftArmExtend: armOpen,
    rightArmExtend: armOpen,
    actionLookX: clampedInterpolate(
      p,
      [0, 0.18, 0.34, 0.52, 0.74, 0.9, 1],
      [0.35, 0.12, 0.12, 0, 0, 0.48, 0.48],
    ),
    actionLookY: clampedInterpolate(p, [0, 0.74, 0.9, 1], [0, 0, -0.05, -0.05]),
    leftArmDeltaY: clampedInterpolate(
      p,
      [0, 0.18, 0.34, 0.5, 1],
      [0, -0.52, -0.52, 0, 0],
    ),
    rightArmDeltaY: clampedInterpolate(
      p,
      [0, 0.18, 0.34, 0.5, 1],
      [-0.25, -0.52, -0.52, 0, 0],
    ),
  };
}
