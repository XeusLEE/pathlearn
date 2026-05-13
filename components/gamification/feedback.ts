// =============================================================
// feedback.ts — Tiny haptic + audio feedback helpers.
// Both functions are intentionally fire-and-forget and silent on
// failure (e.g. blocked autoplay, no Vibration API). Safe to call
// from anywhere; no SSR issues since they early-return when
// `window` / `navigator` are absent.
// =============================================================

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  // The Vibration API is only available in some browsers / on
  // mobile devices, so guard before calling.
  const nav = navigator as Navigator & {
    vibrate?: (p: number | number[]) => boolean;
  };
  if (typeof nav.vibrate !== "function") return;
  try {
    nav.vibrate(pattern);
  } catch {
    /* no-op */
  }
}

type ToneKind = "correct" | "wrong" | "complete";

// Lazily-created shared AudioContext so we don't spin up a new
// one on every beep.
let _ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (_ctx) return _ctx;
  const Ctor =
    (window as unknown as { AudioContext?: typeof AudioContext })
      .AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    _ctx = new Ctor();
    return _ctx;
  } catch {
    return null;
  }
}

function beep(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  gain = 0.18,
  type: OscillatorType = "sine"
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // Quick attack, exponential decay → keeps it pleasant + percussive.
  const t0 = ctx.currentTime + startOffset;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function playTone(kind: ToneKind): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    // Resume in case the context was suspended (autoplay policy).
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    if (kind === "correct") {
      // Bright A5, short.
      beep(ctx, 880, 0, 0.18, 0.2, "sine");
      beep(ctx, 1318.5, 0.06, 0.16, 0.16, "sine"); // E6 layered for sparkle
    } else if (kind === "wrong") {
      // Low buzz, square wave.
      beep(ctx, 220, 0, 0.22, 0.15, "square");
      beep(ctx, 165, 0.08, 0.22, 0.12, "square");
    } else {
      // complete — major triad arpeggio C5-E5-G5-C6.
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => beep(ctx, f, i * 0.09, 0.22, 0.18, "triangle"));
    }
  } catch {
    /* no-op */
  }
}
