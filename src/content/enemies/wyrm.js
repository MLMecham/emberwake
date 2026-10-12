// ===== content/enemies/wyrm.js =====
// The wyrmlings: bosses of levels 1, 4 and 7, children of the great dragons (see dragons.js).
// Level 1's hatched from a frost egg, level 4's from the Patriarch's magma, level 7's was born of the Hollow head.
// They sway side to side breathing fans of their element.
'use strict';
const wyrmAi = (proj) => (sim, e, dt, { p, spd, def }) => {
  if (e.tm <= 0) {
    e.tm = e.hp < e.maxHp / 2 ? 1.3 : 2; // angrier when hurt
    if (p) { AI.fan(sim, e, proj, Math.atan2(p.y - e.y, p.x - e.x), 3, 0.7, { dmg: 2 }); sim.sfx('roar', e.lvl, e.x, e.y); }
  }
  if (sim.moveEnt(e, Math.cos(e.st ? 0 : Math.PI) * spd * dt, Math.sin(e.t * 1.3) * spd * 0.6 * dt, def)) e.st = e.st ? 0 : 1;
};
defineEnemy({
  id: 'wyrm', title: 'MAGMA WYRMLING',
  hp: 10, spd: 1.2, dmg: 2, r: 0.7, sc: 1.8, boss: true, hot: true,
  bossOf: [4],
  ai: wyrmAi('fire'),
  anim: { fps: 3, frames: (s, kit) => [s, kit.bob(s, 1), kit.step(s, 12, -1, 0)] },
  sprite: [
    '....k......k....',
    '...kRk....kRk...',
    '...kRRkkkkRRk...',
    '..kRrrrrrrrrRk..',
    '..krrwkrrkwrrk..',
    '..krrkkrrkkrrk..',
    '.kRrrrrrrrrrrRk.',
    '.krrryrrrryrrrk.',
    '.krrkkkkkkkkrrk.',
    '.krkwkwkwkwkkrk.',
    '..krkoooooookk..',
    '..kRkkkkkkkkRk..',
    '.kRRrrRrrRrrRRk.',
    'kRRrrrRrrRrrrRRk',
    'kRRk..kRRk..kRRk',
    'kk.....kk.....kk',
  ],
});
// the frost hatchling (level 1) and the hollow hatchling (level 7): same body, their parents' colors and breath
for (const [id, bossOf, proj, pal] of [['wyrm_frost', [1], 'icebolt', { r: '#86ccf0', R: '#2c62a0', o: '#e8f8ff', y: '#40ffff' }], ['wyrm_hollow', [7], 'magic', { r: '#7a44b0', R: '#2e1450', o: '#d0a0ff', y: '#ff60ff' }]]) {
  defineEnemy(Object.assign({}, enemyDef('wyrm'), { id, bossOf, title: id === 'wyrm_frost' ? 'FROST WYRMLING' : 'HOLLOW WYRMLING', hot: false, pal, ai: wyrmAi(proj), anim: { fps: 3, frames: (s, kit) => [s, kit.bob(s, 1), kit.step(s, 12, -1, 0)] } }));
}

