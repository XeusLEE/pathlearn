"use client";

import { useId, useMemo, useRef } from "react";
import { motion } from "framer-motion";

interface Point {
  x: number;
  y: number;
}

/**
 * Per-segment state. A "segment" is the connector between consecutive
 * episodes (so N nodes → N-1 segments).
 *
 * - `completed`: both bookend episodes are done — solid filled trail.
 * - `active`:    leads INTO the next-up episode — dashed marching ants + glow.
 * - `locked`:    everything else — muted dotted recession.
 */
export type PathConnectorSegmentState = "completed" | "active" | "locked";

export interface PathConnectorSegment {
  /** Index of the episode at the start of this segment. */
  startIndex: number;
  /** Index of the episode at the end of this segment (== startIndex + 1). */
  endIndex: number;
  /** Visual state classification for this segment. */
  state: PathConnectorSegmentState;
}

interface PathConnectorProps {
  /** Computed node center positions (in SVG pixel space). */
  points: Point[];
  /** Total SVG canvas width — must match the host container. */
  width: number;
  /** Total SVG canvas height — typically the height of the path column. */
  height: number;
  /** Optional stroke color override for the base trail. Defaults to the soft border token. */
  stroke?: string;
  /**
   * Per-point completion. Back-compat: when provided WITHOUT `segments`,
   * segments between two CONSECUTIVE completed points get a solid colored
   * overlay that animates in (legacy behavior).
   */
  completed?: boolean[];
  /**
   * Per-segment state overrides. When supplied, the connector renders
   * dedicated styled paths for each segment instead of a single continuous
   * dotted trail — enables completed / active / locked visual differentiation.
   */
  segments?: PathConnectorSegment[];
}

/**
 * Renders a smooth winding curve through the supplied node centers. Each
 * segment between consecutive episodes can be styled independently to
 * communicate progress state:
 *
 * - completed segments: solid filled trail in the theme color with a subtle
 *   midpoint sparkle. Animates `pathLength: 0→1` the FIRST time it appears
 *   as completed.
 * - active segment:    tight dashed line in the primary color with a glow
 *   filter and a slow "marching ants" dashoffset animation — a "follow me"
 *   affordance leading into the next-up episode.
 * - locked segments:   smaller, more evenly spaced dots in `--color-border`
 *   at 60% opacity to recede.
 *
 * Sits absolutely behind the node rows; ignores pointer events.
 *
 * Back-compat: if `segments` is not provided but `completed[]` is, falls
 * back to the legacy single-trail + completed-overlay rendering.
 */
