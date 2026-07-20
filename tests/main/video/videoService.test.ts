// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoService } from '@main/services/video/videoService';
import { AppError } from '@main/utils/errors';

const UUID = '11111111-1111-4111-8111-111111111111';

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID,
    name: 'Test Project',
    videoPath: '/path/to/video.mp4',
    subtitlePath: null,
    outputDirectory: null,
    status: 'ready' as const,
    createdAt: 0,
    updatedAt: 0,
    mediaMetadata: null,
    inspectionError: null,
    subtitleStatus: null as string | null,
    subtitleCueCount: null,
    subtitleLastCueEndMs: null,
    subtitleParseError: null,
    subtitleParsedAt: null,
    syncStatus: null,
    syncCheckedAt: null,
    syncWarningsJson: null,
    syncAnalysisVersion: null,
    ...overrides,
  };
}

function makeDoc(cueOverrides: unknown[] = []) {
  return {
    schemaVersion: 1 as const,
    sourceFormat: 'srt' as const,
    sourceEncoding: 'utf-8',
    cues: cueOverrides.length > 0 ? cueOverrides : [
      { index: 0, startMs: 0, endMs: 1000, text: 'Hello', lines: ['Hello'] },
      { index: 1, startMs: 1500, endMs: 2500, text: 'World', lines: ['World'] },
    ],
    warnings: [],
    summary: { cueCount: 2, firstCueStartMs: 0, lastCueEndMs: 2500, totalTextLength: 10, warningCount: 0 },
    parsedAt: 0,
  };
}

const mockDb = {
  getProject: vi.fn(),
  getSubtitleDocument: vi.fn(),
};

describe('VideoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveVideoPath', () => {
    it('returns videoPath when project found', () => {
      mockDb.getProject.mockReturnValue(makeProject());
      const svc = new VideoService(mockDb as never);
      expect(svc.resolveVideoPath(UUID)).toBe('/path/to/video.mp4');
    });

    it('returns null when project not found', () => {
      mockDb.getProject.mockReturnValue(null);
      const svc = new VideoService(mockDb as never);
      expect(svc.resolveVideoPath(UUID)).toBeNull();
    });
  });

  describe('getPlaybackUrl', () => {
    it('returns local URL for existing project', () => {
      mockDb.getProject.mockReturnValue(makeProject());
      const svc = new VideoService(mockDb as never);
      expect(svc.getPlaybackUrl(UUID)).toEqual({ url: `local:///video/${UUID}` });
    });

    it('throws PROJECT_NOT_FOUND for missing project', () => {
      mockDb.getProject.mockReturnValue(null);
      const svc = new VideoService(mockDb as never);
      let err: AppError | undefined;
      try { svc.getPlaybackUrl(UUID); } catch (e) { err = e as AppError; }
      expect(err).toBeInstanceOf(AppError);
      expect(err?.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('getCues', () => {
    it('throws PROJECT_NOT_FOUND for missing project', () => {
      mockDb.getProject.mockReturnValue(null);
      const svc = new VideoService(mockDb as never);
      let err: AppError | undefined;
      try { svc.getCues(UUID); } catch (e) { err = e as AppError; }
      expect(err).toBeInstanceOf(AppError);
      expect(err?.code).toBe('PROJECT_NOT_FOUND');
    });

    it('throws SUBTITLE_DATA_CORRUPT when subtitleStatus is null', () => {
      mockDb.getProject.mockReturnValue(makeProject({ subtitleStatus: null }));
      const svc = new VideoService(mockDb as never);
      let err: AppError | undefined;
      try { svc.getCues(UUID); } catch (e) { err = e as AppError; }
      expect(err?.code).toBe('SUBTITLE_DATA_CORRUPT');
    });

    it('throws SUBTITLE_DATA_CORRUPT when subtitleStatus is selected', () => {
      mockDb.getProject.mockReturnValue(makeProject({ subtitleStatus: 'selected' }));
      const svc = new VideoService(mockDb as never);
      let err: AppError | undefined;
      try { svc.getCues(UUID); } catch (e) { err = e as AppError; }
      expect(err?.code).toBe('SUBTITLE_DATA_CORRUPT');
    });

    it('throws SUBTITLE_DATA_CORRUPT when subtitle document is null', () => {
      mockDb.getProject.mockReturnValue(makeProject({ subtitleStatus: 'ready' }));
      mockDb.getSubtitleDocument.mockReturnValue(null);
      const svc = new VideoService(mockDb as never);
      let err: AppError | undefined;
      try { svc.getCues(UUID); } catch (e) { err = e as AppError; }
      expect(err?.code).toBe('SUBTITLE_DATA_CORRUPT');
    });

    it('returns mapped cues from subtitle document', () => {
      mockDb.getProject.mockReturnValue(makeProject({ subtitleStatus: 'ready' }));
      mockDb.getSubtitleDocument.mockReturnValue(makeDoc());
      const svc = new VideoService(mockDb as never);
      const { cues } = svc.getCues(UUID);
      expect(cues).toHaveLength(2);
      expect(cues[0]).toEqual({ index: 0, startMs: 0, endMs: 1000, text: 'Hello' });
      expect(cues[1]).toEqual({ index: 1, startMs: 1500, endMs: 2500, text: 'World' });
    });

    it('accepts ready_with_warnings subtitle status', () => {
      mockDb.getProject.mockReturnValue(makeProject({ subtitleStatus: 'ready_with_warnings' }));
      mockDb.getSubtitleDocument.mockReturnValue({ cues: [] });
      const svc = new VideoService(mockDb as never);
      const { cues } = svc.getCues(UUID);
      expect(cues).toHaveLength(0);
    });

    it('truncates cue text exceeding 2000 chars', () => {
      const longText = 'x'.repeat(3000);
      mockDb.getProject.mockReturnValue(makeProject({ subtitleStatus: 'ready' }));
      mockDb.getSubtitleDocument.mockReturnValue(
        makeDoc([{ index: 0, startMs: 0, endMs: 1000, text: longText, lines: [longText] }]),
      );
      const svc = new VideoService(mockDb as never);
      const { cues } = svc.getCues(UUID);
      expect(cues[0].text).toHaveLength(2000);
    });
  });
});
