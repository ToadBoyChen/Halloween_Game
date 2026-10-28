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
};

// Minimum souls before the host can start (relaxed to 3 in local dev for testing).
export const MIN_PLAYERS = 6;
export const MAX_PLAYERS = 12;

export const REVEAL_SECONDS = 10;
export const SUMMONS_SECONDS = 6;
export const VERDICT_SECONDS = 9;

export const SOUL_COLORS = [
  { id: "crimson", label: "Crimson", hex: "#c1121f" },
  { id: "ember", label: "Ember", hex: "#f77f00" },
  { id: "bile", label: "Bile", hex: "#b5c80e" },
  { id: "moss", label: "Moss", hex: "#3a7d44" },
  { id: "frost", label: "Frost", hex: "#7fd1e8" },
  { id: "bruise", label: "Bruise", hex: "#5b3fa8" },
  { id: "orchid", label: "Orchid", hex: "#c77dff" },
  { id: "rose", label: "Rose", hex: "#ff6b9a" },
  { id: "bone", label: "Bone", hex: "#e9e3d0" },
  { id: "ash", label: "Ash", hex: "#7a7a7a" },
  { id: "rust", label: "Rust", hex: "#8b4513" },
  { id: "gold", label: "Gold", hex: "#e0b13a" },
];
