// ============================================================================
// Shared types — the CONTRACT between all 5 feature agents and the API route.
// Do not change field names without coordinating; agents import from here.
// ============================================================================

export type QuestionType =
  | "multiple_choice"
  | "fill_in_blank"
  | "true_false"
  | "matching"
  | "ordering";

export interface MultipleChoiceQuestion {
  id: string;
  type: "multiple_choice";
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface FillInBlankQuestion {
  id: string;
  type: "fill_in_blank";
  /** Prompt with a "___" placeholder marking the blank. */
  prompt: string;
  /** Accepted answer (case/whitespace-insensitive comparison). */
  answer: string;
  /** Optional alternates (e.g. synonyms or different casings). */
  alternates?: string[];
  explanation: string;
}

export interface TrueFalseQuestion {
  id: string;
  type: "true_false";
  prompt: string;
  correct: boolean;
  explanation: string;
}

export interface MatchingQuestion {
  id: string;
  type: "matching";
  prompt: string;
  /** Pairs are stored in canonical (correct) order. UI shuffles the right column. */
  pairs: { left: string; right: string }[];
  explanation: string;
}

export interface OrderingQuestion {
  id: string;
  type: "ordering";
  prompt: string;
  /** Items in their CORRECT order. UI shuffles for the user to reorder. */
  items: string[];
  explanation: string;
}

export type Question =
  | MultipleChoiceQuestion
  | FillInBlankQuestion
  | TrueFalseQuestion
  | MatchingQuestion
  | OrderingQuestion;

export interface Episode {
  id: string;
  title: string;
  /** One-sentence teaser shown on the path map. */
  description: string;
  /** Single-emoji icon for the path-map node. */
  iconEmoji: string;
  /** 1=easy, 2=medium, 3=hard — affects color/styling of the node. */
  difficulty: 1 | 2 | 3;
  questions: Question[];
}

export interface LearningPath {
  id: string;
  title: string;
  /** One-sentence description of this path's core subject. */
  description: string;
  /** Tailwind-friendly hex color for theming this path's UI. */
  themeColor: string;
  iconEmoji: string;
  episodes: Episode[];
}

export interface Course {
  id: string;
  documentTitle: string;
  /** AI-generated one-line summary of the source document. */
  summary: string;
  paths: LearningPath[];
  createdAt: number;
  /** True when generated from mock data (no API key). */
  isDemoMode?: boolean;
}

// ============================================================================
// Progress tracking (persisted via zustand)
// ============================================================================

export interface EpisodeResult {
  /** 0-100 accuracy score. */
  score: number;
  completedAt: number;
}

export interface ProgressState {
  /** Keyed by episode id. Stores the BEST result. */
  completedEpisodes: Record<string, EpisodeResult>;
  xp: number;
  streak: number;
  /** ISO date (YYYY-MM-DD) of last study session. */
  lastStudyDate: string;
  hearts: number;
  /** Epoch ms when next heart refills (0 if full). */
  heartsRefillAt: number;
  /** XP earned today (resets when lastXpDate is not today). */
  xpToday: number;
  /** ISO date (YYYY-MM-DD) of the day xpToday was last updated. */
  lastXpDate: string;
  /** Daily XP target the user is working toward. */
  dailyGoal: number;
  /** Streak shields available — auto-rescue a missed day. */
  streakShields: number;
  /** ISO date the most recent shield was granted. */
  lastShieldGrantedDate: string;
  /** Achievement IDs the user has earned. */
  earnedAchievements: string[];
  /** Spendable coin balance for the cosmetics shop. */
  coins: number;
  /** Cosmetic IDs the user owns (always includes "skin_default"). */
  ownedCosmetics: string[];
  /** Currently equipped cosmetic per slot. */
  equipped: EquippedCosmetics;
}

/** One equipped cosmetic id per slot (null = nothing equipped in that slot). */
export interface EquippedCosmetics {
  hat: string | null;
  /** Skin is never null — defaults to "skin_default". */
  skin: string;
  trail: string | null;
  aura: string | null;
}

// ============================================================================
// Achievements — persisted as IDs; metadata via getAchievementInfo().
// ============================================================================

export type AchievementId =
  | "first_episode"
  | "first_perfect"
  | "streak_3"
  | "streak_7"
  | "streak_30"
  | "level_5"
  | "level_10"
  | "path_complete"
  | "course_complete"
  | "daily_goal_first";

export interface AchievementInfo {
  id: AchievementId;
  icon: string;
  title: string;
  subtitle: string;
}

// ============================================================================
// API contract
// ============================================================================

export interface GenerateRequest {
  /** Title displayed on the course (often the file name). */
  title: string;
  /** Raw document text. */
  text: string;
}

export interface GenerateResponse {
  course: Course;
}
