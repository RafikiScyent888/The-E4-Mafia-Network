/* =====================================================================
   Cables and connectors, from the owner's photographs, with the details
   set by the standards rather than by the photos' pixels:
     - RJ45 (8P8C) wire order exactly as TIA-568 T568B and T568A; four
       twisted pairs, each at its own lay length; untwisted only for the
       last few millimetres into the plug, as the standard allows
     - RJ11 is a 6-position plug: 2 wires for one line, 4 for two, on
       flat (untwisted) satin cable
     - a male F-type's nut is threaded INSIDE; the centre conductor
       stands about 3 mm proud of it
   A plug points +Z (its contacts at the +Z end); its cable runs off -Z.
   ===================================================================== */
import * as THREE from "three";
import { COL, mat, rbox, box, cyl, at, named } from "./parts.js";
import { tubeVar, jacketMaterial, wireTube, wireMat, copperEnd, helix, frames } from "./cable-kit.js";

/* TIA-568: pin 1 to pin 8 */
export const T568B = ["white/orange", "orange", "white/green", "blue", "white/blue", "green", "white/brown", "brown"];
export const T568A = ["white/green", "green", "white/orange", "blue", "white/blue", "orange", "white/brown", "brown"];
const PAIR_OF = { orange: 0, green: 1, blue: 2, brown: 3 };
/* where each pair sits as it leaves the jacket, and its lay length (mm):
   real Cat6 gives every pair a different twist rate to cut crosstalk */
const PAIRS = [{ c: [1.15, 0.55], lay: 12.7 }, { c: [0.15, -1.15], lay: 14.6 }, { c: [0.15, 1.15], lay: 16.5 }, { c: [-1.15, 0.45], lay: 18.4 }];

function clearPlastic() {
  return new THREE.MeshPhysicalMaterial({ color: 0xeaf3f7, roughness: 0.07, metalness: 0, transparent: true, opacity: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, depthWrite: false });
}
const V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
const CAT6 = "CAT6 UTP  ·  23AWG 4PR  ·  550MHz  ·  TIA-568.2  ·  VERIFIED  ·  1000FT";

/* a straight-ish jacket from z0 back to z1 (z1 < z0), drooping a little */
function jacketRun(z0, z1, r, color, text, o = {}) {
  /* o.run: where the cable goes after the plug, as [x, y, dz] steps back from the jacket's end (a patch cable drooping to the floor) */
  const pts = o.run ? [V(0, 0, z0)].concat(o.run.map(function (q) { return V(q[0], q[1], z0 - q[2]); })) : [V(0, 0, z0), V(0, 0, (z0 + z1) / 2), V(0, -(o.droop || 1.5), z1)];
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = tubeVar(curve, { n: o.run ? 200 : 80, m: 32, radius: function () { return o.flat ? [r * 1.95, r] : [r, r]; }, uvLength: 120, color: 0xffffff, up: V(0, 1, 0) });
  return new THREE.Mesh(g, jacketMaterial(color, text, o.ink, { side: THREE.DoubleSide }));
}

/* ---- RJ45 plug ----
   o.standard 'T568B' | 'T568A'; o.termination 'good' | 'bad'; o.jacket colour;
   o.run: the cable's path on from the plug (see jacketRun) */
