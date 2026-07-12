"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAudio } from "@/components/providers/audio-provider";
import { Transcript } from "@/components/audio/transcript";

interface NarratedSectionProps {
  id: string;
  number: string;
  title: string;
  subtitle?: string;
  lines: string[];
  children?: React.ReactNode;
  className?: string;
  /** Tall chapters scroll internally before the next snap. */
  scrollable?: boolean;
}

export function NarratedSection({
  id,
  number,
  title,
  subtitle,
  lines,
  children,
  className,
  scrollable = false,
}: NarratedSectionProps) {
  const { activeChapterId, progress, playing } = useAudio();
  const isActive = activeChapterId === id;

  return (
    <section
      id={id}
      className={cn(
        "chapter-scene relative snap-start snap-always px-6 md:px-12 lg:px-24",
        scrollable
          ? "chapter-scene--scrollable min-h-dvh py-20 md:py-24"
          : "flex min-h-dvh flex-col justify-center py-16 md:py-20",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-3xl">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-12 md:mb-16"
        >
          <p className="mb-4 font-mono text-[10px] tracking-[0.35em] text-muted-foreground/80 uppercase">
            {number}
          </p>
          <h2 className="font-serif text-4xl font-light tracking-tight text-foreground md:text-6xl lg:text-7xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-3 text-base font-light tracking-wide text-muted-foreground/80 md:text-lg">
              {subtitle}
            </p>
          )}
        </motion.header>

        <Transcript
          lines={lines}
          progress={isActive ? progress : 0}
          playing={isActive && playing}
          active={isActive}
        />

        {children && <div className="mt-16">{children}</div>}
      </div>
    </section>
  );
}
