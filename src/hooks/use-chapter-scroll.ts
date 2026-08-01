"use client";

import { useEffect } from "react";
import { chapters } from "@/content/sections";
import { useAudio } from "@/components/providers/audio-provider";

/**
 * Tracks which chapter is in view and keeps the global audio player in sync.
 * Exactly one chapter is active at any time. The player is revealed only after
 * the reader starts narration from the hero play control.
 * While narration is playing, audio owns the active chapter (scroll cannot steal it).
 */
export function useChapterScroll() {
  const {
    setActiveChapter,
    unlockPlayer,
    narrationStarted,
    playing,
    prerolling,
  } = useAudio();

  useEffect(() => {
    const elements = chapters
      .map((c) => document.getElementById(c.id))
      .filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (!visible.length) return;

        const id = visible[0].target.id;
        if (narrationStarted && id !== "welcome") unlockPlayer();
        // Audio owns chapter selection during playback / preroll transitions.
        if (playing || prerolling) return;
        setActiveChapter(id);
      },
      { threshold: [0.35, 0.5, 0.65], rootMargin: "-10% 0px -10% 0px" },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [setActiveChapter, unlockPlayer, narrationStarted, playing, prerolling]);
}
