// Ids of the user's files: `file-1`, `file-2`, ... A counter, never derived
// from the data, so nothing about a file reaches the URL (architecture §8).

export function fileId(n: number): string {
  return `file-${n}`;
}

export function isFileId(id: string): boolean {
  return /^file-[1-9]\d*$/.test(id);
}
