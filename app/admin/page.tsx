"use client";

import { useEffect, useState } from "react";
import { fmt, useMounted } from "@/lib/client";
import { Atmos } from "@/components/shared";
import type { Settings } from "@/lib/game";

type Admin = {
  phase: string;
  stage: string | null;
  endsIn: number;
  winner: { side: string; reason: string } | null;
  progress: { done: number; total: number };
  settings: Settings;
  ready: number;
  votes: number;
  bloodMoon: {
    active: boolean;
    endsIn: number;
    readyIn: number;
    cards: { location: string; card: string }[];
    sealedBy: (string | null)[];
  };
  players: { name: string; bot: boolean; role: string | null; alive: boolean; tasks: string }[];
};

// Admin controls: run the game from your phone (start, skip timers, Blood Moon)
// and test it alone with bots. Roles stay hidden until you ask, so you can play too.
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
    if (!res.ok) setMsg(`⚠️ ${data.error}`);
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
      style={{ fontSize: "1rem", minHeight: 50, padding: "10px 12px" }}
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

  return (
    <>
      <Atmos />
      <main className="screen phone" style={{ display: "grid", gap: 16, alignContent: "start" }}>
        <h1 className="creep blood" style={{ fontSize: "2.4rem" }}>Admin Controls</h1>

        {s && (
          <section className="panel" style={{ padding: 14, display: "grid", gap: 6, fontSize: ".95rem" }}>
            <strong style={{ fontSize: "1.15rem" }}>
              {PHASES[s.phase] ?? s.phase}
              {s.stage ? ` → ${s.stage}` : ""}
              {s.phase === "meeting" && s.endsIn > 0 ? ` (${s.endsIn}s)` : ""}
              {s.phase === "reveal" ? ` (${s.ready}/${s.players.length} ready)` : ""}
            </strong>
            {s.winner && <span className="blood">Winner: {s.winner.side === "traitor" ? "Possessed" : "Mortals"} ({s.winner.reason})</span>}
            <span>
              Tasks: {s.progress.done}/{s.progress.total} · Players: {s.players.length}
              {s.stage === "voting" ? ` · Votes: ${s.votes}` : ""}
            </span>
            <button
              onClick={() => setShowRoles(!showRoles)}
              style={{ background: "none", border: "none", color: "var(--candle)", textAlign: "left", padding: "4px 0", fontWeight: 800 }}
            >
              {showRoles ? "🙈 Hide roles" : "👁 Show roles (don't let anyone see!)"}
            </button>
            {s.players.map((p) => (
              <span key={p.name} style={{ opacity: p.alive ? 1 : 0.5 }}>
                {p.alive ? "" : "☠ "}
                {p.name}
                {showRoles && p.role ? ` — ${p.role === "traitor" ? "😈 Possessed" : "🕯️ Mortal"}` : ""} · {p.tasks}
              </span>
            ))}
          </section>
        )}
        {msg && <p style={{ fontSize: ".9rem", wordBreak: "break-word" }}>{msg}</p>}

        <Group title="Game">
          {btn("▶ Start game", { do: "start" }, true, phase !== "lobby")}
          {btn("⏭ Skip timer", { do: "skip" }, true, !timed)}
          {btn("🔔 Force meeting", { do: "meeting" }, false, phase !== "playing")}
          {btn("🔁 Back to lobby", { do: "lobby" }, false, phase === "lobby")}
          {btn("Start: I'm Possessed", { do: "start", role: "traitor" }, false, phase !== "lobby")}
          {btn("Start: I'm Mortal", { do: "start", role: "member" }, false, phase !== "lobby")}
          {btn("Everyone ready", { do: "ready" }, false, phase !== "reveal")}
          {btn("Reset everything", { do: "reset" })}
        </Group>

        <Group title="🌕 Blood Moon">
          {bm?.active ? (
            <div className="panel" style={{ gridColumn: "1 / -1", padding: 12, display: "grid", gap: 4, borderColor: "var(--blood-bright)" }}>
              <strong className="blood">Rising! {bm.endsIn}s left</strong>
              {bm.cards.map((c, i) => (
                <span key={c.location}>
                  📍 {c.location}: <strong style={{ color: "var(--candle)" }}>{c.card}</strong>
                  {bm.sealedBy[i] ? ` ✓ sealed by ${bm.sealedBy[i]}` : ""}
                </span>
              ))}
            </div>
          ) : (
            phase === "playing" &&
            s?.settings.bloodMoon && (
              <p style={{ gridColumn: "1 / -1", color: "var(--dim)" }}>
                {bm && bm.readyIn > 0 ? `The Possessed can summon it in ${fmt(bm.readyIn)}.` : "The Possessed can summon it now."}
              </p>
            )
          )}
          {btn("🌕 Summon now", { do: "moon" }, true, phase !== "playing" || !!bm?.active)}
          {btn("✋ Cancel it", { do: "cancelMoon" }, false, !bm?.active)}
          {s && phase === "lobby" && <MoonSettings s={s.settings} set={setSettings} />}
          {s && phase !== "lobby" && (
            <p style={{ gridColumn: "1 / -1", color: "var(--dim)", fontSize: ".85rem" }}>Blood Moon settings can be changed in the lobby.</p>
          )}
        </Group>

        <Group title="🤖 Bots (testing)">
          {btn("Add 5 bots", { do: "bots", n: 5 }, false, phase !== "lobby")}
          {btn("Add 1 bot", { do: "bots", n: 1 }, false, phase !== "lobby")}
          {btn("Remove bots", { do: "clearbots" })}
          {btn("Fast timers", { do: "fast" }, false, phase !== "lobby")}
          {btn("Bots do 50% tasks", { do: "bottasks", pct: 50 }, false, phase !== "playing")}
          {btn("Bots do all tasks", { do: "bottasks", pct: 100 }, false, phase !== "playing")}
          {btn("Kill a bot", { do: "botkill" }, false, phase !== "playing")}
          {btn("Kill me", { do: "botkill", name: human }, false, phase !== "playing" || !human)}
          {btn("Bot reports body", { do: "botreport" }, false, phase !== "playing")}
          {btn("Bot rings bell", { do: "botbell" }, false, phase !== "playing")}
          {btn("Bot stops Blood Moon", { do: "botseal" }, false, !bm?.active)}
          {btn("Clear cooldowns", { do: "cooldowns" }, false, phase !== "playing")}
          {btn("Bots vote skip", { do: "botvote", target: "skip" }, false, s?.stage !== "voting")}
          {btn("Bots vote random", { do: "botvote", target: "random" }, false, s?.stage !== "voting")}
          {btn("Bots vote me", { do: "botvote", target: human }, false, s?.stage !== "voting" || !human)}
        </Group>

        <p style={{ color: "var(--dim)", fontSize: ".85rem" }}>
          On the TV: <strong>Space</strong> starts the game (and plays again), <strong>S</strong> skips a timer, <strong>H</strong> opens host
          controls. Every button here is also a URL, e.g. <code>/api/admin?do=skip</code>.
        </p>
      </main>
    </>
  );
}

