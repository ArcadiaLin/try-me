import React from "react";
import type { ClawdPose } from "../clawd/types";

export interface ShowcasePropsItemProps {
  pose: ClawdPose;
  timeSec: number;
  bodyColor: string;
}

export const CoffeeProp: React.FC<ShowcasePropsItemProps> = ({
  pose,
  timeSec,
}) => {
  const { bodyOffsetX, rightArmOffsetY } = pose;
  return (
    <g
      transform={`translate(${14.3 + bodyOffsetX}, ${4.3 + rightArmOffsetY})`}
    >
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
  );
};

export const JuggleProp: React.FC<ShowcasePropsItemProps> = ({
  pose,
  timeSec,
}) => {
  const { bodyOffsetX, bodyOffsetY } = pose;
  return (
    <g>
      {[
        { color: "#F5C542", offset: 0 },
        { color: "#8EC5FC", offset: 0.333 },
        { color: "#E05A5A", offset: 0.666 },
      ].map((ball, idx) => {
        const t = (timeSec * 0.9 + ball.offset) % 1;
        const angle = t * Math.PI * 2;
        const bx = 8 + Math.cos(angle) * 6.8 + bodyOffsetX;
        const by = 1.8 - Math.abs(Math.sin(angle)) * 3.2 + bodyOffsetY * 0.5;
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
  );
};

export const DjBoothProp: React.FC<ShowcasePropsItemProps> = ({
  pose,
  timeSec,
  bodyColor,
}) => {
  const { leftArmOffsetY, rightArmOffsetY } = pose;
  return (
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
  );
};
