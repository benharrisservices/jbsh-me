/** Production timing from ElevenLabs Forced Alignment. */

export interface CueWord {
  text: string;
  start: number;
  end: number;
  loss?: number;
}

export interface CueLine {
  text: string;
  start: number;
  end: number;
  word_start?: number;
  word_end?: number;
}

export interface ChapterCues {
  version?: number;
  source?: string;
  status?: string;
  reason?: string;
  words?: CueWord[];
  lines?: CueLine[];
  coverage?: { ok?: boolean };
}

export type TimingSource = "production" | "estimated";

/** True when cue JSON contains usable line timings (not a failure stub). */
export function hasProductionLineCues(cues: ChapterCues | null | undefined): cues is ChapterCues {
  if (!cues || cues.status === "unavailable") return false;
  const lines = cues.lines;
  if (!lines?.length) return false;
  return lines.every(
    (l) =>
      typeof l.start === "number" &&
      typeof l.end === "number" &&
      l.end > l.start,
  );
}

export function hasProductionWordCues(cues: ChapterCues | null | undefined): boolean {
  if (!hasProductionLineCues(cues)) return false;
  const words = cues.words;
  if (!words?.length) return false;
  return words.every(
    (w) =>
      typeof w.start === "number" &&
      typeof w.end === "number" &&
      w.end > w.start,
  );
}

export function activeLineIndex(cues: ChapterCues, currentTime: number): number {
  const lines = cues.lines!;
  if (lines[0] && currentTime <= lines[0].start) {
    return currentTime >= 0 && lines[0].start <= 0.05 ? 0 : -1;
  }
  for (let i = 0; i < lines.length; i++) {
    if (currentTime >= lines[i].start && currentTime < lines[i].end) return i;
  }
  if (currentTime >= lines[lines.length - 1].end) return lines.length - 1;
  return -1;
}

export function activeWordIndex(cues: ChapterCues, currentTime: number): number {
  const words = cues.words;
  if (!words?.length || currentTime <= 0) return -1;
  for (let i = 0; i < words.length; i++) {
    if (currentTime >= words[i].start && currentTime < words[i].end) return i;
  }
  if (currentTime >= words[words.length - 1].end) return words.length - 1;
  return -1;
}
