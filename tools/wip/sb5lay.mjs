/* SB-J5's diagram: try layouts for the cameras and score them, in both fonts. node tools/wip/sb5lay.mjs <cands.json> [seed] [shot]
   cands.json: [{ name, lay: { id: { x, y, lab } } }]. Reports, for each: names or tiles on other names/tiles, port names and dots
   on other lines, device names and tiles under another device's line, anything off the diagram. With no candidates
   ([{"name":"set","lay":{}}]) it scores the layout as it is. Trying other positions needs this line back in pos() in
   js/desk/draw.js, taken out before going live:
     if (typeof globalThis !== "undefined" && globalThis.__layTry && globalThis.__layTry[id]) Object.assign(L, globalThis.__layTry[id]); */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = new URL("../..", import.meta.url).pathname, OUT = "./wip-out/";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".otf": "font/otf", ".ttf": "font/ttf" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const base = "http://127.0.0.1:" + srv.address().port + "/", job = "SB-J5", seed = +(process.argv[3] || 11), cands = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), shot = process.argv[4];
const ctx = await B.newContext({ viewport: { width: 1400, height: 1000 } });
await ctx.addInitScript(([j, s]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-levels-open", "1"); localStorage.setItem("e4-build-v1", JSON.stringify({ current: j, j: { [j]: { seed: s } }, done: {} })); sessionStorage.setItem("seeded", "1"); } }, [job, seed]);
const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto(base + "build.html"); await p.waitForTimeout(600);
const upto = process.argv[5] || "all";   /* "back": stop with your laptop on the back switch's console; "start": nothing done; "cams": only the cameras placed and cabled */
await p.evaluate((upto) => { const T = window.__e4b.T, sol = T.def.solve(T.v, T.sim); const k = upto === "back" ? sol.findIndex((a) => a.t === "lay" && a.b.dev === "bsw" && a.b.port === "CONSOLE") + 1 : upto === "start" ? 0 : upto === "cams" ? 8 : sol.length; for (const a of sol.slice(0, k)) window.__e4b.act(a); }, upto);
await p.click("#vLog"); await p.waitForTimeout(100);
const score = () => p.evaluate(() => {
  const svg = document.getElementById("net"), S = svg.getBoundingClientRect(), box = (el) => el.getBoundingClientRect(), out = [];
  const ov = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
  const dev = (n) => n.closest(".nd") && n.closest(".nd").dataset.d;
  const names = [...svg.querySelectorAll("text.nl, text.ns")], tiles = [...svg.querySelectorAll("rect.tile")], pl = [...svg.querySelectorAll("text.pl")], pds = [...svg.querySelectorAll(".pd")];
  const off = (t) => { const b = box(t); if (b.left < S.left - 1 || b.right > S.right + 1 || b.top < S.top - 1 || b.bottom > S.bottom + 1) out.push('"' + t.textContent + '" off'); };
  names.forEach((t, i) => { off(t); tiles.forEach((o) => { if (dev(o) !== dev(t) && ov(box(t), box(o))) out.push('"' + t.textContent + '" on ' + dev(o) + "'s tile"); }); names.slice(i + 1).forEach((o) => { if (dev(o) !== dev(t) && ov(box(t), box(o))) out.push('"' + t.textContent + '" on "' + o.textContent + '"'); }); });
  tiles.forEach((t, i) => tiles.slice(i + 1).forEach((o) => { if (ov(box(t), box(o))) out.push(dev(t) + " and " + dev(o) + " tiles overlap"); }));
  pl.forEach((t, i) => { off(t); [...names, ...tiles].forEach((o) => { if (ov(box(t), box(o))) out.push('port "' + t.textContent + '" on ' + (o.tagName === "rect" ? dev(o) + "'s tile" : '"' + o.textContent + '"')); }); pl.slice(i + 1).forEach((o) => { if (ov(box(t), box(o))) out.push('port "' + t.textContent + '" on port "' + o.textContent + '"'); }); });
  pds.forEach((d, i) => { [...pl, ...names].forEach((t) => { if (ov(box(d), box(t))) out.push('a dot on "' + t.textContent + '"'); }); pds.slice(i + 1).forEach((e) => { if (ov(box(d), box(e))) out.push("two dots"); }); });
  const lines = [...svg.querySelectorAll("line.lk, line.wf, line")].filter((n) => n.closest(".nd") === null).map((n) => ({ c: n.dataset.cable, a: n.dataset.a, b: n.dataset.b, x1: +n.getAttribute("x1"), y1: +n.getAttribute("y1"), x2: +n.getAttribute("x2"), y2: +n.getAttribute("y2"), cls: n.getAttribute("class") }));
  const crosses = (b, s) => { const dx = s.x2 - s.x1, dy = s.y2 - s.y1, P4 = [-dx, dx, -dy, dy], Q4 = [s.x1 - b.x, b.x + b.width - s.x1, s.y1 - b.y, b.y + b.height - s.y1]; let t0 = 0, t1 = 1; for (let k = 0; k < 4; k++) { if (P4[k] === 0) { if (Q4[k] < 0) return false; continue; } const r = Q4[k] / P4[k]; if (P4[k] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } } return t0 < t1; };
  const shrink = (b, k) => ({ x: b.x + k, y: b.y + k, width: b.width - 2 * k, height: b.height - 2 * k });
  const M = svg.getScreenCTM().inverse(), pt = svg.createSVGPoint();
  const gb = (el) => { const r = el.getBoundingClientRect(); pt.x = r.left; pt.y = r.top; const a = pt.matrixTransform(M); pt.x = r.right; pt.y = r.bottom; const c = pt.matrixTransform(M); return { x: a.x, y: a.y, width: c.x - a.x, height: c.y - a.y }; };
  pl.forEach((t) => lines.forEach((s) => { if (s.c && s.c !== t.dataset.cable && crosses(shrink(gb(t), 1), s)) out.push('port "' + t.textContent + '" on another line'); }));
  pds.forEach((d) => lines.forEach((s) => { if (s.c && s.c !== d.dataset.cable && crosses(shrink(gb(d), 1), s)) out.push("a dot on another line"); }));
  /* a line under another device's name or tile: it reads as that device's */
  const ends = (s) => { const near = (x, y) => tiles.map((t) => ({ d: dev(t), b: gb(t) })).find((o) => x >= o.b.x - 2 && x <= o.b.x + o.b.width + 2 && y >= o.b.y - 2 && y <= o.b.y + o.b.height + 2); const A = near(s.x1, s.y1), Bn = near(s.x2, s.y2); return [A && A.d, Bn && Bn.d]; };
  lines.forEach((s) => { const e = ends(s); [...names, ...tiles].forEach((o) => { const d = dev(o); if (e.indexOf(d) >= 0) return; if (crosses(shrink(gb(o), 2), s)) out.push((s.cls || "line") + " " + (e[0] || "?") + "-" + (e[1] || "?") + " under " + (o.tagName === "rect" ? d + "'s tile" : '"' + o.textContent + '"')); }); });
  /* the floor plan: every device's name and room name clear of each other and of every tile, and on the plan */
  const plan = document.getElementById("plan"), wasHidden = plan.hasAttribute("hidden"); plan.removeAttribute("hidden");
  const PS = plan.getBoundingClientRect(), pt2 = [...plan.querySelectorAll("text.ns, text.rl")], ptl = [...plan.querySelectorAll("rect.tile")];
  pt2.forEach((t, i) => { const b = box(t); if (b.left < PS.left - 1 || b.right > PS.right + 1 || b.top < PS.top - 1 || b.bottom > PS.bottom + 1) out.push('plan: "' + t.textContent + '" off'); ptl.forEach((o) => { if (o.parentNode !== t.parentNode && ov(b, box(o))) out.push('plan: "' + t.textContent + '" on a tile'); }); pt2.slice(i + 1).forEach((o) => { if (ov(b, box(o))) out.push('plan: "' + t.textContent + '" on "' + o.textContent + '"'); }); });
  ptl.forEach((t, i) => ptl.slice(i + 1).forEach((o) => { if (ov(box(t), box(o))) out.push("plan: two tiles overlap"); }));
  if (wasHidden) plan.setAttribute("hidden", "");
  return out;
});
for (const c of cands) {
  const res = {};
  for (const dys of [false, true]) {
    await p.evaluate((lay) => { globalThis.__layTry = lay; window.__e4b.act({ t: "cmd", dev: "pc", line: "ipconfig" }); }, c.lay);
    if (dys !== (await p.evaluate(() => document.documentElement.classList.contains("dys") || document.body.classList.contains("dys")))) { await p.click("#dys"); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150); await p.click("#vLog"); await p.waitForTimeout(60); }
    await p.evaluate(() => window.__e4b.act({ t: "cmd", dev: "pc", line: "ipconfig" })); await p.waitForTimeout(80);
    res[dys ? "dys" : "std"] = await score();
    if (shot) { const el = await p.$("#net"); await el.screenshot({ path: OUT + "SB5-lay-" + c.name + "-" + upto + (dys ? "-dys" : "") + ".png" }); await p.click("#vPhy"); await p.waitForTimeout(80); await (await p.$("#plan")).screenshot({ path: OUT + "SB5-plan-" + upto + (dys ? "-dys" : "") + ".png" }); await p.click("#vLog"); await p.waitForTimeout(60); }
  }
  console.log(c.name, "std:", res.std.length, "dys:", res.dys.length); [...new Set([...res.std, ...res.dys.map((x) => "(dys) " + x)])].slice(0, 30).forEach((x) => console.log("   ", x));
  if (await p.evaluate(() => document.documentElement.classList.contains("dys") || document.body.classList.contains("dys"))) { await p.click("#dys"); await p.waitForTimeout(100); await p.click("#vLog"); }
}
console.log("errors:", errs);
await B.close(); srv.close();
