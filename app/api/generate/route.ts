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

  const { title, text } = body as { title?: unknown; text?: unknown };

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
