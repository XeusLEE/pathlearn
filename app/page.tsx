"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  FileText,
  RefreshCw,
  Sparkles,
  Type,
} from "lucide-react";
import {
  Hero,
  DropZone,
  PasteText,
  SampleDocs,
  Generating,
} from "@/components/upload";
import { useApp } from "@/lib/store";
import type { GenerateRequest, GenerateResponse } from "@/lib/types";

type Tab = "file" | "paste";

const MIN_CHARS = 100;

// Snappy easing per the motion guardrails. ~180ms feels right on mobile.
const SNAPPY = [0.36, 0.07, 0.19, 0.97] as const;

export default function Page() {
  const router = useRouter();
  const setCourse = useApp((s) => s.setCourse);
  const course = useApp((s) => s.course);

  // Default to "paste" — most common user intent on a quick demo.
  const [tab, setTab] = useState<Tab>("paste");
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState("");
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: "info" | "error";
  } | null>(null);
  const [pasteJustFilled, setPasteJustFilled] = useState(false);

  const showToast = useCallback(
    (message: string, tone: "info" | "error" = "info") => {
      setToast({ message, tone });
      window.setTimeout(() => setToast(null), 2800);
    },
    []
  );

  // The text used for generation (depends on active tab).
  const activeText = tab === "file" ? fileText : pasted;
  const activeTitle =
    tab === "file"
      ? file?.name?.replace(/\.[^.]+$/, "") || "Untitled document"
      : pasted.trim().slice(0, 60) || "Pasted notes";

  const charCount = activeText.length;
  const canGenerate = charCount >= MIN_CHARS && !loading;

  const onPickFile = useCallback((f: File, text: string) => {
    setFile(f);
    setFileText(text);
  }, []);

  const onClearFile = useCallback(() => {
    setFile(null);
    setFileText("");
  }, []);

  const onPickSample = useCallback(
    (sample: { title: string; text: string }) => {
      setPasted(sample.text);
      setTab("paste");
      setPasteJustFilled(true);
      // Reset the autoFocus signal so subsequent picks re-trigger.
      window.setTimeout(() => setPasteJustFilled(false), 200);
    },
    []
  );

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setLoading(true);
    setToast(null);
    try {
      let course;
      // Static-export build (GH Pages) has no /api/generate route. Use the
      // bundled mock course directly so the demo flow still works.
      if (process.env.NEXT_PUBLIC_STATIC === "true") {
        const { MOCK_COURSE } = await import("@/lib/mock-data");
        // Pretend it took a moment so the loading UX gets a beat.
        await new Promise((resolve) => setTimeout(resolve, 1400));
        course = {
          ...MOCK_COURSE,
          id: `static-${Date.now()}`,
          documentTitle: activeTitle,
          createdAt: Date.now(),
          isDemoMode: true,
        };
      } else {
        const body: GenerateRequest = {
          title: activeTitle,
          text: activeText,
        };
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        const data = (await res.json()) as GenerateResponse;
        if (!data?.course) {
          throw new Error("Empty response");
        }
        course = data.course;
      }
      setCourse(course);
      router.push("/learn");
    } catch (err) {
      console.error(err);
      setLoading(false);
      showToast("Couldn't generate the course.", "error");
    }
  }, [canGenerate, activeText, activeTitle, router, setCourse, showToast]);

  // The cancel link inside <Generating /> can't actually abort the in-flight
  // fetch (no AbortController plumbing), but it can free the user from the
  // overlay so they can edit input or leave the screen.
  const handleCancelGenerating = useCallback(() => {
    setLoading(false);
  }, []);

  return (
    <main className="allow-bounce relative min-h-[100dvh] overflow-x-hidden bg-bg text-ink">
      {/* Single shared backdrop — replaces all the per-section blur blobs. */}
      <div
        aria-hidden
        className="dot-grid-bg pointer-events-none fixed inset-0 opacity-60"
      />

      {/* Top brand mark */}
      <header className="relative z-10 max-w-6xl mx-auto px-4 sm:px-5 md:px-8 pt-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-display text-xl font-black tracking-tight">
            Pathlearn
          </span>
        </div>
        <div className="hidden sm:inline-flex items-center gap-1.5 text-xs font-extrabold text-ink-muted bg-surface-muted border-2 border-border-soft rounded-full px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary-dark" />
          Beta
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-5 md:px-8 pb-40 md:pb-16">
        <Hero />

        {/* Card: tabs + input */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-md md:max-w-2xl mx-auto"
        >
          <div className="card-pop p-4 md:p-6 rounded-3xl">
            {/* Resume pill — only when a course exists in the store. */}
            {course && (
              <Link
                href="/learn"
                className="group mb-4 flex items-center justify-between gap-3 rounded-2xl bg-secondary-soft border-2 border-secondary/30 px-4 py-2.5 hover:border-secondary/60 transition-colors"
              >
                <span className="min-w-0 flex items-center gap-2 text-sm font-extrabold text-secondary-dark">
                  <span className="shrink-0">↩</span>
                  <span className="truncate">
                    Resume{" "}
                    <span className="text-ink">{course.documentTitle}</span>
                  </span>
                </span>
                <ArrowRight
                  className="h-4 w-4 text-secondary-dark shrink-0 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={3}
                />
              </Link>
            )}

            {/* Promoted samples — fast-path for trying the demo. */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs uppercase tracking-wider font-extrabold text-ink-soft">
                  Try a sample first
                </span>
                <ArrowRight
                  className="h-3.5 w-3.5 text-ink-soft"
                  strokeWidth={2.75}
                  aria-hidden
                />
              </div>
              <SampleDocs onPick={onPickSample} />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-surface-muted rounded-2xl border-2 border-border-soft">
              <TabButton
                active={tab === "paste"}
                onClick={() => setTab("paste")}
                icon={<Type className="h-4 w-4" strokeWidth={2.5} />}
                label="Paste text"
              />
              <TabButton
                active={tab === "file"}
                onClick={() => setTab("file")}
                icon={<FileText className="h-4 w-4" strokeWidth={2.5} />}
                label="Drop a file"
              />
            </div>

            {/* Tab content */}
            <div className="mt-4">
              <AnimatePresence initial={false}>
                {tab === "file" ? (
                  <motion.div
                    key="file-tab"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.18, ease: SNAPPY }}
                  >
                    <DropZone
                      file={file}
                      onFile={onPickFile}
                      onClear={onClearFile}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="paste-tab"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.18, ease: SNAPPY }}
                  >
                    <PasteText
                      value={pasted}
                      onChange={setPasted}
                      onTruncate={() =>
                        showToast(
                          "Capped at 50,000 characters — keeping things snappy.",
                          "info"
                        )
                      }
                      autoFocus={pasteJustFilled || tab === "paste"}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Inline status / hint */}
            <div className="mt-4 text-xs font-bold text-ink-soft min-h-[1.25rem] text-balance">
              {charCount === 0
                ? "We need ~100 characters (one paragraph) so we can find concepts."
                : charCount < MIN_CHARS
                ? `${MIN_CHARS - charCount} more characters needed…`
                : "Looks good. Generate when you're ready."}
            </div>

            {/* Inline CTA — visible on md+ */}
            <div className="hidden md:block mt-4">
              <CTAButton
                disabled={!canGenerate}
                loading={loading}
                onClick={handleGenerate}
                full
              />
            </div>
          </div>
        </motion.section>

        {/* Footer microcopy */}
        <div className="mt-10 text-center text-xs text-ink-soft font-semibold px-4 max-w-xl mx-auto">
          Without an API key you&apos;ll see a sample course. Add{" "}
          <code className="font-mono bg-surface-muted px-1.5 py-0.5 rounded">
            ANTHROPIC_API_KEY
          </code>{" "}
          to{" "}
          <code className="font-mono bg-surface-muted px-1.5 py-0.5 rounded">
            .env.local
          </code>{" "}
          to generate from your own document.
        </div>
      </div>

      {/* Sticky CTA on mobile. `sticky-footer` provides the gradient fade,
         safe-area padding, top border, and z-index; `fixed bottom-0` pins it
         to the viewport (the page is tall enough that pure sticky would
         only kick in at scroll, which feels wrong on a landing screen). */}
      <div className="md:hidden sticky-footer fixed bottom-0 inset-x-0 px-4">
        <CTAButton
          disabled={!canGenerate}
          loading={loading}
          onClick={handleGenerate}
          full
        />
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.message}
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: SNAPPY }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-40 px-4 max-w-[calc(100vw-1rem)]"
          >
            {toast.tone === "error" ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-heart text-white border-2 border-heart-dark shadow-pop-heart px-4 py-2 font-extrabold text-sm">
                <span aria-hidden>⚠️</span>
                <span className="min-w-0 flex-1">{toast.message}</span>
                <button
                  type="button"
                  onClick={() => {
                    setToast(null);
                    handleGenerate();
                  }}
                  aria-label="Try generating again"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 transition-colors px-2.5 py-1.5 text-xs min-h-[36px]"
                >
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={3} />
                  Try again
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-2xl bg-surface text-ink border-2 border-border-soft shadow-pop-soft px-4 py-3 font-extrabold text-sm">
                <span aria-hidden>💡</span>
                <span className="min-w-0 flex-1">{toast.message}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generating overlay */}
      <Generating show={loading} onCancel={handleCancelGenerating} />
    </main>
  );
}

