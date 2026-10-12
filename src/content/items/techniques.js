// ===== content/items/techniques.js : technique scrolls and bow upgrades =====
// Scrolls teach the whole party a technique (stored in p.items). Bramble Keep hides the first ones behind the eye in its boss room.
'use strict';
// LOADED SHOT: hold the item button with the bow to nock a second arrow, let go to fire both at once.
// Twice the damage and a harder shove; a shield takes the hit but its knight is stunned (bow.js, game/sim.js shieldBreak).
defineItem({ id: 'loadedshot', name: 'SCROLL: LOADED SHOT', sprite: 'scroll', team: true, debug: true, monk: { name: 'SCROLL: TWIN DARTS' },
  debugGrant(p) { p.items.loaded = true; },
  give(sim, p, ctx) { p.items.loaded = true; ctx.banner(); sim.ev({ t: 'dialog', pid: p.id, text: p.cls === 'monk' ? 'HOLD THE ITEM BUTTON WITH THE DARTS TO GATHER A SECOND, THEN LET GO. TWICE THE STING, AND A SHIELD WON\'T SAVE THEM FROM IT.' : 'HOLD THE ITEM BUTTON WITH THE BOW TO NOCK A SECOND ARROW, THEN LET GO. TWICE THE DAMAGE, AND A SHIELD WON\'T SAVE THEM FROM IT.' }); } });
// quivers: you start able to carry 15 arrows; this one holds 30 (a later one, 50)
defineItem({ id: 'quiver', name: 'BIG QUIVER', sprite: 'quiver', team: true, debug: true, monk: { name: 'BIG DART POUCH' },
  debugGrant(p) { p.maxArrows = Math.max(p.maxArrows || ARROWS_START, 30); },
  give(sim, p, ctx) { p.maxArrows = Math.max(p.maxArrows || ARROWS_START, 30); p.arrows = p.maxArrows; ctx.banner(); } });
// BOMB ARROWS: Shift + bow fires an arrow with a bomb tied on (items/bow.js useAlt). Not placed in the world yet (debug only).
defineItem({ id: 'bombarrows', name: 'SCROLL: BOMB ARROWS', sprite: 'scroll', team: true, debug: true, monk: { name: 'SCROLL: BLAST DARTS' },
  debugGrant(p) { p.items.bombarrow = true; },
  give(sim, p, ctx) { p.items.bombarrow = true; ctx.banner(); sim.ev({ t: 'dialog', pid: p.id, text: 'HOLD SHIFT AS YOU SHOOT TO TIE A BOMB TO THE ARROW. IT BURSTS WHERE IT LANDS, AND AN EYE IT HITS STAYS SHUT.' }); } });
