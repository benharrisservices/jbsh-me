"use client";

import { Pause, Play } from "lucide-react";
import { motion } from "framer-motion";
import { useAudio } from "@/components/providers/audio-provider";
import { ReactiveWaveform } from "@/components/audio/reactive-waveform";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function GlobalPlayer() {
  const {
    activeChapterId,
    playerVisible,
    chapterTitle,
    playing,
    prerolling,
    toggle,
    seek,
    progress,
    currentTime,
    duration,
    levels,
    missing,
  } = useAudio();

  const canPlay = activeChapterId !== "welcome" && !missing;
  const live = playing || prerolling;

  return (
    <>
      {playerVisible && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-full border border-foreground/[0.06] bg-background/70 px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          aria-label="Chapter narration"
        >
          <motion.button
            onClick={toggle}
            whileTap={{ scale: 0.94 }}
            disabled={!canPlay}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:text-foreground disabled:opacity-30"
            aria-label={
              canPlay
                ? live
                  ? `Pause ${chapterTitle}`
                  : `Play ${chapterTitle}`
                : chapterTitle
            }
          >
            {live ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3 translate-x-[0.5px]" />
            )}
          </motion.button>

          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-[10px] tracking-[0.12em] text-foreground/50 uppercase">
              {chapterTitle}
            </p>
          </div>

          <ReactiveWaveform
            levels={levels}
            progress={progress}
            playing={live}
            onSeek={seek}
            className="w-16 sm:w-20"
            barCount={24}
          />

          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
            {formatTime(currentTime)}
            <span className="text-foreground/15">/</span>
            {formatTime(duration)}
          </span>
        </motion.div>
      )}
    </>
  );
}
