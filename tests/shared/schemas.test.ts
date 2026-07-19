import { describe, expect, it } from 'vitest';
import { createProjectInputSchema } from '@shared/schemas/project';
import { selectedVideoSchema } from '@shared/schemas/project';
import { selectedSubtitleSchema } from '@shared/schemas/project';

describe('shared schemas', () => {
  it('accepts valid project creation input', () => {
    const input = {
      name: 'Episode 1',
      video: { path: '/tmp/video.mp4', name: 'video.mp4', extension: '.mp4' },
      subtitle: { path: '/tmp/sub.srt', name: 'sub.srt', extension: '.srt' },
    };
    expect(createProjectInputSchema.parse(input)).toEqual({
      ...input,
      subtitle: input.subtitle,
    });
  });

  it('rejects invalid video extension', () => {
    expect(
      selectedVideoSchema.safeParse({
        path: '/tmp/video.txt',
        name: 'video.txt',
        extension: '.txt',
      }).success,
    ).toBe(false);
  });

  it('rejects invalid subtitle extension', () => {
    expect(
      selectedSubtitleSchema.safeParse({
        path: '/tmp/sub.doc',
        name: 'sub.doc',
        extension: '.doc',
      }).success,
    ).toBe(false);
  });
});
