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
import {
  transcriptGenerateInputSchema,
  transcriptExportInputSchema,
} from '@shared/schemas/transcript';
import { aiSetApiKeyInputSchema } from '@shared/schemas/ai';
import {
  generateCandidatesInputSchema,
  cancelGenerationInputSchema,
  listCandidatesInputSchema,
  updateCandidateStatusInputSchema,
  updateCandidateNotesInputSchema,
  updateCandidateTimingInputSchema,
} from '@shared/schemas/candidates';

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

describe('transcript ipc contracts', () => {
  it('registers transcript:generateForProject channel', () => {
    expect(ALL_IPC_CHANNELS).toContain('transcript:generateForProject');
  });

  it('registers transcript:exportForProject channel', () => {
    expect(ALL_IPC_CHANNELS).toContain('transcript:exportForProject');
  });

  it('rejects non-uuid projectId in transcriptGenerateInputSchema', () => {
    expect(
      transcriptGenerateInputSchema.safeParse({ projectId: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('accepts valid uuid with defaults in transcriptGenerateInputSchema', () => {
    const result = transcriptGenerateInputSchema.safeParse({
      projectId: '11111111-1111-4111-8111-111111111111',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.gapThresholdMs).toBe(500);
  });

  it('rejects gapThresholdMs above 10000', () => {
    expect(
      transcriptGenerateInputSchema.safeParse({
        projectId: '11111111-1111-4111-8111-111111111111',
        gapThresholdMs: 10001,
      }).success,
    ).toBe(false);
  });

  it('rejects non-uuid projectId in transcriptExportInputSchema', () => {
    expect(
      transcriptExportInputSchema.safeParse({ projectId: 'bad', format: 'txt' }).success,
    ).toBe(false);
  });

  it('rejects invalid format in transcriptExportInputSchema', () => {
    expect(
      transcriptExportInputSchema.safeParse({
        projectId: '11111111-1111-4111-8111-111111111111',
        format: 'csv',
      }).success,
    ).toBe(false);
  });

  it('accepts txt format in transcriptExportInputSchema', () => {
    expect(
      transcriptExportInputSchema.safeParse({
        projectId: '11111111-1111-4111-8111-111111111111',
        format: 'txt',
      }).success,
    ).toBe(true);
  });

  it('accepts json format in transcriptExportInputSchema', () => {
    expect(
      transcriptExportInputSchema.safeParse({
        projectId: '11111111-1111-4111-8111-111111111111',
        format: 'json',
      }).success,
    ).toBe(true);
  });

  it('transcript channels are unique (no duplicates)', () => {
    const tChannels = ALL_IPC_CHANNELS.filter((c) => c.startsWith('transcript:'));
    expect(new Set(tChannels).size).toBe(tChannels.length);
    expect(tChannels.length).toBe(2);
  });
});

describe('ai ipc contracts', () => {
  it('registers all 12 ai:* channels', () => {
    expect(ALL_IPC_CHANNELS).toContain('ai:getConfigurationStatus');
    expect(ALL_IPC_CHANNELS).toContain('ai:setApiKey');
    expect(ALL_IPC_CHANNELS).toContain('ai:testConnection');
    expect(ALL_IPC_CHANNELS).toContain('ai:cancelTest');
    expect(ALL_IPC_CHANNELS).toContain('ai:clearConfiguration');
    expect(ALL_IPC_CHANNELS).toContain('ai:recordConsent');
    expect(ALL_IPC_CHANNELS).toContain('ai:generateCandidates');
    expect(ALL_IPC_CHANNELS).toContain('ai:cancelGeneration');
    expect(ALL_IPC_CHANNELS).toContain('ai:listCandidates');
    expect(ALL_IPC_CHANNELS).toContain('ai:updateCandidateStatus');
    expect(ALL_IPC_CHANNELS).toContain('ai:updateCandidateNotes');
    expect(ALL_IPC_CHANNELS).toContain('ai:updateCandidateTiming');
  });

  it('no generic ai:invoke channel exists', () => {
    expect(ALL_IPC_CHANNELS).not.toContain('ai:invoke');
    const aiChannels = ALL_IPC_CHANNELS.filter((c) => c.startsWith('ai:'));
    expect(aiChannels.every((c) => c !== 'ai:invoke')).toBe(true);
  });

  it('ai channels are unique (no duplicates)', () => {
    const aiChannels = ALL_IPC_CHANNELS.filter((c) => c.startsWith('ai:'));
    expect(new Set(aiChannels).size).toBe(aiChannels.length);
    expect(aiChannels.length).toBe(12);
  });

  it('rejects empty apiKey in aiSetApiKeyInputSchema', () => {
    expect(aiSetApiKeyInputSchema.safeParse({ apiKey: '' }).success).toBe(false);
  });

  it('accepts apiKey at max length (512 chars)', () => {
    expect(aiSetApiKeyInputSchema.safeParse({ apiKey: 'k'.repeat(512) }).success).toBe(true);
  });

  it('rejects apiKey exceeding max length (513 chars)', () => {
    expect(aiSetApiKeyInputSchema.safeParse({ apiKey: 'k'.repeat(513) }).success).toBe(false);
  });

  it('accepts valid apiKey with no optional fields', () => {
    expect(aiSetApiKeyInputSchema.safeParse({ apiKey: 'sk-test-key' }).success).toBe(true);
  });

  it('rejects baseUrl exceeding max length (2049 chars)', () => {
    const longUrl = 'a'.repeat(2049);
    expect(aiSetApiKeyInputSchema.safeParse({ apiKey: 'sk-test', baseUrl: longUrl }).success).toBe(
      false,
    );
  });

  it('accepts baseUrl at max length (2048 chars)', () => {
    const url = 'a'.repeat(2048);
    expect(aiSetApiKeyInputSchema.safeParse({ apiKey: 'sk-test', baseUrl: url }).success).toBe(
      true,
    );
  });

  it('rejects empty model string in aiSetApiKeyInputSchema', () => {
    expect(
      aiSetApiKeyInputSchema.safeParse({ apiKey: 'sk-test', model: '' }).success,
    ).toBe(false);
  });

  it('rejects model exceeding max length (129 chars)', () => {
    expect(
      aiSetApiKeyInputSchema.safeParse({ apiKey: 'sk-test', model: 'm'.repeat(129) }).success,
    ).toBe(false);
  });

  it('accepts model at max length (128 chars)', () => {
    expect(
      aiSetApiKeyInputSchema.safeParse({ apiKey: 'sk-test', model: 'm'.repeat(128) }).success,
    ).toBe(true);
  });
});

describe('ai candidate ipc contracts', () => {
  const VALID_UUID = '11111111-1111-4111-8111-111111111111';

  it('rejects non-uuid projectId in generateCandidatesInputSchema', () => {
    expect(generateCandidatesInputSchema.safeParse({ projectId: 'not-uuid' }).success).toBe(false);
  });

  it('accepts valid uuid in generateCandidatesInputSchema', () => {
    expect(generateCandidatesInputSchema.safeParse({ projectId: VALID_UUID }).success).toBe(true);
  });

  it('rejects non-uuid projectId in cancelGenerationInputSchema', () => {
    expect(cancelGenerationInputSchema.safeParse({ projectId: 'bad' }).success).toBe(false);
  });

  it('accepts valid uuid in cancelGenerationInputSchema', () => {
    expect(cancelGenerationInputSchema.safeParse({ projectId: VALID_UUID }).success).toBe(true);
  });

  it('rejects non-uuid projectId in listCandidatesInputSchema', () => {
    expect(listCandidatesInputSchema.safeParse({ projectId: 'bad' }).success).toBe(false);
  });

  it('accepts valid uuid in listCandidatesInputSchema', () => {
    expect(listCandidatesInputSchema.safeParse({ projectId: VALID_UUID }).success).toBe(true);
  });

  it('rejects non-uuid candidateId in updateCandidateStatusInputSchema', () => {
    expect(
      updateCandidateStatusInputSchema.safeParse({ candidateId: 'bad', status: 'approved' }).success,
    ).toBe(false);
  });

  it('rejects invalid status in updateCandidateStatusInputSchema', () => {
    expect(
      updateCandidateStatusInputSchema.safeParse({ candidateId: VALID_UUID, status: 'suggested' }).success,
    ).toBe(false);
  });

  it('accepts approved status in updateCandidateStatusInputSchema', () => {
    expect(
      updateCandidateStatusInputSchema.safeParse({ candidateId: VALID_UUID, status: 'approved' }).success,
    ).toBe(true);
  });

  it('accepts rejected status in updateCandidateStatusInputSchema', () => {
    expect(
      updateCandidateStatusInputSchema.safeParse({ candidateId: VALID_UUID, status: 'rejected' }).success,
    ).toBe(true);
  });

  it('accepts skipped status in updateCandidateStatusInputSchema', () => {
    expect(
      updateCandidateStatusInputSchema.safeParse({ candidateId: VALID_UUID, status: 'skipped' }).success,
    ).toBe(true);
  });

  it('rejects non-uuid candidateId in updateCandidateNotesInputSchema', () => {
    expect(
      updateCandidateNotesInputSchema.safeParse({ candidateId: 'bad', notes: 'hello' }).success,
    ).toBe(false);
  });

  it('accepts null notes in updateCandidateNotesInputSchema', () => {
    expect(
      updateCandidateNotesInputSchema.safeParse({ candidateId: VALID_UUID, notes: null }).success,
    ).toBe(true);
  });

  it('accepts string notes in updateCandidateNotesInputSchema', () => {
    expect(
      updateCandidateNotesInputSchema.safeParse({ candidateId: VALID_UUID, notes: 'Great moment' }).success,
    ).toBe(true);
  });

  it('rejects notes exceeding 1000 chars in updateCandidateNotesInputSchema', () => {
    expect(
      updateCandidateNotesInputSchema.safeParse({ candidateId: VALID_UUID, notes: 'a'.repeat(1001) }).success,
    ).toBe(false);
  });

  it('rejects non-uuid candidateId in updateCandidateTimingInputSchema', () => {
    expect(
      updateCandidateTimingInputSchema.safeParse({ candidateId: 'bad', startMs: 0, endMs: 1000 }).success,
    ).toBe(false);
  });

  it('rejects endMs <= startMs in updateCandidateTimingInputSchema', () => {
    expect(
      updateCandidateTimingInputSchema.safeParse({ candidateId: VALID_UUID, startMs: 5000, endMs: 5000 }).success,
    ).toBe(false);
    expect(
      updateCandidateTimingInputSchema.safeParse({ candidateId: VALID_UUID, startMs: 5000, endMs: 4999 }).success,
    ).toBe(false);
  });

  it('rejects negative startMs in updateCandidateTimingInputSchema', () => {
    expect(
      updateCandidateTimingInputSchema.safeParse({ candidateId: VALID_UUID, startMs: -1, endMs: 1000 }).success,
    ).toBe(false);
  });

  it('rejects endMs exceeding 86400000 in updateCandidateTimingInputSchema', () => {
    expect(
      updateCandidateTimingInputSchema.safeParse({ candidateId: VALID_UUID, startMs: 0, endMs: 86_400_001 }).success,
    ).toBe(false);
  });

  it('accepts valid timing input in updateCandidateTimingInputSchema', () => {
    expect(
      updateCandidateTimingInputSchema.safeParse({ candidateId: VALID_UUID, startMs: 1000, endMs: 5000 }).success,
    ).toBe(true);
  });
});
