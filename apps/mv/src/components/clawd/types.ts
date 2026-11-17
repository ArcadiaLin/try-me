import type { ClawdRhythmMotion } from "../../timeline/rhythm-timing.ts";

export type ClawdAction =
  | "static"
  | "idle"
  | "crouch"
  | "nod"
  | "walk"
  | "wave"
  | "bounce"
  | "weight-shift"
  | "wave-step"
  | "tilt-invite"
  | "posture-nod"
  | "self-present"
  | "crouch-lean"
  | "peek-present"
  | "read-look-up"
  | "elastic-pop"
  | "stumble-left"
  | "snappy-nod";

export type ClawdMouth = "none" | "smile" | "talk" | "yawn" | "blush";
export type ClawdEyes = "normal" | "happy" | "wince";
export type ClawdOutfit = "none" | "swag" | "gentleman" | "party";
export type ClawdProp =
  | "none"
  | "coffee"
  | "book"
  | "juggle"
  | "dj"
  | "trumpet";

/**
 * 角色骨骼与五官的标准化姿态描述（以 16×10 网格单位计）
 * 由 animation/clawd/ 动作层计算输出，交由 ClawdBody / ClawdFace 渲染。
 */
export interface ClawdPose {
  /** 整个人物在局部 SVG 舞台上的水平侧移（如 A7 peek-present 探身） */
  stageOffsetX: number;
  /** 上半身相对足底的水平重心偏移 */
  bodyOffsetX: number;
  /** 躯干垂直偏移（>0 向下压，<0 向上挺/跃起） */
  bodyOffsetY: number;
  /** 上半身绕旋转支点的侧倾角度（度） */
  torsoTiltDeg: number;
  /** 上半身旋转支点 X（常规为躯干中心 8，stumble-left 为左足支点 4.5） */
  rotPivotX: number;
  /** 整体水平缩放（围绕地面中心 8,10） */
  scaleX: number;
  /** 整体垂直缩放（围绕地面中心 8,10） */
  scaleY: number;
  /** 左臂向外伸展量（>0 向外伸，<0 向内收） */
  leftArmExtend: number;
  /** 右臂向外伸展量（>0 向外伸，<0 向内收） */
  rightArmExtend: number;
  /** 左臂垂直偏移量（包含 bodyOffsetY 与独立挥舞偏移） */
  leftArmOffsetY: number;
  /** 右臂垂直偏移量（包含 bodyOffsetY 与独立挥舞偏移） */
  rightArmOffsetY: number;
  /** 双手从身体两侧向胸前移动捧书的连续进度 (0 ~ 1)：0 在身体外侧，>0 时远端与躯干重合产生描边并捧住书本 */
  handHoldProgress: number;
  /** 四条短腿离地抬升量 [leg1(x=3), leg2(x=5), leg3(x=10), leg4(x=12)] */
  legLifts: [number, number, number, number];
  /** 是否处于整体腾空动作（walk / bounce） */
  isAirborneAction: boolean;
  /** 是否处于 stumble-left 左两足踮脚跳阶段（左足锁死 + 足尖收窄，右足悬空微外撇） */
  isStumbleHop: boolean;
  /** 动作自带的视线偏移 */
  actionLook: { x: number; y: number };
  /** L004 朝自己示意时的胸前前足内折提示线不透明度 (0 ~ 1) */
  selfPointOpacity: number;
  /** 踉跄慌乱时的汗滴进度（仅 stumble-left 时有效，null 表示不显示） */
  sweatDropsProgress: number | null;
}

export interface ClawdProps {
  /** 渲染宽度（像素），高度按比例自动计算 */
  width?: number;
  /** 可选直接传入计算好的骨骼姿态；未传时根据 action + actionProgress 自动求解 */
  pose?: ClawdPose;
  /** 预设肢体动作模式（包含基础循环与 Verse 1 叙事单次动作 A1–A9） */
  action?: ClawdAction;
  /**
   * 叙事型动作进度 (0 ~ 1)。
   * 传入时按句内时间进度精确驱动单次动作阶段；未传入时按默认周期自动循环演示。
   */
  actionProgress?: number;
  /** 眼部原子状态（默认 normal 竖直像素眼；happy 为 ^ ^ 微笑弯眼；wince 为 > < 踉跄眼） */
  eyes?: ClawdEyes;
  /** 嘴部与五官表情（无 / 像素微笑 / 说话方嘴 / 打哈欠 / 弯眼腮红） */
  mouth?: ClawdMouth;
  /** mouth="talk" 时是否显示右上角内置小叹号气泡 */
  showTalkBubble?: boolean;
  /** 换装造型（原版 / Superstar 潮人墨镜反戴帽 / 绅士高礼帽单片镜 / 派对尖顶帽） */
  outfit?: ClawdOutfit;
  /** 手持或场景道具（无 / 端咖啡 / 捧书阅读 / 杂耍抛球 / DJ 打碟台 / 铜管小号） */
  prop?: ClawdProp;
  /** L009–L010 中学生白反光眼镜进出场进度 (0 ~ 1) */
  glassesProgress?: number;
  /** L009–L010 书本从右下进出场进度 (0 ~ 1) */
  bookProgress?: number;
  /** L011 小号吹奏全流程进度 (0 ~ 1) */
  trumpetProgress?: number;
  /** 外部节拍脉冲强度 (0 ~ 1)，用于和音乐拍点同步弹跳 */
  beatPulse?: number;
  /** 可选的连续拍点律动；未传时保持现有小样与踮脚跳原表现 */
  rhythm?: ClawdRhythmMotion;
  /** 身体主色（默认 #D87757 陶土橙） */
  bodyColor?: string;
  /** 眼睛颜色（默认 #000000） */
  eyeColor?: string;
  /** 外轮廓描边颜色（默认 #11131F） */
  outlineColor?: string;
  /** 外轮廓描边宽度（以 16x10 网格单位计，设为 0 则关闭描边） */
  outlineWidth?: number;
  /** 眼神看向的偏移量（以网格为单位，范围约 -0.5 ~ 0.5） */
  lookOffset?: { x: number; y: number };
  /** 是否叠加显示 16x10 像素网格与坐标辅助线 */
  showGrid?: boolean;
  /** 是否开启自动眨眼 */
  autoBlink?: boolean;
}
