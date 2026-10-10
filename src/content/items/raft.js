// ===== content/items/raft.js : lets you walk on water =====
'use strict';
defineItem({ id: 'raft', name: 'RAFT', sprite: 'boulder', monk: { name: 'CLOUD WALK' }, team: true, debug: true, give(sim, p, ctx) { p.items.raft = true; ctx.banner(); } });
