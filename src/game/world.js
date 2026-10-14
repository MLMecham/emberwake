// ===== game/world.js : level generation (overworld, caves, dungeons) =====
'use strict';
const RW = 10, RH = 6, RSX = 16, RSY = 11; // overworld region grid & stride. Column 0 is the Frozen Reach, column RW-1 the Cinder Wastes.
const FRONTIER = { 0: 'snow', [RW - 1]: 'ash' }; // the lands beyond the passes, by column
const NDUNGEONS = () => Math.max(9, Content.dungeons.length - 1); // 1-9 main, 10+ optional
const DGW = 8, DGH = 8, DSX = 12, DSY = 8;  // dungeon room grid (8x8 rooms, drawn as shapes in content/dungeons.js) & room size

class Level {
  constructor(id, kind, w, h) {
    this.id = id; this.kind = kind; this.w = w; this.h = h;
    this.tiles = new Uint8Array(w * h); this.props = new Uint8Array(w * h);
    this.portals = {}; this.spawn = { x: 1.5, y: 1.5, a: 0 }; this.exit = null; this.npcs = []; this.shop = []; this.floorItems = [];
    this.secretReveal = {}; // tile idx -> {tile, portal}
  }
  idx(x, y) { return y * this.w + x; }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return TL.ROCK; return this.tiles[y * this.w + x]; }
  set(x, y, t) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y * this.w + x] = t; }
  solidAt(x, y, opts) {
    const fx = x, fy = y; x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return true;
    const t = this.tiles[y * this.w + x]; const ti = TINFO[t];
    if (ti.water && !ti.ocean && opts && opts.raft && this.kind !== 'dungeon') return false; // the raft is for open water, not dungeon halls
    if (ti.low && opts && opts.fly) return false; // flying (Gale Cloak) passes over water like a bat
    // sealed-room doors are one-way: teammates can come in, nobody leaves until the room is clear
    if (t === TL.SHUTTER && opts && opts.mx != null && this.kind === 'dungeon') {
      const rid = this.sealRoom && this.sealRoom[y * this.w + x];
      if (rid != null) { const r = this.rooms[rid]; const x0 = r.rx * DSX, y0 = r.ry * DSY; const m = 0.23; /* just over the player's 0.22 radius: you're 'inside' only once fully clear of the doorway */ const inside = opts.mx > x0 + 1 + m && opts.mx < x0 + DSX - m && opts.my > y0 + 1 + m && opts.my < y0 + DSY - m; if (!inside) return false; }
    }
    // high in the air on the Gale Cloak (opts.high): over everything a tile tall (hedges, rocks, trees); the tall walls still stop you
    if (opts && opts.high && ((ti.wall && !ti.tall && this.kind === 'ow') || ti.raised || ti.low)) return false; // (indoors the walls reach the ceiling)
    if (ti.solid) return true;
    if (ti.raised && ti.raised > ((opts && opts.z) || 0) + STEP_UP) return true; // a step or ledge too high to step up onto
    if (opts && opts.high) return false;
    // solid props (trees, boulders, cacti, graves, statues...) block a diamond, not the whole tile: two of them touching only at
    // a corner leave a gap you can walk through, the way it looks. Side by side they still make a solid wall.
    const p = this.props[y * this.w + x]; if (p && PROP_INFO[p].solid) { const dx = fx - x - 0.5, dy = fy - y - 0.5; return PROP_INFO[p].round ? dx * dx + dy * dy < PROP_ROUND_R * PROP_ROUND_R : Math.abs(dx) + Math.abs(dy) < PROP_K; } // small props: a circle; trees and boulders: a diamond
    return false;
  }
}

const BIOMES = ['plains', 'forest', 'mountain', 'lake', 'desert', 'graveyard', 'snow', 'ash'];
// Which enemies appear where comes from each enemy's `spawns` (content/enemies). Dungeon names and
// treasures come from content/dungeons.js. These helpers keep the old shapes for the generator.
const dungeonName = (d) => (Content.dungeons[d] || {}).name || ('LEVEL ' + d);
// The caves scattered across the overworld (besides the starting sword cave). Kinds are defined in content/caves.js.
const CAVE_MIX = ['shop1', 'shop2', 'armor', 'potion', 'sword1', 'sword2', 'heart', 'heart', 'gift', 'gift', 'gift', 'hint', 'hint', 'dojo', 'potion', 'shop1', 'bombshop'];
// Caves that are hidden behind a bombable wall or a burnable bush.
const SECRET_CAVES = ['heart', 'gift', 'dojo', 'sword2', 'bombshop'];

// ---- tide rooms (content/gimmicks/eyes.js) ----
// L.rigs[roomId] = { cells: [tile idx of tide water], eyes: [tile idx of timed eyes] }; L.eyeLinks[eye idx] says what an eye does.
// Shooting a timed eye starts the clock; the host sends each room's code and every machine swaps the tiles itself
// (tide tiles are never saved or sent as tile changes).
const TIDE = { DRY: 9, SHALLOW: 4, WARN: 2 }; // seconds drained, seconds shallow; the last WARN seconds of each are the warning
// 0 deep (eye open), 1 drained (eye shut), 2 drained but the eye is creaking open, 3 shallow, 4 shallow and rising
function tideCode(t) { if (t == null || t < 0) return 0; if (t < TIDE.DRY - TIDE.WARN) return 1; if (t < TIDE.DRY) return 2; if (t < TIDE.DRY + TIDE.SHALLOW - TIDE.WARN) return 3; if (t < TIDE.DRY + TIDE.SHALLOW) return 4; return 0; }
function applyRig(L, rid, code) {
  const rig = L.rigs && L.rigs[rid]; if (!rig) return; L.rigCode = L.rigCode || {}; L.rigCode[rid] = code;
  const water = code === 0 ? TL.WATER : code <= 2 ? TL.WET : TL.SHALLOW;
  for (const i of rig.cells) { if (L.frozen && i in L.frozen) L.frozen[i] = water; else L.tiles[i] = water; } // frozen cells keep their ice; they thaw into whatever the tide is by then
  for (const i of rig.eyes) L.tiles[i] = code === 1 ? TL.EYE_SHUT : TL.EYE;
}
// Which rooms can a party reach, picking up keys and opening locks as it goes? hasBow false treats rooms that need the
// bow (room.needsBow, from gimmicks/drain.js) as walls: a 'moat' room's prize is out of reach, and a 'channel' room
// splits into the side by its way in and the far side.
function dungeonSolve(L, hasBow) {
  const rooms = L.rooms; const split = (r) => !hasBow && r.needsBow === 'channel';
  const sideFor = (r, oid) => split(r) ? (r.parent && +oid === r.parent.id ? 'n' : 'f') : '';
  let keys = 0; const opened = new Set(), got = new Set(), reached = new Set();
  for (;;) {
    const seen = new Map(); const st = [[L.startRoom, '']];
    while (st.length) {
      const [r, side] = st.pop(); const nk = r.id + side; if (seen.has(nk)) continue; seen.set(nk, [r, side]); reached.add(r.id);
      const prizeOk = side !== 'n' && !(r.needsBow === 'moat' && !hasBow);
      if ((r.key || r.looseKey) && prizeOk && !got.has(r.id)) { got.add(r.id); keys++; }
      for (const oid in r.links) { if (sideFor(r, oid) !== side) continue; const lk = Math.min(r.id, +oid) + '-' + Math.max(r.id, +oid); if (r.links[oid] === TL.LOCKED && !opened.has(lk)) continue; const o = rooms[oid]; st.push([o, sideFor(o, r.id)]); }
    }
    let opn = false;
    if (keys > 0) for (const [r, side] of seen.values()) { for (const oid in r.links) { const lk = Math.min(r.id, +oid) + '-' + Math.max(r.id, +oid); if (sideFor(r, oid) === side && r.links[oid] === TL.LOCKED && !opened.has(lk)) { opened.add(lk); keys--; opn = true; break; } } if (opn) break; }
    if (!opn) return reached;
  }
}
// ---- frost arrows (items/bow.js, game/sim.js freezeAlong) ----
// Deep fresh water freezes into ice for a while (salt water never does). L.frozen[idx] = the tile underneath.
// The host decides what freezes and when it thaws; snapshots carry the list and every machine swaps its own tiles.
function freezeTile(L, i) { L.frozen = L.frozen || {}; if (i in L.frozen) return false; const ti = TINFO[L.tiles[i]]; if (!ti.water || ti.salty) return false; L.frozen[i] = L.tiles[i]; L.tiles[i] = TL.FROZEN; return true; }
function thawTile(L, i) { if (!L.frozen || !(i in L.frozen)) return; if (L.tiles[i] === TL.FROZEN) L.tiles[i] = L.frozen[i]; delete L.frozen[i]; }
function genWorld(seed, mode) {
  const W = { seed, mode, levels: {}, caveCount: 0, dungeons: [] };
  const rnd = mulberry32(seed);
  genOverworld(W, rnd);
  for (const biome of ['snow', 'ash']) genTunnel(W, biome, mulberry32(seed * 53 + (biome === 'snow' ? 11 : 29))); // the caves into the frontier lands
  for (let d = 1; d <= NDUNGEONS(); d++) genDungeon(W, d, mulberry32(seed * 31 + d * 977));
  genGrottos(W, mulberry32(seed * 17 + 5));
  genTestZone(W);
  return W;
}
// ---------- GROTTOS ----------
// One grotto of each kind (content/grottos.js) under a hollow tree: a tree already standing in a forest or plains region
// becomes HOLLOWTREE, with a portal on its tile and a stair revealed when it's split open (game/sim.js openHollowTree).
// Only trees with open, reachable ground in front of them. Its own random stream, so the rest of the land doesn't move.
function genGrottos(W, rnd) {
  const L = W.levels.ow; const kinds = (Content.grottoKinds || []).filter(k => Content.caves[k]); if (!kinds.length) return;
  const seen = new Uint8Array(L.w * L.h); { const sx = Math.floor(L.spawn.x), sy = Math.floor(L.spawn.y); const q = [sx + sy * L.w]; seen[q[0]] = 1; while (q.length) { const i = q.pop(); const x = i % L.w, y = (i / L.w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= L.w - 1 || ny >= L.h - 1) continue; const j = nx + ny * L.w; if (seen[j] || L.solidAt(nx + 0.5, ny + 0.5)) continue; seen[j] = 1; q.push(j); } } }
  const sr = owRegionAt(L, L.spawn.x, L.spawn.y);
  const regions = rnd.shuffle(L.regions.filter(r => r !== sr && (r.biome === 'forest' || r.biome === 'plains') && !r.island));
  const used = new Set(); L.grottos = [];
  for (const kind of kinds) {
    let placed = false;
    for (const r of regions) {
      if (used.has(r)) continue; const { x0, y0, x1, y1 } = regionInterior(r); const trees = [];
      for (let y = y0 + 1; y < y1 - 2; y++) for (let x = x0 + 1; x < x1 - 1; x++) { const i = L.idx(x, y), f = L.idx(x, y + 1); const pr = L.props[i]; if ((pr === PR.TREE || pr === PR.PINE) && !L.portals[i] && !L.secretReveal[i] && !TINFO[L.tiles[i]].solid && seen[f] && !L.props[f] && !TINFO[L.tiles[f]].portal) trees.push(i); }
      if (!trees.length) continue;
      const i = rnd.pick(trees); const x = i % L.w, y = (i / L.w) | 0; const id = 'g' + L.grottos.length;
      L.props[i] = PR.HOLLOWTREE; L.portals[i] = { to: id, stairs: true }; L.secretReveal[i] = { tile: TL.STAIRS };
      genCave(W, id, kind, { lvl: 'ow', x: x + 0.5, y: y + 1.5, a: Math.PI / 2 }, rnd);
      L.grottos.push({ id, kind, x, y }); used.add(r); placed = true; break;
    }
    if (!placed) break;
  }
}

