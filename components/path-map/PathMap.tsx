"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { LearningPath, EpisodeResult } from "@/lib/types";
import { EpisodeNode, type EpisodeStatus } from "./EpisodeNode";
import { PathConnector } from "./PathConnector";
import { Mascot, type MascotMood } from "./Mascot";

interface PathMapProps {
  path: LearningPath;
  /** completedEpisodes record from the store (keyed by episode.id). */
  completedEpisodes: Record<string, EpisodeResult>;
}

// Layout constants — chosen to feel like a Duolingo level-select.
const COLUMN_WIDTH = 360;
const COLUMN_HALF = COLUMN_WIDTH / 2;
const NODE_DIAMETER = 80;
const NODE_RADIUS = NODE_DIAMETER / 2;
const ROW_SPACING = 150; // vertical distance between node centers
const TOP_PADDING = 56; // first node y-center inside the column
const BOTTOM_PADDING = 96; // breathing room after last node
const X_AMPLITUDE = 80; // max horizontal swing of the winding path

// Three simple decorative props rotated along the trail. Picked at index `i`
// via DECORATION_ORDER so they're stable per row but feel scattered.
type DecoKind = "cloud" | "tree" | "star";
const DECORATION_ORDER: DecoKind[] = ["cloud", "tree", "star"];

