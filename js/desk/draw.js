/* Drawing the network from the simulation: the logical diagram (our own
   icons, links with their real state) and the house floor plan (rooms,
   devices, cable runs). A link that is really down is drawn dashed red with
   a diamond at each end: shape as well as colour, never colour alone. */
import { LAYOUT } from "../net/home.js";
import { OFFICE_LAYOUT, OFFICE_ROOM_BOX } from "../net/office.js";
import { BUSINESS_LAYOUT, BUSINESS_ROOM_BOX } from "../net/business.js";

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
  injector: '<rect x="10" y="22" width="44" height="22" rx="4" class="ib"/><path d="M35 25l-7 9h7l-5 8" class="il"/><circle cx="18" cy="29" r="1.8" class="ok"/>',
  mswitch: '<rect x="4" y="22" width="56" height="20" rx="3" class="ib"/><rect x="9" y="27" width="4" height="3" class="ip"/><rect x="15" y="27" width="4" height="3" class="ip"/><rect x="21" y="27" width="4" height="3" class="ip"/><rect x="27" y="27" width="4" height="3" class="ip"/><rect x="33" y="27" width="4" height="3" class="ip"/><rect x="9" y="34" width="4" height="3" class="ip"/><rect x="15" y="34" width="4" height="3" class="ip"/><rect x="21" y="34" width="4" height="3" class="ip"/><rect x="27" y="34" width="4" height="3" class="ip"/><rect x="33" y="34" width="4" height="3" class="ip"/><rect x="44" y="28" width="10" height="8" rx="1" class="is"/><circle cx="49" cy="18" r="2" class="ok"/><path d="M44 18h-6" class="il"/>',
  brouter: '<rect x="4" y="22" width="56" height="20" rx="3" class="ib"/><circle cx="16" cy="32" r="7" class="is"/><path d="M11 32h10M16 27v10M19 29l2 3-2 3M13 29l-2 3 2 3" class="il"/><rect x="28" y="29" width="4" height="3" class="ip"/><rect x="34" y="29" width="4" height="3" class="ip"/><rect x="40" y="29" width="4" height="3" class="ip"/><rect x="46" y="29" width="4" height="3" class="ip"/><rect x="52" y="28" width="5" height="5" rx="1" class="is"/>',
  ap: '<ellipse cx="32" cy="38" rx="20" ry="8" class="ib"/><path d="M22 26q10-8 20 0M26 20q6-5 12 0" class="il"/>',
  dome: '<rect x="10" y="18" width="44" height="9" rx="3" class="ib"/><path d="M15 27h34a17 17 0 0 1-34 0z" class="ib"/><circle cx="32" cy="34" r="6" class="is"/><circle cx="46" cy="22.5" r="1.8" class="ok"/>',
  patchpanel: '<rect x="4" y="22" width="56" height="20" rx="2" class="ib"/><rect x="9" y="26" width="8" height="3" class="is"/><rect x="20" y="26" width="8" height="3" class="is"/><rect x="31" y="26" width="8" height="3" class="is"/><rect x="42" y="26" width="8" height="3" class="is"/><rect x="10" y="32" width="6" height="5" class="ip"/><rect x="21" y="32" width="6" height="5" class="ip"/><rect x="32" y="32" width="6" height="5" class="ip"/><rect x="43" y="32" width="6" height="5" class="ip"/><path d="M13 42v8M35 42v8" class="il"/>',
  jack: '<rect x="20" y="10" width="24" height="44" rx="3" class="ib"/><rect x="26" y="22" width="12" height="10" rx="1" class="ip"/><path d="M29 32v-4M35 32v-4" class="il"/>'
};
const ICON_OF = { isp: "cloud", modem: "modem", router: "router", switch: "switch", pc: "pc", laptop: "laptop", printer: "printer", tv: "tv", camera: "camera", mesh: "mesh", phone: "phone", guest: "phone", rogue: "router", injector: "injector", injector2: "injector", msw: "mswitch", tech: "laptop", meet: "switch", mpc: "pc", pp: "patchpanel", mjack: "jack", ojack: "jack", mgr: "pc", bsw: "mswitch", hire: "pc", rtr: "brouter", bpc: "pc", ap: "ap", cam1: "dome", cam2: "dome", cinj1: "injector", cinj2: "injector", mphone: "phone", dpc1: "pc", dpc2: "pc" };
function defs(svg, prefix) {
  const d = document.createElementNS(NS, "defs");
  d.innerHTML = Object.keys(ICONS).map(function (k) { return '<symbol id="' + prefix + k + '" viewBox="0 0 64 64">' + ICONS[k] + "</symbol>"; }).join("");
  svg.appendChild(d);
}
function mk(tag, a) { const n = document.createElementNS(NS, tag); for (const k in a) n.setAttribute(k, a[k]); return n; }

/* where a device sits: most never move; the laptop moves with its room. The office and the business each have their own
   layout, rooms, names and fixed runs */
const SITES = {
  office: { layout: OFFICE_LAYOUT, box: OFFICE_ROOM_BOX, rooms: officeRooms, names: officeNames, runs: { "c-coax": ["M40 120 L 96 120"] }, plan: { switch: "Old 8-port switch", pc: "Front desk PC", printer: "Printer", tech: "Your laptop", meet: "Back office switch", bsw: "Back office switch", mpc: "Back office PC" } },
  business: { layout: BUSINESS_LAYOUT, box: BUSINESS_ROOM_BOX, rooms: businessRooms, names: businessNames, runs: { "c-coax": ["M40 120 L 96 120"] }, plan: { router: "Provider's router", rtr: "Business router", msw: "Closet switch", modem: "Cable modem", printer: "Printer", tech: "Your laptop" } }
};
const siteOf = function (sim) { return SITES[sim.net.site] || null; };
const office = function (sim) { return !!siteOf(sim); };   /* a site of its own (the office, the business), not a house */
const layOf = function (sim) { return office(sim) ? siteOf(sim).layout : LAYOUT; };
const CAM_H = 716;   /* the business's diagram's height with the cameras on it */
function pos(sim, id) {
  const L = Object.assign({}, layOf(sim)[id]);
  if (sim.net.site === "business" && sim.d.cam1 && L.cams) Object.assign(L, L.cams);   /* the cameras' job (SB-J5) draws some devices elsewhere, to give the cameras room */
  if (sim.net.site === "business" && sim.net.roomNames.dept && L.dept) Object.assign(L, L.dept);   /* and the department's room (SB-J10) moves the back switch along its wall */
  if (office(sim)) { const alt = L.alt && L.alt[sim.net.rooms[id]]; if (alt && alt.x != null) Object.assign(L, { x: alt.x, y: alt.y, lab: alt.lab || L.lab }); return L; }   /* a device carried to another room can sit elsewhere on the diagram too (your laptop at the back office's switch) */
  if (id === "laptop" && sim.net.rooms.laptop === "living") Object.assign(L, { x: 770, y: 150, px: 610, py: 235 });
  if (id === "laptop" && sim.net.rooms.laptop === "kitchen") Object.assign(L, { px: 640, py: 360 });
  return L;
}
/* build mode puts devices where the student chooses: each one in its usual spot when that's its room and the spot
   is clear, otherwise the first clear place in the room it's in, its tile and its name kept off everything else's */
