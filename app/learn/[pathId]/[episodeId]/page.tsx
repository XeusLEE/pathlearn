// Server wrapper. Exports generateStaticParams so the dynamic route can be
// pre-rendered for `output: "export"` (GitHub Pages). The client body lives
// in EpisodePage.tsx.
import { MOCK_COURSE } from "@/lib/mock-data";
import EpisodePage from "./EpisodePage";

/**
 * Pre-generate one static page per episode in the bundled MOCK_COURSE.
 * In static mode that's the only course that can exist client-side; in dev
 * this is harmless because dev rendering ignores SSG params.
 */
export function generateStaticParams() {
  return MOCK_COURSE.paths.flatMap((p) =>
    p.episodes.map((e) => ({ pathId: p.id, episodeId: e.id }))
  );
}

type PageProps = {
  params: Promise<{ pathId: string; episodeId: string }>;
};

export default function Page({ params }: PageProps) {
  return <EpisodePage params={params} />;
}
