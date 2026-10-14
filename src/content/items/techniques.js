// ===== content/items/techniques.js : technique scrolls and bow upgrades =====
// Scrolls teach the whole party a technique (stored in p.items). Bramble Keep hides the first ones behind the eye in its boss room.
'use strict';
// LOADED SHOT: hold the item button with the bow to nock a second arrow, let go to fire both at once.
// Twice the damage and a harder shove; a shield takes the hit but its knight is stunned (bow.js, game/sim.js shieldBreak).
defineItem({ id: 'loadedshot', name: 'SCROLL: LOADED SHOT', sprite: 'scroll', team: true, debug: true, monk: { name: 'SCROLL: TWIN DARTS' },
  debugGrant(p) { p.items.loaded = true; },
  give(sim, p, ctx) { p.items.loaded = true; ctx.banner(); sim.ev({ t: 'dialog', pid: p.id, text: p.cls === 'monk' ? 'HOLD THE ITEM BUTTON WITH THE DARTS TO GATHER A SECOND, THEN LET GO. TWICE THE STING, AND A SHIELD WON\'T SAVE THEM FROM IT.' : 'HOLD THE ITEM BUTTON WITH THE BOW TO NOCK A SECOND ARROW, THEN LET GO. TWICE THE DAMAGE, AND A SHIELD WON\'T SAVE THEM FROM IT.' }); } });
// LOADED SHOT 2: one more arrow on the string (three at once). Either Loaded Shot scroll works on its own, in any order.
defineItem({ id: 'tripleshot', name: 'SCROLL: LOADED SHOT 2', sprite: 'scroll', team: true, debug: true, monk: { name: 'SCROLL: TWIN DARTS 2' },
  debugGrant(p) { p.items.loaded2 = true; },
  give(sim, p, ctx) { p.items.loaded2 = true; ctx.banner(); sim.ev({ t: 'dialog', pid: p.id, text: 'HOLD THE ITEM BUTTON WITH THE BOW A LITTLE LONGER TO NOCK ONE MORE ARROW. EVERY ARROW ON THE STRING HITS AS ONE.' }); } });
// quivers: you start able to carry 15 arrows; the Big Quiver holds 30 and the Great Quiver 50
defineItem({ id: 'quiver', name: 'BIG QUIVER', sprite: 'quiver', team: true, debug: true, monk: { name: 'BIG DART POUCH' },
  debugGrant(p) { p.maxArrows = Math.max(p.maxArrows || ARROWS_START, 30); },
  give(sim, p, ctx) { p.maxArrows = Math.max(p.maxArrows || ARROWS_START, 30); p.arrows = p.maxArrows; ctx.banner(); } });
defineItem({ id: 'quiver50', name: 'GREAT QUIVER', sprite: 'quiver', team: true, debug: true, monk: { name: 'GREAT DART POUCH' },
  debugGrant(p) { p.maxArrows = Math.max(p.maxArrows || ARROWS_START, 50); },
  give(sim, p, ctx) { p.maxArrows = Math.max(p.maxArrows || ARROWS_START, 50); p.arrows = p.maxArrows; ctx.banner(); } });
// BOMB ARROWS: Shift + bow fires an arrow with a bomb tied on (items/bow.js useAlt). Not placed in the world yet (debug only).
defineItem({ id: 'bombarrows', name: 'SCROLL: BOMB ARROWS', sprite: 'scroll', team: true, debug: true, monk: { name: 'SCROLL: BLAST DARTS' },
  debugGrant(p) { p.items.bombarrow = true; },
  give(sim, p, ctx) { p.items.bombarrow = true; ctx.banner(); sim.ev({ t: 'dialog', pid: p.id, text: 'HOLD SHIFT AS YOU SHOOT TO TIE A BOMB TO THE ARROW. IT BURSTS WHERE IT LANDS, AND AN EYE IT HITS STAYS SHUT.' }); } });
// SWORD TECHNIQUES. Everyone with a sword starts with the POMMEL STRIKE: Shift + hold attack flips the sword into reverse
// grip, and letting go drives the hilt into whatever's in front of you (a long stun, little damage; ui/main.js, game/sim.js).
// LUNGE: hold the reverse grip until it chimes, then let go to charge forward and slash 2-4 times (more with a better sword).
defineItem({ id: 'lunge', name: 'SCROLL: LUNGE', sprite: 'scroll', team: true, debug: true,
  debugGrant(p) { p.items.lunge = true; },
  give(sim, p, ctx) { p.items.lunge = true; ctx.banner(); sim.ev({ t: 'dialog', pid: p.id, text: 'HOLD SHIFT AND ATTACK. KEEP HOLDING UNTIL THE BLADE SINGS, THEN LET GO: YOU LUNGE FORWARD AND CUT AGAIN AND AGAIN.' }); } });
// HEAVY POMMEL: pommel strikes also knock a piece of armor off (once per foe, like a bomb; see stripArmor in game/sim.js).
defineItem({ id: 'heavypommel', name: 'SCROLL: HEAVY POMMEL', sprite: 'scroll', team: true, debug: true,
  debugGrant(p) { p.items.heavypommel = true; },
  give(sim, p, ctx) { p.items.heavypommel = true; ctx.banner(); sim.ev({ t: 'dialog', pid: p.id, text: 'YOUR POMMEL STRIKE NOW CRACKS ARMOR. EACH FOE ONLY LOSES ONE PIECE TO IT, SO MIX IT WITH BOMBS.' }); } });
// MIRROR GUARD: shots the Wardhold shield reflects (game/sim.js reflectProj) hit three times as hard.
defineItem({ id: 'mirrorguard', name: 'SCROLL: MIRROR GUARD', sprite: 'scroll', team: true, debug: true,
  debugGrant(p) { p.items.mirrorguard = true; },
  give(sim, p, ctx) { p.items.mirrorguard = true; ctx.banner(); sim.ev({ t: 'dialog', pid: p.id, text: 'SHOTS YOUR SHIELD SENDS BACK NOW HIT THREE TIMES AS HARD.' }); } });
