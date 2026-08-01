import narrativeData from "./narrative-data.json";

export interface NarrativeSection {
  id: string;
  title: string;
  number: string;
  journey: boolean;
  lines: string[];
  source_text_hash: string;
}

export const finalScreenLines: readonly string[] =
  narrativeData.finalScreenLines;

export const narrativeSections: NarrativeSection[] =
  narrativeData.sections as NarrativeSection[];

export const journeySections = narrativeSections.filter((s) => s.journey);

const byId = new Map(narrativeSections.map((s) => [s.id, s]));

export function getNarrativeSection(id: string): NarrativeSection | undefined {
  return byId.get(id);
}

/** First narrated chapter after the silent hero. */
export const FIRST_JOURNEY_CHAPTER_ID = "health" as const;
