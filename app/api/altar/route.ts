import { altar, publicView } from "@/lib/game";
import { mutate } from "@/lib/store";
import { handle, ok } from "@/lib/api";

// The Blood Moon code is typed into the hub.
export function POST(req: Request) {
  return handle(async () => {
    const { code } = await req.json();
    const { game, result } = await mutate((g, now) => altar(g, String(code ?? ""), now));
    return ok({ correct: result, state: publicView(game, Date.now()) });
  });
}
