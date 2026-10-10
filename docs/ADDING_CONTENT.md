# Adding content to Emberwake

Everything the player meets (enemies, items, projectiles, elites, sprites, animations, drop tables, dungeons and caves) is **data registered from its own file**. The engine never names a specific enemy or item. To add something, you drop a file in the right folder, and it's picked up automatically.

```
src/
  core/        util, font, registry.js   <- the define*() functions and the content validator
  engine/      spritekit, tex, render, audio, input   <- how things are drawn and played; no content
  content/
    sprites/   heroes, items, props, effects, npcs    <- art that isn't an enemy
    ai.js      reusable enemy behaviors (AI.hop, AI.chase, AI.shooter('rock'), ...)
    enemies/   one file per enemy: art + stats + spawn places + animation + behavior
    items/     one file per item family: name + art + what picking up / using it does
    projectiles.js  elites.js  drops.js  dungeons.js  caves.js  entities.js
  game/        world.js (level generation), sim.js (rules, combat, co-op state)
  net/         co-op networking
  ui/          menus, debug panel, the client game loop
docs/templates/   copy-paste starting points
tools/check.js    validates content and runs the game logic headless
```

## The loop

1. Copy a template from `docs/templates/` into the right `src/content/...` folder and edit it.
2. Run `node tools/check.js`. It checks your art, ids and references, then spawns every enemy, uses every item, kills every elite and generates 40 worlds. Errors name the file and line.
3. Run `python build.py` to rebuild `index.html` and the art gallery in `docs/art/`, then open it to play-test. The debug panel on the title screen gives you any loadout and warps you to any dungeon.
4. Push with `git add -A`, `git commit -m "..."` and `git push`.

Each file in `content/` (except `ai.js` and `sprites/`) runs in its own scope, so helper variables in one file can't clash with another. To share a helper, put it in `content/ai.js`.

## Add an enemy

Copy `docs/templates/enemy.js` to `src/content/enemies/<name>.js`. The fields:

| Field | Meaning |
|---|---|
| `id` | Unique name; also the sprite id |
| `hp`, `spd`, `dmg` | Hit points, tiles/second, contact damage in half-hearts |
| `r`, `sc` | Hit radius in tiles, draw scale |
| `spawns` | `{ biomes: [...], dungeons: [1..9] }`. Biomes: plains, forest, mountain, lake, desert, graveyard |
| `bossOf` | Dungeon numbers where it's the boss (add `boss: true`) |
| `ai` | A behavior from `content/ai.js`, or your own `(sim, e, dt, { p, spd, def }) => {}` |
| `anim` | `{ fps, frames: (s, kit) => [...] }` (see "Animations" below) |
| `sprite` | 16 rows × 16 characters |

Optional fields: `fly`, `z`, `phase`, `shield`, `boomerangKills`, `drops`, `onDamage`, `onDeath`, `view`. The template explains each one.

Useful things an `ai` function can call: `sim.moveEnt(e, dx, dy, def)` (returns true if it hit a wall), `sim.fireProj(type, e.lvl, e.x, e.y, angle, 'e', null, { dmg })`, `sim.spawnMinion(e, 'bat')`, `sim.sfx(name, e.lvl, e.x, e.y)`, `AI.fan(...)`, `AI.ring(...)` and `AI.teleportInRoom(...)`. Look at `enemies/wyrm.js` and `enemies/king.js` for bosses written this way.

## Add an item

Copy `docs/templates/item.js` to `src/content/items/<name>.js`. There are two kinds:

- **Pickup:** needs `id`, `name`, `sprite` and `give(sim, p, ctx)`. Call `ctx.banner()` to show the "you got it" card.
- **B-item** (usable): also needs `slot: 'b'`, `order`, `owned(p)` and `use(sim, p)`.

Other options:
- `team: true` gives it to the whole party.
- `monk: { name, sprite }` is what the martial artist sees.
- `debug: true` adds it to the debug loadout.
- `canTake(p)` lets you refuse a pickup.
- `pickup: { sc, z, float }` controls how it lies on the ground.

