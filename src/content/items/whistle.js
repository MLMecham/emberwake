// ===== content/items/whistle.js : warps you to the gate of any dungeon you've cleared =====
'use strict';
defineItem({
  id: 'whistle', name: 'WIND WHISTLE', sprite: 'whistle', monk: { name: 'WIND STEP' }, slot: 'b', order: 6, team: true, debug: true,
  owned: (p) => !!p.items.whistle,
  give(sim, p, ctx) { p.items.whistle = true; ctx.banner(); },
  use(sim, p) {
    const done = sim.team.done.filter(d => sim.W.dungeons[d]);
    if (!done.length) return sim.hint(p, 'THE WIND HAS NOWHERE TO TAKE YOU YET.');
    const d = done[p.warpIdx++ % done.length]; const g = sim.W.dungeons[d];
    sim.sfx('whistle', p.lvl); sim.teleport(p, 'ow', g.x + 0.5, g.y + 1.8, Math.PI / 2); sim.msg(p.name + ' RIDES THE WIND TO GATE ' + d + '.', p.id);
  },
});
defineSprite('whistle', [ // a bone-white reed pipe with a swirl of wind off its end
  '................',
  '..........c.....',
  '.........c.cc...',
  '..........cc.c..',
  '..........k...c.',
  '.........kwk....',
  '........kwwk....',
  '.......kwkwk....',
  '......kwwwk.....',
  '.....kwkwk......',
  '....kwwwk.......',
  '...kwkwk........',
  '..knwwk.........',
  '..knnk..........',
  '...kk...........',
  '................']);
