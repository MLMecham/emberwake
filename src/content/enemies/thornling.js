// ===== content/enemies/thornling.js : the thorn-folk =====
// Thornlings are only the commonest of the thorn-folk. Their kin:
//   THORNLING   spear thrower (the one everyone knows)
//   BRIARBACK   big, thorny, slow; throws TWO spears side by side (a hand's width apart: sidestep, don't duck)
//   THORNSEER   keeps its distance, then lobs a SEED that homes in on you (projectiles.js 'seed'); block it or lose it on a wall
//   NETTLING    small and quick, comes in close and jabs in short lunges
// They don't like people. (content/grottos.js has what the old folk say about why.)
'use strict';
const thornAnim = { fps: 6, frames: (s, kit) => [s, kit.step(s, 13, -1, 0), s, kit.step(s, 13, 0, -1)] };
defineEnemy({
  id: 'thornling',
  hp: 2, spd: 1.6, dmg: 1, r: 0.32, sc: 0.85,
  spawns: { biomes: ['plains', 'forest', 'mountain', 'desert'], dungeons: [2, 4, 9] },
  ai: AI.shooter('spear'),
  anim: thornAnim,
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
defineEnemy({
  id: 'thornling_briar', title: 'BRIARBACK',
  hp: 4, spd: 1.1, dmg: 1, r: 0.38, sc: 1.0,
  spawns: { biomes: ['forest', 'mountain'], dungeons: [4, 9] },
  ai: AI.shooter('spear', { pair: 0.2 }),
  anim: thornAnim, pal: { p: '#8a3a5a', P: '#4a1830' },
  sprite: [
    '.u........u.....',
    'uuu......uuu....',
    '.n..kkkk..n.....',
    '.n.kppppk.n.....',
    '.nkpwkpwkpn.....',
    '.nkpppppkpn.....',
    '.nkpRRRpk.n.....',
    'kppNNNNNNkpp....',
    'PkpNnnnnNkn.....',
    '.PpNnnnnNkn.....',
    'P.pNNNNNN.n.....',
    '.P.NnnnnN.n.....',
    '...NNNNNN.n.....',
    '...ppk.ppk......',
    '..kppk.kppk.....',
    '................',
  ],
});
// THORNSEER: backs off if you get close, stops, holds its seed up (a short glow), then lets it go
function seerAi(sim, e, dt, { p, spd, def }) {
  if (e.st === 1) { if (e.tm <= 0) { if (p) sim.fireProj('seed', e.lvl, e.x, e.y, Math.atan2(p.y - e.y, p.x - e.x), 'e', null, { dmg: Content.projectiles.seed.dmg * e.dmgMul }); sim.sfx('magic', e.lvl, e.x, e.y); e.st = 0; e.tm = 2.2 + Math.random(); } return; }
  if (p) {
    const d2 = dist2(p.x, p.y, e.x, e.y); const away = Math.atan2(e.y - p.y, e.x - p.x);
    if (d2 < 12) { if (sim.moveEnt(e, Math.cos(away) * spd * dt, Math.sin(away) * spd * dt, def)) e.f = away + Math.PI / 2; } // too close: back away
    else if (e.tm <= 0 && d2 < 100) { e.st = 1; e.tm = 0.6; e.f = away + Math.PI; return; } // wind up
  }
  if (e.tm <= 0 && !p) { e.tm = 1.5; e.f = Math.random() * TAU; }
  if (!p || dist2(p.x, p.y, e.x, e.y) >= 12) { if (sim.moveEnt(e, Math.cos(e.f) * spd * 0.5 * dt, Math.sin(e.f) * spd * 0.5 * dt, def)) e.f += Math.PI / 2; }
}
defineEnemy({
  id: 'thornling_seer', title: 'THORNSEER',
  hp: 3, spd: 1.4, dmg: 1, r: 0.32, sc: 0.9,
  spawns: { biomes: ['forest', 'plains'], dungeons: [2, 9] },
  ai: seerAi, sprFor: (e) => e.st === 1 ? 'thornling_seer_cast' : null,
  anim: thornAnim,
  sprite: [
    '................',
    '.....kkkkk......',
    '....keeeeek.....',
    '...keekkkeek....',
    '...kepwkpwek....',
    '...kepppppek....',
    '....kpRRpk..l...',
    '...keeeeeek.lh..',
    '..keeEeeEeek.l..',
    '..keEeeeeEek....',
    '..keeeeeeeek....',
    '..kEeeeeeeEk....',
    '..keeeeeeeek....',
    '...kkpk.pkk.....',
    '....kpk.kpk.....',
    '................',
  ],
});
defineSpriteVariant('thornling_seer_cast', 'thornling_seer', { l: '#f8ff90', h: '#ffffff', e: '#58c858' }); // the seed glows before it flies
defineEnemy({
  id: 'thornling_nettle', title: 'NETTLING',
  hp: 2, spd: 5.2, dmg: 1, r: 0.26, sc: 0.62,
  spawns: { biomes: ['plains', 'desert'], dungeons: [2] },
  ai: AI.lunge(0.32, 0.7, 1.4),
  anim: thornAnim, pal: { p: '#d0a828', R: '#702010', N: '#3a5a20', n: '#6a8a30' },
  sprite: enemyDef('thornling').sprite,
});
defineSprite('seedwisp', [
  '................', '................', '................', '................', '................',
  '.......kk.......', '......klhk......', '.....klhhlk.....', '.....kllllk.....', '......klek......', '.......kk.......',
  '................', '................', '................', '................', '................']);
defineHints(['THE THORN-FOLK ARE MORE THAN THORNLINGS. THE BIG ONES THROW TWO SPEARS AT ONCE: SIDESTEP, DON\'T STAND STILL.', 'A THORNSEER\'S SEED FOLLOWS YOU. RAISE YOUR SHIELD, OR LEAD IT INTO A WALL.']);
