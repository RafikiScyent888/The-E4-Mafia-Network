// SB-J7's, SB-J8's and SB-J9's pages, screenshotted for the owner's preview: each work order, the work part done, Mason's third rung on
// the trap, and the finished job. Not part of the site.
// node tools/wip/sb78page.mjs <out dir> [seed]
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import url from "node:url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../.."), OUT = path.resolve(process.argv[2] || "."), seed = +(process.argv[3] || 4242);
fs.mkdirSync(OUT, { recursive: true });
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": T[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const base = "http://127.0.0.1:" + srv.address().port + "/";
const pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const errs = [];
async function fresh() {
  const ctx = await B.newContext({ viewport: { width: 1400, height: 1000 } }), p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(base + "build.html"); await p.waitForTimeout(400); await p.evaluate(() => sessionStorage.setItem("e4-instructor", "1"));
  return { ctx, p };
}
/* a job opened on a chosen business (the instructor's way), then a page expression run against it */
async function at(name, job, body, sel) {
  const { ctx, p } = await fresh();
  await p.evaluate(([job, seed, body]) => {
    const c = window.__e4b; c.openJob(job, true, seed);
    const J = c.T, p = J.v.plan, sol = J.def.solve(J.v, J.sim), tab = (n) => [...document.querySelectorAll(".win-tabs button")].find((b) => b.textContent === n).click(), dev = (d) => document.querySelector("#devtabs [data-d=" + d + "]").click();
    const go = (u) => { const f = document.querySelector(".browser form"); f.querySelector("input[name=url]").value = u; f.requestSubmit(); };
    new Function("c", "J", "p", "sol", "tab", "dev", "go", body)(c, J, p, sol, tab, dev, go);
  }, [job, seed, body]);
  await p.waitForTimeout(300);
  const el = sel ? await p.$(sel) : null; await (el || p).screenshot({ path: path.join(OUT, name + ".png") }); console.log("saved", name);
  await ctx.close();
}
const tk = "c.check(); document.getElementById('tk').scrollIntoView();", chk = "document.getElementById('check').scrollIntoView();";
/* SB-J7 */
await at("7-1-order", "SB-J7", tk, "#tk");
await at("7-2-ssh-address", "SB-J7", "sol.slice(0,8).forEach((a)=>c.act(a)); c.act({t:'cmd',dev:'mgr',line:'do show ip interface brief'}); dev('mgr'); tab('Command Prompt');", ".win-body");
await at("7-3-mason-old-gateway", "SB-J7", "const F=p.fixed; sol.forEach((a)=>c.act(a.line==='ip route 0.0.0.0 0.0.0.0 '+F.gw?Object.assign({},a,{line:'ip route 0.0.0.0 0.0.0.0 '+J.sim.net.isp.gw}):a)); for(let i=0;i<5;i++) c.check(); " + chk, "#check");
await at("7-4-done", "SB-J7", "sol.forEach((a)=>c.act(a)); c.check(); " + chk, "#check");
await at("7-5-phone-fixed-address", "SB-J7", "sol.forEach((a)=>c.act(a)); c.check(); dev('mphone'); tab('Web browser'); go('https://'+p.fixed.ip+':'+p.cams[0].ext);", ".win-body");
/* SB-J8 */
const deny = "const deny=sol.findIndex((a)=>/^35 deny/.test(a.line||''));";
await at("8-1-order", "SB-J8", tk, "#tk");
await at("8-2-switch-vlan", "SB-J8", "sol.slice(0,10).forEach((a)=>c.act(a)); c.act({t:'cmd',dev:'mgr',line:'do show vlan brief'}); dev('mgr'); tab('Command Prompt');", ".win-body");
await at("8-3-access-list-35", "SB-J8", deny + "sol.slice(0,deny+1).forEach((a)=>c.act(a)); c.act({t:'cmd',dev:'mgr',line:'do show access-lists '+p.guestAcl}); dev('mgr'); tab('Command Prompt');", ".win-body");
await at("8-4-mason-deny-at-the-end", "SB-J8", deny + "sol.forEach((a,i)=>c.act(i===deny?Object.assign({},a,{line:a.line.replace(/^35 /,'')}):a)); for(let i=0;i<5;i++) c.check(); " + chk, "#check");
await at("8-5-printer-panel", "SB-J8", "sol.forEach((a)=>c.act(a)); c.check(); dev('printer'); tab('Control panel');", ".win-body");
await at("8-6-test-page", "SB-J8", "sol.forEach((a)=>c.act(a)); c.check(); dev('pc'); tab('Printers'); [...document.querySelectorAll('.pane button')].find((b)=>b.textContent==='Print a test page').click();", ".win-body");
await at("8-7-done", "SB-J8", "sol.forEach((a)=>c.act(a)); c.check(); " + chk, "#check");
await at("8-8-diagram", "SB-J8", "sol.forEach((a)=>c.act(a)); c.check(); document.getElementById('vLog').click();", "#net");
/* SB-J9 */
const rt = "const at=(l)=>sol.findIndex((a)=>a.line===l);";
await at("9-1-order", "SB-J9", tk, "#tk");
await at("9-2-laptop-address", "SB-J9", "sol.slice(0,sol.findIndex((a)=>a.t==='client')+1).forEach((a)=>c.act(a)); dev('tech'); tab('Network settings');", ".win-body");
await at("9-3-tftp-backup-read", "SB-J9", rt + "sol.slice(0,at('reload')).forEach((a)=>c.act(a)); dev('tech'); tab('TFTP server');", ".win-body");
await at("9-4-console-after-reload", "SB-J9", rt + "sol.slice(0,at('reload')+3).forEach((a)=>c.act(a)); dev('tech'); tab('Serial terminal');", ".win-body");
await at("9-5-mason-merge-ports-shut", "SB-J9", rt + "const cp=at('copy tftp: startup-config'); sol.slice(0,cp).forEach((a)=>c.act(a)); ['copy tftp: running-config','10.0.0.2',p.backup.name,''].forEach((l)=>c.act({t:'cmd',dev:'tech',line:l,cli:true})); for(let i=0;i<5;i++) c.check(); " + chk, "#check");
await at("9-6-ssh-key-changed", "SB-J9", "const k=sol.findIndex((a)=>a.t==='cmd'&&a.dev==='mgr'); sol.slice(0,k).forEach((a)=>c.act(a)); c.act({t:'cmd',dev:'mgr',line:'ssh '+p.user+'@'+p.vlans.staff.gw}); dev('mgr'); tab('Command Prompt');", ".win-body");
await at("9-7-done", "SB-J9", "sol.forEach((a)=>c.act(a)); c.check(); " + chk, "#check");
console.log(errs.length ? "PAGE ERRORS: " + [...new Set(errs)].join(" | ") : "no page errors");
await B.close(); srv.close();
