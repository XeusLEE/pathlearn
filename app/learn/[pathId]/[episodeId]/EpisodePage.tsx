"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import { useApp, type EpisodeCompletionResult } from "@/lib/store";
import type { Episode, LearningPath } from "@/lib/types";
import {
  PreEpisodeIntro,
  QuizPlayer,
  type QuizFinishPayload,
} from "@/components/quiz";
import { EpisodeCompleteScreen } from "@/components/gamification";

interface PageParams {
  pathId: string;
  episodeId: string;
}

export default function EpisodePage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { pathId, episodeId } = use(params);
  const router = useRouter();

  const course = useApp((s) => s.course);
  const completedEpisodes = useApp((s) => s.completedEpisodes);

  // Find path and episode in the loaded course.
  const found = useMemo<{
    path: LearningPath;
    episode: Episode;
    episodeNumber: number;
    isBoss: boolean;
    nextEpisode:
      | { pathId: string; episodeId: string; title: string }
      | null;
  } | null>(() => {
    if (!course) return null;
    const pathIdx = course.paths.findIndex((p) => p.id === pathId);
    if (pathIdx === -1) return null;
    const path = course.paths[pathIdx];
    const idx = path.episodes.findIndex((e) => e.id === episodeId);
    if (idx === -1) return null;
    const episode = path.episodes[idx];
    const isLastInPath = idx === path.episodes.length - 1;
    const isBoss = isLastInPath && episode.difficulty === 3;

    // Next episode = next in this path; if no more, jump to first of next path.
    let nextEpisode:
      | { pathId: string; episodeId: string; title: string }
      | null = null;
    if (idx + 1 < path.episodes.length) {
      const ne = path.episodes[idx + 1];
      nextEpisode = { pathId: path.id, episodeId: ne.id, title: ne.title };
    } else if (pathIdx + 1 < course.paths.length) {
      const np = course.paths[pathIdx + 1];
      if (np.episodes.length > 0) {
        const ne = np.episodes[0];
        nextEpisode = { pathId: np.id, episodeId: ne.id, title: ne.title };
      }
    }

    return {
      path,
      episode,
      episodeNumber: idx + 1,
      isBoss,
      nextEpisode,
    };
  }, [course, pathId, episodeId]);

  // Practice mode = this episode has already been completed before this run.
  const practiceMode = useMemo(
    () => Boolean(completedEpisodes[episodeId]),
    [completedEpisodes, episodeId]
  );

  type Phase = "intro" | "playing" | "complete";
  const [phase, setPhase] = useState<Phase>("intro");
  const [completion, setCompletion] = useState<{
    payload: QuizFinishPayload;
    xpAwarded: number;
    result: EpisodeCompletionResult;
  } | null>(null);

  const recordEpisodeComplete = useApp((s) => s.recordEpisodeComplete);

  // Redirect if course/path/episode missing.
  // Wait briefly for zustand persist to hydrate from localStorage before bouncing.
  useEffect(() => {
    if (course === null) {
      const t = window.setTimeout(() => {
        if (!useApp.getState().course) router.replace("/learn");
      }, 80);
      return () => window.clearTimeout(t);
    }
    if (course && !found) {
      router.replace("/learn");
    }
  }, [course, found, router]);

  if (!found || !course) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="text-center">
          <Trophy className="mx-auto mb-3 h-12 w-12 text-ink-soft" />
          <p className="font-bold text-ink-muted">Loading episode…</p>
        </div>
      </main>
    );
  }

  const { path, episode, episodeNumber, isBoss, nextEpisode } = found;

  const handleStart = () => setPhase("playing");
  const handleClose = () => router.push("/learn");
  const handleFinish = (payload: QuizFinishPayload) => {
    // Boss bonus: 1.5x base XP for the last hard episode of a path.
    const bossMultiplier = isBoss ? 1.5 : 1;
    const adjustedBaseXp = Math.round(payload.baseXp * bossMultiplier);

    const result = recordEpisodeComplete(
      episode.id,
      payload.score,
      adjustedBaseXp,
      {
        pathEpisodeIds: path.episodes.map((e) => e.id),
        allCourseEpisodeIds: course.paths.flatMap((p) =>
          p.episodes.map((e) => e.id)
        ),
      }
    );
    setCompletion({ payload, xpAwarded: result.xpAwarded, result });
    setPhase("complete");
  };
  const handleReplay = () => {
    setCompletion(null);
    setPhase("intro");
  };

  const handlePlayNext = nextEpisode
    ? () => {
        // Hard navigation so the page state resets cleanly for the next episode.
        router.push(`/learn/${nextEpisode.pathId}/${nextEpisode.episodeId}`);
      }
    : undefined;

  return (
    <>
      {phase === "intro" ? (
        <PreEpisodeIntro
          episode={episode}
          episodeNumber={episodeNumber}
          totalEpisodes={path.episodes.length}
          pathTitle={path.title}
          themeColor={path.themeColor}
          isBoss={isBoss}
          onStart={handleStart}
        />
      ) : null}

      {phase === "playing" ? (
        <QuizPlayer
          episode={episode}
          themeColor={path.themeColor}
          practiceMode={practiceMode}
          onClose={handleClose}
          onFinish={handleFinish}
        />
      ) : null}

      {phase === "complete" && completion ? (
        <EpisodeCompleteScreen
          episode={episode}
          pathThemeColor={path.themeColor}
          score={completion.payload.score}
          mistakes={completion.payload.mistakes}
          durationMs={completion.payload.durationMs}
          xpAwarded={completion.xpAwarded}
          onContinue={() => router.push("/learn")}
          onReplay={handleReplay}
          completionResult={completion.result}
          nextEpisode={nextEpisode}
          onPlayNext={handlePlayNext}
        />
      ) : null}
    </>
  );
}
