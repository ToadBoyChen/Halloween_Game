"use client";

import { useEffect, useState } from "react";
import { useMounted } from "@/lib/client";
import { Atmos } from "@/components/shared";

type Debug = {
  phase: string;
  stage: string | null;
  endsIn: number;
  winner: { side: string; reason: string } | null;
  progress: { done: number; total: number };
  bloodMoon: { code: string; cards: { location: string; card: string }[] } | null;
  votes: number;
  players: { name: string; bot: boolean; role: string | null; alive: boolean; tasks: string }[];
};

// Control panel for testing alone on a live deployment. Open /play in another tab
// (or on your phone) to be the human player, and /hub for the TV.
export default function TestPage() {
  const mounted = useMounted();
  return mounted ? <Tools /> : <Atmos />;
}

function Tools() {
  const [state, setState] = useState<Debug | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const call = async (params: Record<string, string | number>) => {
    const res = await fetch("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(`⚠️ ${data.error}`);
      return;
    }
    if (params.do === "state") setState(data);
    else {
      setState(data.state);
      setMsg(`✓ ${params.do}: ${JSON.stringify(data.result)}`);
    }
    return true;
  };

  // Refresh the summary every 2 seconds.
  useEffect(() => {
    const load = () =>
      fetch("/api/test?do=state", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setState(d))
        .catch(() => {});
    const first = setTimeout(load, 0);
    const id = setInterval(load, 2000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const btn = (label: string, params: Record<string, string | number>, primary = false) => (
    <button
      key={label}
      className={`btn ${primary ? "primary" : ""}`}
      style={{ fontSize: "1rem", minHeight: 48, padding: "10px 12px" }}
      onClick={() => call(params)}
    >
      {label}
    </button>
  );

  const s = state;
  return (
    <>
      <Atmos />
      <main className="screen phone" style={{ display: "grid", gap: 16, alignContent: "start" }}>
        <h1 className="creep blood" style={{ fontSize: "2.4rem" }}>Test Tools</h1>
        <p style={{ color: "var(--dim)", fontSize: ".95rem" }}>
          Join as yourself at <a href="/play" target="_blank" style={{ color: "var(--candle)" }}>/play</a> (another tab or your phone), and open{" "}
          <a href="/hub" target="_blank" style={{ color: "var(--candle)" }}>/hub</a> for the TV.
        </p>

        {s && (
          <section className="panel" style={{ padding: 14, display: "grid", gap: 6, fontSize: ".95rem" }}>
            <strong>
              {s.phase}
              {s.stage ? ` → ${s.stage}` : ""} {s.endsIn > 0 && s.phase !== "playing" ? `(${s.endsIn}s)` : ""}
            </strong>
            {s.winner && <span className="blood">Winner: {s.winner.side} ({s.winner.reason})</span>}
            <span>Tasks: {s.progress.done}/{s.progress.total} {s.stage === "voting" ? `· Votes: ${s.votes}` : ""}</span>
            {s.bloodMoon && (
              <span className="blood">
                🌕 Code: <strong>{s.bloodMoon.code}</strong> ({s.bloodMoon.cards.map((c) => `${c.card} @ ${c.location}`).join(", ")})
              </span>
            )}
            {s.players.map((p) => (
              <span key={p.name} style={{ opacity: p.alive ? 1 : 0.5 }}>
                {p.alive ? "" : "☠ "}
                {p.name} — {p.role === "traitor" ? "😈 Possessed" : p.role === "member" ? "🕯️ Mortal" : "–"} · {p.tasks}
              </span>
            ))}
          </section>
        )}
        {msg && <p style={{ fontSize: ".9rem", wordBreak: "break-word" }}>{msg}</p>}

        <Group title="1. Lobby">
          {btn("Add 5 bots", { do: "bots", n: 5 }, true)}
          {btn("Add 1 bot", { do: "bots", n: 1 })}
          {btn("Remove bots", { do: "clearbots" })}
          {btn("Fast timers", { do: "fast" })}
          {btn("Back to lobby", { do: "lobby" })}
          {btn("Reset everything", { do: "reset" })}
        </Group>

        <Group title="2. Start">
          {btn("Start: I'm Possessed", { do: "start", role: "traitor" }, true)}
          {btn("Start: I'm Mortal", { do: "start", role: "member" }, true)}
          {btn("Start: random", { do: "start" })}
          {btn("Everyone ready", { do: "ready" })}
        </Group>

        <Group title="3. Playing">
          {btn("Bots do 50% tasks", { do: "bottasks", pct: 50 })}
          {btn("Bots do all tasks", { do: "bottasks", pct: 100 })}
          {btn("Kill a bot", { do: "botkill" })}
          {btn("Kill me", { do: "botkill", name: humanName(s) ?? "" })}
          {btn("Bot reports body", { do: "botreport" })}
          {btn("Bot rings bell", { do: "botbell" })}
          {btn("Clear cooldowns", { do: "cooldowns" })}
          {btn("🌕 Blood Moon now", { do: "moon" }, true)}
          {btn("Bot stops Blood Moon", { do: "botseal" })}
        </Group>

        <Group title="4. Meeting">
          {btn("Skip to next stage", { do: "skip" })}
          {btn("Bots vote skip", { do: "botvote", target: "skip" })}
          {btn("Bots vote random", { do: "botvote", target: "random" })}
          {btn("Bots vote me", { do: "botvote", target: humanName(s) ?? "" })}
        </Group>

        <p style={{ color: "var(--dim)", fontSize: ".85rem" }}>
          Every button here is also a URL:{" "}
          <code>/api/test?do=bots&amp;n=5</code>
        </p>
      </main>
    </>
  );
}

const humanName = (s: Debug | null) => s?.players.find((p) => !p.bot)?.name;

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <h2 className="creep" style={{ fontSize: "1.5rem", color: "var(--candle)" }}>{title}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{children}</div>
    </section>
  );
}
