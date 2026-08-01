"use client";

import { useEffect, useState } from "react";
import type { ChapterCues, TimingSource } from "@/lib/cues";
import { hasProductionLineCues } from "@/lib/cues";
import { narrationCueSrc } from "@/lib/audio";

const cache = new Map<string, ChapterCues | null>();

interface CueHookState {
  chapterId: string;
  cues: ChapterCues | null;
  loading: boolean;
  error: string | null;
}

function initialState(chapterId: string): CueHookState {
  return {
    chapterId,
    cues: cache.get(chapterId) ?? null,
    loading: !cache.has(chapterId),
    error: null,
  };
}

export interface ChapterCueState {
  cues: ChapterCues | null;
  timingSource: TimingSource;
  loading: boolean;
  error: string | null;
}

/**
 * Loads production cue JSON for a chapter. Cached for the session.
 * Returns timingSource 'estimated' when cues are missing or invalid.
 */
export function useChapterCues(chapterId: string): ChapterCueState {
  const [state, setState] = useState(() => initialState(chapterId));

  if (state.chapterId !== chapterId) {
    setState(initialState(chapterId));
  }

  useEffect(() => {
    if (cache.has(chapterId)) return;

    let cancelled = false;

    fetch(narrationCueSrc(chapterId))
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          cache.set(chapterId, null);
          setState((prev) =>
            prev.chapterId === chapterId
              ? { ...prev, cues: null, loading: false }
              : prev,
          );
          return;
        }
        if (!res.ok) {
          throw new Error(`Cue load failed (${res.status})`);
        }
        const data = (await res.json()) as ChapterCues;
        if (data.status === "unavailable") {
          cache.set(chapterId, null);
          setState((prev) =>
            prev.chapterId === chapterId
              ? {
                  ...prev,
                  cues: null,
                  loading: false,
                  error: data.reason ?? "Production cues unavailable",
                }
              : prev,
          );
          return;
        }
        cache.set(chapterId, data);
        setState((prev) =>
          prev.chapterId === chapterId
            ? { ...prev, cues: data, loading: false, error: null }
            : prev,
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        cache.set(chapterId, null);
        setState((prev) =>
          prev.chapterId === chapterId
            ? {
                ...prev,
                cues: null,
                loading: false,
                error: err instanceof Error ? err.message : "Cue load failed",
              }
            : prev,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  const timingSource: TimingSource = hasProductionLineCues(state.cues)
    ? "production"
    : "estimated";

  return {
    cues: state.cues,
    timingSource,
    loading: state.loading,
    error: state.error,
  };
}
