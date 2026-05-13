"use client";

// =============================================================
// <Mascot /> — Pathlearn's purple octopus mascot.
//
// Inline-SVG character that ships across the app: path map header,
// level-up modal, episode-complete screen, etc. Subtle continuous
// bob keeps it feeling alive, plus a blink every 4-6s so it never
// reads as static. Six mood variants drive expressions, tentacle
// pose, and optional accessories (sparkles, Zzz, "?", etc.).
// =============================================================

import { motion } from "framer-motion";
import { useEffect, useId, useMemo, useState } from "react";

export type MascotMood =
  | "happy"
  | "celebrate"
  | "sleeping"
  | "wave"
  | "thinking"
  | "worried";

export interface MascotProps {
  /** Pixel size of the mascot (the backdrop bubble matches when shown). */
  size?: number;
  mood?: MascotMood;
  /** When false, disables the continuous bob animation. */
  bob?: boolean;
  /** When false, hides the soft purple radial backdrop. Default true. */
  backdrop?: boolean;
  className?: string;
}

interface OctoSvgProps {
  mood: MascotMood;
  /** When true, eyes render as blink lines (used for randomized blink). */
  blinking: boolean;
  /** Stable id prefix so multiple Mascots on a page don't clash. */
  uid: string;
}

/**
 * Inline SVG purple octopus. All colors pull from CSS variables so the
 * mascot stays consistent if the brand palette shifts. The viewBox is
 * intentionally larger than the body so accessories (sparkles, Zzz,
 * raised tentacles) can sit outside without clipping.
 */
