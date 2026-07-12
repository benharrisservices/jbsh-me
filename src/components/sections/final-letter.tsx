"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudio } from "@/components/providers/audio-provider";
import { finalLetter } from "@/content/letter";
import { cn } from "@/lib/utils";

export function FinalLetterSection() {
  const { activeChapterId, progress, reachedEnd } = useAudio();
  const isActive = activeChapterId === "letter";
  const [showClosing, setShowClosing] = useState(false);
  const triggeredRef = useRef(false);

  const lines = finalLetter.lines;

  const activeIndex = useMemo(() => {
    if (!isActive || progress <= 0) return -1;
    const idx = Math.floor(progress * lines.length);
    return Math.min(idx, lines.length - 1);
  }, [progress, lines.length, isActive]);

  // The closing screen is a deliberate, once-only moment. It may be reached
  // two ways: by scrolling to the end of the letter, or by the narration
  // playing out. Neither may fire on mount.
  const revealClosing = useCallback(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    setTimeout(() => setShowClosing(true), 2600);
  }, []);

  useEffect(() => {
    if (reachedEnd) revealClosing();
  }, [reachedEnd, revealClosing]);

  return (
    <>
      <section
        id="letter"
        className="chapter-scene relative flex min-h-dvh snap-start snap-always flex-col justify-center px-6 py-32 md:px-12 md:py-40 lg:px-24"
      >
        <div className="mx-auto w-full max-w-2xl">
          <motion.header
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
            className="mb-16"
          >
            <p className="mb-5 font-mono text-[11px] tracking-[0.35em] text-muted-foreground uppercase">
              15
            </p>
            <h2 className="font-serif text-5xl font-light tracking-tight text-foreground md:text-7xl">
              {finalLetter.title}
            </h2>
          </motion.header>

          <div className="space-y-6">
            {lines.map((line, i) => {
              const isLineActive = isActive && i === activeIndex;
              const isPast = isActive && activeIndex >= 0 && i < activeIndex;
              return (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-30px" }}
                  transition={{ duration: 0.5, delay: Math.min(i, 6) * 0.05 }}
                  animate={{
                    opacity: isLineActive ? 1 : isPast ? 0.32 : 0.7,
                  }}
                  className={cn(
                    "text-lg leading-relaxed font-light tracking-tight md:text-xl md:leading-relaxed",
                    isLineActive && "text-foreground",
                    isPast && "text-foreground/40",
                    !isLineActive && !isPast && "text-foreground/70",
                  )}
                >
                  {line}
                </motion.p>
              );
            })}
          </div>

          {/* Only a genuine scroll to the very end reveals the closing. */}
          <motion.div
            aria-hidden
            className="h-px w-full"
            onViewportEnter={revealClosing}
            viewport={{ once: true, margin: "-40% 0px -10% 0px" }}
          />
        </div>
      </section>

      <AnimatePresence>
        {showClosing && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <motion.p
              className="max-w-md px-8 text-center font-serif text-xl leading-relaxed font-light text-white/70 md:text-2xl"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.6, delay: 1 }}
            >
              {finalLetter.closing.split("\n").map((line, i) => (
                <span key={i}>
                  {line}
                  {i === 0 && <br />}
                </span>
              ))}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
