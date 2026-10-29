import { RITUALS } from "@/config/rituals";
import { SOUL_COLORS } from "@/config/game";
import { act, checkAndEnd, host, hushed, join, traitorCount, GameError, progress, summonReadyAt, type Game, type Player, type Role } from "./game";

// Admin controls: run the game (start, skip timers, Blood Moon) and test it alone
// with bot players. Used by the /admin page. Set ADMIN_TOOLS=off to disable.

export type AdminAction = {
  do: string;
  n?: number; // how many bots
  name?: string; // which player (defaults to the only human)
  role?: string; // "traitor" | "member" | "lantern" (a Mortal who is the Lantern Bearer)
  names?: string; // comma-separated player names (who the Lantern lights on)
  target?: string; // vote target: a name, "skip", or "random"
  pct?: number; // percent of the remaining ritual pool for bots to finish
};

const BOT_NAMES = ["Casper", "Boo", "Ghoulia", "Mort", "Wisp", "Banshee", "Crypt", "Lurch", "Spook", "Raven", "Igor"];

const fail = (msg: string): never => {
  throw new GameError(msg);
};

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function findPlayer(g: Game, name?: string): Player {
  if (name) {
    const n = name.toLowerCase().replace("🤖 ", "");
    return g.players.find((p) => p.name.toLowerCase().replace("🤖 ", "") === n) ?? fail(`No player named "${name}".`);
  }
  const humans = g.players.filter((p) => !p.bot);
  if (humans.length === 1) return humans[0];
  return fail(humans.length ? "More than one human player: pass name=…" : "No human player has joined yet.");
}

const livingBots = (g: Game, role?: Role) => g.players.filter((p) => p.bot && p.alive && (!role || p.role === role));

// Make a player's role what we want by swapping with someone (preferably a bot) who has it.
function forceRole(g: Game, p: Player, role: Role) {
  if (p.role === role) return;
  const swap = g.players.find((q) => q.bot && q.role === role) ?? g.players.find((q) => q.role === role);
  if (!swap) fail(`No one has the ${role} role to swap with.`);
  swap!.role = p.role;
  p.role = role;
  // The Lantern Bearer must stay a Mortal.
  const bearer = g.players.find((q) => q.special === "lantern");
  if (bearer && bearer.role === "traitor") {
    bearer.special = null;
    const mortal = g.players.find((q) => q.role === "member");
    if (mortal) mortal.special = "lantern";
  }
}

// Let meetings be called and the Blood Moon or the Hush be used right now.
function skipCooldowns(g: Game, now: number) {
  g.startedAt = Math.min(g.startedAt, now - g.settings.bloodMoonGrace * 1000 - 1);
  g.bloodMoon.lastEndedAt = 0;
  if (!hushed(g, now)) g.hush = { endsAt: 0 };
  g.meetingsReadyAt = 0;
}

