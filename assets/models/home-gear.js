/* =====================================================================
   Home network gear, matched part by part to the owner's photographs
   (10 October 2026): cable modem, fiber ONT, home wireless router,
   5-port unmanaged switch (and the two stacked, as photographed), mesh
   Wi-Fi node. Real millimetres; front faces +Z; sits on y = 0. Cables
   are plugged in as photographed. Brand names and logos are left off,
   as ruled; serials, MACs and Wi-Fi details are covered.
   ===================================================================== */
import * as THREE from "three";
import { COL, mat, rbox, box, cyl, at, named, text, COVERED, led, slots, rj45Jack, dcJack, fFemale, scApcAdapter, pinhole, button, cutCylinder, screw } from "./parts.js";
import { rj45Plug, coaxF, dcPlug, scApcPlug, cableFrom, plugInto } from "./cables.js";
import { perforated, printLines, label, plastic, gloss, paintedSteel, brushed, rubber } from "./surface.js";

const BACK = Math.PI, V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
const ink = function (s, w, h, o) { return text(s, w, h, Object.assign({ color: "#eceee9", weight: "600" }, o || {})); };
const dark = function (s, w, h, o) { return text(s, w, h, Object.assign({ color: "#2b2e33", weight: "600" }, o || {})); };
const up = function (m) { m.rotation.z = Math.PI / 2; return m; };
function patch(jack, boot, jacket) { return plugInto(jack, rj45Plug({ standard: "T568B", boot: boot, jacket: jacket == null ? boot : jacket })); }
function dcIn(jack, color) { return plugInto(jack, dcPlug({ color: color }), { y: 0, z: 1.45 }); }
function rrPts(w, h, r, cx, cy, p) {
  const x = (cx || 0) - w / 2, y = (cy || 0) - h / 2; r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r); p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r); p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y); return p;
}
const rrShape = function (w, h, r, cx, cy) { return rrPts(w, h, r, cx, cy, new THREE.Shape()); };
const rrPath = function (w, h, r, cx, cy) { return rrPts(w, h, r, cx, cy, new THREE.Path()); };
/* a column of lights with their names beside them */
function ledColumn(g, items, x, y0, step, labelX, w, size) {
  items.forEach(function (it, i) {
    const y = y0 - i * step, l = led(it[1], it[2], size || 1.6); l.userData.role = it[0]; g.add(at(l, x, y, 0.4));
    g.add(at(ink(it[0], w || 24, 3.6, { align: "right" }), labelX, y, 0.1));
  });
}

/* ------------------------------------------------------------ modem */
/* A DOCSIS cable modem standing on its edge, as in the photo: rounded
   top, the glossy face with POWER, DS, US, ONLINE (blue) and LINK/ACT;
   on the back the label, CABLE IN with the white coax screwed on, the
   yellow ETHERNET port with its cable, RESET, and the power cord; vent
   grids and a slatted panel down each side. */
