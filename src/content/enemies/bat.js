// ===== content/enemies/bat.js =====
// Fast, erratic flier. A boomerang knocks it out of the air.
'use strict';
defineEnemy({
  id: 'bat',
  hp: 1, spd: 2.6, dmg: 1, r: 0.28, sc: 0.6, fly: true, z: 0.35,
  spawns: { biomes: ['forest', 'lake', 'graveyard'], dungeons: [1, 2, 3, 5, 8] },
  ai: AI.flutter,
  anim: { fps: 10, frames: (s, kit) => [s, kit.shiftCols(kit.shiftCols(s, 0, 4, -3), 11, 15, -3), kit.shiftCols(kit.shiftCols(s, 0, 4, 2), 11, 15, 2)] },
  boomerangKills: true,
  sprite: [
    '................',
    '................',
    '................',
    '................',
    'k..............k',
    'kk....k..k....kk',
    'kPk...kkkk...kPk',
    'kPPk.kprrpk.kPPk',
    'kPPPkkppppkkPPPk',
    '.kPPPPppppPPPPk.',
    '..kPPk.kk.kPPk..',
    '...kk..w..w.kk..',
    '................',
    '................',
    '................',
    '................',
  ],
});
