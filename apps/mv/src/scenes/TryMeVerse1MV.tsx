import React from "react";
import {
  AbsoluteFill,
  Composition,
  getStaticFiles,
  Html5Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  ClawdMascot,
  getStumbleLeftKinematics,
  type ClawdAction,
  type ClawdEyes,
  type ClawdProp,
} from "../components/ClawdMascot";

export interface TryMeVerse1MVProps {
  /** 是否强制静音预览（未放置私有 FLAC 音源时也会自动降级为静音预览） */
  silentPreview?: boolean;
  /** 是否显示底部紧凑字幕与时间轴辅助栏（方便核对连贯过渡与卡点） */
  showHud?: boolean;
}

/** 截至 L065 (ほら！) 句后留白结束、L013 开始前的完整时长：55.168s (1655 帧 @ 30fps) */
export const VERSE1_MV_DURATION_SEC = 55.168;
export const VERSE1_MV_FPS = 30;
export const VERSE1_MV_FRAMES = Math.round(
  VERSE1_MV_DURATION_SEC * VERSE1_MV_FPS,
); // 1655

interface Verse1EventMeta {
  id: string;
  startSec: number;
  endSec: number;
  lyric: string;
  summary: string;
}

const VERSE1_EVENTS: Verse1EventMeta[] = [
  {
    id: "L066",
    startSec: 0.0,
    endSec: 18.224,
    lyric: "(Intro — 前奏合成器律动)",
    summary: "呼吸眨眼待机 → 贴地左右换重心",
  },
  {
    id: "L001",
    startSec: 18.525,
    endSec: 22.721,
    lyric: "Hey, let's go, I can take it",
    summary: "看向观众短挥手 → 重心前送 → 自信小幅蹲起",
  },
  {
    id: "L002",
    startSec: 22.721,
    endSec: 25.221,
    lyric: "What do you want to know?",
    summary: "轻侧身歪头 + 前足邀请提问 → 留白停顿与视线回正",
  },
  {
    id: "L003",
    startSec: 27.161,
    endSec: 31.695,
    lyric: "得意なことを",
    summary: "收拢姿态 → 抬头挺身 → 两次差幅点头",
  },
  {
    id: "L004",
    startSec: 31.695,
    endSec: 34.026,
    lyric: "自己アピール",
    summary: "前足朝胸口示意 → 向外展开展示 → 平滑回稳",
  },
  {
    id: "L064",
    startSec: 34.026,
    endSec: 36.371,
    lyric: "(间奏 — 蹲下缩入后台待命)",
    summary: "贴地蹲起 → 缩小钻入地面命令行待命框 [ > _ ]",
  },
  {
    id: "L005",
    startSec: 36.371,
    endSec: 38.429,
    lyric: "I can appear as and when you need",
    summary: "Web / Desktop / CLI 三端依次唤出 → 从终端跃出至左侧落地左倾踉跄 (> <)",
  },
  {
    id: "L006",
    startSec: 38.429,
    endSec: 40.828,
    lyric: "365日",
    summary: "稳住重心看向右侧 GitHub 热力图 (1→365) → 句尾「日」字轻快双拍明显点头",
  },
  {
    id: "L007",
    startSec: 40.8,
    endSec: 42.91,
    lyric: "I speak different languages",
    summary: "五行气泡四语同时打字推进 + 第五行 ...（Clawd 不张嘴）",
  },
  {
    id: "L008",
    startSec: 42.91,
    endSec: 45.151,
    lyric: "And people get what I mean",
    summary: "气泡平滑移至正上方 + 两侧极简听众滑入点头回应 → 退场",
  },
  {
    id: "L009",
    startSec: 45.36,
    endSec: 47.58,
    lyric: "中学生の頃は",
    summary: "左旋入白反光眼镜 + 右下升起书本 + 背后深绿预训练参数场",
  },
  {
    id: "L010",
    startSec: 47.58,
    endSec: 49.892,
    lyric: "I was the best in every class",
    summary: "三项能力符号汇成 TOP CLASS 小奖章 + 抬头挺身 → 原向清场",
  },
  {
    id: "L011",
    startSec: 49.892,
    endSec: 52.576,
    lyric: "ブラバン部で楽器も吹けるよ",
    summary: "小号从右滑入接住 → 抬起吹奏飘出音符 → 放低向右送出",
  },
  {
    id: "L065",
    startSec: 52.576,
    endSec: 53.549,
    lyric: "(ほら！)",
    summary: "极速贴地回弹 + ^ ^ 微笑弯眼 + 右上红底黄边手写『ほら！』",
  },
];

const MULTILANG_LINES = [
  {
    lang: "EN",
    text: "I speak different languages",
    color: "#38BDF8",
  },
  {
    lang: "ZH",
    text: "我会说不同的语言",
    color: "#F59E0B",
  },
  {
    lang: "JA",
    text: "いろんな言葉が話せるよ",
    color: "#F472B6",
  },
  {
    lang: "ES",
    text: "Hablo diferentes idiomas",
    color: "#4ADE80",
  },
];

const GITHUB_HEAT_COLORS = [
  "#0E4429", // Level 1: 深林绿
  "#006D32", // Level 2: 祖母绿
  "#26A641", // Level 3: 鲜亮绿
  "#39D353", // Level 4: 荧光高光绿
] as const;

const GITHUB_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** 确定性伪随机每天热力等级 (0~3)，保证 Remotion 逐帧渲染无闪烁且每天深浅自然错落 */
function getContributionLevel(cellIndex: number): 0 | 1 | 2 | 3 {
  const hash = (((cellIndex + 1) * 2654435761) >>> 0) % 100;
  if (hash < 20) return 0;
  if (hash < 52) return 1;
  if (hash < 80) return 2;
  return 3;
}

const PARAM_TOKENS = [
  "∇W₁",
  "attn",
  "0.04",
  "qkv",
  "mlp",
  "-0.12",
  "norm",
  "0.87",
  "ffn",
  "loss↓",
  "emb",
  "0.01",
];

function hasPrivateAudio(): boolean {
  return getStaticFiles().some(
    (file) => file.name.replace(/\\/g, "/") === "private/audio/try-me.flac",
  );
}

/** 归一化线性进度 (0 ~ 1) */
function linearProg(sec: number, start: number, end: number): number {
  return Math.max(0, Math.min(1, (sec - start) / Math.max(0.0001, end - start)));
}

/** Hermite 平滑阶跃 (C1 连续，首尾速度均为 0) */
function smoothStep(sec: number, start: number, end: number): number {
  const t = linearProg(sec, start, end);
  return t * t * (3 - 2 * t);
}

function formatSec(sec: number): string {
  const mins = Math.floor(sec / 60);
  const rem = sec - mins * 60;
  return `${String(mins).padStart(2, "0")}:${rem.toFixed(2).padStart(5, "0")}`;
}

