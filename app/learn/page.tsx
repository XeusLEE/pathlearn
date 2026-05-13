"use client";

import { Component, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { X, Flame, Heart, Zap, ShieldCheck } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import {
  useApp,
  selectDailyProgress,
  selectStreakAtRisk,
} from "@/lib/store";
import { EmptyState, PathMap, PathTabs } from "@/components/path-map";
import { HUD as RealHUD } from "@/components/gamification";

/**
 * Defensive boundary around Agent 5's HUD: if the import or render fails for
 * any reason, fall back to a tiny inline HUD so the path map still ships.
 */
class HudBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* swallow — render fallback */
  }
  render() {
    if (this.state.failed) return <FallbackHUD />;
    return this.props.children;
  }
}

function HUD() {
  const Cmp = RealHUD ?? FallbackHUD;
  return (
    <HudBoundary>
      <Cmp />
    </HudBoundary>
  );
}

/** Tiny resilient HUD shown if Agent 5's component isn't available yet. */
function FallbackHUD() {
  const xp = useApp((s) => s.xp);
  const streak = useApp((s) => s.streak);
  const hearts = useApp((s) => s.hearts);
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 rounded-full border-2 border-border bg-surface px-2.5 py-1 text-xs font-extrabold text-ink shadow-pop-soft">
        <Zap className="h-3.5 w-3.5 text-xp" strokeWidth={3} fill="currentColor" />
        <span className="tabular-nums">{xp}</span>
      </span>
      <span className="flex items-center gap-1 rounded-full border-2 border-border bg-surface px-2.5 py-1 text-xs font-extrabold text-ink shadow-pop-soft">
        <Flame className="h-3.5 w-3.5 text-streak" strokeWidth={3} fill="currentColor" />
        <span className="tabular-nums">{streak}</span>
      </span>
      <span className="flex items-center gap-1 rounded-full border-2 border-border bg-surface px-2.5 py-1 text-xs font-extrabold text-ink shadow-pop-soft">
        <Heart className="h-3.5 w-3.5 text-heart" strokeWidth={3} fill="currentColor" />
        <span className="tabular-nums">{hearts}</span>
      </span>
    </div>
  );
}

