"use client";

import { NarratedSection } from "@/components/sections/narrated-section";
import { getNarrativeSection } from "@/content/narrative";

function Narrative({ id }: { id: string }) {
  const chapter = getNarrativeSection(id);
  if (!chapter) return null;
  return (
    <NarratedSection
      id={chapter.id}
      number={chapter.number}
      title={chapter.title}
      lines={[...chapter.lines]}
    />
  );
}

export const HealthSection = () => <Narrative id="health" />;
export const AttentionSection = () => <Narrative id="attention" />;
export const TimeSection = () => <Narrative id="time" />;
export const IdentitySection = () => <Narrative id="identity" />;
export const LearningSection = () => <Narrative id="learning" />;
export const AISection = () => <Narrative id="ai" />;
export const BusinessSection = () => <Narrative id="business" />;
export const MoneySection = () => <Narrative id="money" />;
export const RelationshipsSection = () => <Narrative id="relationships" />;
export const LegacySection = () => <Narrative id="legacy" />;
