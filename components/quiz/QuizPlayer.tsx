"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart, Sparkles } from "lucide-react";
import type { Episode, Question } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useTentaclePointerFollow } from "@/lib/useTentaclePointerFollow";
import { TopBar } from "./TopBar";
import { FeedbackBanner, type FeedbackResult } from "./FeedbackBanner";
import { QuizTentacle } from "./QuizTentacle";
import { ScreenFX, type ScreenReaction } from "@/components/gamification/ScreenFX";
import { MultipleChoice } from "./MultipleChoice";
import { FillInBlank } from "./FillInBlank";
import { TrueFalse } from "./TrueFalse";
import { Matching } from "./Matching";
import { Ordering } from "./Ordering";

export interface QuizFinishPayload {
  /** 0..100, derived from per-question partial scores. */
  score: number;
  /** Number of questions where the user got partial<1 on the FIRST attempt. */
  mistakes: number;
  totalQuestions: number;
  durationMs: number;
  baseXp: number;
  /** XP earned from in-session combo milestones (already added into baseXp). */
  comboBonusXp: number;
  /** Was this a re-clear of a completed episode? */
  practiceMode: boolean;
}

interface QuizPlayerProps {
  episode: Episode;
  themeColor: string;
  /** When true, don't deduct hearts on wrong answers. */
  practiceMode?: boolean;
  onClose: () => void;
  onFinish: (payload: QuizFinishPayload) => void;
}

interface QueuedQuestion {
  question: Question;
  /** Was this enqueued as a retry (heart already lost)? */
  isRetry: boolean;
  /** Original 0-based slot in the episode for stable keying. */
  originalIdx: number;
}

const COMBO_MILESTONES: Record<number, number> = {
  3: 5,
  5: 10,
  7: 15,
  10: 25,
};

/** Live coin rewards awarded the instant an exact combo milestone is hit. */
const COMBO_COINS: Record<number, number> = {
  3: 3,
  5: 5,
  7: 8,
  10: 12,
};

/**
 * The central orchestrator. Drives question progression, retry queue, hearts,
 * and emits onFinish when complete. Renders a TopBar, the active question,
 * a single sticky CHECK shelf, and a sticky FeedbackBanner for results.
 */