/* a build house's upstairs is the back bedroom and the landing at the top of the stairs, drawn taller in the space below */
const ROOM_BOX = { office: [30, 30, 420, 300], living: [420, 30, 760, 300], garage: [30, 300, 420, 520], kitchen: [420, 300, 760, 520], upstairs: [790, 30, 980, 200], landing: [790, 200, 980, 330], porch: [764, 340, 990, 490] };
function planSpots(sim, ids) {
  const out = {}, taken = [], LAY = layOf(sim), BOX = office(sim) ? siteOf(sim).box : ROOM_BOX;
  if (!sim.net.extra.build) { for (const id of ids) { const p = pos(sim, id); out[id] = { px: p.px, py: p.py }; } return out; }   /* the tickets' houses are drawn exactly as laid out */
  const off = office(sim);
  const box = function (x, y) { return [x - 44, y - 26, x + 44, y + 54]; };
  const clear = function (b) { return taken.every(function (t) { return b[2] < t[0] || b[0] > t[2] || b[3] < t[1] || b[1] > t[3]; }); };
  const usual = function (id) { const p = pos(sim, id), room = sim.net.rooms[id], a0 = LAY[id].alt && LAY[id].alt[room], alt = a0 && a0.dept && sim.net.roomNames && sim.net.roomNames.dept ? Object.assign({}, a0, a0.dept) : a0; if (alt && alt.px != null) return alt; return p.px != null && room !== "upstairs" && (!LAY[id].room || LAY[id].room === room || (id === "laptop" && (room === "living" || room === "kitchen"))) ? p : null; };   /* upstairs is laid out afresh: it's split in two; alt: a device's own spot in another room (one with no spot on the plan is placed there afresh) */
  for (const id of ids) { const p = usual(id); if (p && clear(box(p.px, p.py))) { out[id] = { px: p.px, py: p.py }; taken.push(box(p.px, p.py)); } }
  for (const id of ids) {
    if (out[id]) continue;
    const R = BOX[sim.net.rooms[id]] || BOX[Object.keys(BOX)[0]], rn = off ? String((sim.net.roomNames || {})[sim.net.rooms[id]] || "") : "";
    taken.push([R[0], R[1], R[0] + Math.max(140, rn.length * 11.2 + 14), R[1] + 42]);   /* the room's name, top left */
    let spot = null;
    for (let y = R[1] + 44; y <= R[3] - 56 && !spot; y += 26) for (let x = R[0] + 50; x <= R[2] - 50 && !spot; x += 30) if (clear(box(x, y))) spot = { px: x, py: y };
    taken.pop();
    out[id] = spot || { px: (R[0] + R[2]) / 2, py: (R[1] + R[3]) / 2 };
    taken.push(box(out[id].px, out[id].py));
  }
  return out;
}
const shown = function (sim, id) { return !!sim.d[id] && !sim.d[id].boxed; };   /* a device still in its box isn't on either drawing */
function subOf(sim, id) {
  const x = sim.d[id];
  if (id === "router") return x.lan.ip;
  if (x.kind === "brouter") { const f = Object.keys(x.sw.ifs).filter(function (k) { return !(x.sw.links[k] && x.sw.links[k].far === "modem"); }).map(function (k) { return x.sw.ifs[k]; }).find(function (q) { return q.ip && q.ip !== "dhcp" && !q.shutdown; }); return f ? f.ip : x.sub; }   /* its first address set by hand once it has one, on the business's side: the provider's side, even with the fixed address set by hand (SB-J7), isn't the gateway anyone here uses */
  if (id === "printer") return x.ifaces[0].cfg.mode === "static" ? x.ifaces[0].cfg.ip : "DHCP";
  if (x.kind === "mswitch") return x.sw.vlan1.ip && !x.sw.vlan1.shutdown ? x.sw.vlan1.ip : x.sub;   /* its management address once it has one */
  if (x.kind === "bap") return "DHCP";   /* the ceiling access point: its address is the student's to find (the router's DHCP list, the switch's neighbours), so the diagram doesn't give it */
  if (x.kind === "dcam") return x.ifaces[0].cfg.mode === "static" ? x.ifaces[0].cfg.ip : "DHCP";   /* a dome camera (SB-J5): its fixed address once it has one, as the records give it */
  if (x.kind === "injector" && /, CAM-/.test(x.label)) return x.label.replace(/^.*, /, "");   /* a camera's own injector: the camera it's labelled for */
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
    if (sim.d[c.a.dev].undocumented || sim.d[c.b.dev].undocumented) continue;
    if (sim.panelEnd(c)) {   /* the logical diagram leaves the patch panel out: a patched path is one link, switch to device, drawn from its cord */
      const pe = sim.panelEnd(c), v = /R$/.test(pe.port) ? null : sim.viaPanel(c);
      if (v) out.push({ a: v.a.dev, b: v.b.dev, kind: "copper", up: sim.cableUp(c), pa: v.a.port, pb: v.b.port, cable: c.id });
      continue;
    }   /* the diagram is the documentation: an undocumented box isn't on it */
    out.push({ a: c.a.dev, b: c.b.dev, kind: c.kind === "console" ? "console" : c.kind === "fibre" ? "fibre" : "copper", up: sim.cableUp(c), pa: sim.d[c.a.dev].kind === "injector" ? "" : c.a.port, pb: sim.d[c.b.dev].kind === "injector" ? "" : c.b.port, cable: c.id });   /* the injector's own port names are on its Physical tab: the diagram has no room for them */
  }
  const m = sim.d.mesh;
  if (m && shown(sim, "mesh") && shown(sim, "router") && sim.meshLink().kind !== "wired") out.push({ a: "router", b: "mesh", kind: "wifi", up: sim.meshLink().ok });   /* wired: its cable is drawn with the others */
  for (const id of ["phone", "laptop", "guest"]) { if (!sim.d[id]) continue; const l = sim.wifiLink(id); if (l && l.connected && !(sim.d[l.ap.id] && sim.d[l.ap.id].undocumented)) out.push({ a: l.ap.id, b: id, kind: "wifi", up: true }); }   /* joined to something not in the house: no line to draw */
  return out;
}

