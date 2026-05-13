"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { MAX_HEARTS } from "@/lib/store";

interface TopBarProps {
  /** Number of questions answered (0..total). */
  progress: number;
  total: number;
  hearts: number;
  themeColor?: string;
  onClose: () => void;
  /** Suppresses heart animations and shows a "Practice" pill. */
  practiceMode?: boolean;
}

/**
 * Sticky header for the quiz player. Renders:
 *   [×]  ████████░░░░░░  ♥♥♥♥♡
 * Big tap target on the close button. Progress bar animates with framer-motion.
 */
export function TopBar({
  progress,
  total,
  hearts,
  themeColor,
  onClose,
  practiceMode,
}: TopBarProps) {
  const pct = total === 0 ? 0 : Math.min(1, progress / total);
  const accent = themeColor ?? "var(--color-primary)";

  // Track hearts changes to play a brief scale pulse + floating "-1".
  const prevHearts = useRef(hearts);
  const [pulseKey, setPulseKey] = useState(0);
  const [floatId, setFloatId] = useState<number | null>(null);
  const floatCounter = useRef(0);

  useEffect(() => {
    if (practiceMode) {
      prevHearts.current = hearts;
      return;
    }
    if (hearts < prevHearts.current) {
      setPulseKey((k) => k + 1);
      const id = ++floatCounter.current;
      setFloatId(id);
      const t = window.setTimeout(() => {
        setFloatId((curr) => (curr === id ? null : curr));
      }, 700);
      prevHearts.current = hearts;
      return () => window.clearTimeout(t);
    }
    prevHearts.current = hearts;
  }, [hearts, practiceMode]);

  return (
    <header className="sticky top-0 z-30 bg-bg/95 pt-safe backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close quiz"
          className="tap-target shrink-0 rounded-full text-ink-muted transition-colors hover:bg-surface-muted active:bg-surface-muted"
        >
          <X className="h-6 w-6" strokeWidth={3} />
        </button>

        {/* Progress bar */}
        <div
          className="relative h-4 flex-1 overflow-hidden rounded-pill bg-border-soft"
          aria-label={`Question ${Math.min(progress + 1, total)} of ${total}`}
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-pill"
            style={{ background: accent }}
            initial={false}
            animate={{ width: `${pct * 100}%` }}
            transition={{ type: "spring", stiffness: 220, damping: 30 }}
          >
            {/* Highlight */}
            <div className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/45" />
          </motion.div>
        </div>

        {/* Practice pill (replaces hearts when in practice mode) */}
        {practiceMode ? (
          <div
            className="flex shrink-0 items-center gap-1 rounded-pill bg-secondary-soft px-3 py-1.5"
            title="Practice mode — no hearts lost"
          >
            <span className="text-xs font-black uppercase tracking-wider text-secondary-dark">
              Practice
            </span>
          </div>
        ) : (
          <div className="relative flex shrink-0 items-center gap-1 rounded-pill bg-surface-muted px-2.5 py-1.5">
            <Heart
              className="h-5 w-5 text-heart"
              fill="currentColor"
              strokeWidth={2}
            />
            <motion.span
              key={pulseKey}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.35, 1] }}
              transition={{ duration: 0.32, ease: "easeOut" }}
              className="text-sm font-black tabular-nums text-heart"
            >
              {Math.max(0, hearts)}
            </motion.span>
            <span className="sr-only">
              {hearts} of {MAX_HEARTS} hearts remaining
            </span>

            {/* Floating "-1" */}
            <AnimatePresence>
              {floatId !== null ? (
                <motion.span
                  key={floatId}
                  initial={{ y: 0, opacity: 0 }}
                  animate={{ y: -22, opacity: 1 }}
                  exit={{ y: -36, opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="pointer-events-none absolute right-2 top-1 text-xs font-black text-heart"
                  aria-hidden="true"
                >
                  -1
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
}
