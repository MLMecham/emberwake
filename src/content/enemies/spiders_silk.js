// ===== content/enemies/spiders_silk.js (loads after spider.js) : the Silkwood's spiders (dungeon 13) and the Broodmother =====
// SPIDERLING   small and quick, comes in swarms (egg sacs, the Broodmother, cut strands)
// CRAWLER      the common one: lunges
// SPITTER      keeps away and spits web globs: you wade for a moment (projectiles.js 'webglob')
// DROPPER      hangs on the ceiling until you pass under; its shadow shows where it lands
// EMBERBACK    carries a live ember. If it walks onto silk, the room burns, with you in it. Kill it on bare stone:
//              if it dies on silk, the ember falls and lights it anyway.
// PIP          the little one. Harmless. Plays dead when you swing at it, then pops back up and waves. It steals a gem
//              if it can. Leave it alone through the whole dungeon and it's waiting after the Broodmother, with everything
//              it took and a little something besides. (neutral: never holds a room shut)
// BROODMOTHER  the boss: she climbs up into the dark and drops where her shadow is, strings web across the floor, lays
//              eggs (burn them), and wraps anyone who stands still (game/sim.js webbed).
// All are spiderkin: they roll only the spider elites (content/elites.js).
'use strict';
const HANG_Z = 1.55; // how high a dropper hangs (the Silkwood is two tiles tall, gimmicks/webs.js)
const SPIDER_ROWS = enemyDef('spider').sprite; // the old cave spider's body, recolored for each
const legs = { fps: 9, frames: (s, kit) => [s, kit.shearRows(kit.shearRows(s, 2, 5, 1), 10, 13, -1), kit.shearRows(kit.shearRows(s, 2, 5, -1), 10, 13, 1)] };
const kin = (o) => defineEnemy(Object.assign({ spiderkin: true, anim: legs, spawns: { dungeons: [13] } }, o));
kin({ id: 'spiderling', title: 'SPIDERLING', hp: 1, spd: 3.6, dmg: 1, r: 0.26, sc: 0.55, ai: AI.lunge(0.35, 0.35, 0.8), sprite: SPIDER_ROWS, pal: { G: '#8a7a90', r: '#ff4040' } });
kin({ id: 'spider_crawler', title: 'CRAWLER', hp: 3, spd: 3.0, dmg: 2, r: 0.42, sc: 1.0, ai: AI.lunge(0.5, 0.6, 1.2), sprite: SPIDER_ROWS, pal: { G: '#4a3a5a', r: '#ffd040' } });
kin({ id: 'spider_spitter', title: 'SPITTER', hp: 3, spd: 1.6, dmg: 1, r: 0.4, sc: 0.95, ai: AI.shooter('webglob'), sprite: SPIDER_ROWS, pal: { G: '#3e5a4a', r: '#e0ffe0' } });
// DROPPER: st 0 = on the ceiling (out of reach); st 1 = falling toward (tx, ty) after tm; then a crawler
kin({ id: 'spider_ceiling', title: 'DROPPER', hp: 3, spd: 3.0, dmg: 2, r: 0.42, sc: 1.0, sprite: SPIDER_ROWS, pal: { G: '#2a2430', r: '#ff2020' }, spawns: { dungeons: [13] },
  view: (e) => e.hz || 0,
  ai(sim, e, dt, ctx) {
    const { p } = ctx;
    if (e.st === 0) { e.air = true; e.hz = HANG_Z; if (p && dist2(p.x, p.y, e.x, e.y) < 2.6 * 2.6) { e.st = 1; e.tm = 0.8; e.tx = p.x; e.ty = p.y; } return; }
    if (e.st === 1) { // the shadow first, then down
      e.air = true; if (!e.shadow) { e.shadow = true; sim.spawn({ k: 'fx', lvl: e.lvl, x: e.tx, y: e.ty, spr: 'shadowring', life: Math.max(0.3, e.tm), sc: 1.0, z: -0.35 }); sim.sfx('skitter', e.lvl, e.tx, e.ty); }
      e.x += (e.tx - e.x) * Math.min(1, dt * 6); e.y += (e.ty - e.y) * Math.min(1, dt * 6); e.hz = HANG_Z * Math.max(0, Math.min(1, e.tm / 0.7));
      if (e.tm > 0) return; e.st = 2; e.air = false; e.hz = 0; sim.ev({ t: 'shake', lvl: e.lvl, x: e.x, y: e.y });
      for (const pl of Object.values(sim.players)) if (pl.alive && pl.lvl === e.lvl && dist2(pl.x, pl.y, e.x, e.y) < 0.9) sim.hurtPlayer(pl, 2 * e.dmgMul, e);
      return;
    }
    AI.lunge(0.5, 0.6, 1.2)(sim, e, dt, ctx);
  },
});
// EMBERBACK: wanders; silk under it catches
const EMBER_ROWS = SPIDER_ROWS.map((r, y) => y === 0 ? '......yo........' : y === 1 ? '.....oyyo.......' : r);
kin({ id: 'spider_ember', title: 'EMBERBACK', hp: 2, spd: 1.8, dmg: 1, r: 0.38, sc: 0.85, sprite: EMBER_ROWS, pal: { G: '#5a2a1a', r: '#ffd040' }, elem: 'fire', spawns: {},
  ai(sim, e, dt, ctx) {
    AI.flutter(sim, e, dt, ctx); const L = sim.W.levels[e.lvl]; const i = L.idx(Math.floor(e.x), Math.floor(e.y));
    if (TINFO[L.tiles[i]].silk) sim.igniteSilk(L, i);
  },
  onDeath(sim, e) { const L = sim.W.levels[e.lvl]; const i = L.idx(Math.floor(e.x), Math.floor(e.y)); if (TINFO[L.tiles[i]].silk) sim.igniteSilk(L, i); },
});
// PIP: harmless; plays dead, steals a gem, waves
const PIP_ROWS = [
  '................', '................', '................', '................', '................', '................',
  '.....k....k.....',
  '......k..k......',
  '....kkkkkkkk....',
  '...kGwkGGwkGk...',
  '..k.kGGGGGGk.k..',
  '.k..kGGmmGGk..k.',
  '.k...kkkkkk...k.',
  '..k..k....k..k..',
  '................', '................'];
