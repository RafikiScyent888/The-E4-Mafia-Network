/* =====================================================================
   Home network gear, from the owner's photographs (10 October 2026):
   cable modem, fiber ONT, home wireless router, 5-port unmanaged switch,
   mesh Wi-Fi node. Real millimetres; front faces +Z; sits on y = 0.
   Brand names and logos are left off, as ruled.
   ===================================================================== */
import * as THREE from "three";
import { COL, mat, rbox, box, cyl, at, named, text, sticker, COVERED, led, slots, rj45Jack, dcJack, fFemale, scApcAdapter, pinhole, button } from "./parts.js";

const BACK = Math.PI;   // rotate a +Z-facing part to face -Z

/* a column of LEDs with their names printed beside them */
function ledColumn(items, x, y0, step, labelX, align, w) {
  const g = new THREE.Group();
  items.forEach(function (it, i) {
    const y = y0 - i * step, l = led(it[1], it[2], 1.4);
    l.userData.role = it[0]; g.add(at(l, x, y, 0.15));
    g.add(at(text(it[0], w || 20, 3.4, { align: align || "right" }), labelX, y, 0.1));
  });
  return g;
}

/* ------------------------------------------------------------ modem */
/* A DOCSIS cable modem standing on its edge, as in the photo: the LEDs
   down the narrow front, and on the back CABLE IN, ETHERNET, RESET and
   POWER. */
export function cableModem() {
  const g = new THREE.Group(), W = 48, H = 168, D = 140;
  g.add(at(rbox(W, H, D, 5, mat(COL.black, { rough: 0.7 })), 0, H / 2 + 6, 0));
  g.add(at(rbox(W + 8, 7, D + 6, 3, mat(COL.charcoal, { rough: 0.8 })), 0, 3.5, 0));       // its stand
  const front = new THREE.Group(); at(front, 0, 0, D / 2);
  front.add(ledColumn([["POWER", COL.ledGreen, true], ["DS", COL.ledGreen, true], ["US", COL.ledGreen, true], ["ONLINE", COL.ledBlue, true], ["LINK/ACT", COL.ledGreen, true]], 12, 150, 11, -3, "right", 22));
  front.add(at(text("CABLE MODEM", 40, 4.2, { weight: "700" }), 0, 26, 0.1));
  front.add(at(text("DOCSIS 3.0", 30, 3, { weight: "500", color: "#cfd2d6" }), 0, 20, 0.1));
  g.add(front);
  const back = new THREE.Group(); at(back, 0, 0, -D / 2, 0, BACK);
  back.add(at(sticker(["CABLE MODEM · DOCSIS 3.0", "MODEL: CM-3000", "S/N: " + COVERED, "HFC MAC: " + COVERED, "12V ⎓ 1.5A"], 40, 26), 0, 150, 0));
  back.add(at(fFemale("CABLE IN"), 0, 118, 0)); back.add(at(text("CABLE IN", 26, 3.2), 0, 108, 0.1));
  back.add(at(rj45Jack({ name: "ETHERNET", insert: COL.wanYellow, on: [true, true] }), 0, 92, 0)); back.add(at(text("ETHERNET", 26, 3.2), 0, 82, 0.1));
  back.add(at(pinhole("RESET"), 0, 74, 0)); back.add(at(text("RESET", 20, 3), 0, 69, 0.1));
  back.add(at(dcJack("POWER"), 0, 58, 0)); back.add(at(text("POWER\n12V ⎓ 1.5A", 26, 6.4), 0, 49, 0.1));
  g.add(back);
  [-1, 1].forEach(function (s) {
    const v = slots(16, 2, 30, 4.2, true); at(v, s * (W / 2 + 0.05), 128, -30, 0, s * Math.PI / 2); g.add(v);
    const v2 = slots(16, 2, 30, 4.2, true); at(v2, s * (W / 2 + 0.05), 60, -30, 0, s * Math.PI / 2); g.add(v2);
  });
  return named(g, "device:Cable modem", { type: "modem", w: W, h: H + 6, d: D + 6 });
}

/* -------------------------------------------------------------- ONT */
/* The fiber optical network terminal, wall-mounted, from the photo:
   LEDs POWER, PON, ALARM, LINK/ACT, ETHERNET; on the underside the
   green SC/APC FIBER PORT, ETHERNET and 12V DC. */
