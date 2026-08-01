"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FIRST_JOURNEY_CHAPTER_ID } from "@/content/narrative";
import { CLOSING_SECTION_ID } from "@/content/sections";

/**
 * Fixed bottom-left control while viewing Toolkit or Closing.
 * Smoothly returns to Health (Rule One) without starting narration.
 */
export function BackToRuleOne() {
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const update = () => {
      const toolkit = document.getElementById("toolkit");
      const closing = document.getElementById(CLOSING_SECTION_ID);
      if (!toolkit) {
        setVisible(false);
        return;
      }

      const vh = window.innerHeight || 1;
      const tRect = toolkit.getBoundingClientRect();
      const cRect = closing?.getBoundingClientRect();

      const toolkitReached =
        tRect.top < vh * 0.55 && tRect.bottom > 64;
      const closingReached = cRect
        ? cRect.top < vh && cRect.bottom > 0
        : false;
      const aboveToolkit = tRect.top > vh * 0.7;

      setVisible(!aboveToolkit && (toolkitReached || closingReached));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const goToHealth = () => {
    const el = document.getElementById(FIRST_JOURNEY_CHAPTER_ID);
    if (!el) return;

    const toolkit = document.getElementById("toolkit");
    if (toolkit) toolkit.scrollTop = 0;

    // Temporarily disable CSS snap so a long jump lands flush at Health.
    const html = document.documentElement;
    const previousSnap = html.style.scrollSnapType;
    html.style.scrollSnapType = "none";

    const hardAlign = () => {
      const y = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: y, behavior: "auto" });
    };

    if (reduceMotion) {
      hardAlign();
      html.style.scrollSnapType = previousSnap;
      return;
    }

    const y = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: y, behavior: "smooth" });
    window.setTimeout(() => {
      hardAlign();
      html.style.scrollSnapType = previousSnap;
    }, 850);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          transition={{
            duration: reduceMotion ? 0.12 : 0.45,
            ease: [0.25, 0.1, 0.25, 1],
          }}
          onClick={goToHealth}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              goToHealth();
            }
          }}
          className="pointer-events-auto fixed bottom-5 left-5 z-[70] max-w-[calc(100vw-11rem)] rounded-full border border-foreground/[0.06] bg-background/70 px-3.5 py-2 text-[11px] tracking-[0.12em] text-foreground/55 uppercase shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-colors hover:text-foreground/85 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30 dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
          aria-label="Back to Rule One — Health"
        >
          Back to Rule One
        </motion.button>
      )}
    </AnimatePresence>
  );
}
