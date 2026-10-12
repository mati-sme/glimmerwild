# Glimmerwild

A Game Boy-style creature-collecting PWA. Plain static files, no build step, no external assets.

**Play:** serve the folder with any static server (`python3 -m http.server`) and open `index.html`.
It works from a GitHub Pages subpath (all paths are relative) and is installable / offline-capable.

## How to play
- **Joystick** (touch anywhere in the lower-left area, or WASD/arrows) moves you around a seeded 240x240 world with meadow, forest, desert, snow, swamp, volcano and water.
- **A button** (or E/Space) near a wild creature starts an encounter; near the shrine it heals; near a red **B** boss it starts a boss fight. Bosses are marked on the world map and at screen edges.
- **Battle:** Fight (type effectiveness), Orb (timing minigame; chance depends on target HP and your Catching Skill level, which levels up), Berry, Team (switch), Run.
- **Menu:** Team, Storage, Fusion Lab (two parents are consumed; child inherits stats, colours, types and traits like Swift/Sturdy/Fierce), Training (tap minigame for XP), World Map, Save.
- 20 original species with procedurally drawn pixel sprites; new attacks unlock at levels. The game autosaves to localStorage.

## Files
- `js/` ES modules: `main` (loop, overworld, title), `world`, `sprites`, `creature`, `battle`, `menus`, `ui`, `input`, `data`, `state`, `save`, `audio`, `util`
- `sw.js` service worker (bump `CACHE` when files change), `manifest.json`
- `tools/make-icons.mjs` regenerates `icons/*.png`: `node tools/make-icons.mjs`
