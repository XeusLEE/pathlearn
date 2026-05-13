"use client";

import type { CSSProperties, ReactElement, SVGProps } from "react";

export interface EpisodeIconProps {
  /** The emoji string the course author / Claude chose for this episode/path. */
  emoji: string;
  /** Pixel size of the icon (default 32). */
  size?: number;
  /** Stroke/fill color for the icon. Defaults to currentColor so the parent's text-* controls it. */
  color?: string;
  className?: string;
}

/**
 * Renders a hand-crafted SVG icon for the most common emojis used by Pathlearn
 * courses. Replaces native emoji glyphs to avoid platform inconsistencies
 * (notably the rectangular glare on the Apple ☀️ rendering inside a colored
 * circle). For unmapped emojis, falls back to the raw emoji wrapped in a
 * styled <span> with explicit emoji-only font stack + lineHeight:1 to suppress
 * platform-specific rendering artifacts.
 *
 * Icons are designed against a 0 0 24 24 viewBox, 2px stroke, round caps/joins,
 * and read crisply against a colored circle background.
 */
export function EpisodeIcon({
  emoji,
  size = 32,
  color = "currentColor",
  className,
}: EpisodeIconProps) {
  // Strip the variation selector (U+FE0F) — many emojis include it (☀️, ☁️, ⚡️)
  // and we want both "☀" and "☀️" to map to the same icon.
  const key = emoji.replace(/️/g, "");
  const Icon = ICON_MAP[key];

  if (Icon) {
    return (
      <Icon
        width={size}
        height={size}
        color={color}
        className={className}
        aria-hidden
      />
    );
  }

  // Fallback: render the emoji glyph, but in a sized box with an emoji-only
  // font stack and lineHeight 1 so platform fonts don't add internal padding
  // or weird halos. Color does NOT apply (emoji glyphs are colored fonts) —
  // we just keep it visually contained.
  const fallbackStyle: CSSProperties = {
    width: size,
    height: size,
    lineHeight: 1,
    fontSize: Math.round(size * 0.82),
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily:
      "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif",
    // Suppress the platform "glare" by clipping anything outside the box.
    overflow: "hidden",
    userSelect: "none",
  };

  return (
    <span aria-hidden className={className} style={fallbackStyle}>
      {emoji}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Icon SVG components                                                       */
/* -------------------------------------------------------------------------- */

type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

/** Shared <svg> wrapper enforcing the 24x24 viewBox + stroke defaults. */
function Svg({
  children,
  color = "currentColor",
  ...rest
}: SVGProps<SVGSVGElement> & { color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** ☀️ Sun — circle + 8 short rays. No flame texture. */
const SunIcon: IconComponent = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.2" />
    <path d="M12 19.3v2.2" />
    <path d="M2.5 12h2.2" />
    <path d="M19.3 12h2.2" />
    <path d="M5.2 5.2l1.55 1.55" />
    <path d="M17.25 17.25l1.55 1.55" />
    <path d="M5.2 18.8l1.55-1.55" />
    <path d="M17.25 6.75l1.55-1.55" />
  </Svg>
);

/** 🌍 Globe — circle with simplified continent. */
const GlobeIcon: IconComponent = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3.5 10.5c2.2.6 3.4-.9 5-.5 1.2.3 1.4 2.3 3 2.3 1.4 0 2-1.4 3.6-1.4 1.6 0 2.5 1 5 .8" />
    <path d="M12 3a13 13 0 0 0 0 18" />
  </Svg>
);

/** 🌱 Plant/sprout — two leaves on a small stem. */
const SproutIcon: IconComponent = (props) => (
  <Svg {...props}>
    <path d="M12 21v-7" />
    <path d="M12 14c0-3 1.5-5.5 4.5-6.5 0 3-1.5 5.5-4.5 6.5z" />
    <path d="M12 14c0-3-1.5-5.5-4.5-6.5 0 3 1.5 5.5 4.5 6.5z" />
  </Svg>
);

/** 🔬 Microscope — simple silhouette. */
const MicroscopeIcon: IconComponent = (props) => (
  <Svg {...props}>
    {/* Base */}
    <path d="M5 21h14" />
    <path d="M7 18h10" />
    {/* Arm */}
    <path d="M10 18c-1.5-1-2.5-2.5-2.5-4.5" />
    {/* Eyepiece tube */}
    <path d="M12 4l3 1.5-1.5 3-3-1.5z" />
    {/* Objective */}
    <path d="M11.25 8l-2 4 3 1.5 2-4" />
    {/* Stand */}
    <path d="M9 18h2v-3h-2z" fill={props.color ?? "currentColor"} stroke="none" />
  </Svg>
);

/** 🧬 DNA — two intertwined curves with rungs. */
const DnaIcon: IconComponent = (props) => (
  <Svg {...props}>
    <path d="M8 3c0 4 8 4 8 8s-8 4-8 8" />
    <path d="M16 3c0 4-8 4-8 8s8 4 8 8" />
    <path d="M9 6h6" />
    <path d="M9 18h6" />
    <path d="M10 10h4" />
    <path d="M10 14h4" />
  </Svg>
);

/** 🧪 Chemistry flask — triangular flask with bubbles. */
const FlaskIcon: IconComponent = (props) => (
  <Svg {...props}>
    <path d="M9 3h6" />
    <path d="M10 3v6.5L5.5 18a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 9.5V3" />
    <circle cx="11" cy="15.5" r="0.6" fill={props.color ?? "currentColor"} />
    <circle cx="13.5" cy="17" r="0.5" fill={props.color ?? "currentColor"} />
    <circle cx="10.5" cy="18" r="0.4" fill={props.color ?? "currentColor"} />
  </Svg>
);

/** 🟢 Green circle — just a filled circle. */
const GreenCircleIcon: IconComponent = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="8" fill={props.color ?? "currentColor"} />
  </Svg>
);

/** ⚡ Lightning bolt — angular zigzag. */
const BoltIcon: IconComponent = (props) => (
  <Svg {...props}>
    <path
      d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"
      fill={props.color ?? "currentColor"}
      fillOpacity={0.2}
    />
  </Svg>
);

/** 🔄 Cycle — curved circular arrow. */
const CycleIcon: IconComponent = (props) => (
  <Svg {...props}>
    <path d="M20 12a8 8 0 1 1-2.34-5.66" />
    <path d="M20 4v4h-4" />
  </Svg>
);

/** 🌲 Tree — triangular evergreen. */
const TreeIcon: IconComponent = (props) => (
  <Svg {...props}>
    <path d="M12 3l-5 7h2.5l-3 5h3l-2.5 4h10l-2.5-4h3l-3-5H17z" />
    <path d="M12 19v3" />
  </Svg>
);

/** 🌳 Rounder tree. */
const Tree2Icon: IconComponent = (props) => (
  <Svg {...props}>
    <path d="M12 3a5 5 0 0 0-4.9 6 4 4 0 0 0 .5 7h8.8a4 4 0 0 0 .5-7A5 5 0 0 0 12 3z" />
    <path d="M12 16v6" />
    <path d="M10 22h4" />
  </Svg>
);

/** ☁️ Cloud. */
const CloudIcon: IconComponent = (props) => (
  <Svg {...props}>
    <path d="M7 18a4 4 0 0 1-.6-7.96 5 5 0 0 1 9.8-1.3A3.5 3.5 0 1 1 17 18H7z" />
  </Svg>
);

/** ✨ Sparkles — 3 small stars. */
const SparklesIcon: IconComponent = (props) => (
  <Svg {...props}>
    <path d="M12 3l1.2 3 3 1.2-3 1.2L12 11.4l-1.2-3-3-1.2 3-1.2z" />
    <path d="M5.5 13l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8L3 15.5l1.8-.7z" />
    <path d="M17.5 13.5l.85 2 2 .85-2 .85-.85 2-.85-2-2-.85 2-.85z" />
  </Svg>
);

/** 🏛️ Building / classical columned facade. */
const BuildingIcon: IconComponent = (props) => (
  <Svg {...props}>
    <path d="M3 21h18" />
    <path d="M4 21V10" />
    <path d="M20 21V10" />
    <path d="M3 10h18" />
    <path d="M3 10l9-6 9 6" />
    <path d="M8 21v-8" />
    <path d="M12 21v-8" />
    <path d="M16 21v-8" />
  </Svg>
);

/** 💻 Laptop / computer silhouette. */
const ComputerIcon: IconComponent = (props) => (
  <Svg {...props}>
    <rect x="4" y="5" width="16" height="11" rx="1.5" />
    <path d="M2 19h20" />
    <path d="M9 16h6" />
  </Svg>
);

/** 🌟 5-point star. */
const StarIcon: IconComponent = (props) => (
  <Svg {...props}>
    <path
      d="M12 3l2.8 5.6 6.2.9-4.5 4.4 1.1 6.2L12 17.8 6.4 20.1l1.1-6.2L3 9.5l6.2-.9z"
      fill={props.color ?? "currentColor"}
      fillOpacity={0.18}
    />
  </Svg>
);

/** 🎯 Target — concentric circles. */
const TargetIcon: IconComponent = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5.5" />
    <circle cx="12" cy="12" r="2" fill={props.color ?? "currentColor"} />
  </Svg>
);

