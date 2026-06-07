"use client";

// =============================================================
// <MascotAura /> — ambient effects that surround the mascot.
//
// Rendered by <Mascot /> as an absolutely-positioned, pointer-events-
// none overlay covering the mascot box (size × size). Glow sits behind
// the body; drifting particle layers (petals / snow) sit in front so
// they read as falling past the creature.
//
// Particle motion uses the shared globals.css keyframes
// (aura-pulse / aura-petal-fall / aura-snow-fall, each honoring the
// --drift custom prop) where possible; confetti + lightning use
// framer-motion. All motion respects prefers-reduced-motion.
// =============================================================

import { motion, useReducedMotion } from "framer-motion";

export function MascotAura({
  auraId,
  size,
}: {
  auraId: string | null;
  size: number;
}) {
  const reduced = !!useReducedMotion();
  if (!auraId) return null;

  const content = renderAura(auraId, size, reduced);
  if (!content) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: size,
        height: size,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {content}
    </div>
  );
}

function renderAura(
  id: string,
  size: number,
  reduced: boolean,
): React.ReactNode {
  switch (id) {
    case "aura_glow":
      return <GlowAura reduced={reduced} />;
    case "aura_petals":
      return <PetalAura size={size} reduced={reduced} />;
    case "aura_snow":
      return <SnowAura size={size} reduced={reduced} />;
    case "aura_confetti":
      return <ConfettiAura size={size} reduced={reduced} />;
    case "aura_lightning":
      return <LightningAura reduced={reduced} />;
    default:
      return null;
  }
}

// ---- Soft Glow: pulsing radial halo (behind body) ----
// Uses the shared `aura-pulse` keyframe (globals.css) via inline animation.
function GlowAura({ reduced }: { reduced: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: "-14%",
        borderRadius: "9999px",
        background:
          "radial-gradient(circle at 50% 52%, color-mix(in srgb, var(--mascot-accent, #7c3aed) 55%, transparent) 0%, color-mix(in srgb, var(--mascot-light, #a78bfa) 28%, transparent) 42%, transparent 70%)",
        opacity: reduced ? 0.6 : undefined,
        animation: reduced ? undefined : "aura-pulse 2.6s ease-in-out infinite",
      }}
    />
  );
}

// ---- Falling Petals (in front) ----
function PetalAura({ size, reduced }: { size: number; reduced: boolean }) {
  // Under reduced motion, a frozen mid-air cluster reads as a stray artifact —
  // hide the falling layer entirely (the glow-type auras still give a calm
  // static accent).
  if (reduced) return null;
  // Spread petals across the width, staggered in time, varied drift.
  const petals = [
    { left: 0.12, delay: 0, dur: 4.2, drift: 14, scale: 1, hue: "#f9a8d4" },
    { left: 0.34, delay: 1.1, dur: 4.8, drift: -10, scale: 0.8, hue: "#fbcfe8" },
    { left: 0.55, delay: 0.5, dur: 4.0, drift: 18, scale: 1.1, hue: "#f472b6" },
    { left: 0.74, delay: 2.0, dur: 5.0, drift: -16, scale: 0.9, hue: "#f9a8d4" },
    { left: 0.9, delay: 1.6, dur: 4.4, drift: 8, scale: 0.85, hue: "#fbcfe8" },
  ];
  return (
    <>
      {petals.map((p, i) => (
        <span
          key={i}
          style={
            {
              position: "absolute",
              top: 0,
              left: `${p.left * 100}%`,
              width: 0,
              height: 0,
              ["--drift" as string]: `${p.drift}px`,
              animation: reduced
                ? undefined
                : `aura-petal-fall ${p.dur}s linear ${p.delay}s infinite`,
              opacity: reduced ? 0.6 : undefined,
              transform: reduced ? `translateY(${size * 0.3}px)` : undefined,
            } as React.CSSProperties
          }
        >
          <Petal color={p.hue} scale={p.scale} />
        </span>
      ))}
    </>
  );
}

function Petal({ color, scale }: { color: string; scale: number }) {
  const s = 7 * scale;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 10 10"
      style={{ display: "block", marginLeft: -s / 2 }}
    >
      <path
        d="M5 0 C8 2 9 5 5 10 C1 5 2 2 5 0 Z"
        fill={color}
        stroke="#db2777"
        strokeWidth="0.4"
      />
    </svg>
  );
}

