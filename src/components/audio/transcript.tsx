"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  type ChapterCues,
  hasProductionLineCues,
  hasProductionWordCues,
  isCueSpeaking,
  revealedLineIndex,
  softActiveIndex,
} from "@/lib/cues";
import { cn } from "@/lib/utils";

interface TranscriptProps {
  lines: string[];
  currentTime: number;
  cues: ChapterCues | null;
  /** Unused for timing — kept for API compatibility with section props. */
  progress?: number;
  playing: boolean;
  active: boolean;
}

export function Transcript({
  lines,
  currentTime,
  cues,
  playing: _playing,
  active,
}: TranscriptProps) {
  void _playing;
  const production = hasProductionLineCues(cues);
  const wordMode = production && hasProductionWordCues(cues);

  const activeIndex = useMemo(() => {
    if (!active || !production || !cues) return -1;
    return softActiveIndex(cues.lines ?? [], currentTime);
  }, [active, production, cues, currentTime]);

  const revealIndex = useMemo(() => {
    if (!active) return -1;
    if (!production || !cues) return lines.length - 1;
    return revealedLineIndex(cues, currentTime);
  }, [active, production, cues, currentTime, lines.length]);

  return (
    <div className="space-y-5 md:space-y-6" aria-live="polite">
      {lines.map((line, i) => {
        const visible = !active || i <= Math.max(revealIndex, 0);
        const isCurrent = active && production && i === activeIndex;
        const spoken = active && production && i < activeIndex;
        const upcoming = active && production && i > activeIndex;
        const lineCue = production && cues?.lines ? cues.lines[i] : undefined;
        const speakingNow = isCurrent && isCueSpeaking(lineCue, currentTime);

        return (
          <motion.p
            key={`${i}-${line.slice(0, 24)}`}
            initial={false}
            animate={{
              opacity: !visible ? 0 : isCurrent ? 1 : spoken ? 0.55 : upcoming ? 0.22 : 0.88,
              y: visible ? 0 : 6,
            }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "font-serif text-xl leading-relaxed font-light tracking-wide md:text-2xl lg:text-[1.65rem] lg:leading-relaxed",
              !visible && "pointer-events-none absolute",
              isCurrent && "text-foreground",
              spoken && "text-foreground/70",
              upcoming && "text-muted-foreground/50",
              !production && active && "text-foreground/90",
              !active && "text-foreground/85",
              speakingNow && "drop-shadow-[0_0_18px_rgba(212,175,55,0.08)]",
            )}
          >
            {wordMode && cues?.words && isCurrent
              ? renderWords(line, cues, currentTime, i)
              : line}
          </motion.p>
        );
      })}
    </div>
  );
}

function renderWords(
  line: string,
  cues: ChapterCues,
  currentTime: number,
  lineIndex: number,
) {
  const lineCue = cues.lines?.[lineIndex];
  if (!lineCue || !cues.words?.length) return line;

  const start = lineCue.word_start ?? 0;
  const end = lineCue.word_end ?? cues.words.length;
  const words = cues.words.slice(start, end);
  if (!words.length) return line;

  const globalSoft = softActiveIndex(cues.words ?? [], currentTime);

  return (
    <span className="inline">
      {words.map((w, wi) => {
        const globalIdx = start + wi;
        const isActiveWord = globalIdx === globalSoft;
        const speaking = isCueSpeaking(w, currentTime);
        const past = globalIdx < globalSoft;

        return (
          <span
            key={`${wi}-${w.start}`}
            className={cn(
              "inline transition-colors duration-100",
              isActiveWord && speaking && "text-gold",
              isActiveWord && !speaking && "text-foreground",
              past && !isActiveWord && "text-foreground/75",
              !past && !isActiveWord && "text-foreground/35",
            )}
          >
            {w.text}
            {wi < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
}
