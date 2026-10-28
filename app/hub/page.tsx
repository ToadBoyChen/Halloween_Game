"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { haunt } from "@/lib/audio";
import { fmt, post, secondsLeft, useGame, useMounted, useOnChange, useTicker, type View } from "@/lib/client";
import { Atmos, deadText, Soul, SoulList, summonsText, verdictText, winText } from "@/components/shared";
import { HostPanel } from "./HostPanel";

export default function HubPage() {
  const mounted = useMounted();
  return mounted ? <Hub /> : <Atmos />;
}

const SCARES = ["I SEE YOU", "BEHIND YOU…", "WHO IS IT?", "DON'T TURN AROUND", "IT'S IN THE ROOM", "BOO!"];

function Hub() {
  const { state: s, offline, accept, serverNow } = useGame(null);
  const [awake, setAwake] = useState(false);
  const [hostOpen, setHostOpen] = useState(false);
  const [scare, setScare] = useState<string | null>(null);
  useTicker(250);
  const now = serverNow();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "h" || e.key === "H") setHostOpen((o) => !o);
      if (e.key === "Escape") setHostOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Sound cues ──
  const stage = s?.phase === "meeting" ? s.meeting?.stage ?? null : null;
  useOnChange(s?.phase === "reveal" ? `reveal${s.round}` : null, () => haunt.sting());
  useOnChange(stage ? `m:${stage}` : null, (k) => {
    if (k === "m:summons") haunt.bell();
    if (k === "m:verdict" && s?.meeting?.result?.ejectedId) haunt.whoosh();
  });
  useOnChange(s?.phase === "over" ? `over${s.round}` : null, () => haunt.bell());
  useOnChange(s && s.phase !== "lobby" ? `p${s.round}:${s.progress.done}` : null, (k) => {
    if (!k.endsWith(":0")) haunt.chime();
  });
  const moon = !!s?.bloodMoon.active;
  const pct = s?.progress.total ? s.progress.done / s.progress.total : 0;
  useEffect(() => {
    if (!awake || !s) return;
    haunt.siren(moon);
    haunt.setHeartbeat(
      moon ? 130 : stage === "voting" ? 90 : s.phase === "playing" && pct >= 0.75 ? 72 : 0,
    );
    haunt.setDrone(s.phase === "meeting" ? 0.06 : 0.12);
  }, [awake, s, moon, stage, pct]);

  // ── Random scares while the house is quiet ──
  const quiet = awake && s?.phase === "playing" && !moon && s.settings.scares;
  useEffect(() => {
    if (!quiet) return;
    let t: ReturnType<typeof setTimeout>;
    const schedule = () => {
      t = setTimeout(() => {
        haunt.whisper();
        setScare(SCARES[Math.floor(Math.random() * SCARES.length)]);
        setTimeout(() => setScare(null), 1400);
        schedule();
      }, 120_000 + Math.random() * 180_000);
    };
    schedule();
    return () => clearTimeout(t);
  }, [quiet]);

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
          style={{
            width: "100vw",
            height: "100vh",
            background: "transparent",
            border: "none",
            color: "var(--ink)",
          }}
        >
          <h1 className="creep blood flicker" style={{ fontSize: "8vw" }}>POSSESSED</h1>
          <p className="creep" style={{ fontSize: "2.5vw", color: "var(--dim)" }}>Click anywhere to awaken the house</p>
        </button>
      </>
    );
  }

  const red = !!s && (s.phase === "meeting" || moon || (s.phase === "over" && s.winner?.side === "traitor"));

  return (
    <>
      <Atmos red={red} rich />
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
          textAlign: "center",
          padding: "3vh 4vw",
        }}
      >
        {!s ? (
          <p className="creep flicker" style={{ fontSize: "4vw" }}>Summoning…</p>
        ) : s.phase === "lobby" ? (
          <Lobby s={s} />
        ) : s.phase === "reveal" ? (
          <Reveal s={s} now={now} />
        ) : s.phase === "meeting" ? (
          <Seance s={s} now={now} />
        ) : s.phase === "over" ? (
          <Over s={s} />
        ) : moon ? (
          <BloodMoon s={s} now={now} onState={accept} />
        ) : (
          <Haunting s={s} />
        )}
      </main>

      {scare && (
        <div className="overlay glitch" style={{ background: "rgba(0,0,0,.85)", zIndex: 30 }}>
          <h1 className="creep blood" style={{ fontSize: "12vw" }}>{scare}</h1>
        </div>
      )}

      {offline && (
        <p style={{ position: "fixed", top: 10, left: 0, right: 0, textAlign: "center", color: "var(--dim)", zIndex: 5 }}>
          The connection flickers…
        </p>
      )}

      <button
        onClick={() => setHostOpen(true)}
        aria-label="Host controls"
        style={{
          position: "fixed",
          bottom: 12,
          right: 14,
          zIndex: 5,
          background: "none",
          border: "none",
          color: "var(--faint)",
          fontSize: "1.4rem",
        }}
      >
        ⛧
      </button>
      {hostOpen && s && <HostPanel s={s} onState={accept} onClose={() => setHostOpen(false)} />}
    </>
  );
}

