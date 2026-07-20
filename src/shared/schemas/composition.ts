import { z } from 'zod';

export const ALLOWED_RESOLUTIONS = ['1080x1920', '720x1280'] as const;
export const ALLOWED_BACKGROUND_STYLES = ['blur', 'crop'] as const;
export const ALLOWED_SUBTITLE_POSITIONS = ['bottom', 'center'] as const;
export const ALLOWED_FONT_FAMILIES = [
  'Arial',
  'Helvetica Neue',
  'Georgia',
  'Verdana',
  'Courier New',
] as const;

export const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export const compositionSettingsSchema = z.object({
  projectId: z.string().uuid(),
  resolution: z.enum(ALLOWED_RESOLUTIONS),
  backgroundStyle: z.enum(ALLOWED_BACKGROUND_STYLES),
  subtitlePosition: z.enum(ALLOWED_SUBTITLE_POSITIONS),
  fontFamily: z.enum(ALLOWED_FONT_FAMILIES),
  fontSize: z.number().int().min(16).max(72),
  fontColor: z.string().regex(HEX_COLOR_RE),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export const getCompositionSettingsInputSchema = z.object({
  projectId: z.string().uuid(),
});

export const getCompositionSettingsOutputSchema = z.object({
  settings: compositionSettingsSchema,
});

export const updateCompositionSettingsInputSchema = z
  .object({
    projectId: z.string().uuid(),
    resolution: z.enum(ALLOWED_RESOLUTIONS).optional(),
    backgroundStyle: z.enum(ALLOWED_BACKGROUND_STYLES).optional(),
    subtitlePosition: z.enum(ALLOWED_SUBTITLE_POSITIONS).optional(),
    fontFamily: z.enum(ALLOWED_FONT_FAMILIES).optional(),
    fontSize: z.number().int().min(16).max(72).optional(),
    fontColor: z.string().regex(HEX_COLOR_RE).optional(),
  })
  .refine(
    (data) => Object.keys(data).filter((k) => k !== 'projectId').length > 0,
    { message: 'At least one settings field must be provided.' }
  );

export const updateCompositionSettingsOutputSchema = z.object({
  settings: compositionSettingsSchema,
});

export type CompositionSettings = z.infer<typeof compositionSettingsSchema>;
export type CompositionSettingsPatch = Omit<
  z.infer<typeof updateCompositionSettingsInputSchema>,
  'projectId'
>;
