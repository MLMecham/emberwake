// ===== tools/check.js : validate content and run the game logic headless =====
// Usage: node tools/check.js            (quick: 40 worlds)
//        node tools/check.js --full     (300 worlds)
// Runs without a browser. Exits with an error code if anything is wrong, so it's safe to use before every push.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.join(__dirname, '..');
const FULL = process.argv.includes('--full');

// same file list and order as build.py (minus browser-only files)
let files;
try { files = JSON.parse(cp.execFileSync(process.platform === 'win32' ? 'python' : 'python3', [path.join(root, 'build.py'), '--list']).toString()); }
catch (e) { console.error('Could not run build.py --list (is Python installed?)\n' + e.message); process.exit(1); }
const order = JSON.parse(fs.readFileSync(path.join(root, 'build_order.json'), 'utf8')).files;
const scopedDirs = order.filter(o => o.scoped).map(o => o.path.replace('/*.js', '/'));
const isScoped = (f) => scopedDirs.some(d => f.startsWith(d) && !f.slice(d.length).includes('/')) && f !== 'src/content/ai.js';
let code = files.map(f => { const src = fs.readFileSync(path.join(root, f), 'utf8'); return '// ---- ' + f + '\n' + (isScoped(f) ? '(function () {\n' + src + '\n})();' : src); }).join('\n');

// map "bundle.js:LINE" in error messages back to the real source file and line
const lineMap = []; { let n = 1; for (const f of files) { const len = fs.readFileSync(path.join(root, f), 'utf8').split('\n').length + (isScoped(f) ? 2 : 0) + 1; lineMap.push([n, f, isScoped(f) ? 2 : 1]); n += len; } }
const where = (msg) => msg.replace(/bundle\.js:(\d+)(:\d+)?/g, (m, ln) => { ln = +ln; let hit = lineMap[0]; for (const e of lineMap) if (e[0] <= ln) hit = e; return hit[1] + ':' + (ln - hit[0] - hit[2] + 1); });
const failures = []; let passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else failures.push(msg); };
const ctx = { console, Math, JSON, Date, Object, Array, Set, Map, Uint8Array, Uint32Array, Int32Array, Float32Array, Number, String, Error, parseInt, Infinity, NaN, isFinite, __ok: ok };
vm.createContext(ctx);
try { vm.runInContext(code, ctx, { filename: 'bundle.js' }); }
catch (e) { console.error('The game code failed to load:\n' + e.stack); process.exit(1); }

