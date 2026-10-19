// ===== content/caves.js : what's inside each kind of cave =====
// name: shown on the map while you're inside. npc: sprite id. text: what they say. stock: items on the counter, each { x (column 1-11), item, price }.
//   gift: free.  needHearts: requires that many hearts.  choose: picking one removes the others with the same tag.
//   unique: the martial artist can't take it.
//   talk: more lines. Every time someone walks into the cave the keeper moves on to the next one: text first, then talk, then
//   the common lines for their kind (Content.talkPool). A line can be { t, mark } to mark a place on the map once heard
//   (Content.mapMarks). noTalk: always the same line. Hint and lore caves go round their whole list.
// Which caves appear on the map is the CAVE_MIX list in game/world.js.
'use strict';
defineCave('sword0', { name: 'OLD MAN', npc: 'oldman', text: 'THE DARK IS LONG, WAYFARER. STEEL IS BETTER COMPANY THAN COURAGE ALONE.', stock: [{ x: 6, item: 'sword1', price: 0, gift: true }] });
defineCave('sword1', { name: 'OLD MAN', npc: 'oldman', text: 'PROVE YOUR HEART IS STRONG... FIVE HEARTS, AND THIS BLADE IS YOURS.', stock: [{ x: 6, item: 'sword2', price: 0, gift: true, needHearts: 5 }] });
defineCave('sword2', { name: 'OLD MAN', npc: 'oldman', text: 'ONLY A HERO OF TWELVE HEARTS MAY LIFT THE MYTHRIL EDGE.', stock: [{ x: 6, item: 'sword3', price: 0, gift: true, needHearts: 12 }] });
defineCave('shop1', { name: 'SHOP', npc: 'merchant', text: 'BUY SOMETHIN\' WILL YA!', stock: [{ x: 3, item: 'bombs', price: 20 }, { x: 6, item: 'candle', price: 60 }, { x: 9, item: 'heart', price: 10 }] });
defineCave('shop2', { name: 'SHOP', npc: 'merchant', text: 'FINEST GOODS THIS SIDE OF THE RIVER.', stock: [{ x: 3, item: 'arrows', price: 30 }, { x: 6, item: 'bombs', price: 25 }, { x: 9, item: 'potion', price: POTION_PRICE }] });
defineCave('armor', { name: 'ARMORY', npc: 'merchant', text: 'LINKED STEEL RINGS, SEWN RIGHT INTO YOUR TUNIC. SHINY, EH?', stock: [{ x: 4, item: 'chain', price: 160 }, { x: 8, item: 'potion', price: POTION_PRICE }] });
defineCave('potion', { name: 'POTION SHOP', npc: 'oldman', text: 'DRINK WHEN THE DARK CLOSES IN.', stock: [{ x: 4, item: 'potion', price: POTION_PRICE }, { x: 8, item: 'potion2', price: POTION_PRICE * 2 - 40 }] });
defineCave('heart', { name: 'SECRET CAVE', npc: 'oldman', text: 'TAKE ANY ONE YOU WANT.', stock: [{ x: 4, item: 'hcont', price: 0, gift: true, choose: true }, { x: 8, item: 'potion', price: 0, gift: true, choose: true }] });
defineCave('gift', { name: 'SECRET CAVE', npc: 'merchant', text: 'IT\'S A SECRET TO EVERYONE... TAKE THIS.', stock: [{ x: 6, item: ['gems30', 'gems50', 'gems100'], price: 0, gift: true }] });
defineCave('bombshop', { name: 'GROTTO SHOP', npc: 'merchant', text: 'HEH. DIGGERS ALWAYS FIND ME. ANOTHER BAG, EIGHT MORE BOMBS.', stock: [{ x: 4, item: 'bombbag2', price: 120 }, { x: 8, item: 'bombs', price: 20 }] });
defineCave('hint', { name: 'OLD MAN', npc: 'oldman', text: null /* a random line from the hints below */, stock: [] });
defineCave('dojo', { name: 'DOJO', npc: 'master', text: 'HOH! A STEEL SWORD? THE STRONGEST WEAPON IS ATTACHED TO YOUR WRISTS. STEP ONTO THE MAT... IF YOU DARE.', stock: [{ x: 6, item: 'fists', price: 0, gift: true, unique: true }] });
defineHints([
  'GHOSTS FEAR NO WALL. BUT THEY FEAR STEEL ALL THE SAME.',
  'CRACKED STONE HIDES MORE THAN DUST. CARRY BOMBS.',
  'SOME BUSHES ARE NOT WHAT THEY SEEM. FIRE TELLS THE TRUTH.',
  'THE HOLLOW KING FALLS ONLY TO SILVER-TIPPED ARROWS.',
  'A WIND WHISTLE CARRIES YOU TO ANY GATE YOU HAVE CONQUERED.',
  'KNIGHTS GUARD THEIR FRONT. STRIKE THEM FROM THE SIDE.',
  'IN THE MOUNTAINS, A MASTER WAITS BEHIND STONE. SEEK THE ONE WHO FIGHTS WITH OPEN HANDS.',
]);

