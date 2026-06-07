"use client";

// =============================================================
// <MascotHat /> — hand-drawn inline-SVG hats for the octopus.
//
// Rendered absolutely over the mascot's head by <Mascot />, inside
// the bobbing wrapper so each hat tracks the body bob. Every hat is
// drawn in a shared 120×120 coordinate space matching OctoSvg's
// viewBox (head center ≈ (60,46), head top ≈ y=18) and then scaled
// to the live `size` prop, so positioning is resolution-independent.
//
// Hats are NOT emoji — each is a clean little SVG with the brand's
// rounded, chunky-outline look. A few have tasteful motion (propeller
// spins, halo bobs, crown gleams) that honors prefers-reduced-motion.
// =============================================================

import { motion, useReducedMotion } from "framer-motion";

export function MascotHat({
  hatId,
  size,
}: {
  hatId: string | null;
  size: number;
}) {
  const reduced = !!useReducedMotion();
  if (!hatId) return null;

  const inner = renderHat(hatId, reduced);
  if (!inner) return null;

  // The hat SVG shares OctoSvg's 120×120 space and is overlaid at the
  // exact same size, perfectly registering with the head.
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        display: "block",
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      {inner}
    </svg>
  );
}

// -------------------------------------------------------------
// Per-hat SVG. Each returns a <g> sitting on the head dome.
// -------------------------------------------------------------
function renderHat(id: string, reduced: boolean): React.ReactNode {
  switch (id) {
    case "party_hat":
      return <PartyHat />;
    case "beanie":
      return <Beanie />;
    case "chef_hat":
      return <ChefHat />;
    case "graduation_cap":
      return <GraduationCap />;
    case "propeller":
      return <Propeller reduced={reduced} />;
    case "cowboy_hat":
      return <CowboyHat />;
    case "flower_crown":
      return <FlowerCrown />;
    case "top_hat":
      return <TopHat />;
    case "wizard_hat":
      return <WizardHat reduced={reduced} />;
    case "halo":
      return <Halo reduced={reduced} />;
    case "crown":
      return <Crown reduced={reduced} />;
    case "astronaut_helmet":
      return <AstronautHelmet />;
    default:
      return null;
  }
}

const OUTLINE = "#3a1f5e";

// ---- Party Hat: striped cone + pom ----
function PartyHat() {
  return (
    <g stroke={OUTLINE} strokeWidth="1.4" strokeLinejoin="round">
      {/* Cone */}
      <path d="M60 4 L74 30 L46 30 Z" fill="#f472b6" />
      {/* Stripes */}
      <g stroke="none">
        <path d="M58 12 L62 12 L60.8 16 L57 16 Z" fill="#fbcfe8" opacity="0.95" />
        <path d="M55 20 L65 20 L67 26 L53 26 Z" fill="#fbcfe8" opacity="0.95" />
      </g>
      {/* Brim ellipse */}
      <ellipse cx="60" cy="30" rx="15" ry="3.4" fill="#ec4899" />
      {/* Pom-pom */}
      <circle cx="60" cy="4" r="4" fill="#fde047" stroke={OUTLINE} strokeWidth="1.2" />
    </g>
  );
}

// ---- Beanie: ribbed knit dome + fold ----
function Beanie() {
  return (
    <g stroke={OUTLINE} strokeWidth="1.4" strokeLinejoin="round">
      {/* Knit dome */}
      <path
        d="M40 26 C40 10 80 10 80 26 L80 28 L40 28 Z"
        fill="#ef4444"
      />
      {/* Ribbing */}
      <g stroke="#b91c1c" strokeWidth="1.1" opacity="0.7">
        <path d="M48 14 L46 26" />
        <path d="M56 11 L55 26" />
        <path d="M64 11 L65 26" />
        <path d="M72 14 L74 26" />
      </g>
      {/* Fold band */}
      <rect x="38" y="26" width="44" height="7" rx="3.5" fill="#f87171" />
      {/* Pom on top */}
      <circle cx="60" cy="9" r="4.2" fill="#fecaca" stroke={OUTLINE} strokeWidth="1.2" />
    </g>
  );
}

