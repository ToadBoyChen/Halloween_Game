import { join, playerView } from "@/lib/game";
import { mutate } from "@/lib/store";
import { handle, ok } from "@/lib/api";

export function POST(req: Request) {
  return handle(async () => {
    const { name, color } = await req.json();
    const { game, result: p } = await mutate((g) => join(g, String(name ?? ""), String(color ?? "")));
    return ok({ token: p.token, state: playerView(game, p, Date.now()) });
  });
}
