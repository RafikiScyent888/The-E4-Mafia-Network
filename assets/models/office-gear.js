/* =====================================================================
   Small-office gear, matched part by part to the owner's photographs
   (11 October 2026): the managed 24-port switch with 4 SFP slots (front
   and rear), its SFP modules and LC fiber plugs, the 6U wall rack with
   its 24-port Cat6 patch panel and the 8-port switch on its shelf, and
   the console cable with its serial adapters. Real millimetres; front
   faces +Z; sits on y = 0. Brand names and logos are left off, as ruled;
   MAC addresses and serial numbers are covered.
   ===================================================================== */
import * as THREE from "three";
import { COL, mat, rbox, box, cyl, at, named, text, COVERED, led, ledPipe, rj45Jack, iecInlet, fanGrille, screw, socket } from "./parts.js";
import { rj45Plug, plugInto, cableFrom } from "./cables.js";
import { tubeVar } from "./cable-kit.js";
import { perforated, printLines, label, plastic, paintedSteel, brushed, rubber } from "./surface.js";
import { laptop } from "./endpoints.js";

const BACK = Math.PI, V = function (x, y, z) { return new THREE.Vector3(x, y, z); };
const ink = function (s, w, h, o) { return text(s, w, h, Object.assign({ color: "#eceee9", weight: "600" }, o || {})); };
const dark = function (s, w, h, o) { return text(s, w, h, Object.assign({ color: "#25282d", weight: "600" }, o || {})); };
function patch(jack, boot, jacket) { return plugInto(jack, rj45Plug({ standard: "T568B", boot: boot, jacket: jacket == null ? boot : jacket })); }
function shapeRR(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
/* a dark slot or hole cut through a face: a stadium, w x h */
function slotHole(w, h) { const m = new THREE.Mesh(new THREE.ShapeGeometry(shapeRR(w, h, Math.min(w, h) / 2), 12), mat(COL.hole, { rough: 1 })); m.userData.hole = true; return m; }
/* a print drawn on a canvas, white ink unless o.color */
function inkPlane(w, h, draw, o) {
  o = o || {}; const px = 24, c = document.createElement("canvas"); c.width = Math.ceil(w * px); c.height = Math.ceil(h * px);
  const x = c.getContext("2d"); x.strokeStyle = x.fillStyle = o.color || "#e9ebe8"; draw(x, c.width, c.height, px);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.7, envMapIntensity: 0.45, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.renderOrder = 2; m.userData.print = true; return m;
}
/* the USB trident, printed beside a USB port */
function usbIcon(h, color) {
  return inkPlane(h * 1.9, h, function (x, cw, ch, px) {
    const y = ch / 2, lw = ch * 0.09; x.lineWidth = lw;
    x.beginPath(); x.moveTo(cw * 0.08, y); x.lineTo(cw * 0.86, y); x.stroke();
    x.beginPath(); x.moveTo(cw * 0.97, y); x.lineTo(cw * 0.82, y - ch * 0.14); x.lineTo(cw * 0.82, y + ch * 0.14); x.closePath(); x.fill();
    x.beginPath(); x.arc(cw * 0.1, y, ch * 0.12, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(cw * 0.3, y); x.lineTo(cw * 0.42, y - ch * 0.3); x.lineTo(cw * 0.6, y - ch * 0.3); x.stroke();
    x.beginPath(); x.arc(cw * 0.62, y - ch * 0.3, ch * 0.08, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(cw * 0.45, y); x.lineTo(cw * 0.55, y + ch * 0.3); x.lineTo(cw * 0.7, y + ch * 0.3); x.stroke();
    x.fillRect(cw * 0.68, y + ch * 0.22, ch * 0.16, ch * 0.16);
  }, { color: color });
}
/* the power symbol */
function powerIcon(h) {
  return inkPlane(h, h, function (x, cw, ch) {
    x.lineWidth = ch * 0.1; x.lineCap = "round";
    x.beginPath(); x.arc(cw / 2, ch * 0.55, ch * 0.32, -Math.PI * 0.32, Math.PI * 1.32); x.stroke();
    x.beginPath(); x.moveTo(cw / 2, ch * 0.12); x.lineTo(cw / 2, ch * 0.52); x.stroke();
  });
}

/* ------------------------------------------------------------ SFP and LC */
/* An SFP cage in the switch's front: the metal frame round a 13.7 x 8.6 opening, the dark inside, the
   spring tabs; two square lights above it (link, activity), lit by the switch like an RJ45 jack's */
export function sfpCage(name, o = {}) {
  const g = new THREE.Group(), fm = mat(0xc4c7cb, { metal: 0.85, rough: 0.3 });
  const s = shapeRR(15.4, 11, 0.6), hs = shapeRR(13.7, 8.8, 0.4), hp = new THREE.Path(); hp.curves = hs.curves; hp.currentPoint = hs.currentPoint; s.holes.push(hp);
  g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: false, curveSegments: 6 }), fm));
  g.add(at(box(13.7, 8.8, 0.2, mat(COL.hole, { rough: 1 })), 0, 0, 0.1));
  [-4, 0, 4].forEach(function (x) { g.add(at(box(2, 0.4, 1.2, fm), x, 4.2, 1.2, -0.35, 0, 0)); });   /* the spring fingers along the top */
  if (o.leds !== false) {
    const on = o.on || [true, true];
    const a = ledPipe(COL.ledGreen, on[0]), b = ledPipe(COL.ledGreen, on[1]);
    a.scale.set(0.8, 0.9, 1); b.scale.set(0.8, 0.9, 1);
    g.add(at(a, -5.2, 7.4, 0.3)); g.add(at(b, 5.2, 7.4, 0.3)); a.userData.role = "link"; b.userData.role = "activity";
  }
  return named(g, "port:" + name, { type: "sfp" });
}
/* An SFP transceiver with its LC duplex patch cord plugged in: the metal body (most of it inside the cage),
   the bail latch, the LC duplex plug, its boot and the cord. Built like every plug here: its front (into the
   cage) at +z, the cord leaving towards -z; plugInto turns it round */
