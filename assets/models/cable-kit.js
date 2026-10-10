/* =====================================================================
   The tools for making cable look like real cable: a tube whose cross-
   section can change along its length (crushed flat, kinked) and can be
   torn open; printed jacket legends; twisted pairs that really twist,
   each pair at its own lay length as in real Cat5e/Cat6.
   ===================================================================== */
import * as THREE from "three";

/* frames carried along the curve without flipping (parallel transport) */
export function frames(curve, n, up) {
  const T = [], N = [], B = [];
  let ref = (up || new THREE.Vector3(0, 1, 0)).clone();
  for (let i = 0; i <= n; i++) {
    const t = curve.getTangentAt(i / n).normalize();
    if (i === 0 && Math.abs(t.dot(ref)) > 0.95) ref = new THREE.Vector3(0, 0, 1);
    let b = new THREE.Vector3().crossVectors(t, ref).normalize();
    if (b.lengthSq() < 1e-6) b = B[i - 1].clone();
    const nn = new THREE.Vector3().crossVectors(b, t).normalize();
    T.push(t); N.push(nn); B.push(b); ref = nn;
  }
  return { T: T, N: N, B: B };
}

/* a tube along `curve`:
     o.radius(t) -> [rx, ry]      cross-section (ry is along the frame's normal)
     o.hole(t, a) -> bool         leave this patch open (a torn jacket)
     o.tint(t, a) -> 0..1         lighten the colour here (stress whitening)
     o.uvLength                   millimetres per texture repeat along it */
export function tubeVar(curve, o = {}) {
  const n = o.n || 160, m = o.m || 28, len = curve.getLength();
  const f = frames(curve, n, o.up);
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const base = new THREE.Color(o.color == null ? 0xffffff : o.color);
  for (let i = 0; i <= n; i++) {
    const t = i / n, P = curve.getPointAt(t), r = o.radius ? o.radius(t) : [o.r || 3, o.r || 3];
    const ex = o.square ? o.square(t) : 2;   /* 2: an ellipse; higher: a rounded rectangle (a superellipse) */
    for (let j = 0; j <= m; j++) {
      const a = j / m * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const c = ex === 2 ? ca : Math.sign(ca) * Math.pow(Math.abs(ca), 2 / ex), s = ex === 2 ? sa : Math.sign(sa) * Math.pow(Math.abs(sa), 2 / ex);
      const off = f.N[i].clone().multiplyScalar(c * r[1]).addScaledVector(f.B[i], s * r[0]);
      pos.push(P.x + off.x, P.y + off.y, P.z + off.z);
      const nn = f.N[i].clone().multiplyScalar(c / r[1]).addScaledVector(f.B[i], s / r[0]).normalize();
      nor.push(nn.x, nn.y, nn.z);
      uv.push(t * len / (o.uvLength || 100), 1 - j / m);   /* so printing reads the right way round from outside */
      const w = o.tint ? o.tint(t, a) : 0, cc = base.clone().lerp(new THREE.Color(0xffffff), w);
      col.push(cc.r, cc.g, cc.b);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const tm = (i + 0.5) / n, am = (j + 0.5) / m * Math.PI * 2;
    if (o.hole && o.hole(tm, am)) continue;
    const a = i * (m + 1) + j, b = a + m + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);   /* wound to face outward, matching the normals */
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  if (o.square) {   /* recompute the normals for the squared-off sections, and close the seam */
    g.computeVertexNormals(); const nn = g.attributes.normal;
    for (let i = 0; i <= n; i++) { const a = i * (m + 1), b = a + m; const x = (nn.getX(a) + nn.getX(b)) / 2, y = (nn.getY(a) + nn.getY(b)) / 2, z = (nn.getZ(a) + nn.getZ(b)) / 2; nn.setXYZ(a, x, y, z); nn.setXYZ(b, x, y, z); }
    nn.needsUpdate = true;
  }
  return g;
}

/* a printed legend on a jacket, as on real cable (no brand names) */
const legendCache = new Map();
export function legend(text, bg, ink, o = {}) {
  const key = text + bg + ink + JSON.stringify(o);
  if (legendCache.has(key)) return legendCache.get(key);
  const c = document.createElement("canvas"); c.width = 2048; c.height = 128; const g = c.getContext("2d");
  g.fillStyle = "#" + new THREE.Color(bg).getHexString(); g.fillRect(0, 0, 2048, 128);
  /* faint extrusion streaks, as on a real PVC jacket */
  for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(255,255,255," + (0.012 + (i % 5) * 0.004) + ")"; g.fillRect(0, (i * 37) % 128, 2048, 1); }
  g.fillStyle = ink; g.font = "600 " + (o.font || 18) + "px Arial, Helvetica, sans-serif";   /* about 2.5 mm letters, as printed on real jacket */ g.textBaseline = "middle";
  g.fillText(text, 30, o.band == null ? 106 : o.band);   /* near the top of the jacket, where it can be read */
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  legendCache.set(key, t); return t;
}
export function jacketMaterial(color, text, ink, o = {}) {
  return new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: legend(text, color, ink || "rgba(255,255,255,0.82)", o.font ? { font: o.font } : {}), roughness: o.rough == null ? 0.42 : o.rough, clearcoat: 0.25, clearcoatRoughness: 0.5, vertexColors: true, side: o.side || THREE.FrontSide, envMapIntensity: 0.7 });
}

