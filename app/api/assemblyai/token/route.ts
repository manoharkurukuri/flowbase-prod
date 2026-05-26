import { NextResponse } from "next/server";
import { syncUser } from "@/lib/actions/sync-user";

type AssemblyAITokenResponse = {
  token?: string;
  error?: string;
};

export async function POST() {
  try {
    const user = await syncUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.ASSEMBLYAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "AssemblyAI is not configured. Add ASSEMBLYAI_API_KEY to the environment." },
        { status: 503 }
      );
    }

    const params = new URLSearchParams({
      expires_in_seconds: "60",
    });

    const response = await fetch(`https://streaming.assemblyai.com/v3/token?${params}`, {
      method: "GET",
      headers: {
        Authorization: apiKey,
      },
      cache: "no-store",
    });

    const data = (await response.json().catch(() => ({}))) as AssemblyAITokenResponse;

    if (!response.ok || !data.token) {
      return NextResponse.json(
        { error: data.error ?? "AssemblyAI could not create a streaming token." },
        { status: response.ok ? 502 : response.status }
      );
    }

    return NextResponse.json({ token: data.token });
  } catch {
    return NextResponse.json(
      { error: "AssemblyAI streaming token could not be created." },
      { status: 500 }
    );
  }
}
