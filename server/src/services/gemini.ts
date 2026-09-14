import { AppError } from "../utils/errors.js";

const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-flash-latest",
];

export function geminiKey(): string | null {
  return process.env.GEMINI_API_KEY?.trim() || null;
}

export function aiUnavailable(message = "AI временно недоступен."): AppError {
  return new AppError("AI_UNAVAILABLE", message, 503);
}

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string }; functionCall?: { name: string; args?: Record<string, unknown> } };
type GeminiContent = { role: string; parts: GeminiPart[] };

function extractText(json: { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> }): string {
  const parts = json.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim();
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AppError("AI_PARSE", "Не удалось разобрать ответ AI.", 502);
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

function mapGeminiHttpError(status: number, message?: string): AppError {
  const m = (message || "").toLowerCase();
  if (status === 401 || status === 403) {
    if (m.includes("api key not valid") || m.includes("invalid")) {
      return aiUnavailable("Gemini не принял API-ключ. Создайте новый ключ в Google AI Studio и вставьте его в .env.");
    }
    return aiUnavailable("Gemini отклонил ключ. Проверьте GEMINI_API_KEY в .env и перезапустите сервер.");
  }
  if (status === 429 || m.includes("quota") || m.includes("resource exhausted")) {
    return aiUnavailable("Лимит Gemini исчерпан. Попробуйте позже.");
  }
  return aiUnavailable(message?.trim() ? "AI временно недоступен. Попробуйте позже." : undefined);
}

async function callModel(model: string, body: Record<string, unknown>, key: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    error?: { message?: string; status?: string };
    candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  };
  return { ok: res.ok, status: res.status, json };
}

export async function geminiGenerate(opts: {
  system: string;
  parts: GeminiPart[];
  tools?: unknown[];
  json?: boolean;
}): Promise<{ text: string; functionCalls: Array<{ name: string; args: Record<string, unknown> }> }> {
  const key = geminiKey();
  if (!key) throw aiUnavailable();

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: {
      temperature: 0.2,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (opts.tools?.length) body.tools = opts.tools;

  let lastErr = "AI временно недоступен.";
  for (const model of MODELS) {
    try {
      const { ok, status, json } = await callModel(model, body, key);
      if (!ok) {
        lastErr = json.error?.message || lastErr;
        const notFound = json.error?.status === "NOT_FOUND" || lastErr.toLowerCase().includes("not found");
        if (notFound) continue;
        if (opts.json && (status === 400 || lastErr.toLowerCase().includes("response mime"))) {
          const retry = await callModel(model, {
            ...body,
            generationConfig: { temperature: 0.2 },
          }, key);
          if (retry.ok) {
            const parts = retry.json.candidates?.[0]?.content?.parts || [];
            return { text: extractText(retry.json), functionCalls: [] };
          }
        }
        throw mapGeminiHttpError(status, json.error?.message);
      }
      const parts = json.candidates?.[0]?.content?.parts || [];
      const functionCalls = parts
        .filter((p) => p.functionCall?.name)
        .map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args || {} }));
      return { text: extractText(json), functionCalls };
    } catch (e) {
      if (e instanceof AppError) throw e;
      lastErr = e instanceof Error ? e.message : lastErr;
    }
  }
  throw aiUnavailable(lastErr.includes("not found") ? undefined : lastErr);
}

export async function geminiJson<T>(opts: {
  system: string;
  parts: GeminiPart[];
  parseError?: string;
}): Promise<T> {
  const { text } = await geminiGenerate({ ...opts, json: true });
  if (!text) throw new AppError("AI_PARSE", opts.parseError || "Не удалось разобрать ответ AI.", 422);
  try {
    return parseJson<T>(text);
  } catch {
    throw new AppError("AI_PARSE", opts.parseError || "Не удалось разобрать ответ AI.", 422);
  }
}

export async function geminiChat(opts: {
  system: string;
  history: GeminiContent[];
  tools: unknown[];
}): Promise<{ text: string; functionCalls: Array<{ name: string; args: Record<string, unknown> }> }> {
  const key = geminiKey();
  if (!key) throw aiUnavailable();

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: opts.history,
    tools: opts.tools,
    generationConfig: { temperature: 0.2 },
  };

  let lastErr = "AI временно недоступен.";
  for (const model of MODELS) {
    try {
      const { ok, status, json } = await callModel(model, body, key);
      if (!ok) {
        lastErr = json.error?.message || lastErr;
        const notFound = json.error?.status === "NOT_FOUND" || lastErr.toLowerCase().includes("not found");
        if (notFound) continue;
        throw mapGeminiHttpError(status, json.error?.message);
      }
      const parts = json.candidates?.[0]?.content?.parts || [];
      const functionCalls = parts
        .filter((p) => p.functionCall?.name)
        .map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args || {} }));
      return { text: extractText(json), functionCalls };
    } catch (e) {
      if (e instanceof AppError) throw e;
      lastErr = e instanceof Error ? e.message : lastErr;
    }
  }
  throw aiUnavailable(lastErr);
}

export type { GeminiContent, GeminiPart };
