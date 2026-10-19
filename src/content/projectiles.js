// ===== content/projectiles.js : everything that flies =====
// elem: 'fire' | 'ice' | 'magic' for elemental shots (armor only half counts against them, game/sim.js hurtPlayer); none = physical.
// spd in tiles/sec, dmg in half-hearts (enemy) or hit points (hero), range in tiles (default: 3 seconds of flight).
// blockable: a hero's shield stops it from the front.  pierce: passes through enemies.  fire: burns bushes and leaves flames.
// pierceShield: goes through knight shields.  endFx: sprite shown where it stops.
'use strict';
// enemy shots
defineProjectile({ id: 'rock', spr: 'rock', spd: 5, dmg: 1, sc: 0.6, blockable: true });
defineProjectile({ id: 'spear', spr: 'arrow', spd: 6, dmg: 1, z: 0.1, blockable: true });
defineProjectile({ id: 'magic', elem: 'magic', spr: 'magic', spd: 4.5, dmg: 2, sc: 0.6 });
defineProjectile({ id: 'fire', elem: 'fire', spr: 'fireball', spd: 4.5, dmg: 2 });
defineProjectile({ id: 'stormbolt', elem: 'magic', spr: 'stormbolt', spd: 8, dmg: 2, sc: 0.6 }); // a storm mage's crackling bolt (enemies/wizard.js)
defineProjectile({ id: 'forcepush', elem: 'magic', spr: 'forcebolt', spd: 6, dmg: 1, sc: 0.8, range: 4.5, knock: 15 }); // a force adept's push: it shoves (sim 'shove' event)
defineProjectile({ id: 'eforcewave', elem: 'magic', spr: 'forcebolt', spd: 7, dmg: 1, sc: 1.1, range: 7, knock: 34, guardOnly: true }); // a force archmage's FORCE WAVE: only a raised shield stops it, and it throws you far
defineProjectile({ id: 'elance', elem: 'magic', spr: 'beam', spd: 20, dmg: 3, sc: 1.1, range: 14 }); // a storm archmage's LIGHTNING LANCE
defineProjectile({ id: 'boneshard', spr: 'boneshard', spd: 6, dmg: 2, sc: 0.55, blockable: true }); // a bone mage's shard: physical, so a shield stops it
defineSprite('stormbolt', [
  '................', '................', '................', '.........y......', '........yw......', '.......ywy......', '......ywwy......', '.....yyyywy.....',
  '......ywwwy.....', '......yww.......', '......wy........', '......y.........', '................', '................', '................', '................']);
defineSprite('boneshard', [
  '................', '................', '................', '................', '................', '.....kk.........', '....kzzk........', '.....kzzk.......',
  '......kzzk......', '.......kzzk.....', '........kzzk....', '.........kk.....', '................', '................', '................', '................']);
// chill: seconds the hero is slowed when it hits
defineProjectile({ id: 'icebolt', elem: 'ice', spr: 'icebolt', spd: 5, dmg: 1, sc: 0.7, chill: 1.5 });
defineProjectile({ id: 'icebreath', elem: 'ice', spr: 'icebolt', spd: 6.5, dmg: 2, sc: 0.75, chill: 2.5 });
// frogs (enemies/frog.js): a slow bubble; the poison one poisons even when a shield stops it (game/sim.js poisonPlayer)
defineProjectile({ id: 'bubble', spr: 'bubble', spd: 3.4, dmg: 1, sc: 0.7, blockable: true, range: 7 });
defineProjectile({ id: 'poisonbubble', spr: 'bubble_p', spd: 3.4, dmg: 1, sc: 0.7, blockable: true, range: 7, poison: true });
defineProjectile({ id: 'firebreath', elem: 'fire', spr: 'fireball', spd: 6.5, dmg: 2, sc: 0.85 });
// hero shots
defineProjectile({ id: 'beam', spr: 'beam', spd: 9, dmg: 1, sc: 0.8, player: true, range: 7, beam: true });
defineProjectile({ id: 'ki', spr: 'ki', spd: 10, dmg: 1, sc: 0.6, player: true, range: 7, beam: true });
defineProjectile({ id: 'wave', spr: 'ki', spd: 9, dmg: 4, sc: 1.4, z: 0.1, player: true, pierce: true, pierceShield: true, endFx: 'boom' });
defineProjectile({ id: 'arrow', spr: 'arrow', spd: 11, dmg: 2, z: 0.1, player: true, eyeHit: true }); // eyeHit: shuts eye targets (gimmicks/eyes.js)
defineProjectile({ id: 'dawnbeam', spr: 'beam_dawn', spd: 11, dmg: 1, sc: 1.0, player: true, range: 9, beam: true, pierce: true, pierceShield: true });
defineProjectile({ id: 'dart', spr: 'beam', spd: 12, dmg: 2, sc: 0.5, player: true, eyeHit: true });
defineProjectile({ id: 'candle', pelem: 'fire', spr: 'flame', spd: 4, dmg: 1, sc: 0.8, z: -0.05, player: true, range: 2.2, fire: true });
defineProjectile({ id: 'palm', spr: 'flame', spd: 6, dmg: 2, sc: 1.1, z: -0.05, player: true, range: 3.5, fire: true, pierce: true });
defineProjectile({ id: 'bolt', pelem: 'storm', spr: 'beam', spd: 13, dmg: 2, sc: 0.9, player: true, chain: true, stun: 0.5, range: 9 }); // thunder rod: hops to the next foe (game/sim.js)
defineProjectile({ id: 'forcebolt', pelem: 'force', spr: 'forcebolt', spd: 9, dmg: 0.5, sc: 0.7, player: true, stun: 0.6, range: 7 }); // magic wand, plain: a shove (kbMul from the wand)
defineProjectile({ id: 'lance', pelem: 'storm', spr: 'beam', spd: 22, dmg: 3, sc: 1.1, player: true, pierce: true, pierceShield: true, stun: 2, range: 10 }); // Lightning Lance: through everything in a line
defineProjectile({ id: 'rodbolt', pelem: 'fire', spr: 'magic', spd: 8, dmg: 3, player: true });
defineProjectile({ id: 'thunder', pelem: 'storm', spr: 'beam', spd: 14, dmg: 3, sc: 0.9, player: true, pierce: true, pierceShield: true, endFx: 'boom' });
// the Thornseer's seed (enemies/thornling.js): slow, and it HOMES: it turns toward the nearest hero (homing: radians a second)
// after a short delay. Outrun it around a corner, let it hit a wall, or block it with your shield.
defineProjectile({ id: 'seed', spr: 'seedwisp', spd: 3.3, dmg: 1, sc: 0.55, blockable: true, range: 15, homing: 1.9, homeDelay: 0.25 });
// the Silkwood's spitters (enemies/spiders_silk.js): a glob of web. Blockable; if it hits you, you wade for a moment (silk: seconds)
defineSprite('webglob', ['................', '................', '................', '................', '................', '.......ww.......', '.....wwzww......', '....wzwwzww.....', '....wwzwwzw.....', '.....wwzww......', '......www.......', '................', '................', '................', '................', '................']);
defineProjectile({ id: 'webglob', spr: 'webglob', spd: 5, dmg: 1, sc: 0.6, blockable: true, silk: 1.6 });
