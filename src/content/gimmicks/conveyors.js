// ===== content/gimmicks/conveyors.js : moving floors that push you (toward lava, in the Emberforge) =====
'use strict';
const belt = (dir) => (x, y, r, f, ctx) => {
  const u = dir > 0 ? (x - f * 4 + 64) % 16 : (x + f * 4) % 16; const edge = y < 3 || y > 28;
  if (edge) return [60, 58, 60];
  const chev = Math.abs((dir > 0 ? u : 15 - u) - 8 - Math.abs(y - 15.5) * 0.4) < 1.6;
  return chev ? [230, 170, 40] : ((y >> 2) & 1 ? [44, 42, 46] : [54, 52, 56]);
};
defineTexture('conv_e', belt(1), { frames: 4 });
defineTexture('conv_w', belt(-1), { frames: 4 });
// conveyor: [dx, dy] push in tiles per second
defineTile('CONV_E', { floor: 'conv_e', conveyor: [2.2, 0] });
defineTile('CONV_W', { floor: 'conv_w', conveyor: [-2.2, 0] });
defineGimmick('conveyors', {
  room(L, r, { rnd, set }) {
    if (rnd() < 0.5) return false;
    for (let x = 1; x <= 11; x++) { set(x, 2, 'CONV_E'); set(x, 6, 'CONV_W'); }
    set(11, 2, 'LAVA'); set(1, 6, 'LAVA'); // where the belts dump you
    return true;
  },
});