// ─── Lobby ───────────────────────────────────────────────────

function Lobby({ s }: { s: View }) {
  const [qr, setQr] = useState<string | null>(null);
  const url = typeof window !== "undefined" ? window.location.origin : "";
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 600, color: { dark: "#120306", light: "#e9e3d0" } }).then(setQr);
  }, [url]);
  const need = Math.max(0, s.minPlayers - s.players.length);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "5vw", alignItems: "center", width: "100%" }}>
      <div style={{ display: "grid", justifyItems: "center", gap: "2vh" }}>
        <h1 className="creep blood flicker" style={{ fontSize: "7vw", lineHeight: 1 }}>POSSESSED</h1>
        <p className="flavor" style={{ fontSize: "2.2vw", color: "var(--dim)" }}>Enter, if you dare…</p>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL QR code
          <img
            src={qr}
            alt="Scan to join"
            style={{ width: "min(26vw, 48vh)", borderRadius: 12, boxShadow: "0 0 60px rgba(179,0,27,.45)" }}
          />
        )}
        <p style={{ fontSize: "1.6vw" }}>
          📱 Scan to join, or go to <strong style={{ color: "var(--candle)" }}>{url.replace(/^https?:\/\//, "")}</strong>
        </p>
      </div>
      <div style={{ display: "grid", gap: "3vh" }}>
        <h2 className="creep glow" style={{ fontSize: "3.5vw" }}>Players: {s.players.length}</h2>
        <div className="panel" style={{ padding: "3vh 2vw", minHeight: "30vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {s.players.length ? (
            <SoulList players={s.players} big />
          ) : (
            <p className="flicker" style={{ fontSize: "1.8vw", color: "var(--dim)" }}>Nobody here yet… scan the code!</p>
          )}
        </div>
        <p style={{ fontSize: "1.8vw", color: need ? "var(--dim)" : "var(--candle)" }}>
          {need ? `Need ${need} more player${need === 1 ? "" : "s"} to start` : `Ready! ${s.traitorCount} of you will be Possessed…`}
        </p>
      </div>
    </div>
  );
}

// ─── Reveal ──────────────────────────────────────────────────

function Reveal({ s, now }: { s: View; now: number }) {
  return (
    <div style={{ display: "grid", gap: "4vh" }}>
      <h1 className="creep blood fade-in" style={{ fontSize: "5.5vw", lineHeight: 1.1 }}>
        One among you is no longer…
        <br />
        <span className="glitch" style={{ display: "inline-block" }}>themselves</span>
      </h1>
      <p className="fade-in" style={{ fontSize: "2.4vw", animationDelay: "1.5s" }}>
        📱 Look at your phone! Press and hold to see your role. Keep it secret!
      </p>
      <p className="fade-in" style={{ fontSize: "2vw", color: "var(--dim)", animationDelay: "2.5s" }}>
        {s.traitorCount} Possessed among you · Starting in {secondsLeft(s.phaseEndsAt, now)}
      </p>
    </div>
  );
}

// ─── Haunting: the Seal of candles ───────────────────────────

const CANDLES = 13;

