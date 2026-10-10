// ===== content/enemies/orb.js =====
// Boss of levels 2, 5 and 8. Circles, then charges. Releases bats at half health.
'use strict';
defineEnemy({
  id: 'orb',
  hp: 8, spd: 2.2, dmg: 2, r: 0.6, sc: 1.5, boss: true, fly: true, z: 0.3,
  bossOf: [2, 5, 8],
  ai: (sim, e, dt, { p, spd, def }) => {
    if (e.st === 0) { e.f += dt * 1.2; sim.moveEnt(e, Math.cos(e.f) * spd * dt, Math.sin(e.f * 0.7) * spd * dt, def); if (e.tm <= 0 && p) { e.st = 1; e.tm = 0.9; e.cf = Math.atan2(p.y - e.y, p.x - e.x); sim.sfx('roar', e.lvl, e.x, e.y); } }
    else if (sim.moveEnt(e, Math.cos(e.cf) * spd * 3 * dt, Math.sin(e.cf) * spd * 3 * dt, def) || e.tm <= 0) { e.st = 0; e.tm = 2.5; }
    if (!e.split && e.hp < e.maxHp / 2) { e.split = true; for (let i = 0; i < 3; i++) sim.spawnMinion(e, 'bat'); }
  },
  anim: { fps: 5, frames: (s, kit) => [s, kit.squash(s, 0.92), s, kit.squash(s, 1.06)] },
  sprite: [
    '.....kkkkkk.....',
    '...kkppppppkk...',
    '..kppPPPPPPppk..',
    '.kpPPkkkkkkPPpk.',
    '.kpPkwwwwwwkPpk.',
    'kpPkwwwccwwwkPpk',
    'kpPkwwcBBcwwkPpk',
    'kpPkwwcBBcwwkPpk',
    'kpPkwwwccwwwkPpk',
    '.kpPkwwwwwwkPpk.',
    '.kpPPkkkkkkPPpk.',
    '..kppPPPPPPppk..',
    '...kkppppppkk...',
    '..k..kkkkkk..k..',
    '.k...k....k...k.',
    '................',
  ],
});
