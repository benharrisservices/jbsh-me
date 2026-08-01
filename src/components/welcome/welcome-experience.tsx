"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Transcript } from "@/components/audio/transcript";
import {
  WELCOME_NARRATION_ID,
  narrationAudioSrc,
} from "@/lib/audio";
import { welcomeLines } from "@/content/welcome";
import { useChapterCues } from "@/hooks/use-chapter-cues";

interface WelcomeExperienceProps {
  onComplete: () => void;
}

/**
 * Welcome intro: production audio + cue-driven transcript.
 */
export function WelcomeExperience({ onComplete }: WelcomeExperienceProps) {
  const [ready, setReady] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const { cues } = useChapterCues(WELCOME_NARRATION_ID);
  const src = narrationAudioSrc(WELCOME_NARRATION_ID);

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
        setReady(true);
        void audio.play().catch(() => {
          // Autoplay blocked — still show transcript; user can wait or refresh.
          setReady(true);
        });
      }
    };
    const onError = () => {
      // Production welcome.mp3 is required; fail closed to site after a beat.
      setTimeout(finish, 1200);
    };
    const onTime = () => setCurrentTime(audio.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      setTimeout(finish, 2000);
    };

    audio.addEventListener("error", onError);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnd);
    audio.src = src;
    audio.load();

    return () => {
      audio.removeEventListener("error", onError);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnd);
    };
  }, [src, finish]);

  const progress = duration > 0 ? currentTime / duration : 0;

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
          <audio ref={audioRef} preload="auto" className="hidden" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />

          <motion.div
            className="max-w-lg px-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: ready ? 1 : 0 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            <Transcript
              lines={[...welcomeLines]}
              currentTime={currentTime}
              cues={cues}
              progress={progress}
              playing={playing}
              active={ready}
              className="text-center [&_p]:text-white/80"
            />
          </motion.div>
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
