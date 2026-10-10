// ===== content/enemies/magmite.js =====
// Slow, heavy lumps of cooling rock that plod toward you and burst into flame when they die.
'use strict';
defineEnemy({
  id: 'magmite', hp: 7, spd: 1.0, dmg: 2, r: 0.42, sc: 1.05, hot: true,
  spawns: { biomes: ['ash'], dungeons: [11, 12] },
  ai: AI.chase,
  onDeath(sim, e) { sim.sfx('fire', e.lvl, e.x, e.y); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; sim.spawn({ k: 'efire', lvl: e.lvl, x: e.x + Math.cos(a) * 0.7, y: e.y + Math.sin(a) * 0.7, life: 1.6, spr: 'flame', sc: 0.8, z: -0.05 }); } },
  anim: { fps: 3, frames: (s, kit) => [s, kit.squash(s, 0.92), kit.bob(s, 1)] },
  sprite: [
    '................',
    '................',
    '.....kkkkkk.....',
    '...kkGGGGGGkk...',
    '..kGGxGGGGxGGk..',
    '.kGGGGGGGGGGGGk.',
    '.kGxGGykkyGGxGk.',
    '.kGGGGkkkkGGGGk.',
    'kGGGxGGGGGGxGGGk',
    'kGGGGGGGGGGGGGGk',
    'kGxGGGGxGGGGxGGk',
    '.kGGGGGGGGGGGGk.',
    '.kGGkkGGGGkkGGk.',
    '..kk..kkkk..kk..',
    '................',
    '................',
  ],
});
