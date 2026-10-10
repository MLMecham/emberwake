// ===== content/items/hearts.js : healing and max health =====
'use strict';
defineItem({ id: 'heart', name: 'HEART', sprite: 'heart', give(sim, p, ctx) { sim.heal(p, 4); sim.sfx('heart', p.lvl); if (ctx.fromShop) ctx.banner(); } });
defineItem({ id: 'fairy', name: 'FAIRY', sprite: 'fairy', pickup: { sc: 0.6, z: 0.3, float: true }, give(sim, p) { sim.heal(p, p.maxHp); sim.sfx('heal', p.lvl); } });
// +1 heart for the whole party
defineItem({ id: 'hcont', name: 'HEART CONTAINER', sprite: 'hcont', team: true, give(sim, p, ctx) { p.maxHp = Math.min(64, p.maxHp + 4); sim.heal(p, p.maxHp); ctx.banner(); } });
