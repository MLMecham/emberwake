// ===== content/sprites/frogs.js : the frog's head poking out of the water, and bubbles =====
// Underwater sprites are named <enemy id>_sub, so the boss bar can still tell who it is (ui/main.js).
'use strict';
defineSprite('frog_sub', [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...kkk....kkk...',
  '..kwkwk..kwkwk..',
  '..klllkkkklllk..',
  '.cCvcCcvcCcvcCc.',
  '..cccvccccvccc..',
  '................',
]);
defineSpriteVariant('frog_poison_sub', 'frog_sub', { l: '#b048e0', e: '#5a1a80' });
defineSpriteVariant('bogking_sub', 'frog_sub', { l: '#5f8f3a', e: '#2c4a1c' });
defineSprite('bubble', [
  '................',
  '................',
  '................',
  '................',
  '................',
  '......cccc......',
  '.....cvvvvc.....',
  '....cvwvvvvc....',
  '....cvvvvvvc....',
  '....cvvvvvvc....',
  '.....cvvvvc.....',
  '......cccc......',
  '................',
  '................',
  '................',
  '................',
]);
defineSpriteVariant('bubble_p', 'bubble', { c: '#9a40c8', v: '#c8f080', w: '#f0ffd0' });