export function fiberOnt() {
  const g = new THREE.Group(), W = 112, H = 150, D = 34;
  g.add(at(rbox(W, H, D, 4, mat(COL.black, { rough: 0.7 })), 0, H / 2, 0));
  const front = new THREE.Group(); at(front, 0, 0, D / 2);
  front.add(at(text("FIBER ONT", 70, 9, { weight: "800", align: "left" }), -14, 132, 0.1));
  front.add(at(text("HOME TERMINAL", 70, 4.6, { weight: "600", align: "left", color: "#d6d9dd" }), -14, 124, 0.1));
  front.add(ledColumn([["POWER", COL.ledGreen, true], ["PON", COL.ledGreen, true], ["ALARM", COL.ledRed, false], ["LINK/ACT", COL.ledGreen, true], ["ETHERNET", COL.ledGreen, true]], 40, 104, 12, 22, "right", 26));
  front.add(at(text("FIBER PORT", 30, 3.6), -32, 9, 0.1));
  front.add(at(text("ETHERNET", 30, 3.6), 0, 9, 0.1));
  front.add(at(text("12V DC", 30, 3.6), 32, 9, 0.1));
  g.add(front);
  const under = new THREE.Group(); at(under, 0, 0, 2, Math.PI / 2, 0, 0);   // parts face down
  under.add(at(scApcAdapter("FIBER"), -32, 0, 0));
  under.add(at(rj45Jack({ name: "ETHERNET", on: [true, true] }), 0, 0, 0));
  under.add(at(dcJack("12V DC"), 32, 0, 0));
  g.add(under);
  /* side vents: kept inside the 34 mm depth (the first preview let them overhang) */
  const v = slots(5, 2.4, 9, 4.6, true); at(v, W / 2 + 0.05, 80, 0, 0, Math.PI / 2); g.add(v);
  const v2 = slots(5, 2.4, 9, 4.6, true); at(v2, W / 2 + 0.05, 64, 0, 0, Math.PI / 2); g.add(v2);
  const bc = sticker(["S/N " + COVERED, "││┃│┃┃││┃││┃"], 24, 10); at(bc, W / 2 + 0.05, 30, 0, 0, Math.PI / 2); g.add(bc);
  return named(g, "device:Fiber ONT", { type: "ont", w: W, h: H, d: D });
}

/* ----------------------------------------------------------- router */
/* The home wireless router from the photo: four antennas at the back;
   on the back INTERNET (yellow), LAN 1-4, RESET, WPS, POWER, ON/OFF;
   status LEDs along the top front edge. */
