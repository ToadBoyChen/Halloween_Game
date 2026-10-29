import { RITUALS } from "@/config/rituals";
import { host, publicView, type HostAction } from "@/lib/game";
import { mutate } from "@/lib/store";
import { handle, ok } from "@/lib/api";

export function POST(req: Request) {
  return handle(async () => {
    const action = await req.json();
    if (action.type === "check") return ok({ ok: true });
    if (action.type === "setup") return ok({ rituals: RITUALS });
    const { game } = await mutate((g, now) => host(g, action as HostAction, now));
    return ok(publicView(game, Date.now()));
  });
}