function Haunting({ s }: { s: View }) {
  const { done, total } = s.progress;
  const pct = total ? done / total : 0;
  const lit = Math.floor(pct * CANDLES + 1e-9);
  const souls = s.players.filter((p) => p.alive).length;
  return (
    <div style={{ display: "grid", gap: "2vh", justifyItems: "center" }}>
      <div style={{ position: "relative", width: "60vh", height: "60vh" }}>
        {/* pentagram-ish circle */}
        <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, opacity: 0.35 + pct * 0.5 }}>
          <circle cx="50" cy="50" r="46" fill="none" stroke="#b3001b" strokeWidth="0.6" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="#b3001b" strokeWidth="0.3" />
          <polygon
            points={star()}
            fill="none"
            stroke={pct >= 1 ? "#ffcc55" : "#b3001b"}
            strokeWidth="0.5"
          />
        </svg>
        {Array.from({ length: CANDLES }, (_, i) => {
          const a = (i / CANDLES) * Math.PI * 2 - Math.PI / 2;
          return (
            <div
              key={i}
              className={`candle ${i < lit ? "lit" : ""}`}
              style={{ left: `${50 + Math.cos(a) * 46}%`, top: `${50 + Math.sin(a) * 46 + 4}%` }}
            >
              <div className="flame" style={{ animationDelay: `${i * 0.17}s` }} />
              <div className="wick" />
              <div className="wax" />
            </div>
          );
        })}
        <div style={{ position: "absolute", inset: 0, display: "grid", placeContent: "center", gap: "1vh" }}>
          <p className="creep glow" style={{ fontSize: "4vw", color: "var(--candle)" }}>{Math.round(pct * 100)}%</p>
          <p style={{ fontSize: "1.6vw", color: "var(--dim)" }}>Tasks done</p>
        </div>
      </div>
      <h2 className="creep" style={{ fontSize: "3.4vw" }}>Do your tasks. Find the Possessed.</h2>
      <p className="flavor" style={{ fontSize: "1.8vw", color: "var(--dim)" }}>Light every candle to break the curse…</p>
      <p style={{ fontSize: "1.8vw", color: "var(--dim)" }}>
        👥 {souls} player{souls === 1 ? "" : "s"} left · 💀 Found a body? Tap it on your phone.
      </p>
    </div>
  );
}

