"use client";

import { cn } from "@/lib/utils";

interface ReactiveWaveformProps {
  levels: number[];
  progress: number;
  playing: boolean;
  onSeek?: (fraction: number) => void;
  className?: string;
  barCount?: number;
  /** Use light bars on dark surfaces (intro). */
  onDark?: boolean;
}

export function ReactiveWaveform({
  levels,
  progress,
  playing,
  onSeek,
  className,
  barCount = 32,
  onDark = false,
}: ReactiveWaveformProps) {
  const bars = levels.length ? levels : Array(barCount).fill(0.25);

  const seekFromClientX = (clientX: number, el: HTMLDivElement) => {
    if (!onSeek) return;
    const rect = el.getBoundingClientRect();
    onSeek((clientX - rect.left) / rect.width);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onSeek(Math.min(progress + 0.05, 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSeek(Math.max(progress - 0.05, 0));
    }
  };

  return (
    <div
      className={cn(
        "flex h-5 items-center gap-[1.5px]",
        onSeek && "cursor-pointer",
        className,
      )}
      onClick={(e) => seekFromClientX(e.clientX, e.currentTarget)}
      onKeyDown={handleKeyDown}
      role={onSeek ? "slider" : undefined}
      aria-label={onSeek ? "Seek" : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
      tabIndex={onSeek ? 0 : undefined}
    >
      {bars.slice(0, barCount).map((level, i) => {
        const played = i / barCount <= progress;
        const height = playing ? level : level * 0.65;
        return (
          <span
            key={i}
            className={cn(
              "w-[1.5px] rounded-full transition-all duration-150 ease-out",
              onDark
                ? played
                  ? "bg-white/70"
                  : "bg-white/20"
                : played
                  ? "bg-foreground/65"
                  : "bg-foreground/18",
            )}
            style={{
              height: `${height * 100}%`,
              opacity: playing ? 0.85 + height * 0.15 : 0.5,
            }}
          />
        );
      })}
    </div>
  );
}
