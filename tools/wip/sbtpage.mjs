/* A business ticket on the Ticket Desk, for a student who has finished the small office: screenshots and what the page says.
   node tools/wip/sbtpage.mjs [ticket] [seed] [outdir]   (run from the repo root) */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = process.cwd(), id = process.argv[2] || "SB-01", seed = +(process.argv[3] || 11), OUT = process.argv[4] || "/tmp";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream" }); r.end(b); }); }).listen(0);
const pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox"] });
const { LEVELS } = await import(path.join(ROOT, "js/desk/levels.js"));
const solved = Object.fromEntries(LEVELS.slice(0, 2).flatMap((L) => L.tickets).map((t) => [t, 1])), done = Object.fromEntries(LEVELS.slice(0, 2).flatMap((L) => L.jobs).map((t) => [t, 1]));
const ctx = await B.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(([t, s, so, dn]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-network-v1", JSON.stringify({ current: t, t: { [t]: { seed: s } }, solved: so })); localStorage.setItem("e4-build-v1", JSON.stringify({ j: {}, done: dn })); sessionStorage.setItem("seeded", "1"); } }, [id, seed, solved, done]);
const p = await ctx.newPage(), errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
const port = srv.address().port, t0 = Date.now();
await p.goto("http://127.0.0.1:" + port + "/index.html"); await p.waitForTimeout(800);
console.log("loaded in", Date.now() - t0, "ms; ticket", await p.evaluate(() => window.__e4.T.def.id + " seed " + window.__e4.T.seed + " " + window.__e4.T.v.kind));
console.log("title:", await p.$eval("#labtitle", (n) => n.textContent));
console.log("from:", await p.$eval("#tk .from", (n) => n.textContent));
console.log("records:", await p.$$eval("#officeRecs dt", (l) => l.map((x) => x.textContent + " = " + x.nextElementSibling.textContent).join("\n  ")));
console.log("devices:", await p.$$eval("#devtabs button", (l) => l.map((b) => b.dataset.d).join(" ")));
console.log("queue:", await p.$eval("#left", (n) => n.textContent.replace(/\s+/g, " ").slice(0, 600)));
await p.screenshot({ path: path.join(OUT, id + "-desk.png"), fullPage: true });
await p.click("#vPhy"); await p.waitForTimeout(300); await (await p.$("#plan")).screenshot({ path: path.join(OUT, id + "-plan.png") });
console.log("errors:", errs.length ? errs.join("\n") : "none");
await B.close(); srv.close();
