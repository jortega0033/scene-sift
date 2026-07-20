import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AI_ERROR_MESSAGES } from '@shared/schemas/ai';
import type { AiConfigurationStatus } from '@shared/schemas/ai';

const PRIVACY_NOTICE_TEXT =
  'SceneSift AI features send text from your subtitle files to the AI provider you configure. ' +
  'No video or audio content is transmitted. Your subtitle text is processed only to generate ' +
  'clip candidate suggestions.\n\n' +
  'Data sent to your provider is governed by that provider\'s privacy policy. ' +
  'SceneSift does not store or log your subtitle content.';

const formSchema = z.object({
  baseUrl: z
    .string()
    .url({ message: 'Must be a valid URL' })
    .refine((url) => url.startsWith('https://'), { message: 'Endpoint must use HTTPS' }),
  model: z.string().min(1, 'Required').max(128, 'Max 128 characters'),
  apiKey: z
    .string()
    .min(1, 'Required')
    .max(512, 'Max 512 characters')
    .refine((s) => s.trim().length > 0, { message: 'Cannot be whitespace only' }),
});

type FormValues = z.infer<typeof formSchema>;

const STATUS_ERROR_MESSAGES: Partial<Record<AiConfigurationStatus, string>> = {
  unavailable: AI_ERROR_MESSAGES.AI_PROVIDER_UNAVAILABLE,
  invalid_configuration: AI_ERROR_MESSAGES.AI_INVALID_CONFIGURATION,
  rate_limited: AI_ERROR_MESSAGES.AI_RATE_LIMITED,
  offline: AI_ERROR_MESSAGES.AI_OFFLINE,
};

const ERROR_STATUSES = new Set<AiConfigurationStatus>([
  'unavailable',
  'invalid_configuration',
  'rate_limited',
  'offline',
]);

const isErrorStatus = (status: AiConfigurationStatus): boolean => ERROR_STATUSES.has(status);

