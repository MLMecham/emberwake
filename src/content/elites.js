// ===== content/elites.js : rare enemy variants =====
// Any normal (non-boss) enemy can roll one. weight = how common it is relative to the others.
// Elites drop loot only, never permanent upgrades. Order matters: an elite's network id is its position.
'use strict';
defineElite({
  id: 'blazing', name: 'BLAZING', color: [255, 110, 30], weight: 3,
  apply(e) { e.hp = e.maxHp = Math.ceil(e.hp * 1.5); e.fireT = 1; },
  update(sim, e, dt) { e.fireT -= dt; if (e.fireT <= 0) { e.fireT = 0.9; sim.spawn({ k: 'efire', lvl: e.lvl, x: e.x, y: e.y, life: 2.2, spr: 'flame', sc: 0.6, z: -0.05 }); } },
  onDeath(sim, e, drop) { AI.ring(sim, e, 'fire', 8, 0, { dmg: 1, life: 0.6 }); sim.sfx('boom', e.lvl, e.x, e.y); drop.gems(2); drop('bomb', 0, 0.4); },
});
defineElite({
  id: 'swift', name: 'SWIFT', color: [90, 220, 255], weight: 3,
  apply(e) { e.spdMul = 2; },
  onDeath(sim, e, drop) { drop('fairy'); drop.gems(1); },
});
defineElite({
  id: 'giant', name: 'GIANT', color: [200, 80, 255], weight: 3,
  apply(e) { e.hp = e.maxHp = e.hp * 3; e.scMul = 1.5; e.rm = 1.35; e.dmgMul += 1; },
  onDeath(sim, e, drop) { drop.gems(3); drop('heart', 0, 0.6); },
});
defineElite({
  id: 'splitter', name: 'SPLITTER', color: [120, 255, 120], weight: 3,
  apply(e) { e.hp = e.maxHp = e.hp + 1; },
  onDeath(sim, e, drop) {
    for (const s of [-1, 1]) sim.spawnEnemy(e.type, e.lvl, e.x + s * 0.3, e.y, { group: e.g, bounds: e.b, hp: 1, dmgMul: e.dmgMul, scMul: 0.65, rm: 0.7, spdMul: 1.4, spawnFx: 0.15 });
    drop.gems(1);
  },
});
defineElite({
  id: 'golden', name: 'GOLDEN', color: [255, 215, 60], weight: 1, noContact: true, tint: 0.55,
  apply(e) { e.hp = e.maxHp = Math.max(3, e.hp * 2); e.spdMul = 1.3; e.life = 14; },
  // runs from the nearest hero and vanishes if not caught in time
  update(sim, e, dt, { p, spd, def }) {
    e.life -= dt; if (e.life <= 0) { e.dead = true; sim.puff(e, 0.9); sim.sfx('stairs', e.lvl, e.x, e.y); return true; }
    if (p && dist2(p.x, p.y, e.x, e.y) < 49) { const fa = Math.atan2(e.y - p.y, e.x - p.x) + Math.sin(e.t * 3) * 0.6; const v = Math.max(2.4, spd); if (sim.moveEnt(e, Math.cos(fa) * v * dt, Math.sin(fa) * v * dt, def)) e.f = Math.random() * TAU; }
    else if (sim.moveEnt(e, Math.cos(e.f) * 1.5 * dt, Math.sin(e.f) * 1.5 * dt, def) || e.tm <= 0) { e.tm = 1; e.f = Math.random() * TAU; }
    return true;
  },
  onDeath(sim, e, drop) { drop('gems50'); sim.sfx('secret', e.lvl, e.x, e.y); },
});
