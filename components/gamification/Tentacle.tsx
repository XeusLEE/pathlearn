"use client";

// =============================================================
// <Tentacle /> — standalone tapered SVG tentacle that emerges from
// a screen edge. Designed for "hovering onto things" — peeking in
// from the side of a quiz screen, holding a card on the matching
// question, celebrating an episode complete, etc.
//
// The consumer positions the wrapper (e.g. `fixed left-0 top-1/2`)
// and chooses an `anchor` direction; this component handles its own
// internal rotation/flip so the base stays glued to that edge while
// the tip extends outward.
// =============================================================

import { motion, type Transition } from "framer-motion";
import { useId, useMemo } from "react";

export type TentacleAnchor = "left" | "right" | "top" | "bottom";
export type TentacleMood =
  | "idle"
  | "reaching"
  | "celebrating"
  | "drooping"
  | "wiggling";

export interface TentacleProps {
  /** How far the tentacle extends from its anchor in pixels (default 120). */
  length?: number;
  /** Which screen edge the tentacle emerges from (controls flip / rotation). */
  anchor?: TentacleAnchor;
  /** Curl direction of the tip. */
  curl?: "in" | "out";
  /** Drives the animation personality. */
  mood?: TentacleMood;
  /** Width of the base in pixels (default 48). Tapers to ~14px at the tip. */
  thickness?: number;
  /** Stroke color override; defaults to var(--color-purple-dark). */
  strokeColor?: string;
  /** Fill color override; defaults to var(--color-purple). */
  fillColor?: string;
  /** Optional class names for positioning. */
  className?: string;
  style?: React.CSSProperties;
  /** Show suction cups? Default true. */
  showSuckers?: boolean;
  /** Optional element id for tentacle reach-target targeting. */
  id?: string;
}

/**
 * Pre-computed animation envelopes per mood. Subtle on purpose — multiple
 * tentacles on one screen should breathe together, not compete.
 */
const MOOD_ANIM: Record<
  TentacleMood,
  { rotate: number[]; scale?: number[]; transition: Transition }