export function sfpModule(o = {}) {
  const g = new THREE.Group(), body = mat(0xc9ccd0, { metal: 0.9, rough: 0.28, brushed: "z" }), jc = o.cable == null ? 0xd9dbdd : o.cable;
  g.add(at(box(13.4, 8.5, 46, body), 0, 0, 7));                                     /* 30 inside the cage, 16 out of it */
  g.add(at(box(13.8, 8.9, 3, mat(0xb4b7bb, { metal: 0.85, rough: 0.34 })), 0, 0, -14.5));   /* the collar where it leaves the cage */
  const bail = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.55, 6, 24, Math.PI), mat(o.bail || 0x1d1e21, { rough: 0.5 }));
  bail.rotation.set(0, 0, Math.PI); bail.position.set(0, -2.6, -16.4); bail.rotation.x = -0.25; g.add(bail);
  const face = new THREE.Group(); face.position.z = -16.05; g.add(face);
  face.add(at(box(12.6, 7.6, 0.2, mat(0x16171a, { rough: 0.7 })), 0, 0, 0));
  /* the LC duplex plug: two latched LC bodies on a clip, the boot, the cord */
  const lc = mat(o.plug || 0x2a2c30, { rough: 0.45 });
  [-3.125, 3.125].forEach(function (x) { g.add(at(box(4.5, 4.5, 11, lc), x, 0, -21.5)); g.add(at(box(2.2, 0.8, 7, lc), x, 2.75, -22, -0.18, 0, 0)); });
  g.add(at(rbox(12.4, 7, 7, 1, lc), 0, 0.4, -29.5));                                 /* the duplex clip */
  const L = 22, geo = tubeVar(new THREE.LineCurve3(V(0, 0, -33), V(0, 0, -33 - L)), { n: 80, m: 24, up: V(0, 1, 0),
    radius: function (t) { const zz = t * L, r = THREE.MathUtils.lerp(4.2, 2.0, zz / L) + (zz > 4 && Math.sin(zz * 2.2) > 0.4 ? -0.3 : 0); return [r * 1.25, r]; } });
  g.add(new THREE.Mesh(geo, lc));
  named(g, "plug:SFP", { type: "sfp-module" });
  g.userData.exitZ = -33 - L + 2; g.userData.cable = { r: 1.6, flat: true, color: jc, text: o.text || "OM3 50/125 µm  ·  LC-LC DUPLEX  ·  LSZH", ink: "rgba(30,30,30,0.5)" };
  return g;
}

/* ------------------------------------------------------- the managed switch */
/* The managed 24-port switch with 4 SFP slots (model MSW-2800G), 1U for a 19-inch rack, as photographed:
   the black front with MANAGED SWITCH 24-PORT + 4 SFP top left, the Speed/Link and Link/Activity key, the
   24 ports in two rows in their grey frames (odd numbers on top, even below, as stacked jacks are numbered),
   SFP1 to SFP4 in their bracket with two lights each, the power and fan lights under their symbol,
   CONSOLE over its RJ45 console port with the MGMT port under it, the USB console port, SYSTEM and POWER,
   the model top right; silver rack ears with their slots. The rear: the name, the AC inlet and its rating,
   the fan, VENTILATION, the regulatory label and the MAC label (covered); vent holes down both sides.
   o.plugged: which of ports 1-24 have a patch cable (photo: port 10); o.sfp: a cord colour for each SFP slot,
   or null for an empty slot (photo: grey, grey, orange); o.console: the console cable plugged in */
