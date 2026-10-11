/* The left column, the only thing that differs between the three views:
   the Ticket Desk's queue, the Lab Bench's shelves, the Service Map. */
import { el } from "./store.js";
import { ICONS } from "./draw.js";

function status(ctx, t) {
  if (!t.built) return { text: "Coming next", cls: "" };
  const n = ctx.solved[t.id] || 0;
  if (t.id === ctx.current) return { text: "Open · you" + (n ? " · solved " + n + "×" : ""), cls: n ? "solved" : "" };
  if (n) return { text: "Solved " + n + "×", cls: "solved" };
  return { text: "New", cls: "" };
}
function ticketButton(ctx, t, numText, stText) {
  const s = status(ctx, t);
  const b = el("button", { type: "button", "data-t": t.id, "aria-current": t.id === ctx.current ? "true" : null, "aria-disabled": t.built ? null : "true" },
    el("span", { class: "num" }, numText || t.n), el("span", { class: "what" }, t.title), el("span", { class: "st" + (s.cls ? " " + s.cls : "") }, stText || s.text));
  b.addEventListener("click", function () { if (t.built) ctx.go(t.id); });
  return b;
}

export function renderQueue(host, ctx) {
  host.innerHTML = "";
  host.appendChild(el("h2", null, "Queue · Tier 1 · Home"));
  const ol = el("ol", { id: "queue" });
  ol.appendChild(el("li", { class: "tier" }, "Tier 1 · Home · the most common"));
  ctx.list.filter(function (t) { return t.tier === "common"; }).forEach(function (t) { ol.appendChild(el("li", null, ticketButton(ctx, t))); });
  ol.appendChild(el("li", { class: "tier" }, "Tier 1 · Home · harder"));
  ctx.list.filter(function (t) { return t.tier === "harder"; }).forEach(function (t) { ol.appendChild(el("li", null, ticketButton(ctx, t))); });
  ol.appendChild(el("li", { class: "tier" }, "Tier 1 · Home · five more"));
  ctx.list.filter(function (t) { return t.tier === "more"; }).forEach(function (t) { ol.appendChild(el("li", null, ticketButton(ctx, t))); });
  host.appendChild(ol);
}

const SHELVES = [
  ["Networking concepts", "23%", [["Ports and protocols on the wire", "Step through"], ["Addressing: public, private, APIPA", ""], ["VLSM-CIDR plan", "Network-Sims"], ["Topologies side by side", ""]]],
  ["Network implementation", "20%", [["Switch Port Configuration", "Network-Sims"], ["VLANs and trunks", ""], ["Network Routing", "Network-Sims"], ["STP Switches", "Network-Sims"], ["Wireless: channels, SSIDs, security", ""]]],
  ["Network operations", "19%", [["Device Placement and Configuration", "Network-Sims"], ["Network Performance", "Network-Sims"], ["Diagrams, IPAM, baselines", ""], ["DHCP, DNS, NTP services", ""]]],
  ["Network security", "14%", [["Firewall ACL Analysis", "Network-Sims"], ["Segmentation: guest, IoT", ""], ["Hardening a switch", ""], ["Rogue DHCP, ARP spoofing", ""]]],
  ["Network troubleshooting", "24%", null]
];
export function renderShelves(host, ctx) {
  host.innerHTML = "";
  host.appendChild(el("h2", null, "Labs · shelves by domain"));
  SHELVES.forEach(function (sh) {
    const d = el("details", { class: "shelf", open: sh[2] === null ? true : null });
    d.appendChild(el("summary", null, el("span", { class: "sh" }, sh[0]), el("span", { class: "pct" }, sh[1] + " of the exam")));
    const ol = el("ol");
    if (sh[2] === null) {
      ol.appendChild(el("li", { class: "tier" }, "Home · the most common"));
      ctx.list.filter(function (t) { return t.tier === "common"; }).forEach(function (t) { ol.appendChild(el("li", null, ticketButton(ctx, t))); });
      ol.appendChild(el("li", { class: "tier" }, "Home · harder"));
      ctx.list.filter(function (t) { return t.tier === "harder"; }).forEach(function (t) { ol.appendChild(el("li", null, ticketButton(ctx, t))); });
      ol.appendChild(el("li", { class: "tier" }, "Home · five more"));
      ctx.list.filter(function (t) { return t.tier === "more"; }).forEach(function (t) { ol.appendChild(el("li", null, ticketButton(ctx, t))); });
      ol.appendChild(el("li", { class: "tier" }, "From the Network-Sims"));
      ["Network Troubleshooting", "Routing Table Troubleshooting", "STP Troubleshooting", "Switch CLI Output Analysis"].forEach(function (n) { ol.appendChild(el("li", null, el("button", { type: "button", "aria-disabled": "true" }, el("span", { class: "num" }, "·"), el("span", { class: "what" }, n), el("span", { class: "st" }, "Network-Sims · at a later level")))); });
    } else {
      sh[2].forEach(function (l) { ol.appendChild(el("li", null, el("button", { type: "button", "aria-disabled": "true" }, el("span", { class: "num" }, "·"), el("span", { class: "what" }, l[0]), el("span", { class: "st" }, (l[1] ? l[1] + " · " : "") + "at a later level")))); });
    }
    d.appendChild(ol);
    host.appendChild(d);
  });
}

