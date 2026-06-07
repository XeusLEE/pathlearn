"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AchievementId,
  AchievementInfo,
  Course,
  EpisodeResult,
  EquippedCosmetics,
  ProgressState,
} from "./types";
import { getCosmetic, COSMETICS } from "./cosmetics";

const MAX_HEARTS = 5;
const HEART_REFILL_MS = 30 * 60 * 1000;
const DAILY_GOAL_DEFAULT = 30;
/** Coins granted to brand-new players so the shop feels reachable immediately. */
const STARTING_COINS = 120;

// ----------------------------------------------------------------------------
// DEMO UNLOCK — the deployed prototype ships with every cosmetic already owned
// and a generous coin balance, so visitors can play dress-up immediately
// without grinding. Flip DEMO_UNLOCK_ALL to false to restore the earn-it
// economy (default owned = just the free skin, start with STARTING_COINS).
// ----------------------------------------------------------------------------
const DEMO_UNLOCK_ALL = true;
const ALL_COSMETIC_IDS = COSMETICS.map((c) => c.id);
const DEMO_COINS = 99999;

const defaultOwned = () =>
  DEMO_UNLOCK_ALL ? [...ALL_COSMETIC_IDS] : ["skin_default"];
const defaultCoins = () => (DEMO_UNLOCK_ALL ? DEMO_COINS : STARTING_COINS);

