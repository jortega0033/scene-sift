import { safeStorage } from 'electron';
import { AppError } from '../../utils/errors';
import { AI_ERROR_MESSAGES } from '@shared/schemas/ai';

export class AiSecretsService {
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  storeKey(key: string): Buffer {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new AppError('AI_ENCRYPTION_UNAVAILABLE', AI_ERROR_MESSAGES.AI_ENCRYPTION_UNAVAILABLE);
    }
    return safeStorage.encryptString(key);
  }

  retrieveKey(encrypted: Buffer): string {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new AppError('AI_ENCRYPTION_UNAVAILABLE', AI_ERROR_MESSAGES.AI_ENCRYPTION_UNAVAILABLE);
    }
    return safeStorage.decryptString(encrypted);
  }
}