To make it findable, set it as a dungeon treasure in `content/dungeons.js`, put it in a shop's `stock` in `content/caves.js`, or add it to a drop table in `content/drops.js`.

## Add an elite variant

Add a `defineElite({...})` at the **end** of `content/elites.js`; an elite's position in that file is its network id. See `docs/templates/elite.js`. Elites drop loot only.

## Sprites and palettes

Sprites are 16 strings of 16 characters. `.` is transparent, and every other letter is a color:

| | | | | | | | |
|---|---|---|---|---|---|---|---|
| `k` outline #14121c | `w` white #f8f8f0 | `g` grey #a8a8b4 | `G` dark grey #5c5c70 | `r` red #e03828 | `R` dark red #881c1c | `o` orange #f08830 | `y` yellow #f8d840 |
| `Y` dark yellow #b88818 | `n` brown #8a5a2a | `N` dark brown #4a2e18 | `b` blue #3a78e8 | `B` dark blue #1c3c90 | `c` cyan #70e8f8 | `C` dark cyan #2898b0 | `p` purple #a048d0 |
| `P` dark purple #582080 | `l` lime #80d848 | `e` green #38a838 | `E` dark green #1a6420 | `s` skin #f4c094 | `S` skin shade #c47c52 | `m` pink #f868b8 | `u` steel #d0d8e8 |
| `U` dark steel #7884a4 | `z` bone #ece4cc | `Z` dark bone #a89c80 | `H` hair #5a3418 | `v` pale blue #e8f8ff | `x` hot orange #ff5020 | `T` `t` `h` tunic (recolored per player) | |

Need a color that isn't there? Give the sprite its own palette: `pal: { Q: '#ff00ff' }` on an enemy, or `defineSprite(id, rows, { Q: '#ff00ff' })`.

- **Non-enemy art:** `defineSprite('id', rows)` in a file under `content/sprites/`.
- **Recolor of existing art:** `defineSpriteVariant('gem_b', 'gem', { T: '#4080f0' })`.

## Animations

**To see them:** open `docs/art/README.md`. On GitHub it's a gallery of every animation, the hero run cycles (each class, facing and armor) and every sprite, as animated GIFs. `python build.py` regenerates it, or run `node tools/export_art.js` on its own.

`defineAnim(id, fps, frames)` (or `anim:` on an enemy) attaches frames to the sprite with the same id. `frames` can be:

- **A function** `(s, kit) => [ ...sprites ]` that builds frames from the base sprite:
  - `kit.squash(s, 0.8)` squashes it (values below 1 squash, above 1 stretch).
  - `kit.step(s, row, dLeft, dRight)` moves the legs below `row`.
  - `kit.shearRows(s, y0, y1, dx)` slides a band of rows sideways.
  - `kit.shiftCols(s, x0, x1, dy)` moves wings or arms up and down.
  - `kit.bob(s, dy)` moves the whole sprite up or down.
  - `kit.mirror(s)` flips it.
  - `kit.rotate(s, angle)` turns it (the thrown boomerang spins this way).
  - `kit.fromRows(rows)` builds a hand-drawn frame.
- **An array** of hand-drawn frames, each 16 rows.

Stunned enemies freeze on their first frame. The heroes' silly run cycle is in `content/sprites/heroes.js` (`RUN_FRONT`, `RUN_SIDE`, `RUN_SEQ`, `RUN_SCALE`).

## Dungeons: shapes, colors, gimmicks

Each dungeon in `content/dungeons.js` is **drawn**:

```js
shape: [        // up to 8 rows of 8
  '....##..',   // '#' a room
  '...###..',   // 'S' the entrance (keep the space directly below it empty)
  '..###H..',   // 'H' a hidden room: behind a secret wall, holds a heart piece (4 = +1 heart) and a lore tablet
  '...S....',   // '.' nothing
],
theme: { wall, mortar, hi, floor, edge, fhi, trim },   // [r, g, b] colors for bricks, floor tiles and door frames
gimmicks: ['glass'],                                    // ids from content/gimmicks/
secret: 'FAKEWALL',                                     // the tile hiding the H rooms (default: a bombable wall)
lore: ['TEXT ON THE FIRST HIDDEN TABLET', '...'],
```

