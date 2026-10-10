// ===== content/gimmicks/fakewalls.js : walls you can walk through. They whisper when you're close. =====
// Used as the secret wall for hidden rooms in the Whispering Vault (secret: 'FAKEWALL'). The whisper is in ui/main.js.
'use strict';
defineTile('FAKEWALL', { solid: false, wall: 'brick', floor: 'dfloor', fake: true });
defineGimmick('fakewalls', {
  room(L, r, { rnd, set, lane }) {
    if (rnd() < 0.6) return false;
    // a solid-looking wall across the room with one fake block
    const y = rnd.pick([2, 6]); const gap = rnd.pick([2, 3, 9, 10]);
    for (let x = 1; x <= 11; x++) if (!lane(x, y)) set(x, y, x === gap ? 'FAKEWALL' : 'BRICK');
    return true;
  },
});
