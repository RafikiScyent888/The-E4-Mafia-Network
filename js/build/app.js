/* The build page: a client job worked from its work order. The left column
   lists the jobs, the middle has the order, the tools to place and cable,
   the house and its cable runs, and "Check the job"; the right has the same
   terminal and device pages as the Ticket Desk, and the job notes. Every
   change goes through the build engine, so a job replays exactly. */
import { JOBS, JOBS_COMING, NAME, IN } from "./jobs.js";
import { OFFICE_JOBS } from "./office.js";
import { BUSINESS_JOBS } from "./business.js";
import * as B from "./engine.js";
import { HELP } from "../net/cmd.js";
import { portsOf, portName, FIXED_ROOM, runLength, COPPER_MAX } from "../net/sim.js";
import { ROOMS } from "../net/home.js";
import { newSeed, dyslexia, el } from "../desk/store.js";
import { drawLogical, drawPlan, plates } from "../desk/draw.js";
import { renderWindow, forgetTerminals, focusCmd } from "../desk/window.js";
import { setupInstructor } from "../desk/instructor.js";
import { LEVELS, isOpen, levelOfJob, finished, built, counts, progress, openHere, setOpenHere, instructorOn } from "../desk/levels.js";
import { levelList, lockPanel } from "../desk/levelsui.js";
import { ipamSheet as sheetForm } from "../desk/ipamui.js";
import { cableMap } from "../desk/cablemapui.js";

const KEY = "e4-build-v1";
const ALL = JOBS.concat(OFFICE_JOBS, BUSINESS_JOBS);   /* every level's work orders */
const DEFS = {}; ALL.forEach(function (d) { DEFS[d.id] = d; });
const ORDER = ["modem", "router", "rtr", "switch", "pp", "msw", "bsw", "pc", "mgr", "bpc", "hire", "printer", "mpc", "ojack", "mjack", "tv", "injector", "injector2", "ap", "camera", "mesh", "phone", "laptop", "guest", "cinj1", "cam1", "cinj2", "cam2", "mphone", "tech"];
const ROOM_ORDER = ["living", "office", "kitchen", "garage", "upstairs", "landing", "porch"];
/* the site's own rooms, names and fixed places: a house, the small office or the small business */
const roomsOf = function (sim) { return sim.net.roomNames ? Object.keys(sim.net.roomNames) : ROOM_ORDER; };
const roomName = function (sim, r) { return (sim.net.roomNames || ROOMS)[r]; };
const fixedOf = function (sim) { return sim.net.fixed || FIXED_ROOM; };
/* "the network closet", "the waiting room": a room mid-sentence. The business's rooms are its own (a clinic's reception, a café's kitchen) */
const inRoom = function (sim, r) { return sim.net.site === "business" ? "the " + String(sim.net.roomNames[r]).replace(/^[A-Z](?=[a-z])/, function (m) { return m.toLowerCase(); }) : IN[r]; };
/* "the router", "the managed switch", "your laptop": a device's name mid-sentence */
const theName = function (sim, id) { if (id === "tech") return "your laptop"; return "the " + (sim.net.site ? sim.d[id].label.replace(/^[A-Z](?=[a-z])/, function (m) { return m.toLowerCase(); }) : NAME[id]); };
const $ = function (id) { return document.getElementById(id); };
const cap = function (s) { return s[0].toUpperCase() + s.slice(1); };
const S = load();

function load() { let s = null; try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; } if (!s || typeof s !== "object") s = {}; s.j = s.j || {}; s.done = s.done || {}; return s; }
function persist() { S.j[ctx.T.def.id] = B.save(ctx.T); S.current = ctx.T.def.id; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private window: progress lasts for this visit */ } }

const ctx = {
  T: null, open: "modem", tab: null, flash: null, said: null, level: null,
  act: function (a) { const was = ctx.T.done; ctx.said = null; const r = B.act(ctx.T, a); persist(); renderLive(); if (ctx.T.done !== was) renderLeft(); return r; },
  view: function () { },   /* opening a page changes nothing in a job */
  get list() { return ALL.map(function (d) { return { id: d.id, title: d.id + " · " + d.title, built: true }; }); }
};

/* ---------------------------------------------------------------- names for ports and devices */
function portLabel(x, port) { return /^\d+$/.test(port) ? "port " + port : portName(x, port); }   /* the name printed by the port on the device */
function endLabel(sim, e) { if (sim.d[e.dev] && sim.d[e.dev].kind === "patchpanel" && /R$/.test(e.port)) return sim.d[e.dev].label + ", a run punched down at the back"; return e.dev === "wall" ? "Wall outlet (coax)" : sim.d[e.dev].label + ", " + (e.port === "CABLE IN" ? "CABLE IN" : portLabel(sim.d[e.dev], e.port)); }   /* which port a run is punched down on is for the tone and the probe to find */
const shown = function (sim, id) { return !!sim.d[id] && !sim.d[id].boxed; };
const devices = function (sim) { return ORDER.filter(function (id) { return !!sim.d[id]; }); };

