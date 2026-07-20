import { randomUUID } from 'node:crypto';
import { AppError } from '@main/utils/errors';
import type { DatabaseService } from '@main/services/database/databaseService';
import type { AiService } from './aiService';
import type { AiConfigurationService } from './aiConfigurationService';
import { PROMPT_REGISTRY } from '@shared/prompts/registry';
import type {
  GenerateCandidatesOutput,
  ListCandidatesOutput,
} from '@shared/schemas/candidates';
import type { SubtitleCue } from '@shared/schemas/subtitle';

const MAX_TRANSCRIPT_CHARS = 28_000;

function msToTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function buildTranscriptText(cues: SubtitleCue[]): string {
  const lines = cues.map((c) => `[${msToTimestamp(c.startMs)} - ${msToTimestamp(c.endMs)}] ${c.text}`);
  const full = lines.join('\n');
  if (full.length <= MAX_TRANSCRIPT_CHARS) return full;
  return full.slice(0, MAX_TRANSCRIPT_CHARS) + '\n[truncated]';
}

function requestIdForProject(projectId: string): string {
  return `candidates-${projectId}`;
}

export class ClipCandidateService {
  private readonly activeProjectIds = new Set<string>();

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
    private readonly config?: AiConfigurationService,
  ) {}

  async generateCandidates(projectId: string): Promise<GenerateCandidatesOutput> {
    const project = this.db.getProject(projectId);
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found.');
    }

    const subtitleOk =
      project.subtitleStatus === 'ready' || project.subtitleStatus === 'ready_with_warnings';
    if (!subtitleOk) {
      throw new AppError('SUBTITLE_NOT_READY', 'Subtitle must be parsed before generating candidates.');
    }

    const doc = this.db.getSubtitleDocument(projectId);
    if (!doc || doc.cues.length === 0) {
      throw new AppError('SUBTITLE_NOT_READY', 'No subtitle cues available.');
    }

    if (this.activeProjectIds.has(projectId)) {
      throw new AppError('GENERATION_ALREADY_IN_PROGRESS', 'A generation is already running for this project.');
    }

    const generationId = randomUUID();
    const requestId = requestIdForProject(projectId);
    const prompt = PROMPT_REGISTRY.clipCandidates;
    const transcriptText = buildTranscriptText(doc.cues);
    const videoDurationMs =
      project.mediaMetadata?.durationSeconds != null
        ? Math.round(project.mediaMetadata.durationSeconds * 1000)
        : (doc.summary.lastCueEndMs ?? 0);

    this.db.updateCandidateGenerationStatus(projectId, {
      candidateGenerationStatus: 'generating',
      candidateGenerationError: null,
      candidateGeneratedAt: null,
    });
    this.activeProjectIds.add(projectId);

    try {
      const result = await this.ai.executeStructuredRequest(
        {
          requestId,
          systemPrompt: prompt.systemInstructions,
          userContent: prompt.buildUserContent({ transcriptText, videoDurationMs }),
          outputSchemaName: 'aiCandidatesOutput',
          outputSchema: prompt.outputJsonSchema,
          maxOutputTokens: prompt.maxOutputTokens,
          timeoutMs: prompt.maxDurationMs,
        },
        prompt.outputValidator,
      );

      const now = Date.now();
      const candidateRows = result.data.candidates.map((item, idx) => ({
        id: randomUUID(),
        projectId,
        generationId,
        candidateStatus: 'suggested' as const,
        startMs: item.startMs,
        endMs: item.endMs,
        title: item.title,
        reason: item.reason,
        scoreRaw: item.score,
        sortOrder: idx,
        modelId: this.config?.getProviderModel() ?? 'unknown',
        promptVersion: String(prompt.version),
        createdAt: now,
        updatedAt: now,
      }));

      this.db.clearAndInsertCandidates(projectId, candidateRows);
      this.db.updateCandidateGenerationStatus(projectId, {
        candidateGenerationStatus: 'done',
        candidateGenerationError: null,
        candidateGeneratedAt: now,
      });

      return { ok: true, candidateCount: candidateRows.length, generationId };
    } catch (err) {
      const isCancel = err instanceof Error && err.name === 'AbortError';
      const status = isCancel ? 'cancelled' : 'failed';
      const errorCode = isCancel
        ? null
        : err instanceof AppError
          ? err.code
          : 'AI_INTERNAL_ERROR';

      this.db.updateCandidateGenerationStatus(projectId, {
        candidateGenerationStatus: status,
        candidateGenerationError: errorCode,
        candidateGeneratedAt: null,
      });

      throw err;
    } finally {
      this.activeProjectIds.delete(projectId);
    }
  }

  cancelGeneration(projectId: string): { cancelled: boolean } {
    if (!this.activeProjectIds.has(projectId)) return { cancelled: false };
    this.ai.cancelRequest(requestIdForProject(projectId));
    return { cancelled: true };
  }

  listCandidates(projectId: string): ListCandidatesOutput {
    return this.db.listCandidatesForProject(projectId);
  }

  updateCandidateStatus(candidateId: string, status: 'approved' | 'rejected'): { ok: true } {
    this.db.updateCandidateStatus(candidateId, status);
    return { ok: true };
  }
}
