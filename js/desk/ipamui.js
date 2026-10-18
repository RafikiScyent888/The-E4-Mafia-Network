/* The IPAM sheet as a form, on build mode's work orders (SO-J4 on) and on the
   Ticket Desk's tickets that need the office's records (SO-09): a card per
   group, the six values written by hand. Saving it is a change like any
   other. What the sheet's checker found (js/net/ipam.js) is shown once the
   sheet has been checked or saved: what's wrong, never the right value. Each
   row is marked three ways: the edge colour with its inset rule, and the
   words. */
import { el } from "./store.js";
import { checkSheet } from "../net/ipam.js";

export const IPF = [["net", "Network"], ["mask", "Mask or /prefix"], ["first", "First usable"], ["last", "Last usable"], ["bc", "Broadcast"], ["gw", "Gateway"]];
/* o: { plan (net.plan.ipam), saved (net.ipam), checked (show what the checker found), note, onSave(rows), onCheck (a Check button, if given) } */
export function ipamSheet(host, o) {
  const plan = o.plan, saved = o.saved || [], rows = plan.groups.map(function (g, i) { return Object.assign({ name: g[0], hosts: g[1] }, saved[i] || {}); });
  const res = checkSheet(plan.block, rows), any = !!o.checked;
  const box = el("section", { class: "ipam", id: "ipam", "aria-labelledby": "ipamh" }, el("h3", { id: "ipamh" }, "IPAM sheet · " + plan.block));
  box.appendChild(el("p", { class: "note" }, o.note));
  const form = el("form", { class: "sheet", novalidate: true });
  plan.groups.forEach(function (g, i) {
    const r = res[i], state = !any || r.empty ? "" : r.ok ? " goodrow" : " badrow";
    const fs = el("fieldset", { class: "blk" + state, id: "ipamRow" + i }, el("legend", null, g[0] + " · needs " + g[1] + " addresses"));
    const grid = el("div", { class: "blkgrid" });
    IPF.forEach(function (f) {
      const bad = any && r.issues.some(function (x) { return x.field === f[0]; });
      grid.appendChild(el("label", { for: "ipam" + i + f[0] }, el("span", null, f[1]), el("input", { id: "ipam" + i + f[0], name: f[0], value: (saved[i] && saved[i][f[0]]) || "", spellcheck: "false", autocomplete: "off", "aria-invalid": bad ? "true" : null })));
    });
    fs.appendChild(grid);
    if (any) {
      const ul = el("ul", { class: "res" });
      if (r.empty) ul.appendChild(el("li", { class: "nt" }, "Not filled in yet."));
      else if (r.ok) ul.appendChild(el("li", { class: "ok" }, "✓ Every value checks out."));
      r.issues.forEach(function (x) { ul.appendChild(el("li", null, el("span", { class: "x" }, "✕ "), x.text)); });
      r.notes.forEach(function (n) { ul.appendChild(el("li", { class: "nt" }, "Note: " + n)); });
      fs.appendChild(ul);
    }
    form.appendChild(fs);
  });
  const good = res.filter(function (r) { return r.ok; }).length;
  const acts = el("div", { class: "acts" }, el("button", { class: "btn small", type: "submit", id: "ipamSave" }, "Save the sheet"));
  if (o.onCheck) acts.appendChild(el("button", { class: "btn small ghost", type: "button", id: "ipamCheck", onclick: function () { o.onCheck(); } }, "Check the sheet"));
  acts.appendChild(el("span", { class: "msg", role: "status", id: "ipamSum" }, any ? good + " of " + plan.groups.length + " blocks check out." : ""));
  form.appendChild(acts);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    o.onSave(plan.groups.map(function (g, i) { const r = {}; IPF.forEach(function (f) { r[f[0]] = document.getElementById("ipam" + i + f[0]).value; }); return r; }));
  });
  box.appendChild(form);
  host.appendChild(box);
  return box;
}
