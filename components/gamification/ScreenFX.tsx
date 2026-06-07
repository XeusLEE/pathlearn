"use client";

// =============================================================
// <ScreenFX /> — screen-level, one-shot reaction effects engine.
//
// A fixed full-screen, pointer-events-none overlay that fires a
// short, non-blocking celebration (or a quiet red "wrong" vignette)
// whenever the `reaction.ts` timestamp changes. The CALLER stamps a
// fresh epoch-ms `ts` each time it wants a new effect; this component
// tracks the previous ts via a ref and fires exactly once per change.
//
// The flavour of the effect is themed by the player's currently
// EQUIPPED AURA cosmetic (read from the store):
//   • aura_confetti  -> canvas-confetti burst
//   • aura_lightning -> electric flash + crackling sparks
//   • aura_petals    -> drifting petal puff
//   • aura_snow      -> soft snow puff
//   • aura_glow/none -> tasteful default sparkle + ring pop
//
// Reaction TYPES scale the intensity:
//   • correct -> small celebratory burst from center-bottom
//   • combo   -> bigger burst, scaled by `n` (3/5/7/10)
//   • perfect -> grand finale
//   • wrong   -> brief red edge vignette + subtle shake (NO confetti)
//
// Every effect is < ~900ms and respects prefers-reduced-motion
// (canvas-confetti gets disableForReducedMotion; the DOM overlays
// fall back to a single quiet fade instead of motion-heavy bursts).
// =============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";
import { useApp, selectEquipped } from "@/lib/store";

export type ScreenReaction = {
  type: "correct" | "wrong" | "combo" | "perfect";
  /** Combo size (e.g. 3/5/7/10) — only meaningful for type === "combo". */
  n?: number;
  /** Monotonically increasing epoch-ms stamp; a change fires a new effect. */
  ts: number;
};

type AuraId =
  | "aura_glow"
  | "aura_petals"
  | "aura_snow"
  | "aura_confetti"
  | "aura_lightning"
  | null;

/** A single ephemeral effect instance the overlay renders + auto-removes. */
interface FxInstance {
  /** Unique key so React + AnimatePresence can track it. */
  id: number;
  type: ScreenReaction["type"];
  aura: AuraId;
  n: number;
}

const CONFETTI_COLORS = [
  "#7c3aed",
  "#c084fc",
  "#e879f9",
  "#ffc800",
  "#1cb0f6",
  "#ff4b4b",
];

const PETAL_GLYPHS = ["🌸", "🌷", "🌺"];
const SNOW_GLYPHS = ["❄️", "🌨️", "❅"];
const SPARKLE_GLYPHS = ["✨", "⭐", "💫"];
const LIGHTNING_GLYPHS = ["⚡", "✦", "✧"];

/** Map a combo size onto a 0..1 intensity used to scale burst size. */
function comboIntensity(n: number): number {
  if (n >= 10) return 1;
  if (n >= 7) return 0.78;
  if (n >= 5) return 0.55;
  return 0.34; // 3 (or any smaller milestone)
}

/** Base particle count for a given reaction type before aura scaling. */
function baseParticles(type: ScreenReaction["type"], n: number): number {
  switch (type) {
    case "perfect":
      return 140;
    case "combo":
      return Math.round(40 + comboIntensity(n) * 90);
    case "correct":
      return 36;
    default:
      return 0;
  }
}

