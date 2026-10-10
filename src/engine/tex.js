// ===== engine/tex.js : procedural textures, tile types and props =====
'use strict';
const TS = 32;
const TEX = {};
function makeTex(fn, seed) {
  const r = mulberry32(seed || 1); const px = new Uint32Array(TS * TS);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) { const c = fn(x, y, r); px[y * TS + x] = c32(c); }
  return px;
}
function noiseGrid(seed, n) { const r = mulberry32(seed); const g = []; for (let i = 0; i < n * n; i++) g.push(r()); return (x, y) => g[((y % n + n) % n) * n + ((x % n + n) % n)]; }
// ---- dungeon color themes (each dungeon picks one in content/dungeons.js) ----
// wall/mortar/hi: brick face, mortar lines, brick highlight.  floor/edge/fhi: floor tiles.  trim: door frames.
const DEFAULT_THEME = { wall: [70, 80, 140], mortar: [30, 30, 54], hi: [100, 112, 176], floor: [78, 84, 120], edge: [40, 44, 70], fhi: [100, 108, 150], trim: [80, 80, 90] };
const DUNGEON_THEMES = {}; // filled by defineDungeon({ theme: {...} })
function defineTheme(id, th) { DUNGEON_THEMES[id] = Object.assign({}, DEFAULT_THEME, th); }
// ---- registrable textures: defineTexture(name, fn) with fn(x, y, rnd, ctx) -> [r,g,b]
//   { themed: true } -> fn(x, y, rnd, theme, ctx) and one copy per dungeon theme
//   { frames: n }    -> fn(x, y, rnd, frame, ctx), animated (like water)
// ctx gives helpers: vary(color, x, y, amount), shade(color, f), n8(x, y) noise, texPx(name, x, y).
const TEXTURE_DEFS = {};
function defineTexture(name, fn, opts) { TEXTURE_DEFS[name] = Object.assign({ fn }, opts || {}); }
// the textures dungeons recolor
function themedTextures(th, sfx) {
  const n8 = noiseGrid(11, 32); const vary = (c, x, y, amt) => shade(c, 1 - amt / 2 + n8(x, y) * amt);
  const o = {};
  o['brick' + sfx] = makeTex((x, y) => { const by = y >> 3, off = by % 2 ? 8 : 0; const edge = (y & 7) === 0 || ((x + off) & 15) === 0; let c = edge ? th.mortar : th.wall; if (!edge && (y & 7) === 1) c = th.hi; return vary(c, x, y, 0.2); }, 3);
  o['brick_bomb' + sfx] = makeTex((x, y) => { const by = y >> 3, off = by % 2 ? 8 : 0; const edge = (y & 7) === 0 || ((x + off) & 15) === 0; let c = edge ? th.mortar : th.wall; if (Math.abs((x - 14) + Math.sin(y * 0.5) * 3) < 0.7 && y > 4) c = shade(th.mortar, 0.8); return vary(c, x, y, 0.2); }, 3);
  o['dfloor' + sfx] = makeTex((x, y) => { const e = (x & 15) === 0 || (y & 15) === 0; let c = e ? th.edge : th.floor; if (!e && ((x & 15) === 1 || (y & 15) === 1)) c = th.fhi; return vary(c, x, y, 0.15); });
  o['locked' + sfx] = makeTex((x, y) => {
    if (x < 3 || x > 28) return vary(th.wall, x, y, 0.2);
    let c = ((x - 3) % 7 === 0) ? [70, 40, 20] : [150, 96, 48]; if (y < 2 || y > 29 || y === 10 || y === 22) c = th.trim;
    const kx = x - 16, ky = y - 16; if (kx * kx + (ky + 2) ** 2 < 10) c = [240, 210, 60]; if (Math.abs(kx) < 1.5 && ky > -2 && ky < 5) c = [20, 16, 10]; if (kx * kx + (ky + 2) ** 2 < 3) c = [20, 16, 10];
    return vary(c, x, y, 0.1);
  });
  o['shutter' + sfx] = makeTex((x, y) => { if (x < 3 || x > 28) return vary(th.wall, x, y, 0.2); const bar = (x % 6) < 2; return bar ? vary([180, 186, 200], x, y, 0.1) : [10, 10, 20]; });
  const brick = o['brick' + sfx];
  o['dexit' + sfx] = makeTex((x, y) => { const arch = ((x - 15.5) / 9) ** 2 + ((y - 31) / 24) ** 2 < 1; if (arch) return [250, 236, 180]; const v = brick[y * TS + x]; return [v & 255, (v >> 8) & 255, (v >> 16) & 255]; });
  return o;
}
// themed lookup used by the renderer: 'brick' in dungeon d3 -> TEX['brick@d3'] if it exists
function texFor(name, L) { if (L && L.theme) { const t = TEX[name + '@' + L.theme]; if (t) return t; } return TEX[name]; }
function initTextures() {
  const n8 = noiseGrid(11, 32), n4 = noiseGrid(22, 32);
  const vary = (c, x, y, amt) => shade(c, 1 - amt / 2 + n8(x, y) * amt);
  const ctx = { vary, shade, n8, n4, texPx: (name, x, y) => { const v = TEX[name][y * TS + x]; return [v & 255, (v >> 8) & 255, (v >> 16) & 255]; } };
  // floors
  TEX.grass = makeTex((x, y, r) => { let c = [72, 160, 56]; if (n8(x, y) > 0.86) c = [120, 200, 80]; if (n4(x * 3, y * 7) > 0.93) c = [40, 110, 40]; return vary(c, x, y, 0.18); });
  TEX.flowers = makeTex((x, y) => { const f = n4(x >> 2, y >> 2); if (f > 0.8 && (x & 3) == 1 && (y & 3) == 1) return f > 0.9 ? [248, 216, 64] : [240, 96, 160]; return vary([72, 160, 56], x, y, 0.18); });
  TEX.path = makeTex((x, y) => { let c = [214, 178, 120]; if (n8(x, y) > 0.9) c = [170, 140, 96]; return vary(c, x, y, 0.12); });
  TEX.sand = makeTex((x, y) => { let c = [232, 208, 140]; if (n8(x * 2, y) > 0.92) c = [200, 170, 110]; return vary(c, x, y, 0.08); });
  TEX.bridge = makeTex((x, y) => { const plank = (y >> 3); let c = plank % 2 ? [150, 100, 52] : [168, 116, 60]; if ((y & 7) === 0) c = [70, 44, 24]; if ((x + plank * 11) % 16 === 0) c = [90, 58, 30]; return vary(c, x, y, 0.1); });
  TEX.water = []; for (let f = 0; f < 4; f++) TEX.water.push(makeTex((x, y) => { const w = Math.sin((x + f * 4) * 0.4 + Math.sin(y * 0.3 + f) * 1.5); let c = [48, 104, 216]; if (w > 0.85) c = [150, 200, 255]; else if (w > 0.4) c = [72, 132, 232]; return c; }));
  TEX.lava = []; for (let f = 0; f < 4; f++) TEX.lava.push(makeTex((x, y) => { const w = Math.sin((x + f * 3) * 0.35 + Math.sin(y * 0.4 + f * 1.3) * 1.7); let c = [200, 50, 20]; if (w > 0.8) c = [255, 220, 80]; else if (w > 0.3) c = [250, 120, 30]; return c; }));
  TEX.cfloor = makeTex((x, y) => vary(n8(x >> 1, y >> 1) > 0.8 ? [70, 58, 50] : [92, 78, 66], x, y, 0.2));
  TEX.exit = makeTex((x, y) => { const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5)); return d < 12 ? (((x + y) >> 2) & 1 ? [250, 240, 190] : [230, 210, 150]) : [92, 78, 66]; });
  TEX.stairs = makeTex((x, y) => { const s = y >> 2; return s % 2 ? [40, 40, 50] : shade([150, 150, 170], 1 - s / 10); });
  // walls
  TEX.treewall = makeTex((x, y) => {
    // foliage clumps on top 2/3, trunks bottom
    const trunk = (((x + 4) % 11) < 3) && y > 20;
    if (trunk) return vary([96, 60, 30], x, y, 0.3);
    if (y > 22) return vary([30, 70, 30], x, y, 0.3);
    const cx = (x % 11) - 5, cy = (y % 9) - 4; const blob = cx * cx + cy * cy < 22;
    let c = blob ? [40, 140, 50] : [26, 96, 36]; if (blob && cx < -1 && cy < -1) c = [90, 190, 70];
    return vary(c, x, y, 0.25);
  });
  TEX.rock = makeTex((x, y) => {
    const by = Math.floor(y / 8), off = by % 2 ? 6 : 0; const bx = Math.floor((x + off) / 12);
    const edge = (y % 8) === 0 || ((x + off) % 12) === 0;
    let c = edge ? [96, 58, 32] : [170, 104, 56]; if (!edge && (y % 8) === 1) c = [205, 140, 80];
    return vary(c, x + bx * 3, y, 0.22);
  }, 5);
  TEX.rock_bomb = makeTex((x, y) => {
    const by = Math.floor(y / 8), off = by % 2 ? 6 : 0; const edge = (y % 8) === 0 || ((x + off) % 12) === 0;
    let c = edge ? [96, 58, 32] : [170, 104, 56]; if (!edge && (y % 8) === 1) c = [205, 140, 80];
    // subtle crack
    if (Math.abs((x - 16) - Math.sin(y * 0.6) * 3) < 0.8 && y > 6 && y < 28) c = [70, 40, 22];
    return vary(c, x, y, 0.22);
  }, 5);
  TEX.cave = makeTex((x, y) => { const dx = (x - 15.5) / 10, dy = (y - 30) / 22; if (dx * dx + dy * dy < 1) return dx * dx + dy * dy > 0.82 ? [60, 36, 20] : [8, 6, 10]; return TEX_ROCKC(x, y); });
  function TEX_ROCKC(x, y) { const i = y * TS + x; const v = TEX.rock[i]; return [v & 255, (v >> 8) & 255, (v >> 16) & 255]; }
  TEX.gate = makeTex((x, y) => {
    const arch = ((x - 15.5) / 8) ** 2 + ((y - 31) / 20) ** 2 < 1;
    if (arch) return y > 12 ? [10, 10, 16] : [20, 20, 30];
    if (x < 4 || x > 27) return vary([140, 140, 160], x, y, 0.2);
    const edge = (y % 8) === 0 || (x % 8) === 0; return vary(edge ? [70, 70, 90] : [120, 124, 146], x, y, 0.2);
  });

  // world-edge walls: granite peaks (west), basalt with glowing cracks (east), deep ocean (south)
  TEX.mountain = makeTex((x, y) => { const strata = Math.sin(y * 0.55 + Math.sin(x * 0.3) * 1.4); let c = strata > 0.6 ? [150, 156, 176] : strata < -0.5 ? [92, 96, 116] : [122, 128, 148]; if (n8(x, y >> 1) > 0.9) c = [70, 72, 90]; return vary(c, x, y, 0.18); }, 13);
  TEX.volcrock = makeTex((x, y) => { let c = n8(x >> 2, y >> 2) > 0.55 ? [58, 46, 50] : [76, 60, 62]; const cr = Math.abs(((x * 0.7 + y * 0.45 + Math.sin(y * 0.4) * 4) % 13) - 6.5); if (cr < 0.6 && n4(x >> 3, y >> 3) > 0.35) c = [255, 120 + (y & 3) * 20, 40]; return vary(c, x, y, 0.2); }, 17);
  // the southern sea: dark, choppy, whitecaps everywhere; 'surf' is the breaking foam right off the beach
  TEX.ocean = []; for (let f = 0; f < 4; f++) TEX.ocean.push(makeTex((x, y) => { const ph = f * Math.PI / 2; const w = Math.sin(x * 0.45 + ph + Math.sin(y * 0.35 + ph) * 2.2) + Math.sin(y * 0.6 - ph * 1.5 + x * 0.2) * 0.7; let c = [22, 52, 120]; if (w > 1.35) c = [236, 244, 255]; else if (w > 1.0) c = [130, 170, 220]; else if (w > 0.4) c = [34, 76, 160]; else if (w < -0.9) c = [14, 34, 86]; return vary(c, x, y, 0.1); }));
  TEX.surf = []; for (let f = 0; f < 4; f++) TEX.surf.push(makeTex((x, y) => { const ph = f * Math.PI / 2; const w = Math.sin(x * 0.5 + ph + Math.sin(y * 0.5) * 1.5) + Math.sin(y * 0.9 + ph * 2) * 0.8; let c = [40, 92, 180]; if (w > 0.6) c = [240, 248, 255]; else if (w > 0.1) c = [170, 205, 240]; return vary(c, x, y, 0.1); }));
  TEX.cwall = makeTex((x, y) => vary(n8(x >> 2, y >> 2) > 0.5 ? [60, 46, 40] : [80, 62, 52], x, y, 0.3), 9);
  TEX.cwall_bomb = makeTex((x, y) => { let c = n8(x >> 2, y >> 2) > 0.5 ? [60, 46, 40] : [80, 62, 52]; if (Math.abs((x - 16) - Math.sin(y * 0.6) * 3) < 0.8 && y > 6 && y < 28) c = [30, 22, 18]; return vary(c, x, y, 0.3); }, 9);
  TEX.shop = makeTex((x, y) => { let c = [120, 80, 44]; if ((y & 7) === 0) c = [70, 44, 24]; if (y < 4) c = [200, 60, 40]; return vary(c, x, y, 0.1); });
  Object.assign(TEX, themedTextures(DEFAULT_THEME, ''));
  for (const id in DUNGEON_THEMES) Object.assign(TEX, themedTextures(DUNGEON_THEMES[id], '@' + id));
  for (const [name, t] of Object.entries(TEXTURE_DEFS)) {
    if (t.themed) { TEX[name] = makeTex((x, y, r) => t.fn(x, y, r, DEFAULT_THEME, ctx), t.seed); for (const id in DUNGEON_THEMES) TEX[name + '@' + id] = makeTex((x, y, r) => t.fn(x, y, r, DUNGEON_THEMES[id], ctx), t.seed); }
    else if (t.frames) { TEX[name] = []; for (let f = 0; f < t.frames; f++) TEX[name].push(makeTex((x, y, r) => t.fn(x, y, r, f, ctx), t.seed)); }
    else TEX[name] = makeTex((x, y, r) => t.fn(x, y, r, ctx), t.seed);
  }
  TEX.cexit = makeTex((x, y) => { const dx = (x - 15.5) / 10, dy = (y - 31) / 26; const d = dx * dx + dy * dy; if (d < 1) return d > 0.8 ? [120, 96, 70] : shade([250, 240, 200], 0.85 + 0.15 * (y / 31)); return ctx.texPx('cwall', x, y); });
  TEX.shardwall = makeTex((x, y) => { const d = Math.abs(x - 16) + Math.abs(y - 16); if (d < 9) return d < 5 ? [255, 230, 120] : [240, 140, 40]; const i = y * TS + x; const v = TEX.brick[i]; return shade([v & 255, (v >> 8) & 255, (v >> 16) & 255], 0.7); });
}

