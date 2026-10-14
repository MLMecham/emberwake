// ===== engine/render.js : raycaster, sprites, HUD, maps =====
'use strict';
const R = {
  anim: {},
  W: 320, H: 180, canvas: null, ctx: null, img: null, buf: null, zbuf: null, time: 0,
};
function initRenderer(canvas) {
  R.canvas = canvas; R.ctx = canvas.getContext('2d', { alpha: false });
  resizeRenderer();
}
function resizeRenderer() {
  const aspect = clamp(window.innerWidth / Math.max(1, window.innerHeight), 1.2, 2.3);
  R.H = 180; R.W = Math.round(R.H * aspect / 2) * 2;
  R.canvas.width = R.W; R.canvas.height = R.H;
  R.img = R.ctx.createImageData(R.W, R.H); R.buf = new Uint32Array(R.img.data.buffer); R.zbuf = new Float32Array(R.W);
}
// ---- pixel helpers ----
function px(x, y, c) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= R.W || y >= R.H) return; R.buf[y * R.W + x] = c; }
function rect(x, y, w, h, c) { x |= 0; y |= 0; const x1 = Math.min(R.W, x + w), y1 = Math.min(R.H, y + h); for (let j = Math.max(0, y); j < y1; j++) for (let i = Math.max(0, x); i < x1; i++) R.buf[j * R.W + i] = c; }
function rectA(x, y, w, h, c, a) { x |= 0; y |= 0; const cr = c & 255, cg = (c >> 8) & 255, cb = (c >> 16) & 255; const x1 = Math.min(R.W, x + w), y1 = Math.min(R.H, y + h); for (let j = Math.max(0, y); j < y1; j++) for (let i = Math.max(0, x); i < x1; i++) { const k = j * R.W + i, v = R.buf[k]; R.buf[k] = rgb(((v & 255) * (1 - a) + cr * a) | 0, (((v >> 8) & 255) * (1 - a) + cg * a) | 0, (((v >> 16) & 255) * (1 - a) + cb * a) | 0); } }
function frame(x, y, w, h, c) { rect(x, y, w, 1, c); rect(x, y + h - 1, w, 1, c); rect(x, y, 1, h, c); rect(x + w - 1, y, 1, h, c); }
function text(str, x, y, c, shadow) {
  str = String(str).toUpperCase(); let cx = x;
  for (const ch of str) {
    const g = FONT[ch] || FONT['?'];
    if (ch !== ' ') for (let j = 0; j < 7; j++) { const row = g[j]; if (!row) continue; for (let i = 0; i < 5; i++) if (row & (1 << i)) { if (shadow !== false) px(cx + i + 1, y + j + 1, 0xff000000); px(cx + i, y + j, c); } }
    cx += 6;
  }
  return cx - x;
}
function textC(str, cx, y, c) { const w = String(str).length * 6; text(str, Math.round(cx - w / 2), y, c); }
function wrapText(str, maxChars) { const words = String(str).split(' '); const lines = []; let cur = ''; for (const w of words) { if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; } if (cur.trim()) lines.push(cur.trim()); return lines; }
function blit(spr, x, y, scale, opts) { // 2D sprite draw
  if (!spr) return; scale = scale || 1; const w = spr.w * scale, h = spr.h * scale; x = Math.round(x); y = Math.round(y);
  const flip = opts && opts.flip, tint = opts && opts.tint;
  for (let j = 0; j < h; j++) { const yy = y + j; if (yy < 0 || yy >= R.H) continue; const sy = Math.floor(j / scale);
    for (let i = 0; i < w; i++) { const xx = x + i; if (xx < 0 || xx >= R.W) continue; let sx = Math.floor(i / scale); if (flip) sx = spr.w - 1 - sx; const c = spr.px[sy * spr.w + sx]; if (c) R.buf[yy * R.W + xx] = tint ? tint : c; } }
}
function shadeC(c, f) { if (f >= 0.999) return c; if (f <= 0) return 0xff000000; return rgb(((c & 255) * f) | 0, (((c >> 8) & 255) * f) | 0, (((c >> 16) & 255) * f) | 0); }
function fogC(c, f, fr, fg, fb) { if (f <= 0.001) return c; return rgb(((c & 255) * (1 - f) + fr * f) | 0, (((c >> 8) & 255) * (1 - f) + fg * f) | 0, (((c >> 16) & 255) * (1 - f) + fb * f) | 0); }
// thick line for weapons
function thickLine(x0, y0, x1, y1, w, c) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.max(1, Math.hypot(dx, dy)); const steps = Math.ceil(len);
  for (let s = 0; s <= steps; s++) { const t = s / steps; const x = x0 + dx * t, y = y0 + dy * t; const ww = typeof w === 'function' ? w(t) : w; rect(x - ww / 2, y - ww / 2, ww + 1, ww + 1, c); }
}
function disc(cx, cy, r, c, a) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) { if (a != null) rectA(cx + x, cy + y, 1, 1, c, a); else px(cx + x, cy + y, c); } }

