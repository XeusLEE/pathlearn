"use client";

import { motion } from "framer-motion";

interface Point {
  x: number;
  y: number;
}

interface PathConnectorProps {
  /** Computed node center positions (in SVG pixel space). */
  points: Point[];
  /** Total SVG canvas width — must match the host container. */
  width: number;
  /** Total SVG canvas height — typically the height of the path column. */
  height: number;
  /** Optional stroke color override. Defaults to the soft border token. */
  stroke?: string;
  /**
   * Per-point completion. When provided, segments between two CONSECUTIVE
   * completed points get a solid colored overlay that animates in.
   */
  completed?: boolean[];
}

/**
 * Renders a single continuous SVG curve through the supplied node centers as a
 * dashed "stepping stones" trail. The curve uses quadratic beziers between
 * consecutive midpoints for smooth swooping shapes.
 *
 * Sits absolutely behind the node rows; ignores pointer events.
 *
 * If `completed[]` is supplied, each segment between two consecutive completed
 * nodes gets a solid colored overlay that animates `pathLength` from 0→1, so
 * progress visibly fills the trail as the user advances.
 */
export function PathConnector({
  points,
  width,
  height,
  stroke,
  completed,
}: PathConnectorProps) {
  if (points.length < 2) return null;

  const d = buildSmoothPath(points);

  // Per-segment completed overlays. A segment is "completed" when both
  // endpoints are completed.
  const segments: { d: string; from: number; to: number }[] = [];
  if (completed && completed.length === points.length) {
    for (let i = 0; i < points.length - 1; i++) {
      if (completed[i] && completed[i + 1]) {
        segments.push({
          d: buildSegmentPath(points, i, i + 1),
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
      {/* Faint soft underlay for a touch of depth */}
      <path
        d={d}
        fill="none"
        stroke={stroke ?? "var(--color-border-soft)"}
        strokeWidth={10}
        strokeLinecap="round"
        opacity={0.55}
      />
      {/* Dotted top — the iconic Duolingo trail */}
      <path
        d={d}
        fill="none"
        stroke={stroke ?? "var(--color-border)"}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray="0.1 14"
      />

      {/* Completed-segment overlays — animate pathLength 0→1 once visible. */}
      {segments.map((seg) => (
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
