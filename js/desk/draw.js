/* Drawing the network from the simulation: the logical diagram (our own
   icons, links with their real state) and the house floor plan (rooms,
   devices, cable runs). A link that is really down is drawn dashed red with
   a diamond at each end: shape as well as colour, never colour alone. */
import { LAYOUT } from "../net/home.js";

const NS = "http://www.w3.org/2000/svg";
export const ICONS = {
  cloud: '<path d="M16 46h34a10 10 0 0 0 0-20 14 14 0 0 0-27-3A10 10 0 0 0 16 46z" class="ib"/><path d="M24 38h18M28 32h12" class="il"/>',
  modem: '<rect x="22" y="8" width="20" height="48" rx="5" class="ib"/><circle cx="32" cy="18" r="2.2" class="ok"/><circle cx="32" cy="25" r="2.2" class="ok"/><circle cx="32" cy="32" r="2.2" class="ok"/><circle cx="32" cy="39" r="2.2" class="on"/><circle cx="32" cy="46" r="2.2" class="ok"/>',
  router: '<path d="M18 30v-16M46 30v-16" class="il"/><rect x="10" y="28" width="44" height="20" rx="6" class="ib"/><path d="M21 38h8l-3-3M43 38h-8l3 3" class="il"/><circle cx="16" cy="44" r="1.6" class="ok"/>',
  switch: '<rect x="6" y="22" width="52" height="22" rx="4" class="ib"/><path d="M14 30h12l-3-3M50 36H38l3 3" class="il"/><rect x="12" y="38" width="5" height="3" class="ip"/><rect x="20" y="38" width="5" height="3" class="ip"/><rect x="28" y="38" width="5" height="3" class="ip"/><rect x="36" y="38" width="5" height="3" class="ip"/><rect x="44" y="38" width="5" height="3" class="ip"/>',
  pc: '<rect x="8" y="12" width="34" height="24" rx="3" class="ib"/><rect x="12" y="16" width="26" height="16" class="is"/><path d="M20 42h10M25 36v6" class="il"/><rect x="46" y="12" width="12" height="36" rx="2" class="ib"/><circle cx="52" cy="18" r="1.8" class="ok"/>',
  laptop: '<rect x="14" y="14" width="36" height="24" rx="3" class="ib"/><rect x="18" y="18" width="28" height="16" class="is"/><path d="M8 42h48l-4 6H12z" class="ib"/>',
  printer: '<rect x="16" y="10" width="32" height="12" class="ib"/><rect x="8" y="22" width="48" height="20" rx="4" class="ib"/><rect x="16" y="36" width="32" height="16" class="is2"/><circle cx="48" cy="28" r="2" class="ok"/>',
  tv: '<rect x="6" y="12" width="52" height="32" rx="2" class="ib"/><rect x="10" y="16" width="44" height="24" class="is"/><path d="M22 52h20M32 44v8" class="il"/>',
  camera: '<path d="M14 40a18 18 0 0 1 36 0z" class="ib"/><rect x="10" y="40" width="44" height="8" rx="3" class="ib"/><circle cx="32" cy="32" r="6" class="is"/>',
  mesh: '<rect x="20" y="10" width="24" height="44" rx="11" class="ib"/><circle cx="32" cy="44" r="3" class="ok"/><path d="M26 20q6-5 12 0M28 25q4-3 8 0" class="il"/>',
  phone: '<rect x="22" y="8" width="20" height="48" rx="4" class="ib"/><rect x="25" y="13" width="14" height="34" class="is"/>',
  server: '<rect x="14" y="8" width="36" height="14" rx="2" class="ib"/><rect x="14" y="25" width="36" height="14" rx="2" class="ib"/><rect x="14" y="42" width="36" height="14" rx="2" class="ib"/><circle cx="20" cy="15" r="1.8" class="ok"/><circle cx="20" cy="32" r="1.8" class="ok"/><circle cx="20" cy="49" r="1.8" class="ok"/>',
  firewall: '<rect x="8" y="14" width="48" height="36" rx="3" class="ib"/><path d="M8 26h48M8 38h48M24 14v12M40 14v12M16 26v12M32 26v12M48 26v12M24 38v12M40 38v12" class="il"/>',
  ap: '<ellipse cx="32" cy="38" rx="20" ry="8" class="ib"/><path d="M22 26q10-8 20 0M26 20q6-5 12 0" class="il"/>'
};
const ICON_OF = { isp: "cloud", modem: "modem", router: "router", switch: "switch", pc: "pc", laptop: "laptop", printer: "printer", tv: "tv", camera: "camera", mesh: "mesh", phone: "phone", guest: "phone", rogue: "router" };
function defs(svg, prefix) {
  const d = document.createElementNS(NS, "defs");
  d.innerHTML = Object.keys(ICONS).map(function (k) { return '<symbol id="' + prefix + k + '" viewBox="0 0 64 64">' + ICONS[k] + "</symbol>"; }).join("");
  svg.appendChild(d);
}
function mk(tag, a) { const n = document.createElementNS(NS, tag); for (const k in a) n.setAttribute(k, a[k]); return n; }

