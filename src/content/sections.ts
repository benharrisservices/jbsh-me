import { narrationAudioSrc } from "@/lib/audio";
import {
  FIRST_JOURNEY_CHAPTER_ID,
  narrativeSections,
} from "@/content/narrative";

export interface Chapter {
  id: string;
  title: string;
  number: string;
  /** Hero has no narration; every other chapter binds to /audio/{id}.mp3. */
  hasAudio: boolean;
}

/**
 * Site chapter order: silent hero (welcome) + eleven narrated journey chapters.
 * Navigation, scroll router, and audio player all derive from this.
 */
export const chapters: Chapter[] = [
  { id: "welcome", title: "Welcome", number: "00", hasAudio: false },
  ...narrativeSections
    .filter((s) => s.journey)
    .map((s) => ({
      id: s.id,
      title: s.title,
      number: s.number,
      hasAudio: true as const,
    })),
];

export type ChapterId = (typeof chapters)[number]["id"];

/** Chapters that own a narration track (everything except the silent hero). */
export const audioChapters = chapters.filter((c) => c.hasAudio);

export { FIRST_JOURNEY_CHAPTER_ID };

const byId = new Map(chapters.map((c) => [c.id, c]));

export function getChapter(id: string): Chapter | undefined {
  return byId.get(id);
}

export function getChapterTitle(id: string): string {
  return byId.get(id)?.title ?? id;
}

export function getChapterAudioSrc(id: string): string {
  return narrationAudioSrc(id);
}

/**
 * The next chapter that has narration, or null at the end.
 * Used by the audio router to advance exactly one chapter when a track ends.
 */
export function getNextAudioChapterId(id: string): string | null {
  const index = audioChapters.findIndex((c) => c.id === id);
  if (index < 0 || index >= audioChapters.length - 1) return null;
  return audioChapters[index + 1].id;
}
