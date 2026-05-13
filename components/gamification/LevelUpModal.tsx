"use client";

// =============================================================
// <LevelUpModal /> — full-screen celebratory modal. Fires confetti
// on mount, shows a giant "LEVEL N" headline + mascot, dismisses
// on tapping AWESOME, the backdrop, or Esc. Special level rewards
// (5 = +1 max heart, 7 = streak shield slot, 10 = master tier) are
// shown as cosmetic prose.
// =============================================================

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Mascot } from "./Mascot";
import { vibrate, playTone } from "./feedback";

export interface LevelUpModalProps {
  level: number;
  open: boolean;
  onClose: () => void;
}

const CONFETTI_COLORS = [
  "#58cc02",
  "#1cb0f6",
  "#ff9600",
  "#ce82ff",
  "#ff4b4b",
  "#ffc800",
];

interface LevelReward {
  icon: string;
  text: string;
}

function rewardForLevel(level: number): LevelReward | null {
  if (level === 5) return { icon: "❤️", text: "+1 max heart unlocked" };
  if (level === 7)
    return { icon: "\u{1F6E1}", text: "Streak shield slot unlocked" };
  if (level === 10)
    return { icon: "\u{1F451}", text: "Master tier — leaderboards coming" };
  return null;
}

export function LevelUpModal({ level, open, onClose }: LevelUpModalProps) {
  // Fire confetti + haptic + tone whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    vibrate([10, 40, 20]);
    playTone("complete");
    // Two staggered bursts from each side for a richer feel.
    const fireBurst = (origin: { x: number; y: number }) =>
      confetti({
        particleCount: 90,
        spread: 75,
        startVelocity: 45,
        origin,
        colors: CONFETTI_COLORS,
        disableForReducedMotion: true,
      });
    fireBurst({ x: 0.2, y: 0.4 });
    const t = setTimeout(() => fireBurst({ x: 0.8, y: 0.4 }), 220);
    return () => clearTimeout(t);
  }, [open]);

  // Esc-to-close for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const reward = rewardForLevel(level);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          role="dialog"
          aria-modal="true"
          aria-label={`Level ${level} reached`}
        >
          {/* Backdrop — click to dismiss */}
          <motion.button
            type="button"
            aria-label="Dismiss"
            onClick={onClose}
            className="absolute inset-0 bg-ink/60 backdrop-blur-md cursor-pointer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Card */}
          <motion.div
            className="relative w-full max-w-sm bg-surface rounded-3xl p-8 text-center border-4 border-xp shadow-pop-xp"
            initial={{ scale: 0.6, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 18 }}
          >
            <div className="flex justify-center -mt-20 mb-2">
              <Mascot mood="celebrate" size={120} />
            </div>

            <p className="uppercase tracking-[0.3em] text-xs font-extrabold text-xp-dark/80 mb-1">
              You reached
            </p>

            <motion.h2
              className="font-display font-black text-7xl md:text-8xl text-xp-dark"
              initial={{ scale: 0.5, rotate: -8 }}
              animate={{ scale: 1, rotate: [-8, 4, -2, 0] }}
              transition={{
                scale: {
                  type: "spring",
                  stiffness: 220,
                  damping: 12,
                  delay: 0.1,
                },
                rotate: { duration: 0.6, delay: 0.1, ease: "easeOut" },
              }}
            >
              LEVEL {level}
            </motion.h2>

            <p className="mt-3 text-ink-muted font-bold">
              Level up. Keep going.
            </p>

            {reward && (
              <motion.div
                className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 bg-xp/15 border-2 border-xp/40 text-xp-dark font-extrabold text-sm"
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.42 }}
              >
                <span className="text-base" aria-hidden>
                  {reward.icon}
                </span>
                <span>{reward.text}</span>
              </motion.div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="btn-pop bg-primary text-white shadow-pop-primary mt-6 w-full text-base"
            >
              Awesome
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
