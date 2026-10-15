// ===== content/items/hearts.js : healing and max health =====
'use strict';
defineItem({ id: 'heart', name: 'HEART', sprite: 'heart', full: (p) => p.hp >= p.maxHp, give(sim, p, ctx) { sim.heal(p, sim.heartHeal(p, 4)); sim.sfx('heart', p.lvl); if (ctx.fromShop) ctx.banner(); sim.shepherd(p, 4); } }); // rings change how much a heart heals (items/rings.js)
defineItem({ id: 'fairy', name: 'FAIRY', sprite: 'fairy', pickup: { sc: 0.6, z: 0.3, float: true }, give(sim, p) { sim.heal(p, p.maxHp); sim.sfx('heal', p.lvl); } });
// +1 heart for the whole party
defineItem({ id: 'hcont', name: 'HEART CONTAINER', sprite: 'hcont', team: true, give(sim, p, ctx) { p.maxHp = Math.min(64, p.maxHp + 4); sim.heal(p, p.maxHp); ctx.banner(); } });
// found in hidden dungeon rooms: every 4 pieces the party gains a heart
defineItem({
  id: 'hpiece', name: 'HEART PIECE', sprite: 'hpiece',
  give(sim, p, ctx) {
    const t = sim.team; t.hpieces = (t.hpieces || 0) + 1;
    if (t.hpieces % 4 === 0) { ctx.banner('HEART PIECE 4/4 - A NEW HEART!', true); for (const o of Object.values(sim.players)) { o.maxHp = Math.min(64, o.maxHp + 4); sim.heal(o, o.maxHp); } }
    else ctx.banner('HEART PIECE ' + (t.hpieces % 4) + '/4', true);
  },
});
