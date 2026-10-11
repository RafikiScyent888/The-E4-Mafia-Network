/* Small helpers the network engine shares: a seeded random source (so a
   ticket's network is the same every time it is opened, and in the tests),
   IPv4 arithmetic, and made-up hardware addresses. */

/* mulberry32: a tiny seeded generator, good enough for variety, never for secrets */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  const next = function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); };
  next.pick = function (arr) { return arr[Math.floor(next() * arr.length)]; };
  next.shuffle = function (arr) { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
  return next;
}

/* a stable number from any text (for per-device, per-command variety) */
export function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

export function ip2n(ip) {
  const p = String(ip).trim().split(".");
  if (p.length !== 4) return null;
  let n = 0;
  for (const s of p) { if (!/^\d{1,3}$/.test(s)) return null; const v = +s; if (v > 255) return null; n = n * 256 + v; }
  return n >>> 0;
}
export function n2ip(n) { return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."); }
export function isIp(s) { return ip2n(s) !== null; }
export function maskBits(mask) { const n = ip2n(mask); if (n === null) return null; let b = 0, seen0 = false; for (let i = 31; i >= 0; i--) { if ((n >>> i) & 1) { if (seen0) return null; b++; } else seen0 = true; } return b; }
export function sameSubnet(a, b, mask) { const x = ip2n(a), y = ip2n(b), m = ip2n(mask); if (x === null || y === null || m === null) return false; return ((x & m) >>> 0) === ((y & m) >>> 0); }
export function network(ip, mask) { return n2ip((ip2n(ip) & ip2n(mask)) >>> 0); }
export function broadcast(ip, mask) { return n2ip(((ip2n(ip) & ip2n(mask)) | (~ip2n(mask) >>> 0)) >>> 0); }

/* address families the engine treats differently */
export function isApipa(ip) { const n = ip2n(ip); return n !== null && (n >>> 16) === ((169 << 8) | 254); }
export function isPrivate(ip) {
  const n = ip2n(ip); if (n === null) return false;
  const a = n >>> 24, b = (n >>> 16) & 255;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
export function isLoopback(ip) { const n = ip2n(ip); return n !== null && (n >>> 24) === 127; }
export function isPublic(ip) {
  const n = ip2n(ip); if (n === null) return false;
  const a = n >>> 24;
  return !isPrivate(ip) && !isApipa(ip) && !isLoopback(ip) && a !== 0 && a < 224;
}

/* made-up hardware addresses: the "locally administered" bit is set (02-...), so none belongs to a real maker */
export function mac(r) { const b = [0x02]; for (let i = 0; i < 5; i++) b.push(r.int(0, 255)); return b.map(function (x) { return x.toString(16).padStart(2, "0"); }).join("-"); }

export function pad(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }
export function lpad(s, n) { s = String(s); return s.length >= n ? s : " ".repeat(n - s.length) + s; }
