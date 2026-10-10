// ===== content/items/potion.js : potions (B-item). A potion also saves you automatically when you'd fall. =====
'use strict';
defineItem({
  id: 'potion', name: 'RED POTION', sprite: 'potion', monk: { name: 'SPIRIT TEA' }, slot: 'b', order: 7,
  owned: (p) => p.potions > 0,
  give(sim, p, ctx) { p.potions = Math.min(2, p.potions + 1); p.items.potion = true; ctx.banner(); },
  use(sim, p) {
    if (p.potions <= 0) return sim.hint(p, 'NO POTIONS.');
    if (p.hp >= p.maxHp) return sim.hint(p, 'ALREADY AT FULL HEALTH.');
    p.potions--; sim.heal(p, p.maxHp); sim.sfx('heal', p.lvl); sim.ev({ t: 'flash', pid: p.id, c: '#f060b0' });
  },
});
defineItem({ id: 'potion2', name: 'BLUE POTION', sprite: 'potion', give(sim, p, ctx) { p.potions = 2; p.items.potion = true; ctx.banner('BLUE POTION (2 DOSES)'); } });
