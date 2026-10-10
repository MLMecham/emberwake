// ===== content/caves.js : what's inside each kind of cave =====
// npc: sprite id. text: what they say. stock: items on the counter, each { x (column 1-11), item, price }.
//   gift: free.  needHearts: requires that many hearts.  choose: picking one removes the others with the same tag.
//   unique: the martial artist can't take it.
// Which caves appear on the map is the CAVE_MIX list in game/world.js.
'use strict';
defineCave('sword0', { npc: 'oldman', text: 'THE DARK IS LONG, WAYFARER. STEEL IS BETTER COMPANY THAN COURAGE ALONE.', stock: [{ x: 6, item: 'sword1', price: 0, gift: true }] });
defineCave('sword1', { npc: 'oldman', text: 'PROVE YOUR HEART IS STRONG... FIVE HEARTS, AND THIS BLADE IS YOURS.', stock: [{ x: 6, item: 'sword2', price: 0, gift: true, needHearts: 5 }] });
defineCave('sword2', { npc: 'oldman', text: 'ONLY A HERO OF TWELVE HEARTS MAY LIFT THE MYTHRIL EDGE.', stock: [{ x: 6, item: 'sword3', price: 0, gift: true, needHearts: 12 }] });
defineCave('shop1', { npc: 'merchant', text: 'BUY SOMETHIN\' WILL YA!', stock: [{ x: 3, item: 'bombs', price: 20 }, { x: 6, item: 'candle', price: 60 }, { x: 9, item: 'heart', price: 10 }] });
defineCave('shop2', { npc: 'merchant', text: 'FINEST GOODS THIS SIDE OF THE RIVER.', stock: [{ x: 3, item: 'arrows', price: 30 }, { x: 6, item: 'bombs', price: 25 }, { x: 9, item: 'potion', price: 50 }] });
defineCave('armor', { npc: 'merchant', text: 'LINKED STEEL RINGS, SEWN RIGHT INTO YOUR TUNIC. SHINY, EH?', stock: [{ x: 4, item: 'chain', price: 160 }, { x: 8, item: 'potion', price: 60 }] });
defineCave('potion', { npc: 'oldman', text: 'DRINK WHEN THE DARK CLOSES IN.', stock: [{ x: 4, item: 'potion', price: 40 }, { x: 8, item: 'potion2', price: 68 }] });
defineCave('heart', { npc: 'oldman', text: 'TAKE ANY ONE YOU WANT.', stock: [{ x: 4, item: 'hcont', price: 0, gift: true, choose: true }, { x: 8, item: 'potion', price: 0, gift: true, choose: true }] });
defineCave('gift', { npc: 'merchant', text: 'IT\'S A SECRET TO EVERYONE... TAKE THIS.', stock: [{ x: 6, item: ['gems30', 'gems50', 'gems100'], price: 0, gift: true }] });
defineCave('hint', { npc: 'oldman', text: null /* a random line from the hints below */, stock: [] });
defineCave('dojo', { npc: 'master', text: 'HOH! A STEEL SWORD? THE STRONGEST WEAPON IS ATTACHED TO YOUR WRISTS. STEP ONTO THE MAT... IF YOU DARE.', stock: [{ x: 6, item: 'fists', price: 0, gift: true, unique: true }] });
defineHints([
  'GHOSTS FEAR NO WALL. BUT THEY FEAR STEEL ALL THE SAME.',
  'CRACKED STONE HIDES MORE THAN DUST. CARRY BOMBS.',
  'SOME BUSHES ARE NOT WHAT THEY SEEM. FIRE TELLS THE TRUTH.',
  'THE HOLLOW KING FALLS ONLY TO SILVER-TIPPED ARROWS.',
  'A WIND WHISTLE CARRIES YOU TO ANY GATE YOU HAVE CONQUERED.',
  'KNIGHTS GUARD THEIR FRONT. STRIKE THEM FROM THE SIDE.',
  'IN THE MOUNTAINS, A MASTER WAITS BEHIND STONE. SEEK THE ONE WHO FIGHTS WITH OPEN HANDS.',
]);