// ---- Chef Hat: puffy toque ----
function ChefHat() {
  return (
    <g stroke={OUTLINE} strokeWidth="1.4" strokeLinejoin="round">
      {/* Puffy top — three overlapping puffs */}
      <g fill="#ffffff">
        <circle cx="47" cy="14" r="9" />
        <circle cx="60" cy="9" r="10.5" />
        <circle cx="73" cy="14" r="9" />
        <rect x="44" y="14" width="32" height="12" />
      </g>
      {/* Band */}
      <rect x="44" y="24" width="32" height="8" rx="2.5" fill="#f1f5f9" />
      {/* Band pleats */}
      <g stroke="#cbd5e1" strokeWidth="1" opacity="0.8">
        <path d="M52 25 L52 31" />
        <path d="M60 25 L60 31" />
        <path d="M68 25 L68 31" />
      </g>
    </g>
  );
}

// ---- Graduation Cap: mortarboard + tassel ----
function GraduationCap() {
  return (
    <g stroke={OUTLINE} strokeWidth="1.4" strokeLinejoin="round">
      {/* Cap base (head band) */}
      <path d="M48 24 L72 24 L70 32 L50 32 Z" fill="#312e5c" />
      {/* Mortarboard (diamond) */}
      <path d="M60 12 L84 22 L60 30 L36 22 Z" fill="#1e1b3a" />
      {/* Button */}
      <circle cx="60" cy="22" r="2" fill="#f59e0b" stroke={OUTLINE} strokeWidth="0.8" />
      {/* Tassel cord + tail */}
      <path d="M60 22 L80 22 L80 34" fill="none" stroke="#f59e0b" strokeWidth="1.4" />
      <path d="M77 34 L83 34 L81 41 L79 41 Z" fill="#fbbf24" stroke={OUTLINE} strokeWidth="0.8" />
    </g>
  );
}

// ---- Propeller Cap: cap + spinning blades ----
function Propeller({ reduced }: { reduced: boolean }) {
  return (
    <g stroke={OUTLINE} strokeWidth="1.4" strokeLinejoin="round">
      {/* Cap dome — quarter panels */}
      <path d="M40 28 C40 12 80 12 80 28 Z" fill="#fbbf24" />
      <path d="M60 12 L60 28 M48 14 L52 28 M72 14 L68 28" stroke="#d97706" strokeWidth="1.1" fill="none" />
      {/* Brim */}
      <path d="M40 28 Q60 33 80 28 L80 30 Q60 35 40 30 Z" fill="#f59e0b" />
      {/* Stalk */}
      <rect x="58.6" y="6" width="2.8" height="7" rx="1.2" fill="#475569" />
      {/* Spinning blades */}
      <motion.g
        style={{ transformOrigin: "60px 6px" }}
        animate={reduced ? undefined : { rotate: 360 }}
        transition={
          reduced
            ? undefined
            : { duration: 0.9, repeat: Infinity, ease: "linear" }
        }
      >
        <ellipse cx="49" cy="6" rx="11" ry="2.6" fill="#38bdf8" />
        <ellipse cx="71" cy="6" rx="11" ry="2.6" fill="#0ea5e9" />
      </motion.g>
      <circle cx="60" cy="6" r="2.4" fill="#0369a1" stroke={OUTLINE} strokeWidth="0.8" />
    </g>
  );
}

// ---- Cowboy Hat: wide brim + crown ----
function CowboyHat() {
  return (
    <g stroke={OUTLINE} strokeWidth="1.4" strokeLinejoin="round">
      {/* Brim — gentle upturn at the sides */}
      <path
        d="M30 28 Q60 20 90 28 Q60 38 30 28 Z"
        fill="#a16207"
      />
      {/* Crown with crease */}
      <path d="M46 28 Q44 10 60 10 Q76 10 74 28 Z" fill="#b45309" />
      <path d="M60 11 L60 27" stroke="#7c4a08" strokeWidth="1.4" />
      {/* Band */}
      <rect x="46" y="24" width="28" height="5" rx="1.5" fill="#451a03" />
      {/* Band buckle */}
      <rect x="57" y="24" width="6" height="5" rx="1" fill="#fbbf24" stroke={OUTLINE} strokeWidth="0.7" />
    </g>
  );
}

