// ===== content/frontier.js : the lands beyond the two mountain passes =====
// The Frozen Reach (west, biome 'snow') and the Cinder Wastes (east, biome 'ash') are the outer columns of the Wilds
// (FRONTIER in game/world.js). Each has one pass, a hermit's cave just inside it, and an optional dungeon deep inside.
'use strict';
defineProp('SNOWPINE', 'snowpine', { solid: true, scale: 1.6 });
defineProp('DEADTREE', 'deadtree', { solid: true, scale: 1.5 });
defineCave('frosthint', { name: 'HERMIT', npc: 'oldman_frost',
  text: 'THE MATRIARCH SLEEPS IN RIMEFANG HOLLOW, FAR FROM THIS PASS. HER NECK REACHES FARTHER THAN YOU THINK, AND HER BREATH FREEZES YOUR LEGS. STRIKE THE HEAD. AND ON THE ICE, NEVER RUN TOWARD A PIT.',
  stock: [{ x: 4, item: 'potion', price: POTION_PRICE }, { x: 8, item: 'arrows', price: 30 }] });
defineCave('firehint', { name: 'HERMIT', npc: 'oldman_fire',
  text: 'THE PATRIARCH BROODS IN THE CINDER CALDERA. THE VENTS BREATHE EVERY FEW HEARTBEATS: WATCH THEM GLOW, THEN STEP. COLD ARROWS BITE FIRE-BORN THINGS TWICE AS DEEP.',
  stock: [{ x: 4, item: 'potion', price: POTION_PRICE }, { x: 8, item: 'bombs', price: 25 }] });
defineHints([
  'BEYOND THE WESTERN PEAKS THE GROUND IS GLASS. WHAT SLIDES, STOPS ONLY WHEN SOMETHING STOPS IT.',
  'THE HEARTH HAS THREE LOCKS: A FANG OF FROST, A HEART OF EMBER, AND ONE THAT WAS STOLEN LONG AGO.',
  'THE WYRMLINGS IN THE NUMBERED GATES ARE ONLY CHILDREN. THEIR PARENTS ARE FAR LARGER.',
]);
