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
import { tubeVar, jacketMaterial } from "./cable-kit.js";
import { perforated, printLines, label, plastic, paintedSteel, brushed, rubber, ceilingTileTex, paintedConcreteTex } from "./surface.js";
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
    const tileFace = new THREE.MeshStandardMaterial({ map: ceilingTileTex(), roughness: 0.96 });   /* the same fissured tile as the cameras' ceiling */
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(600, 15, 600), [tileM, tileM, tileM, tileFace, tileM, tileM]), 0, 2.4 + 7.5, 0));
    [[-300, 0, 24, 600], [300, 0, 24, 600], [0, -300, 600, 24], [0, 300, 600, 24]].forEach(function (b) { g.add(at(box(b[2], 3, b[3], grid), b[0], 1, b[1])); });
    if (o.cable !== false) {   /* its cable, as photographed: down through the tile at the right, along under it, in at the plate's notch */
      plugInto(eth, rj45Plug({ standard: "T568B", boot: 0xf0f0ec, jacket: 0xf0f0ec }));
      g.add(lead([[150, 17, -60], [152, 2, -48], [148, -2.4, -30], [126, -3.2, -12], [104, -3.0, -5], [90, -1.2, -5]], 2.6, 0xeeeeea, "CAT6 CMP PLENUM  ·  23AWG 4PR  ·  TIA-568.2  ·  UL VERIFIED"));   /* plenum-rated, printed, as cable above a ceiling is */
      g.add(at(rbox(12, 6.6, 7, 1.4, plastic(0xe6e6e2, { rough: 0.4 })), 98, -3.4, -5));   /* the cable's boot into the notch */
    }
  }
  return named(g, "device:Ceiling access point", { type: "ceiling-ap", w: 2 * R, h: T, d: 2 * R });
}

/* ------------------------------------------------------- the dome cameras */
/* From the owner's photographs of 26 October 2026, "to real world detail": a dome camera under a suspended ceiling's tile, and the
   same kind of camera on a junction box on a painted concrete wall. Both: a mounting base with the cover shell clipped onto it (the
   seam between them), three tamper-proof screws in the trim ring, the smoked bubble, inside it the black liner and the eyeball on its
   gimbal; on the eyeball the lens (its hood, bezel and coated glass), twelve infrared lights each in its reflector cup, the light
   sensor above the lens, the microphone hole below; the second photo's small blue status light on the shoulder. Not in either
   photo, so drawn as such a camera comes: its pigtail, ending in a waterproof RJ45 coupler (LAN, PoE in) with its threaded sleeve,
   and a capped DC lead, never used (the camera's power comes over its network cable). The second photo's brand mark is left off;
   the tag's MAC and serial are covered. Real millimetres.
   The body is built face-down: its base at y = 0, hanging to -Y. o.toward: +1 tilts the eyeball toward +Z, -1 toward -Z;
   o.status: "on", "blink" or "off" (blue: on the network); o.ledAt: where round the housing the status light sits */