export function drawLogical(svg, sim, o) {
  svg.innerHTML = ""; defs(svg, "i-");
  const ids = ["isp", "modem", "router", "rtr", "tv", "switch", "msw", "meet", "bsw", "mpc", "mgr", "tech", "pc", "bpc", "hire", "printer", "injector", "injector2", "ap", "camera", "mesh", "phone", "laptop", "guest", "cinj1", "cam1", "cinj2", "cam2", "dpc1", "dpc2"].filter(function (id) { return shown(sim, id) && !sim.d[id].undocumented; });
  /* the business with its cameras (SB-J5) is drawn taller: their injectors and cameras get rows of their own */
  svg.setAttribute("viewBox", sim.net.site === "business" && (shown(sim, "dpc1") || shown(sim, "dpc2")) ? "-180 -26 1016 " + CAM_H : "-6 -26 836 " + (sim.net.site === "business" && sim.d.cam1 ? CAM_H : 546));   /* the department's PCs (SB-J10), once out of their boxes, get a column of their own left of the back switch */
  const P = {}; ids.forEach(function (id) { P[id] = pos(sim, id); });
  if (P.injector && P.injector2) Object.assign(P.injector2, { x: 520, y: 190 });   /* both injectors out of the van: the second one moves up out of the way */
  const below = function (id) { return !P[id].lab || P[id].lab === "below"; };
  const gl = mk("g", {}), gn = mk("g", {}), gp = mk("g", {});
  svg.appendChild(gl); svg.appendChild(gn); svg.appendChild(gp);   /* port dots and labels sit above every line and device */
  const R = 34, links = linksOf(sim), pair = function (l) { return [l.a, l.b].sort().join("|"); }, many = {};
  const deg = {}; links.forEach(function (l) { many[pair(l)] = (many[pair(l)] || 0) + 1; deg[l.a] = (deg[l.a] || 0) + 1; deg[l.b] = (deg[l.b] || 0) + 1; });   /* two cables between the same two devices (your laptop's console and Ethernet to the switch) run side by side, fanning out from the busier device, where other ports' labels sit close */
  for (const id of ids) {
    const n = sim.d[id], p = P[id];
    const g = mk("g", { class: "nd" + (o.open === id ? " open" : ""), tabindex: "0", role: "button", transform: "translate(" + p.x + " " + p.y + ")", "aria-label": n.label + (subOf(sim, id) ? ", " + subOf(sim, id) : "") + ". Open it in the terminal." });
    g.dataset.d = id;
    g.appendChild(mk("rect", { x: -R, y: -R, width: R * 2, height: R * 2, rx: 12, class: "tile" }));
    g.appendChild(mk("use", { href: "#i-" + ICON_OF[id], x: -R * 0.8, y: -R * 0.8, width: R * 1.6, height: R * 1.6 }));
    const ps = p.lab === "above" ? [0, -R - 30, 0, -R - 11, "middle"] : p.lab === "left" ? [-R - 12, -6, -R - 12, 13, "end"] : p.lab === "right" ? [R + 12, -6, R + 12, 13, "start"] : [0, R + 20, 0, R + 38, "middle"];
    const t1 = mk("text", { x: ps[0], y: ps[1], "text-anchor": ps[4], class: "nl" }); t1.textContent = n.kind === "injector" && /, CAM-/.test(n.label) ? "PoE injector" : n.label; g.appendChild(t1);   /* a camera's injector: the camera it's for under its name */
    const sub = subOf(sim, id); if (sub) { const t2 = mk("text", { x: ps[2], y: ps[3], "text-anchor": ps[4], class: "ns" }); t2.textContent = sub; g.appendChild(t2); }
    gn.appendChild(g);
  }
  /* every device's label, measured as drawn (in the font in use): a port marker never sits on one */
  const boxes = [];
  gn.querySelectorAll(".nd").forEach(function (g) { const p = P[g.dataset.d]; g.querySelectorAll(".nl, .ns").forEach(function (t) { let b; try { b = t.getBBox(); } catch (e) { return; } if (b.width) boxes.push({ x: p.x + b.x, y: p.y + b.y, w: b.width, h: b.height }); }); });
  const onLabel = function (x, y) { return boxes.some(function (b) { return x + 9 > b.x - 3 && x - 9 < b.x + b.w + 3 && y + 9 > b.y - 3 && y - 9 < b.y + b.h + 3; }); };
  const onPortName = function (x, y) { return [].slice.call(gp.querySelectorAll("text.pl")).some(function (t) { let b; try { b = t.getBBox(); } catch (er) { return false; } return x + 8 > b.x - 4 && x - 8 < b.x + b.width + 4 && y + 8 > b.y - 2 && y - 8 < b.y + b.height + 2; }); };
  /* the dots already drawn, as painted: a dot 6 across its middle and its ring 1 more; a diamond reaches 8.5 and its ring 1 more */
  const painted = function () { return [].slice.call(gp.querySelectorAll(".pd")).map(function (x) { const round = x.hasAttribute("cx"), cx = round ? +x.getAttribute("cx") : +x.getAttribute("x") + 6, cy = round ? +x.getAttribute("cy") : +x.getAttribute("y") + 6, r = round ? 7 : 9.5; return { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r }; }); };
  /* a dot never sits on another: two lines leaving a device a few degrees apart carry their dots on until they part (the back switch's
     trunk and your laptop's console line reached the closet switch 9 degrees apart, their dots on each other) */
  const onDots = function (x, y, up) { const r = up ? 7 : 9.5; return painted().some(function (z) { return x - r < z.x + z.w + 2 && x + r > z.x - 2 && y - r < z.y + z.h + 2 && y + r > z.y - 2; }); };
  const seen = {}, runs = [];
  for (const l of links) {   /* every line first, so each port's name and dot can be kept off every other cable's line */
    const A0 = P[l.a], B0 = P[l.b]; if (!A0 || !B0) continue;
    const n = many[pair(l)], k = seen[pair(l)] = (seen[pair(l)] == null ? 0 : seen[pair(l)] + 1), sh = k * 30;   /* the first stays where it always ran; the next one runs beside it */
    const L0 = Math.hypot(B0.x - A0.x, B0.y - A0.y), nx = -(B0.y - A0.y) / L0, ny = (B0.x - A0.x) / L0, sg = l.a < l.b ? 1 : -1;
    const ea = deg[l.a] > deg[l.b] ? 0.4 : 1, eb = deg[l.b] > deg[l.a] ? 0.4 : 1;
    const A = Object.assign({}, A0, { x: A0.x + nx * sh * sg * ea, y: A0.y + ny * sh * sg * ea }), B = Object.assign({}, B0, { x: B0.x + nx * sh * sg * eb, y: B0.y + ny * sh * sg * eb });
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const run = { l: l, k: k, A: A, B: B, L: L, ux: ux, uy: uy, x1: A.x + ux * R, y1: A.y + uy * R, x2: B.x - ux * R, y2: B.y - uy * R };
    gl.appendChild(mk("line", { x1: run.x1, y1: run.y1, x2: run.x2, y2: run.y2, class: "lk lk-" + l.kind + (l.up ? "" : " lk-down"), "data-cable": l.cable || "wifi-" + l.b }));
    runs.push(run);
  }
  /* does a box (x, y, width, height) touch a line? (the line clipped to the box: Liang-Barsky) */
  const crosses = function (b, s) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, P4 = [-dx, dx, -dy, dy], Q4 = [s.x1 - b.x, b.x + b.width - s.x1, s.y1 - b.y, b.y + b.height - s.y1]; let t0 = 0, t1 = 1;
    for (let i = 0; i < 4; i++) { if (P4[i] === 0) { if (Q4[i] < 0) return false; continue; } const r = Q4[i] / P4[i]; if (P4[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } }
    return true;
  };
  for (const run of runs) {
    const l = run.l, k = run.k, A = run.A, B = run.B, L = run.L, ux = run.ux, uy = run.uy;
    if (l.kind === "wifi") continue;
    /* on another cable's line, a port's name or dot reads as that cable's (SB-J4: the trunk's "23" under your laptop's console line) */
    const onLine = function (b) { return runs.some(function (s) { return s !== run && crosses(b, s); }); };
    const dotOnLine = function (x, y) { const r = (l.up ? 7 : 9.5) + 3; return onLine({ x: x - r, y: y - r, width: 2 * r, height: 2 * r }); };   /* a dot clear of every other line, with room to see it is */
    [[l.a, 1, l.pa, A], [l.b, -1, l.pb, B]].forEach(function (e) {
      const D = e[3], dx2 = ux * e[1], dy2 = uy * e[1];
      let off = (dy2 > 0.5 ? (below(e[0]) ? R + 56 : R + 24) : R + 12) + (k && deg[e[0]] > 2 ? 22 : 0);   /* the second cable's port on a busy device: further along, clear of the first's */
      let px = D.x + dx2 * off, py = D.y + dy2 * off; const off0 = off;
      for (let g = 0; (onLabel(px, py) || (!e[2] && onPortName(px, py)) || onDots(px, py, l.up) || dotOnLine(px, py)) && g < 40 && off + 4 < L / 2; g++) { off += 4; px = D.x + dx2 * off; py = D.y + dy2 * off; }   /* slide along its line until it's clear of every label and every dot (a dot with no name: of every port name too) */
      if (e[2]) {
        /* the port's name, measured as drawn: where the near end's rule puts it if that's clear (across: above the line, the far end's
           below, so two never collide; up or down: beside it); else the other side of the line; else both again further along; else on the
           line itself. Clear
           means on the diagram and off every device's label and tile and every port name already placed. The dot goes with it */
        const t = mk("text", { class: "pl", "data-cable": l.cable || "" }); t.textContent = e[2]; gp.appendChild(t);
        const ov = function (b, q) { return b.x < q.x + q.w && b.x + b.width > q.x && b.y < q.y + q.h && b.y + b.height > q.y; };
        const placed = [].slice.call(gp.querySelectorAll("text.pl")).filter(function (x) { return x !== t; }).map(function (x) { try { const b = x.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height }; } catch (er) { return null; } }).filter(Boolean);
        const tiles = ids.map(function (id) { return { x: P[id].x - R, y: P[id].y - R, w: 2 * R, h: 2 * R }; });
        /* the dots already drawn, and this port's own: a dot is drawn over whatever is under it, so neither may sit on the name's plate
           (with easier reading on, port 1's own dot sat on the bottom of its "1") */
        const dots = painted();
        const plate = function () { let b; try { b = t.getBBox(); } catch (er) { return null; } return b.width ? { x: b.x - 4, y: b.y - 2, width: b.width + 8, height: b.height + 4 } : null; };
        const dotAt = function (q) { const r = l.up ? 7 : 9.5; return { x: q[0] - r, y: q[1] - r, w: 2 * r, h: 2 * r }; };
        const onDot = function (q) { const pb = plate(); return !!pb && (ov(pb, dotAt(q)) || dots.some(function (z) { return ov(pb, z); })); };
        const put = function (o, flip) {
          const qx = D.x + dx2 * o, qy = D.y + dy2 * o; let tx, ty, anc;
          if (flip === "on") { t.setAttribute("text-anchor", "middle"); for (let s = 20; s <= 80; s += 4) { t.setAttribute("x", qx + dx2 * s); t.setAttribute("y", qy + dy2 * s + 5); if (!onDot([qx, qy])) break; } return [qx, qy]; }   /* on its own line just past its dot, on its plate, like a label on the cable */
          if (Math.abs(dy2) < 0.5) { tx = qx; ty = (e[1] === 1) !== flip ? qy - 15 : qy + 27; anc = dx2 > 0 ? "start" : "end"; }
          else { let side = Math.abs(dx2) < 0.2 ? 1 : Math.sign(dx2); if (flip) side = -side; tx = qx + side * 18; ty = qy + 5; anc = side > 0 ? "start" : "end"; }
          t.setAttribute("x", tx); t.setAttribute("y", ty); t.setAttribute("text-anchor", anc); return [qx, qy];
        };
        const clear = function (q) { let b; try { b = t.getBBox(); } catch (er) { return true; } if (!b.width) return true; const d = dotAt(q), db = { x: d.x - 4, y: d.y - 2, width: d.w + 8, height: d.h + 4 }; return !onLabel(q[0], q[1]) && b.x >= -4 && b.x + b.width <= 828 && !boxes.some(function (z) { return ov(b, z); }) && !placed.some(function (z) { return ov(b, z) || ov(db, z); }) && !tiles.some(function (z) { return ov(b, z); }) && !onDot(q) && !onDots(q[0], q[1], l.up) && (!strict || (!dotOnLine(q[0], q[1]) && !onLine({ x: b.x + 1, y: b.y + 1, width: b.width - 2, height: b.height - 2 }))); };
        let at = null, strict = true;
        /* first clear of every other cable's line too, in its own half of its line; where lines crowd too close for that (three meeting at
           a switch's corner), clear of every name, tile and dot as before; and where a short line's half is all taken (its dot on the
           switch's own name), further along its line, its dot still before the far end's own (the printer's "3" at the closet switch, 25 October 2026). A crowded corner never ends with one name on another */
        for (const [st, from, to] of [[true, off, L / 2], [false, off0, L / 2], [false, off0, L - R - 26]]) {
          strict = st;
          for (let o = from; o + 4 < to && !at; o += 8) for (const flip of [false, true]) { const q = put(o, flip); if (clear(q)) { at = q; break; } }
          for (let o = from; o + 4 < to && !at; o += 8) { const q = put(o, "on"); if (clear(q)) at = q; }   /* neither side clear anywhere: on the line itself */
          if (at) break;
        }
        if (!at) at = put(off, false);   /* nowhere clear: where the rule puts it */
        px = at[0]; py = at[1];
      }
      if (l.up) gp.appendChild(mk("circle", { cx: px, cy: py, r: 6, class: "pd pd-up", "data-cable": l.cable || "" }));
      else gp.appendChild(mk("rect", { x: px - 6, y: py - 6, width: 12, height: 12, transform: "rotate(45 " + px + " " + py + ")", class: "pd pd-down", "data-cable": l.cable || "" }));
    });
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
  "c-switch-inj": ["M250 200 L 170 222"],
  "c-inj-camera": ["M170 222 C 200 420 600 440 720 448"],
  "c-rogue": ["M250 200 L 330 235"]
};
/* the office's and the business's runs and names are in SITES: the provider's line comes in on the closet wall, beside the modem */
const PLAN_NAME = { ap: "Access point", rtr: "Business router", bpc: "Back PC", hire: "New hire's PC", bsw: "Back office switch", pp: "Patch panel", mgr: "Manager's PC", mjack: "Wall jack", ojack: "Wall jack", msw: "Managed switch", meet: "Back office switch", mpc: "Back office PC", tech: "Your laptop", injector: "PoE injector", injector2: "PoE+ injector", modem: "Modem", router: "Router", tv: "Smart TV", switch: "Switch", pc: "Office PC", printer: "Printer", camera: "Camera", mesh: "Mesh node", laptop: "Laptop", phone: "Phone", guest: "Guest's phone", rogue: "Old router",
  cinj1: "PoE injector", cam1: "Ceiling camera", cinj2: "PoE injector", cam2: "Back door camera", mphone: "Manager's phone", dpc1: "Department PC", dpc2: "Department PC" };
