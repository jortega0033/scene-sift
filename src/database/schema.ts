import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
