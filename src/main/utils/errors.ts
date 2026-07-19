import type { SafeError } from '@shared/types/common';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: string,
  ) {
    super(message);
  }
}

export const toSafeError = (error: unknown): SafeError => {
  if (error instanceof AppError) {
    return error.details
      ? { code: error.code, message: error.message, details: error.details }
      : { code: error.code, message: error.message };
  }

  if (error instanceof Error) {
    const details = process.env.NODE_ENV === 'development' ? error.stack : undefined;
    return details
      ? {
          code: 'INTERNAL_ERROR',
          message: error.message,
          details,
        }
      : {
          code: 'INTERNAL_ERROR',
          message: error.message,
        };
  }

  return { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' };
};
