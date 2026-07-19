import { describe, expect, it } from 'vitest';
import { ALL_IPC_CHANNELS } from '@shared/ipc/channels';
import { createProjectInputSchema, inspectProjectInputSchema } from '@shared/schemas/project';

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
