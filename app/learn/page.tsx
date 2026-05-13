"use client";

import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, Flame, Heart, Zap, ShieldCheck } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import {
  useApp,
  selectDailyProgress,
  selectStreakAtRisk,
} from "@/lib/store";
import { EmptyState, PathMap, PathTabs } from "@/components/path-map";
import { PathTentacle, type PathTentacleEvent } from "@/components/path-map/PathTentacle";
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
  const prefersReducedMotion = useReducedMotion();

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

  // === Tentacle event state machine ==========================================
  // Two tentacles (left + right) driven by `PathTentacleEvent`. Each event
  // is timestamped so the PathTentacle's auto-dismiss timer retriggers when
  // the same event type is sent twice in a row (e.g. two consecutive welcomes).
  const [leftEvent, setLeftEvent] = useState<PathTentacleEvent>({
    type: "idle",
  });
  const [leftTs, setLeftTs] = useState<number>(0);
  const [rightEvent, setRightEvent] = useState<PathTentacleEvent>({
    type: "idle",
  });
  const [rightTs, setRightTs] = useState<number>(0);

  // Track the last user interaction (any click/scroll/keypress) so we can
  // fire the "Try this one ↓" idle prompt after >8s of inactivity. Stored
  // in a ref to avoid re-rendering on every mousemove.
  const lastInteractionRef = useRef<number>(Date.now());
  // Welcomed-paths set lives in a ref so a re-render doesn't reset it.
  const welcomedPathsRef = useRef<Set<string>>(new Set());

  // 1) Welcome bubble when activePathId changes — once per session per path.
  useEffect(() => {
    if (!activePath) return;
    if (prefersReducedMotion) return;
    if (welcomedPathsRef.current.has(activePath.id)) return;
    welcomedPathsRef.current.add(activePath.id);
    // Right tentacle pops the welcome.
    setRightEvent({
      type: "react",
      message: `Welcome to ${activePath.title}!`,
      durationMs: 3200,
    });
    setRightTs(Date.now());
  }, [activePath, prefersReducedMotion]);

  // 2) Celebrate on path completion. Drive BOTH tentacles for max joy.
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (!activePathComplete) return;
    setLeftEvent({
      type: "celebrate",
      message: "Path conquered! 🎉",
      durationMs: 4000,
    });
    setLeftTs(Date.now());
    setRightEvent({
      type: "celebrate",
      message: "Next path?",
      durationMs: 4000,
    });
    setRightTs(Date.now());
  }, [activePathComplete, prefersReducedMotion]);

  // 3) Idle nudge — after 8s of no interaction AND the active path isn't done
  //    yet, the left tentacle whispers "Try this one ↓".
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (!activePath || activePathComplete) return;
    const bump = () => {
      lastInteractionRef.current = Date.now();
    };
    window.addEventListener("pointerdown", bump, { passive: true });
    window.addEventListener("scroll", bump, { passive: true });
    window.addEventListener("keydown", bump);
    const interval = setInterval(() => {
      const idleMs = Date.now() - lastInteractionRef.current;
      if (idleMs > 8000) {
        setLeftEvent({
          type: "react",
          message: "Try this one ↓",
          durationMs: 3000,
        });
        setLeftTs(Date.now());
        // Reset the timer so we don't spam — next nudge ~8s after this one.
        lastInteractionRef.current = Date.now();
      }
    }, 2000);
    return () => {
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("scroll", bump);
      window.removeEventListener("keydown", bump);
      clearInterval(interval);
    };
  }, [activePath, activePathComplete, prefersReducedMotion]);

  // 3b) Locked-tap reaction — EpisodeNode now dispatches a custom event when
  //     the user taps a locked node. Pop a helpful bubble.
  useEffect(() => {
    if (prefersReducedMotion) return;
    const handler = () => {
      setLeftEvent({
        type: "react",
        message: "Finish the one before first 🔒",
        durationMs: 2800,
      });
      setLeftTs(Date.now());
    };
    window.addEventListener("pathlearn:locked-tap", handler);
    return () => window.removeEventListener("pathlearn:locked-tap", handler);
  }, [prefersReducedMotion]);

  // 4) "Reach toward the active episode" — find the first uncompleted episode
  //    node on screen and pass its y-coordinate to the left tentacle so it
  //    bends in that direction. We only update when no transient event (react /
  //    celebrate) is active, so reactions take precedence over the gesture.
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (!activePath) return;
    if (leftEvent.type !== "idle" && leftEvent.type !== "reach") return;

    const targetEpisode = activePath.episodes.find(
      (ep) => !completedEpisodes[ep.id],
    );
    if (!targetEpisode) return;

    // Find the rendered node via its DOM id (PathMap renders episodes with
    // sequential anchors); fall back to a best-effort selector. If we can't
    // find it, leave the tentacle idle rather than guessing.
    let raf = 0;
    const measure = () => {
      const el =
        document.querySelector(`[data-episode-id="${targetEpisode.id}"]`) ||
        document.querySelector(".scroll-mt-\\[140px\\]");
      if (el) {
        const rect = (el as HTMLElement).getBoundingClientRect();
        setLeftEvent({ type: "reach", targetY: rect.top + rect.height / 2 });
        setLeftTs(Date.now());
      }
    };
    raf = window.requestAnimationFrame(measure);
    const onScroll = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
    // Intentionally omit leftEvent.type from deps to avoid resubscribing on
    // every reach-event update; we re-read it via the guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, completedEpisodes, prefersReducedMotion]);

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
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-bg pb-safe">
      {/* Subtle dot-grid backdrop — replaces the layered blur-3xl blobs. */}
      <div
        aria-hidden
        className="dot-grid-bg pointer-events-none fixed inset-0 -z-10 opacity-60"
      />

      {/* Peeking tentacles — proactive teammates that bend toward the active
          episode, celebrate path completion, and pop helpful speech bubbles. */}
      <PathTentacle
        anchor="left"
        baseTopPct={44}
        length={160}
        thickness={56}
        curl="in"
        event={leftEvent}
        eventTimestamp={leftTs}
        className="pointer-events-none fixed z-0 hidden lg:block"
      />
      <PathTentacle
        anchor="right"
        baseTopPct={72}
        length={130}
        thickness={48}
        curl="out"
        event={rightEvent}
        eventTimestamp={rightTs}
        className="pointer-events-none fixed z-0 hidden lg:block"
      />
      {/* Mobile companion — compact tentacle pinned to the bottom-left so
          mobile users still get the proactive nudges + speech bubbles. */}
      <PathTentacle
        anchor="left"
        length={90}
        thickness={32}
        curl="in"
        event={leftEvent}
        eventTimestamp={leftTs}
        className="pointer-events-none fixed z-0 lg:hidden"
        style={{ top: "auto", bottom: "5rem" }}
      />

      {/* Sticky header */}
      <header className="compact-landscape-header sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
        <div className="pt-safe" />
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            aria-label="Exit to home"
            className="tap-target shrink-0 rounded-full border-2 border-border bg-surface text-ink-muted shadow-pop-soft transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={3} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tracking-tight text-ink line-clamp-2 leading-snug break-words">
              {course.documentTitle}
            </p>
            {course.isDemoMode && (
              <span className="mt-0.5 inline-flex items-center rounded-sm bg-purple/15 px-1 py-0 text-[8px] font-black uppercase tracking-[0.14em] text-purple-dark leading-tight">
                Demo
              </span>
            )}
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
                x: prefersReducedMotion ? 0 : [0, -1, 1, -1, 0],
              }}
              exit={{ y: -8, opacity: 0 }}
              transition={{
                y: { type: "spring", stiffness: 200, damping: 18 },
                opacity: { duration: 0.25 },
                x: prefersReducedMotion
                  ? { duration: 0 }
                  : {
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
              <div className="mx-auto mb-4 flex max-w-md items-start gap-3 px-4 sm:px-6">
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
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink leading-[1.05] text-balance break-words">
                    {activePath.title}
                  </h1>
                  <p className="mt-1 text-sm leading-snug text-ink-muted break-words">
                    {activePath.description}
                  </p>
                  {course.summary && (
                    <p className="mt-1.5 text-xs italic leading-snug text-ink-muted break-words">
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
