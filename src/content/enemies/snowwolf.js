// ===== content/enemies/snowwolf.js =====
// White wolves that circle, then lunge. Fast on the snow.
'use strict';
defineEnemy({
  id: 'snowwolf', hp: 4, spd: 6.5, dmg: 2, r: 0.38, sc: 0.95,
  spawns: { biomes: ['snow'], dungeons: [10] },
  ai: AI.lunge(0.45, 0.9, 1.8),
  anim: { fps: 8, frames: (s, kit) => [s, kit.step(s, 12, -1, 1), s, kit.step(s, 12, 1, -1)] },
  sprite: [
    '................',
    '................',
    '..kk........kk..',
    '..kgk......kgk..',
    '..kgwkkkkkkwgk..',
    '.kwwwwwwwwwwwwk.',
    '.kwwckwwwwkcwwk.',
    '.kwwkkwwwwkkwwk.',
    '..kwwwwkkwwwwk..',
    '..kgwwkrrkwwgk..',
    '...kgwwwwwwgk...',
    '..kgwwwwwwwwgk..',
    '..kwwgwwwwgwwk..',
    '..kwk.kwwk.kwk..',
    '..kk...kk...kk..',
    '................',
  ],
});
