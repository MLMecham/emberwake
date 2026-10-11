// ===== content/gimmicks/glass.js : glass floors crack when you stand on them, then break into a pit for a few seconds =====
'use strict';
defineTexture('glass', (x, y, r, th, ctx) => { const g = ((x + y) % 11 === 0) ? [255, 255, 255] : ((x - y + 64) % 17 === 0) ? [210, 240, 250] : [150, 210, 230]; return ctx.vary(g, x, y, 0.08); }, { themed: true });
defineTexture('glass_cracked', (x, y, r, th, ctx) => { const crack = Math.abs((x - 16) - Math.sin(y * 0.4) * 6) < 0.8 || Math.abs((y - 12) - Math.sin(x * 0.5) * 5) < 0.8; return crack ? [40, 60, 70] : ctx.vary([150, 200, 220], x, y, 0.15); }, { themed: true });
defineTexture('pit', (x, y) => { const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5)); return d > 14 ? [40, 50, 60] : [4, 4, 8]; });
// pit: falling in costs a heart and puts you back where you last stood safely
defineTile('GLASS', { floor: 'glass', glass: true });
defineTile('GLASS_CRACKED', { floor: 'glass_cracked', glass: true });
defineTile('PIT', { floor: 'pit', pit: true });
const CRACK_AT = 0.6, BREAK_AT = 1.2, REFORM_AFTER = 8, SETTLE = 0.5; // seconds; SETTLE: how fast an empty, uncracked pane recovers
defineGimmick('glass', {
  room(L, r, { rnd, set }) {
    if (rnd() < 0.5) return false;
    for (let y = 3; y <= 5; y++) for (let x = 4; x <= 8; x++) set(x, y, 'GLASS');
    return false; // blocks may still be added on top
  },
  // Hand-built opening for a dungeon with intro: 'glass' (Tideglass Halls). Room 1 teaches that glass holds
  // while you keep moving; room 2 hides the key on an island in a pit, reached by a glass branch,
  // and the door onward is locked. Skeletons patrol the ledge (knock them into the pit), a bat hovers over it.
  intro: {
    start(L, r, { set, prop, sign }) {
      for (let y = 3; y <= 4; y++) for (let x = 1; x <= 11; x++) set(x, y, x >= 5 && x <= 7 ? 'GLASS' : 'PIT');
      prop(3, 6, PR.SIGN); sign(3, 6, 'THE GLASS HOLDS FOR TWO HEARTBEATS. KEEP WALKING AND IT WILL CARRY YOU. STAND STILL AND IT WILL NOT. BROKEN GLASS MENDS ITSELF IN TIME.');
    },
    room(L, r, { set, rnd, d }) {
      for (let y = 2; y <= 5; y++) for (let x = 1; x <= 11; x++) set(x, y, 'PIT');
      for (let y = 2; y <= 5; y++) set(6, y, 'GLASS'); // bridge to the locked door
      set(7, 3, 'GLASS'); set(8, 3, 'GLASS'); // branch to the island
      for (let y = 3; y <= 4; y++) for (let x = 9; x <= 10; x++) set(x, y, 'DFLOOR'); // the island
      r.looseKey = [10, 4];
      const foot = enemiesFor('dungeons', d).filter(t => !enemyDef(t).fly && !enemyDef(t).shield);
      const g = foot.includes('skeleton') ? 'skeleton' : (foot[0] || 'skeleton');
      r.enemies = ['bat', g, g]; r.at = [[3.5, 3.5], [3.5, 6.5], [9.5, 6.5]]; r.shutter = false;
    },
  },
  update(sim, L, dt) {
    L.glassT = L.glassT || {}; L.pits = L.pits || {};
    const under = new Set();
    for (const p of Object.values(sim.players)) {
      if (!p.alive || p.lvl !== L.id || sim.flying(p)) continue; // fliers don't touch the glass
      const i = L.idx(Math.floor(p.x), Math.floor(p.y)); const t = L.tiles[i];
      if (!TINFO[t].glass) continue;
      if (under.has(i)) continue; under.add(i); // two heroes on one pane don't crack it twice as fast
      L.glassT[i] = (L.glassT[i] || 0) + dt;
      if (t === TL.GLASS && L.glassT[i] > CRACK_AT) { sim.setTile(L.id, i, TL.GLASS_CRACKED); sim.sfx('clink', L.id, p.x, p.y); }
      else if (t === TL.GLASS_CRACKED && L.glassT[i] > BREAK_AT) { sim.setTile(L.id, i, TL.PIT); L.pits[i] = sim.time; sim.sfx('shutter', L.id, p.x, p.y); }
    }
    // a pane nobody is standing on settles again (until it has cracked), so a party can cross a bridge one by one
    for (const i in L.glassT) if (!under.has(+i) && L.tiles[+i] === TL.GLASS && L.glassT[i] > 0) L.glassT[i] = Math.max(0, L.glassT[i] - dt * SETTLE);
    for (const i in L.pits) if (sim.time - L.pits[i] > REFORM_AFTER) { sim.setTile(L.id, +i, TL.GLASS); delete L.pits[i]; L.glassT[i] = 0; }
  },
});
