// ===== content/enemies/spitter.js =====
// Walks in straight lines and spits rocks. Your shield blocks rocks from the front.
'use strict';
defineEnemy({
  id: 'spitter',
  hp: 1, spd: 1.3, dmg: 1, r: 0.32, sc: 0.8,
  spawns: { biomes: ['plains', 'forest', 'mountain', 'lake', 'desert'], dungeons: [3] },
  ai: AI.shooter('rock'),
  anim: { fps: 6, frames: (s, kit) => [s, kit.shearRows(s, 11, 13, 1), s, kit.shearRows(s, 11, 13, -1)] },
  sprite: [
    '................',
    '................',
    '................',
    '.....kkkkkk.....',
    '...kkrrrrrrkk...',
    '..krrwwrrwwrrk..',
    '..krwkwrrwkwrk..',
    '.krrrrrrrrrrrrk.',
    '.krrrrRkkRrrrrk.',
    '..kRrrRkkRrrRk..',
    '...kRRRkkRRRk...',
    '..krk.krrk.krk..',
    '.krk..krrk..krk.',
    '.kk...k..k...kk.',
    '................',
    '................',
  ],
});
