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
  FIRST_JOURNEY_CHAPTER_ID,
  getChapter,
  getChapterAudioSrc,
  getChapterTitle,
  getNextAudioChapterId,
} from "@/content/sections";
import {
  applyNarrationPlaybackRate,
  waitForAudioCanPlayThrough,
} from "@/lib/audio";
import { ensureChapterCues } from "@/hooks/use-chapter-cues";
import { useAudioAnalyser } from "@/hooks/use-audio-analyser";
import { useAudioClock, waitAnimationFrames } from "@/hooks/use-audio-clock";

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
  /** Hero primary action: start Health narration (continuous journey). */
  startNarration: () => void;
}

const AudioCtx = createContext<AudioContextValue | undefined>(undefined);

/** Pause after `ended` before replacing src so trailing samples finish cleanly. */
const CHAPTER_END_SAFETY_MS = 500;

function scrollToChapter(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
  const [duration, setDuration] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);

  const activeIdRef = useRef(activeChapterId);
  const wasPlayingRef = useRef(false);
  const resumeOnLoadRef = useRef(false);
  const advancingRef = useRef(false);
  const pendingStartRef = useRef(false);
  const prerollingRef = useRef(false);
  const narrationStartedRef = useRef(false);
  const startGenRef = useRef(0);
  const advanceFromEndedRef = useRef<() => void>(() => {});
  const endedBoundRef = useRef(false);

  const live = playing || prerolling;
  const { levels, resumeContext } = useAudioAnalyser(audioEl, live);
  const currentTime = useAudioClock(audioEl, live);

  useEffect(() => {
    activeIdRef.current = activeChapterId;
  }, [activeChapterId]);

  useEffect(() => {
    wasPlayingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    prerollingRef.current = prerolling;
  }, [prerolling]);

  useEffect(() => {
    narrationStartedRef.current = narrationStarted;
  }, [narrationStarted]);

  /**
   * Reliable start: metadata → canplaythrough → rate 1.0 → currentTime 0 →
   * AudioContext/analyser → two rAFs → play.
   */
  const startPlaybackReady = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    const gen = ++startGenRef.current;

    try {
      setPrerolling(true);

      const chapterId = audio.dataset.chapterId || activeIdRef.current;
      await ensureChapterCues(chapterId).catch(() => null);
      if (gen !== startGenRef.current) return;

      if (audio.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise<void>((resolve, reject) => {
          const onMeta = () => {
            cleanup();
            resolve();
          };
          const onErr = () => {
            cleanup();
            reject(new Error("Audio metadata failed"));
          };
          const cleanup = () => {
            audio.removeEventListener("loadedmetadata", onMeta);
            audio.removeEventListener("error", onErr);
          };
          audio.addEventListener("loadedmetadata", onMeta, { once: true });
          audio.addEventListener("error", onErr, { once: true });
        });
        if (gen !== startGenRef.current) return;
      }

      await waitForAudioCanPlayThrough(audio);
      if (gen !== startGenRef.current) return;

      applyNarrationPlaybackRate(audio);
      audio.currentTime = 0;

      await resumeContext();
      if (gen !== startGenRef.current) return;

      await waitAnimationFrames(2);
      if (gen !== startGenRef.current) return;

      applyNarrationPlaybackRate(audio);
      setReady(true);
      await audio.play();
      applyNarrationPlaybackRate(audio);
    } catch {
      if (gen === startGenRef.current) {
        setPlaying(false);
        setPrerolling(false);
        advancingRef.current = false;
      }
    }
  }, [resumeContext]);

  const advanceFromEnded = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (advancingRef.current) return;
    setPlaying(false);
    const endedId = audio.dataset.chapterId || activeIdRef.current;
    const nextId = getNextAudioChapterId(endedId);
    if (!nextId) {
      setReachedEnd(true);
      return;
    }
    advancingRef.current = true;
    void (async () => {
      // Keep element + analyser graph intact; do not swap src this turn.
      await delay(CHAPTER_END_SAFETY_MS);
      resumeOnLoadRef.current = true;
      // Prefetch next cues before swapping source.
      await ensureChapterCues(nextId).catch(() => null);
      setActiveChapterId(nextId);
      scrollToChapter(nextId);
    })();
  }, []);

  useEffect(() => {
    advanceFromEndedRef.current = advanceFromEnded;
  }, [advanceFromEnded]);

  useEffect(() => {
    const audio = audioEl;
    if (!audio) return;

    const onLoaded = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setMissing(false);
      applyNarrationPlaybackRate(audio);

      const shouldStart =
        pendingStartRef.current || resumeOnLoadRef.current;
      if (!shouldStart) {
        setReady(true);
        return;
      }

      const chapterId = audio.dataset.chapterId || activeIdRef.current;
      pendingStartRef.current = false;
      resumeOnLoadRef.current = false;
      void (async () => {
        await ensureChapterCues(chapterId).catch(() => null);
        if (audio.dataset.chapterId !== chapterId) return;
        await startPlaybackReady();
      })();
    };
    const onError = () => {
      setMissing(true);
      setReady(false);
      setPlaying(false);
      setPrerolling(false);
      advancingRef.current = false;
      resumeOnLoadRef.current = false;
      pendingStartRef.current = false;
    };
    const onPlay = () => {
      applyNarrationPlaybackRate(audio);
      advancingRef.current = false;
      setPlaying(true);
      setPrerolling(false);
      setReady(true);
    };
    const onPause = () => setPlaying(false);
    const onEnd = () => advanceFromEnded();

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("canplay", onLoaded);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("canplay", onLoaded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [audioEl, startPlaybackReady, advanceFromEnded]);

  // Pause when parked on the silent hero (before narration starts).
  useEffect(() => {
    if (activeChapterId !== "welcome") return;
    if (pendingStartRef.current) return;
    audioRef.current?.pause();
  }, [activeChapterId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!getChapter(activeChapterId)?.hasAudio) return;

    const src = getChapterAudioSrc(activeChapterId);
    const current = audio.getAttribute("src") ?? "";
    if (current.endsWith(src)) {
      if (pendingStartRef.current && audio.readyState >= 2) {
        pendingStartRef.current = false;
        void startPlaybackReady();
      }
      return;
    }

    if (!advancingRef.current && !pendingStartRef.current) {
      resumeOnLoadRef.current = wasPlayingRef.current;
    }

    startGenRef.current += 1;
    setPrerolling(false);
    audio.pause();
    audio.dataset.chapterId = activeChapterId;
    audio.src = src;
    applyNarrationPlaybackRate(audio);
    audio.load();
    if (!resumeOnLoadRef.current && !pendingStartRef.current) {
      setPlaying(false);
      advancingRef.current = false;
      setReady(true);
    }
  }, [activeChapterId, audioEl, startPlaybackReady]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || missing) return;
    const chapterId = audio.dataset.chapterId || activeIdRef.current;
    if (!getChapter(chapterId)?.hasAudio) return;

    // Do not await before pause/play — keep this on the user-gesture turn.
    void resumeContext();
    applyNarrationPlaybackRate(audio);

    if (!audio.paused && !audio.ended) {
      startGenRef.current += 1;
      setPrerolling(false);
      audio.pause();
      setPlaying(false);
      return;
    }

    const nearEnd =
      audio.ended ||
      (Number.isFinite(audio.duration) &&
        audio.duration > 0 &&
        audio.currentTime >= audio.duration - 0.05);

    if (nearEnd) {
      audio.currentTime = 0;
    }

    try {
      await audio.play();
      applyNarrationPlaybackRate(audio);
      setPlaying(true);
      setPrerolling(false);
      setReady(true);
    } catch {
      setPlaying(false);
    }
  }, [missing, resumeContext]);

  const seek = useCallback(
    (fraction: number) => {
      const audio = audioRef.current;
      if (!audio || !duration || prerolling) return;
      const clamped = Math.min(Math.max(fraction, 0), 1);
      audio.currentTime = clamped * duration;
    },
    [duration, prerolling],
  );

  const setActiveChapter = useCallback((id: string) => {
    // Scroll spy must not steal the chapter during start, preroll, advance, or playback.
    if (advancingRef.current || pendingStartRef.current || prerollingRef.current) {
      return;
    }
    if (narrationStartedRef.current && id === "welcome") return;
    if (wasPlayingRef.current && id !== activeIdRef.current) return;
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
    pendingStartRef.current = true;
    const startId = FIRST_JOURNEY_CHAPTER_ID;
    scrollToChapter(startId);
    void resumeContext();

    // Prefetch first journey cues before / while audio loads.
    void ensureChapterCues(startId);

    const startSrc = getChapterAudioSrc(startId);
    const audio = audioRef.current;
    const alreadyLoaded =
      activeIdRef.current === startId &&
      !!audio &&
      (audio.getAttribute("src") ?? "").endsWith(startSrc);

    if (alreadyLoaded) {
      pendingStartRef.current = false;
      void (async () => {
        await ensureChapterCues(startId);
        await startPlaybackReady();
      })();
      return;
    }

    setActiveChapterId(startId);
  }, [narrationStarted, startPlaybackReady, resumeContext]);

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
          if (el) {
            applyNarrationPlaybackRate(el);
            if (!endedBoundRef.current) {
              endedBoundRef.current = true;
              el.addEventListener("ended", () => {
                advanceFromEndedRef.current();
              });
            }
          }
          setAudioEl((prev) => (prev === el ? prev : el));
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
