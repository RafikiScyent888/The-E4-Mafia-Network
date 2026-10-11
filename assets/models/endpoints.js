/* =====================================================================
   Devices on the network, matched part by part to the owner's
   photographs (10 October 2026): desktop PC rear, laptop port side,
   network printer, smart TV rear, PoE IP camera, data/voice wall plate.
   Real millimetres; front faces +Z; sits on y = 0. Cables are plugged
   in as photographed. Where a photo's printing is garbled, the correct
   wording is used; sides a photo doesn't show follow the standard
   design for that device. No brand names or logos.
   ===================================================================== */
import * as THREE from "three";
import { COL, mat, rbox, box, cyl, at, named, text, sticker, COVERED, led, slots, rj45Jack, dcJack, fFemale, pinhole, button,
  usbA, usbC, hdmi, displayPort, audioJack, db9, usbB, iecInlet, rocker, fanGrille, rj11Jack, screw, socket } from "./parts.js";
import { rj45Plug, rj11Plug, cableFrom, plugInto, iecC13 } from "./cables.js";
import { perforated, printLines, label, labelTex, brushed, paintedSteel, plastic, rubber, gloss, nickel } from "./surface.js";

const BACK = Math.PI, V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
const AUDIO = { blue: 0x3f86e8, green: 0x5cc24e, pink: 0xf0a0c0, orange: 0xf08a2c, black: 0x1c1d20, grey: 0x8f9398 };
/* white print on dark gear, dark print on light gear */
const ink = function (s, w, h, o) { return text(s, w, h, Object.assign({ color: "#eceee9", weight: "600" }, o || {})); };
const dark = function (s, w, h, o) { return text(s, w, h, Object.assign({ color: "#2b2e33", weight: "600" }, o || {})); };
/* print that reads upward, as on the photo's "VENTILATION" and "PSU (1000W)" */
const up = function (m) { m.rotation.z = Math.PI / 2; return m; };
/* rounded rectangles as shapes and holes (cx, cy offsets the hole) */
function rrPts(w, h, r, cx, cy, p) {
  const x = (cx || 0) - w / 2, y = (cy || 0) - h / 2; r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r); p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r); p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y); return p;
}
function rrShape(w, h, r, cx, cy) { return rrPts(w, h, r, cx, cy, new THREE.Shape()); }
function rrPath(w, h, r, cx, cy) { return rrPts(w, h, r, cx, cy, new THREE.Path()); }
/* a factory patch cable plugged into a jack */
function patch(jack, o) { return plugInto(jack, rj45Plug({ standard: "T568B", boot: o.boot, jacket: o.jacket })); }

/* ------------------------------------------------------- desktop PC */
/* A compact tower, as in the photo: the brushed I/O plate with every
   port standing on end (the board is on its side in a tower), the
   ventilation fan behind its wire guard, MADE IN TAIWAN and the MAC
   sticker, the PSU face with its switch and the mains cord plugged in,
   the model label with its regulatory marks, and the Ethernet cable
   plugged in with its link light on. */
export function desktopPC() {
  const g = new THREE.Group(), W = 200, H = 252, D = 380, Y0 = 10, top = Y0 + H;
  const steel = paintedSteel(0x232529, { rough: 0.5 });
  /* the shell: a solid body, and its last 22 mm a hollow sleeve so the
     fan and PSU can be seen through their openings in the back panel */
  g.add(at(rbox(W - 0.6, H - 0.6, D - 12, 4, steel), 0, Y0 + H / 2, 6));
  const sl = rrShape(W, H, 4); sl.holes.push(rrPath(W - 2.4, H - 2.4, 3));
  g.add(at(new THREE.Mesh(new THREE.ExtrudeGeometry(sl, { depth: 21, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.5, bevelSegments: 2, curveSegments: 8 }), steel), 0, Y0 + H / 2, -D / 2 + 0.5));
  /* the cover's seams: top and side panels over the frame */
  [-1, 1].forEach(function (s) { g.add(at(box(0.8, 0.6, D - 10, mat(0x0b0c0d, { rough: 1 })), s * (W / 2 - 3), top + 0.05, 0)); });
  [[-W / 2 + 22, D / 2 - 22], [W / 2 - 22, D / 2 - 22], [-W / 2 + 22, -D / 2 + 22], [W / 2 - 22, -D / 2 + 22]].forEach(function (p) { g.add(at(cyl(11, Y0, rubber(0x18191b), 28), p[0], Y0 / 2, p[1])); });

  /* ---- the back ---- */
  const back = new THREE.Group(); at(back, 0, 0, -D / 2, 0, BACK); g.add(back);
  /* I/O plate: 44.45 x 158.75 (ATX), brushed aluminium with its pressed rim */
  const ioW = 44.45, ioH = 158.75, ioX = -W / 2 + 36, ioTop = top - 20, ioY = ioTop - ioH / 2;
  const fx = 32, fy = top - 24 - 60;
  /* the back panel, set in the shell's lip, with real openings */
  const bp = rrShape(W - 2.4, H - 2.4, 3);
  bp.holes.push(rrPath(ioW + 2, ioH + 2, 0.5, ioX, ioY - Y0 - H / 2));
  const fh = new THREE.Path(); fh.absarc(fx, fy - Y0 - H / 2, 57, 0, Math.PI * 2, true); bp.holes.push(fh);
  bp.holes.push(rrPath(125, 63.5, 1, fx, Y0 + 44 - Y0 - H / 2));
  back.add(at(new THREE.Mesh(new THREE.ExtrudeGeometry(bp, { depth: 1, bevelEnabled: false, curveSegments: 48 }), paintedSteel(0x1d1f22)), 0, Y0 + H / 2, -0.4));
  back.add(at(box(W - 4, H - 4, 0.5, mat(0x070708)), 0, Y0 + H / 2, -16));                    // inside: dark
  const plate = brushed(0xc4c7cb, "y", { rough: 0.38 });
  back.add(at(rbox(ioW, ioH, 1.2, 0.6, plate), ioX, ioY, 1.2));
  const io = new THREE.Group(); io.name = "panel:I/O plate"; at(io, ioX, ioTop, 1.8); back.add(io);
  const lab = function (s, x, y, w, o) { io.add(at(text(s, w || 20, 3.1, Object.assign({ color: "#15171a", weight: "800" }, o || {})), x, y, 0.05)); };
  const onEnd = function (part) { part.rotation.z = -Math.PI / 2; return part; };   /* standing on end, as in a tower */
  /* Wi-Fi antenna connectors (the top of the plate is cut off in the photo) */
  [-9, 9].forEach(function (x, i) {
    const a = new THREE.Group(); at(a, x, -9, 0); io.add(a);
    a.add(at(new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 2, 6), mat(0xd6b25a, { metal: 1, rough: 0.25 })), 0, 0, 1, Math.PI / 2));
    a.add(at(cyl(3.1, 6, mat(0xd6b25a, { metal: 1, rough: 0.3 }), 24), 0, 0, 5, Math.PI / 2));
    for (let k = 0; k < 7; k++) a.add(at(new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.18, 6, 24), mat(0xc9a44e, { metal: 1, rough: 0.3 })), 0, 0, 2.6 + k * 0.75));
    a.add(at(new THREE.Mesh(new THREE.CircleGeometry(1.4, 16), mat(0xf0eee6)), 0, 0, 8.05));
    named(a, "port:Wi-Fi ANT " + (i + 1), { type: "rp-sma" });
  });
  lab("Wi-Fi ANT", 0, -15.5, 22);
  io.add(at(onEnd(displayPort("DP 1")), -14, -29, 0)); io.add(at(onEnd(displayPort("DP 2")), -5, -29, 0)); lab("DP (x2)", 10, -29, 16);
  io.add(at(onEnd(hdmi("HDMI")), -11, -50, 0)); lab("HDMI", 6, -50, 14);
  lab("USB 3.2 (x4)", 0, -63, 26);
  [-14.4, -4.8, 4.8, 14.4].forEach(function (x, i) { io.add(at(onEnd(usbA("USB 3.2 " + (i + 1), true)), x, -73.5, 0)); });
  lab("USB-C", -13, -84.5, 12);
  io.add(at(onEnd(usbC("USB-C")), -16, -95.5, 0)); io.add(at(onEnd(usbA("USB 2.0", false)), -8.5, -95.5, 0));
  const lan = rj45Jack({ name: "LAN", metal: true, on: [true, true] }); lan.rotation.z = -Math.PI / 2; io.add(at(lan, 9.5, -95.5, 0));
  lab("LAN", 9.5, -105.5, 12);
  const aud = [[AUDIO.grey, "SIDE"], [AUDIO.black, "REAR"], [AUDIO.orange, "C/SUB"], [AUDIO.pink, "MIC"], [AUDIO.green, "OUT"], [AUDIO.blue, "IN"]];
  aud.forEach(function (a, i) {
    const x = (i % 3 - 1) * 12, y = i < 3 ? -117 : -138;
    io.add(at(audioJack("AUDIO " + a[1], a[0]), x, y, 0)); lab(a[1], x, y + (i < 3 ? 5.6 : -5.6), 11, { weight: "600" });
  });
  /* the Ethernet cable, plugged in: black, black boot, down to the bench */
  const ep = patch(lan, { boot: 0x17181a, jacket: 0x17181a });
  /* the ventilation fan behind its wire guard */
  back.add(at(ink("VENTILATION", 58, 6, { weight: "500", spacing: 0.08 }), fx, top - 13, 0.62));
  back.add(at(up(ink("VENTILATION", 58, 5.4, { weight: "500", spacing: 0.08 })), fx - 66, fy, 0.62));
  const fan = fanUnit(120); at(fan, fx, fy, 0); back.add(fan);
  /* MADE IN TAIWAN, and the MAC sticker with its barcode */
  back.add(at(ink("MADE IN TAIWAN", 30, 3.6, { weight: "600" }), fx - 34, fy - 70, 0.62));
  const mac = label(["MAC: " + COVERED], { w: 44, h: 13, barcode: "pc-mac", boldFirst: false });
  at(mac, fx + 22, fy - 70, 0.6); back.add(mac);
  /* the power supply's face: honeycomb vent, switch, inlet, and its cord */
  const psu = new THREE.Group(); at(psu, fx, Y0 + 44, 0.6); back.add(psu);
  psu.add(at(box(125, 63.5, 0.4, mat(0x060607)), 0, 0, 0.1));
  const hc = perforated(125, 63.5, { pitch: 4.2, d: 3.4, shape: "hex", color: 0x1b1d20 }); hc.position.z = 0.9; psu.add(hc);
  psu.add(at(box(70, 34, 1.4, paintedSteel(0x1b1d20)), 20, -4, 1.4));                                   // the solid plate the switch and inlet sit in
  psu.add(at(rocker("PSU SWITCH"), -2, -4, 2.1));
  const inlet = iecInlet("AC IN"); at(inlet, 30, -4, 2.1); psu.add(inlet);
  const plug = iecC13(); plug.rotation.y = Math.PI; plug.position.set(0, 0, 0.5); inlet.add(plug);
  back.add(at(up(ink("PSU (1000W)", 34, 4.6, { weight: "500" })), fx - 70, Y0 + 44, 0.62));
  /* the model label, with the regulatory marks */
  const ml = label(["PC MODEL: XTR-5800", "S/N: " + COVERED], { w: 44, h: 20, marks: true });
  at(ml, ioX, ioTop - ioH - 16, 0.6); back.add(ml);
  /* thumbscrews holding the cover */
  [[W / 2 - 9, top - 30], [W / 2 - 9, Y0 + 30]].forEach(function (p) {
    const t = new THREE.Group(); at(t, p[0], p[1], 0.6); back.add(t);
    t.add(at(cyl(5, 4, mat(0x2a2c30, { metal: 0.6, rough: 0.4 }), 18), 0, 0, 2, Math.PI / 2));
    for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; t.add(at(box(0.6, 0.5, 4, mat(0x2a2c30, { metal: 0.6, rough: 0.4 })), Math.cos(a) * 5, Math.sin(a) * 5, 2, 0, 0, a)); }
  });
  /* the cables, run in the case's own coordinates down to the bench (back-local -x is world +x) */
  /* the Ethernet cable bends down and to the right, past the PSU, as in the photo */
  cableFrom(g, ep, [[-ioX - 9.5 - 18, top - 150, -D / 2 - 46], [-ioX - 9.5 - 26, 70, -D / 2 - 70], [-ioX - 9.5 - 30, 3.05, -D / 2 - 130], [-ioX - 9.5 - 70, 3.05, -D / 2 - 330]], { straight: 20 });
  cableFrom(g, plug, [[-fx - 34, 22, -D / 2 - 70], [-fx - 44, 3.9, -D / 2 - 130], [-fx - 100, 3.9, -D / 2 - 320]], { straight: 16 });

  /* ---- the front (not in the photo: the standard design) ---- */
  const front = new THREE.Group(); at(front, 0, 0, D / 2); g.add(front);
  front.add(at(rbox(W - 4, H - 4, 8, 3, plastic(0x17181a, { rough: 0.4 })), 0, Y0 + H / 2, 0.5));
  const mesh = perforated(W - 40, H - 70, { pitch: 3.2, d: 2.2, shape: "hex", color: 0x1c1e21 }); mesh.position.set(0, Y0 + (H - 70) / 2 + 14, 4.6); front.add(mesh);
  front.add(at(box(W - 40, H - 70, 0.4, mat(0x050506)), 0, Y0 + (H - 70) / 2 + 14, 3.8));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7.5, 1.1, 12, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfe8ff, emissiveIntensity: 1.8 }));
  front.add(at(ring, -W / 2 + 34, top - 22, 5)); front.add(at(cyl(6.4, 2, mat(0x2a2c30, { metal: 0.6, rough: 0.3 }), 32), -W / 2 + 34, top - 22, 5, Math.PI / 2));
  front.add(at(usbA("FRONT USB 1", true), 4, top - 22, 4.6)); front.add(at(usbA("FRONT USB 2", true), 24, top - 22, 4.6));
  front.add(at(usbC("FRONT USB-C"), 42, top - 22, 4.6)); front.add(at(audioJack("HEADSET", AUDIO.black), 58, top - 22, 4.6));
  /* the left side panel's vent, for the graphics card */
  const sv = perforated(150, 110, { pitch: 4, d: 2.8, color: 0x232529, material: paintedSteel(0x232529) }); sv.position.set(-W / 2 - 0.15, Y0 + 90, 20); sv.rotation.y = -Math.PI / 2; g.add(sv);
  g.add(at(box(0.4, 110, 150, mat(0x050506)), -W / 2 + 0.6, Y0 + 90, 20));
  return named(g, "device:Desktop PC", { type: "pc", w: W, h: H + Y0, d: D });
}