/* ---------------------------------------------------------------- opening a job */
function openJob(id, fresh, seed) {
  let def = DEFS[id] || JOBS[0];
  if (!isOpen(levelOfJob(def.id).n)) def = JOBS[0];   /* a level still locked (the instructor's unlock ended with their tab) opens nothing: back to the first job */
  let J = null;
  if (!fresh && S.j[def.id]) { try { J = B.restore(def, S.j[def.id]); } catch (e) { J = null; } }
  if (!J) J = B.open(def, seed == null ? newSeed() : seed);
  ctx.T = J; ctx.open = shown(J.sim, "router") ? "router" : "modem"; ctx.tab = null; ctx.said = null; ctx.level = levelOfJob(def.id).n;
  forgetTerminals(); persist(); renderAll();
}

/* ---------------------------------------------------------------- rendering */
function renderAll() { renderLeft(); renderTitle(); renderOrder(); renderLive(); renderWin(); renderNotes(); }
function renderLive() { renderBuild(); renderDiagram(); renderRuns(); renderCheck(); renderDevtabs(); }
function renderWin() { if (!shown(ctx.T.sim, ctx.open)) ctx.open = "modem"; renderWindow($("win"), ctx); }

function renderLeft() {
  const host = $("left"); host.innerHTML = "";
  host.appendChild(el("h2", null, "Levels"));
  const L = LEVELS[ctx.level - 1], open = isOpen(L.n);
  host.appendChild(levelList({ selected: L.n, onPick: function (n, isOpenNow) {
    ctx.level = n;
    if (isOpenNow) { const Lv = LEVELS[n - 1], pick = Lv.jobs.find(function (id) { return !S.done[id]; }) || Lv.jobs[0]; if (pick && levelOfJob(ctx.T.def.id).n !== n) { openJob(pick, false); return; } }
    renderLeft(); const b = document.querySelector('#left [data-level="' + n + '"]'); if (b) b.focus({ preventScroll: true });
  } }));
  if (!open) host.appendChild(lockPanel(L.n));
  host.appendChild(el("h2", null, "Client jobs · " + L.name));
  const ol = el("ol", { id: "queue" });
  ol.appendChild(el("li", { class: "tier" }, "Work orders"));
  const item = function (d) {
    const n = S.done[d.id] || 0, cur = ctx.T && d.id === ctx.T.def.id;
    if (!open) { ol.appendChild(el("li", null, el("button", { type: "button", class: "locked", "data-j": d.id, "aria-disabled": "true" }, el("span", { class: "num" }, d.id), el("span", { class: "what" }, d.title), el("span", { class: "st" }, el("span", { "aria-hidden": "true" }, "\u{1F512} "), "Locked")))); return; }
    const st = cur ? "Open · you" + (n ? " · done " + n + "×" : "") : n ? "Done " + n + "×" : "New";
    ol.appendChild(el("li", null, el("button", { type: "button", "data-j": d.id, "aria-current": cur ? "true" : null, onclick: function () { openJob(d.id, false); } }, el("span", { class: "num" }, d.id), el("span", { class: "what" }, d.title), el("span", { class: "st" + (n ? " solved" : "") }, st))));
  };
  L.jobs.forEach(function (id) { item(DEFS[id]); });
  if (L.n === 1) {
    JOBS_COMING.forEach(function (c) { ol.appendChild(el("li", null, el("button", { type: "button", "aria-disabled": "true" }, el("span", { class: "num" }, c.id), el("span", { class: "what" }, c.title), el("span", { class: "st" }, "Coming next")))); });
    ol.appendChild(el("li", { class: "tier" }, "Your own"));
    JOBS.filter(function (d) { return d.free; }).forEach(item);
  }
  if (L.coming) ol.appendChild(el("li", { class: "tier" }, L.coming.charAt(0).toUpperCase() + L.coming.slice(1)));
  host.appendChild(ol);
}
function renderTitle() {
  const d = ctx.T.def, lt = $("labtitle");
  lt.textContent = "Client job " + d.id + " · " + d.title; lt.appendChild(el("small", null, "Client jobs · Level " + levelOfJob(d.id).n + " · " + levelOfJob(d.id).name + " · Rafiki's IT Services"));
  document.title = d.id + " · Build · The E4 Mafia Network";
}
function renderOrder() {
  const J = ctx.T, d = J.def, net = J.sim.net, b = d.brief(J.v, J.sim), tk = $("tk");
  tk.innerHTML = "";
  tk.appendChild(el("h3", { tabindex: "-1", id: "tkh" }, d.id + " · " + d.title));
  tk.appendChild(el("div", { class: "meta" }, el("b", null, "Work order"), el("br"), net.client.street));
  tk.appendChild(el("p", { class: "from" }, net.client.name + " · " + net.client.street + " · " + b.from));
  tk.appendChild(el("p", { class: "q" }, "“" + b.quote + "”"));
  tk.appendChild(el("p", { class: "mason2" }, el("b", null, "Mason: "), d.mason));
  const ol = el("ol", { class: "wo" }); d.reqs.forEach(function (q) { ol.appendChild(el("li", null, q.text)); });
  tk.appendChild(el("div", { class: "wol" }, el("h4", null, "The work order"), ol));
}

