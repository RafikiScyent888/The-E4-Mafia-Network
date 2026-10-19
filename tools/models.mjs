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

/* HOME-13: the PoE injector (matched to the owner's photo: POWER blue, STATUS green, the cord into the left side).
   Unplugged: its cord's plug out, POWER and STATUS dark. Passive: POWER lit, STATUS dark; the camera dark either way; the fix lights STATUS */
C.push(async () => {
  const { p, ctx } = await open(GL, "HOME-13", 1);
  await physical(p, "injector", "Power cord");
  const k = await plugAt(p, "DC IN"); check(k.plug && k.off > 25, "HOME-13 unplugged: the adapter's plug is out of DC IN " + JSON.stringify(k));
  await led(p, "HOME-13 unplugged: injector POWER", null, "POWER", "off");
  await physical(p, "camera", "Port close-up");
  await led(p, "HOME-13 unplugged: camera port link", "PoE", "link", "off");
  await physical(p, "injector", "Lights");
  const n = await fine(p);
  await p.click('.phys button:text-is("Plug its power adapter in")'); await settled(p, n);
  await led(p, "HOME-13 plugged back in: injector POWER", null, "POWER", "blue");
  await led(p, "HOME-13 plugged back in: injector PoE", null, "PoE", "green");
  await ctx.close();
});
C.push(async () => {
  const { p, ctx } = await open(GL, "HOME-13", 2);
  await physical(p, "injector", "Lights");
  await led(p, "HOME-13 passive: injector POWER", null, "POWER", "blue");
  await led(p, "HOME-13 passive: injector PoE", null, "PoE", "off");
  check(/PASSIVE PoE INJECTOR, OUTPUT 24V/.test(await p.$eval(".m3d-says", (x) => x.textContent)), "HOME-13 passive: the words give the passive label");
  const n = await fine(p);
  await p.click('.phys button:text-is("Swap in a new 802.3af injector")'); await settled(p, n);
  await led(p, "HOME-13 after the swap: injector PoE", null, "PoE", "green");
  await ctx.close();
});

/* build mode J3: the dual-port PoE+ injector, as photographed, cabled on its first pair to the camera. Output 1's corner
   lights green, output 2's dark, Active PoE+ green; all four jacks there by their printed names, the plugs where the cables are */
C.push(async () => {
  const ctx = await GL.newContext({ viewport: { width: 900, height: 1000 }, reducedMotion: "reduce" });
  await ctx.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; window.__gl = 0; HTMLCanvasElement.prototype.getContext = function (k) { const c = g.apply(this, arguments); if (/webgl/.test(k) && c && !this.__counted) { this.__counted = true; window.__gl++; } return c; }; });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push("build J3: " + e.message));
  await p.goto(base + "build.html"); await p.waitForFunction(() => window.__e4b);
  if (plant) await p.evaluate(plant);
  await p.evaluate(() => { const c = window.__e4b, E = (dev, port) => ({ dev, port }); c.openJob("J3", true, 3007);
    [{ t: "place", dev: "injector2", room: "office" }, { t: "place", dev: "camera", room: "porch" }, { t: "lay", a: E("switch", "4"), b: E("injector2", "DATA IN") }, { t: "lay", a: E("injector2", "PoE OUT"), b: E("camera", "LAN") }].forEach((a) => c.act(a)); });
  await physical(p, "injector2", "Lights");
  await led(p, "J3 PoE+ injector: Active PoE+", null, "POWER", "green");
  await led(p, "J3 PoE+ injector: output 1's lights", "DATA + POWER OUT 1", "link", "green");
  await led(p, "J3 PoE+ injector: output 2's lights", "DATA + POWER OUT 2", "link", "off");
  for (const [j, want] of [["DATA IN 1", true], ["DATA IN 2", false], ["DATA + POWER OUT 1", true], ["DATA + POWER OUT 2", false], ["DC IN", true]]) { const k = await plugAt(p, j); check(!k.missing && k.plug === want, "J3 PoE+ injector: " + j + (want ? " has its plug in" : " is empty") + " " + JSON.stringify(k)); if (want && !k.missing) check(k.off < 0.5, "J3 PoE+ injector: " + j + "'s plug seated " + JSON.stringify(k)); }
  check(/DUAL-PORT GIGABIT PoE\+ INJECTOR/.test(await p.$eval(".m3d-says", (x) => x.textContent)), "J3 PoE+ injector: the words give its label");
  await ctx.close();
});