export function QuizPlayer({
  episode,
  themeColor,
  practiceMode = false,
  onClose,
  onFinish,
}: QuizPlayerProps) {
  const pathname = usePathname();
  const totalUnique = episode.questions.length;

  // Build initial play queue.
  const initialQueue = useMemo<QueuedQuestion[]>(
    () =>
      episode.questions.map((q, i) => ({
        question: q,
        isRetry: false,
        originalIdx: i,
      })),
    [episode]
  );

  const [queue, setQueue] = useState<QueuedQuestion[]>(initialQueue);
  const [head, setHead] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  // Screen-level one-shot reaction FX (themed by equipped aura). The `ts`
  // field is stamped fresh at the moment of each event so ScreenFX fires once.
  const [fx, setFx] = useState<ScreenReaction | null>(null);

  // Track per-question best partial score (0..1) for the FIRST attempt.
  // Only the first attempt counts toward score (parallels missedSet behavior).
  const firstAttemptScores = useRef<Map<string, number>>(new Map());
  // Combo tracking — number of correct answers in a row (resets on partial<1).
  const correctRunRef = useRef(0);
  const comboBonusRef = useRef(0);

  // Sticky-footer CHECK shelf — driven by the active question via onReady.
  const [canSubmit, setCanSubmit] = useState(false);
  const submitFnRef = useRef<() => void>(() => {});

  // Floating "+xp" feedback ping.
  const [pings, setPings] = useState<{ id: number; text: string }[]>([]);
  const pingId = useRef(0);

  // Episode start time.
  const startedAt = useRef(Date.now());

  // === Pointer-follow: tentacles reach toward hovered/clicked items ========
  // Both the speaker and silent tentacles physically extend their tips onto
  // whatever the user is interacting with — answer options, buttons, etc.
  // Disabled while feedback is showing (correct = celebrate in place; wrong =
  // speaker points at the correct answer via its own logic) and on reduced
  // motion. The Tentacle's internal solver handles the bend + stretch — we
  // just pass the selector + reach flags, no manual length/position math.
  const prefersReducedMotion = useReducedMotion();
  const pointerReach = useTentaclePointerFollow(
    !prefersReducedMotion && feedback === null,
  );
  const reachSelector = pointerReach.active
    ? (pointerReach.selector ?? undefined)
    : undefined;
  const reachActive = pointerReach.active;

  const hearts = useApp((s) => s.hearts);
  const loseHeart = useApp((s) => s.loseHeart);
  const refillAllHearts = useApp((s) => s.refillAllHearts);

  // Progress bar tracks position within the current play queue (which can grow
  // when wrong answers enqueue retries — the bar visually "stretches" then,
  // which feels right because there's literally more to do).
  const progressForBar = head;
  const totalForBar = queue.length;

  const current = queue[head];

  // Out of hearts overlay — never blocks practice mode.
  const outOfHearts = !practiceMode && hearts <= 0;

  const finishEpisode = useCallback(() => {
    // Score from per-question partial scores against unique question count.
    let totalPartial = 0;
    let mistakes = 0;
    for (const q of episode.questions) {
      const ps = firstAttemptScores.current.get(q.id) ?? 0;
      totalPartial += ps;
      if (ps < 1) mistakes++;
    }
    const score = Math.round((totalPartial / totalUnique) * 100);
    const baseXp =
      10 + episode.questions.length * 2 + comboBonusRef.current;

    onFinish({
      score,
      mistakes,
      totalQuestions: totalUnique,
      durationMs: Date.now() - startedAt.current,
      baseXp,
      comboBonusXp: comboBonusRef.current,
      practiceMode,
    });
  }, [episode.questions, totalUnique, onFinish, practiceMode]);

  const triggerPing = (text: string) => {
    const id = ++pingId.current;
    setPings((p) => [...p, { id, text }]);
    window.setTimeout(() => {
      setPings((p) => p.filter((x) => x.id !== id));
    }, 600);
  };

  const safeVibrate = (pattern: number | number[]) => {
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* noop */
    }
  };

  // Stable submit ref handler so child components can update without thrashing
  // QuizPlayer. Wrapped in useCallback so children can compare identity.
  const handleReady = useCallback((can: boolean, submit: () => void) => {
    setCanSubmit(can);
    submitFnRef.current = submit;
  }, []);

  const handleSubmit = useCallback(
    (
      correct: boolean,
      partialScore: number,
      override?: { headline?: string; subhead?: string }
    ) => {
      if (!current) return;
      const q = current.question;

      // Track first-attempt partial score (best-of, but first attempt is the
      // canonical one; if a retry beats it, the retry doesn't matter for score).
      if (!firstAttemptScores.current.has(q.id)) {
        firstAttemptScores.current.set(q.id, partialScore);
      }

      // Decide outcome bucket: correct (1), almost (>=0.75), partial (>=0.5),
      // miss (<0.5). Almost = no heart loss + soft banner.
      const isAlmost = partialScore >= 0.75 && partialScore < 1;
      const isPartial = partialScore >= 0.5 && partialScore < 0.75;

      if (correct || isAlmost) {
        safeVibrate(10);

        // Combo: only fully-correct answers (partialScore === 1) bump it.
        if (partialScore >= 1) {
          correctRunRef.current += 1;
          const milestone = COMBO_MILESTONES[correctRunRef.current];
          if (milestone) {
            comboBonusRef.current += milestone;
            triggerPing(`🔥 ${correctRunRef.current} in a row! +${milestone}`);
            safeVibrate([10, 30, 60]);
            // Live coins for hitting an exact combo milestone — but NOT in
            // practice mode (replaying a completed episode), otherwise a
            // zero-risk replay loop could mint unlimited coins.
            const coins = COMBO_COINS[correctRunRef.current];
            if (coins && !practiceMode) {
              useApp.getState().earnCoins(coins);
              triggerPing(`🪙 +${coins}`);
            }
            // Bigger combo burst, scaled by the run length.
            setFx({ type: "combo", n: correctRunRef.current, ts: Date.now() });
          } else {
            triggerPing("+5 XP");
            // Small celebratory burst for a plain full-credit answer.
            setFx({ type: "correct", ts: Date.now() });
          }
        } else {
          // Almost — show a soft ping but don't break combo (it didn't add to
          // it either). Reset to 0 because the user wasn't perfect.
          correctRunRef.current = 0;
          triggerPing("+3 XP");
        }

        if (isAlmost) {
          // Override (e.g. FillInBlank fuzzy) wins; otherwise build a
          // count-based subhead when we can.
          const sub =
            override?.subhead ?? makePartialSubhead(q, partialScore) ?? "So close.";
          setFeedback({
            correct: true,
            tone: "almost",
            headline: override?.headline ?? "Almost!",
            subhead: sub,
            explanation: q.explanation,
          });
        } else {
          setFeedback({
            correct: true,
            headline: override?.headline,
            subhead: override?.subhead,
            explanation: q.explanation,
          });
        }
      } else {
        // Wrong! Combo broken.
        correctRunRef.current = 0;
        safeVibrate([20, 60, 20]);
        // Brief red edge vignette + shake (no confetti).
        setFx({ type: "wrong", ts: Date.now() });

        // First-time miss => optionally lose a heart, mark missed for score.
        if (!current.isRetry) {
          if (!practiceMode) loseHeart();
          // Enqueue for retry at end of queue.
          setQueue((qs) => {
            const next = qs.slice();
            next.push({
              question: q,
              isRetry: true,
              originalIdx: current.originalIdx,
            });
            return next;
          });
        }

        if (isPartial) {
          // 0.5 ≤ x < 0.75 → counts as wrong (heart taken above) but show
          // a softer "Close" message to acknowledge the partial credit.
          const sub = override?.subhead ?? makePartialSubhead(q, partialScore);
          setFeedback({
            correct: false,
            tone: "wrong",
            headline: override?.headline ?? "Close —",
            subhead: sub ?? undefined,
            explanation: q.explanation,
          });
        } else {
          setFeedback({
            correct: false,
            headline: override?.headline,
            subhead: override?.subhead,
            explanation: q.explanation,
          });
        }
      }
    },
    [current, loseHeart, practiceMode]
  );

  const handleContinue = useCallback(() => {
    setFeedback(null);
    if (head + 1 >= queue.length) {
      // Done.
      finishEpisode();
      return;
    }
    setHead((h) => h + 1);
  }, [head, queue.length, finishEpisode]);

  const handleClose = () => setConfirmClose(true);

  // Confirm-close -> commit nothing, just exit.
  const confirmAndExit = () => {
    setConfirmClose(false);
    onClose();
  };

  // If no current question (edge case), finish.
  useEffect(() => {
    if (queue.length === 0) {
      finishEpisode();
    }
  }, [queue.length, finishEpisode]);

  if (!current) return null;

  const isLast = head + 1 >= queue.length;
  // Out-of-hearts overlay should never trap the user at the finish line:
  // if the user just answered correctly on the last question, let them
  // continue/finish even if hearts hit 0.
  const finishingNow = isLast && feedback?.correct === true;
  const showOutOfHeartsOverlay = outOfHearts && !finishingNow;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-bg">
      {/* Screen-level reaction FX — themed by the equipped aura. Fires a fresh
          one-shot whenever `fx.ts` changes (correct / combo / perfect / wrong). */}
      <ScreenFX reaction={fx} />

      {/* Peeking octopus tentacles — arms reaching in from OFF-SCREEN (base
          glued to the viewport edge, root continues past it). The speaker
          leans its tip toward the correct option on a wrong submit and pops
          the answer bubble; the silent sibling just emotes. Flanks only
          render when the gutters beside the centered card (max-w-2xl) are
          wide enough that a rest-length arm can't cover the options
          (~1120px). Below that, a single compact tentacle sits bottom-left,
          out of the card's way. */}
      <QuizTentacle
        key={`qleft-${pathname}`}
        anchor="left"
        personality="wise"
        silent={false}
        question={current?.question}
        feedback={feedback}
        targetSelector={reachSelector}
        forceReach={reachActive}
        reachToTarget={reachActive}
        maxStretch={5}
        showTipCursor={reachActive}
        className="fixed top-[42%] z-10 hidden -translate-y-1/2 min-[1120px]:block left-0"
      />
      <QuizTentacle
        key={`qright-${pathname}`}
        anchor="right"
        personality="curious"
        silent
        question={current?.question}
        feedback={feedback}
        targetSelector={reachSelector}
        forceReach={reachActive}
        reachToTarget={reachActive}
        maxStretch={5}
        showTipCursor={false}
        className="fixed top-[54%] z-10 hidden -translate-y-1/2 min-[1120px]:block right-0"
      />
      {/* Compact arm reaches in from the LEFT edge low on the screen (same
          pattern as the path map's mobile tentacle) — a bottom anchor would
          float its base above the footer with the root flap exposed. */}
      <QuizTentacle
        key={`qmobile-${pathname}`}
        anchor="left"
        personality="playful"
        silent={false}
        question={current?.question}
        feedback={feedback}
        targetSelector={reachSelector}
        forceReach={reachActive}
        reachToTarget={reachActive}
        maxStretch={5}
        showTipCursor={reachActive}
        compact
        className="fixed bottom-24 left-0 z-10 block min-[1120px]:hidden"
      />

      <TopBar
        progress={progressForBar}
        total={totalForBar}
        hearts={hearts}
        themeColor={themeColor}
        onClose={handleClose}
        practiceMode={practiceMode}
      />

      {/* Question viewport */}
      <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 sm:px-5 pt-2 pb-8">
        {current.isRetry ? (
          <div className="mb-3 flex w-fit flex-col gap-0.5 rounded-2xl bg-purple/15 px-3 py-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-purple-dark">
              <Sparkles className="h-3.5 w-3.5" />
              Second chance
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-dark/70">
              (no heart loss)
            </span>
          </div>
        ) : null}

        {/* The data-quiz-target="question" attribute lets QuizTentacles
            point toward the question viewport center while idle. */}
        <div data-quiz-target="question" className="flex flex-1 flex-col">
          <AnimatePresence>
            <motion.div
              key={`${current.question.id}-${head}-${current.isRetry ? "r" : "p"}`}
              initial={{ x: 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -60, opacity: 0 }}
              transition={{
                x: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                opacity: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
              }}
              // Without mode="wait" overlap is implicit; the new question fades in
              // at the same time the old one slides out. Exit timing is faster.
              // (framer-motion respects exit duration if set on transition.)
              className="flex flex-1 flex-col"
            >
              <QuestionRenderer
                question={current.question}
                themeColor={themeColor}
                onSubmit={handleSubmit}
                onReady={handleReady}
                locked={feedback !== null}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Floating XP pings — calibrated for mobile (don't overlap progress bar). */}
        <div className="pointer-events-none absolute right-4 top-[64px] z-20 flex flex-col items-end gap-1">
          <AnimatePresence>
            {pings.map((p) => (
              <motion.div
                key={p.id}
                initial={{ x: 16, y: 0, opacity: 0, scale: 0.85 }}
                animate={{ x: 0, y: -32, opacity: 1, scale: 1 }}
                exit={{ x: -8, y: -56, opacity: 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-pill bg-xp px-3 py-1 text-sm font-black uppercase tracking-wider text-ink shadow-pop-xp"
              >
                {p.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Sticky CHECK shelf — only when no feedback is showing AND the question
          actually wants a separate Check tap (e.g. NOT TrueFalse, which auto-
          submits and reports canSubmit=false). */}
      {feedback === null && canSubmit ? (
        <div className="sticky-footer">
          <div className="mx-auto w-full max-w-2xl px-4 sm:px-5">
            <button
              type="button"
              onClick={() => submitFnRef.current()}
              className="btn-pop w-full bg-primary text-white shadow-pop-primary"
            >
              Check
            </button>
          </div>
        </div>
      ) : null}

      {/* The data-quiz-target="feedback" attribute is what QuizTentacles
          point at when feedback (esp. wrong answers) is showing. */}
      <div data-quiz-target="feedback">
        <FeedbackBanner
          result={feedback}
          onContinue={handleContinue}
          isLast={isLast}
        />
      </div>

      {/* Confirm close */}
      <AnimatePresence>
        {confirmClose ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 pb-safe sm:items-center"
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
              className="w-full max-w-md rounded-3xl border-2 border-border bg-surface p-6 shadow-pop-soft"
            >
              <h3 className="mb-2 text-2xl font-black text-ink">
                Quit episode?
              </h3>
              <p className="mb-5 text-sm font-bold text-ink-muted">
                Your progress in this episode won&apos;t be saved.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmClose(false)}
                  className="btn-pop bg-surface-muted text-ink shadow-pop-soft"
                >
                  Keep going
                </button>
                <button
                  type="button"
                  onClick={confirmAndExit}
                  className="btn-pop bg-heart text-white shadow-pop-heart"
                >
                  Quit
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Out-of-hearts overlay */}
      <AnimatePresence>
        {showOutOfHeartsOverlay ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 px-4 pb-safe pt-safe"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="w-full max-w-md rounded-3xl border-2 border-border bg-surface p-6 text-center shadow-pop-soft"
            >
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-heart/15">
                <Heart
                  className="h-10 w-10 text-heart"
                  fill="currentColor"
                  strokeWidth={2}
                />
              </div>
              <h3 className="mb-2 text-2xl font-black text-ink">
                Out of hearts!
              </h3>
              <p className="mb-6 text-sm font-bold text-ink-muted">
                Refill your hearts to keep practicing.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => refillAllHearts()}
                  className="btn-pop w-full bg-primary text-white shadow-pop-primary"
                >
                  Refill all hearts
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-pop w-full bg-surface-muted text-ink shadow-pop-soft"
                >
                  Quit episode
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Builds a "3 of 4 correct"-style subhead for partial-credit feedback when we
 * can compute item counts. Returns null for question types where it doesn't
 * make sense.
 */
function makePartialSubhead(q: Question, partial: number): string | null {
  if (q.type === "matching") {
    const total = q.pairs.length;
    const correct = Math.round(partial * total);
    return `${correct} of ${total} correct`;
  }
  if (q.type === "ordering") {
    const total = q.items.length;
    const correct = Math.round(partial * total);
    return `${correct} of ${total} in place`;
  }
  return null;
}

/** Renders the right component for a Question — narrowed via discriminated union. */
function QuestionRenderer({
  question,
  themeColor,
  onSubmit,
  onReady,
  locked,
}: {
  question: Question;
  themeColor: string;
  onSubmit: (correct: boolean, partialScore: number) => void;
  onReady: (canSubmit: boolean, submit: () => void) => void;
  locked: boolean;
}) {
  switch (question.type) {
    case "multiple_choice":
      return (
        <MultipleChoice
          question={question}
          onSubmit={onSubmit}
          onReady={onReady}
          locked={locked}
          themeColor={themeColor}
        />
      );
    case "fill_in_blank":
      return (
        <FillInBlank
          question={question}
          onSubmit={onSubmit}
          onReady={onReady}
          locked={locked}
        />
      );
    case "true_false":
      return (
        <TrueFalse
          question={question}
          onSubmit={onSubmit}
          onReady={onReady}
          locked={locked}
        />
      );
    case "matching":
      return (
        <Matching
          question={question}
          onSubmit={onSubmit}
          onReady={onReady}
          locked={locked}
        />
      );
    case "ordering":
      return (
        <Ordering
          question={question}
          onSubmit={onSubmit}
          onReady={onReady}
          locked={locked}
        />
      );
    default: {
      // Exhaustiveness check.
      const _exhaustive: never = question;
      return null;
    }
  }
}