/* the limits, what's still in its box, and the tools: place or move a device, lay a cable, undo */
function renderBuild() {
  const J = ctx.T, sim = J.sim, host = $("bm"), keepFocus = document.activeElement && host.contains(document.activeElement) ? document.activeElement.id : null;
  host.innerHTML = "";
  host.appendChild(el("h3", null, "Limits on this job"));
  const lim = el("ul", { class: "limits" }); (typeof J.def.limits === "function" ? J.def.limits(J.v, J.sim) : J.def.limits).forEach(function (t) { lim.appendChild(el("li", null, t)); }); host.appendChild(lim);
  if (J.def.ipam) ipamSheet(host, J, sim);
  if (J.def.cablemap) mapForm(host, J, sim);
  const boxed = devices(sim).filter(function (id) { return sim.d[id].boxed; });
  host.appendChild(el("h3", null, "In the box, not placed yet"));
  if (boxed.length) { const tr = el("ul", { class: "tray" }); boxed.forEach(function (id) { tr.appendChild(el("li", null, sim.d[id].label)); }); host.appendChild(tr); }
  else host.appendChild(el("p", { class: "note", style: "margin:4px 0 0" }, "Nothing: everything is out of its box."));

  /* place or move */
  const movable = devices(sim).filter(function (id) { return !fixedOf(sim)[sim.d[id].kind] || sim.d[id].boxed; });   /* a device with a fixed place can still come out of its box (onto its mount); once there it stays */
  const dsel = el("select", { id: "bmDev", name: "dev" }), rsel = el("select", { id: "bmRoom", name: "room" });
  movable.forEach(function (id) { dsel.appendChild(el("option", { value: id }, sim.d[id].label + (sim.d[id].boxed ? " (in its box)" : " (in " + inRoom(sim, sim.net.rooms[id]) + ")"))); });
  if (boxed.length) dsel.value = boxed.filter(function (id) { return movable.indexOf(id) >= 0; })[0] || dsel.value;
  roomsOf(sim).forEach(function (r) { rsel.appendChild(el("option", { value: r }, roomName(sim, r))); });
  const pmsg = el("p", { class: "msg", role: "status", id: "bmPmsg" });
  const pf = el("form", { class: "devform bmf", novalidate: true }, el("fieldset", null, el("legend", null, "Place or move a device"),
    el("div", { class: "row2" }, el("label", { class: "f", for: "bmDev" }, "Device", dsel), el("label", { class: "f", for: "bmRoom" }, "Room", rsel)),
    el("div", { class: "acts" }, el("button", { class: "btn small", type: "submit", id: "bmPlace" }, "Place it"))), pmsg);
  pf.addEventListener("submit", function (e) {
    e.preventDefault();
    const id = dsel.value, room = rsel.value, was = sim.d[id].boxed, r = ctx.act({ t: "place", dev: id, room: room });
    ctx.said = r.result.ok ? { k: "p", ok: true, text: (was ? "Unboxed " + theName(sim, id) + " and set it up in " : "Moved " + theName(sim, id) + " to ") + inRoom(sim, room) + "." } : { k: "p", ok: false, text: "Not placed: " + r.result.errs.join(". ") + "." };
    renderBuild(); renderWin(); const f = $("bmPlace"); if (f) f.focus();
  });
  host.appendChild(pf);

  /* lay a cable */
  const can = devices(sim).filter(function (id) { return shown(sim, id) && portsOf(sim.d[id]).length; });
  let len = function () { };   /* set once both ends exist: changing either device says the new run's length */
  const mk = function (end, pick) {
    const ds = el("select", { id: "bm" + end + "d", name: end + "d" }), ps = el("select", { id: "bm" + end + "p", name: end + "p" });
    can.forEach(function (id) { ds.appendChild(el("option", { value: id }, sim.d[id].label)); });
    if (pick) ds.value = pick;
    const fill = function () { ps.innerHTML = ""; portsOf(sim.d[ds.value]).filter(function (p) { return !(sim.d[ds.value].kind === "patchpanel" && /R$/.test(p)); }).forEach(function (p) { const used = !!sim.cableAt(ds.value, p); const o = el("option", { value: p }, portLabel(sim.d[ds.value], p) + (used ? " (in use)" : "")); if (used) o.disabled = true; ps.appendChild(o); }); const free = Array.from(ps.options).find(function (o) { return !o.disabled; }); if (free) ps.value = free.value; };
    fill(); ds.addEventListener("change", function () { fill(); len(); });
    return { ds: ds, ps: ps };
  };
  if (can.length < 2) { host.appendChild(el("p", { class: "note" }, "Lay a cable: place at least two devices first.")); }
  else {
    const free = function (id) { return portsOf(sim.d[id]).some(function (p) { return !sim.cableAt(id, p); }); };   /* start each end on a device with a port free */
    const a0 = free("router") && shown(sim, "router") ? "router" : can.filter(free)[0] || can[0], b0 = can.filter(function (x) { return x !== a0 && free(x); })[0] || can.filter(function (x) { return x !== a0; })[0];
    const A = mk("A", a0), Bq = mk("B", b0);
    const lenp = el("p", { class: "note", id: "bmLen", "aria-live": "polite" });
    len = function () { const a = sim.net.rooms[A.ds.value], b = sim.net.rooms[Bq.ds.value], m = runLength(a, b, sim.net); lenp.textContent = "This run: " + m + " m" + (a === b ? ", inside " + inRoom(sim, a) : ", " + inRoom(sim, a) + " to " + inRoom(sim, b)) + (m > COPPER_MAX ? ": longer than copper Ethernet can carry." : "."); };
    len();
    const lmsg = el("p", { class: "msg", role: "status", id: "bmLmsg" });
    const lf = el("form", { class: "devform bmf", novalidate: true }, el("fieldset", null, el("legend", null, "Lay a cable"),
      el("div", { class: "row2" }, el("label", { class: "f", for: "bmAd" }, "From", A.ds), el("label", { class: "f", for: "bmAp" }, "Its port", A.ps)),
      el("div", { class: "row2" }, el("label", { class: "f", for: "bmBd" }, "To", Bq.ds), el("label", { class: "f", for: "bmBp" }, "Its port", Bq.ps)),
      lenp, el("div", { class: "acts" }, el("button", { class: "btn small", type: "submit", id: "bmLay" }, "Lay it"))), lmsg);
    lf.addEventListener("submit", function (e) {
      e.preventDefault();
      const a = { dev: A.ds.value, port: A.ps.value }, b = { dev: Bq.ds.value, port: Bq.ps.value };
      if (!a.port || !b.port) { ctx.said = { k: "l", ok: false, text: "Not laid: every port on the " + sim.d[!a.port ? a.dev : b.dev].label + " already has a cable in it." }; renderBuild(); return; }
      const r = ctx.act({ t: "lay", a: a, b: b });
      ctx.said = r.result.ok ? { k: "l", ok: true, text: "Laid a " + r.result.length + " m cable: " + endLabel(sim, a) + " to " + endLabel(sim, b) + "." } : { k: "l", ok: false, text: "Not laid: " + r.result.errs.join(". ") + "." };
      renderBuild(); renderWin(); const f = $("bmLay"); if (f) f.focus();
    });
    host.appendChild(lf);
  }
  /* undo, and the house back as it was */
  const umsg = el("p", { class: "msg", role: "status", id: "bmUmsg" });
  host.appendChild(el("div", { class: "acts bmu" },
    el("button", { type: "button", class: "btn ghost small", id: "bmUndo", disabled: J.net.length ? null : true, onclick: function () { const g = B.undo(J); ctx.said = { k: "u", ok: true, text: g ? "Undone: " + describe(g) + "." : "Nothing to undo." }; forgetTerminals(); persist(); renderLive(); renderWin(); const f = $("bmUndo"); if (f) f.focus(); } }, "Undo the last change"),
    el("button", { type: "button", class: "btn ghost small", id: "bmReset", onclick: function () { B.reset(J); ctx.said = { k: "u", ok: true, text: "The house is back as you found it. Your checks, Mason's help and your notes are kept." }; forgetTerminals(); persist(); renderLive(); renderWin(); } }, "Put the house back as you found it")));
  host.appendChild(umsg);
  if (ctx.said) { const m = $({ p: "bmPmsg", l: "bmLmsg", u: "bmUmsg" }[ctx.said.k]); if (m) { m.className = "msg " + (ctx.said.ok ? "ok" : "err"); m.textContent = ctx.said.text; } }
  if (keepFocus && $(keepFocus)) $(keepFocus).focus({ preventScroll: true });
}
/* the IPAM sheet (SO-J4 on): saving it is a change like any other (Undo takes it back); what the checker found is
   shown for the sheet as saved (js/desk/ipamui.js) */
