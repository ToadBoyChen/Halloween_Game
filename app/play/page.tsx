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
import { Atmos, nameOf, Soul, summonsText } from "@/components/shared";

const TOKEN_KEY = "possessed-token";
const SOUND_KEY = "possessed-sound";

type Me = NonNullable<View["me"]>;
type Send = (body: Record<string, unknown>) => Promise<boolean>; // true if the action worked
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
    const unlock = () => haunt.awaken();
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, [soundOn]);
  useEventSounds(state, soundOn);
  const sound: Sound = {
    on: soundOn,
    toggle: () => {
      writeKey(SOUND_KEY, soundOn ? "off" : "on");
      if (!soundOn) haunt.awaken();
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
      return true;
    } catch (e) {
      setError((e as Error).message);
      buzz(80);
      return false;
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
  else if (s.phase === "reveal") content = <Reveal s={s} me={me} send={send} />;
  else if (s.phase === "meeting") content = <Meeting s={s} me={me} now={now} send={send} />;
  else if (s.phase === "over") content = <Over s={s} me={me} />;
  else content = <Playing s={s} me={me} now={now} send={send} sound={sound} />;

  return (
    <>
      <Atmos red={red} hush={!!s?.hush.active} />
      <main className={`screen ${playing ? "game" : "phone"} ${s?.hush.active ? "hushed" : ""}`}>
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
      <MyNumber s={s} me={me} />
      <LookAtTV>Look at the TV. The game starts soon.</LookAtTV>
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
  const lantern = !traitor && me.special === "lantern";
  const rules = traitor
    ? [
        "Tap a Mortal’s shoulder and whisper “you’re mine” to kill them.",
        "Your rituals count too. Do some to blend in, but not too many!",
        "Summon the Blood Moon or call the Hush from ⚡ Actions.",
        "Don’t get voted out!",
      ]
    : [
        "Claim rituals and do them around the house.",
        "Someone whispers “you’re mine”? You’re dead. Lie still until you’re found.",
        "Once found, you’re a ghost: finish rituals, silently.",
        "Found a body? Report it in ⚡ Actions.",
      ];
  if (lantern) rules.splice(1, 0, "🏮 Once per game, in talk time: pick three players. The TV shows how many are Possessed.");
  return (
    <div style={{ textAlign: "center", display: "grid", gap: compact ? 8 : 12 }}>
      <div style={{ fontSize: compact ? "3.2rem" : "4.2rem", lineHeight: 1 }}>{traitor ? "😈" : lantern ? "🏮" : "🕯️"}</div>
      <h2
        className={`creep ${traitor ? "blood glitch" : "glow"}`}
        style={{ fontSize: compact ? "2.6rem" : "3.1rem", lineHeight: 1, color: traitor ? undefined : "var(--candle)" }}
      >
        {traitor ? "POSSESSED" : lantern ? "LANTERN BEARER" : "MORTAL"}
      </h2>
      <p style={{ fontWeight: 800, fontSize: "1.1rem" }}>
        {traitor ? "You’re the secret bad guy. Tell no one!" : lantern ? "A Mortal with a gift. Keep it secret!" : "You’re one of the good ones."}
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

// The role is a face-down card. Press and hold to flip it over; let go and it turns back.
function HoldToSee({ me, onSeen, fill = false }: { me: Me; onSeen?: () => void; fill?: boolean }) {
  const [held, setHeld] = useState(false);
  return (
    <div
      {...holdProps((v) => {
        setHeld(v);
        if (v) onSeen?.();
      })}
      className={`tarot ${held ? "held" : ""} ${fill ? "fill" : ""}`}
    >
      <div className="tarot-inner">
        <div className="tarot-face tarot-back">
          <svg viewBox="0 0 100 100" className="tarot-sigil" aria-hidden>
            <circle cx="50" cy="50" r="46" />
            <circle cx="50" cy="50" r="40" />
            <path d="M50 12 L72 80 L14 37 H86 L28 80 Z" />
          </svg>
          <p className="creep tarot-hint">Hold to turn over</p>
          <p className="tarot-small">Make sure no one is looking!</p>
        </div>
        <div className={`tarot-face tarot-front ${me.role === "traitor" ? "evil" : "good"}`}>
          {held && <RoleCard me={me} compact />}
        </div>
      </div>
    </div>
  );
}

// No timer: the game starts once every player has seen their role and tapped "I'm ready".
function Reveal({ s, me, send }: { s: View; me: Me; send: Send }) {
  const [seen, setSeen] = useState(false);
  return (
    <Center>
      <p className="flavor" style={{ fontSize: "1.2rem" }}>One among you is no longer… themselves.</p>
      <HoldToSee me={me} onSeen={() => setSeen(true)} />
      <MyNumber s={s} me={me} />
      {me.ready ? (
        <p style={{ fontWeight: 800, fontSize: "1.3rem", color: "#7fdc8a" }}>✓ You&apos;re ready!</p>
      ) : (
        <button
          className="btn primary"
          disabled={!seen}
          onClick={() => send({ type: "ready" })}
          style={{ width: "100%", fontSize: "1.4rem", minHeight: 64 }}
        >
          {seen ? "✓ I'm ready" : "Hold the card above first"}
        </button>
      )}
      <LookAtTV />
    </Center>
  );
}

// The phone never repeats what the TV already shows. It just points there.
function LookAtTV({ children = "Look at the TV" }: { children?: React.ReactNode }) {
  return <p className="look-tv">📺 {children}</p>;
}

// Each player's number, typed on the TV keyboard to call an emergency meeting.
const numberOf = (s: View, me: Me) => s.players.find((p) => p.id === me.id)?.num ?? 0;

function MyNumber({ s, me }: { s: View; me: Me }) {
  return (
    <p style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", fontSize: ".95rem", color: "var(--dim)" }}>
      <span className="num-badge" style={{ fontSize: "1.4rem", flex: "none" }}>{numberOf(s, me)}</span>
      <span>
        <strong style={{ color: "var(--ink)", display: "block", fontSize: "1.05rem" }}>Your number</strong>
        Type it on the TV keyboard to call an emergency meeting.
      </span>
    </p>
  );
}

// ─── Playing: tabs for Tasks / Actions / Role ────────────────

type Tab = "rituals" | "actions" | "role";

function Playing({ s, me, now, send, sound }: { s: View; me: Me; now: number; send: Send; sound: Sound }) {
  const [tab, setTab] = useState<Tab>("rituals");
  const bm = s.bloodMoon;
  const left = s.pool.filter((r) => !r.doneBy).length;

  return (
    <>
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Soul color={me.color} size={26} dead={!me.alive} />
        <strong style={{ fontSize: "1.25rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {me.name}
        </strong>
        <span className="num-badge" title="Your number for the TV emergency button">{numberOf(s, me)}</span>
        <SoundButton sound={sound} />
      </header>

      {(s.hush.active || (bm.active && !me.alive)) && (
        <LookAtTV>{s.hush.active ? "🤫 The Hush is on. No meetings. Look at the TV" : "🌕 Blood Moon! Ghosts can’t stop it. Look at the TV"}</LookAtTV>
      )}

      {!me.alive && (
        <div className="panel" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: "2.2rem" }}>👻</span>
          <div>
            <strong style={{ color: "#9fd0ff", fontSize: "1.1rem" }}>{me.ejected ? "You were voted out." : "You are a ghost."} Shh!</strong>
            <div style={{ fontSize: ".95rem" }}>
              {s.players.find((p) => p.id === me.id)?.foundBy ? `${s.players.find((p) => p.id === me.id)!.foundBy} found your body. ` : ""}
              Don’t talk. You can still finish rituals.
            </div>
            {me.canRevive && (
              <button
                onClick={() => send({ type: "alive" })}
                style={{ background: "none", border: "none", color: "var(--candle)", textDecoration: "underline", padding: "6px 0", fontWeight: 700 }}
              >
                Reported by mistake? I’m not dead!
              </button>
            )}
          </div>
        </div>
      )}

      {bm.active && me.alive ? (
        <BloodMoonPanel s={s} me={me} now={now} send={send} />
      ) : (
        <>
          <nav className="tabs" role="tablist">
            {(
              [
                ["rituals", "📜", "Rituals", String(left)],
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
            {tab === "rituals" && <RitualsTab s={s} me={me} now={now} send={send} />}
            {tab === "actions" && <ActionsTab s={s} me={me} now={now} send={send} />}
            {tab === "role" && <HoldToSee me={me} fill />}
          </div>
        </>
      )}
    </>
  );
}

// Blood Moon: tap the card you found at each location. Anyone alive can do it,
// one player can do both, or two players can split up.
function BloodMoonPanel({ s, me, now, send }: { s: View; me: Me; now: number; send: Send }) {
  const bm = s.bloodMoon;
  const lockIn = secondsLeft(me.sealLockedUntil, now);
  useOnChange(me.sealLockedUntil > now ? String(me.sealLockedUntil) : null, () => buzz([300, 100, 300]));
  return (
    <div className="tab-body">
      <div className="panel" style={{ padding: "10px 14px", borderColor: "var(--blood-bright)", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: "2.4rem" }}>🌕</span>
        <div style={{ flex: 1 }}>
          <strong className="blood" style={{ fontSize: "1.3rem" }}>BLOOD MOON!</strong>
          <div style={{ fontWeight: 600 }}>Go find a card, then tap the card you saw.</div>
        </div>
        <span className="creep blood" style={{ fontSize: "2.8rem" }}>{secondsLeft(bm.endsAt, now)}</span>
      </div>
      {lockIn > 0 && (
        <p key={me.sealLockedUntil} className="blood shake" style={{ textAlign: "center", fontWeight: 800, fontSize: "1.15rem" }}>
          ❌ Wrong card! Try again in {lockIn}s
        </p>
      )}
      {bm.locations.map((loc, i) => {
        const by = bm.sealedBy[i];
        return (
          <section key={loc} className="panel moon-slot" style={{ borderColor: by ? "#7fdc8a" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <strong style={{ color: "var(--candle)", fontSize: "1.25rem" }}>📍 {loc}</strong>
              {by && <span style={{ color: "#7fdc8a", fontWeight: 800 }}>✓ Sealed by {by}</span>}
            </div>
            {by ? (
              <p style={{ color: "var(--dim)", fontWeight: 600 }}>This one is done!</p>
            ) : (
              <>
                <p style={{ fontSize: ".95rem", color: "var(--dim)", fontWeight: 600 }}>Which card is at the {loc.toLowerCase()}?</p>
                <div className="card-row">
                  {(bm.options[i] ?? []).map((c, j) => (
                    <button
                      key={c}
                      className={`playing-card ${j % 2 ? "red" : ""}`}
                      disabled={lockIn > 0}
                      onClick={() => send({ type: "seal", slot: i, card: c })}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

// Rituals come from one shared pool. Kids play too, so every step is one big, plain choice:
// tap a ritual to read it → Claim it → "Go do it!" → I did it! (or Give it back).
function RitualsTab({ s, me, now, send }: { s: View; me: Me; now: number; send: Send }) {
  const mine = s.pool.find((r) => r.claimedById === me.id);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [cheer, setCheer] = useState<{ kind: "claimed" | "done"; name: string; location: string } | null>(null);
  const [giveBack, setGiveBack] = useState(false);
  const preview = s.pool.find((r) => r.id === previewId);

  if (cheer?.kind === "claimed") {
    return (
      <div className="panel task-card fade-in" style={{ textAlign: "center", justifyContent: "center", borderColor: "var(--candle)" }}>
        <div style={{ fontSize: "4.5rem", lineHeight: 1 }}>🕯️</div>
        <h2 className="creep glow" style={{ fontSize: "2.6rem", lineHeight: 1.05, color: "var(--candle)" }}>Great! Go do your ritual!</h2>
        <p style={{ fontSize: "1.3rem", fontWeight: 800 }}>{cheer.name}</p>
        <p style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--candle)" }}>📍 {cheer.location}</p>
        <button className="btn primary" style={{ fontSize: "1.6rem", minHeight: 80, marginTop: "auto" }} onClick={() => setCheer(null)}>
          OK!
        </button>
      </div>
    );
  }

  if (cheer?.kind === "done") {
    return (
      <div className="panel task-card fade-in" style={{ textAlign: "center", justifyContent: "center", borderColor: "#7fdc8a" }}>
        <div style={{ fontSize: "4.5rem", lineHeight: 1 }}>🎉</div>
        <h2 className="creep" style={{ fontSize: "2.6rem", lineHeight: 1.05, color: "#7fdc8a" }}>Well done!</h2>
        <p style={{ fontSize: "1.3rem", fontWeight: 800 }}>You finished {cheer.name}.</p>
        <p style={{ fontSize: "1.1rem" }}>Now pick your next ritual.</p>
        <button className="btn primary" style={{ fontSize: "1.6rem", minHeight: 80, marginTop: "auto" }} onClick={() => setCheer(null)}>
          OK!
        </button>
      </div>
    );
  }

  if (mine) {
    const held = secondsLeft(mine.claimEndsAt, now);
    const finish = async () => {
      if (await send({ type: "done", id: mine.id })) setCheer({ kind: "done", name: mine.name, location: mine.location });
    };
    return (
      <div key={mine.id} className="panel task-card fade-in">
        <span className="ritual-where">📍 Go to the {mine.location.toLowerCase()}</span>
        <h3 className="ritual-name">{mine.name}</h3>
        <p className="ritual-how">{mine.instructions}</p>
        <div style={{ marginTop: "auto", display: "grid", gap: 10 }}>
          <button className="btn primary" onClick={finish} style={{ fontSize: "1.6rem", minHeight: 80 }}>
            ✓ I did it!
          </button>
          <button className="btn ghost" onClick={() => setGiveBack(true)} style={{ fontSize: "1.2rem" }}>
            ↩ Give it back
          </button>
          <p style={{ textAlign: "center", color: "var(--dim)", fontSize: ".95rem" }}>
            {held > 0 ? `⏳ ${dur(held)} left to do it` : "⏳ Time’s up! Tap “I did it!” if you finished."}
          </p>
        </div>
        {giveBack && (
          <div className="overlay fade-in">
            <div style={{ fontSize: "4rem" }}>↩</div>
            <h2 className="creep" style={{ fontSize: "2.2rem", lineHeight: 1.1 }}>Give this ritual back?</h2>
            <p style={{ margin: "12px 0 24px", fontSize: "1.15rem" }}>Someone else can do it instead. Then you can pick a new one.</p>
            <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 340 }}>
              <button
                className="btn primary"
                style={{ fontSize: "1.3rem" }}
                onClick={() => {
                  send({ type: "release" });
                  setGiveBack(false);
                }}
              >
                Yes, give it back
              </button>
              <button className="btn ghost" style={{ fontSize: "1.3rem" }} onClick={() => setGiveBack(false)}>
                No, keep it
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (preview) {
    const free = !preview.doneBy && !preview.claimedBy && !preview.lockedBy;
    const claim = async () => {
      if (await send({ type: "claim", id: preview.id })) {
        setPreviewId(null);
        setCheer({ kind: "claimed", name: preview.name, location: preview.location });
      }
    };
    return (
      <div key={preview.id} className="panel task-card fade-in">
        <span className="ritual-where">📍 {preview.location}</span>
        {preview.unlockedBy && (
          <p className="unlocked-tag" style={{ justifySelf: "start", marginLeft: 0 }}>
            🔓 Unlocked! “{preview.unlockedBy}” is done.
          </p>
        )}
        <h3 className="ritual-name">{preview.name}</h3>
        <p className="ritual-how">{preview.instructions}</p>
        <div style={{ marginTop: "auto", display: "grid", gap: 10 }}>
          {free ? (
            <button className="btn primary" onClick={claim} style={{ fontSize: "1.6rem", minHeight: 80 }}>
              ✋ Claim it
              <small style={{ display: "block", fontSize: ".95rem", fontWeight: 600 }}>You get {dur(s.settings.claimTimeout)} to do it</small>
            </button>
          ) : (
            <p style={{ textAlign: "center", fontWeight: 800, fontSize: "1.15rem" }}>
              {preview.doneBy
                ? `✓ ${preview.doneBy} already did this one`
                : preview.claimedBy
                  ? `✋ ${preview.claimedBy} is doing this one`
                  : `🔒 Do “${preview.lockedBy}” first`}
            </p>
          )}
          <button className="btn ghost" onClick={() => setPreviewId(null)} style={{ fontSize: "1.2rem" }}>
            ← Back to the list
          </button>
        </div>
      </div>
    );
  }

  const free = s.pool.filter((r) => !r.doneBy && !r.claimedBy && !r.lockedBy);
  const taken = s.pool.filter((r) => !r.doneBy && r.claimedBy);
  const locked = s.pool.filter((r) => !r.doneBy && !r.claimedBy && r.lockedBy);
  const done = s.pool.filter((r) => r.doneBy);

  return (
    <div className="ritual-list">
      <p style={{ fontWeight: 700, fontSize: "1.05rem" }}>👇 Pick a ritual to do</p>
      {free.map((r) => (
        <button key={r.id} className={`panel ritual-row ${r.unlockedBy ? "unlocked" : ""}`} onClick={() => setPreviewId(r.id)}>
          <strong>
            {r.name}
            {r.unlockedBy && <span className="unlocked-tag">🔓 Unlocked!</span>}
          </strong>
          <span style={{ color: "var(--candle)" }}>📍 {r.location}</span>
        </button>
      ))}
      {free.length === 0 && <p style={{ textAlign: "center", fontWeight: 700 }}>No free rituals right now. Check back soon…</p>}
      {[...taken, ...locked, ...done].map((r) => (
        <button key={r.id} className="panel ritual-row off" onClick={() => setPreviewId(r.id)}>
          <strong style={{ textDecoration: r.doneBy ? "line-through" : "none" }}>{r.name}</strong>
          <span>{r.doneBy ? `✓ ${r.doneBy}` : r.claimedBy ? `✋ ${r.claimedBy}` : `🔒 After “${r.lockedBy}”`}</span>
        </button>
      ))}
    </div>
  );
}

// Found a body: pick whose it is, then choose whether to spend your meeting on it.
// (Meetings without a body are called from the emergency button on the TV.)
// The Possessed also get the Blood Moon and the Hush here, alive or dead.
function ActionsTab({ s, me, now, send }: { s: View; me: Me; now: number; send: Send }) {
  const [open, setOpen] = useState(false);
  const [bodyId, setBodyId] = useState<string | null>(null);
  const left = s.players.find((p) => p.id === me.id)?.meetingsLeft ?? 0;
  const traitor = me.role === "traitor";
  const events = traitor && (s.settings.bloodMoon || s.settings.hush) && (
    <div className="powers">
      <h3 className="creep">Your dark powers</h3>
      {s.settings.bloodMoon && (
        <PossessedEvent
          s={s}
          me={me}
          now={now}
          icon="🌕"
          label="Summon the Blood Moon"
          active={s.bloodMoon.active}
          ready={`They get ${s.settings.bloodMoonDuration}s to stop it`}
          confirm={`Everyone gets ${s.settings.bloodMoonDuration}s to stop it, or you win.`}
          onGo={() => send({ type: "summon" })}
        />
      )}
      {s.settings.hush && (
        <PossessedEvent
          s={s}
          me={me}
          now={now}
          icon="🤫"
          label="Call the Hush"
          active={s.hush.active}
          ready={`No meetings for ${s.settings.hushDuration}s`}
          confirm={`Nobody can call a meeting for ${s.settings.hushDuration}s. Bodies can still be reported.`}
          onGo={() => send({ type: "hush" })}
        />
      )}
    </div>
  );

  if (!me.alive) {
    return (
      <>
        {events}
        <div className="panel" style={{ flex: 1, display: "grid", placeContent: "center", textAlign: "center", gap: 10, padding: 20 }}>
          <div style={{ fontSize: "3.5rem" }}>👻</div>
          <p className="creep" style={{ fontSize: "2rem", color: "#9fd0ff" }}>Ghosts can’t report bodies</p>
          <p>You can still finish rituals.</p>
        </div>
      </>
    );
  }

  const others = s.players.filter((p) => p.alive && p.id !== me.id);
  const body = s.players.find((p) => p.id === bodyId);
  // Reporting a body can always call a meeting, except during the Hush or the Blood Moon.
  const why = s.hush.active
    ? `The Hush! No meetings for ${dur(secondsLeft(s.hush.endsAt, now))}.`
    : s.bloodMoon.active
      ? "Not during the Blood Moon!"
      : null;
  const close = () => {
    setOpen(false);
    setBodyId(null);
  };
  const report = (meeting: boolean) => {
    if (body) send({ type: "report", id: body.id, meeting });
    close();
  };

  return (
    <>
      {events}
      <button className="btn primary act-big" onClick={() => setOpen(true)}>
        💀 I found a body
      </button>
      <div className="act-info">
        <p>
          <span>{s.hush.active ? "🔒" : "📢"}</span>
          <span>
            <strong>Found a body?</strong> Tap the big button. Everyone goes to the TV.
          </span>
        </p>
        <p>
          <span>🔔</span>
          <span>
            <strong>No body?</strong>{" "}
            {left > 0 ? (
              <>
                Press any key on the TV keyboard, type <strong>{numberOf(s, me)}</strong>, then Enter.
              </>
            ) : (
              "You’ve used your emergency meeting."
            )}
          </span>
        </p>
      </div>
      {open && (
        <div className="overlay fade-in" style={{ justifyContent: "flex-start", overflowY: "auto" }}>
          {!body ? (
            <>
              <h2 className="creep blood" style={{ fontSize: "2.2rem", lineHeight: 1.1, margin: "12px 0 18px" }}>Whose body did you find?</h2>
              <div style={{ display: "grid", gap: 10, width: "100%", maxWidth: 340 }}>
                {others.map((p) => (
                  <button key={p.id} className="btn ghost" style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "1.2rem" }} onClick={() => setBodyId(p.id)}>
                    <Soul color={p.color} size={22} />
                    {p.name}
                  </button>
                ))}
                <button className="btn ghost" style={{ fontSize: "1.2rem" }} onClick={close}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "4rem", marginTop: 24 }}>💀</div>
              <h2 className="creep blood" style={{ fontSize: "2.2rem", lineHeight: 1.1 }}>You found {body.name}</h2>
              <p style={{ margin: "12px 0 24px", fontSize: "1.1rem" }}>They become a ghost. Call everyone to the TV?</p>
              <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 340 }}>
                <div className={`lockable ${s.hush.active ? "locked" : ""}`}>
                  <button className="btn primary" style={{ fontSize: "1.3rem" }} disabled={!!why} onClick={() => report(true)}>
                    🔔 Report and call a meeting
                    {why && <small style={{ display: "block", fontSize: ".9rem", fontWeight: 600 }}>{why}</small>}
                  </button>
                  {s.hush.active && <span className="lock">🔒</span>}
                </div>
                <button className="btn ghost" style={{ fontSize: "1.3rem" }} onClick={() => report(false)}>
                  Report without a meeting
                </button>
                <button className="btn ghost" style={{ fontSize: "1.1rem" }} onClick={() => setBodyId(null)}>
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

// A Possessed event button (Blood Moon or Hush). They share one cooldown, and each
// asks to confirm so a pocket tap can't set it off.
function PossessedEvent({
  s,
  me,
  now,
  icon,
  label,
  active,
  ready,
  confirm,
  onGo,
}: {
  s: View;
  me: Me;
  now: number;
  icon: string;
  label: string;
  active: boolean;
  ready: string;
  confirm: string;
  onGo: () => void;
}) {
  const [sure, setSure] = useState(false);
  const waitIn = secondsLeft(me.summonReadyAt, now);
  const busy = s.bloodMoon.active || s.hush.active;
  return (
    <>
      <button className="btn primary power" disabled={waitIn > 0 || busy} onClick={() => setSure(true)}>
        {icon} {label}
        <small>{active ? "It’s happening now!" : busy ? "Wait for the current event to end" : waitIn > 0 ? `⏳ Ready in ${dur(waitIn)}` : ready}</small>
      </button>
      {sure && (
        <div className="overlay fade-in">
          <div style={{ fontSize: "4rem" }}>{icon}</div>
          <h2 className="creep blood" style={{ fontSize: "2.4rem", lineHeight: 1.1 }}>{label}?</h2>
          <p style={{ margin: "12px 0 26px", fontSize: "1.2rem" }}>{confirm}</p>
          <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 340 }}>
            <button
              className="btn primary"
              style={{ fontSize: "1.3rem" }}
              onClick={() => {
                onGo();
                setSure(false);
              }}
            >
              Do it
            </button>
            <button className="btn ghost" style={{ fontSize: "1.3rem" }} onClick={() => setSure(false)}>
              Not now
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// The Lantern Bearer's one reveal: pick three players, and the TV says how many are Possessed.
function LanternButton({ s, me, send }: { s: View; me: Me; send: Send }) {
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const others = s.players.filter((p) => p.alive && p.id !== me.id);
  const toggle = (id: string) => setPicks((ps) => (ps.includes(id) ? ps.filter((x) => x !== id) : ps.length < 3 ? [...ps, id] : ps));
  const close = () => {
    setOpen(false);
    setPicks([]);
  };
  return (
    <>
      <button className="btn lantern-btn" onClick={() => setOpen(true)}>
        🏮 Light the Lantern
        <small>Once per game. Pick three players.</small>
      </button>
      {open && (
        <div className="overlay fade-in" style={{ justifyContent: "flex-start", overflowY: "auto" }}>
          <div style={{ fontSize: "3.4rem", lineHeight: 1, marginTop: 8 }}>🏮</div>
          <h2 className="creep" style={{ fontSize: "2.2rem", lineHeight: 1.1, color: "var(--candle)" }}>Pick three players</h2>
          <p style={{ margin: "6px 0 16px", color: "var(--dim)" }}>The TV will show how many of them are Possessed. You can only do this once.</p>
          <div className="vote-grid" style={{ width: "100%", maxWidth: 360 }}>
            {others.map((p) => (
              <button
                key={p.id}
                className="btn"
                onClick={() => toggle(p.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: "1.1rem",
                  borderWidth: picks.includes(p.id) ? 3 : 1,
                  borderColor: picks.includes(p.id) ? "var(--candle)" : undefined,
                  overflow: "hidden",
                }}
              >
                <Soul color={p.color} size={20} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gap: 10, width: "100%", maxWidth: 360, marginTop: 16 }}>
            <button
              className="btn primary"
              disabled={picks.length !== 3}
              style={{ fontSize: "1.3rem", minHeight: 64, opacity: picks.length === 3 ? 1 : 0.6 }}
              onClick={() => {
                send({ type: "lantern", targets: picks });
                close();
              }}
            >
              {picks.length === 3 ? "🏮 Light it!" : `Pick ${3 - picks.length} more`}
            </button>
            <button className="btn ghost" style={{ fontSize: "1.15rem" }} onClick={close}>
              Not now
            </button>
          </div>
        </div>
      )}
    </>
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
        <Big icon="🔔" red>
          {t.title}
        </Big>
        <p className="creep flicker" style={{ fontSize: "2.2rem", color: "var(--candle)" }}>Go to the TV now!</p>
      </Center>
    );
  }

  if (m.stage === "verdict") {
    const mine = m.result?.ejectedId === me.id;
    if (!mine) {
      return (
        <Center>
          <Big icon="🔮">The verdict</Big>
          <LookAtTV />
        </Center>
      );
    }
    return (
      <Center>
        <Big icon="🌀" red>
          You were voted out!
        </Big>
        <p style={{ fontSize: "1.2rem", fontWeight: 600 }}>You’re a ghost now. No talking, but you can still finish rituals.</p>
      </Center>
    );
  }

  const living = s.players.filter((p) => p.alive);

  // Talk time: the phone gets out of the way. Just one big button.
  if (m.stage === "discussion") {
    if (!me.alive) {
      return (
        <Center>
          <Big icon="👻">Shh… you’re a ghost</Big>
          <p style={{ fontSize: "1.2rem" }}>Listen, but don’t talk.</p>
          <LookAtTV />
        </Center>
      );
    }
    const ready = m.readyToVote.includes(me.id);
    const canLantern = me.special === "lantern" && !me.lanternUsed && !m.lantern && living.filter((p) => p.id !== me.id).length >= 3;
    return (
      <Center>
        <h1 className="creep" style={{ fontSize: "2.4rem", lineHeight: 1 }}>Talk it out!</h1>
        {canLantern && <LanternButton s={s} me={me} send={send} />}
        <button
          className={`btn ${ready ? "done" : "primary"} ready-vote`}
          disabled={ready}
          onClick={() => send({ type: "readyVote" })}
        >
          {ready ? "✓ Ready!" : "🗳️ Ready to vote"}
        </button>
        <p style={{ color: "var(--dim)", fontSize: "1.1rem" }}>
          {ready ? "Waiting for the others…" : "Tap when you’ve made up your mind."}
        </p>
      </Center>
    );
  }

  // voting
  if (!me.alive) {
    return (
      <Center>
        <Big icon="👻">Ghosts can’t vote</Big>
        <p style={{ fontSize: "1.1rem" }}>Watch quietly.</p>
        <LookAtTV />
      </Center>
    );
  }
  if (me.vote) {
    return (
      <Center>
        <Big icon="✅">Vote sent!</Big>
        <p style={{ fontSize: "1.2rem" }}>{me.vote === "skip" ? "You skipped." : `You voted for ${nameOf(s, me.vote)}.`}</p>
        <LookAtTV />
      </Center>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: "calc(100dvh - 32px)" }}>
      <div style={{ textAlign: "center" }}>
        <h1 className="creep blood" style={{ fontSize: "2.4rem", lineHeight: 1.05 }}>Who is Possessed?</h1>
        <p style={{ fontWeight: 700, fontSize: "1.05rem" }}>
          Tap a name, then Vote. <span style={{ color: left <= 10 ? "var(--blood-bright)" : "var(--candle)" }}>{dur(left)} left</span>
        </p>
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
        style={{ fontSize: "1.5rem", minHeight: 76, marginTop: "auto", borderRadius: 18, opacity: pick ? 1 : 0.6 }}
      >
        {pick ? `🗳️ Vote${pick === "skip" ? ": Skip" : `: ${nameOf(s, pick)}`}` : "👆 Pick someone first"}
      </button>
    </div>
  );
}

// ─── Game over ───────────────────────────────────────────────

// Who won, and every role, is on the TV. The phone only says how it went for you.
function Over({ s, me }: { s: View; me: Me }) {
  const won = s.winner?.side === me.role;
  return (
    <Center>
      <div style={{ fontSize: "4.5rem", lineHeight: 1 }}>{won ? "🎉" : "💀"}</div>
      <h1 className="creep over-result" style={{ color: won ? "#7fdc8a" : "var(--blood-bright)" }}>
        {won ? "You won!" : "You lost…"}
      </h1>
      <p style={{ fontWeight: 800, fontSize: "1.2rem" }}>You were {me.role === "traitor" ? "😈 Possessed" : me.special === "lantern" ? "the 🏮 Lantern Bearer" : "a 🕯️ Mortal"}.</p>
      <LookAtTV>Look at the TV to see who was who</LookAtTV>
    </Center>
  );
}
