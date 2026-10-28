"use client";

import { useEffect, useRef, useState } from "react";
import { SOUL_COLORS } from "@/config/game";
import { haunt } from "@/lib/audio";
import { useEventSounds } from "@/lib/sounds";
import {
  buzz,
  dur,
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
const SOUND_KEY = "possessed-sound";

type Me = NonNullable<View["me"]>;
type Send = (body: Record<string, unknown>) => Promise<void>;
type Sound = { on: boolean; toggle: () => void };

export default function PlayPage() {
  const mounted = useMounted();
  return mounted ? <Phone /> : <Atmos />;
}

function readKey(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

function Phone() {
  const [token, setToken] = useState<string | null>(() => readKey(TOKEN_KEY));
  const forget = () => {
    writeKey(TOKEN_KEY, null);
    setToken(null);
  };
  const { state, offline, accept, serverNow } = useGame(token, forget);
  const [error, setError] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(() => readKey(SOUND_KEY) !== "off");
  useWakeLock();
  useTicker(500);

  // Browsers only allow sound after a tap, so unlock audio on the first one.
  useEffect(() => {
    if (!soundOn) return;
    const unlock = () => haunt.awaken(false);
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, [soundOn]);
  useEventSounds(state, soundOn);
  const sound: Sound = {
    on: soundOn,
    toggle: () => {
      writeKey(SOUND_KEY, soundOn ? "off" : "on");
      if (!soundOn) haunt.awaken(false);
      setSoundOn(!soundOn);
    },
  };

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
  const playing = !!s && !!me && token && s.phase === "playing";

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
          writeKey(TOKEN_KEY, t);
          setToken(t);
          accept(v);
        }}
      />
    );
  else if (s.phase === "lobby") content = <Lobby s={s} me={me} send={send} sound={sound} />;
  else if (s.phase === "reveal") content = <Reveal s={s} me={me} now={now} />;
  else if (s.phase === "meeting") content = <Meeting s={s} me={me} now={now} send={send} />;
  else if (s.phase === "over") content = <Over s={s} me={me} />;
  else content = <Playing s={s} me={me} now={now} send={send} sound={sound} />;

  return (
    <>
      <Atmos red={red} />
      <main className={`screen ${playing ? "game" : "phone"}`}>
        {offline && <p style={{ textAlign: "center", color: "var(--dim)", fontSize: ".9rem" }}>Reconnecting…</p>}
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
    </>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "calc(100dvh - 32px)",
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

function Big({ icon, children, red = false }: { icon?: string; children: React.ReactNode; red?: boolean }) {
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
      {icon && <div style={{ fontSize: "3.6rem", lineHeight: 1 }}>{icon}</div>}
      <h1 className={`creep ${red ? "blood" : "glow"}`} style={{ fontSize: "2.5rem", lineHeight: 1.05 }}>
        {children}
      </h1>
    </div>
  );
}

function SoundButton({ sound }: { sound: Sound }) {
  return (
    <button
      className="btn ghost"
      onClick={sound.toggle}
      aria-label={sound.on ? "Turn sound off" : "Turn sound on"}
      style={{ padding: "6px 12px", minHeight: 44, fontSize: "1.2rem" }}
    >
      {sound.on ? "🔊" : "🔇"}
    </button>
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
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 4 }}>
      <div style={{ textAlign: "center" }}>
        <h1 className="creep blood flicker join-title">POSSESSED</h1>
        <p className="flavor join-flavor">Enter, if you dare…</p>
      </div>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>1. Type your name</span>
        <input
          className="input"
          value={name}
          maxLength={16}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          style={{ fontSize: "1.25rem", padding: "12px 16px" }}
        />
      </label>
      <div style={{ display: "grid", gap: 2 }}>
        <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>2. Swipe to choose your soul</span>
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
  // If the soul we were looking at gets taken by someone else, fall back to the first free one.
  const index = Math.max(0, souls.findIndex((c) => c.id === pickId));
  const soul = souls[index];

  const move = (step: 1 | -1) => {
    const next = souls[(index + step + souls.length) % souls.length];
    setDir(step === 1 ? "next" : "prev");
    setPickId(next.id);
    buzz(10);
  };

  const swipe = useSwipe(move);

  return (
    <div className="picker" {...swipe}>
      <button className="arrow left" aria-label="Previous soul" onClick={() => move(-1)}>
        ‹
      </button>
      <button className="arrow right" aria-label="Next soul" onClick={() => move(1)}>
        ›
      </button>
      <div className="stage">
        <div key={soul.id} className={`slide-${dir}`}>
          <Soul color={soul.id} size={104} />
        </div>
      </div>
      <div key={`${soul.id}-name`} className={`slide-${dir}`} style={{ textAlign: "center" }}>
        <p className="creep" style={{ fontSize: "2.1rem", lineHeight: 1, color: soul.hex, textShadow: `0 0 18px ${soul.hex}` }}>
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
        style={{ fontSize: "1.35rem", minHeight: 60, width: "100%", marginTop: 8, borderColor: soul.hex, boxShadow: `0 0 24px ${soul.hex}55 inset` }}
      >
        🔒 Lock in {soul.kind}
      </button>
    </div>
  );
}

