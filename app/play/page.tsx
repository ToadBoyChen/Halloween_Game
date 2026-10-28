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
  if (!s)
    content = (
      <Center>
        <p className="creep flicker" style={{ fontSize: "2.4rem" }}>Loading…</p>
      </Center>
    );
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
  else if (s.phase === "meeting") content = <Meeting s={s} me={me} now={now} send={send} />;
  else if (s.phase === "over") content = <Over s={s} me={me} />;
  else content = <Playing s={s} me={me} now={now} send={send} onHide={() => setHidden(true)} />;

  return (
    <>
      <Atmos red={red} />
      <main className="screen phone">
        {offline && (
          <p style={{ textAlign: "center", color: "var(--dim)", fontSize: ".9rem" }}>Reconnecting…</p>
        )}
        {content}
      </main>
      {error && (
        <div
          onClick={() => setError(null)}
          className="panel shake"
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: 16,
            zIndex: 60,
            padding: 16,
            textAlign: "center",
            fontWeight: 800,
            fontSize: "1.1rem",
            borderColor: "var(--blood-bright)",
          }}
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
        minHeight: "85dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 18,
      }}
    >
      {children}
    </div>
  );
}

function Big({ icon, children, red = false }: { icon?: string; children: React.ReactNode; red?: boolean }) {
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
      {icon && <div style={{ fontSize: "4rem", lineHeight: 1 }}>{icon}</div>}
      <h1 className={`creep ${red ? "blood" : "glow"}`} style={{ fontSize: "2.6rem", lineHeight: 1.05 }}>
        {children}
      </h1>
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
      double-tap to come back
    </div>
  );
}

// ─── Join ────────────────────────────────────────────────────

function Join({ state, onJoined }: { state: View; onJoined: (token: string, v: View) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taken = new Set(state.players.map((p) => p.color));
  const available = SOUL_COLORS.filter((c) => !taken.has(c.id));

  if (state.phase !== "lobby") {
    return (
      <Center>
        <Big icon="⏳" red>
          Game in progress
        </Big>
        <p style={{ fontSize: "1.2rem" }}>A game is already running. You can join the next one!</p>
        <p style={{ color: "var(--dim)" }}>This page will update by itself.</p>
      </Center>
    );
  }

  const submit = async (color: string) => {
    if (!name.trim()) return setError("Type your name first.");
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
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 20 }}>
      <div style={{ textAlign: "center" }}>
        <h1 className="creep blood flicker" style={{ fontSize: "3.4rem", lineHeight: 1 }}>POSSESSED</h1>
        <p className="flavor" style={{ color: "var(--dim)", marginTop: 10, fontSize: "1.15rem" }}>Enter, if you dare…</p>
      </div>
      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: "1.15rem" }}>1. Type your name</span>
        <input
          className="input"
          value={name}
          maxLength={16}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          style={{ fontSize: "1.3rem" }}
        />
      </label>
      <div style={{ display: "grid", gap: 4 }}>
        <span style={{ fontWeight: 800, fontSize: "1.15rem" }}>2. Swipe to choose your soul</span>
        {available.length ? (
          <SoulPicker souls={available} busy={busy} onLock={submit} />
        ) : (
          <p className="blood" style={{ textAlign: "center", padding: 20 }}>Every soul has been taken. The game is full!</p>
        )}
      </div>
      {error && (
        <p className="blood" style={{ textAlign: "center", fontWeight: 800 }}>
          {error}
        </p>
      )}
    </div>
  );
}

type SoulType = (typeof SOUL_COLORS)[number];

