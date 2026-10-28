// ─────────────────────────────────────────────────────────────
//  RITUALS (tasks)
//
//  Add a ritual:     add an entry below (id must be unique).
//  Remove a ritual:  delete it, or set `enabled: false`.
//  You can also switch rituals on/off in the hub lobby without
//  redeploying.
// ─────────────────────────────────────────────────────────────

export type Ritual = {
  id: string;
  name: string;
  location: string;
  instructions: string;
  enabled?: boolean;
};

export const RITUALS: Ritual[] = [
  {
    id: "mirror",
    name: "Face the Mirror",
    location: "Bathroom",
    instructions: "Stare into the mirror for 10 seconds. Do not blink. Do not look away.",
  },
  {
    id: "hallway",
    name: "The Backwards Walk",
    location: "Hallway",
    instructions: "Walk the full length of the hallway backwards. Never look behind you.",
  },
  {
    id: "pumpkins",
    name: "Bless the Pumpkins",
    location: "Front porch",
    instructions: "Touch every pumpkin on the porch and whisper “rest now” to each one.",
  },
  {
    id: "closet",
    name: "The Dark Closet",
    location: "Hallway closet",
    instructions: "Step inside, close the door, and count slowly to 30 in the dark.",
  },
  {
    id: "fridge",
    name: "Feed the Hungry Thing",
    location: "Kitchen",
    instructions: "Open the fridge and whisper your full name into it. Close it gently.",
  },
  {
    id: "stairs",
    name: "Thirteen Steps",
    location: "Stairs",
    instructions: "Stand on the stairs with your eyes closed and count to 13.",
  },
  {
    id: "door",
    name: "Knock for the Dead",
    location: "Back door",
    instructions: "Knock three times on the back door. Wait. Knock once more.",
  },
  {
    id: "frontdoor",
    name: "Turn the Spirits Away",
    location: "Front door",
    instructions: "Spin around three times facing the front door, then say “not tonight.”",
  },
  {
    id: "sink",
    name: "Wash Away Your Sins",
    location: "Kitchen sink",
    instructions: "Wash your hands slowly while counting to 20. Do not look up.",
  },
  {
    id: "candle",
    name: "Keep the Flame",
    location: "Living room",
    instructions: "Stand perfectly still beside a candle or lamp for 15 seconds.",
  },
  {
    id: "couch",
    name: "Check Beneath",
    location: "Living room couch",
    instructions: "Look under every cushion of the couch. Something might be hiding.",
  },
  {
    id: "window",
    name: "Watch the Window",
    location: "Any window",
    instructions: "Stare out a window into the dark for 15 seconds. Count what moves.",
  },
];
