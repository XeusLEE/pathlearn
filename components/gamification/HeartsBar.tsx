"use client";

// =============================================================
// <HeartsBar /> — row of 5 individual heart icons used INSIDE the
// quiz player. Different from the HUD heart pill: this one shows
// each heart as its own icon and animates a sharp 3-stage sequence
// when one is lost: scale pop → slot shake → ghost float.
// Driven by the store unless `count` is overridden.
// =============================================================

import { Heart } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { MAX_HEARTS, useApp } from "@/lib/store";

export interface HeartsBarProps {
  /** Override hearts count. Defaults to store value. */
  count?: number;
  /** Total heart slots. Defaults to MAX_HEARTS (5). */
  total?: number;
  /** Pixel size of each heart. Default 22. */
  size?: number;
  className?: string;
}

interface GhostHeart {
  id: number;
  index: number;
}

export function HeartsBar({
  count,
  total = MAX_HEARTS,
  size = 22,
  className,
}: HeartsBarProps) {
  const storeHearts = useApp((s) => s.hearts);
  const hearts = count ?? storeHearts;
  const prev = useRef(hearts);
  const [ghosts, setGhosts] = useState<GhostHeart[]>([]);
  const [shakingIndex, setShakingIndex] = useState<number | null>(null);
  const ghostId = useRef(0);

  // Detect heart loss → spawn a "ghost float" emanating from the
  // index that just turned off. Also drives the slot-shake.
  useEffect(() => {
    if (hearts < prev.current) {
      const lostIndex = hearts; // the index that just emptied
      const id = ++ghostId.current;
      setGhosts((g) => [...g, { id, index: lostIndex }]);
      setShakingIndex(lostIndex);
      const tShake = setTimeout(() => setShakingIndex(null), 220);
      const tGhost = setTimeout(() => {
        setGhosts((g) => g.filter((x) => x.id !== id));
      }, 800);
      prev.current = hearts;
      return () => {
        clearTimeout(tShake);
        clearTimeout(tGhost);
      };
    }
    prev.current = hearts;
  }, [hearts]);

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 ${className ?? ""}`}
      aria-label={`${hearts} of ${total} hearts remaining`}
    >
      {Array.from({ length: total }).map((_, i) => {
        const filled = i < hearts;
        const isShaking = shakingIndex === i;
        return (
          <motion.span
            key={i}
            className="relative inline-flex"
            initial={false}
            animate={
              isShaking
                ? { x: [0, -3, 3, -2, 2, 0], scale: filled ? 1 : 0.92 }
                : { x: 0, scale: filled ? 1 : 0.92 }
            }
            transition={
              isShaking
                ? { duration: 0.22, ease: "easeInOut" }
                : { type: "spring", stiffness: 320, damping: 18 }
            }
          >
            <Heart
              size={size}
              strokeWidth={2.5}
              className={
                filled
                  ? "fill-heart text-heart"
                  : "fill-locked text-locked-dark"
              }
            />
          </motion.span>
        );
      })}

      {/* Ghost float overlay: a heart that pops, fades upward, and
          rotates slightly. Rendered absolutely so it doesn't push
          siblings around. Sequence: 80ms scale pop (1→1.25), then
          480ms float-up + fade. */}
      <AnimatePresence>
        {ghosts.map((g) => {
          // Position the ghost over the heart slot that just emptied.
          // Each slot is `size + 6` (gap-1.5 ≈ 6px) wide.
          const slotWidth = size + 6;
          const left = g.index * slotWidth;
          return (
            <motion.span
              key={g.id}
              className="absolute top-0 pointer-events-none"
              style={{ left }}
              initial={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
              animate={{
                opacity: [1, 1, 0],
                scale: [1, 1.25, 0.6],
                y: [0, -2, -32],
                rotate: [0, -4, -18],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.56,
                times: [0, 0.14, 1],
                ease: [0.36, 0.07, 0.19, 0.97],
              }}
            >
              <Heart
                size={size}
                strokeWidth={2.5}
                className="fill-heart text-heart"
              />
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
