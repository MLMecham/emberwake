// ===== content/items/upgrades.js : the list of upgrades and technique scrolls, for the inventory's UPGRADES page =====
// Each: id (the item that grants it), group, has(p), and in debug mode on(p) / off(p) so it can be switched on and off for
// testing (ui/main.js renderBag, game/sim.js 'dbgup'). Add new scrolls here so they show up.
'use strict';
const flag = (k) => ({ has: (p) => !!p.items[k], on: (p) => { p.items[k] = true; }, off: (p) => { delete p.items[k]; } });
Content.upgrades = [
  Object.assign({ id: 'lunge', group: 'SWORD', desc: 'SHIFT + HOLD ATTACK TO THE CHIME, LET GO: LUNGE AND SLASH' }, flag('lunge')),
  Object.assign({ id: 'heavypommel', group: 'SWORD', desc: 'POMMEL STRIKES KNOCK ARMOR OFF (ONCE PER FOE)' }, flag('heavypommel')),
  Object.assign({ id: 'loadedshot', group: 'BOW', desc: 'HOLD TO NOCK ONE MORE ARROW' }, flag('loaded')),
  Object.assign({ id: 'tripleshot', group: 'BOW', desc: 'HOLD LONGER TO NOCK ONE MORE ARROW' }, flag('loaded2')),
  Object.assign({ id: 'bombarrows', group: 'BOW', desc: 'SHIFT + BOW: AN ARROW WITH A BOMB TIED ON' }, flag('bombarrow')),
  { id: 'quiver', group: 'BOW', desc: 'CARRY 30 ARROWS', has: (p) => (p.maxArrows || ARROWS_START) >= 30, on: (p) => { p.maxArrows = Math.max(p.maxArrows || ARROWS_START, 30); }, off: (p) => { p.maxArrows = ARROWS_START; p.arrows = Math.min(p.arrows, ARROWS_START); } },
  { id: 'quiver50', group: 'BOW', desc: 'CARRY 50 ARROWS', has: (p) => (p.maxArrows || ARROWS_START) >= 50, on: (p) => { p.maxArrows = 50; }, off: (p) => { p.maxArrows = (p.maxArrows || ARROWS_START) >= 30 ? 30 : ARROWS_START; p.arrows = Math.min(p.arrows, p.maxArrows); } },
  Object.assign({ id: 'widethrow', group: 'BOOMERANG', desc: 'SHIFT + BOOMERANG: A WIDE SWEEP THAT HITS HARD' }, flag('widethrow')),
  Object.assign({ id: 'boomerang2', group: 'BOOMERANG', desc: 'TWO BOOMERANGS OUT AT ONCE' }, flag('boomerang2')),
  Object.assign({ id: 'galeslam', group: 'GALE CLOAK', desc: 'END A FLIGHT EARLY TO SLAM DOWN' }, flag('cloakslam')),
  Object.assign({ id: 'bombbag', group: 'BOMBS', desc: 'CARRY 8 BOMBS' }, flag('bombbag')),
  Object.assign({ id: 'bombbag2', group: 'BOMBS', desc: 'CARRY 16 BOMBS' }, flag('bombbag2')),
];
// the items those upgrades need, handed over by ALL ON
Content.upgradeBase = ['bow', 'boomerang', 'galecloak', 'bombs'];
