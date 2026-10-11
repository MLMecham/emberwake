// ===== content/sprites/techniques.js : technique scrolls, the quiver, and loaded arrows =====
'use strict';
// Loaded Shot: two arrows nocked together (and three, for the later scroll)
defineSprite('arrow2', [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....u...u......',
  '....uuu.uuu.....',
  '.....n...n......',
  '.....n...n......',
  '.....n...n......',
  '....wnw.wnw.....',
  '....w.w.w.w.....',
  '................',
  '................',
  '................',
]);
defineSprite('arrow3', [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...u...u...u....',
  '..uuu.uuu.uuu...',
  '...n...n...n....',
  '...n...n...n....',
  '...n...n...n....',
  '..wnw.wnw.wnw...',
  '..w.w.w.w.w.w...',
  '................',
  '................',
  '................',
]);
defineSpriteVariant('arrow2_ice', 'arrow2', { u: '#c8f4ff', n: '#4aa8e0', w: '#e8f8ff' });
defineSpriteVariant('arrow3_ice', 'arrow3', { u: '#c8f4ff', n: '#4aa8e0', w: '#e8f8ff' });
// a technique scroll: parchment with a red ribbon
defineSprite('scroll', [
  '................',
  '................',
  '..NZZZZZZZZZZN..',
  '..NzzzzzzzzzzN..',
  '...zkkzkkkzkz...',
  '...zzzzzzzzzz...',
  '...zkkkzkkzkz...',
  '...zzzzrrzzzz...',
  '...zkkzrrkkzz...',
  '...zzzzrrzzzz...',
  '...zkkkzkkkzz...',
  '...zzzzzzzzzz...',
  '..NzzzzzzzzzzN..',
  '..NZZZZZZZZZZN..',
  '................',
  '................',
]);
// a bigger quiver
defineSprite('quiver', [
  '................',
  '......u.u.u.....',
  '.....uuuuuuu....',
  '......w.w.w.....',
  '.....NNNNNNN....',
  '.....NnnnnnN....',
  '.....NnyynnN....',
  '.....NnnnnnN....',
  '.....NnnnnnN....',
  '.....NnyynnN....',
  '.....NnnnnnN....',
  '.....NnnnnnN....',
  '.....NNNNNNN....',
  '................',
  '................',
  '................',
]);
