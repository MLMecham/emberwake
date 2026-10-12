// ===== content/items/relics.js : rare tools. Where to find them is still open (docs/IDEAS.md); debug mode hands them out. =====
'use strict';
// GALE CLOAK (B-item): fly for a few seconds. While airborne you pass over water, lava, spikes, pits and vents like a bat
// (walls still stop you). Land somewhere bad and it's like any fall. game/sim.js flying(), ui/main.js movement.
defineItem({ id: 'galecloak', name: 'GALE CLOAK', sprite: 'galecloak', monk: { name: 'WIND STEP' }, slot: 'b', order: 8, team: true, debug: true,
  owned: (p) => !!p.items.galecloak,
  give(sim, p, ctx) { p.items.galecloak = true; ctx.banner(); },
  use(sim, p) {
    if (sim.flying(p)) return endFlight(sim, p); // press again mid-flight to drop (and slam, with the scroll)
    if (sim.time < (p.flyReady || 0)) return sim.hint(p, 'THE CLOAK IS STILL CATCHING ITS BREATH.');
    p.flyUntil = sim.time + FLY_TIME; p.flyReady = p.flyUntil + FLY_COOLDOWN; sim.sfx('gale', p.lvl, p.x, p.y);
  },
});
// Ending a flight early: you drop where you are. With the GALE SLAM scroll you slam down, stunning and shoving foes
// around you. Riding the flight out to the end gives no slam.
const SLAM_R = 2.3, SLAM_STUN = 2;
function endFlight(sim, p) {
  p.flyUntil = sim.time; p.flyReady = sim.time + FLY_COOLDOWN;
  if (!p.items.cloakslam) return sim.sfx('land', p.lvl, p.x, p.y);
  sim.sfx('boom', p.lvl, p.x, p.y); sim.ev({ t: 'shake', lvl: p.lvl, x: p.x, y: p.y }); sim.spawn({ k: 'fx', lvl: p.lvl, x: p.x, y: p.y, spr: 'boom', life: 0.4, sc: 1.6, z: 0 });
  for (const e of sim.ents) {
    if (e.k !== 'en' || e.lvl !== p.lvl || e.dead || dist2(e.x, e.y, p.x, p.y) > SLAM_R * SLAM_R) continue; const def = enemyDef(e.type);
    if (sim.damageEnemy(e, 1, p, { pid: p.id, pierceShield: true, kbMul: 1.5 }) && !def.boss && !e.dead) { e.stun = Math.max(e.stun || 0, SLAM_STUN); e.stunFrom = sim.time; }
  }
}
defineItem({ id: 'galeslam', name: 'SCROLL: GALE SLAM', sprite: 'scroll', team: true, debug: true,
  debugGrant(p) { p.items.cloakslam = true; },
  give(sim, p, ctx) { p.items.cloakslam = true; ctx.banner(); sim.ev({ t: 'dialog', pid: p.id, text: 'WHILE THE GALE CLOAK CARRIES YOU, PRESS THE ITEM BUTTON AGAIN TO DROP OUT OF THE SKY AND SLAM THE GROUND. RIDE THE WIND TO THE END AND THERE IS NO SLAM.' }); } });
// SKELETON KEY: opens every locked door, in every dungeon, without using up keys.
defineItem({ id: 'skeletonkey', name: 'SKELETON KEY', sprite: 'skelkey', team: true, debug: true,
  give(sim, p, ctx) { p.items.skeletonkey = true; ctx.banner('SKELETON KEY: EVERY LOCK IS YOURS'); } });
