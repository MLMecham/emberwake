// ===== content/grottos.js : grottos under hollow trees, and the land's passing talk (lore) =====
// A few trees in each land are HOLLOW (a dark split in the trunk, if you look). Set one alight (the candle from the
// first shop does it; any fire does) and it burns open on a stair down into a grotto: a small rooty cave (game/world.js genGrottos picks the
// trees; game/sim.js openHollowTree opens them). Each land has one of each kind below, in different places.
//   SPRING   a warm spring: stand in it and your hearts fill back up (TL.SPRING, game/sim.js)
//   CACHE    someone's buried stash: arrows, bombs and gems, free (once)
//   HERMIT   a moss hermit who mutters about the way things are (a random line from Content.lore)
//   ROOTS    a root merchant: odd hours, cheap prices
//   LAMENT   an old man by two grave markers, singing a psalm for the living buried by the dead
// The interior is built by genCave (world.js) when the cave def has grotto: true.
'use strict';
defineProp('HOLLOWTREE', 'hollowtree', { solid: true, scale: 1.5 });
defineProp('GLOWCAP', 'glowcap', { solid: false, scale: 0.6 });
defineTexture('rootwall', (x, y, r, ctx) => {
  // packed earth, a few thick roots hanging down and wandering, little pale rootlets, moss clumps
  const rootAt = (cx, ph, amp) => Math.abs(x - (cx + Math.sin(y * 0.22 + ph) * amp + Math.sin(y * 0.61 + ph * 2) * 1.2));
  const d = Math.min(rootAt(5, 0, 2.5), rootAt(17, 2.1, 3), rootAt(27, 4.2, 2));
  const w = 1.1 + Math.sin(y * 0.3) * 0.5;
  if (d < w) return ctx.vary(d < w * 0.45 ? [150, 114, 72] : [112, 80, 48], x, y, 0.12);
  if (d < w + 0.8) return [44, 30, 20]; // shadow beside the root
  if (ctx.n4(x, y) > 0.965) return [170, 150, 110]; // rootlets
  if (y < 9 && ctx.n8(x >> 1, y >> 1) > 0.6) return ctx.vary([64, 104, 44], x, y, 0.25); // moss along the top
  return ctx.vary(ctx.n8(x >> 2, y >> 2) > 0.5 ? [62, 44, 30] : [78, 56, 38], x, y, 0.3);
}, { seed: 21 });
defineTexture('moss', (x, y, r, ctx) => { const n = ctx.n8(x >> 1, y >> 1); return ctx.vary(n > 0.82 ? [96, 140, 64] : n < 0.2 ? [54, 44, 30] : [66, 92, 44], x, y, 0.2); }, { seed: 22 });
defineTexture('rootexit', (x, y, r, ctx) => { const dx = (x - 15.5) / 10, dy = (y - 31) / 26; const d = dx * dx + dy * dy; if (d < 1) return d > 0.8 ? [110, 84, 52] : ctx.shade([236, 250, 200], 0.85 + 0.15 * (y / 31)); return ctx.texPx('rootwall', x, y); });
defineTexture('spring', (x, y, r, f, ctx) => { const w = Math.sin((x + f * 3) * 0.45 + Math.sin(y * 0.35 + f * 0.8) * 1.6); let c = [60, 170, 170]; if (w > 0.85) c = [220, 255, 240]; else if (w > 0.35) c = [100, 210, 200]; return c; }, { frames: 4 });
defineTile('ROOTWALL', { solid: true, wall: 'rootwall' });
defineTile('MOSS', { floor: 'moss' });
defineTile('ROOTEXIT', { solid: true, wall: 'rootexit', exitWall: true });
defineTile('SPRING', { floor: 'spring', heal: true }); // shallow and warm: walk in, heal up (game/sim.js)

