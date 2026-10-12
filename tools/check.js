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
for (let s = 1; s <= SEEDS; s++) {
  const seed = s === 1 ? 7319 : s * 7919; const W = genWorld(seed, 'rogue'); const L = W.levels.ow;
  for (let d = 1; d <= NDUNGEONS(); d++) { const D = W.levels['d' + d]; __ok(solveDungeon(D), 'seed ' + seed + ': dungeon ' + d + ' has unreachable rooms'); __ok(!!W.dungeons[d], 'seed ' + seed + ': dungeon ' + d + ' gate missing'); }
  const seen = new Uint8Array(L.w * L.h); const q = [[Math.floor(L.spawn.x), Math.floor(L.spawn.y)]]; seen[q[0][1] * L.w + q[0][0]] = 1;
  while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, i = ny * L.w + nx; if (seen[i] || L.solidAt(nx + 0.5, ny + 0.5)) continue; seen[i] = 1; q.push([nx, ny]); } }
  // with the raft (level 6's treasure) everything is reachable; without it, level 7's island is not
  const seenR = new Uint8Array(L.w * L.h); const qr = [[Math.floor(L.spawn.x), Math.floor(L.spawn.y)]]; seenR[qr[0][1] * L.w + qr[0][0]] = 1;
  while (qr.length) { const [x, y] = qr.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, i = ny * L.w + nx; if (seenR[i] || L.solidAt(nx + 0.5, ny + 0.5, { raft: true })) continue; seenR[i] = 1; qr.push([nx, ny]); } }
  for (let d = 1; d <= NDUNGEONS(); d++) { const g = W.dungeons[d]; if (!g) continue; const gi = (g.y + 1) * L.w + g.x;
    if (d === 7) { __ok(!!seenR[gi], 'seed ' + seed + ': island gate 7 unreachable even with the raft'); __ok(!seen[gi], 'seed ' + seed + ': island gate 7 reachable without the raft'); }
    else __ok(!!seen[gi], 'seed ' + seed + ': gate ' + d + ' unreachable'); }
  const g6 = W.dungeons[6]; __ok(g6 && !!seen[(g6.y + 1) * L.w + g6.x], 'seed ' + seed + ': gate 6 (the raft) must be reachable on foot');
  for (const r of L.regions) for (const f of r.features) if (f.type === 'cave' && f.secret !== 'bush') __ok(!!seen[(f.y + 1) * L.w + f.x], 'seed ' + seed + ': cave "' + f.kind + '" unreachable');
}

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
  __ok(e.dead, 'enemy "' + id + '" did not die from a silver hit');
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
for (const f of allSrc) { const src = fs.readFileSync(path.join(root, f), 'utf8').split('\n'); src.forEach((line, i) => { const m = line.match(/\/\/[^'"`]*\b(const|let) [A-Za-z_]\w* = /); if (m && !/^\s*\/\//.test(line.slice(0, line.indexOf('//')) + '//')) failures.push(f + ':' + (i + 1) + ' has code after a // comment: ' + line.trim().slice(0, 80)); }); }
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
