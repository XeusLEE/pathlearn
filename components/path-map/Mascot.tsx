"use client";

import { motion } from "framer-motion";

export type MascotMood = "idle" | "celebrate" | "wave";

interface MascotProps {
  /** Hex color used for the mini-platform under the mascot. */
  themeColor: string;
  /** Which side of the active node the mascot perches on. */
  side: "left" | "right";
  /** Optional emoji override — defaults to owl. */
  emoji?: string;
  /** Mood drives a brief reactive animation. Defaults to "idle". */
  mood?: MascotMood;
}

/**
 * A tiny pure-CSS mascot character that perches on a platform next to the
 * currently active episode. Bobs gently. The platform is colored by the active
 * path's themeColor so the mascot feels like part of the world.
 *
 * `mood` lets the host trigger a quick reaction (e.g. celebrate when an
 * episode is just completed). Idle = the regular bob.
 */
export function Mascot({
  themeColor,
  side,
  emoji = "🦉",
  mood = "idle",
}: MascotProps) {
  // Per-mood label inside the speech bubble.
  const bubbleLabel =
    mood === "celebrate" ? "Yes!" : mood === "wave" ? "Hey!" : "Hi!";

  // Mood-specific transient animations applied to the emoji wrapper.
  // For "idle" we let the underlying CSS .animate-float-slow do the work.
  const moodAnimate =
    mood === "celebrate"
      ? { y: [0, -16, 0], rotate: [0, -8, 8, 0], scale: [1, 1.12, 1] }
      : mood === "wave"
      ? { rotate: [0, -10, 10, -6, 0] }
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
      className={`pointer-events-none absolute top-1/2 z-20 flex -translate-y-1/2 flex-col items-center ${
        side === "left" ? "right-full mr-2" : "left-full ml-2"
      }`}
    >
      {/* Speech-bubble pointer (subtle) */}
      <motion.div
        key={`bubble-${mood}`}
        initial={{ y: -2, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="mb-1 rounded-full border-2 border-border bg-surface px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-ink shadow-pop-soft"
      >
        {bubbleLabel}
      </motion.div>

      {/* Bobbing emoji — idle uses CSS bob; transient moods overlay their own anim. */}
      <motion.div
        key={`emoji-${mood}`}
        animate={moodAnimate}
        transition={moodTransition}
        className={`text-4xl leading-none drop-shadow-sm select-none ${
          mood === "idle" ? "animate-float-slow" : ""
        }`}
      >
        {emoji}
      </motion.div>

      {/* Little colored platform */}
      <div
        className="-mt-1 h-2 w-10 rounded-full"
        style={{
          background: themeColor,
          boxShadow: `0 3px 0 0 ${shade(themeColor, -0.18)}`,
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
