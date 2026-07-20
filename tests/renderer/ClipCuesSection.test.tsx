import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClipCuesSection } from '@renderer/features/projects/ClipCuesSection';
import type { ClipCue } from '@shared/schemas/clipCues';

const CANDIDATE_ID = '11111111-1111-4111-8111-111111111111';
const CUE_ID = '22222222-2222-4222-8222-222222222222';
const NOW = 1_000_000;

const makeCue = (overrides: Partial<ClipCue> = {}): ClipCue => ({
  id: CUE_ID,
  candidateId: CANDIDATE_ID,
  sequenceIndex: 1,
  startMs: 0,
  endMs: 5_000,
  text: 'Hello world',
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const makeApi = (cues: ClipCue[] = []) => ({
  generateClipCues: vi.fn().mockResolvedValue({ cueCount: cues.length }),
  listClipCues: vi.fn().mockResolvedValue({ cues }),
  updateClipCue: vi.fn().mockResolvedValue({ ok: true }),
  deleteClipCue: vi.fn().mockResolvedValue({ ok: true }),
  addClipCue: vi.fn().mockResolvedValue({ cue: makeCue() }),
});

const renderSection = (cues: ClipCue[] = [], durationMs = 30_000) => {
  const api = makeApi(cues);
  Object.defineProperty(window, 'sceneSift', {
    value: { ai: api },
    writable: true,
    configurable: true,
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={qc}>
      <ClipCuesSection candidateId={CANDIDATE_ID} candidateDurationMs={durationMs} />
    </QueryClientProvider>,
  );
  return { ...result, api };
};

describe('ClipCuesSection', () => {
  it('renders clip-cues-section container', () => {
    renderSection();
    expect(screen.getByTestId('clip-cues-section')).toBeInTheDocument();
  });

  it('shows generate-cues-button', () => {
    renderSection();
    expect(screen.getByTestId('generate-cues-button')).toBeInTheDocument();
  });

  it('calls generateClipCues on button click', async () => {
    const { api } = renderSection();
    await userEvent.click(screen.getByTestId('generate-cues-button'));
    await waitFor(() => expect(api.generateClipCues).toHaveBeenCalledWith(CANDIDATE_ID));
  });

  it('shows loaded cues with clip-cue-item testids', async () => {
    renderSection([makeCue({ id: CUE_ID, text: 'First cue' })]);
    await waitFor(() => {
      expect(screen.getAllByTestId('clip-cue-item')).toHaveLength(1);
    });
    expect(screen.getByText('First cue')).toBeInTheDocument();
  });

  it('shows delete-cue-button for each cue', async () => {
    renderSection([makeCue()]);
    await waitFor(() => {
      expect(screen.getByTestId('delete-cue-button')).toBeInTheDocument();
    });
  });

  it('calls deleteClipCue when delete button clicked', async () => {
    const { api } = renderSection([makeCue()]);
    await waitFor(() => screen.getByTestId('delete-cue-button'));
    await userEvent.click(screen.getByTestId('delete-cue-button'));
    await waitFor(() => expect(api.deleteClipCue).toHaveBeenCalledWith(CUE_ID));
  });

  it('shows show-add-cue-form-button', async () => {
    renderSection();
    expect(screen.getByTestId('show-add-cue-form-button')).toBeInTheDocument();
  });

  it('reveals add-cue-button when show-add-cue-form-button clicked', async () => {
    renderSection();
    await userEvent.click(screen.getByTestId('show-add-cue-form-button'));
    expect(screen.getByTestId('add-cue-button')).toBeInTheDocument();
    expect(screen.getByTestId('new-cue-text-input')).toBeInTheDocument();
  });

  it('shows "Regenerate cues" label when cues exist', async () => {
    renderSection([makeCue()]);
    await waitFor(() => screen.getByTestId('clip-cue-item'));
    expect(screen.getByTestId('generate-cues-button')).toHaveTextContent('Regenerate cues');
  });

  it('shows empty state message when no cues', async () => {
    renderSection([]);
    await waitFor(() => {
      expect(screen.queryByText(/No cues/)).toBeInTheDocument();
    });
  });
});