// Swipe left/right (or tap the arrows) to browse souls, then lock one in.
function SoulPicker({ souls, busy, onLock }: { souls: SoulType[]; busy: boolean; onLock: (id: string) => void }) {
  const [pickId, setPickId] = useState(souls[0].id);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const startX = useRef<number | null>(null);
  // If the soul we were looking at gets taken by someone else, fall back to the first free one.
  const index = Math.max(0, souls.findIndex((c) => c.id === pickId));
  const soul = souls[index];

  const move = (step: 1 | -1) => {
    const next = souls[(index + step + souls.length) % souls.length];
    setDir(step === 1 ? "next" : "prev");
    setPickId(next.id);
    buzz(10);
  };

  return (
    <div
      className="picker"
      onPointerDown={(e) => (startX.current = e.clientX)}
      onPointerUp={(e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1);
      }}
      onPointerCancel={() => (startX.current = null)}
    >
      <button className="arrow left" aria-label="Previous soul" onClick={() => move(-1)}>
        ‹
      </button>
      <button className="arrow right" aria-label="Next soul" onClick={() => move(1)}>
        ›
      </button>
      <div className="stage">
        <div key={soul.id} className={`slide-${dir}`}>
          <Soul color={soul.id} size={120} />
        </div>
      </div>
      <div key={`${soul.id}-name`} className={`slide-${dir}`} style={{ textAlign: "center" }}>
        <p className="creep" style={{ fontSize: "2.2rem", lineHeight: 1, color: soul.hex, textShadow: `0 0 18px ${soul.hex}` }}>
          {soul.kind}
        </p>
        <p style={{ color: "var(--dim)", fontWeight: 600 }}>
          {soul.label} · {index + 1} of {souls.length}
        </p>
      </div>
      <div className="dots">
        {souls.map((c) => (
          <span key={c.id} className={c.id === soul.id ? "on" : ""} style={{ "--c": c.hex } as React.CSSProperties} />
        ))}
      </div>
      <button
        className="btn primary"
        disabled={busy}
        onClick={() => onLock(soul.id)}
        style={{ fontSize: "1.4rem", minHeight: 64, width: "100%", marginTop: 12, borderColor: soul.hex, boxShadow: `0 0 24px ${soul.hex}55 inset` }}
      >
        🔒 Lock in {soul.kind}
      </button>
    </div>
  );
}

// ─── Lobby ───────────────────────────────────────────────────

function Lobby({ s, me, send }: { s: View; me: Me; send: Send }) {
  return (
    <Center>
      <Soul color={me.color} size={90} />
      <Big>You&apos;re in, {me.name}!</Big>
      <p style={{ fontSize: "1.25rem" }}>Look at the TV. The game starts soon.</p>
      <p style={{ color: "var(--dim)" }}>
        {s.players.length} player{s.players.length === 1 ? "" : "s"} joined
      </p>
      <button className="btn ghost" onClick={() => send({ type: "leave" })} style={{ marginTop: 30 }}>
        Leave game
      </button>
    </Center>
  );
}

// ─── Role ────────────────────────────────────────────────────

function RoleCard({ me }: { me: Me }) {
  const traitor = me.role === "traitor";
  const rules = traitor
    ? [
        "Tap someone on the shoulder and whisper “you’re mine”.",
        "Your tasks are fake. Pretend to do them!",
        "Your secret powers are at the bottom of your screen.",
        "Don’t get voted out!",
      ]
    : ["Do your tasks around the house.", "Find a body? Tell everyone.", "Vote out the Possessed."];
  return (
    <div style={{ textAlign: "center", display: "grid", gap: 12 }}>
      <div style={{ fontSize: "4.5rem", lineHeight: 1 }}>{traitor ? "😈" : "🕯️"}</div>
      <p style={{ fontSize: "1.1rem" }}>You are</p>
      <h2
        className={`creep ${traitor ? "blood glitch" : "glow"}`}
        style={{ fontSize: "3.2rem", lineHeight: 1, color: traitor ? undefined : "var(--candle)" }}
      >
        {traitor ? "POSSESSED" : "MORTAL"}
      </h2>
      <p style={{ fontWeight: 800, fontSize: "1.15rem" }}>
        {traitor ? "You’re the secret bad guy. Tell no one!" : "You’re one of the good ones."}
      </p>
      <ul style={{ textAlign: "left", display: "grid", gap: 6, fontSize: "1.05rem" }}>
        {rules.map((r) => (
          <li key={r}>• {r}</li>
        ))}
      </ul>
      {traitor && (
        <p className="blood" style={{ fontWeight: 800 }}>
          {me.allies.length ? `Your teammate: ${me.allies.join(", ")}` : "You are the only one."}
        </p>
      )}
    </div>
  );
}

