/* The terminal on the right: one device at a time, its tabs, and what is on
   them. The Command Prompt keeps its scrollback per device while the ticket
   is open. Every change goes through ctx.act, so the ticket sees it. */
import { el } from "./store.js";
import { tabsFor, page } from "../net/pages.js";
import { prompt } from "../net/cmd.js";

const terms = {};            /* device id -> { node, out, input, hist, hi } for the open ticket */
const physLog = {};          /* device id -> last physical result per cable end */
export function forgetTerminals() { for (const k in terms) delete terms[k]; for (const k in physLog) delete physLog[k]; }

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
  if (id === "router" && key !== "physical") pane.appendChild(el("p", { class: "addr" }, "Router admin page · http://" + x.lan.ip + " · signed in as admin"));
  if (id === "modem" && key === "status") pane.appendChild(el("p", { class: "addr" }, "The modem's own page · http://192.168.100.1"));
  if (id === "camera" && key === "web") pane.appendChild(el("p", { class: "addr" }, "The camera's own page"));
  if (P.kind === "rows") {
    const tb = el("tbody");
    P.rows.forEach(function (r) { tb.appendChild(el("tr", null, el("th", { scope: "row" }, r[0]), el("td", null, r[1]))); });
    pane.appendChild(el("table", { class: "kv" }, tb));
    if (P.log) { pane.appendChild(el("p", { class: "note" }, "Event log")); pane.appendChild(el("div", { class: "log" }, P.log.join("\n"))); pane.lastChild.style.whiteSpace = "pre-wrap"; }
  } else if (P.kind === "table") {
    const head = el("tr"); P.head.forEach(function (h) { head.appendChild(el("th", { scope: "col" }, h)); });
    const tb = el("tbody"); P.rows.forEach(function (r) { tb.appendChild(el("tr", null, el("td", null, r[0]), el("td", { class: "mono" }, r[1]), el("td", { class: "mono" }, r[2]), el("td", null, r[3]))); });
    pane.appendChild(el("table", { class: "grid" }, el("thead", null, head), tb));
    if (P.note) pane.appendChild(el("p", { class: "note" }, P.note));
  } else if (P.kind === "lights") {
    const ul = el("ul", { class: "leds" });
    P.lights.forEach(function (L) { ul.appendChild(el("li", null, el("span", { class: "led " + L.state, "aria-hidden": "true" }), el("b", null, L.name), el("span", null, L.text, el("span", { class: "mean" }, " · " + L.mean)))); });
    pane.appendChild(ul);
  } else if (P.kind === "lights-ports") {
    const ul = el("ul", { class: "leds" });
    P.ports.forEach(function (p) { ul.appendChild(el("li", null, el("span", { class: "led " + (p.up ? (p.speed === 1000 ? "on" : "amber") : "off"), "aria-hidden": "true" }), el("b", null, "Port " + p.port), el("span", null, p.state + (p.who ? "" : ""), p.who ? el("span", { class: "mean" }, " · cable to the " + p.who.replace(/^(\w)/, function (m) { return m.toLowerCase(); })) : null))); });
    pane.appendChild(ul);
    pane.appendChild(el("p", { class: "note" }, P.note));
  } else if (P.kind === "form" && P.form === "router-dhcp") pane.appendChild(dhcpForm(P.values, ctx, rerender));
  else if (P.kind === "form" && P.form === "router-wifi") pane.appendChild(wifiForm(P.values, ctx, rerender));
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
  const s5 = el("select", { name: "ch5" }); [36, 40, 44, 48, 149, 153, 157, 161].forEach(function (c) { const op = el("option", { value: String(c) }, String(c)); if (String(c) === v.ch5) op.selected = true; s5.appendChild(op); });
  f.appendChild(el("fieldset", null, el("legend", null, "Network"), field("Network name (SSID)", "ssid", v.ssid, { readonly: true, inputmode: "text" }), field("Security", "sec", v.sec, { readonly: true, inputmode: "text" }), field("Password", "pw", "••••••••••", { readonly: true, inputmode: "text", "aria-label": "Password, covered" })));
  f.appendChild(el("fieldset", null, el("legend", null, "Channels"), el("div", { class: "row2" }, el("label", { class: "f" }, "2.4 GHz channel", s24), el("label", { class: "f" }, "5 GHz channel", s5))));
  f.appendChild(el("div", { class: "acts" }, el("button", { class: "btn", type: "submit" }, "Save")));
  f.appendChild(msg);
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    const d = new FormData(f);
    const r = ctx.act({ t: "router", page: "wifi", values: { ch24: d.get("ch24"), ch5: d.get("ch5") } });
    if (r && r.result && r.result.ok) { ctx.flash = "Saved. Wi-Fi devices move to the new channel within a few seconds."; rerender(); }
    else { msg.className = "msg err"; msg.textContent = "Not saved: " + ((r && r.result && r.result.errs) || []).join(". ") + "."; }
  });
  if (ctx.flash) { msg.className = "msg ok"; msg.textContent = ctx.flash; ctx.flash = null; }
  return f;
}

/* "Office PC" reads "office PC" mid-sentence; "IP camera" stays as it is */
function lowerFirst(s) { return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s; }
const ACT_TEXT = { look: "Look at the plug", reseat: "Reseat the plug", test: "Test with the cable tester", replace: "Swap in a new cable", tighten: "Tighten the connector" };
function physicalPane(id, P, ctx, rerender) {
  const wrap = el("div", { class: "phys" });
  if (P.still) wrap.appendChild(el("figure", null, el("img", { src: P.still, alt: "The " + P.label + ", as its 3D model: ports, lights and labels", width: "520", height: "406" }), el("figcaption", null, "A still of the " + lowerFirst(P.label) + "'s 3D model. Turning the model yourself comes in a later update.")));
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
  wrap.appendChild(el("div", { class: "acts", style: "margin-top:10px" }, el("button", { type: "button", class: "btn ghost small", onclick: function () { const r = ctx.act({ t: "power", dev: id }); physLog[id]["power"] = r ? r.text : ""; rerender(); } }, "Restart (power off and on)")));
  wrap.appendChild(rr);
  return wrap;
}
