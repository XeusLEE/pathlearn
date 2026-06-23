"use client";

// =============================================================
// <PathTentacle /> — a smart wrapper around the base <Tentacle />
// that bends toward an on-screen DOM target, pops speech bubbles,
// and reacts to events from the parent page. The base lives at a
// screen edge while the tip dynamically gestures toward the
// active episode node.
//
// God-level upgrades:
//   • `silent` mode — only ONE tentacle plays speech bubbles at
//     a time. Silent tentacles still react bodily (mood/idle).
//   • Physical reach — speaker tentacle's tip LITERALLY touches
//     the active episode circle via the underlying Tentacle's
//     reachToTarget + maxStretch + showTipCursor (Agent B API).
//   • Dramatic sizing — bigger lengths/thickness at every
//     breakpoint, 5 segments for smoother long curves.
//   • Viewport-cull guard — when the target element is offscreen
//     (with a margin) we stop polling its rect and idle instead
//     of pointing at nothing useful.
//   • Silent companion reactivity — scroll → small wave; path
//     change → ripple gesture; celebrate alongside speaker.
//
// Key responsibilities owned here:
//   1. DOM target tracking via a per-frame `getBoundingClientRect()`
//      poll (gated by viewport visibility).
//   2. Computing the tentacle's OWN base position (in viewport
//      coordinates) so Tentacle can build the correct base→tip
//      vector regardless of whether we're `fixed` or `absolute`.
//   3. Personality + viewport-aware smart sizing.
//   4. Auto-tuck near collision (100px threshold now that
//      tentacles are bigger).
//   5. Event-driven speech bubbles on the speaker only.
// =============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import {
  Tentacle,
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

/** Personality drives small mood + animation tweaks inside the base Tentacle. */
export type PathTentaclePersonality =
  | "curious"
  | "shy"
  | "playful"
  | "wise";

export interface PathTentacleProps {
  /** Which edge of the screen the tentacle is glued to. */
  anchor: "left" | "right";
  /** Pixel-percent from top of viewport for the tentacle's base (e.g. 45). */
  baseTopPct?: number;
  /** Tentacle length in px. If omitted, viewport-aware default is used. */
  length?: number;
  /** Tentacle thickness in px. If omitted, viewport-aware default is used. */
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
  /**
   * CSS selector for the DOM element the tip should curl toward.
   * When set, PathTentacle polls per-frame for the element's
   * bounding rect and passes the center to Tentacle.target.
   *
   * Pass `null` for an idle, no-target tentacle.
   */
  targetSelector?: string | null;
  /**
   * When true, force the tentacle into "reaching" mood (enabling physical
   * extension) regardless of `event`. Used for live pointer-follow so the
   * tip can literally land on the hovered/clicked item even when the event
   * channel is idle or driving a speech bubble.
   */
  forceReach?: boolean;
  /**
   * When true + `targetSelector` resolves, the tip literally lands on the
   * target (physical extension up to `maxStretch` × length). Default false
   * (lean toward only).
   */
  reachToTarget?: boolean;
  /** Max stretch factor when reaching. Default 1 (no extension). */
  maxStretch?: number;
  /** Show a pulsing glow at the tip when a target is set. Default false. */
  showTipCursor?: boolean;
  /** Personality forwarded to Tentacle; defaults derived from anchor. */
  personality?: PathTentaclePersonality;
  /** Hide the tentacle entirely (used to mute during tab transitions). */
  muted?: boolean;
  /**
   * Silent mode — when true the tentacle still animates bodily but suppresses
   * ALL speech bubbles (welcome / idle nudge / locked-tap / celebrate text).
   * Used to enforce a "single-speaker" rule across multiple tentacles on the
   * same screen.
   */
  silent?: boolean;
}

