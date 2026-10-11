/* The live 3D model in a device's Physical tab. Loaded only when a
   Physical tab first opens. One canvas is shared: it moves into whichever
   Physical tab is showing, so the page never holds more than one WebGL
   context. The model is the approved one (assets/models), built fresh and
   then set to what the simulation says (js/net/physical.js): plugs in,
   out or loose, lights lit, dark, amber or blinking, a split or crushed
   cable, the real addresses on its screen. It only draws while something
   changes (turning it, a light blinking), then once more with ambient
   occlusion when it settles. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import * as SURF from "../../assets/models/surface.js";
import * as GEAR from "../../assets/models/home-gear.js";
import * as END from "../../assets/models/endpoints.js";
import { cableFrom } from "../../assets/models/cables.js";
import { setLed, COL } from "../../assets/models/parts.js";
import { stateKey } from "../net/physical.js";

/* how each model is built and first seen (as in the approved previews), and the named views offered */
const SETUP = {
  modem: { build: function () { return GEAR.cableModem(); }, view: [0.95, 0.42, -1.0], light: [0.6, 1.3, -1.0], frame: [-60, 0, -110, 60, 180, 90],
    views: [["Back ports", { view: [0.95, 0.22, -0.75], frame: [-30, 28, -112, 30, 128, -70], light: [0.6, 1.2, -0.8] }], ["Front lights", { view: [0.25, 0.1, 1], frame: [-27, 68, 70, 27, 128, 82], light: [0.5, 1.2, 1.0] }]] },
  router: { build: function (o) { return GEAR.homeRouter({ wan: o.wan, lans: o.lans }); }, view: [0.3, 0.32, -1], light: [0.5, 1.3, -1.0], frame: [-150, 0, -200, 150, 230, 90],
    views: [["Back ports", { focus: "panel:Back ports", view: [0, 0.18, -1], light: [0.3, 1.2, -1.0] }], ["Top lights", { view: [0, 1, 0.55], frame: [-85, 40, 42, 85, 56, 82], light: [0.3, 1.3, 0.6] }]] },
  switch: { build: function (o) { return GEAR.unmanagedSwitch({ plugged: o.plugged }); }, view: [0.6, 0.4, 1], light: [0.6, 1.3, 0.9], frame: [-90, 0, -55, 80, 40, 120],
    views: [["Ports close-up", { view: [0.12, 0.22, 1], frame: [-58, 2, 46, 62, 34, 58] }]] },
  mesh: { build: function (o) { return GEAR.meshNode(o.weak ? "weak" : undefined); }, view: [-0.75, 0.3, -1], light: [-0.6, 1.3, -0.9], frame: [-70, 0, -110, 70, 160, 70],
    views: [["Front light", { view: [0.5, 0.25, 1], light: [0.5, 1.2, 1.0] }]] },
  pc: { build: function () { return END.desktopPC(); }, view: [0.75, 0.42, -1.15], light: [0.6, 1.3, -1.0], frame: [-115, 0, -250, 115, 270, 195],
    views: [["Ports close-up", { focus: "panel:I/O plate", view: [0, 0.08, -1] }], ["Cable run", { view: [0.5, 0.8, -0.55], frame: [-45, 0, -450, 55, 30, -290] }]] },
  laptop: { build: function (o) { return END.laptop({ screen: o.screen }); }, view: [-1, 0.55, 0.85], light: [-0.7, 1.3, 0.9],
    views: [["Ports close-up", { focus: "panel:Left side ports", view: [-1, 0.25, 0.35] }], ["Screen", { view: [0.05, 0.3, 1], light: [0.3, 1.2, 1.0] }]] },
  printer: { build: function (o) { return END.networkPrinter({ screen: o.screen }); }, view: [-0.6, 0.45, -1], light: [-0.4, 1.2, -1.0],
    views: [["Back ports", { focus: "panel:Ports", view: [-0.35, 0.2, -1] }], ["Control panel", { focus: "panel:Control panel", view: [0.15, 0.75, 0.66], light: [0.3, 1.3, 1.0] }]] },
  tv: { build: function (o) { return END.smartTV({ screen: o.screen }); }, view: [-0.75, 0.32, -1], light: [-0.5, 1.2, -1.0],
    views: [["Ports close-up", { focus: "panel:Connection panel", view: [-0.25, 0.1, -1] }], ["Screen", { view: [0, 0.08, 1], light: [0.3, 1.0, 1.0] }]] },
  injector: { build: function (o) { return GEAR.poeInjector({ std: o.std }); }, view: [0.75, 0.6, 1], light: [0.6, 1.3, 0.9], frame: [-60, 0, -70, 60, 40, 90],
    views: [["Ports close-up", { focus: "panel:Ports", view: [0.15, 0.3, 1] }], ["Label and lights", { view: [0.05, 1, 0.25], frame: [-34, 30, -56, 34, 34, 58], light: [0.3, 1.3, 0.5] }], ["Power adapter", { view: [0.5, 0.35, -1], frame: [-30, 0, -100, 40, 34, -40], light: [0.4, 1.2, -1.0] }]] },
  camera: { build: function (o) { return END.ipCamera({ ipLine: o.ipLine, poe: o.poe }); }, stage: "concrete", view: [1, 0.5, 0.75], light: [0.7, 1.3, 0.9], frame: [-70, 0, -70, 125, 112, 125],
    views: [["Port close-up", { focus: "panel:PoE port", view: [0.91, 0.3, 0.41] }]] }
};
const DAMAGE = { split: { split: { at: 64, len: 16 } }, crushed: { crush: [-196, -140] } };   /* the crushed stretch where the run meets the floor behind the desk */
const V3 = function (x, y, z) { return new THREE.Vector3(x, y, z); };
const reduced = function () { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; };

