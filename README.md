# Emberwake

A first-person, retro pixel-3D adventure: explore the Wilds, clear nine dungeons, collect eight Ember Shards and unmake the Hollow King. 1–4 player co-op.

**Play:** open `index.html` in Chrome, Edge or Firefox, or play the hosted version on GitHub Pages.

## Co-op
- **Room code / invite link (internet):** Menu → Invite Friends → Open Room. Send the link (`…/#join-ROOMNAME`) or the code `GLD-ROOMNAME`.
- **No internet:** everyone joins the same hotspot or Wi-Fi, then use "No internet? Invite with a webcam" on both sides.

## Controls
WASD move · mouse look (click to lock, or hold a button and drag) · click/Space attack · right-click/E item · Q/R/wheel switch item · hold F next to a fallen friend to help them up · M map · Esc menu. Gamepads work too.

## Debug mode
Title screen → DEBUG. Pick a starting loadout (sword, tunic, hearts, items, shards), a start location and god mode. The pause menu then has warp buttons for every dungeon. It also applies to friends who join with debug on.

## Working on the game
```
node tools/check.js     # validate content + headless tests (add --full for 300 worlds)
python build.py         # rebuild index.html from src/
```
**See all the art and animations:** [docs/art](docs/art/README.md).

New enemies, items, elites, sprites and animations are one file each. Start with **[docs/ADDING_CONTENT.md](docs/ADDING_CONTENT.md)** and the copy-paste files in `docs/templates/`.

| Folder | What's in it |
|---|---|
| `src/content/` | All game content: enemies, items, elites, projectiles, drops, dungeons, caves, art |
| `src/engine/` | Drawing, textures, sound, input |
| `src/game/` | World generation and the game rules |
| `src/net/`, `src/ui/` | Co-op networking; menus and the client loop |
| `src/core/` | Shared helpers and the content registry |
| `tools/check.js` | The automated checks |
| `tools/export_art.js`, `docs/art/` | Animated GIF gallery of every sprite and animation |
| `vendor/` | qrcode-generator, jsQR, PeerJS |