// ---- Snowfall (in front) ----
function SnowAura({ size, reduced }: { size: number; reduced: boolean }) {
  if (reduced) return null;
  const flakes = [
    { left: 0.1, delay: 0, dur: 4.0, drift: 6, r: 2 },
    { left: 0.28, delay: 1.3, dur: 4.6, drift: -5, r: 1.4 },
    { left: 0.46, delay: 0.7, dur: 3.6, drift: 8, r: 2.4 },
    { left: 0.63, delay: 2.1, dur: 4.4, drift: -7, r: 1.6 },
    { left: 0.8, delay: 1.0, dur: 4.0, drift: 4, r: 2 },
    { left: 0.93, delay: 2.6, dur: 5.0, drift: -4, r: 1.3 },
  ];
  return (
    <>
      {flakes.map((f, i) => (
        <span
          key={i}
          style={
            {
              position: "absolute",
              top: 0,
              left: `${f.left * 100}%`,
              width: f.r * 2,
              height: f.r * 2,
              marginLeft: -f.r,
              borderRadius: "9999px",
              background:
                "radial-gradient(circle, #ffffff 0%, #e0f2fe 70%, transparent 100%)",
              boxShadow: "0 0 3px rgba(186,230,253,0.9)",
              ["--drift" as string]: `${f.drift}px`,
              animation: reduced
                ? undefined
                : `aura-snow-fall ${f.dur}s linear ${f.delay}s infinite`,
              opacity: reduced ? 0.7 : undefined,
              transform: reduced ? `translateY(${size * 0.32}px)` : undefined,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

// ---- Confetti Pop: gentle idle confetti dots ----
function ConfettiAura({ size, reduced }: { size: number; reduced: boolean }) {
  const bits = [
    { x: 0.18, y: 0.2, c: "#f472b6", rot: 20 },
    { x: 0.82, y: 0.26, c: "#38bdf8", rot: -30 },
    { x: 0.12, y: 0.62, c: "#fbbf24", rot: 45 },
    { x: 0.86, y: 0.6, c: "#34d399", rot: -15 },
    { x: 0.5, y: 0.1, c: "#a78bfa", rot: 60 },
    { x: 0.7, y: 0.85, c: "#fb7185", rot: -50 },
    { x: 0.3, y: 0.88, c: "#60a5fa", rot: 35 },
  ];
  return (
    <>
      {bits.map((b, i) => {
        const left = b.x * size;
        const top = b.y * size;
        const w = 4;
        const h = 6;
        if (reduced) {
          return (
            <span
              key={i}
              style={{
                position: "absolute",
                left,
                top,
                width: w,
                height: h,
                background: b.c,
                borderRadius: 1,
                opacity: 0.65,
                transform: `rotate(${b.rot}deg)`,
              }}
            />
          );
        }
        return (
          <motion.span
            key={i}
            style={{
              position: "absolute",
              left,
              top,
              width: w,
              height: h,
              background: b.c,
              borderRadius: 1,
            }}
            animate={{
              y: [0, -4, 2, 0],
              rotate: [b.rot, b.rot + 40, b.rot - 20, b.rot],
              opacity: [0.4, 1, 0.7, 0.4],
            }}
            transition={{
              duration: 2.4 + (i % 3) * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: (i / bits.length) * 1.5,
            }}
          />
        );
      })}
    </>
  );
}

// ---- Storm Aura: occasional crackle arcs ----
function LightningAura({ reduced }: { reduced: boolean }) {
  // Two bolts that flash at offset intervals around the body.
  const bolts = [
    { d: "M22 30 L30 44 L24 46 L33 64", delay: 0 },
    { d: "M96 34 L88 48 L94 50 L86 68", delay: 1.4 },
  ];
  return (
    <svg
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        display: "block",
        overflow: "visible",
      }}
    >
      {bolts.map((b, i) => (
        <motion.path
          key={i}
          d={b.d}
          fill="none"
          stroke="#fde047"
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 2px #fef08a)" }}
          animate={
            reduced
              ? { opacity: 0.7 }
              : { opacity: [0, 0, 1, 0.2, 1, 0] }
          }
          transition={
            reduced
              ? undefined
              : {
                  duration: 3.2,
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: b.delay,
                  times: [0, 0.55, 0.62, 0.7, 0.78, 1],
                }
          }
        />
      ))}
    </svg>
  );
}
