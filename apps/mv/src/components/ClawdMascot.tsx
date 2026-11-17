import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

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

export interface ClawdMascotProps {
  /** 渲染宽度（像素），高度按比例自动计算 */
  width?: number;
  /** 预设肢体动作模式（包含基础循环与 Verse 1 叙事单次动作 A1–A9） */
  action?: ClawdAction;
  /**
   * 叙事型动作进度 (0 ~ 1)。
   * 传入时按句内时间进度精确驱动单次动作阶段；未传入时按默认周期自动循环演示。
   */
  actionProgress?: number;
  /** 眼部原子状态（默认 normal 竖直像素眼；happy 为 ^ ^ 微笑弯眼） */
  eyes?: ClawdEyes;
  /** 嘴部与五官表情（无 / 像素微笑 / 说话方嘴 / 打哈欠 / 弯眼腮红） */
  mouth?: ClawdMouth;
  /** mouth="talk" 时是否显示右上角内置小叹号气泡（外部已有大型多语言气泡时可设为 false） */
  showTalkBubble?: boolean;
  /** 换装造型（原版 / Superstar 潮人墨镜反戴帽 / 绅士高礼帽单片镜 / 派对尖顶帽） */
  outfit?: ClawdOutfit;
  /** 手持或场景道具（无 / 端咖啡 / 捧书阅读 / 杂耍抛球 / DJ 打碟台 / 铜管小号） */
  prop?: ClawdProp;
  /**
   * L009–L010 中学生白反光眼镜进出场进度 (0 ~ 1)：
   * 0 为画外左侧隐藏，0->1 从左侧旋转飞入并戴在眼部遮住黑眼，1->0 向左侧退回
   */
  glassesProgress?: number;
  /**
   * L009–L010 书本从右下进出场进度 (0 ~ 1)：
   * 未传但 prop="book" 时默认常驻显示 (1)
   */
  bookProgress?: number;
  /**
   * L011 小号吹奏全流程进度 (0 ~ 1)：
   * 0~0.22 从右侧入场接住 -> 0.22~0.76 抬起吹奏+飘出几何音符 -> 0.76~1.0 放低向右送出
   */
  trumpetProgress?: number;
  /** 外部节拍脉冲强度 (0 ~ 1)，用于和音乐拍点同步弹跳 */
  beatPulse?: number;
  /** 身体主色（默认取自参考图 #D87757 陶土橙） */
  bodyColor?: string;
  /** 眼睛颜色（默认纯黑 #000000） */
  eyeColor?: string;
  /** 外轮廓描边颜色（默认深色描边 #11131F） */
  outlineColor?: string;
  /** 外轮廓描边宽度（以 16x10 网格单位计，设为 0 则关闭描边） */
  outlineWidth?: number;
  /** 眼神看向的偏移量（以网格为单位，范围约 -0.5 ~ 0.5） */
  lookOffset?: { x: number; y: number };
  /** 是否叠加显示 16x10 像素网格与坐标辅助线（教学/调试用） */
  showGrid?: boolean;
  /** 是否开启自动眨眼 */
  autoBlink?: boolean;
}

/**
 * Clawd 像素吉祥物组件（基于 16×10 正方形网格坐标系）
 *
 * 按由简入繁分为三阶能力：
 * - Tier 1 极简肢体动作 (action): idle(呼吸眨眼) / crouch(小幅蹲起) / nod(点头律动) / walk(四足小碎步) / wave(挥手) / bounce(弹跳)
 * - Tier 2 轻表情互动 (mouth):    none / smile(微笑) / talk(说话气泡) / yawn(打哈欠) / blush(弯眼腮红比心)
 * - Tier 3 换装与舞台道具:        outfit(swag/gentleman/party) + prop(book/coffee/juggle/dj)
 */
/**
 * 计算 stumble-left（左两足踮脚三小跳 + 右两足悬空）的精确腾空弧度与水平阶梯进度：
 * - 四个离散落点比例：0 (-105px) -> 0.50 (-150px, 跨度 45px) -> 0.822 (-179px, 跨度 29px) -> 1.0 (-195px, 跨度 16px)
 * - 三次踮脚跳的高度与滞空时长依次递减（高度比 1.00 -> 0.62 -> 0.32），触地期间 hopArc === 0 且 X 坐标 100% 锁死不滑步！
 */
export function getStumbleLeftKinematics(pRaw: number): {
  hopArc: number;
  hopHeightRatio: number;
  plantCompression: number;
  xSpots: [number, number, number, number];
  currentXRatio: number;
} {
  const p = Math.max(0, Math.min(1, pRaw));
  // 距离递减的四个离散落点比例：0 -> 0.50 (步幅 50%) -> 0.822 (步幅 32.2%) -> 1.0 (步幅 17.8%)
  const r0 = 0;
  const r1 = 0.5;
  const r2 = 0.822;
  const r3 = 1.0;

  let hopArc = 0;
  let hopHeightRatio = 0;
  let plantCompression = 0;
  let currentXRatio = r0;

  if (p < 0.06) {
    // Plant 0: 初次落地缓冲，X 锁定在 r0 (-105px)
    currentXRatio = r0;
    plantCompression = Math.sin((p / 0.06) * Math.PI);
  } else if (p < 0.3) {
    // Hop 1 腾空 (时长 0.24): 大跨度高弹跳 (r0 -> r1, 高度 100%)
    const t = (p - 0.06) / 0.24;
    hopArc = Math.sin(t * Math.PI);
    hopHeightRatio = 1.0;
    currentXRatio = r0 + (r1 - r0) * t;
  } else if (p < 0.37) {
    // Plant 1: 第 1 跳落地踮脚缓冲，X 完全锁定在 r1 (-150px)
    currentXRatio = r1;
    plantCompression = Math.sin(((p - 0.3) / 0.07) * Math.PI) * 0.8;
  } else if (p < 0.56) {
    // Hop 2 腾空 (时长 0.19): 中等跨度与高度 (r1 -> r2, 高度 62%)
    const t = (p - 0.37) / 0.19;
    hopArc = Math.sin(t * Math.PI);
    hopHeightRatio = 0.62;
    currentXRatio = r1 + (r2 - r1) * t;
  } else if (p < 0.63) {
    // Plant 2: 第 2 跳落地踮脚缓冲，X 完全锁定在 r2 (-179px)
    currentXRatio = r2;
    plantCompression = Math.sin(((p - 0.56) / 0.07) * Math.PI) * 0.55;
  } else if (p < 0.77) {
    // Hop 3 腾空 (时长 0.14): 小跨度收尾轻跳 (r2 -> r3, 高度 32%)
    const t = (p - 0.63) / 0.14;
    hopArc = Math.sin(t * Math.PI);
    hopHeightRatio = 0.32;
    currentXRatio = r2 + (r3 - r2) * t;
  } else {
    // Plant 3 & 回正 (0.77~1.0): X 完全锁定在最终站位 r3 (-195px)，以左足为支点回正身体
    currentXRatio = r3;
    plantCompression =
      p < 0.84 ? Math.sin(((p - 0.77) / 0.07) * Math.PI) * 0.35 : 0;
  }

  return {
    hopArc,
    hopHeightRatio,
    plantCompression,
    xSpots: [r0, r1, r2, r3],
    currentXRatio,
  };
}

