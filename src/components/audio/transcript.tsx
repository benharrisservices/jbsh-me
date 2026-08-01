"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  type ChapterCues,
  activeContentLineIndex,
  hasProductionLineCues,
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
 *
 * Highlight + scroll are driven only by this chapter's cue timings mapped
 * onto displayed content lines (no cumulative offsets across chapters).
 */
export function Transcript({
  lines,
  currentTime,
  cues,
  playing,
  active,
}: TranscriptProps) {
  const production = hasProductionLineCues(cues);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const activeIndex = useMemo(() => {
    if (!active || !production || !cues) return -1;
    return activeContentLineIndex(lines, cues, currentTime);
  }, [active, production, cues, lines, currentTime]);

  useEffect(() => {
    if (!active || !playing || activeIndex < 0) return;
    const el = lineRefs.current[activeIndex];
    if (!el) return;
    el.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }, [activeIndex, active, playing]);

  return (
    <div className="space-y-5 md:space-y-6" aria-live="polite">
      {lines.map((line, i) => {
        const isCurrent = active && production && i === activeIndex;
        const spoken = active && production && i < activeIndex;
        const upcoming = active && production && i > activeIndex;

        return (
          <p
            key={`chapter-line-${i}`}
            ref={(node) => {
              lineRefs.current[i] = node;
            }}
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
