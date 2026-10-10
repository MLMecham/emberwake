// ===== sprites.js : 16x16 pixel art =====
'use strict';
const PAL = {
  k: '#14121c', w: '#f8f8f0', g: '#a8a8b4', G: '#5c5c70', r: '#e03828', R: '#881c1c', o: '#f08830', y: '#f8d840', Y: '#b88818',
  n: '#8a5a2a', N: '#4a2e18', b: '#3a78e8', B: '#1c3c90', c: '#70e8f8', C: '#2898b0', p: '#a048d0', P: '#582080', l: '#80d848', e: '#38a838',
  E: '#1a6420', s: '#f4c094', S: '#c47c52', m: '#f868b8', u: '#d0d8e8', U: '#7884a4', z: '#ece4cc', Z: '#a89c80', H: '#5a3418', v: '#e8f8ff', x: '#ff5020',
  T: '#38b038', t: '#1e7020', h: '#80e070', // tunic placeholders (recolored)
};
const SPR_SRC = {
  hero_front: [
    '................',
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '....HHssssHH....',
    '....HskssksH....',
    '.....ssssss.....',
    '......sSSs......',
    '....hTTTTTTt....',
    '...shTTTTTTts...',
    '...s.TnyynTt.s..',
    '...S.TTTTTTt.S..',
    '.....TTTTTtt....',
    '.....TTT.ttt....',
    '.....ss...ss....',
    '.....NN...NN....',
    '................'],
  hero_back: [
    '................',
    '.....HHHHHH.....',
    '....HHHHHHHH....',
    '....HHHHHHHH....',
    '....HHHHHHHH....',
    '.....HHHHHH.....',
    '......sSSs......',
    '....tTTTTTTt....',
    '...stUnnnnUts...',
    '...s.tUuuUtt.s..',
    '...S.tTUUTtt.S..',
    '.....tTTTTtt....',
    '.....tTT.ttt....',
    '.....ss...ss....',
    '.....NN...NN....',
    '................'],
  hero_side: [
    '................',
    '......HHHHH.....',
    '.....HHHHHHH....',
    '.....HHHsssH....',
    '.....HHHsksS....',
    '......HHssss....',
    '.......sSS......',
    '.....tTTTTh.....',
    '....UtTTTThs....',
    '....UtnyyTT.s...',
    '....UtTTTTt.Su..',
    '.....tTTTTt..u..',
    '.....tTT.Tt..u..',
    '.....ss...ss....',
    '.....NN...NN....',
    '................'],
  monk_front: [
    '.......kk.......',
    '......kHHk......',
    '.....HHHHHH.....',
    '....rrrrrrrr....',
    '....HskssksH....',
    '.....ssssss.....',
    '......sSSs......',
    '...ssTTssTTss...',
    '..sS.TTssTT.Ss..',
    '..s..TTssTT..s..',
    '..ww.TkkkkT..ww.',
    '..ww.NNNNNN..ww.',
    '.....NNN.NNN....',
    '.....NN...NN....',
    '.....kk...kk....',
    '................'],
  monk_back: [
    '.......kk.......',
    '......kHHk......',
    '.....HHHHHH.....',
    '....rrrrrrrrr...',
    '....HHHHHHHH.r..',
    '.....HHHHHH..r..',
    '......sSSs......',
    '...ssTTTTTTss...',
    '..sS.TTTTTT.Ss..',
    '..s..TThhTT..s..',
    '..ww.TkkkkT..ww.',
    '..ww.NNNNNN..ww.',
    '.....NNN.NNN....',
    '.....NN...NN....',
    '.....kk...kk....',
    '................'],
  monk_side: [
    '........kk......',
    '.......kHHk.....',
    '......HHHHHH....',
    '...rrrrrrrrr....',
    '..r..HHHsksS....',
    '.....HHHssss....',
    '.......sSS......',
    '.....sTTTsss....',
    '.....sTTTs.sww..',
    '.....sTTTs..ww..',
    '.....ww.kkT.....',
    '.....ww.NNN.....',
    '......NNN.NN....',
    '......NN..NN....',
    '......kk..kk....',
    '................'],
  slime: [
    '................', '................', '................', '................', '................', '................',
    '......kkkk......',
    '....kkllllkk....',
    '...klllwllllk...',
    '..kllwwlllllek..',
    '..klkwklkwklek..',
    '.klllllllllleek.',
    '.kleelllllleeek.',
    '.keeeeeeeeeeeek.',
    '..kkkkkkkkkkkk..',
    '................'],
  spitter: [
    '................', '................', '................',
    '.....kkkkkk.....',
    '...kkrrrrrrkk...',
    '..krrwwrrwwrrk..',
    '..krwkwrrwkwrk..',
    '.krrrrrrrrrrrrk.',
    '.krrrrRkkRrrrrk.',
    '..kRrrRkkRrrRk..',
    '...kRRRkkRRRk...',
    '..krk.krrk.krk..',
    '.krk..krrk..krk.',
    '.kk...k..k...kk.',
    '................', '................'],
  thornling: [
    '..........u.....',
    '.........uuu....',
    '..........n.....',
    '....kkkk..n.....',
    '...kppppk.n.....',
    '..kpwkpwkpn.....',
    '..kpppppkpn.....',
    '...kpRRpk.n.....',
    '..kNNNNNNkpp....',
    '.kpNnnnnNkn.....',
    '.kp.NNNN..n.....',
    '....NnnN..n.....',
    '....NNNN..n.....',
    '....pk.pk.......',
    '...kpk.kpk......',
    '................'],
  bat: [
    '................', '................', '................', '................',
    'k..............k',
    'kk....k..k....kk',
    'kPk...kkkk...kPk',
    'kPPk.kprrpk.kPPk',
    'kPPPkkppppkkPPPk',
    '.kPPPPppppPPPPk.',
    '..kPPk.kk.kPPk..',
    '...kk..w..w.kk..',
    '................', '................', '................', '................'],
  skeleton: [
    '................',
    '.....kkkkkk.....',
    '....kzzzzzzk....',
    '....kzkkzkkz....',
    '....kzkkzkkz....',
    '.....kzzzzk.....',
    '......kzkzk.....',
    '...kk.kzzzk.kk..',
    '..kzzkzkzkzkzzk.',
    '..kzk.kzzzk.kzk.',
    '..kzk.kzkzk.kzk.',
    '......kzzzk..u..',
    '......kz.zk..u..',
    '......kz.zk.....',
    '.....kzk.kzk....',
    '................'],
  knight: [
    '................',
    '.....kkkkkk.....',
    '....kuuuuuuk....',
    '....kukkkkuk....',
    '....kuurruuk....',
    '.....kuuuuk.....',
    '..kkkUuuuuUk....',
    '.kBBkUuuuuUuk...',
    '.kBybkUuuUkuk...',
    '.kByykUUUUkuk...',
    '.kBybkUuuUk.k...',
    '.kBBk.UuuU......',
    '..kk..UU.UU.....',
    '......UU.UU.....',
    '.....kUk.kUk....',
    '................'],
  ghost: [
    '................', '................',
    '......kkkk......',
    '....kkwwwwkk....',
    '...kwwwwwwwwk...',
    '...kwkkwwkkwk...',
    '..kwwkkwwkkwwk..',
    '..kwwwwwwwwwwk..',
    '..kwwwkkkkwwwk..',
    '..kwwwwwwwwwwk..',
    '..kvwwwwwwwwvk..',
    '..kvvwwwwwwvvk..',
    '..kvvvwvvwvvvk..',
    '...kk.kvk.k.k...',
    '.......k........',
    '................'],
  wizard: [
    '.......kk.......',
    '......kPPk......',
    '.....kPPPPk.....',
    '....kPPyPPPk..y.',
    '...kkkkkkkkkk.n.',
    '....kSwSSwSk..n.',
    '.....kSSSSk...n.',
    '....kPPPPPPk.kn.',
    '...kPpPPPPpPksn.',
    '...kPpPPPPpk..n.',
    '...kPpPyyPpk..n.',
    '...kPpPPPPpk..n.',
    '..kPPpPPPPpPk...',
    '..kPPPPPPPPPk...',
    '...kkkkkkkkk....',
    '................'],
  wyrm: [
    '....k......k....',
    '...kRk....kRk...',
    '...kRRkkkkRRk...',
    '..kRrrrrrrrrRk..',
    '..krrwkrrkwrrk..',
    '..krrkkrrkkrrk..',
    '.kRrrrrrrrrrrRk.',
    '.krrryrrrryrrrk.',
    '.krrkkkkkkkkrrk.',
    '.krkwkwkwkwkkrk.',
    '..krkoooooookk..',
    '..kRkkkkkkkkRk..',
    '.kRRrrRrrRrrRRk.',
    'kRRrrrRrrRrrrRRk',
    'kRRk..kRRk..kRRk',
    'kk.....kk.....kk'],
  orb: [
    '.....kkkkkk.....',
    '...kkppppppkk...',
    '..kppPPPPPPppk..',
    '.kpPPkkkkkkPPpk.',
    '.kpPkwwwwwwkPpk.',
    'kpPkwwwccwwwkPpk',
    'kpPkwwcBBcwwkPpk',
    'kpPkwwcBBcwwkPpk',
    'kpPkwwwccwwwkPpk',
    '.kpPkwwwwwwkPpk.',
    '.kpPPkkkkkkPPpk.',
    '..kppPPPPPPppk..',
    '...kkppppppkk...',
    '..k..kkkkkk..k..',
    '.k...k....k...k.',
    '................'],
  spider: [
    '................', '................',
    '.k....kkkk....k.',
    '..k..kGGGGk..k..',
    'k..kkGGGGGGkk..k',
    '.k.kGrGGGGrGk.k.',
    '..kkGGGGGGGGkk..',
    'kkkGGGrrrrGGGkkk',
    '...kGGGGGGGGk...',
    '..kkGGGkkGGGkk..',
    '.k.kkGGGGGGkk.k.',
    'k..k.kkkkkk.k..k',
    '..k..........k..',
    '.k............k.',
    '................', '................'],
  king: [
    '...y..y..y..y...',
    '...yy.yyyy.yy...',
    '...yyyyyyyyyy...',
    '...kkkkkkkkkk...',
    '...kGGGGGGGGk...',
    '...kGrrGGrrGk...',
    '...kGGGGGGGGk...',
    '..kPkGkkkkGkPk..',
    '.kPPPkGGGGkPPPk.',
    'kPPpPPkkkkPPpPPk',
    'kPpPPPPyyPPPPpPk',
    'kPpPPPPPPPPPPpPk',
    'kPPpPPPPPPPPpPPk',
    '.kPPPPPPPPPPPPk.',
    '..kPPPPkkPPPPk..',
    '...kkkk..kkkk...'],
  tree: [
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
    '......Nnnk......',
    '......NnNk......',
    '.....kNnnNk.....',
    '....kkkkkkkk....'],
  pine: [
    '.......kk.......',
    '......kelk......',
    '.....keelek.....',
    '....keeeeelk....',
    '.....kEeeek.....',
    '....keeeleek....',
    '...keeeeeelek...',
    '..kEEeeeeeeeEk..',
    '....kEeeeEEk....',
    '...keeeeeeleek..',
    '..keeeeeeeeeeek.',
    '.kEEEeeeeeeEEEEk',
    '..kkkkEEEEkkkk..',
    '......kNnk......',
    '......kNnk......',
    '.....kkkkkk.....'],
  boulder: [
    '................', '................', '................', '................',
    '.....kkkkkk.....',
    '...kkngnnnnkk...',
    '..kngggnnnnnNk..',
    '..knggnnnnnnNk..',
    '.knnnnnnnnnNNNk.',
    '.knnnnnnnnNNNNk.',
    '.kNnnnnnNNNNNNk.',
    '.kNNnnNNNNNNNNk.',
    '..kNNNNNNNNNNk..',
    '...kkkkkkkkkk...',
    '................', '................'],
  bush: [
    '................', '................', '................', '................', '................',
    '.....kkkkkk.....',
    '...kkleelleekk..',
    '..kleeeeeeeleek.',
    '.kleeEeeleeeeEk.',
    '.keeeeeeeeEeeEk.',
    '.keEeeeEeeeeEEk.',
    '.kEEeeEEEeEEEEk.',
    '..kEEEEEEEEEEk..',
    '...kkkkkkkkkk...',
    '................', '................'],
  cactus: [
    '................',
    '.......kk.......',
    '......kelk......',
    '......kelk......',
    '..kk..kelk......',
    '.kelk.kelk..kk..',
    '.kelk.kelk.kelk.',
    '.keelkkelk.kelk.',
    '..keeeeelkkeelk.',
    '...kkkkeleeeek..',
    '......keleekk...',
    '......kelk......',
    '......kelk......',
    '......kelk......',
    '....kkkkkkkk....',
    '................'],
  grave: [
    '................', '................', '................',
    '.....kkkkkk.....',
    '....kgggggGk....',
    '...kggggggGGk...',
    '...kgggGgggGk...',
    '...kggGGGggGk...',
    '...kgggGgggGk...',
    '...kgggGgggGk...',
    '...kggggggGGk...',
    '...kggggggGGk...',
    '...kGGGGGGGGk...',
    '..kNNNNNNNNNNk..',
    '..kkkkkkkkkkkk..',
    '................'],
  statue: [
    '.....kk..kk.....',
    '....kgk..kgk....',
    '....kggkkggk....',
    '....kgrggrgk....',
    '.kk.kggggggk.kk.',
    'kggkkgGkkGgkkggk',
    'kgGgggggggggggGk',
    '.kGggggggggggGk.',
    '..kkgggGGgggkk..',
    '....kgggggGk....',
    '....kggkkgGk....',
    '...kggk..kgGk...',
    '..kGGGGGGGGGGk..',
    '..kggggggggggk..',
    '..kGGGGGGGGGGk..',
    '..kkkkkkkkkkkk..'],
  flame: [
    '................', '................', '................',
    '.......y........',
    '......yy........',
    '......yoy.......',
    '.....yoyy.y.....',
    '....yyooyyy.....',
    '....yooxooy.....',
    '...yooxxxooy....',
    '...yoxxxxxoy....',
    '...yoxxRxxoy....',
    '....yoxxxoy.....',
    '.....yoooy......',
    '......yyy.......',
    '................'],
  oldman: [
    '................',
    '......kkkk......',
    '.....kwwwwk.....',
    '....kwwwwwwk....',
    '....kskssksk....',
    '....kssssssk....',
    '...kwwwwwwwwk...',
    '...kwwwwwwwwk...',
    '..kRwwwwwwwwRk..',
    '..kRRwwwwwwRRk..',
    '..kRRRRRRRRRRk..',
    '..kRRRRRRRRRRk..',
    '..ksRRRRRRRRsk..',
    '...kRRRRRRRRk...',
    '...kkkkkkkkkk...',
    '................'],
  merchant: [
    '................',
    '.....kkkkkk.....',
    '....kbbbbbbk....',
    '...kbbbbbbbbk...',
    '...kkkkkkkkkk...',
    '....kskssksk....',
    '....kssSSssk....',
    '.....kNNNNk.....',
    '...kkeeeeeekk...',
    '..keeeeyyeeeek..',
    '..keseeeeeesek..',
    '..kkseeeeeeskk..',
    '....keeeeeek....',
    '....keeeeeek....',
    '....kkkkkkkk....',
    '................'],
  master: [
    '................',
    '......kkkk......',
    '.....kssssk.....',
    '....ksskkssk....',
    '....kssssssk....',
    '...kwwssssswk...',
    '...kwwwwwwwwk...',
    '..kowwwwwwwwok..',
    '..koowwwwwwook..',
    '.kooookkkkoooko.',
    '.ksoooooooooosk.',
    '..kooooooooook.n',
    '..kooooooooookn.',
    '...kooooooookn..',
    '...kkkkkkkkkkn..',
    '................'],
  heart: [
    '................', '................', '................', '................',
    '....kk...kk.....',
    '...krrk.krrk....',
    '..krwrrkrrrrk...',
    '..krrrrrrrrrk...',
    '..krrrrrrrrRk...',
    '...krrrrrrRk....',
    '....krrrrRk.....',
    '.....krrRk......',
    '......kRk.......',
    '.......k........',
    '................', '................'],
  hcont: [
    '................', '................',
    '...kk.....kk....',
    '..krrk...krrk...',
    '.krwwrk.krrrrk..',
    '.krwrrrkrrrrrk..',
    '.krrrrrrrrrrrk..',
    '.krrrrrrrrrrRk..',
    '.kyrrrrrrrrRyk..',
    '..kyrrrrrrRyk...',
    '...kyrrrrRyk....',
    '....kyrrRyk.....',
    '.....kyRyk......',
    '......kyk.......',
    '.......k........',
    '................'],
  gem: [
    '................', '................', '................', '................',
    '.......k........',
    '......kTk.......',
    '.....khTTk......',
    '....khTTTtk.....',
    '....khTTTtk.....',
    '....khTTTtk.....',
    '....khTTTtk.....',
    '.....kTTtk......',
    '......kTk.......',
    '.......k........',
    '................', '................'],
  key: [
    '................', '................', '................', '................',
    '.....kkk........',
    '....kyyyk.......',
    '....ky.yk.......',
    '....kyyyk.......',
    '.....kyk........',
    '.....kyk........',
    '.....kyykk......',
    '.....kyyyk......',
    '.....kyk........',
    '.....kyykk......',
    '......kkk.......',
    '................'],
  bomb: [
    '................', '................', '................', '................',
    '..........y.....',
    '.........ko.....',
    '........kn......',
    '.....kkkBkk.....',
    '....kBBBBBBk....',
    '...kBwBBBBBBk...',
    '...kBwBBBBBBk...',
    '...kBBBBBBBBk...',
    '...kBBBBBBBBk...',
    '....kBBBBBBk....',
    '.....kkkkkk.....',
    '................'],
  boomerang: [
    '................', '................', '................', '................',
    '...kkk..........',
    '..knnnk.........',
    '..knNnnk........',
    '...kknnnk.......',
    '.....knnnk......',
    '......knnnk.....',
    '......knnnk.....',
    '.....knnnk......',
    '....knNnk.......',
    '....knnk........',
    '.....kk.........',
    '................'],
  bow: [
    '................', '................',
    '.....kkk........',
    '....knnnk.......',
    '....kn.kwk......',
    '...kn...kw......',
    '...kn....w......',
    '...kn....w......',
    '...kn....w......',
    '...kn....w......',
    '...kn...kw......',
    '....kn.kwk......',
    '....knnnk.......',
    '.....kkk........',
    '................', '................'],
  candle: [
    '................', '................', '................',
    '.......y........',
    '......yoy.......',
    '......yxy.......',
    '.......k........',
    '......kbk.......',
    '......kbk.......',
    '......kbk.......',
    '......kbk.......',
    '......kbk.......',
    '....kkkkkkk.....',
    '....kGGGGGk.....',
    '.....kkkkk......',
    '................'],
  potion: [
    '................', '................', '................',
    '......kkk.......',
    '......knk.......',
    '......kwk.......',
    '.....kwwwk......',
    '....kwmmmwk.....',
    '...kwmmmmmmk....',
    '...kwmwmmmmk....',
    '...kmmmmmmmk....',
    '...kmmmmmmPk....',
    '....kmmmmPk.....',
    '.....kkkkk......',
    '................', '................'],
  shard: [
    '................', '................',
    '.......k........',
    '......kyk.......',
    '.....kyyok......',
    '.....kwyok......',
    '....kwyyook.....',
    '....kyyyoxk.....',
    '...kwyyooxxk....',
    '....kyyooxk.....',
    '....kyoooxk.....',
    '.....kyoxk......',
    '.....kooxk......',
    '......kxk.......',
    '.......k........',
    '................'],
  map: [
    '................', '................', '................', '................',
    '...kkkkkkkkk....',
    '..kzzzzzzzzzk...',
    '..kzZzzRzzzZk...',
    '..kzzzzzRzzzk...',
    '..kzZZzzzRzzk...',
    '..kzzzZzzzzZk...',
    '..kzzzzzZZzzk...',
    '..kzZzzzzzzzk...',
    '...kkkkkkkkk....',
    '................', '................', '................'],
  compass: [
    '................', '................', '................', '................',
    '......kkkk......',
    '....kkuuuukk....',
    '...kuwwrwwwuk...',
    '...kuwwrwwwuk...',
    '...kuwwkwwwuk...',
    '...kuwwbwwwuk...',
    '...kuwwbwwwuk...',
    '....kkuuuukk....',
    '......kkkk......',
    '................', '................', '................'],
  sword: [
    '................',
    '.......k........',
    '......kvk.......',
    '......kvk.......',
    '......kvk.......',
    '......kvk.......',
    '......kvk.......',
    '......kvk.......',
    '......kvk.......',
    '....kkkkkkk.....',
    '....kyyyyyk.....',
    '.....kknkk......',
    '.......n........',
    '......kyk.......',
    '.......k........',
    '................'],
  armor: [
    '................', '................', '................',
    '...kkk....kkk...',
    '..kuuukkkkuuuk..',
    '..kuwuuuuuuuUk..',
    '..kuwuuuuuuuUk..',
    '...kwuuyyuuUk...',
    '....kuuuuuuUk...',
    '....kuuuuuuUk...',
    '....kuwuuuuUk...',
    '....kuuuuuuUk...',
    '.....kkkkkkk....',
    '................', '................', '................'],
  rod: [
    '................', '................',
    '.......kkk......',
    '......kcbck.....',
    '......kbcbk.....',
    '.......kkk......',
    '........kn......',
    '........kn......',
    '.......kn.......',
    '.......kn.......',
    '......kn........',
    '......kn........',
    '.....kn.........',
    '.....kk.........',
    '................', '................'],
  fairy: [
    '................', '................', '................', '................',
    '...cc.....cc....',
    '..cvvc...cvvc...',
    '..cvvvckcvvvc...',
    '...cvvkmkvvc....',
    '....cckmmkcc....',
    '...cvvkmmkvvc...',
    '...cvc.kk.cvc...',
    '....c......c....',
    '................', '................', '................', '................'],
  rock: [
    '................', '................', '................', '................', '................',
    '......kkk.......',
    '.....kngnk......',
    '.....knnNk......',
    '......kkk.......',
    '................', '................', '................', '................', '................', '................', '................'],
  fireball: [
    '................', '................', '................', '................',
    '......yyy.......',
    '.....yooxy......',
    '....yoxxxoy.....',
    '....yxxwxxy.....',
    '....yoxxxoy.....',
    '.....yooxy......',
    '......yyy.......',
    '................', '................', '................', '................', '................'],
  magic: [
    '................', '................', '................', '................',
    '......ccc.......',
    '.....cbbbc......',
    '....cbvvvbc.....',
    '....cbvwvbc.....',
    '....cbvvvbc.....',
    '.....cbbbc......',
    '......ccc.......',
    '................', '................', '................', '................', '................'],
  beam: [
    '................', '................', '................',
    '.......c........',
    '.......v........',
    '......cvc.......',
    '...c.cvwvc.c....',
    '..cvvvvwvvvvc...',
    '...c.cvwvc.c....',
    '......cvc.......',
    '.......v........',
    '.......c........',
    '................', '................', '................', '................'],
  ki: [
    '................', '................', '................',
    '.....cccc.......',
    '...ccvvvvcc.....',
    '..cvvwwwwvvc....',
    '..cvwwwwwwvc....',
    '.cvvwwwwwwvvc...',
    '.cvvwwwwwwvvc...',
    '..cvwwwwwwvc....',
    '..cvvwwwwvvc....',
    '...ccvvvvcc.....',
    '.....cccc.......',
    '................', '................', '................'],
  disc: [
    '................', '................', '................', '................', '................',
    '....cccccccc....',
    '..ccvvvvvvvvcc..',
    '.cvvwwwwwwwwvvc.',
    '..ccvvvvvvvvcc..',
    '....cccccccc....',
    '................', '................', '................', '................', '................', '................'],
  arrow: [
    '................', '................', '................', '................', '................', '................',
    '.......u........',
    '......uuu.......',
    '.......n........',
    '.......n........',
    '.......n........',
    '......wnw.......',
    '......w.w.......',
    '................', '................', '................'],
  boom: [
    '....y.....y.....',
    '.y...y...y...y..',
    '..y..yoooy..y...',
    '...yooxxxooy....',
    '..yoxxwwwxxoy...',
    'yyoxxwwwwwxxoyy.',
    '..oxwwwwwwwxo...',
    '.yoxwwwwwwwxoy..',
    '..oxxwwwwwxxo...',
    '..yoxxwwwxxoy...',
    '...yooxxxooy....',
    '..y..yoooy..y...',
    '.y...y...y...y..',
    '....y.....y.....',
    '................', '................'],
  puff: [
    '................', '................', '................', '................',
    '.....ww..ww.....',
    '....wggwwggw....',
    '...wggggggggw...',
    '..wgggwggggggw..',
    '..wggggggwgggw..',
    '...wgggggggw....',
    '....wwggggw.....',
    '......wwww......',
    '................', '................', '................', '................'],
  sign: [
    '................', '................', '................',
    '..kkkkkkkkkkkk..',
    '..knnnnnnnnnnk..',
    '..knNNNnNNnnnk..',
    '..knnnnnnnnnnk..',
    '..knNNnNNNNnnk..',
    '..knnnnnnnnnnk..',
    '..kkkkknnkkkkk..',
    '......knnk......',
    '......knnk......',
    '......knnk......',
    '......knnk......',
    '.....kkkkkk.....',
    '................'],
  pedestal: [
    '................', '................', '................', '................', '................', '................',
    '................', '................', '................', '................',
    '..kkkkkkkkkkkk..',
    '..kggggggggggk..',
    '...kGGGGGGGGk...',
    '...kggggggggk...',
    '..kGGGGGGGGGGk..',
    '..kkkkkkkkkkkk..'],
};

