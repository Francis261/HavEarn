export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export async function copyText(text: string): Promise<void> {
  const mod = await import('expo-clipboard');
  await mod.default.setStringAsync(text);
}