// ============================================================================
// Cosmetics catalog — the single source of truth for everything purchasable
// in the shop. Hats, skins, trails, and auras for the octopus mascot + its
// tentacles. Render components (MascotHat, MascotAura, TentacleTrail, the
// skin CSS-var resolver) switch on these IDs; the store tracks coins / owned /
// equipped against them. Keep IDs stable — they are persisted.
// ============================================================================

export type CosmeticSlot = "hat" | "skin" | "trail" | "aura";

export type CosmeticRarity = "common" | "rare" | "epic" | "legendary";

/** Four-color palette a skin paints onto the mascot + tentacles via CSS vars. */
export interface SkinPalette {
  /** Main body fill. Maps to --mascot-fill. */
  fill: string;
  /** Darker outline / shadow. Maps to --mascot-fill-dark. */
  fillDark: string;
  /** Lighter highlight. Maps to --mascot-light. */
  light: string;
  /** Accent (sparkles, cheeks). Maps to --mascot-accent. */
  accent: string;
  /** Optional second fill for gradient skins (galaxy etc.). */
  fill2?: string;
}

export interface CosmeticItem {
  id: string;
  slot: CosmeticSlot;
  name: string;
  description: string;
  rarity: CosmeticRarity;
  /** Coin price. 0 = free / owned by default. */
  price: number;
  /** Small glyph used on the shop card + as a fallback thumbnail. */
  emoji: string;
  /** Skins only — the palette painted onto the mascot. */
  palette?: SkinPalette;
}

// ----------------------------------------------------------------------------
// Default palette (Classic Purple). Components fall back to this whenever no
// skin is equipped. Mirrors the brand purple tokens in globals.css.
// ----------------------------------------------------------------------------
export const DEFAULT_SKIN_PALETTE: SkinPalette = {
  fill: "#c084fc",
  fillDark: "#9333ea",
  light: "#d8b4fe",
  accent: "#7c3aed",
};

