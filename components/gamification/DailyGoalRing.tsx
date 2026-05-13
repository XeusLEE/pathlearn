"use client";

// =============================================================
// <DailyGoalRing /> — compact 44×44 SVG progress ring used in the
// HUD as the XP control. Tap opens a popover with current level,
// XP into level, XP to next, and a +/- daily-goal stepper.
// =============================================================

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Plus, Minus } from "lucide-react";
import { selectXpLevel, useApp } from "@/lib/store";

const todayISO = () => new Date().toISOString().slice(0, 10);

export interface DailyGoalRingProps {
  className?: string;
  /** Minimum daily goal (default 10). */
  minGoal?: number;
  /** Maximum daily goal (default 200). */
  maxGoal?: number;
  /** Step value for +/- buttons (default 5). */
  step?: number;
}

const RING_SIZE = 44;
const STROKE = 4;
// circumference = 2πr, r = (size - stroke) / 2
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export function DailyGoalRing({
  className,
  minGoal = 10,
  maxGoal = 200,
  step = 5,
}: DailyGoalRingProps) {
  const xp = useApp((s) => s.xp);
  const xpToday = useApp((s) => s.xpToday);
  const lastXpDate = useApp((s) => s.lastXpDate);
  const dailyGoal = useApp((s) => s.dailyGoal);
  const setDailyGoal = useApp((s) => s.setDailyGoal);

  // Inline daily-progress derivation to avoid a stale-date bug if the
  // user crosses midnight while the page is open. (Mirrors the store's
  // selectDailyProgress logic — duplicated to keep typing local.)
  const liveXpToday = lastXpDate === todayISO() ? xpToday : 0;
  const percent = Math.min(100, Math.round((liveXpToday / dailyGoal) * 100));
  const hit = liveXpToday >= dailyGoal;

  const { level, intoLevel, levelCap } = selectXpLevel(xp);
  const xpToNext = Math.max(0, levelCap - intoLevel);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const [wobble, setWobble] = useState(0);

  // Click-outside to dismiss.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const dash = (percent / 100) * CIRC;

  return (
    <div className={`relative ${className ?? ""}`} ref={ref}>
      <motion.button
        type="button"
        aria-label={`Daily goal: ${liveXpToday} of ${dailyGoal} XP`}
        onClick={() => {
          setWobble((w) => w + 1);
          setOpen((v) => !v);
        }}
        key={wobble}
        animate={wobble ? { rotate: [0, -3, 2, 0] } : { rotate: 0 }}
        transition={{ duration: 0.22 }}
        className="tap-target relative rounded-full bg-xp/15 hover:bg-xp/25 transition-colors px-1"
      >
        <span className="relative inline-flex items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
          {/* Track */}
          <svg
            width={RING_SIZE}
            height={RING_SIZE}
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="absolute inset-0 -rotate-90"
            aria-hidden
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={STROKE}
            />
            <motion.circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--color-xp)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              animate={{ strokeDashoffset: CIRC - dash }}
              initial={false}
              transition={{ type: "spring", stiffness: 120, damping: 22 }}
            />
          </svg>
          <Zap
            size={18}
            className={`fill-xp text-xp-dark ${hit ? "drop-shadow-[0_0_4px_rgba(255,200,0,0.8)]" : ""}`}
            strokeWidth={2.5}
          />
        </span>
      </motion.button>
      <span
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 rounded-full bg-surface text-[9px] font-extrabold text-xp-dark tabular-nums leading-none border border-xp-dark/20"
        aria-hidden
      >
        {liveXpToday}/{dailyGoal}
      </span>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute top-full right-0 mt-2 z-30 w-64 card-pop p-3"
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-label="Daily goal and level"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-ink-muted">
                Level {level}
              </span>
              <span className="text-xs font-bold text-ink-muted tabular-nums">
                {intoLevel}/{levelCap} XP
              </span>
            </div>
            <p className="text-xs font-semibold text-ink-soft tabular-nums">
              {xpToNext} XP to next level
            </p>

            <div className="mt-3 pt-3 border-t border-border-soft">
              <p className="text-xs font-extrabold uppercase tracking-wider text-ink-muted mb-2">
                Daily goal
              </p>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label="Decrease daily goal"
                  onClick={() =>
                    setDailyGoal(Math.max(minGoal, dailyGoal - step))
                  }
                  disabled={dailyGoal <= minGoal}
                  className="tap-target rounded-full bg-surface-muted text-ink hover:bg-border disabled:opacity-40"
                >
                  <Minus size={16} strokeWidth={3} />
                </button>
                <span className="tabular-nums font-black text-2xl text-xp-dark">
                  {dailyGoal}
                </span>
                <button
                  type="button"
                  aria-label="Increase daily goal"
                  onClick={() =>
                    setDailyGoal(Math.min(maxGoal, dailyGoal + step))
                  }
                  disabled={dailyGoal >= maxGoal}
                  className="tap-target rounded-full bg-surface-muted text-ink hover:bg-border disabled:opacity-40"
                >
                  <Plus size={16} strokeWidth={3} />
                </button>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-ink-soft text-center">
                {hit
                  ? "Goal hit — bonus XP from here."
                  : `${Math.max(0, dailyGoal - liveXpToday)} XP to today's goal`}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
