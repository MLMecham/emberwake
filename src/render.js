// ===== render.js : raycaster, sprites, HUD =====
'use strict';
const ELITE_NAME = [null, 'BLAZING', 'SWIFT', 'GIANT', 'SPLITTER', 'GOLDEN'];
const ELITE_COL = [null, [255, 110, 30], [90, 220, 255], [200, 80, 255], [120, 255, 120], [255, 215, 60]];
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
function renderWorld(cam, L, ents, players, myId) {
  const W = R.W, H = R.H, buf = R.buf; const t = R.time;
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
    // distant hills band + clouds by angle
    for (let x = 0; x < W; x++) {
      const ang = cam.a + Math.atan((x / W * 2 - 1) * fov);
      const hh = 8 + Math.sin(ang * 3) * 4 + Math.sin(ang * 7 + 1) * 3 + Math.sin(ang * 13) * 1.5;
      for (let y = Math.max(0, hz - Math.round(hh)); y < Math.min(H, hz); y++) buf[y * W + x] = rgb(96, 150, 120);
      const cl = Math.sin(ang * 5 + t * 0.03) + Math.sin(ang * 11) * 0.5;
      if (cl > 0.9) { const cy = hz - 40 - Math.round(Math.sin(ang * 2) * 8); for (let y = cy; y < cy + Math.round((cl - 0.9) * 14); y++) if (y >= 0 && y < hz) buf[y * W + x] = rgb(250, 250, 255); }
    }
  }
  // --- floor & ceiling casting ---
  const rdx0 = dirX - plX, rdy0 = dirY - plY, rdx1 = dirX + plX, rdy1 = dirY + plY;
  const ceilTex = kind === 'dungeon' ? TEX.brick : TEX.cwall;
  for (let y = 0; y < H; y++) {
    const floorRow = y >= hz; if (!floorRow && outdoor) continue;
    const p = floorRow ? Math.max(0.5, y - hz) : hz - y; const posZ = (floorRow ? eye : 1 - eye) * H;
    const rowD = posZ / p;
    const stepX = rowD * (rdx1 - rdx0) / W, stepY = rowD * (rdy1 - rdy0) / W;
    let fx = cam.x + rowD * rdx0, fy = cam.y + rowD * rdy0;
    const lf = lightFor(kind, rowD); const fogF = outdoor ? clamp((rowD - 9) / 9, 0, 0.85) : 0;
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const cx = Math.floor(fx), cy = Math.floor(fy);
      let c;
      if (floorRow) {
        const tile = (cx < 0 || cy < 0 || cx >= L.w || cy >= L.h) ? (outdoor ? TL.GRASS : TL.DFLOOR) : L.tiles[cy * L.w + cx];
        const ti = TINFO[tile]; let tex = TEX[ti.floor || 'grass'] || TEX.grass; if (Array.isArray(tex)) tex = tex[wf];
        const tx = ((fx - cx) * TS) | 0, ty = ((fy - cy) * TS) | 0; c = tex[(ty & 31) * TS + (tx & 31)];
      } else {
        const tx = ((fx - cx) * TS) | 0, ty = ((fy - cy) * TS) | 0; c = shadeC(ceilTex[(ty & 31) * TS + (tx & 31)], 0.45);
      }
      if (lf < 1) c = shadeC(c, lf); if (fogF > 0) c = fogC(c, fogF, fogR, fogG, fogB);
      buf[row + x] = c; fx += stepX; fy += stepY;
    }
  }
  // --- walls ---
  for (let x = 0; x < W; x++) {
    const camX = 2 * x / W - 1; const rdx = dirX + plX * camX, rdy = dirY + plY * camX;
    let mx = Math.floor(cam.x), my = Math.floor(cam.y);
    const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
    let stepX, stepY, sdx, sdy;
    if (rdx < 0) { stepX = -1; sdx = (cam.x - mx) * ddx; } else { stepX = 1; sdx = (mx + 1 - cam.x) * ddx; }
    if (rdy < 0) { stepY = -1; sdy = (cam.y - my) * ddy; } else { stepY = 1; sdy = (my + 1 - cam.y) * ddy; }
    let side = 0, hit = 0, tile = 0, n = 0;
    while (!hit && n++ < 64) {
      if (sdx < sdy) { sdx += ddx; mx += stepX; side = 0; } else { sdy += ddy; my += stepY; side = 1; }
      if (mx < 0 || my < 0 || mx >= L.w || my >= L.h) { hit = 1; tile = outdoor ? TL.TREEWALL : TL.BRICK; break; }
      tile = L.tiles[my * L.w + mx]; if (TINFO[tile].wall) hit = 1;
    }
    const pd = side === 0 ? sdx - ddx : sdy - ddy; const dist = Math.max(0.05, pd);
    R.zbuf[x] = hit ? dist : 1e9;
    if (!hit) continue;
    const lh = H / dist; const top = Math.round(hz - (1 - eye) * lh), bot = Math.round(hz + eye * lh);
    let wx = side === 0 ? cam.y + pd * rdy : cam.x + pd * rdx; wx -= Math.floor(wx);
    let tx = (wx * TS) | 0; if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = TS - 1 - tx;
    const tex = TEX[TINFO[tile].wall] || TEX.brick;
    let lf = lightFor(kind, dist) * (side ? 0.78 : 1); const fogF = outdoor ? clamp((dist - 9) / 9, 0, 0.85) : 0;
    const y0 = Math.max(0, top), y1 = Math.min(H, bot); const span = bot - top;
    for (let y = y0; y < y1; y++) {
      const ty = (((y - top) / span) * TS) | 0; let c = tex[(ty & 31) * TS + tx];
      c = shadeC(c, lf); if (fogF > 0) c = fogC(c, fogF, fogR, fogG, fogB);
      buf[y * W + x] = c;
    }
  }
  // --- sprites ---
  const sprites = [];
  const rad = 16; const cx0 = Math.max(0, Math.floor(cam.x) - rad), cx1 = Math.min(L.w - 1, Math.floor(cam.x) + rad), cy0 = Math.max(0, Math.floor(cam.y) - rad), cy1 = Math.min(L.h - 1, Math.floor(cam.y) + rad);
  for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) { const pr = L.props[y * L.w + x]; if (pr) sprites.push({ x: x + 0.5, y: y + 0.5, spr: SPR[PROPS[pr]], sc: PROP_INFO[pr].scale, z: 0, fl: pr === PR.FLAME ? 8 : 0 }); }
  for (const e of ents) {
    let s = SPR[e[1]]; if (!s) continue; const an = SPR_ANIM[e[1]];
    if (an && !(e[6] & 2)) s = an.f[Math.floor(R.time * an.fps + e[0] * 0.37) % an.f.length]; // stunned enemies freeze
    sprites.push({ x: e[2], y: e[3], spr: s, sc: e[4], z: e[5], fl: e[6], price: e[7], id: e[0], elite: e[10] || 0 });
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
    sprites.push({ x: p[2], y: p[3], spr: s, sc: 0.78 * rsc, z: p[8] ? 0 : -0.45, fl: p[8] ? (p[9] > 0 ? 16 : 0) : 32, name: p[10], col, aura: p[7] === 'monk' ? p[6] : 0 });
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
    const dist = Math.sqrt(s.d); let lf = lightFor(kind, dist); if (s.fl & 8) lf = 1;
    const fogF = outdoor ? clamp((dist - 9) / 9, 0, 0.85) : 0;
    const hurt = (s.fl & 1) && (Math.floor(t * 20) & 1); const stun = s.fl & 2; const ghost = s.fl & 4; const down = s.fl & 32;
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      if (tY >= R.zbuf[x]) continue;
      const tx = Math.floor((x - x0) / (x1 - x0) * s.spr.w); if (tx < 0 || tx >= s.spr.w) continue;
      for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
        const ty = Math.floor((y - y0) / (y1 - y0) * s.spr.h); let c = s.spr.px[ty * s.spr.w + tx]; if (!c) continue;
        if (ghost && ((x + y + (t * 30 | 0)) & 1)) continue;
        if (hurt) c = (ty + tx) & 1 ? rgb(255, 255, 255) : rgb(255, 60, 40); else if (stun) c = fogC(c, 0.45, 120, 180, 255);
        if (down) { const g = ((c & 255) + ((c >> 8) & 255) + ((c >> 16) & 255)) / 3 | 0; c = rgb(g, g, g + 30); }
        if (s.elite) { const ec = ELITE_COL[s.elite]; c = fogC(c, s.elite === 5 ? 0.55 : 0.3 + 0.12 * Math.sin(t * 6), ec[0], ec[1], ec[2]); }
        c = shadeC(c, lf); if (fogF > 0) c = fogC(c, fogF, fogR, fogG, fogB);
        buf[y * W + x] = c;
      }
    }
    if (s.elite && dist < 12) {
      const ec = ELITE_COL[s.elite]; const ecc = rgb(ec[0], ec[1], ec[2]);
      for (let i = 0; i < 5; i++) { const ax = scrX + Math.round((Math.random() - 0.5) * wid * 1.2), ay = Math.round(topY + Math.random() * hgt); if (ax >= 0 && ax < W && tY < R.zbuf[ax]) px(ax, ay, ecc); }
      if (dist < 7 && scrX > 0 && scrX < W && tY < R.zbuf[scrX]) textC(ELITE_NAME[s.elite], scrX, Math.max(2, y0 - 10), ecc);
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
  const tier = me.cls === 'monk' ? 0 : me.armor; const pal = tunicPal(c32ToHex(col), tier);
  const sleeve = c32(pal.T), sleeveD = c32(pal.t), sleeveH = c32(pal.h); const skin = c32(hexToRgb(PAL.s)), skinD = c32(hexToRgb(PAL.S));
  const drawSleeve = (x, y, w, h) => {
    rect(x, y, w, h, sleeve); rect(x, y, 3, h, sleeveD);
    if (tier === 1) for (let j = 0; j < h; j += 2) for (let i = (j / 2) & 1; i < w; i += 2) px(x + i, y + j, sleeveH);
    if (tier === 2) { rect(x + w - 6, y, 3, h, sleeveH); for (let j = 4; j < h; j += 8) rect(x, y + j, w, 1, sleeveD); rect(x + 4, y + 2, 2, 2, rgb(255, 255, 255)); }
  };
  if (me.cls === 'monk') {
    const p = st.punch; // {side, t}
    const auraC = me.armor === 2 ? rgb(255, 248, 200) : me.armor === 1 ? rgb(110, 200, 255) : 0;
    for (const side of [-1, 1]) {
      let fx = W / 2 + side * W * 0.28 + bx, fy = H - 34 + by; let sc = 1;
      if (p && p.side === side && p.t < 0.22) { const k = Math.sin(p.t / 0.22 * Math.PI); fx = lerp(fx, W / 2 + side * 6, k); fy = lerp(fy, H / 2 + 4, k); sc = 1 + k * 0.5; }
      if (st.charge > 0) { fx = lerp(fx, W / 2 + side * 14, Math.min(1, st.charge * 2)); fy = lerp(fy, H - 46, Math.min(1, st.charge * 2)); }
      // forearm (bare skin + wraps)
      thickLine(fx, fy + 10, W / 2 + side * W * 0.42, H + 20, 14 * sc, skinD); thickLine(fx, fy + 10, W / 2 + side * W * 0.42, H + 20, 10 * sc, skin);
      const fw = 22 * sc, fh = 18 * sc; rect(fx - fw / 2, fy - fh / 2, fw, fh, rgb(240, 236, 220)); rect(fx - fw / 2, fy - fh / 2 + fh * 0.3, fw, 2, rgb(190, 180, 160)); rect(fx - fw / 2, fy - fh / 2 + fh * 0.65, fw, 2, rgb(190, 180, 160)); frame(fx - fw / 2, fy - fh / 2, fw, fh, rgb(20, 18, 28));
      if (auraC) for (let i = 0; i < 10; i++) px(fx + (Math.random() - 0.5) * fw * 1.6, fy + (Math.random() - 0.5) * fh * 1.8, auraC);
    }
    if (st.charge > 0) { const r = Math.min(14, 3 + st.charge * 10) | 0; disc(W / 2, H - 48, r + 2, rgb(80, 200, 255), 0.5); disc(W / 2, H - 48, r, rgb(220, 250, 255)); if (st.charge > 0.8) for (let i = 0; i < 12; i++) { const a = Math.random() * TAU; thickLine(W / 2, H - 48, W / 2 + Math.cos(a) * (r + 10), H - 48 + Math.sin(a) * (r + 10), 1, rgb(200, 240, 255)); } }
    return;
  }
  // sword class: shield on left, sword on right
  const sw = st.swing; const k = sw != null && sw < 0.25 ? sw / 0.25 : -1;
  // shield
  const shx = W * 0.14 + bx * 0.5, shy = H - 40 + by;
  rect(shx - 18, shy - 22, 36, 50, rgb(20, 18, 28)); rect(shx - 16, shy - 20, 32, 46, rgb(140, 90, 46)); rect(shx - 16, shy - 20, 32, 4, rgb(200, 200, 210)); rect(shx - 2, shy - 14, 4, 30, rgb(200, 200, 210)); rect(shx - 10, shy - 2, 20, 4, rgb(200, 200, 210));
  if (me.sword > 0) {
    let ang, hx, hy;
    if (k >= 0) { ang = lerp(-0.4, -2.6, k); hx = lerp(W * 0.78, W * 0.42, k) + bx; hy = lerp(H - 14, H - 30, Math.sin(k * Math.PI)) + by; }
    else { ang = -1.15; hx = W * 0.76 + bx; hy = H - 12 + by; }
    const len = 70; const tipX = hx + Math.cos(ang) * len, tipY = hy + Math.sin(ang) * len;
    const blade = me.sword === 1 ? rgb(170, 120, 60) : me.sword === 2 ? rgb(220, 226, 240) : rgb(130, 240, 255);
    const bladeD = me.sword === 1 ? rgb(110, 70, 30) : me.sword === 2 ? rgb(130, 136, 160) : rgb(40, 150, 200);
    const gx = hx + Math.cos(ang) * 14, gy = hy + Math.sin(ang) * 14;
    thickLine(gx, gy, tipX, tipY, (t) => 7 - t * 4, bladeD); thickLine(gx, gy, tipX, tipY, (t) => 4 - t * 3, blade);
    const pa = ang + Math.PI / 2; thickLine(gx + Math.cos(pa) * 10, gy + Math.sin(pa) * 10, gx - Math.cos(pa) * 10, gy - Math.sin(pa) * 10, 4, rgb(230, 190, 60));
    if (me.sword === 3) for (let i = 0; i < 3; i++) { const tt = Math.random(); px(lerp(gx, tipX, tt) + (Math.random() - 0.5) * 6, lerp(gy, tipY, tt) + (Math.random() - 0.5) * 6, rgb(220, 255, 255)); }
    if (k >= 0 && k < 1) { for (let i = 0; i < 5; i++) { const a2 = lerp(-0.4, ang, i / 5); thickLine(hx + Math.cos(a2) * 40, hy + Math.sin(a2) * 40, hx + Math.cos(a2) * 66, hy + Math.sin(a2) * 66, 1, rgb(255, 255, 255)); } }
    // hand + sleeve
    rect(hx - 9, hy - 7, 18, 14, skin); frame(hx - 9, hy - 7, 18, 14, rgb(20, 18, 28));
    drawSleeve(hx - 2, hy + 4, 24, 40);
  }
  // B item flash in left hand
  if (st.useFlash > 0 && st.useSpr) blit(SPR[st.useSpr], W * 0.3, H - 50, 3);
}
function c32ToHex(c) { return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }

