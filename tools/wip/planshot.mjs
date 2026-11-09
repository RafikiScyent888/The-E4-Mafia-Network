// The business floor plan, screenshotted at chosen points, for the before/after preview. Scratch, not part of the site.
// node planshot.mjs <site root> <out dir> <prefix>   SHOTS="SB-J10:1:done:0,SB-J5:2:done:1" (job:seed:start|done:easier)
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3]), PRE = process.argv[4] || "";
fs.mkdirSync(OUT, { recursive: true });
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": T[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const pw = await import("playwright").catch(() => import("/opt/node22/lib/node_modules/playwright/index.mjs")); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox"] });
const info = {};
for (const dys of [false, true]) {
  const ctx = await B.newContext({ viewport: { width: 1300, height: 1000 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((d) => { localStorage.setItem("e4-dyslexia", d ? "1" : "0"); localStorage.setItem("e4-levels-open", "1"); }, dys);
  const p = await ctx.newPage(); p.on("pageerror", (e) => console.log("page error " + e.message));
  await p.goto("http://127.0.0.1:" + srv.address().port + "/build.html"); await p.waitForTimeout(600);
  for (const s of (process.env.SHOTS || "SB-J10:1:done:0").split(",")) {
    const [job, seed, at, e] = s.split(":"); if (!!+e !== dys) continue;
    const name = await p.evaluate(([job, seed, at]) => { const c = window.__e4b; c.openJob(job, true, +seed); const J = c.T; if (at === "done") J.def.solve(J.v, J.sim).forEach((a) => c.act(a)); document.getElementById("vLog").click(); document.getElementById("vPhy").click(); return J.sim.net.name || J.sim.net.business || ""; }, [job, seed, at]);
    await p.waitForTimeout(250);
    const f = PRE + job + "-" + seed + "-" + at + (dys ? "-easier" : "") + ".png";
    await (await p.$("#plan")).screenshot({ path: path.join(OUT, f) }); info[f] = name; console.log("saved", f, name);
  }
  await ctx.close();
}
fs.writeFileSync(path.join(OUT, PRE + "info.json"), JSON.stringify(info, null, 1));
await B.close(); srv.close();
