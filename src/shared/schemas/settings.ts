import { z } from 'zod';

export const themeSchema = z.enum(['system', 'light', 'dark']);

export const appSettingsSchema = z.object({
  ffmpegPathOverride: z.string().nullable(),
  ffprobePathOverride: z.string().nullable(),
  defaultOutputDirectory: z.string().nullable(),
  preferredTheme: themeSchema,
  developmentDiagnosticsEnabled: z.boolean(),
});

export const updateSettingsInputSchema = appSettingsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one setting must be provided.');

export const appStatusSchema = z.object({
  version: z.string(),
  platform: z.string(),
  diagnosticsEnabled: z.boolean(),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;
