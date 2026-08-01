"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { NarratedSection } from "@/components/sections/narrated-section";
import { CredentialCard } from "@/components/keys/credential-card";
import { SpaceshipGroup } from "@/components/keys/spaceship-group";
import { ShowKeysControl } from "@/components/keys/show-keys-control";
import { KeysVisibilityProvider } from "@/components/keys/keys-visibility";
import { credentialCards, spaceshipCredentials } from "@/content/keys";
import { getNarrativeSection } from "@/content/narrative";
import { useAudio } from "@/components/providers/audio-provider";

/**
 * Final narrated chapter. Credential cards stay subdued until toolkit
 * narration is not actively playing, then become the visual focus.
 * Show Keys state is session-only — never persisted.
 */
export function ToolkitSection() {
  const chapter = getNarrativeSection("toolkit");
  const { activeChapterId, playing, prerolling, reachedEnd } = useAudio();
  const [keysVisible, setKeysVisible] = useState(false);
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
      <KeysVisibilityProvider visible={keysVisible}>
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

          {/* Show Keys lives on the final Toolkit card surface */}
          <div className="flex justify-end pt-6 pb-2">
            <ShowKeysControl
              visible={keysVisible}
              onChange={setKeysVisible}
            />
          </div>
        </motion.div>
      </KeysVisibilityProvider>

      {/*
        Half-viewport breathing runway after the last Toolkit card.
        Keeps sensitive cards above this space; closing stays a deliberate
        further scroll (still in document flow, no overlay / lock).
      */}
      <div
        aria-hidden
        className="pointer-events-none min-h-[50dvh] w-full shrink-0"
      />
    </NarratedSection>
  );
}