// Swipe left/right handlers: a horizontal drag of 40px+ calls move(+1 / -1).
function useSwipe(move: (step: 1 | -1) => void) {
  const startX = useRef<number | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      startX.current = e.clientX;
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (startX.current === null) return;
      const dx = e.clientX - startX.current;
      startX.current = null;
      if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1);
    },
    onPointerCancel: () => {
      startX.current = null;
    },
  };
}

// ─── Lobby ───────────────────────────────────────────────────

function Lobby({ s, me, send, sound }: { s: View; me: Me; send: Send; sound: Sound }) {
  return (
    <Center>
      <Soul color={me.color} size={90} />
      <Big>You&apos;re in, {me.name}!</Big>
      <p style={{ fontSize: "1.25rem" }}>Look at the TV. The game starts soon.</p>
      <p style={{ color: "var(--dim)" }}>
        {s.players.length} player{s.players.length === 1 ? "" : "s"} joined
      </p>
      <button className="btn" onClick={sound.toggle} style={{ width: "100%", marginTop: 12 }}>
        {sound.on ? "🔊 Sound is on" : "🔇 Sound is off"}
        <small style={{ display: "block", fontWeight: 600, fontSize: ".85rem", color: "var(--dim)" }}>
          {sound.on ? "You'll hear meetings and the Blood Moon" : "Tap to hear meetings and the Blood Moon"}
        </small>
      </button>
      <button className="btn ghost" onClick={() => send({ type: "leave" })}>
        Leave game
      </button>
    </Center>
  );
}

// ─── Role ────────────────────────────────────────────────────

