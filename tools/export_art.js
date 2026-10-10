// ===== tools/export_art.js : writes every sprite and animation to docs/art/ as GIFs =====
// Usage: node tools/export_art.js      (build.py runs this for you)
// Open docs/art/README.md on GitHub (or any image viewer) to see them. No browser or extra installs needed.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.join(__dirname, '..');
const OUT = path.join(root, 'docs', 'art');
const SCALE = 5; // each sprite pixel becomes 5x5

// ---- load the game's art code (same files as the build, minus browser-only ones) ----
const files = JSON.parse(cp.execFileSync(process.platform === 'win32' ? 'python' : 'python3', [path.join(root, 'build.py'), '--list']).toString());
const order = JSON.parse(fs.readFileSync(path.join(root, 'build_order.json'), 'utf8')).files;
const scopedDirs = order.filter(o => o.scoped).map(o => o.path.replace('/*.js', '/'));
const isScoped = (f) => scopedDirs.some(d => f.startsWith(d) && !f.slice(d.length).includes('/')) && f !== 'src/content/ai.js';
const code = files.map(f => { const s = fs.readFileSync(path.join(root, f), 'utf8'); return isScoped(f) ? '(function () {\n' + s + '\n})();' : s; }).join('\n');
const ctx = { console, Math, JSON, Object, Array, Set, Map, Uint8Array, Uint32Array, Int32Array, Float32Array, Number, String, Error, parseInt };
vm.createContext(ctx); vm.runInContext(code + '\ninitSprites(); initAnims();', ctx);
const G = (expr) => vm.runInContext(expr, ctx);

// ---- tiny animated-GIF encoder (transparent background, LZW) ----
function gif(frames, w, h, delayCs) {
  // frames: arrays of 0xAABBGGRR pixels (0 = transparent)
  const colors = new Map(); colors.set(0, 0);
  for (const f of frames) for (const c of f) if (c && !colors.has(c)) colors.set(c, colors.size);
  let bits = 1; while ((1 << bits) < Math.max(2, colors.size)) bits++;
  const size = 1 << bits; const out = [];
  const u16 = (v) => out.push(v & 255, (v >> 8) & 255);
  out.push(...Buffer.from('GIF89a')); u16(w); u16(h); out.push(0xF0 | (bits - 1), 0, 0);
  const pal = new Array(size * 3).fill(0); for (const [c, i] of colors) { pal[i * 3] = c & 255; pal[i * 3 + 1] = (c >> 8) & 255; pal[i * 3 + 2] = (c >> 16) & 255; }
  out.push(...pal);
  out.push(0x21, 0xFF, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0); // loop forever
  for (const f of frames) {
    out.push(0x21, 0xF9, 4, 0x09, delayCs & 255, delayCs >> 8, 0, 0); // dispose to background, transparent index 0
    out.push(0x2C); u16(0); u16(0); u16(w); u16(h); out.push(0);
    const minCode = Math.max(2, bits); out.push(minCode);
    const data = lzw(f.map(c => colors.get(c)), minCode);
    for (let i = 0; i < data.length; i += 255) { const chunk = data.slice(i, i + 255); out.push(chunk.length, ...chunk); }
    out.push(0);
  }
  out.push(0x3B); return Buffer.from(out);
}
function lzw(indices, minCode) {
  const clear = 1 << minCode, eoi = clear + 1; let codeSize = minCode + 1, next = eoi + 1; let dict = new Map();
  const bytes = []; let acc = 0, accBits = 0;
  const emit = (code) => { acc |= code << accBits; accBits += codeSize; while (accBits >= 8) { bytes.push(acc & 255); acc >>= 8; accBits -= 8; } };
  emit(clear); let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]; const key = prefix * 4096 + k;
    if (dict.has(key)) { prefix = dict.get(key); continue; }
    emit(prefix);
    if (next < 4096) { dict.set(key, next++); if (next > (1 << codeSize) && codeSize < 12) codeSize++; }
    else { emit(clear); dict = new Map(); codeSize = minCode + 1; next = eoi + 1; }
    prefix = k;
  }
  emit(prefix); emit(eoi); if (accBits > 0) bytes.push(acc & 255);
  return bytes;
}
// scale a sprite up and pad it into a fixed box, bottom-aligned (vertical scale for squash/stretch)
function frameOf(spr, boxW, boxH, ys) {
  const px = new Uint32Array(boxW * boxH); ys = ys || 1;
  const w = spr.w * SCALE, h = Math.round(spr.h * SCALE * ys); const ox = Math.floor((boxW - w) / 2), oy = boxH - h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = spr.px[Math.floor(y / h * spr.h) * spr.w + Math.floor(x / SCALE)]; if (c && oy + y >= 0) px[(oy + y) * boxW + ox + x] = c; }
  return px;
}
const write = (name, frames, w, h, fps) => fs.writeFileSync(path.join(OUT, name + '.gif'), gif(frames, w, h, Math.round(100 / fps)));

