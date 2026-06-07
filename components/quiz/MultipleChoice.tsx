"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import type { MultipleChoiceQuestion } from "@/lib/types";

interface MultipleChoiceProps {
  question: MultipleChoiceQuestion;
  /**
   * Reports the result. `partialScore` is 0..1 (1 = fully correct).
   * For multiple choice it's binary (0 or 1).
   */
  onSubmit: (
    correct: boolean,
    partialScore: number,
    override?: { headline?: string; subhead?: string }
  ) => void;
  /** Has the answer been locked? (driven by parent's feedback state) */
  locked: boolean;
  /** Reports submit-readiness + a stable submit handler to the parent. */
  onReady?: (canSubmit: boolean, submit: () => void) => void;
  themeColor?: string;
}

export function MultipleChoice({
  question,
  onSubmit,
  locked,
  onReady,
  themeColor,
}: MultipleChoiceProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<number | null>(null);

  const accent = themeColor ?? "var(--color-primary)";

  const submit = () => {
    if (selected === null || submitted !== null || locked) return;
    setSubmitted(selected);
    const correct = selected === question.correctIndex;
    onSubmit(correct, correct ? 1 : 0);
  };

  // Push canSubmit + submit handler upward whenever readiness changes.
  useEffect(() => {
    if (!onReady) return;
    onReady(selected !== null && submitted === null && !locked, submit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, submitted, locked]);

  const wasCorrect = submitted === question.correctIndex;

  return (
    <div className="flex w-full flex-1 flex-col">
      <h2 className="font-display mb-6 text-2xl tracking-tight leading-snug text-ink md:text-3xl">
        {question.prompt}
      </h2>

      <div className="flex flex-col gap-3" data-quiz-options="multiple_choice">
        {question.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrectOpt = i === question.correctIndex;
          const showCorrect = submitted !== null && isCorrectOpt;
          const showWrong =
            submitted !== null && submitted === i && !isCorrectOpt;

          let classes =
            "card-pop relative flex min-h-[56px] items-center gap-3 px-5 py-4 text-left text-base font-bold transition-colors";

          if (showCorrect) {
            classes += " border-primary bg-primary-soft text-primary-dark";
          } else if (showWrong) {
            classes += " border-heart bg-heart/10 text-heart animate-shake";
          } else if (isSelected && submitted === null) {
            classes +=
              " border-[var(--accent)] bg-[var(--accent-soft)] text-ink";
          } else {
            classes += " text-ink";
          }

          return (
            <motion.button
              key={`${question.id}-${i}`}
              type="button"
              disabled={locked}
              onClick={() => {
                if (submitted === null) setSelected(i);
              }}
              whileTap={locked ? undefined : { scale: 0.985 }}
              className={classes}
              data-quiz-option={i}
              data-quiz-option-text={opt}
              data-correct={String(i === question.correctIndex)}
              data-selected={String(selected === i)}
              style={
                {
                  "--accent": accent,
                  "--accent-soft": `${accent}22`,
                } as React.CSSProperties
              }
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-black ${
                  showCorrect
                    ? "border-primary-dark bg-primary text-white"
                    : showWrong
                    ? "border-heart bg-heart text-white"
                    : isSelected
                    ? "border-current bg-white"
                    : "border-border bg-surface-muted text-ink-muted"
                }`}
              >
                {showCorrect ? (
                  <Check className="h-4 w-4" strokeWidth={4} />
                ) : showWrong ? (
                  <X className="h-4 w-4" strokeWidth={4} />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span className="flex-1 leading-snug">{opt}</span>
            </motion.button>
          );
        })}
      </div>

      {/* SR-only state */}
      <span className="sr-only">
        {submitted === null
          ? selected === null
            ? "No option selected"
            : `Option ${String.fromCharCode(65 + selected)} selected`
          : wasCorrect
          ? "Correct"
          : "Incorrect"}
      </span>
    </div>
  );
}
