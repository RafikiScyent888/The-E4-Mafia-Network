/* =====================================================================
   The technician's tools, matched to the owner's photographs (10
   October 2026): the cable tester (main and remote, joined by a short
   patch cable, every pair passing), the RJ45/RJ11 crimper, the 110
   punch-down, the tone generator and inductive probe, the RJ45
   loopback plug, and the electronics screwdriver set on its ESD mat
   with tweezers. Real millimetres; each lies or stands on y = 0 as
   photographed. Brand names are left off; garbled screen text in the
   photos is replaced with the correct wording.
   ===================================================================== */
import * as THREE from "three";
import { COL, mat, rbox, box, cyl, at, named, text, COVERED, led, ledPipe, rj45Jack, screw } from "./parts.js";
import { rj45Plug, plugInto, cableFrom, clearPlastic, GOLD } from "./cables.js";
import { tubeVar, wireTube } from "./cable-kit.js";
import { plastic, gloss, brushed, paintedSteel, rubber, label, perforated } from "./surface.js";

const V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
const lerp = THREE.MathUtils.lerp;
const OFFWHITE = 0xe2dfd3;                       /* the tester's and tone set's well-used off-white */
/* a flat 2D outline, extruded upward, lying on the bench (shape x -> x, shape y -> -z) */
function slab(shape, depth, m, bevel) {
  const b = bevel == null ? 1.2 : bevel;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.1, depth - 2 * b), bevelEnabled: b > 0, bevelSize: b, bevelThickness: b, bevelSegments: 3, curveSegments: 24 });
  const mesh = new THREE.Mesh(geo, m); mesh.rotation.x = -Math.PI / 2; mesh.position.y = b; return mesh;
}
function outline(pts, smooth) {
  const s = new THREE.Shape();
  if (smooth) { s.moveTo(pts[0][0], pts[0][1]); s.splineThru(pts.slice(1).concat([pts[0]]).map(function (q) { return new THREE.Vector2(q[0], q[1]); })); }
  else pts.forEach(function (q, i) { if (i) s.lineTo(q[0], q[1]); else s.moveTo(q[0], q[1]); });
  s.closePath(); return s;
}
/* a screen: a canvas drawn by fn, glowing (not lit by the room) */
function screen(w, h, fn, px) {
  px = px || 12; const c = document.createElement("canvas"); c.width = Math.ceil(w * px); c.height = Math.ceil(h * px); fn(c.getContext("2d"), c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }));
}
/* an LCD's characters: dark segments on a grey-green ground */
function lcdText(g, lines, W, H, o = {}) {
  g.fillStyle = o.bg || "#c6d3c9"; g.fillRect(0, 0, W, H);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "rgba(255,255,255,0.18)"); gr.addColorStop(1, "rgba(0,0,0,0.08)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = o.ink || "#1d2b2a"; g.textBaseline = "middle";
  const lh = H / lines.length;
  lines.forEach(function (l, i) {
    if (l === "BAR") { const n = 16; for (let k = 0; k < n; k++) g.fillRect(W * 0.05 + k * W * 0.9 / n, i * lh + lh * 0.25, W * 0.9 / n * 0.78, lh * 0.5); return; }
    g.font = "600 " + (lh * 0.62) + "px 'DejaVu Sans Mono', Consolas, monospace"; let fs = lh * 0.62; const wd = g.measureText(l).width;
    if (wd > W * 0.92) { fs *= W * 0.92 / wd; g.font = "600 " + fs + "px 'DejaVu Sans Mono', Consolas, monospace"; }
    g.fillText(l, W * 0.04, (i + 0.5) * lh);
  });
}

/* ---------------------------------------------------- cable tester */
/* Main unit and remote, standing, as photographed: the off-white cases,
   the main's LCD (CAT6 TEST, T568B, the progress bar full, every pin
   and the ground passing), the green panels with a light per pin (1-8
   and G) all lit, MAIN and REMOTE, the PASS - ALL PAIRS status window,
   and the short black patch cable joining them, plugged into each. */
