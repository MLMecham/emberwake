// ===== core/registry.js : the content registries =====
// Every enemy, item, projectile, elite, sprite and animation registers itself here with a define*() call.
// The engine never names a specific enemy or item; it looks things up in these tables.
// To add content, drop a new file in src/content/... (see docs/ADDING_CONTENT.md). build.py picks it up.
'use strict';
const Content = {
  sprites: {},      // id -> { rows: [16 strings], pal?: {char: '#hex'} }          (pixel art source)
  spriteVariants: {}, // id -> { base, pal }                                      (recolors of another sprite)
  anims: {},        // id -> { fps, frames: (base, kit) => [sprites] | [[rows]...] }
  enemies: {},      // id -> enemy def (see defineEnemy)
  items: {},        // id -> item def (see defineItem)
  projectiles: {},  // id -> projectile def
  entities: {},     // entity kind -> { update(sim, e, dt) }  (bombs, boomerangs, fire, ...)
  elites: [],       // ordered list; an elite's network id is its index + 1
  eliteById: {},
  drops: {},        // drop table id -> { entries: [{ item, w, when? }], none }
  dungeons: [],     // index = dungeon number (1-9)
  caves: {},        // cave kind -> { npc, text, stock }
  gimmicks: {},     // dungeon gimmick id -> hooks (see defineGimmick)
  hints: [],        // old-man hint lines
};
const _defErr = [];
function _need(kind, def, keys) { for (const k of keys) if (def[k] == null) _defErr.push(kind + ' "' + (def.id || '?') + '" is missing "' + k + '"'); }
function _dupe(kind, table, id) { if (table[id]) _defErr.push(kind + ' "' + id + '" is defined twice'); }

// ---- art ----
// rows: 16 strings of 16 chars. Each char is a palette key (see PAL in engine/spritekit.js); '.' is transparent.
function defineSprite(id, rows, pal) { _dupe('sprite', Content.sprites, id); Content.sprites[id] = { rows, pal }; }
// Same art, different colors: defineSpriteVariant('gem_b', 'gem', { T: '#4080f0', ... })
function defineSpriteVariant(id, base, pal) { _dupe('sprite', Content.spriteVariants, id); Content.spriteVariants[id] = { base, pal }; }
// frames: either a function (baseSprite, kit) => [sprite, sprite, ...] using kit transforms (squash, step, ...)
//         or an array of row-arrays (hand-drawn frames). fps: frames per second.
function defineAnim(id, fps, frames) { _dupe('anim', Content.anims, id); Content.anims[id] = { fps, frames }; }

// ---- enemies ----
// Required: id, hp, spd, dmg, r (hit radius), sc (draw scale), sprite (rows) and ai (function).
// Optional: fly, z, phase (walks through walls), shield (blocks frontal hits), boss,
//           anim: { fps, frames }, spawns: { biomes: [...], dungeons: [...] }, bossOf: [dungeon numbers],
//           drops: drop table id (default 'common'), onDamage(sim, e, dmg, opt) -> false to ignore the hit,
//           onDeath(sim, e) -> 'win' ends the game, view(e) -> extra height for the sprite,
//           boomerangKills: a boomerang hit kills it instead of stunning.
//           title: name on the boss health bar.  hot: fire-born (frost arrows do double damage).
// ai(sim, e, dt, ctx): ctx = { p: nearest hero or null, spd: speed after modifiers, def }
function defineEnemy(def) {
  _need('enemy', def, ['id', 'hp', 'spd', 'dmg', 'r', 'sc', 'sprite', 'ai']); _dupe('enemy', Content.enemies, def.id);
  def = Object.assign({ drops: 'common', spawns: {}, bossOf: [], z: 0 }, def);
  Content.enemies[def.id] = def;
  defineSprite(def.id, def.sprite, def.pal);
  if (def.anim) defineAnim(def.id, def.anim.fps, def.anim.frames);
  return def;
}