/* ---- wire insulation: solid colour, or white with a coloured stripe ---- */
export const HUE = { orange: 0xec7419, green: 0x2a9a3d, blue: 0x2557d6, brown: 0x7b4a27, white: 0xf3f3ef, black: 0x1b1b1b, red: 0xd2302b, yellow: 0xf0c419, slate: 0x8a8f96 };
const wm = new Map();
export function wireMat(name) {
  if (wm.has(name)) return wm.get(name);
  let m;
  if (name.indexOf("white/") === 0) {
    const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d");
    g.fillStyle = "#f3f3ef"; g.fillRect(0, 0, 64, 256);
    g.fillStyle = "#" + HUE[name.slice(6)].toString(16).padStart(6, "0");
    for (let y = 0; y < 256; y += 32) { g.save(); g.translate(0, y); g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 18); g.lineTo(64, 30); g.lineTo(0, 12); g.fill(); g.restore(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.32, clearcoat: 0.4 });
  } else m = new THREE.MeshPhysicalMaterial({ color: HUE[name], roughness: 0.32, clearcoat: 0.4 });
  wm.set(name, m); return m;
}
export function wireTube(points, name, r, segs) {
  const curve = new THREE.CatmullRomCurve3(points.map(function (p) { return p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2]); }));
  const g = new THREE.TubeGeometry(curve, segs || Math.max(16, points.length * 6), r || 0.48, 10, false);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * curve.getLength() / 6);
  return new THREE.Mesh(g, wireMat(name));
}
/* the copper showing at a cut wire end */
export function copperEnd(p, dir, r) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r || 0.26, 12), new THREE.MeshStandardMaterial({ color: 0xc8773a, metalness: 0.9, roughness: 0.28 }));
  m.position.copy(p); m.lookAt(p.clone().add(dir)); return m;
}

/* points of one wire of a twisted pair along a path:
   the pair's centre follows `path(s)` (s in mm), frame from `frameAt(s)` */
export function helix(path, frameAt, s0, s1, lay, phase, rad, step) {
  const pts = [];
  for (let s = s0; s <= s1 + 1e-6; s += step || 0.6) {
    const P = path(s), F = frameAt(s), th = phase + (s - s0) / lay * Math.PI * 2;
    pts.push(P.clone().addScaledVector(F.N, Math.cos(th) * rad).addScaledVector(F.B, Math.sin(th) * rad));
  }
  return pts;
}
