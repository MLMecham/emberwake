// ===== content/items/tunics.js : armor. Your tunic visibly turns to chainmail, then plate. =====
'use strict';
defineItem({ id: 'chain', name: 'CHAIN TUNIC', sprite: 'armor', monk: { name: 'BLUE AURA' }, canTake: (p) => p.armor < 1, give(sim, p, ctx) { p.armor = Math.max(p.armor, 1); ctx.banner(); } });
defineItem({ id: 'plate', name: 'PLATE TUNIC', sprite: 'armor', monk: { name: 'GOLDEN AURA' }, team: true, give(sim, p, ctx) { p.armor = 2; ctx.banner(); } });
