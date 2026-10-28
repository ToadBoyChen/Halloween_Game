import { spiritView } from "@/lib/game";
import { read } from "@/lib/store";
import { handle, ok } from "@/lib/api";

// Polled by the Spirit Board page (/spirits) on the house desktop.
export function GET(req: Request) {
  return handle(async () => {
    void req.url; // read per request, never prerendered
    return ok(spiritView(await read()));
  });
}
