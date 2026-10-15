// ===== content/gimmicks/webs.js : the Silkwood's webs (dungeon 13) =====
// WEB        sticky web on the floor: you wade through it at half speed. Fire burns it away.
// WEBDOOR    a curtain of web over a doorway. Only fire opens it.
// SILK       old silk carpeting a whole room. One spark and it ALL goes up, tile to tile (game/sim.js igniteSilk + update
//            below): whatever stands on it burns hard (foes, egg sacs, webs, and you). Light it from the doorway, or run.
//            A Cinder Ring wearer walks through it (burning ground can't touch them).
// WEBBRIDGE  web strung over a pit: it holds you, but fire drops it into the pit. It grows back after a while.
// WEBLINE    a strand across a corridor at chest height. Walk into it and you're stuck (game/sim.js webbed); after a
//            moment you can slash yourself free, and that brings the spiders down from the ceiling.
// EGGSAC     hatches spiderlings when someone comes close, unless it's burned first.
// COCOON     something wrapped and hung up. Cut it open.
// WEBSEAL    the far way out of the boss room, webbed shut until the Broodmother dies (the shortcut, game/world.js).
'use strict';
defineTexture('webfloor', (x, y, r, th, ctx) => {
  const s = Math.abs(((x + y) % 9) - 4) < 0.6 || Math.abs(((x - y + 64) % 11) - 5) < 0.6 || Math.abs(Math.hypot(x - 16, y - 16) % 7 - 3.5) < 0.5;
  if (s) return ctx.vary([228, 226, 236], x, y, 0.08);
  const e = (x & 15) === 0 || (y & 15) === 0; return ctx.vary(e ? th.edge : th.floor, x, y, 0.15);
}, { themed: true });
defineTexture('silkfloor', (x, y, r, ctx) => { const n = ctx.n8(x >> 1, y >> 1); return ctx.vary(n > 0.7 ? [236, 232, 220] : n < 0.25 ? [180, 174, 164] : [212, 206, 194], x, y, 0.1); });
defineTexture('silkfire', (x, y, r, f, ctx) => { const w = Math.sin((x + f * 5) * 0.5 + Math.sin(y * 0.4 - f) * 1.8) + Math.sin(y * 0.6 + f * 2); return w > 1.1 ? [255, 236, 120] : w > 0.2 ? [250, 130, 30] : w > -0.6 ? [200, 50, 20] : [70, 30, 20]; }, { frames: 4 });
defineTexture('charred', (x, y, r, ctx) => { const n = ctx.n4(x, y); return n > 0.93 ? [120, 60, 30] : ctx.vary(n > 0.5 ? [40, 34, 32] : [26, 22, 22], x, y, 0.2); });
defineTexture('webbridge', (x, y) => { const s = Math.abs(((x + y) % 8) - 4) < 0.7 || Math.abs(((x - y + 64) % 8) - 4) < 0.7 || (y % 10) === 3; return s ? [220, 218, 228] : [6, 6, 10]; });
defineTexture('webcurtain', (x, y, r, th, ctx) => { // an orb web across the doorway, dark beyond it
  const dx = x - 15.5, dy = y - 14.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  const spoke = Math.abs(((a / (Math.PI / 6)) % 1 + 1) % 1 - 0.5) > 0.5 - 0.5 / Math.max(1, d * 0.35);
  const ring = d > 2 && Math.abs((d + Math.sin(a * 6) * 0.6) % 4.2 - 2.1) < 0.45;
  if (d < 2 || spoke || ring) return ctx.vary(d > 13 ? [170, 168, 180] : [228, 226, 236], x, y, 0.06);
  return ctx.vary([14, 12, 20], x, y, 0.3);
}, { themed: true });
defineTexture('webseal', (x, y, r, th, ctx) => { const s = ctx.n4(x, y) > 0.35 || Math.abs(((x + y) % 5) - 2.5) < 0.9; return s ? ctx.vary([238, 236, 242], x, y, 0.06) : ctx.vary(th.mortar, x, y, 0.2); }, { themed: true });
defineTile('WEB', { floor: 'webfloor', sticky: true, burnable: true, opensTo: 'DFLOOR' });
defineTile('SILK', { floor: 'silkfloor', silk: true });
defineTile('SILK_BURNING', { floor: 'silkfire', hurt: 1, hurtDmg: 3, fire: true });
defineTile('CHARRED', { floor: 'charred' });
defineTile('WEBBRIDGE', { floor: 'webbridge', burnable: true, opensTo: 'PIT' });
defineTile('WEBDOOR', { solid: true, wall: 'webcurtain', floor: 'dfloor', burnable: true, opensTo: 'OPENDOOR' });
defineTile('WEBSEAL', { solid: true, wall: 'webseal', sealedMsg: 'THICK OLD WEB SEALS THIS WAY. SOMETHING BIG SPUN IT, AND IT WON\'T BURN.' });