// ---------- FRONTIER TUNNELS ----------
// The mountain pass into each frontier land is a cave instead of an open gap: a mostly straight run of TUNNEL_LEN rooms
// with a few side rooms (each guarding a little prize) and a miniboss pair of wyrmlings near the far end, getting colder (or hotter) room by room: ice walls, snow and ice
// patches toward the frozen end; basalt, ash and lava pools toward the burning end. Enemies shift from cave foes to the
// frontier's own along the way. Level kind 'tunnel' (rooms like a dungeon's, on a wider grid: L.gw).
// A cave mouth on each side of the old pass leads in at the matching end (portal.at), and the EXIT step at each end leads out
// beside that mouth (L.exits). Its own random stream, so the rest of the land doesn't move.
const TUNNEL_LEN = 12;
function genTunnel(W, biome, rnd) {
  const OW = W.levels.ow; const ps = OW.passes && OW.passes[biome]; if (!ps) return;
  const snow = biome === 'snow'; const gw = TUNNEL_LEN; const w = gw * DSX + 1, h = 3 * DSY + 1;
  const L = new Level('t' + biome, 'tunnel', w, h); W.levels[L.id] = L; L.gw = gw; L.tunnelBiome = biome; L.label = snow ? 'THE COLD ROAD' : 'THE EMBER ROAD'; L.theme = snow ? 'd10' : 'd11'; L.signText = {};
  for (let i = 0; i < w * h; i++) L.tiles[i] = TL.CWALL;
  const rooms = {}; const mk = (rx, ry) => { const r = { rx, ry, id: ry * gw + rx, links: {}, enemies: [], children: [], tier: 2 }; rooms[r.id] = r; return r; };
  // the run: room 0 at the main-land end, room gw-1 at the frontier end (west for the snow, east for the ash)
  const colOf = (i) => snow ? gw - 1 - i : i; const main = [];
  for (let i = 0; i < gw; i++) main.push(mk(colOf(i), 1));
  const sides = []; const cols = rnd.shuffle([2, 3, 4, 5, 6, 7]).slice(0, 4).sort((a, b) => a - b); // 8-10 are kept for the secret wing
  cols.forEach((i, k) => { const r = mk(colOf(i), k % 2 ? 0 : 2); r.side = true; r.from = main[i]; sides.push(r); });
  // the SECRET WING above room gw-3: a twin-eye gate, the elder wyrm pair, and a loot room beyond them
  const wingFrom = main[gw - 3]; const fight = mk(colOf(gw - 3), 0), loot = mk(colOf(gw - 2), 0);
  for (const r of [fight, loot]) { r.side = true; r.wing = true; r.from = wingFrom; }
  for (const r of Object.values(rooms)) for (let y = r.ry * DSY + 1; y < r.ry * DSY + DSY; y++) for (let x = r.rx * DSX + 1; x < r.rx * DSX + DSX; x++) L.set(x, y, TL.CFLOOR);
  const heat = (r) => (r.side ? main.indexOf(r.from) : main.indexOf(r)) / (gw - 1); // 0 at the way in, 1 at the frontier
  // doors: along the run (a little up or down so it isn't a perfect straight line), and up or down into the side rooms
  for (let i = 0; i < gw - 1; i++) { const a = main[i], b = main[i + 1]; const x = Math.max(a.rx, b.rx) * DSX, c = DSY + 4 + rnd.range(-1, 1); for (let y = c - 1; y <= c + 1; y++) L.set(x, y, TL.CFLOOR); a.links[b.id] = b.links[a.id] = 1; a.children.push(b); }
  for (const r of sides) { const y = r.ry === 0 ? DSY : 2 * DSY; for (let x = r.rx * DSX + 5; x <= r.rx * DSX + 7; x++) L.set(x, y, TL.CFLOOR); r.links[r.from.id] = r.from.links[r.id] = 1; }
  // the two wing cells are ONE big arena: the wall between them is gone (the wyrms used to get stuck in a doorway there).
  // The loot cell folds into the fight room (room.mergeInto; dungeonRoomAt follows it), and the fight room spans both cells
  // (room.cx0 = its left column, room.cw = 2 cells wide; roomBounds uses them).
  { const x = Math.max(fight.rx, loot.rx) * DSX; for (let y = 1; y < DSY; y++) L.set(x, y, TL.CFLOOR); fight.links[loot.id] = loot.links[fight.id] = 1; fight.links[wingFrom.id] = wingFrom.links[fight.id] = 1;
    loot.mergeInto = fight.id; fight.cx0 = Math.min(fight.rx, loot.rx); fight.cw = 2; }
  // the look, room by room
  for (const r of Object.values(rooms)) {
    const t = heat(r), x0 = r.rx * DSX, y0 = r.ry * DSY;
    const lane = (x, y) => (r.side ? x >= x0 + 4 && x <= x0 + 8 : y >= y0 + 3 && y <= y0 + 5); // keep the way through clear
    if (!r.side && rnd() < 0.6) for (let k = 0; k < 2 + rnd.int(3); k++) { const x = x0 + 2 + rnd.int(9), y = y0 + (rnd() < 0.5 ? 2 : 6); if (!lane(x, y)) L.set(x, y, TL.CWALL); } // a few rocks
    for (let y = y0; y <= y0 + DSY; y++) for (let x = x0; x <= x0 + DSX; x++) {
      const i = L.idx(x, y); const tile = L.tiles[i];
      if (tile === TL.CWALL) { if (rnd() < t * 1.1 - 0.05) L.tiles[i] = snow ? TL.ICEWALL : TL.BASALT; continue; }
      if (tile !== TL.CFLOOR) continue;
      if (rnd() < t * 0.8 - 0.1) L.tiles[i] = snow ? TL.SNOW : TL.ASH;
    }
    if (t > 0.45 && !r.side) { // ice sheets / lava pools, off the path
      const n = 1 + Math.floor(t * 3); for (let k = 0; k < n; k++) { const x = x0 + 2 + rnd.int(8), y = y0 + (rnd() < 0.5 ? 1 : 6);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const xx = x + dx, yy = y + dy; if (L.get(xx, yy) === TL.CFLOOR || L.get(xx, yy) === TL.SNOW || L.get(xx, yy) === TL.ASH) { if (!lane(xx, yy) && (snow || dx + dy < 2)) L.set(xx, yy, snow ? TL.ICE : TL.LAVA); } } }
    }
  }
  // who lives where: cave foes near the way in, the frontier's own deeper in. The two end rooms are quiet.
  // bats and armored skeletons (never plain ones: armor 1-3 at random) near the way in, the frontier's own deeper in
  const early = ['bat', 'bat', 'skeleton_a1', 'skeleton_a2', 'skeleton_a3'], late = snow ? ['frostling', 'frostling', 'snowwolf'] : ['cinderling', 'cinderling', 'magmite'];
  for (const r of Object.values(rooms)) r.heat = heat(r);
  main.forEach((r, i) => { const t = heat(r); r.tier = 2 + Math.round(t); if (i === 0 || i === gw - 1) return; const n = 2 + rnd.int(2); for (let k = 0; k < n; k++) r.enemies.push(rnd.pick(rnd() < t ? late : early)); });
  // the miniboss: two wyrmlings at once (Mossy Hollow's frost pair on the cold road, Emberforge's magma pair on the ember road),
  // two rooms before the far end. Beat them for a heart piece.
  // Positions below are from the fight cell's corner (room.rx * DSX), so `ax` turns arena coordinates (0 = the arena's left wall) into those.
  const ax = (x) => (fight.cx0 - fight.rx) * DSX + x; // the arena is 25 tiles across (floor 1-23), 9 tall (floor 1-7)
  const mb = fight; mb.enemies = snow ? ['wyrm_elder_frost', 'wyrm_elder_frost'] : ['wyrm_elder', 'wyrm_elder']; mb.miniboss = true; mb.at = [[ax(4.5), 4.5], [ax(20.5), 4.5]]; // elder wyrmlings (enemies/wyrm.js), one at each end of the arena
  // the real prize only shows up once BOTH are dead (so nobody can grab it, die, and walk off): a heart piece, a scroll worth
  // the trouble (Loaded Shot 2 on the cold road, the Great Quiver on the ember road) and a fat purse, in the middle
  mb.rewardAt = [ax(12.5), 4.5]; mb.rewards = [['hpiece', 0], [snow ? 'tripleshot' : 'quiver50', -1.5], ['gems100', 1.5]];
  // THE BAIT: gems in all four corners and a heart behind each wyrm. Take some from BOTH ends while they live and they
  // both fly into a rage (game/sim.js baitTaken, enemies/wyrm.js 'enraged'): a much harder fight. One end is safe.
  mb.stash = [[1.5, 1.5, 'a', 'gems50'], [1.5, 7.5, 'a', 'gems50'], [1.5, 4.5, 'a', 'heart'], [23.5, 1.5, 'b', 'gems50'], [23.5, 7.5, 'b', 'gems50'], [23.5, 4.5, 'b', 'heart']].map(([x, y, bait, item]) => ({ item, x: ax(x), y, bait }));
  mb.legacyTk = [[loot.id + ':stash0', fight.id + ':' + (snow ? 'tripleshot' : 'quiver50')], [loot.id + ':stash1', fight.id + ':gems100']]; // saves from before the arena was merged
  loot.tier = 3;
  for (const r of sides) { if (r.wing) continue; const t = heat(r); r.tier = 2 + Math.round(t); r.reward = rnd.pick(['gems30', 'heart', 'bomb', 'gems50', 'arrows']); for (let k = 0; k < 2; k++) r.enemies.push(rnd.pick(rnd() < t ? late : early)); }
  L.rooms = rooms; L.startRoom = main[0];
  // the twin-eye gate into the secret wing: the gate in the middle of the wall, an eye three steps to each side (gimmicks/twingate.js)
  { const x0 = wingFrom.rx * DSX, y = DSY; const gate = L.idx(x0 + 6, y), eyes = [L.idx(x0 + 3, y), L.idx(x0 + 9, y)];
    L.tiles[gate] = TL.TWINGATE; for (const i of eyes) L.tiles[i] = TL.EYE; L.eyeLinks = L.eyeLinks || {}; for (const i of eyes) L.eyeLinks[i] = { kind: 'twin', gate };
    L.twinGates = [{ gate, eyes, openTo: TL.CFLOOR }];
    const si = L.idx(x0 + 1, DSY + 1); L.props[si] = PR.SIGN; L.signText[si] = 'THE GATE OPENS ONLY WHEN IT IS NOT SEEN.'; }
  // the ends: an archway out at each end, with the step in front of it
  const endAt = (r, frontier) => { const outward = (frontier ? (snow ? -1 : 1) : (snow ? 1 : -1)); const x = outward < 0 ? r.rx * DSX : (r.rx + 1) * DSX; const y = DSY + 4; L.set(x, y, TL.CEXIT); L.set(x - outward, y, TL.EXIT); return { x: x - outward, y, inX: x - outward * 2 + 0.5, a: outward < 0 ? 0 : Math.PI }; };
  const inEnd = endAt(main[0], false), outEnd = endAt(main[gw - 1], true);
  L.spawn = { x: inEnd.inX, y: inEnd.y + 0.5, a: inEnd.a };
  L.sign = null; const signAt = (r, text) => { const si = L.idx(r.rx * DSX + 6, DSY + 2); L.props[si] = PR.SIGN; L.signText[si] = text; };
  // the old wall the road runs under (content/grottos.js has the talk about it)
  { const r = main[1]; const si = L.idx(r.rx * DSX + 6, DSY + 1); if (!TINFO[L.tiles[si]].solid) { L.props[si] = PR.SIGN; L.signText[si] = 'A CARVED STONE: WARDHOLD OF THE ' + (snow ? 'WEST' : 'EAST') + ' GATE. NO FIRE SHALL CROSS. UNDER IT, SCRATCHED BY ANOTHER HAND: IT WASN\'T THE FIRE WE SHOULD HAVE WATCHED.'; } }
  signAt(main[0], snow ? 'THE COLD ROAD. RIMEFANG HOLLOW AND THE FROZEN REACH LIE AT ITS FAR END. THE DEEPER YOU GO, THE COLDER IT GETS.' : 'THE EMBER ROAD. THE CINDER WASTES LIE AT ITS FAR END. THE DEEPER YOU GO, THE HOTTER IT GETS.');
  // close the old open pass and put a cave mouth on each side of it
  const bx = Math.max(ps.fx, ps.inner) * RSX; const wallT = snow ? TL.PEAKS : TL.FIREPEAKS; const dirIn = ps.inner > ps.fx ? 1 : -1;
  for (let y = ps.ry * RSY + 1; y < ps.ry * RSY + RSY; y++) if (!TINFO[OW.get(bx, y)].solid) OW.set(bx, y, wallT);
  for (const r of OW.regions) if (r.rx === ps.inner || r.rx === ps.fx) r.doors = r.doors.filter(([x, y]) => !(Math.abs(x - bx) <= 1 && Math.floor(y / RSY) === ps.ry));
  const mouth = (side, y0) => { // side: +1 into the main land, -1 into the frontier; returns where you stand in front of it
    let y = y0; for (let k = 0; k < 4 && OW.portals[OW.idx(bx + side, y)]; k++) y++;
    const mx = bx + side; OW.set(mx, y, TL.CAVE); OW.set(mx, y - 1, wallT); OW.set(mx, y + 1, wallT);
    const fx = mx + side; if (TINFO[OW.get(fx, y)].solid) OW.set(fx, y, snow ? TL.SNOW : TL.ASH); OW.props[OW.idx(fx, y)] = 0;
    return { idx: OW.idx(mx, y), x: fx + 0.5, y: y + 0.5, a: side > 0 ? 0 : Math.PI };
  };
  const mIn = mouth(dirIn, ps.ry * RSY + 3), mOut = mouth(-dirIn, ps.ry * RSY + 6);
  OW.portals[mIn.idx] = { to: L.id, at: { x: L.spawn.x, y: L.spawn.y, a: L.spawn.a } };
  OW.portals[mOut.idx] = { to: L.id, at: { x: outEnd.inX, y: outEnd.y + 0.5, a: outEnd.a } };
  L.exits = [{ x: inEnd.x, y: inEnd.y, to: { lvl: 'ow', x: mIn.x, y: mIn.y, a: mIn.a } }, { x: outEnd.x, y: outEnd.y, to: { lvl: 'ow', x: mOut.x, y: mOut.y, a: mOut.a } }];
  L.exit = L.exits[0].to;
  ps.tunnel = L.id; ps.mouths = [mIn, mOut];
  // make sure you can walk from each mouth into its land: if rocks or trees box the front in, carve a way to the region's first door
  for (const [m, rx] of [[mIn, ps.inner], [mOut, ps.fx]]) {
    const r = OW.regions[ps.ry * RW + rx]; if (!r || !r.doors.length) continue; const { x0, y0, x1, y1 } = regionInterior(r); const [sx, sy] = r.doors[0], tx = Math.floor(m.x), ty = Math.floor(m.y);
    const seen = new Set([sx + ',' + sy]); const q = [[sx, sy]]; let ok = false;
    while (q.length && !ok) { const [x, y] = q.shift(); if (x === tx && y === ty) { ok = true; break; } for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1) continue; const k = nx + ',' + ny; if (seen.has(k) || OW.solidAt(nx + 0.5, ny + 0.5)) continue; seen.add(k); q.push([nx, ny]); } }
    if (!ok) carve(OW, tx, ty, sx, sy, x0, y0, x1, y1);
  }
}

