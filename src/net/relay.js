// ===== net/relay.js : relay settings for online co-op (room codes / invite links) =====
// Most players connect directly. Some networks (school or work Wi-Fi, phone hotspots, some home routers) block direct
// connections, so those players need a relay to pass the game traffic through.
//
// To make joining reliable for everyone, set up a free relay (about 2 minutes):
//   1. Sign up at https://www.metered.ca/tools/openrelay/ (free: 20 GB a month, which is roughly 90 hours of relayed play).
//   2. In your Metered dashboard, find your app name (the part before .metered.live) and your TURN API key.
//   3. Paste them below, run `python build.py`, and push.
const RELAY = {
  meteredApp: '',   // e.g. 'emberwake'  (from https://emberwake.metered.live)
  meteredKey: '',   // your TURN credentials API key
};
// Always on: one public address-discovery (STUN) server, plus Metered's old public "Open Relay" with its shared login
// (the same one Dot Slayer uses). It may or may not still work; if it's down it's harmless and direct connections still do.
// (PeerJS's free relay used to be here too, but browsers reported it broken, so it's gone.)
const STUN_ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
];
// Browsers slow down (and Firefox warns) with five or more server addresses, so we keep at most four:
// one STUN plus the three most useful relay routes (UDP, TCP on 443, and TLS on 443, which gets through strict firewalls).
function pickRelayRoutes(servers) {
  const routes = []; for (const s of servers) for (const u of [].concat(s.urls || s.url || [])) routes.push({ u, username: s.username, credential: s.credential });
  const want = [(u) => /^turn:.*:80(\?|$)/.test(u) && !/transport=tcp/.test(u), (u) => /^turn:.*:443\?transport=tcp/.test(u), (u) => /^turns:/.test(u)];
  const out = []; for (const w of want) { const r = routes.find(r => w(r.u) && !out.includes(r)); if (r) out.push(r); }
  for (const r of routes) if (out.length < 3 && /^turns?:/.test(r.u) && !out.includes(r)) out.push(r);
  return out.map(r => ({ urls: r.u, username: r.username, credential: r.credential }));
}
let _iceCache = null;
async function iceServers() {
  if (_iceCache && Date.now() - _iceCache.t < 30 * 60 * 1000) return _iceCache.list;
  let list = STUN_ICE.slice();
  if (RELAY.meteredApp && RELAY.meteredKey) {
    try {
      const r = await fetch('https://' + RELAY.meteredApp + '.metered.live/api/v1/turn/credentials?apiKey=' + encodeURIComponent(RELAY.meteredKey));
      if (r.ok) { const servers = await r.json(); const relays = Array.isArray(servers) ? pickRelayRoutes(servers) : []; if (relays.length) list = [{ urls: 'stun:stun.l.google.com:19302' }].concat(relays); }
    } catch (e) { console.warn('Relay credentials unavailable, using STUN only', e); }
  }
  _iceCache = { t: Date.now(), list }; return list;
}
function relayConfigured() { return !!(RELAY.meteredApp && RELAY.meteredKey); }
// After connecting, look at which route WebRTC picked: 'DIRECT' (same network or peer-to-peer) or 'RELAY'.
async function connectionKind(pc) {
  try {
    const stats = await pc.getStats(); let pair = null; const cands = {};
    stats.forEach(s => { if (s.type === 'transport' && s.selectedCandidatePairId) pair = stats.get(s.selectedCandidatePairId); if (s.type === 'local-candidate' || s.type === 'remote-candidate') cands[s.id] = s; });
    if (!pair) stats.forEach(s => { if (s.type === 'candidate-pair' && (s.selected || s.nominated) && s.state === 'succeeded') pair = pair || s; });
    if (!pair) return '?';
    const l = cands[pair.localCandidateId], r = cands[pair.remoteCandidateId];
    return (l && l.candidateType === 'relay') || (r && r.candidateType === 'relay') ? 'RELAY' : 'DIRECT';
  } catch (e) { return '?'; }
}
