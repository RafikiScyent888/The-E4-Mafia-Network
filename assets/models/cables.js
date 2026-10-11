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

/* clear polycarbonate, as it reads in the owner's photos: glass-clear
   face-on (the wires and contacts show at full colour), only its edges
   and corners catching the light, in a thin bright line where the surface
   turns away (a sharp Fresnel rim). o.faint for inner walls, which in a
   real plug are hardly seen at all. Every layer adds a film, so keep the
   face-on opacity near zero: at 0.08 the plug read cloudy. */
const clearCache = {};
function clearPlastic(o = {}) {
  const key = o.faint ? "faint" : "body"; if (clearCache[key]) return clearCache[key];
  const base = o.faint ? 0.0 : 0.012, rim = o.faint ? 0.22 : 0.8, pw = o.faint ? 5.0 : 3.0;
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: base, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.0 });
  m.userData.clear = true;
  m.onBeforeCompile = function (sh) {
    sh.fragmentShader = sh.fragmentShader.replace("#include <opaque_fragment>", "#include <opaque_fragment>\n" +
      "{ float e4f = 1.0 - abs(dot(normal, normalize(vViewPosition))); float e4r = pow(e4f, " + pw.toFixed(1) + ");\n" +
      "  gl_FragColor.a = clamp(" + base.toFixed(3) + " + e4r * " + rim.toFixed(2) + ", 0.0, 0.85);\n" +
      "  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.97, 0.985, 0.99), e4r * 0.55); }");
  };
  m.customProgramCacheKey = function () { return "e4clear2" + key; };
  clearCache[key] = m; return m;
}
const V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
export { clearPlastic, GOLD };
/* gold plating: kept partly diffuse so it reads gold from every angle, not brown where it mirrors the bench */
const GOLD = new THREE.MeshStandardMaterial({ color: 0xdcaa3c, metalness: 0.7, roughness: 0.28, envMapIntensity: 1.6 });
const CAT6 = "CAT6 UTP  ·  23AWG 4PR  ·  550MHz  ·  TIA-568.2  ·  VERIFIED  ·  1000FT";

