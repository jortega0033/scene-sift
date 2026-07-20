import { AppError } from '../../utils/errors';
import { AI_ERROR_MESSAGES } from '@shared/schemas/ai';
import type { AiConfigurationStatus, AiErrorCode } from '@shared/schemas/ai';
import type { AiConfigurationService } from './aiConfigurationService';
import type { AiHttpClient } from './aiHttpClient';
import { parseStructuredOutput } from './structuredOutputParser';
import { PROMPT_REGISTRY } from '@shared/prompts/registry';

export type AiConnectionTestResult = {
  success: boolean;
  errorCode: AiErrorCode | null;
  testedAt: number;
};

export type StructuredRequest = {
  requestId: string;
  systemPrompt: string;
  userContent: string;
  outputSchemaName: string;
  outputSchema: object;
  maxOutputTokens: number;
  timeoutMs: number;
  skipResponseFormat?: boolean;
};

export type StructuredResult<T> = {
  data: T;
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null };
};

export interface AiService {
  getConfigurationStatus(): AiConfigurationStatus;
  testConnection(): Promise<AiConnectionTestResult>;
  cancelTestConnection(): void;
  executeStructuredRequest<T>(
    request: StructuredRequest,
    schemaValidator: (raw: unknown) => T,
  ): Promise<StructuredResult<T>>;
  cancelRequest(requestId: string): void;
}

// Maps AI error codes to AiConfigurationStatus for persisting test outcomes.
const ERROR_TO_STATUS: Partial<Record<AiErrorCode, AiConfigurationStatus>> = {
  AI_AUTHENTICATION_FAILED: 'invalid_configuration',
  AI_FORBIDDEN: 'invalid_configuration',
  AI_INVALID_CONFIGURATION: 'invalid_configuration',
  AI_ENDPOINT_NOT_ALLOWED: 'invalid_configuration',
  AI_RATE_LIMITED: 'rate_limited',
  AI_OFFLINE: 'offline',
};

function errorCodeToConfigStatus(code: AiErrorCode): AiConfigurationStatus {
  return ERROR_TO_STATUS[code] ?? 'unavailable';
}

export class AiServiceImpl implements AiService {
  private readonly activeRequests = new Map<string, AbortController>();
  private testController: AbortController | null = null;

  constructor(
    private readonly config: AiConfigurationService,
    private readonly http: AiHttpClient,
  ) {}

  getConfigurationStatus(): AiConfigurationStatus {
    return this.config.getConfigurationStatus().configurationStatus;
  }

  async testConnection(): Promise<AiConnectionTestResult> {
    const testedAt = Date.now();

    if (!this.config.hasConsent()) {
      return { success: false, errorCode: 'AI_CONSENT_REQUIRED', testedAt };
    }

    if (!this.config.isConfigured()) {
      return { success: false, errorCode: 'AI_NOT_CONFIGURED', testedAt };
    }

    let apiKey: string | null;
    try {
      apiKey = this.config.getApiKey();
    } catch (err) {
      const code = err instanceof AppError ? (err.code as AiErrorCode) : 'AI_ENCRYPTION_UNAVAILABLE' as AiErrorCode;
      return { success: false, errorCode: code, testedAt };
    }

    if (!apiKey) {
      return { success: false, errorCode: 'AI_NOT_CONFIGURED', testedAt };
    }

    const endpoint = this.config.getProviderEndpoint();
    if (!endpoint) {
      return { success: false, errorCode: 'AI_NOT_CONFIGURED', testedAt };
    }

    const model = this.config.getProviderModel();
    const prompt = PROMPT_REGISTRY.connectionTest;

    this.config.updateTestStatus('testing');

    const controller = new AbortController();
    this.testController = controller;

    try {
      const raw = await this.http.post(
        {
          messages: [
            { role: 'system', content: prompt.systemInstructions },
            { role: 'user', content: prompt.buildUserContent({}) },
          ],
          maxOutputTokens: prompt.maxOutputTokens,
          skipResponseFormat: true,
        },
        { endpoint, model, apiKey, signal: controller.signal, timeoutMs: prompt.maxDurationMs },
      );

      parseStructuredOutput(raw, prompt.outputValidator);

      this.config.updateTestStatus('available');
      return { success: true, errorCode: null, testedAt };
    } catch (err) {
      const code = err instanceof AppError
        ? (err.code as AiErrorCode)
        : ('AI_INTERNAL_ERROR' as AiErrorCode);
      this.config.updateTestStatus(errorCodeToConfigStatus(code));
      return { success: false, errorCode: code, testedAt };
    } finally {
      this.testController = null;
    }
  }

  cancelTestConnection(): void {
    if (this.testController) {
      this.testController.abort();
      this.testController = null;
    }
  }

  async executeStructuredRequest<T>(
    request: StructuredRequest,
    schemaValidator: (raw: unknown) => T,
  ): Promise<StructuredResult<T>> {
    if (!this.config.hasConsent()) {
      throw new AppError('AI_CONSENT_REQUIRED', AI_ERROR_MESSAGES.AI_CONSENT_REQUIRED);
    }
    if (!this.config.isConfigured()) {
      throw new AppError('AI_NOT_CONFIGURED', AI_ERROR_MESSAGES.AI_NOT_CONFIGURED);
    }

    const apiKey = this.config.getApiKey();
    if (!apiKey) {
      throw new AppError('AI_NOT_CONFIGURED', AI_ERROR_MESSAGES.AI_NOT_CONFIGURED);
    }

    const endpoint = this.config.getProviderEndpoint();
    if (!endpoint) {
      throw new AppError('AI_NOT_CONFIGURED', AI_ERROR_MESSAGES.AI_NOT_CONFIGURED);
    }

    const model = this.config.getProviderModel();
    const controller = new AbortController();
    this.activeRequests.set(request.requestId, controller);

    try {
      const raw = await this.http.post(
        {
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userContent },
          ],
          maxOutputTokens: request.maxOutputTokens,
          ...(request.skipResponseFormat ? { skipResponseFormat: true as const } : {}),
          outputJsonSchema: request.outputSchema,
        },
        { endpoint, model, apiKey, signal: controller.signal, timeoutMs: request.timeoutMs },
      );

      const data = parseStructuredOutput(raw, schemaValidator);
      return {
        data,
        usage: { promptTokens: null, completionTokens: null, totalTokens: null },
      };
    } finally {
      this.activeRequests.delete(request.requestId);
    }
  }

  cancelRequest(requestId: string): void {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
    }
  }
}