function holdProps(set: (v: boolean) => void) {
  return {
    onPointerDown: () => set(true),
    onPointerUp: () => set(false),
    onPointerLeave: () => set(false),
    onPointerCancel: () => set(false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

function Reveal({ s, me, now }: { s: View; me: Me; now: number }) {
  const [held, setHeld] = useState(false);
  return (
    <Center>
      <p className="flavor" style={{ fontSize: "1.2rem" }}>One among you is no longer… themselves.</p>
      <div
        {...holdProps(setHeld)}
        className="panel"
        style={{
          width: "100%",
          padding: 24,
          minHeight: 340,
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
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: "4rem" }}>👆</div>
            <p className="creep" style={{ fontSize: "2rem" }}>Press and hold</p>
            <p style={{ fontSize: "1.1rem" }}>to see your secret role</p>
          </div>
        )}
      </div>
      <p style={{ color: "var(--dim)" }}>Starting in {secondsLeft(s.phaseEndsAt, now)}…</p>
    </Center>
  );
}

// ─── Playing ─────────────────────────────────────────────────

type Confirm = { type: string; icon: string; title: string; body: string };

function Playing({ s, me, now, send, onHide }: { s: View; me: Me; now: number; send: Send; onHide: () => void }) {
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [peek, setPeek] = useState(false);
  const traitor = me.role === "traitor";
  const bm = s.bloodMoon;
  const done = me.tasks.filter((t) => t.done).length;
  const pct = s.progress.total ? Math.round((s.progress.done / s.progress.total) * 100) : 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Soul color={me.color} size={22} dead={!me.alive} />
        <strong style={{ fontSize: "1.25rem", flex: 1 }}>{me.name}</strong>
        <button className="btn ghost" style={{ padding: "8px 12px", fontSize: ".95rem", minHeight: 44 }} {...holdProps(setPeek)}>
          👁 Hold: role
        </button>
        <button className="btn ghost" style={{ padding: "8px 12px", fontSize: ".95rem", minHeight: 44 }} onClick={onHide}>
          🙈 Hide
        </button>
      </header>

      {peek && (
        <div className="panel" style={{ padding: 18 }}>
          <RoleCard me={me} />
        </div>
      )}

      {bm.active && (
        <div className="panel shake" style={{ padding: 18, borderColor: "var(--blood-bright)", textAlign: "center", display: "grid", gap: 6 }}>
          <div style={{ fontSize: "3rem", lineHeight: 1 }}>🌕</div>
          <h2 className="creep blood" style={{ fontSize: "2.2rem" }}>Blood Moon!</h2>
          <p className="creep blood" style={{ fontSize: "3.4rem", lineHeight: 1 }}>{secondsLeft(bm.endsAt, now)}</p>
          <p style={{ fontWeight: 800, fontSize: "1.1rem" }}>Hurry! Find the 2 cards at:</p>
          <p style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--candle)" }}>📍 {bm.locations.join("  +  📍 ")}</p>
          <p style={{ fontWeight: 600 }}>Then type both cards into the TV.</p>
        </div>
      )}

      {!me.alive && (
        <div className="panel" style={{ padding: 18, textAlign: "center", display: "grid", gap: 6 }}>
          <div style={{ fontSize: "3rem", lineHeight: 1 }}>👻</div>
          <h2 className="creep" style={{ fontSize: "2rem", color: "#9fd0ff" }}>
            {me.ejected ? "You were voted out" : "You are a ghost"}
          </h2>
          <p style={{ fontWeight: 800 }}>Shh! Don’t talk.</p>
          <p>{traitor ? "You can still summon the Blood Moon." : "You can still do your tasks to help your team!"}</p>
        </div>
      )}

      <section style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
          <span>🕯️ Team progress</span>
          <span>{pct}%</span>
        </div>
        <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
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
        <h3 className="creep" style={{ fontSize: "1.9rem" }}>
          Your Tasks{" "}
          <span style={{ fontFamily: "var(--body)", fontSize: "1.05rem", color: "var(--dim)", fontWeight: 800 }}>
            {done} of {me.tasks.length} done
          </span>
        </h3>
        <p style={{ color: "var(--dim)", fontWeight: 600 }}>Go to the place, do what it says, then tap Done.</p>
        {me.tasks.map((t) => (
          <div key={t.id} className="panel" style={{ padding: 16, display: "grid", gap: 8, opacity: t.done ? 0.6 : 1 }}>
            <div style={{ color: "var(--candle)", fontWeight: 800, fontSize: "1.05rem" }}>📍 {t.location}</div>
            <strong style={{ fontSize: "1.3rem", textDecoration: t.done ? "line-through" : "none" }}>{t.name}</strong>
            {!t.done && <p style={{ fontSize: "1.1rem" }}>{t.instructions}</p>}
            {t.done ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#7fdc8a", fontWeight: 800, fontSize: "1.1rem" }}>✓ Done</span>
                <button
                  onClick={() => send({ type: "task", id: t.id, done: false })}
                  style={{ background: "none", border: "none", color: "var(--dim)", textDecoration: "underline", padding: 8 }}
                >
                  Undo
                </button>
              </div>
            ) : (
              <button className="btn" onClick={() => send({ type: "task", id: t.id, done: true })} style={{ fontSize: "1.25rem" }}>
                ✓ Done!
              </button>
            )}
          </div>
        ))}
      </section>

      {me.alive && (
        <section style={{ display: "grid", gap: 10, marginTop: 8 }}>
          <button
            className="btn primary action"
            disabled={bm.active}
            onClick={() =>
              setConfirm({ type: "report", icon: "💀", title: "Did you find a body?", body: "Everyone will go to the TV to talk." })
            }
          >
            <span className="icon">💀</span>
            <span>
              I found a body
              <small>Calls everyone to the TV</small>
            </span>
          </button>
          <button
            className="btn action"
            disabled={bm.active || me.bellsLeft <= 0}
            onClick={() =>
              setConfirm({
                type: "bell",
                icon: "🔔",
                title: "Ring the bell?",
                body: `This calls an emergency meeting. You only get ${s.settings.bellsPerPlayer === 1 ? "one" : s.settings.bellsPerPlayer}!`,
              })
            }
          >
            <span className="icon">🔔</span>
            <span>
              Ring the bell
              <small>{me.bellsLeft > 0 ? `Emergency meeting · ${me.bellsLeft} left` : "No bells left"}</small>
            </span>
          </button>
          {!traitor && (
            <button
              className="btn ghost action"
              onClick={() =>
                setConfirm({
                  type: "claimed",
                  icon: "👻",
                  title: "Did you get caught?",
                  body: "Only press Yes if the Possessed tapped your shoulder. Then lie down and stay quiet until someone finds you.",
                })
              }
            >
              <span className="icon">👻</span>
              <span>
                I got caught
                <small>The Possessed tapped me</small>
              </span>
            </button>
          )}
          {bm.active && <p style={{ textAlign: "center", color: "var(--dim)" }}>No meetings during the Blood Moon!</p>}
        </section>
      )}

      {/* Kept at the bottom so the top of the screen looks the same for every role. */}
      {traitor && <PossessedPowers s={s} me={me} now={now} send={send} />}

      {confirm && (
        <div className="overlay fade-in">
          <div style={{ fontSize: "4rem" }}>{confirm.icon}</div>
          <h2 className="creep blood" style={{ fontSize: "2.4rem", lineHeight: 1.1 }}>{confirm.title}</h2>
          <p style={{ margin: "12px 0 26px", fontSize: "1.2rem" }}>{confirm.body}</p>
          <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 340 }}>
            <button
              className="btn primary"
              style={{ fontSize: "1.3rem" }}
              onClick={() => {
                send({ type: confirm.type });
                setConfirm(null);
              }}
            >
              Yes
            </button>
            <button className="btn ghost" style={{ fontSize: "1.3rem" }} onClick={() => setConfirm(null)}>
              No, go back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PossessedPowers({ s, me, now, send }: { s: View; me: Me; now: number; send: Send }) {
  const killIn = secondsLeft(me.killReadyAt, now);
  const moonIn = secondsLeft(me.summonReadyAt, now);
  return (
    <div className="panel" style={{ padding: 16, display: "grid", gap: 10, borderColor: "rgba(255,31,61,.6)" }}>
      <h3 className="creep blood" style={{ fontSize: "1.6rem" }}>😈 Your secret powers</h3>
      {me.allies.length > 0 && <p style={{ fontWeight: 800 }}>Teammate: {me.allies.join(", ")}</p>}
      {me.alive && (
        <button className="btn primary action" disabled={killIn > 0} onClick={() => send({ type: "kill" })}>
          <span className="icon">🩸</span>
          <span>
            {killIn > 0 ? `Wait ${fmt(killIn)}` : "I caught someone"}
            <small>{killIn > 0 ? "Before you can catch someone again" : "Press after you tap someone"}</small>
          </span>
        </button>
      )}
      {s.settings.bloodMoon && (
        <button className="btn primary action" disabled={moonIn > 0 || s.bloodMoon.active} onClick={() => send({ type: "summon" })}>
          <span className="icon">🌕</span>
          <span>
            Summon the Blood Moon
            <small>
              {s.bloodMoon.active ? "It’s rising now!" : moonIn > 0 ? `Ready in ${fmt(moonIn)}` : "They get 60 seconds to stop it"}
            </small>
          </span>
        </button>
      )}
    </div>
  );
}