export function cableModem() {
  const g = new THREE.Group(), W = 52, H = 176, D = 158, R = 18;
  const body = plastic(0x17181a, { rough: 0.55 });
  const prof = new THREE.Shape(); const zx = function (z) { return -z; };
  prof.moveTo(zx(-D / 2 + 3), 0); prof.lineTo(zx(D / 2 - 3), 0); prof.quadraticCurveTo(zx(D / 2), 0, zx(D / 2), 3); prof.lineTo(zx(D / 2), H - R);
  prof.quadraticCurveTo(zx(D / 2), H, zx(D / 2 - R), H); prof.lineTo(zx(-D / 2 + R), H); prof.quadraticCurveTo(zx(-D / 2), H, zx(-D / 2), H - R); prof.lineTo(zx(-D / 2), 3);
  prof.quadraticCurveTo(zx(-D / 2), 0, zx(-D / 2 + 3), 0);
  const bm = new THREE.Mesh(new THREE.ExtrudeGeometry(prof, { depth: W - 6, bevelEnabled: true, bevelSize: 3, bevelOffset: -3, bevelThickness: 3, bevelSegments: 3, curveSegments: 12 }), body);
  bm.rotation.y = Math.PI / 2; bm.position.set(-W / 2 + 3, 0, 0); g.add(bm);
  /* the face: glossy panel, the lights, the name where the brand was */
  const front = new THREE.Group(); at(front, 0, 0, D / 2); g.add(front);
  front.add(at(rbox(W - 10, 142, 1.2, 4, gloss(0x0a0b0c, { rough: 0.12 })), 0, 84, 0.6));
  const lc = new THREE.Group(); lc.position.z = 1.25; front.add(lc);
  ledColumn(lc, [["POWER", COL.ledGreen, true], ["DS", COL.ledGreen, true], ["US", COL.ledGreen, true], ["ONLINE", COL.ledBlue, true], ["LINK/ACT", COL.ledGreen, true]], 11, 118, 10, -6, 24, 1.7);
  lc.add(at(ink("CABLE MODEM", 34, 4.2, { weight: "700" }), 0, 30, 0.1)); lc.add(at(ink("DOCSIS 3.0", 26, 3.2, { weight: "500", color: "#c9cdd3" }), 0, 23.5, 0.1));
  /* the back */
  const back = new THREE.Group(); at(back, 0, 0, -D / 2, 0, BACK); g.add(back);
  back.add(at(rbox(W - 8, H - 26, 0.6, 3, plastic(0x111213, { rough: 0.7 })), 0, (H - 26) / 2 + 5, 0.1));
  const lb = label(["CABLE MODEM · DOCSIS 3.0", "MODEL: CM-3000", "S/N: " + COVERED, "HFC MAC: " + COVERED, "12V ⎓ 1A"], { w: 36, h: 34, barcode: "modem-sn", marks: true });
  at(lb, -2, 140, 0.5); back.add(lb);
  const fin = fFemale("CABLE IN"); at(fin, -6, 112, 0.4); back.add(fin); back.add(at(up(ink("CABLE IN", 18, 3.2)), 15, 112, 0.5));
  const eth = rj45Jack({ name: "ETHERNET", insert: COL.wanYellow, on: [true, true] }); at(eth, -6, 86, 0.4); back.add(eth); back.add(at(up(ink("ETHERNET", 20, 3.2)), 15, 86, 0.5));
  back.add(at(pinhole("RESET"), -6, 66, 0.5)); back.add(at(up(ink("RESET", 14, 3.2)), 15, 66, 0.5));
  back.add(at(rbox(16, 15, 1.2, 2, plastic(0x0b0b0c)), -6, 46, 0.3));
  const dc = dcJack("POWER"); at(dc, -6, 46, 0.9); back.add(dc); back.add(at(up(ink("12V ⎓ 1A", 18, 3.2)), 15, 46, 0.5));
  back.add(at(ink("POWER", 20, 3), -6, 33, 0.5));
  /* the cables: coax screwed on, the yellow patch cable, the power cord */
  const cx = coaxF({ stub: true, jacket: 0xe7e4dc }); cx.rotation.y = Math.PI; cx.position.set(0, 0, 10.7); fin.add(cx);
  const ep = patch(eth, COL.wanYellow);
  const pp = dcIn(dc);
  /* all three run off to the left as you face the back, the coax outermost, so none crosses another */
  cableFrom(g, cx, [[44, 104, -D / 2 - 34], [96, 50, -D / 2 - 52], [124, 3.45, -D / 2 - 64], [300, 3.45, -D / 2 - 110]], { straight: 14 });
  cableFrom(g, ep, [[36, 76, -D / 2 - 34], [74, 26, -D / 2 - 46], [96, 3.05, -D / 2 - 54], [290, 3.05, -D / 2 - 150]], { straight: 18 });
  cableFrom(g, pp, [[26, 34, -D / 2 - 28], [50, 1.9, -D / 2 - 38], [280, 1.9, -D / 2 - 190]], { straight: 10 });
  /* each side: rows of vent slots near the top, the slatted panel below */
  [-1, 1].forEach(function (sd) {
    const side = new THREE.Group(); at(side, sd * (W / 2 + 0.02), 0, 0, 0, sd * Math.PI / 2); g.add(side);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) side.add(at(box(9, 2.2, 0.5, mat(0x050506)), -48 + c * 12, 154 - r * 6, 0.05));
    side.add(at(rbox(96, 104, 1, 3, plastic(0x0e0f10, { rough: 0.6 })), 6, 78, -0.3));
    const sl = perforated(90, 98, { pitch: 5, d: 2.2, shape: "slot", material: plastic(0x17181a, { rough: 0.55 }) }); sl.position.set(6, 78, 0.25); side.add(sl);
  });
  [[-18, 60], [18, 60], [-18, -60], [18, -60]].forEach(function (p) { g.add(at(rbox(10, 1.2, 18, 0.5, rubber(0x1b1c1e)), p[0], 0.2, p[1])); });
  return named(g, "device:Cable modem", { type: "modem", w: W, h: H, d: D });
}

/* -------------------------------------------------------------- ONT */
/* The fiber ONT on the wall, as in the photo: FIBER ONT underlined,
   HOME TERMINAL, the lights (ALARM the only one off), the port names
   along the bottom; underneath, the green SC/APC fiber connector, the
   yellow patch cable and the 12V cord hanging down; vents and the
   barcode down the side. */
