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

## Project layout
- `index.html` – the built game (one self-contained file)
- `src/` – game source (`shell.html` is the page template)
- `vendor/` – qrcode-generator, jsQR, PeerJS
- `build.py` – run `python build.py` after editing `src/` to rebuild `index.html`
