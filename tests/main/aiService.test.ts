import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AiServiceImpl } from '@main/services/ai/aiService';
import { AppError } from '@main/utils/errors';
import type { AiConfigurationService } from '@main/services/ai/aiConfigurationService';
import type { AiHttpClient, AiResponseRaw } from '@main/services/ai/aiHttpClient';
import type { AiConfigurationStatus, AiConfigurationStatusResponse } from '@shared/schemas/ai';

function makeConfigService(overrides: Partial<{
  hasConsent: boolean;
  isConfigured: boolean;
  apiKey: string | null;
  getApiKeyThrows: AppError | null;
  endpoint: string | null;
  model: string;
  status: AiConfigurationStatus;
}>): AiConfigurationService {
  const o = {
    hasConsent: true,
    isConfigured: true,
    apiKey: 'sk-test' as string | null,
    getApiKeyThrows: null as AppError | null,
    endpoint: 'https://api.openai.com' as string | null,
    model: 'gpt-4o-mini',
    status: 'configured_untested' as AiConfigurationStatus,
    ...overrides,
  };
  return {
    hasConsent: vi.fn(() => o.hasConsent),
    isConfigured: vi.fn(() => o.isConfigured),
    getApiKey: vi.fn(() => {
      if (o.getApiKeyThrows) throw o.getApiKeyThrows;
      return o.apiKey;
    }),
    getProviderEndpoint: vi.fn(() => o.endpoint),
    getProviderModel: vi.fn(() => o.model),
    getConfigurationStatus: vi.fn((): AiConfigurationStatusResponse => ({
      configurationStatus: o.status,
      maskedEndpoint: null,
      model: o.model,
      providerType: 'openai_compatible',
      lastTestedAt: null,
      lastTestError: null,
      consentRecordedAt: null,
    })),
    updateTestStatus: vi.fn(),
    setApiKey: vi.fn(),
    clearConfiguration: vi.fn(),
    recordConsent: vi.fn(),
    initialize: vi.fn(),
  } as unknown as AiConfigurationService;
}

const rawOk: AiResponseRaw = { content: '{"ok":true}', finishReason: 'stop' };
const raw = (content: string, finishReason = 'stop'): AiResponseRaw => ({ content, finishReason });

