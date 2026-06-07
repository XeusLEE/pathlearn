"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import type { MatchingQuestion } from "@/lib/types";

interface MatchingProps {
  question: MatchingQuestion;
  /**
   * Reports the result. `partialScore` is `correctPairs / totalPairs` (0..1).
   * `correct=true` only when EVERY pair is right.
   */
  onSubmit: (
    correct: boolean,
    partialScore: number,
    override?: { headline?: string; subhead?: string }
  ) => void;
  locked: boolean;
  onReady?: (canSubmit: boolean, submit: () => void) => void;
}

/** Deterministic mulberry32 PRNG so we can shuffle once per question id. */
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
  return out;
}

const hashString = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
};

/**
 * Two columns. Tap a left, tap a right → matched (numbered badge). Re-tap to dissolve.
 * When all left items are matched → CHECK enables.
 */
export function Matching({
  question,
  onSubmit,
  locked,
  onReady,
}: MatchingProps) {
  // Stable shuffled right column based on question id.
  const shuffledRight = useMemo(() => {
    const rights = question.pairs.map((p, i) => ({ text: p.right, originalIndex: i }));
    return seededShuffle(rights, hashString(question.id));
  }, [question]);

  // Map: leftIndex (canonical) -> rightIndex within shuffled list (or null).
  const [matches, setMatches] = useState<Record<number, number | null>>(() => {
    const m: Record<number, number | null> = {};
    question.pairs.forEach((_, i) => (m[i] = null));
    return m;
  });
  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  const [activeRight, setActiveRight] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [wrongLefts, setWrongLefts] = useState<Set<number>>(new Set());

  const matchedRights = new Set(
    Object.values(matches).filter((v): v is number => v !== null)
  );

  const allMatched =
    Object.values(matches).filter((v) => v !== null).length ===
    question.pairs.length;

  const dissolveLeft = (leftIdx: number) => {
    setMatches((m) => ({ ...m, [leftIdx]: null }));
  };

  const handleLeft = (leftIdx: number) => {
    if (submitted || locked) return;
    // If this left is already matched, dissolve.
    if (matches[leftIdx] !== null) {
      dissolveLeft(leftIdx);
      setActiveLeft(null);
      setActiveRight(null);
      return;
    }
    if (activeRight !== null) {
      setMatches((m) => ({ ...m, [leftIdx]: activeRight }));
      setActiveLeft(null);
      setActiveRight(null);
      return;
    }
    setActiveLeft(leftIdx === activeLeft ? null : leftIdx);
  };

  const handleRight = (rightShuffledIdx: number) => {
    if (submitted || locked) return;

    // If this right is already used, find which left and dissolve.
    if (matchedRights.has(rightShuffledIdx)) {
      const ownerLeft = Object.entries(matches).find(
        ([, v]) => v === rightShuffledIdx
      )?.[0];
      if (ownerLeft !== undefined) dissolveLeft(parseInt(ownerLeft, 10));
      setActiveLeft(null);
      setActiveRight(null);
      return;
    }
    if (activeLeft !== null) {
      setMatches((m) => ({ ...m, [activeLeft]: rightShuffledIdx }));
      setActiveLeft(null);
      setActiveRight(null);
      return;
    }
    setActiveRight(rightShuffledIdx === activeRight ? null : rightShuffledIdx);
  };

  const submit = () => {
    if (!allMatched || submitted || locked) return;
    let correctCount = 0;
    const wrong = new Set<number>();
    Object.entries(matches).forEach(([leftIdxStr, rightShuffledIdx]) => {
      const leftIdx = parseInt(leftIdxStr, 10);
      if (rightShuffledIdx === null) return;
      const rightOriginal = shuffledRight[rightShuffledIdx].originalIndex;
      if (rightOriginal === leftIdx) {
        correctCount++;
      } else {
        wrong.add(leftIdx);
      }
    });
    const total = question.pairs.length;
    const partial = total === 0 ? 0 : correctCount / total;
    setWrongLefts(wrong);
    setSubmitted(true);
    onSubmit(wrong.size === 0, partial);
  };

  useEffect(() => {
    if (!onReady) return;
    onReady(allMatched && !submitted && !locked, submit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMatched, submitted, locked]);

  // Compute which match number to show on a chip (1-indexed in match-creation order).
  const orderedLefts = Object.entries(matches)
    .filter(([, v]) => v !== null)
    .map(([k]) => parseInt(k, 10));
  const matchNumber = (leftIdx: number) => {
    const idx = orderedLefts.indexOf(leftIdx);
    return idx === -1 ? null : idx + 1;
  };

  return (
    <div className="flex w-full flex-1 flex-col">
      <h2 className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-ink-muted">
        Match the pairs
      </h2>
      <h3 className="font-display mb-6 text-2xl tracking-tight leading-snug text-ink md:text-3xl">
        {question.prompt}
      </h3>

      <div className="grid grid-cols-2 gap-3" data-quiz-options="matching">
        {/* Left column (canonical order) */}
        <div className="flex flex-col gap-2">
          {question.pairs.map((p, i) => {
            const num = matchNumber(i);
            const isActive = activeLeft === i;
            const isMatched = matches[i] !== null;
            const isWrong = submitted && wrongLefts.has(i);
            const isRightChoice = submitted && !wrongLefts.has(i) && isMatched;

            let classes =
              "card-pop relative flex min-h-[48px] items-center justify-between gap-2 px-3 py-3 text-left text-sm font-bold transition-colors";
            if (isWrong)
              classes += " border-heart bg-heart/10 text-heart";
            else if (isRightChoice)
              classes += " border-primary bg-primary-soft text-primary-dark";
            else if (isActive)
              classes += " border-secondary bg-secondary-soft text-ink";
            else if (isMatched)
              classes += " border-border bg-surface-muted text-ink";
            else classes += " text-ink";

            return (
              <button
                key={`L-${question.id}-${i}`}
                type="button"
                disabled={locked || submitted}
                onClick={() => handleLeft(i)}
                className={classes}
                data-quiz-match-left={i}
                data-correct-match={i}
              >
                <span className="flex-1 leading-snug">{p.left}</span>
                {num !== null ? (
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      isWrong
                        ? "bg-heart text-white"
                        : isRightChoice
                        ? "bg-primary text-white"
                        : "bg-ink text-white"
                    }`}
                  >
                    {isWrong ? (
                      <X className="h-4 w-4" strokeWidth={4} />
                    ) : isRightChoice ? (
                      <Check className="h-4 w-4" strokeWidth={4} />
                    ) : (
                      num
                    )}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Right column (shuffled) */}
        <div className="flex flex-col gap-2">
          {shuffledRight.map((r, j) => {
            const ownerLeftEntry = Object.entries(matches).find(
              ([, v]) => v === j
            );
            const ownerLeft = ownerLeftEntry
              ? parseInt(ownerLeftEntry[0], 10)
              : null;
            const num = ownerLeft !== null ? matchNumber(ownerLeft) : null;
            const isActive = activeRight === j;
            const isMatched = ownerLeft !== null;
            const isWrong =
              submitted && ownerLeft !== null && wrongLefts.has(ownerLeft);
            const isRightChoice =
              submitted && ownerLeft !== null && !wrongLefts.has(ownerLeft);

            let classes =
              "card-pop relative flex min-h-[48px] items-center justify-between gap-2 px-3 py-3 text-left text-sm font-bold transition-colors";
            if (isWrong)
              classes += " border-heart bg-heart/10 text-heart";
            else if (isRightChoice)
              classes += " border-primary bg-primary-soft text-primary-dark";
            else if (isActive)
              classes += " border-secondary bg-secondary-soft text-ink";
            else if (isMatched)
              classes += " border-border bg-surface-muted text-ink";
            else classes += " text-ink";

            return (
              <button
                key={`R-${question.id}-${j}`}
                type="button"
                disabled={locked || submitted}
                onClick={() => handleRight(j)}
                className={classes}
                data-quiz-match-right={j}
                data-quiz-match-right-origin={r.originalIndex}
              >
                <span className="flex-1 leading-snug">{r.text}</span>
                {num !== null ? (
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      isWrong
                        ? "bg-heart text-white"
                        : isRightChoice
                        ? "bg-primary text-white"
                        : "bg-ink text-white"
                    }`}
                  >
                    {isWrong ? (
                      <X className="h-4 w-4" strokeWidth={4} />
                    ) : isRightChoice ? (
                      <Check className="h-4 w-4" strokeWidth={4} />
                    ) : (
                      num
                    )}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
