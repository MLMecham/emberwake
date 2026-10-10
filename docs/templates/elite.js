// ===== add to src/content/elites.js =====
// An elite is a rare glowing variant of any normal enemy. It drops loot only, never permanent upgrades.
// Add new elites at the END of the list in content/elites.js (their position is their network id).
defineElite({
  id: 'frozen', name: 'FROZEN', color: [160, 220, 255], weight: 2,   // weight: how common vs. the others
  apply(e) { e.hp = e.maxHp = e.hp * 2; e.spdMul = 0.6; },          // runs once when it spawns
  update(sim, e, dt, ctx) { /* runs every tick before its normal AI. return true to skip the normal AI */ },
  onDeath(sim, e, drop) { drop.gems(2); drop('arrow', 0, 0.4); },   // drop(item, dx, dy), drop.gems(count)
});