function domeBody(o) {
  const g = new THREE.Group(), R = 62, toward = o.toward || 1;
  const white = plastic(0xf3f3f0, { rough: 0.34 }), baseW = plastic(0xe9e9e5, { rough: 0.42 }), black = plastic(0x121315, { rough: 0.35 }), matt = mat(0x0d0e10, { rough: 0.9 });
  const V2 = function (x, y) { return new THREE.Vector2(x, y); };
  /* the mounting base, a shade greyer, against the ceiling or the box; the cover shell clipped onto it, the seam between */
  g.add(new THREE.Mesh(new THREE.LatheGeometry([V2(0, -4), V2(R - 0.6, -4), V2(R, -3.4), V2(R, -0.6), V2(R - 0.8, 0), V2(0, 0)], 96), baseW));
  g.add(at(new THREE.Mesh(new THREE.TorusGeometry(R - 0.3, 0.45, 8, 96), mat(0x55575b, { rough: 0.8 })), 0, -4.2, 0, Math.PI / 2));
  const prof = [[0, -4.4], [R - 0.4, -4.4], [R, -5.4], [R + 0.3, -9], [R, -15], [R - 2, -21], [R - 7, -25], [50, -27], [48, -28]].reverse().map(function (p) { return V2(p[0], p[1]); });
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 96), white));
  g.add(at(new THREE.Mesh(new THREE.TorusGeometry(47.6, 1.7, 12, 96), plastic(0xe8e8e4, { rough: 0.4 })), 0, -28, 0, Math.PI / 2));   /* the trim ring's lip */
  /* three tamper-proof screws (pin-in-star heads) in their recesses on the trim ring's underside */
  for (let k = 0; k < 3; k++) {
    const a = k * 2 * Math.PI / 3 + Math.PI / 6, x = Math.cos(a) * 55.5, z = Math.sin(a) * 55.5, n = new THREE.Vector3(Math.cos(a) * 0.55, -0.83, Math.sin(a) * 0.55).normalize();
    const sc = new THREE.Group(); sc.position.set(x, -23.4, z); sc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); g.add(sc);
    sc.add(at(new THREE.Mesh(new THREE.CircleGeometry(3.1, 24), mat(0x2a2b2e, { rough: 0.8 })), 0, 0, 0.05));
    sc.add(at(cyl(2.3, 0.8, mat(0x9ea1a6, { metal: 0.8, rough: 0.3 }), 20), 0, 0, 0.2, Math.PI / 2));
    for (let j = 0; j < 3; j++) sc.add(at(box(3.2, 0.5, 0.3, mat(0x2a2b2e)), 0, 0, 0.65, 0, 0, j * Math.PI / 3));
    sc.add(at(cyl(0.45, 0.6, mat(0x9ea1a6, { metal: 0.8, rough: 0.3 }), 10), 0, 0, 0.7, Math.PI / 2));
  }
  /* inside the bubble: the black liner (a bowl with a window the eyeball looks out of) */
  const liner = new THREE.Mesh(new THREE.SphereGeometry(44, 64, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2 * 0.58), (function () { const m = matt.clone(); m.side = THREE.DoubleSide; return m; })());
  liner.position.y = -28; g.add(liner);
  g.add(at(new THREE.Mesh(new THREE.RingGeometry(30, 47, 64), matt), 0, -27.6, 0, Math.PI / 2));
  /* the eyeball on its gimbal: two grey pivot hubs either side */
  const ballY = -40, ball = new THREE.Mesh(new THREE.SphereGeometry(32, 64, 40), black); ball.position.y = ballY; g.add(ball);
  [-1, 1].forEach(function (sd) { g.add(at(cyl(7.5, 4, plastic(0x3a3c40, { rough: 0.5 }), 24), sd * 32.5, ballY, 0, 0, 0, Math.PI / 2)); g.add(at(cyl(2.4, 4.6, mat(0x8d9095, { metal: 0.7, rough: 0.35 }), 12), sd * 33.2, ballY, 0, 0, 0, Math.PI / 2)); });
  /* the lens, tilted down and out from the eyeball's middle */
  const tilt = o.tilt == null ? 0.62 : o.tilt, dir = new THREE.Vector3(0, -Math.cos(tilt), toward * Math.sin(tilt));
  const lens = new THREE.Group(); lens.position.set(0, ballY, 0); lens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.add(lens);
  const flat = function (r, m) { return new THREE.Mesh(new THREE.CircleGeometry(r, 48), m); };
  lens.add(at(cyl(13, 6, plastic(0x0b0c0e, { rough: 0.22 }), 48), 0, 30.5, 0));                                          /* the hood */
  lens.add(at(new THREE.Mesh(new THREE.TorusGeometry(11.4, 0.9, 10, 48), mat(0x2b2d31, { metal: 0.6, rough: 0.3 })), 0, 33.6, 0, Math.PI / 2));
  lens.add(at(flat(10.6, mat(0x15161a, { rough: 0.6 })), 0, 33.3, 0, -Math.PI / 2));
  lens.add(at(new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.7, 10, 48), mat(0x3c3f45, { metal: 0.8, rough: 0.25 })), 0, 33.4, 0, Math.PI / 2));   /* the bezel */
  lens.add(at(flat(7.8, new THREE.MeshPhysicalMaterial({ color: 0x0c1222, metalness: 0.4, roughness: 0.03, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [250, 600], envMapIntensity: 2.4 })), 0, 33.42, 0, -Math.PI / 2));
  lens.add(at(new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.5, 8, 36), mat(0x1c1f25, { metal: 0.7, rough: 0.2 })), 0, 33.5, 0, Math.PI / 2));
  lens.add(at(flat(4.2, new THREE.MeshPhysicalMaterial({ color: 0x1b2a4a, metalness: 0.8, roughness: 0.02, clearcoat: 1, iridescence: 0.8, iridescenceIOR: 1.4, envMapIntensity: 3 })), 0, 33.55, 0, -Math.PI / 2));
  /* a point on the eyeball, p radians from the lens's axis, a radians round it, facing out */
  const onBall = function (p, a, obj, lift) { const n = new THREE.Vector3(Math.sin(p) * Math.cos(a), Math.cos(p), Math.sin(p) * Math.sin(a)); obj.position.copy(n.clone().multiplyScalar(32 + (lift || 0))); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); lens.add(obj); return obj; };
  const irLens = new THREE.MeshPhysicalMaterial({ color: 0x3a1214, roughness: 0.08, clearcoat: 1, metalness: 0.05 }), cup = mat(0xb9bcc1, { metal: 0.9, rough: 0.22 });
  for (let k = 0; k < 12; k++) {   /* the infrared lights: a reflector cup, the dark-red lens in it */
    const ir = new THREE.Group(); ir.add(new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.45, 8, 20), cup));
    const d = new THREE.Mesh(new THREE.SphereGeometry(1.8, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), irLens); d.rotation.x = Math.PI / 2; ir.add(d);
    onBall(0.6, k * Math.PI / 6 + Math.PI / 12, ir, 0.05);
  }
  const sensor = new THREE.Group(); sensor.add(new THREE.Mesh(new THREE.CircleGeometry(1.7, 20), new THREE.MeshPhysicalMaterial({ color: 0x5a2a1c, roughness: 0.15, clearcoat: 1 }))); onBall(0.95, toward > 0 ? -Math.PI / 2 : Math.PI / 2, sensor, 0.05);   /* the light sensor, above the lens */
  const mic = new THREE.Group(); mic.add(new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), mat(0x000000))); onBall(0.95, toward > 0 ? Math.PI / 2 : -Math.PI / 2, mic, 0.05);   /* the microphone hole, below */
  /* the bubble: clear polycarbonate, lightly smoked, clear enough to see the eyeball through, the room's lights in it */
  const bub = new THREE.Mesh(new THREE.SphereGeometry(46.2, 72, 28, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x4a4e56, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 }));
  bub.position.y = -28; g.add(bub);
  /* the status light, on the shoulder beside the bubble, as in the second photo: blue on the network */
  const st = o.status || "on", sl = led(COL.ledBlue, st !== "off", 1.6), la = o.ledAt == null ? Math.PI / 4 : o.ledAt, nrm = new THREE.Vector3(Math.cos(la) * 0.62, -0.78, Math.sin(la) * 0.62).normalize();
  sl.userData.role = "status"; sl.userData.blink = st === "blink";
  sl.position.set(Math.cos(la) * (R - 4.2), -22.6, Math.sin(la) * (R - 4.2)); sl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm); g.add(sl);
  return g;
}
/* the end of the camera's pigtail: a waterproof RJ45 coupler, its opening along +Z, the threads its sleeve screws onto; a tag with the
   MAC (covered). Returns the group and its jack ("port:LAN"). The network cable's plug goes in; its sleeve waits on the cable behind */
