// ===== content/enemies/thornling.js =====
// Spear thrower.
'use strict';
defineEnemy({
  id: 'thornling',
  hp: 2, spd: 1.6, dmg: 1, r: 0.32, sc: 0.85,
  spawns: { biomes: ['plains', 'forest', 'mountain', 'desert'], dungeons: [2, 4, 9] },
  ai: AI.shooter('spear'),
  anim: { fps: 6, frames: (s, kit) => [s, kit.step(s, 13, -1, 0), s, kit.step(s, 13, 0, -1)] },
  sprite: [
    '..........u.....',
    '.........uuu....',
    '..........n.....',
    '....kkkk..n.....',
    '...kppppk.n.....',
    '..kpwkpwkpn.....',
    '..kpppppkpn.....',
    '...kpRRpk.n.....',
    '..kNNNNNNkpp....',
    '.kpNnnnnNkn.....',
    '.kp.NNNN..n.....',
    '....NnnN..n.....',
    '....NNNN..n.....',
    '....pk.pk.......',
    '...kpk.kpk......',
    '................',
  ],
});