export function drawPlan(svg, sim, o) {
  svg.innerHTML = ""; defs(svg, "p-");
  svg.setAttribute("viewBox", "20 20 970 " + (sim.net.site === "business" && sim.net.roomNames.dept ? 765 : sim.net.site === "business" && sim.d.cam2 ? 600 : 510));   /* with the department's room (SB-J10) below the back room: taller again */   /* the business with its cameras (SB-J5): a strip outside, under the back door, for the back door camera */
  const build = sim.net.extra.build, off = office(sim);   /* a build house shows upstairs as the back bedroom and the landing; the office is its own plan */
  const site = siteOf(sim);
  let h = off ? site.rooms(sim) : '<rect class="room" x="30" y="30" width="390" height="270"/><rect class="room" x="420" y="30" width="340" height="270"/><rect class="room" x="30" y="300" width="390" height="220"/><rect class="room" x="420" y="300" width="340" height="220"/>' +
    (build ? '<rect class="room" x="790" y="30" width="190" height="170"/><rect class="room" x="790" y="200" width="190" height="130"/><path class="door" d="M850 200h40"/>' : '<rect class="room" x="790" y="30" width="190" height="230"/>') +
    '<path class="door" d="M380 300h30M520 300h40M420 400v40"/><rect class="plate" x="413" y="98" width="14" height="24"/><rect class="plate" x="714" y="32" width="16" height="10"/>';
  /* the rooms' names go above the cable runs: a run the student lays can cross one, and the name stays on its own plate */
  const names = off ? site.names(sim) : '<text class="rl" x="46" y="60">OFFICE</text><text class="rl" x="436" y="60">LIVING ROOM</text><text class="rl" x="46" y="330">GARAGE</text><text class="rl" x="436" y="330">KITCHEN</text>' +
    (build ? '<text class="rl" x="806" y="60">BACK BEDROOM</text><text class="rl" x="806" y="230">LANDING</text>' : '<text class="rl" x="806" y="60">UPSTAIRS</text>') + '<text class="rl" x="800" y="512">FRONT DOOR</text>';
  const FIXED_RUNS = off ? site.runs : RUNS, nameOf = function (id) { const x = sim.d[id]; if (x.kind === "injector" && /, CAM-/.test(x.label)) return "Injector " + x.label.replace(/^.*, /, ""); return (off && site.plan[id]) || (sim.net.site === "business" && x.label) || PLAN_NAME[id]; };   /* a camera's injector (SB-J5) by the camera it's labelled for */   /* the business's PCs by their own names (the reception PC, the till) */
  const ids = Object.keys(PLAN_NAME).filter(function (id) { return shown(sim, id); }), P = planSpots(sim, ids);
  let anyDown = false;
  const runs = [], routed = sim.net.site === "business";
  for (const c of sim.net.cables) {
    if ([c.a, c.b].some(function (e) { return sim.d[e.dev] && sim.d[e.dev].kind === "patchpanel" && !/R$/.test(e.port); })) continue;   /* the patch cords stay inside the rack: the plan shows the runs out to the rooms */
    let paths = FIXED_RUNS[c.id] && !build ? FIXED_RUNS[c.id] : null;
    if (c.id === "c-coax") paths = FIXED_RUNS[c.id];
    if (!paths) {   /* a run the student laid (or any run in build mode): drawn between where its two devices really are, bowed a little so two never sit on one line */
      const A = P[c.a.dev], Bp = P[c.b.dev]; if (!A || !Bp) continue;
      if (routed) { runs.push({ c: c, A: A, B: Bp, d: null, mid: null }); continue; }   /* the business's runs find their own way, once the devices and their names are drawn (below) */
      const dx = Bp.px - A.px, dy = Bp.py - A.py, L = Math.hypot(dx, dy) || 1, k = 0.12 * L * (runs.length % 2 ? -1 : 1);
      const cx = (A.px + Bp.px) / 2 - dy / L * k, cy = (A.py + Bp.py) / 2 + dx / L * k;
      runs.push({ c: c, d: ["M" + A.px + " " + A.py + " Q " + Math.round(cx) + " " + Math.round(cy) + " " + Bp.px + " " + Bp.py], mid: [(A.px + 2 * cx + Bp.px) / 4, (A.py + 2 * cy + Bp.py) / 4] });
      continue;
    }
    const n = (paths[paths.length - 1].match(/-?\d+/g) || []).map(Number);   /* halfway along the run itself: a straight line's middle, or a curve's */
    const mid = n.length === 8 ? [(n[0] + 3 * n[2] + 3 * n[4] + n[6]) / 8, (n[1] + 3 * n[3] + 3 * n[5] + n[7]) / 8] : n.length >= 4 ? [(n[0] + n[n.length - 2]) / 2, (n[1] + n[n.length - 1]) / 2] : null;
    runs.push({ c: c, d: paths, mid: mid });
  }
  const runClass = function (r, up) { return up ? (r.c.kind === "coax" ? "run-coax" : r.c.kind === "console" ? "run-con" : r.c.kind === "fibre" ? "run-fib" : "run") : "run-bad"; };
  for (const r of runs) {
    const up = sim.cableUp(r.c); if (!up) anyDown = true;
    if (!r.d) continue;
    for (const d of r.d) h += '<path data-ends="' + r.c.a.dev + ' ' + r.c.b.dev + '" class="' + runClass(r, up) + '" d="' + d + '"/>';
  }
  svg.innerHTML += h + names;
  const K = sim.d.cab, inK = K ? K.holds.filter(function (d) { return !!P[d]; }) : [];
  if (K && inK.length) {   /* the closet cabinet (SB-J6): a frame round what it holds, its state in words between them; it opens the cabinet's window */
    const xs = inK.map(function (d) { return P[d].px; }), ys = inK.map(function (d) { return P[d].py; }), x0 = Math.min.apply(null, xs) - 32, x1 = Math.max.apply(null, xs) + 32, y0 = Math.min.apply(null, ys) - 32, y1 = Math.max.apply(null, ys) + 32;
    const st = K.open ? "OPEN" : K.locked ? (K.key ? "LOCKED, KEY IN" : "LOCKED") : "SHUT";
    const g = mk("g", { class: "pcab" + (o.open === "cab" ? " open" : ""), tabindex: "0", role: "button", "aria-label": "Open the closet cabinet in the terminal. Its door: " + st.toLowerCase() + "." });
    g.dataset.d = "cab";
    g.appendChild(mk("rect", { class: "cabframe", x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 10 }));
    const t = mk("text", { class: "cabl", x: (x0 + x1) / 2, y: Math.max.apply(null, ys) - 30, "text-anchor": "middle" }); t.textContent = "CABINET: " + st; g.appendChild(t);   /* just above the lowest device's tile, so it sits between them, or over the one it holds (SB-J9's start, the router still boxed: at the frame's middle it fell behind the switch's tile) */
    svg.appendChild(g);
    try { const b = t.getBBox(), C = BUSINESS_ROOM_BOX.closet, w = b.width + 8; t.setAttribute("x", Math.round(Math.min(Math.max((x0 + x1) / 2, C[0] + 6 + w / 2), C[2] - 6 - w / 2))); } catch (e) {}   /* inside the closet's walls, however long its state ("LOCKED, KEY IN") */
  }
  for (const id of ids) {
    const p = P[id];
    const g = mk("g", { class: "pdev" + (o.open === id ? " open" : ""), tabindex: "0", role: "button", transform: "translate(" + p.px + " " + p.py + ")", "aria-label": "Open " + sim.d[id].label + " in the terminal" });
    g.dataset.d = id;
    g.appendChild(mk("rect", { class: "tile", x: -24, y: -24, width: 48, height: 48, rx: 9 }));
    g.appendChild(mk("use", { href: "#p-" + ICON_OF[id], x: -20, y: -20, width: 40, height: 40 }));
    const t = mk("text", { class: "ns", y: 47, "text-anchor": "middle" }); t.textContent = id === "laptop" && sim.d.laptop.label === "New laptop" ? "New laptop" : nameOf(id); g.appendChild(t);
    svg.appendChild(g);
  }
  if (routed) routeRuns(svg, runs.filter(function (r) { return !r.d; }).sort(function (p, q) { return Math.hypot(p.B.px - p.A.px, p.B.py - p.A.py) - Math.hypot(q.B.px - q.A.px, q.B.py - q.A.py); }), ids, P, function (r) { return runClass(r, sim.cableUp(r.c)); }, K ? K.holds : []);
  /* a diamond on each run that's down, and the words for it. It starts halfway along the run and slides along it to the first
     spot clear of every name (with its plate), tile and diamond already drawn: halfway, SB-J9's router-to-modem run put it on
     "Business router" and the cabinet's label (AAA 1.08:1). Where halfway is clear, it stays there */
  const words = [], tiles = [];   /* what a diamond may not cover: words first (a diamond on a name or the cabinet's label makes it unreadable), then tiles */
  svg.querySelectorAll(".ns, .rl, .cabl").forEach(function (n) { let b; try { b = n.getBBox(); } catch (e) { return; } if (!b.width) return; const tf = n.closest("[transform]"), m = tf && /translate\(([-\d.]+) ([-\d.]+)\)/.exec(tf.getAttribute("transform")), dx = m ? +m[1] : 0, dy = m ? +m[2] : 0; words.push([b.x + dx - 4, b.y + dy - 2, b.x + dx + b.width + 4, b.y + dy + b.height + 2]); });
  for (const id of ids) tiles.push([P[id].px - 24, P[id].py - 24, P[id].px + 24, P[id].py + 24]);
  const clearOf = function (x, y, list) { const q = [x - 12.5, y - 12.5, x + 12.5, y + 12.5]; return list.every(function (b) { return q[2] < b[0] || q[0] > b[2] || q[3] < b[1] || q[1] > b[3]; }); };   /* the diamond turned 45 degrees reaches 11.3 from its middle, and its ring a little more */
  for (const r of runs) {
    if (sim.cableUp(r.c) || !r.mid) continue;
    let x = r.mid[0], y = r.mid[1];
    const all = words.concat(tiles);
    if (!clearOf(x, y, all)) {   /* along the run: first a spot clear of everything; on a run that is covered end to end (SB-J9's router to its switch, under the router's name and the cabinet's label), a spot clear of the words, on a tile's edge */
      const tp = mk("path", { d: r.d[r.d.length - 1], fill: "none" }); svg.appendChild(tp);
      try { const L = tp.getTotalLength(), at = []; for (let k = 1; k <= 18; k++) at.push(0.5 + k * 0.025, 0.5 - k * 0.025);
        const pt = function (s) { return tp.getPointAtLength(L * s); };
        let q = at.map(pt).find(function (v) { return clearOf(v.x, v.y, all); });
        if (!q && !clearOf(x, y, words)) q = at.map(pt).find(function (v) { return clearOf(v.x, v.y, words); });
        if (q) { x = q.x; y = q.y; } } catch (e) {}
      tp.remove();
    }
    words.push([x - 12.5, y - 12.5, x + 12.5, y + 12.5]);
    svg.appendChild(mk("rect", { x: x - 8, y: y - 8, width: 16, height: 16, transform: "rotate(45 " + x + " " + y + ")", class: "pd-down" }));
  }
  if (anyDown) { const t = mk("text", { class: "ns", x: 46, y: 505 }); t.textContent = "red dashed run: no link"; svg.appendChild(t); }   /* on the garage floor (the office's entrance): nothing else is there */
  plates(svg, ".rl, .ns, .cabl", "#f4f6fb");
}
/* the small office: the network closet (the provider's line comes in on its wall), the front desk, the manager's office,
   the open-plan office, the meeting room, and the entrance under the closet */
