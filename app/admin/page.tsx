"use client";

import { useEffect, useState } from "react";
import { colorHex, fmt, useMounted } from "@/lib/client";
import { Atmos, Soul } from "@/components/shared";
import { SettingsEditor } from "@/components/SettingsEditor";
import type { Settings } from "@/lib/game";

type Admin = {
  phase: string;
  stage: string | null;
  endsIn: number;
  winner: { side: string; reason: string } | null;
  progress: { done: number; total: number };
  settings: Settings;
  ready: number;
  traitorCount: number;
  votes: number;
  readyToVote: number;
  living: number;
  meetingsIn: number;
  hushIn: number;
  bloodMoon: {
    active: boolean;
    endsIn: number;
    readyIn: number;
    code: string | null;
  };
  players: {
    num: number;
    name: string;
    color: string;
    bot: boolean;
    crowned: boolean;
    role: string | null;
    special: string | null;
    alive: boolean;
    ejected: boolean;
    foundBy: string | null;
    meetingsLeft: number;
    rituals: number;
    doing: string | null;
  }[];
};

// Admin controls: run the game from your phone and test it alone with bots.
// Roles stay hidden until you ask, so you can play too.
export default function AdminPage() {
  const mounted = useMounted();
  return mounted ? <Controls /> : <Atmos />;
}

const PHASES: Record<string, string> = {
  lobby: "🚪 Lobby",
  reveal: "👁 Role reveal",
  playing: "🕯️ Playing",
  meeting: "🔔 Meeting",
  over: "🏁 Game over",
};

const STAGES: Record<string, string> = {
  summons: "Gathering at the TV",
  discussion: "Talk time",
  voting: "Voting",
  verdict: "Verdict",
};

