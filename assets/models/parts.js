/* =====================================================================
   The pieces every model is built from, in real millimetres.

   The owner's photographs set the look; the standards set the details
   (TIA-568 wire order, RJ45 and RJ11 positions, the F-type and SC/APC
   connectors). Front faces +Z, up is +Y, a device sits on y = 0.

   Every port is a named group ("port:LAN 1") carrying userData, so the
   real build can find it, light its LEDs and plug a cable into it.
   No brand names or logos anywhere: the owner's ruling.
   ===================================================================== */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const COL = {
  white: 0xefeeea, black: 0x1d1e21, charcoal: 0x26282c, metal: 0x43474d,
  hole: 0x050506, gold: 0xd9ad48, copper: 0xc97a3d, silver: 0xb9bdc2,
  ledGreen: 0x2bff5a, ledAmber: 0xffa21a, ledBlue: 0x3d8bff, ledRed: 0xff3030,
  wanYellow: 0xf2c200, apcGreen: 0x1f9e46
};

const cache = new Map();
/* matte plastic by default; o.metal for metal, o.rough to taste */
export function mat(color, o = {}) {
  const key = color + "|" + JSON.stringify(o);
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.62, metalness: 0 }, o)));
  return cache.get(key);
}
export function clear(color) {
  return new THREE.MeshStandardMaterial({ color: color || 0xe8f2f6, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false });
}
export function rbox(w, h, d, r, m) {
  const rr = Math.max(0.01, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, rr), m);
}
export function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
export function cyl(r, h, m, seg) { return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg || 24), m); }
export function at(obj, x, y, z, rx, ry, rz) { obj.position.set(x, y, z); if (rx || ry || rz) obj.rotation.set(rx || 0, ry || 0, rz || 0); return obj; }
export function named(g, name, data) { g.name = name; g.userData = Object.assign({ kind: name.split(":")[0] }, data || {}); return g; }

