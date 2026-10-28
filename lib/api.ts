import { unstable_rethrow } from "next/navigation";
import { GameError } from "./game";

export function ok(data: unknown) {
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}

export function handle(fn: () => Promise<Response>) {
  return fn().catch((err: unknown) => {
    unstable_rethrow(err);
    if (err instanceof GameError) return Response.json({ error: err.message }, { status: 400 });
    console.error(err);
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return Response.json({ error: message }, { status: 500 });
  });
}