// ----------------------------------------------------------------------------
// The catalog.
// ----------------------------------------------------------------------------
export const COSMETICS: CosmeticItem[] = [
  // ---- HATS ----------------------------------------------------------------
  {
    id: "party_hat",
    slot: "hat",
    name: "Party Hat",
    description: "Every day's a celebration.",
    rarity: "common",
    price: 60,
    emoji: "🎉",
  },
  {
    id: "beanie",
    slot: "hat",
    name: "Cozy Beanie",
    description: "Warm and ready to learn.",
    rarity: "common",
    price: 60,
    emoji: "🧶",
  },
  {
    id: "chef_hat",
    slot: "hat",
    name: "Chef's Hat",
    description: "Cooking up correct answers.",
    rarity: "common",
    price: 90,
    emoji: "👨‍🍳",
  },
  {
    id: "graduation_cap",
    slot: "hat",
    name: "Grad Cap",
    description: "Top of the class.",
    rarity: "common",
    price: 100,
    emoji: "🎓",
  },
  {
    id: "propeller",
    slot: "hat",
    name: "Propeller Cap",
    description: "Spin to win.",
    rarity: "rare",
    price: 160,
    emoji: "🚁",
  },
  {
    id: "cowboy_hat",
    slot: "hat",
    name: "Cowboy Hat",
    description: "Yeehaw, partner.",
    rarity: "rare",
    price: 170,
    emoji: "🤠",
  },
  {
    id: "flower_crown",
    slot: "hat",
    name: "Flower Crown",
    description: "Bloom where you study.",
    rarity: "rare",
    price: 190,
    emoji: "🌸",
  },
  {
    id: "top_hat",
    slot: "hat",
    name: "Dapper Top Hat",
    description: "Distinguished octopus energy.",
    rarity: "rare",
    price: 220,
    emoji: "🎩",
  },
  {
    id: "wizard_hat",
    slot: "hat",
    name: "Wizard Hat",
    description: "Knowledge is magic.",
    rarity: "epic",
    price: 380,
    emoji: "🧙",
  },
  {
    id: "halo",
    slot: "hat",
    name: "Angel Halo",
    description: "A flawless little saint.",
    rarity: "epic",
    price: 420,
    emoji: "😇",
  },
  {
    id: "crown",
    slot: "hat",
    name: "Royal Crown",
    description: "Ruler of the reef.",
    rarity: "epic",
    price: 500,
    emoji: "👑",
  },
  {
    id: "astronaut_helmet",
    slot: "hat",
    name: "Space Helmet",
    description: "To the stars and beyond.",
    rarity: "legendary",
    price: 650,
    emoji: "🚀",
  },

  // ---- SKINS ---------------------------------------------------------------
  {
    id: "skin_default",
    slot: "skin",
    name: "Classic Purple",
    description: "The original.",
    rarity: "common",
    price: 0,
    emoji: "🟣",
    palette: DEFAULT_SKIN_PALETTE,
  },
  {
    id: "skin_ocean",
    slot: "skin",
    name: "Ocean Blue",
    description: "Cool, calm, and collected.",
    rarity: "common",
    price: 120,
    emoji: "🔵",
    palette: {
      fill: "#38bdf8",
      fillDark: "#0284c7",
      light: "#7dd3fc",
      accent: "#0369a1",
    },
  },
  {
    id: "skin_slime",
    slot: "skin",
    name: "Slime Green",
    description: "Suspiciously squishy.",
    rarity: "common",
    price: 120,
    emoji: "🟢",
    palette: {
      fill: "#4ade80",
      fillDark: "#16a34a",
      light: "#86efac",
      accent: "#15803d",
    },
  },
  {
    id: "skin_candy",
    slot: "skin",
    name: "Cotton Candy",
    description: "Sweet pastel dreams.",
    rarity: "rare",
    price: 240,
    emoji: "🍬",
    palette: {
      fill: "#f0abfc",
      fillDark: "#c026d3",
      light: "#fbcfe8",
      accent: "#60a5fa",
    },
  },
  {
    id: "skin_sunset",
    slot: "skin",
    name: "Sunset",
    description: "Golden hour, all the time.",
    rarity: "rare",
    price: 260,
    emoji: "🌅",
    palette: {
      fill: "#fb7185",
      fillDark: "#e11d48",
      light: "#fda4af",
      accent: "#f97316",
      fill2: "#fb923c",
    },
  },
  {
    id: "skin_midnight",
    slot: "skin",
    name: "Midnight",
    description: "Studies after dark.",
    rarity: "rare",
    price: 280,
    emoji: "🌑",
    palette: {
      fill: "#64748b",
      fillDark: "#1e293b",
      light: "#94a3b8",
      accent: "#818cf8",
    },
  },
  {
    id: "skin_rosegold",
    slot: "skin",
    name: "Rose Gold",
    description: "Luxe and luminous.",
    rarity: "epic",
    price: 520,
    emoji: "🌹",
    palette: {
      fill: "#fda4af",
      fillDark: "#be185d",
      light: "#fecdd3",
      accent: "#f59e0b",
    },
  },
  {
    id: "skin_galaxy",
    slot: "skin",
    name: "Galaxy",
    description: "A whole cosmos in one octopus.",
    rarity: "legendary",
    price: 600,
    emoji: "🌌",
    palette: {
      fill: "#818cf8",
      fillDark: "#4f46e5",
      light: "#c7d2fe",
      accent: "#e879f9",
      fill2: "#a855f7",
    },
  },

  // ---- TRAILS (tentacle-tip particle effects) ------------------------------
  {
    id: "trail_sparkle",
    slot: "trail",
    name: "Sparkle Trail",
    description: "Leave a little shimmer.",
    rarity: "common",
    price: 100,
    emoji: "✨",
  },
  {
    id: "trail_bubbles",
    slot: "trail",
    name: "Bubble Trail",
    description: "Blub blub blub.",
    rarity: "common",
    price: 100,
    emoji: "🫧",
  },
  {
    id: "trail_hearts",
    slot: "trail",
    name: "Heart Trail",
    description: "Spreading the love.",
    rarity: "rare",
    price: 200,
    emoji: "💜",
  },
  {
    id: "trail_stars",
    slot: "trail",
    name: "Star Trail",
    description: "Reach for them.",
    rarity: "rare",
    price: 220,
    emoji: "⭐",
  },
  {
    id: "trail_fire",
    slot: "trail",
    name: "Fire Trail",
    description: "Absolutely on fire today.",
    rarity: "epic",
    price: 420,
    emoji: "🔥",
  },
  {
    id: "trail_rainbow",
    slot: "trail",
    name: "Rainbow Trail",
    description: "Taste the spectrum.",
    rarity: "legendary",
    price: 550,
    emoji: "🌈",
  },

  // ---- AURAS (ambient effects around the mascot) ---------------------------
  {
    id: "aura_glow",
    slot: "aura",
    name: "Soft Glow",
    description: "A gentle radiant halo.",
    rarity: "common",
    price: 110,
    emoji: "🔆",
  },
  {
    id: "aura_petals",
    slot: "aura",
    name: "Falling Petals",
    description: "Cherry blossoms drift by.",
    rarity: "rare",
    price: 240,
    emoji: "🌸",
  },
  {
    id: "aura_snow",
    slot: "aura",
    name: "Snowfall",
    description: "A flurry follows you.",
    rarity: "rare",
    price: 240,
    emoji: "❄️",
  },
  {
    id: "aura_confetti",
    slot: "aura",
    name: "Confetti Pop",
    description: "Bursts when you nail an answer.",
    rarity: "rare",
    price: 280,
    emoji: "🎊",
  },
  {
    id: "aura_lightning",
    slot: "aura",
    name: "Storm Aura",
    description: "Crackling with brilliance.",
    rarity: "epic",
    price: 480,
    emoji: "⚡",
  },
];

