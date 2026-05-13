"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, CircleX, AlertCircle } from "lucide-react";

export type FeedbackTone = "correct" | "wrong" | "almost";

export interface FeedbackResult {
  /** Whether to show success or failure styling. */
  correct: boolean;
  explanation: string;
  /** Optional override of the headline shown. */
  headline?: string;
  /** Optional small subhead under the headline (above explanation). */
  subhead?: string;
  /** Tone overrides correct/wrong styling — use for "almost" partial credit. */
  tone?: FeedbackTone;
}

interface FeedbackBannerProps {
  result: FeedbackResult | null;
  onContinue: () => void;
  /** Final question? Customize CTA label. */
  isLast?: boolean;
}

/**
 * Slides up from the bottom when a result is set. Big result icon, headline,
 * explanation, and a CONTINUE button.
 */
export function FeedbackBanner({
  result,
  onContinue,
  isLast,
}: FeedbackBannerProps) {
  return (
    <AnimatePresence>
      {result ? (
        <motion.div
          key="banner"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`pointer-events-auto sticky bottom-0 z-30 border-t-2 pb-safe ${
            (result.tone ?? (result.correct ? "correct" : "wrong")) ===
            "correct"
              ? "border-primary bg-primary-soft"
              : (result.tone ?? "wrong") === "almost"
              ? "border-xp bg-xp/10"
              : "border-heart bg-heart/10"
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="mx-auto flex max-w-2xl flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:gap-5">
            <div className="flex flex-1 items-start gap-3">
              <div className="shrink-0">
                {(result.tone ?? (result.correct ? "correct" : "wrong")) ===
                "correct" ? (
                  <CircleCheck
                    className="h-10 w-10 text-primary-dark"
                    strokeWidth={3}
                  />
                ) : result.tone === "almost" ? (
                  <AlertCircle
                    className="h-10 w-10 text-xp-dark"
                    strokeWidth={3}
                  />
                ) : (
                  <CircleX
                    className="h-10 w-10 text-heart"
                    strokeWidth={3}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  className={`text-xl font-black leading-tight ${
                    (result.tone ?? (result.correct ? "correct" : "wrong")) ===
                    "correct"
                      ? "text-primary-dark"
                      : result.tone === "almost"
                      ? "text-xp-dark"
                      : "text-heart"
                  }`}
                >
                  {result.headline ??
                    (result.correct ? "Awesome!" : "Incorrect")}
                </h3>
                {result.subhead ? (
                  <p className="mt-0.5 text-xs font-black uppercase tracking-wider text-ink-muted">
                    {result.subhead}
                  </p>
                ) : null}
                {result.explanation ? (
                  <p className="mt-1 text-sm font-medium leading-snug text-ink">
                    {result.explanation}
                  </p>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={onContinue}
              className={`btn-pop text-white sm:w-44 ${
                (result.tone ?? (result.correct ? "correct" : "wrong")) ===
                "correct"
                  ? "bg-primary shadow-pop-primary"
                  : result.tone === "almost"
                  ? "bg-xp text-ink shadow-pop-xp"
                  : "bg-heart shadow-pop-heart"
              }`}
            >
              {isLast ? "Finish" : "Continue"}
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
