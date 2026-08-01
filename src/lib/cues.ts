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
  id?: string;
  audio?: string;
  duration?: number;
  words?: CueWord[];
  lines?: CueLine[];
  coverage?: { ok?: boolean };
}

export type TimingSource = "production" | "unavailable";

type RawCueWord = {
  text?: string;
  word?: string;
  start?: number;
  end?: number;
  loss?: number;
};

type RawCueLine = {
  text?: string;
  start?: number;
  end?: number;
  word_start?: number;
  word_end?: number;
  wordStart?: number;
  wordEnd?: number;
};

type RawChapterCues = Omit<ChapterCues, "words" | "lines"> & {
  words?: RawCueWord[];
  lines?: RawCueLine[];
};

/**
 * Normalize production cue JSON into the app's canonical shape.
 * Accepts either { text } or { word }, and word_start/wordStart aliases.
 * Does not mutate the source file.
 */
export function normalizeChapterCues(raw: RawChapterCues | null | undefined): ChapterCues | null {
  if (!raw) return null;

  const words = (raw.words ?? [])
    .map((w) => {
      const text = (w.text ?? w.word ?? "").trim();
      if (
        !text ||
        typeof w.start !== "number" ||
        typeof w.end !== "number" ||
        !(w.end > w.start)
      ) {
        return null;
      }
      return {
        text,
        start: w.start,
        end: w.end,
        ...(typeof w.loss === "number" ? { loss: w.loss } : {}),
      } satisfies CueWord;
    })
    .filter((w): w is CueWord => w != null);

  const lines = (raw.lines ?? [])
    .map((l) => {
      if (
        typeof l.text !== "string" ||
        typeof l.start !== "number" ||
        typeof l.end !== "number" ||
        !(l.end > l.start)
      ) {
        return null;
      }
      const word_start = l.word_start ?? l.wordStart;
      const word_end = l.word_end ?? l.wordEnd;
      return {
        text: l.text,
        start: l.start,
        end: l.end,
        ...(typeof word_start === "number" ? { word_start } : {}),
        ...(typeof word_end === "number" ? { word_end } : {}),
      } satisfies CueLine;
    })
    .filter((l): l is CueLine => l != null);

  return {
    ...raw,
    words,
    lines,
  };
}

/** True when cue JSON contains usable line timings (not a failure stub). */
export function hasProductionLineCues(
  cues: ChapterCues | null | undefined,
): cues is ChapterCues {
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

export function hasProductionWordCues(
  cues: ChapterCues | null | undefined,
): boolean {
  if (!hasProductionLineCues(cues)) return false;
  const words = cues.words;
  if (!words?.length) return false;
  return words.every(
    (w) =>
      typeof w.text === "string" &&
      w.text.length > 0 &&
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

/**
 * Highest line whose start has been reached. Monotonic for progressive reveal
 * so pauses between cues never hide already-spoken lines.
 */
export function revealedLineIndex(cues: ChapterCues, currentTime: number): number {
  const lines = cues.lines!;
  let revealed = -1;
  for (let i = 0; i < lines.length; i++) {
    if (currentTime >= lines[i].start) revealed = i;
  }
  if (revealed < 0) return 0;
  return revealed;
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
