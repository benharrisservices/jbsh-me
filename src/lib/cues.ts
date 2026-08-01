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
  pad_lead_s?: number;
  pad_trail_s?: number;
  lead_in_s?: number;
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

type Timed = { start: number; end: number };

/**
 * Normalize production cue JSON into the app's canonical shape.
 * Accepts either { text } or { word }, and word_start/wordStart aliases.
 * Does not mutate the source file.
 */
export function normalizeChapterCues(
  raw: RawChapterCues | null | undefined,
): ChapterCues | null {
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

/**
 * Last cue whose start <= t (binary search). Soft-holds through gaps so
 * highlighting never flickers backward or resets during silence.
 */
export function softActiveIndex(items: Timed[], currentTime: number): number {
  if (!items.length) return -1;
  let lo = 0;
  let hi = items.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid].start <= currentTime) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  // Lead-in / before first cue: hold the opening item.
  return ans < 0 ? 0 : ans;
}

/** @deprecated Use softActiveIndex — kept for call sites. */
export function activeLineIndex(cues: ChapterCues, currentTime: number): number {
  return softActiveIndex(cues.lines ?? [], currentTime);
}

/**
 * Highest line whose start has been reached. Monotonic for progressive reveal.
 */
export function revealedLineIndex(cues: ChapterCues, currentTime: number): number {
  return softActiveIndex(cues.lines ?? [], currentTime);
}

export function activeWordIndex(cues: ChapterCues, currentTime: number): number {
  const words = cues.words;
  if (!words?.length) return -1;
  return softActiveIndex(words, currentTime);
}

/** True when currentTime falls inside the cue's [start, end) window. */
export function isCueSpeaking(item: Timed | undefined, currentTime: number): boolean {
  if (!item) return false;
  return currentTime >= item.start && currentTime < item.end;
}
