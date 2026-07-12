"use client";

import { AudioProvider } from "@/components/providers/audio-provider";
import { GlobalPlayer } from "@/components/audio/global-player";
import { useChapterScroll } from "@/hooks/use-chapter-scroll";
import { useScrollSnap } from "@/hooks/use-scroll-snap";
import { HeroSection } from "@/components/sections/hero-section";
import {
  IdentitySection,
  FreedomSection,
  LearningSection,
  HealthSection,
  MoneySection,
  BusinessSection,
  TechnologySection,
  AISection,
  LeverageSection,
} from "@/components/sections/narrative-sections";
import {
  KeysSection,
  PrinciplesSection,
  BooksSection,
  ProjectsSection,
  ResourcesSection,
} from "@/components/sections/feature-sections";
import { FinalLetterSection } from "@/components/sections/final-letter";
import { Navigation } from "@/components/site/navigation";
import { ThemeSwitch } from "@/components/theme-switch";
import { EasterEggLayer } from "@/components/easter-eggs/easter-egg-layer";

function MainContent() {
  useChapterScroll();
  useScrollSnap();

  return (
    <div className="relative">
      <ThemeSwitch />
      <Navigation />
      <EasterEggLayer />
      <GlobalPlayer />

      <main>
        <HeroSection />
        <IdentitySection />
        <KeysSection />
        <PrinciplesSection />
        <FreedomSection />
        <LearningSection />
        <HealthSection />
        <MoneySection />
        <BusinessSection />
        <TechnologySection />
        <AISection />
        <LeverageSection />
        <BooksSection />
        <ProjectsSection />
        <ResourcesSection />
        <FinalLetterSection />
      </main>
    </div>
  );
}

export function MainSite() {
  return (
    <AudioProvider>
      <MainContent />
    </AudioProvider>
  );
}
