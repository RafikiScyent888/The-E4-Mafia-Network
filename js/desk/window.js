/* The terminal on the right: one device at a time, its tabs, and what is on
   them. The Command Prompt keeps its scrollback per device while the ticket
   is open. Every change goes through ctx.act, so the ticket sees it. */
import { el } from "./store.js";
import { tabsFor, page } from "../net/pages.js";
import { prompt } from "../net/cmd.js";
import { physicalState } from "../net/physical.js";

/* the 3D viewer is loaded the first time a Physical tab opens, never before */
let m3dLoad = null, m3d = null;
function load3d() { return m3dLoad || (m3dLoad = import("./model3d.js").then(function (m) { m3d = m; return m; })); }

const terms = {};            /* device id -> { node, out, input, hist, hi } for the open ticket */
const physLog = {};          /* device id -> last physical result per cable end */
const said = {};             /* device id -> last result of a page button (test page, speed test, rejoin) */
export function forgetTerminals() { for (const k in terms) delete terms[k]; for (const k in physLog) delete physLog[k]; for (const k in said) delete said[k]; if (m3d) m3d.forget(); }

export function renderWindow(host, ctx) {
  const T = ctx.T, id = ctx.open, tabs = tabsFor(T.sim, id);
  if (!tabs.some(function (t) { return t.key === ctx.tab; })) ctx.tab = tabs[0].key;
  host.innerHTML = "";
  const bar = el("div", { class: "win-tabs", role: "tablist", "aria-label": T.sim.d[id].label + " tabs" });
  tabs.forEach(function (t) {
    bar.appendChild(el("button", { type: "button", role: "tab", "aria-selected": String(t.key === ctx.tab), onclick: function () { ctx.tab = t.key; ctx.view(id, t.key); renderWindow(host, ctx); if (t.key === "cmd") focusCmd(id); } }, t.title));
  });
  host.appendChild(bar);
  const body = el("div", { class: "win-body", role: "tabpanel" });
  host.appendChild(body);
  if (ctx.tab === "cmd") body.appendChild(cmdPane(id, ctx));
  else body.appendChild(pagePane(id, ctx.tab, ctx, function () { renderWindow(host, ctx); }));
}
export function focusCmd(id) { const t = terms[id]; if (t) t.input.focus({ preventScroll: true }); }

function cmdPane(id, ctx) {
  let t = terms[id];
  if (!t) {
    const out = el("pre", { "aria-live": "polite" });
    out.textContent = "Type help to see the commands you can use here.\n\n";
    const input = el("input", { class: "cmdin", type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": "Command for the " + ctx.T.sim.d[id].label });
    const label = el("span", { class: "prompt", "aria-hidden": "true" }, prompt(ctx.T.sim, id));
    const line = el("div", { class: "line" }, label, input);
    const node = el("div", { class: "term", role: "log", "aria-label": ctx.T.sim.d[id].label + " Command Prompt", onclick: function (e) { if (!window.getSelection().toString()) input.focus({ preventScroll: true }); } }, out, line);
    t = terms[id] = { node: node, out: out, input: input, hist: [], hi: 0 };
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        const v = input.value; input.value = "";
        if (v.trim()) { t.hist.push(v); } t.hi = t.hist.length;
        out.textContent += prompt(ctx.T.sim, id) + v + "\n";
        if (v.trim()) {
          const r = ctx.act({ t: "cmd", dev: id, line: v });
          if (r && r.clear) out.textContent = "";
          else if (r) out.textContent += (r.out || "") + "\n";
        }
        node.scrollTop = node.scrollHeight;
      } else if (e.key === "ArrowUp") { if (t.hi > 0) { t.hi--; input.value = t.hist[t.hi]; } e.preventDefault(); }
      else if (e.key === "ArrowDown") { if (t.hi < t.hist.length) { t.hi++; input.value = t.hist[t.hi] || ""; } e.preventDefault(); }
    });
  }
  return t.node;
}

