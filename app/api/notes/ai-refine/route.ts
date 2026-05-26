import { NextResponse } from "next/server";
import { syncUser } from "@/lib/actions/sync-user";
import { AI_REFINE_ACTIONS, type AiRefineAction } from "@/lib/notes";
import { ensureUserSettings } from "@/lib/settings-data";
import { getAiInstructionContext } from "@/lib/settings";

const actionInstructions: Record<AiRefineAction, string> = {
  "improve-grammar":
    "Fix grammar, spelling, punctuation, and clarity while preserving the meaning and voice.",
  rephrase:
    "Rewrite the text in a fresh way while preserving the meaning, useful details, and approximate length.",
  "make-shorter":
    "Make the text more concise while preserving the key meaning and necessary details.",
  "make-longer":
    "Expand the text with natural detail and smoother flow while preserving the original meaning.",
  "simplify-language":
    "Use simpler, clearer language while preserving the original meaning and helpful nuance.",
  "change-tone":
    "Make the tone warmer, clearer, and more polished while preserving the original meaning.",
};

function isAiRefineAction(value: unknown): value is AiRefineAction {
  return AI_REFINE_ACTIONS.includes(value as AiRefineAction);
}

function cleanModelText(text: string) {
  return text
    .trim()
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

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

export async function POST(request: Request) {
  try {
    const user = await syncUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in to use AI Refine." }, { status: 401 });
    }

    const settings = await ensureUserSettings(user.id);
    if (!settings.aiRefineEnabled) {
      return NextResponse.json({ error: "AI Refine is disabled in Settings." }, { status: 403 });
    }

    const body = (await request.json()) as {
      action?: unknown;
      selectedText?: unknown;
    };

    const action = body.action;

    if (!isAiRefineAction(action)) {
      return NextResponse.json({ error: "Choose a valid AI refine action." }, { status: 400 });
    }

    const selectedText = typeof body.selectedText === "string" ? body.selectedText.trim() : "";

    if (!selectedText) {
      return NextResponse.json({ error: "Select text before using AI Refine." }, { status: 400 });
    }

    if (selectedText.length > 8000) {
      return NextResponse.json(
        { error: "Select a smaller passage before using AI Refine." },
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
        temperature: 0.35,
        max_completion_tokens: 2048,
        messages: [
          {
            role: "system",
            content: [
              "You refine selected note text for a rich text editor.",
              "Return only the replacement text.",
              "Do not wrap the answer in quotes or markdown fences.",
              "Do not add commentary, labels, or explanations.",
              getAiInstructionContext(settings),
              actionInstructions[action],
            ].join(" "),
          },
          {
            role: "user",
            content: `Selected text:\n${selectedText}`,
          },
        ],
      }),
    });

    const data = (await response.json()) as GroqChatCompletionResponse;

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message ?? "Groq could not refine that text right now." },
        { status: response.status }
      );
    }

    const text = cleanModelText(data.choices?.[0]?.message?.content ?? "");

    if (!text) {
      return NextResponse.json(
        { error: "Groq returned an empty refinement. Try a different selection." },
        { status: 502 }
      );
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: "AI Refine could not process that text right now." },
      { status: 500 }
    );
  }
}