export function rj45Plug(o = {}) {
  const g = new THREE.Group(), order = o.standard === "T568A" ? T568A : T568B, bad = o.termination === "bad";
  const L = 21.5, W = 11.7, H = 8, zF = L / 2, zR = -L / 2, jc = o.jacket || 0x2c55b8;
  const cp = clearPlastic();
  /* the body, the nine ribs between the contacts, the latch with its tab */
  g.add(rbox(W, H, L, 0.7, cp));
  for (let k = 0; k <= 8; k++) g.add(at(box(0.36, 1.0, 4.8, cp), (k - 4) * 1.02, H / 2 + 0.2, zF - 2.6));
  const latch = new THREE.Group();
  latch.add(at(box(6.4, 0.9, 13.5, cp), 0, 0, -6.75));
  latch.add(at(box(7.4, 0.9, 3.2, cp), 0, -0.55, -13.4, -0.35, 0, 0));
  for (let k = 0; k < 3; k++) latch.add(at(box(7.2, 0.35, 0.4, cp), 0, -0.4 - k * 0.2, -12.4 - k * 0.9, -0.35, 0, 0));
  latch.position.set(0, -H / 2 - 0.4, zF - 3); latch.rotation.x = 0.16; g.add(latch);
  /* the eight gold blades, each with its crown of teeth into a wire */
  const gm = mat(COL.gold, { metal: 1, rough: 0.2 });
  const pinX = function (i) { return (3.5 - i) * 1.02; };   // pin 1 on the left, plug pointing away, clip underneath
  for (let i = 0; i < 8; i++) {
    g.add(at(box(0.3, 2.6, 3.6, gm), pinX(i), H / 2 - 1.15, zF - 2.4));
    g.add(at(box(0.3, 0.7, 0.6, gm), pinX(i), 1.8, zF - 3.6)); g.add(at(box(0.3, 0.7, 0.6, gm), pinX(i), 1.8, zF - 1.9));
  }
  /* where the jacket stops: about 7 mm inside the plug when done right */
  const zJ = bad ? zR - 17 : zR + 7, yW = 1.15, zFlat = bad ? zR + 2 : zJ + 4.2;
  const twistTo = bad ? zJ + 2 : zJ + 1.4;            // the pairs stay twisted to here
  /* the wires: each pin's wire, from inside the jacket, twisting with its pair, then flat to the front */
  order.forEach(function (name, i) {
    const colour = name.replace("white/", ""), p = PAIRS[PAIR_OF[colour]], white = name.indexOf("white/") === 0;
    const pts = [];
    const pathC = function () { return V(p.c[0], p.c[1], 0); };
    for (let z = zJ - 3; z <= twistTo; z += 0.45) {
      const th = (z - zJ) / p.lay * Math.PI * 2 + (white ? 0 : Math.PI);
      pts.push(V(p.c[0] + Math.cos(th) * 0.5, p.c[1] + Math.sin(th) * 0.5, z));
    }
    void pathC;
    const last = pts[pts.length - 1];
    if (bad) {
      /* untwisted far too far, splayed loose on the way to the plug */
      const sx = pinX(i) * 1.6 + Math.sin(i * 2.3) * 2.2, sy = Math.cos(i * 1.9) * 2.4 - 0.4;
      pts.push(V((last.x + sx) / 2, (last.y + sy) / 2 + 0.6, last.z + 5));
      pts.push(V(sx, sy, zR - 7)); pts.push(V(pinX(i) * 1.15, yW - 0.3 + Math.sin(i) * 0.4, zR - 1.5));
    }
    pts.push(V(pinX(i) * 0.75 + last.x * 0.25, yW + (last.y - yW) * 0.2, zFlat - (bad ? 0 : 1.2)));
    pts.push(V(pinX(i), yW, zFlat + 1.5));
    pts.push(V(pinX(i), yW, zF - 0.5));
    g.add(wireTube(pts, name, 0.47, 120));
    g.add(copperEnd(V(pinX(i), yW, zF - 0.48), V(0, 0, 1), 0.27));
  });
  /* the jacket, its cut edge, and (done right) the strain-relief bar biting it.
     With o.boot the moulded boot covers the back of the plug and the
     device runs the cable on from its end (cableFrom). */
  if (o.boot != null) { g.add(boot(zR, H, W, o.boot)); g.add(jacketRun(zJ, zR - 22, 3.05, jc, CAT6, { droop: 0.01 })); g.userData.exitZ = zR - 24; g.userData.cable = { r: 3.05, color: jc, text: CAT6 }; }
  else g.add(jacketRun(zJ, zJ - 34, 3.05, jc, CAT6, { run: o.run }));
  g.add(at(new THREE.Mesh(new THREE.RingGeometry(2.45, 3.05, 32), mat(jc, { rough: 0.6 })), 0, 0, zJ + 0.01));
  if (!bad) g.add(at(box(7.6, 1.5, 3.4, clearPlastic()), 0, -H / 2 + 0.85, zR + 3.2));
  else {
    g.add(at(box(7.6, 1.5, 3.4, clearPlastic()), 0, -H / 2 + 0.85, zR + 3.2));   // biting bare wires, not jacket
    g.add(wireTube([V(1.6, 1.8, zJ), V(2.8, 3.6, zJ + 2.5), V(2.1, 5.4, zJ + 4.6), V(3.4, 6.2, zJ + 6)], "white", 0.22, 40));   // the ripcord, left hanging
    g.children[g.children.length - 1].material = new THREE.MeshStandardMaterial({ color: 0xe9e1c8, roughness: 0.9 });
  }
  const tag = o.standard === "T568A" ? "T568A" : "T568B";
  const ex = { exitZ: g.userData.exitZ, cable: g.userData.cable };
  named(g, "plug:RJ45 " + tag + (bad ? " (bad termination)" : ""), { type: "rj45", standard: tag, termination: bad ? "bad" : "good", pins: order.slice() });
  Object.assign(g.userData, ex); return g;
}