// ---- export ----
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.gif')) fs.unlinkSync(path.join(OUT, f)); // drop stale files
const B = 16 * SCALE, BH = Math.ceil(16 * SCALE * 1.15);
const sections = [];

// animations (enemies first, then everything else)
const anims = G('Object.keys(SPR_ANIM)'); const enemies = G('Object.keys(Content.enemies)');
const rowsFor = (list) => list.map(id => { const a = G('SPR_ANIM[' + JSON.stringify(id) + ']'); write('anim_' + id, a.f.map(s => frameOf(s, B, BH)), B, BH, a.fps); return { id, file: 'anim_' + id + '.gif', note: a.f.length + ' frames @ ' + a.fps + ' fps' }; });
sections.push(['Enemy animations', 'Defined by `anim:` in each file in `src/content/enemies/`.', rowsFor(enemies.filter(id => anims.includes(id)).sort())]);
sections.push(['Other animations', 'Defined with `defineAnim(...)` in `src/content/sprites/`.', rowsFor(anims.filter(id => !enemies.includes(id)).sort())]);

// hero run cycles: both classes, every facing, cloth / chain / plate
const runRows = [];
for (const cls of ['sword', 'monk']) for (const dir of ['front', 'side', 'back']) for (const tier of cls === 'monk' ? [0] : [0, 1, 2]) {
  const name = 'run_' + cls + '_' + dir + (cls === 'monk' ? '' : '_' + ['cloth', 'chain', 'plate'][tier]);
  const frames = [];
  for (let step = 0; step < 8; step++) { // two loops so you can see the mirrored kick on front/back
    const fr = G('RUN_SEQ[' + (step % 4) + ']'), sc = G('RUN_SCALE[' + (step % 4) + ']'); const flip = dir !== 'side' && (Math.floor(step / 4) & 1);
    frames.push(frameOf(G('heroSpriteRun(' + JSON.stringify(cls) + ", '#38b038', " + tier + ', ' + JSON.stringify(dir) + ', ' + fr + ', ' + !!flip + ')'), B, BH, sc));
  }
  write(name, frames, B, BH, 9); runRows.push({ id: name.replace('run_', '').replace(/_/g, ' '), file: name + '.gif', note: 'A B C B, 9 fps' });
}
sections.push(['Hero run cycle', 'Poses in `RUN_FRONT` / `RUN_SIDE`, order in `RUN_SEQ`, squash in `RUN_SCALE` (`src/content/sprites/heroes.js`).', runRows]);

// every still sprite
const still = G('Object.keys(SPR)').sort().map(id => { write('sprite_' + id, [frameOf(G('SPR[' + JSON.stringify(id) + ']'), B, B)], B, B, 1); return { id, file: 'sprite_' + id + '.gif', note: '' }; });
sections.push(['All sprites', 'Every `defineSprite` / `defineSpriteVariant`, as drawn.', still]);

// gallery page (GitHub shows docs/art/README.md when you open the folder)
let md = '# Emberwake art\n\nGenerated by `node tools/export_art.js` (runs automatically with `python build.py`). Don\'t edit these files by hand. Change the sprite or animation in `src/content/` and rebuild.\n\n';
for (const [title, sub, rows] of sections) {
  md += '## ' + title + '\n\n' + sub + '\n\n';
  const cols = 6;
  md += '|' + ' |'.repeat(cols) + '\n|' + '---|'.repeat(cols) + '\n';
  for (let i = 0; i < rows.length; i += cols) {
    const r = rows.slice(i, i + cols);
    md += '|' + r.map(x => '<img src="' + x.file + '" width="' + B + '"><br>**' + x.id + '**' + (x.note ? '<br><sub>' + x.note + '</sub>' : '')).join('|') + '|'.repeat(cols - r.length + 1) + '\n';
  }
  md += '\n';
}
fs.writeFileSync(path.join(OUT, 'README.md'), md);
console.log('art: wrote ' + fs.readdirSync(OUT).filter(f => f.endsWith('.gif')).length + ' GIFs to docs/art/ (open docs/art/README.md)');
