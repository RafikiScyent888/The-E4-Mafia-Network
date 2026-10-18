/* =====================================================================
   Home network gear, matched part by part to the owner's photographs
   (10 October 2026): cable modem, fiber ONT, home wireless router,
   5-port unmanaged switch (and the two stacked, as photographed), mesh
   Wi-Fi node. Real millimetres; front faces +Z; sits on y = 0. Cables
   are plugged in as photographed. Brand names and logos are left off,
   as ruled; serials, MACs and Wi-Fi details are covered.
   ===================================================================== */
import * as THREE from "three";
import { COL, mat, rbox, box, cyl, at, named, text, COVERED, led, ledPipe, slots, rj45Jack, dcJack, fFemale, scApcAdapter, pinhole, button, cutCylinder, screw } from "./parts.js";
import { rj45Plug, coaxF, dcPlug, scApcPlug, cableFrom, plugInto } from "./cables.js";
import { perforated, printLines, label, plastic, gloss, paintedSteel, brushed, rubber, regMarksTex } from "./surface.js";
import { tubeVar } from "./cable-kit.js";

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
  front.add(at(ink(o.title || "UNMANAGED 5-PORT GIGABIT SWITCH", 70, 3, { weight: "700", spacing: 0.06 }), 12, Y0 + 26.6, 0.05));   /* o.title, o.under: another model in the same housing (an old 10/100 switch), only its print differs */
  const jacks = [], on = o.cables === false ? [false, false, false, false, false] : o.plugged || [true, true, true, true, false];   /* o.plugged: which of ports 1-5 have a cable */
  for (let i = 0; i < 5; i++) {
    const x = -26 + i * 16.4, j = rj45Jack({ name: String(i + 1), metal: true, on: [on[i], on[i]], actColor: COL.ledGreen });   /* both lights green, as photographed */
    front.add(at(j, x, Y0 + 15, 0.3)); jacks.push(j); front.add(at(ink(String(i + 1), 5, 3.4), x, Y0 + 3.6, 0.05));
  }
  /* the power jack on the right side */
  const rs = new THREE.Group(); at(rs, W / 2 + 0.02, Y0 + H / 2, -24, 0, Math.PI / 2); g.add(rs);
  rs.add(at(rbox(14, 14, 1, 2, plastic(0x0b0b0c)), 0, 1, 0.1));
  const dj = dcJack("POWER"); at(dj, 0, 1, 0.6); rs.add(dj); rs.add(at(up(ink("POWER DC 5V", 20, 2.8)), 11, 1, 0.05));
  const under = label((o.under || ["UNMANAGED 5-PORT GIGABIT SWITCH · MODEL: US-1005", "10/100/1000 Mbps · Auto-MDI/MDIX · 5V ⎓ 1A"]).concat(["S/N: " + COVERED]), { w: 70, h: 18, marks: true });
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

/* ------------------------------------------------------- PoE injectors */
/* Both matched to the owner's photograph (11 October 2026): a single-port
   PoE injector and a dual-port PoE+ one, side by side on the bench. The
   photo's wording and layout are kept; the figures printed are the
   standards' own (IEEE 802.3af: 48 V, 15.4 W; 802.3at: 54 V, 30 W a port),
   where the photo's were not. The logo badge on the PoE+ one's lid is left
   off, as ruled. Each power cord comes in at the side, as photographed:
   the single's on the left, the dual's on the right. */

