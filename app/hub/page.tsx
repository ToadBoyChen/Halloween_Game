"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { haunt } from "@/lib/audio";
import { useEventSounds } from "@/lib/sounds";
import { post, secondsLeft, useGame, useMounted, useOnChange, useTicker, type View } from "@/lib/client";
import { Atmos, BodiesFound, CountdownRing, Soul, SoulList, summonsText, verdictText, winText } from "@/components/shared";
import { HostPanel } from "./HostPanel";
import { EmergencyPicker, MeetingStatus, emergencyBlock, meetingRing } from "./Emergency";

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
  const [toast, setToast] = useState<string | null>(null);
  const [typed, setTyped] = useState<string | null>(null); // emergency number being typed (null = closed)
  useTicker(250);
  const now = serverNow();
  // Keyboard shortcuts for the host: Space = start / play again, S = skip timer, H = host controls.
  // While playing, any other key opens the emergency meeting: type your number, then Enter.
  const stateRef = useRef<{ s: View | null; hostOpen: boolean; now: number; typed: string | null }>({ s: null, hostOpen: false, now: 0, typed: null });
  useEffect(() => {
    stateRef.current = { s, hostOpen, now, typed };
  });
  useEffect(() => {
    const showToast = (msg: string) => {
      setToast(msg);
      setTimeout(() => setToast(null), 3500);
    };
    const hostCall = (body: Record<string, unknown>) =>
      post<View>("/api/host", body)
        .then((v) => accept({ ...v, me: null }))
        .catch((e: Error) => showToast(e.message));
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      const { s, hostOpen, now, typed } = stateRef.current;
      const phase = s?.phase ?? null;

      // Typing a number for the emergency meeting: only digits, Backspace, Enter and Esc work.
      if (typed !== null) {
        e.preventDefault();
        if (e.key === "Escape" || phase !== "playing") setTyped(null);
        else if (e.key === "Backspace") setTyped(typed.slice(0, -1));
        else if (/^[0-9]$/.test(e.key) && typed.length < 2) setTyped(typed + e.key);
        else if (e.key === "Enter" && s) {
          const p = s.players.find((x) => String(x.num) === typed);
          if (!p) return showToast("No one has that number.");
          hostCall({ type: "emergency", id: p.id });
          setTyped(null);
        }
        return;
      }

      if (e.key === "h" || e.key === "H") setHostOpen((o) => !o);
      if (e.key === "Escape") setHostOpen(false);
      if (e.key === " ") {
        e.preventDefault();
        if (phase === "lobby") hostCall({ type: "start" });
        if (phase === "over") hostCall({ type: "lobby" });
      }
      if ((e.key === "s" || e.key === "S") && (phase === "reveal" || phase === "meeting")) hostCall({ type: "skip" });
      const shortcut = ["h", "H", "s", "S", " ", "Escape"].includes(e.key);
      const modifier = ["Shift", "Control", "Alt", "Meta"].includes(e.key) || e.ctrlKey || e.metaKey || e.altKey;
      if (s && phase === "playing" && !shortcut && !modifier && !e.repeat && !hostOpen) {
        const why = emergencyBlock(s, now);
        if (why) showToast(why);
        else setTyped(/^[0-9]$/.test(e.key) ? e.key : "");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accept]);

  // ── Sound cues ──
  useEventSounds(s, awake);
  useOnChange(s && s.phase !== "lobby" ? `p${s.round}:${s.progress.done}` : null, (k) => {
    if (!k.endsWith(":0")) haunt.chime();
  });
  // No background noise: only the Blood Moon has a sound bed (siren and heartbeat).
  const moon = !!s?.bloodMoon.active;
  useEffect(() => {
    if (!awake) return;
    haunt.siren(moon);
    haunt.setHeartbeat(moon ? 130 : 0);
  }, [awake, moon]);

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
      <Atmos red={red} rich hush={!!s?.hush.active} />
      <main
        className={`screen ${s?.hush.active ? "hushed" : ""}`}
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
          <Reveal s={s} />
        ) : s.phase === "meeting" ? (
          <Seance s={s} now={now} />
        ) : s.phase === "over" ? (
          <Over s={s} />
        ) : moon ? (
          <BloodMoon s={s} now={now} />
        ) : (
          <Haunting s={s} now={now} />
        )}
      </main>

      {scare && (
        <div className="overlay glitch" style={{ background: "rgba(0,0,0,.85)", zIndex: 30 }}>
          <h1 className="creep blood" style={{ fontSize: "12vw" }}>{scare}</h1>
        </div>
      )}

      {s && typed !== null && s.phase === "playing" && <EmergencyPicker s={s} typed={typed} />}

      {toast && (
        <div className="panel shake" style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 50, padding: "14px 28px", fontSize: "1.6vw", fontWeight: 800, borderColor: "var(--blood-bright)" }}>
          {toast}
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
        <h2 className="flavor" style={{ fontSize: "2.2vw", color: "var(--dim)" }}>
          {s.players.length === 0 ? "The house is empty…" : `${s.players.length} ${s.players.length === 1 ? "soul has" : "souls have"} gathered`}
        </h2>
        <div style={{ minHeight: "38vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {s.players.length ? (
            <SoulList players={s.players} big />
          ) : (
            <p className="flicker" style={{ fontSize: "1.8vw", color: "var(--dim)" }}>Nobody here yet… scan the code!</p>
          )}
        </div>
        <p className="flavor" style={{ fontSize: need ? "1.3vw" : "1.8vw", color: need ? "var(--dim)" : "var(--candle)", opacity: need ? 0.45 : 1 }}>
          {need ? `Need ${need} more player${need === 1 ? "" : "s"} to start` : `Ready! ${s.traitorCount} of you will be Possessed…`}
        </p>
        {!need && (
          <p className="flicker" style={{ fontSize: "1.6vw", color: "var(--dim)" }}>
            Host: press <strong style={{ color: "var(--ink)" }}>Space</strong> to begin
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Reveal: waits until everyone presses "I'm ready" ────────

function Reveal({ s }: { s: View }) {
  const ready = new Set(s.readyIds);
  return (
    <div style={{ display: "grid", gap: "3.5vh", width: "100%" }}>
      <h1 className="creep blood fade-in" style={{ fontSize: "5.2vw", lineHeight: 1.1 }}>
        One among you is no longer…
        <br />
        <span className="glitch" style={{ display: "inline-block" }}>themselves</span>
      </h1>
      <p className="fade-in" style={{ fontSize: "2.4vw", animationDelay: "1.2s" }}>
        📱 Look at your phone! Hold to see your role, then tap <strong>I&apos;m ready</strong>.
      </p>
      <div className="panel" style={{ padding: "3vh 2vw" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2.4vw", justifyContent: "center" }}>
          {s.players.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "2vw", opacity: ready.has(p.id) ? 1 : 0.45 }}>
              <Soul color={p.color} size={30} />
              {p.name}
              <span style={{ color: ready.has(p.id) ? "#7fdc8a" : "var(--dim)" }}>{ready.has(p.id) ? "✓" : "…"}</span>
            </div>
          ))}
        </div>
      </div>
      <p style={{ fontSize: "2vw", color: "var(--dim)" }}>
        {ready.size} of {s.players.length} ready · {s.traitorCount} Possessed among you
      </p>
    </div>
  );
}

