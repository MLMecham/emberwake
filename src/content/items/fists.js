// ===== content/items/fists.js : the secret class. Taking it turns you into the martial artist. =====
'use strict';
defineItem({ id: 'fists', name: 'THE OPEN HAND', sprite: 'ki', give(sim, p, ctx) { p.cls = 'monk'; sim.ev({ t: 'monk', pid: p.id }); ctx.banner(); } });