/** 🗺️ Map — folded map. */
const MapIcon: IconComponent = (props) => (
  <Svg {...props}>
    <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
    <path d="M9 4v16" />
    <path d="M15 6v16" />
  </Svg>
);

/** 📚 Books — stacked rectangles. */
const BooksIcon: IconComponent = (props) => (
  <Svg {...props}>
    <rect x="4" y="4" width="6" height="16" rx="0.6" />
    <rect x="11" y="6" width="6" height="14" rx="0.6" />
    <path d="M18 7l2.5.5-2 12.5-2.5-.5" />
  </Svg>
);

/** 🧠 Brain — two lobes. */
const BrainIcon: IconComponent = (props) => (
  <Svg {...props}>
    <path d="M12 5a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 0 4 3 3 0 0 0 3 4 3 3 0 0 0 5 1V5z" />
    <path d="M12 5a3 3 0 0 1 3-3 3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1 0 4 3 3 0 0 1-3 4 3 3 0 0 1-5 1V5z" />
  </Svg>
);

/** 🔥 Flame. */
const FlameIcon: IconComponent = (props) => (
  <Svg {...props}>
    <path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1.5.5-2.5 1.5-3.5C9 9 8.5 7 9 5c1 1 2 1.5 3-2z" />
    <path d="M10 16a2 2 0 0 0 4 0c0-1-.5-1.5-1-2-.4.6-1 .8-1.5.5-.5-.3-.5-1-.5-1.5-1 .6-1 2-1 3z" />
  </Svg>
);

