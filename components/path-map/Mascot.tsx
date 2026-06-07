"use client";

// =============================================================
// Path-map Mascot — a tiny purple octopus perched next to the
// active node on the learning path. The platform tints with the
// path's themeColor so the mascot feels rooted in the level world.
// Public API (themeColor, side, mood, emoji) preserved so other
// agents don't have to update call sites.
// =============================================================

import { motion } from "framer-motion";
import { Mascot as Octopus } from "@/components/gamification/Mascot";
import type { MascotMood as OctoMood } from "@/components/gamification/Mascot";

export type MascotMood = "idle" | "celebrate" | "wave";

interface MascotProps {
  /** Hex color of the path — tints the standing platform. */
  themeColor: string;
  /** Which side of the active node the mascot perches on. */
  side: "left" | "right";
  /** Reserved for back-compat; ignored now that the mascot is an SVG. */
  emoji?: string;
  /** Mood drives a brief reactive animation. Defaults to "idle". */
  mood?: MascotMood;
}

/**
 * Tiny purple octopus that perches on a colored platform next to the
 * currently active episode. Bobs gently via the gamification Mascot's
 * built-in animation. The platform is tinted toward the path's theme
 * color so the mascot reads as part of the world.
 *
 * `mood` lets the host trigger a quick reaction (e.g. celebrate when
 * an episode is just completed). Idle = the regular bob.
 */
export function Mascot({
  themeColor,
  side,
  mood = "idle",
}: MascotProps) {
  const bubbleLabel =
    mood === "celebrate" ? "Yes!" : mood === "wave" ? "Hey!" : "Hi!";

  // Map our local mood → gamification Mascot mood.
  const octoMood: OctoMood =
    mood === "celebrate" ? "celebrate" : mood === "wave" ? "wave" : "happy";

  // Transient anims layered on top of the gamification Mascot.
  // Idle uses the underlying built-in bob; celebrate / wave overlay
  // a quick wrapper animation so the mascot reads as reacting.
  const moodAnimate =
    mood === "celebrate"
      ? { y: [0, -16, 0], rotate: [0, -8, 8, 0], scale: [1, 1.12, 1] }
      : mood === "wave"
      ? { rotate: [0, -8, 8, -4, 0] }
      : undefined;

  const moodTransition =
    mood === "celebrate"
      ? { duration: 0.95, ease: "easeOut" as const }
      : mood === "wave"
      ? { duration: 0.7, ease: "easeInOut" as const }
      : undefined;

  return (
    <motion.div
      layout
      transition={{
        layout: { type: "spring", stiffness: 220, damping: 26 },
      }}
      // `pointer-events-none` on the wrapper means the bubble + octopus
      // can never block taps on adjacent UI (e.g. right-side path tabs
      // on narrow screens).
      className={`pointer-events-none absolute top-1/2 z-20 flex -translate-y-1/2 flex-col items-center ${
        side === "left" ? "right-full mr-2" : "left-full ml-2"
      }`}
    >
      {/* Speech bubble with a downward-pointing tail aimed at the octopus's
          head/mouth area. The tail is built from two stacked CSS triangles
          (outer = border color, inner = surface) to match the bubble's
          rounded-pill border treatment. */}
      <motion.div
        key={`bubble-${mood}`}
        initial={{ y: -2, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="relative mb-1.5 rounded-full border-2 border-border bg-surface px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-ink shadow-pop-soft"
      >
        {bubbleLabel}
        {/* Tail — border layer (sits 1px below the bubble base so the
            triangle "seam" hides behind the rounded-pill edge). */}
        <span
          aria-hidden
          className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2"
          style={{
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: "5px solid var(--color-border)",
          }}
        />
        {/* Tail — fill layer (offset up by 2px so it sits inside the
            border triangle, creating a clean two-tone arrow). */}
        <span
          aria-hidden
          className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2"
          style={{
            marginTop: -2,
            borderLeft: "4px solid transparent",
            borderRight: "4px solid transparent",
            borderTop: "4px solid var(--color-surface)",
          }}
        />
      </motion.div>

      {/* Octopus wrapper. The inner Mascot handles its own bob & blink. */}
      <motion.div
        key={`octo-${mood}`}
        animate={moodAnimate}
        transition={moodTransition}
        className="leading-none select-none"
        style={{ width: 48, height: 48 }}
      >
        <Octopus
          size={48}
          mood={octoMood}
          // The path map mascot is small and crowded next to the node, so
          // skip the purple radial glow. We rely on the colored platform
          // below for grounding instead.
          backdrop={false}
          bob={mood === "idle"}
          // NOTE: we intentionally do NOT pass cosmeticsEnabled here, so the
          // perched octopus inherits the player's equipped hat / skin / aura
          // from the store (the gamification Mascot defaults cosmeticsEnabled
          // to true and reads equipped cosmetics when no overrides are given).
        />
      </motion.div>

      {/* Colored platform — tinted by path themeColor, with a soft purple
          shadow to keep visual continuity with the octopus. */}
      <div
        className="-mt-1 h-2 w-10 rounded-full"
        style={{
          background: `linear-gradient(180deg, ${themeColor} 0%, ${shade(
            themeColor,
            -0.18
          )} 100%)`,
          boxShadow: `0 3px 0 0 var(--color-purple-dark)`,
        }}
      />
    </motion.div>
  );
}

/** Darken/lighten a hex by `pct` (-1..1). Tiny helper to make the platform pop. */
function shade(hex: string, pct: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const adjust = (c: number) =>
    Math.max(
      0,
      Math.min(255, Math.round(pct >= 0 ? c + (255 - c) * pct : c * (1 + pct)))
    );
  r = adjust(r);
  g = adjust(g);
  b = adjust(b);
  return `#${[r, g, b]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}