> = {
  idle: {
    rotate: [-2, 2, -2],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  reaching: {
    rotate: [-3, 4, -2, 3, -3],
    transition: {
      duration: 1.2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  celebrating: {
    rotate: [-8, 8, -8],
    scale: [1, 1.05, 1],
    transition: {
      duration: 0.7,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  drooping: {
    rotate: [-1, -3, -1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
  wiggling: {
    rotate: [-6, 6, -6],
    transition: {
      duration: 0.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

/**
 * Anchor → wrapper transform. The internal SVG is always drawn as if the base
 * is at x=0 (left edge) and the tip extends to the right; we rotate/flip the
 * wrapper so it appears glued to the requested screen edge.
 */
function anchorRotation(anchor: TentacleAnchor): number {
  switch (anchor) {
    case "left":
      return 0;
    case "right":
      return 180;
    case "top":
      return 90;
    case "bottom":
      return -90;
  }
}

/**
 * Pivot point for the per-mood rotation. We want the tentacle to wave from
 * its base, not its center. In the base-at-left coordinate system the pivot
 * is at the left edge mid-height.
 */
const PIVOT = "0% 50%";

export function Tentacle({
  length = 120,
  anchor = "left",
  curl = "in",
  mood = "idle",
  thickness = 48,
  strokeColor = "var(--color-purple-dark)",
  fillColor = "var(--color-purple)",
  className,
  style,
  showSuckers = true,
  id,
}: TentacleProps) {
  const reactId = useId();
  const uid = useMemo(() => reactId.replace(/[:]/g, ""), [reactId]);
  const gradId = `tent-grad-${uid}`;

  // Viewbox / shape constants. The base sits at x=0..16 vertically centered.
  // The path runs to x=length using an S-curve. We taper from `thickness`
  // (at base) to ~thickness * 0.3 (at tip).
  const baseW = thickness;
  const tipW = Math.max(8, thickness * 0.3);
  const viewH = Math.max(baseW + 24, 64);
  const midY = viewH / 2;

  // S-curve control points. `curl` flips the second hump.
  // Path: base (left) → control1 → midpoint → control2 → tip (right).
  // We outline the top edge and the bottom edge as separate y-offsets so the
  // shape tapers smoothly.
  const x0 = 0;
  const xTip = length;
  const xMid1 = length * 0.35;
  const xMid2 = length * 0.7;

  const curlDir = curl === "in" ? 1 : -1;
  const humpAmplitude = viewH * 0.18;

  // Top edge runs from (x0, midY - baseW/2) to (xTip, midY - tipW/2)
  // with S-curve via two quadratic-ish humps.
  const topY0 = midY - baseW / 2;
  const topY1 = midY - baseW * 0.42 - humpAmplitude * curlDir;
  const topY2 = midY - tipW * 0.6 + humpAmplitude * curlDir;
  const topYTip = midY - tipW / 2;

  const botY0 = midY + baseW / 2;
  const botY1 = midY + baseW * 0.42 - humpAmplitude * curlDir;
  const botY2 = midY + tipW * 0.6 + humpAmplitude * curlDir;
  const botYTip = midY + tipW / 2;

  // Closed path: base → along the top edge to tip → small rounded tip cap →
  // back along the bottom edge to base. We use cubic Beziers so the curve
  // reads as an organic S, not a polygon.
  const path = [
    `M ${x0} ${topY0}`,
    `C ${xMid1} ${topY1}, ${xMid2} ${topY2}, ${xTip} ${topYTip}`,
    // rounded tip
    `Q ${xTip + tipW * 0.5} ${midY}, ${xTip} ${botYTip}`,
    `C ${xMid2} ${botY2}, ${xMid1} ${botY1}, ${x0} ${botY0}`,
    `Z`,
  ].join(" ");

  // Inner highlight: a thin lighter line along the top edge for depth.
  const highlightPath = [
    `M ${x0 + baseW * 0.2} ${topY0 + 2}`,
    `C ${xMid1} ${topY1 + 2}, ${xMid2} ${topY2 + 1}, ${xTip - 2} ${topYTip + 1}`,
  ].join(" ");

  // Suction-cup positions: spaced along the inside-of-curl edge. We compute
  // a few points along the bottom edge (the "underside" given the natural
  // curl direction). curl="in" places them along bot; curl="out" along top.
  const suckerEdgeIsBottom = curl === "in";
  const suckerPoints = useMemo(() => {
    const pts: Array<{ cx: number; cy: number; r: number }> = [];
    const count = 4;
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1); // 0.2, 0.4, 0.6, 0.8
      const x = length * t;
      // Approximate the edge y at this t using a simple lerp between the
      // path control y values — close enough for the visual effect.
      const tRem = 1 - t;
      const edgeY = suckerEdgeIsBottom
        ? botY0 * Math.pow(tRem, 3) +
          3 * botY1 * Math.pow(tRem, 2) * t +
          3 * botY2 * tRem * Math.pow(t, 2) +
          botYTip * Math.pow(t, 3)
        : topY0 * Math.pow(tRem, 3) +
          3 * topY1 * Math.pow(tRem, 2) * t +
          3 * topY2 * tRem * Math.pow(t, 2) +
          topYTip * Math.pow(t, 3);
      // Offset slightly toward the interior so they sit ON the body, not the rim.
      const inward = suckerEdgeIsBottom ? -3 : 3;
      // Taper sucker size with the body.
      const r = Math.max(1.4, (baseW / 2) * (1 - t * 0.7) * 0.18);
      pts.push({ cx: x, cy: edgeY + inward, r });
    }
    return pts;
  }, [length, baseW, botY0, botY1, botY2, botYTip, topY0, topY1, topY2, topYTip, suckerEdgeIsBottom]);

  const anim = MOOD_ANIM[mood];

  // Drooping mood sinks the tip slightly via initial translate.
  const droopOffset = mood === "drooping" ? viewH * 0.05 : 0;

  // Viewport: account for the rounded tip extending slightly past `length`.
  const vbWidth = length + tipW;
  const vbHeight = viewH;

  return (
    <div
      className={className}
      style={{
        // The outer wrapper rotates to match the requested anchor edge. We size
        // it to the tentacle's natural bounding box so the consumer can position
        // it with regular CSS (fixed/absolute) and not worry about geometry.
        width: vbWidth,
        height: vbHeight,
        transform: `rotate(${anchorRotation(anchor)}deg)`,
        transformOrigin: PIVOT,
        ...style,
      }}
      id={id}
    >
      <motion.svg
        viewBox={`0 0 ${vbWidth} ${vbHeight}`}
        width={vbWidth}
        height={vbHeight}
        aria-hidden
        style={{
          display: "block",
          overflow: "visible",
          transformOrigin: PIVOT,
          translate: `0 ${droopOffset}px`,
        }}
        animate={{
          rotate: anim.rotate,
          ...(anim.scale ? { scale: anim.scale } : {}),
        }}
        transition={anim.transition}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor} />
            <stop
              offset="100%"
              stopColor="color-mix(in srgb, var(--color-purple-dark) 80%, black 10%)"
            />
          </linearGradient>
        </defs>

        {/* Body */}
        <path
          d={path}
          fill={`url(#${gradId})`}
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Inner top-edge highlight */}
        <path
          d={highlightPath}
          fill="none"
          stroke="color-mix(in srgb, var(--color-purple) 60%, white)"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.55"
        />

        {/* Suction cups */}
        {showSuckers && (
          <g
            fill="color-mix(in srgb, var(--color-purple-dark) 80%, black 10%)"
            stroke="color-mix(in srgb, var(--color-purple-dark) 80%, black 10%)"
            strokeWidth="0.5"
          >
            {suckerPoints.map((p, i) => (
              <circle key={i} cx={p.cx} cy={p.cy} r={p.r} />
            ))}
          </g>
        )}
      </motion.svg>
    </div>
  );
}
