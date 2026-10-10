// ===== content/items/gems.js : money =====
'use strict';
defineItem({ id: 'gem1', name: 'GEM', sprite: 'gem_g', give(sim, p) { p.gems = Math.min(999, p.gems + 1); sim.sfx('gem', p.lvl); } });
defineItem({ id: 'gem5', name: '5 GEMS', sprite: 'gem_b', give(sim, p) { p.gems = Math.min(999, p.gems + 5); sim.sfx('gem', p.lvl); } });
for (const n of [30, 50, 100]) defineItem({ id: 'gems' + n, name: n + ' GEMS', sprite: 'gem_r', pickup: { sc: 0.6 }, give(sim, p, ctx) { p.gems = Math.min(999, p.gems + n); ctx.banner('+' + n + ' GEMS'); } });