function pagePane(id, key, ctx, rerender) {
  const T = ctx.T, P = page(T.sim, id, key), x = T.sim.d[id];
  const pane = el("div", { class: "pane" });
  if (id === "router" && key !== "physical") pane.appendChild(el("p", { class: "addr" }, "Router admin page · http://" + x.lan.ip + " · signed in as admin" + (x.admin && x.admin.gen === 1 ? ", with the password on the router's label" : "")));
  if (id === "modem" && key === "status") pane.appendChild(el("p", { class: "addr" }, "The modem's own page · http://192.168.100.1"));
  if (id === "camera" && key === "web") pane.appendChild(el("p", { class: "addr" }, "The camera's own page"));
  if (P.kind === "rows") {
    const tb = el("tbody");
    P.rows.forEach(function (r) { tb.appendChild(el("tr", null, el("th", { scope: "row" }, r[0]), el("td", null, r[1]))); });
    pane.appendChild(el("table", { class: "kv" }, tb));
    if (P.log) { pane.appendChild(el("p", { class: "note" }, "Event log")); pane.appendChild(el("div", { class: "log" }, P.log.join("\n"))); pane.lastChild.style.whiteSpace = "pre-wrap"; }
    if (P.ipForm) pane.appendChild(ipForm(id, P.ipForm, ctx, rerender));
    if (P.speedTest) pane.appendChild(button(id, "speed", "Run a speed test", ctx, rerender, function () { const r = ctx.act({ t: "speed", dev: id }); const x = r && r.result; return x && x.ok ? "Speed test: " + x.down + " Mb/s down, " + x.up + " Mb/s up (the plan is " + x.plan + " Mb/s)." : "Speed test: can't reach the test server."; }));
    if (P.networks) pane.appendChild(networksList(id, P, ctx, rerender));
    if (P.admin) pane.appendChild(button(id, "admin", "Change the admin password", ctx, rerender, function () { const r = ctx.act({ t: "router", page: "admin", values: { newPassword: true } }); return r && r.result && r.result.ok ? "Saved: a new admin password for the router's pages, written down for the client. The one on the label no longer opens them." : "Not saved."; }));
    if (P.join) pane.appendChild(button(id, "join", "Join " + P.join + " (enter the password)", ctx, rerender, function () { const r = ctx.act({ t: "join", dev: id }); const f = r && r.facts; return f && f.ap ? "Joined " + P.join + ": address " + f.ip + ". Internet: " + (f.internet ? "OK" : "none") + "." : "Couldn't join " + P.join + "."; }));
    else if (said[id] && said[id].join) pane.appendChild(el("p", { class: "res", role: "status" }, said[id].join));   /* joined: the button goes, what happened stays */
    if (P.reenter) pane.appendChild(button(id, "reenter", "Re-enter the Wi-Fi password", ctx, rerender, function () { const r = ctx.act({ t: "join", dev: id }); const f = r && r.facts; return f && f.ap ? "Joined with the new password: address " + f.ip + ". Internet: " + (f.internet ? "OK" : "none") + "." : "Still can't join."; }));
    if (P.rejoin) pane.appendChild(button(id, "rejoin", "Turn Wi-Fi off and on", ctx, rerender, function () { const r = ctx.act({ t: "rejoin", dev: id }); const f = r && r.facts; return f && f.ip ? "Rejoined the Wi-Fi: address " + f.ip + (f.apipa ? " (no address came; it gave itself this one)" : "") + ". Internet: " + (f.internet ? "OK" : "none") + "." : "Can't see the Wi-Fi network."; }));
    if (P.cameraApp) pane.appendChild(button(id, "camera", "Open the camera app on mobile data", ctx, rerender, function () { const r = ctx.act({ t: "outside", port: 8443 }); const x = r && r.result; return x && x.ok ? "Camera app: connected. The porch camera's picture comes up." : "Camera app: can't connect to the camera" + (x && x.why === "refused" ? " (the connection was refused)" : x && x.why === "nobody" ? " (nothing answered)" : "") + "."; }));
  } else if (P.kind === "printers") {
    pane.appendChild(el("table", { class: "kv" }, el("tbody", null, el("tr", null, el("th", { scope: "row" }, "Printer"), el("td", null, P.name)), el("tr", null, el("th", { scope: "row" }, "Printer port (its address)"), el("td", null, P.port)))));
    pane.appendChild(button(id, "print", "Print a test page", ctx, rerender, function () { const r = ctx.act({ t: "print" }); const x = r && r.result; return x && x.ok ? "Test page sent to " + x.port + ": it printed." : "Test page sent to " + (x && x.port) + ": nothing printed. Windows says the printer is offline."; }));
    const msg = el("p", { class: "msg", role: "status" });
    const f = el("form", { class: "devform", novalidate: true, style: "margin-top:12px" }, el("fieldset", null, el("legend", null, "Change the printer port"), field("Printer's IP address", "port", P.port), el("div", { class: "acts" }, el("button", { class: "btn", type: "submit" }, "Save"))), msg);
    f.addEventListener("submit", function (e) { e.preventDefault(); const r = ctx.act({ t: "pcprinter", ip: new FormData(f).get("port") }); if (r && r.result && r.result.ok) { ctx.flash = "Saved: the office printer is now at " + new FormData(f).get("port") + "."; rerender(); } else { msg.className = "msg err"; msg.textContent = "Not saved: " + ((r && r.result && r.result.errs) || []).join(". ") + "."; } });
    if (ctx.flash) { msg.className = "msg ok"; msg.textContent = ctx.flash; ctx.flash = null; }
    pane.appendChild(f);
  } else if (P.kind === "table") {
    const head = el("tr"); P.head.forEach(function (h) { head.appendChild(el("th", { scope: "col" }, h)); });
    const tb = el("tbody"); P.rows.forEach(function (r) { tb.appendChild(el("tr", null, el("td", null, r[0]), el("td", { class: "mono" }, r[1]), el("td", { class: "mono" }, r[2]), el("td", null, r[3] === "Reserved" || !P.reserve ? r[3] : el("button", { type: "button", class: "btn ghost small", "aria-label": "Reserve " + r[2] + " for " + r[0], onclick: function () { const x = ctx.act({ t: "router", page: "reservation-add", values: { name: r[0], mac: r[1], ip: r[2] } }); ctx.flash = x && x.result && x.result.ok ? "Reserved " + r[2] + " for " + r[0] + "." : "Not reserved."; rerender(); } }, "Reserve")))); });
    pane.appendChild(el("table", { class: "grid" }, el("thead", null, head), tb));
    if (P.note) pane.appendChild(el("p", { class: "note" }, P.note));
    if (P.reserve) pane.appendChild(reservations(P, ctx, rerender));
  } else if (P.kind === "lights") {
    const ul = el("ul", { class: "leds" });
    P.lights.forEach(function (L) { ul.appendChild(el("li", null, el("span", { class: "led " + L.state, "aria-hidden": "true" }), el("b", null, L.name), el("span", null, L.text, el("span", { class: "mean" }, " · " + L.mean)))); });
    pane.appendChild(ul);
  } else if (P.kind === "lights-ports") {
    const ul = el("ul", { class: "leds" });
    P.ports.forEach(function (p) { ul.appendChild(el("li", null, el("span", { class: "led " + (p.up ? (p.speed === 1000 ? "on" : "amber") : "off"), "aria-hidden": "true" }), el("b", null, "Port " + p.port), el("span", null, p.state + (p.who ? "" : ""), p.who ? el("span", { class: "mean" }, " · cable to " + p.who) : null))); });
    pane.appendChild(ul);
    pane.appendChild(el("p", { class: "note" }, P.note));
  } else if (P.kind === "form" && P.form === "router-dhcp") pane.appendChild(dhcpForm(P.values, ctx, rerender));
  else if (P.kind === "form" && P.form === "router-wifi") pane.appendChild(wifiForm(P.values, ctx, rerender));
  else if (P.kind === "form" && P.form === "router-forward") pane.appendChild(forwardForm(P, ctx, rerender));
  else if (P.kind === "form" && P.form === "printer") pane.appendChild(printerForm(P, ctx, rerender));
  else if (P.kind === "form" && P.form === "rogue") pane.appendChild(rogueForm(P, ctx, rerender));
  else if (P.kind === "physical") pane.appendChild(physicalPane(id, P, ctx, rerender));
  return pane;
}