/* ---- RJ11 plug: six positions; four wires (black, red, green, yellow)
   in positions 2-5 for two lines, straight on flat satin cable ---- */
export function rj11Plug(o = {}) {
  const g = new THREE.Group(), L = 14.5, W = 9.6, H = 6.6, zF = L / 2, zR = -L / 2, cp = clearPlastic();
  g.add(rbox(W, H, L, 0.6, cp));
  for (let k = 0; k <= 6; k++) g.add(at(box(0.34, 0.9, 4, cp), (k - 3) * 1.02, H / 2 + 0.15, zF - 2.2));
  const latch = new THREE.Group(); latch.add(at(box(4.6, 0.8, 9.5, cp), 0, 0, -4.75)); latch.add(at(box(5.4, 0.8, 2.4, cp), 0, -0.45, -9.6, -0.35, 0, 0));
  latch.position.set(0, -H / 2 - 0.35, zF - 2.5); latch.rotation.x = 0.16; g.add(latch);
  const colours = o.lines === 1 ? [null, null, "red", "green", null, null] : [null, "black", "red", "green", "yellow", null];
  const gm = mat(COL.gold, { metal: 1, rough: 0.2 }), zJ = zR + 5, yW = 0.9;
  for (let p = 0; p < 6; p++) {
    const x = (2.5 - p) * 1.02;
    if (!colours[p]) continue;
    g.add(at(box(0.3, 2.2, 3, gm), x, H / 2 - 1.0, zF - 2));
    g.add(wireTube([V((2.5 - p) * 0.95, 0, zJ - 2), V((2.5 - p) * 0.98, yW * 0.6, zJ + 2), V(x, yW, zJ + 5), V(x, yW, zF - 0.5)], colours[p], 0.42, 40));
    g.add(copperEnd(V(x, yW, zF - 0.48), V(0, 0, 1), 0.22));
  }
  const PHONE = "TELEPHONE CORD  ·  4 COND  ·  26AWG  ·  FLAT SATIN";
  g.add(jacketRun(zJ, o.stub ? zR - 2 : zJ - 30, 1.6, 0xa7abb1, PHONE, { flat: true, ink: "rgba(40,44,50,0.75)", droop: o.stub ? 0.01 : 0.8, run: o.stub ? null : o.run }));
  g.add(at(box(6.4, 1.2, 3, cp), 0, -H / 2 + 0.7, zR + 2.6));
  named(g, "plug:RJ11", { type: "rj11", positions: 6, conductors: o.lines === 1 ? 2 : 4 });
  if (o.stub) { g.userData.exitZ = zR - 2; g.userData.cable = { r: 1.6, color: 0xa7abb1, text: PHONE, ink: "rgba(40,44,50,0.75)", flat: true }; }
  return g;
}

