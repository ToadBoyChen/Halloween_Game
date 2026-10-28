"use client";

import { useRef, useState } from "react";
import { SOUL_COLORS } from "@/config/game";
import {
  buzz,
  fmt,
  post,
  secondsLeft,
  useGame,
  useMounted,
  useOnChange,
  useTicker,
  useWakeLock,
  type View,
} from "@/lib/client";
import { Atmos, deadText, nameOf, Soul, summonsText, verdictText, winText } from "@/components/shared";

const TOKEN_KEY = "possessed-token";

type Me = NonNullable<View["me"]>;
type Send = (body: Record<string, unknown>) => Promise<void>;

export default function PlayPage() {
  const mounted = useMounted();
  return mounted ? <Phone /> : <Atmos />;
}

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function Phone() {
  const [token, setToken] = useState<string | null>(readToken);
  const forget = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    setToken(null);
  };
  const { state, offline, accept, serverNow } = useGame(token, forget);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useWakeLock();
  useTicker(500);

  useOnChange(state?.phase === "meeting" ? "meeting" : null, () => buzz([400, 150, 400, 150, 800]));
  useOnChange(state?.bloodMoon.active ? "moon" : null, () => buzz([200, 100, 200, 100, 200, 100, 600]));

  const send: Send = async (body) => {
    try {
      setError(null);
      const v = await post<View & { left?: boolean }>("/api/action", { token, ...body });
      if (v.left) forget();
      else accept(v);
    } catch (e) {
      setError((e as Error).message);
      buzz(80);
    }
  };

  const now = serverNow();
  const s = state;
  const me = s?.me;
  const red = !!s && (s.phase === "meeting" || s.bloodMoon.active);

  let content;
  if (!s) content = <Center><p className="creep flicker" style={{ fontSize: "2rem" }}>Summoning…</p></Center>;
  else if (!token || !me)
    content = (
      <Join
        state={s}
        onJoined={(t, v) => {
          try {
            localStorage.setItem(TOKEN_KEY, t);
          } catch {}
          setToken(t);
          accept(v);
        }}
      />
    );
  else if (s.phase === "lobby") content = <Lobby s={s} me={me} send={send} />;
  else if (s.phase === "reveal") content = <Reveal s={s} me={me} now={now} />;
  else if (s.phase === "meeting") content = <Seance s={s} me={me} now={now} send={send} />;
  else if (s.phase === "over") content = <Over s={s} me={me} />;
  else content = <Haunting s={s} me={me} now={now} send={send} onHide={() => setHidden(true)} />;

  return (
    <>
      <Atmos red={red} />
      <main className="screen phone">
        {offline && (
          <p style={{ textAlign: "center", color: "var(--dim)", fontSize: ".85rem" }}>The connection flickers…</p>
        )}
        {content}
      </main>
      {error && (
        <div
          onClick={() => setError(null)}
          className="panel shake"
          style={{ position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 60, padding: 14, textAlign: "center" }}
        >
          {error}
        </div>
      )}
      {hidden && <HideScreen onReveal={() => setHidden(false)} />}
    </>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "80dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 16,
      }}
    >
      {children}
    </div>
  );
}

// Black screen; double-tap to come back.
function HideScreen({ onReveal }: { onReveal: () => void }) {
  const last = useRef(0);
  return (
    <div
      className="hide-screen"
      onClick={() => {
        const t = Date.now();
        if (t - last.current < 400) onReveal();
        last.current = t;
      }}
    >
      double-tap to return
    </div>
  );
}

// ─── Join ────────────────────────────────────────────────────

