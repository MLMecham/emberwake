// ===== content/elevation.js : steps and ledges (the first pieces of climbing) =====
// A tile with `raised` stands that many tiles up from the floor: its top is floor you can stand on, its sides are walls.
// You can step up STEP_UP (0.3) at a time, so a flight of quarter-steps climbs onto a ledge a full tile up; from there
// you can see over things, and walking off the edge drops you back down. Enemies only manage the lowest step.
// The rules live in game/world.js (heightAt, solidAt) and ui/main.js (your feet's height); the drawing in engine/render.js.
// Floors and sides use the level's theme ('dfloor', 'brick'), so steps match the dungeon they're built in.
'use strict';
defineTile('STEP1', { floor: 'dfloor', side: 'brick', raised: 0.25 });
defineTile('STEP2', { floor: 'dfloor', side: 'brick', raised: 0.5 });
defineTile('STEP3', { floor: 'dfloor', side: 'brick', raised: 0.75 });
defineTile('LEDGE', { floor: 'dfloor', side: 'brick', raised: 1 });
