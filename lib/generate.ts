// ============================================================================
// generateCourse — calls Claude to turn a raw document into a Pathlearn Course.
// On missing API key OR validation failure, falls back to MOCK_COURSE so the
// demo never breaks for the user.
// ============================================================================

import { claude, hasClaudeKey, MODEL } from "./claude";
import { MOCK_COURSE } from "./mock-data";
import { cleanText, truncateText } from "./parse-document";
import type {
  Course,
  Episode,
  LearningPath,
  Question,
} from "./types";

const THEME_PALETTE = [
  "#7c3aed",
  "#d946ef",
  "#a855f7",
  "#8b5cf6",
  "#ec4899",
] as const;

const SYSTEM_PROMPT = `You are the curriculum designer behind "Pathlearn" — a Duolingo-style quiz generator that turns any document into a gamified learning experience. The user gives you a document and you produce a complete, playable course as a single JSON object.

# Your output

Respond with ONLY a single JSON object. No prose, no commentary, no markdown code fences, no <answer> tags. Just the raw JSON.

# JSON schema (TypeScript)

The JSON object MUST match this shape exactly:

{
  "summary": string,                 // one short sentence summarizing the document
  "paths": [                         // 2 to 4 entries — the core "subjects" you detect
    {
      "id": string,                  // e.g. "p1", "p2"
      "title": string,               // short, punchy
      "description": string,         // one sentence, learner-facing
      "themeColor": string,          // hex color, see palette below
      "iconEmoji": string,           // a single emoji that fits the subject
      "episodes": [                  // 3 to 5 entries per path, ordered easy -> hard
        {
          "id": string,              // e.g. "p1-e1"
          "title": string,
          "description": string,     // one-sentence teaser
          "iconEmoji": string,       // single emoji
          "difficulty": 1 | 2 | 3,   // 1=easy, 2=medium, 3=hard
          "questions": [             // 4 to 6 entries per episode
            // Each question is one of these five shapes (see "type"):

            // 1) multiple_choice
            {
              "id": string,                // e.g. "p1-e1-q1"
              "type": "multiple_choice",
              "prompt": string,
              "options": string[],         // 3 or 4 plausible options
              "correctIndex": number,      // 0-based index into options
              "explanation": string        // 1-2 sentences, learner-friendly
            }

            // 2) fill_in_blank
            {
              "id": string,
              "type": "fill_in_blank",
              "prompt": string,            // MUST contain "___" exactly where the blank is
              "answer": string,            // the canonical correct answer
              "alternates": string[],      // optional accepted variants (synonyms / casing)
              "explanation": string
            }

            // 3) true_false
            {
              "id": string,
              "type": "true_false",
              "prompt": string,
              "correct": boolean,
              "explanation": string
            }

            // 4) matching
            {
              "id": string,
              "type": "matching",
              "prompt": string,
              "pairs": [                    // 3 to 5 pairs, IN CORRECT correspondence
                { "left": string, "right": string }
              ],
              "explanation": string
            }

            // 5) ordering
            {
              "id": string,
              "type": "ordering",
              "prompt": string,
              "items": string[],           // 3 to 5 items, IN CORRECT ORDER
              "explanation": string
            }
          ]
        }
      ]
    }
  ]
}

# Hard rules

- Detect 2 to 4 distinct, non-overlapping SUBJECT paths from the document. Each path = one major theme.
- Each path has 3 to 5 episodes, ordered easy -> hard. Episode 1 has difficulty 1, the final episode has difficulty 3, middle episodes have difficulty 2.
- Each episode has 4 to 6 questions and MUST cover AT LEAST 3 different question types from the 5 available. Vary the types across episodes — do not lean on multiple_choice every time.
- Every question must include a clear, 1-2 sentence "explanation" that teaches WHY the answer is correct.
- "ordering" questions: list "items" in the CORRECT order. The UI shuffles them for the player.
- "matching" questions: list "pairs" in correct correspondence. The UI shuffles the right column.
- "fill_in_blank": "prompt" MUST contain the literal token "___" exactly where the blank goes.
- "multiple_choice": exactly 3 or 4 options, only one correct. "correctIndex" is 0-based.
- "true_false": "correct" is a boolean (true or false).
- IDs: use the pattern "pN", "pN-eN", "pN-eN-qN" (e.g. "p2", "p2-e3", "p2-e3-q4").

# Theme colors

Rotate through this purple-family palette in order, one hex per path:
["#7c3aed", "#d946ef", "#a855f7", "#8b5cf6", "#ec4899"]
- Path 1 -> "#7c3aed" (deep violet)
- Path 2 -> "#d946ef" (fuchsia)
- Path 3 -> "#a855f7" (purple)
- Path 4 -> "#8b5cf6" (light violet)

# Emojis

Pick exactly ONE emoji per path and per episode that fits the topic (e.g. "🌱", "🔬", "⚡", "🧪", "🌍"). Never use multiple emojis in the same field.

# Tone

Friendly, energetic, learner-first — like Duolingo. Keep prompts short and concrete. Prefer real facts from the document over generic filler.

Remember: respond with ONLY the JSON object.`;

