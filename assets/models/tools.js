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
import { COL, mat, rbox, box, cyl, at, named, text, COVERED, ledPipe, rj45Jack, screw } from "./parts.js";
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
  const g = new THREE.Group(), T = 20;
  const steel = paintedSteel(0x1d3a7a, { rough: 0.34 }), blue = plastic(0x2a73d0, { rough: 0.4 }), blk = rubber(0x18191b), dark = mat(0x0d0e10, { rough: 0.9 });
  /* the head: two blue steel plates with the black jaw mechanism between them */
  const head = outline([[-6, -20], [54, -20], [70, -13], [74, 0], [70, 14], [54, 21], [-6, 21], [-18, 10], [-18, -10]], true);
  const lower = slab(head, 6.5, steel, 1.2); g.add(lower);
  const upper = slab(head, 6.5, steel, 1.2); upper.position.y = T - 6.5 + 1.2; g.add(upper);
  const mid = slab(outline([[-4, -17], [56, -17], [68, -10], [70, 0], [66, 12], [52, 17], [-4, 17], [-14, 8], [-14, -8]], true), T - 12, plastic(0x141517, { rough: 0.5 }), 0.6);
  mid.position.y = 6.3; g.add(mid);
  /* on top: the two dies, each a cavity with its row of teeth, in a black die block */
  const top = new THREE.Group(); at(top, 0, T + 0.02, 0, -Math.PI / 2, 0, 0); g.add(top);
  top.add(at(rbox(44, 18, 2.4, 2, plastic(0x141517, { rough: 0.45 })), 38, 1.5, 0.9));
  [[48, 2, 14, 8.6, 8, "8P"], [28, 2, 11.5, 7.6, 6, "6P"]].forEach(function (d) {
    top.add(at(box(d[2], d[3], 0.3, mat(0x050506)), d[0], d[1], 2.15));
    for (let k = 0; k < d[4]; k++) top.add(at(box(0.55, d[3] * 0.55, 0.5, mat(0xbfc3c8, { metal: 1, rough: 0.25 })), d[0] - d[2] / 2 + 1.2 + k * (d[2] - 2.4) / (d[4] - 1), d[1] + d[3] * 0.18, 2.3));
    top.add(at(text(d[5], 6, 3, { color: "#e8ecf3", weight: "800" }), d[0], -9.5, 0.1));
  });
  top.add(at(text("RJ45 · RJ11", 26, 3.2, { color: "#e8ecf3", weight: "700" }), 30, 15.5, 0.1));
  [[6, 11], [6, -11], [64, -6], [64, 8]].forEach(function (b) {
    const bolt = new THREE.Group(); at(bolt, b[0], b[1], 0); top.add(bolt);
    bolt.add(at(new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 2, 6), mat(0x141518, { metal: 0.6, rough: 0.4 })), 0, 0, 1, Math.PI / 2));
    bolt.add(at(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.4, 6), mat(0x050506)), 0, 0, 2.05, Math.PI / 2));
  });
  /* the blades: the long cutter along the near edge, the stripper slot by the hinge */
  g.add(at(box(28, 8, 1.6, brushed(0xd1d4d8, "x")), 14, T / 2, 20.4, 0, 0.06, 0));
  g.add(at(box(12, 6, 1.4, brushed(0xd1d4d8, "x")), -6, T / 2, -20.8));
  g.add(at(box(9, 2.4, 0.6, mat(0x050506)), -6, T / 2 + 1, -21.6));
  /* the hinge pin and the ratchet pawl */
  g.add(at(cyl(4.6, T + 1.4, mat(0xb9bdc2, { metal: 0.9, rough: 0.3 }), 28), -9, T / 2, 0));
  g.add(at(box(16, 3, 6, mat(0xb9bdc2, { metal: 0.9, rough: 0.3 })), -24, T - 3, 2, 0, 0.3, 0));
  /* the upper handle: slim, blue, a black channel along it */
  const up = outline([[-14, 12], [-50, 20], [-100, 30], [-150, 40], [-170, 44], [-178, 37], [-170, 30], [-150, 27], [-100, 17], [-50, 8], [-14, 3]], true);
  g.add(slab(up, 17, blue, 3));
  const upIn = outline([[-56, 15], [-100, 23.5], [-150, 33], [-162, 33.5], [-150, 30.5], [-100, 21], [-56, 12]], true);
  const ui = slab(upIn, 1.4, blk, 0.3); ui.position.y = 17 - 0.4; g.add(ui);
  /* the lower handle: thick, a black rubber grip over a blue body whose edge shows round it, finger grooves on its outer edge */
  /* its outer edge scalloped into finger grooves, as moulded */
  const edge = function (inset) {
    const pts = [];
    for (let x = -50; x >= -170; x -= 3) {
      const t = (x + 50) / -120, y = lerp(-10, -42, t) + inset, groove = x < -66 && x > -164 ? 2.8 * Math.pow(Math.abs(Math.sin((x + 66) / 24.5 * Math.PI)), 1.5) : 0;
      pts.push([x, y + groove]);
    }
    return pts;
  };
  const loPts = [[-14, -3]].concat(edge(0), [[-178, -44], [-186, -36], [-178, -24], [-152, -18], [-102, -6], [-52, 0], [-16, 1]]);
  g.add(slab(outline(loPts, false), 19, blue, 3.5));
  const gPts = edge(2.2).filter(function (q) { return q[0] < -46; }).concat([[-174, -38], [-180, -33], [-174, -26], [-150, -21], [-100, -9], [-50, -2.5]]);
  g.add(slab(outline(gPts, false), 21, blk, 3.5));
  for (let k = 0; k < 16; k++) g.add(at(box(1.1, 0.5, 7, dark), -64 - k * 7, 21.05, 8 + k * 1.75, 0, 0.27, 0));   /* the grip's texture lines */
  g.rotation.y = 0.35;
  return named(g, "tool:Crimper", { type: "crimper", dies: ["8P8C", "6P6C"] });
}

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
/* The tone generator lying face up, as photographed: the off-white case,
   the dark grey face with its LCD, the red power button, MODE, the arrow
   pad and OK, TONE GENERATOR, and its lead out of the bottom. */
