import { playerView, publicView } from "@/lib/game";
import { read } from "@/lib/store";
import { handle, ok } from "@/lib/api";

// Polled about once a second by every phone and the hub.
export function GET(req: Request) {
  return handle(async () => {
    const token = new URL(req.url).searchParams.get("token");
    const g = await read();
    const now = Date.now();
    const p = token ? g.players.find((x) => x.token === token) : undefined;
    if (token && !p) return ok({ ...publicView(g, now), me: null, unknown: true });
    return ok(p ? playerView(g, p, now) : { ...publicView(g, now), me: null });
  });
}
