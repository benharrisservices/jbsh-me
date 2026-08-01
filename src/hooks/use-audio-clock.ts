"use client";

import { useEffect, useRef, useState } from "react";

/**
 * High-frequency audio clock driven by audio.currentTime via rAF.
 * Master clock for transcript highlighting — never wall-clock based.
 */
export function useAudioClock(
  audio: HTMLAudioElement | null,
  playing: boolean,
): number {
  const [currentTime, setCurrentTime] = useState(0);
  const rafRef = useRef(0);
  const lastRef = useRef(-1);

  useEffect(() => {
    if (!audio) {
      lastRef.current = -1;
      const id = requestAnimationFrame(() => setCurrentTime(0));
      return () => cancelAnimationFrame(id);
    }

    const publish = (force = false) => {
      const t = audio.currentTime;
      if (force || Math.abs(t - lastRef.current) >= 0.008) {
        lastRef.current = t;
        setCurrentTime(t);
      }
    };

    const boot = requestAnimationFrame(() => {
      publish(true);
      if (!playing) return;
      const tick = () => {
        publish();
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(boot);
      cancelAnimationFrame(rafRef.current);
    };
  }, [audio, playing]);

  useEffect(() => {
    if (!audio) return;
    const reset = () => {
      lastRef.current = -1;
      setCurrentTime(audio.currentTime || 0);
    };
    audio.addEventListener("seeked", reset);
    audio.addEventListener("loadedmetadata", reset);
    audio.addEventListener("loadstart", reset);
    audio.addEventListener("emptied", reset);
    return () => {
      audio.removeEventListener("seeked", reset);
      audio.removeEventListener("loadedmetadata", reset);
      audio.removeEventListener("loadstart", reset);
      audio.removeEventListener("emptied", reset);
    };
  }, [audio]);

  return currentTime;
}

/** Wait one or more animation frames after readiness before play(). */
export function waitAnimationFrames(count = 1): Promise<void> {
  return new Promise((resolve) => {
    const step = (n: number) => {
      if (n <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(n - 1));
    };
    step(count);
  });
}
