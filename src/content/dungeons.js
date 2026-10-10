// ===== content/dungeons.js : the nine dungeons =====
// item: the treasure on the pedestal (an item id). Enemies and bosses are chosen by each enemy's
// spawns.dungeons / bossOf lists, so a new enemy can join a dungeon without touching this file.
'use strict';
defineDungeon(1, { name: 'THE MOSSY HOLLOW', item: 'boomerang' });
defineDungeon(2, { name: 'BRAMBLE KEEP', item: 'bombbag' });
defineDungeon(3, { name: 'THE SUNKEN STAIR', item: 'bow' });
defineDungeon(4, { name: 'EMBERFORGE', item: 'rod' });
defineDungeon(5, { name: 'WHISPERING VAULT', item: 'whistle' });
defineDungeon(6, { name: 'TIDEGLASS HALLS', item: 'raft' });
defineDungeon(7, { name: 'IRON CATHEDRAL', item: 'plate' });
defineDungeon(8, { name: 'THE STARLESS DEEP', item: 'silver' });
defineDungeon(9, { name: 'HOLLOW CROWN', item: null });