function Join({ state, onJoined }: { state: View; onJoined: (token: string, v: View) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taken = new Set(state.players.map((p) => p.color));

  if (state.phase !== "lobby") {
    return (
      <Center>
        <h1 className="creep blood" style={{ fontSize: "2.6rem" }}>Too Late</h1>
        <p>The ritual has already begun. Wait for the next game.</p>
      </Center>
    );
  }

  const submit = async () => {
    if (!color) return setError("Choose a soul color.");
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ token: string; state: View }>("/api/join", { name, color });
      onJoined(r.token, r.state);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 22, paddingTop: 30 }}>
      <div style={{ textAlign: "center" }}>
        <h1 className="creep blood flicker" style={{ fontSize: "3.4rem", lineHeight: 1 }}>POSSESSED</h1>
        <p style={{ color: "var(--dim)", fontStyle: "italic", marginTop: 8 }}>Enter, if you dare.</p>
      </div>
      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ color: "var(--dim)" }}>Your name</span>
        <input
          className="input"
          value={name}
          maxLength={16}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          placeholder="Who are you?"
        />
      </label>
      <div style={{ display: "grid", gap: 8 }}>
        <span style={{ color: "var(--dim)" }}>Your soul color</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {SOUL_COLORS.map((c) => {
            const isTaken = taken.has(c.id);
            const picked = color === c.id;
            return (
              <button
                key={c.id}
                disabled={isTaken}
                onClick={() => setColor(c.id)}
                style={{
                  padding: "10px 4px",
                  borderRadius: 10,
                  border: `2px solid ${picked ? c.hex : "transparent"}`,
                  background: picked ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.4)",
                  opacity: isTaken ? 0.2 : 1,
                  display: "grid",
                  justifyItems: "center",
                  gap: 6,
                  fontSize: ".8rem",
                  color: "var(--dim)",
                }}
              >
                <Soul color={c.id} size={22} />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>
      {error && <p className="blood" style={{ textAlign: "center" }}>{error}</p>}
      <button className="btn primary" disabled={busy || !name.trim()} onClick={submit} style={{ fontSize: "1.3rem" }}>
        Bind my soul
      </button>
    </div>
  );
}

// ─── Lobby ───────────────────────────────────────────────────

function Lobby({ s, me, send }: { s: View; me: Me; send: Send }) {
  return (
    <Center>
      <Soul color={me.color} size={48} />
      <h1 className="creep glow" style={{ fontSize: "2.4rem" }}>You are bound, {me.name}</h1>
      <p style={{ color: "var(--dim)" }}>Watch the TV. The ritual begins soon.</p>
      <p style={{ color: "var(--dim)" }}>
        {s.players.length} soul{s.players.length === 1 ? "" : "s"} gathered
      </p>
      <button className="btn ghost" onClick={() => send({ type: "leave" })} style={{ marginTop: 30 }}>
        Flee the house
      </button>
    </Center>
  );
}

// ─── Role reveal ─────────────────────────────────────────────

function RoleCard({ me, compact = false }: { me: Me; compact?: boolean }) {
  const traitor = me.role === "traitor";
  return (
    <div style={{ textAlign: "center", display: "grid", gap: compact ? 6 : 14 }}>
      <p style={{ color: "var(--dim)" }}>You are</p>
      <h2
        className={`creep ${traitor ? "blood glitch" : "glow"}`}
        style={{ fontSize: compact ? "2.4rem" : "3.6rem", lineHeight: 1, color: traitor ? undefined : "var(--candle)" }}
      >
        {traitor ? "POSSESSED" : "MORTAL"}
      </h2>
      <p style={{ fontStyle: "italic" }}>
        {traitor
          ? "Claim souls in secret. Blend in. Summon the Blood Moon."
          : "Complete your rituals. Find the Possessed. Survive."}
      </p>
      {traitor && (
        <p className="blood">
          {me.allies.length ? `Your fellow Possessed: ${me.allies.join(", ")}` : "You hunt alone."}
        </p>
      )}
    </div>
  );
}

function HoldToReveal({ me, label }: { me: Me; label: string }) {
  const [held, setHeld] = useState(false);
  return (
    <div
      onPointerDown={() => setHeld(true)}
      onPointerUp={() => setHeld(false)}
      onPointerLeave={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
      onContextMenu={(e) => e.preventDefault()}
      className="panel"
      style={{
        padding: 28,
        minHeight: 260,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "none",
        borderColor: held && me.role === "traitor" ? "var(--blood-bright)" : undefined,
      }}
    >
      {held ? (
        <RoleCard me={me} />
      ) : (
        <p className="creep flicker" style={{ fontSize: "1.8rem", color: "var(--dim)" }}>{label}</p>
      )}
    </div>
  );
}

function Reveal({ s, me, now }: { s: View; me: Me; now: number }) {
  return (
    <Center>
      <p style={{ fontStyle: "italic", color: "var(--dim)" }}>One among you is no longer… themselves.</p>
      <div style={{ width: "100%" }}>
        <HoldToReveal me={me} label="Press and hold to learn your fate" />
      </div>
      <p style={{ color: "var(--dim)" }}>The haunting begins in {secondsLeft(s.phaseEndsAt, now)}…</p>
    </Center>
  );
}

// ─── The Haunting (main game screen) ─────────────────────────

function Haunting({ s, me, now, send, onHide }: { s: View; me: Me; now: number; send: Send; onHide: () => void }) {
  const [confirm, setConfirm] = useState<null | { type: string; title: string; body: string }>(null);
  const [peek, setPeek] = useState(false);
  const traitor = me.role === "traitor";
  const bm = s.bloodMoon;
  const done = me.tasks.filter((t) => t.done).length;
  const pct = s.progress.total ? Math.round((s.progress.done / s.progress.total) * 100) : 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Soul color={me.color} size={20} dead={!me.alive} />
        <strong style={{ fontSize: "1.2rem", flex: 1 }}>{me.name}</strong>
        <button
          className="btn ghost"
          style={{ padding: "8px 12px", fontSize: ".9rem" }}
          onPointerDown={() => setPeek(true)}
          onPointerUp={() => setPeek(false)}
          onPointerLeave={() => setPeek(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          Hold: fate
        </button>
        <button className="btn ghost" style={{ padding: "8px 12px", fontSize: ".9rem" }} onClick={onHide}>
          Hide
        </button>
      </header>

      {peek && (
        <div className="panel" style={{ padding: 18 }}>
          <RoleCard me={me} compact />
        </div>
      )}

      {bm.active && (
        <div className="panel shake" style={{ padding: 18, borderColor: "var(--blood-bright)", textAlign: "center" }}>
          <h2 className="creep blood" style={{ fontSize: "2rem" }}>The Blood Moon Rises</h2>
          <p style={{ fontSize: "3rem", fontWeight: 700 }} className="blood">{secondsLeft(bm.endsAt, now)}</p>
          <p>Find the cards at</p>
          <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--candle)" }}>{bm.locations.join("  &  ")}</p>
          <p style={{ marginTop: 6 }}>then speak the code at the altar (the TV).</p>
        </div>
      )}

      {!me.alive && (
        <div className="panel" style={{ padding: 16, textAlign: "center", opacity: 0.85 }}>
          <h2 className="creep" style={{ fontSize: "1.8rem", color: "#9fb4c7" }}>
            {me.ejected ? "Cast Into the Void" : "You Are a Spirit"}
          </h2>
          <p style={{ fontStyle: "italic" }}>
            Stay silent. Do not speak, report or vote.
            {traitor ? " Your darkness still lingers." : " Your rituals still help break the curse."}
          </p>
        </div>
      )}

      {traitor && <TraitorPanel s={s} me={me} now={now} send={send} />}

      <section style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--dim)" }}>
          <span>The Seal</span>
          <span>{pct}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "linear-gradient(90deg, #ff7a1a, #ffcc55)",
              boxShadow: "0 0 12px #ff9a2a",
              transition: "width 0.8s",
            }}
          />
        </div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <h3 className="creep" style={{ fontSize: "1.6rem" }}>
          Your Rituals{" "}
          <span style={{ fontFamily: "var(--body)", fontSize: "1rem", color: "var(--dim)" }}>
            {done}/{me.tasks.length}
          </span>
        </h3>
        {traitor && (
          <p className="blood" style={{ fontSize: ".9rem", fontStyle: "italic" }}>
            These rituals are false. Pretend to perform them.
          </p>
        )}
        {me.tasks.map((t) => (
          <div
            key={t.id}
            className="panel"
            style={{ padding: 14, opacity: t.done ? 0.55 : 1, display: "grid", gap: 6 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <strong style={{ fontSize: "1.15rem", textDecoration: t.done ? "line-through" : "none" }}>{t.name}</strong>
              <span style={{ color: "var(--candle)", fontSize: ".9rem", textAlign: "right" }}>{t.location}</span>
            </div>
            {!t.done && <p style={{ color: "var(--dim)" }}>{t.instructions}</p>}
            {t.done ? (
              <button
                onClick={() => send({ type: "task", id: t.id, done: false })}
                style={{ background: "none", border: "none", color: "var(--faint)", textAlign: "left", padding: 0 }}
              >
                ✓ Complete — mark as unfinished
              </button>
            ) : (
              <button className="btn" onClick={() => send({ type: "task", id: t.id, done: true })}>
                Ritual complete
              </button>
            )}
          </div>
        ))}
      </section>

      {me.alive && (
        <section style={{ display: "grid", gap: 10, marginTop: 8 }}>
          <button
            className="btn primary"
            disabled={bm.active}
            onClick={() =>
              setConfirm({ type: "report", title: "Found a Corpse?", body: "Everyone will be summoned to the TV." })
            }
          >
            ☠ Found a Corpse
          </button>
          <button
            className="btn"
            disabled={bm.active || me.bellsLeft <= 0}
            onClick={() =>
              setConfirm({ type: "bell", title: "Ring the Bell?", body: `You have ${me.bellsLeft} left. A séance begins.` })
            }
          >
            🔔 Ring the Bell ({me.bellsLeft} left)
          </button>
          {!traitor && (
            <button
              className="btn ghost"
              onClick={() =>
                setConfirm({
                  type: "claimed",
                  title: "Have you been claimed?",
                  body: "Only if the Possessed tapped you. Lie down where you are and stay silent until found.",
                })
              }
            >
              I&apos;ve been claimed
            </button>
          )}
        </section>
      )}

      {confirm && (
        <div className="overlay fade-in">
          <h2 className="creep blood" style={{ fontSize: "2.4rem" }}>{confirm.title}</h2>
          <p style={{ margin: "12px 0 26px" }}>{confirm.body}</p>
          <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 340 }}>
            <button
              className="btn primary"
              onClick={() => {
                send({ type: confirm.type });
                setConfirm(null);
              }}
            >
              Yes
            </button>
            <button className="btn ghost" onClick={() => setConfirm(null)}>
              No
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TraitorPanel({ s, me, now, send }: { s: View; me: Me; now: number; send: Send }) {
  const killIn = secondsLeft(me.killReadyAt, now);
  const moonIn = secondsLeft(me.summonReadyAt, now);
  const moonOn = s.settings.bloodMoon;
  return (
    <div className="panel" style={{ padding: 14, display: "grid", gap: 10, borderColor: "rgba(255,31,61,.6)" }}>
      <p className="blood" style={{ fontSize: ".95rem" }}>
        {me.allies.length ? `Fellow Possessed: ${me.allies.join(", ")}` : "You hunt alone."}
      </p>
      {me.alive && (
        <button className="btn primary" disabled={killIn > 0} onClick={() => send({ type: "kill" })}>
          {killIn > 0 ? `Hunger returns in ${fmt(killIn)}` : "I claimed a soul (start cooldown)"}
        </button>
      )}
      {moonOn && (
        <button
          className="btn primary"
          disabled={moonIn > 0 || s.bloodMoon.active}
          onClick={() => send({ type: "summon" })}
        >
          {s.bloodMoon.active
            ? "The Blood Moon is rising…"
            : moonIn > 0
              ? `Blood Moon ready in ${fmt(moonIn)}`
              : "🌕 Summon the Blood Moon"}
        </button>
      )}
      {me.alive && (
        <p style={{ color: "var(--dim)", fontSize: ".85rem" }}>
          To claim: tap a Mortal on the shoulder and whisper “you’re mine.” Then press the button.
        </p>
      )}
    </div>
  );
}

// ─── The Séance ──────────────────────────────────────────────

function Seance({ s, me, now, send }: { s: View; me: Me; now: number; send: Send }) {
  const m = s.meeting!;
  const left = secondsLeft(m.endsAt, now);
  const [pick, setPick] = useState<string | null>(null);

  if (m.stage === "summons") {
    const t = summonsText(s);
    return (
      <Center>
        <h1 className="creep blood shake" style={{ fontSize: "3rem", lineHeight: 1.05 }}>{t.title}</h1>
        <p style={{ fontSize: "1.2rem" }}>{t.sub}</p>
        <p className="creep flicker" style={{ fontSize: "2rem", color: "var(--candle)" }}>Gather at the TV</p>
      </Center>
    );
  }

  if (m.stage === "verdict") {
    const v = verdictText(s);
    const mine = m.result?.ejectedId === me.id;
    return (
      <Center>
        <h1 className="creep blood fade-in" style={{ fontSize: "2.6rem", lineHeight: 1.1 }}>
          {mine ? "You have been cast into the void" : v.title}
        </h1>
        <p style={{ fontStyle: "italic" }}>{v.sub}</p>
      </Center>
    );
  }

  const living = s.players.filter((p) => p.alive);

  if (m.stage === "discussion") {
    return (
      <Center>
        <h1 className="creep glow" style={{ fontSize: "2.8rem" }}>The Séance</h1>
        <p style={{ fontStyle: "italic" }}>{deadText(s)}</p>
        <p>{me.alive ? "Speak. Accuse. Defend yourself." : "You are a Spirit. Stay silent."}</p>
        <p style={{ color: "var(--dim)" }}>Voting begins in {fmt(left)}</p>
      </Center>
    );
  }

  // voting
  if (!me.alive) {
    return (
      <Center>
        <h1 className="creep" style={{ fontSize: "2.4rem", color: "#9fb4c7" }}>Spirits Cannot Vote</h1>
        <p style={{ color: "var(--dim)" }}>Watch in silence. {fmt(left)}</p>
      </Center>
    );
  }
  if (me.vote) {
    return (
      <Center>
        <h1 className="creep glow" style={{ fontSize: "2.4rem" }}>Your Vote Is Sealed</h1>
        <p>{me.vote === "skip" ? "You chose mercy." : `You accused ${nameOf(s, me.vote)}.`}</p>
        <p style={{ color: "var(--dim)" }}>
          {m.voted.length}/{living.length} have voted · {fmt(left)}
        </p>
      </Center>
    );
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ textAlign: "center" }}>
        <h1 className="creep blood" style={{ fontSize: "2.4rem" }}>Who Is Possessed?</h1>
        <p style={{ color: "var(--dim)" }}>{fmt(left)} remaining</p>
      </div>
      {living.map((p) => (
        <button
          key={p.id}
          className="btn"
          onClick={() => setPick(p.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderColor: pick === p.id ? "var(--blood-bright)" : undefined,
          }}
        >
          <Soul color={p.color} size={18} />
          {p.name}
          {p.id === me.id && <span style={{ color: "var(--dim)" }}>(you)</span>}
        </button>
      ))}
      <button
        className="btn ghost"
        onClick={() => setPick("skip")}
        style={{ borderColor: pick === "skip" ? "var(--blood-bright)" : undefined }}
      >
        Skip — show mercy
      </button>
      <button
        className="btn primary"
        disabled={!pick}
        onClick={() => pick && send({ type: "vote", target: pick })}
        style={{ fontSize: "1.3rem", marginTop: 8 }}
      >
        Seal my vote
      </button>
    </div>
  );
}

// ─── Game over ───────────────────────────────────────────────

function Over({ s, me }: { s: View; me: Me }) {
  const w = winText(s);
  const won = s.winner?.side === me.role;
  return (
    <Center>
      <h1 className={`creep ${s.winner?.side === "traitor" ? "blood" : "glow"}`} style={{ fontSize: "2.8rem", lineHeight: 1.05 }}>
        {w.title}
      </h1>
      <p style={{ fontStyle: "italic" }}>{w.sub}</p>
      <p className="creep" style={{ fontSize: "2rem", color: won ? "var(--candle)" : "var(--blood-bright)" }}>
        {won ? "You survived" : "You were defeated"}
      </p>
      <div className="panel" style={{ padding: 14, width: "100%", display: "grid", gap: 8 }}>
        {s.players.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Soul color={p.color} size={14} dead={!p.alive} />
            <span style={{ flex: 1, textAlign: "left" }}>{p.name}</span>
            <span className={p.role === "traitor" ? "blood" : ""}>{p.role === "traitor" ? "Possessed" : "Mortal"}</span>
          </div>
        ))}
      </div>
      <p style={{ color: "var(--dim)" }}>Watch the TV for the next game.</p>
    </Center>
  );
}