export function managedSwitch(o = {}) {
  const g = new THREE.Group(), W = 440, H = 44, D = 260, Y0 = 1.4;
  const silver = paintedSteel(0xb8bbbf, { rough: 0.42 }), face = paintedSteel(0x17181b, { rough: 0.5 }), lid = paintedSteel(0x34373c, { rough: 0.46 });
  g.add(at(rbox(W, H, D, 1.2, silver), 0, Y0 + H / 2, 0));
  g.add(at(box(W - 1, 0.6, D - 3, lid), 0, Y0 + H + 0.05, -1));                       /* the dark lid */
  g.add(at(rbox(W, H, 2.4, 0.8, face), 0, Y0 + H / 2, D / 2 + 1.2));                  /* the front panel */
  [[-190, 110], [190, 110], [-190, -110], [190, -110]].forEach(function (p) { g.add(at(cyl(5, Y0, rubber(0x18191b), 20), p[0], Y0 / 2, p[1])); });
  /* the rack ears: an L of brushed steel each side, two slots in the face, two screws into the side */
  [-1, 1].forEach(function (sd) {
    const ear = brushed(0xc9ccd0, "y", { rough: 0.38 });
    g.add(at(box(21.3, H, 2, ear), sd * (W / 2 + 10.65), Y0 + H / 2, D / 2 + 1));
    g.add(at(box(2, H, 32, ear), sd * (W / 2 + 1), Y0 + H / 2, D / 2 - 15));
    [11, 33].forEach(function (y) { g.add(at(slotHole(10, 6.4), sd * (W / 2 + 12), Y0 + y, D / 2 + 2.05)); });
    [-6, -24].forEach(function (z) { const s = screw(2.4, 0x9a9da2); s.rotation.y = sd * Math.PI / 2; s.position.set(sd * (W / 2 + 2.05), Y0 + H / 2, D / 2 + z); g.add(s); });
    /* vent holes down the side, near the front */
    const side = new THREE.Group(); at(side, sd * (W / 2 + 0.05), Y0 + H / 2, D / 2 - 75, 0, sd * Math.PI / 2, 0); g.add(side);
    side.add(at(box(78, 26, 0.1, mat(0x0b0c0d, { rough: 1 })), 0, 0, 0.05));
    const pf = perforated(80, 28, { pitch: 4.2, d: 2.8, shape: "hex", material: paintedSteel(0xb8bbbf, { rough: 0.42 }) }); pf.position.z = 0.3; side.add(pf);
  });
  /* ---- the front ---- */
  const front = new THREE.Group(); front.name = "panel:Front"; at(front, 0, Y0, D / 2 + 2.45); g.add(front);
  const F = 0.05, inkAt = function (s, w, h, x, y, o2) { const t = ink(s, w, h, o2); front.add(at(t, x, y, F)); return t; };
  inkAt("MANAGED SWITCH 24-PORT + 4 SFP", 96, 3.4, -164, 40.4, { weight: "700", align: "left" });
  inkAt("MODEL: MSW-2800G", 46, 3.4, 191, 40.4, { weight: "700", align: "right" });
  /* the key to the port lights: Speed and Link for the top row, Link and Activity for the bottom */
  [["Speed", 31.5], ["Link", 26.5], ["Link", 15.8], ["Activity", 10.8]].forEach(function (k) {
    inkAt(k[0], 18, 3, -184, k[1], { weight: "500", align: "right" });
    const l = led(COL.ledGreen, true, 1.05); l.userData.role = "key"; front.add(at(l, -172.6, k[1], 0.4));
  });
  /* the 24 ports: twelve columns in two blocks of six, in their grey frames */
  const PX = 17.4, colX = function (c) { return -156 + c * PX + (c >= 6 ? 9 : 0); }, TOP = 28.6, BOT = 13.6;
  [[0, 5], [6, 11]].forEach(function (b) { const x0 = colX(b[0]) - PX / 2 - 0.6, x1 = colX(b[1]) + PX / 2 + 0.6; front.add(at(rbox(x1 - x0, 32.4, 0.8, 0.6, mat(0xc7cacd, { metal: 0.55, rough: 0.4 })), (x0 + x1) / 2, (TOP + BOT) / 2, 0.4)); });
  const plugged = o.plugged || Array.from({ length: 24 }, function (_, i) { return i === 9; });
  const jacks = {};
  for (let c = 0; c < 12; c++) {
    [[2 * c + 1, TOP, false], [2 * c + 2, BOT, true]].forEach(function (pp) {
      const n = pp[0], lit = o.lights ? o.lights[n - 1] : true;
      const j = rj45Jack({ name: String(n), metal: true, on: [lit, lit], actColor: COL.ledGreen });
      at(j, colX(c), pp[1], 0.8); if (pp[2]) j.rotation.z = Math.PI;   /* the lower row upside down, lights at the bottom, as stacked jacks are */
      front.add(j); jacks[n] = j;
      inkAt(String(n), 6, 2.8, colX(c), pp[2] ? 3.7 : 37.4, { weight: "500" });
    });
  }
  /* SFP1 to SFP4 in their bracket, two lights each */
  const SX = [78, 96.5, 115, 133.5], sfps = [], sfpCol = o.sfp || [0xd9dbdd, 0xd9dbdd, 0xe8893a, null];
  front.add(at(printLines(76, 28, [[0, -1.6, 74, 22.6, 1.2]], { color: "#d8dbdf", width: 0.35 }), 105.75, 22, F));
  SX.forEach(function (x, k) {
    const lit = !!sfpCol[k] && (o.sfpLights ? o.sfpLights[k] : true);
    const cg = sfpCage("SFP" + (k + 1), { on: [lit, lit] }); at(cg, x, 19.6, 0.1); front.add(cg); sfps.push(cg);
    const lb = ink("SFP" + (k + 1), 9.5, 2.8, { weight: "500", bg: "#17181b" }); front.add(at(lb, x, 33.2, F + 0.02));
  });
  /* the power and fan lights under the power symbol: green when good; the amber fault lights beside them unlit */
  front.add(at(powerIcon(4.2), 154.5, 33, F));
  [["PSU", 25.2], ["FAN", 18.2]].forEach(function (r) {
    const a = led(COL.ledGreen, true, 1.1); a.userData.role = r[0]; front.add(at(a, 151.6, r[1], 0.4));
    const b = led(COL.ledAmber, false, 1.1); b.userData.role = r[0] + " FAULT"; front.add(at(b, 157.6, r[1], 0.4));
  });
  /* CONSOLE over the console port, the MGMT port under it */
  inkAt("CONSOLE", 18, 3, 172, 37.4, { weight: "500" });
  const con = rj45Jack({ name: "CONSOLE", metal: true, leds: false }), mg = rj45Jack({ name: "MGMT", metal: true, leds: false });
  front.add(at(rbox(19.2, 32.4, 0.8, 0.6, mat(0xc7cacd, { metal: 0.55, rough: 0.4 })), 172, (TOP + BOT) / 2, 0.4));
  at(con, 172, TOP, 0.8); at(mg, 172, BOT, 0.8); front.add(con, mg);
  inkAt("MGMT", 12, 2.8, 172, 3.7, { weight: "500" });
  /* the USB console port (mini-B) and its trident; SYSTEM and POWER */
  const mini = new THREE.Shape(); [[-3.5, 1.5], [3.5, 1.5], [3.5, -0.6], [2.6, -1.5], [-2.6, -1.5], [-3.5, -0.6]].forEach(function (q, i) { if (i) mini.lineTo(q[0], q[1]); else mini.moveTo(q[0], q[1]); }); mini.closePath();
  const usb = socket(shapeRR(8.8, 4.6, 0.6), mini, { d: 1.0 }); usb.add(at(box(5.4, 0.8, 0.6, mat(COL.black, { rough: 0.5 })), 0, 0.2, 0.35)); named(usb, "port:USB CONSOLE", { type: "mini-usb" });
  at(usb, 191.5, 24.6, 0.1); front.add(usb);
  inkAt("USB", 7, 2.8, 200.8, 24.6, { weight: "700" }); front.add(at(usbIcon(2.6), 208.2, 24.6, F));
  inkAt("SYSTEM", 16, 3, 197, 14.4, { weight: "500", align: "right" });
  const sy = led(COL.ledGreen, true, 1.2); sy.userData.role = "SYSTEM"; front.add(at(sy, 208, 14.4, 0.4));
  inkAt("POWER", 16, 3, 197, 7.6, { weight: "500", align: "right" });
  const pw = led(COL.ledGreen, true, 1.2); pw.userData.role = "POWER"; front.add(at(pw, 208, 7.6, 0.4));
  /* ---- the rear ---- */
  const back = new THREE.Group(); back.name = "panel:Rear"; at(back, 0, Y0, -D / 2 - 0.02, 0, BACK, 0); g.add(back);
  back.add(at(dark("MANAGED SWITCH 24-PORT\n+ 4 SFP", 52, 7.4, { weight: "700" }), -168, 37.4, 0.05));
  const ac = iecInlet("AC IN"); at(ac, -168, 20.6, 0.05); back.add(ac);
  back.add(at(dark("AC INPUT  100-240V~  50/60Hz  2A", 56, 2.8, { weight: "600" }), -168, 4.4, 0.05));
  const fan = fanGrille(38, 0x3b3e43); at(fan, -112, 22, 0.05); back.add(fan);
  back.add(at(new THREE.Mesh(new THREE.RingGeometry(19, 20.4, 48), mat(0x2a2c30, { rough: 0.6 })), -112, 22, 0.08));
  [[-16, 16], [16, 16], [-16, -16], [16, -16]].forEach(function (q) { const s = screw(1.9, 0x9a9da2); s.rotation.x = -Math.PI / 2; s.position.set(-112 + q[0], 22 + q[1], 0.05); back.add(s); });
  const vent = dark("VENTILATION", 34, 3, { weight: "700" }); vent.rotation.z = Math.PI / 2; back.add(at(vent, -86.5, 22, 0.05));
  const reg = label(["MANAGED SWITCH · MODEL: MSW-2800G", "100-240V~ 50/60Hz 2A · CLASS A", "S/N: " + COVERED], { w: 58, h: 15, marks: true, bg: "#eceae4" }); at(reg, 150, 31, 0.05); back.add(reg);
  const mac = label(["MAC: " + "██:██:██:██:██:██"], { w: 58, h: 11, barcode: "msw-mac", boldFirst: false, bg: "#f2f1ec" }); at(mac, 150, 12.6, 0.05); back.add(mac);
  /* ---- the cables, as photographed: a grey patch cable in port 10, fiber in the SFP slots ---- */
  const cables = [];
  for (let n = 1; n <= 24; n++) {
    if (!plugged[n - 1] || o.cords === false) continue;   /* o.cords false: plugs and cords are laid by whatever holds it (the rack) */
    const c = Math.floor((n - 1) / 2), x = colX(c), p = patch(jacks[n], 0xa4a8ad);
    cableFrom(g, p, [[x - 26, Y0 + 6, D / 2 + 70], [x - 70, 3.05, D / 2 + 130], [x - 210, 3.05, D / 2 + 260]], { straight: 24 });
    cables.push(p);
  }
  sfps.forEach(function (cg, k) {
    if (!sfpCol[k]) return;
    const m = plugInto(cg, sfpModule({ cable: sfpCol[k] }), { y: 0, z: 0.4 }), x = SX[k];
    cableFrom(g, m, [[x + 14 + k * 4, Y0 + 8, D / 2 + 76], [x + 40 + k * 10, 1.6, D / 2 + 128 + k * 6], [x + 230 + k * 16, 1.6, D / 2 + 200 + k * 10]], { straight: 16, r: 1.6 });
  });
  if (o.console) {
    const cp = plugInto(con, rj45Plug({ standard: "T568B", boot: 0xa9adb2, jacket: 0xa9adb2 }));
    cableFrom(g, cp, [[180, Y0 + 10, D / 2 + 70], [196, 3.05, D / 2 + 130], [250, 3.05, D / 2 + 260]], { straight: 24 });
  }
  return named(g, "device:Managed switch", { type: "managed-switch", w: W + 42.6, h: H + Y0, d: D });
}

