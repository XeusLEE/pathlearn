"use client";

// =============================================================
// <QuizTentacle /> — an *interactive* tentacle for QuizPlayer.
// Wraps the base <Tentacle> with:
//   • mood derived from feedback (idle / celebrating / reaching / drooping)
//   • a small speech bubble that POINTS toward the answer area on a
//     wrong answer, quoting the correct answer in plain language
//   • a lean toward screen-center on a wrong answer (the "let me
//     help" gesture)
//   • an optional idle "thinking" bubble after a long pause
//   • full respect for prefers-reduced-motion
//
// Designed to be drop-in for the existing <Tentacle> mounts in
// QuizPlayer.tsx — the consumer still controls outer positioning
// via Tailwind classes (fixed / left / right / bottom).
// =============================================================

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Tentacle,
  type TentacleAnchor,
  type TentacleMood,
} from "@/components/gamification";
import type { Question } from "@/lib/types";

export interface QuizTentacleProps {
  /** Which edge of the screen the tentacle emerges from. */
  anchor: "left" | "right" | "bottom";
  /** The current question — used to derive the "correct answer" text. */
  question?: Question;
  /** Current feedback state — null = no feedback yet. */
  feedback: { correct: boolean; tone?: "correct" | "wrong" | "almost" } | null;
  /** Override length (px). Defaults vary with `compact`. */
  length?: number;
  /** Override thickness (px). Defaults vary with `compact`. */
  thickness?: number;
  /** Additional positioning classes for the outer wrapper. */
  className?: string;
  /** When true, render mobile-sized. */
  compact?: boolean;
}

type BubbleTone = "correct" | "wrong" | "idle";

interface BubbleContent {
  text: string;
  tone: BubbleTone;
}

const CORRECT_CHEERS = [
  "Nice!",
  "Yes!",
  "Got it!",
  "Sharp.",
  "Exactly.",
];

const ALMOST_NUDGES = [
  "So close —",
  "Right idea —",
  "Almost —",
];

const IDLE_PROMPTS = [
  "Take your time.",
  "No rush.",
  "Think it through.",
];

