/* Preview of level 2, the small office (not linked from the site). The
   console runs the real switch command line (js/net/swcli.js); the IPAM
   sheet runs the real checker (js/net/ipam.js); the work order's check
   reads the switch you configured. The levels show how each level opens
   when the one before it is finished, and what the instructor's PIN does. */
import * as C from "../js/net/swcli.js";
import { checkSheet } from "../js/net/ipam.js";
import { dyslexia, el } from "../js/desk/store.js";
import { hash } from "../js/net/util.js";

dyslexia(document.getElementById("dys"));
const $ = function (id) { return document.getElementById(id); };

/* ---------------------------------------------------------------- the levels and the lock */
const LEVELS = [["Home", 15, 10], ["Small office", 15, 10], ["Small business"], ["Campus"], ["Enterprise"]];
const AS = {
  done: { home: [15, 10], office: [0, 0], open: 2 },
  home: { home: [12, 8], office: [0, 0], open: 1, left: { tickets: ["HOME-12 The office PC prints but can't get online", "HOME-14 The old laptop can't join the Wi-Fi", "HOME-15 The Wi-Fi password stopped working"], jobs: ["J9 WPA3, with one old laptop", "J10 Moving day"] } },
  inst: { home: [12, 8], office: [0, 0], open: 5 }
};
let as = "done";
function renderLevels() {
  const A = AS[as], ol = $("levels"); ol.innerHTML = "";
  LEVELS.forEach(function (L, i) {
    const n = i + 1, open = n <= A.open, prog = n === 1 ? A.home : n === 2 ? A.office : null;
    const finished = prog && prog[0] === L[1] && prog[1] === L[2];
    const st = !open ? "\u{1F512} Locked: opens when " + LEVELS[i - 1][0] + " is finished"
      : finished ? "✓ Finished: " + prog[0] + " of " + L[1] + " tickets, " + prog[1] + " of " + L[2] + " work orders"
      : prog ? (as === "inst" && n === 2 && AS.inst.home[0] < 15 ? "Open (instructor). " : "") + prog[0] + " of " + L[1] + " tickets, " + prog[1] + " of " + L[2] + " work orders done"
      : as === "inst" ? "Open (instructor): built later" : "Built later";
    const li = el("li", { class: !open ? "locked" : finished ? "done" : "" },
      el("button", { type: "button", "aria-current": n === 2 ? "true" : null, onclick: function () { if (n <= 2) renderOrder(); } },
        el("span", { class: "lv" }, n + " · " + L[0]), el("span", { class: "lvst" }, st)));
    ol.appendChild(li);
  });
  renderOrder();
}
/* the instructor's view needs the PIN, checked as the live site's Instructor menu checks it: only its hash is here,
   and an unlock lasts for this browser tab (the same sessionStorage key, so unlocking in either place counts in both) */
const PIN_HASH = 4061435687, KEY = "e4-instructor";
const instOpen = function () { try { return sessionStorage.getItem(KEY) === "1"; } catch (e) { return false; } };
function pick(which) {
  as = which; document.querySelectorAll(".pv [data-as]").forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.as === which)); });
  $("pinlock").hidden = which !== "inst"; renderLevels();
}
document.querySelectorAll(".pv [data-as]").forEach(function (b) {
  b.addEventListener("click", function () {
    if (b.dataset.as === "inst" && !instOpen()) { $("pinform").hidden = false; $("pinmsg").textContent = ""; $("pin").value = ""; $("pin").focus(); return; }
    $("pinform").hidden = true; pick(b.dataset.as);
  });
});
$("pinform").addEventListener("submit", function (e) {
  e.preventDefault();
  if (hash("e4-instructor:" + String($("pin").value).trim()) === PIN_HASH) { try { sessionStorage.setItem(KEY, "1"); } catch (err) {} $("pinform").hidden = true; pick("inst"); }
  else { $("pinmsg").textContent = "That PIN isn't right."; $("pin").select(); }
});
$("pinlock").addEventListener("click", function () { try { sessionStorage.removeItem(KEY); } catch (e) {} pick("done"); });