defineSprite('spider_pip_dead', [ // legs in the air
  '................', '................', '................', '................', '................', '................', '................',
  '..k..k....k..k..', '.k...kkkkkk...k.', '.k..kGGGGGGk..k.', '..k.kGkkGkkk.k..', '...kGGGGGGGGk...', '....kkkkkkkk....', '................', '................', '................']);
defineSprite('spider_pip_wave', [ // front legs up, waving
  '................', '................', '................', '..k..........k..', '...k........k...', '....k......k....',
  '.....k....k.....', '......k..k......', '....kkkkkkkk....', '...kGwkGGwkGk...', '....kGGGGGGk....', '....kGGmmGGk....', '.....kkkkkk.....', '..k..k....k..k..', '................', '................']);
kin({ id: 'spider_pip', title: 'PIP', hp: 99, spd: 3.2, dmg: 0, r: 0.24, sc: 0.5, neutral: true, noElites: ['silkweaver', 'widow', 'broodsac', 'hush'], spawns: {}, sprite: PIP_ROWS, pal: { G: '#a08cb0' },
  sprFor: (e) => e.deadT > 0 ? 'spider_pip_dead' : e.waveT > 0 ? 'spider_pip_wave' : null,
  onDamage(sim, e) { if (!(e.deadT > 0)) { e.deadT = 2.2; e.waveT = 0; sim.team.pipHit = true; sim.sfx('pipsqueak', e.lvl, e.x, e.y); } return false; }, // never actually hurt: it just plays dead
  ai(sim, e, dt, { p, spd, def }) {
    if (e.deadT > 0) { e.deadT -= dt; if (e.deadT <= 0) e.waveT = 1.4; return; }
    if (e.waveT > 0) { e.waveT -= dt; return; }
    if (p && !e.stole && p.gems > 0 && dist2(p.x, p.y, e.x, e.y) < 0.55) { e.stole = true; p.gems--; sim.team.pipGems = (sim.team.pipGems || 0) + 1; sim.sfx('gem', e.lvl, e.x, e.y); sim.hint(p, 'SOMETHING TINY JUST TOOK A GEM.'); e.fleeT = 3; }
    if (e.fleeT > 0 && p) { e.fleeT -= dt; const a = Math.atan2(e.y - p.y, e.x - p.x); sim.moveEnt(e, Math.cos(a) * spd * dt, Math.sin(a) * spd * dt, def); return; }
    if (p && !e.stole) { const a = Math.atan2(p.y - e.y, p.x - e.x); sim.moveEnt(e, Math.cos(a) * spd * 0.6 * dt, Math.sin(a) * spd * 0.6 * dt, def); return; }
    AI.flutter(sim, e, dt, { p: null, spd: spd * 0.5, def });
  },
});
// ---- THE BROODMOTHER ----
const BROOD_ROWS = [
  '................',
  '.k....kkkk....k.',
  '..k..kZZZZk..k..',
  'k..kkZrZZrZkk..k',
  '.k.kZZrZZrZZk.k.',
  '..kkZZZZZZZZkk..',
  'kkkZZZrrrrZZZkkk',
  '...kZZZZZZZZk...',
  '..kkZZZkkZZZkk..',
  '.k.kZZzzzzZZk.k.',
  'k..kZzZZZZzZk..k',
  '..k.kZzzzzZk.k..',
  '.k...kZZZZk...k.',
  'k.....kkkk.....k',
  '................',
  '................'];