/* a 120 mm case fan behind its wire finger guard, facing +Z */
function fanUnit(d) {
  const g = new THREE.Group(), half = d / 2, sp = d * 0.875 / 2;
  g.add(at(new THREE.Mesh(new THREE.CircleGeometry(half - 3, 64), mat(0x050506)), 0, 0, -2.5));    // the dark behind
  const fm = plastic(0x202226, { rough: 0.42 });
  /* the fan's square frame behind the panel, its corners showing round the cut-out */
  const fr = new THREE.Shape(); fr.moveTo(-half, -half); fr.lineTo(half, -half); fr.lineTo(half, half); fr.lineTo(-half, half); fr.closePath();
  const frh = new THREE.Path(); frh.absarc(0, 0, half - 2, 0, Math.PI * 2, true); fr.holes.push(frh);
  g.add(at(new THREE.Mesh(new THREE.ExtrudeGeometry(fr, { depth: 3, bevelEnabled: false, curveSegments: 48 }), fm), 0, 0, -2.4));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { g.add(at(screw(2.7, 0x8d9096), c[0] * sp, c[1] * sp, 0.65)); });
  /* blades, swept, round the hub */
  const blade = new THREE.Shape(); blade.moveTo(0, 0); blade.bezierCurveTo(d * 0.12, d * 0.05, d * 0.2, d * 0.2, d * 0.17, d * 0.4); blade.bezierCurveTo(d * 0.08, d * 0.3, d * 0.02, d * 0.15, -d * 0.04, d * 0.06); blade.closePath();
  const bg = new THREE.ExtrudeGeometry(blade, { depth: 1.2, bevelEnabled: true, bevelSize: 0.4, bevelThickness: 0.4, bevelSegments: 2 });
  for (let k = 0; k < 7; k++) { const b = new THREE.Mesh(bg, fm); b.position.z = -8; b.rotation.set(0, 0.25, k / 7 * Math.PI * 2); g.add(b); }
  g.add(at(cyl(d * 0.17, 6, fm, 40), 0, 0, -6, Math.PI / 2));
  g.add(at(new THREE.Mesh(new THREE.CircleGeometry(d * 0.13, 40), mat(0x1f2023, { rough: 0.4 })), 0, 0, -2.95));

  /* the guard: rings, and four spokes out to the screws */
  const wm = mat(0x16171a, { metal: 0.5, rough: 0.4 });
  [0.16, 0.27, 0.38, 0.47].forEach(function (f) { g.add(at(new THREE.Mesh(new THREE.TorusGeometry(d * f, 0.75, 8, 72), wm), 0, 0, 2.2)); });
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2, L = Math.hypot(sp, sp) - 3; const s = cyl(0.75, L, wm, 8); s.position.set(Math.cos(a) * L / 2, Math.sin(a) * L / 2, 2.2); s.rotation.z = a - Math.PI / 2; g.add(s); }
  g.add(at(cyl(d * 0.09, 1.2, wm, 32), 0, 0, 2.2, Math.PI / 2));
  return named(g, "fan", { type: "fan", d: d });
}

/* ----------------------------------------------------------- laptop */
/* A 14-inch laptop, lid open, as in the photo of its port side:
   brushed aluminium with a polished chamfer, the drop-jaw ETHERNET port
   (open round the plug, its link and activity lights on), two blue
   SuperSpeed USB-A in black frames, USB-C, the headset jack, each with
   its label above, and the vents. On screen: Command Prompt. */