export function fiberOnt(o = {}) {
  const g = new THREE.Group(), W = 120, H = 160, D = 32, Y = 120;
  if (o.wall !== false) g.add(at(box(520, 520, 4, mat(0xe8e6e1, { rough: 0.92, grain: 0.1, scale: 1.3 })), 0, 80, -D / 2 - 2));
  g.add(at(rbox(W, H, D, 10, plastic(0x141516, { rough: 0.5 })), 0, Y, 0));
  const front = new THREE.Group(); at(front, 0, Y - H / 2, D / 2); g.add(front);
  front.add(at(rbox(W - 7, H - 7, 1.4, 8, plastic(0x18191b, { rough: 0.42 })), 0, H / 2, 0));
  const F = 0.8;
  front.add(at(ink("FIBER ONT", 66, 12, { weight: "800", align: "left" }), -16, H - 22, F));
  front.add(at(box(58, 0.8, 0.1, mat(0xdfe2e6)), -21, H - 30, F));
  front.add(at(ink("HOME TERMINAL", 66, 5.6, { weight: "600", align: "left", color: "#d5d8dc" }), -16, H - 36, F));
  ledColumn(front, [["POWER", COL.ledGreen, true], ["PON", COL.ledGreen, true], ["ALARM", COL.ledRed, false], ["LINK/ACT", COL.ledGreen, true], ["ETHERNET", COL.ledGreen, true]], 40, H - 56, 13.5, 18, 32, 1.9);
  front.children.slice(-10).forEach(function (c) { c.position.z += F; });
  [["FIBER PORT", -36], ["ETHERNET", 0], ["12V DC", 34]].forEach(function (l) { front.add(at(ink(l[0], 30, 3.6), l[1], 9, F)); });
  /* the right side: two columns of vent slits, the barcode */
  const side = new THREE.Group(); at(side, W / 2 + 0.02, Y, 0, 0, Math.PI / 2); g.add(side);
  for (let r = 0; r < 14; r++) [-6, 6].forEach(function (x) { side.add(at(box(9, 2.2, 0.5, mat(0x050506)), x, 62 - r * 7.2, 0.05)); });
  const bc = label(["S/N " + COVERED], { w: 46, h: 11, barcode: "ont-sn", boldFirst: false }); bc.rotation.z = -Math.PI / 2; at(bc, -2, -40, 0.05); side.add(bc);
  /* underneath: the ports, facing down, each with its cable */
  const under = new THREE.Group(); at(under, 0, Y - H / 2 - 0.1, 0, Math.PI / 2, 0, 0); g.add(under);
  const fa = scApcAdapter("FIBER"); at(fa, -36, 0, 0); under.add(fa);
  const ej = rj45Jack({ name: "ETHERNET", on: [true, true], metal: true }); at(ej, 0, 0, 0); under.add(ej);
  const dj = dcJack("12V DC"); at(dj, 34, 0, 0); under.add(dj);
  const fp = scApcPlug({ jacket: 0xf0c419 }); fp.rotation.y = Math.PI; fp.position.set(0, 0, 2); fa.add(fp);
  const ep = patch(ej, COL.wanYellow);
  const pp = dcIn(dj);
  const by = Y - H / 2;
  cableFrom(g, fp, [[-44, by - 70, 6], [-70, by - 130, 10], [-120, by - 230, 12]], { straight: 14 });
  cableFrom(g, ep, [[2, by - 80, 10], [6, by - 160, 12], [10, by - 260, 14]], { straight: 18 });
  cableFrom(g, pp, [[36, by - 70, 4], [40, by - 160, 6], [44, by - 260, 8]], { straight: 12 });
  return named(g, "device:Fiber ONT", { type: "ont", w: W, h: H, d: D });
}

/* ----------------------------------------------------------- router */
/* The home wireless router, as in the photo of its back: INTERNET (WAN)
   in yellow, LAN 1-4 in their printed frame, RESET, WPS, DC IN, cables
   in INTERNET, LAN 1, LAN 2 and LAN 4 and the power cord; the four
   hinged antennas; the label and barcode sticker underneath. */