/* Level 2, build mode: the managed switch and the old 8-port, drawn as the simulation says.
   SO-J1: racked, the console cable in CONSOLE, SYSTEM and POWER lit, no network cables yet.
   SO-J2 done: the router and both desks in ports 1 to 3, lit; port 4 empty and dark; the old
   switch emptied, its lights dark. ONLY=office runs just these. */
async function office(job, seed, steps) {
  const ctx = await GL.newContext({ viewport: { width: 900, height: 1000 }, reducedMotion: "reduce" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("e4-instructor", "1"); } catch (e) { } });   /* the level lock opened, as the instructor */
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push("build " + job + ": " + e.message));
  await p.goto(base + "build.html"); await p.waitForFunction(() => window.__e4b);
  if (plant) await p.evaluate(plant);
  await p.evaluate(([job, seed, steps]) => { const c = window.__e4b; c.openJob(job, true, seed); const J = c.T, all = J.def.solve(J.v, J.sim); (steps == null ? all : all.slice(0, steps)).forEach((a) => c.act(a)); }, [job, seed, steps]);
  return { p, ctx };
}
const CO = [];
CO.push(async () => {
  const { p, ctx } = await office("SO-J1", 5101, 2);
  await physical(p, "msw", "Console port");
  const k = await plugAt(p, "CONSOLE"); check(!k.missing && k.plug && k.off < 1, "SO-J1 managed switch: the console cable is in CONSOLE " + JSON.stringify(k));
  await led(p, "SO-J1 managed switch SYSTEM", null, "SYSTEM", "green");
  await led(p, "SO-J1 managed switch POWER", null, "POWER", "green");
  for (const port of ["1", "2", "3"]) { const q = await plugAt(p, port); check(!q.missing && q.plug === false, "SO-J1 managed switch: port " + port + " is empty before the move " + JSON.stringify(q)); }
  await ctx.close();
});
CO.push(async () => {
  const { p, ctx } = await office("SO-J2", 5102);
  await physical(p, "msw", "Front close-up");
  for (const port of ["1", "2", "3"]) {
    const q = await plugAt(p, port); check(!q.missing && q.plug && q.off < 1, "SO-J2 managed switch: a cable is in port " + port + " " + JSON.stringify(q));
    await led(p, "SO-J2 managed switch port " + port + " link", port, "link", "green");
  }
  const e = await plugAt(p, "4"); check(!e.missing && e.plug === false, "SO-J2 managed switch: port 4 is empty " + JSON.stringify(e));
  await led(p, "SO-J2 managed switch port 4 link", "4", "link", "off");
  const k = await plugAt(p, "CONSOLE"); check(!k.missing && k.plug, "SO-J2 managed switch: the console cable is still in CONSOLE");
  await physical(p, "switch", "Ports close-up");
  for (const port of ["1", "2", "3", "4", "5", "6", "7", "8"]) { const q = await plugAt(p, port); check(!q.missing && q.plug === false, "SO-J2 old switch: port " + port + " is empty " + JSON.stringify(q)); }
  for (const n of ["1", "2", "3"]) await led(p, "SO-J2 old switch LINK " + n, null, "LINK " + n, "off");
  await ctx.close();
});
/* SO-J2 part way: the printer's cable pulled from the old switch and not yet laid: its port empty and dark, the PC's still lit */
CO.push(async () => {
  const { p, ctx } = await office("SO-J2", 5103, 3);
  await physical(p, "switch", "Ports close-up");
  const st = await p.evaluate(() => { const s = window.__e4b.T.sim, out = {}; ["router", "pc", "printer"].forEach((d) => { const c = s.cablesOf(d).find((x) => x.a.dev === "switch" || x.b.dev === "switch"); out[d] = c ? (c.a.dev === "switch" ? c.a.port : c.b.port) : null; }); return out; });
  check(st.router === null && st.pc === null && st.printer === null, "SO-J2 step 3: all three cables are off the old switch in the sim " + JSON.stringify(st));
  const lit = await p.evaluate(() => window.__e4b.T.sim.cablesOf("switch").length);
  check(lit === 0, "SO-J2 step 3: the old switch has no cables left in the sim (" + lit + ")");
  for (const port of ["1", "2", "3"]) { const q = await plugAt(p, port); check(!q.missing && q.plug === false, "SO-J2 step 3 old switch: port " + port + " drawn empty " + JSON.stringify(q)); }
  await ctx.close();
});
/* SO-J5, your laptop: mid-job its own Ethernet cable in (its jack's link light lit) and the serial adapter's USB-C plug in;
   at the end the Ethernet cable out (the port empty, its light dark), the adapter still in; and with the console cable
   unplugged at the switch's end the adapter stays in the laptop, while unplugged at the laptop it hangs out of the port */
