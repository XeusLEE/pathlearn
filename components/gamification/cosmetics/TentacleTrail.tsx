"use client";

// =============================================================
// <TentacleTrail /> — particle effect emitted from a tentacle's
// tip while it is reaching toward a target. Rendered as an SVG
// <g> so it can live INSIDE the same <svg> as the tentacle body
// and the tip cursor, sharing the tentacle's local coordinate
// space. It is positioned at (tipX, tipY) — the very same
// coordinates the component uses for the pulsing tip cursor.
//
// Self-contained: spawns a small, fixed pool of particles
// (~6-10) and replays a looping float/twinkle animation on each.
// Switches glyph + motion by `trailId`:
//   trail_sparkle  twinkling 4-point stars
//   trail_bubbles  rising translucent circles
//   trail_hearts   little purple hearts rising
//   trail_stars    5-point stars drifting up
//   trail_fire     flame flecks orange→red, rise + fade
//   trail_rainbow  multi-color dots cycling hue
//
// Respects prefers-reduced-motion: renders a single static glyph
// (no looping motion) instead of the animated swarm. Returns null
// for a null / unknown trailId or when inactive.
//
// pointer-events: none throughout — purely decorative.
// =============================================================

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

export interface TentacleTrailProps {
  /** Equipped trail cosmetic id, or null for none. */
  trailId: string | null;
  /** Tip x in the tentacle's local SVG coordinate space. */
  tipX: number;
  /** Tip y in the tentacle's local SVG coordinate space. */
  tipY: number;
  /** Only emit particles when the tentacle is reaching (target set). */
  active: boolean;
}

// Known trail ids — anything else renders nothing.
const KNOWN_TRAILS = new Set([
  "trail_sparkle",
  "trail_bubbles",
  "trail_hearts",
  "trail_stars",
  "trail_fire",
  "trail_rainbow",
]);

// Deterministic pseudo-random so SSR + client agree (no hydration flicker).
function rand(seed: number): number {
  const x = Math.sin(seed * 99.137 + 13.17) * 43758.5453;
  return x - Math.floor(x);
}

interface Particle {
  /** Spawn offset from the tip (local px). */
  ox: number;
  oy: number;
  /** Horizontal drift over the lifetime (local px). */
  drift: number;
  /** Per-particle scale. */
  scale: number;
  /** Animation duration (s). */
  dur: number;
  /** Stagger delay (s). */
  delay: number;
}

function buildParticles(count: number, seedBase: number): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const s = seedBase + i * 7;
    out.push({
      ox: (rand(s) - 0.5) * 14,
      oy: (rand(s + 1) - 0.5) * 8,
      drift: (rand(s + 2) - 0.5) * 22,
      scale: 0.65 + rand(s + 3) * 0.7,
      dur: 1.1 + rand(s + 4) * 0.9,
      delay: rand(s + 5) * 1.4,
    });
  }
  return out;
}

// 4-point sparkle star path (centered at 0,0, ~radius 6).
const SPARKLE_PATH =
  "M0 -6 Q1 -1 6 0 Q1 1 0 6 Q-1 1 -6 0 Q-1 -1 0 -6 Z";

// 5-point star path (centered at 0,0, ~radius 6).
const STAR5_PATH =
  "M0 -6 L1.76 -2.43 L5.7 -1.85 L2.85 0.93 L3.53 4.85 L0 3 L-3.53 4.85 L-2.85 0.93 L-5.7 -1.85 L-1.76 -2.43 Z";

// Small heart path (centered ~0,0).
const HEART_PATH =
  "M0 4 C-4 0.5 -5 -2 -3 -4 C-1.6 -5.4 0 -4.2 0 -3 C0 -4.2 1.6 -5.4 3 -4 C5 -2 4 0.5 0 4 Z";

// Flame fleck path (a little teardrop / flame, ~radius 6).
const FLAME_PATH =
  "M0 -6 C2.6 -2.5 3.4 -0.5 2.4 2 C1.6 4 -1.6 4 -2.4 2 C-3.4 -0.5 -2.6 -2.5 0 -6 Z";

