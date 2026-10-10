// ===== content/items/candle.js : a short burst of flame that burns bushes (some hide stairs) =====
'use strict';
defineItem({
  id: 'candle', name: 'CANDLE', sprite: 'candle', monk: { name: 'FLAME PALM' }, slot: 'b', order: 4, debug: true,
  owned: (p) => !!p.items.candle,
  give(sim, p, ctx) { p.items.candle = true; p.sel = 'candle'; ctx.banner(); },
  use(sim, p) {
    if (sim.ents.some(e => e.k === 'proj' && e.pid === p.id && (e.type === 'candle' || e.type === 'palm'))) return;
    sim.fireProj(p.cls === 'monk' ? 'palm' : 'candle', p.lvl, p.x, p.y, p.a, 'p', p.id, {}); sim.sfx('fire', p.lvl);
  },
});