/* ---- printed text: a plane facing +Z, w x h millimetres ---- */
export function text(str, w, h, o = {}) {
  const px = Math.min(24, 2048 / Math.max(w, h));
  const cw = Math.ceil(w * px), ch = Math.ceil(h * px);
  const c = document.createElement("canvas"); c.width = cw; c.height = ch;
  const g = c.getContext("2d");
  if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, cw, ch); }
  const lines = String(str).split("\n");
  const size = (o.size || h / lines.length * 0.78) * px;
  let fs = size;
  const setFont = function () { g.font = (o.weight || "600") + " " + fs + "px " + (o.font || "Arial, Helvetica, sans-serif"); };
  setFont();
  /* never run off the edge: shrink to fit the widest line */
  const widest = Math.max.apply(null, lines.map(function (l) { return g.measureText(l).width; }));
  if (widest > cw * 0.92) { fs = fs * cw * 0.92 / widest; setFont(); }
  g.fillStyle = o.color || "#f3f3f0"; g.textBaseline = "middle";
  g.textAlign = o.align || "center";
  const x = o.align === "left" ? 0.04 * cw : o.align === "right" ? 0.96 * cw : cw / 2;
  lines.forEach(function (l, i) { g.fillText(l, x, (i + 0.5) * ch / lines.length); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.renderOrder = 2;
  return p;
}
/* a white sticker with lines of small print; private details covered */
export function sticker(lines, w, h) {
  const g = new THREE.Group();
  g.add(at(box(w, h, 0.2, mat(0xf4f4f0, { rough: 0.8 })), 0, 0, 0.1));
  g.add(at(text(lines.join("\n"), w * 0.92, h * 0.9, { color: "#1b1b1b", weight: "500", align: "left" }), 0, 0, 0.22));
  return g;
}
export const COVERED = "████████";

/* ---- an LED: a small lens that glows when on ---- */
export function led(color, on, r) {
  const m = new THREE.MeshStandardMaterial({ color: on ? color : 0x2a2a2a, emissive: on ? color : 0x000000, emissiveIntensity: on ? 2.2 : 0, roughness: 0.3 });
  const s = new THREE.Mesh(new THREE.SphereGeometry(r || 1.3, 16, 10), m);
  s.scale.z = 0.5; s.userData = { kind: "led", color: color, on: !!on };
  return s;
}
export function setLed(s, on) {
  s.userData.on = on; s.material = s.material.clone();
  s.material.color.setHex(on ? s.userData.color : 0x2a2a2a);
  s.material.emissive.setHex(on ? s.userData.color : 0x000000); s.material.emissiveIntensity = on ? 2.2 : 0;
}

/* ---- vent slots: dark recesses on a face facing +Z ---- */
export function slots(n, sw, sh, pitch, vertical) {
  const g = new THREE.Group(), m = mat(COL.hole, { rough: 1 });
  for (let i = 0; i < n; i++) {
    const s = box(sw, sh, 0.6, m);
    const o = (i - (n - 1) / 2) * pitch;
    if (vertical) s.position.set(o, 0, 0); else s.position.set(0, o, 0);
    g.add(s);
  }
  return g;
}

/* ---- RJ45 jack (8P8C), the opening facing +Z, face at z = 0 ----
   Opening 11.7 x 7.4 with the latch notch below it; eight gold contacts
   inside at the top; link and activity LEDs on the housing. */
export function rj45Jack(o = {}) {
  const g = new THREE.Group();
  const hm = mat(o.insert || (o.metal ? COL.silver : COL.black), o.metal ? { metal: 0.7, rough: 0.35 } : { rough: 0.5 });
  const W = 15.8, H = 13.6, ow = 11.7, oh = 7.4, oy = 0.9, nw = 6, nh = 2.2, T = 2.6;   // T: how far it stands proud
  const bar = function (w, h, x, y) { g.add(at(box(w, h, T, hm), x, y, T / 2)); };
  const topY = oy + oh / 2, botY = oy - oh / 2 - nh, sideW = (W - ow) / 2, bw = (ow - nw) / 2;
  bar(W, H / 2 - topY, 0, (H / 2 + topY) / 2);                                          // above the opening
  bar(sideW, oh + nh, -(ow / 2 + sideW / 2), oy - nh / 2);                               // left
  bar(sideW, oh + nh, (ow / 2 + sideW / 2), oy - nh / 2);                                // right
  bar(bw, nh, -(nw / 2 + bw / 2), oy - oh / 2 - nh / 2);                                 // either side
  bar(bw, nh, (nw / 2 + bw / 2), oy - oh / 2 - nh / 2);                                  //   of the latch notch
  bar(W, botY + H / 2, 0, (botY - H / 2) / 2);                                           // below
  /* the dark inside seen through the opening, and its eight gold contacts */
  g.add(at(box(ow, oh + nh, 0.2, mat(COL.hole, { rough: 1 })), 0, oy - nh / 2, 0.12));
  const cm = mat(COL.gold, { metal: 0.9, rough: 0.25 });
  for (let i = 0; i < 8; i++) g.add(at(box(0.55, 1.6, 1.8, cm), (i - 3.5) * 1.02, topY - 0.9, 1.1));
  if (o.leds !== false) {
    const on = o.on || [false, false];
    const a = led(COL.ledGreen, on[0], 1.0), b = led(COL.ledAmber, on[1], 1.0);
    g.add(at(a, -(ow / 2 - 1.4), H / 2 - 1.1, T + 0.1)); g.add(at(b, (ow / 2 - 1.4), H / 2 - 1.1, T + 0.1));
    a.userData.role = "link"; b.userData.role = "activity";
  }
  return named(g, "port:" + (o.name || "RJ45"), { type: "rj45" });
}

/* ---- DC barrel jack, facing +Z ---- */
export function dcJack(name) {
  const g = new THREE.Group();
  g.add(at(cyl(4.2, 1.4, mat(0x3c3f44, { rough: 0.5 }), 32), 0, 0, 0.7, Math.PI / 2));
  g.add(at(new THREE.Mesh(new THREE.CircleGeometry(2.9, 32), mat(COL.hole, { rough: 1 })), 0, 0, 1.42));
  g.add(at(cyl(1.05, 1.2, mat(COL.silver, { metal: 0.9, rough: 0.3 })), 0, 0, 1.0, Math.PI / 2));
  return named(g, "port:" + (name || "POWER"), { type: "dc" });
}

/* ---- F-type female (the modem's CABLE IN), facing +Z ----
   A hex base and a 3/8-32 threaded barrel with the centre socket. */
export function fFemale(name) {
  const g = new THREE.Group(), m = mat(0xd8d4c8, { metal: 0.85, rough: 0.3 });
  g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(6.3, 6.3, 2.6, 6), m), 0, 0, 1.3, Math.PI / 2));
  const barrel = cyl(4.75, 8.5, m, 32); g.add(at(barrel, 0, 0, 6.8, Math.PI / 2));
  for (let i = 0; i < 9; i++) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(4.78, 0.22, 6, 32), m), 0, 0, 3.4 + i * 0.85));
  g.add(at(cyl(3.0, 0.4, mat(0xf1efe6)), 0, 0, 11.1, Math.PI / 2));
  g.add(at(cyl(0.7, 1, mat(COL.hole)), 0, 0, 11.2, Math.PI / 2));
  return named(g, "port:" + (name || "CABLE IN"), { type: "coax" });
}

/* ---- SC/APC fiber adapter, facing +Z: green means angle-polished ---- */
export function scApcAdapter(name) {
  const g = new THREE.Group(), gm = mat(COL.apcGreen, { rough: 0.45 });
  g.add(at(rbox(10.5, 10.5, 1.4, 0.8, gm), 0, 0, -0.7));
  g.add(at(rbox(9, 9, 8, 0.6, gm), 0, 0, 4));
  g.add(at(box(6.6, 7.6, 2, mat(COL.hole, { rough: 1 })), 0, 0, 7.4));
  return named(g, "port:" + (name || "FIBER"), { type: "fiber", connector: "SC/APC" });
}

/* ---- a recessed pinhole reset, and a small push button ---- */
export function pinhole(name) {
  const g = new THREE.Group();
  g.add(at(cyl(1.9, 0.4, mat(0x5a5e64, { rough: 0.5 }), 24), 0, 0, 0.2, Math.PI / 2));
  g.add(at(new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), mat(COL.hole, { rough: 1 })), 0, 0, 0.42));
  return named(g, "button:" + (name || "RESET"), { type: "pinhole" });
}
export function button(name, w, h, color) {
  const g = new THREE.Group();
  g.add(at(rbox(w || 6, h || 4, 2, 0.8, mat(color || COL.charcoal)), 0, 0, 0.6));
  return named(g, "button:" + name, { type: "button" });
}

/* ---- a cable as a tube along points ---- */
export function cable(points, r, color, o = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, o.seg || 64, r, 14, false), mat(color, { rough: o.rough || 0.55 }));
}

/* ---- framing helper for the viewer: the box a model occupies ---- */
export function bounds(obj) { return new THREE.Box3().setFromObject(obj); }
