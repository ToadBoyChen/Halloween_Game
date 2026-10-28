"use client";

import { useState } from "react";
import { post, useMounted } from "@/lib/client";
import { Atmos } from "@/components/shared";
import type { Ritual } from "@/config/rituals";
import type { BLOOD_MOON } from "@/config/bloodmoon";

type Setup = { rituals: Ritual[]; bloodMoon: typeof BLOOD_MOON };

// A checklist for walking the house before the party. PIN-protected because it shows the card codes.
export default function SetupPage() {
  const mounted = useMounted();
  const [pin, setPin] = useState("");
  const [data, setData] = useState<Setup | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!mounted) return <Atmos />;

  const load = async () => {
    try {
      setError(null);
      setData(await post<Setup>("/api/host", { pin, type: "setup" }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const byLocation = new Map<string, Ritual[]>();
  for (const r of data?.rituals ?? []) byLocation.set(r.location, [...(byLocation.get(r.location) ?? []), r]);

  return (
    <>
      <Atmos />
      <main className="screen phone" style={{ display: "grid", gap: 18, alignContent: "start" }}>
        <h1 className="creep blood" style={{ fontSize: "2.6rem" }}>House Setup</h1>
        {!data ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
            style={{ display: "grid", gap: 10 }}
          >
            <input className="input" type="password" inputMode="numeric" placeholder="Host PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
            <button className="btn primary">Open</button>
            {error && <p className="blood">{error}</p>}
          </form>
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