function Controls() {
  const [state, setState] = useState<Admin | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showRoles, setShowRoles] = useState(false);

  const call = async (params: Record<string, string | number>) => {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(`⚠️ ${data.error}`);
    setState(data.state);
    setMsg(`✓ Done`);
  };

  const setSettings = async (patch: Partial<Settings>) => {
    const res = await fetch("/api/host", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "settings", settings: patch }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(`⚠️ ${data.error}`);
    setState((s) => (s ? { ...s, settings: data.settings } : s));
  };

  // Refresh every 2 seconds.
  useEffect(() => {
    const load = () =>
      fetch("/api/admin?do=state", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(d.error))))
        .then(setState)
        .catch((e) => typeof e === "string" && setMsg(`⚠️ ${e}`));
    const first = setTimeout(load, 0);
    const id = setInterval(load, 2000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const btn = (label: string, params: Record<string, string | number>, primary = false, disabled = false) => (
    <button
      key={label}
      className={`btn ${primary ? "primary" : ""}`}
      style={{ fontSize: "1rem", minHeight: 52, padding: "10px 12px" }}
      disabled={disabled}
      onClick={() => call(params)}
    >
      {label}
    </button>
  );

  const s = state;
  const phase = s?.phase;
  const human = s?.players.find((p) => !p.bot)?.name ?? "";
  const bm = s?.bloodMoon;
  const timed = phase === "reveal" || phase === "meeting";
  const live = phase === "playing" || phase === "meeting";

  return (
    <>
      <Atmos />
      <main className="screen phone" style={{ display: "grid", gap: 18, alignContent: "start" }}>
        <h1 className="creep blood" style={{ fontSize: "2.4rem" }}>Admin Controls</h1>

        {s && <Status s={s} showRoles={showRoles} onToggleRoles={() => setShowRoles(!showRoles)} />}
        {msg && <p style={{ fontSize: ".9rem", wordBreak: "break-word" }}>{msg}</p>}

        <Group title="▶ Game">
          {btn("▶ Start game", { do: "start" }, true, phase !== "lobby")}
          {btn("⏭ Skip timer", { do: "skip" }, true, !timed)}
          {btn("Start: I'm Possessed", { do: "start", role: "traitor" }, false, phase !== "lobby")}
          {btn("Start: I'm Mortal", { do: "start", role: "member" }, false, phase !== "lobby")}
          {btn("Start: I'm the 🏮 Lantern Bearer", { do: "start", role: "lantern" }, false, phase !== "lobby")}
          {btn("Everyone ready", { do: "ready" }, false, phase !== "reveal")}
          {btn("🔔 Force meeting", { do: "meeting" }, false, phase !== "playing")}
          {btn("🔁 Back to lobby", { do: "lobby" }, false, phase === "lobby")}
          {btn("Reset everything", { do: "reset" })}
        </Group>

        <Group title="😈 Possessed powers">
          {bm?.active && (
            <div className="panel" style={{ gridColumn: "1 / -1", padding: 12, display: "grid", gap: 4, borderColor: "var(--blood-bright)" }}>
              <strong className="blood">Blood Moon rising! {bm.endsIn}s left</strong>
              <span>
                Code: <strong style={{ color: "var(--candle)", letterSpacing: ".2em" }}>{bm.code}</strong>
              </span>
            </div>
          )}
          {btn("🌕 Blood Moon now", { do: "moon" }, true, phase !== "playing" || !!bm?.active)}
          {btn("✋ Cancel Blood Moon", { do: "cancelMoon" }, false, !bm?.active)}
          {btn("🤫 Hush now", { do: "hush" }, false, phase !== "playing" || !!s?.hushIn)}
          {btn("🔊 End the Hush", { do: "unhush" }, false, !s?.hushIn)}
          {btn("⏩ Fill meeting ring + ready powers", { do: "cooldowns" }, false, phase !== "playing")}
        </Group>

        {s && <LanternControls s={s} call={call} />}

        <Group title="☠ Kill & revive">
          {s?.players.map((p) =>
            btn(p.alive ? `☠ Kill ${p.name}` : `✚ Revive ${p.name}`, { do: p.alive ? "kill" : "revive", name: p.name }, false, !live),
          )}
          <Note>Fix mistakes during a game. A killed player counts as found.</Note>
        </Group>

        <Group title="🤖 Bots (testing)">
          {btn("Add 5 bots", { do: "bots", n: 5 }, false, phase !== "lobby")}
          {btn("Add 1 bot", { do: "bots", n: 1 }, false, phase !== "lobby")}
          {btn("Remove bots", { do: "clearbots" })}
          {btn("Fast timers", { do: "fast" }, false, phase !== "lobby")}
          {btn("Bots do 50% rituals", { do: "bottasks", pct: 50 }, false, phase !== "playing")}
          {btn("Bots do all rituals", { do: "bottasks", pct: 100 }, false, phase !== "playing")}
          {btn("Bot finds a body", { do: "botkill" }, false, phase !== "playing")}
          {btn("Bot finds my body", { do: "botkill", name: human }, false, phase !== "playing" || !human)}
          {btn("Bot reports + meeting", { do: "botreport" }, false, phase !== "playing")}
          {btn("Type the Blood Moon code", { do: "botseal" }, false, !bm?.active)}
          {btn("Bots vote skip", { do: "botvote", target: "skip" }, false, s?.stage !== "voting")}
          {btn("Bots vote random", { do: "botvote", target: "random" }, false, s?.stage !== "voting")}
          {btn("Bots vote me", { do: "botvote", target: human }, false, s?.stage !== "voting" || !human)}
        </Group>

        <section style={{ display: "grid", gap: 8 }}>
          <h2 className="creep" style={{ fontSize: "1.5rem", color: "var(--candle)" }}>⚙️ Settings</h2>
          {s && phase === "lobby" ? (
            <SettingsEditor settings={s.settings} autoTraitors={s.traitorCount} onChange={setSettings} />
          ) : (
            <p style={{ color: "var(--dim)" }}>Settings can be changed in the lobby, between games.</p>
          )}
        </section>

        <p style={{ color: "var(--dim)", fontSize: ".85rem" }}>
          On the TV: <strong>Space</strong> starts the game (and plays again), <strong>S</strong> skips a timer, <strong>H</strong> opens host
          controls, and any other key starts an emergency meeting (then a player number and Enter). Every button here is also a URL, e.g.{" "}
          <code>/api/admin?do=skip</code>.
        </p>
      </main>
    </>
  );
}

