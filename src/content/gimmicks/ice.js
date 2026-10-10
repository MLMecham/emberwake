// ===== content/gimmicks/ice.js : icy rooms. You slide on ICE (see the client movement), straight into spikes and pits =====
'use strict';
defineTexture('spikes', (x, y, r, ctx) => { const cx = x % 8, cy = y % 8; const tip = Math.abs(cx - 3.5) + Math.abs(cy - 3.5) < 2.5; return tip ? (cx < 4 && cy < 4 ? [235, 245, 255] : [150, 170, 200]) : ctx.vary([60, 70, 90], x, y, 0.2); });
defineTile('SPIKES', { floor: 'spikes', hurt: 1 }); // ice spikes: they hurt while you stand on them
defineGimmick('ice', {
  room(L, r, { rnd, set, lane }) {
    if (rnd() < 0.25) return false; // some rooms stay plain
    for (let y = 1; y < DSY; y++) for (let x = 1; x < DSX; x++) set(x, y, 'ICE');
    const pat = rnd.int(3);
    const hazard = (x, y, t) => { if (!lane(x, y)) set(x, y, t); };
    if (pat === 0) { for (const [x, y] of [[1, 1], [2, 1], [1, 2], [10, 1], [11, 1], [11, 2], [1, 6], [1, 7], [2, 7], [11, 6], [10, 7], [11, 7]]) hazard(x, y, 'PIT'); }
    else if (pat === 1) { for (let x = 2; x <= 10; x++) { hazard(x, 2, 'SPIKES'); hazard(x, 6, 'SPIKES'); } }
    else { for (const [x, y] of [[3, 2], [9, 2], [3, 6], [9, 6]]) hazard(x, y, 'ICEWALL'); for (const [x, y] of [[4, 4], [8, 4], [6, 2], [6, 6]]) if (!lane(x, y)) hazard(x, y, 'SPIKES'); hazard(2, 4, 'PIT'); hazard(10, 4, 'PIT'); }
    return true;
  },
});
