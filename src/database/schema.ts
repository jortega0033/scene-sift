import { blob, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const projectsTable = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  videoPath: text('video_path').notNull(),
  subtitlePath: text('subtitle_path'),
  outputDirectory: text('output_directory'),
  status: text('status').notNull().default('draft'),
  durationSeconds: real('duration_seconds'),
  width: integer('width'),
  height: integer('height'),
  videoCodec: text('video_codec'),
  fps: real('fps'),
  bitRateBps: integer('bit_rate_bps'),
  fileSizeBytes: integer('file_size_bytes'),
  inspectedAt: integer('inspected_at', { mode: 'number' }),
  inspectionError: text('inspection_error'),
  subtitleStatus: text('subtitle_status'),
  subtitleCueCount: integer('subtitle_cue_count'),
  subtitleLastCueEndMs: integer('subtitle_last_cue_end_ms'),
  subtitleParseError: text('subtitle_parse_error'),
  subtitleParsedAt: integer('subtitle_parsed_at', { mode: 'number' }),
  syncStatus: text('sync_status'),
  syncCheckedAt: integer('sync_checked_at', { mode: 'number' }),
  syncWarningsJson: text('sync_warnings_json'),
  syncAnalysisVersion: integer('sync_analysis_version'),
  candidateGenerationStatus: text('candidate_generation_status'),
  candidateGenerationError: text('candidate_generation_error'),
  candidateGeneratedAt: integer('candidate_generated_at', { mode: 'number' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const appSettingsTable = sqliteTable('app_settings', {
  id: text('id').primaryKey().default('default'),
  ffmpegPathOverride: text('ffmpeg_path_override'),
  ffprobePathOverride: text('ffprobe_path_override'),
  defaultOutputDirectory: text('default_output_directory'),
  preferredTheme: text('preferred_theme').notNull().default('system'),
  developmentDiagnosticsEnabled: integer('development_diagnostics_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const subtitleDocumentsTable = sqliteTable('subtitle_documents', {
  projectId: text('project_id').primaryKey(),
  schemaVersion: integer('schema_version').notNull().default(1),
  sourceFormat: text('source_format').notNull(),
  sourceEncoding: text('source_encoding').notNull(),
  cuesJson: text('cues_json').notNull(),
  warningsJson: text('warnings_json').notNull(),
  parsedAt: integer('parsed_at', { mode: 'number' }).notNull(),
});

export const renderJobsTable = sqliteTable('render_jobs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  status: text('status').notNull().default('queued'),
  progress: real('progress').notNull().default(0),
  outputPath: text('output_path'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const aiProviderConfigTable = sqliteTable('ai_provider_config', {
  id: text('id').primaryKey().default('default'),
  providerType: text('provider_type').notNull().default('openai_compatible'),
  baseUrl: text('base_url').notNull().default('https://api.openai.com'),
  model: text('model').notNull().default('gpt-4o-mini'),
  isConfigured: integer('is_configured', { mode: 'boolean' }).notNull().default(false),
  consentRecordedAt: integer('consent_recorded_at', { mode: 'number' }),
  lastTestStatus: text('last_test_status'),
  lastTestAt: integer('last_test_at', { mode: 'number' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const aiSecretsTable = sqliteTable('ai_secrets', {
  id: text('id').primaryKey().default('ai_provider'),
  encryptedKey: blob('encrypted_key'),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const clipCandidatesTable = sqliteTable('clip_candidates', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projectsTable.id, { onDelete: 'cascade' }),
  generationId: text('generation_id').notNull(),
  candidateStatus: text('candidate_status').notNull().default('suggested'),
  startMs: integer('start_ms').notNull(),
  endMs: integer('end_ms').notNull(),
  title: text('title').notNull(),
  reason: text('reason').notNull(),
  scoreRaw: real('score_raw').notNull(),
  sortOrder: integer('sort_order').notNull(),
  modelId: text('model_id').notNull(),
  promptVersion: text('prompt_version').notNull(),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const clipCuesTable = sqliteTable('clip_cues', {
  id: text('id').primaryKey(),
  candidateId: text('candidate_id').notNull().references(() => clipCandidatesTable.id, { onDelete: 'cascade' }),
  sequenceIndex: integer('sequence_index').notNull(),
  startMs: integer('start_ms').notNull(),
  endMs: integer('end_ms').notNull(),
  text: text('text').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});

export const projectCompositionSettingsTable = sqliteTable('project_composition_settings', {
  projectId: text('project_id').primaryKey().references(() => projectsTable.id, { onDelete: 'cascade' }),
  resolution: text('resolution').notNull().default('1080x1920'),
  backgroundStyle: text('background_style').notNull().default('blur'),
  subtitlePosition: text('subtitle_position').notNull().default('bottom'),
  fontFamily: text('font_family').notNull().default('Arial'),
  fontSize: integer('font_size').notNull().default(32),
  fontColor: text('font_color').notNull().default('#FFFFFF'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
});
