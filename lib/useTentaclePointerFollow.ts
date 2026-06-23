"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useTentaclePointerFollow
 *
 * Delegated pointer tracking that stamps the currently hovered/clicked
 * interactive element with a singleton `data-tentacle-focus` attribute and
 * exposes a CSS selector + active flag so any tentacle wrapper can reach
 * its tip directly onto the item the user is interacting with.
 *
 * Behavior mirrors the reference SVG prototype:
 *   • Hover an interactive element → tip follows live.
 *   • Click an interactive element → tip locks on for ~1.3s so the tap
 *     reads as acknowledged even if the pointer drifts away.
 *   • When idle, the focus clears and tentacles revert to their default
 *     targeting.
 *
 * Route-change safety: the hook clears the focus + resets state on unmount
 * and watches for the focused element being removed from the DOM (which
 * happens during client-side navigations). This prevents stale targeting
 * that would break the tentacles when moving between /learn and episode pages.
 *
 * Reduced-motion users are skipped entirely (no follow logic runs).
 *
 * Returns a stable descriptor object; consumers feed `selector` into a
 * PathTentacle / QuizTentacle `targetSelector` and gate the reach flags on
 * `active`.
 */
export interface PointerFollowState {
  /** CSS selector that resolves to the currently focused element, or null. */
  selector: string | null;
  /** True while a hover or click-lock is actively focusing an element. */
  active: boolean;
  /** Monotonic timestamp of the last focus change (use as eventTimestamp). */
  ts: number;
}

const FOCUS_ATTR = "data-tentacle-focus";
const FOCUS_SELECTOR = `[${FOCUS_ATTR}]`;

/**
 * Selector for elements the tentacle should reach toward. Broad enough to
 * cover every interactive surface in the app — quiz options, buttons, tabs,
 * links, inputs, episode nodes, etc.
 */
const INTERACTIVE_SELECTOR =
  "[data-episode-id], [data-quiz-option], button, a, [role='tab'], [role='button'], .tap-target, input, select, textarea, summary, label";

/** Remove every stamped attribute from the document. */
function clearAllFocusAttrs() {
  document
    .querySelectorAll(FOCUS_SELECTOR)
    .forEach((n) => n.removeAttribute(FOCUS_ATTR));
}

export function useTentaclePointerFollow(enabled: boolean): PointerFollowState {
  const [state, setState] = useState<PointerFollowState>({
    selector: null,
    active: false,
    ts: 0,
  });
  const clickLockUntilRef = useRef<number>(0);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    // On mount, clear any stale focus attributes left by a previous page
    // (e.g. when navigating from /learn to an episode page without a refresh).
    clearAllFocusAttrs();

    const stamp = (el: HTMLElement) => {
      clearAllFocusAttrs();
      el.setAttribute(FOCUS_ATTR, "");
      setState({ selector: FOCUS_SELECTOR, active: true, ts: Date.now() });
    };

    const clearFocus = () => {
      if (Date.now() < clickLockUntilRef.current) return; // click-locked
      clearAllFocusAttrs();
      setState((prev) =>
        prev.active
          ? { selector: null, active: false, ts: Date.now() }
          : prev,
      );
    };

    const findItem = (el: HTMLElement | null): HTMLElement | null => {
      if (!el) return null;
      return el.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
    };

    const onPointerOver = (e: PointerEvent) => {
      const item = findItem(e.target as HTMLElement | null);
      if (item) stamp(item);
    };
    const onPointerOut = (e: PointerEvent) => {
      const item = findItem(e.target as HTMLElement | null);
      if (!item) return;
      // Don't clear if we just moved into a child of the same item.
      const related = e.relatedTarget as HTMLElement | null;
      if (related && item.contains(related)) return;
      clearFocus();
    };
    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest(
        INTERACTIVE_SELECTOR,
      ) as HTMLElement | null;
      if (!target) return;
      stamp(target);
      clickLockUntilRef.current = Date.now() + 1300;
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
      revertTimerRef.current = setTimeout(() => {
        clickLockUntilRef.current = 0;
        clearFocus();
      }, 1350);
    };

    // rAF guard: if the focused element disappears from the DOM (happens
    // during client-side route changes), reset state immediately. This is
    // simpler and cheaper than a MutationObserver — we just check once per
    // frame while active.
    let rafCheck = 0;
    const checkStale = () => {
      if (document.querySelector(FOCUS_SELECTOR) === null) {
        clickLockUntilRef.current = 0;
        setState((prev) =>
          prev.active
            ? { selector: null, active: false, ts: Date.now() }
            : prev,
        );
      }
      rafCheck = requestAnimationFrame(checkStale);
    };
    rafCheck = requestAnimationFrame(checkStale);

    window.addEventListener("pointerover", onPointerOver, { passive: true });
    window.addEventListener("pointerout", onPointerOut, { passive: true });
    window.addEventListener("click", onClick, { passive: true });

    return () => {
      window.removeEventListener("pointerover", onPointerOver);
      window.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("click", onClick);
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
      cancelAnimationFrame(rafCheck);
      // Critical: clear stale focus + reset state on unmount so the next
      // page doesn't inherit a broken targeting state.
      clearAllFocusAttrs();
      setState({ selector: null, active: false, ts: 0 });
    };
  }, [enabled]);

  return state;
}
