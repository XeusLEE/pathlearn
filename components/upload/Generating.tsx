"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Mascot } from "@/components/gamification";

/**
 * Honest stages, roughly tied to elapsed time. We don't know the actual
 * progress, but at least the copy doesn't fake stages we can't observe.
 */
const STAGES: { atMs: number; label: string }[] = [
  { atMs: 0, label: "Reading your document" },
  { atMs: 3000, label: "Spotting core subjects" },
  { atMs: 9000, label: "Writing questions" },
];

interface GeneratingProps {
  /** Whether the overlay is visible. */
  show: boolean;
  /** Optional cancel handler — surfaced after 8s as a small link. */
  onCancel?: () => void;
}

/**
 * Full-screen delight overlay shown while /api/generate runs.
 * Animated mascot, three honest stages, indeterminate progress bar,
 * and a delayed cancel link to escape the single-URL trap.
 */
export function Generating({ show, onCancel }: GeneratingProps) {
  const [elapsed, setElapsed] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!show) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    // Tick every 3s — matches stage cadence and keeps the cancel link timer cheap.
    const id = window.setInterval(() => {
      setElapsed(Date.now() - start);
    }, 1000);
    return () => window.clearInterval(id);
  }, [show]);

  // Pick the latest stage whose threshold has been crossed.
  const stageIdx = STAGES.reduce(
    (acc, s, i) => (elapsed >= s.atMs ? i : acc),
    0
  );
  const stage = STAGES[stageIdx];
  const showCancel = elapsed >= 8000 && !!onCancel;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="generating"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="dot-grid-bg fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 backdrop-blur-sm px-6 pt-safe pb-safe"
          aria-live="polite"
          aria-busy="true"
          role="status"
        >
          {/* Bouncing mascot */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 14 }}
            className="relative z-10 mb-6"
          >
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 rounded-full blur-2xl opacity-60"
                style={{
                  background:
                    "radial-gradient(closest-side, #ce82ff, transparent 70%)",
                }}
              />
              <motion.div
                animate={{ y: prefersReducedMotion ? 0 : [0, -14, 0] }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : {
                        duration: 1.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }
                }
                className="relative flex items-center justify-center"
              >
                <Mascot size={104} mood="thinking" bob={false} />
              </motion.div>
              {/* Tiny floating sparkles */}
              <motion.span
                aria-hidden
                animate={
                  prefersReducedMotion
                    ? { opacity: 1 }
                    : { y: [-2, -16, -2], opacity: [0.4, 1, 0.4] }
                }
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 2, repeat: Infinity }
                }
                className="absolute -top-2 -right-2 text-2xl"
              >
                ✨
              </motion.span>
              <motion.span
                aria-hidden
                animate={
                  prefersReducedMotion
                    ? { opacity: 1 }
                    : { y: [0, -10, 0], opacity: [0.3, 1, 0.3] }
                }
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 2.4, repeat: Infinity, delay: 0.6 }
                }
                className="absolute -bottom-1 -left-3 text-xl"
              >
                ⭐
              </motion.span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h2
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="font-display relative z-10 text-3xl md:text-4xl font-black text-ink text-center text-balance"
          >
            Building your course
          </motion.h2>

          {/* Stage label — snappier swap than before */}
          <div className="relative z-10 mt-2 h-7 w-full max-w-sm overflow-hidden text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={stage.label}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.36, 0.07, 0.19, 0.97] }}
                className="text-sm md:text-base font-bold text-ink-muted"
              >
                {stage.label}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Indeterminate progress bar */}
          <div className="relative z-10 mt-6 w-full max-w-xs h-3 rounded-full bg-surface-muted overflow-hidden border-2 border-border-soft">
            <motion.div
              className="absolute top-0 bottom-0 w-1/3 rounded-full bg-gradient-to-r from-primary via-primary-light to-primary"
              animate={
                prefersReducedMotion
                  ? { x: "100%" }
                  : { x: ["-100%", "300%"] }
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : {
                      duration: 1.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
            />
          </div>

          <div className="relative z-10 mt-4 text-xs font-bold uppercase tracking-wider text-ink-soft">
            This usually takes 10–25 seconds
          </div>

          {/* Cancel link — appears after 8s. Doesn't abort the fetch (no
             AbortController plumbing here); just clears local loading state
             via the parent so the user can navigate away. */}
          <AnimatePresence>
            {showCancel && (
              <motion.button
                key="cancel"
                type="button"
                onClick={onCancel}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="relative z-10 mt-6 text-sm font-bold text-ink-muted hover:text-ink underline underline-offset-4"
              >
                Cancel
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
