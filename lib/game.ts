import { ANSWER_OPTIONS, RITUALS, WRONG_ANSWER_LOCKOUT, type Ritual } from "@/config/rituals";
import { BLOOD_MOON } from "@/config/bloodmoon";
import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  SOUL_COLORS,
  SUMMONS_SECONDS,
  VERDICT_SECONDS,
} from "@/config/game";

// ─── Types ───────────────────────────────────────────────────

export type Role = "member" | "traitor";
export type Phase = "lobby" | "reveal" | "playing" | "meeting" | "over";
export type Stage = "summons" | "discussion" | "voting" | "verdict";
export type Settings = typeof DEFAULT_SETTINGS;
export type WinReason = "tasks" | "banished" | "parity" | "bloodmoon" | "abandoned";

export type Player = {
  id: string;
  token: string;
  name: string;
  color: string;
  role: Role | null;
  special?: "lantern" | null; // the Lantern Bearer is a Mortal with one big reveal per game
  lanternUsed?: boolean;
  alive: boolean; // false once someone reports their body, or they're voted out
  diedAt?: number;
  foundBy?: string | null; // who reported their body
  ejected: boolean;
  meetingsCalled?: number;
  num?: number; // fixed when the game starts, so kicking someone doesn't renumber everyone
  bot?: boolean; // test bot (see lib/testing.ts)
  ready?: boolean; // pressed "I'm ready" after seeing their role
  drawn?: string | null; // ritual pulled from the pot, waiting for them to take it or put it back
  putBack?: string | null; // the last one they put back, so the next draw is something else
  wrongUntil?: number; // picked a wrong answer: can't answer again until this
  crowned?: boolean; // was on the winning side of the last game
};

// One ritual in the shared pool. Players draw them from the pot at random, then claim and finish them.
export type PoolRitual = {
  id: string;
  claimedBy: string | null;
  claimedAt: number;
  doneBy: string | null;
  doneAt: number;
  options?: string[]; // for rituals with a question: the answer plus some wrong ones, shuffled
};

export type Meeting = {
  stage: Stage;
  endsAt: number;
  reason: "report" | "emergency" | "host";
  callerId: string | null;
  newlyDead: string[];
  votes: Record<string, string>; // voterId -> targetId | "skip"
  readyToVote?: string[]; // living players who tapped "Ready to vote" during talk time
  lantern?: { picks: string[]; count: number; at: number } | null; // the Lantern Bearer's reveal this meeting
  result: { ejectedId: string | null; tie: boolean; counts: Record<string, number> } | null;
};

export type Game = {
  version: number;
  phase: Phase;
  phaseEndsAt: number;
  startedAt: number;
  round: number;
  settings: Settings;
  disabled: string[];
  players: Player[];
  pool: PoolRitual[];
  meeting: Meeting | null;
  // The Hush: a Possessed event. Nobody can call a meeting until it ends.
  hush?: { endsAt: number };
  bloodMoon: {
    active: boolean;
    endsAt: number;
    lastEndedAt: number;
    code: string; // the secret code, typed on the TV to stop it
    halves: Record<string, 0 | 1>; // player id -> which half of the code their phone shows
    savedAt: number; // when the code was last typed in time
  };
  selfDeaths?: number; // how many players have reported their own death this game (the TV plays a sound for each)
  meetingsReadyAt: number; // nobody can call a meeting before this
  lastMeetingAt: number; // when play last started or resumed
  winner: { side: Role; reason: WinReason } | null;
};

export class GameError extends Error {}

const fail = (msg: string): never => {
  throw new GameError(msg);
};

// ─── Creation ────────────────────────────────────────────────

export function newGame(): Game {
  return {
    version: 0,
    phase: "lobby",
    phaseEndsAt: 0,
    startedAt: 0,
    round: 0,
    settings: { ...DEFAULT_SETTINGS },
    disabled: RITUALS.filter((r) => r.enabled === false).map((r) => r.id),
    players: [],
    pool: [],
    meeting: null,
    bloodMoon: freshMoon(),
    meetingsReadyAt: 0,
    lastMeetingAt: 0,
    winner: null,
  };
}

const minPlayers = () => MIN_PLAYERS;

