// A narration hash changes whenever its spoken text changes. Version the URL so
// browsers cannot keep playing the old MP3 during its four-hour cache lifetime.
export function articleAudioUrl(entry: { file: string; hash?: string }): string {
  if (!entry.hash) return entry.file;
  const separator = entry.file.includes('?') ? '&' : '?';
  return `${entry.file}${separator}v=${encodeURIComponent(entry.hash)}`;
}
