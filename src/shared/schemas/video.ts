import { z } from 'zod';

export const videoGetPlaybackUrlInputSchema = z.object({ projectId: z.string().uuid() });
export const videoGetPlaybackUrlOutputSchema = z.object({ url: z.string() });

export const videoGetCuesInputSchema = z.object({ projectId: z.string().uuid() });
export const VideoCueItemSchema = z.object({
  index: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  text: z.string().max(2000),
});
export type VideoCueItem = z.infer<typeof VideoCueItemSchema>;
export const videoGetCuesOutputSchema = z.object({ cues: z.array(VideoCueItemSchema) });