export function cableTester() {
  const g = new THREE.Group(), case_ = plastic(OFFWHITE, { rough: 0.6, grain: 0.1 });
  /* the main unit */
  const M = new THREE.Group(); M.name = "panel:Main unit"; at(M, -64, 0, 0, 0, 0.12, 0); g.add(M);
  const MW = 78, MH = 104, MD = 30;
  M.add(at(rbox(MW, MH, MD, 7, case_), 0, MH / 2, 0));
  M.add(at(rbox(MW - 6, MH - 6, 1, 6, plastic(0xd8d4c6, { rough: 0.65 })), 0, MH / 2, MD / 2 - 0.2));
  /* the LCD in its dark bezel */
  M.add(at(rbox(66, 46, 1.6, 4, plastic(0x3a3d40, { rough: 0.45 })), 0, MH - 28, MD / 2 + 0.4));
  const lcd = screen(58, 37, function (c, W, H) { lcdText(c, ["CAT6 TEST - T568B", "Progress: 100%", "BAR", "1 2 3 4 5 6 7 8 G", "PASS: 1-8, G"], W, H, { bg: "#c9d6d2" }); });
  lcd.position.set(0, MH - 28, MD / 2 + 1.25); M.add(lcd);
  M.add(at(new THREE.Mesh(new THREE.PlaneGeometry(58, 37), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0.05, clearcoat: 1 })), 0, MH - 28, MD / 2 + 1.35));
  /* the green panel: MAIN, a fault row (unlit), the pass row (lit), the numbers, the status window */
  testerPanel(M, 68, 44, 0, 28, MD / 2 + 0.3, "MAIN");
  const mj = rj45Jack({ name: "MAIN", leds: false, insert: 0xd8d4c6 }); at(mj, MW / 2 - 0.2, 33, 0, 0, Math.PI / 2, 0); M.add(mj);
  [-1, 1].forEach(function (sd) { M.add(at(box(6, 4, 0.5, mat(0x9b988d)), sd * 26, 2.1, 0, Math.PI / 2, 0, 0)); });
  /* the remote */
  const R = new THREE.Group(); R.name = "panel:Remote unit"; at(R, 60, 0, -14, 0, -0.05, 0); g.add(R);
  const RW = 104, RH = 54, RD = 30;
  R.add(at(rbox(RW, RH, RD, 7, case_), 0, RH / 2, 0));
  R.add(at(rbox(RW - 6, RH - 6, 1, 6, plastic(0xd8d4c6, { rough: 0.65 })), 0, RH / 2, RD / 2 - 0.2));
  testerPanel(R, 90, 40, 0, RH / 2, RD / 2 + 0.3, "REMOTE");
  const rj = rj45Jack({ name: "REMOTE", leds: false, insert: 0xd8d4c6 }); at(rj, -RW / 2 + 0.2, 24, 0, 0, -Math.PI / 2, 0); R.add(rj);
  /* the patch cable between them */
  const pa = plugInto(mj, rj45Plug({ standard: "T568B", jacket: 0x17181a, run: [[-0.5, -0.3, 5], [-4, -2.6, 13], [-10, -5.6, 21], [-14, -7.6, 28], [-15.5, -8.6, 33.5]] }));
  plugInto(rj, rj45Plug({ standard: "T568B", jacket: 0x17181a, jacketLen: 1.5 }));
  void pa;
  return named(g, "tool:Cable tester", { type: "cable-tester" });
}
function testerPanel(parent, w, h, x, y, z, name) {
  const p = new THREE.Group(); at(p, x, y, z); parent.add(p);
  p.add(rbox(w, h, 1.2, 4, plastic(0x1d6a3c, { rough: 0.5 })));
  const vt = text(name, 14, 4.2, { color: "#f2f4ee", weight: "700" }); vt.rotation.z = Math.PI / 2; p.add(at(vt, -w / 2 + 4.5, h / 2 - 15, 0.65));
  const x0 = -w / 2 + 12, step = (w - 18) / 8, labels = ["1", "2", "3", "4", "5", "6", "7", "8", "G"];
  labels.forEach(function (l, i) {
    const off = ledPipe(COL.ledRed, false); off.scale.set(1.1, 1.6, 1); p.add(at(off, x0 + i * step, h / 2 - 9, 0.75));
    const on = ledPipe(COL.ledGreen, true); on.scale.set(1.1, 1.6, 1); on.userData.role = "pin " + l; p.add(at(on, x0 + i * step, h / 2 - 16, 0.75));
    p.add(at(text(l, 4, 4, { color: "#f2f4ee", weight: "700" }), x0 + i * step, h / 2 - 22, 0.65));
  });
  /* the status window, backlit green */
  p.add(at(rbox(w - 10, 9, 0.6, 2.5, plastic(0x2f8a52, { rough: 0.4 })), 0, -h / 2 + 7, 0.65));
  p.add(at(screen(w - 14, 7, function (c, W, H) { c.fillStyle = "#2f8a52"; c.fillRect(0, 0, W, H); c.fillStyle = "#f4fff6"; c.font = "700 " + (H * 0.62) + "px Arial, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("PASS - ALL PAIRS (1-8, G)", W / 2, H / 2); }), 0, -h / 2 + 7, 1.0));
  return p;
}

/* -------------------------------------------------------- crimper */
/* The RJ45/RJ11 ratchet crimper lying flat, as photographed: the dark
   blue steel head with its 8P and 6P crimp dies, the cutting and
   stripping blades, the bolts, the ratchet; the slim blue upper handle
   with its black inset, the big black-gripped lower handle with blue
   edges. */
export function crimper() {
  /* Matched to the owner's photo: the long blue steel head lying flat, a
     raised black die block near its nose with the 8P and 6P die openings
     and its round black bolts, small rivets, RJ45/RJ11 CRIMP TOOL printed
     in white; the black core showing at its edges; the cutter and stripper
     at the pivot. The far handle: blue, a recessed black channel along
     its top, a black lever at the pivot. The near handle: chunky, a black
     rubber grip over its outer side with five finger grooves, the blue
     body along its top and round its rounded end. */
  const g = new THREE.Group();
  const steel = paintedSteel(0x1f4a9c, { rough: 0.32 }), blue = plastic(0x2b78d8, { rough: 0.38, grain: 0.08 }), blk = rubber(0x17181a);
  const hard = plastic(0x141517, { rough: 0.42 }), bright = brushed(0xd6d9dd, "x", { rough: 0.22 });
  /* ---- the head: blue plate top and bottom, black core between ---- */
  const hp = function (inset) {
    const k = inset || 0;
    return outline([[-10 + k, 15 - k], [60, 16 - k], [80 - k, 14 - k], [89 - k, 6], [89 - k, -6], [80 - k, -14 + k], [60, -16 + k], [-10 + k, -15 + k], [-16 + k, 0]], true);
  };
  const bot = slab(hp(), 4.5, steel, 1); g.add(bot);
  const core = slab(hp(1.6), 12, hard, 0.6); core.position.y = 4; g.add(core);
  const topP = slab(hp(), 4.5, steel, 1); topP.position.y = 15.5; g.add(topP);
  const H = 20;
  const top = new THREE.Group(); at(top, 0, H + 0.01, 0, -Math.PI / 2, 0, 0); g.add(top);   /* top-face coordinates: x along, y = -z (toward the far side) */
  /* the die block: a raised black plate with bolt bosses, the two die openings */
  const db = outline([[40, -11], [48, -13], [80, -12], [85, -6], [85, 7], [78, 12], [48, 13], [40, 10], [37, 0]], true);
  const dbm = new THREE.Mesh(new THREE.ExtrudeGeometry(db, { depth: 2.4, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.8, bevelSegments: 3, curveSegments: 20 }), hard);
  top.add(dbm);
  [[72, 1, 13, 10, 8], [53, 1, 10.5, 8.6, 6]].forEach(function (d) {
    const fr = rrShape(d[2] + 3, d[3] + 3, 1.4, d[0], d[1]); fr.holes.push(rrPath(d[2], d[3], 0.8, d[0], d[1]));
    top.add(at(new THREE.Mesh(new THREE.ExtrudeGeometry(fr, { depth: 1.4, bevelEnabled: true, bevelSize: 0.4, bevelThickness: 0.4, bevelSegments: 2 }), hard), 0, 0, 3.2));
    top.add(at(box(d[2], d[3], 0.2, mat(0x040405)), d[0], d[1], 2.0));
    for (let k = 0; k < d[4]; k++) top.add(at(box(0.6, d[3] * 0.42, 1.4, mat(0xc4c8cd, { metal: 1, rough: 0.25 })), d[0] - d[2] / 2 + 1.4 + k * (d[2] - 2.8) / (d[4] - 1), d[1] + d[3] * 0.22, 2.6));
    top.add(at(box(d[2] * 0.9, 1.2, 1.2, mat(0x9ca1a7, { metal: 1, rough: 0.3 })), d[0], d[1] - d[3] * 0.3, 2.5));   /* the anvil the plug's latch sits on */
  });
  const bolt = function (x, y, r) {
    const b = new THREE.Group(); at(b, x, y, 3.0); top.add(b);
    b.add(at(cyl(r, 1.6, hard, 28), 0, 0, 0.8, Math.PI / 2));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 0.92, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), hard); dome.rotation.x = Math.PI / 2; dome.scale.y = 0.45; dome.position.z = 1.6; b.add(dome);
  };
  bolt(44, -8, 3.2); bolt(44, 8.5, 3.2); bolt(62, 10.5, 2.8); bolt(81, -8.5, 2.8);
  /* small rivets on the blue, and the print */
  [[26, -10], [26, 10.5], [8, -9]].forEach(function (r) { const d = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3a5fae, { metal: 0.6, rough: 0.3 })); d.rotation.x = Math.PI / 2; d.scale.y = 0.4; d.position.set(r[0], r[1], 0); top.add(d); });
  top.add(at(text("RJ45/RJ11", 24, 3.6, { color: "#eef2f8", weight: "800" }), 22, 1.5, 0.05));
  top.add(at(text("CRIMP TOOL", 24, 3.2, { color: "#eef2f8", weight: "700" }), 22, -3.4, 0.05));
  /* ---- at the pivot: the black cutter housing, the silver blades, the pivot nut ---- */
  const ch = outline([[-6, -14], [-36, -16], [-44, -6], [-44, 8], [-34, 15], [-6, 14]], true);
  const chm = slab(ch, 15, hard, 1.2); chm.position.y = 3; g.add(chm);
  const blades = new THREE.Group(); at(blades, 0, 18.05, 0, -Math.PI / 2, 0, 0); g.add(blades);
  blades.add(at(box(24, 3.2, 0.6, bright), -22, -6.5, 0.3, 0, 0, 0.08));                 /* the cutting blade */
  blades.add(at(box(8, 3.8, 0.6, bright), -14, 6, 0.3, 0, 0, 0.5)); blades.add(at(box(8, 3.8, 0.6, bright), -26, 6, 0.3, 0, 0, -0.5));   /* the stripper's two blades */
  blades.add(at(box(22, 1.4, 0.4, mat(0x040405)), -22, -9, 0.2));
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 2.6, 6), mat(0xb9bdc2, { metal: 0.9, rough: 0.3 })); nut.position.set(-3, H + 1, 0); g.add(nut);
  g.add(at(cyl(2, 0.4, mat(0x5a5e64, { metal: 0.9 }), 16), -3, H + 2.4, 0));
  /* ---- the handles: tubes with rounded-rectangle sections, closed at their ends ---- */
  const close = function (t, t0, t1) { const a = t < t0 ? t / t0 : t > t1 ? (1 - t) / (1 - t1) : 1; return Math.max(0.08, Math.sqrt(Math.max(0, 1 - (1 - a) * (1 - a)))); };
  const handle = function (pts, rx, ry, o) {
    const curve = new THREE.CatmullRomCurve3(pts.map(function (q) { return V(q[0], q[1], q[2]); }), false, "centripetal");
    return new THREE.Mesh(tubeVar(curve, Object.assign({ n: 260, m: 72, up: V(0, 1, 0), square: function () { return o.sq || 3.4; },
      radius: function (t) { const e = close(t, o.c0 || 0.04, o.c1 || 0.94); return [rx(t) * e, ry(t) * e]; } }, o.tube || {})), o.mat);
  };
  /* the far handle (blue, the black channel along its top) */
  const farPts = [[-30, 9, -9], [-70, 9, -14.5], [-120, 9, -23], [-176, 9, -34]];
  const frx = function (t) { return lerp(7.6, 8.4, t); }, fry = function () { return 8.6; };
  const slot = function (t, a) { const d = Math.atan2(Math.sin(a), Math.cos(a)); return t > 0.18 && t < 0.9 && Math.abs(d) < 0.3; };
  g.add(handle(farPts, frx, fry, { mat: blue, tube: { hole: slot } }));
  g.add(handle(farPts, function (t) { return frx(t) - 2.4; }, function () { return 6.4; }, { mat: hard, c0: 0.16, c1: 0.92 }));   /* the channel's floor, seen through the slot */
  g.add(handle([[-2, 8.5, -6], [-22, 8.5, -8], [-44, 8.5, -11.5]], function () { return 6.6; }, function () { return 7.6; }, { mat: hard, c0: 0.06, c1: 0.8 }));   /* the black lever at the pivot */
  /* the near handle: blue body, black grip over its outer side and underside, finger grooves */
  const nearPts = [[-14, 12, 9], [-60, 12, 15], [-110, 12, 25], [-158, 12, 37], [-186, 12, 43]];
  const nrx = function (t) { return t < 0.3 ? lerp(10.5, 13, t / 0.3) : lerp(13, 12, (t - 0.3) / 0.7); }, nry = function (t) { return t < 0.3 ? lerp(10.5, 12, t / 0.3) : 12; };
  const isBlue = function (t, a) {
    const c = Math.cos(a), sn = Math.sin(a);                       /* sn > 0: the inner side (toward the far handle); c > 0: the top */
    if (t > 0.88) return c > -0.15;                                /* the rounded end: blue over the top */
    return (c > -0.25 && sn > -0.42) || (t < 0.14 && c > 0);       /* the top and inner side; near the pivot, the whole top */
  };
  const grooves = function (t, a) {
    const sn = Math.sin(a), c = Math.cos(a);
    if (sn > -0.55 || c > 0.7 || t < 0.3 || t > 0.84) return 0;
    const w = Math.pow(Math.abs(Math.sin((t - 0.3) / 0.108 * Math.PI)), 1.6);
    return -1.5 * w * Math.min(1, (-sn - 0.55) / 0.3);
  };
  g.add(handle(nearPts, nrx, nry, { mat: blue, tube: { hole: function (t, a) { return !isBlue(t, a); } } }));
  g.add(handle(nearPts, function (t) { return nrx(t) + 0.7; }, function (t) { return nry(t) + 0.7; }, { mat: blk, tube: { hole: isBlue, bump: grooves } }));
  /* the spring between the handles, and the ratchet pawl */
  const spring = []; for (let k = 0; k <= 60; k++) { const t = k / 60, a = t * Math.PI * 2 * 7; spring.push(V(-40 - t * 22, 10 + Math.cos(a) * 2.2, lerp(-6, 7, t) + Math.sin(a) * 2.2)); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spring), 240, 0.45, 6), mat(0x9ea3a8, { metal: 1, rough: 0.3 })));
  g.add(at(box(14, 3, 5, bright), -26, 4, 4, 0, 0.25, 0));
  g.rotation.y = 0.35;
  return named(g, "tool:Crimper", { type: "crimper", dies: ["8P8C", "6P6C"] });
}
/* rounded rectangles as a shape or a hole, centred on cx, cy */
function rrPts(w, h, r, cx, cy, p) {
  const x = (cx || 0) - w / 2, y = (cy || 0) - h / 2; r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r); p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r); p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y); return p;
}
function rrShape(w, h, r, cx, cy) { return rrPts(w, h, r, cx, cy, new THREE.Shape()); }
function rrPath(w, h, r, cx, cy) { return rrPts(w, h, r, cx, cy, new THREE.Path()); }

