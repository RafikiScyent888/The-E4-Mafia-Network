// SB-J6's page, screenshotted: the work order, the closet cabinet's button and Physical tab (its model, door, lock, key), the floor
// plan's frame round the cabinet's gear, a cable refused with the door shut. Not part of the site.
// node tools/wip/sb6page.mjs <out dir> [seed]
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import url from "node:url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../.."), OUT = path.resolve(process.argv[2] || "."), seed = +(process.argv[3] || 11);
fs.mkdirSync(OUT, { recursive: true });
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": T[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const base = "http://127.0.0.1:" + srv.address().port + "/";
const pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const { LEVELS } = await import(path.join(ROOT, "js/desk/levels.js"));
const solved = Object.fromEntries(LEVELS.slice(0, 2).flatMap((L) => L.tickets).map((id) => [id, 1])), done = Object.fromEntries(LEVELS.slice(0, 2).flatMap((L) => L.jobs).concat(["SB-J1", "SB-J2", "SB-J3", "SB-J4", "SB-J5"]).map((id) => [id, 1]));
const ctx = await B.newContext({ viewport: { width: 1400, height: 1000 } });
await ctx.addInitScript((o) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-network-v1", JSON.stringify(o.net)); localStorage.setItem("e4-build-v1", JSON.stringify(o.build)); sessionStorage.setItem("seeded", "1"); } }, { net: { t: {}, solved }, build: { current: "SB-J6", j: { "SB-J6": { seed } }, done } });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto(base + "build.html"); await p.waitForTimeout(500);
const shot = async (name, sel) => { const el = sel ? await p.$(sel) : null; await (el || p).screenshot({ path: path.join(OUT, name + ".png") }); console.log("saved", name); };
const dev = async (id) => { await p.click('#devtabs [data-d="' + id + '"]'); await p.waitForTimeout(80); };
const tab = async (t) => { await p.click('.win-tabs button:text-is("' + t + '")'); await p.waitForTimeout(80); };
const settle = async () => { for (let k = 0; k < 40; k++) { const s = await p.evaluate(() => !!document.querySelector(".m3d-stage canvas") && !/Loading/.test((document.querySelector(".m3d-note") || {}).textContent || "")); if (s) break; await p.waitForTimeout(150); } await p.waitForTimeout(1200); };
console.log("job:", await p.evaluate(() => window.__e4b && window.__e4b.T.def.id));
await shot("1-order", "#tk");
await dev("cab"); await tab("Physical"); await settle();
await shot("2-cabinet-open", ".win-body"); await shot("2b-open-model", ".m3d-stage");
console.log(await p.$eval(".m3d-says", (n) => n.innerText));
await p.click("#vPhy").catch(() => {}); await p.waitForTimeout(100); await shot("3-plan-open", "#plan");
for (const b of ["Shut the door", "Lock it", "Take the key out"]) { await p.click('.win-body button:text-is("' + b + '")'); await p.waitForTimeout(120); console.log(b, "->", await p.$eval(".win-body .res", (n) => n.textContent)); }
await settle(); await shot("4-cabinet-locked", ".win-body"); await p.$eval(".win-body", (n) => n.scrollTop = 0); await shot("4b-cabinet-shut-model", ".m3d-stage");
await p.click('.m3d-bar button:text-is("The latch close up")'); await p.waitForTimeout(1500); await shot("4c-latch-locked", ".m3d-stage");
await p.click('.win-body button:text-is("Open the door")'); await p.waitForTimeout(100); console.log("Open the door ->", await p.$eval(".win-body .res", (n) => n.textContent));
await shot("5-plan-locked", "#plan");
await dev("rtr"); await tab("Physical"); await settle(); console.log((await p.$eval(".m3d-says", (n) => n.innerText)).split("\n").filter((l) => /cabinet/.test(l)).join("\n"));
console.log(errs.length ? "PAGE ERRORS: " + errs.join(" | ") : "no page errors");
await B.close(); srv.close();