function officeRooms() {
  const B = OFFICE_ROOM_BOX, r = function (k) { const b = B[k]; return '<rect class="room" x="' + b[0] + '" y="' + b[1] + '" width="' + (b[2] - b[0]) + '" height="' + (b[3] - b[1]) + '"/>'; };
  return r("closet") + r("front") + r("manager") + r("open") + r("meeting") + '<rect class="room" x="30" y="370" width="270" height="150"/>' +
    '<path class="door" d="M300 300v40M220 370h50M640 200v40M660 420v40M420 270h40M120 520h60"/><rect class="plate" x="26" y="108" width="14" height="24"/>';
}
/* the small business: the network closet (the provider's line on its wall), the counter or reception, the manager's office,
   the waiting area or café floor, the back (treatment rooms, kitchen, workshop), and the entrance under the closet. Its rooms'
   names are the business's own */
/* the business's runs (busier than a house's or the office's): each one a curve between its two devices, the least bent of the
   curves that pass under no other device's tile or name (with its plate and a little room round both), stay on the plan, keep
   off the rooms' names and the cabinet's label, and don't run alongside a run already drawn (crossing one is fine; running
   beside it reads as one cable). Where no curve is clear, the one that covers least. The bends tried: each third of the way
   along, pushed to one side or the other, so a run can swing round a device or thread between two. The shortest runs are laid
   first, so a short one (a console cable, a run inside one room) goes straight and the long ones find their way round it */