const MOON_NUMBERS: { key: keyof Settings; label: string; min: number; max: number; step: number }[] = [
  { key: "bloodMoonDuration", label: "Time to stop it (s)", min: 20, max: 180, step: 10 },
  { key: "bloodMoonCooldown", label: "Cooldown between (s)", min: 30, max: 600, step: 30 },
  { key: "bloodMoonGrace", label: "Wait at game start (s)", min: 0, max: 600, step: 30 },
];

function MoonSettings({ s, set }: { s: Settings; set: (patch: Partial<Settings>) => void }) {
  return (
    <div style={{ gridColumn: "1 / -1", display: "grid", gap: 10 }}>
      <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 600 }}>
        <input type="checkbox" checked={s.bloodMoon} onChange={(e) => set({ bloodMoon: e.target.checked })} />
        Possessed can summon the Blood Moon
      </label>
      {s.bloodMoon &&
        MOON_NUMBERS.map((n) => {
          const v = s[n.key] as number;
          return (
            <div key={n.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1 }}>{n.label}</span>
              <button className="btn ghost" style={{ padding: "4px 14px", minHeight: 42 }} disabled={v <= n.min} onClick={() => set({ [n.key]: Math.max(n.min, v - n.step) })}>
                −
              </button>
              <strong style={{ minWidth: 44, textAlign: "center" }}>{v}</strong>
              <button className="btn ghost" style={{ padding: "4px 14px", minHeight: 42 }} disabled={v >= n.max} onClick={() => set({ [n.key]: Math.min(n.max, v + n.step) })}>
                +
              </button>
            </div>
          );
        })}
    </div>
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