export function PathConnector({
  points,
  width,
  height,
  stroke,
  completed,
  segments,
}: PathConnectorProps) {
  // Unique filter id per instance — multiple PathConnectors on a page must
  // not collide on the glow filter ref.
  const rawId = useId();
  const glowId = `active-glow-${rawId.replace(/[:]/g, "")}`;

  // Track previously-completed segment keys so newly-completed ones get the
  // pathLength fill-in animation, while already-completed ones render
  // statically (no re-animating when state higher up re-renders).
  const prevCompletedKeysRef = useRef<Set<string>>(new Set());

  // Build the smooth full path once (used for legacy mode + the locked
  // underlay in segment mode).
  const fullPathD = useMemo(() => buildSmoothPath(points), [points]);

  // Per-segment d-strings (always computed when we have ≥ 2 points so we can
  // also render them in legacy mode if needed).
  const segmentDs = useMemo(() => {
    if (points.length < 2) return [] as string[];
    const out: string[] = new Array(points.length - 1);
    for (let i = 0; i < points.length - 1; i++) {
      out[i] = buildSegmentPath(points, i, i + 1);
    }
    return out;
  }, [points]);

  if (points.length < 2) return null;

  // --- LEGACY PATH (back-compat) -------------------------------------------
  // If callers haven't migrated to `segments`, render the original dotted
  // trail + completed-pair overlays.
  if (!segments) {
    const legacySegments: { d: string; from: number; to: number }[] = [];
    if (completed && completed.length === points.length) {
      for (let i = 0; i < points.length - 1; i++) {
        if (completed[i] && completed[i + 1]) {
          legacySegments.push({
            d: segmentDs[i],
            from: i,
            to: i + 1,
          });
        }
      }
    }
    return (
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: "visible" }}
      >
        <path
          d={fullPathD}
          fill="none"
          stroke={stroke ?? "var(--color-border-soft)"}
          strokeWidth={10}
          strokeLinecap="round"
          opacity={0.55}
        />
        <path
          d={fullPathD}
          fill="none"
          stroke={stroke ?? "var(--color-border)"}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray="0.1 14"
        />
        {legacySegments.map((seg) => (
          <motion.path
            key={`seg-${seg.from}-${seg.to}`}
            d={seg.d}
            fill="none"
            stroke={stroke ?? "var(--color-primary)"}
            strokeWidth={6}
            strokeLinecap="round"
            opacity={0.85}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{
              type: "spring",
              stiffness: 70,
              damping: 18,
              duration: 0.6,
            }}
          />
        ))}
      </svg>
    );
  }

  // --- STATE-AWARE PATH ----------------------------------------------------
  // Track newly-completed segments to drive the one-time fill animation. We
  // compute the current completed-key set, compare with the previous render,
  // then commit. (Commit happens during render — fine because the ref is
  // purely a "have we seen this before" cache and never feeds React state.)
  const currentCompletedKeys = new Set<string>();
  for (const seg of segments) {
    if (seg.state === "completed") {
      currentCompletedKeys.add(`${seg.startIndex}-${seg.endIndex}`);
    }
  }
  const prevCompletedKeys = prevCompletedKeysRef.current;
  const newlyCompletedKeys = new Set<string>();
  for (const key of currentCompletedKeys) {
    if (!prevCompletedKeys.has(key)) newlyCompletedKeys.add(key);
  }
  prevCompletedKeysRef.current = currentCompletedKeys;

  // Active segment is rendered LAST in the painter's order so its glow
  // sits above adjacent locked dots without being clipped.
  const orderedSegments = [...segments].sort((a, b) => {
    const order = (s: PathConnectorSegmentState) =>
      s === "locked" ? 0 : s === "completed" ? 1 : 2;
    return order(a.state) - order(b.state);
  });

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* Soft purple glow used by the active segment. Filter region is
            padded 20% on each side so the blur isn't clipped at the
            segment's bounding box. */}
        <filter
          id={glowId}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          // colorInterpolationFilters keeps the blur+flood matching CSS color
          // space rather than the default linearRGB which mutes the tint.
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feFlood
            floodColor="var(--color-primary)"
            floodOpacity="0.4"
          />
          <feComposite in2="blur" operator="in" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Faint soft underlay running the whole curve — gives the trail a
          subtle "depth" cushion regardless of per-segment state. */}
      <path
        d={fullPathD}
        fill="none"
        stroke="var(--color-border-soft)"
        strokeWidth={10}
        strokeLinecap="round"
        opacity={0.4}
      />

      {orderedSegments.map((seg) => {
        const d = segmentDs[seg.startIndex];
        if (!d) return null;
        const key = `${seg.startIndex}-${seg.endIndex}`;

        if (seg.state === "locked") {
          // Refined locked dots: smaller, more evenly spaced, muted color.
          return (
            <path
              key={`locked-${key}`}
              d={d}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray="0.1 16"
              opacity={0.6}
            />
          );
        }

        if (seg.state === "completed") {
          const isNew = newlyCompletedKeys.has(key);
          const fill = stroke ?? "var(--color-primary)";
          // Sparkle position = midpoint of the curve between the two
          // endpoints. We sample the same quadratic the segment uses, so it
          // lands ON the line at t=0.5.
          const sparkle = sampleMidpoint(points, seg.startIndex, seg.endIndex);
          return (
            <g key={`completed-${key}`}>
              <motion.path
                d={d}
                fill="none"
                stroke={fill}
                strokeWidth={5}
                strokeLinecap="round"
                opacity={0.85}
                initial={isNew ? { pathLength: 0 } : false}
                animate={isNew ? { pathLength: 1 } : undefined}
                transition={
                  isNew
                    ? {
                        type: "spring",
                        stiffness: 70,
                        damping: 18,
                        duration: 0.6,
                      }
                    : undefined
                }
              />
              {/* Subtle gold sparkle dot — a little reward marker. The
                  outer ring fades + scales gently to feel alive without
                  fighting the section's calmer reads. */}
              <motion.circle
                cx={sparkle.x}
                cy={sparkle.y}
                r={5}
                fill="#fbbf24"
                opacity={0.9}
                initial={
                  isNew ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 0.9 }
                }
                animate={
                  isNew ? { scale: 1, opacity: 0.9 } : undefined
                }
                transition={
                  isNew
                    ? { type: "spring", stiffness: 220, damping: 14, delay: 0.3 }
                    : undefined
                }
                style={{ transformOrigin: `${sparkle.x}px ${sparkle.y}px` }}
              />
              <circle
                cx={sparkle.x}
                cy={sparkle.y}
                r={2}
                fill="#fff8d4"
                opacity={0.95}
              />
            </g>
          );
        }

        // active — marching ants + glow.
        return (
          <motion.path
            key={`active-${key}`}
            d={d}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray="3 8"
            opacity={0.95}
            filter={`url(#${glowId})`}
            // Slow "follow me" flow toward the next node. -22 keeps a clean
            // wrap with the 3+8=11px pattern (so it loops seamlessly).
            animate={{ strokeDashoffset: [0, -22] }}
            transition={{
              repeat: Infinity,
              duration: 1.6,
              ease: "linear",
            }}
          />
        );
      })}
    </svg>
  );
}