defineSpriteVariant('broodmother_glow', 'broodmother', { Z: '#e0d0f0', z: '#ff6060' }); // about to strike
const BM = { climbEvery: 7, upTime: 1.6, spinEvery: 9, eggsEvery: 12, wrapStill: 2.2 };
defineEnemy({
  id: 'broodmother', title: 'THE BROODMOTHER', hp: 16, spd: 2.6, dmg: 2, r: 0.8, sc: 2.4, boss: true, bossOf: [13], spiderkin: true, anim: legs, sprite: BROOD_ROWS,
  pal: { Z: '#d8d0c8', z: '#7a2a3a' },
  view: (e) => e.hz || 0,
  sprFor: (e) => e.glowT > 0 ? 'broodmother_glow' : null,
  ai(sim, e, dt, ctx) {
    const { p } = ctx; const L = sim.W.levels[e.lvl]; const b = e.b;
    if (!e.init) { e.init = true; e.climbIn = 4; e.spinIn = 6; e.eggsIn = 9; }
    if (e.glowT > 0) e.glowT -= dt;
    // up in the dark: out of reach, sliding over the nearest hero, her shadow beneath; then down
    if (e.up) {
      e.upT -= dt; e.air = true; e.hz = 1.6;
      if (p && e.upT > 0.35) { e.x += (p.x - e.x) * Math.min(1, dt * 2.2); e.y += (p.y - e.y) * Math.min(1, dt * 2.2); }
      e.shT = (e.shT || 0) - dt; if (e.shT <= 0) { e.shT = 0.3; sim.spawn({ k: 'fx', lvl: e.lvl, x: e.x, y: e.y, spr: 'shadowring', life: 0.32, sc: 1.8, z: -0.35 }); }
      if (e.upT <= 0) { e.up = false; e.air = false; e.hz = 0; sim.sfx('boom', e.lvl, e.x, e.y); sim.ev({ t: 'shake', lvl: e.lvl, x: e.x, y: e.y });
        for (const pl of Object.values(sim.players)) if (pl.alive && pl.lvl === e.lvl && dist2(pl.x, pl.y, e.x, e.y) < 1.6 * 1.6) sim.hurtPlayer(pl, 3, e); }
      return;
    }
    e.climbIn -= dt; e.spinIn -= dt; e.eggsIn -= dt;
    if (e.climbIn <= 0) { e.climbIn = BM.climbEvery * (e.hp < e.maxHp / 2 ? 0.7 : 1); e.up = true; e.upT = BM.upTime; sim.sfx('skitter', e.lvl, e.x, e.y); return; }
    // spin: two lines of sticky web across the floor (they fade after a while), so the room keeps getting smaller
    if (e.spinIn <= 0 && b) { e.spinIn = BM.spinEvery; e.glowT = 0.4; sim.sfx('webstick', e.lvl, e.x, e.y);
      for (let k = 0; k < 2; k++) { const row = Math.random() < 0.5; const at = row ? Math.floor(b.y0 + 1 + Math.random() * (b.y1 - b.y0 - 2)) : Math.floor(b.x0 + 1 + Math.random() * (b.x1 - b.x0 - 2));
        for (let s = row ? b.x0 : b.y0; s < (row ? b.x1 : b.y1); s++) { const i = row ? L.idx(s, at) : L.idx(at, s); if (L.tiles[i] === TL.DFLOOR) sim.setTempTile(e.lvl, i, TL.WEB, 14); } } }
    // eggs: two sacs near her that hatch on their own in a few seconds, unless burned
    if (e.eggsIn <= 0) { e.eggsIn = BM.eggsEvery; sim.sfx('hatch', e.lvl, e.x, e.y);
      for (let k = 0; k < 2; k++) { const a = Math.random() * TAU; const x = Math.floor(e.x + Math.cos(a) * 1.6), y = Math.floor(e.y + Math.sin(a) * 1.6); const i = L.idx(x, y); if (TINFO[L.tiles[i]].solid || L.props[i]) continue; sim.setTile(e.lvl, i, null, PR.EGGSAC); (L.eggTimers = L.eggTimers || {})[i] = sim.time + 5; } }
    // whoever stands still too long gets wrapped (game/sim.js webbed: slash free, and the brood comes down)
    for (const pl of Object.values(sim.players)) if (pl.alive && pl.lvl === e.lvl && !pl.webbed && !sim.flying(pl) && sim.time - (pl.movedAt || 0) > BM.wrapStill && dist2(pl.x, pl.y, e.x, e.y) < 25) {
      pl.webbed = { at: sim.time, by: 'wrap' }; pl.movedAt = sim.time; sim.sfx('webstick', pl.lvl, pl.x, pl.y); e.glowT = 0.4; break; }
    AI.lunge(0.6, 0.5, 1.0)(sim, e, dt, ctx);
  },
  // the little one was watching. If nobody ever swung at it, it's here now with what it took, and a gift.
  onDeath(sim, e) {
    if (sim.team.pipHit) return; const L = sim.W.levels[e.lvl];
    sim.spawn({ k: 'npc', lvl: e.lvl, x: e.x + 1, y: e.y, spr: 'spider_pip_wave', text: 'THE LITTLE SPIDER SETS DOWN EVERY GEM IT TOOK, AND SOMETHING SHINY BESIDES. THEN IT WAVES.', sc: 0.5 });
    sim.dropItem('gems50', e.lvl, e.x + 1.4, e.y + 0.6, { perm: true }); if (!sim.team.taken['pip:ring']) { const r = sim.spawn({ k: 'pick', lvl: e.lvl, x: e.x + 0.6, y: e.y + 0.8, item: 'ring_lodestone', tk: 'pip:ring', perm: true, spr: itemSprite('ring_lodestone'), sc: 0.55, z: 0.1, team: false }); }
  },
});
// ---- the spider elites (only spiderkin roll these; game/sim.js makeElite) ----
defineElite({ id: 'silkweaver', name: 'SILKWEAVER', color: [235, 235, 245], weight: 3, only: 'spider',
  update(sim, e, dt) { e.silkT = (e.silkT || 0) - dt; if (e.silkT > 0) return; e.silkT = 0.45; const L = sim.W.levels[e.lvl]; const i = L.idx(Math.floor(e.x), Math.floor(e.y)); if (L.tiles[i] === TL.DFLOOR) sim.setTempTile(e.lvl, i, TL.WEB, 8); },
  onDeath(sim, e, drop) { drop.gems(1); } });
