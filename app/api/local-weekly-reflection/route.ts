export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OLLAMA_MODEL = "llama3.1:8b";
const OLLAMA_URL = "http://localhost:11434/api/generate";

type WeeklyReflectionDraft = {
  summary: string;
  wins: string[];
  challenges: string[];
  goalCoverage: Array<{
    goalTitle: string;
    observation: string;
  }>;
  patterns: string[];
  suggestedAdjustments: string[];
  questionsForUser: string[];
  confidence: number;
};

const reflectionSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    wins: { type: "array", items: { type: "string" } },
    challenges: { type: "array", items: { type: "string" } },
    goalCoverage: {
      type: "array",
      items: {
        type: "object",
        properties: {
          goalTitle: { type: "string" },
          observation: { type: "string" },
        },
        required: ["goalTitle", "observation"],
      },
    },
    patterns: { type: "array", items: { type: "string" } },
    suggestedAdjustments: { type: "array", items: { type: "string" } },
    questionsForUser: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
  },
  required: [
    "summary",
    "wins",
    "challenges",
    "goalCoverage",
    "patterns",
    "suggestedAdjustments",
    "questionsForUser",
    "confidence",
  ],
};

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeReflection(value: unknown): WeeklyReflectionDraft {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Ollama returned an invalid weekly reflection object.");
  }

  const record = value as Record<string, unknown>;
  const goalCoverage = Array.isArray(record.goalCoverage)
    ? record.goalCoverage
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null && !Array.isArray(item),
        )
        .filter(
          (item) =>
            typeof item.goalTitle === "string" &&
            typeof item.observation === "string",
        )
        .map((item) => ({
          goalTitle: item.goalTitle as string,
          observation: item.observation as string,
        }))
    : [];

  return {
    summary: typeof record.summary === "string" ? record.summary : "",
    wins: asStringArray(record.wins),
    challenges: asStringArray(record.challenges),
    goalCoverage,
    patterns: asStringArray(record.patterns),
    suggestedAdjustments: asStringArray(record.suggestedAdjustments),
    questionsForUser: asStringArray(record.questionsForUser),
    confidence:
      typeof record.confidence === "number" && Number.isFinite(record.confidence)
        ? Math.max(0, Math.min(1, record.confidence))
        : 0,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const prompt = `Create a calm, practical LifeOS weekly reflection draft from this selected-week summary.
Use only the facts in the data. Do not invent activities, goals, events, or feelings.
Do not judge the user. Avoid moralising, gamification, and generic productivity clichés.
If the data is sparse, say so gently and reflect uncertainty.
Identify wins from completed activities and logs.
Identify challenges from skipped or moved activities, sparse logs, or notes.
Describe goal coverage without being harsh.
Suggest small adjustments for next week.
Ask useful reflective questions.
Return only valid JSON matching the schema.

Selected-week summary:
${JSON.stringify(body, null, 2)}`;

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: reflectionSchema,
        options: {
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      return Response.json(
        {
          error:
            "Local weekly reflection is unavailable. Make sure Ollama is running.",
        },
        { status: 503 },
      );
    }

    const ollama = (await response.json()) as { response?: unknown };
    if (typeof ollama.response !== "string") {
      throw new Error("Ollama returned an unexpected response.");
    }

    const reflection = normalizeReflection(JSON.parse(ollama.response));

    return Response.json({
      reflection,
      model: OLLAMA_MODEL,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof SyntaxError
            ? "Local weekly reflection returned invalid JSON. Try again or use a different Ollama model."
            : "Local weekly reflection is unavailable. Make sure Ollama is running.",
      },
      { status: 503 },
    );
  }
}
