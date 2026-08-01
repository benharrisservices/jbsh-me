"use client";

import { useEffect, useRef, useState } from "react";

const BAR_COUNT = 32;

/**
 * Taps an <audio> element through the Web Audio API and returns live
 * amplitude levels for a reactive waveform. Works with any MP3 dropped
 * into /public/audio without code changes.
 */
export function useAudioAnalyser(
  audio: HTMLAudioElement | null,
  playing: boolean,
) {
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 0.25),
  );
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const tickRef = useRef(0);

  useEffect(() => {
    if (!audio) return;

    const setup = () => {
      if (sourceRef.current) return;
      try {
        const ctx = new AudioContext();
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.82;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        ctxRef.current = ctx;
        sourceRef.current = source;
        analyserRef.current = analyser;
      } catch {
        // Already connected or context unavailable
      }
    };

    setup();
  }, [audio]);

  useEffect(() => {
    const data = new Uint8Array(BAR_COUNT);

    const tick = () => {
      tickRef.current += 1;
      const analyser = analyserRef.current;
      const ctx = ctxRef.current;

      if (playing && analyser && ctx?.state === "running") {
        analyser.getByteFrequencyData(data);
        const next = Array.from({ length: BAR_COUNT }, (_, i) => {
          const idx = Math.floor((i / BAR_COUNT) * data.length);
          return 0.18 + (data[idx] / 255) * 0.82;
        });
        // During pre-roll the element is silent — keep a restrained idle.
        const energy = next.reduce((a, b) => a + b, 0) / next.length;
        if (energy < 0.22) {
          const t = tickRef.current * 0.035;
          setLevels(
            Array.from({ length: BAR_COUNT }, (_, i) => {
              return 0.2 + Math.sin(i * 0.4 + t) * 0.06;
            }),
          );
        } else {
          setLevels(next);
        }
      } else if (playing) {
        const t = tickRef.current * 0.04;
        setLevels(
          Array.from({ length: BAR_COUNT }, (_, i) => {
            const base = 0.22 + Math.sin(i * 0.45 + t) * 0.08;
            return base + Math.sin(t + i * 0.2) * 0.04;
          }),
        );
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  const resumeContext = async () => {
    if (ctxRef.current?.state === "suspended") {
      await ctxRef.current.resume();
    }
  };

  return { levels, resumeContext, barCount: BAR_COUNT };
}