/* a print on the plastic itself (white ink, no sticker): a canvas drawing */
function inkPlane(w, h, draw, px) {
  px = px || 24; const c = document.createElement("canvas"); c.width = Math.ceil(w * px); c.height = Math.ceil(h * px);
  const x = c.getContext("2d"); x.strokeStyle = x.fillStyle = "#e9ebe8"; draw(x, c.width, c.height, px);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.7, envMapIntensity: 0.45, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.renderOrder = 2; m.userData.print = true; return m;
}
/* the single's flow line under its jacks: DATA IN, through the power (a bolt in a circle), out to the right */
function flowLine(w) {
  return inkPlane(w, 4.4, function (x, cw, ch, px) {
    const y = ch / 2, cx = cw * 0.47, r = 1.75 * px; x.lineWidth = 0.32 * px;
    x.beginPath(); x.moveTo(0.02 * cw, y); x.lineTo(cx - r, y); x.moveTo(cx + r, y); x.lineTo(cw - 1.4 * px, y); x.stroke();
    x.beginPath(); x.moveTo(cw - 0.15 * px, y); x.lineTo(cw - 1.6 * px, y - 0.75 * px); x.lineTo(cw - 1.6 * px, y + 0.75 * px); x.closePath(); x.fill();
    x.beginPath(); x.arc(cx, y, r, 0, Math.PI * 2); x.stroke();
    x.beginPath(); [[0.25, -1.15], [-0.55, 0.12], [0.02, 0.12], [-0.3, 1.15], [0.6, -0.2], [0.02, -0.2]].forEach(function (q, i) { const X = cx + q[0] * px, Y = y + q[1] * px; if (i) x.lineTo(X, Y); else x.moveTo(X, Y); }); x.closePath(); x.fill();
  });
}
/* under each of the PoE+ one's jacks: its pair number, and an arrow (both ways for a DATA IN, outwards for an output) */
function pairMark(n, both, word) {
  return inkPlane(20, 3.4, function (x, cw, ch, px) {
    const y = ch / 2; x.font = "700 " + (2.6 * px) + "px Arial, Helvetica, sans-serif"; x.textBaseline = "middle"; x.textAlign = "left";
    const x0 = word ? 0.6 * px : 5.2 * px; x.fillText(String(n), x0, y + 0.1 * px);
    if (word) { x.font = "600 " + (2.5 * px) + "px Arial, Helvetica, sans-serif"; x.fillText(word, x0 + 2.6 * px, y + 0.1 * px); return; }
    const a = x0 + 2.6 * px, b = a + 7.5 * px, hd = 1.3 * px; x.lineWidth = 0.34 * px;
    x.beginPath(); x.moveTo(a + (both ? hd * 0.6 : 0), y); x.lineTo(b - hd * 0.6, y); x.stroke();
    x.beginPath(); x.moveTo(b, y); x.lineTo(b - hd, y - 0.65 * px); x.lineTo(b - hd, y + 0.65 * px); x.closePath(); x.fill();
    if (both) { x.beginPath(); x.moveTo(a, y); x.lineTo(a + hd, y - 0.65 * px); x.lineTo(a + hd, y + 0.65 * px); x.closePath(); x.fill(); }
  });
}
/* a square light pipe, as both photographed injectors have */
function sqLed(role, color, on) { const l = ledPipe(color, on); l.scale.set(0.85, 1.35, 1); l.userData.role = role; return l; }
/* the power cord's moulded plug, going into a socket in the side: a block (flared at the device on the
   PoE+ one), the ribbed strain relief, the cord. Front at z = 0, like every plug here */
function sidePowerPlug(o) {
  const g = new THREE.Group(), m = mat(0x151617, { rough: 0.5, grain: 0.06 }), w = o.w, h = o.h, L = o.len;
  g.add(at(cyl(2.75, 8, mat(0xc9ccd0, { metal: 1, rough: 0.25 }), 24), 0, 0, 4, Math.PI / 2));             // the barrel, inside the socket
  if (o.flare) { g.add(at(rbox(w + 7, h + 5, 5, 2.2, m), 0, 0, -2.6)); g.add(at(rbox(w + 3.5, h + 2.5, 5, 2.2, m), 0, 0, -6.4)); }
  g.add(at(rbox(w, h, L, 2.6, m), 0, 0, -L / 2 - (o.flare ? 3 : 0)));
  const z0 = -L - (o.flare ? 3 : 0), RL = o.ribs * 3.4 + 4;
  const geo = tubeVar(new THREE.LineCurve3(V(0, 0, z0 + 1), V(0, 0, z0 - RL)), { n: 120, m: 28, up: V(0, 1, 0),
    radius: function (t) { const zz = t * RL, base = THREE.MathUtils.lerp(o.r0, o.r0 * 0.62, zz / RL), rib = zz > 2 && zz < RL - 2 && Math.sin(zz * Math.PI / 1.7) > 0.15 ? 0.9 : 0; return [base + rib, base + rib]; } });
  g.add(new THREE.Mesh(geo, m));
  named(g, "plug:DC", { type: "dc" });
  g.userData.exitZ = z0 - RL + 1; g.userData.cable = { r: 2.1, color: 0x151617, text: "UL 2468  ·  18AWG x 2C  ·  80°C 300V  ·  VW-1", ink: "rgba(225,225,225,0.4)" };
  return g;
}
/* the side socket the cord goes into: a dark surround, the DC pin */
function sideSocket(face, x, y) {
  face.add(at(rbox(17, 14, 1.2, 2.2, plastic(0x0b0b0c, { rough: 0.6 })), x, y, 0.3));
  const dc = dcJack("DC IN"); at(dc, x, y, 0.9); face.add(dc); return dc;
}

