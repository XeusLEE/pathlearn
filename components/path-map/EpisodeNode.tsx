"use client";

import { forwardRef, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Crown } from "lucide-react";
import type { Episode } from "@/lib/types";

export type EpisodeStatus = "locked" | "active" | "completed";

interface EpisodeNodeProps {
  episode: Episode;
  status: EpisodeStatus;
  /** Path's hex theme color — drives the active/completed fill. */
  themeColor: string;
  /** 0..1 representing best-score-based progress to render the gold ring (completed only). */
  progress?: number;
  /** When true, render a BOSS treatment (final/hard episode of a path). */
  isBoss?: boolean;
  onActivate: () => void;
}

/**
 * The big circular episode button. Three visual states: locked (grayscale +
 * lock icon), active (themed + pulsing ring + START flag), completed (themed
 * + gold progress ring + crown badge).
 *
 * When `isBoss` is true the node is enlarged, gets a purple shadow-pop, and
 * shows a "BOSS" pill above it (replacing/extending the START flag).
 */
export const EpisodeNode = forwardRef<HTMLDivElement, EpisodeNodeProps>(
  function EpisodeNode(
    { episode, status, themeColor, progress = 1, isBoss = false, onActivate },
    ref
  ) {
    const [shouldWobble, setShouldWobble] = useState(false);
    const isLocked = status === "locked";
    const isActive = status === "active";
    const isCompleted = status === "completed";
    const difficultyRings = Math.max(0, episode.difficulty - 1);

    const handleClick = () => {
      if (isLocked) {
        // Brief wobble feedback for locked nodes — no haptic (don't reward
        // a blocked tap).
        setShouldWobble(true);
        window.setTimeout(() => setShouldWobble(false), 620);
        return;
      }
      // Only haptic for actionable taps.
      if (typeof navigator !== "undefined") navigator.vibrate?.(10);
      onActivate();
    };

    const fillColor = isLocked ? "var(--color-locked)" : themeColor;
    const fillEdge = isLocked ? "var(--color-locked-dark)" : darken(themeColor, 0.18);

    // Boss nodes get a slightly bigger button + ring.
    const buttonSizeClass = isBoss ? "h-24 w-24" : "h-20 w-20";

    // Gold progress ring math (kept in 100x100 viewBox; ring radius scales via SVG).
    const RING_R = 44;
    const RING_C = 2 * Math.PI * RING_R;

    return (
      // scroll-mt-[140px] keeps the active node clear of the sticky header
      // (logo row + tabs row) when scrollIntoView lands on it.
      <div
        ref={ref}
        className="relative flex flex-col items-center scroll-mt-[140px]"
      >
        {/* BOSS pill — replaces START on a boss node, otherwise renders alongside. */}
        {isBoss && (
          <motion.div
            initial={{ y: -2, opacity: 0, scale: 0.8 }}
            animate={{ y: [0, -6, 0], opacity: 1, scale: 1 }}
            transition={{
              y: { repeat: Infinity, duration: 1.3, ease: "easeInOut" },
              opacity: { duration: 0.35 },
              scale: { type: "spring", stiffness: 300, damping: 18 },
            }}
            className="absolute -top-10 z-30 flex items-center"
            aria-hidden
          >
            <div
              className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-pop-purple"
              style={{
                background: "var(--color-purple)",
                border: "2px solid var(--color-purple-dark)",
              }}
            >
              Boss
            </div>
            <div
              className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2"
              style={{
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: "7px solid var(--color-purple)",
              }}
            />
          </motion.div>
        )}

        {/* Bouncing START flag above active node (skip if boss already labels it). */}
        {isActive && !isBoss && (
          <motion.div
            initial={{ y: -2, opacity: 0, scale: 0.8 }}
            animate={{ y: [0, -6, 0], opacity: 1, scale: 1 }}
            transition={{
              y: { repeat: Infinity, duration: 1.1, ease: "easeInOut" },
              opacity: { duration: 0.35 },
              scale: { type: "spring", stiffness: 300, damping: 18 },
            }}
            className="absolute -top-9 z-30 flex items-center"
            aria-hidden
          >
            <div
              className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white"
              style={{
                background: themeColor,
                boxShadow: `0 3px 0 0 ${darken(themeColor, 0.18)}`,
                border: `2px solid ${darken(themeColor, 0.18)}`,
              }}
            >
              Start
            </div>
            {/* Triangle pointer */}
            <div
              className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2"
              style={{
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: `7px solid ${themeColor}`,
              }}
            />
          </motion.div>
        )}

        {/* The button itself */}
        <motion.button
          type="button"
          onClick={handleClick}
          aria-label={`${episode.title} — ${
            isLocked
              ? "locked"
              : isCompleted
              ? "completed"
              : isBoss
              ? "boss — final challenge"
              : "next up"
          }`}
          aria-disabled={isLocked}
          title={
            isLocked
              ? "Complete the previous episode to unlock."
              : episode.title
          }
          whileHover={isLocked ? undefined : { y: -2 }}
          whileTap={isLocked ? { rotate: -3 } : { scale: 0.94, y: 4 }}
          animate={shouldWobble ? { rotate: [0, -4, 3, -2, 1, 0] } : undefined}
          transition={{ duration: 0.5 }}
          className={`relative flex ${buttonSizeClass} items-center justify-center rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-secondary/40 ${
            isLocked ? "cursor-not-allowed" : "cursor-pointer"
          } ${isActive ? "animate-ring-pulse" : ""}`}
          style={{
            background: fillColor,
            border: `3px solid ${fillEdge}`,
            boxShadow: isBoss
              ? `0 6px 0 0 ${fillEdge}, 0 0 0 4px var(--color-purple-dark)`
              : `0 6px 0 0 ${fillEdge}`,
            // Set the pulse ring color via runtime CSS variable (active only)
            ...(isActive
              ? ({
                  ["--tw-ring-color" as string]: themeColor,
                } as React.CSSProperties)
              : {}),
          }}
        >
          {/* Glossy highlight */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-3 top-2 h-3 rounded-full opacity-50"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0))",
            }}
          />

          {/* Difficulty rings */}
          {!isLocked && difficultyRings > 0 && (
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-1.5 rounded-full"
              style={{
                border: `2px dashed ${darken(themeColor, 0.22)}`,
                opacity: 0.7,
              }}
            />
          )}
          {!isLocked && difficultyRings > 1 && (
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-3 rounded-full"
              style={{
                border: `2px dashed ${darken(themeColor, 0.32)}`,
                opacity: 0.45,
              }}
            />
          )}

          {/* Gold progress ring (completed) */}
          {isCompleted && (
            <svg
              aria-hidden
              className="pointer-events-none absolute -inset-1.5"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r={RING_R}
                fill="none"
                stroke="rgba(255, 200, 0, 0.18)"
                strokeWidth="6"
              />
              <circle
                cx="50"
                cy="50"
                r={RING_R}
                fill="none"
                stroke="var(--color-xp)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${RING_C * Math.max(0, Math.min(1, progress))} ${RING_C}`}
                transform="rotate(-90 50 50)"
              />
            </svg>
          )}

          {/* Center content */}
          {isLocked ? (
            <Lock
              className="h-7 w-7 text-locked-dark"
              strokeWidth={3}
              aria-hidden
            />
          ) : (
            <span
              className={`leading-none drop-shadow-sm select-none ${
                isBoss ? "text-4xl" : "text-3xl"
              }`}
              aria-hidden
            >
              {episode.iconEmoji}
            </span>
          )}

          {/* Crown badge for completed */}
          {isCompleted && (
            <span
              aria-hidden
              className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-xp text-ink shadow-pop-xp border-2 border-white"
            >
              <Crown className="h-3.5 w-3.5" strokeWidth={3} fill="currentColor" />
            </span>
          )}
        </motion.button>

        {/* Caption under the node */}
        <div className="mt-2 max-w-[12rem] text-center">
          <p
            className={`text-[11px] font-extrabold uppercase tracking-wide leading-tight ${
              isLocked ? "text-ink-soft" : "text-ink"
            }`}
          >
            {episode.title}
          </p>
        </div>
      </div>
    );
  }
);

/** Darken a hex color by `pct` (0..1). */
function darken(hex: string, pct: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.round(r * (1 - pct)));
  g = Math.max(0, Math.round(g * (1 - pct)));
  b = Math.max(0, Math.round(b * (1 - pct)));
  return `#${[r, g, b]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}
