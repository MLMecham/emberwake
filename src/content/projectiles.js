// ===== content/projectiles.js : everything that flies =====
// spd in tiles/sec, dmg in half-hearts (enemy) or hit points (hero), range in tiles (default: 3 seconds of flight).
// blockable: a hero's shield stops it from the front.  pierce: passes through enemies.  fire: burns bushes and leaves flames.
// pierceShield: goes through knight shields.  endFx: sprite shown where it stops.
'use strict';
// enemy shots
defineProjectile({ id: 'rock', spr: 'rock', spd: 5, dmg: 1, sc: 0.6, blockable: true });
defineProjectile({ id: 'spear', spr: 'arrow', spd: 6, dmg: 1, z: 0.1, blockable: true });
defineProjectile({ id: 'magic', spr: 'magic', spd: 4.5, dmg: 2, sc: 0.6 });
defineProjectile({ id: 'fire', spr: 'fireball', spd: 4.5, dmg: 2 });
// hero shots
defineProjectile({ id: 'beam', spr: 'beam', spd: 9, dmg: 1, sc: 0.8, player: true, range: 7, beam: true });
defineProjectile({ id: 'ki', spr: 'ki', spd: 10, dmg: 1, sc: 0.6, player: true, range: 7, beam: true });
defineProjectile({ id: 'wave', spr: 'ki', spd: 9, dmg: 4, sc: 1.4, z: 0.1, player: true, pierce: true, pierceShield: true, endFx: 'boom' });
defineProjectile({ id: 'arrow', spr: 'arrow', spd: 11, dmg: 2, z: 0.1, player: true });
defineProjectile({ id: 'dart', spr: 'beam', spd: 12, dmg: 2, sc: 0.5, player: true });
defineProjectile({ id: 'candle', spr: 'flame', spd: 4, dmg: 1, sc: 0.8, z: -0.05, player: true, range: 2.2, fire: true });
defineProjectile({ id: 'palm', spr: 'flame', spd: 6, dmg: 2, sc: 1.1, z: -0.05, player: true, range: 3.5, fire: true, pierce: true });
defineProjectile({ id: 'rodbolt', spr: 'magic', spd: 8, dmg: 3, player: true });
defineProjectile({ id: 'thunder', spr: 'beam', spd: 14, dmg: 3, sc: 0.9, player: true, pierce: true, pierceShield: true, endFx: 'boom' });
