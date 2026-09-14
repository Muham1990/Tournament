import { AppError } from "../utils/errors.js";
import { geminiJson, geminiKey } from "./gemini.js";

export type AiProvider = "gemini" | "groq" | "openrouter";

export const AI_PROVIDERS: AiProvider[] = ["gemini", "groq", "openrouter"];

export function aiUnavailable(message = "AI временно недоступен."): AppError {
  return new AppError("AI_UNAVAILABLE", message, 503);
}

export function parseProvider(raw: unknown): AiProvider {
  const v = String(raw || "gemini").toLowerCase();
  return AI_PROVIDERS.includes(v as AiProvider) ? (v as AiProvider) : "gemini";
}

export function parseFallback(raw: unknown) {
  return raw === true || raw === "true" || raw === "1" || raw === "on";
}

function keyOf(p: AiProvider): string | null {
  if (p === "gemini") return process.env.GEMINI_API_KEY?.trim() || null;
  if (p === "groq") return process.env.GROQ_API_KEY?.trim() || null;
  return process.env.OPENROUTER_API_KEY?.trim() || null;
}

export function configuredProviders() {
  return {
    gemini: Boolean(keyOf("gemini") || geminiKey()),
    groq: Boolean(keyOf("groq")),
    openrouter: Boolean(keyOf("openrouter")),
  };
}

export function providersToTry(preferred: AiProvider, fallback: boolean): AiProvider[] {
  const order = fallback
    ? [preferred, ...AI_PROVIDERS.filter((p) => p !== preferred)]
    : [preferred];
  return order.filter((p) => keyOf(p));
}

function parseJsonObject<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AppError("AI_PARSE", "Не удалось разобрать ответ AI.", 502);
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

function mapHttpError(name: string, status: number, message?: string): AppError {
  const m = (message || "").toLowerCase();
  if (status === 401 || status === 403) {
    return aiUnavailable(`${name} отклонил ключ. Проверьте API-ключ в .env.`);
  }
  if (status === 429 || m.includes("quota") || m.includes("rate")) {
    return aiUnavailable(`Лимит ${name} исчерпан. Попробуйте позже.`);
  }
  return aiUnavailable();
}

async function openaiChatJson(opts: {
  url: string;
  key: string;
  models: string[];
  system: string;
  user: unknown;
  extraHeaders?: Record<string, string>;
  name: string;
}): Promise<string> {
  let last = aiUnavailable();
  for (const model of opts.models) {
    const res = await fetch(opts.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.key}`,
        ...opts.extraHeaders,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${opts.system}\nОтвет строго в JSON.` },
          { role: "user", content: opts.user },
        ],
      }),
    });
    const json = (await res.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!res.ok) {
      last = mapHttpError(opts.name, res.status, json.error?.message);
      if (res.status === 404 || json.error?.message?.toLowerCase().includes("not exist") || json.error?.message?.toLowerCase().includes("no endpoints")) {
        continue;
      }
      throw last;
    }
    const text = json.choices?.[0]?.message?.content?.trim() || "";
    if (!text) throw new AppError("AI_PARSE", "Не удалось разобрать ответ AI.", 502);
    return text;
  }
  throw last;
}

async function groqTranscribe(buf: Buffer, mime: string): Promise<string> {
  const key = keyOf("groq");
  if (!key) throw aiUnavailable();
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(buf)], { type: mime }), "voice.webm");
  fd.append("model", "whisper-large-v3");
  fd.append("language", "ru");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: fd,
  });
  const json = (await res.json()) as { text?: string; error?: { message?: string } };
  if (!res.ok) throw mapHttpError("Groq", res.status, json.error?.message);
  return json.text?.trim() || "";
}

async function openrouterTranscribe(buf: Buffer, mime: string): Promise<string> {
  const key = keyOf("openrouter");
  if (!key) throw aiUnavailable();
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array(buf)], { type: mime }), "voice.webm");
  fd.append("model", "openai/whisper-large-v3");
  const res = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:5173",
      "X-Title": "Kumite Arena",
    },
    body: fd,
  });
  const json = (await res.json()) as { text?: string; error?: { message?: string } };
  if (!res.ok) throw new AppError("STT_UNSUPPORTED", "Этот AI не поддерживает распознавание речи. Введите фразу текстом или выберите Gemini / Groq.", 422);
  return json.text?.trim() || "";
}

