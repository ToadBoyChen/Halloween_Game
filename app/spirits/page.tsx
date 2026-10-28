"use client";

import { useState } from "react";
import { haunt } from "@/lib/audio";
import { colorHex, useGame, useMounted, useTicker, type View } from "@/lib/client";
import { Atmos, Soul, winText } from "@/components/shared";

// The Spirit Board: open this on a computer somewhere in the house. It's a talking board
// seen from above. Every ritual is a candle in the board's two arched rows, lit when it's
// done. A planchette drifts to the last candle lit, and the souls sit along the bottom edge
// showing where each one is heading. It never shows roles, and it goes dark during a Blood Moon.
export default function SpiritsPage() {
  const mounted = useMounted();
  return mounted ? <Board /> : <Atmos />;
}

type Ritual = View["pool"][number];
type P = View["players"][number];

function Board() {
  const { state: s, serverNow } = useGame(null);
  const [awake, setAwake] = useState(false);
  useTicker(1000);
  const now = serverNow();

  if (!awake) {
    return (
      <>
        <Atmos rich />
        <button
          className="screen"
          onClick={() => {
            haunt.awaken();
            setAwake(true);
            document.documentElement.requestFullscreen?.().catch(() => {});
          }}
          style={{ width: "100vw", height: "100vh", background: "transparent", border: "none", color: "var(--ink)" }}
        >
          <h1 className="creep blood flicker" style={{ fontSize: "7vw" }}>The Spirit Board</h1>
          <p className="flavor" style={{ fontSize: "2.4vw", color: "var(--dim)" }}>Click anywhere to awaken it</p>
        </button>
      </>
    );
  }

  const live = s && (s.phase === "playing" || s.phase === "meeting" || s.phase === "over");
  const silenced = s?.phase === "playing" && s.bloodMoon.active;

  return (
    <>
      <Atmos rich red={silenced} />
      <main className="screen sb-room">
        <div className={`sb-board ${silenced ? "sb-dark" : ""}`}>
          <Corners s={s} live={!!live && !silenced} />
          <h1 className="creep sb-title">The Spirit Board</h1>

          {!s ? (
            <p className="flavor sb-hint flicker">Listening…</p>
          ) : silenced ? (
            <div className="sb-hint glitch">
              <p className="creep blood" style={{ fontSize: "4.4vw" }}>The spirits are silenced</p>
              <p className="flavor" style={{ fontSize: "1.8vw" }}>The Blood Moon blinds the board. Go and stop it!</p>
            </div>
          ) : !live ? (
            <p className="flavor sb-hint">The candles light when the game begins.</p>
          ) : (
            <>
              <Candles s={s} />
              <Planchette s={s} now={now} />
              {s.phase === "over" && <p className="creep sb-verdict">{winText(s).title}</p>}
            </>
          )}

          {s && live && !silenced && <Circle s={s} />}
        </div>
      </main>
    </>
  );
}

// The board's top corners: candles lit on the left, candles still dark on the right.
function Corners({ s, live }: { s: View | null; live: boolean }) {
  const done = s?.progress.done ?? 0;
  const total = s?.progress.total ?? 0;
  return (
    <>
      <div className="sb-corner left">
        <span className="sb-glyph">☀</span>
        {live && (
          <span>
            <b>{done}</b> lit
          </span>
        )}
      </div>
      <div className="sb-corner right">
        <span className="sb-glyph">☾</span>
        {live && (
          <span>
            <b>{total - done}</b> still dark
          </span>
        )}
      </div>
    </>
  );
}

// Where each candle sits: two arched rows, like the letters on a talking board.
function candleSpots(n: number) {
  const top = Math.ceil(n / 2);
  return Array.from({ length: n }, (_, i) => {
    const row = i < top ? 0 : 1;
    const count = row === 0 ? top : n - top;
    const k = row === 0 ? i : i - top;
    const t = count === 1 ? 0.5 : k / (count - 1); // 0..1 across the row
    const spread = row === 0 ? 78 : 64;
    const x = 50 - spread / 2 + t * spread;
    const lift = row === 0 ? 8 : 5; // how much the row arches up in the middle
    const y = (row === 0 ? 36 : 56) - Math.sin(t * Math.PI) * lift;
    return { x, y };
  });
}

function Candles({ s }: { s: View }) {
  const spots = candleSpots(s.pool.length);
  return (
    <>
      {s.pool.map((r, i) => (
        <Candle key={r.id} r={r} s={s} x={spots[i].x} y={spots[i].y} />
      ))}
    </>
  );
}

const colorOfName = (s: View, name: string | null) => {
  const p = s.players.find((x) => x.name === name);
  return p ? colorHex(p.color) : "#ffb347";
};

