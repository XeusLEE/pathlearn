"use client";

import { motion } from "framer-motion";
import { Mascot } from "@/components/gamification";

/**
 * Top hero block: bold display headline, subhead, mascot, and a deliberate
 * preview of the path map (desktop only). The page-level dot-grid backdrop
 * sits behind everything — no per-component blob decoration here.
 */
export function Hero() {
  return (
    <section className="compact-landscape-hero relative pt-8 pb-6 md:pt-16 md:pb-10">
      <div className="relative grid gap-6 md:gap-8 md:grid-cols-[1.15fr_1fr] md:items-center">
        {/* Left — copy + mascot. Children stagger-in via parent variants. */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: {
              transition: { staggerChildren: 0.06, delayChildren: 0 },
            },
          }}
          className="text-center md:text-left"
        >
          {/* Mascot — the purple octopus */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0 },
            }}
            className="mx-auto md:mx-0 mb-5 inline-flex relative compact-landscape-mascot"
          >
            <div
              className="absolute inset-0 rounded-full blur-xl opacity-50"
              style={{
                background:
                  "radial-gradient(closest-side, #ce82ff, transparent 70%)",
              }}
              aria-hidden
            />
            <Mascot size={84} mood="happy" />
          </motion.div>

          <motion.h1
            variants={{
              hidden: { opacity: 0, y: 14 },
              show: { opacity: 1, y: 0 },
            }}
            className="font-display text-[1.875rem] xs:text-[2.25rem] sm:text-5xl md:text-7xl lg:text-8xl font-black text-ink leading-[1.04] text-balance break-words [hyphens:auto]"
          >
            Turn boring notes into{" "}
            <span className="relative inline-block">
              <span className="relative z-10">a 5-minute quiz.</span>
              <span
                aria-hidden
                className="absolute left-0 right-0 bottom-1 md:bottom-2 h-3 md:h-4 bg-primary/40 rounded-md -z-0"
              />
            </span>
          </motion.h1>

          <motion.p
            variants={{
              hidden: { opacity: 0, y: 12 },
              show: { opacity: 1, y: 0 },
            }}
            className="mt-5 text-base md:text-lg text-ink-muted font-semibold max-w-xl mx-auto md:mx-0 text-balance"
          >
            Drop a doc. Get a Duolingo-style learning path with paths, episodes,
            and quizzes — ready in about 20 seconds.
          </motion.p>

          {/* Honest one-liner replacing the deleted decorative chips. */}
          <motion.p
            variants={{
              hidden: { opacity: 0, y: 8 },
              show: { opacity: 1, y: 0 },
            }}
            className="mt-3 text-xs md:text-sm font-bold text-ink-soft"
          >
            Demo course included · No signup · Works on your phone
          </motion.p>
        </motion.div>

        {/* Right — tilted path preview (desktop+) */}
        <motion.div
          initial={{ opacity: 0, x: 30, rotate: -2 }}
          animate={{ opacity: 1, x: 0, rotate: 4 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="hidden md:block"
        >
          <PathPreview />
        </motion.div>
      </div>
    </section>
  );
}

/**
 * Desktop hero preview — represents what the product produces:
 * three episode nodes with completed (gold ring), active (pulse),
 * and locked states. Larger and more deliberate than the original mock.
 */
function PathPreview() {
  return (
    <div className="relative card-pop p-6 rounded-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
            Preview
          </div>
          <div className="font-display font-extrabold text-ink text-lg leading-tight">
            Path 1 · Foundations
          </div>
        </div>
        <span className="inline-flex items-center gap-1 bg-xp/15 text-xp-dark px-2.5 py-1 rounded-full text-xs font-extrabold">
          +120 XP
        </span>
      </div>

      <svg
        viewBox="0 0 280 320"
        className="w-full h-auto"
        aria-hidden
      >
        <defs>
          <linearGradient id="pl-dash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cfd3d8" />
            <stop offset="100%" stopColor="#eef0f3" />
          </linearGradient>
          <radialGradient id="pl-active-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#1cb0f6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#1cb0f6" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Connecting wavy path */}
        <path
          d="M 70 50 C 220 80, 60 150, 210 190 S 70 280, 210 290"
          fill="none"
          stroke="url(#pl-dash)"
          strokeWidth="6"
          strokeDasharray="2 12"
          strokeLinecap="round"
        />

        {/* Node 1 — completed, with gold "perfect" ring */}
        <g transform="translate(70 50)">
          <circle r="34" fill="none" stroke="#ffc800" strokeWidth="3" />
          <circle r="28" fill="#58cc02" />
          <circle
            r="28"
            fill="none"
            stroke="#4ba802"
            strokeWidth="3"
            transform="translate(0 4)"
            opacity="0.25"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="22"
            fill="white"
            fontWeight="900"
          >
            ✓
          </text>
        </g>
        <text
          x="70"
          y="100"
          textAnchor="middle"
          fontSize="10"
          fontWeight="800"
          fill="#6b7785"
          style={{ letterSpacing: "0.06em" }}
        >
          DONE · 100%
        </text>

        {/* Node 2 — active, with soft pulse glow */}
        <g transform="translate(210 190)">
          <circle r="44" fill="url(#pl-active-glow)">
            <animate
              attributeName="r"
              values="36;48;36"
              dur="1.8s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.65;0.15;0.65"
              dur="1.8s"
              repeatCount="indefinite"
            />
          </circle>
          <circle r="30" fill="#1cb0f6" />
          <circle
            r="30"
            fill="none"
            stroke="#0e8fcc"
            strokeWidth="3"
            transform="translate(0 4)"
            opacity="0.25"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="26"
          >
            🚀
          </text>
        </g>
        <text
          x="210"
          y="244"
          textAnchor="middle"
          fontSize="10"
          fontWeight="800"
          fill="#0e8fcc"
          style={{ letterSpacing: "0.06em" }}
        >
          IN PROGRESS
        </text>

        {/* Node 3 — locked */}
        <g transform="translate(70 290)">
          <circle r="26" fill="#eef0f3" />
          <circle
            r="26"
            fill="none"
            stroke="#cfd3d8"
            strokeWidth="3"
            transform="translate(0 4)"
            opacity="0.7"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="20"
          >
            🔒
          </text>
        </g>
      </svg>

      <div className="mt-4 flex justify-between items-center text-[11px] font-extrabold text-ink-soft uppercase tracking-[0.14em]">
        <span>1 / 3 episodes</span>
        <span className="text-primary-dark">Live preview</span>
      </div>
    </div>
  );
}