export const ClawdMascot: React.FC<ClawdMascotProps> = ({
  width = 320,
  action = "idle",
  actionProgress,
  eyes = "normal",
  mouth = "none",
  showTalkBubble = true,
  outfit = "none",
  prop = "none",
  glassesProgress = 0,
  bookProgress,
  trumpetProgress,
  beatPulse = 0,
  bodyColor = "#D87757",
  eyeColor = "#000000",
  outlineColor = "#11131F",
  outlineWidth = 0.18,
  lookOffset = { x: 0, y: 0 },
  showGrid = false,
  autoBlink = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeSec = frame / fps;

  // 叙事型单次动作进度 (0 ~ 1)：若外部未传入，则按 3.0 秒周期平滑循环演示
  const p =
    actionProgress !== undefined
      ? Math.max(0, Math.min(1, actionProgress))
      : (timeSec / 3.0) % 1;

  // 1. 整体呼吸 / 蹲起 / 弹跳位移、侧倾与挤压拉伸 (Squash & Stretch)
  // 共享连续呼吸基线：使用全局 timeSec 驱动，确保跨句切换 action 时在边界处 (p=0 / p=1) 绝不发生垂直位置跳变
  const breathY = Math.sin(timeSec * Math.PI * 2) * 0.12;
  let bodyOffsetY = breathY;
  let bodyOffsetX = 0; // 上半身相对足底的水平重心偏移
  let stageOffsetX = 0; // 整个人物在舞台上的水平侧移
  let torsoTiltDeg = 0; // 上半身绕髋部 (8, 8) 的歪头/侧倾角度
  let scaleX = 1;
  let scaleY = 1;
  let actionLookX = 0;
  let actionLookY = 0;
  let leftArmExtend = 0; // >0 向外伸展，<0 向内收拢
  let rightArmExtend = 0;
  let selfPointOpacity = 0; // L004 朝自己示意时的胸前前足内折提示线

  if (action === "static") {
    bodyOffsetY = 0;
  } else if (action === "idle") {
    bodyOffsetY = breathY;
  } else if (action === "crouch") {
    // 间奏小幅度蹲起（周期性下蹲蓄力再回弹）
    const squatWave = Math.max(0, Math.sin(timeSec * Math.PI * 3.5));
    bodyOffsetY = squatWave * 0.65;
    scaleX = 1 + squatWave * 0.06;
    scaleY = 1 - squatWave * 0.06;
  } else if (action === "nod") {
    // 极简合成器律动：随节拍轻微左右摇摆+点头
    bodyOffsetY = Math.abs(Math.sin(timeSec * Math.PI * 3.56)) * 0.32;
    bodyOffsetX = Math.sin(timeSec * Math.PI * 1.78) * 0.25;
  } else if (action === "walk") {
    bodyOffsetY = Math.abs(Math.sin(timeSec * Math.PI * 6)) * -0.28;
  } else if (action === "wave") {
    bodyOffsetY = Math.sin(timeSec * Math.PI * 3) * 0.15;
  } else if (action === "bounce") {
    const phase = (timeSec * 2) % 1;
    const jumpArc = Math.sin(phase * Math.PI);
    bodyOffsetY = -jumpArc * 0.85;
    scaleX = phase < 0.12 ? 1.07 : 1 - jumpArc * 0.04;
    scaleY = phase < 0.12 ? 0.93 : 1 + jumpArc * 0.05;
  } else if (action === "weight-shift") {
    // A1 (L066 前奏): 先轻呼吸眨眼看向观众，逐步加入左右重心转移（足底贴地不动，首尾 p=0/1 平滑归零）
    const sway = Math.sin(p * Math.PI * 2);
    const cycleEnv = Math.sin(p * Math.PI);
    bodyOffsetX = sway * 0.48;
    bodyOffsetY = breathY + cycleEnv * (1 - Math.abs(sway)) * 0.22;
    torsoTiltDeg = sway * 1.8;
    actionLookX = sway * 0.22;
  } else if (action === "wave-step") {
    // A2 (L001): 看向观众短挥手一次 (0~0.38) -> 重心稍向前送走到面试位 (0.38~0.64) -> 自信小幅蹲起 (0.64~1.0)
    if (p < 0.38) {
      const waveEnv = Math.sin((p / 0.38) * Math.PI);
      bodyOffsetY = breathY + Math.sin((p / 0.38) * Math.PI * 2) * 0.1;
      actionLookX = 0.08 * waveEnv;
    } else if (p < 0.64) {
      const stepT = (p - 0.38) / 0.26;
      const stepArc = Math.sin(stepT * Math.PI);
      // 向前送重心：先微压再稍放大挺身，首尾平滑归回 breathY
      bodyOffsetY =
        breathY + interpolate(stepT, [0, 0.38, 0.76, 1], [0, 0.32, -0.14, 0]);
      scaleX = 1 + stepArc * 0.045;
      scaleY = 1 + stepArc * 0.045;
    } else {
      const crouchT = (p - 0.64) / 0.36;
      const squat =
        Math.max(0, Math.sin(crouchT * Math.PI * 2)) *
        Math.sin(crouchT * Math.PI);
      bodyOffsetY = breathY + squat * 0.52;
      scaleX = 1 + squat * 0.05;
      scaleY = 1 - squat * 0.04;
    }
  } else if (action === "tilt-invite") {
    // A3 (L002): 轻侧身、歪头，眼神朝一侧空白处等待回应，前足小邀请动作；停一下留喜感；留白期视线回正
    const inviteEnv = interpolate(
      p,
      [0, 0.2, 0.68, 0.92, 1],
      [0, 1, 1, 0, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    bodyOffsetX = -0.22 * inviteEnv;
    torsoTiltDeg = 4.6 * inviteEnv;
    bodyOffsetY = breathY - 0.08 * inviteEnv;
    rightArmExtend = 0.72 * inviteEnv;
    actionLookX = 0.48 * inviteEnv;
    actionLookY = -0.08 * inviteEnv;
  } else if (action === "posture-nod") {
    // A4 (L003): 先收拢姿态 (0~0.24) -> 抬头挺身换重心 (0.24~0.46) -> 两次差幅点头 (0.46~0.84) -> 视线回镜头
    if (p < 0.24) {
      const gather = Math.sin((p / 0.24) * Math.PI);
      bodyOffsetY = breathY + gather * 0.32;
      scaleX = 1 - gather * 0.04;
      leftArmExtend = -0.55 * gather;
      rightArmExtend = -0.55 * gather;
      actionLookY = 0.12 * gather;
    } else if (p < 0.46) {
      const tall = Math.sin(((p - 0.24) / 0.22) * Math.PI);
      bodyOffsetY = breathY - tall * 0.32;
      bodyOffsetX = -tall * 0.24;
      scaleY = 1 + tall * 0.04;
      actionLookY = -0.18 * tall;
    } else if (p < 0.62) {
      // 第 1 次轻点头（小幅度）
      const nod1 = Math.sin(((p - 0.46) / 0.16) * Math.PI);
      bodyOffsetY = breathY + nod1 * 0.26;
      bodyOffsetX = 0.18 * nod1;
      actionLookY = nod1 * 0.2;
    } else if (p < 0.84) {
      // 第 2 次肯定点头（较大幅度）
      const nod2 = Math.sin(((p - 0.62) / 0.22) * Math.PI);
      bodyOffsetY = breathY + nod2 * 0.62;
      bodyOffsetX = 0.24 * nod2;
      scaleX = 1 + nod2 * 0.05;
      scaleY = 1 - nod2 * 0.04;
      actionLookY = nod2 * 0.36;
    } else {
      bodyOffsetY = breathY;
      actionLookX = 0;
      actionLookY = 0;
    }
  } else if (action === "self-present") {
    // A5 (L004): 前足朝自己示意 (0~0.44) -> 向外展开展示“看看我的本事” (0.44~0.82) -> 平滑回稳以衔接 L064 蹲起
    if (p < 0.44) {
      const inward = interpolate(p, [0, 0.14, 0.32, 0.44], [0, 1, 1, 0]);
      const tap = Math.sin((p / 0.44) * Math.PI * 2) * 0.1 * inward;
      leftArmExtend = -0.75 * inward;
      rightArmExtend = -0.75 * inward;
      selfPointOpacity = inward;
      bodyOffsetY = breathY + 0.14 * inward + tap;
      actionLookY = 0.14 * inward;
    } else {
      const openEnv = interpolate(
        p,
        [0.44, 0.58, 0.82, 1],
        [0, 1, 0.85, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
      leftArmExtend = 0.72 * openEnv;
      rightArmExtend = 0.72 * openEnv;
      bodyOffsetY = breathY - 0.26 * openEnv;
      scaleX = 1 + 0.03 * openEnv;
      scaleY = 1 + 0.035 * openEnv;
      actionLookY = -0.08 * openEnv;
    }
  } else if (action === "crouch-lean") {
    // A6 (L064 间奏): 一次稍明显的贴地下压—回正 (0~0.42) -> 轻待机 (0.42~0.72) -> 句尾向旁预倾铺垫 L005 (0.72~1.0)
    if (p < 0.42) {
      const squat = Math.sin((p / 0.42) * Math.PI);
      bodyOffsetY = breathY + squat * 0.82;
      scaleX = 1 + squat * 0.075;
      scaleY = 1 - squat * 0.065;
    } else if (p < 0.72) {
      bodyOffsetY = breathY;
    } else {
      const leanT = interpolate(p, [0.72, 0.92, 1], [0, 1, 1]);
      bodyOffsetX = 0.56 * leanT;
      torsoTiltDeg = 3.8 * leanT;
      bodyOffsetY = breathY + 0.22 * leanT;
      actionLookX = 0.35 * leanT;
    }
  } else if (action === "peek-present") {
    // A7 (L005): 无缝承接 L064 句尾预倾姿态 (p=0)，接一次短侧移探身+张开前足 (0~0.48) -> 落回原位 -> 句尾视线移向日历进入侧 (0.74~1.0)
    stageOffsetX = interpolate(
      p,
      [0, 0.18, 0.34, 0.52, 0.74, 1],
      [0, 1.15, 1.15, 0.16, 0, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    bodyOffsetX = interpolate(
      p,
      [0, 0.18, 0.34, 0.52, 0.74, 0.9, 1],
      [0.56, 0.35, 0.35, 0, 0, 0.24, 0.24],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    torsoTiltDeg = interpolate(
      p,
      [0, 0.18, 0.34, 0.52, 1],
      [3.8, 4.2, 4.2, 0, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    bodyOffsetY =
      breathY +
      interpolate(
        p,
        [0, 0.18, 0.34, 0.52, 0.64, 0.74, 1],
        [0.22, -0.22, -0.22, 0, 0.14, 0, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
    const armOpen = interpolate(
      p,
      [0, 0.18, 0.34, 0.5, 1],
      [0, 0.65, 0.65, 0, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    leftArmExtend = armOpen;
    rightArmExtend = armOpen;
    actionLookX = interpolate(
      p,
      [0, 0.18, 0.34, 0.52, 0.74, 0.9, 1],
      [0.35, 0.12, 0.12, 0, 0, 0.48, 0.48],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    actionLookY = interpolate(p, [0, 0.74, 0.9, 1], [0, 0, -0.05, -0.05], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else if (action === "read-look-up") {
    // A8 (L009-L010 本体): 低头读书配合微翻页 (0~0.56) -> 从书后抬头挺身 (0.56~0.88) -> 平滑回正清场 (0.88~1.0)
    if (p < 0.56) {
      const readEnv = interpolate(p, [0, 0.12], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const readT = p / 0.56;
      bodyOffsetY =
        breathY * 0.5 + (0.22 + Math.sin(readT * Math.PI * 2) * 0.05) * readEnv;
      actionLookX = Math.sin(readT * Math.PI * 3) * 0.32 * readEnv;
      actionLookY = 0.32 * readEnv;
    } else {
      const proudEnv = interpolate(p, [0.56, 0.7, 0.86, 1], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      bodyOffsetY =
        breathY * (1 - proudEnv * 0.5) +
        interpolate(p, [0.56, 0.7, 0.86, 1], [0.22, -0.26, -0.2, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
      scaleY = 1 + 0.045 * proudEnv;
      actionLookX = 0;
      actionLookY = interpolate(
        p,
        [0.56, 0.7, 0.86, 1],
        [0.32, -0.18, -0.14, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
    }
  } else if (action === "elastic-pop") {
    // A9 (贴地弹性回弹原子动作): 极短下压蓄力 (0~0.14) -> 瞬间弹起伸展 (0.14~0.21) -> 快速微回摆稳住 (0.21~0.42)
    const popBlend = interpolate(p, [0, 0.05, 0.42, 0.55], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const popY = interpolate(
      p,
      [0, 0.11, 0.14, 0.21, 0.3, 0.38, 0.46, 1],
      [0, 0.94, 0.98, -0.48, 0.16, -0.05, 0, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    bodyOffsetY = breathY * (1 - popBlend) + popY;
    scaleX = interpolate(
      p,
      [0, 0.14, 0.21, 0.3, 0.4, 1],
      [1, 1.12, 0.91, 1.03, 1, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    scaleY = interpolate(
      p,
      [0, 0.14, 0.21, 0.3, 0.4, 1],
      [1, 0.87, 1.11, 0.97, 1, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    const popFlare = interpolate(p, [0.14, 0.21, 0.36], [0, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    leftArmExtend = 0.48 * popFlare;
    rightArmExtend = 0.48 * popFlare;
    actionLookY = -0.18 * popFlare;
  } else if (action === "stumble-left") {
    // 从右侧终端跳落至偏左一点的初始点 (-105px) 后，左两足一踮一踮向左跳三小跳（距离与高度递减）到达最终位置 (-195px)，随后以左足为支点回正：
    const { hopArc, hopHeightRatio, plantCompression } =
      getStumbleLeftKinematics(p);
    const stumbleBlend = interpolate(p, [0, 0.04, 0.86, 1], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const hopBodyY =
      p < 0.77
        ? 0.18 * plantCompression - 1.05 * hopArc * hopHeightRatio
        : interpolate(p, [0.77, 0.84, 1], [0.1, 0, 0]);
    bodyOffsetY = breathY * (1 - stumbleBlend) + hopBodyY;
    bodyOffsetX = 0;
    // 身体左倾角度随三次递减跳跃同步逐级收敛 (-15.5° -> -12.0° -> -8.2° -> 0°)
    torsoTiltDeg = interpolate(
      p,
      [0, 0.05, 0.3, 0.35, 0.56, 0.61, 0.77, 0.93, 1],
      [-13.5, -15.5, -11.5, -12.2, -8.5, -8.8, -6.5, 1.4, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    scaleX = 1;
    scaleY = 1;
    const armFlail = interpolate(p, [0, 0.06, 0.8, 0.93, 1], [0, 1, 1, 0.15, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    leftArmExtend = 0.75 * armFlail;
    rightArmExtend = 0.65 * armFlail;
    actionLookX = interpolate(p, [0, 0.78, 0.9, 1], [-0.35, -0.25, 0.48, 0.5], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else if (action === "snappy-nod") {
    // L006「365日」句尾轻快明显的双拍弹性点头：干脆利落连点两下（咔-哒！）+ 身体轻快弹性配合
    const nodBlend = interpolate(p, [0, 0.06, 0.9, 1], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const nodY = interpolate(
      p,
      [0, 0.18, 0.34, 0.54, 0.74, 0.9, 1],
      [0, 0.86, -0.32, 0.96, -0.26, 0.08, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    bodyOffsetY = breathY * (1 - nodBlend) + nodY;
    torsoTiltDeg = interpolate(
      p,
      [0, 0.18, 0.34, 0.54, 0.74, 1],
      [0, 5.2, -2.0, 6.0, -1.6, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    scaleX = interpolate(
      p,
      [0, 0.18, 0.34, 0.54, 0.74, 1],
      [1, 1.09, 0.95, 1.11, 0.96, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    scaleY = interpolate(
      p,
      [0, 0.18, 0.34, 0.54, 0.74, 1],
      [1, 0.89, 1.06, 0.88, 1.05, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    actionLookY = interpolate(
      p,
      [0, 0.18, 0.34, 0.54, 0.74, 1],
      [0, 0.34, -0.14, 0.38, -0.12, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
  }

  if (prop === "dj") {
    bodyOffsetY = Math.abs(Math.sin(timeSec * Math.PI * 4)) * -0.26;
  }

  // 叠加外部音乐节拍脉冲 (beatPulse: 0 ~ 1)
  if (beatPulse > 0.01) {
    bodyOffsetY -= beatPulse * 0.55;
    scaleX *= 1 + beatPulse * 0.06;
    scaleY *= 1 - beatPulse * 0.04;
  }

  // 2. 双臂动作（以网格单位计算上下偏移或挥动）
  let leftArmOffsetY = bodyOffsetY;
  let rightArmOffsetY = bodyOffsetY;

  if (prop === "juggle") {
    leftArmOffsetY += Math.sin(timeSec * Math.PI * 6) * 0.35;
    rightArmOffsetY += Math.cos(timeSec * Math.PI * 6) * 0.35;
  } else if (prop === "dj") {
    leftArmOffsetY += Math.sin(timeSec * Math.PI * 8) * 0.22;
    rightArmOffsetY -= Math.sin(timeSec * Math.PI * 8) * 0.22;
  } else if (prop === "coffee") {
    const sipWave = Math.max(0, Math.sin(timeSec * Math.PI * 1.2));
    rightArmOffsetY += -0.25 - sipWave * 0.45;
  } else if (action === "crouch") {
    const squatWave = Math.max(0, Math.sin(timeSec * Math.PI * 3.5));
    leftArmOffsetY += -squatWave * 0.25;
    rightArmOffsetY += -squatWave * 0.25;
  } else if (action === "nod") {
    leftArmOffsetY += Math.sin(timeSec * Math.PI * 3.56) * 0.18;
    rightArmOffsetY -= Math.sin(timeSec * Math.PI * 3.56) * 0.18;
  } else if (action === "walk") {
    leftArmOffsetY += Math.sin(timeSec * Math.PI * 6) * 0.25;
    rightArmOffsetY -= Math.sin(timeSec * Math.PI * 6) * 0.25;
  } else if (action === "wave") {
    rightArmOffsetY += -0.65 + Math.sin(timeSec * Math.PI * 8) * 0.45;
    leftArmOffsetY += Math.sin(timeSec * Math.PI * 3) * 0.15;
  } else if (action === "bounce") {
    leftArmOffsetY += bodyOffsetY * 0.35;
    rightArmOffsetY += bodyOffsetY * 0.35;
  } else if (action === "weight-shift") {
    const sway = Math.sin(p * Math.PI * 2);
    leftArmOffsetY += -sway * 0.18;
    rightArmOffsetY += sway * 0.18;
  } else if (action === "wave-step") {
    if (p < 0.38) {
      const waveEnv = Math.sin((p / 0.38) * Math.PI);
      const waveOsc = Math.sin((p / 0.38) * Math.PI * 4);
      rightArmOffsetY += -0.75 * waveEnv + waveOsc * 0.38 * waveEnv;
      rightArmExtend = 0.25 * waveEnv;
    } else if (p < 0.64) {
      const stepT = (p - 0.38) / 0.26;
      const stepArc = Math.sin(stepT * Math.PI);
      leftArmOffsetY += -0.18 * stepArc;
      rightArmOffsetY += -0.18 * stepArc;
    }
  } else if (action === "tilt-invite") {
    const inviteEnv = interpolate(
      p,
      [0, 0.2, 0.68, 0.92, 1],
      [0, 1, 1, 0, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    rightArmOffsetY += -0.48 * inviteEnv;
    leftArmOffsetY += 0.12 * inviteEnv;
  } else if (action === "posture-nod") {
    if (p < 0.24) {
      const gather = Math.sin((p / 0.24) * Math.PI);
      leftArmOffsetY += -0.35 * gather;
      rightArmOffsetY += -0.35 * gather;
    } else if (p < 0.46) {
      const tall = Math.sin(((p - 0.24) / 0.22) * Math.PI);
      leftArmOffsetY += -0.22 * tall;
      rightArmOffsetY += -0.22 * tall;
    }
  } else if (action === "self-present") {
    if (p < 0.44) {
      const inward = interpolate(p, [0, 0.14, 0.32, 0.44], [0, 1, 1, 0]);
      leftArmOffsetY += -0.65 * inward;
      rightArmOffsetY += -0.65 * inward;
    } else {
      const openEnv = interpolate(
        p,
        [0.44, 0.58, 0.82, 1],
        [0, 1, 0.85, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
      leftArmOffsetY += -0.45 * openEnv;
      rightArmOffsetY += -0.45 * openEnv;
    }
  } else if (action === "crouch-lean") {
    if (p < 0.42) {
      const squat = Math.sin((p / 0.42) * Math.PI);
      leftArmOffsetY += -squat * 0.28;
      rightArmOffsetY += -squat * 0.28;
    } else if (p >= 0.72) {
      const leanT = interpolate(p, [0.72, 0.92, 1], [0, 1, 1]);
      rightArmOffsetY += -0.25 * leanT;
    }
  } else if (action === "peek-present") {
    leftArmOffsetY += interpolate(
      p,
      [0, 0.18, 0.34, 0.5, 1],
      [0, -0.52, -0.52, 0, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    rightArmOffsetY += interpolate(
      p,
      [0, 0.18, 0.34, 0.5, 1],
      [-0.25, -0.52, -0.52, 0, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
  } else if (action === "read-look-up") {
    if (p < 0.56) {
      const readEnv = interpolate(p, [0, 0.12], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const flipPulse = Math.max(0, Math.sin((p / 0.56) * Math.PI * 3));
      rightArmOffsetY += (-0.2 - flipPulse * 0.28) * readEnv;
      leftArmOffsetY += -0.15 * readEnv;
    } else {
      const proudEnv = interpolate(p, [0.56, 0.7, 0.86, 1], [0.6, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      leftArmOffsetY += -0.25 * proudEnv;
      rightArmOffsetY += -0.25 * proudEnv;
    }
  } else if (action === "elastic-pop") {
    const preload = interpolate(p, [0, 0.14, 0.19], [0, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const popUp = interpolate(p, [0.14, 0.21, 0.36], [0, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    leftArmOffsetY += preload * 0.34 - popUp * 0.78;
    rightArmOffsetY += preload * 0.34 - popUp * 0.78;
  } else if (action === "stumble-left") {
    // 前肢快速上下交替摆动（表示没站稳拼命找平衡）
    const flailEnv = interpolate(p, [0, 0.08, 0.78, 0.92, 1], [0, 1, 1, 0.15, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const flapWave = Math.sin(p * Math.PI * 10);
    leftArmOffsetY += -0.42 * flailEnv + flapWave * 0.84 * flailEnv;
    rightArmOffsetY += -0.52 * flailEnv - flapWave * 0.84 * flailEnv;
  } else if (action === "snappy-nod") {
    const snapArm = interpolate(
      p,
      [0, 0.18, 0.34, 0.54, 0.74, 1],
      [0, 0.28, -0.42, 0.32, -0.38, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    leftArmOffsetY += snapArm;
    rightArmOffsetY += snapArm;
  }

  // 3. 四条小短腿离地抬升量（仅 walk、bounce 与 stumble-left 右侧惯性翘脚离地，其余所有动作足底均严格贴地 y = 10）
  let leg1Lift = 0;
  let leg2Lift = 0;
  let leg3Lift = 0;
  let leg4Lift = 0;

  if (action === "walk") {
    const stride = Math.sin(timeSec * Math.PI * 6);
    leg1Lift = Math.max(0, stride) * 0.75;
    leg3Lift = Math.max(0, stride) * 0.75;
    leg2Lift = Math.max(0, -stride) * 0.75;
    leg4Lift = Math.max(0, -stride) * 0.75;
  } else if (action === "bounce") {
    const lift = Math.max(0, -bodyOffsetY) * 0.65;
    leg1Lift = lift;
    leg2Lift = lift;
    leg3Lift = lift;
    leg4Lift = lift;
  } else if (action === "stumble-left") {
    // 左侧两足在三小跳腾空期按递减高度 (100% -> 62% -> 32%) 离地跃起、触地期严格钉在地面 y=10；右侧两足全程悬空！
    const { hopArc, hopHeightRatio } = getStumbleLeftKinematics(p);
    const rightAirEnv = interpolate(
      p,
      [0, 0.03, 0.35, 0.6, 0.77, 0.94, 1],
      [0.95, 1, 0.82, 0.62, 0.48, 0.1, 0],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );
    // 左侧两足 (leg1, leg2)：腾空跳跃高度随 hopHeightRatio 依次递减，触地停顿时 lift === 0 完全贴地
    leg1Lift = hopArc * hopHeightRatio * 1.05;
    leg2Lift = hopArc * hopHeightRatio * 0.96;
    // 右侧两足 (leg3, leg4)：全程直接悬空，且随左倾角度收敛逐跳降低悬空高度，直到 p>0.77 回正时落回地面
    leg3Lift = 1.35 * rightAirEnv + hopArc * hopHeightRatio * 0.9;
    leg4Lift = 1.85 * rightAirEnv + hopArc * hopHeightRatio * 1.0;
  }

  // 4. 自动眨眼与阅读视线控制
  let eyeScaleY = 1;
  if (autoBlink && action !== "static" && outfit !== "swag") {
    const blinkCycle = timeSec % 3.2;
    if (blinkCycle > 2.95 && blinkCycle < 3.11) {
      const blinkProgress = (blinkCycle - 2.95) / 0.16;
      eyeScaleY = interpolate(
        blinkProgress,
        [0, 0.5, 1],
        [1, 0.08, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        },
      );
    }
  }

  const readingLookX =
    prop === "book" && action !== "read-look-up"
      ? Math.sin(timeSec * Math.PI * 2.5) * 0.35
      : 0;
  const readingLookY =
    prop === "book" && action !== "read-look-up" ? 0.25 : 0;
  const nodLookY =
    action === "nod"
      ? Math.abs(Math.sin(timeSec * Math.PI * 3.56)) * 0.22
      : 0;

  const isHappyFlatEyes = mouth === "smile" && outfit === "none";
  const isYawnEyes = mouth === "yawn";
  const baseEyeHeight = isYawnEyes ? 0.38 : isHappyFlatEyes ? 1.15 : 2;
  const baseEyeWidth = isYawnEyes ? 1.65 : isHappyFlatEyes ? 1.55 : 1;

  const eyeHeight = baseEyeHeight * eyeScaleY;
  const eyeY =
    2 +
    bodyOffsetY +
    (2 - eyeHeight) / 2 +
    lookOffset.y +
    actionLookY +
    readingLookY +
    nodLookY;
  const leftEyeX =
    4 -
    (baseEyeWidth - 1) / 2 +
    lookOffset.x +
    actionLookX +
    readingLookX +
    bodyOffsetX;
  const rightEyeX =
    11 -
    (baseEyeWidth - 1) / 2 +
    lookOffset.x +
    actionLookX +
    readingLookX +
    bodyOffsetX;

  const padX = 3.2;
  const padTop = 3.8;
  const padBottom = 1.8;
  const viewBoxWidth = 16 + padX * 2;
  const viewBoxHeight = 10 + padTop + padBottom;
  const height = Math.round(width * (viewBoxHeight / viewBoxWidth));

  // 双臂与四足均将根部锚点深入躯干内部（armInset=1.6, hipInset=1.4），允许身体歪头/位移时肢体自然拉伸不断裂
  const armInset = 1.6;
  const hipInset = 1.4;
  const leftArmX = Math.min(1.4, -leftArmExtend);
  const leftArmW = Math.max(0.6, 2 + leftArmExtend) + armInset;
  const rightArmX = 14 - armInset;
  const rightArmW = Math.max(0.6, 2 + rightArmExtend) + armInset;
  const rotPivotX = action === "stumble-left" ? 4.5 : 8;
  const upperBodyTransform = `translate(${bodyOffsetX}, 0) rotate(${torsoTiltDeg}, ${rotPivotX}, 8)`;
  const tiltRad = (torsoTiltDeg * Math.PI) / 180;
  const isAirborneAction = action === "walk" || action === "bounce";

  const legConfigs = [
    { baseX: 3, lift: leg1Lift },
    { baseX: 5, lift: leg2Lift },
    { baseX: 10, lift: leg3Lift },
    { baseX: 12, lift: leg4Lift },
  ];

  const renderBodyParts = (fill: string, stroke?: string, strokeWidth = 0) => (
    <g
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    >
      {/* 上半身（躯干 + 根部内嵌双臂）：支持水平重心偏移与歪头/侧倾 */}
      <g transform={upperBodyTransform}>
        {/* 躯干主体: x=2..14 (w=12), y=0..8 (h=8) */}
        <rect x={2} y={bodyOffsetY} width={12} height={8} />
        {/* 左臂: 根部锚定在躯干内部 x=3.6，外端随 leftArmExtend 伸缩 */}
        <rect
          x={leftArmX}
          y={4 + leftArmOffsetY}
          width={leftArmW}
          height={2}
        />
        {/* 右臂: 根部锚定在躯干内部 x=12.4，外端随 rightArmExtend 伸缩 */}
        <rect
          x={rightArmX}
          y={4 + rightArmOffsetY}
          width={rightArmW}
          height={2}
        />
      </g>
      {/* 四条腿: 顶部髋锚点内嵌于倾斜躯干内部并随身体拉伸，底端足尖锚定地面 y=10 */}
      <g>
        {legConfigs.map(({ baseX, lift }) => {
          const cx = baseX + 0.5;
          // 计算该腿所在 X 处躯干绕 rotPivotX 倾斜后的下沿高度，并将髋部锚点向躯干内部上移 hipInset
          const torsoBottomAtLeg =
            8 + bodyOffsetY + (cx - rotPivotX) * Math.tan(tiltRad);
          const hipY = torsoBottomAtLeg - hipInset;
          const footY = isAirborneAction
            ? 10 + Math.min(0, bodyOffsetY) - lift
            : 10 - lift;
          // stumble-left 时左两足水平坐标严格等于 baseX（触地绝不滑动），右两足随左倾悬空微向外撇
          const isStumbleHop = action === "stumble-left" && p < 0.95;
          const isRightLeg = baseX >= 10;
          const hipX = isStumbleHop
            ? baseX
            : baseX + (isAirborneAction ? bodyOffsetX : bodyOffsetX * 0.78);
          const footX = isStumbleHop
            ? isRightLeg
              ? baseX + 0.35
              : baseX
            : baseX + (isAirborneAction ? bodyOffsetX : bodyOffsetX * 0.22);
          // 左侧两足在踮脚跳时足尖略收窄，强化“踮脚”视觉感
          const tiptoeInset = isStumbleHop && !isRightLeg ? 0.16 : 0;

          return (
            <polygon
              key={baseX}
              points={`${hipX},${hipY} ${hipX + 1},${hipY} ${footX + 1 - tiptoeInset},${footY} ${footX + tiptoeInset},${footY}`}
            />
          );
        })}
      </g>
    </g>
  );

  const talkOpen =
    mouth === "talk"
      ? 0.45 + Math.abs(Math.sin(timeSec * Math.PI * 9)) * 0.75
      : 0.9;

  const yawnOpen =
    mouth === "yawn"
      ? 0.6 + Math.abs(Math.sin(timeSec * Math.PI * 1.6)) * 1.45
      : 1.2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`${-padX} ${-padTop} ${viewBoxWidth} ${viewBoxHeight}`}
      style={{
        display: "block",
        overflow: "visible",
      }}
    >
      <g
        transform={`translate(${stageOffsetX}, 0)`}
        style={{
          transformOrigin: "8px 10px",
          scale: `${scaleX} ${scaleY}`,
        }}
      >
        {/* 第 1 层：无缝外轮廓层 */}
        {outlineWidth > 0 &&
          renderBodyParts(outlineColor, outlineColor, outlineWidth * 2)}

        {/* 第 2 层：橙色实体填充层 */}
        {renderBodyParts(bodyColor)}

        {/* L004 朝自己示意时的胸前前足内折像素折线（位于眼部下方胸口处） */}
        {selfPointOpacity > 0.05 && (
          <g
            transform={upperBodyTransform}
            fill={outlineColor}
            opacity={selfPointOpacity * 0.85}
          >
            <rect x={4.2} y={5.15 + bodyOffsetY} width={1.35} height={0.34} />
            <rect x={5.2} y={4.55 + bodyOffsetY} width={0.34} height={0.94} />
            <rect x={10.45} y={5.15 + bodyOffsetY} width={1.35} height={0.34} />
            <rect x={10.45} y={4.55 + bodyOffsetY} width={0.34} height={0.94} />
          </g>
        )}

        {/* 第 3 层：眼睛与墨镜 / 单片眼镜 / 弯眼笑脸 */}
        {outfit === "swag" ? (
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY}) rotate(${torsoTiltDeg}, 8, 8)`}>
            <rect x={2} y={1.55} width={12} height={0.5} fill="#14131D" />
            <rect x={2.7} y={1.9} width={3.4} height={1.85} fill="#14131D" />
            <rect x={3.25} y={2.25} width={0.55} height={0.55} fill="#FFFFFF" />
            <rect x={9.5} y={1.9} width={3.4} height={1.85} fill="#14131D" />
            <rect x={10.05} y={2.25} width={0.55} height={0.55} fill="#FFFFFF" />
          </g>
        ) : mouth === "blush" || eyes === "happy" ? (
          /* Clawd 弯弯微笑眼 ^ ^（mouth="blush" 时额外带粉色腮红，eyes="happy" 为纯微笑弯眼原子状态） */
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY}) rotate(${torsoTiltDeg}, 8, 8)`}>
            <rect x={3.4} y={2.45} width={0.6} height={0.6} fill={eyeColor} />
            <rect x={4.0} y={1.85} width={0.6} height={0.6} fill={eyeColor} />
            <rect x={4.6} y={2.45} width={0.6} height={0.6} fill={eyeColor} />
            <rect x={10.8} y={2.45} width={0.6} height={0.6} fill={eyeColor} />
            <rect x={11.4} y={1.85} width={0.6} height={0.6} fill={eyeColor} />
            <rect x={12.0} y={2.45} width={0.6} height={0.6} fill={eyeColor} />
            {mouth === "blush" && (
              <>
                <rect x={2.6} y={3.45} width={1.4} height={0.65} fill="#F48FB1" />
                <rect x={12.0} y={3.45} width={1.4} height={0.65} fill="#F48FB1" />
              </>
            )}
          </g>
        ) : eyes === "wince" ? (
          /* Clawd 紧闭/踉跄眼符号 > < */
          <g
            transform={`translate(${bodyOffsetX}, ${bodyOffsetY}) rotate(${torsoTiltDeg}, ${rotPivotX}, 8)`}
            fill="none"
            stroke={eyeColor}
            strokeWidth={0.58}
            strokeLinecap="square"
            strokeLinejoin="miter"
          >
            {/* 左眼 > */}
            <polyline points="3.15,1.75 4.75,2.6 3.15,3.45" />
            {/* 右眼 < */}
            <polyline points="12.85,1.75 11.25,2.6 12.85,3.45" />
          </g>
        ) : (
          <g transform={`rotate(${torsoTiltDeg}, ${rotPivotX + bodyOffsetX}, 8)`} fill={eyeColor}>
            <rect
              x={leftEyeX}
              y={eyeY}
              width={baseEyeWidth}
              height={eyeHeight}
            />
            <rect
              x={rightEyeX}
              y={eyeY}
              width={
                outfit === "gentleman" ? baseEyeWidth * 0.75 : baseEyeWidth
              }
              height={
                outfit === "gentleman" ? eyeHeight * 0.75 : eyeHeight
              }
            />
          </g>
        )}

        {/* 踉跄慌乱时的汗滴特效 (action === "stumble-left")：伴随三步垫步从头顶两侧飞落几滴汗 */}
        {action === "stumble-left" && p < 0.88 && (() => {
          const drops = [
            { start: 0.04, end: 0.48, baseX: 1.0, baseY: 0.4, dx: -1.6, dy: 2.3, scale: 1.0 },
            { start: 0.22, end: 0.68, baseX: 14.8, baseY: 0.2, dx: 1.7, dy: 2.4, scale: 0.95 },
            { start: 0.42, end: 0.86, baseX: 0.6, baseY: 1.6, dx: -1.5, dy: 2.2, scale: 0.88 },
          ];
          return (
            <g>
              {drops.map((d, i) => {
                const dp = Math.max(0, Math.min(1, (p - d.start) / (d.end - d.start)));
                if (dp <= 0 || dp >= 1) return null;
                const x = d.baseX + bodyOffsetX + d.dx * dp;
                const y = d.baseY + bodyOffsetY + d.dy * dp * dp;
                const op = dp < 0.2 ? dp / 0.2 : dp > 0.75 ? (1 - dp) / 0.25 : 1;
                return (
                  <g
                    key={i}
                    transform={`translate(${x}, ${y}) scale(${d.scale})`}
                    opacity={op}
                  >
                    <path
                      d="M 0 -0.7 C 0.42 -0.1 0.52 0.35 0.52 0.62 A 0.52 0.52 0 1 1 -0.52 0.62 C -0.52 0.35 -0.42 -0.1 0 -0.7 Z"
                      fill="#38BDF8"
                      stroke="#11131F"
                      strokeWidth={0.18}
                    />
                    <circle cx={-0.16} cy={0.55} r={0.14} fill="#E0F2FE" />
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* 第 4 层：嘴部表情与胡须 */}
        {outfit === "gentleman" && (
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
            <rect
              x={9.7}
              y={1.35}
              width={2.8}
              height={2.6}
              fill="none"
              stroke="#F5C542"
              strokeWidth={0.28}
            />
            <line
              x1={12.5}
              y1={3.95}
              x2={12.5}
              y2={7.1}
              stroke="#F5C542"
              strokeWidth={0.22}
              strokeDasharray="0.35 0.35"
            />
            <g
              transform={`translate(0, ${mouth === "talk" ? Math.sin(timeSec * Math.PI * 10) * 0.18 : 0})`}
              fill="#11131F"
            >
              <rect x={5.8} y={4.2} width={4.4} height={0.65} />
              <rect x={5.1} y={3.85} width={0.8} height={0.55} />
              <rect x={10.1} y={3.85} width={0.8} height={0.55} />
            </g>
          </g>
        )}

        {(mouth === "smile" || mouth === "blush") && outfit !== "gentleman" && (
          /* Clawd 经典 3 段式像素微笑弧线 ‿ */
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`} fill="#000000">
            <rect x={6.4} y={3.55} width={0.65} height={0.65} />
            <rect x={7.05} y={4.15} width={1.9} height={0.65} />
            <rect x={8.95} y={3.55} width={0.65} height={0.65} />
          </g>
        )}

        {mouth === "blush" && (
          <g
            transform={`translate(${15.2 + bodyOffsetX}, ${-0.6 + Math.sin(timeSec * Math.PI * 3) * 0.4})`}
          >
            <path
              d="M 1.4 0.6 C 1.4 0, 0 0, 0 1.0 C 0 2.0, 1.4 2.6, 1.4 3.2 C 1.4 2.6, 2.8 2.0, 2.8 1.0 C 2.8 0, 1.4 0, 1.4 0.6 Z"
              fill="#E05252"
            />
            <rect x={0.45} y={0.65} width={0.4} height={0.4} fill="#FFFFFF" />
          </g>
        )}

        {mouth === "yawn" && (
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
            <rect
              x={6.6}
              y={3.2 + (2.0 - yawnOpen) / 2}
              width={2.8}
              height={yawnOpen}
              fill="#000000"
            />
            <text
              x={15.0}
              y={0.8 - ((timeSec * 0.7) % 1) * 1.6}
              fill="#93C5FD"
              fontSize={2.1}
              fontWeight="bold"
              fontFamily="monospace"
              opacity={1 - ((timeSec * 0.7) % 1) * 0.6}
            >
              Z
            </text>
            <text
              x={16.8}
              y={-0.6 - (((timeSec * 0.7 + 0.5) % 1) * 1.4)}
              fill="#93C5FD"
              fontSize={1.5}
              fontWeight="bold"
              fontFamily="monospace"
              opacity={1 - ((timeSec * 0.7 + 0.5) % 1) * 0.6}
            >
              z
            </text>
          </g>
        )}

        {mouth === "talk" && (
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
            {outfit !== "gentleman" && (
              <rect
                x={7.0}
                y={3.65 + (1.1 - talkOpen) / 2}
                width={2.0}
                height={talkOpen}
                fill="#000000"
              />
            )}
            {showTalkBubble && (
              <g
                transform={`translate(14.5, ${-1.8 + Math.sin(timeSec * Math.PI * 4) * 0.2})`}
              >
                <rect
                  x={0}
                  y={0}
                  width={3.2}
                  height={3.2}
                  rx={0.4}
                  fill="#FFFFFF"
                  stroke="#11131F"
                  strokeWidth={0.18}
                />
                <polygon points="0.4,3.1 -0.3,3.8 1.2,3.1" fill="#FFFFFF" />
                <rect
                  x={1.35}
                  y={0.55}
                  width={0.45}
                  height={1.35}
                  fill="#000000"
                />
                <rect
                  x={1.35}
                  y={2.25}
                  width={0.45}
                  height={0.45}
                  fill="#000000"
                />
              </g>
            )}
          </g>
        )}

        {/* L009–L010 中学生白反光眼镜（从左侧旋转飞入戴在眼部，白色镜片遮住原本纯黑眼睛，深色外框清晰） */}
        {glassesProgress > 0.01 && (
          <g
            transform={`translate(${
              bodyOffsetX + interpolate(glassesProgress, [0, 1], [-9.2, 0])
            }, ${
              bodyOffsetY + interpolate(glassesProgress, [0, 1], [-1.4, 0])
            }) rotate(${
              torsoTiltDeg + interpolate(glassesProgress, [0, 1], [-28, 0])
            }, 8, 2.8)`}
            opacity={interpolate(glassesProgress, [0, 0.2, 1], [0, 1, 1])}
          >
            {/* 左右镜腿与中梁 */}
            <rect x={2.0} y={2.35} width={12.0} height={0.42} fill="#11131F" />
            {/* 左镜框与白色反光镜片（覆盖左黑眼 x=4, y=2..4） */}
            <rect
              x={2.55}
              y={1.45}
              width={3.6}
              height={2.65}
              rx={0.22}
              fill="#F8FAFC"
              stroke="#11131F"
              strokeWidth={0.34}
            />
            <polygon
              points="3.0,3.85 4.2,1.65 4.85,1.65 3.65,3.85"
              fill="#BAE6FD"
            />
            <polygon
              points="4.95,3.85 5.65,2.45 5.95,2.45 5.25,3.85"
              fill="#E0F2FE"
            />
            {/* 右镜框与白色反光镜片（覆盖右黑眼 x=11, y=2..4） */}
            <rect
              x={9.55}
              y={1.45}
              width={3.6}
              height={2.65}
              rx={0.22}
              fill="#F8FAFC"
              stroke="#11131F"
              strokeWidth={0.34}
            />
            <polygon
              points="10.0,3.85 11.2,1.65 11.85,1.65 10.65,3.85"
              fill="#BAE6FD"
            />
            <polygon
              points="11.95,3.85 12.65,2.45 12.95,2.45 12.25,3.85"
              fill="#E0F2FE"
            />
          </g>
        )}

        {/* 第 5 层：头饰与项链配件 (Outfit) */}
        {outfit === "swag" && (
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
            <rect x={0.2} y={-0.35} width={2.8} height={0.55} fill="#1F222E" />
            <path
              d="M 2.3 0.2 L 2.8 -1.4 Q 8 -2.3 13.2 -1.4 L 13.7 0.2 Z"
              fill="#1F222E"
            />
            <path
              d="M 9.1 -1.35 H 8.1 V -0.35 H 9.1"
              fill="none"
              stroke="#F5C542"
              strokeWidth={0.32}
            />
            <line
              x1={3.4}
              y1={4.2}
              x2={7.5}
              y2={5.8}
              stroke="#F5C542"
              strokeWidth={0.24}
            />
            <line
              x1={12.6}
              y1={4.2}
              x2={8.5}
              y2={5.8}
              stroke="#F5C542"
              strokeWidth={0.24}
            />
            <path
              d="M 8.6 5.95 H 7.45 V 7.25 H 8.6"
              fill="none"
              stroke="#F5C542"
              strokeWidth={0.38}
            />
          </g>
        )}

        {outfit === "gentleman" && (
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
            <rect x={1.1} y={-0.35} width={13.8} height={0.6} fill="#1E202B" />
            <rect x={3.2} y={-3.3} width={9.6} height={2.95} fill="#1E202B" />
            <rect x={3.2} y={-1.15} width={9.6} height={0.8} fill="#C93B3B" />
            <rect x={3.6} y={-3.0} width={1.8} height={0.25} fill="#94A3B8" />
          </g>
        )}

        {outfit === "party" && (
          <g transform={`translate(${bodyOffsetX}, ${bodyOffsetY})`}>
            <polygon points="8,-2.7 5.1,0.15 10.9,0.15" fill="#F5C542" />
            <polygon points="6.2,-0.9 9.8,-0.9 10.2,-0.45 5.8,-0.45" fill="#FFFFFF" />
            <rect x={7.5} y={-3.35} width={1.0} height={0.85} fill="#E04F4F" />
          </g>
        )}

        {/* 第 6 层：手持与场景道具 (Props) */}
        {prop === "coffee" && (
          <g transform={`translate(${14.3 + bodyOffsetX}, ${4.3 + rightArmOffsetY})`}>
            <rect
              x={0}
              y={0}
              width={2.6}
              height={2.3}
              fill="#F1F5F9"
              stroke="#94A3B8"
              strokeWidth={0.14}
            />
            <rect x={0.25} y={0.35} width={2.1} height={0.5} fill="#6B3E26" />
            <path
              d="M 2.6 0.55 H 3.15 V 1.65 H 2.6"
              fill="none"
              stroke="#CBD5E1"
              strokeWidth={0.28}
            />
            <rect
              x={0.8}
              y={-0.6 - ((timeSec * 1.5) % 1) * 0.9}
              width={0.4}
              height={0.4}
              fill="#E2E8F0"
              opacity={1 - ((timeSec * 1.5) % 1)}
            />
            <rect
              x={1.55}
              y={-0.4 - (((timeSec * 1.5 + 0.5) % 1) * 0.9)}
              width={0.4}
              height={0.4}
              fill="#E2E8F0"
              opacity={1 - ((timeSec * 1.5 + 0.5) % 1)}
            />
          </g>
        )}

        {prop === "book" && (() => {
          const bp = bookProgress !== undefined ? bookProgress : 1;
          if (bp <= 0.01) return null;
          const bx = interpolate(bp, [0, 1], [6.8, 0]);
          const by = interpolate(bp, [0, 1], [4.8, 0]);
          const bRot = interpolate(bp, [0, 1], [15, 0]);
          const bOp = interpolate(bp, [0, 0.2, 1], [0, 1, 1]);
          return (
            <g
              transform={`translate(${bodyOffsetX + bx}, ${
                bodyOffsetY + by
              }) rotate(${bRot}, 8, 5.8)`}
              opacity={bOp}
            >
              <rect x={2.9} y={4.0} width={10.2} height={3.5} fill="#7C5236" />
              <rect x={3.3} y={4.25} width={4.5} height={2.95} fill="#F5F2EB" />
              <rect x={8.2} y={4.25} width={4.5} height={2.95} fill="#F5F2EB" />
              {[4.8, 5.5, 6.2].map((ly) => (
                <React.Fragment key={ly}>
                  <rect x={3.8} y={ly} width={3.4} height={0.22} fill="#94A3B8" />
                  <rect x={8.7} y={ly} width={3.4} height={0.22} fill="#94A3B8" />
                </React.Fragment>
              ))}
              <rect x={7.75} y={7.15} width={0.5} height={0.9} fill="#E04F4F" />
              <rect x={2.3} y={4.7} width={1.3} height={1.8} fill="#B85D3D" />
              <rect x={12.4} y={4.7} width={1.3} height={1.8} fill="#B85D3D" />
            </g>
          );
        })()}

        {/* L011 铜管部小号入场、前足接住、抬起吹奏与放低送出 */}
        {prop === "trumpet" && (() => {
          const tp = trumpetProgress !== undefined ? trumpetProgress : p;
          // 0~0.22: 从右侧滑入接住；0.22~0.76: 抬到脸前吹奏（喇叭口轻摆+飘出1~2枚几何音符）；0.76~1.0: 放低向右侧送出
          const enterOut = interpolate(
            tp,
            [0, 0.22, 0.76, 1],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          if (enterOut <= 0.01) return null;
          const isPlaying = tp >= 0.22 && tp <= 0.76;
          const playPhase = isPlaying ? (tp - 0.22) / 0.54 : 0;
          const bellSway = isPlaying
            ? Math.sin(playPhase * Math.PI * 2) * -6.5
            : interpolate(tp, [0.76, 1], [0, 14], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
          const tx = interpolate(enterOut, [0, 1], [7.2, 0]);
          const ty = interpolate(enterOut, [0, 1], [1.4, 0]);

          return (
            <g
              transform={`translate(${bodyOffsetX + tx}, ${
                bodyOffsetY + ty
              }) rotate(${bellSway}, 9.5, 4.2)`}
              opacity={interpolate(enterOut, [0, 0.2, 1], [0, 1, 1])}
            >
              {/* 吹嘴与主号管 */}
              <rect x={8.6} y={3.85} width={1.2} height={0.55} fill="#E2E8F0" />
              <rect
                x={9.6}
                y={3.75}
                width={5.6}
                height={0.75}
                fill="#F5C542"
                stroke="#11131F"
                strokeWidth={0.18}
              />
              {/* 活塞按键与下部回管 */}
              <rect x={11.1} y={3.15} width={0.42} height={0.65} fill="#FEF08A" />
              <rect x={11.8} y={3.15} width={0.42} height={0.65} fill="#FEF08A" />
              <rect x={12.5} y={3.15} width={0.42} height={0.65} fill="#FEF08A" />
              <rect
                x={10.6}
                y={4.5}
                width={3.6}
                height={0.85}
                rx={0.35}
                fill="none"
                stroke="#D97706"
                strokeWidth={0.28}
              />
              {/* 右侧喇叭口 (Bell) */}
              <polygon
                points="15.0,3.65 17.6,2.35 17.6,5.85 15.0,4.55"
                fill="#F5C542"
                stroke="#11131F"
                strokeWidth={0.22}
                strokeLinejoin="round"
              />
              <ellipse cx={17.55} cy={4.1} rx={0.35} ry={1.65} fill="#B45309" />
              {/* Clawd 前足握持小号 */}
              <rect
                x={11.2}
                y={4.35}
                width={1.5}
                height={1.25}
                fill={bodyColor}
                stroke="#11131F"
                strokeWidth={0.18}
              />
              {/* 吹奏期间飘出的两枚短暂几何音符 */}
              {isPlaying &&
                [
                  { delay: 0.05, color: "#38BDF8", dy: -1.6 },
                  { delay: 0.32, color: "#F472B6", dy: -2.8 },
                ].map((n, idx) => {
                  const np = Math.max(
                    0,
                    Math.min(1, (playPhase - n.delay) / 0.55),
                  );
                  if (np <= 0 || np >= 1) return null;
                  return (
                    <g
                      key={idx}
                      transform={`translate(${18.2 + np * 2.6}, ${
                        3.6 + n.dy * np
                      })`}
                      opacity={Math.sin(np * Math.PI)}
                      fill={n.color}
                    >
                      <rect x={0} y={0.75} width={0.75} height={0.65} />
                      <rect x={0.5} y={-0.45} width={0.28} height={1.3} />
                      <rect x={0.5} y={-0.45} width={0.7} height={0.32} />
                    </g>
                  );
                })}
            </g>
          );
        })()}

        {prop === "juggle" && (
          <g>
            {[
              { color: "#F5C542", offset: 0 },
              { color: "#8EC5FC", offset: 0.333 },
              { color: "#E05A5A", offset: 0.666 },
            ].map((ball, idx) => {
              const t = (timeSec * 0.9 + ball.offset) % 1;
              const angle = t * Math.PI * 2;
              const bx = 8 + Math.cos(angle) * 6.8 + bodyOffsetX;
              const by =
                1.8 - Math.abs(Math.sin(angle)) * 3.2 + bodyOffsetY * 0.5;
              return (
                <g key={idx} transform={`translate(${bx}, ${by})`}>
                  <circle cx={0} cy={0} r={1.05} fill={ball.color} />
                  <rect
                    x={-0.45}
                    y={-0.55}
                    width={0.35}
                    height={0.35}
                    fill="#FFFFFF"
                  />
                </g>
              );
            })}
          </g>
        )}

        {prop === "dj" && (
          <g>
            <rect x={-1.8} y={6.2} width={19.6} height={4.5} fill="#585E74" />
            <rect x={-1.8} y={5.6} width={19.6} height={0.75} fill="#383C4C" />
            <ellipse cx={2.2} cy={5.8} rx={2.6} ry={1.45} fill="#1E202B" />
            <ellipse cx={2.2} cy={5.8} rx={1.1} ry={0.6} fill="#F4A2B8" />
            <ellipse cx={13.8} cy={5.8} rx={2.6} ry={1.45} fill="#1E202B" />
            <ellipse cx={13.8} cy={5.8} rx={1.1} ry={0.6} fill="#93C5FD" />
            <rect
              x={1.2}
              y={4.2 + leftArmOffsetY}
              width={2.2}
              height={1.6}
              fill={bodyColor}
            />
            <rect
              x={12.6}
              y={4.2 + rightArmOffsetY}
              width={2.2}
              height={1.6}
              fill={bodyColor}
            />
            <text
              x={8}
              y={8.6}
              textAnchor="middle"
              fill="#F5C542"
              fontSize={1.9}
              fontWeight="bold"
              fontFamily="monospace"
            >
              DJ
            </text>
            <rect x={-0.8} y={9.4} width={0.5} height={0.5} fill="#4ADE80" />
            <rect x={0.0} y={9.4} width={0.5} height={0.5} fill="#FACC15" />
            <rect x={0.8} y={9.4} width={0.5} height={0.5} fill="#F87171" />
            <rect x={14.7} y={9.4} width={0.5} height={0.5} fill="#4ADE80" />
            <rect x={15.5} y={9.4} width={0.5} height={0.5} fill="#FACC15" />
            <rect x={16.3} y={9.4} width={0.5} height={0.5} fill="#F87171" />
            {[
              { color: "#F5C542", delay: 0, dx: 15.2 },
              { color: "#F4A2B8", delay: 0.33, dx: 16.8 },
              { color: "#93C5FD", delay: 0.66, dx: 18.2 },
            ].map((note, idx) => {
              const p = (timeSec * 0.8 + note.delay) % 1;
              const ny = 4.2 - p * 5.2;
              return (
                <g
                  key={idx}
                  transform={`translate(${note.dx}, ${ny})`}
                  opacity={1 - p * 0.7}
                  fill={note.color}
                >
                  <rect x={0} y={0.8} width={0.8} height={0.7} />
                  <rect x={0.55} y={-0.5} width={0.3} height={1.4} />
                  <rect x={0.55} y={-0.5} width={0.75} height={0.35} />
                </g>
              );
            })}
          </g>
        )}
      </g>

      {/* 可选第 7 层：16×10 正方形像素网格 & 16×5 终端字符行辅助线 */}
      {showGrid && (
        <g pointerEvents="none">
          {Array.from({ length: 17 }).map((_, col) => (
            <line
              key={`v-${col}`}
              x1={col}
              y1={0}
              x2={col}
              y2={10}
              stroke="rgba(56, 189, 248, 0.35)"
              strokeWidth={col % 2 === 0 ? 0.05 : 0.025}
            />
          ))}
          {Array.from({ length: 11 }).map((_, row) => (
            <line
              key={`h-${row}`}
              x1={0}
              y1={row}
              x2={16}
              y2={row}
              stroke={
                row % 2 === 0
                  ? "rgba(250, 204, 21, 0.55)"
                  : "rgba(56, 189, 248, 0.28)"
              }
              strokeWidth={row % 2 === 0 ? 0.06 : 0.025}
            />
          ))}
          <rect
            x={0}
            y={0}
            width={16}
            height={10}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={0.07}
          />
        </g>
      )}
    </svg>
  );
};
