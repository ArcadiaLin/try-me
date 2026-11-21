import { VIDEO_FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from "../video-spec";
import { withOutputCanvas } from "../components/OutputCanvas";
import React from "react";
import {
  AbsoluteFill,
  Composition,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ClawdMascot } from "../components/ClawdMascot";

export const ClawdBasicComposition: React.FC = () => {
  return (
    <Composition
      id="ClawdBasic"
      component={ClawdBasicShowcaseOutput}
      durationInFrames={360}
      fps={VIDEO_FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
    />
  );
};

export const ClawdBasicShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeSec = frame / fps;

  // 107 BPM (《Try Me》实测速度) 节拍脉冲
  const beatPhase = (timeSec * (107 / 60)) % 1;
  const beatPulse = interpolate(beatPhase, [0, 0.35], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 眼神左右环顾
  const lookX = Math.sin(timeSec * Math.PI * 0.8) * 0.38;
  const lookY = Math.cos(timeSec * Math.PI * 0.8) * 0.16;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#16151d",
        color: "#f8fafc",
        fontFamily: "monospace",
        padding: 32,
        display: "grid",
        gridTemplateColumns: "390px 1fr",
        gap: 24,
      }}
    >
      {/* 左侧：1:1 原图还原 + 16×10 网格与终端字符拆解 */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {/* 1:1 还原卡片 */}
        <div
          style={{
            backgroundColor: "#23212c",
            border: "1px solid #353244",
            borderRadius: 14,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "#a39fb8",
              marginBottom: 8,
            }}
          >
            <span>Clawd 1:1 原始形象 (#D87757 / BG #23212C)</span>
            <span>F{frame}</span>
          </div>
          <ClawdMascot width={220} action="idle" />
        </div>

        {/* 16×10 蓝图网格与绘制原理解析 */}
        <div
          style={{
            backgroundColor: "#1d1b26",
            border: "1px solid #353244",
            borderRadius: 14,
            padding: "18px 20px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#38bdf8",
              whiteSpace: "nowrap",
            }}
          >
            <span>16×10 正方形网格 (黄线 = 5 行半块)</span>
            <span>viewBox=&quot;0 0 16 10&quot;</span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "4px 0",
            }}
          >
            <ClawdMascot
              width={210}
              action="static"
              showGrid={true}
              autoBlink={false}
            />
          </div>

          <div
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              color: "#cbd5e1",
              backgroundColor: "#121118",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #2b2838",
            }}
          >
            <div>
              <strong>终端字符原型：</strong>
              <span style={{ color: "#d87757", marginLeft: 6 }}>
                ▐▛███▜▌ / ▝▜█████▛▘ / ▘▘ ▝▝
              </span>
            </div>
            <div style={{ marginTop: 4, color: "#94a3b8" }}>
              • 躯干: x=2..14, y=0..8 · 双臂: x=0..2 &amp; 14..16, y=4..6
            </div>
            <div style={{ color: "#94a3b8" }}>
              • 双眼: x=4 &amp; 11, y=2..4 · 四腿: x=3, 5, 10, 12, y=8..10
            </div>
          </div>
        </div>
      </div>

      {/* 右侧：第 1 组 — 6 项极简纯肢体动作展示 (3×2) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            backgroundColor: "#1d1b26",
            border: "1px solid #353244",
            borderRadius: 14,
            padding: "14px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>
              第一组：Clawd 极简纯肢体动作库 (ClawdBasic)
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
              零道具、纯本体几何运动：适合前奏 (P001)、间奏 (L064) 与主歌初段的克制律动
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#38bdf8",
              backgroundColor: "rgba(56, 189, 248, 0.14)",
              padding: "6px 12px",
              borderRadius: 8,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Tier 1 · 极简纯肢体
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(2, 1fr)",
            gap: 16,
          }}
        >
          {/* 1. Idle 待机呼吸 + 眨眼 + 眼神追踪 */}
          <div
            style={{
              backgroundColor: "#23212c",
              border: "1px solid #353244",
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ width: "100%", fontSize: 13, fontWeight: 700 }}>
              1. Idle 呼吸 + 眼神追踪
            </div>
            <ClawdMascot
              width={185}
              action="idle"
              lookOffset={{ x: lookX, y: lookY }}
            />
            <div style={{ fontSize: 11, color: "#a39fb8" }}>
              action=&quot;idle&quot; · 自动眨眼与环顾
            </div>
          </div>

          {/* 2. Walk 四足交替小碎步 */}
          <div
            style={{
              backgroundColor: "#23212c",
              border: "1px solid #353244",
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ width: "100%", fontSize: 13, fontWeight: 700 }}>
              2. Walk 四足交替小碎步
            </div>
            <ClawdMascot width={185} action="walk" />
            <div style={{ fontSize: 11, color: "#a39fb8" }}>
              action=&quot;walk&quot; · 腿 (1,3) 与 (2,4) 反相
            </div>
          </div>

          {/* 3. Wave 单手挥手致意 */}
          <div
            style={{
              backgroundColor: "#23212c",
              border: "1px solid #353244",
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ width: "100%", fontSize: 13, fontWeight: 700 }}>
              3. Wave 单手挥手致意
            </div>
            <ClawdMascot
              width={185}
              action="wave"
              lookOffset={{ x: 0.25, y: -0.1 }}
            />
            <div style={{ fontSize: 11, color: "#a39fb8" }}>
              action=&quot;wave&quot; · 右臂独立高频摆动
            </div>
          </div>

          {/* 4. Beat Pulse 拍点挤压回弹 */}
          <div
            style={{
              backgroundColor: "#23212c",
              border: `1.5px solid ${beatPulse > 0.35 ? "#d87757" : "#353244"}`,
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ width: "100%", fontSize: 13, fontWeight: 700 }}>
              4. Beat 拍点挤压回弹
            </div>
            <ClawdMascot
              width={185}
              action="idle"
              beatPulse={beatPulse}
            />
            <div style={{ fontSize: 11, color: "#d87757" }}>
              beatPulse={beatPulse.toFixed(2)} · 挤压与拉伸
            </div>
          </div>

          {/* 5. Crouch 间奏小幅度蹲起 */}
          <div
            style={{
              backgroundColor: "#23212c",
              border: "1px solid #353244",
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ width: "100%", fontSize: 13, fontWeight: 700 }}>
              5. Crouch 间奏小幅蹲起
            </div>
            <ClawdMascot width={185} action="crouch" />
            <div style={{ fontSize: 11, color: "#a39fb8" }}>
              action=&quot;crouch&quot; · 对应 L064 间奏批注
            </div>
          </div>

          {/* 6. Nod 轻快点头摇摆 */}
          <div
            style={{
              backgroundColor: "#23212c",
              border: "1px solid #353244",
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ width: "100%", fontSize: 13, fontWeight: 700 }}>
              6. Nod 合成器点头摇摆
            </div>
            <ClawdMascot width={185} action="nod" />
            <div style={{ fontSize: 11, color: "#a39fb8" }}>
              action=&quot;nod&quot; · 前奏轻律动点头
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ClawdBasicShowcaseOutput = withOutputCanvas(ClawdBasicShowcase);