// ---------- DEBUG TEST ZONE ----------
// One open hall with a strip of every hazard, an eye-drained moat, a sealed eye, a bomb wall and vents, plus open floor
// for the debug enemy spawner. Only dev names can warp here (pause menu > TEST ZONE). Fixed layout, no randomness.
function genTestZone(W) {
  const w = 36, h = 23; const L = new Level('dbg', 'cave', w, h); W.levels.dbg = L; L.theme = 'd3'; L.signText = {};
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) L.set(x, y, (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? TL.BRICK : TL.DFLOOR);
  const fill = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) L.set(x, y, t); };
  const sign = (x, y, text) => { L.props[L.idx(x, y)] = PR.SIGN; L.signText[L.idx(x, y)] = text; };
  // top row: a strip of every floor hazard, each with a sign under it
  const strips = [[2, 7, 'WATER', 'DEEP FRESH WATER. FROST ARROWS FREEZE IT; FROGS HIDE IN IT.'], [9, 11, 'SHALLOW', 'SHALLOW WATER: 25% SLOWER.'], [13, 15, 'ICE', 'ICE: SLIPPERY, AND HITS SHOVE FOES FURTHER.'],
    [17, 19, 'LAVA', 'LAVA: BURNS HEROES AND WALKING FOES.'], [21, 23, 'SPIKES', 'ICE SPIKES: THEY HURT.'], [25, 27, 'PIT', 'A PIT: FALL IN, LOSE A HEART.'], [29, 33, 'GLASS', 'GLASS: CRACKS IF YOU STAND STILL.']];
  for (const [x0, x1, t, text] of strips) { fill(x0, 2, x1, 6, TL[t]); sign(Math.floor((x0 + x1) / 2), 8, text); }
  // middle row: a moat the eye drains, a sealed eye that opens a closet, a bomb wall, vents
  const cells = []; for (let y = 11; y <= 15; y++) for (let x = 3; x <= 9; x++) if (!(x >= 5 && x <= 7 && y >= 12 && y <= 14)) cells.push(L.idx(x, y));
  for (const i of cells) L.tiles[i] = TL.WATER; L.set(6, 10, TL.EYE);
  L.rigs = { tz: { cells, eyes: [L.idx(6, 10)] } }; L.eyeLinks = { [L.idx(6, 10)]: { kind: 'timed', rid: 'tz' } }; sign(11, 13, 'AN EYE: SHOOT IT TO DRAIN THE MOAT FOR A WHILE. A BOMB ARROW SEALS IT FOR GOOD.');
  fill(14, 11, 18, 15, TL.BRICK); fill(15, 12, 17, 14, TL.DFLOOR); L.set(14, 13, TL.BRICK); L.set(13, 11, TL.EYE_SMALL);
  L.eyeLinks[L.idx(13, 11)] = { kind: 'seal', opens: [L.idx(14, 13)], openTo: TL.DFLOOR, text: 'A HIDDEN WAY OPENS.' }; sign(12, 14, 'A SMALL EYE IN THE CORNER OPENS THE CLOSET.');
  fill(21, 11, 21, 15, TL.BRICK); L.set(21, 13, TL.BRICK_BOMB); sign(20, 16, 'A BOMBABLE WALL (TRY A BOMB ARROW).');
  for (let y = 11; y <= 15; y++) for (let x = 24; x <= 32; x++) if ((x + y) % 2 === 0) L.set(x, y, TL.VENT); sign(28, 16, 'VENTS BLOW ON A 3 SECOND BEAT.');
  // the open floor below is for spawning foes (pause > debug > SPAWN)
  sign(18, 18, 'OPEN FLOOR: SPAWN FOES HERE FROM THE PAUSE MENU (DEBUG).');
  // a row of breakables (pommel strike: Shift + hold attack, let go); they grow back
  L.gourds = {}; [['GOURD', 3], ['CORAL', 5], ['SLAG', 7], ['BONEPILE', 9], ['CRYSTAL', 11]].forEach(([n, x]) => { if (PR[n] == null) return; const i = L.idx(x, 19); L.props[i] = PR[n]; L.gourds[i] = PR[n]; });
  L.dummies = [['dummy', 13.5, 17.5], ['dummy_armored', 15.5, 17.5]]; sign(14, 19, 'TRAINING DUMMIES: EVERY HIT SHOWS ITS DAMAGE AND THE RUNNING TOTAL. THEY HEAL AFTER 3 SECONDS. THE RIGHT ONE WEARS FULL ARMOR.');
  sign(7, 21, 'GOURDS AND THE LIKE: ONLY A POMMEL STRIKE (SHIFT + HOLD ATTACK, THEN LET GO) SPLITS THEM.');
  // bottom right: a flight of steps up onto a ledge a full tile high (content/elevation.js). The room is two tiles tall,
  // so the Gale Cloak lifts you a level in here too.
  L.ceilH = 2;
  fill(25, 18, 25, 21, TL.STEP1); fill(26, 18, 26, 21, TL.STEP2); fill(27, 18, 27, 21, TL.STEP3); fill(28, 17, 33, 21, TL.LEDGE);
  sign(24, 17, 'STEPS AND A LEDGE: CLIMB UP, LOOK DOWN, STEP OFF. THIS ROOM IS TWO TALL, SO THE GALE CLOAK CARRIES YOU UP A LEVEL HERE.');
  L.set(18, h - 1, TL.CEXIT); L.set(18, h - 2, TL.EXIT); L.spawn = { x: 18.5, y: h - 3.5, a: -Math.PI / 2 };
  const ow = W.levels.ow; L.exit = { lvl: 'ow', x: ow.spawn.x, y: ow.spawn.y, a: ow.spawn.a };
  L.gimmicks = ['glass', 'vents'];
}

