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
import { NARRATION_PREROLL_MS, applyNarrationPlaybackRate, waitForAudioCanPlay } from "@/lib/audio";
import { useAudioAnalyser } from "@/hooks/use-audio-analyser";

interface AudioContextValue {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  activeChapterId: string;
  chapterTitle: string;
  playerVisible: boolean;
  narrationStarted: boolean;
  prerolling: boolean;
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
  /** Hero primary action: pre-roll, then start Identity narration. */
  startNarration: () => void;
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
  const [narrationStarted, setNarrationStarted] = useState(false);
  const [prerolling, setPrerolling] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);

  const activeIdRef = useRef(activeChapterId);
  const wasPlayingRef = useRef(false);
  const resumeOnLoadRef = useRef(false);
  const advancingRef = useRef(false);
  const pendingPrerollRef = useRef(false);
  const prerollGenRef = useRef(0);

  const live = playing || prerolling;
  const { levels, resumeContext } = useAudioAnalyser(audioEl, live);

  useEffect(() => {
    activeIdRef.current = activeChapterId;
  }, [activeChapterId]);

  useEffect(() => {
    wasPlayingRef.current = playing;
  }, [playing]);

  const playFromStartWithPreroll = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    const gen = ++prerollGenRef.current;

    try {
      await waitForAudioCanPlay(audio);
      if (gen !== prerollGenRef.current) return;
      await resumeContext();
      if (gen !== prerollGenRef.current) return;
      applyNarrationPlaybackRate(audio);

      audio.currentTime = 0;
      setCurrentTime(0);
      setPrerolling(true);

      await new Promise((r) => setTimeout(r, NARRATION_PREROLL_MS));
      if (gen !== prerollGenRef.current) return;

      await resumeContext();
      applyNarrationPlaybackRate(audio);
      audio.currentTime = 0;
      setCurrentTime(0);
      await audio.play();
    } catch {
      setPlaying(false);
      setPrerolling(false);
    }
  }, [resumeContext]);

  useEffect(() => {
    const audio = audioEl;
    if (!audio) return;

    const onLoaded = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setReady(true);
      setMissing(false);
      applyNarrationPlaybackRate(audio);

      if (pendingPrerollRef.current) {
        pendingPrerollRef.current = false;
        resumeOnLoadRef.current = false;
        void playFromStartWithPreroll();
        return;
      }

      if (resumeOnLoadRef.current) {
        resumeOnLoadRef.current = false;
        applyNarrationPlaybackRate(audio);
        void audio.play().catch(() => setPlaying(false));
      }
    };
    const onError = () => {
      setMissing(true);
      setReady(false);
      setPlaying(false);
      setPrerolling(false);
      resumeOnLoadRef.current = false;
      pendingPrerollRef.current = false;
    };
    const onTime = () => setCurrentTime(audio.currentTime);
    const onPlay = () => {
      setPlaying(true);
      setPrerolling(false);
    };
    const onPause = () => setPlaying(false);

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
    audio.addEventListener("canplay", onLoaded);
    audio.addEventListener("error", onError);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("canplay", onLoaded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [audioEl, playFromStartWithPreroll]);

  // Pause when parked on the silent hero (before narration starts).
  useEffect(() => {
    if (activeChapterId !== "welcome") return;
    if (pendingPrerollRef.current) return;
    audioRef.current?.pause();
  }, [activeChapterId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!getChapter(activeChapterId)?.hasAudio) return;

    const src = getChapterAudioSrc(activeChapterId);
    const current = audio.getAttribute("src") ?? "";
    if (current.endsWith(src)) {
      if (pendingPrerollRef.current && audio.readyState >= 2) {
        pendingPrerollRef.current = false;
        void playFromStartWithPreroll();
      }
      return;
    }

    if (!advancingRef.current && !pendingPrerollRef.current) {
      resumeOnLoadRef.current = wasPlayingRef.current;
    }
    advancingRef.current = false;

    prerollGenRef.current += 1;
    setPrerolling(false);
    audio.pause();
    audio.src = src;
    applyNarrationPlaybackRate(audio);
    audio.load();
    setCurrentTime(0);
    if (!resumeOnLoadRef.current && !pendingPrerollRef.current) {
      setPlaying(false);
    }
  }, [activeChapterId, audioEl, playFromStartWithPreroll]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || missing) return;
    if (activeIdRef.current === "welcome") return;

    await resumeContext();
    if (audio.paused) {
      const nearEnd =
        audio.ended ||
        (Number.isFinite(audio.duration) &&
          audio.currentTime >= audio.duration - 0.05);
      const atStart = audio.currentTime < 0.05 || nearEnd;
      if (nearEnd) {
        audio.currentTime = 0;
        setCurrentTime(0);
      }
      applyNarrationPlaybackRate(audio);
      if (atStart) {
        void playFromStartWithPreroll();
      } else {
        void audio.play().catch(() => setPlaying(false));
      }
    } else {
      prerollGenRef.current += 1;
      setPrerolling(false);
      audio.pause();
    }
  }, [missing, resumeContext, playFromStartWithPreroll]);

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

  const setActiveChapter = useCallback((id: string) => {
    setActiveChapterId((prev) => (prev === id ? prev : id));
  }, []);

  const unlockPlayer = useCallback(() => {
    if (!narrationStarted) return;
    setPlayerVisible(true);
  }, [narrationStarted]);

  const startNarration = useCallback(() => {
    if (narrationStarted) return;
    setNarrationStarted(true);
    setPlayerVisible(true);
    pendingPrerollRef.current = true;
    scrollToChapter("identity");

    const identitySrc = getChapterAudioSrc("identity");
    const audio = audioRef.current;
    const alreadyIdentity =
      activeIdRef.current === "identity" &&
      !!audio &&
      (audio.getAttribute("src") ?? "").endsWith(identitySrc);

    if (alreadyIdentity) {
      pendingPrerollRef.current = false;
      void playFromStartWithPreroll();
      return;
    }

    setActiveChapterId("identity");
  }, [narrationStarted, playFromStartWithPreroll]);

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <AudioCtx.Provider
      value={{
        audioRef,
        activeChapterId,
        chapterTitle: getChapterTitle(activeChapterId),
        playerVisible,
        narrationStarted,
        prerolling,
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
        startNarration,
      }}
    >
      <audio
        ref={(el) => {
          audioRef.current = el;
          if (el) applyNarrationPlaybackRate(el);
          setAudioEl(el);
        }}
        preload="auto"
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
