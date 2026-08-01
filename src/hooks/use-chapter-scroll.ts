"use client";

import { useEffect } from "react";
import { chapters } from "@/content/sections";
import { useAudio } from "@/components/providers/audio-provider";

/**
 * Tracks which chapter is in view and keeps the global audio player in sync.
 * While narration is starting or playing, audio owns the active chapter.
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
        // Audio owns chapter selection during playback / start / preroll.
        if (playing || prerolling || narrationStarted) {
          // Still allow manual paused navigation between audio chapters.
          if (playing || prerolling) return;
          if (id === "welcome") return;
        }
        setActiveChapter(id);
      },
      { threshold: [0.35, 0.5, 0.65], rootMargin: "-10% 0px -10% 0px" },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [setActiveChapter, unlockPlayer, narrationStarted, playing, prerolling]);
}
