# M6 — Prompt Architecture

Date: 2026-07-20  
Status: Planning

---

## Governing constraints

- Renderer must not create, modify, or inspect prompt text.
- Prompt content (system instructions + user content templates) must not contain transcript text.
- Prompt definitions must be versioned and immutable.
- All prompt changes require code review (they are TypeScript source, not data).
- Prompt identity (ID + version) is persisted in request records. Prompt text is not persisted.

---

## Prompt definition type

```typescript
// src/shared/prompts/types.ts

export type PromptDefinition<TInput extends Record<string, string | number>, TOutput> = {
  /** Stable identifier. Never reused across prompt purposes. */
  promptId: string;
  /** Incremented on any change to system instructions, user template, or output schema. */
  version: number;
  /** Human-readable description — shown in audit logs, never in UI or AI calls. */
  purpose: string;
  /** System-level instructions sent as role:system message. */
  systemInstructions: string;
  /** Template function: receives input, returns user message content string. */
  buildUserContent: (input: TInput) => string;
  /** JSON Schema for the expected output structure (passed as response_format). */
  outputJsonSchema: object;
  /** Zod validator for the output. Used after JSON parse. */
  outputValidator: (raw: unknown) => TOutput;
  /** Maximum input characters. buildUserContent output checked before request. */
  maxInputChars: number;
  /** Maximum output tokens requested from provider. */
  maxOutputTokens: number;
  /** Maximum duration for this prompt's request type. */
  maxDurationMs: number;
  /** Compatible task types — guards against accidental cross-task use. */
  compatibleTasks: readonly string[];
  /**
   * When true, AiHttpClient does NOT include `response_format` in the request body.
   * Use for minimal probes where the provider may not support json_schema response_format
   * (e.g. connectionTest). Output is still Zod-validated; JSON extraction uses fallback logic.
   * Default: false (most prompts use response_format for structured output).
   */
  skipResponseFormat?: boolean;
};
```

---

## Prompt registry

```typescript
// src/shared/prompts/registry.ts

import { connectionTestPrompt } from './prompts/connectionTest';

// M7 adds: clipCandidatesPrompt
// M10 adds: subtitleEditSuggestionPrompt (if AI-assisted)

export const PROMPT_REGISTRY = {
  CONNECTION_TEST: connectionTestPrompt,
} as const;

export type PromptId = keyof typeof PROMPT_REGISTRY;

export const getPrompt = (id: PromptId) => PROMPT_REGISTRY[id];
```

The registry is a plain TypeScript object. No runtime lookup, no dynamic loading.

---

## Versioning rules

1. `promptId` is a stable camelCase identifier assigned at creation. It is never reused.
2. `version` starts at 1 and increments on any change to: `systemInstructions`, `buildUserContent` template, `outputJsonSchema`, `maxInputChars`, `maxOutputTokens`.
3. Old versions are not retained in the codebase. Version history lives in git.
4. When a prompt is deprecated (replaced by a newer prompt), the old `promptId` is commented out with the git commit SHA where it was last used.
5. Persisted request records store `promptId + version`. If a request record references a deprecated prompt version, it remains readable but cannot be re-run.

---

## Where prompt definitions live

```
src/shared/prompts/
  types.ts            — PromptDefinition type
  registry.ts         — PROMPT_REGISTRY
  prompts/
    connectionTest.ts — connection test probe prompt (M6)
    clipCandidates.ts — M7 placeholder (added in M7, not M6)
```

Prompts are in `src/shared/` because:
- Prompt IDs and version numbers may be referenced by both main-process logging and renderer audit display.
- The `buildUserContent` function and `systemInstructions` string are text — no privileged access.
- The Zod `outputValidator` is shared between main-process execution and renderer display of structured results.

**Important**: The `buildUserContent` function receives only validated, bounded input. It never receives raw file paths, raw renderer state, or arbitrary user text. Input is always pre-processed (e.g., transcript already bounded by M6 limits) before being passed to `buildUserContent`.

---

## Connection test prompt (M6)

```typescript
// src/shared/prompts/prompts/connectionTest.ts

export const connectionTestPrompt: PromptDefinition<Record<never, never>, { ok: boolean }> = {
  promptId: 'connectionTest',
  version: 1,
  purpose: 'Minimal probe to verify provider authentication and model availability.',
  systemInstructions: 'Reply only with valid JSON.',
  buildUserContent: (_input) => 'Reply with the JSON object: {"ok": true}',
  outputJsonSchema: {
    type: 'object',
    properties: { ok: { type: 'boolean' } },
    required: ['ok'],
    additionalProperties: false,
  },
  outputValidator: (raw) => connectionTestOutputSchema.parse(raw),
  maxInputChars: 0,   // 0 = no variable user content; buildUserContent ignores input
  skipResponseFormat: true,  // connection test does not use response_format
  maxOutputTokens: 20,
  maxDurationMs: 10_000,
  compatibleTasks: ['connectionTest'],
};
```

Connection test has `skipResponseFormat: true` — some providers do not support `response_format` on minimal probes. The `AiHttpClient` omits `response_format` from the request body when this flag is set. Output still goes through the full structured-output validation pipeline (JSON extraction → Zod validation), accepting any valid JSON body containing `{ ok: true }`.

`maxInputChars: 0` means `buildUserContent` produces a static string — no variable content from the caller. `AiService` skips the input character count check when `maxInputChars === 0`.

---

## Prompt injection containment

Transcript text passed to `buildUserContent` in M7+ is user-derived content. It is treated as untrusted:

1. Transcript text is inserted into the user message only, never the system message.
2. System instructions are static strings in source code — not templated from user input.
3. The prompt does not instruct the model to execute any code or make any external calls.
4. SceneSift does not implement its own sandboxing for prompt injection — the model response is validated against a strict Zod schema. If the model is manipulated into returning off-schema content, it fails schema validation and returns `AI_SCHEMA_VALIDATION_FAILED`.
5. Transcript content does not appear in logs. Prompt injection attempts via subtitle text cannot be observed by examining logs.

This is defense-in-depth for a milestone that does not yet send transcript text. M7 implementation plan must re-evaluate injection risk when transcript content is first introduced.

---

## No renderer-controlled prompts

- No IPC channel accepts a system prompt string from the renderer.
- No IPC channel accepts a user content string from the renderer for AI execution.
- The renderer triggers named operations (`clipCandidates.generateForProject(projectId)`). The main-process handler looks up the prompt, builds the content from project data, and executes.
- Prompt text is implementation detail of the main process.