/* o.screen: the lines in the Command Prompt window (ipconfig, as photographed, by default) */
export function laptop(o = {}) {
  const g = new THREE.Group(), W = 324, D = 226, HL = 8.5, HU = 12.5, H = HL + HU;
  /* bead-blasted aluminium: a fine, even matte metal (not brushed) */
  const alu = mat(0xb3b7bd, { metal: 0.8, rough: 0.4, grain: 0.03, scale: 0.12 }), aluDark = mat(0x9a9ea4, { metal: 0.75, rough: 0.45, grain: 0.03, scale: 0.12 });
  g.add(at(rbox(W - 3, HL, D - 3, 2.5, aluDark), 0, HL / 2 + 0.5, 0));                       // the bottom cover, stepped in
  g.add(at(rbox(W, HU, D, 2.6, alu), 0, HL + HU / 2 + 0.5, 0));
  const chamfer = mat(0xe4e7eb, { metal: 1, rough: 0.12, grain: false });                    // the polished, diamond-cut edge
  g.add(at(box(0.9, 0.9, D - 6, chamfer), -W / 2 + 0.5, H + 0.15, 0, 0, 0, Math.PI / 4)); g.add(at(box(0.9, 0.9, D - 6, chamfer), W / 2 - 0.5, H + 0.15, 0, 0, 0, Math.PI / 4));
  g.add(at(box(W - 6, 0.9, 0.9, chamfer), 0, H + 0.15, D / 2 - 0.5, Math.PI / 4, 0, 0));
  [[-120, 85], [120, 85], [-120, -85], [120, -85]].forEach(function (p) { g.add(at(rbox(60, 1.2, 8, 0.6, rubber(0x1b1c1e)), p[0], 0.6, p[1])); });
  /* the deck: the keyboard in its well, the glass trackpad */
  const deck = new THREE.Group(); at(deck, 0, H + 0.5, 0, -Math.PI / 2, 0, 0); g.add(deck);
  deck.add(at(rbox(292, 120, 0.8, 2, mat(0x24262a, { rough: 0.7 })), 0, 38, -0.3));
  keyboard(deck, 0, 36);
  deck.add(at(rbox(120, 70, 0.8, 4, mat(0xc3c6cb, { metal: 0.3, rough: 0.22, grain: 0.02 })), 0, -66, -0.2));
  /* the hinge and the lid, open about 110 degrees */
  g.add(at(cyl(4.6, W - 70, mat(0x2a2c30, { metal: 0.5, rough: 0.4 }), 24), 0, H + 1.5, -D / 2 + 6, 0, 0, Math.PI / 2));
  const lid = new THREE.Group(); lid.position.set(0, H + 1.5, -D / 2 + 6); lid.rotation.x = -0.33; g.add(lid);
  lid.add(at(rbox(W, 214, 5.5, 3.5, alu), 0, 108, -2.4));
  lid.add(at(box(W - 4, 210, 0.4, gloss(0x0b0b0c, { rough: 0.1 })), 0, 108, 0.4));             // the black glass over the bezel
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(300, 187.5), new THREE.MeshBasicMaterial({ map: cmdScreen(o.screen), toneMapped: false }));
  scr.position.set(0, 114, 0.65); lid.add(scr);
  lid.add(at(new THREE.Mesh(new THREE.CircleGeometry(1.2, 20), mat(0x15233a, { metal: 0.6, rough: 0.1, grain: false })), 0, 210.5, 0.66));   // the webcam
  /* the left side: ports from the hinge end forward, labels above */
  const side = new THREE.Group(); side.name = "panel:Left side ports"; at(side, -W / 2, 0, 0, 0, -Math.PI / 2); g.add(side);
  const py = 11.4, ly = 19.0, lab = function (s, x, w) { side.add(at(text(s, w * 1.2, 2.9, { color: "#2a2d32", weight: "700" }), x, ly, 0.05)); };
  const eth = rj45Jack({ name: "ETHERNET", metal: true, on: [true, true], jaw: "open" }); eth.scale.setScalar(0.92); side.add(at(eth, -70, py - 0.4, 0));
  lab("<\u00b7\u00b7\u00b7> ETHERNET", -70, 22);
  const ep = patch(eth, { boot: 0x585c61, jacket: 0x585c61 });
  [[-44, "SS USB-A"], [-24, "SS USB-A"]].forEach(function (u, i) { side.add(at(usbA("SS USB-A " + (i + 1), true, { frame: 0x1a1b1d }), u[0], py, 0)); lab(u[1], u[0], 16); });
  side.add(at(usbC("USB-C"), -7, py, 0)); lab("USB-C", -7, 11);
  const aj = new THREE.Group(); at(aj, 7, py, 0); side.add(aj);
  aj.add(at(cyl(3.2, 0.8, mat(0x1a1b1d, { rough: 0.4 }), 28), 0, 0, 0.4, Math.PI / 2)); aj.add(at(new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.35, 8, 28), mat(0xc9ccd0, { metal: 1, rough: 0.3 })), 0, 0, 0.85));
  aj.add(at(new THREE.Mesh(new THREE.CircleGeometry(1.75, 24), mat(COL.hole)), 0, 0, 0.82)); named(aj, "port:AUDIO", { type: "audio", combo: true });
  lab("AUDIO", 7, 11);
  /* vents: angled slits near the front, and by the hinge */
  for (let k = 0; k < 12; k++) side.add(at(box(1.4, 5.2, 0.5, mat(0x0c0c0d)), 38 + k * 4.2, 4.8, 0.05, 0, 0, -0.45));
  for (let k = 0; k < 5; k++) side.add(at(box(1.4, 5.2, 0.5, mat(0x0c0c0d)), -104 + k * 4.2, 4.8, 0.05, 0, 0, -0.45));
  /* the patch cable out of the drop-jaw, down to the bench and away */
  cableFrom(g, ep, [[-W / 2 - 46, 10, 72], [-W / 2 - 72, 3.05, 92], [-W / 2 - 110, 3.05, 150], [-W / 2 - 140, 3.05, 260]], { straight: 20 });
  return named(g, "device:Laptop", { type: "laptop", w: W, h: 230, d: D });
}
/* the keyboard: keys with their legends, six rows of fifteen units */
function keyboard(deck, cx, cy) {
  const u = 18.4, cap = 16, km = plastic(0x2c2e32, { rough: 0.5 });
  const R = [
    [["Esc", 1], ["F1", 1], ["F2", 1], ["F3", 1], ["F4", 1], ["F5", 1], ["F6", 1], ["F7", 1], ["F8", 1], ["F9", 1], ["F10", 1], ["F11", 1], ["F12", 1], ["Del", 1], ["\u23fb", 1]],
    [["`", 1], ["1", 1], ["2", 1], ["3", 1], ["4", 1], ["5", 1], ["6", 1], ["7", 1], ["8", 1], ["9", 1], ["0", 1], ["-", 1], ["=", 1], ["Backspace", 2]],
    [["Tab", 1.5], ["Q", 1], ["W", 1], ["E", 1], ["R", 1], ["T", 1], ["Y", 1], ["U", 1], ["I", 1], ["O", 1], ["P", 1], ["[", 1], ["]", 1], ["\\", 1.5]],
    [["Caps", 1.75], ["A", 1], ["S", 1], ["D", 1], ["F", 1], ["G", 1], ["H", 1], ["J", 1], ["K", 1], ["L", 1], [";", 1], ["'", 1], ["Enter", 2.25]],
    [["Shift", 2.25], ["Z", 1], ["X", 1], ["C", 1], ["V", 1], ["B", 1], ["N", 1], ["M", 1], [",", 1], [".", 1], ["/", 1], ["Shift", 2.75]],
    [["Ctrl", 1.25], ["Fn", 1], ["", 1], ["Alt", 1.25], ["", 5.5], ["Alt", 1], ["Ctrl", 1], ["\u25c0", 1], ["\u25b2\u25bc", 1], ["\u25b6", 1]]
  ];
  const Wk = 15 * u, Hk = 6 * u, yc = 0.2 * u, px = 8;
  const c = document.createElement("canvas"); c.width = Math.ceil(Wk * px); c.height = Math.ceil(Hk * px); const t = c.getContext("2d");
  t.fillStyle = "#e3e6ea"; t.textAlign = "center"; t.textBaseline = "middle";
  R.forEach(function (row, r) {
    let x = -Wk / 2; const kh = r === 0 ? cap * 0.6 : cap, y = r === 0 ? 2.5 * u + u * 0.3 : 2.5 * u - r * u + u * 0.1;
    row.forEach(function (k) {
      const w = k[1] * u - (u - cap), kx = x + k[1] * u / 2;
      deck.add(at(rbox(w, kh, 1.8, 1.4, km), cx + kx, cy + y, 1.0));
      if (k[0]) { t.font = "600 " + (k[0].length > 2 ? 3.0 : r === 0 ? 3.0 : 4.6) * px + "px Arial, Helvetica, sans-serif";
        t.fillText(k[0], (kx + Wk / 2) * px, (Hk / 2 - (y - yc)) * px); }
      x += k[1] * u;
    });
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const leg = new THREE.Mesh(new THREE.PlaneGeometry(Wk, Hk), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }));
  leg.position.set(cx, cy + yc, 1.93); leg.userData.print = true; leg.renderOrder = 2; deck.add(leg);
}
/* what's on the screen: the desktop, and Command Prompt showing ipconfig
   exactly as Windows prints it (the dot leaders end in one column) */