export function toneGenerator() {
  const g = new THREE.Group(), W = 74, L = 134, T = 30, case_ = plastic(OFFWHITE, { rough: 0.58, grain: 0.1 });
  const f = new THREE.Group(); f.name = "panel:Tone face"; f.rotation.x = -Math.PI / 2; f.position.y = T / 2; g.add(f);   /* build facing +Z, lie it face up */
  f.add(rbox(W, L, T, 10, case_));
  f.add(at(box(W + 0.2, L - 20, 1.2, mat(0x9c998e)), 0, 0, -T / 2 + 6));                                         /* the seam between the halves */
  f.add(at(rbox(W - 8, L - 14, 1, 7, plastic(0x4a4e53, { rough: 0.45 })), 0, 2, T / 2 + 0.2));
  const Z = T / 2 + 0.75;
  f.add(at(rbox(54, 30, 0.8, 2, plastic(0x2a2c2f)), 0, 38, Z));
  f.add(at(screen(50, 26, function (c, W2, H2) { lcdText(c, ["TONE:  ON", "MODE:  ALT  ~", "LINE:  OPEN"], W2, H2, { bg: "#bfc8be" }); }), 0, 38, Z + 0.45));
  f.add(at(text("TONE GENERATOR", 40, 3.4, { color: "#eef0f2", weight: "700", spacing: 0.04 }), 2, 18.5, Z + 0.05));
  const btn = function (x, y, w, h, color, label, lc) {
    f.add(at(rbox(w, h, 3, 2.4, plastic(color, { rough: 0.38 })), x, y, Z + 1));
    if (label) f.add(at(text(label, w * 0.9, h * 0.62, { color: lc || "#f2f2f2", weight: "800" }), x, y, Z + 2.55));
  };
  btn(-18, 7, 13, 8, 0xd8302b, "⏻"); btn(18, 7, 13, 8, 0x36393d, "MODE");
  f.add(at(cyl(17, 2, plastic(0x26292c, { rough: 0.4 }), 40), 0, -16, Z + 0.6, Math.PI / 2));
  [[0, 9.5, "▲"], [0, -9.5, "▼"], [-10.5, 0, "◀"], [10.5, 0, "▶"]].forEach(function (a) { btn(a[0], -16 + a[1], 9, 6.5, 0x36393d, a[2]); });
  btn(0, -16, 10, 8, 0x2c2f33, "OK");
  /* the lead: strain relief out of the bottom, then the cable away across the bench */
  const sr = new THREE.Group(); at(sr, 0, -L / 2 + 1, 0, Math.PI / 2, 0, 0); f.add(sr);
  const geo = tubeVar(new THREE.LineCurve3(V(0, 0, 0), V(0, 0, -22)), { n: 80, m: 24, up: V(0, 1, 0), radius: function (t) { const z = t * 22, r = lerp(6.5, 3.4, Math.min(1, z / 18)) - (z > 4 && Math.sin(z * 2.2) > 0.3 ? 0.4 : 0); return [r, r]; } });
  sr.add(new THREE.Mesh(geo, rubber(0x161718)));
  const lead = new THREE.Group(); at(lead, 0, 0, -21, 0, Math.PI, 0); sr.add(lead);
  lead.userData.exitZ = 0; lead.userData.cable = { r: 2.6, color: 0x161718, text: "TEST LEAD  ·  2C  ·  28AWG", ink: "rgba(220,220,220,0.35)" };
  cableFrom(g, lead, [[-20, 2.6, 110], [-60, 2.6, 150], [-140, 2.6, 175]], { straight: 12 });
  return named(g, "tool:Tone generator", { type: "tone-generator" });
}
/* the inductive probe, lying face up: the wand tapering to its black
   tip, the grey face with INDUCTIVE PROBE, the push button, the
   sensitivity mark, the green light, the speaker grille at the back */
