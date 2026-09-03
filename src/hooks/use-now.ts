import { useEffect, useState } from "react";

type Listener = (now: number) => void;

/**
 * One shared ticker for the whole app: never one interval per release card.
 * The ticker only runs in the browser and only while at least one consumer is mounted.
 */
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;

function start() {
  if (timer !== null) return;
  timer = setInterval(() => {
    const now = Date.now();
    listeners.forEach((l) => l(now));
  }, 1000);
}

function stop() {
  if (timer !== null && listeners.size === 0) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * Returns null on the server and on the first client render (avoids hydration
 * mismatch), then the shared ticking timestamp.
 */
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const listener: Listener = (t) => setNow(t);
    listeners.add(listener);
    start();
    return () => {
      listeners.delete(listener);
      stop();
    };
  }, []);

  return now;
}
