import { RITUALS } from "@/config/rituals";
import { BLOOD_MOON } from "@/config/bloodmoon";
import {
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  REVEAL_SECONDS,
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
  alive: boolean;
  deathKnown: boolean; // revealed to everyone (at a séance or by ejection)
  ejected: boolean;
  tasks: { id: string; done: boolean }[];
  bellsUsed: number;
  lastKillAt: number;
};

export type Meeting = {
  stage: Stage;
  endsAt: number;
  reason: "report" | "bell" | "host";
  callerId: string | null;
  newlyDead: string[];
  votes: Record<string, string>; // voterId -> targetId | "skip"
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
  meeting: Meeting | null;
  bloodMoon: {
    active: boolean;
    endsAt: number;
    seal: number;
    used: number[];
    lastEndedAt: number;
    wrongAt: number;
  };
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
    meeting: null,
    bloodMoon: { active: false, endsAt: 0, seal: 0, used: [], lastEndedAt: 0, wrongAt: 0 },
    winner: null,
  };
}

const minPlayers = () => (process.env.NODE_ENV === "development" ? 3 : MIN_PLAYERS);

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

const enabledRituals = (g: Game) => RITUALS.filter((r) => !g.disabled.includes(r.id));
const ritual = (id: string) => RITUALS.find((r) => r.id === id);

// Hand out rituals, preferring the least-assigned ones so players spread out.
function assignTasks(g: Game) {
  const pool = enabledRituals(g);
  const per = Math.min(g.settings.tasksPerPlayer, pool.length);
  const load = new Map(pool.map((r) => [r.id, 0]));
  for (const p of shuffle(g.players)) {
    const picks = shuffle(pool)
      .sort((a, b) => load.get(a.id)! - load.get(b.id)!)
      .slice(0, per);
    picks.forEach((r) => load.set(r.id, load.get(r.id)! + 1));
    p.tasks = shuffle(picks).map((r) => ({ id: r.id, done: false }));
  }
}

// ─── Rules ───────────────────────────────────────────────────

