"use client";

import { motion } from "framer-motion";
import { SITE } from "@/lib/constants";

export function HeroSection() {
  const handleDoubleClick = () => {
    const handler = (window as unknown as Record<string, () => void>)
      .__jbshLogoDblClick;
    handler?.();
  };

  return (
    <section
      id="welcome"
      className="chapter-scene relative flex h-dvh snap-start snap-always items-center justify-center px-6"
    >
      <div className="text-center">
        <motion.h1
          onDoubleClick={handleDoubleClick}
          className="cursor-default font-serif text-7xl font-light tracking-tight text-foreground select-none md:text-9xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {SITE.title}
        </motion.h1>

        <motion.p
          className="mt-10 font-sans text-[11px] font-normal tracking-[0.28em] text-foreground/40 uppercase md:mt-12 md:text-xs md:tracking-[0.32em]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.6 }}
        >
          {SITE.subtitle}
        </motion.p>

        <motion.p
          className="mt-3 font-sans text-[10px] font-light tracking-[0.2em] text-foreground/25 md:text-[11px] md:tracking-[0.24em]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.85 }}
        >
          {SITE.tagline}
        </motion.p>

        <motion.div
          className="mt-24 flex justify-center md:mt-28"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 1.2 }}
        >
          <motion.div
            className="h-10 w-px bg-foreground/12"
            animate={{ scaleY: [1, 0.45, 1], opacity: [0.4, 0.15, 0.4] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "top" }}
          />
        </motion.div>
      </div>
    </section>
  );
}
