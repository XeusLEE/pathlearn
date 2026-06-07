"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import type { FillInBlankQuestion } from "@/lib/types";

export interface SubmitFeedbackOverride {
  /** Headline for the FeedbackBanner (e.g. "Close enough!"). */
  headline?: string;
  /** Small subhead under the headline (e.g. answer reveal). */
  subhead?: string;
}

interface FillInBlankProps {
  question: FillInBlankQuestion;
  /**
   * `partialScore`: 1 for exact, 0.85 for fuzzy (typo-tolerant), 0 for miss.
   * On a fuzzy match we still call `correct=true` so the parent doesn't
   * deduct a heart — we pass a custom banner via the third arg.
   */
  onSubmit: (
    correct: boolean,
    partialScore: number,
    override?: SubmitFeedbackOverride
  ) => void;
  locked: boolean;
  onReady?: (canSubmit: boolean, submit: () => void) => void;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Standard 2-row Levenshtein. O(n*m) time, O(min(n,m)) space. */
function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  // Make `a` the shorter so the rolling rows are smaller.
  if (a.length > b.length) {
    const tmp = a;
    a = b;
    b = tmp;
  }
  const n = a.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let i = 0; i <= n; i++) prev[i] = i;
  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= n; i++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1, // insert
        prev[i] + 1, // delete
        prev[i - 1] + cost // replace
      );
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[n];
}

type MatchKind = "exact" | "fuzzy" | "miss";

function fuzzyMatch(input: string, target: string): MatchKind {
  const ai = input.trim().toLowerCase();
  const ti = target.trim().toLowerCase();
  if (!ai || !ti) return "miss";
  if (ai === ti) return "exact";
  const dist = lev(ai, ti);
  // Generous tolerance — about 1 typo per 8 chars, minimum 1.
  const tolerance = Math.max(1, Math.floor(ti.length / 8));
  return dist <= tolerance ? "fuzzy" : "miss";
}

export function FillInBlank({
  question,
  onSubmit,
  locked,
  onReady,
}: FillInBlankProps) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [matchKind, setMatchKind] = useState<MatchKind>("miss");

  // Split the prompt around the FIRST occurrence of "___" (3+ underscores tolerated).
  const [before, after] = useMemo(() => {
    const m = question.prompt.match(/_{3,}/);
    if (!m || m.index === undefined) {
      return [question.prompt, ""];
    }
    return [
      question.prompt.slice(0, m.index),
      question.prompt.slice(m.index + m[0].length),
    ];
  }, [question.prompt]);

  const validate = (): MatchKind => {
    const candidates = [question.answer, ...(question.alternates ?? [])];
    // Strict normalized exact-match first against any candidate.
    const userN = norm(value);
    for (const c of candidates) {
      if (norm(c) === userN) return "exact";
    }
    // Fall back to fuzzy against the canonical answer (then alternates).
    for (const c of candidates) {
      const k = fuzzyMatch(value, c);
      if (k === "exact") return "exact";
      if (k === "fuzzy") return "fuzzy";
    }
    return "miss";
  };

  const submit = () => {
    if (submitted || locked) return;
    if (value.trim() === "") return;
    const kind = validate();
    setMatchKind(kind);
    setSubmitted(true);
    if (kind === "exact") {
      onSubmit(true, 1);
    } else if (kind === "fuzzy") {
      onSubmit(true, 0.85, {
        headline: "Close enough!",
        subhead: `Actually it's "${question.answer}".`,
      });
    } else {
      onSubmit(false, 0);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  useEffect(() => {
    if (!onReady) return;
    onReady(value.trim() !== "" && !submitted && !locked, submit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, submitted, locked]);

  const wasWrong = submitted && matchKind === "miss";

  return (
    <div className="flex w-full flex-1 flex-col">
      <h2 className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-ink-muted">
        Fill in the blank
      </h2>

      <div
        className="font-display mb-6 flex flex-wrap items-center gap-x-2 gap-y-3 text-2xl tracking-tight leading-snug text-ink md:text-3xl"
        data-quiz-options="fill_in_blank"
      >
        {before ? <span>{before}</span> : null}
        <input
          type="text"
          inputMode="text"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          disabled={submitted || locked}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="…"
          aria-label="Your answer"
          data-quiz-input="fill_in_blank"
          data-correct-answer={question.answer}
          className={`min-w-[8ch] max-w-full rounded-xl border-2 bg-surface px-3 py-2 text-2xl font-black tracking-tight text-ink outline-none transition-colors focus:border-primary md:text-3xl ${
            submitted
              ? matchKind === "exact"
                ? "border-primary bg-primary-soft text-primary-dark"
                : matchKind === "fuzzy"
                ? "border-xp bg-xp/10 text-xp-dark"
                : "border-heart bg-heart/10 text-heart animate-shake"
              : "border-border focus:bg-primary-soft/40"
          }`}
          style={{
            width: `${Math.max(8, value.length + 2)}ch`,
            maxWidth: "100%",
          }}
        />
        {after ? <span>{after}</span> : null}
      </div>

      {wasWrong ? (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border-2 border-border bg-surface-muted px-4 py-3 text-sm font-bold text-ink-muted">
          <AlertCircle
            className="mt-[2px] h-4 w-4 shrink-0 text-heart"
            strokeWidth={3}
            aria-hidden="true"
          />
          <span>
            Correct answer:{" "}
            <span className="text-ink">{question.answer}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
