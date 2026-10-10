// ===== content/gimmicks/glass.js : glass floors crack when you stand on them, then break into a pit for a few seconds =====
'use strict';
defineTexture('glass', (x, y, r, th, ctx) => { const g = ((x + y) % 11 === 0) ? [255, 255, 255] : ((x - y + 64) % 17 === 0) ? [210, 240, 250] : [150, 210, 230]; return ctx.vary(g, x, y, 0.08); }, { themed: true });
defineTexture('glass_cracked', (x, y, r, th, ctx) => { const crack = Math.abs((x - 16) - Math.sin(y * 0.4) * 6) < 0.8 || Math.abs((y - 12) - Math.sin(x * 0.5) * 5) < 0.8; return crack ? [40, 60, 70] : ctx.vary([150, 200, 220], x, y, 0.15); }, { themed: true });
defineTexture('pit', (x, y) => { const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5)); return d > 14 ? [40, 50, 60] : [4, 4, 8]; });
// pit: falling in costs a heart and puts you back where you last stood safely
defineTile('GLASS', { floor: 'glass', glass: true });
defineTile('GLASS_CRACKED', { floor: 'glass_cracked', glass: true });
defineTile('PIT', { floor: 'pit', pit: true });
const CRACK_AT = 0.6, BREAK_AT = 1.2, REFORM_AFTER = 8;
defineGimmick('glass', {
  room(L, r, { rnd, set }) {
    if (rnd() < 0.5) return false;
    for (let y = 3; y <= 5; y++) for (let x = 4; x <= 8; x++) set(x, y, 'GLASS');
    return false; // blocks may still be added on top
  },
  update(sim, L, dt) {
    L.glassT = L.glassT || {}; L.pits = L.pits || {};
    for (const p of Object.values(sim.players)) {
      if (!p.alive || p.lvl !== L.id) continue;
      const i = L.idx(Math.floor(p.x), Math.floor(p.y)); const t = L.tiles[i];
      if (!TINFO[t].glass) continue;
      L.glassT[i] = (L.glassT[i] || 0) + dt;
      if (t === TL.GLASS && L.glassT[i] > CRACK_AT) { sim.setTile(L.id, i, TL.GLASS_CRACKED); sim.sfx('clink', L.id, p.x, p.y); }
      else if (t === TL.GLASS_CRACKED && L.glassT[i] > BREAK_AT) { sim.setTile(L.id, i, TL.PIT); L.pits[i] = sim.time; sim.sfx('shutter', L.id, p.x, p.y); }
    }
    for (const i in L.pits) if (sim.time - L.pits[i] > REFORM_AFTER) { sim.setTile(L.id, +i, TL.GLASS); delete L.pits[i]; L.glassT[i] = 0; }
  },
});