const formatRelativeTime = (ms: number | null): string | null => {
  if (ms === null) return null;
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const INPUT_CLASS =
  'h-[var(--control-height)] w-full rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm';

const BTN_PRIMARY_CLASS =
  'h-[var(--control-height)] rounded-[var(--radius-sm)] border border-foreground bg-foreground px-3 text-sm font-medium text-background disabled:opacity-50';

const BTN_SECONDARY_CLASS =
  'h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-3 text-sm disabled:opacity-50';

export const AiProviderSection = () => {
  const queryClient = useQueryClient();
  const [isTesting, setIsTesting] = useState(false);
  const [showFullNotice, setShowFullNotice] = useState(false);
  const cancelledRef = useRef(false);

  const statusQuery = useQuery({
    queryKey: ['ai-configuration-status'],
    queryFn: () => window.sceneSift.ai.getConfigurationStatus(),
  });

  const status = statusQuery.data;
  const configStatus = status?.configurationStatus ?? 'unconfigured';
  const hasConsent = (status?.consentRecordedAt ?? null) !== null;
  const isError = !isTesting && isErrorStatus(configStatus);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4o-mini',
      apiKey: '',
    },
  });

  const setApiKeyMutation = useMutation({
    mutationFn: (input: FormValues) =>
      window.sceneSift.ai.setApiKey({
        apiKey: input.apiKey,
        baseUrl: input.baseUrl,
        model: input.model,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ai-configuration-status'] });
      reset({ baseUrl: 'https://api.openai.com', model: 'gpt-4o-mini', apiKey: '' });
    },
  });

  const testMutation = useMutation({
    mutationFn: () => window.sceneSift.ai.testConnection(),
    onSettled: async () => {
      if (!cancelledRef.current) {
        await queryClient.invalidateQueries({ queryKey: ['ai-configuration-status'] });
      }
      setIsTesting(false);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => window.sceneSift.ai.clearConfiguration(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ai-configuration-status'] });
    },
  });

  const consentMutation = useMutation({
    mutationFn: () => window.sceneSift.ai.recordConsent(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ai-configuration-status'] });
    },
  });

  const handleTest = () => {
    cancelledRef.current = false;
    setIsTesting(true);
    testMutation.mutate();
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    setIsTesting(false);
    void window.sceneSift.ai.cancelTest();
  };

  const handleClear = () => {
    if (!window.confirm('Clear AI configuration? This will remove your saved API key.')) return;
    clearMutation.mutate();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await setApiKeyMutation.mutateAsync(values);
    } catch {
      // Error surfaced via setApiKeyMutation.error
    }
  });

  return (
    <section
      data-testid="ai-provider-section"
      aria-label="AI Provider configuration"
      role="region"
      className="space-y-3 border-t border-border pt-4"
    >
      <h3 className="text-sm font-semibold uppercase tracking-label">AI Provider</h3>
      <p className="text-xs text-muted-foreground">
        Configure an AI provider to enable clip candidate generation.
      </p>

      {statusQuery.isLoading ? null : (
        <>
          {/* Unconfigured: show form */}
          {configStatus === 'unconfigured' && (
            <form data-testid="ai-provider-form" onSubmit={onSubmit} className="space-y-3">
              {/* Privacy notice */}
              {!hasConsent ? (
                <div
                  data-testid="ai-privacy-notice"
                  className="space-y-2 rounded-[var(--radius-sm)] border border-border bg-background p-3 text-xs"
                >
                  <p className="font-medium">Privacy notice</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{PRIVACY_NOTICE_TEXT}</p>
                  <button
                    data-testid="ai-consent-button"
                    type="button"
                    className={BTN_PRIMARY_CLASS + ' text-xs'}
                    onClick={() => consentMutation.mutate()}
                    disabled={consentMutation.isPending}
                  >
                    I understand — enable AI features
                  </button>
                </div>
              ) : (
                <p data-testid="ai-notice-summary" className="text-xs text-muted-foreground">
                  AI features send text from your subtitles to the configured provider.{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setShowFullNotice((v) => !v)}
                  >
                    {showFullNotice ? 'Hide notice' : 'View notice'}
                  </button>
                  {showFullNotice && (
                    <span className="mt-1 block whitespace-pre-wrap">{PRIVACY_NOTICE_TEXT}</span>
                  )}
                </p>
              )}

              {/* Provider (cosmetic — single option in M6) */}
              <label htmlFor="ai-provider-input" className="block text-xs">
                <span className="mb-1 block uppercase tracking-label text-muted-foreground">
                  Provider
                </span>
                <select
                  id="ai-provider-input"
                  data-testid="ai-provider-input"
                  defaultValue="openai_compatible"
                  className={INPUT_CLASS}
                >
                  <option value="openai_compatible">OpenAI (compatible)</option>
                </select>
              </label>

              {/* Endpoint */}
              <label htmlFor="ai-endpoint-input" className="block text-xs">
                <span className="mb-1 block uppercase tracking-label text-muted-foreground">
                  Endpoint
                </span>
                <input
                  {...register('baseUrl')}
                  id="ai-endpoint-input"
                  data-testid="ai-endpoint-input"
                  type="url"
                  autoComplete="off"
                  className={INPUT_CLASS}
                />
                {errors.baseUrl && (
                  <span role="alert" className="text-xs text-foreground">
                    {errors.baseUrl.message}
                  </span>
                )}
              </label>

              {/* Model */}
              <label htmlFor="ai-model-input" className="block text-xs">
                <span className="mb-1 block uppercase tracking-label text-muted-foreground">
                  Model
                </span>
                <input
                  {...register('model')}
                  id="ai-model-input"
                  data-testid="ai-model-input"
                  type="text"
                  autoComplete="off"
                  className={INPUT_CLASS}
                />
                {errors.model && (
                  <span role="alert" className="text-xs text-foreground">
                    {errors.model.message}
                  </span>
                )}
              </label>

              {/* API key */}
              <label htmlFor="ai-apikey-input" className="block text-xs">
                <span className="mb-1 block uppercase tracking-label text-muted-foreground">
                  API key
                </span>
                <input
                  {...register('apiKey')}
                  id="ai-apikey-input"
                  data-testid="ai-apikey-input"
                  type="password"
                  autoComplete="new-password"
                  className={INPUT_CLASS}
                />
                {errors.apiKey && (
                  <span role="alert" className="text-xs text-foreground">
                    {errors.apiKey.message}
                  </span>
                )}
              </label>

              <button
                data-testid="ai-save-button"
                type="submit"
                disabled={!hasConsent || isSubmitting || setApiKeyMutation.isPending}
                className={BTN_PRIMARY_CLASS}
              >
                Save configuration
              </button>

              {setApiKeyMutation.error && (
                <p role="alert" className="text-xs text-foreground">
                  {setApiKeyMutation.error instanceof Error
                    ? setApiKeyMutation.error.message
                    : 'Unable to save configuration.'}
                </p>
              )}
            </form>
          )}

          {/* Configured state (not testing) */}
          {configStatus !== 'unconfigured' && !isTesting && (
            <div className="space-y-3">
              <div aria-live="polite" className="space-y-2">
                {/* Status badge */}
                {configStatus === 'available' ? (
                  <span
                    data-testid="ai-status-available"
                    className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400"
                  >
                    <span aria-hidden="true">✓</span> Connected
                  </span>
                ) : isError ? (
                  <span
                    data-testid="ai-status-error"
                    className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400"
                  >
                    <span aria-hidden="true">✗</span> Connection failed
                  </span>
                ) : (
                  <span data-testid="ai-status-text" className="text-sm text-muted-foreground">
                    Not tested
                  </span>
                )}

                {/* Config metadata */}
                <dl
                  data-testid="ai-status-indicator"
                  className="space-y-1 text-xs text-muted-foreground"
                >
                  <div className="flex gap-1">
                    <dt className="uppercase tracking-label">Provider</dt>
                    <dd>OpenAI (compatible)</dd>
                  </div>
                  {status?.maskedEndpoint && (
                    <div className="flex gap-1">
                      <dt className="uppercase tracking-label">Endpoint</dt>
                      <dd>{status.maskedEndpoint}…</dd>
                    </div>
                  )}
                  {status?.model && (
                    <div className="flex gap-1">
                      <dt className="uppercase tracking-label">Model</dt>
                      <dd>{status.model}</dd>
                    </div>
                  )}
                  {configStatus === 'available' && status?.lastTestedAt && (
                    <div>Last tested: {formatRelativeTime(status.lastTestedAt)}</div>
                  )}
                </dl>

                {/* Error message */}
                {isError && (
                  <p
                    data-testid="ai-error-message"
                    role="alert"
                    className="text-xs text-red-600 dark:text-red-400"
                  >
                    {STATUS_ERROR_MESSAGES[configStatus] ?? 'Connection failed.'}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {isError ? (
                  <button
                    data-testid="ai-retry-button"
                    type="button"
                    onClick={handleTest}
                    disabled={clearMutation.isPending}
                    className={BTN_SECONDARY_CLASS}
                  >
                    Retry
                  </button>
                ) : (
                  <button
                    data-testid="ai-test-button"
                    type="button"
                    onClick={handleTest}
                    disabled={clearMutation.isPending}
                    className={BTN_SECONDARY_CLASS}
                  >
                    {configStatus === 'available' ? 'Test again' : 'Test connection'}
                  </button>
                )}
                <button
                  data-testid="ai-clear-button"
                  type="button"
                  onClick={handleClear}
                  disabled={clearMutation.isPending}
                  className={BTN_SECONDARY_CLASS}
                >
                  Clear configuration
                </button>
              </div>

              {clearMutation.error && (
                <p role="alert" className="text-xs text-foreground">
                  {clearMutation.error instanceof Error
                    ? clearMutation.error.message
                    : 'Unable to clear configuration.'}
                </p>
              )}
            </div>
          )}

          {/* Testing state */}
          {isTesting && (
            <div data-testid="ai-status-testing" aria-live="polite" className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span
                  aria-label="Testing connection"
                  role="status"
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground"
                />
                Testing connection…
              </div>
              <button
                data-testid="ai-cancel-button"
                type="button"
                onClick={handleCancel}
                className={BTN_SECONDARY_CLASS}
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};