function ipamSheet(host, J, sim) {
  const saved = sim.net.ipam || [];
  sheetForm(host, { plan: sim.net.plan.ipam, saved: saved, checked: saved.length > 0, note: "Work each block out by hand: the sheet says what's wrong with what you wrote, never what the right value is.",
    onSave: function (rows) { ctx.act({ t: "ipam", rows: rows }); renderBuild(); const b = $("ipamSave"); if (b) b.focus(); } });
}
/* the office's cable map (SO-J9 on): a row for each panel port with a run punched down on it, or named in the map; saving it is a
   change like any other (Undo takes it back). Nothing here says whether a row is right: the cable does */
function mapForm(host, J, sim) {
  const map = sim.net.cablemap || {}, ports = Object.keys(map);
  sim.cablesOf("pp").forEach(function (c) { const e = c.a.dev === "pp" ? c.a : c.b; if (/R$/.test(e.port) && ports.indexOf(e.port.slice(0, -1)) < 0) ports.push(e.port.slice(0, -1)); });
  cableMap(host, { map: map, ports: ports.sort(function (a, b) { return a - b; }), saved: J.net.some(function (a) { return a.t === "cablemap"; }), note: "The cablers left no map. Write down where each run goes once you know: the tone and the probe will tell you.",
    onSave: function (m) { ctx.act({ t: "cablemap", map: m }); renderBuild(); const b = $("cmapSave"); if (b) b.focus(); } });
}
function describe(a) {
  const sim = ctx.T.sim;
  if (a.t === "place") return "placing " + theName(sim, a.dev) + " in " + inRoom(sim, a.room);
  if (a.t === "lay") return "the cable from " + endLabel(sim, a.a) + " to " + endLabel(sim, a.b);
  if (a.t === "pull") return "pulling a cable";
  if (a.t === "router") return "a change on the router's " + (a.page === "admin" ? "Status" : a.page === "wifi" ? "Wi-Fi" : "settings") + " page";
  if (a.t === "client") return theName(sim, a.dev) + "'s IP settings";
  if (a.t === "cmd" && a.cli) return "the last line typed on the switch's command line";
  if (a.t === "power") return "restarting " + theName(sim, a.dev);
  if (a.t === "pcprinter") return "the office PC's printer port";
  if (a.t === "ipam") return "saving the IPAM sheet";
  if (a.t === "cablemap") return "saving the cable map";
  if (a.t === "tone") return "putting the tone generator on a run";
  if (a.t === "repatch") return "moving a patch cord";
  if (a.t === "tftp") return (a.on ? "starting" : "stopping") + " the TFTP server on your laptop";
  if (a.t === "join" || a.t === "rejoin" || a.t === "forget") return theName(sim, a.dev) + "'s Wi-Fi";
  return "your last change";
}

