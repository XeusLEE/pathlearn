"use client";

// =============================================================
// <CoinPill /> + <CoinIcon /> — the coin economy's HUD surface.
//
// CoinIcon: a crisp gold coin SVG (outer circle, inner ring, a
// star mark, radial gold gradient #fcd34d -> #f59e0b). Reusable
// anywhere a coin glyph is needed (HUD pill, completion reward).
//
// CoinPill: reads the live balance from the store and renders it
// in a rounded gold-tinted pill. When the balance INCREASES the
// coin icon plays .animate-coin-bounce once (previous value is
// tracked with a ref so we only bounce on a genuine gain, never
// on mount or on a spend). Honors prefers-reduced-motion via the
// global CSS guard on .animate-coin-bounce.
// =============================================================

import { useEffect, useId, useRef, useState } from "react";
import { useApp, selectCoins, selectHasHydrated } from "@/lib/store";

export interface CoinIconProps {
  /** Pixel size of the square icon. Default 18. */
  size?: number;
  className?: string;
}

/**
 * Gold coin glyph. Uses a unique gradient id per instance (useId) so
 * multiple coins on a page never collide on the SVG def id.
 */
export function CoinIcon({ size = 18, className }: CoinIconProps) {
  const gradId = useId();
  const faceId = `${gradId}-face`;
  const ringId = `${gradId}-ring`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <radialGradient id={faceId} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="45%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <linearGradient id={ringId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* Outer rim */}
      <circle cx="12" cy="12" r="11" fill={`url(#${ringId})`} />
      {/* Coin face */}
      <circle cx="12" cy="12" r="9.2" fill={`url(#${faceId})`} />
      {/* Inner ring groove */}
      <circle
        cx="12"
        cy="12"
        r="7.4"
        fill="none"
        stroke="#d97706"
        strokeOpacity="0.5"
        strokeWidth="1"
      />
      {/* Star mark */}
      <path
        d="M12 6.6l1.43 2.9 3.2.47-2.32 2.26.55 3.19L12 13.78l-2.86 1.5.55-3.19L7.37 9.97l3.2-.47L12 6.6z"
        fill="#b45309"
        fillOpacity="0.9"
      />
      {/* Top-left specular highlight */}
      <ellipse
        cx="9"
        cy="8.4"
        rx="2.6"
        ry="1.7"
        fill="#fffbeb"
        fillOpacity="0.55"
        transform="rotate(-28 9 8.4)"
      />
    </svg>
  );
}

export interface CoinPillProps {
  /** When provided the pill becomes a 44px tap-target button. */
  onClick?: () => void;
  className?: string;
}

export function CoinPill({ onClick, className }: CoinPillProps) {
  const coins = useApp(selectCoins);
  const hydrated = useApp(selectHasHydrated);

  // Bounce the icon only when the balance genuinely increases. Seed the
  // ref with the current value so the first render (and any spend) never
  // triggers the bounce.
  const prevCoins = useRef(coins);
  const [bounceKey, setBounceKey] = useState(0);
  useEffect(() => {
    if (coins > prevCoins.current) {
      setBounceKey((k) => k + 1);
    }
    prevCoins.current = coins;
  }, [coins]);

  const inner = (
    <>
      <span
        // Re-keying the span remounts it so the one-shot bounce animation
        // replays on every gain (not just the first).
        key={bounceKey}
        className={`inline-flex ${bounceKey > 0 ? "animate-coin-bounce" : ""}`}
      >
        <CoinIcon size={18} />
      </span>
      {/* Until the persisted balance rehydrates, show a neutral dash instead
          of the in-memory default so returning players don't see a flash. */}
      <span className="tabular-nums">
        {hydrated ? coins.toLocaleString() : "—"}
      </span>
    </>
  );

  const baseClasses =
    "inline-flex items-center gap-1.5 rounded-full border-2 border-xp/40 bg-xp/15 px-3 py-1.5 font-extrabold text-sm leading-none text-ink select-none";

  if (onClick) {
    return (
      <span className="tap-target relative">
        <button
          type="button"
          onClick={onClick}
          aria-label={`Coins: ${coins.toLocaleString()} — open shop`}
          className={`${baseClasses} ${className ?? ""}`}
        >
          {inner}
        </button>
      </span>
    );
  }

  return (
    <span
      aria-label={`Coins: ${coins.toLocaleString()}`}
      className={`${baseClasses} ${className ?? ""}`}
    >
      {inner}
    </span>
  );
}