function radio(name, value, checked, text) { const i = el("input", { type: "radio", name: name, value: value }); i.checked = !!checked; return el("label", { class: "radio" }, i, text); }
function field(label, name, value, attrs) { const i = el("input", Object.assign({ type: "text", name: name, value: value == null ? "" : value, inputmode: "decimal", autocomplete: "off" }, attrs || {})); return el("label", { class: "f" }, label, i); }

function dhcpForm(v, ctx, rerender) {
  const msg = el("p", { class: "msg", role: "status" });
  const f = el("form", { class: "devform", novalidate: true });
  f.appendChild(el("fieldset", null, el("legend", null, "LAN"), el("div", { class: "row2" }, field("Router address", "lanIp", v.lanIp, { readonly: true }), field("Subnet mask", "mask", v.mask, { readonly: true }))));
  f.appendChild(el("fieldset", null, el("legend", null, "DHCP server"), el("div", { class: "radio" }, radio("on", "1", v.on, "On"), radio("on", "0", !v.on, "Off")),
    el("div", { class: "row2" }, field("Start address", "start", v.start), field("End address", "end", v.end)), field("Lease time (hours)", "leaseH", v.leaseH, { inputmode: "numeric" })));
  f.appendChild(el("fieldset", null, el("legend", null, "DNS servers handed out"), radio("dnsMode", "router", v.dnsMode === "router", "The router itself (it passes questions to the provider)"), radio("dnsMode", "manual", v.dnsMode === "manual", "These servers:"),
    el("div", { class: "row2" }, field("Primary DNS", "dns1", v.dns1), field("Secondary DNS", "dns2", v.dns2))));
  f.appendChild(el("div", { class: "acts" }, el("button", { class: "btn", type: "submit" }, "Save")));
  f.appendChild(msg);
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    const d = new FormData(f);
    const values = { on: d.get("on") === "1", start: d.get("start"), end: d.get("end"), leaseH: d.get("leaseH"), dnsMode: d.get("dnsMode"), dns1: d.get("dns1"), dns2: d.get("dns2") };
    const r = ctx.act({ t: "router", page: "dhcp", values: values });
    const res = r && r.result;
    if (res && res.ok) { ctx.flash = "Saved. Devices pick up DHCP changes the next time they ask for an address."; rerender(); }
    else { msg.className = "msg err"; msg.textContent = "Not saved: " + ((res && res.errs) || ["check the fields"]).join(". ") + "."; }
  });
  if (ctx.flash) { msg.className = "msg ok"; msg.textContent = ctx.flash; ctx.flash = null; }
  return f;
}

