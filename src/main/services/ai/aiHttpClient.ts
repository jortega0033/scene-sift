import { app, net } from 'electron';
import { AppError } from '../../utils/errors';
import { AI_ERROR_MESSAGES } from '@shared/schemas/ai';
import type { AiErrorCode } from '@shared/schemas/ai';

export type AiResponseRaw = {
  finishReason: string | null;
  content: string;
};

export type PostPayload = {
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  maxOutputTokens: number;
  skipResponseFormat?: boolean;
  outputJsonSchema?: object;
};

export type PostOptions = {
  endpoint: string;
  model: string;
  apiKey: string;
  signal: AbortSignal;
  timeoutMs: number;
};

export interface AiHttpClient {
  post(payload: PostPayload, options: PostOptions): Promise<AiResponseRaw>;
}

const MAX_RESPONSE_BYTES = 512_000;

function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => parseInt(p, 10));
  if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) return false;
  const a = octets[0]!;
  const b = octets[1]!;
  return (
    a === 0 ||          // 0.0.0.0/8 — unspecified; OS-dependent loopback-equivalent
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

// WHATWG URL normalises [::ffff:a.b.c.d] → hostname ::ffff:XXXX:YYYY (IPv4-mapped)
// and [::a.b.c.d] → ::XXXX:YYYY (IPv4-compatible, deprecated RFC 4291).
// Extract the embedded IPv4 dotted-decimal so isPrivateIPv4 can evaluate it.
function embeddedIPv4FromIPv6(lower: string): string | null {
  const m =
    lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/) ??
    lower.match(/^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!m) return null;
  const hi = parseInt(m[1] as string, 16);
  const lo = parseInt(m[2] as string, 16);
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isBlockedIPv6(raw: string): boolean {
  const ip = raw.startsWith('[') ? raw.slice(1, -1) : raw;
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  if (/^fe[89ab][0-9a-f]:/i.test(lower)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;
  const embedded = embeddedIPv4FromIPv6(lower);
  if (embedded !== null) return isPrivateIPv4(embedded);
  return false;
}

function isLocalAllowed(): boolean {
  return (
    process.env.SCENESIFT_ALLOW_LOCAL_AI_ENDPOINT === '1' && app.isPackaged === false
  );
}

export function validateEndpoint(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError('AI_ENDPOINT_NOT_ALLOWED', AI_ERROR_MESSAGES.AI_ENDPOINT_NOT_ALLOWED);
  }

  if (url.username || url.password) {
    throw new AppError('AI_ENDPOINT_NOT_ALLOWED', AI_ERROR_MESSAGES.AI_ENDPOINT_NOT_ALLOWED);
  }

  const hostname = url.hostname.toLowerCase();
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';

  if (url.protocol !== 'https:') {
    if (!isLocalhost || !isLocalAllowed()) {
      throw new AppError('AI_ENDPOINT_NOT_ALLOWED', AI_ERROR_MESSAGES.AI_ENDPOINT_NOT_ALLOWED);
    }
    return url;
  }

  if (isLocalhost) {
    if (!isLocalAllowed()) {
      throw new AppError('AI_ENDPOINT_NOT_ALLOWED', AI_ERROR_MESSAGES.AI_ENDPOINT_NOT_ALLOWED);
    }
    return url;
  }

  if (isPrivateIPv4(hostname)) {
    throw new AppError('AI_ENDPOINT_NOT_ALLOWED', AI_ERROR_MESSAGES.AI_ENDPOINT_NOT_ALLOWED);
  }

  if (isBlockedIPv6(hostname)) {
    throw new AppError('AI_ENDPOINT_NOT_ALLOWED', AI_ERROR_MESSAGES.AI_ENDPOINT_NOT_ALLOWED);
  }

  return url;
}

function mapHttpStatus(status: number): AiErrorCode {
  if (status === 401) return 'AI_AUTHENTICATION_FAILED';
  if (status === 403) return 'AI_FORBIDDEN';
  if (status === 404) return 'AI_INVALID_CONFIGURATION';
  if (status === 400) return 'AI_INVALID_CONFIGURATION';
  if (status === 408) return 'AI_TIMEOUT';
  if (status === 413) return 'AI_REQUEST_TOO_LARGE';
  if (status === 422) return 'AI_INVALID_CONFIGURATION';
  if (status === 429) return 'AI_RATE_LIMITED';
  if (status >= 500) return 'AI_PROVIDER_UNAVAILABLE';
  if (status >= 300 && status < 400) return 'AI_REDIRECT_NOT_ALLOWED';
  return 'AI_PROVIDER_UNAVAILABLE';
}

const RETRYABLE: Set<AiErrorCode> = new Set([
  'AI_RATE_LIMITED',
  'AI_PROVIDER_UNAVAILABLE',
  'AI_NETWORK_ERROR',
  'AI_TIMEOUT',
  'AI_INVALID_RESPONSE',
]);

const MAX_RETRIES: Record<string, number> = {
  AI_RATE_LIMITED: 3,
  AI_PROVIDER_UNAVAILABLE: 3,
  AI_NETWORK_ERROR: 3,
  AI_TIMEOUT: 2,
  AI_INVALID_RESPONSE: 2,
};

async function fetchWithCap(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  userSignal: AbortSignal,
): Promise<{ response: Response; bodyBytes: Uint8Array; totalBytes: number }> {
  const timeoutController = new AbortController();
  const combined = new AbortController();
  let timedOut = false;

  const onAbort = () => combined.abort();
  userSignal.addEventListener('abort', onAbort, { once: true });
  const timeoutId = setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
    combined.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: combined.signal,
      redirect: 'manual',
    });

    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
      throw new AppError('AI_REDIRECT_NOT_ALLOWED', AI_ERROR_MESSAGES.AI_REDIRECT_NOT_ALLOWED);
    }

    if (!response.body) {
      throw new AppError('AI_INVALID_RESPONSE', AI_ERROR_MESSAGES.AI_INVALID_RESPONSE);
    }

    const reader = response.body.getReader();
    let totalBytes = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        reader.cancel().catch(() => {});
        throw new AppError('AI_RESPONSE_TOO_LARGE', AI_ERROR_MESSAGES.AI_RESPONSE_TOO_LARGE);
      }
      chunks.push(value);
    }

    const bodyBytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bodyBytes.set(chunk, offset);
      offset += chunk.length;
    }

    return { response, bodyBytes, totalBytes };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const name = (err as Error).name;
    if (name === 'AbortError') {
      if (userSignal.aborted) {
        throw new AppError('AI_REQUEST_CANCELLED', AI_ERROR_MESSAGES.AI_REQUEST_CANCELLED);
      }
      if (timedOut) {
        throw new AppError('AI_TIMEOUT', AI_ERROR_MESSAGES.AI_TIMEOUT);
      }
      throw new AppError('AI_REQUEST_CANCELLED', AI_ERROR_MESSAGES.AI_REQUEST_CANCELLED);
    }
    throw new AppError('AI_NETWORK_ERROR', AI_ERROR_MESSAGES.AI_NETWORK_ERROR);
  } finally {
    clearTimeout(timeoutId);
    userSignal.removeEventListener('abort', onAbort);
  }
}