/* ---------------------------------------------------- punch-down */
/* The 110 punch-down tool lying on its side: the grey ribbed body, the
   110 label at the back, the yellow impact sleeve, the black collar,
   and the 110 blade (its cutting side marked) sticking out. */
export function punchDown() {
  const g = new THREE.Group(), grey = plastic(0xb6b9bc, { rough: 0.55, grain: 0.12 }), yel = plastic(0xf2c200, { rough: 0.45 });
  const L = 120, Ht = 22, Wd = 26;
  g.add(at(rbox(L, Ht, Wd, 6, grey), -20, Ht / 2, 0));
  for (let k = 0; k < 12; k++) g.add(at(box(1.6, 0.8, Wd - 8, mat(0x8d9094, { rough: 0.7 })), -66 + k * 5, Ht + 0.1, 0));   /* the grip ribs */
  g.add(at(rbox(14, Ht + 0.6, Wd + 0.6, 6, plastic(0xe9e9e4, { rough: 0.5 })), -84, Ht / 2, 0));                      /* the end cap */
  /* the 110 label */
  const lab = new THREE.Group(); at(lab, -48, Ht + 0.12, 0, -Math.PI / 2, 0, Math.PI / 2); g.add(lab);
  lab.add(rbox(12, 26, 0.3, 1, yel));
  lab.add(at(text("110", 10, 6, { color: "#1b1b1b", weight: "900" }), 0, 7, 0.2)); lab.add(at(text("PUNCH\nDOWN", 10, 7, { color: "#1b1b1b", weight: "700" }), 0, -4, 0.2));
  /* the yellow sleeve, the collar, the blade */
  g.add(at(rbox(34, Ht + 1.2, Wd + 1.2, 6, yel), 48, Ht / 2, 0));
  g.add(at(cyl(8, 10, plastic(0x1b1c1e, { rough: 0.45 }), 32), 70, Ht / 2, 0, 0, 0, Math.PI / 2));
  g.add(at(cyl(5, 4, mat(0x2a2c30, { metal: 0.6, rough: 0.35 }), 6), 77, Ht / 2, 0, 0, 0, Math.PI / 2));
  const bl = new THREE.Shape(); bl.moveTo(0, -3.2); bl.lineTo(26, -3.2); bl.lineTo(30, 0.4); bl.lineTo(30, 3.2); bl.lineTo(0, 3.2); bl.closePath();
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bl, { depth: 3, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 1 }), brushed(0xd3d6da, "x", { rough: 0.28 }));
  blade.position.set(78, Ht / 2, -1.5); g.add(blade);
  g.add(at(text("CUT", 5, 2.2, { color: "#30343a", weight: "700" }), 90, Ht / 2 + 3.3, 0, -Math.PI / 2, 0, 0));
  g.rotation.y = -0.6;
  return named(g, "tool:110 punch-down", { type: "punch-down", blade: "110" });
}

/* ------------------------------------- tone generator and probe */
/* The tone generator lying face up, matched to the owner's photo: the
   off-white case in two halves with the seam between, the raised rim
   round the dark grey face, the big LCD in its frame, TONE GENERATOR,
   the glossy red power key, MODE, the grey ring round the four arrow
   keys and OK; the thick lead with its ribbed strain relief out of the
   bottom, the thin line lead out of the top. */
