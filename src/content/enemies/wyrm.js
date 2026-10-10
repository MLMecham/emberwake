// ===== content/enemies/wyrm.js =====
// The wyrmlings: bosses of levels 1, 4 and 7, children of the great dragons (see dragons.js).
// Level 1's hatched from a frost egg, level 4's from the Patriarch's magma, level 7's was born of the Hollow head.
// They sway side to side breathing fans of their element.
'use strict';
const wyrmAi = (proj) => (sim, e, dt, { p, spd, def }) => {
  if (e.tm <= 0) {
    e.tm = e.hp < e.maxHp / 2 ? 1.3 : 2; // angrier when hurt
    if (p) { AI.fan(sim, e, proj, Math.atan2(p.y - e.y, p.x - e.x), 3, 0.7, { dmg: 2 }); sim.sfx('roar', e.lvl, e.x, e.y); }
  }
  if (sim.moveEnt(e, Math.cos(e.st ? 0 : Math.PI) * spd * dt, Math.sin(e.t * 1.3) * spd * 0.6 * dt, def)) e.st = e.st ? 0 : 1;
};
defineEnemy({
  id: 'wyrm', title: 'MAGMA WYRMLING',
  hp: 10, spd: 1.2, dmg: 2, r: 0.7, sc: 1.8, boss: true, hot: true,
  bossOf: [4],
  ai: wyrmAi('fire'),
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
// the frost hatchling (level 1) and the hollow hatchling (level 7): same body, their parents' colors and breath
for (const [id, bossOf, proj, pal] of [['wyrm_frost', [1], 'icebolt', { r: '#86ccf0', R: '#2c62a0', o: '#e8f8ff', y: '#40ffff' }], ['wyrm_hollow', [7], 'magic', { r: '#7a44b0', R: '#2e1450', o: '#d0a0ff', y: '#ff60ff' }]]) {
  defineEnemy(Object.assign({}, enemyDef('wyrm'), { id, bossOf, title: id === 'wyrm_frost' ? 'FROST WYRMLING' : 'HOLLOW WYRMLING', hot: false, pal, ai: wyrmAi(proj), anim: { fps: 3, frames: (s, kit) => [s, kit.bob(s, 1), kit.step(s, 12, -1, 0)] } }));
}
