// ===== content/items/NAME.js =====
// Copy to src/content/items/, rename, change the ids, then run:  node tools/check.js
// Two examples: a simple pickup, and a usable B-item that fires a projectile.
'use strict';

// 1) A pickup: does something the moment you touch it.
defineItem({
  id: 'goldheart', name: 'GOLDEN HEART', sprite: 'hcont',
  give(sim, p, ctx) { sim.heal(p, p.maxHp); p.gems += 10; ctx.banner(); }, // ctx.banner() shows the "you got it" card
});

// 2) A B-item: shows up in the item rotation (Q/R/wheel) and is used with E / right-click.
defineItem({
  id: 'slingshot', name: 'SLINGSHOT', sprite: 'rock',
  monk: { name: 'PEBBLE FLICK' },          // what the martial artist calls it (optional; can also set sprite)
  slot: 'b', order: 8,                      // order = position in the rotation
  team: true,                               // picking it up gives it to the whole party
  debug: true,                              // adds a checkbox to the debug loadout
  owned: (p) => !!p.items.slingshot,
  give(sim, p, ctx) { p.items.slingshot = true; ctx.banner(); },
  use(sim, p) {
    if (sim.ents.some(e => e.k === 'proj' && e.pid === p.id && e.type === 'pebble')) return; // one in the air at a time
    sim.fireProj('pebble', p.lvl, p.x, p.y, p.a, 'p', p.id, {});
    sim.sfx('shoot', p.lvl);
  },
});
// its projectile (could also live in content/projectiles.js)
defineProjectile({ id: 'pebble', spr: 'rock', spd: 10, dmg: 1, sc: 0.5, player: true, range: 8 });
// To make it findable: put it on a dungeon pedestal (content/dungeons.js) or in a shop (content/caves.js).
