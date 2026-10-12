// ===== content/gourds.js : powder gourds and the other dungeons' breakables =====
// Low things on the floor you can walk right over. Only a pommel strike (Shift + attack) splits one; a sword swing just
// makes it go *thok*. Bramble Keep grows powder gourds, which drop a bomb. The other dungeons have their own kind that
// now and then drops gems or a heart. Broken ones grow back once nobody's near (game/sim.js breakGourd, updateGourds).
// Placement: game/world.js placeGourds (a few per dungeon); Bramble Keep puts one before every wall you must bomb.
'use strict';
defineSprite('gourd', [
  '................', '................', '................', '................', '................', '................', '................', '................',
  '................', '.......Ek.......', '......kEk.......', '....kkoooykk....', '...koooooooyk...', '...kooYoooYok...', '...kYoooYoooYk..', '....kkYYYYYkk...']);
defineSprite('coral', [
  '................', '................', '................', '................', '................', '................', '................', '................',
  '.....k....k.....', '....kmk..kmk.k..', '....kmk.kmk.kmk.', '..k..kmkmk.kmk..', '.kmk.kmmmkkmk...', '..kmkkmmmmmk....', '...kkmmmmmk.....', '..kkkkkkkkkkk...']);
defineSprite('slag', [
  '................', '................', '................', '................', '................', '................', '................', '................',
  '................', '................', '.....kkkkk......', '....kGGGGGkk....', '...kGxGGGGGGk...', '..kGGGGxGGxGk...', '..kGxGGGGGGGGk..', '...kkkkkkkkkk...']);
defineSprite('bonepile', [
  '................', '................', '................', '................', '................', '................', '................', '................',
  '................', '......kkkk......', '.....kzzzzk.....', '.....kzkzkk.kk..', '..kk.kzzzzkkzzk.', '.kzzkkkkkkzzzk..', '..kkzzzzzzzzk...', '..kkkkkkkkkkkk..']);
defineSprite('crystal', [
  '................', '................', '................', '................', '................', '................', '................', '.......k........',
  '......kck.......', '......kck..k....', '..k...kvck.kck..', '.kck..kvck.kvk..', '.kvck.kvck.kvck.', '.kvcckcvckkcvck.', '..kcckccckkcck..', '.kkkkkkkkkkkkkk.']);
const BREAKABLES = { // prop name -> [sprite, what it drops]
  GOURD: ['gourd', () => 'bomb'],
  CORAL: ['coral', (rnd) => { const r = rnd(); return r < 0.15 ? 'heart' : r < 0.4 ? 'gem1' : null; }],
  SLAG: ['slag', (rnd) => { const r = rnd(); return r < 0.15 ? 'heart' : r < 0.4 ? 'gem1' : null; }],
  BONEPILE: ['bonepile', (rnd) => { const r = rnd(); return r < 0.15 ? 'heart' : r < 0.4 ? 'gem1' : null; }],
  CRYSTAL: ['crystal', (rnd) => { const r = rnd(); return r < 0.15 ? 'heart' : r < 0.45 ? 'gem5' : null; }],
};
Content.breakables = {};
for (const name in BREAKABLES) { const [spr, drop] = BREAKABLES[name]; const id = defineProp(name, spr, { solid: false, scale: 0.85 }); Content.breakables[id] = { name, drop }; }
// which kind each dungeon grows (by dungeon number); anything not listed grows bone piles
Content.breakableFor = { 2: 'GOURD', 3: 'CORAL', 6: 'CORAL', 4: 'SLAG', 11: 'SLAG', 12: 'SLAG', 10: 'CRYSTAL' };
