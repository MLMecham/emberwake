// ===== content/drops.js : what enemies leave behind =====
// defineDropTable(id, weightOfNothing, [{ item, w, when? }]). Weights are relative; `when(sim)` can switch an entry off.
'use strict';
const anyoneHas = (item) => (sim) => Object.values(sim.players).some(p => p.items[item]);
defineDropTable('common', 34, [
  { item: 'gem1', w: 28 },
  { item: 'gem5', w: 8 },
  { item: 'heart', w: 12 },
  { item: 'bomb', w: 5 },
  { item: 'fairy', w: 2.5 },
  { item: 'arrow', w: 10.5, when: anyoneHas('bow') },
]);
