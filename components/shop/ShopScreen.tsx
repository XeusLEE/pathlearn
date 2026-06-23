"use client";

// =============================================================
// <ShopScreen /> — the full cosmetics shop UI (Agent A).
//
// Layout (mobile-first, great at 390px):
//   • Sticky header: back link to /learn, "Cosmetics Shop" title,
//     and a self-contained coin balance chip on the right.
//   • Live preview stage (CosmeticPreview): octopus + 2 tentacles,
//     reflecting equipped cosmetics with a one-slot preview override
//     for the currently focused shop item (preview-before-buy).
//   • Category tabs (Hats / Skins / Trails / Auras) as a snap pill row.
//   • Grid of ShopItemCard for the active slot.
//
// Self-contained: renders its OWN gold coin SVG (CoinIcon) + count —
// it does NOT import a CoinPill from another agent.
// =============================================================

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import confetti from "canvas-confetti";
import { useReducedMotion } from "framer-motion";
import {
  useApp,
  selectCoins,
  selectEquipped,
  selectOwned,
} from "@/lib/store";
import {
  COSMETIC_SLOTS,
  SLOT_META,
  cosmeticsBySlot,
  getCosmetic,
  type CosmeticSlot,
} from "@/lib/cosmetics";
import { CosmeticPreview } from "./CosmeticPreview";
import { ShopItemCard } from "./ShopItemCard";

// -----------------------------------------------------------------
// Self-contained gold coin SVG. Exported so the card can reuse the
// exact same glyph without importing anything from another agent.
// -----------------------------------------------------------------
export function CoinIcon({
  size = 16,
  className,
  tone = "gold",
}: {
  size?: number;
  className?: string;
  /** "gold" = full color coin; "light" = monochrome for use on colored buttons. */
  tone?: "gold" | "light";
}) {
  if (tone === "light") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className}
        aria-hidden
        style={{ display: "inline-block", flexShrink: 0 }}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="rgba(255,255,255,0.95)"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1.5"
        />
        <text
          x="12"
          y="16.5"
          textAnchor="middle"
          fontSize="12"
          fontWeight="900"
          fill="currentColor"
        >
          $
        </text>
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" fill="#f59e0b" stroke="#b45309" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="7" fill="#fcd34d" stroke="#d97706" strokeWidth="1.2" />
      <text
        x="12"
        y="16.2"
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="900"
        fill="#b45309"
      >
        $
      </text>
    </svg>
  );
}

