import { z } from 'zod';

export const AI_ERROR_CODES = [
  'AI_NOT_CONFIGURED',
  'AI_CONSENT_REQUIRED',
  'AI_INVALID_CONFIGURATION',
  'AI_ENDPOINT_NOT_ALLOWED',
  'AI_AUTHENTICATION_FAILED',
  'AI_FORBIDDEN',
  'AI_RATE_LIMITED',
  'AI_PROVIDER_UNAVAILABLE',
  'AI_NETWORK_ERROR',
  'AI_TIMEOUT',
  'AI_REQUEST_CANCELLED',
  'AI_REQUEST_TOO_LARGE',
  'AI_RESPONSE_TOO_LARGE',
  'AI_INVALID_RESPONSE',
  'AI_SCHEMA_VALIDATION_FAILED',
  'AI_OFFLINE',
  'AI_ENCRYPTION_UNAVAILABLE',
  'AI_REDIRECT_NOT_ALLOWED',
  'AI_INTERNAL_ERROR',
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  AI_NOT_CONFIGURED: 'API key required.',
  AI_CONSENT_REQUIRED: 'Accept the AI privacy notice before using AI features.',
  AI_INVALID_CONFIGURATION: 'Configuration incomplete.',
  AI_ENDPOINT_NOT_ALLOWED: 'Endpoint not allowed.',
  AI_AUTHENTICATION_FAILED: 'Authentication failed.',
  AI_FORBIDDEN: 'Access denied.',
  AI_RATE_LIMITED: 'Rate limited.',
  AI_PROVIDER_UNAVAILABLE: 'Provider unavailable.',
  AI_NETWORK_ERROR: 'Network error.',
  AI_TIMEOUT: 'Request timed out.',
  AI_REQUEST_CANCELLED: 'Request cancelled.',
  AI_REQUEST_TOO_LARGE: 'Request too large.',
  AI_RESPONSE_TOO_LARGE: 'Response too large.',
  AI_INVALID_RESPONSE: 'Invalid response from provider.',
  AI_SCHEMA_VALIDATION_FAILED: 'AI response did not match expected format.',
  AI_OFFLINE: 'No network connection.',
  AI_ENCRYPTION_UNAVAILABLE: 'Secure storage unavailable.',
  AI_REDIRECT_NOT_ALLOWED: 'Endpoint not allowed.',
  AI_INTERNAL_ERROR: 'An unexpected error occurred.',
};

export const aiConfigurationStatusSchema = z.enum([
  'unconfigured',
  'configured_untested',
  'testing',
  'available',
  'unavailable',
  'invalid_configuration',
  'rate_limited',
  'offline',
]);

export type AiConfigurationStatus = z.infer<typeof aiConfigurationStatusSchema>;

export const aiConfigurationStatusResponseSchema = z.object({
  configurationStatus: aiConfigurationStatusSchema,
  maskedEndpoint: z.string().nullable(),
  model: z.string().nullable(),
  providerType: z.literal('openai_compatible').nullable(),
  lastTestedAt: z.number().int().nullable(),
  lastTestError: z.string().nullable(),
  consentRecordedAt: z.number().int().nullable(),
});

export type AiConfigurationStatusResponse = z.infer<typeof aiConfigurationStatusResponseSchema>;

export const aiSetApiKeyInputSchema = z.object({
  apiKey: z.string().min(1).max(512),
  baseUrl: z.string().max(2048).optional(),
  model: z.string().min(1).max(128).optional(),
});

export const aiSetApiKeyOutputSchema = z.object({ ok: z.literal(true) });

export const aiTestConnectionOutputSchema = z.object({ ok: z.literal(true) });

export const aiClearConfigurationOutputSchema = z.object({ cleared: z.literal(true) });

export const aiRecordConsentOutputSchema = z.object({ ok: z.literal(true) });

export const aiCancelTestOutputSchema = z.object({ cancelled: z.literal(true) });

export type AiSetApiKeyInput = z.infer<typeof aiSetApiKeyInputSchema>;