let V = null;
/* the one renderer, scene and camera, made on first use (throws if WebGL isn't available) */
function viewer() {
  if (V) return V;
  const canvas = document.createElement("canvas");
  canvas.className = "m3d-canvas"; canvas.tabIndex = 0;
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xd8d5cf);
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  /* a warm key light with soft shadows, a cool fill from behind */
  const key = new THREE.DirectionalLight(0xfff3e4, 2.3); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xe6eeff, 0.7); fill.position.set(-1.2, 1, -1.6); scene.add(fill);
  const camera = new THREE.PerspectiveCamera(35, 4 / 3, 0.5, 5000);
  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.listenToKeyEvents(canvas);
  /* the bench under the gear: wood (concrete for the camera), fading out at its edges */
  const fade = (function () { const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
    const gr = g.createRadialGradient(256, 256, 60, 256, 256, 256); gr.addColorStop(0, "#fff"); gr.addColorStop(0.55, "#fff"); gr.addColorStop(1, "#000");
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; })();
  const stages = { wood: SURF.woodTex(), concrete: SURF.concreteTex() };
  const stageMat = SURF.grain(new THREE.MeshStandardMaterial({ map: stages.wood, alphaMap: fade, transparent: true, roughness: 0.62, depthWrite: true, envMapIntensity: 0.5 }), { grain: 0.12, scale: 0.6 });
  const stage = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), stageMat); stage.rotation.x = -Math.PI / 2; stage.receiveShadow = true; scene.add(stage);
  /* ambient occlusion for the settled frame; print and clear plastic left out of it */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 640, 480); gtao.blendIntensity = 1.0; composer.addPass(gtao);
  gtao.overrideVisibility = function () {
    const cache = this._visibilityCache;
    this.scene.traverse(function (o) { cache.set(o, o.visible); if (o.isPoints || o.isLine || o.userData.print || (o.material && o.material.userData && o.material.userData.clear)) o.visible = false; });
  };
  /* LED glows drawn after the shading, only where the LED faces the camera with nothing in front of it */
  const glowCam = new THREE.PerspectiveCamera(), glowPass = new RenderPass(scene, glowCam); glowPass.clear = false; composer.addPass(glowPass);
  const glowRender = glowPass.render.bind(glowPass);
  glowPass.render = function () { const bg = scene.background; scene.background = null; glowRender.apply(null, arguments); scene.background = bg; };
  composer.addPass(new OutputPass());
  V = { canvas: canvas, renderer: renderer, scene: scene, camera: camera, controls: controls, composer: composer, gtao: gtao, glowCam: glowCam, key: key, stage: stage, stageMat: stageMat, stages: stages,
    model: null, id: null, skey: "", setup: null, halos: [], blink: [], blinkOn: true, dirty: true, fine: false, last: 0, running: false, frames: 0, fineFrames: 0, radius: 100 };
  controls.addEventListener("change", function () { V.dirty = true; });
  if (window.ResizeObserver) new ResizeObserver(function () { size(); }).observe(canvas);
  return V;
}

