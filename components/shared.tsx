"use client";

import { colorHex, type View } from "@/lib/client";
import { Creepy } from "./creepy";

export function Atmos({ red = false, rich = false }: { red?: boolean; rich?: boolean }) {
  return (
    <div className="atmos" aria-hidden>
      <div className="fog" />
      <div className="fog two" />
      <Creepy rich={rich} />
      <div className={`redwash ${red ? "on" : ""}`} />
      <div className="grain" />
      <div className="vignette" />
    </div>
  );
}

export function Soul({ color, size = 18, dead = false }: { color: string; size?: number; dead?: boolean }) {
  // Offset each color's animation so a row of souls doesn't pulse in lockstep.
  const offset = -((color.charCodeAt(0) * 7 + color.length * 13) % 40) / 10;
  return (
    <span
      className={`soul ${dead ? "dead" : ""}`}
      style={{ "--c": colorHex(color), "--s": `${size}px`, animationDelay: `${offset}s` } as React.CSSProperties}
    >
      <span className="aura two" />
      <span className="aura" />
      <span className="wisp" />
      <span className="core" />
    </span>
  );
}

type P = View["players"][number];

export const nameOf = (s: View, id: string | null) => s.players.find((p) => p.id === id)?.name ?? "Someone";

export function summonsText(s: View) {
  const m = s.meeting!;
  const caller = nameOf(s, m.callerId);
  if (m.reason === "report") return { title: "Body Found!", sub: `${caller} found a body.` };
  if (m.reason === "bell") return { title: "Emergency Meeting!", sub: `${caller} rang the bell.` };
  return { title: "Meeting!", sub: "The house demands a séance." };
}

export function deadText(s: View) {
  const dead = s.meeting?.newlyDead ?? [];
  if (dead.length === 0) return "Nobody was caught since the last meeting.";
  return `Caught since the last meeting: ${dead.map((id) => nameOf(s, id)).join(", ")}`;
}

export function verdictText(s: View) {
  const r = s.meeting?.result;
  if (!r) return { title: "", sub: "", flavor: "" };
  if (!r.ejectedId) {
    return r.tie
      ? { title: "It's a tie!", sub: "No one is voted out.", flavor: "The spirits are divided…" }
      : { title: "No one voted out", sub: "The game goes on.", flavor: "Mercy… or cowardice?" };
  }
  const name = nameOf(s, r.ejectedId);
  const sub =
    r.wasTraitor === null
      ? "Were they Possessed? Nobody knows…"
      : r.wasTraitor
        ? `${name} WAS Possessed!`
        : `${name} was innocent!`;
  return { title: `${name} was voted out`, sub, flavor: "…and cast into the void." };
}

export function winText(s: View) {
  const w = s.winner;
  if (!w) return { title: "", sub: "", flavor: "" };
  switch (w.reason) {
    case "tasks":
      return { title: "Mortals Win!", sub: "Every task is done.", flavor: "The Seal is complete. The curse is broken." };
    case "banished":
      return { title: "Mortals Win!", sub: "All the Possessed were voted out.", flavor: "The last demon is banished." };
    case "bloodmoon":
      return { title: "Possessed Win!", sub: "No one stopped the Blood Moon.", flavor: "The Blood Moon has risen." };
    case "parity":
    default:
      return { title: "Possessed Win!", sub: "Too few Mortals are left.", flavor: "The house claims you all." };
  }
}

export function SoulList({ players, big = false }: { players: P[]; big?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: big ? 22 : 10, justifyContent: "center" }}>
      {players.map((p) => (
        <div
          key={p.id}
          className="fade-in"
          style={{
            display: "flex",
            alignItems: "center",
            gap: big ? 12 : 8,
            fontSize: big ? "1.8rem" : "1rem",
            opacity: p.alive ? 1 : 0.5,
            textDecoration: p.alive ? "none" : "line-through",
          }}
        >
          <Soul color={p.color} size={big ? 34 : 16} dead={!p.alive} />
          {p.name}
        </div>
      ))}
    </div>
  );
}
