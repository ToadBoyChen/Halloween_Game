import Link from "next/link";
import { Atmos } from "@/components/shared";

export default function Home() {
  return (
    <>
      <Atmos />
      <main
        className="screen phone"
        style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 20, textAlign: "center" }}
      >
        <h1 className="creep blood flicker" style={{ fontSize: "3.6rem", lineHeight: 1 }}>POSSESSED</h1>
        <p style={{ fontStyle: "italic", color: "var(--dim)" }}>One among you is no longer… themselves.</p>
        <Link href="/play" className="btn primary" style={{ width: "100%", fontSize: "1.3rem" }}>
          Join the game
        </Link>
        <Link href="/hub" className="btn ghost" style={{ width: "100%" }}>
          Open the hub (TV)
        </Link>
      </main>
    </>
  );
}
