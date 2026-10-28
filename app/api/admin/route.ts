import { mutate, read } from "@/lib/store";
import { debugView, runAdmin, type AdminAction } from "@/lib/admin";
import { handle, ok } from "@/lib/api";

// Admin controls: GET /api/admin?do=… (handy from a phone's address bar) or POST the same as JSON.
// Set ADMIN_TOOLS=off in Vercel to disable them entirely.

async function run(params: Record<string, string | number | undefined>) {
  if (process.env.ADMIN_TOOLS === "off" || process.env.TEST_TOOLS === "off") {
    return Response.json({ error: "Admin controls are turned off." }, { status: 404 });
  }
  const action = { ...params, do: String(params.do ?? "state") } as AdminAction;
  if (action.do === "state") return ok(debugView(await read()));
  const { game, result } = await mutate((g, now) => runAdmin(g, action, now));
  return ok({ result, state: debugView(game) });
}

export function GET(req: Request) {
  return handle(() => run(Object.fromEntries(new URL(req.url).searchParams)));
}

export function POST(req: Request) {
  return handle(async () => run(await req.json()));
}
