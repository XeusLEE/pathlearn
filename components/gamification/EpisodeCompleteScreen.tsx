"use client";

// =============================================================
// <EpisodeCompleteScreen /> — full-screen post-episode celebration.
// Imported by the quiz player when an episode finishes. Fires
// hand-tuned confetti once on mount, shows a celebrating mascot,
// three stat cards (XP / accuracy / time), unlocked-achievement
// chips, a PB / improvement chip, and a "Continue" CTA. When a
// `completionResult.leveledUp` is provided, a <LevelUpModal />
// auto-mounts above this screen.
//
// CINEMATIC CELEBRATION — the screen mounts a fleet of "smart" tentacles
// around the edges of the viewport that REACH OUT toward the mascot,
// hugging it. The number, position, mood, and personality of the
// tentacles vary based on the celebration intensity:
//
//   • Default: 4 mobile / 6 desktop tentacles from the bottom edges
//     and corners. Mood = "celebrating", varied personalities.
//   • Perfect score: +2 tentacles fall in from the top corners,
//     converging on the mascot for a starburst-hug effect.
//   • Level-up: every tentacle switches to mood="wiggling".
//   • Path-conquered: every tentacle switches to personality="playful".
//
// A SINGLE shared rAF poll computes the mascot's screen rect once per
// frame, so adding more tentacles costs basically nothing in animation
// budget — they all read from the same state.
// =============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { motion, useReducedMotion } from "framer-motion";
import { Clock, Target, Sparkles, RotateCcw, ArrowRight } from "lucide-react";
import type { Episode } from "@/lib/types";
import { Mascot } from "./Mascot";
import {
  Tentacle,
  type TentacleAnchor,
  type TentacleMood,
} from "./Tentacle";
import { LevelUpModal } from "./LevelUpModal";
import { vibrate, playTone } from "./feedback";
import { getAchievementInfo, type EpisodeCompletionResult } from "@/lib/store";
import { useToasts } from "./AchievementToast";
import { CoinIcon } from "./CoinPill";

export interface EpisodeCompleteNextEpisode {
  pathId: string;
  episodeId: string;
  title: string;
}

export interface EpisodeCompleteScreenProps {
  episode: Episode;
  /** Hex color used as a soft accent (radial gradient + border). */
  pathThemeColor: string;
  /** Accuracy score 0-100. */
  score: number;
  mistakes: number;
  durationMs: number;
  xpAwarded: number;
  onContinue: () => void;
  /** Optional secondary action — when provided, shows a Replay button. */
  onReplay?: () => void;
  /**
   * Rich result from store.recordEpisodeComplete. When provided we render
   * achievement chips, a PB / improvement chip, and a level-up modal.
   * Optional for backwards-compat with the simple call site.
   */
  completionResult?: EpisodeCompletionResult;
  /** Next episode hint — when provided the primary CTA links forward. */
  nextEpisode?: EpisodeCompleteNextEpisode | null;
  /** Required when nextEpisode is provided. Called by the primary CTA. */
  onPlayNext?: () => void;
}

const CONFETTI_COLORS = [
  "#58cc02",
  "#1cb0f6",
  "#ffc800",
  "#ce82ff",
  "#ff4b4b",
  "#ff9600",
];

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** Tailwind border + bg classes for the accent. */
  accent: string;
  delay?: number;
}

function StatCard({ icon, label, value, accent, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      className={`flex-1 rounded-2xl border-2 bg-surface px-4 py-4 text-center min-w-0 ${accent}`}
      initial={{ y: 24, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 240,
        damping: 18,
        delay,
      }}
    >
      <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold tracking-wider uppercase opacity-80">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-3xl font-black tabular-nums">{value}</div>
    </motion.div>
  );
}

