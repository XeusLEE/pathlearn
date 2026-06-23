"use client";

import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, Flame, Heart, Zap, ShieldCheck, ShoppingBag } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useTentaclePointerFollow } from "@/lib/useTentaclePointerFollow";
import {
  useApp,
  selectCoins,
  selectDailyProgress,
  selectStreakAtRisk,
} from "@/lib/store";
import { EmptyState, PathMap, PathTabs } from "@/components/path-map";
import { PathTentacle, type PathTentacleEvent } from "@/components/path-map/PathTentacle";
import { HUD as RealHUD } from "@/components/gamification";
import { CoinIcon } from "@/components/gamification/CoinPill";

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
  const coins = useApp(selectCoins);
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/shop"
        aria-label={`Coins: ${coins.toLocaleString()} — open shop`}
        className="flex items-center gap-1 rounded-full border-2 border-xp/40 bg-xp/15 px-2.5 py-1 text-xs font-extrabold text-ink shadow-pop-soft"
      >
        <CoinIcon size={14} />
        <span className="tabular-nums">{coins.toLocaleString()}</span>
      </Link>
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
  const pathname = usePathname();
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

  // The currently-active (first uncompleted) episode of the active path. This
  // is the DOM target the left tentacle bends toward.
  const nextUncompletedEpisode = useMemo(() => {
    if (!activePath) return null;
    return (
      activePath.episodes.find((ep) => !completedEpisodes[ep.id]) ?? null
    );
  }, [activePath, completedEpisodes]);

  // Selector handed to PathTentacle so it can poll the active node's rect.
  const activeEpisodeSelector = useMemo(
    () =>
      nextUncompletedEpisode
        ? `[data-episode-id="${nextUncompletedEpisode.id}"]`
        : null,
    [nextUncompletedEpisode],
  );

  // === Mobile / desktop boundary =============================================
  // Below this breakpoint we mount ONE bottom tentacle (and it's the speaker);
  // at/above it we mount the left (speaker) + right (silent companion). The
  // boundary mirrors Tailwind's `md` (768px) — wide enough to be a meaningful
  // tablet, narrow enough that phones stay phone-only.
  const MOBILE_MAX_PX = 767;
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth <= MOBILE_MAX_PX,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(max-width: ${MOBILE_MAX_PX}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // === Tentacle event state machine ==========================================
  // The SPEAKER tentacle owns its own event channel. The silent companion has
  // a parallel channel used only for subtle bodily reactions (mood / wiggle).
  // On mobile, the bottom tentacle is the speaker; on desktop+, left is the
  // speaker and right is the silent companion.
  //
  // Each event is timestamped so the PathTentacle's auto-dismiss timer
  // retriggers when the same event type is sent twice in a row.
  const [speakerEvent, setSpeakerEvent] = useState<PathTentacleEvent>({
    type: "idle",
  });
  const [speakerTs, setSpeakerTs] = useState<number>(0);
  const [companionEvent, setCompanionEvent] = useState<PathTentacleEvent>({
    type: "idle",
  });
  const [companionTs, setCompanionTs] = useState<number>(0);

  // Track the last user interaction (any click/scroll/keypress) so we can
  // fire the "Try this one ↓" idle prompt after >8s of inactivity. Stored
  // in a ref to avoid re-rendering on every mousemove.
  const lastInteractionRef = useRef<number>(Date.now());
  // Welcomed-paths set lives in a ref so a re-render doesn't reset it.
  const welcomedPathsRef = useRef<Set<string>>(new Set());

  // === Tab-change quiet window ==============================================
  // After the user taps a PathTabs entry, mute the tentacles for ~1.2s so
  // they don't compete for attention during the slide-in animation.
  const [tabsMuted, setTabsMuted] = useState(false);
  const tabsMuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const muteTentaclesForTabChange = () => {
    setTabsMuted(true);
    if (tabsMuteTimerRef.current) clearTimeout(tabsMuteTimerRef.current);
    tabsMuteTimerRef.current = setTimeout(() => setTabsMuted(false), 1200);
  };
  useEffect(() => {
    return () => {
      if (tabsMuteTimerRef.current) clearTimeout(tabsMuteTimerRef.current);
    };
  }, []);

  // === Active-node viewport position ========================================
  // Drives the left tentacle's `baseTopPct` so it naturally follows the
  // user's focus as they scroll. We sample the active episode's bounding
  // rect on scroll/resize, throttled via rAF. State updates only when the
  // percentage moves >=1.5pp to avoid spurious rerenders.
  const [activeNodeTopPct, setActiveNodeTopPct] = useState<number>(44);
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (!activeEpisodeSelector) return;
    let raf = 0;
    let lastPub = 44;
    const measure = () => {
      const el = document.querySelector(activeEpisodeSelector);
      if (!el || typeof window === "undefined") return;
      const r = (el as HTMLElement).getBoundingClientRect();
      const midY = r.top + r.height / 2;
      const vh = window.innerHeight || 1;
      // Clamp to a comfortable on-screen band so the tentacle never sits
      // pinned at the very top/bottom — keeps it usable as a soft pointer.
      const pct = Math.max(18, Math.min(78, (midY / vh) * 100));
      if (Math.abs(pct - lastPub) >= 1.5) {
        lastPub = pct;
        setActiveNodeTopPct(pct);
      }
    };
    const tick = () => {
      raf = requestAnimationFrame(() => {
        measure();
      });
    };
    measure();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
    };
  }, [activeEpisodeSelector, prefersReducedMotion]);

  // === Pointer-follow: tip tracks hovered/clicked items ====================
  // When the user hovers an episode node OR clicks any interactive element,
  // the speaker tentacle physically reaches its tip onto that element and
  // shows the tip-cursor glow. Hover follows live; a click "locks" the
  // target for ~1.3s so the tap reads as acknowledgment even if the pointer
  // drifts away. When inactive, the tentacle reverts to the active-episode
  // target (its default soft-pointer behavior).
  const pointerReach = useTentaclePointerFollow(!prefersReducedMotion);

  // Derived targeting: pointer-follow wins while active; otherwise fall back
  // to the active-episode selector. The companion joins in only while the
  // user is actively interacting, so its default stays a calm idle wave.
  //
  // The Tentacle's internal solver handles everything: it reads the target
  // + its own base position on every animation frame and extends the tip
  // to land on the target. maxStretch 5 lets the tip reach across the
  // screen; the body's width tapering keeps it from looking like a ribbon.
  const effectiveTargetSelector = pointerReach.active
    ? pointerReach.selector
    : activeEpisodeSelector;
  const effectiveForceReach = pointerReach.active;
  const effectiveReachToTarget = pointerReach.active;
  const effectiveMaxStretch = pointerReach.active ? 5 : 1;
  const effectiveShowTipCursor = pointerReach.active;
  const companionTargetSelector = pointerReach.active
    ? effectiveTargetSelector
    : null;

  // 1) Welcome bubble when activePathId changes — once per session per path.
  //    Only the SPEAKER pops the welcome (single-speaker invariant). The
  //    silent companion gets a non-speaking "ripple" cue at the same time.
  useEffect(() => {
    if (!activePath) return;
    if (prefersReducedMotion) return;
    const isFirstVisit = !welcomedPathsRef.current.has(activePath.id);
    if (isFirstVisit) {
      welcomedPathsRef.current.add(activePath.id);
      setSpeakerEvent({
        type: "react",
        message: `Welcome to ${activePath.title}!`,
        durationMs: 3200,
      });
      setSpeakerTs(Date.now());
    }
    // Silent companion: every path change → small wiggle ripple (no bubble).
    setCompanionEvent({ type: "reach" });
    setCompanionTs(Date.now());
    // Settle the companion back to idle shortly after so it doesn't lock
    // into a permanent reach.
    const t = setTimeout(() => {
      setCompanionEvent({ type: "idle" });
      setCompanionTs(Date.now());
    }, 900);
    return () => clearTimeout(t);
  }, [activePath, prefersReducedMotion]);

  // 2) Celebrate on path completion. Speaker pops the message; companion
  //    celebrates bodily WITHOUT a bubble (single-speaker rule).
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (!activePathComplete) return;
    setSpeakerEvent({
      type: "celebrate",
      message: "Path conquered!",
      durationMs: 4000,
    });
    setSpeakerTs(Date.now());
    // Companion: celebrate animation only (bubble is suppressed via silent prop).
    setCompanionEvent({
      type: "celebrate",
      durationMs: 4000,
    });
    setCompanionTs(Date.now());
  }, [activePathComplete, prefersReducedMotion]);

  // 3) Idle nudge — after 8s of no interaction AND the active path isn't done
  //    yet, the SPEAKER tentacle whispers "Try this one ↓".
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
        setSpeakerEvent({
          type: "react",
          message: "Try this one ↓",
          durationMs: 3000,
        });
        setSpeakerTs(Date.now());
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

  // 3b) Locked-tap reaction — EpisodeNode dispatches a custom event when
  //     the user taps a locked node. SPEAKER pops the helpful bubble.
  useEffect(() => {
    if (prefersReducedMotion) return;
    const handler = () => {
      setSpeakerEvent({
        type: "react",
        message: "Finish the one before first",
        durationMs: 2800,
      });
      setSpeakerTs(Date.now());
    };
    window.addEventListener("pathlearn:locked-tap", handler);
    return () => window.removeEventListener("pathlearn:locked-tap", handler);
  }, [prefersReducedMotion]);

  // 3c) Silent companion: small wave on user scroll. We debounce so it doesn't
  //     spam during long scroll gestures — only fire if there hasn't been a
  //     companion event in the last ~700ms.
  useEffect(() => {
    if (prefersReducedMotion) return;
    let lastFire = 0;
    const onScroll = () => {
      const now = Date.now();
      if (now - lastFire < 700) return;
      lastFire = now;
      setCompanionEvent({ type: "reach" });
      setCompanionTs(now);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [prefersReducedMotion]);

  // 4) Reach toward the active episode is now owned by <PathTentacle />
  //    itself: we hand it a `targetSelector` and it polls the DOM rect per
  //    animation frame, curling the tip toward the live target. No effect
  //    needed here — the wiring is in the JSX below.

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

      {/* Peeking tentacles — proactive teammates that physically reach toward
          the active episode circle, celebrate path completion, and pop
          helpful speech bubbles.

          Speaker/companion split (god-level):
            • DESKTOP/TABLET (≥768px): LEFT is the speaker (wise, curl in),
              RIGHT is the silent visual companion (playful, curl out).
              The LEFT tentacle's base drifts vertically to follow the active
              node so it reads as a soft pointer wherever the user scrolled.
            • MOBILE (≤767px): a single BOTTOM tentacle becomes the speaker
              (curious, curl in). Left + right are hidden.

          Only the speaker shows speech bubbles. The silent companion still
          reacts bodily (scroll wave, path-change ripple, celebrate). */}
      {!isMobile && (
        <>
          <PathTentacle
            key={`left-${pathname}`}
            anchor="left"
            baseTopPct={activeNodeTopPct}
            curl="in"
            event={speakerEvent}
            eventTimestamp={speakerTs}
            targetSelector={effectiveTargetSelector}
            forceReach={effectiveForceReach}
            reachToTarget={effectiveReachToTarget}
            maxStretch={effectiveMaxStretch}
            showTipCursor={effectiveShowTipCursor}
            personality="wise"
            muted={tabsMuted}
            silent={false}
            className="pointer-events-none fixed z-0 tentacle-hide-short-landscape"
          />
          <PathTentacle
            key={`right-${pathname}`}
            anchor="right"
            baseTopPct={72}
            curl="out"
            event={companionEvent}
            eventTimestamp={companionTs}
            targetSelector={companionTargetSelector}
            forceReach={effectiveForceReach}
            reachToTarget={effectiveForceReach}
            maxStretch={effectiveMaxStretch}
            showTipCursor={false}
            personality="playful"
            muted={tabsMuted}
            silent={true}
            className="pointer-events-none fixed z-0 tentacle-hide-short-landscape"
          />
        </>
      )}
      {isMobile && (
        /* Mobile speaker — compact tentacle pinned to the bottom-left.
            Gets the active-node target so the tip points up-right toward the
            current episode, and owns the bubble channel for mobile users. */
        <PathTentacle
          key={`mobile-${pathname}`}
          anchor="left"
          curl="in"
          event={speakerEvent}
          eventTimestamp={speakerTs}
          targetSelector={effectiveTargetSelector}
          forceReach={effectiveForceReach}
          reachToTarget={effectiveReachToTarget}
          maxStretch={effectiveMaxStretch}
          showTipCursor={effectiveShowTipCursor}
          personality="curious"
          muted={tabsMuted}
          silent={false}
          className="pointer-events-none fixed z-0 tentacle-hide-short-landscape"
          style={{ top: "auto", bottom: "5rem" }}
        />
      )}

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
                className="hidden items-center gap-1 rounded-full border-2 border-border bg-surface px-2 py-1 text-[11px] font-extrabold text-ink shadow-pop-soft sm:flex"
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
            <Link
              href="/shop"
              aria-label="Open shop"
              title="Shop"
              className="tap-target shrink-0 rounded-full border-2 border-border bg-surface text-ink-muted shadow-pop-soft transition-colors hover:text-primary"
            >
              <ShoppingBag className="h-4 w-4" strokeWidth={3} />
            </Link>
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
              // Mute tentacles briefly so they don't compete with the
              // tab-change animation.
              muteTentaclesForTabChange();
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
