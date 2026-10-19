/* every step of SB-J1 and SB-J2's solutions, on several businesses: both drawings measured as painted */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.env.ROOT || new URL("../..", import.meta.url).pathname;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox", "--disable-3d-apis"] });
const base = "http://127.0.0.1:" + srv.address().port + "/";
const measure = (p, which) => p.evaluate((which) => {
  const svg = document.getElementById(which), S = svg.getBoundingClientRect(), box = (el) => el.getBoundingClientRect();
  const ov = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
  const out = [];
  const off = (t) => { const b = box(t); if (b.left < S.left - 1 || b.right > S.right + 1 || b.top < S.top - 1 || b.bottom > S.bottom + 1) out.push('"' + t.textContent + '" off the diagram'); };
  if (which === "net") {
    const pl = [...svg.querySelectorAll("text.pl")], names = [...svg.querySelectorAll("text.nl, text.ns")], tiles = [...svg.querySelectorAll("rect.tile")];
    pl.forEach((t, i) => { off(t); names.concat(tiles).forEach((o) => { if (ov(box(t), box(o))) out.push('"' + t.textContent + '" on ' + (o.tagName === "rect" ? "a tile" : '"' + o.textContent + '"')); }); pl.slice(i + 1).forEach((o) => { if (ov(box(t), box(o))) out.push('"' + t.textContent + '" on "' + o.textContent + '"'); }); });
    names.forEach((t, i) => { off(t); tiles.forEach((o) => { if (o.parentNode !== t.parentNode && ov(box(t), box(o))) out.push('"' + t.textContent + '" on a tile'); }); names.slice(i + 1).forEach((o) => { if (o.parentNode !== t.parentNode && ov(box(t), box(o))) out.push('"' + t.textContent + '" on "' + o.textContent + '"'); }); });
  } else {
    const pl = [...svg.querySelectorAll("text.ns, text.rl")], tiles = [...svg.querySelectorAll("rect.tile")];
    pl.forEach((t, i) => { off(t); tiles.forEach((o) => { if (ov(box(t), box(o))) out.push('"' + t.textContent + '" on a tile'); }); pl.slice(i + 1).forEach((o) => { if (ov(box(t), box(o))) out.push('"' + t.textContent + '" on "' + o.textContent + '"'); }); });
  }
  return out;
}, which);
const plant = process.env.PLANT || "";
let n = 0; const bad = [];
for (const job of ["SB-J1", "SB-J2"]) for (const seed of (process.env.SEEDS || "11,2025,777777,5,6,7").split(",").map(Number)) {
  const ctx = await B.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem("e4-levels-open", "1"); });
  const p = await ctx.newPage(); p.on("pageerror", (e) => bad.push(job + " " + seed + " pageerror " + e.message));
  await p.goto(base + "build.html"); await p.waitForFunction(() => window.__e4b);
  if (plant) await p.evaluate(plant);
  await p.evaluate(([j, s]) => window.__e4b.openJob(j, true, s), [job, seed]);
  const steps = await p.evaluate(() => { const T = window.__e4b.T; return T.def.solve(T.v, T.sim); });
  for (let k = 0; k <= steps.length; k++) {
    if (k > 0) await p.evaluate((a) => window.__e4b.act(a), steps[k - 1]);
    if (k > 0 && k < steps.length && steps[k - 1].t === "cmd" && steps[k].t === "cmd") continue;   /* a run of commands: measure once, after it */
    for (const which of ["net", "plan"]) { await p.click(which === "net" ? "#vLog" : "#vPhy"); const o = await measure(p, which); n++; if (o.length) bad.push(job + " " + seed + " step " + k + " " + which + ": " + o.join("; ")); }
  }
  await ctx.close();
}
console.log("measured", n, "drawings;", bad.length, "with faults"); bad.slice(0, 40).forEach((b) => console.log(" ", b));
await B.close(); srv.close();