function OctoSvg({ mood, blinking, uid }: OctoSvgProps) {
  // Mood-derived flags.
  const eyesClosedSleep = mood === "sleeping";
  const eyesClosedCelebrate = mood === "celebrate";
  const eyesClosed = blinking || eyesClosedSleep || eyesClosedCelebrate;
  const showZzz = mood === "sleeping";
  const showStars = mood === "celebrate";
  const showQuestion = mood === "thinking";
  const tiltedHead = mood === "thinking";
  // Mouth variants per mood.
  const mouthVariant: "smile" | "open-smile" | "dot" | "o" =
    mood === "celebrate"
      ? "open-smile"
      : mood === "happy" || mood === "wave"
      ? "smile"
      : mood === "worried"
      ? "o"
      : "dot";

  const bodyGradId = `octo-body-${uid}`;
  const backdropGradId = `octo-backdrop-${uid}`;

  return (
    <svg
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      aria-hidden
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={bodyGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-purple)" />
          <stop offset="100%" stopColor="var(--color-purple-dark)" />
        </linearGradient>
        <radialGradient id={backdropGradId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-purple)" stopOpacity="0.28" />
          <stop offset="70%" stopColor="var(--color-purple)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--color-purple)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The octopus group — tilts on "thinking". */}
      <g
        transform={tiltedHead ? "rotate(-6 60 60)" : undefined}
        style={{ transformOrigin: "60px 60px" }}
      >
        {/* ---------- Tentacles (back layer) ---------- */}
        {/* Outer left tentacle */}
        <path
          d={
            mood === "wave"
              ? // dramatic wave tentacle reaching up-left
                "M32 78 Q14 62 22 38 Q26 28 18 22"
              : mood === "celebrate"
              ? // raised V tentacle
                "M30 78 Q18 64 18 44"
              : mood === "sleeping" || mood === "worried"
              ? "M30 80 Q18 90 12 100"
              : "M30 78 Q20 86 16 96"
          }
          fill="none"
          stroke="var(--color-purple-dark)"
          strokeWidth="9"
          strokeLinecap="round"
          opacity="0.95"
        />
        <path
          d={
            mood === "wave"
              ? "M32 78 Q14 62 22 38 Q26 28 18 22"
              : mood === "celebrate"
              ? "M30 78 Q18 64 18 44"
              : mood === "sleeping" || mood === "worried"
              ? "M30 80 Q18 90 12 100"
              : "M30 78 Q20 86 16 96"
          }
          fill="none"
          stroke="var(--color-purple)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Outer right tentacle */}
        <path
          d={
            mood === "celebrate"
              ? "M90 78 Q102 64 102 44"
              : mood === "thinking"
              ? // touches the "chin"
                "M88 80 Q98 70 78 64"
              : mood === "sleeping" || mood === "worried"
              ? "M90 80 Q102 90 108 100"
              : "M90 78 Q100 86 104 96"
          }
          fill="none"
          stroke="var(--color-purple-dark)"
          strokeWidth="9"
          strokeLinecap="round"
          opacity="0.95"
        />
        <path
          d={
            mood === "celebrate"
              ? "M90 78 Q102 64 102 44"
              : mood === "thinking"
              ? "M88 80 Q98 70 78 64"
              : mood === "sleeping" || mood === "worried"
              ? "M90 80 Q102 90 108 100"
              : "M90 78 Q100 86 104 96"
          }
          fill="none"
          stroke="var(--color-purple)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Inner left tentacle (between outer and center) */}
        <path
          d={
            mood === "sleeping"
              ? "M44 84 Q40 96 36 104"
              : mood === "worried"
              ? "M44 84 Q40 96 38 104"
              : "M44 84 Q42 96 46 104"
          }
          fill="none"
          stroke="var(--color-purple-dark)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d={
            mood === "sleeping"
              ? "M44 84 Q40 96 36 104"
              : mood === "worried"
              ? "M44 84 Q40 96 38 104"
              : "M44 84 Q42 96 46 104"
          }
          fill="none"
          stroke="var(--color-purple)"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Inner right tentacle */}
        <path
          d={
            mood === "sleeping"
              ? "M76 84 Q80 96 84 104"
              : mood === "worried"
              ? "M76 84 Q80 96 82 104"
              : "M76 84 Q78 96 74 104"
          }
          fill="none"
          stroke="var(--color-purple-dark)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d={
            mood === "sleeping"
              ? "M76 84 Q80 96 84 104"
              : mood === "worried"
              ? "M76 84 Q80 96 82 104"
              : "M76 84 Q78 96 74 104"
          }
          fill="none"
          stroke="var(--color-purple)"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Center-front tentacle (small, peeks below body) */}
        <path
          d="M60 90 Q58 100 60 108"
          fill="none"
          stroke="var(--color-purple-dark)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M60 90 Q58 100 60 108"
          fill="none"
          stroke="var(--color-purple)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Suction cup hints on outer tentacles */}
        <g fill="var(--color-purple-dark)" opacity="0.85">
          {mood !== "celebrate" && mood !== "wave" && (
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
          stroke="var(--color-purple-dark)"
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

        {/* ---------- Cheeks (blush) ---------- */}
        <path
          d="M36 64 L44 64 L40 70 Z"
          fill="rgba(255, 167, 167, 0.4)"
        />
        <path
          d="M76 64 L84 64 L80 70 Z"
          fill="rgba(255, 167, 167, 0.4)"
        />

        {/* ---------- Eyebrows (worried only) ---------- */}
        {mood === "worried" && (
          <g
            stroke="var(--color-purple-dark)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M40 43 Q46 41 50 44" />
            <path d="M80 43 Q74 41 70 44" />
          </g>
        )}

        {/* ---------- Eyes ---------- */}
        {!eyesClosed && (
          <>
            {/* Whites */}
            <circle
              cx="48"
              cy={mood === "worried" ? 53 : 52}
              r={mood === "worried" ? 8.5 : 7.5}
              fill="#ffffff"
              stroke="var(--color-purple-dark)"
              strokeWidth="1"
            />
            <circle
              cx="72"
              cy={mood === "worried" ? 53 : 52}
              r={mood === "worried" ? 8.5 : 7.5}
              fill="#ffffff"
              stroke="var(--color-purple-dark)"
              strokeWidth="1"
            />
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
          </>
        )}
        {eyesClosed && (
          <>
            {/* Curved lines — celebrate/blink curve up (happy), sleeping curves down */}
            {eyesClosedSleep ? (
              <>
                <path
                  d="M42 53 Q48 58 54 53"
                  stroke="var(--color-purple-dark)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M66 53 Q72 58 78 53"
                  stroke="var(--color-purple-dark)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <>
                <path
                  d="M42 53 Q48 48 54 53"
                  stroke="var(--color-purple-dark)"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d="M66 53 Q72 48 78 53"
                  stroke="var(--color-purple-dark)"
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
            stroke="var(--color-purple-dark)"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />
        )}
        {mouthVariant === "open-smile" && (
          <path
            d="M52 67 Q60 76 68 67 Q60 73 52 67 Z"
            fill="var(--color-purple-dark)"
            stroke="var(--color-purple-dark)"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        )}
        {mouthVariant === "dot" && (
          <circle cx="60" cy="69" r="1.4" fill="var(--color-purple-dark)" />
        )}
        {mouthVariant === "o" && (
          <ellipse
            cx="60"
            cy="69"
            rx="2.2"
            ry="2.8"
            fill="var(--color-purple-dark)"
          />
        )}
      </g>

      {/* ---------- Accessories above (not tilted with head) ---------- */}
      {/* Sparkles for celebrate */}
      {showStars && (
        <g fill="var(--color-xp)">
          <motion.path
            d="M22 24 L24 28 L28 29 L24.5 31 L25 35 L22 32.6 L19 35 L19.5 31 L16 29 L20 28 Z"
            animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.05, 0.9] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "22px 30px" }}
          />
          <motion.path
            d="M98 28 L99.6 31 L103 32 L100 34 L100.6 37 L98 35 L95.4 37 L96 34 L93 32 L96.4 31 Z"
            animate={{ opacity: [1, 0.5, 1], scale: [1.05, 0.92, 1.05] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.2,
            }}
            style={{ transformOrigin: "98px 33px" }}
          />
          <motion.path
            d="M60 8 L61.6 12 L66 13 L62.5 15 L63 19 L60 16.8 L57 19 L57.5 15 L54 13 L58.4 12 Z"
            animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.08, 0.95] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5,
            }}
            style={{ transformOrigin: "60px 14px" }}
          />
        </g>
      )}

      {/* Zzz for sleeping */}
      {showZzz && (
        <g
          fill="none"
          stroke="var(--color-purple-dark)"
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
          fill="var(--color-purple-dark)"
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

export function Mascot({
  size = 96,
  mood = "happy",
  bob = true,
  backdrop = true,
  className,
}: MascotProps) {
  const [blinking, setBlinking] = useState(false);
  const reactId = useId();
  const uid = useMemo(() => reactId.replace(/[:]/g, ""), [reactId]);

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
  const popInitial =
    mood === "celebrate"
      ? { scale: 0.6, opacity: 0 }
      : { scale: 0.85, opacity: 0 };

  // Wave animation rotates the whole mascot slightly so the raised tentacle reads
  // as a waving arm — combined with the angled tentacle path it sells the gesture.
  const waveAnimate =
    mood === "wave"
      ? { rotate: [-6, 6, -6] }
      : undefined;
  const waveTransition =
    mood === "wave"
      ? { duration: 0.7, repeat: Infinity, ease: "easeInOut" as const }
      : undefined;

  return (
    <motion.div
      className={`relative inline-flex items-center justify-center ${
        className ?? ""
      }`}
      style={{ width: size, height: size }}
      initial={popInitial}
      animate={
        bob
          ? { scale: 1, opacity: 1, y: [0, -4, 0] }
          : { scale: 1, opacity: 1 }
      }
      transition={
        bob
          ? {
              y: { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
              scale: { type: "spring", stiffness: 220, damping: 14 },
              opacity: { duration: 0.18 },
            }
          : { type: "spring", stiffness: 220, damping: 14 }
      }
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
              "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--color-purple) 30%, transparent) 0%, color-mix(in srgb, var(--color-purple) 8%, transparent) 60%, transparent 75%)",
          }}
        />
      )}

      {/* Inner wave-rocking wrapper — only animates for "wave". */}
      <motion.div
        className="relative w-full h-full"
        animate={waveAnimate}
        transition={waveTransition}
        style={{ transformOrigin: "50% 70%" }}
      >
        <OctoSvg mood={mood} blinking={blinking} uid={uid} />
      </motion.div>

      {/* Celebrate sparkle ring (re-uses existing utility but tinted purple via box-shadow inline) */}
      {mood === "celebrate" && (
        <span
          className="absolute inset-0 rounded-full pointer-events-none animate-ring-pulse"
          aria-hidden
          style={{
            // override the existing keyframe's green color with purple via box-shadow trick;
            // since animate-ring-pulse uses box-shadow, we can't easily recolor without CSS —
            // but a translucent purple outline overlay reads as celebratory in tandem.
            boxShadow:
              "0 0 0 0 color-mix(in srgb, var(--color-purple) 55%, transparent)",
          }}
        />
      )}
    </motion.div>
  );
}
