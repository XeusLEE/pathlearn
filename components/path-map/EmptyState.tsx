"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Upload, Sparkles } from "lucide-react";
import { Mascot } from "@/components/gamification";

/**
 * Shown when there's no course in the store. Encourages the user to head back
 * to `/` and upload a document.
 */
export function EmptyState() {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-bg pt-safe pb-safe">
      {/* Subtle dot-grid backdrop (replaces layered blur blobs). */}
      <div
        aria-hidden
        className="dot-grid-bg pointer-events-none absolute inset-0 opacity-60"
      />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          className="relative mb-8"
        >
          {/* Glow disc */}
          <div className="absolute inset-0 -z-10 rounded-full bg-primary-soft blur-2xl" />
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-surface border-2 border-border shadow-pop">
            <Mascot size={108} mood="wave" backdrop={false} />
          </div>
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.25, type: "spring", stiffness: 280 }}
            className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full bg-xp text-ink shadow-pop-xp"
          >
            <Sparkles className="h-5 w-5" strokeWidth={3} />
          </motion.div>
        </motion.div>

        <motion.h1
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="font-display text-3xl font-extrabold tracking-tight text-ink"
        >
          No course yet
        </motion.h1>
        <motion.p
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mt-3 text-base leading-relaxed text-ink-muted"
        >
          Upload any document and we&rsquo;ll spin up a winding path of bite-sized
          quests for you.
        </motion.p>

        <motion.div
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.22 }}
          className="mt-8 w-full"
        >
          <Link
            href="/"
            className="btn-pop w-full bg-primary text-white shadow-pop-primary border-primary-dark"
          >
            <Upload className="mr-2 h-5 w-5" strokeWidth={3} />
            Upload a document
          </Link>
        </motion.div>

        <p className="mt-5 text-xs text-ink-soft">
          Paste your notes, or drop a <code className="font-mono text-[0.7rem]">.txt</code>, <code className="font-mono text-[0.7rem]">.md</code>, or <code className="font-mono text-[0.7rem]">.pdf</code> file.
        </p>
      </div>
    </div>
  );
}
