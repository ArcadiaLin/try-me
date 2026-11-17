/**
 * Clawd 角色几何比例、颜色、关节锚点与外部道具挂点常量
 *
 * 坐标系基于 16×10 正方形像素网格（对应 16×5 终端半块字符 `▐▛███▜▌ / ▝▜█████▛▘ / ▘▘ ▝▝`）。
 */
export const CLAWD_MODEL = {
  grid: {
    width: 16,
    height: 10,
    padX: 3.2,
    padTop: 3.8,
    padBottom: 1.8,
  },
  colors: {
    body: "#D87757",
    eye: "#000000",
    outline: "#11131F",
    blush: "#F48FB1",
    sweatFill: "#38BDF8",
    sweatHighlight: "#E0F2FE",
  },
  defaultOutlineWidth: 0.18,
  /** 躯干基础矩形: x=2..14 (w=12), y=0..8 (h=8) */
  torso: {
    x: 2,
    y: 0,
    width: 12,
    height: 8,
  },
  /** 双臂与四足根部深入躯干内部的锚点深度，防止歪头/侧倾时肢体断裂 */
  joints: {
    armInset: 1.6,
    hipInset: 1.4,
    armBaseY: 4,
    armBaseWidth: 2,
    armHeight: 2,
    centerPivotX: 8,
    stumbleLeftPivotX: 4.5,
    hipPivotY: 8,
    groundY: 10,
    legBaseX: [3, 5, 10, 12] as const,
  },
  /** 双眼基础坐标 */
  eyes: {
    leftX: 4,
    rightX: 11,
    baseY: 2,
    normalWidth: 1,
    normalHeight: 2,
    happyFlatWidth: 1.55,
    happyFlatHeight: 1.15,
    yawnWidth: 1.65,
    yawnHeight: 0.38,
  },
  /** 服装与手持道具挂点 */
  attachments: {
    glassesPivot: { x: 8, y: 2.8 },
    bookPivot: { x: 8, y: 5.8 },
    trumpetPivot: { x: 9.5, y: 4.2 },
    coffeeAnchor: { x: 14.3, y: 4.3 },
    talkBubbleOffset: { x: 14.5, y: -1.8 },
  },
} as const;

export function getClawdViewBox() {
  const { width, height, padX, padTop, padBottom } = CLAWD_MODEL.grid;
  const viewBoxWidth = width + padX * 2;
  const viewBoxHeight = height + padTop + padBottom;
  return {
    minX: -padX,
    minY: -padTop,
    viewBoxWidth,
    viewBoxHeight,
    viewBoxString: `${-padX} ${-padTop} ${viewBoxWidth} ${viewBoxHeight}`,
  };
}