function renderDiagram() { drawLogical($("net"), ctx.T.sim, { open: ctx.open }); drawPlan($("plan"), ctx.T.sim, { open: ctx.open }); }

/* every cable in the house: its ends, its length, its link, and Pull */
function renderRuns() {
  const J = ctx.T, sim = J.sim, host = $("runs");
  host.innerHTML = "";
  host.appendChild(el("h3", null, "Cable runs"));
  const tb = el("tbody");
  sim.net.cables.forEach(function (c) {
    const up = sim.cableUp(c), sp = sim.speed(c);
    const link = c.kind === "coax" ? (up ? "Link: signal locked" : "No signal") : c.kind === "console" ? (up ? "Console: connected" : "Console: no connection") : up ? "Link, " + (sp === 1000 ? "1 Gb/s" : sp + " Mb/s") : "No link";
    const len = c.kind === "coax" ? "2 m" : c.length + " m" + (sim.net.rooms[c.a.dev] !== sim.net.rooms[c.b.dev] ? ", " + inRoom(sim, sim.net.rooms[c.a.dev]) + " to " + inRoom(sim, sim.net.rooms[c.b.dev]) : "");
    tb.appendChild(el("tr", { class: up ? "" : "down" }, el("td", { "data-label": "From" }, endLabel(sim, c.a)), el("td", { "data-label": "To" }, endLabel(sim, c.b)), el("td", { "data-label": "Length" }, len),
      el("td", { class: up ? "ok-t" : "bad-t", "data-label": "Link" }, (up ? "✓ " : "✕ ") + link),
      el("td", { class: "pullc" }, c.kind === "coax" ? el("span", { class: "note" }, "The provider's") : el("button", { type: "button", class: "btn ghost small", "aria-label": "Pull the cable from " + endLabel(sim, c.a) + " to " + endLabel(sim, c.b), onclick: function () { ctx.act({ t: "pull", cable: c.id }); ctx.said = { k: "u", ok: true, text: "Pulled the cable from " + endLabel(sim, c.a) + " to " + endLabel(sim, c.b) + "." }; renderBuild(); renderWin(); } }, "Pull"))));
  });
  host.appendChild(el("div", { class: "tablewrap" }, el("table", { class: "grid runs" }, el("thead", null, el("tr", null, el("th", { scope: "col" }, "From"), el("th", { scope: "col" }, "To"), el("th", { scope: "col" }, "Length"), el("th", { scope: "col" }, "Link"), el("th", { scope: "col" }, el("span", { class: "sr" }, "Pull")))), tb)));
}

