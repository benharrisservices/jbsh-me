"use client";

import { motion } from "framer-motion";
import { NarratedSection } from "@/components/sections/narrated-section";
import { CredentialCard } from "@/components/keys/credential-card";
import { SpaceshipGroup } from "@/components/keys/spaceship-group";
import { credentialCards, spaceshipCredentials } from "@/content/keys";
import { getNarrativeSection } from "@/content/narrative";
import { useAudio } from "@/components/providers/audio-provider";

/**
 * Final narrated chapter. Credential cards stay subdued until toolkit
 * narration is not actively playing, then become the visual focus.
 */
export function ToolkitSection() {
  const chapter = getNarrativeSection("toolkit");
  const { activeChapterId, playing, prerolling, reachedEnd } = useAudio();
  if (!chapter) return null;

  const toolkitSpeaking =
    activeChapterId === "toolkit" && (playing || prerolling);
  const credentialsFocus = reachedEnd || !toolkitSpeaking;

  return (
    <NarratedSection
      id={chapter.id}
      number={chapter.number}
      title={chapter.title}
      lines={[...chapter.lines]}
      scrollable
    >
      <motion.div
        initial={false}
        animate={{
          opacity: credentialsFocus ? 1 : 0.2,
          y: credentialsFocus ? 0 : 12,
        }}
        transition={{ duration: 0.85, ease: [0.25, 0.1, 0.25, 1] }}
        className="border-t border-foreground/[0.06] pt-4"
      >
        <SpaceshipGroup credentials={spaceshipCredentials} index={0} />
        {credentialCards.map((cred, i) => (
          <CredentialCard key={cred.id} credential={cred} index={i + 1} />
        ))}
      </motion.div>
    </NarratedSection>
  );
}
