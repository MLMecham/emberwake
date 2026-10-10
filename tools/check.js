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
      if (r.key && !got.has(r.id)) { got.add(r.id); keys++; changed = true; }
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
  for (let d = 1; d <= NDUNGEONS(); d++) { const g = W.dungeons[d]; if (g) __ok(!!seen[(g.y + 1) * L.w + g.x], 'seed ' + seed + ': gate ' + d + ' unreachable'); }
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
// a full minute of play in a dungeon with everything going on
attempt('dungeon minute', () => {
  const sim = freshSim(); for (const pid of ['p1', 'p2']) { const p = sim.players[pid]; const D = sim.W.levels.d5; sim.teleport(p, 'd5', D.spawn.x, D.spawn.y, -Math.PI / 2); }
  for (let t = 0; t < 60 * 60; t++) { const p = sim.players.p1; if (t % 30 === 0) sim.playerAttack(p, { kind: 'sword' }); if (t % 90 === 0) p.y -= 0.5; sim.tick(1 / 60); }
});
`;
try { vm.runInContext(tests, ctx, { filename: 'tests.js' }); } catch (e) { failures.push('test harness crashed: ' + e.stack); }

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
