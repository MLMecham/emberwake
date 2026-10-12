// ===== content/enemies/dummy.js : training dummies for the test zone =====
// They never move or hurt anyone, can't be knocked around, and every hit shows its damage (and the running total) above them.
// After DUMMY_RESET seconds without a hit they heal up and get any armor back (game/sim.js). One plain, one in full armor.
'use strict';
const DUMMY_ROWS = [
  '................', '......kkkk......', '.....kNNNNk.....', '.....kNkkNk.....', '.....kNNNNk.....', '......kNNk......', '..kkkkknnkkkkk..', '..kNNNNnnNNNNk..',
  '..kkkkknnkkkkk..', '.....kNNNNk.....', '.....kNxxNk.....', '.....kNNNNk.....', '......kNNk......', '.......nn.......', '.......nn.......', '.....kknnkk.....'];
const dummyAi = function (sim, e) { if (sim.time - (e.hitAt != null ? e.hitAt : -99) > DUMMY_RESET && (e.hp < e.maxHp || (enemyDef(e.type).armor || 0) !== (e.armor || 0))) { e.hp = e.maxHp; e.armor = enemyDef(e.type).armor || 0; e.stripped = {}; e.total = 0; } e.stun = 0; };
defineEnemy({ id: 'dummy', title: 'TRAINING DUMMY', hp: 999, spd: 0, dmg: 0, r: 0.34, sc: 0.95, dummy: true, anchored: true, noElites: ['giant'], drops: 'none', spawns: {}, ai: dummyAi, sprite: DUMMY_ROWS });
defineEnemy({ id: 'dummy_armored', title: 'ARMORED DUMMY', hp: 999, spd: 0, dmg: 0, r: 0.34, sc: 0.95, dummy: true, anchored: true, armor: 3, noElites: ['giant'], drops: 'none', spawns: {}, ai: dummyAi,
  sprite: DUMMY_ROWS.map((r, y) => y >= 6 && y <= 11 ? r.replace(/N/g, 'G').replace(/x/g, 'g') : y >= 1 && y <= 4 ? r.replace(/N/g, 'g') : r),
  sprFor: (e) => e.armor > 0 ? null : 'dummy' });