/* ---- male F-type compression connector on RG6 ----
   compression sleeve, knurled body, a 7/16" hex nut threaded inside
   with its O-ring, the white foam dielectric, and the copper-clad
   centre conductor standing about 3 mm proud of the nut */
export function coaxF(o = {}) {
  const g = new THREE.Group();
  const nickel = mat(0xa9aeb5, { metal: 1, rough: 0.3 }), nickel2 = mat(0x989da4, { metal: 1, rough: 0.4 });   /* plated, not mirror-white */
  /* the cable */
  g.add(jacketRun(-15, -52, 3.45, 0x141414, "RG6 QUAD SHIELD  ·  18AWG CCS  ·  75 OHM  ·  SWEEP TESTED 3GHz  ·  CATV", { ink: "rgba(235,235,235,0.75)", droop: 2 }));
  /* compression sleeve: pushed home, its black collar showing */
  g.add(at(cyl(5.3, 5, mat(0x1c1c1e, { rough: 0.45 }), 40), 0, 0, -12.5, Math.PI / 2));
  g.add(at(new THREE.Mesh(new THREE.TorusGeometry(5.3, 0.35, 8, 40), mat(0x1c1c1e, { rough: 0.45 })), 0, 0, -15));
  /* the body, with its knurled grip */
  g.add(at(cyl(5.15, 11, nickel2, 48), 0, 0, -4.5, Math.PI / 2));
  for (let k = 0; k < 56; k++) { const a = k / 56 * Math.PI * 2, r = box(0.32, 0.22, 6, nickel); r.position.set(Math.cos(a) * 5.2, Math.sin(a) * 5.2, -5.5); r.rotation.z = a; g.add(r); }
  g.add(at(new THREE.Mesh(new THREE.TorusGeometry(5.15, 0.3, 8, 48), nickel), 0, 0, 0.9));
  /* the hex nut, 7/16 inch across the flats, chamfered, hollow */
  const hex = new THREE.Shape(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6; const px = Math.cos(a) * 6.41, py = Math.sin(a) * 6.41; if (k) hex.lineTo(px, py); else hex.moveTo(px, py); } hex.closePath();
  const bore = new THREE.Path(); bore.absarc(0, 0, 4.75, 0, Math.PI * 2, true); hex.holes.push(bore);
  g.add(at(new THREE.Mesh(new THREE.ExtrudeGeometry(hex, { depth: 5.6, bevelEnabled: true, bevelSize: 0.6, bevelThickness: 0.55, bevelSegments: 3, curveSegments: 40 }), nickel), 0, 0, 1.5));
  /* inside the nut: threads, O-ring, the post, the foam, the conductor */
  const tm = mat(0xaeb1b5, { metal: 1, rough: 0.3 });
  for (let k = 0; k < 7; k++) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(4.68, 0.24, 6, 40), tm), 0, 0, 2.2 + k * 0.78));
  g.add(at(new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.42, 8, 40), mat(0x0d0d0d, { rough: 0.6 })), 0, 0, 2.0));
  g.add(at(new THREE.Mesh(new THREE.RingGeometry(3.55, 4.75, 40), mat(0xb08d57, { metal: 0.9, rough: 0.35 })), 0, 0, 1.6));   // the brass post's rim
  g.add(at(new THREE.Mesh(new THREE.CircleGeometry(3.55, 40), mat(0xf4f2ea, { rough: 0.85 })), 0, 0, 1.62));               // foam dielectric
  const pin = cyl(0.51, 12.4, mat(0xc87a3e, { metal: 1, rough: 0.22 }), 16); g.add(at(pin, 0, 0, 4.4, Math.PI / 2));     // to 10.6: 3 mm proud of the nut face at 7.75
  g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.51, 0.5, 16), mat(0xc87a3e, { metal: 1, rough: 0.22 })), 0, 0, 10.85, Math.PI / 2));
  return named(g, "plug:F-type", { type: "coax", cable: "RG6" });
}

/* ---- a damaged run: kinked hard, crushed flat, the jacket torn open
   with the twisted pairs showing and one conductor broken ---- */
