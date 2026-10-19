// ===== content/enemies/wizard.js =====
// SKELETON MAGES. Bone faces under the hat; the robe tells you the element, and the eyes tell you the tier.
//   Elements: FORCE (purple, the old 'wizard' id), FIRE (red), STORM (blue), BONE (white: WIZ_BONE_CHANCE of any mage that
//   spawns is the bone mage of the same tier instead).
//   Tiers:    MAGE    empty sockets. One spell.
//             ADEPT   glowing eyes, bone plates on the shoulders (armor 1). Deeper in its own element (below); resists it
//                     by half (bone: every kind of magic).
//             ARCHMAGE  burning eyes and mouth, plates and a bone crown (armor 2). Floats (def.fly): pits and lava can't take it. Resists its element by MAGE_RESIST[3].
//                     Starts its element's COMBO, and any adept or archmage in the room can join it (game: they stop and
//                     chant; every joiner makes it hit harder). Alone it still casts it.
//   What each one does:
//     FORCE   bolt | adept: a push that shoves you back, and SHIELD: it stands still holding a bubble over an ally that
//             nothing gets through; hit the caster (anything) and the bubble breaks | combo FORCE WAVE: a ring that shoves
//     FIRE    fireball | adept: burning patches where you stand | combo FLAME WALL: a line of fire across your path.
//             Takes double from frost arrows (def.hot).
//     STORM   fast bolt | adept: STORM STRIKE, a mark under your feet, then lightning | combo LIGHTNING LANCE: a line marked
//             through you, then a lance down it. A reflected shot (the Wardhold shield) stuns it.
//     BONE    three bone shards (physical: your shield stops them) | raises skeletons whose armor matches its tier (1, 2,
//             full) | archmage: THE DEAD MARCH, five fully armored skeletons, and the combo THE OSSUARY: a ribcage
//             bursts up around you (it blocks your view) and closes. Crossed bones on the floor show where during the chant. Break a rib (a bomb or heavy pommel strike, two plain
//             pommel strikes, or seven sword cuts) or fly out. When it falls, five fully armored skeletons climb out of it.
//             Joiners change it: fire makes the ribs burn, storm arcs lightning inside, force closes it twice as fast.
//             Bone mages take half from arrows (they pass through the ribs) and double from blunt hits (pommel, bombs).
//             A bone archmage always drops the HOLLOW RING.
// Armor blocks both physical and magic hits (ARMOR_STEP per level, game/sim.js). The Heavy Pommel takes the staff only
// once the armor is off.
'use strict';
const WIZ_BONE_CHANCE = 0.02;
const MAGE_RESIST = [0, 0, 0.5, 0.7]; // by tier (1 mage, 2 adept, 3 archmage); a bone mage resists all magic, and from tier 1
const OSSUARY_CLOSE = 5; // seconds from the cage rising to it crushing whoever is still inside
const OSSUARY_WINDUP = 1.8; // the archmage's chant: bones rattle on the floor where the ribs will rise (you can step out)
const OSSUARY_DEAD = 5, OSSUARY_DEAD_MAX = 10; // fully armored skeletons that climb out as it falls (no more than OSSUARY_DEAD_MAX of the mage's own at once)
// ---- the look: rows built from the tier (eyes, armor shown) ----
const WIZ_BASE = [
  '.......kk.......',
  '......kPPk......',
  '.....kPPPPk.....',
  '....kPPyPPPk..y.',
  '...kkkkkkkkkk.n.',
  '....kzkzzkzk..n.',
  '.....kzkkzk...n.',
  '....kPPPPPPk.kn.',
  '...kPpPPPPpPkzn.',
  '...kPpPPPPpk..n.',
  '...kPpPyyPpk..n.',
  '...kPpPPPPpk..n.',
  '..kPPpPPPPpPk...',
  '..kPPPPPPPPPk...',
  '...kkkkkkkkk....',
  '................',
];
function wizRows(tier, armor, staff) {
  const r = WIZ_BASE.slice();
  if (tier === 2) r[5] = '....kzXzzXzk..n.';                                     // eyes lit in the sockets
  if (tier === 3) { r[5] = '....kXYzzYXk..n.'; r[6] = '.....kzXXzk...n.'; }   // burning eyes, and the mouth too
  if (armor >= 1) { r[7] = '....kzzPPzzk.kn.'; r[8] = '...kzzPPPPzzkzn.'; }   // bone plates on the shoulders
  if (armor >= 2) { r[1] = '.....kzkkzk.....'; r[2] = '.....kzPPzk.....'; r[3] = '....kzzyzzzk..y.'; } // a bone crown
  return staff ? r : r.map((row, i) => i === 3 ? row.slice(0, 13) + '...' : i >= 4 && i <= 11 ? row.slice(0, 13) + '...' : row);
}
const ELEM = {
  force: { id: 'wizard', name: 'FORCE', pal: {}, eye: '#c060ff', core: '#ffe0ff', resist: ['force'] },
  fire: { id: 'wizard_fire', name: 'FIRE', pal: { P: '#901c14', p: '#e0502c' }, eye: '#ff8020', core: '#fff0a0', resist: ['fire'] },
  storm: { id: 'wizard_storm', name: 'STORM', pal: { P: '#1c3e8c', p: '#58b0f0' }, eye: '#60f0ff', core: '#ffffff', resist: ['storm'] },
  bone: { id: 'wizard_bone', name: 'BONE', pal: { P: '#e4e0d4', p: '#9c968a', y: '#a0a0a8' }, eye: '#60ff80', core: '#e0ffe0', resist: ['force', 'fire', 'storm'] },
};
const TIER_SUFFIX = ['', '', '_adept', '_arch'], TIER_NAME = ['', 'MAGE', 'ADEPT', 'ARCHMAGE'];
const mageId = (el, tier) => ELEM[el].id + TIER_SUFFIX[tier];
// ---- helpers ----
function blink(sim, e, p, near) { // pop to a spot near (or, staffless, away from) the hero, inside the room
  const L = sim.W.levels[e.lvl];
  for (let i = 0; i < 20; i++) {
    const a = near ? Math.random() * TAU : Math.atan2(e.y - p.y, e.x - p.x) + (Math.random() - 0.5) * 2, r = near ? 2.5 + Math.random() * 2 : 3 + Math.random() * 2;
    const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
    if (AI.safeAt(L, x, y) && (!e.b || (x > e.b.x0 && x < e.b.x1 && y > e.b.y0 && y < e.b.y1))) { sim.puff(e, 0.8); e.x = x; e.y = y; return; }
  }
}
function disarmedAi(sim, e, dt, { p }) { if (e.tm > 0 || !p) return; blink(sim, e, p, false); e.tm = 1.8 + Math.random(); }
const isMage = (o) => o && o.k === 'en' && !o.dead && enemyDef(o.type).mage;
const roomMates = (sim, e) => sim.ents.filter(o => o !== e && o.k === 'en' && !o.dead && o.lvl === e.lvl && (e.g ? o.g === e.g : dist2(o.x, o.y, e.x, e.y) < 64));
const heroesNear = (sim, e, r) => Object.values(sim.players).filter(pl => pl.alive && pl.lvl === e.lvl && dist2(pl.x, pl.y, e.x, e.y) < r * r);
function raise(sim, e, armor, cap) { // skeletons climb out of the floor beside a bone mage
  const mine = sim.ents.filter(o => o.k === 'en' && !o.dead && o.raisedBy === e.id).length; if (mine >= cap) return 0;
  const s = sim.spawnMinion(e, armor ? 'skeleton_a' + armor : 'skeleton'); if (!s) return 0; s.raisedBy = e.id; sim.sfx('rattle', e.lvl, s.x, s.y); return 1;
}
function mark(sim, e, x, y, life, spr, sc) { sim.spawn({ k: 'fx', lvl: e.lvl, x, y, spr: spr || 'strikemark', life, sc: sc || 1.1, z: -0.36 }); }
// ---- the spells ----
const SPELL = {
  bolt(sim, e, p, a) { const el = enemyDef(e.type).elem; const proj = { force: 'magic', fire: 'fire', storm: 'stormbolt' }[el];
    if (el === 'bone') { AI.fan(sim, e, 'boneshard', a, 3, 0.5, { dmg: 2 * e.dmgMul }); sim.sfx('bonecast', e.lvl, e.x, e.y); return; }
    sim.fireProj(proj, e.lvl, e.x, e.y, a, 'e', null, { dmg: 2 * e.dmgMul }); if (el === 'storm' && enemyDef(e.type).tier >= 2) sim.fireProj(proj, e.lvl, e.x, e.y, a + 0.18, 'e', null, { dmg: 2 * e.dmgMul });
    sim.sfx(el === 'fire' ? 'fire' : el === 'storm' ? 'zap' : 'magic', e.lvl, e.x, e.y); },
  push(sim, e, p, a) { AI.fan(sim, e, 'forcepush', a, 5, 1.0, { dmg: 1 * e.dmgMul }); sim.sfx('force', e.lvl, e.x, e.y); },
  patches(sim, e, p) { // fire lands where you stand, and around it
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5, r = i ? 0.9 : 0; sim.spawn({ k: 'efire', lvl: e.lvl, x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, life: 3.2, spr: 'flame', sc: 0.7, z: -0.05 }); }
    sim.sfx('fire', e.lvl, p.x, p.y); },
  strike(sim, e, p) { e.strikes = (e.strikes || []).concat([{ at: sim.time + 0.8, x: p.x, y: p.y }]); mark(sim, e, p.x, p.y, 0.8); sim.sfx('charge', e.lvl, p.x, p.y); },
  shards(sim, e) { AI.ring(sim, e, 'boneshard', 8, Math.random(), { dmg: 2 * e.dmgMul }); sim.sfx('bonecast', e.lvl, e.x, e.y); },
  raise(sim, e) { const t = enemyDef(e.type).tier; raise(sim, e, t, t === 3 ? 5 : 2); },
  march(sim, e) { let n = 0; for (let i = 0; i < 5; i++) n += raise(sim, e, 3, 5); if (n) { sim.msg('THE DEAD MARCH!'); sim.ev({ t: 'shake', lvl: e.lvl, x: e.x, y: e.y }); } e.marchAt = sim.time + 16; },
  shield(sim, e) { // hold a bubble over the ally nearest the hero; stand still while it lasts
    const p = sim.nearestPlayer(e, 30); const allies = roomMates(sim, e).filter(o => !enemyDef(o.type).boss && !o.wardBy && !(o.channel != null));
    if (!allies.length || !p) return false; allies.sort((a, b) => dist2(a.x, a.y, p.x, p.y) - dist2(b.x, b.y, p.x, p.y));
    const o = allies[0]; o.wardBy = e.id; e.channel = o.id; e.channelUntil = sim.time + 6; sim.sfx('ward', e.lvl, o.x, o.y); return true;
  },
};
// what a mage of each element and tier picks from (weights)
const MOVES = {
  force: [[['bolt', 1]], [['bolt', 2], ['push', 1], ['shield', 1.4]]],
  fire: [[['bolt', 1]], [['bolt', 2], ['patches', 1.2]]],
  storm: [[['bolt', 1]], [['bolt', 1.5], ['strike', 1.5]]],
  bone: [[['bolt', 2], ['raise', 1]], [['bolt', 1.5], ['shards', 1], ['raise', 1]]],
};
function pick(list) { let t = 0; for (const [, w] of list) t += w; let r = Math.random() * t; for (const [m, w] of list) { r -= w; if (r <= 0) return m; } return list[0][0]; }
// ---- combos (archmages start them, adepts and archmages join) ----
const COMBO_WINDUP = 1.1;
function startCombo(sim, e, p) {
  const def = enemyDef(e.type); const joiners = roomMates(sim, e).filter(o => isMage(o) && enemyDef(o.type).tier >= 2 && !o.disarmed && o.channel == null && !o.joining && !o.combo);
  for (const o of joiners) { o.joining = e.id; o.st = 0; }
  const wind = def.elem === 'bone' ? OSSUARY_WINDUP : COMBO_WINDUP;
  e.combo = { kind: def.elem, at: sim.time + wind, x: p.x, y: p.y, a: Math.atan2(p.y - e.y, p.x - e.x), joined: joiners.map(o => enemyDef(o.type).elem) };
  if (def.elem === 'bone') { const cx = Math.floor(p.x), cy = Math.floor(p.y); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) mark(sim, e, cx + dx + 0.5, cy + dy + 0.5, wind, 'bonemark', 0.6); }
  if (def.elem === 'storm') { for (let d = 1; d < 12; d += 0.8) mark(sim, e, e.x + Math.cos(e.combo.a) * d, e.y + Math.sin(e.combo.a) * d, COMBO_WINDUP, 'lancemark'); }
  sim.sfx('chant', e.lvl, e.x, e.y); e.comboAt = sim.time + 9 + Math.random() * 3;
}
function releaseCombo(sim, e, p) {
  const c = e.combo; e.combo = null; const n = c.joined.length; for (const o of sim.ents) if (o.joining === e.id) o.joining = null;
  const L = sim.W.levels[e.lvl];
  if (c.kind === 'force') { AI.ring(sim, e, 'forcepush', 16 + 4 * n, 0, { dmg: (1 + n) * e.dmgMul }); sim.sfx('force', e.lvl, e.x, e.y); sim.ev({ t: 'shake', lvl: e.lvl, x: e.x, y: e.y }); }
  else if (c.kind === 'fire') { // across the line from the mage to where you stood
    const tx = p ? p.x : c.x, ty = p ? p.y : c.y, a = Math.atan2(ty - e.y, tx - e.x) + Math.PI / 2, len = 5 + 2 * n;
    for (let d = -len / 2; d <= len / 2; d += 0.6) { const x = tx + Math.cos(a) * d, y = ty + Math.sin(a) * d; if (!L.solidAt(x, y)) sim.spawn({ k: 'efire', lvl: e.lvl, x, y, life: 4, spr: 'flame', sc: 0.9, z: -0.05 }); }
    sim.sfx('fire', e.lvl, tx, ty);
  } else if (c.kind === 'storm') { sim.fireProj('elance', e.lvl, e.x, e.y, c.a, 'e', null, { dmg: (3 + n) * e.dmgMul }); sim.sfx('beam', e.lvl, e.x, e.y); sim.ev({ t: 'shake', lvl: e.lvl, x: e.x, y: e.y }); }
  else if (c.kind === 'bone') ossuary(sim, e, { x: c.x, y: c.y }, c.joined); // where you stood when the chant began
}
// THE OSSUARY: a ring of ribs (low walls: a Gale Cloak flies over them in a tall room) around the hero, closing
function ossuary(sim, e, p, joined) {
  const L = sim.W.levels[e.lvl]; const cx = Math.floor(p.x), cy = Math.floor(p.y); const hot = joined.includes('fire');
  const ribs = []; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) continue; const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= L.w || y >= L.h) continue;
    const i = L.idx(x, y); const ti = TINFO[L.tiles[i]]; if (ti.solid || ti.pit || ti.water || L.props[i]) continue;
    if (sim.ents.some(o => o.k === 'en' && !o.dead && o.lvl === L.id && Math.floor(o.x) === x && Math.floor(o.y) === y)) continue;
    sim.setTempTile(L.id, i, hot ? TL.BONERIB_HOT : TL.BONERIB, OSSUARY_CLOSE + 0.2); ribs.push(i);
  }
  L.ribHits = L.ribHits || {}; for (const i of ribs) L.ribHits[i] = 0;
  sim.ossuaries = (sim.ossuaries || []).concat([{ lvl: L.id, cx: cx + 0.5, cy: cy + 0.5, ribs, by: e.id, dmg: 3 + joined.length, at: sim.time + (joined.includes('force') ? OSSUARY_CLOSE / 2 : OSSUARY_CLOSE), storm: joined.includes('storm'), zapAt: sim.time + 0.5 }]);
  sim.sfx('rattle', L.id, p.x, p.y); sim.ev({ t: 'shake', lvl: L.id, x: p.x, y: p.y }); sim.msg('THE OSSUARY CLOSES!');
}
// called by game/sim.js every tick
Content.updateOssuaries = function (sim) {
  if (!sim.ossuaries || !sim.ossuaries.length) return;
  sim.ossuaries = sim.ossuaries.filter(o => {
    const L = sim.W.levels[o.lvl]; const inside = Object.values(sim.players).filter(pl => pl.alive && pl.lvl === o.lvl && !sim.flying(pl) && Math.max(Math.abs(pl.x - o.cx), Math.abs(pl.y - o.cy)) < 1.6);
    if (o.storm && sim.time >= o.zapAt) { o.zapAt = sim.time + 0.9; for (const pl of inside) { sim.hurtPlayer(pl, 1, { k: 'proj', type: 'stormbolt', x: o.cx, y: o.cy }); sim.spawn({ k: 'fx', lvl: o.lvl, x: pl.x, y: pl.y, spr: 'zapfx', life: 0.2, sc: 1 }); } }
    if (sim.time < o.at) return true;
    for (const pl of inside) sim.hurtPlayer(pl, o.dmg, { k: 'proj', type: 'boneshard', x: o.cx, y: o.cy }); if (inside.length) sim.msg('CRUSHED!');
    sim.clearRibs(o); sim.sfx('boom', o.lvl, o.cx, o.cy);
    // and as the cage falls, the dead climb out of where the ribs stood
    const by = sim.ents.find(x => x.id === o.by && !x.dead); const mine = sim.ents.filter(x => x.k === 'en' && !x.dead && x.raisedBy === o.by).length;
    const spots = o.ribs.slice().sort(() => Math.random() - 0.5).slice(0, Math.max(0, Math.min(OSSUARY_DEAD, OSSUARY_DEAD_MAX - mine)));
    for (const i of spots) { const s = sim.spawnEnemy('skeleton_a3', o.lvl, i % L.w + 0.5, Math.floor(i / L.w) + 0.5, by ? { group: by.g, bounds: by.b } : {}); s.raisedBy = o.by; s.spawnFx = 0.15; s.tm = 0; s.f = Math.atan2(o.cy - s.y, o.cx - s.x); }
    if (spots.length) sim.sfx('rattle', o.lvl, o.cx, o.cy);
    for (let k = 0; k < 8; k++) sim.fireProj('boneshard', o.lvl, o.cx, o.cy, k * TAU / 8, 'e', null, { dmg: 2 });
    return false;
  });
};
// ---- the brain ----
function mageAi(sim, e, dt, { p }) {
  const def = enemyDef(e.type);
  for (const s of e.strikes || []) if (sim.time >= s.at) { s.done = true; sim.spawn({ k: 'fx', lvl: e.lvl, x: s.x, y: s.y, spr: 'zapfx', life: 0.3, sc: 1.6, z: 0 }); sim.sfx('thunder', e.lvl, s.x, s.y); for (const pl of Object.values(sim.players).filter(q => q.alive && q.lvl === e.lvl && dist2(q.x, q.y, s.x, s.y) < 0.75 * 0.75)) sim.hurtPlayer(pl, 2 * e.dmgMul, { k: 'proj', type: 'stormbolt', x: s.x, y: s.y }); }
  if (e.strikes) e.strikes = e.strikes.filter(s => !s.done);
  if (e.joining) { const lead = sim.ents.find(o => o.id === e.joining); if (!lead || lead.dead || !lead.combo) e.joining = null; else { if (Math.random() < dt * 6) sim.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: 'chantfx', life: 0.3, sc: 0.8, z: 0.6 }); return; } }
  if (e.channel != null) { // holding a shield over an ally
    const o = sim.ents.find(x => x.id === e.channel);
    if (!o || o.dead || sim.time > e.channelUntil) { if (o) o.wardBy = null; e.channel = null; e.tm = 1; }
    else { if (Math.random() < dt * 8) { sim.spawn({ k: 'fx', lvl: e.lvl, x: o.x, y: o.y, spr: 'wardbubble', life: 0.18, sc: 1.4, z: 0.1 }); const t = Math.random(); sim.spawn({ k: 'fx', lvl: e.lvl, x: lerp(e.x, o.x, t), y: lerp(e.y, o.y, t), spr: 'chantfx', life: 0.2, sc: 0.4, z: 0.5 }); } return; }
  }
  if (e.combo) { if (Math.random() < dt * 8) sim.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: 'chantfx', life: 0.3, sc: 1.1, z: 0.7 }); if (sim.time >= e.combo.at) { releaseCombo(sim, e, p); e.tm = 1.4; } return; }
  if (e.tm > 0 || !p) return;
  if (e.st === 0) { blink(sim, e, p, true); e.st = 1; e.tm = 0.7; return; }
  e.st = 0; e.tm = 1.6 + Math.random() - (def.tier - 1) * 0.25;
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  if (def.tier === 3 && def.elem === 'bone' && sim.time >= (e.marchAt || 0)) { SPELL.march(sim, e); return; }
  if (def.tier === 3 && sim.time >= (e.comboAt != null ? e.comboAt : (e.comboAt = sim.time + 3))) { startCombo(sim, e, p); return; }
  const move = pick(MOVES[def.elem][def.tier === 1 ? 0 : 1]);
  if (move === 'shield') { if (SPELL.shield(sim, e)) return; SPELL.bolt(sim, e, p, a); return; }
  SPELL[move](sim, e, p, a);
}
// ---- the mages ----
for (const el of Object.keys(ELEM)) for (let tier = 1; tier <= 3; tier++) {
  const E = ELEM[el], id = mageId(el, tier), bone = el === 'bone', pal = Object.assign({}, E.pal, { X: E.eye, Y: E.core });
  const armor = tier - 1, res = {}; for (const k of E.resist) res[k] = Math.max(MAGE_RESIST[tier], bone ? 0.5 : 0);
  const spawns = bone ? {} : { force: [{ dungeons: [6, 7, 8, 9] }, { dungeons: [8, 9] }, { dungeons: [9] }], fire: [{ dungeons: [7, 9] }, { dungeons: [9, 12] }, { dungeons: [12] }], storm: [{ dungeons: [6, 8, 9] }, { dungeons: [8, 9] }, { dungeons: [9] }] }[el][tier - 1];
  const ids = { full: id, bare: id + '_bare' }; for (let a = 0; a < armor; a++) ids['a' + a] = id + '_a' + a;
  defineEnemy({
    id, title: E.name + ' ' + TIER_NAME[tier], mage: true, elem: el, tier, armor: armor || undefined,
    fly: tier === 3 || undefined, z: tier === 3 ? 0.3 : undefined, // archmages float: no knocking them into a pit or lava
    hp: (bone ? [8, 10, 14] : [4, 6, 8])[tier - 1], spd: 0, dmg: 2, r: 0.32, sc: 0.9 + (tier - 1) * 0.05,
    spawns, ai: mageAi, disarm: 'staff_drop', disarmedSprite: ids.bare, disarmText: 'THE STAFF GOES FLYING!', disarmedAi,
    resist: res, hot: el === 'fire' || undefined, noElites: tier === 3 ? ['giant', 'splitter'] : undefined,
    hitMul: bone ? (opt) => (opt.arrow ? 0.5 : opt.blunt ? 2 : 1) : el === 'storm' ? (opt, e) => { if (opt.reflected) e.stun = Math.max(e.stun || 0, 2); return 1; } : undefined,
    onDamage(sim, e) { if (e.channel != null) { const o = sim.ents.find(x => x.id === e.channel); if (o) o.wardBy = null; e.channel = null; } }, // any hit breaks a shield it's holding
    onDeath: bone && tier === 3 ? (sim, e) => { if (!sim.team.taken['bonearch:ring']) sim.spawn({ k: 'pick', lvl: e.lvl, x: e.x, y: e.y, item: 'ring_hollow', tk: 'bonearch:ring', perm: true, spr: itemSprite('ring_hollow'), sc: 0.55, z: 0.1, team: false }); else sim.dropItem('gems100', e.lvl, e.x, e.y, { perm: true }); } : undefined,
    rare: bone ? null : { type: mageId('bone', tier), chance: WIZ_BONE_CHANCE },
    sprFor: armor ? (e) => (e.armor >= armor || e.disarmed ? null : ids['a' + (e.armor || 0)]) : undefined,
    anim: { fps: 3, frames: (s, kit) => [s, kit.shiftCols(s, 13, 15, -1), kit.shiftCols(s, 13, 15, -2)] },
    sprite: wizRows(tier, armor, true), pal,
  });
  defineSprite(ids.bare, wizRows(tier, 0, false), pal);
  for (let a = 0; a < armor; a++) defineSprite(ids['a' + a], wizRows(tier, a, true), pal);
}
// ---- effects and tiles ----
defineSprite('strikemark', [
  '................', '................', '................', '................', '.....yyyyyy.....', '...yy......yy...', '..y....ww....y..', '..y...wwww...y..',
  '..y...wwww...y..', '..y....ww....y..', '...yy......yy...', '.....yyyyyy.....', '................', '................', '................', '................']);
