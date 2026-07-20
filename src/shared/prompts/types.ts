export type PromptDefinition<TInput extends Record<string, string | number>, TOutput> = {
  promptId: string;
  version: number;
  purpose: string;
  systemInstructions: string;
  buildUserContent: (input: TInput) => string;
  outputJsonSchema: object;
  outputValidator: (raw: unknown) => TOutput;
  maxInputChars: number;
  maxOutputTokens: number;
  maxDurationMs: number;
  compatibleTasks: readonly string[];
  /**
   * When true, AiHttpClient does NOT include `response_format` in the request body.
   * Use for minimal probes where the provider may not support json_schema response_format.
   */
  skipResponseFormat?: boolean;
};
