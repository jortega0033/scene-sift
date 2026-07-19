import { ipcMain } from 'electron';
import type { ZodType } from 'zod';
import { AppError, toSafeError } from '@main/utils/errors';

export const registerValidatedHandler = <TInput, TOutput>(
  channel: string,
  inputSchema: ZodType<TInput>,
  outputSchema: ZodType<TOutput>,
  handler: (input: TInput) => Promise<TOutput> | TOutput,
): void => {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      const input = inputSchema.parse(payload);
      const result = await handler(input);
      return outputSchema.parse(result);
    } catch (error) {
      const serialized = toSafeError(error);
      throw new AppError(serialized.code, serialized.message, serialized.details);
    }
  });
};
