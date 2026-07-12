import { audioSrc } from "@/lib/audio";

export interface Chapter {
  id: string;
  title: string;
  number: string;
  /** Hero has no narration; every other chapter binds to /audio/{id}.mp3. */
  hasAudio: boolean;
}

/**
 * The single source of truth for chapter order, numbering, and audio binding.
 * Navigation, the scroll router, and the audio player all derive from this.
 * Add a chapter here and it flows through the whole experience.
 */
export const chapters: Chapter[] = [
  { id: "welcome", title: "Welcome", number: "00", hasAudio: false },
  { id: "identity", title: "Identity", number: "01", hasAudio: true },
  { id: "keys", title: "The Keys", number: "02", hasAudio: true },
  { id: "principles", title: "The Principles", number: "03", hasAudio: true },
  { id: "freedom", title: "Freedom", number: "04", hasAudio: true },
  { id: "learning", title: "Learning", number: "05", hasAudio: true },
  { id: "health", title: "Health", number: "06", hasAudio: true },
  { id: "money", title: "Money", number: "07", hasAudio: true },
  { id: "business", title: "Business", number: "08", hasAudio: true },
  { id: "technology", title: "Technology", number: "09", hasAudio: true },
  { id: "ai", title: "Artificial Intelligence", number: "10", hasAudio: true },
  { id: "leverage", title: "Leverage", number: "11", hasAudio: true },
  { id: "books", title: "Books", number: "12", hasAudio: true },
  { id: "projects", title: "Projects", number: "13", hasAudio: true },
  { id: "resources", title: "Useful Resources", number: "14", hasAudio: true },
  { id: "letter", title: "Final Letter", number: "15", hasAudio: true },
];

export type ChapterId = (typeof chapters)[number]["id"];

/** Chapters that own a narration track (everything except the hero). */
export const audioChapters = chapters.filter((c) => c.hasAudio);

const byId = new Map(chapters.map((c) => [c.id, c]));

export function getChapter(id: string): Chapter | undefined {
  return byId.get(id);
}

export function getChapterTitle(id: string): string {
  return byId.get(id)?.title ?? id;
}

export function getChapterAudioSrc(id: string): string {
  return audioSrc(id);
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
