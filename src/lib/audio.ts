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

/** Consistent narration tempo across intro and chapters. */
export const NARRATION_PLAYBACK_RATE = 1.0;

/** Apply playback rate with pitch preservation where supported. */
export function applyNarrationPlaybackRate(audio: HTMLAudioElement): void {
  audio.playbackRate = NARRATION_PLAYBACK_RATE;
  try {
    // Safari / Chromium
    (audio as HTMLMediaElement & { preservesPitch?: boolean }).preservesPitch =
      true;
    (
      audio as HTMLMediaElement & { mozPreservesPitch?: boolean }
    ).mozPreservesPitch = true;
    (
      audio as HTMLMediaElement & { webkitPreservesPitch?: boolean }
    ).webkitPreservesPitch = true;
  } catch {
    // Older engines may reject these properties.
  }
}

/** Wait until the media element can start playback cleanly. */
export function waitForAudioCanPlay(
  audio: HTMLAudioElement,
  timeoutMs = 8000,
): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Audio failed to load"));
    };
    const timer = window.setTimeout(() => {
      cleanup();
      if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) resolve();
      else reject(new Error("Audio load timeout"));
    }, timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timer);
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("canplaythrough", onReady);
      audio.removeEventListener("error", onError);
    };
    audio.addEventListener("canplay", onReady, { once: true });
    audio.addEventListener("canplaythrough", onReady, { once: true });
    audio.addEventListener("error", onError, { once: true });
  });
}
