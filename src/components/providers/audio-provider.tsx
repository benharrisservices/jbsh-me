"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getChapter,
  getChapterAudioSrc,
  getChapterTitle,
  getNextAudioChapterId,
} from "@/content/sections";
import { useAudioAnalyser } from "@/hooks/use-audio-analyser";

interface AudioContextValue {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  activeChapterId: string;
  chapterTitle: string;
  playerVisible: boolean;
  playing: boolean;
  ready: boolean;
  missing: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  levels: number[];
  /** True once the final chapter's narration has fully played out. */
  reachedEnd: boolean;
  toggle: () => void;
  seek: (fraction: number) => void;
  setActiveChapter: (id: string) => void;
  unlockPlayer: () => void;
}

const AudioCtx = createContext<AudioContextValue | undefined>(undefined);

function scrollToChapter(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [activeChapterId, setActiveChapterId] = useState("welcome");
  const [playerVisible, setPlayerVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);

  // Refs mirror state so audio event handlers always read current values
  // without re-subscribing on every chapter change.
  const activeIdRef = useRef(activeChapterId);
  const wasPlayingRef = useRef(false);
  const resumeOnLoadRef = useRef(false);
  const advancingRef = useRef(false);

  const { levels, resumeContext } = useAudioAnalyser(audioEl, playing);

  useEffect(() => {
    activeIdRef.current = activeChapterId;
  }, [activeChapterId]);

  useEffect(() => {
    wasPlayingRef.current = playing;
  }, [playing]);

  // Bind to the single, persistent <audio> element. Runs once per element.
  useEffect(() => {
    const audio = audioEl;
    if (!audio) return;

    const onLoaded = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setReady(true);
      setMissing(false);
      if (resumeOnLoadRef.current) {
        resumeOnLoadRef.current = false;
        void audio.play().catch(() => setPlaying(false));
      }
    };
    const onError = () => {
      setMissing(true);
      setReady(false);
      setPlaying(false);
      resumeOnLoadRef.current = false;
    };
    const onTime = () => setCurrentTime(audio.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    // The router: a finished track advances exactly one chapter and keeps
    // narrating. At the last chapter it surrenders to the closing screen.
    const onEnd = () => {
      setPlaying(false);
      const nextId = getNextAudioChapterId(activeIdRef.current);
      if (nextId) {
        advancingRef.current = true;
        resumeOnLoadRef.current = true;
        setActiveChapterId(nextId);
        scrollToChapter(nextId);
      } else {
        setReachedEnd(true);
      }
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("error", onError);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [audioEl]);

  // Pause on the hero; it has no narration track.
  useEffect(() => {
    if (activeChapterId !== "welcome") return;
    audioRef.current?.pause();
  }, [activeChapterId]);

  // Swap the source whenever the active chapter changes. An auto-advance
  // keeps playing; a manual navigation follows whatever was already playing.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!getChapter(activeChapterId)?.hasAudio) return;

    const src = getChapterAudioSrc(activeChapterId);
    const current = audio.getAttribute("src") ?? "";
    if (current.endsWith(src)) return;

    if (!advancingRef.current) {
      resumeOnLoadRef.current = wasPlayingRef.current;
    }
    advancingRef.current = false;

    audio.pause();
    audio.src = src;
    audio.load();
    setCurrentTime(0);
    if (!resumeOnLoadRef.current) setPlaying(false);
  }, [activeChapterId, audioEl]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || missing) return;
    await resumeContext();
    if (audio.paused) {
      void audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [missing, resumeContext]);

  const seek = useCallback(
    (fraction: number) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const clamped = Math.min(Math.max(fraction, 0), 1);
      audio.currentTime = clamped * duration;
      setCurrentTime(audio.currentTime);
    },
    [duration],
  );

  const setActiveChapter = useCallback((id: string) => {
    setActiveChapterId((prev) => (prev === id ? prev : id));
  }, []);

  const unlockPlayer = useCallback(() => {
    setPlayerVisible(true);
  }, []);

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <AudioCtx.Provider
      value={{
        audioRef,
        activeChapterId,
        chapterTitle: getChapterTitle(activeChapterId),
        playerVisible,
        playing,
        ready,
        missing,
        progress,
        currentTime,
        duration,
        levels,
        reachedEnd,
        toggle,
        seek,
        setActiveChapter,
        unlockPlayer,
      }}
    >
      <audio
        ref={(el) => {
          audioRef.current = el;
          setAudioEl(el);
        }}
        preload="metadata"
        className="hidden"
      />
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}
