// =============================================================
// Public surface for the gamification feature. Other agents should
// only import from `@/components/gamification` (this barrel) so
// internal re-organization stays an implementation detail.
// =============================================================

export { HUD } from "./HUD";
export type { HUDProps } from "./HUD";

export { HeartsBar } from "./HeartsBar";
export type { HeartsBarProps } from "./HeartsBar";

export { XPBar } from "./XPBar";
export type { XPBarProps } from "./XPBar";

export { StreakBadge } from "./StreakBadge";
export type { StreakBadgeProps } from "./StreakBadge";

export { LevelUpModal } from "./LevelUpModal";
export type { LevelUpModalProps } from "./LevelUpModal";

export { EpisodeCompleteScreen } from "./EpisodeCompleteScreen";
export type {
  EpisodeCompleteScreenProps,
  EpisodeCompleteNextEpisode,
} from "./EpisodeCompleteScreen";

export { DailyGoalRing } from "./DailyGoalRing";
export type { DailyGoalRingProps } from "./DailyGoalRing";

export {
  AchievementToast,
  ToastHost,
  useToasts,
} from "./AchievementToast";
export type {
  AchievementToastProps,
  ToastContent,
} from "./AchievementToast";

export { Mascot } from "./Mascot";
export type { MascotProps, MascotMood } from "./Mascot";

export { vibrate, playTone } from "./feedback";
