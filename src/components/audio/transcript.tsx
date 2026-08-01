"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ChapterCues } from "@/lib/cues";
import {
  activeLineIndex,
  activeWordIndex,
  hasProductionLineCues,
  hasProductionWordCues,
  revealedLineIndex,
} from "@/lib/cues";

interface TranscriptProps {
  lines: string[];
  /** Playback position in seconds — required when production cues are present. */
  currentTime?: number;
  /** Production cue JSON; when valid, drives all highlighting. */
  cues?: ChapterCues | null;
  /** 0–1 progress (kept for callers; highlighting uses cue timing only). */
  progress?: number;
  playing: boolean;
  active?: boolean;
  className?: string;
  /**
   * When true (default), only spoken lines are shown.
   * Future lines stay fully hidden until their cue time.
   */
  progressive?: boolean;
}

export function Transcript({
  lines,
  currentTime = 0,
  cues,
  playing,
  active = true,
  className,
  progressive = true,
}: TranscriptProps) {
  const activeRef = useRef<HTMLParagraphElement | null>(null);
  const useProduction = active && hasProductionLineCues(cues);
  const useWords = useProduction && hasProductionWordCues(cues);

  const activeIndex = useMemo(() => {
    if (!active) return -1;
    if (useProduction && cues) {
      const speaking = activeLineIndex(cues, currentTime);
      const revealed = revealedLineIndex(cues, currentTime);
      // During pauses between cues, keep the last revealed line dominant.
      return speaking >= 0 ? speaking : revealed;
    }
    return progressive ? 0 : -1;
  }, [active, useProduction, cues, currentTime, progressive]);

  const revealIndex = useMemo(() => {
    if (!active) return -1;
    if (useProduction && cues) return revealedLineIndex(cues, currentTime);
    return progressive ? 0 : lines.length - 1;
  }, [active, useProduction, cues, currentTime, progressive, lines.length]);

  const activeWord = useMemo(() => {
    if (!useWords || !cues || currentTime <= 0) return -1;
    return activeWordIndex(cues, currentTime);
  }, [useWords, cues, currentTime]);

  useEffect(() => {
    if (!playing || activeIndex < 0) return;
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeIndex, playing]);

  const renderLineWords = (lineIndex: number) => {
    if (!useWords || !cues?.words || !cues.lines) {
      return lines[lineIndex];
    }

    const line = cues.lines[lineIndex];
    if (
      line.word_start == null ||
      line.word_end == null ||
      line.word_start > line.word_end
    ) {
      return lines[lineIndex];
    }

    const slice = cues.words.slice(line.word_start, line.word_end + 1);
    if (!slice.length) return lines[lineIndex];

    return slice.map((word, wi) => {
      const globalIdx = line.word_start! + wi;
      const isWordActive = activeWord === globalIdx;
      const isWordPast = activeWord >= 0 && globalIdx < activeWord;
      return (
        <span
          key={`${lineIndex}-${wi}`}
          className={cn(
            isWordActive && "text-foreground",
            isWordPast && "text-foreground/35",
            !isWordActive && !isWordPast && "text-foreground/55",
          )}
        >
          {word.text}
          {wi < slice.length - 1 ? " " : ""}
        </span>
      );
    });
  };

  const visibleLines = progressive
    ? lines.map((line, i) => ({ line, i })).filter(({ i }) => i <= revealIndex)
    : lines.map((line, i) => ({ line, i }));

  return (
    <div className={cn("space-y-4 md:space-y-5", className)}>
      <AnimatePresence initial={false}>
        {visibleLines.map(({ line, i }) => {
          const isActive = active && i === activeIndex;
          const isPast = active && activeIndex >= 0 && i < activeIndex;
          const opacity = isActive ? 1 : isPast ? 0.34 : 0;

          return (
            <motion.p
              key={i}
              ref={isActive ? activeRef : null}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: useWords && isActive ? 1 : opacity }}
              transition={{
                opacity: { duration: 0.85, ease: [0.25, 0.1, 0.25, 1] },
                y: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] },
              }}
              className={cn(
                "text-foreground text-xl leading-[1.6] font-light tracking-[-0.01em] md:text-2xl md:leading-[1.6]",
              )}
            >
              {useWords && isActive ? renderLineWords(i) : line}
            </motion.p>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
