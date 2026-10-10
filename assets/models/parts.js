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
import { grain } from "./surface.js";

export const COL = {
  white: 0xefeeea, black: 0x1d1e21, charcoal: 0x26282c, metal: 0x43474d,
  hole: 0x050506, gold: 0xd9ad48, copper: 0xc97a3d, silver: 0xb9bdc2,
  ledGreen: 0x2bff5a, ledAmber: 0xffa21a, ledBlue: 0x3d8bff, ledRed: 0xff3030,
  wanYellow: 0xf2c200, apcGreen: 0x1f9e46
};

const cache = new Map();
/* matte plastic by default; o.metal for metal, o.rough to taste. Every
   finish gets the fine grain real moulding and machining leave (see
   surface.js); o.grain: false for a glassy or printed face, o.brushed
   'x' | 'y' | 'z' for brushed metal.
   (Before 10 October 2026 o.metal and o.rough were passed to three.js
   under the wrong names and ignored: every "metal" part was plastic.) */
export function mat(color, o = {}) {
  const key = color + "|" + JSON.stringify(o);
  if (!cache.has(key)) {
    const p = { color: color, roughness: o.rough != null ? o.rough : 0.62, metalness: o.metal != null ? o.metal : 0 };
    ["emissive", "emissiveIntensity", "transparent", "opacity", "side", "depthWrite"].forEach(function (k) { if (o[k] != null) p[k] = o[k]; });
    p.envMapIntensity = p.metalness > 0.5 ? 2.2 : 0.75;   /* metal shows what it reflects; plastic is mostly lit by the lamps */
    const m = new THREE.MeshStandardMaterial(p);
    if (o.grain !== false && color !== COL.hole) grain(m, { grain: o.grain != null ? o.grain : (p.metalness > 0.5 ? (o.brushed ? 0.05 : 0.02) : 0.08), scale: o.scale || (p.metalness > 0.5 ? 0.25 : 0.3), brushed: o.brushed });
    cache.set(key, m);
  }
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
  if (o.spacing) { try { g.letterSpacing = (o.spacing * fs) + "px"; } catch (e) {} }
  const x = o.align === "left" ? 0.04 * cw : o.align === "right" ? 0.96 * cw : cw / 2;
  lines.forEach(function (l, i) { g.fillText(l, x, (i + 0.5) * ch / lines.length); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  /* print is lit like the surface it is on; a screen (o.screen) glows */
  const m = o.screen ? new THREE.MeshBasicMaterial({ map: tex, transparent: !o.bg, toneMapped: false })
    : new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.7, envMapIntensity: 0.45, polygonOffset: true, polygonOffsetFactor: -2 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.renderOrder = 2; p.userData.print = true;
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
  r = r || 1.3;
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), ledMat(color, on));
  s.scale.z = 0.5; s.userData = { kind: "led", color: color, on: !!on };
  s.add(halo(color, r * 15, r * 1.1, on));
  return s;
}
export function ledPipe(color, on) {
  const s = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 0.5), ledMat(color, on)); s.userData = { kind: "led", color: color, on: !!on };
  s.add(halo(color, 18, 0.6, on));
  return s;
}
/* a lit LED keeps its colour, with a soft glow round it as a camera
   sees it; an unlit one is dark smoked plastic */
