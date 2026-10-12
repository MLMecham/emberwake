// ===== content/enemies/frog.js : frogs, the poison frog, and the Bog King (boss of the Sunken Stair) =====
// Frogs swim (def.swim): water is open to them, and they never drown. In the water they hide under the surface
// (e.sub: nothing can hit them), swim to another spot in the same body of water, then hop up and spit a bubble.
// On land they're weak hoppers, like a slime, that head back to the water when it's close.
'use strict';
const FROG_ROWS = [
  '................',
  '................',
  '................',
  '................',
  '...kkk....kkk...',
  '..kwwwk..kwwwk..',
  '..kwkwkkkkwkwk..',
  '.kleelllllleelk.',
  'kllllllllllllllk',
  'klkkkkkkkkkkkklk',
  'kllllzzzzzzllllk',
  '.kllzzzzzzzzllk.',
  'kllkllzzzzllkllk',
  'kekkkkekkekkkkek',
  '................',
  '................',
];
const waterAt = (L, x, y) => { const ti = TINFO[L.get(Math.floor(x), Math.floor(y))]; return !!(ti.water && !ti.ocean); };
// the water tiles joined to (x, y), up to `max` of them (centers), optionally kept inside bounds b
function pondFrom(L, x, y, max, b) {
  const out = [], seen = new Set(), st = [[Math.floor(x), Math.floor(y)]];
  while (st.length && out.length < max) {
    const [tx, ty] = st.shift(); const k = ty * L.w + tx; if (seen.has(k)) continue; seen.add(k);
    if (!waterAt(L, tx + 0.5, ty + 0.5)) continue; if (b && (tx < b.x0 || ty < b.y0 || tx >= b.x1 || ty >= b.y1)) continue;
    out.push([tx + 0.5, ty + 0.5]); st.push([tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]);
  }
  return out;
}
function nearWater(L, x, y, r) { for (let d = 1; d <= r; d++) for (let a = 0; a < 8; a++) { const ax = x + Math.cos(a * Math.PI / 4) * d, ay = y + Math.sin(a * Math.PI / 4) * d; if (waterAt(L, ax, ay)) return [ax, ay]; } return null; }
// pick a spot in the pond a few tiles from the hero (so the frog pops up within spitting range)
function pickSpot(L, e, p, near, far) {
  const pond = pondFrom(L, e.x, e.y, 160, e.b);
  const good = p ? pond.filter(([x, y]) => { const d = Math.hypot(x - p.x, y - p.y); return d >= near && d <= far; }) : [];
  const list = good.length ? good : pond; return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}
