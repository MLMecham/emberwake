// ===== content/gimmicks/cracked.js : Bramble Keep's collapsed halls =====
// The keep has no keys (dungeons.js noKeys): every lock is a cracked wall, with a powder gourd before it (game/world.js).
// Here: some rooms have a corner nook walled off by rubble, with a cracked block for a way in and a prize inside, so a
// bomb spent on a crack is never wasted. The entrance has a tablet that teaches the pommel strike and the gourds.
'use strict';
defineTile('CRACKED_PILLAR', { solid: true, wall: 'brick_bomb', floor: 'dfloor', bomb: true, opensTo: 'DFLOOR' });
// one corner nook (room-relative, top-right; the others are mirrored): bricks around a 2x2 pocket, a cracked block in the gap
const NOOK = { walls: [[9, 1], [9, 3], [10, 3], [11, 3]], crack: [9, 2], prize: [11, 2] }; // prize is a point (the pocket's middle)
const PRIZES = [['gems30', 35], ['bomb', 20], ['heart', 15], ['gems50', 20], ['gems100', 10]];
function rollPrize(rnd) { let t = rnd() * 100; for (const [id, w] of PRIZES) { t -= w; if (t < 0) return id; } return 'gems30'; }
defineGimmick('cracked', {
  room(L, r, { rnd, set }) {
    if (rnd() > 0.4) return false;
    const fx = rnd() < 0.5, fy = rnd() < 0.5; const m = ([x, y]) => [fx ? 12 - x : x, fy ? 8 - y : y];
    for (const w of NOOK.walls) set(...m(w), 'BRICK'); set(...m(NOOK.crack), 'CRACKED_PILLAR');
    const px = fx ? 13 - NOOK.prize[0] : NOOK.prize[0], py = fy ? 9 - NOOK.prize[1] : NOOK.prize[1]; r.stash = [{ item: rollPrize(rnd), x: px, y: py }];
    return true;
  },
  start(L, r, { sign, prop }) { prop(5, 3, PR.SIGN); sign(5, 3, 'THE GOURDS ARE OURS. STRIKE THEM LOW, WITH THE HILT.   (SHIFT + HOLD ATTACK, THEN LET GO. A GOURD GIVES A BOMB.)'); },
});