// -----------------------------------------------------------------
// Coin balance chip — gold coin + tabular count. Bounces on change.
// -----------------------------------------------------------------
function CoinChip({ coins, bouncing }: { coins: number; bouncing: boolean }) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border-2 border-xp/40 bg-surface px-3 py-1.5 shadow-pop-soft ${
        bouncing ? "animate-coin-bounce" : ""
      }`}
    >
      <CoinIcon size={18} />
      <span className="tabular-nums text-sm font-extrabold text-ink">
        {coins.toLocaleString()}
      </span>
    </span>
  );
}

// -----------------------------------------------------------------
// Toast — brief "Unlocked NAME!" pill.
// -----------------------------------------------------------------
function UnlockToast({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="animate-shop-pop-in pointer-events-none fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full border-2 border-xp bg-surface px-4 py-2 text-sm font-extrabold text-ink shadow-pop-xp"
    >
      <span className="mr-1">🎉</span>
      {message}
    </div>
  );
}

export function ShopScreen() {
  const reducedMotion = useReducedMotion();

  // Store state.
  const coins = useApp(selectCoins);
  const equipped = useApp(selectEquipped);
  const owned = useApp(selectOwned);
  const buyCosmetic = useApp((s) => s.buyCosmetic);
  const equipCosmetic = useApp((s) => s.equipCosmetic);

  // UI state.
  const [activeSlot, setActiveSlot] = useState<CosmeticSlot>("hat");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coinBounce, setCoinBounce] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = useMemo(() => cosmeticsBySlot(activeSlot), [activeSlot]);

  // Preview override: only when the selected item belongs to the active slot
  // (so switching tabs doesn't preview a stale item from another slot).
  const preview = useMemo(() => {
    if (!selectedId) return null;
    const item = getCosmetic(selectedId);
    if (!item || item.slot !== activeSlot) return null;
    return { slot: item.slot, id: item.id };
  }, [selectedId, activeSlot]);

  const ownedSet = useMemo(() => new Set(owned), [owned]);

  const fireConfetti = useCallback(() => {
    if (reducedMotion) return;
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.35 },
      colors: ["#f59e0b", "#fcd34d", "#fbbf24", "#7c3aed"],
      scalar: 0.9,
      disableForReducedMotion: true,
    });
  }, [reducedMotion]);

  const popBounce = useCallback(() => {
    setCoinBounce(true);
    if (bounceTimer.current) clearTimeout(bounceTimer.current);
    bounceTimer.current = setTimeout(() => setCoinBounce(false), 520);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleEquip = useCallback(
    (id: string) => {
      equipCosmetic(id);
      setSelectedId(id);
    },
    [equipCosmetic],
  );

  const handleBuy = useCallback(
    (id: string) => {
      const result = buyCosmetic(id);
      if (result.ok) {
        equipCosmetic(id);
        setSelectedId(id);
        fireConfetti();
        popBounce();
        const item = getCosmetic(id);
        showToast(`Unlocked ${item?.name ?? "cosmetic"}!`);
      }
    },
    [buyCosmetic, equipCosmetic, fireConfetti, popBounce, showToast],
  );

  return (
    <div className="dot-grid-bg flex min-h-dvh flex-col bg-bg">
      {/* ---------- Sticky header ---------- */}
      <header className="pt-safe sticky top-0 z-40 border-b-2 border-border-soft bg-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-screen-sm items-center justify-between gap-2 px-4 py-3">
          <Link
            href="/learn"
            aria-label="Back to learning"
            className="tap-target rounded-full border-2 border-border bg-surface text-ink shadow-pop-soft active:translate-y-0.5"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
          </Link>

          <h1 className="font-display text-lg font-extrabold text-ink">
            Cosmetics Shop
          </h1>

          <CoinChip coins={coins} bouncing={coinBounce} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-screen-sm flex-1 px-4 pb-safe">
        {/* ---------- Live preview stage ---------- */}
        <section className="card-pop mt-4 overflow-visible p-2">
          <CosmeticPreview equipped={equipped} preview={preview} />
          <p className="pb-1 text-center text-xs font-bold text-ink-muted">
            {preview ? (
              <>
                Previewing{" "}
                <span className="text-ink">
                  {getCosmetic(preview.id)?.name}
                </span>
              </>
            ) : (
              "Your octopus, your style"
            )}
          </p>
        </section>

        {/* ---------- Category tabs ---------- */}
        <nav
          aria-label="Cosmetic categories"
          className="snap-x-mandatory no-scrollbar mt-4 flex gap-2 overflow-x-auto scroll-touch pb-1"
        >
          {COSMETIC_SLOTS.map((slot) => {
            const meta = SLOT_META[slot];
            const active = slot === activeSlot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setActiveSlot(slot)}
                aria-pressed={active}
                className={`snap-start flex shrink-0 items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-extrabold transition-colors ${
                  active
                    ? "border-primary bg-primary text-white shadow-pop-primary"
                    : "border-border bg-surface text-ink-muted shadow-pop-soft"
                }`}
              >
                <span aria-hidden>{meta.icon}</span>
                {meta.plural}
              </button>
            );
          })}
        </nav>

        {/* ---------- Item grid ---------- */}
        <section
          aria-label={`${SLOT_META[activeSlot].plural} for sale`}
          className="mt-4 grid grid-cols-2 gap-3 pb-10 sm:grid-cols-3"
        >
          {items.map((item) => (
            <ShopItemCard
              key={item.id}
              item={item}
              isEquipped={equipped[item.slot] === item.id}
              isOwned={ownedSet.has(item.id)}
              coins={coins}
              isSelected={selectedId === item.id}
              onSelect={() => handleSelect(item.id)}
              onEquip={() => handleEquip(item.id)}
              onBuy={() => handleBuy(item.id)}
            />
          ))}
        </section>
      </main>

      {/* ---------- Toast ---------- */}
      {toast && <UnlockToast message={toast} />}
    </div>
  );
}
