import type { Settings } from "./game";

// Every lobby setting, grouped the way the game plays. The TV's host panel and /admin
// both draw their settings from this list, so the two never drift apart.

type Base = { key: keyof Settings; label: string; hint?: string; when?: keyof Settings };
export type NumberField = Base & { kind: "number"; min: number; max: number; step: number; zero?: string; seconds?: boolean };
export type ToggleField = Base & { kind: "toggle" };
export type SettingGroup = { title: string; fields: (NumberField | ToggleField)[] };

export const SETTING_GROUPS: SettingGroup[] = [
  {
    title: "😈 Roles",
    fields: [
      { kind: "number", key: "traitors", label: "Possessed", min: 0, max: 3, step: 1, zero: "Auto", hint: "Auto: 1 for 3–7 players, 2 for 8+" },
      { kind: "toggle", key: "revealOnEject", label: "Show the role of whoever is voted out" },
    ],
  },
  {
    title: "📜 Rituals",
    fields: [
      { kind: "number", key: "ritualsPerPlayer", label: "Rituals per player", min: 1, max: 10, step: 1, hint: "Sets the size of the shared pool" },
      { kind: "number", key: "claimTimeout", label: "Time to do a claimed ritual", min: 60, max: 600, step: 30, seconds: true },
    ],
  },
  {
    title: "🔔 Meetings",
    fields: [
      { kind: "number", key: "meetingsPerPlayer", label: "Emergency meetings each (TV)", min: 0, max: 5, step: 1, hint: "Reporting a body is always free" },
      { kind: "number", key: "meetingCooldown", label: "Meeting ring fills in", min: 30, max: 300, step: 15, seconds: true, hint: "Each finished ritual takes 2–5s off" },
      { kind: "number", key: "discussion", label: "Talk time", min: 15, max: 300, step: 15, seconds: true },
      { kind: "number", key: "voting", label: "Voting time", min: 15, max: 180, step: 15, seconds: true },
      { kind: "toggle", key: "revive", label: "Players reported while alive can tap “I’m not dead!”" },
    ],
  },
  {
    title: "🌕 Possessed powers",
    fields: [
      { kind: "toggle", key: "bloodMoon", label: "The Possessed can summon the Blood Moon" },
      { kind: "number", key: "bloodMoonDuration", label: "Time to stop the Blood Moon", min: 20, max: 180, step: 10, seconds: true, when: "bloodMoon" },
      { kind: "toggle", key: "hush", label: "The Possessed can call the Hush (no meetings)" },
      { kind: "number", key: "hushDuration", label: "The Hush lasts", min: 15, max: 180, step: 15, seconds: true, when: "hush" },
      { kind: "number", key: "bloodMoonGrace", label: "No powers for the first", min: 0, max: 600, step: 30, seconds: true },
      { kind: "number", key: "bloodMoonCooldown", label: "Wait between powers", min: 30, max: 600, step: 30, seconds: true },
    ],
  },
  {
    title: "📺 TV",
    fields: [{ kind: "toggle", key: "scares", label: "Jump scares on the TV (turn off for little kids)" }],
  },
];

// "45s", "1:30"
export const secondsLabel = (v: number) => (v >= 60 ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}` : `${v}s`);
