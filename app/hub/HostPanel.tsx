"use client";

import { useState } from "react";
import { post, type View } from "@/lib/client";
import { Soul } from "@/components/shared";
import type { Settings } from "@/lib/game";

const PIN_KEY = "possessed-pin";

function savedPin() {
  try {
    return localStorage.getItem(PIN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function HostPanel({ s, onState, onClose }: { s: View; onState: (v: View) => void; onClose: () => void }) {
  const [pin, setPin] = useState(savedPin);
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (body: Record<string, unknown>) => {
    try {
      setError(null);
      const v = await post<View>("/api/host", { pin, ...body });
      if (body.type !== "check") onState({ ...v, me: null });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  const login = async () => {
    if (await call({ type: "check" })) {
      try {
        localStorage.setItem(PIN_KEY, pin);
      } catch {}
      setAuthed(true);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 45, background: "rgba(0,0,0,.6)", display: "flex", justifyContent: "flex-end" }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{
          width: "min(520px, 100vw)",
          height: "100vh",
          overflowY: "auto",
          borderRadius: 0,
          padding: 24,
          display: "grid",
          alignContent: "start",
          gap: 18,
          textAlign: "left",
          fontSize: "1rem",
          background: "rgba(12,4,6,.97)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="creep blood" style={{ fontSize: "2rem" }}>Host Controls</h2>
          <button className="btn ghost" style={{ padding: "6px 12px" }} onClick={onClose}>
            Close
          </button>
        </div>
        {error && <p className="blood">{error}</p>}

        {!authed ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              login();
            }}
            style={{ display: "grid", gap: 10 }}
          >
            <input
              className="input"
              type="password"
              inputMode="numeric"
              placeholder="Host PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
            />
            <button className="btn primary">Enter</button>
          </form>
        ) : (
          <Controls s={s} call={call} />
        )}
      </aside>
    </div>
  );
}

type Call = (body: Record<string, unknown>) => Promise<boolean>;

function Controls({ s, call }: { s: View; call: Call }) {
  const lobby = s.phase === "lobby";
  const inGame = s.phase === "playing" || s.phase === "meeting" || s.phase === "reveal";
  const short = s.players.length < s.minPlayers;

  return (
    <>
      <Section title="Game">
        {lobby && (
          <button className="btn primary" disabled={short} onClick={() => call({ type: "start" })}>
            {short ? `Need ${s.minPlayers - s.players.length} more souls` : "Begin the ritual"}
          </button>
        )}
        {s.phase === "playing" && (
          <button className="btn" onClick={() => call({ type: "meeting" })}>
            Force a séance
          </button>
        )}
        {(s.phase === "reveal" || s.phase === "meeting") && (
          <button className="btn" onClick={() => call({ type: "skip" })}>
            Skip timer
          </button>
        )}
        {s.bloodMoon.active && (
          <button className="btn" onClick={() => call({ type: "cancelMoon" })}>
            Cancel Blood Moon
          </button>
        )}
        {s.phase === "over" && (
          <button className="btn primary" onClick={() => call({ type: "lobby" })}>
            Play again (same souls)
          </button>
        )}
        {inGame && (
          <button className="btn ghost" onClick={() => confirm("End this game and return to the lobby?") && call({ type: "lobby" })}>
            Abort to lobby
          </button>
        )}
        <a className="btn ghost" href="/setup" target="_blank" style={{ textAlign: "center" }}>
          Ritual & card setup list ↗
        </a>
      </Section>

      <Section title={`Souls (${s.players.length})`}>
        {s.players.length === 0 && <p style={{ color: "var(--dim)" }}>No one yet.</p>}
        {s.players.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Soul color={p.color} size={14} />
            <span style={{ flex: 1 }}>{p.name}</span>
            <button
              className="btn ghost"
              style={{ padding: "4px 10px", fontSize: ".85rem" }}
              onClick={() => confirm(`Kick ${p.name}?`) && call({ type: "kick", id: p.id })}
            >
              Kick
            </button>
          </div>
        ))}
      </Section>

      {lobby && <SettingsForm s={s} call={call} />}

      <Section title="Rituals">
        <p style={{ color: "var(--dim)", fontSize: ".9rem" }}>
          {lobby ? "Tap to switch rituals on/off for tonight." : "Changes apply to the next game."} Add new ones in{" "}
          <code>config/rituals.ts</code>.
        </p>
        {s.rituals.map((r) => (
          <label key={r.id} style={{ display: "flex", gap: 10, alignItems: "center", opacity: r.enabled ? 1 : 0.45 }}>
            <input type="checkbox" checked={r.enabled} onChange={() => call({ type: "toggleRitual", id: r.id })} />
            <span style={{ flex: 1 }}>{r.name}</span>
            <span style={{ color: "var(--candle)", fontSize: ".85rem" }}>{r.location}</span>
          </label>
        ))}
      </Section>

      <Section title="Danger">
        <button
          className="btn ghost"
          onClick={() => confirm("Reset everything? All players will need to rejoin.") && call({ type: "reset" })}
        >
          Reset everything
        </button>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "grid", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
      <h3 className="creep" style={{ fontSize: "1.4rem", color: "var(--candle)" }}>{title}</h3>
      {children}
    </section>
  );
}

const NUMBERS: { key: keyof Settings; label: string; min: number; max: number; step: number; zero?: string }[] = [
  { key: "traitors", label: "Possessed", min: 0, max: 3, step: 1, zero: "Auto" },
  { key: "tasksPerPlayer", label: "Rituals per soul", min: 1, max: 10, step: 1 },
  { key: "killCooldown", label: "Kill cooldown (s)", min: 10, max: 180, step: 5 },
  { key: "discussion", label: "Discussion (s)", min: 15, max: 300, step: 15 },
  { key: "voting", label: "Voting (s)", min: 15, max: 180, step: 15 },
  { key: "bellsPerPlayer", label: "Bells per soul", min: 0, max: 3, step: 1 },
];

function SettingsForm({ s, call }: { s: View; call: Call }) {
  const set = (patch: Partial<Settings>) => call({ type: "settings", settings: patch });
  return (
    <Section title="Settings">
      {NUMBERS.map((n) => {
        const v = s.settings[n.key] as number;
        return (
          <div key={n.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1 }}>{n.label}</span>
            <button className="btn ghost" style={{ padding: "4px 12px" }} disabled={v <= n.min} onClick={() => set({ [n.key]: v - n.step })}>
              −
            </button>
            <strong style={{ minWidth: 52, textAlign: "center" }}>{v === 0 && n.zero ? `${n.zero} (${s.traitorCount})` : v}</strong>
            <button className="btn ghost" style={{ padding: "4px 12px" }} disabled={v >= n.max} onClick={() => set({ [n.key]: v + n.step })}>
              +
            </button>
          </div>
        );
      })}
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input type="checkbox" checked={s.settings.revealOnEject} onChange={(e) => set({ revealOnEject: e.target.checked })} />
        Reveal role when cast into the void
      </label>
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input type="checkbox" checked={s.settings.bloodMoon} onChange={(e) => set({ bloodMoon: e.target.checked })} />
        Blood Moon sabotage
      </label>
    </Section>
  );
}
