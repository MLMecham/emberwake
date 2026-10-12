// ===== content/enemies/knight.js =====
// Armored chaser. Its shield blocks hits from the front, so strike from the side or use bombs.
// It turns slowly in that armor, so you can get behind it. From behind you see its back (backSprite), and only then
// do you know you're clear of the shield.
'use strict';
defineEnemy({
  id: 'knight',
  hp: 4, spd: 1.5, dmg: 2, r: 0.34, sc: 0.9,
  spawns: { biomes: ['mountain'], dungeons: [5, 6, 7, 8, 9] },
  ai: AI.chase,
  anim: { fps: 4, frames: (s, kit) => [s, kit.step(s, 12, -1, 0), s, kit.step(s, 12, 0, -1)] },
  shield: true, backSprite: 'knight_back',
  // a Heavy Pommel strike knocks the shield away (game/sim.js disarmEnemy): no more blocking, and it charges in recklessly
  disarm: 'shield_drop', disarmedSprite: 'knight_bare', disarmText: 'THE SHIELD GOES FLYING!',
  disarmedAi(sim, e, dt, ctx) { AI.chase(sim, e, dt, Object.assign({}, ctx, { spd: ctx.spd * 1.35 })); },
  sprite: [
    '................',
    '.....kkkkkk.....',
    '....kuuuuuuk....',
    '....kukkkkuk....',
    '....kuurruuk....',
    '.....kuuuuk.....',
    '..kkkUuuuuUk....',
    '.kBBkUuuuuUuk...',
    '.kBybkUuuUkuk...',
    '.kByykUUUUkuk...',
    '.kBybkUuuUk.k...',
    '.kBBk.UuuU......',
    '..kk..UU.UU.....',
    '......UU.UU.....',
    '.....kUk.kUk....',
    '................',
  ],
});
defineSprite('knight_back', [
  '................',
  '.....kkrrkk.....',
  '....kuurruuk....',
  '....kuurruuk....',
  '....kuuuuuuk....',
  '.....kuuuuk.....',
  '...kUuuuuuUkk...',
  '..kuUuuuuuUBBk..',
  '..kuUuUUuuUkBk..',
  '..kuUuUUuuUkBk..',
  '..k.UuuuuuUkk...',
  '....UuuuuuU.....',
  '.....UU.UU......',
  '.....UU.UU......',
  '....kUk.kUk.....',
  '................',
]);
// the old men know (cave hint pool)
defineHints(['KNIGHTS TURN SLOWLY IN ALL THAT ARMOR. GET BEHIND ONE AND ITS SHIELD WON\'T SAVE IT.']);
// without its shield (knocked away by a Heavy Pommel strike)
defineSprite('knight_bare', [
  '................', '.....kkkkkk.....', '....kuuuuuuk....', '....kukkkkuk....', '....kuurruuk....', '.....kuuuuk.....', '....kUuuuuUk....',
  '...kuUuuuuUuk...', '...kukUuuUkuk...', '...kukUUUUkuk...', '...k.kUuuUk.k...', '......UuuU......', '......UU.UU.....', '......UU.UU.....', '.....kUk.kUk....', '................']);
defineAnim('knight_bare', 6, (s, kit) => [s, kit.step(s, 12, -1, 0), s, kit.step(s, 12, 0, -1)]);
defineSprite('shield_drop', [ // the knight's shield, tumbling away
  '................', '................', '................', '.....kkkkkk.....', '....kBBBBBBk....', '....kByyyyBk....', '....kBybbyBk....', '....kByyyyBk....',
  '....kBBybBBk....', '.....kBBBBk.....', '......kBBk......', '.......kk.......', '................', '................', '................', '................']);
defineHints(['A BOOMERANG CURVES. IT CAN FIND THE BACK OF A SHIELDED FOE THAT YOUR BLADE CANNOT.']);