// ---- world render ----
function lightFor(kind, d) {
  if (kind === 'dungeon') return clamp(1.15 - d / 8, 0.08, 1);
  if (kind === 'cave') return clamp(1.2 - d / 10, 0.15, 1);
  return 1;
}
// Dark levels (L.dark): a small glow around you plus light from lit braziers (FLAME props) nearby.
let _torches = [];
function darkLight(wx, wy, camDist) {
  let l = clamp(1.0 - camDist / (R.heldLight ? 5.5 : 2.8), 0.02, 1); // a held candle lights much further (R.heldLight, set by ui/main.js)
  for (let i = 0; i < _torches.length; i += 2) { const dx = wx - _torches[i], dy = wy - _torches[i + 1]; const tl = 1.2 - Math.sqrt(dx * dx + dy * dy) / 4.8; if (tl > l) l = tl; }
  return l > 1 ? 1 : l;
}
function renderWorld(cam, L, ents, players, myId) {
  const W = R.W, H = R.H, buf = R.buf; const t = R.time;
  const dark = !!L.dark; _torches = [];
  if (dark) { const cx = Math.floor(cam.x), cy = Math.floor(cam.y); for (let y = Math.max(0, cy - 14); y <= Math.min(L.h - 1, cy + 14); y++) for (let x = Math.max(0, cx - 14); x <= Math.min(L.w - 1, cx + 14); x++) if (L.props[y * L.w + x] === PR.FLAME) _torches.push(x + 0.5, y + 0.5); }
  const dirX = Math.cos(cam.a), dirY = Math.sin(cam.a); const fov = 0.66 * (W / H) / 1.78;
  const plX = -dirY * fov, plY = dirX * fov;
  const hz = Math.round(H / 2 + cam.pitch); const eye = cam.eye;
  const kind = L.kind; const outdoor = kind === 'ow';
  const fogR = 168, fogG = 208, fogB = 248;
  const wf = Math.floor(t * 4) % 4;
  // --- sky / ceiling ---
  if (outdoor) {
    for (let y = 0; y < Math.min(H, hz); y++) {
      const f = clamp((hz - y) / (H * 0.8), 0, 1); const c = rgb(lerp(168, 70, f) | 0, lerp(208, 130, f) | 0, lerp(248, 230, f) | 0);
      for (let x = 0; x < W; x++) buf[y * W + x] = c;
    }
    // the far edges of the Wilds, fixed to the compass so you can always tell which way you face:
    // granite peaks with snow to the west, a smoking volcano to the east, the great wood to the north, open sea to the south
    const u = H / 180; const tri = (v) => 1 - 2 * Math.abs(v - Math.floor(v) - 0.5); const sm = (v) => clamp((v - 0.15) / 0.45, 0, 1);
    for (let x = 0; x < W; x++) {
      const ang = cam.a + Math.atan((x / W * 2 - 1) * fov); const ca = Math.cos(ang), sa = Math.sin(ang);
      const col = (h, c) => { const y0 = Math.max(0, hz - Math.round(h)); for (let y = y0; y < Math.min(H, hz); y++) buf[y * W + x] = c; return y0; };
      col((6 + Math.sin(ang * 3) * 3 + Math.sin(ang * 7 + 1) * 2) * u, rgb(110, 160, 140));
      const wN = sm(-sa); if (wN > 0) col(wN * (13 + 4 * Math.abs(Math.sin(ang * 23)) + 3 * Math.sin(ang * 6)) * u, rgb(46, 96, 70));
      const wW = sm(-ca);
      if (wW > 0) { const ph = wW * (20 + 16 * tri(ang * 2.1 + 0.2) + 7 * tri(ang * 5.3)) * u; const top = col(ph, rgb(124, 134, 170)); const snow = Math.round(ph * 0.32); for (let y = Math.max(0, top); y < Math.min(hz, top + snow); y++) buf[y * W + x] = rgb(236, 242, 252); }
      const wE = sm(ca);
      if (wE > 0) {
        const dA = angDiff(ang, 0.05); const cone = Math.max(0, 1 - Math.abs(dA) / 0.42);
        const ridge = 9 + 6 * tri(ang * 3.7 + 0.6); const vh = Math.min(36, cone * 46); const h = wE * Math.max(ridge, vh) * u;
        const top = col(h, rgb(88, 64, 72));
        if (vh > ridge && vh >= 36) { for (let y = Math.max(0, top); y < Math.min(hz, top + 2 * u); y++) buf[y * W + x] = (Math.floor(t * 3 + x * 0.3) & 1) ? rgb(255, 130, 40) : rgb(255, 200, 80); }
        // smoke drifting up out of the crater
        if (wE > 0.6) for (let dy = 1; dy < 46 * u; dy++) { const y = top - dy; if (y < 0) break; const off = 0.02 * Math.sin(t * 0.7 + dy * 0.12 / u) + dy * 0.004 / u; const sw = 0.025 + dy * 0.0011 / u; if (Math.abs(dA - off) < sw && ((dy / u + t * 6) % 9) < 6) { const k = y * W + x; const v = buf[k]; buf[k] = rgb(((v & 255) + 110) >> 1, (((v >> 8) & 255) + 100) >> 1, (((v >> 16) & 255) + 100) >> 1); } }
      }
      const cl = Math.sin(ang * 5 + t * 0.03) + Math.sin(ang * 11) * 0.5;
      if (cl > 0.9) { const cy = hz - 48 * u - Math.round(Math.sin(ang * 2) * 8); for (let y = cy; y < cy + Math.round((cl - 0.9) * 14); y++) if (y >= 0 && y < hz) buf[y * W + x] = rgb(250, 250, 255); }
    }
  }
  // --- floor & ceiling casting ---
  const rdx0 = dirX - plX, rdy0 = dirY - plY, rdx1 = dirX + plX, rdy1 = dirY + plY;
  const ceilTex = kind === 'dungeon' ? texFor('brick', L) : TEX.cwall;
  for (let y = 0; y < H; y++) {
    const floorRow = y >= hz; if (!floorRow && outdoor) continue;
    const p = floorRow ? Math.max(0.5, y - hz) : hz - y; const posZ = (floorRow ? eye : (L.ceilH || 1) - eye) * H;
    const rowD = posZ / p;
    const stepX = rowD * (rdx1 - rdx0) / W, stepY = rowD * (rdy1 - rdy0) / W;
    let fx = cam.x + rowD * rdx0, fy = cam.y + rowD * rdy0;
    const lf = lightFor(kind, rowD); const fogF = outdoor ? clamp((rowD - 9) / 9, 0, 0.85) : 0;
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const cx = Math.floor(fx), cy = Math.floor(fy);
      let c;
      if (floorRow) {
        const tile = (cx < 0 || cy < 0 || cx >= L.w || cy >= L.h) ? (outdoor ? (cy >= L.h ? TL.OCEAN : TL.GRASS) : TL.DFLOOR) : L.tiles[cy * L.w + cx];
        const ti = TINFO[tile]; const oob = outdoor && cy >= L.h; let tex = oob ? TEX.ocean : (texFor(ti.vent ? (R.ventPhase === 2 ? 'vent_hot' : R.ventPhase === 1 ? 'vent_warm' : ti.floor) : (ti.floor || 'grass'), L) || TEX.grass);
        let sx = fx, sy = fy; if (ti.ocean) { sx += Math.sin(fy * 1.7 + t * 2.6) * 0.18; sy += Math.sin(fx * 1.3 + t * 2.1) * 0.22; } // heaving swell
        if (Array.isArray(tex)) tex = tex[ti.ocean ? (Math.floor(t * 7 + fx * 0.3) & 3) : wf];
        const tx = ((sx - Math.floor(sx)) * TS) | 0, ty = ((sy - Math.floor(sy)) * TS) | 0; c = tex[(ty & 31) * TS + (tx & 31)];
      } else {
        const tx = ((fx - cx) * TS) | 0, ty = ((fy - cy) * TS) | 0; c = shadeC(ceilTex[(ty & 31) * TS + (tx & 31)], 0.45);
      }
      if (dark) c = shadeC(c, darkLight(fx, fy, rowD)); else if (lf < 1) c = shadeC(c, lf); if (fogF > 0) c = fogC(c, fogF, fogR, fogG, fogB);
      buf[row + x] = c; fx += stepX; fy += stepY;
    }
  }
  // --- walls, ledges and steps ---
  // Each column marches outward cell by cell, FRONT TO BACK. `clip` is the lowest screen row not yet painted in this column
  // (everything from clip down is final): the floor pass painted the ground plane everywhere, and here every cell that
  // stands up from it paints its face (from the height of the cell before it up to its own height) and, when the eye is
  // above it, its top (cap) - but only above `clip`. So a raised ledge shows its top when you stand higher, a short wall
  // hides what's behind it only up to its own top, and tall walls (peaks, the great wood, gate towers) show over everything.
  // Walls indoors reach the ceiling (L.ceilH, 1 unless a room is built taller) and end the march.
  // Per column, up to OCC occluders (distance, rows they cover) are kept for the sprite pass.
  const maxSteps = outdoor ? 150 : 64; const triW = (v) => 1 - 2 * Math.abs(v - Math.floor(v) - 0.5);
  const ceilH = outdoor ? 1 : (L.ceilH || 1);
  const wallH = (ti, along, tx) => {
    if (!ti.tall) return outdoor ? 1 : ceilH;
    let h = ti.tall;
    if (ti.jag === 'peak') h *= 0.55 + 0.3 * triW(along * 0.23) + 0.15 * triW(along * 0.71 + 0.4);
    else if (ti.jag === 'trees') h *= 0.8 + 0.2 * Math.sqrt(Math.abs(Math.sin(along * 1.7)));
    else if (ti.jag === 'battlement' && ((tx >> 3) & 1)) h += 0.18;
    return h;
  };
  // a face: the side of a cell, from height h0 up to h1, at distance pd. Returns the top row it reaches.
  const drawFace = (x, ti, tile, side, pd, rdx, rdy, mx, my, h0, h1, along, tx, clip) => {
    const dist = Math.max(0.05, pd); const lh = H / dist;
    const th = L.towerTheme && L.towerTheme[my * L.w + mx]; const tname = ti.wall || ti.side || 'brick'; const tex = (th && TEX[tname + '@' + th]) || texFor(tname, L) || TEX.brick;
    const lf = (dark ? darkLight(cam.x + rdx * pd, cam.y + rdy * pd, dist) : lightFor(kind, dist)) * (side ? 0.78 : 1);
    const fogF = outdoor ? (ti.tall ? clamp((dist - 14) / 40, 0, 0.6) : clamp((dist - 9) / 9, 0, 0.85)) : 0;
    const top = hz + (eye - h1) * lh, bot = hz + (eye - h0) * lh;
    const y0 = Math.max(0, Math.round(top)), y1 = Math.min(H, Math.round(bot), clip);
    const snowLine = h1 - 0.5 - 0.3 * triW(along * 1.3);
    for (let y = y0; y < y1; y++) {
      const z = eye - (y - hz) / lh; const ty = ((1 - (z - Math.floor(z))) * TS) | 0; let c = tex[(ty & 31) * TS + tx];
      if (ti.snow && z > snowLine) c = ((tx + ty) & 7) ? rgb(236, 242, 252) : rgb(200, 210, 230);
      if (ti.raised) c = h1 - z < 0.06 ? fogC(c, 0.4, 235, 225, 200) : shadeC(c, 0.8); // a step's edge catches the light; its riser is darker
      c = shadeC(c, lf); if (fogF > 0) c = fogC(c, fogF, fogR, fogG, fogB);
      buf[y * W + x] = c;
    }
    return Math.max(0, Math.round(top));
  };
  // a cap: the top of a cell at height h, seen from above, between distances d0 (near edge) and d1 (far edge)
  const drawCap = (x, ti, h, d0, d1, rdx, rdy, clip) => {
    const k = (eye - h) * H; if (k <= 0) return clip;
    const yN = d0 > 0.001 ? hz + k / d0 : H, yF = hz + k / d1;
    const y0 = Math.max(0, Math.ceil(yF)), y1 = Math.min(H, Math.round(yN), clip);
    const capName = ti.cap || (ti.wall && (ti.portal || ti.exitWall || ti.locked || ti.eye) ? TINFO[outdoor ? TL.ROCK : TL.BRICK].wall : ti.wall); // a doorway's top is plain stone
    let tex = ti.wall ? (texFor(capName, L) || TEX.brick) : (texFor(ti.floor || 'grass', L) || TEX.grass); if (Array.isArray(tex)) tex = tex[wf];
    const capShade = ti.wall ? 0.82 : 1;
    for (let y = y0; y < y1; y++) {
      const d = k / Math.max(0.5, y - hz); const fx = cam.x + rdx * d, fy = cam.y + rdy * d;
      let c = tex[(((fy - Math.floor(fy)) * TS) & 31) * TS + (((fx - Math.floor(fx)) * TS) & 31)];
      const lf = (dark ? darkLight(fx, fy, d) : lightFor(kind, d)) * capShade; c = shadeC(c, lf);
      if (outdoor) { const fogF = clamp((d - 9) / 9, 0, 0.85); if (fogF > 0) c = fogC(c, fogF, fogR, fogG, fogB); }
      buf[y * W + x] = c;
    }
    return Math.min(clip, Math.max(0, Math.ceil(yF)));
  };
  const OCC = 6; if (!R.occD || R.occD.length !== W * OCC) { R.occD = new Float32Array(W * OCC); R.occY = new Int16Array(W * OCC); R.occN = new Uint8Array(W); }
  const cellH = (ti) => ti.wall ? 1 : (ti.raised || 0); // (walls get their real height in the march)
  const camTi = TINFO[L.get(Math.floor(cam.x), Math.floor(cam.y))];
  let clip = H, first = 1e9, occ = 0, ob = 0; // per column (reset at the start of each)
  const occlude = (d, y) => { if (y >= clip) return; clip = y; if (first === 1e9) first = Math.max(0.05, d); if (occ < OCC) { R.occD[ob + occ] = Math.max(0.05, d); R.occY[ob + occ] = y; occ++; } else R.occY[ob + OCC - 1] = y; };
  for (let x = 0; x < W; x++) {
    const camX = 2 * x / W - 1; const rdx = dirX + plX * camX, rdy = dirY + plY * camX;
    let mx = Math.floor(cam.x), my = Math.floor(cam.y);
    const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
    let stepX, stepY, sdx, sdy;
    if (rdx < 0) { stepX = -1; sdx = (cam.x - mx) * ddx; } else { stepX = 1; sdx = (mx + 1 - cam.x) * ddx; }
    if (rdy < 0) { stepY = -1; sdy = (cam.y - my) * ddy; } else { stepY = 1; sdy = (my + 1 - cam.y) * ddy; }
    clip = H; first = 1e9; occ = 0; ob = x * OCC;
    // the cell you're standing in: if it's raised (a step, a ledge), its top is under your feet
    let prevH = camTi.wall ? 0 : (camTi.raised || 0);
    if (prevH > 0) occlude(0, drawCap(x, camTi, prevH, 0, Math.min(sdx, sdy), rdx, rdy, clip));
    let side = 0, n = 0;
    while (n++ < maxSteps && clip > 0) {
      if (sdx < sdy) { sdx += ddx; mx += stepX; side = 0; } else { sdy += ddy; my += stepY; side = 1; }
      const pd = side === 0 ? sdx - ddx : sdy - ddy;
      if (mx < 0 || my < 0 || mx >= L.w || my >= L.h) { if (!outdoor) { drawFace(x, TINFO[TL.BRICK], TL.BRICK, side, pd, rdx, rdy, mx, my, prevH, ceilH, 0, 0, clip); occlude(pd, 0); } break; }
      const tile = L.tiles[my * L.w + mx]; const ti = TINFO[tile];
      const hc0 = cellH(ti); if (hc0 <= 0 && prevH <= 0) continue; // plain ground: the floor pass already has it
      let wx = side === 0 ? cam.y + pd * rdy : cam.x + pd * rdx; const along = wx; wx -= Math.floor(wx);
      let tx = (wx * TS) | 0; if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = TS - 1 - tx;
      const hc = ti.wall ? wallH(ti, along, tx) : hc0;
      if (hc > prevH + 1e-4) { const top = drawFace(x, ti, tile, side, pd, rdx, rdy, mx, my, prevH, hc, along, tx, clip); if (eye <= hc) occlude(pd, top); }
      if (hc > 0 && eye > hc) occlude(pd, drawCap(x, ti, hc, pd, Math.min(sdx, sdy), rdx, rdy, clip)); // seen from above
      prevH = hc;
      if (ti.wall && !outdoor) { occlude(pd, 0); break; } // indoors, a wall meets the ceiling: nothing behind it shows
      if (outdoor && clip <= hz - (3.5 - eye) * H / Math.max(0.05, pd)) break; // nothing farther can reach above what's painted
    }
    R.zbuf[x] = first; R.occN[x] = occ;
  }
  // --- sprites ---
  const sprites = [];
  const rad = 16; const cx0 = Math.max(0, Math.floor(cam.x) - rad), cx1 = Math.min(L.w - 1, Math.floor(cam.x) + rad), cy0 = Math.max(0, Math.floor(cam.y) - rad), cy1 = Math.min(L.h - 1, Math.floor(cam.y) + rad);
  for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) { const pr = L.props[y * L.w + x]; if (pr) sprites.push({ x: x + 0.5, y: y + 0.5, spr: SPR[PROPS[pr]], sc: PROP_INFO[pr].scale, z: heightAt(L, x + 0.5, y + 0.5), fl: pr === PR.FLAME ? 8 : 0 }); }
  for (const e of ents) {
    const s = animFrame(e[1], R.time, e[0], e[6] & 2); if (!s) continue; // stunned enemies freeze
    sprites.push({ x: e[2], y: e[3], spr: s, sc: e[4], z: e[5] + heightAt(L, e[2], e[3]), fl: e[6], price: e[7], id: e[0], elite: e[10] || 0 });
  }
  for (const p of players) {
    if (p[0] === myId || p[1] !== L.id) continue;
    const ang = Math.atan2(p[3] - cam.y, p[2] - cam.x); const rel = angDiff(p[4], ang + Math.PI);
    let dir = Math.abs(rel) < 0.8 ? 'front' : Math.abs(rel) > 2.35 ? 'back' : rel > 0 ? 'side_l' : 'side';
    const col = (PCOLORS.find(c => c.name === p[5]) || PCOLORS[0]).c;
    // run cycle from how fast this player is actually moving
    const an = R.anim[p[0]] || (R.anim[p[0]] = { x: p[2], y: p[3], t: R.time, ph: 0, spd: 0 });
    const ddt = Math.max(0.001, R.time - an.t); const sp = Math.hypot(p[2] - an.x, p[3] - an.y) / ddt;
    if (ddt > 0) { an.spd = an.spd * 0.8 + Math.min(10, sp) * 0.2; an.x = p[2]; an.y = p[3]; an.t = R.time; }
    let fr = -1, rsc = 1, flip = false;
    if (p[8] && an.spd > 0.8) { an.ph += ddt * 9; const step = Math.floor(an.ph); fr = RUN_SEQ[step % 4]; rsc = RUN_SCALE[step % 4]; flip = (dir === 'front' || dir === 'back') && (Math.floor(step / 4) & 1); } else an.ph = 0;
    const s = heroSpriteRun(p[7], col, p[6], dir, fr, flip);
    sprites.push({ x: p[2], y: p[3], spr: s, sc: 0.78 * rsc, z: (p[8] ? 0 : -0.45) + (p[15] || 0), fl: p[8] ? (p[9] > 0 ? 16 : 0) : 32, name: p[10], col, aura: p[7] === 'monk' ? p[6] : 0 });
  }
  for (const s of sprites) { const dx = s.x - cam.x, dy = s.y - cam.y; s.d = dx * dx + dy * dy; }
  sprites.sort((a, b) => b.d - a.d);
  const invDet = 1 / (plX * dirY - dirX * plY);
  for (const s of sprites) {
    const sx = s.x - cam.x, sy = s.y - cam.y;
    const tX = invDet * (dirY * sx - dirX * sy), tY = invDet * (-plY * sx + plX * sy);
    if (tY <= 0.1) continue;
    const scrX = Math.round((W / 2) * (1 + tX / tY));
    const hgt = (H / tY) * s.sc; const wid = hgt * s.spr.w / s.spr.h;
    const botY = hz + (eye - s.z) * (H / tY); const topY = botY - hgt;
    const x0 = Math.round(scrX - wid / 2), x1 = Math.round(scrX + wid / 2); const y0 = Math.round(topY), y1 = Math.round(botY);
    if (x1 < 0 || x0 >= W || y1 < 0 || y0 >= H) continue;
    const dist = Math.sqrt(s.d); let lf = dark ? darkLight(s.x, s.y, dist) : lightFor(kind, dist); if (s.fl & 8) lf = 1;
    const fogF = outdoor ? clamp((dist - 9) / 9, 0, 0.85) : 0;
    const hurt = (s.fl & 1) && (Math.floor(t * 20) & 1); const stun = s.fl & 2; const ghost = s.fl & 4; const down = s.fl & 32;
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      let lim = H; for (let k = 0, ob = x * OCC; k < R.occN[x]; k++) { if (R.occD[ob + k] < tY) lim = R.occY[ob + k]; else break; } // rows from lim down are behind a wall or ledge
      if (lim <= 0) continue;
      const tx = Math.floor((x - x0) / (x1 - x0) * s.spr.w); if (tx < 0 || tx >= s.spr.w) continue;
      for (let y = Math.max(0, y0); y < Math.min(H, y1, lim); y++) {
        const ty = Math.floor((y - y0) / (y1 - y0) * s.spr.h); let c = s.spr.px[ty * s.spr.w + tx]; if (!c) continue;
        if (ghost && ((x + y + (t * 30 | 0)) & 1)) continue;
        if (hurt) c = (ty + tx) & 1 ? rgb(255, 255, 255) : rgb(255, 60, 40); else if (stun) c = fogC(c, 0.45, 120, 180, 255);
        if (down) { const g = ((c & 255) + ((c >> 8) & 255) + ((c >> 16) & 255)) / 3 | 0; c = rgb(g, g, g + 30); }
        if (s.elite) { const el = eliteByIdx(s.elite); if (el) { const ec = el.color; c = fogC(c, el.tint || 0.3 + 0.12 * Math.sin(t * 6), ec[0], ec[1], ec[2]); } }
        c = shadeC(c, lf); if (fogF > 0) c = fogC(c, fogF, fogR, fogG, fogB);
        buf[y * W + x] = c;
      }
    }
    if (s.elite && dist < 12 && eliteByIdx(s.elite)) {
      const el = eliteByIdx(s.elite), ec = el.color; const ecc = rgb(ec[0], ec[1], ec[2]);
      for (let i = 0; i < 5; i++) { const ax = scrX + Math.round((Math.random() - 0.5) * wid * 1.2), ay = Math.round(topY + Math.random() * hgt); if (ax >= 0 && ax < W && tY < R.zbuf[ax]) px(ax, ay, ecc); }
      if (dist < 7 && scrX > 0 && scrX < W && tY < R.zbuf[scrX]) textC(el.name, scrX, Math.max(2, y0 - 10), ecc);
    }
    // aura for monk teammates
    if (s.aura) { const ac = s.aura === 2 ? rgb(255, 250, 210) : rgb(110, 200, 255); for (let i = 0; i < 6; i++) { const ax = scrX + Math.round((Math.random() - 0.5) * wid), ay = Math.round(topY + Math.random() * hgt); if (ax >= 0 && ax < W && tY < R.zbuf[ax]) px(ax, ay, ac); } }
    // labels: names & prices
    if (s.name && dist < 14) { const c = c32(hexToRgb(s.col)); if (scrX > 0 && scrX < W && tY < R.zbuf[scrX]) textC(s.name, scrX, Math.max(2, y0 - 10), c); }
    if (s.price && dist < 5 && scrX > 0 && scrX < W && tY < R.zbuf[scrX]) { if (s.price > 0) textC(String(s.price), scrX, y1 + 2, rgb(255, 255, 255)); else textC(-s.price + '♥', scrX, y1 + 2, rgb(255, 120, 120)); }
  }
}

