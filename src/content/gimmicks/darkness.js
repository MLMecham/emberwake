// ===== content/gimmicks/darkness.js : the dungeon is dark. Light the braziers with fire (candle, the wand's fire magic, flame palm). =====
'use strict';
defineSprite('brazier', [
  '................', '................', '................', '................', '................', '................',
  '................', '................', '................',
  '...kkkkkkkkkk...',
  '...kGGGGGGGGk...',
  '....kGggggGk....',
  '.....kGGGGk.....',
  '......kGGk......',
  '.....kGGGGk.....',
  '....kkkkkkkk....',
]);
defineProp('TORCH', 'brazier', { solid: true, scale: 0.7, unlit: true, round: true }); // a lit torch becomes the FLAME prop, which gives light
defineGimmick('darkness', {
  // braziers in every room's corners; the entrance's are already burning so you can see where you are
  level(L) {
    L.dark = true;
    for (const r of Object.values(L.rooms)) for (const [x, y] of [[2, 1], [10, 1], [2, 7], [10, 7]]) {
      const i = L.idx(r.rx * DSX + x, r.ry * DSY + y); if (TINFO[L.tiles[i]].solid) continue;
      L.props[i] = r === L.startRoom ? PR.FLAME : PR.TORCH;
    }
  },
});
