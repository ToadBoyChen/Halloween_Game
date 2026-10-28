# POSSESSED

A physical, phone-driven social deduction game for a Halloween party. The hub (`/hub`) runs on a laptop plugged into the TV; players join on their phones (`/play`) by scanning the QR code.

## Running the party

1. Open `/hub` on the laptop and click to awaken the house (this unlocks sound and goes fullscreen).
2. Players scan the QR code, pick a name and a soul color.
3. Open `/spirits` on a computer elsewhere in the house: that's the **Spirit Board**.
4. Press **Space** to start. **H** (or the ⛧ in the bottom-right corner) opens host controls.
5. Before the party, open `/setup` on your phone to walk the house: it lists every ritual by location and every Blood Moon card.

## Rules

- **Mortals** win when every Possessed is cast into the void, or every ritual in the pool is done.
- **The Possessed** win when living Possessed ≥ living Mortals, or when a Blood Moon isn't stopped in time.
- **Rituals:** one shared pool (about 3 per player). On your phone, tap a ritual to read what to do and where, then claim it, go do it, and tap *Done*. You hold one at a time, and a claim runs out after 5 minutes and goes back into the pool so nobody can sit on one. Some rituals stay 🔒 locked until another is done (`requires` in `config/rituals.ts`). Everyone's rituals count, even the Possessed's, so they have to choose between blending in and helping the Mortals win.
- **Killing:** the Possessed taps a Mortal on the shoulder and whispers "you're mine". Nothing happens on any phone. The victim lies still until someone finds them.
- **Finding a body:** on your phone, *⚡ Actions → I found a body*, pick whose it is, then choose to **report and call a meeting** or **report without a meeting**. Reporting a body calls the meeting straight away: it doesn't wait for the meeting ring or use up anyone's emergency meeting. Only the Hush and the Blood Moon stop it. The body becomes a ghost either way. If someone is reported while still alive, their phone shows who reported them and they can tap *I'm not dead!* until the next meeting ends. A Possessed who lies about a body gets caught. (Switch this off in the host panel or `/admin`.)
- **Ghosts** stay silent, can't vote or report, and finish leftover rituals.
- **Séance:** reporting a body can always call one. Without a body, every player has 1 emergency meeting (changeable in the host panel), called at the TV: press any key on the TV keyboard (except Space, S and H), type your player number and press Enter. Every player's number is shown on their phone and in the TV lobby. After the game starts and after each meeting, a blue ring fills around the pentagram on the TV (90 seconds, changeable in the host panel). Emergency meetings can only be called once it's full, and every finished ritual takes 2–5 seconds off the wait. The TV lists every body found since the last meeting and who found it. During talk time each phone shows one big *Ready to vote* button. When every living player has tapped it, voting starts early. Talk → voting on phones → verdict.
- **Role reveal:** no timer. Everyone holds to see their role and taps *I'm ready*; the game starts when all players are ready (the host can skip).
- **The Hush:** the Possessed call it from *⚡ Actions*. For 60 seconds nobody can call a meeting (bodies can still be reported without one). Screens go cold and grey, and a 🔒 covers the meeting buttons. It shares the Blood Moon's cooldown.
- **Blood Moon:** the Possessed summon it from *⚡ Actions* (alive or dead). Each Blood Moon uses two locations with a playing card at each. Anyone alive, even the Possessed, finds a card and taps it on their phone from 6 choices. One player can do both, or two can split up. A wrong pick locks that player out for 10s. When both are sealed the TV shows who saved everyone. Timings are in the host panel under **🌕 Blood Moon**.

## Sound

The TV plays every game event, with no background noise. The Blood Moon adds a siren and heartbeat until it's stopped. Phones play only shared moments: game start, meeting bell, voting, verdict, the Blood Moon (gong + wolf howl) and game over. Private taps are silent so phones never give away where someone is. Each player can mute with 🔊 in the header or lobby. iPhones in silent mode won't play web audio.

## Adding or removing things

- Rituals: `config/rituals.ts`. Add an entry, delete one, or set `enabled: false`. You can also toggle rituals in the host panel.
- Blood Moon cards and locations: `config/bloodmoon.ts`. Add one `seals` entry per pair of cards.
- Ritual chains: set `requires: "<other ritual id>"`. Keep chains 1–2 deep.
- Default timers and settings: `config/game.ts` (Blood Moon defaults in `config/bloodmoon.ts`). All of them can be changed in the host panel lobby.

## Deploying on Vercel

1. Push to GitHub and import the project in Vercel.
2. In the project, go to **Storage → Marketplace → Upstash Redis** and connect it. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Redeploy.

## The Spirit Board (house desktop)

Open `/spirits` on a computer somewhere in the house and click to awaken it. Like the security room in Among Us, it watches the rituals: what each player is working on right now, how many they've finished, the latest completions and how long ago, and every ritual's state. It never shows roles, and it goes dark during a Blood Moon. Players have to walk to it to use it, which makes lingering there suspicious.

## Admin controls

Open `/admin` on your phone to run the game without touching the laptop:

- **Status:** the phase and meeting stage, ritual progress, the meeting ring, the Hush, when the Possessed's powers are ready, and ready-to-vote / vote counts. Every player is listed with their number, what they're working on, rituals done, emergency meetings left, and who found them if they're a ghost. Roles stay hidden until you tap **Show roles**, so you can play too.
- **▶ Game:** start (or start as Possessed / Mortal), ⏭ skip timer, everyone ready, force a meeting, back to lobby, reset.
- **😈 Possessed powers:** Blood Moon now / cancel it (with the card answers), Hush now / end it, and fill the meeting ring + ready the powers.
- **☠ Kill & revive:** fix mistakes mid-game.
- **🤖 Bots (testing alone):** add bots, make them do rituals, find bodies (with or without a meeting), vote and stop the Blood Moon.
- **⚙️ Settings:** every lobby setting, the same as the TV's host panel (H).

Every button is also a URL, e.g. `/api/admin?do=skip`. Actions: `start` (role, name), `skip`, `meeting`, `lobby`, `reset`, `ready`, `moon`, `cancelMoon`, `hush`, `unhush`, `code`, `bots` (n), `clearbots`, `fast`, `role`, `cooldowns`, `bottasks` (pct), `kill` (name), `revive` (name), `botkill` (name: a bot finds their body), `botreport` (a bot finds a body and calls a meeting), `botvote` (target = name | skip | random), `botseal`, `state`.

There is no PIN, so don't share `/admin`, `/hub` or `/setup` with guests (they only need the QR code). Set `ADMIN_TOOLS=off` in Vercel to switch `/admin` off entirely.

## TV keyboard shortcuts

- **Space:** start the game from the lobby, or play again after a game ends
- **S:** skip the current timer (role reveal or meeting stage)
- **H:** open host controls
- **Any other key** (while playing): emergency meeting. Type a player number, then Enter (Backspace fixes, Esc cancels)

## Local development

```bash
npm run dev
```

Without Redis env vars it uses an in-memory store. To test a production build locally without Redis: `npm run build && POSSESSED_MEMORY_STORE=1 npm start`.
