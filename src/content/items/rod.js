// ===== content/items/rod.js : magic bolt that leaves fire where it lands =====
'use strict';
defineItem({
  id: 'rod', name: 'FIRE ROD', sprite: 'rod', monk: { name: 'THUNDER PALM' }, slot: 'b', order: 5, team: true, debug: true,
  owned: (p) => !!p.items.rod,
  give(sim, p, ctx) { p.items.rod = true; ctx.banner(); },
  use(sim, p) {
    if (sim.ents.some(e => e.k === 'proj' && e.pid === p.id && (e.type === 'rodbolt' || e.type === 'thunder'))) return;
    const monk = p.cls === 'monk';
    sim.fireProj(monk ? 'thunder' : 'rodbolt', p.lvl, p.x, p.y, p.a, 'p', p.id, { fireTrail: !monk }); sim.sfx('magic', p.lvl);
  },
});
// THUNDER ROD (debug only for now): a bolt that leaps from foe to foe (up to CHAIN_JUMPS more) and jolts each one.
// Fire and lightning are the rod's elements; frost belongs to arrows.
defineItem({
  id: 'thunderrod', name: 'THUNDER ROD', sprite: 'rod', monk: { name: 'STORM PALM' }, slot: 'b', order: 6, team: true, debug: true,
  owned: (p) => !!p.items.thunderrod,
  give(sim, p, ctx) { p.items.thunderrod = true; ctx.banner(); },
  use(sim, p) {
    if (sim.ents.some(e => e.k === 'proj' && e.pid === p.id && e.type === 'bolt')) return;
    sim.fireProj('bolt', p.lvl, p.x, p.y, p.a, 'p', p.id, { chainLeft: 2 }); sim.sfx('beam', p.lvl);
  },
});
