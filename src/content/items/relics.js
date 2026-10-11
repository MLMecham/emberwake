// ===== content/items/relics.js : rare tools. Where to find them is still open (docs/IDEAS.md); debug mode hands them out. =====
'use strict';
// GALE CLOAK (B-item): fly for a few seconds. While airborne you pass over water, lava, spikes, pits and vents like a bat
// (walls still stop you). Land somewhere bad and it's like any fall. game/sim.js flying(), ui/main.js movement.
defineItem({ id: 'galecloak', name: 'GALE CLOAK', sprite: 'galecloak', monk: { name: 'WIND STEP' }, slot: 'b', order: 8, team: true, debug: true,
  owned: (p) => !!p.items.galecloak,
  give(sim, p, ctx) { p.items.galecloak = true; ctx.banner(); },
  use(sim, p) {
    if (sim.flying(p)) return;
    if (sim.time < (p.flyReady || 0)) return sim.hint(p, 'THE CLOAK IS STILL CATCHING ITS BREATH.');
    p.flyUntil = sim.time + FLY_TIME; p.flyReady = p.flyUntil + FLY_COOLDOWN; sim.sfx('gale', p.lvl, p.x, p.y);
  },
});
// SKELETON KEY: opens every locked door, in every dungeon, without using up keys.
defineItem({ id: 'skeletonkey', name: 'SKELETON KEY', sprite: 'skelkey', team: true, debug: true,
  give(sim, p, ctx) { p.items.skeletonkey = true; ctx.banner('SKELETON KEY: EVERY LOCK IS YOURS'); } });
