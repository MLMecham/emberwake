// ===== content/enemies/ghost.js =====
// Drifts through walls toward you.
'use strict';
defineEnemy({
  id: 'ghost',
  hp: 3, spd: 1.1, dmg: 2, r: 0.32, sc: 0.85, fly: true, phase: true,
  spawns: { biomes: ['graveyard'], dungeons: [4, 5, 7, 8, 9] },
  ai: AI.chase,
  anim: { fps: 4, frames: (s, kit) => [s, kit.shearRows(s, 10, 14, 1), s, kit.shearRows(s, 10, 14, -1)] },
  sprite: [
    '................',
    '................',
    '......kkkk......',
    '....kkwwwwkk....',
    '...kwwwwwwwwk...',
    '...kwkkwwkkwk...',
    '..kwwkkwwkkwwk..',
    '..kwwwwwwwwwwk..',
    '..kwwwkkkkwwwk..',
    '..kwwwwwwwwwwk..',
    '..kvwwwwwwwwvk..',
    '..kvvwwwwwwvvk..',
    '..kvvvwvvwvvvk..',
    '...kk.kvk.k.k...',
    '.......k........',
    '................',
  ],
});
