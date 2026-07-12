"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TranscriptProps {
  lines: string[];
  progress: number;
  playing: boolean;
  active?: boolean;
  className?: string;
}

export function Transcript({
  lines,
  progress,
  playing,
  active = true,
  className,
}: TranscriptProps) {
  const activeRef = useRef<HTMLParagraphElement | null>(null);

  const boundaries = useMemo(() => {
    const weights = lines.map((l) => Math.max(l.length, 8));
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    const cumulative = weights.reduce<number[]>((acc, w) => {
      const prev = acc.length ? acc[acc.length - 1] : 0;
      acc.push(prev + w);
      return acc;
    }, []);
    return cumulative.map((c) => c / total);
  }, [lines]);

  const activeIndex = useMemo(() => {
    if (!active || progress <= 0) return -1;
    for (let i = 0; i < boundaries.length; i++) {
      if (progress <= boundaries[i]) return i;
    }
    return lines.length - 1;
  }, [progress, boundaries, lines.length, active]);

  useEffect(() => {
    if (!playing || activeIndex < 0) return;
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeIndex, playing]);

  return (
    <div className={cn("space-y-4 md:space-y-5", className)}>
      {lines.map((line, i) => {
        const isActive = active && i === activeIndex;
        const isPast = active && activeIndex >= 0 && i < activeIndex;
        const opacity = isActive ? 1 : isPast ? 0.32 : 0.48;

        return (
          <motion.p
            key={i}
            ref={isActive ? activeRef : null}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            animate={{ opacity }}
            transition={{
              opacity: { duration: 1.1, ease: [0.25, 0.1, 0.25, 1] },
              y: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] },
            }}
            className={cn(
              "text-foreground text-xl leading-[1.6] font-light tracking-[-0.01em] md:text-2xl md:leading-[1.6]",
            )}
          >
            {line}
          </motion.p>
        );
      })}
    </div>
  );
}
