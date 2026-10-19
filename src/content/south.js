// ===== content/south.js : the way south (first pieces) =====
// THE LOOKOUT: a stone stair that winds up 3.4 tiles beside the Hearthgate (game/world.js genLookout). From the top you see
//   over the whole land to the southern horizon, where the King's castle stands on its island (engine/render.js: a dark
//   silhouette due south, faint from the ground, plain from up here). Nobody says a word about it.
// THE ISLE (level 'isle', genIsle): the King's island beyond the rough sea. Empty for now: beaches, grass, rocks and the
//   castle, its gate shut. Reached only by debug warp until the way across (the Gale Cloak and the sea stacks) is built.
//   Plan: docs/IDEAS.md 'The south'.
'use strict';
const LOOK_STEPS = 16, LOOK_RISE = 0.2; // the spiral: 16 steps of 0.2 around a 3x3 summit at LOOK_STEPS * LOOK_RISE + 0.2
for (let i = 1; i <= LOOK_STEPS; i++) defineTile('LOOK' + i, { floor: 'path', side: 'rock', raised: +(i * LOOK_RISE).toFixed(2) });
defineTile('LOOKTOP', { floor: 'path', side: 'rock', raised: +(LOOK_STEPS * LOOK_RISE + 0.2).toFixed(2) });
defineTexture('castlewall', (x, y, r, ctx) => { const by = y % 8, bx = (x + (Math.floor(y / 8) & 1) * 8) % 16; if (by === 7 || bx === 15) return [24, 22, 30]; return ctx.vary([62, 58, 72], x, y, 0.12); });
defineTexture('castlegate', (x, y, r, ctx) => { if (x < 6 || x > 25 || y < 6) return ctx.texPx('castlewall', x, y); if (Math.hypot(x - 15.5, y - 14) < 10 && y < 14 || y >= 14) return (x % 5 === 0 || y % 6 === 0) ? [30, 24, 20] : [70, 46, 30]; return ctx.texPx('castlewall', x, y); });
defineTile('CASTLEWALL', { solid: true, wall: 'castlewall', tall: 4.2, jag: 'battlement' });
defineTile('CASTLEGATE', { solid: true, wall: 'castlegate', tall: 4.2, jag: 'battlement', sealedMsg: 'THE GATE IS SHUT. SOMETHING ON THE OTHER SIDE IS WAITING.' });
