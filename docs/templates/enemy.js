// ===== content/enemies/NAME.js =====
// Copy this file to src/content/enemies/, rename it, change the id, then run:  node tools/check.js
// One sentence describing what the enemy does goes here.
'use strict';
defineEnemy({
  id: 'mudcrab',                 // unique id, also the sprite id
  hp: 2,                         // hit points (scaled up in later dungeons / farther regions)
  spd: 1.4,                      // tiles per second
  dmg: 1,                        // contact damage in half-hearts
  r: 0.32,                       // hit radius in tiles (0.3 is person-sized)
  sc: 0.8,                       // draw scale (1 = a full tile tall)
  spawns: { biomes: ['lake', 'plains'], dungeons: [2, 3] },   // where it shows up
  // Pick a behavior from content/ai.js (AI.hop, AI.chase, AI.flutter, AI.shooter('rock'),
  // AI.blinkCaster('magic', 2), AI.lunge(0.5, 0.6, 1.2)) or write your own:
  ai: (sim, e, dt, { p, spd, def }) => {
    // e.tm counts down by itself; e.st is free state; e.f is the facing angle
    if (e.tm <= 0) { e.tm = 1; e.f = p ? Math.atan2(p.y - e.y, p.x - e.x) : Math.random() * TAU; }
    sim.moveEnt(e, Math.cos(e.f) * spd * dt, Math.sin(e.f) * spd * dt, def);
  },
  // Optional animation. kit has: squash(s, f), step(s, row, dLeft, dRight), shearRows(s, y0, y1, dx),
  // shiftCols(s, x0, x1, dy), bob(s, dy), mirror(s), fromRows(rows) for a hand-drawn frame.
  anim: { fps: 6, frames: (s, kit) => [s, kit.squash(s, 0.85), s, kit.squash(s, 1.1)] },
  // Optional extras:
  // fly: true, z: 0.3          floats above the ground
  // phase: true                walks through walls
  // shield: true               blocks hits from the front
  // boomerangKills: true       a boomerang kills it instead of stunning
  // drops: 'common'            drop table from content/drops.js
  // onDamage(sim, e, dmg, opt) { return false; }   return false to ignore a hit
  // onDeath(sim, e) { ... }                         extra effects when it dies
  // 16 rows of 16 characters. '.' is see-through; letters are palette colors (see docs/ADDING_CONTENT.md).
  // Add pal: { Q: '#ff00ff' } to invent your own letters for this sprite.
  sprite: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....kkkkkk.....',
    '...kkrrrrrrkk...',
    '..krrwkrrwkrrk..',
    '..krrkkrrkkrrk..',
    '.krrrrrrrrrrrrk.',
    '.kRrrrrrrrrrrRk.',
    '.kRRrrrrrrrrRRk.',
    '..kRRRRRRRRRRk..',
    '.kk.kk....kk.kk.',
    '................',
    '................',
  ],
});