function wifiForm(v, ctx, rerender) {
  const msg = el("p", { class: "msg", role: "status" });
  const f = el("form", { class: "devform", novalidate: true });
  const s24 = el("select", { name: "ch24" }); [["auto", "Auto (now " + v.ch24now + ")"]].concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (c) { return [String(c), String(c)]; })).forEach(function (o) { const op = el("option", { value: o[0] }, o[1]); if (o[0] === v.ch24) op.selected = true; s24.appendChild(op); });
  const sec = el("select", { name: "sec" }); [["WPA2-Personal", "WPA2-Personal"], ["WPA2/WPA3-Personal", "WPA2/WPA3-Personal (transition)"], ["WPA3-Personal", "WPA3-Personal"]].forEach(function (o) { const op = el("option", { value: o[0] }, o[1]); if (o[0] === v.sec) op.selected = true; sec.appendChild(op); });
  const s5 = el("select", { name: "ch5" }); [36, 40, 44, 48, 149, 153, 157, 161].forEach(function (c) { const op = el("option", { value: String(c) }, String(c)); if (String(c) === v.ch5) op.selected = true; s5.appendChild(op); });
  f.appendChild(el("fieldset", null, el("legend", null, "Network"), field("Network name (SSID)", "ssid", v.ssid, { readonly: !v.rename, inputmode: "text", maxlength: "32" }), el("label", { class: "f" }, "Security", sec), field("Password", "pw", "••••••••••", { readonly: true, inputmode: "text", "aria-label": "Password, covered" })));
  if (v.factory) f.appendChild(el("p", { class: "note" }, "The Wi-Fi password is the one printed on the router's label."));
  if (v.bssids) f.appendChild(el("p", { class: "note" }, "This router's radios (BSSIDs): " + v.bssids.map(function (b) { return b[0] + " " + b[1]; }).join(", ")));
  f.appendChild(el("fieldset", null, el("legend", null, "Channels"), el("div", { class: "row2" }, el("label", { class: "f" }, "2.4 GHz channel", s24), el("label", { class: "f" }, "5 GHz channel", s5))));
  f.appendChild(el("div", { class: "acts" }, el("button", { class: "btn", type: "submit" }, "Save")));
  f.appendChild(msg);
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    const d = new FormData(f);
    const values = { ch24: d.get("ch24"), ch5: d.get("ch5"), sec: d.get("sec") };
    if (v.rename && String(d.get("ssid") || "").trim() !== v.ssid) values.ssid = d.get("ssid");   /* a new name only when it was changed: the same name saved again moves nobody */
    const r = ctx.act({ t: "router", page: "wifi", values: values });
    if (r && r.result && r.result.ok) { ctx.flash = "Saved. Wi-Fi devices reconnect with the new settings within a few seconds."; rerender(); }
    else { msg.className = "msg err"; msg.textContent = "Not saved: " + ((r && r.result && r.result.errs) || []).join(". ") + "."; }
  });
  if (ctx.flash) { msg.className = "msg ok"; msg.textContent = ctx.flash; ctx.flash = null; }
  const pw = el("div", { class: "acts", style: "margin-top:10px" }, el("button", { type: "button", class: "btn ghost small", onclick: function () { const r = ctx.act({ t: "router", page: "wifi", values: { newPassword: true } }); if (r && r.result && r.result.ok) { ctx.flash = "Saved: a new Wi-Fi password. Every Wi-Fi device has to be given it again."; rerender(); } } }, "Change the Wi-Fi password"));
  return el("div", null, f, pw, v.changed ? el("p", { class: "note" }, "The Wi-Fi password was changed today.") : null);
}