/* ---------------------------------------------------------------- what the level teaches, and its work */
const OBJ = [
  ["Access and management", "VPNs, SSH, GUI, API, and console.", "Console and SSH: SO-J1, SO-J2, SO-05, SO-06"],
  ["Switching technologies", "VLANs, interface configuration, spanning tree, MTU, and jumbo frames.", "Interface configuration (VLANs come with the small business): SO-J3, SO-01, SO-02, SO-07"],
  ["Security features and defense", "device hardening, …", "Names, secrets, SSH only, unused ports shut: SO-J1, SO-J2, SO-J3, SO-05"],
  ["IPv4 addressing", "… subnetting (VLSM, CIDR) …", "By hand, on the IPAM sheet: SO-J4, SO-09"],
  ["Documentation", "… rack diagrams, cable maps, … IPAM …", "SO-J4, SO-J9, SO-08"],
  ["Configuration management", "production, backup, baseline configurations.", "Running and startup, backups, a baseline: SO-J5, SO-J6, SO-03"],
  ["Cabling and physical interface issues", "… TX/RX transposed …, interface issues (increasing counters, port status), and hardware issues (… transceiver mismatch …).", "SO-01, SO-02, SO-04, SO-07, SO-10"],
  ["Troubleshooting methodology, and tools", "… command line tools …", "Every ticket: show, then configure, then show again"]
];
$("objs").innerHTML = "";
OBJ.forEach(function (o) { $("objs").appendChild(el("li", null, el("b", null, o[0]), el("q", null, "“" + o[1] + "”"), el("small", null, o[2] + " · 0 done"))); });
const JOBS = [["SO-J1", "Out of the box: name it, lock it, save it"], ["SO-J2", "Remote management: an address, SSH only"], ["SO-J3", "The ports: descriptions, the printer's speed and duplex, unused ports shut"], ["SO-J4", "Subnet the office: the IPAM sheet"], ["SO-J5", "Save, back up, baseline"], ["SO-J6 to J10", "Five more: a failed switch rebuilt from its backup, a new hire's desk, the printer moved, the cable map, a fibre link to the back office"]];
const TICKETS = [["SO-01", "Printing is slow and sometimes fails", "duplex mismatch: CRC and late collisions climbing"], ["SO-02", "One desk has no network", "its port shut down"], ["SO-03", "Monday: Friday's switch changes are gone", "never saved; Sunday's power cut"], ["SO-04", "The back office's new switch won't link", "TX/RX transposed, auto-MDIX off"], ["SO-05", "Can't SSH to the switch", "no keys, or the vty lines still Telnet only"],
  ["SO-06", "The switch answers nothing from the office PC", "its management mask or gateway wrong"], ["SO-07", "A desk links, then nothing", "a forced speed the far end doesn't match"], ["SO-08", "The cable map says port 7; the cable isn't in port 7", "the patch panel map is wrong"], ["SO-09", "Two groups fighting over addresses", "two IPAM blocks overlap"], ["SO-10", "The fibre link to the back office is dark", "a transceiver mismatch"], ["SO-11 to 15", "Five more on the same skills", ""]];
JOBS.forEach(function (j) { $("jobs").appendChild(el("li", null, el("span", { class: "num" }, j[0]), j[1])); });
TICKETS.forEach(function (t) { $("tickets").appendChild(el("li", null, el("span", { class: "num" }, t[0]), t[1], t[2] ? el("span", { class: "soon" }, " (planned fault, shown in this preview only: " + t[2] + ")") : null)); });

