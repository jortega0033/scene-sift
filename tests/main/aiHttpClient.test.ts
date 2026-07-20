import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: false },
  net: { isOnline: vi.fn(() => true) },
}));

import { app, net } from 'electron';
import { validateEndpoint, AiHttpClientImpl } from '@main/services/ai/aiHttpClient';

const mockNet = net as { isOnline: ReturnType<typeof vi.fn> };
const mockApp = app as { isPackaged: boolean };

const DEFAULT_OPTIONS = {
  endpoint: 'https://api.openai.com',
  model: 'gpt-4o-mini',
  apiKey: 'sk-test',
  signal: new AbortController().signal,
  timeoutMs: 5000,
};

const DEFAULT_PAYLOAD = {
  messages: [{ role: 'user' as const, content: 'test' }],
  maxOutputTokens: 20,
  skipResponseFormat: true,
};

const makeOkResponse = (content: string, finishReason = 'stop') => ({
  ok: true,
  status: 200,
  type: 'basic',
  headers: new Headers({ 'Content-Type': 'application/json' }),
  body: {
    getReader: () => {
      const body = JSON.stringify({
        choices: [{ message: { content }, finish_reason: finishReason }],
      });
      const bytes = new TextEncoder().encode(body);
      let done = false;
      return {
        read: async () => {
          if (done) return { done: true, value: undefined };
          done = true;
          return { done: false, value: bytes };
        },
        cancel: async () => {},
      };
    },
  },
});

const makeErrorResponse = (status: number, retryAfter?: string) => ({
  ok: false,
  status,
  type: 'basic',
  headers: new Headers(retryAfter ? { 'Retry-After': retryAfter } : {}),
  body: {
    getReader: () => {
      const bytes = new TextEncoder().encode('{}');
      let done = false;
      return {
        read: async () => {
          if (done) return { done: true, value: undefined };
          done = true;
          return { done: false, value: bytes };
        },
        cancel: async () => {},
      };
    },
  },
});