/* "Office PC" reads "office PC" mid-sentence; "IP camera" stays as it is */
function lowerFirst(s) { return /^[A-Z][a-z]+(\s|$)/.test(s) ? s[0].toLowerCase() + s.slice(1) : s; }
const ACT_TEXT = { look: "Look at the plug", reseat: "Reseat the plug", unplug: "Unplug it", test: "Test with the cable tester", replace: "Swap in a new cable", tighten: "Tighten the connector" };
function physicalPane(id, P, ctx, rerender) {
  const wrap = el("div", { class: "phys" });
  const S = physicalState(ctx.T.sim, id);
  if (S) wrap.appendChild(modelFigure(S, P));
  const ul = el("ul", { class: "cabs" });
  physLog[id] = physLog[id] || {};
  P.cables.forEach(function (c) {
    const key = c.cable + ":" + c.end;
    const res = el("p", { class: "res", role: "status" }); if (physLog[id][key]) res.textContent = physLog[id][key]; else res.hidden = true;
    const acts = el("div", { class: "acts" });
    c.acts.forEach(function (a) {
      const label = c.cable === "c-coax" && a === "look" ? "Look at the connector" : ACT_TEXT[a];
      acts.appendChild(el("button", { type: "button", class: "btn ghost small", onclick: function () {
        const r = ctx.act(a === "test" || a === "replace" ? { t: a, cable: c.cable } : { t: a, cable: c.cable, end: c.end });
        physLog[id][key] = label + ": " + (r ? r.text : ""); rerender();
      } }, label));
    });
    ul.appendChild(el("li", null, el("p", { class: "nm" }, c.name), acts, res));
  });
  if (P.cables.length) wrap.appendChild(ul); else wrap.appendChild(el("p", { class: "note" }, "No cables: this device is on Wi-Fi."));
  const rr = el("p", { class: "res", role: "status" }); if (physLog[id]["power"]) rr.textContent = physLog[id]["power"]; else rr.hidden = true;
  if (P.restart) wrap.appendChild(el("div", { class: "acts", style: "margin-top:10px" }, el("button", { type: "button", class: "btn ghost small", onclick: function () { const r = ctx.act({ t: "power", dev: id }); physLog[id]["power"] = r ? r.text : ""; rerender(); } }, "Restart (power off and on)")));
  if (P.injector) {   /* the injector's own power adapter, and swapping the injector itself */
    const j = P.injector, say = function (r) { const f = r && r.facts; return f ? "The injector's power is " + (f.power ? "plugged in" : "unplugged") + ". The camera: " + (f.camera ? "it powers up (its lights come on)" : "still dark") + "." : ""; };
    wrap.appendChild(el("div", { class: "acts", style: "margin-top:10px" },
      el("button", { type: "button", class: "btn ghost small", onclick: function () { const r = ctx.act({ t: "injector", values: { power: !j.power } }); physLog[id]["power"] = (j.power ? "Unplugged its power adapter. " : "Plugged its power adapter in. ") + say(r); rerender(); } }, j.power ? "Unplug its power adapter" : "Plug its power adapter in"),
      el("button", { type: "button", class: "btn ghost small", onclick: function () { const r = ctx.act({ t: "injector", values: { swap: true } }); physLog[id]["power"] = "Swapped in a new 802.3af PoE injector, same cables and adapter. " + say(r); rerender(); } }, "Swap in a new 802.3af injector")));
  }
  wrap.appendChild(rr);
  return wrap;
}