// the Silkwood's far mouth out in the Wilds: webbed shut until the Broodmother dies, then a way in (game/world.js genSilkPlaces)
const archTex = (sealed) => (x, y, r, ctx) => { const dx = (x - 15.5) / 10, dy = (y - 31) / 24; const d = dx * dx + dy * dy;
  if (d < 1) { const strand = Math.abs(((x + y) % 7) - 3.5) < 0.7 || Math.abs(((x - y + 64) % 7) - 3.5) < 0.7; if (sealed) return strand || ctx.n4(x, y) > 0.4 ? [230, 228, 236] : [40, 36, 44]; return strand && y < 14 ? [200, 198, 210] : [10, 8, 14]; }
  return ctx.texPx('rock', x, y); };
defineTexture('silkrock_sealed', archTex(true));
defineTexture('silkrock', archTex(false));
defineTile('SILKSEAL', { solid: true, wall: 'silkrock_sealed', sealedMsg: 'A CAVE MOUTH CHOKED WITH OLD WEB, THICK AS ROPE. SOMETHING ON THE OTHER SIDE KEEPS IT THAT WAY.' });
defineTile('SILKCAVE', { solid: true, wall: 'silkrock', portal: true });
defineSprite('webline', [
  '................', '................', '................', '................', '................', '................',
  'w..............w', '.ww..........ww.', '...wwwwwwwwww...', '.......w........', '................',
  '................', '................', '................', '................', '................']);
defineSprite('eggsac', [
  '................', '................', '................', '................', '................',
  '.......ww.......', '......wzzw......', '.....wzwzzw.....', '....wzzzzwzw....', '....wzwzzzzw....', '...wzzzzwzzzw...', '...wzzwzzzzzw...',
  '....wzzzzwzw....', '.....wwzzzw.....', '.......ww.......', '................']);
defineSprite('cocoon', [
  '.......ww.......', '.......w........', '......www.......', '.....wzzzw......', '....wzzwzzw.....', '....wzwzzzw.....', '....wzzzzwzw....', '....wzzwzzzw....',
  '....wzzzzwzw....', '....wzwzzzzw....', '.....wzzzwzw....', '.....wzzzzw.....', '......wzzw......', '.......ww.......', '................', '................']);
defineProp('WEBLINE', 'webline', { solid: false, scale: 1.0 });
defineProp('EGGSAC', 'eggsac', { solid: true, scale: 0.8, round: true });
defineProp('COCOON', 'cocoon', { solid: true, scale: 1.2, round: true });