export async function aiJson<T>(opts: {
  provider: AiProvider;
  fallback: boolean;
  system: string;
  text: string;
  image?: { mimeType: string; data: string };
  parseError?: string;
}): Promise<{ data: T; used: AiProvider }> {
  const list = providersToTry(opts.provider, opts.fallback).filter((p) => !(opts.image && p === "groq"));
  if (!list.length) throw opts.image ? visionUnsupported() : aiUnavailable();

  let last: unknown = aiUnavailable();
  for (const p of list) {
    try {
      if (opts.image && p === "groq") {
        throw visionUnsupported();
      }
      if (opts.image && p === "openrouter") {
        const text = await openaiChatJson({
          url: "https://openrouter.ai/api/v1/chat/completions",
          key: keyOf("openrouter")!,
          models: ["openai/gpt-4o-mini", "openai/gpt-4o", "meta-llama/llama-3.3-70b-instruct"],
          system: opts.system,
          name: "OpenRouter",
          extraHeaders: {
            "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:5173",
            "X-Title": "Kumite Arena",
          },
          user: [
            { type: "text", text: opts.text },
            { type: "image_url", image_url: { url: `data:${opts.image.mimeType};base64,${opts.image.data}` } },
          ],
        });
        return { data: parseJsonObject<T>(text), used: p };
      }
      if (opts.image && p === "gemini") {
        const data = await geminiJson<T>({
          system: opts.system,
          parts: [
            { text: opts.text },
            { inlineData: { mimeType: opts.image.mimeType, data: opts.image.data } },
          ],
          parseError: opts.parseError,
        });
        return { data, used: p };
      }
      if (p === "gemini") {
        const data = await geminiJson<T>({
          system: opts.system,
          parts: [{ text: opts.text }],
          parseError: opts.parseError,
        });
        return { data, used: p };
      }
      if (p === "groq") {
        const text = await openaiChatJson({
          url: "https://api.groq.com/openai/v1/chat/completions",
          key: keyOf("groq")!,
          models: ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.6-27b"],
          system: opts.system,
          name: "Groq",
          user: opts.text,
        });
        return { data: parseJsonObject<T>(text), used: p };
      }
      const text = await openaiChatJson({
        url: "https://openrouter.ai/api/v1/chat/completions",
        key: keyOf("openrouter")!,
        models: ["openai/gpt-4o-mini", "meta-llama/llama-3.3-70b-instruct"],
        system: opts.system,
        name: "OpenRouter",
        extraHeaders: {
          "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:5173",
          "X-Title": "Kumite Arena",
        },
        user: opts.text,
      });
      return { data: parseJsonObject<T>(text), used: p };
    } catch (e) {
      last = e;
      const code = (e as { code?: string }).code;
      if (!opts.fallback) throw e;
      if (code === "VISION_UNSUPPORTED" && list[list.length - 1] === p) throw e;
    }
  }
  throw last instanceof Error ? last : aiUnavailable();
}

export async function transcribeAudio(opts: {
  provider: AiProvider;
  fallback: boolean;
  buffer: Buffer;
  mimeType: string;
}): Promise<{ text: string; used: AiProvider }> {
  const list = providersToTry(opts.provider, opts.fallback);
  if (!list.length) throw aiUnavailable();
  const raw = opts.mimeType.split(";")[0] || "audio/webm";
  const mime = raw.startsWith("audio/")
    ? raw
    : raw === "video/webm"
      ? "audio/webm"
      : raw.includes("3gpp")
        ? "audio/3gpp"
        : raw.includes("mp4")
          ? "audio/mp4"
          : "audio/mp4";
  let last: unknown = aiUnavailable();
  for (const p of list) {
    try {
      if (p === "gemini") {
        const data = await geminiJson<{ transcript: string }>({
          system: "Расшифруй речь. Верни ТОЛЬКО JSON {\"transcript\":string}.",
          parts: [
            { text: "Это запись речи администратора." },
            { inlineData: { mimeType: mime.startsWith("audio/") ? mime : "audio/webm", data: opts.buffer.toString("base64") } },
          ],
        });
        const text = data.transcript?.trim() || "";
        if (!text) throw new AppError("NO_TEXT", "Пустая речь.", 400);
        return { text, used: p };
      }
      if (p === "groq") {
        const text = await groqTranscribe(opts.buffer, mime);
        if (!text) throw new AppError("NO_TEXT", "Пустая речь.", 400);
        return { text, used: p };
      }
      const text = await openrouterTranscribe(opts.buffer, mime);
      if (!text) throw new AppError("NO_TEXT", "Пустая речь.", 400);
      return { text, used: p };
    } catch (e) {
      last = e;
      if (!opts.fallback) throw e;
    }
  }
  throw last instanceof Error ? last : aiUnavailable();
}

export function visionUnsupported() {
  return new AppError(
    "VISION_UNSUPPORTED",
    "Этот AI не поддерживает анализ изображений. Выберите Gemini или совместимый AI.",
    422,
  );
}
