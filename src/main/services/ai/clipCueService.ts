import { randomUUID } from 'node:crypto';
import type { DatabaseService } from '@main/services/database/databaseService';
import { AppError } from '@main/utils/errors';
import type { ClipCue } from '@shared/schemas/clipCues';
import type { SubtitleCue } from '@shared/schemas/subtitle';

function extractCuesForClip(
  sourceCues: SubtitleCue[],
  clipStartMs: number,
  clipEndMs: number,
): Omit<ClipCue, 'id' | 'candidateId' | 'createdAt' | 'updatedAt'>[] {
  const clipDurationMs = clipEndMs - clipStartMs;
  const result: Omit<ClipCue, 'id' | 'candidateId' | 'createdAt' | 'updatedAt'>[] = [];
  let sequenceIndex = 1;

  for (const cue of sourceCues) {
    // Exclude entirely outside
    if (cue.endMs <= clipStartMs || cue.startMs >= clipEndMs) continue;

    // Clamp to clip boundaries
    const clampedStart = Math.max(cue.startMs, clipStartMs);
    const clampedEnd = Math.min(cue.endMs, clipEndMs);

    // Exclude zero-duration after clamping
    if (clampedEnd <= clampedStart) continue;

    // Rebase
    const rebasedStart = clampedStart - clipStartMs;
    const rebasedEnd = Math.min(clampedEnd - clipStartMs, clipDurationMs);

    // Exclude if still zero-duration after rebase clamp
    if (rebasedEnd <= rebasedStart) continue;

    result.push({
      sequenceIndex,
      startMs: rebasedStart,
      endMs: rebasedEnd,
      text: cue.text,
    });
    sequenceIndex++;
  }

  return result;
}

export class ClipCueService {
  constructor(private readonly db: DatabaseService) {}

  generateClipCues(candidateId: string): { cueCount: number } {
    const candidate = this.db.getCandidateById(candidateId);
    if (!candidate) {
      throw new AppError('CANDIDATE_NOT_FOUND', `Candidate ${candidateId} not found.`);
    }

    const subtitleDoc = this.db.getSubtitleDocument(candidate.projectId);
    if (!subtitleDoc) {
      throw new AppError('SUBTITLE_NOT_READY', 'No parsed subtitle document for this project.');
    }

    const extracted = extractCuesForClip(subtitleDoc.cues, candidate.startMs, candidate.endMs);

    this.db.deleteClipCuesByCandidate(candidateId);

    const cuesWithIds = extracted.map((c) => ({ ...c, id: randomUUID(), candidateId }));
    this.db.insertClipCues(cuesWithIds);

    return { cueCount: cuesWithIds.length };
  }

  listClipCues(candidateId: string): { cues: ClipCue[] } {
    return { cues: this.db.listClipCues(candidateId) };
  }

  updateClipCue(cueId: string, startMs: number, endMs: number, text: string): { ok: true } {
    this.db.updateClipCue(cueId, startMs, endMs, text);
    return { ok: true };
  }

  deleteClipCue(cueId: string): { ok: true } {
    this.db.deleteClipCue(cueId);
    return { ok: true };
  }

  addClipCue(
    candidateId: string,
    startMs: number,
    endMs: number,
    text: string,
  ): { cue: ClipCue } {
    const nextIndex = this.db.maxClipCueSequenceIndex(candidateId) + 1;
    const cue = this.db.insertClipCue({
      id: randomUUID(),
      candidateId,
      sequenceIndex: nextIndex,
      startMs,
      endMs,
      text,
    });
    return { cue };
  }
}
