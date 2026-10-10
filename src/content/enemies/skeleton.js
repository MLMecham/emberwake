// ===== content/enemies/skeleton.js =====
// Chases you down.
'use strict';
defineEnemy({
  id: 'skeleton',
  hp: 2, spd: 1.9, dmg: 1, r: 0.32, sc: 0.85,
  spawns: { biomes: ['desert', 'graveyard'], dungeons: [1, 3, 4, 6, 9] },
  ai: AI.chase,
  anim: { fps: 5, frames: (s, kit) => [s, kit.step(s, 12, -1, 0), s, kit.step(s, 12, 0, -1)] },
  sprite: [
    '................',
    '.....kkkkkk.....',
    '....kzzzzzzk....',
    '....kzkkzkkz....',
    '....kzkkzkkz....',
    '.....kzzzzk.....',
    '......kzkzk.....',
    '...kk.kzzzk.kk..',
    '..kzzkzkzkzkzzk.',
    '..kzk.kzzzk.kzk.',
    '..kzk.kzkzk.kzk.',
    '......kzzzk..u..',
    '......kz.zk..u..',
    '......kz.zk.....',
    '.....kzk.kzk....',
    '................',
  ],
});