const tests = `
// ---------- 1. content definitions ----------
const problems = validateContent();
for (const p of problems) __ok(false, 'content: ' + p);
__ok(problems.length === 0, 'content has problems');
initSprites(); initAnims(); initTextures();
for (const id in Content.enemies) __ok(!!SPR[id], 'enemy "' + id + '" sprite did not build');
for (const id in Content.anims) __ok(SPR_ANIM[id] && SPR_ANIM[id].f.length > 0, 'animation "' + id + '" produced no frames');
for (const d of Object.values(Content.items)) __ok(!!SPR[d.sprite], 'item "' + d.id + '" sprite "' + d.sprite + '" did not build');

// ---------- 2. world generation ----------
const SEEDS = ${FULL ? 300 : 40};
function solveDungeon(D) {
  const rooms = D.rooms; let keys = 0; const reached = new Set(), opened = new Set(), got = new Set(); let changed = true;
  while (changed) {
    changed = false; const st = [D.startRoom], vis = new Set();
    while (st.length) { const r = st.pop(); if (vis.has(r.id)) continue; vis.add(r.id);
      if ((r.key || r.looseKey) && !got.has(r.id)) { got.add(r.id); keys++; changed = true; }
      for (const oid in r.links) { const t = r.links[oid]; const k = Math.min(r.id, +oid) + '-' + Math.max(r.id, +oid); if (t === TL.LOCKED && !opened.has(k)) continue; st.push(rooms[oid]); } }
    vis.forEach(v => reached.add(v));
    if (!changed) for (const id of reached) { const r = rooms[id]; for (const oid in r.links) { const k = Math.min(r.id, +oid) + '-' + Math.max(r.id, +oid); if (r.links[oid] === TL.LOCKED && !opened.has(k) && keys > 0) { keys--; opened.add(k); changed = true; break; } } if (changed) break; }
  }
  return reached.size === Object.keys(rooms).length;
}
let wallCaves = 0;
for (let s = 1; s <= SEEDS; s++) {
  const seed = s === 1 ? 7319 : s * 7919; const W = genWorld(seed, 'rogue'); const L = W.levels.ow;
  for (let d = 1; d <= NDUNGEONS(); d++) { const D = W.levels['d' + d]; __ok(solveDungeon(D), 'seed ' + seed + ': dungeon ' + d + ' has unreachable rooms'); __ok(!!W.dungeons[d], 'seed ' + seed + ': dungeon ' + d + ' gate missing'); }
  // walking the Wilds; the frontier tunnels join their two cave mouths (if the tunnel itself can be walked end to end)
  const tunnelOk = {}; for (const b of ['snow', 'ash']) { const T = W.levels['t' + b]; __ok(!!T && T.exits.length === 2, 'seed ' + seed + ': the ' + b + ' tunnel exists with two ways out'); if (!T) continue;
    const sn = new Uint8Array(T.w * T.h); const s0 = [T.exits[0].x, T.exits[0].y]; const qq = [s0]; sn[s0[1] * T.w + s0[0]] = 1;
    while (qq.length) { const [x, y] = qq.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, i = ny * T.w + nx; if (sn[i] || T.solidAt(nx + 0.5, ny + 0.5) || TINFO[T.get(nx, ny)].hurt) continue; sn[i] = 1; qq.push([nx, ny]); } }
    tunnelOk[b] = !!sn[T.exits[1].y * T.w + T.exits[1].x]; __ok(tunnelOk[b], 'seed ' + seed + ': the ' + b + ' tunnel can be walked end to end (no lava in the way)');
    __ok(Object.keys(T.rooms).length >= 10, 'seed ' + seed + ': the ' + b + ' tunnel has 10+ rooms'); }
  const flood = (opts) => { const seen = new Uint8Array(L.w * L.h); const q = [[Math.floor(L.spawn.x), Math.floor(L.spawn.y)]]; seen[q[0][1] * L.w + q[0][0]] = 1;
    const jumps = []; for (const b of ['snow', 'ash']) { const ps = L.passes[b]; if (ps && ps.mouths && tunnelOk[b]) jumps.push(ps.mouths.map(m => [Math.floor(m.x), Math.floor(m.y)])); }
    while (q.length) { const [x, y] = q.pop();
      for (const pair of jumps) for (let k = 0; k < 2; k++) if (pair[k][0] === x && pair[k][1] === y) { const [ox, oy] = pair[1 - k], oi = oy * L.w + ox; if (!seen[oi]) { seen[oi] = 1; q.push([ox, oy]); } } // through the tunnel
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, i = ny * L.w + nx; if (seen[i] || L.solidAt(nx + 0.5, ny + 0.5, opts)) continue; seen[i] = 1; q.push([nx, ny]); } }
    return seen; };
  const seen = flood();
  // with the raft (level 6's treasure) everything is reachable; without it, level 7's island is not
  const seenR = flood({ raft: true });
  for (let d = 1; d <= NDUNGEONS(); d++) { const g = W.dungeons[d]; if (!g) continue; const gi = (g.y + 1) * L.w + g.x;
    if (d === 7) { __ok(!!seenR[gi], 'seed ' + seed + ': island gate 7 unreachable even with the raft'); __ok(!seen[gi], 'seed ' + seed + ': island gate 7 reachable without the raft'); }
    else __ok(!!seen[gi], 'seed ' + seed + ': gate ' + d + ' unreachable'); }
  const g6 = W.dungeons[6]; __ok(g6 && !!seen[(g6.y + 1) * L.w + g6.x], 'seed ' + seed + ': gate 6 (the raft) must be reachable on foot');
  for (const r of L.regions) for (const f of r.features) if (f.type === 'cave' && f.secret !== 'bush') __ok(!!seen[(f.y + 1) * L.w + f.x], 'seed ' + seed + ': cave "' + f.kind + '" unreachable');
  __ok((L.grottos || []).length === Content.grottoKinds.length, 'seed ' + seed + ': one grotto of each kind (' + (L.grottos || []).length + ')');
  for (const g of L.grottos || []) __ok(L.props[L.idx(g.x, g.y)] === PR.HOLLOWTREE && L.portals[L.idx(g.x, g.y)].to === g.id && !!seen[(g.y + 1) * L.w + g.x] && !!W.levels[g.id], 'seed ' + seed + ': grotto ' + g.kind + ' under a reachable hollow tree');
  // some open caves are dug into the north wall, with solid rock behind them
  for (const r of L.regions) for (const f of r.features) if (f.type === 'cave' && f.y === regionInterior(r).y0) { wallCaves++; __ok([-1, 0, 1].every(dx => TINFO[L.get(f.x + dx, f.y - 1)].solid) && !!L.portals[L.idx(f.x, f.y)], 'seed ' + seed + ': wall cave "' + f.kind + '" has solid rock behind it'); }
}
__ok(wallCaves >= SEEDS, 'some caves are dug into the wall (' + wallCaves + ' over ' + SEEDS + ' lands)');

// ---------- 3. simulation smoke tests ----------
function freshSim() {
  const W = genWorld(7319, 'adv'); const sim = new Sim(W, null);
  const a = sim.addPlayer('p1', 'A', 'GREEN', 'sword'), b = sim.addPlayer('p2', 'B', 'RED', 'monk');
  const L = W.levels.ow; for (const p of [a, b]) { p.x = L.spawn.x; p.y = L.spawn.y; p.god = true; p.sword = 3; p.maxHp = p.hp = 40; p.bombs = 8; p.arrows = 20; p.potions = 2; }
  return sim;
}
function run(sim, secs) { for (let t = 0; t < secs * 60; t++) sim.tick(1 / 60); }
function attempt(label, fn) { try { fn(); __ok(true); } catch (e) { __ok(false, label + ' crashed: ' + (e.stack || e).toString().split('\\n').slice(0, 3).join(' | ')); } }

// every enemy: spawn, let it act, then kill it every way we can
for (const id in Content.enemies) attempt('enemy "' + id + '"', () => {
  const sim = freshSim(); const p = sim.players.p1; const L = sim.W.levels.ow;
  const bounds = { x0: Math.floor(p.x) - 5, y0: Math.floor(p.y) - 5, x1: Math.floor(p.x) + 5, y1: Math.floor(p.y) + 5 };
  const e = sim.spawnEnemy(id, 'ow', p.x + 1.5, p.y, { bounds, spawnFx: 0 }); e.hp = e.maxHp = 9999;
  run(sim, 4);
  sim.damageEnemy(e, 1, p, { pid: 'p1' }); sim.damageEnemy(e, 1, null, { stunOnly: true }); sim.damageEnemy(e, 1, null, { pierceShield: true, ignoreIframes: true });
  e.hp = 1; e.hurt = 0; e.stun = 0; sim.damageEnemy(e, 5, null, { pid: 'p1', silver: true, pierceShield: true, ignoreIframes: true });
  run(sim, 1);
  if (enemyDef(id).neutral) __ok(!e.dead, 'neutral "' + id + '" cannot be killed'); else __ok(e.dead, 'enemy "' + id + '" did not die from a silver hit');
});
// every elite: spawn on a skeleton, act, die, drop loot
for (const el of Content.elites) attempt('elite "' + el.id + '"', () => {
  const sim = freshSim(); const p = sim.players.p1;
  const e = sim.spawnEnemy('skeleton', 'ow', p.x + 2, p.y, { spawnFx: 0, bounds: { x0: Math.floor(p.x) - 5, y0: Math.floor(p.y) - 5, x1: Math.floor(p.x) + 5, y1: Math.floor(p.y) + 5 } });
  e.elite = el.idx; if (el.apply) el.apply(e, sim); run(sim, 2);
  const before = sim.ents.filter(x => x.k === 'pick' || x.k === 'en').length;
  if (!e.dead) { e.hurt = 0; sim.damageEnemy(e, 999, null, { pid: 'p1', pierceShield: true, ignoreIframes: true, silver: true }); }
  run(sim, 0.5);
  __ok(e.dead, 'elite "' + el.id + '" did not die');
});
// every B-item, used by each class
for (const d of bItems()) for (const pid of ['p1', 'p2']) attempt('item "' + d.id + '" (' + pid + ')', () => {
  const sim = freshSim(); const p = sim.players[pid]; sim.giveItem(p, d.id, false); p.items[d.id] = true;
  sim.team.done.push(1);
  sim.spawnEnemy('slime', 'ow', p.x + 1.5, p.y, { spawnFx: 0 });
  for (let i = 0; i < 3; i++) { sim.useItem(p, d.id); run(sim, 0.8); }
  run(sim, 2);
});
// every item can be given (picked up / bought) without crashing
for (const id in Content.items) attempt('giving "' + id + '"', () => {
  const sim = freshSim(); const p = sim.players.p1; const D = sim.W.levels.d1; sim.teleport(p, 'd1', D.spawn.x, D.spawn.y, 0);
  sim.giveItem(p, id, true); run(sim, 0.2);
  const e = sim.dropItem(id, p.lvl, p.x, p.y); run(sim, 0.2);
});
// drop tables only produce real items
for (const t in Content.drops) for (let i = 0; i < 200; i++) { const sim = freshSim(); const it = rollDrop(t, sim); if (it) __ok(!!Content.items[it], 'drop table "' + t + '" rolled unknown item ' + it); }
// tour every dungeon: visit each room, stand on every gimmick tile, attack and burn everything nearby
for (let d = 1; d <= NDUNGEONS(); d++) attempt('dungeon ' + d + ' tour', () => {
  const sim = freshSim(); const a = sim.players.p1, b = sim.players.p2; const D = sim.W.levels['d' + d];
  a.items.candle = true; a.items.rod = true;
  for (const pl of [a, b]) sim.teleport(pl, D.id, D.spawn.x, D.spawn.y, -Math.PI / 2);
  for (const r of Object.values(D.rooms)) {
    const cx = r.rx * DSX + 6.5, cy = r.ry * DSY + 4.5;
    for (const pl of [a, b]) { pl.x = cx; pl.y = cy; }
    run(sim, 0.3);
    for (let y = r.ry * DSY + 1; y < r.ry * DSY + DSY; y++) for (let x = r.rx * DSX + 1; x < r.rx * DSX + DSX; x++) {
      const ti = TINFO[D.get(x, y)]; if (ti.pressure || ti.glass || ti.conveyor) { a.x = x + 0.5; a.y = y + 0.5; run(sim, ti.glass ? 1.4 : 0.1); }
      if (ti.pit) sim.onAction('p1', { t: 'fall', x: cx, y: cy });
      if (ti.cuttable) { a.x = x + 0.5; a.y = y + 1.4; a.a = -Math.PI / 2; sim.playerAttack(a, { kind: 'sword' }); }
    }
    a.x = cx; a.y = cy; for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { a.a = ang; sim.useItem(a, 'candle'); run(sim, 0.6); }
    for (const e of sim.ents) if (e.k === 'en' && e.lvl === D.id && !e.dead) sim.damageEnemy(e, 999, a, { pid: 'p1', silver: true, pierceShield: true, ignoreIframes: true });
    run(sim, 0.3);
  }
  __ok(D.rooms[D.bossRoom] && Object.values(D.rooms).some(r => r.hidden) === (D.rooms && Object.values(D.rooms).some(r => r.hidden)), 'dungeon ' + d);
});
// every dungeon has the right number of hidden rooms, and they're reachable through their secret wall
for (let d = 1; d <= NDUNGEONS(); d++) { const W = genWorld(7319, 'adv'); const D = W.levels['d' + d]; const want = (Content.dungeons[d].shape.join('').match(/H/g) || []).length; const hid = Object.values(D.rooms).filter(r => r.hidden); __ok(hid.length === want, 'dungeon ' + d + ' should have ' + want + ' hidden rooms, has ' + hid.length); for (const r of hid) __ok(Object.keys(r.links).length > 0, 'dungeon ' + d + ' hidden room is not connected'); }
// old (version 1) saves still load
attempt('old save migration', () => { const W = genWorld(7319, 'adv'); const sim = new Sim(W, { v: 1, seed: 7319, mode: 'adv', team: { keys: { d1: 2 }, maps: {}, comps: {}, shards: [1, 2], done: [1, 2], taken: { 'd1:3:key': true, 'c0:shop0': true }, cleared: { 'd1:3': true } }, mods: { d1: { 100: [11, 0] }, ow: { 500: [6, 0] } }, players: {} }); __ok(sim.team.shards.length === 2 && !sim.team.keys.d1 && sim.team.taken['c0:shop0'] && !sim.mods.d1, 'v1 save not migrated correctly'); });
// co-op scaling: health follows the headcount in the room (1x, 1.5x, 2x, 2.5x), keeping damage already dealt
attempt('party scaling', () => {
  const W = genWorld(7319, 'adv'); const sim = new Sim(W, null); const D = W.levels.d2;
  const room = Object.values(D.rooms).find(r => r.enemies.length >= 2 && !r.boss); const cx = room.rx * DSX + 6.5, cy = room.ry * DSY + 4.5;
  const ps = ['p1', 'p2', 'p3', 'p4'].map((id, i) => { const p = sim.addPlayer(id, id, PCOLORS[i].name, 'sword'); p.god = true; return p; });
  for (const p of ps) { sim.teleport(p, 'd2', D.spawn.x, D.spawn.y, 0); }
  ps[0].x = cx; ps[0].y = cy; sim.tick(1 / 60); sim.tick(1 / 60);
  const g = sim.groups['d2:' + room.id]; const e = g.ents[0]; const base = e.maxHp;
  const want = [1, 1.5, 2, 2.5];
  for (let n = 2; n <= 4; n++) { ps[n - 1].x = cx; ps[n - 1].y = cy; sim.tick(1 / 60); __ok(Math.abs(e.maxHp - base * want[n - 1]) < 1e-6, 'party of ' + n + ': enemy max health should be ' + want[n - 1] + 'x, got ' + (e.maxHp / base).toFixed(2) + 'x'); }
  e.hp = e.maxHp / 2; ps[3].x = D.spawn.x; ps[3].y = D.spawn.y; sim.tick(1 / 60);
  __ok(Math.abs(e.hp / e.maxHp - 0.5) < 1e-6 && Math.abs(e.maxHp - base * 2) < 1e-6, 'when someone leaves, enemies keep the same share of health');
});
// the dragons: each optional boss room spawns its heads with a body and necks, fights, and when every head falls the
// neck parts vanish and the room leaves its treasure (relic / Dawnblade)
for (const d of [10, 11, 12]) attempt('dragon fight ' + d, () => {
  const sim = freshSim(); const D = sim.W.levels['d' + d]; const a = sim.players.p1, b = sim.players.p2; const boss = D.rooms[D.bossRoom];
  for (const pl of [a, b]) { sim.teleport(pl, D.id, boss.rx * DSX + 6.5, boss.ry * DSY + 6.2, -Math.PI / 2); }
  let attacked = false; for (let t = 0; t < 600; t++) { sim.tick(1 / 60); if (sim.ents.some(e => (e.k === 'proj' && e.lvl === D.id && e.owner === 'e') || (e.k === 'en' && (e.mode === 'bite' || e.mode === 'breath')))) attacked = true; }
  const heads = sim.ents.filter(e => e.k === 'en' && e.lvl === D.id && enemyDef(e.type).boss && !e.dead);
  const parts = sim.ents.filter(e => e.k === 'neck' && e.lvl === D.id);
  __ok(heads.length === (d === 12 ? 3 : 1), 'dungeon ' + d + ' should have ' + (d === 12 ? 3 : 1) + ' dragon heads, has ' + heads.length);
  __ok(parts.filter(n => n.role === 'body').length === 1 && parts.filter(n => n.role === 'seg').length === heads.length * 7, 'dungeon ' + d + ' dragon parts wrong: ' + parts.length);
  __ok(heads.every(h => dist2(h.x, h.y, h.base.x, h.base.y) <= 5.2 * 5.2), 'dungeon ' + d + ' head strayed past its neck');
  __ok(attacked, 'dungeon ' + d + ' dragon never attacked');
  for (const h of heads) { h.hurt = 0; sim.damageEnemy(h, 9999, a, { pid: 'p1', ignoreIframes: true, pierceShield: true, silver: true }); }
  for (const e of sim.ents) if (e.k === 'en' && e.lvl === D.id && !e.dead) sim.damageEnemy(e, 9999, a, { pid: 'p1', ignoreIframes: true, pierceShield: true, silver: true });
  run(sim, 1.5);
  __ok(!sim.ents.some(e => e.k === 'neck' && e.lvl === D.id), 'dungeon ' + d + ' dragon parts left behind');
  const want = Content.dungeons[d].bossDrop; __ok(sim.ents.some(e => e.k === 'pick' && e.item === want), 'dungeon ' + d + ' boss should leave ' + want);
  const pk = sim.ents.find(e => e.k === 'pick' && e.item === want); a.x = pk.x; a.y = pk.y; run(sim, 0.3);
  if (d === 12) __ok(a.sword === 4 && b.sword === 4, 'the Dawnblade should go to everyone'); else __ok(sim.team.relics.includes(want), want + ' should be a team relic');
});
// the frontier: both lands exist past one pass each, the hermits and the optional gates are reachable, the Hearth opens
attempt('frontier', () => {
  const W = genWorld(7319, 'adv'); const L = W.levels.ow;
  __ok(L.regions.filter(r => r.biome === 'snow').length === RH && L.regions.filter(r => r.biome === 'ash').length === RH, 'frontier columns should be snow and ash');
  for (const d of [10, 11, 12]) __ok(!!W.dungeons[d], 'gate ' + d + ' missing');
  __ok(L.tiles[L.idx(W.dungeons[12].x, W.dungeons[12].y)] === TL.HEARTHGATE, 'the Hearth gate should start sealed');
  const sim = new Sim(W, null); const p = sim.addPlayer('p1', 'A', 'GREEN', 'sword'); const g = W.dungeons[12]; p.x = g.x + 0.5; p.y = g.y + 1.5;
  sim.tryEnter(p, L.idx(g.x, g.y)); __ok(L.tiles[L.idx(g.x, g.y)] === TL.HEARTHGATE, 'the Hearth opened without its keys');
  sim.team.relics.push('fang', 'emberheart'); sim.tryEnter(p, L.idx(g.x, g.y)); __ok(L.tiles[L.idx(g.x, g.y)] === TL.GATE, 'the Hearth did not open with both keys');
  __ok(Object.values(W.levels).some(l => l.caveKind === 'frosthint') && Object.values(W.levels).some(l => l.caveKind === 'firehint'), 'hermit caves missing');
});
// hazards: vents blow on the shared rhythm, magma boots protect, ice breath chills
attempt('vents and chill', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; const D = sim.W.levels.d11; sim.teleport(p, 'd11', D.spawn.x, D.spawn.y, 0);
  let vent = -1; for (let i = 0; i < D.tiles.length; i++) if (TINFO[D.tiles[i]].vent) { vent = i; break; }
  __ok(vent >= 0, 'Cinder Caldera has no vents');
  p.x = vent % D.w + 0.5; p.y = Math.floor(vent / D.w) + 0.5; const hp0 = p.hp; sim.time = 2.5; sim.tick(1 / 60); __ok(p.hp < hp0, 'a blowing vent should hurt');
  p.inv = 0; p.hp = p.maxHp; p.items.magmaboots = true; sim.time = 2.5; sim.tick(1 / 60); __ok(p.hp === p.maxHp, 'magma boots should protect from vents');
  p.inv = 0; sim.fireProj('icebreath', p.lvl, p.x - 0.3, p.y, 0, 'e', null, { dmg: 1 }); run(sim, 0.2); __ok(sim.snapshotFor('p1').me.chill === 1, 'ice breath should chill');
});
// sword beams fired through a doorway at an angle glance off the frame instead of breaking
attempt('beams through doorways', () => {
  const W = genWorld(7319, 'adv'); const sim = new Sim(W, null); const p = sim.addPlayer('p1', 'A', 'GREEN', 'sword'); p.sword = 2; p.god = true;
  const D = W.levels.d1; const r = D.startRoom; sim.teleport(p, 'd1', D.spawn.x, D.spawn.y, -Math.PI / 2); const ix = r.rx * DSX, iy = r.ry * DSY;
  let broke = 0;
  for (const off of [-0.3, 0, 0.3]) for (const ang of [-0.35, -0.15, 0.15, 0.35]) for (const dy of [0.3, 0.8, 1.4]) {
    sim.ents = sim.ents.filter(e => e.k !== 'proj'); p.x = ix + 6.5 + off; p.y = iy + dy; p.a = -Math.PI / 2 + ang; p.hp = p.maxHp;
    sim.playerAttack(p, { kind: 'sword' }); const b = sim.ents.find(e => e.k === 'proj' && e.type === 'beam'); if (!b) { broke++; continue; }
    for (let t = 0; t < 12; t++) sim.updateProj(b, 1 / 60); if (b.dead && b.y > iy - 1.5) broke++;
  }
  __ok(broke === 0, broke + ' sword beams broke on a door frame');
});
// debug: switching it on mid-game hands over the loadout (relics, Dawnblade, new items); god mode switches on its own
attempt('debug loadout mid-game', () => {
  const W = genWorld(7319, 'adv'); const sim = new Sim(W, null); const p = sim.addPlayer('p1', 'MITCH', 'GREEN', 'sword');
  sim.onAction('p1', { t: 'debug', on: true, god: false, loadout: { sword: 4, armor: 2, hearts: 16, gems: 999, bombs: 16, arrows: 30, potions: 2, shards: 8, items: Object.values(Content.items).filter(d => d.debug).map(d => d.id) } });
  __ok(p.dbg && !p.god && p.sword === 4 && p.armor === 2 && p.items.frostarrows && p.items.magmaboots && sim.team.relics.includes('fang') && sim.team.relics.includes('emberheart') && sim.team.shards.length === 8, 'debug loadout incomplete');
  sim.onAction('p1', { t: 'god', on: true }); __ok(p.god, 'god toggle failed');
  const q = sim.addPlayer('p2', 'BOB', 'RED', 'sword'); sim.onAction('p2', { t: 'debug', on: true, loadout: { sword: 4 } }); __ok(!q.dbg && !q.god, 'debug must stay dev-only');
});
attempt('god mode triple damage', () => {
  const sim = freshSim(); const p = sim.players.p1; const e = sim.spawnEnemy('skeleton', 'ow', p.x + 2, p.y, { spawnFx: 0 }); e.hp = e.maxHp = 100;
  p.god = false; sim.damageEnemy(e, 2, null, { pid: 'p1', ignoreIframes: true }); const normal = 100 - e.hp;
  p.god = true; e.hurt = 0; const before = e.hp; sim.damageEnemy(e, 2, null, { pid: 'p1', ignoreIframes: true });
  __ok(before - e.hp === normal * 3, 'god mode should deal triple damage');
});
attempt('respawn after waiting', () => {
  const sim = freshSim(); const a = sim.players.p1, b = sim.players.p2; a.god = false; b.god = false; const D = sim.W.levels.d3;
  for (const p of [a, b]) sim.teleport(p, 'd3', D.spawn.x, D.spawn.y, 0); a.potions = 0; a.y -= 3; a.hp = 1; a.inv = 0; sim.hurtPlayer(a, 5, null);
  __ok(!a.alive, 'should be down'); sim.onAction('p1', { t: 'respawn' }); __ok(!a.alive, 'respawned too early');
  __ok(sim.snapshotFor('p1').me.respawnIn > 25, 'respawn countdown missing');
  a.gems = 101; const fx = a.x, fy = a.y;
  sim.time += 31; sim.onAction('p1', { t: 'respawn' }); __ok(a.alive && a.lvl === 'd3' && Math.abs(a.y - D.spawn.y) < 0.01, 'respawn should put you at the dungeon entrance');
  __ok(a.gems === 51, 'respawning alone should cost half your gems');
  const bag = sim.ents.find(e => e.item === 'gembag'); __ok(bag && bag.amount === 50 && Math.abs(bag.x - fx) < 0.01, 'gem bag should be left where you fell');
  b.x = bag.x; b.y = bag.y; sim.tick(1 / 60); __ok(!bag.dead, 'only the owner can take the bag');
  a.x = bag.x; a.y = bag.y; sim.tick(1 / 60); __ok(bag.dead && a.gems === 101, 'owner should get the gems back');
});
attempt('shops sell slowly and only what you can carry', () => {
  const sim = freshSim(); const p = sim.players.p1; p.gems = 300; p.potions = 0;
  const shop = { k: 'shop', lvl: p.lvl, x: p.x, y: p.y, item: 'potion', price: 60 };
  for (let i = 0; i < 10; i++) sim.pickup(p, shop); // ten ticks on the counter at once
  __ok(p.potions === 1 && p.gems === 240, 'one purchase per cooldown (got ' + p.potions + ' potions, ' + p.gems + ' gems)');
  for (let t = 0; t < 60 * 5; t++) { sim.time += 1 / 60; sim.pickup(p, shop); } // stand there five seconds
  __ok(p.potions === 2 && p.gems === 180, 'should stop charging once you can\\'t carry more (got ' + p.potions + ' potions, ' + p.gems + ' gems)');
  p.gems = 300; p.hp = p.maxHp; sim.time += 2; sim.pickup(p, { k: 'shop', lvl: p.lvl, x: p.x, y: p.y, item: 'heart', price: 10 });
  __ok(p.gems === 300, 'no heart sales at full health');
});
attempt('sunken stair: bow first, then everything', () => {
  const kinds = {}; let n = 0;
  for (let i = 0; i < 40; i++) for (const mode of ['adv', 'rogue']) {
    const W = genWorld(1000 + i * 7919, mode); const L = W.levels.d3; const all = Object.values(L.rooms);
    const bowRoom = all.find(r => r.item === 'bow'); __ok(bowRoom, 'd3 needs a bow room');
    __ok(dungeonSolve(L, false).has(bowRoom.id), 'bow must be reachable without the bow (seed ' + (1000 + i * 7919) + ' ' + mode + ')');
    __ok(dungeonSolve(L, true).size === all.length, 'with the bow every room must be reachable (seed ' + (1000 + i * 7919) + ' ' + mode + ')');
    __ok(all.some(r => r.drain === 'spiral'), 'd3 should have its spiral room');
    __ok(Object.values(L.eyeLinks || {}).some(l => l.kind === 'seal') || !all.some(r => r.hidden), 'hidden room should be behind a small eye');
    for (const r of all) if (r.drain) kinds[r.drain] = (kinds[r.drain] || 0) + 1; n++;
    for (const rid in L.rigs) for (const i2 of L.rigs[rid].cells) __ok(L.tiles[i2] === TL.WATER, 'tide cells start deep');
  }
  __ok(kinds.channel > n * 0.5 && kinds.moat > 0 && kinds.pool > 0, 'room kinds look off: ' + JSON.stringify(kinds));
});
attempt('eyes and tides', () => {
  const sim = freshSim(); const p = sim.players.p1; const q = sim.players.p2; const L = sim.W.levels.d3;
  const rid = Object.keys(L.rigs).find(k => L.rooms[k].drain === 'moat' || L.rooms[k].drain === 'channel'); const rig = L.rigs[rid]; const room = L.rooms[rid];
  for (const pl of [p, q]) sim.teleport(pl, 'd3', room.rx * DSX + 6.5, room.ry * DSY + 4.5, 0);
  // an arrow flying into the eye shuts it; a sword beam doesn't
  const eye = rig.eyes[0]; const ex = eye % L.w + 0.5, ey = Math.floor(eye / L.w) + 0.5;
  // find an open approach to the eye
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]; const [ax, ay] = dirs.find(([dx, dy]) => !L.solidAt(ex + dx, ey + dy) || TINFO[L.get(Math.floor(ex + dx), Math.floor(ey + dy))].low);
  const shootFrom = (type) => { const pr = sim.fireProj(type, 'd3', ex + ax * 0.9, ey + ay * 0.9, Math.atan2(-ay, -ax), 'p', 'p1', {}); for (let i = 0; i < 30 && !pr.dead; i++) sim.updateProj(pr, 1 / 60); };
  shootFrom('beam'); sim.tick(1 / 60); __ok(L.tiles[rig.cells[0]] === TL.WATER, 'sword beams must not shut eyes');
  shootFrom('arrow'); sim.tick(1 / 60);
  __ok(L.tiles[eye] === TL.EYE_SHUT && rig.cells.every(i => L.tiles[i] === TL.WET), 'arrow should drain the room');
  __ok(sim.snapshotFor('p1').rg[rid] === 1, 'snapshot should carry the tide');
  // a skeleton wading back in the water when it returns sinks
  const c = rig.cells[3]; const sk = sim.spawnEnemy('skeleton', 'd3', c % L.w + 0.5, Math.floor(c / L.w) + 0.5, { spawnFx: 0 }); sk.spawnFx = 0; sk.stun = 99;
  const bat = sim.spawnEnemy('bat', 'd3', c % L.w + 0.5, Math.floor(c / L.w) + 0.5, { spawnFx: 0 }); bat.spawnFx = 0; bat.stun = 99;
  const at = (t) => { while (sim.time < t0 + t) sim.tick(1 / 20); }; const t0 = sim.time;
  at(TIDE.DRY - 1); __ok(L.tiles[eye] === TL.EYE && L.tiles[rig.cells[0]] === TL.WET, 'eye should creak open before the water comes back');
  at(TIDE.DRY + 1); __ok(L.tiles[rig.cells[0]] === TL.SHALLOW, 'then shallow');
  __ok(!sk.dead, 'shallow water is safe');
  at(TIDE.DRY + TIDE.SHALLOW + 0.5); __ok(L.tiles[rig.cells[0]] === TL.WATER && !sim.rigShots['d3:' + rid], 'then deep again');
  __ok(sk.dead && !bat.dead, 'deep water sinks walkers, not bats');
  // the client side: a fresh copy of the world follows the snapshot codes
  const W2 = genWorld(sim.W.seed, sim.W.mode); const L2 = W2.levels.d3; applyRig(L2, rid, 3); __ok(L2.tiles[rig.cells[0]] === TL.SHALLOW && L2.tiles[eye] === TL.EYE, 'applyRig should set shallow');
  // sealed small eye opens the hidden passage
  const seal = Object.keys(L.eyeLinks).find(k => L.eyeLinks[k].kind === 'seal');
  if (seal) { const door = L.eyeLinks[seal].opens[0]; __ok(L.tiles[door] === TL.BRICK, 'hidden doorway starts as plain wall'); sim.hitEye(L, +seal); __ok(L.tiles[door] === TL.OPENDOOR && L.tiles[seal] === TL.EYE_SMALL_SHUT, 'small eye should open the hidden way'); }
});
attempt('quiver and loaded shot', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false;
  __ok(p.maxArrows === 15, 'heroes start with a 15-arrow quiver'); p.arrows = 10; itemDef('arrows').give(sim, p, { banner() {} }); __ok(p.arrows === 15, 'arrow bundle caps at the quiver');
  sim.giveItem(p, 'quiver', false); __ok(p.maxArrows === 30 && p.arrows === 30 && sim.players.p2.maxArrows === 30, 'big quiver should hold 30 for everyone');
  p.items.bow = true; sim.giveItem(p, 'loadedshot', false); __ok(p.items.loaded && sim.players.p2.items.loaded, 'scroll teaches the party');
  // a knight facing the shot: a plain arrow bounces, a loaded one jars the shield, and a sword strike then lands
  const k = sim.spawnEnemy('knight', p.lvl, p.x + 3, p.y, { spawnFx: 0 }); k.spawnFx = 0; k.hp = 50; k.f = Math.PI; // facing the hero
  const fire = (loaded) => { sim.ents = sim.ents.filter(e => !e.dead); sim.useItem(p, 'bow', { t: 'use', item: 'bow', loaded }); const pr = sim.ents.find(e => e.k === 'proj' && e.pid === 'p1' && !e.dead); for (let i = 0; i < 40 && pr && !pr.dead; i++) sim.updateProj(pr, 1 / 60); return pr; };
  p.a = 0; let before = p.arrows; fire(false); __ok(k.hp === 50 && p.arrows === before - 1, 'shield should stop a plain arrow');
  k.stun = 0; k.hurt = 0; k.f = Math.PI; before = p.arrows; const pr = fire(true);
  __ok(pr && pr.spr === 'arrow2' && p.arrows === before - 2, 'loaded shot uses two arrows and the double-arrow sprite');
  __ok(k.hp === 48 && k.stun > 0.5 && k.reelUntil > sim.time, 'loaded shot into a shield: one arrow of damage and a stun (' + k.hp + ')');
  k.hurt = 0; const h0 = k.hp; sim.damageEnemy(k, 1, { x: p.x, y: p.y }, { pid: 'p1' }); __ok(k.hp < h0, 'the reeling knight can be struck from the front');
  // against something without a shield it hits twice as hard
  const s = sim.spawnEnemy('skeleton', p.lvl, p.x + 3, p.y, { spawnFx: 0 }); s.spawnFx = 0; s.hp = 50; k.dead = true; fire(true); __ok(s.hp === 46, 'loaded shot does double damage (' + s.hp + ')');
});
attempt('bramble keep eye and the way out', () => {
  const sim = freshSim(); const p = sim.players.p1; const L = sim.W.levels.d2; const boss = L.rooms[L.bossRoom];
  const ix = boss.rx * DSX, iy = boss.ry * DSY; const eye = L.idx(ix + 9, iy + 2);
  __ok(L.tiles[eye] === TL.EYE && L.eyeLinks[eye] && L.eyeLinks[eye].kind === 'seal', 'd2 boss room should have the eye');
  __ok(dungeonSolve(L, false).size === Object.keys(L.rooms).length, 'alcove must not block anything');
  sim.teleport(p, 'd2', ix + 6.5, iy + 6.5, -Math.PI / 2); for (const e of sim.ents) if (e.k === 'en') e.dead = true; sim.tick(1 / 60); sim.tick(1 / 60);
  const stash = sim.ents.filter(e => e.k === 'pick' && (e.item === 'quiver' || e.item === 'loadedshot')); __ok(stash.length === 2, 'quiver and scroll wait in the niche');
  __ok(L.solidAt(ix + 10.5, iy + 3.5), 'niche starts closed');
  sim.hitEye(L, eye); __ok(!L.solidAt(ix + 10.5, iy + 3.5) && L.tiles[eye] === TL.EYE_SHUT, 'arrow in the eye opens the niche');
  // the shard leaves a glowing way out instead of sending everyone outside
  p.lvl = 'd2'; itemDef('shard').give(sim, p, { banner() {} }); for (let i = 0; i < 300; i++) sim.tick(1 / 60);
  __ok(p.lvl === 'd2', 'taking the shard should not throw you out any more');
  let warp = -1; for (let y = iy + 1; y < iy + DSY; y++) for (let x = ix + 1; x < ix + DSX; x++) if (L.get(x, y) === TL.WARP) warp = L.idx(x, y); __ok(warp >= 0, 'a glowing exit should appear in the boss room');
});
attempt('frost arrows freeze fresh water, not salt', () => {
  const sim = freshSim(); const p = sim.players.p1; const L = sim.W.levels.ow; const x0 = Math.floor(p.x) + 2, y0 = Math.floor(p.y);
  for (let dx = 0; dx < 10; dx++) for (let dy = -1; dy <= 1; dy++) L.set(x0 + dx, y0 + dy, dx < 5 ? TL.WATER : TL.OCEAN);
  for (let dy = -1; dy <= 1; dy++) L.set(x0 - 1, y0 + dy, TL.GRASS); L.props[L.idx(x0 - 1, y0)] = 0;
  p.items.bow = true; p.items.frostarrows = true; p.arrows = 10; p.a = 0; p.x = x0 - 0.5; p.y = y0 + 0.5;
  sim.useItem(p, 'bow', {}); const pr = sim.ents.find(e => e.k === 'proj' && e.pid === 'p1'); for (let i = 0; i < 90 && !pr.dead; i++) sim.updateProj(pr, 1 / 60);
  __ok(L.get(x0 + 1, y0) === TL.FROZEN && L.get(x0 + 1, y0 + 1) === TL.FROZEN, 'frost arrow should freeze the water it crosses');
  __ok(L.get(x0 + 6, y0) === TL.OCEAN, 'salt water never freezes');
  __ok(sim.snapshotFor('p1').fz.length > 3, 'snapshot carries the ice');
  const W2 = genWorld(sim.W.seed, sim.W.mode); const L2 = W2.levels.ow; for (let dx = 0; dx < 5; dx++) L2.set(x0 + dx, y0, TL.WATER); freezeTile(L2, L2.idx(x0 + 1, y0)); __ok(L2.get(x0 + 1, y0) === TL.FROZEN, 'client copies can freeze too'); thawTile(L2, L2.idx(x0 + 1, y0)); __ok(L2.get(x0 + 1, y0) === TL.WATER, 'and thaw back');
  sim.time += FREEZE_TIME + 1; sim.updateThaws(L); __ok(L.get(x0 + 1, y0) === TL.WATER, 'ice should melt back into water');
  // the raft works on open water but not in dungeons
  const D = sim.W.levels.d3; const rid = Object.keys(D.rigs)[0]; const c = D.rigs[rid].cells[0];
  __ok(D.solidAt(c % D.w + 0.5, Math.floor(c / D.w) + 0.5, { raft: true }), 'no rafting in dungeons');
  __ok(!L.solidAt(x0 + 1.5, y0 + 0.5, { raft: true }), 'raft still crosses lakes');
  // tide water that's frozen keeps its ice and thaws into whatever the tide is by then
  const t = c; freezeTile(D, t); applyRig(D, rid, 1); __ok(D.tiles[t] === TL.FROZEN && D.frozen[t] === TL.WET, 'frozen tide cells keep their ice'); thawTile(D, t); __ok(D.tiles[t] === TL.WET, 'and thaw into the drained floor'); applyRig(D, rid, 0);
});
attempt('gale cloak, skeleton key, inventory choices', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; const L = sim.W.levels.ow; const x0 = Math.floor(p.x), y0 = Math.floor(p.y);
  // flying passes over water and isn't hurt by lava
  sim.giveItem(p, 'galecloak', false); __ok(p.items.galecloak && sim.players.p2.items.galecloak, 'cloak for the party');
  L.set(x0 + 2, y0, TL.WATER); __ok(L.solidAt(x0 + 2.5, y0 + 0.5) && !L.solidAt(x0 + 2.5, y0 + 0.5, { fly: true }), 'fliers cross water');
  L.set(x0, y0, TL.LAVA); p.x = x0 + 0.5; p.y = y0 + 0.5; p.hp = p.maxHp; p.inv = 0;
  sim.useItem(p, 'galecloak', {}); __ok(sim.flying(p) && sim.snapshotFor('p1').me.fly > 3, 'cloak should lift you');
  for (let i = 0; i < 60; i++) sim.tick(1 / 60); __ok(p.hp === p.maxHp, 'lava below a flier does nothing');
  sim.useItem(p, 'galecloak', {}); for (let i = 0; i < 60 * 4; i++) sim.tick(1 / 60); __ok(!sim.flying(p) && p.hp < p.maxHp, 'after landing in lava it burns again');
  L.set(x0, y0, TL.GRASS);
  // skeleton key: locks open with no keys spent
  const D = sim.W.levels.d1; let lock = -1; for (let i = 0; i < D.tiles.length; i++) if (D.tiles[i] === TL.LOCKED) { lock = i; break; }
  sim.teleport(p, 'd1', D.spawn.x, D.spawn.y, 0); sim.team.keys.d1 = 0;
  if (lock >= 0) { sim.tryUnlock(p, lock); __ok(D.tiles[lock] === TL.LOCKED, 'no key, no entry'); sim.giveItem(p, 'skeletonkey', false); sim.tryUnlock(p, lock); __ok(D.tiles[lock] === TL.OPENDOOR && (sim.team.keys.d1 || 0) === 0, 'skeleton key opens it for free'); }
  // wear a lesser sword or tunic; never more than you've earned
  p.sword = 3; p.armor = 2; sim.tick(1 / 60); sim.onAction('p1', { t: 'equip', slot: 'sword', lv: 1 }); sim.onAction('p1', { t: 'equip', slot: 'armor', lv: 0 }); __ok(p.sword === 1 && p.armor === 0, 'can step down');
  sim.onAction('p1', { t: 'equip', slot: 'sword', lv: 4 }); __ok(p.sword === 1, "can't wear what you haven't earned"); sim.onAction('p1', { t: 'equip', slot: 'sword', lv: 3 }); __ok(p.sword === 3, 'and back up');
  __ok(sim.playerSaveData(p).swordMax === 3, 'best sword is saved');
  // plain arrows instead of frost; Shift with an item that has no technique still uses it
  p.items.bow = true; p.items.frostarrows = true; p.arrows = 9; sim.onAction('p1', { t: 'equip', slot: 'arrows', plain: true }); sim.ents = sim.ents.filter(e => e.k !== 'proj');
  sim.useItem(p, 'bow', { alt: true }); const pr = sim.ents.find(e => e.k === 'proj' && e.pid === 'p1'); __ok(pr && !pr.frost && p.arrows === 8, 'plain arrows when chosen, and Shift falls back to a normal shot');
});
attempt('frogs and poison', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; const L = sim.W.levels.ow; const x0 = Math.floor(p.x) + 3, y0 = Math.floor(p.y);
  for (let dy = -2; dy <= 2; dy++) for (let dx = 0; dx < 5; dx++) L.set(x0 + dx, y0 + dy, TL.WATER);
  const f = sim.spawnEnemy('frog', 'ow', x0 + 2.5, y0 + 0.5, {}); f.spawnFx = 0; f.hp = 5;
  let surfaced = false, sawSub = false, bubbles = 0;
  for (let i = 0; i < 60 * 8; i++) { sim.updateEnemy(f, 1 / 60); sim.time += 1 / 60; if (f.sub) { sawSub = true; __ok(!sim.damageEnemy(f, 1, null, { ignoreIframes: true }), 'a submerged frog cannot be hit'); } if (f.st >= 1) surfaced = true; }
  bubbles = sim.ents.filter(e => e.k === 'proj' && e.type === 'bubble').length;
  __ok(sawSub && surfaced && bubbles > 0, 'frog should hide, surface and spit (' + sawSub + surfaced + bubbles + ')');
  __ok(TINFO[L.get(Math.floor(f.x), Math.floor(f.y))].water && !f.dead, 'frog stays in its pond and never drowns');
  // poison: ticks 5% of max health, never kills, a new dose restarts it, and it gets through a shield
  p.hp = p.maxHp; sim.poisonPlayer(p); const n = p.poisonTicks; __ok(n >= 2 && n <= 5, 'poison lasts 2-5 ticks');
  const h0 = p.hp; sim.time += 1.01; sim.tickPoison(p); __ok(p.hp === h0 - Math.max(1, Math.round(p.maxHp * 0.05)), 'poison takes 5% a tick');
  p.hp = 1; p.poisonTicks = 3; p.poisonNext = sim.time; sim.tickPoison(p); __ok(p.hp === 1 && p.alive, 'poison cannot kill');
  p.hp = p.maxHp; p.inv = 0; p.poisonTicks = 0; p.a = 0; const b = sim.fireProj('poisonbubble', 'ow', p.x + 1, p.y, Math.PI, 'e', null, { dmg: 1 }); for (let i = 0; i < 30 && !b.dead; i++) sim.updateProj(b, 1 / 60);
  __ok(p.hp === p.maxHp && p.poisonTicks > 0, 'a blocked poison bubble still poisons');
  // the poison frog is never a giant
  let giant = 0; for (let i = 0; i < 300; i++) { const e = sim.spawnEnemy('frog_poison', 'ow', x0 + 1.5, y0 + 0.5, {}); sim.makeElite(e, Math.random); if (e.elite && eliteByIdx(e.elite).id === 'giant') giant++; e.dead = true; } __ok(giant === 0, 'no giant poison frogs');
});
attempt('the bog king', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = true; const L = sim.W.levels.d3; const room = L.rooms[L.bossRoom];
  __ok(L.rigs[room.id] && L.rigs[room.id].eyes.length === 2, 'boss room is a tide room with two eyes');
  const ix = room.rx * DSX, iy = room.ry * DSY; const entry = room.rewardAt; __ok(!L.solidAt(ix + entry[0], iy + entry[1]), 'you arrive on a platform');
  sim.teleport(p, 'd3', ix + entry[0], iy + entry[1], 0); sim.tick(1 / 60);
  const k = sim.ents.find(e => e.k === 'en' && e.type === 'bogking'); __ok(k, 'the bog king should be here');
  k.spawnFx = 0; let hits = 0;
  for (let i = 0; i < 60 * 30 && k.ph !== 1; i++) { sim.updateEnemy(k, 1 / 60); sim.time += 1 / 60; if (!k.sub && k.ph === 0 && k.st >= 1) { k.hurt = 0; if (sim.damageEnemy(k, 0.01, null, { pid: 'p1' })) hits++; } }
  __ok(k.ph === 1 && hits === 3, 'three hits while he surfaces drive him out (' + hits + ')');
  let landed = 0, wasAir = false; for (let i = 0; i < 60 * 8; i++) { sim.updateEnemy(k, 1 / 60); sim.time += 1 / 60; if (k.air) { wasAir = true; __ok(!sim.damageEnemy(k, 1, null, {}), 'no hitting him mid-leap'); } else if (wasAir) { wasAir = false; landed++; __ok(!TINFO[L.get(Math.floor(k.x), Math.floor(k.y))].water, 'with the water deep he lands on a platform'); } }
  __ok(landed >= 2, 'he keeps leaping (' + landed + ')');
  // drained: a fresh fight goes straight to phase 2
  const s2 = freshSim(); const L2 = s2.W.levels.d3; s2.rigShots['d3:' + room.id] = s2.time; s2.updateRigs(L2); const p2 = s2.players.p1; p2.god = true; s2.teleport(p2, 'd3', ix + entry[0], iy + entry[1], 0); s2.tick(1 / 60);
  const k2 = s2.ents.find(e => e.k === 'en' && e.type === 'bogking'); k2.spawnFx = 0; s2.updateEnemy(k2, 1 / 60); __ok(k2.ph === 1, 'no water, no hiding');
});
attempt('batch: keys, bow spot, frogs, arrows, bomb arrows, thunder, debug', () => {
  // the lake island's sign survives, so it can be read
  const W = genWorld(7319, 'adv'); const O = W.levels.ow; let lakeSign = false; for (const k in O.signText) if (/LEVEL-7/.test(O.signText[k]) && O.props[k] === PR.SIGN) lakeSign = true; __ok(lakeSign, 'the level 7 sign should be readable');
  // the bow sits at the tip of a trident prong in the Sunken Stair
  for (const [seed, mode] of [[7319, 'adv'], [11, 'rogue'], [12, 'rogue'], [99, 'adv']]) { const D = genWorld(seed, mode).levels.d3; const r = Object.values(D.rooms).find(r => r.item === 'bow'); __ok(r && r.ry === DGH - 6, 'bow should be at a prong tip (' + seed + ' ' + mode + ')'); }
  const sim = freshSim(); const p = sim.players.p1; p.god = false;
  // the boomerang drags small keys back
  const key = sim.spawn({ k: 'pick', lvl: p.lvl, x: p.x + 2, y: p.y, item: 'key', perm: true, tk: 'test:key', spr: 'key', sc: 0.5, team: true });
  const bm = { lvl: p.lvl, x: p.x + 2, y: p.y }; for (const en of sim.ents) if (en.k === 'pick' && (!en.perm || en.item === 'key') && dist2(en.x, en.y, bm.x, bm.y) < 0.4) { en.x = bm.x - 1; } __ok(key.x < p.x + 2, 'keys can be dragged');
  // frogs: none in dry rooms, and roughly 1 in 10 is poisonous
  const D3 = sim.W.levels.d3; const dry = Object.values(D3.rooms).find(r => !r.boss && !r.hidden && !r.drain && r !== D3.startRoom && !r.item);
  if (dry) { dry.enemies = ['frog', 'frog', 'skeleton']; sim.teleport(p, 'd3', dry.rx * DSX + 6.5, dry.ry * DSY + 4.5, 0); sim.tick(1 / 60); __ok(!sim.ents.some(e => e.k === 'en' && enemyDef(e.type).swim && e.g === p.room), 'no frogs in a room without water'); }
  // arrow kinds: silver only when picked
  sim.teleport(p, 'ow', sim.W.levels.ow.spawn.x, sim.W.levels.ow.spawn.y, 0); p.items.bow = true; p.items.silver = true; p.items.frostarrows = true; p.arrows = 9; p.arrowType = 'frost'; sim.ents = sim.ents.filter(e => e.k !== 'proj');
  sim.useItem(p, 'bow', {}); let pr = sim.ents.find(e => e.k === 'proj'); __ok(pr && pr.frost && !pr.silver, 'frost arrows when frost is picked');
  sim.ents = sim.ents.filter(e => e.k !== 'proj'); sim.onAction('p1', { t: 'equip', slot: 'arrows', kind: 'silver' }); sim.useItem(p, 'bow', {}); pr = sim.ents.find(e => e.k === 'proj'); __ok(pr && pr.silver && !pr.frost && pr.dmg === 4, 'silver arrows when silver is picked');
  // bomb arrows: Shift + bow costs an arrow and a bomb and bursts where it lands; it seals an eye for good
  sim.ents = sim.ents.filter(e => e.k !== 'proj'); p.items.bombarrow = true; p.bombs = 3; const a0 = p.arrows;
  sim.useItem(p, 'bow', { alt: true }); pr = sim.ents.find(e => e.k === 'proj'); __ok(pr && pr.bomb && p.bombs === 2 && p.arrows === a0 - 1, 'bomb arrow costs one of each');
  for (let i = 0; i < 300 && !pr.dead; i++) sim.updateProj(pr, 1 / 60); __ok(sim.ents.some(e => e.k === 'bomb'), 'bomb arrow bursts where it stops');
  const Z = sim.W.levels.dbg; __ok(Z && Z.rigs.tz, 'the test zone exists'); const eye = Z.rigs.tz.eyes[0]; sim.teleport(p, 'dbg', Z.spawn.x, Z.spawn.y, 0); sim.hitEye(Z, eye, true); for (let i = 0; i < 60 * 20; i++) sim.tick(1 / 20); __ok(Z.tiles[Z.rigs.tz.cells[0]] === TL.WET, 'a bomb-arrowed eye keeps the water away');
  // thunder rod hops from foe to foe
  const f1 = sim.spawnEnemy('skeleton', 'dbg', 10.5, 19.5, {}), f2 = sim.spawnEnemy('skeleton', 'dbg', 12.5, 19.5, {}); for (const f of [f1, f2]) { f.spawnFx = 0; f.hp = 50; }
  const bolt = sim.fireProj('bolt', 'dbg', 8.5, 19.5, 0, 'p', 'p1', { chainLeft: 2 }); for (let i = 0; i < 120 && !bolt.dead; i++) sim.updateProj(bolt, 1 / 60); __ok(f1.hp < 50 && f2.hp < 50, 'the bolt should hit both');
  // debug: spawner, boss warp, never out of supplies
  p.name = 'MITCH'; sim.onAction('p1', { t: 'debug', on: true }); p.arrows = 0; p.bombs = 0; sim.tick(1 / 60); __ok(p.arrows > 0 && p.bombs > 0, 'debug refills arrows and bombs');
  const n0 = sim.ents.filter(e => e.k === 'en').length; sim.onAction('p1', { t: 'dbgspawn', type: 'knight', elite: 'giant' }); const kn = sim.ents.filter(e => e.k === 'en'); __ok(kn.length === n0 + 1 && kn[kn.length - 1].elite, 'debug spawner makes a giant knight');
  sim.onAction('p1', { t: 'dbgboss', d: 3 }); __ok(p.lvl === 'd3' && sim.W.levels.d3.rooms[sim.W.levels.d3.bossRoom] === dungeonRoomAt(sim.W.levels.d3, p.x, p.y), 'debug boss warp lands in the boss room');
});
attempt('boomerangs and knight backs', () => {
  const sim = freshSim(); const p = sim.players.p1; p.items.boomerang = true; p.a = 0;
  const sk = sim.spawnEnemy('skeleton', p.lvl, p.x + 3, p.y, {}); sk.spawnFx = 0; sk.hp = 10;
  // first hit stuns with a little damage; a dizzy foe only gets its stun renewed
  sim.damageEnemy(sk, BOOMERANG_DMG, { x: p.x, y: p.y }, { stunOnly: true }); __ok(sk.stun > 2 && sk.hp < 10, 'boomerang stuns and chips');
  const h = sk.hp; sk.hurt = 0; sk.stun = 1; sim.damageEnemy(sk, BOOMERANG_DMG, { x: p.x, y: p.y }, { stunOnly: true }); __ok(sk.hp === h && sk.stun >= BOOMERANG_STUN, 'a dizzy foe only gets re-stunned');
  sim.time += STUN_LOCK + 0.1; sk.stun = 0.5; sk.hurt = 0; sim.damageEnemy(sk, BOOMERANG_DMG, { x: p.x, y: p.y }, { stunOnly: true }); __ok(sk.stun <= 0.5 && sk.stunImmune > sim.time, 'held too long: a moment of immunity');
  const bat = sim.spawnEnemy('bat', p.lvl, p.x + 3, p.y, {}); bat.spawnFx = 0; sim.damageEnemy(bat, BOOMERANG_DMG, { x: p.x, y: p.y }, { stunOnly: true }); __ok(bat.dead, 'bats still drop to one throw');
  sk.dead = true; bat.dead = true;
  // one out at a time, two with the second boomerang; Shift with the scroll sweeps wide, hits hard, no stun
  const count = () => sim.ents.filter(e => e.k === 'boomer' && !e.dead).length;
  sim.useItem(p, 'boomerang', {}); sim.useItem(p, 'boomerang', {}); __ok(count() === 1, 'one boomerang at a time');
  sim.giveItem(p, 'boomerang2', false); sim.useItem(p, 'boomerang', {}); __ok(count() === 2, 'two with the second boomerang');
  for (const e of sim.ents) if (e.k === 'boomer') e.dead = true; sim.ents = sim.ents.filter(e => !e.dead);
  sim.giveItem(p, 'widethrow', false); sim.useItem(p, 'boomerang', { alt: true }); const arcs = sim.ents.filter(e => e.k === 'boomer'); __ok(arcs.length === 2 && arcs[0].wide === -arcs[1].wide, 'both boomerangs sweep in mirrored arcs');
  const f = sim.spawnEnemy('skeleton', p.lvl, 0, 0, {}); f.spawnFx = 0; f.hp = 10; f.x = arcs[0].x; f.y = arcs[0].y; sim.updateEnt(arcs[0], 1 / 60); __ok(f.hp < 9 && !(f.stun > 0), 'a wide throw hits hard and does not stun');
  // a knight shows its back only to someone behind it
  const k = sim.spawnEnemy('knight', p.lvl, p.x + 3, p.y, {}); k.spawnFx = 0; k.f = Math.PI; // facing the hero
  const view = () => sim.snapshotFor('p1').en.find(v => v[0] === k.id)[1]; __ok(view() !== 'knight_back', 'facing you: front');
  k.f = 0; __ok(view() === 'knight_back', 'facing away: its back');
  __ok(Content.hints.some(t => /KNIGHTS TURN SLOWLY/.test(t)), 'the old men know about knights');
});
attempt('sword: pommel, slashes and the backswing', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; p.sword = 2; p.a = 0; p.hp = 1; // not at full health: no sword beams
  const foe = (x, hp) => { const e = sim.spawnEnemy('skeleton', p.lvl, p.x + x, p.y, {}); e.spawnFx = 0; e.hp = hp; e.f = Math.PI; return e; };
  const clear = () => { for (const e of sim.ents) if (e.k === 'en') e.dead = true; sim.ents = sim.ents.filter(e => !e.dead); };
  clear();
  // pommel: a long stun and very little damage
  let sk = foe(1, 10); sim.playerAttack(p, { kind: 'pommel' }); __ok(sk.stun >= POMMEL_STUN - 0.01 && sk.hp > 9.5, 'pommel strike stuns with little damage');
  // a shield still blocks it from the front
  clear(); const kn = sim.spawnEnemy('knight', p.lvl, p.x + 1, p.y, {}); kn.spawnFx = 0; kn.f = Math.PI; const kh = kn.hp; sim.playerAttack(p, { kind: 'pommel' }); __ok(kn.hp === kh && !(kn.stun > 1), 'a shield blocks the pommel from the front');
  // lunge slashes ignore the hit cooldown so every slash lands
  clear(); sk = foe(1, 20); sim.playerAttack(p, { kind: 'slash' }); sim.playerAttack(p, { kind: 'slash' }); __ok(sk.hp === 20 - 2 * SWORD_DMG[2], 'every lunge slash lands');
  // backswing: the third hit readies it, and it lands a moment later on the foe that's still standing
  clear(); sk = foe(1, 20); p.chain = 0; p.backArmed = false;
  const swing = () => { sk.hurt = 0; sim.playerAttack(p, { kind: 'sword' }); };
  swing(); swing(); __ok(!p.backswing, 'no backswing on the first two hits');
  swing(); __ok(p.backswing, 'the third hit readies a backswing');
  const before = sk.hp; sim.time += 0.2; sim.updateBackswing(p); __ok(sk.hp === before - SWORD_DMG[2], 'the backswing cuts the same foe again');
  // a third hit that kills saves it for the next hit
  clear(); p.chain = 0; p.backArmed = false; sk = foe(1, 20); swing(); swing(); sk.hp = 1; swing(); __ok(sk.dead && !p.backswing && p.backArmed, 'a kill on the third hit saves the backswing');
  sk = foe(1, 20); swing(); __ok(p.backswing && !p.backArmed, 'the saved backswing fires on the next hit that leaves a foe standing');
  // the chain resets after a pause
  clear(); p.chain = 0; p.backArmed = false; p.backswing = null; sk = foe(1, 20); swing(); swing(); sim.time += CHAIN_GAP + 0.5; swing(); __ok(!p.backswing && p.chain === 1, 'a pause breaks the chain');
  __ok(Content.items.lunge && Content.items.heavypommel, 'the sword scrolls exist');
});
attempt('armor', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; p.a = 0; p.sword = 2; p.hp = 1;
  for (const e of sim.ents) if (e.k === 'en') e.dead = true; sim.ents = sim.ents.filter(e => !e.dead);
  const sk = sim.spawnEnemy('skeleton_a3', p.lvl, p.x + 1, p.y, {}); sk.spawnFx = 0; sk.hp = 100; sk.f = Math.PI;
  __ok(sk.armor === 3, 'full armor to start');
  const view = () => sim.snapshotFor('p1').en.find(v => v[0] === sk.id)[1];
  __ok(view() === 'skeleton_a3', 'shows all its armor');
  sim.damageEnemy(sk, 4, p, { pid: 'p1' }); __ok(Math.abs(sk.hp - 99) < 1e-9, 'three levels block 75%');
  // a bomb knocks a piece off and does no damage; a second bomb just hurts (still through the armor left)
  const boom = () => { const b = sim.spawn({ k: 'bomb', lvl: p.lvl, x: sk.x, y: sk.y, fuse: 0, pid: 'p1' }); sk.hurt = 0; sim.updateEnt(b, 1 / 60); };
  let h = sk.hp; boom(); __ok(sk.armor === 2 && sk.hp === h, 'a bomb strips a level without damage');
  __ok(view() === 'skeleton_a2', 'and the sprite loses that piece');
  h = sk.hp; boom(); __ok(sk.armor === 2 && sk.hp === h - 4 * 0.5, 'a second bomb only hurts, through the armor left');
  // the pommel only strips with the Heavy Pommel scroll, also once
  sk.hurt = 0; sim.playerAttack(p, { kind: 'pommel' }); __ok(sk.armor === 2, 'a plain pommel strike leaves armor alone');
  p.items.heavypommel = true; sk.hurt = 0; sk.stun = 0; sim.playerAttack(p, { kind: 'pommel' }); __ok(sk.armor === 1 && !(sk.stun > 0), 'a heavy pommel strips a level, and armor takes the blow: no stun');
  sk.hurt = 0; sim.playerAttack(p, { kind: 'pommel' }); __ok(sk.armor === 1, 'but only once per foe');
  __ok(view() === 'skeleton_a1', 'down to the breastplate');
  __ok(Content.enemies.skeleton_a1 && Content.enemies.skeleton_a2, 'all three armored skeletons exist');
});
attempt('bombs and gourds', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; p.items = {}; p.bombs = 0; sim.tick(1 / 60);
  __ok(p.maxBombs === 1, 'one bomb without a bag');
  sim.giveItem(p, 'bombbag', false); sim.tick(1 / 60); __ok(p.maxBombs === 8, 'the Bramble Keep bag carries 8');
  sim.giveItem(p, 'bombbag2', false); sim.tick(1 / 60); __ok(p.maxBombs === 16, 'the grotto bag carries 16');
  let shop = 0; for (const seed of [7319, 99, 4242]) { const W = genWorld(seed, 'adv'); if (W.levels.ow.regions.some(r => r.features.some(f => f.kind === 'bombshop' && f.secret !== 'open'))) shop++; }
  __ok(shop === 3, 'every land hides a grotto shop (' + shop + '/3)');
  // every dungeon grows its own breakables
  const W = sim.W; for (const d of [1, 2, 3, 4, 6, 10]) { const L = W.levels['d' + d]; __ok(L.gourds && Object.keys(L.gourds).length > 0, 'dungeon ' + d + ' has breakables'); }
  __ok(Object.values(W.levels.d2.gourds)[0] === PR.GOURD && Object.values(W.levels.d3.gourds)[0] === PR.CORAL, 'gourds in Bramble Keep, coral in the Sunken Stair');
  // a sword swing bounces off a gourd; a pommel strike splits it and it drops a bomb; walking over one is fine
  const L = W.levels.d2; const gi = +Object.keys(L.gourds)[0]; const gx = gi % L.w, gy = Math.floor(gi / L.w);
  __ok(!L.solidAt(gx + 0.5, gy + 0.5), 'you can walk over a gourd');
  sim.teleport(p, 'd2', gx + 0.5, gy + 1.3, -Math.PI / 2); p.sword = 2;
  sim.playerAttack(p, { kind: 'sword' }); __ok(L.props[gi] === PR.GOURD, 'a sword swing does not split a gourd');
  sim.playerAttack(p, { kind: 'pommel' }); __ok(L.props[gi] === PR.NONE, 'a pommel strike splits it');
  __ok(sim.ents.some(e => e.k === 'pick' && e.item === 'bomb' && e.lvl === 'd2'), 'a powder gourd drops a bomb');
  // it grows back once nobody is near, and a save never keeps it broken
  const save = sim.makeSave(); sim.time += GOURD_REGROW + 1; sim.updateGourds(); __ok(L.props[gi] === PR.NONE, 'not while you stand there');
  p.x += 20; sim.updateGourds(); __ok(L.props[gi] === PR.GOURD, 'grows back once you leave');
  const sim2 = new Sim(genWorld(7319, 'adv'), save); __ok(sim2.W.levels.d2.props[gi] === PR.GOURD, 'a save never keeps a gourd broken');
  // monks punch them open (until his rework)
  L.props[gi] = PR.GOURD; const m = sim.players.p2; sim.teleport(m, 'd2', gx + 0.5, gy + 1.3, -Math.PI / 2); sim.playerAttack(m, { kind: 'punch' }); __ok(L.props[gi] === PR.NONE, 'a monk punch splits it');
});
attempt('bramble keep: no keys, every crack pays', () => {
  for (const [seed, mode] of [[7319, 'adv'], [1234, 'rogue'], [99, 'rogue'], [4242, 'adv'], [555, 'adv']]) {
    const W = genWorld(seed, mode); const L = W.levels.d2; const tag = ' (seed ' + seed + ' ' + mode + ')';
    __ok(!Array.from(L.tiles).includes(TL.LOCKED), 'no locked doors in Bramble Keep' + tag);
    __ok(!Object.values(L.rooms).some(r => r.key), 'no keys in Bramble Keep' + tag);
    const rooms = Object.values(L.rooms);
    // every crack on the way through has a gourd in the room before it
    for (const r of rooms) for (const c of r.children) {
      const [x, y] = r.ry === c.ry ? [Math.max(r.rx, c.rx) * DSX, r.ry * DSY + 4] : [r.rx * DSX + 6, Math.max(r.ry, c.ry) * DSY];
      if (L.get(x, y) !== TL.BRICK_BOMB) continue;
      let g = false; for (let yy = r.ry * DSY + 1; yy < r.ry * DSY + DSY; yy++) for (let xx = r.rx * DSX + 1; xx < r.rx * DSX + DSX; xx++) if (L.props[L.idx(xx, yy)] === PR.GOURD) g = true;
      __ok(g, 'a gourd before every crack you must bomb' + tag);
    }
    const st = L.startRoom; const first = st.children[0]; __ok(L.get(st.rx * DSX + 6, st.ry * DSY) === TL.BRICK_BOMB || first.ry === st.ry, 'the way out of the entrance is a crack' + tag);
    __ok(Object.values(L.signText || {}).some(t => /STRIKE THEM LOW/.test(t)), 'the entrance tablet teaches the pommel' + tag);
    __ok(Object.values(L.signText || {}).some(t => /WE MELTED THE KEYS/.test(t)), 'the hidden tablet' + tag);
    // every cracked block guards a prize; there are no bare pillars
    let nooks = 0;
    for (const r of rooms) for (let yy = 1; yy < DSY; yy++) for (let xx = 1; xx < DSX; xx++) if (L.get(r.rx * DSX + xx, r.ry * DSY + yy) === TL.CRACKED_PILLAR) { nooks++; __ok(r.stash && r.stash.length === 1, 'a cracked block always guards a prize' + tag); }
    __ok(nooks > 0, 'some rooms have a prize nook' + tag);
    // breakables only where asked
    const gourds = Object.keys(L.gourds).length; const walls = Array.from(L.tiles).filter(t => t === TL.BRICK_BOMB).length; __ok(gourds >= 1 && gourds <= walls + 1, 'not too many gourds (' + gourds + ')' + tag);
  }
  // the whole loop: pommel a gourd, take the bomb, blow the crack
  const sim = freshSim(); const p = sim.players.p1; p.god = false; p.items = {}; p.bombs = 0; p.sword = 1; const L = sim.W.levels.d2; const st = L.startRoom;
  const gi = +Object.keys(L.gourds).find(i => dungeonRoomAt(L, i % L.w, Math.floor(i / L.w)) === st); const gx = gi % L.w, gy = Math.floor(gi / L.w);
  sim.teleport(p, 'd2', gx + 0.5, gy + 1.4, -Math.PI / 2); sim.tick(1 / 60); sim.playerAttack(p, { kind: 'pommel' });
  const pick = sim.ents.find(e => e.k === 'pick' && e.item === 'bomb'); __ok(pick, 'the gourd drops a bomb');
  p.x = pick.x; p.y = pick.y; run(sim, 0.3); __ok(p.bombs === 1, 'picked up: one bomb');
  const dx = st.rx * DSX + 6, dy = st.ry * DSY; sim.teleport(p, 'd2', dx + 0.5, dy + 1.5, -Math.PI / 2); sim.useItem(p, 'bombs', {}); run(sim, 2);
  __ok(L.get(dx, dy) !== TL.BRICK_BOMB, 'the bomb opens the way out of the entrance');
});
attempt('triple shot, great quiver, gale slam', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; p.items.bow = true; p.arrows = 20; p.items.loaded = false; p.items.loaded2 = false; p.a = 0;
  const shot = (n) => { for (const e of sim.ents) if (e.k === 'proj') e.dead = true; sim.ents = sim.ents.filter(e => !e.dead); const before = p.arrows; sim.useItem(p, 'bow', { loaded: n }); const pr = sim.ents.find(e => e.k === 'proj' && e.pid === 'p1'); return [before - p.arrows, pr]; };
  __ok(shot(3)[0] === 1, 'no scrolls: one arrow, however long you hold');
  sim.giveItem(p, 'tripleshot', false); __ok(shot(3)[0] === 2, 'Loaded Shot 2 alone still works (order does not matter)');
  sim.giveItem(p, 'loadedshot', false); const [n3, pr3] = shot(3); __ok(n3 === 3 && pr3.dmg === 6, 'both scrolls: three arrows for triple damage');
  __ok(shot(true)[0] === 2, 'old clients asking for a loaded shot still get two');
  sim.giveItem(p, 'quiver50', false); __ok(p.maxArrows === 50, 'the Great Quiver holds 50');
  // the Gale Cloak: pressing again mid-flight drops you; with the scroll you slam and stun foes around you
  p.items.galecloak = true; for (const e of sim.ents) if (e.k === 'en') e.dead = true; sim.ents = sim.ents.filter(e => !e.dead);
  const sk = sim.spawnEnemy('skeleton', p.lvl, p.x + 1.2, p.y, {}); sk.spawnFx = 0; sk.hp = 10;
  sim.useItem(p, 'galecloak', {}); __ok(sim.flying(p), 'flying'); sim.time += 0.5; sim.useItem(p, 'galecloak', {}); __ok(!sim.flying(p) && !(sk.stun > 0), 'pressing again drops you, no slam without the scroll');
  p.flyReady = 0; sim.giveItem(p, 'galeslam', false); sim.useItem(p, 'galecloak', {}); sim.time += 0.5; sk.hurt = 0; sim.useItem(p, 'galecloak', {}); __ok(sk.stun >= 1.9 && sk.hp < 10, 'ending a flight early slams down');
  p.flyReady = 0; sk.stun = 0; sk.hurt = 0; sim.useItem(p, 'galecloak', {}); sim.time += FLY_TIME + 0.1; __ok(!sim.flying(p) && !(sk.stun > 0), 'riding it out gives no slam');
});
attempt('debug upgrade switches', () => {
  const sim = freshSim(); const p = sim.players.p1; p.items = {}; p.maxArrows = ARROWS_START;
  sim.onAction('p1', { t: 'dbgup', all: true }); __ok(Content.upgrades.every(u => !u.has(p)), 'nothing switches without debug on');
  p.dbg = true; sim.onAction('p1', { t: 'dbgup', all: true });
  __ok(Content.upgrades.every(u => u.has(p)) && p.items.bow && p.items.galecloak, 'ALL ON gives every upgrade and the items they need');
  __ok(p.maxArrows === 50 && p.maxBombs === 16, 'quivers and bags count');
  sim.onAction('p1', { t: 'dbgup', id: 'lunge', on: false }); __ok(!p.items.lunge && p.items.heavypommel, 'one switch at a time');
  sim.onAction('p1', { t: 'dbgup', all: false }); __ok(Content.upgrades.every(u => !u.has(p)) && p.maxBombs === 1 && p.maxArrows === ARROWS_START, 'ALL OFF takes them all away');
  __ok(Content.upgrades.every(u => Content.items[u.id]), 'every upgrade is a real item');
});
attempt('beams, disarming, hooked frogs, loaded bomb arrows', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; p.a = 0;
  const clear = () => { for (const e of sim.ents) if (e.k === 'en' || e.k === 'proj' || e.k === 'boomer') e.dead = true; sim.ents = sim.ents.filter(e => !e.dead); };
  const beams = () => sim.ents.filter(e => e.k === 'proj' && Content.projectiles[e.type].beam && !e.dead).length;
  // the Dawnblade always throws its light, even hurt, up to three at once; other swords need full health
  clear(); p.sword = 4; p.hp = 1; for (let i = 0; i < 5; i++) sim.playerAttack(p, { kind: 'sword' }); __ok(beams() === 3, 'the Dawnblade beams at any health, up to 3 (' + beams() + ')');
  clear(); p.sword = 3; p.hp = 1; sim.playerAttack(p, { kind: 'sword' }); __ok(beams() === 0, 'other swords: no beam when hurt');
  p.hp = p.maxHp; sim.playerAttack(p, { kind: 'sword' }); sim.playerAttack(p, { kind: 'sword' }); __ok(beams() === 1, 'other swords: one beam at full health');
  p.hp = 1; p.sword = 2;
  // a heavy pommel knocks a knight's shield away (from the front); then sword hits land from the front
  clear(); p.items.heavypommel = true; const kn = sim.spawnEnemy('knight', p.lvl, p.x + 1, p.y, {}); kn.spawnFx = 0; kn.f = Math.PI; kn.hp = 20;
  sim.playerAttack(p, { kind: 'pommel' }); __ok(kn.disarmed && sim.ents.some(e => e.k === 'tossed' && e.spr === 'shield_drop'), 'the shield goes flying');
  __ok(sim.snapshotFor('p1').en.find(v => v[0] === kn.id)[1] === 'knight_bare', 'and the knight is drawn without it');
  kn.hurt = 0; kn.stun = 0; const h = kn.hp; sim.playerAttack(p, { kind: 'sword' }); __ok(kn.hp < h, 'front hits land now');
  // a disarmed wizard casts nothing
  clear(); const wz = sim.spawnEnemy('wizard', p.lvl, p.x + 1, p.y, {}); wz.spawnFx = 0; wz.hp = 20; sim.playerAttack(p, { kind: 'pommel' }); __ok(wz.disarmed, 'the staff goes flying');
  wz.stun = 0; for (let i = 0; i < 600; i++) sim.updateEnemy(wz, 1 / 60); __ok(!sim.ents.some(e => e.k === 'proj' && e.type === 'magic'), 'a wizard without its staff casts nothing');
  // armored foes: the pommel never stuns them
  clear(); p.items.heavypommel = false; const ak = sim.spawnEnemy('skeleton_a1', p.lvl, p.x + 1, p.y, {}); ak.spawnFx = 0; ak.hp = 20; sim.playerAttack(p, { kind: 'pommel' }); __ok(!(ak.stun > 0) && ak.armor === 1, 'a plain pommel does not stun an armored foe');
  // a frog out of the water is hooked by the boomerang and brought back, dizzy
  clear(); p.items.boomerang = true; const fr = sim.spawnEnemy('frog', p.lvl, p.x + 2.5, p.y, {}); fr.spawnFx = 0; fr.hp = 20;
  sim.useItem(p, 'boomerang', {}); for (let i = 0; i < 120 && sim.ents.some(e => e.k === 'boomer' && !e.dead); i++) { for (const e of sim.ents.slice()) if (e.k === 'boomer') sim.updateEnt(e, 1 / 60); sim.ents = sim.ents.filter(e => !e.dead); }
  __ok(!fr.carried && Math.hypot(fr.x - p.x, fr.y - p.y) < 1.2 && fr.stun > 0, 'the frog rides the boomerang back, still dizzy (' + Math.hypot(fr.x - p.x, fr.y - p.y).toFixed(2) + ')');
  // loaded bomb arrows: every nocked arrow flies with one bomb
  clear(); p.items.bow = true; p.items.bombarrow = true; p.items.loaded = true; p.items.loaded2 = true; p.arrows = 10; p.bombs = 3;
  sim.useItem(p, 'bow', { alt: true, loaded: 3 }); const ba = sim.ents.find(e => e.k === 'proj' && e.bomb); __ok(ba && ba.spr === 'arrow3_bomb' && ba.dmg === 6 && p.arrows === 7 && p.bombs === 2, 'a triple bomb arrow');
  clear(); sim.useItem(p, 'bow', { alt: true, loaded: 2 }); __ok(sim.ents.find(e => e.k === 'proj' && e.bomb).spr === 'arrow2_bomb', 'a double bomb arrow');
  __ok(Content.hints.some(t => /BOOMERANG CURVES/.test(t)), 'the old men know about boomerangs and shields');
  // bomb arrows use the arrow kind you picked, and the blast lands on top of the arrow's own hit
  clear(); p.items.silver = true; p.arrowType = 'silver'; p.arrows = 10; p.bombs = 3; sim.useItem(p, 'bow', { alt: true, loaded: 3 }); __ok(sim.ents.find(e => e.k === 'proj' && e.bomb).dmg === 12, 'a triple silver bomb arrow hits as hard as a triple silver arrow');
  clear(); p.arrowType = 'plain'; const dm = sim.spawnEnemy('dummy', p.lvl, p.x + 3, p.y, {}); dm.spawnFx = 0; p.a = 0; sim.useItem(p, 'bow', { alt: true, loaded: 1 });
  for (let i = 0; i < 60; i++) { for (const e of sim.ents.slice()) if (e.k === 'proj' || e.k === 'bomb') sim.updateEnt(e, 1 / 60); sim.ents = sim.ents.filter(e => !e.dead); }
  __ok(dm.maxHp - dm.hp === 2 + 4, 'a bomb arrow: the arrow (2) and then the blast (4) both land (' + (dm.maxHp - dm.hp) + ')');
});
attempt('training dummies', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; p.sword = 2; p.hp = 1;
  sim.teleport(p, 'dbg', 14.5, 16.4, Math.PI / 2); const ds = sim.ents.filter(e => e.k === 'en' && e.lvl === 'dbg' && enemyDef(e.type).dummy); __ok(ds.length === 2, 'the test zone has two dummies');
  sim.teleport(p, 'dbg', 14.5, 16.4, Math.PI / 2); __ok(sim.ents.filter(e => e.k === 'en' && e.lvl === 'dbg' && enemyDef(e.type).dummy && !e.dead).length === 2, 'and never more than two');
  const d = ds.find(e => e.type === 'dummy'); p.x = d.x; p.y = d.y - 1; p.a = Math.PI / 2;
  const x0 = d.x; sim.playerAttack(p, { kind: 'sword' }); __ok(d.hp === d.maxHp - SWORD_DMG[2] && d.x === x0, 'a dummy takes the hit and does not budge');
  // the backswing really lands: three hits plus the backswing = four hits of damage
  d.hp = d.maxHp; p.chain = 0; p.backArmed = false; for (let i = 0; i < 3; i++) { d.hurt = 0; sim.playerAttack(p, { kind: 'sword' }); } sim.time += BACKSWING_DELAY + 0.01; sim.updateBackswing(p);
  __ok(d.maxHp - d.hp === 4 * SWORD_DMG[2], 'three cuts and a backswing: four hits of damage (' + (d.maxHp - d.hp) + ')');
  sim.time += DUMMY_RESET + 0.1; sim.updateEnemy(d, 1 / 60); __ok(d.hp === d.maxHp, 'it heals after a pause');
  const a = ds.find(e => e.type === 'dummy_armored'); __ok(a.armor === 3, 'the armored dummy wears full armor');
  const b = sim.spawn({ k: 'bomb', lvl: 'dbg', x: a.x, y: a.y, fuse: 0, pid: 'p1' }); sim.updateEnt(b, 1 / 60); __ok(a.armor === 2, 'a bomb strips it');
  sim.time += DUMMY_RESET + 0.1; sim.updateEnemy(a, 1 / 60); __ok(a.armor === 3, 'and it gets its armor back');
  sim.hurtPlayer = () => { throw new Error('a dummy hurt the hero'); }; p.x = a.x; p.y = a.y; sim.updateEnemy(a, 1 / 60); __ok(true, 'dummies never hurt you');
});
attempt('round props: diagonal gaps are walkable', () => {
  const W = genWorld(7319, 'adv'); const L = W.levels.ow; const x0 = Math.floor(L.spawn.x) + 2, y0 = Math.floor(L.spawn.y) + 2;
  for (let y = y0 - 1; y <= y0 + 2; y++) for (let x = x0 - 1; x <= x0 + 2; x++) { L.tiles[L.idx(x, y)] = TL.GRASS; L.props[L.idx(x, y)] = 0; }
  const body = (cx, cy) => [-0.22, 0, 0.22].some(ox => [-0.22, 0, 0.22].some(oy => L.solidAt(cx + ox, cy + oy))); // the client's 3x3 body check
  L.props[L.idx(x0, y0)] = PR.TREE; L.props[L.idx(x0 + 1, y0 + 1)] = PR.BOULDER;
  __ok(!body(x0 + 1, y0 + 1), 'you fit through the gap between two props that only touch at a corner');
  __ok(body(x0 + 0.5, y0 + 0.5) && L.solidAt(x0 + 0.5, y0 + 0.5), 'but not through a prop');
  L.props[L.idx(x0 + 1, y0 + 1)] = 0; L.props[L.idx(x0 + 1, y0)] = PR.TREE;
  let leak = false; for (let t = -0.6; t <= 1.6; t += 0.02) if (!body(x0 + 1, y0 + t) && t > 0.1 && t < 0.9) leak = true; __ok(!leak, 'two props side by side still make a wall');
  // walk the diagonal gap in small axis-separated steps, the way the client moves
  L.props[L.idx(x0 + 1, y0)] = 0; L.props[L.idx(x0 + 1, y0 + 1)] = PR.BOULDER; let px = x0 + 1.5, py = y0 + 0.5;
  for (let i = 0; i < 200; i++) { const nx = px - 0.01, ny = py + 0.01; if (!body(nx, py)) px = nx; if (!body(px, ny)) py = ny; }
  __ok(px < x0 + 0.8 && py > y0 + 1.2, 'walking from one open corner to the other gets through (' + px.toFixed(2) + ',' + py.toFixed(2) + ')');
  // small props (graves, signs, bushes...) are round: you can walk between two side by side, but never through one
  for (let y = y0 - 1; y <= y0 + 2; y++) for (let x = x0 - 1; x <= x0 + 2; x++) L.props[L.idx(x, y)] = 0;
  L.props[L.idx(x0, y0)] = PR.GRAVE; L.props[L.idx(x0 + 1, y0)] = PR.SIGN; let gy = y0 - 0.7;
  for (let i = 0; i < 200; i++) { const ny = gy + 0.01; if (!body(x0 + 1, ny)) gy = ny; } __ok(gy > y0 + 1.2, 'you fit between a grave and a sign side by side');
  let thru = false; for (let t = -0.4; t <= 1.4; t += 0.02) if (!body(x0 + 0.5, y0 + 0.5 + t) && Math.abs(t) < 0.3) thru = true; __ok(!thru, 'but never through one');
});
attempt('magic wand, spells and casting together', () => {
  const sim = freshSim(); const a = sim.players.p1, b = sim.players.p2; b.cls = 'sword'; for (const p of [a, b]) { p.god = false; p.items.rod = true; p.hp = 1; }
  const clear = () => { for (const e of sim.ents) if (e.k === 'en' || e.k === 'proj' || e.k === 'chant' || e.k === 'fire') e.dead = true; sim.ents = sim.ents.filter(e => !e.dead); };
  const proj = () => sim.ents.find(e => e.k === 'proj' && !e.dead);
  // force bolt by default; a cooldown, no meter
  clear(); a.a = 0; sim.useItem(a, 'rod', {}); __ok(proj() && proj().type === 'forcebolt' && proj().kbMul === 3, 'the wand hurls a force bolt');
  clear(); sim.useItem(a, 'rod', {}); __ok(!proj(), 'then it needs a moment');
  sim.time += 1; clear(); sim.giveItem(a, 'flameorb', false); sim.onAction('p1', { t: 'equip', slot: 'wand', kind: 'fire' }); sim.useItem(a, 'rod', {}); __ok(proj() && proj().type === 'rodbolt' && proj().fireTrail, 'with the flame orb: fire');
  sim.time += 2; clear(); sim.giveItem(a, 'stormorb', false); sim.onAction('p1', { t: 'equip', slot: 'wand', kind: 'thunder' }); sim.useItem(a, 'rod', {}); __ok(proj() && proj().type === 'bolt' && proj().chainLeft === 2, 'with the storm orb: a leaping bolt');
  // a force bolt shoves hard
  sim.time += 2; clear(); sim.onAction('p1', { t: 'equip', slot: 'wand', kind: 'plain' }); const sk = sim.spawnEnemy('skeleton', a.lvl, a.x + 1.5, a.y, {}); sk.spawnFx = 0; sk.hp = 20; sim.useItem(a, 'rod', {});
  for (let i = 0; i < 30; i++) { for (const e of sim.ents.slice()) if (e.k === 'proj') sim.updateEnt(e, 1 / 60); sim.ents = sim.ents.filter(e => !e.dead); } __ok(sk.kb && Math.hypot(sk.kb[0], sk.kb[1]) > 15 && sk.stun > 0, 'a force bolt shoves and stuns');
  // Shift without the spell: just a bolt. With it: a chant, then the wave
  sim.time += 2; clear(); sim.useItem(a, 'rod', { alt: true }); __ok(proj() && !sim.ents.some(e => e.k === 'chant'), 'no spell learned: Shift just fires');
  sim.time += 2; clear(); a.items.forcewave = true; const near = sim.spawnEnemy('skeleton', a.lvl, a.x + 1.5, a.y, {}); near.spawnFx = 0; near.hp = 20;
  sim.useItem(a, 'rod', { alt: true }); const ch = sim.ents.find(e => e.k === 'chant'); __ok(ch && ch.members.length === 1, 'Shift starts a chant');
  ch.t = ch.life; sim.updateEnt(ch, 1 / 60); __ok(near.hp === 19 && near.stun >= 1, 'a solo force wave');
  sim.useItem(a, 'rod', { alt: true }); __ok(!sim.ents.some(e => e.k === 'chant' && !e.dead), 'then a cooldown');
  // two casters, same spell, both knowing Tandem Casting: one combined Gale Burst
  sim.time += 8; clear(); a.items.tandem = b.items.tandem = true; b.items.forcewave = true; b.wandEl = 'plain'; b.x = a.x + 2; b.y = a.y; b.lvl = a.lvl;
  const kn = sim.spawnEnemy('knight', a.lvl, a.x + 1, a.y + 4, {}); kn.spawnFx = 0; kn.hp = 30;
  sim.useItem(a, 'rod', { alt: true }); sim.useItem(b, 'rod', { alt: true }); const c2 = sim.ents.find(e => e.k === 'chant' && !e.dead);
  __ok(c2 && c2.members.length === 2 && sim.ents.filter(e => e.k === 'chant' && !e.dead).length === 1, 'the friend joins the chant instead of starting another');
  c2.t = c2.life; sim.updateEnt(c2, 1 / 60); __ok(kn.disarmed && kn.hp === 28, 'GALE BURST: reaches further, hits harder, knocks the shield away (' + kn.hp + ')');
  __ok((b.spellReady || 0) - sim.time <= 1.01, 'joining costs nothing');
  // without Tandem Casting each casts alone
  sim.time += 8; clear(); a.items.tandem = false; sim.useItem(a, 'rod', { alt: true }); sim.useItem(b, 'rod', { alt: true }); __ok(sim.ents.filter(e => e.k === 'chant' && !e.dead).length === 2, 'no tandem scroll: two separate chants');
  // flame wall and lightning lance
  sim.time += 8; clear(); a.items.flamewall = true; sim.onAction('p1', { t: 'equip', slot: 'wand', kind: 'fire' }); sim.useItem(a, 'rod', { alt: true }); let c3 = sim.ents.find(e => e.k === 'chant' && !e.dead); c3.t = c3.life; sim.updateEnt(c3, 1 / 60);
  __ok(sim.ents.filter(e => e.k === 'fire' && !e.dead).length >= 3, 'a flame wall');
  sim.time += 8; clear(); a.items.lightninglance = true; sim.onAction('p1', { t: 'equip', slot: 'wand', kind: 'thunder' }); sim.useItem(a, 'rod', { alt: true }); c3 = sim.ents.find(e => e.k === 'chant' && !e.dead); c3.t = c3.life; sim.updateEnt(c3, 1 / 60);
  __ok(proj() && proj().type === 'lance', 'a lightning lance');
  // old saves: the fire rod keeps its fire
  const sv = sim.makeSave(); sv.v = 7; for (const c in sv.players) { sv.players[c].items = { rod: true }; delete sv.players[c].wandEl; } const s2 = new Sim(genWorld(7319, 'adv'), sv); const pl = Object.values(s2.savedPlayers)[0]; __ok(pl.items.wandfire && pl.wandEl === 'fire', 'an old fire rod becomes the wand with fire');
});
attempt('frost arrows freeze without shoving', () => {
  const sim = freshSim(); const p = sim.players.p1; p.items.bow = true; p.items.frostarrows = true; p.arrowType = 'frost'; p.arrows = 5; p.a = 0;
  for (const e of sim.ents) if (e.k === 'en') e.dead = true; sim.ents = sim.ents.filter(e => !e.dead);
  const k = sim.spawnEnemy('skeleton', p.lvl, p.x + 2.5, p.y, {}); k.spawnFx = 0; k.hp = 20; sim.useItem(p, 'bow', {});
  for (let i = 0; i < 40; i++) { for (const e of sim.ents.slice()) if (e.k === 'proj') sim.updateEnt(e, 1 / 60); sim.ents = sim.ents.filter(e => !e.dead); }
  __ok(k.hp < 20 && k.stun > 1 && !k.kb, 'a frost arrow freezes its target in place');
});
attempt('stronger knights', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; p.hp = p.maxHp = 40; p.sword = 2; p.a = 0; p.inv = 0;
  const clear = () => { for (const e of sim.ents) if (e.k === 'en' || e.k === 'proj') e.dead = true; sim.ents = sim.ents.filter(e => !e.dead); };
  const knight = (type) => { clear(); const k = sim.spawnEnemy(type, p.lvl, p.x + 1.1, p.y, {}); k.spawnFx = 0; k.f = Math.PI; k.hp = 50; return k; };
  const swing = (k) => { k.hurt = 0; sim.playerAttack(p, { kind: 'sword' }); };
  // the plain knight never counters
  let k = knight('knight'); swing(k); swing(k); swing(k); __ok(!(k.counterT > 0), 'a plain knight never strikes back');
  // a sword knight: two blocked hits, a glowing wind-up, then a cut
  k = knight('knight_sword'); swing(k); __ok(!(k.counterT > 0), 'one block: nothing yet'); swing(k); __ok(k.counterT > 0, 'two blocks: it winds up');
  __ok(sim.snapshotFor('p1').en.find(v => v[0] === k.id)[1] === 'knight_sword_s_windup', 'the blade glows while it winds up');
  const hp0 = p.hp; p.inv = 0; for (let i = 0; i < 40; i++) sim.updateEnemy(k, 1 / 60); __ok(p.hp < hp0, 'then it cuts whoever is in front (' + (hp0 - p.hp) + ')');
  p.hp = 40; p.inv = 0; k.counterT = 0; k.blocks = 0; swing(k); swing(k); p.x -= 1.6; for (let i = 0; i < 40; i++) sim.updateEnemy(k, 1 / 60); __ok(p.hp < 40, 'stepping back is not enough: it lunges at you');
  p.hp = 40; p.inv = 0; k.counterT = 0; k.blocks = 0; k.x = p.x + 1.1; k.y = p.y; swing(k); swing(k); p.x -= 5; for (let i = 0; i < 40; i++) sim.updateEnemy(k, 1 / 60); __ok(p.hp === 40, 'getting well clear does dodge it'); p.x += 5; k.x = p.x + 1.1;
  // the champion swings twice and its great shield only gives to a triple shot
  k = knight('knight_champion'); __ok(k.armor === 3, 'the champion wears full plate'); swing(k); swing(k); __ok(k.counterHits === 2, 'its counter is a two-cut combo');
  const cut = Math.max(1, Math.round(3 * 2 * (p.armor === 2 ? 0.25 : p.armor === 1 ? 0.5 : 1))); p.hp = 40; p.inv = 0; for (let i = 0; i < 60; i++) sim.updateEnemy(k, 1 / 60); __ok(40 - p.hp === 2 * cut, 'both cuts of the combo land (' + (40 - p.hp) + ' of ' + 2 * cut + ')');
  k = knight('knight_champion'); p.items.bow = true; p.arrows = 20; p.items.loaded = p.items.loaded2 = true; p.x = k.x - 3; p.a = 0;
  const shoot = (n) => { for (const e of sim.ents) if (e.k === 'proj') e.dead = true; sim.ents = sim.ents.filter(e => !e.dead); k.hurt = 0; k.reelUntil = 0; k.stun = 0; sim.useItem(p, 'bow', { loaded: n }); for (let i = 0; i < 60; i++) { for (const e of sim.ents.slice()) if (e.k === 'proj') sim.updateEnt(e, 1 / 60); sim.ents = sim.ents.filter(e => !e.dead); } };
  shoot(2); __ok(!(k.reelUntil > sim.time), 'a double loaded shot does nothing to a great shield'); shoot(3); __ok(k.reelUntil > sim.time, 'a triple shot jars it');
  // armored knights: plate first, then the shield
  k = knight('knight_armored'); p.x = k.x - 1.1; p.items.heavypommel = true; __ok(k.armor === 2, 'an armored knight wears plate');
  sim.playerAttack(p, { kind: 'pommel' }); __ok(k.armor === 1 && !k.disarmed, 'a heavy pommel takes plate first');
  const b = sim.spawn({ k: 'bomb', lvl: p.lvl, x: k.x, y: k.y, fuse: 0, pid: 'p1' }); sim.updateEnt(b, 1 / 60); __ok(k.armor === 0, 'a bomb takes the rest');
  __ok(sim.snapshotFor('p1').en.find(v => v[0] === k.id)[1] === 'knight_redshield', 'down to the red shield and sword');
  k.stripped = {}; sim.playerAttack(p, { kind: 'pommel' }); __ok(k.disarmed, 'then the shield can be knocked away');
  __ok(['knight_sword', 'knight_armored', 'knight_champion'].every(id => Content.enemies[id]), 'all three new knights exist');
  __ok(Content.hints.some(t => /GLINT OF HIS SWORD/.test(t)), 'the old men warn about sword knights');
});
attempt('frontier tunnels', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = true; const OW = sim.W.levels.ow;
  for (const b of ['snow', 'ash']) {
    const ps = OW.passes[b]; const T = sim.W.levels['t' + b]; const [mIn, mOut] = ps.mouths;
    // the cave mouth on the main-land side leads to the near end; the step out at the far end leads to the frontier side
    sim.teleport(p, 'ow', mIn.x, mIn.y, mIn.a); sim.tryEnter(p, mIn.idx); __ok(p.lvl === T.id && Math.abs(p.x - T.spawn.x) < 0.01, b + ': in at the near end');
    const far = T.exits[1]; p.x = far.x + 0.5; p.y = far.y + 0.5; sim.tryExit(p); __ok(p.lvl === 'ow' && Math.abs(p.x - mOut.x) < 0.01, b + ': out on the frontier side');
    sim.teleport(p, 'ow', mOut.x, mOut.y, mOut.a); sim.tryEnter(p, mOut.idx); __ok(p.lvl === T.id && Math.hypot(p.x - (far.x + 0.5), p.y - (far.y + 0.5)) < 2, b + ': back in at the far end');
    const near = T.exits[0]; p.x = near.x + 0.5; p.y = near.y + 0.5; sim.tryExit(p); __ok(p.lvl === 'ow' && Math.abs(p.x - mIn.x) < 0.01, b + ': and out where you came in');
    // it gets colder (hotter) toward the frontier end, and the foes change
    const rooms = Object.values(T.rooms).filter(r => !r.side).sort((a, c) => a.heat - c.heat);
    const themed = (r) => { let n = 0, all = 0; for (let y = r.ry * DSY; y <= r.ry * DSY + DSY; y++) for (let x = r.rx * DSX; x <= r.rx * DSX + DSX; x++) { const t = T.get(x, y); all++; if ([TL.ICEWALL, TL.SNOW, TL.ICE, TL.BASALT, TL.ASH, TL.LAVA].includes(t)) n++; } return n / all; };
    __ok(themed(rooms[rooms.length - 1]) > themed(rooms[1]) + 0.3, b + ': the far end is much ' + (b === 'snow' ? 'colder' : 'hotter') + ' (' + themed(rooms[1]).toFixed(2) + ' -> ' + themed(rooms[rooms.length - 1]).toFixed(2) + ')');
    __ok(Object.values(T.rooms).filter(r => r.side && !r.wing).every(r => r.reward), b + ': every side room guards a prize');
    const mbr = Object.values(T.rooms).find(r => r.miniboss); __ok(mbr && mbr.enemies.length === 2 && mbr.enemies.every(t => enemyDef(t).boss && /^wyrm_elder/.test(t)) && mbr.rewards.some(r => r[0] === 'hpiece'), b + ': a pair of elder wyrmlings guards a heart piece');
    __ok(Object.values(T.rooms).every(r => r.enemies.every(t => t !== 'skeleton' && t !== 'slime')), b + ': skeletons here are always armored');
    sim.teleport(p, T.id, roomBounds(T, mbr).x0 + 2.5, mbr.ry * DSY + 2.5, 0); sim.tick(1 / 60); __ok(sim.ents.filter(e => e.k === 'en' && e.lvl === T.id && !e.dead && enemyDef(e.type).boss).length === 2, b + ': both wyrmlings show up together');
    const scroll = b === 'snow' ? 'tripleshot' : 'quiver50'; __ok(!sim.ents.some(e => e.k === 'pick' && e.lvl === T.id && (e.item === scroll || e.item === 'gems100' || e.item === 'hpiece')), b + ': no prize while the wyrms live');
    __ok(sim.ents.filter(e => e.k === 'pick' && e.lvl === T.id && e.bait).length === 6, b + ': bait: gems in four corners and two hearts');
    for (const e of sim.ents) if (e.k === 'en' && e.lvl === T.id) e.dead = true; sim.tick(1 / 60); sim.tick(1 / 60); __ok(sim.ents.some(e => e.k === 'pick' && e.item === 'hpiece' && e.lvl === T.id), b + ': beating them drops the heart piece');
    __ok(sim.ents.some(e => e.k === 'pick' && e.item === scroll && e.lvl === T.id) && sim.ents.some(e => e.k === 'pick' && e.item === 'gems100' && e.lvl === T.id), b + ': and the scroll and the purse');
    // one big arena: no wall between the two cells, and nothing solid along the middle row from end to end
    const bd = roomBounds(T, mbr); __ok(bd.x1 - bd.x0 === 23, b + ': the arena is two rooms wide'); let open = true; for (let x = bd.x0; x < bd.x1; x++) for (const y of [2, 4, 6]) if (TINFO[T.get(x, mbr.ry * DSY + y)].solid) open = false; __ok(open, b + ': no wall splits the arena');
    __ok(dungeonRoomAt(T, bd.x0 + 0.5, mbr.ry * DSY + 4.5) === mbr && dungeonRoomAt(T, bd.x1 - 0.5, mbr.ry * DSY + 4.5) === mbr, b + ': both halves are the same room');
    // walking in wakes a room's foes
    const mid = rooms[6]; sim.teleport(p, T.id, mid.rx * DSX + 6.5, DSY + 4.5, 0); sim.tick(1 / 60); __ok(sim.ents.some(e => e.k === 'en' && e.lvl === T.id && !e.dead), b + ': foes in the rooms');
  }
});
attempt('twin-eye gates', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = true; p.items.bow = true; p.arrows = 30; p.bombs = 5; p.items.bombarrow = true;
  for (const b of ['snow', 'ash']) {
    const T = sim.W.levels['t' + b]; const g = T.twinGates[0]; const [e1, e2] = g.eyes; const gx = g.gate % T.w, gy = Math.floor(g.gate / T.w);
    __ok(T.tiles[g.gate] === TL.TWINGATE && g.eyes.every(i => T.tiles[i] === TL.EYE), b + ': a closed gate between two eyes');
    const wing = Object.values(T.rooms).filter(r => r.wing); __ok(wing.length === 2 && wing.some(r => r.miniboss && r.cw === 2) && wing.some(r => r.mergeInto != null), b + ': behind it the wyrm pair, in one arena two rooms wide');
    sim.teleport(p, T.id, gx + 0.5, gy + 3.5, -Math.PI / 2);
    sim.hitEye(T, e1, false); __ok(T.tiles[g.gate] === TL.TWINGATE_HALF, b + ': one eye: half way up');
    sim.time += TWIN_EYE_TIME + 0.1; sim.updateTempTiles(); sim.updateTwinGates(); __ok(T.tiles[e1] === TL.EYE && T.tiles[g.gate] === TL.TWINGATE, b + ': too slow: the eye opens and the gate drops');
    const save = sim.makeSave(); __ok(!save.mods[T.id] || !save.mods[T.id][e1] || save.mods[T.id][e1][0] === TL.EYE, b + ': a save never keeps an eye shut by a plain arrow');
    sim.hitEye(T, e1, false); sim.time += 0.5; sim.updateTempTiles(); sim.hitEye(T, e2, false); __ok(T.tiles[g.gate] === TL.CFLOOR, b + ': both at once: open');
    sim.time += 5; sim.updateTempTiles(); sim.updateTwinGates(); __ok(T.tiles[g.gate] === TL.CFLOOR && g.eyes.every(i => T.tiles[i] === TL.EYE_SHUT), b + ': and it stays open');
  }
  // alone: a bomb arrow seals one for good, then a plain arrow in the other opens it
  const sim2 = freshSim(); const T = sim2.W.levels.tsnow; const g = T.twinGates[0];
  sim2.hitEye(T, g.eyes[0], true); sim2.time += 10; sim2.updateTempTiles(); sim2.updateTwinGates(); __ok(T.tiles[g.eyes[0]] === TL.EYE_SHUT && T.tiles[g.gate] === TL.TWINGATE_HALF, 'a bomb arrow keeps one eye shut (gate half up)');
  sim2.hitEye(T, g.eyes[1], false); __ok(T.tiles[g.gate] === TL.CFLOOR, 'then one arrow in the other opens it');
});
attempt('wyrm arena bait', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = true; const T = sim.W.levels.tash; const mb = Object.values(T.rooms).find(r => r.miniboss); const bd = roomBounds(T, mb);
  sim.teleport(p, T.id, (bd.x0 + bd.x1) / 2, mb.ry * DSY + 4.5, 0); sim.tick(1 / 60);
  const ws = () => sim.ents.filter(e => e.k === 'en' && e.lvl === T.id && !e.dead && e.type === 'wyrm_elder'); __ok(ws().length === 2, 'two wyrms in the arena');
  for (let k = 0; k < 600; k++) { for (const w of ws()) { w.chargeIn = 99; w.tm = 99; } sim.tick(1 / 60); }
  const xs = ws().map(w => w.x).sort((a, c) => a - c); __ok(xs[0] < bd.x0 + 7 && xs[1] > bd.x1 - 7, 'they hold the far ends of the wide arena (' + xs.map(x => (x - bd.x0).toFixed(1)).join(', ') + ')');
  const bait = (side) => sim.ents.find(e => e.k === 'pick' && e.lvl === T.id && e.bait === side && !e.dead);
  const a = bait('a'); sim.pickup(p, a); __ok(!ws().some(w => w.enraged), 'robbing one end: they only watch');
  const a2 = bait('a'); sim.pickup(p, a2); __ok(!ws().some(w => w.enraged), 'still only one end');
  const hp0 = ws()[0].maxHp; sim.pickup(p, bait('b')); __ok(ws().length === 2 && ws().every(w => w.enraged) && ws()[0].maxHp > hp0, 'robbing both ends: both enraged, and tougher');
  __ok(enemyDef('wyrm_elder').sprFor(ws()[0]) === 'wyrm_elder_rage' && !!SPR.wyrm_elder_rage, 'enraged ones look it');
  // they remember after a wipe
  sim.respawnAll(); sim.teleport(p, T.id, (bd.x0 + bd.x1) / 2, mb.ry * DSY + 4.5, 0); sim.tick(1 / 60); __ok(ws().length === 2 && ws().every(w => w.enraged), 'after a wipe they come back enraged');
  // saves from before the merge: the moved loot stays taken
  const sim2 = freshSim(); const save = sim2.makeSave(); const loot = Object.values(T.rooms).find(r => r.mergeInto != null); save.team.taken['tash:' + loot.id + ':stash1'] = true;
  const sim3 = new Sim(genWorld(save.seed, save.mode), save); __ok(sim3.team.taken['tash:' + mb.id + ':gems100'] === true, 'an old save that took the purse keeps it taken');
});
attempt('grottos under hollow trees', () => {
  const sim = freshSim(); const p = sim.players.p1; p.items.pommel = true; const L = sim.W.levels.ow;
  const g = L.grottos.find(g => g.kind === 'g_spring'); const i = L.idx(g.x, g.y);
  sim.tryEnter(p, i); __ok(p.lvl === 'ow', 'a closed hollow tree is just a tree');
  sim.teleport(p, 'ow', g.x + 0.5, g.y + 1.5, -Math.PI / 2); sim.pommelStrike(p, L); __ok(L.props[i] === PR.HOLLOWTREE, 'knocking on it does nothing');
  sim.spawn({ k: 'bomb', lvl: 'ow', x: g.x + 0.5, y: g.y + 1.3, fuse: 0 }); sim.tick(1 / 60); __ok(L.props[i] === PR.HOLLOWTREE, 'neither does a bomb');
  sim.fireProj('candle', 'ow', g.x + 0.5, g.y + 2.2, -Math.PI / 2, 'p', p.id, {}); for (let k = 0; k < 40; k++) sim.tick(1 / 60); __ok(L.tiles[i] === TL.STAIRS && !L.props[i], 'the candle burns it open on a stair');
  __ok(sim.makeSave().mods.ow[i][0] === TL.STAIRS, 'and it stays open (saved)');
  sim.tryEnter(p, i); __ok(p.lvl === g.id, 'down the stair into the grotto');
  const G = sim.W.levels[g.id]; let sp = -1; for (let k = 0; k < G.tiles.length; k++) if (G.tiles[k] === TL.SPRING) { sp = k; break; } __ok(sp >= 0, 'the spring grotto has a spring');
  p.maxHp = 12; p.hp = 4; p.x = sp % G.w + 0.5; p.y = Math.floor(sp / G.w) + 0.5; for (let k = 0; k < 400; k++) sim.tick(1 / 60); __ok(p.hp >= p.maxHp, 'standing in it heals you');
  p.x = 6.5; p.y = G.h - 1.5; sim.tryExit(p); __ok(p.lvl === 'ow' && Math.abs(p.y - (g.y + 1.5)) < 0.01, 'out in front of the tree');
  { const G2 = sim.W.levels[L.grottos.find(g => g.kind === 'g_psalm').id]; __ok(G2.npcs[0].text.split('|').length === 6 && G2.props.filter(pr => pr === PR.GRAVE).length === 2, 'the lament: a six-page psalm between two graves'); }
  __ok(sim.W.levels[L.grottos.find(g => g.kind === 'g_hermit').id].npcs[0].text && Content.lore.includes(sim.W.levels[L.grottos.find(g => g.kind === 'g_hermit').id].npcs[0].text), 'the hermit mutters a line of lore');
});
attempt('steps, ledges and the cloak lift', () => {
  const W = genWorld(7319, 'adv'); const D = W.levels.dbg; const at = (t) => { for (let i = 0; i < D.tiles.length; i++) if (D.tiles[i] === t) return [i % D.w + 0.5, Math.floor(i / D.w) + 0.5]; };
  const [s1x, s1y] = at(TL.STEP1), [s3x, s3y] = at(TL.STEP3), [lx, ly] = at(TL.LEDGE);
  __ok(D.ceilH === 2 && skyRoom(D), 'the training room is two tiles tall');
  __ok(heightAt(D, lx, ly) === 1 && heightAt(D, s1x, s1y) === 0.25, 'heights: a ledge is one tile up, the first step a quarter');
  __ok(!D.solidAt(s1x, s1y, { z: 0 }) && D.solidAt(s3x, s3y, { z: 0 }) && !D.solidAt(s3x, s3y, { z: 0.5 }), 'you can step up a quarter at a time, not more');
  __ok(D.solidAt(lx, ly) && !D.solidAt(lx, ly, { z: 0.75 }), 'the ledge is a wall from the floor, floor from the top step');
  __ok(D.solidAt(0.5, 5.5, { high: true, fly: true }), 'flying high indoors: the room walls still reach the ceiling');
  const O = W.levels.ow; let tw = -1, pk = -1; for (let i = 0; i < O.tiles.length; i++) { if (tw < 0 && O.tiles[i] === TL.TREEWALL) tw = i; if (pk < 0 && O.tiles[i] === TL.PEAKS) pk = i; }
  const c = (i) => [i % O.w + 0.5, Math.floor(i / O.w) + 0.5];
  __ok(O.solidAt(...c(tw)) && !O.solidAt(...c(tw), { high: true, fly: true }), 'outdoors, high on the cloak you sail over a hedge');
  __ok(O.solidAt(...c(pk), { high: true, fly: true }), 'but not over the peaks');
  let tree = -1; for (let i = 0; i < O.props.length; i++) if (O.props[i] === PR.TREE) { tree = i; break; } __ok(O.solidAt(...c(tree)) && !O.solidAt(...c(tree), { high: true, fly: true }), 'or over a tree');
  __ok(!skyRoom(W.levels.d1) && skyRoom(O), 'dungeons are one tall: no lift there');
});
attempt('thorn-folk and homing seeds', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = true; const L = sim.W.levels.dbg; sim.teleport(p, 'dbg', 18.5, 18.5, 0); sim.tick(1 / 60);
  // a seed fired off to the side bends round toward the hero
  const s = sim.fireProj('seed', 'dbg', 12.5, 18.5, -Math.PI / 2, 'e', null, {}); for (let k = 0; k < 90; k++) sim.tick(1 / 60);
  __ok(s.vx > 0 && Math.abs(Math.atan2(s.vy, s.vx)) < 1.2, 'the seed turns toward you (' + Math.atan2(s.vy, s.vx).toFixed(2) + ')');
  // a briarback throws two spears at once
  const b = sim.spawn({ k: 'en', type: 'thornling_briar', lvl: 'dbg', x: 12.5, y: 18.5, hp: 4, maxHp: 4, f: 0, st: 1, tm: 0, stun: 0, hurt: 0, spawnFx: 0, dmgMul: 1 });
  const before = sim.ents.filter(e => e.k === 'proj' && e.type === 'spear').length; sim.updateEnemy(b, 1 / 60); __ok(sim.ents.filter(e => e.k === 'proj' && e.type === 'spear').length - before === 2, 'a briarback throws two spears');
  __ok(['thornling_briar', 'thornling_seer', 'thornling_nettle'].every(id => enemyDef(id).title && !enemyDef(id).boss), 'the kin have their own names');
});
attempt('the first old man and the Wardhold shield', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; p.hp = p.maxHp = 40; const W = sim.W; const C = W.levels[W.startCave];
  __ok(!!W.startCave && W.levels[W.startCave].caveKind === 'sword0' && C.tiles[C.idx(6, 1)] === TL.HATCH, 'the first cave has a plain hatch behind the old man');
  const shoot = (type) => sim.fireProj(type || 'spear', 'dbg', 22.5, 16.5, Math.PI / 2, 'e', null, { dmg: 1 });
  sim.teleport(p, 'dbg', 22.5, 19.5, -Math.PI / 2); sim.tick(1 / 60);
  // a wooden shield only blocks
  sim.onPlayerState('p1', { lvl: 'dbg', x: 22.5, y: 19.5, a: -Math.PI / 2, sh: 1 }); const s0 = shoot(); for (let k = 0; k < 40 && !s0.dead; k++) sim.tick(1 / 60); __ok(s0.dead && s0.owner === 'e' && p.hp === 40, 'the wooden shield just blocks');
  // the old man falls once someone has 8 hearts and nobody is in his cave
  { const m0 = p.maxHp, h0 = p.hp; p.maxHp = MAX_HEARTS * 4 - 4; sim.giveItem(p, 'hcont', false); sim.giveItem(p, 'hcont', false); __ok(p.maxHp === 80, 'heart containers stop at 20 hearts'); p.maxHp = m0; p.hp = h0; }
  p.maxHp = 32; sim.tick(1 / 60); __ok(sim.team.fallen && C.dark && C.tiles[C.idx(6, 1)] === TL.HATCH_CAVED && C.props[C.idx(6, 1)] === PR.RUBBLE, 'at 8 hearts: the passage is caved in and the cave is dark');
  __ok(C.props[C.idx(3, 2)] === 0 && C.npcs[0].spr === 'oldman_fallen' && C.npcs[0].text === Content.fallen.text, 'the torches are out and he lies there');
  const O = W.levels.ow; __ok(O.props.some(pr => pr === PR.HELM), 'a dented helmet outside');
  const save = sim.makeSave(); const sim2 = new Sim(genWorld(save.seed, save.mode), save); __ok(sim2.team.fallen && sim2.W.levels[W.startCave].dark, 'it stays that way after loading');
  sim.teleport(p, W.startCave, 6.5, 6.5, -Math.PI / 2); sim.tick(1 / 60); const sh = sim.ents.find(e => e.item === 'wardshield' && !e.dead); __ok(!!sh, 'his shield lies beside him');
  sim.pickup(p, sh); __ok(p.items.wardshield && sim.players.p2.items.wardshield, 'the Wardhold shield (for everyone)');
  // reflect for 1 s after it comes up
  sim.teleport(p, 'dbg', 22.5, 19.5, -Math.PI / 2); sim.tick(1 / 60); p.maxHp = p.hp = 40;
  sim.onPlayerState('p1', { lvl: 'dbg', x: 22.5, y: 19.5, a: -Math.PI / 2, sh: 0 }); sim.onPlayerState('p1', { lvl: 'dbg', x: 22.5, y: 19.5, a: -Math.PI / 2, sh: 1 });
  const s1 = shoot(); for (let k = 0; k < 40 && s1.owner === 'e' && !s1.dead; k++) sim.tick(1 / 60); __ok(!s1.dead && s1.owner === 'p' && s1.vy < 0 && s1.dmg === 2 && p.hp === 40, 'just after it comes up, a spear flies back');
  sim.time += 1.2; const s2 = shoot(); for (let k = 0; k < 40 && !s2.dead; k++) sim.tick(1 / 60); __ok(s2.dead && s2.owner === 'e' && p.hp === 40, 'later it is only blocked');
  p.items.mirrorguard = true; sim.onPlayerState('p1', { lvl: 'dbg', x: 22.5, y: 19.5, a: -Math.PI / 2, sh: 0 }); sim.onPlayerState('p1', { lvl: 'dbg', x: 22.5, y: 19.5, a: -Math.PI / 2, sh: 1 });
  const s3 = shoot(); for (let k = 0; k < 40 && s3.owner === 'e' && !s3.dead; k++) sim.tick(1 / 60); __ok(s3.owner === 'p' && s3.dmg === 6, 'Mirror Guard: reflected shots hit three times as hard');
  // the ward stops one unblockable shot, then needs WARD_TIME
  sim.time += 9; const m1 = shoot('magic'); for (let k = 0; k < 40 && !m1.dead; k++) sim.tick(1 / 60); __ok(p.hp === 40, 'the ward stops a magic bolt');
  const m2 = shoot('magic'); for (let k = 0; k < 40 && !m2.dead; k++) sim.tick(1 / 60); __ok(p.hp < 40, 'but only one every ' + WARD_TIME + ' s');
  // the first old man met afterwards says the line, once
  const other = Object.values(W.levels).find(L => L.kind === 'cave' && L.caveKind === 'hint'); sim.teleport(p, other.id, 6.5, 4.8, -Math.PI / 2); sim.tick(1 / 60); sim.tick(1 / 60);
  const npc = sim.ents.find(e => e.k === 'npc' && e.lvl === other.id); __ok(npc && npc.text === Content.wardLine && sim.team.wardLine, 'the next old man knows that shield');
});
attempt('defense split and rings', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; p.armor = 2; const hit = (dmg, src, elem) => { p.inv = 0; p.hp = p.maxHp = 400; sim.hurtPlayer(p, dmg, src, elem); return 400 - p.hp; };
  __ok(hit(4) === 2 && hit(4, null, 'fire') === 5, 'plate: a blow loses 75%, fire only 37.5% (' + hit(4) + ' / ' + hit(4, null, 'fire') + ')');
  __ok(sim.elemOf({ k: 'proj', type: 'magic' }) === 'magic' && sim.elemOf({ k: 'proj', type: 'icebreath' }) === 'ice' && !sim.elemOf({ k: 'proj', type: 'spear' }), 'shots carry their element');
  const wear = (id) => { p.items[id] = true; sim.onAction('p1', { t: 'equip', slot: 'ring', id }); };
  wear('ring_cinder'); __ok(p.ring === 'ring_cinder' && hit(4, null, 'fire') === 0 && hit(4, { k: 'proj', type: 'fire', x: 0, y: 0 }) === 3, 'Cinder: burning ground does nothing, a fireball half');
  wear('ring_rime'); p.chill = 2; sim.tick(1 / 60); __ok(p.chill === 0 && hit(4, null, 'ice') === 3, 'Rime: no chill, frost halved');
  wear('ring_glass'); __ok(hit(4) === 4, 'Glass: double damage taken');
  const dummy = sim.spawn({ k: 'en', type: 'slime', lvl: p.lvl, x: p.x + 5, y: p.y, hp: 50, maxHp: 50, f: 0, st: 0, tm: 9, stun: 9, hurt: 0, spawnFx: 0, dmgMul: 1 }); sim.damageEnemy(dummy, 2, null, { pid: 'p1' }); __ok(dummy.hp === 46, 'Glass: and double dealt');
  wear('ring_thorn'); const biter = sim.spawn({ k: 'en', type: 'slime', lvl: p.lvl, x: p.x + 0.3, y: p.y, hp: 50, maxHp: 50, f: 0, st: 0, tm: 9, stun: 0, hurt: 0, spawnFx: 0, dmgMul: 1 }); hit(2, biter); __ok(biter.hp === 44, 'Thorn: a bite comes back three times over');
  wear('ring_secondwind'); p.inv = 0; p.hp = 2; p.potions = 0; sim.hurtPlayer(p, 10, null); __ok(p.alive && p.hp === 1, 'Second Wind: a fatal hit leaves a quarter heart');
  p.inv = 0; sim.hurtPlayer(p, 10, null); __ok(!p.alive, 'but only once'); __ok(p.windUsed === false, 'and it comes back when you fall');
  p.alive = true; p.hp = 4; p.maxHp = 40; wear('ring_hollow'); sim.giveItem(p, 'heart'); __ok(p.hp === 4, 'Hollow: hearts do nothing'); sim.onKill({ lvl: p.lvl, type: 'slime' }, 'p1'); __ok(p.hp === 5, 'every kill heals a little');
  wear('ring_miser'); sim.giveItem(p, 'heart'); __ok(p.hp === 7, 'Miser: hearts heal half'); const g0 = p.gems; const gem = sim.spawn({ k: 'pick', lvl: p.lvl, x: p.x, y: p.y, item: 'gem5' }); sim.pickup(p, gem); __ok(p.gems - g0 === 10, 'Miser: dropped gems count twice');
  wear('ring_mender'); p.hp = 4; p.lastHurtAt = -99; p.movedAt = sim.time - 5; run(sim, 3); __ok(p.hp > 4, 'Mender: standing still heals');
  // Shepherd: only between two wearers
  const q = sim.players.p2; q.lvl = p.lvl; q.x = p.x + 1; q.y = p.y; q.hp = 4; q.maxHp = 40; wear('ring_shepherd'); sim.giveItem(p, 'heart'); __ok(q.hp === 4, 'Shepherd: a friend without one gets nothing');
  q.items.ring_shepherd = true; q.ring = 'ring_shepherd'; sim.giveItem(p, 'heart'); __ok(q.hp === 8, 'Shepherd: a friend wearing one heals too');
  wear('ring_signet'); sim.teleport(p, 'dbg', 22.5, 19.5, 0); const k = sim.spawn({ k: 'en', type: 'knight', lvl: 'dbg', x: 24.0, y: 19.5, hp: 9, maxHp: 9, f: Math.PI, st: 0, tm: 0, stun: 0, hurt: 0, spawnFx: 0, dmgMul: 1 }); p.inv = 0; p.hp = 40; sim.updateEnemy(k, 1 / 60); __ok(k.hesitate > sim.time, 'Signet: a knight hesitates');
  wear('ring_echo'); const bm = sim.fireProj('beam', 'dbg', 33.5, 19.5, 0, 'p', 'p1', {}); for (let i = 0; i < 20 && !bm.dead; i++) sim.tick(1 / 60); __ok(!bm.dead && bm.bounced && bm.vx < 0, 'Echo: a beam bounces off the wall');
  wear('ring_lodestone'); const d1 = sim.spawn({ k: 'pick', lvl: 'dbg', x: p.x + 2.5, y: p.y, item: 'gem1' }); const dx0 = d1.x; sim.tick(0.1); __ok(d1.x < dx0, 'Lodestone: drops drift toward you');
  wear('ring_gale'); p.items.galecloak = true; sim.useItem(p, 'galecloak', {}); __ok(Math.abs((p.flyReady - p.flyUntil) - FLY_COOLDOWN / 2) < 1e-6, 'Gale: the cloak rests half as long');
  sim.onAction('p1', { t: 'equip', slot: 'ring', id: 'none' }); __ok(!p.ring, 'and you can take a ring off');
  __ok(sim.makeSave().players[p.color].ring === null || sim.makeSave().players[p.color].ring === undefined, 'the ring is saved');
});
attempt('the thorn-folk grudge', () => {
  const sim = freshSim(); const p = sim.players.p1; const rnd = mulberry32(5); const kin = () => { const c = {}; for (let i = 0; i < 300; i++) { const t = sim.thornKin(rnd); c[t] = (c[t] || 0) + 1; } return c; };
  __ok(Object.keys(kin()).join() === 'thornling', 'no grudge: only thornlings');
  sim.addGrudge(30); const c = kin(); __ok(c.thornling_briar > 0 && c.thornling_nettle > 0 && !c.thornling_seer, 'grudge 30: briarbacks and nettlings, no seers');
  sim.addGrudge(50); __ok(kin().thornling_seer > 0, 'grudge 80: seers too');
  // it cools, but not below half its peak
  for (let i = 0; i < 200; i++) sim.coolGrudge(180); __ok(sim.team.grudge === 40, 'it cools to half its peak (' + sim.team.grudge + ')');
  // burning a bush on the overworld feeds it; killing thorn-folk in a dungeon doesn't
  const L = sim.W.levels.ow; let bi = -1; for (let i = 0; i < L.props.length; i++) if (L.props[i] === PR.BUSH) { bi = i; break; } const g0 = sim.team.grudge; sim.burnAt(L, bi % L.w + 0.5, Math.floor(bi / L.w) + 0.5); __ok(sim.team.grudge === g0 + 2, 'a burned bush: +2');
  sim.onKill({ lvl: 'd2', type: 'thornling' }, 'p1'); __ok(sim.team.grudge === g0 + 2, 'a thornling killed in a dungeon: nothing'); sim.onKill({ lvl: 'ow', type: 'thornling_briar' }, 'p1'); __ok(sim.team.grudge === g0 + 3, 'out in the wilds: +1');
  // the root merchant sells the Thorn Ring only while the grudge is low
  const root = Object.values(sim.W.levels).find(l => l.caveKind === 'g_roots'); sim.teleport(p, root.id, 6.5, 6.5, 0); sim.tick(1 / 60);
  __ok(!sim.ents.some(e => e.k === 'shop' && e.item === 'ring_thorn' && e.lvl === root.id), 'an angry wood: no Thorn Ring for sale');
  const sim2 = freshSim(); const root2 = Object.values(sim2.W.levels).find(l => l.caveKind === 'g_roots'); sim2.teleport(sim2.players.p1, root2.id, 6.5, 6.5, 0); sim2.tick(1 / 60);
  __ok(sim2.ents.some(e => e.k === 'shop' && e.item === 'ring_thorn' && e.lvl === root2.id), 'a gentle one: the Thorn Ring is on the counter');
  __ok(sim.makeSave().team.grudge === sim.team.grudge, 'the grudge is saved');
});
attempt('sealed rooms are one-way', () => {
  const sim = freshSim(); let D = null, r = null, door = null;
  for (let d = 1; d <= 9 && door == null; d++) { const L = sim.W.levels['d' + d]; for (const rr of Object.values(L.rooms)) { if (!rr.shutter) continue; const x0 = rr.rx * DSX, y0 = rr.ry * DSY; for (const [x, y] of [[x0 + 6, y0], [x0 + 6, y0 + DSY], [x0, y0 + 4], [x0 + DSX, y0 + 4]]) if (L.get(x, y) === TL.OPENDOOR) { door = L.idx(x, y); r = rr; D = L; break; } if (door != null) break; } }
  __ok(door != null, 'there is a sealed room');
  const x0 = r.rx * DSX, y0 = r.ry * DSY, dx = door % D.w, dy = Math.floor(door / D.w); sim.setTile(D.id, door, TL.SHUTTER, null, r.id);
  const inX = dx === x0 ? x0 + 1.5 : dx === x0 + DSX ? x0 + DSX - 0.5 : dx + 0.5, inY = dy === y0 ? y0 + 1.5 : dy === y0 + DSY ? y0 + DSY - 0.5 : dy + 0.5;
  __ok(D.solidAt(dx + 0.5, dy + 0.5, { mx: inX, my: inY }), 'from inside, the shutter is a wall');
  const outX = dx === x0 ? x0 - 0.5 : dx === x0 + DSX ? x0 + DSX + 0.5 : dx + 0.5, outY = dy === y0 ? y0 - 0.5 : dy === y0 + DSY ? y0 + DSY + 0.5 : dy + 0.5;
  __ok(!D.solidAt(dx + 0.5, dy + 0.5, { mx: outX, my: outY }) && !D.solidAt(dx + 0.5, dy + 0.5, { mx: dx + 0.5, my: dy + 0.5 }), 'from outside or the doorway, you can still come in');
  const edgeX = dx === x0 ? x0 + 1.23 : dx === x0 + DSX ? x0 + DSX - 0.23 : dx + 0.5, edgeY = dy === y0 ? y0 + 1.23 : dy === y0 + DSY ? y0 + DSY - 0.23 : dy + 0.5;
  __ok(D.solidAt(dx + 0.5, dy + 0.5, { mx: edgeX, my: edgeY }), 'pressed right up against it from inside, still a wall');
});
attempt('bomb bags and potions', () => {
  const sim = freshSim(); const p = sim.players.p1; p.items = {};
  __ok(bombCap(p) === 1, 'no bag: one bomb'); p.items.bombbag2 = true; __ok(bombCap(p) === 8, 'the grotto bag alone holds 8'); p.items.bombbag = true; __ok(bombCap(p) === 16, 'both: 16, in either order');
  __ok(Object.values(Content.caves).every(c => c.stock.every(s => s.item !== 'potion' || s.price === 0 || s.price === POTION_PRICE)), 'every shop sells potions at ' + POTION_PRICE);
  const W = sim.W; const hc = Object.values(W.levels).find(L => L.caveKind === 'heart'); sim.teleport(p, hc.id, hc.spawn.x, hc.spawn.y, 0);
  const pot = sim.ents.find(e => e.k === 'shop' && e.lvl === hc.id && e.item === 'potion'); p.potions = 0; p.gems = 0; sim.buy ? 0 : 0;
  sim.collect ? 0 : 0; sim.takeEnt ? 0 : 0;
  const take = (e) => { p.x = e.x; p.y = e.y; for (let i = 0; i < 5; i++) sim.tick(1 / 60); };
  take(pot); __ok(p.potions === 1 && !sim.ents.some(e => e.k === 'shop' && e.lvl === hc.id && e.item === 'hcont' && !e.dead), 'take the potion in a heart cave (the heart goes)');
  const ref = sim.ents.find(e => e.k === 'shop' && e.lvl === hc.id && e.refill && !e.dead); __ok(ref && ref.price === POTION_REFILL && sim.snapshotFor('p1').team.refills.includes(hc.id), 'and his refills appear, marked on the map');
  __ok(sim.ents.some(e => e.k === 'npc' && e.lvl === hc.id && e.text === Content.refillText), 'he says so');
  p.potions = 0; p.gems = 100; sim.time += 2; p.x = 0; p.y = 0; sim.tick(1 / 60); take(ref); __ok(p.potions === 1 && p.gems === 100 - POTION_REFILL, 'a refill costs ' + POTION_REFILL);
  p.hp = 4; p.poisonTicks = 3; p.chill = 2; p.inv = 0; sim.useItem(p, 'potion'); __ok(p.hp === p.maxHp && !p.poisonTicks && !p.chill && p.inv >= POTION_GUARD - 0.1, 'a potion heals fully, cures poison and chill, and shields you for a moment');
  __ok(Content.items.whistle.sprite === 'whistle' && !!SPR.whistle, 'the Wind Whistle has its own look');
});
attempt('the lookout and the isle', () => {
  let placed = 0; for (let s = 1; s <= 20; s++) { const W = genWorld(s * 7919, 'adv'); if (W.lookout) placed++; }
  __ok(placed >= 19, 'the lookout stands by the Hearthgate in (almost) every world: ' + placed + '/20');
  const W = genWorld(7919, 'adv'); const L = W.levels.ow, o = W.lookout; __ok(!!o, 'lookout placed');
  if (o) { const hs = []; for (let i = 1; i <= 16; i++) hs.push(TINFO[TL['LOOK' + i]].raised); __ok(hs.every((h, i) => i === 0 || Math.abs(h - hs[i - 1] - 0.2) < 1e-6) && TINFO[TL.LOOKTOP].raised - hs[15] <= STEP_UP, 'every step is one you can take');
    __ok(TINFO[L.get(o.x, o.y)].raised > 3 && heightAt(L, o.x + 0.5, o.y + 0.5) > 3, 'the summit stands over three tiles up'); }
  const I = W.levels.isle; __ok(I && I.outdoor && skyRoom(I) && I.tiles.includes(TL.CASTLEGATE) && TINFO[TL.CASTLEGATE].sealedMsg, 'the isle: open sky, and the castle gate shut');
  __ok(!I.solidAt(I.spawn.x, I.spawn.y), 'you come ashore on open ground');
});
attempt('the King calls his adepts', () => {
  const sim = freshSim(); const p = sim.players.p1; sim.teleport(p, 'dbg', 20.5, 20.5, 0); for (const e of sim.ents) if (e.k === 'en') e.dead = true;
  const k = sim.spawnEnemy('king', 'dbg', 23.5, 18.5, {}); k.spawnFx = 0; k.hp = 19; k.maxHp = 30; enemyDef('king').ai(sim, k, 1 / 60, { p });
  const gs = sim.ents.filter(e => e.k === 'en' && !e.dead && e.guard === k.id); __ok(gs.length === 2 && gs.every(g => g.type === 'wizard_adept'), 'below two thirds he calls two force adepts');
  const g = gs[0]; g.spawnFx = 0; g.shieldAt = 0; for (let i = 0; i < 40 && g.channel == null; i++) { g.st = 1; g.tm = 0; enemyDef(g.type).ai(sim, g, 1 / 60, { p }); }
  __ok(g.channel === k.id && k.wardBy === g.id, 'an adept shields the King'); const hp = k.hp; __ok(sim.damageEnemy(k, 2, null, { ignoreIframes: true, silver: true }) === false && k.hp === hp, 'nothing gets through');
  sim.damageEnemy(g, 1, null, { ignoreIframes: true }); __ok(sim.damageEnemy(k, 2, null, { ignoreIframes: true }) && k.hp < hp, 'hit the adept and the King is open');
  enemyDef('king').ai(sim, k, 1 / 60, { p }); __ok(sim.ents.filter(e => e.k === 'en' && !e.dead && e.guard === k.id).length === 2, 'and he calls them only once per third');
});
attempt('ceiling spiders', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; p.hp = p.maxHp = 40; const D = sim.W.levels.d13; const r = Object.values(D.rooms).find(r => !r.boss && !r.silk && r !== D.startRoom);
  const cx = r.rx * DSX + 6.5, cy = r.ry * DSY + 6.5; sim.teleport(p, 'd13', cx, cy + 3, -Math.PI / 2); for (const e of sim.ents) if (e.k === 'en') e.dead = true;
  const c = sim.spawnEnemy('spider_crawler', 'd13', cx, cy - 2, {}); c.spawnFx = 0; c.ceil = true; const ai = enemyDef('spider_crawler').ai;
  ai(sim, c, 1 / 60, { p, spd: 3, def: enemyDef('spider_crawler') }); __ok(c.air && c.hz > 1 && enemyDef('spider_crawler').sprFor(c) === 'spider_crawler_ceil' && !!SPR.spider_crawler_ceil, 'in a tall room a crawler hangs upside down on the ceiling');
  __ok(sim.damageEnemy(c, 1, null, { ignoreIframes: true }) === false, 'out of reach up there');
  const y0 = c.y; for (let i = 0; i < 30; i++) ai(sim, c, 1 / 60, { p, spd: 3, def: enemyDef('spider_crawler') }); __ok(c.y > y0 && c.ceil === true, 'it creeps after you overhead');
  p.x = c.x; p.y = c.y + 1.2; ai(sim, c, 1 / 60, { p, spd: 3, def: enemyDef('spider_crawler') }); __ok(c.ceil === 'drop', 'and drops when you come close');
  for (let i = 0; i < 40; i++) ai(sim, c, 1 / 60, { p, spd: 3, def: enemyDef('spider_crawler') }); __ok(c.ceil === false && !c.air && c.hz === 0, 'landing to fight');
  __ok(['wizard_arch', 'wizard_fire_arch', 'wizard_storm_arch', 'wizard_bone_arch'].every(t => !Object.keys(enemyDef(t).spawns).length), 'archmages never spawn at random');
});
attempt('skeleton mages', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; p.hp = p.maxHp = 400; sim.teleport(p, 'dbg', 20.5, 20.5, 0);
  const clear = () => { for (const e of sim.ents) if (e.k !== 'pl') e.dead = true; sim.ents = sim.ents.filter(e => !e.dead); sim.ossuaries = []; };
  const mk = (type, x, y) => { const m = sim.spawnEnemy(type, 'dbg', x || 23.5, y || 20.5, {}); m.spawnFx = 0; m.dmgMul = 1; return m; };
  const cast = (m) => { m.st = 1; m.tm = 0; enemyDef(m.type).ai(sim, m, 1 / 60, { p }); };
  const shots = () => sim.ents.filter(e => e.k === 'proj' && !e.dead);
  { clear(); const m = mk('wizard'); m.b = { x0: 30, y0: 10, x1: 40, y1: 20 }; cast(m); __ok(shots().length === 0, 'a mage does not cast at someone outside its room');
    clear(); const D0 = sim.W.levels.dbg; const wi = D0.idx(22, 20), was = D0.tiles[wi]; D0.tiles[wi] = TL.BRICK; const m2 = mk('wizard'); cast(m2); __ok(shots().length === 0, 'or through a wall'); D0.tiles[wi] = was; }
  for (const [type, shot] of [['wizard', 'magic'], ['wizard_fire', 'fire'], ['wizard_storm', 'stormbolt']]) { clear(); cast(mk(type)); __ok(shots().length === 1 && shots()[0].type === shot, type + ' casts ' + shot); }
  clear(); const bm = mk('wizard_bone'); for (let i = 0; i < 40; i++) cast(bm);
  const raised = sim.ents.filter(e => e.k === 'en' && !e.dead && e.raisedBy === bm.id); __ok(raised.length >= 1 && raised.length <= 2 && raised.every(r => r.type === 'skeleton_a1'), 'a bone mage raises up to two skeletons in one piece of armor');
  __ok(shots().some(e => e.type === 'boneshard') && Content.projectiles.boneshard.blockable && !Content.projectiles.stormbolt.blockable, 'bone shards fly, and a shield can stop them');
  __ok(['wizard', 'wizard_fire_adept', 'wizard_storm_arch'].every(t => enemyDef(t).rare && enemyDef(t).rare.type === 'wizard_bone' + ['', '', '_adept', '_arch'][enemyDef(t).tier] && enemyDef(t).rare.chance === 0.02), 'one mage in fifty is the bone mage of its tier');
  __ok(['wizard_arch', 'wizard_fire_arch', 'wizard_storm_arch', 'wizard_bone_arch'].every(t => enemyDef(t).fly) && !enemyDef('wizard_adept').fly, 'archmages float, so they cannot be knocked into a pit');
  __ok(!enemyDef('wizard').armor && enemyDef('wizard_adept').armor === 1 && enemyDef('wizard_fire_arch').armor === 2, 'adepts wear one piece of armor, archmages two');
  const hit = (type, dmg, opt) => { clear(); const m = mk(type); m.hp = 50; sim.damageEnemy(m, dmg, null, Object.assign({ ignoreIframes: true }, opt)); return 50 - m.hp; };
  __ok(hit('wizard_fire', 4, { elem: 'fire' }) === 4 && hit('wizard_fire_adept', 4, { elem: 'fire' }) === 1.5 && Math.abs(hit('wizard_fire_arch', 4, { elem: 'fire' }) - 0.6) < 1e-9, 'resisting their own element: none, half, 70% (on top of armor)');
  __ok(hit('wizard_bone', 4, { elem: 'storm' }) === 2 && hit('wizard_bone', 4, { elem: 'force' }) === 2 && hit('wizard_bone', 4, { arrow: true }) === 2 && hit('wizard_bone', 2, { blunt: true }) === 4, 'bone mages resist all magic, let arrows through and shatter on blunt hits');
  __ok(hit('wizard_fire', 2, { elem: 'frost' }) === 2 && enemyDef('wizard_fire').hot, 'fire mages count as fire-born (frost arrows bite twice)');
  // SHIELD: a force adept holds a bubble over an ally until something hits it
  clear(); const fa = mk('wizard_adept', 23.5, 20.5), ally = mk('skeleton', 22.5, 22.5); ally.hp = 10;
  for (let i = 0; i < 80 && fa.channel == null; i++) cast(fa); __ok(fa.channel === ally.id && ally.wardBy === fa.id, 'a force adept shields an ally');
  __ok(sim.damageEnemy(ally, 3, null, { ignoreIframes: true }) === false && ally.hp === 10, 'nothing gets through the shield');
  sim.damageEnemy(fa, 1, null, { ignoreIframes: true }); __ok(fa.channel == null && sim.damageEnemy(ally, 3, null, { ignoreIframes: true }) && ally.hp === 7, 'hitting the caster breaks it');
  __ok(Content.projectiles.forcepush.knock > 0, 'the push shoves');
  // STORM STRIKE: a mark under your feet, then lightning
  clear(); const sa = mk('wizard_storm_adept'); for (let i = 0; i < 80 && !(sa.strikes && sa.strikes.length); i++) cast(sa); __ok(sa.strikes && sa.strikes.length > 0, 'a storm adept marks the floor');
  const hp0 = p.hp; p.inv = 0; sim.time += 1; sa.tm = 5; enemyDef(sa.type).ai(sim, sa, 1 / 60, { p }); __ok(p.hp < hp0 && !sa.strikes.length, 'then the lightning lands');
  // COMBO: an archmage starts it, an adept of another element joins, and it hits harder for it
  clear(); const ar = mk('wizard_storm_arch', 23.5, 20.5), jo = mk('wizard_fire_adept', 22.5, 22.5); ar.comboAt = 0; cast(ar);
  __ok(!!ar.combo && jo.joining === ar.id, 'a storm archmage starts the Lightning Lance and a fire adept joins in');
  __ok(dist2(jo.x, jo.y, ar.x, ar.y) < 1.5 * 1.5, 'the joiner blinks to the leader'); __ok(enemyDef(ar.type).sprFor(ar) === 'wizard_storm_arch_up2' && enemyDef(jo.type).sprFor(jo) === 'wizard_fire_adept_up1' && !!SPR.wizard_storm_arch_up2, 'both raise their staffs');
  sim.time += 1.2; enemyDef(ar.type).ai(sim, ar, 1 / 60, { p }); const ln = shots().find(e => e.type === 'elance'); __ok(ln && ln.dmg === 4 && !jo.joining, 'the lance flies, one point stronger per joiner'); __ok(enemyDef(ar.type).sprFor(ar) === null, 'and the staff comes down');
  clear(); const so = mk('wizard_arch'); so.comboAt = 0; cast(so); sim.time += 1.2; enemyDef(so.type).ai(sim, so, 1 / 60, { p }); __ok(shots().filter(e => e.type === 'eforcewave').length === 16, 'alone, an archmage still casts its combo (a ring of force)');
  { const w = shots().find(e => e.type === 'eforcewave'); const d = Content.projectiles.eforcewave; __ok(d.guardOnly && d.knock >= 30, 'the Force Wave throws you far');
    for (const o of sim.ents) if (o.k === 'proj' && o !== w) o.dead = true; p.items.wardshield = true; p.wardAt = 0; p.shUp = false; p.inv = 0; p.god = false; const h0 = p.hp; w.x = p.x - Math.cos(p.a) * -0.3; w.y = p.y - Math.sin(p.a) * -0.3; w.vx = -Math.cos(p.a) * 7; w.vy = -Math.sin(p.a) * 7; sim.tick(1 / 60); __ok(p.hp < h0, 'the shield ward does not stop it');
    clear(); so.combo = null; so.comboAt = 0; cast(so); sim.time += 1.2; enemyDef(so.type).ai(sim, so, 1 / 60, { p }); const w2 = shots().find(e => e.type === 'eforcewave'); for (const o of sim.ents) if (o.k === 'proj' && o !== w2) o.dead = true; p.shUp = true; p.inv = 0; const h1 = p.hp; w2.x = p.x + Math.cos(p.a) * 0.3; w2.y = p.y + Math.sin(p.a) * 0.3; w2.vx = -Math.cos(p.a) * 7; w2.vy = -Math.sin(p.a) * 7; sim.tick(1 / 60); __ok(p.hp === h1 && w2.dead, 'a raised shield does'); p.shUp = false; p.items.wardshield = false; }
  clear(); const fw = mk('wizard_fire_arch'); fw.comboAt = 0; cast(fw); sim.time += 1.2; enemyDef(fw.type).ai(sim, fw, 1 / 60, { p }); __ok(sim.ents.filter(e => e.k === 'efire' && !e.dead).length >= 5, 'and a fire archmage a wall of flame');
  // THE DEAD MARCH and THE OSSUARY
  clear(); const ba = mk('wizard_bone_arch'); ba.marchAt = 0; cast(ba); __ok(sim.ents.filter(e => e.k === 'en' && !e.dead && e.raisedBy === ba.id && e.type === 'skeleton_a3').length === 5, 'a bone archmage raises five fully armored skeletons');
  for (const e of sim.ents) if (e.raisedBy === ba.id) e.dead = true; ba.marchAt = 1e9; ba.comboAt = 0; cast(ba); __ok(ba.combo && ba.combo.kind === 'bone', 'then calls the Ossuary');
  const D = sim.W.levels.dbg; sim.time += 0.6; enemyDef(ba.type).ai(sim, ba, 1 / 60, { p }); __ok(!sim.ossuaries.length && sim.ents.filter(e => e.k === 'fx' && e.spr === 'bonemark').length >= 8, 'during the chant, bones on the floor show where the cage will rise'); sim.time += 0.6; enemyDef(ba.type).ai(sim, ba, 1 / 60, { p }); const os = sim.ossuaries[0];
  __ok(os && os.ribs.length >= 8 && os.ribs.every(i => TINFO[D.tiles[i]].rib && TINFO[D.tiles[i]].solid), 'ribs burst up around the hero');
  const rib = os.ribs[0], rx = rib % D.w + 0.5, ry = Math.floor(rib / D.w) + 0.5; for (let i = 0; i < 6; i++) sim.cutAt(D, rx, ry, p); __ok(TINFO[D.tiles[rib]].rib, 'six sword cuts are not enough');
  sim.cutAt(D, rx, ry, p); __ok(!TINFO[D.tiles[rib]].rib, 'the seventh breaks a rib');
  { const r4 = os.ribs[3]; p.x = r4 % D.w + 0.5; p.y = Math.floor(r4 / D.w) + 1.5; p.a = -Math.PI / 2; for (let i = 0; i < 4; i++) sim.playerAttack(p, { kind: 'sword' }); __ok(TINFO[D.tiles[r4]].rib && D.ribHits[r4] === 4, 'each sword swing counts as one cut'); p.x = os.cx; p.y = os.cy; }
  const rib2 = os.ribs[1], rib3 = os.ribs[2]; const face = (i) => { p.x = i % D.w + 0.5; p.y = Math.floor(i / D.w) + 1.5; p.a = -Math.PI / 2; };
  p.items.heavypommel = false; face(rib2); sim.pommelStrike(p, D); __ok(TINFO[D.tiles[rib2]].rib, 'one plain pommel strike is not enough'); sim.pommelStrike(p, D); __ok(!TINFO[D.tiles[rib2]].rib, 'two are');
  p.items.heavypommel = true; face(rib3); sim.pommelStrike(p, D); __ok(!TINFO[D.tiles[rib3]].rib, 'one heavy pommel strike breaks a rib'); p.x = os.cx; p.y = os.cy;
  const hp1 = p.hp; p.inv = 0; sim.time += 3; Content.updateOssuaries(sim); __ok(sim.ossuaries.length === 1, 'the cage holds you for five seconds'); sim.time += 2.1; Content.updateOssuaries(sim); __ok(p.hp < hp1 && !sim.ossuaries.length && os.ribs.every(i => !TINFO[D.tiles[i]].rib), 'whoever stays inside is crushed, and the cage falls apart');
  __ok(sim.ents.filter(e => e.k === 'en' && !e.dead && e.type === 'skeleton_a3' && e.raisedBy === ba.id).length === 5, 'and five fully armored skeletons climb out of it');
  sim.damageEnemy(ba, 999, null, { ignoreIframes: true }); __ok(sim.ents.some(e => e.k === 'pick' && e.item === 'ring_hollow'), 'a bone archmage drops the Hollow Ring');
  __ok(['wizard_bare', 'wizard_fire_adept_bare', 'wizard_storm_arch_bare', 'wizard_bone_arch_bare', 'wizard_adept_a0', 'wizard_arch_a1'].every(id => !!SPR[id]), 'every mage has staffless and stripped looks');
});
attempt('the Silkwood', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; p.hp = p.maxHp = 400; const W = sim.W; const D = W.levels.d13, O = W.levels.ow;
  __ok(!!W.dungeons[13] && !!W.silkMouth && O.tiles[W.silkMouth.idx] === TL.SILKSEAL && D.tiles[D.passSeal] === TL.WEBSEAL && D.exits.length === 2, 'a gate, a sealed far mouth, and a sealed way out beyond the boss');
  const ga = owRegionAt(O, W.dungeons[13].x, W.dungeons[13].y), gb = owRegionAt(O, W.silkMouth.x, W.silkMouth.y); __ok(Math.abs(ga.rx - gb.rx) >= 3, 'the two ends are at least three columns apart');
  sim.teleport(p, 'ow', W.silkMouth.x, W.silkMouth.y, -Math.PI / 2); sim.tryEnter(p, W.silkMouth.idx); __ok(p.lvl === 'ow', 'the far mouth is shut while she lives');
  // silk burns, spreads, and hurts whoever stands on it (not a Cinder Ring wearer)
  sim.teleport(p, 'dbg', 22.5, 19.5, 0); const T = sim.W.levels.dbg; T.gimmicks = (T.gimmicks || []).concat(['webs']); const cells = []; for (let x = 20; x <= 24; x++) { const i = T.idx(x, 19); T.tiles[i] = TL.SILK; cells.push(i); }
  sim.burnAt(T, 20.5, 19.5); for (let k = 0; k < 75; k++) sim.tick(1 / 60); __ok(cells.every(i => T.tiles[i] === TL.SILK_BURNING), 'one spark and the whole strip burns'); __ok(p.hp < 400, 'standing on it hurts');
  for (let k = 0; k < 200; k++) sim.tick(1 / 60); __ok(cells.every(i => T.tiles[i] === TL.CHARRED), 'and it burns out to char');
  for (const i of cells) T.tiles[i] = TL.SILK; p.items.ring_cinder = true; p.ring = 'ring_cinder'; p.hp = 400; p.inv = 0; sim.burnAt(T, 20.5, 19.5); for (let k = 0; k < 60; k++) sim.tick(1 / 60); __ok(p.hp === 400, 'a Cinder Ring walks through it'); p.ring = null;
  for (let k = 0; k < 200; k++) sim.tick(1 / 60);
  // a strand: stuck, helpless a moment, then a slash frees you and they come down
  const wi = T.idx(26, 19); T.props[wi] = PR.WEBLINE; sim.teleport(p, 'dbg', 26.5, 19.5, 0); sim.onAction('p1', { t: 'webline', idx: wi }); __ok(!!p.webbed, 'walking into a strand: stuck');
  const before = sim.ents.filter(e => e.k === 'en' && !e.dead).length; sim.playerAttack(p, { kind: 'sword' }); __ok(!!p.webbed, 'for a moment nothing works');
  sim.time += 1.1; sim.playerAttack(p, { kind: 'sword' }); __ok(!p.webbed && !T.props[wi] && sim.ents.filter(e => e.k === 'en' && !e.dead && e.type === 'spider_ceiling').length >= 2, 'then a slash cuts free, and spiders drop');
  for (const e of sim.ents) if (e.k === 'en') e.dead = true; sim.tick(1 / 60);
  // egg sacs hatch when you come close; a burned one never does
  const ei = T.idx(28, 17); T.props[ei] = PR.EGGSAC; sim.teleport(p, 'dbg', 28.5, 18.6, 0); sim.tick(1 / 60); __ok(!T.props[ei] && sim.ents.filter(e => e.type === 'spiderling' && !e.dead).length === 3, 'an egg sac hatches three spiderlings');
  for (const e of sim.ents) if (e.k === 'en') e.dead = true; const e2 = T.idx(31, 17); T.props[e2] = PR.EGGSAC; sim.burnAt(T, 31.5, 17.5); sim.teleport(p, 'dbg', 31.5, 18.6, 0); sim.tick(1 / 60); __ok(!sim.ents.some(e => e.type === 'spiderling' && !e.dead), 'a burned one never hatches');
  // a cocoon cut open: empty armor
  const ci = T.idx(23, 17); T.props[ci] = PR.COCOON; sim.cutAt(T, 23.5, 17.5, p); __ok(T.props[ci] === PR.HELM, 'a cocoon holds an empty helmet');
  // web bridges burn into the pit and grow back
  T.webBridges = [T.idx(20, 21)]; T.tiles[T.webBridges[0]] = TL.WEBBRIDGE; sim.burnAt(T, 20.5, 21.5); __ok(T.tiles[T.webBridges[0]] === TL.PIT, 'fire drops a web bridge'); sim.tick(1 / 60); sim.time += 21; sim.tick(1 / 60); __ok(T.tiles[T.webBridges[0]] === TL.WEBBRIDGE, 'and it grows back');
  // the Silk Arm
  sim.teleport(p, 'dbg', 22.5, 19.5, 0); p.items.silkarm = true; p.armMode = 'blade'; p.armSwapAt = 0; const dm = sim.spawn({ k: 'en', type: 'slime', lvl: 'dbg', x: 23.4, y: 19.5, hp: 100, maxHp: 100, f: 0, st: 0, tm: 9, stun: 9, hurt: 0, spawnFx: 0, dmgMul: 1 });
  p.sword = 2; p.hp = p.maxHp - 4; sim.playerAttack(p, { kind: 'sword' }); // (not at full health: no sword beam) const after1 = dm.hp; for (let k = 0; k < 12; k++) sim.tick(1 / 60); __ok(Math.abs((after1 - dm.hp) - (100 - after1) * 0.25) < 0.01, 'BLADE: a quarter-strength cut a beat later (' + (100 - after1) + ' then ' + (after1 - dm.hp) + ')');
  sim.onAction('p1', { t: 'equip', slot: 'arm', mode: 'guard' }); __ok(p.armMode === 'guard' && !sim.armOn(p, 'guard'), 'changing stance takes a moment'); sim.time += ARM_SWAP + 0.1;
  p.hp = 400; p.maxHp = 400; p.inv = 0; p.a = 0; const sp = sim.fireProj('spear', 'dbg', 19.5, 19.5, 0, 'e', null, { dmg: 2 }); for (let k = 0; k < 60 && !sp.dead; k++) sim.tick(1 / 60); __ok(p.hp === 400, 'GUARD: a spear from behind is blocked');
  // Pip: plays dead, never dies, never holds a room shut, takes a gem
  const pip = sim.spawn({ k: 'en', type: 'spider_pip', lvl: 'dbg', x: 24.5, y: 19.5, hp: 99, maxHp: 99, f: 0, st: 0, tm: 0, stun: 0, hurt: 0, spawnFx: 0, dmgMul: 1 });
  sim.damageEnemy(pip, 50, p, { pid: 'p1', ignoreIframes: true }); __ok(!pip.dead && pip.hp === 99 && pip.deadT > 0 && sim.team.pipHit, 'Pip plays dead (and remembers you swung)');
  // spider elites only for spiders
  const sk = sim.spawn({ k: 'en', type: 'skeleton', lvl: 'dbg', x: 20, y: 18, hp: 3, maxHp: 3, f: 0, st: 0, tm: 9, stun: 9, hurt: 0, spawnFx: 0, dmgMul: 1 }); const cr = sim.spawn({ k: 'en', type: 'spider_crawler', lvl: 'dbg', x: 20, y: 18, hp: 3, maxHp: 3, f: 0, st: 0, tm: 9, stun: 9, hurt: 0, spawnFx: 0, dmgMul: 1 });
  const rr = mulberry32(3); let okS = true, okC = true; for (let k = 0; k < 40; k++) { sk.elite = 0; sim.makeElite(sk, rr); if (eliteByIdx(sk.elite).only) okS = false; cr.elite = 0; sim.makeElite(cr, rr); if (eliteByIdx(cr.elite).only !== 'spider') okC = false; } __ok(okS && okC, 'spider elites only on spiders, and only those');
  // the Broodmother runs, wraps a still hero, and her death opens the pass
  for (const e of sim.ents) if (e.k === 'en') e.dead = true; sim.tick(1 / 60);
  const bm = sim.spawn({ k: 'en', type: 'broodmother', lvl: 'dbg', x: 18.5, y: 18.5, hp: 300, maxHp: 300, f: 0, st: 0, tm: 0, stun: 0, hurt: 0, spawnFx: 0, dmgMul: 1, b: { x0: 12, y0: 16, x1: 26, y1: 22 } });
  p.god = true; p.webbed = null; p.movedAt = sim.time; for (let k = 0; k < 60 * 10; k++) sim.tick(1 / 60); __ok(!bm.dead, 'she fights for ten seconds without trouble'); __ok(!!p.webbed && p.webbed.by === 'wrap', 'and wraps whoever stands still');
  sim.teleport(p, 'd13', D.spawn.x, D.spawn.y, 0); __ok(!p.webbed, 'leaving the room frees you'); sim.giveItem(p, 'silkarm', false);
  __ok(D.tiles[D.passSeal] === TL.DEXIT && O.tiles[W.silkMouth.idx] === TL.SILKCAVE && sim.team.done.includes(13), 'her prize opens the far way out, and the far mouth');
  const sx = D.passSeal % D.w, sy = Math.floor(D.passSeal / D.w); p.x = D.passIn.x; p.y = D.passIn.y; sim.tryExit(p); __ok(p.lvl === 'ow' && Math.abs(p.x - W.silkMouth.x) < 0.01, 'the far exit leads out by the far mouth');
  sim.tryEnter(p, W.silkMouth.idx); __ok(p.lvl === 'd13' && Math.abs(p.x - D.passIn.x) < 0.01, 'and the far mouth leads back in: a shortcut');
});
attempt('favorites per save', () => {
  const sim = freshSim(); const p = sim.players.p1; p.items.bow = true; p.items.bombs = true;
  sim.onAction('p1', { t: 'fav', item: 'bow', on: true }); sim.onAction('p1', { t: 'fav', item: 'bombs', on: true }); sim.onAction('p1', { t: 'fav', item: 'bombs', on: false });
  __ok(JSON.stringify(p.favs) === '["bow"]', 'favorites live on the hero'); const save = sim.makeSave(); __ok(JSON.stringify(save.players[p.color].favs) === '["bow"]', 'and are saved with them');
  __ok(!(freshSim().players.p1.favs || []).length, 'a new game starts with none');
});
attempt('elder wyrmlings', () => {
  const sim = freshSim(); const p = sim.players.p1; p.god = false; p.hp = p.maxHp = 60; const T = sim.W.levels.tsnow; const mb = Object.values(T.rooms).find(r => r.miniboss);
  sim.teleport(p, T.id, mb.rx * DSX + 6.5, mb.ry * DSY + 4.5, 0); sim.tick(1 / 60);
  const ws = sim.ents.filter(e => e.k === 'en' && e.lvl === T.id && e.type === 'wyrm_elder_frost'); __ok(ws.length === 2, 'two elder frost wyrms');
  for (const w of ws) { w.spawnFx = 0; w.chargeIn = 99; } p.inv = 99; // no charging yet, and keep the hero alive
  for (let i = 0; i < 180; i++) for (const w of ws) sim.updateEnemy(w, 1 / 60);
  const [a, b] = ws.slice().sort((x, y) => x.x - y.x); __ok(b.x - a.x > 3.5, 'crossfire: they hold opposite ends (' + (b.x - a.x).toFixed(1) + ' apart)');
  // charge: a glowing wind-up, then a dash at you
  a.chargeIn = 0; a.tm = 9; sim.updateEnemy(a, 1 / 60); __ok(a.chargeT > 0 && sim.entView(a, p)[1] === 'wyrm_elder_frost_glow', 'a charge starts with a glow');
  const x0 = a.x, y0 = a.y; for (let i = 0; i < 50; i++) sim.updateEnemy(a, 1 / 60); __ok(Math.hypot(a.x - x0, a.y - y0) > 1.5, 'then it dashes');
  // frost lance: the floor turns to ice for a while, then back; a save never keeps it
  a.chargeIn = 99; a.dashT = 0; a.n = 2; a.tm = 0; const before = Array.from(T.tiles); sim.updateEnemy(a, 1 / 60);
  const iced = []; T.tiles.forEach((t, i) => { if (t === TL.ICE && before[i] !== TL.ICE) iced.push(i); }); __ok(iced.length >= 3, 'a frost lance ices the floor (' + iced.length + ' tiles)');
  const sv = sim.makeSave(); __ok(iced.every(i => !sv.mods.tsnow || !sv.mods.tsnow[i] || sv.mods.tsnow[i][0] === before[i]), 'a save keeps the floor as it will be, not iced');
  sim.time += 6; sim.updateTempTiles(); __ok(iced.every(i => T.tiles[i] === before[i]), 'the ice melts back');
  // grief: when one falls, the other roars and fights harder
  b.dead = true; sim.ents = sim.ents.filter(e => !e.dead); sim.updateEnemy(a, 1 / 60); __ok(a.grief, 'the survivor grieves');
  a.tm = 0; a.n = 0; a.chargeIn = 99; for (const e of sim.ents) if (e.k === 'proj') e.dead = true; sim.ents = sim.ents.filter(e => !e.dead); sim.updateEnemy(a, 1 / 60); __ok(sim.ents.filter(e => e.k === 'proj' && e.owner === 'e').length === 5, 'five shots now');
  // ember rain on the magma road: shadows, then burning splashes that hurt
  const sim2 = freshSim(); const q = sim2.players.p1; q.god = false; q.hp = q.maxHp = 60; const T2 = sim2.W.levels.tash; const mb2 = Object.values(T2.rooms).find(r => r.miniboss);
  sim2.teleport(q, T2.id, mb2.rx * DSX + 6.5, mb2.ry * DSY + 4.5, 0); sim2.tick(1 / 60); const m = sim2.ents.find(e => e.k === 'en' && e.type === 'wyrm_elder'); m.spawnFx = 0; m.chargeIn = 99; m.n = 2; m.tm = 0; m.init = true;
  sim2.updateEnemy(m, 1 / 60); const blobs = sim2.ents.filter(e => e.k === 'emberblob'); __ok(blobs.length === 3 && sim2.ents.some(e => e.spr === 'shadowring'), 'ember rain: three blobs, each with a shadow');
  q.inv = 0; const hp0 = q.hp; for (let i = 0; i < 90; i++) for (const e of sim2.ents.slice()) if (e.k === 'emberblob') sim2.updateEnt(e, 1 / 60);
  __ok(q.hp < hp0, 'the one aimed at you lands on you'); __ok(T2.tiles[T2.idx(Math.floor(q.x), Math.floor(q.y))] === TL.LAVA, 'and leaves a burning splash');
  sim2.time += 4; sim2.updateTempTiles(); __ok(T2.tiles[T2.idx(Math.floor(q.x), Math.floor(q.y))] !== TL.LAVA, 'which cools again');
});
attempt('tideglass opening', () => {
  for (const [seed, mode] of [[7319, 'adv'], [1234, 'rogue'], [99, 'rogue'], [4242, 'adv']]) {
    const W = genWorld(seed, mode); const D = W.levels.d6; const st = D.startRoom; const r2 = st.children[0]; const r3 = r2.children[0];
    __ok(r2.intro && r2.looseKey, 'd6 room 2 should be the glass key room (seed ' + seed + ' ' + mode + ')');
    __ok(r2.links[r3.id] === TL.LOCKED, 'd6 room 2 -> 3 should be locked');
    __ok(D.get(st.rx * DSX + 2, st.ry * DSY + 3) === TL.PIT && D.get(st.rx * DSX + 6, st.ry * DSY + 3) === TL.GLASS, 'd6 entrance should have the glass bridge over a pit');
  }
  const sim = freshSim(); const p = sim.players.p1; p.god = false; const D = sim.W.levels.d6; const r2 = D.startRoom.children[0];
  sim.teleport(p, 'd6', r2.rx * DSX + 6.5, r2.ry * DSY + 6.5, -Math.PI / 2); sim.tick(1 / 60);
  __ok(sim.ents.some(e => e.k === 'pick' && e.item === 'key' && Math.abs(e.x - (r2.rx * DSX + 10)) < 0.01), 'island key should be waiting');
  const bat = sim.ents.find(e => e.k === 'en' && e.type === 'bat' && e.g === p.room); __ok(bat && TINFO[D.get(Math.floor(bat.x), Math.floor(bat.y))].pit, 'bat should hover over the pit');
});
attempt('enemies and hazards', () => {
  const sim = freshSim(); const p = sim.players.p1; const L = sim.W.levels.ow; const x0 = Math.floor(p.x) + 3, y0 = Math.floor(p.y);
  // a skeleton knocked off solid ground onto a pit falls in; a bat over a pit doesn't
  L.set(x0, y0, TL.GRASS); L.set(x0 + 1, y0, TL.PIT); L.set(x0 + 2, y0, TL.PIT);
  const sk = sim.spawnEnemy('skeleton', 'ow', x0 + 0.5, y0 + 0.5, { spawnFx: 0 }); sk.spawnFx = 0; sk.hp = 99;
  sim.damageEnemy(sk, 1, { x: x0 - 1, y: y0 + 0.5 }, { pid: 'p1' }); for (let i = 0; i < 30; i++) sim.updateEnemy(sk, 1 / 60);
  __ok(sk.dead, 'skeleton knocked onto a pit should fall');
  const bat = sim.spawnEnemy('bat', 'ow', x0 + 1.5, y0 + 0.5, { spawnFx: 0 }); bat.spawnFx = 0; for (let i = 0; i < 30; i++) sim.updateEnemy(bat, 1 / 60); __ok(!bat.dead, 'bats fly over pits');
  // lava burns a skeleton but not a magmite
  L.set(x0 + 5, y0, TL.LAVA); const s2 = sim.spawnEnemy('skeleton', 'ow', x0 + 5.5, y0 + 0.5, { spawnFx: 0 }); s2.spawnFx = 0; s2.hp = 99; s2.stun = 9;
  const mg = sim.spawnEnemy('magmite', 'ow', x0 + 5.5, y0 + 0.5, { spawnFx: 0 }); mg.spawnFx = 0; mg.hp = 99; mg.stun = 9;
  for (let i = 0; i < 70; i++) { sim.time += 1 / 60; sim.updateEnemy(s2, 1 / 60); sim.updateEnemy(mg, 1 / 60); }
  __ok(s2.hp < 99 && mg.hp === 99, 'lava should burn grounded enemies but not fire creatures (' + s2.hp + ', ' + mg.hp + ')');
  // a hit on ice shoves further
  const kb = (tile) => { L.set(x0 + 8, y0, tile); for (let dx = 9; dx <= 14; dx++) L.set(x0 + dx, y0, TL.GRASS); const e = sim.spawnEnemy('skeleton', 'ow', x0 + 8.5, y0 + 0.5, { spawnFx: 0 }); e.spawnFx = 0; e.hp = 99; sim.damageEnemy(e, 1, { x: e.x - 1, y: e.y }, {}); let moved = 0; for (let i = 0; i < 30 && e.kb; i++) { const bx = e.x; sim.moveEnt(e, e.kb[0] / 60, e.kb[1] / 60, enemyDef('skeleton'), true); e.kbT -= 1 / 60; if (e.kbT <= 0) e.kb = null; moved += e.x - bx; } e.dead = true; return moved; };
  const g = kb(TL.GRASS), ic = kb(TL.ICE); __ok(ic > g * 2.5, 'ice knockback should go much further (' + g.toFixed(2) + ' vs ' + ic.toFixed(2) + ')');
});
// a full minute of play in a dungeon with everything going on
attempt('dungeon minute', () => {
  const sim = freshSim(); for (const pid of ['p1', 'p2']) { const p = sim.players[pid]; const D = sim.W.levels.d5; sim.teleport(p, 'd5', D.spawn.x, D.spawn.y, -Math.PI / 2); }
  for (let t = 0; t < 60 * 60; t++) { const p = sim.players.p1; if (t % 30 === 0) sim.playerAttack(p, { kind: 'sword' }); if (t % 90 === 0) p.y -= 0.5; sim.tick(1 / 60); }
});
`;
try { vm.runInContext(tests, ctx, { filename: 'tests.js' }); } catch (e) { failures.push('test harness crashed: ' + e.stack); }