/* The single-port PoE injector (802.3af; o.std "at" for a PoE+ one, or "passive" for the cheap 24 V kind
   HOME-13 can plant). As photographed: a black box with rounded edges and an inset front panel, the
   name and model top left, POWER (blue) and STATUS (green) on the model's line, DATA IN and
   DATA + POWER OUT in silver jacks with no lights, the flow line with the power bolt under them, the
   output printed along the bottom; on the lid the print and ribbed grooves down both edges; the power
   cord into the left side, low at the front, with its ribbed strain relief. */
export function poeInjector(o = {}) {
  const g = new THREE.Group(), W = 92, H = 46, D = 130, Y0 = 1.2, passive = o.std === "passive", plus = o.std === "at";
  const body = plastic(0x161719, { rough: 0.5 });
  g.add(at(rbox(W, H, D, 6, body), 0, Y0 + H / 2, 0));
  [[-36, 52], [36, 52], [-36, -52], [36, -52]].forEach(function (p) { g.add(at(cyl(5, Y0, rubber(0x202124), 20), p[0], Y0 / 2, p[1])); });
  /* the lid: ribbed grooves down both edges, the print between them */
  for (let i = 0; i < 5; i++) [-1, 1].forEach(function (sd) { g.add(at(rbox(1.3, 0.8, D - 34, 0.4, body), sd * (W / 2 - 7.5 - i * 2.5), Y0 + H + 0.25, -5)); });
  const top = new THREE.Group(); at(top, 0, Y0 + H + 0.05, 0, -Math.PI / 2, 0, 0); g.add(top);
  const name = passive ? "SINGLE-PORT PASSIVE PoE INJECTOR" : plus ? "SINGLE-PORT GIGABIT PoE+ INJECTOR" : "SINGLE-PORT GIGABIT PoE INJECTOR";
  const std = passive ? "PASSIVE PoE · 24V ⎓ 1A" : plus ? "IEEE 802.3at (PoE+) · 30W" : "IEEE 802.3af (PoE) · 15.4W";
  top.add(at(ink(name + "\n" + std + "\nDC IN: " + (passive ? "24V ⎓ 1A" : plus ? "54V ⎓ 1.25A" : "48V ⎓ 0.5A") + " (power adapter)\nDATA IN: 10/100/1000 Mbps\nS/N: " + COVERED, 54, 22, { align: "left", weight: "600" }), -3, 14, 0.1));
  const big = ink(passive ? "24V" : plus ? "54V" : "48V", 20, 9, { weight: "800" }); top.add(at(big, 22, -22, 0.1));
  const rm = inkPlane(28, 5.2, function (x, cw, ch) { x.drawImage(regMarksTex({ ink: "#e9ebe8" }).image, 0, 0, cw, ch); }); top.add(at(rm, -12, -22, 0.1));
  /* the front: the inset panel and everything printed on it */
  const front = new THREE.Group(); front.name = "panel:Ports"; at(front, 0, Y0, D / 2); g.add(front);
  front.add(at(rbox(W - 7, H - 7, 1, 3.5, plastic(0x101113, { rough: 0.4 })), 0, H / 2, -0.25));
  const F = 0.3, inkL = function (s, w, h, x, y, o2) { front.add(at(ink(s, w, h, Object.assign({ align: "left" }, o2 || {})), x + w / 2, y, F)); };
  inkL(name, 56, 4.2, -29, 41.2, { weight: "700" });
  inkL("MODEL: " + (passive ? "POE-P-24V" : plus ? "POE-GIP-54V" : "POE-GI-48V"), 26, 3.2, -29, 37, { weight: "500" });
  front.add(at(ink("POWER", 12, 3.2, { align: "right", weight: "500" }), 4.4, 37, F)); front.add(at(sqLed("POWER", COL.ledBlue, true), 11.8, 37, F + 0.1));
  front.add(at(sqLed("PoE", COL.ledGreen, true), 17.4, 37, F + 0.1)); front.add(at(ink("STATUS", 12, 3.2, { align: "left", weight: "500" }), 25.4, 37, F));
  const JY = 21.8, JX = [-17, 16.5];
  const din = rj45Jack({ name: "DATA IN", metal: true, leds: false }), pout = rj45Jack({ name: "DATA + POWER OUT", metal: true, leds: false });
  [din, pout].forEach(function (j, i) { front.add(at(rbox(19, 16.4, 0.8, 1, mat(0x9a9ea4, { metal: 0.55, rough: 0.42 })), JX[i], JY - 0.4, F)); at(j, JX[i], JY, F + 0.4); front.add(j); });
  front.add(at(ink("DATA IN", 16, 3.2, { weight: "500" }), JX[0], 32.4, F)); front.add(at(ink("DATA + POWER OUT", 28, 3.2, { weight: "500" }), JX[1], 32.4, F));
  front.add(at(flowLine(28), 0.5, 10.6, F));
  front.add(at(ink("PoE Power Output: DC " + (passive ? "24V ⎓ 1A" : plus ? "54V ⎓ 0.56A" : "48V ⎓ 0.32A"), 46, 3.4, { weight: "500" }), 0, 5, F));
  /* the left side: the power socket, low at the front, and DC IN printed above it */
  const left = new THREE.Group(); at(left, -W / 2, Y0, 0, 0, -Math.PI / 2, 0); g.add(left);
  const dc = sideSocket(left, D / 2 - 20, 12); left.add(at(ink("DC IN " + (passive ? "24V" : plus ? "54V" : "48V"), 20, 3, { weight: "500" }), D / 2 - 20, 23, 0.4));   /* this face's +x is the front */
  /* the cables: grey from the switch, black to the device, the power cord off to the left and back */
  const ci = patch(din, 0x9ea2a7), co = patch(pout, 0x2a2c2f), cp = plugInto(dc, sidePowerPlug({ w: 15, h: 12.5, len: 20, ribs: 4, r0: 4.8 }), { y: 0, z: 1.45 });
  cableFrom(g, ci, [[-30, Y0 + 8, D / 2 + 58], [-56, 3.05, D / 2 + 96], [-150, 3.05, D / 2 + 210]], { straight: 22 });
  cableFrom(g, co, [[20, Y0 + 7, D / 2 + 62], [30, 3.05, D / 2 + 110], [70, 3.05, D / 2 + 240]], { straight: 22 });
  cableFrom(g, cp, [[-W / 2 - 60, 2.1, D / 2 - 26], [-W / 2 - 110, 2.1, -10], [-W / 2 - 160, 2.1, -D / 2 - 120]], { straight: 8 });
  return named(g, "device:PoE injector", { type: "injector", w: W, h: H + Y0, d: D });
}

