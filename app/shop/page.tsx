// =============================================================
// /shop — the cosmetics shop route (Agent A).
//
// The screen itself is a client component (it reads the zustand
// store + fires confetti); this route file just mounts it.
// =============================================================

import { ShopScreen } from "@/components/shop/ShopScreen";

export const metadata = {
  title: "Cosmetics Shop · Pathlearn",
  description: "Spend your coins on hats, skins, trails, and auras for your octopus.",
};

export default function ShopPage() {
  return <ShopScreen />;
}
