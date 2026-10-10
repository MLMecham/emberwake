// ===== content/gimmicks/cracked.js : cracked pillars inside rooms that bombs can clear (Bramble Keep) =====
// Bramble Keep also sets loops: 0.4 and bombLoops: 1 in content/dungeons.js, so many shortcuts are behind cracked walls.
'use strict';
defineTile('CRACKED_PILLAR', { solid: true, wall: 'brick_bomb', floor: 'dfloor', bomb: true, opensTo: 'DFLOOR' });
defineGimmick('cracked', {
  room(L, r, { rnd, set, lane }) {
    if (rnd() < 0.5) return false;
    for (const [x, y] of [[3, 2], [9, 2], [3, 6], [9, 6], [5, 3], [7, 5]]) if (!lane(x, y) && rnd() < 0.7) set(x, y, 'CRACKED_PILLAR');
    return true;
  },
});