/**
 * Build a smooth path that visits each point. We anchor the curve at midpoints
 * between consecutive points and use quadratic beziers with the actual nodes as
 * control points — gives a soft swooping line through every node.
 */
function buildSmoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const cur = points[i];
    const next = points[i + 1];
    const midX = (cur.x + next.x) / 2;
    const midY = (cur.y + next.y) / 2;
    d += ` Q ${cur.x} ${cur.y} ${midX} ${midY}`;
  }
  // Final segment ends at the last point, controlled by the second-to-last.
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  d += ` Q ${prev.x} ${prev.y} ${last.x} ${last.y}`;
  return d;
}

/** Build a single curved segment between two points using a quadratic bezier
 * whose control point bows toward the previous bend, so it visually traces the
 * full curve. We approximate the same shape buildSmoothPath uses by aiming
 * the control point at the midpoint between `from` and `to` shifted slightly
 * toward the average of neighbouring nodes.
 */
function buildSegmentPath(
  points: Point[],
  from: number,
  to: number
): string {
  const a = points[from];
  const b = points[to];
  const prev = points[from - 1] ?? a;
  const next = points[to + 1] ?? b;
  const cx = (prev.x + a.x + b.x + next.x) / 4;
  const cy = (prev.y + a.y + b.y + next.y) / 4;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

/**
 * Sample the t=0.5 point of the same quadratic bezier `buildSegmentPath`
 * emits. Used to place the completed-segment sparkle exactly on the line.
 *
 * Quadratic bezier midpoint: B(0.5) = 0.25·P0 + 0.5·P1 + 0.25·P2
 */
function sampleMidpoint(points: Point[], from: number, to: number): Point {
  const a = points[from];
  const b = points[to];
  const prev = points[from - 1] ?? a;
  const next = points[to + 1] ?? b;
  const cx = (prev.x + a.x + b.x + next.x) / 4;
  const cy = (prev.y + a.y + b.y + next.y) / 4;
  return {
    x: 0.25 * a.x + 0.5 * cx + 0.25 * b.x,
    y: 0.25 * a.y + 0.5 * cy + 0.25 * b.y,
  };
}