// ----------------------------------------------------------------------------
// Lookups + helpers.
// ----------------------------------------------------------------------------
export const COSMETICS_BY_ID: Record<string, CosmeticItem> = COSMETICS.reduce(
  (acc, c) => {
    acc[c.id] = c;
    return acc;
  },
  {} as Record<string, CosmeticItem>,
);

export const getCosmetic = (id: string | null | undefined): CosmeticItem | undefined =>
  id ? COSMETICS_BY_ID[id] : undefined;

export const cosmeticsBySlot = (slot: CosmeticSlot): CosmeticItem[] =>
  COSMETICS.filter((c) => c.slot === slot);

/** All slots in display order. */
export const COSMETIC_SLOTS: CosmeticSlot[] = ["hat", "skin", "trail", "aura"];

export const SLOT_META: Record<
  CosmeticSlot,
  { label: string; plural: string; icon: string }
> = {
  hat: { label: "Hat", plural: "Hats", icon: "🎩" },
  skin: { label: "Skin", plural: "Skins", icon: "🎨" },
  trail: { label: "Trail", plural: "Trails", icon: "✨" },
  aura: { label: "Aura", plural: "Auras", icon: "🌟" },
};

export const RARITY_META: Record<
  CosmeticRarity,
  { label: string; color: string; soft: string }
> = {
  common: { label: "Common", color: "#64748b", soft: "#e2e8f0" },
  rare: { label: "Rare", color: "#2563eb", soft: "#dbeafe" },
  epic: { label: "Epic", color: "#9333ea", soft: "#f3e8ff" },
  legendary: { label: "Legendary", color: "#f59e0b", soft: "#fef3c7" },
};

/** Resolve the palette for an equipped skin id (falls back to default purple). */
export const resolveSkinPalette = (
  skinId: string | null | undefined,
): SkinPalette => {
  const item = getCosmetic(skinId);
  return item?.palette ?? DEFAULT_SKIN_PALETTE;
};

/**
 * Turn a skin palette into the CSS custom properties the mascot + tentacles
 * read. Spread onto a wrapper's `style`. Both Mascot and Tentacle default
 * their colors to `var(--mascot-fill, ...)` etc., so setting these recolors
 * everything inside the wrapper.
 */
export const skinCssVars = (
  palette: SkinPalette,
): React.CSSProperties =>
  ({
    "--mascot-fill": palette.fill,
    "--mascot-fill-dark": palette.fillDark,
    "--mascot-light": palette.light,
    "--mascot-accent": palette.accent,
    "--mascot-fill-2": palette.fill2 ?? palette.fill,
  }) as React.CSSProperties;