// build sprite pixel arrays; returns {w,h,px:Uint32Array}
const SPR = {};
function buildSprite(src, palOverride) {
  const h = src.length, w = 16; const px = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = src[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x] || '.';
      if (ch === '.') { px[y * w + x] = 0; continue; }
      const col = (palOverride && palOverride[ch]) || PAL[ch];
      if (!col) { px[y * w + x] = 0; continue; }
      const c = Array.isArray(col) ? col : hexToRgb(col);
      px[y * w + x] = c32(c);
    }
  }
  return { w, h, px };
}
function initSprites() {
  for (const k in SPR_SRC) SPR[k] = buildSprite(SPR_SRC[k]);
  // gem colors
  SPR.gem_g = buildSprite(SPR_SRC.gem, { T: '#40d040', t: '#187018', h: '#b8f8a8' });
  SPR.gem_b = buildSprite(SPR_SRC.gem, { T: '#4080f0', t: '#183890', h: '#b8d8ff' });
  SPR.gem_r = buildSprite(SPR_SRC.gem, { T: '#f04040', t: '#901818', h: '#ffc0c0' });
  SPR.gem = SPR.gem_g;
  // mirrored sides
  for (const k of ['hero_side', 'monk_side']) {
    const s = SPR[k]; const m = new Uint32Array(s.px.length);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) m[y * s.w + x] = s.px[y * s.w + (s.w - 1 - x)];
    SPR[k + '_l'] = { w: s.w, h: s.h, px: m };
  }
}

