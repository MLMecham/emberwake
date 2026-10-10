// ===== ui/debug.js : debug loadout panel and its effect on a new hero =====
'use strict';
// ---------- debug loadout ----------
// Items marked `debug: true` in content/items get a checkbox automatically.
const debugItems = () => Object.values(Content.items).filter(d => d.debug).map(d => [d.id, d.name]);
function defaultDebug() { return { on: false, sword: 1, armor: 0, hearts: 3, gems: 0, bombs: 0, arrows: 0, potions: 0, shards: 0, items: [], start: 'ow', god: false }; }
// Debug only exists for heroes named in DEV_NAMES (core/util.js).
function debugLoadout() { const d = Object.assign(defaultDebug(), G.profile.dbg || {}); if (!isDevName(G.profile.name)) d.on = false; return d; }
function fillDebugUI() {
  const d = debugLoadout(); $('dbgOn').checked = d.on; $('dbgBody').classList.toggle('off', !d.on);
  for (const k of ['sword', 'armor', 'hearts', 'gems', 'bombs', 'arrows', 'potions', 'shards']) $('dbg' + k[0].toUpperCase() + k.slice(1)).value = d[k];
  const box = $('dbgItems'); box.innerHTML = '';
  for (const [id, label] of debugItems()) { const l = document.createElement('label'); l.className = 'chk'; l.innerHTML = '<input type="checkbox" id="dbgI_' + id + '"' + (d.items.includes(id) ? ' checked' : '') + '> ' + label; box.appendChild(l); }
  const st = $('dbgStart'); st.innerHTML = '<option value="ow">THE WILDS (NORMAL START)</option>' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => '<option value="d' + n + '">LEVEL-' + n + ' ENTRANCE</option>').join(''); st.value = d.start;
  $('dbgGod').checked = d.god;
}
function readDebugUI() {
  const n = (id, lo, hi) => clamp(parseInt($(id).value, 10) || 0, lo, hi);
  G.profile.dbg = { on: $('dbgOn').checked, sword: n('dbgSword', 0, 3), armor: n('dbgArmor', 0, 2), hearts: n('dbgHearts', 3, 16), gems: n('dbgGems', 0, 999), bombs: n('dbgBombs', 0, 16), arrows: n('dbgArrows', 0, 30), potions: n('dbgPotions', 0, 2), shards: n('dbgShards', 0, 8), items: debugItems().map(i => i[0]).filter(id => $('dbgI_' + id) && $('dbgI_' + id).checked), start: $('dbgStart').value, god: $('dbgGod').checked };
  saveProfile();
}
// fresh=true: replace the starting loadout. Always: debug flag, god mode, start location.
function applyDebugLoadout(p, d, fresh) {
  const sim = G.sim; p.dbg = true; p.god = !!d.god;
  if (fresh) {
    p.sword = d.sword; p.armor = d.armor; p.maxHp = d.hearts * 4; p.hp = p.maxHp; p.gems = d.gems; p.potions = d.potions; if (d.potions) p.items.potion = true;
    for (const id of d.items) { const it = itemDef(id); if (!it) continue; if (it.debugGrant) it.debugGrant(p); else p.items[id] = true; }
    p.bombs = Math.min(p.maxBombs, d.bombs); if (d.bombs) p.items.bombs = true; p.arrows = d.arrows;
    if (d.sword > 0) sim.team.taken['c0:shop0'] = true;
    for (let i = 1; i <= d.shards; i++) { if (!sim.team.shards.includes(i)) sim.team.shards.push(i); if (!sim.team.done.includes(i)) sim.team.done.push(i); }
    if (d.start && d.start !== 'ow') { const T = sim.W.levels[d.start]; if (T) { sim.initLevel(T.id); p.lvl = T.id; p.x = T.spawn.x; p.y = T.spawn.y; p.a = T.spawn.a; } }
  }
}

