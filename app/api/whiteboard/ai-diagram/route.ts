import { NextResponse } from "next/server";
import { syncUser } from "@/lib/actions/sync-user";
import { ensureUserSettings } from "@/lib/settings-data";
import { getAiInstructionContext } from "@/lib/settings";

type DiagramElement = Record<string, unknown>;

type GroqChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

const allowedTypes = new Set(["rectangle", "ellipse", "diamond", "arrow", "line", "text"]);
const allowedFillStyles = new Set(["hachure", "cross-hatch", "solid"]);
const allowedStrokeStyles = new Set(["solid", "dashed", "dotted"]);
const allowedArrowheads = new Set(["arrow", "bar", "dot", "triangle", null]);
const allowedTextAlign = new Set(["left", "center", "right"]);
const allowedVerticalAlign = new Set(["top", "middle", "bottom"]);
const hexColorPattern = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;

function cleanModelJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return cleaned;
  }

  return cleaned.slice(start, end + 1);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function cleanColor(value: unknown, fallback: string) {
  return typeof value === "string" && hexColorPattern.test(value) ? value : fallback;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanPoints(value: unknown) {
  if (!Array.isArray(value)) {
    return [
      [0, 0],
      [160, 0],
    ];
  }

  const points = value
    .slice(0, 5)
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null;
      return [
        clampNumber(point[0], -1200, 1200, 0),
        clampNumber(point[1], -1200, 1200, 0),
      ];
    })
    .filter(Boolean) as number[][];

  return points.length >= 2
    ? points
    : [
        [0, 0],
        [160, 0],
      ];
}

function sanitizeLabel(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const label = value as Record<string, unknown>;
  const text = cleanText(label.text, 90);
  if (!text) return null;

  return {
    text,
    fontSize: clampNumber(label.fontSize, 12, 28, 16),
    strokeColor: cleanColor(label.strokeColor, "#1E293B"),
  };
}

function sanitizeElement(value: unknown, index: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as DiagramElement;
  const type = typeof raw.type === "string" && allowedTypes.has(raw.type) ? raw.type : null;
  if (!type) return null;

  const element: DiagramElement = {
    type,
    x: clampNumber(raw.x, -400, 2200, (index % 4) * 240),
    y: clampNumber(raw.y, -400, 1800, Math.floor(index / 4) * 150),
    strokeColor: cleanColor(raw.strokeColor, "#1E293B"),
    backgroundColor:
      typeof raw.backgroundColor === "string" && raw.backgroundColor === "transparent"
        ? "transparent"
        : cleanColor(raw.backgroundColor, type === "text" || type === "line" || type === "arrow" ? "transparent" : "#F5F3FF"),
    fillStyle:
      typeof raw.fillStyle === "string" && allowedFillStyles.has(raw.fillStyle)
        ? raw.fillStyle
        : "solid",
    strokeWidth: clampNumber(raw.strokeWidth, 1, 4, 2),
    strokeStyle:
      typeof raw.strokeStyle === "string" && allowedStrokeStyles.has(raw.strokeStyle)
        ? raw.strokeStyle
        : "solid",
    roughness: clampNumber(raw.roughness, 0, 2, 1),
    opacity: clampNumber(raw.opacity, 20, 100, 100),
    customData: {
      kind: "ai-diagram",
    },
  };

  if (type === "text") {
    element.text = cleanText(raw.text, 120) || "Label";
    element.fontSize = clampNumber(raw.fontSize, 12, 36, 20);
    element.fontFamily = clampNumber(raw.fontFamily, 1, 3, 2);
    element.textAlign =
      typeof raw.textAlign === "string" && allowedTextAlign.has(raw.textAlign)
        ? raw.textAlign
        : "center";
    element.verticalAlign =
      typeof raw.verticalAlign === "string" && allowedVerticalAlign.has(raw.verticalAlign)
        ? raw.verticalAlign
        : "middle";
    return element;
  }

  if (type === "line" || type === "arrow") {
    element.points = cleanPoints(raw.points);
    element.endArrowhead =
      type === "arrow" && allowedArrowheads.has(raw.endArrowhead as string | null)
        ? raw.endArrowhead
        : type === "arrow"
          ? "arrow"
          : null;
    element.startArrowhead =
      type === "arrow" && allowedArrowheads.has(raw.startArrowhead as string | null)
        ? raw.startArrowhead
        : null;
    return element;
  }

  element.width = clampNumber(raw.width, 60, 420, 190);
  element.height = clampNumber(raw.height, 40, 260, 82);

  const label = sanitizeLabel(raw.label);
  if (label) {
    element.label = label;
  }

  return element;
}

function parseDiagramElements(content: string) {
  const parsed = JSON.parse(cleanModelJson(content)) as {
    elements?: unknown;
    message?: unknown;
  };

  if (!Array.isArray(parsed.elements)) {
    throw new Error("AI did not return diagram elements.");
  }

  const elements = parsed.elements
    .slice(0, 28)
    .map(sanitizeElement)
    .filter(Boolean) as DiagramElement[];

  if (elements.length === 0) {
    throw new Error("AI returned an empty diagram.");
  }

  return {
    elements,
    message: cleanText(parsed.message, 180) || undefined,
  };
}

export async function POST(request: Request) {
  try {
    const user = await syncUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to use AI Diagram." }, { status: 401 });
    }

    const settings = await ensureUserSettings(user.id);
    if (!settings.aiDiagramEnabled) {
      return NextResponse.json({ error: "AI Diagram is disabled in Settings." }, { status: 403 });
    }

    const body = (await request.json()) as { prompt?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ error: "Enter a prompt for the diagram." }, { status: 400 });
    }

    if (prompt.length > 2000) {
      return NextResponse.json(
        { error: "Use a shorter prompt for the diagram." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Groq is not configured. Add GROQ_API_KEY to the environment." },
        { status: 503 }
      );
    }

    const model = settings.aiModel || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_completion_tokens: 2600,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You generate editable Excalidraw diagram skeleton JSON for a whiteboard.",
              "Return only strict JSON with this shape: {\"elements\": [...], \"message\": \"optional short note\"}.",
              "Allowed element types are rectangle, ellipse, diamond, arrow, line, and text.",
              "Use x, y, width, height, strokeColor, backgroundColor, fillStyle, strokeWidth, strokeStyle, roughness, opacity.",
              "For labeled shapes, prefer label: { text, fontSize, strokeColor } instead of separate text.",
              "For arrows and lines, use points like [[0,0],[160,0]] and endArrowhead: \"arrow\" for arrows.",
              "Use coordinates near origin, leave generous spacing, and create 6 to 18 elements.",
              "Support flowcharts, mind maps, system architecture diagrams, user journeys, and process diagrams.",
              "Do not include markdown, comments, prose, links, images, or unsupported fields.",
              getAiInstructionContext(settings),
            ].join(" "),
          },
          {
            role: "user",
            content: `Diagram prompt:\n${prompt}`,
          },
        ],
      }),
    });

    const data = (await response.json()) as GroqChatCompletionResponse;

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message ?? "Groq could not generate that diagram right now." },
        { status: response.status }
      );
    }

    const content = data.choices?.[0]?.message?.content ?? "";
    const diagram = parseDiagramElements(content);

    return NextResponse.json(diagram);
  } catch (caught) {
    return NextResponse.json(
      {
        error:
          caught instanceof Error
            ? caught.message
            : "AI Diagram could not process that prompt right now.",
      },
      { status: 500 }
    );
  }
}