// ---------- OVERWORLD ----------
function genOverworld(W, rnd) {
  const w = RW * RSX + 1, h = RH * RSY + 1;
  const L = new Level('ow', 'ow', w, h); W.levels.ow = L; L.regions = [];
  // biomes: by coarse noise + position bias
  // start near the middle of the map, so every direction has something to find
  const startR = { x: Math.floor(RW / 2) - (rnd() < 0.5 ? 1 : 0), y: Math.floor(RH / 2) };
  const bn = []; for (let i = 0; i < 4; i++) bn.push(rnd());
  for (let ry = 0; ry < RH; ry++) for (let rx = 0; rx < RW; rx++) {
    let b;
    const v = Math.sin(rx * 0.9 + bn[0] * 6) + Math.cos(ry * 1.1 + bn[1] * 6) + (rnd() - 0.5) * 0.9;
    if (FRONTIER[rx]) b = FRONTIER[rx];
    else if ((rx === 1 || rx === RW - 2) && rnd() < 0.45) b = 'mountain'; // foothills of the edge ranges
    else if (ry === 0 && rnd() < 0.5) b = 'forest'; // the edge of the great wood
    else if (v > 1.0) b = 'forest'; else if (v < -1.1) b = 'lake'; else if (rx >= RW - 3 && ry >= 3 && rnd() < 0.6) b = 'desert';
    else if (rx <= 2 && ry >= 2 && ry <= 4 && rnd() < 0.5) b = 'graveyard'; else b = rnd() < 0.55 ? 'plains' : rnd() < 0.5 ? 'forest' : 'desert';
    if (rx === startR.x && ry === startR.y) b = 'plains';
    L.regions.push({ rx, ry, biome: b, enemies: [], tier: 0, features: [] });
  }
  const R = (rx, ry) => L.regions[ry * RW + rx];
  // fill base
  for (let i = 0; i < w * h; i++) L.tiles[i] = TL.GRASS;
  // connectivity: spanning tree via randomized DFS + extras
  const edges = {}; const ek = (a, b) => a < b ? a + ',' + b : b + ',' + a;
  const seen = new Set(); const stack = [startR.y * RW + startR.x]; seen.add(stack[0]);
  while (stack.length) {
    const cur = stack[stack.length - 1]; const cx = cur % RW, cy = Math.floor(cur / RW);
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < RW && y < RH && !FRONTIER[x] && !seen.has(y * RW + x));
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny] = rnd.pick(nb); const ni = ny * RW + nx; seen.add(ni); edges[ek(cur, ni)] = 1; stack.push(ni);
  }
  for (let ry = 0; ry < RH; ry++) for (let rx = 0; rx < RW; rx++) {
    const i = ry * RW + rx;
    if (FRONTIER[rx]) { if (ry < RH - 1) edges[ek(i, i + RW)] = 1; continue; } // the frontier lands are open north-south
    if (rx < RW - 1 && !FRONTIER[rx + 1] && rnd() < 0.35) edges[ek(i, i + 1)] = 1;
    if (ry < RH - 1 && rnd() < 0.35) edges[ek(i, i + RW)] = 1;
  }
  // one mountain pass into each frontier land
  L.passes = {};
  for (const fx of [0, RW - 1]) { const ry = rnd.range(1, RH - 2); const inner = fx === 0 ? 1 : RW - 2; edges[ek(ry * RW + fx, ry * RW + inner)] = 1; L.passes[FRONTIER[fx]] = { ry, fx, inner }; }
  L.edges = edges;
  // region distances from start (for difficulty)
  const dist = new Array(RW * RH).fill(99); dist[startR.y * RW + startR.x] = 0; const q = [startR.y * RW + startR.x];
  while (q.length) { const c = q.shift(); const cx = c % RW, cy = Math.floor(c / RW); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= RW || ny >= RH) continue; const n = ny * RW + nx; if (edges[ek(c, n)] && dist[n] > dist[c] + 1) { dist[n] = dist[c] + 1; q.push(n); } } }
  L.regions.forEach((r, i) => { r.dist = dist[i]; r.tier = FRONTIER[r.rx] ? 3 : Math.min(3, Math.floor(dist[i] / 3)); });
  // borders
  const front = (b) => b === 'snow' || b === 'ash';
  const borderTile = (b1, b2) => (b1 === 'snow' && b2 === 'snow') ? TL.ICEWALL : (b1 === 'ash' && b2 === 'ash') ? TL.BASALT
    : (b1 === 'snow' || b2 === 'snow') ? TL.PEAKS : (b1 === 'ash' || b2 === 'ash') ? TL.FIREPEAKS
    : (b1 === 'mountain' || b2 === 'mountain') ? TL.ROCK : (b1 === 'lake' && b2 === 'lake') ? TL.WATER : (b1 === 'desert' && b2 === 'desert') ? TL.ROCK : TL.TREEWALL;
  for (let ry = 0; ry <= RH; ry++) for (let x = 0; x < w; x++) {
    const y = ry * RSY; const rx = Math.min(RW - 1, Math.floor(x / RSX));
    const a = ry > 0 ? R(rx, ry - 1).biome : 'mountain', b = ry < RH ? R(rx, ry).biome : 'mountain';
    L.set(x, y, (ry === 0 || ry === RH) ? (a === 'lake' || b === 'lake' ? TL.ROCK : borderTile(a, b)) : borderTile(a, b));
  }
  for (let rx = 0; rx <= RW; rx++) for (let y = 0; y < h; y++) {
    const x = rx * RSX; const ry = Math.min(RH - 1, Math.floor(y / RSY));
    const a = rx > 0 ? R(rx - 1, ry).biome : 'mountain', b = rx < RW ? R(rx, ry).biome : 'mountain';
    if (y % RSY === 0) continue;
    L.set(x, y, borderTile(a, b));
  }
  // the edges of the Wilds: the great wood (north), granite peaks (west), fire peaks (east), the sea (south)
  for (let x = 0; x < w; x++) { const fb = FRONTIER[Math.min(RW - 1, Math.floor(x / RSX))]; L.set(x, 0, fb === 'snow' ? TL.PEAKS : fb === 'ash' ? TL.FIREPEAKS : TL.BIGWOOD); L.set(x, h - 1, TL.OCEAN); }
  for (let y = 1; y < h - 1; y++) { L.set(0, y, TL.PEAKS); L.set(w - 1, y, TL.FIREPEAKS); }
  // interiors
  for (const reg of L.regions) fillRegion(L, reg, rnd);
  // a beach along the sea
  for (let x = 1; x < w - 1; x++) { const t = L.get(x, h - 2); if (t === TL.GRASS || t === TL.FLOWERS || t === TL.PATH) L.set(x, h - 2, TL.SAND); }
  // openings
  const openings = []; // per region list of door points (inside tile)
  L.regions.forEach(r => r.doors = []);
  for (const k in edges) {
    const [a, b] = k.split(',').map(Number); const ax = a % RW, ay = Math.floor(a / RW), bx = b % RW, by = Math.floor(b / RW);
    const ra = R(ax, ay), rb = R(bx, by);
    const floorT = (ra.biome === 'snow' || rb.biome === 'snow') ? TL.SNOW : (ra.biome === 'ash' || rb.biome === 'ash') ? TL.ASH : (ra.biome === 'desert' || rb.biome === 'desert') ? TL.SAND : TL.PATH;
    if (ay === by) { // horizontal neighbor: shared vertical wall at x = bx*RSX
      const x = bx * RSX; const wid = rnd.range(2, 3); const y0 = ay * RSY + rnd.range(2, RSY - 2 - wid);
      for (let y = y0; y < y0 + wid; y++) { L.set(x, y, floorT); clearAround(L, x - 1, y, baseTile(ra.biome)); clearAround(L, x + 1, y, baseTile(rb.biome)); }
      ra.doors.push([x - 1, y0 + 1]); rb.doors.push([x + 1, y0 + 1]);
    } else {
      const y = by * RSY; const wid = rnd.range(2, 4); const x0 = ax * RSX + rnd.range(2, RSX - 2 - wid);
      for (let x = x0; x < x0 + wid; x++) { L.set(x, y, floorT); clearAround(L, x, y - 1, baseTile(ra.biome)); clearAround(L, x, y + 1, baseTile(rb.biome)); }
      ra.doors.push([x0 + 1, y - 1]); rb.doors.push([x0 + 1, y + 1]);
    }
  }
  // features: dungeons, caves
  const sr = R(startR.x, startR.y);
  const regionCenter = (r) => [r.rx * RSX + 8, r.ry * RSY + 5];
  // start cave (sword)
  placeCave(W, L, sr, rnd, 'sword0', 'open');
  const sc = sr.features[0];
  L.spawn = sc ? { x: sc.x + 0.5, y: Math.min(sr.ry * RSY + RSY - 0.6, sc.y + 3.5), a: -Math.PI / 2 } : { x: sr.rx * RSX + 8.5, y: sr.ry * RSY + 8.5, a: -Math.PI / 2 };
  // dungeon placement: sort regions by distance
  const cand = L.regions.filter(r => r !== sr && !FRONTIER[r.rx]).sort((a, b) => a.dist - b.dist || rnd() - 0.5);
  const used = new Set([sr]);
  const maxD = Math.max(...L.regions.map(r => r.dist));
  for (let d = 1; d <= 9; d++) {
    let target = d === 9 ? maxD : Math.round(1 + (d - 1) * (maxD - 1) / 8);
    let best = null, bestScore = 1e9;
    for (const r of cand) {
      if (used.has(r) || (r.biome === 'lake' && d !== 7)) continue;
      let near = 0; for (const u of used) if (Math.abs(u.rx - r.rx) + Math.abs(u.ry - r.ry) <= 1) near = 1;
      const sc = Math.abs(r.dist - target) * 3 + near * 5 + rnd() - (d === 7 && r.biome === 'lake' ? 3 : 0);
      if (sc < bestScore) { bestScore = sc; best = r; }
    }
    if (!best) best = cand.find(r => !used.has(r));
    used.add(best);
    placeGate(W, L, best, rnd, d, d === 7 ? makeIsland(L, best, rnd) : null);
  }
  // optional dungeons: one deep in each frontier land, far from its pass; the Hearth on the edge of the great wood
  for (const [d, biome] of [[10, 'snow'], [11, 'ash']]) {
    if (!Content.dungeons[d]) continue; const ps = L.passes[biome];
    const r = L.regions.filter(r => r.rx === ps.fx).sort((a, b) => Math.abs(b.ry - ps.ry) - Math.abs(a.ry - ps.ry))[0];
    used.add(r); placeGate(W, L, r, rnd, d);
  }
  if (Content.dungeons[12]) {
    const r = L.regions.filter(r => !used.has(r) && !FRONTIER[r.rx] && r.biome !== 'lake').sort((a, b) => a.ry - b.ry || Math.abs(a.rx - RW / 2) - Math.abs(b.rx - RW / 2))[0];
    if (r) { used.add(r); placeGate(W, L, r, rnd, 12); }
  }
  // caves: shops, gifts, hearts, secrets, dojo
  const caveKinds = CAVE_MIX;
  const free = rnd.shuffle(L.regions.filter(r => !used.has(r) && r.biome !== 'lake' && !FRONTIER[r.rx]));
  let fi = 0;
  for (const kind of caveKinds) {
    const r = free[fi++ % free.length];
    if (r.features.length >= 2) continue;
    const secret = SECRET_CAVES.includes(kind) ? (rnd() < 0.5 && r.biome !== 'forest' ? 'bomb' : (r.biome === 'forest' || r.biome === 'plains') ? 'bush' : 'bomb') : 'open';
    placeCave(W, L, r, rnd, kind, secret);
  }
  // a hermit's cave just inside each pass, with advice about what lies ahead
  for (const [biome, kind] of [['snow', 'frosthint'], ['ash', 'firehint']]) { const ps = L.passes[biome]; if (Content.caves[kind]) placeCave(W, L, R(ps.fx, ps.ry), rnd, kind, 'open'); }
  // enemies
  for (const r of L.regions) {
    if (r === sr) continue;
    const pool = enemiesFor('biomes', r.biome); const n = 2 + r.tier + rnd.int(3);
    for (let i = 0; i < n; i++) r.enemies.push(rnd.pick(pool));
  }
  // signs near start
  L.signText = L.signText || {}; // (the lake island's sign is already in here)
  const sx = sr.rx * RSX + 5, sy = sr.ry * RSY + 7; if (!TINFO[L.get(sx, sy)].solid) { L.props[L.idx(sx, sy)] = PR.SIGN; L.signText[L.idx(sx, sy)] = 'NINE DUNGEONS. EIGHT EMBER SHARDS. ONE HOLLOW CROWN. THE NUMBERED GATES GROW DEADLIER THE FARTHER YOU ROAM.'; }
  // signposts at the passes
  for (const [biome, txt] of [['snow', 'RIMEFANG PASS. BEYOND LIES THE FROZEN REACH, WHERE THE MOTHER OF WYRMS SLEEPS. MIND THE ICE.'], ['ash', 'CINDER PASS. BEYOND LIES THE CINDER WASTES, WHERE THE FATHER OF WYRMS BROODS. THE GROUND ITSELF BURNS.']]) {
    const ps = L.passes[biome]; const r = R(ps.inner, ps.ry); const d = r.doors.find(([x]) => biome === 'snow' ? x === r.rx * RSX + 1 : x === (r.rx + 1) * RSX - 1); if (!d) continue;
    const sx = biome === 'snow' ? d[0] + 2 : d[0] - 2, sy = d[1] - 2; if (!TINFO[L.get(sx, sy)].solid && !TINFO[L.get(sx, sy)].portal) { L.props[L.idx(sx, sy)] = PR.SIGN; L.signText[L.idx(sx, sy)] = txt; }
  }
  // ensure connectivity per region from doors
  for (const r of L.regions) connectRegion(L, r);
  // clear spawn
  { const sx = Math.floor(L.spawn.x), sy = Math.floor(L.spawn.y); for (let y = sy - 2; y <= sy; y++) { const i = L.idx(sx, y); if (!TINFO[L.tiles[i]].portal) { if (TINFO[L.tiles[i]].solid) L.tiles[i] = TL.PATH; L.props[i] = 0; } } }
  repairReach(L);
}
function repairReach(L) {
  for (let pass = 0; pass < 12; pass++) {
    const seen = new Uint8Array(L.w * L.h); const sx = Math.floor(L.spawn.x), sy = Math.floor(L.spawn.y); const q = [sx + sy * L.w]; seen[q[0]] = 1;
    while (q.length) { const i = q.pop(); const x = i % L.w, y = (i / L.w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= L.w - 1 || ny >= L.h - 1) continue; const j = nx + ny * L.w; if (seen[j] || L.solidAt(nx + 0.5, ny + 0.5)) continue; seen[j] = 1; q.push(j); } }
    const targets = []; for (const r of L.regions) { for (const d of r.doors) targets.push(d); if (!r.island) for (const e of (r.entryPoints || [])) targets.push(e); }
    const bad = targets.filter(([x, y]) => !seen[x + y * L.w]);
    if (!bad.length) return;
    for (const [tx, ty] of bad) {
      // cheapest path (walls cost more) from the target to anything reachable
      const N = L.w * L.h; const dist = new Float32Array(N).fill(1e9); const prev = new Int32Array(N).fill(-1); const st = tx + ty * L.w; dist[st] = 0;
      const open = [st]; let found = -1;
      while (open.length) {
        let bi = 0; for (let k = 1; k < open.length; k++) if (dist[open[k]] < dist[open[bi]]) bi = k; const i = open.splice(bi, 1)[0];
        if (seen[i]) { found = i; break; }
        const x = i % L.w, y = (i / L.w) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= L.w - 1 || ny >= L.h - 1) continue; const j = nx + ny * L.w; const ti = TINFO[L.tiles[j]];
          if (ti.portal || ti.bomb || L.secretReveal[j] || (L.noCarve && L.noCarve.has(j))) continue;
          const c = dist[i] + (L.solidAt(nx + 0.5, ny + 0.5) ? 6 : 1);
          if (c < dist[j]) { if (dist[j] >= 1e9) open.push(j); dist[j] = c; prev[j] = i; }
        }
      }
      let i = found; while (i >= 0) { const ti = TINFO[L.tiles[i]]; if (ti.solid) L.tiles[i] = ti.water ? TL.BRIDGE : TL.PATH; if (L.props[i] && L.props[i] !== PR.SIGN) L.props[i] = 0; i = prev[i]; }
    }
  }
}
function baseTile(biome) { return biome === 'desert' ? TL.SAND : biome === 'graveyard' ? TL.PATH : biome === 'snow' ? TL.SNOW : biome === 'ash' ? TL.ASH : TL.GRASS; }
function clearAround(L, x, y, base) { const i = L.idx(x, y); if (x <= 0 || y <= 0 || x >= L.w - 1 || y >= L.h - 1) return; if (TINFO[L.tiles[i]].solid && !TINFO[L.tiles[i]].portal) L.tiles[i] = base != null ? base : TL.GRASS; L.props[i] = 0; }
function regionInterior(r) { return { x0: r.rx * RSX + 1, y0: r.ry * RSY + 1, x1: r.rx * RSX + RSX, y1: r.ry * RSY + RSY }; }
function fillRegion(L, r, rnd) {
  const { x0, y0, x1, y1 } = regionInterior(r);
  const base = baseTile(r.biome);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { L.set(x, y, base); if (base === TL.GRASS && rnd() < 0.05) L.set(x, y, TL.FLOWERS); }
  const put = (x, y, p) => { if (x > x0 && y > y0 && x < x1 - 1 && y < y1 - 1) L.props[L.idx(x, y)] = p; };
  const cx = (x0 + x1) >> 1, cy = (y0 + y1) >> 1;
  switch (r.biome) {
    case 'plains': for (let i = 0; i < 7; i++) put(rnd.range(x0, x1), rnd.range(y0, y1), rnd.pick([PR.TREE, PR.BUSH, PR.BUSH, PR.BOULDER])); break;
    case 'forest': for (let i = 0; i < 20; i++) put(rnd.range(x0, x1), rnd.range(y0, y1), rnd.pick([PR.TREE, PR.PINE, PR.PINE, PR.BUSH])); break;
    case 'mountain': for (let i = 0; i < 4; i++) { const bx = rnd.range(x0 + 1, x1 - 3), by = rnd.range(y0 + 1, y1 - 3), bw = rnd.range(1, 3), bh = rnd.range(1, 2); for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) L.set(x, y, TL.ROCK); }
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (L.get(x, y) === TL.GRASS && rnd() < 0.5) L.set(x, y, TL.PATH);
      for (let i = 0; i < 6; i++) put(rnd.range(x0, x1), rnd.range(y0, y1), PR.BOULDER); break;
    case 'lake': {
      const rx = rnd.range(3, 5), ry = rnd.range(2, 3);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d < 1) L.set(x, y, TL.WATER); else if (d < 1.7) L.set(x, y, TL.SAND); }
      if (rnd() < 0.6) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) if (L.get(x, cy) === TL.WATER) L.set(x, cy, TL.BRIDGE);
      for (let i = 0; i < 3; i++) put(rnd.range(x0, x1), rnd.range(y0, y1), PR.TREE); break;
    }
    case 'desert': for (let i = 0; i < 8; i++) put(rnd.range(x0, x1), rnd.range(y0, y1), rnd.pick([PR.CACTUS, PR.CACTUS, PR.BOULDER])); break;
    case 'snow': { // snowfield: frozen ponds you slide across, snowy pines, drifts of rock
      for (let k = 0; k < 2; k++) { const px0 = rnd.range(x0 + 2, x1 - 5), py0 = rnd.range(y0 + 2, y1 - 4), rw = rnd.range(2, 3), rh = rnd.range(1, 2); for (let y = py0 - rh; y <= py0 + rh; y++) for (let x = px0 - rw; x <= px0 + rw; x++) if (((x - px0) / (rw + 0.5)) ** 2 + ((y - py0) / (rh + 0.5)) ** 2 < 1) L.set(x, y, TL.ICE); }
      for (let i = 0; i < 12; i++) { const x = rnd.range(x0, x1), y = rnd.range(y0, y1); if (L.get(x, y) !== TL.ICE) put(x, y, rnd.pick([PR.SNOWPINE, PR.SNOWPINE, PR.BOULDER])); }
      break;
    }
    case 'ash': { // cinder waste: lava rivulets with stepping stones, dead trees, basalt
      const vertical = rnd() < 0.5; const at = vertical ? rnd.range(x0 + 3, x1 - 4) : rnd.range(y0 + 3, y1 - 3);
      if (vertical) { for (let y = y0; y < y1; y++) { const x = at + Math.round(Math.sin(y * 0.7) * 1.2); L.set(x, y, TL.LAVA); if (y % 4 === 1) L.set(x, y, TL.ASH); } }
      else { for (let x = x0; x < x1; x++) { const y = at + Math.round(Math.sin(x * 0.6) * 1.2); L.set(x, y, TL.LAVA); if (x % 4 === 1) L.set(x, y, TL.ASH); } }
      for (let i = 0; i < 9; i++) { const x = rnd.range(x0, x1), y = rnd.range(y0, y1); if (L.get(x, y) !== TL.LAVA) put(x, y, rnd.pick([PR.DEADTREE, PR.BOULDER, PR.BOULDER])); }
      break;
    }
    case 'graveyard': for (let gy = y0 + 2; gy < y1 - 1; gy += 2) for (let gx = x0 + 2; gx < x1 - 1; gx += 3) if (rnd() < 0.7) put(gx, gy, PR.GRAVE);
      put(x0 + 1, y0 + 1, PR.STATUE); put(x1 - 2, y0 + 1, PR.STATUE); break;
  }
}
function connectRegion(L, r) {
  if (r.island) return; // landings + raft, by design
  const { x0, y0, x1, y1 } = regionInterior(r);
  const pass = (x, y) => !L.solidAt(x, y);
  if (!r.doors.length) return;
  const targets = r.doors.slice(); if (r.entryPoints) targets.push(...r.entryPoints);
  const [sx, sy] = targets[0];
  if (!pass(sx, sy)) carve(L, sx, sy, sx, sy, x0, y0, x1, y1);
  for (let t = 1; t < targets.length; t++) {
    // BFS check reachability
    const seen = new Set([sx + ',' + sy]); const q = [[sx, sy]]; let ok = false; const [tx, ty] = targets[t];
    while (q.length) { const [x, y] = q.shift(); if (x === tx && y === ty) { ok = true; break; } for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1) continue; const k = nx + ',' + ny; if (seen.has(k) || !pass(nx, ny)) continue; seen.add(k); q.push([nx, ny]); } }
    if (!ok) carve(L, sx, sy, tx, ty, x0, y0, x1, y1);
  }
}
function carve(L, sx, sy, tx, ty, x0, y0, x1, y1) {
  let x = sx, y = sy;
  const clr = (x, y) => { if (x < x0 || y < y0 || x >= x1 || y >= y1) return; const i = L.idx(x, y); const ti = TINFO[L.tiles[i]]; if (ti.portal || ti.bomb || L.secretReveal[i] || (L.noCarve && L.noCarve.has(i))) return; if (ti.solid) L.tiles[i] = ti.water ? TL.BRIDGE : TL.PATH; if (L.props[i] && L.props[i] !== PR.SIGN) L.props[i] = 0; };
  while (x !== tx) { clr(x, y); x += Math.sign(tx - x); } while (y !== ty) { clr(x, y); y += Math.sign(ty - y); } clr(x, y);
}
// place a structure with a portal facing south; returns portal tile coords
function placeStructure(L, r, rnd, wallT, portalT, wide, at) {
  const { x0, y0, x1, y1 } = regionInterior(r);
  for (let tries = 0; tries < 300; tries++) {
    const px = at ? at[0] : rnd.range(x0 + 2, x1 - 3), py = at ? at[1] : rnd.range(y0 + 1, y1 - 4);
    let ok = true; if (at) tries = 300; // a fixed spot (the island) is used as is
    for (let y = py - 1; y <= py + 2 && ok; y++) for (let x = px - 2; x <= px + 2; x++) { const t = L.get(x, y); if (TINFO[t].portal || TINFO[t].bomb || L.props[L.idx(x, y)] === PR.SIGN || (r.taken && r.taken.has(x + ',' + y))) ok = false; }
    if (ok && r.doors && tries < 200) for (const [dx, dy] of r.doors) if (Math.abs(dx - px) <= 4 && dy >= py - 3 && dy <= py + 4) ok = false;
    if (!ok && !at) continue;
    r.taken = r.taken || new Set();
    for (let y = py - 1; y <= py + 2; y++) for (let x = px - 2; x <= px + 2; x++) r.taken.add(x + ',' + y);
    const half = wide ? 2 : 1;
    for (let x = px - half; x <= px + half; x++) { L.set(x, py, wallT); L.props[L.idx(x, py)] = 0; if (wide) { L.set(x, py - 1, wallT); L.props[L.idx(x, py - 1)] = 0; } }
    L.set(px, py, portalT);
    for (let x = px - half; x <= px + half; x++) { const i = L.idx(x, py + 1); if (TINFO[L.tiles[i]].solid) L.tiles[i] = TL.PATH; L.props[i] = 0; }
    const i2 = L.idx(px, py + 2); if (TINFO[L.tiles[i2]].solid) L.tiles[i2] = TL.PATH; L.props[i2] = 0;
    r.entryPoints = r.entryPoints || []; r.entryPoints.push([px, py + 1]);
    return [px, py];
  }
  return null;
}
function placeGate(W, L, r, rnd, d, at) {
  const sealed = d === 9 ? TL.SHARDGATE : d === 12 ? TL.HEARTHGATE : null;
  const p = placeStructure(L, r, rnd, sealed != null ? sealed : TL.BRICK, TL.GATE, true, at);
  if (!p) return;
  const [px, py] = p;
  if (sealed != null) L.set(px, py, sealed);
  // a tall tower behind the gate, in the dungeon's own colors, so you can spot it from far away
  L.towerTheme = L.towerTheme || {};
  for (let x = px - 2; x <= px + 2; x++) { L.set(x, py - 1, TL.TOWER); L.towerTheme[L.idx(x, py - 1)] = 'd' + d; }
  L.props[L.idx(px - 2, py + 1)] = PR.STATUE; L.props[L.idx(px + 2, py + 1)] = PR.STATUE;
  L.portals[L.idx(px, py)] = { to: 'd' + d };
  r.features.push({ type: 'dungeon', d, x: px, y: py });
  W.dungeons[d] = { x: px, y: py, region: r.ry * RW + r.rx };
  r.gate = d;
}
// Level 7 stands on an island in a lake: the whole region becomes water around a small island, with a sandy landing
// inside each way in. Only the raft (level 6) gets you across. The generator never bridges it (L.noCarve).
function makeIsland(L, r, rnd) {
  const { x0, y0, x1, y1 } = regionInterior(r); const cx = (x0 + x1) >> 1, cy = y0 + 4;
  L.noCarve = L.noCarve || new Set(); r.island = true; r.biome = 'lake';
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = L.idx(x, y); L.props[i] = 0; const d = ((x - cx) / 4.2) ** 2 + ((y - cy) / 2.3) ** 2;
    L.tiles[i] = d < 0.5 ? TL.GRASS : d < 1 ? TL.SAND : TL.WATER; L.noCarve.add(i);
  }
  // landings: a strip of sand along the edge at each way in, with open water between it and the island
  for (const [dx, dy] of r.doors) { const alongX = dy === y0 || dy === y1 - 1; for (let k = -1; k <= 1; k++) { const x = alongX ? dx + k : dx, y = alongX ? dy : dy + k; if (x >= x0 && y >= y0 && x < x1 && y < y1) L.set(x, y, TL.SAND); } }
  L.props[L.idx(cx - 3, cy + 1)] = PR.TREE; L.props[L.idx(cx + 3, cy + 1)] = PR.TREE;
  // a sign on the first landing
  const [lx, ly] = r.doors[0] || [x0 + 1, y0 + 1]; L.signText = L.signText || {};
  for (const [sx, sy] of [[lx + 1, ly], [lx - 1, ly], [lx, ly - 1], [lx, ly + 1]]) { const i = L.idx(sx, sy); if (sx >= x0 && sy >= y0 && sx < x1 && sy < y1 && L.tiles[i] === TL.SAND) { L.props[i] = PR.SIGN; L.signText[i] = 'LEVEL-7 STANDS ALONE IN THE LAKE. NO BRIDGE REACHES IT. ONLY A RAFT WILL CARRY YOU ACROSS.'; break; } }
  return [cx, cy - 1];
}
function placeCave(W, L, r, rnd, kind, secret) {
  const portalT = secret === 'bomb' ? TL.ROCK_BOMB : TL.CAVE;
  const p = placeStructure(L, r, rnd, TL.ROCK, secret === 'bush' ? TL.ROCK : portalT, false);
  if (!p) return;
  let [px, py] = p; const id = 'c' + (W.caveCount++);
  if (secret === 'open' && kind !== 'sword0') { const q = caveIntoWall(W, L, r, id, px, py); if (q) [px, py] = q; }
  if (secret === 'bush') {
    // hidden stairs under a bush in front
    const bx = px, by = py + 1; L.props[L.idx(bx, by)] = PR.BUSH;
    L.secretReveal[L.idx(bx, by)] = { tile: TL.STAIRS };
    L.portals[L.idx(bx, by)] = { to: id, stairs: true };
    r.entryPoints[r.entryPoints.length - 1] = [bx, by + 1];
    genCave(W, id, kind, { lvl: 'ow', x: bx + 0.5, y: by + 1.5, a: Math.PI / 2 }, rnd);
  } else {
    if (secret === 'bomb') L.secretReveal[L.idx(px, py)] = { tile: TL.CAVE };
    L.portals[L.idx(px, py)] = { to: id };
    genCave(W, id, kind, { lvl: 'ow', x: px + 0.5, y: py + 1.6, a: Math.PI / 2 }, rnd);
  }
  r.features.push({ type: 'cave', kind, id, x: px, y: py, secret });
}

