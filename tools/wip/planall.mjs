// Level 3's floor plan across every business work order (tools/wip, not part of the site; the candidates need a __layTry hook in pos()): score layouts on all six businesses, both fonts, at the start and
// the end of each job (SB-J1 to SB-J10). Scratch. node planall.mjs <site root with the __layTry hook> [n] [seed]
// Candidates: LIST=<json> (each {name, lay}) or BASE=<json> (n nudges of it) or neither (the layout as built only).
// Scored: a run under a device it doesn't join (tile or name with its plate); names (with plates) on tiles, on other names, on
// walls, off the plan; tiles on tiles and on walls. Nothing is skipped. ALL=1 lists every distinct problem.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(process.argv[2]), N = +(process.argv[3] || 0); let rs = +(process.argv[4] || 7);
const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; }, pick = (a) => a[Math.floor(rnd() * a.length)];
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": T[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const base = "http://127.0.0.1:" + srv.address().port + "/";
const pw = await import("playwright").catch(() => import("/opt/node22/lib/node_modules/playwright/index.mjs")); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox"] });
const cands = [{ name: "built", lay: {} }];
if (process.env.LIST) JSON.parse(fs.readFileSync(process.env.LIST, "utf8")).forEach((c) => cands.push(c));
if (process.env.BASE) {
  const BASE = JSON.parse(fs.readFileSync(process.env.BASE, "utf8")); cands.push(Object.assign({}, BASE, { name: "base" }));
  const KEYS = JSON.parse(process.env.KEYS || "[]");   /* [[id, "px"|"py"], ...] the positions a nudge may move */
  for (let i = 0; i < N; i++) { const c = JSON.parse(JSON.stringify(BASE)); c.name = "n" + i; const k = 1 + Math.floor(rnd() * 3);
    for (let j = 0; j < k; j++) { const [id, ax] = pick(KEYS), d = pick([-30, -20, -15, -10, -5, 5, 10, 15, 20, 30]);
      if (id === "closetX") { c.closetX = Math.max(300, Math.min(380, (c.closetX || 300) + d)); continue; }
      if (id === "bow") { c.bow = Math.max(12, Math.min(60, (c.bow || 40) + d)); continue; }
      c.lay[id] = c.lay[id] || {}; c.lay[id][ax] += d; }
    cands.push(c); }
}
var BASE_POS = {};
if (process.env.STRUCT) {
  for (let i = 0; i < +process.env.STRUCT; i++) {
    const X = pick([300, 330, 360, 380]), cl = 100, cr = X - 70, cm = Math.round((cl + cr) / 2), rows = [105, 205, 305];
    const slots = [[cl, 205], [cl, 305], [cr, 305]].concat(X >= 360 ? [[cm, 305], [cm, 205]] : []);
    const sh = slots.slice().sort(() => rnd() - 0.5), [s1, s2, s3] = sh, rtrAt = sh.slice(3).concat([[cl, 205]])[0];
    const lay = { modem: { px: cl, py: 105 }, rtr: { px: cr, py: 105 }, msw: { px: cr, py: 205 }, cinj1: { px: s1[0], py: s1[1] }, injector: { px: s2[0], py: s2[1] }, tech: { px: s3[0], py: s3[1] },
      router: { px: (pick([s1, s2, rtrAt]))[0], py: (pick([s1, s2, rtrAt]))[1] },
      pc: { px: pick([420, 450, 480]) + (X - 300), py: pick([100, 110, 130]) }, printer: { px: pick([540, 560, 590]), py: pick([140, 190, 210]) },
      cam1: { px: pick([480, 520, 560, 600]), py: pick([330, 400, 450]) }, ap: { px: pick([420, 440]) + (X - 300) / 2, py: pick([352, 330]) }, cinj2: { px: pick([720, 735, 745]), py: 450 } };
    lay.router = { px: s1[0], py: s1[1] };   /* the provider's router (SB-J1 only) where the camera's injector goes later (SB-J5): never both */
    cands.push({ name: "s" + i, closetX: X, bow: pick([null, 24, 32, 40]), lay: lay });
  }
}
const JOBS = (process.env.JOBS || "SB-J1,SB-J2,SB-J3,SB-J4,SB-J5,SB-J6,SB-J7,SB-J8,SB-J9,SB-J10").split(","), SEEDS = (process.env.SEEDS || "1,2,3,4,5,10").split(",").map(Number);
if (process.env.DUMP) { fs.writeFileSync(process.env.DUMP, JSON.stringify(cands)); process.exit(0); }
const score = {}, ALLP = {}; cands.forEach((c) => { score[c.name] = { n: 0, ex: [] }; });
for (const dys of [false, true]) {
  const ctx = await B.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.addInitScript((d) => { try { localStorage.setItem("e4-dyslexia", d ? "1" : "0"); localStorage.setItem("e4-levels-open", "1"); } catch (e) {} }, dys);
  const p = await ctx.newPage(); p.on("pageerror", (e) => console.log("page error " + e.message));
  await p.goto(base + "build.html"); await p.waitForTimeout(500); await p.evaluate(() => sessionStorage.setItem("e4-instructor", "1"));
  const STARTS = (process.env.STARTS || JOBS.join(",")).split(",");
  for (const job of JOBS) for (const seed of SEEDS) for (const upto of (STARTS.indexOf(job) >= 0 ? ["start", "done"] : ["done"])) {
    await p.evaluate(([job, seed, upto]) => { globalThis.__layTry = null; const c = window.__e4b; c.openJob(job, true, seed); const J = c.T, sol = J.def.solve(J.v, J.sim);
      (upto === "start" ? [] : sol).forEach((a) => c.act(a)); }, [job, seed, upto]);
    const res = await p.evaluate(async (cands) => {
      const all = {};
      const BM = await import("./js/net/business.js");
      for (const cand of cands) {
        globalThis.__layTry = cand.lay; globalThis.__bowCap = cand.bow || null;
        if (!globalThis.__builtX) globalThis.__builtX = BM.BUSINESS_ROOM_BOX.closet[2];   /* a candidate that names no width keeps the closet as built */
        const X = cand.closetX || globalThis.__builtX; BM.BUSINESS_ROOM_BOX.closet[2] = X; BM.BUSINESS_ROOM_BOX.counter[0] = X; BM.BUSINESS_ROOM_BOX.guest[0] = X;
        document.getElementById("vLog").click(); document.getElementById("vPhy").click();
        const svg = document.getElementById("plan"), S = svg.getBoundingClientRect(), box = (el) => el.getBoundingClientRect(), out = [];
        const ov = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
        const devOf = (n) => n.closest(".pdev") && n.closest(".pdev").dataset.d;
        const plateOf = (t) => (t.previousElementSibling && t.previousElementSibling.classList.contains("lpbg") ? t.previousElementSibling : t);
        const NB = [...svg.querySelectorAll("text.ns, text.rl, text.cabl")].map((t) => ({ t, d: devOf(t), b: box(plateOf(t)) }));
        const TB = [...svg.querySelectorAll(".pdev rect.tile")].map((o) => ({ d: devOf(o), b: box(o) }));
        NB.forEach(({ t, d, b }, i) => {
          if (b.left < S.left - 1 || b.right > S.right + 1 || b.top < S.top - 1 || b.bottom > S.bottom + 1) out.push('"' + t.textContent + '" off the plan');
          TB.forEach((o) => { if (o.d !== d && ov(b, o.b)) out.push('"' + t.textContent + '" on ' + o.d + "'s tile"); });
          NB.slice(i + 1).forEach((o) => { if ((o.d !== d || !d) && ov(b, o.b)) out.push('"' + t.textContent + '" on "' + o.t.textContent + '"'); }); });
        TB.forEach((a, i) => TB.slice(i + 1).forEach((b) => { if (ov(a.b, b.b)) out.push(a.d + " and " + b.d + " tiles overlap"); }));
        const walls = []; svg.querySelectorAll("rect.room").forEach((r) => { const b = box(r); walls.push({ v: 1, at: b.left, a: b.top, z: b.bottom }, { v: 1, at: b.right, a: b.top, z: b.bottom }, { v: 0, at: b.top, a: b.left, z: b.right }, { v: 0, at: b.bottom, a: b.left, z: b.right }); });
        const onWall = (b, m) => walls.some((w) => (w.v ? b.left + m < w.at && b.right - m > w.at && b.top < w.z && b.bottom > w.a : b.top + m < w.at && b.bottom - m > w.at && b.left < w.z && b.right > w.a));
        NB.forEach(({ t, b }) => { if (onWall(b, 1)) out.push('"' + t.textContent + '" on a wall'); });
        TB.forEach(({ d, b }) => { if (onWall(b, 2)) out.push(d + "'s tile on a wall"); });
        const inside = (pt, b) => pt.x > b.left + 1 && pt.x < b.right - 1 && pt.y > b.top + 1 && pt.y < b.bottom - 1;
        svg.querySelectorAll("path[data-ends]").forEach((pa) => {
          const ends = pa.dataset.ends.split(" "), L = pa.getTotalLength(), M = pa.getScreenCTM(), hit = new Set();
          for (let s = 0; s <= 60; s++) { const q = pa.getPointAtLength(L * s / 60), pt = new DOMPoint(q.x, q.y).matrixTransform(M);
            TB.forEach((o) => { if (ends.indexOf(o.d) < 0 && inside(pt, o.b)) hit.add(o.d + "'s tile"); });
            NB.forEach((o) => { if (o.d && ends.indexOf(o.d) < 0 && inside(pt, o.b)) hit.add('"' + o.t.textContent + '"'); }); }
          hit.forEach((h) => out.push(ends.join("-") + " run under " + h)); });
        all[cand.name] = out;
      }
      return all;
    }, cands);
    for (const c of cands) for (const o of res[c.name]) { score[c.name].n++; if (score[c.name].ex.length < 8) score[c.name].ex.push((dys ? "easier " : "") + job + " " + upto + " " + seed + ": " + o);
      if (process.env.ALL) { const k = c.name + " | " + job + " " + upto + " | " + o.replace(/"(Reception|Counter|Till) PC"/, '"<front PC>"').replace(/"(Treatment room|Surgery|Kitchen|Workshop|Stock room) PC"/, '"<back PC>"'); ALLP[k] = (ALLP[k] || 0) + 1; } }
  }
  await ctx.close();
}
const ranked = cands.slice().sort((a, b) => score[a.name].n - score[b.name].n);
for (const c of ranked.slice(0, 10)) console.log(score[c.name].n + "  " + c.name + "  X=" + (c.closetX || 300) + " bow=" + c.bow + "  " + JSON.stringify(c.lay) + "\n     " + score[c.name].ex.join("\n     "));
console.log("built: " + score.built.n + " problems");
if (process.env.ALL) Object.keys(ALLP).sort().forEach((k) => console.log(ALLP[k] + "  " + k));
fs.writeFileSync(process.env.BEST || "planbest.json", JSON.stringify(ranked.slice(0, 10).map((c) => ({ name: c.name, closetX: c.closetX || 300, bow: c.bow || null, lay: c.lay, n: score[c.name].n })), null, 1));
await B.close(); srv.close();
