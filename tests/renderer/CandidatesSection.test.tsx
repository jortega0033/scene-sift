import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CandidatesSection } from '@renderer/features/projects/CandidatesSection';
import type { ProjectRecord } from '@shared/schemas/project';
import type { ListCandidatesOutput, GenerateCandidatesOutput, ClipCandidate } from '@shared/schemas/candidates';

const TEST_ID = '11111111-1111-4111-8111-111111111111';
const CANDIDATE_ID = '22222222-2222-4222-8222-222222222222';
const GEN_ID = '33333333-3333-4333-8333-333333333333';
const NOW = 1_000_000;

const makeProject = (overrides: Partial<ProjectRecord> = {}): ProjectRecord => ({
  id: TEST_ID,
  name: 'Test',
  videoPath: '/tmp/v.mp4',
  subtitlePath: '/tmp/s.srt',
  outputDirectory: null,
  status: 'ready',
  createdAt: NOW,
  updatedAt: NOW,
  mediaMetadata: null,
  inspectionError: null,
  subtitleStatus: 'ready',
  subtitleCueCount: 10,
  subtitleLastCueEndMs: 30000,
  subtitleParseError: null,
  subtitleParsedAt: NOW,
  syncStatus: null,
  syncCheckedAt: null,
  syncWarningsJson: null,
  syncAnalysisVersion: null,
  ...overrides,
});

const makeCandidate = (overrides: Partial<ClipCandidate> = {}): ClipCandidate => ({
  id: CANDIDATE_ID,
  projectId: TEST_ID,
  generationId: GEN_ID,
  candidateStatus: 'suggested',
  startMs: 1000,
  endMs: 10000,
  title: 'Great moment',
  reason: 'High energy section',
  scoreRaw: 0.85,
  sortOrder: 0,
  modelId: 'gpt-4o-mini',
  promptVersion: '1',
  notes: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const makeListOutput = (overrides: Partial<ListCandidatesOutput> = {}): ListCandidatesOutput => ({
  candidates: [],
  generationStatus: null,
  generationError: null,
  generatedAt: null,
  ...overrides,
});

const AVAILABLE_CONFIG = { configurationStatus: 'available', maskedEndpoint: null, model: null, providerType: 'openai_compatible', lastTestedAt: null, lastTestError: null, consentRecordedAt: null };

const makeAiApi = (overrides: Record<string, unknown> = {}) => ({
  getConfigurationStatus: vi.fn().mockResolvedValue(AVAILABLE_CONFIG),
  setApiKey: vi.fn(),
  testConnection: vi.fn(),
  cancelTest: vi.fn(),
  clearConfiguration: vi.fn(),
  recordConsent: vi.fn(),
  generateCandidates: vi.fn<[], Promise<GenerateCandidatesOutput>>().mockResolvedValue({
    ok: true,
    candidateCount: 0,
    generationId: GEN_ID,
  }),
  cancelGeneration: vi.fn().mockResolvedValue({ cancelled: false }),
  listCandidates: vi.fn<[], Promise<ListCandidatesOutput>>().mockResolvedValue(makeListOutput()),
  updateCandidateStatus: vi.fn().mockResolvedValue({ ok: true }),
  updateCandidateNotes: vi.fn().mockResolvedValue({ ok: true }),
  ...overrides,
});

const renderSection = (
  project: ProjectRecord = makeProject(),
  aiOverrides: Record<string, unknown> = {},
) => {
  (window as Record<string, unknown>).sceneSift = { ai: makeAiApi(aiOverrides) };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <CandidatesSection project={project} />
      </QueryClientProvider>,
    ),
    queryClient,
  };
};