function cmdScreen(lines) {
  const c = document.createElement("canvas"); c.width = 1600; c.height = 1000; const g = c.getContext("2d");
  const bg = g.createLinearGradient(0, 0, 1600, 1000); bg.addColorStop(0, "#1e3a8a"); bg.addColorStop(1, "#4c1d95"); g.fillStyle = bg; g.fillRect(0, 0, 1600, 1000);
  g.fillStyle = "#1b1d22"; g.fillRect(0, 944, 1600, 56);                                   // the taskbar
  g.fillStyle = "#e9ecf2"; g.font = "500 22px 'Segoe UI', Arial, sans-serif"; g.textAlign = "right"; g.textBaseline = "middle"; g.fillText("10:42 AM", 1570, 962); g.fillText("10/10/2026", 1570, 986);
  const x0 = 110, y0 = 70, w = 1380, h = 820;
  g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(x0 + 8, y0 + 10, w, h);
  g.fillStyle = "#f3f3f3"; g.fillRect(x0, y0, w, 46);                                      // the title bar
  g.fillStyle = "#1b1b1b"; g.textAlign = "left"; g.font = "500 24px 'Segoe UI', Arial, sans-serif"; g.fillText("Command Prompt", x0 + 56, y0 + 24);
  g.fillStyle = "#0c0c0c"; g.fillRect(x0 + 16, y0 + 12, 26, 22); g.fillStyle = "#cccccc"; g.font = "700 14px Consolas, monospace"; g.fillText(">_", x0 + 19, y0 + 24);
  g.strokeStyle = "#1b1b1b"; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + w - 150, y0 + 24); g.lineTo(x0 + w - 132, y0 + 24); g.stroke(); g.strokeRect(x0 + w - 92, y0 + 15, 18, 18);
  g.beginPath(); g.moveTo(x0 + w - 40, y0 + 14); g.lineTo(x0 + w - 20, y0 + 34); g.moveTo(x0 + w - 20, y0 + 14); g.lineTo(x0 + w - 40, y0 + 34); g.stroke();
  g.fillStyle = "#0c0c0c"; g.fillRect(x0, y0 + 46, w, h - 46);
  const L = lines || ["C:\\Users\\tech>ipconfig", "", "Windows IP Configuration", "", "",
    "Ethernet adapter Ethernet:", "", "   Connection-specific DNS Suffix  . : home",
    "   IPv4 Address. . . . . . . . . . . : 192.168.1.23", "   Subnet Mask . . . . . . . . . . . : 255.255.255.0", "   Default Gateway . . . . . . . . . : 192.168.1.1",
    "", "C:\\Users\\tech>_"];
  g.fillStyle = "#cccccc"; g.font = "500 30px Consolas, 'DejaVu Sans Mono', 'Courier New', monospace"; g.textBaseline = "top";
  L.forEach(function (l, i) { g.fillText(l, x0 + 22, y0 + 66 + i * 46); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* ---------------------------------------------------------- printer */
/* A desktop laser printer, two-tone as in the photos: charcoal top
   cover, light grey body. The control panel: the colour screen showing
   STATUS ONLINE and the IP address, the amber light, POWER (lit green),
   CANCEL, the round arrow pad with OK, STATUS. The back: the port plate
   with NETWORK (link and activity lights, the patch cable plugged in),
   USB (B), SERIAL, each in its printed box; the mains inlet and switch. */
/* o.screen: { status, ip } on the control panel (ONLINE, 192.168.1.100 by default) */
export function networkPrinter(o = {}) {
  const g = new THREE.Group(), W = 400, D = 390, HB = 200, HT = 96, Y0 = 4, top = Y0 + HB + HT;
  const body = plastic(0xe8e8e4, { rough: 0.5 }), cover = plastic(0x2d3034, { rough: 0.45 });
  g.add(at(rbox(W, HB, D, 8, body), 0, Y0 + HB / 2, 0));
  /* the top cover, its front edge sloped back where the control panel sits */
  const cz = 64, cyy = 34, prof = new THREE.Shape(); const pts = [[-D / 2, 0], [D / 2, 0], [D / 2, cyy], [D / 2 - cz, HT], [-D / 2, HT]];
  pts.forEach(function (q, i) { if (i) prof.lineTo(-q[0], q[1]); else prof.moveTo(-q[0], q[1]); }); prof.closePath();
  const cg = new THREE.ExtrudeGeometry(prof, { depth: W - 8, bevelEnabled: true, bevelSize: 4, bevelOffset: -4, bevelThickness: 4, bevelSegments: 3 });
  const cm = new THREE.Mesh(cg, cover); cm.rotation.y = Math.PI / 2; cm.position.set(-W / 2 + 4, Y0 + HB, 0); g.add(cm);
  g.add(at(box(W + 0.2, 1.2, D + 0.2, mat(0x101113)), 0, Y0 + HB, 0));                                   // the seam
  [[-170, 165], [170, 165], [-170, -165], [170, -165]].forEach(function (p) { g.add(at(cyl(9, Y0, rubber(0x202124)), p[0], Y0 / 2, p[1])); });
  /* the top: the output tray in the cover, the exit slot, the paper stop */
  g.add(at(rbox(250, 1.2, 225, 6, plastic(0x23262a, { rough: 0.55 })), -40, top + 0.2, -18));
  g.add(at(box(236, 1.2, 6, mat(0x050506)), -40, top + 0.6, -124));
  const stop = rbox(72, 24, 1.6, 1.5, plastic(0x23262a)); stop.position.set(-40, top + 11, 92); stop.rotation.x = 0.4; g.add(stop);
  /* the front: the paper cassette and its handle, the toner door's pull */
  const front = new THREE.Group(); at(front, 0, 0, D / 2); g.add(front);
  front.add(at(rbox(W - 24, 74, 3, 3, body), 0, Y0 + 44, 1.2));
  front.add(at(rbox(120, 10, 4, 4, mat(0x2a2c30, { rough: 0.6 })), 0, Y0 + 74, 1.6));
  front.add(at(box(24, 6, 0.6, mat(0x5d6168, { rough: 0.3 })), -150, Y0 + 44, 2.9));                 // the paper gauge window
  front.add(at(box(W - 24, 0.8, 0.6, mat(0x9b9fa5)), 0, Y0 + 132, 0.3));
  front.add(at(rbox(140, 9, 3, 4, mat(0x2a2c30, { rough: 0.6 })), -60, Y0 + HB - 14, 1.0));
  /* the control panel, a wedge on the top cover's front corner */
  const sl = Math.atan2(HT - cyy, cz), cp = new THREE.Group(); cp.name = "panel:Control panel";
  cp.position.set(100, Y0 + HB + (cyy + HT) / 2 + Math.cos(sl) * 2.2, D / 2 - cz / 2 + Math.sin(sl) * 2.2); cp.rotation.x = -(Math.PI / 2 - sl); g.add(cp);
  cp.add(rbox(170, 84, 4.4, 4, plastic(0x2a2d31, { rough: 0.42 })));
  const fz = 2.25;
  cp.add(at(ink("CONTROL PANEL", 44, 4.2, { weight: "500" }), -52, 36, fz)); cp.add(at(ink("NP-1000 SERIES", 44, 4.2, { weight: "500" }), 52, 36, fz));
  cp.add(at(rbox(96, 54, 1.2, 3, gloss(0x08090a, { rough: 0.08 })), -18, 6, fz + 0.2));
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(88, 49), new THREE.MeshBasicMaterial({ map: printerScreen(o.screen), toneMapped: false })); lcd.position.set(-18, 6, fz + 0.85); cp.add(lcd);
  cp.add(at(ledPipeAmber(), -80.5, 10, fz - 0.4));
  /* POWER: round, its ring lit green */
  const pw = new THREE.Group(); at(pw, -54, -30, fz); cp.add(pw);
  pw.add(at(cyl(6.6, 2.4, plastic(0x1b1d20, { rough: 0.35 }), 32), 0, 0, 1, Math.PI / 2));
  pw.add(at(new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.7, 10, 40), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x2bff5a, emissiveIntensity: 0.95 })), 0, 0, 2.25));
  pw.add(at(text("⏻", 6.5, 6.5, { color: "#5dff86", weight: "900", screen: true }), 0, 0, 2.3)); named(pw, "button:POWER", { type: "button", lit: true });
  cp.add(at(ink("POWER", 15, 3.4), -54, -19.6, fz));
  const cn = new THREE.Group(); at(cn, -28, -30, fz); cp.add(cn);
  cn.add(at(cyl(6.6, 2.4, plastic(0x1b1d20, { rough: 0.35 }), 32), 0, 0, 1, Math.PI / 2));
  cn.add(at(text("✕", 6.5, 6.5, { color: "#ff4d45", weight: "900" }), 0, 0, 2.3)); named(cn, "button:CANCEL", { type: "button" });
  cp.add(at(ink("CANCEL", 16, 3.4), -28, -19.6, fz));
  /* the arrow pad and OK */
  const dp = new THREE.Group(); at(dp, 50, -20, fz); cp.add(dp);
  dp.add(at(cyl(15, 2.2, plastic(0x1b1d20, { rough: 0.38 }), 48), 0, 0, 0.9, Math.PI / 2));
  dp.add(at(cyl(6.2, 3.2, plastic(0x26292d, { rough: 0.35 }), 32), 0, 0, 1.4, Math.PI / 2));
  [[0, 10.5, 0], [0, -10.5, Math.PI], [-10.5, 0, Math.PI / 2], [10.5, 0, -Math.PI / 2]].forEach(function (a) { const t = text("▲", 3.4, 3.4, { color: "#e6e8ec", weight: "900" }); t.rotation.z = a[2]; dp.add(at(t, a[0], a[1], 2.05)); t.rotation.z = a[2]; });
  named(dp, "button:ARROWS", { type: "dpad" });
  /* STATUS, with its amber icon */
  const stb = new THREE.Group(); at(stb, 64, 14, fz); cp.add(stb);
  stb.add(at(rbox(15, 10, 2.4, 2, plastic(0x1b1d20, { rough: 0.35 })), 0, 0, 1));
  stb.add(at(text("⚠", 5.5, 5.5, { color: "#ffb03a", weight: "900", screen: true }), 0, 0, 2.3)); named(stb, "button:STATUS", { type: "button" });
  cp.add(at(ink("STATUS", 16, 3.4), 64, 23, fz));
  /* sides: vents, and the hand grips for lifting */
  [-1, 1].forEach(function (sd) {
    const v = slots(16, 3, 46, 7, true); at(v, sd * (W / 2 + 0.1), Y0 + HB + 50, -40, 0, sd * Math.PI / 2); g.add(v);
    g.add(at(rbox(1.6, 18, 110, 6, mat(0x3a3c40, { rough: 0.7 })), sd * (W / 2 - 0.2), Y0 + 24, 0));
  });
  /* the back */
  const back = new THREE.Group(); at(back, 0, 0, -D / 2, 0, BACK); g.add(back);
  back.add(at(box(W - 16, HB - 16, 0.6, plastic(0xdcdcd8)), 0, Y0 + HB / 2, 0.3));
  const pp = new THREE.Group(); pp.name = "panel:Ports"; at(pp, -88, Y0 + 72, 0.6); back.add(pp);
  pp.add(at(rbox(176, 62, 1.6, 3, plastic(0xcfd0cd, { rough: 0.45 })), 0, 0, 0.8));
  pp.add(at(printLines(176, 62, [[-58, 0, 46, 54, 2]], { color: "#3a3d42", width: 0.4 }), 0, 0, 1.62));
  pp.add(at(box(0.5, 50, 0.1, mat(0x3a3d42)), -30, 0, 1.62));                                                  // the divider
  pp.add(at(text("<···> NETWORK", 40, 5, { color: "#2a2d32", weight: "700" }), -58, 19, 1.65));
  const nj = rj45Jack({ name: "NETWORK", metal: true, on: [true, true] }); at(nj, -58, 2, 1.6); pp.add(nj);
  pp.add(at(text("LINK / ACT", 34, 4.4, { color: "#2a2d32", weight: "600" }), -58, -17, 1.65));
  pp.add(at(text("USB (B)", 26, 4.6, { color: "#2a2d32", weight: "600" }), -8, 14, 1.65));
  const ub = usbB("USB"); at(ub, -8, 1, 1.6); pp.add(ub);
  pp.add(at(text("SERIAL", 26, 4.6, { color: "#2a2d32", weight: "600" }), 44, 14, 1.65));
  const sr = db9("SERIAL"); at(sr, 44, 1, 1.6); pp.add(sr);
  const np = patch(nj, { boot: 0x5e6267, jacket: 0x5e6267 });
  const inlet = iecInlet("AC IN"); at(inlet, 120, Y0 + 60, 0.6); back.add(inlet); back.add(at(rocker("POWER SWITCH"), 152, Y0 + 60, 0.6));
  const plug = iecC13(); plug.rotation.y = Math.PI; plug.position.set(0, 0, 0.5); inlet.add(plug);
  const st = label(["NETWORK PRINTER · NP-1000", "S/N: " + COVERED, "MAC: " + COVERED, "110-127V~ 50/60Hz 7.5A"], { w: 64, h: 34, barcode: "np-sn", marks: true });
  at(st, 70, Y0 + 150, 0.6); back.add(st);
  back.add(at(perforated(160, 40, { pitch: 3.6, d: 2.4, shape: "slot", material: plastic(0x2d3034) }), -60, Y0 + HB + 50, 0.2));
  back.add(at(box(160, 40, 0.3, mat(0x060607)), -60, Y0 + HB + 50, 0.05));
  cableFrom(g, np, [[146 - 30, 40, -D / 2 - 55], [146 - 50, 3.05, -D / 2 - 110], [146 - 120, 3.05, -D / 2 - 300]], { straight: 22 });
  cableFrom(g, plug, [[-120 - 10, 20, -D / 2 - 60], [-120 - 30, 3.9, -D / 2 - 110], [-120 - 90, 3.9, -D / 2 - 300]], { straight: 16 });
  return named(g, "device:Network printer", { type: "printer", w: W, h: top, d: D });
}
function ledPipeAmber() {
  const m = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 1.2), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffa21a, emissiveIntensity: 0.95 }));
  m.userData = { kind: "led", color: 0xffa21a, on: true, role: "attention" }; return m;
}
/* the printer's colour screen, as in the photo (wording corrected) */
function printerScreen(sc) {
  sc = sc || { status: "ONLINE (192.168.1.100)", ip: "192.168.1.100" };
  const c = document.createElement("canvas"); c.width = 880; c.height = 490; const g = c.getContext("2d");
  g.fillStyle = "#f4f7fb"; g.fillRect(0, 0, 880, 490);
  g.fillStyle = "#dde7f3"; g.fillRect(0, 0, 880, 104);
  g.strokeStyle = "#2a5ea8"; g.lineWidth = 5; g.beginPath(); g.arc(46, 52, 21, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#2a5ea8"; g.font = "700 30px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("i", 46, 53);
  g.textAlign = "left"; g.fillStyle = "#1a2433"; g.font = "700 46px Arial, sans-serif"; g.fillText("STATUS:", 90, 54);
  g.fillStyle = "#bcd3ee"; g.fillRect(0, 112, 880, 96);
  g.fillStyle = "#13233a"; g.font = "600 46px Arial, sans-serif"; g.fillText(sc.status, 60, 162);
  g.fillStyle = "#2f6fc0"; g.fillRect(0, 232, 880, 92);
  g.fillStyle = "#ffffff"; g.font = "700 44px Arial, sans-serif"; g.fillText("<···>  IP ADDRESS", 34, 280);
  g.fillStyle = "#13233a"; g.font = "600 46px Arial, sans-serif"; g.fillText(sc.ip, 60, 396);
  g.fillStyle = "#9fb3cc"; g.fillRect(60, 438, 300, 5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* --------------------------------------------------------- smart TV */
/* A 43-inch smart TV, as in the photo of its back: the silver-grey
   rear, the deep port bay with the ports standing on a black strip and
   their names in printed boxes beside them (HDMI 1 ARC/eARC to HDMI 4,
   USB 5V 0.5A, USB HDD, optical, AV in, antenna/cable in, DC in), the
   LAN port with the Ethernet cable plugged in. On screen: its network
   status page. */
/* o.screen: { connected, rows } for the network status page on screen */
export function smartTV(o = {}) {
  const g = new THREE.Group(), W = 970, H = 565, T = 8, Y0 = 82, cy = Y0 + H / 2;
  const silver = mat(0xb8bbc0, { metal: 0.3, rough: 0.42, grain: 0.05, scale: 0.5 });
  const panel = new THREE.Group(); at(panel, 0, cy, 0); g.add(panel);
  panel.add(rbox(W, H, T, 2.5, plastic(0x1b1c1f, { rough: 0.4 })));
  panel.add(at(box(W - 10, H - 18, 0.4, gloss(0x050607, { rough: 0.06 })), 0, 4, T / 2 + 0.05));
  const ui = new THREE.Mesh(new THREE.PlaneGeometry(W - 14, H - 24), new THREE.MeshBasicMaterial({ map: tvScreen(o.screen), toneMapped: false })); ui.position.set(0, 4, T / 2 + 0.3); panel.add(ui);
  panel.add(at(led(0xff3030, true, 1.1), 0, -H / 2 + 5, T / 2 + 0.3));                                       // the standby/IR window
  panel.add(at(box(W - 16, H - 16, 3, silver), 0, 0, -T / 2 - 1.4));                                          // the thin back
  /* the rear housing, with the port bay cut into it */
  const hw = 780, hh = 420, hd = 46, hy = -46, bx = 292, by = -40, bw = 128, bh = 340;
  const hs = rrShape(hw, hh, 26); hs.holes.push(rrPath(bw, bh, 12, bx * -1, by - hy));   // shape is drawn facing +Z; the back group flips x
  const hg = new THREE.ExtrudeGeometry(hs, { depth: hd - 18, bevelEnabled: true, bevelSize: 5, bevelThickness: 9, bevelSegments: 4, curveSegments: 16 });
  const housing = new THREE.Mesh(hg, silver); housing.position.set(0, hy, -T / 2 - 3 - 9 - (hd - 18)); panel.add(housing);   /* its back face lands where the back group starts */
  /* the back, seen from behind */
  const back = new THREE.Group(); at(back, 0, cy, -T / 2 - 3 - hd, 0, BACK); g.add(back);
  /* inside the bay: its floor, the black port strip, the silver label panel */
  const bay = new THREE.Group(); bay.name = "panel:Connection panel"; at(bay, bx, by, -22); back.add(bay);
  bay.add(at(box(bw + 2, bh + 2, 0.6, mat(0x0c0d0e)), 0, 0, -0.5));
  bay.add(at(rbox(30, bh - 14, 4, 2, plastic(0x141517, { rough: 0.5 })), -bw / 2 + 22, 0, 1.5));
  bay.add(at(rbox(76, bh - 14, 2, 2, mat(0xcfd2d6, { metal: 0.35, rough: 0.4, grain: 0.04 })), 17, 0, 1));
  const sx = -bw / 2 + 22, onEnd = function (p) { p.rotation.z = Math.PI / 2; return p; };
  const top = bh / 2 - 22, rows = [];
  for (let k = 0; k < 4; k++) { bay.add(at(onEnd(hdmi("HDMI " + (k + 1) + (k === 0 ? " (ARC/eARC)" : ""))), sx, top - k * 21, 3.5)); }
  bay.add(at(onEnd(usbA("USB 1", false)), sx, top - 92, 3.5)); bay.add(at(onEnd(usbA("USB 2 (HDD)", false)), sx, top - 112, 3.5));
  const lan = rj45Jack({ name: "LAN", metal: true, on: [true, true] }); at(lan, sx, top - 136, 3.5); bay.add(lan);
  [[0xd8302b, "AUDIO R"], [0xf1f1ee, "AUDIO L"], [0xf2c200, "VIDEO"]].forEach(function (r, i) { bay.add(at(rca(r[1], r[0]), sx, top - 160 - i * 14, 3.5)); });
  bay.add(at(fFemale("ANT/CABLE IN"), sx, top - 222, 3.5)); bay.add(at(dcJack("DC IN"), sx, top - 250, 3.5));
  /* the printed boxes and names */
  const pl = function (s, x, y, w, h) { bay.add(at(text(s, w, h, { color: "#16181b", weight: "700" }), x, y, 2.05)); };
  const boxes = [[18, top - 31, 72, 86, 2], [18, top - 102, 72, 38, 2], [18, top - 160 + 6, 72, 44, 2], [18, top - 160 - 30, 72, 26, 2], [18, top - 222, 72, 28, 2], [18, top - 250, 72, 22, 2]];
  bay.add(at(printLines(80, bh - 14, boxes.map(function (b) { return [b[0] - 18, b[1], b[2], b[3], b[4]]; }), { color: "#3a3d42", width: 0.5 }), 18, 0, 2.02));
  pl("HDMI 1", 12, top + 2, 40, 7); pl("(ARC/eARC)", 12, top - 5.5, 40, 5); pl("HDMI 2", 12, top - 21, 40, 7); pl("HDMI 3", 12, top - 42, 40, 7); pl("HDMI 4", 12, top - 63, 40, 7);
  bay.add(at(box(0.6, 64, 0.1, mat(0x3a3d42)), 44, top - 31, 2.05)); const k4 = text("4K", 12, 5.5, { color: "#16181b", weight: "700" }); k4.rotation.z = Math.PI / 2; bay.add(at(k4, 49, top - 31, 2.05));
  pl("USB", 17, top - 89, 30, 6.5); pl("(5V \u2393 0.5A)", 17, top - 95.5, 50, 5); pl("USB", 17, top - 107, 30, 6.5); pl("(HDD)", 17, top - 113.5, 30, 5);
  const opt = opticalToslink(); at(opt, -9, top - 150, 2.2); bay.add(opt);
  pl("OPTICAL", 25, top - 143, 40, 6); pl("DIGITAL", 25, top - 150, 40, 6); pl("AUDIO OUT", 25, top - 157, 42, 6);
  pl("AV IN", 17, top - 186, 30, 6.5); pl("(COMPOSITE/AUDIO)", 17, top - 193, 60, 4.6);
  pl("ANTENNA /", 17, top - 218, 46, 6); pl("CABLE IN", 17, top - 225.5, 46, 6);
  pl("DC IN", 17, top - 246, 30, 6); pl("(19V \u2393 3.42A)", 17, top - 253, 50, 4.6);
  /* outside the bay: ETHERNET and the network icon, the label, VESA, speakers */
  back.add(at(text("ETHERNET", 34, 5.4, { color: "#2b2e33", weight: "700" }), bx - bw / 2 - 30, by + top - 132, 0.4));
  back.add(at(lanIcon("#2b2e33"), bx - bw / 2 - 30, by + top - 144, 0.4));
  const lb = label(["SMART TV · MODEL ST-43", "S/N: " + COVERED, "MAC (LAN): " + COVERED, "19V ⎓ 3.42A"], { w: 76, h: 40, barcode: "tv-sn", marks: true });
  at(lb, bx - bw / 2 - 90, by - 70, 0.3); back.add(lb);
  [[-100, -100], [100, -100], [-100, 100], [100, 100]].forEach(function (p) {
    back.add(at(new THREE.Mesh(new THREE.RingGeometry(2.6, 5.2, 24), mat(0x9a9ea4, { metal: 0.9, rough: 0.3 })), p[0] - 60, p[1] + 10, 0.3));
    back.add(at(new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), mat(0x050506)), p[0] - 60, p[1] + 10, 0.31));
  });
  [-220, 60].forEach(function (x) { back.add(at(perforated(170, 26, { pitch: 3.4, d: 2.2, material: mat(0xb8bbc0, { metal: 0.3, rough: 0.42 }) }), x, hy - hh / 2 + 34, 0.4)); back.add(at(box(170, 26, 0.3, mat(0x08090a)), x, hy - hh / 2 + 34, 0.1)); });
  /* the Ethernet cable out of the bay, down behind the stand to the bench */
  const tp = patch(lan, { boot: 0x2a2c30, jacket: 0x2a2c30 });
  cableFrom(g, tp, [[-bx + 80, cy + by + top - 170, -T / 2 - hd - 46], [-bx + 120, cy - 220, -T / 2 - hd - 66], [-bx + 150, 3.05, -T / 2 - hd - 100], [-bx + 260, 3.05, -T / 2 - hd - 260]], { straight: 18 });
  /* feet: an upside-down V at each end, brushed metal */
  const legM = brushed(0xaeb2b7, "y", { rough: 0.32 });
  [-400, 400].forEach(function (x) {
    const f = new THREE.Group(); f.position.set(x, 0, 0); g.add(f);
    f.add(at(box(24, 12, 16, legM), 0, Y0 - 4, 0));
    [-1, 1].forEach(function (sd) {
      const a = V(0, Y0 + 2, 0), b = V(0, 1.5, sd * 78), len = a.distanceTo(b);
      const leg = box(16, len, 9, legM); leg.position.copy(a).add(b).multiplyScalar(0.5); leg.rotation.x = -sd * Math.atan2(78, Y0 + 0.5); f.add(leg);
      f.add(at(box(18, 3, 24, rubber(0x18191b)), 0, 1.5, sd * 78));
    });
  });
  return named(g, "device:Smart TV", { type: "tv", w: W, h: H + Y0, d: 120 });
}
function rca(name, color) {
  const g = new THREE.Group();
  g.add(at(cyl(4.6, 2.5, mat(color, { rough: 0.4 }), 28), 0, 0, 1.25, Math.PI / 2));
  g.add(at(cyl(3.6, 4.5, mat(0xd6d9dd, { metal: 1, rough: 0.25 }), 28), 0, 0, 4.2, Math.PI / 2));
  g.add(at(new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), mat(COL.hole)), 0, 0, 6.5));
  return named(g, "port:" + name, { type: "rca" });
}
function lanIcon(color) {
  const c = document.createElement("canvas"); c.width = 160; c.height = 120; const x = c.getContext("2d");
  x.strokeStyle = color; x.lineWidth = 9; x.strokeRect(58, 8, 44, 34); x.strokeRect(10, 78, 44, 34); x.strokeRect(106, 78, 44, 34);
  x.beginPath(); x.moveTo(80, 42); x.lineTo(80, 60); x.moveTo(32, 78); x.lineTo(32, 60); x.lineTo(128, 60); x.lineTo(128, 78); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 10.5), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.6 })); m.userData.print = true; return m;
}
/* the TV's network status page */
function tvScreen(sc) {
  const c = document.createElement("canvas"); c.width = 1920; c.height = 1080; const g = c.getContext("2d");
  const bg = g.createLinearGradient(0, 0, 1920, 1080); bg.addColorStop(0, "#0d1b3d"); bg.addColorStop(1, "#1d1147"); g.fillStyle = bg; g.fillRect(0, 0, 1920, 1080);
  g.fillStyle = "#b9c6e6"; g.font = "500 40px Arial, sans-serif"; g.textBaseline = "middle"; g.fillText("Settings  ›  Network", 110, 110);
  g.fillStyle = "#ffffff"; g.font = "700 76px Arial, sans-serif"; g.fillText("Network Status", 110, 200);
  const ok = !sc || sc.connected;
  g.fillStyle = ok ? "#7ee08a" : "#ff8a80"; g.font = "700 50px Arial, sans-serif"; g.fillText(ok ? "✓  Wired (LAN): Connected" : "✕  Wired (LAN): Not connected", 110, 320);
  const rows = sc ? sc.rows : [["IP address", "192.168.1.42"], ["Subnet mask", "255.255.255.0"], ["Gateway", "192.168.1.1"], ["DNS server", "192.168.1.1"], ["MAC address", "██:██:██:██:██:██"]];
  rows.forEach(function (r, i) { g.fillStyle = "#b9c6e6"; g.font = "500 46px Arial, sans-serif"; g.fillText(r[0], 110, 440 + i * 84); g.fillStyle = "#ffffff"; g.font = "700 46px Arial, sans-serif"; g.fillText(r[1], 560, 440 + i * 84); });
  g.fillStyle = "#2557d6"; g.fillRect(110, 900, 440, 86); g.fillStyle = "#ffffff"; g.font = "700 44px Arial, sans-serif"; g.fillText("Test Connection", 150, 944);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/* Toslink optical out, with its dust flap */
function opticalToslink() {
  const g = new THREE.Group();
  g.add(at(rbox(10, 9, 2, 1, mat(COL.black, { rough: 0.5 })), 0, 0, 1));
  g.add(at(box(6.4, 5.6, 0.6, mat(0x3a3d42, { rough: 0.4 })), 0, 0, 2.1));
  return named(g, "port:OPTICAL", { type: "toslink" });
}

/* ----------------------------------------------------- IP camera */
/* A PoE turret camera, as in the photo: the white base with its grey
   foot, the black lens looking out of the white shroud, the label
   printed on the base (model, MAC covered, default IP) and its barcode,
   the recessed port pocket: the cable gland with the cable out of it,
   the gigabit PoE port with its lights on and the patch cable plugged
   in, and the rubber weather cap lying beside it. */
/* o.ipLine: the address line printed on the label ("IP: 192.168.1.50" by default); o.poe: the PoE class printed by the port
   ("PoE 802.3af" by default; build mode's camera with a heater says "PoE+ 802.3at": the same housing) */
export function ipCamera(o = {}) {
  const g = new THREE.Group(), R = 62, white = plastic(0xf3f3f0, { rough: 0.38 }), grey = plastic(0xb5b8bc, { rough: 0.5 });
  /* the wall, straight to 33 mm, then the shoulder up to the top at 44 */
  const PROF = [[7, R], [33, R], [37, R - 1.5], [41, R - 4.5], [44, R - 10]];
  const rAt = function (y) { for (let i = 1; i < PROF.length; i++) if (y <= PROF[i][0]) { const a = PROF[i - 1], b = PROF[i]; return a[1] + (b[1] - a[1]) * (y - a[0]) / (b[0] - a[0]); } return R - 10; };
  g.add(new THREE.Mesh(new THREE.LatheGeometry([V(0, 0), V(R - 1.5, 0), V(R - 0.5, 1.5), V(R - 0.5, 7.2), V(0, 7.2)].map(function (v) { return new THREE.Vector2(v.x, v.y); }), 72), grey));
  const pa = 0.42, pth = Math.PI / 2 - pa, pd = R - 6.5, py0 = 9, py1 = 27;
  g.add(new THREE.Mesh(pocketWall(PROF, rAt, pth, pd, py0, py1), white));
  g.add(at(cyl(R - 10, 0.5, white, 72), 0, 44, 0));
  /* the turret: a white collar, the shroud round the back, the black eyeball and its lens */
  g.add(at(cyl(48, 10, white, 72), 0, 49, 0));
  const sm = plastic(0xf3f3f0, { rough: 0.38 }); sm.side = THREE.DoubleSide;
  const axis = V(0, Math.cos(0.62), Math.sin(0.62)), hole = 0.6;
  const shroud = new THREE.Mesh(holedDome(47, axis, hole), sm); shroud.position.y = 55; g.add(shroud);
  const rimT = new THREE.Mesh(new THREE.TorusGeometry(47 * Math.sin(hole), 1.7, 12, 64), sm);
  rimT.quaternion.setFromUnitVectors(V(0, 0, 1), axis); rimT.position.copy(axis.clone().multiplyScalar(47 * Math.cos(hole))).add(V(0, 55, 0)); g.add(rimT);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(41, 48, 32), plastic(0x121315, { rough: 0.35 })); ball.position.y = 55; g.add(ball);
  const lens = new THREE.Group(); lens.position.set(0, 55, 0); lens.rotation.x = 0.62; g.add(lens);
  lens.add(at(cyl(21, 8, plastic(0x0e0f11, { rough: 0.3 }), 48), 0, 38, 0));
  lens.add(at(new THREE.Mesh(new THREE.TorusGeometry(17.5, 1.2, 12, 48), mat(0x2b2d31, { metal: 0.6, rough: 0.3 })), 0, 42.2, 0, Math.PI / 2));
  lens.add(at(new THREE.Mesh(new THREE.CircleGeometry(16.5, 48), new THREE.MeshPhysicalMaterial({ color: 0x0a1424, metalness: 0.6, roughness: 0.04, clearcoat: 1, envMapIntensity: 2.4 })), 0, 42.1, 0, -Math.PI / 2));
  lens.add(at(new THREE.Mesh(new THREE.TorusGeometry(10, 1.4, 10, 40), mat(0x1c1f25, { metal: 0.7, rough: 0.2 })), 0, 42.3, 0, Math.PI / 2));
  lens.add(at(new THREE.Mesh(new THREE.CircleGeometry(5.5, 32), new THREE.MeshPhysicalMaterial({ color: 0x1b2a4a, metalness: 0.8, roughness: 0.02, clearcoat: 1, envMapIntensity: 3 })), 0, 42.35, 0, -Math.PI / 2));
  /* the port pocket: the flat cut in the wall (pocketWall), its grey floor */
  const pk = new THREE.Group(); pk.name = "panel:PoE port";
  pk.position.set(Math.sin(pth) * pd, (py0 + py1) / 2, Math.cos(pth) * pd); pk.rotation.y = pth; g.add(pk);
  pk.add(at(rbox(44, 17.4, 0.4, 3, plastic(0xc4c7ca, { rough: 0.5 })), 0, 0, 0.2));
  /* the cable gland, the cable out of it */
  const gl = new THREE.Group(); at(gl, -12, 0, 0.4); pk.add(gl);
  gl.add(at(cyl(9.5, 3, rubber(0x6c7075), 36), 0, 0, 1.5, Math.PI / 2));
  gl.add(at(new THREE.Mesh(new THREE.TorusGeometry(7.2, 1.4, 12, 36), rubber(0x75797e)), 0, 0, 3.2));
  gl.add(at(new THREE.Mesh(new THREE.CircleGeometry(5.8, 32), mat(0x0b0b0c)), 0, 0, 3.05));
  const glCable = new THREE.Group(); at(glCable, 0, 0, 3.2); gl.add(glCable);
  glCable.userData.exitZ = 0; glCable.userData.cable = { r: 3.3, color: 0x4a4e53, text: "OUTDOOR CAT6 UTP  ·  UV RESISTANT  ·  23AWG", ink: "rgba(225,225,225,0.55)" };
  glCable.rotation.y = Math.PI;   /* cableFrom runs a cable off the -Z end */
  /* PoE port, with its PoE class printed beside it */
  const pj = rj45Jack({ name: "PoE", metal: true, on: [true, true] }); at(pj, 12.5, 0.4, 0.4); pk.add(pj);
  pk.add(at(up(text(o.poe || "PoE 802.3af", 18, 3, { color: "#2b2e33", weight: "700" })), 2.0, 0, 0.45));
  const cpl = patch(pj, { boot: 0x5e6267, jacket: 0x5e6267 });
  /* the printing on the base wall above the pocket, and the label */
  g.add(curvedPrint(["<···>  (Data + Power)  <···>", "Gigabit IP Camera Port · 10/100/1000"], 64, 5.6, pth, 30.2, rAt));
  g.add(curvedPrint(["MODEL: IPC-6000D", "MAC: " + COVERED, o.ipLine || "IP: 192.168.1.50"], 46, 12, 0.08, 24, rAt, { align: "left" }));
  g.add(curvedPrint(null, 40, 8, 0.05, 12.5, rAt, { barcode: "cam-mac", caption: "MAC: " + COVERED }));
  const sc = new THREE.Group(); const sa = 0.57; sc.position.set(Math.sin(sa) * (rAt(16) + 0.1), 16, Math.cos(sa) * (rAt(16) + 0.1)); sc.rotation.y = sa; g.add(sc);
  sc.add(at(new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), mat(0xd9dadb, { rough: 0.5 })), 0, 0, 0.05)); sc.add(at(screw(2.4, 0xc0c2c5), 0, 0, 0.1));
  /* the cables out to the floor, toward you: n is straight out of the pocket, f along the wall to the front */
  const n = V(Math.sin(pth), 0, Math.cos(pth)), f = V(-Math.cos(pth), 0, Math.sin(pth)), P0 = pk.position;
  const along = function (a, b, y) { return P0.clone().addScaledVector(n, a).addScaledVector(f, b).setY(y); };
  /* the gland's cable off to the front, the patch cable off to the other side, as photographed */
  cableFrom(g, cpl, [along(62, -14, 9), along(90, -30, 3.05), along(200, -90, 3.05)], { straight: 20 });
  cableFrom(g, glCable, [along(42, 12, 8), along(66, 26, 3.3), along(190, 80, 3.3)], { straight: 10 });
  /* the weather cap, pulled off and lying beside it */
  const cap = new THREE.Group(); g.add(cap);
  const cp = []; for (let i = 0; i <= 14; i++) { const y = i; cp.push(new THREE.Vector2(8.6 + (i % 2 && i > 2 && i < 13 ? 0.6 : 0), y)); }
  cp.push(new THREE.Vector2(8.6, 15)); cp.push(new THREE.Vector2(7, 15)); cp.push(new THREE.Vector2(7, 2)); cp.push(new THREE.Vector2(0, 2));
  const capM = rubber(0x7a7e83); const cm = capM.clone(); cm.side = THREE.DoubleSide;
  cap.add(new THREE.Mesh(new THREE.LatheGeometry(cp, 40), cm));
  /* lying on its side on the floor in front of the pocket, its open end toward you */
  cap.position.copy(along(34, -66, 8.6)); cap.lookAt(cap.position.clone().add(V(0.5, 0, 1))); cap.rotateX(Math.PI / 2);
  return named(g, "device:IP camera", { type: "camera", w: R * 2, h: 95, d: R * 2 });
}
/* the shroud: a dome with a round opening round the lens axis */
function holedDome(r, axis, half) {
  const geo = new THREE.SphereGeometry(r, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2), p = geo.attributes.position, idx = geo.index.array, keep = [], cosH = Math.cos(half), v = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    v.set(0, 0, 0); for (let k = 0; k < 3; k++) v.add(new THREE.Vector3().fromBufferAttribute(p, idx[i + k]));
    if (v.normalize().dot(axis) < cosH) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  geo.setIndex(keep); return geo;
}
/* the camera base's wall, with the port pocket cut flat into it: inside
   the pocket's height the wall is clamped to a plane d from the axis,
   so the pocket has a flat floor, a ledge top and bottom, and sharp
   sides where the flat meets the round, as a moulded pocket does */
