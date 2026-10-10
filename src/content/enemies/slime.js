// ===== content/enemies/slime.js =====
// Hops around in short bursts. The first thing you fight.
'use strict';
defineEnemy({
  id: 'slime',
  hp: 1, spd: 1.4, dmg: 1, r: 0.32, sc: 0.75,
  spawns: { biomes: ['plains', 'lake'], dungeons: [1, 2] },
  ai: AI.hop,
  anim: { fps: 6, frames: (s, kit) => [s, kit.squash(s, 0.8), s, kit.squash(s, 1.15)] },
  // bounce up while mid-hop
  view: (e) => e.hop > 0 ? 0.15 * Math.sin((0.4 - e.hop) / 0.4 * Math.PI) : 0,
  sprite: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '......kkkk......',
    '....kkllllkk....',
    '...klllwllllk...',
    '..kllwwlllllek..',
    '..klkwklkwklek..',
    '.klllllllllleek.',
    '.kleelllllleeek.',
    '.keeeeeeeeeeeek.',
    '..kkkkkkkkkkkk..',
    '................',
  ],
});