export function damagedCable(o = {}) {
  const g = new THREE.Group(), jc = o.jacket || 0x2c55b8, r = 3.05;
  const path = new THREE.CatmullRomCurve3([V(-95, 0, 0), V(-45, 0, 0), V(-15, 0, 0), V(-6.5, 5, 0), V(-2.2, 10.5, 0), V(0, 12.2, 0), V(2.2, 10.5, 0), V(6.5, 5, 0), V(15, 0, 0), V(30, 0, 0), V(46, 0, 0), V(60, 0, 0), V(100, 0, 0)], false, "catmullrom", 0.35);
  const N = 420, xAt = function (t) { return path.getPointAt(t).x; };
  const crush = function (t) { const x = xAt(t); const s = x < 16 || x > 54 ? 0 : x < 22 ? (x - 16) / 6 : x > 48 ? (54 - x) / 6 : 1; return s * s * (3 - 2 * s); };
  const radius = function (t) { const c = crush(t); return [r * (1 + 0.5 * c), r * (1 - 0.58 * c)]; };
  const apex = function (t) { const p = path.getPointAt(t); return Math.hypot(p.x, p.y - 11); };
  /* tears: on the outside of the kink, and across the crushed flat */
  const hole = function (t, a) {
    const p = path.getPointAt(t);
    if (apex(t) < 4.2) { const d = Math.atan2(Math.sin(a), Math.cos(a)); return Math.abs(d) < 0.85 + 0.25 * Math.sin(t * 900); }
    if (p.x > 27 && p.x < 39) { const d = Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)); return Math.abs(d) < 0.7 + 0.3 * Math.sin(p.x * 3.1); }
    return false;
  };
  const tint = function (t, a) { const d = apex(t); return d < 9 ? Math.max(0, Math.cos(a)) * (1 - d / 9) * 0.55 : 0; };   // stress whitening on the outside of the bend
  const jg = tubeVar(path, { n: N, m: 36, radius: radius, hole: hole, tint: tint, uvLength: 120, up: V(0, 0, 1) });
  g.add(new THREE.Mesh(jg, jacketMaterial(jc, CAT6, null, { side: THREE.DoubleSide })));
  /* the pairs inside, where the tears show them */
  const F = frames(path, N, V(0, 0, 1)), len = path.getLength();
  const at_s = function (s) { return Math.min(1, Math.max(0, s / len)); };
  const frameAt = function (s) { const i = Math.round(at_s(s) * N); return { N: F.N[i], B: F.B[i] }; };
  const sOfX = function (x) { let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (xAt(m) < x) lo = m; else hi = m; } return lo * len; };
  [["orange", 0], ["green", 1], ["blue", 2], ["brown", 3]].forEach(function (pc) {
    const P = PAIRS[pc[1]];
    [[-12, 12], [24, 42]].forEach(function (seg) {
      const s0 = sOfX(seg[0]), s1 = sOfX(seg[1]);
      const centre = function (s) { const t = at_s(s), c = crush(t), Fr = frameAt(s); return path.getPointAt(t).addScaledVector(Fr.B, P.c[0] * (1 + 0.5 * c)).addScaledVector(Fr.N, P.c[1] * (1 - 0.58 * c)); };
      [0, Math.PI].forEach(function (ph, w) {
        const name = (w === 0 ? "white/" : "") + pc[0];
        if (pc[0] === "orange" && w === 1 && seg[0] === 24) {
          /* the broken conductor: two ends, copper showing, pushed out of the tear */
          const A = helix(centre, frameAt, s0, sOfX(31.5), P.lay, ph, 0.5); A.push(V(32.6, 2.6, 1.8)); g.add(wireTube(A, name, 0.47));
          g.add(at(cyl(0.26, 1.4, mat(0xc87a3e, { metal: 1, rough: 0.25 })), 33.2, 3.0, 2.1, 0, 0, 0.9));
          const Bp = helix(centre, frameAt, sOfX(34), s1, P.lay, ph, 0.5); Bp.unshift(V(33.6, 3.4, 2.5)); g.add(wireTube(Bp, name, 0.47));
          g.add(at(cyl(0.26, 1.4, mat(0xc87a3e, { metal: 1, rough: 0.25 })), 33.9, 4.0, 2.8, 0, 0, 0.5));
          return;
        }
        g.add(wireTube(helix(centre, frameAt, s0, s1, P.lay, ph, 0.5), name, 0.47));
      });
    });
  });
  /* flakes of torn jacket on the floor */
  for (let i = 0; i < 7; i++) g.add(at(box(1.6 + (i % 3) * 0.7, 0.35, 1.1 + (i % 2) * 0.6, mat(jc, { rough: 0.5 })), 22 + i * 4.8, -2.6, 6.5 - i * 1.9, 0, i * 0.8, 0));
  return named(g, "cable:Damaged run", { type: "damaged", faults: ["kinked", "crushed", "jacket torn", "conductor broken"] });
}

