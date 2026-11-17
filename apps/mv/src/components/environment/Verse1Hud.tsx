import React from "react";
import {
  findActiveVerse1Event,
  VERSE1_EVENTS,
  VERSE1_MV_DURATION_SEC,
} from "../../timeline/verse1";

export interface Verse1HudProps {
  sec: number;
  frame: number;
}

function formatSec(sec: number): string {
  const mins = Math.floor(sec / 60);
  const rem = sec - mins * 60;
  return `${String(mins).padStart(2, "0")}:${rem.toFixed(2).padStart(5, "0")}`;
}

/**
 * 底部紧凑字幕与过渡检视栏 (可通过 showHud 开关)
 */
export const Verse1Hud: React.FC<Verse1HudProps> = ({ sec, frame }) => {
  const activeEvent = findActiveVerse1Event(sec);

  return (
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
  );
};