export function traitorCount(g: Game) {
  const n = g.players.length;
  const wanted = g.settings.traitors || (n < 8 ? 1 : 2);
  return Math.max(1, Math.min(wanted, Math.floor((n - 1) / 2)));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Catch typos in config/rituals.ts early. They show up in the server log.
for (const [i, r] of RITUALS.entries()) {
  if (RITUALS.findIndex((x) => x.id === r.id) !== i) console.warn(`[rituals] Two rituals share the id "${r.id}". Only the first one is used.`);
  if (r.requires && !RITUALS.some((x) => x.id === r.requires)) console.warn(`[rituals] "${r.id}" requires "${r.requires}", which doesn't exist. It will never appear.`);
}

const enabledRituals = (g: Game) => RITUALS.filter((r) => !g.disabled.includes(r.id));
const ritual = (id: string) => RITUALS.find((r) => r.id === id);

// The ritual plus every ritual it waits on, all the way back to the start of its chain.
// If a step is missing from config, switched off, or the chain loops back on itself, this
// returns that step's id instead: the ritual can never be unlocked, so it's left out.
function chainOf(r: Ritual, on: Set<string>): Ritual[] | string {
  const chain: Ritual[] = [];
  for (let id: string | undefined = r.id; id; ) {
    const x = ritual(id);
    if (!x || !on.has(id) || chain.includes(x)) return id;
    chain.push(x);
    id = x.requires;
  }
  return chain;
}

// Rituals that can go in a game: switched on, with every earlier step switched on too.
function playableRituals(g: Game) {
  const enabled = enabledRituals(g);
  const on = new Set(enabled.map((r) => r.id));
  return { enabled, on, playable: enabled.filter((r) => Array.isArray(chainOf(r, on))) };
}

// Fill the shared pool with random rituals. Rituals that share a first step form one
// storyline (e.g. all the Verity steps), and a lone ritual is a storyline of one. Storylines
// are shuffled and go in whole, first step first, so a chain is never missing a middle step
// and every ritual has about the same chance of being in the game. Only the last storyline
// may be cut short to fit, and then it's the ending that's dropped, never a middle step.
function buildPool(g: Game) {
  const { enabled, on, playable } = playableRituals(g);
  const want = Math.min(playable.length, g.settings.ritualsPerPlayer * g.players.length);
  const chains = new Map(playable.map((r) => [r.id, chainOf(r, on) as Ritual[]]));
  const storylines = new Map<string, Ritual[]>();
  for (const r of playable) {
    const first = chains.get(r.id)!.at(-1)!.id;
    storylines.set(first, [...(storylines.get(first) ?? []), r]);
  }
  const picked = new Set<string>();
  for (const storyline of shuffle([...storylines.values()])) {
    for (const x of storyline.sort((a, b) => chains.get(a.id)!.length - chains.get(b.id)!.length)) {
      if (picked.size >= want) break;
      picked.add(x.id);
    }
  }
  g.pool = enabled
    .filter((r) => picked.has(r.id))
    .map((r) => ({ id: r.id, claimedBy: null, claimedAt: 0, doneBy: null, doneAt: 0, options: answerOptions(r) }));
}

// The right answer plus a few wrong ones, shuffled. Rituals without a question get none.
function answerOptions(r: Ritual) {
  if (!r.answer) return undefined;
  const wrong = shuffle((r.choices ?? []).filter((c) => normalize(c) !== normalize(r.answer!))).slice(0, ANSWER_OPTIONS - 1);
  return shuffle([r.answer, ...wrong]);
}

// ─── Rules ───────────────────────────────────────────────────

const poolOf = (g: Game) => g.pool ?? [];

// Who holds a ritual right now. Claims lapse after the timeout so nobody can sit on one.
// The clock stops during meetings (it restarts when play resumes).
function holder(g: Game, e: PoolRitual, now: number) {
  return e.claimedBy && (g.phase === "meeting" || now - e.claimedAt < g.settings.claimTimeout * 1000) ? e.claimedBy : null;
}

// The ritual this one waits on, if it's in the pool.
function prerequisite(g: Game, e: PoolRitual) {
  const req = ritual(e.id)?.requires;
  return req ? poolOf(g).find((x) => x.id === req) : undefined;
}

// The ritual this one waits on, if it's not done yet.
function blocker(g: Game, e: PoolRitual) {
  const before = prerequisite(g, e);
  return before && !before.doneBy ? before : null;
}

export function progress(g: Game) {
  const pool = poolOf(g);
  return { done: pool.filter((e) => e.doneBy).length, total: pool.length };
}

function checkWin(g: Game): Game["winner"] {
  const alive = g.players.filter((p) => p.alive);
  const traitors = alive.filter((p) => p.role === "traitor").length;
  const members = alive.length - traitors;
  if (traitors === 0) return { side: "member", reason: "banished" };
  if (traitors >= members) return { side: "traitor", reason: "parity" };
  const { done, total } = progress(g);
  if (total > 0 && done >= total) return { side: "member", reason: "tasks" };
  return null;
}

// The winning side wear crowns until they lose a game. Ghosts and banished players
// on the winning side win too.
function endGame(g: Game, winner: NonNullable<Game["winner"]>) {
  g.phase = "over";
  g.winner = winner;
  g.players.forEach((p) => (p.crowned = p.role === winner.side));
  g.meeting = null;
  g.bloodMoon.active = false;
}

export function checkAndEnd(g: Game) {
  const w = checkWin(g);
  if (w) endGame(g, w);
}

function startMeeting(g: Game, reason: Meeting["reason"], callerId: string | null, now: number) {
  const newlyDead = g.players.filter((p) => !p.alive && !p.ejected && (p.diedAt ?? 0) >= (g.lastMeetingAt ?? 0));
  // Everyone keeps the ritual they were holding. Only claims that had already lapsed are dropped.
  poolOf(g).forEach((e) => !e.doneBy && !holder(g, e, now) && (e.claimedBy = null));
  if (g.bloodMoon.active) {
    g.bloodMoon.active = false;
    g.bloodMoon.lastEndedAt = now;
  }
  if (hushed(g, now)) g.hush = { endsAt: now };
  g.phase = "meeting";
  g.meeting = {
    stage: "summons",
    endsAt: now + SUMMONS_SECONDS * 1000,
    reason,
    callerId,
    newlyDead: newlyDead.map((p) => p.id),
    votes: {},
    result: null,
  };
}

function resolveVotes(g: Game, now: number) {
  const m = g.meeting!;
  const counts: Record<string, number> = {};
  for (const target of Object.values(m.votes)) counts[target] = (counts[target] ?? 0) + 1;
  const top = Math.max(0, ...Object.values(counts));
  const leaders = Object.keys(counts).filter((k) => counts[k] === top);
  const tie = leaders.length > 1;
  const ejectedId = !tie && top > 0 && leaders[0] !== "skip" ? leaders[0] : null;
  if (ejectedId) {
    const p = g.players.find((x) => x.id === ejectedId)!;
    p.alive = false;
    p.diedAt = now;
    p.ejected = true;
  }
  m.result = { ejectedId, tie, counts };
  m.stage = "verdict";
  m.endsAt = now + VERDICT_SECONDS * 1000;
}

// Apply any timer-driven transitions. Called on every read and write.
export function advance(g: Game, now: number): boolean {
  let changed = false;
  for (let guard = 0; guard < 10; guard++) {
    if (g.phase === "playing" && g.bloodMoon.active && now >= g.bloodMoon.endsAt) {
      endGame(g, { side: "traitor", reason: "bloodmoon" });
    } else if (g.phase === "meeting" && g.meeting && now >= g.meeting.endsAt) {
      const m = g.meeting;
      if (m.stage === "summons") {
        m.stage = "discussion";
        m.endsAt = now + g.settings.discussion * 1000;
      } else if (m.stage === "discussion") {
        m.stage = "voting";
        m.endsAt = now + g.settings.voting * 1000;
      } else if (m.stage === "voting") {
        resolveVotes(g, now);
      } else {
        g.meeting = null;
        g.phase = "playing";
        g.lastMeetingAt = now;
        // Kept claims get a fresh clock now that play resumes.
        poolOf(g).forEach((e) => e.claimedBy && !e.doneBy && (e.claimedAt = now));
        g.meetingsReadyAt = now + g.settings.meetingCooldown * 1000;
        checkAndEnd(g);
      }
    } else {
      break;
    }
    changed = true;
  }
  return changed;
}

// ─── Player actions ──────────────────────────────────────────

export function join(g: Game, name: string, color: string) {
  if (g.phase !== "lobby") fail("A game is already running. Join the next one!");
  name = name.trim().slice(0, 16);
  if (!name) fail("Type your name first.");
  if (g.players.length >= MAX_PLAYERS) fail("The game is full.");
  if (g.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) fail("That name is taken.");
  if (!SOUL_COLORS.some((c) => c.id === color)) fail("Pick a color.");
  if (g.players.some((p) => p.color === color)) fail("Someone already has that color.");
  const player: Player = {
    id: crypto.randomUUID().slice(0, 8),
    token: crypto.randomUUID(),
    name,
    color,
    role: null,
    alive: true,
    ejected: false,
  };
  g.players.push(player);
  return player;
}

export type Action =
  | { type: "leave" }
  | { type: "draw" }
  | { type: "putBack" }
  | { type: "claim"; id: string }
  | { type: "release" }
  | { type: "done"; id: string; answer?: string }
  | { type: "report"; id: string; meeting: boolean }
  | { type: "alive" }
  | { type: "died" }
  | { type: "hush" }
  | { type: "readyVote" }
  | { type: "lantern"; targets: string[] }
  | { type: "vote"; target: string }
  | { type: "summon" }
  | { type: "ready" };

export function act(g: Game, p: Player, a: Action, now: number) {
  const playing = g.phase === "playing";
  switch (a.type) {
    case "leave":
      if (g.phase !== "lobby") fail("You can't leave during a game.");
      g.players = g.players.filter((x) => x.id !== p.id);
      return;

    // Rituals come from one shared pot. Everyone's count, even the Possessed's. You pull
    // one at random, then take it or put it back. You hold one claim at a time.
    // Ghosts can finish the ritual they were holding, but can't take new ones.
    case "draw": {
      if (!playing) fail("Not now.");
      if (!p.alive) fail("Ghosts can't take new rituals.");
      if (poolOf(g).some((x) => x.claimedBy === p.id && !x.doneBy)) fail("Finish your ritual first.");
      // Prefer ones nobody else is looking at, and not the one you just put back.
      const open = poolOf(g).filter((e) => !e.doneBy && !holder(g, e, now) && !blocker(g, e));
      const unseen = open.filter((e) => !g.players.some((x) => x.id !== p.id && x.drawn === e.id));
      const fresh = (unseen.length ? unseen : open).filter((e) => e.id !== p.putBack);
      const choices = fresh.length ? fresh : unseen.length ? unseen : open;
      if (!choices.length) fail("The pot is empty right now. Check back soon…");
      p.drawn = choices[Math.floor(Math.random() * choices.length)].id;
      return;
    }

    case "putBack":
      p.putBack = p.drawn ?? null;
      p.drawn = null;
      return;

    case "claim": {
      if (!playing) fail("Not now.");
      if (!p.alive) fail("Ghosts can't take new rituals.");
      if (p.drawn !== a.id) fail("Draw a ritual from the pot first.");
      const e = poolOf(g).find((x) => x.id === a.id) ?? fail("That ritual isn't in this game.");
      p.drawn = null;
      if (e.doneBy) fail("That ritual is already done.");
      const who = holder(g, e, now);
      if (who === p.id) return;
      if (who) fail("Someone else just took that ritual. Draw again!");
      const before = blocker(g, e);
      if (before) fail(`Locked until “${ritual(before.id)?.name}” is done.`);
      poolOf(g).forEach((x) => x.claimedBy === p.id && (x.claimedBy = null));
      e.claimedBy = p.id;
      e.claimedAt = now;
      p.putBack = null;
      return;
    }

    case "release":
      poolOf(g).forEach((x) => x.claimedBy === p.id && (x.claimedBy = null));
      return;

    case "done": {
      if (!playing) fail("Not now.");
      const e = poolOf(g).find((x) => x.id === a.id) ?? fail("That ritual isn't in this game.");
      if (e.doneBy) fail("That ritual is already done.");
      if (e.claimedBy !== p.id) fail("Claim the ritual first.");
      const answer = ritual(e.id)?.answer;
      if (answer) {
        if ((p.wrongUntil ?? 0) > now) fail("Wrong answer! Wait a moment before trying again.");
        if (normalize(a.answer ?? fail("Pick your answer.")) !== normalize(answer)) {
          p.wrongUntil = now + WRONG_ANSWER_LOCKOUT * 1000;
          return; // the phone sees the lockout and shows "wrong answer"
        }
      }
      e.doneBy = p.id;
      e.doneAt = now;
      e.claimedBy = null;
      // Every finished ritual fills the meeting ring a little faster (2–5s off the wait).
      if (g.meetingsReadyAt > now) g.meetingsReadyAt = Math.max(now, g.meetingsReadyAt - (2 + Math.random() * 3) * 1000);
      checkAndEnd(g);
      return;
    }

    // Found a body: it becomes a ghost, and the finder can call a meeting right away. That
    // doesn't wait for the meeting ring or use up their emergency meeting (that's the TV's
    // button). Only the Hush and the Blood Moon stop it.
    case "report": {
      if (!playing) fail("Not now.");
      if (!p.alive) fail("Ghosts can't report bodies.");
      const body = g.players.find((x) => x.id === a.id) ?? fail("Pick whose body you found.");
      if (body.id === p.id) fail("That's you!");
      if (!body.alive) fail("They're already a ghost.");
      if (a.meeting && g.bloodMoon.active) fail("No meetings during the Blood Moon!");
      if (a.meeting && hushed(g, now)) fail("The Hush is on. No meetings!");
      body.alive = false;
      body.diedAt = now;
      body.foundBy = p.id;
      checkAndEnd(g);
      if (a.meeting && g.phase === "playing") startMeeting(g, "report", p.id, now);
      return;
    }

    // Killed and nobody's found you yet: report your own death. No meeting, and the TV only
    // makes a noise. Who it was isn't shown until the next meeting.
    case "died":
      if (!playing) fail("Not now.");
      if (!p.alive) fail("You're already a ghost.");
      p.alive = false;
      p.diedAt = now;
      p.foundBy = p.id;
      g.selfDeaths = (g.selfDeaths ?? 0) + 1;
      checkAndEnd(g);
      return;

    // The Hush: no meetings for a while. It shares the Blood Moon's cooldown.
    case "hush":
      if (!playing || p.role !== "traitor") fail("Not now.");
      if (!g.settings.hush) fail("The Hush is turned off.");
      if (g.bloodMoon.active || hushed(g, now)) fail("Something is already happening.");
      if (now < summonReadyAt(g)) fail("Not ready yet.");
      g.hush = { endsAt: now + g.settings.hushDuration * 1000 };
      return;

    // Reported by mistake (or by a lying Possessed): undo it, until the next meeting is over.
    case "alive":
      if (!canRevive(g, p)) fail("Too late to come back now.");
      p.alive = true;
      p.foundBy = null;
      if (g.meeting) g.meeting.newlyDead = g.meeting.newlyDead.filter((id) => id !== p.id);
      return;

    // The Lantern Bearer, once per game during talk time: how many of three players are Possessed.
    // The TV reveals the count to everyone, but never who lit the lantern.
    case "lantern": {
      const m = g.meeting;
      if (p.special !== "lantern") fail("Only the Lantern Bearer can do that.");
      if (p.lanternUsed) fail("Your lantern has already burned out.");
      if (!p.alive) fail("Ghosts can't light the lantern.");
      if (g.phase !== "meeting" || m?.stage !== "discussion") fail("Light it during talk time.");
      if (m!.lantern) fail("The lantern has already been lit this meeting.");
      if (g.players.filter((x) => x.alive && x.id !== p.id).length < 3) fail("There aren't three other living players to light it on.");
      const picks = [...new Set(a.targets)];
      if (picks.length !== 3) fail("Pick three players.");
      const chosen = picks.map((id) => g.players.find((x) => x.id === id && x.alive && x.id !== p.id) ?? fail("Pick three other living players."));
      p.lanternUsed = true;
      m!.lantern = { picks, count: chosen.filter((x) => x.role === "traitor").length, at: now };
      return;
    }

    // Talk time ends early once every living player is ready to vote.
    case "readyVote": {
      const m = g.meeting;
      if (g.phase !== "meeting" || m?.stage !== "discussion") fail("Talk time is over.");
      if (!p.alive) fail("Ghosts can't vote.");
      m!.readyToVote = [...new Set([...(m!.readyToVote ?? []), p.id])];
      if (g.players.filter((x) => x.alive).every((x) => m!.readyToVote!.includes(x.id))) {
        m!.stage = "voting";
        m!.endsAt = now + g.settings.voting * 1000;
      }
      return;
    }

    case "vote": {
      const m = g.meeting;
      if (g.phase !== "meeting" || m?.stage !== "voting") fail("Voting is closed.");
      if (!p.alive) fail("Ghosts can't vote.");
      if (m!.votes[p.id]) fail("You already voted.");
      if (a.target !== "skip" && !g.players.some((x) => x.id === a.target && x.alive))
        fail("You can't vote for them.");
      m!.votes[p.id] = a.target;
      const voters = g.players.filter((x) => x.alive);
      if (voters.every((x) => m!.votes[x.id])) resolveVotes(g, now);
      return;
    }

    case "summon": {
      const bm = g.bloodMoon;
      if (!playing || p.role !== "traitor") fail("Not now.");
      if (!g.settings.bloodMoon) fail("The Blood Moon is turned off.");
      if (bm.active) fail("The Blood Moon is already rising.");
      if (hushed(g, now)) fail("Something is already happening.");
      const readyAt = summonReadyAt(g);
      if (now < readyAt) fail("The Blood Moon isn't ready yet.");
      bm.active = true;
      bm.endsAt = now + g.settings.bloodMoonDuration * 1000;
      bm.code = Array.from({ length: BLOOD_MOON.codeLength }, () => Math.floor(Math.random() * 10)).join("");
      bm.halves = dealHalves(g);
      return;
    }

    case "ready":
      if (g.phase !== "reveal") fail("Not now.");
      p.ready = true;
      if (g.players.every((x) => x.ready)) beginHaunting(g, now);
      return;

    default:
      fail("Unknown action.");
  }
}

// When the Possessed can next summon the Blood Moon or call the Hush (one shared cooldown).
export function summonReadyAt(g: Game) {
  return Math.max(
    g.startedAt + g.settings.bloodMoonGrace * 1000,
    g.bloodMoon.lastEndedAt ? g.bloodMoon.lastEndedAt + g.settings.bloodMoonCooldown * 1000 : 0,
    g.hush?.endsAt ? g.hush.endsAt + g.settings.bloodMoonCooldown * 1000 : 0,
  );
}

const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

// Which half of the code each player's phone shows. Living Mortals are dealt first, taking
// turns, so both halves are always held by Mortals (two of each once there are four). That's
// what stops the Possessed from sabotaging it: they get a real half too, but lying about it or
// hiding it never leaves the Mortals stuck. Everyone else gets a random half, so a revived
// player has one and the halves give nothing away about who's who.
function dealHalves(g: Game) {
  const halves: Record<string, 0 | 1> = {};
  const first = Math.random() < 0.5 ? 0 : 1;
  shuffle(g.players.filter((p) => p.alive && p.role !== "traitor")).forEach((p, i) => (halves[p.id] = ((i + first) % 2) as 0 | 1));
  for (const p of g.players) if (!(p.id in halves)) halves[p.id] = Math.random() < 0.5 ? 0 : 1;
  return halves;
}

function freshMoon(): Game["bloodMoon"] {
  return {
    active: false,
    endsAt: 0,
    lastEndedAt: 0,
    code: "",
    halves: {},
    savedAt: 0,
  };
}

function beginHaunting(g: Game, now: number) {
  g.phase = "playing";
  g.phaseEndsAt = 0;
  g.startedAt = now;
  g.lastMeetingAt = now;
  g.meetingsReadyAt = now + g.settings.meetingCooldown * 1000;
}

export const hushed = (g: Game, now: number) => now < (g.hush?.endsAt ?? 0);

function checkCanCall(g: Game, p: Player, now: number) {
  if (g.bloodMoon.active) fail("No meetings during the Blood Moon!");
  if (hushed(g, now)) fail("The Hush is on. No meetings!");
  if ((p.meetingsCalled ?? 0) >= g.settings.meetingsPerPlayer) fail("You've used all your meetings.");
  if (now < (g.meetingsReadyAt ?? 0)) fail("The meeting ring isn't full yet.");
}

const canRevive = (g: Game, p: Player) =>
  g.settings.revive &&
  !p.alive && !!p.foundBy && !p.ejected && (g.phase === "playing" || g.phase === "meeting") && (p.diedAt ?? 0) >= (g.lastMeetingAt ?? 0);

// ─── Host actions ────────────────────────────────────────────

export type HostAction =
  | { type: "start" }
  | { type: "settings"; settings: Partial<Settings> }
  | { type: "toggleRitual"; id: string }
  | { type: "kick"; id: string }
  | { type: "meeting" }
  | { type: "emergency"; id: string }
  | { type: "skip" }
  | { type: "cancelMoon" }
  | { type: "summonMoon" }
  | { type: "moonCode"; code: string }
  | { type: "lobby" }
  | { type: "reset" };

export function host(g: Game, a: HostAction, now: number) {
  switch (a.type) {
    case "start": {
      if (g.phase !== "lobby") fail("A game is already running.");
      if (g.players.length < minPlayers()) fail(`At least ${minPlayers()} souls are needed.`);
      if (playableRituals(g).playable.length === 0) fail("Enable at least one ritual.");
      const k = traitorCount(g);
      const traitors = new Set(shuffle(g.players).slice(0, k).map((p) => p.id));
      g.players.forEach((p, i) => (p.num = i + 1));
      const mortals = shuffle(g.players.filter((p) => !traitors.has(p.id)));
      const lanternId = g.settings.lantern && g.players.length >= 5 ? mortals[0]?.id : undefined;
      for (const p of g.players) {
        p.special = p.id === lanternId ? "lantern" : null;
        p.lanternUsed = false;
        p.role = traitors.has(p.id) ? "traitor" : "member";
        p.alive = true;
        p.diedAt = 0;
        p.foundBy = null;
        p.ejected = false;
        p.meetingsCalled = 0;
        p.drawn = p.putBack = null;
        p.wrongUntil = 0;
      }
      buildPool(g);
      g.phase = "reveal";
      g.phaseEndsAt = 0; // no timer: the game starts when everyone presses "I'm ready"
      g.players.forEach((p) => (p.ready = !!p.bot));
      g.round++;
      g.meeting = null;
      g.winner = null;
      g.bloodMoon = freshMoon();
      g.hush = { endsAt: 0 };
      g.selfDeaths = 0;
      return;
    }

    case "settings": {
      if (g.phase !== "lobby") fail("Settings can only change in the lobby.");
      const s = g.settings as Record<string, unknown>;
      for (const [k, v] of Object.entries(a.settings)) {
        if (k in s && typeof v === typeof s[k]) s[k] = v;
      }
      return;
    }

    case "toggleRitual":
      g.disabled = g.disabled.includes(a.id)
        ? g.disabled.filter((x) => x !== a.id)
        : [...g.disabled, a.id];
      return;

    case "kick":
      g.players = g.players.filter((p) => p.id !== a.id);
      if (g.phase === "reveal" && g.players.every((p) => p.ready)) beginHaunting(g, now);
      if (g.phase === "playing" || g.phase === "meeting") checkAndEnd(g);
      return;

    case "meeting":
      if (g.phase !== "playing") fail("Not now.");
      startMeeting(g, "host", null, now);
      return;

    // The emergency button on the TV: whoever pressed it picks their name and spends their meeting.
    case "emergency": {
      if (g.phase !== "playing") fail("Not now.");
      const p = g.players.find((x) => x.id === a.id) ?? fail("Pick your name.");
      if (!p.alive) fail("Ghosts can't call meetings.");
      checkCanCall(g, p, now);
      p.meetingsCalled = (p.meetingsCalled ?? 0) + 1;
      startMeeting(g, "emergency", p.id, now);
      return;
    }

    case "skip":
      if (g.phase === "reveal") beginHaunting(g, now);
      else if (g.meeting) g.meeting.endsAt = now;
      advance(g, now);
      return;

    case "summonMoon": {
      if (g.phase !== "playing") fail("Not now.");
      const traitor = g.players.find((p) => p.role === "traitor") ?? fail("No Possessed in this game.");
      g.startedAt = Math.min(g.startedAt, now - g.settings.bloodMoonGrace * 1000 - 1);
      g.bloodMoon.lastEndedAt = 0;
      g.hush = { endsAt: 0 };
      act(g, traitor, { type: "summon" }, now);
      return;
    }

    // Someone typed the Blood Moon code on the TV keyboard. A wrong code just says so: no
    // lockout, so nobody (the Possessed included) can block the keyboard by typing junk.
    case "moonCode": {
      const bm = g.bloodMoon;
      if (g.phase !== "playing" || !bm.active) fail("There is no Blood Moon right now.");
      if (String(a.code).replace(/\D/g, "") !== bm.code) fail("Wrong code! Check both halves and try again.");
      bm.active = false;
      bm.lastEndedAt = now;
      bm.savedAt = now;
      return;
    }

    case "cancelMoon":
      if (g.bloodMoon.active) {
        g.bloodMoon.active = false;
        g.bloodMoon.lastEndedAt = now;
      }
      return;

    case "lobby":
      g.phase = "lobby";
      g.meeting = null;
      g.winner = null;
      g.bloodMoon.active = false;
      g.pool = [];
      g.players.forEach((p) => {
        p.role = null;
        p.alive = true;
      });
      return;

    case "reset":
      Object.assign(g, newGame(), { version: g.version });
      return;
  }
}

// ─── Views (what each screen is allowed to see) ──────────────

export function publicView(g: Game, now: number) {
  const nameOf = (id: string) => g.players.find((p) => p.id === id)?.name ?? "Someone";
  const over = g.phase === "over";
  const m = g.meeting;
  const verdict = m?.stage === "verdict" && m.result;
  const ejected = verdict && m.result!.ejectedId ? g.players.find((p) => p.id === m.result!.ejectedId) : null;
  const bm = g.bloodMoon;
  return {
    now,
    version: g.version,
    phase: g.phase,
    phaseEndsAt: g.phaseEndsAt,
    round: g.round,
    settings: g.settings,
    minPlayers: minPlayers(),
    traitorCount: g.players.length ? traitorCount(g) : 0,
    players: g.players.map((p, i) => ({
      id: p.id,
      num: g.phase === "lobby" ? i + 1 : (p.num ?? i + 1), // typed on the TV keyboard to call a meeting
      name: p.name,
      color: p.color,
      crowned: !!p.crowned,
      alive: p.alive,
      ejected: p.ejected,
      role: over ? p.role : null,
      special: over ? (p.special ?? null) : null,
      foundBy: !p.alive && p.foundBy ? nameOf(p.foundBy) : null,
      selfReported: !p.alive && p.foundBy === p.id,
      meetingsLeft: Math.max(0, g.settings.meetingsPerPlayer - (p.meetingsCalled ?? 0)),
    })),
    progress: g.phase === "lobby" ? { done: 0, total: 0 } : progress(g),
    pool: g.phase === "lobby" ? [] : poolOf(g).map((e) => {
      const r = ritual(e.id);
      const who = holder(g, e, now);
      const before = blocker(g, e);
      return {
        id: e.id,
        name: r?.name ?? e.id,
        location: r?.location ?? "",
        instructions: r?.instructions ?? "",
        options: e.options ?? [], // never the answer itself
        claimedBy: who && !e.doneBy ? nameOf(who) : null,
        claimedById: who && !e.doneBy ? who : null,
        claimEndsAt: who && !e.doneBy ? e.claimedAt + g.settings.claimTimeout * 1000 : 0,
        doneBy: e.doneBy ? nameOf(e.doneBy) : null,
        doneAt: e.doneBy ? e.doneAt : 0,
        lockedBy: before ? (ritual(before.id)?.name ?? before.id) : null,
        // A chained ritual whose lock has opened (shown as 🔓 until someone does it).
        unlockedBy: !before && !e.doneBy && prerequisite(g, e) ? (ritual(prerequisite(g, e)!.id)?.name ?? null) : null,
      };
    }),
    meeting: m && {
      stage: m.stage,
      endsAt: m.endsAt,
      reason: m.reason,
      callerId: m.callerId,
      newlyDead: m.newlyDead,
      voted: Object.keys(m.votes),
      readyToVote: m.readyToVote ?? [],
      lantern: m.lantern ? { names: m.lantern.picks.map(nameOf), count: m.lantern.count, at: m.lantern.at } : null,
      result: verdict
        ? {
            ...m.result!,
            wasTraitor: g.settings.revealOnEject && ejected ? ejected.role === "traitor" : null,
          }
        : null,
    },
    bloodMoon: {
      active: bm.active,
      endsAt: bm.endsAt,
      codeLength: bm.active ? (bm.code?.length ?? 0) : 0, // never the code itself
      savedAt: bm.savedAt ?? 0,
    },
    selfDeaths: g.selfDeaths ?? 0,
    meetingsFrom: g.lastMeetingAt ?? 0, // the meeting ring fills from here to meetingsReadyAt
    meetingsReadyAt: g.meetingsReadyAt ?? 0,
    hush: { active: g.phase === "playing" && hushed(g, now), endsAt: g.hush?.endsAt ?? 0 },
    readyIds: g.phase === "reveal" ? g.players.filter((p) => p.ready).map((p) => p.id) : [],
    winner: over ? g.winner : null,
    rituals: (() => {
      const { on } = playableRituals(g);
      return RITUALS.map((r) => {
        const chain = chainOf(r, on);
        const enabled = !g.disabled.includes(r.id);
        return {
          id: r.id,
          name: r.name,
          location: r.location,
          enabled,
          // Switched on, but its chain is broken (an earlier step is off or missing), so it won't be used.
          blockedBy: enabled && typeof chain === "string" ? (ritual(chain)?.name ?? `“${chain}” (missing)`) : null,
        };
      });
    })(),
  };
}

export function playerView(g: Game, p: Player, now: number) {
  const traitor = p.role === "traitor";
  return {
    ...publicView(g, now),
    me: {
      id: p.id,
      name: p.name,
      color: p.color,
      role: p.role,
      alive: p.alive,
      ejected: p.ejected,
      vote: g.meeting?.votes[p.id] ?? null,
      allies: traitor ? g.players.filter((x) => x.role === "traitor" && x.id !== p.id).map((x) => x.name) : [],
      summonReadyAt: traitor && (g.settings.bloodMoon || g.settings.hush) ? summonReadyAt(g) : 0,
      ready: !!p.ready,
      canRevive: canRevive(g, p),
      special: p.special ?? null,
      lanternUsed: !!p.lanternUsed,
      moonHalf: moonHalf(g, p),
      drawn: g.phase === "playing" ? (p.drawn ?? null) : null,
      wrongUntil: p.wrongUntil ?? 0,
      crowned: !!p.crowned,
    },
  };
}

// The half of the Blood Moon code this player's phone shows (only while they're alive).
function moonHalf(g: Game, p: Player) {
  const bm = g.bloodMoon;
  const half = bm.halves?.[p.id];
  if (g.phase !== "playing" || !bm.active || !p.alive || half === undefined || !bm.code) return null;
  const mid = Math.ceil(bm.code.length / 2);
  return { half, digits: half === 0 ? bm.code.slice(0, mid) : bm.code.slice(mid), length: bm.code.length };
}

export type PublicView = ReturnType<typeof publicView>;
export type PlayerView = ReturnType<typeof playerView>;