/* ---- the moulded boot of a factory patch cable ----
   A collar over the back of the plug, tapering to the cable, ribbed so
   the cable bends gently instead of kinking at the plug, and the
   snagless hood that keeps the latch from catching. */
function boot(zR, H, W, color) {
  const g = new THREE.Group(), m = mat(color, { rough: 0.48, grain: 0.06 });
  const z0 = zR + 6, z1 = zR - 24, L = z0 - z1;
  const lerp = THREE.MathUtils.lerp;
  const geo = tubeVar(new THREE.LineCurve3(V(0, 0, z0), V(0, 0, z1)), { n: 150, m: 44, up: V(0, 1, 0),
    radius: function (t) {
      const zz = t * L;
      if (zz < 8) return [W / 2 + 0.75, H / 2 + 0.75];
      const k = Math.min(1, (zz - 8) / 8), rx = lerp(W / 2 + 0.75, 4.4, k), ry = lerp(H / 2 + 0.75, 4.1, k);
      const groove = zz > 15 && zz < L - 1.5 && Math.sin((zz - 15) * 2.2) > 0.35 ? -0.55 : 0;
      const taper = zz > 15 ? -(zz - 15) / (L - 15) * 0.75 : 0;
      return [rx + groove + taper, ry + groove + taper];
    },
    square: function (t) { const zz = t * L; return zz < 8 ? 8 : lerp(8, 2, Math.min(1, (zz - 8) / 8)); } });
  g.add(new THREE.Mesh(geo, m));
  g.add(at(new THREE.Mesh(new THREE.RingGeometry(3.0, 3.75, 32), m), 0, 0, z1, 0, Math.PI, 0));             // where the cable goes in
  /* the snagless hood over the latch tab */
  const hood = new THREE.Group(); hood.position.set(0, -H / 2 - 0.75, zR + 6); g.add(hood);
  const hs = new THREE.Shape(); hs.moveTo(-4.1, 0); hs.lineTo(4.1, 0); hs.lineTo(3.6, -3.2); hs.quadraticCurveTo(0, -4.1, -3.6, -3.2); hs.closePath();
  const hg = new THREE.ExtrudeGeometry(hs, { depth: 9, bevelEnabled: true, bevelSize: 0.4, bevelThickness: 0.4, bevelSegments: 2 });
  const hm = new THREE.Mesh(hg, m); hm.position.z = -9; hood.add(hm);
  return g;
}

/* ---- a cable running on from a plug, in the device's own coordinates:
   out of the plug's back, then through the points given (down to the
   bench and along it), as a real patch cable lies ---- */
