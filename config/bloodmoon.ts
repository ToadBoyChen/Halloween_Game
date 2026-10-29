// ─────────────────────────────────────────────────────────────
//  BLOOD MOON (sabotage)
//
//  No setup needed. When the Possessed summon it, the game makes a
//  secret code and every living player's phone shows one half of it:
//  the first half or the second half. Find someone with the other
//  half, then type the whole code on the TV keyboard and press Enter
//  before time runs out.
//
//  The Possessed can't sabotage it. Their phones show a real half,
//  and the Mortals always hold both halves between them (two of each
//  once there are four Mortals), so lying about a half or hiding it
//  never stops the Mortals. A wrong code on the TV costs nothing,
//  so typing junk on the keyboard can't lock anyone out either.
// ─────────────────────────────────────────────────────────────

// The timings below are defaults; the host can change them in the hub's host panel.
export const BLOOD_MOON = {
  duration: 60, // seconds to stop it
  cooldown: 180, // seconds between Blood Moons (shared by all Possessed)
  graceStart: 120, // can't be summoned in the first N seconds of a game
  codeLength: 6, // digits in the code (each half is half of this)
};
