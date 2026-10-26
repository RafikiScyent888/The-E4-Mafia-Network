/* =====================================================================
   Surfaces, so the models read as real objects and not as painted
   blocks: the fine grain moulded into plastic, brushed metal, paint
   with a little orange peel, perforated mesh with real holes, and the
   print a technician actually sees on gear (outline boxes round port
   groups, barcodes, regulatory marks). No brand names or logos.

   The grain is worked in the shader from each mesh's own position in
   millimetres, so it is the same size on a 5 mm button and a 400 mm
   panel, whatever the geometry's UVs.
   ===================================================================== */
import * as THREE from "three";

const NOISE = /* glsl */`
float e4h(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float e4n(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(e4h(i), e4h(i + vec3(1,0,0)), f.x), mix(e4h(i + vec3(0,1,0)), e4h(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(e4h(i + vec3(0,0,1)), e4h(i + vec3(1,0,1)), f.x), mix(e4h(i + vec3(0,1,1)), e4h(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;

/* add grain to a MeshStandard/Physical material:
     o.grain    strength of the moulded texture (0.15 fine, 0.35 coarse)
     o.scale    feature size in mm (0.35 fine plastic, 1.2 orange peel)
     o.brushed  'x' | 'y' | 'z': streaks along that axis (brushed metal)
     o.rough    how much the roughness varies with the grain */
export function grain(m, o = {}) {
  const k = o.grain == null ? 0.18 : o.grain, sc = 1 / (o.scale || 0.4), br = o.brushed ? { x: 0, y: 1, z: 2 }[o.brushed] : -1, rv = o.rough == null ? 0.18 : o.rough;
  m.onBeforeCompile = function (s) {
    s.uniforms.e4k = { value: k }; s.uniforms.e4s = { value: sc }; s.uniforms.e4r = { value: rv };
    s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vE4p;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvE4p = position;");
    s.fragmentShader = s.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vE4p;\nuniform float e4k, e4s, e4r;\n" + NOISE)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n" +
        "vec3 e4q = vE4p * e4s;\n" +
        (br === 0 ? "e4q *= vec3(0.02, 1.0, 6.0);\n" : br === 1 ? "e4q *= vec3(6.0, 0.02, 1.0);\n" : br === 2 ? "e4q *= vec3(6.0, 1.0, 0.02);\n" : "") +
        "float e4g = e4n(e4q) * 0.65 + e4n(e4q * 2.7) * 0.35;\n" +
        "roughnessFactor = clamp(roughnessFactor * (1.0 + (e4g - 0.5) * e4r * 2.0), 0.03, 1.0);")
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n" +
        "{ vec3 e4a = vec3(e4n(e4q + 13.1), e4n(e4q + 41.7), e4n(e4q + 71.3)) - 0.5; normal = normalize(normal + e4a * e4k); }");
  };
  m.customProgramCacheKey = function () { return "e4g" + k + "_" + sc + "_" + br + "_" + rv; };
  return m;
}

/* ---- finishes ---- */
export function plastic(color, o = {}) {
  return grain(new THREE.MeshStandardMaterial({ color: color, roughness: o.rough == null ? 0.55 : o.rough, metalness: 0, envMapIntensity: 0.75 }), { grain: o.grain == null ? 0.08 : o.grain, scale: o.scale || 0.3 });
}
export function gloss(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({ color: color, roughness: o.rough == null ? 0.18 : o.rough, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12 });
}
export function brushed(color, axis, o = {}) {
  return grain(new THREE.MeshStandardMaterial({ color: color, roughness: o.rough == null ? 0.34 : o.rough, metalness: o.metal == null ? 0.85 : o.metal, envMapIntensity: 2.2 }), { grain: 0.03, scale: 0.18, brushed: axis || "x", rough: 0.1 });
}
export function paintedSteel(color, o = {}) {
  return grain(new THREE.MeshStandardMaterial({ color: color, roughness: o.rough == null ? 0.5 : o.rough, metalness: 0.08, envMapIntensity: 0.55 }), { grain: 0.07, scale: 1.1, rough: 0.12 });
}
export function rubber(color) {
  return grain(new THREE.MeshStandardMaterial({ color: color, roughness: 0.92, metalness: 0, envMapIntensity: 0.6 }), { grain: 0.12, scale: 0.3, rough: 0.05 });
}
export function nickel() { return new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 0.9, roughness: 0.26, envMapIntensity: 2.2 }); }

/* ---- a canvas, drawn once and cached ---- */
const cache = new Map();
function canvasTex(key, w, h, draw, o = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = o.data ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  cache.set(key, t); return t;
}

/* perforated sheet with real holes: a w x h plane facing +Z.
   o.pitch hole spacing, o.d hole size, o.shape 'round' | 'hex' | 'slot' */
export function perforated(w, h, o = {}) {
  const pitch = o.pitch || 3, d = o.d || 2, shape = o.shape || "round", px = Math.min(12, 2048 / Math.max(w, h));
  const key = ["perf", w, h, pitch, d, shape].join("_");
  const alpha = canvasTex(key, Math.ceil(w * px), Math.ceil(h * px), function (g, cw, ch) {
    g.fillStyle = "#fff"; g.fillRect(0, 0, cw, ch); g.fillStyle = "#000";
    const rows = Math.floor(h / (pitch * (shape === "hex" ? 0.866 : 1))), cols = Math.floor(w / pitch);
    const ox = (w - (cols - 1) * pitch) / 2, oy = (h - (rows - 1) * pitch * (shape === "hex" ? 0.866 : 1)) / 2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (ox + c * pitch + (shape === "hex" && r % 2 ? pitch / 2 : 0)) * px, y = (oy + r * pitch * (shape === "hex" ? 0.866 : 1)) * px;
      if (x > cw - d * px * 0.5 || y > ch - d * px * 0.5) continue;
      g.beginPath();
      if (shape === "hex") { for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g.lineTo(x + Math.cos(a) * d * px / 2, y + Math.sin(a) * d * px / 2); } }
      else if (shape === "slot") { g.rect(x - d * px / 2, y - d * px * 1.6, d * px, d * px * 3.2); }
      else g.arc(x, y, d * px / 2, 0, Math.PI * 2);
      g.fill();
    }
  }, { data: true });
  const m = o.material || paintedSteel(o.color == null ? 0x1f2125 : o.color);
  m.alphaMap = alpha; m.alphaTest = 0.5; m.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  return mesh;
}

/* printed line-work: outline boxes round port groups, as on real gear.
   rects: [[x, y, w, h, r]] in mm relative to the centre of a W x H area */
export function printLines(W, H, rects, o = {}) {
  const px = Math.min(16, 2048 / Math.max(W, H)), key = "lines_" + W + "_" + H + "_" + JSON.stringify(rects) + (o.color || "") + (o.width || "");
  const t = canvasTex(key, Math.ceil(W * px), Math.ceil(H * px), function (g, cw, ch) {
    g.strokeStyle = o.color || "#f0f0ea"; g.lineWidth = (o.width || 0.35) * px;
    rects.forEach(function (r) {
      const x = (W / 2 + r[0] - r[2] / 2) * px, y = (H / 2 - r[1] - r[3] / 2) * px, w = r[2] * px, h = r[3] * px, rr = (r[4] || 0) * px;
      g.beginPath(); g.moveTo(x + rr, y); g.arcTo(x + w, y, x + w, y + h, rr); g.arcTo(x + w, y + h, x, y + h, rr); g.arcTo(x, y + h, x, y, rr); g.arcTo(x, y, x + w, y, rr); g.closePath(); g.stroke();
    });
  });
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), m); mesh.renderOrder = 2; mesh.castShadow = false; mesh.userData.print = true;
  return mesh;
}

/* a barcode (a pattern of bars, encoding nothing real) on white */
export function barcodeTex(seed, o = {}) {
  return canvasTex("bar_" + seed + "_" + (o.caption || ""), 512, 160, function (g, cw, ch) {
    g.fillStyle = "#f6f6f2"; g.fillRect(0, 0, cw, ch); g.fillStyle = "#151515";
    let s = 0; for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    const rnd = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    let x = 24; const bottom = o.caption ? 112 : 146;
    while (x < cw - 30) { const bw = 2 + Math.floor(rnd() * 4) * 2; if (rnd() > 0.42) g.fillRect(x, 12, bw, bottom - 12); x += bw + 2 + Math.floor(rnd() * 3) * 2; }
    if (o.caption) { g.font = "600 30px Arial, Helvetica, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(o.caption, cw / 2, 136); }
  });
}

/* regulatory marks drawn generically: the CE mark, FCC, the crossed-out
   wheelie bin (WEEE), the recycling arrows, a double-insulation square */
export function regMarksTex(o = {}) {
  const ink = o.ink || "#151515";
  return canvasTex("reg_" + ink, 640, 120, function (g, cw, ch) {
    g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 7;
    g.font = "900 78px Arial, Helvetica, sans-serif"; g.textBaseline = "middle"; g.fillText("FC", 14, 62);
    g.lineWidth = 9; g.beginPath(); g.arc(196, 60, 34, Math.PI * 0.5, Math.PI * 1.5); g.stroke();                 // C
    g.beginPath(); g.arc(266, 60, 34, Math.PI * 0.5, Math.PI * 1.5); g.stroke(); g.fillRect(238, 56, 26, 8);       // E
    g.lineWidth = 5; g.strokeRect(318, 22, 76, 76); g.strokeRect(334, 38, 44, 44);                               // double insulation
    g.beginPath(); for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 3; g.moveTo(460 + Math.cos(a) * 14, 60 + Math.sin(a) * 14); g.lineTo(460 + Math.cos(a + 2.1) * 34, 60 + Math.sin(a + 2.1) * 34); } g.stroke();   // recycling
    g.beginPath(); g.moveTo(452, 26); g.lineTo(494, 90); g.lineTo(424, 90); g.closePath(); g.stroke();
    g.lineWidth = 5; g.strokeRect(540, 30, 44, 56); g.beginPath(); g.moveTo(530, 30); g.lineTo(594, 30); g.stroke();                 // the bin
    g.beginPath(); g.arc(548, 94, 6, 0, Math.PI * 2); g.arc(576, 94, 6, 0, Math.PI * 2); g.fill();
    g.lineWidth = 6; g.beginPath(); g.moveTo(524, 18); g.lineTo(600, 104); g.moveTo(600, 18); g.lineTo(524, 104); g.stroke();        // crossed out
  });
}

/* a printed sticker: lines of text, an optional barcode and marks.
   Built as one texture so it reads as one printed label. */
export function labelTex(lines, o = {}) {
  const W = o.w || 60, H = o.h || 24, px = 24, cw = Math.ceil(W * px), ch = Math.ceil(H * px);
  return canvasTex("lab_" + JSON.stringify([lines, o]), cw, ch, function (g) {
    g.fillStyle = o.bg || "#f4f4f0"; g.fillRect(0, 0, cw, ch);
    const n = lines.length + (o.barcode ? 2.2 : 0) + (o.marks ? 1.6 : 0), lh = ch / n;
    g.fillStyle = o.ink || "#141414"; g.textBaseline = "middle";
    let y = 0;
    lines.forEach(function (l, i) {
      g.font = (i === 0 && o.boldFirst !== false ? "700 " : "500 ") + (lh * 0.66) + "px Arial, Helvetica, sans-serif";
      let fs = lh * 0.66; const wdt = g.measureText(l).width; if (wdt > cw * 0.92) { fs *= cw * 0.92 / wdt; g.font = (i === 0 && o.boldFirst !== false ? "700 " : "500 ") + fs + "px Arial, Helvetica, sans-serif"; }
      g.fillText(l, cw * 0.04, y + lh / 2); y += lh;
    });
    if (o.barcode) { const img = barcodeTex(o.barcode).image; g.drawImage(img, cw * 0.03, y + lh * 0.1, cw * 0.62, lh * 2); y += lh * 2.2; }
    if (o.marks) { const img = regMarksTex().image; g.drawImage(img, cw * 0.03, y, lh * 1.6 * 640 / 120, lh * 1.5); }
    if (o.border) { g.strokeStyle = "#9a9a96"; g.lineWidth = 3; g.strokeRect(1.5, 1.5, cw - 3, ch - 3); }
  });
}
export function label(lines, o = {}) {
  const g = new THREE.Group(), W = o.w || 60, H = o.h || 24;
  const face = new THREE.MeshStandardMaterial({ map: labelTex(lines, o), roughness: o.gloss ? 0.3 : 0.75 });
  const edge = new THREE.MeshStandardMaterial({ color: o.bg ? new THREE.Color(o.bg) : 0xf4f4f0, roughness: 0.75 });
  const mats = [edge, edge, edge, edge, face, edge];
  const b = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.12), mats); b.position.z = 0.06; g.add(b);
  return g;
}

/* wood for the bench the gear sits on, as in the owner's photographs */
export function woodTex() {
  return canvasTex("wood", 2048, 2048, function (g, cw, ch) {
    const planks = 6, ph = ch / planks;
    for (let p = 0; p < planks; p++) {
      const base = [[122, 84, 52], [131, 90, 56], [114, 78, 47], [127, 88, 55], [118, 80, 50], [135, 94, 60]][p];
      g.fillStyle = "rgb(" + base.join(",") + ")"; g.fillRect(0, p * ph, cw, ph);
      let s = 1234 + p * 977; const rnd = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      for (let k = 0; k < 140; k++) {                     /* grain lines, wavering along the plank */
        const y0 = p * ph + rnd() * ph, amp = 2 + rnd() * 9, f = 0.002 + rnd() * 0.004, ph0 = rnd() * 6.28, dark = rnd() > 0.5;
        g.strokeStyle = dark ? "rgba(60,36,18," + (0.08 + rnd() * 0.18) + ")" : "rgba(190,150,105," + (0.05 + rnd() * 0.1) + ")";
        g.lineWidth = 1 + rnd() * 3; g.beginPath();
        for (let x = 0; x <= cw; x += 16) { const y = y0 + Math.sin(x * f + ph0) * amp + Math.sin(x * f * 3.1 + ph0) * amp * 0.3; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
      }
      for (let k = 0; k < 2; k++) {                       /* a knot or two */
        const kx = rnd() * cw, ky = p * ph + ph * (0.3 + rnd() * 0.4);
        for (let r = 26; r > 2; r -= 3) { g.strokeStyle = "rgba(55,32,15," + (0.12 + (26 - r) / 120) + ")"; g.lineWidth = 2; g.beginPath(); g.ellipse(kx, ky, r * 2.2, r * 0.8, 0, 0, Math.PI * 2); g.stroke(); }
      }
      g.fillStyle = "rgba(30,18,8,0.75)"; g.fillRect(0, p * ph, cw, 3);   /* the seam between planks */
    }
  }, { repeat: true });
}
export function concreteTex() {
  return canvasTex("concrete", 1024, 1024, function (g, cw, ch) {
    g.fillStyle = "rgb(178,174,166)"; g.fillRect(0, 0, cw, ch);
    let s = 99; const rnd = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let k = 0; k < 26000; k++) { const v = 120 + rnd() * 110; g.fillStyle = "rgba(" + v + "," + (v - 3) + "," + (v - 8) + "," + (0.12 + rnd() * 0.25) + ")"; g.fillRect(rnd() * cw, rnd() * ch, 1 + rnd() * 3, 1 + rnd() * 3); }
    for (let k = 0; k < 40; k++) { g.fillStyle = "rgba(70,68,64," + (0.15 + rnd() * 0.3) + ")"; g.beginPath(); g.arc(rnd() * cw, rnd() * ch, 1 + rnd() * 3, 0, Math.PI * 2); g.fill(); }
  }, { repeat: true });
}
/* a suspended ceiling's mineral-fibre tile from below, as in the owner's photo of the ceiling dome (26 October 2026): off-white, its
   fissures (short wandering grooves) and pinholes, faintly mottled. One tile per repeat */
export function ceilingTileTex() {
  return canvasTex("ceilingTile", 1024, 1024, function (g, cw, ch) {
    g.fillStyle = "rgb(236,235,229)"; g.fillRect(0, 0, cw, ch);
    let s = 4242; const rnd = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let k = 0; k < 60; k++) { const r = 40 + rnd() * 120, v = rnd() > 0.5 ? 255 : 200; g.fillStyle = "rgba(" + v + "," + v + "," + (v - 6) + ",0.05)"; g.beginPath(); g.arc(rnd() * cw, rnd() * ch, r, 0, Math.PI * 2); g.fill(); }
    for (let k = 0; k < 5200; k++) {                      /* fissures: fine short wandering grooves, a few millimetres long */
      let x = rnd() * cw, y = rnd() * ch, a = rnd() * 6.28; const n = 2 + Math.floor(rnd() * 4);
      g.strokeStyle = "rgba(150,147,138," + (0.16 + rnd() * 0.22) + ")"; g.lineWidth = 0.7 + rnd() * 0.6; g.beginPath(); g.moveTo(x, y);
      for (let i = 0; i < n; i++) { a += (rnd() - 0.5) * 1.8; x += Math.cos(a) * (1.4 + rnd() * 2.2); y += Math.sin(a) * (1.4 + rnd() * 2.2); g.lineTo(x, y); }
      g.stroke();
    }
    for (let k = 0; k < 9000; k++) { g.fillStyle = "rgba(128,125,118," + (0.18 + rnd() * 0.3) + ")"; g.beginPath(); g.arc(rnd() * cw, rnd() * ch, 0.4 + rnd() * 0.7, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = "rgba(170,168,160,0.9)"; g.lineWidth = 6; g.strokeRect(3, 3, cw - 6, ch - 6);   /* the tile's bevelled edge */
  }, { repeat: true });
}
/* painted concrete, as the wall behind the owner's photo of the wall dome: a warm off-white over beige, mottled where the paint is
   thin, small pits, a hairline crack or two, a faint stain run down from above */
export function paintedConcreteTex() {
  return canvasTex("paintedConcrete", 1024, 1024, function (g, cw, ch) {
    g.fillStyle = "rgb(204,193,172)"; g.fillRect(0, 0, cw, ch);
    let s = 7171; const rnd = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let k = 0; k < 320; k++) {                       /* mottling: soft-edged patches, darker where the paint is thin */
      const r = 20 + rnd() * 120, d = rnd() > 0.5, x = rnd() * cw, y = rnd() * ch, c = d ? "160,146,120" : "228,220,202", al = d ? 0.1 + rnd() * 0.14 : 0.12 + rnd() * 0.18;
      const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, "rgba(" + c + "," + al + ")"); rg.addColorStop(1, "rgba(" + c + ",0)");
      g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    for (let k = 0; k < 30000; k++) { const v = 150 + rnd() * 90; g.fillStyle = "rgba(" + v + "," + (v - 6) + "," + (v - 18) + "," + (0.06 + rnd() * 0.12) + ")"; g.fillRect(rnd() * cw, rnd() * ch, 1 + rnd() * 2, 1 + rnd() * 2); }
    for (let k = 0; k < 160; k++) { g.fillStyle = "rgba(96,88,74," + (0.25 + rnd() * 0.35) + ")"; g.beginPath(); g.arc(rnd() * cw, rnd() * ch, 0.8 + rnd() * 2.6, 0, Math.PI * 2); g.fill(); }
    for (let c = 0; c < 3; c++) { let x = rnd() * cw, y = rnd() * ch * 0.3, a = 1.2 + rnd() * 0.7; g.strokeStyle = "rgba(96,88,74,0.6)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 60; i++) { a += (rnd() - 0.5) * 0.5; x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y); } g.stroke(); }
    for (let k = 0; k < 6; k++) { const x = rnd() * cw, w = 6 + rnd() * 16, grd = g.createLinearGradient(0, 0, 0, ch * (0.4 + rnd() * 0.5)); grd.addColorStop(0, "rgba(140,126,98,0.2)"); grd.addColorStop(1, "rgba(140,126,98,0)"); g.fillStyle = grd; g.fillRect(x, 0, w, ch); }
  }, { repeat: true });
}
