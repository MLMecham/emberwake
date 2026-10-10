// ===== content/enemies/wyrm.js =====
// Boss of levels 1, 4 and 7. Sways side to side breathing fans of fire.
'use strict';
defineEnemy({
  id: 'wyrm',
  hp: 10, spd: 1.2, dmg: 2, r: 0.7, sc: 1.8, boss: true,
  bossOf: [1, 4, 7],
  ai: (sim, e, dt, { p, spd, def }) => {
    if (e.tm <= 0) {
      e.tm = e.hp < e.maxHp / 2 ? 1.3 : 2; // angrier when hurt
      if (p) { AI.fan(sim, e, 'fire', Math.atan2(p.y - e.y, p.x - e.x), 3, 0.7, { dmg: 2 }); sim.sfx('roar', e.lvl, e.x, e.y); }
    }
    if (sim.moveEnt(e, Math.cos(e.st ? 0 : Math.PI) * spd * dt, Math.sin(e.t * 1.3) * spd * 0.6 * dt, def)) e.st = e.st ? 0 : 1;
  },
  anim: { fps: 3, frames: (s, kit) => [s, kit.bob(s, 1), kit.step(s, 12, -1, 0)] },
  sprite: [
    '....k......k....',
    '...kRk....kRk...',
    '...kRRkkkkRRk...',
    '..kRrrrrrrrrRk..',
    '..krrwkrrkwrrk..',
    '..krrkkrrkkrrk..',
    '.kRrrrrrrrrrrRk.',
    '.krrryrrrryrrrk.',
    '.krrkkkkkkkkrrk.',
    '.krkwkwkwkwkkrk.',
    '..krkoooooookk..',
    '..kRkkkkkkkkRk..',
    '.kRRrrRrrRrrRRk.',
    'kRRrrrRrrRrrrRRk',
    'kRRk..kRRk..kRRk',
    'kk.....kk.....kk',
  ],
});