// What's happening right now, at a glance.
function Status({ s, showRoles, onToggleRoles }: { s: Admin; showRoles: boolean; onToggleRoles: () => void }) {
  const playing = s.phase === "playing";
  const chips: [string, string][] = [];
  if (s.phase !== "lobby") chips.push(["📜", `Rituals ${s.progress.done}/${s.progress.total}`]);
  if (playing) chips.push(["🔔", s.meetingsIn > 0 ? `Meeting ring fills in ${fmt(s.meetingsIn)}` : "Meeting ring is full"]);
  if (playing && s.hushIn > 0) chips.push(["🤫", `The Hush: ${s.hushIn}s left`]);
  if (playing && (s.settings.bloodMoon || s.settings.hush) && !s.bloodMoon.active && s.hushIn === 0)
    chips.push(["😈", s.bloodMoon.readyIn > 0 ? `Powers ready in ${fmt(s.bloodMoon.readyIn)}` : "Powers are ready"]);
  if (s.bloodMoon.active) chips.push(["🌕", `Blood Moon: ${s.bloodMoon.endsIn}s left`]);
  if (s.stage === "discussion") chips.push(["🗳️", `${s.readyToVote}/${s.living} ready to vote`]);
  if (s.stage === "voting") chips.push(["🗳️", `${s.votes}/${s.living} votes`]);

  return (
    <section className="panel" style={{ padding: 14, display: "grid", gap: 10 }}>
      <strong style={{ fontSize: "1.2rem" }}>
        {PHASES[s.phase] ?? s.phase}
        {s.stage ? ` · ${STAGES[s.stage] ?? s.stage}` : ""}
        {s.phase === "meeting" && s.endsIn > 0 ? ` (${s.endsIn}s)` : ""}
        {s.phase === "reveal" ? ` (${s.ready}/${s.players.length} ready)` : ""}
      </strong>
      {s.winner && (
        <span className="blood" style={{ fontWeight: 800 }}>
          Winner: {s.winner.side === "traitor" ? "the Possessed" : "the Mortals"} ({s.winner.reason})
        </span>
      )}
      {chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {chips.map(([icon, text]) => (
            <span key={text} className="admin-chip">
              {icon} {text}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 800 }}>Players ({s.players.length})</span>
        <button onClick={onToggleRoles} style={{ background: "none", border: "none", color: "var(--candle)", padding: "4px 0", fontWeight: 800 }}>
          {showRoles ? "🙈 Hide roles" : "👁 Show roles"}
        </button>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {s.players.map((p) => (
          <div key={p.name} className={`admin-player ${p.alive ? "" : "gone"}`} style={{ "--c": colorHex(p.color) } as React.CSSProperties}>
            <span className="num-badge" style={{ fontSize: ".85rem" }}>{p.num}</span>
            <Soul color={p.color} crown={p.crowned} size={18} dead={!p.alive} />
            <span style={{ minWidth: 0 }}>
              <strong>
                {p.name}
                {showRoles && p.role ? (p.role === "traitor" ? " 😈" : p.special === "lantern" ? " 🏮" : " 🕯️") : ""}
              </strong>
              <small>
                {!p.alive
                  ? p.ejected
                    ? "Voted out"
                    : `Ghost · found by ${p.foundBy ?? "the host"}`
                  : p.doing
                    ? `✋ ${p.doing}`
                    : s.phase === "lobby"
                      ? "In the lobby"
                      : "Wandering"}
              </small>
            </span>
            <span className="admin-stats">
              {s.phase !== "lobby" && <span title="Rituals done">✓{p.rituals}</span>}
              {s.phase !== "lobby" && <span title="Emergency meetings left">🔔{p.meetingsLeft}</span>}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// Light the Lantern for the Lantern Bearer: on three chosen players, or three at random.
// It only works during talk time, once per game.
function LanternControls({ s, call }: { s: Admin; call: (params: Record<string, string | number>) => void }) {
  const [picks, setPicks] = useState<string[]>([]);
  const talk = s.stage === "discussion";
  const living = s.players.filter((p) => p.alive);
  const toggle = (name: string) => setPicks((ps) => (ps.includes(name) ? ps.filter((x) => x !== name) : ps.length < 3 ? [...ps, name] : ps));
  const light = (params: Record<string, string>) => {
    call({ do: "lantern", ...params });
    setPicks([]);
  };
  return (
    <Group title="🏮 Lantern">
      {talk ? (
        <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {living.map((p) => (
            <button
              key={p.name}
              className="btn ghost"
              onClick={() => toggle(p.name)}
              style={{
                minHeight: 40,
                padding: "6px 12px",
                fontSize: ".95rem",
                borderWidth: picks.includes(p.name) ? 2 : 1,
                borderColor: picks.includes(p.name) ? "var(--candle)" : undefined,
                color: picks.includes(p.name) ? "var(--candle)" : undefined,
              }}
            >
              {picks.includes(p.name) ? "✓ " : ""}
              {p.name}
            </button>
          ))}
        </div>
      ) : (
        <Note>Light it during talk time. The Lantern Bearer can only light it once per game.</Note>
      )}
      <button className="btn primary" style={{ fontSize: "1rem", minHeight: 52 }} disabled={!talk || picks.length !== 3} onClick={() => light({ names: picks.join(",") })}>
        🏮 Light with these {talk ? `(${picks.length}/3)` : ""}
      </button>
      <button className="btn" style={{ fontSize: "1rem", minHeight: 52 }} disabled={!talk} onClick={() => light({})}>
        🎲 Light at random
      </button>
    </Group>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h2 className="creep" style={{ fontSize: "1.5rem", color: "var(--candle)" }}>{title}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{children}</div>
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p style={{ gridColumn: "1 / -1", color: "var(--dim)", fontSize: ".85rem" }}>{children}</p>;
}
