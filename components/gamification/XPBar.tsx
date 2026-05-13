"use client";

// =============================================================
// <XPBar /> — pill-shaped progress bar with a level badge on the
// left and a smooth shimmery gold fill. Self-manages a level-up
// modal: when the level computed from store XP increments, it
// shows <LevelUpModal /> until dismissed.
// =============================================================

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { selectXpLevel, useApp } from "@/lib/store";
import { LevelUpModal } from "./LevelUpModal";

export interface XPBarProps {
  /** Override XP. Defaults to store XP. */
  xp?: number;
  /** When true, do NOT trigger the level-up modal on level change. */
  silent?: boolean;
  className?: string;
}

export function XPBar({ xp, silent = false, className }: XPBarProps) {
  const storeXp = useApp((s) => s.xp);
  const value = xp ?? storeXp;
  const { level, intoLevel, levelCap } = selectXpLevel(value);
  const pct = Math.min(100, Math.max(0, (intoLevel / levelCap) * 100));

  // Track previous level so we can fire the level-up modal exactly
  // once per increment. We also skip the very first render (mount)
  // to avoid celebrating page-load.
  const prevLevel = useRef<number | null>(null);
  const [celebrateLevel, setCelebrateLevel] = useState<number | null>(null);

  useEffect(() => {
    if (prevLevel.current === null) {
      prevLevel.current = level;
      return;
    }
    if (!silent && level > prevLevel.current) {
      setCelebrateLevel(level);
    }
    prevLevel.current = level;
  }, [level, silent]);

  return (
    <>
      <div
        className={`relative flex items-center gap-2 ${className ?? ""}`}
        aria-label={`Level ${level}, ${intoLevel} of ${levelCap} XP`}
      >
        {/* Level badge */}
        <div className="relative flex items-center justify-center min-w-[44px] h-9 px-2.5 rounded-full bg-xp text-ink font-extrabold text-sm shadow-pop-xp border-2 border-xp-dark/30 select-none">
          <span className="text-[10px] mr-1 opacity-70 tracking-wider uppercase">
            Lv
          </span>
          <span className="tabular-nums text-base">{level}</span>
        </div>

        {/* Progress track */}
        <div className="relative flex-1 h-4 rounded-full bg-surface-muted border-2 border-border overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-xp-dark via-xp to-xp-dark"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          >
            {/* shimmery gloss highlight along the top edge */}
            <span className="absolute inset-x-1 top-0.5 h-1 rounded-full bg-white/45 pointer-events-none" />
          </motion.div>
        </div>

        {/* XP fraction text */}
        <span className="tabular-nums text-xs font-bold text-ink-muted min-w-[58px] text-right">
          {intoLevel}/{levelCap}
        </span>
      </div>

      <LevelUpModal
        level={celebrateLevel ?? level}
        open={celebrateLevel !== null}
        onClose={() => setCelebrateLevel(null)}
      />
    </>
  );
}
