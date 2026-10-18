/* The page: the same desk on all three views (Ticket Desk, Lab Bench,
   Service Map); only the left column and the bar's title line change.
   The ticket, its network and the student's progress are shared, so a
   ticket opened on one view is the same ticket on the others. */
import { HOME_TICKETS, HOME_COMING } from "../tickets/home.js";
import { OFFICE_TICKETS, OFFICE_COMING } from "../tickets/office.js";
import { LEVELS, isOpen } from "./levels.js";
import * as E from "../tickets/engine.js";
import { HELP } from "../net/cmd.js";
import { load, store, newSeed, dyslexia, el } from "./store.js";
import { drawLogical, drawPlan, plates } from "./draw.js";
import { renderWindow, forgetTerminals, focusCmd } from "./window.js";
import { renderBoard } from "./board.js";
import { renderQueue, renderShelves, renderMap } from "./left.js";
import { setupInstructor } from "./instructor.js";
import { ipamSheet } from "./ipamui.js";
import { cableMap } from "./cablemapui.js";

const PAGE = document.body.dataset.page;
const S = load();
const DEFS = {}; HOME_TICKETS.concat(OFFICE_TICKETS).forEach(function (d) { DEFS[d.id] = d; });
const item = function (d) { return { id: d.id, n: d.n, tier: d.tier, title: d.title, level: d.level || 1, built: true }; };
const LIST = HOME_TICKETS.map(item).concat(HOME_COMING.map(function (c) { return Object.assign({ built: false, level: 1 }, c); }),
  OFFICE_TICKETS.map(item), OFFICE_COMING.map(function (c) { return Object.assign({ built: false }, c); }));   /* every level's tickets; the queue shows the chosen level's */
const DEVICES = ["pc", "switch", "msw", "pp", "mgr", "mjack", "meet", "bsw", "mpc", "router", "modem", "printer", "tech", "injector", "camera", "tv", "mesh", "laptop", "phone", "guest"];   /* an undocumented box gets no button: find it on the floor plan */
const $ = function (id) { return document.getElementById(id); };
let replateMap = null;

const ctx = {
  T: null, open: "pc", tab: null, fixHint: null, flash: null,
  get list() { return LIST; }, get solved() { return S.solved; }, get current() { return ctx.T && ctx.T.def.id; },
  get nextId() { const lv = (ctx.T && ctx.T.def.level) || 1, b = LIST.filter(function (t) { return t.built && t.level === lv; }); const i = b.findIndex(function (t) { return t.id === ctx.current; }); return b.length > 1 ? b[(i + 1) % b.length].id : null; },
  onReplate: function (f) { replateMap = f; },
  act: function (a) {
    const was = ctx.T.solved, r = E.act(ctx.T, a);
    if (ctx.T.solved && !was) S.solved[ctx.T.def.id] = (S.solved[ctx.T.def.id] || 0) + 1;
    persist(); renderLive();
    return r;
  },
  view: function (dev, key) {
    if (key === "cmd") return;
    const was = ctx.T.solved, proven = ctx.T.proven, partial = ctx.T.partial;
    E.act(ctx.T, { t: "view", dev: dev, key: key });   /* opening a page can prove a fix (a link back at 1 Gb/s, a phone showing internet) */
    if (ctx.T.solved && !was) S.solved[ctx.T.def.id] = (S.solved[ctx.T.def.id] || 0) + 1;
    persist(); renderNotebook();
    if (ctx.T.solved !== was || ctx.T.proven !== proven || ctx.T.partial !== partial) { renderBoardNow(); renderLeft(); }
  },
  guess: function (id) {
    const was = ctx.T.solved, r = E.guess(ctx.T, id);
    if (ctx.T.solved && !was) S.solved[ctx.T.def.id] = (S.solved[ctx.T.def.id] || 0) + 1;
    persist(); renderBoardNow(); renderLeft();
    const b = document.querySelector('[data-opt="' + id + '"]'); if (b) b.focus({ preventScroll: true });
    return r;
  },
  resetBoard: function () { E.resetBoard(ctx.T); persist(); renderBoardNow(); },
  resetNetwork: function () { E.resetNetwork(ctx.T); forgetTerminals(); persist(); renderAll(); },
  askFix: function () { ctx.fixHint = E.nextFixHint(ctx.T).text; persist(); renderBoardNow(); },
  again: function () { openTicket(ctx.T.def.id, true); window.scrollTo({ top: 0 }); },
  go: function (id) { openTicket(id, false); }
};

