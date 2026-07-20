import type { PromptDefinition } from '../types';
import { aiCandidatesOutputSchema, type AiCandidatesOutput } from '@shared/schemas/candidates';

type ClipCandidatesInput = {
  transcriptText: string;
  videoDurationMs: number;
};

const msToTimestamp = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const SYSTEM_INSTRUCTIONS = `You are a video clip selector. Given a timestamped transcript and video duration, identify 3-8 self-contained moments most suitable for short-form social media clips.

Rules:
- Each clip must be 5-180 seconds long (startMs + 5000 <= endMs <= startMs + 180000)
- startMs must be >= 0 and endMs must not exceed the video duration
- Clips must be grounded in the transcript — do not invent dialogue or events
- Return 3-8 clips sorted by score descending (best first)
- Titles must be concise (max 80 chars)
- Reasons must explain why the moment is engaging (max 300 chars)

Respond ONLY with valid JSON matching this exact schema:
{
  "candidates": [
    {
      "startMs": <integer milliseconds>,
      "endMs": <integer milliseconds>,
      "title": "<short title>",
      "reason": "<why this clip is engaging>",
      "score": <0.0 to 1.0>
    }
  ]
}`;

export const clipCandidatesPrompt: PromptDefinition<ClipCandidatesInput, AiCandidatesOutput> = {
  promptId: 'clipCandidates',
  version: 1,
  purpose: 'Identify clip-worthy segments from a video transcript for short-form social media.',
  systemInstructions: SYSTEM_INSTRUCTIONS,
  buildUserContent: ({ transcriptText, videoDurationMs }) =>
    `Video duration: ${msToTimestamp(videoDurationMs)} (${videoDurationMs}ms)\n\nTranscript:\n${transcriptText}`,
  outputJsonSchema: {
    type: 'object',
    properties: {
      candidates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            startMs: { type: 'integer', minimum: 0 },
            endMs: { type: 'integer', minimum: 1 },
            title: { type: 'string', maxLength: 120 },
            reason: { type: 'string', maxLength: 500 },
            score: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['startMs', 'endMs', 'title', 'reason', 'score'],
          additionalProperties: false,
        },
        minItems: 1,
        maxItems: 20,
      },
    },
    required: ['candidates'],
    additionalProperties: false,
  },
  outputValidator: (raw) => aiCandidatesOutputSchema.parse(raw),
  maxInputChars: 32_000,
  maxOutputTokens: 2_000,
  maxDurationMs: 60_000,
  compatibleTasks: ['clipCandidates'],
};