// ---- HUD ----
function drawHearts(x, y, hp, maxHp) {
  const n = Math.ceil(maxHp / 4);
  for (let i = 0; i < n; i++) {
    const hx = x + (i % 10) * 8, hy = y + Math.floor(i / 10) * 8; const q = clamp(hp - i * 4, 0, 4);
    const pat = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
    for (let j = 0; j < pat.length; j++) for (let k = 0; k < 7; k++) if (pat[j][k] === '#') { const fill = k < q * 7 / 4; px(hx + k, hy + j, fill ? rgb(230, 40, 40) : rgb(60, 20, 30)); }
  }
}
function drawHUD(st) {
  const W = R.W, H = R.H; const me = st.me; if (!me) return;
  // minimap
  drawMinimap(st, 4, 4, 72, 44);
  // hearts
  const hx = W - 86; drawHearts(hx, 5, me.hp, me.maxHp);
  if (me.hp <= 4 && me.alive && Math.floor(R.time * 4) & 1) frame(hx - 2, 3, 84, 10, rgb(255, 60, 60));
  // counters
  let cy = 5 + Math.ceil(Math.ceil(me.maxHp / 4) / 10) * 8 + 2;
  const counter = (spr, v, c) => { blit(SPR[spr], hx - 4, cy - 5, 1); text('X' + v, hx + 10, cy, c || rgb(255, 255, 255)); cy += 9; };
  counter('gem_g', me.gems);
  if (st.lvlKind === 'dungeon') counter('key', (st.team.keys && st.team.keys[me.lvl]) || 0);
  if (me.items.bombs || me.bombs) counter('bomb', me.bombs);
  if (me.items.bow) counter('arrow', me.arrows);
  if (me.potions) counter('potion', me.potions);
  // shards
  if (st.team.shards && st.team.shards.length) { for (let i = 0; i < 8; i++) { const c = i < st.team.shards.length ? rgb(255, 180, 40) : rgb(70, 50, 30); rect(W - 86 + i * 6, cy + 1, 4, 5, c); } cy += 9; }
  // B item box
  const bx = 4, by = H - 30; rect(bx, by, 26, 26, rgb(10, 10, 20)); frame(bx, by, 26, 26, rgb(80, 140, 255));
  text('B', bx + 2, by + 2, rgb(80, 140, 255));
  const sel = st.selItem; if (sel) { const spr = sel === 'bombs' ? (me.cls === 'monk' ? 'ki' : 'bomb') : sel === 'boomerang' && me.cls === 'monk' ? 'disc' : ITEM_SPR[sel]; blit(SPR[spr], bx + 5, by + 6, 1); text(me.cls === 'monk' && MONK_NAMES[sel] ? MONK_NAMES[sel] : ITEM_NAMES[sel] || sel, bx + 30, by + 18, rgb(200, 210, 255)); }
  // A box
  const ax = 32, ay = H - 30; if (!sel) { }
  // crosshair
  px(W / 2, H / 2, rgb(255, 255, 255)); px(W / 2 - 2, H / 2, rgb(255, 255, 255)); px(W / 2 + 2, H / 2, rgb(255, 255, 255));
  // boss bar
  if (st.bossHp >= 0) { const bw = Math.min(160, W - 80); rect(W / 2 - bw / 2 - 1, H - 14, bw + 2, 7, rgb(10, 10, 10)); rect(W / 2 - bw / 2, H - 13, bw * st.bossHp, 5, rgb(220, 40, 60)); textC('GUARDIAN', W / 2, H - 23, rgb(255, 200, 200)); }
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
    case TL.DFLOOR: case TL.OPENDOOR: return rgb(110, 116, 160); case TL.CWALL: return rgb(60, 46, 40);
    default: return rgb(80, 160, 60);
  }
}
function drawMinimap(st, x0, y0, w, h) {
  const L = st.level; const me = st.me; const cam = st.cam;
  rect(x0 - 1, y0 - 1, w + 2, h + 2, rgb(0, 0, 0)); frame(x0 - 2, y0 - 2, w + 4, h + 4, rgb(200, 180, 120));
  if (L.kind === 'dungeon') {
    const cw = Math.floor(w / DGW), ch = Math.floor(h / DGH); const hasMap = st.team.maps && st.team.maps[L.id], hasComp = st.team.comps && st.team.comps[L.id];
    for (const id in L.rooms) {
      const r = L.rooms[id]; const vis = st.seenRooms.has(L.id + ':' + id);
      if (!vis && !hasMap) continue;
      const rx = x0 + r.rx * cw, ry = y0 + r.ry * ch;
      rect(rx + 1, ry + 1, cw - 2, ch - 2, vis ? rgb(90, 110, 200) : rgb(50, 56, 100));
      if (r.boss && hasComp && Math.floor(R.time * 3) & 1) rect(rx + cw / 2 - 1, ry + ch / 2 - 1, 3, 3, rgb(255, 50, 50));
      // doors
      for (const oid in r.links) { const o = L.rooms[oid]; if (!o) continue; if (o.rx > r.rx) rect(rx + cw - 1, ry + ch / 2 - 1, 2, 2, rgb(160, 180, 255)); if (o.ry > r.ry) rect(rx + cw / 2 - 1, ry + ch - 1, 2, 2, rgb(160, 180, 255)); }
    }
    for (const p of st.players) { if (p[1] !== L.id) continue; const c = p[0] === st.myId ? rgb(255, 255, 255) : c32(hexToRgb((PCOLORS.find(c => c.name === p[5]) || PCOLORS[0]).c)); const px0 = x0 + p[2] / DSX * cw, py0 = y0 + p[3] / DSY * ch; rect(px0 - 1, py0 - 1, 3, 3, c); }
    text('L' + L.dnum, x0 + 1, y0 + h - 8, rgb(255, 255, 255));
    return;
  }
  // tile radar (north-up), 2px per tile
  const sc = 2; const tw = w / sc, th = h / sc; const sx = Math.floor(cam.x - tw / 2), sy = Math.floor(cam.y - th / 2);
  const seen = st.seen;
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
    const tx = sx + i, ty = sy + j; if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) continue; const idx = ty * L.w + tx;
    if (!seen[idx]) continue;
    rect(x0 + i * sc, y0 + j * sc, sc, sc, mmColor(L.tiles[idx], L.props[idx]));
  }
  for (const p of st.players) {
    if (p[1] !== L.id) continue; const c = p[0] === st.myId ? rgb(255, 255, 255) : c32(hexToRgb((PCOLORS.find(c => c.name === p[5]) || PCOLORS[0]).c));
    const mx = x0 + (p[2] - sx) * sc, my = y0 + (p[3] - sy) * sc; if (mx < x0 || my < y0 || mx > x0 + w || my > y0 + h) continue;
    rect(mx - 1, my - 1, 3, 3, c); if (p[0] === st.myId) { rect(mx + Math.cos(p[4]) * 3, my + Math.sin(p[4]) * 3, 1, 1, rgb(255, 255, 0)); rect(mx + Math.cos(p[4]) * 4, my + Math.sin(p[4]) * 4, 1, 1, rgb(255, 255, 0)); }
  }
  if (L.kind === 'ow') { const r = owRegionAt(L, cam.x, cam.y); text(String.fromCharCode(65 + r.rx) + (r.ry + 1), x0 + 1, y0 + h - 8, rgb(255, 255, 255)); }
}
function drawBigMap(st) {
  const W = R.W, H = R.H; const L = st.level;
  rectA(0, 0, W, H, rgb(0, 0, 0), 0.85);
  if (L.kind === 'dungeon') {
    const cw = 30, ch = 18; const x0 = Math.round(W / 2 - DGW * cw / 2), y0 = 24;
    textC('LEVEL-' + L.dnum + '  ' + DUNGEON_NAMES[L.dnum], W / 2, 8, rgb(255, 220, 120));
    const hasMap = st.team.maps[L.id], hasComp = st.team.comps[L.id];
    for (const id in L.rooms) {
      const r = L.rooms[id]; const vis = st.seenRooms.has(L.id + ':' + id); if (!vis && !hasMap) continue;
      const rx = x0 + r.rx * cw, ry = y0 + r.ry * ch; rect(rx + 2, ry + 2, cw - 4, ch - 4, vis ? rgb(80, 100, 190) : rgb(40, 46, 90));
      for (const oid in r.links) { const o = L.rooms[oid]; if (!o) continue; const t = r.links[oid]; const c = t === TL.LOCKED ? rgb(240, 200, 60) : t === TL.BRICK_BOMB ? 0 : rgb(160, 180, 255); if (!c) continue; if (o.rx > r.rx) rect(rx + cw - 3, ry + ch / 2 - 2, 6, 4, c); if (o.ry > r.ry) rect(rx + cw / 2 - 2, ry + ch - 3, 4, 6, c); }
      if (r.boss && hasComp) rect(rx + cw / 2 - 2, ry + ch / 2 - 2, 5, 5, Math.floor(R.time * 3) & 1 ? rgb(255, 50, 50) : rgb(120, 20, 20));
      if (r.item && st.seenRooms.has(L.id + ':' + id)) blit(SPR[ITEM_SPR[r.item]], rx + 2, ry + 1, 1);
    }
    for (const p of st.players) { if (p[1] !== L.id) continue; const c = p[0] === st.myId ? rgb(255, 255, 255) : c32(hexToRgb((PCOLORS.find(c => c.name === p[5]) || PCOLORS[0]).c)); rect(x0 + p[2] / DSX * cw - 2, y0 + p[3] / DSY * ch - 2, 4, 4, c); }
    text((hasMap ? 'MAP ' : '') + (hasComp ? 'COMPASS' : ''), 6, H - 10, rgb(200, 200, 200));
    return;
  }
  const Lo = st.world.levels.ow; const seen = st.seenOW;
  const sc = Math.max(1, Math.min(Math.floor((W - 8) / Lo.w), Math.floor((H - 24) / Lo.h)));
  const x0 = Math.round(W / 2 - Lo.w * sc / 2), y0 = 16;
  textC('THE WILDS', W / 2, 4, rgb(255, 220, 120));
  for (let y = 0; y < Lo.h; y++) for (let x = 0; x < Lo.w; x++) { const i = y * Lo.w + x; if (!seen[i]) continue; rect(x0 + x * sc, y0 + y * sc, sc, sc, mmColor(Lo.tiles[i], Lo.props[i])); }
  for (let d = 1; d <= 9; d++) { const g = st.world.dungeons[d]; if (!g || !seen[g.y * Lo.w + g.x]) continue; const done = st.team.done.includes(d); text(String(d), x0 + g.x * sc - 2, y0 + g.y * sc - 8, done ? rgb(120, 255, 120) : rgb(255, 120, 80)); }
  for (const p of st.players) { if (p[1] !== 'ow') continue; const c = p[0] === st.myId ? rgb(255, 255, 255) : c32(hexToRgb((PCOLORS.find(c => c.name === p[5]) || PCOLORS[0]).c)); rect(x0 + p[2] * sc - 2, y0 + p[3] * sc - 2, 4, 4, c); }
  text('SHARDS ' + st.team.shards.length + '/8', 6, H - 10, rgb(255, 180, 40));
}
function present() { R.ctx.putImageData(R.img, 0, 0); }