export function toneGenerator() {
  const g = new THREE.Group(), W = 76, L = 138, case_ = plastic(OFFWHITE, { rough: 0.55, grain: 0.1 }), case2 = plastic(0xd9d6ca, { rough: 0.6, grain: 0.1 });
  const plan = function (w, l, r) { return rrShape(w, l, r); };   /* plan shapes: x across, y along (y = -z: the top end away from you) */
  const lower = slab(plan(W, L, 13), 14, case2, 3.5); g.add(lower);
  const upper = slab(plan(W - 1.6, L - 1.6, 12.4), 17.5, case_, 4.5); upper.position.y = 14.4; g.add(upper);
  g.add(at(rbox(W - 3.4, 0.9, L - 3.4, 11, mat(0x7c7a72, { rough: 0.9 })), 0, 14.3, 0));                       /* the seam between the halves */
  const TOP = 31.9;
  /* the face: a dark panel sunk inside a raised off-white rim */
  const rim = plan(W - 6, L - 8, 10); rim.holes.push(rrPath(W - 15, L - 18, 6.5, 0, -1.5));
  const rm = new THREE.Mesh(new THREE.ExtrudeGeometry(rim, { depth: 0.6, bevelEnabled: true, bevelSize: 0.9, bevelThickness: 0.9, bevelSegments: 3, curveSegments: 16 }), case_);
  rm.rotation.x = -Math.PI / 2; rm.position.y = TOP - 0.2; g.add(rm);
  const face = new THREE.Group(); face.name = "panel:Tone face"; at(face, 0, TOP + 0.02, 0, -Math.PI / 2, 0, 0); g.add(face);   /* face coordinates: x across, y toward the top end */
  face.add(at(new THREE.Mesh(new THREE.ShapeGeometry(rrShape(W - 15, L - 18, 6.5, 0, -1.5), 16), plastic(0x50555b, { rough: 0.5 })), 0, 0, 0.02));
  /* the LCD: a black frame, the grey-green glass, segment characters */
  face.add(at(rbox(58, 34, 1.4, 3, plastic(0x26292c, { rough: 0.4 })), 0, 40, 0.7));
  face.add(at(screen(52, 27, function (c, W2, H2) {
    c.fillStyle = "#aeb9ad"; c.fillRect(0, 0, W2, H2); const gr = c.createLinearGradient(0, 0, W2, H2); gr.addColorStop(0, "rgba(255,255,255,0.25)"); gr.addColorStop(0.5, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(0,0,0,0.1)"); c.fillStyle = gr; c.fillRect(0, 0, W2, H2);
    c.fillStyle = "#1e2a26"; c.textBaseline = "middle"; c.font = "700 " + (H2 * 0.3) + "px 'DejaVu Sans Mono', monospace"; c.fillText("TONE", W2 * 0.06, H2 * 0.3);
    c.font = "600 " + (H2 * 0.17) + "px Arial, sans-serif"; c.fillText("ALT ∿", W2 * 0.06, H2 * 0.68); c.fillText("LINE  OPEN", W2 * 0.46, H2 * 0.68);
    c.fillRect(W2 * 0.78, H2 * 0.12, W2 * 0.14, H2 * 0.22); c.fillStyle = "#aeb9ad"; c.fillRect(W2 * 0.79, H2 * 0.15, W2 * 0.12, H2 * 0.16); c.fillStyle = "#1e2a26"; c.fillRect(W2 * 0.79, H2 * 0.15, W2 * 0.09, H2 * 0.16); c.fillRect(W2 * 0.92, H2 * 0.18, W2 * 0.02, H2 * 0.1);   /* the battery */
    for (let k = 0; k < 6; k++) c.fillRect(W2 * (0.5 + k * 0.045), H2 * (0.42 - k * 0.035), W2 * 0.03, H2 * (0.08 + k * 0.035));   /* the signal bars */
  }, 14), 0, 40, 1.45));
  face.add(at(new THREE.Mesh(new THREE.PlaneGeometry(53, 28), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.04, clearcoat: 1 })), 0, 40, 1.5));
  face.add(at(text("TG-200", 14, 2.6, { color: "#d6d9dc", weight: "700" }), 22, 59.3, 0.05));
  face.add(at(text("TONE GENERATOR", 46, 4, { color: "#eef0f2", weight: "800", spacing: 0.05 }), 2, 19, 0.05));
  /* the keys */
  const key = function (shape, x, y, color, h, label, lc, ls) {
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: 0.7, bevelThickness: 0.7, bevelSegments: 3, curveSegments: 18 }), gloss(color, { rough: 0.22 }));
    m.position.set(x, y, 0.1); face.add(m);
    if (label) face.add(at(text(label, ls || 6, ls || 6, { color: lc || "#f4f4f4", weight: "900" }), x, y, h + 0.85));
    return m;
  };
  key(rrShape(15, 8.5, 3), -19, 8, 0xd6302a, 2.2, "⏻", "#ffffff", 5.5);
  key(rrShape(13, 6.5, 3.2), 20, 8.5, 0x2e3135, 1.8); face.add(at(text("MODE", 9, 2.6, { color: "#eef0f2", weight: "800" }), 20, 8.5, 2.65));
  const ring = new THREE.Shape(); ring.absarc(0, 0, 20, 0, Math.PI * 2, false); const rh = new THREE.Path(); rh.absarc(0, 0, 16.6, 0, Math.PI * 2, true); ring.holes.push(rh);
  face.add(at(new THREE.Mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.8, bevelEnabled: true, bevelSize: 0.6, bevelThickness: 0.6, bevelSegments: 3, curveSegments: 64 }), plastic(0xbfbdb4, { rough: 0.45 })), 0, -16, 0.1));
  const petal = function (a0) {
    const sh = new THREE.Shape(), r0 = 8.2, r1 = 15.6, da = 0.62;
    sh.absarc(0, 0, r1, a0 - da, a0 + da, false); sh.absarc(0, 0, r0, a0 + da * 1.1, a0 - da * 1.1, true); sh.closePath(); return sh;
  };
  [[Math.PI / 2, "▲"], [-Math.PI / 2, "▼"], [Math.PI, "◀"], [0, "▶"]].forEach(function (p) {
    key(petal(p[0]), 0, -16, 0x2e3135, 2.3);
    face.add(at(text(p[1], 4, 4, { color: "#f2f2f2", weight: "900" }), Math.cos(p[0]) * 11.8, -16 + Math.sin(p[0]) * 11.8, 3.15));
  });
  const ok = new THREE.Shape(); ok.absellipse(0, 0, 6.6, 5.2, 0, Math.PI * 2, false); key(ok, 0, -16, 0x2a2d31, 2.6, "OK", "#f2f2f2", 4.2);
  /* the leads: the thick one with its ribbed strain relief out of the bottom, the thin one out of the top */
  const boss = new THREE.Group(); at(boss, 0, 16, L / 2 - 1, 0, 0, 0); g.add(boss);
  boss.add(at(cyl(9, 4, case2, 32), 0, 0, 1.5, Math.PI / 2));
  const srL = 26, sr = tubeVar(new THREE.LineCurve3(V(0, 0, 2), V(0, 0, 2 + srL)), { n: 120, m: 32, up: V(0, 1, 0),
    radius: function (t) { const z = t * srL, r = lerp(7.4, 3.6, Math.min(1, z / 22)) + (z > 3 && z < 24 && Math.sin(z * 1.5) > 0.2 ? 0.75 : 0); return [r, r]; } });
  boss.add(new THREE.Mesh(sr, rubber(0x141516)));
  const lead = new THREE.Group(); at(lead, 0, 0, 2 + srL - 1, 0, Math.PI, 0); boss.add(lead);
  lead.userData.exitZ = 0; lead.userData.cable = { r: 3.0, color: 0x141516, text: "TEST LEAD  ·  RJ11/RJ45  ·  26AWG", ink: "rgba(220,220,220,0.35)" };
  cableFrom(g, lead, [[-12, 3, L / 2 + 70], [-40, 3, L / 2 + 120], [-90, 3, L / 2 + 170]], { straight: 10 });
  const tl = new THREE.Group(); at(tl, 26, 18, -L / 2 + 6, 0, Math.PI, 0); g.add(tl);
  tl.add(at(cyl(4.2, 6, rubber(0x141516), 20), 0, 0, -3, Math.PI / 2));
  const tlead = new THREE.Group(); at(tlead, 0, 0, -6, 0, 0, 0); tl.add(tlead); tlead.rotation.y = Math.PI;
  tlead.userData.exitZ = 0; tlead.userData.cable = { r: 1.8, color: 0x141516, text: "LINE LEAD", ink: "rgba(220,220,220,0.3)" };
  cableFrom(g, tlead, [[30, 6, -L / 2 - 40], [24, 1.8, -L / 2 - 90], [-10, 1.8, -L / 2 - 190]], { straight: 8 });
  return named(g, "tool:Tone generator", { type: "tone-generator" });
}
/* The inductive probe lying face up, matched to the photo: the round
   speaker head with its slots at the back, the long two-part off-white
   body tapering to the nose, the dark grey face with INDUCTIVE PROBE,
   the push button in its raised surround, the volume mark, the green
   light by the nose, the black tip. */
