# Emberwake: the story under the game

This is the story the game never tells outright. Players piece it together from signs, tablets, hermits and what things look like. **Never spell it out in the game.** When writing a new line of dialog, check it against this page. Every line should be something a person in the world would actually say, to someone they assume already knows.

## The short version

The hero came up from underground, where what's left of the people hide. The hero knows that. The players don't, at first.

Up here, a dead king rules through dead knights. The dragons hate him more than anything. The thorn-folk serve him because he leaves their forests alone. The beasts don't care about any of it. They just remember who hunted them.

## The ages

### 1. The bargain
- Three great wyrms kept the land warm:
  - the Frost Matriarch (west);
  - the Magma Patriarch (east);
  - the oldest of them, the three-headed **Hearthwyrm**.
- The Hearthwyrm lit **the Hearth**. Its fire is the reason the dead stay in the ground. Every living thing carries a little of it, an **ember**. When you die, your ember goes home to the Hearth.
- People guarded the Hearth, and the wyrms let them live. That was the bargain.
- The Patriarch forged eight **Ember Shards** in his own belly and gave them to the eight great halls of men. The numbered dungeons are what's left of those halls.

### 2. The war
- People wanted more fire than the bargain allowed: for forges, for longer lives, for the shards to burn hotter.
- The wyrms came to take it back.
- People built the **Wardholds**, fortress-cities at the two passes, to hold off the frost and the fire. Their creed was carved on every gate: *NO FIRE SHALL CROSS.* The ruins in front of the ice and fire tunnels are what's left of them, and the tunnels run under their walls.
- To deny the wyrms cover and to feed the forges, people burned the old forests. The thorn-folk lived in those forests. They have not forgotten.

### 3. The Marshal
- The war was being lost. The Lord Marshal of the Wardholds, the man in bright armor, found that a fallen soldier with a sliver of stolen ember sewn into his armor would stand back up and keep holding the line.
- The dead don't eat, sleep or run. The walls held. **The people cheered him.**
- Keeping an army of the dead on its feet takes a lot of ember. He went to the source: he cut the third head from the Hearthwyrm, the head that kept the Hearth lit, and took its fire. (Iron Cathedral's tablet: "THE HOLLOW KING TOOK THE THIRD HEAD OF THE HEARTHWYRM.")
- The Hearth dimmed. Fewer embers found their way home, and more of the dead got up on their own.
- He also took the Ember Shards (the Patriarch's tablet: "THE HOLLOW KING STOLE EVERY ONE").

### 4. The hollowing
- At some point the Marshal died too. Nobody can say when. He never stopped.
- He crowned himself. To a king of the dead, the living are a burden: they need bread, they argue, and they hide embers. So he started "recruiting".
- **The knights are his.** They look like people. Under the armor there's nothing but a cold ember and his will. They march in step, all of them, even miles apart. Their banners still carry the old crest of the Wardholds, the crest our fathers wore: the knights are the fathers and grandfathers of the people hiding below.
- The living went underground, down **the Long Stair**: old cellars, mine roads and root-stairs older than the Wardholds.
  - The **grottos under hollow trees** are its upper mouths.
  - The root cache is the underground leaving supplies for whoever comes up next ("FOR WHOEVER COMES UP NEXT").
  - The moss hermits are people who stayed up top, or scouts who never went back.
- The hero was sent up the Long Stair. The underground is getting colder because the Hearth is dying. The character knows this; the players learn it slowly. The opening dialog only says the shards are scattered and the King stirs.

### 5. Now
- **The Hollow King isn't here.** His seat is across the southern sea in the old capital: the future south map.
  - Ships used to sail south, and none come back. The tide brings in empty helmets.
  - "THE SOUTH WIND SMELLS LIKE A CELLAR."
- **What waits under the northern peaks (level 9, the Hollow Crown) is him, but not all of him.** He spreads himself through his armor, and a king with no head can wear as many crowns as he likes.
  - Beating level 9 "unmakes" that crown, and the ending text stays true to that.
  - The real thing is south, which is the sequel hook. On the win screen a line could note that the knights all stopped at once, then all turned south.
- **The dragons:**
  - They hate him above everything. He stole their sibling's head and their fire.
  - They are not people's friends either. If it got their fire back, they would burn the whole land.
  - The wyrmlings in the numbered dungeons are their young. Level 7's wyrmling was "born of the Hollow head", the stolen head's fire gone wrong.
  - The Hearthwyrm (level 12) is what's left of the oldest wyrm, short a head.
- **The thorn-folk** (thornlings, briarbacks, thornseers, nettlings):
  - They serve the King because the dead burn no wood.
  - They are not loyal. A thornling will show a knight the way in, but never the way out.
  - They hate people for the burning.
- **Everything else** (slimes, bats, frogs, wolves) is neutral to kings and dragons alike. They remember who hunted them, and that was people.

## The first old man
- The old man who gives you your first sword sits on a door to the passage below: the one the hero came up. When the party first reaches 8 hearts, he is found dead in the dark, the passage behind him brought down on himself, a knight's helmet outside. They killed him and gave up.
- His shield is the WARDHOLD SHIELD, with the same crest the knights carry. One old man, once, says: "THAT SHIELD... DON'T PITY HIM. HE CHOSE THE FIRST DOOR. HE KNEW." That's all anyone ever says. The old men are not mad hermits: they are the elderly who took the job of sitting on the doors.

## Threads to pull later (don't resolve them in a line of dialog)
- **Our fathers.** (Said as "our", never "your": everyone below lost someone to the knights.)
  - He was a knight. One knight, somewhere late, carries a different crest or a dented shield. An old man says he "had kind hands. He still walks the north road. I don't wave anymore."
  - Maybe that knight doesn't attack first, or salutes.
- **The deal** (from IDEAS): the Hollow King offers one player "never be cold again." Accept, and that player turns on the others for an alternate ending.
- **The third head:** where it is now, and whether the Hearth can be relit with it. It's tied to the Hearth's third lock, "ONE THAT WAS STOLEN LONG AGO".
- **The Long Stair itself:** a hub you go back down to. It brings the hero home, and the people there react to what you've done up top.

## Where the passing talk lives
- `Content.lore` in `src/content/grottos.js`: moss hermits say these.
- A few lines are copied into `defineHints` for the old men's hint caves.
- The Wardhold stones in each frontier tunnel (`genTunnel` in world.js).
- The existing dungeon tablets (content/dungeons.js) already fit this. Keep them as they are.
