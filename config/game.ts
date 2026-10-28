import { BLOOD_MOON } from "./bloodmoon";

// Defaults for the lobby settings (the host can change them on the hub).
export const DEFAULT_SETTINGS = {
  traitors: 0, // 0 = auto (1 for 3–7 players, 2 for 8+)
  ritualsPerPlayer: 3, // size of the shared ritual pool (capped by how many rituals are enabled)
  claimTimeout: 300, // seconds a claimed ritual is held before it goes back into the pool
  discussion: 90, // seconds
  voting: 45, // seconds
  meetingsPerPlayer: 1, // emergency meetings each player can call from the TV keyboard (reporting a body is free)
  meetingCooldown: 90, // seconds after play starts or resumes before anyone can call one
  revealOnEject: false,
  revive: true, // someone reported while still alive can tap "I'm not dead!" until the next meeting ends
  hush: true, // the Possessed can call the Hush: no meetings for a while
  hushDuration: 60, // seconds
  bloodMoon: true,
  bloodMoonDuration: BLOOD_MOON.duration, // seconds to stop it
  bloodMoonCooldown: BLOOD_MOON.cooldown, // seconds between Blood Moons
  bloodMoonGrace: BLOOD_MOON.graceStart, // seconds before the first one is allowed
  scares: true, // occasional jump-scare flashes on the TV
};

// Minimum souls before the host can start.
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;

export const SUMMONS_SECONDS = 6;
export const VERDICT_SECONDS = 9;

// The souls players swipe through when joining. `kind` is the soul's spooky title.
export const SOUL_COLORS = [
  { id: "crimson", label: "Crimson", kind: "Blood Wraith", hex: "#e0182d" },
  { id: "ember", label: "Ember", kind: "Fire Spirit", hex: "#ff8a1f" },
  { id: "gold", label: "Gold", kind: "Gilded Ghost", hex: "#f2c230" },
  { id: "bile", label: "Bile", kind: "Swamp Ghoul", hex: "#b5d40e" },
  { id: "moss", label: "Moss", kind: "Forest Phantom", hex: "#3fae55" },
  { id: "frost", label: "Frost", kind: "Ice Specter", hex: "#7fd8f0" },
  { id: "bruise", label: "Bruise", kind: "Shadow Shade", hex: "#6a4cff" },
  { id: "orchid", label: "Orchid", kind: "Witch Light", hex: "#c77dff" },
  { id: "rose", label: "Rose", kind: "Lost Bride", hex: "#ff6b9a" },
  { id: "bone", label: "Bone", kind: "Old Bones", hex: "#efe8d2" },
  { id: "ash", label: "Ash", kind: "Ash Ghost", hex: "#9a9a9a" },
  { id: "rust", label: "Rust", kind: "Rust Revenant", hex: "#c0602a" },
];