/**
 * Map a PathTentacleEvent → mood passed to the underlying <Tentacle />.
 * Auto-tucking can override this to "drooping" so we end up with a shy pose.
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
 * Compute the wrapper rotation in degrees based on the active event +
 * (when reaching) the absolute screen-Y of the current target. This is the
 * outer "aim the whole tentacle" tilt; per-mood oscillation is handled
 * inside the base <Tentacle />.
 */
function rotateForEvent(
  event: PathTentacleEvent,
  anchor: "left" | "right",
  baseTopPct: number,
  trackedTargetY: number | null,
): number {
  if (event.type === "idle") return 0;
  if (event.type === "celebrate") return anchor === "left" ? -6 : 6;
  if (event.type === "react") return anchor === "left" ? 20 : -20;

  if (event.type === "reach") {
    if (typeof window === "undefined") return 0;
    // Prefer the live tracked Y (from the rAF poll); fall back to the
    // explicit `targetY` on the event for backward compatibility.
    const targetY =
      typeof trackedTargetY === "number"
        ? trackedTargetY
        : typeof event.targetY === "number"
        ? event.targetY
        : null;
    if (targetY == null) return 0;
    const baseY = (baseTopPct / 100) * window.innerHeight;
    const delta = targetY - baseY;
    // Map ±400px → ±12deg. Sign flips between left/right because the
    // <Tentacle /> internal wrapper is mirrored when anchor==="right".
    const raw = Math.max(-12, Math.min(12, (delta / 400) * 12));
    return anchor === "left" ? raw : -raw;
  }

  return 0;
}

/**
 * Viewport-aware default size for the tentacle.
 *
 * DRAMATIC sizing tier (god-level upgrade): tentacles are big, theatrical,
 * and unmistakable. Caller may still override via explicit length/thickness
 * props (e.g. the bottom-mobile tentacle uses smaller numbers when it's a
 * companion rather than the primary speaker).
 */
function sizeForViewport(width: number): { length: number; thickness: number } {
  // Decorative edge accents — slim, modest sizes so they peek in and wave
  // gracefully rather than sprawling across the page as flat paddles.
  // (They no longer physically reach the node.)
  if (width < 640) return { length: 88, thickness: 24 };
  if (width < 1024) return { length: 110, thickness: 28 };
  return { length: 132, thickness: 32 };
}

/**
 * Track the current viewport width so we can swap to a different size bucket
 * on resize. Returns 0 during SSR / before first effect.
 */
