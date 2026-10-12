// ===== content/gimmicks/twingate.js : the twin-eye gate =====
// A portcullis with an eye set in the wall on each side of it. An arrow in one eye heaves the gate half way up; it only
// opens if BOTH eyes are shut at the same moment. Each eye snaps open again after TWIN_EYE_TIME seconds (short!), so
// alone you need to be very quick, or seal one for good with a bomb arrow first. Easy with a friend: shoot together.
// Once open it stays open. Used for the secret wing of each frontier tunnel (game/world.js genTunnel).
// The logic lives in game/sim.js (hitEye 'twin', updateTwinGates); the layout in L.twinGates = [{ gate, eyes, openTo }].
'use strict';
const gateTex = (raised) => (x, y, r, th, ctx) => {
  const frame = x < 3 || x > 28 || y < 3; if (frame) return ctx.vary(th.wall || [110, 104, 98], x, y, 0.1);
  const gap = raised && y > 17; if (gap) return y > 29 ? [20, 16, 14] : [8, 6, 8]; // half raised: dark space under the bars
  const by = raised ? y + 14 : y; // the bars, shifted up when raised
  const bar = (x % 6) < 2, rail = (by % 10) < 2; if (bar || rail) return ctx.vary([150, 146, 160], x, y, 0.12);
  if (raised && y > 15 && y <= 17) return [150, 140, 120]; // the spiked bottom edge
  return [16, 12, 16];
};
defineTexture('twingate', gateTex(false), { themed: true });
defineTexture('twingate_half', gateTex(true), { themed: true });
defineTile('TWINGATE', { solid: true, wall: 'twingate', twinGate: true });
defineTile('TWINGATE_HALF', { solid: true, wall: 'twingate_half', twinGate: true });