defineSprite('lancemark', [
  '................', '................', '................', '................', '................', '................', '.......yy.......', '......ywwy......',
  '......ywwy......', '.......yy.......', '................', '................', '................', '................', '................', '................']);
defineSprite('zapfx', [
  '........y.......', '.......yw.......', '......yw........', '.....ywy........', '......ywy.......', '.......yw.......', '......yw........', '.....ywwy.......',
  '....yw..wy......', '...y......y.....', '................', '................', '................', '................', '................', '................']);
defineSprite('bonemark', [
  '................', '................', '................', '................', '................', '................', '.....kk...kk....', '....kzzk.kzzk...',
  '.....kzzkzzk....', '......kzzzk.....', '.....kzzkzzk....', '....kzzk.kzzk...', '.....kk...kk....', '................', '................', '................']);
defineSprite('chantfx', [
  '................', '................', '................', '................', '................', '.......w........', '......wcw.......', '.......w........',
  '................', '................', '................', '................', '................', '................', '................', '................']);
defineSprite('wardbubble', [
  '................', '.....cccccc.....', '...cc......cc...', '..c..........c..', '.c..w........c..', '.c.w..........c.', 'c..............c', 'c..............c',
  'c..............c', 'c..............c', '.c............c.', '.c............c.', '..c..........c..', '...cc......cc...', '.....cccccc.....', '................']);