function persist() { S.t[ctx.T.def.id] = E.save(ctx.T); S.current = ctx.T.def.id; store(S); }

function openTicket(id, fresh, seed) {
  let def = DEFS[id] || HOME_TICKETS[0];
  if (!isOpen(def.level || 1)) def = HOME_TICKETS[0];   /* a level still locked opens nothing: back to the first ticket */
  let T = null;
  if (!fresh && S.t[def.id]) { try { T = E.restore(def, S.t[def.id]); } catch (e) { T = null; } }
  if (!T) T = E.open(def, seed == null ? newSeed() : seed);
  ctx.T = T; ctx.open = def.affected; ctx.tab = null; ctx.sheetChecked = false; ctx.level = def.level || 1; ctx.fixHint = T.fixHint ? def.fixHints(T.v, T.sim)[Math.min(T.fixHint, 3) - 1] : null;
  forgetTerminals(); persist(); renderAll();
}

/* ---------------------------------------------------------------- rendering */
function renderAll() { renderLeft(); renderTitle(); renderTicketCard(); renderRecords(); renderLive(); renderDevtabs(); renderWin(); }
function renderLive() { renderDiagram(); renderSteps(); renderBoardNow(); renderNotebook(); renderLeft(); renderDevtabs(); }
function renderLeft() {
  const host = $("left");
  if (PAGE === "bench") { const open = Array.from(host.querySelectorAll("details")).map(function (d) { return d.open; }); renderShelves(host, ctx); if (open.length) host.querySelectorAll("details").forEach(function (d, i) { d.open = open[i]; }); }
  else if (PAGE === "map") renderMap(host, ctx);
  else renderQueue(host, ctx);
}
function renderTitle() {
  const d = ctx.T.def, net = ctx.T.sim.net, lt = $("labtitle");
  const surname = net.client.name.replace(/^(Mrs?|Ms)\. /, ""), L = LEVELS[(d.level || 1) - 1], office = net.site === "office";
  const t = { desk: ["Ticket " + d.id + " · " + d.title, "Queue: Tier " + L.n + " · " + L.name + " · Rafiki's IT Services"], bench: ["Lab " + d.id + " · " + d.title, "Shelf: Network troubleshooting · Level: " + L.name],
    map: [(office ? net.client.name : surname + " home") + " · ticket " + d.id + " · " + d.title, office ? "Site: Small office, " + net.client.street + " · Level 2: Small office" : "Site: Client homes, Maple Street · Level 1: Home"] }[PAGE];
  lt.textContent = t[0]; lt.appendChild(el("small", null, t[1]));
  document.title = d.id + " · " + { desk: "Ticket Desk", bench: "Lab Bench", map: "Service Map" }[PAGE] + " · The E4 Mafia Network";
}
function renderTicketCard() {
  const T = ctx.T, d = T.def, net = T.sim.net, b = d.brief(T.v, T.sim), tk = $("tk");
  tk.innerHTML = "";
  tk.appendChild(el("h3", { tabindex: "-1", id: "tkh" }, d.id + " · " + d.title));
  tk.appendChild(el("div", { class: "meta" }, el("b", null, "Priority " + d.priority), el("br"), "Due in " + d.due));
  tk.appendChild(el("p", { class: "from" }, net.client.name + " · " + net.client.street + " · " + (net.site === "office" ? "office network" : "home network")));
  tk.appendChild(el("p", { class: "q" }, "“" + b.quote + "”"));
  tk.appendChild(el("p", { class: "mason2" }, el("b", null, "Mason: "), d.mason));
}
/* a ticket that needs the office's records shows them under the ticket: the IPAM sheet (SO-09), the cable map (SO-08).
   Checking the sheet is evidence like any other; saving either changes the records, and is replayed like the rest.
   Redrawn only by their own buttons and a new ticket, so what's typed in them survives commands run meanwhile. */