function RoleCard({ me, compact = false }: { me: Me; compact?: boolean }) {
  const traitor = me.role === "traitor";
  const rules = traitor
    ? [
        "Tap a Mortal’s shoulder and whisper “you’re mine” to kill them.",
        "Wait for the timer between kills.",
        "Your tasks are fake. Pretend to do them!",
        "Don’t get voted out!",
      ]
    : [
        "Do your tasks around the house.",
        "If the Possessed taps your shoulder, press “I was killed”.",
        "Find a body? Tell everyone. Vote out the Possessed!",
      ];
  return (
    <div style={{ textAlign: "center", display: "grid", gap: compact ? 8 : 12 }}>
      <div style={{ fontSize: compact ? "3.2rem" : "4.2rem", lineHeight: 1 }}>{traitor ? "😈" : "🕯️"}</div>
      <h2
        className={`creep ${traitor ? "blood glitch" : "glow"}`}
        style={{ fontSize: compact ? "2.6rem" : "3.1rem", lineHeight: 1, color: traitor ? undefined : "var(--candle)" }}
      >
        {traitor ? "POSSESSED" : "MORTAL"}
      </h2>
      <p style={{ fontWeight: 800, fontSize: "1.1rem" }}>
        {traitor ? "You’re the secret bad guy. Tell no one!" : "You’re one of the good ones."}
      </p>
      <ul style={{ textAlign: "left", display: "grid", gap: 5, fontSize: "1rem" }}>
        {rules.map((r) => (
          <li key={r}>• {r}</li>
        ))}
      </ul>
      {traitor && (
        <p className="blood" style={{ fontWeight: 800 }}>
          {me.allies.length ? `Your teammate: ${me.allies.join(", ")}` : "You are the only Possessed."}
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

function HoldToSee({ me, style }: { me: Me; style?: React.CSSProperties }) {
  const [held, setHeld] = useState(false);
  return (
    <div
      {...holdProps(setHeld)}
      className="panel"
      style={{
        padding: 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "none",
        borderColor: held && me.role === "traitor" ? "var(--blood-bright)" : undefined,
        ...style,
      }}
    >
      {held ? (
        <RoleCard me={me} compact />
      ) : (
        <div style={{ display: "grid", gap: 10, textAlign: "center" }}>
          <div style={{ fontSize: "3.6rem" }}>👆</div>
          <p className="creep" style={{ fontSize: "2rem" }}>Press and hold</p>
          <p style={{ fontSize: "1.1rem" }}>to see your secret role</p>
          <p style={{ color: "var(--dim)", fontSize: ".9rem" }}>Make sure no one is looking!</p>
        </div>
      )}
    </div>
  );
}

function Reveal({ s, me, now }: { s: View; me: Me; now: number }) {
  return (
    <Center>
      <p className="flavor" style={{ fontSize: "1.2rem" }}>One among you is no longer… themselves.</p>
      <HoldToSee me={me} style={{ width: "100%", minHeight: 360 }} />
      <p style={{ color: "var(--dim)" }}>Starting in {secondsLeft(s.phaseEndsAt, now)}…</p>
    </Center>
  );
}

// ─── Playing: tabs for Tasks / Actions / Role ────────────────

type Tab = "tasks" | "actions" | "role";
type Confirm = { type: string; icon: string; title: string; body: string };

function Playing({ s, me, now, send, sound }: { s: View; me: Me; now: number; send: Send; sound: Sound }) {
  const [tab, setTab] = useState<Tab>("tasks");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const bm = s.bloodMoon;
  const done = me.tasks.filter((t) => t.done).length;
  const pct = s.progress.total ? Math.round((s.progress.done / s.progress.total) * 100) : 0;

  return (
    <>
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Soul color={me.color} size={26} dead={!me.alive} />
        <strong style={{ fontSize: "1.25rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {me.name}
        </strong>
        <SoundButton sound={sound} />
      </header>

      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: ".9rem" }}>
          <span>🕯️ Team progress</span>
          <span>{pct}%</span>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
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
      </div>

      {bm.active && (
        <div className="panel shake" style={{ padding: "10px 14px", borderColor: "var(--blood-bright)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "2.2rem" }}>🌕</span>
          <div style={{ flex: 1 }}>
            <strong className="blood" style={{ fontSize: "1.15rem" }}>BLOOD MOON! Find the cards:</strong>
            <div style={{ fontWeight: 800, color: "var(--candle)" }}>📍 {bm.locations.join("  +  📍 ")}</div>
            <div style={{ fontSize: ".9rem" }}>Then type both into the TV.</div>
          </div>
          <span className="creep blood" style={{ fontSize: "2.4rem" }}>{secondsLeft(bm.endsAt, now)}</span>
        </div>
      )}

      {!me.alive && (
        <div className="panel" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "2.2rem" }}>👻</span>
          <div>
            <strong style={{ color: "#9fd0ff", fontSize: "1.1rem" }}>{me.ejected ? "You were voted out." : "You are a ghost."} Shh!</strong>
            <div style={{ fontSize: ".95rem" }}>
              {me.role === "traitor" ? "Don’t talk. You can still summon the Blood Moon." : "Don’t talk. You can still do tasks to help!"}
            </div>
          </div>
        </div>
      )}

      <nav className="tabs" role="tablist">
        {(
          [
            ["tasks", "📜", "Tasks", `${done}/${me.tasks.length}`],
            ["actions", "⚡", "Actions", null],
            ["role", "👁", "Role", null],
          ] as const
        ).map(([id, icon, label, badge]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>
            <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>{icon}</span>
            <span>
              {label}
              {badge && <span className="badge">{badge}</span>}
            </span>
          </button>
        ))}
      </nav>

      <div className="tab-body">
        {tab === "tasks" && <TasksTab me={me} send={send} />}
        {tab === "actions" && <ActionsTab s={s} me={me} now={now} send={send} confirm={setConfirm} />}
        {tab === "role" && <HoldToSee me={me} style={{ flex: 1 }} />}
      </div>

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
    </>
  );
}

// One big task card at a time; chips along the top jump between tasks.
function TasksTab({ me, send }: { me: Me; send: Send }) {
  const firstTodo = me.tasks.find((t) => !t.done)?.id ?? me.tasks[0]?.id;
  const [selId, setSelId] = useState(firstTodo);
  const index = Math.max(0, me.tasks.findIndex((t) => t.id === selId));
  const task = me.tasks[index];
  const allDone = me.tasks.length > 0 && me.tasks.every((t) => t.done);
  const move = (step: 1 | -1) => setSelId(me.tasks[(index + step + me.tasks.length) % me.tasks.length].id);
  const swipe = useSwipe(move);
  if (!task) return null;

  const complete = async () => {
    await send({ type: "task", id: task.id, done: true });
    const next = me.tasks.find((t) => !t.done && t.id !== task.id);
    if (next) setSelId(next.id);
  };

  return (
    <>
      <div className="chips" style={{ gridTemplateColumns: `repeat(${me.tasks.length}, 1fr)` }}>
        {me.tasks.map((t, i) => (
          <button key={t.id} className={`chip ${t.id === task.id ? "on" : ""} ${t.done ? "done" : ""}`} onClick={() => setSelId(t.id)}>
            {t.done ? "✓" : i + 1}
          </button>
        ))}
      </div>

      <div key={task.id} className="panel task-card fade-in" {...swipe}>
        <div style={{ color: "var(--candle)", fontWeight: 800, fontSize: "1.2rem" }}>📍 {task.location}</div>
        <h3 style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1.15, textDecoration: task.done ? "line-through" : "none" }}>
          {task.name}
        </h3>
        <p style={{ fontSize: "1.2rem", lineHeight: 1.4 }}>{task.instructions}</p>
        <div style={{ marginTop: "auto", display: "grid", gap: 8 }}>
          {allDone && (
            <p style={{ textAlign: "center", fontWeight: 800, color: "#7fdc8a" }}>
              🎉 All your tasks are done! {me.role === "traitor" ? "Keep blending in…" : "Watch out for the Possessed…"}
            </p>
          )}
          {task.done ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "#7fdc8a", fontWeight: 800, fontSize: "1.3rem" }}>✓ Done</span>
              <button
                onClick={() => send({ type: "task", id: task.id, done: false })}
                style={{ background: "none", border: "none", color: "var(--dim)", textDecoration: "underline", padding: 8 }}
              >
                Undo
              </button>
            </div>
          ) : (
            <button className="btn primary" onClick={complete} style={{ fontSize: "1.4rem", minHeight: 64 }}>
              ✓ Done!
            </button>
          )}
          <p style={{ textAlign: "center", color: "var(--dim)", fontSize: ".85rem" }}>
            Task {index + 1} of {me.tasks.length} · swipe for the next one
          </p>
        </div>
      </div>
    </>
  );
}

