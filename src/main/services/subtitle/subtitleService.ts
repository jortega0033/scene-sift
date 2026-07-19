import { extname, resolve as resolvePath } from 'node:path';
import type { ProjectRecord } from '@shared/schemas/project';
import type { SubtitleDocument, SubtitlePersistOutcome } from '@shared/schemas/subtitle';
import type { DatabaseService } from '@main/services/database/databaseService';
import { selectSubtitleFile } from '@main/services/files/dialogService';
import { AppError } from '@main/utils/errors';
import { readSubtitleFile } from './subtitleReader';
import { parseSrt } from './parsers/SrtParser';
import { parseVtt } from './parsers/VttParser';
import { normalizeSubtitleCues } from './subtitleNormalizer';

type SubtitleFormat = 'srt' | 'vtt';

function detectFormat(resolvedPath: string): SubtitleFormat | null {
  const ext = extname(resolvedPath).toLowerCase();
  if (ext === '.srt') return 'srt';
  if (ext === '.vtt') return 'vtt';
  return null;
}

function buildUnsupportedOutcome(parsedAt: number): SubtitlePersistOutcome {
  return { subtitleStatus: 'unsupported', cueCount: null, lastCueEndMs: null, parseError: 'SUBTITLE_UNSUPPORTED_FORMAT', parsedAt };
}

function buildMissingOutcome(parsedAt: number): SubtitlePersistOutcome {
  return { subtitleStatus: 'missing', cueCount: null, lastCueEndMs: null, parseError: 'SUBTITLE_FILE_NOT_FOUND', parsedAt };
}

function buildParseFailedOutcome(parsedAt: number, errorCode: string): SubtitlePersistOutcome {
  return { subtitleStatus: 'parse_failed', cueCount: null, lastCueEndMs: null, parseError: errorCode.slice(0, 64), parsedAt };
}

export class SubtitleService {
  constructor(private readonly databaseService: DatabaseService) {}

  async selectSubtitleForProject(projectId: string): Promise<ProjectRecord | null> {
    const project = this.databaseService.getProject(projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found.');
    }

    const selected = await selectSubtitleFile();
    if (!selected) return null;

    return this.databaseService.setProjectSubtitlePath(projectId, selected.path);
  }

  async parseSubtitleForProject(projectId: string): Promise<ProjectRecord> {
    const project = this.databaseService.getProject(projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found.');
    }

    if (!project.subtitlePath) {
      return project;
    }

    const resolvedPath = resolvePath(project.subtitlePath);
    const format = detectFormat(resolvedPath);
    const parsedAt = Date.now();

    if (!format) {
      return this.databaseService.persistSubtitleResult(
        projectId,
        project.subtitlePath,
        buildUnsupportedOutcome(parsedAt),
        null,
      );
    }

    let content: string;
    try {
      const result = await readSubtitleFile(resolvedPath);
      content = result.content;
    } catch (err) {
      if (err instanceof AppError) {
        if (err.code === 'SUBTITLE_FILE_NOT_FOUND') {
          return this.databaseService.persistSubtitleResult(
            projectId,
            project.subtitlePath,
            buildMissingOutcome(parsedAt),
            null,
          );
        }
        if (err.code === 'SUBTITLE_FILE_TOO_LARGE') {
          return this.databaseService.persistSubtitleResult(
            projectId,
            project.subtitlePath,
            buildParseFailedOutcome(parsedAt, 'SUBTITLE_FILE_TOO_LARGE'),
            null,
          );
        }
      }
      return this.databaseService.persistSubtitleResult(
        projectId,
        project.subtitlePath,
        buildParseFailedOutcome(parsedAt, 'SUBTITLE_PARSE_ERROR'),
        null,
      );
    }

    let rawCues;
    let rawWarnings;

    try {
      if (format === 'srt') {
        const result = parseSrt(content);
        rawCues = result.cues;
        rawWarnings = result.warnings;
      } else {
        const result = parseVtt(content);
        rawCues = result.cues;
        rawWarnings = result.warnings;
      }
    } catch (err) {
      let code = 'SUBTITLE_PARSE_ERROR';
      if (err instanceof Error && err.message === 'SUBTITLE_INVALID_FORMAT') {
        code = 'SUBTITLE_INVALID_FORMAT';
      }
      return this.databaseService.persistSubtitleResult(
        projectId,
        project.subtitlePath,
        buildParseFailedOutcome(parsedAt, code),
        null,
      );
    }

    const { cues, warnings } = normalizeSubtitleCues(rawCues, rawWarnings);

    if (cues.length === 0) {
      return this.databaseService.persistSubtitleResult(
        projectId,
        project.subtitlePath,
        buildParseFailedOutcome(parsedAt, 'SUBTITLE_PARSE_ERROR'),
        null,
      );
    }

    const lastCue = cues[cues.length - 1]!;
    const status = warnings.length > 0 ? 'ready_with_warnings' : 'ready';

    const outcome: SubtitlePersistOutcome = {
      subtitleStatus: status,
      cueCount: cues.length,
      lastCueEndMs: lastCue.endMs,
      parseError: null,
      parsedAt,
    };

    const summary = {
      cueCount: cues.length,
      firstCueStartMs: cues[0]?.startMs ?? null,
      lastCueEndMs: lastCue.endMs,
      totalTextLength: cues.reduce((sum, c) => sum + c.text.length, 0),
      warningCount: warnings.length,
    };

    const doc: SubtitleDocument = {
      schemaVersion: 1,
      sourceFormat: format,
      sourceEncoding: 'utf-8',
      cues,
      warnings,
      summary,
      parsedAt,
    };

    return this.databaseService.persistSubtitleResult(projectId, project.subtitlePath, outcome, doc);
  }

  async clearSubtitleForProject(projectId: string): Promise<ProjectRecord> {
    const project = this.databaseService.getProject(projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found.');
    }

    return this.databaseService.setProjectSubtitlePath(projectId, null);
  }
}

