// ===== content/south.js : the mountain, the summit, and the King's isle =====
// THE ASCENT (level 'climb', game/world.js genClimb): where the Hearthgate used to stand, a stone stair climbs to a wide
//   cave mouth in the mountain, open to anyone curious. Inside is a cleft open to the sky: rooms of switchback stairs, each
//   a tile higher than the last, with bats. At the top, THE SUMMIT: the relic-sealed gate to the Hearth (Frost Fang +
//   Ember Heart, as before), and the ledge looks south over everything to the King's castle on the horizon
//   (engine/render.js: L.showCastle). A rope ladder at the summit, once someone climbs down it, is a shortcut from the
//   Wilds straight back up (team.taken['climb:ladder']).
//   Side rooms: THE MASTER, behind a cracked wall (bombs) about halfway up: an old swordsman who teaches the Lunge, but
//   not while THE NIGHTWING (enemies/bat.js) shrieks over his head. Her roost is off the foot of the stair, behind a
//   twin-eye gate (gimmicks/twingate.js: both eyes shut at once). She drops the Wide Throw; the Bat's Ear lies in her nest.
// THE ISLE (level 'isle', genIsle): the King's island beyond the rough sea, empty for now; debug warp only.
// Plan for the rest: docs/IDEAS.md 'The south'.
'use strict';
const CLIMB_ROOMS = 8, WALL_RISE = 1.2; Content.climbRooms = CLIMB_ROOMS; // rooms from the mouth to the summit, a tile up each; how far the cleft walls stand above a room's floor
// floor heights in quarter steps (CLIMBH1 = 0.25 ... CLIMBH40 = 10): rock low down, snow higher up
for (let n = 1; n <= 40; n++) defineTile('CLIMBH' + n, { floor: n <= 16 ? 'cfloor' : 'snow', side: 'rock', raised: n / 4 });
// the cleft's walls: CLIFF<k> stands WALL_RISE above floor k; the outer edge is too tall to fly over
for (let k = 0; k <= CLIMB_ROOMS + 1; k++) defineTile('CLIFF' + k, { solid: true, wall: 'mountain', tall: k + WALL_RISE });
defineTile('CLIFFEDGE', { solid: true, wall: 'mountain', tall: 16, jag: 'peak', snow: true }); // the peak behind the summit
defineTile('CLIFFFILL', { solid: true, wall: 'mountain', tall: CLIMB_ROOMS + 0.4 }); // the mountain's flank around the climb: just below the summit, so the view from the top is clear
defineTile('CLIFFCRACK', { solid: true, wall: 'rock_bomb', tall: 3 + WALL_RISE, bomb: true, opensTo: 'CLIMBH12' }); // the master's door (room 3, a floor of 3)
defineTexture('ropeladder', (x, y, r, ctx) => { const rope = x === 9 || x === 22; const rung = y % 6 === 2 && x > 9 && x < 22; if (rope || rung) return ctx.vary([150, 110, 60], x, y, 0.1); return ctx.texPx('rock', x, y); });
defineTile('LADDERTOP', { solid: true, wall: 'ropeladder', tall: CLIMB_ROOMS + 1, portal: true }); // the summit end: climb down
defineTile('LADDERFOOT', { solid: true, wall: 'ropeladder', tall: 2.6, portal: true }); // the Wilds end, once it's down: climb up
defineTile('MOUNTMOUTH', { solid: true, wall: 'cave', tall: 2, portal: true }); // the wide cave mouth at the top of the stair (2 tiles)
defineTile('SUMMITGATE', { solid: true, wall: 'hearthgate', tall: CLIMB_ROOMS + 1, hearthGate: true, openTile: 'SUMMITGATE_OPEN' });
defineTile('SUMMITGATE_OPEN', { solid: true, wall: 'gate', tall: CLIMB_ROOMS + 1, portal: true });
defineTexture('castlewall', (x, y, r, ctx) => { const by = y % 8, bx = (x + (Math.floor(y / 8) & 1) * 8) % 16; if (by === 7 || bx === 15) return [24, 22, 30]; return ctx.vary([62, 58, 72], x, y, 0.12); });
defineTexture('castlegate', (x, y, r, ctx) => { if (x < 6 || x > 25 || y < 6) return ctx.texPx('castlewall', x, y); if (Math.hypot(x - 15.5, y - 14) < 10 && y < 14 || y >= 14) return (x % 5 === 0 || y % 6 === 0) ? [30, 24, 20] : [70, 46, 30]; return ctx.texPx('castlewall', x, y); });
defineTile('CASTLEWALL', { solid: true, wall: 'castlewall', tall: 4.2, jag: 'battlement' });
defineTile('CASTLEGATE', { solid: true, wall: 'castlegate', tall: 4.2, jag: 'battlement', sealedMsg: 'THE GATE IS SHUT. SOMETHING ON THE OTHER SIDE IS WAITING.' });
// THE MASTER: an old swordsman, grey robed
defineSpriteVariant('swordmaster', 'oldman', { R: '#4a4a5a', w: '#e8e8f0', s: '#d8b090' });
Content.master = {
  wait: 'YOU CLIMBED. GOOD. I TEACH THE BLADE, BUT NOT WITH THAT THING SCREAMING OVER MY HEAD. IT ROOSTS BELOW, BEHIND THE GATE THAT WON\'T BE WATCHED. MAKE IT QUIET.',
  taught: 'QUIET AT LAST. HOLD THE GRIP UNTIL IT RINGS, THEN GO. ...THE LIVING WENT UNDER THE ROOTS, YOU KNOW. THERE ARE OTHERS LIKE ME, HIDING. FIND THEM.',
  locked: 'HE WAVES YOU OFF. "NOT WITH THAT SHRIEKING. MAKE IT QUIET FIRST."',
};
