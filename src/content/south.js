// ===== content/south.js : the mountain, the summit, and the King's isle =====
// THE ASCENT (level 'climb', game/world.js genClimb): above the Hearth's region the Wilds run back one more row into the
//   high wood (the rest of that row is the sealed great wood), and at its back a stone stair climbs to a wide cave mouth in
//   the mountain, open to anyone curious. Inside is a cleft open to the sky: rooms of switchback stairs, each
//   a tile higher than the last: lava rivers low down, frozen ones high up, a storm overhead. At the top, THE SUMMIT: the relic-sealed gate to the Hearth (Frost Fang +
//   Ember Heart, as before), and the ledge looks south over everything to the King's castle on the horizon
//   (engine/render.js: L.showCastle). A rope ladder at the summit, once someone climbs down it, is a shortcut from the
//   Wilds straight back up (team.taken['climb:ladder']).
//   Side rooms: THE MASTER, behind a cracked wall (bombs) about halfway up: an old swordsman who teaches the Lunge, but
//   not while THE NIGHTWING (enemies/bat.js) shrieks over his head. Her roost is off a room near the top, behind a
//   twin-eye gate (gimmicks/twingate.js: both eyes shut at once). She drops the Wide Throw; the Bat's Ear lies in her nest.
// THE ISLE (level 'isle', genIsle): the King's island beyond the rough sea, empty for now; debug warp only.
// Plan for the rest: docs/IDEAS.md 'The south'.
'use strict';
const CLIMB_ROOMS = 8, WALL_RISE = 1.2; Content.climbRooms = CLIMB_ROOMS; // rooms from the mouth to the summit, a tile up each; how far the cleft walls stand above a room's floor
// THUNDER MOUNTAIN: dark storm rock, lava running down the low rooms, ice up high where the fire gives out, and a storm
// overhead (engine/render.js: L.storm, lightning and thunder). Fire meets frost on the way to the Hearth.
defineTexture('thunderrock', (x, y, r, ctx) => { const st = Math.sin(y * 0.5 + Math.sin(x * 0.27) * 1.6); let c = st > 0.6 ? [82, 80, 98] : st < -0.5 ? [38, 36, 48] : [58, 56, 72]; if (ctx.n8(x, y >> 1) > 0.92) c = [104, 96, 140]; return ctx.vary(c, x, y, 0.18); });
// the master's door: the same rock with one hairline crack (look for it)
defineTexture('thunderrock_crack', (x, y, r, ctx) => { const c = ctx.texPx('thunderrock', x, y); if (Math.abs((x - 17) - Math.sin(y * 0.55) * 2.5) < 0.7 && y > 6 && y < 29) return ctx.shade(c, 0.45); return c; });
defineTexture('thundercave', (x, y, r, ctx) => { const dx = (x - 15.5) / 10, dy = (y - 30) / 22, d = dx * dx + dy * dy; if (d < 1) return d > 0.82 ? [30, 28, 38] : [8, 6, 10]; return ctx.texPx('thunderrock', x, y); });
defineTexture('stormfloor', (x, y, r, ctx) => { const e = (x % 16 === 0) || (y % 16 === 0) || ((x + (y >> 4) * 7) % 16 === 0 && (y & 15) < 15); let c = e ? [34, 32, 42] : [74, 72, 86]; if (!e && ctx.n8(x * 3, y * 3) > 0.86) c = [170, 186, 210]; return ctx.vary(c, x, y, 0.2); });
// floor heights in quarter steps (CLIMBH1 = 0.25 ... CLIMBH40 = 10): ash where the lava runs, frost-flecked storm stone above
for (let n = 1; n <= 40; n++) defineTile('CLIMBH' + n, { floor: n <= 16 ? 'ash' : 'stormfloor', side: 'thunderrock', raised: n / 4 });
// a lava river sunk a little into a room's floor (you can step out of it), and frozen ones higher up (slippery)
for (let b = 1; b <= CLIMB_ROOMS; b++) defineTile('CLIMBLAVA' + b, { floor: 'lava', hurt: 1, lava: true, side: 'thunderrock', raised: b - 0.15 });
for (let b = 1; b <= CLIMB_ROOMS; b++) defineTile('CLIMBICE' + b, { floor: 'ice', slippery: true, side: 'thunderrock', raised: b });
// the cleft's walls: CLIFF<k> stands WALL_RISE above floor k; the outer edge is too tall to fly over
for (let k = 0; k <= CLIMB_ROOMS + 1; k++) defineTile('CLIFF' + k, { solid: true, wall: 'thunderrock', tall: k + WALL_RISE });
defineTile('CLIFFEDGE', { solid: true, wall: 'thunderrock', tall: 16, jag: 'peak' }); // the peak behind the summit
defineTile('CLIFFFILL', { solid: true, wall: 'thunderrock', tall: CLIMB_ROOMS + 0.4 }); // the mountain's flank around the climb: just below the summit, so the view from the top is clear
defineTile('CLIFFCRACK', { solid: true, wall: 'thunderrock_crack', tall: WALL_RISE, bomb: true, opensTo: 'CLIMBH12' }); // the master's door (room 3, a floor of 3; stands on L.wallZ)
defineTexture('ropeladder', (x, y, r, ctx) => { const rope = x === 9 || x === 22; const rung = y % 6 === 2 && x > 9 && x < 22; if (rope || rung) return ctx.vary([150, 110, 60], x, y, 0.1); return ctx.texPx('thunderrock', x, y); });
defineTile('LADDERTOP', { solid: true, wall: 'ropeladder', tall: CLIMB_ROOMS + 1, portal: true }); // the summit end: climb down
defineTile('LADDERFOOT', { solid: true, wall: 'ropeladder', tall: 2.6, portal: true }); // the Wilds end, once it's down: climb up
// the Wilds side: the high wood runs back to the mountain (world.js genClimb)
defineTile('MOUNTMOUTH', { solid: true, wall: 'thundercave', tall: 2, portal: true }); // the wide cave mouth at the top of the stair (2 tiles)
defineTile('HIGHPEAK', { solid: true, wall: 'thunderrock', tall: 6, jag: 'peak' }); // the mountain itself, over the trees
defineTile('MOUNTFLANK', { solid: true, wall: 'thunderrock', tall: 3, jag: 'peak' }); // its lower slopes
// the summit gate stands on the summit (L.wallZ), so its arch is drawn once (faceH), with the peak's rock below and above
defineTile('SUMMITGATE', { solid: true, wall: 'hearthgate', tall: 7, faceH: 1, hearthGate: true, openTile: 'SUMMITGATE_OPEN' }); // rock above it, up to the peak
defineTile('SUMMITGATE_OPEN', { solid: true, wall: 'gate', tall: 7, faceH: 1, portal: true });
defineTexture('castlewall', (x, y, r, ctx) => { const by = y % 8, bx = (x + (Math.floor(y / 8) & 1) * 8) % 16; if (by === 7 || bx === 15) return [24, 22, 30]; return ctx.vary([62, 58, 72], x, y, 0.12); });
defineTexture('castlegate', (x, y, r, ctx) => { if (x < 6 || x > 25 || y < 6) return ctx.texPx('castlewall', x, y); if (Math.hypot(x - 15.5, y - 14) < 10 && y < 14 || y >= 14) return (x % 5 === 0 || y % 6 === 0) ? [30, 24, 20] : [70, 46, 30]; return ctx.texPx('castlewall', x, y); });
defineTile('CASTLEWALL', { solid: true, wall: 'castlewall', tall: 4.2, jag: 'battlement' });
defineTile('CASTLEGATE', { solid: true, wall: 'castlegate', tall: 4.2, jag: 'battlement', sealedMsg: 'THE GATE IS SHUT. SOMETHING ON THE OTHER SIDE IS WAITING.' });
// THE MASTER: an old swordsman, grey robed
defineSpriteVariant('swordmaster', 'oldman', { R: '#4a4a5a', w: '#e8e8f0', s: '#d8b090' });
Content.master = {
  wait: 'YOU CLIMBED. GOOD. I TEACH THE BLADE, BUT NOT WITH THAT THING SCREAMING OVER MY HEAD. IT ROOSTS ABOVE, BEHIND THE GATE THAT WON\'T BE WATCHED. MAKE IT QUIET.',
  taught: 'QUIET AT LAST. HOLD THE GRIP UNTIL IT RINGS, THEN GO. ...THE LIVING WENT UNDER THE ROOTS, YOU KNOW. THERE ARE OTHERS LIKE ME, HIDING. FIND THEM.',
  locked: 'HE WAVES YOU OFF. "NOT WITH THAT SHRIEKING. MAKE IT QUIET FIRST."',
};
