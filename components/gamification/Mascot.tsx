"use client";

// =============================================================
// <Mascot /> — friendly inline-SVG owl on a gradient bubble.
// Reused on the path map header, level-up modal, episode-complete
// screen, etc. Subtle continuous bob keeps it feeling alive, plus
// a blink every 4-6s so it doesn't read as static.
// =============================================================

import { motion } from "framer-motion";
import { useEffect, useId, useState } from "react";

export type MascotMood = "happy" | "celebrate" | "sleeping" | "wave";

export interface MascotProps {
  /** Pixel size of the round bubble. Default 96. */
  size?: number;
  mood?: MascotMood;
  /** When false, disables the continuous bob animation. */
  bob?: boolean;
  className?: string;
}

interface OwlSvgProps {
  mood: MascotMood;
  /** When true, renders eyes-closed variant (used for blink). */
  blinking: boolean;
  /** Stable id prefix so multiple Mascots on a page don't clash. */
  uid: string;
}

/**
 * Inline SVG owl. Body uses currentColor so the parent can theme it
 * (e.g. `text-primary`). The gradient platform behind the owl pulls
 * from --color-primary-light → --color-primary directly.
 */
function OwlSvg({ mood, blinking, uid }: OwlSvgProps) {
  const eyesClosed = blinking || mood === "celebrate" || mood === "sleeping";
  const showZzz = mood === "sleeping";
  const showStars = mood === "celebrate";
  const showWave = mood === "wave";
  const smiling = mood === "happy" || mood === "wave";

  const gradId = `mascotGrad-${uid}`;

  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      aria-hidden
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary-light)" />
          <stop offset="100%" stopColor="var(--color-primary)" />
        </linearGradient>
      </defs>

      {/* Backdrop disc — gradient platform */}
      <circle cx="50" cy="50" r="48" fill={`url(#${gradId})`} />
      {/* Inner gloss highlight */}
      <ellipse cx="36" cy="30" rx="18" ry="10" fill="rgba(255,255,255,0.18)" />

      {/* Ear tufts */}
      <path
        d="M26 26 L30 16 L36 24 Z"
        fill="currentColor"
      />
      <path
        d="M74 26 L70 16 L64 24 Z"
        fill="currentColor"
      />

      {/* Body / head — single rounded shape */}
      <ellipse cx="50" cy="56" rx="28" ry="30" fill="currentColor" />
      {/* Belly highlight */}
      <ellipse cx="50" cy="64" rx="16" ry="18" fill="rgba(255,255,255,0.14)" />

      {/* Eye whites */}
      {!eyesClosed && (
        <>
          <circle cx="40" cy="48" r="9" fill="#ffffff" />
          <circle cx="60" cy="48" r="9" fill="#ffffff" />
          {/* Pupils */}
          <circle cx="41" cy="49" r="4" fill="#1f2933" />
          <circle cx="61" cy="49" r="4" fill="#1f2933" />
          {/* Sparkle dots */}
          <circle cx="42.5" cy="47" r="1.2" fill="#ffffff" />
          <circle cx="62.5" cy="47" r="1.2" fill="#ffffff" />
        </>
      )}
      {eyesClosed && (
        <>
          {/* Closed eyes (curved lines) */}
          <path
            d="M33 49 Q40 44 47 49"
            stroke="#1f2933"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M53 49 Q60 44 67 49"
            stroke="#1f2933"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}

      {/* Beak — small triangle */}
      <path d="M47 58 L53 58 L50 64 Z" fill="#ffc800" />

      {/* Mouth */}
      {smiling ? (
        <path
          d="M44 70 Q50 74 56 70"
          stroke="#1f2933"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
      ) : (
        <circle cx="50" cy="71" r="1.4" fill="#1f2933" />
      )}

      {/* Stars (celebrate) */}
      {showStars && (
        <g fill="#ffc800">
          <path d="M16 18 L17.5 21 L21 21.6 L18.5 24 L19 27.5 L16 25.7 L13 27.5 L13.5 24 L11 21.6 L14.5 21 Z" />
          <path d="M84 22 L85 24 L87.4 24.4 L85.7 26 L86 28.4 L84 27.2 L82 28.4 L82.3 26 L80.6 24.4 L83 24 Z" />
          <path d="M50 8 L51.2 10.6 L54 11 L52 12.9 L52.5 15.6 L50 14.3 L47.5 15.6 L48 12.9 L46 11 L48.8 10.6 Z" />
        </g>
      )}

      {/* Zzz (sleeping) */}
      {showZzz && (
        <g
          fill="none"
          stroke="#1f2933"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M70 14 L80 14 L70 24 L80 24" />
          <path d="M82 8 L88 8 L82 14 L88 14" />
        </g>
      )}

      {/* Wing wave */}
      {showWave && (
        <path
          d="M76 50 L92 38 L86 56 Z"
          fill="currentColor"
        />
      )}
    </svg>
  );
}

export function Mascot({
  size = 96,
  mood = "happy",
  bob = true,
  className,
}: MascotProps) {
  const [blinking, setBlinking] = useState(false);
  const reactId = useId();
  const uid = reactId.replace(/[:]/g, "");

  // Blink every 4-6s, eyes closed for 120ms.
  useEffect(() => {
    // No blinking if already eyes-closed via mood or no bob.
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

  return (
    <motion.div
      className={`relative inline-flex items-center justify-center ${
        className ?? ""
      }`}
      style={{ width: size, height: size, color: "#7a4f1d" }}
      initial={{ scale: 0.8, opacity: 0 }}
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
      <OwlSvg mood={mood} blinking={blinking} uid={uid} />
      {mood === "celebrate" && (
        // Tiny sparkle ring around celebrate mood.
        <span
          className="absolute inset-0 rounded-full pointer-events-none animate-ring-pulse"
          aria-hidden
        />
      )}
    </motion.div>
  );
}
