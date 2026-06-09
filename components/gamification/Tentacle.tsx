"use client";

// =============================================================
// <Tentacle /> — GOD-LEVEL multi-segment tapered SVG tentacle that
// AIMS at a screen target AND can PHYSICALLY EXTEND to TOUCH it.
//
// The spine has N+1 control points wired through per-joint Framer-
// Motion springs (base = stiff, tip = whippy) so the body bends like
// a real octopus arm. When `reachToTarget` is enabled and a target
// is in reachable distance, the effective length stretches so the
// tip actually lands on the target — not just leans toward it.
//
// New in god-level:
//   • reachToTarget / maxStretch  — physical extension up to N×length
//   • reachStretch                 — 0..1.5 manual stretch factor
//   • showTipCursor                — pulsing glow at the tip
//   • Pluck reaction on target change (stiffer spring + tip-pulse)
//   • Exponential bend distribution toward tip
//   • Default 5 segments (6 joints)
//   • Subtle base→tip body gradient
//   • Sucker count scales with effective length
//
// The consumer positions the wrapper (e.g. `fixed left-0 top-1/2`)
// and chooses an `anchor` edge; the component handles its own
// internal rotation/flip so the base stays glued to that edge while
// the tip extends outward. All older props (anchor / curl / mood /
// length / thickness / etc.) are still honored for backwards compat.
// =============================================================

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  useAnimationFrame,
  type MotionValue,
  type Transition,
} from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useApp, selectEquipped } from "@/lib/store";
import { resolveSkinPalette, skinCssVars } from "@/lib/cosmetics";
import { TentacleTrail } from "@/components/gamification/cosmetics/TentacleTrail";

// -----------------------------------------------------------------
// Public types
// -----------------------------------------------------------------

export type TentacleAnchor = "left" | "right" | "top" | "bottom";
export type TentacleMood =
  | "idle"
  | "reaching"
  | "celebrating"
  | "drooping"
  | "wiggling";
export type TentaclePersonality = "curious" | "shy" | "playful" | "wise";

export interface TentacleProps {
  /** How far the tentacle extends from its anchor in pixels (default 120). */
  length?: number;
  /** Which screen edge the tentacle emerges from (controls flip / rotation). */
  anchor?: TentacleAnchor;
  /** Curl direction of the tip. */
  curl?: "in" | "out";
  /** Drives the animation personality. */
  mood?: TentacleMood;
  /** Width of the base in pixels (default 48). Tapers to ~14px at the tip. */
  thickness?: number;
  /** Stroke color override; defaults to var(--color-purple-dark). */
  strokeColor?: string;
  /** Fill color override; defaults to var(--color-purple). */
  fillColor?: string;
  /** Optional class names for positioning. */
  className?: string;
  style?: React.CSSProperties;
  /** Show suction cups? Default true. */
  showSuckers?: boolean;
  /** Optional element id for tentacle reach-target targeting. */
  id?: string;

  // ---------------- NEW props (smart aim) ----------------

  /**
   * Screen-coordinate target. The tip curves toward this point. When null /
   * omitted, the tentacle reverts to mood + personality-driven idle motion.
   */
  target?: { x: number; y: number } | null;
  /**
   * The base position in screen coords. Used to compute the local target
   * offset. If not provided, derived from the SVG wrapper's bounding rect
   * at runtime via an internal ref.
   */
  basePosition?: { x: number; y: number };
  /** Personality drives idle motion variation. Default "curious". */
  personality?: TentaclePersonality;
  /** Bend segments along the body. More = smoother. Default 5. */
  segments?: number;

  // ---------------- NEW props (god-level reach) ----------------

  /**
   * Manual stretch factor in [0..1.5]. 0 = rest length; 1 = +length; etc.
   * Combined multiplicatively with mood-driven extension. Default 0.
   */
  reachStretch?: number;
  /**
   * When true and target is set, tentacle physically extends so its tip
   * reaches the target. Length stretches up to maxStretch × length.
   * Default false (backwards compatible).
   */
  reachToTarget?: boolean;
  /** Max stretch factor — default 2.2. */
  maxStretch?: number;
  /** Show a small pulsing glow at the tip when target is set. Default true. */
  showTipCursor?: boolean;

  // ---------------- NEW props (cosmetics: skin + trail) ----------------

  /**
   * Skin cosmetic id. Recolors the tentacle to match the mascot's equipped
   * skin via CSS vars. Semantics:
   *   • undefined + cosmeticsEnabled → read equipped.skin from the store
   *   • explicit value (incl. null) → use it (null = default purple)
   *   • cosmeticsEnabled === false  → ignored (default purple)
   * Explicit `fillColor` / `strokeColor` always win over the skin.
   */
  skinId?: string | null;
  /**
   * Trail cosmetic id. Emits a particle effect from the tip while reaching.
   * Same resolution semantics as `skinId` (reads equipped.trail when
   * undefined + cosmeticsEnabled).
   */
  trailId?: string | null;
  /** Master switch for cosmetics on this tentacle. Default true. */
  cosmeticsEnabled?: boolean;
}

// -----------------------------------------------------------------
// Mood envelopes (whole-body oscillation, layered on top of the new
// smart bend so wave/celebrate still feel familiar).
// -----------------------------------------------------------------

const MOOD_ANIM: Record<
  TentacleMood,
  { rotate: number[]; scale?: number[]; transition: Transition }