function pigtailEnd() {
  const cp = new THREE.Group(), blk = plastic(0x18191c, { rough: 0.45 }), thr = mat(0x232427, { rough: 0.55 });
  cp.add(at(cyl(9.5, 30, blk, 32), 0, 0, -15, Math.PI / 2));
  for (let k = 0; k < 7; k++) cp.add(at(new THREE.Mesh(new THREE.TorusGeometry(10.1, 0.55, 6, 32), thr), 0, 0, -1.6 - k * 1.6));   /* the thread */
  cp.add(at(cyl(10.6, 6, rubber(0x2a2c2f), 6), 0, 0, -22, Math.PI / 2));                                                           /* the hex grip */
  const bt = relief(16, 6.2, 3.3, 0x18191c, 5); bt.rotation.x = -Math.PI / 2; bt.position.z = -25; cp.add(bt);                    /* the ribbed boot where the pigtail goes in */
  const jack = rj45Jack({ name: "LAN", leds: false }); jack.scale.set(0.95, 0.95, 1); at(jack, 0, -0.9, -2.2); cp.add(jack);
  cp.userData.exitZ = -41;
  const tag = label(["IP DOME CAMERA · LAN (PoE IN)", "802.3af · 10/100", "MAC: " + COVERED, "S/N: " + COVERED], { w: 32, h: 13, bg: "#f4f4f0" }); at(tag, 0, 10.3, -24, -Math.PI / 2, 0, 0); cp.add(tag);
  return { group: cp, jack: jack };
}
/* the network cable's waterproof sleeve, slid back along it behind the plug (screwed onto the coupler's thread once tested): a child of
   the plug, on its straight run out */