// Player colors
const PCOLORS = [
  { name: 'GREEN', c: '#38b038' }, { name: 'RED', c: '#e03030' }, { name: 'BLUE', c: '#3868e8' }, { name: 'PURPLE', c: '#a040d8' },
  { name: 'GOLD', c: '#e0b020' }, { name: 'TEAL', c: '#20b8b0' }, { name: 'PINK', c: '#f060a8' }, { name: 'WHITE', c: '#e8e8f0' },
];
const STEEL = [200, 208, 224], STEEL_D = [110, 118, 145], STEEL_H = [250, 252, 255];
// tunic palette for color + armor tier (0 cloth, 1 chain, 2 plate). monk: aura tiers.
function tunicPal(hex, tier) {
  const base = hexToRgb(hex);
  if (tier === 0) return { T: base, t: shade(base, 0.6), h: mix(base, [255, 255, 255], 0.4) };
  if (tier === 1) { const m = mix(base, STEEL, 0.45); return { T: m, t: mix(shade(base, 0.55), STEEL_D, 0.5), h: mix(STEEL_H, base, 0.2) }; }
  const m = mix(STEEL, base, 0.22); return { T: m, t: mix(base, [20, 20, 30], 0.35), h: STEEL_H };
}
const _heroCache = {};
function heroSprite(cls, hex, tier, dir) { // dir: front/back/side/side_l
  const key = cls + hex + tier + dir;
  if (_heroCache[key]) return _heroCache[key];
  const base = (cls === 'monk' ? 'monk_' : 'hero_') + (dir === 'side_l' ? 'side' : dir);
  let s = buildSprite(SPR_SRC[base], tunicPal(hex, cls === 'monk' ? 0 : tier));
  if (dir === 'side_l') { const m = new Uint32Array(s.px.length); for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) m[y * s.w + x] = s.px[y * s.w + (s.w - 1 - x)]; s = { w: s.w, h: s.h, px: m }; }
  // plate armor: add specular sparkle dither on tunic pixels
  if (cls !== 'monk' && tier >= 1) {
    const pal = tunicPal(hex, tier); const tc = c32(pal.T), hc = c32(pal.h);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const i = y * s.w + x;
      if (s.px[i] === tc) {
        if (tier === 1 && ((x + y) & 1) === 0 && y % 2 === 0) s.px[i] = hc; // chain rings
        if (tier === 2 && (x + y * 3) % 7 === 0) s.px[i] = hc; // plate glints
      }
    }
  }
  _heroCache[key] = s; return s;
}

