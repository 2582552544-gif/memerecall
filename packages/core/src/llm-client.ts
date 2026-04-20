import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function getLLMClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const baseURL = process.env.MEMERECALL_LLM_BASE_URL || "https://yunwu.ai/v1";
  const apiKey =
    process.env.MEMERECALL_LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";

  if (!apiKey) {
    throw new Error(
      "LLM API key required. Set MEMERECALL_LLM_API_KEY or OPENAI_API_KEY env var.",
    );
  }

  cachedClient = new OpenAI({ baseURL, apiKey });
  return cachedClient;
}

export function getLLMModel(): string {
  return process.env.MEMERECALL_LLM_MODEL || "gpt-5.4";
}