export function ScreenFX({ reaction }: { reaction: ScreenReaction | null }) {
  const equipped = useApp(selectEquipped);
  const aura = (equipped?.aura ?? null) as AuraId;
  const reduceMotion = useReducedMotion();

  // Track the last ts we fired for, so re-renders (e.g. store updates) don't
  // re-trigger the same effect. Initialised lazily on first real reaction.
  const lastTs = useRef<number | null>(null);
  const idSeq = useRef(0);

  const [instances, setInstances] = useState<FxInstance[]>([]);

  useEffect(() => {
    if (!reaction) return;
    if (lastTs.current === reaction.ts) return;
    lastTs.current = reaction.ts;

    const id = ++idSeq.current;
    const n = reaction.n ?? 0;

    // ---- canvas-confetti bursts (skip entirely for "wrong") -------------
    if (reaction.type !== "wrong") {
      fireConfetti(reaction.type, aura, n, !!reduceMotion);
    }

    // ---- DOM overlay instance (vignette / sparkle / petals / etc.) ------
    setInstances((prev) => [...prev, { id, type: reaction.type, aura, n }]);

    // Auto-remove after the longest possible effect window (< 900ms).
    const ttl = reaction.type === "wrong" ? 560 : 820;
    const timer = window.setTimeout(() => {
      setInstances((prev) => prev.filter((x) => x.id !== id));
    }, ttl);

    return () => window.clearTimeout(timer);
    // We intentionally key only on `reaction?.ts` — a new stamp == new effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reaction?.ts]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <AnimatePresence>
        {instances.map((fx) => (
          <FxLayer key={fx.id} fx={fx} reduceMotion={!!reduceMotion} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------------------------------
// canvas-confetti — themed per aura, scaled per reaction type.
// ----------------------------------------------------------------------------
function fireConfetti(
  type: ScreenReaction["type"],
  aura: AuraId,
  n: number,
  reduceMotion: boolean,
) {
  const count = baseParticles(type, n);
  if (count <= 0) return;

  // Per-aura palette + shape tweaks.
  let colors = CONFETTI_COLORS;
  if (aura === "aura_lightning") colors = ["#fde047", "#fef9c3", "#a5f3fc", "#ffffff"];
  else if (aura === "aura_petals") colors = ["#f9a8d4", "#fbcfe8", "#fda4af", "#f0abfc"];
  else if (aura === "aura_snow") colors = ["#ffffff", "#e0f2fe", "#bae6fd", "#f8fafc"];
  else if (aura === "aura_glow") colors = ["#c084fc", "#e9d5ff", "#fde68a", "#ffffff"];

  const base: confetti.Options = {
    particleCount: count,
    spread: type === "perfect" ? 120 : type === "combo" ? 90 : 60,
    startVelocity: type === "perfect" ? 48 : 38,
    gravity: aura === "aura_snow" || aura === "aura_petals" ? 0.55 : 0.95,
    drift: aura === "aura_petals" ? 0.6 : 0.1,
    scalar: type === "perfect" ? 1.05 : 0.85,
    ticks: 200,
    colors,
    shapes:
      aura === "aura_lightning"
        ? ["square"]
        : ["circle", "square"],
    disableForReducedMotion: true,
  };

  // Center-bottom origin for celebratory bursts.
  confetti({ ...base, origin: { x: 0.5, y: 0.7 } });

  if (reduceMotion) return; // single shot only for reduced motion

  if (type === "combo") {
    // Two side puffs scaled by combo intensity.
    const side = Math.round(count * 0.45);
    window.setTimeout(() => {
      confetti({ ...base, particleCount: side, angle: 60, origin: { x: 0, y: 0.75 } });
      confetti({ ...base, particleCount: side, angle: 120, origin: { x: 1, y: 0.75 } });
    }, 70);
  } else if (type === "perfect") {
    // Grand finale: side cannons + an overhead burst.
    window.setTimeout(() => {
      confetti({ ...base, particleCount: 80, angle: 60, origin: { x: 0, y: 0.7 } });
      confetti({ ...base, particleCount: 80, angle: 120, origin: { x: 1, y: 0.7 } });
    }, 80);
    window.setTimeout(() => {
      confetti({
        ...base,
        particleCount: 90,
        spread: 140,
        startVelocity: 30,
        origin: { x: 0.5, y: 0.4 },
      });
    }, 280);
  }
}

// ----------------------------------------------------------------------------
// DOM overlay layer — the part canvas-confetti can't do: a red "wrong"
// vignette + shake, the soft ring/glow pop, and emoji puffs themed by aura.
// ----------------------------------------------------------------------------
function FxLayer({
  fx,
  reduceMotion,
}: {
  fx: FxInstance;
  reduceMotion: boolean;
}) {
  if (fx.type === "wrong") {
    return <WrongVignette reduceMotion={reduceMotion} />;
  }

  // For correct/combo/perfect we always show the ring/glow pop. The emoji
  // puff is themed by aura (and skipped for the confetti aura, which already
  // throws a real burst).
  return (
    <>
      <RingPop type={fx.type} n={fx.n} reduceMotion={reduceMotion} />
      {fx.aura !== "aura_confetti" ? (
        <EmojiPuff fx={fx} reduceMotion={reduceMotion} />
      ) : null}
    </>
  );
}

/** Brief red edge vignette + subtle screen shake. No particles. */
function WrongVignette({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={
        reduceMotion
          ? { opacity: [0, 0.5, 0] }
          : { opacity: [0, 0.85, 0.85, 0], x: [0, -7, 6, -4, 3, 0] }
      }
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.4 : 0.52, ease: "easeOut" }}
      style={{
        // Red glow hugging the edges, transparent center.
        boxShadow: "inset 0 0 90px 20px rgba(255, 75, 75, 0.55)",
        background:
          "radial-gradient(ellipse at center, transparent 58%, rgba(255,75,75,0.16) 100%)",
      }}
    />
  );
}

/** A soft expanding ring + glow pop from center-bottom. */
function RingPop({
  type,
  n,
  reduceMotion,
}: {
  type: ScreenReaction["type"];
  n: number;
  reduceMotion: boolean;
}) {
  const intensity =
    type === "perfect" ? 1 : type === "combo" ? comboIntensity(n) : 0.4;
  const size = 180 + intensity * 360;
  const tint =
    type === "perfect"
      ? "rgba(255, 200, 0, 0.55)"
      : "rgba(124, 58, 237, 0.45)";

  if (reduceMotion) {
    return (
      <motion.div
        className="absolute left-1/2 top-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: size, height: size, background: tint, filter: "blur(20px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      />
    );
  }

  return (
    <motion.div
      className="absolute left-1/2 top-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        width: size,
        height: size,
        border: `4px solid ${tint}`,
        boxShadow: `0 0 60px 8px ${tint}`,
      }}
      initial={{ scale: 0.2, opacity: 0 }}
      animate={{ scale: [0.2, 1, 1.25], opacity: [0, 0.9, 0] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}

/** A short-lived puff of aura-themed emoji rising/drifting from center-bottom. */
function EmojiPuff({
  fx,
  reduceMotion,
}: {
  fx: FxInstance;
  reduceMotion: boolean;
}) {
  const glyphs = useMemo(() => glyphsForAura(fx.aura), [fx.aura]);
  const intensity =
    fx.type === "perfect"
      ? 1
      : fx.type === "combo"
      ? comboIntensity(fx.n)
      : 0.4;

  // Count scales with intensity; kept small so it stays "tasteful".
  const baseCount = reduceMotion ? 4 : 10;
  const count = Math.max(4, Math.round(baseCount * (0.5 + intensity)));

  const particles = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => {
        const glyph = glyphs[i % glyphs.length];
        // Spread horizontally around center-bottom.
        const x = (Math.random() - 0.5) * 360 * (0.5 + intensity);
        const rise = 80 + Math.random() * 160 * (0.5 + intensity);
        const drift = (Math.random() - 0.5) * 120;
        const delay = Math.random() * 0.12;
        const fontSize = 18 + Math.random() * 18;
        return { glyph, x, rise, drift, delay, fontSize, key: i };
      }),
    // Re-randomise per instance only (count/glyphs/intensity are stable here).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (reduceMotion) {
    // Quiet fade — a single static cluster, no flight.
    return (
      <motion.div
        className="absolute left-1/2 top-[60%] flex -translate-x-1/2 gap-1.5 text-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.55 }}
      >
        {particles.slice(0, 4).map((p) => (
          <span key={p.key}>{p.glyph}</span>
        ))}
      </motion.div>
    );
  }

  return (
    <div className="absolute left-1/2 top-[70%]">
      {particles.map((p) => (
        <motion.span
          key={p.key}
          className="absolute select-none"
          style={{ fontSize: p.fontSize, lineHeight: 1 }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
          animate={{
            x: p.x + p.drift,
            y: -p.rise,
            opacity: [0, 1, 1, 0],
            scale: [0.4, 1, 1, 0.85],
            rotate: (Math.random() - 0.5) * 60,
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.75,
            delay: p.delay,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {p.glyph}
        </motion.span>
      ))}
    </div>
  );
}

function glyphsForAura(aura: AuraId): string[] {
  switch (aura) {
    case "aura_petals":
      return PETAL_GLYPHS;
    case "aura_snow":
      return SNOW_GLYPHS;
    case "aura_lightning":
      return LIGHTNING_GLYPHS;
    case "aura_glow":
    case "aura_confetti":
    case null:
    default:
      return SPARKLE_GLYPHS;
  }
}
