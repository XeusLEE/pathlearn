"use client";

import type { LearningPath } from "@/lib/types";
import { motion } from "framer-motion";

interface PathTabsProps {
  paths: LearningPath[];
  activePathId: string;
  /** Map of completion counts per path id. */
  progressByPathId: Record<string, { done: number; total: number }>;
  onSelect: (pathId: string) => void;
}

/**
 * Horizontally-scrollable pill tabs for switching between LearningPaths.
 *
 * Responsive strategy (hybrid compact + scroll):
 * - Below `sm:` (640px): inactive tabs collapse to emoji + counter only.
 *   Active tab always shows its full title. This guarantees 3–4 paths fit
 *   at 320–390px while still telling the user which path is selected.
 * - At `sm:` and above: every tab shows its full title.
 * - A right-edge gradient mask hints at horizontal overflow when present.
 */
export function PathTabs({
  paths,
  activePathId,
  progressByPathId,
  onSelect,
}: PathTabsProps) {
  return (
    <div className="relative w-full">
      <div
        className="no-scrollbar snap-x-mandatory scroll-touch flex w-full items-stretch gap-2 overflow-x-auto pb-3 pl-4 pr-6 pt-2"
        role="tablist"
        aria-label="Learning paths"
        style={{
          scrollPaddingLeft: "1rem",
          WebkitMaskImage:
            "linear-gradient(to right, black 0%, black 92%, transparent 100%)",
          maskImage:
            "linear-gradient(to right, black 0%, black 92%, transparent 100%)",
        }}
      >
        {paths.map((path) => {
          const isActive = path.id === activePathId;
          const progress = progressByPathId[path.id] ?? {
            done: 0,
            total: path.episodes.length,
          };
          return (
            <motion.button
              key={path.id}
              role="tab"
              aria-selected={isActive}
              aria-label={`${path.title} (${progress.done} of ${progress.total} complete)`}
              onClick={() => {
                if (typeof navigator !== "undefined") navigator.vibrate?.(8);
                onSelect(path.id);
              }}
              whileTap={{ scale: 0.96, y: 2 }}
              animate={{ y: isActive ? -1 : 0 }}
              className="snap-start group relative flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border-2 px-3.5 py-2 text-sm font-extrabold transition-colors"
              style={{
                background: isActive ? hexWithAlpha(path.themeColor, 0.16) : "var(--color-surface)",
                borderColor: isActive ? path.themeColor : "var(--color-border)",
                color: "var(--color-ink)",
                boxShadow: isActive
                  ? `0 3px 0 0 ${path.themeColor}`
                  : "0 3px 0 0 var(--color-border)",
              }}
            >
              <span className="text-base leading-none">{path.iconEmoji}</span>
              {/*
                Title visibility:
                - Active tab: always visible (so the user knows which is selected).
                - Inactive tabs: hidden below sm, visible at sm+.
              */}
              <span
                className={
                  (isActive ? "inline" : "hidden sm:inline") +
                  " max-w-[10rem] truncate text-[0.85rem] tracking-tight"
                }
              >
                {path.title}
              </span>
              <span
                className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums"
                style={{
                  background: isActive
                    ? path.themeColor
                    : "var(--color-surface-muted)",
                  color: isActive ? "#fff" : "var(--color-ink-muted)",
                }}
              >
                {progress.done}/{progress.total}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/** Convert a hex color to rgba() string with the supplied alpha. */
function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