// ─── Meeting ─────────────────────────────────────────────────

function Meeting({ s, me, now, send }: { s: View; me: Me; now: number; send: Send }) {
  const m = s.meeting!;
  const left = secondsLeft(m.endsAt, now);
  const [pick, setPick] = useState<string | null>(null);

  if (m.stage === "summons") {
    const t = summonsText(s);
    return (
      <Center>
        <Big icon={m.reason === "report" ? "💀" : "🔔"} red>
          {t.title}
        </Big>
        <p style={{ fontSize: "1.3rem", fontWeight: 600 }}>{t.sub}</p>
        <p className="creep flicker" style={{ fontSize: "2.2rem", color: "var(--candle)" }}>Go to the TV now!</p>
      </Center>
    );
  }

  if (m.stage === "verdict") {
    const v = verdictText(s);
    const mine = m.result?.ejectedId === me.id;
    return (
      <Center>
        <Big icon={m.result?.ejectedId ? "🌀" : "🤷"} red>
          {mine ? "You were voted out!" : v.title}
        </Big>
        <p className="flavor" style={{ fontSize: "1.2rem" }}>{v.flavor}</p>
        <p style={{ fontSize: "1.2rem", fontWeight: 600 }}>{v.sub}</p>
      </Center>
    );
  }

  const living = s.players.filter((p) => p.alive);

  if (m.stage === "discussion") {
    return (
      <Center>
        <Big icon="🗣️">Talk time</Big>
        <p style={{ fontSize: "1.3rem", fontWeight: 800 }}>
          {me.alive ? "Who is the Possessed? Talk it out!" : "You’re a ghost. Shh, no talking!"}
        </p>
        <p style={{ fontSize: "1.1rem" }}>{deadText(s)}</p>
        <p style={{ color: "var(--dim)", fontSize: "1.1rem" }}>Voting starts in {fmt(left)}</p>
      </Center>
    );
  }

  // voting
  if (!me.alive) {
    return (
      <Center>
        <Big icon="👻">Ghosts can’t vote</Big>
        <p style={{ fontSize: "1.1rem" }}>Watch quietly. {fmt(left)} left.</p>
      </Center>
    );
  }
  if (me.vote) {
    return (
      <Center>
        <Big icon="✅">Vote sent!</Big>
        <p style={{ fontSize: "1.2rem" }}>{me.vote === "skip" ? "You skipped." : `You voted for ${nameOf(s, me.vote)}.`}</p>
        <p style={{ color: "var(--dim)" }}>
          {m.voted.length} of {living.length} voted · {fmt(left)} left
        </p>
      </Center>
    );
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ textAlign: "center" }}>
        <h1 className="creep blood" style={{ fontSize: "2.4rem" }}>Who is Possessed?</h1>
        <p style={{ fontWeight: 600 }}>Tap a name, then tap Vote. {fmt(left)} left.</p>
      </div>
      {living.map((p) => (
        <button
          key={p.id}
          className="btn"
          onClick={() => setPick(p.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: "1.3rem",
            borderWidth: pick === p.id ? 3 : 1,
            borderColor: pick === p.id ? "var(--blood-bright)" : undefined,
          }}
        >
          <Soul color={p.color} size={22} />
          {p.name}
          {p.id === me.id && <span style={{ color: "var(--dim)", fontWeight: 600 }}>(you)</span>}
          {pick === p.id && <span style={{ marginLeft: "auto" }}>👈</span>}
        </button>
      ))}
      <button
        className="btn ghost"
        onClick={() => setPick("skip")}
        style={{ fontSize: "1.2rem", borderWidth: pick === "skip" ? 3 : 1, borderColor: pick === "skip" ? "var(--blood-bright)" : undefined }}
      >
        🤷 Skip (not sure)
      </button>
      <button
        className="btn primary"
        disabled={!pick}
        onClick={() => pick && send({ type: "vote", target: pick })}
        style={{ fontSize: "1.4rem", minHeight: 64, marginTop: 8 }}
      >
        🗳️ Vote
      </button>
    </div>
  );
}