function renderRecords() {
  let host = $("records"); const T = ctx.T;
  if (!T.def.ipam && !T.def.cablemap) { if (host) host.remove(); return; }
  if (!host) { host = el("section", { class: "box records", id: "records", "aria-label": "The office's records" }); $("ticket").after(host); }
  host.innerHTML = "";
  if (T.def.cablemap) {
    const map = T.sim.net.cablemap || {}, ports = Object.keys(map);
    T.sim.cablesOf("pp").forEach(function (c) { const e = c.a.dev === "pp" ? c.a : c.b; if (/R$/.test(e.port) && ports.indexOf(e.port.slice(0, -1)) < 0) ports.push(e.port.slice(0, -1)); });
    cableMap(host, { map: map, ports: ports.sort(function (a, b) { return a - b; }), saved: T.net.some(function (a) { return a.t === "cablemap"; }),
      onSave: function (m) { ctx.act({ t: "cablemap", map: m }); renderRecords(); $("cmapSave").focus(); } });
    return;
  }
  const checked = ctx.sheetChecked || T.evidence.some(function (e) { return e.id === "sheet"; }) || T.net.some(function (a) { return a.t === "ipam"; });
  ipamSheet(host, { plan: T.sim.net.plan.ipam, saved: T.sim.net.ipam, checked: checked, note: "The office's address plan, as it's written in the records. Check it here, and correct and save it: the sheet says what's wrong, never what the right value is.",
    onCheck: function () { ctx.sheetChecked = true; ctx.act({ t: "ipamcheck" }); renderRecords(); $("ipamCheck").focus(); },
    onSave: function (rows) { ctx.sheetChecked = true; ctx.act({ t: "ipam", rows: rows }); renderRecords(); $("ipamSave").focus(); } });
}
function renderDiagram() {
  drawLogical($("net"), ctx.T.sim, { open: ctx.open });
  drawPlan($("plan"), ctx.T.sim, { open: ctx.open });
}
function renderSteps() {
  const s = $("steps"), tr = ctx.T.sim.lastTrace;
  s.innerHTML = "";
  s.appendChild(el("h4", null, "Step through: the last ping's packets, hop by hop"));
  if (!tr || !tr.length) { s.appendChild(el("p", null, "Run a ping on a computer (Command Prompt) and its packets show here: the ARP question, the frame, what each device does with it.")); return; }
  const tb = el("tbody");
  tr.forEach(function (st, i) { tb.appendChild(el("tr", null, el("td", null, String(i + 1)), el("td", null, st.at), el("td", null, st.what), el("td", null, st.l2 ? el("code", null, st.l2) : ""), el("td", null, st.l3 ? el("code", null, st.l3) : ""), el("td", { class: st.ok ? "ok-t" : "bad-t" }, st.ok ? "OK" : "Stopped"))); });
  s.appendChild(el("table", null, el("thead", null, el("tr", null, el("th", null, "Step"), el("th", null, "Where"), el("th", null, "What happens"), el("th", null, "Frame (hardware addresses)"), el("th", null, "Packet (IP)"), el("th", null, "Status"))), tb));
}
function renderBoardNow() { renderBoard($("board"), ctx); }
function renderNotebook() {
  const nb = $("notebook"), T = ctx.T;
  const keep = nb.querySelector("textarea"), focused = keep && document.activeElement === keep;
  nb.innerHTML = "";
  nb.appendChild(el("h2", null, "Notebook · what you've found"));
  if (T.evidence.length) { const ol = el("ol"); T.evidence.forEach(function (e) { ol.appendChild(el("li", null, e.text)); }); nb.appendChild(ol); }
  else nb.appendChild(el("p", { class: "empty" }, "Nothing yet. Run commands, open device pages, read the lights and look at the cables: what you find is written here."));
  const ta = el("textarea", { id: "notes", "aria-describedby": "noteshelp" }); ta.value = T.notes || "";
  ta.addEventListener("input", function () { T.notes = ta.value; persist(); });
  nb.appendChild(el("label", { for: "notes", id: "noteshelp" }, "Your own notes (saved in this browser)"));
  nb.appendChild(ta);
  if (focused) ta.focus();
}
function renderDevtabs() {
  const dt = $("devtabs"); dt.innerHTML = "";
  DEVICES.forEach(function (id) { const d = ctx.T.sim.d[id]; if (!d) return; dt.appendChild(el("button", { type: "button", "data-d": id, "aria-pressed": String(id === ctx.open), onclick: function () { openDevice(id); } }, d.label)); });
  $("termtitle").textContent = "Terminal · " + ctx.T.sim.d[ctx.open].label;
}
function renderWin() { renderWindow($("win"), ctx); }

