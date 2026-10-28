"use client";

import { colorHex, type View } from "@/lib/client";

export function Atmos({ red = false }: { red?: boolean }) {
  return (
    <div className="atmos" aria-hidden>
      <div className="fog" />
      <div className="fog two" />
      <div className={`redwash ${red ? "on" : ""}`} />
      <div className="grain" />
      <div className="vignette" />
    </div>
  );
}

export function Soul({ color, size = 18, dead = false }: { color: string; size?: number; dead?: boolean }) {
  const hex = colorHex(color);
  return (
    <span
      className="soul"
      style={{
        width: size,
        height: size * 1.15,
        background: dead ? "transparent" : hex,
        border: `2px solid ${hex}`,
        color: dead ? "transparent" : hex,
        opacity: dead ? 0.45 : 1,
      }}
    />
  );
}

type P = View["players"][number];

export const nameOf = (s: View, id: string | null) => s.players.find((p) => p.id === id)?.name ?? "Someone";

export function summonsText(s: View) {
  const m = s.meeting!;
  const caller = nameOf(s, m.callerId);
  if (m.reason === "report") return { title: "A Corpse Has Been Found", sub: `${caller} discovered the body.` };
  if (m.reason === "bell") return { title: "The Bell Tolls", sub: `${caller} rang the bell.` };
  return { title: "The Bell Tolls", sub: "The house demands a séance." };
}

export function deadText(s: View) {
  const dead = s.meeting?.newlyDead ?? [];
  if (dead.length === 0) return "No souls were claimed since the last séance.";
  const names = dead.map((id) => nameOf(s, id));
  return `Claimed since the last séance: ${names.join(", ")}`;
}

export function verdictText(s: View) {
  const r = s.meeting?.result;
  if (!r) return { title: "", sub: "" };
  if (!r.ejectedId) {
    return {
      title: r.tie ? "The Spirits Are Divided" : "No One Was Cast Out",
      sub: r.tie ? "A tie. No one is cast into the void." : "The séance chose mercy… or cowardice.",
    };
  }
  const name = nameOf(s, r.ejectedId);
  const sub =
    r.wasTraitor === null
      ? "Whether they were Possessed… only the void knows."
      : r.wasTraitor
        ? `${name} was Possessed.`
        : `${name} was a Mortal. Their blood is on your hands.`;
  return { title: `${name} has been cast into the void`, sub };
}

export function winText(s: View) {
  const w = s.winner;
  if (!w) return { title: "", sub: "" };
  switch (w.reason) {
    case "tasks":
      return { title: "The Curse Is Broken", sub: "The Seal is complete. The Mortals survive the night." };
    case "banished":
      return { title: "The Last Demon Is Banished", sub: "Every Possessed soul has been cast into the void." };
    case "bloodmoon":
      return { title: "The Blood Moon Has Risen", sub: "The house claims you all. The Possessed win." };
    case "parity":
    default:
      return { title: "The House Claims You All", sub: "Too few Mortals remain. The Possessed win." };
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
          <Soul color={p.color} size={big ? 26 : 14} dead={!p.alive} />
          {p.name}
        </div>
      ))}
    </div>
  );
}
