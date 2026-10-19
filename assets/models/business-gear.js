/* =====================================================================
   Small-business gear (level 3), from the owner's photographs of
   19 October 2026: the business router's front in a rack, and a ceiling
   access point on its mounting plate under a ceiling tile. Each photo shows
   one side; the sides they don't show follow the standard design for that
   kind of device, and are previewed before use. Real millimetres; front
   faces +Z; sits on y = 0. Brand names and logos are left off (the model is
   our own BR-4200); serial numbers and MAC addresses are covered.
   ===================================================================== */
import * as THREE from "three";
import { COL, mat, rbox, box, cyl, at, named, text, COVERED, led, rj45Jack, iecInlet, fanGrille, screw, socket, pinhole, rocker, cable } from "./parts.js";
import { rj45Plug, plugInto, cableFrom } from "./cables.js";
import { perforated, printLines, label, plastic, paintedSteel, brushed, rubber } from "./surface.js";
import { sfpCage, sfpModule } from "./office-gear.js";

const BACK = Math.PI;
const ink = function (s, w, h, o) { return text(s, w, h, Object.assign({ color: "#e8eef0", weight: "600" }, o || {})); };
const dark = function (s, w, h, o) { return text(s, w, h, Object.assign({ color: "#25282d", weight: "600" }, o || {})); };
function shapeRR(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function slotHole(w, h) { const m = new THREE.Mesh(new THREE.ShapeGeometry(shapeRR(w, h, Math.min(w, h) / 2), 12), mat(COL.hole, { rough: 1 })); m.userData.hole = true; return m; }
/* a USB-A port, its opening facing +Z */
function usbAPort(name) {
  const g = socket(shapeRR(14.6, 7.2, 0.6), shapeRR(12.5, 5.1, 0.3), { d: 1.0 });
  g.add(at(box(11.2, 1.8, 0.6, mat(COL.black, { rough: 0.5 })), 0, 0.9, 0.4));
  return named(g, "port:" + name, { type: "usb-a" });
}

/* ------------------------------------------------------- the business router */
/* BR-4200, 1U for a 19-inch rack, its front as photographed: the slate-blue face; a vent at the left; four
   status lights (PWR, SYS, ACT, ALM) and the recessed reset; the two SFP slots stacked (GE 0/8, GE 0/9) with
   their link and activity lights; the RJ45 console port; eight copper gigabit ports in a row (GE 0/0 to
   0/7, numbered on the yellow strip under them, as the photo's strip is yellow) under a long vent; two USB
   ports; the power section at the right: the rocker switch, the AC inlet, its lights and the fan. Not in the
   photo, so drawn as such a router usually is: the rear (vents, the ground stud, the labels) and the sides
   (vents near the front, the rack ears).
   o.plugged: which of ports 0-7 have a patch cable, o.cords: their colours (photo: yellow and blue);
   o.sfp: a cord colour for each SFP slot or null (photo: orange multimode in both); o.console: the console
   cable plugged in; o.lights: each copper port's light; o.status: { PWR, SYS, ACT, ALM } on or off */
export function businessRouter(o = {}) {
  const g = new THREE.Group(), W = 440, H = 44, D = 300, Y0 = 1.4;
  const slate = paintedSteel(0x34505d, { rough: 0.48 }), lid = paintedSteel(0x2b4350, { rough: 0.46 }), face = paintedSteel(0x30495a, { rough: 0.5 });
  g.add(at(rbox(W, H, D, 1.4, slate), 0, Y0 + H / 2, 0));
  g.add(at(box(W - 1, 0.6, D - 3, lid), 0, Y0 + H + 0.05, -1));
  g.add(at(rbox(W, H, 2.4, 0.8, face), 0, Y0 + H / 2, D / 2 + 1.2));
  [[-195, 125], [195, 125], [-195, -125], [195, -125]].forEach(function (p) { g.add(at(cyl(5, Y0, rubber(0x18191b), 20), p[0], Y0 / 2, p[1])); });
  /* the rack ears, in the router's own colour */
  [-1, 1].forEach(function (sd) {
    g.add(at(box(21.3, H, 2, slate), sd * (W / 2 + 10.65), Y0 + H / 2, D / 2 + 1));
    g.add(at(box(2, H, 34, slate), sd * (W / 2 + 1), Y0 + H / 2, D / 2 - 16));
    [11, 33].forEach(function (y) { g.add(at(slotHole(10, 6.4), sd * (W / 2 + 12), Y0 + y, D / 2 + 2.05)); });
    [-6, -26].forEach(function (z) { const s = screw(2.4, 0x9a9da2); s.rotation.y = sd * Math.PI / 2; s.position.set(sd * (W / 2 + 2.05), Y0 + H / 2, D / 2 + z); g.add(s); });
    const side = new THREE.Group(); at(side, sd * (W / 2 + 0.05), Y0 + H / 2, D / 2 - 90, 0, sd * Math.PI / 2, 0); g.add(side);
    side.add(at(box(96, 26, 0.1, mat(0x0b0c0d, { rough: 1 })), 0, 0, 0.05));
    const pf = perforated(98, 28, { pitch: 4.2, d: 2.8, shape: "hex", material: paintedSteel(0x34505d, { rough: 0.48 }) }); pf.position.z = 0.3; side.add(pf);
  });
  /* ---- the front ---- */
  const front = new THREE.Group(); front.name = "panel:Front"; at(front, 0, Y0, D / 2 + 2.45); g.add(front);
  const F = 0.05, inkAt = function (s, w, h, x, y, o2) { const t = ink(s, w, h, o2); front.add(at(t, x, y, F)); return t; };
  const grille = function (w, h, x, y) { front.add(at(box(w - 1, h - 1, 0.1, mat(0x0b0c0d, { rough: 1 })), x, y, 0.02)); const p = perforated(w, h, { pitch: 3.2, d: 2.2, shape: "hex", material: paintedSteel(0x30495a, { rough: 0.5 }) });   /* a material of its own: the holes go into the material it's given */ at(p, x, y, 0.12); front.add(p); };
  grille(28, 36, -202, 22);                                                   /* the vent at the left */
  inkAt("BUSINESS ROUTER", 40, 3.6, -159, 37.6, { weight: "700" });          /* where the photo has its brand mark: our own words */
  /* the status lights, their names beside them; the reset under them */
  const status = Object.assign({ PWR: true, SYS: true, ACT: true, ALM: false }, o.status || {}), SL = {};
  ["PWR", "SYS", "ACT", "ALM"].forEach(function (k, i) {
    const y = 31 - i * 6.2, l = led(k === "ALM" ? COL.ledAmber : COL.ledGreen, !!status[k], 1.05); l.userData.role = k; front.add(at(l, -140, y, 0.4)); SL[k] = l;
    inkAt(k, 8, 2.6, -131.5, y, { weight: "600", align: "left" });
  });
  const rst = pinhole("RESET"); at(rst, -116, 10, 0.05); front.add(rst); inkAt("RESET", 10, 2.4, -116, 4.6, { weight: "500" });
  /* the SFP slots, stacked, with their lights; the yellow strip under them */
  const sfpOn = o.sfp || [0xe8893a, 0xe8893a], sfpLit = o.sfpLights || [!!sfpOn[0], !!sfpOn[1]];
  [["8", 0, 0], ["9", 1, 0]].forEach(function (s) {
    const k = s[1], y = 31 - k * 13.2;
    ["LNK", "ACT"].forEach(function (r, j) { const l = led(COL.ledGreen, sfpLit[k], 0.95); l.userData.role = "GE 0/" + s[0] + " " + r; front.add(at(l, -94, y + 2.6 - j * 5.2, 0.4)); inkAt(r + " " + s[0], 9, 2.2, -86, y + 2.6 - j * 5.2, { weight: "500", align: "left" }); });
  });
  const cages = [];
  [0, 1].forEach(function (k) { const cg = sfpCage("Gi0/" + (8 + k), { leds: false }); at(cg, -62, 31 - k * 13.2, 0.1); front.add(cg); cages.push(cg); });
  front.add(at(box(36, 3.6, 0.2, mat(0xe0b52a, { rough: 0.6 })), -62, 4.8, 0.06));
  front.add(at(dark("GE 0/8   GE 0/9", 34, 2.6, { weight: "700" }), -62, 4.8, 0.2));
  inkAt("WAN 0/8   WAN 0/9", 30, 2.4, -62, 40.6, { weight: "600" });           /* the photo prints WAN over its fibre slots */
  /* the console port, the USB console port under it (the photo's two stacked ports) */
  inkAt("CON", 8, 2.6, -21, 40.2, { weight: "600" });
  const con = rj45Jack({ name: "CONSOLE", metal: true, leds: false }); at(con, -21, 30.5, 0.8); front.add(con);
  front.add(at(box(17.4, 15.4, 0.6, mat(0x8fa3ad, { metal: 0.5, rough: 0.4 })), -21, 30.5, 0.3));
  const mini = new THREE.Shape(); [[-3.5, 1.5], [3.5, 1.5], [3.5, -0.6], [2.6, -1.5], [-2.6, -1.5], [-3.5, -0.6]].forEach(function (q, i) { if (i) mini.lineTo(q[0], q[1]); else mini.moveTo(q[0], q[1]); }); mini.closePath();
  const usbc = socket(shapeRR(8.8, 4.6, 0.6), mini, { d: 1.0 }); usbc.add(at(box(5.4, 0.8, 0.6, mat(COL.black, { rough: 0.5 })), 0, 0.2, 0.35)); named(usbc, "port:USB CONSOLE", { type: "mini-usb" });
  at(usbc, -21, 15.5, 0.1); front.add(usbc); inkAt("USB CON", 14, 2.4, -21, 9.8, { weight: "500" });
  /* the long vent over the copper ports, the ports in a row, the yellow strip with their numbers */
  grille(150, 12, 63, 36.4);
  const PX = 17.2, jx = function (i) { return 2 + i * PX; }, jacks = [];
  for (let i = 0; i < 8; i++) {
    const lit = o.lights ? o.lights[i] : !!(o.plugged && o.plugged[i]);
    const j = rj45Jack({ name: "Gi0/" + i, metal: true, on: [lit, lit], actColor: COL.ledGreen }); at(j, jx(i), 18.4, 0.8); front.add(j); jacks.push(j);
  }
  front.add(at(box(8 * PX + 2, 4, 0.2, mat(0xe0b52a, { rough: 0.6 })), jx(3.5), 6.2, 0.06));
  for (let i = 0; i < 8; i++) front.add(at(dark("0/" + i, 8, 2.6, { weight: "700" }), jx(i), 6.2, 0.2));
  inkAt("GE", 6, 2.6, jx(0) - 12.6, 6.2, { weight: "700" });
  /* two USB ports */
  [0, 1].forEach(function (k) { const u = usbAPort("USB " + k); at(u, 154 + k * 17, 17.4, 0.1); front.add(u); });
  inkAt("USB 0   USB 1", 32, 2.4, 162.5, 6.2, { weight: "500" });
  inkAt("MODEL: BR-4200", 40, 3.2, 160, 37.6, { weight: "700", align: "right" });
  /* the power section: a darker plate, the rocker, the inlet, its lights, the fan */
  front.add(at(rbox(36, 40, 0.8, 0.8, paintedSteel(0x1e2c35, { rough: 0.5 })), 199, 22, 0.3));
  const sw = rocker("POWER"); sw.scale.set(0.42, 0.42, 0.42); at(sw, 190, 33, 0.7); front.add(sw);
  const ac = iecInlet("AC IN"); ac.scale.set(0.62, 0.62, 0.62); at(ac, 190, 14, 0.7); front.add(ac);
  ["PSU", "FAN"].forEach(function (k, i) { const l = led(COL.ledGreen, !!status.PWR, 0.9); l.userData.role = k; front.add(at(l, 202.5, 30 - i * 5.4, 0.4)); });
  const fan = fanGrille(14, 0xb9bdc2); at(fan, 211.5, 22, 0.7); front.add(fan);
  /* ---- the rear (not in the photo): vents, the ground stud, the labels ---- */
  const back = new THREE.Group(); back.name = "panel:Rear"; at(back, 0, Y0, -D / 2 - 0.02, 0, BACK, 0); g.add(back);
  [-150, -60, 30].forEach(function (x) { back.add(at(box(70, 26, 0.1, mat(0x0b0c0d, { rough: 1 })), x, 22, 0.02)); const p = perforated(72, 28, { pitch: 3.6, d: 2.5, shape: "hex", material: paintedSteel(0x34505d, { rough: 0.48 }) }); at(p, x, 22, 0.12); back.add(p); });
  const gnd = screw(3.2, 0xc8a24a); gnd.rotation.x = -Math.PI / 2; gnd.position.set(110, 30, 0.05); back.add(gnd);
  back.add(at(dark("⏚", 5, 5, { color: "#e8eef0", weight: "700" }), 110, 21, 0.05));
  const reg = label(["BUSINESS ROUTER · MODEL: BR-4200", "100-240V~ 50/60Hz 1.5A · CLASS A", "S/N: " + COVERED], { w: 60, h: 15, marks: true, bg: "#eceae4" }); at(reg, 172, 29, 0.05); back.add(reg);
  const mac = label(["MAC: ██:██:██:██:██:██"], { w: 60, h: 10, barcode: "br-mac", boldFirst: false, bg: "#f2f1ec" }); at(mac, 172, 11.6, 0.05); back.add(mac);
  /* ---- the cables, as photographed: orange fibre in both SFP slots, yellow and blue patch cables ---- */
  const plugged = o.plugged || [true, true, true, true, true, true, false, false], cols = o.cords || [0xf2c94c, 0xf2c94c, 0x3b7ddd, 0x3b7ddd, 0xf2c94c, 0xf2c94c, 0x3b7ddd, 0x3b7ddd];
  if (o.cables !== false) {
    plugged.forEach(function (on, i) {
      if (!on) return;
      const p = plugInto(jacks[i], rj45Plug({ standard: "T568B", boot: cols[i], jacket: cols[i] })), x = jx(i);
      cableFrom(g, p, [[x + 6, Y0 + 4, D / 2 + 60], [x + 30, 2.6, D / 2 + 120], [x + 120, 2.6, D / 2 + 240]], { straight: 22 });
    });
    cages.forEach(function (cg, k) {
      if (!sfpOn[k]) return;
      const m = plugInto(cg, sfpModule({ cable: sfpOn[k], text: "OM2 50/125 µm  ·  LC-LC DUPLEX" }), { y: 0, z: 0.4 });
      cableFrom(g, m, [[-40 + k * 6, Y0 + 6, D / 2 + 70], [-10 + k * 10, 1.6, D / 2 + 130], [60 + k * 16, 1.6, D / 2 + 230]], { straight: 16, r: 1.6 });
    });
    if (o.console) { const cp = plugInto(con, rj45Plug({ standard: "T568B", boot: 0x6aa7d8, jacket: 0x6aa7d8 })); cableFrom(g, cp, [[-30, Y0 + 10, D / 2 + 70], [-60, 3.05, D / 2 + 130], [-120, 3.05, D / 2 + 260]], { straight: 24 }); }
  }
  return named(g, "device:Business router", { type: "business-router", w: W + 42.6, h: H + Y0, d: D });
}

/* ------------------------------------------------------- the ceiling access point */
/* A ceiling access point, as photographed: the white disc (200 mm across, 34 deep) with its rounded edge, the
   slightly domed face with the light ring round its middle (the photo's centre mark, a brand's, is left off),
   on its metal mounting plate under the ceiling tile, the cable coming to it over the plate. Not in the photo,
   so drawn as such an access point usually is: on top, the recessed port bay with the PoE Ethernet port (ETH),
   the reset pinhole and the lugs that twist into the plate.
   Built face-down: its face points to -Y, its top (against the plate) at y = 0, as it hangs.
   o.ring: "on" (steady), "blink" or "off"; o.color: the ring's colour (blue: on the network, white: starting);
   o.mounted: with the plate and the piece of ceiling it hangs from; o.cable: its cable plugged in */
export function ceilingAP(o = {}) {
  const g = new THREE.Group(), R = 100, T = 34;
  const white = plastic(0xf1f1ee, { rough: 0.38 }), edgeW = plastic(0xe9e9e5, { rough: 0.42 });
  /* the body: a lathe of the disc's profile, top flat, the edge rounded, the face domed */
  const prof = [[0, 0], [R - 18, 0], [R - 6, -3], [R - 1, -10], [R, -17], [R - 2, -24], [R - 10, -30], [R - 30, -33], [R - 60, -34], [0, -34]].reverse().map(function (p) { return new THREE.Vector2(p[0], p[1]); });   /* from the face's middle round to the top: the order that makes its surfaces face out */
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), white); g.add(body);
  /* the face's middle: a slightly raised disc, the light ring round it */
  g.add(at(cyl(30, 1.2, edgeW, 64), 0, -T - 0.4, 0));
  const ringOn = (o.ring || "on") !== "off", rc = o.color || COL.ledBlue;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(31, 1.1, 10, 96), ringOn ? new THREE.MeshStandardMaterial({ color: 0x000000, emissive: rc, emissiveIntensity: 0.9, roughness: 0.3 }) : mat(0xd8d8d4, { rough: 0.4 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = -T - 0.3; ring.userData = { kind: "led", role: "ring", color: rc, on: ringOn, blink: o.ring === "blink" }; g.add(ring);
  /* the port bay on top (not in the photo): a recess with the Ethernet port, the reset pinhole, the lugs */
  const top = new THREE.Group(); top.name = "panel:Top"; at(top, 0, 0.05, 0, -Math.PI / 2, 0, 0); g.add(top);   /* its +Z points up */
  top.add(at(rbox(46, 26, 0.6, 2, mat(0xd2d2ce, { rough: 0.6 })), 0, 0, -0.2));
  const eth = rj45Jack({ name: "ETH", leds: false }); eth.rotation.z = Math.PI / 2; at(eth, -8, 0, -2.4); top.add(eth);
  top.add(at(dark("ETH (PoE IN)", 20, 2.6, { weight: "700" }), 8, 7, 0.1));
  const rst = pinhole("RESET"); at(rst, 12, -4, 0.05); top.add(rst);
  top.add(at(dark("RESET", 10, 2.4, { weight: "600" }), 12, -9.6, 0.1));
  [0, 1, 2, 3].forEach(function (k) { const a = k * Math.PI / 2 + Math.PI / 4; top.add(at(rbox(14, 6, 4, 1, edgeW), Math.cos(a) * 62, Math.sin(a) * 62, 2, 0, 0, a + Math.PI / 2)); });
  const lab = label(["CEILING ACCESS POINT", "802.11ac Wave 2 · 802.3af PoE", "MAC: ██:██:██:██:██:██", "S/N: " + COVERED], { w: 44, h: 18, bg: "#f4f4f0" }); at(lab, 0, -40, 0.1); top.add(lab);
  named(top.children[1], "port:ETH", { type: "rj45" });
  /* the mounting plate and the ceiling, as photographed */
  if (o.mounted !== false) {
    /* the mounting plate, as photographed: a flat plate under the tile, its straight edge showing past the disc at the back
       and left, a notch at the right where the cable comes in; the bar across the tile's back holds it up */
    const plate = paintedSteel(0xd3d5d7, { rough: 0.38 }), ps = new THREE.Shape();   /* light painted steel, as in the photo */
    ps.moveTo(-118, -62); ps.lineTo(96, -62); ps.lineTo(112, -40); ps.lineTo(112, -14); ps.lineTo(100, -14); ps.lineTo(100, 4); ps.lineTo(112, 4); ps.lineTo(112, 52); ps.lineTo(-118, 52); ps.closePath();
    const pg = new THREE.Mesh(new THREE.ExtrudeGeometry(ps, { depth: 2, bevelEnabled: false }), plate); pg.rotation.x = Math.PI / 2; pg.position.y = 2.4; g.add(pg);
    g.add(at(box(150, 1.6, 26, plate), 0, 18.2, 0));                                    /* the bar across the tile's back */
    const tileM = mat(0xeeeeea, { rough: 0.95 }), grid = mat(0xf2f2ef, { metal: 0.2, rough: 0.5 });
    g.add(at(box(600, 15, 600, tileM), 0, 2.4 + 7.5, 0));
    [[-300, 0, 24, 600], [300, 0, 24, 600], [0, -300, 600, 24], [0, 300, 600, 24]].forEach(function (b) { g.add(at(box(b[2], 3, b[3], grid), b[0], 1, b[1])); });
    if (o.cable !== false) {   /* its cable, as photographed: down through the tile at the right, along under it, in at the plate's notch */
      plugInto(eth, rj45Plug({ standard: "T568B", boot: 0xf0f0ec, jacket: 0xf0f0ec }));
      g.add(cable([[150, 17, -60], [152, 2, -48], [148, -2.4, -30], [126, -3.2, -12], [104, -3.0, -5], [90, -1.2, -5]], 2.6, 0xeeeeea, { seg: 80 }));
      g.add(at(rbox(12, 6.6, 7, 1.4, plastic(0xe6e6e2, { rough: 0.4 })), 98, -3.4, -5));   /* the cable's boot into the notch */
    }
  }
  return named(g, "device:Ceiling access point", { type: "ceiling-ap", w: 2 * R, h: T, d: 2 * R });
}
