"use client";

// =============================================================
// <StreakBadge /> — flame + day count pill. Same look as the HUD
// streak chip but defaults to a slightly larger size for use as a
// standalone element (e.g. course header / completion screens).
// When the user has streakShields > 0, a small shield chip floats
// in the top-right corner.
// =============================================================

import { Flame } from "lucide-react";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";

export interface StreakBadgeProps {
  /** Override the streak count. Defaults to the value from the store. */
  count?: number;
  size?: "sm" | "md" | "lg";
  /** Override shield count (for stories/tests). Defaults to store. */
  shields?: number;
  /** Hide the shield indicator chip even if shields > 0. */
  hideShields?: boolean;
  className?: string;
}

const SIZES: Record<
  NonNullable<StreakBadgeProps["size"]>,
  { pad: string; text: string; icon: number; chip: string }
> = {
  sm: { pad: "px-2.5 py-1", text: "text-sm", icon: 14, chip: "text-[9px]" },
  md: { pad: "px-3.5 py-1.5", text: "text-base", icon: 18, chip: "text-[10px]" },
  lg: { pad: "px-5 py-2.5", text: "text-2xl", icon: 26, chip: "text-xs" },
};

export function StreakBadge({
  count,
  size = "md",
  shields,
  hideShields,
  className,
}: StreakBadgeProps) {
  const storeStreak = useApp((s) => s.streak);
  const storeShields = useApp((s) => s.streakShields);
  const value = count ?? storeStreak;
  const shieldCount = shields ?? storeShields;
  const s = SIZES[size];
  const showShieldChip = !hideShields && shieldCount > 0;

  return (
    <span className="relative inline-flex">
      <motion.span
        className={`inline-flex items-center gap-1.5 rounded-full bg-streak/15 text-streak-dark font-extrabold ${s.pad} ${s.text} ${
          className ?? ""
        }`}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 16 }}
      >
        <Flame
          size={s.icon}
          className="fill-streak text-streak"
          strokeWidth={2.5}
        />
        <span className="tabular-nums">{value}</span>
      </motion.span>
      {showShieldChip && (
        <span
          className={`absolute -top-1 -right-1 inline-flex items-center gap-0.5 rounded-full bg-secondary text-white font-black px-1 leading-none border-2 border-surface ${s.chip}`}
          aria-label={`${shieldCount} streak shield${shieldCount === 1 ? "" : "s"}`}
        >
          <span aria-hidden>{"\u{1F6E1}"}</span>
          <span className="tabular-nums">{shieldCount}</span>
        </span>
      )}
    </span>
  );
}
