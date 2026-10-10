// ===== content/gimmicks/brambles.js : thorny brambles block doors and rooms. Cut them with a sword or fist, or burn them. =====
'use strict';
defineTexture('bramble', (x, y, r, ctx) => {
  const v = Math.sin(x * 0.7 + Math.sin(y * 0.5) * 2) + Math.sin(y * 0.9 - x * 0.3);
  let c = v > 1.1 ? [70, 130, 50] : v > 0.2 ? [44, 92, 34] : [22, 46, 18];
  if (((x * 7 + y * 13) % 23) === 0) c = [230, 220, 190]; // thorns
  return ctx.vary(c, x, y, 0.2);
});
// cuttable / burnable tiles become their opensTo tile when hit
defineTile('BRAMBLE', { solid: true, wall: 'bramble', floor: 'dfloor', cuttable: true, burnable: true, opensTo: 'OPENDOOR' });     // in a doorway
defineTile('BRAMBLE_BUSH', { solid: true, wall: 'bramble', floor: 'dfloor', cuttable: true, burnable: true, opensTo: 'DFLOOR' }); // inside a room
defineGimmick('brambles', {
  doors(L, doors, { rnd }) {
    for (const dr of doors) if (dr.t === TL.OPENDOOR && rnd() < 0.45) { L.set(dr.x, dr.y, TL.BRAMBLE); dr.a.links[dr.b.id] = dr.b.links[dr.a.id] = dr.t = TL.BRAMBLE; }
  },
  room(L, r, { rnd, set, lane }) {
    if (rnd() < 0.5) for (let i = 0; i < 4; i++) { const x = 2 + rnd.int(9), y = 2 + rnd.int(5); if (!lane(x, y)) set(x, y, 'BRAMBLE_BUSH'); }
  },
});