function star() {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = ((i * 2) / 5) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${50 + Math.cos(a) * 42},${50 + Math.sin(a) * 42}`);
  }
  return pts.join(" ");
}

// ─── Blood Moon + altar ──────────────────────────────────────

function BloodMoon({ s, now, onState }: { s: View; now: number; onState: (v: View) => void }) {
  const [code, setCode] = useState("");
  const [wrong, setWrong] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const left = secondsLeft(s.bloodMoon.endsAt, now);

  useEffect(() => {
    input.current?.focus();
  });

  const submit = async () => {
    if (!code.trim()) return;
    try {
      const r = await post<{ correct: boolean; state: View }>("/api/altar", { code });
      setCode("");
      if (!r.correct) setWrong((w) => w + 1);
      onState({ ...r.state, me: null });
    } catch {
      setWrong((w) => w + 1);
    }
  };

  return (
    <div style={{ display: "grid", justifyItems: "center", gap: "2.5vh" }}>
      <div className="moon" style={{ width: "22vh", height: "22vh" }} />
      <h1 className="creep blood shake" style={{ fontSize: "6vw", lineHeight: 1 }}>Blood Moon!</h1>
      <p className="creep blood" style={{ fontSize: "9vw", lineHeight: 1 }}>{left}</p>
      <p style={{ fontSize: "2.4vw" }}>
        Find the 2 cards at{" "}
        <strong style={{ color: "var(--candle)" }}>📍 {s.bloodMoon.locations.join("  +  📍 ")}</strong>
        <br />then type both cards here
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        style={{ display: "flex", gap: 12, width: "50vw" }}
      >
        <input
          ref={input}
          key={wrong}
          className={`input ${wrong ? "shake" : ""}`}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Type the 2 cards, like A10"
          autoComplete="off"
          style={{ fontSize: "2.4vw", textAlign: "center", textTransform: "uppercase" }}
        />
        <button className="btn primary" style={{ fontSize: "2vw", padding: "0 2vw" }}>Enter</button>
      </form>
      {wrong > 0 && <p className="blood" style={{ fontSize: "2vw" }}>❌ Wrong! Try again — hurry!</p>}
    </div>
  );
}

// ─── The Séance ──────────────────────────────────────────────

function Seance({ s, now }: { s: View; now: number }) {
  const m = s.meeting!;
  const left = secondsLeft(m.endsAt, now);

  if (m.stage === "summons") {
    const t = summonsText(s);
    return (
      <div style={{ display: "grid", gap: "3vh" }}>
        <h1 className="creep blood shake" style={{ fontSize: "8vw", lineHeight: 1 }}>{t.title}</h1>
        <p style={{ fontSize: "3vw" }}>{t.sub}</p>
        <p className="creep flicker" style={{ fontSize: "3.5vw", color: "var(--candle)" }}>Everyone, come to the TV!</p>
      </div>
    );
  }

  if (m.stage === "verdict") {
    const v = verdictText(s);
    const ejected = s.players.find((p) => p.id === m.result?.ejectedId);
    return (
      <div style={{ display: "grid", gap: "4vh", justifyItems: "center" }}>
        {ejected && (
          <div style={{ animation: "fade-in 1s reverse both 2s" }}>
            <Soul color={ejected.color} size={130} />
          </div>
        )}
        <h1 className="creep blood fade-in" style={{ fontSize: "5.5vw", lineHeight: 1.1 }}>{v.title}</h1>
        <p className="flavor fade-in" style={{ fontSize: "2.4vw", animationDelay: "1s" }}>{v.flavor}</p>
        <p className="fade-in" style={{ fontSize: "2.8vw", fontWeight: 800, animationDelay: "2s" }}>{v.sub}</p>
      </div>
    );
  }

  const voting = m.stage === "voting";
  const living = s.players.filter((p) => p.alive);
  return (
    <div style={{ display: "grid", gap: "3vh", width: "100%" }}>
      <h1 className="creep glow" style={{ fontSize: "5vw" }}>{voting ? "🗳️ Vote now!" : "🗣️ Talk time"}</h1>
      <p style={{ fontSize: "2.2vw", fontStyle: "italic" }}>
        {voting ? "Vote on your phones. Who is Possessed?" : `Who is Possessed? Talk it out! · ${deadText(s)}`}
      </p>
      <p className="creep" style={{ fontSize: "8vw", lineHeight: 1, color: left <= 10 ? "var(--blood-bright)" : "var(--candle)" }}>
        {fmt(left)}
      </p>
      <div className="panel" style={{ padding: "3vh 2vw" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2.4vw", justifyContent: "center" }}>
          {s.players.map((p) => {
            const voted = m.voted.includes(p.id);
            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: "2vw",
                  opacity: p.alive ? 1 : 0.35,
                  textDecoration: p.alive ? "none" : "line-through",
                }}
              >
                <Soul color={p.color} size={26} dead={!p.alive} />
                {p.name}
                {voting && voted && <span style={{ color: "var(--candle)" }}>✓</span>}
              </div>
            );
          })}
        </div>
      </div>
      {voting && (
        <p style={{ fontSize: "2vw", color: "var(--dim)" }}>
          {m.voted.length}/{living.length} votes sealed
        </p>
      )}
    </div>
  );
}

// ─── Game over ───────────────────────────────────────────────

function Over({ s }: { s: View }) {
  const w = winText(s);
  const traitorWin = s.winner?.side === "traitor";
  return (
    <div style={{ display: "grid", gap: "4vh", width: "100%" }}>
      <h1 className={`creep ${traitorWin ? "blood" : "glow"} fade-in`} style={{ fontSize: "6.5vw", lineHeight: 1, color: traitorWin ? undefined : "var(--candle)" }}>
        {w.title}
      </h1>
      <p className="flavor fade-in" style={{ fontSize: "2.4vw", animationDelay: "0.6s" }}>{w.flavor}</p>
      <p className="fade-in" style={{ fontSize: "2.6vw", fontWeight: 800, animationDelay: "1.2s" }}>{w.sub}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2vw", justifyContent: "center" }}>
        {s.players.map((p, i) => (
          <div
            key={p.id}
            className="panel fade-in"
            style={{
              padding: "2vh 2vw",
              display: "grid",
              justifyItems: "center",
              gap: 8,
              animationDelay: `${2.5 + i * 0.8}s`,
              borderColor: p.role === "traitor" ? "var(--blood-bright)" : undefined,
            }}
          >
            <Soul color={p.color} size={32} dead={!p.alive} />
            <strong style={{ fontSize: "2vw" }}>{p.name}</strong>
            <span className={p.role === "traitor" ? "creep blood" : "creep"} style={{ fontSize: "1.8vw" }}>
              {p.role === "traitor" ? "😈 Possessed" : "🕯️ Mortal"}
            </span>
          </div>
        ))}
      </div>
      <p style={{ color: "var(--dim)", fontSize: "1.4vw" }}>Press H to play again</p>
    </div>
  );
}