// ---- items ----
// Required: id, name, sprite (a sprite id).
// Optional: monk: { name, sprite }       -> what the martial artist sees instead
//           slot: 'b'                     -> shows up in the B-item rotation; needs owned(p) and use(sim, p)
//           order: number                 -> position in the B-item rotation
//           team: true                    -> give() runs for every player (shared progression)
//           give(sim, p, ctx)             -> what picking it up does. ctx = { fromShop, banner(text) }.
//                                            Call ctx.banner() to show the "you got X" card.
//           pickup: { sc, z, float }      -> how it looks lying on the ground
//           debug: true                   -> appears as a checkbox in the debug loadout
function defineItem(def) {
  _need('item', def, ['id', 'name', 'sprite']); _dupe('item', Content.items, def.id);
  if (def.slot === 'b') _need('B-item', def, ['owned', 'use']);
  Content.items[def.id] = Object.assign({ order: 99, pickup: {} }, def);
  return Content.items[def.id];
}
// ---- projectiles ----
// Required: id, spr, spd, dmg. Optional: sc, z, range (tiles), player (fired by heroes), pierce, fire (burns bushes),
// blockable (hero shields stop it), pierceShield, endFx (sprite shown where it ends), silver.
function defineProjectile(def) { _need('projectile', def, ['id', 'spr', 'spd', 'dmg']); _dupe('projectile', Content.projectiles, def.id); Content.projectiles[def.id] = Object.assign({ sc: 0.7, z: 0.15 }, def); }
// ---- world entities with their own behavior (bombs, boomerangs, fire patches...) ----
function defineEntity(kind, def) { _dupe('entity', Content.entities, kind); Content.entities[kind] = def; }
// ---- elites ----
// Required: id, name, color [r,g,b], weight. Optional: apply(e) when spawned, update(sim, e, dt, ctx) -> true to skip normal AI,
// noContact (doesn't hurt on touch), onDeath(sim, e, drop) where drop(item, dx, dy) spawns loot.
function defineElite(def) { _need('elite', def, ['id', 'name', 'color', 'weight']); _dupe('elite', Content.eliteById, def.id); def.idx = Content.elites.length + 1; Content.elites.push(def); Content.eliteById[def.id] = def; }
// ---- drop tables ----  entries: [{ item, w (weight), when(sim)? }], none: weight of dropping nothing
function defineDropTable(id, none, entries) { Content.drops[id] = { none, entries }; }
// ---- dungeons & caves ----
// defineDungeon(n, { name, item, shape: [...rows], theme: {...colors}, gimmicks: [...ids], secret: 'TILE_NAME', lore: [...] })
// shape: up to 8 rows of 8 chars. '#' room, 'S' entrance (nothing may sit directly below it), 'H' hidden room, '.' nothing.
function defineDungeon(n, def) { Content.dungeons[n] = def; if (def.theme) defineTheme('d' + n, def.theme); }
// ---- dungeon gimmicks ----
// defineGimmick(id, {
//   doors(L, doors, ctx)        change door tiles after the room tree is built (doors: [{ a, b, x, y, t, tree }])
//   room(L, r, ctx) -> true     decorate one normal room (return true to skip the default block layout)
//                               ctx = { rnd, d, set(x, y, tileName), prop(x, y, PR), lane(x, y), ix, iy }
//   level(L, ctx)               once per dungeon at the end (flags like L.dark)
//   update(sim, L, dt)          every tick on the host while a hero is in this dungeon
// })
function defineGimmick(id, def) { _dupe('gimmick', Content.gimmicks, id); Content.gimmicks[id] = def; }
function defineCave(kind, def) { Content.caves[kind] = def; }
function defineHints(lines) { Content.hints.push(...lines); }

// ---- lookups used by the engine ----
function enemyDef(id) { return Content.enemies[id]; }
function itemDef(id) { return Content.items[id]; }
function itemName(id, cls) { const d = Content.items[id]; if (!d) return String(id).toUpperCase(); return (cls === 'monk' && d.monk && d.monk.name) || d.name; }
function itemSprite(id, cls) { const d = Content.items[id]; if (!d) return 'heart'; return (cls === 'monk' && d.monk && d.monk.sprite) || d.sprite; }
function bItems() { return Object.values(Content.items).filter(d => d.slot === 'b').sort((a, b) => a.order - b.order); }
function eliteByIdx(i) { return Content.elites[i - 1]; }
function enemiesFor(where, key) { return Object.values(Content.enemies).filter(d => d.spawns[where] && d.spawns[where].includes(key)).map(d => d.id).sort(); }
function bossFor(n) { const d = Object.values(Content.enemies).find(d => d.bossOf.includes(n)); return d ? d.id : null; }
function rollDrop(table, sim, rnd) {
  const t = Content.drops[table]; if (!t) return null;
  // entries switched off by when() count as "nothing", so they don't make the other drops likelier
  const live = t.entries.filter(e => !e.when || e.when(sim));
  let total = t.none; for (const e of t.entries) total += e.w;
  let r = (rnd || Math.random)() * total;
  for (const e of live) { if (r < e.w) return e.item; r -= e.w; }
  return null;
}

