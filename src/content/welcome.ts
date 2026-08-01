import { getNarrativeSection } from "@/content/narrative";

/** Frozen welcome intro lines — transcript source of truth (spoken words only). */
export const welcomeLines = [
  ...(getNarrativeSection("welcome")?.lines ?? []),
] as const;
