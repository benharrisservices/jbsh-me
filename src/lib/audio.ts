/**
 * Central narration asset registry.
 * Every chapter — including the pre-site welcome intro — resolves paths here.
 * Drop production MP3 + cue JSON using these names; no code changes required.
 */

/** Pre-site welcome intro (not the hero section, which stays silent). */
export const WELCOME_NARRATION_ID = "welcome" as const;

export type NarrationChapterId =
  | typeof WELCOME_NARRATION_ID
  | "identity"
  | "keys"
  | "principles"
  | "freedom"
  | "learning"
  | "health"
  | "money"
  | "business"
  | "technology"
  | "ai"
  | "leverage"
  | "books"
  | "projects"
  | "resources"
  | "letter";

/** All narrated chapter ids in playback order (welcome intro first). */
export const NARRATION_CHAPTER_IDS: readonly NarrationChapterId[] = [
  WELCOME_NARRATION_ID,
  "identity",
  "keys",
  "principles",
  "freedom",
  "learning",
  "health",
  "money",
  "business",
  "technology",
  "ai",
  "leverage",
  "books",
  "projects",
  "resources",
  "letter",
] as const;

export function narrationAudioSrc(chapterId: string): string {
  return `/audio/${chapterId}.mp3`;
}

/** Production word/line timing from Forced Alignment. */
export function narrationCueSrc(chapterId: string): string {
  return `/audio/cues/${chapterId}.json`;
}
