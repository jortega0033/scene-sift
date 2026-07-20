import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CompositionSettingsPanel } from '@renderer/features/projects/CompositionSettingsPanel';
import type { CompositionSettings } from '@shared/schemas/composition';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const NOW = 1_000_000;

const makeSettings = (overrides: Partial<CompositionSettings> = {}): CompositionSettings => ({
  projectId: PROJECT_ID,
  resolution: '1080x1920',
  backgroundStyle: 'blur',
  subtitlePosition: 'bottom',
  fontFamily: 'Arial',
  fontSize: 32,
  fontColor: '#FFFFFF',
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const makeCompositionApi = (overrides: Record<string, unknown> = {}) => ({
  getForProject: vi.fn<[string], Promise<{ settings: CompositionSettings }>>().mockResolvedValue({
    settings: makeSettings(),
  }),
  updateForProject: vi.fn<[string, object], Promise<{ settings: CompositionSettings }>>().mockResolvedValue({
    settings: makeSettings(),
  }),
  ...overrides,
});

const renderPanel = (compositionOverrides: Record<string, unknown> = {}) => {
  (window as Record<string, unknown>).sceneSift = { composition: makeCompositionApi(compositionOverrides) };
  return render(<CompositionSettingsPanel projectId={PROJECT_ID} />);
};

describe('CompositionSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders summary element', () => {
    renderPanel();
    expect(screen.getByText('Composition Settings')).toBeInTheDocument();
  });

  it('loads settings on mount', async () => {
    renderPanel();
    await waitFor(() => {
      expect((window.sceneSift as { composition: { getForProject: ReturnType<typeof vi.fn> } }).composition.getForProject).toHaveBeenCalledWith(PROJECT_ID);
    });
  });

  it('shows loading state initially', () => {
    renderPanel();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows controls after load', async () => {
    const user = userEvent.setup();
    const { container } = renderPanel();
    const summary = container.querySelector('summary')!;
    await user.click(summary);
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText(/resolution/i)).toBeInTheDocument();
  });

  it('shows load error when getForProject rejects', async () => {
    const user = userEvent.setup();
    const { container } = renderPanel({
      getForProject: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const summary = container.querySelector('summary')!;
    await user.click(summary);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('retry button re-calls getForProject', async () => {
    const user = userEvent.setup();
    const getForProject = vi.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValue({ settings: makeSettings() });
    const { container } = renderPanel({ getForProject });
    const summary = container.querySelector('summary')!;
    await user.click(summary);
    await waitFor(() => screen.getByText(/retry/i));
    await user.click(screen.getByText(/retry/i));
    await waitFor(() => expect(getForProject).toHaveBeenCalledTimes(2));
  });

  it('Save button disabled when no changes', async () => {
    const user = userEvent.setup();
    const { container } = renderPanel();
    const summary = container.querySelector('summary')!;
    await user.click(summary);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('Save button enabled after change', async () => {
    const user = userEvent.setup();
    const { container } = renderPanel();
    const summary = container.querySelector('summary')!;
    await user.click(summary);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText(/resolution/i), '720x1280');
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('calls updateForProject on Save click', async () => {
    const user = userEvent.setup();
    const updateForProject = vi.fn().mockResolvedValue({ settings: makeSettings({ resolution: '720x1280' }) });
    const { container } = renderPanel({ updateForProject });
    const summary = container.querySelector('summary')!;
    await user.click(summary);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText(/resolution/i), '720x1280');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(updateForProject).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.objectContaining({ resolution: '720x1280' }),
      );
    });
  });

  it('shows transient success message after save', async () => {
    const user = userEvent.setup();
    const updateForProject = vi.fn().mockResolvedValue({ settings: makeSettings({ resolution: '720x1280' }) });
    const { container } = renderPanel({ updateForProject });
    const summary = container.querySelector('summary')!;
    await user.click(summary);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText(/resolution/i), '720x1280');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(/settings saved/i);
  });

  it('shows save error when updateForProject rejects', async () => {
    const user = userEvent.setup();
    const updateForProject = vi.fn().mockRejectedValue(new Error('Save failed'));
    const { container } = renderPanel({ updateForProject });
    const summary = container.querySelector('summary')!;
    await user.click(summary);
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText(/resolution/i), '720x1280');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('reloads when projectId prop changes', async () => {
    const OTHER_ID = '22222222-2222-4222-8222-222222222222';
    const getForProject = vi.fn().mockResolvedValue({ settings: makeSettings() });
    (window as Record<string, unknown>).sceneSift = { composition: { getForProject, updateForProject: vi.fn().mockResolvedValue({ settings: makeSettings() }) } };
    const { rerender } = render(<CompositionSettingsPanel projectId={PROJECT_ID} />);
    await waitFor(() => expect(getForProject).toHaveBeenCalledWith(PROJECT_ID));
    act(() => {
      rerender(<CompositionSettingsPanel projectId={OTHER_ID} />);
    });
    await waitFor(() => expect(getForProject).toHaveBeenCalledWith(OTHER_ID));
  });
});