/* o.wan, o.lans ([LAN 1..4]): which ports have a cable in them, as photographed by default */
export function homeRouter(o = {}) {
  const g = new THREE.Group(), W = 240, D = 165, Y0 = 5, wanIn = o.wan !== false, lanIn = o.lans || [true, true, false, true];
  const blk = plastic(0x161719, { rough: 0.5 });
  g.add(at(rbox(W, 40, D, 7, blk), 0, Y0 + 20, 0));
  g.add(at(rbox(W - 10, 10, D - 12, 5, plastic(0x1b1c1f, { rough: 0.38 })), 0, Y0 + 40, 2));
  [[-95, 55], [95, 55], [-95, -55], [95, -55]].forEach(function (p) { g.add(at(cyl(8, Y0, rubber(0x202124), 24), p[0], Y0 / 2, p[1])); });
  /* the top: a vent field, the lights along the front edge */
  const top = new THREE.Group(); at(top, 0, Y0 + 45.05, 0, -Math.PI / 2, 0, 0); g.add(top);
  top.add(at(perforated(150, 70, { pitch: 4, d: 2.4, shape: "hex", material: plastic(0x1b1c1f, { rough: 0.38 }) }), 0, 6, 0.2)); top.add(at(box(150, 70, 0.1, mat(0x050506)), 0, 6, 0.05));
  [["⏻", true], ["◎", true], ["2.4G", true], ["5G", true], ["LAN", true], ["WPS", false]].forEach(function (it, i) {
    const x = -70 + i * 28, l = led(COL.ledGreen, it[1], 1.6); l.userData.role = it[0]; top.add(at(l, x, -62, 0.4)); top.add(at(ink(it[0], 14, 4), x, -68, 0.3));
  });
  /* the back */
  const back = new THREE.Group(); at(back, 0, 0, -D / 2, 0, BACK); g.add(back);
  back.name = "panel:Back ports";
  back.add(at(rbox(W - 34, 21, 0.8, 3, plastic(0x0d0e0f, { rough: 0.6 })), -6, Y0 + 30, 0.1));
  const py = Y0 + 32, ly = Y0 + 20.5;
  /* below the ports, as photographed: the label with its marks, the barcode sticker */
  const bl = label(["WIRELESS ROUTER · Wi-Fi 6 · MODEL: HR-AX3000", "DEFAULT SSID: " + COVERED + "   Wi-Fi PASSWORD: " + COVERED, "ADMIN: http://192.168.1.1  ·  12V ⎓ 2A"], { w: 82, h: 12, marks: true });
  at(bl, -46, Y0 + 9, 0.3); back.add(bl);
  const bb = label(["MAC: " + COVERED], { w: 54, h: 12, barcode: "router-mac", boldFirst: false }); at(bb, 46, Y0 + 9, 0.3); back.add(bb);
  const wan = rj45Jack({ name: "INTERNET", insert: COL.wanYellow, on: [wanIn, wanIn] }); at(wan, -90, py, 0.5); back.add(wan);
  back.add(at(text("INTERNET", 18, 3, { color: "#f2c200", weight: "700" }), -90, ly + 0.8, 0.6)); back.add(at(text("(WAN)", 14, 2.8, { color: "#f2c200", weight: "700" }), -90, ly - 2.6, 0.6));
  back.add(at(printLines(78, 24, [[0, 0, 76, 22, 1.5]], { color: "#8a8e94", width: 0.4 }), -36, py - 2, 0.6));
  const lans = [];
  for (let i = 0; i < 4; i++) { const j = rj45Jack({ name: "LAN " + (i + 1), insert: 0x2a2c30, on: [lanIn[i], lanIn[i] && i !== 1] }); at(j, -63 + i * 18, py, 0.5); back.add(j); lans.push(j); back.add(at(ink("LAN " + (i + 1), 14, 3), -63 + i * 18, ly, 0.6)); }
  back.add(at(pinhole("RESET"), 16, py, 0.6)); back.add(at(ink("RESET", 14, 3), 16, ly, 0.6));
  const wps = new THREE.Group(); at(wps, 32, py, 0.6); back.add(wps); wps.add(at(cyl(3.6, 2, plastic(0x2a2c30, { rough: 0.4 }), 24), 0, 0, 1, Math.PI / 2)); named(wps, "button:WPS", { type: "button" });
  back.add(at(ink("WPS", 12, 3), 32, ly, 0.6));
  back.add(at(rbox(15, 14, 1.2, 2, plastic(0x0b0b0c)), 52, py, 0.4));
  const dc = dcJack("DC IN"); at(dc, 52, py, 1); back.add(dc); back.add(at(ink("DC IN", 14, 3), 52, ly, 0.6));
  /* the antennas: two on the back corners, two on the sides, on their hinges */
  function antenna(x, y, z, ry, tilt) {
    const a = new THREE.Group(); a.position.set(x, y, z); a.rotation.y = ry; g.add(a);
    a.add(at(cyl(6.5, 15, plastic(0x1c1d20, { rough: 0.45 }), 28), 0, 0, 0, 0, 0, Math.PI / 2));
    const bl = new THREE.Group(); bl.rotation.z = tilt; a.add(bl);
    bl.add(at(cyl(5.5, 8, plastic(0x1c1d20, { rough: 0.45 }), 24), 0, 6, 0));
    const blade = rbox(15, 178, 8, 3.8, plastic(0x141517, { rough: 0.42 })); blade.position.y = 98; bl.add(blade);
    return named(a, "antenna", {});
  }
  antenna(-106, Y0 + 36, -D / 2 + 4, 0, 0.08); antenna(106, Y0 + 36, -D / 2 + 4, 0, -0.08);
  antenna(-W / 2 - 4, Y0 + 32, -38, 0, 0.2); antenna(W / 2 + 4, Y0 + 32, -38, 0, -0.2);
  /* underneath: the label with the regulatory marks, the barcode sticker, vents */
  const ul = label(["S/N: " + COVERED], { w: 50, h: 12, barcode: "router-sn", boldFirst: false });
  at(ul, 0, Y0 - 0.05, 0, Math.PI / 2, 0, 0); g.add(ul);
  for (let k = 0; k < 16; k++) g.add(at(box(4, 0.4, 40, mat(0x050506)), -70 + k * 9, Y0 - 0.02, 30));
  /* the cables, out of the back and down onto the bench behind */
  const runs = [], cp = dcIn(dc), LAN_COL = [0x1b1c1e, 0x1b1c1e, 0x5e6267, 0xd9dbdc], LAN_RUN = [[63, 12], [45, -2], [27, -11], [9, -20]];
  if (wanIn) runs.push([patch(wan, COL.wanYellow), 90, 30]);
  lanIn.forEach(function (on, i) { if (on) runs.push([patch(lans[i], LAN_COL[i]), LAN_RUN[i][0], LAN_RUN[i][1]]); });
  runs.forEach(function (c) { cableFrom(g, c[0], [[c[1] + c[2] * 0.2, 16, -D / 2 - 56], [c[1] + c[2] * 0.5, 3.05, -D / 2 - 96], [c[1] + c[2] * 2.4, 3.05, -D / 2 - 280]], { straight: 22 }); });
  cableFrom(g, cp, [[-52, 14, -D / 2 - 44], [-58, 1.9, -D / 2 - 74], [-90, 1.9, -D / 2 - 280]], { straight: 14 });
  return named(g, "device:Home router", { type: "router", w: W, h: Y0 + 45, d: D });
}