/* ------------------------------------------------------- the patch panel */
/* A 24-port Cat6 patch panel, 1U, as photographed: the dark face, four groups of six jacks in their light
   modules, a white write-on tab over each jack and its number under it, "Cat6 Patch Panel (24-Port)" at the
   right, silver rack screws in the ears. Jacks named "port:P1" to "port:P24". o.plugged: which have a cord */
export function patchPanel24(o = {}) {
  const g = new THREE.Group(), U = 44.45, face = paintedSteel(0x232528, { rough: 0.5 });
  g.add(at(box(482.6, U - 0.8, 1.6, face), 0, U / 2, 0.8));
  g.add(at(box(452, U - 4, 2, face), 0, U / 2, -1));                               /* the folded body behind the face */
  const PX = 16.1, gx = function (n) { const gi = Math.floor((n - 1) / 6), k = (n - 1) % 6; return -212 + gi * (6 * PX + 3.6) + k * PX + PX / 2; };
  for (let gi = 0; gi < 4; gi++) {
    const x0 = gx(gi * 6 + 1) - PX / 2 - 0.8, x1 = gx(gi * 6 + 6) + PX / 2 + 0.8;
    g.add(at(rbox(x1 - x0, 18.6, 1.2, 0.6, plastic(0xd9dbdc, { rough: 0.5 })), (x0 + x1) / 2, U / 2 + 0.6, 2.1));
  }
  const jacks = {}, on = o.plugged || Array.from({ length: 24 }, function (_, i) { return i >= 5 && i <= 12; });
  for (let n = 1; n <= 24; n++) {
    const j = rj45Jack({ name: "P" + n, insert: 0x141517, leds: false }); at(j, gx(n), U / 2 + 0.6, 2.7); g.add(j); jacks[n] = j;
    g.add(at(box(12.6, 4.2, 0.3, plastic(0xf2f2ee, { rough: 0.7 })), gx(n), U - 6.2, 1.75));      /* the write-on tab */
    g.add(at(ink(String(n), 6, 3.4, { weight: "600" }), gx(n), 5.6, 1.65));
  }
  g.add(at(ink("Cat6\nPatch Panel\n(24-Port)", 26, 10, { weight: "600" }), 201, U / 2 + 0.6, 1.65));
  [-1, 1].forEach(function (sd) { [6.35, 38.1].forEach(function (y) { const s = screw(3.4, 0xb8bbbf); s.rotation.x = -Math.PI / 2; s.position.set(sd * 232.5, y, 1.65); g.add(s); }); });
  named(g, "device:Patch panel", { type: "patch-panel" }); g.userData.jacks = jacks; g.userData.on = on; g.userData.gx = gx;   /* after named(), which sets userData afresh */
  return g;
}

/* ------------------------------------------------- the 8-port shelf switch */
/* The unmanaged 8-port gigabit switch on the rack's shelf, as photographed: a slate-grey steel case, the
   grid of green lights at the left of the front, eight ports, "8-Port Gigabit Switch" top right, vent slots
   down the side. Ports "1" to "8"; o.plugged (photo: 1 to 7); o.cords: patch cables in the plugged ports */
