// Defaults for the lobby settings (the host can change them on the hub).
export const DEFAULT_SETTINGS = {
  traitors: 0, // 0 = auto (1 for 6–7 players, 2 for 8+)
  tasksPerPlayer: 4,
  killCooldown: 45, // seconds
  discussion: 90, // seconds
  voting: 45, // seconds
  bellsPerPlayer: 1,
  revealOnEject: false,
  bloodMoon: true,
  scares: true, // occasional jump-scare flashes on the TV
};

// Minimum souls before the host can start (relaxed to 3 in local dev for testing).
export const MIN_PLAYERS = 6;
export const MAX_PLAYERS = 12;

export const REVEAL_SECONDS = 10;
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
