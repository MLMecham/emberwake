# Emberwake

A first-person, retro pixel-3D adventure: explore the Wilds, clear nine dungeons, collect eight Ember Shards and unmake the Hollow King. 1–4 player co-op.

**Play:** open `index.html` in Chrome, Edge or Firefox, or play the hosted version on GitHub Pages.

## Co-op
- **Join code (internet):** the host opens Menu → Invite Friends, which shows a 5-character code like `K7QFM`. Friends pick Join a Friend and type it, or click the invite link (`…/#join-K7QFM`).
- **No internet:** everyone joins the same hotspot or Wi-Fi, then use "No internet? Invite with a webcam" on both sides.
- **When the host pauses** (opens the menu or switches to another tab), the game pauses for everyone.

### If some friends can't join ("could not connect")
Co-op connects computers straight to each other. Some home routers, school or work networks, and phone hotspots block that, so it fails for some people. The fix is a **relay** (a TURN server) that passes traffic along when a direct link is blocked. Metered's Open Relay is free up to 20 GB a month, which is plenty for this game.

1. Sign up at https://www.metered.ca/tools/openrelay/ and create an app. Its name is the part before `.metered.live`.
2. Copy the app's **API key** from the dashboard.
3. Put both into `src/net/relay.js`:
   ```js
   const RELAY = { meteredApp: 'yourappname', meteredKey: 'your-api-key' };
   ```
4. Run `python build.py`, then push.

The pause menu shows `DIRECT` or `RELAY` for each connection. That key can only fetch relay credentials, so it's fine to have it in a public repo.

## Beyond the main quest
Two mountain passes lead out of the Wilds. West is the **Frozen Reach**: slippery ice, frost imps and snow wolves, and **Rimefang Hollow**, home of the long-necked **Frost Matriarch** (treasure: Frost Arrows, which freeze what they hit). East is the **Cinder Wastes**: lava, vents that blow on a rhythm, and the **Cinder Caldera** with the **Fire Patriarch** (treasure: Magma Boots). Each dragon leaves a relic, the Frost Fang and the Ember Heart. With both, the sealed gate on the edge of the great wood opens to **the Hearth**, where the three-headed **Hearthwyrm** guards the **Dawnblade**.

## Controls
WASD move · mouse look (click to lock, or hold a button and drag) · click/Space attack · right-click/E item · Q/R/wheel switch item · hold F next to a fallen friend to help them up · M map · Esc menu. Gamepads work too.

## Debug mode
Only for heroes named **MITCH** or **LOGAN** (the list is `DEV_NAMES` in `src/core/util.js`). With one of those names:
- **Title screen → DEBUG** sets a starting loadout (sword, tunic, hearts, items, shards), a start location and god mode.
- **Pause menu → DEBUG: ON/OFF** switches it mid-game. While it's on you get warp buttons and a **Warp Stone** B-item that hops between dungeons.

Any other name has no debug at all.

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