function useViewportWidth(): number {
  const [w, setW] = useState<number>(() =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setW(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
}

/**
 * Detect "very short landscape" viewports where tentacles would crowd the
 * tiny strip of usable height. We hide the whole thing in that case.
 */
function useShortLandscape(): boolean {
  const [short, setShort] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(
      "(orientation: landscape) and (max-height: 480px)",
    );
    const update = () => setShort(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return short;
}

/**
 * Internal frame loop that:
 *   - Reads the target element's rect (if any, AND only when on-screen)
 *   - Reads the wrapper's own bounding rect (the tentacle's base)
 *   - Writes both into refs + motion values (no React rerender per frame)
 *   - Triggers a low-frequency state update so dependent React logic
 *     (auto-tuck threshold, rotation) re-evaluates ~every 4th frame.
 *
 * Caller passes the wrapper ref + the active target selector. Tracking is
 * disabled when `selector` is null or when reduced-motion is preferred.
 *
 * Viewport-cull guard (god-level upgrade): if the target element is fully
 * above or below the viewport (with a margin), we drop the target to null
 * so the tentacle idles rather than pointing at nothing.
 */
function useTentacleTracking(opts: {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  selector: string | null;
  anchor: "left" | "right";
  enabled: boolean;
}) {
  const { wrapperRef, selector, anchor, enabled } = opts;

  // Motion values — these are the "hot" channels we want to update per-frame
  // without forcing React rerenders.
  const targetX = useMotionValue<number | null>(null);
  const targetY = useMotionValue<number | null>(null);
  const baseX = useMotionValue<number>(0);
  const baseY = useMotionValue<number>(0);

  // Low-frequency mirror of the same data so React-driven logic (e.g.
  // "should we auto-tuck?") can read consistent values. We throttle to
  // every ~4th frame to stay cheap.
  const [snapshot, setSnapshot] = useState<{
    target: { x: number; y: number } | null;
    base: { x: number; y: number };
    distance: number | null;
  }>({ target: null, base: { x: 0, y: 0 }, distance: null });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setSnapshot({ target: null, base: { x: 0, y: 0 }, distance: null });
      return;
    }

    let rafId = 0;
    let frame = 0;
    // Cache the last published snapshot values so we only setState when
    // something meaningfully changed (~1px granularity).
    let lastPub = {
      hasTarget: false,
      tx: 0,
      ty: 0,
      bx: 0,
      by: 0,
      dist: -1,
    };

    // How far off-screen we still allow before culling the target rect.
    // Generous margin so a target juuust outside the viewport still gets
    // pointed at (encourages the user to scroll into view).
    const OFFSCREEN_MARGIN = 120;

    const tick = () => {
      frame++;
      const wrapper = wrapperRef.current;
      if (wrapper) {
        const r = wrapper.getBoundingClientRect();
        // The tentacle's base is the edge where it's glued to the viewport
        // (anchor === "left" → r.left; "right" → r.right). Vertically we
        // use the wrapper's center.
        const bx = anchor === "left" ? r.left : r.right;
        const by = r.top + r.height / 2;
        baseX.set(bx);
        baseY.set(by);
        lastPub.bx = bx;
        lastPub.by = by;
      }

      if (selector) {
        const el = document.querySelector(selector);
        if (el) {
          const tr = (el as HTMLElement).getBoundingClientRect();
          const vh = window.innerHeight || 1;
          // Viewport-cull: target is off-screen with margin → treat as no
          // target so the tentacle idles rather than pointing at hard math.
          const onScreen =
            tr.bottom >= -OFFSCREEN_MARGIN &&
            tr.top <= vh + OFFSCREEN_MARGIN;
          if (onScreen) {
            const tx = tr.left + tr.width / 2;
            const ty = tr.top + tr.height / 2;
            targetX.set(tx);
            targetY.set(ty);

            // Throttle React state updates to every 4th frame, AND only when
            // the rect changed enough to matter (>=1px).
            if (frame % 4 === 0) {
              const dx = tx - lastPub.bx;
              const dy = ty - lastPub.by;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const moved =
                !lastPub.hasTarget ||
                Math.abs(tx - lastPub.tx) >= 1 ||
                Math.abs(ty - lastPub.ty) >= 1 ||
                Math.abs(dist - lastPub.dist) >= 1;
              if (moved) {
                lastPub = {
                  hasTarget: true,
                  tx,
                  ty,
                  bx: lastPub.bx,
                  by: lastPub.by,
                  dist,
                };
                setSnapshot({
                  target: { x: tx, y: ty },
                  base: { x: lastPub.bx, y: lastPub.by },
                  distance: dist,
                });
              }
            }
          } else {
            // Off-screen → idle.
            targetX.set(null);
            targetY.set(null);
            if (lastPub.hasTarget) {
              lastPub = { ...lastPub, hasTarget: false, dist: -1 };
              setSnapshot({
                target: null,
                base: { x: lastPub.bx, y: lastPub.by },
                distance: null,
              });
            }
          }
        } else {
          targetX.set(null);
          targetY.set(null);
          if (lastPub.hasTarget) {
            lastPub = { ...lastPub, hasTarget: false, dist: -1 };
            setSnapshot({
              target: null,
              base: { x: lastPub.bx, y: lastPub.by },
              distance: null,
            });
          }
        }
      } else {
        // No selector: clear target but keep publishing the base every now
        // and then so consumers can size off it.
        targetX.set(null);
        targetY.set(null);
        if (frame % 12 === 0) {
          setSnapshot((prev) =>
            prev.target == null &&
            Math.abs(prev.base.x - lastPub.bx) < 1 &&
            Math.abs(prev.base.y - lastPub.by) < 1
              ? prev
              : {
                  target: null,
                  base: { x: lastPub.bx, y: lastPub.by },
                  distance: null,
                },
          );
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [anchor, baseX, baseY, enabled, selector, targetX, targetY, wrapperRef]);

  return { targetX, targetY, baseX, baseY, snapshot };
}

export function PathTentacle({
  anchor,
  baseTopPct = 45,
  length: lengthProp,
  thickness: thicknessProp,
  event = { type: "idle" },
  eventTimestamp,
  className,
  curl = "in",
  style,
  targetSelector = null,
  forceReach = false,
  reachToTarget = false,
  maxStretch = 1,
  showTipCursor = false,
  personality,
  muted = false,
  silent = false,
}: PathTentacleProps) {
  const prefersReducedMotion = useReducedMotion();
  const shortLandscape = useShortLandscape();
  const viewportW = useViewportWidth();

  // Wrapper ref — used for measuring our OWN base position so the underlying
  // Tentacle can build the correct base→tip vector in viewport coords.
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // === Smart sizing =========================================================
  // Caller-supplied length/thickness win; otherwise we fall back to a
  // viewport-derived default. Cheap useMemo because viewportW is stable
  // between resizes.
  const smartSize = useMemo(() => {
    const w = viewportW || (typeof window === "undefined" ? 1024 : window.innerWidth);
    return sizeForViewport(w);
  }, [viewportW]);
  const baseLength = lengthProp ?? smartSize.length;
  const baseThickness = thicknessProp ?? smartSize.thickness;

  // === Tracking ============================================================
  const trackingEnabled =
    !prefersReducedMotion && !muted && !shortLandscape && !!targetSelector;
  // We hold onto baseX/baseY motion values to forward the latest base
  // position to Tentacle.basePosition without round-tripping through React
  // state. snapshot is the throttled mirror that React-driven logic reads.
  const { baseX, baseY, snapshot } = useTentacleTracking({
    wrapperRef,
    selector: trackingEnabled ? targetSelector : null,
    anchor,
    enabled: trackingEnabled,
  });

  // === Auto-tuck ===========================================================
  // If the target is within ~100px of the base, the tentacle should shrink
  // and adopt a "shy" pose so the tip doesn't crash into the episode circle.
  // Threshold bumped from 80 → 100 because tentacles are bigger now.
  const TUCK_THRESHOLD_PX = 100;
  const shouldTuck =
    snapshot.distance != null && snapshot.distance < TUCK_THRESHOLD_PX;

  // Length/thickness reduce slightly when tucked.
  const length = shouldTuck ? Math.round(baseLength * 0.55) : baseLength;
  const thickness = shouldTuck
    ? Math.max(20, Math.round(baseThickness * 0.7))
    : baseThickness;

  // === Speech bubble ========================================================
  // Silent tentacles never show bubbles, regardless of incoming events.
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bubbleMessage, setBubbleMessage] = useState<string | null>(null);

  useEffect(() => {
    if (silent || prefersReducedMotion || muted) {
      // Reduced motion is allowed to still pop bubbles per spec ("bubbles
      // still appear"); but we keep the same gate for silent/muted. We need
      // to special-case reduced-motion below to honor that.
      if (silent || muted) {
        setBubbleVisible(false);
        return;
      }
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
      setBubbleVisible(false);
    }
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.type, eventTimestamp, prefersReducedMotion, muted, silent]);

  // === Mood + rotation ======================================================
  // When tucked we want a shy pose; otherwise honor the event.
  const mood: TentacleMood = useMemo(() => {
    if (shouldTuck) return "drooping";
    // Pointer-follow overrides the event-driven mood so the tip can
    // physically extend onto the hovered/clicked item even while the
    // event channel is idle or showing a speech bubble.
    if (forceReach) return "reaching";
    // Idle-with-target stays "idle": the joint solver already bends gently
    // toward the node (bendStrength 0.55) and the calm wobble reads better
    // than the agitated "reaching" oscillation on a resting map.
    return moodForEvent(event);
  }, [event, shouldTuck, forceReach]);

  const trackedTargetY = snapshot.target?.y ?? null;
  const rotate = useMemo(() => {
    if (prefersReducedMotion) return 0;
    // Auto-tuck overrides the aim — pull back to neutral.
    if (shouldTuck) return anchor === "left" ? -8 : 8;
    // When force-reaching, the base follows the target's Y (followTopPct),
    // so the reach is a clean horizontal line — no outer tilt needed.
    // Any rotation here would re-introduce the diagonal misalignment.
    if (forceReach) return 0;
    // If we have a live target (DOM tracking), aim there regardless of
    // event type (as long as nothing transient like react/celebrate is on).
    if (
      targetSelector &&
      trackedTargetY != null &&
      (event.type === "idle" || event.type === "reach")
    ) {
      if (typeof window === "undefined") return 0;
      // The inner joint solver now owns most of the aim (Tentacle.target);
      // this outer tilt is just supporting body language, so keep it small.
      const baseYpx = (baseTopPct / 100) * window.innerHeight;
      const delta = trackedTargetY - baseYpx;
      const raw = Math.max(-7, Math.min(7, (delta / 400) * 7));
      return anchor === "left" ? raw : -raw;
    }
    return rotateForEvent(event, anchor, baseTopPct, trackedTargetY);
  }, [
    anchor,
    baseTopPct,
    event,
    prefersReducedMotion,
    shouldTuck,
    targetSelector,
    trackedTargetY,
    forceReach,
  ]);

  // === Personality default ==================================================
  const effectivePersonality: PathTentaclePersonality =
    personality ?? (anchor === "left" ? "wise" : "playful");

  // === Bubble positioning ==================================================
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

  // === Target prop forwarded to Tentacle ====================================
  // We pass a plain object (current snapshot) rather than the motion value so
  // it works with the current Tentacle signature; Agent B's new Tentacle may
  // opt to read motion values directly via a different prop in a follow-up.
  //
  // Hide entirely on short landscape or when muted.
  if (shortLandscape) return null;

  // The Tentacle's internal solver reads the target + its own base position
  // via getBoundingClientRect() on EVERY animation frame (useAnimationFrame),
  // so there's no stale state. We just pass the target + reach flags and let
  // the solver handle the bend + stretch. No followTopPct, no explicitBase,
  // no reachLength — those all added stale intermediate state that desynced
  // during navigation. The solver naturally extends the tip to the target
  // with maxStretch capping how far it can go.
  const extraTentacleProps: Record<string, unknown> = {
    target: shouldTuck ? null : snapshot.target,
    personality: effectivePersonality,
    segments: 5,
    reachToTarget: shouldTuck ? false : reachToTarget,
    maxStretch: shouldTuck ? 1 : maxStretch,
    showTipCursor: shouldTuck ? false : showTipCursor,
  };

  return (
    <div
      aria-hidden
      ref={wrapperRef}
      className={
        className ??
        "pointer-events-none fixed z-0"
      }
      style={{
        [anchor === "left" ? "left" : "right"]: 0,
        top: `${baseTopPct}%`,
        opacity: muted ? 0 : 1,
        transition: "opacity 220ms ease-out, top 200ms ease-out",
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
          // New props consumed by Agent B's upgraded Tentacle API are
          // forwarded via this loose spread so both the current and the
          // upgraded Tentacle signatures compile cleanly.
          {...extraTentacleProps}
        />

        {/* Speech bubble — absolutely positioned near the tentacle's tip. We
            anchor it to the *unrotated* tip so the outer rotation carries it
            along naturally as the tentacle bends. Silent tentacles never
            render the bubble layer at all. */}
        {!silent && (
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
        )}
      </motion.div>
    </div>
  );
}
