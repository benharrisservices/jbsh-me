"use client";

import { useEffect, useRef, useState } from "react";
import { finalScreenLines } from "@/content/narrative";
import { CLOSING_SECTION_ID } from "@/content/sections";

/**
 * Final full-viewport section in normal document flow — never a modal/overlay.
 * Opacity is driven by scroll position relative to the viewport centre.
 */
export function FinalScreen() {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const sectionCenter = rect.top + rect.height / 2;
      const viewCenter = vh / 2;
      const distance = Math.abs(sectionCenter - viewCenter);
      // Fully visible when centred; fades as the section leaves the midpoint.
      const next = 1 - Math.min(1, Math.max(0, distance / (vh * 0.55)));
      setProgress(next);
    };

    const onScrollOrResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, []);

  const opacity = progress;
  const translateY = reduceMotion ? 0 : (1 - progress) * 14;

  return (
    <section
      id={CLOSING_SECTION_ID}
      ref={sectionRef}
      className="chapter-scene relative flex min-h-dvh snap-start snap-always items-center justify-center bg-black px-6"
      aria-label="Closing"
    >
      <p
        className="max-w-md px-8 text-center font-serif text-xl leading-relaxed font-light text-white/70 md:text-2xl"
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          // Scroll-driven; avoid timed transitions fighting the scroll position.
          transition: reduceMotion ? "opacity 80ms linear" : undefined,
          willChange: "opacity, transform",
          pointerEvents: "none",
        }}
      >
        {finalScreenLines.map((line, i) => (
          <span key={i}>
            {line}
            {i < finalScreenLines.length - 1 && <br />}
          </span>
        ))}
      </p>
    </section>
  );
}