/* the PoE+ one's shell: chamfered all round, a raised bumper rim framing the front panel and the lid */
function chamfer(w, h, c) {
  const s = new THREE.Shape(); [[-w / 2 + c, -h / 2], [w / 2 - c, -h / 2], [w / 2, -h / 2 + c], [w / 2, h / 2 - c], [w / 2 - c, h / 2], [-w / 2 + c, h / 2], [-w / 2, h / 2 - c], [-w / 2, -h / 2 + c]].forEach(function (q, i) { if (i) s.lineTo(q[0], q[1]); else s.moveTo(q[0], q[1]); });
  s.closePath(); return s;
}
function rim(w, h, c, iw, ih, ir, depth, m) {
  const s = chamfer(w, h, c); s.holes.push(rrPath(iw, ih, ir, 0, 0));
  return new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: depth, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.8, bevelSegments: 2, curveSegments: 8 }), m);
}

/* The dual-port PoE+ injector (802.3at), build mode's second injector. As photographed: a rugged black
   shell, chamfered at every corner, a bumper rim round the front panel and the lid with grey accents at
   its top corners; DUAL-PORT GIGABIT PoE+ INJECTOR and the model top left; two DATA IN jacks with no
   lights, then DATA + POWER OUT over two jacks with green lights in their corners; the Active PoE+ light
   at the top right; the power budget along the bottom; the power cord into the right side, low at the
   front, with its flared moulding. The photo's arrows under the jacks become the pair numbers: each
   DATA IN carries on only to the output with its number. */
