"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAudio } from "@/components/providers/audio-provider";
import { useChapterCues } from "@/hooks/use-chapter-cues";
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
  const { activeChapterId, progress, playing, currentTime } = useAudio();
  const isChapter = activeChapterId === id;
  const { cues } = useChapterCues(id);

  return (
    <section
      id={id}
      className={cn(
        "chapter-scene chapter-scene--scrollable relative flex min-h-dvh snap-start snap-always flex-col px-6 md:px-12 lg:px-24",
        scrollable ? "py-20 md:py-24" : "py-16 md:py-20",
        className,
      )}
    >
      <div className={cn("mx-auto w-full max-w-3xl", !scrollable && "my-auto")}>
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
          currentTime={isChapter ? currentTime : 0}
          cues={cues}
          progress={isChapter ? progress : 0}
          playing={isChapter && playing}
          active={isChapter}
        />

        {children && <div className="mt-16">{children}</div>}
      </div>
    </section>
  );
}