function pocketWall(PROF, rAt, th0, d, y0, y1) {
  const seg = 160, ys = [];
  [7, y0 - 0.01, y0, (y0 + y1) / 2, y1, y1 + 0.01, 33, 35, 37, 39, 41, 42.5, 44].forEach(function (y) { ys.push({ y: y, cut: y >= y0 && y <= y1 }); });
  const pos = [], idx = [];
  ys.forEach(function (r) {
    for (let j = 0; j <= seg; j++) {
      const th = j / seg * Math.PI * 2; let rr = rAt(r.y);
      if (r.cut) { const c = Math.cos(th - th0); if (c > 0) rr = Math.min(rr, d / c); }
      pos.push(Math.sin(th) * rr, r.y, Math.cos(th) * rr);
    }
  });
  for (let i = 0; i < ys.length - 1; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
/* print on the camera's curved wall: lines of text, or a barcode sticker */
function curvedPrint(lines, w, h, ang, y, rAt, o = {}) {
  const r = rAt(y) + 0.2, th = w / r;
  let map;
  if (o.barcode) map = labelTex([], { w: w, h: h, barcode: o.barcode, bg: "#f6f6f2" });
  else {
    const c = document.createElement("canvas"); c.width = Math.ceil(w * 20); c.height = Math.ceil(h * 20); const x = c.getContext("2d");
    x.fillStyle = "#2b2e33"; x.textBaseline = "middle"; x.textAlign = o.align || "center";
    const lh = c.height / lines.length; x.font = "600 " + (lh * 0.7) + "px Arial, Helvetica, sans-serif";
    lines.forEach(function (l, i) { let fs = lh * 0.7; const wd = x.measureText(l).width; if (wd > c.width * 0.95) { fs *= c.width * 0.95 / wd; x.font = "600 " + fs + "px Arial, Helvetica, sans-serif"; } x.fillText(l, o.align === "left" ? c.width * 0.03 : c.width / 2, (i + 0.5) * lh); x.font = "600 " + (lh * 0.7) + "px Arial, Helvetica, sans-serif"; });
    map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  }
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32, 1, true, ang - th / 2, th),
    new THREE.MeshStandardMaterial({ map: map, transparent: !o.barcode, depthWrite: !!o.barcode, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.y = y; if (!o.barcode) m.userData.print = true; return m;
}

/* ------------------------------------------------------- wall plate */
/* A single-gang data/voice plate, as in the photo: NETWORKING PORT,
   the yellow ETHERNET keystone with a yellow patch cable (green boot)
   plugged in, the grey TELEPHONE keystone with the phone cord plugged
   in, DATA / VOICE, the printed boxes round them, two screws. */
export function wallPlate(o = {}) {
  const g = new THREE.Group();
  g.add(at(box(380, 300, 4, mat(0xe7e2d8, { rough: 0.92, grain: 0.1, scale: 1.3 })), 0, 0, -2));                // painted drywall
  g.add(at(rbox(70, 115, 6.5, 2.6, plastic(0xf5f5f2, { rough: 0.32, grain: 0.03 })), 0, 0, 3.25));
  const face = new THREE.Group(); at(face, 0, 0, 6.5); g.add(face);
  face.add(at(printLines(70, 115, [[0, 0, 54, 75, 1.6], [0, 12.5, 24, 27, 1.4], [0, -17.5, 24, 27, 1.4]], { color: "#a3a6ab", width: 0.35 }), 0, 0, 0.02));
  face.add(at(text("NETWORKING PORT", 46, 4.4, { color: "#3a3d42", weight: "600" }), 0, 31.5, 0.05));
  face.add(at(text("ETHERNET", 18, 3, { color: "#3a3d42", weight: "600" }), 0, 1.4, 0.05));
  face.add(at(text("TELEPHONE", 18, 3, { color: "#3a3d42", weight: "600" }), 0, -28.6, 0.05));
  face.add(at(text("DATA / VOICE", 40, 5, { color: "#3a3d42", weight: "600" }), 0, -34.3, 0.05));
  /* the keystones */
  face.add(at(rbox(16, 19, 1.6, 1, plastic(0xf2c200, { rough: 0.45 })), 0, 14.5, 0.8));
  const ej = rj45Jack({ name: "ETHERNET", insert: 0xf2c200, leds: false }); at(ej, 0, 14.5, 1.6); face.add(ej);
  face.add(at(rbox(16, 19, 1.6, 1, plastic(0x9ea3a8, { rough: 0.45 })), 0, -15.5, 0.8));
  const tj = rj11Jack({ name: "TELEPHONE", insert: 0x8f9499 }); at(tj, 0, -15.5, 1.6); face.add(tj);
  [41.7, -41.7].forEach(function (y) { const s = screw(3.4, 0xf3f3f0); at(s, 0, y, 0.05); face.add(s); });
  if (o.plugged !== false) {
    const ep = plugInto(ej, rj45Plug({ standard: "T568B", boot: 0x2fa84f, jacket: 0xf2c200 }));
    const tp = plugInto(tj, rj11Plug({ lines: 2, stub: true }), { y: 0.8, z: 2.25 });
    /* out to the right, as in the photo, then down the wall */
    cableFrom(g, ep, [[26, 15, 42], [62, 12, 38], [110, -4, 26], [150, -150, 12]], { straight: 16 });
    cableFrom(g, tp, [[22, -15, 26], [58, -13, 24], [100, -26, 16], [140, -150, 8]], { straight: 8 });
  }
  return named(g, "device:Wall plate", { type: "wallplate", w: 70, h: 115, d: 6.5 });
}
