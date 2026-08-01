"use client";

import { Pause, Play } from "lucide-react";
import { useAudio } from "@/components/providers/audio-provider";
import { cn } from "@/lib/utils";

interface SectionPlayButtonProps {
  sectionId: string;
  title: string;
  className?: string;
}

/**
 * Compact title-side play/pause for narrated sections.
 * Shares the single persistent audio element with the bottom-right player.
 */
export function SectionPlayButton({
  sectionId,
  title,
  className,
}: SectionPlayButtonProps) {
  const {
    activeChapterId,
    playing,
    prerolling,
    missing,
    playSection,
    toggle,
  } = useAudio();

  const isActive = activeChapterId === sectionId;
  const live = isActive && (playing || prerolling);
  const label = live ? `Pause ${title}` : `Play ${title}`;

  const onActivate = () => {
    if (isActive) {
      void toggle();
      return;
    }
    void playSection(sectionId);
  };

  return (
    <button
      type="button"
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
      disabled={isActive && missing}
      className={cn(
        "mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground/35 transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30 disabled:opacity-30 md:mt-3",
        className,
      )}
      aria-label={label}
    >
      {live ? (
        <Pause className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Play className="h-3.5 w-3.5 translate-x-[0.5px]" aria-hidden />
      )}
    </button>
  );
}
