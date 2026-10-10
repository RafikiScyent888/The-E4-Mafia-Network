/* The model preview page: pick a model, turn it, read what it is built
   from. window.__preview lets a script take the renders for the owner. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import * as GEAR from "../assets/models/home-gear.js";
import * as CAB from "../assets/models/cables.js";

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
    standards: ["A male F-type's nut is threaded on the INSIDE (it screws onto the modem's threaded barrel). Your photo shows threads outside; the model follows the real connector."] }
];

const canvas = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xc9ced6);
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(1, 2, 1.5); scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.75); fill.position.set(-1.2, 1, -1.6); scene.add(fill);   // so backs aren't in shadow
const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 5000);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true;

let current = null, curModel = null, radius = 100, center = new THREE.Vector3();
const VIEWS = { three: [1, 0.55, 1.15], front: [0, 0.08, 1], back: [0, 0.08, -1], left: [-1, 0.08, 0], right: [1, 0.08, 0], top: [0, 1, 0.001], bottom: [0, -1, 0.001] };
let frameBox = new THREE.Box3();
function look(v) {
  const d = new THREE.Vector3().fromArray(VIEWS[v] || VIEWS.three).normalize();
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
  controls.target.copy(c); controls.update();
  document.querySelectorAll("[data-view]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.view === v)); });
}
function show(id, view) {
  const m = MODELS.find(function (x) { return x.id === id; }) || MODELS[0];
  if (current) { scene.remove(current); }
  current = m.build(); curModel = m; scene.add(current);
  const b = new THREE.Box3().setFromObject(current), s = new THREE.Sphere(); b.getBoundingSphere(s); center.copy(s.center); radius = s.radius;
  frameBox = m.frame ? new THREE.Box3(new THREE.Vector3().fromArray(m.frame.slice(0, 3)), new THREE.Vector3().fromArray(m.frame.slice(3))) : b;
  document.getElementById("name").textContent = m.name;
  document.getElementById("photo").textContent = m.photo;
  const n = document.getElementById("notes"); n.innerHTML = "";
  const h = document.createElement("p"); h.innerHTML = "<strong>What it shows</strong>"; n.appendChild(h);
  const ul = document.createElement("ul"); m.shows.forEach(function (t) { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); }); n.appendChild(ul);
  if (m.standards) { const h2 = document.createElement("p"); h2.innerHTML = "<strong>Standards applied</strong>"; n.appendChild(h2);
    const u2 = document.createElement("ul"); m.standards.forEach(function (t) { const li = document.createElement("li"); li.textContent = t; u2.appendChild(li); }); n.appendChild(u2); }
  document.querySelectorAll("#list button").forEach(function (bt) { bt.setAttribute("aria-pressed", String(bt.dataset.id === m.id)); });
  look(view || "three");
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

function size() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener("resize", size); size();
(function loop() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();
show((location.hash || "").slice(1) || "modem");

/* easier reading: on stays on, across pages and visits */
const dys = document.getElementById("dys");
function setDys(on) { document.body.classList.toggle("dys", on); dys.setAttribute("aria-pressed", String(on)); dys.textContent = "Easier reading: " + (on ? "on" : "off"); try { localStorage.setItem("e4-dyslexia", on ? "1" : "0"); } catch (e) {} }
let stored = null; try { stored = localStorage.getItem("e4-dyslexia"); } catch (e) {}
setDys(stored === "1");
dys.addEventListener("click", function () { setDys(!document.body.classList.contains("dys")); });

window.__preview = { show: show, look: look, ids: MODELS.map(function (m) { return m.id; }), render: function () { renderer.render(scene, camera); }, current: function () { return current; } };