function sleeveOn(plug) {
  const s = new THREE.Group(), blk = plastic(0x18191c, { rough: 0.45 });
  s.add(at(cyl(11.2, 24, blk, 32), 0, 0, 0, Math.PI / 2));
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; s.add(at(box(1.4, 1.2, 20, blk), Math.cos(a) * 11.4, Math.sin(a) * 11.4, 0, 0, 0, a)); }   /* the grip ribs */
  s.add(at(new THREE.Mesh(new THREE.RingGeometry(3.4, 10.6, 32), mat(0x0a0a0b)), 0, 0, 12.05));
  s.position.z = -46; plug.add(s); return s;
}
/* the DC lead's end: a female barrel jack (2.1 mm), knurled where fingers grip it, its rubber cap on, a ribbed strain relief where the
   lead goes in; along +Z, the lead off -Z */
function dcLead() {
  const d = new THREE.Group(), blk = plastic(0x18191c, { rough: 0.5 });
  d.add(at(cyl(4.4, 15, blk, 28), 0, 0, 0, Math.PI / 2));
  for (let k = 0; k < 9; k++) d.add(at(new THREE.Mesh(new THREE.TorusGeometry(4.45, 0.28, 6, 28), mat(0x101113, { rough: 0.6 })), 0, 0, -5.5 + k * 1.1));   /* the knurl */
  d.add(at(cyl(5.0, 10, rubber(0x2b2d30), 28), 0, 0, 12, Math.PI / 2));                                                            /* the cap */
  d.add(at(new THREE.Mesh(new THREE.TorusGeometry(5.0, 0.6, 8, 28), rubber(0x24262a)), 0, 0, 17));
  const rl = relief(12, 3.6, 1.9, 0x18191c, 4); rl.rotation.x = -Math.PI / 2; rl.position.z = -7.5; d.add(rl);
  d.userData.exitZ = -19.5; return d;
}
const V3 = function (p) { return p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2]); };
/* a lead with a printed jacket, as real cable is, along points (mm) */
function lead(pts, r, color, text) {
  const curve = new THREE.CatmullRomCurve3(pts.map(V3), false, "centripetal"), L = curve.getLength();
  const geo = tubeVar(curve, { n: Math.max(40, Math.ceil(L / 1.2)), m: 20, uvLength: 420, radius: function () { return [r, r]; } });
  const lum = new THREE.Color(color).getHSL({}).l;
  return new THREE.Mesh(geo, jacketMaterial(color, text, lum < 0.3 ? "rgba(235,235,235,0.55)" : "rgba(25,25,25,0.6)", { font: 16 }));
}
/* a ribbed strain relief, tapering from r0 to r1 along +Y over len: where a lead leaves a moulding, so it bends gently there */
function relief(len, r0, r1, color, ribs) {
  const p = [new THREE.Vector2(0, 0), new THREE.Vector2(r0, 0)];
  for (let i = 1; i <= ribs * 2; i++) { const t = i / (ribs * 2); p.push(new THREE.Vector2(r0 + (r1 - r0) * t + (i % 2 && i < ribs * 2 ? 0.45 : 0), t * len)); }
  p.push(new THREE.Vector2(0, len));
  return new THREE.Mesh(new THREE.LatheGeometry(p, 28), rubber(color));
}
/* a cable tie round a cable of radius r running along Z: the strap, its square head, the cut tail */
function zipTie(r) {
  const t = new THREE.Group(), m = plastic(0x161719, { rough: 0.5 });
  const band = new THREE.Mesh(new THREE.TorusGeometry(r + 0.55, 0.5, 6, 28), m); band.scale.z = 2.4; t.add(band);
  t.add(at(rbox(4, 3.2, 4.4, 0.6, m), r + 2.1, 0, 0));
  t.add(at(box(0.9, 4.5, 2.4, m), r + 3.6, 2.2, 0));
  return t;
}
/* the wrap-around ID flag a cable carries near each end (TIA-606): white, printed both sides; along the cable's Z */
function cableFlag(lines, r) {
  const f = new THREE.Group();
  f.add(at(cyl(r + 0.35, 9, plastic(0xf5f5f2, { rough: 0.5 }), 24), 0, 0, 0, Math.PI / 2));
  [1, -1].forEach(function (sd) { const l = label(lines, { w: 24, h: 10, bg: "#f7f7f4" }); at(l, sd * 0.15, r + 6.2, 0, 0, sd > 0 ? Math.PI / 2 : -Math.PI / 2, 0); f.add(l); });
  f.add(at(box(0.3, 10.4, 24.4, plastic(0xf5f5f2, { rough: 0.5 })), 0, r + 6.2, 0));
  return f;
}
/* a J-hook above the ceiling: the hanger wire from the slab above, the steel J the cables lie in (opening up, along X) */
function jHook() {
  const g = new THREE.Group(), st = paintedSteel(0xa4a8ad, { rough: 0.4 });
  const j = new THREE.Mesh(new THREE.TorusGeometry(22, 2.4, 8, 32, Math.PI), st); j.rotation.set(0, Math.PI / 2, Math.PI); g.add(j);
  g.add(at(box(2.4, 46, 8, st), 0, 23, -22));
  g.add(at(box(3, 6, 14, st), 0, 46, -22));
  g.add(at(cyl(1.1, 260, mat(0xb8bbbf, { metal: 0.85, rough: 0.3 }), 8), 0, 46 + 130, -22));
  g.add(at(new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.9, 6, 16), mat(0xb8bbbf, { metal: 0.85, rough: 0.3 })), 0, 50, -22, 0, Math.PI / 2, 0));
  return g;
}
/* a nail-in cable clip on a wall (the wall the plane z = 0), round a cable of radius r running along X at height y */
function cableClip(r) {
  const c = new THREE.Group(), w = plastic(0xf1f1ee, { rough: 0.45 });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(r + 1.1, 1.0, 8, 20, Math.PI), w);   /* its half-circle turned into the Y-Z plane, out from the wall */
  arch.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0))); arch.scale.z = 3; c.add(arch);
  c.add(at(box(6, 5, r + 3, w), 0, r + 3.6, (r + 3) / 2));
  c.add(at(cyl(1.7, 1.2, mat(0x9ea1a6, { metal: 0.8, rough: 0.35 }), 16), 0, r + 3.6, r + 3.4, Math.PI / 2));
  return c;
}

