"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAudio } from "@/components/providers/audio-provider";
import { finalScreenLines } from "@/content/narrative";

/**
 * Minimal closing screen after Toolkit narration ends.
 */
export function FinalScreen() {
  const { reachedEnd } = useAudio();

  return (
    <AnimatePresence>
      {reachedEnd && (
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
            transition={{ duration: 1.6, delay: 0.8 }}
          >
            {finalScreenLines.map((line, i) => (
              <span key={i}>
                {line}
                {i < finalScreenLines.length - 1 && <br />}
              </span>
            ))}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