export function inductiveProbe() {
  const g = new THREE.Group(), case_ = plastic(OFFWHITE, { rough: 0.55, grain: 0.1 });
  const x0 = -112, x1 = 96;
  const RY = function (t) { return t < 0.08 ? lerp(10, 13, t / 0.08) : t < 0.62 ? 13 : lerp(13, 6, (t - 0.62) / 0.38); };
  const RX = function (t) { return t < 0.08 ? lerp(15, 19, t / 0.08) : t < 0.62 ? 19 : lerp(19, 6.5, Math.pow((t - 0.62) / 0.38, 0.9)); };
  const geo = tubeVar(new THREE.LineCurve3(V(x0, 0, 0), V(x1, 0, 0)), { n: 160, m: 48, up: V(0, 1, 0), radius: function (t) { return [RX(t), RY(t)]; }, square: function (t) { return t < 0.62 ? 3.2 : lerp(3.2, 2, (t - 0.62) / 0.38); } });
  const body = new THREE.Mesh(geo, case_); body.position.y = 13; g.add(body);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), case_); cap.scale.set(9, 15, 10); cap.rotation.z = Math.PI / 2; cap.position.set(x0 + 0.2, 13, 0); g.add(cap);
  /* the tip */
  const tip = new THREE.Mesh(new THREE.ConeGeometry(5.6, 26, 28), plastic(0x141516, { rough: 0.35 })); tip.rotation.z = -Math.PI / 2; tip.position.set(x1 + 12, 13, 0); g.add(tip);
  /* the face */
  const face = new THREE.Group(); face.name = "panel:Probe face"; at(face, 0, 13 + 13.02, 0, -Math.PI / 2, 0, 0); g.add(face);
  face.add(at(rbox(118, 26, 0.6, 9, plastic(0x4a4e53, { rough: 0.45 })), -14, 0, 0.3));
  const t1 = text("INDUCTIVE", 40, 5.6, { color: "#eef0f2", weight: "800" }), t2 = text("PROBE", 26, 5.6, { color: "#eef0f2", weight: "800" });
  face.add(at(t1, -52, 3.6, 0.65)); face.add(at(t2, -59, -3.4, 0.65));
  face.add(at(rbox(18, 14, 1.4, 6, plastic(0x6b6f74)), -18, 0, 0.9)); face.add(at(rbox(13, 9, 2.6, 4.5, plastic(0xeceae4, { rough: 0.4 })), -18, 0, 1.4));
  named(face.children[face.children.length - 1], "button:PROBE", { type: "button" });
  face.add(at(text("◁◁◁ + ▷▷▷", 18, 3.2, { color: "#8ce08a", weight: "700" }), 10, 0, 0.65));
  const gl = ledPipe(COL.ledGreen, true); gl.scale.set(0.9, 1.4, 1); face.add(at(gl, 40, 0, 0.7));
  /* the grille at the back */
  const gr = new THREE.Group(); at(gr, x0 + 14, 13 + 12.6, 0, -Math.PI / 2, 0, 0); g.add(gr);
  gr.add(at(rbox(24, 26, 0.5, 9, plastic(0xd2cfc3, { rough: 0.6 })), 0, 0, 0.05));
  for (let k = 0; k < 8; k++) gr.add(at(rbox(1.1, 20 - Math.abs(k - 3.5) * 2.4, 0.4, 0.5, mat(0x55585d, { rough: 0.8 })), -8.4 + k * 2.4, 0, 0.3));   /* the speaker slots */
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
/* The electronics screwdriver set on its ESD mat, as photographed: the
   aluminium case open, the lid's printed chart of bit types, rows of
   precision bits in the black holder, the driver with its knurled grip
   and blue end, the ESD tweezers, a parts tray; the mat on a white
   bench with its grounding snap. */