export function desktopSwitch8(o = {}) {
  const g = new THREE.Group(), W = 236, H = 30, D = 150, Y0 = 1;
  const steel = paintedSteel(0x50545a, { rough: 0.45 }), front = paintedSteel(0x5b5f65, { rough: 0.48 });
  g.add(at(rbox(W, H, D, 2.2, steel), 0, Y0 + H / 2, 0));
  g.add(at(rbox(W - 4, H - 4, 1, 1.4, front), 0, Y0 + H / 2, D / 2 + 0.2));
  [[-100, 60], [100, 60], [-100, -60], [100, -60]].forEach(function (p) { g.add(at(cyl(5, Y0, rubber(0x18191b), 20), p[0], Y0 / 2, p[1])); });
  const f = new THREE.Group(); f.name = "panel:Ports"; at(f, 0, Y0, D / 2 + 0.75); g.add(f);
  /* the lights: power, then a link light for each port, in a grid as photographed */
  const on = o.plugged || [true, true, true, true, true, true, true, false];
  /* POWER sits to the left of the 4 x 2 grid of port lights (until 17 October 2026 it sat 0.6 mm from port 1's,
     so a dark port 1 read as lit: caught by tools/models.mjs) */
  [[-104, 15.2, "POWER", true]].concat(on.map(function (p, i) { return [-96 + (i % 4) * 6, 12.5 - Math.floor(i / 4) * 5.4 + 5.4, String(i + 1), p]; })).forEach(function (l) {
    const d = led(COL.ledGreen, l[3], 0.95); d.userData.role = l[2] === "POWER" ? "POWER" : "LINK " + l[2]; f.add(at(d, l[0], l[1], 0.3));
  });
  const jacks = [];
  for (let i = 0; i < 8; i++) { const j = rj45Jack({ name: String(i + 1), metal: true, on: [on[i], on[i]], actColor: COL.ledGreen }); at(j, -28 + i * 16.6, 13.6, 0.2); f.add(j); jacks.push(j); }
  f.add(at(ink("8-Port Gigabit Switch", 46, 3.6, { weight: "600" }), 86, 23.4, 0.05));
  const side = new THREE.Group(); at(side, W / 2 + 0.05, Y0 + H / 2, 20, 0, Math.PI / 2, 0); g.add(side);
  for (let k = 0; k < 12; k++) side.add(at(box(1.8, 14, 0.4, mat(0x060607, { rough: 1 })), -26 + k * 4.4, 0, 0.05));
  /* o.cords: a grey patch cable in each plugged port, run off the front and down to the bench (the live Physical tab; the rack lays its own) */
  if (o.cords) on.forEach(function (p, i) {
    if (!p) return;
    const x = -28 + i * 16.6, c = patch(jacks[i], 0xa4a8ad);
    cableFrom(g, c, [[x - 6 + i * 2, Y0 + 14, D / 2 + 60], [x - 20 + i * 6, 3.05, D / 2 + 120], [x - 60 + i * 14, 3.05, D / 2 + 240]], { straight: 22 });
  });
  named(g, "device:8-port switch", { type: "switch", w: W, h: H + Y0, d: D }); g.userData.jacks = jacks; g.userData.on = on;
  return g;
}

/* ------------------------------------------------------- the 6U wall rack */
/* A 6U wall rack, as photographed: a light grey steel frame on the wall, the front rails with their square
   holes, a 24-port Cat6 patch panel at the top, the rack's own "6U Wall Rack" panel under it, a vented
   shelf below with the 8-port switch on it; grey patch cords looping down from the panel and from the switch.
   o.managed: the small office's version, the managed switch mounted under the patch panel in place of the
   name panel, short cords from the panel down to it */
