import { RITUALS } from "@/config/rituals";
import { BLOOD_MOON } from "@/config/bloodmoon";
import { GameError, host, publicView, type HostAction } from "@/lib/game";
import { mutate } from "@/lib/store";
import { handle, hostPin, ok } from "@/lib/api";

export function POST(req: Request) {
  return handle(async () => {
    const { pin, ...action } = await req.json();
    if (pin !== hostPin()) throw new GameError("Wrong PIN.");
    if (action.type === "check") return ok({ ok: true });
    if (action.type === "setup") return ok({ rituals: RITUALS, bloodMoon: BLOOD_MOON });
    const { game } = await mutate((g, now) => host(g, action as HostAction, now));
    return ok(publicView(game, Date.now()));
  });
}
