/**
 * Central narration asset registry.
 * Drop replacement MP3 + cue JSON using these ids; no path changes required.
 */

export const WELCOME_NARRATION_ID = "welcome" as const;

export type NarrationChapterId =
  | typeof WELCOME_NARRATION_ID
  | "health"
  | "attention"
  | "time"
  | "identity"
  | "learning"
  | "ai"
  | "business"
  | "money"
  | "relationships"
  | "legacy"
  | "toolkit";

/** All narrated ids in playback order (pre-site welcome intro first). */
export const NARRATION_CHAPTER_IDS: readonly NarrationChapterId[] = [
  WELCOME_NARRATION_ID,
  "health",
  "attention",
  "time",
  "identity",
  "learning",
  "ai",
  "business",
  "money",
  "relationships",
  "legacy",
  "toolkit",
] as const;

export function narrationAudioSrc(chapterId: string): string {
  return `/audio/${chapterId}.mp3`;
}

/** Browser-ready Forced Alignment cues. */
export function narrationCueSrc(chapterId: string): string {
  return `/audio/cues/${chapterId}.cue.json`;
}

export const NARRATION_PLAYBACK_RATE = 1.0;

export function applyNarrationPlaybackRate(audio: HTMLAudioElement): void {
  audio.playbackRate = NARRATION_PLAYBACK_RATE;
  try {
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

export function waitForAudioCanPlayThrough(
  audio: HTMLAudioElement,
  timeoutMs = 10000,
): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
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
      if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) resolve();
      else reject(new Error("Audio canplaythrough timeout"));
    }, timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timer);
      audio.removeEventListener("canplaythrough", onReady);
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("error", onError);
    };
    audio.addEventListener("canplaythrough", onReady, { once: true });
    audio.addEventListener("canplay", onReady, { once: true });
    audio.addEventListener("error", onError, { once: true });
  });
}
