// ===== content/items/rod.js : the MAGIC WAND (Emberforge's treasure), its elements, its spells, and casting together =====
// (The item id stays 'rod' so old saves keep it.) The martial artist still gets his Thunder Palm, untouched until his rework.
//
// The wand's bolt depends on the element picked on the inventory's GEAR page (p.wandEl, game/sim.js equip):
//   plain   FORCE BOLT: little damage, a big shove and a short stun. Blast foes into pits, lava and deep water.
//   fire    (FLAME ORB) a fireball that leaves burning ground: burns bushes, lights torches, hurts ice foes
//   thunder (STORM ORB) a bolt that hops to 2 more foes and jolts each one
// No magic meter: each bolt has a short cooldown (WAND_CD).
//
// Shift + wand casts the element's SPELL, if you've learned it (each is its own scroll):
//   plain   FORCE WAVE: shoves and stuns everything around you
//   fire    FLAME WALL: a line of fire across your path for a few seconds
//   thunder LIGHTNING LANCE: a beam straight ahead that pierces and stuns everything it passes
// A spell isn't instant: it starts a CHANT (a ring at your feet, CHANT_TIME). With the TANDEM CASTING scroll, a friend who
// starts the same spell within CHANT_JOIN tiles while your ring is up joins in, and it fires once, combined:
//   FORCE WAVE x2-4 -> GALE BURST: one blast from the middle of the group, far wider, longer stun, knocks shields and staffs
//   loose. (Fire and thunder combos are planned: docs/IDEAS.md.) Joiners get their cooldown back. Co-op only.
'use strict';
const WAND_CD = { plain: 0.8, fire: 1.0, thunder: 1.2 }, SPELL_CD = 7, CHANT_TIME = 0.6, CHANT_JOIN = 6;
const SPELLS = { plain: 'forcewave', fire: 'flamewall', thunder: 'lightninglance' }; // element -> the p.items flag for its spell
function wandEl(p) { const e = p.wandEl; return e === 'fire' && p.items.wandfire ? 'fire' : e === 'thunder' && p.items.wandthunder ? 'thunder' : 'plain'; }
defineItem({
  id: 'rod', name: 'MAGIC WAND', sprite: 'rod', monk: { name: 'THUNDER PALM' }, slot: 'b', order: 5, team: true, debug: true,
  owned: (p) => !!p.items.rod,
  give(sim, p, ctx) { p.items.rod = true; ctx.banner(); if (p.cls !== 'monk') sim.ev({ t: 'dialog', pid: p.id, text: 'THE WAND HURLS A FORCE BOLT: A WEAK HIT THAT SHOVES HARD. KNOCK THEM INTO PITS, LAVA AND WATER. ORBS OF FIRE AND STORM CAN CHANGE ITS MAGIC.' }); },
  use(sim, p) {
    if (p.cls === 'monk') { // unchanged until the monk rework
      if (sim.ents.some(e => e.k === 'proj' && e.pid === p.id && e.type === 'thunder')) return;
      sim.fireProj('thunder', p.lvl, p.x, p.y, p.a, 'p', p.id, {}); sim.sfx('magic', p.lvl); return;
    }
    if (sim.time < (p.wandReady || 0)) return; const el = wandEl(p); p.wandReady = sim.time + WAND_CD[el];
    if (el === 'fire') { sim.fireProj('rodbolt', p.lvl, p.x, p.y, p.a, 'p', p.id, { fireTrail: true }); sim.sfx('magic', p.lvl); }
    else if (el === 'thunder') { sim.fireProj('bolt', p.lvl, p.x, p.y, p.a, 'p', p.id, { chainLeft: 2 }); sim.sfx('beam', p.lvl); }
    else { sim.fireProj('forcebolt', p.lvl, p.x, p.y, p.a, 'p', p.id, { kbMul: 3 }); sim.sfx('force', p.lvl, p.x, p.y); }
  },
  useAlt(sim, p, a) {
    if (p.cls === 'monk') return this.use(sim, p, a);
    const el = wandEl(p); const spell = SPELLS[el];
    if (!p.items[spell]) return this.use(sim, p, a); // no spell learned for this element: just a bolt
    // join a friend's chant of the same spell, if you know how to cast together
    const open = sim.ents.find(e => e.k === 'chant' && !e.dead && e.spell === spell && e.lvl === p.lvl && !e.members.includes(p.id) && dist2(e.x, e.y, p.x, p.y) < CHANT_JOIN * CHANT_JOIN);
    if (open && p.items.tandem && sim.players[open.pid] && sim.players[open.pid].items.tandem) { open.members.push(p.id); sim.sfx('chantjoin', p.lvl, p.x, p.y); sim.hint(p, 'YOU JOIN THE CHANT!'); return; }
    if (sim.time < (p.spellReady || 0)) return sim.hint(p, 'THE SPELL IS STILL GATHERING.');
    if (sim.ents.some(e => e.k === 'chant' && !e.dead && e.members.includes(p.id))) return;
    p.spellReady = sim.time + SPELL_CD;
    sim.spawn({ k: 'chant', lvl: p.lvl, x: p.x, y: p.y, pid: p.id, spell, members: [p.id], life: CHANT_TIME, spr: 'chant_' + el, sc: 1.2, z: -0.3 });
    sim.sfx('chant', p.lvl, p.x, p.y);
  },
});
// elements (team upgrades: picked on the GEAR page) and the three spells (technique scrolls), and casting together
const orb = (id, name, flag, el, text) => defineItem({ id, name, sprite: 'orb_' + el, team: true, debug: true,
  debugGrant(p) { p.items[flag] = true; }, give(sim, p, ctx) { p.items[flag] = true; if (!p.wandEl || p.wandEl === 'plain') p.wandEl = el; ctx.banner(); sim.ev({ t: 'dialog', pid: p.id, text }); } });
