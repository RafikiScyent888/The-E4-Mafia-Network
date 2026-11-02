// SB-J10 page shots (scratch)
// the trap, and the finished job. Not part of the site.
// node tools/wip/sb78page.mjs <out dir> [seed]
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import url from "node:url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../.."), OUT = path.resolve(process.argv[2] || "."), seed = +(process.argv[3] || 4242);
fs.mkdirSync(OUT, { recursive: true });
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": T[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const base = "http://127.0.0.1:" + srv.address().port + "/";
const pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const errs = [];
async function fresh() {
  const ctx = await B.newContext({ viewport: { width: 1400, height: 1000 } }), p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(base + "build.html"); await p.waitForTimeout(400); await p.evaluate(() => sessionStorage.setItem("e4-instructor", "1"));
  return { ctx, p };
}
/* a job opened on a chosen business (the instructor's way), then a page expression run against it */
async function at(name, job, body, sel) {
  const { ctx, p } = await fresh();
  await p.evaluate(([job, seed, body]) => {
    const c = window.__e4b; c.openJob(job, true, seed);
    const J = c.T, p = J.v.plan, sol = J.def.solve(J.v, J.sim), tab = (n) => [...document.querySelectorAll(".win-tabs button")].find((b) => b.textContent === n).click(), dev = (d) => document.querySelector("#devtabs [data-d=" + d + "]").click();
    const go = (u) => { const f = document.querySelector(".browser form"); f.querySelector("input[name=url]").value = u; f.requestSubmit(); };
    new Function("c", "J", "p", "sol", "tab", "dev", "go", body)(c, J, p, sol, tab, dev, go);
  }, [job, seed, body]);
  await p.waitForTimeout(300);
  const el = sel ? await p.$(sel) : null; await (el || p).screenshot({ path: path.join(OUT, name + ".png") }); console.log("saved", name);
  await ctx.close();
}
const tk = "c.check(); document.getElementById('tk').scrollIntoView();", chk = "document.getElementById('check').scrollIntoView();";
/* SB-J10 */
await at("10-1-order", "SB-J10", tk, "#tk");
await at("10-2-plan-start", "SB-J10", "document.getElementById('vPhy').click();", "#plan");
await at("10-3-diagram-done", "SB-J10", "sol.forEach((a)=>c.act(a)); c.check(); document.getElementById('vLog').click();", "#net");
await at("10-4-plan-done", "SB-J10", "sol.forEach((a)=>c.act(a)); c.check(); document.getElementById('vPhy').click();", "#plan");
await at("10-5-done", "SB-J10", "sol.forEach((a)=>c.act(a)); c.check(); " + chk, "#check");
console.log(errs.length ? "PAGE ERRORS: " + [...new Set(errs)].join(" | ") : "no page errors");
await B.close(); srv.close();
