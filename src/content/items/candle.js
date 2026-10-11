// ===== content/items/candle.js : a short burst of flame that burns bushes (some hide stairs) =====
'use strict';
defineItem({
  id: 'candle', name: 'CANDLE', sprite: 'candle', monk: { name: 'FLAME PALM' }, slot: 'b', order: 4, debug: true,
  owned: (p) => !!p.items.candle,
  full: (p) => !!p.items.candle,
  give(sim, p, ctx) { p.items.candle = true; p.sel = 'candle'; ctx.banner(); },
  use(sim, p) {
    if (sim.time < (p.candleReady || 0)) return; // one flame every CANDLE_COOLDOWN seconds (it's a light, not a weapon)
    if (sim.ents.some(e => e.k === 'proj' && e.pid === p.id && (e.type === 'candle' || e.type === 'palm'))) return;
    p.candleReady = sim.time + CANDLE_COOLDOWN;
    sim.fireProj(p.cls === 'monk' ? 'palm' : 'candle', p.lvl, p.x, p.y, p.a, 'p', p.id, {}); sim.sfx('fire', p.lvl);
  },
});
