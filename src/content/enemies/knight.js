// ===== content/enemies/knight.js =====
// Armored chaser. Its shield blocks hits from the front, so strike from the side or use bombs.
'use strict';
defineEnemy({
  id: 'knight',
  hp: 4, spd: 1.5, dmg: 2, r: 0.34, sc: 0.9,
  spawns: { biomes: ['mountain'], dungeons: [5, 6, 7, 8, 9] },
  ai: AI.chase,
  anim: { fps: 4, frames: (s, kit) => [s, kit.step(s, 12, -1, 0), s, kit.step(s, 12, 0, -1)] },
  shield: true,
  sprite: [
    '................',
    '.....kkkkkk.....',
    '....kuuuuuuk....',
    '....kukkkkuk....',
    '....kuurruuk....',
    '.....kuuuuk.....',
    '..kkkUuuuuUk....',
    '.kBBkUuuuuUuk...',
    '.kBybkUuuUkuk...',
    '.kByykUUUUkuk...',
    '.kBybkUuuUk.k...',
    '.kBBk.UuuU......',
    '..kk..UU.UU.....',
    '......UU.UU.....',
    '.....kUk.kUk....',
    '................',
  ],
});
