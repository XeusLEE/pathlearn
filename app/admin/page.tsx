"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle,
  Coins,
  Cpu,
  Flame,
  Heart,
  Key,
  Lock,
  RotateCcw,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { useApp, selectXpLevel, selectDailyProgress } from "@/lib/store";
import { getCosmetic } from "@/lib/cosmetics";
import { getAchievementInfo } from "@/lib/store";
import type { AchievementId } from "@/lib/types";

export default function AdminPage() {
  const router = useRouter();

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Load app state
  const state = useApp();
  const xpInfo = selectXpLevel(state.xp);
  const dailyProgress = selectDailyProgress(state);

  // Settings state (persisted to localStorage)
  const [aiMode, setAiMode] = useState<"demo" | "ai" | "openrouter">("demo");
  const [aiProvider, setAiProvider] = useState<"claude" | "gemini" | "openrouter">("openrouter");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiModelName, setAiModelName] = useState("google/gemini-2.5-flash");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    // Check if session authentication persists
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("pathlearn-admin-auth");
      if (auth === "true") {
        setIsAuthenticated(true);
      }

      const stored = JSON.parse(localStorage.getItem("pathlearn-settings") || "{}");
      if (stored.aiMode) setAiMode(stored.aiMode);
      if (stored.aiProvider) setAiProvider(stored.aiProvider);
      if (stored.aiApiKey) setAiApiKey(stored.aiApiKey);
      if (stored.aiModelName) setAiModelName(stored.aiModelName);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    // Default admin credentials: admin / iuiTeam3superadmin
    if (usernameInput === "admin" && passwordInput === "iuiTeam3superadmin") {
      setIsAuthenticated(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pathlearn-admin-auth", "true");
      }
    } else {
      setLoginError("Invalid username or password.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("pathlearn-admin-auth");
    }
  };

  const handleSaveSettings = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "pathlearn-settings",
        JSON.stringify({ aiMode, aiProvider, aiApiKey, aiModelName })
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  // Actions
  const handleRefillHearts = () => {
    state.refillAllHearts();
  };

  const handleAddCoins = () => {
    state.earnCoins(1000);
  };

  const handleAddXp = () => {
    useApp.setState({ xp: state.xp + 500 });
  };

  const handleUnlockAllCosmetics = () => {
    const allIds = [
      "skin_default", "skin_bubblegum", "skin_sunset", "skin_abyss", "skin_mint",
      "hat_party", "hat_beanie", "hat_chef", "hat_grad", "hat_propeller", "hat_cowboy",
      "trail_rainbow", "trail_stars", "trail_bubbles", "trail_fire",
      "aura_sparks", "aura_glow", "aura_hearts", "aura_bubbles"
    ];
    useApp.setState({ ownedCosmetics: allIds });
  };

  const handleResetProgress = () => {
    if (window.confirm("Are you sure you want to reset all user progress, coins, and settings?")) {
      state.resetAll();
      localStorage.removeItem("pathlearn-settings");
      setAiMode("demo");
      setAiProvider("claude");
      setAiApiKey("");
    }
  };

  // ---------------------------------------------------------------------------
  // Login Gate View
  // ---------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <main className="relative min-h-[100dvh] bg-bg text-ink flex items-center justify-center p-4">
        <div aria-hidden className="dot-grid-bg pointer-events-none fixed inset-0 opacity-60" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md card-pop p-8 rounded-3xl"
        >
          <div className="text-center mb-8">
            <span className="text-4xl">⚙️</span>
            <h1 className="font-display text-2xl font-black tracking-tight mt-3">Admin Login</h1>
            <p className="text-sm text-ink-soft mt-1 font-semibold">Please authenticate to access settings</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider font-extrabold text-ink-soft mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-soft">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Username"
                  className="w-full bg-surface border-2 border-border rounded-2xl pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-extrabold text-ink-soft mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-soft">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-surface border-2 border-border rounded-2xl pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            {loginError && (
              <p className="text-xs text-heart font-bold bg-heart-soft border-2 border-heart-dark/10 p-3 rounded-xl">
                ⚠️ {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full btn-pop bg-primary text-white shadow-pop-primary border-primary-dark py-3 mt-4"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 pt-6 border-t-2 border-border-soft text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted hover:text-ink transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Back to App
            </Link>
          </div>
        </motion.div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // Authenticated Dashboard View
  // ---------------------------------------------------------------------------
  return (
    <main className="relative min-h-[100dvh] bg-bg text-ink pb-20">
      {/* Dot grid background */}
      <div
        aria-hidden
        className="dot-grid-bg pointer-events-none fixed inset-0 opacity-60"
      />

      <header className="relative z-10 max-w-6xl mx-auto px-4 sm:px-5 md:px-8 pt-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-extrabold text-ink-muted hover:text-ink transition-colors bg-surface border-2 border-border shadow-pop-soft rounded-2xl px-4 py-2"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={3} />
          Back to App
        </Link>
        
        <div className="flex items-center gap-4">
          <button
            onClick={handleLogout}
            className="text-xs font-extrabold text-ink-muted hover:text-heart transition-colors bg-surface border-2 border-border shadow-pop-soft rounded-2xl px-4 py-2"
          >
            Logout
          </button>
          <h1 className="font-display text-2xl font-black tracking-tight flex items-center gap-2">
            ⚙️ Admin Panel
          </h1>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-5 md:px-8 mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: AI Config Settings */}
        <section className="card-pop p-6 rounded-3xl md:col-span-2 flex flex-col gap-5 justify-between">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 border-b-2 border-border-soft pb-3 mb-4">
              <Cpu className="h-5 w-5 text-primary" /> AI Generation Settings
            </h2>

            <div className="space-y-5">
              {/* AI Mode Selector */}
              <div>
                <label className="block text-xs uppercase tracking-wider font-extrabold text-ink-soft mb-2">
                  AI Generation Mode
                </label>
                <div className="flex gap-2 p-1 bg-surface-muted rounded-2xl border-2 border-border-soft">
                  <button
                    type="button"
                    onClick={() => setAiMode("demo")}
                    className={`flex-1 py-2.5 rounded-xl font-extrabold text-sm transition-all ${
                      aiMode === "demo"
                        ? "bg-surface border-2 border-border-soft shadow-pop-soft text-ink"
                        : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    Demo Mode (Mock Fallback)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiMode("ai")}
                    className={`flex-1 py-2.5 rounded-xl font-extrabold text-sm transition-all ${
                      aiMode === "ai"
                        ? "bg-primary text-white shadow-pop-primary border-primary-dark"
                        : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    AI Active Mode
                  </button>
                </div>
                <p className="text-xs text-ink-soft mt-1.5 font-semibold">
                  Demo Mode always returns sample questions. AI Active Mode tries generating from your document using the API key.
                </p>
              </div>

              {/* AI Provider */}
              {aiMode === "ai" && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-extrabold text-ink-soft mb-2">
                      AI Provider
                    </label>
                    <div className="flex gap-2 p-1 bg-surface-muted rounded-2xl border-2 border-border-soft">
                      <button
                        type="button"
                        onClick={() => { setAiProvider("openrouter"); setAiModelName("google/gemini-2.5-flash"); }}
                        className={`flex-1 py-2 rounded-xl font-extrabold text-xs transition-all ${
                          aiProvider === "openrouter"
                            ? "bg-primary text-white shadow-pop-primary"
                            : "text-ink-soft hover:text-ink"
                        }`}
                      >
                        OpenRouter
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAiProvider("gemini"); setAiModelName("gemini-3.5-flash"); }}
                        className={`flex-1 py-2 rounded-xl font-extrabold text-xs transition-all ${
                          aiProvider === "gemini"
                            ? "bg-primary text-white shadow-pop-primary"
                            : "text-ink-soft hover:text-ink"
                        }`}
                      >
                        Google Gemini
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAiProvider("claude"); setAiModelName(""); }}
                        className={`flex-1 py-2 rounded-xl font-extrabold text-xs transition-all ${
                          aiProvider === "claude"
                            ? "bg-surface border-2 border-border-soft shadow-pop-soft text-ink"
                            : "text-ink-soft hover:text-ink"
                        }`}
                      >
                        Claude (Anthropic)
                      </button>
                    </div>
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-extrabold text-ink-soft mb-2">
                      {aiProvider === "openrouter" ? "OpenRouter" : aiProvider === "gemini" ? "Gemini" : "Anthropic"} API Key
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-soft">
                        <Key className="h-4 w-4" />
                      </div>
                      <input
                        type="password"
                        value={aiApiKey}
                        onChange={(e) => setAiApiKey(e.target.value)}
                        placeholder={aiProvider === "openrouter" ? "sk-or-v1-..." : aiProvider === "gemini" ? "AIzaSy..." : "sk-ant-..."}
                        className="w-full bg-surface border-2 border-border rounded-2xl pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:border-primary transition-colors"
                      />
                    </div>
                    {aiProvider === "openrouter" && (
                      <p className="text-xs text-ink-soft mt-1.5 font-semibold">
                        Ucretsiz key: <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="underline text-primary">openrouter.ai/keys</a> – sk-or-v1-... formatinda
                      </p>
                    )}
                    {aiProvider === "gemini" && (
                      <p className="text-xs text-ink-soft mt-1.5 font-semibold">
                        Google AI Studio ucretsiz key: <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="underline text-primary">aistudio.google.com</a> – AIzaSy... formatinda
                      </p>
                    )}
                  </div>

                  {/* Model Name */}
                  {(aiProvider === "openrouter" || aiProvider === "gemini") && (
                    <div>
                      <label className="block text-xs uppercase tracking-wider font-extrabold text-ink-soft mb-2">
                        {aiProvider === "openrouter" ? "OpenRouter" : "Gemini"} Model
                      </label>
                      <input
                        type="text"
                        value={aiModelName}
                        onChange={(e) => setAiModelName(e.target.value)}
                        placeholder={aiProvider === "gemini" ? "gemini-3.5-flash" : "google/gemini-2.5-flash"}
                        className="w-full bg-surface border-2 border-border rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-primary transition-colors"
                      />
                      <p className="text-xs text-ink-soft mt-1.5 font-semibold">
                        {aiProvider === "gemini" ? (
                          "Onerilen: gemini-3.5-flash veya gemini-2.5-flash"
                        ) : (
                          "Ucretsiz: google/gemini-2.5-flash, meta-llama/llama-3.3-70b-instruct:free, deepseek/deepseek-r1:free"
                        )}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t-2 border-border-soft flex items-center justify-between gap-4 mt-6">
            <button
              type="button"
              onClick={handleSaveSettings}
              className="btn-pop bg-primary text-white shadow-pop-primary border-primary-dark px-6 py-2.5"
            >
              {saveSuccess ? "✓ Settings Saved" : "Save Settings"}
            </button>
            <span className="text-xs text-ink-soft font-bold">
              Status: {aiMode === "ai" && aiApiKey ? "AI Connected" : "Demo Mode"}
            </span>
          </div>
        </section>

        {/* Right Column: User Quick Tools */}
        <section className="card-pop p-6 rounded-3xl flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 border-b-2 border-border-soft pb-3 mb-4">
              <Zap className="h-5 w-5 text-xp-dark" /> Quick Tester Tools
            </h2>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleRefillHearts}
                className="btn-pop bg-surface text-ink border-2 border-border shadow-pop-soft hover:bg-surface-muted text-sm py-3 justify-start"
              >
                <Heart className="h-4 w-4 text-heart mr-3" fill="currentColor" /> Refill All Hearts
              </button>
              <button
                type="button"
                onClick={handleAddCoins}
                className="btn-pop bg-surface text-ink border-2 border-border shadow-pop-soft hover:bg-surface-muted text-sm py-3 justify-start"
              >
                <Coins className="h-4 w-4 text-secondary-dark mr-3" /> Grant +1,000 Coins
              </button>
              <button
                type="button"
                onClick={handleAddXp}
                className="btn-pop bg-surface text-ink border-2 border-border shadow-pop-soft hover:bg-surface-muted text-sm py-3 justify-start"
              >
                <Sparkles className="h-4 w-4 text-xp-dark mr-3" /> Grant +500 XP (Level Up)
              </button>
              <button
                type="button"
                onClick={handleUnlockAllCosmetics}
                className="btn-pop bg-surface text-ink border-2 border-border shadow-pop-soft hover:bg-surface-muted text-sm py-3 justify-start"
              >
                <Award className="h-4 w-4 text-primary mr-3" /> Unlock All Cosmetics
              </button>
            </div>
          </div>

          <div className="pt-4 border-t-2 border-border-soft mt-6">
            <button
              type="button"
              onClick={handleResetProgress}
              className="btn-pop bg-heart text-white border-heart-dark shadow-pop-heart text-sm py-2.5 w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" /> Reset All Progress
            </button>
          </div>
        </section>

        {/* User Activity Dashboard (Full width bottom row) */}
        <section className="card-pop p-6 rounded-3xl md:col-span-3">
          <h2 className="text-xl font-black flex items-center gap-2 border-b-2 border-border-soft pb-3 mb-6">
            <BookOpen className="h-5 w-5 text-secondary" /> Active User Progress Dashboard
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-surface-muted border-2 border-border-soft rounded-2xl p-4 text-center">
              <span className="block text-xs font-extrabold text-ink-soft uppercase">XP Level</span>
              <span className="block text-2xl font-black text-primary mt-1">Lvl {xpInfo.level}</span>
              <span className="block text-3xs font-bold text-ink-muted mt-0.5">
                {xpInfo.intoLevel} / {xpInfo.levelCap} XP
              </span>
            </div>

            <div className="bg-surface-muted border-2 border-border-soft rounded-2xl p-4 text-center">
              <span className="block text-xs font-extrabold text-ink-soft uppercase">Current Streak</span>
              <span className="block text-2xl font-black text-orange-500 mt-1 flex items-center justify-center gap-1">
                <Flame className="h-5 w-5 fill-current" /> {state.streak}
              </span>
              <span className="block text-3xs font-bold text-ink-muted mt-0.5">
                Last: {state.lastStudyDate || "Never"}
              </span>
            </div>

            <div className="bg-surface-muted border-2 border-border-soft rounded-2xl p-4 text-center">
              <span className="block text-xs font-extrabold text-ink-soft uppercase">Hearts Left</span>
              <span className="block text-2xl font-black text-heart mt-1 flex items-center justify-center gap-1">
                <Heart className="h-5 w-5 fill-current" /> {state.hearts}
              </span>
              <span className="block text-3xs font-bold text-ink-muted mt-0.5">
                Max refills automatically
              </span>
            </div>

            <div className="bg-surface-muted border-2 border-border-soft rounded-2xl p-4 text-center">
              <span className="block text-xs font-extrabold text-ink-soft uppercase">Daily Progress</span>
              <span className="block text-2xl font-black text-green-500 mt-1">
                {dailyProgress.percent}%
              </span>
              <span className="block text-3xs font-bold text-ink-muted mt-0.5">
                {dailyProgress.xpToday} / {dailyProgress.goal} XP Goal
              </span>
            </div>

            <div className="bg-surface-muted border-2 border-border-soft rounded-2xl p-4 text-center col-span-2 sm:col-span-1">
              <span className="block text-xs font-extrabold text-ink-soft uppercase">Coins Balance</span>
              <span className="block text-2xl font-black text-secondary-dark mt-1 flex items-center justify-center gap-1">
                <Coins className="h-5 w-5 text-secondary-dark" /> {state.coins}
              </span>
              <span className="block text-3xs font-bold text-ink-muted mt-0.5">
                For Cosmetics Shop
              </span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Completed Episodes */}
            <div className="bg-surface-muted border-2 border-border-soft rounded-2xl p-5">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink-soft mb-3 pb-2 border-b border-border-soft flex items-center justify-between">
                <span>Completed Episodes</span>
                <span className="text-xs bg-surface border border-border px-2 py-0.5 rounded-lg text-ink font-bold">
                  {Object.keys(state.completedEpisodes).length} Cleared
                </span>
              </h3>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                {Object.keys(state.completedEpisodes).length === 0 ? (
                  <p className="text-xs text-ink-soft italic text-center py-4">No completed episodes yet. Start learning!</p>
                ) : (
                  Object.entries(state.completedEpisodes).map(([id, res]) => (
                    <div key={id} className="flex justify-between items-center text-xs bg-surface border border-border-soft p-2.5 rounded-xl">
                      <span className="font-extrabold font-mono text-primary">{id}</span>
                      <span className="font-bold flex items-center gap-1">
                        Best Score: <span className="text-green-500 font-extrabold">{res.score}%</span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Unlocked Achievements */}
            <div className="bg-surface-muted border-2 border-border-soft rounded-2xl p-5">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink-soft mb-3 pb-2 border-b border-border-soft flex items-center justify-between">
                <span>Unlocked Achievements</span>
                <span className="text-xs bg-surface border border-border px-2 py-0.5 rounded-lg text-ink font-bold">
                  {state.earnedAchievements.length} Unlocked
                </span>
              </h3>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                {state.earnedAchievements.length === 0 ? (
                  <p className="text-xs text-ink-soft italic text-center py-4">No achievements earned yet.</p>
                ) : (
                  state.earnedAchievements.map((id) => {
                    const info = getAchievementInfo(id as AchievementId);
                    return (
                      <div key={id} className="flex items-center gap-3 bg-surface border border-border-soft p-2.5 rounded-xl">
                        <span className="text-xl shrink-0">{info?.icon || "🏆"}</span>
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-xs text-ink">{info?.title}</div>
                          <div className="text-3xs text-ink-muted truncate">{info?.subtitle}</div>
                        </div>
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" strokeWidth={3} />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