// ---- view model (hands / weapons) ----
function drawViewmodel(st) {
  const W = R.W, H = R.H; const me = st.me; if (!me) return;
  const bob = st.bob; const bx = Math.sin(bob) * 4, by = Math.abs(Math.cos(bob)) * 4;
  const col = hexToRgb((PCOLORS.find(c => c.name === me.color) || PCOLORS[0]).c);
  const tier = me.cls === 'monk' ? 0 : me.armor; const pal = tunicPal(c32ToHex(col), tier === 1 ? 0 : tier); // chain is worn over the cloth sleeve (rings drawn below)
  const chain = tier === 1 ? chainCols(c32ToHex(col)) : null;
  // Armor on a forearm curve (bez(t) along the arm from the shoulder, rr(t) its radius, brush paints along it):
  // chain = rings from the shoulder to the elbow; plate = a rounded pauldron at the shoulder, banded lames and rivets,
  // and a bracer edge just above the cuff.
  const sleeveArmor = (bez, rr, brush, cuffT) => {
    const nrm = (t) => { const [x, y] = bez(t), [x2, y2] = bez(Math.min(1, t + 0.01)); let nx = -(y2 - y), ny = x2 - x; const l = Math.hypot(nx, ny) || 1; return [x, y, nx / l, ny / l]; };
    if (chain) {
      const ELB = 0.42, ring = c32(chain.ring), gap = c32(chain.gap);
      brush(0, ELB, 0, gap, 0); let row = 0, lastX = null, lastY = null;
      for (let i = 0; i <= 400; i++) { const t = ELB * i / 400; const [x, y, nx, ny] = nrm(t); if (lastX != null && Math.hypot(x - lastX, y - lastY) < 3.5) continue; lastX = x; lastY = y; row++;
        const r = rr(t) - 1.5; for (let o = -r + (row & 1) * 2; o <= r; o += 4) { const cx3 = Math.round(x + nx * o), cy3 = Math.round(y + ny * o); for (const [ax, ay] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) px(cx3 + ax, cy3 + ay, ring); } }
      { const [x, y, nx, ny] = nrm(ELB); const r = rr(ELB); for (let o = -r; o <= r; o += 1) { const hx2 = Math.round(x + nx * o), hy2 = Math.round(y + ny * o); px(hx2, hy2, gap); if ((Math.round(o) & 1) === 0) px(hx2 + 1, hy2, ring); } }
    }
    if (tier === 2) {
      for (const t of [0.2, 0.34, 0.48, 0.62]) brush(t, t + 0.012, 0, sleeveD, 0); // lames
      brush(cuffT - 0.1, cuffT - 0.085, 0, sleeveH, 0); // bracer edge
      for (const t of [0.27, 0.41, 0.55]) { const [x, y, nx, ny] = nrm(t); const r = rr(t) * 0.55; px(Math.round(x + nx * r), Math.round(y + ny * r), sleeveH); px(Math.round(x - nx * r), Math.round(y - ny * r), sleeveH); } // rivets
      const [x, y] = bez(0.14); const R0 = Math.round(rr(0.14) * 1.25); // pauldron
      disc(Math.round(x), Math.round(y), R0 + 2, rgb(20, 18, 28)); disc(Math.round(x), Math.round(y), R0, sleeve); disc(Math.round(x - R0 * 0.25), Math.round(y - R0 * 0.3), Math.round(R0 * 0.55), sleeveH);
      for (let k = 0; k < 2; k++) { const rr2 = R0 - 3 - k * 4; if (rr2 > 2) for (let a = -2.6; a < -0.4; a += 0.05) px(Math.round(x + Math.cos(a) * rr2), Math.round(y + Math.sin(a) * rr2), sleeveD); }
    }
  };
  const plateCols = tier === 2 ? [mix(STEEL, col, 0.12), mix(STEEL_D, col, 0.12), mix(STEEL_H, STEEL, 0.55)] : null; // plate arms are steel through and through
  const sleeve = c32(plateCols ? plateCols[0] : pal.T), sleeveD = c32(plateCols ? plateCols[1] : pal.t), sleeveH = c32(plateCols ? plateCols[2] : pal.h); const skin = c32(hexToRgb(PAL.s)), skinD = c32(hexToRgb(PAL.S));
  const drawSleeve = (x, y, w, h) => {
    rect(x, y, w, h, sleeve); rect(x, y, 3, h, sleeveD);
    if (tier === 1) for (let j = 0; j < h; j += 2) for (let i = (j / 2) & 1; i < w; i += 2) px(x + i, y + j, sleeveH);
    if (tier === 2) { rect(x + w - 6, y, 3, h, sleeveH); for (let j = 4; j < h; j += 8) rect(x, y + j, w, 1, sleeveD); rect(x + 4, y + 2, 2, 2, rgb(255, 255, 255)); }
  };
  if (me.cls === 'monk') {
    const p = st.punch; // {side, t}
    const auraC = me.armor === 2 ? rgb(255, 248, 200) : me.armor === 1 ? rgb(110, 200, 255) : 0;
    for (const side of [-1, 1]) {
      let fx = W / 2 + side * W * 0.26 + bx, fy = H - 44 + by; let sc = 1;
      let turn = 0; // the forearm rolls over as it punches (0 guard .. 1 fully turned, thumb tucked out of sight underneath)
      if (p && p.side === side && p.t < 0.22) { const k = Math.sin(p.t / 0.22 * Math.PI); fx = lerp(fx, W / 2 + side * 6, k); fy = lerp(fy, H / 2 + 4, k); sc = 1 + k * 0.5; turn = Math.min(1, k * 1.6); }
      if (st.charge > 0) { fx = lerp(fx, W / 2 + side * 14, Math.min(1, st.charge * 2)); fy = lerp(fy, H - 46, Math.min(1, st.charge * 2)); }
      // muscular forearm: a round-brush stroke that bulges near the elbow and narrows into a wrapped wrist,
      // shaded darker on the outside edge with a muscle groove, then a wrapped fist with knuckles and a thumb
      const OUT = rgb(20, 18, 28), skinL = c32(hexToRgb('#f8d4b0')), skinS = c32(hexToRgb('#a86440')), wrap = rgb(240, 234, 216), wrapD = rgb(186, 176, 154);
      const ex = W / 2 + side * W * 0.5, ey = H + 34; // elbow, off-screen below
      const ax = fx - ex, ay = fy - ey, al = Math.hypot(ax, ay) || 1, dx = ax / al, dy = ay / al, qx = -dy * side, qy = dx * side; // q points to the outer edge
      const rr = (t) => sc * (11 + 6 * Math.pow(Math.sin(Math.PI * Math.min(1, (1 - t) * 1.15)), 1.5) - 2.5 * t); // big bulge near the elbow
      const pt = (t, o) => [ex + ax * t + qx * o, ey + ay * t + qy * o];
      const stroke = (t0, t1, r, c, off) => { for (let i = Math.round(t0 * 60); i <= Math.round(t1 * 60); i++) { const t = i / 60; const [x, y] = pt(t, off ? off * rr(t) : 0); disc(Math.round(x), Math.round(y), Math.max(1, Math.round(r(t))), c); } };
      stroke(0, 0.86, (t) => rr(t) + 1.5, OUT); stroke(0, 0.86, rr, skin);
      const fl = turn > 0.5 ? -1 : 1; // rolled over: the light and shadow sides swap
      stroke(0.05, 0.8, (t) => rr(t) * 0.45, skinD, 0.55 * fl);       // shadow along the outside
      stroke(0.08, 0.6, (t) => rr(t) * 0.14, skinS, 0.12 * fl);       // the groove between the forearm muscles
      stroke(0.12, 0.5, (t) => rr(t) * 0.35, skinL, -0.18 * fl);     // the muscle bulging up on the inside
      stroke(0.05, 0.75, (t) => rr(t) * 0.28, skinL, -0.5 * fl);      // light on the inside edge
      // wrist wraps
      stroke(0.78, 0.92, (t) => rr(t) * 0.92 + 1, OUT); stroke(0.78, 0.92, (t) => rr(t) * 0.92, wrap);
      for (const t of [0.81, 0.86]) { const [x, y] = pt(t, 0); thickLine(x - qx * rr(t), y - qy * rr(t), x + qx * rr(t), y + qy * rr(t), 1, wrapD); }
      // fist: drawn in arm space (u toward the knuckles, v across), knuckles bumping out along the far edge
      const U = 12.5 * sc, V = 14 * sc; const fcx = fx + dx * 2 * sc, fcy = fy + dy * 2 * sc;
      for (let yy = -Math.ceil(U + V); yy <= U + V; yy++) for (let xx = -Math.ceil(U + V); xx <= U + V; xx++) {
        const u = xx * dx + yy * dy, v = xx * qx + yy * qy;
        const kn = 2.2 * sc * Math.max(0, Math.cos((v / V) * Math.PI * 2)); // four knuckle bumps
        const e = Math.pow(Math.abs(u) / (U + (u > 0 ? kn : 0)), 4) + Math.pow(Math.abs(v) / V, 4); if (e > 1) continue;
        let c;
        if (e > 0.72) c = OUT;
        else if (u < -U * 0.3) c = (Math.abs(((u + 40) % (4 * sc))) < 0.9) ? wrapD : wrap;          // wraps around the base of the hand
        else c = v * fl > V * 0.45 ? skinD : (u > U * 0.6 ? skinL : skin);                              // bare knuckles
        if (u >= -U * 0.1 && e <= 0.72 && Math.abs(((v / V) * 2 + 4) % 1 - 0.5) > 0.44) c = skinS;    // creases between the fingers
        if (u > U * 0.25 && u < U * 0.38 && e <= 0.72) c = skinD;                                      // the fold where the fingers curl under
        px(Math.round(fcx + xx), Math.round(fcy + yy), c);
      }
      // thumb folded across the front of the fist, on the inner side
      if (turn < 0.35) { const t0 = [fcx + qx * V * 0.8 - dx * U * 0.35, fcy + qy * V * 0.8 - dy * U * 0.35], t1 = [fcx + qx * V * 0.15 + dx * U * 0.05, fcy + qy * V * 0.15 + dy * U * 0.05]; // on the outer side of each fist
        const tr = 3.2 * sc; for (const [r, c] of [[tr + 1.2, OUT], [tr, skin]]) for (let i = 0; i <= 12; i++) { const t = i / 12; disc(Math.round(lerp(t0[0], t1[0], t)), Math.round(lerp(t0[1], t1[1], t)), Math.max(1, Math.round(r)), c); }
        disc(Math.round(t1[0]), Math.round(t1[1]), Math.max(1, Math.round(tr * 0.55)), rgb(255, 214, 206)); } // thumb folded across the fingers, nail at the tip
      const fw = U * 2, fh = V * 2;
      if (auraC) for (let i = 0; i < 10; i++) px(fx + (Math.random() - 0.5) * fw * 1.6, fy + (Math.random() - 0.5) * fh * 1.8, auraC);
    }
    if (st.charge > 0) { const r = Math.min(14, 3 + st.charge * 10) | 0; disc(W / 2, H - 48, r + 2, rgb(80, 200, 255), 0.5); disc(W / 2, H - 48, r, rgb(220, 250, 255)); if (st.charge > 0.8) for (let i = 0; i < 12; i++) { const a = Math.random() * TAU; thickLine(W / 2, H - 48, W / 2 + Math.cos(a) * (r + 10), H - 48 + Math.sin(a) * (r + 10), 1, rgb(200, 240, 255)); } }
    return;
  }
  // sword class: shield on left, sword on right
  const sw = st.swing; const k = sw != null && sw < 0.25 ? sw / 0.25 : -1;
  // shield, seen from behind: the upper arm comes up from the bottom-left, bends at the elbow, and the forearm lies
  // across the back of the shield through a strap, with the fist closed on an upright grip near the far edge.
  // Standing still it comes up bigger (ready to block); running it swings low with your stride; a block knocks it back.
  {
    // low and out of the way while you move or fight; after a moment standing still it comes up and out, ready to block
    const mk = st.moveK, ready = st.readyK != null ? st.readyK : 1 - mk; const bk = st.blockT > 0 ? Math.sin(Math.min(1, st.blockT / 0.32) * Math.PI) : 0;
    const sc = 0.92 + ready * 0.32 - bk * 0.08;
    const sway = Math.sin(st.bob) * 6 * mk, lift = Math.abs(Math.cos(st.bob)) * 5 * mk;
    const shx = W * 0.27 - ready * W * 0.02 + sway + bk * 7 + (Math.random() - 0.5) * bk * 4;
    const shy = H - 12 - ready * 34 + lift + bk * 10;
    const sw = Math.round(50 * sc), sh = Math.round(58 * sc); const x0 = Math.round(shx - sw / 2), y0 = Math.round(shy - sh / 2);
    const rim = bk > 0.3 ? rgb(255, 255, 255) : st.mirror && ready > 0.8 ? ((Math.floor(R.time * 12) & 1) ? rgb(255, 236, 150) : rgb(255, 255, 230)) : rgb(176, 178, 194), rimD = rgb(96, 98, 116); const ws = st.wardShield; const wood = ws ? rgb(78, 84, 100) : rgb(116, 76, 40), woodD = ws ? rgb(48, 52, 64) : rgb(78, 50, 26), woodH = ws ? rgb(112, 120, 138) : rgb(140, 94, 52); // st.mirror: the perfect-block moment, the rim shines
    const halfW = (j) => { const f = j / sh; if (j < 2) return sw / 2 - (2 - j); return f < 0.42 ? sw / 2 : (sw / 2) * (1 - Math.pow((f - 0.42) / 0.58, 1.7)); }; // round top corners, sides curving into the point
    for (let j = 0; j < sh; j++) {
      const hw = halfW(j); const xl = Math.round(shx - hw), xr = Math.round(shx + hw); if (xr <= xl) continue;
      rect(xl, y0 + j, xr - xl, 1, rgb(20, 18, 28));
      if (xr - xl > 4 && j > 1 && j < sh - 2) {
        rect(xl + 1, y0 + j, xr - xl - 2, 1, rim); rect(xl + 1, y0 + j, 1, 1, rimD);
        if (j > 3 && j < sh - 4 && xr - xl > 8) for (let x = xl + 3; x < xr - 3; x++) { const plank = ((x - x0) % 9) === 0; px(x, y0 + j, plank ? woodD : (x < shx - hw * 0.4 ? woodH : wood)); }
      }
    }
    // the Wardhold shield: steel bands and rivets on the back, and while its ward is ready, a soft glow creeps round the rim
    if (ws) { for (let j = 6; j < sh - 6; j += 9) { const hw = halfW(j); for (let x = Math.round(shx - hw) + 3; x < Math.round(shx + hw) - 3; x++) px(x, y0 + j, rgb(150, 156, 172)); px(Math.round(shx - hw) + 4, y0 + j + 1, rgb(210, 214, 226)); px(Math.round(shx + hw) - 5, y0 + j + 1, rgb(210, 214, 226)); } }
    if (ws && st.ward && ready > 0.5) { const ph = R.time * 3; for (let i = 0; i < 10; i++) { const j = Math.floor(((i / 10 + ph * 0.1) % 1) * sh); const hw = halfW(j); const side = i & 1 ? 1 : -1; px(Math.round(shx + side * hw), y0 + j, (i + Math.floor(R.time * 8)) % 3 ? rgb(255, 214, 120) : rgb(255, 246, 200)); } }
    if (st.blockT > 0) for (let i = 0; i < 6; i++) { const a = Math.random() * TAU, r = sw * 0.6 + Math.random() * 6; px(shx + Math.cos(a) * r, shy - sh * 0.1 + Math.sin(a) * r * 0.8, rgb(255, 240, 160)); }
    const aw = 13 * sc; // arm thickness
    const fy = y0 + sh * 0.4;                         // forearm height
    const elx = x0 - sw * 0.32, ely = fy + aw * 0.2;  // elbow, just off the shield's left edge
    const gx = x0 + sw * 0.72;                        // the grip, toward the far edge
    const shoulderX = elx - aw * 0.4, shoulderY = H + 16;
    // the grip bar (behind the fist)
    rect(gx - 2, fy - aw * 0.95, 5, aw * 1.9, woodD); rect(gx - 2, fy - aw * 0.95, 1, aw * 1.9, woodH);
    // the whole arm is one smooth curve (shoulder -> elbow bend -> forearm), painted with a round brush:
    // dark outline, sleeve, then a soft highlight along the top
    // no elbow in view: the forearm sweeps up from the bottom-left corner and levels out across the shield (per the sketch)
    const P0x = x0 - sw * 0.75, P0y = H + aw * 1.2, P1x = x0 + sw * 0.08, P1y = fy + aw * 0.55, P2x = gx - aw * 0.3, P2y = fy - aw * 0.1;
    const bez = (t) => { const u = 1 - t; return [u * u * P0x + 2 * u * t * P1x + t * t * P2x, u * u * P0y + 2 * u * t * P1y + t * t * P2y]; };
    const steps = 70, rr = (t) => (aw / 2) * (1.55 - 0.7 * t); // wide near you, narrowing toward the wrist
    // we see the UNDERSIDE of the forearm: shadow along its top edge, the sleeve ends in a cuff,
    // and the bare inner wrist leads into fingers curled around the grip toward us
    const cuffT = 0.86; const skinL = c32(hexToRgb('#f8d4b0'));
    const brush = (t0, t1, grow, c, dy, scale) => { for (let i = Math.round(t0 * steps); i <= Math.round(t1 * steps); i++) { const t = i / steps; const [bx2, by2] = bez(t); const r = (scale ? rr(t) * scale : rr(t)) + grow; disc(Math.round(bx2), Math.round(by2 + dy * rr(t)), Math.max(1, Math.round(r)), c); } };
    brush(0, 1, 1.5, rgb(20, 18, 28), 0);                 // outline
    brush(0, cuffT, 0, sleeve, 0);                          // sleeve
    brush(0, cuffT, 0, sleeveD, -0.62, 0.4);                // shadow on the top edge (the side facing away)
    if (tier >= 2) brush(0, cuffT, 0, sleeveH, 0.3, 0.22);  // plate: metal sheen on the underside
    sleeveArmor(bez, rr, brush, cuffT);
    brush(cuffT - 0.04, 1, 0, skin, 0); brush(cuffT, 1, 0, skinL, 0.25, 0.4); // inner wrist
    { const [cx2, cy2] = bez(cuffT - 0.04); const r = rr(cuffT); rect(Math.round(cx2) - 1, Math.round(cy2 - r + 1), 3, Math.round(r * 2 - 1), sleeveD); }
    // hand: the grip bar shows above and below; four fingers wrap around it in front, tips curling back toward the wrist
    const fr = Math.round(aw * 0.55); const fcx = Math.round(gx - fr * 0.1), fcy = Math.round(fy - aw * 0.1);
    rect(gx - 2, fcy - fr * 2.1, 5, fr * 4.2, woodD); rect(gx - 2, fcy - fr * 2.1, 1, fr * 4.2, woodH); frame(gx - 3, fcy - fr * 2.1 - 1, 7, fr * 4.2 + 2, rgb(20, 18, 28));
    const fh2 = Math.max(3, Math.round(fr * 0.52)), fwid = Math.round(fr * 1.35);
    for (let k = 0; k < 4; k++) {
      const y = Math.round(fcy - fh2 * 2 + k * fh2), x = Math.round(gx - fwid * 0.45);
      for (let yy = 0; yy < fh2; yy++) for (let xx = 0; xx < fwid; xx++) { const ex = (xx - fwid / 2) / (fwid / 2), ey = (yy - fh2 / 2 + 0.5) / (fh2 / 2); const e = ex * ex * 0.6 + ey * ey; if (e > 1.05) continue; px(x + xx, y + yy, e > 0.7 ? (yy >= fh2 - 1 ? rgb(20, 18, 28) : skinD) : (ey < -0.2 ? skinL : skin)); }
      px(x + 1, y + (fh2 >> 1), rgb(236, 200, 180)); // fingertip
    }
    // the strap loop the forearm passes through, on the left part of the shield
    { const t = 0.72; const [sx2, sy2] = bez(t); const r = rr(t); const lw = Math.max(4, Math.round(5 * sc)), lh = Math.round(r * 2 + 6);
      const lx = Math.round(sx2 - lw / 2), ly = Math.round(sy2 - lh / 2);
      for (let j = 0; j < lh; j++) { const e = Math.abs(j - lh / 2) / (lh / 2); const inset = e > 0.8 ? 1 : 0; rect(lx + inset, ly + j, lw - inset * 2, 1, rgb(70, 44, 24)); px(lx + inset, ly + j, rgb(120, 80, 44)); }
      frame(lx, ly, lw, lh, rgb(20, 18, 28)); px(lx + (lw >> 1), Math.round(sy2), rgb(220, 200, 80)); }
  }
  if (me.sword > 0) {
    let ang, hx, hy;
    const rev = st.swingDir === -1; // the backswing (and every other lunge slash) runs the other way
    const gk = Math.min(1, (st.grip || 0) / 0.15); // reverse grip: blade flipped down along your side, pommel toward the foe
    const pk = st.pommelT != null ? Math.sin(Math.min(1, st.pommelT / 0.3) * Math.PI) : 0; // the pommel driving forward
    if (k >= 0) { const kk = rev ? 1 - k : k; ang = lerp(-0.4, -2.6, kk); hx = lerp(W * 0.78, W * 0.42, kk) + bx; hy = lerp(H - 22, H - 44, Math.sin(kk * Math.PI)) + by; }
    else if (gk > 0 || pk > 0) { const g = Math.max(gk, pk); ang = lerp(-0.95, 1.95, g); hx = lerp(W * 0.8, W * 0.74, g) - pk * W * 0.14 + bx; hy = lerp(H - 10, H - 62, g) - pk * 30 + by;
      if (st.grip > 0.3) { hx += (Math.random() - 0.5) * Math.min(2, st.grip); hy += (Math.random() - 0.5) * Math.min(2, st.grip); } } // trembling as it builds
    else { ang = -0.95; hx = W * 0.8 + bx; hy = H - 10 + by; } // resting low at your side
    const len = 70; const tipX = hx + Math.cos(ang) * len, tipY = hy + Math.sin(ang) * len;
    const blade = me.sword === 1 ? rgb(170, 120, 60) : me.sword === 2 ? rgb(220, 226, 240) : me.sword === 3 ? rgb(130, 240, 255) : rgb(255, 236, 150);
    const bladeD = me.sword === 1 ? rgb(110, 70, 30) : me.sword === 2 ? rgb(130, 136, 160) : me.sword === 3 ? rgb(40, 150, 200) : rgb(230, 140, 40);
    const gx = hx + Math.cos(ang) * 8, gy = hy + Math.sin(ang) * 8; // the guard sits right on top of the fist: you hold it up by the hilt
    thickLine(gx, gy, tipX, tipY, (t) => 7 - t * 4, bladeD); thickLine(gx, gy, tipX, tipY, (t) => 4 - t * 3, blade);
    const pa = ang + Math.PI / 2; thickLine(gx + Math.cos(pa) * 10, gy + Math.sin(pa) * 10, gx - Math.cos(pa) * 10, gy - Math.sin(pa) * 10, 4, rgb(230, 190, 60));
    if (me.sword >= 4) for (let i = 0; i < 5; i++) { const tt = Math.random(); px(lerp(gx, tipX, tt) + (Math.random() - 0.5) * 8, lerp(gy, tipY, tt) + (Math.random() - 0.5) * 8, Math.random() < 0.5 ? rgb(255, 255, 220) : rgb(255, 180, 60)); }
    if (me.sword === 3) for (let i = 0; i < 3; i++) { const tt = Math.random(); px(lerp(gx, tipX, tt) + (Math.random() - 0.5) * 6, lerp(gy, tipY, tt) + (Math.random() - 0.5) * 6, rgb(220, 255, 255)); }
    if (st.lungeReady) for (let i = 0; i < 6; i++) { const tt = Math.random(); px(lerp(gx, tipX, tt) + (Math.random() - 0.5) * 10, lerp(gy, tipY, tt) + (Math.random() - 0.5) * 10, rgb(255, 255, 255)); } // ready to lunge: the blade glints
    if (k >= 0 && k < 1) { for (let i = 0; i < 5; i++) { const a2 = lerp(rev ? -2.6 : -0.4, ang, i / 5); thickLine(hx + Math.cos(a2) * 40, hy + Math.sin(a2) * 40, hx + Math.cos(a2) * 66, hy + Math.sin(a2) * 66, 1, rgb(255, 255, 255)); } }
    // sword hand, drawn like the shield hand: the grip and pommel, then a curved forearm from the bottom-right
    // (shadow on its far edge, cuff, bare wrist), then four fingers wrapped around the grip with the thumb over them
    const dx = Math.cos(ang), dy = Math.sin(ang), qx = -dy, qy = dx; const OUT = rgb(20, 18, 28); const skinL = c32(hexToRgb('#f8d4b0'));
    thickLine(hx - dx * 8, hy - dy * 8, gx, gy, 6, OUT); thickLine(hx - dx * 8, hy - dy * 8, gx, gy, 4, rgb(96, 60, 32)); // leather grip
    disc(Math.round(hx - dx * 10), Math.round(hy - dy * 10), 4, OUT); disc(Math.round(hx - dx * 10), Math.round(hy - dy * 10), 3, rgb(230, 190, 60)); // pommel
    const aw = 15;
    const P0x = hx + 40, P0y = H + 14, P1x = hx + 26, P1y = hy + 22, P2x = hx + 3, P2y = hy + 6;
    const bez = (t) => { const u = 1 - t; return [u * u * P0x + 2 * u * t * P1x + t * t * P2x, u * u * P0y + 2 * u * t * P1y + t * t * P2y]; };
    const steps = 50, rr = (t) => (aw / 2) * (1.45 - 0.6 * t), cuffT = 0.8;
    const brush = (t0, t1, grow, c, off, scale) => { for (let i = Math.round(t0 * steps); i <= Math.round(t1 * steps); i++) { const t = i / steps; const [bx2, by2] = bez(t); const r = (scale ? rr(t) * scale : rr(t)) + grow; disc(Math.round(bx2 + off * rr(t) * 0.6), Math.round(by2 - off * rr(t) * 0.6), Math.max(1, Math.round(r)), c); } };
    brush(0, 1, 1.5, OUT, 0); brush(0, cuffT, 0, sleeve, 0); brush(0, cuffT, 0, sleeveD, 0.9, 0.4); if (tier >= 2) brush(0, cuffT, 0, sleeveH, -0.5, 0.22); sleeveArmor(bez, rr, brush, cuffT);
    brush(cuffT - 0.04, 1, 0, skin, 0); brush(cuffT, 1, 0, skinL, -0.4, 0.4);
    brush(cuffT - 0.06, cuffT - 0.02, 0, sleeveD, 0); // cuff
    // fist, drawn in grip space (u along the grip toward the blade, v across it): a rounded clump with finger creases
    // on the far side, and the thumb wrapped over the near side with its nail toward the guard
    { const U = 6.5, V = 6.5;
      for (let yy = -10; yy <= 10; yy++) for (let xx = -10; xx <= 10; xx++) {
        const u = xx * dx + yy * dy, v = xx * qx + yy * qy; const e = Math.pow(Math.abs(u) / U, 3) + Math.pow(Math.abs(v) / V, 3);
        if (e > 1) continue; let c = e > 0.62 ? OUT : (v > 2.5 ? skinD : skin);
        if (e <= 0.62 && v > -0.5 && (Math.abs(u + 2.6) < 0.5 || Math.abs(u) < 0.5 || Math.abs(u - 2.6) < 0.5)) c = skinD; // finger creases
        px(hx + xx, hy + yy, c);
      }
      const tb = [hx - dx * 5 - qx * 3.5, hy - dy * 5 - qy * 3.5], tt = [hx + dx * 4 - qx * 3.5, hy + dy * 4 - qy * 3.5];
      thickLine(tb[0], tb[1], tt[0], tt[1], 5, OUT); thickLine(tb[0], tb[1], tt[0], tt[1], 3, skinL);
      rect(Math.round(tt[0] - dx) - 1, Math.round(tt[1] - dy) - 1, 2, 2, rgb(255, 214, 206)); // nail
    }
  }
  // B item flash in left hand
  if (st.useFlash > 0 && st.useSpr) blit(SPR[st.useSpr], W * 0.3, H - 50, 3);
}
function c32ToHex(c) { return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }

