import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const { messages, model } = await req.json();

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENROUTER_API_KEY" },
        { status: 500 }
      );
    }

    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: apiKey,
    });

    const completion = await client.chat.completions.create({
      model: model || "meta-llama/llama-3.3-70b-instruct:free",
      messages: messages,
    });

    return NextResponse.json(completion);
  } catch (error) {
    console.error("OpenRouter Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
