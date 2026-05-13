"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Skull } from "lucide-react";
import type { Episode } from "@/lib/types";

interface PreEpisodeIntroProps {
  episode: Episode;
  episodeNumber: number;
  /** Total episodes in the parent path. Used for the subtitle. */
  totalEpisodes?: number;
  pathTitle: string;
  themeColor: string;
  /** Highlight as a "BOSS" stage — final + hardest in path. */
  isBoss?: boolean;
  onStart: () => void;
}

/**
 * Full-screen splash shown before the player begins. Big icon + title + start CTA.
 * Auto-advances after a brief moment so the player isn't blocked. Tapping START
 * still works to skip the wait.
 */
export function PreEpisodeIntro({
  episode,
  episodeNumber,
  totalEpisodes,
  pathTitle,
  themeColor,
  isBoss,
  onStart,
}: PreEpisodeIntroProps) {
  const total = episode.questions.length;

  // Auto-advance — gives the user a beat to see the icon/title, then drops them
  // into the first question. Manual tap still works.
  useEffect(() => {
    const t = window.setTimeout(onStart, 1500);
    return () => window.clearTimeout(t);
  }, [onStart]);

  const subtitle = totalEpisodes
    ? `Episode ${episodeNumber} of ${totalEpisodes} · ${total} question${
        total === 1 ? "" : "s"
      }`
    : `Episode ${episodeNumber} · ${total} question${total === 1 ? "" : "s"}`;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-between px-6 pt-safe pb-safe">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center pb-6 pt-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-xs font-black uppercase tracking-[0.18em] text-ink-muted"
        >
          {pathTitle}
        </motion.div>

        {isBoss ? (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 14,
              delay: 0.05,
            }}
            className="mb-4 inline-flex items-center gap-1.5 rounded-pill bg-heart px-4 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-white shadow-pop-heart"
          >
            <Skull className="h-3.5 w-3.5" strokeWidth={3} />
            Boss stage
          </motion.div>
        ) : null}

        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 16 }}
          className="relative mb-8 flex h-32 w-32 items-center justify-center rounded-full"
          style={{
            background: themeColor,
            boxShadow: `0 8px 0 0 ${shade(themeColor, -0.28)}`,
          }}
        >
          <span className="text-7xl drop-shadow-sm">
            {episode.iconEmoji}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display mb-3 text-3xl tracking-tight leading-tight text-ink"
        >
          {episode.title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mb-6 max-w-sm text-base text-ink-muted"
        >
          {episode.description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xs font-black uppercase tracking-[0.18em] text-ink-soft"
        >
          {subtitle}
          <span className="mx-2 text-ink-soft">·</span>
          <span aria-label={`Difficulty ${episode.difficulty} of 3`}>
            {"⭐".repeat(episode.difficulty)}
            <span className="opacity-30">
              {"⭐".repeat(3 - episode.difficulty)}
            </span>
          </span>
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25, type: "spring", stiffness: 200 }}
        className="mb-4 w-full max-w-md"
      >
        <button
          type="button"
          onClick={onStart}
          className="btn-pop w-full text-white"
          style={{
            background: themeColor,
            boxShadow: `0 4px 0 0 ${shade(themeColor, -0.2)}`,
          }}
        >
          <Play className="mr-2 h-5 w-5" fill="currentColor" strokeWidth={0} />
          Start
        </button>
      </motion.div>
    </main>
  );
}

/** Darken/lighten a hex by `pct` (-1..1). */
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