/* ----------------------------------------------------------- switch */
/* The 5-port unmanaged gigabit switch, as in the photo: a metal case
   (cover over base, screws on the sides), Power light, ports 1-5 in
   their silver bezel with two green lights each, UNMANAGED 5-PORT
   GIGABIT SWITCH printed above, angled side vents, the power jack on
   the side; patch cables in ports 1-4. */
export function unmanagedSwitch(o = {}) {
  const g = new THREE.Group(), W = 122, H = 30, D = 100, Y0 = 2;
  const steel = paintedSteel(0x2b2e32, { rough: 0.42 });
  g.add(at(rbox(W, H, D, 2.2, steel), 0, Y0 + H / 2, 0));
  [-1, 1].forEach(function (sd) {
    g.add(at(box(0.4, 0.6, D - 6, mat(0x0a0b0c)), sd * (W / 2 + 0.05), Y0 + 5, 0));                    // where the cover meets the base
    [-30, 32].forEach(function (z) { const s = screw(2.1, 0x8e9196); s.rotation.y = sd * Math.PI / 2; s.position.set(sd * (W / 2 + 0.05), Y0 + 2.6, z); g.add(s); });
    const side = new THREE.Group(); at(side, sd * (W / 2 + 0.02), Y0 + H / 2 + 2, 0, 0, sd * Math.PI / 2); g.add(side);
    for (let k = 0; k < 11; k++) side.add(at(box(1.6, 13, 0.5, mat(0x050506)), sd * (14 + k * 3.6), 0, 0.05, 0, 0, 0.42));
  });
  [[-48, 38], [48, 38], [-48, -38], [48, -38]].forEach(function (p) { g.add(at(cyl(5, Y0, rubber(0x18191b), 20), p[0], Y0 / 2, p[1])); });
  const front = new THREE.Group(); at(front, 0, 0, D / 2); g.add(front);
  front.add(at(ink("Power", 14, 3.6, { weight: "500" }), -50, Y0 + 22, 0.05));
  const pw = led(COL.ledGreen, true, 1.5); pw.userData.role = "POWER"; front.add(at(pw, -50, Y0 + 15.5, 0.3));
  const bez = rrShape(88, 18.5, 1.6, 6, 0); bez.holes.push(rrPath(85, 15.5, 1, 6, 0));
  front.add(at(new THREE.Mesh(new THREE.ExtrudeGeometry(bez, { depth: 1.2, bevelEnabled: false }), brushed(0xc5c8cc, "x")), 0, Y0 + 15, 0));
  front.add(at(ink("UNMANAGED 5-PORT GIGABIT SWITCH", 70, 3, { weight: "700", spacing: 0.06 }), 12, Y0 + 26.6, 0.05));
  const jacks = [], on = o.cables === false ? [false, false, false, false, false] : o.plugged || [true, true, true, true, false];   /* o.plugged: which of ports 1-5 have a cable */
  for (let i = 0; i < 5; i++) {
    const x = -26 + i * 16.4, j = rj45Jack({ name: String(i + 1), metal: true, on: [on[i], on[i]], actColor: COL.ledGreen });   /* both lights green, as photographed */
    front.add(at(j, x, Y0 + 15, 0.3)); jacks.push(j); front.add(at(ink(String(i + 1), 5, 3.4), x, Y0 + 3.6, 0.05));
  }
  /* the power jack on the right side */
  const rs = new THREE.Group(); at(rs, W / 2 + 0.02, Y0 + H / 2, -24, 0, Math.PI / 2); g.add(rs);
  rs.add(at(rbox(14, 14, 1, 2, plastic(0x0b0b0c)), 0, 1, 0.1));
  const dj = dcJack("POWER"); at(dj, 0, 1, 0.6); rs.add(dj); rs.add(at(up(ink("POWER DC 5V", 20, 2.8)), 11, 1, 0.05));
  const under = label(["UNMANAGED 5-PORT GIGABIT SWITCH · MODEL: US-1005", "10/100/1000 Mbps · Auto-MDI/MDIX · 5V ⎓ 1A", "S/N: " + COVERED], { w: 70, h: 18, marks: true });
  at(under, 0, Y0 - 0.05, 0, Math.PI / 2, 0, 0); g.add(under);
  if (o.cables !== false) {
    const cols = [[0xf2c200], [0x9fa3a8], [0xb9bcc0], [0x4a4d52], [0x2f5fc4]];
    cols.forEach(function (c, i) {
      if (!on[i]) return;
      const p = patch(jacks[i], c[0]), x = -26 + i * 16.4;
      cableFrom(g, p, [[x - 14 - i * 3, Y0 + 10, D / 2 + 60], [x - 34 - i * 6, 3.05, D / 2 + 96], [x - 120 - i * 14, 3.05, D / 2 + 230]], { straight: 22 });
    });
    const pp = dcIn(dj);
    cableFrom(g, pp, [[W / 2 + 40, Y0 + 8, -30], [W / 2 + 70, 1.9, -40], [W / 2 + 220, 1.9, -90]], { straight: 10 });
  }
  return named(g, "device:5-port switch", { type: "switch", w: W, h: H + Y0, d: D });
}
/* the two switches stacked, as photographed */
export function switchStack() {
  const g = new THREE.Group(), a = unmanagedSwitch(), b = unmanagedSwitch(); b.position.y = 32; g.add(a, b);
  return named(g, "device:Switches stacked", { type: "switch-stack" });
}

