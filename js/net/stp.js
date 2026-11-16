/* Spanning tree (Level 4, the campus; the owner, 15 November 2026: the rapid, per-VLAN kind, with the classic port states
   taught beside it). Pure: given the switches and the ports between them for one VLAN, it works out what the real protocol
   settles on, as each switch would show it:
   - each group of switches joined in this VLAN elects its root bridge: the lowest bridge ID (priority, then address);
   - every other switch's root port is its way to the root with the lowest path cost (then the lowest sender bridge ID, then
     the lowest sender port);
   - on each link, the designated port is the end nearer the root (lowest root path cost, then bridge ID, then port);
   - every other port between switches is an alternate: blocking, so the VLAN has one path between any two switches;
   - a port to anything that isn't a switch is designated and forwarding (an edge port with portfast).
   A port-channel is one port. Nothing here knows the simulation or the command line. */

/* the bridge ID as the real thing compares it: priority (with the VLAN added, the "sys-id-ext"), then the address */
export function bridgeId(prio, vlan, mac) { return { prio: prio + vlan, mac: String(mac || "").toLowerCase() }; }
const cmpId = function (a, b) { return a.prio - b.prio || (a.mac < b.mac ? -1 : a.mac > b.mac ? 1 : 0); };
/* the path cost of a link by its speed in Mb/s (the short method); a port-channel counts its bundled members */
export function costOf(mbps, members) {
  if (members && members > 1) return members >= 3 ? 2 : 3;
  return mbps >= 10000 ? 2 : mbps >= 1000 ? 4 : mbps >= 100 ? 19 : 100;
}
/* sws: { id: { mac, prio } } (prio already the VLAN's configured priority, before the VLAN is added);
   ports: [{ sw, lp, num, cost, far: { sw, lp } | null, edge }], each port carrying this VLAN with its link up.
   Returns { bridges: { id: { id, root, cost, rootPort } }, roles: { "sw lp": { role: "Root"|"Desg"|"Altn", sts: "FWD"|"BLK" } } } */
export function solve(sws, ports, vlan) {
  const B = {}; Object.keys(sws).forEach(function (id) { B[id] = { id: id, bid: bridgeId(sws[id].prio, vlan, sws[id].mac) }; });
  const links = ports.filter(function (p) { return p.far && B[p.far.sw] && B[p.sw]; });
  /* groups of switches joined in this VLAN, each with its own root */
  const comp = {}; Object.keys(B).forEach(function (id) { if (comp[id]) return; const q = [id]; comp[id] = id; while (q.length) { const v = q.shift(); links.forEach(function (p) { if (p.sw === v && !comp[p.far.sw]) { comp[p.far.sw] = id; q.push(p.far.sw); } }); } });
  const rootOf = {}; Object.keys(B).forEach(function (id) { const c = comp[id]; if (!rootOf[c] || cmpId(B[id].bid, B[rootOf[c]].bid) < 0) rootOf[c] = id; });
  /* the lowest cost from each switch to its root (each port's cost counts going out of the switch towards the root) */
  const dist = {}; Object.keys(B).forEach(function (id) { dist[id] = Infinity; });
  Object.keys(rootOf).forEach(function (c) { dist[rootOf[c]] = 0; });
  for (let i = 0; i < Object.keys(B).length + 1; i++) links.forEach(function (p) { const d = dist[p.far.sw] + p.cost; if (d < dist[p.sw]) dist[p.sw] = d; });
  const out = { bridges: {}, roles: {} };
  Object.keys(B).forEach(function (id) {
    const root = rootOf[comp[id]];
    let rp = null;
    if (id !== root) links.forEach(function (p) {
      if (p.sw !== id || dist[p.far.sw] + p.cost !== dist[id]) return;
      const better = !rp || cmpId(B[p.far.sw].bid, B[rp.far.sw].bid) < 0 || (cmpId(B[p.far.sw].bid, B[rp.far.sw].bid) === 0 && farNum(ports, p) < farNum(ports, rp));
      if (better) rp = p;
    });
    out.bridges[id] = { id: id, root: root, rootBid: B[root].bid, bid: B[id].bid, cost: dist[id], rootPort: rp ? rp.lp : null };
  });
  ports.forEach(function (p) {
    const key = p.sw + " " + p.lp;
    if (!p.far || !B[p.far.sw]) { out.roles[key] = { role: "Desg", sts: "FWD", edge: !!p.edge }; return; }   /* to a computer, a router, an access point */
    if (out.bridges[p.sw].rootPort === p.lp) { out.roles[key] = { role: "Root", sts: "FWD" }; return; }
    /* designated: this end is nearer the root than the far end (cost, then bridge ID, then port number) */
    const me = [dist[p.sw], B[p.sw].bid, p.num], them = [dist[p.far.sw], B[p.far.sw].bid, farNum(ports, p)];
    const mine = me[0] < them[0] || (me[0] === them[0] && (cmpId(me[1], them[1]) < 0 || (cmpId(me[1], them[1]) === 0 && me[2] < them[2])));
    out.roles[key] = mine ? { role: "Desg", sts: "FWD" } : { role: "Altn", sts: "BLK" };
  });
  return out;
}
const farNum = function (ports, p) { const f = ports.find(function (q) { return q.sw === p.far.sw && q.lp === p.far.lp; }); return f ? f.num : 0; };
