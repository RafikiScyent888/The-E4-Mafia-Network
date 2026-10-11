/* The instructor's tools, behind the instructor PIN: open any ticket on a
   chosen house for a demonstration, see the current ticket's fault and fix,
   see all of Mason's help at once, and clear this computer's progress.
   Everything shows here, in the instructor's window, never on the student's
   board. The PIN isn't written in the page (only a hash of it is); a static
   site can't truly hide it, so this keeps answers out of casual reach rather
   than locking them away. It unlocks for this browser tab only. */
import { el } from "./store.js";
import { hash } from "../net/util.js";
import * as E from "../tickets/engine.js";

const PIN_HASH = 4061435687;                       /* hash("e4-instructor:" + PIN) */
const KEY = "e4-instructor";
const unlocked = function () { try { return sessionStorage.getItem(KEY) === "1"; } catch (e) { return false; } };

export function setupInstructor(ctx, api) {
  const d = el("dialog", { id: "inst", "aria-labelledby": "insth" });
  const body = el("div", { class: "db" });
  const close = el("button", { type: "button", class: "btn ghost small x" }, "Close");
  d.appendChild(el("div", { class: "dh" }, el("h2", { id: "insth" }, "Instructor"), close));
  d.appendChild(body);
  document.body.appendChild(d);
  close.addEventListener("click", function () { d.close(); });
  document.getElementById("mInst").addEventListener("click", function () { draw(); d.showModal(); const f = d.querySelector("input, select"); if (f) f.focus(); });

  function draw() { body.innerHTML = ""; if (unlocked()) tools(); else lock(); }
  function lock() {
    const msg = el("p", { class: "msg", role: "status" });
    const pin = el("input", { type: "password", name: "pin", inputmode: "numeric", autocomplete: "off", id: "instpin" });
    const f = el("form", { class: "devform", novalidate: true }, el("label", { class: "f", for: "instpin" }, "Instructor PIN", pin), el("div", { class: "acts" }, el("button", { class: "btn", type: "submit" }, "Unlock")), msg);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (hash("e4-instructor:" + String(pin.value).trim()) === PIN_HASH) { try { sessionStorage.setItem(KEY, "1"); } catch (err) {} draw(); const s = body.querySelector("select"); if (s) s.focus(); }
      else { msg.className = "msg err"; msg.textContent = "That PIN isn't right."; pin.value = ""; pin.focus(); }
    });
    body.appendChild(el("p", null, "For the instructor: demonstrations, answers and progress. Students don't need this."));
    body.appendChild(f);
  }
  function tools() {
    if (api.render) { api.render(body, function () { draw(); }, function () { d.close(); }); lockButton(); return; }   /* a page with tools of its own (build mode) */
    const T = ctx.T, def = T.def;
    /* a demonstration: any ticket, on a house of your choosing (the same number gives the same house every time) */
    const sel = el("select", { name: "ticket", id: "instt" });
    ctx.list.filter(function (t) { return t.built; }).forEach(function (t) { const o = el("option", { value: t.id }, t.id + " · " + t.title); if (t.id === def.id) o.selected = true; sel.appendChild(o); });
    const seed = el("input", { type: "text", name: "seed", inputmode: "numeric", autocomplete: "off", id: "insts" });
    const demo = el("form", { class: "devform", novalidate: true }, el("fieldset", null, el("legend", null, "Open a ticket for a demonstration"),
      el("label", { class: "f", for: "instt" }, "Ticket", sel), el("label", { class: "f", for: "insts" }, "House number (leave empty for a new one)", seed),
      el("p", { class: "note" }, "Opens a fresh copy. Any work saved on that ticket in this browser is replaced."),
      el("div", { class: "acts" }, el("button", { class: "btn", type: "submit" }, "Open it"))));
    demo.addEventListener("submit", function (e) { e.preventDefault(); const n = parseInt(String(seed.value).trim(), 10); api.demo(sel.value, isNaN(n) ? null : n >>> 0); draw(); });
    body.appendChild(demo);
    body.appendChild(el("p", null, "Open now: " + def.id + " on house number " + T.seed + ". The same number always builds the same house."));
    /* the answer, and every rung of help, for the ticket that's open */
    const out = el("div", { class: "inst-out" });
    const show = function (what) {
      out.innerHTML = "";
      if (what === "answer") {
        const right = T.opts.find(function (o) { return o.right; }), s = def.summary(T.v, T.sim);
        out.appendChild(el("h3", null, "The fault and the fix"));
        out.appendChild(el("p", null, el("b", null, "Right answer: "), right.text));
        out.appendChild(el("p", null, el("b", null, "Cause: "), s.cause));
        out.appendChild(el("p", null, el("b", null, "Fix: "), s.fix));
        const ol = el("ol"); def.fixHints(T.v, T.sim).forEach(function (h) { ol.appendChild(el("li", null, h)); });
        out.appendChild(el("p", null, el("b", null, "Mason's fix hints, in order:"))); out.appendChild(ol);
        out.appendChild(el("p", null, el("b", null, "Proof that counts: "), def.proofText + "."));
      } else {
        const keep = E.live(Object.assign({}, T, { reds: [], struck: [] })).filter(function (o) { return !o.right; });
        out.appendChild(el("h3", null, "All of Mason's help for " + def.id));
        out.appendChild(el("p", null, el("b", null, "Rung 1 (after the third wrong pick), where to look: "), def.rung1(T.v, T.sim)));
        out.appendChild(el("p", null, el("b", null, "Rung 2 (after the fourth), the principle: "), def.rung2(T.v, T.sim)));
        out.appendChild(el("p", null, el("b", null, "Rung 3 (the fifth and every one after) strikes wrong options with their reasons, always leaving two:")));
        const ul = el("ul"); keep.forEach(function (o) { ul.appendChild(el("li", null, o.text + ": " + o.why)); }); out.appendChild(ul);
      }
    };
    body.appendChild(el("div", { class: "acts" }, el("button", { type: "button", class: "btn ghost small", onclick: function () { show("answer"); } }, "Show the fault and the fix"),
      el("button", { type: "button", class: "btn ghost small", onclick: function () { show("help"); } }, "Show all of Mason's help")));
    body.appendChild(out);
    /* this computer's progress */
    const sure = el("button", { type: "button", class: "btn small", hidden: true, onclick: function () { api.clear(); d.close(); } }, "Yes, clear it");
    body.appendChild(el("h3", null, "Progress on this computer"));
    body.appendChild(el("div", { class: "acts" }, el("button", { type: "button", class: "btn ghost small", onclick: function () { sure.hidden = false; sure.focus(); } }, "Clear all progress"), sure));
    lockButton();
  }
  function lockButton() { body.appendChild(el("div", { class: "acts", style: "margin-top:12px" }, el("button", { type: "button", class: "btn ghost small", onclick: function () { try { sessionStorage.removeItem(KEY); } catch (e) {} draw(); } }, "Lock the instructor tools"))); }
}