/* ------------------------------------------------------------- mesh */
/* The mesh Wi-Fi node, as in the photo and its callouts: a white
   cylinder, cooling vents round the top cap, the status light ring at
   the front (green good, amber when the link to the next node is weak),
   the side strip with vents, the amber light and RESET, the back plate
   with WAN, LAN and 12V DC IN (cables in), vents round the foot, the
   label, pads and keyhole underneath. */
export function meshNode(status) {
  const g = new THREE.Group(), R = 52, H = 152, weak = status === "weak", white = plastic(0xf2f2ef, { rough: 0.42, grain: 0.05 });
  const rAt = function (y) { if (y < 7) return R - 2.5; if (y <= H - 8) return R; const t = (y - (H - 8)) / 8; return R - 5 * t * t; };
  const ys = [7, 20, 40, 60, 80, 100, 120, 140, H - 8, H - 5, H - 3, H - 1.5, H];
  const pk = [{ th: Math.PI, d: R - 4, y0: 22, y1: 96 }, { th: -Math.PI / 2, d: R - 2.5, y0: 24, y1: 134 }];
  g.add(new THREE.Mesh(cutCylinder(rAt, ys, pk, 192), white));
  /* the foot: a grey band with vent slots all round */
  g.add(at(cyl(R - 2.5, 7, plastic(0xdcdad4, { rough: 0.5 }), 96), 0, 3.5, 0));
  for (let k = 0; k < 64; k++) { const a = k / 64 * Math.PI * 2; const s = box(1.3, 3.4, 0.6, mat(0x0a0a0b)); s.position.set(Math.sin(a) * (R - 2.3), 3.6, Math.cos(a) * (R - 2.3)); s.rotation.y = a; g.add(s); }
  /* the top: the cap and its ring of cooling vents */
  g.add(at(cyl(R - 5, 0.6, white, 96), 0, H - 0.2, 0));
  g.add(at(cyl(R - 14, 1.4, plastic(0xe9e8e4, { rough: 0.5 }), 96), 0, H + 0.6, 0));
  for (let k = 0; k < 56; k++) { const a = k / 56 * Math.PI * 2; const s = box(1.3, 0.5, 6.5, mat(0x0a0a0b)); s.position.set(Math.sin(a) * (R - 9.2), H + 0.15, Math.cos(a) * (R - 9.2)); s.rotation.y = a; g.add(s); }
  /* the status light ring at the front */
  const col = weak ? COL.ledAmber : COL.ledGreen;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 1.1, 12, 40), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: col, emissiveIntensity: 0.95, roughness: 0.3 }));
  ring.position.set(0, 24, R + 0.4); ring.userData = { kind: "led", role: "STATUS", color: col, on: true }; g.add(ring);
  g.add(at(new THREE.Mesh(new THREE.CircleGeometry(3.4, 32), plastic(0xe6e6e3)), 0, 24, R + 0.05));
  /* the side strip: vents, the amber light and RESET */
  const ss = new THREE.Group(); ss.name = "panel:Side"; at(ss, -(R - 2.5), 79, 0, 0, -Math.PI / 2); g.add(ss);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) ss.add(at(box(2.2, 12, 0.5, mat(0x060607)), -6.6 + c * 4.4, 40 - r * 15, 0.05));
  for (let c = 0; c < 4; c++) ss.add(at(box(2.2, 7, 0.5, mat(0x060607)), -6.6 + c * 4.4, -47, 0.05));
  const al = led(COL.ledAmber, weak, 1.2); al.userData.role = "LINK"; ss.add(at(al, -6, -20, 0.2)); ss.add(at(dark("RESET", 12, 2.8), 4, -20, 0.05));
  const rb = new THREE.Group(); at(rb, 0, -32, 0); ss.add(rb); rb.add(at(cyl(4.2, 1.6, plastic(0xeceae6, { rough: 0.4 }), 32), 0, 0, 0.5, Math.PI / 2));
  rb.add(at(new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.35, 8, 32), mat(0xc9c8c3)), 0, 0, 0.1)); named(rb, "button:RESET", { type: "button" });
  /* the back plate: vent dots, WAN, LAN, 12V DC IN with their names */
  const bp = new THREE.Group(); bp.name = "panel:Back plate"; at(bp, 0, 59, -(R - 4), 0, BACK); g.add(bp);
  for (let k = 0; k < 8; k++) bp.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.9, 12), mat(0x060607)), -12.6 + k * 3.6, 32, 0.05));
  const wj = rj45Jack({ name: "WAN", on: [true, true], metal: true }); at(wj, 6, 18, 0); bp.add(wj); bp.add(at(dark("WAN / INTERNET", 14, 2.4, { align: "right" }), -9.5, 18, 0.05));
  const lj = rj45Jack({ name: "LAN", on: [true, false], metal: true }); at(lj, 6, -2, 0); bp.add(lj); bp.add(at(dark("LAN", 10, 2.6, { align: "right" }), -7.5, -2, 0.05));
  bp.add(at(rbox(14, 13, 1, 2, plastic(0x1a1b1d)), 6, -22, 0.3));
  const dj = dcJack("12V DC IN"); at(dj, 6, -22, 0.8); bp.add(dj); bp.add(at(dark("12V DC IN", 12, 2.6, { align: "right" }), -7.5, -20, 0.05));
  bp.add(at(polarity(), -10.5, -25.5, 0.05));
  for (let k = 0; k < 3; k++) { const s = box(2.2, 30, 0.6, mat(0x060607)); s.position.set((k - 1) * 4.4, 119, -R + 0.2); g.add(s); }
  /* underneath: two pads, the label, the keyhole */
  const under = new THREE.Group(); at(under, 0, -0.06, 0, Math.PI / 2, 0, 0); g.add(under);
  [-1, 1].forEach(function (sd) { const p = new THREE.Mesh(new THREE.TorusGeometry(36, 2.8, 8, 24, 0.9), rubber(0x8d9095)); p.rotation.z = sd > 0 ? -0.45 : Math.PI - 0.45; p.scale.z = 0.3; under.add(p); });
  const ul = label(["MESH Wi-Fi NODE · MODEL: MW-6", "S/N: " + COVERED, "MAC: " + COVERED], { w: 40, h: 16, barcode: "mesh-sn" }); at(ul, 0, 10, 0); under.add(ul);
  under.add(at(new THREE.Mesh(new THREE.CircleGeometry(4.5, 24), mat(0x0a0a0b)), 0, -18, 0.05)); under.add(at(box(3.4, 9, 0.1, mat(0x0a0a0b)), 0, -12, 0.05));
  /* the cables, out of the back plate and down to the bench */
  const cw = patch(wj, COL.wanYellow), cl = patch(lj, 0x1b1c1e), cp = dcIn(dj);
  cableFrom(g, cw, [[-14, 52, -R - 42], [-24, 3.05, -R - 76], [-70, 3.05, -R - 250]], { straight: 18 });
  cableFrom(g, cl, [[-10, 34, -R - 40], [-14, 3.05, -R - 70], [-40, 3.05, -R - 260]], { straight: 18 });
  cableFrom(g, cp, [[-8, 18, -R - 30], [-6, 1.9, -R - 56], [-10, 1.9, -R - 260]], { straight: 10 });
  return named(g, "device:Mesh node", { type: "mesh", w: R * 2, h: H, d: R * 2 });
}
/* the centre-positive symbol printed by a DC input */
function polarity() {
  const c = document.createElement("canvas"); c.width = 220; c.height = 70; const x = c.getContext("2d");
  x.strokeStyle = "#2b2e33"; x.fillStyle = "#2b2e33"; x.lineWidth = 6;
  x.beginPath(); x.arc(28, 35, 18, 0, Math.PI * 2); x.stroke(); x.fillRect(16, 32, 24, 6);
  x.beginPath(); x.moveTo(46, 35); x.lineTo(82, 35); x.stroke();
  x.beginPath(); x.arc(110, 35, 24, Math.PI * 0.3, Math.PI * 1.7); x.stroke(); x.beginPath(); x.arc(110, 35, 7, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(117, 35); x.lineTo(160, 35); x.stroke();
  x.beginPath(); x.arc(186, 35, 18, 0, Math.PI * 2); x.stroke(); x.fillRect(174, 32, 24, 6); x.fillRect(183, 23, 6, 24);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.9), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.7 })); m.userData.print = true; return m;
}

