// ===== world.js : level generation =====
'use strict';
const RW = 8, RH = 6, RSX = 16, RSY = 11; // overworld region grid & stride
const DGW = 6, DGH = 6, DSX = 12, DSY = 8;  // dungeon room grid & stride

class Level {
  constructor(id, kind, w, h) {
    this.id = id; this.kind = kind; this.w = w; this.h = h;
    this.tiles = new Uint8Array(w * h); this.props = new Uint8Array(w * h);
    this.portals = {}; this.spawn = { x: 1.5, y: 1.5, a: 0 }; this.exit = null; this.npcs = []; this.shop = []; this.floorItems = [];
    this.secretReveal = {}; // tile idx -> {tile, portal}
  }
  idx(x, y) { return y * this.w + x; }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return TL.ROCK; return this.tiles[y * this.w + x]; }
  set(x, y, t) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y * this.w + x] = t; }
  solidAt(x, y, opts) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return true;
    const t = this.tiles[y * this.w + x]; const ti = TINFO[t];
    if (ti.water && opts && opts.raft) return false;
    // sealed-room doors are one-way: teammates can come in, nobody leaves until the room is clear
    if (t === TL.SHUTTER && opts && opts.mx != null && this.kind === 'dungeon') {
      const rid = this.sealRoom && this.sealRoom[y * this.w + x];
      if (rid != null) { const r = this.rooms[rid]; const x0 = r.rx * DSX, y0 = r.ry * DSY; const m = 0.23; /* just over the player's 0.22 radius: you're 'inside' only once fully clear of the doorway */ const inside = opts.mx > x0 + 1 + m && opts.mx < x0 + DSX - m && opts.my > y0 + 1 + m && opts.my < y0 + DSY - m; if (!inside) return false; }
    }
    if (ti.solid) return true;
    const p = this.props[y * this.w + x]; if (p && PROP_INFO[p].solid) return true;
    return false;
  }
}

const BIOMES = ['plains', 'forest', 'mountain', 'lake', 'desert', 'graveyard'];
const BIOME_ENEMIES = {
  plains: ['slime', 'spitter', 'thornling'], forest: ['spitter', 'thornling', 'bat'], mountain: ['spitter', 'thornling', 'knight'],
  lake: ['spitter', 'slime', 'bat'], desert: ['thornling', 'spitter', 'skeleton'], graveyard: ['ghost', 'skeleton', 'bat'],
};
const DUNGEON_ENEMIES = [null,
  ['slime', 'bat', 'skeleton'], ['slime', 'bat', 'thornling'], ['skeleton', 'bat', 'spitter'], ['skeleton', 'ghost', 'thornling'],
  ['knight', 'ghost', 'bat'], ['wizard', 'skeleton', 'knight'], ['wizard', 'knight', 'ghost'], ['wizard', 'knight', 'ghost', 'bat'],
  ['wizard', 'knight', 'ghost', 'skeleton', 'thornling']];
const DUNGEON_ITEMS = [null, 'boomerang', 'bombbag', 'bow', 'rod', 'whistle', 'raft', 'plate', 'silver'];
const DUNGEON_BOSS = [null, 'wyrm', 'orb', 'spider', 'wyrm', 'orb', 'spider', 'wyrm', 'orb', 'king'];
const DUNGEON_NAMES = [null, 'THE MOSSY HOLLOW', 'BRAMBLE KEEP', 'THE SUNKEN STAIR', 'EMBERFORGE', 'WHISPERING VAULT', 'TIDEGLASS HALLS', 'IRON CATHEDRAL', 'THE STARLESS DEEP', 'HOLLOW CROWN'];

function genWorld(seed, mode) {
  const W = { seed, mode, levels: {}, caveCount: 0, dungeons: [] };
  const rnd = mulberry32(seed);
  genOverworld(W, rnd);
  for (let d = 1; d <= 9; d++) genDungeon(W, d, mulberry32(seed * 31 + d * 977));
  return W;
}

