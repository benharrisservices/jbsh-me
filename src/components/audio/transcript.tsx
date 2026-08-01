"use client";

import { useMemo } from "react";
import {
  type ChapterCues,
  hasProductionLineCues,
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

/**
 * Chapter transcript mode: every line stays mounted for the full chapter.
 * Only opacity/color change with the active cue. Never truncate, unmount,
 * or progressively reveal — that logic belongs only to IntroLines.
 */
export function Transcript({
  lines,
  currentTime,
  cues,
  playing: _playing,
  active,
}: TranscriptProps) {
  void _playing;
  const production = hasProductionLineCues(cues);

  const activeIndex = useMemo(() => {
    if (!active || !production || !cues) return -1;
    return softActiveIndex(cues.lines ?? [], currentTime);
  }, [active, production, cues, currentTime]);

  return (
    <div className="space-y-5 md:space-y-6" aria-live="polite">
      {lines.map((line, i) => {
        const isCurrent = active && production && i === activeIndex;
        const spoken = active && production && i < activeIndex;
        const upcoming = active && production && i > activeIndex;

        return (
          <p
            key={`chapter-line-${i}`}
            className={cn(
              "font-serif text-xl leading-relaxed font-light tracking-wide transition-colors duration-150 md:text-2xl lg:text-[1.65rem] lg:leading-relaxed",
              !active && "text-foreground/85",
              active && !production && "text-foreground/90",
              isCurrent && "text-foreground",
              spoken && "text-foreground/65",
              upcoming && "text-muted-foreground/45",
            )}
          >
            {line}
          </p>
        );
      })}
    </div>
  );
}