function ledMat(color, on) {
  /* emissive only (a black base, so the lamps don't add to it and push it to white) */
  return on ? new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: 0.95, roughness: 0.3 })
    : new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.3 });
}
let glowTex = null;
function halo(color, size, z, on) {
  if (!glowTex) {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.16, "rgba(255,255,255,0.6)"); gr.addColorStop(0.45, "rgba(255,255,255,0.12)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  }
  /* a single point sprite on layer 1: the viewer draws glows after the
     shading pass (light isn't shadowed), hiding any whose LED it can't see */
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex, color: color, size: size, sizeAttenuation: true, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  p.position.z = z; p.layers.set(1); p.visible = !!on; p.userData.halo = true; return p;
}
export function setLed(s, on) {
  s.userData.on = on; s.material = ledMat(s.userData.color, on);
  s.children.forEach(function (c) { if (c.userData.halo) c.visible = on; });
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
  if (!o.jaw) {
    bar(bw, nh, -(nw / 2 + bw / 2), oy - oh / 2 - nh / 2);                               // either side
    bar(bw, nh, (nw / 2 + bw / 2), oy - oh / 2 - nh / 2);                                //   of the latch notch
  }
  bar(W, botY + H / 2, 0, (botY - H / 2) / 2);                                           // below
  /* the dark inside seen through the opening, and its eight gold contacts */
  g.add(at(box(ow, oh + nh, 0.2, mat(COL.hole, { rough: 1 })), 0, oy - nh / 2, 0.12));
  const cm = mat(COL.gold, { metal: 0.9, rough: 0.25 });
  for (let i = 0; i < 8; i++) g.add(at(box(0.55, 1.6, 1.8, cm), (i - 3.5) * 1.02, topY - 0.9, 1.1));
  if (o.leds !== false) {
    const on = o.on || [false, false];
    /* a shielded jack's lights are square light pipes in the shield's corners */
    const ac = o.actColor || COL.ledAmber;
    const a = o.metal ? ledPipe(COL.ledGreen, on[0]) : led(COL.ledGreen, on[0], 1.0), b = o.metal ? ledPipe(ac, on[1]) : led(ac, on[1], 1.0);
    g.add(at(a, -(ow / 2 - 1.5), H / 2 - 1.25, T + 0.1)); g.add(at(b, (ow / 2 - 1.5), H / 2 - 1.25, T + 0.1));
    a.userData.role = "link"; b.userData.role = "activity";
  }
  if (o.metal) {   /* the shield's spring fingers round the opening */
    const fm = mat(0xdadde1, { metal: 1, rough: 0.22 });
    [-2.6, 2.6].forEach(function (x) { g.add(at(box(1.8, 0.45, 0.3, fm), x, topY + 0.75, T + 0.05)); });
    [-1, 1].forEach(function (sd) { g.add(at(box(0.45, 2.2, 0.3, fm), sd * (ow / 2 + 0.9), oy + 0.6, T + 0.05)); });
    g.add(at(box(W + 0.3, 0.35, T + 0.2, fm), 0, H / 2 - 0.1, T / 2));   // the folded top edge
  }
  if (o.jaw) {     /* a laptop's drop-jaw: the bottom of the opening hinges down to let the plug in */
    const jaw = new THREE.Group(); jaw.position.set(0, botY, T); jaw.rotation.x = o.jaw === "open" ? 0.5 : 0;
    jaw.add(at(box(ow + 1.6, 3.6, 1.2, hm), 0, -1.8, -0.6)); g.add(jaw);
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

/* =====================================================================
   More connectors (batch 3), each drawn to its real outline. A socket
   is a proud frame round the real opening shape, a dark inside, and the
   tongue or pins inside it. All face +Z.
   ===================================================================== */
function rr(w, h, r) {   /* a rounded rectangle centred on 0,0, as a path */
  const p = new THREE.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r || 0, w / 2, h / 2);
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); if (r) p.quadraticCurveTo(x + w, y, x + w, y + r); p.lineTo(x + w, y + h - r);
  if (r) p.quadraticCurveTo(x + w, y + h, x + w - r, y + h); p.lineTo(x + r, y + h); if (r) p.quadraticCurveTo(x, y + h, x, y + h - r); p.lineTo(x, y + r);
  if (r) p.quadraticCurveTo(x, y, x + r, y); return p;
}
function poly(pts) { const p = new THREE.Shape(); pts.forEach(function (q, i) { if (i) p.lineTo(q[0], q[1]); else p.moveTo(q[0], q[1]); }); p.closePath(); return p; }
function asPath(shape) { const p = new THREE.Path(); p.curves = shape.curves; p.currentPoint = shape.currentPoint; return p; }
/* the frame round an opening, standing `d` proud, and the dark inside */
export function socket(outer, hole, o = {}) {
  const g = new THREE.Group();
  const s = outer.clone ? outer : outer; s.holes = [asPath(hole)];
  const fm = o.frameMat || mat(o.frame == null ? COL.silver : o.frame, o.frameOpts || (o.frame == null ? { metal: 0.85, rough: 0.3 } : {}));
  g.add(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: o.d || 1.2, bevelEnabled: false, curveSegments: 12 }), fm));
  const back = new THREE.Mesh(new THREE.ShapeGeometry(hole, 12), mat(COL.hole, { rough: 1 })); back.position.z = 0.08; g.add(back);
  return g;
}
/* USB-A: 12.5 x 5.12 opening, a metal shell; tongue blue for USB 3.x, black for 2.0 */
export function usbA(name, gen3, o = {}) {
  const g = socket(rr(14.2, 6.8, 0.6), rr(12.5, 5.12, 0.3), { d: 1.2, frame: o.frame });
  g.add(at(box(11.2, 1.84, 1.0, mat(gen3 ? 0x1f5fd6 : COL.black, { rough: 0.5 })), 0, 0.85, 0.55));
  return named(g, "port:" + (name || "USB"), { type: "usb-a", gen: gen3 ? "3.x" : "2.0" });
}
/* USB-C: 8.34 x 2.56 stadium, the tongue in the middle */
export function usbC(name) {
  const g = socket(rr(10, 4.2, 2.1), rr(8.34, 2.56, 1.28), { d: 1.0 });
  g.add(at(box(6.6, 0.7, 0.8, mat(COL.black, { rough: 0.5 })), 0, 0, 0.45));
  return named(g, "port:" + (name || "USB-C"), { type: "usb-c" });
}
/* HDMI type A: 14 wide, 4.55 tall, its lower corners cut */
export function hdmi(name) {
  const hole = poly([[-7, 2.27], [7, 2.27], [7, -0.5], [5.2, -2.27], [-5.2, -2.27], [-7, -0.5]]);
  const g = socket(rr(16, 6.6, 0.8), hole, { d: 1.2 });
  g.add(at(box(10.6, 1.4, 1.0, mat(COL.black, { rough: 0.5 })), 0, 0.3, 0.55));
  return named(g, "port:" + (name || "HDMI"), { type: "hdmi" });
}
/* DisplayPort: 16.1 x 4.76, one lower corner cut */
export function displayPort(name) {
  const hole = poly([[-8.05, 2.38], [8.05, 2.38], [8.05, -0.6], [6.3, -2.38], [-8.05, -2.38]]);
  const g = socket(rr(18, 6.8, 0.8), hole, { d: 1.2 });
  g.add(at(box(12, 1.3, 1.0, mat(COL.black, { rough: 0.5 })), 0, 0.2, 0.55));
  return named(g, "port:" + (name || "DP"), { type: "displayport" });
}
/* a 3.5 mm audio jack in its coloured ring (blue line in, green line out, pink mic) */
export function audioJack(name, color) {
  const g = new THREE.Group();
  g.add(at(cyl(3.3, 0.9, mat(color || COL.black, { rough: 0.45 }), 28), 0, 0, 0.45, Math.PI / 2));
  g.add(at(new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), mat(COL.hole, { rough: 1 })), 0, 0, 0.92));
  return named(g, "port:" + (name || "AUDIO"), { type: "audio" });
}
/* DE-9 serial: the D-shaped shell, nine sockets in two rows, hex standoffs */
export function db9(name) {
  const hole = poly([[-8.3, 2.9], [8.3, 2.9], [7.0, -2.9], [-7.0, -2.9]]);
  const g = socket(poly([[-9.4, 3.9], [9.4, 3.9], [8.0, -3.9], [-8.0, -3.9]]), hole, { d: 1.6 });
  const ins = new THREE.Mesh(new THREE.ShapeGeometry(poly([[-7.8, 2.5], [7.8, 2.5], [6.6, -2.5], [-6.6, -2.5]])), mat(0x26282c, { rough: 0.6 })); ins.position.z = 0.25; g.add(ins);
  for (let k = 0; k < 9; k++) { const top = k < 5, x = top ? (k - 2) * 2.77 : (k - 6.5) * 2.77; g.add(at(new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), mat(COL.hole, { rough: 1 })), x, top ? 1.15 : -1.15, 0.3)); }
  [-12.5, 12.5].forEach(function (x) { g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 4, 6), mat(COL.silver, { metal: 0.85, rough: 0.3 })), x, 0, 2, Math.PI / 2)); g.add(at(new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), mat(COL.hole)), x, 0, 4.02)); });
  return named(g, "port:" + (name || "SERIAL"), { type: "db9" });
}
/* USB-B (the printer end): squarish, the top corners chamfered */
export function usbB(name) {
  const hole = poly([[-4.2, 2.6], [-2.9, 3.9], [2.9, 3.9], [4.2, 2.6], [4.2, -3.9], [-4.2, -3.9]]);
  const g = socket(rr(10.6, 10.4, 0.8), hole, { d: 1.2 });
  g.add(at(box(5.2, 3.0, 1.0, mat(0x1c1d20, { rough: 0.5 })), 0, -0.2, 0.55));
  return named(g, "port:" + (name || "USB-B"), { type: "usb-b" });
}
/* IEC C14 power inlet, and the rocker switch beside it */
export function iecInlet(name) {
  const g = new THREE.Group();
  const outer = poly([[-15, 11], [15, 11], [15, -4], [9, -11], [-9, -11], [-15, -4]]);
  const hole = poly([[-12.2, 8.3], [12.2, 8.3], [12.2, -3], [7.4, -8.3], [-7.4, -8.3], [-12.2, -3]]);
  g.add(socket(outer, hole, { d: 1.6, frame: COL.black }));
  [[-7, 1.8], [7, 1.8], [0, -4.4]].forEach(function (p) { g.add(at(box(1.6, 4.6, 6, mat(COL.silver, { metal: 0.9, rough: 0.25 })), p[0], p[1], 2.6)); });
  return named(g, "port:" + (name || "AC IN"), { type: "iec-c14" });
}
export function rocker(name) {
  const g = new THREE.Group();
  g.add(at(rbox(14, 20, 1.6, 0.8, mat(COL.black, { rough: 0.5 })), 0, 0, 0.8));
  const k = rbox(11, 16, 3, 1, mat(0x2b2d31, { rough: 0.45 })); k.position.z = 2; k.rotation.x = -0.18; g.add(k);
  g.add(at(text("I", 3, 3, { weight: "800" }), 0, 4, 3.6, -0.18)); g.add(at(text("O", 3.4, 3.4, { weight: "800" }), 0, -4, 3.0, -0.18));
  return named(g, "button:" + (name || "POWER SWITCH"), { type: "rocker" });
}
/* a fan grille: rings and spokes over a dark well, the blades behind */
export function fanGrille(d, color) {
  const g = new THREE.Group(), m = mat(color || 0x2a2c30, { metal: 0.5, rough: 0.45 });
  g.add(at(new THREE.Mesh(new THREE.CircleGeometry(d / 2, 48), mat(COL.hole, { rough: 1 })), 0, 0, 0.02));
  for (let k = 0; k < 7; k++) { const blade = box(d * 0.36, d * 0.11, 0.4, mat(0x18191b, { rough: 0.6 })); blade.position.set(Math.cos(k / 7 * Math.PI * 2) * d * 0.2, Math.sin(k / 7 * Math.PI * 2) * d * 0.2, 0.3); blade.rotation.z = k / 7 * Math.PI * 2 + 0.5; g.add(blade); }
  for (let r = d * 0.12; r < d / 2; r += d * 0.075) g.add(at(new THREE.Mesh(new THREE.TorusGeometry(r, 0.55, 6, 48), m), 0, 0, 1.2));
  for (let k = 0; k < 4; k++) { const s = box(d, 1.1, 0.8, m); s.position.z = 1.2; s.rotation.z = k * Math.PI / 4 + Math.PI / 8; g.add(s); }
  g.add(at(cyl(d * 0.11, 1.6, m, 24), 0, 0, 1.2, Math.PI / 2));
  return named(g, "fan", { type: "fan", d: d });
}
/* RJ11 jack (6P): 9.8 x 6.9 opening, contacts in the four middle positions */
export function rj11Jack(o = {}) {
  const g = new THREE.Group(), hm = mat(o.insert || 0x9ea2a8, { rough: 0.5 }), W = 13, H = 11.6, ow = 9.8, oh = 6.2, oy = 0.8, nw = 4, nh = 1.8, T = 2.4;
  const bar = function (w, h, x, y) { g.add(at(box(w, h, T, hm), x, y, T / 2)); };
  const topY = oy + oh / 2, botY = oy - oh / 2 - nh, sideW = (W - ow) / 2, bw = (ow - nw) / 2;
  bar(W, H / 2 - topY, 0, (H / 2 + topY) / 2); bar(sideW, oh + nh, -(ow / 2 + sideW / 2), oy - nh / 2); bar(sideW, oh + nh, (ow / 2 + sideW / 2), oy - nh / 2);
  bar(bw, nh, -(nw / 2 + bw / 2), oy - oh / 2 - nh / 2); bar(bw, nh, (nw / 2 + bw / 2), oy - oh / 2 - nh / 2); bar(W, botY + H / 2, 0, (botY - H / 2) / 2);
  g.add(at(box(ow, oh + nh, 0.2, mat(COL.hole, { rough: 1 })), 0, oy - nh / 2, 0.12));
  for (let p = 1; p <= 4; p++) g.add(at(box(0.5, 1.4, 1.6, mat(COL.gold, { metal: 1, rough: 0.22 })), (2.5 - p) * 1.02, topY - 0.8, 1.0));
  return named(g, "port:" + (o.name || "RJ11"), { type: "rj11" });
}
/* a slotted screw head, flush */
export function screw(r, color) {
  const g = new THREE.Group();
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(color || COL.silver, { metal: color ? 0 : 0.85, rough: 0.35 })), 0, 0, 0, Math.PI / 2));
  g.children[0].scale.y = 0.35;
  g.add(at(box(r * 1.7, r * 0.22, 0.8, mat(0x6d6f73, { rough: 0.7 })), 0, 0, r * 0.32));
  return g;
}