// ─── Haunting: the Seal sigil ────────────────────────────────

const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ".split("");
const RUNE_COUNT = 13;

function Haunting({ s, now }: { s: View; now: number }) {
  const { done, total } = s.progress;
  const pct = total ? done / total : 0;
  const saved = s.bloodMoon.savedBy.length > 0 && now - s.bloodMoon.savedAt < 7000;
  return (
    <div className="haunt">
      <div className="haunt-sigil">
        <Sigil pct={pct} ring={meetingRing(s, now)} />
        <div className="haunt-core">
          <p className="creep glow" style={{ fontSize: "7.5vh", color: pct >= 1 ? "#ffe08a" : "var(--candle)", lineHeight: 1 }}>
            {Math.round(pct * 100)}%
          </p>
          <p style={{ fontSize: "2vh", color: "var(--dim)" }}>rituals done</p>
        </div>
      </div>
      <MeetingStatus s={s} now={now} />
      {saved && (
        <div className="overlay fade-in" style={{ background: "rgba(0,0,0,.82)", zIndex: 20 }}>
          <div style={{ fontSize: "9vw", lineHeight: 1 }}>🛡️</div>
          <h1 className="creep glow" style={{ fontSize: "6vw", color: "var(--candle)", lineHeight: 1.1 }}>
            {s.bloodMoon.savedBy.join(" & ")} saved everyone!
          </h1>
          <p className="flavor" style={{ fontSize: "2.6vw" }}>The Blood Moon wanes… for now.</p>
        </div>
      )}
    </div>
  );
}

