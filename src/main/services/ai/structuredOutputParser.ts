import { ZodError } from 'zod';
import { AppError } from '../../utils/errors';
import { AI_ERROR_MESSAGES } from '@shared/schemas/ai';
import type { AiResponseRaw } from './aiHttpClient';

export const MAX_CONTENT_CHARS = 128_000;

const CODE_FENCE_RE = /```(?:json)?\s*\n?([\s\S]+?)\n?```/g;

function extractJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // fall through to code-fence extraction
  }

  let best: { value: unknown; length: number } | null = null;
  const re = new RegExp(CODE_FENCE_RE.source, 'g');
  for (const m of content.matchAll(re)) {
    const body = m[1];
    if (!body) continue;
    try {
      const parsed = JSON.parse(body);
      if (best === null || body.length > best.length) {
        best = { value: parsed, length: body.length };
      }
    } catch {
      // skip unparseable fence
    }
  }

  if (best !== null) return best.value;

  throw new AppError('AI_INVALID_RESPONSE', AI_ERROR_MESSAGES.AI_INVALID_RESPONSE);
}

export function parseStructuredOutput<T>(
  raw: AiResponseRaw,
  outputValidator: (raw: unknown) => T,
  semanticValidator?: (result: T) => void,
): T {
  // Step 1: finish_reason
  if (raw.finishReason === 'length') {
    throw new AppError('AI_RESPONSE_TOO_LARGE', AI_ERROR_MESSAGES.AI_RESPONSE_TOO_LARGE);
  }
  if (raw.finishReason === 'content_filter') {
    throw new AppError('AI_SCHEMA_VALIDATION_FAILED', AI_ERROR_MESSAGES.AI_SCHEMA_VALIDATION_FAILED);
  }

  // Step 2: content length
  if (raw.content.length > MAX_CONTENT_CHARS) {
    throw new AppError('AI_RESPONSE_TOO_LARGE', AI_ERROR_MESSAGES.AI_RESPONSE_TOO_LARGE);
  }

  // Step 3: JSON extraction
  const parsed = extractJson(raw.content);

  // Step 4+5: Zod validation (unknown keys stripped by .strip() in outputValidator)
  let result: T;
  try {
    result = outputValidator(parsed);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new AppError('AI_SCHEMA_VALIDATION_FAILED', AI_ERROR_MESSAGES.AI_SCHEMA_VALIDATION_FAILED);
    }
    throw new AppError('AI_SCHEMA_VALIDATION_FAILED', AI_ERROR_MESSAGES.AI_SCHEMA_VALIDATION_FAILED);
  }

  // Step 6: semantic validation — caller throws AI_SCHEMA_VALIDATION_FAILED on failure
  if (semanticValidator) {
    semanticValidator(result);
  }

  // Step 7: return
  return result;
}
