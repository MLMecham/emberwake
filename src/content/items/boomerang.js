// ===== content/items/boomerang.js : thrown, comes back. Stuns enemies and grabs loot. =====
// Martial artist version: ORBIT DISC, which cuts through enemies instead of stunning.
'use strict';
defineItem({
  id: 'boomerang', name: 'BOOMERANG', sprite: 'boomerang', monk: { name: 'ORBIT DISC', sprite: 'disc' }, slot: 'b', order: 1, team: true, debug: true,
  owned: (p) => !!p.items.boomerang,
  give(sim, p, ctx) { p.items.boomerang = true; ctx.banner(); },
  use(sim, p) {
    if (sim.ents.some(e => e.k === 'boomer' && e.pid === p.id)) return; // one at a time
    const disc = p.cls === 'monk';
    sim.spawn({ k: 'boomer', lvl: p.lvl, x: p.x, y: p.y, a: p.a, pid: p.id, out: true, t: 0, spr: disc ? 'disc' : 'boomerang', sc: 0.6, z: 0.15, disc, hitSet: {} });
    sim.sfx('boomer', p.lvl);
  },
});
defineEntity('boomer', {
  update(sim, e, dt) {
    const p = sim.players[e.pid]; if (!p || p.lvl !== e.lvl) { e.dead = true; return; }
    const L = sim.W.levels[e.lvl]; const spd = e.disc ? 10 : 8;
    if (e.out) {
      const nx = e.x + Math.cos(e.a) * spd * dt, ny = e.y + Math.sin(e.a) * spd * dt;
      if (e.t > (e.disc ? 0.65 : 0.5) || L.solidAt(nx, ny) && !TINFO[L.get(Math.floor(nx), Math.floor(ny))].low) e.out = false; else { e.x = nx; e.y = ny; }
    } else {
      const a = Math.atan2(p.y - e.y, p.x - e.x); e.x += Math.cos(a) * spd * dt; e.y += Math.sin(a) * spd * dt;
      if (dist2(p.x, p.y, e.x, e.y) < 0.3) e.dead = true;
    }
    for (const en of sim.ents) {
      if (en.lvl !== e.lvl || en.dead) continue;
      if (en.k === 'en' && !e.hitSet[en.id] && dist2(en.x, en.y, e.x, e.y) < (sim.enemyRadius(en) + 0.25) ** 2) {
        e.hitSet[en.id] = 1;
        if (e.disc) sim.damageEnemy(en, 2, e, { pid: e.pid, ignoreIframes: true }); else sim.damageEnemy(en, 1, e, { pid: e.pid, stunOnly: true });
        if (!e.disc) e.out = false;
      }
      if (en.k === 'pick' && !en.perm && dist2(en.x, en.y, e.x, e.y) < 0.4) { en.x = e.x; en.y = e.y; } // drag loot back
    }
  },
});
