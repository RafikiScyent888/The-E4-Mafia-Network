/* a finished business job's logical diagram: every port name and dot as placed, and a picture. node tools/wip/l3labels.mjs SB-J1 [seed] [dys] */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = new URL("../..", import.meta.url).pathname, OUT = process.env.OUT || "/tmp/e4-wip-out/"; fs.mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox"] });
const job = process.argv[2] || "SB-J1", seed = +(process.argv[3] || 11), dys = process.argv[4] === "dys";
const ctx = await B.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript((d) => { try { sessionStorage.setItem("e4-instructor", "1"); localStorage.setItem("e4-dyslexia", d ? "1" : "0"); } catch (e) { } }, dys);
const p = await ctx.newPage(); p.on("pageerror", (e) => console.log("ERR", e.message));
await p.goto("http://127.0.0.1:" + srv.address().port + "/build.html"); await p.waitForFunction(() => window.__e4b);
await p.evaluate(([j, s]) => { const c = window.__e4b; c.openJob(j, true, s); const J = c.T; J.def.solve(J.v, J.sim).forEach((a) => c.act(a)); }, [job, seed]);
await p.click("#vLog"); await p.waitForTimeout(200);
console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("#net text.pl")].map((t) => { const b = t.getBBox(); return t.textContent + "[" + t.dataset.cable + "]@" + Math.round(b.x) + "," + Math.round(b.y) + "+" + Math.round(b.width) + "x" + Math.round(b.height); }))));
await (await p.$("#net")).screenshot({ path: OUT + job + "-" + seed + (dys ? "-dys" : "") + "-net.png" });
await B.close(); srv.close();
