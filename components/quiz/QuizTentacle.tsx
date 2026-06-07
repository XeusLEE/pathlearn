"use client";

// =============================================================
// <QuizTentacle /> — a *god-level* interactive tentacle for the quiz player.
//
// What it does:
//   • Picks a smart target on the live DOM based on feedback state and the
//     active question's type — and physically reaches its TIP to that node
//     (via Tentacle's reachToTarget API) so the tentacle literally *points
//     at* the correct option, the user's current selection, or the fill input.
//   • Owns an attached speech bubble — but only when `silent === false`. The
//     "speaker" tentacle has the bubble; sibling tentacles are silent visual
//     reactors (subtle wiggle on selection, droop on wrong, celebrate on
//     correct).
//   • Personality, dramatic sizing per viewport, keyboard-tuck heuristic and
//     reduced-motion support are all preserved.
//
// Designed to be drop-in for QuizPlayer.tsx — three mount sites (left, right,
// bottom) with `silent` flagged per spec.
// =============================================================

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Tentacle,
  type TentacleAnchor,
  type TentacleMood,
} from "@/components/gamification";
import type { Question } from "@/lib/types";

export type QuizTentaclePersonality = "curious" | "shy" | "playful" | "wise";

export interface QuizTentacleProps {
  /** Which edge of the screen the tentacle emerges from. */
  anchor: "left" | "right" | "bottom";
  /** The current question — used to derive the "correct answer" text. */
  question?: Question;
  /** Current feedback state — null = no feedback yet. */
  feedback: { correct: boolean; tone?: "correct" | "wrong" | "almost" } | null;
  /** Override length (px). Defaults vary with viewport. */
  length?: number;
  /** Override thickness (px). Defaults vary with viewport. */
  thickness?: number;
  /** Additional positioning classes for the outer wrapper. */
  className?: string;
  /** When true, render mobile-sized (forces compact size regardless of vw). */
  compact?: boolean;
  /**
   * CSS selector to track. The tentacle will bend toward this element's
   * bounding-rect center while it's visible. When omitted, falls back to
   * the smart auto-targeting based on feedback state.
   */
  targetSelector?: string;
  /** Direct element reference. Wins over `targetSelector` when both are set. */
  targetElement?: Element | null;
  /** Optional personality — affects subtle motion behavior. */
  personality?: QuizTentaclePersonality;
  /**
   * When true, this tentacle never renders a speech bubble — purely visual.
   * Used to avoid duplicate bubbles when multiple QuizTentacles are mounted.
   * Defaults to false (i.e. the tentacle speaks).
   */
  silent?: boolean;
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
 * Returns true when, on a wrong answer for this question type, the tentacle
 * can *literally point* at a single DOM element representing the answer —
 * meaning the bubble can just say "It's this one →" instead of quoting text.
 */
function isPointableType(q: Question | undefined): boolean {
  if (!q) return false;
  return q.type === "multiple_choice" || q.type === "true_false";
}

/**
 * Stable pick from a list keyed by an arbitrary string so the same question
 * shows the same cheer (avoids re-rolls on re-render).
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
 *
 * For pointable types on a wrong answer, the bubble is short ("It's this one
 * →") because the tentacle TIP is physically landing on the correct option;
 * the user gets the answer from the tip cursor, not the bubble text.
 */
function bubbleFor(
  feedback: QuizTentacleProps["feedback"],
  question: Question | undefined,
  idleHint: boolean
): BubbleContent | null {
  if (feedback === null) {
    if (idleHint) {
      const seed = question?.id ?? "no-q";
      return { text: pick(IDLE_PROMPTS, seed), tone: "idle" };
    }
    return null;
  }

  if (feedback.correct) {
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

  // Wrong → state the correct answer in the bubble. (The tentacles no longer
  // physically point at the option, so the bubble must carry the answer.)
  if (!question) return { text: "Not quite.", tone: "wrong" };
  const ans = truncate(correctAnswerText(question));
  if (!ans) return { text: "Not quite.", tone: "wrong" };
  return { text: `It's: ${ans}`, tone: "wrong" };
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
  switch (anchor) {
    case "left":
      return {
        style: {
          left: length + 12,
          top: -8,
          maxWidth: 220,
        },
        tail: "left",
      };
    case "right":
      return {
        style: {
          right: length + 12,
          top: -8,
          maxWidth: 220,
        },
        tail: "right",
      };
    case "bottom":
    default:
      return {
        style: {
          left: length * 0.6,
          bottom: length + 16,
          maxWidth: 220,
        },
        tail: "bottom",
      };
  }
}

/** Viewport breakpoint helper — returns a tier so size resolves uniformly. */
type ViewportTier = "sm" | "md" | "lg";

function useViewportTier(): ViewportTier {
  const [tier, setTier] = useState<ViewportTier>(() => {
    if (typeof window === "undefined") return "md";
    const w = window.innerWidth;
    if (w < 640) return "sm";
    if (w < 1024) return "md";
    return "lg";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const compute = () => {
      const w = window.innerWidth;
      setTier(w < 640 ? "sm" : w < 1024 ? "md" : "lg");
    };
    window.addEventListener("resize", compute);
    compute();
    return () => window.removeEventListener("resize", compute);
  }, []);

  return tier;
}

/**
 * Tracks whether the on-screen keyboard is likely open. Heuristic: compare
 * window.innerHeight to the initial reading taken on mount; if it shrinks by
 * >150px, assume a keyboard is overlaying the viewport.
 */
function useKeyboardLikelyOpen(): boolean {
  const [open, setOpen] = useState(false);
  const initialH = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    initialH.current = window.innerHeight;
    const onResize = () => {
      const base = initialH.current ?? window.innerHeight;
      const delta = base - window.innerHeight;
      setOpen(delta > 150);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return open;
}

/**
 * rAF-based bounding-rect tracker. Polls the element's getBoundingClientRect()
 * on every animation frame while `enabled` is true. Returns null when the
 * element is missing/hidden. Resolution: target can be (a) an Element
 * reference passed directly, or (b) a CSS selector resolved on each frame
 * (so the target can mount/unmount in the DOM without the consumer caring).
 *
 * NOTE: per spec, we skip polling entirely when `enabled === false`.
 */
function useTargetRect(
  enabled: boolean,
  source: { element?: Element | null; selector?: string }
): { x: number; y: number } | null {
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setCenter(null);
      return;
    }
    const tick = () => {
      const { element, selector } = sourceRef.current;
      const el =
        element ?? (selector ? document.querySelector(selector) : null);
      if (!el || !(el as HTMLElement).getBoundingClientRect) {
        // Only update if we previously had one; avoids redundant renders.
        setCenter((prev) => (prev === null ? prev : null));
      } else {
        const rect = (el as HTMLElement).getBoundingClientRect();
        // Skip detached / collapsed elements.
        if (rect.width === 0 && rect.height === 0) {
          setCenter((prev) => (prev === null ? prev : null));
        } else {
          const nx = rect.left + rect.width / 2;
          const ny = rect.top + rect.height / 2;
          setCenter((prev) => {
            if (prev && Math.abs(prev.x - nx) < 0.5 && Math.abs(prev.y - ny) < 0.5) {
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
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled]);

  return center;
}

/**
 * Computes the on-screen position of the tentacle BASE based on the anchor.
 * The base sits at the screen edge — we derive a reasonable approximation
 * from window dimensions + anchor + the consumer's known top% positioning.
 */
function approximateBasePosition(
  anchor: QuizTentacleProps["anchor"],
  topPct: number
): { x: number; y: number } | null {
  if (typeof window === "undefined") return null;
  const w = window.innerWidth;
  const h = window.innerHeight;
  switch (anchor) {
    case "left":
      return { x: 0, y: (topPct / 100) * h };
    case "right":
      return { x: w, y: (topPct / 100) * h };
    case "bottom":
      return { x: w * 0.08, y: h };
  }
}

/**
 * Dramatic size defaults per viewport — bigger, more present tentacles.
 *
 * Per spec:
 *  • <640 (sm) compact: length: 110, thickness: 36
 *  • 640-1024 (md):      length: 180, thickness: 50
 *  • >=1024 (lg):        length: 260, thickness: 58
 */
function defaultSizeFor(
  tier: ViewportTier,
  _anchor: QuizTentacleProps["anchor"]
): { length: number; thickness: number } {
  if (tier === "sm") return { length: 100, thickness: 34 };
  if (tier === "md") return { length: 130, thickness: 42 };
  return { length: 150, thickness: 46 };
}

/**
 * Build the auto-target CSS selector based on feedback state + question type.
 *
 * Target chain (priority order):
 *   1. WRONG — point at the correct option for the active question type:
 *      • multiple_choice / true_false: [data-quiz-options=type] [data-correct=true]
 *      • fill_in_blank: [data-quiz-options=fill_in_blank] [data-quiz-input]
 *      • matching: [data-quiz-options=matching] [data-quiz-match-left]:first-of-type
 *      • ordering: [data-quiz-options=ordering] [data-quiz-order-item]:first-of-type
 *      • fallback: [data-quiz-target=feedback]
 *   2. IDLE (feedback === null) — track the user's currently-selected option:
 *      [data-quiz-options=type] [data-quiz-option][data-selected=true]
 *      If nothing selected, fall through to the question viewport.
 *   3. NO-OP for correct — null target (handled by `trackingEnabled`).
 */
function buildAutoSelector(
  question: Question | undefined,
  feedback: QuizTentacleProps["feedback"]
): string | undefined {
  // Wrong answer → reach to the correct option (or input).
  if (feedback && !feedback.correct && question) {
    switch (question.type) {
      case "multiple_choice":
        return '[data-quiz-options="multiple_choice"] [data-quiz-option][data-correct="true"]';
      case "true_false":
        return '[data-quiz-options="true_false"] [data-quiz-option][data-correct="true"]';
      case "fill_in_blank":
        return '[data-quiz-options="fill_in_blank"] [data-quiz-input]';
      case "matching":
        return '[data-quiz-options="matching"] [data-quiz-match-left]:first-of-type';
      case "ordering":
        return '[data-quiz-options="ordering"] [data-quiz-order-item]:first-of-type';
      default: {
        const _ex: never = question;
        void _ex;
        return '[data-quiz-target="feedback"]';
      }
    }
  }
  // Idle (feedback === null) → follow the currently-selected option.
  if (feedback === null && question) {
    switch (question.type) {
      case "multiple_choice":
        return '[data-quiz-options="multiple_choice"] [data-quiz-option][data-selected="true"]';
      case "true_false":
        return '[data-quiz-options="true_false"] [data-quiz-option][data-selected="true"]';
      case "fill_in_blank":
        // No "selected" state — just track the input itself.
        return '[data-quiz-options="fill_in_blank"] [data-quiz-input]';
      case "matching":
        // No clear selection model — track the left column.
        return '[data-quiz-options="matching"] [data-quiz-match-left]:first-of-type';
      case "ordering":
        return '[data-quiz-options="ordering"] [data-quiz-order-item]:first-of-type';
      default: {
        const _ex: never = question;
        void _ex;
        return '[data-quiz-target="question"]';
      }
    }
  }
  // Otherwise (correct, or no question) → no auto target.
  return undefined;
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
  targetSelector,
  targetElement,
  personality,
  silent = false,
}: QuizTentacleProps) {
  const reducedMotion = useReducedMotion();
  const viewportTier = useViewportTier();

  // Force "sm" sizing when caller flagged compact (the mobile mount path).
  const tier: ViewportTier = compact ? "sm" : viewportTier;
  const baseSize = defaultSizeFor(tier, anchor);

  const keyboardOpen = useKeyboardLikelyOpen();
  // Auto-tuck: shrink and shy out while the on-screen keyboard is open.
  const keyboardTuckScale = keyboardOpen ? 0.6 : 1;

  let resolvedLength = length ?? baseSize.length;
  let resolvedThickness = thickness ?? baseSize.thickness;
  resolvedLength = Math.round(resolvedLength * keyboardTuckScale);
  resolvedThickness = Math.round(resolvedThickness * keyboardTuckScale);

  // After 6s of `feedback === null`, show an idle "take your time" bubble —
  // only on the SPEAKER (i.e. !silent) tentacle so we never get duplicate
  // hints from sibling visuals.
  const [idleHint, setIdleHint] = useState(false);
  useEffect(() => {
    if (reducedMotion) return;
    if (silent) return;
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
  }, [silent, feedback, question?.id, reducedMotion]);

  // ---- Mood derivation ----
  // The speaker (silent === false) reflects the literal feedback state.
  // Silent siblings react sympathetically:
  //   • feedback === null  → idle
  //   • correct            → celebrating (joins the party)
  //   • wrong              → drooping (sad nod, no pointing)
  //   • almost             → reaching (mirrors the speaker)
  // Additionally, silent tentacles do a brief "wiggling" pulse whenever the
  // speaker's question changes selection — driven below by `selectionPulse`.
  let mood: TentacleMood = moodFor(feedback);
  if (keyboardOpen) mood = "drooping";

  // Detect selection changes for the silent supportive-nodder effect.
  // We listen to all [data-quiz-option][data-selected=true] mutations in the
  // doc and fire a one-shot pulse. Only silent tentacles use this.
  const [selectionPulse, setSelectionPulse] = useState(false);
  useEffect(() => {
    if (!silent) return;
    if (reducedMotion) return;
    if (feedback !== null) return; // only during the pre-submit phase
    if (typeof window === "undefined") return;

    let last: string | null = null;
    const compute = (): string | null => {
      const el = document.querySelector(
        '[data-quiz-option][data-selected="true"]'
      ) as HTMLElement | null;
      if (!el) return null;
      return (
        el.getAttribute("data-quiz-option") ??
        el.getAttribute("data-quiz-option-text") ??
        "1"
      );
    };
    last = compute();

    let pulseT: number | undefined;
    const obs = new MutationObserver(() => {
      const next = compute();
      if (next !== last) {
        last = next;
        if (next !== null) {
          setSelectionPulse(true);
          window.clearTimeout(pulseT);
          pulseT = window.setTimeout(() => setSelectionPulse(false), 400);
        }
      }
    });
    obs.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-selected"],
    });
    return () => {
      obs.disconnect();
      window.clearTimeout(pulseT);
    };
  }, [silent, feedback, reducedMotion]);

  if (silent && selectionPulse) {
    mood = "wiggling";
  }

  const bubble = useMemo(
    () => bubbleFor(feedback, question, idleHint),
    [feedback, question, idleHint]
  );

  // ---- Smart targeting ----
  // Skip polling entirely when:
  //   • reduced motion
  //   • feedback.correct === true (no point chasing — just celebrate in place)
  //   • the tentacle is silent AND there's no need to follow the selection
  //     (silent tentacles only need to point during wrong-answer drama, and
  //     the speaker handles that; silent ones just emote)
  // For correctness with the existing tracking behavior, silent tentacles
  // simply DON'T track — they're decorative.
  const explicitTarget = useMemo(
    () => targetElement ?? null,
    [targetElement]
  );

  const autoSelector = useMemo<string | undefined>(() => {
    if (targetSelector !== undefined) return targetSelector;
    return buildAutoSelector(question, feedback);
  }, [targetSelector, question, feedback]);

  const trackingEnabled =
    !reducedMotion &&
    !silent &&
    feedback?.correct !== true &&
    (!!explicitTarget || !!autoSelector);

  const trackerSource = useMemo(
    () => ({ element: explicitTarget, selector: autoSelector }),
    [explicitTarget, autoSelector]
  );

  const targetCenter = useTargetRect(trackingEnabled, trackerSource);

  // Approximate base position from the consumer's mount placement. The
  // consumer typically uses `top: 38%` / `top: 50%` (left / right) and
  // `bottom: 6rem` for mobile.
  const baseTopPct = anchor === "left" ? 38 : anchor === "right" ? 50 : 92;
  const basePosition = useMemo(
    () => approximateBasePosition(anchor, baseTopPct),
    [anchor, baseTopPct]
  );

  // ---- Reach plumbing ----
  // The speaker (when feedback is wrong) wants the tentacle TIP to physically
  // land on the correct option. Tentacle.tsx's reachToTarget + maxStretch +
  // showTipCursor handle the actual stretch/visual.
  const wantReach =
    !reducedMotion &&
    !silent &&
    feedback !== null &&
    !feedback.correct &&
    targetCenter !== null;

  // showTipCursor — pulsing glow at the tip — disabled under reduced motion
  // and on silent siblings (they're not the explainer).
  const showTipCursor = wantReach;

  const geom = bubbleGeometry(anchor, resolvedLength);

  // Map QuizTentacle.anchor → Tentacle.anchor.
  const tentacleAnchor: TentacleAnchor = anchor;
  // Curl direction: wise & out-anchored tentacles curl outward; others inward.
  const curl: "in" | "out" =
    personality === "wise"
      ? "out"
      : anchor === "right"
      ? "out"
      : "in";

  // Bubble accent color follows tone — primary for correct, heart for
  // wrong, soft border for idle hints.
  const tone = bubble?.tone ?? "idle";
  const borderClass =
    tone === "correct"
      ? "border-primary"
      : tone === "wrong"
      ? "border-heart"
      : "border-border";
  const textClass = "text-ink";

  const tailBg = "bg-surface";
  const tailBorder =
    tone === "correct"
      ? "border-primary"
      : tone === "wrong"
      ? "border-heart"
      : "border-border";

  // Bubble suppression: silent tentacles NEVER render a bubble. Keyboard
  // suppression remains so we don't clutter mid-type.
  const showBubble = !silent && !!bubble && !keyboardOpen;

  // We pass the entire reach + visual chain straight into <Tentacle>; we no
  // longer rotate the outer wrapper since the inner per-joint solver handles
  // the bend. Keeping a small outer scale for keyboard-tuck only.
  const onAnimate = useCallback(() => {
    if (reducedMotion) return {};
    return { scale: keyboardTuckScale };
  }, [keyboardTuckScale, reducedMotion]);

  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none ${className ?? ""}`}
      animate={onAnimate()}
      transition={
        reducedMotion
          ? undefined
          : { type: "spring", stiffness: 160, damping: 22 }
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
          personality={personality ?? "curious"}
          segments={5}
          /* Reach DISABLED: the tentacles now flank the question card and
             simply curl + wave beside the options (the bubble teaches the
             answer). Literal cross-screen reach depended on an edge-assumed
             base position and produced stranded flat ribbons on wide screens. */
          target={null}
          reachToTarget={false}
          showTipCursor={false}
        />

        {/* Speech bubble — only on the speaker (silent === false). */}
        <AnimatePresence>
          {showBubble ? (
            <motion.div
              key={`bubble-${bubble!.text}`}
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
              {bubble!.text}

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