/* Check the job: every line, marked three ways (the mark, the colour and its rule, the words), Mason on the first one not met */
function renderCheck() {
  const J = ctx.T, host = $("check"), last = J.last;
  host.innerHTML = "";
  host.appendChild(el("h2", { id: "ch" }, "Check the job"));
  const body = el("div", { class: "body" }); host.appendChild(body);
  body.appendChild(el("p", null, "The network checks each line of the order itself: real links, real addresses, real traffic, the way the client would find out. Check as often as you like."));
  body.appendChild(el("div", { class: "boardbar" }, el("button", { type: "button", class: "btn", id: "doCheck", onclick: function () { const was = J.done; B.check(J); if (J.done && !was) S.done[J.def.id] = (S.done[J.def.id] || 0) + 1; persist(); renderCheck(); renderLeft(); const b = $("chres"); if (b) b.focus({ preventScroll: false }); } }, "Check the job")));
  if (last) {
    const met = last.res.filter(function (x) { return x.ok; }).length;
    body.appendChild(el("p", { id: "chres", tabindex: "-1", class: "chsum" }, el("b", null, "Check " + last.n + ": "), met + " of " + last.res.length + " met."));
    if (J.net.length !== last.at) body.appendChild(el("p", { class: "note" }, "You've changed the house since this check: check again to see where it stands now."));
    const ol = el("ol", { class: "req" });
    last.res.forEach(function (r) { ol.appendChild(el("li", { class: "rq " + (r.ok ? "ok" : "bad") }, el("span", { class: "mk", "aria-hidden": "true" }, r.ok ? "✓" : "✕"), el("div", null, el("b", null, r.text), " ", el("span", { class: "stw" }, r.ok ? "Met" : "Not met yet"), el("p", null, r.ev)))); });
    body.appendChild(ol);
    const m = B.mason(J);
    if (m) {
      const box = el("div", { class: "mason-says", role: "status" }, el("p", { style: "margin:0" }, el("b", null, ["", "Mason (where to look): ", "Mason (the principle): ", "Mason: "][m.rung]), "On “" + m.line + "”: " + m.text));
      if (m.struck && m.struck.length) { const ul = el("ul", { class: "struck" }); m.struck.forEach(function (s) { ul.appendChild(el("li", null, el("span", { class: "x" }, "Ruled out: "), "“" + s.text.replace(/^./, function (m) { return m.toLowerCase(); }) + "”. " + s.why)); }); box.appendChild(ul); }
      if (m.principle) box.appendChild(el("p", { style: "margin:6px 0 0" }, el("b", null, "Remember: "), m.principle));
      body.appendChild(box);
    }
    if (J.done) {
      const orders = ALL.filter(function (d) { return !d.free; }), s = J.def.summary(J.v, J.sim), after = J.def.free ? null : orders[orders.indexOf(J.def) + 1] || null;   /* only a later work order: the last one doesn't loop back, and free build has none */
      const Lv = levelOfJob(J.def.id), Ln = after ? levelOfJob(after.id) : null, next = after && isOpen(Ln.n) ? after : null;   /* the next level's first job only once that level is open */
      const box = el("div", { class: "solved", role: "status" }, el("h3", null, "Job " + J.def.id + " done"), el("p", null, el("b", null, "What you built:")));
      const ul = el("ul"); s.forEach(function (t) { ul.appendChild(el("li", null, t)); }); box.appendChild(ul);
      box.appendChild(el("p", null, "Every line of the order checked by the network itself, in " + last.n + " check" + (last.n === 1 ? "" : "s") + "."));
      if (!J.def.free && finished(Lv, progress()) && LEVELS[Lv.n]) box.appendChild(el("p", null, el("b", null, "Level " + Lv.n + " finished. "), LEVELS[Lv.n].later ? LEVELS[Lv.n].name + " is still being built." : LEVELS[Lv.n].the.replace(/^./, function (m) { return m.toUpperCase(); }) + " is open: level " + (Lv.n + 1) + "."));
      else if (after && Ln.n !== Lv.n && !next) box.appendChild(el("p", null, "That's every work order on " + Lv.the + ". " + Ln.the.replace(/^./, function (m) { return m.toUpperCase(); }) + " opens when " + Lv.the + " is finished: its tickets are on the Ticket Desk."));
      else if (!J.def.free && !built(Lv) && !after) { const c = counts(Lv, progress()); if (c.jobs === c.njobs && c.tickets === c.ntickets) box.appendChild(el("p", null, el("b", null, "That's everything on " + Lv.the + " so far. "), "More work orders and tickets are on the way; " + Lv.the + " is finished when they're all done.")); }
      box.appendChild(el("div", { class: "boardbar" }, el("button", { type: "button", class: "btn", onclick: function () { openJob(J.def.id, true); window.scrollTo({ top: 0 }); } }, "Start this job again (a new house)"),
        next ? el("button", { type: "button", class: "btn ghost", onclick: function () { openJob(next.id, false); window.scrollTo({ top: 0 }); } }, "Next job: " + next.id) : null));
      body.appendChild(box);
    }
  } else body.appendChild(el("p", { class: "note" }, "Not checked yet."));
  body.appendChild(el("p", { class: "ladder" }, el("b", null, "How help works: "), "Mason helps with the first line that isn't met. Its first and second failing checks, nothing (think it through); the third, where to look; the fourth, the principle that decides it; the fifth and every one after, he narrows it to two, with a reason for each thing he rules out. He never says what to type or where to plug."));
}

