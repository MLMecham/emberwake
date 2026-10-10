// ===== engine/spritekit.js : building, recoloring and animating 16x16 pixel art =====
// No art lives here. Art is registered from src/content with defineSprite / defineEnemy / defineAnim.
'use strict';
// Palette keys usable in sprite rows. Sprites may override any key with their own pal.
const PAL = {
  k: '#14121c', w: '#f8f8f0', g: '#a8a8b4', G: '#5c5c70', r: '#e03828', R: '#881c1c', o: '#f08830', y: '#f8d840', Y: '#b88818',
  n: '#8a5a2a', N: '#4a2e18', b: '#3a78e8', B: '#1c3c90', c: '#70e8f8', C: '#2898b0', p: '#a048d0', P: '#582080', l: '#80d848', e: '#38a838',
  E: '#1a6420', s: '#f4c094', S: '#c47c52', m: '#f868b8', u: '#d0d8e8', U: '#7884a4', z: '#ece4cc', Z: '#a89c80', H: '#5a3418', v: '#e8f8ff', x: '#ff5020',
  T: '#38b038', t: '#1e7020', h: '#80e070', // tunic placeholders (recolored)
};
const SPR = {};      // built sprites: id -> { w, h, px: Uint32Array }
const SPR_ANIM = {}; // built animations: id -> { fps, f: [sprites] }
function buildSprite(src, palOverride) {
  const h = src.length, w = 16; const px = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = src[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x] || '.';
      if (ch === '.') { px[y * w + x] = 0; continue; }
      const col = (palOverride && palOverride[ch]) || PAL[ch];
      if (!col) { px[y * w + x] = 0; continue; }
      const c = Array.isArray(col) ? col : hexToRgb(col);
      px[y * w + x] = c32(c);
    }
  }
  return { w, h, px };
}

// Build every registered sprite, variant and animation. Called once at boot (and by tools/check.js).
function initSprites() {
  for (const id in Content.sprites) { const s = Content.sprites[id]; SPR[id] = buildSprite(s.rows, s.pal); }
  for (const id in Content.spriteVariants) { const v = Content.spriteVariants[id]; const base = Content.sprites[v.base]; if (base) SPR[id] = buildSprite(base.rows, Object.assign({}, base.pal || {}, v.pal)); }
}
// Transforms handed to animation builders as `kit`, so frames can be made from the base sprite.
function sprCopy(s) { return { w: s.w, h: s.h, px: new Uint32Array(s.px) }; }
function sprGet(s, x, y) { return x < 0 || y < 0 || x >= s.w || y >= s.h ? 0 : s.px[y * s.w + x]; }
// resample vertically around the bottom row (f<1 squash, f>1 stretch), widen/narrow to keep volume
function sprSquash(s, f) {
  const o = { w: s.w, h: s.h, px: new Uint32Array(s.px.length) }; const fx = 1 / Math.sqrt(f); const cx = (s.w - 1) / 2;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const sy = Math.round(s.h - 1 - (s.h - 1 - y) / f), sx = Math.round(cx + (x - cx) / fx); o.px[y * s.w + x] = sprGet(s, sx, sy); }
  return o;
}
// shift a band of rows sideways (legs shuffle, ghost tail wave)
function sprShearRows(s, y0, y1, dx) { const o = sprCopy(s); for (let y = y0; y <= y1; y++) for (let x = 0; x < s.w; x++) o.px[y * s.w + x] = sprGet(s, x - dx, y); return o; }
// split legs: left half of a band moves dl rows, right half dr rows
function sprStep(s, y0, dl, dr) { const o = sprCopy(s); for (let y = y0; y < s.h; y++) for (let x = 0; x < s.w; x++) o.px[y * s.w + x] = 0; for (let y = y0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const d = x < s.w / 2 ? dl : dr; const ty = y + d; if (ty >= y0 - 1 && ty < s.h) { const c = sprGet(s, x, y); if (c) o.px[ty * s.w + x] = c; } } return o; }
function sprShiftCols(s, x0, x1, dy) { const o = sprCopy(s); for (let x = x0; x <= x1; x++) { for (let y = 0; y < s.h; y++) o.px[y * s.w + x] = 0; for (let y = 0; y < s.h; y++) { const c = sprGet(s, x, y); const ty = y + dy; if (c && ty >= 0 && ty < s.h) o.px[ty * s.w + x] = c; } } return o; }
function sprBob(s, dy) { return sprShiftCols(s, 0, s.w - 1, dy); }
// rotate around the center (nearest pixel), for spinning things
function sprRotate(s, a) { const o = { w: s.w, h: s.h, px: new Uint32Array(s.px.length) }; const c = Math.cos(a), si = Math.sin(a), cx = (s.w - 1) / 2, cy = (s.h - 1) / 2; for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const dx = x - cx, dy = y - cy; const sx = Math.round(cx + dx * c + dy * si), sy = Math.round(cy - dx * si + dy * c); o.px[y * s.w + x] = sprGet(s, sx, sy); } return o; }
const SPRITE_KIT = { rotate: sprRotate, squash: sprSquash, shearRows: sprShearRows, step: sprStep, shiftCols: sprShiftCols, bob: sprBob, mirror: (s) => mirrorSpr(s), copy: sprCopy, fromRows: (rows, pal) => buildSprite(rows, pal) };
function initAnims() {
  for (const id in Content.anims) {
    const a = Content.anims[id]; const base = SPR[id]; if (!base) continue;
    const frames = typeof a.frames === 'function' ? a.frames(base, SPRITE_KIT) : a.frames.map(f => Array.isArray(f) ? buildSprite(f, Content.sprites[id].pal) : f);
    SPR_ANIM[id] = { fps: a.fps, f: frames.filter(Boolean) };
  }
}
// Pick the current frame of a sprite's animation (or the sprite itself if it has none).
function animFrame(id, time, seed, frozen) { const an = SPR_ANIM[id]; if (!an || frozen) return SPR[id]; return an.f[Math.floor(time * an.fps + seed * 0.37) % an.f.length]; }

