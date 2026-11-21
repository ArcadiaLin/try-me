/**
 * 《Try Me》MV 前景漫画与道具色板（D032：汽水糖果 Pop Palette）
 *
 * 约定见 AGENTS.md「视觉与动效风格基调」：
 * - Clawd 本体陶土橙（CLAWD_TERRACOTTA）留给角色与终端强调，前景波普元素不大面积使用；
 * - 舞台底色、终端中性色与冷灰金属工具保持独立，不纳入本色板。
 */

export const CLAWD_TERRACOTTA = "#D87757" as const;

export const POP_PALETTE = {
  /** 墨线与硬投影（略带紫调的深墨黑） */
  ink: "#22182E",

  /** 暖奶油纸底与贴纸内描边 */
  cream: "#FFF0D0",
  creamLight: "#FFF7E6",

  /** 蛋黄核心强调色系 */
  yellow: "#FFC83D",
  yellowLight: "#FFE3A0",
  yellowDeep: "#FFB830",
  amber: "#FFB02E",
  amberMid: "#F5A524",
  orange: "#FF9F45",

  /** 泡泡糖粉强调色系 */
  pink: "#FF7FB0",
  pinkLight: "#FF8CC6",

  /** 薄荷汽水青强调色系 */
  mint: "#3ED6C5",
  mintDeep: "#159C8E",
  mintLight: "#8DE8DC",

  /** 青柠绿（终端/代码类点缀） */
  lime: "#A6E86B",

  /** 喊叫类拟声字专用朱红（稀缺最强重音色，配 cream 贴纸描边） */
  shoutRed: "#FF4B2B",
  shoutRedLight: "#FF5A3C",
} as const;
