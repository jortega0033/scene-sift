import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => Buffer.from(s)),
    decryptString: vi.fn((b: Buffer) => b.toString()),
  },
}));

import { AiSecretsService } from '@main/services/ai/aiSecretsService';
import { AiConfigurationService } from '@main/services/ai/aiConfigurationService';
import type { DatabaseService, AiProviderConfigRow } from '@main/services/database/databaseService';

const makeConfigRow = (overrides?: Partial<AiProviderConfigRow>): AiProviderConfigRow => ({
  id: 'default',
  providerType: 'openai_compatible',
  baseUrl: 'https://api.openai.com',
  model: 'gpt-4o-mini',
  isConfigured: false,
  consentRecordedAt: null,
  lastTestStatus: null,
  lastTestAt: null,
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

const makeDb = (overrides?: Partial<DatabaseService>): DatabaseService => ({
  ensureAiProviderConfigRow: vi.fn(),
  getAiProviderConfig: vi.fn(() => makeConfigRow()),
  updateAiProviderConfig: vi.fn(),
  getAiSecretBlob: vi.fn(() => null),
  setAiSecretBlob: vi.fn(),
  clearAiSecretBlob: vi.fn(),
  ...overrides,
} as unknown as DatabaseService);

describe('AiConfigurationService', () => {
  let secrets: AiSecretsService;

  beforeEach(() => {
    secrets = new AiSecretsService();
    delete process.env.SCENESIFT_AI_API_KEY;
  });

  afterEach(() => {
    delete process.env.SCENESIFT_AI_API_KEY;
  });

  describe('constructor — env var handling', () => {
    it('reads and unsets SCENESIFT_AI_API_KEY from process.env', () => {
      process.env.SCENESIFT_AI_API_KEY = 'env-key-123';
      const db = makeDb();
      const svc = new AiConfigurationService(db, secrets);
      expect(process.env.SCENESIFT_AI_API_KEY).toBeUndefined();
      // Key is captured; isConfigured returns true even without DB blob
      db.getAiProviderConfig = vi.fn(() => makeConfigRow({ isConfigured: true }));
      expect(svc.isConfigured()).toBe(true);
    });

    it('does not throw when env var is absent', () => {
      expect(() => new AiConfigurationService(makeDb(), secrets)).not.toThrow();
    });
  });

  describe('getConfigurationStatus', () => {
    it('returns unconfigured when not configured', () => {
      const svc = new AiConfigurationService(makeDb(), secrets);
      const status = svc.getConfigurationStatus();
      expect(status.configurationStatus).toBe('unconfigured');
      expect(status.providerType).toBe('openai_compatible');
    });

    it('returns configured_untested when configured with no session test', () => {
      const db = makeDb({
        getAiProviderConfig: vi.fn(() => makeConfigRow({ isConfigured: true })),
        getAiSecretBlob: vi.fn(() => Buffer.from('enc')),
      });
      const svc = new AiConfigurationService(db, secrets);
      expect(svc.getConfigurationStatus().configurationStatus).toBe('configured_untested');
    });

    it('reflects sessionTestStatus after updateTestStatus', () => {
      const db = makeDb({
        getAiProviderConfig: vi.fn(() => makeConfigRow({ isConfigured: true })),
        getAiSecretBlob: vi.fn(() => Buffer.from('enc')),
      });
      const svc = new AiConfigurationService(db, secrets);
      svc.updateTestStatus('available');
      expect(svc.getConfigurationStatus().configurationStatus).toBe('available');
    });

    it('does not include raw key in response', () => {
      const db = makeDb({
        getAiProviderConfig: vi.fn(() => makeConfigRow({ isConfigured: true })),
        getAiSecretBlob: vi.fn(() => Buffer.from('sk-secret-key')),
      });
      const svc = new AiConfigurationService(db, secrets);
      const response = JSON.stringify(svc.getConfigurationStatus());
      expect(response).not.toContain('sk-secret-key');
    });

    it('maskedEndpoint contains first 8 chars of baseUrl', () => {
      const db = makeDb({
        getAiProviderConfig: vi.fn(() =>
          makeConfigRow({ isConfigured: true, baseUrl: 'https://api.openai.com' }),
        ),
        getAiSecretBlob: vi.fn(() => Buffer.from('enc')),
      });
      const svc = new AiConfigurationService(db, secrets);
      expect(svc.getConfigurationStatus().maskedEndpoint).toBe('https://');
    });
  });

  describe('setApiKey', () => {
    it('stores encrypted blob via db.setAiSecretBlob', () => {
      const setBlob = vi.fn();
      const db = makeDb({ setAiSecretBlob: setBlob });
      const svc = new AiConfigurationService(db, secrets);
      svc.setApiKey({ apiKey: 'sk-test' });
      expect(setBlob).toHaveBeenCalledOnce();
      const [blob, config] = setBlob.mock.calls[0] as [Buffer, { baseUrl: string; model: string }];
      expect(Buffer.isBuffer(blob)).toBe(true);
      expect(config.baseUrl).toBe('https://api.openai.com');
      expect(config.model).toBe('gpt-4o-mini');
    });

    it('uses provided baseUrl and model when supplied', () => {
      const setBlob = vi.fn();
      const db = makeDb({ setAiSecretBlob: setBlob });
      const svc = new AiConfigurationService(db, secrets);
      svc.setApiKey({ apiKey: 'sk-test', baseUrl: 'https://custom.ai', model: 'gpt-4o' });
      const [, config] = setBlob.mock.calls[0] as [Buffer, { baseUrl: string; model: string }];
      expect(config.baseUrl).toBe('https://custom.ai');
      expect(config.model).toBe('gpt-4o');
    });

    it('resets sessionTestStatus after key change', () => {
      const db = makeDb({
        getAiProviderConfig: vi.fn(() => makeConfigRow({ isConfigured: true })),
        getAiSecretBlob: vi.fn(() => Buffer.from('enc')),
      });
      const svc = new AiConfigurationService(db, secrets);
      svc.updateTestStatus('available');
      svc.setApiKey({ apiKey: 'sk-new' });
      expect(svc.getConfigurationStatus().configurationStatus).toBe('configured_untested');
    });
  });

  describe('clearConfiguration', () => {
    it('calls db.clearAiSecretBlob', () => {
      const clear = vi.fn();
      const svc = new AiConfigurationService(makeDb({ clearAiSecretBlob: clear }), secrets);
      svc.clearConfiguration();
      expect(clear).toHaveBeenCalledOnce();
    });

    it('resets sessionTestStatus', () => {
      const db = makeDb({
        getAiProviderConfig: vi.fn(() => makeConfigRow({ isConfigured: true })),
        getAiSecretBlob: vi.fn(() => null),
      });
      const svc = new AiConfigurationService(db, secrets);
      svc.updateTestStatus('available');
      svc.clearConfiguration();
      expect(svc.getConfigurationStatus().configurationStatus).toBe('unconfigured');
    });
  });

  describe('recordConsent', () => {
    it('calls db.updateAiProviderConfig with consentRecordedAt', () => {
      const update = vi.fn();
      const svc = new AiConfigurationService(makeDb({ updateAiProviderConfig: update }), secrets);
      svc.recordConsent();
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ consentRecordedAt: expect.any(Number) }));
    });
  });

  describe('hasConsent', () => {
    it('returns false when consentRecordedAt is null', () => {
      const svc = new AiConfigurationService(makeDb(), secrets);
      expect(svc.hasConsent()).toBe(false);
    });

    it('returns true when consentRecordedAt is set', () => {
      const db = makeDb({
        getAiProviderConfig: vi.fn(() => makeConfigRow({ consentRecordedAt: 12345 })),
      });
      const svc = new AiConfigurationService(db, secrets);
      expect(svc.hasConsent()).toBe(true);
    });
  });

  describe('restart behavior', () => {
    it('shows configured_untested on startup when configured (no session test)', () => {
      const db = makeDb({
        getAiProviderConfig: vi.fn(() =>
          makeConfigRow({ isConfigured: true, lastTestStatus: 'available' }),
        ),
        getAiSecretBlob: vi.fn(() => Buffer.from('enc')),
      });
      const svc = new AiConfigurationService(db, secrets);
      expect(svc.getConfigurationStatus().configurationStatus).toBe('configured_untested');
    });
  });
});
