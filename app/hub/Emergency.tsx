"use client";

import { dur, secondsLeft, type View } from "@/lib/client";
import { Soul } from "@/components/shared";

// How full the meeting ring is (0–1). Meetings can be called once it's full.
export function meetingRing(s: View, now: number) {
  const span = s.meetingsReadyAt - s.meetingsFrom;
  return span <= 0 ? 1 : Math.min(1, Math.max(0, (now - s.meetingsFrom) / span));
}

// Why the emergency button can't be pressed right now, or null if it can.
export function emergencyBlock(s: View, now: number) {
  if (s.hush.active) return `🤫 The Hush! No meetings for ${dur(secondsLeft(s.hush.endsAt, now))}`;
  if (s.bloodMoon.active) return "Not during the Blood Moon!";
  if (now < s.meetingsReadyAt) return "The ring around the pentagram isn't full yet";
  if (!s.players.some((p) => p.alive && p.meetingsLeft > 0)) return "Every meeting has been used";
  return null;
}

// One quiet line under the sigil. It lights up once the meeting ring is full,
// and shows a padlock while the Hush is on. Keyboard only: any key, then a number.
export function MeetingStatus({ s, now }: { s: View; now: number }) {
  if (s.hush.active) {
    return (
      <p className="meeting-status hushed-line">
        🔒 The Hush silences the bell <b className="creep">{secondsLeft(s.hush.endsAt, now)}</b>
      </p>
    );
  }
  const why = emergencyBlock(s, now);
  if (!why) return <p className="meeting-status ready">🔔 Press any key to call a meeting</p>;
  return <p className="meeting-status">{now < s.meetingsReadyAt ? "The bell sleeps until the blue ring is full…" : why}</p>;
}

// Whoever pressed a key types their number and presses Enter, which spends their meeting.
export function EmergencyPicker({ s, typed }: { s: View; typed: string }) {
  const match = s.players.find((p) => String(p.num) === typed);
  return (
    <div className="overlay fade-in" style={{ zIndex: 45 }}>
      <div style={{ fontSize: "5vw", lineHeight: 1 }}>🔔</div>
      <h2 className="creep blood" style={{ fontSize: "4vw", margin: "1vh 0" }}>Type your number, then press Enter</h2>
      <div className="panel" style={{ minWidth: "16vw", padding: "1vh 2vw", fontSize: "7vw", fontWeight: 800, color: "var(--candle)", lineHeight: 1.1 }}>
        {typed || "_"}
      </div>
      <p style={{ fontSize: "2.2vw", fontWeight: 800, minHeight: "3.4vw", margin: "1.4vh 0" }}>
        {!typed
          ? " "
          : !match
            ? "No one has that number"
            : !match.alive
              ? `${match.name} is a ghost`
              : match.meetingsLeft === 0
                ? `${match.name} has used their meeting`
                : `${match.name}: press Enter to call the meeting`}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.2vw 2vw", justifyContent: "center", maxWidth: "80vw" }}>
        {s.players.map((p) => (
          <span
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: "1.7vw",
              opacity: p.alive && p.meetingsLeft > 0 ? 1 : 0.35,
              color: p === match ? "var(--candle)" : undefined,
            }}
          >
            <span className="num-badge">{p.num}</span>
            <Soul color={p.color} crown={p.crowned} size={22} dead={!p.alive} />
            {p.name}
          </span>
        ))}
      </div>
      <p style={{ marginTop: "3vh", fontSize: "1.4vw", color: "var(--dim)" }}>⌫ Backspace to fix · Esc to cancel</p>
    </div>
  );
}