function size() {
  const w = V.canvas.clientWidth, h = V.canvas.clientHeight; if (!w || !h) return;
  V.renderer.setSize(w, h, false); V.composer.setPixelRatio(V.renderer.getPixelRatio()); V.composer.setSize(w, h);
  V.camera.aspect = w / h; V.camera.updateProjectionMatrix(); V.dirty = true;
}

/* ---------------------------------------------------------------- the model, set to the simulation */
function paint(l, color, on) {
  if (color != null) { l.userData.color = color; l.children.forEach(function (c) { if (c.userData.halo) c.material.color.set(color); }); }
  setLed(l, on);
}
function jackLeds(jack, lights) {
  jack.children.forEach(function (c) {
    if (c.userData.kind !== "led") return;
    const on = lights !== "off";
    if (lights === "amber") paint(c, COL.ledAmber, true); else paint(c, null, on);
  });
}
/* lay a plug's cable again from where the plug now is, with any damage */
function relay(plug, extra) {
  const run = plug.userData.runMesh; if (!run || !run.parent) return;
  const root = run.parent, R = run.userData.run;
  root.remove(run); dispose(run);
  root.updateMatrixWorld(true);
  cableFrom(root, plug, R.pts, Object.assign({}, R.o, extra || {}));
}
function removePlug(plug) {
  const run = plug.userData.runMesh;
  if (run && run.parent) { run.parent.remove(run); dispose(run); }
  plug.parent.remove(plug); dispose(plug);
}
/* out of the port and hanging on its cable: 30 mm out along the port's axis, dropped (never
   through the bench), the cable end down and the nose up, so the cable falls away below it */
function pullOut(jack, plug, extra) {
  plug.position.z += 30;
  jack.updateMatrixWorld(true);
  const w0 = jack.localToWorld(V3(0, 0, 0)), drop = Math.min(14, Math.max(0, w0.y - 7));
  const down = jack.worldToLocal(w0.clone().add(V3(0, -drop, 0))).sub(jack.worldToLocal(w0.clone()));
  plug.position.add(down);
  const axis = V3(0, 0, 1).cross(jack.worldToLocal(w0.clone().add(V3(0, -1, 0))).sub(jack.worldToLocal(w0.clone())).normalize());
  if (axis.lengthSq() > 0.25) plug.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis.normalize(), w0.y > 40 ? 0.7 : 0.2));
  relay(plug, extra);
}
/* a coax connector backed off its thread: out 9 mm, drooping on its cable, the barrel's thread showing */
function loosen(plug) { plug.position.z += 9; plug.rotation.x += 0.22; relay(plug); }
function closeJaw(jack) { jack.children.forEach(function (c) { if (c.isGroup && !c.name && Math.abs(c.rotation.x - 0.5) < 1e-6) c.rotation.x = 0; }); }

function build(S) {
  const B = SETUP[S.model], g = B.build(S.opts || {});
  g.updateMatrixWorld(true);
  g.traverse(function (o) { if (/^plug:/.test(o.name)) o.userData.home = o.position.clone(); });   /* where each plug was moulded in: the checks measure from here */
  S.ports.forEach(function (p) {
    const jack = g.getObjectByName("port:" + p.name); if (!jack) return;
    const plug = jack.children.find(function (c) { return /^plug:/.test(c.name); });
    if (p.coax) { if (p.plug === "loose" && plug) loosen(plug); return; }
    if (p.plug === "none") { if (plug) removePlug(plug); closeJaw(jack); }
    else if (p.plug === "out") { if (plug) pullOut(jack, plug, p.damage && DAMAGE[p.damage]); }
    else if (plug && p.damage) relay(plug, DAMAGE[p.damage]);
    if (p.lights) jackLeds(jack, p.lights);
  });
  const blink = [];
  S.leds.forEach(function (l) {
    g.traverse(function (o) {
      if (o.userData.kind !== "led" || o.userData.role !== l.role) return;
      const color = l.color === "amber" ? COL.ledAmber : l.color === "blue" ? COL.ledBlue : l.role === "attention" ? null : o.userData.color;
      paint(o, color, l.state !== "off");
      if (l.state === "blinking") blink.push(o);
    });
  });
  return { g: g, blink: blink };
}
function dispose(o) {
  o.traverse(function (x) {
    if (x.geometry) x.geometry.dispose();
    if (x.userData && x.userData.print && x.material) { if (x.material.map) x.material.map.dispose(); x.material.dispose(); }
  });
}