// ===== tile definitions =====
const TL = {
  GRASS: 0, PATH: 1, WATER: 2, TREEWALL: 3, ROCK: 4, ROCK_BOMB: 5, CAVE: 6, GATE: 7, BRIDGE: 8, SAND: 9,
  BRICK: 10, DFLOOR: 11, LOCKED: 12, SHUTTER: 13, BRICK_BOMB: 14, CWALL: 15, CFLOOR: 16, EXIT: 17, FLOWERS: 18, LAVA: 19,
  DEXIT: 20, SHOPWALL: 21, CWALL_BOMB: 22, STAIRS: 23, SHARDGATE: 24, OPENDOOR: 25, BUSHFLOOR: 26,
};
// solid, wall texture key, floor texture key, flags
const TINFO = [];
function defTile(id, o) { TINFO[id] = Object.assign({ solid: false, wall: null, floor: 'grass', portal: false, water: false, bomb: false, hurt: 0 }, o); }
// Register a new tile type from content: defineTile('ICE', { floor: 'ice', slippery: true }) -> TL.ICE.
// Common flags: solid, wall (texture), floor (texture), water, hurt, bomb (bombable), opensTo (tile name it becomes when opened),
// low (projectiles fly over), plus any custom flag your code checks with TINFO[t].yourFlag.
function defineTile(name, o) { if (TL[name] != null) throw new Error('tile ' + name + ' defined twice'); const id = TINFO.length; TL[name] = id; defTile(id, o); return id; }
defTile(TL.GRASS, { floor: 'grass' });
defTile(TL.FLOWERS, { floor: 'flowers' });
defTile(TL.PATH, { floor: 'path' });
defTile(TL.SAND, { floor: 'sand' });
defTile(TL.BRIDGE, { floor: 'bridge' });
defTile(TL.WATER, { solid: true, floor: 'water', water: true, low: true });
defTile(TL.LAVA, { floor: 'lava', hurt: 1 });
defTile(TL.TREEWALL, { solid: true, wall: 'treewall' });
defTile(TL.ROCK, { solid: true, wall: 'rock' });
defTile(TL.ROCK_BOMB, { solid: true, wall: 'rock_bomb', bomb: true });
defTile(TL.CAVE, { solid: true, wall: 'cave', portal: true });
defTile(TL.GATE, { solid: true, wall: 'gate', portal: true });
defTile(TL.BRICK, { solid: true, wall: 'brick' });
defTile(TL.BRICK_BOMB, { solid: true, wall: 'brick_bomb', bomb: true });
defTile(TL.DFLOOR, { floor: 'dfloor' });
defTile(TL.OPENDOOR, { floor: 'dfloor' });
defTile(TL.LOCKED, { solid: true, wall: 'locked', locked: true });
defTile(TL.SHUTTER, { solid: true, wall: 'shutter' });
defTile(TL.CWALL, { solid: true, wall: 'cwall' });
defTile(TL.CWALL_BOMB, { solid: true, wall: 'cwall_bomb', bomb: true });
defTile(TL.CFLOOR, { floor: 'cfloor' });
defTile(TL.EXIT, { floor: 'exit', exit: true });
defTile(TL.DEXIT, { solid: true, wall: 'dexit', exitWall: true });
defTile(TL.SHOPWALL, { solid: true, wall: 'shop' });
defTile(TL.STAIRS, { floor: 'stairs', stairs: true });
defTile(TL.SHARDGATE, { solid: true, wall: 'shardwall', shardGate: true });
defTile(TL.BUSHFLOOR, { floor: 'grass' });
defTile(TL.CEXIT = 27, { solid: true, wall: 'cexit', exitWall: true }); // daylight archway out of a cave
// The edges of the Wilds, and the tall towers over dungeon gates. tall: wall height in tiles (seen over shorter walls),
// jag: how the top edge is cut ('peak' ridge, 'trees' canopy, 'battlement'), snow: white caps on the high parts.
defTile(TL.OCEAN = 28, { solid: true, floor: 'surf', water: true, ocean: true, low: true }); // rough sea: the raft can't cross it
defTile(TL.PEAKS = 29, { solid: true, wall: 'mountain', tall: 3.4, jag: 'peak', snow: true });
defTile(TL.FIREPEAKS = 30, { solid: true, wall: 'volcrock', tall: 2.8, jag: 'peak' });
defTile(TL.BIGWOOD = 31, { solid: true, wall: 'treewall', tall: 2.6, jag: 'trees' });
defTile(TL.TOWER = 32, { solid: true, wall: 'brick', tall: 2.3, jag: 'battlement' });

