// ===== content/gimmicks/eyes.js : eye targets and tidal water =====
// An EYE is a wall block with an eye on it. Only arrows (and the martial artist's darts) make it blink shut:
//   timed eye  -> its room's tide water drains while the eye is shut, then the eye creaks open and the water returns
//   sealed eye -> shuts for good and opens something (a hidden passage)
// Tide water cycles deep (can't walk) -> drained (wet stone) -> shallow (walkable, slow) -> deep.
// The timing and the tile swaps live in game/world.js (tideCode / applyRig) so the host and every client agree.
'use strict';
const brickAt = (x, y, th, ctx) => { const by = y >> 3, off = by % 2 ? 8 : 0; const edge = (y & 7) === 0 || ((x + off) & 15) === 0; let c = edge ? th.mortar : th.wall; if (!edge && (y & 7) === 1) c = th.hi; return ctx.vary(c, x, y, 0.2); };
// a big stone eye set into the brick. open: white with a red iris; shut: a heavy lid with a seam
const eyeTex = (open, small) => (x, y, r, th, ctx) => {
  const cx = 15.5, cy = 15.5, rx = small ? 5 : 11, ry = small ? 2.6 : 7;
  const dx = (x - cx) / rx, dy = (y - cy) / ry; const d = dx * dx + dy * dy;
  if (d > 1.35) return brickAt(x, y, th, ctx);
  if (d > 1) return small ? ctx.shade(th.mortar, 0.9) : [70, 60, 50]; // stone rim
  if (!open) { const seam = Math.abs(y - cy) < (small ? 0.6 : 1); return seam ? [30, 24, 20] : ctx.vary(small ? th.wall : [150, 128, 96], x, y, 0.15); }
  const ir = Math.hypot(x - cx, y - cy);
  if (ir < (small ? 1.2 : 2.2)) return [10, 6, 6]; // pupil
  if (ir < (small ? 2.2 : 4.6)) return small ? [96, 40, 36] : [210, 40, 40]; // iris (the small kind is dim, to blend into the wall)
  return small ? ctx.shade(th.hi, 1.2) : ctx.vary([236, 232, 214], x, y, 0.06);
};
defineTexture('eye', eyeTex(true), { themed: true });
defineTexture('eye_shut', eyeTex(false), { themed: true });
defineTexture('eye_small', eyeTex(true, true), { themed: true }); // the hard-to-spot kind that hides secret passages
defineTexture('eye_small_shut', eyeTex(false, true), { themed: true });
// shallow water: you can see the floor through it
defineTexture('shallow', (x, y, r, f, ctx) => { const w = Math.sin((x + f * 4) * 0.45 + Math.sin(y * 0.35 + f) * 1.4); const tile = (x & 15) === 0 || (y & 15) === 0; let c = tile ? [60, 110, 120] : [92, 156, 170]; if (w > 0.9) c = [190, 232, 240]; else if (w > 0.55) c = [120, 186, 200]; return c; }, { frames: 4 });
// wet stone where the water was: the room's floor, darker, with puddles
defineTexture('wetfloor', (x, y, r, th, ctx) => { const edge = (x & 15) === 0 || (y & 15) === 0; const pud = ctx.n8(x >> 2, y >> 2) > 0.78; let c = edge ? th.edge : th.floor; c = ctx.shade(c, 0.62); if (pud) c = [54, 84, 100]; return ctx.vary(c, x, y, 0.1); }, { themed: true });
defineTile('EYE', { solid: true, wall: 'eye', eye: true });
defineTile('EYE_SHUT', { solid: true, wall: 'eye_shut', eye: true, shut: true });
defineTile('EYE_SMALL', { solid: true, wall: 'eye_small', eye: true, small: true });
defineTile('EYE_SMALL_SHUT', { solid: true, wall: 'eye_small_shut', eye: true, small: true, shut: true });
defineTile('SHALLOW', { floor: 'shallow', shallow: true }); // walkable, 25% slower
defineTile('WET', { floor: 'wetfloor', wet: true }); // drained tide water
// the way out that glows in a boss room once its prize is taken (game/sim.js openWarp). Step on it to leave.
defineTexture('warp', (x, y, r, f, ctx) => { const d = Math.hypot(x - 15.5, y - 15.5); const ring = Math.abs(((d - f * 2) % 8 + 8) % 8 - 4) < 1.4; if (d > 14) return [60, 50, 40]; if (d < 3) return [255, 250, 210]; return ring ? [255, 236, 140] : [200, 150, 60]; }, { frames: 4 });
defineTile('WARP', { floor: 'warp', exit: true, warp: true });
