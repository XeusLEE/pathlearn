"use client";

// =============================================================
// <EpisodeCompleteScreen /> — full-screen post-episode celebration.
// Imported by the quiz player when an episode finishes. Fires
// hand-tuned confetti once on mount, shows a celebrating mascot,
// three stat cards (XP / accuracy / time), unlocked-achievement
// chips, a PB / improvement chip, and a "Continue" CTA. When a
// `completionResult.leveledUp` is provided, a <LevelUpModal />
// auto-mounts above this screen.
// =============================================================

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Clock, Target, Sparkles, RotateCcw, ArrowRight } from "lucide-react";
import type { Episode } from "@/lib/types";
import { Mascot } from "./Mascot";
import { Tentacle } from "./Tentacle";
import { LevelUpModal } from "./LevelUpModal";
import { vibrate, playTone } from "./feedback";
import { getAchievementInfo, type EpisodeCompletionResult } from "@/lib/store";
import { useToasts } from "./AchievementToast";

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
    !!completionResult?.leveledUp
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
        }, 800 + i * 600)
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
        {/* Celebration tentacles — fan out from the bottom edges. */}
        <div
          aria-hidden
          className="pointer-events-none fixed bottom-0 left-0 z-[68]"
          style={{ transform: "translate(-10px, 30px) rotate(-15deg)" }}
        >
          <Tentacle
            anchor="bottom"
            length={140}
            thickness={50}
            curl="in"
            mood="celebrating"
          />
        </div>
        <div
          aria-hidden
          className="pointer-events-none fixed bottom-0 right-0 z-[68]"
          style={{ transform: "translate(10px, 30px) rotate(15deg)" }}
        >
          <Tentacle
            anchor="bottom"
            length={140}
            thickness={50}
            curl="out"
            mood="celebrating"
          />
        </div>
        <div
          aria-hidden
          className="pointer-events-none fixed bottom-0 left-1/2 z-[67] hidden sm:block"
          style={{ transform: "translate(-50%, 40px)" }}
        >
          <Tentacle
            anchor="bottom"
            length={110}
            thickness={42}
            curl="in"
            mood="celebrating"
          />
        </div>

        <div className="flex-1 w-full max-w-md mx-auto px-6 pt-10 pb-4 flex flex-col items-center text-center overflow-y-auto">
          {/* Mascot */}
          <div className="animate-pop-in">
            <Mascot mood="celebrate" size={132} />
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

          {/* Achievement chips */}
          {unlocked.length > 0 && (
            <div className="w-full mt-6">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted mb-2 text-center">
                {unlocked.length === 1 ? "Achievement unlocked" : "Achievements unlocked"}
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
                <ArrowRight size={18} strokeWidth={3} className="ml-2 flex-shrink-0" />
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