export function runAdmin(g: Game, a: AdminAction, now: number): unknown {
  switch (a.do) {
    case "bots": {
      const n = Math.max(1, Math.min(Number(a.n ?? 5), 11));
      const added: string[] = [];
      for (let i = 0; i < n; i++) {
        const color = SOUL_COLORS.find((c) => !g.players.some((p) => p.color === c.id));
        const name = BOT_NAMES.map((b) => `🤖 ${b}`).find((b) => !g.players.some((p) => p.name === b));
        if (!color || !name) break;
        const bot = join(g, name, color.id);
        bot.bot = true;
        added.push(name);
      }
      return { added };
    }

    case "clearbots":
      g.players = g.players.filter((p) => !p.bot);
      return { ok: true };

    case "fast":
      host(g, { type: "settings", settings: { discussion: 15, voting: 15, meetingCooldown: 30 } }, now);
      return { ok: true, note: "Discussion 15s, voting 15s, meeting cooldown 30s." };

    case "start": {
      host(g, { type: "start" }, now);
      if (a.role === "traitor" || a.role === "member") forceRole(g, findPlayer(g, a.name), a.role);
      if (a.role === "lantern") {
        // Works with any number of players, so the Lantern can be tested alone with bots.
        const p = findPlayer(g, a.name);
        forceRole(g, p, "member");
        g.players.forEach((q) => (q.special = null));
        p.special = "lantern";
      }
      return { ok: true };
    }

    case "role": {
      if (a.role !== "traitor" && a.role !== "member") fail("role must be traitor or member.");
      forceRole(g, findPlayer(g, a.name), a.role as Role);
      return { ok: true };
    }

    case "skip":
    case "lobby":
    case "reset":
    case "meeting":
    case "cancelMoon":
      host(g, { type: a.do }, now);
      return { ok: true };

    case "cooldowns":
      skipCooldowns(g, now);
      return { ok: true, note: "The meeting cooldown and the Blood Moon wait are cleared." };

    case "moon":
      host(g, { type: "summonMoon" }, now);
      return { ok: true, code: currentCode(g) };

    case "hush":
      if (g.phase !== "playing") fail("Not now.");
      g.hush = { endsAt: now + g.settings.hushDuration * 1000 };
      return { ok: true };

    case "unhush":
      g.hush = { endsAt: now };
      return { ok: true };

    // Bots claim and finish rituals from the pool (in order, so chains unlock as they go).
    case "bottasks": {
      const pct = Math.max(0, Math.min(Number(a.pct ?? 100), 100)) / 100;
      const bots = g.players.filter((p) => p.bot && p.alive);
      if (!bots.length) fail("No living bots.");
      let count = Math.ceil(g.pool.filter((e) => !e.doneBy).length * pct);
      for (let i = 0; count > 0 && g.phase === "playing"; i++) {
        const e = g.pool.find((x) => !x.doneBy && !x.claimedBy && !g.pool.some((y) => y.id === ritualNeeds(x.id) && !y.doneBy));
        if (!e) break;
        const b = bots[i % bots.length];
        b.drawn = e.id; // skip the random draw so chains unlock in order
        act(g, b, { type: "claim", id: e.id }, now);
        act(g, b, { type: "done", id: e.id, answer: RITUALS.find((r) => r.id === e.id)?.answer }, now);
        count--;
      }
      return { progress: progress(g) };
    }

    // Host fixes: kill anyone (their body counts as found) or bring anyone back.
    case "kill": {
      const p = findPlayer(g, a.name);
      if (g.phase !== "playing" && g.phase !== "meeting") fail("Not now.");
      if (!p.alive) fail(`${p.name} is already dead.`);
      p.alive = false;
      p.diedAt = now;
      p.foundBy = null;
      if (g.meeting) delete g.meeting.votes[p.id];
      checkAndEnd(g);
      return { killed: p.name };
    }

    case "revive": {
      const p = findPlayer(g, a.name);
      if (g.phase !== "playing" && g.phase !== "meeting") fail("Not now.");
      if (p.alive) fail(`${p.name} is already alive.`);
      p.alive = true;
      p.ejected = false;
      p.foundBy = null;
      if (g.meeting) g.meeting.newlyDead = g.meeting.newlyDead.filter((id) => id !== p.id);
      return { revived: p.name };
    }

    // A living bot finds the body (without calling a meeting).
    case "botkill": {
      const victim = a.name ? findPlayer(g, a.name) : pick(livingBots(g, "member"));
      if (!victim) fail("No living Mortal bots to kill.");
      const finder = pick(g.players.filter((p) => p.bot && p.alive && p.id !== victim!.id)) ?? fail("No living bot to find the body.");
      act(g, finder, { type: "report", id: victim!.id, meeting: false }, now);
      return { killed: victim!.name, foundBy: finder.name };
    }

    // A living bot finds a living Mortal bot's body and calls a meeting.
    case "botreport": {
      const victim = pick(livingBots(g, "member")) ?? fail("No living Mortal bots.");
      const finder = pick(g.players.filter((p) => p.bot && p.alive && p.id !== victim.id)) ?? fail("No living bot to find the body.");
      act(g, finder, { type: "report", id: victim.id, meeting: true }, now);
      return { killed: victim.name, by: finder.name };
    }

    case "botvote": {
      if (g.phase !== "meeting" || g.meeting?.stage !== "voting") fail("Not in the voting stage. Use do=skip to get there.");
      const voters = livingBots(g).filter((b) => !g.meeting!.votes[b.id]);
      for (const b of voters) {
        let target = "skip";
        if (a.target === "random") target = pick(g.players.filter((p) => p.alive && p.id !== b.id)).id;
        else if (a.target && a.target !== "skip") target = findPlayer(g, a.target).id;
        if (g.phase !== "meeting" || g.meeting?.stage !== "voting") break;
        act(g, b, { type: "vote", target }, now);
      }
      return { voted: voters.length };
    }

    case "code":
      return { code: currentCode(g) };

    // The Lantern Bearer lights the lantern: on the players named (names=Ann,Ben,Sam), or on
    // three at random if none are given. Testing the TV reveal.
    case "lantern": {
      const bearer = g.players.find((p) => p.special === "lantern") ?? fail("No Lantern Bearer this game (needs 5+ players).");
      const named = (a.names ?? "").split(",").map((n) => n.trim()).filter(Boolean);
      let targets: string[];
      if (named.length) {
        const chosen = named.map((n) => findPlayer(g, n));
        if (chosen.some((p) => p.id === bearer.id)) fail("The Lantern Bearer can't light the lantern on themselves.");
        targets = chosen.map((p) => p.id);
      } else {
        const others = g.players.filter((p) => p.alive && p.id !== bearer.id);
        if (others.length < 3) fail("There aren't three other living players to light it on.");
        targets = [...others].sort(() => Math.random() - 0.5).slice(0, 3).map((p) => p.id);
      }
      act(g, bearer, { type: "lantern", targets }, now);
      return { by: bearer.name, count: g.meeting?.lantern?.count };
    }

    // Someone types the right Blood Moon code on the TV.
    case "botseal":
      host(g, { type: "moonCode", code: g.bloodMoon.code }, now);
      return { ok: true };

    // Everyone still looking at their role becomes ready.
    case "ready":
      if (g.phase !== "reveal") fail("Not in the role reveal.");
      g.players.filter((p) => !p.ready).forEach((p) => act(g, p, { type: "ready" }, now));
      return { ok: true };

    default:
      return fail(`Unknown admin action "${a.do}".`);
  }
}