/* ---------------------------------------------------------------- the switch, its console, the work order */
const sw = C.newSwitch({ links: { "GigabitEthernet0/1": { mac: "0019.e8a1.0001" }, "GigabitEthernet0/2": { mac: "a4bb.6d12.0a02" }, "GigabitEthernet0/3": { mac: "a4bb.6d12.0a03" }, "GigabitEthernet0/4": { mac: "a4bb.6d12.0a04" }, "GigabitEthernet0/5": { mac: "a4bb.6d12.0a05" }, "GigabitEthernet0/6": { mac: "a4bb.6d12.0a06" }, "GigabitEthernet0/7": { mac: "a4bb.6d12.0a07" }, "GigabitEthernet0/8": { mac: "a4bb.6d12.0a08" }, "GigabitEthernet0/9": { mac: "a4bb.6d12.0a09" }, "GigabitEthernet0/10": { mac: "a4bb.6d12.0a0a" }, "GigabitEthernet0/11": { mac: "3c2a.f4c1.77e0", speed: "100", duplex: "full" }, "GigabitEthernet0/12": { mac: "b4fb.e4aa.1c22" } } });
let S = C.session(sw);
const con = $("con"), cmd = $("cmd"), prompt = $("prompt");
let hist = [], hi = 0;
function print(lines, cls) { lines.forEach(function (l) { const d = document.createElement("div"); if (cls) d.className = cls; d.textContent = l === "" ? " " : l; con.appendChild(d); }); con.scrollTop = con.scrollHeight; }
function setPrompt(p, secret) { prompt.textContent = p; cmd.type = secret ? "password" : "text"; cmd.setAttribute("aria-label", secret ? "Password (not shown as you type)" : "Command"); }
print(["MSW-2800G Network Operating System, Version 4.2.1", "", "No startup configuration found: starting with factory settings.", "", "Press RETURN to get started.", ""]);
setPrompt(C.promptOf(S));
$("conform").addEventListener("submit", function (e) {
  e.preventDefault();
  const v = cmd.value, secret = cmd.type === "password";
  print([prompt.textContent + (secret ? "" : v)], "in");
  if (v.trim() && !secret) { hist.push(v); hi = hist.length; }
  const r = C.exec(S, v); cmd.value = "";
  print(r.out); setPrompt(r.prompt, r.secret); renderChecks(false);
});
cmd.addEventListener("keydown", function (e) {
  if (cmd.type === "password") return;
  if (e.key === "Tab") { const c = C.complete(S, cmd.value); if (c !== cmd.value) { e.preventDefault(); cmd.value = c; } else if (cmd.value.trim()) e.preventDefault(); }
  else if (e.key === "?") { e.preventDefault(); const r = C.exec(S, cmd.value + "?"); print([prompt.textContent + cmd.value + "?"], "in"); print(r.out); cmd.value = r.keep != null ? r.keep : cmd.value; }
  else if (e.key === "ArrowUp") { if (hi > 0) { hi--; cmd.value = hist[hi]; e.preventDefault(); } }
  else if (e.key === "ArrowDown") { if (hi < hist.length) { hi++; cmd.value = hist[hi] || ""; e.preventDefault(); } }
});