// ---- Flower Crown: ring of little flowers ----
function FlowerCrown() {
  const flowers: { x: number; y: number; c: string; s: number }[] = [
    { x: 40, y: 27, c: "#f472b6", s: 1 },
    { x: 48, y: 21, c: "#fb7185", s: 1.05 },
    { x: 60, y: 18, c: "#facc15", s: 1.15 },
    { x: 72, y: 21, c: "#a78bfa", s: 1.05 },
    { x: 80, y: 27, c: "#34d399", s: 1 },
  ];
  return (
    <g>
      {/* Vine band */}
      <path
        d="M38 30 Q60 22 82 30"
        fill="none"
        stroke="#15803d"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {flowers.map((f, i) => (
        <Flower key={i} x={f.x} y={f.y} color={f.c} scale={f.s} />
      ))}
    </g>
  );
}

function Flower({
  x,
  y,
  color,
  scale,
}: {
  x: number;
  y: number;
  color: string;
  scale: number;
}) {
  const r = 2.6 * scale;
  const d = 3.2 * scale;
  return (
    <g transform={`translate(${x} ${y})`} stroke={OUTLINE} strokeWidth="0.6">
      <circle cx="0" cy={-d} r={r} fill={color} />
      <circle cx={d} cy="0" r={r} fill={color} />
      <circle cx="0" cy={d} r={r} fill={color} />
      <circle cx={-d} cy="0" r={r} fill={color} />
      <circle cx="0" cy="0" r={r * 0.9} fill="#fde68a" />
    </g>
  );
}

// ---- Top Hat: tall band + ribbon ----
function TopHat() {
  return (
    <g stroke={OUTLINE} strokeWidth="1.4" strokeLinejoin="round">
      {/* Brim */}
      <ellipse cx="60" cy="29" rx="22" ry="4.2" fill="#1f2937" />
      {/* Tall crown */}
      <path d="M47 29 L47 6 Q47 3 50 3 L70 3 Q73 3 73 6 L73 29 Z" fill="#111827" />
      {/* Top gloss */}
      <ellipse cx="60" cy="5" rx="11" ry="2.4" fill="#374151" />
      {/* Ribbon band */}
      <rect x="47" y="22" width="26" height="6" fill="#7c3aed" />
      <rect x="56" y="22" width="5" height="6" fill="#a78bfa" />
    </g>
  );
}

// ---- Wizard Hat: starry cone + curl ----
function WizardHat({ reduced }: { reduced: boolean }) {
  return (
    <g stroke={OUTLINE} strokeWidth="1.4" strokeLinejoin="round">
      {/* Cone, slightly bent tip */}
      <path d="M60 28 L52 30 Q44 30 44 30 L60 28 Z" fill="none" />
      <path d="M44 30 Q56 8 66 2 Q70 0 68 4 L76 30 Z" fill="#4338ca" />
      {/* Brim */}
      <ellipse cx="60" cy="30" rx="19" ry="4" fill="#3730a3" />
      {/* Stars */}
      <g fill="#fde047">
        <Star cx={58} cy={20} r={2.4} />
        <Star cx={66} cy={12} r={1.8} />
        <Star cx={62} cy={26} r={1.6} />
      </g>
      {/* Tip sparkle */}
      <motion.g
        fill="#fef9c3"
        animate={reduced ? undefined : { opacity: [0.4, 1, 0.4], scale: [0.8, 1.15, 0.8] }}
        transition={
          reduced
            ? undefined
            : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
        }
        style={{ transformOrigin: "67px 3px" }}
      >
        <Star cx={67} cy={3} r={2} />
      </motion.g>
    </g>
  );
}

