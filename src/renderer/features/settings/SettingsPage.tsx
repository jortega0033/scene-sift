import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCapabilities } from '@renderer/hooks/useCapabilities';
import { useSettings, useUpdateSettings } from '@renderer/hooks/useSettings';
import { StatusPill } from '@renderer/components/StatusPill';
import { AiProviderSection } from './AiProviderSection';

const settingsFormSchema = z.object({
  ffmpegPathOverride: z.string(),
  ffprobePathOverride: z.string(),
  defaultOutputDirectory: z.string(),
  preferredTheme: z.enum(['system', 'light', 'dark']),
  developmentDiagnosticsEnabled: z.boolean(),
});

type FormValues = z.infer<typeof settingsFormSchema>;

const toFormValues = (settings: {
  ffmpegPathOverride: string | null;
  ffprobePathOverride: string | null;
  defaultOutputDirectory: string | null;
  preferredTheme: 'system' | 'light' | 'dark';
  developmentDiagnosticsEnabled: boolean;
}): FormValues => ({
  ffmpegPathOverride: settings.ffmpegPathOverride ?? '',
  ffprobePathOverride: settings.ffprobePathOverride ?? '',
  defaultOutputDirectory: settings.defaultOutputDirectory ?? '',
  preferredTheme: settings.preferredTheme,
  developmentDiagnosticsEnabled: settings.developmentDiagnosticsEnabled,
});

export const SettingsPage = () => {
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const capabilities = useCapabilities();
  const { register, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(settingsFormSchema),
    values: toFormValues({
      ffmpegPathOverride: settings.data?.ffmpegPathOverride ?? null,
      ffprobePathOverride: settings.data?.ffprobePathOverride ?? null,
      defaultOutputDirectory: settings.data?.defaultOutputDirectory ?? null,
      preferredTheme: settings.data?.preferredTheme ?? 'system',
      developmentDiagnosticsEnabled: settings.data?.developmentDiagnosticsEnabled ?? false,
    }),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateSettings.mutateAsync({
        defaultOutputDirectory: values.defaultOutputDirectory || null,
        preferredTheme: values.preferredTheme,
        developmentDiagnosticsEnabled: values.developmentDiagnosticsEnabled,
      });
      reset(values);
    } catch {
      // Mutation error is surfaced through updateSettings.error UI state.
    }
  });

  return (
    <section data-testid="settings-page" className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure system paths and local defaults for SceneSift processing.
        </p>
      </header>

      <form data-mono-surface="panel" className="space-y-5 p-4" onSubmit={onSubmit}>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-label">Media tools</h3>
          <label className="block text-sm">
            <span className="mb-1 block text-label uppercase tracking-label text-muted-foreground">
              FFmpeg path override
            </span>
            <div className="flex flex-wrap gap-2">
              <input
                {...register('ffmpegPathOverride')}
                readOnly
                className="h-[var(--control-height)] min-w-0 flex-1 rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm"
              />
              <button
                type="button"
                className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-3 text-sm"
                onClick={async () => {
                  const selected = await window.sceneSift.settings.selectFfmpegPath();
                  if (selected) {
                    reset(
                      toFormValues({
                        ffmpegPathOverride: selected,
                        ffprobePathOverride: settings.data?.ffprobePathOverride ?? null,
                        defaultOutputDirectory: settings.data?.defaultOutputDirectory ?? null,
                        preferredTheme: settings.data?.preferredTheme ?? 'system',
                        developmentDiagnosticsEnabled:
                          settings.data?.developmentDiagnosticsEnabled ?? false,
                      }),
                    );
                    void settings.refetch();
                  }
                }}
              >
                Select
              </button>
            </div>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-label uppercase tracking-label text-muted-foreground">
              FFprobe path override
            </span>
            <div className="flex flex-wrap gap-2">
              <input
                {...register('ffprobePathOverride')}
                readOnly
                className="h-[var(--control-height)] min-w-0 flex-1 rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm"
              />
              <button
                type="button"
                className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-3 text-sm"
                onClick={async () => {
                  const selected = await window.sceneSift.settings.selectFfprobePath();
                  if (selected) {
                    reset(
                      toFormValues({
                        ffmpegPathOverride: settings.data?.ffmpegPathOverride ?? null,
                        ffprobePathOverride: selected,
                        defaultOutputDirectory: settings.data?.defaultOutputDirectory ?? null,
                        preferredTheme: settings.data?.preferredTheme ?? 'system',
                        developmentDiagnosticsEnabled:
                          settings.data?.developmentDiagnosticsEnabled ?? false,
                      }),
                    );
                    void settings.refetch();
                  }
                }}
              >
                Select
              </button>
            </div>
          </label>
        </section>

        <section className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-label">Output</h3>
          <label className="block text-sm">
            <span className="mb-1 block text-label uppercase tracking-label text-muted-foreground">
              Default output directory
            </span>
            <input
              {...register('defaultOutputDirectory')}
              className="h-[var(--control-height)] w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm"
            />
          </label>
        </section>

        <section className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-label">Appearance</h3>
          <label className="block text-sm">
            <span className="mb-1 block text-label uppercase tracking-label text-muted-foreground">
              Preferred theme
            </span>
            <select
              {...register('preferredTheme')}
              className="h-[var(--control-height)] w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </section>

        <section className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-label">Diagnostics</h3>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" {...register('developmentDiagnosticsEnabled')} />
            Enable diagnostics logging
          </label>
        </section>

        <button
          type="submit"
          className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-foreground bg-foreground px-3 text-sm font-medium text-background"
        >
          Save settings
        </button>
        {updateSettings.error && (
          <p role="alert" className="text-xs text-foreground">
            {updateSettings.error instanceof Error
              ? updateSettings.error.message
              : 'Unable to save settings.'}
          </p>
        )}
      </form>

      <AiProviderSection />

      <div data-mono-surface="panel" className="space-y-3 p-4 text-sm">
        <h3 className="font-semibold uppercase tracking-label">System status</h3>
        <dl className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">App version</dt>
            <dd className="font-mono text-mono-path">
              {capabilities.data?.app.version ?? 'Loading…'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Platform</dt>
            <dd className="font-mono text-mono-path">
              {capabilities.data?.app.platform ?? 'Loading…'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">FFmpeg</dt>
            <dd>
              <StatusPill
                label={capabilities.data?.ffmpeg.ffmpegAvailable ? 'Available' : 'Missing'}
                status={capabilities.data?.ffmpeg.ffmpegAvailable ? 'ok' : 'warning'}
              />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">FFprobe</dt>
            <dd>
              <StatusPill
                label={capabilities.data?.ffmpeg.ffprobeAvailable ? 'Available' : 'Missing'}
                status={capabilities.data?.ffmpeg.ffprobeAvailable ? 'ok' : 'warning'}
              />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Database</dt>
            <dd>
              <StatusPill
                label={capabilities.data?.database.ok ? 'Healthy' : 'Unavailable'}
                status={capabilities.data?.database.ok ? 'ok' : 'warning'}
              />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Database path</dt>
            <dd className="mt-1 break-all font-mono text-label">
              {capabilities.data?.database.dbPath ?? 'Loading…'}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
};
