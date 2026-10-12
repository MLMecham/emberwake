// ===== content/entities.js : small world objects with their own behavior =====
// Each kind's update(sim, e, dt) runs every tick while a hero is on that level. e.t is the entity's age.
'use strict';
defineEntity('fx', { update(sim, e) { if (e.t > e.life) e.dead = true; } });           // one-shot effect sprite
defineEntity('pick', {                                                                    // item lying on the ground
  update(sim, e, dt) {
    if (!e.perm && e.t > 12) e.dead = true;
    if (e.float) { e.x += Math.cos(e.t * 2.3) * dt * 0.8; e.y += Math.sin(e.t * 1.7) * dt * 0.8; }
  },
});
defineEntity('fire', { update(sim, e) { if (e.t > e.life) e.dead = true; else sim.fireHits(e); } }); // hero fire: hurts enemies, burns bushes
defineEntity('efire', {                                                                    // enemy fire: hurts heroes
  update(sim, e) {
    if (e.t > e.life) { e.dead = true; return; }
    for (const pl of Object.values(sim.players)) if (pl.alive && pl.lvl === e.lvl && dist2(pl.x, pl.y, e.x, e.y) < 0.3) sim.hurtPlayer(pl, 1, e);
  },
});
// something knocked out of a foe's hands (game/sim.js disarmEnemy): it flies, bounces once, then lies there a while
defineEntity('tossed', { update(sim, e, dt) {
  if (e.t > e.life) { e.dead = true; return; }
  const k = Math.min(1, e.t / 0.6); const L = sim.W.levels[e.lvl];
  if (k < 1) { const nx = e.x + e.vx * dt * (1 - k), ny = e.y + e.vy * dt * (1 - k); if (!L.solidAt(nx, ny)) { e.x = nx; e.y = ny; } e.z = 0.05 + Math.abs(Math.sin(k * Math.PI * 1.5)) * 0.5 * (1 - k * 0.6); }
  else e.z = 0.05;
} });