export function inductiveProbe() {
  const g = new THREE.Group(), case_ = plastic(OFFWHITE, { rough: 0.55, grain: 0.1 }), case2 = plastic(0xd9d6ca, { rough: 0.6, grain: 0.1 });
  /* the plan outline: half-width w(x) from the back of the speaker head (x = -126) to the nose (x = 98) */
  const w = function (x) {
    if (x < -100) { const d = x + 100; return Math.sqrt(Math.max(0, 25 * 25 - d * d)); }
    if (x < -80) return lerp(25, 17.5, (1 - Math.cos((x + 100) / 20 * Math.PI)) / 2);
    if (x < 36) return lerp(17.5, 15, (x + 80) / 116);
    if (x < 92) return lerp(15, 6.5, Math.pow((x - 36) / 56, 1.25));
    const d = (x - 92) / 6; return 6.5 * Math.sqrt(Math.max(0, 1 - d * d));
  };
  const plan = function (inset) {
    const pts = [];
    for (let x = -124.9 + inset; x <= 97.9 - inset; x += 1.5) pts.push([x, Math.max(0.3, w(x) - inset)]);
    const back = pts.slice().reverse().map(function (q) { return [q[0], -q[1]]; });
    return outline(pts.concat(back), false);
  };
  const lower = slab(plan(0), 10.5, case2, 3); g.add(lower);
  const upper = slab(plan(0.8), 14.5, case_, 4.6); upper.position.y = 10.8; g.add(upper);
  g.add(at(new THREE.Mesh(new THREE.ExtrudeGeometry(plan(1.6), { depth: 0.8, bevelEnabled: false }), mat(0x7c7a72, { rough: 0.9 })), 0, 10.3, 0, -Math.PI / 2, 0, 0));   /* the seam */
  const TOP = 25.3;
  const face = new THREE.Group(); face.name = "panel:Probe face"; at(face, 0, TOP + 0.02, 0, -Math.PI / 2, 0, 0); g.add(face);   /* x along, y = -z */
  /* the speaker head: a raised disc with its slots */
  face.add(at(cyl(19.5, 1.4, case_, 64), -100, 0, 0.5, Math.PI / 2));
  for (let k = 0; k < 9; k++) { const x = -112 + k * 3; const half = Math.sqrt(Math.max(0, 15.5 * 15.5 - (x + 100) * (x + 100))); if (half < 3) continue;
    face.add(at(rbox(1.3, half * 2, 0.6, 0.6, mat(0x45484c, { rough: 0.85 })), x, 0, 1.25)); }
  /* the face panel */
  const fp = rrShape(100, 25.5, 6, -24, 0);
  face.add(at(new THREE.Mesh(new THREE.ExtrudeGeometry(fp, { depth: 0.5, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 2 }), plastic(0x50555b, { rough: 0.5 })), 0, 0, 0));
  /* the name runs along the body, two lines, as photographed */
  face.add(at(text("INDUCTIVE", 40, 7, { color: "#eef0f2", weight: "800", spacing: 0.04 }), -52, 4.6, 0.85));
  face.add(at(text("PROBE", 40, 7, { color: "#eef0f2", weight: "800", spacing: 0.04 }), -52, -4.4, 0.85));
  const sur = rrShape(21, 15, 6.5, -22, 0); sur.holes.push(rrPath(15.5, 9.5, 4.5, -22, 0));
  face.add(at(new THREE.Mesh(new THREE.ExtrudeGeometry(sur, { depth: 1.4, bevelEnabled: true, bevelSize: 0.6, bevelThickness: 0.6, bevelSegments: 3, curveSegments: 16 }), case_), 0, 0, 0.5));
  const btn = new THREE.Mesh(new THREE.ExtrudeGeometry(rrShape(14, 8.5, 4.2, -22, 0), { depth: 1.8, bevelEnabled: true, bevelSize: 0.7, bevelThickness: 0.7, bevelSegments: 3, curveSegments: 16 }), plastic(0xebe8de, { rough: 0.45 }));
  btn.position.z = 0.6; face.add(btn); named(btn, "button:PROBE", { type: "button" });
  /* the volume mark: a speaker with its arcs, in green and white */
  face.add(at(screen(16, 11, function (c, W2, H2) {
    c.clearRect(0, 0, W2, H2); c.lineWidth = H2 * 0.09; c.strokeStyle = "#7fe07a"; c.fillStyle = "#eef0f2";
    c.beginPath(); c.moveTo(W2 * 0.12, H2 * 0.4); c.lineTo(W2 * 0.25, H2 * 0.4); c.lineTo(W2 * 0.4, H2 * 0.22); c.lineTo(W2 * 0.4, H2 * 0.78); c.lineTo(W2 * 0.25, H2 * 0.6); c.lineTo(W2 * 0.12, H2 * 0.6); c.closePath(); c.fill();
    [0.25, 0.4].forEach(function (r) { c.beginPath(); c.arc(W2 * 0.42, H2 * 0.5, H2 * r * 1.4, -0.9, 0.9); c.stroke(); });
    c.fillStyle = "#7fe07a"; c.beginPath(); c.arc(W2 * 0.88, H2 * 0.5, H2 * 0.13, 0, Math.PI * 2); c.fill();
  }, 20), 2, 0, 0.85));
  face.children[face.children.length - 1].material.transparent = true;
  face.add(at(text("VOL", 8, 2.6, { color: "#c9ccd0", weight: "700" }), 16, -6.5, 0.85));
  const gl = led(COL.ledGreen, true, 1.5); gl.userData.role = "power"; face.add(at(gl, 44, 0, 0.4));
  face.add(at(new THREE.Mesh(new THREE.RingGeometry(1.6, 2.4, 24), case2), 44, 0, 0.35));
  /* the tip: a black cone out of the nose, rounded at its point */
  const tp = new THREE.Group(); at(tp, 96, 12.5, 0, 0, 0, -Math.PI / 2); g.add(tp);
  tp.add(at(cyl(5.2, 5, plastic(0x141516, { rough: 0.35 }), 28), 0, 1, 0));
  const cone = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(5, 0), new THREE.Vector2(4.6, 6), new THREE.Vector2(2.6, 20), new THREE.Vector2(1.3, 27), new THREE.Vector2(0.6, 28.4), new THREE.Vector2(0, 28.8)], 32), plastic(0x141516, { rough: 0.32 }));
  cone.position.y = 3.5; tp.add(cone);
  return named(g, "tool:Inductive probe", { type: "inductive-probe" });
}

/* ---------------------------------------------------- loopback */
/* The RJ45 loopback plug: a clear plug whose wires run in from one pin
   and turn round inside to another (1 to 3, 2 to 6, and for gigabit 4
   to 7, 5 to 8), so a port sees its own transmit on its receive; a grey
   moulded hood at the back. */
