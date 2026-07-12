"use client";

import { useEffect } from "react";
import { chapters } from "@/content/sections";

/**
 * Chapter-level snapping. One deliberate gesture moves exactly one chapter and
 * lands it aligned to the top of the viewport, the way an Apple product page
 * moves between scenes.
 *
 * It steps out of the way when a gesture belongs to the content itself:
 *  - nested scrollable chapters keep their own scroll until a boundary,
 *  - a chapter taller than the viewport is read through before it advances.
 *
 * CSS scroll-snap remains as a gentle backstop for touch and momentum.
 */
export function useScrollSnap() {
  useEffect(() => {
    const ids = chapters.map((c) => c.id);
    let sections = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let locked = false;
    let lockTimer: number | undefined;

    const refresh = () => {
      sections = ids
        .map((id) => document.getElementById(id))
        .filter(Boolean) as HTMLElement[];
    };

    // The section currently occupying the top of the viewport.
    const currentIndex = () => {
      let index = 0;
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= 1) index = i;
        else break;
      }
      return index;
    };

    const goTo = (i: number) => {
      const clamped = Math.max(0, Math.min(sections.length - 1, i));
      const el = sections[clamped];
      if (!el) return;
      locked = true;
      window.clearTimeout(lockTimer);
      el.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      lockTimer = window.setTimeout(
        () => {
          locked = false;
        },
        reduceMotion ? 120 : 760,
      );
    };

    // A nested overflow container that can still scroll in this direction.
    const nestedCanScroll = (from: EventTarget | null, dir: number) => {
      let node = from as HTMLElement | null;
      while (node && node !== document.body) {
        const style =
          node instanceof HTMLElement ? getComputedStyle(node) : null;
        if (
          style &&
          /(auto|scroll)/.test(style.overflowY) &&
          node.scrollHeight > node.clientHeight + 1
        ) {
          if (dir > 0 && node.scrollTop + node.clientHeight < node.scrollHeight - 1)
            return true;
          if (dir < 0 && node.scrollTop > 1) return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    // The current chapter itself still has content to reveal in this direction.
    const sectionCanScroll = (dir: number) => {
      const rect = sections[currentIndex()]?.getBoundingClientRect();
      if (!rect) return false;
      if (dir > 0) return rect.bottom > window.innerHeight + 2;
      return rect.top < -2;
    };

    const step = (dir: number, from: EventTarget | null) => {
      if (nestedCanScroll(from, dir) || sectionCanScroll(dir)) return false;
      if (locked) return true;
      goTo(currentIndex() + dir);
      return true;
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 4 || e.ctrlKey) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const handled = step(dir, e.target);
      if (handled) e.preventDefault();
    };

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        goTo(sections.length - 1);
        return;
      }

      let dir = 0;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ")
        dir = 1;
      else if (e.key === "ArrowUp" || e.key === "PageUp") dir = -1;
      else return;

      if (nestedCanScroll(document.activeElement, dir) || sectionCanScroll(dir))
        return;
      e.preventDefault();
      if (!locked) goTo(currentIndex() + dir);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", refresh);

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", refresh);
      window.clearTimeout(lockTimer);
    };
  }, []);
}
