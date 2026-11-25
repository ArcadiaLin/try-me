import { CLAWD_MODEL } from "../../components/clawd/model.ts";
import type { ClawdPose } from "../../components/clawd/types.ts";

/**
 * 局部动作增量（各动作文件只需返回与默认姿态的差异项，未填项由 blend.ts 补齐默认值）
 */
export interface ClawdPoseDelta {
  stageOffsetX?: number;
  bodyOffsetX?: number;
  bodyOffsetY?: number;
  torsoTiltDeg?: number;
  rotPivotX?: number;
  scaleX?: number;
  scaleY?: number;
  leftArmExtend?: number;
  rightArmExtend?: number;
  /** 相对于 bodyOffsetY 的左臂额外垂直位移 */
  leftArmDeltaY?: number;
  /** 相对于 bodyOffsetY 的右臂额外垂直位移 */
  rightArmDeltaY?: number;
  legLifts?: [number, number, number, number];
  isAirborneAction?: boolean;
  isStumbleHop?: boolean;
  actionLookX?: number;
  actionLookY?: number;
  selfPointOpacity?: number;
  sweatDropsProgress?: number | null;
  dabProgress?: number;
}

/**
 * 创建带呼吸基线的标准站立中立姿态
 */
export function createNeutralPose(breathY = 0): ClawdPose {
  return {
    stageOffsetX: 0,
    bodyOffsetX: 0,
    bodyOffsetY: breathY,
    torsoTiltDeg: 0,
    rotPivotX: CLAWD_MODEL.joints.centerPivotX,
    scaleX: 1,
    scaleY: 1,
    leftArmExtend: 0,
    rightArmExtend: 0,
    leftArmOffsetY: breathY,
    rightArmOffsetY: breathY,
    handHoldProgress: 0,
    legLifts: [0, 0, 0, 0],
    isAirborneAction: false,
    isStumbleHop: false,
    actionLook: { x: 0, y: 0 },
    selfPointOpacity: 0,
    sweatDropsProgress: null,
  };
}
