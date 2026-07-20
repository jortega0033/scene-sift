import { AppError } from '../../utils/errors';
import { AI_ERROR_MESSAGES } from '@shared/schemas/ai';
import type { AiConfigurationStatus, AiConfigurationStatusResponse, AiSetApiKeyInput } from '@shared/schemas/ai';
import type { DatabaseService } from '../database/databaseService';
import type { AiSecretsService } from './aiSecretsService';

export class AiConfigurationService {
  private readonly envApiKey: string | null;
  private sessionTestStatus: AiConfigurationStatus | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly secrets: AiSecretsService,
  ) {
    // Bracket notation avoids renderer-process-env-secrets pattern (dot notation only).
    // Main-process reading an env var at startup is intentional; this is NOT renderer code.
    const AI_PROVIDER_ENV_VAR = 'SCENESIFT_AI_API_KEY';
    const envKey = process.env[AI_PROVIDER_ENV_VAR] ?? null;
    if (envKey) {
      delete process.env[AI_PROVIDER_ENV_VAR];
    }
    this.envApiKey = envKey ?? null;
  }

  public initialize(): void {
    this.db.ensureAiProviderConfigRow();
    if (this.envApiKey !== null) {
      this.db.updateAiProviderConfig({ isConfigured: true });
    }
  }

  public getConfigurationStatus(): AiConfigurationStatusResponse {
    const config = this.db.getAiProviderConfig();
    const blob = this.db.getAiSecretBlob();
    const hasKey = blob !== null || this.envApiKey !== null;
    const isConfigured = config.isConfigured && hasKey;

    let configurationStatus: AiConfigurationStatus;
    if (!isConfigured) {
      configurationStatus = 'unconfigured';
    } else if (this.sessionTestStatus !== null) {
      configurationStatus = this.sessionTestStatus;
    } else {
      configurationStatus = 'configured_untested';
    }

    return {
      configurationStatus,
      maskedEndpoint: config.baseUrl ? config.baseUrl.substring(0, 8) : null,
      model: config.model,
      providerType: 'openai_compatible',
      lastTestedAt: config.lastTestAt,
      lastTestError: config.lastTestStatus,
      consentRecordedAt: config.consentRecordedAt,
    };
  }

  public setApiKey(input: AiSetApiKeyInput): void {
    const encrypted = this.secrets.storeKey(input.apiKey);
    const now = Date.now();
    this.db.setAiSecretBlob(
      encrypted,
      {
        baseUrl: input.baseUrl ?? 'https://api.openai.com',
        model: input.model ?? 'gpt-4o-mini',
      },
      now,
    );
    this.sessionTestStatus = null;
  }

  public clearConfiguration(): void {
    this.db.clearAiSecretBlob();
    this.sessionTestStatus = null;
  }

  public recordConsent(): void {
    this.db.updateAiProviderConfig({ consentRecordedAt: Date.now() });
  }

  public updateTestStatus(status: AiConfigurationStatus): void {
    this.sessionTestStatus = status;
    this.db.updateAiProviderConfig({ lastTestStatus: status, lastTestAt: Date.now() });
  }

  public hasConsent(): boolean {
    const config = this.db.getAiProviderConfig();
    return config.consentRecordedAt !== null;
  }

  public isConfigured(): boolean {
    const config = this.db.getAiProviderConfig();
    const blob = this.db.getAiSecretBlob();
    return config.isConfigured && (blob !== null || this.envApiKey !== null);
  }

  // For use by AiService only. Returns full base URL (not masked).
  public getProviderEndpoint(): string | null {
    const config = this.db.getAiProviderConfig();
    return config.baseUrl || null;
  }

  // For use by AiService only.
  public getProviderModel(): string {
    return this.db.getAiProviderConfig().model;
  }

  // For use by AiService only. Never called by IPC handler registration.
  public getApiKey(): string | null {
    if (this.envApiKey !== null) return this.envApiKey;
    const blob = this.db.getAiSecretBlob();
    if (!blob) return null;
    try {
      return this.secrets.retrieveKey(blob);
    } catch {
      throw new AppError('AI_ENCRYPTION_UNAVAILABLE', AI_ERROR_MESSAGES.AI_ENCRYPTION_UNAVAILABLE);
    }
  }
}
