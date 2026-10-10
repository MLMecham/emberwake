// ===== content/enemies/wizard.js =====
// Blinks next to you and casts magic bolts.
'use strict';
defineEnemy({
  id: 'wizard',
  hp: 4, spd: 0, dmg: 2, r: 0.32, sc: 0.9,
  spawns: { dungeons: [6, 7, 8, 9] },
  ai: AI.blinkCaster('magic', 2),
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