export function EpisodeCompleteScreen({
  episode,
  pathThemeColor,
  score,
  mistakes,
  durationMs,
  xpAwarded,
  onContinue,
  onReplay,
  completionResult,
  nextEpisode,
  onPlayNext,
}: EpisodeCompleteScreenProps) {
  const fired = useRef(false);
  const isPerfect = mistakes === 0 && score >= 100;
  const { push: pushToast } = useToasts();

  const [levelUpOpen, setLevelUpOpen] = useState(
    !!completionResult?.leveledUp,
  );

  // Confetti + sound + haptic — exactly once on first render.
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    playTone("complete");
    vibrate(isPerfect ? [10, 30, 20, 30, 40] : [20, 40, 30]);

    // Hand-tuned: two origins, 60ms gap. Square + circle shapes.
    const baseOpts: confetti.Options = {
      particleCount: 90,
      spread: 75,
      startVelocity: 45,
      gravity: 0.9,
      drift: 0.15,
      scalar: 0.95,
      ticks: 220,
      shapes: ["circle", "square"],
      colors: CONFETTI_COLORS,
      disableForReducedMotion: true,
    };

    confetti({ ...baseOpts, origin: { x: 0.3, y: 0.65 } });
    const t1 = setTimeout(() => {
      confetti({ ...baseOpts, origin: { x: 0.7, y: 0.65 } });
    }, 60);

    let t2: ReturnType<typeof setTimeout> | undefined;
    if (isPerfect) {
      // Extra finale for perfect runs.
      t2 = setTimeout(() => {
        confetti({
          ...baseOpts,
          particleCount: 70,
          spread: 110,
          startVelocity: 35,
          origin: { x: 0.5, y: 0.45 },
        });
      }, 350);
    }

    return () => {
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [isPerfect]);

  // Fire achievement toasts for newly-unlocked achievements, staggered
  // 600ms apart so they don't dogpile.
  useEffect(() => {
    const unlocked = completionResult?.achievementsUnlocked ?? [];
    if (!unlocked.length) return;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    unlocked.forEach((id, i) => {
      const info = getAchievementInfo(id);
      timeouts.push(
        setTimeout(() => {
          pushToast({
            icon: info.icon,
            title: info.title,
            subtitle: info.subtitle,
          });
        }, 800 + i * 600),
      );
    });
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [completionResult, pushToast]);

  // Build a soft radial gradient bg from the theme color (~12% alpha).
  const bgStyle: React.CSSProperties = {
    background: `radial-gradient(circle at 50% 0%, ${pathThemeColor}22 0%, ${pathThemeColor}0d 38%, transparent 70%), var(--color-bg)`,
  };

  // Derive the "PB / improvement / first-clear" chip data.
  const previous = completionResult?.previous ?? null;
  const isPersonalBest = !!completionResult?.isPersonalBest;
  const wasReplay = !!completionResult?.wasReplay;
  const isFirstClear = !!completionResult && !wasReplay;

  let progressChip: { tone: "win" | "info" | "warn"; text: string } | null =
    null;
  if (completionResult) {
    if (isFirstClear) {
      progressChip = { tone: "win", text: "First clear!" };
    } else if (isPersonalBest && previous) {
      const delta = Math.max(1, Math.round(score) - Math.round(previous.score));
      progressChip = {
        tone: "win",
        text: `+${delta}% — new personal best!`,
      };
    } else if (wasReplay && previous && !isPersonalBest) {
      progressChip = {
        tone: "warn",
        text: `Already at ${Math.round(previous.score)}% — try harder for more XP.`,
      };
    }
  }

  const unlocked = completionResult?.achievementsUnlocked ?? [];
  const pathConquered = unlocked.includes("path_complete");
  const leveledUp = !!completionResult?.leveledUp;
  const coinsAwarded = completionResult?.coinsAwarded ?? 0;

  // Primary CTA wiring. If `nextEpisode + onPlayNext`, that's primary.
  // Else "Back to map" via onContinue.
  const hasNext = !!(nextEpisode && onPlayNext);

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex flex-col items-center pt-safe pb-safe"
        style={bgStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Episode complete"
      >
        {/* Celebration tentacles — a responsive fleet that reaches toward the
            mascot. Count, mood, and personality respond to the celebration
            intensity (perfect / level-up / path-conquered). They share a
            single rAF poll for the mascot's screen rect. */}
        <CelebrationTentacles
          isPerfect={isPerfect}
          leveledUp={leveledUp}
          pathConquered={pathConquered}
          wiggleHarder={levelUpOpen}
        />

        <div className="flex-1 w-full max-w-md mx-auto px-6 pt-10 pb-4 flex flex-col items-center text-center overflow-y-auto">
          {/* Mascot — celebration tentacles bend toward this element.
              For level-up runs we render the new "level_up" mood, which
              gives the mascot star eyes; otherwise plain "celebrate". */}
          <div className="animate-pop-in" data-celebrate-anchor>
            <Mascot
              mood={leveledUp ? "level_up" : "celebrate"}
              size={132}
            />
          </div>

          {/* Perfect badge */}
          {isPerfect && (
            <motion.div
              className="mt-5 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 bg-xp text-ink border-2 border-xp-dark/30 shadow-pop-xp"
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 14,
                delay: 0.18,
              }}
            >
              <Sparkles size={16} className="text-ink" strokeWidth={3} />
              <span className="text-ink font-black tracking-widest text-sm">
                PERFECT!
              </span>
            </motion.div>
          )}

          {/* Path-conquered badge — extra recognition when an entire path completes here. */}
          {pathConquered && (
            <motion.div
              className="mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 bg-purple text-white border-2 border-purple-dark/30 shadow-pop-purple"
              initial={{ scale: 0, rotate: 8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 14,
                delay: 0.24,
              }}
            >
              <span className="font-black tracking-widest text-sm">
                PATH CONQUERED!
              </span>
            </motion.div>
          )}

          {/* Headline */}
          <motion.h1
            className="mt-6 font-display font-black text-4xl sm:text-5xl text-ink text-balance"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
          >
            Episode complete!
          </motion.h1>
          <motion.p
            className="mt-2 text-ink-muted font-semibold"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.12 }}
          >
            {episode.iconEmoji} {episode.title}
          </motion.p>

          {/* PB / improvement chip */}
          {progressChip && (
            <motion.div
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold border-2 ${
                progressChip.tone === "win"
                  ? "bg-primary-soft text-primary-dark border-primary/40"
                  : progressChip.tone === "warn"
                  ? "bg-streak/15 text-streak-dark border-streak/40"
                  : "bg-secondary-soft text-secondary-dark border-secondary/40"
              }`}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.18 }}
            >
              {progressChip.text}
            </motion.div>
          )}

          {/* Stat cards */}
          <div className="w-full mt-8 flex flex-col sm:flex-row gap-3">
            <StatCard
              icon={<Sparkles size={14} strokeWidth={3} />}
              label="Total XP"
              value={`+${xpAwarded}`}
              accent="border-xp text-xp-dark shadow-pop-xp"
              delay={0.22}
            />
            <StatCard
              icon={<Target size={14} strokeWidth={3} />}
              label="Accuracy"
              value={`${Math.round(score)}%`}
              accent="border-secondary text-secondary-dark shadow-pop-secondary"
              delay={0.3}
            />
            <StatCard
              icon={<Clock size={14} strokeWidth={3} />}
              label="Time"
              value={formatDuration(durationMs)}
              accent="border-primary text-primary-dark shadow-pop-primary"
              delay={0.38}
            />
          </div>

          {/* Coins reward — gold chip with a spring/pop entrance. Only shown
              when this completion actually granted coins (replays at 0 coins
              omit it so the screen stays tasteful). */}
          {coinsAwarded > 0 && (
            <motion.div
              className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-xp bg-xp/15 px-4 py-2 shadow-pop-xp"
              initial={{ scale: 0, y: 10, rotate: -8 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 280,
                damping: 14,
                delay: 0.46,
              }}
              aria-label={`Earned ${coinsAwarded} coins`}
            >
              <span className="animate-coin-bounce inline-flex">
                <CoinIcon size={22} />
              </span>
              <span className="text-lg font-black tabular-nums text-ink">
                +{coinsAwarded}
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
                coins
              </span>
            </motion.div>
          )}

          {/* Achievement chips */}
          {unlocked.length > 0 && (
            <div className="w-full mt-6">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-2 text-center">
                {unlocked.length === 1
                  ? "Achievement unlocked"
                  : "Achievements unlocked"}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {unlocked.map((id, i) => {
                  const info = getAchievementInfo(id);
                  return (
                    <motion.div
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-surface border-2 border-xp shadow-pop-xp"
                      initial={{ scale: 0, y: 8 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 280,
                        damping: 16,
                        delay: 0.45 + i * 0.08,
                      }}
                    >
                      <span className="text-base" aria-hidden>
                        {info.icon}
                      </span>
                      <span className="text-xs font-extrabold text-ink">
                        {info.title}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions — pinned to the bottom for thumb reach. */}
        <div className="w-full max-w-md mx-auto px-6 pb-4 flex flex-col gap-2">
          {hasNext ? (
            <>
              <button
                type="button"
                onClick={onPlayNext}
                className="btn-pop bg-primary text-white shadow-pop-primary w-full text-base"
                style={{ backgroundColor: pathThemeColor }}
              >
                <span className="truncate">
                  Continue to &ldquo;{nextEpisode!.title}&rdquo;
                </span>
                <ArrowRight
                  size={18}
                  strokeWidth={3}
                  className="ml-2 flex-shrink-0"
                />
              </button>
              <button
                type="button"
                onClick={onContinue}
                className="self-center text-xs font-bold text-ink-muted underline-offset-4 hover:underline mt-1"
              >
                Back to map
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onContinue}
                className="btn-pop bg-primary text-white shadow-pop-primary w-full text-lg"
                style={{ backgroundColor: pathThemeColor }}
              >
                Back to map
              </button>
              {onReplay && (
                <button
                  type="button"
                  onClick={onReplay}
                  className="btn-pop bg-surface text-ink-muted shadow-pop-soft border-border w-full text-sm"
                >
                  <RotateCcw size={16} className="mr-1.5" strokeWidth={2.5} />
                  Replay
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Level-up overlay (z-80, above this screen at z-70). */}
      {completionResult?.leveledUp && (
        <LevelUpModal
          level={completionResult.newLevel}
          open={levelUpOpen}
          onClose={() => setLevelUpOpen(false)}
        />
      )}
    </>
  );
}

// =============================================================
// CelebrationTentacles — internal helper that mounts a responsive
// fleet of tentacles around the edges of the celebration screen.
// They share a single rAF poll for the mascot's bounding rect and
// each REACH toward it with `reachToTarget={true}` and a glowing
// `showTipCursor` so it looks like they're embracing the mascot.
//
// Composition:
//   • 6 bottom tentacles on ≥sm (4 base + 2 mid). Default = 4 on <sm.
//   • +2 top-corner tentacles on isPerfect (≥sm only — phones stay
//     clean during a perfect run).
// =============================================================

interface CelebrationTentacleDef {
  /** Edge of the screen the tentacle base sits on. */
  anchor: TentacleAnchor;
  /** Personality drives subtle motion timing variation. */
  personality: "playful" | "curious" | "wise" | "shy";
  /** Pixel-percent left of viewport for the visible base. */
  leftPct: number;
  /** Pixel-percent top of viewport for the visible base. */
  topPct: number;
  /** Outer transform — keeps the original "tilt and peek" feel. */
  outerTransform: string;
  /** Tentacle visual props. */
  length: number;
  thickness: number;
  curl: "in" | "out";
  /** Stagger index for entrance delay (200ms + i * 120ms). */
  staggerIdx: number;
  /** Tailwind class for responsive visibility (e.g. "hidden sm:block"). */
  visibility?: string;
  /** Optional segments override for extra-smooth tentacles. */
  segments?: number;
}

/**
 * Stable definitions for the celebration tentacles. Includes:
 *   • 4 base tentacles (always visible).
 *   • 2 desktop-only bottom helpers (`hidden sm:block`).
 *   • Top-corner tentacles for perfect runs (mounted conditionally).
 *
 * `staggerIdx` controls entrance order; the consumer maps it to delay.
 */
const BASE_TENTACLES: CelebrationTentacleDef[] = [
  // Left side — vertically centered, reaching toward mascot
  {
    anchor: "left",
    personality: "playful",
    leftPct: 0,
    topPct: 50,
    outerTransform: "none",
    length: 140,
    thickness: 44,
    curl: "in",
    staggerIdx: 0,
    segments: 5,
  },
  // Right side — vertically centered, reaching toward mascot
  {
    anchor: "right",
    personality: "curious",
    leftPct: 100,
    topPct: 50,
    outerTransform: "none",
    length: 140,
    thickness: 44,
    curl: "in",
    staggerIdx: 1,
    segments: 5,
  },
];

/** Perfect runs: same 2 tentacles but bigger. No extra tentacles. */
const PERFECT_TOP_TENTACLES: CelebrationTentacleDef[] = [];

interface CelebrationTentaclesProps {
  isPerfect: boolean;
  leveledUp: boolean;
  pathConquered: boolean;
  /** When true, all tentacles switch to a faster "wiggling" mood. */
  wiggleHarder: boolean;
}

function CelebrationTentacles({
  isPerfect,
  leveledUp,
  pathConquered,
  wiggleHarder,
}: CelebrationTentaclesProps) {
  const reducedMotion = useReducedMotion();
  // Shared rAF-poll of the mascot anchor. We poll once for the whole fleet so
  // every tentacle reads from the same state — adding more tentacles costs
  // basically nothing in animation budget.
  const [mascotCenter, setMascotCenter] = useState<
    { x: number; y: number } | null
  >(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion || typeof window === "undefined") return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(
        "[data-celebrate-anchor]",
      );
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width !== 0 || r.height !== 0) {
          const nx = r.left + r.width / 2;
          const ny = r.top + r.height / 2;
          setMascotCenter((prev) => {
            if (
              prev &&
              Math.abs(prev.x - nx) < 0.5 &&
              Math.abs(prev.y - ny) < 0.5
            ) {
              return prev;
            }
            return { x: nx, y: ny };
          });
        }
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [reducedMotion]);

  // Mood selection — level-up cranks the energy to "wiggling".
  const mood: TentacleMood =
    leveledUp || wiggleHarder ? "wiggling" : "celebrating";

  // Compose the fleet. Top-corner tentacles only mount on perfect runs.
  const fleet = useMemo<CelebrationTentacleDef[]>(() => {
    return isPerfect
      ? [...BASE_TENTACLES, ...PERFECT_TOP_TENTACLES]
      : BASE_TENTACLES;
  }, [isPerfect]);

  // Path-conquered: override personality to "playful" for the whole fleet
  // (extra celebratory energy across the board).
  const effectiveFleet = useMemo(() => {
    if (!pathConquered) return fleet;
    return fleet.map((d) => ({ ...d, personality: "playful" as const }));
  }, [fleet, pathConquered]);

  return (
    <>
      {effectiveFleet.map((def, i) => (
        <CelebrationTentacleMount
          key={`${def.anchor}-${def.leftPct}-${def.topPct}-${i}`}
          def={def}
          mood={mood}
          mascotCenter={mascotCenter}
          reducedMotion={!!reducedMotion}
        />
      ))}
    </>
  );
}

interface CelebrationTentacleMountProps {
  def: CelebrationTentacleDef;
  mood: TentacleMood;
  mascotCenter: { x: number; y: number } | null;
  reducedMotion: boolean;
}

function CelebrationTentacleMount({
  def,
  mood,
  mascotCenter,
  reducedMotion,
}: CelebrationTentacleMountProps) {
  // Approximate this tentacle's base position in screen coords from its
  // leftPct/topPct. Refresh on resize.
  const [basePos, setBasePos] = useState<{ x: number; y: number } | null>(
    null,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const compute = () =>
      setBasePos({
        x: (def.leftPct / 100) * window.innerWidth,
        y: (def.topPct / 100) * window.innerHeight,
      });
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [def.leftPct, def.topPct]);

  // Personality-driven entrance spring.
  const spring = useMemo(() => {
    switch (def.personality) {
      case "playful":
        return { type: "spring" as const, stiffness: 220, damping: 14 };
      case "wise":
        return { type: "spring" as const, stiffness: 120, damping: 22 };
      case "shy":
        return { type: "spring" as const, stiffness: 160, damping: 22 };
      case "curious":
      default:
        return { type: "spring" as const, stiffness: 180, damping: 18 };
    }
  }, [def.personality]);

  const positionStyle: React.CSSProperties = {
    left:
      def.leftPct === 100
        ? undefined
        : def.leftPct === 0
        ? 0
        : `${def.leftPct}%`,
    right: def.leftPct === 100 ? 0 : undefined,
    top: def.topPct === 100 ? undefined : `${def.topPct}%`,
    bottom: def.topPct === 100 ? 0 : undefined,
    transform: def.outerTransform,
  };

  // Reduced-motion: target=null, no reachToTarget — render the tentacle in
  // its rest pose so motion-sensitive users still see the decorative
  // tentacles but without dynamic chasing motion.
  const reachable = !reducedMotion && !!mascotCenter && !!basePos;
  const target = reachable ? mascotCenter : null;

  // Entrance: 200 + i * 120ms — staggered fade+scale-in.
  const entranceDelay = 0.2 + def.staggerIdx * 0.12;

  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none fixed z-[68] ${def.visibility ?? ""}`}
      style={positionStyle}
      initial={
        reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 30 }
      }
      animate={
        reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
      }
      transition={
        reducedMotion
          ? { duration: 0.15, delay: entranceDelay }
          : { ...spring, delay: entranceDelay }
      }
    >
      {/* Inner wrapper keeps the original "transformOrigin: 50% 100%" pivot
          so the base stays glued to the edge. The Tentacle component itself
          does the reach toward `target`. */}
      <div
        style={{
          // For top-anchored tentacles we pivot from the top edge; bottom-
          // anchored from the bottom edge (so the base remains glued).
          transformOrigin:
            def.anchor === "top" ? "50% 0%" : "50% 100%",
        }}
      >
        <Tentacle
          anchor={def.anchor}
          length={def.length}
          thickness={def.thickness}
          curl={def.curl}
          mood={mood}
          personality={def.personality}
          segments={def.segments ?? 4}
          target={target}
          basePosition={basePos ?? undefined}
          /* Lean, don't stretch: tips ORIENT toward the mascot so the fleet
             reads as an embrace, but stay at rest length. Physical reach
             stretched every arm into thin ribbons sprawled across the stat
             cards (the mascot is far out of reach from the bottom edge). */
          reachToTarget={false}
          showTipCursor={false}
          maxStretch={1}
        />
      </div>
    </motion.div>
  );
}