// ---------- OVERWORLD ----------
function genOverworld(W, rnd) {
  const w = RW * RSX + 1, h = RH * RSY + 1;
  const L = new Level('ow', 'ow', w, h); W.levels.ow = L; L.regions = [];
  // biomes: by coarse noise + position bias
  const startR = { x: Math.floor(RW / 2), y: RH - 1 };
  const bn = []; for (let i = 0; i < 4; i++) bn.push(rnd());
  for (let ry = 0; ry < RH; ry++) for (let rx = 0; rx < RW; rx++) {
    let b;
    const v = Math.sin(rx * 0.9 + bn[0] * 6) + Math.cos(ry * 1.1 + bn[1] * 6) + (rnd() - 0.5) * 0.9;
    if (ry === 0 || (ry === 1 && rnd() < 0.4)) b = 'mountain';
    else if (v > 1.0) b = 'forest'; else if (v < -1.1) b = 'lake'; else if (rx >= RW - 2 && ry >= 3 && rnd() < 0.6) b = 'desert';
    else if (rx <= 1 && ry >= 2 && ry <= 4 && rnd() < 0.5) b = 'graveyard'; else b = rnd() < 0.55 ? 'plains' : rnd() < 0.5 ? 'forest' : 'desert';
    if (rx === startR.x && ry === startR.y) b = 'plains';
    L.regions.push({ rx, ry, biome: b, enemies: [], tier: 0, features: [] });
  }
  const R = (rx, ry) => L.regions[ry * RW + rx];
  // fill base
  for (let i = 0; i < w * h; i++) L.tiles[i] = TL.GRASS;
  // connectivity: spanning tree via randomized DFS + extras
  const edges = {}; const ek = (a, b) => a < b ? a + ',' + b : b + ',' + a;
  const seen = new Set(); const stack = [startR.y * RW + startR.x]; seen.add(stack[0]);
  while (stack.length) {
    const cur = stack[stack.length - 1]; const cx = cur % RW, cy = Math.floor(cur / RW);
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < RW && y < RH && !seen.has(y * RW + x));
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny] = rnd.pick(nb); const ni = ny * RW + nx; seen.add(ni); edges[ek(cur, ni)] = 1; stack.push(ni);
  }
  for (let ry = 0; ry < RH; ry++) for (let rx = 0; rx < RW; rx++) {
    const i = ry * RW + rx;
    if (rx < RW - 1 && rnd() < 0.35) edges[ek(i, i + 1)] = 1;
    if (ry < RH - 1 && rnd() < 0.35) edges[ek(i, i + RW)] = 1;
  }
  L.edges = edges;
  // region distances from start (for difficulty)
  const dist = new Array(RW * RH).fill(99); dist[startR.y * RW + startR.x] = 0; const q = [startR.y * RW + startR.x];
  while (q.length) { const c = q.shift(); const cx = c % RW, cy = Math.floor(c / RW); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= RW || ny >= RH) continue; const n = ny * RW + nx; if (edges[ek(c, n)] && dist[n] > dist[c] + 1) { dist[n] = dist[c] + 1; q.push(n); } } }
  L.regions.forEach((r, i) => { r.dist = dist[i]; r.tier = Math.min(3, Math.floor(dist[i] / 3)); });
  // borders
  const borderTile = (b1, b2) => (b1 === 'mountain' || b2 === 'mountain') ? TL.ROCK : (b1 === 'lake' && b2 === 'lake') ? TL.WATER : (b1 === 'desert' && b2 === 'desert') ? TL.ROCK : TL.TREEWALL;
  for (let ry = 0; ry <= RH; ry++) for (let x = 0; x < w; x++) {
    const y = ry * RSY; const rx = Math.min(RW - 1, Math.floor(x / RSX));
    const a = ry > 0 ? R(rx, ry - 1).biome : 'mountain', b = ry < RH ? R(rx, ry).biome : 'mountain';
    L.set(x, y, (ry === 0 || ry === RH) ? (a === 'lake' || b === 'lake' ? TL.ROCK : borderTile(a, b)) : borderTile(a, b));
  }
  for (let rx = 0; rx <= RW; rx++) for (let y = 0; y < h; y++) {
    const x = rx * RSX; const ry = Math.min(RH - 1, Math.floor(y / RSY));
    const a = rx > 0 ? R(rx - 1, ry).biome : 'mountain', b = rx < RW ? R(rx, ry).biome : 'mountain';
    if (y % RSY === 0) continue;
    L.set(x, y, borderTile(a, b));
  }
  // interiors
  for (const reg of L.regions) fillRegion(L, reg, rnd);
  // openings
  const openings = []; // per region list of door points (inside tile)
  L.regions.forEach(r => r.doors = []);
  for (const k in edges) {
    const [a, b] = k.split(',').map(Number); const ax = a % RW, ay = Math.floor(a / RW), bx = b % RW, by = Math.floor(b / RW);
    const ra = R(ax, ay), rb = R(bx, by);
    const floorT = (ra.biome === 'desert' || rb.biome === 'desert') ? TL.SAND : TL.PATH;
    if (ay === by) { // horizontal neighbor: shared vertical wall at x = bx*RSX
      const x = bx * RSX; const wid = rnd.range(2, 3); const y0 = ay * RSY + rnd.range(2, RSY - 2 - wid);
      for (let y = y0; y < y0 + wid; y++) { L.set(x, y, floorT); clearAround(L, x - 1, y); clearAround(L, x + 1, y); }
      ra.doors.push([x - 1, y0 + 1]); rb.doors.push([x + 1, y0 + 1]);
    } else {
      const y = by * RSY; const wid = rnd.range(2, 4); const x0 = ax * RSX + rnd.range(2, RSX - 2 - wid);
      for (let x = x0; x < x0 + wid; x++) { L.set(x, y, floorT); clearAround(L, x, y - 1); clearAround(L, x, y + 1); }
      ra.doors.push([x0 + 1, y - 1]); rb.doors.push([x0 + 1, y + 1]);
    }
  }
  // features: dungeons, caves
  const sr = R(startR.x, startR.y);
  const regionCenter = (r) => [r.rx * RSX + 8, r.ry * RSY + 5];
  // start cave (sword)
  placeCave(W, L, sr, rnd, 'sword0', 'open');
  const sc = sr.features[0];
  L.spawn = sc ? { x: sc.x + 0.5, y: Math.min(sr.ry * RSY + RSY - 0.6, sc.y + 3.5), a: -Math.PI / 2 } : { x: sr.rx * RSX + 8.5, y: sr.ry * RSY + 8.5, a: -Math.PI / 2 };
  // dungeon placement: sort regions by distance
  const cand = L.regions.filter(r => r !== sr).sort((a, b) => a.dist - b.dist || rnd() - 0.5);
  const used = new Set([sr]);
  const maxD = Math.max(...L.regions.map(r => r.dist));
  for (let d = 1; d <= 9; d++) {
    let target = d === 9 ? maxD : Math.round(1 + (d - 1) * (maxD - 1) / 8);
    let best = null, bestScore = 1e9;
    for (const r of cand) {
      if (used.has(r) || r.biome === 'lake') continue;
      let near = 0; for (const u of used) if (Math.abs(u.rx - r.rx) + Math.abs(u.ry - r.ry) <= 1) near = 1;
      const sc = Math.abs(r.dist - target) * 3 + near * 5 + rnd();
      if (sc < bestScore) { bestScore = sc; best = r; }
    }
    if (!best) best = cand.find(r => !used.has(r));
    used.add(best);
    placeGate(W, L, best, rnd, d);
  }
  // caves: shops, gifts, hearts, secrets, dojo
  const caveKinds = ['shop1', 'shop2', 'armor', 'potion', 'sword1', 'sword2', 'heart', 'heart', 'gift', 'gift', 'gift', 'hint', 'hint', 'dojo', 'potion', 'shop1'];
  const free = rnd.shuffle(L.regions.filter(r => !used.has(r) && r.biome !== 'lake'));
  let fi = 0;
  for (const kind of caveKinds) {
    const r = free[fi++ % free.length];
    if (r.features.length >= 2) continue;
    const secret = (kind === 'heart' || kind === 'gift' || kind === 'dojo' || kind === 'sword2') ? (rnd() < 0.5 && r.biome !== 'forest' ? 'bomb' : (r.biome === 'forest' || r.biome === 'plains') ? 'bush' : 'bomb') : 'open';
    placeCave(W, L, r, rnd, kind, secret);
  }
  // enemies
  for (const r of L.regions) {
    if (r === sr) continue;
    const pool = BIOME_ENEMIES[r.biome]; const n = 2 + r.tier + rnd.int(3);
    for (let i = 0; i < n; i++) r.enemies.push(rnd.pick(pool));
  }
  // signs near start
  L.signText = {};
  const sx = sr.rx * RSX + 5, sy = sr.ry * RSY + 7; if (!TINFO[L.get(sx, sy)].solid) { L.props[L.idx(sx, sy)] = PR.SIGN; L.signText[L.idx(sx, sy)] = 'NINE DUNGEONS. EIGHT EMBER SHARDS. ONE HOLLOW CROWN. THE NUMBERED GATES GROW DEADLIER THE FARTHER YOU ROAM.'; }
  // ensure connectivity per region from doors
  for (const r of L.regions) connectRegion(L, r);
  // clear spawn
  { const sx = Math.floor(L.spawn.x), sy = Math.floor(L.spawn.y); for (let y = sy - 2; y <= sy; y++) { const i = L.idx(sx, y); if (!TINFO[L.tiles[i]].portal) { if (TINFO[L.tiles[i]].solid) L.tiles[i] = TL.PATH; L.props[i] = 0; } } }
  repairReach(L);
}
function repairReach(L) {
  for (let pass = 0; pass < 12; pass++) {
    const seen = new Uint8Array(L.w * L.h); const sx = Math.floor(L.spawn.x), sy = Math.floor(L.spawn.y); const q = [sx + sy * L.w]; seen[q[0]] = 1;
    while (q.length) { const i = q.pop(); const x = i % L.w, y = (i / L.w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= L.w - 1 || ny >= L.h - 1) continue; const j = nx + ny * L.w; if (seen[j] || L.solidAt(nx + 0.5, ny + 0.5)) continue; seen[j] = 1; q.push(j); } }
    const targets = []; for (const r of L.regions) { for (const d of r.doors) targets.push(d); for (const e of (r.entryPoints || [])) targets.push(e); }
    const bad = targets.filter(([x, y]) => !seen[x + y * L.w]);
    if (!bad.length) return;
    for (const [tx, ty] of bad) {
      // cheapest path (walls cost more) from the target to anything reachable
      const N = L.w * L.h; const dist = new Float32Array(N).fill(1e9); const prev = new Int32Array(N).fill(-1); const st = tx + ty * L.w; dist[st] = 0;
      const open = [st]; let found = -1;
      while (open.length) {
        let bi = 0; for (let k = 1; k < open.length; k++) if (dist[open[k]] < dist[open[bi]]) bi = k; const i = open.splice(bi, 1)[0];
        if (seen[i]) { found = i; break; }
        const x = i % L.w, y = (i / L.w) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= L.w - 1 || ny >= L.h - 1) continue; const j = nx + ny * L.w; const ti = TINFO[L.tiles[j]];
          if (ti.portal || ti.bomb || L.secretReveal[j]) continue;
          const c = dist[i] + (L.solidAt(nx + 0.5, ny + 0.5) ? 6 : 1);
          if (c < dist[j]) { if (dist[j] >= 1e9) open.push(j); dist[j] = c; prev[j] = i; }
        }
      }
      let i = found; while (i >= 0) { const ti = TINFO[L.tiles[i]]; if (ti.solid) L.tiles[i] = ti.water ? TL.BRIDGE : TL.PATH; if (L.props[i] && L.props[i] !== PR.SIGN) L.props[i] = 0; i = prev[i]; }
    }
  }
}
function clearAround(L, x, y) { const i = L.idx(x, y); if (x <= 0 || y <= 0 || x >= L.w - 1 || y >= L.h - 1) return; if (TINFO[L.tiles[i]].solid && !TINFO[L.tiles[i]].portal) L.tiles[i] = TL.GRASS; L.props[i] = 0; }
function regionInterior(r) { return { x0: r.rx * RSX + 1, y0: r.ry * RSY + 1, x1: r.rx * RSX + RSX, y1: r.ry * RSY + RSY }; }
function fillRegion(L, r, rnd) {
  const { x0, y0, x1, y1 } = regionInterior(r);
  const base = r.biome === 'desert' ? TL.SAND : r.biome === 'graveyard' ? TL.PATH : TL.GRASS;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { L.set(x, y, base); if (base === TL.GRASS && rnd() < 0.05) L.set(x, y, TL.FLOWERS); }
  const put = (x, y, p) => { if (x > x0 && y > y0 && x < x1 - 1 && y < y1 - 1) L.props[L.idx(x, y)] = p; };
  const cx = (x0 + x1) >> 1, cy = (y0 + y1) >> 1;
  switch (r.biome) {
    case 'plains': for (let i = 0; i < 7; i++) put(rnd.range(x0, x1), rnd.range(y0, y1), rnd.pick([PR.TREE, PR.BUSH, PR.BUSH, PR.BOULDER])); break;
    case 'forest': for (let i = 0; i < 20; i++) put(rnd.range(x0, x1), rnd.range(y0, y1), rnd.pick([PR.TREE, PR.PINE, PR.PINE, PR.BUSH])); break;
    case 'mountain': for (let i = 0; i < 4; i++) { const bx = rnd.range(x0 + 1, x1 - 3), by = rnd.range(y0 + 1, y1 - 3), bw = rnd.range(1, 3), bh = rnd.range(1, 2); for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) L.set(x, y, TL.ROCK); }
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (L.get(x, y) === TL.GRASS && rnd() < 0.5) L.set(x, y, TL.PATH);
      for (let i = 0; i < 6; i++) put(rnd.range(x0, x1), rnd.range(y0, y1), PR.BOULDER); break;
    case 'lake': {
      const rx = rnd.range(3, 5), ry = rnd.range(2, 3);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d < 1) L.set(x, y, TL.WATER); else if (d < 1.7) L.set(x, y, TL.SAND); }
      if (rnd() < 0.6) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) if (L.get(x, cy) === TL.WATER) L.set(x, cy, TL.BRIDGE);
      for (let i = 0; i < 3; i++) put(rnd.range(x0, x1), rnd.range(y0, y1), PR.TREE); break;
    }
    case 'desert': for (let i = 0; i < 8; i++) put(rnd.range(x0, x1), rnd.range(y0, y1), rnd.pick([PR.CACTUS, PR.CACTUS, PR.BOULDER])); break;
    case 'graveyard': for (let gy = y0 + 2; gy < y1 - 1; gy += 2) for (let gx = x0 + 2; gx < x1 - 1; gx += 3) if (rnd() < 0.7) put(gx, gy, PR.GRAVE);
      put(x0 + 1, y0 + 1, PR.STATUE); put(x1 - 2, y0 + 1, PR.STATUE); break;
  }
}
function connectRegion(L, r) {
  const { x0, y0, x1, y1 } = regionInterior(r);
  const pass = (x, y) => !L.solidAt(x, y);
  if (!r.doors.length) return;
  const targets = r.doors.slice(); if (r.entryPoints) targets.push(...r.entryPoints);
  const [sx, sy] = targets[0];
  if (!pass(sx, sy)) carve(L, sx, sy, sx, sy, x0, y0, x1, y1);
  for (let t = 1; t < targets.length; t++) {
    // BFS check reachability
    const seen = new Set([sx + ',' + sy]); const q = [[sx, sy]]; let ok = false; const [tx, ty] = targets[t];
    while (q.length) { const [x, y] = q.shift(); if (x === tx && y === ty) { ok = true; break; } for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1) continue; const k = nx + ',' + ny; if (seen.has(k) || !pass(nx, ny)) continue; seen.add(k); q.push([nx, ny]); } }
    if (!ok) carve(L, sx, sy, tx, ty, x0, y0, x1, y1);
  }
}
function carve(L, sx, sy, tx, ty, x0, y0, x1, y1) {
  let x = sx, y = sy;
  const clr = (x, y) => { if (x < x0 || y < y0 || x >= x1 || y >= y1) return; const i = L.idx(x, y); const ti = TINFO[L.tiles[i]]; if (ti.portal || ti.bomb || L.secretReveal[i]) return; if (ti.solid) L.tiles[i] = ti.water ? TL.BRIDGE : TL.PATH; if (L.props[i] && L.props[i] !== PR.SIGN) L.props[i] = 0; };
  while (x !== tx) { clr(x, y); x += Math.sign(tx - x); } while (y !== ty) { clr(x, y); y += Math.sign(ty - y); } clr(x, y);
}
// place a structure with a portal facing south; returns portal tile coords
function placeStructure(L, r, rnd, wallT, portalT, wide) {
  const { x0, y0, x1, y1 } = regionInterior(r);
  for (let tries = 0; tries < 300; tries++) {
    const px = rnd.range(x0 + 2, x1 - 3), py = rnd.range(y0 + 1, y1 - 4);
    let ok = true;
    for (let y = py - 1; y <= py + 2 && ok; y++) for (let x = px - 2; x <= px + 2; x++) { const t = L.get(x, y); if (TINFO[t].portal || TINFO[t].bomb || L.props[L.idx(x, y)] === PR.SIGN || (r.taken && r.taken.has(x + ',' + y))) ok = false; }
    if (ok && r.doors && tries < 200) for (const [dx, dy] of r.doors) if (Math.abs(dx - px) <= 4 && dy >= py - 3 && dy <= py + 4) ok = false;
    if (!ok) continue;
    r.taken = r.taken || new Set();
    for (let y = py - 1; y <= py + 2; y++) for (let x = px - 2; x <= px + 2; x++) r.taken.add(x + ',' + y);
    const half = wide ? 2 : 1;
    for (let x = px - half; x <= px + half; x++) { L.set(x, py, wallT); L.props[L.idx(x, py)] = 0; if (wide) { L.set(x, py - 1, wallT); L.props[L.idx(x, py - 1)] = 0; } }
    L.set(px, py, portalT);
    for (let x = px - half; x <= px + half; x++) { const i = L.idx(x, py + 1); if (TINFO[L.tiles[i]].solid) L.tiles[i] = TL.PATH; L.props[i] = 0; }
    const i2 = L.idx(px, py + 2); if (TINFO[L.tiles[i2]].solid) L.tiles[i2] = TL.PATH; L.props[i2] = 0;
    r.entryPoints = r.entryPoints || []; r.entryPoints.push([px, py + 1]);
    return [px, py];
  }
  return null;
}
function placeGate(W, L, r, rnd, d) {
  const p = placeStructure(L, r, rnd, d === 9 ? TL.SHARDGATE : TL.BRICK, TL.GATE, true);
  if (!p) return;
  const [px, py] = p;
  if (d === 9) L.set(px, py, TL.SHARDGATE);
  L.props[L.idx(px - 2, py + 1)] = PR.STATUE; L.props[L.idx(px + 2, py + 1)] = PR.STATUE;
  L.portals[L.idx(px, py)] = { to: 'd' + d };
  r.features.push({ type: 'dungeon', d, x: px, y: py });
  W.dungeons[d] = { x: px, y: py, region: r.ry * RW + r.rx };
  r.gate = d;
}
function placeCave(W, L, r, rnd, kind, secret) {
  const portalT = secret === 'bomb' ? TL.ROCK_BOMB : TL.CAVE;
  const p = placeStructure(L, r, rnd, TL.ROCK, secret === 'bush' ? TL.ROCK : portalT, false);
  if (!p) return;
  let [px, py] = p; const id = 'c' + (W.caveCount++);
  if (secret === 'bush') {
    // hidden stairs under a bush in front
    const bx = px, by = py + 1; L.props[L.idx(bx, by)] = PR.BUSH;
    L.secretReveal[L.idx(bx, by)] = { tile: TL.STAIRS };
    L.portals[L.idx(bx, by)] = { to: id, stairs: true };
    r.entryPoints[r.entryPoints.length - 1] = [bx, by + 1];
    genCave(W, id, kind, { lvl: 'ow', x: bx + 0.5, y: by + 1.5, a: Math.PI / 2 }, rnd);
  } else {
    if (secret === 'bomb') L.secretReveal[L.idx(px, py)] = { tile: TL.CAVE };
    L.portals[L.idx(px, py)] = { to: id };
    genCave(W, id, kind, { lvl: 'ow', x: px + 0.5, y: py + 1.6, a: Math.PI / 2 }, rnd);
  }
  r.features.push({ type: 'cave', kind, id, x: px, y: py, secret });
}

