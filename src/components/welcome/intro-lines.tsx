"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ChapterCues } from "@/lib/cues";
import { hasProductionLineCues, revealedLineIndex } from "@/lib/cues";

interface IntroLinesProps {
  lines: string[];
  currentTime: number;
  cues: ChapterCues | null;
  className?: string;
}

/**
 * Cinematic intro only: exactly one active line at a time.
 * Previous line exits; next line enters. Driven by production cues.
 */
export function IntroLines({
  lines,
  currentTime,
  cues,
  className,
}: IntroLinesProps) {
  const index = useMemo(() => {
    if (hasProductionLineCues(cues)) {
      return revealedLineIndex(cues, currentTime);
    }
    return 0;
  }, [cues, currentTime]);

  const text = lines[Math.min(Math.max(index, 0), lines.length - 1)] ?? "";

  return (
    <div
      className={cn(
        "relative flex min-h-[4.5rem] items-center justify-center md:min-h-[5.5rem]",
        className,
      )}
    >
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
          className="max-w-lg text-center font-serif text-xl leading-relaxed font-light tracking-[-0.01em] text-white/85 md:text-2xl md:leading-relaxed"
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