// ===== heroes: tunic colors, armor tiers, facings and the run cycle (art in content/sprites/heroes.js) =====
// Player colors
const PCOLORS = [
  { name: 'GREEN', c: '#38b038' }, { name: 'RED', c: '#e03030' }, { name: 'BLUE', c: '#3868e8' }, { name: 'PURPLE', c: '#a040d8' },
  { name: 'GOLD', c: '#e0b020' }, { name: 'TEAL', c: '#20b8b0' }, { name: 'PINK', c: '#f060a8' }, { name: 'WHITE', c: '#e8e8f0' },
];
const STEEL = [200, 208, 224], STEEL_D = [110, 118, 145], STEEL_H = [250, 252, 255];
// tunic palette for color + armor tier (0 cloth, 1 chain, 2 plate). monk: aura tiers.
function tunicPal(hex, tier) {
  const base = hexToRgb(hex);
  if (tier === 0) return { T: base, t: shade(base, 0.6), h: mix(base, [255, 255, 255], 0.4) };
  if (tier === 1) { const m = mix(base, STEEL, 0.45); return { T: m, t: mix(shade(base, 0.55), STEEL_D, 0.5), h: mix(STEEL_H, base, 0.2) }; }
  const m = mix(STEEL, base, 0.22); return { T: m, t: mix(base, [20, 20, 30], 0.35), h: STEEL_H };
}
const _heroCache = {};
function heroSprite(cls, hex, tier, dir) { // dir: front/back/side/side_l
  const key = cls + hex + tier + dir;
  if (_heroCache[key]) return _heroCache[key];
  const base = (cls === 'monk' ? 'monk_' : 'hero_') + (dir === 'side_l' ? 'side' : dir);
  let s = buildSprite(Content.sprites[base].rows, tunicPal(hex, cls === 'monk' ? 0 : tier));
  if (dir === 'side_l') { const m = new Uint32Array(s.px.length); for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) m[y * s.w + x] = s.px[y * s.w + (s.w - 1 - x)]; s = { w: s.w, h: s.h, px: m }; }
  // plate armor: add specular sparkle dither on tunic pixels
  if (cls !== 'monk' && tier >= 1) {
    const pal = tunicPal(hex, tier); const tc = c32(pal.T), hc = c32(pal.h);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const i = y * s.w + x;
      if (s.px[i] === tc) {
        if (tier === 1 && ((x + y) & 1) === 0 && y % 2 === 0) s.px[i] = hc; // chain rings
        if (tier === 2 && (x + y * 3) % 7 === 0) s.px[i] = hc; // plate glints
      }
    }
  }
  _heroCache[key] = s; return s;
}

function runRows(src, cls, dir, frame) {
  const rows = src.map(r => r.split(''));
  const side = dir === 'side';
  for (let y = 7; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (y >= 13) rows[y][x] = '.';
    else if (side ? (x >= 11 && y <= 12) : (y <= 11 && (x <= 4 || x >= 11))) rows[y][x] = '.';
  }
  const map = cls === 'monk' ? { A: 's', H: 'w', L: 'N', F: 'k' } : { A: 's', H: 'S', L: 's', F: 'N' };
  for (const [x, y, k] of (side ? RUN_SIDE : RUN_FRONT)[frame]) rows[y][x] = map[k];
  return rows.map(r => r.join(''));
}
// frame: -1 idle, otherwise 0..2 (A,B,C)
function heroSpriteRun(cls, hex, tier, dir, frame, flip) {
  if (frame < 0) return heroSprite(cls, hex, tier, dir);
  const key = 'run' + cls + hex + tier + dir + frame + (flip ? 'f' : '');
  if (_heroCache[key]) return _heroCache[key];
  const baseDir = dir === 'side_l' ? 'side' : dir;
  const src = runRows(Content.sprites[(cls === 'monk' ? 'monk_' : 'hero_') + baseDir].rows, cls, baseDir === 'side' ? 'side' : 'front', frame);
  const pal = tunicPal(hex, cls === 'monk' ? 0 : tier);
  let s = buildSprite(src, pal);
  if (cls !== 'monk' && tier >= 1) { const tc = c32(pal.T), hc = c32(pal.h); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = y * 16 + x; if (s.px[i] === tc && ((tier === 1 && ((x + y) & 1) === 0 && y % 2 === 0) || (tier === 2 && (x + y * 3) % 7 === 0))) s.px[i] = hc; } }
  if (dir === 'side_l' || flip) s = mirrorSpr(s);
  _heroCache[key] = s; return s;
}
function mirrorSpr(s) { const m = new Uint32Array(s.px.length); for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) m[y * s.w + x] = s.px[y * s.w + (s.w - 1 - x)]; return { w: s.w, h: s.h, px: m }; }

