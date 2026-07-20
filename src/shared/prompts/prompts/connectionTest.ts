import { z } from 'zod';
import type { PromptDefinition } from '../types';

const connectionTestOutputSchema = z.object({ ok: z.boolean() });

export const connectionTestPrompt: PromptDefinition<Record<never, never>, { ok: boolean }> = {
  promptId: 'connectionTest',
  version: 1,
  purpose: 'Minimal probe to verify provider authentication and model availability.',
  systemInstructions: 'Reply only with valid JSON.',
  buildUserContent: () => 'Reply with the JSON object: {"ok": true}',
  outputJsonSchema: {
    type: 'object',
    properties: { ok: { type: 'boolean' } },
    required: ['ok'],
    additionalProperties: false,
  },
  outputValidator: (raw) => connectionTestOutputSchema.parse(raw),
  maxInputChars: 0,
  skipResponseFormat: true,
  maxOutputTokens: 20,
  maxDurationMs: 10_000,
  compatibleTasks: ['connectionTest'],
};