export function poeInjectorDual(o = {}) {
  const g = new THREE.Group(), W = 128, H = 60, D = 140, Y0 = 1.4, C = 9;
  const body = plastic(0x151618, { rough: 0.52 }), bump = plastic(0x1b1c1f, { rough: 0.62 }), grey = plastic(0x8e9298, { rough: 0.5 });
  const core = new THREE.Mesh(new THREE.ExtrudeGeometry(chamfer(W - 4, H - 4, C - 1), { depth: D - 10, bevelEnabled: true, bevelSize: 2, bevelThickness: 2, bevelSegments: 3, curveSegments: 8 }), body);
  core.position.set(0, Y0 + H / 2, -D / 2 + 3); g.add(core);
  [[-50, 56], [50, 56], [-50, -56], [50, -56]].forEach(function (p) { g.add(at(cyl(6, Y0, rubber(0x202124), 20), p[0], Y0 / 2, p[1])); });
  /* the bumper rim round the front panel (the panel sits 3 mm back in it), and one round the back */
  const fr = rim(W, H, C, W - 14, H - 12, 4, 3.4, bump); fr.position.set(0, Y0 + H / 2, D / 2 - 4.2); g.add(fr);
  const br = rim(W, H, C, W - 30, H - 22, 5, 3, bump); br.position.set(0, Y0 + H / 2, -D / 2 + 0.2); g.add(br);
  /* the lid: a raised rim with chamfered corners round a recessed panel (the logo badge left off) */
  const lid = rim(W - 2, D - 6, C + 2, W - 26, D - 34, 5, 2.6, bump); lid.rotation.x = -Math.PI / 2; lid.position.set(0, Y0 + H - 1.2, 0); g.add(lid);
  /* grey accents on the lid rim's four chamfered corners: a triangle in each */
  const tri = new THREE.Shape(); tri.moveTo(0, 0); tri.lineTo(15, 0); tri.lineTo(0, 15); tri.closePath();
  const triG = new THREE.ExtrudeGeometry(tri, { depth: 0.9, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.4, bevelSegments: 1 });
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (q) { const t = new THREE.Mesh(triG, grey); t.rotation.x = -Math.PI / 2; t.scale.set(-q[0], q[1], 1); t.position.set(q[0] * (W / 2 - 4.5), Y0 + H + 1.3, q[1] * (D / 2 - 6.5)); g.add(t); });
  /* bumpers down the side corners */
  [-1, 1].forEach(function (sd) { [-1, 1].forEach(function (fz) { g.add(at(rbox(3.2, H - 16, 14, 1.2, bump), sd * (W / 2 - 1.2), Y0 + H / 2, fz * (D / 2 - 14))); }); });
  /* the front panel, 3 mm back inside its rim, and what is printed on it */
  const front = new THREE.Group(); front.name = "panel:Ports"; at(front, 0, Y0, D / 2 - 4.4); g.add(front);
  front.add(at(rbox(W - 13, H - 11, 0.8, 4, plastic(0x0f1012, { rough: 0.42 })), 0, H / 2, 0));
  const F = 0.45, inkL = function (s, w, h, x, y, o2) { front.add(at(ink(s, w, h, Object.assign({ align: "left" }, o2 || {})), x + w / 2, y, F)); };
  inkL("DUAL-PORT GIGABIT PoE+ INJECTOR", 78, 4.4, -50, 45.6, { weight: "800" });
  inkL("MODEL: POE-GIP-DUAL", 34, 3.3, -50, 41.4, { weight: "500" });
  front.add(at(sqLed("POWER", COL.ledGreen, true), 25.5, 43.4, F + 0.1)); inkL("Active PoE+", 18, 3.2, 27.6, 43.4, { weight: "500" });
  const JX = [-39, -17.5, 8.5, 30.5], JY = 26, names = ["DATA IN 1", "DATA IN 2", "DATA + POWER OUT 1", "DATA + POWER OUT 2"], jacks = [];
  JX.forEach(function (x, i) {
    front.add(at(rbox(19, 16.6, 0.8, 1, mat(0x9a9ea4, { metal: 0.55, rough: 0.42 })), x, JY - 0.4, F));
    const j = rj45Jack(i < 2 ? { name: names[i], metal: true, leds: false } : { name: names[i], metal: true, on: [true, true], actColor: COL.ledGreen });
    at(j, x, JY, F + 0.4); front.add(j); jacks.push(j);
  });
  front.add(at(ink("DATA IN", 16, 3.2, { weight: "500" }), JX[0], 37.4, F)); front.add(at(ink("DATA IN", 16, 3.2, { weight: "500" }), JX[1], 37.4, F));
  front.add(at(ink("DATA + POWER OUT", 30, 3.2, { weight: "500" }), (JX[2] + JX[3]) / 2, 37.4, F));
  [[1, true, "", 0], [2, true, "", 1], [1, false, "", 2], [2, false, "Power/Data", 3]].forEach(function (u) { front.add(at(pairMark(u[0], u[1], u[2]), JX[u[3]], 14.2, F)); });
  inkL("Total PoE Power Budget: DC 54V ⎓ 1.1A (60W)", 54, 3.1, -50, 9.2, { weight: "500" });
  inkL("Port max: DC 54V ⎓ 0.56A (30W)", 38, 3.1, 7, 9.2, { weight: "500" });
  /* the right side: the power socket, low at the front, DC IN printed above it */
  const right = new THREE.Group(); at(right, W / 2 - 0.4, Y0, 0, 0, Math.PI / 2, 0); g.add(right);
  const dc = sideSocket(right, -D / 2 + 30, 15); right.add(at(ink("DC IN 54V", 20, 3, { weight: "500" }), -D / 2 + 30, 27.5, 0.4));   /* this face's -x is the front */
  /* the lid's print, small, in the recessed panel */
  const top = new THREE.Group(); at(top, 0, Y0 + H + 0.1, 0, -Math.PI / 2, 0, 0); g.add(top);
  top.add(at(ink("DUAL-PORT GIGABIT PoE+ INJECTOR\nIEEE 802.3at · 2 × 30W\nDC IN: 54V ⎓ 1.25A (power adapter)\nS/N: " + COVERED, 60, 18, { align: "left", weight: "600" }), -4, -18, 0.1));
  const rm = inkPlane(30, 5.6, function (x, cw, ch) { x.drawImage(regMarksTex({ ink: "#e9ebe8" }).image, 0, 0, cw, ch); }); top.add(at(rm, -18, 26, 0.1));
  /* the cables as photographed: black in DATA IN 1 and DATA + POWER OUT 1; the power cord off to the right */
  const ci = patch(jacks[0], 0x232528), co = patch(jacks[2], 0x232528), cp = plugInto(dc, sidePowerPlug({ w: 16, h: 13, len: 22, ribs: 4, r0: 5.2, flare: true }), { y: 0, z: 1.45 });
  cableFrom(g, ci, [[-46, Y0 + 7, D / 2 + 60], [-62, 3.05, D / 2 + 104], [-140, 3.05, D / 2 + 230]], { straight: 22 });
  cableFrom(g, co, [[6, Y0 + 7, D / 2 + 64], [10, 3.05, D / 2 + 112], [40, 3.05, D / 2 + 250]], { straight: 22 });
  cableFrom(g, cp, [[W / 2 + 70, 2.1, D / 2 - 34], [W / 2 + 130, 2.1, -6], [W / 2 + 190, 2.1, -D / 2 - 110]], { straight: 8 });
  return named(g, "device:PoE+ injector", { type: "injector", w: W, h: H + Y0, d: D });
}
