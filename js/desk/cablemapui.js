/* The office's cable map, on the Ticket Desk's tickets that need it (SO-08): a row for each patch panel port the map
   lists or a run is punched down on, the room it goes to chosen from the office's rooms. Saving it changes the
   records and is replayed like the rest. Nothing here says whether a row is right: the cable does. */
import { el } from "./store.js";

export const MAP_ROOMS = [["", "Not in use"], ["front", "Front desk"], ["open", "Open-plan office"], ["manager", "Manager's office"], ["meeting", "Meeting room"]];
/* o: { map (net.cablemap), ports, saved (it has been saved in this ticket), onSave(map) } */
export function cableMap(host, o) {
  const box = el("section", { class: "ipam cmap", id: "cmap", "aria-labelledby": "cmaph" }, el("h3", { id: "cmaph" }, "Cable map · patch panel ports"));
  box.appendChild(el("p", { class: "note" }, "The installer's map, as it's taped inside the rack door. Change it here and save it once you know where each run really goes."));
  const form = el("form", { class: "sheet", novalidate: true }), tb = el("tbody");
  o.ports.forEach(function (p) {
    const sel = el("select", { id: "cm" + p, name: p });
    MAP_ROOMS.forEach(function (r) { const op = el("option", { value: r[0] }, r[1]); if ((o.map[p] || "") === r[0]) op.selected = true; sel.appendChild(op); });
    tb.appendChild(el("tr", null, el("th", { scope: "row" }, el("label", { for: "cm" + p }, "Port " + p)), el("td", null, sel)));
  });
  form.appendChild(el("table", { class: "cmaptab" }, el("thead", null, el("tr", null, el("th", { scope: "col" }, "Panel port"), el("th", { scope: "col" }, "Goes to"))), tb));
  form.appendChild(el("div", { class: "acts" }, el("button", { class: "btn small", type: "submit", id: "cmapSave" }, "Save the map"), el("span", { class: "msg", role: "status", id: "cmapSum" }, o.saved ? "Saved." : "")));
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const m = {}; o.ports.forEach(function (p) { const v = document.getElementById("cm" + p).value; if (v) m[p] = v; });
    o.onSave(m);
  });
  box.appendChild(form);
  host.appendChild(box);
  return box;
}
