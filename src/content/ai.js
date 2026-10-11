// ===== content/ai.js : reusable enemy behaviors =====
// An enemy's ai is a function (sim, e, dt, ctx). ctx = { p: nearest living hero or null, spd, def }.
// e.tm counts down every tick (a general-purpose timer); e.st is a free state number; e.f is facing (radians).
// Most enemies just pick one of these. Behaviors that need settings are factories: AI.shooter('rock').
'use strict';
const AI = {
  // hops toward heroes in short bursts
  hop(sim, e, dt, { p, spd, def }) {
    if (e.tm <= 0) { e.tm = 0.8 + Math.random() * 0.6; e.f = p && Math.random() < 0.7 ? Math.atan2(p.y - e.y, p.x - e.x) + (Math.random() - 0.5) : Math.random() * TAU; e.hop = 0.4; }
    if (e.hop > 0) { e.hop -= dt; sim.moveEnt(e, Math.cos(e.f) * spd * 2 * dt, Math.sin(e.f) * spd * 2 * dt, def); }
  },
  // walks in straight lines, stops and fires `proj` at nearby heroes
  shooter(proj) {
    return function (sim, e, dt, { p, spd, def }) {
      if (e.st === 0) {
        if (sim.moveEnt(e, Math.cos(e.f) * spd * dt, Math.sin(e.f) * spd * dt, def) || e.tm <= 0) {
          e.tm = 1 + Math.random() * 1.5; e.f = (Math.floor(Math.random() * 4)) * Math.PI / 2;
          if (p && dist2(p.x, p.y, e.x, e.y) < 64 && Math.random() < 0.55) { e.st = 1; e.tm = 0.5; e.f = Math.atan2(p.y - e.y, p.x - e.x); }
        }
      } else if (e.tm <= 0) { sim.fireProj(proj, e.lvl, e.x, e.y, e.f, 'e', null, { dmg: Content.projectiles[proj].dmg * e.dmgMul }); e.st = 0; e.tm = 0.6; sim.sfx('shoot', e.lvl, e.x, e.y); }
    };
  },
  // erratic flight, sometimes darting at heroes
  flutter(sim, e, dt, { p, spd, def }) {
    if (e.tm <= 0) { e.tm = 0.4 + Math.random() * 0.8; e.f = p && Math.random() < 0.5 ? Math.atan2(p.y - e.y, p.x - e.x) : e.f + (Math.random() - 0.5) * 2.5; }
    if (sim.moveEnt(e, Math.cos(e.f) * spd * dt, Math.sin(e.f) * spd * dt, def)) e.f += Math.PI * (0.5 + Math.random());
  },
  // turns toward heroes within 10 tiles and walks at them; sidesteps walls
  chase(sim, e, dt, { p, spd, def }) {
    if (p && dist2(p.x, p.y, e.x, e.y) < 100) { const ta = Math.atan2(p.y - e.y, p.x - e.x); e.f += clamp(angDiff(e.f, ta), -dt * 4, dt * 4); }
    else if (e.tm <= 0) { e.tm = 1.5; e.f = Math.random() * TAU; }
    if (sim.moveEnt(e, Math.cos(e.f) * spd * dt, Math.sin(e.f) * spd * dt, def) && !def.phase) e.f += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
  },
  // blinks next to a hero, then fires `proj` at them
  blinkCaster(proj, dmg) {
    return function (sim, e, dt, { p }) {
      if (e.tm > 0) return;
      if (e.st === 0 && p) {
        const L = sim.W.levels[e.lvl];
        for (let i = 0; i < 20; i++) { const a = Math.random() * TAU, r = 2.5 + Math.random() * 2; const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; if (AI.safeAt(L, x, y) && (!e.b || (x > e.b.x0 && x < e.b.x1 && y > e.b.y0 && y < e.b.y1))) { sim.puff(e, 0.8); e.x = x; e.y = y; break; } }
        e.st = 1; e.tm = 0.7;
      } else if (e.st === 1 && p) { sim.fireProj(proj, e.lvl, e.x, e.y, Math.atan2(p.y - e.y, p.x - e.x), 'e', null, { dmg: dmg * e.dmgMul }); sim.sfx('magic', e.lvl, e.x, e.y); e.st = 0; e.tm = 1.6 + Math.random(); }
      else e.tm = 1;
    };
  },
  // pauses, then lunges at a hero
  lunge(lungeTime, restMin, restMax) {
    return function (sim, e, dt, { p, spd, def }) {
      if (e.st === 0 && e.tm <= 0 && p) { e.st = 1; e.tm = lungeTime; e.cf = Math.atan2(p.y - e.y, p.x - e.x); }
      else if (e.st === 1) { sim.moveEnt(e, Math.cos(e.cf) * spd * dt, Math.sin(e.cf) * spd * dt, def); if (e.tm <= 0) { e.st = 0; e.tm = restMin + Math.random() * (restMax - restMin); } }
    };
  },
  // fire `count` projectiles in a fan of `spread` radians at angle a
  fan(sim, e, proj, a, count, spread, extra) { for (let i = 0; i < count; i++) sim.fireProj(proj, e.lvl, e.x, e.y, a + (count > 1 ? (i / (count - 1) - 0.5) * spread : 0), 'e', null, extra); },
  // fire `count` projectiles in a full ring
  ring(sim, e, proj, count, offset, extra) { for (let i = 0; i < count; i++) sim.fireProj(proj, e.lvl, e.x, e.y, i * TAU / count + (offset || 0), 'e', null, extra); },
  // teleport to a random open spot in the room, away from heroes
  // somewhere a teleporting enemy can land: not a wall, and not lava, spikes or a pit (those would hurt or swallow it)
  safeAt(L, x, y) { if (L.solidAt(x, y)) return false; const ti = TINFO[L.get(Math.floor(x), Math.floor(y))]; return !ti.hurt && !ti.pit; },
  teleportInRoom(sim, e, p, minD2) {
    const L = sim.W.levels[e.lvl];
    for (let i = 0; i < 30; i++) { const x = e.b.x0 + 1 + Math.random() * (e.b.x1 - e.b.x0 - 2), y = e.b.y0 + 1 + Math.random() * (e.b.y1 - e.b.y0 - 2); if (AI.safeAt(L, x, y) && (!p || dist2(x, y, p.x, p.y) > minD2)) { sim.puff(e, 1.2); e.x = x; e.y = y; return true; } }
    return false;
  },
};
