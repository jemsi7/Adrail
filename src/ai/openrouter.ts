export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type JsonSchemaResponseFormat = {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: boolean;
    schema: Record<string, unknown>;
  };
};

export type OpenRouterConfig = {
  apiKey: string;
  baseUrl: string;
  appUrl?: string;
  appTitle?: string;
  fetchImpl?: typeof fetch;
};

export type OpenRouterChatJsonInput = {
  config: OpenRouterConfig;
  model: string;
  messages: OpenRouterMessage[];
  responseFormat: JsonSchemaResponseFormat;
  temperature?: number;
  maxTokens?: number;
};

export type OpenRouterChatStreamInput = {
  config: OpenRouterConfig;
  model: string;
  messages: OpenRouterMessage[];
  responseFormat?: JsonSchemaResponseFormat;
  temperature?: number;
  maxTokens?: number;
};

export type OpenRouterEmbeddingInput = {
  config: OpenRouterConfig;
  model: string;
  input: string | string[];
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type ChatCompletionStreamResponse = {
  error?: {
    message?: string;
  };
  choices?: Array<{
    delta?: {
      content?: string;
    };
    message?: {
      content?: string;
    };
  }>;
};

type EmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
};

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

export function resolveOpenRouterConfig(input: {
  apiKey?: string;
  baseUrl?: string;
  appUrl?: string;
  appTitle?: string;
  fetchImpl?: typeof fetch;
}): OpenRouterConfig | null {
  const apiKey = input.apiKey?.trim();

  if (!apiKey || apiKey === "replace_me") {
    return null;
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(input.baseUrl ?? DEFAULT_BASE_URL),
    appUrl: input.appUrl,
    appTitle: input.appTitle,
    fetchImpl: input.fetchImpl
  };
}

export function getOpenRouterApiKeyFromEnv(): string | undefined {
  return process.env.OPENROUTER_API_KEY;
}

export function createJsonSchemaResponseFormat(input: {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
}): JsonSchemaResponseFormat {
  return {
    type: "json_schema",
    json_schema: {
      name: input.name,
      strict: input.strict ?? true,
      schema: input.schema
    }
  };
}

export async function callOpenRouterChatJson<T>(
  input: OpenRouterChatJsonInput
): Promise<T> {
  const response = await openRouterFetch(input.config, "/chat/completions", {
    model: input.model,
    messages: input.messages,
    temperature: input.temperature ?? 0.2,
    max_tokens: input.maxTokens ?? 4000,
    response_format: input.responseFormat
  });
  const payload = await response.json() as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenRouter returned an empty structured output response.");
  }

  return JSON.parse(content) as T;
}

export async function* streamOpenRouterChatContent(
  input: OpenRouterChatStreamInput
): AsyncGenerator<string> {
  const response = await openRouterFetch(input.config, "/chat/completions", {
    model: input.model,
    messages: input.messages,
    temperature: input.temperature ?? 0.2,
    max_tokens: input.maxTokens ?? 4000,
    ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
    stream: true
  });

  if (!response.body) {
    throw new Error("OpenRouter returned an empty streaming response body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parsed = extractSsePayloads(buffer);
    buffer = parsed.remainder;

    for (const payload of parsed.payloads) {
      if (payload === "[DONE]") {
        return;
      }

      const chunk = JSON.parse(payload) as ChatCompletionStreamResponse;

      if (chunk.error) {
        throw new Error(chunk.error.message ?? "OpenRouter streaming response returned an error.");
      }

      const content = chunk.choices
        ?.map((choice) => choice.delta?.content ?? choice.message?.content ?? "")
        .join("") ?? "";

      if (content) {
        yield content;
      }
    }
  }

  const tail = decoder.decode();
  const parsed = extractSsePayloads(buffer + tail);

  for (const payload of parsed.payloads) {
    if (payload === "[DONE]") {
      return;
    }

    const chunk = JSON.parse(payload) as ChatCompletionStreamResponse;
    const content = chunk.choices
      ?.map((choice) => choice.delta?.content ?? choice.message?.content ?? "")
      .join("") ?? "";

    if (content) {
      yield content;
    }
  }
}

export async function callOpenRouterEmbedding(
  input: OpenRouterEmbeddingInput
): Promise<number[][]> {
  const response = await openRouterFetch(input.config, "/embeddings", {
    model: input.model,
    input: input.input
  });
  const payload = await response.json() as EmbeddingResponse;
  const embeddings = payload.data?.map((item) => item.embedding).filter(isNumberArray) ?? [];

  if (embeddings.length === 0) {
    throw new Error("OpenRouter returned no embeddings.");
  }

  return embeddings;
}

async function openRouterFetch(
  config: OpenRouterConfig,
  path: string,
  body: Record<string, unknown>
): Promise<Response> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(config.appUrl ? { "HTTP-Referer": config.appUrl } : {}),
      ...(config.appTitle ? { "X-Title": config.appTitle } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenRouter request failed with ${response.status}: ${detail.slice(0, 240)}`);
  }

  return response;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function extractSsePayloads(buffer: string): {
  payloads: string[];
  remainder: string;
} {
  const parts = buffer.split(/\r?\n\r?\n/);
  const remainder = parts.pop() ?? "";
  const payloads = parts
    .map((part) =>
      part
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n")
    )
    .filter(Boolean);

  return { payloads, remainder };
}

function isNumberArray(value: number[] | undefined): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}
