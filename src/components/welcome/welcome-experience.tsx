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
import { WelcomeTimedFallback } from "@/components/welcome/welcome-timed-fallback";

interface WelcomeExperienceProps {
  onComplete: () => void;
}

type WelcomeMode = "probing" | "audio" | "timed";

/**
 * Welcome intro: production audio + cues when welcome.mp3 exists,
 * otherwise isolated timed fallback.
 */
export function WelcomeExperience({ onComplete }: WelcomeExperienceProps) {
  const [mode, setMode] = useState<WelcomeMode>("probing");
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

    const onCanPlay = () => setMode("audio");
    const onError = () => setMode("timed");
    const onLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0.5) {
        setDuration(audio.duration);
        setMode("audio");
        void audio.play().catch(() => setMode("timed"));
      } else {
        setMode("timed");
      }
    };
    const onTime = () => setCurrentTime(audio.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      setTimeout(finish, 2000);
    };

    audio.addEventListener("canplaythrough", onCanPlay);
    audio.addEventListener("error", onError);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnd);
    audio.src = src;
    audio.load();

    const probeTimer = setTimeout(() => {
      if (audio.error || audio.readyState < 2) setMode("timed");
    }, 4000);

    return () => {
      clearTimeout(probeTimer);
      audio.removeEventListener("canplaythrough", onCanPlay);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnd);
    };
  }, [src, finish]);

  if (mode === "timed") {
    return <WelcomeTimedFallback onComplete={onComplete} />;
  }

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

          {(mode === "audio" || mode === "probing") && (
            <motion.div
              className="max-w-lg px-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: mode === "audio" ? 1 : 0 }}
              transition={{ duration: 1, delay: 0.3 }}
            >
              <Transcript
                lines={[...welcomeLines]}
                currentTime={currentTime}
                cues={cues}
                progress={progress}
                playing={playing}
                active={mode === "audio"}
                className="text-center [&_p]:text-white/80"
              />
            </motion.div>
          )}
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
