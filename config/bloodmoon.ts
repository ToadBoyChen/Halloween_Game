// ─────────────────────────────────────────────────────────────
//  BLOOD MOON (sabotage)
//
//  Put a playing card (or a scrap of paper) at each location.
//  Each Blood Moon picks a random seal it hasn't used yet. Players
//  find both cards and type them into the hub (in any order,
//  spaces/case ignored — "A10", "a 10" and "10A" all work).
//
//  Add as many seals as you have cards, so players can't memorise
//  the answer after the first Blood Moon.
// ─────────────────────────────────────────────────────────────

export type SealCard = { location: string; card: string };
export type Seal = { cards: [SealCard, SealCard] };

export const BLOOD_MOON = {
  duration: 60, // seconds to stop it
  cooldown: 180, // seconds between Blood Moons (shared by all Possessed)
  graceStart: 120, // can't be summoned in the first N seconds of a game
  seals: [
    { cards: [{ location: "Front door", card: "A" }, { location: "Back porch", card: "10" }] },
    { cards: [{ location: "Bathroom", card: "K" }, { location: "Garage", card: "7" }] },
    { cards: [{ location: "Kitchen", card: "Q" }, { location: "Stairs", card: "3" }] },
  ] as Seal[],
};
