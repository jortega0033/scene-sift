import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AiProviderSection } from '@renderer/features/settings/AiProviderSection';
import type { AiConfigurationStatusResponse } from '@shared/schemas/ai';

const makeStatus = (
  overrides: Partial<AiConfigurationStatusResponse> = {},
): AiConfigurationStatusResponse => ({
  configurationStatus: 'unconfigured',
  maskedEndpoint: null,
  model: 'gpt-4o-mini',
  providerType: 'openai_compatible',
  lastTestedAt: null,
  lastTestError: null,
  consentRecordedAt: null,
  ...overrides,
});

const makeAiApi = (
  status: AiConfigurationStatusResponse,
  overrides: Partial<{
    getConfigurationStatus: () => Promise<AiConfigurationStatusResponse>;
    setApiKey: (input: object) => Promise<{ ok: true }>;
    testConnection: () => Promise<{ ok: true }>;
    cancelTest: () => Promise<{ cancelled: true }>;
    clearConfiguration: () => Promise<{ cleared: true }>;
    recordConsent: () => Promise<{ ok: true }>;
  }> = {},
) => ({
  getConfigurationStatus: async () => status,
  setApiKey: async () => ({ ok: true as const }),
  testConnection: async () => ({ ok: true as const }),
  cancelTest: async () => ({ cancelled: true as const }),
  clearConfiguration: async () => ({ cleared: true as const }),
  recordConsent: async () => ({ ok: true as const }),
  ...overrides,
});

const renderSection = (
  status: AiConfigurationStatusResponse = makeStatus(),
  apiOverrides: Parameters<typeof makeAiApi>[1] = {},
) => {
  // Cast suppressed — test files are not included in tsconfig.app.json type-check scope.
  (window as Record<string, unknown>).sceneSift = { ai: makeAiApi(status, apiOverrides) };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <AiProviderSection />
      </QueryClientProvider>,
    ),
    queryClient,
  };
};

