"use client";

import { useEffect } from "react";
import { chapters } from "@/content/sections";
import { useAudio } from "@/components/providers/audio-provider";

/**
 * Tracks which chapter is in view and keeps the global audio player in sync.
 * Exactly one chapter is active at any time. The player is revealed the moment
 * the reader leaves the hero and enters the narrated body.
 */
export function useChapterScroll() {
  const { setActiveChapter, unlockPlayer } = useAudio();

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
        setActiveChapter(id);
        if (id !== "welcome") unlockPlayer();
      },
      { threshold: [0.35, 0.5, 0.65], rootMargin: "-10% 0px -10% 0px" },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [setActiveChapter, unlockPlayer]);
}
