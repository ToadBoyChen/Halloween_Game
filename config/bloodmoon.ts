// ─────────────────────────────────────────────────────────────
//  BLOOD MOON (sabotage)
//
//  Put a playing card (or a scrap of paper) at each location.
//  Each Blood Moon picks a random seal it hasn't used yet. Players
//  find the card at each location and tap it on their phone from
//  6 choices (A, 2–10, J, Q, K). One player can do both, or two
//  players can split up. A wrong pick locks that player out briefly.
//
//  Add as many seals as you have cards, so players can't memorise
//  the answer after the first Blood Moon.
// ─────────────────────────────────────────────────────────────

export type SealCard = { location: string; card: string };
export type Seal = { cards: [SealCard, SealCard] };

// The timings below are defaults; the host can change them in the hub's host panel.
export const BLOOD_MOON = {
  duration: 60, // seconds to stop it
  cooldown: 180, // seconds between Blood Moons (shared by all Possessed)
  graceStart: 120, // can't be summoned in the first N seconds of a game
  wrongLockout: 10, // seconds a player must wait after picking a wrong card
  seals: [
    { cards: [{ location: "Front door", card: "A" }, { location: "Back porch", card: "10" }] },
    { cards: [{ location: "Bathroom", card: "K" }, { location: "Garage", card: "7" }] },
    { cards: [{ location: "Kitchen", card: "Q" }, { location: "Stairs", card: "3" }] },
  ] as Seal[],
};