defineElite({ id: 'widow', name: 'WIDOW', color: [200, 40, 60], weight: 3, only: 'spider',
  apply(e) { e.hp = e.maxHp = Math.ceil(e.hp * 1.3); },
  onHitPlayer(sim, e, pl) { sim.poisonPlayer(pl); },
  onDeath(sim, e, drop) { drop.gems(2); } });
defineElite({ id: 'broodsac', name: 'BROODSAC', color: [230, 210, 160], weight: 3, only: 'spider',
  apply(e) { e.scMul = 1.25; },
  onDeath(sim, e, drop) { const L = sim.W.levels[e.lvl]; for (let k = 0; k < 3; k++) sim.spawnBrood(L, e.x + (Math.random() - 0.5), e.y + (Math.random() - 0.5), 'spiderling', { spawnFx: 0.15 }); sim.sfx('hatch', e.lvl, e.x, e.y); drop.gems(1); } });
defineElite({ id: 'hush', name: 'HUSH', color: [60, 50, 80], weight: 2, only: 'spider', hidden: true, // nearly invisible until close (or in candlelight): game/sim.js entView
  onDeath(sim, e, drop) { drop.gems(2); drop('heart', 0, 0.4); } });
defineSprite('hush_eyes', [
  '................', '................', '................', '................', '................', '................', '................',
  '.....r....r.....', '................', '................', '................', '................', '................', '................', '................', '................']);
defineHints(['IN THE SILKWOOD, OLD SILK BURNS LIKE DRY GRASS. WHATEVER STANDS ON IT BURNS WITH IT. DECIDE WHO THAT IS.']);