export function cableFrom(root, plug, pts, o = {}) {
  root.updateMatrixWorld(true);
  const c = plug.userData.cable || {}, r = o.r || c.r || 3.05, z = plug.userData.exitZ;
  const toRoot = function (v) { return root.worldToLocal(plug.localToWorld(v.clone())); };
  const P = [toRoot(V(0, 0, z + 3)), toRoot(V(0, 0, z - 6)), toRoot(V(0, 0, z - (o.straight || 20)))].concat(pts.map(function (q) { return q.isVector3 ? q : V(q[0], q[1], q[2]); }));
  const up = toRoot(V(0, 1, z)).sub(toRoot(V(0, 0, z))).normalize();
  const curve = new THREE.CatmullRomCurve3(P, false, "centripetal");
  const flat = o.flat != null ? o.flat : c.flat;
  const geo = tubeVar(curve, { n: Math.max(60, Math.ceil(curve.getLength() / 1.5)), m: flat ? 20 : 24, up: up, uvLength: 420,
    radius: function () { return flat ? [r * 1.95, r] : [r, r]; } });
  /* the legend at its real size (about 2.5 mm letters), repeating every so often, in a softer ink */
  const col = o.color != null ? o.color : c.color, lum = new THREE.Color(col).getHSL({}).l;
  const mesh = new THREE.Mesh(geo, jacketMaterial(col, o.text || c.text || CAT6, o.ink || c.ink || (lum < 0.3 ? "rgba(235,235,235,0.5)" : "rgba(25,25,25,0.55)"), { font: 16 }));
  root.add(mesh); return mesh;
}
/* plug a plug into a jack group (both face +Z; the plug goes in pointing -Z) */
export function plugInto(jack, plug, o = {}) {
  plug.rotation.y = Math.PI; plug.position.set(0, o.y == null ? 0.9 : o.y, o.z == null ? 2.75 : o.z);
  jack.add(plug); return plug;
}

/* ---- IEC C13 mains connector on its cord (the plug that goes into a
   PC's or printer's C14 inlet): the moulded body, the strain relief ---- */
export function iecC13(o = {}) {
  const g = new THREE.Group(), m = mat(0x1a1b1d, { rough: 0.5, grain: 0.06 });
  const face = new THREE.Shape(); [[-11.8, 7.9], [11.8, 7.9], [11.8, -2.6], [7.0, -7.9], [-7.0, -7.9], [-11.8, -2.6]].forEach(function (q, i) { if (i) face.lineTo(q[0], q[1]); else face.moveTo(q[0], q[1]); }); face.closePath();
  [[-7, 1.8], [7, 1.8], [0, -4.4]].forEach(function (q) { const h = new THREE.Path(); h.moveTo(q[0] - 1.3, q[1] - 2.7); h.lineTo(q[0] + 1.3, q[1] - 2.7); h.lineTo(q[0] + 1.3, q[1] + 2.7); h.lineTo(q[0] - 1.3, q[1] + 2.7); h.closePath(); face.holes.push(h); });
  const nose = new THREE.Mesh(new THREE.ExtrudeGeometry(face, { depth: 9, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.5, bevelSegments: 2 }), m);
  nose.position.z = -9; g.add(nose);
  g.add(at(rbox(27, 19, 20, 3.2, m), 0, 0, -19));
  for (let k = 0; k < 5; k++) g.add(at(box(27.4, 0.6, 0.8, m), 0, -6 + k * 3, -19 + 10.1, 0, 0, 0));   /* grip ridges on the body's sides */
  const L = 26, geo = tubeVar(new THREE.LineCurve3(V(0, 0, -28), V(0, 0, -28 - L)), { n: 110, m: 36, up: V(0, 1, 0),
    radius: function (t) { const zz = t * L, base = THREE.MathUtils.lerp(7.6, 4.3, Math.min(1, zz / 18)); return [base * (zz < 4 ? 1.25 : 1) + (Math.sin(zz * 1.9) > 0.4 && zz > 5 ? -0.45 : 0), base + (Math.sin(zz * 1.9) > 0.4 && zz > 5 ? -0.45 : 0)]; },
    square: function (t) { return t < 0.15 ? 5 : 2; } });
  g.add(new THREE.Mesh(geo, m));
  named(g, "plug:IEC C13", { type: "iec-c13" });
  g.userData.exitZ = -28 - L + 2; g.userData.cable = { r: 3.9, color: 0x161718, text: "18AWG x 3C  ·  SJT  ·  105°C  ·  300V  ·  VW-1", ink: "rgba(220,220,220,0.55)" };
  return g;
}
