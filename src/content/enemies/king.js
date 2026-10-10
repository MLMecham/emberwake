// ===== content/enemies/king.js =====
// The Hollow King, final boss of level 9. Teleports, fires rings and fans, summons minions. Only silver arrows can finish him.
'use strict';
defineEnemy({
  id: 'king',
  hp: 30, spd: 0, dmg: 3, r: 0.6, sc: 1.6, boss: true, fixedHp: true,
  bossOf: [9],
  ai: (sim, e, dt, { p }) => {
    if (e.tm > 0 || !p) return;
    e.st = (e.st + 1) % 3; // cycle: teleport, fire ring, aimed volley
    if (e.st === 0) { AI.teleportInRoom(sim, e, p, 6); e.tm = 0.8; }
    else if (e.st === 1) { AI.ring(sim, e, 'fire', 10, e.t, { dmg: 3 }); sim.sfx('roar', e.lvl); e.tm = 1.2; }
    else { AI.fan(sim, e, 'magic', Math.atan2(p.y - e.y, p.x - e.x), 3, 0.4, { dmg: 3 }); e.tm = 1.2; if (Math.random() < 0.4) sim.spawnMinion(e, Math.random() < 0.5 ? 'bat' : 'ghost'); }
  },
  anim: { fps: 2, frames: (s, kit) => [s, kit.bob(s, 1)] },
  // can't be finished off without silver arrows
  onDamage(sim, e, dmg, opt) {
    if (e.hp - dmg > 0 || (opt && opt.silver)) return true;
    e.hp = 1; e.hurt = 0.4; sim.sfx('clink', e.lvl);
    if (!e.taunt || sim.time - e.taunt > 4) { e.taunt = sim.time; sim.msg('"FOOLS. ONLY SILVER CAN UNMAKE A KING."'); }
    return false;
  },
  onDeath: () => 'win',
  sprite: [
    '...y..y..y..y...',
    '...yy.yyyy.yy...',
    '...yyyyyyyyyy...',
    '...kkkkkkkkkk...',
    '...kGGGGGGGGk...',
    '...kGrrGGrrGk...',
    '...kGGGGGGGGk...',
    '..kPkGkkkkGkPk..',
    '.kPPPkGGGGkPPPk.',
    'kPPpPPkkkkPPpPPk',
    'kPpPPPPyyPPPPpPk',
    'kPpPPPPPPPPPPpPk',
    'kPPpPPPPPPPPpPPk',
    '.kPPPPPPPPPPPPk.',
    '..kPPPPkkPPPPk..',
    '...kkkk..kkkk...',
  ],
});
