"use client";

import { useEffect, useState } from "react";
import { post, useMounted } from "@/lib/client";
import { Atmos } from "@/components/shared";
import type { Ritual } from "@/config/rituals";
import type { BLOOD_MOON } from "@/config/bloodmoon";

type Setup = { rituals: Ritual[]; bloodMoon: typeof BLOOD_MOON };

// A checklist for walking the house before the party (rituals and Blood Moon cards).
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
                    </p>
                  ))}
                </div>
              ))}
            </section>
            <section className="panel" style={{ padding: 16, display: "grid", gap: 12 }}>
              <h2 className="creep blood" style={{ fontSize: "1.6rem" }}>Blood Moon cards</h2>
              <p style={{ color: "var(--dim)", fontSize: ".9rem" }}>Place each card at its location. Edit in <code>config/bloodmoon.ts</code>.</p>
              {data.bloodMoon.seals.map((seal, i) => (
                <div key={i} style={{ display: "grid", gap: 4 }}>
                  <strong>Seal {i + 1}</strong>
                  {seal.cards.map((c) => (
                    <p key={c.location} style={{ marginLeft: 12 }}>
                      <span style={{ color: "var(--candle)", fontWeight: 700, fontSize: "1.2rem" }}>{c.card}</span> at {c.location}
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
