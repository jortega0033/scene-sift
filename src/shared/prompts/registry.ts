import { connectionTestPrompt } from './prompts/connectionTest';
import { clipCandidatesPrompt } from './prompts/clipCandidates';

export const PROMPT_REGISTRY = {
  connectionTest: connectionTestPrompt,
  clipCandidates: clipCandidatesPrompt,
} as const;

export type PromptId = keyof typeof PROMPT_REGISTRY;

export const getPrompt = (id: PromptId) => PROMPT_REGISTRY[id];
