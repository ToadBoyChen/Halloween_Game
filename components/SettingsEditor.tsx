"use client";

import { SETTING_GROUPS, secondsLabel, type NumberField } from "@/lib/settings";
import type { Settings } from "@/lib/game";

// The lobby settings, used by the TV's host panel and by /admin.
export function SettingsEditor({
  settings,
  autoTraitors,
  onChange,
}: {
  settings: Settings;
  autoTraitors: number; // what "Auto" works out to right now
  onChange: (patch: Partial<Settings>) => void;
}) {
  return (
    <div className="settings">
      {SETTING_GROUPS.map((g) => (
        <section key={g.title} className="settings-group">
          <h3>{g.title}</h3>
          {g.fields
            .filter((f) => !f.when || settings[f.when])
            .map((f) =>
              f.kind === "toggle" ? (
                <label key={f.key} className="setting-toggle">
                  <input type="checkbox" checked={!!settings[f.key]} onChange={(e) => onChange({ [f.key]: e.target.checked })} />
                  <span>{f.label}</span>
                </label>
              ) : (
                <Stepper key={f.key} f={f} value={settings[f.key] as number} autoTraitors={autoTraitors} onChange={onChange} />
              ),
            )}
        </section>
      ))}
    </div>
  );
}

function Stepper({ f, value, autoTraitors, onChange }: { f: NumberField; value: number; autoTraitors: number; onChange: (patch: Partial<Settings>) => void }) {
  const shown = value === 0 && f.zero ? `${f.zero} (${autoTraitors})` : f.seconds ? secondsLabel(value) : String(value);
  return (
    <div className="setting-number">
      <span>
        {f.label}
        {f.hint && <small>{f.hint}</small>}
      </span>
      <button className="btn ghost" aria-label={`Less ${f.label}`} disabled={value <= f.min} onClick={() => onChange({ [f.key]: Math.max(f.min, value - f.step) })}>
        −
      </button>
      <strong>{shown}</strong>
      <button className="btn ghost" aria-label={`More ${f.label}`} disabled={value >= f.max} onClick={() => onChange({ [f.key]: Math.min(f.max, value + f.step) })}>
        +
      </button>
    </div>
  );
}