/* where a device sits: most never move; the laptop moves with its room */
function pos(sim, id) {
  const L = Object.assign({}, LAYOUT[id]);
  if (id === "laptop" && sim.net.rooms.laptop === "living") Object.assign(L, { x: 770, y: 150, px: 610, py: 235 });
  return L;
}
function subOf(sim, id) {
  const x = sim.d[id];
  if (id === "router") return x.lan.ip;
  if (id === "printer") return x.ifaces[0].cfg.mode === "static" ? x.ifaces[0].cfg.ip : "DHCP";
  if (id === "camera") { const r = sim.d.router.dhcp.reservations.find(function (v) { return v.mac === x.ifaces[0].mac; }); return r ? r.ip : "DHCP"; }
  return x.sub || "";
}

/* the links as the simulation sees them right now */
export function linksOf(sim) {
  const out = [];
  const coax = sim.cable("c-coax");
  out.push({ a: "isp", b: "modem", kind: "coax", up: sim.cableUp(coax) && sim.net.isp.up, pa: "", pb: "CABLE IN", cable: "c-coax" });
  for (const c of sim.net.cables) {
    if (c.kind === "coax") continue;
    if (sim.d[c.a.dev].undocumented || sim.d[c.b.dev].undocumented) continue;   /* the diagram is the documentation: an undocumented box isn't on it */
    out.push({ a: c.a.dev, b: c.b.dev, kind: "copper", up: sim.cableUp(c), pa: c.a.port, pb: c.b.port, cable: c.id });
  }
  const m = sim.d.mesh;
  if (m) out.push({ a: "router", b: "mesh", kind: "wifi", up: m.backhaul.ok && sim.on("mesh") && sim.on("router") });
  for (const id of ["phone", "laptop", "guest"]) { if (!sim.d[id]) continue; const l = sim.wifiLink(id); if (l && l.connected) out.push({ a: l.ap.id, b: id, kind: "wifi", up: true }); }
  return out;
}

