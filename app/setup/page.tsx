"use client";

import { useEffect, useState } from "react";
import { post, useMounted } from "@/lib/client";
import { Atmos } from "@/components/shared";
import type { Ritual } from "@/config/rituals";

type Setup = { rituals: Ritual[] };

// A checklist for walking the house before the party (rituals). The Blood Moon needs no setup.
export default function SetupPage() {
  const mounted = useMounted();
  const [data, setData] = useState<Setup | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    post<Setup>("/api/host", { type: "setup" })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);
  if (!mounted) return <Atmos />;

  const byLocation = new Map<string, Ritual[]>();
  for (const r of data?.rituals ?? []) byLocation.set(r.location, [...(byLocation.get(r.location) ?? []), r]);

  return (
    <>
      <Atmos />
      <main className="screen phone" style={{ display: "grid", gap: 18, alignContent: "start" }}>
        <h1 className="creep blood" style={{ fontSize: "2.6rem" }}>House Setup</h1>
        {!data ? (
          <p style={{ color: "var(--dim)" }}>{error ?? "Loading…"}</p>
        ) : (
          <>
            <section className="panel" style={{ padding: 16, display: "grid", gap: 12 }}>
              <h2 className="creep" style={{ fontSize: "1.6rem", color: "var(--candle)" }}>Rituals by location</h2>
              <p style={{ color: "var(--dim)", fontSize: ".9rem" }}>Toggled-off rituals in the hub still show here (greyed if disabled in config).</p>
              {[...byLocation].map(([loc, rs]) => (
                <div key={loc}>
                  <strong>{loc}</strong>
                  {rs.map((r) => (
                    <p key={r.id} style={{ color: "var(--dim)", opacity: r.enabled === false ? 0.4 : 1, marginLeft: 12 }}>
                      {r.name} — {r.instructions}
                      {r.requires && ` (after ${data.rituals.find((x) => x.id === r.requires)?.name ?? r.requires})`}
                    </p>
                  ))}
                </div>
              ))}
            </section>
          </>
        )}
      </main>
    </>
  );
}
