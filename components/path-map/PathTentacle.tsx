"use client";

// =============================================================
// <PathTentacle /> — a smart wrapper around the base <Tentacle />
// that bends toward an on-screen target, pops speech bubbles, and
// reacts to events from the parent page. The base lives at a screen
// edge while the tip dynamically gestures.
//
// This is a "teammate" wrapper: it owns dynamic rotation + speech
// bubble UI; it does NOT redraw the tentacle artwork.
// =============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Tentacle,
  type TentacleAnchor,
  type TentacleMood,
} from "@/components/gamification";

/**
 * Drives what the tentacle is currently "doing". Parent computes which event
 * to emit; PathTentacle decides how to animate + whether to show a bubble.
 *
 *  - "idle"       → wave gently in place
 *  - "reach"      → bend toward a screen y-coordinate (no bubble)
 *  - "react"      → quick burst + speech bubble for `durationMs`
 *  - "celebrate"  → bigger wiggle + optional speech bubble
 */
export type PathTentacleEvent =
  | { type: "idle" }
  | { type: "reach"; targetY?: number }
  | { type: "react"; message: string; durationMs?: number }
  | { type: "celebrate"; message?: string; durationMs?: number };

export interface PathTentacleProps {
  /** Which edge of the screen the tentacle is glued to. */
  anchor: "left" | "right";
  /** Pixel-percent from top of viewport for the tentacle's base (e.g. 45). */
  baseTopPct?: number;
  /** Tentacle length in px. */
  length?: number;
  /** Tentacle thickness in px. */
  thickness?: number;
  /** Current event driving the tentacle. */
  event?: PathTentacleEvent;
  /** When the event was set (ms epoch) — used to auto-dismiss reactions. */
  eventTimestamp?: number;
  /** Optional class names for positioning override. */
  className?: string;
  /** Optional override for the curl direction. */
  curl?: "in" | "out";
  /** Optional positioning style overrides (e.g. bottom anchoring on mobile). */
  style?: React.CSSProperties;
}

/**
 * Map a PathTentacleEvent → mood passed to the underlying <Tentacle />.
 */
function moodForEvent(event: PathTentacleEvent): TentacleMood {
  switch (event.type) {
    case "celebrate":
      return "celebrating";
    case "react":
      return "wiggling";
    case "reach":
      return "reaching";
    case "idle":
    default:
      return "idle";
  }
}

/**
 * Compute the wrapper rotation in degrees based on the active event.
 * The base <Tentacle /> already does its own oscillation; this is an outer
 * tilt that points the entire tentacle in the right direction.
 */
function rotateForEvent(
  event: PathTentacleEvent,
  anchor: "left" | "right",
  baseTopPct: number,
): number {
  if (event.type === "idle") return 0;
  if (event.type === "celebrate") return anchor === "left" ? -6 : 6;
  if (event.type === "react") return anchor === "left" ? 20 : -20;

  if (event.type === "reach") {
    if (typeof event.targetY !== "number" || typeof window === "undefined") {
      return 0;
    }
    const baseY = (baseTopPct / 100) * window.innerHeight;
    const delta = event.targetY - baseY; // px; +ve = target is below base
    // Map ±400px → ±12deg. Sign flips between left/right because the wrapper
    // is mirrored for the right anchor (anchor=180 rotation), so "down" on
    // the right side requires the opposite tilt.
    const raw = Math.max(-12, Math.min(12, (delta / 400) * 12));
    return anchor === "left" ? raw : -raw;
  }

  return 0;
}

