# POSSESSED

A physical, phone-driven social deduction game for a Halloween party. The hub (`/hub`) runs on a laptop plugged into the TV; players join on their phones (`/play`) by scanning the QR code.

## Running the party

1. Open `/hub` on the laptop and click to awaken the house (this unlocks sound and goes fullscreen).
2. Players scan the QR code, pick a name and a soul color.
3. Press **H** (or the ⛧ in the bottom-right corner) for host controls.
4. Before the party, open `/setup` on your phone to walk the house: it lists every ritual by location and every Blood Moon card.

## Rules

- **Mortals** win when every Possessed is cast into the void, or every Mortal ritual is complete.
- **The Possessed** win when living Possessed ≥ living Mortals, or when a Blood Moon isn't stopped in time.
- **Killing:** the Possessed taps a Mortal on the shoulder and whispers "you're mine". The victim presses *I was killed* and lies down. Each kill restarts one shared cooldown for all Possessed (the app doesn't know who did it). It's shown on the Possessed's phones and works on the honor system.
- **Séance:** started by *Found a Corpse* or *Ring the Bell* (one per player). Discussion → voting on phones → verdict.
- **Role reveal:** no timer. Everyone holds to see their role and taps *I'm ready*; the game starts when all players are ready (the host can skip).
- **Blood Moon:** the Possessed summon it. Each Blood Moon uses two locations with a playing card at each. Anyone alive, even the Possessed, finds a card and taps it on their phone from 6 choices. One player can do both, or two can split up. A wrong pick locks that player out for 10s. When both are sealed the TV shows who saved everyone. Timings are in the host panel under **🌕 Blood Moon**.

## Sound

The TV plays ambient sound plus every game event. Phones play only shared moments: game start, meeting bell, voting, verdict, the Blood Moon (gong + wolf howl) and game over. Private taps are silent so phones never give away where someone is. Each player can mute with 🔊 in the header or lobby. iPhones in silent mode won't play web audio.

## Adding or removing things

- Rituals: `config/rituals.ts`. Add an entry, delete one, or set `enabled: false`. You can also toggle rituals in the host panel.
- Blood Moon cards and locations: `config/bloodmoon.ts`. Add one `seals` entry per pair of cards.
- Default timers and settings: `config/game.ts` (Blood Moon defaults in `config/bloodmoon.ts`). All of them can be changed in the host panel lobby.

## Deploying on Vercel

1. Push to GitHub and import the project in Vercel.
2. In the project, go to **Storage → Marketplace → Upstash Redis** and connect it. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Redeploy.

## Testing alone (live or local)

Open `/test` on your phone. You can then:

1. Join as yourself at `/play` (in another tab or on another device). Optionally open `/hub` on a laptop.
2. Tap **Add 5 bots** (bots count toward the 6-player minimum) and **Fast timers**.
3. Tap **Start: I'm Possessed** or **Start: I'm Mortal**.
4. Use the bot buttons to do tasks, kill, report, ring the bell and vote. **Blood Moon now** skips the wait, and the page shows the card code.

Every button is also a URL, e.g. `/api/test?do=bots&n=5`. Actions: `bots` (n), `clearbots`, `fast`, `start` (role, name), `role`, `skip`, `cooldowns`, `moon`, `code`, `bottasks` (pct), `botkill` (name), `botreport`, `botbell`, `botvote` (target = name | skip | random), `lobby`, `reset`, `state`.

There is no PIN: anyone who opens `/hub`, `/setup` or `/test` can use them. Set `TEST_TOOLS=off` in Vercel to switch the test tools off for the party (they reveal roles).

## Local development

```bash
npm run dev
```

Without Redis env vars it uses an in-memory store, and only 3 players are needed to start. To test a production build locally without Redis: `npm run build && POSSESSED_MEMORY_STORE=1 npm start`.