/* the device's 3D model as it is right now, the buttons to turn it, and what it shows in words */
function modelFigure(S, P) {
  const holder = el("div", { class: "m3d-stage" });
  const bar = el("div", { class: "m3d-bar", role: "group", "aria-label": "Turn the " + lowerFirst(S.label) + "'s model" });
  const note = el("p", { class: "m3d-note", role: "status" }, "Loading the 3D model...");
  const says = el("ul", { class: "m3d-says" }); S.says.forEach(function (t) { says.appendChild(el("li", null, t)); });
  const fig = el("figure", { class: "m3d" }, holder, note, bar, el("figcaption", null, el("b", null, "What you can see on it"), says));
  function still() {
    holder.className = "m3d-still"; holder.innerHTML = "";
    if (P.still) holder.appendChild(el("img", { src: P.still, alt: "The " + S.label + " as photographed for its model, every cable in and every light on", width: "520", height: "406" }));
    note.textContent = "3D isn't available in this browser, so " + (P.still ? "this is a still of the model with every cable in: it doesn't show today's lights or plugs. " : "") + "The list below says what the model shows right now.";
  }
  load3d().then(function (m) {
    if (!holder.isConnected) return;               /* the tab was redrawn before the model loaded */
    let h; try { h = m.mount(holder, S); } catch (e) { still(); return; }
    note.textContent = "Drag to turn it, scroll or pinch to zoom, or use these buttons.";
    turnButtons(bar, h);
    bar.appendChild(el("button", { type: "button", class: "btn small", onclick: function () { enlarge(m, S, holder); } }, "Enlarge"));
  }).catch(still);
  return fig;
}
function turnButtons(bar, h) {
  h.views.forEach(function (v) { bar.appendChild(el("button", { type: "button", class: "btn ghost small", onclick: function () { h.look(v); } }, v)); });
  [["Turn left", function () { h.turn(-30); }], ["Turn right", function () { h.turn(30); }], ["Closer", function () { h.zoom(0.8); }], ["Further", function () { h.zoom(1.25); }], ["Reset view", function () { h.reset(); }]].forEach(function (b) {
    bar.appendChild(el("button", { type: "button", class: "btn ghost small", onclick: b[1] }, b[0]));
  });
}
/* the same model, big: for a closer look, and for anyone who needs it larger */
function enlarge(m, S, back) {
  const big = el("div", { class: "m3d-stage big" }), bar = el("div", { class: "m3d-bar", role: "group", "aria-label": "Turn the model" });
  const says = el("ul", { class: "m3d-says" }); S.says.forEach(function (t) { says.appendChild(el("li", null, t)); });
  const close = el("button", { type: "button", class: "btn ghost small x" }, "Close");
  const d = el("dialog", { class: "m3d-dialog", "aria-labelledby": "m3dh" }, el("div", { class: "dh" }, el("h2", { id: "m3dh" }, S.label + ": 3D model"), close),
    el("div", { class: "db" }, big, bar, el("p", { class: "m3d-note" }, "Drag to turn it, scroll or pinch to zoom, or use the buttons."), el("p", { style: "margin:10px 0 0" }, el("b", null, "What you can see on it")), says));
  document.body.appendChild(d);
  close.addEventListener("click", function () { d.close(); });
  d.addEventListener("close", function () { d.remove(); if (back.isConnected) m.mount(back, S); });
  d.showModal();
  turnButtons(bar, m.mount(big, S));
  close.focus();
}

/* a page button whose result stays on the page */
function button(id, key, label, ctx, rerender, run) {
  said[id] = said[id] || {};
  const res = el("p", { class: "res", role: "status" }); if (said[id][key]) res.textContent = said[id][key]; else res.hidden = true;
  return el("div", { style: "margin-top:10px" }, el("button", { type: "button", class: "btn ghost small", onclick: function () { said[id][key] = run(); rerender(); } }, label), res);
}

function forwardForm(P, ctx, rerender) {
  const wrap = el("div", { class: "devform" });
  wrap.appendChild(el("p", { class: "note", style: "margin:0" }, "Connections from the internet to " + P.wan + " on an outside port go to the device below."));
  if (!P.rules.length) wrap.appendChild(el("p", { class: "note" }, "No port forwards are set up."));
  P.rules.forEach(function (r) {
    const msg = el("p", { class: "msg", role: "status" });
    const f = el("form", { novalidate: true }, el("fieldset", null, el("legend", null, r.name + ": outside port " + r.ext), el("div", { class: "row2" }, field("Goes to address", "ip", r.ip), field("Port on that device", "port", r.port, { readonly: true })), el("div", { class: "acts" }, el("button", { class: "btn", type: "submit" }, "Save"))), msg);
    f.addEventListener("submit", function (e) { e.preventDefault(); const x = ctx.act({ t: "router", page: "forward", values: { ext: r.ext, ip: new FormData(f).get("ip") } }); if (x && x.result && x.result.ok) { ctx.flash = "Saved."; rerender(); } else { msg.className = "msg err"; msg.textContent = "Not saved: " + ((x && x.result && x.result.errs) || []).join(". ") + "."; } });
    wrap.appendChild(f);
  });
  if (ctx.flash) { wrap.appendChild(el("p", { class: "msg ok", role: "status" }, ctx.flash)); ctx.flash = null; }
  return wrap;
}