const REQS = [
  ["name", "The switch has its own name, to the office's plan", function () { return sw.hostname === "BL-CLOSET-SW1" ? [true, "It's called " + sw.hostname + "."] : sw.hostname === "Switch" ? [false, "It still has its factory name, Switch."] : [false, "It's named " + sw.hostname + ", which isn't the office's plan."]; }],
  ["secret", "Privileged mode needs a secret", function () { return sw.enableSecret && sw.enableSecret.length >= 8 ? [true, "An enable secret is set (stored as a hash, never in plain text)."] : sw.enableSecret ? [false, "An enable secret is set, but it's shorter than the order's 8 characters."] : sw.enablePassword ? [false, "Only an enable password is set: it sits in the configuration as plain text."] : [false, "Anyone at the console can type enable and change anything."]; }],
  ["console", "The console asks for a password", function () { return sw.con.password && sw.con.login ? [true, "The console line asks for its password."] : sw.con.password ? [false, "A console password is set, but the line never asks for it."] : [false, "The console lets anyone straight in."]; }],
  ["saved", "The setup survives a power cut", function () { return !C.unsaved(sw) && sw.startup ? [true, "What's running is saved: it will come back after a reload."] : [false, sw.startup ? "There are changes since it was last saved." : "Nothing is saved: a power cut would bring back the factory settings."]; }]
];
let checked = null;
function renderOrder() {
  const box = $("order"), A = AS[as]; box.innerHTML = "";
  const locked = A.open < 2;
  $("figs").hidden = locked; $("ipamBox").hidden = locked; cmd.disabled = locked;
  if (locked) {
    box.appendChild(el("h2", { id: "woh" }, "Small office · locked"));
    const p = el("div", { class: "lockpanel" });
    p.appendChild(el("span", { class: "tag" }, "\u{1F512} Locked"));
    p.appendChild(el("h3", null, "Finish the home level to open the small office"));
    p.appendChild(el("p", null, "A level opens when the one before it is finished: every ticket and every work order, which is every objective it teaches. You have " + A.left.tickets.length + " tickets and " + A.left.jobs.length + " work orders to go."));
    const ul = el("ul"); A.left.tickets.concat(A.left.jobs).forEach(function (t) { ul.appendChild(el("li", null, t)); }); p.appendChild(ul);
    p.appendChild(el("p", null, "Your instructor can open any level for a class demonstration (Instructor menu, with their PIN)."));
    box.appendChild(p); return;
  }
  box.appendChild(el("h2", { id: "woh" }, "Work order SO-J1 · Out of the box"));
  const wo = el("div", { class: "wo" });
  wo.appendChild(el("blockquote", null, "“We've finally got a proper switch for the closet. Can you set it up so it's ours: named, locked, and not something anyone walking past with a laptop can change?” ", el("small", null, "Dana, office manager, Bright Ledger Accounting")));
  wo.appendChild(el("blockquote", { class: "mason" }, el("b", null, "Mason: "), "Console first. Everything else needs the switch to know who it is and who's allowed in. Show, change, show again."));
  wo.appendChild(el("p", null, el("b", null, "Limits: "), "The office's naming plan calls this one BL-CLOSET-SW1. Passwords are yours to choose, 8 characters or more; put them in your job notes for Dana. The console cable is plugged into the switch's CONSOLE port and the laptop's USB-C."));
  const ul = el("ul", { class: "reqs", id: "reqs" }); wo.appendChild(ul);
  wo.appendChild(el("div", { class: "row2" }, el("button", { type: "button", class: "btn2", onclick: function () { renderChecks(true); } }, "Check the job"), el("span", { id: "chk", "aria-live": "polite" }, "")));
  wo.appendChild(el("p", { class: "hintline" }, "In the build, Mason helps from the third check that still fails a line, as on every job, and never says what to type."));
  box.appendChild(wo); renderChecks(false);
}
function renderChecks(now) {
  const ul = $("reqs"); if (!ul) return; if (now) checked = REQS.map(function (r) { return r[2](); });
  ul.innerHTML = "";
  REQS.forEach(function (r, i) {
    const c = checked && checked[i];
    ul.appendChild(el("li", { class: c ? (c[0] ? "met" : "bad") : "" }, el("span", { class: "mk", "aria-hidden": "true" }, c ? (c[0] ? "✓" : "✕") : "•"), el("span", null, r[1], c ? el("b", null, c[0] ? "  · Met" : "  · Not met yet") : null), el("span", { class: "ev" }, c ? c[1] : "Not checked yet.")));
  });
  if (now && $("chk")) { const n = checked.filter(function (c) { return c[0]; }).length; $("chk").textContent = n === REQS.length ? "Every line met: job done." : n + " of " + REQS.length + " lines met."; }
}