The generator builds a random tree of doors inside the shape. The boss goes in the deepest room and the treasure in the deepest dead end; it then places keys, locks (always solvable), the map and the compass. Roguelike runs sometimes mirror the shape. Missing chunks in the drawn outline give players a hint that a hidden room is there.

## Gimmicks

Each file in `src/content/gimmicks/` is one dungeon mechanic: brambles, cracked, drain, conveyors, fakewalls, glass, statues, darkness. A gimmick can define:
- `doors(L, doors, ctx)` changes door tiles. Brambles uses it to block doorways.
- `room(L, r, ctx)` decorates a room. `ctx` has `set(x, y, 'TILE')`, `prop(x, y, PR.X)`, `lane(x, y)` (keep the door paths clear), `rnd` and `d`. Return true to skip the default block layout.
- `level(L, ctx)` runs once per dungeon, for example to set `L.dark = true`.
- `update(sim, L, dt)` runs every tick while heroes are inside: switches, cracking glass and so on.

Then add its id to a dungeon's `gimmicks` list. Statues work by giving rooms `r.dormant = [{ type, x, y }]`, and the engine wakes them when a hero gets close.

## Tiles, textures and props

- **`defineTile('NAME', { ... })`** creates `TL.NAME`. The engine understands these flags:

  | Flag | Effect |
  |---|---|
  | `solid` | Blocks movement |
  | `wall: 'texture'` | Drawn as a wall |
  | `floor: 'texture'` | Drawn as a floor |
  | `water` | Water; the raft lets you cross it |
  | `hurt` | Damages you while you stand on it, like lava |
  | `pit` | You fall in and lose a heart |
  | `conveyor: [dx, dy]` | Pushes you |
  | `cuttable` / `burnable` + `opensTo: 'TILE'` | A sword or fire turns it into the `opensTo` tile |
  | `bomb` + `opensTo` | A bomb turns it into the `opensTo` tile |
  | `fake` | Looks solid, you can walk through it, and it whispers |
  | `glass`, `pressure` | Read by gimmick code |

- **`defineTexture('name', fn, opts)`:** `fn(x, y, rnd, ctx)` returns `[r, g, b]` for each pixel of a 32×32 texture. With `{ themed: true }`, fn also receives the dungeon's theme colors, and you get one copy per dungeon. With `{ frames: 4 }` it's animated.
- **`defineProp('NAME', 'spriteId', { solid, scale })`** creates `PR.NAME`, an object drawn on a tile.

Saves store tile and prop names, so adding new tiles never breaks old saves.

## Co-op scaling

Enemy health scales with how many heroes are in the room, set by `PARTY_HP` in `game/sim.js`: 1×, 1.5×, 2× and 2.5× for 1 to 4 heroes. It adjusts live as people come and go, and each enemy keeps the share of health it has left.

## Dev tools

Debug mode is only available to heroes named in `DEV_NAMES` (`src/core/util.js`; currently MITCH and LOGAN). Switch it on from the title screen's DEBUG button or the pause menu's DEBUG toggle. While it's on you get a **Warp Stone** (B-item): each use jumps to the next dungeon's entrance, then back to the overworld.

## Projectiles, drops, dungeons, caves

- **`content/projectiles.js`:** `defineProjectile({ id, spr, spd, dmg, ... })`. Options include `player`, `range`, `pierce`, `fire`, `blockable`, `pierceShield` and `endFx`.
- **`content/drops.js`:** `defineDropTable(id, weightOfNothing, [{ item, w, when? }])`. Point an enemy at a table with `drops: 'id'`.
- **`content/dungeons.js`:** each dungeon's name, pedestal treasure, shape, colors, gimmicks and lore (see above).
- **`content/caves.js`:** what each cave kind says and sells. Which caves appear on the map is `CAVE_MIX` in `game/world.js`.
