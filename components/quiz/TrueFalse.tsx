"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { TrueFalseQuestion } from "@/lib/types";

interface TrueFalseProps {
  question: TrueFalseQuestion;
  onSubmit: (
    correct: boolean,
    partialScore: number,
    override?: { headline?: string; subhead?: string }
  ) => void;
  locked: boolean;
  /** True/False auto-submits on tap, so canSubmit is always false. */
  onReady?: (canSubmit: boolean, submit: () => void) => void;
}

/**
 * Single-tap commit. Two huge buttons. After tap, the chosen one shows
 * green/red feedback inline; the other is dimmed.
 */
export function TrueFalse({
  question,
  onSubmit,
  locked,
  onReady,
}: TrueFalseProps) {
  const [picked, setPicked] = useState<boolean | null>(null);

  // True/False has no separate Check step — disable parent's footer.
  useEffect(() => {
    if (!onReady) return;
    onReady(false, () => {});
  }, [onReady]);

  const handlePick = (val: boolean) => {
    if (picked !== null || locked) return;
    setPicked(val);
    const correct = val === question.correct;
    onSubmit(correct, correct ? 1 : 0);
  };

  const renderButton = (val: boolean) => {
    const isPicked = picked === val;
    const isCorrectChoice = val === question.correct;
    const showResult = picked !== null;

    let classes =
      "btn-pop relative flex h-44 w-full flex-col items-center justify-center gap-3 text-2xl font-black uppercase tracking-wide text-white transition-opacity";
    const style: React.CSSProperties = {};

    if (showResult) {
      if (isPicked) {
        // Show correctness on the picked button
        if (isCorrectChoice) {
          classes += " bg-primary shadow-pop-primary";
        } else {
          classes += " bg-heart shadow-pop-heart animate-shake";
        }
      } else {
        // The other button — dim
        if (val) {
          classes += " bg-primary/50 shadow-pop-primary opacity-60";
        } else {
          classes += " bg-heart/50 shadow-pop-heart opacity-60";
        }
      }
    } else {
      classes += val
        ? " bg-primary shadow-pop-primary"
        : " bg-heart shadow-pop-heart";
    }

    return (
      <motion.button
        key={val ? "true" : "false"}
        type="button"
        disabled={locked || picked !== null}
        onClick={() => handlePick(val)}
        whileTap={locked ? undefined : { scale: 0.97 }}
        className={classes}
        style={style}
      >
        {val ? (
          <ThumbsUp className="h-12 w-12" strokeWidth={2.5} />
        ) : (
          <ThumbsDown className="h-12 w-12" strokeWidth={2.5} />
        )}
        {val ? "True" : "False"}
      </motion.button>
    );
  };

  return (
    <div className="flex w-full flex-1 flex-col">
      <h2 className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-ink-muted">
        True or False?
      </h2>
      <h3 className="font-display mb-8 text-2xl tracking-tight leading-snug text-ink md:text-3xl">
        {question.prompt}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {renderButton(true)}
        {renderButton(false)}
      </div>
    </div>
  );
}