const SITES = [
  { id: "ispA", icon: "cloud", name: "Provider A", sub: "BGP", level: "Level 5 · Enterprise", topo: "The internet edge", obj: ["BGP to two providers", "Public vs private addressing", "Anycast DNS"], links: "BGP with HQ, and the internet for the client homes." },
  { id: "homes", icon: "router", name: "Client homes", sub: "Maple Street", level: "Level 1 · Home", topo: "Star round the home router, plus wireless mesh", obj: ["SOHO addressing: DHCP, APIPA, private ranges", "Wi-Fi: channels, bands, security", "Cabling and connectors; the cable tester", "Troubleshooting method, ping, ipconfig"], links: "The provider only. Nothing else on the map needs to reach a client's home.", open: true },
  { id: "dental", icon: "switch", name: "Dental office", sub: "Small office", level: "Level 2 · Small office", topo: "Star on a managed switch", obj: ["First managed switch: hostname, passwords, SSH", "Port settings, speed and duplex", "Subnetting the office", "Device placement in the building"], links: "A VPN to Rafiki HQ for remote support." },
  { id: "bakery", icon: "firewall", short: "Bakery ×3", name: "Bakery, 3 shops", sub: "Small business", level: "Level 3 · Small business", topo: "VLANs on one switch per shop, router on a stick", obj: ["VLANs, trunks, inter-VLAN routing", "DHCP scope per VLAN, guest Wi-Fi kept apart", "ACLs, NAT/PAT", "Point-of-sale segmentation (PCI DSS)"], links: "VPN between the three shops." },
  { id: "hq", icon: "server", name: "Rafiki HQ", sub: "Campus", level: "Level 4 · Campus", topo: "Three-tier: core, distribution, access", obj: ["Spanning tree, link aggregation", "OSPF, first-hop redundancy", "Port security, NAC, monitoring (SNMP, syslog)", "Documentation, change management, disaster recovery"], links: "Hub for the branches, leased line to the annex, core routers to the data center and cloud." },
  { id: "annex", icon: "switch", short: "Annex", name: "Warehouse annex", sub: "Collapsed core", level: "Level 4 · Campus", topo: "Collapsed core", obj: ["Collapsed core vs three-tier", "Leased line (point-to-point)", "MTU, jumbo frames"], links: "Leased line to HQ." },
  { id: "branch", icon: "router", name: "Branches ×3", sub: "Hub and spoke", level: "Level 5 · Enterprise", topo: "Hub and spoke back to HQ", obj: ["Static and dynamic routing, route selection", "Default routes, routing tables", "Site-to-site VPN"], links: "WAN to HQ (the hub)." },
  { id: "dc", icon: "server", name: "Data center", sub: "Spine and leaf", level: "Level 5 · Enterprise", topo: "Spine and leaf", obj: ["Spine and leaf", "Load balancers, NAS, SAN", "Screened subnet, firewall zones", "Hot/warm/cold sites, RPO, RTO"], links: "Core routers to HQ, VPN to the cloud, BGP to Provider B." },
  { id: "cloud", icon: "cloud", name: "Cloud", sub: "VPC", level: "Level 5 · Enterprise", topo: "Hybrid: on-site plus cloud", obj: ["VPC, security groups, cloud gateway", "IaaS, PaaS, SaaS; public, private, hybrid", "NFV"], links: "VPN gateway to the data center, WAN to HQ." },
  { id: "ispB", icon: "cloud", name: "Provider B", sub: "BGP", level: "Level 5 · Enterprise", topo: "The internet edge", obj: ["Dual-homed internet, failover"], links: "BGP with HQ and the data center." }
];
const LINKS = [["homes", "ispA", "wan-bgp"], ["dental", "hq", "wan-vpn"], ["bakery", "dental", "wan-vpn"], ["hq", "annex", "wan-p2p"], ["hq", "branch", "wan"], ["hq", "dc", "wan"], ["dc", "cloud", "wan-vpn"], ["hq", "cloud", "wan"], ["hq", "ispA", "wan-bgp"], ["dc", "ispB", "wan-bgp"], ["hq", "ispB", "wan-bgp"]];
let picked = "homes";

