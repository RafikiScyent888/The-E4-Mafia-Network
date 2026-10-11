/* The IPAM sheet: students plan the office's address blocks by hand and
   write each one down (network, mask, first and last usable, broadcast,
   gateway). The sheet checks what they wrote against the rules and says
   what is wrong, never what the right value is: no built-in calculator
   does the subnetting for them (the owner, 10 October 2026). Pure, tested
   under Node. */

const ip2n = function (s) { const p = String(s || "").trim().split("."); if (p.length !== 4 || p.some(function (x) { return !/^\d{1,3}$/.test(x) || +x > 255; })) return null; return ((+p[0] << 24) >>> 0) + (+p[1] << 16) + (+p[2] << 8) + +p[3]; };
const n2ip = function (n) { return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."); };
/* "/26", "26" or "255.255.255.192" → 26; anything else → null */
export function prefixOf(s) {
  s = String(s || "").trim();
  const m = /^\/?(\d{1,2})$/.exec(s); if (m) return +m[1] <= 32 ? +m[1] : null;
  const n = ip2n(s); if (n == null) return null;
  const b = n.toString(2).padStart(32, "0"); return /^1*0*$/.test(b) ? b.indexOf("0") < 0 ? 32 : b.indexOf("0") : null;
}
const size = function (p) { return Math.pow(2, 32 - p); };
const blockOf = function (n, p) { const sz = size(p); return { net: Math.floor(n / sz) * sz, bc: Math.floor(n / sz) * sz + sz - 1 }; };

/* the office's whole block, e.g. "192.168.40.0/24" */
export function parseBlock(s) { const m = /^(.+)\/(\d+)$/.exec(String(s).trim()); if (!m) return null; const n = ip2n(m[1]), p = +m[2]; return n == null || p > 32 ? null : { net: n, p: p, bc: n + size(p) - 1, text: n2ip(n) + "/" + p }; }

/* check every row: [{ name, hosts, net, mask, first, last, bc, gw }] against the office block.
   Returns, per row, { ok, issues: [{ field, text }], notes: [...] } */
export function checkSheet(block, rows) {
  const B = typeof block === "string" ? parseBlock(block) : block;
  const parsed = rows.map(function (r) { const n = ip2n(r.net), p = prefixOf(r.mask); return { r: r, n: n, p: p, blk: n != null && p != null ? blockOf(n, p) : null }; });
  return parsed.map(function (x, i) {
    const r = x.r, out = { ok: true, issues: [], notes: [] }, bad = function (field, text) { out.ok = false; out.issues.push({ field: field, text: text }); };
    const blank = function (v) { return !String(v || "").trim(); };
    if (["net", "mask", "first", "last", "bc", "gw"].every(function (k) { return blank(r[k]); })) { out.ok = false; out.empty = true; return out; }
    if (x.n == null) { bad("net", "Network: that isn't an IPv4 address."); return out; }
    if (x.p == null) { bad("mask", "Mask: write it as a prefix (/26) or a dotted mask (255.255.255.192)."); return out; }
    const sz = size(x.p), usable = x.p >= 31 ? 0 : sz - 2;
    if (x.blk.net !== x.n) bad("net", "Network: " + r.net.trim() + " isn't where a /" + x.p + " block begins.");
    if (usable < (+r.hosts || 0)) bad("mask", "Mask: a /" + x.p + " has " + usable + " usable addresses; " + (r.name || "this block") + " needs " + r.hosts + ".");
    else if (x.p < 30 && size(x.p + 1) - 2 >= (+r.hosts || 0)) out.notes.push("It fits, but a smaller block would too: VLSM gives each block only the size it needs.");
    if (B && (x.blk.net < B.net || x.blk.bc > B.bc)) bad("net", "Network: this block reaches outside the office's " + B.text + ".");
    parsed.forEach(function (y, j) {
      if (j === i || !y.blk) return;
      if (x.blk.net <= y.blk.bc && y.blk.net <= x.blk.bc) bad("net", "Overlap: this block shares addresses with " + (y.r.name || "row " + (j + 1)) + ".");
    });
    if (usable) {
      const f = ip2n(r.first), l = ip2n(r.last), b = ip2n(r.bc), g = ip2n(r.gw);
      if (blank(r.first) || f !== x.blk.net + 1) bad("first", blank(r.first) ? "First usable: not written yet." : "First usable: not the first address after the network address.");
      if (blank(r.last) || l !== x.blk.bc - 1) bad("last", blank(r.last) ? "Last usable: not written yet." : "Last usable: not the address just before the broadcast.");
      if (blank(r.bc) || b !== x.blk.bc) bad("bc", blank(r.bc) ? "Broadcast: not written yet." : "Broadcast: not the last address of this block.");
      if (blank(r.gw)) bad("gw", "Gateway: not written yet.");
      else if (g == null) bad("gw", "Gateway: that isn't an IPv4 address.");
      else if (g < x.blk.net || g > x.blk.bc) bad("gw", "Gateway: outside this block. A device can only reach a gateway on its own subnet.");
      else if (g === x.blk.net || g === x.blk.bc) bad("gw", "Gateway: that's the " + (g === x.blk.net ? "network" : "broadcast") + " address, which no device can use.");
    }
    return out;
  });
}
