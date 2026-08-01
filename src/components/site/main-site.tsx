"use client";

import { useEffect } from "react";
import { AudioProvider } from "@/components/providers/audio-provider";
import { GlobalPlayer } from "@/components/audio/global-player";
import { useChapterScroll } from "@/hooks/use-chapter-scroll";
import { useScrollSnap } from "@/hooks/use-scroll-snap";
import { HeroSection } from "@/components/sections/hero-section";
import {
  HealthSection,
  AttentionSection,
  TimeSection,
  IdentitySection,
  LearningSection,
  AISection,
  BusinessSection,
  MoneySection,
  RelationshipsSection,
  LegacySection,
} from "@/components/sections/narrative-sections";
import { ToolkitSection } from "@/components/sections/toolkit-section";
import { FinalScreen } from "@/components/sections/final-screen";
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
        <HealthSection />
        <AttentionSection />
        <TimeSection />
        <IdentitySection />
        <LearningSection />
        <AISection />
        <BusinessSection />
        <MoneySection />
        <RelationshipsSection />
        <LegacySection />
        <ToolkitSection />
        <FinalScreen />
      </main>
    </div>
  );
}

export function MainSite() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  return (
    <AudioProvider>
      <MainContent />
    </AudioProvider>
  );
}