export function wallRack6U(o = {}) {
  const g = new THREE.Group(), U = 44.45, Y = 20, TOP = Y + 6 * U, DP = 380, frame = paintedSteel(0xaeb2b7, { rough: 0.38 }), hole = mat(0x0c0d0e, { rough: 1 });
  if (o.wall !== false) g.add(at(box(1100, 760, 4, mat(0xe6e4df, { rough: 0.92, grain: 0.1, scale: 1.3 })), 0, 150, -DP - 14));
  /* the front rails: an L each side, square holes three to a U */
  [-1, 1].forEach(function (sd) {
    g.add(at(box(20, 6 * U + 40, 2, frame), sd * 234, TOP / 2 + 10, -2));
    g.add(at(box(2, 6 * U + 40, 44, frame), sd * 243, TOP / 2 + 10, -24));
    for (let u = 0; u < 6; u++) [6.35, 22.25, 38.1].forEach(function (y) { g.add(at(box(9.5, 9.5, 0.2, hole), sd * 232.5, Y + u * U + y, -0.9)); });
    /* the side frame back to the wall: a post at the back, bars top, middle and bottom */
    g.add(at(box(20, 6 * U + 40, 20, frame), sd * 245, TOP / 2 + 10, -DP + 10));
    [Y - 10, Y + 3 * U, TOP + 10].forEach(function (y) { g.add(at(box(14, 20, DP - 40, frame), sd * 248, y, -DP / 2)); });
    g.add(at(box(40, 6 * U + 60, 3, frame), sd * 240, TOP / 2 + 10, -DP - 10));    /* the wall plate */
  });
  /* top and bottom: a flat bar across the front and the back */
  [Y - 10, TOP + 10].forEach(function (y) { g.add(at(box(510, 20, 3, frame), 0, y, 0.5)); g.add(at(box(510, 20, 3, frame), 0, y, -DP + 2)); });
  /* the patch panel in U6 */
  const pp = patchPanel24(o.managed ? { plugged: Array.from({ length: 24 }, function (_, i) { return i < 10; }) } : {}); at(pp, 0, Y + 5 * U, 0); g.add(pp);
  if (o.managed) {
    const sw = managedSwitch({ cords: false, lights: Array.from({ length: 24 }, function (_, i) { return i < 10; }), sfp: [null, null, null, null] });
    at(sw, 0, Y + 4 * U - 1.4, -130); g.add(sw);   /* its ears against the rails, under the patch panel */
    /* short blue cords: patch panel port n down to switch port n, each landing straight into its port */
    for (let n = 1; n <= 10; n++) {
      const pj = pp.userData.jacks[n], plug = patch(pj, 0x2f6fd0), sj = sw.getObjectByName("port:" + n), sp = patch(sj, 0x2f6fd0);
      g.updateMatrixWorld(true);
      const p0 = pj.getWorldPosition(new THREE.Vector3()); g.worldToLocal(p0);
      const ex = sp.localToWorld(new THREE.Vector3(0, 0, sp.userData.exitZ)); g.worldToLocal(ex);
      const ex2 = sp.localToWorld(new THREE.Vector3(0, 0, sp.userData.exitZ - 18)); g.worldToLocal(ex2);
      cableFrom(g, plug, [[p0.x + 2, p0.y - 16, 42], [(p0.x + ex.x) / 2 + 4, (p0.y + ex.y) / 2 - 4, 50], ex2, ex], { straight: 14 });
    }
  } else {
    /* the rack's own panel in U5: "6U Wall Rack" and its marks */
    const np = new THREE.Group(); at(np, 0, Y + 4 * U, 0); g.add(np);
    np.add(at(box(482.6, U - 0.8, 1.6, brushed(0xc4c7cb, "x", { rough: 0.4 })), 0, U / 2, 0.8));
    np.add(at(dark("6U Wall Rack", 46, 6, { weight: "600" }), 186, U / 2 + 7, 1.65));
    const rm = label([""], { w: 40, h: 8, marks: true, bg: "#c4c7cb" }); at(rm, 192, U / 2 - 8, 1.62); np.add(rm);
    [-1, 1].forEach(function (sd) { [6.35, 38.1].forEach(function (y) { const s = screw(3.4, 0xb8bbbf); s.rotation.x = -Math.PI / 2; s.position.set(sd * 232.5, y, 1.65); np.add(s); }); });
    /* cords from the panel, looping down in front and back into the rack above the shelf */
    for (let n = 6; n <= 13; n++) {
      const pj = pp.userData.jacks[n], plug = patch(pj, 0xa4a8ad), x = pp.userData.gx(n);
      cableFrom(g, plug, [[x - 2, Y + 5 * U - 26, 50], [x + 4, Y + 3 * U + 6, 40], [x + 8, Y + 3 * U - 4, -14], [x + 12, Y + 4 * U + 12, -60], [x + 16, Y + 4 * U + 20, -200]], { straight: 16 });   /* down in a loop, then back up behind the name panel */
    }
  }
  /* the vented shelf: the tray, its front lip, its arms down to the rails */
  const sy = Y + U + 2;
  const tray = perforated(450, DP - 60, { pitch: 9, d: 3.4, shape: "slot", material: paintedSteel(0xaeb2b7, { rough: 0.38 }) }); tray.rotation.x = -Math.PI / 2; tray.position.set(0, sy, -(DP - 60) / 2); g.add(tray);
  g.add(at(box(452, 10, 1.6, frame), 0, sy + 2, 0.8)); g.add(at(box(452, 1.6, 14, frame), 0, sy - 0.8, -6));
  [-1, 1].forEach(function (sd) { g.add(at(box(14, U, 2, frame), sd * 232.5, Y + U / 2 + 2, 1)); g.add(at(box(2, 12, DP - 60, frame), sd * 225, sy + 5, -(DP - 60) / 2)); });
  if (!o.managed) {
    const s8 = desktopSwitch8(); at(s8, 0, sy, -82); g.add(s8);
    g.updateMatrixWorld(true);
    s8.userData.jacks.forEach(function (j, i) {
      if (!s8.userData.on[i]) return;
      const p = patch(j, 0xa4a8ad), x = -28 + i * 16.6;
      cableFrom(g, p, [[x - 3, sy + 2, 30], [x + 2, Y + 4, 34], [x + 8, Y - 2, -10], [x + 14, Y + 6, -200]], { straight: 14 });
    });
  }
  return named(g, "device:6U wall rack", { type: "rack", w: 520, h: TOP + 20, d: DP });
}

/* ------------------------------------------------------- the console kit */
const trap = function (wt, wb, h) { const s = new THREE.Shape(); s.moveTo(-wt / 2, h / 2); s.lineTo(wt / 2, h / 2); s.lineTo(wb / 2, -h / 2); s.lineTo(-wb / 2, -h / 2); s.closePath(); return s; };
const trapPath = function (wt, wb, h) { const s = trap(wt, wb, h), p = new THREE.Path(); p.curves = s.curves; p.currentPoint = s.currentPoint; return p; };
/* A DE-9 (DB-9) serial connector on its cord, built like every plug here (the mating face at +z, the cord
   leaving towards -z): the metal hood with its ribs, the front flange, the two knurled thumbscrews, and the
   face: o.female, nine sockets in a D-shaped insulator (a console cable's computer end); otherwise male, nine
   pins inside the D-shaped skirt (a USB serial adapter's). o.moulded: an all-black moulded body instead of metal */