/** 💧 Water drop. */
const DropIcon: IconComponent = (props) => (
  <Svg {...props}>
    <path
      d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"
      fill={props.color ?? "currentColor"}
      fillOpacity={0.18}
    />
  </Svg>
);

/* -------------------------------------------------------------------------- */
/*  Emoji → Icon mapping                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Keyed by the emoji *without* the U+FE0F variation selector (we strip it
 * before lookup). This handles both "☀" and "☀️" inputs uniformly.
 */
const ICON_MAP: Record<string, IconComponent> = {
  "☀": SunIcon,
  "🌍": GlobeIcon,
  "🌎": GlobeIcon,
  "🌏": GlobeIcon,
  "🌐": GlobeIcon,
  "🌱": SproutIcon,
  "🔬": MicroscopeIcon,
  "🧬": DnaIcon,
  "🧪": FlaskIcon,
  "🟢": GreenCircleIcon,
  "⚡": BoltIcon,
  "🔄": CycleIcon,
  "🌲": TreeIcon,
  "🌳": Tree2Icon,
  "☁": CloudIcon,
  "✨": SparklesIcon,
  "🏛": BuildingIcon,
  "💻": ComputerIcon,
  "🌟": StarIcon,
  "⭐": StarIcon,
  "🎯": TargetIcon,
  "🗺": MapIcon,
  "📚": BooksIcon,
  "📖": BooksIcon,
  "🧠": BrainIcon,
  "🔥": FlameIcon,
  "💧": DropIcon,
};
