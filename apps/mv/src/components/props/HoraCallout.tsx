import React from "react";
import { interpolate } from "remotion";
import { linearProg } from "../../animation/clawd/motion-style";

export interface HoraCalloutProps {
  sec: number;
}

/**
 * L065: (ほら！) 右上弹出红底黄外描边手写风艺术字与星形点缀
 */
export const HoraCallout: React.FC<HoraCalloutProps> = ({ sec }) => {
  if (sec < 52.82 || sec > 54.85) return null;

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
};