/** Per-particle glyph + base color, switched on trailId. */
function renderGlyph(trailId: string, i: number): React.ReactNode {
  switch (trailId) {
    case "trail_sparkle":
      return (
        <path
          d={SPARKLE_PATH}
          fill="#fde68a"
          stroke="#fbbf24"
          strokeWidth={0.5}
        />
      );
    case "trail_bubbles":
      return (
        <circle
          r={5}
          fill="rgba(255,255,255,0.18)"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth={1}
        />
      );
    case "trail_hearts":
      return <path d={HEART_PATH} fill="#a855f7" stroke="#7c3aed" strokeWidth={0.5} />;
    case "trail_stars":
      return <path d={STAR5_PATH} fill="#fcd34d" stroke="#f59e0b" strokeWidth={0.4} />;
    case "trail_fire": {
      // Alternate orange → red so the swarm reads as a flame.
      const fill = i % 2 === 0 ? "#fb923c" : "#ef4444";
      return <path d={FLAME_PATH} fill={fill} stroke="#dc2626" strokeWidth={0.4} />;
    }
    case "trail_rainbow": {
      // Cycle hue across the pool.
      const hue = (i * 47) % 360;
      return <circle r={4.5} fill={`hsl(${hue} 90% 60%)`} />;
    }
    default:
      return null;
  }
}

/** Static (reduced-motion) glyph for a trail — one calm mark at the tip. */
function renderStaticGlyph(trailId: string): React.ReactNode {
  switch (trailId) {
    case "trail_sparkle":
      return <path d={SPARKLE_PATH} fill="#fde68a" stroke="#fbbf24" strokeWidth={0.5} opacity={0.85} />;
    case "trail_bubbles":
      return (
        <circle r={5} fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.7)" strokeWidth={1} />
      );
    case "trail_hearts":
      return <path d={HEART_PATH} fill="#a855f7" stroke="#7c3aed" strokeWidth={0.5} opacity={0.9} />;
    case "trail_stars":
      return <path d={STAR5_PATH} fill="#fcd34d" stroke="#f59e0b" strokeWidth={0.4} opacity={0.9} />;
    case "trail_fire":
      return <path d={FLAME_PATH} fill="#fb923c" stroke="#dc2626" strokeWidth={0.4} opacity={0.9} />;
    case "trail_rainbow":
      return <circle r={4.5} fill="hsl(280 90% 62%)" opacity={0.9} />;
    default:
      return null;
  }
}

export function TentacleTrail({ trailId, tipX, tipY, active }: TentacleTrailProps) {
  const reducedMotion = useReducedMotion();

  // Bubbles drift very little (they rise straightish); fire rises fast; the
  // rest are middle-of-the-road. The particle pool is memoized so it stays
  // stable across frames (no re-spawn churn).
  const count = trailId === "trail_fire" ? 8 : 7;
  const seedBase = useMemo(() => {
    // Cheap stable seed from the trail id.
    let h = 0;
    for (let k = 0; k < (trailId?.length ?? 0); k++) {
      h = (h * 31 + trailId!.charCodeAt(k)) % 100000;
    }
    return h + 1;
  }, [trailId]);
  const particles = useMemo(
    () => buildParticles(count, seedBase),
    [count, seedBase],
  );

  if (!trailId || !KNOWN_TRAILS.has(trailId) || !active) return null;

  // Vertical travel: fire/bubbles rise more; others gently float up.
  const rise =
    trailId === "trail_fire" ? -42 : trailId === "trail_bubbles" ? -38 : -32;

  // Sparkle / stars twinkle in place a bit; others mainly translate.
  const twinkles = trailId === "trail_sparkle" || trailId === "trail_stars";

  // ---- Reduced motion: a single static glyph at the tip ----
  if (reducedMotion) {
    return (
      <g
        transform={`translate(${tipX} ${tipY})`}
        style={{ pointerEvents: "none" }}
        aria-hidden
      >
        {renderStaticGlyph(trailId)}
      </g>
    );
  }

  return (
    <g
      transform={`translate(${tipX} ${tipY})`}
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      {particles.map((p, i) => (
        <motion.g
          key={i}
          initial={{ x: p.ox, y: p.oy, opacity: 0, scale: p.scale * 0.5 }}
          animate={{
            x: [p.ox, p.ox + p.drift],
            y: [p.oy, p.oy + rise],
            opacity: [0, 1, 1, 0],
            scale: twinkles
              ? [p.scale * 0.5, p.scale * 1.15, p.scale * 0.7]
              : [p.scale * 0.6, p.scale, p.scale * 0.85],
            ...(trailId === "trail_rainbow"
              ? { rotate: [0, 90] }
              : trailId === "trail_stars"
                ? { rotate: [-20, 25] }
                : {}),
          }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeOut",
            times: [0, 0.25, 0.7, 1],
          }}
          style={{ transformOrigin: "center", transformBox: "fill-box" }}
        >
          {renderGlyph(trailId, i)}
        </motion.g>
      ))}
    </g>
  );
}