export function homeRouter() {
  const g = new THREE.Group(), W = 232, H = 38, D = 152;
  g.add(at(rbox(W, H, D, 6, mat(COL.black, { rough: 0.55 })), 0, H / 2 + 4, 0));
  [[-90, 50], [90, 50], [-90, -50], [90, -50]].forEach(function (p) { g.add(at(cyl(7, 4, mat(COL.charcoal, { rough: 0.9 })), p[0], 2, p[1])); });
  const top = new THREE.Group(); at(top, 0, H + 4.05, 0, -Math.PI / 2, 0, 0);
  [["POWER", true], ["INTERNET", true], ["2.4G", true], ["5G", true], ["LAN", true], ["WPS", false]].forEach(function (it, i) {
    const x = -75 + i * 30, l = led(COL.ledGreen, it[1], 1.5); l.userData.role = it[0];
    top.add(at(l, x, -62, 0.1)); top.add(at(text(it[0], 24, 4), x, -68, 0.1));
  });
  top.add(at(text("WIRELESS ROUTER · Wi-Fi 6", 90, 5, { weight: "600", color: "#b9bec5" }), 0, 40, 0.1));
  g.add(top);
  const back = new THREE.Group(); at(back, 0, 0, -D / 2, 0, BACK);
  const yP = H / 2 + 6, yL = 8.5;
  /* seen from behind, left to right: INTERNET, LAN 1-4, RESET, WPS, POWER, ON/OFF */
  const lay = [["INTERNET", -80, "rj45", COL.wanYellow], ["LAN 1", -60, "rj45"], ["LAN 2", -42, "rj45"], ["LAN 3", -24, "rj45"], ["LAN 4", -6, "rj45"],
    ["RESET", 14, "pin"], ["WPS", 30, "btn"], ["POWER", 52, "dc"], ["ON/OFF", 72, "btn"]];
  lay.forEach(function (p) {
    const part = p[2] === "rj45" ? rj45Jack({ name: p[0], insert: p[3] || 0x46494f, on: [p[0] === "INTERNET" || p[0] === "LAN 1", p[0] === "INTERNET"] })
      : p[2] === "pin" ? pinhole(p[0]) : p[2] === "dc" ? dcJack(p[0]) : button(p[0], 7, 5);
    back.add(at(part, p[1], yP + 2, 0)); back.add(at(text(p[0], 18, 3.2), p[1], yL, 0.1));
  });
  g.add(back);
  /* the antennas: hinged blades, two at the back corners, two at the sides */
  const am = mat(COL.black, { rough: 0.5 });
  function antenna(x, z, tiltZ, tiltX) {
    const a = new THREE.Group();
    a.add(cyl(6, 12, mat(COL.charcoal, { rough: 0.7 })).rotateZ(Math.PI / 2));
    const blade = rbox(15, 175, 8, 3.5, am); blade.position.y = 92; a.add(blade);
    a.position.set(x, H + 2, z); a.rotation.set(tiltX || 0, 0, tiltZ || 0);
    return named(a, "antenna", {});
  }
  g.add(antenna(-104, -D / 2 + 6, 0.06)); g.add(antenna(104, -D / 2 + 6, -0.06));
  g.add(antenna(-W / 2 - 4, -40, 0.18, 0)); g.add(antenna(W / 2 + 4, -40, -0.18, 0));
  const under = sticker(["WIRELESS ROUTER · Wi-Fi 6", "MODEL: HR-AX3000", "DEFAULT SSID: " + COVERED, "Wi-Fi PASSWORD: " + COVERED, "ADMIN: http://192.168.1.1", "MAC: " + COVERED, "12V ⎓ 2A"], 70, 36);
  at(under, 0, 3.9, 0, Math.PI / 2, 0, 0); g.add(under);
  return named(g, "device:Home router", { type: "router", w: W, h: H + 4, d: D });
}

/* ----------------------------------------------------------- switch */
/* The 5-port unmanaged gigabit switch from the photo: a metal case,
   POWER LED and ports 1-5 with link LEDs at the front, DC in behind. */
export function unmanagedSwitch() {
  const g = new THREE.Group(), W = 106, H = 27, D = 98;
  g.add(at(rbox(W, H, D, 2.5, mat(0x2c2f34, { metal: 0.55, rough: 0.42 })), 0, H / 2 + 2, 0));
  [[-42, 38], [42, 38], [-42, -38], [42, -38]].forEach(function (p) { g.add(at(cyl(5, 2, mat(COL.black, { rough: 0.95 })), p[0], 1, p[1])); });
  const front = new THREE.Group(); at(front, 0, 0, D / 2);
  const p = led(COL.ledGreen, true, 1.3); p.userData.role = "POWER"; front.add(at(p, -45, 20, 0.15)); front.add(at(text("POWER", 14, 3), -45, 13, 0.1));
  for (let i = 0; i < 5; i++) {
    const x = -24 + i * 15.6, j = rj45Jack({ name: String(i + 1), on: [i < 4, i === 0 || i === 2] });
    j.scale.setScalar(0.95); front.add(at(j, x, H / 2 + 1, 0));
    front.add(at(text(String(i + 1), 6, 3), x, H + 0.5, 0.1));
  }
  g.add(front);
  const topT = text("5-PORT GIGABIT SWITCH · UNMANAGED", 70, 4.2, { weight: "700", color: "#d7dade" });
  at(topT, 8, H + 2.05, D / 2 - 8, -Math.PI / 2, 0, 0); g.add(topT);
  const back = new THREE.Group(); at(back, 0, 0, -D / 2, 0, BACK);
  back.add(at(dcJack("POWER"), 30, H / 2 + 2, 0)); back.add(at(text("DC 5V ⎓ 1A", 20, 3.2), 30, 6, 0.1));
  g.add(back);
  [-1, 1].forEach(function (s) { const v = slots(10, 2, 12, 4.4, true); at(v, s * (W / 2 + 0.05), H / 2 + 2, 0, 0, s * Math.PI / 2); g.add(v); });
  const under = sticker(["5-PORT GIGABIT SWITCH", "MODEL: US-1005", "10/100/1000 Mbps · Auto-MDI/MDIX", "S/N: " + COVERED, "5V ⎓ 1A"], 60, 26);
  at(under, 0, 1.95, 0, Math.PI / 2, 0, 0); g.add(under);
  return named(g, "device:5-port switch", { type: "switch", w: W, h: H + 2, d: D });
}