// ---------- CAVES ----------
const HINTS = [
  'GHOSTS FEAR NO WALL. BUT THEY FEAR STEEL ALL THE SAME.',
  'CRACKED STONE HIDES MORE THAN DUST. CARRY BOMBS.',
  'SOME BUSHES ARE NOT WHAT THEY SEEM. FIRE TELLS THE TRUTH.',
  'THE HOLLOW KING FALLS ONLY TO SILVER-TIPPED ARROWS.',
  'A WIND WHISTLE CARRIES YOU TO ANY GATE YOU HAVE CONQUERED.',
  'KNIGHTS GUARD THEIR FRONT. STRIKE THEM FROM THE SIDE.',
  'IN THE MOUNTAINS, A MASTER WAITS BEHIND STONE. SEEK THE ONE WHO FIGHTS WITH OPEN HANDS.',
];
function genCave(W, id, kind, exit, rnd) {
  const w = 13, h = 9; const L = new Level(id, 'cave', w, h); W.levels[id] = L; L.caveKind = kind;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) L.set(x, y, (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? TL.CWALL : TL.CFLOOR);
  L.set(6, h - 1, TL.EXIT); L.set(6, h - 2, TL.EXIT);
  L.exit = exit; L.spawn = { x: 6.5, y: h - 2.6, a: -Math.PI / 2 };
  L.props[L.idx(3, 2)] = PR.FLAME; L.props[L.idx(9, 2)] = PR.FLAME;
  const npc = (spr, text) => L.npcs.push({ x: 6.5, y: 2.5, spr, text });
  const item = (x, item, price, extra) => L.shop.push(Object.assign({ x: x + 0.5, y: 4.5, item, price }, extra || {}));
  switch (kind) {
    case 'sword0': npc('oldman', 'THE DARK IS LONG, WAYFARER. STEEL IS BETTER COMPANY THAN COURAGE ALONE.'); item(6, 'sword1', 0, { gift: true }); break;
    case 'sword1': npc('oldman', 'PROVE YOUR HEART IS STRONG... FIVE HEARTS, AND THIS BLADE IS YOURS.'); item(6, 'sword2', 0, { gift: true, needHearts: 5 }); break;
    case 'sword2': npc('oldman', 'ONLY A HERO OF TWELVE HEARTS MAY LIFT THE MYTHRIL EDGE.'); item(6, 'sword3', 0, { gift: true, needHearts: 12 }); break;
    case 'shop1': npc('merchant', 'BUY SOMETHIN\' WILL YA!'); item(3, 'bombs', 20); item(6, 'candle', 60); item(9, 'heart', 10); break;
    case 'shop2': npc('merchant', 'FINEST GOODS THIS SIDE OF THE RIVER.'); item(3, 'arrows', 30); item(6, 'bombs', 25); item(9, 'potion', 50); break;
    case 'armor': npc('merchant', 'LINKED STEEL RINGS, SEWN RIGHT INTO YOUR TUNIC. SHINY, EH?'); item(4, 'chain', 160); item(8, 'potion', 60); break;
    case 'potion': npc('oldman', 'DRINK WHEN THE DARK CLOSES IN.'); item(4, 'potion', 40); item(8, 'potion2', 68); break;
    case 'heart': npc('oldman', 'TAKE ANY ONE YOU WANT.'); item(4, 'hcont', 0, { gift: true, choose: 'h' + id }); item(8, 'potion', 0, { gift: true, choose: 'h' + id }); break;
    case 'gift': npc('merchant', 'IT\'S A SECRET TO EVERYONE... TAKE THIS.'); item(6, 'gems' + rnd.pick([30, 50, 100]), 0, { gift: true }); break;
    case 'hint': npc('oldman', rnd.pick(HINTS)); break;
    case 'dojo': npc('master', 'HOH! A STEEL SWORD? THE STRONGEST WEAPON IS ATTACHED TO YOUR WRISTS. STEP ONTO THE MAT... IF YOU DARE.'); item(6, 'fists', 0, { gift: true, unique: true }); break;
  }
}