/* ---- a round body (radius rAt(y) between the y rings given) with flat
   pockets cut into it: inside a pocket's height the wall is clamped to a
   plane d from the axis, so the pocket has a flat floor, ledges top and
   bottom, and sharp sides where the flat meets the round, as moulded.
   pockets: [{ th: angle (0 = +Z, toward +X), d, y0, y1 }] ---- */
export function cutCylinder(rAt, ys, pockets, seg) {
  seg = seg || 160;
  const rings = [];
  const all = ys.slice(); pockets.forEach(function (p) { all.push(p.y0 - 0.01, p.y0, (p.y0 + p.y1) / 2, p.y1, p.y1 + 0.01); });
  all.sort(function (a, b) { return a - b; }).forEach(function (y, i, arr) { if (i === 0 || Math.abs(y - arr[i - 1]) > 1e-4) rings.push(y); });
  const pos = [], idx = [];
  rings.forEach(function (y) {
    for (let j = 0; j <= seg; j++) {
      const th = j / seg * Math.PI * 2; let rr = rAt(y);
      pockets.forEach(function (p) { if (y >= p.y0 && y <= p.y1) { const c = Math.cos(th - p.th); if (c > 0) rr = Math.min(rr, p.d / c); } });
      pos.push(Math.sin(th) * rr, y, Math.cos(th) * rr);
    }
  });
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