const BEND = [0, 12, -12, 24, -24, 36, -36, 50, -50, 65, -65, 80, -80, 100, -100, 120, -120, 145, -145, 170, -170];
const CURVES = (function () {
  const out = [], w = function (p) { return Math.abs(p[0]) + Math.abs(p[1]) + 0.5 * Math.abs(p[0] - p[1]); };
  for (const a of BEND) for (const b of BEND) out.push([a, b]);
  return out.sort(function (p, q) { return w(p) - w(q); });
})();
const ROUTES = new Map();
function routeRuns(svg, todo, ids, P, cls, held) {
  if (!todo.length) return;
  const vb = svg.getAttribute("viewBox").split(" ").map(Number), X0 = vb[0] + 4, Y0 = vb[1] + 4, X1 = vb[0] + vb[2] - 4, Y1 = vb[1] + vb[3] - 4;
  const boxOf = function (n, px, py) {
    let b; try { b = n.getBBox(); } catch (e) { return null; } if (!b.width) return null;
    const tf = n.closest("[transform]"), m = tf && /translate\(([-\d.]+) ([-\d.]+)\)/.exec(tf.getAttribute("transform")), dx = m ? +m[1] : 0, dy = m ? +m[2] : 0;
    return [b.x + dx - px, b.y + dy - py, b.x + dx + b.width + px, b.y + dy + b.height + py];
  };
  const R = 5, dev = [], lab = [], cab = [], walls = [];   /* R: the room kept round a tile or a name's plate (4 by 2, as plates() draws it) */
  for (const id of ids) dev.push([[P[id].px - 24 - R, P[id].py - 24 - R, P[id].px + 24 + R, P[id].py + 24 + R], id]);
  svg.querySelectorAll(".pdev .ns").forEach(function (t) { const b = boxOf(t, 4 + R, 2 + R); if (b) dev.push([b, t.closest(".pdev").dataset.d]); });
  svg.querySelectorAll(".rl").forEach(function (t) { const b = boxOf(t, 4, 2); if (b) lab.push(b); });
  svg.querySelectorAll(".cabl").forEach(function (t) { const b = boxOf(t, 4, 2); if (b) cab.push(b); });   /* the cabinet's label: a run between two things it holds may pass behind it, straight down the cabinet */
  svg.querySelectorAll("rect.room").forEach(function (q) { const x = +q.getAttribute("x"), y = +q.getAttribute("y"), w = +q.getAttribute("width"), h = +q.getAttribute("height"); walls.push([0, y, x, x + w], [0, y + h, x, x + w], [1, x, y, y + h], [1, x + w, y, y + h]); });
  const byWall = function (p) { return walls.some(function (w) { return w[0] ? Math.abs(p[0] - w[1]) < 6 && p[1] > w[2] - 2 && p[1] < w[3] + 2 : Math.abs(p[1] - w[1]) < 6 && p[0] > w[2] - 2 && p[0] < w[3] + 2; }); };   /* a run running along a wall reads as the wall */
  const before = svg.querySelector("text.rl") || svg.querySelector(".pcab, .pdev");
  const put = function (r, d) { const pe = mk("path", { "data-ends": r.c.a.dev + " " + r.c.b.dev, class: cls(r), d: d }); if (before) svg.insertBefore(pe, before); else svg.appendChild(pe); };
  /* the same devices, names and runs give the same routes: kept, so the plan redrawn after every action costs nothing more */
  const R0 = function (v) { return Math.round(v); }, sig = vb.join(" ") + "|" + dev.map(function (o) { return o[1] + ":" + o[0].map(R0).join(","); }).join(";") + "|" + lab.map(function (q) { return q.map(R0).join(","); }).join(";") + "|" + todo.map(function (r) { return [r.c.a.dev, r.c.b.dev, r.A.px, r.A.py, r.B.px, r.B.py].join(","); }).join(";");
  const kept = ROUTES.get(sig);
  if (kept) { todo.forEach(function (r, i) { r.d = [kept[i].d]; r.mid = kept[i].mid; put(r, kept[i].d); }); return; }
  const found = [];
  const grid = {}, G = 6, key = function (x, y) { return Math.floor(x / G) + "," + Math.floor(y / G); };   /* the runs already drawn, as points in 6-unit cells */
  const nearDrawn = function (x, y) { const i = Math.floor(x / G), j = Math.floor(y / G); for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) if (grid[(i + u) + "," + (j + v)]) return true; return false; };
  const inside = function (p, q) { return p[0] > q[0] && p[0] < q[2] && p[1] > q[1] && p[1] < q[3]; };
  for (const r of todo) {
    const a = r.A, b = r.B, ends = [r.c.a.dev, r.c.b.dev], dx = b.px - a.px, dy = b.py - a.py, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const n = Math.max(24, Math.ceil(L / 5)), others = dev.filter(function (o) { return ends.indexOf(o[1]) < 0; }).map(function (o) { return o[0]; });
    const step = L / n, inCab = held.indexOf(ends[0]) >= 0 && held.indexOf(ends[1]) >= 0;
    const curve = function (k) {
      const c1 = [a.px + dx / 3 + nx * k[0], a.py + dy / 3 + ny * k[0]], c2 = [a.px + 2 * dx / 3 + nx * k[1], a.py + 2 * dy / 3 + ny * k[1]], pts = [];
      for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * u * a.px + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b.px, u * u * u * a.py + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b.py]); }
      return { c1: c1, c2: c2, pts: pts };
    };
    let best = null, bestCost = Infinity;
    for (const k of CURVES) {
      const cv = curve(k);
      let hit = 0, near = 0, room = 0, word = 0, wall = 0;
      for (const p of cv.pts) {
        if (p[0] < X0 || p[0] > X1 || p[1] < Y0 || p[1] > Y1) hit++;
        else for (const q of others) if (inside(p, q)) { hit++; break; }
        if (1000 * hit >= bestCost) break;
        for (const q of lab) if (inside(p, q)) { room++; break; }
        if (!inCab) for (const q of cab) if (inside(p, q)) { word++; break; }
        if (Math.hypot(p[0] - a.px, p[1] - a.py) > 30 && Math.hypot(p[0] - b.px, p[1] - b.py) > 30) { if (nearDrawn(p[0], p[1])) near++; if (byWall(p)) wall++; }
      }
      const along = wall * step;   /* how far it runs beside a wall: a crossing at a shallow angle is some way, running along one is far */
      const c = 1000 * hit + 500 * room + 40 * word + 20 * Math.max(0, near - 3) + 3 * Math.max(0, along - 15) + (along > 70 ? 500 * (along - 70) : 0);   /* a device covered, or a room's name hiding the run, is never worth it; nor is running along a wall; beside the cabinet's label, another run or a wall, avoided where a curve can */
      if (c < bestCost) { best = cv; bestCost = c; }
      if (c === 0) break;
    }
    const f = function (v) { return Math.round(v); };
    r.d = ["M" + a.px + " " + a.py + " C " + f(best.c1[0]) + " " + f(best.c1[1]) + " " + f(best.c2[0]) + " " + f(best.c2[1]) + " " + b.px + " " + b.py];
    r.mid = [(a.px + 3 * best.c1[0] + 3 * best.c2[0] + b.px) / 8, (a.py + 3 * best.c1[1] + 3 * best.c2[1] + b.py) / 8];
    for (const p of best.pts) grid[key(p[0], p[1])] = 1;
    found.push({ d: r.d[0], mid: r.mid }); put(r, r.d[0]);
  }
  if (ROUTES.size > 60) ROUTES.clear();
  ROUTES.set(sig, found);
}
function businessRooms(sim) {
  const B = BUSINESS_ROOM_BOX, r = function (k) { const b = B[k]; return '<rect class="room" x="' + b[0] + '" y="' + b[1] + '" width="' + (b[2] - b[0]) + '" height="' + (b[3] - b[1]) + '"/>'; };
  const X = B.closet[2];   /* the closet's right wall: the counter and the waiting area start there, and the entrance is as wide */
  const E = B.closet[3];   /* the closet's floor: the entrance is under it, down to the front wall */
  return r("closet") + r("counter") + r("office") + r("guest") + r("back") + '<rect class="room" x="30" y="' + E + '" width="' + (X - 30) + '" height="' + (520 - E) + '"/>' +
    '<path class="door" d="M' + X + ' 200v40M640 150v40M420 270h50M780 270h40M660 400v40M' + X + ' ' + (E + 40) + 'v40M120 520h60"/><rect class="plate" x="26" y="108" width="14" height="24"/>' +
    (sim && sim.d.cam2 ? '<path class="door" d="M700 520h40"/>' : "") +   /* the back door: the back door camera (SB-J5) is on the wall outside it */
    (sim && sim.net.roomNames.dept ? r("dept") + '<path class="door" d="M900 520h40"/>' : "");   /* the department's room (SB-J10), through a door in the back room's wall */
}
function businessNames(sim) {
  const N = sim.net.roomNames, B = BUSINESS_ROOM_BOX, up = function (k) { return String(N[k] || "").toUpperCase().replace(/&/g, "&amp;").replace(/'/g, "&#39;"); };
  return ["closet", "counter", "office", "guest", "back"].map(function (k) { return '<text class="rl" x="' + (B[k][0] + 16) + '" y="' + (B[k][1] + 30) + '">' + up(k) + "</text>"; }).join("") + '<text class="rl" x="46" y="' + (B.closet[3] + 30) + '">ENTRANCE</text>' + (sim.d.cam2 ? '<text class="rl" x="450" y="572">OUTSIDE THE BACK DOOR</text>' : "") + (N.dept ? '<text class="rl" x="' + (B.dept[0] + 16) + '" y="' + (B.dept[3] - 14) + '">' + up("dept") + "</text>" : "");   /* the department's room's name at its foot: its runs come in at the top */
}
function officeNames() {
  return '<text class="rl" x="46" y="60">NETWORK CLOSET</text><text class="rl" x="316" y="60">FRONT DESK</text><text class="rl" x="656" y="60">MANAGER\'S OFFICE</text>' +
    '<text class="rl" x="316" y="300">OPEN-PLAN OFFICE</text><text class="rl" x="776" y="300">MEETING ROOM</text><text class="rl" x="46" y="400">ENTRANCE</text>';
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
