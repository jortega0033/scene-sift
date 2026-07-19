import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateProjectForm } from '@renderer/features/projects/CreateProjectForm';
import { AppProviders } from '@renderer/app/providers';

describe('project form', () => {
  it('validates required fields', async () => {
    window.sceneSift = {
      app: { getVersion: async () => '0.1.0', getPlatform: async () => 'darwin' },
      dialog: {
        selectVideoFile: async () => null,
        selectSubtitleFile: async () => null,
        selectOutputDirectory: async () => null,
      },
      system: {
        getCapabilities: async () => ({
          app: { version: '0.1.0', platform: 'darwin', diagnosticsEnabled: false },
          ffmpeg: { ffmpegAvailable: false, ffprobeAvailable: false },
          database: { ok: true, dbPath: '/tmp/db', migrationsApplied: true },
        }),
      },
      ffmpeg: {
        checkAvailability: async () => ({ ffmpegAvailable: false, ffprobeAvailable: false }),
      },
      database: {
        getHealth: async () => ({ ok: true, dbPath: '/tmp/db', migrationsApplied: true }),
      },
      projects: {
        create: async () => {
          throw new Error('not used');
        },
        list: async () => [],
        get: async () => null,
        delete: async () => ({ deleted: true }),
      },
      queue: {
        list: async () => [],
        createDemoJob: async () => {
          throw new Error('not used');
        },
      },
      settings: {
        get: async () => ({
          ffmpegPathOverride: null,
          ffprobePathOverride: null,
          defaultOutputDirectory: null,
          preferredTheme: 'system' as const,
          developmentDiagnosticsEnabled: false,
        }),
        update: async () => ({
          ffmpegPathOverride: null,
          ffprobePathOverride: null,
          defaultOutputDirectory: null,
          preferredTheme: 'system' as const,
          developmentDiagnosticsEnabled: false,
        }),
        selectFfmpegPath: async () => null,
        selectFfprobePath: async () => null,
      },
    };

    const user = userEvent.setup();
    render(
      <AppProviders>
        <CreateProjectForm />
      </AppProviders>,
    );

    await user.click(screen.getByRole('button', { name: 'Save project' }));
    expect(screen.getByText('Project name is required.')).toBeInTheDocument();
    expect(
      screen.getByText(/Invalid input: expected object, received undefined/),
    ).toBeInTheDocument();
  });
});