// Some open caves are dug into the region's north wall (a cliff face) instead of standing alone in the field: about half,
// picked with their own random stream so the rest of the land doesn't move. The cave already placed (placeStructure) is
// taken down and rebuilt against the wall: a five-wide rock face with the cave in the middle, and the wall behind it made
// solid so it never opens through into the next region. Returns the new portal spot, or null to leave it where it was.
function caveIntoWall(W, L, r, id, px, py) {
  const alt = mulberry32(W.seed * 7 + hashStr(id) * 13); if (alt() < 0.5) return null;
  const { x0, y0, x1 } = regionInterior(r); const ny = y0; const nx = clamp(px, x0 + 3, x1 - 4);
  if (Math.abs(ny - py) < 2) return null; // already up against it
  if (r.doors.some(([dx, dy]) => Math.abs(dx - nx) <= 4 && dy <= ny + 1)) return null; // keep clear of a way in from the north
  for (let y = ny; y <= ny + 2; y++) for (let x = nx - 2; x <= nx + 2; x++) { const i = L.idx(x, y); const t = TINFO[L.tiles[i]]; if (t.portal || t.bomb || L.props[i] === PR.SIGN || L.secretReveal[i] || (L.noCarve && L.noCarve.has(i))) return null; }
  if (r.taken) for (let y = ny; y <= ny + 2; y++) for (let x = nx - 2; x <= nx + 2; x++) if (r.taken.has(x + ',' + y) && !(Math.abs(x - px) <= 2 && y >= py - 1 && y <= py + 2)) return null; // something else stands there
  // take the free-standing one down (its path can stay: a trail to nowhere is fine)
  const base = baseTile(r.biome); for (let x = px - 1; x <= px + 1; x++) { L.set(x, py, base); L.props[L.idx(x, py)] = 0; }
  delete L.portals[L.idx(px, py)];
  // the wall behind: solid, so the cave can't open into the region to the north
  for (let x = nx - 2; x <= nx + 2; x++) if (!TINFO[L.get(x, ny - 1)].solid) L.set(x, ny - 1, TL.ROCK);
  for (let x = nx - 2; x <= nx + 2; x++) { L.set(x, ny, TL.ROCK); L.props[L.idx(x, ny)] = 0; }
  L.set(nx, ny, TL.CAVE);
  for (let x = nx - 1; x <= nx + 1; x++) { const i = L.idx(x, ny + 1); if (TINFO[L.tiles[i]].solid) L.tiles[i] = TL.PATH; L.props[i] = 0; }
  { const i = L.idx(nx, ny + 2); if (TINFO[L.tiles[i]].solid) L.tiles[i] = TL.PATH; L.props[i] = 0; }
  r.taken = r.taken || new Set(); for (let y = ny; y <= ny + 2; y++) for (let x = nx - 2; x <= nx + 2; x++) r.taken.add(x + ',' + y);
  if (r.entryPoints && r.entryPoints.length) r.entryPoints[r.entryPoints.length - 1] = [nx, ny + 1];
  return [nx, ny];
}