/* a straight-ish jacket from z0 back to z1 (z1 < z0), drooping a little */
function jacketRun(z0, z1, r, color, text, o = {}) {
  /* o.run: where the cable goes after the plug, as [x, y, dz] steps back from the jacket's end (a patch cable drooping to the floor) */
  const pts = o.run ? [V(0, 0, z0)].concat(o.run.map(function (q) { return V(q[0], q[1], z0 - q[2]); })) : [V(0, 0, z0), V(0, 0, (z0 + z1) / 2), V(0, -(o.droop == null ? 1.5 : o.droop), z1)];
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
  /* the body: the front contact block, and behind it the collar where the cable enters, a step proud of it */
  g.add(at(rbox(W, H, L - 6, 0.7, cp), 0, 0, 3));
  g.add(at(rbox(W + 0.6, H + 0.5, 6.2, 0.8, cp), 0, 0.1, zR + 3.1));
  [-1, 1].forEach(function (sd) { g.add(at(box(0.8, 3.2, 3.2, cp), sd * (W / 2 + 0.55), 0.6, zR + 3.4)); });   /* the side bosses */
  for (let k = 0; k <= 8; k++) g.add(at(box(0.36, 1.0, 4.8, cp), (k - 4) * 1.02, H / 2 + 0.2, zF - 2.6));
  const cpf = clearPlastic({ faint: true });
  for (let k = 0; k <= 8; k++) g.add(at(box(0.22, 2.2, 9.5, cpf), (k - 4) * 1.02, 1.3, zF - 5.6));   /* the channel walls, one wire to a channel */
  const latch = new THREE.Group();
  latch.add(at(box(6.4, 0.9, 13.5, cp), 0, 0, -6.75));
  latch.add(at(box(7.4, 0.9, 3.2, cp), 0, -0.55, -13.4, -0.35, 0, 0));
  for (let k = 0; k < 3; k++) latch.add(at(box(7.2, 0.35, 0.4, cp), 0, -0.4 - k * 0.2, -12.4 - k * 0.9, -0.35, 0, 0));
  latch.position.set(0, -H / 2 - 0.4, zF - 3); latch.rotation.x = 0.16; g.add(latch);
  /* the eight gold blades, each with its crown of teeth into a wire */
  const gm = GOLD;
  const pinX = function (i) { return (3.5 - i) * 1.02; };   // pin 1 on the left, plug pointing away, clip underneath
  for (let i = 0; i < 8; i++) {
    g.add(at(box(0.3, 2.6, 3.6, gm), pinX(i), H / 2 - 1.15, zF - 2.4));
    g.add(at(box(0.72, 0.25, 3.2, gm), pinX(i), H / 2 + 0.05, zF - 2.4));   /* the blade's top edge, as seen through the top of the plug */
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
  else g.add(jacketRun(zJ, zJ - (o.jacketLen || 34), 3.05, jc, CAT6, { run: o.run, droop: o.jacketLen ? 0.01 : null }));   /* o.jacketLen: a short end, when another plug's run arrives here */
  g.add(at(new THREE.Mesh(new THREE.RingGeometry(2.45, 3.05, 32), mat(jc, { rough: 0.6 })), 0, 0, zJ + 0.01));
  if (bad) g.add(frayedEnd(zJ, 3.05, jc));
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
  g.add(at(rbox(W, H, L - 4, 0.6, cp), 0, 0, 2));
  g.add(at(rbox(W + 0.5, H + 0.4, 4.2, 0.7, cp), 0, 0.1, zR + 2.1));
  for (let k = 0; k <= 6; k++) g.add(at(box(0.34, 0.9, 4, cp), (k - 3) * 1.02, H / 2 + 0.15, zF - 2.2));
  for (let k = 0; k <= 6; k++) g.add(at(box(0.2, 1.8, 6, clearPlastic({ faint: true })), (k - 3) * 1.02, 1.0, zF - 4.2));
  const latch = new THREE.Group(); latch.add(at(box(4.6, 0.8, 9.5, cp), 0, 0, -4.75)); latch.add(at(box(5.4, 0.8, 2.4, cp), 0, -0.45, -9.6, -0.35, 0, 0));
  latch.position.set(0, -H / 2 - 0.35, zF - 2.5); latch.rotation.x = 0.16; g.add(latch);
  const colours = o.lines === 1 ? [null, null, "red", "green", null, null] : [null, "black", "red", "green", "yellow", null];
  const gm = GOLD, zJ = zR + 5, yW = 0.9;
  for (let p = 0; p < 6; p++) {
    const x = (2.5 - p) * 1.02;
    if (!colours[p]) continue;
    g.add(at(box(0.3, 2.2, 3, gm), x, H / 2 - 1.0, zF - 2));
    g.add(at(box(0.7, 0.25, 2.7, gm), x, H / 2 + 0.05, zF - 2));
    g.add(wireTube([V((2.5 - p) * 0.95, 0, zJ - 2), V((2.5 - p) * 0.98, yW * 0.6, zJ + 2), V(x, yW, zJ + 5), V(x, yW, zF - 0.5)], colours[p], 0.42, 40));
    g.add(copperEnd(V(x, yW, zF - 0.48), V(0, 0, 1), 0.22));
  }
  /* flat satin cord for a phone line cord (the wall plate), round grey cable as in the owner's RJ11 photos */
  const flat = !!o.flat, PHONE = flat ? "TELEPHONE CORD  ·  4 COND  ·  26AWG  ·  FLAT SATIN" : "TELEPHONE CABLE  ·  2 PAIR  ·  24AWG  ·  CMR", jr = flat ? 1.6 : 2.0;
  g.add(jacketRun(zJ, o.stub ? zR - 2 : zJ - 30, jr, flat ? 0xa7abb1 : 0x8e9196, PHONE, { flat: flat, ink: "rgba(40,44,50,0.7)", droop: o.stub ? 0.01 : 0.8, run: o.stub ? null : o.run }));
  g.add(at(box(6.4, 1.2, 3, cp), 0, -H / 2 + 0.7, zR + 2.6));
  named(g, "plug:RJ11", { type: "rj11", positions: 6, conductors: o.lines === 1 ? 2 : 4 });
  if (o.stub) { g.userData.exitZ = zR - 2; g.userData.cable = { r: jr, color: flat ? 0xa7abb1 : 0x8e9196, text: PHONE, ink: "rgba(40,44,50,0.7)", flat: flat }; }
  return g;
}

/* ---- male F-type compression connector on RG6 ----
   compression sleeve, knurled body, a 7/16" hex nut threaded inside
   with its O-ring, the white foam dielectric, and the copper-clad
   centre conductor standing about 3 mm proud of the nut */
export function coaxF(o = {}) {
  const g = new THREE.Group();
  const nickel = mat(0xd3d6da, { metal: 0.8, rough: 0.24 }), nickel2 = mat(0xc4c8cc, { metal: 0.8, rough: 0.3 });   /* nickel plate: bright, but not mirror-white */
  /* the cable (o.stub: a short end, the device runs the rest with cableFrom) */
  const RG6 = "RG6 QUAD SHIELD  ·  18AWG CCS  ·  75 OHM  ·  SWEEP TESTED 3GHz  ·  CATV", jc = o.jacket == null ? 0x141414 : o.jacket, ink = new THREE.Color(jc).getHSL({}).l > 0.5 ? "rgba(30,30,30,0.6)" : "rgba(235,235,235,0.75)";
  g.add(jacketRun(-15, o.stub ? -22 : -52, 3.45, jc, RG6, { ink: ink, droop: o.stub ? 0.01 : 2, run: o.stub ? null : o.run }));
  /* compression sleeve: pushed home, its black collar showing */
  g.add(at(cyl(5.3, 5, nickel, 40), 0, 0, -12.5, Math.PI / 2));                                            /* the sleeve, plated, as photographed */
  g.add(at(new THREE.Mesh(new THREE.TorusGeometry(5.3, 0.35, 8, 40), nickel), 0, 0, -15));
  /* the body, with its knurled grip */
  g.add(at(cyl(5.15, 11, nickel2, 48), 0, 0, -4.5, Math.PI / 2));
  for (let k = 0; k < 56; k++) { const a = k / 56 * Math.PI * 2, r = box(0.32, 0.22, 6, nickel); r.position.set(Math.cos(a) * 5.2, Math.sin(a) * 5.2, -5.5); r.rotation.z = a; g.add(r); }
  g.add(at(new THREE.Mesh(new THREE.TorusGeometry(5.15, 0.3, 8, 48), nickel), 0, 0, 0.9));
  /* the hex nut, 7/16 inch across the flats, chamfered, hollow */
  const hex = new THREE.Shape(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const px = Math.cos(a) * 6.41, py = Math.sin(a) * 6.41; if (k) hex.lineTo(px, py); else hex.moveTo(px, py); } hex.closePath();
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
  named(g, "plug:F-type", { type: "coax", cable: "RG6" });
  if (o.stub) { g.userData.exitZ = -20; g.userData.cable = { r: 3.45, color: jc, text: RG6, ink: ink }; }
  return g;
}

/* ---- a damaged run, as photographed: a big kink humped up off the
   bench, the jacket torn clean through at its foot with the pairs bare
   and splayed; then a crushed flat stretch torn open on top, broken
   conductors and bare copper strands sticking out every way; flakes of
   jacket and snipped wire on the bench. The cable's centre is at y = 0
   where it lies flat (lift it by its radius to sit it on a bench). ---- */
export function damagedCable(o = {}) {
  const g = new THREE.Group(), jc = o.jacket || 0x24459c, r = 3.05;
  const path = new THREE.CatmullRomCurve3([V(-160, 0, 0), V(-100, 0, 0), V(-72, 0, 0), V(-56, 1.2, 0), V(-44, 7, 0), V(-32, 17, 0), V(-20, 22.5, 0), V(-8, 20, 0),
    V(2, 11, 0), V(10, 3, 0), V(20, 0, 0), V(40, 0, 0), V(60, 0, 0), V(80, 0, 0), V(110, 0, 0), V(160, 0, 0)], false, "catmullrom", 0.5);
  const N = 620, len = path.getLength(), xAt = function (t) { return path.getPointAt(t).x; };
  const smooth = function (e) { e = Math.max(0, Math.min(1, e)); return e * e * (3 - 2 * e); };
  const crush = function (t) { const x = xAt(t); return smooth((x - 26) / 7) * smooth((84 - x) / 7); };
  const gapA = -64, gapB = -45;                                                   /* torn clean through here */
  const radius = function (t) { const c = crush(t); return [r * (1 + 0.55 * c), r * (1 - 0.6 * c)]; };
  const hole = function (t, a) {
    const x = xAt(t), d = Math.atan2(Math.sin(a), Math.cos(a));
    if (x > gapA + 1.6 * Math.sin(a * 3) && x < gapB + 2.2 * Math.sin(a * 2 + 1)) return true;
    if (x > 40 && x < 64) return Math.abs(d) < 0.95 + 0.35 * Math.sin(x * 2.3) + 0.2 * Math.sin(x * 7.1);
    return false;
  };
  const tint = function (t, a) { const p = path.getPointAt(t); if (p.y < 3) return 0; return Math.max(0, Math.cos(a)) * Math.min(1, (p.y - 3) / 18) * 0.4; };   /* stress whitening over the hump */
  const jg = tubeVar(path, { n: N, m: 40, radius: radius, hole: hole, tint: tint, uvLength: 120, up: V(0, 1, 0) });
  g.add(new THREE.Mesh(jg, jacketMaterial(jc, CAT6, null, { side: THREE.DoubleSide })));
  /* ragged tongues of jacket round the torn ends */
  const jm = mat(jc, { rough: 0.5 }); const jmd = jm.clone(); jmd.side = THREE.DoubleSide;
  const F = frames(path, N, V(0, 1, 0));
  const tOfX = function (x) { let lo = 0, hi = 1; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (xAt(m) < x) lo = m; else hi = m; } return lo; };
  [[gapA, -1], [gapB, 1]].forEach(function (e, ei) {
    const t = tOfX(e[0]), i = Math.round(t * N), P = path.getPointAt(t), T = F.T[i];
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * Math.PI * 2 + ei, w = 1.6 + (k % 3) * 0.6, l = 1.8 + (k * 5 % 4) * 0.7;
      const n = F.N[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(F.B[i], Math.sin(a));
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, l), jmd);
      fl.position.copy(P).addScaledVector(n, r + 0.3).addScaledVector(T, e[1] * l * 0.4);
      fl.lookAt(fl.position.clone().add(n)); fl.rotateX(e[1] * (0.6 + (k % 2) * 0.4)); g.add(fl);
    }
  });
  /* the pairs inside: hidden under the jacket, bare and splayed across the gap */
  const frameAt = function (s) { const k = Math.round(Math.min(1, Math.max(0, s / len)) * N); return { N: F.N[k], B: F.B[k] }; };
  const sOfX = function (x) { return tOfX(x) * len; };
  [["orange", 0], ["green", 1], ["blue", 2], ["brown", 3]].forEach(function (pc) {
    const P = PAIRS[pc[1]];
    const centre = function (s) {
      const t = s / len, x = xAt(t), c = crush(t), Fr = frameAt(s);
      const sp = 1 + 1.6 * smooth((x - gapA + 4) / 6) * smooth((gapB + 4 - x) / 6);   /* loosened where the jacket is gone */
      const sag = -1.4 * smooth((x - gapA) / 8) * smooth((gapB - x) / 8) * (pc[1] - 1.5) * 0.5;
      return path.getPointAt(t).addScaledVector(Fr.B, P.c[0] * sp * (1 + 0.5 * c)).addScaledVector(Fr.N, P.c[1] * sp * (1 - 0.6 * c) + sag);
    };
    [[gapA - 4, gapB + 4], [38, 66]].forEach(function (seg, si) {
      const s0 = sOfX(seg[0]), s1 = sOfX(seg[1]);
      [0, Math.PI].forEach(function (ph, w) {
        const name = (w === 0 ? "white/" : "") + pc[0];
        if (si === 1 && pc[0] === "orange" && w === 1) {
          /* the broken conductor: two ends pushed up out of the tear, copper showing */
          const A = helix(centre, frameAt, s0, sOfX(50), P.lay, ph, 0.5); A.push(V(51.5, 3.6, 0.6)); g.add(wireTube(A, name, 0.47));
          g.add(at(cyl(0.26, 1.5, mat(0xc87a3e, { metal: 1, rough: 0.25 })), 52.2, 4.1, 0.6, 0, 0, 0.8));
          const Bp = helix(centre, frameAt, sOfX(53), s1, P.lay, ph, 0.5); Bp.unshift(V(52.6, 4.4, 1.2)); g.add(wireTube(Bp, name, 0.47));
          g.add(at(cyl(0.26, 1.5, mat(0xc87a3e, { metal: 1, rough: 0.25 })), 52.6, 5.0, 1.4, 0, 0, 0.4));
          return;
        }
        g.add(wireTube(helix(centre, frameAt, s0, s1, P.lay, ph, 0.5), name, 0.47, 160));
      });
    });
  });
  /* bare copper strands splayed out of the crushed tear, a few still insulated */
  const cu = mat(0xc87a3e, { metal: 1, rough: 0.3 });
  for (let k = 0; k < 22; k++) {
    const x0 = 42 + (k * 37 % 20), a = -0.5 + (k * 53 % 100) / 100 * 2.8, l = 5 + (k * 29 % 11), bend = (k % 3 - 1) * 0.7;
    const p0 = V(x0, 1.0, (k % 5 - 2) * 0.6), d = V(Math.cos(a) * 0.5 + bend * 0.3, Math.sin(a) * 0.9 + 0.3, Math.cos(a) * 0.8).normalize();
    const pts = [p0, p0.clone().addScaledVector(d, l * 0.5).add(V(bend, 0.4, 0)), p0.clone().addScaledVector(d, l).add(V(bend * 2, -0.6, 0.5))];
    const ins = k % 5 === 0;
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, ins ? 0.47 : 0.12, 6), ins ? wireMat(["orange", "white/green", "brown", "white/blue", "green"][k % 5]) : cu));
  }
  /* flakes of torn jacket, and snipped bits of wire, on the bench */
  for (let i = 0; i < 18; i++) {
    const x = -110 + (i * 41 % 220), z = -20 + (i * 23 % 40), sz = 1.3 + (i % 4) * 0.8;
    if (Math.abs(z) < 5) continue;
    g.add(at(box(sz, 0.35, sz * (0.55 + (i % 3) * 0.3), mat(jc, { rough: 0.5 })), x, -r + 0.18, z, 0, i * 0.8, 0));
  }
  for (let i = 0; i < 7; i++) { const w = cyl(0.2, 3 + i % 3, i % 2 ? cu : wireMat("white/orange"), 6); at(w, -70 + i * 26, -r + 0.2, (i % 2 ? 1 : -1) * (9 + (i % 3) * 4), 0, i * 1.1, Math.PI / 2); g.add(w); }
  return named(g, "cable:Damaged run", { type: "damaged", faults: ["kinked", "jacket torn through", "crushed", "conductor broken"] });
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
   bench and along it), as a real patch cable lies.
   The run remembers how it was made (mesh.userData.run) and the plug
   knows its run (plug.userData.runMesh), so the site can pull a plug out
   and lay the cable again from where the plug now is. Two kinds of
   damage, in millimetres along the run from the plug:
     o.crush: [s0, s1]       flattened, as under a chair wheel
     o.split: { at, len }    kinked and split open on top, the blue and
                             brown pairs showing, one wire of each broken ---- */