function setModel(S) {
  if (V.model) { V.scene.remove(V.model); dispose(V.model); }
  const B = SETUP[S.model], made = build(S), g = made.g;
  V.model = g; V.setup = B; V.blink = made.blink; V.blinkOn = true;
  V.scene.add(g);
  V.halos = []; g.traverse(function (o) { if (o.userData.halo) V.halos.push(o); });
  g.traverse(function (o) { if (!o.isMesh) return; const mt = o.material; o.receiveShadow = true;
    o.castShadow = !(o.userData.print || (mt && mt.userData && mt.userData.clear) || (mt && mt.transparent && (mt.opacity < 0.6 || !mt.alphaTest))); if (mt && mt.alphaTest) o.castShadow = true; });
  const b = new THREE.Box3().setFromObject(g), s = new THREE.Sphere(); b.getBoundingSphere(s);
  V.box = b; V.sphere = s; V.radius = s.radius;
  const st = B.stage || "wood", S2 = s.radius * 7;
  V.stage.scale.set(S2, S2, 1); V.stage.position.set(s.center.x, b.min.y - 0.02, s.center.z);
  V.stageMat.map = V.stages[st]; V.stageMat.map.repeat.set(S2 / (st === "concrete" ? 600 : 900), S2 / (st === "concrete" ? 600 : 900)); V.stageMat.needsUpdate = true;
  V.gtao.updateGtaoMaterial({ radius: Math.max(0.6, s.radius * 0.07), distanceExponent: 1.6, thickness: Math.max(0.5, s.radius * 0.05), scale: 1.0, samples: 16 });
  V.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  light(B.light);
}
function light(dir) {
  const s = V.sphere, kd = V3().fromArray(dir || [0.55, 1.25, 0.8]).normalize();
  V.key.position.copy(s.center).addScaledVector(kd, s.radius * 4); V.key.target.position.copy(s.center);
  const sc = V.key.shadow.camera, ext = s.radius * 2.2; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = s.radius * 0.5; sc.far = s.radius * 9; sc.updateProjectionMatrix();
  V.key.shadow.bias = -0.0003; V.key.shadow.normalBias = s.radius * 0.0015;
}
/* frame a view: the box to fit, the direction to look from */
function look(spec) {
  const B = V.setup; spec = spec || B;
  let box = spec.frame ? new THREE.Box3(V3().fromArray(spec.frame.slice(0, 3)), V3().fromArray(spec.frame.slice(3))) : V.box.clone();
  if (spec.focus) { const f = V.model.getObjectByName(spec.focus); if (f) { V.model.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(f); box.expandByScalar(4); } }
  light(spec.light || B.light);
  const d = V3().fromArray(spec.view || B.view).normalize(), c = box.getCenter(V3()), cam = V.camera, corners = [];
  for (let k = 0; k < 8; k++) corners.push(V3(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z));
  let dist = V.radius * 4;
  for (let it = 0; it < 6; it++) {
    cam.position.copy(c).addScaledVector(d, dist); cam.near = dist / 60; cam.far = dist * 30; cam.up.set(0, 1, 0);
    cam.lookAt(c); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    let m = 0; corners.forEach(function (p) { const q = p.clone().project(cam); m = Math.max(m, Math.abs(q.x), Math.abs(q.y)); });
    dist *= m / 0.82;
  }
  cam.position.copy(c).addScaledVector(d, dist); cam.updateProjectionMatrix();
  V.controls.target.copy(c); V.controls.minDistance = V.radius * 0.08; V.controls.maxDistance = V.radius * 12; V.controls.update(); V.dirty = true;
}