/* the ceiling dome, as photographed: under the middle tile of a suspended ceiling, the white T-bar grid between the tiles, a flat LED
   panel light in one tile and a smoke alarm on another, as in the photo. Above the tile (not in the photo): the steel backing plate the
   camera screws through, the pigtail up out of its middle, the coupler and the DC lead lying on the tile's back.
   o.cable: the network cable plugged into the coupler; o.status as for the body */
export function ceilingDome(o = {}) {
  const g = new THREE.Group(), TT = 15, T = 600;
  g.add(domeBody({ status: o.status, toward: 1 }));
  const face = new THREE.MeshStandardMaterial({ map: ceilingTileTex(), roughness: 0.96 }), backM = mat(0xd9d6cc, { rough: 0.98, grain: 0.2 }), grid = mat(0xf4f4f1, { metal: 0.25, rough: 0.45 });
  const tile = function (x, z) { const t = new THREE.Mesh(new THREE.BoxGeometry(T - 4, TT, T - 4), [backM, backM, backM, face, backM, backM]); t.position.set(x, TT / 2 + 1.5, z); g.add(t); };   /* the face is the box's underside (-Y) */
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (!(i === -1 && j === 1)) tile(i * T, j * T);
  /* the grid: each T-bar's white flange under the tile edges, its web up between them */
  for (let k = -1.5; k <= 1.5; k += 1) { g.add(at(box(24, 1.5, 3 * T + 24, grid), k * T, 0.75, 0)); g.add(at(box(3 * T + 24, 1.5, 24, grid), 0, 0.76, k * T)); g.add(at(box(1.2, 36, 3 * T, grid), k * T, 19.5, 0)); g.add(at(box(3 * T, 36, 1.2, grid), 0, 19.6, k * T)); }
  /* a flat LED panel in the front-left tile: its white frame, the lit diffuser */
  const pl = new THREE.Group(); at(pl, -T, 0, T); g.add(pl);
  pl.add(at(rbox(T - 6, 10, T - 6, 2, plastic(0xf6f6f3, { rough: 0.35 })), 0, 6, 0));
  pl.add(at(box(T - 40, 0.5, T - 40, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f6ff, emissiveIntensity: 0.85, roughness: 0.6 })), 0, 0.8, 0));
  /* a smoke alarm on the left tile, its vent slots and its small test light */
  const sm = new THREE.Group(); at(sm, -T + 40, 0, -60); g.add(sm);
  sm.add(new THREE.Mesh(new THREE.LatheGeometry([[0, -34], [30, -33], [44, -28], [52, -18], [54, -8], [55, 0], [0, 0]].map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 64), plastic(0xf2f2ef, { rough: 0.4 })));
  for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12; sm.add(at(box(2.2, 6, 9, mat(0x2a2b2e, { rough: 0.8 })), Math.cos(a) * 49, -14, Math.sin(a) * 49, 0, -a, 0)); }
  const tl = led(COL.ledRed, false, 1.4); at(tl, 14, -33.6, 8, Math.PI / 2, 0, 0); sm.add(tl);
  /* above the tile: the backing plate, its three screws, the pigtail up out of the middle */
  const top = TT + 1.5, steel = paintedSteel(0xc8cbce, { rough: 0.4 });
  g.add(at(rbox(150, 1.6, 150, 3, steel), 0, top + 0.8, 0));
  for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3 + Math.PI / 6; g.add(at(screw(3.4, 0xb4b7bb), Math.cos(a) * 52, top + 1.7, Math.sin(a) * 52, -Math.PI / 2, 0, 0)); }
  g.add(at(new THREE.Mesh(new THREE.CircleGeometry(11, 28), mat(0x0b0b0c)), 0, top + 1.65, 0, -Math.PI / 2));
  g.add(at(cyl(9, 4, rubber(0x2b2d30), 28), 0, top + 3.6, 0));                                                                      /* the grommet */
  /* the pigtail: one printed lead up through the grommet to its moulded Y-splitter, then the LAN branch to its coupler and the DC
     branch to its capped jack, each with a ribbed strain relief where it leaves a moulding */
  const blk = 0x1d1e21, P = pigtailEnd(); at(P.group, 160, top + 10.2, 4, 0, Math.PI / 2, 0); g.add(P.group);
  const gr = relief(10, 4.2, 3.1, 0x2b2d30, 3); gr.position.set(0, top + 3, 0); g.add(gr);
  g.add(lead([[0, top + 4, 0], [0, top + 9, 0], [12, top + 10, 5], [34, top + 10, 9], [50, top + 9.5, 10]], 3.0, blk, "IP CAMERA PIGTAIL  ·  LAN (PoE) + DC 12V  ·  26AWG  ·  UL2464"));
  g.add(at(rbox(24, 7.6, 11, 3, plastic(0x18191c, { rough: 0.45 })), 62, top + 9.5, 10.5));
  [[50, 10.5, -1], [74, 8, 1], [74, 13, 1]].forEach(function (q, k) { const r = relief(6, k ? 3.0 : 3.6, k ? 2.0 : 3.0, 0x18191c, 2); r.rotation.z = q[2] > 0 ? -Math.PI / 2 : Math.PI / 2; r.position.set(q[0], top + 9.5, q[1]); g.add(r); });
  g.add(lead([[79, top + 9.5, 8], [92, top + 10, 5], [110, top + 10.2, 4], [119.5, top + 10.2, 4]], 2.4, blk, "LAN  ·  PoE IN  ·  10/100"));
  const dc = dcLead(), da = Math.atan2(30, 37); at(dc, 104, top + 5, 50, 0, da, 0); g.add(dc);
  g.add(lead([[79, top + 9.5, 13], [84, top + 8, 21], [89, top + 5.6, 30], [104 - 19.5 * Math.sin(da), top + 5, 50 - 19.5 * Math.cos(da)]], 1.8, blk, "DC 12V IN  ·  2.1 mm"));
  /* the network cable: plenum-rated above a ceiling, its ID flag near the end, up into a J-hook on its hanger wire */
  const hook = jHook(); hook.position.set(300, top + 72, -70); g.add(hook);
  if (o.cable !== false) {
    const plug = plugInto(P.jack, rj45Plug({ standard: "T568B", boot: 0x2c55b8, jacket: 0x2c55b8 })); sleeveOn(plug);
    const fl = cableFlag(["CAM-01", "WAITING AREA"], 3.05); fl.position.z = -70; plug.add(fl);
    cableFrom(g, plug, [[262, top + 16, -10], [288, top + 40, -50], [300, top + 54, -70], [322, top + 56, -110], [350, top + 48, -260]], { straight: 72, text: "CAT6 CMP PLENUM  ·  23AWG 4PR  ·  TIA-568.2  ·  UL VERIFIED  ·  CAM-01" });
  }
  return named(g, "device:Ceiling dome camera", { type: "dome-camera", w: 124, h: 74, d: 124 });
}

