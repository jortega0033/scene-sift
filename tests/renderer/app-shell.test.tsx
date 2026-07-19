import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@renderer/app/App';
import { AppProviders } from '@renderer/app/providers';
import { ErrorBoundary } from '@renderer/app/ErrorBoundary';

const installMockApi = () => {
  window.sceneSift = {
    app: {
      getVersion: async () => '0.1.0',
      getPlatform: async () => 'darwin',
    },
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
};

describe('renderer shell', () => {
  it('renders navigation and empty project state', async () => {
    installMockApi();
    render(
      <ErrorBoundary>
        <AppProviders>
          <App />
        </AppProviders>
      </ErrorBoundary>,
    );

    expect(screen.getByText('SceneSift')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Projects' })).toBeInTheDocument();
    await screen.findByText('No projects yet.');
    await waitFor(() => expect(screen.getAllByText('Missing').length).toBeGreaterThan(0));
  });

  it('navigates between pages', async () => {
    installMockApi();
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <AppProviders>
          <App />
        </AppProviders>
      </ErrorBoundary>,
    );

    await user.click(screen.getByRole('button', { name: 'Queue' }));
    expect(screen.getByRole('heading', { name: 'Queue' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });
});