// ---------- DUNGEONS ----------
function genDungeon(W, d, rnd) {
  const w = DGW * DSX + 1, h = DGH * DSY + 1; const L = new Level('d' + d, 'dungeon', w, h); W.levels['d' + d] = L; L.dnum = d;
  for (let i = 0; i < w * h; i++) L.tiles[i] = TL.BRICK;
  const nRooms = Math.min(30, 9 + Math.floor(d * 1.6) + rnd.int(3));
  const start = { x: rnd.range(2, 3), y: DGH - 1 };
  const rooms = {}; const key = (x, y) => y * DGW + x; const order = [];
  const add = (x, y, parent) => { const r = { rx: x, ry: y, id: key(x, y), parent, children: [], depth: parent ? parent.depth + 1 : 0, enemies: [], links: {} }; rooms[r.id] = r; order.push(r); if (parent) parent.children.push(r); return r; };
  add(start.x, start.y, null);
  let guard = 0;
  while (order.length < nRooms && guard++ < 2000) {
    // prefer extending from deeper rooms for long dungeons
    const base = rnd() < 0.6 ? order[order.length - 1 - rnd.int(Math.min(4, order.length))] : rnd.pick(order);
    const dirs = rnd.shuffle([[1, 0], [-1, 0], [0, -1], [0, 1]]);
    for (const [dx, dy] of dirs) { const nx = base.rx + dx, ny = base.ry + dy; if (nx < 0 || ny < 0 || nx >= DGW || ny >= DGH || rooms[key(nx, ny)]) continue; if (base === order[0] && dy === 1) continue; add(nx, ny, base); break; }
  }
  L.rooms = rooms; L.startRoom = order[0];
  // carve rooms
  for (const r of order) { for (let y = r.ry * DSY + 1; y < r.ry * DSY + DSY; y++) for (let x = r.rx * DSX + 1; x < r.rx * DSX + DSX; x++) L.set(x, y, TL.DFLOOR); }
  // doors from tree
  const doorPos = (a, b) => { // returns tile coords of door between rooms a,b
    if (a.ry === b.ry) { const x = Math.max(a.rx, b.rx) * DSX; return [x, a.ry * DSY + 4]; }
    const y = Math.max(a.ry, b.ry) * DSY; return [a.rx * DSX + 6, y];
  };
  const setDoor = (a, b, t) => { const [x, y] = doorPos(a, b); L.set(x, y, t); a.links[b.id] = t; b.links[a.id] = t; };
  for (const r of order) if (r.parent) setDoor(r.parent, r, TL.OPENDOOR);
  // extra loops (some secret bomb walls)
  for (const r of order) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const o = rooms[key(r.rx + dx, r.ry + dy)]; if (!o || o.parent === r || r.parent === o) continue;
    if (rnd() < 0.18) setDoor(r, o, rnd() < 0.5 ? TL.BRICK_BOMB : TL.OPENDOOR);
  }
  // boss = deepest room; item room = deepest leaf not boss
  const sorted = order.slice().sort((a, b) => b.depth - a.depth);
  const boss = sorted[0]; boss.boss = DUNGEON_BOSS[d];
  const leaves = order.filter(r => r !== boss && r !== order[0] && r.children.length === 0).sort((a, b) => b.depth - a.depth);
  const itemRoom = leaves[0] || sorted[1]; if (DUNGEON_ITEMS[d]) itemRoom.item = DUNGEON_ITEMS[d];
  // locks: boss door + some others
  const locked = new Set();
  locked.add(boss.id);
  const lockN = Math.min(1 + Math.floor(d / 2), 5);
  const lockCand = rnd.shuffle(order.filter(r => r.depth >= 2 && r !== boss && r !== itemRoom));
  for (let i = 0; i < lockN - 1 && i < lockCand.length; i++) locked.add(lockCand[i].id);
  if (itemRoom && rnd() < 0.6) locked.add(itemRoom.id);
  // key placement: every key is reachable without opening any lock, so no order of key use can softlock
  const reach = new Set(); { const st = [order[0]]; while (st.length) { const r = st.pop(); if (reach.has(r.id)) continue; reach.add(r.id); for (const oid in r.links) { const o = rooms[oid]; if (locked.has(o.id) && o.parent === r) continue; if (locked.has(r.id) && r.parent === o) continue; st.push(o); } } }
  let lockList = [...locked].filter(id => !reach.has(id));
  const keySpots = rnd.shuffle(order.filter(r => reach.has(r.id) && r !== order[0] && !r.item && !r.boss));
  while (lockList.length > keySpots.length) { const drop = lockList.find(id => id !== boss.id) || lockList[0]; lockList = lockList.filter(id => id !== drop); }
  for (let i = 0; i < lockList.length; i++) keySpots[i].key = true;
  for (const id of lockList) { const r = rooms[id]; if (r.parent) setDoor(r.parent, r, TL.LOCKED); }
  // map & compass
  const mc = rnd.shuffle(order.filter(r => r !== order[0] && !r.boss && !r.item));
  if (mc[0]) mc[0].map = true; if (mc[1]) mc[1].compass = true;
  // contents
  const pool = DUNGEON_ENEMIES[d];
  for (const r of order) {
    const ix = r.rx * DSX, iy = r.ry * DSY;
    if (r === order[0]) { L.set(ix + 6, iy + DSY, TL.DEXIT); continue; }
    if (r.boss) { r.enemies = [r.boss]; if (d >= 4) r.enemies.push(rnd.pick(pool)); r.shutter = true; continue; }
    // layout pattern
    const pat = rnd.int(7);
    const blk = (x, y, t) => { if (x === 6 || y === 4) return; L.set(ix + x, iy + y, t || TL.BRICK); };
    const block = (d >= 4 && rnd() < 0.25) ? TL.LAVA : TL.BRICK;
    if (pat === 1) { blk(3, 2); blk(9, 2); blk(3, 6); blk(9, 6); }
    else if (pat === 2) { for (let x = 2; x <= 10; x += 2) { blk(x, 2, block); blk(x, 6, block); } }
    else if (pat === 3) { blk(5, 3); blk(7, 3); blk(5, 5); blk(7, 5); }
    else if (pat === 4) { for (let y = 2; y <= 6; y++) { blk(2, y, block); blk(10, y, block); } }
    else if (pat === 5) { for (let x = 3; x <= 9; x++) { blk(x, 2, block); blk(x, 6, block); } }
    else if (pat === 6) { L.props[L.idx(ix + 2, iy + 1)] = PR.STATUE; L.props[L.idx(ix + 10, iy + 1)] = PR.STATUE; }
    if (r.item) { r.enemies = []; L.props[L.idx(ix + 6, iy + 3)] = PR.PEDESTAL; const n = 1 + Math.floor(d / 3); for (let i = 0; i < n; i++) r.enemies.push(rnd.pick(pool)); continue; }
    const n = 2 + Math.floor(d / 2) + rnd.int(3);
    if (rnd() < 0.12 && !r.key && !r.map && !r.compass) continue; // empty room
    for (let i = 0; i < n; i++) r.enemies.push(rnd.pick(pool));
    r.shutter = rnd() < 0.25 || r.key;
  }
  L.spawn = { x: order[0].rx * DSX + 6.5, y: order[0].ry * DSY + 6.2, a: -Math.PI / 2 };
  L.bossRoom = boss.id;
  const ent = W.dungeons[d]; L.exit = ent ? { lvl: 'ow', x: ent.x + 0.5, y: ent.y + 1.6, a: Math.PI / 2 } : { lvl: 'ow', x: W.levels.ow.spawn.x, y: W.levels.ow.spawn.y, a: 0 };
}
function dungeonRoomAt(L, x, y) { const rx = Math.floor(x / DSX), ry = Math.floor(y / DSY); return L.rooms[ry * DGW + rx]; }
function owRegionAt(L, x, y) { const rx = clamp(Math.floor(x / RSX), 0, RW - 1), ry = clamp(Math.floor(y / RSY), 0, RH - 1); return L.regions[ry * RW + rx]; }
function roomBounds(L, room) {
  if (L.kind === 'dungeon') return { x0: room.rx * DSX + 1, y0: room.ry * DSY + 1, x1: room.rx * DSX + DSX, y1: room.ry * DSY + DSY };
  if (L.kind === 'ow') return { x0: room.rx * RSX + 1, y0: room.ry * RSY + 1, x1: room.rx * RSX + RSX, y1: room.ry * RSY + RSY };
  return { x0: 1, y0: 1, x1: L.w - 1, y1: L.h - 1 };
}