export function db9Plug(o = {}) {
  const g = new THREE.Group(), metal = o.moulded ? mat(0x1b1c1f, { rough: 0.5, grain: 0.06 }) : mat(0xc3c6ca, { metal: 0.88, rough: 0.3, brushed: "z" });
  const boot = mat(o.boot == null ? 0x9ea2a7 : o.boot, { rough: 0.5, grain: 0.06 });
  g.add(at(box(31, 12.6, 1, metal), 0, 0, -0.5));                                                   /* the flange */
  /* the hood, seen from above a taper: 21 wide behind the flange (between the thumbscrews) to 15 where the cord leaves; 13 thick */
  const plan = new THREE.Shape(); plan.moveTo(-10.5, 0); plan.lineTo(10.5, 0); plan.lineTo(7.5, 29); plan.lineTo(-7.5, 29); plan.closePath();
  const hood = new THREE.Mesh(new THREE.ExtrudeGeometry(plan, { depth: 11, bevelEnabled: true, bevelSize: 1, bevelThickness: 1, bevelSegments: 3 }), metal);
  hood.rotation.x = Math.PI / 2; hood.position.set(0, 5.5, -1.2); hood.scale.y = -1; g.add(hood);   /* x across, y (shape) back along -z, the extrusion down through the thickness */
  if (!o.moulded) for (let k = 0; k < 6; k++) g.add(at(box(9 - k * 0.4, 0.5, 0.8, metal), 0, 6.75, -10 - k * 2.4));     /* the ribs on the hood */
  [-12.5, 12.5].forEach(function (x) {                                                             /* the thumbscrews: threaded through the flange, knurled heads behind it */
    g.add(at(cyl(1.5, 9, mat(0xd0d3d6, { metal: 0.9, rough: 0.25 }), 12), x, 0, 3.5, Math.PI / 2));
    const hd = cyl(3, 8, mat(0xd0d3d6, { metal: 0.9, rough: 0.3 }), 18); at(hd, x, 0, -5.5, Math.PI / 2); g.add(hd);
    for (let k = 0; k < 12; k++) g.add(at(box(0.5, 0.5, 7.4, mat(0xb4b7bb, { metal: 0.9, rough: 0.35 })), x + Math.cos(k / 12 * Math.PI * 2) * 3, Math.sin(k / 12 * Math.PI * 2) * 3, -5.5));
  });
  if (o.female) {
    const ins = trap(15.6, 13.0, 6.6); [0, 1, 2, 3, 4, 5, 6, 7, 8].forEach(function (k) { const top = k < 5, x = top ? (k - 2) * 2.77 : (k - 6.5) * 2.77, h = new THREE.Path(); h.absarc(x, top ? 1.42 : -1.42, 0.55, 0, Math.PI * 2, false); ins.holes.push(h); });
    g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(ins, { depth: 6, bevelEnabled: false, curveSegments: 10 }), mat(0x1c1d20, { rough: 0.6 })));
    const sk = trap(16.6, 14.0, 7.6); sk.holes.push(trapPath(15.6, 13.0, 6.6));
    g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(sk, { depth: 6, bevelEnabled: false }), metal));
    g.add(at(box(14, 5.4, 0.2, mat(COL.hole, { rough: 1 })), 0, 0, 0.6));
  } else {
    const sk = trap(17.4, 14.6, 8.2); sk.holes.push(trapPath(16.2, 13.4, 7));
    g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(sk, { depth: 6, bevelEnabled: false }), metal));
    g.add(at(new THREE.Mesh(new THREE.ShapeGeometry(trap(16.2, 13.4, 7)), mat(0x1c1d20, { rough: 0.6 })), 0, 0, 0.3));
    for (let k = 0; k < 9; k++) { const top = k < 5, x = top ? (k - 2) * 2.77 : (k - 6.5) * 2.77; g.add(at(cyl(0.5, 4.6, mat(COL.gold, { metal: 1, rough: 0.22 }), 10), x, top ? 1.42 : -1.42, 2.6, Math.PI / 2)); }
  }
  const L = 18, geo = tubeVar(new THREE.LineCurve3(V(0, 0, -31), V(0, 0, -31 - L)), { n: 90, m: 26, up: V(0, 1, 0),
    radius: function (t) { const zz = t * L, r = THREE.MathUtils.lerp(5.6, 2.9, zz / L) + (zz > 3 && zz < L - 2 && Math.sin(zz * 1.9) > 0.3 ? -0.55 : 0); return [r, r]; } });
  g.add(new THREE.Mesh(geo, boot));
  named(g, "plug:DB-9", { type: "db9", female: !!o.female });
  g.userData.exitZ = -31 - L + 2; g.userData.cable = { r: 2.6, color: o.boot == null ? 0x9ea2a7 : o.boot, text: o.text || "RS-232 CONSOLE CABLE  ·  28AWG x 8C", ink: "rgba(30,30,30,0.45)" };
  return g;
}
/* a USB-C plug on its cord: the knurled metal housing, the plug shell, a short boot */
export function usbCPlug(o = {}) {
  const g = new THREE.Group(), m = mat(0xc9ccd0, { metal: 0.9, rough: 0.3 });
  g.add(at(rbox(8.25, 2.4, 6.6, 1.15, mat(0xd8dadd, { metal: 1, rough: 0.2 })), 0, 0, 3.3));          /* the shell that goes into the port */
  g.add(at(rbox(12, 6.6, 15, 3, m), 0, 0, -7.5));
  for (let k = 0; k < 14; k++) g.add(at(box(12.2, 0.35, 0.5, mat(0xa9acb0, { metal: 0.9, rough: 0.35 })), 0, 3.32, -2 - k * 0.8));   /* the knurling */
  const L = 10, geo = tubeVar(new THREE.LineCurve3(V(0, 0, -15), V(0, 0, -15 - L)), { n: 40, m: 20, up: V(0, 1, 0), radius: function (t) { const r = THREE.MathUtils.lerp(3.2, 2.1, t); return [r, r]; } });
  g.add(new THREE.Mesh(geo, mat(o.boot == null ? 0x2b2d31 : o.boot, { rough: 0.5 })));
  named(g, "plug:USB-C", { type: "usb-c" });
  g.userData.exitZ = -15 - L + 1; g.userData.cable = { r: 2.0, color: o.cable == null ? 0x9ea2a7 : o.cable, text: "USB-C TO RS-232 SERIAL", ink: "rgba(30,30,30,0.45)" };
  return g;
}
/* a USB-A plug on its cord: the metal shell, the black moulded body with its grip ribs */
export function usbAPlug(o = {}) {
  const g = new THREE.Group(), m = mat(0x18191c, { rough: 0.5, grain: 0.06 });
  g.add(at(box(12, 4.5, 12, mat(0xd2d5d8, { metal: 1, rough: 0.22 })), 0, 0, 6));
  g.add(at(box(11, 1.9, 9, mat(0x101113, { rough: 0.6 })), 0, -0.6, 7.2));
  g.add(at(rbox(16, 8, 24, 2, m), 0, 0, -12));
  for (let k = 0; k < 5; k++) [-1, 1].forEach(function (sd) { g.add(at(box(0.6, 6, 1.2, m), sd * 8.1, 0, -16 - k * 2.4)); });
  const L = 12, geo = tubeVar(new THREE.LineCurve3(V(0, 0, -24), V(0, 0, -24 - L)), { n: 50, m: 22, up: V(0, 1, 0), radius: function (t) { const zz = t * L, r = THREE.MathUtils.lerp(4.2, 2.2, t) + (zz > 2 && Math.sin(zz * 2.4) > 0.4 ? -0.3 : 0); return [r, r]; } });
  g.add(new THREE.Mesh(geo, m));
  named(g, "plug:USB-A", { type: "usb-a" });
  g.userData.exitZ = -24 - L + 1; g.userData.cable = { r: 2.1, color: 0x1b1c1f, text: "USB-A TO RS-232 SERIAL", ink: "rgba(230,230,230,0.4)" };
  return g;
}
/* a cord coiled flat on the bench: loops side by side, at the cord's own radius off the bench */
function coil(cx, cz, r0, loops, y, a0, step) {
  const out = []; let a = a0;
  for (let i = 0; i <= loops * 12; i++) { const r = r0 + (i / 12) * (step || 5.4); out.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]); a += Math.PI / 6; }
  return out;
}

