// ===== content/gimmicks/drain.js : the Sunken Stair's water rooms =====
// plan() picks a kind for each room, then room() builds it. Kinds:
//   pool    shallow water you wade through (25% slower, enemies too)
//   switch  a moat around the middle; step on the floor switch to drain it for good
//   spiral  a long walkway curling into the middle through deep water; bats cut straight across, doors stay shut
//           until they're dead. An eye in the corner drains it for a while (a shortcut once you have the bow)
//   moat    a moat around an island with the room's prize; only an arrow in the island's eye drains it   [needs the bow]
//   channel deep water across the room between the door you came in by and every other door; an eye at its
//           end drains it for a while                                                               [needs the bow]
// The planner keeps the bow reachable without the bow (game/world.js dungeonSolve), so nothing softlocks.
'use strict';
defineTexture('switch', (x, y, r, th, ctx) => { const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5)); if (d < 8) return d < 6 ? [230, 200, 60] : [120, 100, 30]; return ctx.vary(th.floor, x, y, 0.15); }, { themed: true });
defineTexture('switch_down', (x, y, r, th, ctx) => { const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5)); if (d < 8) return d < 6 ? [110, 96, 40] : [70, 60, 20]; return ctx.vary(th.floor, x, y, 0.15); }, { themed: true });
defineTile('SWITCH', { floor: 'switch', pressure: true });
defineTile('SWITCH_DOWN', { floor: 'switch_down' });
// the spiral, row by row (x 1-11, y 1-7). '~' deep water, 'E' the eye, 'K' where the prize appears. Every door lands on the outer ring.
const SPIRAL = [
  '...........',
  '.~~~~~~~~~.',
  '.~.......~.',
  '.~.~~~~~.~.',
  '...~~K...~.', // in at row 5 from the west, round the inner ring, and finish at K
  '.~~~~~~~~~.',
  'E~~~~......',
];
// a room of tide water: cells are deep water now; shooting one of `eyes` drains them for a while
function rig(L, r, ix, iy, cells, eyes) {
  L.rigs = L.rigs || {}; L.eyeLinks = L.eyeLinks || {};
  L.rigs[r.id] = { cells: cells.map(([x, y]) => L.idx(ix + x, iy + y)), eyes: eyes.map(([x, y]) => L.idx(ix + x, iy + y)) };
  for (const [x, y] of cells) L.set(ix + x, iy + y, TL.WATER);
  for (const [x, y] of eyes) { L.set(ix + x, iy + y, TL.EYE); L.eyeLinks[L.idx(ix + x, iy + y)] = { kind: 'timed', rid: r.id }; }
}
defineGimmick('drain', {
  plan(L, { rooms, start, boss, itemRoom, rnd, solve }) {
    const cand = rnd.shuffle(Object.values(rooms).filter(r => !r.hidden && r !== start && r !== boss && r !== itemRoom && !r.intro));
    // one spiral, in a room that has something to win if possible
    const spiralAt = cand.find(r => r.key || r.map || r.compass) || cand[0];
    const toBow = new Set(); for (let r = itemRoom; r; r = r.parent) toBow.add(r); // the rooms on the way to the bow stay bow-free
    for (const r of cand) {
      if (r === spiralAt) { r.drain = 'spiral'; continue; }
      const roll = rnd(); const prize = r.key || r.map || r.compass; const off = !toBow.has(r);
      if (prize) r.drain = off && roll < 0.7 ? 'moat' : roll < 0.85 ? 'switch' : 'pool';
      else r.drain = off && roll < 0.6 ? 'channel' : roll < (off ? 0.75 : 0.4) ? 'pool' : null;
    }
    for (const r of cand) r.needsBow = r.drain === 'channel' || r.drain === 'moat' ? r.drain : null;
    // the bow has to be reachable without it: soften bow rooms (key rooms first) until it is
    const bowRooms = () => cand.filter(r => r.needsBow).sort((a, b) => (b.key ? 1 : 0) - (a.key ? 1 : 0) || rnd() - 0.5);
    while (!solve(false).has(itemRoom.id) && bowRooms().length) { const r = bowRooms()[0]; r.drain = r.drain === 'moat' ? 'switch' : null; r.needsBow = null; }
  },
  room(L, r, { rnd, set, ix, iy }) {
    const kind = r.drain; if (!kind) return false;
    if (kind === 'pool') {
      for (let y = 2; y <= 6; y++) for (let x = 2; x <= 10; x++) if (!(y === 2 || y === 6) || (x > 3 && x < 9)) set(x, y, 'SHALLOW');
      return true;
    }
    if (kind === 'switch' || kind === 'moat') {
      const cells = []; for (let x = 3; x <= 9; x++) cells.push([x, 2], [x, 6]); for (let y = 3; y <= 5; y++) cells.push([3, y], [9, y]);
      if (kind === 'switch') { for (const [x, y] of cells) set(x, y, 'WATER'); const [sx, sy] = rnd.pick([[1, 1], [11, 1], [1, 7], [11, 7]]); set(sx, sy, 'SWITCH'); }
      else rig(L, r, ix, iy, cells, [[6, 3]]); // the eye sits on the island, facing every shore
      return true;
    }
    if (kind === 'spiral') {
      const cells = [], eyes = [];
      SPIRAL.forEach((row, y) => [...row].forEach((c, x) => { if (c === '~') cells.push([x + 1, y + 1]); if (c === 'E') eyes.push([x + 1, y + 1]); }));
      rig(L, r, ix, iy, cells, eyes);
      r.rewardAt = [6.5, 5.5]; if (!(r.key || r.map || r.compass)) r.reward = 'gems50';
      r.custom = { enemies: ['bat', 'bat', 'bat'], at: [[2.5, 4.5], [6.5, 2.5], [10.5, 5.5]], shutter: true };
      return true;
    }
    if (kind === 'channel') { // two rows (or columns) of deep water between the way in and everything else
      // The eye plugs one end of the channel with open water beside it, so you can see it from either bank.
      const p = r.parent; const dx = p.rx - r.rx, dy = p.ry - r.ry; const cells = []; let eye;
      if (dy > 0) { for (let x = 2; x <= 11; x++) cells.push([x, 5], [x, 6]); cells.push([1, 6]); eye = [1, 5]; } // came in from the south
      else if (dy < 0) { for (let x = 2; x <= 11; x++) cells.push([x, 2], [x, 3]); cells.push([1, 2]); eye = [1, 3]; } // from the north
      else if (dx < 0) { for (let y = 2; y <= 7; y++) cells.push([2, y], [3, y]); cells.push([3, 1]); eye = [2, 1]; } // from the west
      else { for (let y = 2; y <= 7; y++) cells.push([9, y], [10, y]); cells.push([9, 1]); eye = [10, 1]; } // from the east
      rig(L, r, ix, iy, cells, [eye]);
      return true;
    }
    return false;
  },
  update(sim, L) { // floor switches drain their room for good
    for (const p of Object.values(sim.players)) {
      if (!p.alive || p.lvl !== L.id || sim.flying(p)) continue; // fliers don't press switches
      const tx = Math.floor(p.x), ty = Math.floor(p.y); const i = L.idx(tx, ty);
      if (L.tiles[i] !== TL.SWITCH) continue;
      sim.setTile(L.id, i, TL.SWITCH_DOWN);
      const room = dungeonRoomAt(L, p.x, p.y); if (!room) continue;
      for (let y = room.ry * DSY + 1; y < room.ry * DSY + DSY; y++) for (let x = room.rx * DSX + 1; x < room.rx * DSX + DSX; x++) if (L.get(x, y) === TL.WATER) sim.setTile(L.id, L.idx(x, y), TL.WET);
      sim.sfx('drain', L.id); sim.hint(p, 'THE WATER DRAINS AWAY.');
    }
  },
});