const spit = (sim, e, p, proj, spread) => {
  if (!p) return; const a = Math.atan2(p.y - e.y, p.x - e.x); const d = Content.projectiles[proj].dmg * (enemyDef(e.type).boss ? 1 : e.dmgMul);
  for (const s of spread || [0]) sim.fireProj(proj, e.lvl, e.x, e.y, a + s, 'e', null, { dmg: d });
  sim.sfx('bubble', e.lvl, e.x, e.y);
};
// in the water: hide, swim, surface, spit, dive. Returns true while it handled the frog (it's in water).
function swimCycle(sim, e, dt, p, spd, opt) {
  const L = sim.W.levels[e.lvl]; if (!waterAt(L, e.x, e.y)) return false;
  if (e.st === 0) { // under: swim to a new spot in the same water
    e.sub = true;
    if (!e.tgt) { e.tgt = pickSpot(L, e, p, opt.near, opt.far); e.tm = 1.2 + Math.random() * 1.2; }
    if (e.tgt) { const dx = e.tgt[0] - e.x, dy = e.tgt[1] - e.y, d = Math.hypot(dx, dy); if (d > 0.15) { const s = Math.min(d, spd * 1.6 * dt); const nx = e.x + dx / d * s, ny = e.y + dy / d * s; if (waterAt(L, nx, ny)) { e.x = nx; e.y = ny; } else e.tgt = null; } }
    if (e.tm <= 0) { if (p && dist2(p.x, p.y, e.x, e.y) < opt.range * opt.range) { e.st = 1; e.tm = opt.rise; e.sub = false; sim.sfx('splash', e.lvl, e.x, e.y); } else e.tgt = null; }
  } else if (e.st === 1) { if (e.tm <= 0) { spit(sim, e, p, opt.proj, opt.spread); e.st = 2; e.tm = opt.up; } } // hopping up out of the water
  else if (e.st === 2) { if (e.tm <= 0) { e.st = 0; e.tgt = null; e.sub = true; sim.sfx('splash', e.lvl, e.x, e.y); } } // a moment in the open, then back under
  return true;
}
// on land: hop like a slime (half the time toward the hero), and back into the water when it's close
function landHop(sim, e, dt, p, spd, def) {
  e.sub = false; if (e.st !== 0) e.st = 0;
  const L = sim.W.levels[e.lvl];
  if (e.tm <= 0) { e.tm = 0.9 + Math.random() * 0.6; let a = p && Math.random() < 0.6 ? Math.atan2(p.y - e.y, p.x - e.x) + (Math.random() - 0.5) : Math.random() * TAU; const w = nearWater(L, e.x, e.y, 2); if (w && Math.random() < 0.45) a = Math.atan2(w[1] - e.y, w[0] - e.x); e.f = a; e.hop = 0.4; }
  if (e.hop > 0) { e.hop -= dt; sim.moveEnt(e, Math.cos(e.f) * spd * 2 * dt, Math.sin(e.f) * spd * 2 * dt, def); }
}
const frogAi = (proj) => function (sim, e, dt, { p, spd, def }) {
  if (!swimCycle(sim, e, dt, p, spd, { proj, near: 1.8, far: 5, range: 9, rise: 0.45, up: 0.7 })) landHop(sim, e, dt, p, spd, def);
};
const frogView = (e) => e.sub ? -0.12 : e.st === 1 ? 0.3 * Math.sin((1 - Math.max(0, e.tm) / 0.45) * Math.PI) : e.hop > 0 ? 0.15 * Math.sin((0.4 - e.hop) / 0.4 * Math.PI) : 0;
defineEnemy({
  id: 'frog', hp: 1, spd: 1.4, dmg: 1, r: 0.32, sc: 0.75, swim: true,
  spawns: { biomes: ['lake'], dungeons: [3] },
  ai: frogAi('bubble'), view: frogView, sprFor: (e) => e.sub ? 'frog_sub' : null,
  anim: { fps: 5, frames: (s, kit) => [s, kit.squash(s, 1.1)] },
  sprite: FROG_ROWS,
});
// POISON FROG: its bubble poisons (projectiles.js 'poisonbubble'), even through a shield. Never comes as a giant.
defineEnemy(Object.assign({}, enemyDef('frog'), {
  id: 'frog_poison', ai: frogAi('poisonbubble'), sprFor: (e) => e.sub ? 'frog_poison_sub' : null, noElites: ['giant'],
  pal: { l: '#b048e0', e: '#5a1a80', z: '#f8d840' }, spawns: {}, // never placed directly: 1 in 10 frogs is born poisonous (game/sim.js)
}));
// THE BOG KING. Phase 1: hides in the water, surfaces near you and spits a fan of bubbles; three hits drive him out.
// Phase 2 (or straight away if the room is drained): leaps from platform to platform (anywhere, once the water's gone),
// landing with a ring of bubbles, and sits still for a moment after each landing.
const LEAP_TIME = 0.9;
function roomHasWater(sim, e) { const L = sim.W.levels[e.lvl]; if (e.waterAt != null && sim.time - e.waterAt < 0.5) return e.hasWater; e.waterAt = sim.time; const b = e.b; let w = false; for (let y = b.y0; y < b.y1 && !w; y++) for (let x = b.x0; x < b.x1; x++) if (waterAt(L, x + 0.5, y + 0.5)) { w = true; break; } return (e.hasWater = w); }
function leapTarget(sim, e, p) {
  const L = sim.W.levels[e.lvl]; const b = e.b; const wet = roomHasWater(sim, e); const spots = [];
  for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) { const cx = x + 0.5, cy = y + 0.5; if (L.solidAt(cx, cy) || (wet && waterAt(L, cx, cy)) || TINFO[L.get(x, y)].hurt) continue; if (dist2(cx, cy, e.x, e.y) < 2.5) continue; spots.push([cx, cy]); }
  if (!spots.length) return null;
  const near = p ? spots.filter(([x, y]) => dist2(x, y, p.x, p.y) < 9) : [];
  const list = near.length && Math.random() < 0.6 ? near : spots; return list[Math.floor(Math.random() * list.length)];
}
defineEnemy(Object.assign({}, enemyDef('frog'), {
  id: 'bogking', title: 'THE BOG KING', boss: true, bossOf: [3], hp: 9, spd: 1.8, dmg: 2, r: 0.75, sc: 1.9,
  spawns: {}, spawnAt: [6.5, 4.5], pal: { l: '#5f8f3a', e: '#2c4a1c', z: '#d8c890' }, sprFor: (e) => e.sub ? 'bogking_sub' : null,
  onDamage(sim, e) { if (e.ph === 0 && ++e.hits >= 3) driveOut(sim, e); },
  view: (e) => e.air ? 1.4 * Math.sin(Math.min(1, e.airT / LEAP_TIME) * Math.PI) : frogView(e),
  ai(sim, e, dt, { p, spd, def }) {
    if (e.ph == null) { e.ph = 0; e.hits = 0; }
    if (e.ph === 0) {
      if (!roomHasWater(sim, e)) return driveOut(sim, e); // nowhere to hide
      if (!swimCycle(sim, e, dt, p, spd, { proj: 'bubble', spread: [-0.35, 0, 0.35], near: 0.8, far: 2.2, range: 12, rise: 0.5, up: 1.4 } /* pops up right beside your platform, within sword reach */)) { e.st = 0; e.tgt = pickSpot(sim.W.levels[e.lvl], e, p, 1, 99); if (e.tgt) { e.x = e.tgt[0]; e.y = e.tgt[1]; } } // stranded on land: slip back in
      return;
    }
    if (e.air) { // mid-leap: fly in a straight line to the landing spot
      e.airT += dt; const k = Math.min(1, e.airT / LEAP_TIME); e.x = lerp(e.lx, e.tx, k); e.y = lerp(e.ly, e.ty, k);
      if (k >= 1) { e.air = false; e.tm = 1.3; sim.sfx('boom', e.lvl, e.x, e.y); for (let i = 0; i < 8; i++) sim.fireProj('bubble', e.lvl, e.x, e.y, i * Math.PI / 4 + 0.2, 'e', null, { dmg: 1 }); }
      return;
    }
    e.sub = false;
    if (e.tm <= 0.6 && !e.spat) { e.spat = true; spit(sim, e, p, 'bubble', [-0.2, 0.2]); }
    if (e.tm <= 0) { const t = leapTarget(sim, e, p); if (t) { e.air = true; e.airT = 0; e.lx = e.x; e.ly = e.y; e.tx = t[0]; e.ty = t[1]; e.spat = false; sim.sfx('croak', e.lvl, e.x, e.y); } else e.tm = 0.8; }
  },
}));
function driveOut(sim, e) {
  e.ph = 1; e.sub = false; e.st = 0; e.tm = 0.4; sim.sfx('croak', e.lvl, e.x, e.y); sim.msg('THE BOG KING CLIMBS OUT OF THE WATER!');
  for (let i = 0; i < 2; i++) sim.spawnMinion(e, 'frog');
}