// ─── Game over ───────────────────────────────────────────────

function Over({ s, me }: { s: View; me: Me }) {
  const w = winText(s);
  const traitorWin = s.winner?.side === "traitor";
  const won = s.winner?.side === me.role;
  return (
    <Center>
      <div style={{ fontSize: "4rem", lineHeight: 1 }}>{won ? "🎉" : "💀"}</div>
      <p className="creep" style={{ fontSize: "2.2rem", color: won ? "#7fdc8a" : "var(--blood-bright)" }}>
        {won ? "Your team won!" : "Your team lost"}
      </p>
      <h1 className={`creep ${traitorWin ? "blood" : "glow"}`} style={{ fontSize: "2.4rem", lineHeight: 1.05, color: traitorWin ? undefined : "var(--candle)" }}>
        {w.title}
      </h1>
      <p className="flavor" style={{ fontSize: "1.15rem" }}>{w.flavor}</p>
      <p style={{ fontWeight: 600 }}>{w.sub}</p>
      <div className="panel" style={{ padding: 16, width: "100%", display: "grid", gap: 10 }}>
        {s.players.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "1.1rem" }}>
            <Soul color={p.color} size={16} dead={!p.alive} />
            <span style={{ flex: 1, textAlign: "left" }}>{p.name}</span>
            <span className={p.role === "traitor" ? "blood" : ""} style={{ fontWeight: 800 }}>
              {p.role === "traitor" ? "😈 Possessed" : "🕯️ Mortal"}
            </span>
          </div>
        ))}
      </div>
      <p style={{ color: "var(--dim)" }}>Look at the TV for the next game.</p>
    </Center>
  );
}
