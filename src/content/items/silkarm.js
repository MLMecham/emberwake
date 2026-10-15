// ===== content/items/silkarm.js : the SILK ARM, the Broodmother's prize (dungeon 13, the Silkwood) =====
// A third arm of chitin and silk, strapped on behind you. Switch its stance on the GEAR page (it takes ARM_SWAP seconds):
//   BLADE  mirrors your sword: every swing that lands cuts again ARM_DELAY later for ARM_MIRROR (25%) of the damage
//   GUARD  holds a second shield behind you: shots a shield can stop are blocked from any side, and bites and charges
//          land 25% softer
// game/sim.js armOn / armCuts; the first-person arm is drawn in engine/render.js.
'use strict';
defineSprite('silkarm', [
  '................', '..........kk....', '.........kZZk...', '........kZzZk...', '.......kZzZk....', '......kZZZk.....', '.....kZzZk......', '....kZZZk.......',
  '...kZzZk..k.....', '...kZZk..kwk....', '..kZZk..kwwk....', '..kZk..kwwk.....', '.kZZkkkwwk......', '.kkk..kkk.......', '................', '................'], { Z: '#5a4a68', z: '#9a8aa8' });
defineItem({ id: 'silkarm', name: 'SILK ARM', sprite: 'silkarm', team: true, debug: true,
  debugGrant(p) { p.items.silkarm = true; if (!p.armMode) p.armMode = 'blade'; },
  give(sim, p, ctx) {
    p.items.silkarm = true; if (!p.armMode) p.armMode = 'blade'; if (p !== ctx.taker) return;
    ctx.banner('SILK ARM: A THIRD ARM. BLADE OR GUARD: PICK ON THE GEAR PAGE', true);
    if (p.lvl === 'd13') { if (!sim.team.done.includes(13)) sim.team.done.push(13); sim.openWarp(p); sim.openSilkPass(); sim.autosave = true; }
  } });