describe('validateEndpoint', () => {
  beforeEach(() => {
    mockApp.isPackaged = false;
    delete process.env.SCENESIFT_ALLOW_LOCAL_AI_ENDPOINT;
  });

  it('accepts https public endpoints', () => {
    expect(() => validateEndpoint('https://api.openai.com')).not.toThrow();
  });

  it('rejects http non-localhost endpoints', () => {
    expect(() => validateEndpoint('http://example.com')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects URLs with credentials', () => {
    expect(() => validateEndpoint('https://user:pass@api.openai.com')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects RFC 1918 addresses: 10.x', () => {
    expect(() => validateEndpoint('https://10.0.0.1')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects RFC 1918 addresses: 172.16.x', () => {
    expect(() => validateEndpoint('https://172.16.0.1')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects RFC 1918 addresses: 192.168.x', () => {
    expect(() => validateEndpoint('https://192.168.1.1')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects IPv4 loopback', () => {
    expect(() => validateEndpoint('https://127.0.0.1')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects link-local 169.254.x', () => {
    expect(() => validateEndpoint('https://169.254.1.1')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects IPv6 loopback ::1', () => {
    expect(() => validateEndpoint('https://[::1]')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects IPv6 ULA fc00::/7', () => {
    expect(() => validateEndpoint('https://[fc00::1]')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects IPv6 ULA fd00::/7', () => {
    expect(() => validateEndpoint('https://[fd00::1]')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects IPv6 link-local fe80::', () => {
    expect(() => validateEndpoint('https://[fe80::1]')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects localhost without dev override', () => {
    expect(() => validateEndpoint('https://localhost')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects 0.0.0.0', () => {
    expect(() => validateEndpoint('https://0.0.0.0')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects IPv4-mapped IPv6 loopback [::ffff:127.0.0.1]', () => {
    expect(() => validateEndpoint('https://[::ffff:127.0.0.1]')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects IPv4-mapped IPv6 link-local [::ffff:169.254.169.254]', () => {
    expect(() => validateEndpoint('https://[::ffff:169.254.169.254]')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects IPv4-mapped IPv6 RFC1918 [::ffff:192.168.1.1]', () => {
    expect(() => validateEndpoint('https://[::ffff:192.168.1.1]')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('rejects IPv4-mapped IPv6 RFC1918 [::ffff:10.0.0.1]', () => {
    expect(() => validateEndpoint('https://[::ffff:10.0.0.1]')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });

  it('allows localhost with ALLOW_LOCAL_AI_ENDPOINT + !isPackaged', () => {
    process.env.SCENESIFT_ALLOW_LOCAL_AI_ENDPOINT = '1';
    mockApp.isPackaged = false;
    expect(() => validateEndpoint('http://localhost:11434')).not.toThrow();
  });

  it('rejects localhost even with env var if isPackaged=true', () => {
    process.env.SCENESIFT_ALLOW_LOCAL_AI_ENDPOINT = '1';
    mockApp.isPackaged = true;
    expect(() => validateEndpoint('http://localhost:11434')).toThrow(
      expect.objectContaining({ code: 'AI_ENDPOINT_NOT_ALLOWED' }),
    );
  });
});

describe('AiHttpClientImpl.post', () => {
  let client: AiHttpClientImpl;

  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
    client = new AiHttpClientImpl();
    mockNet.isOnline.mockReturnValue(true);
  });

  it('returns finishReason and content on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOkResponse('{"ok":true}')));
    const result = await client.post(DEFAULT_PAYLOAD, DEFAULT_OPTIONS);
    expect(result.content).toBe('{"ok":true}');
    expect(result.finishReason).toBe('stop');
  });

  it('throws AI_OFFLINE when net.isOnline() is false', async () => {
    mockNet.isOnline.mockReturnValue(false);
    await expect(client.post(DEFAULT_PAYLOAD, DEFAULT_OPTIONS)).rejects.toMatchObject({
      code: 'AI_OFFLINE',
    });
  });

  it('maps HTTP 401 to AI_AUTHENTICATION_FAILED', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(401)));
    await expect(client.post(DEFAULT_PAYLOAD, DEFAULT_OPTIONS)).rejects.toMatchObject({
      code: 'AI_AUTHENTICATION_FAILED',
    });
  });

  it('maps HTTP 403 to AI_FORBIDDEN', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(403)));
    await expect(client.post(DEFAULT_PAYLOAD, DEFAULT_OPTIONS)).rejects.toMatchObject({
      code: 'AI_FORBIDDEN',
    });
  });

  it('maps HTTP 404 to AI_INVALID_CONFIGURATION', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(404)));
    await expect(client.post(DEFAULT_PAYLOAD, DEFAULT_OPTIONS)).rejects.toMatchObject({
      code: 'AI_INVALID_CONFIGURATION',
    });
  });

  it('maps HTTP 408 to AI_TIMEOUT (non-retryable mapping)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(408)));
    await expect(client.post(DEFAULT_PAYLOAD, DEFAULT_OPTIONS)).rejects.toMatchObject({
      code: 'AI_TIMEOUT',
    });
  });

  it('maps HTTP 413 to AI_REQUEST_TOO_LARGE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(413)));
    await expect(client.post(DEFAULT_PAYLOAD, DEFAULT_OPTIONS)).rejects.toMatchObject({
      code: 'AI_REQUEST_TOO_LARGE',
    });
  });

  it('maps HTTP 422 to AI_INVALID_CONFIGURATION', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(422)));
    await expect(client.post(DEFAULT_PAYLOAD, DEFAULT_OPTIONS)).rejects.toMatchObject({
      code: 'AI_INVALID_CONFIGURATION',
    });
  });

  it('maps HTTP 502 to AI_PROVIDER_UNAVAILABLE and retries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce(makeErrorResponse(502))
        .mockResolvedValueOnce(makeErrorResponse(502))
        .mockResolvedValueOnce(makeOkResponse('{"ok":true}')),
    );
    const result = await client.post(DEFAULT_PAYLOAD, DEFAULT_OPTIONS);
    expect(result.content).toBe('{"ok":true}');
  });

  it('maps HTTP 429 to AI_RATE_LIMITED and retries up to 3 times', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeErrorResponse(429))
      .mockResolvedValueOnce(makeErrorResponse(429))
      .mockResolvedValueOnce(makeErrorResponse(429));
    vi.stubGlobal('fetch', fetchMock);
    await expect(client.post(DEFAULT_PAYLOAD, DEFAULT_OPTIONS)).rejects.toMatchObject({
      code: 'AI_RATE_LIMITED',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws AI_REDIRECT_NOT_ALLOWED for opaqueredirect response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 0,
      type: 'opaqueredirect',
      headers: new Headers(),
      body: null,
    }));
    await expect(client.post(DEFAULT_PAYLOAD, DEFAULT_OPTIONS)).rejects.toMatchObject({
      code: 'AI_REDIRECT_NOT_ALLOWED',
    });
  });

  it('throws AI_REQUEST_CANCELLED on user abort', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      controller.abort();
      const err = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    }));
    await expect(
      client.post(DEFAULT_PAYLOAD, { ...DEFAULT_OPTIONS, signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'AI_REQUEST_CANCELLED' });
  });

  it('sends Authorization header from apiKey', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeOkResponse('{"ok":true}'));
    vi.stubGlobal('fetch', fetchSpy);
    await client.post(DEFAULT_PAYLOAD, DEFAULT_OPTIONS);
    const callOptions = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = callOptions.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-test');
  });

  it('sends both max_tokens and max_completion_tokens', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(makeOkResponse('{"ok":true}'));
    vi.stubGlobal('fetch', fetchSpy);
    await client.post({ ...DEFAULT_PAYLOAD, maxOutputTokens: 50 }, DEFAULT_OPTIONS);
    const body = JSON.parse((fetchSpy.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.max_tokens).toBe(50);
    expect(body.max_completion_tokens).toBe(50);
  });
});
