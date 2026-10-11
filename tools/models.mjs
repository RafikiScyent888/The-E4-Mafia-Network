/* The live 3D models in the Physical tab, checked in a real browser with
   WebGL: for each fault, the light the student has to read is really drawn
   lit, dark, amber or blue (sampled from the rendered pixels at the light's
   place on screen), a pulled plug really is out of its port, a loose coax
   really is off its thread, empty ports are empty, the page only ever has
   one 3D canvas, Enlarge works and gives the canvas back, and with WebGL
   switched off the tab falls back to the still and the words.
   Run: node tools/models.mjs        (PROBE=1 prints every sampled colour)
   Optional plant: node tools/models.mjs "<js run in the page after load>" */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import url from "node:url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const pw = await import(process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright/index.mjs"); const { chromium } = pw.default || pw;
const CHROME = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const GL = await chromium.launch({ executablePath: CHROME, args: ["--headless=new", "--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const base = "http://127.0.0.1:" + srv.address().port + "/";
const plant = process.argv[2] || "", PROBE = !!process.env.PROBE;
const bad = [], errs = []; let steps = 0;
const check = (ok, what) => { steps++; if (!ok) bad.push(what); };

async function open(B, ticket, seed, motion) {
  const ctx = await B.newContext({ viewport: { width: 900, height: 1000 }, reducedMotion: motion ? "no-preference" : "reduce" });
  /* count every WebGL context the page makes: there must only ever be one */
  await ctx.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; window.__gl = 0; HTMLCanvasElement.prototype.getContext = function (k) { const c = g.apply(this, arguments); if (/webgl/.test(k) && c && !this.__counted) { this.__counted = true; window.__gl++; } return c; }; });
  await ctx.addInitScript(([t, s]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-network-v1", JSON.stringify({ current: t, t: { [t]: { seed: s } }, solved: {} })); sessionStorage.setItem("seeded", "1"); } }, [ticket, seed]);
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(ticket + ": " + e.message));
  await p.goto(base + "index.html"); await p.waitForTimeout(350);
  if (plant) await p.evaluate(plant);
  return { p, ctx };
}
const fine = (p) => p.evaluate(() => import("./js/desk/model3d.js").then((m) => m.debug() ? m.debug().fineFrames : 0));
async function settled(p, after) { await p.waitForFunction((n) => import("./js/desk/model3d.js").then((m) => m.debug() && m.debug().fineFrames > n), after, { timeout: 90000, polling: 250 }); }
async function physical(p, dev, view) {
  if (dev === "rogue") { await p.click("#vPhy"); await p.click('#plan .pdev[aria-label="Open Old router in the terminal"]'); }
  else await p.click('#devtabs [data-d="' + dev + '"]');
  const n = await fine(p);
  await p.click('.win-tabs button:text-is("Physical")');
  await settled(p, n);
  if (view) { const k = await fine(p); await p.click('.m3d-bar button:text-is("' + view + '")'); await settled(p, k); }
}
/* the colour drawn at a light: its centre and the pixels round it, read back from the canvas */
function sample(p, jack, role) {
  return p.evaluate(async ([jack, role]) => {
    const THREE = await import("three"), m = await import("./js/desk/model3d.js"), d = m.debug(); d.render();
    let led = null;
    d.model.traverse((o) => { if (led || o.userData.kind !== "led") return; if (jack ? o.parent && o.parent.name === "port:" + jack && o.userData.role === role : o.userData.role === role) led = o; });
    if (!led) return { missing: true };
    const v = new THREE.Vector3(); led.getWorldPosition(v); v.project(d.camera);
    const cv = document.querySelector("canvas.m3d-canvas"), x = Math.round((v.x + 1) / 2 * cv.width), y = Math.round((1 - v.y) / 2 * cv.height);
    const c2 = document.createElement("canvas"); c2.width = cv.width; c2.height = cv.height; const g = c2.getContext("2d"); g.drawImage(cv, 0, 0);
    const px = g.getImageData(x - 1, y - 1, 3, 3).data, out = [];
    for (let i = 0; i < px.length; i += 4) out.push([px[i], px[i + 1], px[i + 2]]);
    return { x, y, px: out, w: cv.width };
  }, [jack, role]);
}
/* what colour a light reads as. A lit LED is bright and washed toward white by its glow
   (a lit green reads about 200,242,182); an unlit one is dark, unsaturated smoked plastic */
const LIT = {
  amber: ([r, g, b]) => r >= 200 && r - b >= 100 && g - b >= 60 && r >= g,
  green: ([r, g, b]) => g >= 200 && g - r >= 25 && g - b >= 35,
  blue: ([r, g, b]) => b >= 200 && b - r >= 50 && b - g >= 20
};
function classify(s) {
  if (!s || s.missing) return "missing";
  for (const k of ["amber", "green", "blue"]) if (s.px.some(LIT[k])) return k;
  const sat = Math.max(...s.px.map((c) => Math.max(...c) - Math.min(...c)));
  return sat < 45 ? "off" : "other(" + JSON.stringify(s.px[4]) + ")";
}
async function led(p, label, jack, role, want) {
  const s = await sample(p, jack, role), got = classify(s);
  if (PROBE) console.log("  " + label + ": " + got + "  " + JSON.stringify(s.px));
  check(got === want, label + ": wanted " + want + ", drew " + got);
}
/* how far a plug sits from where it was moulded into its port, and whether a port has a plug at all */
function plugAt(p, jack) {
  return p.evaluate(async (jack) => {
    const m = await import("./js/desk/model3d.js"), d = m.debug(), j = d.model.getObjectByName("port:" + jack);
    if (!j) return { missing: true };
    const plug = j.children.find((c) => /^plug:/.test(c.name));
    if (!plug) return { plug: false };
    const run = plug.userData.runMesh;
    return { plug: true, off: plug.position.distanceTo(plug.userData.home), run: !!(run && run.parent), split: !!(run && run.userData.run.o.split), crush: !!(run && run.userData.run.o.crush), wires: run ? run.children.length : 0 };
  }, jack);
}

/* ------------------------------------------------------------ the cases */
const C = [];
/* HOME-08 seed 2: kinked at the switch end. Amber on its port, green on the others, the split laid on its run */
C.push(async () => {
  const { p, ctx } = await open(GL, "HOME-08", 2);
  const port = await p.evaluate(() => JSON.parse(localStorage.getItem("e4-network-v1")) && window.__e4.T.v.port);
  await physical(p, "switch", "Ports close-up");
  await led(p, "HOME-08 switch port " + port + " link", String(port), "link", "amber");
  await led(p, "HOME-08 switch port 1 link", "1", "link", "green");
  await led(p, "HOME-08 switch power", null, "POWER", "green");
  const k = await plugAt(p, String(port));
  check(k.plug && k.off < 1 && k.split && k.wires >= 4, "HOME-08: the switch-end plug is in and its run is split with the pairs showing " + JSON.stringify(k));
  /* the fix: swap the cable, and the model follows */
  await p.click('.win-tabs button:text-is("Physical")');
  const n = await fine(p);
  await p.click('.cabs li:has-text("office PC") button:text-is("Swap in a new cable")'); await settled(p, n);
  await led(p, "HOME-08 after the swap, port " + port, String(port), "link", "green");
  const k2 = await plugAt(p, String(port)); check(k2.plug && !k2.split, "HOME-08: after the swap the run is whole");
  await ctx.close();
});
/* HOME-01: the unplugged end hangs out of its port with its lights dark; the crushed run is flattened */
C.push(async () => {
  const { p, ctx } = await open(GL, "HOME-01", 3);
  const port = String(await p.evaluate(() => window.__e4.T.v.port));
  await physical(p, "switch", "Ports close-up");
  const k = await plugAt(p, port); check(k.plug && k.off > 25 && k.run, "HOME-01 switch end: the plug is out of port " + port + " " + JSON.stringify(k));
  await led(p, "HOME-01 switch port " + port + " (unplugged) link", port, "link", "off");
  await led(p, "HOME-01 switch port 1 link", "1", "link", "green");
  /* the student plugs it back in, and the model follows, keeping their view */
  const n = await fine(p);
  await p.click('.cabs li:has-text("office PC") button:text-is("Reseat the plug")'); await settled(p, n);
  const k2 = await plugAt(p, port); check(k2.plug && k2.off < 1, "HOME-01: after reseating, the plug is back in");
  await led(p, "HOME-01 after reseating, port " + port, port, "link", "green");
  await ctx.close();
});
C.push(async () => {
  const { p, ctx } = await open(GL, "HOME-01", 1);
  await physical(p, "pc", "Ports close-up");
  const k = await plugAt(p, "LAN"); check(k.plug && k.off > 25, "HOME-01 PC end: the plug is out of the PC's LAN port " + JSON.stringify(k));
  await ctx.close();
});
C.push(async () => {
  const { p, ctx } = await open(GL, "HOME-01", 2);
  await physical(p, "pc", "Ports close-up");
  const k = await plugAt(p, "LAN"); check(k.plug && k.off < 1 && k.crush, "HOME-01 crushed: plugged in, the run flattened " + JSON.stringify(k));
  await led(p, "HOME-01 crushed: PC LAN link", "LAN", "link", "off");
  await ctx.close();
});
/* HOME-05: DS lit (steady, for less motion), US and ONLINE dark, the coax off its thread */
C.push(async () => {
  const { p, ctx } = await open(GL, "HOME-05", 1);
  await physical(p, "modem", "Front lights");
  await led(p, "HOME-05 modem POWER", null, "POWER", "green");
  await led(p, "HOME-05 modem DS (blinking, steady for reduced motion)", null, "DS", "green");
  await led(p, "HOME-05 modem US", null, "US", "off");
  await led(p, "HOME-05 modem ONLINE", null, "ONLINE", "off");
  const blink = await p.evaluate(() => import("./js/desk/model3d.js").then((m) => m.debug().blink));
  check(blink === 1, "HOME-05: one light (DS) set to blink, got " + blink);
  const k = await plugAt(p, "CABLE IN"); check(k.plug && k.off > 7, "HOME-05: the coax is backed off its thread " + JSON.stringify(k));
  await ctx.close();
});
/* for anyone who hasn't asked for less motion, DS really blinks: on and off at different moments */
C.push(async () => {
  const { p, ctx } = await open(GL, "HOME-05", 1, true);
  await physical(p, "modem", "Front lights");
  const seen = new Set();
  for (let i = 0; i < 12 && seen.size < 2; i++) { seen.add(classify(await sample(p, null, "DS"))); await p.waitForTimeout(230); }
  check(seen.has("green") && seen.has("off"), "HOME-05 with motion: DS blinks (saw " + [...seen].join(", ") + ")");
  await ctx.close();
});
/* a healthy house: ONLINE blue, the router's internet light lit, the laptop's and mesh's ports empty */
C.push(async () => {
  const { p, ctx } = await open(GL, "HOME-03", 11);
  await physical(p, "modem", "Front lights");
  await led(p, "healthy modem ONLINE", null, "ONLINE", "blue");
  await led(p, "healthy modem US", null, "US", "green");
  const k = await plugAt(p, "CABLE IN"); check(k.plug && k.off < 1, "healthy: the coax is screwed on");
  await physical(p, "router", "Top lights");
  await led(p, "healthy router Internet", null, "◎", "green");
  await led(p, "healthy router WPS", null, "WPS", "off");
  check((await plugAt(p, "LAN 4")).plug === false, "healthy router: LAN 4 empty, as in the sim");
  await physical(p, "laptop");
  check((await plugAt(p, "ETHERNET")).plug === false, "laptop: the Ethernet port is empty (it's on Wi-Fi)");
  await physical(p, "mesh");
  check((await plugAt(p, "WAN")).plug === false && (await plugAt(p, "LAN")).plug === false, "mesh: no network cables");
  /* one canvas and one WebGL context only, however many Physical tabs were opened and redrawn */
  check(await p.$$eval("canvas", (c) => c.length) === 1, "only one canvas on the page");
  const gl = await p.evaluate(() => window.__gl);
  check(gl === 1, "only one WebGL context ever made (made " + gl + ")");
  /* Enlarge: the same canvas in the dialog, then back in the tab */
  await p.click('.m3d-bar button:text-is("Enlarge")'); await p.waitForTimeout(200);
  check(await p.$("dialog.m3d-dialog[open] canvas.m3d-canvas") !== null, "Enlarge: the model is in the dialog");
  const big = await p.$eval("dialog.m3d-dialog canvas", (c) => c.clientWidth);
  check(big > 700, "Enlarge: the model is big (" + big + "px wide)");
  await p.click("dialog.m3d-dialog .x"); await p.waitForTimeout(200);
  check(await p.$("dialog.m3d-dialog") === null && await p.$(".phys canvas.m3d-canvas") !== null, "Enlarge closed: the model is back in the tab");
  await ctx.close();
});
/* HOME-10: the old router, opened from the floor plan: LAN 1 only, no internet light */
C.push(async () => {
  const { p, ctx } = await open(GL, "HOME-10", 7);
  await physical(p, "rogue", "Top lights");
  check((await plugAt(p, "INTERNET")).plug === false, "old router: nothing in INTERNET");
  check((await plugAt(p, "LAN 1")).plug === true, "old router: a cable in LAN 1");
  await led(p, "old router Internet", null, "◎", "off");
  await led(p, "old router LAN", null, "LAN", "green");
  await ctx.close();
});

for (const c of C) { try { await c(); } catch (e) { bad.push("crashed: " + e.message.split("\n")[0]); } }

/* without WebGL: the still and the words, no errors */
const NOGL = await chromium.launch({ executablePath: CHROME, args: ["--headless=new", "--no-sandbox", "--disable-3d-apis"] });
{
  const { p, ctx } = await open(NOGL, "HOME-01", 1);
  await p.click('#devtabs [data-d="pc"]'); await p.click('.win-tabs button:text-is("Physical")'); await p.waitForTimeout(1500);
  check(await p.$(".m3d-still img") !== null, "no WebGL: the still is shown");
  check(/doesn't show today's lights/.test(await p.$eval(".m3d-note", (n) => n.textContent)), "no WebGL: the note says the still can't show today's state");
  check(/unplugged/.test(await p.$eval(".m3d-says", (n) => n.textContent)), "no WebGL: the words still say what the model shows");
  await ctx.close();
}
await NOGL.close(); await GL.close(); srv.close();
check(errs.length === 0, "page errors: " + errs.join(" | "));
console.log(steps + " checks, " + bad.length + " failed");
if (bad.length) { console.log(bad.join("\n")); process.exit(1); }
