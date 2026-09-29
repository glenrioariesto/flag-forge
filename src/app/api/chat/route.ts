import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { buildFallbackCompletion } from "@/lib/aiFallback";
import { extractContext } from "@/lib/chatContext";
import { checkChatRateLimit, extractClientIp, retryAfterSeconds } from "@/lib/rateLimit";

// Guardrails: public route — bound cost/abuse surface before calling OpenRouter.
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 1000;
const MAX_TOTAL_CHARS = 6000;
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

// The route is unauthenticated, so a client-supplied `model` would otherwise
// turn it into an open proxy that can spend this deployment's OpenRouter
// credit on any paid model. Only serve models we explicitly ship.
const ALLOWED_MODELS = new Set<string>([DEFAULT_MODEL]);

function resolveModel(requested: unknown): string {
  return typeof requested === "string" && ALLOWED_MODELS.has(requested)
    ? requested
    : DEFAULT_MODEL;
}

type SanitizeResult =
  | { ok: true; value: OpenAI.Chat.ChatCompletionMessageParam[] }
  | { ok: false; error: string };

function sanitizeMessages(messages: unknown): SanitizeResult {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "messages must be a non-empty array" };
  }
  const sliced = messages.slice(-MAX_MESSAGES);
  const clean: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  let total = 0;
  for (const m of sliced) {
    if (typeof m !== "object" || m === null) {
      return { ok: false, error: "invalid message entry" };
    }
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (
      (role !== "system" && role !== "user" && role !== "assistant") ||
      typeof content !== "string"
    ) {
      return { ok: false, error: "invalid message shape" };
    }
    const trimmed = content.slice(0, MAX_MESSAGE_CHARS);
    total += trimmed.length;
    if (total > MAX_TOTAL_CHARS) {
      return { ok: false, error: "conversation too long" };
    }
    clean.push({ role, content: trimmed });
  }
  return { ok: true, value: clean };
}

export async function POST(req: NextRequest) {
  // Checked before any parsing or spend so an abusive caller cannot make the
  // server do work on its behalf.
  const decision = await checkChatRateLimit(req.headers);
  if (decision.limited) {
    console.warn(`[AI] Rate limit hit — rejecting request (${extractClientIp(req.headers) ?? "unknown"}).`);
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds(decision)),
          "X-RateLimit-Limit": String(decision.limit),
          "X-RateLimit-Remaining": String(decision.remaining),
          "X-RateLimit-Reset": String(Math.ceil(decision.resetMs / 1000)),
        },
      },
    );
  }

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
  const sanitized = sanitizeMessages(messages);
  // Fallback context must still work for legacy/empty payloads.
  const ctx = extractContext(messages);
  const country = body.country || ctx.country;
  const weapon = body.weapon || ctx.weapon;
  const userMessage = body.userMessage ?? ctx.userMessage;

  if (!sanitized.ok) {
    console.warn("[AI] Invalid chat payload — using local fallback reply.");
    return NextResponse.json({
      ...buildFallbackCompletion(country, weapon, userMessage),
      fallbackReason: "invalid_payload",
    });
  }

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
      model: resolveModel(model),
      messages: sanitized.value,
      max_tokens: 150,
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