export function cableFrom(root, plug, pts, o = {}) {
  root.updateMatrixWorld(true);
  const c = plug.userData.cable || {}, r = o.r || c.r || 3.05, z = plug.userData.exitZ;
  const toRoot = function (v) { return root.worldToLocal(plug.localToWorld(v.clone())); };
  const P = [toRoot(V(0, 0, z + 3)), toRoot(V(0, 0, z - 6)), toRoot(V(0, 0, z - (o.straight || 20)))].concat(pts.map(function (q) { return q.isVector3 ? q : V(q[0], q[1], q[2]); }));
  const up = toRoot(V(0, 1, z)).sub(toRoot(V(0, 0, z))).normalize();
  const curve = new THREE.CatmullRomCurve3(P, false, "centripetal");
  const flat = o.flat != null ? o.flat : c.flat, L = curve.getLength();
  const smooth = function (e) { e = Math.max(0, Math.min(1, e)); return e * e * (3 - 2 * e); };
  const c0 = o.crush ? (o.crush[0] < 0 ? L + o.crush[0] : o.crush[0]) : 0, c1 = o.crush ? (o.crush[1] < 0 ? L + o.crush[1] : o.crush[1]) : 0;   /* negative: from the far end */
  const crush = o.crush ? function (t) { const s = t * L; return smooth((s - c0) / 6) * smooth((c1 - s) / 6); } : null;
  const inSplit = o.split ? function (t) { const s = t * L; return s > o.split.at && s < o.split.at + o.split.len; } : null;
  const n = Math.max(60, Math.ceil(L / 1.5)), m = flat ? 20 : 24;
  const geo = tubeVar(curve, { n: n, m: m, up: up, uvLength: 420,
    radius: function (t) { const b = flat ? [r * 1.95, r] : [r, r]; if (!crush) return b; const k = crush(t); return [b[0] * (1 + 0.8 * k), b[1] * (1 - 0.72 * k)]; },   /* squashed flat and spread wide, as under a chair wheel */
    hole: inSplit ? function (t, a) { const d = Math.atan2(Math.sin(a), Math.cos(a)), s = t * L - o.split.at; return inSplit(t) && Math.abs(d) < 0.75 + 0.25 * Math.sin(s * 1.7); } : null,
    tint: o.split ? function (t, a) { const s = t * L, m = o.split.at + o.split.len / 2, w = Math.max(0, 1 - Math.abs(s - m) / (o.split.len * 1.6)); return w * Math.max(0, Math.cos(a)) * 0.45; } : null });
  if (crush) {   /* a flattened stretch still lies on the bench: lower it by what it lost in height */
    const pa = geo.attributes.position;
    for (let i = 0; i <= n; i++) { const k = crush(i / n); if (!k) continue; for (let j = 0; j <= m; j++) { const q = i * (m + 1) + j; pa.setY(q, pa.getY(q) - r * 0.72 * k); } }
    pa.needsUpdate = true; geo.computeBoundingSphere();
  }
  /* the legend at its real size (about 2.5 mm letters), repeating every so often, in a softer ink */
  const col = o.color != null ? o.color : c.color, lum = new THREE.Color(col).getHSL({}).l;
  const mesh = new THREE.Mesh(geo, jacketMaterial(col, o.text || c.text || CAT6, o.ink || c.ink || (lum < 0.3 ? "rgba(235,235,235,0.5)" : "rgba(25,25,25,0.55)"), { font: 16, side: o.split ? THREE.DoubleSide : null }));
  if (o.split) {
    /* inside the split: the blue and brown pairs, pushed up into the tear; the solid wire of each broken, copper showing */
    const N = 400, F = frames(curve, N, up), frameAt = function (s) { const k = Math.round(Math.min(1, Math.max(0, s / L)) * N); return { N: F.N[k], B: F.B[k] }; };
    const s0 = o.split.at - 4, s1 = o.split.at + o.split.len + 4, mid = o.split.at + o.split.len / 2;
    [["blue", [0.55, 0.85], 16.5], ["brown", [-0.55, 0.85], 18.4]].forEach(function (pc, k) {
      const centre = function (s) { const Fr = frameAt(s), lift = smooth((s - o.split.at) / 4) * smooth((o.split.at + o.split.len - s) / 4) * 1.6; return curve.getPointAt(Math.min(1, s / L)).addScaledVector(Fr.B, pc[1][0] * r / 1.6).addScaledVector(Fr.N, pc[1][1] * r / 1.6 + lift); };
      mesh.add(wireTube(helix(centre, frameAt, s0, s1, pc[2], 0, 0.5), "white/" + pc[0], 0.47, 120));
      const gap = 1.4 + k * 0.6, A = helix(centre, frameAt, s0, mid - gap + k, pc[2], Math.PI, 0.5), B = helix(centre, frameAt, mid + gap + k, s1, pc[2], Math.PI, 0.5);
      mesh.add(wireTube(A, pc[0], 0.47, 80)); mesh.add(wireTube(B, pc[0], 0.47, 80));
      mesh.add(copperEnd(A[A.length - 1], A[A.length - 1].clone().sub(A[A.length - 2]).normalize(), 0.27));
      mesh.add(copperEnd(B[0], B[0].clone().sub(B[1]).normalize(), 0.27));
    });
  }
  mesh.userData.run = { pts: pts, o: o }; plug.userData.runMesh = mesh;
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

/* ---- a DC barrel plug on its cord (5.5 x 2.1 mm), front at z = 0 ---- */
export function dcPlug(o = {}) {
  const g = new THREE.Group(), m = mat(o.color || 0x161718, { rough: 0.5, grain: 0.06 });
  g.add(at(cyl(2.75, 9, mat(0xc9ccd0, { metal: 1, rough: 0.25 }), 24), 0, 0, 4.5, Math.PI / 2));     // the barrel (inside the jack)
  g.add(at(cyl(4.2, 3, m, 28), 0, 0, -1.5, Math.PI / 2));
  g.add(at(cyl(5.2, 13, m, 32), 0, 0, -9.5, Math.PI / 2));
  for (let k = 0; k < 8; k++) g.add(at(box(0.8, 0.5, 9, m), Math.cos(k / 8 * Math.PI * 2) * 5.2, Math.sin(k / 8 * Math.PI * 2) * 5.2, -9.5, 0, 0, k / 8 * Math.PI * 2));   /* grip flutes */
  const L = 13, geo = tubeVar(new THREE.LineCurve3(V(0, 0, -16), V(0, 0, -16 - L)), { n: 80, m: 28, up: V(0, 1, 0),
    radius: function (t) { const zz = t * L, r = THREE.MathUtils.lerp(4.4, 2.3, zz / L) + (zz > 3 && Math.sin(zz * 2.4) > 0.3 ? -0.35 : 0); return [r, r]; } });
  g.add(new THREE.Mesh(geo, m));
  named(g, "plug:DC", { type: "dc" });
  g.userData.exitZ = -28; g.userData.cable = { r: 1.9, color: o.color || 0x161718, text: "UL 2468  ·  20AWG x 2C  ·  80°C 300V  ·  VW-1", ink: "rgba(225,225,225,0.4)" };
  return g;
}

/* ---- SC/APC fiber connector on its patch cord, front at z = 0: the
   green push-pull housing (green = angle-polished), its grip, the boot,
   the 2 mm single-mode cord ---- */
export function scApcPlug(o = {}) {
  const g = new THREE.Group(), gm = mat(COL.apcGreen, { rough: 0.4, grain: 0.05 });
  g.add(at(rbox(6.4, 7.4, 10, 0.6, gm), 0, 0, 1));                                   // the part inside the adapter
  g.add(at(rbox(8.6, 8.6, 12, 1, gm), 0, 0, -10));                                   // the grip housing
  for (let k = 0; k < 6; k++) [-1, 1].forEach(function (sd) { g.add(at(box(0.5, 6.4, 0.8, gm), sd * 4.35, 0, -14 + k * 1.6)); });
  g.add(at(box(2.2, 0.8, 8, gm), 0, 4.6, -9));                                       // the key on top
  const L = 26, geo = tubeVar(new THREE.LineCurve3(V(0, 0, -16), V(0, 0, -16 - L)), { n: 120, m: 32, up: V(0, 1, 0),
    radius: function (t) { const zz = t * L, r = THREE.MathUtils.lerp(4.2, 1.5, Math.min(1, zz / 22)) + (zz > 6 && zz < 22 && Math.sin(zz * 2.0) > 0.4 ? -0.3 : 0); return [r, r]; },
    square: function (t) { return t < 0.15 ? 6 : 2; } });
  g.add(new THREE.Mesh(geo, mat(o.boot || COL.apcGreen, { rough: 0.45, grain: 0.05 })));
  named(g, "plug:SC/APC", { type: "fiber", connector: "SC/APC" });
  g.userData.exitZ = -40; g.userData.cable = { r: 1.0, color: o.jacket == null ? 0xf0c419 : o.jacket, text: "OS2 9/125  ·  SINGLE-MODE  ·  G.657.A2  ·  2.0mm", ink: "rgba(30,30,30,0.6)" };
  return g;
}

/* the ragged end of a jacket cut badly: torn tongues of jacket and a few
   loose strands of the filler, as in the bad-termination photo */
function frayedEnd(z, r, color) {
  const g = new THREE.Group(), m = mat(color, { rough: 0.55 });
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * Math.PI * 2 + Math.sin(k * 3.1) * 0.25, len = 1.2 + (k * 7 % 5) * 0.55, w = 1.2 + (k % 3) * 0.5;
    const t = new THREE.Mesh(new THREE.PlaneGeometry(w, len), m); t.material = m.clone(); t.material.side = THREE.DoubleSide;
    t.position.set(Math.cos(a) * (r + 0.05 + (k % 2) * 0.25), Math.sin(a) * (r + 0.05 + (k % 2) * 0.25), z + len / 2 - 0.2);
    t.rotation.set(Math.PI / 2, 0, 0); t.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), a - Math.PI / 2); t.rotateX(0.25 + (k % 3) * 0.15);
    g.add(t);
  }
  /* loose fibres */
  const fm = new THREE.MeshStandardMaterial({ color: 0xe8e2cf, roughness: 0.9 });
  for (let k = 0; k < 6; k++) {
    const a = k * 1.7, p0 = V(Math.cos(a) * 1.2, Math.sin(a) * 1.2, z);
    const curve = new THREE.CatmullRomCurve3([p0, p0.clone().add(V(Math.cos(a) * 1.5, Math.sin(a) * 1.2, 2.5)), p0.clone().add(V(Math.cos(a) * 3.2, Math.sin(a) * 2.8 - 1, 4.5 + k * 0.4))]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.07, 5), fm));
  }
  return g;
}

/* ---- lying on the bench: a plug rests on its underside, its cable
   running on along the bench (run points are plug-local: [x, y, dz] back
   from the jacket's end, y dropping to the bench) ---- */
export function onBench(make, lift) {
  const g = new THREE.Group(), p = make(); p.position.y = lift; g.add(p);
  return g;
}