orb('flameorb', 'FLAME ORB', 'wandfire', 'fire', 'YOUR WAND CAN NOW HURL FIRE. PICK ITS MAGIC ON THE GEAR PAGE OF YOUR BAG.');
orb('stormorb', 'STORM ORB', 'wandthunder', 'thunder', 'YOUR WAND CAN NOW CALL LIGHTNING THAT LEAPS FROM FOE TO FOE. PICK ITS MAGIC ON THE GEAR PAGE OF YOUR BAG.');
const scroll = (id, name, flag, text) => defineItem({ id, name, sprite: 'scroll', team: true, debug: true,
  debugGrant(p) { p.items[flag] = true; }, give(sim, p, ctx) { p.items[flag] = true; ctx.banner(); sim.ev({ t: 'dialog', pid: p.id, text }); } });
scroll('forcewave', 'SCROLL: FORCE WAVE', 'forcewave', 'HOLD SHIFT AND USE THE WAND (FORCE MAGIC) TO CHANT A FORCE WAVE THAT HURLS BACK EVERYTHING AROUND YOU.');
scroll('flamewall', 'SCROLL: FLAME WALL', 'flamewall', 'HOLD SHIFT AND USE THE WAND (FIRE MAGIC) TO CHANT A WALL OF FIRE ACROSS YOUR PATH.');
scroll('lightninglance', 'SCROLL: LIGHTNING LANCE', 'lightninglance', 'HOLD SHIFT AND USE THE WAND (STORM MAGIC) TO CHANT A LANCE OF LIGHTNING THAT PIERCES EVERYTHING IN A LINE.');
scroll('tandem', 'SCROLL: TANDEM CASTING', 'tandem', 'WHEN A FRIEND CHANTS A SPELL, CHANT THE SAME ONE BESIDE THEM. YOUR MAGIC JOINS AND STRIKES AS ONE, FAR STRONGER.');
// A chant: a ring on the floor, a link of sparks to everyone who joined, and the spell when it ends
defineEntity('chant', { update(sim, e, dt) {
  const ps = e.members.map(id => sim.players[id]).filter(p => p && p.alive && p.lvl === e.lvl); if (!ps.length) { e.dead = true; return; }
  const lead = sim.players[e.pid] && sim.players[e.pid].alive ? sim.players[e.pid] : ps[0]; e.x = lead.x; e.y = lead.y; // the ring follows its caster
  if (ps.length > 1 && Math.random() < 0.6) for (const p of ps) if (p !== lead) { const k = Math.random(); sim.spawn({ k: 'fx', lvl: e.lvl, x: lerp(lead.x, p.x, k), y: lerp(lead.y, p.y, k), spr: 'spark', life: 0.15, sc: 0.5, z: 0.2 }); }
  if (e.t < e.life) return; e.dead = true; castSpell(sim, e.spell, ps, lead);
} });
function castSpell(sim, spell, ps, lead) {
  const n = ps.length; const L = sim.W.levels[lead.lvl];
  if (spell === 'forcewave') {
    const cx = ps.reduce((s, p) => s + p.x, 0) / n, cy = ps.reduce((s, p) => s + p.y, 0) / n; const R = n > 1 ? Math.min(7, 2.6 * n) : 2.6;
    sim.sfx(n > 1 ? 'galeburst' : 'force', lead.lvl, cx, cy); sim.ev({ t: 'shake', lvl: lead.lvl, x: cx, y: cy });
    sim.spawn({ k: 'fx', lvl: lead.lvl, x: cx, y: cy, spr: 'forcering', life: 0.4, sc: R * 0.9, z: 0 });
    if (n > 1) { sim.msg(n >= 4 ? 'GALE BURST!!!' : 'GALE BURST!'); if (n >= 4) for (const p of ps) sim.ev({ t: 'flash', pid: p.id, c: '#ffffff' }); }
    for (const e of sim.ents) {
      if (e.k !== 'en' || e.lvl !== lead.lvl || e.dead || e.sub || dist2(e.x, e.y, cx, cy) > R * R) continue; const def = enemyDef(e.type);
      if (n > 1 && def.disarm && !e.disarmed && !def.boss) sim.disarmEnemy(e, { x: cx, y: cy });
      if (sim.damageEnemy(e, n > 1 ? n : 1, { x: cx, y: cy }, { pid: lead.id, kbMul: n > 1 ? 3.5 : 2.5, pierceShield: true, ignoreIframes: true, elem: 'force' }) && !def.boss && !e.dead) { e.stun = Math.max(e.stun || 0, n > 1 ? 2.5 : 1); e.stunFrom = sim.time; }
    }
    for (const p of ps) if (p !== lead) p.spellReady = sim.time + 1; // joining costs nothing
    return;
  }
  // fire and thunder: the same spell for each caster (combos planned)
  for (const p of ps) {
    if (spell === 'flamewall') { // five flames across your path, two steps ahead
      const ax = p.x + Math.cos(p.a) * 2, ay = p.y + Math.sin(p.a) * 2, qx = -Math.sin(p.a), qy = Math.cos(p.a);
      for (let i = -2; i <= 2; i++) { const fx = ax + qx * i * 0.8, fy = ay + qy * i * 0.8; if (L.solidAt(fx, fy)) continue; sim.spawn({ k: 'fire', lvl: p.lvl, x: fx, y: fy, life: 3, spr: 'flame', sc: 1.1, z: -0.05, pid: p.id }); sim.burnAt(L, fx, fy); }
      sim.sfx('fire', p.lvl, p.x, p.y);
    } else if (spell === 'lightninglance') { sim.fireProj('lance', p.lvl, p.x, p.y, p.a, 'p', p.id, {}); sim.sfx('beam', p.lvl, p.x, p.y); sim.ev({ t: 'shake', lvl: p.lvl, x: p.x, y: p.y }); }
    if (p !== lead) p.spellReady = sim.time + 1;
  }
}
