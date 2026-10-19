import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = new URL("../..", import.meta.url).pathname, OUT = "./wip-out/";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const base = "http://127.0.0.1:" + srv.address().port + "/";
const job = process.argv[2] || "SB-J1", seed = +(process.argv[3] || 11), stage = process.argv[4] || "done";
const ctx = await B.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(([j, s]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-levels-open", "1"); localStorage.setItem("e4-build-v1", JSON.stringify({ current: j, j: { [j]: { seed: s } }, done: {} })); sessionStorage.setItem("seeded", "1"); } }, [job, seed]);
const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
await p.goto(base + "build.html"); await p.waitForTimeout(600);
console.log("job", await p.evaluate(() => window.__e4b && window.__e4b.T.def.id), "title", await p.$eval("#labtitle", (n) => n.textContent).catch(() => "?"));
if (stage === "done") {
  await p.evaluate(async () => { const B = await import("./js/build/engine.js"); const T = window.__e4b.T; for (const a of T.def.solve(T.v, T.sim)) window.__e4b.act(a); });
  await p.waitForTimeout(300);
}
await p.click("#doCheck").catch((e) => console.log("no check", e.message)); await p.waitForTimeout(200);
console.log("check:", (await p.$eval("#check", (n) => n.textContent).catch(() => "")).slice(0, 600));
for (const id of ["plan", "net"]) { await p.click(id === "plan" ? "#vPhy" : "#vLog"); await p.waitForTimeout(150); const el = await p.$("#" + id); if (el) await el.screenshot({ path: OUT + job + "-" + seed + "-" + stage + "-" + id + ".png" }); }
await p.screenshot({ path: OUT + job + "-" + seed + "-" + stage + "-page.png", fullPage: true });
if (stage === "done") {
  await p.click('#devtabs [data-d="rtr"]'); await p.waitForTimeout(100);
  const tabs = await p.$$eval(".win-tabs button", (l) => l.map((b) => b.textContent)); console.log("rtr tabs", tabs);
  await p.click('.win-tabs button:text-is("Lights")'); await p.waitForTimeout(100);
  console.log("lights:", (await p.$eval(".win-body", (n) => n.innerText)).slice(0, 800));
  await p.click('.win-tabs button:text-is("Physical")'); await p.waitForTimeout(6000);
  await (await p.$("#win")).screenshot({ path: OUT + job + "-" + seed + "-rtr-phys.png" });
  console.log("phys words:", (await p.$eval(".win-body", (n) => n.innerText)).slice(0, 1500));
  for (const id of ["mgr", "bpc"]) { await p.click('#devtabs [data-d="' + id + '"]'); await p.waitForTimeout(80); console.log(id, "tabs", await p.$$eval(".win-tabs button", (l) => l.map((b) => b.textContent).join(","))); await p.click('.win-tabs button:text-is("Network settings")'); await p.waitForTimeout(80); console.log((await p.$eval(".win-body", (n) => n.innerText)).slice(0, 300).replace(/\n/g, " | ")); }
}
console.log("errors:", errs);
await B.close(); srv.close();
