// ===== content/enemies/spider.js =====
// Boss of levels 3 and 6. Fast lunges.
'use strict';
defineEnemy({
  id: 'spider',
  hp: 8, spd: 3.2, dmg: 2, r: 0.6, sc: 1.5, boss: true,
  bossOf: [3, 6],
  ai: AI.lunge(0.55, 0.5, 1.1),
  anim: { fps: 9, frames: (s, kit) => [s, kit.shearRows(kit.shearRows(s, 2, 5, 1), 10, 13, -1), kit.shearRows(kit.shearRows(s, 2, 5, -1), 10, 13, 1)] },
  sprite: [
    '................',
    '................',
    '.k....kkkk....k.',
    '..k..kGGGGk..k..',
    'k..kkGGGGGGkk..k',
    '.k.kGrGGGGrGk.k.',
    '..kkGGGGGGGGkk..',
    'kkkGGGrrrrGGGkkk',
    '...kGGGGGGGGk...',
    '..kkGGGkkGGGkk..',
    '.k.kkGGGGGGkk.k.',
    'k..k.kkkkkk.k..k',
    '..k..........k..',
    '.k............k.',
    '................',
    '................',
  ],
});
