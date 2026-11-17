import React from "react";

export interface StageDeckProps {
  clawdStageX: number;
}

/**
 * 极简舞台环境层：
 * 仅保留跟随 Clawd 水平重心的柔和追光与固定稳固的舞台台面上沿（bottom: 195px），
 * 台面下方彻底留空，不再堆叠多层悬浮律动底板或巨型抽屉键盘。
 */
export const StageDeck: React.FC<StageDeckProps> = ({ clawdStageX }) => {
  return (
    <>
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

      {/* 舞台承重台面线与下方干净留空区域（Clawd 四足接触的 bottom: 195px 舞台上沿保持 0 位移稳定） */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 195,
          background:
            "linear-gradient(180deg, rgba(16, 17, 28, 0.35) 0%, rgba(9, 10, 16, 0.85) 100%)",
          borderTop: "1.5px solid rgba(148, 163, 184, 0.14)",
          pointerEvents: "none",
        }}
      >
        {/* 固定主舞台台面上沿 */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: 1000,
            height: 12,
            transform: "translateX(-50%)",
            backgroundColor: "#23263A",
            borderTop: "2px solid rgba(203, 213, 225, 0.42)",
            borderLeft: "1.5px solid rgba(148, 163, 184, 0.28)",
            borderRight: "1.5px solid rgba(148, 163, 184, 0.28)",
            borderBottom: "1.5px solid rgba(15, 23, 42, 0.85)",
            borderRadius: "2px 2px 6px 6px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.38)",
            zIndex: 3,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 5,
              left: 40,
              right: 40,
              borderTop: "1px dashed rgba(148, 163, 184, 0.20)",
            }}
          />
        </div>
      </div>
    </>
  );
};
