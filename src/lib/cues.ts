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
    .filter((l): l is CueLine => l != null)
    // Per-chapter ordering only — never accumulate offsets across chapters.
    .sort((a, b) => a.start - b.start || a.end - b.end);

  words.sort((a, b) => a.start - b.start || a.end - b.end);

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

/** Collapse punctuation/case so content lines can align to cue text. */
function normalizeCueText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function wordsForCue(cue: CueLine, words: CueWord[] | undefined): CueWord[] {
  if (!words?.length) return [];
  if (
    typeof cue.word_start === "number" &&
    typeof cue.word_end === "number" &&
    cue.word_end >= cue.word_start
  ) {
    return words.slice(cue.word_start, cue.word_end + 1);
  }
  const pad = 0.04;
  return words.filter(
    (w) => w.start >= cue.start - pad && w.end <= cue.end + pad,
  );
}

/**
 * Split one cue's time window across several content lines (cue merge).
 * Prefer word timings when they cover the cue; otherwise weight by text length.
 */
function splitCueAcrossContentLines(
  cue: CueLine,
  contentLines: string[],
  words: CueWord[] | undefined,
): Timed[] {
  if (contentLines.length === 1) {
    return [{ start: cue.start, end: cue.end }];
  }

  const cueWords = wordsForCue(cue, words);
  if (cueWords.length > 0) {
    let wi = 0;
    const ranges: Timed[] = [];
    for (let i = 0; i < contentLines.length; i++) {
      const needed = normalizeCueText(contentLines[i]).split(" ").filter(Boolean)
        .length;
      if (needed <= 0 || wi >= cueWords.length) {
        ranges.push({
          start: i === 0 ? cue.start : ranges[i - 1]?.end ?? cue.start,
          end: cue.end,
        });
        continue;
      }
      const slice = cueWords.slice(wi, Math.min(wi + needed, cueWords.length));
      wi += needed;
      const start = i === 0 ? cue.start : slice[0]?.start ?? cue.start;
      const end =
        i === contentLines.length - 1
          ? cue.end
          : slice[slice.length - 1]?.end ?? cue.end;
      ranges.push({ start, end: Math.max(start + 0.01, end) });
    }
    if (ranges.length === contentLines.length) return ranges;
  }

  const weights = contentLines.map((l) =>
    Math.max(1, normalizeCueText(l).length),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  const duration = cue.end - cue.start;
  let t = cue.start;
  return weights.map((w, i) => {
    const slice = duration * (w / total);
    const start = t;
    const end = i === weights.length - 1 ? cue.end : t + slice;
    t = end;
    return { start, end };
  });
}

/**
 * Map displayed content lines to per-chapter cue timings.
 *
 * Driven only by this chapter's cue starts/ends — no cumulative offsets.
 * Survives content↔cue segmentation mismatches (merged/split lines) and
 * extra trailing cues (e.g. letter closing, principles list beyond intro).
 * Drop-in MP3 + cue JSON replacements keep working as long as line text
 * still aligns under the same filenames.
 */
export function contentLineTimings(
  contentLines: string[],
  cueLines: CueLine[],
  words?: CueWord[],
): Timed[] {
  if (!contentLines.length || !cueLines.length) return [];

  const cues = [...cueLines].sort((a, b) => a.start - b.start || a.end - b.end);
  const timings: Timed[] = [];
  let ci = 0;
  let qi = 0;

  while (ci < contentLines.length && qi < cues.length) {
    const cNorm = normalizeCueText(contentLines[ci]);
    const cue = cues[qi];
    const qNorm = normalizeCueText(cue.text);

    if (!cNorm) {
      ci++;
      continue;
    }

    if (cNorm === qNorm) {
      timings.push({ start: cue.start, end: cue.end });
      ci++;
      qi++;
      continue;
    }

    // One cue covers several content lines (e.g. freedom "It is your time." +
    // "Belonging to you." ↔ "It is your time belonging to you.").
    if (qNorm.startsWith(cNorm)) {
      const group: string[] = [contentLines[ci]];
      let acc = cNorm;
      let j = ci + 1;
      while (j < contentLines.length && acc !== qNorm) {
        const next = `${acc} ${normalizeCueText(contentLines[j])}`.trim();
        if (!qNorm.startsWith(next) && next !== qNorm) break;
        group.push(contentLines[j]);
        acc = next;
        j++;
      }
      if (acc === qNorm || qNorm.startsWith(acc)) {
        timings.push(...splitCueAcrossContentLines(cue, group, words));
        ci = j;
        qi++;
        continue;
      }
    }

    // One content line covers several cues.
    if (cNorm.startsWith(qNorm)) {
      let acc = qNorm;
      const start = cue.start;
      let end = cue.end;
      let k = qi + 1;
      while (k < cues.length && acc !== cNorm) {
        const next = `${acc} ${normalizeCueText(cues[k].text)}`.trim();
        if (!cNorm.startsWith(next) && next !== cNorm) break;
        acc = next;
        end = cues[k].end;
        k++;
      }
      if (acc === cNorm || cNorm.startsWith(acc)) {
        timings.push({ start, end });
        ci++;
        qi = k;
        continue;
      }
    }

    // Unaligned: advance the cue cursor only — never invent offsets.
    qi++;
  }

  return timings;
}

/**
 * Active content-line index for a chapter. Cue timing only; revalidated
 * from this chapter's cues on every call (no cross-chapter state).
 */
export function activeContentLineIndex(
  contentLines: string[],
  cues: ChapterCues,
  currentTime: number,
): number {
  const timings = contentLineTimings(
    contentLines,
    cues.lines ?? [],
    cues.words,
  );
  if (!timings.length) return -1;
  return softActiveIndex(timings, currentTime);
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
