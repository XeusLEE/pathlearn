"use client";

// =============================================================
// <CosmeticPreview /> — the shop's live "preview-before-buy" stage.
//
// Centers the octopus <Mascot /> with two <Tentacle />s reaching in
// from the left and right (behind/under the body) so the equipped
// SKIN + TRAIL are visible alongside the HAT + AURA on the mascot.
//
// The preview reflects the player's CURRENT equipped cosmetics, but
// when a shop item is focused/selected we override that ONE slot with
// the selected item so the player can see it before buying. Slots that
// aren't being previewed are passed `undefined` so the underlying
// components read the equipped value from the store themselves.
//
// Cross-agent contract props consumed here:
//   • Mascot:   hatId?, skinId?, auraId?, cosmeticsEnabled?
//   • Tentacle: skinId?, trailId?, cosmeticsEnabled?
//
// Those props may not be wired up in the base components yet (the other
// agents add them), so we forward them via a loosely-typed spread — the
// same pattern PathTentacle uses for reachToTarget etc. This keeps this
// file compiling cleanly regardless of integration order.
// =============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mascot } from "@/components/gamification/Mascot";
import { Tentacle } from "@/components/gamification/Tentacle";
import type { CosmeticSlot } from "@/lib/cosmetics";
import type { EquippedCosmetics } from "@/lib/types";

export interface CosmeticPreviewProps {
  /** The player's currently equipped cosmetics. */
  equipped: EquippedCosmetics;
  /** A single slot override for preview-before-buy (null = no override). */
  preview?: { slot: CosmeticSlot; id: string } | null;
}

/**
 * Resolve, per slot, the id to show in the preview.
 *
 * Returns `undefined` for slots we are NOT explicitly previewing — the
 * Mascot/Tentacle then read the equipped value from the store. When a slot is
 * being previewed we pass the focused item's id (an explicit value, including
 * the skin default).
 */
function resolveSlotId(
  slot: CosmeticSlot,
  preview: CosmeticPreviewProps["preview"],
): string | undefined {
  if (preview && preview.slot === slot) return preview.id;
  return undefined;
}

export function CosmeticPreview({ equipped, preview }: CosmeticPreviewProps) {
  const reducedMotion = useReducedMotion();

  // The preview tentacles need a `target` so their TRAIL particles activate
  // (trails only emit when reaching). We point both at the mascot's screen
  // center, which also makes them gently curve inward — a nice preview pose.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const measure = () => {
      const el = stageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setTarget({ x: r.left + r.width / 2, y: r.top + r.height * 0.52 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Per-slot override ids (undefined = "use equipped from store").
  const { hatId, skinId, trailId, auraId } = useMemo(() => {
    return {
      hatId: resolveSlotId("hat", preview),
      skinId: resolveSlotId("skin", preview),
      trailId: resolveSlotId("trail", preview),
      auraId: resolveSlotId("aura", preview),
    };
  }, [preview]);

  // Loosely-typed prop bags so we compile against the contract even before
  // the base components add these optional props.
  const mascotCosmeticProps = {
    hatId,
    skinId,
    auraId,
    cosmeticsEnabled: true,
  } as Record<string, unknown>;

  // Pass a target (activates the trail) but keep the tentacles calm:
  // no dramatic extension, no tip cursor in the preview stage.
  const tentacleCosmeticProps = {
    skinId,
    trailId,
    cosmeticsEnabled: true,
    target,
    reachToTarget: false,
    showTipCursor: false,
  } as Record<string, unknown>;

  // The stage transitions a touch when the previewed item changes so the
  // mascot "pops" to acknowledge the swap.
  const popKey = preview ? `${preview.slot}:${preview.id}` : "equipped";

  return (
    <div
      ref={stageRef}
      className="relative flex h-56 w-full items-center justify-center overflow-visible"
    >
      {/* Soft stage glow behind the mascot. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 56%, color-mix(in srgb, var(--mascot-fill, var(--color-purple)) 18%, transparent) 0%, transparent 62%)",
        }}
      />

      {/* Left reaching tentacle — sits behind the mascot. */}
      <div
        className="pointer-events-none absolute left-0 top-1/2 z-0 -translate-y-1/2 flex items-center justify-start"
        style={{ width: 300, height: 360, overflow: "hidden" }}
      >
        <Tentacle
          anchor="left"
          length={115}
          thickness={30}
          curl="in"
          mood="wiggling"
          personality="wise"
          showSuckers
          {...tentacleCosmeticProps}
        />
      </div>

      {/* Right reaching tentacle — sits behind the mascot. */}
      <div
        className="pointer-events-none absolute right-0 top-1/2 z-0 -translate-y-1/2 flex items-center justify-end"
        style={{ width: 300, height: 360, overflow: "hidden" }}
      >
        <Tentacle
          anchor="right"
          length={115}
          thickness={30}
          curl="in"
          mood="wiggling"
          personality="playful"
          showSuckers
          {...tentacleCosmeticProps}
        />
      </div>

      {/* Center mascot — on top of the tentacles. */}
      <motion.div
        key={popKey}
        className="relative z-10"
        initial={reducedMotion ? false : { scale: 0.86, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 320, damping: 18 }
        }
      >
        <Mascot
          size={150}
          mood="happy"
          backdrop={false}
          {...mascotCosmeticProps}
        />
      </motion.div>
    </div>
  );
}
