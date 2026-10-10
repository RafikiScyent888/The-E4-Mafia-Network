/* The model preview page: pick a model, turn it, read what it is built
   from. window.__preview lets a script take the renders for the owner. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import * as SURF from "../assets/models/surface.js";
import * as GEAR from "../assets/models/home-gear.js";
import * as CAB from "../assets/models/cables.js";
import * as END from "../assets/models/endpoints.js";

const MODELS = [
  { id: "modem", group: "Network gear", name: "Cable modem", build: GEAR.cableModem,
    photo: "From your photo of the cable modem, front and back.",
    shows: ["Front: POWER, DS, US, ONLINE (blue) and LINK/ACT lights", "Back: CABLE IN (F-type), ETHERNET, RESET pinhole, POWER 12V", "The label, with the serial and MAC address covered", "Side vents and its stand"] },
  { id: "ont", group: "Network gear", name: "Fiber ONT", build: GEAR.fiberOnt,
    photo: "From your photo of the fiber ONT home terminal.",
    shows: ["Front: POWER, PON, ALARM (off), LINK/ACT and ETHERNET lights", "Underneath: the green SC/APC FIBER PORT, ETHERNET and 12V DC", "Side vents and the serial label"],
    standards: ["Green on a fiber connector means APC (angle-polished): it must only ever mate with green"] },
  { id: "router", group: "Network gear", name: "Home wireless router", build: GEAR.homeRouter,
    photo: "From your photo of the router's back panel.",
    shows: ["Back, left to right: INTERNET (yellow), LAN 1-4, RESET, WPS, POWER, ON/OFF", "Four hinged antennas", "Status lights along the top front edge", "The label underneath, default Wi-Fi details covered"] },
  { id: "switch", group: "Network gear", name: "5-port unmanaged switch", build: GEAR.unmanagedSwitch,
    photo: "From your photo of the two stacked 5-port switches.",
    shows: ["Front: POWER light and ports 1-5, each with link and activity lights", "Back: DC 5V in", "Metal case, side vents, rubber feet"] },
  { id: "mesh", group: "Network gear", name: "Mesh Wi-Fi node", build: function () { return GEAR.meshNode(); },
    photo: "From your photo of the mesh nodes, with its callouts.",
    shows: ["Front: the status light (green good; amber when the link to the next node is weak)", "Back plate: WAN, LAN and 12V DC IN", "Cooling vents round the top, side vents, RESET on the side", "The label underneath"] },
  { id: "mesh-weak", group: "Network gear", name: "Mesh node, weak link (amber)", build: function () { return GEAR.meshNode("weak"); },
    photo: "The same node with its status light amber, as in your photo's distant node.",
    shows: ["Amber status: placed too far from the next node"] },
  { id: "rj45b", pointAway: true, frame: [-7, -6, -24, 7, 6, 12], group: "Cables and connectors", name: "RJ45, straight-through (T568B)", build: function () { return CAB.rj45Plug({ standard: "T568B" }); },
    photo: "From your photo of the straight-through and crossover ends.",
    shows: ["Pin 1 to 8: white/orange, orange, white/green, blue, white/blue, green, white/brown, brown", "The jacket held inside the plug by the strain relief", "Eight gold contacts, the clip underneath"],
    standards: ["Wire order exactly as TIA-568 T568B, not the photo's pixels"] },
  { id: "rj45a", pointAway: true, frame: [-7, -6, -24, 7, 6, 12], group: "Cables and connectors", name: "RJ45, crossover end (T568A)", build: function () { return CAB.rj45Plug({ standard: "T568A" }); },
    photo: "From the same photo: the crossover cable's T568A end.",
    shows: ["Pin 1 to 8: white/green, green, white/orange, blue, white/blue, orange, white/brown, brown", "A crossover is T568A on one end and T568B on the other"],
    standards: ["Wire order exactly as TIA-568 T568A"] },
  { id: "rj45bad", pointAway: true, frame: [-7, -6, -34, 7, 6, 12], group: "Cables and connectors", name: "RJ45, bad termination", build: function () { return CAB.rj45Plug({ standard: "T568B", termination: "bad" }); },
    photo: "From your photo: jacket out, too much untwist.",
    shows: ["The jacket stops well outside the plug, so the strain relief grips bare wires", "The pairs untwisted far too far: crosstalk, and the wires pull out"] },
  { id: "damaged", frame: [-30, -6, -8, 60, 22, 8], group: "Cables and connectors", name: "Damaged cable", build: CAB.damagedCable,
    photo: "From your photo: kinked and crushed.",
    shows: ["A hard kink, a crushed flat section, and the jacket torn with the pairs showing", "A run like this fails the cable tester"] },
  { id: "rj11", pointAway: true, frame: [-6, -5, -18, 6, 5, 8], group: "Cables and connectors", name: "RJ11 (phone)", build: function () { return CAB.rj11Plug({ lines: 2 }); },
    photo: "From your photos of RJ11 beside RJ45.",
    shows: ["Six positions, four wires: black, red, green, yellow (two phone lines)", "Smaller than RJ45, on flat grey cable"],
    standards: ["RJ11 is a 6-position plug: 2 wires for one line, 4 for two. Your photo's “4-pin” label is a common mistake, not used here."] },
  { id: "pair", pointAway: true, frame: [-16, -6, -22, 17, 6, 12], group: "Cables and connectors", name: "RJ11 beside RJ45", build: function () { const g = new THREE.Group(); const a = CAB.rj11Plug({ lines: 2 }); a.position.x = -10; const b = CAB.rj45Plug({ standard: "T568B" }); b.position.x = 10; g.add(a, b); return g; },
    photo: "As in your photos: the two side by side for size.",
    shows: ["RJ11: 6 positions, 9.6 mm wide", "RJ45: 8 positions, 11.7 mm wide"] },
  { id: "coax", frame: [-7, -7, -18, 7, 7, 13], group: "Cables and connectors", name: "Coax, F-type connector", build: CAB.coaxF,
    photo: "From your photo of the coax F-connector.",
    shows: ["A compression F-type on RG6: sleeve, body, 7/16-inch hex nut", "The copper centre conductor standing just proud of the nut"],
    standards: ["A male F-type's nut is threaded on the INSIDE (it screws onto the modem's threaded barrel). Your photo shows threads outside; the model follows the real connector."] },
  { id: "pc", view: "back3", light: [0.6, 1.3, -1.0], frame: [-115, 0, -250, 115, 270, 195], group: "Devices on the network", name: "Desktop PC", build: END.desktopPC,
    photo: "From your photo of the desktop PC's back, cables plugged in as photographed.",
    shows: ["The brushed I/O plate with every port standing on end, as in a tower: Wi-Fi antenna connectors, DP (x2), HDMI, USB 3.2 (x4), USB-C, USB 2.0, LAN, and six audio jacks", "The Ethernet cable plugged in, link light on, running down to the bench", "The fan behind its wire guard, VENTILATION printed above and beside it", "MADE IN TAIWAN and the MAC sticker with its barcode", "The PSU's honeycomb face, its I/O switch, the mains cord plugged in, PSU (1000W) printed beside it", "The model label PC MODEL: XTR-5800 with its regulatory marks; serial and MAC covered"],
    standards: ["The I/O plate is the ATX size (158.75 x 44.45 mm)", "The top of the plate is cut off in your photo: the model puts the Wi-Fi antenna connectors there, as on boards with built-in Wi-Fi. Say if you'd rather it plain.", "Audio jacks in the standard colours and order (C/SUB orange, REAR black, SIDE grey; IN blue, OUT green, MIC pink)"] },
  { id: "pc-io", focus: "panel:I/O plate", view: "back", light: [0.6, 1.3, -1.0], group: "Devices on the network", name: "Desktop PC, I/O plate close-up", build: END.desktopPC,
    photo: "The same PC, close in on the ports.",
    shows: ["LAN: green link light on, amber activity light on: the cable is plugged in and passing traffic", "Each port labelled the way students will be asked for it"] },
  { id: "laptop", view: [-1, 0.55, 0.85], light: [-0.7, 1.3, 0.9], group: "Devices on the network", name: "Laptop", build: END.laptop,
    photo: "From your photo of the laptop's Ethernet side.",
    shows: ["Bead-blasted aluminium with a polished, diamond-cut edge", "Left side, from the hinge: the drop-jaw ETHERNET port open round a grey patch cable (link and activity lights on), two blue SS USB-A in black frames, USB-C, AUDIO, each labelled above, then the vents", "A full keyboard with its legends, the glass trackpad", "On screen: Command Prompt, ipconfig exactly as Windows prints it"] },
  { id: "laptop-ports", focus: "panel:Left side ports", view: [-1, 0.25, 0.35], light: [-0.7, 1.3, 0.9], group: "Devices on the network", name: "Laptop, port side close-up", build: END.laptop,
    photo: "The same laptop, close in on its left side.",
    shows: ["The drop-jaw: the bottom of the port hinges down so a full-size RJ45 fits a thin laptop"] },
  { id: "printer", light: [0.6, 1.3, 0.9], group: "Devices on the network", name: "Network printer", build: END.networkPrinter,
    photo: "From your photos of the network printer: its control panel and its back.",
    shows: ["Two-tone, as photographed: charcoal top cover, light grey body", "The control panel on the cover's sloped front: CONTROL PANEL, NP-1000 SERIES, the amber light, the colour screen, POWER lit green, CANCEL, the arrow pad with OK, STATUS", "Top output tray with its paper stop; the paper cassette below", "Back: NETWORK in its printed box with LINK / ACT, the patch cable plugged in; USB (B); SERIAL; the mains inlet, switch and cord", "The label with barcode and regulatory marks, serial and MAC covered"],
    standards: ["The screen's wording is corrected from the photo: STATUS: ONLINE (192.168.1.100), then IP ADDRESS 192.168.1.100"] },
  { id: "printer-panel", focus: "panel:Control panel", view: [0.15, 0.75, 0.66], light: [0.3, 1.3, 1.0], group: "Devices on the network", name: "Printer, control panel close-up", build: END.networkPrinter,
    photo: "The same printer, close in on its screen.",
    shows: ["Where a technician reads a printer's IP address without a computer"] },
  { id: "printer-back", focus: "panel:Ports", view: [-0.35, 0.2, -1], light: [-0.4, 1.2, -1.0], group: "Devices on the network", name: "Printer, back ports close-up", build: END.networkPrinter,
    photo: "From your photo of the printer's back.",
    shows: ["NETWORK in its printed box: green link light, amber activity light, the patch cable plugged in", "USB (B) and SERIAL beside it: the older ways to connect a printer"] },
  { id: "tv", view: [-0.75, 0.32, -1], light: [-0.5, 1.2, -1.0], group: "Devices on the network", name: "Smart TV", build: END.smartTV,
    photo: "From your photo of the smart TV's rear panel.",
    shows: ["The silver-grey back with the deep port bay, its rim rounded", "On the black strip: HDMI 1-4 standing on end, two USB, LAN with the Ethernet cable plugged in, the AV jacks, ANT/CABLE IN, DC IN", "Beside them, in printed boxes: HDMI 1 (ARC/eARC) to HDMI 4, USB (5V 0.5A), USB (HDD), OPTICAL DIGITAL AUDIO OUT, AV IN (COMPOSITE/AUDIO), ANTENNA / CABLE IN, DC IN", "ETHERNET and the network icon outside the bay, the label with barcode, VESA mounts, speaker grilles", "From the front: the screen on its network status page"],
    standards: ["Composite AV in is three jacks (red, white, yellow); your photo shows two. ANT/CABLE IN is the same F-type as the modem's CABLE IN."] },
  { id: "tv-panel", focus: "panel:Connection panel", view: [-0.25, 0.1, -1], light: [-0.4, 1.2, -1.0], group: "Devices on the network", name: "Smart TV, connection panel close-up", build: END.smartTV,
    photo: "The same TV, close in on its connection panel.",
    shows: ["LAN with link and activity lights: a wired TV is one less device fighting for Wi-Fi"] },
  { id: "camera", stage: "concrete", view: [1, 0.5, 0.75], light: [0.7, 1.3, 0.9], frame: [-70, 0, -70, 125, 112, 125], group: "Devices on the network", name: "PoE IP camera", build: END.ipCamera,
    photo: "From your photo of the PoE IP camera, on concrete as photographed.",
    shows: ["The white base and grey foot, the black lens looking out of the round opening in the white shroud", "The label printed on the base (MODEL: IPC-6000D, MAC covered, IP: 192.168.1.50) and its barcode, the screw beside it", "The port pocket cut into the base: the cable gland with its cable, the gigabit PoE port (lights on) with the patch cable plugged in, (Data + Power) and Gigabit IP Camera Port · 10/100/1000 printed above", "The rubber weather cap, pulled off and lying beside it"],
    standards: ["Printed beside the port: PoE 802.3af, the standard a PoE camera uses (your photo's “Passive PoE” is a non-standard kind)"] },
  { id: "camera-port", stage: "concrete", focus: "panel:PoE port", view: [0.91, 0.3, 0.41], light: [0.7, 1.3, 0.9], group: "Devices on the network", name: "IP camera, PoE port close-up", build: END.ipCamera,
    photo: "The same camera, close in on its port.",
    shows: ["One RJ45 for both data and power: no power brick at the camera"] },
  { id: "wallplate", stage: "none", view: [0.18, 0.06, 1], light: [-0.5, 0.9, 1.1], frame: [-62, -85, 0, 95, 70, 50], group: "Devices on the network", name: "Data/voice wall plate", build: END.wallPlate,
    photo: "From your photo of the data/voice wall plate.",
    shows: ["NETWORKING PORT; the yellow ETHERNET keystone with a yellow patch cable (green boot) plugged in", "The grey TELEPHONE keystone with the phone cord plugged in", "DATA / VOICE, the printed boxes round each jack, two screws"],
    standards: ["Single-gang plate, its screws 83.3 mm apart as the standard sets them", "An RJ11 plug fits an RJ45 jack but not the other way round: the jacks are drawn at their real sizes"] },
  { id: "wallplate-empty", stage: "none", view: [0.1, 0.05, 1], light: [-0.5, 0.9, 1.1], frame: [-45, -65, 0, 45, 65, 10], group: "Devices on the network", name: "Wall plate, nothing plugged in", build: function () { return END.wallPlate({ plugged: false }); },
    photo: "The same plate with the cables out, to see the jacks.",
    shows: ["Eight gold contacts in the Ethernet jack, four in the telephone jack (one or two lines)"] }
];

const canvas = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xd8d5cf);
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
/* a warm key light that casts soft shadows, and a cool fill from behind so backs aren't black */
const key = new THREE.DirectionalLight(0xfff3e4, 2.3); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0xe6eeff, 0.7); fill.position.set(-1.2, 1, -1.6); scene.add(fill);
const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 5000);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true;

