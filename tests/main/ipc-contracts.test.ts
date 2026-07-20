import { describe, expect, it } from 'vitest';
import { ALL_IPC_CHANNELS } from '@shared/ipc/channels';
import { createProjectInputSchema, inspectProjectInputSchema } from '@shared/schemas/project';
import {
  subtitleSelectInputSchema,
  subtitleParseInputSchema,
  subtitleClearInputSchema,
} from '@shared/schemas/subtitle';
import { syncCheckForProjectInputSchema } from '@shared/schemas/sync';
import {
  videoGetPlaybackUrlInputSchema,
  videoGetCuesInputSchema,
} from '@shared/schemas/video';

describe('ipc contracts', () => {
  it('registers explicit channels only', () => {
    expect(ALL_IPC_CHANNELS).toContain('app:getVersion');
    expect(ALL_IPC_CHANNELS).not.toContain('invoke');
    expect(new Set(ALL_IPC_CHANNELS).size).toBe(ALL_IPC_CHANNELS.length);
  });

  it('registers project:inspect channel', () => {
    expect(ALL_IPC_CHANNELS).toContain('project:inspect');
  });

  it('rejects invalid project create payloads', () => {
    const invalid = createProjectInputSchema.safeParse({
      name: '',
      video: { path: '/tmp/video.xyz', name: 'video.xyz', extension: '.xyz' },
    });
    expect(invalid.success).toBe(false);
  });

  it('rejects non-uuid project inspect payloads', () => {
    const invalid = inspectProjectInputSchema.safeParse({ projectId: 'not-a-uuid' });
    expect(invalid.success).toBe(false);
  });

  it('accepts valid project inspect payloads', () => {
    const valid = inspectProjectInputSchema.safeParse({
      projectId: '11111111-1111-4111-8111-111111111111',
    });
    expect(valid.success).toBe(true);
  });
});

describe('subtitle ipc contracts', () => {
  it('registers subtitle:selectForProject channel', () => {
    expect(ALL_IPC_CHANNELS).toContain('subtitle:selectForProject');
  });

  it('registers subtitle:parseForProject channel', () => {
    expect(ALL_IPC_CHANNELS).toContain('subtitle:parseForProject');
  });

  it('registers subtitle:clearForProject channel', () => {
    expect(ALL_IPC_CHANNELS).toContain('subtitle:clearForProject');
  });

  it('rejects non-uuid projectId in subtitleSelectInputSchema', () => {
    expect(subtitleSelectInputSchema.safeParse({ projectId: 'not-a-uuid' }).success).toBe(false);
  });

  it('accepts valid uuid in subtitleSelectInputSchema', () => {
    expect(
      subtitleSelectInputSchema.safeParse({ projectId: '11111111-1111-4111-8111-111111111111' })
        .success,
    ).toBe(true);
  });

  it('rejects non-uuid projectId in subtitleParseInputSchema', () => {
    expect(subtitleParseInputSchema.safeParse({ projectId: 'bad' }).success).toBe(false);
  });

  it('accepts valid uuid in subtitleParseInputSchema', () => {
    expect(
      subtitleParseInputSchema.safeParse({ projectId: '11111111-1111-4111-8111-111111111111' })
        .success,
    ).toBe(true);
  });

  it('rejects non-uuid projectId in subtitleClearInputSchema', () => {
    expect(subtitleClearInputSchema.safeParse({ projectId: 'bad' }).success).toBe(false);
  });

  it('accepts valid uuid in subtitleClearInputSchema', () => {
    expect(
      subtitleClearInputSchema.safeParse({ projectId: '11111111-1111-4111-8111-111111111111' })
        .success,
    ).toBe(true);
  });

  it('subtitle channels are unique (no duplicates)', () => {
    const subtitleChannels = ALL_IPC_CHANNELS.filter((c) => c.startsWith('subtitle:'));
    expect(new Set(subtitleChannels).size).toBe(subtitleChannels.length);
    expect(subtitleChannels.length).toBe(3);
  });
});

describe('sync ipc contracts', () => {
  it('registers sync:checkForProject channel', () => {
    expect(ALL_IPC_CHANNELS).toContain('sync:checkForProject');
  });

  it('rejects non-uuid projectId in syncCheckForProjectInputSchema', () => {
    expect(syncCheckForProjectInputSchema.safeParse({ projectId: 'not-a-uuid' }).success).toBe(
      false,
    );
  });

  it('rejects missing projectId in syncCheckForProjectInputSchema', () => {
    expect(syncCheckForProjectInputSchema.safeParse({}).success).toBe(false);
  });

  it('accepts valid uuid in syncCheckForProjectInputSchema', () => {
    expect(
      syncCheckForProjectInputSchema.safeParse({
        projectId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
  });

  it('sync channels are unique (no duplicates)', () => {
    const syncChannels = ALL_IPC_CHANNELS.filter((c) => c.startsWith('sync:'));
    expect(new Set(syncChannels).size).toBe(syncChannels.length);
    expect(syncChannels.length).toBe(1);
  });
});

describe('video ipc contracts', () => {
  it('registers video:getPlaybackUrl channel', () => {
    expect(ALL_IPC_CHANNELS).toContain('video:getPlaybackUrl');
  });

  it('registers video:getCues channel', () => {
    expect(ALL_IPC_CHANNELS).toContain('video:getCues');
  });

  it('rejects non-uuid projectId in videoGetPlaybackUrlInputSchema', () => {
    expect(videoGetPlaybackUrlInputSchema.safeParse({ projectId: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects missing projectId in videoGetPlaybackUrlInputSchema', () => {
    expect(videoGetPlaybackUrlInputSchema.safeParse({}).success).toBe(false);
  });

  it('accepts valid uuid in videoGetPlaybackUrlInputSchema', () => {
    expect(
      videoGetPlaybackUrlInputSchema.safeParse({
        projectId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
  });

  it('rejects non-uuid projectId in videoGetCuesInputSchema', () => {
    expect(videoGetCuesInputSchema.safeParse({ projectId: 'not-a-uuid' }).success).toBe(false);
  });

  it('accepts valid uuid in videoGetCuesInputSchema', () => {
    expect(
      videoGetCuesInputSchema.safeParse({
        projectId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
  });

  it('video channels are unique (no duplicates)', () => {
    const videoChannels = ALL_IPC_CHANNELS.filter((c) => c.startsWith('video:'));
    expect(new Set(videoChannels).size).toBe(videoChannels.length);
    expect(videoChannels.length).toBe(2);
  });
});