describe('AiServiceImpl', () => {
  let config: AiConfigurationService;
  let http: { post: ReturnType<typeof vi.fn> };
  let service: AiServiceImpl;

  beforeEach(() => {
    config = makeConfigService({});
    http = { post: vi.fn().mockResolvedValue(rawOk) };
    service = new AiServiceImpl(config, http as unknown as AiHttpClient);
  });

  describe('getConfigurationStatus', () => {
    it('delegates to config service', () => {
      expect(service.getConfigurationStatus()).toBe('configured_untested');
      expect((config.getConfigurationStatus as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
    });
  });

  describe('testConnection', () => {
    it('returns AI_CONSENT_REQUIRED without calling post when hasConsent=false', async () => {
      service = new AiServiceImpl(makeConfigService({ hasConsent: false }), http as unknown as AiHttpClient);
      const result = await service.testConnection();
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('AI_CONSENT_REQUIRED');
      expect(http.post).not.toHaveBeenCalled();
    });

    it('returns AI_NOT_CONFIGURED when isConfigured=false', async () => {
      service = new AiServiceImpl(makeConfigService({ isConfigured: false }), http as unknown as AiHttpClient);
      const result = await service.testConnection();
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('AI_NOT_CONFIGURED');
      expect(http.post).not.toHaveBeenCalled();
    });

    it('returns AI_NOT_CONFIGURED when apiKey=null', async () => {
      service = new AiServiceImpl(makeConfigService({ apiKey: null }), http as unknown as AiHttpClient);
      const result = await service.testConnection();
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('AI_NOT_CONFIGURED');
    });

    it('returns error code from getApiKey() exception', async () => {
      const err = new AppError('AI_ENCRYPTION_UNAVAILABLE', 'secure storage unavailable');
      service = new AiServiceImpl(
        makeConfigService({ getApiKeyThrows: err }),
        http as unknown as AiHttpClient,
      );
      const result = await service.testConnection();
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('AI_ENCRYPTION_UNAVAILABLE');
      expect(http.post).not.toHaveBeenCalled();
    });

    it('sets status testing then available on success', async () => {
      const result = await service.testConnection();
      expect(result.success).toBe(true);
      expect(result.errorCode).toBeNull();
      const calls = (config.updateTestStatus as ReturnType<typeof vi.fn>).mock.calls.map(([s]: [AiConfigurationStatus]) => s);
      expect(calls).toEqual(['testing', 'available']);
    });

    it('sets invalid_configuration on AI_AUTHENTICATION_FAILED', async () => {
      http.post.mockRejectedValue(new AppError('AI_AUTHENTICATION_FAILED', 'auth failed'));
      const result = await service.testConnection();
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('AI_AUTHENTICATION_FAILED');
      expect(config.updateTestStatus).toHaveBeenLastCalledWith('invalid_configuration');
    });

    it('sets invalid_configuration on AI_FORBIDDEN', async () => {
      http.post.mockRejectedValue(new AppError('AI_FORBIDDEN', 'forbidden'));
      await service.testConnection();
      expect(config.updateTestStatus).toHaveBeenLastCalledWith('invalid_configuration');
    });

    it('sets rate_limited status on AI_RATE_LIMITED', async () => {
      http.post.mockRejectedValue(new AppError('AI_RATE_LIMITED', 'rate limited'));
      const result = await service.testConnection();
      expect(result.errorCode).toBe('AI_RATE_LIMITED');
      expect(config.updateTestStatus).toHaveBeenLastCalledWith('rate_limited');
    });

    it('sets offline status on AI_OFFLINE', async () => {
      http.post.mockRejectedValue(new AppError('AI_OFFLINE', 'offline'));
      const result = await service.testConnection();
      expect(result.errorCode).toBe('AI_OFFLINE');
      expect(config.updateTestStatus).toHaveBeenLastCalledWith('offline');
    });

    it('sets unavailable for unmapped error codes', async () => {
      http.post.mockRejectedValue(new AppError('AI_NETWORK_ERROR', 'network error'));
      await service.testConnection();
      expect(config.updateTestStatus).toHaveBeenLastCalledWith('unavailable');
    });

    it('testedAt is between before/after call', async () => {
      const before = Date.now();
      const result = await service.testConnection();
      const after = Date.now();
      expect(result.testedAt).toBeGreaterThanOrEqual(before);
      expect(result.testedAt).toBeLessThanOrEqual(after);
    });

    it('returns failure when response has ok=false (z.literal(true) rejects)', async () => {
      http.post.mockResolvedValue(raw('{"ok":false}'));
      const { success, errorCode } = await service.testConnection();
      expect(success).toBe(false);
      expect(errorCode).toBe('AI_SCHEMA_VALIDATION_FAILED');
    });

    it('returns failure when response is not JSON', async () => {
      http.post.mockResolvedValue(raw('not json'));
      const result = await service.testConnection();
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('AI_INVALID_RESPONSE');
    });
  });

  describe('executeStructuredRequest', () => {
    const request = {
      requestId: 'req-1',
      systemPrompt: 'You are a test assistant.',
      userContent: 'Return {"result":"ok"}',
      outputSchemaName: 'testResult',
      outputSchema: {
        type: 'object',
        properties: { result: { type: 'string' } },
        required: ['result'],
        additionalProperties: false,
      },
      maxOutputTokens: 100,
      timeoutMs: 5000,
    };

    const validator = (raw: unknown): { result: string } => {
      const obj = raw as Record<string, unknown>;
      if (typeof obj?.result === 'string') return obj as { result: string };
      throw new Error('invalid');
    };

    beforeEach(() => {
      http.post.mockResolvedValue(raw('{"result":"ok"}'));
    });

    it('throws AI_CONSENT_REQUIRED when hasConsent=false', async () => {
      service = new AiServiceImpl(makeConfigService({ hasConsent: false }), http as unknown as AiHttpClient);
      await expect(service.executeStructuredRequest(request, validator)).rejects.toMatchObject({
        code: 'AI_CONSENT_REQUIRED',
      });
    });

    it('throws AI_NOT_CONFIGURED when isConfigured=false', async () => {
      service = new AiServiceImpl(makeConfigService({ isConfigured: false }), http as unknown as AiHttpClient);
      await expect(service.executeStructuredRequest(request, validator)).rejects.toMatchObject({
        code: 'AI_NOT_CONFIGURED',
      });
    });

    it('throws AI_NOT_CONFIGURED when apiKey=null', async () => {
      service = new AiServiceImpl(makeConfigService({ apiKey: null }), http as unknown as AiHttpClient);
      await expect(service.executeStructuredRequest(request, validator)).rejects.toMatchObject({
        code: 'AI_NOT_CONFIGURED',
      });
    });

    it('throws AI_NOT_CONFIGURED when endpoint=null', async () => {
      service = new AiServiceImpl(makeConfigService({ endpoint: null }), http as unknown as AiHttpClient);
      await expect(service.executeStructuredRequest(request, validator)).rejects.toMatchObject({
        code: 'AI_NOT_CONFIGURED',
      });
    });

    it('returns data on success', async () => {
      const result = await service.executeStructuredRequest(request, validator);
      expect(result.data).toEqual({ result: 'ok' });
    });

    it('returns null usage fields', async () => {
      const result = await service.executeStructuredRequest(request, validator);
      expect(result.usage).toEqual({
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      });
    });

    it('throws AI_SCHEMA_VALIDATION_FAILED when validator rejects content', async () => {
      http.post.mockResolvedValue(raw('{"wrong":"field"}'));
      await expect(service.executeStructuredRequest(request, validator)).rejects.toMatchObject({
        code: 'AI_SCHEMA_VALIDATION_FAILED',
      });
    });

    it('propagates AppError from post()', async () => {
      http.post.mockRejectedValue(new AppError('AI_AUTHENTICATION_FAILED', 'auth failed'));
      await expect(service.executeStructuredRequest(request, validator)).rejects.toMatchObject({
        code: 'AI_AUTHENTICATION_FAILED',
      });
    });

    it('passes outputSchema as outputJsonSchema to post()', async () => {
      await service.executeStructuredRequest(request, validator);
      const payload = http.post.mock.calls[0]?.[0];
      expect(payload.outputJsonSchema).toEqual(request.outputSchema);
    });

    it('cleans up AbortController after success', async () => {
      await service.executeStructuredRequest(request, validator);
      expect(() => service.cancelRequest('req-1')).not.toThrow();
    });

    it('cleans up AbortController after error', async () => {
      http.post.mockRejectedValue(new AppError('AI_TIMEOUT', 'timeout'));
      await expect(service.executeStructuredRequest(request, validator)).rejects.toBeDefined();
      expect(() => service.cancelRequest('req-1')).not.toThrow();
    });
  });

  describe('cancelRequest', () => {
    it('is no-op for unknown requestId', () => {
      expect(() => service.cancelRequest('nonexistent')).not.toThrow();
    });

    it('aborts the AbortSignal passed to post()', async () => {
      let capturedSignal: AbortSignal | undefined;
      http.post.mockImplementation((_payload: unknown, options: { signal: AbortSignal }) => {
        capturedSignal = options.signal;
        return new Promise<never>((_, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new AppError('AI_REQUEST_CANCELLED', 'cancelled'));
          });
        });
      });

      const promise = service.executeStructuredRequest(
        { ...{ requestId: 'req-1', systemPrompt: '', userContent: '', outputSchemaName: '', outputSchema: {}, maxOutputTokens: 10, timeoutMs: 5000 } },
        (r: unknown) => r as { result: string },
      );

      await new Promise((r) => setTimeout(r, 0));
      service.cancelRequest('req-1');

      expect(capturedSignal?.aborted).toBe(true);
      await expect(promise).rejects.toMatchObject({ code: 'AI_REQUEST_CANCELLED' });
    });
  });
});