/* The console cable, as photographed, and how it connects: the grey console cable's RJ45 in the managed
   switch's CONSOLE port, the cord coiled on the bench, its DB-9 (female, the computer end) joined to a USB
   serial adapter's DB-9 (male), the adapter's grey cord to its USB-C plug in the laptop; a USB-A serial
   adapter lying in front, for a computer without USB-C. The photo's captions (Cisco-style pinout, UART,
   115200 baud) are not printed on the parts: the words under the model say what each part is, and that a
   switch's console runs at 9600 baud unless it has been changed. */
export function consoleKit(o = {}) {
  const g = new THREE.Group(), grey = 0x9ea2a7;
  const sw = managedSwitch({ cords: false, sfp: [null, null, null, null] }); at(sw, -300, 0, -150); g.add(sw);
  const lt = laptop({ title: "Serial terminal  ·  COM3  ·  9600 baud, 8-N-1", screen: ["", "Press RETURN to get started.", "", "", "Switch>_"] }); lt.rotation.y = -0.35; at(lt, 430, 0, 120); g.add(lt);
  /* the laptop's own Ethernet cable (it comes photographed with one) is not part of this picture */
  const ej = lt.getObjectByName("port:ETHERNET"), epl = ej && ej.children.find(function (c) { return /^plug:/.test(c.name); });
  if (epl) { const run = epl.userData.runMesh; if (run && run.parent) run.parent.remove(run); ej.remove(epl); }
  const fem = db9Plug({ female: true, boot: grey }); fem.rotation.y = Math.PI / 2; at(fem, 70, 7.6, 250); g.add(fem);   /* lying flat, its face towards the adapter */
  const mal = db9Plug({ boot: grey, text: "USB-C SERIAL ADAPTER" }); mal.rotation.y = -Math.PI / 2; at(mal, 76.5, 7.6, 250); g.add(mal);
  g.updateMatrixWorld(true);
  const wl = function (obj, z) { const v = obj.localToWorld(new THREE.Vector3(0, 0, z)); return g.worldToLocal(v); };
  const rp = plugInto(sw.getObjectByName("port:CONSOLE"), rj45Plug({ standard: "T568B", boot: grey, jacket: grey }));
  g.updateMatrixWorld(true);
  const fx = wl(fem, fem.userData.exitZ), fx2 = wl(fem, fem.userData.exitZ - 26);
  cableFrom(g, rp, [[-118, 30, 50], [-110, 2.6, 110]].concat(coil(-40, 190, 72, 3.4, 2.6, Math.PI, 6.2)).concat([[fx2.x, 2.6, fx2.z], [fx.x, fx.y, fx.z]]), { straight: 26 });   /* down to the bench, round in a coil, to the DB-9 */
  /* the adapter: its cord from the male DB-9 to the USB-C plug in the laptop's left side */
  const up = plugInto(lt.getObjectByName("port:USB-C"), usbCPlug({ cable: grey }), { y: 0, z: 0.6 });
  g.updateMatrixWorld(true);
  const ux = wl(up, up.userData.exitZ), ux2 = wl(up, up.userData.exitZ - 24);
  cableFrom(g, mal, [[150, 2.1, 262], [230, 2.1, 250], [ux2.x, Math.max(2.1, ux2.y - 6), ux2.z], [ux.x, ux.y, ux.z]], { straight: 18, r: 2.0 });
  /* the USB-A adapter lying in front */
  const ua = usbAPlug(); ua.rotation.set(0, -0.5, 0); at(ua, 260, 4, 390); g.add(ua);
  const ub = db9Plug({ moulded: true, boot: 0x1b1c1f, text: "USB-A SERIAL ADAPTER" }); ub.rotation.set(0, 2.2, 0); at(ub, 120, 7.6, 410); g.add(ub);
  g.updateMatrixWorld(true);
  const bx = wl(ub, ub.userData.exitZ), bx2 = wl(ub, ub.userData.exitZ - 20);
  cableFrom(g, ua, [[200, 2.1, 430], [170, 2.1, 450], [bx2.x, 2.1, bx2.z], [bx.x, bx.y, bx.z]], { straight: 14, r: 2.1 });
  return named(g, "device:Console kit", { type: "console" });
}

/* Your laptop on the job, for its Physical tab: the photographed laptop with its own patch cable in the ETHERNET port
   (taken out by the viewer when it isn't cabled) and, while the console cable is in (o.console), the USB serial
   adapter's USB-C plug in its left side, the adapter's grey cord dropping to the bench and running off towards the
   switch. On screen (o.title, o.screen): whatever is open, the TFTP server, the serial terminal or Command Prompt. */
export function techLaptop(o = {}) {
  const g = new THREE.Group();
  const lt = laptop({ title: o.title, screen: o.screen }); g.add(lt);
  if (o.console) {
    const up = plugInto(lt.getObjectByName("port:USB-C"), usbCPlug({ cable: 0x9ea2a7 }), { y: 0, z: 0.6 });
    cableFrom(g, up, [[-198, 6, 4], [-197, 2.1, 30], [-198, 2.1, 90], [-194, 2.1, 170], [-186, 2.1, 280]], { straight: 12, r: 2.0 });   /* down beside the laptop, inside the patch cable's run */
  }
  return named(g, "device:Your laptop", { type: "laptop", w: 324, h: 230, d: 226 });
}
