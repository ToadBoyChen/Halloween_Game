import { act, GameError, playerView, type Action } from "@/lib/game";
import { mutate } from "@/lib/store";
import { handle, ok } from "@/lib/api";

export function POST(req: Request) {
  return handle(async () => {
    const { token, ...action } = await req.json();
    const { game } = await mutate((g, now) => {
      const p = g.players.find((x) => x.token === token);
      if (!p) throw new GameError("Your soul is not bound to this house.");
      act(g, p, action as Action, now);
    });
    const p = game.players.find((x) => x.token === token);
    return ok(p ? playerView(game, p, Date.now()) : { left: true });
  });
}
