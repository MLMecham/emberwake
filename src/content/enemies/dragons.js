// ===== content/enemies/dragons.js : the great dragons, built from parts =====
// The Frost Matriarch (Rimefang Hollow, 10), the Fire Patriarch (Cinder Caldera, 11) and the three-headed
// Hearthwyrm (the Hearth, 12). Each head is the actual enemy: it's what you hit, and what bites you.
// A big body sits at the back of the boss room and a chain of neck segments ('neck' entities) runs from it to
// the head, so the long neck sways, reaches out to point at you, rears back, and snaps forward.
'use strict';
const HEAD_ROWS = [
  '..k..........k..',
  '.kvk........kvk.',
  '.kvAk......kAvk.',
  '..kAAkkkkkkAAk..',
  '..kAAAAAAAAAAk..',
  '.kAAEkAAAAkEAAk.',
  '.kAAkkAAAAkkAAk.',
  '.kBAAAAAAAAAABk.',
  '..kBAAAAAAAABk..',
  '..kBBwkwwkwBBk..',
  '...kkCCCCCCkk...',
  '...kwkCCCCkwk...',
  '....kBwkkwBk....',
  '.....kBBBBk.....',
  '......kkkk......',
  '................',
];
const PALS = { ice: { A: '#86ccf0', B: '#2c62a0', C: '#e8f8ff', E: '#40ffff' }, fire: { A: '#d83c20', B: '#741410', C: '#ffb444', E: '#ffff60' }, hollow: { A: '#5c2e8c', B: '#22103a', C: '#b478ff', E: '#ff50ff' } };
// body and neck segments: positioned by their head every tick; they vanish with it
defineEntity('neck', {
  update(sim, n) {
    if (n.role === 'seg') { if (!n.head || n.head.dead) n.dead = true; return; }
    if (!n.heads.some(h => !h.dead)) { n.dead = true; sim.spawn({ k: 'fx', lvl: n.lvl, x: n.x, y: n.y, spr: 'boom', life: 0.9, sc: 2.6 }); sim.sfx('bossdie', n.lvl, n.x, n.y); }
  },
});
function rig(sim, e, cfg) {
  const ax = e.x, ay = e.y - 0.4; // the boss spawns at the top-centre of its room
  let body = sim.ents.find(n => n.k === 'neck' && n.role === 'body' && n.lvl === e.lvl && !n.dead && dist2(n.x, n.y, ax, ay - 0.3) < 4);
  if (!body) body = sim.spawn({ k: 'neck', role: 'body', lvl: e.lvl, x: ax, y: ay - 0.3, spr: 'drake_body_' + (cfg.bodyTint || cfg.tint), sc: cfg.bodySc || 2.5, z: 0, heads: [] });
  body.heads.push(e); e.body = body;
  e.base = { x: ax + (cfg.baseDx || 0), y: ay + 0.2 };
  e.segs = []; const n = cfg.segs || 7;
  for (let i = 0; i < n; i++) e.segs.push(sim.spawn({ k: 'neck', role: 'seg', head: e, lvl: e.lvl, x: e.base.x, y: e.base.y, spr: 'drake_neck_' + cfg.tint, sc: lerp(1.0, 0.7, i / n), z: 0.3 }));
  e.mode = 'sway'; e.tm = 1.2 + Math.random(); e.hz = cfg.headZ || 0.7; e.y = e.base.y + 1.5; e.x = e.base.x;
}
// cfg: tint, home (angle the neck rests at), reach, breath(sim, e) one puff, breathGap, special(sim, e, p) when hurt
function dragonAi(cfg) {
  return (sim, e, dt, { p }) => {
    if (!e.segs) rig(sim, e, cfg);
    const B = e.base, hurt = e.hp < e.maxHp / 2, fast = hurt ? 1.4 : 1; const reach = cfg.reach || 4.6;
    const toward = (tx, ty, rate) => {
      let dx = tx - B.x, dy = ty - B.y; const d = Math.hypot(dx, dy); if (d > reach) { dx *= reach / d; dy *= reach / d; }
      e.x += (B.x + dx - e.x) * Math.min(1, dt * rate); e.y += (B.y + dy - e.y) * Math.min(1, dt * rate);
      if (e.b) { e.x = clamp(e.x, e.b.x0 + 0.5, e.b.x1 - 0.5); e.y = clamp(e.y, e.b.y0 + 0.5, e.b.y1 - 0.5); }
    };
    switch (e.mode) {
      case 'sway': { const a = cfg.home + Math.sin(e.t * 0.9 + (cfg.phase || 0)) * 0.7; const r = 2 + Math.sin(e.t * 1.7) * 0.5; toward(B.x + Math.cos(a) * r, B.y + Math.sin(a) * r, 3);
        if (e.tm <= 0 && p) { e.mode = 'aim'; e.tm = 0.75 / fast; sim.sfx('roar', e.lvl, e.x, e.y); } break; }
      case 'aim': { if (!p) { e.mode = 'sway'; break; } const d = Math.hypot(p.x - B.x, p.y - B.y) || 1; const k = Math.min(reach * 0.6, d);
        toward(B.x + (p.x - B.x) / d * k, B.y + (p.y - B.y) / d * k, 4); e.f = Math.atan2(p.y - e.y, p.x - e.x);
        if (e.tm <= 0) { if (dist2(p.x, p.y, e.x, e.y) < 7 && Math.random() < 0.7) { e.mode = 'bite'; e.tm = 0.5; e.bx = p.x; e.by = p.y; sim.sfx('roar', e.lvl, e.x, e.y); } else { e.mode = 'breath'; e.tm = 1.0; e.shot = 0; } }
        break; }
      case 'bite': toward(e.bx, e.by, 10); if (e.tm <= 0) { e.mode = 'recoil'; e.tm = 0.7; } break;
      case 'breath': if (p) e.f += clamp(angDiff(e.f, Math.atan2(p.y - e.y, p.x - e.x)), -dt * 1.4, dt * 1.4);
        e.shot -= dt; if (e.shot <= 0) { e.shot = (cfg.breathGap || 0.12) / fast; cfg.breath(sim, e); }
        if (e.tm <= 0) { e.mode = 'recoil'; e.tm = 0.8; } break;
      default: toward(B.x + Math.cos(cfg.home) * 1.6, B.y + Math.sin(cfg.home) * 1.6, 3);
        if (e.tm <= 0) { e.mode = 'sway'; e.tm = (1.3 + Math.random()) / fast; e.n = (e.n || 0) + 1; if (hurt && cfg.special && e.n % 2 === 0) cfg.special(sim, e, p); }
    }
    // head height: rears up to breathe, dips to bite
    e.hz += ((e.mode === 'bite' ? 0.2 : e.mode === 'breath' ? (cfg.headZ || 0.7) + 0.15 : (cfg.headZ || 0.7)) - e.hz) * Math.min(1, dt * 5);
    // the neck: a swaying arch from the body to the head
    const n = e.segs.length, dx = e.x - B.x, dy = e.y - B.y, len = Math.hypot(dx, dy) || 1;
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 1), s = e.segs[i]; const sway = Math.sin(e.t * 2.2 + i * 0.7 + (cfg.phase || 0)) * 0.2 * Math.sin(t * Math.PI);
      s.x = B.x + dx * t - dy / len * sway; s.y = B.y + dy * t + dx / len * sway;
      s.z = lerp(0.3, e.hz, t) + Math.sin(t * Math.PI) * (cfg.arch || 0.7) * (1 - Math.min(1, len / reach) * 0.6);
    }
  };
}
const stream = (proj, jitter) => (sim, e) => { sim.fireProj(proj, e.lvl, e.x, e.y, e.f + (Math.random() - 0.5) * jitter, 'e', null, { dmg: Content.projectiles[proj].dmg }); if (Math.random() < 0.3) sim.sfx('fire', e.lvl, e.x, e.y); };
const eruption = (sim, e) => { // lava bursts out of the floor all over the room
  if (!e.b) return; const L = sim.W.levels[e.lvl];
  for (let i = 0; i < 7; i++) { const x = e.b.x0 + 1 + Math.random() * (e.b.x1 - e.b.x0 - 2), y = e.b.y0 + 2 + Math.random() * (e.b.y1 - e.b.y0 - 3); if (!L.solidAt(x, y)) sim.spawn({ k: 'efire', lvl: e.lvl, x, y, life: 2.2, spr: 'flame', sc: 1.0, z: -0.05 }); }
  sim.sfx('boom', e.lvl, e.x, e.y);
};
const headDef = (o) => defineEnemy(Object.assign({ hp: 12, spd: 0, dmg: 2, r: 0.6, sc: 1.3, boss: true, sprite: HEAD_ROWS, view: (e) => e.hz || 0.7,
  anim: { fps: 4, frames: (s, kit) => [s, kit.squash(s, 0.94), s, kit.squash(s, 1.05)] } }, o));
