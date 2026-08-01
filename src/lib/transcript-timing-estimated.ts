/**
 * Fallback transcript timing when production cue JSON is absent.
 * Isolated here — remove only after every chapter has verified cue files.
 */

export function estimatedLineBoundaries(lines: string[]): number[] {
  const weights = lines.map((l) => Math.max(l.length, 8));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const cumulative = weights.reduce<number[]>((acc, w) => {
    const prev = acc.length ? acc[acc.length - 1] : 0;
    acc.push(prev + w);
    return acc;
  }, []);
  return cumulative.map((c) => c / total);
}

export function estimatedLineIndex(lines: string[], progress: number): number {
  if (progress <= 0) return -1;
  const boundaries = estimatedLineBoundaries(lines);
  for (let i = 0; i < boundaries.length; i++) {
    if (progress <= boundaries[i]) return i;
  }
  return lines.length - 1;
}