const ritualNeeds = (id: string) => RITUALS.find((r) => r.id === id)?.requires;

function currentCode(g: Game) {
  return g.bloodMoon.active ? g.bloodMoon.code : null;
}

// Everything, including roles, for the admin page. Tokens are left out.
export function debugView(g: Game) {
  const m = g.meeting;
  const bm = g.bloodMoon;
  const now = Date.now();
  const nameOf = (id: string | null) => (id ? (g.players.find((p) => p.id === id)?.name ?? "Someone") : null);
  return {
    phase: g.phase,
    stage: m?.stage ?? null,
    endsIn: m ? Math.max(0, Math.round((m.endsAt - now) / 1000)) : 0,
    winner: g.winner,
    progress: progress(g),
    settings: g.settings,
    ready: g.players.filter((p) => p.ready).length,
    traitorCount: g.players.length ? traitorCount(g) : 0,
    votes: m ? Object.keys(m.votes).length : 0,
    readyToVote: m?.readyToVote?.length ?? 0,
    living: g.players.filter((p) => p.alive).length,
    meetingsIn: g.phase === "playing" ? Math.max(0, Math.round(((g.meetingsReadyAt ?? 0) - now) / 1000)) : 0,
    hushIn: g.phase === "playing" && hushed(g, now) ? Math.round((g.hush!.endsAt - now) / 1000) : 0,
    bloodMoon: {
      active: bm.active,
      endsIn: bm.active ? Math.max(0, Math.round((bm.endsAt - now) / 1000)) : 0,
      readyIn: g.phase === "playing" ? Math.max(0, Math.round((summonReadyAt(g) - now) / 1000)) : 0,
      code: bm.active ? bm.code : null,
    },
    players: g.players.map((p, i) => {
      const claim = g.pool.find((e) => e.claimedBy === p.id && !e.doneBy && now - e.claimedAt < g.settings.claimTimeout * 1000);
      return {
        num: p.num ?? i + 1,
        name: p.name,
        color: p.color,
        bot: !!p.bot,
        crowned: !!p.crowned,
        role: p.role,
        special: p.special ?? null,
        alive: p.alive,
        ejected: p.ejected,
        foundBy: p.foundBy ? nameOf(p.foundBy) : null,
        meetingsLeft: Math.max(0, g.settings.meetingsPerPlayer - (p.meetingsCalled ?? 0)),
        rituals: g.pool.filter((e) => e.doneBy === p.id).length,
        doing: claim ? (RITUALS.find((r) => r.id === claim.id)?.name ?? claim.id) : null,
      };
    }),
  };
}