export default function LearnPage() {
  const course = useApp((s) => s.course);
  const completedEpisodes = useApp((s) => s.completedEpisodes);
  const streak = useApp((s) => s.streak);
  const earnedAchievements = useApp((s) => s.earnedAchievements);
  const streakShields = useApp((s) => s.streakShields);
  // selectDailyProgress returns a fresh object on every call — shallow-compare
  // so React 19's snapshot cache doesn't detect "infinite loop". Boolean
  // selectStreakAtRisk is a primitive and doesn't need it.
  const dailyProgress = useApp(useShallow(selectDailyProgress));
  const streakAtRisk = useApp(selectStreakAtRisk);

  const [activePathId, setActivePathId] = useState<string | null>(null);

  // Initialize / reconcile the active path whenever the course changes.
  useEffect(() => {
    if (!course || course.paths.length === 0) {
      setActivePathId(null);
      return;
    }
    setActivePathId((prev) => {
      if (prev && course.paths.some((p) => p.id === prev)) return prev;
      // Default to the first path with an unfinished episode, else first.
      const firstUnfinished = course.paths.find((p) =>
        p.episodes.some((ep) => !completedEpisodes[ep.id])
      );
      return (firstUnfinished ?? course.paths[0]).id;
    });
  }, [course, completedEpisodes]);

  const progressByPathId = useMemo(() => {
    const out: Record<string, { done: number; total: number }> = {};
    if (!course) return out;
    for (const p of course.paths) {
      const done = p.episodes.filter((ep) => completedEpisodes[ep.id]).length;
      out[p.id] = { done, total: p.episodes.length };
    }
    return out;
  }, [course, completedEpisodes]);

  const activePath = useMemo(() => {
    if (!course || !activePathId) return null;
    return course.paths.find((p) => p.id === activePathId) ?? null;
  }, [course, activePathId]);

  // Fully-complete check for the active path → drives the "Path complete!"
  // banner pinned at the top.
  const activePathComplete = useMemo(() => {
    if (!activePath) return false;
    return activePath.episodes.every((ep) => completedEpisodes[ep.id]);
  }, [activePath, completedEpisodes]);

  // Suggest the next unfinished path for the "Next path →" affordance.
  const nextUnfinishedPathId = useMemo(() => {
    if (!course || !activePath) return null;
    const next = course.paths.find(
      (p) =>
        p.id !== activePath.id &&
        p.episodes.some((ep) => !completedEpisodes[ep.id])
    );
    return next?.id ?? null;
  }, [course, activePath, completedEpisodes]);

  if (!course) {
    return <EmptyState />;
  }

  // Course exists but the generator returned no paths — show a friendly
  // recovery card instead of an empty void.
  if (course.paths.length === 0) {
    return (
      <div className="relative min-h-[100dvh] w-full bg-bg pb-safe">
        <div
          aria-hidden
          className="dot-grid-bg pointer-events-none absolute inset-0 opacity-60"
        />
        <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 text-center">
          <span className="mb-4 text-5xl">📭</span>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            We couldn&rsquo;t pull paths from this document
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Try a longer or more structured document — a few hundred words gives
            us enough material to spin up bite-sized episodes.
          </p>
          <Link
            href="/"
            className="btn-pop mt-6 bg-primary text-white shadow-pop-primary border-primary-dark"
          >
            Back to upload
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] w-full bg-bg pb-safe">
      {/* Subtle dot-grid backdrop — replaces the layered blur-3xl blobs. */}
      <div
        aria-hidden
        className="dot-grid-bg pointer-events-none fixed inset-0 -z-10 opacity-60"
      />

      {/* Sticky header */}
      <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
        <div className="pt-safe" />
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-2.5">
          <Link
            href="/"
            aria-label="Exit to home"
            className="tap-target shrink-0 rounded-full border-2 border-border bg-surface text-ink-muted shadow-pop-soft transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={3} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {course.isDemoMode && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-purple/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-purple-dark">
                  Demo
                </span>
              )}
              <p className="truncate text-sm font-bold tracking-tight text-ink">
                {course.documentTitle}
              </p>
            </div>
            {/* Daily-goal mini progress bar under the doc title. */}
            <DailyGoalBar
              xpToday={dailyProgress.xpToday}
              goal={dailyProgress.goal}
              percent={dailyProgress.percent}
              hit={dailyProgress.hit}
            />
          </div>
          {/* HUD slot — Agent 5 — plus optional shield pill + badge count. */}
          <div className="flex shrink-0 items-center gap-2">
            {streakShields > 0 && (
              <span
                className="flex items-center gap-1 rounded-full border-2 border-border bg-surface px-2 py-1 text-[11px] font-extrabold text-ink shadow-pop-soft"
                title={`${streakShields} streak shield${
                  streakShields === 1 ? "" : "s"
                }`}
              >
                <ShieldCheck
                  className="h-3.5 w-3.5 text-secondary"
                  strokeWidth={3}
                />
                <span className="tabular-nums">{streakShields}</span>
              </span>
            )}
            {earnedAchievements.length > 0 && (
              <span
                className="hidden items-center gap-1 rounded-full border-2 border-border bg-surface px-2 py-1 text-[11px] font-extrabold text-ink shadow-pop-soft sm:inline-flex"
                title={`${earnedAchievements.length} badges earned`}
              >
                <span aria-hidden>🏅</span>
                <span className="tabular-nums">
                  {earnedAchievements.length}
                </span>
              </span>
            )}
            <HUD />
          </div>
        </div>

        {/* Tabs row */}
        {activePathId && (
          <PathTabs
            paths={course.paths}
            activePathId={activePathId}
            progressByPathId={progressByPathId}
            onSelect={(id) => {
              setActivePathId(id);
              // Scroll to top of the map so the new path's start is visible.
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          />
        )}
      </header>

      {/* Main map area */}
      <main className="relative pt-4">
        {/* Path-complete celebration — pinned ABOVE the heading. */}
        <AnimatePresence>
          {activePath && activePathComplete && (
            <motion.div
              key={`done-${activePath.id}`}
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 20 }}
              className="mx-auto mb-4 flex w-full max-w-md flex-col items-center gap-2 px-4 text-center"
            >
              <div className="flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-xp bg-xp/15 px-4 py-3 text-sm font-extrabold text-ink shadow-pop-soft">
                <span className="flex items-center gap-2">
                  <span aria-hidden>🏆</span>
                  Path complete!
                </span>
                {nextUnfinishedPathId && (
                  <button
                    type="button"
                    onClick={() => {
                      setActivePathId(nextUnfinishedPathId);
                      if (typeof window !== "undefined") {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    className="rounded-full border-2 border-ink bg-surface px-3 py-1 text-[11px] font-black uppercase tracking-wider text-ink shadow-pop-soft transition-transform active:translate-y-0.5"
                  >
                    Next path →
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Streak-at-risk nudge — only when xpToday is still zero. */}
        <AnimatePresence>
          {streakAtRisk && dailyProgress.xpToday === 0 && (
            <motion.div
              key="streak-nudge"
              initial={{ y: -8, opacity: 0 }}
              animate={{
                y: 0,
                opacity: 1,
                x: [0, -1, 1, -1, 0],
              }}
              exit={{ y: -8, opacity: 0 }}
              transition={{
                y: { type: "spring", stiffness: 200, damping: 18 },
                opacity: { duration: 0.25 },
                x: {
                  repeat: Infinity,
                  repeatDelay: 8,
                  duration: 0.5,
                  ease: "easeInOut",
                },
              }}
              className="mx-auto mb-3 w-full max-w-md px-4"
            >
              <div className="flex items-center gap-2 rounded-2xl border-2 border-streak bg-streak/15 px-3 py-2 text-xs font-extrabold text-ink shadow-pop-soft">
                <span aria-hidden>🔥</span>
                <span className="leading-snug">
                  Don&rsquo;t lose your <span className="tabular-nums">{streak}</span>
                  -day streak — finish one episode today.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {activePath && (
            <motion.div
              key={activePath.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{
                opacity: { duration: 0.18 },
                y: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
              }}
              className="relative"
            >
              {/* Path heading — the visible H1 of the screen. */}
              <div className="mx-auto mb-4 flex max-w-md items-start gap-3 px-6">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-border bg-surface text-2xl shadow-pop-soft"
                  style={{
                    background: hexWithAlpha(activePath.themeColor, 0.15),
                    borderColor: activePath.themeColor,
                  }}
                  aria-hidden
                >
                  {activePath.iconEmoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink leading-[1.05]">
                    {activePath.title}
                  </h1>
                  <p className="mt-1 text-sm leading-snug text-ink-muted">
                    {activePath.description}
                  </p>
                  {course.summary && (
                    <p className="mt-1.5 text-xs italic leading-snug text-ink-muted">
                      &ldquo;{course.summary}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              <PathMap
                path={activePath}
                completedEpisodes={completedEpisodes}
              />

              {/* Bottom breathing room. */}
              <div className="px-6 pb-12" />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

/**
 * Compact daily-goal progress bar shown in the header. The fill bar uses the
 * `bg-xp` token so the color reads the same as XP rewards elsewhere.
 */
function DailyGoalBar({
  xpToday,
  goal,
  percent,
  hit,
}: {
  xpToday: number;
  goal: number;
  percent: number;
  hit: boolean;
}) {
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted">
        <motion.div
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
          className="absolute inset-y-0 left-0 rounded-full bg-xp"
        />
      </div>
      {hit ? (
        <span className="rounded-full bg-xp/20 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-ink">
          ✓ Goal hit!
        </span>
      ) : (
        <span className="text-[10px] font-bold tabular-nums text-ink-soft">
          {xpToday}/{goal} XP
        </span>
      )}
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