export function drawLogical(svg, sim, o) {
  svg.innerHTML = ""; defs(svg, "i-");
  const ids = ["isp", "modem", "router", "tv", "switch", "pc", "printer", "camera", "mesh", "phone", "laptop", "guest"].filter(function (id) { return sim.d[id] && !sim.d[id].undocumented; });
  const P = {}; ids.forEach(function (id) { P[id] = pos(sim, id); });
  const below = function (id) { return !P[id].lab || P[id].lab === "below"; };
  const gl = mk("g", {}), gn = mk("g", {}), gp = mk("g", {});
  svg.appendChild(gl); svg.appendChild(gn); svg.appendChild(gp);   /* port dots and labels sit above every line and device */
  const R = 34;
  for (const l of linksOf(sim)) {
    const A = P[l.a], B = P[l.b]; if (!A || !B) continue;
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    gl.appendChild(mk("line", { x1: A.x + ux * R, y1: A.y + uy * R, x2: B.x - ux * R, y2: B.y - uy * R, class: "lk lk-" + l.kind + (l.up ? "" : " lk-down") }));
    if (l.kind === "wifi") continue;
    [[l.a, 1, l.pa], [l.b, -1, l.pb]].forEach(function (e) {
      const D = P[e[0]], dx2 = ux * e[1], dy2 = uy * e[1];
      const off = dy2 > 0.5 ? (below(e[0]) ? R + 56 : R + 24) : R + 12;
      const px = D.x + dx2 * off, py = D.y + dy2 * off;
      if (l.up) gp.appendChild(mk("circle", { cx: px, cy: py, r: 6, class: "pd pd-up" }));
      else gp.appendChild(mk("rect", { x: px - 6, y: py - 6, width: 12, height: 12, transform: "rotate(45 " + px + " " + py + ")", class: "pd pd-down" }));
      if (e[2]) {
        let tx, ty, anc;
        if (Math.abs(dy2) < 0.5) { tx = px; ty = e[1] === 1 ? py - 15 : py + 27; anc = dx2 > 0 ? "start" : "end"; }   /* across: the near end's label above the line, the far end's below, so two never collide (easier reading widens them) */
        else { const side = Math.abs(dx2) < 0.2 ? 1 : Math.sign(dx2); tx = px + side * 18; ty = py + 5; anc = side > 0 ? "start" : "end"; }
        const t = mk("text", { x: tx, y: ty, "text-anchor": anc, class: "pl" }); t.textContent = e[2]; gp.appendChild(t);
      }
    });
  }
  for (const id of ids) {
    const n = sim.d[id], p = P[id];
    const g = mk("g", { class: "nd" + (o.open === id ? " open" : ""), tabindex: "0", role: "button", transform: "translate(" + p.x + " " + p.y + ")", "aria-label": n.label + (subOf(sim, id) ? ", " + subOf(sim, id) : "") + ". Open it in the terminal." });
    g.dataset.d = id;
    g.appendChild(mk("rect", { x: -R, y: -R, width: R * 2, height: R * 2, rx: 12, class: "tile" }));
    g.appendChild(mk("use", { href: "#i-" + ICON_OF[id], x: -R * 0.8, y: -R * 0.8, width: R * 1.6, height: R * 1.6 }));
    const ps = p.lab === "above" ? [0, -R - 30, 0, -R - 11, "middle"] : p.lab === "left" ? [-R - 12, -6, -R - 12, 13, "end"] : [0, R + 20, 0, R + 38, "middle"];
    const t1 = mk("text", { x: ps[0], y: ps[1], "text-anchor": ps[4], class: "nl" }); t1.textContent = n.label; g.appendChild(t1);
    const sub = subOf(sim, id); if (sub) { const t2 = mk("text", { x: ps[2], y: ps[3], "text-anchor": ps[4], class: "ns" }); t2.textContent = sub; g.appendChild(t2); }
    gn.appendChild(g);
  }
  plates(svg, ".nl, .ns, .pl");
}

