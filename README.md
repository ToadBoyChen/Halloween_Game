# POSSESSED

A physical, phone-driven social deduction game for a Halloween party. The hub (`/hub`) runs on a laptop plugged into the TV; players join on their phones (`/play`) by scanning the QR code.

## Running the party

1. Open `/hub` on the laptop and click to awaken the house (this unlocks sound and goes fullscreen).
2. Players scan the QR code, pick a name and a soul color.
3. Press **H** (or the ⛧ in the bottom-right corner) for host controls. The PIN is `HOST_PIN`, default `1031`.
4. Before the party, open `/setup` on your phone to walk the house: it lists every ritual by location and every Blood Moon card.

## Rules

- **Mortals** win when every Possessed is cast into the void, or every Mortal ritual is complete.
- **The Possessed** win when living Possessed ≥ living Mortals, or when a Blood Moon isn't stopped in time.
- **Claiming a soul:** the Possessed taps a Mortal on the shoulder and whispers "you're mine", then presses *I claimed a soul* to start their cooldown. The victim lies down and presses *I've been claimed*.
- **Séance:** started by *Found a Corpse* or *Ring the Bell* (one per player). Discussion → voting on phones → verdict.
- **Blood Moon:** the Possessed summon it; everyone has 60s to find the two cards and type both into the hub.

## Adding or removing things

- Rituals: `config/rituals.ts`. Add an entry, delete one, or set `enabled: false`. You can also toggle rituals in the host panel.
- Blood Moon cards and locations: `config/bloodmoon.ts`. Add one `seals` entry per pair of cards.
- Default timers and settings: `config/game.ts`. Most can also be changed in the host panel lobby.

## Deploying on Vercel

1. Push to GitHub and import the project in Vercel.
2. In the project, go to **Storage → Marketplace → Upstash Redis** and connect it. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Optionally set `HOST_PIN`.
4. Redeploy.

## Local development

```bash
npm run dev
```

Without Redis env vars it uses an in-memory store, and only 3 players are needed to start. To test a production build locally without Redis: `npm run build && POSSESSED_MEMORY_STORE=1 npm start`.