const HATCH_R = 2.2, BRIDGE_REGROW = 20, SPREAD = 0.22, BURN_FOR = 2.5;
defineGimmick('webs', {
  // some doorways are curtained with web (fire opens them)
  doors(L, doors, { rnd }) { for (const dr of doors) if (dr.t === TL.OPENDOOR && rnd() < 0.3) { L.set(dr.x, dr.y, TL.WEBDOOR); dr.a.links[dr.b.id] = dr.b.links[dr.a.id] = dr.t = TL.WEBDOOR; } },
  room(L, r, { rnd, set, prop, lane, ix, iy }) {
    const at = (x, y) => L.get(ix + x, iy + y);
    const k = rnd();
    if (k < 0.22) { // a silk room, sometimes with a spider carrying an ember
      for (let y = 1; y < DSY; y++) for (let x = 1; x < DSX; x++) if (at(x, y) === TL.DFLOOR) set(x, y, 'SILK');
      r.silk = true; if (rnd() < 0.55) r.enemies.push('spider_ember');
      if (!L.silkTaught) { L.silkTaught = true; r.silkSign = true; }
    } else if (k < 0.4) { // a pit crossed by web bridges along the room's cross
      L.webBridges = L.webBridges || [];
      for (let y = 3; y <= 5; y++) for (let x = 1; x < DSX; x++) { if (lane(x, y)) { set(x, y, 'WEBBRIDGE'); L.webBridges.push(L.idx(ix + x, iy + y)); } else set(x, y, 'PIT'); }
    } else if (k < 0.58) { for (const [x, y] of rnd.shuffle([[3, 2], [9, 2], [3, 6], [9, 6], [2, 4], [10, 4]]).slice(0, 3 + rnd.int(2))) prop(x, y, PR.EGGSAC); }
    else if (k < 0.7) { for (const [x, y] of rnd.shuffle([[2, 2], [10, 2], [2, 6], [10, 6]]).slice(0, 2)) prop(x, y, PR.COCOON); }
    else { for (let i = 0; i < 10; i++) { const x = 1 + rnd.int(11), y = 1 + rnd.int(7); if (at(x, y) === TL.DFLOOR) set(x, y, 'WEB'); } }
    // a strand across one doorway, just inside it
    if (rnd() < 0.3) { const spots = [[1, 4, 0, 4], [11, 4, DSX, 4], [6, 1, 6, 0], [6, 7, 6, DSY]].filter(([, , dx, dy]) => TINFO[L.get(ix + dx, iy + dy)].floor && !TINFO[L.get(ix + dx, iy + dy)].solid);
      if (spots.length) { const [x, y] = rnd.pick(spots); if (at(x, y) === TL.DFLOOR) prop(x, y, PR.WEBLINE); } }
    if (r.silkSign) { set(6, 1, 'DFLOOR'); prop(5, 1, PR.SIGN); L.signText = L.signText || {}; L.signText[L.idx(ix + 5, iy + 1)] = 'OLD SILK, DRY AS TINDER. ONE SPARK AND ALL OF IT BURNS. WHATEVER STANDS ON IT TOO.'; }
    return true;
  },
  arena(L, r, { rnd, set }) { for (let i = 0; i < 6; i++) { const x = 1 + rnd.int(11), y = 1 + rnd.int(7); if (L.get(r.rx * DSX + x, r.ry * DSY + y) === TL.DFLOOR) set(x, y, 'WEB'); } },
  // a little spider hides in three rooms (enemies/silk.js PIP); and the way out beyond the boss, sealed until she's dead
  level(L, { rnd }) {
    L.ceilH = 2; // the Silkwood is two tiles tall: the droppers hang well over your head (and the Gale Cloak lifts you a level)
    const rooms = Object.values(L.rooms).filter(r => !r.boss && !r.hidden && r !== L.startRoom); for (const r of rnd.shuffle(rooms).slice(0, 3)) r.enemies.push('spider_pip');
    const boss = Object.values(L.rooms).find(r => r.boss); if (!boss) return; const x0 = boss.rx * DSX, y0 = boss.ry * DSY;
    const free = (dx, dy) => !L.rooms[(boss.ry + dy) * DGW + boss.rx + dx] && boss.rx + dx >= 0 && boss.ry + dy >= 0 && boss.rx + dx < DGW && boss.ry + dy < DGH;
    const sides = [[1, 0, x0 + DSX, y0 + 4, -1, 0], [-1, 0, x0, y0 + 4, 1, 0], [0, -1, x0 + 6, y0, 0, 1], [0, 1, x0 + 6, y0 + DSY, 0, -1]].filter(([dx, dy]) => free(dx, dy));
    const s = sides[0]; if (!s) return; const [, , sx, sy, ix, iy] = s;
    L.set(sx, sy, TL.WEBSEAL); L.passSeal = L.idx(sx, sy); L.passIn = { x: sx + ix * 1.5 + 0.5, y: sy + iy * 1.5 + 0.5, a: Math.atan2(iy, ix) };
  },
  update(sim, L, dt) {
    // burning silk spreads to the silk (and web) beside it, then burns out to char
    for (const k in L.silkFire || {}) {
      const i = +k, t0 = L.silkFire[k]; const x = i % L.w, y = Math.floor(i / L.w);
      if (!L.silkSpread[k] && sim.time - t0 > SPREAD) { L.silkSpread[k] = true; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = L.idx(x + dx, y + dy); const tj = TINFO[L.tiles[j]]; if (tj.silk || L.tiles[j] === TL.WEB) sim.igniteSilk(L, j); } }
      if (sim.time - t0 > BURN_FOR) { sim.setTile(L.id, i, TL.CHARRED); delete L.silkFire[k]; delete L.silkSpread[k]; }
    }
    // egg sacs hatch when a hero comes close (unless the hero is high on the cloak)
    for (const p of Object.values(sim.players)) {
      if (!p.alive || p.lvl !== L.id) continue; const cx = Math.floor(p.x), cy = Math.floor(p.y);
      for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) { const i = L.idx(x, y); if (L.props[i] === PR.EGGSAC && dist2(x + 0.5, y + 0.5, p.x, p.y) < HATCH_R * HATCH_R) sim.hatchEggs(L, i); }
    }
    for (const k in L.eggTimers || {}) if (sim.time > L.eggTimers[k]) { delete L.eggTimers[k]; if (L.props[+k] === PR.EGGSAC) sim.hatchEggs(L, +k); } // the Broodmother's eggs hatch on their own
    // burned web bridges grow back once nobody's in the way
    for (const i of L.webBridges || []) {
      if (L.tiles[i] === TL.PIT) { L.bridgeT = L.bridgeT || {}; if (L.bridgeT[i] == null) L.bridgeT[i] = sim.time + BRIDGE_REGROW; else if (sim.time > L.bridgeT[i]) { sim.setTile(L.id, i, TL.WEBBRIDGE); delete L.bridgeT[i]; } }
    }
  },
});
