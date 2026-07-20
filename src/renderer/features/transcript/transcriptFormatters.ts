import type { TranscriptEntry } from '@shared/schemas/transcript';

const pad = (n: number): string => String(n).padStart(2, '0');

export const formatTimestamp = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

export const entriesToTxt = (entries: TranscriptEntry[]): string =>
  entries.map((e) => e.text).join('\n\n');

export const entriesToJson = (entries: TranscriptEntry[]): string =>
  JSON.stringify(entries, null, 2);
