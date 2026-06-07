"use client";

// =============================================================
// <ShopItemCard /> — a single purchasable cosmetic tile.
//
// Renders a rarity-themed card with an emoji thumbnail, name, price
// row, and an action button driven by a small state machine:
//
//   equipped-in-slot            → "Equipped"  (disabled + check)
//   owned, not equipped         → "Equip"     (equipCosmetic)
//   not owned, coins >= price   → "Buy {price}" (buy → on ok equip + celebrate)
//   not owned, coins <  price   → "Need N more" (disabled)
//   free / price 0              → "FREE" / "Owned" handled via the above
//
// Tapping the card BODY selects the item for the live preview stage.
// The action button is a separate hit target so a tap on it doesn't
// also re-select (though selecting again is harmless).
// =============================================================

import { Check, Lock } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import {
  RARITY_META,
  type CosmeticItem,
} from "@/lib/cosmetics";
import { CoinIcon } from "./ShopScreen";

export interface ShopItemCardProps {
  item: CosmeticItem;
  /** Is this item equipped in its slot right now? */
  isEquipped: boolean;
  /** Does the player own this item? */
  isOwned: boolean;
  /** Current coin balance — drives affordability. */
  coins: number;
  /** Is this card the currently selected/previewed item? */
  isSelected: boolean;
  /** Tap the card body → select for preview. */
  onSelect: () => void;
  /** Equip an already-owned cosmetic. */
  onEquip: () => void;
  /** Attempt a purchase (parent handles celebrate + equip on success). */
  onBuy: () => void;
}

export function ShopItemCard({
  item,
  isEquipped,
  isOwned,
  coins,
  isSelected,
  onSelect,
  onEquip,
  onBuy,
}: ShopItemCardProps) {
  const reducedMotion = useReducedMotion();
  const rarity = RARITY_META[item.rarity];
  const isFree = item.price === 0;
  const canAfford = coins >= item.price;
  const shortfall = Math.max(0, item.price - coins);

  // Action button state machine.
  type ActionState = "equipped" | "equip" | "buy" | "need";
  const action: ActionState = isEquipped
    ? "equipped"
    : isOwned
    ? "equip"
    : canAfford
    ? "buy"
    : "need";

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (action === "equip") onEquip();
    else if (action === "buy") onBuy();
    // "equipped" + "need" are disabled — no-op.
  };

  // The card body is a role=button div (not a real <button>) so the real
  // Equip/Buy <button>s can live inside it without nesting interactive
  // controls. Keyboard-select only fires when focus is on the card itself.
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={isSelected}
      aria-label={`${item.name}, ${rarity.label}${
        isOwned ? ", owned" : `, ${item.price} coins`
      }`}
      initial={false}
      whileTap={reducedMotion ? undefined : { scale: 0.97 }}
      className="card-pop relative flex cursor-pointer flex-col items-center gap-2 p-3 text-center transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      style={{
        borderColor: isSelected ? rarity.color : undefined,
        boxShadow: isSelected
          ? `0 0 0 2px ${rarity.color}, 0 4px 0 0 ${rarity.color}`
          : undefined,
      }}
    >
      {/* Rarity badge — top-left ribbon. */}
      <span
        className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
        style={{ background: rarity.soft, color: rarity.color }}
      >
        {rarity.label}
      </span>

      {/* Equipped check — top-right. */}
      {isEquipped && (
        <span
          className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-white"
          style={{ background: rarity.color }}
          aria-hidden
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
        </span>
      )}

      {/* Emoji thumbnail on a rarity-tinted disc. */}
      <span
        className="mt-3 flex h-16 w-16 items-center justify-center rounded-full text-3xl"
        style={{
          background: `color-mix(in srgb, ${rarity.color} 14%, var(--color-surface-muted))`,
          border: `2px solid ${rarity.soft}`,
        }}
        aria-hidden
      >
        {item.emoji}
      </span>

      {/* Name. */}
      <span className="line-clamp-1 text-sm font-extrabold text-ink">
        {item.name}
      </span>

      {/* Price row. */}
      <span className="flex items-center justify-center gap-1 text-xs font-bold text-ink-muted">
        {isOwned ? (
          <span className="text-ink-soft">Owned</span>
        ) : isFree ? (
          <span className="font-extrabold text-emerald-600">FREE</span>
        ) : (
          <>
            <CoinIcon size={13} />
            <span className="tabular-nums text-ink">{item.price}</span>
          </>
        )}
      </span>

      {/* Action button. */}
      {action === "equipped" && (
        <span
          className="btn-pop w-full cursor-default !py-2 !text-xs"
          style={{
            background: "var(--color-surface-muted)",
            color: rarity.color,
            border: `2px solid ${rarity.soft}`,
            boxShadow: "none",
          }}
        >
          <Check className="mr-1 h-3.5 w-3.5" strokeWidth={3.5} />
          Equipped
        </span>
      )}

      {action === "equip" && (
        <button
          type="button"
          onClick={handleAction}
          className="btn-pop w-full bg-primary text-white shadow-pop-primary !py-2 !text-xs"
        >
          Equip
        </button>
      )}

      {action === "buy" && (
        <button
          type="button"
          onClick={handleAction}
          className="btn-pop w-full bg-xp text-white shadow-pop-xp !py-2 !text-xs"
        >
          <CoinIcon size={13} className="mr-1" tone="light" />
          Buy {item.price}
        </button>
      )}

      {action === "need" && (
        <span
          className="btn-pop w-full cursor-not-allowed !py-2 !text-xs"
          style={{
            background: "var(--color-surface-muted)",
            color: "var(--color-ink-soft)",
            border: "2px solid var(--color-border)",
            boxShadow: "none",
            opacity: 0.85,
          }}
        >
          <Lock className="mr-1 h-3.5 w-3.5" strokeWidth={3} />
          Need {shortfall} more
        </span>
      )}
    </motion.div>
  );
}
