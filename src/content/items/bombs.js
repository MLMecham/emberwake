// ===== content/items/bombs.js : bombs blow up cracked walls and hurt everything nearby =====
// Martial artist version: NOVA ORB, a bigger, stronger blast.
'use strict';
defineItem({
  id: 'bombs', name: 'BOMBS', sprite: 'bomb', monk: { name: 'NOVA ORB', sprite: 'ki' }, slot: 'b', order: 2,
  owned: (p) => !!p.items.bombs || p.bombs > 0,
  full: (p) => p.bombs >= p.maxBombs, // shops won't sell bombs you can't carry
  give(sim, p, ctx) { p.bombs = Math.min(p.maxBombs, p.bombs + 4); p.items.bombs = true; ctx.banner(); }, // bought in a shop
  use(sim, p) {
    if (p.bombs <= 0) return sim.hint(p, 'NO BOMBS.');
    if (sim.ents.filter(e => e.k === 'bomb' && e.pid === p.id).length >= 2) return; // two on the ground at most
    const L = sim.W.levels[p.lvl]; const fx = p.x + Math.cos(p.a) * 0.6, fy = p.y + Math.sin(p.a) * 0.6; const blocked = L.solidAt(fx, fy);
    const nova = p.cls === 'monk'; p.bombs--;
    sim.spawn({ k: 'bomb', lvl: p.lvl, x: blocked ? p.x : fx, y: blocked ? p.y : fy, fuse: 1.4, pid: p.id, spr: nova ? 'ki' : 'bomb', sc: 0.6, z: nova ? 0.2 : 0, nova });
    sim.sfx('place', p.lvl);
  },
});
// dropped by enemies
defineItem({ id: 'bomb', name: 'BOMBS', sprite: 'bomb', give(sim, p) { p.bombs = Math.min(p.maxBombs, p.bombs + 4); sim.sfx('gem', p.lvl); } });
// Without a bag you can carry 1 bomb (game/sim.js bombCap). Dungeon 2 treasure: carry 8, shared with the party.
defineItem({
  id: 'bombbag', name: 'BOMB BAG', sprite: 'bomb', team: true, debug: true,
  give(sim, p, ctx) { p.items.bombs = true; p.items.bombbag = true; p.maxBombs = bombCap(p); p.bombs = Math.max(p.bombs, 8); ctx.banner(); },
  debugGrant(p) { p.items.bombs = true; p.items.bombbag = true; },
});
// the second bag, sold in a hidden grotto shop (content/caves.js 'bombshop'): carry 16
defineItem({
  id: 'bombbag2', name: 'BIG BOMB BAG', sprite: 'bomb', team: true, debug: true,
  full: (p) => !!p.items.bombbag2, // the shop won't sell it twice
  give(sim, p, ctx) { p.items.bombs = true; p.items.bombbag2 = true; p.maxBombs = bombCap(p); p.bombs = p.maxBombs; ctx.banner(); },
  debugGrant(p) { p.items.bombs = true; p.items.bombbag2 = true; },
});
defineEntity('bomb', {
  update(sim, e, dt) {
    e.fuse -= dt; if (e.fuse > 0) return;
    e.dead = true; const L = sim.W.levels[e.lvl]; const R = e.nova ? 2.4 : 1.7;
    sim.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: 'boom', life: 0.45, sc: R, z: 0.2 });
    sim.sfx('boom', e.lvl, e.x, e.y); sim.ev({ t: 'shake', lvl: e.lvl, x: e.x, y: e.y });
    // armored foes lose a piece of armor instead of taking damage, the first time a bomb (or bomb arrow) gets them
    for (const en of sim.ents) if (en.k === 'en' && en.lvl === e.lvl && !en.dead && dist2(en.x, en.y, e.x, e.y) < R * R) { if (en.armor > 0 && sim.stripArmor(en, 'bomb', e)) continue; sim.damageEnemy(en, e.nova ? 6 : 4, e, { pid: e.pid, pierceShield: true, ignoreIframes: true }); } // a blast always lands, even right after another hit (a bomb arrow's own arrow)
    // crack open bombable walls in range
    const tx = Math.floor(e.x), ty = Math.floor(e.y); let found = false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const bx = tx + dx, by = ty + dy; if (bx < 0 || by < 0 || bx >= L.w || by >= L.h) continue;
      if (dist2(bx + 0.5, by + 0.5, e.x, e.y) > (R * 0.9) ** 2) continue;
      const i = L.idx(bx, by); const t = L.tiles[i];
      sim.openHollowTree(L, bx + 0.5, by + 0.5); // a hollow tree splits open (content/grottos.js)
      if (TINFO[t].bomb) { let nt = TINFO[t].opensTo ? TL[TINFO[t].opensTo] : TL.OPENDOOR; if (t === TL.ROCK_BOMB) nt = (L.secretReveal[i] && L.secretReveal[i].tile) || TL.CAVE; if (t === TL.CWALL_BOMB) nt = TL.CFLOOR; sim.setTile(L.id, i, nt); found = true; }
    }
    if (found) sim.sfx('secret', L.id);
  },
});
