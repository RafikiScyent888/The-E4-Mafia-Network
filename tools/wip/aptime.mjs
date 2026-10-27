/* how long a click takes with the access point's 3D view open (SB-J4's start: the access point placed by SB-J3).
   Run from anywhere: node tools/wip/aptime.mjs [checkout]. Prints the click times and the main thread's long tasks. Not part of the site */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const { LEVELS } = await import(path.join(ROOT, "js/desk/levels.js"));
const pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox"] });
const base = "http://127.0.0.1:" + srv.address().port + "/";
const solved = Object.fromEntries(LEVELS.slice(0, 2).flatMap((L) => L.tickets).map((id) => [id, 1])), done = Object.fromEntries(LEVELS.slice(0, 2).flatMap((L) => L.jobs).map((id) => [id, 1]));
for (const run of [1, 2]) {
  const ctx = await B.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript((o) => { localStorage.setItem("e4-network-v1", JSON.stringify(o.net)); localStorage.setItem("e4-build-v1", JSON.stringify(o.build)); }, { net: { t: {}, solved }, build: { current: "SB-J4", j: { "SB-J4": { seed: 11 } }, done } });
  const p = await ctx.newPage(); await p.goto(base + "build.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { window.__long = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ entryTypes: ["longtask"] }); });
  let t = Date.now(); await p.click('#devtabs [data-d="ap"]', { timeout: 60000 }); const tOpen = Date.now() - t;
  await p.waitForTimeout(1500);
  t = Date.now(); await p.click("#vLog", { timeout: 60000 }); const tLog = Date.now() - t;
  t = Date.now(); await p.click("#vPhy", { timeout: 60000 }); const tPhy = Date.now() - t;
  await p.waitForTimeout(3000);
  const L = await p.evaluate(() => window.__long);
  console.log("run " + run + ": open ap " + tOpen + " ms, click Logical " + tLog + " ms, click Physical " + tPhy + " ms; long tasks " + L.length + " (max " + Math.max(0, ...L) + " ms, total " + L.reduce((a, b) => a + b, 0) + " ms)");
  await ctx.close();
}
await B.close(); srv.close();