const DEFAULT_EQUIPPED: EquippedCosmetics = {
  hat: null,
  skin: "skin_default",
  trail: null,
  aura: null,
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const yesterdayISO = () =>
  new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

interface AppState extends ProgressState {
  course: Course | null;
  /** True once the persisted state has rehydrated from localStorage. */
  hasHydrated: boolean;

  /**
   * Set the active course. If the new course id differs from the current one,
   * orphaned episode progress is cleared (avoids the stale-completion bug
   * where a brand-new course shows pre-completed episodes).
   */
  setCourse: (course: Course | null) => void;

  /**
   * Best-score-wins. Returns rich result so callers can animate XP/level/streak
   * gains and surface achievements.
   */
  recordEpisodeComplete: (
    episodeId: string,
    score: number,
    baseXp: number,
    opts?: { pathEpisodeIds?: string[]; allCourseEpisodeIds?: string[] }
  ) => EpisodeCompletionResult;

  loseHeart: () => void;
  refillHeart: () => void;
  refillAllHearts: () => void;

  setDailyGoal: (n: number) => void;

  // -------- Coins & cosmetics --------
  /** Add coins to the balance (e.g. live combo rewards). Clamped at >= 0. */
  earnCoins: (amount: number) => void;
  /** Attempt a purchase. Validates catalog, ownership, and balance. */
  buyCosmetic: (id: string) => BuyResult;
  /** Equip an owned cosmetic into its slot. No-op if not owned/unknown. */
  equipCosmetic: (id: string) => void;
  /** Clear a slot. Skin falls back to the default skin (never empty). */
  unequipSlot: (slot: keyof EquippedCosmetics) => void;

  resetAll: () => void;
}

export interface BuyResult {
  ok: boolean;
  reason?: "owned" | "insufficient" | "unknown";
  /** Coin balance after the attempt. */
  balance: number;
}

export interface EpisodeCompletionResult {
  xpAwarded: number;
  previous: EpisodeResult | null;
  leveledUp: boolean;
  newLevel: number;
  prevLevel: number;
  achievementsUnlocked: AchievementId[];
  streakBumped: boolean;
  /** Did this episode push xpToday past dailyGoal for the first time today? */
  hitDailyGoal: boolean;
  /** True if the episode was already completed before this attempt. */
  wasReplay: boolean;
  /** True if this attempt strictly improved on the previous best. */
  isPersonalBest: boolean;
  /** Coins earned from this episode completion (separate from live combos). */
  coinsAwarded: number;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      course: null,
      completedEpisodes: {},
      xp: 0,
      streak: 0,
      lastStudyDate: "",
      hearts: MAX_HEARTS,
      heartsRefillAt: 0,
      xpToday: 0,
      lastXpDate: "",
      dailyGoal: DAILY_GOAL_DEFAULT,
      streakShields: 0,
      lastShieldGrantedDate: "",
      earnedAchievements: [],
      coins: defaultCoins(),
      ownedCosmetics: defaultOwned(),
      equipped: DEFAULT_EQUIPPED,
      hasHydrated: false,

      setCourse: (course) =>
        set((s) => {
          // If switching to a different course (or clearing), drop orphaned
          // episode results so a fresh course doesn't inherit completion state
          // from collisions like both having episode id "p1-e1".
          const sameCourse =
            course && s.course && course.id === s.course.id;
          return {
            course,
            completedEpisodes: sameCourse ? s.completedEpisodes : {},
          };
        }),

      recordEpisodeComplete: (episodeId, score, baseXp, opts) => {
        const state = get();
        const td = todayISO();
        const ystd = yesterdayISO();

        const previous = state.completedEpisodes[episodeId] ?? null;
        const wasReplay = !!previous;
        const isFirstClear = !wasReplay;
        const isImprovement = !!previous && score > previous.score;
        const isPersonalBest = isFirstClear || isImprovement;

        // XP awarding rules:
        //   First clear: baseXp + accuracy bonus (up to +10)
        //   Improvement: half baseXp (capped at +15)
        //   Same / lower: 0
        const xpAwarded = isFirstClear
          ? baseXp + Math.round((score / 100) * 10)
          : isImprovement
          ? Math.min(15, Math.round(baseXp / 2))
          : 0;

        // Daily XP rollover
        const xpTodayBefore =
          state.lastXpDate === td ? state.xpToday : 0;
        const xpTodayAfter = xpTodayBefore + xpAwarded;
        const hitDailyGoal =
          xpTodayBefore < state.dailyGoal &&
          xpTodayAfter >= state.dailyGoal;

        // Streak rules:
        //   Same day → unchanged.
        //   Yesterday → +1.
        //   Older → consume a shield (keep streak +1) OR reset to 1.
        let newStreak = state.streak;
        let streakBumped = false;
        let consumedShield = false;
        if (state.lastStudyDate !== td) {
          if (state.lastStudyDate === ystd) {
            newStreak = state.streak + 1;
            streakBumped = true;
          } else if (state.lastStudyDate === "" || state.streak === 0) {
            newStreak = 1;
            streakBumped = true;
          } else if (state.streakShields > 0) {
            newStreak = state.streak + 1;
            consumedShield = true;
            streakBumped = true;
          } else {
            newStreak = 1;
            streakBumped = true;
          }
        }

        // Auto-grant a shield on every 7-day streak milestone (max 2).
        let newShields = consumedShield
          ? Math.max(0, state.streakShields - 1)
          : state.streakShields;
        let newShieldDate = state.lastShieldGrantedDate;
        const justHitMilestone =
          streakBumped &&
          newStreak > 0 &&
          newStreak % 7 === 0 &&
          state.lastShieldGrantedDate !== td &&
          newShields < 2;
        if (justHitMilestone) {
          newShields = Math.min(2, newShields + 1);
          newShieldDate = td;
        }

        // Level-up detection
        const prevLevel = selectXpLevel(state.xp).level;
        const newXp = state.xp + xpAwarded;
        const newLevel = selectXpLevel(newXp).level;
        const leveledUp = newLevel > prevLevel;

        // Update episode result (best-score-wins)
        const newResult: EpisodeResult =
          previous && previous.score >= score
            ? previous
            : { score, completedAt: Date.now() };
        const newCompleted = {
          ...state.completedEpisodes,
          [episodeId]: newResult,
        };

        // Achievements
        const before = state;
        const after = {
          ...state,
          xp: newXp,
          streak: newStreak,
          xpToday: xpTodayAfter,
          completedEpisodes: newCompleted,
        };
        const achievementsUnlocked = detectNewAchievements(before, after, {
          isFirstClear,
          isPerfect: score >= 100,
          hitDailyGoal,
          pathEpisodeIds: opts?.pathEpisodeIds,
          allCourseEpisodeIds: opts?.allCourseEpisodeIds,
        });
        const newEarned = achievementsUnlocked.length
          ? Array.from(
              new Set([...state.earnedAchievements, ...achievementsUnlocked])
            )
          : state.earnedAchievements;

        // Coins: episode + accuracy on first clear, smaller on improvement,
        // plus perfect / achievement / daily-goal bonuses. Live in-quiz combo
        // coins are awarded separately via earnCoins() from the quiz player.
        let coinsAwarded = 0;
        if (isFirstClear) {
          coinsAwarded += 10 + Math.round((score / 100) * 10);
          if (score >= 100) coinsAwarded += 10; // perfect bonus
        } else if (isImprovement) {
          coinsAwarded += 5;
        }
        coinsAwarded += achievementsUnlocked.length * 20;
        if (hitDailyGoal) coinsAwarded += 25;

        set({
          completedEpisodes: newCompleted,
          xp: newXp,
          streak: newStreak,
          lastStudyDate: td,
          xpToday: xpTodayAfter,
          lastXpDate: td,
          streakShields: newShields,
          lastShieldGrantedDate: newShieldDate,
          earnedAchievements: newEarned,
          coins: state.coins + coinsAwarded,
        });

        return {
          xpAwarded,
          previous,
          leveledUp,
          newLevel,
          prevLevel,
          achievementsUnlocked,
          streakBumped,
          hitDailyGoal,
          wasReplay,
          isPersonalBest,
          coinsAwarded,
        };
      },

      loseHeart: () =>
        set((s) => {
          const newHearts = Math.max(0, s.hearts - 1);
          const refillAt =
            newHearts < MAX_HEARTS && !s.heartsRefillAt
              ? Date.now() + HEART_REFILL_MS
              : s.heartsRefillAt;
          return { hearts: newHearts, heartsRefillAt: refillAt };
        }),

      refillHeart: () =>
        set((s) => {
          const newHearts = Math.min(MAX_HEARTS, s.hearts + 1);
          return {
            hearts: newHearts,
            heartsRefillAt:
              newHearts >= MAX_HEARTS ? 0 : Date.now() + HEART_REFILL_MS,
          };
        }),

      refillAllHearts: () => set({ hearts: MAX_HEARTS, heartsRefillAt: 0 }),

      setDailyGoal: (n) =>
        set({ dailyGoal: Math.max(10, Math.min(200, Math.round(n))) }),

      // -------- Coins & cosmetics --------
      earnCoins: (amount) =>
        set((s) => ({ coins: Math.max(0, s.coins + Math.round(amount)) })),

      buyCosmetic: (id) => {
        const state = get();
        const item = getCosmetic(id);
        if (!item) {
          return { ok: false, reason: "unknown", balance: state.coins };
        }
        if (state.ownedCosmetics.includes(id)) {
          return { ok: false, reason: "owned", balance: state.coins };
        }
        if (state.coins < item.price) {
          return { ok: false, reason: "insufficient", balance: state.coins };
        }
        const balance = state.coins - item.price;
        set({
          coins: balance,
          ownedCosmetics: [...state.ownedCosmetics, id],
        });
        return { ok: true, balance };
      },

      equipCosmetic: (id) =>
        set((s) => {
          const item = getCosmetic(id);
          if (!item || !s.ownedCosmetics.includes(id)) return s;
          return { equipped: { ...s.equipped, [item.slot]: id } };
        }),

      unequipSlot: (slot) =>
        set((s) => ({
          equipped: {
            ...s.equipped,
            [slot]: slot === "skin" ? "skin_default" : null,
          },
        })),

      resetAll: () =>
        set({
          course: null,
          completedEpisodes: {},
          xp: 0,
          streak: 0,
          lastStudyDate: "",
          hearts: MAX_HEARTS,
          heartsRefillAt: 0,
          xpToday: 0,
          lastXpDate: "",
          dailyGoal: DAILY_GOAL_DEFAULT,
          streakShields: 0,
          lastShieldGrantedDate: "",
          earnedAchievements: [],
          coins: defaultCoins(),
          ownedCosmetics: defaultOwned(),
          equipped: DEFAULT_EQUIPPED,
        }),
    }),
    {
      name: "pathlearn-state-v3",
      storage: createJSONStorage(() => localStorage),
      // Migrate older persisted state: fill any missing field with a default so
      // returning players don't crash. v4 also force-grants the full cosmetics
      // catalog when DEMO_UNLOCK_ALL is on, so every returning visitor lands on
      // the deployed "everything unlocked" state.
      version: 4,
      migrate: (persisted: unknown, _version) => {
        const state = (persisted ?? {}) as Partial<AppState>;
        const persistedOwned = state.ownedCosmetics ?? ["skin_default"];
        // Demo unlock: own everything; otherwise just ensure the free skin.
        const owned = DEMO_UNLOCK_ALL
          ? [...ALL_COSMETIC_IDS]
          : persistedOwned.includes("skin_default")
          ? persistedOwned
          : ["skin_default", ...persistedOwned];
        const migratedCoins =
          Number.isFinite(state.coins) && (state.coins as number) >= 0
            ? (state.coins as number)
            : STARTING_COINS;
        return {
          course: state.course ?? null,
          completedEpisodes: state.completedEpisodes ?? {},
          xp: state.xp ?? 0,
          streak: state.streak ?? 0,
          lastStudyDate: state.lastStudyDate ?? "",
          hearts: state.hearts ?? MAX_HEARTS,
          heartsRefillAt: state.heartsRefillAt ?? 0,
          xpToday: state.xpToday ?? 0,
          lastXpDate: state.lastXpDate ?? "",
          dailyGoal: state.dailyGoal ?? DAILY_GOAL_DEFAULT,
          streakShields: state.streakShields ?? 0,
          lastShieldGrantedDate: state.lastShieldGrantedDate ?? "",
          earnedAchievements: state.earnedAchievements ?? [],
          coins: DEMO_UNLOCK_ALL
            ? Math.max(migratedCoins, DEMO_COINS)
            : migratedCoins,
          ownedCosmetics: owned,
          equipped: state.equipped ?? DEFAULT_EQUIPPED,
        } as AppState;
      },
      onRehydrateStorage: () => (state) => {
        // Flag hydration so coin/cosmetic UI can avoid flashing in-memory
        // defaults before localStorage is read.
        useApp.setState({ hasHydrated: true });
        void state;
      },
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectIsEpisodeComplete = (episodeId: string) => (s: AppState) =>
  Boolean(s.completedEpisodes[episodeId]);

/**
 * Quadratic level curve: needs grow with level so high levels feel earned.
 * L1→L2 = 80 XP, L2→L3 = 180, L5→L6 = 705, L10→L11 = 2580.
 */
export const selectXpLevel = (xp: number) => {
  let level = 1;
  let needed = 80;
  let remaining = xp;
  while (remaining >= needed) {
    remaining -= needed;
    level++;
    needed = 80 + level * level * 25;
  }
  return { level, intoLevel: remaining, levelCap: needed };
};

/** Today's XP progress. Handles date rollover so xpToday resets at midnight. */
export const selectDailyProgress = (s: AppState) => {
  const td = todayISO();
  const xpToday = s.lastXpDate === td ? s.xpToday : 0;
  const goal = s.dailyGoal;
  return {
    xpToday,
    goal,
    percent: Math.min(100, Math.round((xpToday / goal) * 100)),
    hit: xpToday >= goal,
  };
};

/** True when the user's streak is at risk (last study was yesterday, today empty). */
export const selectStreakAtRisk = (s: AppState) => {
  const td = todayISO();
  const ystd = yesterdayISO();
  return s.streak > 0 && s.lastStudyDate === ystd && s.lastXpDate !== td;
};

// -------- Coins & cosmetics selectors --------

export const selectCoins = (s: AppState) => s.coins;

export const selectHasHydrated = (s: AppState) => s.hasHydrated;

/** Equipped cosmetic ids per slot. Stable reference until equip changes. */
export const selectEquipped = (s: AppState) => s.equipped;

/** Owned cosmetic ids. */
export const selectOwned = (s: AppState) => s.ownedCosmetics;

/** Curried ownership check: `useApp(selectOwns(id))`. */
export const selectOwns = (id: string) => (s: AppState) =>
  s.ownedCosmetics.includes(id);

// ============================================================================
// Achievements
// ============================================================================

const ACHIEVEMENTS: Record<AchievementId, AchievementInfo> = {
  first_episode: {
    id: "first_episode",
    icon: "🎯",
    title: "First steps!",
    subtitle: "Completed your first episode",
  },
  first_perfect: {
    id: "first_perfect",
    icon: "💯",
    title: "Flawless!",
    subtitle: "First perfect episode — no mistakes",
  },
  streak_3: {
    id: "streak_3",
    icon: "🔥",
    title: "On fire!",
    subtitle: "3-day streak",
  },
  streak_7: {
    id: "streak_7",
    icon: "🌟",
    title: "Week warrior!",
    subtitle: "7-day streak — shield earned",
  },
  streak_30: {
    id: "streak_30",
    icon: "🏆",
    title: "Unstoppable!",
    subtitle: "30-day streak",
  },
  level_5: {
    id: "level_5",
    icon: "⚡",
    title: "Level 5 unlocked",
    subtitle: "You're rolling",
  },
  level_10: {
    id: "level_10",
    icon: "👑",
    title: "Level 10 master",
    subtitle: "Elite learner",
  },
  path_complete: {
    id: "path_complete",
    icon: "🗺️",
    title: "Path conquered!",
    subtitle: "Every episode in a path crowned",
  },
  course_complete: {
    id: "course_complete",
    icon: "🎓",
    title: "Course graduate!",
    subtitle: "Every path in this course completed",
  },
  daily_goal_first: {
    id: "daily_goal_first",
    icon: "✅",
    title: "Daily goal hit!",
    subtitle: "You hit today's XP target",
  },
};

export const getAchievementInfo = (id: AchievementId): AchievementInfo =>
  ACHIEVEMENTS[id];

interface DetectionExtras {
  isFirstClear: boolean;
  isPerfect: boolean;
  hitDailyGoal: boolean;
  pathEpisodeIds?: string[];
  allCourseEpisodeIds?: string[];
}

function detectNewAchievements(
  before: AppState,
  after: Pick<AppState, "xp" | "streak" | "completedEpisodes" | "xpToday">,
  extras: DetectionExtras
): AchievementId[] {
  const out: AchievementId[] = [];
  const earned = new Set(before.earnedAchievements);
  const push = (id: AchievementId) => {
    if (!earned.has(id)) out.push(id);
  };

  // First-ever episode completion
  if (
    Object.keys(before.completedEpisodes).length === 0 &&
    Object.keys(after.completedEpisodes).length > 0
  ) {
    push("first_episode");
  }

  // First perfect (score >= 100, no mistakes)
  if (extras.isPerfect && extras.isFirstClear) {
    const wasAnyPerfect = Object.values(before.completedEpisodes).some(
      (r) => r.score >= 100
    );
    if (!wasAnyPerfect) push("first_perfect");
  }

  // Streak milestones
  if (before.streak < 3 && after.streak >= 3) push("streak_3");
  if (before.streak < 7 && after.streak >= 7) push("streak_7");
  if (before.streak < 30 && after.streak >= 30) push("streak_30");

  // Level milestones
  const oldLvl = selectXpLevel(before.xp).level;
  const newLvl = selectXpLevel(after.xp).level;
  if (oldLvl < 5 && newLvl >= 5) push("level_5");
  if (oldLvl < 10 && newLvl >= 10) push("level_10");

  // Daily goal first hit
  if (extras.hitDailyGoal) push("daily_goal_first");

  // Path / course completion
  if (extras.pathEpisodeIds?.length) {
    const pathDone = extras.pathEpisodeIds.every(
      (id) => after.completedEpisodes[id]
    );
    const wasPathDone = extras.pathEpisodeIds.every(
      (id) => before.completedEpisodes[id]
    );
    if (pathDone && !wasPathDone) push("path_complete");
  }
  if (extras.allCourseEpisodeIds?.length) {
    const courseDone = extras.allCourseEpisodeIds.every(
      (id) => after.completedEpisodes[id]
    );
    const wasCourseDone = extras.allCourseEpisodeIds.every(
      (id) => before.completedEpisodes[id]
    );
    if (courseDone && !wasCourseDone) push("course_complete");
  }

  return out;
}

export { MAX_HEARTS, HEART_REFILL_MS, DAILY_GOAL_DEFAULT, STARTING_COINS };
