"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PlayerView } from "./game";
import { SOUL_COLORS } from "@/config/game";

export type View = Omit<PlayerView, "me"> & { me: PlayerView["me"] | null; unknown?: boolean };

// Poll the game state about once a second. `token` identifies a player; the hub passes null.
export function useGame(token: string | null, onUnknown?: () => void) {
  const [state, setState] = useState<View | null>(null);
  const unknownRef = useRef(onUnknown);
  useEffect(() => {
    unknownRef.current = onUnknown;
  });
  const [offline, setOffline] = useState(false);
  const offset = useRef(0);
  const lastVersion = useRef(-1);

  const accept = useCallback((v: View) => {
    offset.current = v.now - Date.now();
    if (v.version >= lastVersion.current || v.unknown) {
      lastVersion.current = v.version;
      setState(v);
    }
  }, []);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const q = token ? `?token=${encodeURIComponent(token)}` : "";
        const res = await fetch(`/api/state${q}`, { cache: "no-store" });
        if (res.ok) {
          const v: View = await res.json();
          if (v.unknown) unknownRef.current?.();
          accept(v);
          setOffline(false);
        } else setOffline(true);
      } catch {
        setOffline(true);
      }
      if (!stop) timer = setTimeout(tick, 1000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [token, accept]);

  return { state, offline, accept, serverNow: () => Date.now() + offset.current };
}

export async function post<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "The spirits refuse.");
  return data as T;
}

// Re-render on an interval so countdowns tick.
export function useTicker(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function secondsLeft(endsAt: number, now: number) {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}`;
}

export const colorHex = (id: string) => SOUL_COLORS.find((c) => c.id === id)?.hex ?? "#888";

// Fires `fn` once each time `key` changes to a new non-null value.
export function useOnChange(key: string | null, fn: (key: string) => void) {
  const last = useRef<string | null>(null);
  const cb = useRef(fn);
  useEffect(() => {
    cb.current = fn;
  });
  useEffect(() => {
    if (key && key !== last.current) cb.current(key);
    last.current = key;
  }, [key]);
}

// False during server render, true in the browser.
const noop = () => () => {};
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

// Keep the phone screen awake while the page is open.
export function useWakeLock() {
  useEffect(() => {
    type WL = { release: () => Promise<void> };
    let lock: WL | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WL> } };
    const req = () => nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    req();
    const onVis = () => document.visibilityState === "visible" && req();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);
}

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}
