/* the dome cameras on preview/models.html: one picture of each entry. node tools/wip/camshot.mjs [ids] */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = new URL("../..", import.meta.url).pathname, OUT = process.env.OUT || "/tmp/e4-wip-out/"; fs.mkdirSync(OUT, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const ids = (process.argv[2] || "cam-ceil,cam-ceil-top,cam-wall").split(",");
for (const id of ids) {
  const ctx = await B.newContext({ viewport: { width: 1400, height: 1000 } }), p = await ctx.newPage(); p.on("pageerror", (e) => console.log("ERR", id, e.message)); p.on("console", (m) => { if (m.type() === "error") console.log("console", id, m.text()); });
  await p.goto("http://127.0.0.1:" + srv.address().port + "/preview/models.html#" + id); await p.waitForTimeout(6000);
  await (await p.$("#view")).screenshot({ path: OUT + id + ".png" }); console.log("shot", id, await p.$eval("#name", (n) => n.textContent));
  await ctx.close();
}
await B.close(); srv.close();