// A turning ring of runes that ignite as tasks are done, a fiery arc filling the circle,
// and a pentagram whose five lines light up at every 20%.
// `ring` is the meeting ring around the pentagram: meetings can be called once it's full.
function Sigil({ pct, ring }: { pct: number; ring: number }) {
  const lit = Math.floor(pct * RUNE_COUNT + 1e-9);
  const complete = pct >= 1;
  const arc = 2 * Math.PI * 76;
  const pt = (r: number, i: number, n: number) => {
    // point i of n around a circle of radius r, starting at the top
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [100 + Math.cos(a) * r, 100 + Math.sin(a) * r];
  };
  const star = [0, 2, 4, 1, 3].map((i) => pt(62, i, 5));
  return (
    <svg viewBox="0 0 200 200" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <filter id="fire-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="sigil-core">
          <stop offset="0%" stopColor={complete ? "#5a3a00" : "#3a0008"} stopOpacity={0.25 + pct * 0.5} />
          <stop offset="70%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fire" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffdf7a" />
          <stop offset="50%" stopColor="#ff8a1f" />
          <stop offset="100%" stopColor="#c1121f" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="96" fill="url(#sigil-core)" />

      {/* turning outer ring of runes and ticks */}
      <g className="sigil-spin">
        <circle cx="100" cy="100" r="96" fill="none" stroke="#5a0a14" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="84" fill="none" stroke="#5a0a14" strokeWidth="0.5" />
        {Array.from({ length: 72 }, (_, i) => {
          const [x1, y1] = pt(96, i, 72);
          const [x2, y2] = pt(i % 6 === 0 ? 91 : 93.5, i, 72);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5a0a14" strokeWidth="0.5" />;
        })}
        {Array.from({ length: RUNE_COUNT }, (_, i) => {
          const [x, y] = pt(90, i, RUNE_COUNT);
          const on = i < lit;
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="11"
              fontWeight="700"
              className={on ? "rune lit" : "rune"}
              fill={on ? (complete ? "#ffe08a" : "#ffb347") : "#5c1420"}
              filter={on ? "url(#fire-glow)" : undefined}
              style={{ animationDelay: `${i * 0.37}s` }}
              transform={`rotate(${(i / RUNE_COUNT) * 360} ${x} ${y})`}
            >
              {RUNES[(i * 7) % RUNES.length]}
            </text>
          );
        })}
      </g>

      {/* progress arc */}
      <circle cx="100" cy="100" r="76" fill="none" stroke="#2a0509" strokeWidth="3" />
      <circle
        cx="100"
        cy="100"
        r="76"
        fill="none"
        stroke="url(#fire)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${arc * pct} ${arc}`}
        transform="rotate(-90 100 100)"
        filter="url(#fire-glow)"
        className="sigil-arc"
        style={{ transition: "stroke-dasharray 1.2s ease" }}
      />

      {/* meeting ring: fills while meetings sleep, glows when one can be called */}
      <circle cx="100" cy="100" r="67" fill="none" stroke="#141c2a" strokeWidth="2.2" />
      <circle
        cx="100"
        cy="100"
        r="67"
        fill="none"
        stroke={ring >= 1 ? "#d8e6ff" : "#5d7db0"}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray={`${2 * Math.PI * 67 * ring} ${2 * Math.PI * 67}`}
        transform="rotate(-90 100 100)"
        filter={ring >= 1 ? "url(#fire-glow)" : undefined}
        className={ring >= 1 ? "meeting-ring full" : "meeting-ring"}
        style={{ transition: "stroke-dasharray 0.4s linear" }}
      />

      {/* pentagram: one line ignites per 20% */}
      <circle cx="100" cy="100" r="62" fill="none" stroke="#4a0a12" strokeWidth="0.6" />
      {star.map(([x1, y1], i) => {
        const [x2, y2] = star[(i + 1) % 5];
        const on = pct >= (i + 1) / 5;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={on ? (complete ? "#ffe08a" : "#ff9a2a") : "#4a0a12"}
            strokeWidth={on ? 1.4 : 0.7}
            strokeLinecap="round"
            filter={on ? "url(#fire-glow)" : undefined}
            className={on ? "rune lit" : undefined}
          />
        );
      })}

      {/* dark disc so the percentage stays readable over the star */}
      <circle cx="100" cy="100" r="30" fill="#050203" opacity="0.85" />
      <circle cx="100" cy="100" r="30" fill="none" stroke={complete ? "#ffe08a" : "#5a0a14"} strokeWidth="0.6" />
    </svg>
  );
}