defineSprite('hollowtree', [
  '.....kkkkkk.....',
  '...kkeelleekk...',
  '..keellleeleek..',
  '.keleeeelleeeek.',
  '.keeleeeeeeleek.',
  'keeeeeeleeeeeEEk',
  'keleeEeeeeeEeeEk',
  'keeeeeeeeeeeEEEk',
  '.kEeeeEeeEeeEEk.',
  '.kEEeEEEEEEEEEk.',
  '..kkEEkEEkEEkk..',
  '....kkNnnNkk....',
  '.....NnkkNk.....',
  '.....NkkkkN.....',
  '....kNnkknNk....',
  '...kkkkkkkkkk...',
]);
defineSprite('glowcap', [
  '................', '................', '................', '................', '................', '................',
  '................', '................', '.........kkk....', '..kkk...kcccK...', '.kcwck..kcccck..', '.kccck...kzk....',
  '..kzk....kzk....', '..kzk....kzk....', '.kkzkk..kkzkk...', '................'], { K: '#14121c' });
defineSpriteVariant('hermit_moss', 'oldman', { R: '#4f7a34', w: '#d8e0c0' });
defineSpriteVariant('hermit_ash', 'oldman', { R: '#4a4650', w: '#c8c4cc' }); // the lament grotto's mourner, in grave-grey

defineCave('g_spring', { name: 'WARM SPRING', grotto: true, npc: null, spring: true, sign: 'WARM WATER, DEEP UNDER THE ROOTS. REST A WHILE. NOBODY WILL LOOK FOR YOU HERE.', stock: [] });
defineCave('g_cache', { name: 'ROOT CACHE', grotto: true, npc: null, sign: 'SCRATCHED INTO A ROOT: FOR WHOEVER COMES UP NEXT. TAKE IT. WE HAVE ENOUGH DOWN THERE.', stock: [{ x: 4, item: 'arrows', price: 0, gift: true }, { x: 6, item: 'gems50', price: 0, gift: true }, { x: 8, item: 'bombs', price: 0, gift: true }] });
defineCave('g_hermit', { name: 'MOSS HERMIT', grotto: true, npc: 'hermit_moss', lore: true, stock: [] });
defineCave('g_roots', { name: 'ROOT MERCHANT', grotto: true, npc: 'hermit_moss', text: 'CUSTOMERS! UNDER A TREE! WHAT A WORLD. EVERYTHING CHEAP. COIN IS NO USE TO ME, BUT I LIKE THE SOUND.', stock: [{ x: 3, item: 'arrows', price: 18 }, { x: 6, item: 'heart', price: 5 }, { x: 9, item: 'potion', price: 32 }] });
// LAMENT: an old man by two grave markers, singing a psalm for the living buried by the dead. Pages split on '|'.
defineCave('g_psalm', { name: 'THE LAMENT', grotto: true, npc: 'hermit_ash', graves: true, stock: [],
  text: 'HEAR ME, ROOTS, FOR NO ONE ELSE WILL LISTEN. WE LAID OUR DEAD IN THE COOL EARTH. WE SANG OVER THEM, AND WENT HOME TO OUR FIRES.' +
    '|NOW THE DEAD WALK IN THE SUN, AND THE LIVING LIE DOWN IN THE DARK. THEY HAVE TAKEN OUR FIELDS, AND WE HAVE TAKEN THEIR GRAVES.' +
    '|WE DIG OUR HOMES WHERE WE ONCE DUG THEIR RESTING PLACES. OUR CHILDREN ARE BORN UNDER STONE. THEY NAME THE ROOTS THE WAY WE NAMED THE STARS.' +
    '|THE DEAD DO NOT HUNGER, YET THEY TOOK THE HARVEST. THE DEAD DO NOT SLEEP, YET THEY TOOK THE BEDS. THE DEAD CANNOT BE WARMED, YET THEY TOOK THE FIRE.' +
    '|HOW LONG, O HEARTH? HOW LONG SHALL YOUR CHILDREN KEEP THE GRAVE WARM FOR THOSE WHO WILL NOT LIE IN IT? WE BURIED THEM ONCE. NOW THEY BURY US, AND CALL IT PEACE.' +
    '|AND YET A SEED IS BURIED TOO. AND A SEED IS NOT DEAD.' });
Content.grottoKinds = ['g_spring', 'g_cache', 'g_hermit', 'g_roots', 'g_psalm'];

