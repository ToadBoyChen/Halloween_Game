"use client";

import { useState } from "react";
import { useMounted } from "@/lib/client";

// Decorative background layers: rolling fog, embers, eyes in the dark, bats,
// lightning, cobwebs and a dangling spider. `rich` is the full TV version;
// phones get a lighter one so they stay fast and readable.

export function Creepy({ rich }: { rich: boolean }) {
  const mounted = useMounted();
  return (
    <>
      <div className="fogbank low" />
      <div className="fogbank mid" />
      {rich && <div className="fogbank high" />}
      <Cobweb corner="left" size={rich ? 220 : 110} />
      {rich && <Cobweb corner="right" size={180} />}
      {mounted && <Embers count={rich ? 26 : 10} />}
      {mounted && <Eyes count={rich ? 4 : 1} />}
      {rich && mounted && <Bats />}
      {rich && <Spider />}
      {rich && <div className="lightning" />}
    </>
  );
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function Embers({ count }: { count: number }) {
  const [embers] = useState(() =>
    Array.from({ length: count }, () => ({
      x: rand(0, 100),
      drift: rand(-12, 12),
      dur: rand(9, 20),
      delay: rand(-20, 0),
      size: rand(2, 4.5),
    })),
  );
  return (
    <>
      {embers.map((e, i) => (
        <span
          key={i}
          className="ember"
          style={
            {
              left: `${e.x}%`,
              width: e.size,
              height: e.size,
              animationDuration: `${e.dur}s`,
              animationDelay: `${e.delay}s`,
              "--drift": `${e.drift}vw`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

// Glowing eyes that fade in at the edges, blink, and vanish.
function Eyes({ count }: { count: number }) {
  const [eyes] = useState(() =>
    Array.from({ length: count }, (_, i) => {
      const side = i % 2 === 0;
      return {
        x: side ? rand(3, 18) : rand(82, 95),
        y: rand(15, 80),
        dur: rand(16, 30),
        delay: rand(0, 20),
        scale: rand(0.7, 1.4),
      };
    }),
  );
  return (
    <>
      {eyes.map((e, i) => (
        <div
          key={i}
          className="eyes"
          style={{
            left: `${e.x}%`,
            top: `${e.y}%`,
            animationDuration: `${e.dur}s`,
            animationDelay: `${e.delay}s`,
            transform: `scale(${e.scale})`,
          }}
        >
          <span />
          <span />
        </div>
      ))}
    </>
  );
}

function Bats() {
  const [bats] = useState(() =>
    Array.from({ length: 3 }, (_, i) => ({ y: rand(8, 40), delay: i * 4 + rand(0, 25), size: rand(26, 48) })),
  );
  return (
    <>
      {bats.map((b, i) => (
        <div key={i} className="bat" style={{ top: `${b.y}%`, animationDelay: `${b.delay}s`, width: b.size }}>
          <svg viewBox="0 0 64 32" className="bat-wings">
            <path
              d="M32 12c-2-4-4-6-4-6s1 4 0 6c-4-6-14-9-24-6 5 2 7 6 7 10 4-3 9-2 11 2 2-3 5-3 7-1 2-2 5-2 7 1 2-4 7-5 11-2 0-4 2-8 7-10-10-3-20 0-24 6-1-2 0-6 0-6s-2 2-4 6z"
              fill="#050203"
            />
          </svg>
        </div>
      ))}
    </>
  );
}

function Spider() {
  return (
    <div className="spider">
      <div className="thread" />
      <svg viewBox="0 0 40 40" width="34" height="34">
        <g stroke="#111" strokeWidth="1.8" fill="none" strokeLinecap="round">
          <path d="M14 18 L4 10 M14 21 L2 20 M14 24 L4 32 M15 26 L8 38" />
          <path d="M26 18 L36 10 M26 21 L38 20 M26 24 L36 32 M25 26 L32 38" />
        </g>
        <ellipse cx="20" cy="22" rx="7" ry="9" fill="#111" />
        <circle cx="20" cy="12" r="4.5" fill="#111" />
        <circle cx="18.3" cy="11.5" r="1" fill="#ff1f3d" />
        <circle cx="21.7" cy="11.5" r="1" fill="#ff1f3d" />
      </svg>
    </div>
  );
}

function Cobweb({ corner, size }: { corner: "left" | "right"; size: number }) {
  const rings = [0.25, 0.45, 0.65, 0.85];
  const spokes = [0, 15, 30, 45, 60, 75, 90];
  const pt = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [Math.cos(a) * r * 100, Math.sin(a) * r * 100];
  };
  return (
    <svg
      className="cobweb"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ [corner]: 0, transform: corner === "right" ? "scaleX(-1)" : undefined }}
    >
      <g stroke="rgba(220,215,205,0.22)" strokeWidth="0.5" fill="none">
        {spokes.map((d) => {
          const [x, y] = pt(1.05, d);
          return <line key={d} x1="0" y1="0" x2={x} y2={y} />;
        })}
        {rings.map((r) => (
          <path
            key={r}
            d={spokes
              .map((d, i) => {
                const [x, y] = pt(r, d);
                if (i === 0) return `M${x},${y}`;
                const [px, py] = pt(r * 0.86, d - 7.5);
                return `Q${px},${py} ${x},${y}`;
              })
              .join(" ")}
          />
        ))}
      </g>
    </svg>
  );
}
