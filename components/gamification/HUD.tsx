"use client";

// =============================================================
// <HUD /> — compact horizontal stats bar (streak / xp / hearts).
// Used in the /learn page header. Hearts pill expands a tiny
// popover with a "Refill all" button when hearts < MAX_HEARTS.
// XP slot is a DailyGoalRing (level + daily goal control).
// Side-effect: the FIRST mounted HUD also mounts a single
// <ToastHost /> so achievement toasts have somewhere to land.
// =============================================================

import { useEffect, useRef, useState } from "react";
import { Flame, Heart, Plus } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  MAX_HEARTS,
  selectStreakAtRisk,
  useApp,
} from "@/lib/store";
import { DailyGoalRing } from "./DailyGoalRing";
import { ToastHost } from "./AchievementToast";

export interface HUDProps {
  className?: string;
  /** Hide individual pills if not relevant. */
  show?: { streak?: boolean; xp?: boolean; hearts?: boolean };
}

// Module-level guard: render exactly one ToastHost regardless of
// how many HUDs the page mounts. We can't edit app/layout.tsx, so
// HUD owns the single global toast surface.
let toastHostMounted = 0;

function useToastHostSingleton() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    toastHostMounted += 1;
    if (toastHostMounted === 1) setActive(true);
    return () => {
      toastHostMounted -= 1;
      if (toastHostMounted === 0) setActive(false);
    };
  }, []);
  return active;
}

