import { NextResponse } from "next/server";
import { createGeneratedApp } from "@/lib/actions/templates";
import { syncUser } from "@/lib/actions/sync-user";
import { ensureUserSettings } from "@/lib/settings-data";
import { getAiInstructionContext } from "@/lib/settings";
import {
  GENERATED_TEMPLATE_COMPONENT_TYPES,
  GENERATED_TEMPLATE_ICONS,
  cleanModelJson,
  sanitizeGeneratedTemplate,
} from "@/lib/templates";

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

function parseGeneratedTemplate(content: string, prompt: string) {
  try {
    const parsed = JSON.parse(cleanModelJson(content)) as unknown;
    return sanitizeGeneratedTemplate(parsed, prompt);
  } catch {
    throw new Error("AI returned invalid JSON. Try generating again.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await syncUser();

    if (!user) {
      return NextResponse.json({ error: "Sign in to generate templates." }, { status: 401 });
    }

    const settings = await ensureUserSettings(user.id);
    if (!settings.aiTemplateBuilderEnabled) {
      return NextResponse.json(
        { error: "AI Template Builder is disabled in Settings." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as { prompt?: unknown };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ error: "Enter an app idea before generating." }, { status: 400 });
    }

    if (prompt.length > 2000) {
      return NextResponse.json(
        { error: "Use a shorter prompt for the template builder." },
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
        max_completion_tokens: 5200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You design single-page productivity mini app templates for a dashboard builder.",
              "Return only strict JSON. Do not include markdown, comments, HTML, CSS, JavaScript, code, or prose.",
              "The JSON shape must be:",
              "{\"appName\":\"Habit Tracker\",\"description\":\"Track habits, streaks, and weekly progress.\",\"icon\":\"Flame\",\"layout\":\"single-page\",\"color\":\"#F97316\",\"sections\":[],\"components\":[],\"fields\":[],\"actions\":[],\"sampleData\":[]}.",
              `Allowed icon values: ${GENERATED_TEMPLATE_ICONS.join(", ")}.`,
              `Allowed component types: ${GENERATED_TEMPLATE_COMPONENT_TYPES.join(", ")}.`,
              "Each section should include a title, optional description, and components array.",
              "Component objects must include type and title. Use only these data fields:",
              "stats: [{label,value,helper}], items: [{label,detail,checked,tag}], columns: string[], rows: object[], fields: [{label,type,placeholder,value,options}], actions: [{label,variant}], value, max, label, tags: string[], chartType, sampleData: object[].",
              "Use practical sample data, concise text, and 3 to 6 useful sections/components total.",
              "Use a real hex theme color and layout must be single-page.",
              getAiInstructionContext(settings),
            ].join(" "),
          },
          {
            role: "user",
            content: `App idea prompt:\n${prompt}`,
          },
        ],
      }),
    });

    const data = (await response.json()) as GroqChatCompletionResponse;

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message ?? "Groq could not generate that template right now." },
        { status: response.status }
      );
    }

    const content = data.choices?.[0]?.message?.content ?? "";
    const template = parseGeneratedTemplate(content, prompt);
    const app = await createGeneratedApp({ prompt, template });

    return NextResponse.json({ app });
  } catch (caught) {
    return NextResponse.json(
      {
        error:
          caught instanceof Error
            ? caught.message
            : "AI Template Builder could not process that prompt right now.",
      },
      { status: 500 }
    );
  }
}