describe('CandidatesSection', () => {
  describe('subtitle not ready', () => {
    it('shows placeholder when subtitle is not selected', async () => {
      renderSection(makeProject({ subtitleStatus: null }));
      expect(screen.getByTestId('candidates-section')).toBeInTheDocument();
      expect(screen.getByText(/parse the subtitle file first/i)).toBeInTheDocument();
      expect(screen.queryByTestId('generate-candidates-button')).not.toBeInTheDocument();
    });

    it('shows placeholder for status=selected', async () => {
      renderSection(makeProject({ subtitleStatus: 'selected' }));
      expect(screen.getByText(/parse the subtitle file first/i)).toBeInTheDocument();
    });

    it('shows placeholder for status=parse_failed', async () => {
      renderSection(makeProject({ subtitleStatus: 'parse_failed' }));
      expect(screen.getByText(/parse the subtitle file first/i)).toBeInTheDocument();
    });
  });

  describe('project not ready', () => {
    it('shows placeholder when project status is not ready', () => {
      renderSection(makeProject({ status: 'inspection_failed' }));
      expect(screen.getByTestId('candidates-section')).toBeInTheDocument();
      expect(screen.getByText(/inspection must succeed/i)).toBeInTheDocument();
      expect(screen.queryByTestId('generate-candidates-button')).not.toBeInTheDocument();
    });
  });

  describe('AI not configured', () => {
    it('disables generate button and shows message when AI not available', async () => {
      renderSection(makeProject(), {
        getConfigurationStatus: vi.fn().mockResolvedValue({ ...AVAILABLE_CONFIG, configurationStatus: 'unconfigured' }),
      });

      await screen.findByTestId('generate-candidates-button');
      expect(screen.getByTestId('generate-candidates-button')).toBeDisabled();
      expect(await screen.findByTestId('ai-not-configured-message')).toBeInTheDocument();
    });
  });

  describe('subtitle ready', () => {
    it('renders section with generate button when no prior generation', async () => {
      renderSection();
      expect(await screen.findByTestId('candidates-section')).toBeInTheDocument();
      expect(await screen.findByTestId('generate-candidates-button')).toBeInTheDocument();
      expect(screen.queryByTestId('cancel-generation-button')).not.toBeInTheDocument();
    });

    it('does not show generation status badge when no prior generation', async () => {
      renderSection();
      await screen.findByTestId('generate-candidates-button');
      expect(screen.queryByTestId('generation-status')).not.toBeInTheDocument();
    });

    it('renders candidates list when candidates returned', async () => {
      const candidate = makeCandidate();
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [candidate],
          generationStatus: 'done',
        })),
      });

      expect(await screen.findByTestId('candidates-list')).toBeInTheDocument();
      expect(await screen.findByTestId('candidate-item')).toBeInTheDocument();
      expect(screen.getByText('Great moment')).toBeInTheDocument();
      expect(screen.getByText('High energy section')).toBeInTheDocument();
    });

    it('shows generation status badge when status=done', async () => {
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          generationStatus: 'done',
        })),
      });

      await screen.findByTestId('generation-status');
      expect(screen.getByTestId('generation-status')).toHaveTextContent('Ready');
    });

    it('shows generation status badge when status=generating', async () => {
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          generationStatus: 'generating',
        })),
      });

      await screen.findByTestId('generation-status');
      expect(screen.getByTestId('generation-status')).toHaveTextContent('Generating');
    });

    it('disables generate button and shows cancel when generating', async () => {
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          generationStatus: 'generating',
        })),
      });

      // cancel button appears only once isGenerating=true, so wait for it first
      expect(await screen.findByTestId('cancel-generation-button')).toBeInTheDocument();
      expect(screen.getByTestId('generate-candidates-button')).toBeDisabled();
    });

    it('shows generation error when status=failed', async () => {
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          generationStatus: 'failed',
          generationError: 'AI_INTERNAL_ERROR',
        })),
      });

      await screen.findByTestId('generation-error');
      expect(screen.getByTestId('generation-error')).toHaveTextContent('AI_INTERNAL_ERROR');
    });

    it('shows empty state message when done with 0 candidates', async () => {
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          generationStatus: 'done',
          candidates: [],
        })),
      });

      await screen.findByTestId('generation-status');
      expect(screen.getByText(/no candidates returned/i)).toBeInTheDocument();
    });
  });

  describe('approve/reject interactions', () => {
    it('approve button calls updateCandidateStatus with approved', async () => {
      const user = userEvent.setup();
      const updateCandidateStatus = vi.fn().mockResolvedValue({ ok: true });
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [makeCandidate()],
          generationStatus: 'done',
        })),
        updateCandidateStatus,
      });

      await user.click(await screen.findByTestId('approve-candidate-button'));
      await waitFor(() => expect(updateCandidateStatus).toHaveBeenCalledOnce());
      expect(updateCandidateStatus).toHaveBeenCalledWith(CANDIDATE_ID, 'approved');
    });

    it('reject button calls updateCandidateStatus with rejected', async () => {
      const user = userEvent.setup();
      const updateCandidateStatus = vi.fn().mockResolvedValue({ ok: true });
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [makeCandidate()],
          generationStatus: 'done',
        })),
        updateCandidateStatus,
      });

      await user.click(await screen.findByTestId('reject-candidate-button'));
      await waitFor(() => expect(updateCandidateStatus).toHaveBeenCalledOnce());
      expect(updateCandidateStatus).toHaveBeenCalledWith(CANDIDATE_ID, 'rejected');
    });

    it('approved candidate shows no approve button, still shows reject', async () => {
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [makeCandidate({ candidateStatus: 'approved' })],
          generationStatus: 'done',
        })),
      });

      await screen.findByTestId('candidate-item');
      expect(screen.queryByTestId('approve-candidate-button')).not.toBeInTheDocument();
      expect(screen.getByTestId('reject-candidate-button')).toBeInTheDocument();
    });

    it('rejected candidate shows no approve or reject buttons', async () => {
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [makeCandidate({ candidateStatus: 'rejected' })],
          generationStatus: 'done',
        })),
      });

      await screen.findByTestId('candidate-item');
      expect(screen.queryByTestId('approve-candidate-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reject-candidate-button')).not.toBeInTheDocument();
    });
  });

  describe('generate + cancel interactions', () => {
    it('generate button calls generateCandidates', async () => {
      const user = userEvent.setup();
      const generateCandidates = vi.fn().mockResolvedValue({
        ok: true,
        candidateCount: 1,
        generationId: GEN_ID,
      });
      renderSection(makeProject(), { generateCandidates });

      await user.click(await screen.findByTestId('generate-candidates-button'));
      await waitFor(() => expect(generateCandidates).toHaveBeenCalledOnce());
      expect(generateCandidates).toHaveBeenCalledWith(TEST_ID);
    });

    it('cancel button calls cancelGeneration', async () => {
      const user = userEvent.setup();
      const cancelGeneration = vi.fn().mockResolvedValue({ cancelled: true });
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          generationStatus: 'generating',
        })),
        cancelGeneration,
      });

      await user.click(await screen.findByTestId('cancel-generation-button'));
      await waitFor(() => expect(cancelGeneration).toHaveBeenCalledOnce());
      expect(cancelGeneration).toHaveBeenCalledWith(TEST_ID);
    });
  });

  describe('skip interaction (M8)', () => {
    it('skip button calls updateCandidateStatus with skipped', async () => {
      const user = userEvent.setup();
      const updateCandidateStatus = vi.fn().mockResolvedValue({ ok: true });
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [makeCandidate()],
          generationStatus: 'done',
        })),
        updateCandidateStatus,
      });

      await user.click(await screen.findByTestId('skip-candidate-button'));
      await waitFor(() => expect(updateCandidateStatus).toHaveBeenCalledOnce());
      expect(updateCandidateStatus).toHaveBeenCalledWith(CANDIDATE_ID, 'skipped');
    });

    it('skipped candidate shows no skip button', async () => {
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [makeCandidate({ candidateStatus: 'skipped' })],
          generationStatus: 'done',
        })),
      });

      await screen.findByTestId('candidate-item');
      expect(screen.queryByTestId('skip-candidate-button')).not.toBeInTheDocument();
    });
  });

  describe('review summary (M8)', () => {
    it('shows review summary when candidates exist', async () => {
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [
            makeCandidate({ candidateStatus: 'suggested' }),
            makeCandidate({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab', candidateStatus: 'approved' }),
          ],
          generationStatus: 'done',
        })),
      });

      const summary = await screen.findByTestId('review-summary');
      expect(summary).toBeInTheDocument();
      expect(summary).toHaveTextContent('Suggested: 1');
      expect(summary).toHaveTextContent('Approved: 1');
    });

    it('does not show review summary when no candidates', async () => {
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [],
          generationStatus: 'done',
        })),
      });

      await screen.findByTestId('generation-status');
      expect(screen.queryByTestId('review-summary')).not.toBeInTheDocument();
    });
  });

  describe('score filter (M8)', () => {
    it('shows score threshold input when candidates exist', async () => {
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [makeCandidate()],
          generationStatus: 'done',
        })),
      });

      expect(await screen.findByTestId('score-threshold-input')).toBeInTheDocument();
    });

    it('hides candidates below score threshold', async () => {
      const user = userEvent.setup();
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [
            makeCandidate({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', scoreRaw: 0.9 }),
            makeCandidate({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab', scoreRaw: 0.3 }),
          ],
          generationStatus: 'done',
        })),
      });

      const thresholdInput = await screen.findByTestId('score-threshold-input');
      await user.clear(thresholdInput);
      await user.type(thresholdInput, '0.5');

      await waitFor(() => expect(screen.getAllByTestId('candidate-item')).toHaveLength(1));
    });
  });

  describe('batch actions (M8)', () => {
    it('approve-all button calls updateCandidateStatus for all suggested in view', async () => {
      const user = userEvent.setup();
      const updateCandidateStatus = vi.fn().mockResolvedValue({ ok: true });
      const C2_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab';
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [
            makeCandidate({ candidateStatus: 'suggested' }),
            makeCandidate({ id: C2_ID, candidateStatus: 'suggested' }),
          ],
          generationStatus: 'done',
        })),
        updateCandidateStatus,
      });

      await user.click(await screen.findByTestId('approve-all-button'));
      await waitFor(() => expect(updateCandidateStatus).toHaveBeenCalledTimes(2));
      expect(updateCandidateStatus).toHaveBeenCalledWith(CANDIDATE_ID, 'approved');
      expect(updateCandidateStatus).toHaveBeenCalledWith(C2_ID, 'approved');
    });

    it('reject-all button calls updateCandidateStatus for all suggested in view', async () => {
      const user = userEvent.setup();
      const updateCandidateStatus = vi.fn().mockResolvedValue({ ok: true });
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [makeCandidate({ candidateStatus: 'suggested' })],
          generationStatus: 'done',
        })),
        updateCandidateStatus,
      });

      await user.click(await screen.findByTestId('reject-all-button'));
      await waitFor(() => expect(updateCandidateStatus).toHaveBeenCalledOnce());
      expect(updateCandidateStatus).toHaveBeenCalledWith(CANDIDATE_ID, 'rejected');
    });

    it('batch buttons absent when no suggested candidates', async () => {
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [makeCandidate({ candidateStatus: 'approved' })],
          generationStatus: 'done',
        })),
      });

      await screen.findByTestId('candidate-item');
      expect(screen.queryByTestId('approve-all-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reject-all-button')).not.toBeInTheDocument();
    });
  });

  describe('notes (M8)', () => {
    it('renders notes textarea for each candidate', async () => {
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [makeCandidate()],
          generationStatus: 'done',
        })),
      });

      expect(await screen.findByTestId('candidate-notes-input')).toBeInTheDocument();
    });

    it('calls updateCandidateNotes on blur with current value', async () => {
      const user = userEvent.setup();
      const updateCandidateNotes = vi.fn().mockResolvedValue({ ok: true });
      renderSection(makeProject(), {
        listCandidates: vi.fn().mockResolvedValue(makeListOutput({
          candidates: [makeCandidate()],
          generationStatus: 'done',
        })),
        updateCandidateNotes,
      });

      const notesInput = await screen.findByTestId('candidate-notes-input');
      await user.click(notesInput);
      await user.type(notesInput, 'Great clip for intro');
      await user.tab();
      await waitFor(() => expect(updateCandidateNotes).toHaveBeenCalledOnce());
      expect(updateCandidateNotes).toHaveBeenCalledWith(CANDIDATE_ID, 'Great clip for intro');
    });
  });
});