/**
 * Strip accidental ```json / ``` fences and surrounding whitespace,
 * and isolate the outermost JSON object even if the model added prose.
 */
function extractJsonBlob(raw: string): string {
  let text = raw.trim();

  // Remove leading ```json or ``` fences.
  text = text.replace(/^```(?:json)?\s*/i, "");
  text = text.replace(/\s*```$/i, "");

  // If there's still surrounding prose, snap to the outermost { ... }.
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace > 0 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

/**
 * Minimal-but-real shape validator. Returns true if the parsed object
 * looks structurally like a Course we can hand to the UI.
 */
function isValidCourseShape(obj: unknown): obj is {
  summary?: string;
  paths: Array<{
    id?: string;
    title: string;
    description?: string;
    themeColor?: string;
    iconEmoji?: string;
    episodes: Array<{
      id?: string;
      title: string;
      description?: string;
      iconEmoji?: string;
      difficulty?: 1 | 2 | 3;
      questions: Array<Record<string, unknown> & { type: string }>;
    }>;
  }>;
} {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  if (!Array.isArray(o.paths) || o.paths.length === 0) return false;

  for (const path of o.paths as Array<Record<string, unknown>>) {
    if (!path || typeof path !== "object") return false;
    if (typeof path.title !== "string") return false;
    if (!Array.isArray(path.episodes) || path.episodes.length === 0) {
      return false;
    }
    for (const ep of path.episodes as Array<Record<string, unknown>>) {
      if (!ep || typeof ep !== "object") return false;
      if (typeof ep.title !== "string") return false;
      if (!Array.isArray(ep.questions) || ep.questions.length === 0) {
        return false;
      }
      for (const q of ep.questions as Array<Record<string, unknown>>) {
        if (!q || typeof q !== "object") return false;
        if (typeof q.type !== "string") return false;
      }
    }
  }
  return true;
}

const VALID_QUESTION_TYPES = new Set([
  "multiple_choice",
  "fill_in_blank",
  "true_false",
  "matching",
  "ordering",
]);

/**
 * Normalize / fill in any missing fields and stamp deterministic IDs.
 * Drops malformed questions; if an episode ends up empty we drop it.
 * Same for paths. Caller should re-validate after this pass.
 */
function normalizeCourse(
  raw: ReturnType<typeof JSON.parse>,
  documentTitle: string,
): Course {
  const paths: LearningPath[] = [];

  const rawPaths = Array.isArray(raw?.paths) ? raw.paths : [];

  rawPaths.forEach((p: Record<string, unknown>, pi: number) => {
    const pathId =
      typeof p.id === "string" && p.id.length > 0 ? p.id : `p${pi + 1}`;
    const themeColor =
      typeof p.themeColor === "string" && /^#[0-9a-fA-F]{3,8}$/.test(p.themeColor)
        ? p.themeColor
        : THEME_PALETTE[pi % THEME_PALETTE.length];

    const episodes: Episode[] = [];
    const rawEpisodes = Array.isArray(p.episodes) ? p.episodes : [];
    const epCount = rawEpisodes.length;

    rawEpisodes.forEach((e: Record<string, unknown>, ei: number) => {
      const epId =
        typeof e.id === "string" && e.id.length > 0
          ? e.id
          : `${pathId}-e${ei + 1}`;

      // Difficulty: prefer model value, else derive from position.
      let difficulty: 1 | 2 | 3 = 2;
      if (e.difficulty === 1 || e.difficulty === 2 || e.difficulty === 3) {
        difficulty = e.difficulty;
      } else if (ei === 0) {
        difficulty = 1;
      } else if (ei === epCount - 1) {
        difficulty = 3;
      }

      const questions: Question[] = [];
      const rawQs = Array.isArray(e.questions) ? e.questions : [];
      rawQs.forEach((q: Record<string, unknown>, qi: number) => {
        if (!q || typeof q !== "object") return;
        const qType = typeof q.type === "string" ? q.type : "";
        if (!VALID_QUESTION_TYPES.has(qType)) return;
        const qId =
          typeof q.id === "string" && q.id.length > 0
            ? q.id
            : `${epId}-q${qi + 1}`;
        const explanation =
          typeof q.explanation === "string" ? q.explanation : "";
        const prompt = typeof q.prompt === "string" ? q.prompt : "";
        if (!prompt) return;

        switch (qType) {
          case "multiple_choice": {
            const options = Array.isArray(q.options)
              ? q.options.filter((o): o is string => typeof o === "string")
              : [];
            const correctIndex =
              typeof q.correctIndex === "number" ? q.correctIndex : 0;
            if (options.length < 2) return;
            questions.push({
              id: qId,
              type: "multiple_choice",
              prompt,
              options,
              correctIndex: Math.min(
                Math.max(0, correctIndex),
                options.length - 1,
              ),
              explanation,
            });
            return;
          }
          case "fill_in_blank": {
            const answer = typeof q.answer === "string" ? q.answer : "";
            if (!answer) return;
            const alternates = Array.isArray(q.alternates)
              ? q.alternates.filter((a): a is string => typeof a === "string")
              : undefined;
            questions.push({
              id: qId,
              type: "fill_in_blank",
              prompt,
              answer,
              alternates,
              explanation,
            });
            return;
          }
          case "true_false": {
            const correct =
              typeof q.correct === "boolean" ? q.correct : false;
            questions.push({
              id: qId,
              type: "true_false",
              prompt,
              correct,
              explanation,
            });
            return;
          }
          case "matching": {
            const pairs = Array.isArray(q.pairs)
              ? (q.pairs as Array<Record<string, unknown>>)
                  .map((pair) =>
                    pair &&
                    typeof pair.left === "string" &&
                    typeof pair.right === "string"
                      ? { left: pair.left, right: pair.right }
                      : null,
                  )
                  .filter(
                    (x): x is { left: string; right: string } => x !== null,
                  )
              : [];
            if (pairs.length < 2) return;
            questions.push({
              id: qId,
              type: "matching",
              prompt,
              pairs,
              explanation,
            });
            return;
          }
          case "ordering": {
            const items = Array.isArray(q.items)
              ? q.items.filter((i): i is string => typeof i === "string")
              : [];
            if (items.length < 2) return;
            questions.push({
              id: qId,
              type: "ordering",
              prompt,
              items,
              explanation,
            });
            return;
          }
          default:
            return;
        }
      });

      if (questions.length === 0) return;

      episodes.push({
        id: epId,
        title: typeof e.title === "string" ? e.title : `Episode ${ei + 1}`,
        description:
          typeof e.description === "string" ? e.description : "",
        iconEmoji:
          typeof e.iconEmoji === "string" && e.iconEmoji.length > 0
            ? e.iconEmoji
            : "✨",
        difficulty,
        questions,
      });
    });

    if (episodes.length === 0) return;

    paths.push({
      id: pathId,
      title: typeof p.title === "string" ? p.title : `Path ${pi + 1}`,
      description: typeof p.description === "string" ? p.description : "",
      themeColor,
      iconEmoji:
        typeof p.iconEmoji === "string" && p.iconEmoji.length > 0
          ? p.iconEmoji
          : "📘",
      episodes,
    });
  });

  return {
    id: `course-${Date.now()}`,
    documentTitle,
    summary: typeof raw?.summary === "string" ? raw.summary : "",
    paths,
    createdAt: Date.now(),
    isDemoMode: false,
  };
}

/**
 * Build a copy of MOCK_COURSE branded with the user's title. Used as the
 * fallback whenever the API isn't available or the model misbehaves.
 */
function buildMockCourse(title: string): Course {
  return {
    ...MOCK_COURSE,
    id: `mock-${Date.now()}`,
    documentTitle: title || MOCK_COURSE.documentTitle,
    createdAt: Date.now(),
    isDemoMode: true,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

import Anthropic from "@anthropic-ai/sdk";

export async function generateCourse({
  title,
  text,
  aiProvider = "claude",
  aiApiKey = "",
  aiMode = "demo",
  aiModelName = "gemini-1.5-flash",
}: {
  title: string;
  text: string;
  aiProvider?: string;
  aiApiKey?: string;
  aiMode?: string;
  aiModelName?: string;
}): Promise<Course> {
  console.log("[generateCourse] entry parameters:", {
    title,
    textLength: text.length,
    aiProvider,
    aiApiKey: aiApiKey ? (aiApiKey.slice(0, 8) + "...") : "empty",
    aiMode,
    aiModelName,
  });

  const isDemo = aiMode === "demo";
  const effectiveKey =
    aiApiKey ||
    (typeof process !== "undefined"
      ? (aiProvider === "openrouter" ? process.env.OPENROUTER_API_KEY : "") ||
        (aiProvider === "gemini" ? process.env.GEMINI_API_KEY : "") ||
        process.env.ANTHROPIC_API_KEY
      : "") ||
    "";

  // If we have an effective API key, we should allow AI generation even if the client sent 'demo' mode.
  // This allows server-side configured keys to just work out-of-the-box for all users.
  const shouldRunAI = aiMode === "ai" || (aiMode === "demo" && !!effectiveKey);

  if (!shouldRunAI || !effectiveKey) {
    console.log("[generateCourse] Running in demo mode: returning mock course. Details:", {
      shouldRunAI,
      hasKey: !!effectiveKey,
      aiMode,
    });
    await sleep(1500);
    return buildMockCourse(title);
  }

  const cleaned = cleanText(text);
  const truncated = truncateText(cleaned);

  // -----------------------------------------------------------------
  // OpenRouter Integration (OpenAI-compatible, supports Gemini/Claude/Llama)
  // -----------------------------------------------------------------
  if (aiProvider === "openrouter") {
    try {
      const model = aiModelName || "openrouter/free";
      const prompt = `${SYSTEM_PROMPT}\n\nDocument title: ${title}\n\n---\n\nDocument text:\n\n${truncated}\n\n---\n\nGenerate the Pathlearn course JSON now. Output ONLY the JSON object, nothing else.`;

      console.log("[generateCourse] Call OpenRouter model:", model);
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${effectiveKey}`,
          "HTTP-Referer": "https://pathlearnerz.com",
          "X-Title": "Pathlearn",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
          max_tokens: 7000,
        }),
      });

      console.log("[generateCourse] OpenRouter Response Status:", res.status);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter API returned ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const textResponse = data.choices?.[0]?.message?.content;
      if (!textResponse) {
        console.error("[generateCourse] No content from OpenRouter:", JSON.stringify(data));
        throw new Error("Empty response from OpenRouter");
      }

      const jsonText = extractJsonBlob(textResponse);
      const parsed = JSON.parse(jsonText);

      if (!isValidCourseShape(parsed)) {
        throw new Error("OpenRouter output failed shape validation");
      }

      const course = normalizeCourse(parsed, title);
      if (course.paths.length === 0) {
        throw new Error("OpenRouter normalization produced 0 paths");
      }

      return course;
    } catch (err) {
      console.error("[generateCourse] OpenRouter call failed:", err);
      return buildMockCourse(title);
    }
  }

  // -----------------------------------------------------------------
  // Google Gemini Integration
  // -----------------------------------------------------------------
  if (aiProvider === "gemini") {
    try {
      // Clean up OpenRouter prefix if any
      let requestedModel = aiModelName || "gemini-3.5-flash";
      if (requestedModel === "gemini-1.5-flash") requestedModel = "gemini-3.5-flash"; // Auto-upgrade
      if (requestedModel.includes("/")) {
        const parts = requestedModel.split("/");
        requestedModel = parts[parts.length - 1];
      }

      const geminiPrompt = `${SYSTEM_PROMPT}\n\nDocument title: ${title}\n\n---\n\nDocument text:\n\n${truncated}\n\n---\n\nGenerate the Pathlearn course JSON now.`;

      // Fallback array for demo resilience
      const modelsToTry = Array.from(new Set([requestedModel, "gemini-3.5-flash", "gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash"]));
      
      let res;
      let lastErrText = "";

      for (const m of modelsToTry) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${effectiveKey}`;
        console.log("[generateCourse] Call Gemini:", url.replace(effectiveKey, "HIDDEN_KEY"), "Model:", m);
        
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: geminiPrompt }] }]
          })
        });

        console.log(`[generateCourse] Gemini Model ${m} Response Status:`, res?.status);
        if (res?.ok) {
          break; // Success! Exit loop.
        } else if (res) {
          lastErrText = await res.text();
          console.warn(`[generateCourse] Model ${m} failed. Trying next fallback...`);
        }
      }

      if (!res || !res.ok) {
        throw new Error(`Gemini API completely failed after multiple model fallbacks. Last error: ${res?.status} ${lastErrText}`);
      }

      const data = await res.json();
      console.log("[generateCourse] Gemini Response Data Success.");
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResponse) {
        console.error("[generateCourse] No text candidates in Gemini response:", JSON.stringify(data));
        throw new Error("Empty response from Gemini");
      }

      const jsonText = extractJsonBlob(textResponse);
      const parsed = JSON.parse(jsonText);

      if (!isValidCourseShape(parsed)) {
        throw new Error("Gemini output failed shape validation");
      }

      const course = normalizeCourse(parsed, title);
      if (course.paths.length === 0) {
        throw new Error("Gemini normalization produced 0 paths");
      }

      return course;
    } catch (err) {
      console.error("[generateCourse] Gemini call failed:", err);
      return buildMockCourse(title);
    }
  }

  // -----------------------------------------------------------------
  // Anthropic Claude Integration
  // -----------------------------------------------------------------
  const userMessage = `Document title: ${title}\n\n---\n\nDocument text:\n\n${truncated}\n\n---\n\nGenerate the Pathlearn course JSON now. Remember: ONLY the JSON object, nothing else.`;

  let response;
  try {
    const client = new Anthropic({ apiKey: effectiveKey });
    response = await client.beta.promptCaching.messages.create({
      model: MODEL,
      max_tokens: 8000,
      temperature: 0.4,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });
  } catch (err) {
    console.error("[generateCourse] Claude call failed:", err);
    return buildMockCourse(title);
  }

  const block = response.content?.[0];
  if (!block || block.type !== "text") {
    console.error("[generateCourse] No text block in response.");
    return buildMockCourse(title);
  }

  let parsed: unknown;
  try {
    const jsonText = extractJsonBlob(block.text);
    parsed = JSON.parse(jsonText);
  } catch (err) {
    console.error("[generateCourse] JSON parse failed:", err);
    return buildMockCourse(title);
  }

  if (!isValidCourseShape(parsed)) {
    console.error("[generateCourse] Output failed shape validation.");
    return buildMockCourse(title);
  }

  const course = normalizeCourse(parsed, title);
  if (course.paths.length === 0) {
    console.error("[generateCourse] Normalization produced 0 paths.");
    return buildMockCourse(title);
  }

  return course;
}
