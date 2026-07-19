/**
 * SynchronizationService — orchestrates DB reads, calls analyzer, persists result.
 *
 * Prerequisite check is ALWAYS re-evaluated from actual DB values.
 * Never skips or short-circuits based on the stored sync_status value.
 */

import type { DatabaseService } from '@main/services/database/databaseService';
import type { SyncCheckResult } from '@shared/schemas/sync';
import type { SubtitleCue } from '@shared/schemas/subtitle';
import { analyze, SYNC_ANALYSIS_VERSION } from './SynchronizationAnalyzer';

export class SynchronizationService {
  constructor(private readonly db: DatabaseService) {}

  async checkForProject(projectId: string): Promise<SyncCheckResult> {
    try {
      // 1. Load project from DB
      const project = this.db.getProject(projectId);
      if (!project) {
        return {
          syncStatus: 'not_available',
          syncWarnings: [],
          syncCheckedAt: null,
          syncAnalysisVersion: null,
        };
      }

      // 2. Re-check actual prerequisites — NEVER early-return based on stored sync_status
      // inspectionStatus = project.status === 'ready' (inspection succeeded)
      // subtitleStatus must be 'ready' or 'ready_with_warnings'
      const prerequisitesMet =
        project.status === 'ready' &&
        (project.subtitleStatus === 'ready' || project.subtitleStatus === 'ready_with_warnings');

      if (!prerequisitesMet) {
        this.db.updateProjectSyncStatus(projectId, {
          syncStatus: 'not_available',
          syncWarnings: [],
          syncCheckedAt: null,
          syncAnalysisVersion: null,
        });
        return {
          syncStatus: 'not_available',
          syncWarnings: [],
          syncCheckedAt: null,
          syncAnalysisVersion: null,
        };
      }

      // 3. Get duration (convert durationSeconds → ms)
      const durationSeconds = project.mediaMetadata?.durationSeconds ?? null;
      const durationMs = durationSeconds != null ? Math.floor(durationSeconds * 1000) : 0;

      // 4. Get subtitle cues from subtitle_documents table
      const subtitleDoc = this.db.getSubtitleDocument(projectId);
      const cues: Pick<SubtitleCue, 'startMs' | 'endMs'>[] = subtitleDoc
        ? subtitleDoc.cues.map((c) => ({ startMs: c.startMs, endMs: c.endMs }))
        : [];

      // 5. Run pure analysis
      const result = analyze({
        durationMs,
        cues,
        analysisVersion: SYNC_ANALYSIS_VERSION,
      });

      // 6. Persist result
      const syncCheckedAt = Date.now();
      this.db.updateProjectSyncStatus(projectId, {
        syncStatus: result.syncStatus,
        syncWarnings: result.syncWarnings,
        syncCheckedAt,
        syncAnalysisVersion: result.syncAnalysisVersion,
      });

      return {
        syncStatus: result.syncStatus,
        syncWarnings: result.syncWarnings,
        syncCheckedAt,
        syncAnalysisVersion: result.syncAnalysisVersion,
      };
    } catch {
      return {
        syncStatus: 'check_failed',
        syncWarnings: [],
        syncCheckedAt: null,
        syncAnalysisVersion: null,
      };
    }
  }
}