function openDevice(id) {
  ctx.open = id; ctx.tab = null;
  renderDevtabs(); renderWin();
  ["net", "plan"].forEach(function (s) { $(s).querySelectorAll("[data-d]").forEach(function (g) { g.classList.toggle("open", g.dataset.d === id); }); });
  const first = ctx.tab; if (first && first !== "cmd") ctx.view(id, first);
  if (window.innerWidth <= 1100) document.querySelector(".side").scrollIntoView({ block: "start" });
  if (ctx.tab === "cmd") focusCmd(id);
}

/* ---------------------------------------------------------------- the bars and the rest */
function setView(phy) {
  $("net").toggleAttribute("hidden", phy); $("plan").toggleAttribute("hidden", !phy);   /* SVG elements have no .hidden property: set the attribute */
  $("vLog").setAttribute("aria-pressed", String(!phy)); $("vPhy").setAttribute("aria-pressed", String(phy));
  if (phy) plates($("plan"), ".rl, .ns", "#f4f6fb");
}
function setTime(step) { $("steps").toggleAttribute("hidden", !step); $("tLive").setAttribute("aria-pressed", String(!step)); $("tStep").setAttribute("aria-pressed", String(step)); }
function replateAll() {
  if (!ctx.T) return;
  plates($("net"), ".nl, .ns, .pl"); if (!$("plan").hasAttribute("hidden")) plates($("plan"), ".rl, .ns", "#f4f6fb");
  if (replateMap) replateMap();
}
function chromeH() { document.documentElement.style.setProperty("--chromeH", document.querySelector(".chrome").offsetHeight + "px"); }
function deviceClicks(svg) {
  const go = function (e) { const g = e.target.closest("[data-d]"); if (!g) return; if (e.type === "keydown") { if (e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); } openDevice(g.dataset.d); };
  svg.addEventListener("click", go); svg.addEventListener("keydown", go);
}
function helpDialog() {
  const d = $("help"), tb = d.querySelector("tbody");
  HELP.forEach(function (h) { tb.appendChild(el("tr", null, el("td", null, el("code", null, h[0])), el("td", null, h[1]))); });
  $("mHelp").addEventListener("click", function () { d.showModal(); });
  d.querySelector(".x").addEventListener("click", function () { d.close(); });
}

dyslexia($("dys"), function () { if (ctx.T) renderDiagram(); replateAll(); });   /* the diagram redrawn: its port markers keep off labels measured in the font now in use */
if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (ctx.T) { renderDiagram(); replateAll(); } });   /* once the fonts are in, measure the labels again */
$("vLog").addEventListener("click", function () { setView(false); });
$("vPhy").addEventListener("click", function () { setView(true); });
$("tLive").addEventListener("click", function () { setTime(false); });
$("tStep").addEventListener("click", function () { setTime(true); });
$("mTicket").addEventListener("click", function () { $("ticket").scrollIntoView({ block: "start" }); const h = $("tkh"); if (h) h.focus({ preventScroll: true }); });
$("mView").addEventListener("click", function () { setView($("plan").hasAttribute("hidden")); });
$("mNotes").addEventListener("click", function () { $("notebook").scrollIntoView({ block: "nearest" }); const t = $("notes"); if (t) t.focus({ preventScroll: true }); });
deviceClicks($("net")); deviceClicks($("plan"));
helpDialog();
setupInstructor(ctx, {
  levels: function () { renderLeft(); },
  demo: function (id, seed) { openTicket(id, true, seed); window.scrollTo({ top: 0 }); },
  clear: function () { Object.keys(S.t).forEach(function (k) { delete S.t[k]; }); Object.keys(S.solved).forEach(function (k) { delete S.solved[k]; }); openTicket(HOME_TICKETS[0].id, true); }
});
chromeH(); window.addEventListener("resize", chromeH);
openTicket(S.current && DEFS[S.current] ? S.current : HOME_TICKETS[0].id, false);
if (location.hash === "#physical") setView(true);
if (location.hash === "#step") setTime(true);
window.__e4 = ctx;   /* for the checks that drive this page */
