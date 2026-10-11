/* Progress lives in this browser: the open ticket, each ticket's saved state
   (its seed and what the student changed), and how many times each has been
   solved. Easier reading is its own setting, shared with the program's
   other sites: on stays on, across pages and visits. */
const KEY = "e4-network-v1";

export function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; }
  if (!s || typeof s !== "object") s = {};
  s.t = s.t || {}; s.solved = s.solved || {};
  return s;
}
export function store(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private window: progress lasts for this visit */ } }

export function newSeed() {
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] >>> 0; } catch (e) { return (Date.now() * 2654435761) >>> 0; }
}

export function dyslexia(btn, onChange) {
  const set = function (on) {
    document.body.classList.toggle("dys", on);
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = "Easier reading: " + (on ? "on" : "off");
    try { localStorage.setItem("e4-dyslexia", on ? "1" : "0"); } catch (e) { }
    if (onChange) onChange(on);
  };
  let st = null; try { st = localStorage.getItem("e4-dyslexia"); } catch (e) { }
  set(st === "1");
  btn.addEventListener("click", function () { set(!document.body.classList.contains("dys")); });
}

/* tiny DOM helper: el("div", { class: "x", onclick: f }, child, "text") */
export function el(tag, attrs) {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.slice(0, 2) === "on" && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (k === "text") n.textContent = v;
    else if (k === "html") n.innerHTML = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (let i = 2; i < arguments.length; i++) { const c = arguments[i]; if (c == null || c === false) continue; n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); }
  return n;
}
