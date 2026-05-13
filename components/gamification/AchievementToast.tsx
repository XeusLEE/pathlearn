"use client";

// =============================================================
// <AchievementToast /> + <ToastHost /> + useToasts()
//
// Achievement notifications that slide in from the top, hold for
// ~3s, and slide out. We expose three integration paths:
//
// 1. <AchievementToast icon title subtitle /> — simple inline use
//    (caller controls mount/unmount). Auto-dismisses after `durationMs`.
// 2. useToasts().push({ icon, title, subtitle }) — dispatches to a
//    tiny module-level event bus.
// 3. <ToastHost /> — drop once into the layout; it subscribes to
//    the bus and renders a stack of toasts.
// =============================================================

import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface ToastContent {
  icon: string;
  title: string;
  subtitle?: string;
}

interface ToastInternal extends ToastContent {
  id: number;
}

export interface AchievementToastProps extends ToastContent {
  /** ms before auto-dismiss. Default 3000. */
  durationMs?: number;
  onDismiss?: () => void;
}

// ----- Single inline toast --------------------------------------------------

export function AchievementToast({
  icon,
  title,
  subtitle,
  durationMs = 3000,
  onDismiss,
}: AchievementToastProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setOpen(false);
      onDismiss?.();
    }, durationMs);
    return () => clearTimeout(t);
  }, [durationMs, onDismiss]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="pointer-events-auto flex items-center gap-3 bg-surface border-2 border-xp shadow-pop-xp rounded-2xl pl-3 pr-5 py-3 min-w-[240px] max-w-[min(360px,calc(100vw-32px))]"
          initial={{ y: -80, opacity: 0, scale: 0.92 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -80, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          role="status"
          aria-live="polite"
        >
          <span
            className="text-3xl select-none flex-shrink-0"
            role="img"
            aria-hidden
          >
            {icon}
          </span>
          <div className="min-w-0">
            <p className="font-extrabold text-ink leading-tight truncate">
              {title}
            </p>
            {subtitle && (
              <p className="text-xs text-ink-muted leading-tight truncate">
                {subtitle}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ----- Tiny module-level event bus -----------------------------------------

type Listener = (t: ToastInternal) => void;
const listeners = new Set<Listener>();
let nextId = 0;

function emit(content: ToastContent) {
  const t: ToastInternal = { ...content, id: ++nextId };
  listeners.forEach((l) => l(t));
}

/**
 * Hook that returns a `push` function for emitting achievement toasts
 * from anywhere in the app. <ToastHost /> must be mounted somewhere
 * for the toasts to render.
 */
export function useToasts() {
  const push = useCallback((content: ToastContent) => {
    emit(content);
  }, []);
  return { push };
}

// ----- Host: subscribes to the bus, renders the stack ----------------------

export function ToastHost() {
  const [stack, setStack] = useState<ToastInternal[]>([]);

  useEffect(() => {
    const onPush: Listener = (t) => {
      setStack((s) => [...s, t]);
      // Auto-prune after 3.4s (matches AchievementToast lifetime + exit anim).
      setTimeout(() => {
        setStack((s) => s.filter((x) => x.id !== t.id));
      }, 3400);
    };
    listeners.add(onPush);
    return () => {
      listeners.delete(onPush);
    };
  }, []);

  return (
    <div
      className="fixed top-4 inset-x-0 z-[90] flex flex-col items-center gap-2 pt-safe pointer-events-none"
      aria-live="polite"
    >
      {stack.map((t) => (
        <AchievementToast
          key={t.id}
          icon={t.icon}
          title={t.title}
          subtitle={t.subtitle}
        />
      ))}
    </div>
  );
}