const lapSteps = (seed) => (async () => { const { p, ctx } = await office("SO-J5", seed, 0); const n = await p.evaluate(() => window.__e4b.T.def.solve(window.__e4b.T.v, window.__e4b.T.sim).findIndex((a) => a.t === "pull")); await ctx.close(); return n; })();
CO.push(async () => {
  const { p, ctx } = await office("SO-J5", 5105, await lapSteps(5105));
  await physical(p, "tech", "Ports close-up");
  const e = await plugAt(p, "ETHERNET"); check(!e.missing && e.plug && e.off < 1, "SO-J5 your laptop: its Ethernet cable is in " + JSON.stringify(e));
  await led(p, "SO-J5 your laptop ETHERNET link", "ETHERNET", "link", "green");
  const u = await plugAt(p, "USB-C"); check(!u.missing && u.plug && u.off < 1 && u.run, "SO-J5 your laptop: the serial adapter's USB-C plug is in, with its cord " + JSON.stringify(u));
  await ctx.close();
});
CO.push(async () => {
  const { p, ctx } = await office("SO-J5", 5106);
  await physical(p, "tech", "Ports close-up");
  const e = await plugAt(p, "ETHERNET"); check(!e.missing && e.plug === false, "SO-J5 done, your laptop: the Ethernet port is empty " + JSON.stringify(e));
  await led(p, "SO-J5 done, your laptop ETHERNET link", "ETHERNET", "link", "off");
  const u = await plugAt(p, "USB-C"); check(!u.missing && u.plug && u.off < 1, "SO-J5 done, your laptop: the serial adapter is still in " + JSON.stringify(u));
  await ctx.close();
});
CO.push(async () => {
  const { p, ctx } = await office("SO-J5", 5107, 0);
  const end = await p.evaluate(() => { const c = window.__e4b.T.sim.cablesOf("tech").find((x) => x.kind === "console"); return c.a.dev === "tech" ? "a" : "b"; });
  await p.evaluate((end) => window.__e4b.act({ t: "unplug", cable: "c-console-1", end: end }), end);
  await physical(p, "tech", "Ports close-up");
  const u = await plugAt(p, "USB-C"); check(!u.missing && u.plug && u.off > 10, "SO-J5 your laptop: the adapter unplugged from the laptop hangs out of its port " + JSON.stringify(u));
  await ctx.close();
});
/* SO-04 on the desk: the back office's old 10/100 switch, its uplink in port 1 dark (TX facing TX), its PC on port 2 amber;
   a crossover cable swapped in and port 1 lights amber too */
CO.push(async () => {
  const ctx = await GL.newContext({ viewport: { width: 900, height: 1000 }, reducedMotion: "reduce" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("e4-instructor", "1"); } catch (e) { } });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push("desk SO-04: " + e.message));
  await p.goto(base + "index.html"); await p.waitForFunction(() => window.__e4);
  if (plant) await p.evaluate(plant);
  await p.evaluate(() => window.__e4.go("SO-04"));
  await physical(p, "meet", "Ports close-up");
  for (const port of ["1", "2"]) { const q = await plugAt(p, port); check(!q.missing && q.plug && q.off < 1, "SO-04 back office switch: a cable is in port " + port + " " + JSON.stringify(q)); }
  const e = await plugAt(p, "3"); check(!e.missing && e.plug === false, "SO-04 back office switch: port 3 is empty " + JSON.stringify(e));
  await led(p, "SO-04 back office switch port 1 (TX facing TX) link", "1", "link", "off");
  await led(p, "SO-04 back office switch port 2 (its PC, 10/100) link", "2", "link", "amber");
  await led(p, "SO-04 back office switch power", null, "POWER", "green");
  /* the student swaps in a crossover cable from the closet switch's Physical tab, then looks at the back office switch again */
  await physical(p, "msw", "Front close-up");
  await p.click('.cabs li:has-text("back office") button:text-is("Swap in a crossover cable")'); await p.waitForTimeout(100);
  await physical(p, "meet", "Ports close-up");
  await led(p, "SO-04 back office switch port 1 after a crossover cable", "1", "link", "amber");
  await ctx.close();
});
/* SO-08 on the desk: the closet rack, its patch panel's cords in exactly the ports the sim has them in (the front desk's,
   the printer's, and port 7, patched from the wrong map), the switch's light for the manager's port 4 dark; the cord moved
   to the port the tone found, through the page, and the model follows: port 7 empty, the manager's port patched, 4 lit */
