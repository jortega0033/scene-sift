import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ProjectRecord } from '@shared/schemas/project';
import type { SyncWarning } from '@shared/schemas/sync';
import {
  formatSyncWarning,
  formatSyncCheckedAt,
  computeDisplaySyncStatus,
} from './syncFormatters';

type SyncPanelProps = {
  project: ProjectRecord;
};

function parseSyncWarnings(syncWarningsJson: string | null): SyncWarning[] {
  if (!syncWarningsJson) return [];
  try {
    return JSON.parse(syncWarningsJson) as SyncWarning[];
  } catch {
    return [];
  }
}

const syncStatusLabel: Record<string, string> = {
  not_available: 'Not available',
  ready_to_check: 'Ready to check',
  timing_ok: 'Timing OK',
  needs_review: 'Needs review',
  check_failed: 'Check failed',
  stale: 'Needs recheck',
};

const syncStatusPillClass: Record<string, string> = {
  not_available: 'text-muted-foreground',
  ready_to_check: 'text-blue-600 dark:text-blue-400',
  timing_ok: 'text-green-600 dark:text-green-400',
  needs_review: 'text-amber-600 dark:text-amber-400',
  check_failed: 'text-red-600 dark:text-red-400',
  stale: 'text-orange-600 dark:text-orange-400',
};

export const SyncPanel = ({ project }: SyncPanelProps) => {
  const queryClient = useQueryClient();
  const [isChecking, setIsChecking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const inspectedAt = project.mediaMetadata?.inspectedAt ?? null;
  const displayStatus = computeDisplaySyncStatus(
    project.syncStatus,
    project.syncCheckedAt,
    inspectedAt,
    project.subtitleParsedAt,
  );

  const syncWarnings = parseSyncWarnings(project.syncWarningsJson);

  const canCheck =
    project.status === 'ready' &&
    (project.subtitleStatus === 'ready' || project.subtitleStatus === 'ready_with_warnings');

  const handleCheckSync = async () => {
    setIsChecking(true);
    setLocalError(null);
    try {
      await window.sceneSift.sync.checkForProject(project.id);
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch {
      setLocalError('Sync check failed. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const buttonLabel = () => {
    if (isChecking) return 'Checking...';
    if (displayStatus === 'stale') return 'Recheck timing';
    if (displayStatus === 'check_failed') return 'Retry check';
    return 'Check timing';
  };

  return (
    <dl data-testid="sync-panel" className="space-y-3 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-label font-semibold uppercase tracking-label text-muted-foreground">
          Sync check
        </h4>
        {displayStatus !== 'not_available' && displayStatus !== 'ready_to_check' && (
          <span
            data-testid="sync-status"
            className={`text-label font-medium ${syncStatusPillClass[displayStatus] ?? 'text-muted-foreground'}`}
          >
            {syncStatusLabel[displayStatus] ?? displayStatus}
          </span>
        )}
      </div>

      {displayStatus === 'not_available' && (
        <p
          data-testid="sync-status"
          className="text-sm text-muted-foreground"
        >
          Structural timing check is not available. Ensure video is inspected and subtitle is parsed.
        </p>
      )}

      {displayStatus === 'ready_to_check' && (
        <p
          data-testid="sync-status"
          className="text-sm text-muted-foreground"
        >
          Ready to check subtitle timing against video duration.
        </p>
      )}

      {displayStatus === 'timing_ok' && (
        <p className="text-sm text-muted-foreground">
          Structural timing check passed. No anomalies detected.
        </p>
      )}

      {displayStatus === 'stale' && (
        <p className="text-sm text-muted-foreground">
          Video or subtitle has changed since the last check. Recheck to get current results.
        </p>
      )}

      {displayStatus === 'needs_review' && syncWarnings.length > 0 && (
        <ul
          data-testid="sync-warnings-list"
          className="space-y-1"
        >
          {syncWarnings.map((warning, i) => (
            <li
              key={i}
              className="rounded border border-border px-3 py-2 text-xs text-muted-foreground"
            >
              {formatSyncWarning(warning)}
            </li>
          ))}
        </ul>
      )}

      {displayStatus === 'check_failed' && (
        <p className="rounded border border-border px-3 py-2 text-xs text-muted-foreground">
          The timing check could not be completed.
        </p>
      )}

      {localError && (
        <p role="alert" className="text-xs text-foreground">
          {localError}
        </p>
      )}

      {project.syncCheckedAt !== null && displayStatus !== 'stale' && (
        <p className="text-xs text-muted-foreground">
          Last checked: {formatSyncCheckedAt(project.syncCheckedAt)}
        </p>
      )}

      <div>
        <button
          type="button"
          data-testid="sync-check-button"
          className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-foreground px-3 text-sm hover:bg-muted disabled:opacity-50"
          disabled={isChecking || !canCheck}
          onClick={() => void handleCheckSync()}
        >
          {buttonLabel()}
        </button>
      </div>
    </dl>
  );
};
