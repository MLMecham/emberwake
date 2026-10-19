// ===== content/items/potion.js : potions (B-item). A potion also saves you automatically when you'd fall. =====
// Drinking one (game/sim.js drinkPotion): full health, poison and chill gone, and POTION_GUARD seconds nothing touches you.
// They cost POTION_PRICE in every shop. The one cheap way: take the potion (not the heart) in a heart cave, and that old
// man refills it for POTION_REFILL from then on (sim.openRefill; the map marks his cave with a potion).
'use strict';
defineItem({
  id: 'potion', name: 'RED POTION', sprite: 'potion', monk: { name: 'SPIRIT TEA' }, slot: 'b', order: 7,
  owned: (p) => p.potions > 0,
  full: (p) => p.potions >= 2, // shops won't sell you one you can't carry
  give(sim, p, ctx) { p.potions = Math.min(2, p.potions + 1); p.items.potion = true; ctx.banner(); },
  use(sim, p) {
    if (p.potions <= 0) return sim.hint(p, 'NO POTIONS.');
    if (p.hp >= p.maxHp && !(p.poisonTicks > 0)) return sim.hint(p, 'ALREADY AT FULL HEALTH.');
    p.potions--; sim.drinkPotion(p);
  },
});
defineItem({ id: 'potion2', name: 'BLUE POTION', sprite: 'potion', full: (p) => p.potions >= 2, give(sim, p, ctx) { p.potions = 2; p.items.potion = true; ctx.banner('BLUE POTION (2 DOSES)'); } });
Content.refillText = 'I KEPT THE KETTLE ON. BRING ME THE EMPTY BOTTLE AND I\'LL FILL IT FOR ' + POTION_REFILL + '.';