/** Truncate to ~80 chars on a word boundary when possible. */
function truncate(s: string, max = 80): string {
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

/**
 * Pulls the canonical answer text from a Question, formatting it for a small
 * speech bubble. Stays under ~80 chars; FeedbackBanner has room for the full
 * explanation if more detail is needed.
 */
function correctAnswerText(q: Question): string {
  switch (q.type) {
    case "multiple_choice":
      return q.options[q.correctIndex] ?? "";
    case "fill_in_blank":
      return q.answer;
    case "true_false":
      return q.correct ? "True" : "False";
    case "matching": {
      const joined = q.pairs.map((p) => `${p.left} → ${p.right}`).join(" · ");
      return joined;
    }
    case "ordering": {
      const joined = q.items
        .map((it, i) => `${i + 1}. ${it}`)
        .join(" · ");
      return joined;
    }
    default: {
      const _exhaustive: never = q;
      void _exhaustive;
      return "";
    }
  }
}

/**
 * Stable pick from a list keyed by an arbitrary string so the same question
 * shows the same cheer (avoids re-rolls on re-render). For idle prompts we
 * pass a time-bucket key so it rotates over time but stays stable within a
 * single render pass.
 */
function pick<T>(list: T[], key: string): T {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % list.length;
  return list[idx]!;
}

/** Map feedback → tentacle mood. */
function moodFor(
  feedback: QuizTentacleProps["feedback"]
): TentacleMood {
  if (feedback === null) return "idle";
  if (feedback.correct) return "celebrating";
  if (feedback.tone === "almost") return "reaching";
  return "drooping";
}

/**
 * Build the bubble content from feedback + question. Returns null when no
 * bubble should render.
 */
function bubbleFor(
  feedback: QuizTentacleProps["feedback"],
  question: Question | undefined,
  idleHint: boolean
): BubbleContent | null {
  if (feedback === null) {
    if (idleHint) {
      // Use question id (or 'no-q') as a stable seed so the prompt is
      // deterministic for this question; avoids flickering across renders.
      const seed = question?.id ?? "no-q";
      return { text: pick(IDLE_PROMPTS, seed), tone: "idle" };
    }
    return null;
  }

  if (feedback.correct) {
    // Almost still flips correct=true on the QuizPlayer side; we treat it as
    // a softer nudge bubble rather than a celebration.
    if (feedback.tone === "almost") {
      const seed = question?.id ?? "almost";
      const nudge = pick(ALMOST_NUDGES, seed);
      if (!question) return { text: nudge, tone: "wrong" };
      const ans = truncate(correctAnswerText(question));
      return {
        text: `${nudge} it's ${ans}`,
        tone: "wrong",
      };
    }
    const seed = question?.id ?? "ok";
    return { text: pick(CORRECT_CHEERS, seed), tone: "correct" };
  }

  // Wrong → quote the correct answer in plain language.
  if (!question) return { text: "Not quite.", tone: "wrong" };
  const ans = truncate(correctAnswerText(question));
  if (!ans) return { text: "Not quite.", tone: "wrong" };
  return { text: `It's actually: ${ans}`, tone: "wrong" };
}

/**
 * Bubble geometry — where the bubble sits relative to the tentacle wrapper,
 * and which direction the tail points.
 */
function bubbleGeometry(
  anchor: "left" | "right" | "bottom",
  length: number
): {
  style: React.CSSProperties;
  tail: "left" | "right" | "bottom";
} {
  // The Tentacle wrapper has CSS width=length+tipW and the SVG rotates from
  // the base. The "tip" in screen coordinates depends on `anchor`. For our
  // three supported anchors we eyeball positions that read well.
  switch (anchor) {
    case "left":
      // Tentacle base sits at left edge, tip extends to the right. Bubble
      // hovers above and to the right of the tip.
      return {
        style: {
          left: length + 12,
          top: -8,
          maxWidth: 200,
        },
        tail: "left",
      };
    case "right":
      // Tentacle base is at the right edge; tip extends to the LEFT (the
      // SVG itself is rotated 180deg in the gamification wrapper). Bubble
      // sits to the LEFT of the tip.
      return {
        style: {
          right: length + 12,
          top: -8,
          maxWidth: 200,
        },
        tail: "right",
      };
    case "bottom":
    default:
      // Tentacle pokes up from the bottom-left area. Bubble sits above
      // and slightly to the right.
      return {
        style: {
          left: length * 0.6,
          bottom: length + 16,
          maxWidth: 200,
        },
        tail: "bottom",
      };
  }
}

/**
 * The "lean toward center" rotation when the answer is wrong. The base
 * Tentacle has its own internal mood-rotation; this is an extra wrapper
 * tilt applied to the OUTER div so the whole tentacle gestures inward.
 */
function leanFor(
  anchor: QuizTentacleProps["anchor"],
  feedback: QuizTentacleProps["feedback"]
): number {
  if (feedback === null || feedback.correct) return 0;
  // Tilt 6deg toward the center of the screen. Left tentacle leans right
  // (positive); right tentacle leans left (negative).
  switch (anchor) {
    case "left":
      return 6;
    case "right":
      return -6;
    case "bottom":
      return 0;
  }
}

/**
 * QuizTentacle — interactive coach version of the Tentacle. See header
 * comment for behavior.
 */
export function QuizTentacle({
  anchor,
  question,
  feedback,
  length,
  thickness,
  className,
  compact = false,
}: QuizTentacleProps) {
  const reducedMotion = useReducedMotion();

  // Sensible defaults per anchor / compact.
  const resolvedLength =
    length ??
    (compact ? 92 : anchor === "right" ? 130 : anchor === "bottom" ? 110 : 150);
  const resolvedThickness =
    thickness ??
    (compact ? 38 : anchor === "right" ? 48 : anchor === "bottom" ? 44 : 56);

  // After 6s of `feedback === null`, briefly show a "take your time" bubble
  // (only on the LEFT tentacle to avoid both sides talking at once).
  const [idleHint, setIdleHint] = useState(false);
  useEffect(() => {
    if (reducedMotion) return;
    if (anchor !== "left") return;
    if (feedback !== null) {
      setIdleHint(false);
      return;
    }
    const showT = window.setTimeout(() => setIdleHint(true), 6000);
    const hideT = window.setTimeout(() => setIdleHint(false), 6000 + 2500);
    return () => {
      window.clearTimeout(showT);
      window.clearTimeout(hideT);
    };
  }, [anchor, feedback, question?.id, reducedMotion]);

  const mood = moodFor(feedback);
  const bubble = useMemo(
    () => bubbleFor(feedback, question, idleHint),
    [feedback, question, idleHint]
  );

  const leanDeg = leanFor(anchor, feedback);
  const geom = bubbleGeometry(anchor, resolvedLength);

  // Map QuizTentacle.anchor → Tentacle.anchor. Same names; just narrowing.
  const tentacleAnchor: TentacleAnchor = anchor;
  // Mobile bottom tentacle: keep curl="in" so suckers face up.
  const curl: "in" | "out" = anchor === "right" ? "out" : "in";

  // Bubble accent color follows tone — primary for correct, heart for
  // wrong, soft border for idle hints.
  const tone = bubble?.tone ?? "idle";
  const borderClass =
    tone === "correct"
      ? "border-primary"
      : tone === "wrong"
      ? "border-heart"
      : "border-border";
  const textClass = tone === "wrong" ? "text-ink" : "text-ink";

  // Triangle tail color matches the bubble border.
  const tailBg = "bg-surface";
  const tailBorder =
    tone === "correct"
      ? "border-primary"
      : tone === "wrong"
      ? "border-heart"
      : "border-border";

  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none ${className ?? ""}`}
      // Outer "lean toward center" tilt on wrong. Pivots at the base edge so
      // the tip swings inward rather than the whole thing translating.
      animate={
        reducedMotion
          ? undefined
          : {
              rotate: leanDeg,
            }
      }
      transition={
        reducedMotion
          ? undefined
          : { type: "spring", stiffness: 180, damping: 18 }
      }
      style={{
        transformOrigin:
          anchor === "left"
            ? "0% 50%"
            : anchor === "right"
            ? "100% 50%"
            : "50% 100%",
      }}
    >
      <div style={{ position: "relative" }}>
        <Tentacle
          anchor={tentacleAnchor}
          length={resolvedLength}
          thickness={resolvedThickness}
          curl={curl}
          mood={mood}
        />

        {/* Speech bubble. Positioned absolutely relative to the tentacle's
            own wrapper so it tracks any outer translate. */}
        <AnimatePresence>
          {bubble ? (
            <motion.div
              key={`bubble-${bubble.text}`}
              initial={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.85, y: 4 }
              }
              animate={
                reducedMotion
                  ? { opacity: 1 }
                  : { opacity: 1, scale: 1, y: 0 }
              }
              exit={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.9, y: 2 }
              }
              transition={
                reducedMotion
                  ? { duration: 0.15 }
                  : { type: "spring", stiffness: 320, damping: 22 }
              }
              role="status"
              aria-live="polite"
              style={{
                position: "absolute",
                zIndex: 1,
                ...geom.style,
              }}
              className={`rounded-2xl border-2 ${borderClass} bg-surface px-3 py-2 text-sm font-bold leading-snug ${textClass} shadow-pop-soft`}
            >
              {bubble.text}

              {/* Triangle tail — a rotated square that protrudes from the
                  bubble edge pointing at the tentacle tip. */}
              <span
                className={`absolute h-3 w-3 rotate-45 border-b-2 border-r-2 ${tailBorder} ${tailBg}`}
                style={
                  geom.tail === "left"
                    ? {
                        left: -7,
                        top: "50%",
                        marginTop: -6,
                        // Show the LEFT+BOTTOM borders by re-applying via
                        // tailwind borderless trick: rotate so the visible
                        // corner faces the tentacle.
                        transform: "rotate(135deg)",
                      }
                    : geom.tail === "right"
                    ? {
                        right: -7,
                        top: "50%",
                        marginTop: -6,
                        transform: "rotate(-45deg)",
                      }
                    : {
                        // bottom tail
                        left: 16,
                        bottom: -7,
                        transform: "rotate(45deg)",
                      }
                }
                aria-hidden
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