> = {
  idle: {
    rotate: [-2, 2, -2],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },
  reaching: {
    rotate: [-3, 4, -2, 3, -3],
    transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
  },
  celebrating: {
    rotate: [-8, 8, -8],
    scale: [1, 1.05, 1],
    transition: { duration: 0.7, repeat: Infinity, ease: "easeInOut" },
  },
  drooping: {
    rotate: [-1, -3, -1],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
  wiggling: {
    rotate: [-6, 6, -6],
    transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" },
  },
};

// -----------------------------------------------------------------
// Personality definitions — driven by joint-index. Each yields an
// (amplitude, periodMs, phase) per joint. Tip wobbles more than
// base; "shy" is quiet, "playful" is wild, etc.
// -----------------------------------------------------------------

interface JointIdleSpec {
  /** Vertical wobble amplitude in px. */
  amp: number;
  /** Cycle length in ms. */
  periodMs: number;
  /** Phase offset in radians so joints don't sync 1:1. */
  phase: number;
  /** Static y bias (e.g. for "shy" droop). */
  bias: number;
}

function personalitySpec(
  personality: TentaclePersonality,
  jointIdx: number, // 0 = base, N = tip
  totalJoints: number,
): JointIdleSpec {
  // Normalized position along the body: 0 at base, 1 at tip.
  const t = totalJoints <= 1 ? 1 : jointIdx / (totalJoints - 1);
  switch (personality) {
    case "shy":
      return {
        amp: 1 + 1.5 * t,
        periodMs: 4200,
        phase: t * Math.PI * 0.5,
        // Sag a bit more toward the tip.
        bias: 3 * t,
      };
    case "playful":
      return {
        amp: 3 + 7 * t, // up to ~10 at tip
        periodMs: 1400 - 250 * t, // tip moves a hair faster
        phase: t * Math.PI * 1.3,
        bias: 0,
      };
    case "wise":
      return {
        amp: 2 + 4 * t,
        periodMs: 3500,
        phase: t * Math.PI * 0.8,
        bias: 0,
      };
    case "curious":
    default:
      // Calm body, tip occasionally lifts.
      return {
        amp: 1.5 + 6.5 * t * t, // ~8 at tip, tiny at base
        periodMs: 2200,
        phase: t * Math.PI * 1.1,
        bias: 0,
      };
  }
}

// -----------------------------------------------------------------
// Spring configs — base stiffer, tip whippier. We instantiate
// `segments + 1` joints; index 0 is the base, index N is the tip.
// -----------------------------------------------------------------

function springConfigFor(jointIdx: number, totalJoints: number) {
  const t = totalJoints <= 1 ? 1 : jointIdx / (totalJoints - 1);
  // Lerp from base (stiff) to tip (whippy).
  // Base: stiffness 320, damping 26. Tip: 180 / 16. Linear blend.
  const stiffness = 320 - (320 - 180) * t;
  const damping = 26 - (26 - 16) * t;
  return { stiffness, damping, mass: 0.6 + 0.4 * t };
}

// -----------------------------------------------------------------
// Geometry helpers
// -----------------------------------------------------------------

function anchorRotation(anchor: TentacleAnchor): number {
  switch (anchor) {
    case "left":
      return 0;
    case "right":
      return 180;
    case "top":
      return 90;
    case "bottom":
      return -90;
  }
}

/**
 * Wrapper transform per anchor. "right" mirrors with scaleX(-1) about the
 * box center so the content stays INSIDE the wrapper box with the base on
 * the box's right edge — a wrapper pinned at `right: 0` puts the base
 * exactly on the viewport edge. (The old rotate(180°) about the left edge
 * threw the whole tentacle outside its own box, leaving it floating
 * mid-page with a visible severed base.)
 */
function wrapperTransform(anchor: TentacleAnchor): {
  transform: string;
  origin: string;
} {
  if (anchor === "right") {
    return { transform: "scaleX(-1)", origin: "50% 50%" };
  }
  return {
    transform: `rotate(${anchorRotation(anchor)}deg)`,
    origin: PIVOT,
  };
}

const PIVOT = "0% 50%";

/**
 * Build a Catmull-Rom-to-Bezier cubic from four spine points. Given P0..P3
 * we draw the segment from P1 to P2 using P0/P3 to derive tangents. Returns
 * the C-command tail "C cx1 cy1, cx2 cy2, x y" (the leading M is added by
 * the caller).
 */
function catmullRomSegment(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  tension = 1, // 1 = classic Catmull-Rom, smaller = tighter
): string {
  const c1x = p1x + ((p2x - p0x) / 6) * tension;
  const c1y = p1y + ((p2y - p0y) / 6) * tension;
  const c2x = p2x - ((p3x - p1x) / 6) * tension;
  const c2y = p2y - ((p3y - p1y) / 6) * tension;
  return `C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(
    2,
  )} ${c2y.toFixed(2)}, ${p2x.toFixed(2)} ${p2y.toFixed(2)}`;
}

/**
 * Distance helper.
 */
function len(dx: number, dy: number): number {
  return Math.hypot(dx, dy) || 1;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export function Tentacle({
  length = 120,
  anchor = "left",
  curl = "in",
  mood = "idle",
  thickness = 48,
  strokeColor: strokeColorProp,
  fillColor: fillColorProp,
  className,
  style,
  showSuckers = true,
  id,
  target = null,
  basePosition,
  personality = "curious",
  segments: segmentsProp = 5,
  reachStretch: reachStretchProp = 0,
  reachToTarget = false,
  maxStretch = 2.2,
  showTipCursor = true,
  skinId,
  trailId,
  cosmeticsEnabled = true,
}: TentacleProps) {
  // ---------------- Cosmetics: resolve skin + trail ----------------
  // We read equipped only when an id is undefined AND cosmetics are enabled.
  // selectEquipped returns a stable reference until equip changes.
  const equipped = useApp(selectEquipped);

  // Skin resolution:
  //   • cosmeticsEnabled false → null (default purple)
  //   • skinId undefined        → equipped.skin
  //   • explicit (incl. null)   → as given
  const resolvedSkinId = !cosmeticsEnabled
    ? null
    : skinId === undefined
      ? equipped.skin
      : skinId;
  const resolvedTrailId = !cosmeticsEnabled
    ? null
    : trailId === undefined
      ? equipped.trail
      : trailId;

  // Palette → CSS vars for the wrapper. When no skin is equipped this resolves
  // to DEFAULT_SKIN_PALETTE (purple), so the look is unchanged.
  const skinPalette = useMemo(
    () => resolveSkinPalette(resolvedSkinId),
    [resolvedSkinId],
  );
  const skinVars = useMemo(() => skinCssVars(skinPalette), [skinPalette]);

  // Effective colors: an explicit prop always wins (celebration tentacles pass
  // hard-coded colors). Otherwise fall back to the mascot CSS vars, which the
  // wrapper sets from the skin (or :root purple when no skin).
  const fillColor = fillColorProp ?? "var(--mascot-fill, var(--color-purple))";
  const strokeColor =
    strokeColorProp ?? "var(--mascot-fill-dark, var(--color-purple-dark))";
  const reactId = useId();
  const uid = useMemo(() => reactId.replace(/[:]/g, ""), [reactId]);
  const bodyGradId = `tent-body-grad-${uid}`;
  const tipGlowGradId = `tent-tip-glow-${uid}`;
  const reducedMotion = useReducedMotion();

  // Clamp segments to a sensible range. Need at least 2 segments for a curve.
  const segments = Math.max(2, Math.min(8, Math.floor(segmentsProp)));
  const jointCount = segments + 1; // include base and tip

  // ---------------- Geometry constants ----------------
  // The viewBox is sized for the MAXIMUM possible extension so that even when
  // we stretch the tentacle to maxStretch × length, the SVG doesn't clip its
  // own tip. We allow `overflow: visible` too as a belt + suspenders.
  const baseW = thickness;
  const tipW = Math.max(8, thickness * 0.3);
  // Root: how far the body continues BEHIND the base (off-screen past the
  // anchor edge) so the arm never shows a severed flat cut, even while the
  // whole-body mood rotation swings it.
  const rootLen = Math.max(20, thickness * 0.6);
  const maxLen = length * Math.max(1, maxStretch);
  const viewH = Math.max(baseW + 96, 160); // generous so the tentacle can bend without clipping
  const midY = viewH / 2;
  const vbHeight = viewH;
  // viewBox width: extend past `maxLen` so curving up/down doesn't clip the tip.
  const vbWidth = maxLen + tipW * 2;

  // Wrapper ref — used to resolve basePosition from getBoundingClientRect()
  // when consumers don't supply it explicitly.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // Track the resolved base position as a plain ref (no React renders).
  const resolvedBaseRef = useRef<{ x: number; y: number } | null>(null);

  // ---------------- Per-joint rest positions ----------------
  // In local "base-at-left" space. Joint 0 sits at (0, midY); joint N at
  // (length, midY). Idle curl shapes a soft S along the way via curlDir.
  // NOTE: these are rest positions at the *nominal* length — extension is
  // handled per-frame by remapping joint x-coords proportionally.
  // The mirrored right anchor flips local +y on screen, so we flip curlDir
  // there to preserve each consumer's intended screen-space curl.
  const curlDir = (curl === "in" ? 1 : -1) * (anchor === "right" ? -1 : 1);

  const restPositions = useMemo(() => {
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < jointCount; i++) {
      const t = jointCount === 1 ? 0 : i / (jointCount - 1);
      // Slight arc-length tuck: the hooked tip pulls back toward the body
      // instead of stretching the silhouette flat.
      const x = length * (t - 0.07 * Math.pow(t, 3));
      // Resting curl: a soft mid-body hump in the curl direction, then a
      // pronounced tip hook the other way — the classic curling-arm pose.
      // Both scale with viewH so thicker tentacles curve proportionally.
      const hump = Math.sin(t * Math.PI) * (viewH * 0.16) * curlDir;
      const tipHook = Math.pow(t, 2.6) * (viewH * 0.26) * curlDir;
      pts.push({ x, y: midY + hump - tipHook });
    }
    return pts;
  }, [jointCount, length, viewH, midY, curlDir]);

  // ---------------- Motion values per joint ----------------
  // We use a top-level array of useMotionValue/useSpring pairs. React's
  // rules-of-hooks require fixed call count, so we always allocate MAX.
  // The extras are simply unused when segments < 8.
  const MAX_JOINTS = 9; // segments up to 8

  const inputs = useRef<{ x: MotionValue<number>[]; y: MotionValue<number>[] } | null>(null);
  const springs = useRef<{ x: MotionValue<number>[]; y: MotionValue<number>[] } | null>(null);

  // Joint 0
  const x0 = useMotionValue(0);
  const y0 = useMotionValue(midY);
  // Joint 1
  const x1 = useMotionValue(0);
  const y1 = useMotionValue(midY);
  // Joint 2
  const x2 = useMotionValue(0);
  const y2 = useMotionValue(midY);
  // Joint 3
  const x3 = useMotionValue(0);
  const y3 = useMotionValue(midY);
  // Joint 4
  const x4 = useMotionValue(0);
  const y4 = useMotionValue(midY);
  // Joint 5
  const x5 = useMotionValue(0);
  const y5 = useMotionValue(midY);
  // Joint 6
  const x6 = useMotionValue(0);
  const y6 = useMotionValue(midY);
  // Joint 7
  const x7 = useMotionValue(0);
  const y7 = useMotionValue(midY);
  // Joint 8
  const x8 = useMotionValue(0);
  const y8 = useMotionValue(midY);

  // Spring per joint. Configs vary base→tip.
  const sx0 = useSpring(x0, springConfigFor(0, MAX_JOINTS));
  const sy0 = useSpring(y0, springConfigFor(0, MAX_JOINTS));
  const sx1 = useSpring(x1, springConfigFor(1, MAX_JOINTS));
  const sy1 = useSpring(y1, springConfigFor(1, MAX_JOINTS));
  const sx2 = useSpring(x2, springConfigFor(2, MAX_JOINTS));
  const sy2 = useSpring(y2, springConfigFor(2, MAX_JOINTS));
  const sx3 = useSpring(x3, springConfigFor(3, MAX_JOINTS));
  const sy3 = useSpring(y3, springConfigFor(3, MAX_JOINTS));
  const sx4 = useSpring(x4, springConfigFor(4, MAX_JOINTS));
  const sy4 = useSpring(y4, springConfigFor(4, MAX_JOINTS));
  const sx5 = useSpring(x5, springConfigFor(5, MAX_JOINTS));
  const sy5 = useSpring(y5, springConfigFor(5, MAX_JOINTS));
  const sx6 = useSpring(x6, springConfigFor(6, MAX_JOINTS));
  const sy6 = useSpring(y6, springConfigFor(6, MAX_JOINTS));
  const sx7 = useSpring(x7, springConfigFor(7, MAX_JOINTS));
  const sy7 = useSpring(y7, springConfigFor(7, MAX_JOINTS));
  const sx8 = useSpring(x8, springConfigFor(8, MAX_JOINTS));
  const sy8 = useSpring(y8, springConfigFor(8, MAX_JOINTS));

  // Bundle them so we can index by joint number cleanly.
  inputs.current = {
    x: [x0, x1, x2, x3, x4, x5, x6, x7, x8],
    y: [y0, y1, y2, y3, y4, y5, y6, y7, y8],
  };
  springs.current = {
    x: [sx0, sx1, sx2, sx3, sx4, sx5, sx6, sx7, sx8],
    y: [sy0, sy1, sy2, sy3, sy4, sy5, sy6, sy7, sy8],
  };

  // Seed initial positions to rest on first mount. Without this the springs
  // would coast in from (0, midY) on the very first frame, which looks like
  // the tentacle is "growing" out of the wall.
  const seededRef = useRef(false);
  if (!seededRef.current) {
    for (let i = 0; i < jointCount; i++) {
      inputs.current.x[i]!.jump(restPositions[i]!.x);
      inputs.current.y[i]!.jump(restPositions[i]!.y);
      springs.current.x[i]!.jump(restPositions[i]!.x);
      springs.current.y[i]!.jump(restPositions[i]!.y);
    }
    seededRef.current = true;
  }

  // ---------------- Pluck reaction on target change ----------------
  // When `target` changes (new target set), temporarily swap the tip-joint
  // spring to a stiffer config so it "snaps" with overshoot. We track a
  // "pluck timestamp" and let useAnimationFrame override the spring config
  // for ~250ms before reverting. We can't actually re-create springs at
  // runtime — but we CAN call `springN.set(...)` more aggressively, OR we
  // can simply nudge the input MV with a microbump for visual emphasis.
  //
  // The cleaner approach (no spring re-creation): we set the input MV to
  // an OVERSHOOT target during the pluck window, then to the real target.
  // The natural spring math will then produce a brief overshoot. We track
  // a `pluckUntilMs` timestamp; pre-pluck behavior is normal.
  const pluckUntilMsRef = useRef<number>(0);
  const tipPulseKey = useRef<number>(0); // increments on each new target
  const [tipPulseTrigger, setTipPulseTrigger] = useState<number>(0);

  const prevTargetRef = useRef<{ x: number; y: number } | null>(target ?? null);
  useEffect(() => {
    const prev = prevTargetRef.current;
    const cur = target ?? null;
    const changed =
      (prev === null) !== (cur === null) ||
      (prev !== null && cur !== null && (prev.x !== cur.x || prev.y !== cur.y));
    if (changed && cur !== null) {
      pluckUntilMsRef.current = performance.now() + 260;
      tipPulseKey.current += 1;
      setTipPulseTrigger(tipPulseKey.current);
    }
    prevTargetRef.current = cur;
  }, [target]);

  // ---------------- Animation loop: drive joint targets ----------------
  // We update the input MotionValues on every animation frame:
  //  • base position: rest
  //  • if target is set: lerp from rest toward a target-derived pose
  //  • if reachToTarget: also stretch the effective spine length to reach
  //  • if mood === "idle" + no target: add personality-based wobble
  //
  // The springs smooth out the changes; reduced-motion users get a direct
  // ease via short tween on the input MV itself (we keep springs but they
  // are critically damped enough that they read as ease).
  useAnimationFrame((tMs) => {
    if (!inputs.current) return;

    // ---- Resolve basePosition once if needed ----
    if (!basePosition && !resolvedBaseRef.current && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      // Anchor-aware "base point": for a left-anchored tentacle the base sits
      // at the left middle of the wrapper; for right at the right middle; etc.
      const r = anchor;
      let bx = rect.left;
      let by = rect.top + rect.height / 2;
      if (r === "right") {
        bx = rect.right;
        by = rect.top + rect.height / 2;
      } else if (r === "top") {
        bx = rect.left + rect.width / 2;
        by = rect.top;
      } else if (r === "bottom") {
        bx = rect.left + rect.width / 2;
        by = rect.bottom;
      }
      resolvedBaseRef.current = { x: bx, y: by };
    }

    const effBase = basePosition ?? resolvedBaseRef.current;

    // ---- Mood-based extension policy ----
    // Determines the cap on stretch and whether wobble is amplified.
    let moodStretchCap = 1.0; // multiplier on `length` (no extension by default)
    let moodWiggleSide = 0; // extra x-wobble amplitude
    let drooping = false;
    if (mood === "reaching" || mood === "celebrating") {
      moodStretchCap = maxStretch;
    } else if (mood === "wiggling") {
      moodStretchCap = Math.min(maxStretch, 1.1);
      moodWiggleSide = 6;
    } else if (mood === "drooping") {
      moodStretchCap = 1.0; // no over-extension
      drooping = true;
    } else if (mood === "idle") {
      // idle: only manual reachStretch applies (no auto-extend even if
      // reachToTarget is set), per spec.
      moodStretchCap = 1.0;
    }

    // ---- Compute the "aim" tip + extension in local (base-at-left) space ----
    let localTip: { x: number; y: number } | null = null;
    let aimDistLocal = 0; // raw distance from base to target (local space)
    if (target && effBase) {
      // Vector from base to target in screen space.
      const dx = target.x - effBase.x;
      const dy = target.y - effBase.y;
      // Map into the tentacle's local frame (body extends rightward).
      // The right anchor is a mirror (scaleX(-1)), not a rotation: local x
      // runs leftward on screen, y is unchanged.
      let lx: number;
      let ly: number;
      if (anchor === "right") {
        lx = -dx;
        ly = dy;
      } else {
        const theta = (-anchorRotation(anchor) * Math.PI) / 180;
        const cs = Math.cos(theta);
        const sn = Math.sin(theta);
        lx = dx * cs - dy * sn;
        ly = dx * sn + dy * cs;
      }
      // If the target is BEHIND the tentacle (lx < 0) we treat the effective
      // distance as the projection (lx capped at 0 for tip x); the tip will
      // still aim toward it visually via ly, but won't reach behind the base.
      const dist = len(lx, ly);
      aimDistLocal = dist;
      localTip = { x: lx, y: ly };
    }

    // ---- Compute the effective spine length this frame ----
    // We combine three sources, then clamp to [length, length * moodStretchCap]:
    //   1. nominal `length`  — always at least this
    //   2. reachStretch prop — manual stretch (linear factor)
    //   3. reachToTarget     — physical stretch to land tip on target
    let effectiveLen = length;
    const manualStretch = Math.max(0, Math.min(1.5, reachStretchProp));
    if (manualStretch > 0) {
      effectiveLen = Math.max(effectiveLen, length * (1 + manualStretch));
    }
    if (reachToTarget && target && effBase) {
      // We want the tip to literally land on the target. The "geometric"
      // length required is aimDistLocal (the local-space distance from base
      // to target). Cap it by maxStretch × length and the mood-driven cap.
      const wantedByReach = Math.max(length, aimDistLocal);
      effectiveLen = Math.max(effectiveLen, wantedByReach);
    }
    const cap = length * moodStretchCap;
    effectiveLen = Math.min(effectiveLen, cap);

    // Whether the target is physically reachable with current extension cap.
    const targetReachable =
      !!target &&
      !!effBase &&
      reachToTarget &&
      aimDistLocal <= cap + 0.5; // tiny epsilon

    // ---- bendStrength: how much the target overrides rest ----
    // mood-aware: idle muffles even if a target is set; reaching/celebrating
    // crank it. Defaults sit in between.
    let bendStrength = 0;
    if (localTip) {
      if (mood === "idle" || mood === "drooping") bendStrength = 0.55;
      else if (mood === "reaching" || mood === "celebrating") bendStrength = 1;
      else bendStrength = 0.85;
    }

    // Active stretch ratio (1.0 = no stretch). Used to taper body width
    // gracefully at extreme extension.
    const stretchRatio = effectiveLen / length;

    // ---- Per-joint target = lerp(rest, aim-pose) + idle perturbation ----
    // Joint distribution along the spine when reaching/extended: EXPONENTIAL
    // toward the tip. We use j(i) = (e^(k*i/N) - 1) / (e^k - 1) with k≈2.4
    // which gives base nearly stationary and tip taking most of the motion.
    const K = 2.4; // exponential curve sharpness — base stays put, tip dominates
    const expDenom = Math.exp(K) - 1;

    for (let i = 0; i < jointCount; i++) {
      const rest = restPositions[i]!;
      // Linear param along the chain (0 = base, 1 = tip).
      const tNorm = jointCount === 1 ? 1 : i / (jointCount - 1);
      // Exponential distribution: dominant motion at tip.
      const tExp = (Math.exp(K * tNorm) - 1) / expDenom;

      // Aim pose: distribute the bend along the body using the exponential
      // weight so the base barely moves and the tip moves most.
      let aimX = rest.x * (effectiveLen / length); // first, stretch rest along x
      let aimY = rest.y;
      if (localTip) {
        // Tip position in local space.
        // If reachToTarget AND target is reachable, the tip x/y is the
        // ACTUAL local-space target — the tip *lands* on the target.
        // Else, we constrain the tip to the effective-length circle and
        // aim toward target (classic "lean toward" behavior).
        let tipLocalX: number;
        let tipLocalY: number;
        if (targetReachable) {
          tipLocalX = localTip.x;
          tipLocalY = midY + localTip.y;
        } else {
          // Lean: aim the tip along the target direction on a circle of
          // radius effectiveLen — but clamp the bend ANGLE off the arm's
          // natural axis. Without this, a target far off-axis (e.g. the
          // celebration mascot, nearly perpendicular to a bottom-edge arm)
          // folds the body into a sideways hairpin.
          const MAX_BEND_RAD = Math.PI / 3; // 60°
          const phi = Math.atan2(localTip.y, localTip.x);
          const phiC = Math.max(-MAX_BEND_RAD, Math.min(MAX_BEND_RAD, phi));
          tipLocalX = Math.cos(phiC) * effectiveLen;
          tipLocalY = midY + Math.sin(phiC) * effectiveLen;
        }

        // The "reach pose" for joint i is rest along x scaled to effectiveLen,
        // blended toward the tip target with the exponential weight.
        const stretchedRestX = rest.x * (effectiveLen / length);
        aimX = stretchedRestX + (tipLocalX - effectiveLen) * tExp;
        aimY = rest.y + (tipLocalY - midY) * tExp;

        // Curl bias on intermediate joints so the body curves outward in
        // the curl direction even when pointing at a target — gives the
        // arm a graceful S rather than a straight diagonal. Fades out at
        // the tip and at high stretch ratios (so an extended arm reads as
        // a clean line, not a wavy noodle).
        if (i > 0 && i < jointCount - 1) {
          const bias = Math.sin(tNorm * Math.PI) * (viewH * 0.05) * curlDir;
          const stretchFade = Math.max(0, 1 - (stretchRatio - 1) * 0.7);
          aimY += bias * (1 - tExp) * stretchFade;
        }
      }

      // Lerp by bendStrength.
      let tgtX = rest.x * (effectiveLen / length) + (aimX - rest.x * (effectiveLen / length)) * bendStrength;
      let tgtY = rest.y + (aimY - rest.y) * bendStrength;

      // Personality idle perturbation — applied when not reduced-motion AND
      // when bendStrength < 1 (we still wobble during gentle aim). We taper
      // the perturbation by (1 - bendStrength) so reaching/celebrating with
      // a target reads as a clean point, not a noisy one.
      if (!reducedMotion && mood !== "drooping") {
        const spec = personalitySpec(personality, i, jointCount);
        const cyc = (tMs / spec.periodMs) * Math.PI * 2 + spec.phase;
        const wobble = Math.sin(cyc) * spec.amp;
        const fade = 1 - bendStrength * 0.85;
        tgtY += wobble * fade + spec.bias;

        // For "playful" + tip, add a small x-wobble too.
        if (personality === "playful" && i === jointCount - 1) {
          tgtX += Math.cos(cyc * 0.8) * spec.amp * 0.4 * fade;
        }
        // Wiggling mood: side-to-side wobble across the whole body.
        if (moodWiggleSide > 0) {
          const sideCyc = (tMs / 500) * Math.PI * 2 + tNorm * Math.PI;
          tgtY += Math.sin(sideCyc) * moodWiggleSide * tExp;
        }
      } else if (reducedMotion) {
        // Reduced motion: apply only the static bias (e.g. shy droop).
        const spec = personalitySpec(personality, i, jointCount);
        tgtY += spec.bias;
      }

      // Drooping mood: sag the tip down a few px (and, if we have a target,
      // dip the tip below the target line by ~12px per spec).
      if (drooping) {
        tgtY += Math.pow(tNorm, 1.5) * (viewH * 0.04);
        if (localTip && i === jointCount - 1) {
          tgtY += 12; // tip dips below the target line
        }
      }

      // ---- Pluck overshoot: nudge the tip toward an OVERSHOOT target
      // during the pluck window so the spring produces a visible snap. ----
      if (i === jointCount - 1 && tMs < pluckUntilMsRef.current && localTip) {
        // Direction from current spine-tip rest toward target.
        const restTipX = rest.x * (effectiveLen / length);
        const dirX = tgtX - restTipX;
        const dirY = tgtY - rest.y;
        const dl = Math.hypot(dirX, dirY) || 1;
        // 10% overshoot along the aim direction, fading over the pluck window.
        const remaining = (pluckUntilMsRef.current - tMs) / 260;
        const overshoot = 0.1 * remaining;
        tgtX += (dirX / dl) * effectiveLen * overshoot * 0.15;
        tgtY += (dirY / dl) * effectiveLen * overshoot * 0.15;
      }

      // Hard safety clamp: no joint target may leave the tentacle's own
      // geometric envelope. Guarantees the body can never smear into a
      // cross-screen ribbon regardless of what the aim math upstream does.
      tgtX = Math.max(-rootLen, Math.min(maxLen * 1.25, tgtX));
      tgtY = Math.max(midY - maxLen * 1.1, Math.min(midY + maxLen * 1.1, tgtY));

      inputs.current.x[i]!.set(tgtX);
      inputs.current.y[i]!.set(tgtY);
    }
  });

  // Width of the body at tNorm ∈ [0, 1]: near-linear taper with a soft ease
  // plus a root flare, so the arm reads organic — beefy shoulder, fine tip.
  const widthAt = (tNorm: number, widthScale: number) => {
    const w = baseW + (tipW - baseW) * (1 - Math.pow(1 - tNorm, 1.35));
    const flare = 1 + 0.12 * Math.pow(1 - tNorm, 5);
    return w * flare * widthScale;
  };

  // ---------------- Body path: derived motion value via useTransform ----------------
  // We compose the closed body path from all spring-smoothed joint values.
  // useTransform with an array of MotionValues recomputes only when any
  // upstream changes (per frame), no React re-render.
  const allSprings: MotionValue<number>[] = useMemo(() => {
    if (!springs.current) return [];
    const arr: MotionValue<number>[] = [];
    for (let i = 0; i < jointCount; i++) {
      arr.push(springs.current.x[i]!);
      arr.push(springs.current.y[i]!);
    }
    return arr;
  }, [jointCount]);

  // Body fill path: closed shape with top edge, tip cap, bottom edge.
  const bodyPath = useTransform(allSprings, (raw) => {
    // useTransform's array overload types each element as `unknown`; we own
    // the upstream values and they are all numbers.
    const vals = raw as number[];
    // vals is [x0, y0, x1, y1, ...]. Decode into spine points.
    const spine: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < jointCount; i++) {
      spine.push({ x: vals[i * 2] ?? 0, y: vals[i * 2 + 1] ?? midY });
    }

    // Effective length from current spine endpoint x (tip-x relative to base).
    const effLen = Math.max(1, spine[jointCount - 1]!.x - spine[0]!.x);
    // Stretch ratio for width tapering — at extreme stretch we thin the body
    // a bit so it doesn't look bloated.
    const stretchRatio = effLen / length;
    const widthScale = 1 / (1 + Math.max(0, stretchRatio - 1) * 0.18);

    // Compute thickness at each spine point (taper from base to tip).
    const widths: number[] = [];
    for (let i = 0; i < jointCount; i++) {
      const tNorm = jointCount === 1 ? 1 : i / (jointCount - 1);
      widths.push(widthAt(tNorm, widthScale));
    }

    // Compute perpendicular offsets at each spine point. Tangent at i is
    // the average of the (i-1 → i) and (i → i+1) directions (forward
    // difference at endpoints). Perpendicular = (-ty, tx) rotated CCW.
    const top: Array<{ x: number; y: number }> = [];
    const bot: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < jointCount; i++) {
      const prev = spine[Math.max(0, i - 1)]!;
      const next = spine[Math.min(jointCount - 1, i + 1)]!;
      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      const tlen = Math.hypot(tx, ty) || 1;
      // Perpendicular pointing "up" (in our coord, y-down). Rotated 90° CCW.
      const nx = -ty / tlen;
      const ny = tx / tlen;
      const halfW = widths[i]! / 2;
      top.push({ x: spine[i]!.x + nx * halfW, y: spine[i]!.y + ny * halfW });
      bot.push({ x: spine[i]!.x - nx * halfW, y: spine[i]!.y - ny * halfW });
    }

    // Root cap: start BEHIND the base with a slight flare so the body
    // continues off-screen past the anchor edge — no visible flat cut.
    const rootHalf = (widths[0]! / 2) * 1.15;
    const baseY = spine[0]!.y;

    // Build top outline with Catmull-Rom segments.
    const parts: string[] = [];
    parts.push(`M ${(-rootLen).toFixed(2)} ${(baseY - rootHalf).toFixed(2)}`);
    parts.push(`L ${top[0]!.x.toFixed(2)} ${top[0]!.y.toFixed(2)}`);
    for (let i = 0; i < jointCount - 1; i++) {
      const p0 = top[Math.max(0, i - 1)]!;
      const p1 = top[i]!;
      const p2 = top[i + 1]!;
      const p3 = top[Math.min(jointCount - 1, i + 2)]!;
      parts.push(
        catmullRomSegment(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y),
      );
    }

    // Tip cap: a small quadratic curve from top-tip → bot-tip going past the
    // spine tip to give the end a rounded mushroom shape.
    const spineTip = spine[jointCount - 1]!;
    const tipFwdX =
      spineTip.x + (spineTip.x - spine[jointCount - 2]!.x) * 0.25;
    const tipFwdY =
      spineTip.y + (spineTip.y - spine[jointCount - 2]!.y) * 0.25;
    parts.push(
      `Q ${tipFwdX.toFixed(2)} ${tipFwdY.toFixed(2)}, ${bot[
        jointCount - 1
      ]!.x.toFixed(2)} ${bot[jointCount - 1]!.y.toFixed(2)}`,
    );

    // Bottom outline back to base — reversed Catmull-Rom.
    for (let i = jointCount - 1; i > 0; i--) {
      const p0 = bot[Math.min(jointCount - 1, i + 1)]!;
      const p1 = bot[i]!;
      const p2 = bot[i - 1]!;
      const p3 = bot[Math.max(0, i - 2)]!;
      parts.push(
        catmullRomSegment(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y),
      );
    }
    // Close through the off-screen root.
    parts.push(`L ${(-rootLen).toFixed(2)} ${(baseY + rootHalf).toFixed(2)}`);
    parts.push("Z");
    return parts.join(" ");
  });

  // Highlight: thin line tracing the top edge for a soft 3D feel.
  const highlightPath = useTransform(allSprings, (raw) => {
    const vals = raw as number[];
    const spine: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < jointCount; i++) {
      spine.push({ x: vals[i * 2] ?? 0, y: vals[i * 2 + 1] ?? midY });
    }
    const effLen = Math.max(1, spine[jointCount - 1]!.x - spine[0]!.x);
    const stretchRatio = effLen / length;
    const widthScale = 1 / (1 + Math.max(0, stretchRatio - 1) * 0.18);
    const top: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < jointCount; i++) {
      const prev = spine[Math.max(0, i - 1)]!;
      const next = spine[Math.min(jointCount - 1, i + 1)]!;
      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      const tlen = Math.hypot(tx, ty) || 1;
      const nx = -ty / tlen;
      const ny = tx / tlen;
      const tNorm = jointCount === 1 ? 1 : i / (jointCount - 1);
      const w = widthAt(tNorm, widthScale);
      // Sit the highlight 2px inside the top edge.
      const half = w / 2 - 2;
      top.push({ x: spine[i]!.x + nx * half, y: spine[i]!.y + ny * half });
    }
    // Start the highlight at the off-screen root so it doesn't pop into
    // view mid-body.
    const parts: string[] = [];
    parts.push(
      `M ${(-rootLen).toFixed(2)} ${(top[0]!.y + 1).toFixed(2)}`,
    );
    parts.push(`L ${top[0]!.x.toFixed(2)} ${(top[0]!.y + 1).toFixed(2)}`);
    for (let i = 0; i < jointCount - 1; i++) {
      const p0 = top[Math.max(0, i - 1)]!;
      const p1 = top[i]!;
      const p2 = top[i + 1]!;
      const p3 = top[Math.min(jointCount - 1, i + 2)]!;
      parts.push(
        catmullRomSegment(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y),
      );
    }
    return parts.join(" ");
  });

  // ---------------- Tip position (for the tip cursor glow) ----------------
  // We track the smoothed tip joint position separately so the tip glow
  // can sit exactly where the body's tip sits. Read from the tip joint's
  // spring outputs directly.
  const tipSpringX = springs.current.x[jointCount - 1]!;
  const tipSpringY = springs.current.y[jointCount - 1]!;

  // ---------------- Suckers ----------------
  // Count scales with effective length so a longer arm gets more suckers.
  // We use a fixed maximum (8) of "slots" but only render the ones we want.
  // T-positions are evenly spaced from 0.18 to 0.94 (avoid the very base
  // and the very tip).
  const suckerCount = useMemo(() => {
    // Scale by Math.round(length / 12), clamped to [4, 8] (we have 8 slots).
    const desired = Math.round(length / 12);
    return Math.max(4, Math.min(8, desired));
  }, [length]);
  const suckerTs = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < suckerCount; i++) {
      const t = 0.18 + (0.94 - 0.18) * (i / Math.max(1, suckerCount - 1));
      out.push(t);
    }
    // Pad with -1 (sentinel = hidden) so length is always 8.
    while (out.length < 8) out.push(-1);
    return out;
  }, [suckerCount]);

  // For each sucker, derive (cx, cy) by sampling the spine at parameter t.
  // The spine is a piece-wise Catmull-Rom; sampling it analytically would be
  // heavy, so we use a cheap proxy: linear interpolation across the joint
  // chain (good enough since we have 4+ joints already smoothing the body).
  // We also offset perpendicular to the spine for the "underside" position.
  const sampleSpine = (
    vals: number[],
    t: number,
    inwardSign: number, // +1 = bottom side, -1 = top side
  ): { cx: number; cy: number; r: number } => {
    if (t < 0) return { cx: -9999, cy: -9999, r: 0 }; // hidden sentinel
    // Decode spine.
    const spine: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < jointCount; i++) {
      spine.push({ x: vals[i * 2] ?? 0, y: vals[i * 2 + 1] ?? midY });
    }
    const effLen = Math.max(1, spine[jointCount - 1]!.x - spine[0]!.x);
    const stretchRatio = effLen / length;
    const widthScale = 1 / (1 + Math.max(0, stretchRatio - 1) * 0.18);
    // Find the two joints that bracket t.
    const segs = jointCount - 1;
    const tt = t * segs;
    const ii = Math.min(segs - 1, Math.floor(tt));
    const frac = tt - ii;
    const a = spine[ii]!;
    const b = spine[ii + 1]!;
    // Linear sample. Slight curve fudge: blend with neighbor for smoothness.
    let cx = a.x + (b.x - a.x) * frac;
    let cy = a.y + (b.y - a.y) * frac;
    // Tangent at the midpoint between a and b.
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const tlen = Math.hypot(tx, ty) || 1;
    const nx = -ty / tlen;
    const ny = tx / tlen;
    const widthHere = widthAt(t, widthScale);
    // Push the sucker inward so it sits ~25% from the rim, on the underside.
    const half = widthHere / 2;
    cx += -inwardSign * nx * half * 0.55;
    cy += -inwardSign * ny * half * 0.55;
    // Taper sucker radius with body width.
    const r = Math.max(1.6, half * 0.26);
    return { cx, cy, r };
  };

  // Suckers sit on the inside of the curl. curlDir already accounts for the
  // mirrored right anchor, so we follow it directly.
  const inwardSign = curlDir;

  // 8 sucker slots. Each sucker is sampled at a fixed t along the spine.
  // useTransform must be called unconditionally — hidden suckers get cx/cy
  // at -9999 (off-screen) and r=0.
  const cx0 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[0]!, inwardSign).cx,
  );
  const cy0 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[0]!, inwardSign).cy,
  );
  const r0 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[0]!, inwardSign).r,
  );
  const cx1 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[1]!, inwardSign).cx,
  );
  const cy1 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[1]!, inwardSign).cy,
  );
  const r1 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[1]!, inwardSign).r,
  );
  const cx2 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[2]!, inwardSign).cx,
  );
  const cy2 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[2]!, inwardSign).cy,
  );
  const r2 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[2]!, inwardSign).r,
  );
  const cx3 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[3]!, inwardSign).cx,
  );
  const cy3 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[3]!, inwardSign).cy,
  );
  const r3 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[3]!, inwardSign).r,
  );
  const cx4 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[4]!, inwardSign).cx,
  );
  const cy4 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[4]!, inwardSign).cy,
  );
  const r4 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[4]!, inwardSign).r,
  );
  const cx5 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[5]!, inwardSign).cx,
  );
  const cy5 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[5]!, inwardSign).cy,
  );
  const r5 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[5]!, inwardSign).r,
  );
  const cx6 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[6]!, inwardSign).cx,
  );
  const cy6 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[6]!, inwardSign).cy,
  );
  const r6 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[6]!, inwardSign).r,
  );
  const cx7 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[7]!, inwardSign).cx,
  );
  const cy7 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[7]!, inwardSign).cy,
  );
  const r7 = useTransform(allSprings, (raw) =>
    sampleSpine(raw as number[], suckerTs[7]!, inwardSign).r,
  );

  // ---------------- Mood whole-body envelope ----------------
  const anim = MOOD_ANIM[mood];
  const droopOffset = mood === "drooping" ? viewH * 0.04 : 0;

  // ---------------- Re-resolve basePosition on scroll / resize ----------------
  // The wrapper's screen position changes when the page scrolls or window
  // resizes. We invalidate the cached base so the next animation frame
  // recomputes it via getBoundingClientRect.
  useEffect(() => {
    if (basePosition) return;
    const invalidate = () => {
      resolvedBaseRef.current = null;
    };
    window.addEventListener("scroll", invalidate, { passive: true });
    window.addEventListener("resize", invalidate);
    return () => {
      window.removeEventListener("scroll", invalidate);
      window.removeEventListener("resize", invalidate);
    };
  }, [basePosition]);

  // ---------------- Tip cursor visibility & "tap" pulse ----------------
  // The cursor is visible only when a target is set AND showTipCursor is true.
  // When the target changes, we play a brief 1 → 1.25 → 1 scale pulse on top
  // of the continuous 0.9 ↔ 1.1 breathing pulse.
  const cursorVisible = !!target && showTipCursor;
  const cursorRadius = Math.max(6, tipW * 0.55);

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        width: vbWidth,
        height: vbHeight,
        transform: wrapperTransform(anchor).transform,
        transformOrigin: wrapperTransform(anchor).origin,
        // Skin CSS vars: recolor the tentacle to match the mascot. When no
        // skin is equipped this is the default purple palette, so the look is
        // identical to before. Spread BEFORE `style` so callers can override.
        ...skinVars,
        ...style,
      }}
      id={id}
    >
      <motion.svg
        viewBox={`${-tipW} 0 ${vbWidth} ${vbHeight}`}
        width={vbWidth}
        height={vbHeight}
        aria-hidden
        style={{
          display: "block",
          overflow: "visible",
          transformOrigin: PIVOT,
          translate: `0 ${droopOffset}px`,
        }}
        animate={
          reducedMotion
            ? undefined
            : {
                rotate: anim.rotate,
                ...(anim.scale ? { scale: anim.scale } : {}),
              }
        }
        transition={reducedMotion ? undefined : anim.transition}
      >
        <defs>
          {/* Subtle base→tip body gradient. Aligned along the body's x-axis
              (spine direction in local space). Keeps the shift to ~8-10%
              luminance so it reads as depth, not chrome. */}
          <linearGradient
            id={bodyGradId}
            x1="0"
            y1="0"
            x2={maxLen}
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={fillColor} />
            <stop
              offset="100%"
              stopColor={`color-mix(in srgb, ${fillColor} 88%, white 12%)`}
            />
          </linearGradient>

          {/* Radial gradient for the pulsing tip cursor. */}
          <radialGradient id={tipGlowGradId} cx="0.5" cy="0.5" r="0.5">
            <stop
              offset="0%"
              stopColor={strokeColor}
              stopOpacity="0.9"
            />
            <stop
              offset="60%"
              stopColor={strokeColor}
              stopOpacity="0.45"
            />
            <stop
              offset="100%"
              stopColor={strokeColor}
              stopOpacity="0"
            />
          </radialGradient>
        </defs>

        {/* Body */}
        <motion.path
          d={bodyPath}
          fill={`url(#${bodyGradId})`}
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Top-edge highlight — tracks the mascot light var so it recolors
            with the equipped skin (falls back to purple when none). */}
        <motion.path
          d={highlightPath}
          fill="none"
          stroke="color-mix(in srgb, var(--mascot-light, var(--color-purple)) 60%, white)"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.55"
        />

        {/* Suction cups — tinted from the effective stroke so they match the
            skin (purple by default). */}
        {showSuckers && (
          <g
            fill={`color-mix(in srgb, ${strokeColor} 80%, black 10%)`}
            stroke={`color-mix(in srgb, ${strokeColor} 80%, black 10%)`}
            strokeWidth="0.5"
          >
            {suckerTs[0]! >= 0 && (
              <motion.circle cx={cx0} cy={cy0} r={r0} />
            )}
            {suckerTs[1]! >= 0 && (
              <motion.circle cx={cx1} cy={cy1} r={r1} />
            )}
            {suckerTs[2]! >= 0 && (
              <motion.circle cx={cx2} cy={cy2} r={r2} />
            )}
            {suckerTs[3]! >= 0 && (
              <motion.circle cx={cx3} cy={cy3} r={r3} />
            )}
            {suckerTs[4]! >= 0 && (
              <motion.circle cx={cx4} cy={cy4} r={r4} />
            )}
            {suckerTs[5]! >= 0 && (
              <motion.circle cx={cx5} cy={cy5} r={r5} />
            )}
            {suckerTs[6]! >= 0 && (
              <motion.circle cx={cx6} cy={cy6} r={r6} />
            )}
            {suckerTs[7]! >= 0 && (
              <motion.circle cx={cx7} cy={cy7} r={r7} />
            )}
          </g>
        )}

        {/* Tip trail — cosmetic particle effect emitted from the tip while
            the tentacle is reaching (target set). Anchored EXACTLY where the
            tip cursor sits: we mirror the cursor's positioning by wrapping the
            trail in a motion.g driven by the same tip springs, then render the
            particles at local origin (0,0). pointer-events:none throughout. */}
        {resolvedTrailId && (
          <motion.g
            style={{
              x: tipSpringX,
              y: tipSpringY,
              pointerEvents: "none",
            }}
          >
            <TentacleTrail
              trailId={resolvedTrailId}
              tipX={0}
              tipY={0}
              active={!!target}
            />
          </motion.g>
        )}

        {/* Tip cursor — small pulsing glow centered on the tip joint.
            Two layered <motion.circle>s: an outer glow (radial gradient)
            and a small solid dot. Both pulse 0.9 ↔ 1.1 over 1.2s, and a
            transient 1 → 1.25 → 1 "tap" pulse plays on each new target. */}
        {cursorVisible && (
          <motion.g
            style={{
              x: tipSpringX,
              y: tipSpringY,
              transformOrigin: "center",
              transformBox: "fill-box",
            }}
          >
            {/* Outer breathing glow */}
            <motion.circle
              cx={0}
              cy={0}
              r={cursorRadius * 1.6}
              fill={`url(#${tipGlowGradId})`}
              animate={
                reducedMotion
                  ? undefined
                  : { scale: [0.9, 1.1, 0.9], opacity: [0.7, 1, 0.7] }
              }
              transition={
                reducedMotion
                  ? undefined
                  : { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
              }
            />
            {/* Transient "tap" pulse — fires on each new target. Uses the
                tipPulseTrigger key to remount and re-play. */}
            <motion.circle
              key={`tap-${tipPulseTrigger}`}
              cx={0}
              cy={0}
              r={cursorRadius * 1.4}
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.5"
              initial={{ scale: 0.4, opacity: 0.9 }}
              animate={
                reducedMotion
                  ? { scale: 1, opacity: 0 }
                  : { scale: [0.4, 1.6], opacity: [0.9, 0] }
              }
              transition={{ duration: 0.55, ease: "easeOut" }}
            />
            {/* Inner solid dot */}
            <motion.circle
              cx={0}
              cy={0}
              r={cursorRadius * 0.45}
              fill={strokeColor}
              animate={
                reducedMotion
                  ? undefined
                  : { scale: [0.9, 1.1, 0.9] }
              }
              transition={
                reducedMotion
                  ? undefined
                  : { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
              }
            />
            {/* Tap-arrival pulse on the dot itself */}
            <motion.circle
              key={`tap-dot-${tipPulseTrigger}`}
              cx={0}
              cy={0}
              r={cursorRadius * 0.45}
              fill={strokeColor}
              initial={{ scale: 1 }}
              animate={
                reducedMotion ? { scale: 1 } : { scale: [1, 1.25, 1] }
              }
              transition={{ duration: 0.35, ease: "easeOut" }}
              opacity={0.6}
            />
          </motion.g>
        )}
      </motion.svg>
    </div>
  );
}
