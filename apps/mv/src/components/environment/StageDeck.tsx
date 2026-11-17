import React from "react";
import type {
  StageKeyboardState,
  StageRhythmState,
} from "../../timeline/verse1";
import { StageAutoKeyboard } from "./StageAutoKeyboard";

export interface StageDeckProps {
  clawdStageX: number;
  stageRhythm: StageRhythmState;
  stageKeyboard: StageKeyboardState;
}

/**
 * 舞台追光、固定舞台台面上沿、自动抽出键盘与两层悬浮律动薄底板
 */
export const StageDeck: React.FC<StageDeckProps> = ({
  clawdStageX,
  stageRhythm,
  stageKeyboard,
}) => {
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

      {/* 舞台地面平台与下方两层悬浮薄底板（Clawd 四足接触的 bottom: 195px 舞台上沿保持 0 位移稳定） */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 195,
          background:
            "linear-gradient(180deg, rgba(20, 21, 34, 0.58) 0%, rgba(10, 11, 18, 0.94) 100%)",
          borderTop: "2px solid rgba(148, 163, 184, 0.20)",
          pointerEvents: "none",
        }}
      >
        {/* 0. 固定主舞台台面上沿 */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: 1000,
            height: 13,
            transform: "translateX(-50%)",
            backgroundColor: "#23263A",
            borderTop: "2px solid rgba(203, 213, 225, 0.42)",
            borderLeft: "1.5px solid rgba(148, 163, 184, 0.28)",
            borderRight: "1.5px solid rgba(148, 163, 184, 0.28)",
            borderBottom: "1.5px solid rgba(15, 23, 42, 0.85)",
            borderRadius: "2px 2px 6px 6px",
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.42)",
            zIndex: 3,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 5,
              left: 40,
              right: 40,
              borderTop: "1px dashed rgba(148, 163, 184, 0.22)",
            }}
          />
          {stageKeyboard.visible && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: -1,
                width: 628 * stageKeyboard.slotOpen,
                height: 4 * stageKeyboard.slotOpen,
                transform: "translateX(-50%)",
                backgroundColor: "#090A10",
                borderTop: "1px solid rgba(71, 85, 105, 0.55)",
                borderRadius: 1,
              }}
            />
          )}
        </div>

        {/* 0.5 舞台前侧抽出的自动演奏键盘 */}
        <StageAutoKeyboard keyboard={stageKeyboard} />

        {/* 1. 上层悬浮薄底板 */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 28 + stageKeyboard.traySlide * 44,
            width: 840 + stageRhythm.upperWidthDeltaPx,
            height: 11,
            transform: `translate(-50%, ${-stageRhythm.upperLiftPx}px)`,
            backgroundColor: `rgba(${Math.round(42 + 16 * stageRhythm.upperHighlight)}, ${Math.round(46 + 18 * stageRhythm.upperHighlight)}, ${Math.round(71 + 24 * stageRhythm.upperHighlight)}, ${0.95 - 0.35 * stageKeyboard.traySlide})`,
            borderTop: `1.5px solid rgba(203, 213, 225, ${((0.3 + 0.32 * stageRhythm.upperHighlight) * (1 - 0.4 * stageKeyboard.traySlide)).toFixed(3)})`,
            borderLeft: `1.5px solid rgba(148, 163, 184, ${(0.24 + 0.22 * stageRhythm.upperHighlight).toFixed(3)})`,
            borderRight: `1.5px solid rgba(148, 163, 184, ${(0.24 + 0.22 * stageRhythm.upperHighlight).toFixed(3)})`,
            borderBottom: "1.5px solid rgba(12, 14, 24, 0.9)",
            borderRadius: 5,
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.36)",
          }}
        />

        {/* 2. 下层悬浮薄底板 + 最下层底板内部短槽脉冲 */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 54 + stageKeyboard.traySlide * 40,
            width: 680 + stageRhythm.lowerWidthDeltaPx,
            height: 14,
            transform: `translate(-50%, ${-stageRhythm.lowerLiftPx}px)`,
            backgroundColor: `rgba(${Math.round(28 + 12 * stageRhythm.lowerHighlight)}, ${Math.round(31 + 14 * stageRhythm.lowerHighlight)}, ${Math.round(50 + 20 * stageRhythm.lowerHighlight)}, ${0.96 - 0.38 * stageKeyboard.traySlide})`,
            borderTop: `1.5px solid rgba(148, 163, 184, ${(0.22 + 0.24 * stageRhythm.lowerHighlight).toFixed(3)})`,
            borderLeft: `1.5px solid rgba(100, 116, 139, ${(0.2 + 0.2 * stageRhythm.lowerHighlight).toFixed(3)})`,
            borderRight: `1.5px solid rgba(100, 116, 139, ${(0.2 + 0.2 * stageRhythm.lowerHighlight).toFixed(3)})`,
            borderBottom: "1.5px solid rgba(9, 10, 18, 0.92)",
            borderRadius: 5,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 480,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#0B0C14",
              border: "1px solid rgba(71, 85, 105, 0.26)",
              overflow: "hidden",
            }}
          >
            {stageRhythm.pulse.active &&
              (() => {
                const halfSpan = 216;
                const offsetPx = stageRhythm.pulse.progress * halfSpan;
                const blockWidth = 48 * (1 - 0.22 * stageRhythm.pulse.progress);
                const centerFlash = Math.max(
                  0,
                  1 - stageRhythm.pulse.progress * 3.2,
                );

                return (
                  <>
                    {centerFlash > 0.02 && (
                      <div
                        style={{
                          position: "absolute",
                          left: "50%",
                          top: 0,
                          bottom: 0,
                          width: 28,
                          transform: "translateX(-50%)",
                          borderRadius: 2,
                          backgroundColor: "#FDBA74",
                          opacity: centerFlash * stageRhythm.pulse.opacity,
                        }}
                      />
                    )}
                    <div
                      style={{
                        position: "absolute",
                        left: `calc(50% - ${offsetPx}px)`,
                        top: 0,
                        bottom: 0,
                        width: blockWidth,
                        transform: "translateX(-50%)",
                        borderRadius: 2,
                        background:
                          "linear-gradient(90deg, rgba(216, 119, 87, 0.25) 0%, #D87757 38%, #FDBA74 72%, rgba(216, 119, 87, 0.35) 100%)",
                        opacity: stageRhythm.pulse.opacity,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: `calc(50% + ${offsetPx}px)`,
                        top: 0,
                        bottom: 0,
                        width: blockWidth,
                        transform: "translateX(-50%)",
                        borderRadius: 2,
                        background:
                          "linear-gradient(270deg, rgba(216, 119, 87, 0.25) 0%, #D87757 38%, #FDBA74 72%, rgba(216, 119, 87, 0.35) 100%)",
                        opacity: stageRhythm.pulse.opacity,
                      }}
                    />
                  </>
                );
              })()}
          </div>
        </div>
      </div>
    </>
  );
};
