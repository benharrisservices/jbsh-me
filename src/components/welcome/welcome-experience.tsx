"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { Transcript } from "@/components/audio/transcript";
import { ReactiveWaveform } from "@/components/audio/reactive-waveform";
import {
  NARRATION_PREROLL_MS,
  WELCOME_NARRATION_ID,
  narrationAudioSrc,
  waitForAudioCanPlay,
} from "@/lib/audio";
import { welcomeLines } from "@/content/welcome";
import { useChapterCues } from "@/hooks/use-chapter-cues";
import { useAudioAnalyser } from "@/hooks/use-audio-analyser";

interface WelcomeExperienceProps {
  onComplete: () => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Cinematic welcome intro — separate from the main site.
 * Cue-driven line reveal, 1.5s pre-roll, bottom-right visualizer.
 */
export function WelcomeExperience({ onComplete }: WelcomeExperienceProps) {
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [prerolling, setPrerolling] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const startingRef = useRef(false);
  const { cues } = useChapterCues(WELCOME_NARRATION_ID);
  const src = narrationAudioSrc(WELCOME_NARRATION_ID);

  const live = playing || prerolling;
  const { levels, resumeContext } = useAudioAnalyser(audioEl, live);

  const finish = useCallback(() => {
    setIsExiting(true);
    setTimeout(onComplete, 1500);
  }, [onComplete]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0.5) {
        setDuration(audio.duration);
        setMediaReady(true);
      }
    };
    const onError = () => setTimeout(finish, 1200);
    const onTime = () => setCurrentTime(audio.currentTime);
    const onPlay = () => {
      setPlaying(true);
      setPrerolling(false);
    };
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      setTimeout(finish, 1600);
    };

    audio.addEventListener("error", onError);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("canplaythrough", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnd);
    audio.preload = "auto";
    audio.src = src;
    audio.load();

    return () => {
      audio.removeEventListener("error", onError);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("canplaythrough", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnd);
    };
  }, [src, finish]);

  const startIntro = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || startingRef.current || isExiting) return;
    startingRef.current = true;
    setStarted(true);

    try {
      await waitForAudioCanPlay(audio);
      await resumeContext();
      audio.currentTime = 0;
      setCurrentTime(0);
      setPrerolling(true);
      await new Promise((r) => setTimeout(r, NARRATION_PREROLL_MS));
      if (isExiting) return;
      await resumeContext();
      audio.currentTime = 0;
      setCurrentTime(0);
      await audio.play();
    } catch {
      startingRef.current = false;
      setPrerolling(false);
      setStarted(false);
    }
  }, [resumeContext, isExiting]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !started) {
      void startIntro();
      return;
    }
    await resumeContext();
    if (audio.paused) {
      const atStart =
        audio.ended ||
        audio.currentTime < 0.05 ||
        (Number.isFinite(audio.duration) &&
          audio.currentTime >= audio.duration - 0.05);
      if (atStart) {
        startingRef.current = false;
        setPrerolling(false);
        void startIntro();
        return;
      }
      void audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [started, startIntro, resumeContext]);

  const seek = useCallback(
    (fraction: number) => {
      const audio = audioRef.current;
      if (!audio || !duration || prerolling) return;
      const clamped = Math.min(Math.max(fraction, 0), 1);
      audio.currentTime = clamped * duration;
      setCurrentTime(audio.currentTime);
    },
    [duration, prerolling],
  );

  const progress = duration > 0 ? currentTime / duration : 0;
  const showPlayer = started;

  return (
    <AnimatePresence>
      {!isExiting ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <audio
            ref={(el) => {
              audioRef.current = el;
              setAudioEl(el);
            }}
            preload="auto"
            className="hidden"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />

          <motion.div
            className="max-w-lg px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.25 }}
          >
            <Transcript
              lines={[...welcomeLines]}
              currentTime={currentTime}
              cues={cues}
              progress={progress}
              playing={playing}
              active
              progressive
              className="text-center [&_p]:text-white/80"
            />
          </motion.div>

          <AnimatePresence>
            {!started && (
              <motion.button
                type="button"
                onClick={() => void startIntro()}
                disabled={!mediaReady}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
                className="absolute bottom-[22%] left-1/2 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/80 backdrop-blur-md transition-colors hover:border-white/25 hover:bg-white/[0.1] hover:text-white disabled:opacity-40 md:h-[4.5rem] md:w-[4.5rem]"
                aria-label="Play welcome narration"
              >
                <Play className="h-5 w-5 translate-x-[1px]" strokeWidth={1.5} />
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showPlayer && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
                className="fixed bottom-5 right-5 z-[60] flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl"
                aria-label="Welcome narration"
              >
                <motion.button
                  type="button"
                  onClick={() => void toggle()}
                  whileTap={{ scale: 0.94 }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:text-white"
                  aria-label={playing ? "Pause welcome" : "Play welcome"}
                >
                  {playing || prerolling ? (
                    <Pause className="h-3 w-3" />
                  ) : (
                    <Play className="h-3 w-3 translate-x-[0.5px]" />
                  )}
                </motion.button>

                <div className="hidden min-w-0 sm:block">
                  <p className="truncate text-[10px] tracking-[0.12em] text-white/45 uppercase">
                    Welcome
                  </p>
                </div>

                <ReactiveWaveform
                  levels={levels}
                  progress={progress}
                  playing={live}
                  onSeek={seek}
                  onDark
                  className="w-16 sm:w-20"
                  barCount={24}
                />

                <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/40">
                  {formatTime(currentTime)}
                  <span className="text-white/15">/</span>
                  {formatTime(duration)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          className="fixed inset-0 z-50 bg-black"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
        />
      )}
    </AnimatePresence>
  );
}