// ---- passing talk: hermits, hint caves and old signs say these. Nobody explains; you put it together. ----
Content.lore = [
  'YOU CAME UP THE LONG STAIR? THEN DON\'T SAY WHERE FROM. NOT HERE. NOT ALOUD.',
  'IF ANYONE ASKS, YOU\'RE A HERMIT. EVERYONE UP HERE IS A HERMIT.',
  'THE KING\'S MEN DON\'T BOTHER WITH THE OLD. WE\'RE HALF THEIRS ALREADY, THEY SAY.',
  'I KNEW A KNIGHT ONCE. KIND HANDS. HE STILL WALKS THE NORTH ROAD. I DON\'T WAVE ANYMORE.',
  'NEVER LIFT A FALLEN KNIGHT\'S VISOR. YOU WON\'T LIKE WHAT ISN\'T THERE.',
  'THE KNIGHTS DON\'T EAT. DON\'T SLEEP. DON\'T BLEED. THEY STILL SALUTE, THOUGH.',
  'LISTEN AT NIGHT. THE KNIGHTS MARCH IN STEP. ALL OF THEM. EVEN THE ONES MILES APART.',
  'SKELETONS ARE ONLY DEAD. KNIGHTS ARE DEAD AND OBEDIENT. LEARN THE DIFFERENCE.',
  'THE THORN-FOLK NEVER FORGAVE US THE FIRES. THE DEAD BURN NO WOOD. SO THE THORN-FOLK KNEEL.',
  'A THORNLING WILL SHOW A KNIGHT THE WAY IN. IT WON\'T SHOW HIM THE WAY OUT.',
  'THE BEASTS DON\'T CARE FOR KINGS OR DRAGONS. THEY REMEMBER WHO HUNTED THEM. THAT WAS US.',
  'THE WALLS AT THE PASSES WERE BUILT TO KEEP THE WYRMS OUT. NOW THEY KEEP NOTHING IN.',
  'WARDHOLD HAD NINE THOUSAND SPEARS AND ONE PROMISE: NO FIRE CROSSES.',
  'WHEN THE WALLS FELL, A MAN IN BRIGHT ARMOR SAID THE DEAD COULD STILL HOLD A LINE. WE CHEERED HIM.',
  'THE DRAGONS WERE NEVER OUR FRIENDS. BUT THEY HATE HIM WORSE THAN THEY EVER HATED US.',
  'WHY WOULD HE WANT EMBERS? WHAT IS COLD WANTS TO BE WARM. WHAT IS EMPTY WANTS TO BE FULL.',
  'THE HEARTH WAS LIT BY WYRMS AND GUARDED BY MEN. THAT WAS THE BARGAIN. ASK WHO BROKE IT.',
  'SHIPS USED TO SAIL SOUTH. THE TIDE STILL BRINGS IN HELMETS. NEVER ANY SHIPS.',
  'THE SOUTH WIND SMELLS LIKE A CELLAR.',
  'HE KEEPS A CROWN UNDER THE NORTH PEAKS. HE KEEPS ANOTHER ACROSS THE WATER. A KING WITH NO HEAD CAN WEAR AS MANY AS HE LIKES.',
  'MY GRANDMOTHER SAID THE KING HAD A NAME ONCE. SHE WOULDN\'T SAY IT. SHE SAID IT STILL ANSWERS.',
  'THE STAIRS UNDER THE TREES ARE OLDER THAN THE KING. OLDER THAN THE WALLS. THE ROOTS KEEP THEM QUIET.',
  'THE BELLS IN THE SUNKEN STAIR RANG FOR THE LIVING. NOBODY RINGS THEM NOW.',
  'COUNT THE BANNERS ON THE KNIGHTS. SAME CREST AS THE OLD WALLS. SAME CREST AS OUR FATHERS\'.',
];
// a few of them turn up in the old men's hint caves too
defineHints([
  'NEVER LIFT A FALLEN KNIGHT\'S VISOR. YOU WON\'T LIKE WHAT ISN\'T THERE.',
  'SHIPS USED TO SAIL SOUTH. THE TIDE STILL BRINGS IN HELMETS. NEVER ANY SHIPS.',
  'SOME TREES ARE HOLLOW. A LITTLE FIRE FINDS THE WAY IN.',
]);