// ---- HUD ----
// poisoned: the hearts turn purple (and pulse) until the poison runs out
function drawHearts(x, y, hp, maxHp, poison) {
  const n = Math.ceil(maxHp / 4); const full = poison ? rgb(150 + Math.round(30 * Math.sin(R.time * 6)), 60, 220) : rgb(230, 40, 40), empty = poison ? rgb(40, 18, 56) : rgb(60, 20, 30);
  for (let i = 0; i < n; i++) {
    const hx = x + (i % 10) * 8, hy = y + Math.floor(i / 10) * 8; const q = clamp(hp - i * 4, 0, 4);
    const pat = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
    for (let j = 0; j < pat.length; j++) for (let k = 0; k < 7; k++) if (pat[j][k] === '#') { const fill = k < q * 7 / 4; px(hx + k, hy + j, fill ? full : empty); }
  }
}
function drawHUD(st) {
  const W = R.W, H = R.H; const me = st.me; if (!me) return;
  // minimap
  drawMinimap(st, 4, 4, 72, 44);
  // hearts
  const hx = W - 86; drawHearts(hx, 5, me.hp, me.maxHp, me.poison > 0);
  if (me.hp <= 4 && me.alive && Math.floor(R.time * 4) & 1) frame(hx - 2, 3, 84, 10, rgb(255, 60, 60));
  // counters
  let cy = 5 + Math.ceil(Math.ceil(me.maxHp / 4) / 10) * 8 + 2;
  const counter = (spr, v, c) => { blit(SPR[spr], hx - 4, cy - 5, 1); text('X' + v, hx + 10, cy, c || rgb(255, 255, 255)); cy += 9; };
  counter('gem_g', me.gems);
  if (st.lvlKind === 'dungeon') { if (me.items.skeletonkey) counter('skelkey', '~', rgb(255, 230, 140)); else counter('key', (st.team.keys && st.team.keys[me.lvl]) || 0); } // '~' is the infinity glyph (core/font.js)
  if (me.items.bombs || me.bombs) counter('bomb', me.bombs);
  if (me.items.bow) counter('arrow', me.arrows);
  if (me.potions) counter('potion', me.potions);
  // shards
  if (st.team.shards && st.team.shards.length) { for (let i = 0; i < 8; i++) { const c = i < st.team.shards.length ? rgb(255, 180, 40) : rgb(70, 50, 30); rect(W - 86 + i * 6, cy + 1, 4, 5, c); } cy += 9; }
  if (st.team.relics && st.team.relics.length) { let rx = W - 86; for (const r of st.team.relics) { blit(SPR[itemSprite(r)], rx - 4, cy - 5, 1); rx += 14; } cy += 12; }
  // B item box
  const bx = 4, by = H - 30; rect(bx, by, 26, 26, rgb(10, 10, 20)); frame(bx, by, 26, 26, rgb(80, 140, 255));
  text('B', bx + 2, by + 2, rgb(80, 140, 255));
  const sel = st.selItem; if (sel) { blit(SPR[itemSprite(sel, me.cls)], bx + 5, by + 6, 1); text(itemName(sel, me.cls), bx + 30, by + 18, rgb(200, 210, 255)); }
  if (sel === 'rod' && me.spellCd > 0) { const k = Math.min(1, me.spellCd / 7); rect(bx + 2, by + 22, 22, 3, rgb(30, 30, 50)); rect(bx + 2, by + 22, Math.round(22 * (1 - k)), 3, rgb(160, 120, 255)); } // the wand's spell cooldown
  // A box
  const ax = 32, ay = H - 30; if (!sel) { }
  // crosshair
  px(W / 2, H / 2, rgb(255, 255, 255)); px(W / 2 - 2, H / 2, rgb(255, 255, 255)); px(W / 2 + 2, H / 2, rgb(255, 255, 255));
  // boss bar
  if (st.bossHp >= 0) { const bw = Math.min(160, W - 80); rect(W / 2 - bw / 2 - 1, H - 14, bw + 2, 7, rgb(10, 10, 10)); rect(W / 2 - bw / 2, H - 13, bw * st.bossHp, 5, rgb(220, 40, 60)); textC(st.bossName || 'GUARDIAN', W / 2, H - 23, rgb(255, 200, 200)); }
  // teammates status (bottom-right)
  let ty = H - 10;
  for (const p of st.players) { if (p[0] === st.myId) continue; const c = c32(hexToRgb((PCOLORS.find(c => c.name === p[5]) || PCOLORS[0]).c)); const s = p[10] + ' ' + (p[8] ? Math.ceil(p[12] / 4) + '♥' : 'DOWN') + (p[1] !== me.lvl ? ' *' : ''); text(s, W - s.length * 6 - 3, ty, c); ty -= 9; }
}
const MM_COL = {};
function mmColor(t, pr) {
  if (pr && PROP_INFO[pr] && PROP_INFO[pr].solid) return pr === PR.BUSH || pr === PR.TREE || pr === PR.PINE ? rgb(30, 100, 40) : rgb(120, 110, 100);
  switch (t) {
    case TL.WATER: return rgb(50, 100, 220); case TL.TREEWALL: return rgb(20, 70, 30); case TL.ROCK: case TL.ROCK_BOMB: return rgb(130, 80, 40);
    case TL.CAVE: return rgb(0, 0, 0); case TL.GATE: case TL.SHARDGATE: return rgb(255, 80, 80); case TL.PATH: return rgb(200, 170, 110); case TL.SAND: return rgb(220, 200, 130);
    case TL.BRIDGE: return rgb(150, 100, 50); case TL.BRICK: case TL.BRICK_BOMB: return rgb(50, 56, 100); case TL.LOCKED: return rgb(230, 200, 60); case TL.SHUTTER: return rgb(180, 180, 200);
    case TL.LAVA: return rgb(240, 90, 30); case TL.STAIRS: return rgb(0, 0, 0);
    case TL.OCEAN: return rgb(30, 64, 160); case TL.SNOW: return rgb(230, 238, 248); case TL.ICE: return rgb(150, 205, 235); case TL.ASH: return rgb(80, 70, 70); case TL.ICEWALL: return rgb(120, 170, 210); case TL.BASALT: return rgb(40, 34, 38); case TL.HEARTHGATE: return rgb(255, 200, 80); case TL.PEAKS: return rgb(150, 156, 180); case TL.FIREPEAKS: return rgb(110, 60, 60); case TL.BIGWOOD: return rgb(14, 50, 24); case TL.TOWER: return rgb(255, 80, 80);
    case TL.DFLOOR: case TL.OPENDOOR: return rgb(110, 116, 160); case TL.CWALL: return rgb(60, 46, 40);
    default: return rgb(80, 160, 60);
  }
}
// Where a player is on the Wilds map: their spot outdoors, or the way into the cave or dungeon they're in (inside: true).
function owSpot(world, p) {
  if (p[1] === 'ow') return { x: p[2], y: p[3], inside: false };
  const L = world.levels[p[1]]; if (!L || !L.exit || L.exit.lvl !== 'ow') return null;
  return { x: L.exit.x, y: L.exit.y - 1.1, inside: true };
}
function caveLabel(L) { if (L.label) return L.label; const c = Content.caves[L.caveKind]; return (c && c.name) || 'CAVE'; }
// Dungeon map rules: the map shows the main layout only. Secret rooms, and walls you can bomb or open, stay off it until
// someone has been through them. The compass marks the boss room on its own, map or no map.
function mapLinkShown(st, L, r, o) {
  if (o.hidden && !st.seenRooms.has(L.id + ':' + o.id)) return false;
  const [x, y] = r.ry === o.ry ? [Math.max(r.rx, o.rx) * DSX, r.ry * DSY + 4] : [r.rx * DSX + 6, Math.max(r.ry, o.ry) * DSY];
  const t = L.get(x, y); return t === TL.LOCKED || t === TL.SHUTTER || !TINFO[t].solid; // anything else still solid is a secret wall
}
function drawMinimap(st, x0, y0, w, h) {
  const L = st.level; const me = st.me; const cam = st.cam;
  rect(x0 - 1, y0 - 1, w + 2, h + 2, rgb(0, 0, 0)); frame(x0 - 2, y0 - 2, w + 4, h + 4, rgb(200, 180, 120));
  if (L.kind === 'dungeon') {
    const cw = Math.floor(w / DGW), ch = Math.floor(h / DGH); const hasMap = st.team.maps && st.team.maps[L.id], hasComp = st.team.comps && st.team.comps[L.id];
    for (const id in L.rooms) {
      const r = L.rooms[id]; const vis = st.seenRooms.has(L.id + ':' + id);
      const rx = x0 + r.rx * cw, ry = y0 + r.ry * ch;
      if (r.boss && hasComp && Math.floor(R.time * 3) & 1) rect(rx + cw / 2 - 1, ry + ch / 2 - 1, 3, 3, rgb(255, 50, 50)); // the compass finds the boss even without the map
      if (!vis && (!hasMap || r.hidden)) continue;
      rect(rx + 1, ry + 1, cw - 2, ch - 2, vis ? rgb(90, 110, 200) : rgb(50, 56, 100));
      if (r.boss && hasComp && Math.floor(R.time * 3) & 1) rect(rx + cw / 2 - 1, ry + ch / 2 - 1, 3, 3, rgb(255, 50, 50));
      // doors
      for (const oid in r.links) { const o = L.rooms[oid]; if (!o || !mapLinkShown(st, L, r, o) || (r.hidden && !vis)) continue; if (o.rx > r.rx) rect(rx + cw - 1, ry + ch / 2 - 1, 2, 2, rgb(160, 180, 255)); if (o.ry > r.ry) rect(rx + cw / 2 - 1, ry + ch - 1, 2, 2, rgb(160, 180, 255)); }
    }
    for (const p of st.players) { if (p[1] !== L.id) continue; const c = p[0] === st.myId ? rgb(255, 255, 255) : c32(hexToRgb((PCOLORS.find(c => c.name === p[5]) || PCOLORS[0]).c)); const px0 = x0 + p[2] / DSX * cw, py0 = y0 + p[3] / DSY * ch; rect(px0 - 1, py0 - 1, 3, 3, c); }
    text(L.dnum <= 9 ? 'L' + L.dnum : (Content.dungeons[L.dnum].mapLabel || 'L' + L.dnum), x0 + 1, y0 + h - 8, rgb(255, 255, 255));
    return;
  }
  // tile radar (north-up), 2px per tile. Inside a cave or shop it shows the Wilds around the way in, with you blinking there.
  const inCave = L.kind === 'cave' && L.exit && st.world;
  const Lr = inCave ? st.world.levels.ow : L; const ctr = inCave ? L.exit : cam;
  const sc = 2; const tw = w / sc, th = h / sc; const sx = Math.floor(ctr.x - tw / 2), sy = Math.floor(ctr.y - th / 2);
  const seen = inCave ? st.seenOW : st.seen;
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
    const tx = sx + i, ty = sy + j; if (tx < 0 || ty < 0 || tx >= Lr.w || ty >= Lr.h) continue; const idx = ty * Lr.w + tx;
    if (!seen[idx]) continue;
    rect(x0 + i * sc, y0 + j * sc, sc, sc, mmColor(Lr.tiles[idx], Lr.props[idx]));
  }
  for (const p of st.players) {
    const pos = inCave ? owSpot(st.world, p) : p[1] === L.id ? { x: p[2], y: p[3], inside: false } : null; if (!pos) continue;
    let c = p[0] === st.myId ? rgb(255, 255, 255) : c32(hexToRgb((PCOLORS.find(c => c.name === p[5]) || PCOLORS[0]).c)); if (!p[8] && (Math.floor(R.time * 4) & 1)) c = rgb(255, 40, 40); // downed: blinks red
    const mx = x0 + (pos.x - sx) * sc, my = y0 + (pos.y - sy) * sc; if (mx < x0 || my < y0 || mx > x0 + w || my > y0 + h) continue;
    if (pos.inside && !(Math.floor(R.time * 3) & 1)) continue;
    rect(mx - 1, my - 1, 3, 3, c); if (p[0] === st.myId && !pos.inside) { rect(mx + Math.cos(p[4]) * 3, my + Math.sin(p[4]) * 3, 1, 1, rgb(255, 255, 0)); rect(mx + Math.cos(p[4]) * 4, my + Math.sin(p[4]) * 4, 1, 1, rgb(255, 255, 0)); }
  }
  if (Lr.kind === 'ow') { const r = owRegionAt(Lr, ctr.x, ctr.y); text(String.fromCharCode(65 + r.rx) + (r.ry + 1) + (inCave ? ' ' + caveLabel(L) : ''), x0 + 1, y0 + h - 8, rgb(255, 255, 255)); }
}
function drawBigMap(st) {
  const W = R.W, H = R.H; const L = st.level;
  rectA(0, 0, W, H, rgb(0, 0, 0), 0.85);
  if (L.kind === 'dungeon') {
    const cw = 30, ch = 18; const x0 = Math.round(W / 2 - DGW * cw / 2), y0 = 24;
    textC((L.dnum <= 9 ? 'LEVEL-' + L.dnum + '  ' : '') + dungeonName(L.dnum), W / 2, 8, rgb(255, 220, 120));
    const hasMap = st.team.maps[L.id], hasComp = st.team.comps[L.id];
    for (const id in L.rooms) {
      const r = L.rooms[id]; const vis = st.seenRooms.has(L.id + ':' + id);
      const rx = x0 + r.rx * cw, ry = y0 + r.ry * ch;
      if (r.boss && hasComp && !vis && !hasMap) { frame(rx + 2, ry + 2, cw - 4, ch - 4, rgb(120, 30, 30)); rect(rx + cw / 2 - 2, ry + ch / 2 - 2, 5, 5, Math.floor(R.time * 3) & 1 ? rgb(255, 50, 50) : rgb(120, 20, 20)); } // the compass alone still finds the boss
      if (!vis && (!hasMap || r.hidden) && !(st.me && st.me.dbg && !r.hidden)) continue;
      rect(rx + 2, ry + 2, cw - 4, ch - 4, vis ? rgb(80, 100, 190) : rgb(40, 46, 90));
      for (const oid in r.links) { const o = L.rooms[oid]; if (!o || !mapLinkShown(st, L, r, o)) continue; const t = L.get(...(r.ry === o.ry ? [Math.max(r.rx, o.rx) * DSX, r.ry * DSY + 4] : [r.rx * DSX + 6, Math.max(r.ry, o.ry) * DSY])); const c = t === TL.LOCKED ? rgb(240, 200, 60) : rgb(160, 180, 255); if (o.rx > r.rx) rect(rx + cw - 3, ry + ch / 2 - 2, 6, 4, c); if (o.ry > r.ry) rect(rx + cw / 2 - 2, ry + ch - 3, 4, 6, c); }
      if (r.boss && hasComp) rect(rx + cw / 2 - 2, ry + ch / 2 - 2, 5, 5, Math.floor(R.time * 3) & 1 ? rgb(255, 50, 50) : rgb(120, 20, 20));
      if (r.item && st.seenRooms.has(L.id + ':' + id)) blit(SPR[itemSprite(r.item)], rx + 2, ry + 1, 1);
      // the map points to the compass, the compass to the map, and both together to the dungeon's treasure ('?').
      // Debug mode shows them all.
      const dbg = st.me && st.me.dbg, held = (it) => st.me && (st.me.items[it] || (it === 'plate' && st.me.armorMax >= 2) || (it === 'bombbag' && st.me.maxBombs > 1));
      if (r.compass && !hasComp && (hasMap || dbg)) blit(SPR[itemSprite('compass')], rx + cw - 17, ry + 1, 1);
      if (r.map && !hasMap && (hasComp || dbg)) blit(SPR[itemSprite('map')], rx + cw - 17, ry + 1, 1);
      if (r.item && !held(r.item) && ((hasMap && hasComp) || dbg) && !st.seenRooms.has(L.id + ':' + id)) text('?', rx + cw / 2 - 2, ry + ch / 2 - 3, Math.floor(R.time * 2) & 1 ? rgb(255, 220, 120) : rgb(255, 255, 255));
    }
    for (const p of st.players) { if (p[1] !== L.id) continue; const c = p[0] === st.myId ? rgb(255, 255, 255) : c32(hexToRgb((PCOLORS.find(c => c.name === p[5]) || PCOLORS[0]).c)); rect(x0 + p[2] / DSX * cw - 2, y0 + p[3] / DSY * ch - 2, 4, 4, c); }
    text((hasMap ? 'MAP ' : '') + (hasComp ? 'COMPASS' : ''), 6, H - 10, rgb(200, 200, 200));
    if (hasComp) { const sec = Object.values(L.rooms).filter(r => r.hidden); if (sec.length) { const found = sec.filter(r => st.seenRooms.has(L.id + ':' + r.id)).length; const s = 'SECRETS ' + found + '/' + sec.length; text(s, W - 6 - s.length * 6, H - 10, found === sec.length ? rgb(255, 220, 120) : rgb(200, 200, 200)); } } // the compass also senses how many secret rooms there are
    return;
  }
  const Lo = st.world.levels.ow; const seen = st.seenOW;
  const sc = Math.max(1, Math.min(Math.floor((W - 8) / Lo.w), Math.floor((H - 24) / Lo.h)));
  const x0 = Math.round(W / 2 - Lo.w * sc / 2), y0 = 16;
  textC(L.kind === 'cave' || L.kind === 'tunnel' ? 'THE WILDS - YOU ARE IN: ' + caveLabel(L) : 'THE WILDS', W / 2, 4, rgb(255, 220, 120));
  for (let y = 0; y < Lo.h; y++) for (let x = 0; x < Lo.w; x++) { const i = y * Lo.w + x; if (!seen[i]) continue; rect(x0 + x * sc, y0 + y * sc, sc, sc, mmColor(Lo.tiles[i], Lo.props[i])); }
  for (let d = 1; d <= NDUNGEONS(); d++) { const g = st.world.dungeons[d]; if (!g || !seen[g.y * Lo.w + g.x]) continue; const done = st.team.done.includes(d); const lb = d <= 9 ? String(d) : (Content.dungeons[d].mapLabel || String(d)); text(lb, x0 + g.x * sc - 2, y0 + g.y * sc - 8, done ? rgb(120, 255, 120) : d >= 10 ? rgb(170, 140, 255) : rgb(255, 120, 80)); }
  for (const p of st.players) {
    const pos = owSpot(st.world, p); if (!pos) continue; const c = p[0] === st.myId ? rgb(255, 255, 255) : c32(hexToRgb((PCOLORS.find(c => c.name === p[5]) || PCOLORS[0]).c));
    const bx = x0 + pos.x * sc, by = y0 + pos.y * sc;
    if (pos.inside) { if (Math.floor(R.time * 3) & 1) frame(bx - 3, by - 3, 7, 7, c); rect(bx - 1, by - 1, 3, 3, c); } else rect(bx - 2, by - 2, 4, 4, c);
  }
  text('SHARDS ' + st.team.shards.length + '/8', 6, H - 10, rgb(255, 180, 40));
}
function present() { R.ctx.putImageData(R.img, 0, 0); }
