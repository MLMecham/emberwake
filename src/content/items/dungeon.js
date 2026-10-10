// ===== content/items/dungeon.js : keys, maps, compasses and Ember Shards (shared by the party) =====
'use strict';
defineItem({ id: 'key', name: 'SMALL KEY', sprite: 'key', give(sim, p) { const k = sim.team.keys; k[p.lvl] = (k[p.lvl] || 0) + 1; sim.sfx('key', p.lvl); sim.msg('SMALL KEY (' + k[p.lvl] + ')'); } });
defineItem({ id: 'map', name: 'DUNGEON MAP', sprite: 'map', give(sim, p, ctx) { sim.team.maps[p.lvl] = true; ctx.banner(); } });
defineItem({ id: 'compass', name: 'COMPASS', sprite: 'compass', give(sim, p, ctx) { sim.team.comps[p.lvl] = true; ctx.banner(); } });
defineItem({
  id: 'shard', name: 'EMBER SHARD', sprite: 'shard',
  give(sim, p, ctx) {
    const d = +p.lvl.slice(1); const t = sim.team;
    if (!t.shards.includes(d)) t.shards.push(d); if (!t.done.includes(d)) t.done.push(d);
    ctx.banner('EMBER SHARD ' + t.shards.length + '/8', true);
    sim.pendingExit = { lvl: p.lvl, at: sim.time + 3.5 }; // everyone in the dungeon returns outside after a beat
    sim.autosave = true;
  },
});
