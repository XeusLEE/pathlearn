"use client";

import { useEffect, useRef } from "react";

interface PasteTextProps {
  value: string;
  onChange: (value: string) => void;
  /** Show a brief toast-like flash when content is auto-truncated. */
  onTruncate?: () => void;
  /** Force focus on mount (used when switching tabs). */
  autoFocus?: boolean;
}

const MAX_CHARS = 50_000;

export function PasteText({
  value,
  onChange,
  onTruncate,
  autoFocus,
}: PasteTextProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && ref.current) {
      // Defer to next tick so animation/measure is ready.
      const id = window.setTimeout(() => ref.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [autoFocus]);

  const fmt = new Intl.NumberFormat("en-US");
  const overHalf = value.length > MAX_CHARS / 2;
  const overWarn = value.length > MAX_CHARS * 0.9;

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            if (next.length > MAX_CHARS) {
              onChange(next.slice(0, MAX_CHARS));
              onTruncate?.();
            } else {
              onChange(next);
            }
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            const projected = (value + pasted).length;
            if (projected > MAX_CHARS) {
              // Let the browser handle the paste, then we'll truncate via onChange.
              window.setTimeout(() => onTruncate?.(), 0);
            }
          }}
          placeholder="Paste an article, your notes, a textbook chapter…"
          inputMode="text"
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          className={[
            "w-full resize-none rounded-2xl bg-surface-muted",
            "border-2 border-border-soft focus:border-primary",
            "p-4 text-base font-medium text-ink placeholder:text-ink-soft",
            "outline-none transition-colors",
            "min-h-[120px] sm:min-h-[200px]",
          ].join(" ")}
        />
      </div>
      <div
        className={[
          "flex justify-end text-xs font-bold tabular-nums",
          overWarn
            ? "text-heart-dark"
            : overHalf
            ? "text-streak-dark"
            : "text-ink-soft",
        ].join(" ")}
      >
        {fmt.format(value.length)} / {fmt.format(MAX_CHARS)}
      </div>
    </div>
  );
}

export { MAX_CHARS };