/* ---------------------------------------------------------------- the closet: rack diagram and logical diagram */
const NS = "http://www.w3.org/2000/svg";
function svgEl(tag, a, txt) {
  const n = document.createElementNS(NS, tag);
  if (tag === "text" && a.fill) { a.style = "color:" + a.fill; a.fill = "currentColor"; }   /* text painted in its CSS colour, as on the site's own diagrams (so the contrast check can hide it and measure what's behind) */
  for (const k in a) n.setAttribute(k, a[k]); if (txt != null) n.textContent = txt; return n;
}
(function rack() {
  const s = $("rack"), U = 52, x0 = 96, w = 448, y0 = 40;
  s.appendChild(svgEl("text", { x: 320, y: 26, "text-anchor": "middle", "font-size": 18, "font-weight": 700, fill: "#10172e" }, "Closet rack: 6U on the wall (front view)"));
  s.appendChild(svgEl("rect", { x: x0 - 26, y: y0, width: w + 52, height: U * 6 + 12, rx: 6, fill: "#d9dde6", stroke: "#34405e", "stroke-width": 2 }));
  const units = [[6, "Patch panel · 24-port Cat6", "#2a2d33", "#ffffff"], [5, "Managed switch · BL-CLOSET-SW1", "#17181b", "#ffffff"], [4, "Blank", "#eef0f4", "#34405e"], [3, "Blank", "#eef0f4", "#34405e"], [2, "Shelf: the router and modem", "#f7f8fb", "#10172e"], [1, "(the shelf, 2U)", "#f7f8fb", "#10172e"]];
  units.forEach(function (u) {
    const y = y0 + 6 + (6 - u[0]) * U;
    s.appendChild(svgEl("text", { x: x0 - 40, y: y + U / 2 + 6, "text-anchor": "end", "font-size": 16, "font-weight": 700, fill: "#10172e" }, "U" + u[0]));
    if (u[0] === 1) return;
    s.appendChild(svgEl("rect", { x: x0, y: y + 3, width: w, height: (u[0] === 2 ? 2 * U : U) - 6, rx: 3, fill: u[2], stroke: "#34405e", "stroke-width": 1.5 }));
    s.appendChild(svgEl("text", { x: x0 + w / 2, y: y + (u[0] === 2 ? U : U / 2) + 6, "text-anchor": "middle", "font-size": 16, "font-weight": 600, fill: u[3] }, u[1]));
  });
  s.appendChild(svgEl("text", { x: 320, y: y0 + U * 6 + 44, "text-anchor": "middle", "font-size": 15, fill: "#10172e" }, "Short cords: patch panel P1 to P12 down to switch ports 1 to 12."));
  s.appendChild(svgEl("text", { x: 320, y: y0 + U * 6 + 66, "text-anchor": "middle", "font-size": 15, fill: "#10172e" }, "The console cable: the switch's CONSOLE port (right end) to the laptop."));
})();
(function logical() {
  const s = $("logical");
  const node = function (x, y, w, t, sub) { s.appendChild(svgEl("rect", { x: x - w / 2, y: y - 26, width: w, height: 52, rx: 10, fill: "#ffffff", stroke: "#1e3a8a", "stroke-width": 2 })); s.appendChild(svgEl("text", { x: x, y: y - 4, "text-anchor": "middle", "font-size": 15, "font-weight": 700, fill: "#10172e" }, t)); if (sub) s.appendChild(svgEl("text", { x: x, y: y + 16, "text-anchor": "middle", "font-size": 13, fill: "#34405e" }, sub)); };
  const line = function (a, b, c, d) { s.appendChild(svgEl("line", { x1: a, y1: b, x2: c, y2: d, stroke: "#34405e", "stroke-width": 2.5 })); };
  line(320, 70, 320, 150); line(320, 200, 320, 250);
  [110, 250, 390, 530].forEach(function (x) { line(320, 300, x, 350); });
  node(320, 50, 180, "Internet", "the provider"); node(320, 175, 230, "Router", "the office's gateway"); node(320, 275, 250, "BL-CLOSET-SW1", "the managed switch");
  node(110, 375, 150, "9 desks", "Gi0/2 to 0/10"); node(250, 375, 120, "Printer", "Gi0/11"); node(390, 375, 130, "Wi-Fi AP", "Gi0/12"); node(530, 375, 150, "Uplink", "Gi0/1 to router");
})();
const vLog = $("vLog"), vPhy = $("vPhy");
function view(log) { vLog.setAttribute("aria-pressed", String(log)); vPhy.setAttribute("aria-pressed", String(!log)); $("logical").toggleAttribute("hidden", !log); $("rack").toggleAttribute("hidden", log);   /* SVG elements have no hidden property: set the attribute */ $("figh").textContent = log ? "The office network (logical)" : "The office closet"; }
vLog.addEventListener("click", function () { view(true); }); vPhy.addEventListener("click", function () { view(false); });

