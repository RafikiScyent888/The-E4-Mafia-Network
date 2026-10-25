/* what sits between the camera and a port's light on the back switch (SB-J4 done). node tools/wip/ray24.mjs [port] [dev] */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = new URL("../..", import.meta.url).pathname;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".json": "application/json" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await B.newContext({ viewport: { width: 900, height: 1000 }, reducedMotion: "reduce" });
await ctx.addInitScript(() => { try { sessionStorage.setItem("e4-instructor", "1"); } catch (e) { } });
const p = await ctx.newPage(); p.on("pageerror", (e) => console.log("ERR", e.message));
await p.goto("http://127.0.0.1:" + srv.address().port + "/build.html"); await p.waitForFunction(() => window.__e4b);
await p.evaluate(() => { const c = window.__e4b; c.openJob("SB-J4", true, 5401); const J = c.T; J.def.solve(J.v, J.sim).forEach((a) => c.act(a)); });
await p.click('#devtabs [data-d="bsw"]'); await p.click('.win-tabs button:text-is("Physical")'); await p.waitForTimeout(5000);
await p.click('.m3d-bar button:text-is("Front close-up")'); await p.waitForTimeout(4000);
const port = process.argv[2] || "24";
console.log(JSON.stringify(await p.evaluate(async (port) => {
  const THREE = await import("three"), m = await import("./js/desk/model3d.js"), d = m.debug(); d.render();
  const out = [];
  for (const role of ["link", "activity"]) {
    let led = null; d.model.traverse((o) => { if (!led && o.userData.kind === "led" && o.parent && o.parent.name === "port:" + port && o.userData.role === role) led = o; });
    if (!led) { out.push(role + " missing"); continue; }
    const w = new THREE.Vector3(); led.getWorldPosition(w);
    const cam = d.camera.position.clone(), dir = w.clone().sub(cam), dist = dir.length(); dir.normalize();
    const rc = new THREE.Raycaster(cam, dir, 0, dist - 0.05), hits = rc.intersectObject(d.model, true).filter((h) => h.object.visible);
    const chain = (o) => { const n = []; for (let q = o; q && n.length < 5; q = q.parent) n.push(q.name || q.type); return n.join("<"); };
    out.push(role + " at " + [w.x, w.y, w.z].map((v) => v.toFixed(1)).join(",") + " blocked by: " + (hits.slice(0, 3).map((h) => chain(h.object) + " @" + h.distance.toFixed(1)).join(" | ") || "nothing"));
  }
  return out;
}, port)));
await B.close(); srv.close();