// ===== run cycle (A -> B -> C -> B), drawn as limb overlays on the idle sprite =====
// A: one arm thrown up, other tucked.  B: squished, both arms tucked.  C: arms flung wide, one leg kicked way out.
// A=arm, H=hand, L=leg, F=foot. Coordinates are (x, y) in the 16x16 sprite.
const RUN_FRONT = [
  [[4, 8, 'A'], [3, 9, 'A'], [3, 10, 'H'], [11, 8, 'A'], [12, 7, 'A'], [12, 6, 'A'], [12, 5, 'H'], [5, 13, 'L'], [6, 13, 'L'], [5, 14, 'F'], [6, 14, 'F'], [9, 13, 'L'], [10, 13, 'L'], [9, 14, 'F'], [10, 14, 'F']],
  [[4, 8, 'A'], [3, 9, 'A'], [4, 10, 'H'], [11, 8, 'A'], [12, 9, 'A'], [11, 10, 'H'], [6, 13, 'L'], [7, 13, 'L'], [6, 14, 'F'], [7, 14, 'F'], [8, 13, 'L'], [9, 13, 'L'], [8, 14, 'F'], [9, 14, 'F']],
  [[4, 8, 'A'], [3, 8, 'A'], [2, 8, 'A'], [1, 8, 'A'], [1, 7, 'A'], [1, 6, 'H'], [11, 8, 'A'], [12, 8, 'A'], [13, 8, 'A'], [14, 8, 'A'], [15, 9, 'H'], [5, 13, 'L'], [6, 13, 'L'], [5, 14, 'F'], [6, 14, 'F'], [9, 13, 'L'], [10, 13, 'L'], [11, 14, 'L'], [12, 14, 'L'], [13, 15, 'F'], [14, 15, 'F']],
];
const RUN_SIDE = [
  [[11, 8, 'A'], [12, 7, 'A'], [13, 6, 'H'], [6, 13, 'L'], [6, 14, 'F'], [5, 14, 'F'], [8, 13, 'L'], [9, 14, 'F'], [10, 14, 'F']],
  [[11, 9, 'A'], [11, 10, 'H'], [7, 13, 'L'], [8, 13, 'L'], [7, 14, 'F'], [8, 14, 'F'], [9, 14, 'F']],
  [[11, 8, 'A'], [12, 8, 'A'], [13, 8, 'A'], [14, 7, 'H'], [9, 13, 'L'], [10, 13, 'L'], [11, 14, 'L'], [12, 14, 'F'], [13, 14, 'F'], [5, 13, 'L'], [4, 14, 'L'], [3, 14, 'F'], [2, 14, 'F']],
];
const RUN_SEQ = [0, 1, 2, 1];
const RUN_SCALE = [1.0, 0.9, 1.1, 0.9]; // squash in the middle, stretch on the big kick
function runRows(src, cls, dir, frame) {
  const rows = src.map(r => r.split(''));
  const side = dir === 'side';
  for (let y = 7; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (y >= 13) rows[y][x] = '.';
    else if (side ? (x >= 11 && y <= 12) : (y <= 11 && (x <= 4 || x >= 11))) rows[y][x] = '.';
  }
  const map = cls === 'monk' ? { A: 's', H: 'w', L: 'N', F: 'k' } : { A: 's', H: 'S', L: 's', F: 'N' };
  for (const [x, y, k] of (side ? RUN_SIDE : RUN_FRONT)[frame]) rows[y][x] = map[k];
  return rows.map(r => r.join(''));
}
// frame: -1 idle, otherwise 0..2 (A,B,C)
function heroSpriteRun(cls, hex, tier, dir, frame, flip) {
  if (frame < 0) return heroSprite(cls, hex, tier, dir);
  const key = 'run' + cls + hex + tier + dir + frame + (flip ? 'f' : '');
  if (_heroCache[key]) return _heroCache[key];
  const baseDir = dir === 'side_l' ? 'side' : dir;
  const src = runRows(SPR_SRC[(cls === 'monk' ? 'monk_' : 'hero_') + baseDir], cls, baseDir === 'side' ? 'side' : 'front', frame);
  const pal = tunicPal(hex, cls === 'monk' ? 0 : tier);
  let s = buildSprite(src, pal);
  if (cls !== 'monk' && tier >= 1) { const tc = c32(pal.T), hc = c32(pal.h); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = y * 16 + x; if (s.px[i] === tc && ((tier === 1 && ((x + y) & 1) === 0 && y % 2 === 0) || (tier === 2 && (x + y * 3) % 7 === 0))) s.px[i] = hc; } }
  if (dir === 'side_l' || flip) s = mirrorSpr(s);
  _heroCache[key] = s; return s;
}
function mirrorSpr(s) { const m = new Uint32Array(s.px.length); for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) m[y * s.w + x] = s.px[y * s.w + (s.w - 1 - x)]; return { w: s.w, h: s.h, px: m }; }

