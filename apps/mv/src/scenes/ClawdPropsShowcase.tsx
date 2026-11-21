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

export const ClawdPropsComposition: React.FC = () => {
  return (
    <Composition
      id="ClawdProps"
      component={ClawdPropsShowcaseOutput}
      durationInFrames={360}
      fps={VIDEO_FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
    />
  );
};

export const ClawdPropsShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeSec = frame / fps;

  // 107 BPM (《Try Me》实测速度) 节拍脉冲
  const beatPhase = (timeSec * (107 / 60)) % 1;
  const beatPulse = interpolate(beatPhase, [0, 0.35], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#16151d",
        color: "#f8fafc",
        fontFamily: "monospace",
        padding: 32,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* 顶部标题栏 */}
      <div
        style={{
          backgroundColor: "#1d1b26",
          border: "1px solid #353244",
          borderRadius: 14,
          padding: "14px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            第二组：Clawd 进阶表情、换装与舞台道具库 (ClawdProps)
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            随歌曲推进由简入繁：从主歌轻表情 (Talk / Yawn / Blush) 逐步升级到导歌、副歌与终局的换装道具
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#d87757",
            backgroundColor: "rgba(216, 119, 87, 0.14)",
            padding: "6px 12px",
            borderRadius: 8,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Tier 2 &amp; 3 · 表情与道具库 (8 组)
        </div>
      </div>

      {/* 4列 × 2行 = 8 组进阶表情与道具卡片 */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gridTemplateRows: "repeat(2, 1fr)",
          gap: 18,
        }}
      >
        {/* 1. Talk 多语说话 + 气泡 */}
        <div
          style={{
            backgroundColor: "#23212c",
            border: "1px solid #353244",
            borderRadius: 14,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ width: "100%", fontSize: 13, fontWeight: 700 }}>
            1. [轻表情] 说话 + 气泡
          </div>
          <ClawdMascot width={185} action="idle" mouth="talk" />
          <div style={{ fontSize: 11, color: "#a39fb8" }}>
            mouth=&quot;talk&quot; · 适配 L007 多语言
          </div>
        </div>

        {/* 2. Blush 弯眼腮红比心 */}
        <div
          style={{
            backgroundColor: "#23212c",
            border: "1px solid #353244",
            borderRadius: 14,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ width: "100%", fontSize: 13, fontWeight: 700 }}>
            2. [轻表情] 弯眼腮红比心
          </div>
          <ClawdMascot width={185} action="idle" mouth="blush" />
          <div style={{ fontSize: 11, color: "#a39fb8" }}>
            mouth=&quot;blush&quot; · 对应 idle-heart
          </div>
        </div>

        {/* 3. Yawn 打盹哈欠 */}
        <div
          style={{
            backgroundColor: "#23212c",
            border: "1px solid #353244",
            borderRadius: 14,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ width: "100%", fontSize: 13, fontWeight: 700 }}>
            3. [轻表情] 眯眼打盹哈欠
          </div>
          <ClawdMascot width={185} action="idle" mouth="yawn" />
          <div style={{ fontSize: 11, color: "#a39fb8" }}>
            mouth=&quot;yawn&quot; · 对应 idle-yawn/doze
          </div>
        </div>

        {/* 4. Book 学霸捧书阅读 */}
        <div
          style={{
            backgroundColor: "#23212c",
            border: "1px solid #353244",
            borderRadius: 14,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ width: "100%", fontSize: 13, fontWeight: 700 }}>
            4. [道具] 学霸捧书阅读
          </div>
          <ClawdMascot width={185} action="idle" prop="book" />
          <div style={{ fontSize: 11, color: "#a39fb8" }}>
            prop=&quot;book&quot; · 适配 L010 门门第一
          </div>
        </div>

        {/* 5. Swag Superstar 潮人装 */}
        <div
          style={{
            backgroundColor: "#23212c",
            border: `1.5px solid ${beatPulse > 0.35 ? "#f5c542" : "#353244"}`,
            borderRadius: 14,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ width: "100%", fontSize: 13, fontWeight: 700, color: "#f5c542" }}>
            5. [换装] Superstar 潮人装
          </div>
          <ClawdMascot
            width={185}
            action="idle"
            outfit="swag"
            beatPulse={beatPulse}
          />
          <div style={{ fontSize: 11, color: "#f5c542" }}>
            outfit=&quot;swag&quot; · 适配 P003 导歌
          </div>
        </div>

        {/* 6. Party + Juggle 全能杂耍派对 */}
        <div
          style={{
            backgroundColor: "#23212c",
            border: "1px solid #353244",
            borderRadius: 14,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ width: "100%", fontSize: 13, fontWeight: 700 }}>
            6. [道具] 派对帽 + 杂耍抛球
          </div>
          <ClawdMascot
            width={185}
            action="bounce"
            mouth="smile"
            outfit="party"
            prop="juggle"
          />
          <div style={{ fontSize: 11, color: "#a39fb8" }}>
            outfit=&quot;party&quot; + prop=&quot;juggle&quot;
          </div>
        </div>

        {/* 7. Coffee 休憩タイム端咖啡 */}
        <div
          style={{
            backgroundColor: "#23212c",
            border: "1px solid #353244",
            borderRadius: 14,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ width: "100%", fontSize: 13, fontWeight: 700 }}>
            7. [道具] 休憩タイム喝咖啡
          </div>
          <ClawdMascot
            width={185}
            action="idle"
            mouth="smile"
            prop="coffee"
          />
          <div style={{ fontSize: 11, color: "#a39fb8" }}>
            prop=&quot;coffee&quot; · 适配 P008 桥段小憩
          </div>
        </div>

        {/* 8. DJ 打碟台 / Gentleman 绅士 */}
        <div
          style={{
            backgroundColor: "#23212c",
            border: "1px solid #353244",
            borderRadius: 14,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ width: "100%", fontSize: 13, fontWeight: 700 }}>
            8. [舞台/换装] DJ台 &amp; 绅士礼帽
          </div>
          <ClawdMascot
            width={185}
            action="idle"
            mouth={timeSec % 4 < 2 ? "smile" : "talk"}
            outfit={timeSec % 4 < 2 ? "none" : "gentleman"}
            prop={timeSec % 4 < 2 ? "dj" : "none"}
          />
          <div style={{ fontSize: 11, color: "#a39fb8" }}>
            prop=&quot;dj&quot; / outfit=&quot;gentleman&quot;
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ClawdPropsShowcaseOutput = withOutputCanvas(ClawdPropsShowcase);
