# POSSESSED

A physical, phone-driven social deduction game for a Halloween party. The hub (`/hub`) runs on a laptop plugged into the TV; players join on their phones (`/play`) by scanning the QR code.

## Running the party

1. Open `/hub` on the laptop and click to awaken the house (this unlocks sound and goes fullscreen).
2. Players scan the QR code, pick a name and a soul color.
3. Press **Space** to start. **H** (or the ⛧ in the bottom-right corner) opens host controls.
4. Before the party, open `/setup` on your phone to walk the house: it lists every ritual by location and every Blood Moon card.

## Rules

- **Mortals** win when every Possessed is cast into the void, or every Mortal ritual is complete.
- **The Possessed** win when living Possessed ≥ living Mortals, or when a Blood Moon isn't stopped in time.
- **Killing:** the Possessed taps a Mortal on the shoulder and whispers "you're mine". The victim presses *I was killed* and lies down. Each kill restarts one shared cooldown for all Possessed (the app doesn't know who did it). It's shown on the Possessed's phones and works on the honor system.
- **Séance:** started by *I found a body* on a phone, or by ringing the emergency bell: press any key on the TV laptop's keyboard (except Space, S and H). The bell can ring 5 times per game and sleeps for 2½ minutes after the game starts and after every meeting (both changeable in the host panel). Nobody knows who rang it. Discussion → voting on phones → verdict.
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

## The Spirit Board (house desktop)

Open `/spirits` on a computer somewhere in the house and click to awaken it. Like vitals in Among Us, it shows every player as alive (glowing soul, beating heart line) or dead (flatline), **including kills nobody has reported yet**. A flatline tone plays when a soul departs. It never shows roles or who did it, and it goes dark during a Blood Moon. Players have to walk to it to use it, which makes lingering there suspicious.

## Admin controls

Open `/admin` on your phone to run the game without touching the laptop:

- **Game:** start, ⏭ skip timer (role reveal or any meeting stage), force a meeting, back to lobby, reset. Roles stay hidden until you tap **Show roles**, so you can play too.
- **🌕 Blood Moon:** summon one now, cancel it, see the card answers, and change its settings (in the lobby).
- **🤖 Bots (testing alone):** add bots, start as Possessed or Mortal, and make bots do tasks, kill, report, vote and stop the Blood Moon.

Every button is also a URL, e.g. `/api/admin?do=skip`. Actions: `start` (role, name), `skip`, `meeting`, `lobby`, `reset`, `ready`, `moon`, `cancelMoon`, `code`, `bots` (n), `clearbots`, `fast`, `role`, `cooldowns`, `bottasks` (pct), `botkill` (name), `botreport`, `bell`, `botvote` (target = name | skip | random), `botseal`, `state`.

There is no PIN, so don't share `/admin`, `/hub` or `/setup` with guests (they only need the QR code). Set `ADMIN_TOOLS=off` in Vercel to switch `/admin` off entirely.

## TV keyboard shortcuts

- **Space:** start the game from the lobby, or play again after a game ends
- **S:** skip the current timer (role reveal or meeting stage)
- **H:** open host controls
- **Any other key** (while playing): ring the emergency bell

## Local development

```bash
npm run dev
```

Without Redis env vars it uses an in-memory store. To test a production build locally without Redis: `npm run build && POSSESSED_MEMORY_STORE=1 npm start`.