/* ------------------------------------------------------- PoE injector */
/* A desktop PoE injector, built from the standard design (no photograph
   yet: send one and it will be matched part by part): a black box, DATA IN
   and PoE OUT side by side on the front with their cables in, POWER and
   PoE lights on top, the label (802.3af, or a passive 24 V one: o.std
   "passive"), and the power adapter's DC plug in the back. */
export function poeInjector(o = {}) {
  const g = new THREE.Group(), W = 66, H = 30, D = 112, Y0 = 2, passive = o.std === "passive";
  g.add(at(rbox(W, H, D, 5, plastic(0x18191b, { rough: 0.5 })), 0, Y0 + H / 2, 0));
  [[-24, 42], [24, 42], [-24, -42], [24, -42]].forEach(function (p) { g.add(at(cyl(5, Y0, rubber(0x202124), 20), p[0], Y0 / 2, p[1])); });
  /* the top: the label, the two lights near the front */
  const top = new THREE.Group(); at(top, 0, Y0 + H + 0.05, 0, -Math.PI / 2, 0, 0); g.add(top);
  const lb = label(passive ? ["PASSIVE PoE INJECTOR", "OUTPUT 24V ⎓ 1A", "DATA IN → PoE OUT", "S/N: " + COVERED] : ["PoE INJECTOR · IEEE 802.3af", "OUTPUT 48V ⎓ 0.32A (15.4W)", "DATA IN → PoE OUT", "S/N: " + COVERED], { w: 54, h: 36, marks: true });
  at(lb, 0, 6, 0.2); top.add(lb);
  [["POWER", -14], ["PoE", 14]].forEach(function (it) {
    const l = led(COL.ledGreen, true, 1.5); l.userData.role = it[0]; top.add(at(l, it[1], -44, 0.4));
    top.add(at(ink(it[0], 16, 3.6), it[1], -49.5, 0.3));
  });
  /* the front: DATA IN and PoE OUT */
  const front = new THREE.Group(); front.name = "panel:Ports"; at(front, 0, 0, D / 2); g.add(front);
  const din = rj45Jack({ name: "DATA IN", metal: true, leds: false }), pout = rj45Jack({ name: "PoE OUT", metal: true, leds: false });
  at(din, -14, Y0 + 13, 0.2); at(pout, 14, Y0 + 13, 0.2); front.add(din, pout);
  front.add(at(ink("DATA IN", 18, 3.4), -14, Y0 + 24, 0.05)); front.add(at(ink("PoE OUT", 18, 3.4), 14, Y0 + 24, 0.05));
  /* the back: the adapter's DC plug */
  const back = new THREE.Group(); at(back, 0, 0, -D / 2, 0, BACK); g.add(back);
  back.add(at(rbox(16, 15, 1.2, 2, plastic(0x0b0b0c)), 0, Y0 + 14, 0.3));
  const dc = dcJack("DC IN"); at(dc, 0, Y0 + 14, 0.9); back.add(dc); back.add(at(ink("DC IN " + (passive ? "24V" : "48V"), 22, 3.2), 0, Y0 + 25, 0.05));
  /* the cables: grey from the switch, the outdoor run to the camera, the adapter's cord */
  const ci = patch(din, 0x9fa3a8), co = patch(pout, 0x4a4e53), cp = dcIn(dc);
  cableFrom(g, ci, [[-30, Y0 + 8, D / 2 + 60], [-52, 3.05, D / 2 + 96], [-140, 3.05, D / 2 + 220]], { straight: 22 });
  cableFrom(g, co, [[30, Y0 + 8, D / 2 + 60], [52, 3.3, D / 2 + 96], [150, 3.3, D / 2 + 230]], { straight: 22, r: 3.3 });
  cableFrom(g, cp, [[10, 14, -D / 2 - 40], [24, 1.9, -D / 2 - 70], [80, 1.9, -D / 2 - 240]], { straight: 10 });
  return named(g, "device:PoE injector", { type: "injector", w: W, h: H + Y0, d: D });
}