/* the house: rooms, devices, and the cable runs as they really are */
const RUNS = {
  "c-coax": ["M722 38 C 706 66 676 92 652 108"],
  "c-modem-router": ["M650 110 L560 150"],
  "c-router-tv": ["M560 150 C 600 196 640 228 680 240"],
  "c-router-switch": ["M560 150 C 500 150 460 110 420 110", "M420 110 L 250 200"],
  "c-switch-pc": ["M250 200 L 110 140"],
  "c-switch-printer": ["M250 200 L 360 140"],
  "c-switch-camera": ["M250 200 C 300 400 600 430 720 448"],
  "c-rogue": ["M250 200 L 330 235"]
};
const PLAN_NAME = { modem: "Modem", router: "Router", tv: "Smart TV", switch: "Switch", pc: "Office PC", printer: "Printer", camera: "Camera", mesh: "Mesh node", laptop: "Laptop", phone: "Phone", guest: "Guest's phone", rogue: "Old router" };
export function drawPlan(svg, sim, o) {
  svg.innerHTML = ""; defs(svg, "p-");
  let h = '<rect class="room" x="30" y="30" width="390" height="270"/><rect class="room" x="420" y="30" width="340" height="270"/><rect class="room" x="30" y="300" width="390" height="220"/><rect class="room" x="420" y="300" width="340" height="220"/>' +
    '<rect class="room" x="790" y="30" width="190" height="230"/><path class="door" d="M380 300h30M520 300h40M420 400v40"/>' +
    '<text class="rl" x="46" y="60">OFFICE</text><text class="rl" x="436" y="60">LIVING ROOM</text><text class="rl" x="46" y="330">GARAGE</text><text class="rl" x="436" y="330">KITCHEN</text><text class="rl" x="806" y="60">UPSTAIRS</text>' +
    '<text class="rl" x="800" y="512">FRONT DOOR</text><rect class="plate" x="413" y="98" width="14" height="24"/><rect class="plate" x="714" y="32" width="16" height="10"/>';
  let anyDown = false;
  for (const id in RUNS) {
    const c = sim.cable(id); if (!c) continue;
    const up = sim.cableUp(c); if (!up) anyDown = true;
    for (const d of RUNS[id]) h += '<path class="' + (up ? (c.kind === "coax" ? "run-coax" : "run") : "run-bad") + '" d="' + d + '"/>';
  }
  svg.innerHTML += h;
  for (const id in PLAN_NAME) {
    if (!sim.d[id]) continue;
    const p = pos(sim, id);
    const g = mk("g", { class: "pdev" + (o.open === id ? " open" : ""), tabindex: "0", role: "button", transform: "translate(" + p.px + " " + p.py + ")", "aria-label": "Open " + sim.d[id].label + " in the terminal" });
    g.dataset.d = id;
    g.appendChild(mk("rect", { class: "tile", x: -24, y: -24, width: 48, height: 48, rx: 9 }));
    g.appendChild(mk("use", { href: "#p-" + ICON_OF[id], x: -20, y: -20, width: 40, height: 40 }));
    const t = mk("text", { class: "ns", y: 47, "text-anchor": "middle" }); t.textContent = id === "laptop" && sim.d.laptop.label === "New laptop" ? "New laptop" : PLAN_NAME[id]; g.appendChild(t);
    svg.appendChild(g);
  }
  /* a diamond on each run that's down, and the words for it */
  for (const id in RUNS) {
    const c = sim.cable(id); if (!c || sim.cableUp(c)) continue;
    const m = RUNS[id][RUNS[id].length - 1].match(/M\s*(-?\d+)\s+(-?\d+).*?(-?\d+)\s+(-?\d+)\s*$/);
    if (m) { const x = (+m[1] + +m[3]) / 2, y = (+m[2] + +m[4]) / 2; svg.appendChild(mk("rect", { x: x - 8, y: y - 8, width: 16, height: 16, transform: "rotate(45 " + x + " " + y + ")", class: "pd-down" })); }
  }
  if (anyDown) { const t = mk("text", { class: "ns", x: 46, y: 282 }); t.textContent = "red dashed run: no link"; svg.appendChild(t); }
  plates(svg, ".rl, .ns", "#f4f6fb");
}

/* a solid plate behind every label, so its ground is one colour where a line passes behind it */
export function plates(svg, sel, fill) {
  svg.querySelectorAll(".lpbg").forEach(function (r) { r.remove(); });
  svg.querySelectorAll(sel).forEach(function (t) {
    let b; try { b = t.getBBox(); } catch (e) { return; } if (!b.width) return;
    const r = mk("rect", { x: b.x - 4, y: b.y - 2, width: b.width + 8, height: b.height + 4, rx: 3, class: "lpbg" });
    if (fill) r.style.fill = fill;
    t.parentNode.insertBefore(r, t);
  });
}
