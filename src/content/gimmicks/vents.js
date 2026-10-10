// ===== content/gimmicks/vents.js : fire vents that blow on a shared rhythm (sim.ventPhase: cool, glowing, blowing) =====
// Standing on a VENT while it blows hurts (unless you wear the Magma Boots). Watch them glow, then cross.
'use strict';
defineTexture('vent', (x, y, r, ctx) => { const bar = (x % 6) < 2 || (y % 6) < 2; return bar ? ctx.vary([50, 44, 46], x, y, 0.2) : [24, 16, 16]; });
defineTexture('vent_warm', (x, y, r, ctx) => { const bar = (x % 6) < 2 || (y % 6) < 2; return bar ? ctx.vary([90, 50, 40], x, y, 0.2) : [200, 70, 20]; });
defineTexture('vent_hot', (x, y, r, ctx) => { const bar = (x % 6) < 2 || (y % 6) < 2; const d = Math.hypot(x - 15.5, y - 15.5); return bar ? [255, 140, 40] : d < 8 ? [255, 250, 200] : [255, 190, 60]; });
defineTile('VENT', { floor: 'vent', vent: true });
defineGimmick('vents', {
  room(L, r, { rnd, set, lane }) {
    if (rnd() < 0.3) return false;
    const pat = rnd.int(3);
    if (pat === 0) { for (let y = 2; y <= 6; y++) for (let x = 2; x <= 10; x++) if ((x + y) % 2 === 0) set(x, y, 'VENT'); }       // checkerboard
    else if (pat === 1) { for (let x = 1; x < DSX; x++) { set(x, 3, 'VENT'); set(x, 4, 'VENT'); set(x, 5, 'VENT'); } }             // a band across
    else { for (let y = 1; y < DSY; y++) { set(4, y, 'VENT'); set(8, y, 'VENT'); } for (const [x, y] of [[2, 2], [10, 2], [2, 6], [10, 6]]) if (!lane(x, y)) set(x, y, 'LAVA'); }
    return true;
  },
});
