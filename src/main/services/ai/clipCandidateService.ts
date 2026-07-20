import { randomUUID } from 'node:crypto';
import { AppError } from '@main/utils/errors';
import type { DatabaseService } from '@main/services/database/databaseService';
import type { AiService } from './aiService';
import type { AiConfigurationService } from './aiConfigurationService';
import { transcriptService } from '@main/services/transcript/transcriptService';
import { PROMPT_REGISTRY } from '@shared/prompts/registry';
import { AI_ERROR_MESSAGES } from '@shared/schemas/ai';
import type {
  GenerateCandidatesOutput,
  ListCandidatesOutput,
  AiCandidateItem,
} from '@shared/schemas/candidates';
import type { SubtitleCue } from '@shared/schemas/subtitle';

const MAX_TRANSCRIPT_CHARS = 28_000;
const TRANSCRIPT_GAP_THRESHOLD_MS = 500;

function msToTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function buildTranscriptText(cues: SubtitleCue[]): string {
  const entries = transcriptService.generateTranscript(cues, { gapThresholdMs: TRANSCRIPT_GAP_THRESHOLD_MS });
  const lines = entries.map((e) => `[${msToTimestamp(e.startMs)} - ${msToTimestamp(e.endMs)}] ${e.text}`);
  const full = lines.join('\n');
  if (full.length <= MAX_TRANSCRIPT_CHARS) return full;
  return full.slice(0, MAX_TRANSCRIPT_CHARS) + '\n[truncated]';
}

function deduplicateCandidates(candidates: AiCandidateItem[]): AiCandidateItem[] {
  const kept: AiCandidateItem[] = [];
  for (const candidate of candidates) {
    const overlapsWith = kept.some((k) => {
      const overlap = Math.max(0, Math.min(k.endMs, candidate.endMs) - Math.max(k.startMs, candidate.startMs));
      const minDuration = Math.min(k.endMs - k.startMs, candidate.endMs - candidate.startMs);
      return minDuration > 0 && overlap / minDuration > 0.5;
    });
    if (!overlapsWith) kept.push(candidate);
  }
  return kept;
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

    const configStatus = this.ai.getConfigurationStatus();
    if (configStatus === 'unconfigured') {
      throw new AppError('AI_NOT_CONFIGURED', AI_ERROR_MESSAGES.AI_NOT_CONFIGURED);
    }
    if (configStatus !== 'available') {
      throw new AppError('AI_PROVIDER_UNAVAILABLE', AI_ERROR_MESSAGES.AI_PROVIDER_UNAVAILABLE);
    }

    if (this.config) {
      const fullConfig = this.config.getConfigurationStatus();
      if (fullConfig.consentRecordedAt === null) {
        throw new AppError('AI_CONSENT_REQUIRED', AI_ERROR_MESSAGES.AI_CONSENT_REQUIRED);
      }
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
      const validatedCandidates = deduplicateCandidates(
        result.data.candidates
          .sort((a, b) => b.score - a.score)
          .filter((c) => c.endMs <= videoDurationMs),
      );

      const candidateRows = validatedCandidates.map((item, idx) => ({
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

      return { ok: true, candidateCount: validatedCandidates.length, generationId };
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

  updateCandidateStatus(candidateId: string, status: 'approved' | 'rejected' | 'skipped'): { ok: true } {
    this.db.updateCandidateStatus(candidateId, status);
    return { ok: true };
  }

  updateCandidateNotes(candidateId: string, notes: string | null): { ok: true } {
    this.db.updateCandidateNotes(candidateId, notes);
    return { ok: true };
  }
}
