"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Play } from "lucide-react";
import { SITE } from "@/lib/constants";
import { useAudio } from "@/components/providers/audio-provider";

export function HeroSection() {
  const { narrationStarted, startNarration } = useAudio();

  const handleDoubleClick = () => {
    const handler = (window as unknown as Record<string, () => void>)
      .__jbshLogoDblClick;
    handler?.();
  };

  return (
    <section
      id="welcome"
      className="chapter-scene relative flex h-dvh snap-start snap-always items-center justify-center px-6"
    >
      <div className="text-center">
        <motion.h1
          onDoubleClick={handleDoubleClick}
          className="cursor-default font-serif text-7xl font-light tracking-tight text-foreground select-none md:text-9xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {SITE.title}
        </motion.h1>

        <motion.p
          className="mt-10 font-sans text-[11px] font-normal tracking-[0.28em] text-foreground/40 uppercase md:mt-12 md:text-xs md:tracking-[0.32em]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.6 }}
        >
          {SITE.subtitle}
        </motion.p>

        <motion.p
          className="mt-3 font-sans text-[10px] font-light tracking-[0.2em] text-foreground/25 md:text-[11px] md:tracking-[0.24em]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.85 }}
        >
          {SITE.tagline}
        </motion.p>

        <div className="mt-16 flex justify-center md:mt-20">
          <AnimatePresence mode="wait">
            {!narrationStarted ? (
              <motion.button
                key="hero-play"
                type="button"
                onClick={startNarration}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, y: 6 }}
                transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex h-20 w-20 items-center justify-center rounded-full border border-foreground/12 bg-foreground/[0.04] text-foreground/70 shadow-[0_8px_40px_rgba(0,0,0,0.06)] backdrop-blur-md transition-colors hover:border-foreground/20 hover:bg-foreground/[0.07] hover:text-foreground md:h-24 md:w-24 dark:shadow-[0_8px_40px_rgba(0,0,0,0.35)]"
                aria-label="Play narration"
              >
                <Play
                  className="h-6 w-6 translate-x-[1.5px] md:h-7 md:w-7"
                  strokeWidth={1.25}
                />
              </motion.button>
            ) : (
              <motion.div
                key="hero-line"
                className="flex h-20 items-start justify-center md:h-24"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
              >
                <motion.div
                  className="h-10 w-px bg-foreground/12"
                  animate={{ scaleY: [1, 0.45, 1], opacity: [0.4, 0.15, 0.4] }}
                  transition={{
                    duration: 3.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{ transformOrigin: "top" }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