// ─── Blood Moon ──────────────────────────────────────────────

function BloodMoon({ s, now }: { s: View; now: number }) {
  const bm = s.bloodMoon;
  const left = secondsLeft(bm.endsAt, now);
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: "2.5vh", width: "100%" }}>
      <div className="moon" style={{ width: "20vh", height: "20vh" }} />
      <h1 className="creep blood shake" style={{ fontSize: "6vw", lineHeight: 1 }}>Blood Moon!</h1>
      <p className="creep blood" style={{ fontSize: "8vw", lineHeight: 1 }}>{left}</p>
      <p style={{ fontSize: "2.4vw", fontWeight: 800 }}>Find the cards and pick them on your phone!</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2vw", width: "70vw" }}>
        {bm.locations.map((loc, i) => {
          const by = bm.sealedBy[i];
          return (
            <div
              key={loc}
              className="panel"
              style={{
                padding: "2.5vh 2vw",
                display: "grid",
                gap: "1vh",
                borderColor: by ? "#7fdc8a" : "var(--blood-bright)",
                boxShadow: by ? "0 0 30px rgba(127,220,138,.25) inset" : undefined,
              }}
            >
              <span style={{ fontSize: "2.6vw", fontWeight: 800, color: "var(--candle)" }}>📍 {loc}</span>
              <span style={{ fontSize: "2.2vw", fontWeight: 800, color: by ? "#7fdc8a" : "var(--dim)" }}>
                {by ? `✓ Sealed by ${by}` : "❓ Not found yet"}
              </span>
            </div>
          );
        })}
      </div>
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
  const marked = voting ? m.voted : m.readyToVote;
  return (
    <div className="seance">
      <header>
        <h1 className="creep seance-title">{voting ? "Vote on your phones" : "Talk it out"}</h1>
        <p className="flavor seance-sub">
          {voting
            ? `${m.voted.length} of ${living.length} votes are in`
            : `${m.readyToVote.length} of ${living.length} ready to vote`}
        </p>
      </header>
      <CountdownRing left={left} total={voting ? s.settings.voting : s.settings.discussion} tone={voting ? "vote" : "talk"} size="42vh" />
      <div className="seance-bodies">{!voting && <BodiesFound s={s} big />}</div>
      <div className="seance-souls">
        {s.players.map((p) => (
          <span key={p.id} className={p.alive ? "" : "gone"}>
            <Soul color={p.color} size={22} dead={!p.alive} />
            {p.name}
            <b>{p.alive && marked.includes(p.id) ? "✓" : ""}</b>
          </span>
        ))}
      </div>
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
      <p style={{ color: "var(--dim)", fontSize: "1.4vw" }}>Press <strong>Space</strong> to play again</p>
    </div>
  );
}