function reservations(P, ctx, rerender) {
  const wrap = el("div", { style: "margin-top:12px" });
  wrap.appendChild(el("h3", null, "Reserved addresses"));
  if (P.reservations.length) {
    const tb = el("tbody");
    P.reservations.forEach(function (r) { tb.appendChild(el("tr", null, el("td", null, r[0]), el("td", { class: "mono" }, r[1]), el("td", { class: "mono" }, r[2]), el("td", null, el("button", { type: "button", class: "btn ghost small", "aria-label": "Remove the reservation for " + r[0], onclick: function () { ctx.act({ t: "router", page: "reservation-del", values: { mac: r[1] } }); ctx.flash = "Removed the reservation for " + r[0] + "."; rerender(); } }, "Remove")))); });
    wrap.appendChild(el("table", { class: "grid" }, el("thead", null, el("tr", null, el("th", { scope: "col" }, "Device"), el("th", { scope: "col" }, "Hardware address"), el("th", { scope: "col" }, "IP address"), el("th", { scope: "col" }, ""))), tb));
  } else wrap.appendChild(el("p", { class: "note" }, "None. A reserved address is kept for one device, by its hardware address."));
  const msg = el("p", { class: "msg", role: "status" });
  const f = el("form", { class: "devform", novalidate: true, style: "margin-top:8px" }, el("fieldset", null, el("legend", null, "Add a reservation"), field("Device name", "name", "", { inputmode: "text" }), el("div", { class: "row2" }, field("Hardware address", "mac", "", { inputmode: "text" }), field("IP address", "ip", "")), el("div", { class: "acts" }, el("button", { class: "btn", type: "submit" }, "Add"))), msg);
  f.addEventListener("submit", function (e) { e.preventDefault(); const d = new FormData(f); const x = ctx.act({ t: "router", page: "reservation-add", values: { name: d.get("name") || "Device", mac: d.get("mac"), ip: d.get("ip") } }); if (x && x.result && x.result.ok) { ctx.flash = "Reserved " + d.get("ip") + "."; rerender(); } else { msg.className = "msg err"; msg.textContent = "Not added: " + ((x && x.result && x.result.errs) || []).join(". ") + "."; } });
  wrap.appendChild(f);
  if (ctx.flash) { msg.className = "msg ok"; msg.textContent = ctx.flash; ctx.flash = null; }
  return wrap;
}

/* the networks in range, as Windows lists them to pick from, and forgetting the one it has saved */
function networksList(id, P, ctx, rerender) {
  said[id] = said[id] || {};
  const wrap = el("div", { style: "margin-top:12px" }, el("h3", null, "Networks in range"));
  const ul = el("ul", { class: "cabs" });
  P.networks.forEach(function (n) {
    const label = n.open ? "Open: no password" : "Secured (" + n.sec + ")";
    ul.appendChild(el("li", null, el("p", { class: "nm" }, n.ssid), el("p", { style: "margin:0 0 6px" }, label + " · signal " + n.signal + "%" + (n.now ? " · connected" : "")),
      n.now ? null : el("div", { class: "acts" }, el("button", { type: "button", class: "btn ghost small", onclick: function () { const r = ctx.act({ t: "join", dev: id, open: n.open }); const f = r && r.facts; said[id].net = "Connect to " + n.ssid + (n.open ? " (open)" : "") + ": " + (f && f.ap ? "connected, address " + f.ip + ". Internet: " + (f.internet ? "OK" : "none") + "." : "couldn't connect."); rerender(); } }, "Connect" + (n.open ? " (open)" : " (enter the password)")))));
  });
  wrap.appendChild(ul);
  if (P.forget) wrap.appendChild(el("div", { class: "acts", style: "margin-top:8px" }, el("button", { type: "button", class: "btn ghost small", onclick: function () { ctx.act({ t: "forget", dev: id }); said[id].net = "Forgot the saved network: the laptop won't join it again by itself."; rerender(); } }, "Forget the saved network")));
  const res = el("p", { class: "res", role: "status" }); if (said[id].net) res.textContent = said[id].net; else res.hidden = true;
  wrap.appendChild(res);
  return wrap;
}

