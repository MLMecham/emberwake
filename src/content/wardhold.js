// ===== content/wardhold.js : the old man of the first cave, and the Wardhold shield =====
// The old man who hands you your first sword sits in front of a plain wooden hatch. Nobody mentions it.
// The first time anyone in the party reaches 8 hearts, the next time someone walks into that cave (never while anyone is
// inside) it has already happened: the torches are out (the cave is dark, like the Starless Deep), the hatch is a pile of
// rubble and a broken beam, and he is slumped against it, dead. A dented knight's helmet lies outside. He brought the
// passage down on himself so they couldn't follow it; they killed him and gave up. His shield lies beside him.
// (game/sim.js fallOldMan / applyFallen; the cave is W.startCave, game/world.js.)
// THE WARDHOLD SHIELD: steel, dented, a fresh cut across it, and the Wardhold crest (a flame inside a gate) - the same
// crest the knights carry, faded, on their blue and red shields (enemies/knight.js). It:
//   REFLECTS: for the first REFLECT_TIME (1 s) after it comes up, a blockable shot that hits it flies back as yours
//             (the Mirror Guard scroll makes those reflected shots hit three times as hard)
//   WARDS:    every WARD_TIME (8 s) its rim glows; while it glows, the next shot from the front that a shield can't
//             normally stop (magic, fire, breath) is stopped, and the glow goes out. Poison still gets through.
// The first old man anyone meets after taking it says one line, once (Content.wardLine).
// This is the plainest piece of the story the game gives. Don't add more explanation anywhere.
'use strict';
defineTexture('hatch', (x, y, r, ctx) => {
  if (x < 5 || x > 26 || y < 5 || y > 26) return ctx.texPx('cfloor', x, y);
  if (x === 5 || x === 26 || y === 5 || y === 26) return [56, 38, 22];
  if (Math.abs(Math.hypot(x - 16, y - 21) - 3) < 0.8) return [140, 140, 150]; // an iron ring
  return ctx.vary((x - 6) % 5 === 0 ? [70, 46, 24] : [112, 74, 40], x, y, 0.12);
});
defineTexture('rubblefloor', (x, y, r, ctx) => {
  const n = ctx.n4(x, y); if (n > 0.9) return ctx.vary([120, 112, 104], x, y, 0.2); if (n > 0.82) return [60, 52, 46];
  if (Math.abs((x - y) % 13) < 1 && n > 0.4) return [96, 64, 34]; // splinters
  return ctx.texPx('cfloor', x, y);
});
defineTile('HATCH', { floor: 'hatch' });
defineTile('HATCH_CAVED', { floor: 'rubblefloor' });
defineProp('RUBBLE', 'rubble', { solid: true, scale: 1.0, round: true });
defineProp('HELM', 'fallenhelm', { solid: false, scale: 0.6 });
defineSprite('rubble', [
  '................', '................', '................', '................', '................',
  '..........nk....',
  '.........nNk....',
  '........nNk.....',
  '...kk..nNkkk....',
  '..kgGknNkgGGk...',
  '.kgGGGkkGGgGGk..',
  'kgGGgGGGGGGGGGk.',
  'kGGGGgGGGgGGGGGk',
  'kGgGGGGGGGGGgGGk',
  'kkkkkkkkkkkkkkkk',
  '................']);
defineSprite('fallenhelm', [
  '................', '................', '................', '................', '................', '................', '................', '................',
  '......kkkk......',
  '.....kuuuuk.....',
  '....kukkkkuk....',
  '....kuUuuuuk....',
  '....kuuUuuuk....',
  '.....kkkkkk.....',
  '................', '................']);
defineSprite('oldman_fallen', [
  '................', '................', '................', '................', '................',
  '.......kkkk.....',
  '......kwwwwk....',
  '.....kwwwwwwk...',
  '....kRwwwwwwRk..',
  '...kRRRwwwwRRRk.',
  '...kRRRRRRRRRRk.',
  '..ksRRRRRRRRRRk.',
  '..kRRRRRRRRRRRRk',
  '.kRRRRRRRRRRRRRk',
  '.kkkkkkkkkkkkkkk',
  '................']);
defineSprite('wardshield', [
  '................',
  '...kkkkkkkkkk...',
  '..kggggggggggk..',
  '..kgGGGGGGGGgk..',
  '..kgGZGGoGZGgk..',
  '..kgGZGoyGZGgk..',
  '..kgGZGyyGZGgk..',
  '..kgGZZZZZZGgk..',
  '..kgGGGGGGGGgk..',
  '...kgGGGGGkgk...',
  '...kgGGGGkGgk...',
  '....kgGGkGgk....',
  '.....kgGGgk.....',
  '......kggk......',
  '.......kk.......',
  '................']);
defineItem({ id: 'wardshield', name: 'WARDHOLD SHIELD', sprite: 'wardshield', team: true, debug: true,
  give(sim, p, ctx) { p.items.wardshield = true; ctx.banner(); } });
Content.fallen = {
  text: 'HE IS COLD. BEHIND HIM THE PASSAGE IS FILLED WITH STONE. HE BROUGHT IT DOWN HIMSELF.',
  hearts: 8, // the first time anyone has this many hearts
};
Content.npcTalkR = { oldman_fallen: 1.1 }; // you only read him when you're right beside him
Content.wardLine = 'THAT SHIELD... DON\'T PITY HIM. HE CHOSE THE FIRST DOOR. HE KNEW.';
Content.oldMen = ['oldman', 'oldman_frost', 'oldman_fire', 'hermit_moss', 'hermit_ash']; // who knows him
