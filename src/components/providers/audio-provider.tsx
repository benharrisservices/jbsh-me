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
import { applyNarrationPlaybackRate, waitForAudioCanPlay } from "@/lib/audio";
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
  /** Hero primary action: start Identity narration (continuous). */
  startNarration: () => void;
}

const AudioCtx = createContext<AudioContextValue | undefined>(undefined);

/** Brief pause after `ended` before replacing src (trail silence already in file). */
const CHAPTER_END_SAFETY_MS = 150;

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

  /**
   * Reliable start: metadata/canplay → rate 1.0 → currentTime 0 →
   * AudioContext → one rAF → play. Never seek after play begins.
   * No artificial preroll — opening silence lives in the MP3.
   * When media is already ready, keep awaits minimal so play() stays
   * inside the user-gesture window.
   */
  const startPlaybackReady = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    const gen = ++startGenRef.current;

    try {
      setPrerolling(true);

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

      if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        await waitForAudioCanPlay(audio);
        if (gen !== startGenRef.current) return;
      }

      // Kick AudioContext; don't block play on a slow resume.
      const ctxReady = resumeContext();
      applyNarrationPlaybackRate(audio);
      if (audio.currentTime > 0.001) {
        audio.currentTime = 0;
      }

      await waitAnimationFrames(1);
      if (gen !== startGenRef.current) return;

      await ctxReady;
      if (gen !== startGenRef.current) return;

      applyNarrationPlaybackRate(audio);
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
      await delay(CHAPTER_END_SAFETY_MS);
      // Always advance to the track after the one that just ended.
      // Scroll-spy is blocked by advancingRef during this window.
      resumeOnLoadRef.current = true;
      setReady(false);
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
      setReady(true);
      setMissing(false);
      applyNarrationPlaybackRate(audio);

      if (pendingStartRef.current) {
        pendingStartRef.current = false;
        resumeOnLoadRef.current = false;
        void startPlaybackReady();
        return;
      }

      if (resumeOnLoadRef.current) {
        resumeOnLoadRef.current = false;
        void startPlaybackReady();
      }
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
    };
    const onPause = () => setPlaying(false);

    // Keep addEventListener as a backup; primary path is audio.onended.
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
    setReady(false);
    audio.pause();
    audio.dataset.chapterId = activeChapterId;
    audio.src = src;
    applyNarrationPlaybackRate(audio);
    audio.load();
    if (!resumeOnLoadRef.current && !pendingStartRef.current) {
      setPlaying(false);
      advancingRef.current = false;
    }
  }, [activeChapterId, audioEl, startPlaybackReady]);

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
      }
      applyNarrationPlaybackRate(audio);
      if (atStart) {
        void startPlaybackReady();
      } else {
        void audio.play().catch(() => setPlaying(false));
      }
    } else {
      startGenRef.current += 1;
      setPrerolling(false);
      audio.pause();
    }
  }, [missing, resumeContext, startPlaybackReady]);

  const seek = useCallback(
    (fraction: number) => {
      const audio = audioRef.current;
      if (!audio || !duration || prerolling) return;
      const clamped = Math.min(Math.max(fraction, 0), 1);
      // Immediate jump — rAF clock + seeked handler recompute active cues.
      audio.currentTime = clamped * duration;
    },
    [duration, prerolling],
  );

  const setActiveChapter = useCallback((id: string) => {
    // Scroll spy must not steal the chapter during auto-advance or playback.
    if (advancingRef.current) return;
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
    setReady(false);
    scrollToChapter("identity");

    const identitySrc = getChapterAudioSrc("identity");
    const audio = audioRef.current;
    // Unlock audio graph on the gesture so later autoplay/advance can play.
    void resumeContext();

    const alreadyIdentity =
      activeIdRef.current === "identity" &&
      !!audio &&
      (audio.getAttribute("src") ?? "").endsWith(identitySrc);

    if (alreadyIdentity) {
      pendingStartRef.current = false;
      void startPlaybackReady();
      return;
    }

    setActiveChapterId("identity");
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