// ===================== THE ELDER WYRMLINGS (the frontier tunnels' miniboss pair) =====================
// Older siblings of the dungeon 1 / 4 bosses, always met two at once (game/world.js genTunnel). Tougher, and they fight as a pair:
//   CROSSFIRE  each holds its own end of the room and they take turns breathing, so the shots cross in the middle
//   CHARGE     one glows (ELDER_WINDUP) and then dashes straight at you until it hits a wall: step aside
//   GRIEF      when one falls, the other roars: faster breath, five shots instead of three, and it charges more often
//   FROST LANCE (frost pair) a line of ice that turns the floor to slippery ice for a few seconds
//   EMBER RAIN  (magma pair) three blobs lobbed at you; each shows a shadow first, then lands as a burning splash
const ELDER_WINDUP = 0.55, ELDER_DASH = 9;
function elderAi(el) {
  const proj = el === 'frost' ? 'icebolt' : 'fire';
  return function (sim, e, dt, { p, spd, def }) {
    const L = sim.W.levels[e.lvl]; const b = e.b || { x0: e.x - 5, x1: e.x + 5, y0: e.y - 3, y1: e.y + 3 };
    const partner = sim.ents.find(o => o !== e && o.k === 'en' && !o.dead && o.type === e.type && o.g === e.g);
    if (!e.init) { e.init = true; e.chargeIn = 4 + Math.random() * 3; if (partner && e.id > partner.id) e.tm += 1.1; } // the second one starts a beat later
    if (partner) e.hadPartner = true;
    else if (e.hadPartner && !e.grief) { e.grief = true; e.tm = 0.6; e.chargeIn = 1.5; sim.sfx('roar', e.lvl, e.x, e.y); sim.msg('THE WYRM ROARS FOR ITS SIBLING!'); }
    if (e.chargeT > 0) { e.chargeT -= dt; if (e.chargeT <= 0) { e.dashT = 1.1; e.dashA = p ? Math.atan2(p.y - e.y, p.x - e.x) : e.f; sim.sfx('roar', e.lvl, e.x, e.y); } return; }
    if (e.dashT > 0) { e.dashT -= dt; if (sim.moveEnt(e, Math.cos(e.dashA) * ELDER_DASH * dt, Math.sin(e.dashA) * ELDER_DASH * dt, def)) { e.dashT = 0; sim.ev({ t: 'shake', lvl: e.lvl, x: e.x, y: e.y }); } return; }
    e.chargeIn -= dt; if (e.chargeIn <= 0 && p) { e.chargeIn = (e.grief ? 3.5 : 6.5) + Math.random() * 2; e.chargeT = ELDER_WINDUP; sim.sfx('windup', e.lvl, e.x, e.y); return; }
    // hold your end of the room (crossfire), swaying up and down
    const side = partner ? (e.id < partner.id ? -1 : 1) : 0; const cx = (b.x0 + b.x1) / 2 + side * 3.2;
    sim.moveEnt(e, clamp(cx - e.x, -1, 1) * spd * dt, Math.sin(e.t * 1.3 + side) * spd * 0.8 * dt, def);
    if (e.tm > 0 || !p) return;
    e.tm = e.grief ? 1.1 : e.hp < e.maxHp / 2 ? 1.5 : 2.2; e.n = (e.n || 0) + 1;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    if (e.n % 3 === 0) { if (el === 'frost') frostLance(sim, L, e, a); else emberRain(sim, e, p); return; }
    AI.fan(sim, e, proj, a, e.grief ? 5 : 3, e.grief ? 1.1 : 0.7, { dmg: 2 }); sim.sfx('roar', e.lvl, e.x, e.y);
  };
}
// FROST LANCE: a fast ice bolt, and the floor along its line turns to ice for a few seconds
function frostLance(sim, L, e, a) {
  sim.fireProj('icebolt', e.lvl, e.x, e.y, a, 'e', null, { dmg: 2 }); sim.sfx('freeze', e.lvl, e.x, e.y);
  for (let d = 1; d <= 9; d += 0.5) {
    const x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d; const i = L.idx(Math.floor(x), Math.floor(y)); const ti = TINFO[L.tiles[i]];
    if (ti.solid) break; if (ti.exit || ti.portal || ti.hurt || ti.pit || ti.water) continue;
    sim.setTempTile(e.lvl, i, TL.ICE, 5);
  }
}
// EMBER RAIN: three blobs lobbed at you (one right at you, two nearby), each with a shadow before it lands
function emberRain(sim, e, p) {
  for (let k = 0; k < 3; k++) {
    const x = p.x + (k ? (Math.random() - 0.5) * 3 : 0), y = p.y + (k ? (Math.random() - 0.5) * 3 : 0);
    sim.spawn({ k: 'emberblob', lvl: e.lvl, x, y, land: 0.9 + k * 0.2, spr: 'fireball', sc: 0.9, z: 2.5, src: e.id });
    sim.spawn({ k: 'fx', lvl: e.lvl, x, y, spr: 'shadowring', life: 0.9 + k * 0.2, sc: 0.9, z: -0.35 });
  }
  sim.sfx('roar', e.lvl, e.x, e.y);
}
defineEntity('emberblob', { update(sim, e) {
  e.z = 2.5 * Math.max(0, 1 - e.t / e.land); if (e.t < e.land) return; e.dead = true;
  const L = sim.W.levels[e.lvl]; sim.sfx('boom', e.lvl, e.x, e.y); sim.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: 'boom', life: 0.35, sc: 0.9, z: 0 });
  for (const pl of Object.values(sim.players)) if (pl.alive && pl.lvl === e.lvl && dist2(pl.x, pl.y, e.x, e.y) < 0.8) sim.hurtPlayer(pl, 2, e);
  const i = L.idx(Math.floor(e.x), Math.floor(e.y)); const ti = TINFO[L.tiles[i]];
  if (!ti.solid && !ti.exit && !ti.portal && !ti.water && !ti.pit) sim.setTempTile(e.lvl, i, TL.LAVA, 3); // a burning splash
} });
defineSprite('shadowring', [ // where something is about to land
  '................', '................', '................', '................', '................', '................', '................', '................',
  '................', '................', '....kkkkkkkk....', '..kk........kk..', '.k............k.', '..kk........kk..', '....kkkkkkkk....', '................']);
for (const [id, base, el, title, pal, glow] of [
  ['wyrm_elder_frost', 'wyrm_frost', 'frost', 'ELDER FROST WYRM', { r: '#5aa8e0', R: '#1a3c78', o: '#ffffff', y: '#40ffff' }, { r: '#ffffff', R: '#a8e8ff' }],
  ['wyrm_elder', 'wyrm', 'fire', 'ELDER MAGMA WYRM', { r: '#c02818', R: '#500a08', o: '#ffd060', y: '#ffff60' }, { r: '#ffd040', R: '#ff7020' }]]) {
  defineEnemy(Object.assign({}, enemyDef(base), { id, title, bossOf: [], spawns: {}, hp: 12, sc: 2.0, pal, ai: elderAi(el), sprFor: (e) => e.chargeT > 0 ? id + '_glow' : null, anim: { fps: 3, frames: (s, kit) => [s, kit.bob(s, 1), kit.step(s, 12, -1, 0)] } }));
  defineSpriteVariant(id + '_glow', id, glow); // winding up a charge
}
