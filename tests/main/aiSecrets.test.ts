import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(),
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}));

import { safeStorage } from 'electron';
import { AiSecretsService } from '@main/services/ai/aiSecretsService';

const mockSafeStorage = safeStorage as {
  isEncryptionAvailable: ReturnType<typeof vi.fn>;
  encryptString: ReturnType<typeof vi.fn>;
  decryptString: ReturnType<typeof vi.fn>;
};

describe('AiSecretsService', () => {
  let service: AiSecretsService;

  beforeEach(() => {
    service = new AiSecretsService();
    vi.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('returns true when safeStorage is available', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      expect(service.isAvailable()).toBe(true);
    });

    it('returns false when safeStorage is unavailable', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe('storeKey', () => {
    it('encrypts and returns buffer when safeStorage is available', () => {
      const encrypted = Buffer.from([1, 2, 3, 4]);
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      mockSafeStorage.encryptString.mockReturnValue(encrypted);

      const result = service.storeKey('sk-test-key');

      expect(mockSafeStorage.encryptString).toHaveBeenCalledWith('sk-test-key');
      expect(result).toBe(encrypted);
    });

    it('throws AI_ENCRYPTION_UNAVAILABLE when safeStorage unavailable', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);

      expect(() => service.storeKey('sk-test-key')).toThrow(
        expect.objectContaining({ code: 'AI_ENCRYPTION_UNAVAILABLE' }),
      );
      expect(mockSafeStorage.encryptString).not.toHaveBeenCalled();
    });

    it('does not log key material', () => {
      const encrypted = Buffer.from([1, 2, 3]);
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      mockSafeStorage.encryptString.mockReturnValue(encrypted);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      service.storeKey('super-secret-key');
      const calls = consoleSpy.mock.calls.flat().join(' ');
      consoleSpy.mockRestore();

      expect(calls).not.toContain('super-secret-key');
    });
  });

  describe('retrieveKey', () => {
    it('decrypts and returns plaintext when safeStorage is available', () => {
      const encrypted = Buffer.from([1, 2, 3, 4]);
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      mockSafeStorage.decryptString.mockReturnValue('sk-recovered-key');

      const result = service.retrieveKey(encrypted);

      expect(mockSafeStorage.decryptString).toHaveBeenCalledWith(encrypted);
      expect(result).toBe('sk-recovered-key');
    });

    it('throws AI_ENCRYPTION_UNAVAILABLE when safeStorage unavailable', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);

      expect(() => service.retrieveKey(Buffer.from([1, 2, 3]))).toThrow(
        expect.objectContaining({ code: 'AI_ENCRYPTION_UNAVAILABLE' }),
      );
      expect(mockSafeStorage.decryptString).not.toHaveBeenCalled();
    });
  });
});