// ===== enemy animation frames, made by small transforms of the base sprite =====
function sprCopy(s) { return { w: s.w, h: s.h, px: new Uint32Array(s.px) }; }
function sprGet(s, x, y) { return x < 0 || y < 0 || x >= s.w || y >= s.h ? 0 : s.px[y * s.w + x]; }
// resample vertically around the bottom row (f<1 squash, f>1 stretch), widen/narrow to keep volume
function sprSquash(s, f) {
  const o = { w: s.w, h: s.h, px: new Uint32Array(s.px.length) }; const fx = 1 / Math.sqrt(f); const cx = (s.w - 1) / 2;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const sy = Math.round(s.h - 1 - (s.h - 1 - y) / f), sx = Math.round(cx + (x - cx) / fx); o.px[y * s.w + x] = sprGet(s, sx, sy); }
  return o;
}
// shift a band of rows sideways (legs shuffle, ghost tail wave)
function sprShearRows(s, y0, y1, dx) { const o = sprCopy(s); for (let y = y0; y <= y1; y++) for (let x = 0; x < s.w; x++) o.px[y * s.w + x] = sprGet(s, x - dx, y); return o; }
// split legs: left half of a band moves dl rows, right half dr rows
function sprStep(s, y0, dl, dr) { const o = sprCopy(s); for (let y = y0; y < s.h; y++) for (let x = 0; x < s.w; x++) o.px[y * s.w + x] = 0; for (let y = y0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const d = x < s.w / 2 ? dl : dr; const ty = y + d; if (ty >= y0 - 1 && ty < s.h) { const c = sprGet(s, x, y); if (c) o.px[ty * s.w + x] = c; } } return o; }
function sprShiftCols(s, x0, x1, dy) { const o = sprCopy(s); for (let x = x0; x <= x1; x++) { for (let y = 0; y < s.h; y++) o.px[y * s.w + x] = 0; for (let y = 0; y < s.h; y++) { const c = sprGet(s, x, y); const ty = y + dy; if (c && ty >= 0 && ty < s.h) o.px[ty * s.w + x] = c; } } return o; }
function sprBob(s, dy) { return sprShiftCols(s, 0, s.w - 1, dy); }
const SPR_ANIM = {};
function initAnims() {
  const A = (k, frames, fps) => { SPR_ANIM[k] = { f: frames, fps }; };
  A('slime', [SPR.slime, sprSquash(SPR.slime, 0.8), SPR.slime, sprSquash(SPR.slime, 1.15)], 6);
  A('spitter', [SPR.spitter, sprShearRows(SPR.spitter, 11, 13, 1), SPR.spitter, sprShearRows(SPR.spitter, 11, 13, -1)], 6);
  A('thornling', [SPR.thornling, sprStep(SPR.thornling, 13, -1, 0), SPR.thornling, sprStep(SPR.thornling, 13, 0, -1)], 6);
  A('bat', [SPR.bat, sprShiftCols(sprShiftCols(SPR.bat, 0, 4, -3), 11, 15, -3), sprShiftCols(sprShiftCols(SPR.bat, 0, 4, 2), 11, 15, 2)], 10);
  A('skeleton', [SPR.skeleton, sprStep(SPR.skeleton, 12, -1, 0), SPR.skeleton, sprStep(SPR.skeleton, 12, 0, -1)], 5);
  A('knight', [SPR.knight, sprStep(SPR.knight, 12, -1, 0), SPR.knight, sprStep(SPR.knight, 12, 0, -1)], 4);
  A('ghost', [SPR.ghost, sprShearRows(SPR.ghost, 10, 14, 1), SPR.ghost, sprShearRows(SPR.ghost, 10, 14, -1)], 4);
  A('wizard', [SPR.wizard, sprShiftCols(SPR.wizard, 13, 15, -1), sprShiftCols(SPR.wizard, 13, 15, -2)], 3);
  A('spider', [SPR.spider, sprShearRows(sprShearRows(SPR.spider, 2, 5, 1), 10, 13, -1), sprShearRows(sprShearRows(SPR.spider, 2, 5, -1), 10, 13, 1)], 9);
  A('wyrm', [SPR.wyrm, sprBob(SPR.wyrm, 1), sprStep(SPR.wyrm, 12, -1, 0)], 3);
  A('orb', [SPR.orb, sprSquash(SPR.orb, 0.92), SPR.orb, sprSquash(SPR.orb, 1.06)], 5);
  A('king', [SPR.king, sprBob(SPR.king, 1)], 2);
  A('fairy', [SPR.fairy, sprShiftCols(sprShiftCols(SPR.fairy, 0, 5, -2), 10, 15, -2)], 12);
  A('flame', [SPR.flame, sprShearRows(SPR.flame, 2, 8, 1), sprSquash(SPR.flame, 1.1)], 8);
}