/* ---------------------------------------------------------------- the IPAM sheet */
const ROWS = [["Staff", 40], ["Guests", 25], ["Printers and servers", 10], ["Network gear (management)", 6]];
const F = [["net", "Network"], ["mask", "Mask or /prefix"], ["first", "First usable"], ["last", "Last usable"], ["bc", "Broadcast"], ["gw", "Gateway"]];
(function sheet() {
  const t = $("sheet");
  ROWS.forEach(function (r, i) {
    const fs = el("fieldset", { class: "blk", id: "row" + i }, el("legend", null, r[0] + " \u00B7 needs " + r[1] + " hosts"));
    const grid = el("div", { class: "blkgrid" });
    F.forEach(function (f) { grid.appendChild(el("label", null, el("span", null, f[1]), el("input", { id: "ip" + i + f[0], spellcheck: "false", autocomplete: "off" }))); });
    fs.appendChild(grid); fs.appendChild(el("ul", { class: "res", id: "resl" + i })); t.appendChild(fs);
  });
})();
function readSheet() { return ROWS.map(function (r, i) { const o = { name: r[0], hosts: r[1] }; F.forEach(function (f) { o[f[0]] = $("ip" + i + f[0]).value; }); return o; }); }
function checkIt() {
  const rows = readSheet(), res = checkSheet("192.168.40.0/24", rows); let good = 0;
  res.forEach(function (r, i) {
    const ul = $("resl" + i); ul.innerHTML = ""; $("row" + i).className = "blk" + (r.empty ? "" : r.ok ? " goodrow" : " badrow");
    F.forEach(function (f) { $("ip" + i + f[0]).removeAttribute("aria-invalid"); });
    if (r.empty) { ul.appendChild(el("li", { class: "nt" }, "Not filled in yet.")); return; }
    if (r.ok) { good++; ul.appendChild(el("li", { class: "ok" }, "✓ Every value checks out.")); }
    r.issues.forEach(function (x) { $("ip" + i + x.field).setAttribute("aria-invalid", "true"); ul.appendChild(el("li", null, el("span", { class: "x" }, "✕ "), x.text)); });
    r.notes.forEach(function (n) { ul.appendChild(el("li", { class: "nt" }, "Note: " + n)); });
  });
  $("ipSum").textContent = good + " of " + ROWS.length + " blocks check out.";
}
$("ipCheck").addEventListener("click", checkIt);
$("ipDemo").addEventListener("click", function () {
  const demo = [["192.168.40.0", "/27", "192.168.40.1", "192.168.40.30", "192.168.40.31", "192.168.40.1"], ["192.168.40.32", "255.255.255.224", "192.168.40.33", "192.168.40.62", "192.168.40.63", "192.168.40.65"], ["192.168.40.40", "/28", "192.168.40.41", "192.168.40.54", "192.168.40.55", "192.168.40.41"], ["192.168.41.0", "/29", "192.168.41.1", "192.168.41.6", "192.168.41.8", "192.168.41.1"]];
  demo.forEach(function (d, i) { F.forEach(function (f, k) { $("ip" + i + f[0]).value = d[k]; }); }); checkIt();
});
$("ipClear").addEventListener("click", function () { ROWS.forEach(function (_, i) { F.forEach(function (f) { $("ip" + i + f[0]).value = ""; }); }); checkIt(); $("ipSum").textContent = ""; });

/* the bars' real height, for the pinned terminal */
const setH = function () { document.documentElement.style.setProperty("--chromeH", document.querySelector(".chrome").offsetHeight + "px"); };
setH(); addEventListener("resize", setH);
renderLevels();
