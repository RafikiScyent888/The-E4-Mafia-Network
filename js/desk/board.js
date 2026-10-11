/* The diagnosis box under the ticket: six options (red stays red), the
   ladder of help, then the fix and the proof, then what was solved. */
import { el } from "./store.js";
import * as E from "../tickets/engine.js";

export function renderBoard(host, ctx) {
  const T = ctx.T, def = T.def;
  host.innerHTML = "";
  host.appendChild(el("h2", { id: "dh" }, T.diagnosed ? "Your diagnosis · now fix it" : "Your diagnosis · what's really wrong?"));
  const body = el("div", { class: "body" });
  host.appendChild(body);
  if (!T.diagnosed) body.appendChild(el("p", null, "Gather the evidence, then pick one. A wrong pick stays marked until you solve it or reset the board."));
  const grid = el("div", { class: "opts" });
  T.opts.forEach(function (o) {
    const red = T.reds.indexOf(o.id) >= 0, st = T.struck.find(function (s) { return s.id === o.id; });
    const isRight = T.diagnosed && o.right;
    const b = el("button", { type: "button", class: "opt" + (red || st ? " out" : "") + (isRight ? " right" : ""), "data-opt": o.id });
    b.appendChild(el("span", { class: "otext" }, o.text));
    if (st) { b.appendChild(el("span", { class: "why" }, "Ruled out by Mason: " + st.why)); b.setAttribute("aria-label", "Ruled out by Mason. " + o.text + ". " + st.why); b.setAttribute("aria-disabled", "true"); }
    else if (red) { b.appendChild(el("span", { class: "why" }, "Ruled out: not this one. Look at the evidence again.")); b.setAttribute("aria-label", "Ruled out. " + o.text); b.setAttribute("aria-disabled", "true"); }
    else if (isRight) { b.appendChild(el("span", { class: "tag" }, "Your diagnosis: right")); b.setAttribute("aria-disabled", "true"); }
    else if (T.diagnosed) { b.setAttribute("aria-disabled", "true"); b.classList.add("done"); }
    b.addEventListener("click", function () { if (b.getAttribute("aria-disabled") === "true") return; ctx.guess(o.id); });
    grid.appendChild(b);
  });
  body.appendChild(grid);
  const lad = E.ladderText(T);
  if (!T.diagnosed && lad) body.appendChild(el("p", { class: "mason-says", role: "status" }, el("b", null, ["", "Mason (where to look): ", "Mason (the principle): ", "Mason: "][lad.rung]), lad.text));
  if (!T.diagnosed) body.appendChild(el("div", { class: "boardbar" }, el("button", { type: "button", class: "btn ghost small", onclick: function () { ctx.resetBoard(); } }, "Reset the board")));
  if (T.diagnosed && !T.solved) {
    const st = el("div", { class: "stage" });
    st.appendChild(el("h3", null, "Fix it at the source, then prove it works"));
    st.appendChild(el("ul", { class: "checks" }, el("li", { class: "done" }, "Diagnosis: " + T.opts.find(function (o) { return o.right; }).text), el("li", { class: T.proven ? "done" : "" }, "Prove it: " + def.proofText)));
    if (T.partial) st.appendChild(el("p", { class: "mason-says", role: "status" }, el("b", null, "Mason: "), T.partial));
    if (ctx.fixHint) st.appendChild(el("p", { class: "mason-says", role: "status" }, el("b", null, "Mason: "), ctx.fixHint));
    st.appendChild(el("div", { class: "boardbar" },
      el("button", { type: "button", class: "btn ghost small", onclick: function () { ctx.askFix(); } }, "Ask Mason about the fix"),
      el("button", { type: "button", class: "btn ghost small", onclick: function () { ctx.resetNetwork(); } }, "Put the network back as you found it")));
    body.appendChild(st);
  }
  if (T.solved) {
    const s = def.summary(T.v, T.sim);
    const box = el("div", { class: "solved", role: "status" });
    box.appendChild(el("h3", null, "Ticket " + def.id + " solved"));
    box.appendChild(el("p", null, el("b", null, "What was wrong: "), s.cause));
    box.appendChild(el("p", null, el("b", null, "The fix: "), s.fix));
    box.appendChild(el("p", null, el("b", null, "The proof: "), def.proofText.replace(/^a /, "A ") + "."));
    box.appendChild(el("p", null, el("b", null, "How you worked it (the troubleshooting method):")));
    box.appendChild(el("ol", null, el("li", null, "Identified the problem from the ticket and the evidence (" + T.evidence.length + " findings in your notebook)."), el("li", null, "Established a theory: your diagnosis."), el("li", null, "Tested it against what the devices showed."), el("li", null, "Planned and made the fix, at the source."), el("li", null, "Verified it works: the proof."), el("li", null, "Documented it: your notebook.")));
    box.appendChild(el("div", { class: "boardbar" },
      el("button", { type: "button", class: "btn", onclick: function () { ctx.again(); } }, "Try another one like this"),
      ctx.nextId ? el("button", { type: "button", class: "btn ghost", onclick: function () { ctx.go(ctx.nextId); } }, "Next ticket: " + ctx.nextId) : null));
    body.appendChild(box);
  }
  body.appendChild(el("p", { class: "ladder" }, el("b", null, "How help works: "), "wrong picks 1 and 2, nothing (think it through); pick 3, Mason says where to look; pick 4, the principle that decides it; pick 5 and after, he narrows it to two, with a reason for each one he strikes. He never names the answer. You have unlimited tries."));
}
