import { connectionTestPrompt } from './prompts/connectionTest';

export const PROMPT_REGISTRY = {
  CONNECTION_TEST: connectionTestPrompt,
} as const;

export type PromptId = keyof typeof PROMPT_REGISTRY;

export const getPrompt = (id: PromptId) => PROMPT_REGISTRY[id];