headDef({
  id: 'matriarch', title: 'THE FROST MATRIARCH', bossOf: [10], pal: PALS.ice,
  ai: dragonAi({ tint: 'ice', home: Math.PI / 2, reach: 4.8, breath: stream('icebreath', 0.5), breathGap: 0.11,
    special(sim, e) { AI.ring(sim, e, 'icebolt', 12, Math.random(), { dmg: 1 }); for (let i = 0; i < 2; i++) sim.spawnMinion(e, 'frostling'); } }),
  onDeath(sim) { sim.msg('THE FROST MATRIARCH FALLS. THE HOLLOW THAWS.'); },
});
headDef({
  id: 'patriarch', title: 'THE FIRE PATRIARCH', bossOf: [11], pal: PALS.fire, hot: true, hp: 13,
  ai: dragonAi({ tint: 'fire', home: Math.PI / 2, reach: 4.8, breath: stream('firebreath', 0.45), breathGap: 0.12, special: eruption }),
  onDeath(sim) { sim.msg('THE FIRE PATRIARCH FALLS. THE CALDERA GOES QUIET.'); },
});
// the Hearthwyrm: three heads on one body. Every head must fall.
const lastHead = (sim, e, line) => { const left = (e.body ? e.body.heads : []).filter(h => !h.dead && h !== e).length; sim.msg(left ? line : 'THE HEARTHWYRM FALLS. ITS THREE FLAMES BURN AS ONE.'); };
headDef({
  id: 'hearth_frost', title: 'THE HEARTHWYRM', pal: PALS.ice, hp: 9,
  ai: dragonAi({ bodyTint: 'hearth', tint: 'ice', home: Math.PI / 2 + 0.75, baseDx: -0.8, phase: 0, reach: 4.4, breath: stream('icebreath', 0.5), breathGap: 0.14,
    special(sim, e) { AI.ring(sim, e, 'icebolt', 8, 0, { dmg: 1 }); } }),
  onDeath(sim, e) { lastHead(sim, e, 'THE FROST HEAD FALLS.'); },
});
headDef({
  id: 'hearth_fire', title: 'THE HEARTHWYRM', bossOf: [12], pal: PALS.fire, hot: true, hp: 9,
  ai: dragonAi({ bodyTint: 'hearth', tint: 'fire', home: Math.PI / 2, baseDx: 0, phase: 2, reach: 4.6, breath: stream('firebreath', 0.45), breathGap: 0.14, special: eruption }),
  onDeath(sim, e) { lastHead(sim, e, 'THE FIRE HEAD FALLS.'); },
});
headDef({
  id: 'hearth_hollow', title: 'THE HEARTHWYRM', pal: PALS.hollow, hp: 9,
  ai: dragonAi({ bodyTint: 'hearth', tint: 'hollow', home: Math.PI / 2 - 0.75, baseDx: 0.8, phase: 4, reach: 4.4, breath: stream('magic', 0.7), breathGap: 0.22,
    special(sim, e) { for (let i = 0; i < 2; i++) sim.spawnMinion(e, 'bat'); } }),
  onDeath(sim, e) { lastHead(sim, e, 'THE HOLLOW HEAD FALLS... AND THE STOLEN LIGHT RETURNS.'); },
});