export function screwdriverKit() {
  const g = new THREE.Group();
  g.add(at(box(760, 20, 520, mat(0xededea, { rough: 0.5, grain: 0.04 })), 0, -10, 0));                           /* the white bench */
  const MAT = 2;
  g.add(at(rbox(420, MAT, 290, 1, mat(0x2e4c70, { rough: 0.85, grain: 0.18, scale: 0.8 })), 20, MAT / 2, 10));
  const snap = new THREE.Group(); at(snap, -180, MAT, 145); g.add(snap);
  snap.add(at(cyl(6, 1.2, mat(0xc9ccd0, { metal: 1, rough: 0.25 }), 28), 0, 0.6, 0)); snap.add(at(new THREE.Mesh(new THREE.SphereGeometry(3.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xc9ccd0, { metal: 1, rough: 0.25 })), 0, 1.2, 0));
  g.add(at(text("ESD SAFE  ·  10⁶–10⁹ Ω  ·  GROUND HERE →", 70, 4, { color: "#b9c8db", weight: "600" }), -132, MAT + 0.05, 145, -Math.PI / 2, 0, 0));
  /* the case */
  const C = new THREE.Group(); C.name = "panel:Bit case"; at(C, 70, MAT, -10, 0, -0.32, 0); g.add(C);
  const CW = 124, CH = 26, CD = 78, alu = brushed(0xc9ccd0, "x", { rough: 0.32, metal: 0.85 });
  const tray = new THREE.Shape(); tray.moveTo(-CW / 2, -CD / 2); tray.lineTo(CW / 2, -CD / 2); tray.lineTo(CW / 2, CD / 2); tray.lineTo(-CW / 2, CD / 2); tray.closePath();
  const tin = new THREE.Path(); tin.moveTo(-CW / 2 + 3, -CD / 2 + 3); tin.lineTo(-CW / 2 + 3, CD / 2 - 3); tin.lineTo(CW / 2 - 3, CD / 2 - 3); tin.lineTo(CW / 2 - 3, -CD / 2 + 3); tin.closePath(); tray.holes.push(tin);
  C.add(slab(tray, CH, alu, 2.5));
  C.add(at(box(CW - 6, 2, CD - 6, alu), 0, 1, 0));
  C.add(at(rbox(CW - 7, 14, CD - 7, 2, rubber(0x1a1b1d)), 0, CH - 9, 0));
  C.add(at(rbox(38, 9, 1, 2, plastic(0x6b6f74, { rough: 0.4 })), 0, 13, CD / 2 + 0.4));                          /* the front badge plate (unbranded) */
  /* the bits: four rows, labels on the step in front of each */
  const names = [["PH000", "PH00", "PH0", "PH1", "PH2", "SL1", "SL1.5", "SL2", "SL2.5", "SL3", "SL4", "H0.7", "H0.9", "H1.3"],
    ["T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "TR8", "TR10", "TR15", "H1.5", "H2"],
    ["P2", "P5", "P6", "Y000", "Y00", "Y0", "Y1", "TRI2", "TRI3", "U2.6", "SQ0", "SQ1", "H2.5", "H3"],
    ["4.0", "4.5", "5.0", "5.5", "GP", "SIM", "JIS0", "JIS1", "M2.5", "M3", "∅", "∅", "H4", "EXT"]];
  const shank = mat(0xb4b8bd, { metal: 0.95, rough: 0.28 });
  names.forEach(function (row, r) {
    const z = -CD / 2 + 14 + r * 16, yb = CH - 2 + r * 0.6;
    C.add(at(text(row.join("  "), CW - 14, 2.2, { color: "#d9dce0", weight: "600", font: "'DejaVu Sans Mono', monospace" }), 0, yb + 0.05, z + 6.5, -Math.PI / 2, 0, 0));
    row.forEach(function (n, i) {
      if (n === "∅") return;
      const x = -CW / 2 + 9 + i * ((CW - 18) / 13), b = new THREE.Group(); at(b, x, yb, z); C.add(b);
      b.add(at(new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 18, 6), shank), 0, 7, 0));
      b.add(at(new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.35, 6, 6), mat(0x8d9196, { metal: 0.9, rough: 0.35 })), 0, 11, 0, Math.PI / 2));
      b.add(at(cyl(1.1, 6, shank, 12), 0, 19, 0));
      b.add(at(new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.4, 12), shank), 0, 23.2, 0));
    });
  });
  /* the lid, open, with its printed chart */
  const lid = new THREE.Group(); lid.position.set(0, CH - 1, -CD / 2); lid.rotation.x = -1.78; C.add(lid);
  const lt = new THREE.Shape(); lt.moveTo(-CW / 2, 0); lt.lineTo(CW / 2, 0); lt.lineTo(CW / 2, CD); lt.lineTo(-CW / 2, CD); lt.closePath();
  const lh = new THREE.Path(); lh.moveTo(-CW / 2 + 3, 3); lh.lineTo(-CW / 2 + 3, CD - 3); lh.lineTo(CW / 2 - 3, CD - 3); lh.lineTo(CW / 2 - 3, 3); lh.closePath(); lt.holes.push(lh);
  const lidRim = new THREE.Mesh(new THREE.ExtrudeGeometry(lt, { depth: 9, bevelEnabled: true, bevelSize: 1.6, bevelThickness: 1.6, bevelSegments: 2 }), plastic(0x7d8288, { rough: 0.4 })); lidRim.rotation.x = Math.PI / 2; lid.add(lidRim);
  /* the lid's top skin (outside, at the hinge side) and the printed card on its inner face */
  lid.add(at(box(CW - 4, 0.8, CD - 4, plastic(0x7d8288)), 0, -0.4, CD / 2));
  const card = screen(CW - 10, CD - 10, bitChart, 10); card.material = new THREE.MeshStandardMaterial({ map: card.material.map, roughness: 0.6 });
  card.rotation.x = Math.PI / 2; card.position.set(0, -0.9, CD / 2); card.userData.print = true; lid.add(card);
  C.add(at(box(22, 4, 4, mat(0x9ea3a8, { metal: 0.8, rough: 0.3 })), 0, CH + 1, -CD / 2 - 1));
  /* the driver: knurled black grip, blue end cap, steel shaft, a bit in it, its tip resting on the bits */
  /* the driver, its handle on the mat and its tip resting on the bits, as photographed */
  const D = new THREE.Group(); D.position.set(-72, 17.6, 52.6); D.rotation.set(0, 0.44, 0.127, "YZX"); g.add(D);
  const grip = cyl(7.5, 92, plastic(0x1c1d20, { rough: 0.5 }), 48); grip.rotation.z = Math.PI / 2; D.add(grip);
  for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2, rib = box(70, 0.7, 0.9, mat(0x0c0d0e, { rough: 0.9 })); rib.position.set(-4, Math.cos(a) * 7.55, Math.sin(a) * 7.55); rib.rotation.x = a; D.add(rib); }
  D.add(at(cyl(7.8, 10, rubber(0x1f6fd1), 40), -50, 0, 0, 0, 0, Math.PI / 2));
  D.add(at(cyl(6.4, 6, plastic(0x2a2c30, { rough: 0.3 }), 40), -58, 0, 0, 0, 0, Math.PI / 2));
  D.add(at(cyl(4.5, 8, brushed(0xc9ccd0, "x"), 32), 50, 0, 0, 0, 0, Math.PI / 2));
  D.add(at(cyl(2.4, 60, brushed(0xc9ccd0, "x", { rough: 0.25 }), 24), 84, 0, 0, 0, 0, Math.PI / 2));
  D.add(at(new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 12, 6), shank), 118, 0, 0, 0, 0, Math.PI / 2));
  D.add(at(cyl(1.1, 7, shank, 12), 127, 0, 0, 0, 0, Math.PI / 2));
  /* the tweezers */
  const tw = new THREE.Group(); at(tw, -330, 0, 20, 0, 0.32, 0); g.add(tw);   /* on the white bench beside the mat, as photographed */
  const esd = plastic(0x1b1c1e, { rough: 0.45 });
  [-1, 1].forEach(function (sd) {
    const arm = outline([[0, -3.5], [0, 3.5], [70, 3], [112, 1.4], [124, 0.6], [128, 0], [124, -0.9], [112, -1.2], [70, -3]], false);
    const m = slab(arm, 2.2, esd, 0.5); m.position.y = sd > 0 ? 2.4 : 0; m.rotation.z = sd > 0 ? 0.014 : 0; m.position.z = sd * 3.2; tw.add(m);
  });
  tw.add(at(box(12, 4.8, 13, esd), 4, 2.4, 0));
  tw.add(at(text("ESD", 8, 2.6, { color: "#c9ccd2", weight: "800" }), 30, 4.75, 3.2, -Math.PI / 2, 0, 0));
  /* a parts tray with a few screws */
  const pt = new THREE.Group(); at(pt, -260, 0, -120, 0, 0.18, 0); g.add(pt);
  pt.add(at(rbox(110, 12, 70, 3, plastic(0x1d1e21, { rough: 0.5 })), 0, 6, 0));
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { pt.add(at(rbox(23, 2, 28, 2, plastic(0x141517)), -39 + c * 26, 11.2, -15 + r * 31)); }
  for (let k = 0; k < 9; k++) { const s = new THREE.Group(); at(s, -42 + (k % 4) * 26 + (k * 7 % 9) - 4, 12.4, -16 + Math.floor(k / 4) * 30 + (k * 5 % 8) - 4, 0, k, Math.PI / 2); pt.add(s);
    s.add(at(cyl(1.3, 5, mat(0x5a5e64, { metal: 0.9, rough: 0.35 }), 10), 0, 0, 0)); s.add(at(cyl(2.4, 1, mat(0x5a5e64, { metal: 0.9, rough: 0.35 }), 16), 0, 2.8, 0)); }
  return named(g, "tool:Screwdriver kit", { type: "screwdriver-kit" });
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
  const pd = punchDown(); pd.position.set(-10, 0, -10); pd.rotation.y = -1.07; g.add(pd);
  const tg = toneGenerator(); tg.position.set(95, 0, -25); tg.rotation.y = -0.35; g.add(tg);
  const pr = inductiveProbe(); pr.position.set(215, 0, -15); pr.rotation.y = -2.03; g.add(pr);
  const lb = loopbackPlug(); lb.position.set(255, 5.6, 115); lb.rotation.y = -0.93; g.add(lb);
  return named(g, "tools:Layout", { type: "layout" });
}
