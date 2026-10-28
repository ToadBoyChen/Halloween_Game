"use client";

import { useEffect, useRef, useState } from "react";
import { haunt } from "@/lib/audio";
import { colorHex, useMounted } from "@/lib/client";
import type { SpiritView } from "@/lib/game";
import { Atmos, Soul } from "@/components/shared";

// The Spirit Board: open this on a desktop somewhere in the house. Like vitals in
// Among Us, it shows who is truly alive or dead, even kills nobody has found yet.
export default function SpiritsPage() {
  const mounted = useMounted();
  return mounted ? <Board /> : <Atmos />;
}

function Board() {
  const [s, setS] = useState<SpiritView | null>(null);
  const [awake, setAwake] = useState(false);
  const dead = useRef<Set<string> | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/spirits", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((v: SpiritView | null) => {
          if (!v) return;
          // Flatline tone when a soul departs (not on first load).
          const nowDead = new Set(v.players.filter((p) => !p.alive).map((p) => p.id));
          if (dead.current && v.phase !== "over" && [...nowDead].some((id) => !dead.current!.has(id))) haunt.flatline();
          dead.current = nowDead;
          setS(v);
        })
        .catch(() => {});
    const first = setTimeout(load, 0);
    const id = setInterval(load, 1500);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (!awake) {
    return (
      <>
        <Atmos rich />
        <button
          className="screen"
          onClick={() => {
            haunt.awaken(false);
            setAwake(true);
            document.documentElement.requestFullscreen?.().catch(() => {});
          }}
          style={{ width: "100vw", height: "100vh", background: "transparent", border: "none", color: "var(--ink)" }}
        >
          <h1 className="creep blood flicker" style={{ fontSize: "7vw" }}>The Spirit Board</h1>
          <p className="creep" style={{ fontSize: "2.4vw", color: "var(--dim)" }}>Click anywhere to awaken it</p>
        </button>
      </>
    );
  }

  const live = s && (s.phase === "playing" || s.phase === "meeting" || s.phase === "over");
  const silenced = !!s?.silenced;

  return (
    <>
      <Atmos rich red={silenced} />
      <main
        className="screen"
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "4vh",
          padding: "4vh 4vw",
          textAlign: "center",
        }}
      >
        <div>
          <h1 className="creep blood flicker" style={{ fontSize: "clamp(2.4rem, 5vw, 5.5rem)", lineHeight: 1 }}>
            The Spirit Board
          </h1>
          <p className="flavor" style={{ fontSize: "clamp(1rem, 1.8vw, 1.8rem)", color: "var(--dim)" }}>
            The spirits know who still breathes…
          </p>
          {live && !silenced && <Tally players={s.players} />}
        </div>

        {!s ? (
          <p className="creep flicker" style={{ fontSize: "3vw" }}>Listening…</p>
        ) : silenced ? (
          <div className="glitch" style={{ display: "grid", gap: "2vh" }}>
            <div style={{ fontSize: "10vw", lineHeight: 1 }}>🌕</div>
            <p className="creep blood" style={{ fontSize: "4vw" }}>The spirits are silenced</p>
            <p style={{ fontSize: "2vw" }}>The Blood Moon blinds the board. Go stop it!</p>
          </div>
        ) : !live ? (
          <p className="creep" style={{ fontSize: "3vw", color: "var(--dim)" }}>The board awakens when the game begins.</p>
        ) : (
          <SpiritGrid players={s.players} />
        )}

        <p className="flavor" style={{ fontSize: "clamp(0.9rem, 1.3vw, 1.3rem)", color: "var(--dim)", opacity: 0.7 }}>
          Someone is dead but no body was found? Hurry… or ring the bell.
        </p>
      </main>
    </>
  );
}

type Spirit = SpiritView["players"][number];

// Lay the souls out in as square a grid as fits, so the whole house is on one screen.
const columnsFor = (n: number) => (n <= 4 ? Math.max(n, 1) : n <= 6 ? 3 : n <= 8 ? 4 : n <= 10 ? 5 : 6);

function SpiritGrid({ players }: { players: Spirit[] }) {
  const cols = columnsFor(players.length);
  const rows = Math.ceil(players.length / cols);
  const orb = rows <= 1 ? 96 : rows === 2 ? 72 : 52;
  return (
    <div className="spirit-grid" style={{ "--cols": cols } as React.CSSProperties}>
      {players.map((p) => {
        const bot = p.name.startsWith("🤖 ");
        return (
          <div
            key={p.id}
            className={`panel spirit ${p.alive ? "" : "gone"}`}
            style={{ "--c": colorHex(p.color), "--orb": `${orb}px` } as React.CSSProperties}
          >
            <div className="orb">
              <Soul color={p.color} size={orb} dead={!p.alive} />
            </div>
            <div className="spirit-name">
              {bot && <i className="bot" title="Bot">🤖</i>}
              <span>{bot ? p.name.slice(3) : p.name}</span>
            </div>
            <Heartbeat alive={p.alive} />
            <span className="spirit-status">{p.alive ? "Alive" : p.ejected ? "💀 Voted out" : "💀 Dead"}</span>
          </div>
        );
      })}
    </div>
  );
}

function Tally({ players }: { players: Spirit[] }) {
  const alive = players.filter((p) => p.alive).length;
  return (
    <div className="spirit-tally">
      <span><b style={{ color: "#7fdc8a" }}>{alive}</b> breathing</span>
      <span style={{ color: "var(--faint)" }}>·</span>
      <span><b style={{ color: "var(--blood-bright)" }}>{players.length - alive}</b> departed</span>
    </div>
  );
}

// A heart-monitor line: beating while alive, flat when dead.
function Heartbeat({ alive }: { alive: boolean }) {
  return (
    <svg viewBox="0 0 120 30" className={`ecg ${alive ? "beat" : "flat"}`} preserveAspectRatio="none">
      <path
        d={alive ? "M0 15 H40 L46 15 L50 4 L55 26 L59 10 L62 15 H120" : "M0 15 H120"}
        fill="none"
        stroke={alive ? "#7fdc8a" : "#ff1f3d"}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