/**
 * Custom logomark — two stacked rounded trapezoids forming an
 * upward-pointing path. Sized to sit beside the "Pathlearn" wordmark.
 */
function BrandMark() {
  return (
    <span
      aria-hidden
      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary shadow-pop-primary"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="white"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Lower trapezoid (wider) */}
        <path d="M5 18 L8 12 L16 12 L19 18 Z" />
        {/* Upper trapezoid (narrower, slightly inset) */}
        <path d="M8.5 12 L10.5 7 L13.5 7 L15.5 12 Z" />
      </svg>
    </span>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5",
        "text-sm font-extrabold transition-colors",
        active ? "text-ink" : "text-ink-soft hover:text-ink",
      ].join(" ")}
    >
      {active && (
        <motion.span
          layoutId="active-tab"
          className="absolute inset-0 rounded-xl bg-surface border-2 border-border-soft shadow-pop-soft"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
    </button>
  );
}

function CTAButton({
  disabled,
  loading,
  onClick,
  full,
}: {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "btn-pop bg-primary text-white shadow-pop-primary",
        "h-14 text-base",
        full ? "w-full" : "",
      ].join(" ")}
    >
      <span className="inline-flex items-center gap-2">
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" strokeWidth={2.75} />
            Generate course
          </>
        )}
      </span>
    </button>
  );
}
