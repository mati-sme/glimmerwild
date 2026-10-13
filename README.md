# Glimmerwild

A real-time creature-collecting adventure PWA. Plain static files, no build step, no external assets.

**Play:** https://mati-sme.github.io/glimmerwild/ (installable, works offline).
Locally: serve the folder with any static server (`python3 -m http.server`) and open `index.html`. All paths are relative, so it also works from a subpath.

## How to play
- **Move:** floating joystick (touch the lower-left) or WASD / arrows.
- **Attack (big red sword button, or J / Space):** swing your weapon at mobs. Mobs have HP bars, chase you, and telegraph attacks with a red warning ring and `!`. Hits flash, knock back and show damage numbers. Tap or hold.
- **Partner (your lead creature):** follows you and automatically attacks whatever you are hitting (or anything attacking you), using its best unlocked move with type effectiveness (gold ▲ = super effective, grey ▼ = resisted). It earns XP and levels as before. If it is knocked out, the next healthy one steps in.
- **Catch (blue orb button, or K):** hold and drag from the button to aim; a dotted arc and landing ring show where the orb lands (green = locked on a creature). Release to throw. A quick tap auto-aims at the nearest creature. A hit starts a wobble animation; the odds come from the creature's remaining HP, its level and your Catching Skill (which levels up). A miss leaves the orb on the ground: walk over it to pick it up. Wounded creatures (small orb icon beside their bar) are easier to catch.
- **Shrine (heart):** walk up to it and you and your team heal. If you faint you wake up at the shrine.
- **Bosses (crown):** real-time fights with telegraphed charges (red lane), rings of projectiles and summoned minions. They go dizzy after a charge, which is the time to strike. You can only catch a boss when it is below 25% HP (blue marker on its bar), and catching gives you its Titan.
- **Drops and gear:** mobs drop Hide, Fang, Gem and (bosses) Core. Spend them at the base Forge to upgrade weapon and armor through 6 tiers each.
- **Home base (fenced camp west of the start):** everyone you do not carry lives here and wanders around. Stations: Storage and Team picker, Fusion Lab, Forge, Training. Walk next to one and press the yellow USE button (or E).
- **Fusion:** catch creatures to collect their traits as gene vials; fuse two creatures at the Lab (optionally adding a vial to guarantee its trait) for stronger, rarer ones (Common to Legendary). The result comes with a reveal sequence.
- **Quests:** three active at a time (HUD chips and the Quests screen): catch X, defeat creatures or bosses, craft gear, fuse. Rewards pay out instantly.

### Playable without reading
Everything needed to move, fight, catch and heal is an icon: red sword = hit, blue orb = catch, yellow hand/station icon = use, heart = heal, crown = boss. A pulsing arrow points to the next goal (heart when hurt, otherwise the active quest target), sound cues warn of incoming attacks, and colours are consistent (red = danger, green = go, gold = reward). Text remains for the main player in menus and toasts.

## Saving
Autosaves to localStorage (`glimmerwild.save.v3`). Old v1/v2 saves are migrated on load (new fields get defaults) and the old keys are never overwritten.

## Files
- `js/` ES modules: `main` (loop, title), `overworld` (world update/draw, HUD, controls), `combat` (mobs, bosses, pet, orbs), `combatdraw`, `base` (camp stations and residents), `gear`, `quests`, `icons`, `world`, `sprites`, `creature`, `menus`, `ui`, `input`, `data`, `state`, `save`, `audio`, `util`
- `sw.js` service worker (bump `CACHE` whenever files change and list every file), `manifest.json`
- `tools/make-icons.mjs` regenerates `icons/*.png`: `node tools/make-icons.mjs`
- `tools/smoke.mjs` Playwright smoke test (phone, landscape, tablet): walks to a mob, attacks, throws an orb, visits the base stations, completes a quest, fuses, fights a boss, migrates a v1 save, and fails on any console or page error. Serve at http://localhost:8737/ then `node tools/smoke.mjs` (Playwright in `/tmp/pw`, or set `PW_PATH`). It takes about two minutes and writes screenshots to `screenshots/`.
- `window.__G` is a small debug hook (`G`, `K`, `spawnMobAt`) used by the test.
