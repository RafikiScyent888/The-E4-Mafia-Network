/* SB-J4 on the page: both drawings at the start, with the laptop at the back switch, and done. node tools/wip/sb4shot.mjs [seed] [dys] */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = new URL("../..", import.meta.url).pathname, OUT = "./wip-out/";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const base = "http://127.0.0.1:" + srv.address().port + "/", job = "SB-J4", seed = +(process.argv[2] || 11), dys = process.argv[3] === "dys";
const ctx = await B.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(([j, s, d]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-levels-open", "1"); localStorage.setItem("e4-build-v1", JSON.stringify({ current: j, j: { [j]: { seed: s } }, done: {} })); if (d) localStorage.setItem("e4-dyslexia", "1"); sessionStorage.setItem("seeded", "1"); } }, [job, seed, dys]);
const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
await p.goto(base + "build.html"); await p.waitForTimeout(600);
console.log("job", await p.evaluate(() => window.__e4b && window.__e4b.T.def.id), "title", await p.$eval("#labtitle", (n) => n.textContent).catch(() => "?"));
const shoot = async (stage) => { for (const id of ["plan", "net"]) { await p.click(id === "plan" ? "#vPhy" : "#vLog"); await p.waitForTimeout(150); const el = await p.$("#" + id); if (el) await el.screenshot({ path: OUT + job + "-" + seed + (dys ? "-dys" : "") + "-" + stage + "-" + id + ".png" }); } };
await shoot("start");
console.log("acted to", await p.evaluate(() => { const T = window.__e4b.T; window.__sol = T.def.solve(T.v, T.sim); const k = window.__sol.findIndex((a) => a.t === "lay" && a.b.dev === "bsw" && a.b.port === "CONSOLE"); for (const a of window.__sol.slice(0, k + 1)) window.__e4b.act(a); return k; }));
await p.waitForTimeout(200); await shoot("back");
await p.evaluate(() => { const sol = window.__sol, k = sol.findIndex((a) => a.t === "lay" && a.b.dev === "bsw" && a.b.port === "CONSOLE"); for (const a of sol.slice(k + 1)) window.__e4b.act(a); });
await p.waitForTimeout(300);
await p.click("#doCheck").catch((e) => console.log("no check", e.message)); await p.waitForTimeout(200);
console.log("check:", (await p.$eval("#check", (n) => n.textContent).catch(() => "")).slice(0, 900));
await shoot("done");
await p.click("#vLog"); await p.waitForTimeout(100);
console.log("dots:", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("#net .pd")].map((d) => d.hasAttribute("cx") ? [Math.round(+d.getAttribute("cx")), Math.round(+d.getAttribute("cy"))] : [Math.round(+d.getAttribute("x") + 6), Math.round(+d.getAttribute("y") + 6)]))));
console.log("names:", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("#net text.pl")].map((t) => { const b = t.getBBox(); return t.textContent + "@" + Math.round(b.x) + "," + Math.round(b.y); }))));
if (process.argv[4] === "3d") { await p.click('#devtabs [data-d="bsw"]'); await p.waitForTimeout(150); await p.click('.win-tabs button:text-is("Physical")'); await p.waitForTimeout(6000); await p.click('.m3d-bar button:text-is("Enlarge")'); await p.waitForTimeout(3000); const bar = p.locator('button:text-is("Front close-up")').last(); await bar.click(); await p.waitForTimeout(4000); await p.screenshot({ path: OUT + "SB-J4-" + seed + "-bsw-front.png" }); }
console.log("devtabs", await p.$$eval("#devtabs [data-d]", (l) => l.map((b) => b.dataset.d + ":" + b.textContent).join(" | ")));
console.log("errors:", errs);
await B.close(); srv.close();
