"use client";

import { useEffect, useRef } from "react";
import { haunt } from "./audio";
import type { View } from "./client";

// Sounds for moments everyone shares (meetings, Blood Moon, game start and end).
// Used by both the TV and phones. They never fire for private actions, so a phone
// in a dark hallway never gives its owner away.
export function useEventSounds(s: View | null, enabled: boolean) {
  const prev = useRef<{ phase: string; stage: string | null; moon: boolean } | null>(null);
  useEffect(() => {
    if (!s) return;
    const cur = { phase: s.phase, stage: s.meeting?.stage ?? null, moon: s.bloodMoon.active };
    const p = prev.current;
    prev.current = cur;
    if (!p || !enabled) return; // nothing on first load
    if (cur.phase === "reveal" && p.phase !== "reveal") haunt.sting();
    if (cur.stage !== p.stage) {
      if (cur.stage === "summons") haunt.bell();
      if (cur.stage === "voting") haunt.toll();
      if (cur.stage === "verdict" && s.meeting?.result?.ejectedId) haunt.whoosh();
    }
    if (cur.moon && !p.moon) haunt.bloodMoon();
    if (!cur.moon && p.moon && cur.phase === "playing") haunt.relief();
    if (cur.phase === "over" && p.phase !== "over") {
      if (s.winner?.side === "traitor") haunt.sting();
      else haunt.relief();
    }
  });
}