export function PathMap({ path, completedEpisodes }: PathMapProps) {
  const router = useRouter();
  const activeNodeRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const didAutoScrollRef = useRef(false);
  // Track previous completed-count so we know when an episode was just
  // completed (drives the mascot's "celebrate" mood).
  const prevCompletedCountRef = useRef<number>(
    countCompletedForPath(path, completedEpisodes)
  );
  const completedCount = countCompletedForPath(path, completedEpisodes);
  const justCompleted =
    completedCount > prevCompletedCountRef.current && completedCount > 0;

  // Compute per-episode status + winding offsets up-front.
  const layout = useMemo(() => {
    let activeAssigned = false;
    return path.episodes.map((episode, i) => {
      const completed = Boolean(completedEpisodes[episode.id]);
      let status: EpisodeStatus;
      if (completed) {
        status = "completed";
      } else if (!activeAssigned) {
        status = "active";
        activeAssigned = true;
      } else {
        status = "locked";
      }
      // Sinusoidal x-offset gives a smooth winding path.
      const offsetX = Math.round(Math.sin(i * 0.9) * X_AMPLITUDE);
      const centerX = COLUMN_HALF + offsetX;
      const centerY = TOP_PADDING + i * ROW_SPACING;
      // Boss = the LAST episode of the path AND difficulty 3 (so easy paths
      // don't get a boss treatment for a chill final ep).
      const isBoss =
        i === path.episodes.length - 1 && episode.difficulty === 3;
      return { episode, status, offsetX, centerX, centerY, isBoss, completed };
    });
  }, [path.episodes, completedEpisodes]);

  const totalHeight =
    TOP_PADDING +
    Math.max(0, path.episodes.length - 1) * ROW_SPACING +
    BOTTOM_PADDING;

  const points = useMemo(
    () => layout.map((row) => ({ x: row.centerX, y: row.centerY })),
    [layout]
  );
  const completedFlags = useMemo(
    () => layout.map((row) => row.completed),
    [layout]
  );

  const activeIndex = layout.findIndex((row) => row.status === "active");
  const lastCompletedIndex = (() => {
    for (let i = layout.length - 1; i >= 0; i--) {
      if (layout[i].status === "completed") return i;
    }
    return -1;
  })();
  // Where to perch the mascot — prefer the active node, otherwise the last
  // completed node (e.g. all done).
  const mascotIndex =
    activeIndex !== -1
      ? activeIndex
      : lastCompletedIndex !== -1
      ? lastCompletedIndex
      : 0;
  const mascotRow = layout[mascotIndex];
  const mascotSide: "left" | "right" =
    mascotRow && mascotRow.offsetX <= 0 ? "right" : "left";

  // Mascot mood: celebrate briefly when an episode just completed.
  // We re-key the Mascot via `mood` so the animation re-runs.
  const mascotMood: MascotMood = justCompleted ? "celebrate" : "idle";
  useEffect(() => {
    prevCompletedCountRef.current = completedCount;
  }, [completedCount]);

  // Auto-scroll the active node into view on first mount per path. We honor
  // the sticky header/tabs by relying on `scroll-mt-[140px]` on the active
  // node ref — `scrollIntoView({ block: 'start' })` then leaves the right gap.
  useEffect(() => {
    if (didAutoScrollRef.current) return;
    if (!activeNodeRef.current) return;
    didAutoScrollRef.current = true;
    // Defer slightly to let layout settle.
    const t = window.setTimeout(() => {
      activeNodeRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 60);
    return () => window.clearTimeout(t);
  }, [path.id]);

  // Reset the auto-scroll guard when the path changes so switching tabs
  // re-centers the active node.
  useEffect(() => {
    didAutoScrollRef.current = false;
  }, [path.id]);

  // Faded theme color used for SVG decorations + connector stroke.
  const decoFill = shadeWithAlpha(path.themeColor, 0.25);

  return (
    <div className="relative w-full">
      <motion.div
        ref={containerRef}
        layout
        className="relative mx-auto"
        // Constrain to viewport on small phones (360px screens) while keeping
        // the desktop column at 360px. The inline maxWidth wins over width.
        style={{
          width: COLUMN_WIDTH,
          maxWidth: `min(${COLUMN_WIDTH}px, calc(100vw - 32px))`,
          height: totalHeight,
        }}
      >
        {/* The continuous dotted trail (with completed-segment overlays). */}
        <PathConnector
          points={points}
          width={COLUMN_WIDTH}
          height={totalHeight}
          stroke={shadeWithAlpha(path.themeColor, 0.45)}
          completed={completedFlags}
        />

        {/* Decorative SVG props — themed to the path color. Every 3rd episode
            gets a prop on the side opposite to its node offset, cycling
            through the three SVG kinds. */}
        {layout.map((row, i) => {
          if (i % 3 !== 1) return null;
          const slot = Math.floor(i / 3) % DECORATION_ORDER.length;
          const kind = DECORATION_ORDER[slot];
          // Place the decoration on the opposite side of the node.
          const onLeft = row.offsetX > 0;
          const x = onLeft ? row.centerX - 110 : row.centerX + 110;
          const y = row.centerY - 8;
          return (
            <motion.div
              key={`deco-${i}`}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 0.95, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ duration: 0.6, delay: 0.05 * (i % 4) }}
              className="absolute z-0 select-none"
              style={{
                left: x,
                top: y,
                transform: "translate(-50%, -50%)",
              }}
              aria-hidden
            >
              <DecorationSvg kind={kind} fill={decoFill} />
            </motion.div>
          );
        })}

        {/* Episode nodes */}
        {layout.map((row, i) => {
          const isActive = row.status === "active";
          const result = completedEpisodes[row.episode.id];
          const progress = result ? Math.max(0.08, result.score / 100) : 0;
          return (
            <motion.div
              key={row.episode.id}
              initial={{ opacity: 0, scale: 0.7, y: 12 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{
                type: "spring",
                stiffness: 240,
                damping: 18,
                delay: 0.04 * i,
              }}
              className="absolute z-10 flex flex-col items-center"
              style={{
                left: row.centerX - NODE_RADIUS,
                top: row.centerY - NODE_RADIUS,
                width: NODE_DIAMETER,
              }}
            >
              <div className="relative">
                <EpisodeNode
                  ref={isActive ? activeNodeRef : undefined}
                  episode={row.episode}
                  status={row.status}
                  themeColor={path.themeColor}
                  progress={progress}
                  isBoss={row.isBoss}
                  onActivate={() =>
                    router.push(`/learn/${path.id}/${row.episode.id}`)
                  }
                />

                {/* Mascot perched next to the active (or final) node */}
                <AnimatePresence>
                  {i === mascotIndex && (
                    <Mascot
                      key={`mascot-${path.id}-${mascotMood}`}
                      themeColor={path.themeColor}
                      side={mascotSide}
                      mood={mascotMood}
                    />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

/**
 * Tiny inline SVG decorations themed to the active path. Three kinds
 * rotate — cloud / tree / star — all rendered at 36×36px for consistency.
 */
function DecorationSvg({ kind, fill }: { kind: DecoKind; fill: string }) {
  const SIZE = 36;
  if (kind === "cloud") {
    return (
      <svg width={SIZE} height={SIZE} viewBox="0 0 36 36" aria-hidden>
        {/* Three soft bumps + a base — all one fill so it reads as a flat shape. */}
        <circle cx="11" cy="20" r="7" fill={fill} />
        <circle cx="20" cy="16" r="9" fill={fill} />
        <circle cx="27" cy="21" r="6" fill={fill} />
        <rect x="8" y="20" width="22" height="6" rx="3" fill={fill} />
      </svg>
    );
  }
  if (kind === "tree") {
    return (
      <svg width={SIZE} height={SIZE} viewBox="0 0 36 36" aria-hidden>
        {/* Brown trunk, themed-color triangle canopy. */}
        <rect x="15" y="22" width="6" height="10" rx="1.5" fill="#8b5a2b" />
        <polygon points="18,4 30,26 6,26" fill={fill} />
      </svg>
    );
  }
  // star
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 36 36" aria-hidden>
      <polygon
        points="18,3 22,14 34,14 24,21 28,33 18,26 8,33 12,21 2,14 14,14"
        fill={fill}
      />
    </svg>
  );
}

function countCompletedForPath(
  path: LearningPath,
  completedEpisodes: Record<string, EpisodeResult>
): number {
  let n = 0;
  for (const ep of path.episodes) {
    if (completedEpisodes[ep.id]) n++;
  }
  return n;
}

/** Returns an rgba() string for the supplied hex with the given alpha. */
function shadeWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
