import { BLOOD_MOON } from "@/config/bloodmoon";
import { SOUL_COLORS } from "@/config/game";
import { act, host, join, GameError, progress, summonReadyAt, type Game, type Player, type Role } from "./game";

// Admin controls: run the game (start, skip timers, Blood Moon) and test it alone
// with bot players. Used by the /admin page. Set ADMIN_TOOLS=off to disable.

export type AdminAction = {
  do: string;
  n?: number; // how many bots
  name?: string; // which player (defaults to the only human)
  role?: string; // "traitor" | "member"
  target?: string; // vote target: a name, "skip", or "random"
  pct?: number; // percent of bot tasks to complete
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
}

// Let the Possessed kill and summon right now.
function skipCooldowns(g: Game, now: number) {
  g.startedAt = Math.min(g.startedAt, now - g.settings.bloodMoonGrace * 1000 - 1);
  g.bloodMoon.lastEndedAt = 0;
  g.players.forEach((p) => (p.lastKillAt = now - g.settings.killCooldown * 1000 - 1));
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
      host(g, { type: "settings", settings: { discussion: 15, voting: 15, killCooldown: 10 } }, now);
      return { ok: true, note: "Discussion 15s, voting 15s, kill cooldown 10s." };

    case "start": {
      host(g, { type: "start" }, now);
      if (a.role === "traitor" || a.role === "member") forceRole(g, findPlayer(g, a.name), a.role);
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
      return { ok: true, note: "Kill cooldowns and the Blood Moon wait are cleared." };

    case "moon":
      host(g, { type: "summonMoon" }, now);
      return { ok: true, code: currentCode(g) };

    case "bottasks": {
      const pct = Math.max(0, Math.min(Number(a.pct ?? 100), 100)) / 100;
      for (const b of g.players.filter((p) => p.bot)) {
        const todo = b.tasks.filter((t) => !t.done);
        const count = Math.ceil(b.tasks.length * pct) - (b.tasks.length - todo.length);
        for (const t of todo.slice(0, Math.max(0, count))) {
          if (g.phase !== "playing") break;
          act(g, b, { type: "task", id: t.id, done: true }, now);
        }
      }
      return { progress: progress(g) };
    }

    case "botkill": {
      const victim = a.name ? findPlayer(g, a.name) : pick(livingBots(g, "member"));
      if (!victim) fail("No living Mortal bots to kill.");
      act(g, victim!, { type: "claimed" }, now);
      return { killed: victim!.name };
    }

    case "botreport":
    case "botbell": {
      const bot = pick(livingBots(g)) ?? fail("No living bots.");
      act(g, bot, { type: a.do === "botreport" ? "report" : "bell" }, now);
      return { by: bot.name };
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

    // A living bot finds and picks both Blood Moon cards.
    case "botseal": {
      if (!g.bloodMoon.active) fail("There is no Blood Moon right now.");
      const bot = pick(livingBots(g)) ?? fail("No living bots.");
      BLOOD_MOON.seals[g.bloodMoon.seal].cards.forEach((c, slot) => {
        if (!g.bloodMoon.sealed[slot]) act(g, bot, { type: "seal", slot, card: c.card }, now);
      });
      return { savedBy: bot.name };
    }

    // Everyone still looking at their role becomes ready.
    case "ready":
      if (g.phase !== "reveal") fail("Not in the role reveal.");
      g.players.filter((p) => !p.ready).forEach((p) => act(g, p, { type: "ready" }, now));
      return { ok: true };

    default:
      return fail(`Unknown admin action "${a.do}".`);
  }
}

function currentCode(g: Game) {
  if (!g.bloodMoon.active) return null;
  const seal = BLOOD_MOON.seals[g.bloodMoon.seal];
  return { code: seal.cards.map((c) => c.card).join(""), cards: seal.cards };
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
    votes: m ? Object.keys(m.votes).length : 0,
    bloodMoon: {
      active: bm.active,
      endsIn: bm.active ? Math.max(0, Math.round((bm.endsAt - now) / 1000)) : 0,
      readyIn: g.phase === "playing" ? Math.max(0, Math.round((summonReadyAt(g) - now) / 1000)) : 0,
      cards: bm.active ? BLOOD_MOON.seals[bm.seal].cards : [],
      sealedBy: bm.active ? (bm.sealed ?? []).map(nameOf) : [],
    },
    players: g.players.map((p) => ({
      name: p.name,
      bot: !!p.bot,
      role: p.role,
      alive: p.alive,
      tasks: `${p.tasks.filter((t) => t.done).length}/${p.tasks.length}`,
    })),
  };
}
