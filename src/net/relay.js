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
// Always-on fallbacks: public address-discovery (STUN) servers, plus PeerJS's own free relay (slow and often full).
const FALLBACK_ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
];
let _iceCache = null;
async function iceServers() {
  if (_iceCache && Date.now() - _iceCache.t < 30 * 60 * 1000) return _iceCache.list;
  let list = FALLBACK_ICE.slice();
  if (RELAY.meteredApp && RELAY.meteredKey) {
    try {
      const r = await fetch('https://' + RELAY.meteredApp + '.metered.live/api/v1/turn/credentials?apiKey=' + encodeURIComponent(RELAY.meteredKey));
      if (r.ok) { const servers = await r.json(); if (Array.isArray(servers) && servers.length) list = servers.concat(FALLBACK_ICE); }
    } catch (e) { console.warn('Relay credentials unavailable, using fallbacks', e); }
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
