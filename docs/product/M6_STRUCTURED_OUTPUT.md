# M6 — Structured Output Validation

Date: 2026-07-20  
Status: Planning

---

## Governing constraint

All AI provider responses are treated as untrusted. A response that passes HTTP 200 is not trusted until it passes the full validation pipeline below. An AI that returns plausible-looking but semantically wrong data must be caught and rejected.

---

## Validation pipeline

```
AiHttpClient.post() returns AiResponseRaw { content: string, finishReason: string | null }
  │
  ▼
1. finish_reason check (before any content parsing)
   — 'length' → AI_RESPONSE_TOO_LARGE (non-retryable; content was truncated by max_tokens)
   — 'content_filter' → AI_SCHEMA_VALIDATION_FAILED (non-retryable; retrying will be filtered again)
   — 'stop' or null → proceed
  │
  ▼
2. Response content length check
   — AiHttpClient already enforced MAX_RESPONSE_BYTES=512_000 during streaming
   — If content.length > MAX_CONTENT_CHARS (128,000), throw AI_RESPONSE_TOO_LARGE
  │
  ▼
3. JSON extraction
   — Primary: attempt JSON.parse(content) directly
   — Fallback: iterate all markdown code fences (```json...``` or ```...```), try JSON.parse on each
   — Longest successfully-parsed candidate wins if multiple fences parse
   — If all attempts fail: throw AI_INVALID_RESPONSE
  │
  ▼
4. Unknown-key policy
   — All schemas use Zod .strip() — unexpected keys are removed silently
   — This differs from additionalProperties:false in the JSON Schema sent to the provider:
     the provider-side constraint is a hint/enforcement for the model;
     Zod-side .strip() provides defence-in-depth without causing failures on provider metadata
  │
  ▼
5. Zod schema validation
   — caller-provided schemaValidator(parsed) — uses Zod .parse()
   — ZodError caught: throw AI_SCHEMA_VALIDATION_FAILED
   — Validates: types, required fields, string lengths, array lengths, numeric ranges
  │
  ▼
6. Semantic validation
   — Called on the typed result after Zod
   — For M7+ clip candidates: validate timestamps within [0, videoDuration], start < end, text non-empty
   — For M6 connection test: validate ok === true (uses z.literal(true) in schema, so failures hit step 5)
   — Semantic failures: throw AI_SCHEMA_VALIDATION_FAILED (same code, different message)
  │
  ▼
7. Return typed StructuredResult<T>
```

Note: pipeline is now 7 steps (added finish_reason as step 1). Interface and test counts updated accordingly.

---

## JSON extraction policy

**Primary**: `JSON.parse(content)` — used when provider supports `response_format: { type: "json_schema" }` or `{ type: "json_object" }`.

**Fallback**: Extract from markdown code fence when primary fails. Pattern:
```typescript
const match = /```(?:json)?\s*\n?([\s\S]+?)\n?```/.exec(content);
if (match) parsed = JSON.parse(match[1]);
```

**Prohibited**: Accepting arbitrary prose as structured output. If neither primary nor fallback JSON extraction succeeds, the response fails.

---

## Schema constraints for all M6+ prompts

Every prompt's `outputJsonSchema` must specify:

```json
{
  "type": "object",
  "properties": { ... },
  "required": [ /* all required fields */ ],
  "additionalProperties": false,
  "maxProperties": 50
}
```

Array fields must specify:
```json
{
  "type": "array",
  "maxItems": 50,
  "items": { ... }
}
```

String fields must specify:
```json
{
  "type": "string",
  "maxLength": 2000
}
```

These are part of the JSON Schema sent to the provider as `response_format`, not just Zod rules. Dual enforcement.

---

## Retry on invalid output

- `AI_SCHEMA_VALIDATION_FAILED` is **non-retryable** by default.
- Rationale: schema failures usually indicate prompt/model mismatch, not transient error. Retrying identical request will likely fail again and wastes quota.
- Exception: if the failure is `AI_INVALID_RESPONSE` (JSON parse error), one retry is allowed (may be transient rendering issue).
- No "repair prompt" in M6. M7 may add a repair-prompt path if structured output reliability is poor.

---

## Repair prompt policy (deferred to M7)

Repair prompts (sending the invalid output back with instructions to fix it) are deferred. Reasons:
- Complexity: retry loop with repair prompt requires additional quota.
- Risk: repair prompt may include model output as part of the new prompt, creating injection vector.
- M6 does not need repair — connection test schema is trivial.

If M7 determines repair prompts are necessary:
- Separate `repairPrompt` field in `PromptDefinition`.
- Maximum 1 repair attempt.
- Repair prompt does not include any user content from the original request.
- Repair prompt failure is non-retryable.

---

## Timestamp semantic validation (M7+, documented here)

When M7 clip candidate results include timestamps:

```typescript
const validateTimestamps = (
  candidates: ClipCandidate[],
  videoDurationMs: number,
): void => {
  for (const c of candidates) {
    if (c.startMs < 0) throw new AppError('AI_SCHEMA_VALIDATION_FAILED', 'startMs < 0');
    if (c.endMs > videoDurationMs) throw new AppError('AI_SCHEMA_VALIDATION_FAILED', 'endMs > duration');
    if (c.startMs >= c.endMs) throw new AppError('AI_SCHEMA_VALIDATION_FAILED', 'startMs >= endMs');
    if ((c.endMs - c.startMs) < MIN_CLIP_DURATION_MS) throw new AppError('AI_SCHEMA_VALIDATION_FAILED', 'clip too short');
  }
};
```

This is semantic validation step 5. Not M6, but the infrastructure for it is established in M6's `AiService.executeStructuredRequest`.

---

## M6 infrastructure for testing (synthetic schema)

M6 establishes a minimal synthetic prompt for infrastructure testing:

```typescript
// src/shared/prompts/prompts/connectionTest.ts
// Used in tests/main/aiService.test.ts to verify the full pipeline
```

Test coverage matrix:

| Scenario | Expected result |
|---|---|
| Valid response, JSON direct | Zod parse succeeds → typed result |
| Valid response, wrapped in markdown fence | Extracted, parse succeeds |
| HTTP 200, invalid JSON | `AI_INVALID_RESPONSE` |
| HTTP 200, valid JSON, wrong schema | `AI_SCHEMA_VALIDATION_FAILED` |
| HTTP 200, valid JSON, passes Zod, fails semantic | `AI_SCHEMA_VALIDATION_FAILED` |
| HTTP 200, valid JSON, `ok: false` | `AI_SCHEMA_VALIDATION_FAILED` |
| Response exceeds `MAX_CONTENT_CHARS` | `AI_RESPONSE_TOO_LARGE` |
| Array exceeds `maxItems` (if applicable) | `AI_SCHEMA_VALIDATION_FAILED` |
| Unknown keys | Stripped, succeeds |
