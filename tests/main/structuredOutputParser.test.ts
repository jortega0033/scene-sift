import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseStructuredOutput, MAX_CONTENT_CHARS } from '@main/services/ai/structuredOutputParser';
import { AppError } from '@main/utils/errors';
import type { AiResponseRaw } from '@main/services/ai/aiHttpClient';

const testSchema = z.object({ ok: z.boolean(), value: z.string().optional() }).strip();
const validate = (raw: unknown) => testSchema.parse(raw);

const raw = (content: string, finishReason: string | null = 'stop'): AiResponseRaw => ({
  content,
  finishReason,
});

describe('parseStructuredOutput', () => {
  describe('step 1 — finish_reason', () => {
    it('throws AI_RESPONSE_TOO_LARGE on finish_reason=length', () => {
      expect(() => parseStructuredOutput(raw('{}', 'length'), validate)).toThrow(
        expect.objectContaining({ code: 'AI_RESPONSE_TOO_LARGE' }),
      );
    });

    it('throws AI_SCHEMA_VALIDATION_FAILED on finish_reason=content_filter', () => {
      expect(() => parseStructuredOutput(raw('{}', 'content_filter'), validate)).toThrow(
        expect.objectContaining({ code: 'AI_SCHEMA_VALIDATION_FAILED' }),
      );
    });

    it('proceeds on finish_reason=stop', () => {
      expect(() => parseStructuredOutput(raw('{"ok":true}', 'stop'), validate)).not.toThrow();
    });

    it('proceeds on finish_reason=null', () => {
      expect(() => parseStructuredOutput(raw('{"ok":true}', null), validate)).not.toThrow();
    });

    it('proceeds on unknown finish_reason', () => {
      expect(() => parseStructuredOutput(raw('{"ok":true}', 'tool_calls'), validate)).not.toThrow();
    });
  });

  describe('step 2 — content length', () => {
    it('throws AI_RESPONSE_TOO_LARGE when content exceeds MAX_CONTENT_CHARS', () => {
      const big = 'x'.repeat(MAX_CONTENT_CHARS + 1);
      expect(() => parseStructuredOutput(raw(big), validate)).toThrow(
        expect.objectContaining({ code: 'AI_RESPONSE_TOO_LARGE' }),
      );
    });

    it('proceeds when content equals MAX_CONTENT_CHARS exactly', () => {
      // content at limit: JSON.parse fails → AI_INVALID_RESPONSE (not TOO_LARGE)
      const atLimit = 'x'.repeat(MAX_CONTENT_CHARS);
      expect(() => parseStructuredOutput(raw(atLimit), validate)).toThrow(
        expect.objectContaining({ code: 'AI_INVALID_RESPONSE' }),
      );
    });
  });

  describe('step 3 — JSON extraction', () => {
    it('parses direct JSON', () => {
      const result = parseStructuredOutput(raw('{"ok":true}'), validate);
      expect(result.ok).toBe(true);
    });

    it('extracts from ```json fence', () => {
      const content = '```json\n{"ok":true}\n```';
      const result = parseStructuredOutput(raw(content), validate);
      expect(result.ok).toBe(true);
    });

    it('extracts from plain ``` fence', () => {
      const content = '```\n{"ok":true}\n```';
      const result = parseStructuredOutput(raw(content), validate);
      expect(result.ok).toBe(true);
    });

    it('picks longest fence when multiple fences present', () => {
      const content = [
        '```json\n{"ok":true}\n```',
        ' some prose ',
        '```json\n{"ok":false,"value":"longer content wins"}\n```',
      ].join('\n');
      const result = parseStructuredOutput(raw(content), validate);
      expect(result.ok).toBe(false);
      expect(result.value).toBe('longer content wins');
    });

    it('throws AI_INVALID_RESPONSE when JSON cannot be extracted', () => {
      expect(() => parseStructuredOutput(raw('not json at all'), validate)).toThrow(
        expect.objectContaining({ code: 'AI_INVALID_RESPONSE' }),
      );
    });

    it('throws AI_INVALID_RESPONSE when fences contain only invalid JSON', () => {
      const content = '```json\nnot valid\n```';
      expect(() => parseStructuredOutput(raw(content), validate)).toThrow(
        expect.objectContaining({ code: 'AI_INVALID_RESPONSE' }),
      );
    });
  });

  describe('step 4 — unknown-key strip', () => {
    it('strips unknown keys silently', () => {
      const result = parseStructuredOutput(
        raw('{"ok":true,"unknownField":"ignored"}'),
        validate,
      );
      expect(result.ok).toBe(true);
      expect((result as Record<string, unknown>)['unknownField']).toBeUndefined();
    });
  });

  describe('step 5 — Zod validation', () => {
    it('throws AI_SCHEMA_VALIDATION_FAILED on wrong type', () => {
      expect(() => parseStructuredOutput(raw('{"ok":"not-a-bool"}'), validate)).toThrow(
        expect.objectContaining({ code: 'AI_SCHEMA_VALIDATION_FAILED' }),
      );
    });

    it('throws AI_SCHEMA_VALIDATION_FAILED on missing required field', () => {
      expect(() => parseStructuredOutput(raw('{"value":"no ok field"}'), validate)).toThrow(
        expect.objectContaining({ code: 'AI_SCHEMA_VALIDATION_FAILED' }),
      );
    });

    it('throws AI_SCHEMA_VALIDATION_FAILED for non-object JSON', () => {
      expect(() => parseStructuredOutput(raw('[1,2,3]'), validate)).toThrow(
        expect.objectContaining({ code: 'AI_SCHEMA_VALIDATION_FAILED' }),
      );
    });
  });

  describe('step 6 — semantic validation', () => {
    it('passes result to semantic validator', () => {
      let received: { ok: boolean; value?: string } | null = null;
      parseStructuredOutput(raw('{"ok":true}'), validate, (r) => {
        received = r;
      });
      expect(received).toEqual({ ok: true });
    });

    it('propagates AppError thrown by semantic validator', () => {
      const semanticValidator = () => {
        throw new AppError('AI_SCHEMA_VALIDATION_FAILED', 'semantic check failed');
      };
      expect(() => parseStructuredOutput(raw('{"ok":true}'), validate, semanticValidator)).toThrow(
        expect.objectContaining({ code: 'AI_SCHEMA_VALIDATION_FAILED' }),
      );
    });

    it('does not call semantic validator if Zod fails', () => {
      let called = false;
      expect(() =>
        parseStructuredOutput(raw('{"ok":"bad"}'), validate, () => {
          called = true;
        }),
      ).toThrow();
      expect(called).toBe(false);
    });
  });

  describe('step 7 — return typed result', () => {
    it('returns correctly typed result', () => {
      const result = parseStructuredOutput(raw('{"ok":true,"value":"hello"}'), validate);
      expect(result).toEqual({ ok: true, value: 'hello' });
    });
  });
});