// Format a millis-distance as "MM:SS". For very long distances
// (>= 1h) we still format mm:ss capped to 99:59 — Pathlearn refill
// is 30min so this never realistically overflows.
function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.min(99, Math.floor(total / 60));
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface PillButtonProps {
  className: string;
  label: string;
  onClick?: () => void;
  /** When true, the pill subtly pulses (e.g. streak-at-risk warning). */
  pulse?: boolean;
  /** Optional small chip overlay (top-right). */
  chip?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Wobble-on-tap pill. Shared by all stats so the interaction is
 * consistent. Wrapped in `tap-target` so the hit area is ≥44×44
 * even when the visual pill is smaller.
 */
function PillButton({
  className,
  label,
  onClick,
  pulse,
  chip,
  children,
}: PillButtonProps) {
  const [wobble, setWobble] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const animate = wobble
    ? { rotate: [0, -3, 2, 0] }
    : pulse && !prefersReducedMotion
    ? { scale: [1, 1.06, 1] }
    : { rotate: 0, scale: 1 };
  const transition = wobble
    ? { duration: 0.22 }
    : pulse && !prefersReducedMotion
    ? { repeat: Infinity, duration: 1.4, repeatDelay: 2.6 }
    : { duration: 0.18 };
  return (
    <span className="tap-target relative">
      <motion.button
        type="button"
        aria-label={label}
        onClick={() => {
          setWobble((w) => w + 1);
          onClick?.();
        }}
        key={wobble}
        animate={animate}
        transition={transition}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-extrabold text-sm leading-none select-none ${className}`}
      >
        {children}
      </motion.button>
      {chip}
    </span>
  );
}

export function HUD({ className, show }: HUDProps) {
  const streak = useApp((s) => s.streak);
  const hearts = useApp((s) => s.hearts);
  const heartsRefillAt = useApp((s) => s.heartsRefillAt);
  const refillAllHearts = useApp((s) => s.refillAllHearts);
  const streakShields = useApp((s) => s.streakShields);
  const atRisk = useApp(selectStreakAtRisk);

  const renderToastHost = useToastHostSingleton();

  // Hearts countdown — tick every second when refill is pending.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!heartsRefillAt || hearts >= MAX_HEARTS) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [heartsRefillAt, hearts]);

  const refillRemaining =
    heartsRefillAt && hearts < MAX_HEARTS ? heartsRefillAt - now : 0;

  // Tap-states for the popovers.
  const [heartsPop, setHeartsPop] = useState(false);
  const [streakPop, setStreakPop] = useState(false);
  const heartsRef = useRef<HTMLDivElement | null>(null);
  const streakRef = useRef<HTMLDivElement | null>(null);

  // Click-outside to dismiss the hearts/streak popovers.
  useEffect(() => {
    if (!heartsPop && !streakPop) return;
    const onClick = (e: MouseEvent) => {
      if (heartsPop && !heartsRef.current?.contains(e.target as Node))
        setHeartsPop(false);
      if (streakPop && !streakRef.current?.contains(e.target as Node))
        setStreakPop(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [heartsPop, streakPop]);

  const showStreak = show?.streak !== false;
  const showXp = show?.xp !== false;
  const showHearts = show?.hearts !== false;

  return (
    <div
      className={`flex items-center gap-2 ${className ?? ""}`}
      role="group"
      aria-label="Player stats"
    >
      {showStreak && (
        <div className="relative" ref={streakRef}>
          <PillButton
            label={`Streak: ${streak} days${
              streakShields > 0 ? `, ${streakShields} shield(s)` : ""
            }${atRisk ? " — at risk!" : ""}`}
            onClick={() => setStreakPop((v) => !v)}
            pulse={atRisk}
            className={`bg-streak/15 ${
              atRisk ? "ring-2 ring-streak/60" : ""
            } text-streak-dark`}
            chip={
              streakShields > 0 ? (
                <span
                  className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-secondary text-white font-black text-[9px] px-1 leading-none border-2 border-surface tabular-nums"
                  aria-hidden
                >
                  <span className="mr-0.5">{"\u{1F6E1}"}</span>
                  {streakShields}
                </span>
              ) : null
            }
          >
            <Flame
              size={16}
              className="fill-streak text-streak"
              strokeWidth={2.5}
            />
            <span className="tabular-nums">{streak}</span>
          </PillButton>
          <AnimatePresence>
            {streakPop && (
              <motion.div
                className="absolute top-full left-0 mt-2 z-30 w-60 card-pop p-3"
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                transition={{ duration: 0.18 }}
                role="dialog"
              >
                <p className="text-xs font-extrabold uppercase tracking-wider text-streak-dark">
                  {streak}-day streak
                </p>
                {atRisk && (
                  <p className="mt-1 text-xs font-bold text-streak-dark">
                    Study today to keep it alive!
                  </p>
                )}
                {streakShields > 0 && (
                  <p className="mt-2 text-xs font-semibold text-ink-muted">
                    <span className="font-black text-secondary-dark">
                      {streakShields} shield
                      {streakShields === 1 ? "" : "s"}
                    </span>{" "}
                    auto-rescue a missed day. Earn one every 7-day streak.
                  </p>
                )}
                {streakShields === 0 && !atRisk && (
                  <p className="mt-2 text-xs font-semibold text-ink-muted">
                    Earn a streak shield every 7-day streak — it auto-rescues a
                    missed day.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {showXp && <DailyGoalRing />}

      {showHearts && (
        <div className="relative" ref={heartsRef}>
          <PillButton
            label={`Hearts: ${hearts} of ${MAX_HEARTS}`}
            onClick={() => setHeartsPop((v) => !v)}
            className="bg-heart/15 text-heart-dark"
          >
            <Heart
              size={16}
              className="fill-heart text-heart"
              strokeWidth={2.5}
            />
            <span className="tabular-nums">{hearts}</span>
            {hearts < MAX_HEARTS && refillRemaining > 0 && (
              <span className="ml-1 text-[10px] tabular-nums opacity-80 font-bold">
                {formatCountdown(refillRemaining)}
              </span>
            )}
          </PillButton>
          <AnimatePresence>
            {heartsPop && hearts < MAX_HEARTS && (
              <motion.div
                className="absolute top-full right-0 mt-2 z-30 w-56 card-pop p-3"
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                transition={{ duration: 0.18 }}
                role="dialog"
              >
                <p className="text-xs font-bold text-ink-muted">
                  Out of hearts? Top off and keep learning.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    refillAllHearts();
                    setHeartsPop(false);
                  }}
                  className="btn-pop bg-heart text-white shadow-pop-heart mt-2 w-full text-xs py-2"
                >
                  <Plus size={14} className="mr-1" strokeWidth={3} />
                  Refill all
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Single global toast surface — mounted by the first HUD. */}
      {renderToastHost && <ToastHost />}
    </div>
  );
}