// ---------- CAVES ----------
function genCave(W, id, kind, exit, rnd) {
  const w = 13, h = 9; const L = new Level(id, 'cave', w, h); W.levels[id] = L; L.caveKind = kind;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) L.set(x, y, (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? TL.CWALL : TL.CFLOOR);
  L.set(6, h - 1, TL.CEXIT); L.set(6, h - 2, TL.EXIT); // archway in the wall, and the step in front of it takes you out
  L.exit = exit; L.spawn = { x: 6.5, y: h - 2.6, a: -Math.PI / 2 };
  L.props[L.idx(3, 2)] = PR.FLAME; L.props[L.idx(9, 2)] = PR.FLAME;
  const c = Content.caves[kind]; if (!c) return;
  if (c.grotto) { // under a hollow tree (content/grottos.js): roots and moss, a rounder room, glowing caps instead of torches
    L.signText = {};
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1; const corner = (x <= 1 || x >= w - 2) && (y <= 1 || y >= h - 2); L.set(x, y, edge || corner ? TL.ROOTWALL : TL.MOSS); }
    L.set(6, h - 1, TL.ROOTEXIT); L.props[L.idx(3, 2)] = 0; L.props[L.idx(9, 2)] = 0;
    for (const [x, y] of [[2, 2], [10, 2], [2, 6], [10, 6], [4, 1]]) L.props[L.idx(x, y)] = PR.GLOWCAP;
    if (c.spring) for (let y = 3; y <= 5; y++) for (let x = 4; x <= 8; x++) if (!((x === 4 || x === 8) && (y === 3 || y === 5))) L.set(x, y, TL.SPRING);
    if (c.sign) { const si = L.idx(6, 1); L.props[si] = PR.SIGN; L.signText[si] = c.sign; }
    if (c.graves) for (const x of [4, 8]) L.props[L.idx(x, 2)] = PR.GRAVE; // the lament: two markers beside the mourner
  }
  for (const s of c.stock) {
    const item = Array.isArray(s.item) ? rnd.pick(s.item) : s.item; // a list means "one of these, chosen per world"
    L.shop.push({ x: s.x + 0.5, y: 4.5, item, price: s.price, gift: s.gift, needHearts: s.needHearts, unique: s.unique, choose: s.choose ? 'h' + id : undefined });
  }
  if (c.npc) L.npcs.push({ x: 6.5, y: 2.5, spr: c.npc, text: c.text || rnd.pick(c.lore && Content.lore ? Content.lore : Content.hints) }); // lore: a line of the land's passing talk (content/grottos.js)
}