// props drawn as sprites on tiles
const PROPS = [null, 'tree', 'pine', 'boulder', 'bush', 'cactus', 'grave', 'statue', 'sign', 'flame', 'pedestal'];
const PR = { NONE: 0, TREE: 1, PINE: 2, BOULDER: 3, BUSH: 4, CACTUS: 5, GRAVE: 6, STATUE: 7, SIGN: 8, FLAME: 9, PEDESTAL: 10 };
const PROP_INFO = {
  1: { solid: true, scale: 1.5 }, 2: { solid: true, scale: 1.6 }, 3: { solid: true, scale: 1.0 }, 4: { solid: true, scale: 0.9, burn: true },
  5: { solid: true, scale: 1.1 }, 6: { solid: true, scale: 0.9 }, 7: { solid: true, scale: 1.1 }, 8: { solid: true, scale: 0.8 }, 9: { solid: true, scale: 0.7 }, 10: { solid: false, scale: 0.6 },
};
// Register a new prop: defineProp('TORCH', 'brazier', { solid: true, scale: 0.7 }) -> PR.TORCH, drawn with sprite 'brazier'.
function defineProp(name, sprite, info) { if (PR[name] != null) throw new Error('prop ' + name + ' defined twice'); const id = PROPS.length; PROPS.push(sprite); PR[name] = id; PROP_INFO[id] = Object.assign({ solid: false, scale: 1 }, info); return id; }
// tile id -> name, for saves (so adding tiles later can't scramble old saves)
function tileName(id) { for (const k in TL) if (TL[k] === id) return k; return null; }