defineTexture('ribwall', (x, y, r, ctx) => { const u = (x + Math.round(Math.sin(y * 0.2) * 2) + 64) % 8; return u >= 2 && u <= 5 ? ctx.vary(u === 2 ? [190, 182, 164] : [236, 228, 208], x, y, 0.06) : ctx.vary([22, 16, 24], x, y, 0.2); });
defineTexture('ribwall_hot', (x, y, r, ctx) => { const u = (x + Math.round(Math.sin(y * 0.2) * 2) + 64) % 8; return u >= 2 && u <= 5 ? ctx.vary(u === 2 ? [220, 90, 30] : [255, 190, 90], x, y, 0.12) : ctx.vary([40, 12, 8], x, y, 0.3); });
defineTile('BONERIB', { solid: true, wall: 'ribwall', tall: 1.5, low: true, rib: true, floor: 'dfloor' });
defineTile('BONERIB_HOT', { solid: true, wall: 'ribwall_hot', tall: 1.5, low: true, rib: true, ribHot: true, floor: 'dfloor' });
// without its staff (knocked away by a Heavy Pommel strike)
defineSprite('staff_drop', [ // the wizard's staff, tumbling away
  '................', '................', '..........y.....', '.........yny....', '..........n.....', '.........n......', '........n.......', '.......n........',
  '......n.........', '.....n..........', '....n...........', '...n............', '................', '................', '................', '................']);
