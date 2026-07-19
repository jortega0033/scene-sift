export const INSPECTION_ERROR_MESSAGES: Record<string, string> = {
  FILE_NOT_FOUND: 'Video file not found at the specified path.',
  FFPROBE_ERROR: 'Media analysis failed. Check that the video file is valid.',
  PARSE_ERROR: 'Could not read media information from the file.',
  NO_VIDEO_STREAM: 'No video stream found in the file.',
};

export const formatInspectionError = (code: string): string =>
  INSPECTION_ERROR_MESSAGES[code] ?? `Inspection failed (${code}).`;

export const formatDuration = (seconds: number | null): string => {
  if (seconds == null) return '—';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const formatFileSize = (bytes: number | null): string => {
  if (bytes == null) return '—';
  if (bytes >= 1_099_511_627_776) return `${(bytes / 1_099_511_627_776).toFixed(1)} TB`;
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
};

export const formatBitRate = (bps: number | null): string => {
  if (bps == null) return '—';
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`;
  return `${bps} bps`;
};
