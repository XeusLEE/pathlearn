"use client";

// =============================================================
// <Mascot /> — Pathlearn's purple octopus mascot.
//
// Inline-SVG character that ships across the app: path map header,
// level-up modal, episode-complete screen, etc. Subtle continuous
// bob keeps it feeling alive, plus a blink every 4-6s so it never
// reads as static. Six mood variants drive expressions, tentacle
// pose, and optional accessories (sparkles, Zzz, "?", etc.).
//
// CELEBRATE / LEVEL_UP enhancements:
//  • The 5 visible body tentacles spring-wave in a sequenced "Mexican
//    wave" pattern (left → right → left) when mood is `celebrate` or
//    `level_up`, so the whole creature reads as ALIVE — not a static
//    SVG.
//  • 6 small sparkle dots orbit the body during celebration with
//    pulsing opacity. Inline SVG, no extra DOM nodes.
//  • `level_up` mood adds STAR-shaped eyes (replacing the closed
//    happy-eyes used by `celebrate`).
//  • Reduced-motion: tentacles stay at rest, sparkles stay static at
//    50% opacity, bob disabled.
// =============================================================

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useAnimationFrame,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useApp, selectEquipped } from "@/lib/store";
import { resolveSkinPalette, skinCssVars } from "@/lib/cosmetics";
import { MascotHat } from "@/components/gamification/cosmetics/MascotHat";
import { MascotAura } from "@/components/gamification/cosmetics/MascotAura";

export type MascotMood =
  | "happy"
  | "celebrate"
  | "sleeping"
  | "wave"
  | "thinking"
  | "worried"
  /** Like `celebrate` but with star-shaped eyes. */
  | "level_up";

export interface MascotProps {
  /** Pixel size of the mascot (the backdrop bubble matches when shown). */
  size?: number;
  mood?: MascotMood;
  /** When false, disables the continuous bob animation. */
  bob?: boolean;
  /** When false, hides the soft purple radial backdrop. Default true. */
  backdrop?: boolean;
  className?: string;
  /**
   * Hat cosmetic override.
   *  • `undefined` (+ cosmeticsEnabled) → read the equipped hat from the store.
   *  • explicit value (incl. `null`) → force that hat (null = bare head).
   */
  hatId?: string | null;
  /** Skin cosmetic override. Same undefined/explicit semantics as `hatId`. */
  skinId?: string | null;
  /** Aura cosmetic override. Same undefined/explicit semantics as `hatId`. */
  auraId?: string | null;
  /** When false, no cosmetics render regardless of overrides/equipped. Default true. */
  cosmeticsEnabled?: boolean;
}

// -----------------------------------------------------------------
// Per-tentacle wave choreography.
//
// The 5 visible body tentacles are arranged left-to-right around the
// underside of the octopus:
//   index 0 = outer-left   (x ≈ 30)
//   index 1 = inner-left   (x ≈ 44)
//   index 2 = center-front (x ≈ 60)
//   index 3 = inner-right  (x ≈ 76)
//   index 4 = outer-right  (x ≈ 90)
//
// During celebrate/level_up, each tentacle raises and lowers in a
// staggered cycle. Phase increases left-to-right so it reads as a
// Mexican wave. We drive a single motion value per tentacle ("lift",
// 0..1) and shape its rest/raised SVG path inside useTransform.
// -----------------------------------------------------------------

interface BodyTentacleRig {
  /** Spring-smoothed lift amount, 0..1. */
  lift: MotionValue<number>;
  /** Phase offset for the wave cycle, in radians. */
  phase: number;
}

/**
 * Stagger between adjacent body tentacles in ms — converted to a phase
 * offset in the rAF loop. A larger value spreads the wave further apart.
 */
const WAVE_STAGGER_MS = 110;
/**
 * Period of the wave cycle for one tentacle, in ms.
 */
const WAVE_PERIOD_MS = 1200;

interface OctoSvgProps {
  mood: MascotMood;
  /** When true, eyes render as blink lines (used for randomized blink). */
  blinking: boolean;
  /** Stable id prefix so multiple Mascots on a page don't clash. */
  uid: string;
  /** Spring-smoothed lift values, one per body tentacle (always length 5). */
  tentacleLifts: MotionValue<number>[];
  /** When true, no animation — render rest poses. */
  reducedMotion: boolean;
}

/**
 * Inline SVG purple octopus. All colors pull from CSS variables so the
 * mascot stays consistent if the brand palette shifts. The viewBox is
 * intentionally larger than the body so accessories (sparkles, Zzz,
 * raised tentacles) can sit outside without clipping.
 */