function ActionsTab({
  s,
  me,
  now,
  send,
  confirm,
}: {
  s: View;
  me: Me;
  now: number;
  send: Send;
  confirm: (c: Confirm) => void;
}) {
  const traitor = me.role === "traitor";
  const bm = s.bloodMoon;
  const killIn = secondsLeft(me.killReadyAt, now);
  const moonIn = secondsLeft(me.summonReadyAt, now);

  if (!me.alive && !(traitor && s.settings.bloodMoon)) {
    return (
      <div className="panel" style={{ flex: 1, display: "grid", placeContent: "center", textAlign: "center", gap: 10, padding: 20 }}>
        <div style={{ fontSize: "3.5rem" }}>👻</div>
        <p className="creep" style={{ fontSize: "2rem", color: "#9fd0ff" }}>Ghosts can’t use actions</p>
        <p>You can still finish your tasks.</p>
      </div>
    );
  }

  return (
    <div className="actions">
      {traitor && me.alive && (
        <div
          className="panel action-tile"
          style={{
            borderColor: killIn > 0 ? "var(--faint)" : "var(--blood-bright)",
            boxShadow: killIn > 0 ? "none" : "0 0 22px rgba(255,31,61,.3) inset",
          }}
        >
          <span className="icon">{killIn > 0 ? "⏳" : "🔪"}</span>
          <span>
            {killIn > 0 ? `Wait ${dur(killIn)} to kill again` : "Ready to kill!"}
            <small>Tap a Mortal’s shoulder, whisper “you’re mine”</small>
          </span>
        </div>
      )}
      {traitor && s.settings.bloodMoon && (
        <button className="btn primary action action-tile" disabled={moonIn > 0 || bm.active} onClick={() => send({ type: "summon" })}>
          <span className="icon">🌕</span>
          <span>
            Summon the Blood Moon
            <small>
              {bm.active ? "It’s rising now!" : moonIn > 0 ? `Ready in ${dur(moonIn)}` : `They get ${s.settings.bloodMoonDuration}s to stop it`}
            </small>
          </span>
        </button>
      )}
      {me.alive && (
        <>
          <button
            className="btn primary action action-tile"
            disabled={bm.active}
            onClick={() => confirm({ type: "report", icon: "💀", title: "Did you find a body?", body: "Everyone will go to the TV to talk." })}
          >
            <span className="icon">💀</span>
            <span>
              I found a body
              <small>{bm.active ? "Not during the Blood Moon!" : "Calls everyone to the TV"}</small>
            </span>
          </button>
          <button
            className="btn action action-tile"
            disabled={bm.active || me.bellsLeft <= 0}
            onClick={() =>
              confirm({
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
              <small>{bm.active ? "Not during the Blood Moon!" : me.bellsLeft > 0 ? `Emergency meeting · ${me.bellsLeft} left` : "No bells left"}</small>
            </span>
          </button>
        </>
      )}
      {me.alive && !traitor && (
        <button
          className="btn ghost action action-tile"
          onClick={() =>
            confirm({
              type: "claimed",
              icon: "💀",
              title: "Were you killed?",
              body: "Only press Yes if the Possessed tapped your shoulder. Then lie down and stay quiet until someone finds you.",
            })
          }
        >
          <span className="icon">🔪</span>
          <span>
            I was killed
            <small>The Possessed tapped my shoulder</small>
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
        <p style={{ color: "var(--dim)", fontSize: "1.1rem" }}>Voting starts in {dur(left)}</p>
      </Center>
    );
  }

  // voting
  if (!me.alive) {
    return (
      <Center>
        <Big icon="👻">Ghosts can’t vote</Big>
        <p style={{ fontSize: "1.1rem" }}>Watch quietly. {dur(left)} left.</p>
      </Center>
    );
  }
  if (me.vote) {
    return (
      <Center>
        <Big icon="✅">Vote sent!</Big>
        <p style={{ fontSize: "1.2rem" }}>{me.vote === "skip" ? "You skipped." : `You voted for ${nameOf(s, me.vote)}.`}</p>
        <p style={{ color: "var(--dim)" }}>
          {m.voted.length} of {living.length} voted · {dur(left)} left
        </p>
      </Center>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: "calc(100dvh - 32px)" }}>
      <div style={{ textAlign: "center" }}>
        <h1 className="creep blood" style={{ fontSize: "2.1rem", lineHeight: 1.1 }}>Who is Possessed?</h1>
        <p style={{ fontWeight: 600 }}>Tap a name, then tap Vote · {dur(left)} left</p>
      </div>
      <div className="vote-grid">
        {living.map((p) => (
          <button
            key={p.id}
            className="btn"
            onClick={() => setPick(p.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: "1.1rem",
              borderWidth: pick === p.id ? 3 : 1,
              borderColor: pick === p.id ? "var(--blood-bright)" : undefined,
              overflow: "hidden",
            }}
          >
            <Soul color={p.color} size={22} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.name}
              {p.id === me.id ? " (you)" : ""}
            </span>
          </button>
        ))}
      </div>
      <button
        className="btn ghost"
        onClick={() => setPick("skip")}
        style={{ fontSize: "1.15rem", borderWidth: pick === "skip" ? 3 : 1, borderColor: pick === "skip" ? "var(--blood-bright)" : undefined }}
      >
        🤷 Skip (not sure)
      </button>
      <button
        className="btn primary"
        disabled={!pick}
        onClick={() => pick && send({ type: "vote", target: pick })}
        style={{ fontSize: "1.35rem", minHeight: 56, marginTop: "auto" }}
      >
        🗳️ Vote{pick ? (pick === "skip" ? ": Skip" : `: ${nameOf(s, pick)}`) : ""}
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
      <div style={{ fontSize: "3.4rem", lineHeight: 1 }}>{won ? "🎉" : "💀"}</div>
      <p className="creep" style={{ fontSize: "2rem", color: won ? "#7fdc8a" : "var(--blood-bright)" }}>
        {won ? "Your team won!" : "Your team lost"}
      </p>
      <h1 className={`creep ${traitorWin ? "blood" : "glow"}`} style={{ fontSize: "2.2rem", lineHeight: 1.05, color: traitorWin ? undefined : "var(--candle)" }}>
        {w.title}
      </h1>
      <p style={{ fontWeight: 600 }}>{w.sub}</p>
      <div className="panel" style={{ padding: 12, width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {s.players.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: ".95rem", overflow: "hidden" }}>
            <Soul color={p.color} size={14} dead={!p.alive} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.role === "traitor" ? "😈" : "🕯️"} {p.name}
            </span>
          </div>
        ))}
      </div>
      <p style={{ color: "var(--dim)" }}>Look at the TV for the next game.</p>
    </Center>
  );
}
