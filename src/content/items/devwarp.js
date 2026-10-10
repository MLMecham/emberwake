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
// DRAGON BELL, a developer tool like the Warp Stone: drops you straight into a dragon fight, at the bottom of the
// boss room facing the dragon. First use: the Hearthwyrm (the Hearth); again: the Frost Matriarch, then the Fire Patriarch.
defineSprite('dragonbell', [
  '................', '................',
  '.......kk.......',
  '......kyyk......',
  '.....kyYYyk.....',
  '....kyYwYYyk....',
  '....kyYYYYyk....',
  '....kyYYYYyk....',
  '...kyYYYYYYyk...',
  '..kkkkkkkkkkkk..',
  '......kRRk......',
  '.......kk.......',
  '................', '................', '................', '................',
]);
defineItem({
  id: 'devboss', name: 'DRAGON BELL', sprite: 'dragonbell', slot: 'b', order: 0.5,
  owned: (p) => !!p.dbg,
  give(sim, p) { },
  use(sim, p) {
    const order = [12, 10, 11].filter(d => sim.W.levels['d' + d]); if (!order.length) return;
    const cur = order.indexOf(+String(p.lvl).slice(1)); const d = order[(cur + 1) % order.length];
    const D = sim.W.levels['d' + d]; const r = D.rooms[D.bossRoom];
    sim.teleport(p, D.id, r.rx * DSX + 6.5, r.ry * DSY + 6.4, -Math.PI / 2); sim.sfx('dragonroar', D.id);
    sim.hint(p, 'DRAGON BELL: ' + dungeonName(d) + '. USE AGAIN FOR THE NEXT DRAGON.');
  },
});
