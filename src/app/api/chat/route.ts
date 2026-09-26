import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { buildFallbackCompletion } from "@/lib/aiFallback";
import { extractContext } from "@/lib/chatContext";

export async function POST(req: NextRequest) {
  let body: {
    messages?: unknown;
    model?: string;
    country?: string;
    weapon?: string;
    userMessage?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, model } = body;
  const ctx = extractContext(messages);
  const country = body.country || ctx.country;
  const weapon = body.weapon || ctx.weapon;
  const userMessage = body.userMessage ?? ctx.userMessage;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("[AI] OPENROUTER_API_KEY missing — using local fallback reply.");
    return NextResponse.json({
      ...buildFallbackCompletion(country, weapon, userMessage),
      fallbackReason: "missing_key",
    });
  }

  try {
    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: apiKey,
      timeout: 15_000,
    });

    const completion = await client.chat.completions.create({
      model: model || "meta-llama/llama-3.3-70b-instruct:free",
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
    });

    return NextResponse.json(completion);
  } catch (error) {
    console.error("OpenRouter Error (fallback active):", error);
    return NextResponse.json({
      ...buildFallbackCompletion(country, weapon, userMessage),
      fallbackReason: "api_error",
    });
  }
}

