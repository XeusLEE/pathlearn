"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { OrderingQuestion } from "@/lib/types";

interface OrderingProps {
  question: OrderingQuestion;
  /**
   * Reports the result. `partialScore` = (items in correct slot) / total (0..1).
   * `correct=true` only when EVERY slot matches.
   */
  onSubmit: (
    correct: boolean,
    partialScore: number,
    override?: { headline?: string; subhead?: string }
  ) => void;
  locked: boolean;
  onReady?: (canSubmit: boolean, submit: () => void) => void;
}

/** Deterministic shuffle so the initial tray is consistent per question. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  let a = seed >>> 0;
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(r * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // Make sure shuffle isn't an identity for >1 items.
  if (out.length > 1 && out.every((v, i) => v === arr[i])) {
    [out[0], out[out.length - 1]] = [out[out.length - 1], out[0]];
  }
  return out;
}

const hashString = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
};

interface Chip {
  id: string;
  text: string;
  /** The index in q.items (correct order). */
  originalIndex: number;
}

export function Ordering({
  question,
  onSubmit,
  locked,
  onReady,
}: OrderingProps) {
  const allChips = useMemo<Chip[]>(
    () =>
      question.items.map((text, i) => ({
        id: `${question.id}-${i}`,
        text,
        originalIndex: i,
      })),
    [question]
  );

  const initialTray = useMemo(
    () => seededShuffle(allChips, hashString(question.id)),
    [allChips, question.id]
  );

  const [tray, setTray] = useState<Chip[]>(initialTray);
  const [answer, setAnswer] = useState<Chip[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [firstWrongIdx, setFirstWrongIdx] = useState<number | null>(null);

  const moveToAnswer = (chip: Chip) => {
    if (submitted || locked) return;
    setTray((t) => t.filter((c) => c.id !== chip.id));
    setAnswer((a) => [...a, chip]);
  };

  const moveBackToTray = (chip: Chip) => {
    if (submitted || locked) return;
    setAnswer((a) => a.filter((c) => c.id !== chip.id));
    setTray((t) => [...t, chip]);
  };

  const allPlaced = answer.length === allChips.length;

  const submit = () => {
    if (!allPlaced || submitted || locked) return;
    let firstWrong = -1;
    let correctCount = 0;
    answer.forEach((chip, i) => {
      if (chip.originalIndex === i) correctCount++;
      else if (firstWrong === -1) firstWrong = i;
    });
    const correct = firstWrong === -1;
    const total = allChips.length;
    const partial = total === 0 ? 0 : correctCount / total;
    setFirstWrongIdx(correct ? null : firstWrong);
    setSubmitted(true);
    onSubmit(correct, partial);
  };

  useEffect(() => {
    if (!onReady) return;
    onReady(allPlaced && !submitted && !locked, submit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPlaced, submitted, locked]);

  return (
    <div className="flex w-full flex-1 flex-col">
      <h2 className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-ink-muted">
        Put in order
      </h2>
      <h3 className="font-display mb-5 text-2xl tracking-tight leading-snug text-ink md:text-3xl">
        {question.prompt}
      </h3>

      <div data-quiz-options="ordering" className="contents">
      {/* Answer area */}
      <div
        className={`mb-4 min-h-[120px] rounded-2xl border-2 border-dashed bg-surface-muted/60 p-3 transition-colors ${
          submitted
            ? firstWrongIdx === null
              ? "border-primary bg-primary-soft/40"
              : "border-heart bg-heart/5 animate-shake"
            : "border-border"
        }`}
      >
        {answer.length === 0 ? (
          <div className="flex h-[88px] items-center justify-center text-sm font-bold text-ink-soft">
            Tap chips below to place them in order
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {answer.map((chip, i) => {
                const isFirstWrong = submitted && firstWrongIdx === i;
                const isCorrectChip =
                  submitted &&
                  firstWrongIdx === null &&
                  chip.originalIndex === i;
                return (
                  <motion.li
                    key={chip.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  >
                    <button
                      type="button"
                      disabled={submitted || locked}
                      onClick={() => moveBackToTray(chip)}
                      data-quiz-order-item={chip.originalIndex}
                      data-quiz-order-correct-pos={chip.originalIndex}
                      data-quiz-order-zone="answer"
                      className={`flex w-full min-h-[48px] items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm font-bold transition-colors ${
                        isFirstWrong
                          ? "border-heart bg-heart/10 text-heart"
                          : isCorrectChip
                          ? "border-primary bg-primary-soft text-primary-dark"
                          : "border-border bg-surface text-ink"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                          isFirstWrong
                            ? "bg-heart text-white"
                            : isCorrectChip
                            ? "bg-primary text-white"
                            : "bg-surface-muted text-ink-muted"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 leading-snug">{chip.text}</span>
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ol>
        )}
      </div>

      {/* Tray */}
      <div className="mb-2 text-xs font-black uppercase tracking-wider text-ink-soft">
        Tray
      </div>
      <div className="flex min-h-[60px] flex-wrap gap-2">
        <AnimatePresence initial={false}>
          {tray.map((chip) => (
            <motion.button
              key={chip.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              type="button"
              disabled={submitted || locked}
              onClick={() => moveToAnswer(chip)}
              data-quiz-order-item={chip.originalIndex}
              data-quiz-order-correct-pos={chip.originalIndex}
              data-quiz-order-zone="tray"
              className="card-pop min-h-[48px] px-4 py-2.5 text-sm font-bold text-ink active:translate-y-[2px]"
            >
              {chip.text}
            </motion.button>
          ))}
        </AnimatePresence>
        {tray.length === 0 ? (
          <div className="text-sm font-bold text-ink-soft">All placed.</div>
        ) : null}
      </div>
      </div>
    </div>
  );
}