export function renderMap(host, ctx) {
  host.innerHTML = "";
  host.appendChild(el("h2", null, "Service area · pick a site"));
  const NSV = "http://www.w3.org/2000/svg", PX = 90, Y0 = 46, DY = 84, by = {};
  SITES.forEach(function (s, i) { s.y = Y0 + i * DY; by[s.id] = s; });
  const svg = document.createElementNS(NSV, "svg");
  svg.setAttribute("id", "map"); svg.setAttribute("viewBox", "0 0 260 850"); svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Map of Rafiki's service area, top to bottom: Provider A, client homes, dental office, bakery, Rafiki HQ, warehouse annex, branches, data center, cloud, Provider B, with the links between them drawn down the left.");
  let h = "<defs>" + Object.keys(ICONS).map(function (k) { return '<symbol id="m-' + k + '" viewBox="0 0 64 64">' + ICONS[k] + "</symbol>"; }).join("") + "</defs>";
  h += '<rect class="land" width="260" height="850"/><path class="river" d="M260 300 C 200 330 230 420 170 450 S 120 560 0 600"/>';
  LINKS.forEach(function (l) { const a = by[l[0]], b = by[l[1]], span = Math.abs(a.y - b.y) / DY, x = PX - 24 - (10 + 8 * span); h += '<path class="' + l[2] + '" d="M' + (PX - 24) + " " + a.y + " C " + x + " " + a.y + ", " + x + " " + b.y + ", " + (PX - 24) + " " + b.y + '"/>'; });
  svg.innerHTML = h;
  SITES.forEach(function (s) {
    const g = document.createElementNS(NSV, "g");
    g.setAttribute("class", "pin" + (s.id === picked ? " sel" : "")); g.setAttribute("tabindex", "0"); g.setAttribute("role", "button"); g.setAttribute("aria-label", s.name + ", " + s.sub); g.dataset.site = s.id;
    g.setAttribute("transform", "translate(" + PX + " " + s.y + ")");
    g.innerHTML = '<rect class="hit" x="-30" y="-32" width="196" height="64" rx="8"/><circle class="halo" r="24"/><use href="#m-' + s.icon + '" x="-18" y="-18" width="36" height="36"/><text class="pl1" x="36" y="-2"></text><text class="pl2" x="36" y="16"></text>';
    g.querySelector(".pl1").textContent = s.short || s.name; g.querySelector(".pl2").textContent = s.sub;
    const pick = function () { picked = s.id; renderMap(host, ctx); const n = host.querySelector('[data-site="' + s.id + '"]'); if (n) n.focus({ preventScroll: true }); };
    g.addEventListener("click", pick); g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    svg.appendChild(g);
  });
  host.appendChild(el("div", { class: "mapwrap" }, svg));
  host.appendChild(el("div", { class: "legend" }, el("span", null, el("i"), "WAN link"), el("span", null, el("i", { class: "p2p" }), "Leased line"), el("span", null, el("i", { class: "vpn" }), "VPN over the internet"), el("span", null, el("i", { class: "bgp" }), "Providers (BGP)")));
  const s = by[picked];
  const card = el("div", { class: "card", "aria-live": "polite", id: "card" });
  card.appendChild(el("h3", null, s.name + " · " + s.sub));
  card.appendChild(el("p", { class: "lvl" }, s.level));
  const dl = el("dl");
  dl.appendChild(el("dt", null, "Topology")); dl.appendChild(el("dd", null, s.topo));
  dl.appendChild(el("dt", null, "Teaches")); const ul = el("ul"); s.obj.forEach(function (o) { ul.appendChild(el("li", null, o)); }); dl.appendChild(el("dd", null, ul));
  dl.appendChild(el("dt", null, "Connects to")); dl.appendChild(el("dd", null, s.links));
  card.appendChild(dl);
  if (s.open) {
    card.appendChild(el("p", { class: "lvl", style: "margin-top:10px" }, "Tickets at the client homes"));
    const tl = el("ul", { class: "tickets" });
    ctx.list.forEach(function (t) { tl.appendChild(el("li", null, ticketButton(ctx, t))); });
    card.appendChild(tl);
  } else card.appendChild(el("p", { class: "later" }, "Opens at " + s.level.split(" · ")[0] + "."));
  host.appendChild(card);
  const fix = function () { const lb = svg.querySelectorAll(".pl1, .pl2"); svg.querySelectorAll(".lpbg").forEach(function (r) { r.remove(); }); lb.forEach(function (t) { let b; try { b = t.getBBox(); } catch (e) { return; } const r = document.createElementNS(NSV, "rect"); r.setAttribute("x", b.x - 4); r.setAttribute("y", b.y - 2); r.setAttribute("width", b.width + 8); r.setAttribute("height", b.height + 4); r.setAttribute("rx", 3); r.setAttribute("class", "lpbg"); t.parentNode.insertBefore(r, t); }); };
  fix(); ctx.onReplate(fix);
}
