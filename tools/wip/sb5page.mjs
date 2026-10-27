/* SB-J5 on the page: the camera's page from the manager's PC, the manager's phone outside, each camera's 3D tab.
   node tools/wip/sb5page.mjs [seed] [dys] [3d] */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = new URL("../..", import.meta.url).pathname, OUT = "./wip-out/";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const base = "http://127.0.0.1:" + srv.address().port + "/", job = "SB-J5", seed = +(process.argv[2] || 11), dys = process.argv[3] === "dys", d3 = process.argv[4] === "3d";
const ctx = await B.newContext({ viewport: { width: 1400, height: 1000 } });
await ctx.addInitScript(([j, s, d]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-levels-open", "1"); localStorage.setItem("e4-build-v1", JSON.stringify({ current: j, j: { [j]: { seed: s } }, done: {} })); if (d) localStorage.setItem("e4-dyslexia", "1"); sessionStorage.setItem("seeded", "1"); } }, [job, seed, dys]);
const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
await p.goto(base + "build.html"); await p.waitForTimeout(600);
const facts = await p.evaluate(() => { const T = window.__e4b.T; for (const a of T.def.solve(T.v, T.sim)) window.__e4b.act(a); return { wan: T.sim.net.isp.wanIp, net: T.v.plan.vlans.cameras.net }; });
const tag = (n) => OUT + "SB5-" + seed + (dys ? "-dys" : "") + "-" + n + ".png";
const tab = async (name) => { await p.click('.win-tabs button:text-is("' + name + '")'); await p.waitForTimeout(80); };
const go = async (url) => { await p.fill('.browser input[name="url"]', url); await p.click('.browser button[type="submit"]'); await p.waitForTimeout(120); };
await p.click('#devtabs [data-d="mgr"]'); await p.waitForTimeout(80); await tab("Web browser");
await go("https://" + facts.net.replace(/\.0$/, ".11")); await (await p.$("#win")).screenshot({ path: tag("mgr-cam1") });
console.log("mgr cam1:", (await p.$eval("#win", (n) => n.textContent)).slice(0, 300));
await p.click('#devtabs [data-d="mphone"]'); await p.waitForTimeout(80);
console.log("phone tabs:", await p.$$eval(".win-tabs button", (l) => l.map((b) => b.textContent).join(" | ")));
await (await p.$("#win")).screenshot({ path: tag("phone-wifi") });
await tab("Web browser"); await go("https://" + facts.wan + ":8444"); await (await p.$("#win")).screenshot({ path: tag("phone-cam2") });
console.log("phone cam2:", (await p.$eval("#win", (n) => n.textContent)).slice(0, 200));
await go("https://" + facts.net.replace(/\.0$/, ".11")); console.log("phone private:", (await p.$eval(".browser", (n) => n.textContent)).slice(0, 160));
if (d3) for (const id of ["cam1", "cam2"]) { await p.click('#devtabs [data-d="' + id + '"]'); await p.waitForTimeout(100); await tab("Physical"); await p.waitForTimeout(7000); await (await p.$("#win")).screenshot({ path: tag(id + "-3d") }); console.log(id, "says:", (await p.$eval("#win", (n) => n.textContent)).slice(0, 500)); }
console.log("errors:", errs);
await B.close(); srv.close();
