/** Frozen welcome intro lines — transcript source of truth. */
export const welcomeLines = [
  "Hello James.",
  "If you're seeing this,",
  "your brother believes something about you.",
  "That you were never meant for an ordinary life.",
  "This is not really a website.",
  "It's a gift.",
  "A few keys.",
  "A few ideas.",
  "A reminder that the future belongs to people willing to build it.",
  "Welcome.",
] as const;

/**
 * Timed fallback when welcome.mp3 is not yet present.
 * Isolated from production audio+cue pipeline — remove after verified welcome cues.
 */
export const welcomeTimedFallback = [
  { text: "Hello James.", duration: 3000 },
  { text: "If you're seeing this,", duration: 3200 },
  { text: "your brother believes something about you.", duration: 4000 },
  { text: "That you were never meant for an ordinary life.", duration: 4500 },
  { text: "This is not really a website.", duration: 3500 },
  { text: "It's a gift.", duration: 2500 },
  { text: "A few keys.", duration: 2200 },
  { text: "A few ideas.", duration: 2200 },
  {
    text: "A reminder that the future belongs to people willing to build it.",
    duration: 5200,
  },
  { text: "Welcome.", duration: 4000 },
] as const;

/** @deprecated Use welcomeTimedFallback */
export const welcomeNarration = welcomeTimedFallback;
