// ===== content/gimmicks/drain.js : rooms with a moat around the middle. Step on the floor switch to drain it. =====
'use strict';
defineTexture('switch', (x, y, r, th, ctx) => { const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5)); if (d < 8) return d < 6 ? [230, 200, 60] : [120, 100, 30]; return ctx.vary(th.floor, x, y, 0.15); }, { themed: true });
defineTexture('switch_down', (x, y, r, th, ctx) => { const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5)); if (d < 8) return d < 6 ? [110, 96, 40] : [70, 60, 20]; return ctx.vary(th.floor, x, y, 0.15); }, { themed: true });
defineTile('SWITCH', { floor: 'switch', pressure: true });
defineTile('SWITCH_DOWN', { floor: 'switch_down' });
defineGimmick('drain', {
  room(L, r, { rnd, set }) {
    if (!(r.key || r.map || r.compass || r.item || rnd() < 0.3)) return false;
    for (let x = 3; x <= 9; x++) { set(x, 2, 'WATER'); set(x, 6, 'WATER'); }
    for (let y = 3; y <= 5; y++) { set(3, y, 'WATER'); set(9, y, 'WATER'); }
    const [sx, sy] = rnd.pick([[1, 1], [11, 1], [1, 7], [11, 7]]); set(sx, sy, 'SWITCH');
    return true;
  },
  update(sim, L) {
    for (const p of Object.values(sim.players)) {
      if (!p.alive || p.lvl !== L.id) continue;
      const tx = Math.floor(p.x), ty = Math.floor(p.y); const i = L.idx(tx, ty);
      if (L.tiles[i] !== TL.SWITCH) continue;
      sim.setTile(L.id, i, TL.SWITCH_DOWN);
      const room = dungeonRoomAt(L, p.x, p.y); if (!room) continue;
      for (let y = room.ry * DSY + 1; y < room.ry * DSY + DSY; y++) for (let x = room.rx * DSX + 1; x < room.rx * DSX + DSX; x++) if (L.get(x, y) === TL.WATER) sim.setTile(L.id, L.idx(x, y), TL.DFLOOR);
      sim.sfx('secret', L.id); sim.hint(p, 'THE WATER DRAINS AWAY.');
    }
  },
});