export function PathTentacle({
  anchor,
  baseTopPct = 45,
  length = 160,
  thickness = 56,
  event = { type: "idle" },
  eventTimestamp,
  className,
  curl = "in",
  style,
}: PathTentacleProps) {
  const prefersReducedMotion = useReducedMotion();
  // Whether the speech bubble is currently visible. Driven by event type +
  // an internal timer so the bubble auto-dismisses without parent help.
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The message currently being shown. We snapshot at event-receipt time so
  // that if the parent flips back to "idle" before the dismiss timer fires,
  // the bubble still animates out with the right text.
  const [bubbleMessage, setBubbleMessage] = useState<string | null>(null);

  useEffect(() => {
    // Reduced-motion users get a calm idle tentacle and no auto-popping bubbles.
    if (prefersReducedMotion) {
      setBubbleVisible(false);
      return;
    }
    if (event.type === "react" || (event.type === "celebrate" && event.message)) {
      const msg = event.type === "react" ? event.message : event.message ?? "";
      setBubbleMessage(msg);
      setBubbleVisible(true);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      const duration =
        ("durationMs" in event && event.durationMs) ||
        (event.type === "celebrate" ? 4000 : 3000);
      dismissTimer.current = setTimeout(() => {
        setBubbleVisible(false);
      }, duration);
    } else {
      // Non-bubble events: hide whatever was showing.
      setBubbleVisible(false);
    }
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
    // Keying on eventTimestamp ensures repeat-events of the same kind retrigger
    // the timer (e.g. two consecutive "react"s with different messages).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.type, eventTimestamp, prefersReducedMotion]);

  const rotate = useMemo(
    () => (prefersReducedMotion ? 0 : rotateForEvent(event, anchor, baseTopPct)),
    [event, anchor, baseTopPct, prefersReducedMotion],
  );
  const mood = useMemo(() => moodForEvent(event), [event]);

  // Position of the speech bubble: at the tip of the tentacle. The wrapper
  // is `length` px wide along the tentacle direction, so the tip sits at
  // `left: length` for a left-anchored tentacle (the wrapper isn't mirrored
  // at this level; that's done inside <Tentacle /> via its internal transform).
  // We position the bubble in screen coordinates around the outer fixed div.
  // For "left" anchor: bubble grows out to the right of the tip.
  // For "right" anchor: bubble grows out to the left of the tip.
  const bubblePosStyle: React.CSSProperties =
    anchor === "left"
      ? { left: length - 8, top: -28 }
      : { right: length - 8, top: -28 };

  const tailStyle: React.CSSProperties =
    anchor === "left"
      ? {
          left: -6,
          top: "50%",
          transform: "translateY(-50%) rotate(45deg)",
        }
      : {
          right: -6,
          top: "50%",
          transform: "translateY(-50%) rotate(45deg)",
        };

  return (
    <div
      aria-hidden
      className={
        className ??
        "pointer-events-none fixed z-0"
      }
      style={{
        // baseTopPct defines the vertical anchor; left/right is determined by anchor.
        [anchor === "left" ? "left" : "right"]: 0,
        top: `${baseTopPct}%`,
        ...style,
      }}
    >
      {/* Outer wrapper does the dynamic "bend toward target" rotation. We keep
          this separate from the per-mood oscillation so they compose cleanly. */}
      <motion.div
        animate={{ rotate }}
        transition={{ type: "spring", stiffness: 140, damping: 16 }}
        style={{
          transformOrigin: anchor === "left" ? "0% 50%" : "100% 50%",
          position: "relative",
        }}
      >
        <Tentacle
          anchor={anchor}
          length={length}
          thickness={thickness}
          curl={curl}
          mood={mood}
        />

        {/* Speech bubble — absolutely positioned near the tentacle's tip. We
            anchor it to the *unrotated* tip so the outer rotation carries it
            along naturally as the tentacle bends. */}
        <AnimatePresence>
          {bubbleVisible && bubbleMessage && (
            <motion.div
              key={`bubble-${eventTimestamp ?? bubbleMessage}`}
              initial={{ opacity: 0, scale: 0.85, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -4 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              style={{
                position: "absolute",
                ...bubblePosStyle,
                // Reset the outer mirror so the bubble text reads left-to-right
                // when anchored to the right edge (the <Tentacle /> internal
                // rotate(180deg) would flip our text otherwise — but since we
                // sit OUTSIDE the inner SVG, we're fine. This is just safety.).
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}
              className="rounded-2xl border-2 border-primary bg-surface px-3 py-1.5 text-sm font-extrabold text-ink shadow-pop-soft"
            >
              {bubbleMessage}
              {/* Triangle tail — square rotated 45deg, placed on the side
                  facing the tentacle base. */}
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  width: 10,
                  height: 10,
                  background: "var(--color-surface, white)",
                  borderLeft: "2px solid var(--color-primary)",
                  borderBottom: "2px solid var(--color-primary)",
                  ...tailStyle,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