function parseRetryAfter(header: string | null, backoffMs: number): number {
  if (!header) return backoffMs;
  const seconds = parseInt(header, 10);
  if (!isNaN(seconds)) return Math.min(seconds * 1000, 60_000);
  return backoffMs;
}

function backoff(attempt: number): number {
  const base = Math.min(1000 * Math.pow(2, attempt), 8000);
  const jitter = (Math.random() * 400) - 200;
  return Math.max(0, base + jitter);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AiHttpClientImpl implements AiHttpClient {
  async post(payload: PostPayload, options: PostOptions): Promise<AiResponseRaw> {
    const { endpoint, model, apiKey, signal, timeoutMs, maxOutputTokens, skipResponseFormat, outputJsonSchema } = {
      ...payload,
      ...options,
    };

    if (!net.isOnline()) {
      throw new AppError('AI_OFFLINE', AI_ERROR_MESSAGES.AI_OFFLINE);
    }

    const endpointUrl = validateEndpoint(endpoint);
    const chatUrl = endpointUrl.origin + '/v1/chat/completions';

    const body: Record<string, unknown> = {
      model,
      messages: payload.messages,
      max_tokens: maxOutputTokens,
      max_completion_tokens: maxOutputTokens,
    };

    if (!skipResponseFormat) {
      if (outputJsonSchema) {
        body.response_format = {
          type: 'json_schema',
          json_schema: { name: 'response', strict: true, schema: outputJsonSchema },
        };
      } else {
        body.response_format = { type: 'json_object' };
      }
    }

    const requestBody = JSON.stringify(body);
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: requestBody,
    };

    let lastError: AppError | null = null;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const { response, bodyBytes } = await fetchWithCap(chatUrl, fetchOptions, timeoutMs, signal);

        if (response.status !== 200) {
          const code = mapHttpStatus(response.status);
          const retryAfterHeader = response.headers.get('Retry-After');
          const err = new AppError(code, AI_ERROR_MESSAGES[code]);

          if (!RETRYABLE.has(code) || attempt >= (MAX_RETRIES[code] ?? 1)) {
            throw err;
          }
          lastError = err;
          const delay = code === 'AI_RATE_LIMITED'
            ? parseRetryAfter(retryAfterHeader, backoff(attempt - 1))
            : backoff(attempt - 1);
          await sleep(delay);
          continue;
        }

        const bodyText = new TextDecoder().decode(bodyBytes);
        let parsed: { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> };
        try {
          parsed = JSON.parse(bodyText);
        } catch {
          const err = new AppError('AI_INVALID_RESPONSE', AI_ERROR_MESSAGES.AI_INVALID_RESPONSE);
          if (attempt >= (MAX_RETRIES.AI_INVALID_RESPONSE ?? 1)) throw err;
          lastError = err;
          await sleep(backoff(attempt - 1));
          continue;
        }

        const choice = parsed.choices?.[0];
        const finishReason = choice?.finish_reason ?? null;
        const content = choice?.message?.content ?? '';

        return { finishReason, content };
      } catch (err) {
        if (err instanceof AppError) {
          const code = err.code as AiErrorCode;
          if (!RETRYABLE.has(code) || attempt >= (MAX_RETRIES[code] ?? 1)) {
            throw err;
          }
          lastError = err;
          await sleep(backoff(attempt - 1));
        } else {
          throw new AppError('AI_INTERNAL_ERROR', AI_ERROR_MESSAGES.AI_INTERNAL_ERROR);
        }
      }
    }

    throw lastError ?? new AppError('AI_INTERNAL_ERROR', AI_ERROR_MESSAGES.AI_INTERNAL_ERROR);
  }
}