function renderNotes() {
  const nb = $("notebook"), J = ctx.T;
  nb.innerHTML = "";
  nb.appendChild(el("h2", null, "Job notes"));
  nb.appendChild(el("p", { class: "empty", id: "noteshelp" }, "Your plan and notes for this house, saved in this browser: which device goes where, the runs, the addresses. The plan is yours to work out."));
  const ta = el("textarea", { id: "notes", "aria-labelledby": "noteslab", "aria-describedby": "noteshelp" }); ta.value = J.notes || "";
  ta.addEventListener("input", function () { J.notes = ta.value; persist(); });
  nb.appendChild(el("label", { for: "notes", id: "noteslab" }, "Your notes"));
  nb.appendChild(ta);
}
function renderDevtabs() {
  const dt = $("devtabs"), sim = ctx.T.sim; dt.innerHTML = "";
  devices(sim).forEach(function (id) { if (!shown(sim, id)) return; dt.appendChild(el("button", { type: "button", "data-d": id, "aria-pressed": String(id === ctx.open), onclick: function () { openDevice(id); } }, sim.d[id].label)); });
  $("termtitle").textContent = "Terminal · " + (shown(sim, ctx.open) ? sim.d[ctx.open].label : sim.d.modem.label);
}
function openDevice(id) {
  if (!shown(ctx.T.sim, id)) return;
  ctx.open = id; ctx.tab = null;
  renderDevtabs(); renderWin();
  ["net", "plan"].forEach(function (s) { $(s).querySelectorAll("[data-d]").forEach(function (g) { g.classList.toggle("open", g.dataset.d === id); }); });
  if (window.innerWidth <= 1100) document.querySelector(".side").scrollIntoView({ block: "start" });
  if (ctx.tab === "cmd") focusCmd(id);
}

/* ---------------------------------------------------------------- the bars and the rest */
function setView(phy) {
  $("net").toggleAttribute("hidden", phy); $("plan").toggleAttribute("hidden", !phy);
  $("vLog").setAttribute("aria-pressed", String(!phy)); $("vPhy").setAttribute("aria-pressed", String(phy));
  if (ctx.T) renderDiagram();   /* drawn while hidden, nothing could be measured: drawn again now it's shown, so markers and port names keep off the labels */
  plates(phy ? $("plan") : $("net"), phy ? ".rl, .ns" : ".nl, .ns, .pl", phy ? "#f4f6fb" : null);
}
function replateAll() { if (!ctx.T) return; if (!$("net").hasAttribute("hidden")) plates($("net"), ".nl, .ns, .pl"); if (!$("plan").hasAttribute("hidden")) plates($("plan"), ".rl, .ns", "#f4f6fb"); }
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

