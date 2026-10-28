import { Redis } from "@upstash/redis";
import { advance, newGame, type Game } from "./game";

// The whole game is one JSON document. Writes use compare-and-swap on a
// version key so simultaneous taps from many phones never clobber each other.

const STATE_KEY = "possessed:game";
const VERSION_KEY = "possessed:version";

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token, automaticDeserialization: false }) : null;

const CAS = `
local v = redis.call('GET', KEYS[2])
if (v or '0') == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2])
  redis.call('SET', KEYS[2], ARGV[3])
  return 1
end
return 0`;

// In-memory fallback for local development only (or `POSSESSED_MEMORY_STORE=1 npm start`).
const mem = globalThis as unknown as { __possessed?: string };

async function load(): Promise<Game> {
  if (!redis) {
    if (process.env.NODE_ENV === "production" && !process.env.POSSESSED_MEMORY_STORE) {
      throw new Error("Redis is not configured. Add Upstash Redis to the Vercel project.");
    }
    return mem.__possessed ? JSON.parse(mem.__possessed) : newGame();
  }
  const raw = await redis.get<string>(STATE_KEY);
  return raw ? JSON.parse(raw) : newGame();
}

async function save(prevVersion: number, g: Game): Promise<boolean> {
  g.version = prevVersion + 1;
  const json = JSON.stringify(g);
  if (!redis) {
    const cur = mem.__possessed ? (JSON.parse(mem.__possessed) as Game).version : 0;
    if (cur !== prevVersion) return false;
    mem.__possessed = json;
    return true;
  }
  const ok = await redis.eval(CAS, [STATE_KEY, VERSION_KEY], [
    String(prevVersion),
    json,
    String(g.version),
  ]);
  return Number(ok) === 1;
}

// Read the game, applying any timer transitions that are due.
export async function read(): Promise<Game> {
  const g = await load();
  const prev = g.version;
  if (advance(g, Date.now())) await save(prev, g);
  return g;
}

// Run a mutation with retries on write conflicts.
export async function mutate<T>(fn: (g: Game, now: number) => T): Promise<{ game: Game; result: T }> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const g = await load();
    const prev = g.version;
    const now = Date.now();
    advance(g, now);
    const result = fn(g, now);
    if (await save(prev, g)) return { game: g, result };
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 60));
  }
  throw new Error("The spirits are restless. Try again.");
}
