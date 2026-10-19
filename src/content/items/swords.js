// ===== content/items/swords.js : sword upgrades (shared by the party). Damage per level is SWORD_DMG in game/sim.js. =====
'use strict';
[['sword1', 'WOODEN SWORD', 1], ['sword2', 'IRON SWORD', 2], ['sword3', 'MYTHRIL SWORD', 3]].forEach(([id, name, lv]) =>
  defineItem({ id, name, sprite: 'sword', team: true, give(sim, p, ctx) { p.sword = Math.max(p.sword, lv); ctx.banner(); } }));