/* ------------------------------------------------------------- mesh */
/* The mesh Wi-Fi node from the photo: a white cylinder, cooling vents
   round the top, a status LED at the front (green good, amber weak
   link to the next node), side vents, and on the back plate WAN, LAN
   and 12V DC IN; reset on the side; the label underneath. */
export function meshNode(status) {
  const g = new THREE.Group(), R = 50, H = 150;
  const prof = [];
  const r1 = 5, r2 = 12;
  prof.push(new THREE.Vector2(0, 0));
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; prof.push(new THREE.Vector2(R - r1 + Math.cos(a) * r1, r1 + Math.sin(a) * r1)); }
  for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; prof.push(new THREE.Vector2(R - r2 + Math.cos(a) * r2, H - r2 + Math.sin(a) * r2)); }
  prof.push(new THREE.Vector2(0, H));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), mat(COL.white, { rough: 0.45 }));
  g.add(body);
  /* top vents: a ring of slots */
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2, s = box(9, 0.6, 2, mat(COL.hole, { rough: 1 }));
    s.position.set(Math.cos(a) * 26, H + 0.05, Math.sin(a) * 26); s.rotation.y = -a; g.add(s);
  }
  g.add(at(new THREE.Mesh(new THREE.CircleGeometry(16, 48), mat(0xe2e1dc, { rough: 0.6 })), 0, H + 0.08, 0, -Math.PI / 2));
  /* front status LED */
  const color = status === "weak" ? COL.ledAmber : COL.ledGreen;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 1.2, 10, 32), new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 2.2, roughness: 0.3 }));
  ring.position.set(0, 22, R + 0.2); ring.userData = { kind: "led", role: "STATUS", color: color, on: true }; g.add(ring);
  /* side vents, standing slots on the left and right */
  [-1, 1].forEach(function (s) {
    for (let i = 0; i < 6; i++) {
      const a = s * Math.PI / 2 + (i - 2.5) * 0.09, sl = box(2.4, 44, 1.2, mat(COL.hole, { rough: 1 }));
      sl.position.set(Math.sin(a) * (R - 0.2), 108, Math.cos(a) * (R - 0.2)); sl.rotation.y = a; g.add(sl);
    }
  });
  /* the back plate: WAN, LAN, 12V DC IN stacked, as in the photo */
  const bp = new THREE.Group(); at(bp, 0, 0, -R - 0.6, 0, BACK);   // proud of the curve
  bp.add(at(rbox(30, 74, 3, 3, mat(0xdcdbd6, { rough: 0.6 })), 0, 52, -1.4));
  bp.add(at(rj45Jack({ name: "WAN", insert: COL.wanYellow, on: [true, true] }), 0, 78, 0.2)); bp.add(at(text("WAN", 14, 3), 0, 69, 0.2));
  bp.add(at(rj45Jack({ name: "LAN", on: [false, false] }), 0, 56, 0.2)); bp.add(at(text("LAN", 14, 3), 0, 47, 0.2));
  bp.add(at(dcJack("12V DC IN"), 0, 33, 0.2)); bp.add(at(text("12V DC IN", 22, 3), 0, 24, 0.2));
  g.add(bp);
  for (let i = 0; i < 5; i++) { const sl = box(2.2, 26, 1.2, mat(COL.hole, { rough: 1 })); sl.position.set((i - 2) * 4.2, 120, -R + 0.3); g.add(sl); }
  /* reset on the left side, low */
  const rs = new THREE.Group(); at(rs, -R + 0.3, 30, 8, 0, -Math.PI / 2); rs.add(pinhole("RESET")); rs.add(at(text("RESET", 14, 3), 0, -6, 0.1)); g.add(rs);
  /* the label underneath */
  const lab = sticker(["MESH Wi-Fi NODE", "MODEL: MW-6", "S/N: " + COVERED, "MAC: " + COVERED, "12V ⎓ 1.5A"], 44, 24);
  at(lab, 0, -0.05, 0, Math.PI / 2, 0, 0); g.add(lab);
  return named(g, "device:Mesh node", { type: "mesh", w: R * 2, h: H, d: R * 2 });
}