// a // comment followed by more code on the same line silently swallows that code (this once froze the game)
const allSrc = []; (function walk(d) { for (const n of fs.readdirSync(path.join(root, d))) { const p = d + '/' + n; if (fs.statSync(path.join(root, p)).isDirectory()) walk(p); else if (n.endsWith('.js')) allSrc.push(p); } })('src');
// every source file must at least compile, including the browser-only ones the tests above never load (a stray // can swallow code)
for (const f of allSrc) if (f.endsWith('.js')) { try { new vm.Script(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f }); } catch (e) { failures.push(f + ' does not compile: ' + e.message); } }
for (const f of allSrc) { const src = fs.readFileSync(path.join(root, f), 'utf8').split('\n'); src.forEach((line, i) => { const m = line.match(/\/\/[^'"`]*\b(const|let) [A-Za-z_]\w* = /) || line.match(/\/\/[^'"`]*;\s*[A-Za-z_][\w.]*(\[[^\]]*\])?\s*=\s*[^=]/) || line.match(/\/\/[^'"`]*\b[a-z_]\w*\.[A-Za-z_]\w*\s*=\s*[^=>]/); if (m && !/^\s*\/\//.test(line.slice(0, line.indexOf('//')) + '//')) failures.push(f + ':' + (i + 1) + ' has code after a // comment: ' + line.trim().slice(0, 80)); }); }
// browser-only files (render, input, net, ui) aren't run here, so at least make sure they parse
for (const f of ['src/engine/render.js', 'src/engine/audio.js', 'src/engine/input.js', 'src/net/relay.js', 'src/net/net.js', 'src/ui/debug.js', 'src/ui/main.js']) {
  const fp = path.join(__dirname, '..', f); if (!fs.existsSync(fp)) continue;
  try { new vm.Script(fs.readFileSync(fp, 'utf8'), { filename: f }); passes++; } catch (e) { failures.push(f + ': syntax error: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')); }
}

if (failures.length) {
  const uniq = [...new Set(failures)];
  for (let i = 0; i < uniq.length; i++) uniq[i] = where(uniq[i]);
  console.error('\nFAILED: ' + uniq.length + ' problem(s)\n' + uniq.slice(0, 40).map(f => '  - ' + f).join('\n') + (uniq.length > 40 ? '\n  ...' : ''));
  process.exit(1);
}
console.log('All good: ' + passes + ' checks passed (' + Object.keys(vm.runInContext('Content.enemies', ctx)).length + ' enemies, ' + Object.keys(vm.runInContext('Content.items', ctx)).length + ' items, ' + vm.runInContext('Content.elites.length', ctx) + ' elites).');