/* what the gear sits on, as in the photographs: a wooden bench (or
   concrete for the camera), fading out softly at its edges */
const fade = (function () { const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
  const gr = g.createRadialGradient(256, 256, 60, 256, 256, 256); gr.addColorStop(0, "#fff"); gr.addColorStop(0.55, "#fff"); gr.addColorStop(1, "#000");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; })();
const STAGES = { wood: SURF.woodTex(), concrete: SURF.concreteTex() };
const stageMat = SURF.grain(new THREE.MeshStandardMaterial({ map: STAGES.wood, alphaMap: fade, transparent: true, roughness: 0.62, depthWrite: true, envMapIntensity: 0.5 }), { grain: 0.12, scale: 0.6 });
const stage = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), stageMat); stage.rotation.x = -Math.PI / 2; stage.receiveShadow = true; scene.add(stage);

/* ambient occlusion: the darkening in recesses, port openings and where things meet */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, 800, 600); gtao.blendIntensity = 1.0; composer.addPass(gtao);
composer.addPass(new OutputPass());
let dirty = true;

let current = null, curModel = null, radius = 100, center = new THREE.Vector3();
const VIEWS = { three: [1, 0.55, 1.15], back3: [0.75, 0.42, -1.15], front: [0, 0.08, 1], back: [0, 0.08, -1], left: [-1, 0.08, 0], right: [1, 0.08, 0], top: [0, 1, 0.001], bottom: [0, -1, 0.001] };
let frameBox = new THREE.Box3();
function look(v) {
  const d = new THREE.Vector3().fromArray(Array.isArray(v) ? v : (VIEWS[v] || VIEWS.three)).normalize();
  const c = frameBox.getCenter(new THREE.Vector3()), corners = [];
  for (let k = 0; k < 8; k++) corners.push(new THREE.Vector3(k & 1 ? frameBox.max.x : frameBox.min.x, k & 2 ? frameBox.max.y : frameBox.min.y, k & 4 ? frameBox.max.z : frameBox.min.z));
  let dist = radius * 4;
  for (let it = 0; it < 6; it++) {
    camera.position.copy(c).addScaledVector(d, dist); camera.near = dist / 60; camera.far = dist * 30;
    camera.up.set(0, 1, 0); if (Math.abs(d.y) > 0.99) camera.up.set(0, 0, (curModel && curModel.pointAway ? 1 : -1) * Math.sign(d.y));   /* plugs: pointing away, pin 1 on the left */
    camera.lookAt(c); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    let m = 0; corners.forEach(function (p) { const q = p.clone().project(camera); m = Math.max(m, Math.abs(q.x), Math.abs(q.y)); });
    dist *= m / 0.82;
  }
  camera.position.copy(c).addScaledVector(d, dist); camera.updateProjectionMatrix();
  controls.target.copy(c); controls.update(); dirty = true;
  document.querySelectorAll("[data-view]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.view === v)); });
}
function show(id, view) {
  const m = MODELS.find(function (x) { return x.id === id; }) || MODELS[0];
  if (current) { scene.remove(current); }
  current = m.build(); curModel = m; scene.add(current);
  /* everything solid casts a shadow; print and clear plastic don't */
  current.traverse(function (o) { if (!o.isMesh) return; const mt = o.material; o.receiveShadow = true;
    o.castShadow = !(o.userData.print || (mt && mt.transparent && (mt.opacity < 0.6 || !mt.alphaTest))); if (mt && mt.alphaTest) o.castShadow = true; });
  const b = new THREE.Box3().setFromObject(current), s = new THREE.Sphere(); b.getBoundingSphere(s); center.copy(s.center); radius = s.radius;
  /* the bench under it, the shadow camera round it, AO sized to it */
  const st = m.stage || "wood"; stage.visible = st !== "none";
  if (stage.visible) { const S = radius * 7; stage.scale.set(S, S, 1); stage.position.set(s.center.x, b.min.y - 0.02, s.center.z);
    stageMat.map = STAGES[st] || STAGES.wood; stageMat.map.repeat.set(S / (st === "concrete" ? 600 : 900), S / (st === "concrete" ? 600 : 900)); stageMat.needsUpdate = true; }
  const kd = new THREE.Vector3().fromArray(m.light || [0.55, 1.25, 0.8]).normalize();
  key.position.copy(s.center).addScaledVector(kd, radius * 4); key.target.position.copy(s.center);
  const sc = key.shadow.camera, ext = radius * 2.2; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = radius * 0.5; sc.far = radius * 9; sc.updateProjectionMatrix();
  key.shadow.bias = -0.0003; key.shadow.normalBias = radius * 0.0015;
  gtao.updateGtaoMaterial({ radius: Math.max(0.6, radius * 0.07), distanceExponent: 1.6, thickness: Math.max(0.5, radius * 0.05), scale: 1.0, samples: 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  frameBox = m.frame ? new THREE.Box3(new THREE.Vector3().fromArray(m.frame.slice(0, 3)), new THREE.Vector3().fromArray(m.frame.slice(3))) : b;
  if (m.focus) { const f = current.getObjectByName(m.focus); if (f) { current.updateMatrixWorld(true); frameBox = new THREE.Box3().setFromObject(f); frameBox.expandByScalar(4); } }   /* a close-up on one panel */
  document.getElementById("name").textContent = m.name;
  document.getElementById("photo").textContent = m.photo;
  const n = document.getElementById("notes"); n.innerHTML = "";
  const h = document.createElement("p"); h.innerHTML = "<strong>What it shows</strong>"; n.appendChild(h);
  const ul = document.createElement("ul"); m.shows.forEach(function (t) { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); }); n.appendChild(ul);
  if (m.standards) { const h2 = document.createElement("p"); h2.innerHTML = "<strong>Standards applied</strong>"; n.appendChild(h2);
    const u2 = document.createElement("ul"); m.standards.forEach(function (t) { const li = document.createElement("li"); li.textContent = t; u2.appendChild(li); }); n.appendChild(u2); }
  document.querySelectorAll("#list button").forEach(function (bt) { bt.setAttribute("aria-pressed", String(bt.dataset.id === m.id)); });
  look(view || m.view || "three");
  try { history.replaceState(null, "", "#" + m.id); } catch (e) {}
}
/* the list, by group */
const list = document.getElementById("list"); let lastGroup = null, ul = null;
MODELS.forEach(function (m) {
  if (m.group !== lastGroup) { const h = document.createElement("h2"); h.textContent = m.group; list.appendChild(h); ul = document.createElement("ul"); list.appendChild(ul); lastGroup = m.group; }
  const li = document.createElement("li"), b = document.createElement("button"); b.type = "button"; b.dataset.id = m.id; b.textContent = m.name;
  b.addEventListener("click", function () { show(m.id); }); li.appendChild(b); ul.appendChild(li);
});
document.querySelectorAll("[data-view]").forEach(function (b) { b.addEventListener("click", function () { look(b.dataset.view); }); });

function size() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true; }
window.addEventListener("resize", size); size();
controls.addEventListener("change", function () { dirty = true; });
(function loop() { controls.update(); if (dirty) { dirty = false; composer.render(); } requestAnimationFrame(loop); })();
show((location.hash || "").slice(1) || "modem");

/* easier reading: on stays on, across pages and visits */
const dys = document.getElementById("dys");
function setDys(on) { document.body.classList.toggle("dys", on); dys.setAttribute("aria-pressed", String(on)); dys.textContent = "Easier reading: " + (on ? "on" : "off"); try { localStorage.setItem("e4-dyslexia", on ? "1" : "0"); } catch (e) {} }
let stored = null; try { stored = localStorage.getItem("e4-dyslexia"); } catch (e) {}
setDys(stored === "1");
dys.addEventListener("click", function () { setDys(!document.body.classList.contains("dys")); });

/* for scripted close-ups: put the camera exactly here, looking there */
function cam(c, t, fov) { camera.fov = fov || 35; camera.position.fromArray(c); controls.target.fromArray(t); camera.near = 0.5; camera.far = 20000; camera.updateProjectionMatrix(); controls.update(); dirty = true; composer.render(); }
window.__preview = { cam: cam, show: show, look: look, ids: MODELS.map(function (m) { return m.id; }), render: function () { composer.render(); }, current: function () { return current; } };