export const TryMeVerse1MV: React.FC<TryMeVerse1MVProps> = ({
  silentPreview = false,
  showHud = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;

  const canPlayAudio = !silentPreview && hasPrivateAudio();

  // ==================== 1. 连续舞台位置 (clawdStageX / Y / Scale / Opacity) 与视线动作平滑编排 ====================
  // 通过连续数学插值驱动唯一 Clawd 实例：含 L064 缩入后台待命 -> L005 终端内唤出 -> 跃出至左侧落地左倾踉跄 (> <) -> L006 365日
  let clawdStageX = 0;
  let clawdStageY = 0;
  let clawdStageScale = 1;
  let clawdStageOpacity = 1;
  let clawdZIndex = 3;

  if (sec >= 35.34 && sec < 37.54) {
    // L064 强拍 (35.341s C_BEAT_0063): 蹲下并缩小钻进地面中央的 [ > _ ] 待命框，等待 L005 三端卡拍召唤
    const shrinkT = smoothStep(sec, 35.341, 35.82);
    clawdStageX = 0;
    clawdStageY = shrinkT * 36;
    clawdStageScale = interpolate(shrinkT, [0, 0.4, 1], [1, 1.06, 0.08]);
    clawdStageOpacity = interpolate(shrinkT, [0, 0.72, 1], [1, 1, 0]);
  } else if (sec >= 37.54 && sec < 37.837) {
    // L005 第三端 (37.581s C_BEAT_0067): Clawd 出现在 Claude Code 终端窗口内部左侧（还原真实 CLI 欢迎界面布局）
    const popInTerm = smoothStep(sec, 37.54, 37.66);
    clawdStageX = 42;
    clawdStageY = -263;
    clawdStageScale = interpolate(popInTerm, [0, 0.75, 1], [0.1, 0.3, 0.28]);
    clawdStageOpacity = interpolate(popInTerm, [0, 0.35, 1], [0, 1, 1]);
    clawdZIndex = 6;
  } else if (sec >= 37.837 && sec < 38.139) {
    // L005 句尾跳跃 (37.837s C_ONSET_0190 -> 38.139s C_BEAT_0068): 从终端内部左侧 (+42, -263) 跳落至偏左一点的初始落点 (-105, 0)
    const jumpT = linearProg(sec, 37.837, 38.139);
    clawdStageX = interpolate(jumpT, [0, 1], [42, -105]);
    const startY = -263;
    const linearY = startY * (1 - jumpT);
    const arcLift = -115 * 4 * jumpT * (1 - jumpT);
    clawdStageY = linearY + arcLift;
    clawdStageScale = interpolate(jumpT, [0, 0.65, 1], [0.28, 0.86, 1.0]);
    clawdZIndex = 6;
  } else if (sec >= 38.139 && sec < 45.2) {
    // 38.139s (C_BEAT_0068) ~ 39.20s: 从初始落点 (-105px) 靠左两足一踮一踮向左连续跳三小跳 (-105 -> -150 -> -179 -> -195)，
    // 三跳步幅 (45px / 29px / 16px) 与弹跳高度 (100% / 62% / 32%) 依次递减，触地瞬间 X 坐标 100% 锁死不滑步！
    let baseX = -195;
    if (sec < 39.2) {
      const stumbleP = linearProg(sec, 38.139, 39.2);
      const { hopArc, hopHeightRatio, currentXRatio } =
        getStumbleLeftKinematics(stumbleP);
      baseX = -105 + (-195 - -105) * currentXRatio;
      clawdStageY = -34 * hopArc * hopHeightRatio;
    }
    const toL007 = smoothStep(sec, 40.35, 41.05); // L006 退场后微调让出五行大气泡 (-195 -> -215)
    const toL008 = smoothStep(sec, 42.75, 43.38); // L008 气泡升至头顶，Clawd 回到舞台正中 (-215 -> 0)
    clawdStageX = baseX - 20 * toL007 + 215 * toL008;
  } else if (sec >= 49.82 && sec < 55.0) {
    const toL011 = smoothStep(sec, 49.82, 50.38); // L011 略偏左迎接右侧滑入的小号 (0 -> -44)
    const toL065 = smoothStep(sec, 52.1, 52.56); // L065 ほら！略微回中 (-44 -> -24)
    const toCenter = smoothStep(sec, 54.0, 54.85); // ほら！留白期回到正中 (-24 -> 0)
    clawdStageX = -44 * toL011 + 20 * toL065 + 24 * toCenter;
  }

  // ==================== 2. Clawd 本体动作 (action / actionProgress / eyes / prop) ====================
  let action: ClawdAction = "idle";
  let actionProgress = 0;
  let eyes: ClawdEyes = "normal";
  let prop: ClawdProp = "none";
  let glassesProgress = 0;
  let bookProgress = 0;
  let trumpetProgress = 0;
  let beatPulse = 0;
  let lookOffset = { x: 0, y: 0 };

  if (sec < 5.2) {
    // L066 前奏初段：纯呼吸与眨眼看向观众
    action = "idle";
  } else if (sec < 18.525) {
    // L066 前奏中后段：4 个完整周期的贴地左右重心转移，并在 18.525s 整周期平滑归零
    action = "weight-shift";
    const shiftRaw = linearProg(sec, 5.2, 18.525);
    actionProgress = (shiftRaw * 4) % 1;
  } else if (sec < 22.721) {
    // L001: 短挥手 -> 重心前送 -> 自信小幅蹲起
    action = "wave-step";
    actionProgress = linearProg(sec, 18.525, 22.721);
  } else if (sec < 27.161) {
    // L002 (含 25.221~27.161s 留白): 侧身歪头邀请提问 -> 停顿 -> 视线与身体回正
    action = "tilt-invite";
    actionProgress = linearProg(sec, 22.721, 27.161);
  } else if (sec < 31.695) {
    // L003: 收拢姿态 -> 抬头挺身 -> 两次差幅点头 -> 回正
    action = "posture-nod";
    actionProgress = linearProg(sec, 27.161, 31.695);
  } else if (sec < 34.026) {
    // L004: 前足朝自己示意 -> 向外展开 -> 平滑回正
    action = "self-present";
    actionProgress = linearProg(sec, 31.695, 34.026);
  } else if (sec < 36.371) {
    // L064 间奏: 先做一次贴地蹲起 (34.026~35.341s)，随后在强拍下蹲缩入地面待命框
    action = "crouch-lean";
    actionProgress = linearProg(sec, 34.026, 35.82) * 0.65;
  } else if (sec < 37.837) {
    // L005 终端内亮相阶段 (37.54~37.837s): 还原真实 Claude Code 终端左侧静止像素形象
    action = "idle";
    actionProgress = linearProg(sec, 37.54, 37.837);
    eyes = "normal";
  } else if (sec < 38.139) {
    // L005 句尾跳跃腾空阶段 (37.837~38.139s): 从终端左侧跃向舞台左侧地面
    action = "bounce";
    actionProgress = linearProg(sec, 37.837, 38.139);
    lookOffset = { x: -0.35, y: 0.15 };
  } else if (sec < 39.2) {
    // 落地单侧踮脚跳三下阶段 (38.139~39.20s): 左侧两足踮脚跳三下 + 右侧两足直接悬空 + 前肢快速上下摆动 + > < 眼 + 掉汗滴
    action = "stumble-left";
    actionProgress = linearProg(sec, 38.139, 39.2);
    eyes = sec < 39.1 ? "wince" : "normal";
  } else if (sec < 40.8) {
    // L006 (365日): 39.20s 完全站稳看向右侧 GitHub 热力图，在「日」字拍点 (39.776~40.356s) 做明显的双拍弹性点头！
    const nodWindow = sec >= 39.74 && sec <= 40.42;
    action = nodWindow ? "snappy-nod" : "idle";
    actionProgress = nodWindow
      ? linearProg(sec, 39.74, 40.42)
      : linearProg(sec, 39.2, 40.8);
    eyes = sec >= 39.76 && sec <= 40.4 ? "happy" : "normal";
    lookOffset = {
      x: interpolate(
        sec,
        [39.2, 39.32, 40.35, 40.8],
        [0.48, 0.52, 0.52, 0.42],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      ),
      y: interpolate(
        sec,
        [39.2, 40.35, 40.8],
        [-0.05, -0.05, -0.18],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      ),
    };
  } else if (sec < 42.91) {
    // L007 (I speak different languages): 不张嘴，温和换重心并以眼神配合右上方五行气泡
    action = "weight-shift";
    actionProgress = linearProg(sec, 40.8, 42.91);
    lookOffset = { x: 0.42, y: -0.18 };
  } else if (sec < 45.36) {
    // L008 (And people get what I mean): 眼神先后看向左右听众，随后弯眼 (^ ^) 点头回应
    const replyWindow = sec >= 43.95 && sec <= 44.72;
    action = replyWindow ? "posture-nod" : "idle";
    actionProgress = replyWindow
      ? 0.62 + linearProg(sec, 43.95, 44.72) * 0.22
      : linearProg(sec, 42.91, 45.36);
    eyes = sec >= 43.88 && sec <= 44.92 ? "happy" : "normal";
    lookOffset = {
      x: interpolate(
        sec,
        [42.91, 43.35, 43.75, 43.95, 44.35, 44.75, 45.36],
        [0.42, -0.32, -0.32, 0.32, 0.32, 0, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      ),
      y: interpolate(
        sec,
        [42.91, 43.35, 44.75, 45.36],
        [-0.18, -0.06, -0.06, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      ),
    };
  } else if (sec < 49.892) {
    // L009 (45.360~47.580s) 与 L010 (47.580~49.892s) 跨句连续读书 -> 抬头挺身 -> 原向清场
    action = "read-look-up";
    actionProgress =
      sec < 47.58
        ? linearProg(sec, 45.36, 47.58) * 0.56
        : 0.56 + linearProg(sec, 47.58, 49.892) * 0.44;
    prop = "book";
    glassesProgress =
      sec < 47.58
        ? smoothStep(sec, 45.38, 46.02)
        : 1 - smoothStep(sec, 49.18, 49.82);
    bookProgress =
      sec < 47.58
        ? smoothStep(sec, 45.82, 46.45)
        : 1 - smoothStep(sec, 49.08, 49.72);
  } else if (sec < 52.576) {
    // L011 (ブラバン部で楽器も吹けるよ): 小号从右滑入接住 -> 抬起吹奏 -> 放低向右送出
    const p11 = linearProg(sec, 49.892, 52.576);
    action = "idle";
    actionProgress = p11;
    prop = "trumpet";
    trumpetProgress = p11;
    if (p11 >= 0.22 && p11 <= 0.76) {
      const playT = (p11 - 0.22) / 0.54;
      beatPulse = Math.sin(playT * Math.PI) * 0.24;
    }
    lookOffset = {
      x:
        0.28 *
        smoothStep(sec, 49.892, 50.35) *
        (1 - smoothStep(sec, 52.05, 52.55)),
      y:
        -0.08 *
        smoothStep(sec, 49.892, 50.35) *
        (1 - smoothStep(sec, 52.05, 52.55)),
    };
  } else {
    // L065 (52.576~55.168s, 含句后留白): 贴地极速回弹 + ^ ^ 微笑弯眼 -> 留白期平滑恢复待机
    // 以 1.90s 为弹性动作基准窗口，使 0.14~0.21 的快速弹起恰好落在 52.84~52.97s 的『ほら！』重音处
    const popProg = linearProg(sec, 52.576, 54.476);
    action = "elastic-pop";
    actionProgress = popProg;
    eyes = sec >= 52.83 && sec <= 54.68 ? "happy" : "normal";
  }

  // 当前激活的歌词事件（用于底部紧凑字幕栏）
  const activeEvent =
    VERSE1_EVENTS.find((ev) => sec >= ev.startSec && sec < ev.endSec) ??
    VERSE1_EVENTS.slice()
      .reverse()
      .find((ev) => sec >= ev.startSec) ??
    VERSE1_EVENTS[0];

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 44%, #1E1C2A 0%, #12111A 68%, #0B0B11 100%)",
        color: "#F8FAFC",
        fontFamily:
          '"Inter", "Noto Sans SC", "Hiragino Sans", "Microsoft YaHei", sans-serif',
        overflow: "hidden",
      }}
    >
      {/* 私有音源同步播放（若无私有文件或开启 silentPreview 则自动静音复现） */}
      {canPlayAudio && (
        <Html5Audio
          src={staticFile("private/audio/try-me.flac")}
          trimBefore={0}
        />
      )}

      {/* ==================== 舞台背景环境与连续地面基线 ==================== */}
      {/* 跟随 Clawd 水平重心的柔和舞台追光 */}
      <div
        style={{
          position: "absolute",
          left: `calc(50% + ${clawdStageX * 0.65}px)`,
          top: 320,
          width: 680,
          height: 420,
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(ellipse at center, rgba(216, 119, 87, 0.11) 0%, rgba(56, 189, 248, 0.04) 48%, rgba(0, 0, 0, 0) 75%)",
          pointerEvents: "none",
        }}
      />

      {/* 舞台地面平台与像素刻度线（Clawd 四足严格锚定于 bottom: 195px 地面线） */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 195,
          background:
            "linear-gradient(180deg, rgba(24, 24, 38, 0.55) 0%, rgba(12, 13, 21, 0.92) 100%)",
          borderTop: "2px solid rgba(148, 163, 184, 0.22)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 140,
            right: 140,
            borderTop: "1px dashed rgba(148, 163, 184, 0.16)",
          }}
        />
      </div>

      {/* ==================== L009–L010: Clawd 背后中心区域无边框、四周渐淡的深绿色半透明预训练参数矩阵背景 ==================== */}
      {sec >= 45.32 && sec <= 49.92 && (() => {
        const fieldOpacity =
          smoothStep(sec, 45.34, 46.12) * (1 - smoothStep(sec, 49.15, 49.88));
        const trainElapsed = Math.max(0, sec - 45.32);
        const wavePos = (trainElapsed * 0.58) % 1;
        const stepTick = Math.floor(trainElapsed * 11);

        return (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 315,
              width: 820,
              height: 450,
              transform: "translate(-50%, -50%)",
              opacity: fieldOpacity,
              zIndex: 1,
              pointerEvents: "none",
              background:
                "radial-gradient(ellipse 68% 66% at 50% 52%, rgba(6, 78, 59, 0.78) 0%, rgba(6, 78, 59, 0.42) 50%, rgba(6, 78, 59, 0) 92%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 66% 64% at 50% 52%, rgba(0,0,0,1) 18%, rgba(0,0,0,0.58) 54%, rgba(0,0,0,0) 90%)",
              maskImage:
                "radial-gradient(ellipse 66% 64% at 50% 52%, rgba(0,0,0,1) 18%, rgba(0,0,0,0.58) 54%, rgba(0,0,0,0) 90%)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            {/* 底层：神经网络层间权重连线 + 前向/反向梯度传播波 + Loss 下降收敛曲线 */}
            <svg
              width={740}
              height={390}
              viewBox="0 0 740 390"
              style={{ position: "absolute", inset: 0 }}
            >
              {[86, 228, 370, 512, 654].map((lx, colIdx) =>
                [64, 148, 232, 316].map((ly, rowIdx) => {
                  const nextX = lx + 142;
                  if (colIdx >= 4) return null;
                  const edgeActive =
                    Math.abs(colIdx / 4 - wavePos) < 0.26 ||
                    (stepTick + colIdx + rowIdx) % 3 === 0;
                  return (
                    <g key={`edge-${colIdx}-${rowIdx}`}>
                      <line
                        x1={lx}
                        y1={ly}
                        x2={nextX}
                        y2={64 + ((rowIdx + 1) % 4) * 84}
                        stroke={
                          edgeActive
                            ? "rgba(52, 211, 153, 0.36)"
                            : "rgba(16, 185, 129, 0.13)"
                        }
                        strokeWidth={edgeActive ? 2.4 : 1.3}
                      />
                      <line
                        x1={lx}
                        y1={ly}
                        x2={nextX}
                        y2={ly}
                        stroke="rgba(16, 185, 129, 0.17)"
                        strokeWidth={1.3}
                        strokeDasharray="5 5"
                      />
                    </g>
                  );
                }),
              )}

              {/* 梯度扫描光带 */}
              <rect
                x={40 + wavePos * 640}
                y={24}
                width={76}
                height={342}
                fill="rgba(52, 211, 153, 0.14)"
              />

              {/* 预训练 Loss 衰减收敛折线 */}
              <polyline
                fill="none"
                stroke="rgba(110, 231, 183, 0.45)"
                strokeWidth={3.2}
                points="56,74 158,142 264,192 372,232 482,262 590,280 684,290"
              />
            </svg>

            {/* 表层：8×5 复杂参数张量矩阵（权重热力色块 + 微缩梯度符号实时跳动） */}
            <div
              style={{
                width: 660,
                height: 326,
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gridTemplateRows: "repeat(5, 1fr)",
                gap: 8,
                padding: 12,
                fontFamily: "monospace",
              }}
            >
              {Array.from({ length: 40 }).map((_, idx) => {
                const r = Math.floor(idx / 8);
                const c = idx % 8;
                const waveDist = Math.abs((c / 7 + r / 9) * 0.5 - wavePos);
                const isWavePeak = waveDist < 0.16;
                const hashVal = (idx * 7 + stepTick * 3) % 10;
                const token =
                  PARAM_TOKENS[(idx + stepTick) % PARAM_TOKENS.length];

                return (
                  <div
                    key={idx}
                    style={{
                      borderRadius: 6,
                      backgroundColor: isWavePeak
                        ? "rgba(52, 211, 153, 0.32)"
                        : hashVal > 5
                          ? "rgba(16, 185, 129, 0.18)"
                          : "rgba(6, 95, 70, 0.24)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      padding: "2px 4px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: isWavePeak
                          ? "rgba(209, 250, 229, 0.88)"
                          : "rgba(110, 231, 183, 0.55)",
                        lineHeight: 1.1,
                      }}
                    >
                      {token}
                    </span>
                    <div
                      style={{
                        width: `${30 + hashVal * 6}%`,
                        height: 4,
                        marginTop: 5,
                        borderRadius: 2,
                        backgroundColor: isWavePeak
                          ? "rgba(167, 243, 208, 0.78)"
                          : "rgba(52, 211, 153, 0.38)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ==================== L064 尾 – L005: 地面待命框 + Web / Desktop / Claude Code 终端严格卡拍唤出 ==================== */}
      {sec >= 35.3 && sec <= 38.52 && (() => {
        // 1) L064 地面中央待命终端槽 [ > _ ] (35.341s C_BEAT_0063 ~ 37.58s)
        const dockIn = smoothStep(sec, 35.341, 35.62);
        const dockOut = smoothStep(sec, 37.3, 37.58);
        const dockOpacity = dockIn * (1 - dockOut);

        // 2) L005 第一端：Claude Web 网页版窗口 (严格对齐 Beat 1: 36.455s C_BEAT_0065)
        const webIn = smoothStep(sec, 36.42, 36.56);
        const webClawdPop = smoothStep(sec, 36.48, 36.64);
        const allCardsOut = smoothStep(sec, 38.08, 38.38);
        const webOpacity = webIn * (1 - allCardsOut);

        // 3) L005 第二端：Claude Desktop 桌面端悬浮窗 (严格对齐 Beat 2: 37.013s C_BEAT_0066)
        const deskIn = smoothStep(sec, 36.98, 37.12);
        const deskClawdPop = smoothStep(sec, 37.04, 37.2);
        const deskOpacity = deskIn * (1 - allCardsOut);

        // 4) L005 第三端：Claude Code 终端窗口 (对齐 37.303s C_ONSET_0187 弹出窗口，37.581s C_BEAT_0067 亮起欢迎界面)
        const termIn = smoothStep(sec, 37.28, 37.42);
        const termWelcomeIn = smoothStep(sec, 37.54, 37.66);
        const termOut = smoothStep(sec, 38.12, 38.42);
        const termOpacity = termIn * (1 - termOut);

        return (
          <>
            {/* 地面中央后台待命槽 [ > _ ] */}
            {dockOpacity > 0.01 && (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 148,
                  transform: `translateX(-50%) scale(${interpolate(
                    dockIn,
                    [0, 1],
                    [0.7, 1],
                  )})`,
                  opacity: dockOpacity,
                  backgroundColor: "#0D1117",
                  border: "2px solid #D87757",
                  borderRadius: 999,
                  padding: "6px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  boxShadow: "0 0 22px rgba(216, 119, 87, 0.38)",
                  fontFamily: "monospace",
                  zIndex: 4,
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    backgroundColor: "#4ADE80",
                  }}
                />
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#F8FAFC",
                    letterSpacing: 0.6,
                  }}
                >
                  {"[ > _ STANDBY ]"}
                </span>
              </div>
            )}

            {/* ① Claude Web 网页版卡片 (左上，卡拍 36.455s) */}
            {webOpacity > 0.01 && (
              <div
                style={{
                  position: "absolute",
                  left: "calc(50% - 315px)",
                  top: 214,
                  width: 248,
                  backgroundColor: "#1E293B",
                  border: "2.5px solid #475569",
                  borderRadius: 14,
                  overflow: "hidden",
                  transform: `translate(-50%, -50%) scale(${interpolate(
                    webIn,
                    [0, 1],
                    [0.82, 1],
                  )})`,
                  opacity: webOpacity,
                  boxShadow: "0 12px 28px rgba(0, 0, 0, 0.42)",
                  zIndex: 4,
                  fontFamily: "monospace",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#0F172A",
                    padding: "6px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    borderBottom: "1px solid #334155",
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      backgroundColor: "#EF4444",
                    }}
                  />
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      backgroundColor: "#F59E0B",
                    }}
                  />
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      backgroundColor: "#22C55E",
                    }}
                  />
                  <span
                    style={{
                      marginLeft: 4,
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: "#94A3B8",
                      backgroundColor: "#1E293B",
                      padding: "1px 8px",
                      borderRadius: 4,
                    }}
                  >
                    claude.ai/chat
                  </span>
                </div>
                <div
                  style={{
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#94A3B8",
                      }}
                    >
                      Claude Web
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 800,
                        color: "#F8FAFC",
                      }}
                    >
                      Ready to help ✦
                    </span>
                  </div>
                  <div
                    style={{
                      transform: `scale(${interpolate(
                        webClawdPop,
                        [0, 0.7, 1],
                        [0, 1.18, 1],
                      )})`,
                      opacity: webClawdPop,
                    }}
                  >
                    <ClawdMascot
                      width={52}
                      action="static"
                      eyes="happy"
                      autoBlink={false}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ② Claude Desktop 桌面端快捷悬浮窗 (中上，卡拍 37.013s) */}
            {deskOpacity > 0.01 && (
              <div
                style={{
                  position: "absolute",
                  left: "calc(50% - 35px)",
                  top: 132,
                  width: 266,
                  backgroundColor: "#1E1B2E",
                  border: "2.5px solid #D87757",
                  borderRadius: 14,
                  padding: "9px 14px",
                  transform: `translate(-50%, -50%) scale(${interpolate(
                    deskIn,
                    [0, 1],
                    [0.82, 1],
                  )})`,
                  opacity: deskOpacity,
                  boxShadow: "0 12px 28px rgba(0, 0, 0, 0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  zIndex: 4,
                  fontFamily: "monospace",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        color: "#0F172A",
                        backgroundColor: "#FDBA74",
                        padding: "1px 6px",
                        borderRadius: 4,
                      }}
                    >
                      Alt+Space
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: "#CBD5E1",
                      }}
                    >
                      Claude Desktop
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: "#FFF7ED",
                    }}
                  >
                    Ask anything...
                  </span>
                </div>
                <div
                  style={{
                    transform: `scale(${interpolate(
                      deskClawdPop,
                      [0, 0.7, 1],
                      [0, 1.18, 1],
                    )})`,
                    opacity: deskClawdPop,
                  }}
                >
                  <ClawdMascot
                    width={50}
                    action="static"
                    eyes="happy"
                    autoBlink={false}
                  />
                </div>
              </div>
            )}

            {/* ③ 真实 Windows Terminal 布局的 Claude Code 终端窗口 (右侧，左侧留给 Clawd 真身，无跳跃轨迹线) */}
            {termOpacity > 0.01 && (
              <div
                style={{
                  position: "absolute",
                  left: "calc(50% + 198px)",
                  top: 276,
                  width: 446,
                  height: 214,
                  backgroundColor: "#000000",
                  border: "2px solid #2D2D2D",
                  borderRadius: 12,
                  overflow: "hidden",
                  transform: `translate(-50%, -50%) scale(${interpolate(
                    termIn,
                    [0, 1],
                    [0.86, 1],
                  )})`,
                  opacity: termOpacity,
                  boxShadow: "0 18px 40px rgba(0, 0, 0, 0.65)",
                  zIndex: 4,
                  fontFamily: '"Cascadia Mono", "Consolas", monospace',
                }}
              >
                {/* Windows Terminal 标签栏 (#1F1F1F 底 + 激活态黑色圆角标签页) */}
                <div
                  style={{
                    backgroundColor: "#1F1F1F",
                    height: 36,
                    padding: "6px 10px 0 8px",
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 8,
                  }}
                >
                  {/* 激活的 Claude Code 标签 */}
                  <div
                    style={{
                      backgroundColor: "#000000",
                      height: 30,
                      padding: "0 12px",
                      borderTopLeftRadius: 8,
                      borderTopRightRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      minWidth: 196,
                    }}
                  >
                    {/* PowerShell 蓝底图标 >_ */}
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        backgroundColor: "#2563EB",
                        color: "#FFFFFF",
                        fontSize: 8.5,
                        fontWeight: 900,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {">_"}
                    </span>
                    {/* 绿底星号图标 ✳ */}
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 2.5,
                        backgroundColor: "#16A34A",
                        color: "#FFFFFF",
                        fontSize: 10,
                        fontWeight: 900,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 1,
                      }}
                    >
                      ✳
                    </span>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "#FFFFFF",
                        flex: 1,
                      }}
                    >
                      Claude Code
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "#9CA3AF",
                        fontWeight: 600,
                      }}
                    >
                      ×
                    </span>
                  </div>
                  {/* 标签栏右侧 + 与 ∨ */}
                  <div
                    style={{
                      height: 30,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      paddingLeft: 4,
                      color: "#9CA3AF",
                      fontSize: 13,
                    }}
                  >
                    <span>+</span>
                    <span style={{ fontSize: 10 }}>∨</span>
                  </div>
                </div>

                {/* 终端纯黑内容区：左侧为 Clawd 真身站位，右侧为三行版本/模型/路径信息，下方为 Using Opus 状态行 */}
                <div
                  style={{
                    padding: "20px 18px 18px 20px",
                    opacity: termWelcomeIn,
                  }}
                >
                  {/* 上半部分：左侧预留 96px 宽度给主舞台 Clawd 真身，右侧显示三行信息 */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 96,
                      minHeight: 68,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        lineHeight: 1.25,
                      }}
                    >
                      <div style={{ fontSize: 15.5 }}>
                        <span style={{ color: "#FFFFFF", fontWeight: 800 }}>
                          Claude Code
                        </span>{" "}
                        <span style={{ color: "#8E8E93", fontWeight: 500 }}>
                          v2.1.304
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 14.5,
                          color: "#8E8E93",
                          fontWeight: 500,
                        }}
                      >
                        Opus 5.5 · Claude Pro
                      </div>
                      <div
                        style={{
                          fontSize: 14.5,
                          color: "#8E8E93",
                          fontWeight: 500,
                        }}
                      >
                        {"E:\\workspace\\try-me"}
                      </div>
                    </div>
                  </div>

                  {/* 下方状态行：│ Using Opus 5.5 (from .claude\settings.json) · /model */}
                  <div
                    style={{
                      marginTop: 22,
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      fontSize: 12.2,
                      color: "#8E8E93",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ color: "#8E8E93", fontWeight: 700 }}>│</span>
                    <span>
                      {"Using Opus 5.5 (from .claude\\settings.json) · /model"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* ==================== L006: GitHub Contribution Graph 风格 365 天全勤热力图（在 Clawd 39.20s 站稳前一点点提前滑入！） ==================== */}
      {sec >= 38.66 && sec <= 40.95 && (() => {
        // 在 Clawd 单侧踮脚跳快要站稳 (39.20s) 前一点点 (38.70s ~ 39.06s) 提前从右侧滑入！
        const enter = smoothStep(sec, 38.7, 39.06);
        const exit = smoothStep(sec, 40.42, 40.9);
        const presence = enter * (1 - exit);
        const calX = interpolate(presence, [0, 1], [340, 0]);

        const totalCols = 28;
        const totalRows = 7;
        const totalCells = totalCols * totalRows; // 196 个热力格代表全年 52 周×7 天浓缩视图

        const scanProgress = interpolate(sec, [39.0, 39.74], [0, totalCells], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const activeCell = Math.floor(scanProgress);
        const isAllDone = sec >= 39.74;
        const displayDays = Math.round(
          interpolate(sec, [39.0, 39.74], [1, 365], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        );
        // 与 Clawd 在「365日」句尾拍点处的双拍轻快点头 (39.74~40.42s) 同频弹跳共振
        const nodCardPulse =
          sec >= 39.74 && sec <= 40.42
            ? interpolate(
                linearProg(sec, 39.74, 40.42),
                [0, 0.18, 0.34, 0.54, 0.74, 1],
                [1, 1.045, 0.99, 1.05, 0.995, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              )
            : 1;

        return (
          <div
            style={{
              position: "absolute",
              left: "calc(50% + 198px)",
              top: 276,
              width: 446,
              backgroundColor: "#0D1117",
              border: `3px solid ${isAllDone ? "#39D353" : "#30363D"}`,
              borderRadius: 16,
              padding: "14px 18px",
              transform: `translate(-50%, -50%) translateX(${calX}px) scale(${nodCardPulse})`,
              opacity: interpolate(presence, [0, 0.2, 1], [0, 1, 1]),
              boxShadow: isAllDone
                ? "0 0 34px rgba(57, 211, 83, 0.32), 0 14px 32px rgba(0, 0, 0, 0.55)"
                : "0 14px 32px rgba(0, 0, 0, 0.5)",
              zIndex: 5,
              fontFamily: "monospace",
            }}
          >
            {/* 顶部状态栏：365 贡献计数 + 全勤徽章（单行不换行，避免高度跳动） */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
                paddingBottom: 8,
                borderBottom: "1px solid #21262D",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: isAllDone ? "#39D353" : "#F0F6FC",
                    lineHeight: 1,
                  }}
                >
                  {displayDays}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#8B949E",
                    whiteSpace: "nowrap",
                  }}
                >
                  contributions in the last year
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: isAllDone ? "#0D1117" : "#C9D1D9",
                  backgroundColor: isAllDone ? "#39D353" : "#21262D",
                  padding: "3px 8px",
                  borderRadius: 999,
                  letterSpacing: 0.3,
                  whiteSpace: "nowrap",
                }}
              >
                {isAllDone ? "365 STREAK ✓" : "365 DAYS"}
              </span>
            </div>

            {/* 月份坐标行 (Jan ~ Dec) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(12, 1fr)",
                paddingLeft: 30,
                marginBottom: 5,
                fontSize: 10,
                fontWeight: 700,
                color: "#8B949E",
              }}
            >
              {GITHUB_MONTHS.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>

            {/* 主体：左侧星期标签 + 7×28 按列扫描随机深浅热力网格 */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 24,
                  height: 88,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "11px 0",
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: "#8B949E",
                  lineHeight: 1,
                }}
              >
                <span>Mon</span>
                <span>Wed</span>
                <span>Fri</span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateRows: `repeat(${totalRows}, 10px)`,
                  gridAutoFlow: "column",
                  gridAutoColumns: "10px",
                  gap: 3,
                }}
              >
                {Array.from({ length: totalCells }).map((_, idx) => {
                  const isScanned = idx < activeCell || isAllDone;
                  const isFrontier =
                    !isAllDone &&
                    sec >= 38.8 &&
                    idx >= activeCell - 2 &&
                    idx <= activeCell;
                  const level = getContributionLevel(idx);
                  const shadeColor = GITHUB_HEAT_COLORS[level];

                  return (
                    <div
                      key={idx}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2.5,
                        backgroundColor: isFrontier
                          ? "#86EFAC"
                          : isScanned
                            ? shadeColor
                            : "#161B22",
                        border: isScanned
                          ? "1px solid rgba(255, 255, 255, 0.07)"
                          : "1px solid rgba(240, 246, 252, 0.04)",
                        transform: isFrontier ? "scale(1.22)" : "scale(1)",
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* 底部图例：Less [▪▪▪▪▪] More */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 10,
                fontSize: 10.5,
                fontWeight: 700,
                color: "#8B949E",
              }}
            >
              <span>100% uptime · 365/365 days</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ marginRight: 2 }}>Less</span>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: "#161B22",
                    border: "1px solid rgba(240, 246, 252, 0.05)",
                  }}
                />
                {GITHUB_HEAT_COLORS.map((color) => (
                  <span
                    key={color}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      backgroundColor: color,
                    }}
                  />
                ))}
                <span style={{ marginLeft: 2 }}>More</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================== L007–L008: 跨句共享的五行多语言对话气泡 + 两侧极简听众回应 ==================== */}
      {sec >= 40.78 && sec <= 45.32 && (() => {
        // 气泡在 L007 (40.80s) 弹出，前四行同时以打字机方式并行推进，第五行显示 ...
        // 进入 L008 (42.91s) 时，同一个气泡不断裂、不卸载，平滑移至 Clawd 头顶正上方并微缩，最后在 44.65~45.28s 浮起渐隐
        const bubbleIn = smoothStep(sec, 40.8, 41.04);
        const moveToHeader = smoothStep(sec, 42.78, 43.35);
        const bubbleOut = smoothStep(sec, 44.68, 45.26);

        const bubbleX = interpolate(moveToHeader, [0, 1], [155, 0]);
        const bubbleY =
          interpolate(moveToHeader, [0, 1], [235, 148]) - bubbleOut * 28;
        const bubbleScale =
          interpolate(bubbleIn, [0, 1], [0.86, 1]) *
          interpolate(moveToHeader, [0, 1], [1, 0.88]) *
          interpolate(bubbleOut, [0, 1], [1, 0.9]);
        const bubbleOpacity = bubbleIn * (1 - bubbleOut);

        // 前四行在 40.92~42.38s 并行同时打字，第五行 ... 在 42.34~42.74s 打出
        const parallelTypeProg = linearProg(sec, 40.92, 42.38);
        const isTypingFour = sec >= 40.92 && sec < 42.38;
        const moreProg = linearProg(sec, 42.34, 42.74);
        const isTypingMore = sec >= 42.34 && sec < 42.74;

        // L008 理解徽章与左右极简听众参数
        const badgePop = smoothStep(sec, 43.25, 43.52);
        const listenerEnter = smoothStep(sec, 42.91, 43.42);
        const listenerExit = smoothStep(sec, 44.65, 45.26);
        const listenerPresence = listenerEnter * (1 - listenerExit);
        const leftNod =
          sec >= 43.48 && sec <= 44.02
            ? Math.sin(linearProg(sec, 43.48, 44.02) * Math.PI) * 14
            : 0;
        const rightNod =
          sec >= 43.78 && sec <= 44.32
            ? Math.sin(linearProg(sec, 43.78, 44.32) * Math.PI) * 14
            : 0;
        const leftGotIt = sec >= 43.48 && sec <= 44.82;
        const rightGotIt = sec >= 43.78 && sec <= 44.82;

        return (
          <>
            {/* 跨 L007–L008 连续存在的五行多语言气泡 */}
            <div
              style={{
                position: "absolute",
                left: `calc(50% + ${bubbleX}px)`,
                top: bubbleY,
                width: 520,
                transform: `translate(-50%, -50%) scale(${bubbleScale})`,
                opacity: bubbleOpacity,
                backgroundColor: "#F8FAFC",
                color: "#0F172A",
                border: "4px solid #11131F",
                borderRadius: 20,
                padding: "14px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 7,
                zIndex: 6,
                boxShadow: "0 14px 32px rgba(0, 0, 0, 0.36)",
              }}
            >
              {MULTILANG_LINES.map((line) => {
                const chars = Math.round(parallelTypeProg * line.text.length);
                const visibleText = line.text.slice(0, chars);
                return (
                  <div
                    key={line.lang}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      minHeight: 30,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 900,
                        padding: "2px 8px",
                        borderRadius: 6,
                        backgroundColor: line.color,
                        color: "#0F172A",
                        width: 42,
                        textAlign: "center",
                        flexShrink: 0,
                      }}
                    >
                      {line.lang}
                    </span>
                    <span
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: "#0F172A",
                        whiteSpace: "nowrap",
                        letterSpacing: -0.2,
                      }}
                    >
                      {visibleText}
                      {isTypingFour && (
                        <span
                          style={{
                            display: "inline-block",
                            width: 9,
                            height: 21,
                            backgroundColor: "#0F172A",
                            marginLeft: 3,
                            verticalAlign: "middle",
                          }}
                        />
                      )}
                    </span>
                  </div>
                );
              })}

              {/* 第五行：+ ... */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  minHeight: 28,
                  opacity: sec >= 42.34 ? 1 : 0.25,
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: "#64748B",
                    width: 42,
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  +
                </span>
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    color: "#334155",
                    letterSpacing: 3,
                  }}
                >
                  {"...".slice(0, Math.round(moreProg * 3))}
                  {isTypingMore && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 9,
                        height: 21,
                        backgroundColor: "#0F172A",
                        marginLeft: 3,
                        verticalAlign: "middle",
                      }}
                    />
                  )}
                </span>
              </div>

              {/* 气泡指向 Clawd 的尖角（随气泡从右侧移向头顶平滑过渡位置） */}
              <div
                style={{
                  position: "absolute",
                  left: `${interpolate(moveToHeader, [0, 1], [8, 50])}%`,
                  bottom: -16,
                  transform: "translateX(-50%)",
                  width: 0,
                  height: 0,
                  borderLeft: "14px solid transparent",
                  borderRight: "14px solid transparent",
                  borderTop: "16px solid #F8FAFC",
                }}
              />

              {/* L008 气泡右下角浮现同款理解 ★ 徽章 */}
              {badgePop > 0.01 && (
                <div
                  style={{
                    position: "absolute",
                    right: -16,
                    bottom: -14,
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: "#FACC15",
                    border: "3px solid #11131F",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: 26,
                    fontWeight: 900,
                    color: "#0F172A",
                    transform: `scale(${badgePop})`,
                    boxShadow: "0 6px 14px rgba(0,0,0,0.3)",
                  }}
                >
                  ★
                </div>
              )}
            </div>

            {/* L008 左侧极简听众（冷灰蓝轮廓 + 小圆帽檐配件） */}
            {listenerPresence > 0.01 && (
              <div
                style={{
                  position: "absolute",
                  left: "calc(50% - 310px)",
                  bottom: 195,
                  transform: `translateX(-50%) translateX(${interpolate(
                    listenerPresence,
                    [0, 1],
                    [-220, 0],
                  )}px) translateY(${leftNod}px)`,
                  opacity: listenerPresence,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  zIndex: 4,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    backgroundColor: "#FACC15",
                    border: "3px solid #11131F",
                    fontSize: 20,
                    fontWeight: 900,
                    color: "#0F172A",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 10,
                    opacity: leftGotIt ? 1 : 0,
                    transform: `scale(${leftGotIt ? 1 : 0.5})`,
                  }}
                >
                  ★
                </div>
                <svg width={118} height={112} viewBox="0 0 10 10">
                  <rect x={2} y={0.8} width={6.5} height={1.1} fill="#38BDF8" />
                  <rect
                    x={1.5}
                    y={1.8}
                    width={6.5}
                    height={5.8}
                    fill="#64748B"
                    stroke="#11131F"
                    strokeWidth={0.4}
                  />
                  <rect x={3.8} y={3.1} width={0.8} height={1.5} fill="#0F172A" />
                  <rect x={6.0} y={3.1} width={0.8} height={1.5} fill="#0F172A" />
                  <rect x={2.5} y={7.6} width={1.1} height={2.2} fill="#64748B" />
                  <rect x={5.8} y={7.6} width={1.1} height={2.2} fill="#64748B" />
                </svg>
              </div>
            )}

            {/* L008 右侧极简听众（青绿灰轮廓 + 头顶粉色发卡配件） */}
            {listenerPresence > 0.01 && (
              <div
                style={{
                  position: "absolute",
                  left: "calc(50% + 310px)",
                  bottom: 195,
                  transform: `translateX(-50%) translateX(${interpolate(
                    listenerPresence,
                    [0, 1],
                    [220, 0],
                  )}px) translateY(${rightNod}px)`,
                  opacity: listenerPresence,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  zIndex: 4,
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    backgroundColor: "#FACC15",
                    border: "3px solid #11131F",
                    fontSize: 20,
                    fontWeight: 900,
                    color: "#0F172A",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 10,
                    opacity: rightGotIt ? 1 : 0,
                    transform: `scale(${rightGotIt ? 1 : 0.5})`,
                  }}
                >
                  ★
                </div>
                <svg width={118} height={112} viewBox="0 0 10 10">
                  <rect x={4.6} y={0.3} width={0.9} height={1.5} fill="#F472B6" />
                  <rect x={3.8} y={0.3} width={2.4} height={0.7} fill="#F472B6" />
                  <rect
                    x={2.0}
                    y={1.8}
                    width={6.5}
                    height={5.8}
                    fill="#4D7C73"
                    stroke="#11131F"
                    strokeWidth={0.4}
                  />
                  <rect x={3.2} y={3.1} width={0.8} height={1.5} fill="#0F172A" />
                  <rect x={5.4} y={3.1} width={0.8} height={1.5} fill="#0F172A" />
                  <rect x={3.0} y={7.6} width={1.1} height={2.2} fill="#4D7C73" />
                  <rect x={6.3} y={7.6} width={1.1} height={2.2} fill="#4D7C73" />
                </svg>
              </div>
            )}
          </>
        );
      })()}

      {/* ==================== L010: 上方涌现三项能力符号 → 汇成 TOP CLASS 小奖章 → 收起清场 ==================== */}
      {sec >= 47.58 && sec <= 49.88 && (() => {
        const p10 = linearProg(sec, 47.58, 49.892);
        const panelIn = smoothStep(sec, 47.58, 47.82);
        const panelOut = 1 - smoothStep(sec, 49.32, 49.84);
        const panelPresence = panelIn * panelOut;
        const mergeIcons = smoothStep(sec, 48.35, 48.62);
        const showMedal = smoothStep(sec, 48.56, 48.84);
        const items = [
          { sym: "Aa", color: "#38BDF8", start: 0.05, dx: -105 },
          { sym: "</>", color: "#4ADE80", start: 0.17, dx: 0 },
          { sym: "◇", color: "#F472B6", start: 0.29, dx: 105 },
        ];

        return (
          <div
            style={{
              position: "absolute",
              top: 118,
              left: "50%",
              transform: `translate(-50%, -50%) translateY(${interpolate(
                panelPresence,
                [0, 1],
                [-42, 0],
              )}px)`,
              opacity: panelPresence,
              backgroundColor: "#0F172A",
              border: `3px solid ${showMedal > 0.3 ? "#FACC15" : "#38BDF8"}`,
              borderRadius: 16,
              padding: "10px 28px",
              width: 440,
              height: 82,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 6,
              boxShadow: "0 12px 28px rgba(0, 0, 0, 0.45)",
            }}
          >
            {mergeIcons < 0.99 &&
              items.map((it, idx) => {
                const done = p10 >= it.start;
                const xPos = it.dx * (1 - mergeIcons);
                return (
                  <div
                    key={idx}
                    style={{
                      position: "absolute",
                      transform: `translateX(${xPos}px) scale(${
                        1 - mergeIcons * 0.55
                      })`,
                      opacity: Math.max(0, 1 - mergeIcons * 1.15),
                      backgroundColor: done ? it.color : "#1E293B",
                      color: done ? "#0F172A" : "#64748B",
                      fontSize: 22,
                      fontWeight: 900,
                      padding: "6px 16px",
                      borderRadius: 10,
                      border: "2px solid #0F172A",
                      fontFamily: "monospace",
                    }}
                  >
                    {it.sym}
                  </div>
                );
              })}

            {showMedal > 0.02 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  transform: `scale(${interpolate(
                    showMedal,
                    [0, 0.7, 1],
                    [0.5, 1.12, 1],
                  )})`,
                  opacity: showMedal,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    backgroundColor: "#FACC15",
                    border: "3px solid #FEF08A",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: 26,
                    fontWeight: 900,
                    color: "#78350F",
                    boxShadow: "0 0 18px rgba(250, 204, 21, 0.65)",
                  }}
                >
                  ★
                </div>
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    color: "#FEF08A",
                    letterSpacing: 1.5,
                  }}
                >
                  TOP CLASS
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* ==================== L065: (ほら！) 右上弹出红底黄外描边手写风艺术字与星形点缀 ==================== */}
      {sec >= 52.82 && sec <= 54.85 && (() => {
        const popT = linearProg(sec, 52.82, 54.82);
        const popScale = interpolate(
          popT,
          [0, 0.09, 0.18, 0.68, 1],
          [0.2, 1.2, 1.0, 1.0, 0.86],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const popOpacity = interpolate(
          popT,
          [0, 0.07, 0.62, 1],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const driftY = interpolate(popT, [0, 1], [18, -16], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            style={{
              position: "absolute",
              left: "calc(50% + 235px)",
              top: 210,
              transform: `translate(-50%, -50%) translateY(${driftY}px) scale(${popScale}) rotate(-7deg)`,
              opacity: popOpacity,
              zIndex: 8,
              pointerEvents: "none",
            }}
          >
            {[
              { x: -34, y: -18, s: 30, c: "#FACC15" },
              { x: 210, y: -22, s: 34, c: "#FEF08A" },
              { x: 224, y: 54, s: 26, c: "#EF4444" },
            ].map((st, idx) => (
              <span
                key={idx}
                style={{
                  position: "absolute",
                  left: st.x,
                  top: st.y,
                  fontSize: st.s,
                  color: st.c,
                  fontWeight: 900,
                }}
              >
                ✦
              </span>
            ))}
            <div
              style={{
                fontFamily:
                  '"Excalifont", "Segoe Print", "Comic Sans MS", "Hiragino Maru Gothic ProN", cursive, sans-serif',
                fontSize: 68,
                fontWeight: 900,
                color: "#E11D48",
                WebkitTextStroke: "10px #FACC15",
                paintOrder: "stroke fill",
                textShadow: "0px 8px 18px rgba(0, 0, 0, 0.48)",
                letterSpacing: 2,
                whiteSpace: "nowrap",
              }}
            >
              ほら！
            </div>
          </div>
        );
      })()}

      {/* ==================== 全程唯一的连续 Clawd 主角实例（绝不卸载或突变尺寸） ==================== */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 162,
          transform: `translateX(-50%) translateX(${clawdStageX}px) translateY(${clawdStageY}px) scale(${clawdStageScale})`,
          transformOrigin: "bottom center",
          opacity: clawdStageOpacity,
          zIndex: clawdZIndex,
        }}
      >
        <ClawdMascot
          width={310}
          action={action}
          actionProgress={actionProgress}
          eyes={eyes}
          mouth="none"
          outfit="none"
          prop={prop}
          glassesProgress={glassesProgress}
          bookProgress={bookProgress}
          trumpetProgress={trumpetProgress}
          beatPulse={beatPulse}
          lookOffset={lookOffset}
        />
      </div>

      {/* ==================== 底部紧凑字幕与过渡检视栏 (可通过 showHud 开关) ==================== */}
      {showHud && (
        <div
          style={{
            position: "absolute",
            left: 64,
            right: 64,
            bottom: 28,
            backgroundColor: "rgba(15, 23, 42, 0.84)",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            borderRadius: 14,
            padding: "12px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  padding: "3px 9px",
                  borderRadius: 6,
                  backgroundColor: "#D87757",
                  color: "#0F172A",
                  fontFamily: "monospace",
                }}
              >
                {activeEvent.id}
              </span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#F8FAFC",
                }}
              >
                {activeEvent.lyric}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                fontFamily: "monospace",
              }}
            >
              <span style={{ fontSize: 13, color: "#94A3B8" }}>
                {activeEvent.summary}
              </span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#FACC15",
                }}
              >
                {formatSec(sec)} / {formatSec(VERSE1_MV_DURATION_SEC)} (F{frame})
              </span>
            </div>
          </div>

          {/* 55.168s 全段进度条与事件分割刻度 */}
          <div
            style={{
              position: "relative",
              height: 6,
              backgroundColor: "rgba(51, 65, 85, 0.7)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(sec / VERSE1_MV_DURATION_SEC) * 100}%`,
                height: "100%",
                backgroundColor: "#38BDF8",
              }}
            />
            {VERSE1_EVENTS.map((ev) => (
              <div
                key={ev.id}
                style={{
                  position: "absolute",
                  left: `${(ev.startSec / VERSE1_MV_DURATION_SEC) * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: 1.5,
                  backgroundColor: "rgba(248, 250, 252, 0.35)",
                }}
              />
            ))}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const TryMeVerse1MVComposition: React.FC = () => {
  return (
    <Composition
      id="TryMeVerse1MV"
      component={TryMeVerse1MV}
      durationInFrames={VERSE1_MV_FRAMES}
      fps={VERSE1_MV_FPS}
      width={1280}
      height={720}
      defaultProps={{
        silentPreview: false,
        showHud: true,
      }}
    />
  );
};