/* Windows' "Edit IP settings": automatic, or every number typed by hand */
function ipForm(id, v, ctx, rerender) {
  const msg = el("p", { class: "msg", role: "status" });
  const f = el("form", { class: "devform", novalidate: true, style: "margin-top:12px" });
  f.appendChild(el("fieldset", null, el("legend", null, "Edit IP settings (IPv4)"), el("div", { class: "radio" }, radio("mode", "dhcp", v.mode !== "static", "Automatic (DHCP)"), radio("mode", "static", v.mode === "static", "Manual")),
    el("div", { class: "row2" }, field("IP address", "ip", v.ip), field("Subnet mask", "mask", v.mask)), field("Gateway", "gw", v.gw),
    el("div", { class: "row2" }, field("Preferred DNS", "dns1", v.dns1), field("Alternate DNS", "dns2", v.dns2))));
  f.appendChild(el("div", { class: "acts" }, el("button", { class: "btn", type: "submit" }, "Save")));
  f.appendChild(msg);
  f.addEventListener("submit", function (e) {
    e.preventDefault(); const d = new FormData(f), t = function (k) { return String(d.get(k) || "").trim(); };
    const values = d.get("mode") === "static" ? { mode: "static", ip: t("ip"), mask: t("mask"), gw: t("gw"), dns: [t("dns1"), t("dns2")] } : { mode: "dhcp" };
    const x = ctx.act({ t: "client", dev: id, values: values });
    if (x && x.result && x.result.ok) { ctx.flash = "Saved. Windows applied the new IP settings."; rerender(); }
    else { msg.className = "msg err"; msg.textContent = "Not saved: " + ((x && x.result && x.result.errs) || []).join(". ") + "."; }
  });
  if (ctx.flash) { msg.className = "msg ok"; msg.textContent = ctx.flash; ctx.flash = null; }
  return f;
}

function printerForm(P, ctx, rerender) {
  const v = P.values, msg = el("p", { class: "msg", role: "status" });
  const f = el("form", { class: "devform", novalidate: true });
  f.appendChild(el("table", { class: "kv" }, el("tbody", null, el("tr", null, el("th", { scope: "row" }, "Status"), el("td", null, P.status)), el("tr", null, el("th", { scope: "row" }, "Hardware address"), el("td", null, P.mac)))));
  f.appendChild(el("fieldset", null, el("legend", null, "Network > TCP/IP"), el("div", { class: "radio" }, radio("mode", "static", v.mode === "static", "Manual (static)"), radio("mode", "dhcp", v.mode === "dhcp", "Automatic (DHCP)")),
    field("IP address", "ip", v.ip), el("div", { class: "row2" }, field("Subnet mask", "mask", v.mask), field("Gateway", "gw", v.gw))));
  f.appendChild(el("div", { class: "acts" }, el("button", { class: "btn", type: "submit" }, "Save")));
  f.appendChild(msg);
  f.addEventListener("submit", function (e) {
    e.preventDefault(); const d = new FormData(f);
    const values = d.get("mode") === "dhcp" ? { mode: "dhcp" } : { mode: "static", ip: String(d.get("ip")).trim(), mask: String(d.get("mask")).trim(), gw: String(d.get("gw")).trim() };
    const x = ctx.act({ t: "client", dev: "printer", values: values });
    if (x && x.result && x.result.ok) { ctx.flash = "Saved. The printer restarted its network with the new settings."; rerender(); }
    else { msg.className = "msg err"; msg.textContent = "Not saved: " + ((x && x.result && x.result.errs) || []).join(". ") + "."; }
  });
  if (ctx.flash) { msg.className = "msg ok"; msg.textContent = ctx.flash; ctx.flash = null; }
  return f;
}

function rogueForm(P, ctx, rerender) {
  const msg = el("p", { class: "msg", role: "status" });
  const f = el("form", { class: "devform", novalidate: true });
  const tb = el("tbody"); P.rows.forEach(function (r) { tb.appendChild(el("tr", null, el("th", { scope: "row" }, r[0]), el("td", null, r[1]))); });
  f.appendChild(el("table", { class: "kv" }, tb));
  f.appendChild(el("fieldset", null, el("legend", null, "DHCP server"), el("div", { class: "radio" }, radio("dhcpOn", "1", P.values.dhcpOn, "On"), radio("dhcpOn", "0", !P.values.dhcpOn, "Off"))));
  f.appendChild(el("div", { class: "acts" }, el("button", { class: "btn", type: "submit" }, "Save")));
  f.appendChild(msg);
  f.addEventListener("submit", function (e) { e.preventDefault(); ctx.act({ t: "rogue", values: { dhcpOn: new FormData(f).get("dhcpOn") === "1" } }); ctx.flash = "Saved."; rerender(); });
  if (ctx.flash) { msg.className = "msg ok"; msg.textContent = ctx.flash; ctx.flash = null; }
  return f;
}