dyslexia($("dys"), function () { if (ctx.T) renderDiagram(); replateAll(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (ctx.T) { renderDiagram(); replateAll(); } });   /* once the fonts are in, measure the labels again */
$("vLog").addEventListener("click", function () { setView(false); });
$("vPhy").addEventListener("click", function () { setView(true); });
$("mJob").addEventListener("click", function () { $("order").scrollIntoView({ block: "start" }); const h = $("tkh"); if (h) h.focus({ preventScroll: true }); });
$("mView").addEventListener("click", function () { setView($("plan").hasAttribute("hidden")); });
$("mNotes").addEventListener("click", function () { $("notebook").scrollIntoView({ block: "nearest" }); const t = $("notes"); if (t) t.focus({ preventScroll: true }); });
deviceClicks($("net")); deviceClicks($("plan"));
helpDialog();
setupInstructor(ctx, {
  /* the levels opened or locked: a job on a level that's now locked goes back to the first level */
  levels: function () { if (!isOpen(levelOfJob(ctx.T.def.id).n)) openJob(JOBS[0].id, false); else renderLeft(); },
  /* the instructor's build tools: a job on a chosen house, one way to do it, all of Mason's help, this computer's progress */
  render: function (body, redraw, close) {
    const J = ctx.T, def = J.def;
    const sel = el("select", { name: "job", id: "instt" }); ALL.forEach(function (d) { const o = el("option", { value: d.id }, d.id + " · " + d.title); if (d.id === def.id) o.selected = true; sel.appendChild(o); });
    const seed = el("input", { type: "text", name: "seed", inputmode: "numeric", autocomplete: "off", id: "insts" });
    const demo = el("form", { class: "devform", novalidate: true }, el("fieldset", null, el("legend", null, "Open a job for a demonstration"),
      el("label", { class: "f", for: "instt" }, "Job", sel), el("label", { class: "f", for: "insts" }, "House number (leave empty for a new one)", seed),
      el("p", { class: "note" }, "Opens a fresh copy. Any work saved on that job in this browser is replaced."),
      el("div", { class: "acts" }, el("button", { class: "btn", type: "submit" }, "Open it"))));
    demo.addEventListener("submit", function (e) { e.preventDefault(); const n = parseInt(String(seed.value).trim(), 10); openJob(sel.value, true, isNaN(n) ? null : n >>> 0); window.scrollTo({ top: 0 }); redraw(); });
    body.appendChild(demo);
    body.appendChild(el("p", null, "Open now: " + def.id + " on house number " + J.seed + ". The same number always builds the same house."));
    const out = el("div", { class: "inst-out" });
    const show = function (what) {
      out.innerHTML = "";
      if (what === "answer") {
        out.appendChild(el("h3", null, "One way to do " + def.id));
        const ol = el("ol"); def.answer(J.v, J.sim).forEach(function (t) { ol.appendChild(el("li", null, t)); }); out.appendChild(ol);
        out.appendChild(el("p", null, "Any way the network accepts passes: the check tests the result, not the steps."));
      } else {
        out.appendChild(el("h3", null, "All of Mason's help for " + def.id));
        def.reqs.forEach(function (q) { out.appendChild(el("p", null, el("b", null, q.text)));
          out.appendChild(el("p", null, "Rung 1, where to look: " + q.rung1(J.v, J.sim))); out.appendChild(el("p", null, "Rung 2, the principle: " + q.rung2(J.v, J.sim))); });
        out.appendChild(el("p", null, "Rung 3 narrows each line to two from what the network shows at the time, striking the causes it has ruled out, each with its reason."));
      }
    };
    body.appendChild(el("div", { class: "acts" }, el("button", { type: "button", class: "btn ghost small", onclick: function () { show("answer"); } }, "Show one way to do the job"), el("button", { type: "button", class: "btn ghost small", onclick: function () { show("help"); } }, "Show all of Mason's help")));
    body.appendChild(out);
    const sure = el("button", { type: "button", class: "btn small", hidden: true, onclick: function () { S.j = {}; S.done = {}; openJob(JOBS[0].id, true); close(); } }, "Yes, clear it");
    body.appendChild(el("h3", null, "Build progress on this computer"));
    body.appendChild(el("div", { class: "acts" }, el("button", { type: "button", class: "btn ghost small", onclick: function () { sure.hidden = false; sure.focus(); } }, "Clear all build progress"), sure));
  }
});
chromeH(); window.addEventListener("resize", chromeH);
const asked = /^#job=([\w-]+)$/.exec(location.hash);   /* the Ticket Desk links a level's work orders here */
openJob(asked && DEFS[asked[1]] ? asked[1] : S.current && DEFS[S.current] ? S.current : JOBS[0].id, false);
if (location.hash === "#logical") setView(false);
ctx.openJob = openJob; ctx.check = function () { B.check(ctx.T); persist(); renderCheck(); };
window.__e4b = ctx;   /* for the checks that drive this page */