function OctoSvg({
  mood,
  blinking,
  uid,
  tentacleLifts,
  reducedMotion,
}: OctoSvgProps) {
  // Mood-derived flags.
  const isCelebrate = mood === "celebrate" || mood === "level_up";
  const eyesClosedSleep = mood === "sleeping";
  // For `level_up` we render star eyes (NOT closed), so don't force-close.
  const eyesClosedCelebrate = mood === "celebrate";
  const eyesClosed = blinking || eyesClosedSleep || eyesClosedCelebrate;
  const showStarEyes = mood === "level_up" && !blinking;
  const showZzz = mood === "sleeping";
  const showSparkles = isCelebrate;
  const showQuestion = mood === "thinking";
  const tiltedHead = mood === "thinking";
  // Idle micro-motion: a gentle pupil "look-around" for the relaxed moods so
  // the face never reads as frozen. Skipped for thinking (fixed up-left gaze),
  // worried (anxious), and any closed/star-eye state.
  const idleEyes = (mood === "happy" || mood === "wave") && !reducedMotion;
  // Mouth variants per mood.
  const mouthVariant: "smile" | "open-smile" | "dot" | "o" = isCelebrate
    ? "open-smile"
    : mood === "happy" || mood === "wave"
    ? "smile"
    : mood === "worried"
    ? "o"
    : "dot";

  const bodyGradId = `octo-body-${uid}`;
  const backdropGradId = `octo-backdrop-${uid}`;
  void backdropGradId; // reserved for future use; eliminates unused-var TS warning

  return (
    <svg
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      aria-hidden
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        {/* Body gradient. Top → bottom uses the skin's main fill into its dark
            shade, with an optional second fill (--mascot-fill-2, gradient skins
            like galaxy/sunset) blended in the middle. The :root fallbacks keep
            the default purple look when no skin is equipped. */}
        <linearGradient id={bodyGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--mascot-fill)" />
          <stop offset="55%" stopColor="var(--mascot-fill-2, var(--mascot-fill))" />
          <stop offset="100%" stopColor="var(--mascot-fill-dark)" />
        </linearGradient>
      </defs>

      {/* The octopus group — tilts on "thinking". */}
      <g
        transform={tiltedHead ? "rotate(-6 60 60)" : undefined}
        style={{ transformOrigin: "60px 60px" }}
      >
        {/* ---------- Tentacles (back layer) ----------
            5 wave-rigged body tentacles, ordered L→R: outer-L, inner-L,
            center, inner-R, outer-R. During celebrate, they raise/lower
            in a sequenced wave; otherwise they sit in the mood-specific
            rest pose. */}

        {/* 0 — Outer left tentacle */}
        <BodyTentacle
          mood={mood}
          lift={tentacleLifts[0]!}
          reducedMotion={reducedMotion}
          variant="outer-left"
        />

        {/* 4 — Outer right tentacle (rendered next to outer-left so paint
            order doesn't matter for layered tentacles) */}
        <BodyTentacle
          mood={mood}
          lift={tentacleLifts[4]!}
          reducedMotion={reducedMotion}
          variant="outer-right"
        />

        {/* 1 — Inner left tentacle */}
        <BodyTentacle
          mood={mood}
          lift={tentacleLifts[1]!}
          reducedMotion={reducedMotion}
          variant="inner-left"
        />

        {/* 3 — Inner right tentacle */}
        <BodyTentacle
          mood={mood}
          lift={tentacleLifts[3]!}
          reducedMotion={reducedMotion}
          variant="inner-right"
        />

        {/* 2 — Center-front tentacle (small, peeks below body) */}
        <BodyTentacle
          mood={mood}
          lift={tentacleLifts[2]!}
          reducedMotion={reducedMotion}
          variant="center"
        />

        {/* Suction cup hints on outer tentacles */}
        <g fill="var(--mascot-fill-dark)" opacity="0.85">
          {!isCelebrate && mood !== "wave" && (
            <>
              <circle cx="22" cy="86" r="1.6" />
              <circle cx="17" cy="93" r="1.6" />
              <circle cx="98" cy="86" r="1.6" />
              <circle cx="103" cy="93" r="1.6" />
            </>
          )}
          <circle cx="44" cy="94" r="1.4" />
          <circle cx="42" cy="100" r="1.4" />
          <circle cx="76" cy="94" r="1.4" />
          <circle cx="78" cy="100" r="1.4" />
        </g>

        {/* ---------- Body (dome) ---------- */}
        {/* Outline */}
        <path
          d="M60 22
             C 82 22, 96 38, 96 60
             C 96 74, 88 84, 76 86
             L 44 86
             C 32 84, 24 74, 24 60
             C 24 38, 38 22, 60 22 Z"
          fill={`url(#${bodyGradId})`}
          stroke="var(--mascot-fill-dark)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Inner gloss highlight */}
        <ellipse
          cx="46"
          cy="38"
          rx="14"
          ry="8"
          fill="rgba(255,255,255,0.28)"
        />
        {/* Subtle belly band lighter tint */}
        <ellipse
          cx="60"
          cy="72"
          rx="20"
          ry="10"
          fill="rgba(255,255,255,0.08)"
        />

        {/* ---------- Cheeks (blush) ----------
            Soft rounded blush that grows brighter + larger on celebrate /
            level_up so a big reaction reads as a flushed, delighted face. */}
        {(() => {
          const blushFill = isCelebrate
            ? "rgba(255, 122, 138, 0.55)"
            : "rgba(255, 167, 167, 0.42)";
          const rx = isCelebrate ? 5.4 : 4.4;
          const ry = isCelebrate ? 3.4 : 2.8;
          const cy = mood === "worried" ? 62 : 64;
          return (
            <>
              <ellipse cx="40" cy={cy} rx={rx} ry={ry} fill={blushFill} />
              <ellipse cx="80" cy={cy} rx={rx} ry={ry} fill={blushFill} />
            </>
          );
        })()}

        {/* ---------- Eyebrows (worried only) ---------- */}
        {mood === "worried" && (
          <g
            stroke="var(--mascot-fill-dark)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M40 43 Q46 41 50 44" />
            <path d="M80 43 Q74 41 70 44" />
          </g>
        )}

        {/* ---------- Eyes ---------- */}
        {!eyesClosed && !showStarEyes && (
          <>
            {/* Whites */}
            <circle
              cx="48"
              cy={mood === "worried" ? 53 : 52}
              r={mood === "worried" ? 8.5 : 7.5}
              fill="#ffffff"
              stroke="var(--mascot-fill-dark)"
              strokeWidth="1"
            />
            <circle
              cx="72"
              cy={mood === "worried" ? 53 : 52}
              r={mood === "worried" ? 8.5 : 7.5}
              fill="#ffffff"
              stroke="var(--mascot-fill-dark)"
              strokeWidth="1"
            />
            {/* Pupils + catchlights drift together as one rig. The idle
                look-around (happy/wave) is a tiny x/y wander; static otherwise. */}
            <motion.g
              animate={
                idleEyes
                  ? { x: [0, 1.4, 0, -1.4, 0], y: [0, -0.6, 0.4, -0.6, 0] }
                  : undefined
              }
              transition={
                idleEyes
                  ? { duration: 5.5, repeat: Infinity, ease: "easeInOut" }
                  : undefined
              }
            >
              {/* Pupils — slightly toward center for cuteness, up-left for thinking */}
              <circle
                cx={mood === "thinking" ? 46 : 49}
                cy={mood === "thinking" ? 50 : 53}
                r="3.4"
                fill="#3a1f5e"
              />
              <circle
                cx={mood === "thinking" ? 70 : 71}
                cy={mood === "thinking" ? 50 : 53}
                r="3.4"
                fill="#3a1f5e"
              />
              {/* Catchlights */}
              <circle
                cx={mood === "thinking" ? 47.5 : 50.5}
                cy={mood === "thinking" ? 48.8 : 51.6}
                r="1"
                fill="#ffffff"
              />
              <circle
                cx={mood === "thinking" ? 71.5 : 72.5}
                cy={mood === "thinking" ? 48.8 : 51.6}
                r="1"
                fill="#ffffff"
              />
            </motion.g>
          </>
        )}

        {/* Star eyes for level_up */}
        {showStarEyes && (
          <g fill="var(--color-xp)" stroke="var(--color-xp-dark, var(--mascot-fill-dark))" strokeWidth="0.8" strokeLinejoin="round">
            {/* Left star eye */}
            <motion.path
              d="M48 45 L50 51 L56 52 L51 56 L52 62 L48 58.6 L44 62 L45 56 L40 52 L46 51 Z"
              animate={
                reducedMotion
                  ? undefined
                  : { scale: [0.95, 1.08, 0.95], rotate: [0, 8, 0] }
              }
              transition={
                reducedMotion
                  ? undefined
                  : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
              }
              style={{ transformOrigin: "48px 53.5px" }}
            />
            {/* Right star eye */}
            <motion.path
              d="M72 45 L74 51 L80 52 L75 56 L76 62 L72 58.6 L68 62 L69 56 L64 52 L70 51 Z"
              animate={
                reducedMotion
                  ? undefined
                  : { scale: [1.08, 0.95, 1.08], rotate: [0, -8, 0] }
              }
              transition={
                reducedMotion
                  ? undefined
                  : { duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 0.15 }
              }
              style={{ transformOrigin: "72px 53.5px" }}
            />
          </g>
        )}

        {eyesClosed && (
          <>
            {/* Curved lines — celebrate/blink curve up (happy), sleeping curves down */}
            {eyesClosedSleep ? (
              <>
                <path
                  d="M42 53 Q48 58 54 53"
                  stroke="var(--mascot-fill-dark)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M66 53 Q72 58 78 53"
                  stroke="var(--mascot-fill-dark)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </>
            ) : eyesClosedCelebrate ? (
              // "X" scrunched happy eyes for celebrate
              <g
                stroke="var(--mascot-fill-dark)"
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              >
                <path d="M43 49 L53 57" />
                <path d="M53 49 L43 57" />
                <path d="M67 49 L77 57" />
                <path d="M77 49 L67 57" />
              </g>
            ) : (
              <>
                <path
                  d="M42 53 Q48 48 54 53"
                  stroke="var(--mascot-fill-dark)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M66 53 Q72 48 78 53"
                  stroke="var(--mascot-fill-dark)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </>
            )}
          </>
        )}

        {/* ---------- Mouth ---------- */}
        {mouthVariant === "smile" && (
          <path
            d="M54 68 Q60 73 66 68"
            stroke="var(--mascot-fill-dark)"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
        )}
        {mouthVariant === "open-smile" && (
          <g>
            {/* Big open joyful grin */}
            <path
              d="M50 66 Q60 80 70 66 Q60 71 50 66 Z"
              fill="var(--mascot-fill-dark)"
              stroke="var(--mascot-fill-dark)"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            {/* Little tongue for extra cheer */}
            <path
              d="M55 71 Q60 77 65 71 Q60 73 55 71 Z"
              fill="#fb7185"
              opacity="0.92"
            />
          </g>
        )}
        {mouthVariant === "dot" && (
          <circle cx="60" cy="69" r="1.4" fill="var(--mascot-fill-dark)" />
        )}
        {mouthVariant === "o" && (
          <ellipse
            cx="60"
            cy="69"
            rx="2.2"
            ry="2.8"
            fill="var(--mascot-fill-dark)"
          />
        )}
      </g>

      {/* ---------- Accessories above (not tilted with head) ---------- */}
      {/* Sparkles for celebrate / level_up — three large featured sparkles. */}
      {showSparkles && (
        <g fill="var(--color-xp)">
          <motion.path
            d="M22 24 L24 28 L28 29 L24.5 31 L25 35 L22 32.6 L19 35 L19.5 31 L16 29 L20 28 Z"
            animate={
              reducedMotion
                ? undefined
                : { opacity: [0.5, 1, 0.5], scale: [0.9, 1.05, 0.9] }
            }
            transition={
              reducedMotion
                ? undefined
                : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
            }
            style={{ transformOrigin: "22px 30px" }}
          />
          <motion.path
            d="M98 28 L99.6 31 L103 32 L100 34 L100.6 37 L98 35 L95.4 37 L96 34 L93 32 L96.4 31 Z"
            animate={
              reducedMotion
                ? undefined
                : { opacity: [1, 0.5, 1], scale: [1.05, 0.92, 1.05] }
            }
            transition={
              reducedMotion
                ? undefined
                : {
                    duration: 1.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.2,
                  }
            }
            style={{ transformOrigin: "98px 33px" }}
          />
          <motion.path
            d="M60 8 L61.6 12 L66 13 L62.5 15 L63 19 L60 16.8 L57 19 L57.5 15 L54 13 L58.4 12 Z"
            animate={
              reducedMotion
                ? undefined
                : { opacity: [0.6, 1, 0.6], scale: [0.95, 1.08, 0.95] }
            }
            transition={
              reducedMotion
                ? undefined
                : {
                    duration: 1.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.5,
                  }
            }
            style={{ transformOrigin: "60px 14px" }}
          />

          {/* Orbiting sparkle particles — 6 small dots that travel a slow
              elliptical loop around the body. Each is offset in time so the
              ring is fully populated. Reduced motion: opacity stays at 0.5
              and no orbit motion. */}
          <OrbitParticles reducedMotion={reducedMotion} />
        </g>
      )}

      {/* Zzz for sleeping */}
      {showZzz && (
        <g
          fill="none"
          stroke="var(--mascot-fill-dark)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <motion.path
            d="M82 18 L92 18 L82 28 L92 28"
            animate={{ opacity: [0.4, 1, 0.4], y: [0, -2, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M96 8 L104 8 L96 16 L104 16"
            animate={{ opacity: [0.4, 1, 0.4], y: [0, -3, 0] }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.6,
            }}
          />
        </g>
      )}

      {/* Question mark for thinking */}
      {showQuestion && (
        <motion.g
          fill="var(--mascot-fill-dark)"
          animate={{ opacity: [0.6, 1, 0.6], y: [0, -2, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M88 18 q0 -8 7 -8 q7 0 7 7 q0 4 -4 6 q-3 1 -3 4 l0 2 l-4 0 l0 -3 q0 -3 3 -5 q3 -1 3 -4 q0 -3 -3 -3 q-3 0 -3 4 z" />
          <circle cx="93.5" cy="32" r="1.8" />
        </motion.g>
      )}
    </svg>
  );
}

// -----------------------------------------------------------------
// <BodyTentacle /> — a single rigged body tentacle that morphs between
// a mood-specific rest path and a "raised" path based on a 0..1 lift
// motion value. Rendered as two stacked SVG paths (dark outline + lit
// inner stroke) so the existing layered look is preserved.
// -----------------------------------------------------------------

interface BodyTentacleProps {
  mood: MascotMood;
  lift: MotionValue<number>;
  reducedMotion: boolean;
  variant: "outer-left" | "inner-left" | "center" | "inner-right" | "outer-right";
}

function BodyTentacle({ mood, lift, reducedMotion, variant }: BodyTentacleProps) {
  // Resolve the (rest, raised) path pair for the (variant, mood) combo.
  // For celebrate/level_up moods we interpolate between a low rest pose and
  // the original raised "V" pose. For all other moods we honor the existing
  // static paths and ignore `lift`.
  const isCelebrate = mood === "celebrate" || mood === "level_up";

  // Existing static paths (preserve the original look for non-celebrate moods).
  const staticPath = useMemo(() => {
    switch (variant) {
      case "outer-left":
        return mood === "wave"
          ? "M32 78 Q14 62 22 38 Q26 28 18 22"
          : mood === "sleeping" || mood === "worried"
          ? "M30 80 Q18 90 12 100"
          : "M30 78 Q20 86 16 96";
      case "outer-right":
        return mood === "thinking"
          ? "M88 80 Q98 70 78 64"
          : mood === "sleeping" || mood === "worried"
          ? "M90 80 Q102 90 108 100"
          : "M90 78 Q100 86 104 96";
      case "inner-left":
        return mood === "sleeping"
          ? "M44 84 Q40 96 36 104"
          : mood === "worried"
          ? "M44 84 Q40 96 38 104"
          : "M44 84 Q42 96 46 104";
      case "inner-right":
        return mood === "sleeping"
          ? "M76 84 Q80 96 84 104"
          : mood === "worried"
          ? "M76 84 Q80 96 82 104"
          : "M76 84 Q78 96 74 104";
      case "center":
      default:
        return "M60 90 Q58 100 60 108";
    }
  }, [mood, variant]);

  // Rest + raised endpoints used when celebrating. We linearly interpolate
  // each endpoint by `lift` (0 = rest, 1 = raised).
  // Format per endpoint: [bx, by, cx, cy, ex, ey] for a quadratic, OR
  // [bx, by, c1x, c1y, c2x, c2y, ex, ey] for cubic. We keep them parallel
  // so interpolation is simple.
  const wavePoses = useMemo(() => {
    // start (base) is shared, but we still tween everything for simplicity.
    switch (variant) {
      case "outer-left":
        // rest: "M30 78 Q20 86 16 96" (drooping)
        // raised: "M30 78 Q14 64 18 38" (wave up)
        return {
          rest: { bx: 30, by: 78, cx: 20, cy: 86, ex: 16, ey: 96 },
          raised: { bx: 30, by: 78, cx: 14, cy: 64, ex: 18, ey: 38 },
        };
      case "outer-right":
        return {
          rest: { bx: 90, by: 78, cx: 100, cy: 86, ex: 104, ey: 96 },
          raised: { bx: 90, by: 78, cx: 106, cy: 64, ex: 102, ey: 38 },
        };
      case "inner-left":
        return {
          rest: { bx: 44, by: 84, cx: 42, cy: 96, ex: 46, ey: 104 },
          raised: { bx: 44, by: 84, cx: 36, cy: 70, ex: 40, ey: 56 },
        };
      case "inner-right":
        return {
          rest: { bx: 76, by: 84, cx: 78, cy: 96, ex: 74, ey: 104 },
          raised: { bx: 76, by: 84, cx: 84, cy: 70, ex: 80, ey: 56 },
        };
      case "center":
      default:
        return {
          rest: { bx: 60, by: 90, cx: 58, cy: 100, ex: 60, ey: 108 },
          raised: { bx: 60, by: 90, cx: 62, cy: 80, ex: 60, ey: 66 },
        };
    }
  }, [variant]);

  // Derived motion value: builds the path string from the current lift.
  const d = useTransform(lift, (k: number) => {
    if (!isCelebrate || reducedMotion) return staticPath;
    const { rest, raised } = wavePoses;
    const lerp = (a: number, b: number) => a + (b - a) * k;
    const bx = lerp(rest.bx, raised.bx);
    const by = lerp(rest.by, raised.by);
    const cx = lerp(rest.cx, raised.cx);
    const cy = lerp(rest.cy, raised.cy);
    const ex = lerp(rest.ex, raised.ex);
    const ey = lerp(rest.ey, raised.ey);
    return `M${bx} ${by} Q${cx} ${cy} ${ex} ${ey}`;
  });

  // Variant-driven stroke widths to match the original 9/8/7 + 6/5/4 pairs.
  let darkW = 9;
  let liteW = 6;
  if (variant === "inner-left" || variant === "inner-right") {
    darkW = 8;
    liteW = 5;
  } else if (variant === "center") {
    darkW = 7;
    liteW = 4;
  }

  return (
    <>
      <motion.path
        d={d}
        fill="none"
        stroke="var(--mascot-fill-dark)"
        strokeWidth={darkW}
        strokeLinecap="round"
        opacity="0.95"
      />
      <motion.path
        d={d}
        fill="none"
        stroke="var(--mascot-fill)"
        strokeWidth={liteW}
        strokeLinecap="round"
      />
    </>
  );
}

// -----------------------------------------------------------------
// <OrbitParticles /> — 6 small sparkle dots that orbit the mascot's
// body during celebrate. Inline as SVG so they sit inside the same
// 120×120 viewBox; each travels a slow ellipse and pulses opacity.
// -----------------------------------------------------------------

interface OrbitParticlesProps {
  reducedMotion: boolean;
}

function OrbitParticles({ reducedMotion }: OrbitParticlesProps) {
  // Six dots, evenly spaced around a 60-deg phase offset, on an
  // ellipse around (60, 60) with rx=44, ry=38. Each one runs the
  // same 4s loop but with a per-particle delay to pre-distribute them.
  const dots = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5].map((i) => {
        const phase = (i / 6) * Math.PI * 2;
        return {
          phase,
          delay: (i / 6) * 4, // seconds (cycle = 4s)
        };
      }),
    [],
  );

  if (reducedMotion) {
    // Static placement: render dots at their phase=0 positions with fixed
    // 0.5 opacity — no orbit, no pulse.
    return (
      <>
        {dots.map((d, i) => {
          const cx = 60 + 44 * Math.cos(d.phase);
          const cy = 60 + 38 * Math.sin(d.phase);
          return (
            <circle key={i} cx={cx} cy={cy} r={1.4} opacity={0.5} />
          );
        })}
      </>
    );
  }

  return (
    <>
      {dots.map((d, i) => (
        <OrbitDot key={i} phase={d.phase} delay={d.delay} />
      ))}
    </>
  );
}

interface OrbitDotProps {
  phase: number; // rad
  delay: number; // seconds
}

function OrbitDot({ phase, delay }: OrbitDotProps) {
  // We animate the dot along a closed ellipse using a parametric keyframe
  // chain on cx/cy. 8 samples is enough for the eye to read it as smooth.
  const samples = useMemo(() => {
    const n = 8;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 2 + phase;
      xs.push(+(60 + 44 * Math.cos(t)).toFixed(2));
      ys.push(+(60 + 38 * Math.sin(t)).toFixed(2));
    }
    return { xs, ys };
  }, [phase]);

  return (
    <motion.circle
      r={1.5}
      animate={{
        cx: samples.xs,
        cy: samples.ys,
        opacity: [0.3, 0.95, 0.3],
      }}
      transition={{
        cx: {
          duration: 4,
          repeat: Infinity,
          ease: "linear",
          delay: -delay, // negative delay starts mid-cycle for variety
        },
        cy: {
          duration: 4,
          repeat: Infinity,
          ease: "linear",
          delay: -delay,
        },
        opacity: {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: -delay / 2,
        },
      }}
    />
  );
}

// -----------------------------------------------------------------
// <Mascot /> — public component.
// -----------------------------------------------------------------

export function Mascot({
  size = 96,
  mood = "happy",
  bob = true,
  backdrop = true,
  className,
  hatId,
  skinId,
  auraId,
  cosmeticsEnabled = true,
}: MascotProps) {
  const [blinking, setBlinking] = useState(false);
  const reactId = useId();
  const uid = useMemo(() => reactId.replace(/[:]/g, ""), [reactId]);
  const reducedMotion = !!useReducedMotion();
  const isCelebrate = mood === "celebrate" || mood === "level_up";

  // -------- Resolve cosmetics --------
  // For each slot: an explicit prop (including `null`) always wins; an
  // `undefined` prop falls back to the store's equipped value (only when
  // cosmetics are enabled). With cosmetics disabled, nothing renders and the
  // skin resolves to the default purple palette.
  const equipped = useApp(selectEquipped);
  const resolvedHatId = !cosmeticsEnabled
    ? null
    : hatId !== undefined
    ? hatId
    : equipped.hat;
  const resolvedSkinId = !cosmeticsEnabled
    ? null
    : skinId !== undefined
    ? skinId
    : equipped.skin;
  const resolvedAuraId = !cosmeticsEnabled
    ? null
    : auraId !== undefined
    ? auraId
    : equipped.aura;

  // Skin → CSS vars spread on the outer wrapper so the whole SVG + backdrop
  // recolor. resolveSkinPalette falls back to the default purple palette for
  // null/unknown ids, so the classic look is preserved.
  const skinVars = useMemo(
    () => skinCssVars(resolveSkinPalette(resolvedSkinId)),
    [resolvedSkinId],
  );

  // -------- Mexican-wave rig: 5 lifts, springs, rAF driver --------
  // Always allocate hooks (React rules). For non-celebrate moods we simply
  // never drive the inputs, so springs settle at rest (0).
  const lift0In = useMotionValue(0);
  const lift1In = useMotionValue(0);
  const lift2In = useMotionValue(0);
  const lift3In = useMotionValue(0);
  const lift4In = useMotionValue(0);
  const lift0 = useSpring(lift0In, { stiffness: 180, damping: 14, mass: 0.6 });
  const lift1 = useSpring(lift1In, { stiffness: 180, damping: 14, mass: 0.6 });
  const lift2 = useSpring(lift2In, { stiffness: 180, damping: 14, mass: 0.6 });
  const lift3 = useSpring(lift3In, { stiffness: 180, damping: 14, mass: 0.6 });
  const lift4 = useSpring(lift4In, { stiffness: 180, damping: 14, mass: 0.6 });
  const liftInputs = useMemo(
    () => [lift0In, lift1In, lift2In, lift3In, lift4In],
    [lift0In, lift1In, lift2In, lift3In, lift4In],
  );
  const tentacleLifts = useMemo<MotionValue<number>[]>(
    () => [lift0, lift1, lift2, lift3, lift4],
    [lift0, lift1, lift2, lift3, lift4],
  );

  // Drive the wave. We do NOT early-return — we just keep targets at 0 when
  // not celebrating so the springs settle smoothly.
  useAnimationFrame((tMs) => {
    const tentaclesRigged: BodyTentacleRig[] = [
      { lift: lift0In, phase: 0 },
      { lift: lift1In, phase: 1 },
      { lift: lift2In, phase: 2 },
      { lift: lift3In, phase: 3 },
      { lift: lift4In, phase: 4 },
    ];
    for (const t of tentaclesRigged) {
      if (!isCelebrate || reducedMotion) {
        t.lift.set(0);
        continue;
      }
      // Phase offset in radians = WAVE_STAGGER_MS / WAVE_PERIOD_MS * 2π * index
      const phaseRad = (WAVE_STAGGER_MS / WAVE_PERIOD_MS) * 2 * Math.PI * t.phase;
      const cyc = (tMs / WAVE_PERIOD_MS) * Math.PI * 2 - phaseRad;
      // Map sin from [-1, 1] to [0, 1] and gate so tentacles only rise on the
      // positive half-cycle (more "wave-like" than a smooth bobble).
      const s = Math.sin(cyc);
      const lift = s > 0 ? s : 0;
      t.lift.set(lift);
    }
  });

  // Random blink scheduler. Skipped when mood already keeps eyes closed.
  useEffect(() => {
    if (!bob || mood === "celebrate" || mood === "sleeping") return;
    let cancelled = false;
    let blinkTimeout: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      const next = 4000 + Math.random() * 2000;
      blinkTimeout = setTimeout(() => {
        if (cancelled) return;
        setBlinking(true);
        blinkTimeout = setTimeout(() => {
          if (cancelled) return;
          setBlinking(false);
          schedule();
        }, 120);
      }, next);
    };
    schedule();
    return () => {
      cancelled = true;
      if (blinkTimeout) clearTimeout(blinkTimeout);
    };
  }, [bob, mood]);

  // Celebrate adds a quick pop-in scale on mount; wave/thinking get their own
  // tentacle wiggle via inline animation.
  const popInitial = isCelebrate
    ? { scale: 0.6, opacity: 0 }
    : { scale: 0.85, opacity: 0 };

  // Wave animation rotates the whole mascot slightly so the raised tentacle reads
  // as a waving arm — combined with the angled tentacle path it sells the gesture.
  const waveAnimate =
    mood === "wave" ? { rotate: [-6, 6, -6] } : undefined;
  const waveTransition =
    mood === "wave"
      ? { duration: 0.7, repeat: Infinity, ease: "easeInOut" as const }
      : undefined;

  // Body bob: bigger and faster during celebrate to match the energy.
  const bobAnimate = bob
    ? isCelebrate
      ? { scale: 1, opacity: 1, y: [0, -7, 0] }
      : { scale: 1, opacity: 1, y: [0, -4, 0] }
    : { scale: 1, opacity: 1 };

  const bobTransition = bob
    ? isCelebrate
      ? {
          y: { duration: 1.6, repeat: Infinity, ease: "easeInOut" as const },
          scale: { type: "spring" as const, stiffness: 220, damping: 14 },
          opacity: { duration: 0.18 },
        }
      : {
          y: { duration: 2.6, repeat: Infinity, ease: "easeInOut" as const },
          scale: { type: "spring" as const, stiffness: 220, damping: 14 },
          opacity: { duration: 0.18 },
        }
    : { type: "spring" as const, stiffness: 220, damping: 14 };

  // Silence the unused-binding lint warning when liftInputs is consumed only
  // by the rAF loop above. (Some lint configs flag motion values captured via
  // closure; an explicit void keeps the dep array honest without ceremony.)
  void liftInputs;

  return (
    <motion.div
      className={`relative inline-flex items-center justify-center ${
        className ?? ""
      }`}
      // Spread the resolved skin's CSS vars so the whole SVG + backdrop + aura
      // recolor. With no skin equipped these resolve to the default purple.
      style={{ width: size, height: size, ...skinVars }}
      initial={popInitial}
      animate={bobAnimate}
      transition={bobTransition}
      aria-label={`mascot-${mood}`}
      role="img"
    >
      {/* Soft radial backdrop (purple glow) */}
      {backdrop && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          aria-hidden
          style={{
            background:
              "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--mascot-fill) 30%, transparent) 0%, color-mix(in srgb, var(--mascot-fill) 8%, transparent) 60%, transparent 75%)",
          }}
        />
      )}

      {/* Equipped aura — pointer-events-none, sits behind the body so the glow
          reads as a halo and drifting particles frame the creature. */}
      <MascotAura auraId={resolvedAuraId} size={size} />

      {/* Inner wave-rocking wrapper — only animates for "wave". The hat lives
          inside this (and the outer bob wrapper) so it tracks both motions. */}
      <motion.div
        className="relative w-full h-full"
        animate={waveAnimate}
        transition={waveTransition}
        style={{ transformOrigin: "50% 70%" }}
      >
        <OctoSvg
          mood={mood}
          blinking={blinking}
          uid={uid}
          tentacleLifts={tentacleLifts}
          reducedMotion={reducedMotion}
        />
        {/* Hat overlaid on the head, above the octopus SVG. */}
        <MascotHat hatId={resolvedHatId} size={size} />
      </motion.div>

      {/* Celebrate sparkle ring (re-uses existing utility but tinted purple via box-shadow inline) */}
      {isCelebrate && (
        <span
          className="absolute inset-0 rounded-full pointer-events-none animate-ring-pulse"
          aria-hidden
          style={{
            // override the existing keyframe's green color with purple via box-shadow trick;
            // since animate-ring-pulse uses box-shadow, we can't easily recolor without CSS —
            // but a translucent purple outline overlay reads as celebratory in tandem.
            boxShadow:
              "0 0 0 0 color-mix(in srgb, var(--mascot-fill) 55%, transparent)",
          }}
        />
      )}
    </motion.div>
  );
}
