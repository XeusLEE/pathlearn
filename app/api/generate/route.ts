// ============================================================================
// POST /api/generate
// Body: { title: string, text: string }
// Returns: { course: Course } | { error: string }
// ============================================================================

import { generateCourse } from "@/lib/generate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return Response.json(
      { error: "Request body must be a JSON object." },
      { status: 400 },
    );
  }

  const { title, text, aiProvider, aiApiKey, aiMode, aiModelName } = body as {
    title?: unknown;
    text?: unknown;
    aiProvider?: unknown;
    aiApiKey?: unknown;
    aiMode?: unknown;
    aiModelName?: unknown;
  };

  console.log("[POST /api/generate] Received request:", {
    title,
    textLength: typeof text === "string" ? text.length : 0,
    aiProvider,
    aiApiKey: typeof aiApiKey === "string" ? (aiApiKey.slice(0, 8) + "...") : "empty",
    aiMode,
    aiModelName,
  });

  if (typeof title !== "string" || title.trim().length === 0) {
    return Response.json(
      { error: "`title` must be a non-empty string." },
      { status: 400 },
    );
  }

  if (typeof text !== "string" || text.trim().length === 0) {
    return Response.json(
      { error: "`text` must be a non-empty string." },
      { status: 400 },
    );
  }

  try {
    const course = await generateCourse({
      title: title.trim(),
      text,
      aiProvider: typeof aiProvider === "string" ? aiProvider : undefined,
      aiApiKey: typeof aiApiKey === "string" ? aiApiKey : undefined,
      aiMode: typeof aiMode === "string" ? aiMode : undefined,
      aiModelName: typeof aiModelName === "string" ? aiModelName : undefined,
    });
    return Response.json({ course });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Unknown error while generating course.";
    console.error("[POST /api/generate] failed:", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
