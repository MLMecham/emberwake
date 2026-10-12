// ===== content/enemies/wizard.js =====
// Blinks next to you and casts magic bolts.
'use strict';
defineEnemy({
  id: 'wizard',
  hp: 4, spd: 0, dmg: 2, r: 0.32, sc: 0.9,
  spawns: { dungeons: [6, 7, 8, 9] },
  ai: AI.blinkCaster('magic', 2),
  // a Heavy Pommel strike knocks the staff away: no more spells. It blinks away from you instead, and only fights up close.
  disarm: 'staff_drop', disarmedSprite: 'wizard_bare', disarmText: 'THE STAFF GOES FLYING!',
  disarmedAi(sim, e, dt, { p }) {
    if (e.tm > 0 || !p) return; const L = sim.W.levels[e.lvl];
    for (let i = 0; i < 20; i++) { const a = Math.atan2(e.y - p.y, e.x - p.x) + (Math.random() - 0.5) * 2, r = 3 + Math.random() * 2; const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; if (AI.safeAt(L, x, y) && (!e.b || (x > e.b.x0 && x < e.b.x1 && y > e.b.y0 && y < e.b.y1))) { sim.puff(e, 0.8); e.x = x; e.y = y; break; } }
    e.tm = 1.8 + Math.random();
  },
  anim: { fps: 3, frames: (s, kit) => [s, kit.shiftCols(s, 13, 15, -1), kit.shiftCols(s, 13, 15, -2)] },
  sprite: [
    '.......kk.......',
    '......kPPk......',
    '.....kPPPPk.....',
    '....kPPyPPPk..y.',
    '...kkkkkkkkkk.n.',
    '....kSwSSwSk..n.',
    '.....kSSSSk...n.',
    '....kPPPPPPk.kn.',
    '...kPpPPPPpPksn.',
    '...kPpPPPPpk..n.',
    '...kPpPyyPpk..n.',
    '...kPpPPPPpk..n.',
    '..kPPpPPPPpPk...',
    '..kPPPPPPPPPk...',
    '...kkkkkkkkk....',
    '................',
  ],
});
// without its staff (knocked away by a Heavy Pommel strike)
defineSprite('wizard_bare', [
  '.......kk.......', '......kPPk......', '.....kPPPPk.....', '....kPPyPPPk....', '...kkkkkkkkkk...', '....kSwSSwSk....', '.....kSSSSk.....', '....kPPPPPPk....',
  '...kPpPPPPpPks..', '...kPpPPPPpk....', '...kPpPyyPpk....', '...kPpPPPPpk....', '..kPPpPPPPpPk...', '..kPPPPPPPPPk...', '...kkkkkkkkk....', '................']);
defineSprite('staff_drop', [ // the wizard's staff, tumbling away
  '................', '................', '..........y.....', '.........yny....', '..........n.....', '.........n......', '........n.......', '.......n........',
  '......n.........', '.....n..........', '....n...........', '...n............', '................', '................', '................', '................']);