export function progress(g: Game) {
  let done = 0;
  let total = 0;
  for (const p of g.players) {
    if (p.role !== "member") continue;
    total += p.tasks.length;
    done += p.tasks.filter((t) => t.done).length;
  }
  return { done, total };
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

function endGame(g: Game, winner: NonNullable<Game["winner"]>) {
  g.phase = "over";
  g.winner = winner;
  g.meeting = null;
  g.bloodMoon.active = false;
}

function checkAndEnd(g: Game) {
  const w = checkWin(g);
  if (w) endGame(g, w);
}

function startMeeting(g: Game, reason: Meeting["reason"], callerId: string | null, now: number) {
  const newlyDead = g.players.filter((p) => !p.alive && !p.deathKnown);
  newlyDead.forEach((p) => (p.deathKnown = true));
  if (g.bloodMoon.active) {
    g.bloodMoon.active = false;
    g.bloodMoon.lastEndedAt = now;
  }
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
    p.deathKnown = true;
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
    if (g.phase === "reveal" && now >= g.phaseEndsAt) {
      g.phase = "playing";
      g.startedAt = now;
      g.players.forEach((p) => (p.lastKillAt = now));
    } else if (g.phase === "playing" && g.bloodMoon.active && now >= g.bloodMoon.endsAt) {
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
        g.players.forEach((p) => (p.lastKillAt = now));
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
  if (g.phase !== "lobby") fail("The ritual has already begun. Wait for the next game.");
  name = name.trim().slice(0, 16);
  if (!name) fail("Your soul needs a name.");
  if (g.players.length >= MAX_PLAYERS) fail("The house is full.");
  if (g.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) fail("That name is taken.");
  if (!SOUL_COLORS.some((c) => c.id === color)) fail("Choose a soul color.");
  if (g.players.some((p) => p.color === color)) fail("That color is taken.");
  const player: Player = {
    id: crypto.randomUUID().slice(0, 8),
    token: crypto.randomUUID(),
    name,
    color,
    role: null,
    alive: true,
    deathKnown: false,
    ejected: false,
    tasks: [],
    bellsUsed: 0,
    lastKillAt: 0,
  };
  g.players.push(player);
  return player;
}

export type Action =
  | { type: "leave" }
  | { type: "task"; id: string; done: boolean }
  | { type: "claimed" }
  | { type: "kill" }
  | { type: "report" }
  | { type: "bell" }
  | { type: "vote"; target: string }
  | { type: "summon" };

export function act(g: Game, p: Player, a: Action, now: number) {
  const playing = g.phase === "playing";
  switch (a.type) {
    case "leave":
      if (g.phase !== "lobby") fail("You can't leave mid-game.");
      g.players = g.players.filter((x) => x.id !== p.id);
      return;

    case "task": {
      if (!playing) fail("Not now.");
      const t = p.tasks.find((x) => x.id === a.id) ?? fail("That ritual isn't yours.");
      t.done = a.done;
      checkAndEnd(g);
      return;
    }

    case "claimed":
      if (!playing) fail("Not now.");
      if (!p.alive) fail("You are already dead.");
      if (p.role === "traitor") fail("The Possessed cannot be claimed.");
      p.alive = false;
      checkAndEnd(g);
      return;

    case "kill":
      if (!playing || p.role !== "traitor" || !p.alive) fail("Not now.");
      if (now < p.lastKillAt + g.settings.killCooldown * 1000) fail("Your hunger is not ready.");
      p.lastKillAt = now;
      return;

    case "report":
    case "bell":
      if (!playing) fail("Not now.");
      if (!p.alive) fail("Spirits cannot speak.");
      if (g.bloodMoon.active) fail("The Blood Moon silences the bell.");
      if (a.type === "bell") {
        if (p.bellsUsed >= g.settings.bellsPerPlayer) fail("You have no bells left.");
        p.bellsUsed++;
      }
      startMeeting(g, a.type, p.id, now);
      return;

    case "vote": {
      const m = g.meeting;
      if (g.phase !== "meeting" || m?.stage !== "voting") fail("Voting is closed.");
      if (!p.alive) fail("Spirits cannot vote.");
      if (m!.votes[p.id]) fail("Your vote is already sealed.");
      if (a.target !== "skip" && !g.players.some((x) => x.id === a.target && x.alive))
        fail("They cannot be voted for.");
      m!.votes[p.id] = a.target;
      const voters = g.players.filter((x) => x.alive);
      if (voters.every((x) => m!.votes[x.id])) resolveVotes(g, now);
      return;
    }

    case "summon": {
      const bm = g.bloodMoon;
      if (!playing || p.role !== "traitor") fail("Not now.");
      if (!g.settings.bloodMoon) fail("The Blood Moon sleeps tonight.");
      if (bm.active) fail("The Blood Moon is already rising.");
      const readyAt = summonReadyAt(g);
      if (now < readyAt) fail("The moon is not ready.");
      let choices = BLOOD_MOON.seals.map((_, i) => i).filter((i) => !bm.used.includes(i));
      if (choices.length === 0) {
        bm.used = [];
        choices = BLOOD_MOON.seals.map((_, i) => i);
      }
      bm.seal = choices[Math.floor(Math.random() * choices.length)];
      bm.used.push(bm.seal);
      bm.active = true;
      bm.endsAt = now + BLOOD_MOON.duration * 1000;
      return;
    }
  }
}

export function summonReadyAt(g: Game) {
  return Math.max(
    g.startedAt + BLOOD_MOON.graceStart * 1000,
    g.bloodMoon.lastEndedAt ? g.bloodMoon.lastEndedAt + BLOOD_MOON.cooldown * 1000 : 0,
  );
}

const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

// Entered at the hub. Returns true if the Blood Moon was stopped.
export function altar(g: Game, code: string, now: number) {
  if (g.phase !== "playing" || !g.bloodMoon.active) fail("The altar is silent.");
  const [a, b] = BLOOD_MOON.seals[g.bloodMoon.seal].cards.map((c) => normalize(c.card));
  const input = normalize(code);
  if (input === a + b || input === b + a) {
    g.bloodMoon.active = false;
    g.bloodMoon.lastEndedAt = now;
    return true;
  }
  g.bloodMoon.wrongAt = now;
  return false;
}

// ─── Host actions ────────────────────────────────────────────

export type HostAction =
  | { type: "start" }
  | { type: "settings"; settings: Partial<Settings> }
  | { type: "toggleRitual"; id: string }
  | { type: "kick"; id: string }
  | { type: "meeting" }
  | { type: "skip" }
  | { type: "cancelMoon" }
  | { type: "lobby" }
  | { type: "reset" };

export function host(g: Game, a: HostAction, now: number) {
  switch (a.type) {
    case "start": {
      if (g.phase !== "lobby") fail("A game is already running.");
      if (g.players.length < minPlayers()) fail(`At least ${minPlayers()} souls are needed.`);
      if (enabledRituals(g).length === 0) fail("Enable at least one ritual.");
      const k = traitorCount(g);
      const traitors = new Set(shuffle(g.players).slice(0, k).map((p) => p.id));
      for (const p of g.players) {
        p.role = traitors.has(p.id) ? "traitor" : "member";
        p.alive = true;
        p.deathKnown = false;
        p.ejected = false;
        p.bellsUsed = 0;
        p.lastKillAt = 0;
      }
      assignTasks(g);
      g.phase = "reveal";
      g.phaseEndsAt = now + REVEAL_SECONDS * 1000;
      g.round++;
      g.meeting = null;
      g.winner = null;
      g.bloodMoon = { active: false, endsAt: 0, seal: 0, used: [], lastEndedAt: 0, wrongAt: 0 };
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
      if (g.phase === "playing" || g.phase === "meeting") checkAndEnd(g);
      return;

    case "meeting":
      if (g.phase !== "playing") fail("Not now.");
      startMeeting(g, "host", null, now);
      return;

    case "skip":
      if (g.phase === "reveal") g.phaseEndsAt = now;
      else if (g.meeting) g.meeting.endsAt = now;
      advance(g, now);
      return;

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
      g.players.forEach((p) => {
        p.role = null;
        p.alive = true;
        p.tasks = [];
      });
      return;

    case "reset":
      Object.assign(g, newGame(), { version: g.version });
      return;
  }
}

// ─── Views (what each screen is allowed to see) ──────────────

export function publicView(g: Game, now: number) {
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
    players: g.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      alive: over ? p.alive : !(p.deathKnown && !p.alive),
      ejected: p.ejected,
      role: over ? p.role : null,
    })),
    progress: g.phase === "lobby" ? { done: 0, total: 0 } : progress(g),
    meeting: m && {
      stage: m.stage,
      endsAt: m.endsAt,
      reason: m.reason,
      callerId: m.callerId,
      newlyDead: m.newlyDead,
      voted: Object.keys(m.votes),
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
      locations: bm.active ? BLOOD_MOON.seals[bm.seal].cards.map((c) => c.location) : [],
      wrongAt: bm.wrongAt,
    },
    winner: over ? g.winner : null,
    rituals: RITUALS.map((r) => ({
      id: r.id,
      name: r.name,
      location: r.location,
      enabled: !g.disabled.includes(r.id),
    })),
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
      bellsLeft: g.settings.bellsPerPlayer - p.bellsUsed,
      vote: g.meeting?.votes[p.id] ?? null,
      tasks: p.tasks.map((t) => {
        const r = ritual(t.id);
        return {
          id: t.id,
          done: t.done,
          name: r?.name ?? t.id,
          location: r?.location ?? "",
          instructions: r?.instructions ?? "",
        };
      }),
      allies: traitor ? g.players.filter((x) => x.role === "traitor" && x.id !== p.id).map((x) => x.name) : [],
      killReadyAt: traitor ? p.lastKillAt + g.settings.killCooldown * 1000 : 0,
      summonReadyAt: traitor && g.settings.bloodMoon ? summonReadyAt(g) : 0,
    },
  };
}

export type PublicView = ReturnType<typeof publicView>;
export type PlayerView = ReturnType<typeof playerView>;
