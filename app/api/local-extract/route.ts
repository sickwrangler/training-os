import type { ActivityExtractionMetadata } from "@/app/data/testPersonas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OLLAMA_MODEL = "llama3.1:8b";
const OLLAMA_URL = "http://localhost:11434/api/generate";

type ExtractRequest = {
  title?: string;
  details?: string;
  notes?: string;
  rawLog?: string;
};

const extractionSchema = {
  type: "object",
  properties: {
    activityKind: { type: "string" },
    summary: { type: "string" },
    durationMinutes: { type: ["number", "null"] },
    quantities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: ["number", "string"] },
          unit: { type: "string" },
          context: { type: "string" },
        },
        required: ["label", "value"],
      },
    },
    structuredItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },
          name: { type: "string" },
          attributes: {
            type: "object",
            additionalProperties: {
              anyOf: [
                { type: "string" },
                { type: "number" },
                { type: "boolean" },
                { type: "array", items: { type: "string" } },
                { type: "array", items: { type: "number" } },
                { type: "null" },
              ],
            },
          },
        },
        required: ["type", "name", "attributes"],
      },
    },
    tags: { type: "array", items: { type: "string" } },
    people: { type: "array", items: { type: "string" } },
    places: { type: "array", items: { type: "string" } },
    datesOrTimes: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
    confidence: { type: "number" },
  },
  required: [
    "activityKind",
    "summary",
    "durationMinutes",
    "quantities",
    "structuredItems",
    "tags",
    "people",
    "places",
    "datesOrTimes",
    "notes",
    "confidence",
  ],
};

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isAttributeValue(
  value: unknown,
): value is string | number | boolean | string[] | number[] | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  return (
    Array.isArray(value) &&
    (value.every((item) => typeof item === "string") ||
      value.every((item) => typeof item === "number"))
  );
}

function normalizeMetadata(value: unknown): ActivityExtractionMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Ollama returned an invalid extraction object.");
  }

  const record = value as Record<string, unknown>;
  const durationMinutes =
    typeof record.durationMinutes === "number" && Number.isFinite(record.durationMinutes)
      ? record.durationMinutes
      : null;
  const confidence =
    typeof record.confidence === "number" && Number.isFinite(record.confidence)
      ? Math.max(0, Math.min(1, record.confidence))
      : 0;
  const quantities = Array.isArray(record.quantities)
    ? record.quantities
        .filter(
          (quantity): quantity is Record<string, unknown> =>
            typeof quantity === "object" &&
            quantity !== null &&
            !Array.isArray(quantity),
        )
        .filter(
          (quantity) =>
            typeof quantity.label === "string" &&
            (typeof quantity.value === "string" ||
              typeof quantity.value === "number"),
        )
        .map((quantity) => ({
          label: quantity.label as string,
          value: quantity.value as string | number,
          unit: typeof quantity.unit === "string" ? quantity.unit : undefined,
          context:
            typeof quantity.context === "string" ? quantity.context : undefined,
        }))
    : [];
  const structuredItems = Array.isArray(record.structuredItems)
    ? record.structuredItems
        .filter(
          (item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null && !Array.isArray(item),
        )
        .filter(
          (item) =>
            typeof item.type === "string" &&
            typeof item.name === "string" &&
            typeof item.attributes === "object" &&
            item.attributes !== null &&
            !Array.isArray(item.attributes),
        )
        .map((item) => {
          const attributes = Object.fromEntries(
            Object.entries(item.attributes as Record<string, unknown>).filter(
              ([, value]) => isAttributeValue(value),
            ),
          ) as Record<
            string,
            string | number | boolean | string[] | number[] | null
          >;

          return {
            type: item.type as string,
            name: item.name as string,
            attributes,
          };
        })
    : [];

  return {
    activityKind:
      typeof record.activityKind === "string" ? record.activityKind : "activity",
    summary: typeof record.summary === "string" ? record.summary : "",
    durationMinutes,
    quantities,
    structuredItems,
    tags: asStringArray(record.tags),
    people: asStringArray(record.people),
    places: asStringArray(record.places),
    datesOrTimes: asStringArray(record.datesOrTimes),
    notes: typeof record.notes === "string" ? record.notes : undefined,
    confidence,
  };
}

export async function POST(request: Request) {
  let body: ExtractRequest;
  try {
    body = (await request.json()) as ExtractRequest;
  } catch {
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const prompt = `Extract flexible structured metadata from one LifeOS planned activity.
The activity could be anything: running, strength, cycling, reading, cooking, study, work, admin, social, events, travel, creative work, rest, or something else.
Return only valid JSON matching the schema.
Do not invent data. Use null or empty arrays when unknown.
Use quantities for measurable values such as duration, distance, weight, sets, reps, pages, chapters, temperatures, costs, or counts.
Use structuredItems for meaningful entities such as exercises, books, meals, ingredients, routes, topics, projects, people, events, skills, or places.
Preserve ambiguous useful information in notes.

Examples:
1. Log: "I only had 30 minutes so i did squats with a bench, 80kg 5x5 and then i did bench 60 kg 5x5, and did some calve raises both straight leg and bent. 5x12/15"
Expected shape: activityKind "strength"; durationMinutes 30; structuredItems for squat, bench press, straight-leg calf raise, bent-leg calf raise; quantities for weights, sets, reps, or repRange.

2. Log: "Did a 10km hardish run in the heat, couple big hills, left at 12 and got back at 1"
Expected shape: activityKind "running"; durationMinutes 60; quantity distance 10 km; tags include hot, hilly, hardish; datesOrTimes preserve 12 and 1 if useful.

3. Log: "Read The Silmarillion chapter 20 for 35 minutes"
Expected shape: activityKind "reading"; durationMinutes 35; structuredItem book The Silmarillion; quantity chapter 20.

Activity title:
${body.title ?? ""}

Details:
${body.details ?? ""}

Notes:
${body.notes ?? ""}

Raw activity log:
${body.rawLog ?? ""}`;

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: extractionSchema,
        options: {
          temperature: 0,
        },
      }),
    });

    if (!response.ok) {
      return Response.json(
        {
          error:
            "Local extraction is unavailable. Make sure Ollama is running.",
        },
        { status: 503 },
      );
    }

    const ollama = (await response.json()) as { response?: unknown };
    if (typeof ollama.response !== "string") {
      throw new Error("Ollama returned an unexpected response.");
    }

    const metadata = normalizeMetadata(JSON.parse(ollama.response));

    return Response.json({
      metadata,
      extraction: {
        method: "ollama",
        model: OLLAMA_MODEL,
        extractedAt: new Date().toISOString(),
        confidence: metadata.confidence,
        needsReview: metadata.confidence < 0.8,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof SyntaxError
            ? "Local extraction returned invalid JSON. Try again or use a different Ollama model."
            : "Local extraction is unavailable. Make sure Ollama is running.",
      },
      { status: 503 },
    );
  }
}
