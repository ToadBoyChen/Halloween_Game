"use client";

import { colorHex, fmt, type View } from "@/lib/client";
import { Creepy } from "./creepy";

export function Atmos({ red = false, rich = false, hush = false }: { red?: boolean; rich?: boolean; hush?: boolean }) {
  return (
    <div className="atmos" aria-hidden>
      <div className="fog" />
      <div className="fog two" />
      <Creepy rich={rich} />
      <div className={`redwash ${red ? "on" : ""}`} />
      <div className={`hushwash ${hush ? "on" : ""}`} />
      <div className="grain" />
      <div className="vignette" />
    </div>
  );
}

// `crown`: they won the last game. It stays until they lose one.
export function Soul({ color, size = 18, dead = false, crown = false }: { color: string; size?: number; dead?: boolean; crown?: boolean }) {
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
      {crown && (
        <span className="crown" role="img" aria-label="Won the last game">
          👑
        </span>
      )}
    </span>
  );
}

type P = View["players"][number];

export const nameOf = (s: View, id: string | null) => s.players.find((p) => p.id === id)?.name ?? "Someone";

export function summonsText(s: View) {
  const m = s.meeting!;
  const caller = nameOf(s, m.callerId);
  if (m.reason === "report") return { title: "Body Found!", sub: `${caller} found a body and called a meeting.` };
  if (m.reason === "emergency") return { title: "Emergency Meeting!", sub: `${caller} called a meeting.` };
  return { title: "Meeting!", sub: "The house demands a séance." };
}

// A ring that drains clockwise as a meeting stage runs out, with the time in the middle.
// Orange for talking, red for voting, pale blue for ghosts; red and pulsing for the last 10s.
export function CountdownRing({ left, total, tone, size }: { left: number; total: number; tone: "talk" | "vote" | "ghost"; size: string }) {
  const r = 44;
  const arc = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, left / total) : 0;
  const urgent = left <= 10;
  const color = urgent ? "#ff1f3d" : tone === "vote" ? "#e0182d" : tone === "ghost" ? "#9fd0ff" : "#ffb347";
  return (
    <div className={`countdown ${urgent ? "urgent" : ""}`} style={{ width: size, height: size, "--ring": color } as React.CSSProperties}>
      <svg viewBox="0 0 100 100">
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const r1 = i % 5 === 0 ? 47.5 : 48.5;
          return (
            <line key={i} x1={50 + Math.sin(a) * r1} y1={50 - Math.cos(a) * r1} x2={50 + Math.sin(a) * 50} y2={50 - Math.cos(a) * 50} stroke="rgba(233,220,192,.25)" strokeWidth="0.4" />
          );
        })}
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="3" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${arc * frac} ${arc}`}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dasharray 1s linear, stroke .6s", filter: `drop-shadow(0 0 2px ${color})` }}
        />
      </svg>
      <span className="creep countdown-time" style={{ fontSize: `calc(${size} * 0.3)` }}>
        {fmt(left)}
      </span>
    </div>
  );
}

// The bodies found since the last meeting, each a small tombstone with who found it.
// With no bodies, one line says who called the meeting.
export function BodiesFound({ s, big = false }: { s: View; big?: boolean }) {
  const m = s.meeting;
  const dead = (m?.newlyDead ?? []).map((id) => s.players.find((p) => p.id === id)).filter((p): p is P => !!p);
  if (dead.length === 0) {
    const sub = m?.reason === "emergency" ? `${nameOf(s, m.callerId)} called this meeting. No bodies were found.` : "No bodies were found.";
    return <p className="flavor" style={{ fontSize: big ? "2.2vw" : "1.15rem", color: "var(--dim)" }}>{sub}</p>;
  }
  return (
    <div className={`tombs ${big ? "big" : ""}`}>
      {dead.map((p) => (
        <div key={p.id} className="tomb" style={{ "--c": colorHex(p.color) } as React.CSSProperties}>
          <span className="tomb-skull">💀</span>
          <span>
            <strong>{p.name}</strong>
            <small>found by {p.foundBy ?? "the house"}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

// "…ONE is Possessed" for the Lantern Bearer's reveal.
export function lanternVerdict(count: number) {
  return ["NONE of them are Possessed", "ONE is Possessed", "TWO are Possessed", "ALL THREE are Possessed"][count] ?? `${count} are Possessed`;
}

// "Ann, Ben and Sam"
export const listNames = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

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
      return { title: "Mortals Win!", sub: "Every ritual is done.", flavor: "The Seal is complete. The curse is broken." };
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
  if (big) {
    // Lobby: the souls are the show, names are just a whisper beneath them.
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4vh 3.5vw", justifyContent: "center" }}>
        {players.map((p) => (
          <div key={p.id} className="fade-in" style={{ display: "grid", justifyItems: "center", gap: 20 }}>
            <Soul color={p.color} crown={p.crowned} size={96} dead={!p.alive} />
            <span
              className="flavor"
              style={{ fontSize: "1.35rem", letterSpacing: "0.04em", color: "var(--ink)", opacity: p.alive ? 0.9 : 0.3 }}
            >
              <span className="num-badge" style={{ fontSize: "1rem", marginRight: 8 }}>{p.num}</span>
              {p.name}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
      {players.map((p) => (
        <div
          key={p.id}
          className="fade-in"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "1rem",
            opacity: p.alive ? 1 : 0.5,
            textDecoration: p.alive ? "none" : "line-through",
          }}
        >
          <Soul color={p.color} crown={p.crowned} size={16} dead={!p.alive} />
          {p.name}
        </div>
      ))}
    </div>
  );
}