export function loopbackPlug() {
  const g = new THREE.Group(), cp = clearPlastic(), L = 21.5, W = 11.7, H = 8, zF = L / 2, zR = -L / 2;
  g.add(at(rbox(W, H, L - 6, 0.7, cp), 0, 0, 3));
  g.add(at(rbox(W + 0.6, H + 0.5, 6.2, 0.8, cp), 0, 0.1, zR + 3.1));
  for (let k = 0; k <= 8; k++) g.add(at(box(0.36, 1.0, 4.8, cp), (k - 4) * 1.02, H / 2 + 0.2, zF - 2.6));
  const latch = new THREE.Group(); latch.add(at(box(6.4, 0.9, 13.5, cp), 0, 0, -6.75)); latch.add(at(box(7.4, 0.9, 3.2, cp), 0, -0.55, -13.4, -0.35, 0, 0));
  latch.position.set(0, -H / 2 - 0.4, zF - 3); latch.rotation.x = 0.16; g.add(latch);
  const pinX = function (i) { return (3.5 - i) * 1.02; };
  for (let i = 0; i < 8; i++) { g.add(at(box(0.3, 2.6, 3.6, GOLD), pinX(i), H / 2 - 1.15, zF - 2.4)); g.add(at(box(0.72, 0.25, 3.2, GOLD), pinX(i), H / 2 + 0.05, zF - 2.4)); }
  /* the loops: in at one pin, round, out at the other */
  [[0, 2, "white/orange", 0.4], [1, 5, "orange", -0.4], [3, 6, "blue", 1.2], [4, 7, "white/blue", -1.1]].forEach(function (lp, k) {
    const a = pinX(lp[0]), b = pinX(lp[1]), y = 1.15, zt = zR + 1.5 - k * 0.35, yb = -0.8 + lp[3];
    const pts = [V(a, y, zF - 0.5), V(a, y, zF - 6), V(a, (y + yb) / 2, zt + 4), V((a + b) / 2 + lp[3] * 0.4, yb, zt), V(b, (y + yb) / 2, zt + 4), V(b, y, zF - 6), V(b, y, zF - 0.5)];
    g.add(wireTube(pts, lp[2], 0.45, 90));
  });
  g.add(at(box(7.6, 1.5, 3.4, cp), 0, -H / 2 + 0.85, zR + 3.2));
  /* the hood */
  const hood = tubeVar(new THREE.LineCurve3(V(0, 0, zR + 1), V(0, 0, zR - 12)), { n: 60, m: 40, up: V(0, 1, 0), radius: function (t) { const z = t * 13, k = Math.min(1, z / 9); return [lerp(W / 2 + 0.9, 4.2, k * k), lerp(H / 2 + 0.9, 3.6, k * k)]; }, square: function (t) { return lerp(7, 3, t); } });
  g.add(new THREE.Mesh(hood, plastic(0x9a9ea3, { rough: 0.5 })));
  const end = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), plastic(0x9a9ea3, { rough: 0.5 })); end.scale.set(4.2, 2.2, 3.6); end.rotation.x = -Math.PI / 2; end.position.z = zR - 12; g.add(end);
  g.add(at(text("LOOPBACK", 9, 1.8, { color: "#2a2d31", weight: "800" }), 0, 3.6, zR - 6, -Math.PI / 2 + 0.25, 0, 0));
  named(g, "plug:RJ45 loopback", { type: "loopback", pairs: [[1, 3], [2, 6], [4, 7], [5, 8]] });
  return g;
}

/* ------------------------------------- screwdriver set, ESD mat */
/* The electronics screwdriver set on its ESD mat, matched to the owner's
   photo: the aluminium case with its rounded corners and the recessed
   grey plate in front, the black stepped holder with four rows of 4 mm
   bits (each tip shaped for its type: Phillips, flat, Torx, hex,
   pentalobe, tri-point, square, spanner), the sizes printed on each step,
   the lid open on its hinge with its clasp and the printed chart; the
   driver (soft black contoured grip, blue swivel cap, blue collar,
   aluminium ferrule, a bit in it) resting on the bits; ESD tweezers with
   bare steel tips; a black parts tray of screws; the blue mat on the
   white bench with its grounding snap. Brand marks are left off. */