CO.push(async () => {
  const ctx = await GL.newContext({ viewport: { width: 900, height: 1000 }, reducedMotion: "reduce" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("e4-instructor", "1"); if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-network-v1", JSON.stringify({ current: "SO-08", t: { "SO-08": { seed: 11 } }, solved: {} })); sessionStorage.setItem("seeded", "1"); } } catch (e) { } });   /* one office every run, so the cords hang the same way */
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push("desk SO-08: " + e.message));
  await p.goto(base + "index.html"); await p.waitForFunction(() => window.__e4);
  if (plant) await p.evaluate(plant);
  check(await p.evaluate(() => window.__e4.T.def.id === "SO-08" && window.__e4.T.seed === 11), "SO-08 models: the desk opened SO-08 on office 11");
  const P = await p.evaluate(() => window.__e4.T.v.ports), patched = [P.front, P.open, "7"];
  await physical(p, "pp", "Ports 1 to 12");
  for (let n = 1; n <= 12; n++) { const q = await plugAt(p, "P" + n), want = patched.indexOf(String(n)) >= 0; check(!q.missing && q.plug === want && (!want || q.off < 1), "SO-08 patch panel: port " + n + (want ? " has its cord" : " is empty") + " " + JSON.stringify(q)); }
  const k = await fine(p); await p.click('.m3d-bar button:text-is("Switch ports close-up")'); await settled(p, k);
  await led(p, "SO-08 rack: the switch's port 4 (patched to the meeting room's empty jack)", "4", "link", "off");
  await led(p, "SO-08 rack: the switch's port 2 (the front desk)", "2", "link", "green");
  const kp = await fine(p); await p.click('.m3d-bar button:text-is("Panel and switch")'); await settled(p, kp);   /* a top-row port's lights are on top of its jack: seen from above */
  await led(p, "SO-08 rack: the switch's port 3 (the printer)", "3", "link", "green");
  /* the fix's first half, through the page: the cord moved to the manager's real port */
  await p.selectOption("#rp-c-cord-mgr", P.manager); const n = await fine(p); await p.click('.cabs li:has-text("port 7") button:text-is("Move the cord")'); await settled(p, n);
  const k7 = await fine(p); await p.click('.m3d-bar button:text-is("Ports 1 to 12")'); await settled(p, k7);
  const e7 = await plugAt(p, "P7"), em = await plugAt(p, "P" + P.manager);
  check(!e7.missing && e7.plug === false && !em.missing && em.plug && em.off < 1, "SO-08 patch panel after the move: port 7 empty, port " + P.manager + " patched " + JSON.stringify([e7, em]));
  const k2 = await fine(p); await p.click('.m3d-bar button:text-is("Switch ports close-up")'); await settled(p, k2);
  await led(p, "SO-08 rack after the move: the switch's port 4 (the manager's PC now)", "4", "link", "green");
  await ctx.close();
});
/* SO-10 on the desk, office 2025 (the back office's end holds the LX): a module in each switch's SFP1 with its orange cord,
   the back office's bail latch blue (LX), the closet's black (SX), both slots' lights dark; the LX swapped for an SX through
   the page, and the back office's latch drawn black and its slot lit */
const bail = (p) => p.evaluate(async () => { const m = await import("./js/desk/model3d.js"), d = m.debug(), j = d.model.getObjectByName("port:SFP1"); if (!j) return "missing"; const plug = j.children.find((c) => /^plug:/.test(c.name)); if (!plug) return "no module"; let col = null; plug.traverse((o) => { if (!col && o.geometry && o.geometry.type === "TorusGeometry") col = "#" + o.material.color.getHexString(); }); return col; });
CO.push(async () => {
  const ctx = await GL.newContext({ viewport: { width: 900, height: 1000 }, reducedMotion: "reduce" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("e4-instructor", "1"); if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-network-v1", JSON.stringify({ current: "SO-10", t: { "SO-10": { seed: 2025 } }, solved: {} })); sessionStorage.setItem("seeded", "1"); } } catch (e) { } });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push("desk SO-10: " + e.message));
  await p.goto(base + "index.html"); await p.waitForFunction(() => window.__e4);
  if (plant) await p.evaluate(plant);
  check(await p.evaluate(() => window.__e4.T.def.id === "SO-10" && window.__e4.T.v.kind === "lx-back"), "SO-10 models: the desk opened SO-10 on office 2025 (the back office's end holds the LX)");
  await physical(p, "bsw", "Fibre slots");
  const q = await plugAt(p, "SFP1"); check(!q.missing && q.plug && q.off < 1 && q.run, "SO-10 back office switch: a module and its cord in SFP1 " + JSON.stringify(q));
  check(await bail(p) === "#2f6fd0", "SO-10 back office switch: the module's bail latch is blue (LX): " + await bail(p));
  await led(p, "SO-10 back office switch SFP1 (850 nm facing 1310 nm)", "SFP1", "link", "off");
  await physical(p, "msw", "Fibre slots");
  check(await bail(p) === "#1d1e21", "SO-10 closet switch: the module's bail latch is black (SX): " + await bail(p));
  await led(p, "SO-10 closet switch SFP1", "SFP1", "link", "off");
  /* the fix, through the page: the back office's LX out, an SX from the van in */
  await physical(p, "bsw", "Fibre slots");
  const n = await fine(p); await p.click('.phys button:text-is("Swap in a 1000BASE-SX module")'); await settled(p, n);
  const k = await fine(p); await p.click('.m3d-bar button:text-is("Fibre slots")'); await settled(p, k);
  check(await bail(p) === "#1d1e21", "SO-10 back office switch after the swap: the bail latch is black (SX): " + await bail(p));
  await led(p, "SO-10 back office switch SFP1 after the swap", "SFP1", "link", "green");
  await ctx.close();
});
/* SO-J10 in build mode, office 2025: the back office switch out of its box with its SFP slots empty; an SX put in through the
   page, drawn with its black bail and no cord, its light dark; the closet's module, the run and the closet's port opened, and
   the slot drawn with its cord and lit */
CO.push(async () => {
  const ctx = await GL.newContext({ viewport: { width: 900, height: 1000 }, reducedMotion: "reduce" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("e4-instructor", "1"); } catch (e) { } });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push("build SO-J10: " + e.message));
  await p.goto(base + "build.html"); await p.waitForFunction(() => window.__e4b);
  if (plant) await p.evaluate(plant);
  await p.evaluate(() => { const c = window.__e4b; c.openJob("SO-J10", true, 2025); c.act({ t: "place", dev: "bsw", room: "meeting" }); });
  check(await p.evaluate(() => window.__e4b.T.def.id === "SO-J10" && window.__e4b.T.seed === 2025), "SO-J10 models: build mode opened SO-J10 on office 2025");
  await physical(p, "bsw", "Fibre slots");
  const e = await plugAt(p, "SFP1"); check(!e.missing && e.plug === false, "SO-J10 back office switch: SFP1 empty from the box " + JSON.stringify(e));
  const n = await fine(p); await p.click('.acts:has-text("SFP1: empty") button:text-is("Put in a 1000BASE-SX module")'); await settled(p, n);
  const k = await fine(p); await p.click('.m3d-bar button:text-is("Fibre slots")'); await settled(p, k);
  check(await bail(p) === "#1d1e21", "SO-J10 back office switch: the SX put in is drawn with its black bail: " + await bail(p));
  const m = await plugAt(p, "SFP1"); check(!m.missing && m.plug && !m.run, "SO-J10 back office switch: a module in SFP1, no cord yet " + JSON.stringify(m));
  await led(p, "SO-J10 back office switch SFP1 (a module, no fibre)", "SFP1", "link", "off");
  await p.evaluate(() => { const c = window.__e4b, p = c.T.v.plan, cl = (line) => c.act({ t: "cmd", dev: "tech", line, cli: true });
    c.act({ t: "sfp", dev: "msw", slot: "SFP1", type: "1000BASE-SX" }); c.act({ t: "lay", a: { dev: "msw", port: "SFP1" }, b: { dev: "bsw", port: "SFP1" } });
    ["", p.console, "enable", p.secret, "configure terminal", "interface gi0/25", "no shutdown", "end"].forEach(cl); });
  await physical(p, "bsw", "Fibre slots");
  const r = await plugAt(p, "SFP1"); check(!r.missing && r.plug && r.off < 1 && r.run, "SO-J10 back office switch: the fibre's cord in its module " + JSON.stringify(r));
  await led(p, "SO-J10 back office switch SFP1 (the link up)", "SFP1", "link", "green");
  await ctx.close();
});
/* Level 3, build mode: the business router drawn as the simulation says. SB-J1 racked with the console cable in CON: PWR and SYS
   lit, ALM dark, its copper ports empty and dark. SB-J1 done: GE 0/0 (the modem) and GE 0/1 (the closet switch) with their plugs
   in and their lights lit, GE 0/2 empty and dark, ACT lit, the SFP slots' LNK lights dark. ONLY=business runs just these. */
const CB = [];
CB.push(async () => {
  const { p, ctx } = await office("SB-J1", 5201, 2);
  await physical(p, "rtr", "Front close-up");
  await led(p, "SB-J1 business router PWR", null, "PWR", "green");
  await led(p, "SB-J1 business router SYS", null, "SYS", "green");
  await led(p, "SB-J1 business router ALM", null, "ALM", "off");
  await led(p, "SB-J1 business router ACT (no links yet)", null, "ACT", "off");
  await physical(p, "rtr", "Ports close-up");   /* a port's light is a few pixels across from the whole front: read them close up */
  for (const port of ["Gi0/0", "Gi0/1", "Gi0/2"]) { const q = await plugAt(p, port); check(!q.missing && q.plug === false, "SB-J1 business router: " + port + " is empty before the swap " + JSON.stringify(q)); await led(p, "SB-J1 business router " + port + " link", port, "link", "off"); }
  const k = await plugAt(p, "CONSOLE"); check(!k.missing && k.plug && k.off < 1, "SB-J1 business router: the console cable is in CON " + JSON.stringify(k));
  await ctx.close();
});
CB.push(async () => {
  const { p, ctx } = await office("SB-J1", 5202);
  await physical(p, "rtr", "Ports close-up");
  for (const port of ["Gi0/0", "Gi0/1"]) { const q = await plugAt(p, port); check(!q.missing && q.plug && q.off < 1, "SB-J1 business router: a cable is in " + port + " " + JSON.stringify(q)); await led(p, "SB-J1 business router " + port + " link", port, "link", "green"); }
  const e = await plugAt(p, "Gi0/2"); check(!e.missing && e.plug === false, "SB-J1 business router: Gi0/2 is empty " + JSON.stringify(e));
  await led(p, "SB-J1 business router Gi0/2 link", "Gi0/2", "link", "off");
  await physical(p, "rtr", "Front close-up");
  await led(p, "SB-J1 business router ACT", null, "ACT", "green");
  await led(p, "SB-J1 business router GE 0/8 LNK (no module)", null, "GE 0/8 LNK", "off");
  const f = await plugAt(p, "Gi0/8"); check(!f.missing && f.plug === false, "SB-J1 business router: the SFP slot GE 0/8 is empty " + JSON.stringify(f));
  check(/BUSINESS ROUTER, MODEL: BR-4200/.test(await p.$eval(".m3d-says", (x) => x.textContent)), "SB-J1 business router: the words give what's printed on its front");
  await ctx.close();
});
const RUN = process.env.ONLY === "office" ? CO : process.env.ONLY === "business" ? CB : C.concat(CO, CB);
for (const c of RUN) { try { await c(); } catch (e) { bad.push("crashed: " + e.message.split("\n")[0]); } }

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