/* ---------------------------------------------------------------- drawing */
function glows() {
  V.glowCam.copy(V.camera); V.glowCam.layers.set(1);
  if (!V.model) return;
  const solid = []; V.model.traverse(function (o) { if (o.isMesh && !o.userData.print && o.visible && !(o.material && o.material.userData && o.material.userData.clear)) solid.push(o); });
  const P = V3(), N = V3(), Q = new THREE.Quaternion(), ray = new THREE.Raycaster(), cam = V.camera;
  V.halos.forEach(function (h) {
    if (!h.parent.userData.on) { h.visible = false; return; }
    h.getWorldPosition(P); h.parent.getWorldQuaternion(Q); N.set(0, 0, 1).applyQuaternion(Q);
    const to = cam.position.clone().sub(P), dist = to.length(); to.normalize();
    if (N.dot(to) < 0.08) { h.visible = false; return; }
    ray.set(cam.position, P.clone().sub(cam.position).normalize()); ray.far = dist - 0.3;
    h.visible = ray.intersectObjects(solid, false).length === 0;
  });
}
function draw(fine) { V.gtao.enabled = !!fine; glows(); V.composer.render(); V.frames++; if (fine) V.fineFrames++; }
function loop() {
  if (!V.canvas.isConnected) { V.running = false; return; }
  V.controls.update();
  const now = performance.now();
  if (V.blink.length) {
    const on = reduced() ? true : Math.floor(now / 500) % 2 === 0;   /* about once a second; steady for anyone who asks for less motion */
    if (on !== V.blinkOn) { V.blinkOn = on; V.blink.forEach(function (l) { setLed(l, on); }); if (!V.dirty) draw(V.fine); }
  }
  if (V.dirty) { V.dirty = false; V.fine = false; V.last = now; draw(false); }
  else if (!V.fine && now - V.last > 280) { V.fine = true; draw(true); }
  requestAnimationFrame(loop);
}

/* put the model for this device, in this state, into `holder`; returns the controls the page offers */
export function mount(holder, S) {
  viewer();
  holder.appendChild(V.canvas);
  V.canvas.setAttribute("role", "img");
  V.canvas.setAttribute("aria-label", "3D model of the " + S.label + ". Drag to turn it; the list below says what it shows.");
  const k = stateKey(S);
  if (V.id !== S.id || !V.model) { V.id = S.id; V.skey = k; setModel(S); size(); look(); }
  else if (V.skey !== k) {   /* the same device, changed: keep the student's view */
    const p = V.camera.position.clone(), t = V.controls.target.clone();
    V.skey = k; setModel(S); V.camera.position.copy(p); V.controls.target.copy(t); V.controls.update();
  }
  size(); V.dirty = true;
  if (!V.running) { V.running = true; requestAnimationFrame(loop); }
  return {
    views: V.setup.views.map(function (v) { return v[0]; }),
    look: function (name) { const v = V.setup.views.find(function (x) { return x[0] === name; }); look(v ? Object.assign({}, v[1]) : null); },
    reset: function () { look(); },
    turn: function (deg) { const c = V.controls, off = V.camera.position.clone().sub(c.target); off.applyAxisAngle(V3(0, 1, 0), deg * Math.PI / 180); V.camera.position.copy(c.target).add(off); c.update(); V.dirty = true; },
    zoom: function (f) { const c = V.controls, off = V.camera.position.clone().sub(c.target).multiplyScalar(f); if (off.length() < c.minDistance || off.length() > c.maxDistance) return; V.camera.position.copy(c.target).add(off); c.update(); V.dirty = true; }
  };
}
/* a new ticket: frame the next model afresh */
export function forget() { if (V) { V.id = null; V.skey = ""; } }
/* for the checks: what was drawn, and the model itself */
export function debug() { return V ? { frames: V.frames, fineFrames: V.fineFrames, id: V.id, model: V.model, blink: V.blink.length, camera: V.camera, controls: V.controls, render: function () { draw(true); } } : null; }