// ---------- DUNGEONS ----------
function genDungeon(W, d, rnd) {
  const def = Content.dungeons[d] || {};
  const w = DGW * DSX + 1, h = DGH * DSY + 1; const L = new Level('d' + d, 'dungeon', w, h); W.levels['d' + d] = L; L.dnum = d; L.theme = 'd' + d;
  for (let i = 0; i < w * h; i++) L.tiles[i] = TL.BRICK;
  // ---- read the shape (roguelike runs may mirror it) ----
  let shape = (def.shape || ['S']).map(r => r.padEnd(DGW, '.'));
  const mirrored = W.mode === 'rogue' && rnd() < 0.5; if (mirrored) shape = shape.map(r => r.split('').reverse().join(''));
  const ox = 0, oy = DGH - shape.length; // shapes sit at the bottom of the 8x8 grid
  const cellAt = (x, y) => { const r = shape[y - oy]; return r ? (r[x - ox] || '.') : '.'; };
  const rooms = {}; const key = (x, y) => y * DGW + x; const order = [];
  const mk = (x, y, hidden) => { const r = { rx: x, ry: y, id: key(x, y), parent: null, children: [], depth: 0, enemies: [], links: {}, hidden: !!hidden }; rooms[r.id] = r; return r; };
  let start = null;
  for (let y = 0; y < DGH; y++) for (let x = 0; x < DGW; x++) { const c = cellAt(x, y); if (c === '#' || c === 'S') { const r = mk(x, y); if (c === 'S') start = r; } else if (c === 'H') mk(x, y, true); }
  const normal = (x, y) => { const r = rooms[key(x, y)]; return r && !r.hidden ? r : null; };
  // ---- random spanning tree over the shape, grown depth-first so paths wind ----
  start.depth = 0; order.push(start); const inTree = new Set([start.id]); const stack = [start];
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const nb = rnd.shuffle([[1, 0], [-1, 0], [0, -1], [0, 1]]).map(([dx, dy]) => normal(cur.rx + dx, cur.ry + dy)).filter(o => o && !inTree.has(o.id) && !(cur === start && o.ry > cur.ry));
    if (!nb.length) { stack.pop(); continue; }
    const o = nb[0]; o.parent = cur; o.depth = cur.depth + 1; cur.children.push(o); inTree.add(o.id); order.push(o); stack.push(o);
  }
  L.rooms = rooms; L.startRoom = start;
  // ---- optional hand-built opening (def.intro names a gimmick with an intro): the entrance and the one room after it,
  // which holds a key for a locked door onward. Only when the shape makes that a straight corridor (no way around the lock).
  let intro = null; const ig = def.intro && Content.gimmicks[def.intro];
  if (ig && ig.intro) {
    const nbs = (r) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => normal(r.rx + dx, r.ry + dy)).filter(Boolean);
    const r2 = start.children.length === 1 ? start.children[0] : null, r3 = r2 && r2.children.length === 1 ? r2.children[0] : null;
    if (r3 && order.length > 4 && nbs(start).length === 1 && nbs(r2).length === 2) { intro = { g: ig, r2, r3 }; r2.intro = true; }
  }
  for (const r of Object.values(rooms)) for (let y = r.ry * DSY + 1; y < r.ry * DSY + DSY; y++) for (let x = r.rx * DSX + 1; x < r.rx * DSX + DSX; x++) L.set(x, y, TL.DFLOOR);
  const doorPos = (a, b) => a.ry === b.ry ? [Math.max(a.rx, b.rx) * DSX, a.ry * DSY + 4] : [a.rx * DSX + 6, Math.max(a.ry, b.ry) * DSY];
  const doors = [];
  const setDoor = (a, b, t, tree) => { const [x, y] = doorPos(a, b); L.set(x, y, t); a.links[b.id] = t; b.links[a.id] = t; let dr = doors.find(q => q.x === x && q.y === y); if (!dr) doors.push(dr = { a, b, x, y, t, tree }); else dr.t = t; };
  for (const r of order) if (r.parent) setDoor(r.parent, r, TL.OPENDOOR, true);
  // extra loops between neighbors (some behind cracked walls)
  const loopChance = def.loops != null ? def.loops : 0.18;
  for (const r of order) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const o = normal(r.rx + dx, r.ry + dy); if (!o || o.parent === r || r.parent === o || (r === start && dy === 1)) continue;
    if (rnd() < loopChance) setDoor(r, o, rnd() < (def.bombLoops != null ? def.bombLoops : 0.5) ? TL.BRICK_BOMB : TL.OPENDOOR, false);
  }
  // ---- boss, treasure, locks, keys (every key reachable without opening a lock, so no softlocks) ----
  const sorted = order.slice().sort((a, b) => b.depth - a.depth);
  const boss = sorted[0]; boss.boss = bossFor(d);
  const leaves = order.filter(r => r !== boss && r !== start && r.children.length === 0).sort((a, b) => b.depth - a.depth);
  let itemRoom = leaves[0] || sorted[1];
  if (def.itemSpots) { // the treasure sits at one of these shape cells (the deepest one that isn't the boss), e.g. the tip of a trident prong
    const spots = def.itemSpots.map(([x, y]) => rooms[key(mirrored ? DGW - 1 - x : x, oy + y)]).filter(r => r && r !== boss && !r.hidden).sort((a, b) => b.depth - a.depth);
    if (spots.length) itemRoom = spots[0];
  }
  if (def.item && itemRoom) itemRoom.item = def.item;
  const locked = new Set([boss.id]);
  const lockN = Math.min(1 + Math.floor(d / 2), 5);
  const lockCand = rnd.shuffle(order.filter(r => r.depth >= 2 && r !== boss && r !== itemRoom && !(intro && (r === intro.r2 || r === intro.r3))));
  for (let i = 0; i < lockN - 1 && i < lockCand.length; i++) locked.add(lockCand[i].id);
  if (itemRoom && rnd() < 0.6 && !(intro && itemRoom === intro.r3)) locked.add(itemRoom.id);
  const reach = new Set(); { const st = [start]; while (st.length) { const r = st.pop(); if (reach.has(r.id)) continue; reach.add(r.id); for (const oid in r.links) { const o = rooms[oid]; if (locked.has(o.id) && o.parent === r) continue; if (locked.has(r.id) && r.parent === o) continue; st.push(o); } } }
  let lockList = [...locked].filter(id => !reach.has(id));
  const keySpots = rnd.shuffle(order.filter(r => reach.has(r.id) && r !== start && !r.item && !r.boss && !r.intro));
  while (lockList.length > keySpots.length) { const drop = lockList.find(id => id !== boss.id) || lockList[0]; lockList = lockList.filter(id => id !== drop); }
  // A powder gourd waits in the room before a wall you must bomb, a little to one side of it (content/gourds.js)
  const gourdBefore = (from, to) => { const dx = to.rx - from.rx, dy = to.ry - from.ry; (from.gourdAt = from.gourdAt || []).push(dx > 0 ? [8, 5] : dx < 0 ? [4, 5] : dy > 0 ? [5, 6] : [7, 2]); };
  if (def.noKeys) { // locks become cracked walls (bombs, not keys), and so does the way out of the entrance
    for (const id of [...locked]) { const r = rooms[id]; if (r.parent) { setDoor(r.parent, r, TL.BRICK_BOMB, true); gourdBefore(r.parent, r); } }
    const first = start.children[0]; if (first) { setDoor(start, first, TL.BRICK_BOMB, true); gourdBefore(start, first); start.tutorial = true; }
  } else {
    for (let i = 0; i < lockList.length; i++) keySpots[i].key = true;
    for (const id of lockList) { const r = rooms[id]; if (r.parent) setDoor(r.parent, r, TL.LOCKED, true); }
  }
  if (intro) setDoor(intro.r2, intro.r3, TL.LOCKED, true); // its key waits in the intro room itself, so the usual key rules still hold beyond it
  const mc = rnd.shuffle(order.filter(r => r !== start && !r.boss && !r.item && !r.intro));
  if (mc[0]) mc[0].map = true; if (mc[1]) mc[1].compass = true;
  // ---- hidden rooms: joined to one neighbor through a secret wall; each holds a heart piece and a lore tablet ----
  const secretEye = def.secret === 'EYE'; // a plain wall that a small eye elsewhere in the same wall opens (bombs do nothing)
  const secretT = secretEye ? TL.BRICK : TL[def.secret || 'BRICK_BOMB'] != null ? TL[def.secret || 'BRICK_BOMB'] : TL.BRICK_BOMB;
  const hidden = Object.values(rooms).filter(r => r.hidden);
  hidden.forEach((r, i) => {
    const nb = rnd.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]]).map(([dx, dy]) => normal(r.rx + dx, r.ry + dy)).filter(Boolean)[0];
    if (!nb) return; r.parent = nb; r.depth = nb.depth + 1; setDoor(nb, r, secretT, false);
    if (secretEye) { // tucked into the far end of the same wall as the hidden doorway
      const [dx2, dy2] = doorPos(nb, r); const end = rnd() < 0.5 ? -1 : 1;
      const ex = nb.ry === r.ry ? dx2 : dx2 + end * 5, ey = nb.ry === r.ry ? dy2 + end * 3 : dy2;
      L.set(ex, ey, TL.EYE_SMALL); L.eyeLinks = L.eyeLinks || {}; L.eyeLinks[L.idx(ex, ey)] = { kind: 'seal', opens: [L.idx(dx2, dy2)], text: 'A HIDDEN WAY OPENS.' };
    }
    r.reward = i === 0 ? 'hpiece' : 'gems100';
    const lore = (def.lore || [])[i]; if (lore) { const si = L.idx(r.rx * DSX + 6, r.ry * DSY + 2); L.props[si] = PR.SIGN; L.signText = L.signText || {}; L.signText[si] = lore; }
  });
  // ---- gimmicks ----
  const gimmicks = (def.gimmicks || []).map(g => Content.gimmicks[g]).filter(Boolean);
  const gctx = { rnd, d, def };
  for (const g of gimmicks) if (g.doors) g.doors(L, doors, gctx);
  for (const g of gimmicks) if (g.plan) g.plan(L, Object.assign({ rooms, start, boss, itemRoom, solve: (bow) => dungeonSolve(L, bow) }, gctx));
  // ---- room contents ----
  const pool = enemiesFor('dungeons', d);
  for (const r of order) {
    const ix = r.rx * DSX, iy = r.ry * DSY;
    const sign = (x, y, text) => { L.signText = L.signText || {}; L.signText[L.idx(ix + x, iy + y)] = text; };
    const ictx = Object.assign({}, gctx, { ix, iy, set: (x, y, t) => L.set(ix + x, iy + y, typeof t === 'string' ? TL[t] : t), prop: (x, y, pr) => { L.props[L.idx(ix + x, iy + y)] = pr; }, sign });
    if (r === start) { if (intro) intro.g.intro.start(L, r, ictx); for (const g of gimmicks) if (g.start) g.start(L, r, ictx); L.set(ix + 6, iy + DSY, TL.DEXIT); continue; }
    if (r.intro) { intro.g.intro.room(L, r, ictx); continue; }
    if (r.boss) { r.enemies = def.bossParty ? def.bossParty.slice() : [r.boss]; if (d >= 4 && !def.bossParty && pool.length) r.enemies.push(rnd.pick(pool)); r.shutter = true; if (def.bossEye) bossEyeAlcove(L, r, def.bossEye); for (const g of gimmicks) if (g.arena) g.arena(L, r, ictx); continue; }
    const lane = (x, y) => x === 6 || y === 4; // keep the cross through each room's doors clear
    const rc = Object.assign({}, gctx, { ix, iy, lane, set: (x, y, t) => L.set(ix + x, iy + y, typeof t === 'string' ? TL[t] : t), prop: (x, y, pr) => { L.props[L.idx(ix + x, iy + y)] = pr; } });
    let decorated = false; for (const g of gimmicks) if (g.room && g.room(L, r, rc)) decorated = true;
    if (r.custom) { r.enemies = r.custom.enemies.slice(); r.at = r.custom.at; r.shutter = !!r.custom.shutter; continue; } // a hand-built room set its own foes
    if (!decorated) {
      const pat = rnd.int(7);
      const blk = (x, y, t) => { if (lane(x, y)) return; L.set(ix + x, iy + y, t || TL.BRICK); };
      const block = (d >= 4 && rnd() < 0.25) ? TL.LAVA : (d === 10 ? TL.ICEWALL : TL.BRICK);
      if (pat === 1) { blk(3, 2); blk(9, 2); blk(3, 6); blk(9, 6); }
      else if (pat === 2) { for (let x = 2; x <= 10; x += 2) { blk(x, 2, block); blk(x, 6, block); } }
      else if (pat === 3) { blk(5, 3); blk(7, 3); blk(5, 5); blk(7, 5); }
      else if (pat === 4) { for (let y = 2; y <= 6; y++) { blk(2, y, block); blk(10, y, block); } }
      else if (pat === 5) { for (let x = 3; x <= 9; x++) { blk(x, 2, block); blk(x, 6, block); } }
      else if (pat === 6) { L.props[L.idx(ix + 2, iy + 1)] = PR.STATUE; L.props[L.idx(ix + 10, iy + 1)] = PR.STATUE; }
    }
    const dd = Math.min(9, d); // the optional dungeons are as crowded as level 9, not more
    if (r.item) { r.enemies = []; L.props[L.idx(ix + 6, iy + 3)] = PR.PEDESTAL; const n = 1 + Math.floor(dd / 3); for (let i = 0; i < n; i++) r.enemies.push(rnd.pick(pool)); continue; }
    const n = 2 + Math.floor(dd / 2) + rnd.int(3);
    if (rnd() < 0.12 && !r.key && !r.map && !r.compass) continue; // empty room
    for (let i = 0; i < n; i++) r.enemies.push(rnd.pick(pool));
    r.shutter = (rnd() < 0.25 || r.key) && !r.needsBow; // never seal someone without a bow in with foes across the water
  }
  for (const g of gimmicks) if (g.level) g.level(L, gctx);
  if (def.gourds === 'asked') L.gourdsOnlyAsked = true; placeGourds(W, L, d, start, boss);
  L.gimmicks = def.gimmicks || [];
  L.spawn = { x: start.rx * DSX + 6.5, y: start.ry * DSY + 6.2, a: -Math.PI / 2 };
  L.bossRoom = boss.id;
  const ent = W.dungeons[d]; L.exit = ent ? { lvl: 'ow', x: ent.x + 0.5, y: ent.y + 1.6, a: Math.PI / 2 } : { lvl: 'ow', x: W.levels.ow.spawn.x, y: W.levels.ow.spawn.y, a: 0 };
}
// Gourds and the like (content/gourds.js): a few on the floor of some rooms, plus any a gimmick asked for (room.gourdAt,
// room-relative). Their own random stream, so adding them doesn't move anything else. L.gourds remembers where they grow.
function placeGourds(W, L, d, start, boss) {
  const prop = PR[Content.breakableFor[d] || 'BONEPILE']; if (prop == null) return;
  const rnd = mulberry32((W.seed | 0) * 13 + d * 101); L.gourds = {};
  const put = (x, y) => { const i = L.idx(x, y); if (L.tiles[i] !== TL.DFLOOR || L.props[i]) return false; L.props[i] = prop; L.gourds[i] = prop; return true; };
  const rooms = Object.values(L.rooms).filter(Boolean);
  for (const r of rooms) for (const [x, y] of (r.gourdAt || [])) put(r.rx * DSX + x, r.ry * DSY + y);
  if (L.gourdsOnlyAsked) return; // e.g. Bramble Keep: only where the keep wants them
  const pick = rnd.shuffle(rooms.filter(r => r !== start && r !== boss && !r.hidden && !r.item && !r.custom && !r.gourdAt));
  for (const r of pick.slice(0, Math.max(2, Math.round(rooms.length / 5)))) { // about one room in five
    const ix = r.rx * DSX, iy = r.ry * DSY; const n = rnd() < 0.3 ? 2 : 1;
    for (let k = 0; k < n; k++) for (let t = 0; t < 12; t++) { const x = 2 + rnd.int(9), y = 2 + rnd.int(5); if (x === 6 || y === 4) continue; if (put(ix + x, iy + y)) break; } // off the paths between doors
  }
}
// A walled-off nook in a boss room's top-right corner, opened by shooting the eye on its wall. def.bossEye = [items inside].
function bossEyeAlcove(L, r, items) {
  const ix = r.rx * DSX, iy = r.ry * DSY; const at = (x, y) => L.idx(ix + x, iy + y);
  for (const [x, y] of [[9, 1], [9, 3], [10, 3], [11, 3]]) L.set(ix + x, iy + y, TL.BRICK);
  L.set(ix + 9, iy + 2, TL.EYE);
  L.eyeLinks = L.eyeLinks || {}; L.eyeLinks[at(9, 2)] = { kind: 'seal', opens: [at(10, 3)], openTo: TL.DFLOOR, text: 'THE GREAT EYE BLINKS... A NICHE OPENS IN THE WALL.' };
  r.stash = items.map((item, i) => ({ item, x: 10.5 + (i % 2), y: 1.5 + Math.floor(i / 2) }));
}
// ---------- ELEVATION ----------
// A tile can stand up from the floor: TINFO[t].raised = its height in tiles (steps 0.25-0.75, a ledge 1). You walk up anything
// at most STEP_UP above your feet; higher is a wall to you. Walk off an edge and you drop. The renderer draws the faces and
// tops (engine/render.js). Rooms can be built taller than one tile (L.ceilH): there the Gale Cloak lifts you a level.
const STEP_UP = 0.3;
function heightAt(L, x, y) { const ti = TINFO[L.get(Math.floor(x), Math.floor(y))]; return ti.wall ? 0 : (ti.raised || 0); }
// can the Gale Cloak lift you a whole level here? Outdoors (open sky), or in a room at least two tiles tall
function skyRoom(L) { return L.kind === 'ow' || (L.ceilH || 1) >= 2; }
function dungeonRoomAt(L, x, y) { const rx = Math.floor(x / DSX), ry = Math.floor(y / DSY); const r = L.rooms[ry * (L.gw || DGW) + rx]; return r && r.mergeInto != null ? L.rooms[r.mergeInto] : r; } // mergeInto: a cell that is part of a bigger room // L.gw: a wider room grid (the frontier tunnels)
function owRegionAt(L, x, y) { const rx = clamp(Math.floor(x / RSX), 0, RW - 1), ry = clamp(Math.floor(y / RSY), 0, RH - 1); return L.regions[ry * RW + rx]; }
function roomBounds(L, room) {
  if (L.kind === 'dungeon' || L.kind === 'tunnel') { const c0 = room.cx0 != null ? room.cx0 : room.rx; return { x0: c0 * DSX + 1, y0: room.ry * DSY + 1, x1: (c0 + (room.cw || 1)) * DSX, y1: room.ry * DSY + DSY }; } // cx0/cw: a room more than one cell wide
  if (L.kind === 'ow') return { x0: room.rx * RSX + 1, y0: room.ry * RSY + 1, x1: room.rx * RSX + RSX, y1: room.ry * RSY + RSY };
  return { x0: 1, y0: 1, x1: L.w - 1, y1: L.h - 1 };
}