// ---- Halo: floating gold ring ----
function Halo({ reduced }: { reduced: boolean }) {
  return (
    <motion.g
      animate={reduced ? undefined : { y: [0, -1.6, 0] }}
      transition={
        reduced
          ? undefined
          : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <ellipse
        cx="60"
        cy="14"
        rx="17"
        ry="5"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="3.4"
        opacity="0.55"
      />
      <ellipse
        cx="60"
        cy="14"
        rx="17"
        ry="5"
        fill="none"
        stroke="#fde047"
        strokeWidth="1.8"
      />
      {/* Soft glow */}
      <ellipse cx="60" cy="14" rx="19" ry="6.4" fill="#fef08a" opacity="0.12" />
    </motion.g>
  );
}

// ---- Crown: gold points + gems + gleam ----
function Crown({ reduced }: { reduced: boolean }) {
  return (
    <g stroke={OUTLINE} strokeWidth="1.4" strokeLinejoin="round">
      {/* Gold body with 5 points */}
      <path
        d="M42 30
           L42 18 L49 24 L55 14 L60 22 L65 14 L71 24 L78 18 L78 30 Z"
        fill="#f59e0b"
      />
      {/* Base band */}
      <rect x="42" y="27" width="36" height="5" rx="1.5" fill="#d97706" />
      {/* Point tip jewels */}
      <circle cx="55" cy="13.5" r="1.6" fill="#fde047" stroke={OUTLINE} strokeWidth="0.6" />
      <circle cx="65" cy="13.5" r="1.6" fill="#fde047" stroke={OUTLINE} strokeWidth="0.6" />
      {/* Center gem */}
      <circle cx="60" cy="26" r="2.6" fill="#ef4444" stroke={OUTLINE} strokeWidth="0.7" />
      <circle cx="50" cy="27" r="1.8" fill="#38bdf8" stroke={OUTLINE} strokeWidth="0.6" />
      <circle cx="70" cy="27" r="1.8" fill="#38bdf8" stroke={OUTLINE} strokeWidth="0.6" />
      {/* Gleam */}
      <motion.g
        fill="#fff"
        stroke="none"
        animate={reduced ? undefined : { opacity: [0, 1, 0] }}
        transition={
          reduced
            ? undefined
            : { duration: 2.2, repeat: Infinity, ease: "easeInOut", times: [0, 0.2, 0.5] }
        }
      >
        <path d="M52 18 l1 2 l2 1 l-2 1 l-1 2 l-1 -2 l-2 -1 l2 -1 z" />
      </motion.g>
    </g>
  );
}

// ---- Astronaut Helmet: glass dome + rim ----
function AstronautHelmet() {
  return (
    <g stroke={OUTLINE} strokeWidth="1.4" strokeLinejoin="round">
      {/* Glass dome around the head */}
      <circle cx="60" cy="42" r="34" fill="rgba(186,230,253,0.34)" stroke="#bae6fd" strokeWidth="2" />
      {/* Inner rim ring */}
      <circle cx="60" cy="42" r="34" fill="none" stroke="#e0f2fe" strokeWidth="0.8" opacity="0.7" />
      {/* Glass reflection streak */}
      <path d="M40 30 Q34 44 42 58" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.55" strokeLinecap="round" />
      <path d="M48 24 Q44 30 46 36" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.4" strokeLinecap="round" />
      {/* Top antenna nub */}
      <rect x="56" y="6" width="8" height="5" rx="2" fill="#e2e8f0" />
      <circle cx="60" cy="5" r="2" fill="#f43f5e" stroke={OUTLINE} strokeWidth="0.7" />
      {/* Side rim bolts */}
      <circle cx="28" cy="46" r="2.4" fill="#cbd5e1" />
      <circle cx="92" cy="46" r="2.4" fill="#cbd5e1" />
    </g>
  );
}

// -------------------------------------------------------------
// Small 5-point star helper used by a few hats.
// -------------------------------------------------------------
function Star({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`);
  }
  return <polygon points={pts.join(" ")} />;
}
