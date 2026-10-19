// ===== content/enemies/bat.js =====
// Fast, erratic flier. A boomerang knocks it out of the air.
'use strict';
defineEnemy({
  id: 'bat',
  hp: 1, spd: 2.6, dmg: 1, r: 0.28, sc: 0.6, fly: true, z: 0.35,
  spawns: { biomes: ['forest', 'lake', 'graveyard'], dungeons: [1, 2, 3, 5, 8] },
  ai: AI.flutter,
  anim: { fps: 10, frames: (s, kit) => [s, kit.shiftCols(kit.shiftCols(s, 0, 4, -3), 11, 15, -3), kit.shiftCols(kit.shiftCols(s, 0, 4, 2), 11, 15, 2)] },
  boomerangKills: true,
  sprite: [
    '................',
    '................',
    '................',
    '................',
    'k..............k',
    'kk....k..k....kk',
    'kPk...kkkk...kPk',
    'kPPk.kprrpk.kPPk',
    'kPPPkkppppkkPPPk',
    '.kPPPPppppPPPPk.',
    '..kPPk.kk.kPPk..',
    '...kk..w..w.kk..',
    '................',
    '................',
    '................',
    '................',
  ],
});
// THE NIGHTWING (the Ascent's roost, content/south.js): the bats' mother. She hangs high in the dark of her roost and comes
// down in long dives (her eyes flare first: get out of the line), shrieks for more bats (six at most), and climbs back up.
// Arrows reach her up there; the boomerang drops her brood in one throw. When she dies the mountain goes quiet: the
// master up the stair will teach (team.taken['climb:roost']).
const NW = { diveEvery: 3.2, windup: 0.6, diveTime: 0.55, diveSpd: 9, shriekEvery: 6.5, brood: 6, hang: 1.6 };
defineEnemy({
  id: 'bat_queen', title: 'THE NIGHTWING', hp: 14, spd: 2.2, dmg: 2, r: 0.7, sc: 1.8, fly: true, boss: true, bossOf: [], spawnAt: [12.5, 3],
  view: (e) => e.hz != null ? e.hz : NW.hang,
  sprFor: (e) => (e.st === 1 ? 'bat_queen_glow' : null),
  ai(sim, e, dt, ctx) {
    const { p } = ctx; if (!p) return;
    e.diveAt = e.diveAt || sim.time + 2; e.shriekAt = e.shriekAt || sim.time + 4;
    if (e.st === 1) { e.hz = NW.hang; if (sim.time >= e.goAt) { e.st = 2; e.goAt = sim.time + NW.diveTime; e.f = Math.atan2(e.ty - e.y, e.tx - e.x); sim.sfx('whoosh', e.lvl, e.x, e.y); } return; } // eyes flare: she's picked her line
    if (e.st === 2) { e.hz = Math.max(0.2, (e.hz || NW.hang) - dt * 6); sim.moveEnt(e, Math.cos(e.f) * NW.diveSpd * dt, Math.sin(e.f) * NW.diveSpd * dt, ctx.def); if (sim.time >= e.goAt) { e.st = 3; e.goAt = sim.time + 0.8; } return; } // the dive: low and fast
    if (e.st === 3) { e.hz = Math.min(NW.hang, (e.hz || 0) + dt * 2.5); if (sim.time >= e.goAt) { e.st = 0; e.diveAt = sim.time + NW.diveEvery; } return; } // climbing back up
    e.hz = NW.hang; AI.flutter(sim, e, dt, ctx);
    if (sim.time >= e.shriekAt) { e.shriekAt = sim.time + NW.shriekEvery; sim.sfx('shriek', e.lvl, e.x, e.y); const n = sim.ents.filter(o => o.k === 'en' && !o.dead && o.type === 'bat' && o.lvl === e.lvl).length; for (let i = n; i < Math.min(NW.brood, n + 3); i++) sim.spawnMinion(e, 'bat'); }
    if (sim.time >= e.diveAt) { e.st = 1; e.goAt = sim.time + NW.windup; e.tx = p.x; e.ty = p.y; }
  },
  onDeath(sim, e) { sim.team.taken['climb:roost'] = true; for (const o of sim.ents) if (o.k === 'npc' && o.after === 'climb:roost') { o.text = o.textAfter; o.heard = { said: 'masterTaught' }; } sim.msg('THE ROOST FALLS SILENT.'); },
  anim: { fps: 8, frames: (s, kit) => [s, kit.shiftCols(kit.shiftCols(s, 0, 4, -3), 11, 15, -3), kit.shiftCols(kit.shiftCols(s, 0, 4, 2), 11, 15, 2)] },
  pal: { P: '#3a2440', p: '#7a4a6a' },
  sprite: [
    '................',
    '................',
    '...k........k...',
    'k..kk..kk..kk..k',
    'kk.kPk.kk.kPk.kk',
    'kPkkPPkkkkPPkkPk',
    'kPPkPPkprrpkPPkP',
    'kPPPkPkpppkPkPPP',
    'kPPPPkkppppkkPPk',
    '.kPPPPPppppPPPk.',
    '..kPPPk.kk.kPk..',
    '...kk..wwww.kk..',
    '..........w.....',
    '................',
    '................',
    '................',
  ],
});
defineSpriteVariant('bat_queen_glow', 'bat_queen', { r: '#ffff80', p: '#c080a0' });