// ---- rotating talk (game/sim.js rotateTalk) ----
const talk = (kind, lines) => { Content.caves[kind].talk = lines; };
talk('sword0', ['SWING, STEP BACK, SWING AGAIN. THAT IS ALL A SWORD IS.', 'THE WILDS GET COLDER EVERY YEAR. NOBODY SAYS WHY.']);
talk('sword1', ['A BLADE THAT HEAVY WANTS A HEART TO MATCH IT. COME BACK STRONGER.']);
talk('sword2', ['THE MYTHRIL REMEMBERS EVERY HAND THAT FAILED IT. DON\'T BE ONE MORE.']);
talk('shop1', [{ t: 'THERE\'S AN OLD SWORDSMAN UP THE STORM MOUNTAIN, PAST THE HIGH WOOD AT THE TOP OF THE WILDS. TAUGHT ME TO HOLD A KNIFE. HERE, I\'LL MARK IT ON YOUR MAP. NOW BUY SOMETHIN\'!', mark: 'master' },
  'BOMBS CRACK WALLS. CANDLES BURN BUSHES. HEARTS... WELL, HEARTS ARE HEARTS.']);
talk('shop2', ['ARROWS DON\'T GROW ON TREES. WELL. THE STICKS DO.', 'THE POTION\'S DEAR, I KNOW. SO\'S A FUNERAL.']);
talk('armor', ['CHAIN TURNS A BITE INTO A BRUISE. MOSTLY.', 'PLATE? HAH. FIND IT YOURSELF. I SELL TO PEOPLE WHO COME BACK.']);
talk('potion', ['RED FOR ONE GULP, BLUE FOR TWO. DON\'T ASK WHAT\'S IN THEM.', 'IF YOU FEEL THE COLD IN YOUR BONES, DRINK. IF YOU FEEL NOTHING, DRINK FASTER.']);
talk('heart', ['ONLY ONE. THE OTHER WAITS FOR WHOEVER FINDS ME NEXT.']);
talk('gift', ['YOU AGAIN? THE SECRET\'S BEEN KEPT. GO ON, GET.', 'I\'D GIVE YOU MORE, BUT THEN IT WOULDN\'T BE A SECRET. IT\'D BE A SHOP.']);
talk('bombshop', ['DIGGING\'S HONEST WORK. BLOWING THINGS UP IS MORE FUN.', 'WATCH THE CEILING ON YOUR WAY OUT. I DID SAY BOMBS.']);
talk('dojo', ['OPEN HANDS, OPEN EYES. THE REST IS BREATHING.', 'THE OLD BLADE ON THE MOUNTAIN SENT YOU? HOH! HE STILL OWES ME A FIGHT.']);
// the common lines, by who's talking
Content.talkPool = {
  merchant: ['COME BACK WHEN YOU\'RE RICHER. OR NOW. NOW\'S GOOD TOO.', 'GEMS SPEND THE SAME, NO MATTER WHOSE POCKET THEY FELL OUT OF.'],
  oldman: ['IT\'S DANGEROUS OUT THERE. YOU KNOW THAT BY NOW.', 'SIT A WHILE. NO? NOBODY EVER SITS.'],
};
// places a line can mark on the Wilds map (engine/render.js draws them; team.marks)
Content.mapMarks = ['master', 'dojo'];