describe('AiProviderSection', () => {
  it('renders section heading', async () => {
    renderSection();
    expect(screen.getByRole('region', { name: 'AI Provider configuration' })).toBeInTheDocument();
  });

  describe('unconfigured — no consent', () => {
    it('shows privacy notice and a disabled save button', async () => {
      renderSection(makeStatus({ consentRecordedAt: null }));
      await screen.findByTestId('ai-privacy-notice');
      const saveBtn = await screen.findByTestId('ai-save-button');
      expect(saveBtn).toBeDisabled();
    });

    it('consent button calls recordConsent', async () => {
      const user = userEvent.setup();
      const recordConsent = vi.fn().mockResolvedValue({ ok: true as const });
      renderSection(makeStatus({ consentRecordedAt: null }), { recordConsent });

      await user.click(await screen.findByTestId('ai-consent-button'));
      expect(recordConsent).toHaveBeenCalledOnce();
    });
  });

  describe('unconfigured — with consent', () => {
    it('shows notice summary and an enabled save button', async () => {
      renderSection(makeStatus({ consentRecordedAt: 1_000_000 }));
      await screen.findByTestId('ai-notice-summary');
      const saveBtn = await screen.findByTestId('ai-save-button');
      expect(saveBtn).not.toBeDisabled();
    });

    it('toggling "View notice" reveals and hides the full privacy notice text', async () => {
      const user = userEvent.setup();
      renderSection(makeStatus({ consentRecordedAt: 1_000_000 }));
      const toggle = await screen.findByRole('button', { name: 'View notice' });

      await user.click(toggle);
      expect(screen.getByText(/subtitle files/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Hide notice' }));
      expect(screen.queryByText(/subtitle files/)).not.toBeInTheDocument();
    });

    it('save calls setApiKey with form values and does not expose the key afterward', async () => {
      const user = userEvent.setup();
      const setApiKey = vi.fn().mockResolvedValue({ ok: true as const });

      // First call: unconfigured+consent; subsequent calls: configured_untested (post-save).
      let callCount = 0;
      const statusSequence = [
        makeStatus({ consentRecordedAt: 1_000_000 }),
        makeStatus({
          configurationStatus: 'configured_untested',
          maskedEndpoint: 'https://',
          consentRecordedAt: 1_000_000,
        }),
      ];
      const getConfigurationStatus = vi.fn(
        async () => statusSequence[Math.min(callCount++, statusSequence.length - 1)],
      );

      (window as Record<string, unknown>).sceneSift = {
        ai: {
          getConfigurationStatus,
          setApiKey,
          testConnection: async () => ({ ok: true as const }),
          cancelTest: async () => ({ cancelled: true as const }),
          clearConfiguration: async () => ({ cleared: true as const }),
          recordConsent: async () => ({ ok: true as const }),
        },
      };

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={queryClient}>
          <AiProviderSection />
        </QueryClientProvider>,
      );

      await screen.findByTestId('ai-apikey-input');
      await user.type(screen.getByTestId('ai-apikey-input'), 'sk-test-key');
      await user.click(screen.getByTestId('ai-save-button'));

      await waitFor(() => expect(setApiKey).toHaveBeenCalledOnce());
      expect(setApiKey).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'sk-test-key' }),
      );

      // After save + query invalidation, form unmounts — key no longer in DOM.
      await waitFor(() =>
        expect(screen.queryByTestId('ai-apikey-input')).not.toBeInTheDocument(),
      );
      expect(screen.queryByDisplayValue('sk-test-key')).not.toBeInTheDocument();
    });

    it('shows validation error for non-HTTPS endpoint', async () => {
      const user = userEvent.setup();
      renderSection(makeStatus({ consentRecordedAt: 1_000_000 }));

      const endpointInput = await screen.findByTestId('ai-endpoint-input');
      await user.clear(endpointInput);
      await user.type(endpointInput, 'http://insecure.example.com');
      await user.click(screen.getByTestId('ai-save-button'));

      await screen.findByText('Endpoint must use HTTPS');
    });

    it('shows validation error for empty API key', async () => {
      const user = userEvent.setup();
      renderSection(makeStatus({ consentRecordedAt: 1_000_000 }));

      await screen.findByTestId('ai-apikey-input');
      await user.click(screen.getByTestId('ai-save-button'));

      await screen.findByText('Required');
    });
  });

  describe('configured_untested', () => {
    it('shows "Not tested" status and Test/Clear buttons', async () => {
      renderSection(
        makeStatus({
          configurationStatus: 'configured_untested',
          maskedEndpoint: 'https://',
          consentRecordedAt: 1_000_000,
        }),
      );
      await screen.findByTestId('ai-status-text');
      expect(screen.queryByText('Not tested')).toBeInTheDocument();
      expect(screen.getByTestId('ai-test-button')).toBeInTheDocument();
      expect(screen.getByTestId('ai-clear-button')).toBeInTheDocument();
    });
  });

  describe('available', () => {
    it('shows "Connected" indicator and "Test again" button', async () => {
      renderSection(
        makeStatus({
          configurationStatus: 'available',
          maskedEndpoint: 'https://',
          model: 'gpt-4o-mini',
          lastTestedAt: Date.now(),
          consentRecordedAt: 1_000_000,
        }),
      );
      await screen.findByTestId('ai-status-available');
      expect(screen.getByTestId('ai-test-button')).toHaveTextContent('Test again');
      expect(screen.getByTestId('ai-clear-button')).toBeInTheDocument();
    });
  });

  describe('error states', () => {
    it('unavailable shows "Connection failed" indicator, error message, and Retry button', async () => {
      renderSection(
        makeStatus({
          configurationStatus: 'unavailable',
          maskedEndpoint: 'https://',
          consentRecordedAt: 1_000_000,
        }),
      );
      await screen.findByTestId('ai-status-error');
      const errMsg = screen.getByTestId('ai-error-message');
      expect(errMsg).toBeInTheDocument();
      expect(screen.getByTestId('ai-retry-button')).toBeInTheDocument();
      expect(screen.getByTestId('ai-clear-button')).toBeInTheDocument();
    });

    it('invalid_configuration shows error message', async () => {
      renderSection(
        makeStatus({
          configurationStatus: 'invalid_configuration',
          maskedEndpoint: 'https://',
          consentRecordedAt: 1_000_000,
        }),
      );
      await screen.findByTestId('ai-status-error');
      expect(screen.getByTestId('ai-error-message')).toBeInTheDocument();
    });

    it('rate_limited shows error message', async () => {
      renderSection(
        makeStatus({
          configurationStatus: 'rate_limited',
          maskedEndpoint: 'https://',
          consentRecordedAt: 1_000_000,
        }),
      );
      await screen.findByTestId('ai-status-error');
      expect(screen.getByTestId('ai-error-message')).toBeInTheDocument();
    });
  });

  describe('testing flow', () => {
    it('clicking Test shows testing spinner and Cancel button', async () => {
      const user = userEvent.setup();
      const testConnection = vi.fn(() => new Promise<{ ok: true }>(() => {})); // never resolves
      renderSection(
        makeStatus({
          configurationStatus: 'configured_untested',
          maskedEndpoint: 'https://',
          consentRecordedAt: 1_000_000,
        }),
        { testConnection },
      );

      await user.click(await screen.findByTestId('ai-test-button'));
      await screen.findByTestId('ai-status-testing');
      expect(screen.getByTestId('ai-cancel-button')).toBeInTheDocument();
    });

    it('Cancel during test hides the testing state immediately', async () => {
      const user = userEvent.setup();
      const testConnection = vi.fn(() => new Promise<{ ok: true }>(() => {})); // never resolves
      renderSection(
        makeStatus({
          configurationStatus: 'configured_untested',
          maskedEndpoint: 'https://',
          consentRecordedAt: 1_000_000,
        }),
        { testConnection },
      );

      await user.click(await screen.findByTestId('ai-test-button'));
      await screen.findByTestId('ai-status-testing');

      await user.click(screen.getByTestId('ai-cancel-button'));

      await waitFor(() =>
        expect(screen.queryByTestId('ai-status-testing')).not.toBeInTheDocument(),
      );
      expect(screen.getByTestId('ai-test-button')).toBeInTheDocument();
    });

    it('clear button shows native confirm and calls clearConfiguration on confirm', async () => {
      const user = userEvent.setup();
      const clearConfiguration = vi.fn().mockResolvedValue({ cleared: true as const });
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderSection(
        makeStatus({
          configurationStatus: 'configured_untested',
          maskedEndpoint: 'https://',
          consentRecordedAt: 1_000_000,
        }),
        { clearConfiguration },
      );

      await user.click(await screen.findByTestId('ai-clear-button'));

      expect(confirmSpy).toHaveBeenCalledOnce();
      await waitFor(() => expect(clearConfiguration).toHaveBeenCalledOnce());

      confirmSpy.mockRestore();
    });

    it('clear button does not clear when user cancels confirm', async () => {
      const user = userEvent.setup();
      const clearConfiguration = vi.fn().mockResolvedValue({ cleared: true as const });
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderSection(
        makeStatus({
          configurationStatus: 'configured_untested',
          maskedEndpoint: 'https://',
          consentRecordedAt: 1_000_000,
        }),
        { clearConfiguration },
      );

      await user.click(await screen.findByTestId('ai-clear-button'));

      expect(confirmSpy).toHaveBeenCalledOnce();
      expect(clearConfiguration).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });
});