export function screwdriverKit() {
  const g = new THREE.Group();
  g.add(at(box(780, 20, 540, mat(0xeeeeeb, { rough: 0.45, grain: 0.04 })), -40, -10, 0));                       /* the white bench */
  const MAT = 2;
  const matM = mat(0x2d4b6f, { rough: 0.88, grain: 0.2, scale: 0.7 });
  g.add(at(rbox(430, MAT, 300, 1, matM), 30, MAT / 2, 15));
  const snap = new THREE.Group(); at(snap, -170, MAT, 150); g.add(snap);
  snap.add(at(cyl(6, 1.2, mat(0xc9ccd0, { metal: 1, rough: 0.25 }), 28), 0, 0.6, 0)); snap.add(at(new THREE.Mesh(new THREE.SphereGeometry(3.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xc9ccd0, { metal: 1, rough: 0.25 })), 0, 1.2, 0));
  g.add(at(text("ESD SAFE  ·  10⁶–10⁹ Ω  ·  GROUND HERE →", 70, 4, { color: "#b9c8db", weight: "600" }), -122, MAT + 0.05, 150, -Math.PI / 2, 0, 0));
  const shank = mat(0xb9bdc2, { metal: 0.95, rough: 0.26 }), shank2 = mat(0x9ea3a9, { metal: 0.95, rough: 0.32 });
  /* ---- the case ---- */
  const C = new THREE.Group(); C.name = "panel:Bit case"; at(C, 80, MAT, -10, 0, -0.3, 0); g.add(C);
  const CW = 128, CH = 24, CD = 80, alu = brushed(0xcdd0d4, "x", { rough: 0.3, metal: 0.85 });
  const outer = rrShape(CW, CD, 8), inner = rrPath(CW - 5, CD - 5, 6); outer.holes.push(inner);
  const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: CH - 3, bevelEnabled: true, bevelSize: 1.5, bevelThickness: 1.5, bevelSegments: 3, curveSegments: 20 }), alu);
  wall.rotation.x = -Math.PI / 2; wall.position.y = 1.5; C.add(wall);
  C.add(at(new THREE.Mesh(new THREE.ShapeGeometry(rrShape(CW - 4, CD - 4, 7), 20), alu), 0, 0.6, 0, -Math.PI / 2, 0, 0));
  /* the front: a recessed grey plate (the badge, left blank) */
  const fr = new THREE.Group(); at(fr, 0, 0, CD / 2 + 1.5); C.add(fr);
  fr.add(at(rbox(44, 15, 1.4, 2, plastic(0x7a7f85, { rough: 0.38 })), -14, 11, 0));
  fr.add(at(box(0.8, 16, 1.6, mat(0x5f6368)), -36.5, 11, 0)); fr.add(at(box(0.8, 16, 1.6, mat(0x5f6368)), 8.5, 11, 0));
  /* the holder: four black steps rising to the back, a hole for each bit, the sizes printed on each step's face */
  const rows = [["PH000", "PH00", "PH0", "PH1", "PH2", "1.5", "2.0", "2.5", "3.0", "4.0", "0.7", "0.9", "1.3", "1.5"],
    ["T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "TR8", "TR10", "TR15", "2.0", "2.5"],
    ["P2", "P5", "P6", "Y000", "Y00", "Y0", "Y1", "TRI2", "TRI3", "U2.6", "SQ0", "SQ1", "3.0", "4.0"],
    ["GP3.8", "GP4.5", "JIS0", "JIS1", "JIS2", "M2.5", "M3", "SIM", "4.0", "4.5", "5.0", "5.5", "6.0", "EXT"]];
  const typeOf = function (n) {
    if (/^PH|^JIS/.test(n)) return "ph"; if (/^TR|^T\d/.test(n)) return n.indexOf("TR") === 0 ? "trs" : "torx"; if (/^P\d/.test(n)) return "penta"; if (/^Y/.test(n)) return "tri";
    if (/^TRI/.test(n)) return "triangle"; if (/^U/.test(n)) return "spanner"; if (/^SQ/.test(n)) return "square"; if (/^GP|^M\d|^SIM|^EXT/.test(n)) return "flat";
    return "hex";
  };
  const holder = plastic(0x1c1d20, { rough: 0.55 });
  rows.forEach(function (row, r) {
    const z = -CD / 2 + 13 + (3 - r) * 0, depth = 15.5, zc = CD / 2 - 12 - r * depth, h = 9 + r * 3.2;
    C.add(at(rbox(CW - 8, h, depth, 1.4, holder), 0, h / 2 + 1, zc));
    C.add(at(text(row.join("   "), CW - 14, 2.4, { color: "#dfe2e6", weight: "700", font: "'DejaVu Sans Mono', monospace" }), 0, h - 2.6 + 1, zc + depth / 2 + 0.05));
    row.forEach(function (n, k) {
      const x = -CW / 2 + 10 + k * ((CW - 20) / 13), b = new THREE.Group(); at(b, x, h + 1, zc - 1.5); C.add(b);
      b.add(at(new THREE.Mesh(new THREE.CircleGeometry(2.9, 6), mat(0x050506)), 0, 0.02, 0, -Math.PI / 2, 0, 0));
      b.add(bit(typeOf(n), shank, shank2));
    });
    void z;
  });
  /* the hinge knuckles and the lid, open, with its clasp and the printed chart */
  for (let k = 0; k < 3; k++) C.add(at(cyl(2.6, 26, alu, 20), -38 + k * 38, CH - 0.5, -CD / 2 - 1.2, 0, 0, Math.PI / 2));
  const lid = new THREE.Group(); lid.position.set(0, CH - 0.5, -CD / 2 - 1.2); lid.rotation.x = -1.8; C.add(lid);
  const lo = rrShape(CW, CD, 8), li = rrPath(CW - 5, CD - 5, 6); lo.holes.push(li);
  const lw = new THREE.Mesh(new THREE.ExtrudeGeometry(lo, { depth: 8, bevelEnabled: true, bevelSize: 1.5, bevelThickness: 1.5, bevelSegments: 3, curveSegments: 20 }), alu);
  lw.rotation.x = Math.PI / 2; lw.position.set(0, 0, CD / 2); lid.add(lw);
  lid.add(at(new THREE.Mesh(new THREE.ShapeGeometry(rrShape(CW - 2, CD - 2, 7.5), 20), alu), 0, 0.2, CD / 2, Math.PI / 2, 0, 0));       /* the lid's top skin, seen from inside */
  const card = screen(CW - 12, CD - 12, bitChart, 10); card.material = new THREE.MeshStandardMaterial({ map: card.material.map, roughness: 0.55 });
  card.rotation.x = Math.PI / 2; card.position.set(0, -0.6, CD / 2); card.userData.print = true; lid.add(card);
  const clasp = new THREE.Group(); at(clasp, 0, -4, CD + 1.6); lid.add(clasp);
  clasp.add(rbox(26, 7, 2.2, 1, alu)); clasp.add(at(rbox(16, 3, 2.6, 1, mat(0xaeb2b7, { metal: 0.9, rough: 0.25 })), 0, -2.6, 0.4));
  C.add(at(rbox(18, 3, 2, 1, mat(0xaeb2b7, { metal: 0.9, rough: 0.25 })), 0, CH - 3, CD / 2 + 1.7));          /* the catch on the case front */
  /* ---- the driver, resting on the bits as photographed ---- */
  const D = new THREE.Group(); D.position.set(-66, 18.5, 56); D.rotation.set(0, 0.44, 0.127, "YZX"); g.add(D);
  const prof = [[0, 0], [7.2, 0], [8.6, 1.2], [8.9, 4], [8.2, 9], [8.0, 12], [8.6, 18], [9.2, 32], [9.0, 46], [8.0, 62], [7.4, 74], [7.6, 80], [7.6, 82]];
  const lathe = function (pts, m) { return new THREE.Mesh(new THREE.LatheGeometry(pts.map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 48), m); };
  const blueR = rubber(0x1d7fd6), blackR = rubber(0x1a1b1d);
  const cap = lathe([[0, 0], [7.4, 0], [8.8, 1.4], [9.2, 5], [8.4, 10.5], [8.0, 12], [0, 12]], blueR); cap.rotation.z = -Math.PI / 2; cap.position.x = -58; D.add(cap);
  const grip = lathe([[7.8, 0], [8.6, 6], [9.2, 20], [9.0, 34], [8.0, 50], [7.3, 62], [7.4, 68], [0, 68]], blackR); grip.rotation.z = -Math.PI / 2; grip.position.x = -46; D.add(grip);
  const collar = lathe([[7.4, 0], [7.9, 2], [7.9, 9], [6.8, 12], [0, 12]], blueR); collar.rotation.z = -Math.PI / 2; collar.position.x = 22; D.add(collar);
  const fer = lathe([[5.6, 0], [5.4, 6], [5.0, 18], [5.2, 19], [5.2, 21], [4.6, 22], [4.0, 30], [3.6, 34], [0, 34]], brushed(0xc9ccd0, "y", { rough: 0.24 })); fer.rotation.z = -Math.PI / 2; fer.position.x = 34; D.add(fer);
  D.add(at(cyl(5.5, 0.4, mat(0x6b6f74, { metal: 0.9 }), 32), 54.5, 0, 0, 0, 0, Math.PI / 2));
  const db = bit("ph", shank, shank2); db.rotation.z = -Math.PI / 2; db.position.x = 62; D.add(db);
  D.add(at(text("PRECISION 4 mm", 22, 3.2, { color: "#3a8ee6", weight: "800" }), -30, 9.25, 0, -Math.PI / 2 + 0.05, 0, 0));
  void prof;
  /* ---- the tweezers on the white bench: black ESD coating, bare steel tips ---- */
  const tw = new THREE.Group(); at(tw, -320, 0, 40, 0, 0.32, 0); g.add(tw);
  const esd = plastic(0x1b1c1e, { rough: 0.5 }), steelT = brushed(0xc8ccd1, "x", { rough: 0.22 });
  [-1, 1].forEach(function (sd) {
    const arm = new THREE.Group(); arm.position.y = sd > 0 ? 2.6 : 0.3; arm.rotation.y = sd * 0.018; tw.add(arm);
    arm.add(slab(outline([[0, -3.6], [0, 3.6], [80, 3.1], [104, 1.8], [104, -1.8], [80, -3.1]], false), 2.2, esd, 0.5));
    arm.add(slab(outline([[103.6, -1.8], [103.6, 1.8], [116, 0.8], [126, 0.25], [127, 0], [126, -0.25], [116, -0.8]], false), 1.6, steelT, 0.3));
    arm.add(at(box(30, 0.3, 4, mat(0x111214, { rough: 0.8 })), 50, 2.25, 0));
  });
  tw.add(at(rbox(12, 5, 8, 1.5, esd), 3, 2.6, 0));
  /* ---- the parts tray, and a few screws on the bench ---- */
  const pt = new THREE.Group(); at(pt, -280, 0, -100, 0, 0.18, 0); g.add(pt);
  const tray = rrShape(116, 74, 5); g.userData.unused = tray;
  pt.add(at(rbox(116, 12, 74, 3.5, plastic(0x1d1e21, { rough: 0.5 })), 0, 6, 0));
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) pt.add(at(rbox(24.5, 9.5, 30, 2.2, plastic(0x0f1012, { rough: 0.6 })), -40.5 + c * 27, 7.3, -16 + r * 32));
  const screwM = mat(0x6a6e74, { metal: 0.9, rough: 0.33 });
  const tinyScrew = function (parent, x, y, z, ry, lie) {
    const s2 = new THREE.Group(); at(s2, x, y, z, lie ? Math.PI / 2 : 0, ry, 0); parent.add(s2);
    s2.add(at(cyl(0.75, 4.5, screwM, 10), 0, 2.25, 0)); s2.add(at(cyl(1.5, 0.9, screwM, 16), 0, 4.9, 0));
    s2.add(at(box(2.2, 0.3, 0.35, mat(0x2a2c30)), 0, 5.4, 0)); s2.add(at(box(0.35, 0.3, 2.2, mat(0x2a2c30)), 0, 5.4, 0));
  };
  for (let k = 0; k < 12; k++) tinyScrew(pt, -44 + (k % 4) * 27 + (k * 7 % 9) - 4, 3, -18 + Math.floor(k / 4) * 16 + (k * 5 % 8) - 4, k, true);
  [[-215, -60], [-205, -52], [-196, -64], [-230, -40]].forEach(function (q, k) { tinyScrew(g, q[0], 0.8, q[1], k * 1.3, true); });
  return named(g, "tool:Screwdriver kit", { type: "screwdriver-kit" });
}
/* a 4 mm precision bit standing in its hole: the hex shank, its groove, the tip shaped for its type */
function bit(type, m, m2) {
  const b = new THREE.Group();
  b.add(at(new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 16, 6), m), 0, 8, 0));
  b.add(at(new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 1.2, 6), m2), 0, 10.5, 0));
  b.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.25, 2.6, 18), m), 0, 17.3, 0));
  const tip = new THREE.Group(); tip.position.y = 18.6; b.add(tip);
  const star = function (n, ro, ri, h) {
    const sh = new THREE.Shape(); for (let k = 0; k < n * 2; k++) { const a = k / (n * 2) * Math.PI * 2, r = k % 2 ? ri : ro; if (k) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } sh.closePath();
    const me = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.15, bevelSegments: 1 }), m); me.rotation.x = -Math.PI / 2; return me;
  };
  if (type === "ph") { tip.add(at(cyl(1.4, 2.2, m, 16), 0, 1.1, 0)); const c = new THREE.Mesh(new THREE.ConeGeometry(1.35, 3.6, 4), m); c.position.y = 4; c.rotation.y = Math.PI / 4; tip.add(c);
    [0, Math.PI / 2].forEach(function (a) { tip.add(at(box(2.6, 2.6, 0.32, m2), 0, 3.4, 0, 0, a, 0)); }); }
  else if (type === "flat") { tip.add(at(cyl(1.4, 2.2, m, 16), 0, 1.1, 0)); const w = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.4, 4.2, 4, 1), m); w.scale.set(1, 1, 0.35); w.position.y = 4.3; tip.add(w); }
  else if (type === "torx" || type === "trs") { tip.add(at(cyl(1.25, 2, m, 16), 0, 1, 0)); const st = star(6, 1.2, 0.8, 3.4); st.position.y = 2; tip.add(st); if (type === "trs") tip.add(at(cyl(0.35, 0.2, mat(0x050506), 8), 0, 5.65, 0)); }
  else if (type === "penta") { tip.add(at(cyl(1.0, 2.4, m, 16), 0, 1.2, 0)); const st = star(5, 0.75, 0.48, 2.8); st.position.y = 2.4; tip.add(st); }
  else if (type === "tri") { tip.add(at(cyl(1.1, 2.4, m, 16), 0, 1.2, 0)); const st = star(3, 1.0, 0.3, 2.6); st.position.y = 2.4; tip.add(st); }
  else if (type === "triangle") { tip.add(at(cyl(1.2, 2.2, m, 16), 0, 1.1, 0)); tip.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.2, 3), m), 0, 3.8, 0)); }
  else if (type === "square") { tip.add(at(cyl(1.2, 2.2, m, 16), 0, 1.1, 0)); tip.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 3.2, 4), m), 0, 3.8, 0)); }
  else if (type === "spanner") { tip.add(at(cyl(1.4, 2.2, m, 16), 0, 1.1, 0)); [-0.8, 0.8].forEach(function (x) { tip.add(at(box(0.55, 2.8, 0.7, m), x, 3.6, 0)); }); }
  else { tip.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 5, 6), m), 0, 2.5, 0)); }
  return b;
}
/* the chart printed inside the lid: the bit families, with their shapes */
function bitChart(c, W, H) {
  c.fillStyle = "#f4f5f2"; c.fillRect(0, 0, W, H);
  c.fillStyle = "#1d2025"; c.textAlign = "left"; c.textBaseline = "middle";
  const cols = [["PHILLIPS", "PH000  PH00  PH0", "PH1  PH2"], ["FLATHEAD", "1  1.5  2  2.5", "3  4"], ["TORX", "T2  T3  T4  T5", "T6  T7  T8  T9  T10"], ["SECURITY TORX", "TR8  TR10  TR15", ""],
    ["PENTALOBE", "P2  P5  P6", ""], ["TRI-WING", "Y000  Y00  Y0  Y1", ""], ["HEX", "0.7  0.9  1.3  1.5", "2  2.5  3  4"], ["TRIANGLE", "TRI2  TRI3", ""], ["SQUARE", "SQ0  SQ1", ""], ["SPANNER", "U2.6", ""]];
  const cw = W / 2, rh = H / 5;
  cols.forEach(function (k, i) {
    const x = (i % 2) * cw + W * 0.04, y = Math.floor(i / 2) * rh + rh * 0.22;
    c.font = "800 " + (rh * 0.22) + "px Arial, sans-serif"; c.fillText(k[0], x, y);
    c.font = "500 " + (rh * 0.19) + "px Arial, sans-serif"; c.fillText(k[1], x, y + rh * 0.3); if (k[2]) c.fillText(k[2], x, y + rh * 0.56);
    /* the tip shape, drawn small at the end of the line */
    const sx = x + cw * 0.78, sy = y + rh * 0.32, r = rh * 0.16; c.strokeStyle = "#1d2025"; c.lineWidth = rh * 0.035; c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.stroke();
    c.beginPath();
    if (i === 0) { c.moveTo(sx - r * 0.7, sy); c.lineTo(sx + r * 0.7, sy); c.moveTo(sx, sy - r * 0.7); c.lineTo(sx, sy + r * 0.7); }
    else if (i === 1) { c.moveTo(sx - r * 0.7, sy); c.lineTo(sx + r * 0.7, sy); }
    else if (i === 6) { for (let a = 0; a < 6; a++) { const q = a / 6 * Math.PI * 2; c.lineTo(sx + Math.cos(q) * r * 0.55, sy + Math.sin(q) * r * 0.55); } c.closePath(); }
    else if (i === 7) { for (let a = 0; a < 3; a++) { const q = a / 3 * Math.PI * 2 - Math.PI / 2; c.lineTo(sx + Math.cos(q) * r * 0.6, sy + Math.sin(q) * r * 0.6); } c.closePath(); }
    else if (i === 8) { c.rect(sx - r * 0.45, sy - r * 0.45, r * 0.9, r * 0.9); }
    else { const n = i === 4 ? 5 : i === 5 ? 3 : 6; for (let a = 0; a < n * 2; a++) { const q = a / (n * 2) * Math.PI * 2, rr = a % 2 ? r * 0.3 : r * 0.62; c.lineTo(sx + Math.cos(q) * rr, sy + Math.sin(q) * rr); } c.closePath(); }
    c.stroke();
  });
}

/* --------------------------------------- the tools, as photographed */
export function toolLayout() {
  /* as photographed: the crimper on the left, head up and to the right; the
     punch-down in the middle, blade toward you; the tone generator face up
     right of it; the probe on the right, tip toward you; the loopback plug
     at the front right */
  const g = new THREE.Group();
  const cr = crimper(); cr.position.set(-125, 0, -40); cr.rotation.y = 0.5; g.add(cr);
  const pd = punchDown(); pd.position.set(18, 0, 0); pd.rotation.y = -1.07; g.add(pd);
  const tg = toneGenerator(); tg.position.set(115, 0, -25); tg.rotation.y = -0.35; g.add(tg);
  const pr = inductiveProbe(); pr.position.set(232, 0, -15); pr.rotation.y = -2.03; g.add(pr);
  const lb = loopbackPlug(); lb.position.set(255, 5.6, 115); lb.rotation.y = -0.93; g.add(lb);
  return named(g, "tools:Layout", { type: "layout" });
}