function Candle({ r, s, x, y }: { r: Ritual; s: View; x: number; y: number }) {
  const state = r.doneBy ? "lit" : r.claimedBy ? "held" : r.lockedBy ? "locked" : r.unlockedBy ? "opened" : "cold";
  const flame = state === "held" ? colorOfName(s, r.claimedBy) : "#ffb347";
  const note =
    state === "lit"
      ? `lit by ${r.doneBy}`
      : state === "held"
        ? `${r.claimedBy} is on the way`
        : state === "locked"
          ? `after ${r.lockedBy}`
          : state === "opened"
            ? "🔓 unlocked"
            : r.location;
  return (
    <div className={`sb-candle ${state}`} style={{ left: `${x}%`, top: `${y}%`, "--flame": flame } as React.CSSProperties}>
      <svg viewBox="0 0 40 70" className="sb-wax" aria-hidden>
        {state === "lit" && <circle cx="20" cy="14" r="16" className="sb-halo" />}
        {(state === "lit" || state === "held") && (
          <path className="sb-flame" d="M20 2 C27 12 27 19 20 25 C13 19 13 12 20 2 Z" />
        )}
        {state === "opened" && <circle cx="20" cy="24" r="2.6" className="sb-ember" />}
        <line x1="20" y1="22" x2="20" y2="29" stroke="#1a0d08" strokeWidth="1.6" strokeLinecap="round" />
        <path
          d="M10 29 h20 v36 a3 3 0 0 1 -3 3 h-14 a3 3 0 0 1 -3 -3 Z M10 29 q0 6 3 7 q2 1 2 -3 M24 29 q0 9 3 9 q2 0 3 -5"
          className="sb-body"
        />
        {state === "locked" && (
          <g className="sb-lock">
            <path d="M15 14 v-4 a5 5 0 0 1 10 0 v4" fill="none" />
            <rect x="12" y="14" width="16" height="12" rx="2.5" />
            <circle cx="20" cy="20" r="1.6" />
          </g>
        )}
      </svg>
      <span className="sb-name">{r.name}</span>
      <span className="sb-note">{note}</span>
    </div>
  );
}

// The planchette glides to the last candle lit and frames its flame in its window,
// the way a real one frames a letter. Until a candle is lit it rests in the middle.
function Planchette({ s, now }: { s: View; now: number }) {
  const spots = candleSpots(s.pool.length);
  let last = -1;
  s.pool.forEach((r, i) => {
    if (r.doneBy && (last < 0 || r.doneAt > s.pool[last].doneAt)) last = i;
  });
  const r = last >= 0 ? s.pool[last] : null;
  const top = r ? `calc(${spots[last].y}% - 3.1vw)` : "50%";
  const left = r ? `${spots[last].x}%` : "50%";
  return (
    <>
      <div className="sb-planchette" style={{ left, top }}>
        <svg viewBox="0 0 120 140" aria-hidden>
          <path
            fillRule="evenodd"
            d="M60 4 C80 30 114 64 110 98 C107 122 86 136 60 136 C34 136 13 122 10 98 C6 64 40 30 60 4 Z M60 66 a26 26 0 1 0 0.01 0 Z"
            className="sb-heart"
          />
          <circle cx="60" cy="92" r="26" className="sb-window" />
        </svg>
      </div>
      <p className="flavor sb-whisper">
        {r ? `${r.doneBy} lit ${r.name}, ${ago(now - r.doneAt)}` : "No candle has been lit yet…"}
      </p>
    </>
  );
}

function ago(ms: number) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.floor(sec / 60);
  return min === 1 ? "a minute ago" : `${min} minutes ago`;
}

// The souls along the bottom edge: where each is heading and how many candles they've lit.
function Circle({ s }: { s: View }) {
  return (
    <div className="sb-circle">
      {s.players.map((p) => (
        <SoulSeat key={p.id} p={p} s={s} />
      ))}
    </div>
  );
}

function SoulSeat({ p, s }: { p: P; s: View }) {
  const heading = s.pool.find((r) => r.claimedById === p.id);
  const lit = s.pool.filter((r) => r.doneBy === p.name).length;
  return (
    <div className={`sb-seat ${p.alive ? "" : "gone"}`} style={{ "--c": colorHex(p.color) } as React.CSSProperties}>
      <Soul color={p.color} size={30} dead={!p.alive} />
      <strong>{p.name}</strong>
      <span className="sb-lit">{lit > 0 ? `${lit} lit` : " "}</span>
      <span className="sb-heading">
        {!p.alive ? (p.ejected ? "voted out" : "a ghost now") : heading ? `→ ${heading.location}` : "wandering"}
      </span>
    </div>
  );
}
