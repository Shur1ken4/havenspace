"use client";
import { useEffect, useState, type RefObject } from "react";

/** True while the element is on screen (and the tab is visible), so animations
 *  can rest when nobody can see them. Defaults to true before the first check. */
export function useInView(ref: RefObject<Element | null>): boolean {
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  useEffect(() => {
    const update = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return onScreen && tabVisible;
}