// checks a dungeon shape: size, an entrance with nothing below it, normal rooms connected, hidden rooms touching a normal room
function shapeProblems(shape) {
  const err = []; if (!Array.isArray(shape) || !shape.length) return ['missing shape'];
  if (shape.length > 8 || shape.some(r => r.length > 8)) err.push('must fit in 8 rows of 8 characters');
  const at = (x, y) => (shape[y] || '')[x] || '.'; const cells = [];
  for (let y = 0; y < shape.length; y++) for (let x = 0; x < shape[y].length; x++) { const c = at(x, y); if (!'.#SH'.includes(c)) err.push('unknown character "' + c + '"'); if ('#S'.includes(c)) cells.push([x, y]); }
  const starts = cells.filter(([x, y]) => at(x, y) === 'S'); if (starts.length !== 1) err.push('needs exactly one S (entrance)');
  else { const [sx, sy] = starts[0]; if (at(sx, sy + 1) !== '.') err.push('nothing may be directly below the S'); }
  if (cells.length) { const seen = new Set([cells[0].join()]); const q = [cells[0]]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + dx) + ',' + (y + dy); if (!seen.has(k) && '#S'.includes(at(x + dx, y + dy))) { seen.add(k); q.push([x + dx, y + dy]); } } } if (seen.size !== cells.length) err.push('rooms (#) are not all connected'); }
  for (let y = 0; y < shape.length; y++) for (let x = 0; x < shape[y].length; x++) if (at(x, y) === 'H' && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => '#'.includes(at(x + dx, y + dy)))) err.push('hidden room at ' + x + ',' + y + ' must touch a # room');
  return err;
}
// ---- validation: run at boot (browser console) and by tools/check.js ----
function validateContent() {
  const err = _defErr.slice(); const spriteIds = new Set([...Object.keys(Content.sprites), ...Object.keys(Content.spriteVariants)]);
  const needSpr = (what, id) => { if (id && !spriteIds.has(id)) err.push(what + ' uses sprite "' + id + '" which does not exist'); };
  for (const [id, s] of Object.entries(Content.sprites)) {
    if (!Array.isArray(s.rows) || s.rows.length !== 16) err.push('sprite "' + id + '" must have 16 rows (has ' + (s.rows && s.rows.length) + ')');
    else s.rows.forEach((r, i) => { if (r.length !== 16) err.push('sprite "' + id + '" row ' + i + ' has ' + r.length + ' chars, needs 16'); for (const ch of r) if (ch !== '.' && !(s.pal && s.pal[ch]) && !PAL[ch]) err.push('sprite "' + id + '" uses unknown color "' + ch + '"'); });
  }
  for (const [id, v] of Object.entries(Content.spriteVariants)) needSpr('sprite variant "' + id + '"', v.base);
  for (const [id, a] of Object.entries(Content.anims)) if (!spriteIds.has(id)) err.push('anim "' + id + '" has no sprite with the same id');
  for (const d of Object.values(Content.items)) { needSpr('item "' + d.id + '"', d.sprite); if (d.monk) needSpr('item "' + d.id + '" (monk)', d.monk.sprite); if (!d.give && !d.use) err.push('item "' + d.id + '" has neither give() nor use()'); }
  for (const d of Object.values(Content.projectiles)) needSpr('projectile "' + d.id + '"', d.spr);
  for (const d of Object.values(Content.enemies)) { if (typeof d.ai !== 'function') err.push('enemy "' + d.id + '" ai must be a function'); if (d.drops && !Content.drops[d.drops]) err.push('enemy "' + d.id + '" uses unknown drop table "' + d.drops + '"'); }
  for (const [id, t] of Object.entries(Content.drops)) for (const e of t.entries) if (!Content.items[e.item]) err.push('drop table "' + id + '" drops unknown item "' + e.item + '"');
  for (let n = 1; n <= 9; n++) { const d = Content.dungeons[n]; if (!d) { err.push('dungeon ' + n + ' is not defined'); continue; }
    for (const s of shapeProblems(d.shape)) err.push('dungeon ' + n + ' shape: ' + s);
    for (const g of d.gimmicks || []) if (!Content.gimmicks[g]) err.push('dungeon ' + n + ' uses unknown gimmick "' + g + '"');
    if (d.secret && TL[d.secret] == null) err.push('dungeon ' + n + ' secret wall "' + d.secret + '" is not a tile'); if (d.item && !Content.items[d.item]) err.push('dungeon ' + n + ' rewards unknown item "' + d.item + '"'); if (!bossFor(n)) err.push('dungeon ' + n + ' has no boss (set bossOf on an enemy)'); if (!enemiesFor('dungeons', n).length) err.push('dungeon ' + n + ' has no enemies (add it to an enemy\'s spawns.dungeons)'); }
  for (const b of BIOMES) if (!enemiesFor('biomes', b).length) err.push('biome "' + b + '" has no enemies');
  for (const [k, c] of Object.entries(Content.caves)) { for (const s of (c.stock || [])) for (const it of [].concat(s.item)) if (!Content.items[it]) err.push('cave "' + k + '" sells unknown item "' + it + '"'); if (c.npc) needSpr('cave "' + k + '"', c.npc); }
  return err;
}
