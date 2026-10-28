import { mutate, read } from "@/lib/store";
import { debugView, runTest, type TestAction } from "@/lib/testing";
import { handle, hostPin, ok } from "@/lib/api";

// Test tools: GET /api/test?pin=…&do=… (handy from a phone's address bar) or POST the same as JSON.
// Set TEST_TOOLS=off in Vercel to disable them entirely.

async function run(params: Record<string, string | number | undefined>) {
  if (process.env.TEST_TOOLS === "off") return Response.json({ error: "Test tools are off." }, { status: 404 });
  if (params.pin !== hostPin()) return Response.json({ error: "Wrong PIN." }, { status: 403 });
  const action = { ...params, do: String(params.do ?? "state") } as TestAction;
  if (action.do === "state") return ok(debugView(await read()));
  const { game, result } = await mutate((g, now) => runTest(g, action, now));
  return ok({ result, state: debugView(game) });
}

export function GET(req: Request) {
  return handle(() => run(Object.fromEntries(new URL(req.url).searchParams)));
}

export function POST(req: Request) {
  return handle(async () => run(await req.json()));
}
