export const SUBTITLE_ERROR_MESSAGES: Record<string, string> = {
  SUBTITLE_FILE_NOT_FOUND: 'Subtitle file not found at the stored path.',
  SUBTITLE_FILE_TOO_LARGE: 'Subtitle file exceeds the 2 MB size limit.',
  SUBTITLE_ENCODING_ERROR: 'Subtitle file encoding is not supported. Use UTF-8.',
  SUBTITLE_INVALID_FORMAT: 'Subtitle file content is not valid.',
  SUBTITLE_UNSUPPORTED_FORMAT: 'This subtitle format is not yet supported. Use .srt or .vtt.',
  SUBTITLE_PARSE_ERROR: 'Subtitle parsing failed. The file may be corrupted or contain no valid cues.',
};

export const formatSubtitleError = (code: string | null): string => {
  if (!code) return 'Unknown subtitle error.';
  return SUBTITLE_ERROR_MESSAGES[code] ?? `Subtitle error (${code}).`;
};

export const formatCueCount = (count: number | null): string => {
  if (count === null) return '—';
  return `${count} cue${count === 1 ? '' : 's'}`;
};

export const formatSubtitleDuration = (lastEndMs: number | null): string => {
  if (lastEndMs === null) return '—';
  const totalSec = Math.floor(lastEndMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};