/* the wall dome, as photographed: the camera on the front of a grey junction box screwed to a painted concrete wall, the conduit
   coming down into the box's top (held by a saddle clip), two cable glands in the box's bottom. Out of the left gland the camera's
   pigtail in a drip loop to its coupler, the network cable plugged in; out of the right gland the DC lead, capped and tied back. The
   conduit is the photo's: nothing of ours runs in it. The wall is the plane z = 0, the camera looking out (+Z) and down.
   o.cable, o.status as above */
export function wallDome(o = {}) {
  const g = new THREE.Group(), BW = 132, BD = 46, LD = 12, BY = 270;
  const wallM = new THREE.MeshStandardMaterial({ map: paintedConcreteTex(), roughness: 0.96 }), boxM = plastic(0xdcdddb, { rough: 0.45 }), lidM = plastic(0xe2e3e1, { rough: 0.42 }), pvc = plastic(0xebebe8, { rough: 0.38 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(700, 600, 20), [wallM, wallM, wallM, wallM, wallM, wallM]); wall.position.set(0, BY, -10); g.add(wall);
  wallM.map.repeat.set(0.7, 0.6);
  /* the box: its deep base, the lid on its front, the seam between, the lid's four captive screws in their bosses */
  g.add(at(rbox(BW, BW, BD, 5, boxM), 0, BY, BD / 2));
  g.add(at(rbox(BW + 1, BW + 1, LD, 5, lidM), 0, BY, BD + LD / 2 - 0.5));
  g.add(at(box(BW - 4, 0.8, 0.8, mat(0x6a6c70, { rough: 0.8 })), 0, BY + BW / 2 + 0.2, BD - 0.2));
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (sd) {
    const x = sd[0] * (BW / 2 - 10), y = BY + sd[1] * (BW / 2 - 10);
    g.add(at(new THREE.Mesh(new THREE.CircleGeometry(5.2, 24), mat(0x3a3c40, { rough: 0.8 })), x, y, BD + LD - 0.45));
    g.add(at(screw(3.6, 0xb4b7bb), x, y, BD + LD - 1.2));
  });
  g.add(at(new THREE.Mesh(new THREE.CircleGeometry(1.6, 16), mat(0x101012)), -BW / 2 + 22, BY - BW / 2 - 0.05, BD / 2, Math.PI / 2, 0, 0));   /* the drain hole */
  /* the conduit: its threaded adapter and lock nut into the box's top, a saddle clip screwed to the wall */
  const cx = 34, cz = 16;
  g.add(at(cyl(10, 320, pvc, 32), cx, BY + BW / 2 + 172, cz));
  g.add(at(cyl(12.6, 14, pvc, 32), cx, BY + BW / 2 + 10, cz));
  g.add(at(cyl(14.5, 4, plastic(0xd2d3d1, { rough: 0.5 }), 6), cx, BY + BW / 2 + 2, cz));
  const sad = new THREE.Group(); at(sad, cx, BY + BW / 2 + 140, 0); g.add(sad);
  /* the saddle: a half-round strap over the conduit (its arch out from the wall), a flat foot each side screwed to the wall */
  const arch = new THREE.Mesh(new THREE.TorusGeometry(11.4, 1.3, 8, 24, Math.PI), paintedSteel(0xc9ccd0, { rough: 0.35 })); arch.rotation.x = Math.PI / 2; arch.position.set(0, 0, cz); sad.add(arch);
  [-1, 1].forEach(function (sd) { sad.add(at(box(11, 13, 1.4, paintedSteel(0xc9ccd0, { rough: 0.35 })), sd * 17, 0, cz - 11.4 + 0.7)); sad.add(at(screw(2.6, 0xb4b7bb), sd * 18, 0, cz - 11.4 + 1.6)); });
  /* the camera on the lid, a white adapter ring between */
  g.add(at(cyl(64, 5, plastic(0xeeeeeb, { rough: 0.4 }), 96), 0, BY, BD + LD + 2.5, Math.PI / 2));
  const body = domeBody({ status: o.status, toward: -1, ledAt: -Math.PI / 4 }); body.rotation.x = -Math.PI / 2; body.position.set(0, BY, BD + LD + 5); g.add(body);
  /* the glands in the box's bottom: hex body, domed cap nut */
  const gl = function (x) { const y = BY - BW / 2; g.add(at(cyl(9.8, 6, plastic(0x9a9ea3, { rough: 0.5 }), 6), x, y - 3, BD / 2)); g.add(at(new THREE.Mesh(new THREE.SphereGeometry(8.6, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), plastic(0x8e9297, { rough: 0.45 })), x, y - 6, BD / 2)); };
  gl(-32); gl(18);
  /* the camera's leads out of the glands: the LAN pigtail down to its coupler (hanging open end down, so rain runs off the cable
     below it), the spare DC lead brought across and tied back to the pigtail, its jack capped */
  const W = 0xeceae6, P = pigtailEnd(); at(P.group, -30, BY - 150, BD / 2 + 8, Math.PI / 2, 0, 0); g.add(P.group);
  g.add(lead([[-32, BY - 72, BD / 2], [-32, BY - 86, BD / 2 + 1], [-31, BY - 100, BD / 2 + 6], [-30, BY - 108.6, BD / 2 + 8]], 2.4, W, "LAN  ·  PoE IN  ·  10/100"));
  const dc = dcLead(); at(dc, -17, BY - 128, BD / 2 + 9, Math.PI / 2, 0, 0); g.add(dc);
  g.add(lead([[18, BY - 72, BD / 2], [16, BY - 86, BD / 2 + 2], [2, BY - 96, BD / 2 + 6], [-12, BY - 100, BD / 2 + 8.5], [-17, BY - 106, BD / 2 + 9], [-17, BY - 108.6, BD / 2 + 9]], 1.8, W, "DC 12V IN  ·  2.1 mm"));
  const zt = zipTie(5.2); zt.rotation.x = Math.PI / 2; zt.position.set(-24, BY - 100, BD / 2 + 8); g.add(zt);
  /* the network cable: riser-rated, its ID flag near the end, down and along the wall in nail-in clips */
  if (o.cable !== false) {
    const plug = plugInto(P.jack, rj45Plug({ standard: "T568B", boot: 0x2c55b8, jacket: 0x2c55b8 })); sleeveOn(plug);
    const fl = cableFlag(["CAM-02", "BACK DOOR"], 3.05); fl.position.z = -70; plug.add(fl);
    cableFrom(g, plug, [[-28, BY - 246, BD / 2 + 4], [-8, BY - 258, 10], [40, BY - 260, 4.4], [420, BY - 260, 4.4]], { straight: 72, text: "CAT6 CMR RISER  ·  23AWG 4PR  ·  TIA-568.2  ·  UL VERIFIED  ·  CAM-02" });
    [70, 190, 310].forEach(function (x) { const c = cableClip(3.05); c.position.set(x, BY - 260, 0); g.add(c); });
  }
  return named(g, "device:Wall dome camera", { type: "dome-camera", w: 700, h: 600, d: BD + LD + 80 });
}
