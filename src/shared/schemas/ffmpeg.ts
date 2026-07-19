import { z } from 'zod';

export const ffmpegCapabilitiesSchema = z.object({
  ffmpegAvailable: z.boolean(),
  ffprobeAvailable: z.boolean(),
  ffmpegPath: z.string().optional(),
  ffprobePath: z.string().optional(),
  ffmpegVersion: z.string().optional(),
  ffprobeVersion: z.string().optional(),
  error: z.string().optional(),
});

export type FfmpegCapabilities = z.infer<typeof ffmpegCapabilitiesSchema>;
