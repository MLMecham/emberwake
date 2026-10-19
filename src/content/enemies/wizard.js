// ===== content/enemies/wizard.js =====
// SKELETON MAGES: bone faces and empty sockets under the hat. Each blinks next to you and casts; the robe tells you what:
//   FORCE MAGE (purple, the old 'wizard' id) - a slow magic bolt
//   FIRE MAGE (red) - a fireball (it burns what it lands on)
//   STORM MAGE (blue) - a fast crackling bolt
//   BONE MAGE (white, rare: WIZ_BONE_CHANCE of any mage that spawns) - a fan of three bone shards (physical: your shield
//     stops them, unlike the others) and every third cast raises a skeleton beside it (two at most). Twice as tough.
// A Heavy Pommel strike knocks the staff away (once any armor is off): no more spells, it blinks away and fights up close.
'use strict';
const WIZ_BONE_CHANCE = 0.02;
const WIZ_ROWS = [
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
const WIZ_BARE = WIZ_ROWS.map((r, i) => i === 3 ? '....kPPyPPPk....' : i >= 4 && i <= 11 ? r.slice(0, 13) + '...' : r).map((r, i) => i === 8 ? '...kPpPPPPpPkz..' : r);
const WIZ_PAL = {
  wizard: null, // force: the palette's own purple
  wizard_fire: { P: '#901c14', p: '#e0502c' },
  wizard_storm: { P: '#1c3e8c', p: '#58b0f0' },
  wizard_bone: { P: '#e4e0d4', p: '#9c968a', y: '#a0a0a8' },
};
const bareSpr = (id) => id + '_bare';
function disarmedAi(sim, e, dt, { p }) { // staff gone: it blinks away from you and only fights up close
  if (e.tm > 0 || !p) return; const L = sim.W.levels[e.lvl];
  for (let i = 0; i < 20; i++) { const a = Math.atan2(e.y - p.y, e.x - p.x) + (Math.random() - 0.5) * 2, r = 3 + Math.random() * 2; const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; if (AI.safeAt(L, x, y) && (!e.b || (x > e.b.x0 && x < e.b.x1 && y > e.b.y0 && y < e.b.y1))) { sim.puff(e, x, y); break; } }
  e.tm = 1.8 + Math.random();
}
function boneCast(sim, e, a) { // three shards, and every third cast a skeleton climbs out of the floor
  AI.fan(sim, e, 'boneshard', a, 3, 0.5, { dmg: 2 * e.dmgMul }); sim.sfx('bonecast', e.lvl, e.x, e.y);
  e.casts = (e.casts || 0) + 1;
  if (e.casts % 3 === 0 && sim.ents.filter(o => o.k === 'en' && !o.dead && o.raisedBy === e.id).length < 2) { const s = sim.spawnMinion(e, 'skeleton'); if (s) { s.raisedBy = e.id; sim.sfx('rattle', e.lvl, s.x, s.y); } }
}
const mage = (id, title, opts) => defineEnemy(Object.assign({
  id, title, hp: 4, spd: 0, dmg: 2, r: 0.32, sc: 0.9,
  disarm: 'staff_drop', disarmedSprite: bareSpr(id), disarmText: 'THE STAFF GOES FLYING!', disarmedAi,
  anim: { fps: 3, frames: (s, kit) => [s, kit.shiftCols(s, 13, 15, -1), kit.shiftCols(s, 13, 15, -2)] },
  sprite: WIZ_ROWS, pal: WIZ_PAL[id] || undefined,
  rare: id === 'wizard_bone' ? null : { type: 'wizard_bone', chance: WIZ_BONE_CHANCE },
}, opts));
mage('wizard', 'FORCE MAGE', { spawns: { dungeons: [6, 7, 8, 9] }, ai: AI.blinkCaster('magic', 2) });
mage('wizard_fire', 'FIRE MAGE', { spawns: { dungeons: [7, 9] }, ai: AI.blinkCaster('fire', 2) });
mage('wizard_storm', 'STORM MAGE', { spawns: { dungeons: [6, 8, 9] }, ai: AI.blinkCaster('stormbolt', 2) });
mage('wizard_bone', 'BONE MAGE', { hp: 8, spawns: {}, ai: AI.blinkCaster(boneCast, 2) });
for (const id of Object.keys(WIZ_PAL)) { if (WIZ_PAL[id]) defineSpriteVariant(bareSpr(id), 'wizard_bare', WIZ_PAL[id]); }
defineSprite('wizard_bare', WIZ_BARE);
// without its staff (knocked away by a Heavy Pommel strike)
defineSprite('staff_drop', [ // the wizard's staff, tumbling away
  '................', '................', '..........y.....', '.........yny....', '..........n.....', '.........n......', '........n.......', '.......n........',
  '......n.........', '.....n..........', '....n...........', '...n............', '................', '................', '................', '................']);
