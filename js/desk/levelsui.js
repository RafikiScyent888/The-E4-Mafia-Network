/* The levels on the page: each one's progress, and the lock between them,
   marked three ways (the lock with its words, the dashed edge, the grey
   ground), never colour alone. Used by the Ticket Desk and build mode. */
import { el } from "./store.js";
import { LEVELS, progress, counts, finished, isOpen, whatsLeft, titleOf, built } from "./levels.js";

function parts(c) { const a = []; if (c.ntickets) a.push(c.tickets + " of " + c.ntickets + " tickets"); if (c.njobs) a.push(c.jobs + " of " + c.njobs + " work orders"); return a.join(", "); }
const lock = function () { return el("span", { class: "lk", "aria-hidden": "true" }, "\u{1F512} "); };

/* o: { selected: the level shown below the list, onPick(n) } */
export function levelList(o) {
  const P = progress(), ol = el("ol", { class: "levels" });
  LEVELS.forEach(function (L) {
    const open = isOpen(L.n, P), done = finished(L, P), c = counts(L, P), prev = LEVELS[L.n - 2];
    const byInst = open && L.n > 1 && !finished(prev, P);   /* open only because the instructor opened it */
    const st = !open ? [lock(), "Locked: opens when " + prev.name + " is finished"]
      : L.later ? [(byInst ? "Opened by your instructor: " : "") + "built later"]
      : done ? ["✓ Finished: " + parts(c)]
      : [(byInst ? "Opened by your instructor. " : "") + parts(c) + " done" + (L.coming ? " · " + L.coming : "")];
    const b = el("button", { type: "button", "data-level": String(L.n), "aria-pressed": String(L.n === o.selected), "aria-disabled": L.later && open ? "true" : null },
      el("span", { class: "lv" }, "Level " + L.n + " · " + L.name), el.apply(null, ["span", { class: "lvst" }].concat(st)));
    b.addEventListener("click", function () { if (!(L.later && open)) o.onPick(L.n, open); });
    ol.appendChild(el("li", { class: !open ? "locked" : done ? "done" : "" }, b));
  });
  return ol;
}
/* why a level is locked and exactly what's left on the one before it */
export function lockPanel(n) {
  const P = progress(), L = LEVELS[n - 1], prev = LEVELS[n - 2], left = whatsLeft(prev, P);
  const go = [];
  if (left.tickets.length) go.push(left.tickets.length + " ticket" + (left.tickets.length === 1 ? "" : "s") + " (on the Ticket Desk)");
  if (left.jobs.length) go.push(left.jobs.length + " work order" + (left.jobs.length === 1 ? "" : "s") + " (in Build)");
  const box = el("div", { class: "lockpanel", id: "lockpanel" }, el("span", { class: "tag" }, lock(), "Locked"),
    el("h3", null, "Finish " + prev.the + " to open " + L.the),
    el("p", null, "A level opens when the one before it is finished: every ticket and every work order, which is every objective it teaches." + (go.length ? " You have " + go.join(" and ") + " to go:" : "")));
  const ul = el("ul"); left.tickets.concat(left.jobs).forEach(function (id) { ul.appendChild(el("li", null, el("b", null, id), " " + titleOf(id))); });
  if (ul.children.length) box.appendChild(ul);
  if (!built(prev)) box.appendChild(el("p", null, prev.name + " is still being built: more work orders and tickets are on the way" + (go.length ? "." : ", and you've done everything ready so far.")));
  if (L.later) box.appendChild(el("p", null, L.name + " is still being built."));
  box.appendChild(el("p", null, "Your instructor can open any level for a class demonstration (Instructor menu, with their PIN)."));
  return box;
}
