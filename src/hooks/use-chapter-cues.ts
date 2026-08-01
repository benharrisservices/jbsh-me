"use client";

import { useEffect, useState } from "react";
import type { ChapterCues, TimingSource } from "@/lib/cues";
import { hasProductionLineCues, normalizeChapterCues } from "@/lib/cues";
import { narrationCueSrc } from "@/lib/audio";

const cache = new Map<string, ChapterCues | null>();
const inflight = new Map<string, Promise<ChapterCues | null>>();

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

async function fetchChapterCues(chapterId: string): Promise<ChapterCues | null> {
  if (cache.has(chapterId)) return cache.get(chapterId) ?? null;
  const existing = inflight.get(chapterId);
  if (existing) return existing;

  const promise = (async () => {
    const res = await fetch(narrationCueSrc(chapterId));
    if (res.status === 404) {
      cache.set(chapterId, null);
      return null;
    }
    if (!res.ok) throw new Error(`Cue load failed (${res.status})`);
    const data = normalizeChapterCues(await res.json());
    if (!data || data.status === "unavailable" || !hasProductionLineCues(data)) {
      cache.set(chapterId, null);
      return null;
    }
    cache.set(chapterId, data);
    return data;
  })().finally(() => {
    inflight.delete(chapterId);
  });

  inflight.set(chapterId, promise);
  return promise;
}

/** Prefetch + await production cues before starting a chapter. */
export function ensureChapterCues(
  chapterId: string,
): Promise<ChapterCues | null> {
  return fetchChapterCues(chapterId);
}

export interface ChapterCueState {
  cues: ChapterCues | null;
  timingSource: TimingSource;
  loading: boolean;
  error: string | null;
}

/**
 * Loads production cue JSON for a chapter. Cached for the session.
 * Returns timingSource 'unavailable' when cues are missing or invalid.
 */
export function useChapterCues(chapterId: string): ChapterCueState {
  const [state, setState] = useState(() => initialState(chapterId));

  if (state.chapterId !== chapterId) {
    setState(initialState(chapterId));
  }

  useEffect(() => {
    let cancelled = false;

    const apply = (data: ChapterCues | null, error: string | null = null) => {
      if (cancelled) return;
      setState({
        chapterId,
        cues: data,
        loading: false,
        error,
      });
    };

    if (cache.has(chapterId)) {
      const id = requestAnimationFrame(() => {
        apply(cache.get(chapterId) ?? null);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(id);
      };
    }

    fetchChapterCues(chapterId)
      .then((data) => apply(data, data ? null : "Production cues unavailable"))
      .catch((err: unknown) => {
        cache.set(chapterId, null);
        apply(null, err instanceof Error ? err.message : "Cue load failed");
      });

    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  const timingSource: TimingSource = hasProductionLineCues(state.cues)
    ? "production"
    : "unavailable";

  return {
    cues: state.cues,
    timingSource,
    loading: state.loading,
    error: state.error,
  };
}
