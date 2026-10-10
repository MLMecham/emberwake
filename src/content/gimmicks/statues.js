// ===== content/gimmicks/statues.js : knight statues that come to life when you walk past =====
// The waking itself is handled by the engine for any enemy with dormant: true (see sim.js).
'use strict';
defineGimmick('statues', {
  room(L, r, { rnd, d }) {
    if (rnd() < 0.5) return false;
    const spots = rnd.shuffle([[2, 1], [10, 1], [2, 7], [10, 7], [3, 3], [9, 5]]);
    r.dormant = spots.slice(0, 1 + rnd.int(2)).map(([x, y]) => ({ type: 'knight', x: r.rx * DSX + x + 0.5, y: r.ry * DSY + y + 0.5 }));
    return false;
  },
});
