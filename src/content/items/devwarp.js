// ===== content/items/devwarp.js : WARP STONE, a developer tool. Only heroes started with the debug loadout have it. =====
// Each use jumps to the next destination: every dungeon entrance (inside), then back to the overworld start.
'use strict';
defineSprite('warpstone', [
  '................', '................', '................',
  '.......kk.......',
  '......kppk......',
  '.....kpmppk.....',
  '....kpmwmppk....',
  '....kpmmpppk....',
  '....kppppPPk....',
  '.....kppPPk.....',
  '......kPPk......',
  '.......kk.......',
  '................', '................', '................', '................',
]);
defineItem({
  id: 'devwarp', name: 'WARP STONE', sprite: 'warpstone', slot: 'b', order: 0,
  owned: (p) => !!p.dbg,
  give(sim, p) { },
  use(sim, p) {
    const stops = []; for (let d = 1; d <= NDUNGEONS(); d++) if (sim.W.levels['d' + d]) stops.push('d' + d); stops.push('ow');
    const i = (stops.indexOf(p.lvl) + 1) % stops.length; const T = sim.W.levels[stops[i]];
    sim.teleport(p, T.id, T.spawn.x, T.spawn.y, T.spawn.a); sim.sfx('whistle', T.id);
    sim.hint(p, 'WARP STONE: ' + (T.id === 'ow' ? 'THE WILDS' : 'LEVEL-' + T.dnum + ' ' + dungeonName(T.dnum)) + '. USE AGAIN FOR THE NEXT.');
  },
});
