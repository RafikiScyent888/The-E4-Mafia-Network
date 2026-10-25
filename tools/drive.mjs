/* Drives every built ticket end to end through the page, as a student would:
   commands typed into the terminal, devices opened from the buttons, the map
   and the floor plan, the board clicked through every rung of help, the fix
   made on the device's own page or Physical tab, the proof typed, then the
   page reloaded to check the progress was kept. Also the three views and
   their left columns, and that a wrong fix does not solve anything.
   Run: node tools/drive.mjs   (needs Playwright's Chromium; see CLAUDE.md)
   Optional plant: node tools/drive.mjs "<js run in the page after load>" */
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import url from "node:url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const { HOME_TICKETS } = await import("../js/tickets/home.js"); const { OFFICE_TICKETS } = await import("../js/tickets/office.js"); const EN = await import("../js/tickets/engine.js");
const { JOBS } = await import("../js/build/jobs.js");
/* three houses each, plus more until every variant of the fault (which end, which kind) has been driven through the page */
function seedsFor(id) {
  const def = HOME_TICKETS.concat(OFFICE_TICKETS).find((d) => d.id === id); if (!def) return [11];   /* not built: the loop names it */
  const key = (T) => JSON.stringify([T.v.kind, T.v.end, T.v.kink]), out = [11, 2025, 777777], seen = new Set(out.map((s) => key(EN.open(def, s))));
  for (let s = 1; s < (def.level === 2 ? 40 : 400); s++) {   /* an office takes longer to build: every variant shows within the first forty */ const k = key(EN.open(def, s)); if (!seen.has(k)) { seen.add(k); out.push(s); } }
  return out;
}
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg" };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split("?")[0].split("#")[0]).slice(1) || "index.html"; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { "content-type": MIME[path.extname(rel)] || "application/octet-stream" }); r.end(e ? "" : b); }); }).listen(0);
const pw = await import(process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright/index.mjs"); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox"] });
const base = "http://127.0.0.1:" + srv.address().port + "/";
const plant = process.argv[2] || "";
const bad = [], errs = []; let steps = 0;
const check = (ok, what) => { steps++; if (!ok) bad.push(what); };

async function page(ticket, seed, file) {
  const ctx = await B.newContext({ viewport: { width: 1400, height: 900 } });
  /* a small-office ticket opens for a student who has finished Home: every home ticket solved, every home work order done */
  const homeT = /^SO-/.test(ticket) ? HOME_TICKETS.map((d) => d.id) : [], homeJ = /^SO-/.test(ticket) ? JOBS.filter((d) => !d.free).map((d) => d.id) : [];
  await ctx.addInitScript(([t, s, hT, hJ]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-network-v1", JSON.stringify({ current: t, t: { [t]: { seed: s } }, solved: Object.fromEntries(hT.map((id) => [id, 1])) })); if (hJ.length) localStorage.setItem("e4-build-v1", JSON.stringify({ j: {}, done: Object.fromEntries(hJ.map((id) => [id, 1])) })); sessionStorage.setItem("seeded", "1"); } }, [ticket, seed, homeT, homeJ]);
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(ticket + ": " + e.message));
  await p.goto(base + (file || "index.html")); await p.waitForTimeout(350);
  if (plant) await p.evaluate(plant);
  return { p, ctx };
}
const dev = async (p, id) => { await p.click('#devtabs [data-d="' + id + '"]'); await p.waitForTimeout(40); };
const tab = async (p, name) => { await p.click('.win-tabs button:text-is("' + name + '")'); await p.waitForTimeout(40); };
const type = async (p, line) => { await p.fill(".term .cmdin", line); await p.press(".term .cmdin", "Enter"); await p.waitForTimeout(40); };
const term = (p) => p.$eval(".term pre", (n) => n.textContent);
/* a drawing as painted on screen. The logical diagram ("net"): every port name on the diagram, clear of every device's tile
   and label and every other port name (measured from the painted boxes, so a diagram drawn while hidden, where nothing can be
   measured, shows). The floor plan ("plan"): every device's name and every room's name on the plan, clear of each other and
   of every tile. AAA can't see these: text painted over text still measures as dark on light */
const labelsClear = (p, which) => p.evaluate((which) => {
  const svg = document.getElementById(which), S = svg.getBoundingClientRect(), box = (el) => el.getBoundingClientRect();
  const ov = (a, b) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
  const pl = [...svg.querySelectorAll(which === "net" ? "text.pl" : "text.ns, text.rl")], others = [...svg.querySelectorAll(which === "net" ? "text.nl, text.ns, rect.tile" : "rect.tile")], out = [];
  const off = (t) => { const b = box(t); if (b.left < S.left - 1 || b.right > S.right + 1 || b.top < S.top - 1 || b.bottom > S.bottom + 1) out.push('"' + t.textContent + '" off the diagram'); };
  pl.forEach((t, i) => {
    const b = box(t); off(t);
    others.forEach((o) => { if (ov(b, box(o))) out.push('"' + t.textContent + '" on ' + (o.tagName === "rect" ? "a tile" : '"' + o.textContent + '"')); });
    pl.slice(i + 1).forEach((o) => { if (ov(b, box(o))) out.push('"' + t.textContent + '" on "' + o.textContent + '"'); });
  });
  /* the diagram's device names and addresses too (19 October 2026): on the diagram, clear of every other device's name and tile */
  if (which === "net") {
    const names = [...svg.querySelectorAll("text.nl, text.ns")], tiles = [...svg.querySelectorAll("rect.tile")];
    names.forEach((t, i) => { off(t); tiles.forEach((o) => { if (o.parentNode !== t.parentNode && ov(box(t), box(o))) out.push('"' + t.textContent + '" on a tile'); }); names.slice(i + 1).forEach((o) => { if (o.parentNode !== t.parentNode && ov(box(t), box(o))) out.push('"' + t.textContent + '" on "' + o.textContent + '"'); }); });
    /* and the port dots (25 October 2026): a dot is drawn over whatever is under it, so it never sits on a port name or a device's
       name (with easier reading on, port 1's own dot sat on the bottom of its "1": AAA 4.98:1) */
    const txt = [...svg.querySelectorAll("text.pl, text.nl, text.ns")];
    svg.querySelectorAll(".pd").forEach((d) => { const b = box(d); txt.forEach((t) => { if (ov(b, box(t))) out.push('a port dot on "' + t.textContent + '"'); }); });
  }
  return { n: pl.length, out: out };
}, which);
/* both drawings again with easier reading on: its font is bigger, so names move (the drawings measure it as drawn), then off again */
const dysClear = async (p, what) => {
  await p.click("#dys"); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
  await p.click("#vLog"); await p.waitForTimeout(60);
  const pn = await labelsClear(p, "net"); check(pn.n > 0 && !pn.out.length, what + "'s logical diagram with easier reading on: every name and port dot clear" + (pn.out.length ? " (" + pn.out.join("; ") + ")" : ""));
  await p.click("#vPhy"); await p.waitForTimeout(40);
  const fp = await labelsClear(p, "plan"); check(fp.n > 0 && !fp.out.length, what + "'s floor plan with easier reading on: every name clear" + (fp.out.length ? " (" + fp.out.join("; ") + ")" : ""));
  await p.click("#dys"); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(100);
};
const T = (p, f) => p.evaluate(f);

/* each ticket: what to look at, the fix through the page, the proof, and a tempting wrong fix */
const PLAN = {
  "HOME-01": {
    look: async (p) => { await dev(p, "pc"); await type(p, "ipconfig"); check(/Media disconnected/.test(await term(p)), "HOME-01: ipconfig shows Media disconnected"); await dev(p, "switch"); },
    wrong: async (p, v) => { await dev(p, "pc"); await tab(p, "Physical"); await p.click('.phys button:text-is("Restart (power off and on)")'); },
    fix: async (p, v) => {
      if (v.kind === "crushed") { await dev(p, "pc"); await tab(p, "Physical"); await p.click('.cabs button:text-is("Swap in a new cable")'); }
      else if (v.kind === "pc-end") { await dev(p, "pc"); await tab(p, "Physical"); await p.click('.cabs button:text-is("Reseat the plug")'); }
      else { await dev(p, "switch"); await tab(p, "Physical"); await p.click('.cabs li:has-text("office PC") button:text-is("Reseat the plug")'); }
    },
    proof: async (p, gw) => { await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ping " + gw); }
  },
  "HOME-02": {
    look: async (p) => { await dev(p, "laptop"); await type(p, "ipconfig"); check(/169\.254\./.test(await term(p)), "HOME-02: ipconfig shows 169.254"); },
    wrong: async (p) => { await dev(p, "laptop"); await tab(p, "Command Prompt"); await type(p, "ipconfig /renew"); },
    fix: async (p) => { await dev(p, "router"); await tab(p, "LAN & DHCP"); await p.check('.devform input[name="on"][value="1"]'); await p.click('.devform button:text-is("Save")'); await p.waitForTimeout(60); check(/Saved/.test(await p.$eval(".devform .msg", (n) => n.textContent)), "HOME-02: the DHCP page says Saved"); await dev(p, "laptop"); await tab(p, "Command Prompt"); await type(p, "ipconfig /renew"); },
    proof: async (p, gw) => { await dev(p, "laptop"); await tab(p, "Command Prompt"); await type(p, "ping " + gw); }
  },
  "HOME-03": {
    look: async (p) => { await dev(p, "laptop"); await type(p, "nslookup rafiki-it.example"); check(/timed-out/.test(await term(p)), "HOME-03: nslookup times out"); },
    wrong: async (p) => { await dev(p, "laptop"); await tab(p, "Command Prompt"); await type(p, "ipconfig /flushdns"); await type(p, "ipconfig /renew"); },
    fix: async (p) => { await dev(p, "router"); await tab(p, "LAN & DHCP"); await p.check('.devform input[name="dnsMode"][value="manual"]'); await p.fill('.devform input[name="dns1"]', "203.0.113.53"); await p.fill('.devform input[name="dns2"]', "203.0.113.54"); await p.click('.devform button:text-is("Save")'); await dev(p, "laptop"); await tab(p, "Command Prompt"); await type(p, "ipconfig /renew"); },
    proof: async (p) => { await dev(p, "laptop"); await tab(p, "Command Prompt"); await type(p, "nslookup rafiki-it.example"); }
  },
  "HOME-04": {
    look: async (p) => { await dev(p, "laptop"); await type(p, "netsh wlan show interfaces"); check(/Channel\s+: 6/.test(await term(p)), "HOME-04: the laptop is on channel 6"); await type(p, "netsh wlan show networks mode=bssid"); },
    wrong: async (p, v) => { await dev(p, "router"); await tab(p, "Wi-Fi"); await p.selectOption('.devform select[name="ch24"]', String(v.busy)); await p.click('.devform button:text-is("Save")'); },
    fix: async (p, v) => { await dev(p, "router"); await tab(p, "Wi-Fi"); await p.selectOption('.devform select[name="ch24"]', String(v.clear)); await p.click('.devform button:text-is("Save")'); },
    proof: async (p, gw) => { await dev(p, "laptop"); await tab(p, "Command Prompt"); await type(p, "ping -n 6 " + gw); }
  },
  "HOME-05": {
    look: async (p) => { await dev(p, "modem"); const t = await p.$eval(".leds", (n) => n.textContent); check(/DSblinking/.test(t.replace(/\s+/g, "")) && /ONLINEoff/.test(t.replace(/\s+/g, "")), "HOME-05: the modem shows DS blinking, ONLINE off"); },
    wrong: async (p, v) => { await dev(p, "modem"); await tab(p, "Physical"); const other = v.end === "a" ? "CABLE IN" : "wall outlet"; await p.click('.cabs li:has-text("' + other + '") button:text-is("Tighten the connector")'); },
    fix: async (p, v) => { await dev(p, "modem"); await tab(p, "Physical"); const which = v.end === "a" ? "wall outlet" : "CABLE IN"; await p.click('.cabs li:has-text("' + which + '") button:text-is("Tighten the connector")'); },
    proof: async (p) => { await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ping 203.0.113.80"); }
  }
  ,
  "HOME-06": {
    look: async (p) => { await dev(p, "pc"); await tab(p, "Printers"); const seen = []; for (let k = 0; k < 4; k++) { await p.click('.pane button:text-is("Print a test page")'); seen.push(await p.$eval(".pane .res", (n) => n.textContent)); } check(seen.some((t) => /it printed/.test(t)) && seen.some((t) => /nothing printed/.test(t)), "HOME-06: test pages print sometimes, fail sometimes"); },
    wrong: async (p) => { await dev(p, "tv"); await tab(p, "Physical"); await p.click('.phys button:text-is("Restart (power off and on)")'); },
    fix: async (p, v) => {
      const pre = await T(p, () => window.__e4.T.sim.net.prefix), seed = await T(p, () => window.__e4.T.seed);
      if (seed % 2) { await dev(p, "printer"); await p.fill('.devform input[name="ip"]', pre + ".251"); await p.click('.devform button:text-is("Save")'); await dev(p, "pc"); await tab(p, "Printers"); await p.fill('.devform input[name="port"]', pre + ".251"); await p.click('.devform button:text-is("Save")'); }
      else { await dev(p, "router"); await tab(p, "DHCP clients"); await p.fill('.devform input[name="name"]', "Printer"); await p.fill('.devform input[name="mac"]', v.prMac); await p.fill('.devform input[name="ip"]', v.ip); await p.click('.devform button:text-is("Add")'); await dev(p, "tv"); await tab(p, "Physical"); await p.click('.phys button:text-is("Restart (power off and on)")'); }
    },
    proof: async (p) => { await dev(p, "pc"); await tab(p, "Printers"); await p.click('.pane button:text-is("Print a test page")'); }
  },
  "HOME-07": {
    look: async (p) => { await dev(p, "guest"); check(/169\.254\./.test(await p.$eval(".pane .kv", (n) => n.textContent)), "HOME-07: the guest's phone has a 169.254 address"); },
    wrong: async (p) => { await dev(p, "router"); await tab(p, "LAN & DHCP"); await p.fill('.devform input[name="leaseH"]', "1"); await p.click('.devform button:text-is("Save")'); await dev(p, "guest"); await p.click('.pane button:text-is("Turn Wi-Fi off and on")'); },
    fix: async (p) => { const base = await T(p, () => +window.__e4.T.sim.d.router.dhcp.start.split(".")[3]), pre = await T(p, () => window.__e4.T.sim.net.prefix); await dev(p, "router"); await tab(p, "LAN & DHCP"); await p.fill('.devform input[name="end"]', pre + "." + (base + 100)); await p.click('.devform button:text-is("Save")'); await dev(p, "guest"); await p.click('.pane button:text-is("Turn Wi-Fi off and on")'); },
    proof: async (p) => { await dev(p, "guest"); await tab(p, "Physical").catch(() => {}); await dev(p, "guest"); }
  },
  "HOME-08": {
    look: async (p) => { await dev(p, "pc"); await tab(p, "Network settings"); check(/100\/100/.test(await p.$eval(".pane .kv", (n) => n.textContent)), "HOME-08: the PC's link is 100/100"); await p.click('.pane button:text-is("Run a speed test")'); },
    wrong: async (p) => { await dev(p, "pc"); await tab(p, "Physical"); await p.click('.cabs button:text-is("Reseat the plug")'); },
    fix: async (p) => { await dev(p, "pc"); await tab(p, "Physical"); await p.click('.cabs button:text-is("Swap in a new cable")'); },
    proof: async (p) => { await dev(p, "pc"); await tab(p, "Network settings"); await p.click('.pane button:text-is("Run a speed test")'); }
  },
  "HOME-09": {
    look: async (p) => { await dev(p, "phone"); await p.click('.pane button:text-is("Open the camera app on mobile data")'); check((await p.$$eval(".pane .res", (l) => l.map((n) => n.textContent))).some((t) => /Camera app: can't connect/.test(t)), "HOME-09: the camera app can't connect from outside"); },
    wrong: async (p) => { const cam = await T(p, () => window.__e4.T.sim.addr("camera").ip); await dev(p, "router"); await tab(p, "Port forwarding"); await p.fill('.devform input[name="ip"]', cam); await p.click('.devform button:text-is("Save")'); },
    afterWrong: async (p) => { check(/Will it still work after the next power cut/.test(await p.$eval("#board", (n) => n.textContent)), "HOME-09: Mason says the forward alone treats the symptom"); },
    fix: async (p) => { const cam = await T(p, () => window.__e4.T.sim.addr("camera").ip); await dev(p, "router"); await tab(p, "DHCP clients"); await p.click('.pane button[aria-label^="Reserve ' + cam + '"]'); await tab(p, "Port forwarding"); await p.fill('.devform input[name="ip"]', cam); await p.click('.devform button:text-is("Save")'); },
    proof: async (p) => { await dev(p, "phone"); await p.click('.pane button:text-is("Open the camera app on mobile data")'); }
  },
  "HOME-10": {
    look: async (p) => { await dev(p, "laptop"); await type(p, "ipconfig"); check(/10\.0\.0\./.test(await term(p)), "HOME-10: the laptop has a 10.0.0.x address"); await p.click("#vPhy"); await p.click('#plan [data-d="rogue"]'); check(/Terminal · Old router/.test(await p.$eval("#termtitle", (n) => n.textContent)), "HOME-10: the old router opens from the floor plan"); await p.click("#vLog"); check(!(await p.$('#net [data-d="rogue"]')), "HOME-10: the old router is not on the documented diagram"); },
    wrong: async (p) => { await dev(p, "laptop"); await tab(p, "Command Prompt"); await type(p, "ipconfig /renew"); },
    fix: async (p) => { await dev(p, "switch"); await tab(p, "Physical"); await p.click('.cabs li:has-text("not on the diagram") button:text-is("Unplug it")'); await dev(p, "laptop"); await tab(p, "Command Prompt"); await type(p, "ipconfig /renew"); await dev(p, "tv"); await tab(p, "Physical"); await p.click('.phys button:text-is("Restart (power off and on)")'); },
    proof: async (p) => { await dev(p, "laptop"); await tab(p, "Command Prompt"); await type(p, "ping 203.0.113.80"); }
  },
  "HOME-11": {
    look: async (p, v) => { await dev(p, "pc"); await type(p, "ping " + v.ip); check(/Request timed out/.test(await term(p)), "HOME-11: pings to the printer time out"); await type(p, "arp -a"); check(new RegExp(v.ip.replace(/\./g, "\\.") + " +" + v.prMac).test(await term(p)), "HOME-11: arp -a shows the printer answered ARP"); },
    wrong: async (p) => { await dev(p, "printer"); await tab(p, "Physical"); await p.click('.phys button:text-is("Restart (power off and on)")'); },
    fix: async (p) => { await dev(p, "printer"); await tab(p, "Control panel"); await p.fill('.devform input[name="mask"]', "255.255.255.0"); await p.click('.devform button:text-is("Save")'); },
    proof: async (p) => { await dev(p, "pc"); await tab(p, "Printers"); await p.click('.pane button:text-is("Print a test page")'); }
  },
  "HOME-12": {
    look: async (p, v) => { await dev(p, "pc"); await type(p, "ipconfig"); check((await term(p)).indexOf(v.gw) >= 0, "HOME-12: ipconfig shows the old gateway"); },
    wrong: async (p) => { await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ipconfig /renew"); },
    fix: async (p, v) => { await dev(p, "pc"); await tab(p, "Network settings"); if (v.kind === "same") { await p.check('.devform input[name="mode"][value="dhcp"]'); } else { const g = await T(p, () => window.__e4.T.sim.d.router.lan.ip); await p.fill('.devform input[name="gw"]', g); } await p.click('.devform button:text-is("Save")'); await p.waitForTimeout(60); check(/Saved/.test(await p.$eval(".devform .msg", (n) => n.textContent)), "HOME-12: the IP settings say Saved"); },
    proof: async (p) => { await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ping 203.0.113.80"); }
  },
  "HOME-13": {
    look: async (p) => { await dev(p, "camera"); await tab(p, "Web page"); check(/can't be reached/.test(await p.$eval(".pane", (n) => n.textContent)), "HOME-13: the camera's page can't be reached"); await dev(p, "injector"); await tab(p, "Physical"); check(/Its label/.test(await p.$eval(".m3d-says", (n) => n.textContent)), "HOME-13: the injector's Physical tab says what its label says"); },
    wrong: async (p) => { await dev(p, "camera"); await tab(p, "Physical"); await p.click('.phys button:text-is("Restart (power off and on)")'); },
    fix: async (p, v) => { await dev(p, "injector"); await tab(p, "Physical"); await p.click('.phys button:text-is("' + (v.kind === "unplugged" ? "Plug its power adapter in" : "Swap in a new 802.3af injector") + '")'); check(/it powers up/.test(await p.$eval(".phys", (n) => n.textContent)), "HOME-13: the camera powers up"); },
    proof: async (p) => { await dev(p, "camera"); await tab(p, "Web page"); }
  },
  "HOME-14": {
    look: async (p) => { await dev(p, "laptop"); await type(p, "netsh wlan show drivers"); check(!/WPA3/.test(await term(p)), "HOME-14: the old adapter lists no WPA3"); await type(p, "netsh wlan show networks"); check(/WPA3-Personal/.test(await term(p)), "HOME-14: the house network uses WPA3-Personal"); },
    wrong: async (p) => { await dev(p, "router"); await tab(p, "Wi-Fi"); await p.selectOption('.devform select[name="sec"]', "WPA2-Personal"); await p.click('.devform button:text-is("Save")'); },
    afterWrong: async (p) => { check(/keeps WPA3/.test(await p.$eval("#board", (n) => n.textContent)), "HOME-14: Mason says WPA2 alone isn't the fix"); },
    fix: async (p) => { await dev(p, "router"); await tab(p, "Wi-Fi"); await p.selectOption('.devform select[name="sec"]', "WPA2/WPA3-Personal"); await p.click('.devform button:text-is("Save")'); },
    proof: async (p) => { await dev(p, "laptop"); await tab(p, "Command Prompt"); await type(p, "ping 203.0.113.80"); }
  },
  "HOME-15": {
    look: async (p) => { await dev(p, "laptop"); await type(p, "netsh wlan show interfaces"); check(/Authentication\s+: Open/.test(await term(p)), "HOME-15: the laptop is on an open network"); await type(p, "netsh wlan show networks mode=bssid"); },
    wrong: async (p) => { await dev(p, "laptop"); await tab(p, "Wi-Fi"); await p.click('.pane button:text-is("Forget the saved network")'); await p.click('.pane button:text-is("Connect (enter the password)")'); },
    afterWrong: async (p) => { check(/has it now/.test(await p.$eval("#board", (n) => n.textContent)), "HOME-15: Mason says the password was given away"); },
    fix: async (p) => { await dev(p, "laptop"); await tab(p, "Wi-Fi"); await p.click('.pane button:text-is("Forget the saved network")'); await dev(p, "router"); await tab(p, "Wi-Fi"); await p.click('.pane button:text-is("Change the Wi-Fi password")'); await dev(p, "laptop"); await tab(p, "Wi-Fi"); await p.click('.pane button:text-is("Connect (enter the password)")'); await dev(p, "phone"); await p.click('.pane button:text-is("Re-enter the Wi-Fi password")'); },
    proof: async (p) => { await dev(p, "laptop"); await tab(p, "Command Prompt"); await type(p, "ping 203.0.113.80"); }
  }
};

/* the small office's tickets: the switch's console from your laptop, ssh and ping from the front desk PC */
/* the passwords come off the page, from the office's records on the ticket card, as a student would get them */
const rec = (p, name) => p.$eval('#officeRecs dd[data-rec="' + name + '"]', (n) => n.textContent).catch(() => "(no records on the ticket)");
const swLogin = async (p, v) => { const con = await rec(p, "Console password"), sec = await rec(p, "Enable secret"); check(con === v.plan.console && sec === v.plan.secret, "the office's records on the ticket give the console password and the enable secret"); await dev(p, "tech"); await tab(p, "Serial terminal"); for (const l of ["", con, "enable", sec]) await type(p, l); };
const swConf = async (p, v, lines, save) => { await swLogin(p, v); for (const l of ["configure terminal"].concat(lines, ["end"], save === false ? [] : ["copy running-config startup-config", ""])) await type(p, l); };
const sshFromPc = async (p, user, host, pw, tries) => { await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ssh " + user + "@" + host); for (let k = 0; k < (tries || 1); k++) await type(p, pw); };
Object.assign(PLAN, {
  "SO-01": {
    look: async (p, v) => { await swLogin(p, v); await type(p, "show interfaces gi0/3"); await type(p, "show interfaces gi0/3"); const lc = [...(await term(p)).matchAll(/(\d+) late collision/g)].map((m) => +m[1]); check(/Half-duplex, 100Mb\/s/.test(await term(p)) && lc.length >= 2 && lc[lc.length - 1] > lc[lc.length - 2], "SO-01: show interfaces gi0/3 twice: half duplex, late collisions climbing"); },
    wrong: async (p, v) => { await swConf(p, v, ["interface gi0/3", "speed 100", "duplex full"], false); },
    afterWrong: async (p) => { check(/hasn't saved it/.test(await p.$eval("#board", (n) => n.textContent)), "SO-01: fixed but not saved: Mason says it isn't saved"); },
    fix: async (p, v) => { await swConf(p, v, ["interface gi0/3", "speed 100", "duplex full"]); },
    proof: async (p) => { await dev(p, "pc"); await tab(p, "Printers"); await p.click('.pane button:text-is("Print a test page")'); }
  },
  "SO-02": {
    look: async (p, v) => { await dev(p, "pc"); await type(p, "ipconfig"); check(/Media disconnected/.test(await term(p)), "SO-02: ipconfig on the front desk PC: Media disconnected"); await swLogin(p, v); await type(p, "show interfaces status"); check(/Gi0\/2\s+FRONT-DESK-PC\s+disabled/.test(await term(p)), "SO-02: show interfaces status: the front desk PC's port is disabled"); },
    wrong: async (p, v) => { await swConf(p, v, ["interface range gi0/2 - 28", "no shutdown"]); },
    afterWrong: async (p) => { check(/spare ports are live again/.test(await p.$eval("#board", (n) => n.textContent)), "SO-02: the whole range opened: Mason says the spares are live again"); },
    fix: async (p, v) => { await swConf(p, v, ["interface gi0/2", "no shutdown"]); },
    proof: async (p, gw) => { await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ping " + gw); }
  },
  "SO-03": {
    look: async (p, v) => { await swLogin(p, v); await type(p, "show version"); check(/System returned to ROM by power-on/.test(await term(p)), "SO-03: show version: it came back from a power cut"); },
    wrong: async (p, v) => { await swConf(p, v, v.kind === "user" ? ["username " + v.user + " secret " + v.pw] : ["interface vlan 1", "ip address " + v.newIp + " " + v.plan.mask], false); },
    afterWrong: async (p) => { check(/isn't saved: the next power cut/.test(await p.$eval("#board", (n) => n.textContent)), "SO-03: Friday's change made again but not saved: Mason says so"); },
    fix: async (p, v) => { await swConf(p, v, v.kind === "user" ? ["username " + v.user + " secret " + v.pw] : ["interface vlan 1", "ip address " + v.newIp + " " + v.plan.mask]); },
    proof: async (p) => { const v = await T(p, () => window.__e4.T.v); if (v.kind === "user") await sshFromPc(p, v.user, v.plan.ip, v.pw); else { await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ping " + v.newIp); } }
  },
  "SO-04": {
    look: async (p, v) => {
      await dev(p, "meet"); const L = await p.$eval(".pane", (n) => n.textContent);
      check(/Port 1\s*off\b/.test(L) && /Port 2\s*on, amber/.test(L) && /no auto-MDIX/.test(L), "SO-04: the back office switch's lights: port 1 dark, port 2 amber; its label says no auto-MDIX");
      await swLogin(p, v); await type(p, "show interfaces status"); check(/Gi0\/5\s+BACK-OFFICE\s+notconnect/.test(await term(p)), "SO-04: show interfaces status: Gi0/5 notconnect");
      await dev(p, "msw"); await tab(p, "Physical"); await p.click('.cabs li:has-text("back office") button:text-is("Test with the cable tester")'); await p.waitForTimeout(40);
      check(/Wired straight-through/.test(await p.$eval(".cabs", (n) => n.textContent)), "SO-04: the tester passes the run, wired straight-through");
    },
    wrong: async (p) => { await dev(p, "msw"); await tab(p, "Physical"); await p.click('.cabs li:has-text("back office") button:text-is("Swap in a new cable")'); await dev(p, "mpc"); await tab(p, "Command Prompt"); await type(p, "ipconfig /renew"); },
    fix: async (p, v) => {
      if (v.kind === "template") { await dev(p, "msw");   /* both fixes through the page: a crossover for one variant, auto-MDIX back on for the other */ await tab(p, "Physical"); await p.click('.cabs li:has-text("back office") button:text-is("Swap in a crossover cable")'); }
      else await swConf(p, v, ["interface gi0/5", "mdix auto"]);
      await dev(p, "mpc"); await tab(p, "Command Prompt"); await type(p, "ipconfig /renew");
    },
    proof: async (p) => { await dev(p, "mpc"); await tab(p, "Command Prompt"); await type(p, "ping 203.0.113.80"); }
  },
  "SO-05": {
    look: async (p, v) => { check((await rec(p, "Remote logins (SSH)")) === "user " + v.plan.user + " · password " + v.plan.userPw, "SO-05: the office's records give the SSH user and password"); await sshFromPc(p, v.plan.user, v.plan.ip, v.plan.userPw, v.kind === "lines" ? 3 : 0); check(v.kind === "lines" ? /Permission denied \(password\)/.test(await term(p)) : /Connection refused/.test(await term(p)), "SO-05 (" + v.kind + "): ssh from the front desk PC is " + (v.kind === "lines" ? "denied" : "refused")); },
    wrong: async (p, v) => { await swConf(p, v, v.kind === "nokeys" ? ["crypto key generate rsa modulus 2048"] : v.kind === "telnet" ? ["line vty 0 15", "transport input all"] : ["line vty 0 15", "login local"], v.kind === "telnet"); },
    afterWrong: async (p) => { check(/still take Telnet|hasn't saved it/.test(await p.$eval("#board", (n) => n.textContent)), "SO-05: SSH working but Telnet open, or not saved: Mason says so"); },
    fix: async (p, v) => { await swConf(p, v, v.kind === "nokeys" ? ["crypto key generate rsa modulus 2048"] : v.kind === "telnet" ? ["line vty 0 15", "transport input ssh"] : ["line vty 0 15", "login local"]); },
    proof: async (p) => { const v = await T(p, () => window.__e4.T.v); await sshFromPc(p, v.plan.user, v.plan.ip, v.plan.userPw); }
  },
  "SO-06": {
    look: async (p, v) => {
      await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ping " + v.plan.ip);
      check((v.kind === "mask" ? /Request timed out\./ : /Destination host unreachable/).test(await term(p)), "SO-06 (" + v.kind + "): ping from the front desk PC to the switch: " + (v.kind === "mask" ? "timed out" : "host unreachable"));
      await swLogin(p, v); await type(p, "show running-config"); check(new RegExp("interface Vlan1\\s+ip address " + v.ip.replace(/\./g, "\\.") + " " + v.mask.replace(/\./g, "\\.")).test(await term(p)), "SO-06: show running-config shows VLAN 1's address and mask as found");
    },
    wrong: async (p, v) => { await swConf(p, v, ["interface vlan 1", "ip address " + v.plan.ip + " " + v.plan.mask], false); },
    afterWrong: async (p) => { check(/hasn't saved it/.test(await p.$eval("#board", (n) => n.textContent)), "SO-06: the address put back but not saved: Mason says so"); },
    fix: async (p, v) => { await swConf(p, v, ["interface vlan 1", "ip address " + v.plan.ip + " " + v.plan.mask]); },
    proof: async (p) => { const v = await T(p, () => window.__e4.T.v); await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ping " + v.plan.ip); }
  },
  "SO-07": {
    look: async (p, v) => {
      await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ipconfig /all"); check(/Media disconnected/.test(await term(p)) && /Fast Ethernet Adapter \(10\/100\)/.test(await term(p)), "SO-07: ipconfig /all on the front desk PC: no link, a 10/100 adapter");
      await swLogin(p, v); await type(p, "show interfaces status"); check(/Gi0\/2\s+FRONT-DESK-PC\s+notconnect\s+1\s+auto\s+1000/.test(await term(p)), "SO-07: show interfaces status: Gi0/2 notconnect, fixed at 1000");
    },
    wrong: async (p, v) => { await swConf(p, v, ["interface gi0/2", "speed 100", "duplex full"]); },
    afterWrong: async (p) => { check(/falls back to half duplex/.test(await p.$eval("#board", (n) => n.textContent)), "SO-07: speed and duplex both fixed: Mason says the PC falls back to half duplex"); },
    fix: async (p, v) => { await swConf(p, v, ["interface gi0/2", v.kind === "contractor" ? "speed auto" : "speed 100"]); },
    proof: async (p, gw) => { await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ping " + gw); }
  },
  "SO-08": {
    look: async (p, v) => {
      await dev(p, "mgr"); await tab(p, "Command Prompt"); await type(p, "ipconfig"); check(/Media disconnected/.test(await term(p)), "SO-08: ipconfig on the manager's PC: Media disconnected");
      await swLogin(p, v); await type(p, "show interfaces status"); check(/Gi0\/4\s+MANAGER-PC\s+notconnect/.test(await term(p)), "SO-08: show interfaces status: the manager's port is notconnect");
      check(await p.$eval("#cm7", (n) => n.value) === "manager", "SO-08: the cable map under the ticket says port 7 is the manager's");
      await dev(p, "mgr"); await tab(p, "Physical"); await p.click('.cabs li:has-text("wall jack") button:text-is("Put the tone generator on it")'); await p.waitForTimeout(40);
      await dev(p, "pp"); await p.click("#probeBtn"); await p.waitForTimeout(40);
      check(new RegExp("back of port " + v.ports.manager + "\\b").test(await p.$eval(".phys", (n) => n.textContent)), "SO-08: the probe at the panel finds the manager's run at port " + v.ports.manager);
      check(!/manager|meeting/i.test(await p.$$eval(".cabs .nm", (l) => l.map((x) => x.textContent).join(" "))), "SO-08: nothing on the panel's list says which room a run goes to");
    },
    wrong: async (p, v) => { await dev(p, "pp"); await p.selectOption("#rp-c-cord-mgr", v.ports.manager); await p.click('.cabs li:has-text("port 7") button:text-is("Move the cord")'); await p.waitForTimeout(40); },
    afterWrong: async (p) => { check(/still has the runs the wrong way round/.test(await p.$eval("#board", (n) => n.textContent)), "SO-08: the cord moved but the map left wrong: Mason says so"); },
    fix: async (p, v) => {
      await dev(p, "pp"); await p.selectOption("#rp-c-cord-mgr", v.ports.manager); await p.click('.cabs li:has-text("port 7") button:text-is("Move the cord")'); await p.waitForTimeout(40);
      const m = { 7: "meeting" }; m[v.ports.front] = "front"; m[v.ports.open] = "open"; m[v.ports.manager] = "manager";
      for (const port of Object.keys(m)) await p.selectOption("#cm" + port, m[port]);
      await p.click("#cmapSave"); await p.waitForTimeout(40); check(/Saved/.test(await p.$eval("#cmapSum", (n) => n.textContent)), "SO-08: the map says Saved");
    },
    proof: async (p) => { await dev(p, "mgr"); await tab(p, "Command Prompt"); await type(p, "ping 203.0.113.80"); }
  },
  "SO-10": {
    look: async (p, v) => {
      await dev(p, "mpc"); await tab(p, "Command Prompt"); await type(p, "ipconfig"); check(/169\.254\./.test(await term(p)), "SO-10: the back office PC is on 169.254");
      await swLogin(p, v); await type(p, "show interfaces status"); await type(p, "show interfaces transceiver");
      const t = await term(p); check(v.kind === "plus" ? /Gi0\/25\s+BACK-OFFICE-FIBRE\s+err-disabled/.test(t) && /Unsupported transceiver/.test(t) : /Gi0\/25\s+BACK-OFFICE-FIBRE\s+notconnect/.test(t) && /-40\.0\s+\(no light received\)/.test(t), "SO-10 (" + v.kind + "): show interfaces status and transceiver say why the fibre is dark");
      for (const d of ["msw", "bsw"]) { await dev(p, d); await tab(p, "Physical"); await p.click('.cabs li:has-text("Fibre patch cord") button:text-is("Look at the plug")'); await p.waitForTimeout(40); }
      const ev = await T(p, () => window.__e4.T.evidence.map((e) => e.id)); check(ev.indexOf("lookc") >= 0 && ev.indexOf("lookb") >= 0, "SO-10: both ends' modules read and noted (" + ev + ")");
    },
    wrong: async (p) => { await dev(p, "msw"); await tab(p, "Physical"); await p.click('.cabs li:has-text("Fibre patch cord") button:text-is("Swap the LC pair over at this end")'); await dev(p, "mpc"); await tab(p, "Command Prompt"); await type(p, "ipconfig /renew"); },
    fix: async (p, v) => {
      await dev(p, v.end); await tab(p, "Physical"); await p.click('.phys button:text-is("Swap in a 1000BASE-SX module")'); await p.waitForTimeout(40);
      check(/link light comes on/.test(await p.$eval(".phys", (n) => n.textContent)), "SO-10: the module swapped, the slot's link light comes on");
      await dev(p, "mpc"); await tab(p, "Command Prompt"); await type(p, "ipconfig /renew");
    },
    proof: async (p) => { await dev(p, "mpc"); await tab(p, "Command Prompt"); await type(p, "ping 203.0.113.80"); }
  },
  "SO-11": {
    look: async (p, v) => { await swLogin(p, v); await type(p, "show interfaces gi0/2"); await type(p, "show interfaces gi0/2"); const c = [...(await term(p)).matchAll(/(\d+) CRC/g)].map((m) => +m[1]); check(/Full-duplex/.test(await term(p)) && c.length >= 2 && c[c.length - 1] > c[c.length - 2], "SO-11: show interfaces gi0/2 twice: full duplex, CRC errors climbing"); },
    wrong: async (p, v) => { await swConf(p, v, ["interface gi0/2", "duplex half"]); },
    afterWrong: async (p) => { check(/now runs half duplex/.test(await p.$eval("#board", (n) => n.textContent)), "SO-11: both ends at half: Mason says it now runs half duplex"); },
    fix: async (p, v) => { await swConf(p, v, ["interface gi0/2", "speed auto", "duplex auto"]); },
    proof: async (p, gw) => { await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ping " + gw); }
  },
  "SO-12": {
    look: async (p, v) => {
      await dev(p, "tech"); await tab(p, "Serial terminal"); await type(p, "");
      check(!/User Access Verification/.test(await term(p)) && />\s*$/.test(await p.$eval(".term .prompt, .term label", (n) => n.textContent).catch(() => ">")), "SO-12: the console wakes straight to the prompt, no password asked");
      await type(p, "enable"); await type(p, await rec(p, "Enable secret")); await type(p, "show running-config");
      check(/line con 0/.test(await term(p)), "SO-12: show running-config read at the console");
    },
    wrong: async (p, v) => { await swConf(p, v, ["line console 0", "password " + v.plan.console]); },
    fix: async (p, v) => { await swConf(p, v, ["line console 0", "password " + (await rec(p, "Console password")), "login"]); },
    proof: async (p) => { await dev(p, "tech"); await tab(p, "Serial terminal"); await type(p, "exit"); await type(p, ""); }   /* after the real fix the console asks again, and that's the proof: "solved through the page" checks it */
  },
  "SO-13": {
    look: async (p, v) => {
      await sshFromPc(p, v.plan.user, v.plan.ip, v.plan.userPw, 0); const t = await term(p), fp = (t.match(/remote host is\s+(SHA256:\S+)\./) || [])[1];
      check(/REMOTE HOST IDENTIFICATION HAS CHANGED/.test(t) && !!fp, "SO-13: ssh from the front desk PC stops at the changed host key");
      await swLogin(p, v); await type(p, "show crypto key mypubkey rsa"); check(fp && (await term(p)).indexOf(fp) >= 0, "SO-13: the switch's console shows the same fingerprint as the warning");
    },
    wrong: async (p, v) => { await swConf(p, v, ["crypto key generate rsa modulus 2048"]); },
    fix: async (p, v) => { await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ssh-keygen -R " + v.plan.ip); check(/known_hosts updated/.test(await term(p)), "SO-13: ssh-keygen -R takes the old key off the front desk PC"); },
    proof: async (p) => { const v = await T(p, () => window.__e4.T.v); await sshFromPc(p, v.plan.user, v.plan.ip, v.plan.userPw); }
  },
  "SO-14": {
    look: async (p, v) => {
      await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ipconfig"); check(/Media disconnected/.test(await term(p)), "SO-14: the front desk PC has no link");
      check(await p.$eval("#cm" + v.ports.front, (n) => n.value) === "front", "SO-14: the cable map gives the front desk's panel port");
      await tab(p, "Physical"); await p.click('.cabs li:has-text("wall jack") button:text-is("Put the tone generator on it")'); await dev(p, "pp"); await p.click("#probeBtn"); await p.waitForTimeout(40);
      check(new RegExp("back of port " + v.ports.front + "\\b").test(await p.$eval(".phys", (n) => n.textContent)), "SO-14: the probe finds the front desk's run at its mapped port");
    },
    wrong: async (p, v) => { await dev(p, "pp"); await p.selectOption("#rp-c-cord-printer", v.ports.front); await p.click('.cabs li:has-text("port ' + v.ports.open + ',") button:text-is("Move the cord")'); await p.waitForTimeout(40); },
    fix: async (p, v) => { await dev(p, "pp"); await p.selectOption("#rp-c-cord-pc", v.ports.front); await p.click('.cabs li:has-text("down to the managed switch (port 2)") button:text-is("Move the cord")'); await p.waitForTimeout(40); },
    proof: async (p, gw) => { await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ping " + gw); }
  },
  "SO-15": {
    look: async (p, v) => {
      await dev(p, "mpc"); await tab(p, "Command Prompt"); await type(p, "ipconfig"); check(/169\.254\./.test(await term(p)), "SO-15: the back office PC is on 169.254");
      await swLogin(p, v); await type(p, "show interfaces transceiver"); check(/-40\.0\s+\(no light received\)/.test(await term(p)), "SO-15: show interfaces transceiver: no light received");
      for (const d of ["msw", "bsw"]) { await dev(p, d); await tab(p, "Physical"); await p.click('.cabs li:has-text("Fibre patch cord") button:text-is("Look at the plug")'); await p.waitForTimeout(40); }
    },
    wrong: async (p) => { await dev(p, "bsw"); await tab(p, "Physical"); await p.click('.phys button:text-is("Swap in a 1000BASE-LX module")'); await dev(p, "mpc"); await tab(p, "Command Prompt"); await type(p, "ipconfig /renew"); },
    fix: async (p) => { await dev(p, "msw"); await tab(p, "Physical"); await p.click('.cabs li:has-text("Fibre patch cord") button:text-is("Swap the LC pair over at this end")'); await dev(p, "mpc"); await tab(p, "Command Prompt"); await type(p, "ipconfig /renew"); },
    proof: async (p) => { await dev(p, "mpc"); await tab(p, "Command Prompt"); await type(p, "ping 203.0.113.80"); }
  },
  "SO-09": {
    look: async (p, v) => {
      await dev(p, "pc"); await tab(p, "Printers"); for (let k = 0; k < 2; k++) { await p.click('.pane button:text-is("Print a test page")'); await p.waitForTimeout(40); }
      const ev = await T(p, () => window.__e4.T.evidence.map((e) => e.id)); check(ev.indexOf("printfail") >= 0 && ev.indexOf("printok") >= 0, "SO-09: two test pages, one printed and one didn't (" + ev + ")");
      await tab(p, "Command Prompt"); await type(p, "arp -a"); check((await term(p)).indexOf(v.addr) >= 0, "SO-09: arp -a on the front desk PC lists the shared address");
      await swLogin(p, v); check(/%IP-4-DUPADDR: Duplicate address/.test(await term(p)), "SO-09: the switch's console logs the duplicate address");
      check(!(await p.$("#ipam .res")), "SO-09: the sheet says nothing until it's checked");
      await p.click("#ipamCheck"); await p.waitForTimeout(40);
      const rows = await p.$$eval("#ipam fieldset", (l) => l.map((x) => (x.classList.contains("badrow") ? "bad" : x.classList.contains("goodrow") ? "good" : "-") + (/Overlap/.test(x.textContent) ? ":overlap" : "")));
      check(rows.join(",") === "good,good,bad:overlap,bad:overlap", "SO-09: checked, the sheet marks the two overlapping blocks and passes the rest (" + rows + ")");
      check(await p.$eval("#ipamCheck", (n) => document.activeElement === n), "SO-09: focus stays on Check the sheet");
    },
    wrong: async (p, v) => { for (const f of ["net", "mask", "first", "last", "bc", "gw"]) await p.fill("#ipam" + v.moved + f, v.orig[f]); await p.click("#ipamSave"); },
    afterWrong: async (p) => { check(/still answer at the same address/.test(await p.$eval("#board", (n) => n.textContent)), "SO-09: the records put right, the devices still clashing: Mason says so"); },
    fix: async (p, v) => {
      for (const f of ["net", "mask", "first", "last", "bc", "gw"]) await p.fill("#ipam" + v.moved + f, v.orig[f]); await p.click("#ipamSave"); await p.waitForTimeout(40);
      check((await p.$$("#ipam fieldset.goodrow")).length === 4, "SO-09: the sheet put right, every block checks out");
      const o = v.orig.net.split(".").map(Number); o[3] += 2; const home = o.join(".");
      if (v.kind === "gear") await swConf(p, v, ["interface vlan 1", "ip address " + home + " " + v.plan.mask]);
      else { await dev(p, "printer"); await p.fill('.devform input[name="ip"]', home); await p.click('.devform button:text-is("Save")'); await dev(p, "pc"); await tab(p, "Printers"); await p.fill('.devform input[name="port"]', home); await p.click('.devform button:text-is("Save")'); }
    },
    proof: async (p) => { await dev(p, "pc"); await tab(p, "Printers"); for (let k = 0; k < 2; k++) await p.click('.pane button:text-is("Print a test page")'); }
  }
});

for (const [id, plan] of Object.entries(PLAN).filter(([k]) => !process.env.ONLY || k === process.env.ONLY || (process.env.ONLY === "tickets-office" && /^SO-/.test(k)))) for (const seed of seedsFor(id)) {
  if (!HOME_TICKETS.concat(OFFICE_TICKETS).some((d) => d.id === id)) { check(false, id + ": isn't among the built tickets"); continue; }
  let { p, ctx } = await page(id, seed);
  try {   /* a ticket that stops part way (a button missing, a click that times out) is a named failure, and the next ticket still runs */
  const v = await T(p, () => window.__e4.T.v), gw = await T(p, () => window.__e4.T.sim.d.router.lan.ip);
  check(await T(p, () => window.__e4.T.def.exhibits(window.__e4.T.sim, window.__e4.T.v)), id + " " + seed + ": fault present at load");
  await plan.look(p, v);
  const ev0 = await p.$$eval("#notebook li", (l) => l.length); check(ev0 >= 1, id + " " + seed + ": the notebook recorded evidence (" + ev0 + ")");
  /* the board: rungs as the rule says */
  const wrongs = await T(p, () => window.__e4.T.opts.filter((o) => !o.right).map((o) => o.id));
  for (let k = 0; k < 2; k++) await p.click('[data-opt="' + wrongs[k] + '"]');
  check(!(await p.$("#board .mason-says")), id + ": no help after two wrong picks");
  await p.click('[data-opt="' + wrongs[2] + '"]'); check(/where to look/.test(await p.$eval("#board .mason-says", (n) => n.textContent)), id + ": rung 1 after the third");
  await p.click('[data-opt="' + wrongs[3] + '"]'); check(/the principle/.test(await p.$eval("#board .mason-says", (n) => n.textContent)), id + ": rung 2 after the fourth");
  check((await p.$$("#board .opt.out")).length === 4, id + ": four picks stay red");
  check((await p.$$eval("#board .opt.out", (l) => l.every((x) => /Ruled out/.test(x.textContent) && /\u2715/.test(getComputedStyle(x.querySelector(".otext"), "::before").content) && getComputedStyle(x).boxShadow !== "none"))), id + ": each red pick is marked three ways (words, the cross, the inset rule), never colour alone");
  await p.click('[data-opt="' + wrongs[0] + '"]', { force: true }); check((await p.$$("#board .opt.out")).length === 4 && (await T(p, () => window.__e4.T.wrong)) === 4, id + ": clicking a red pick changes nothing (and doesn't count)");
  await p.click('#board button:text-is("Reset the board")'); check((await p.$$("#board .opt.out")).length === 0, id + ": reset clears the board");
  await p.click('[data-opt="' + wrongs[4] + '"]');
  const live = await p.$$eval("#board .opt:not(.out)", (l) => l.length), why = await p.$$eval("#board .opt .why", (l) => l.map((x) => x.textContent));
  check(live === 2 && why.filter((w) => /Ruled out by Mason: \S/.test(w)).length === 3, id + ": rung 3 leaves two, each strike with its reason (live " + live + ")");
  check(await p.$('[data-opt="right"]:not(.out)') !== null, id + ": the right answer is never struck");
  /* a tempting wrong fix, then the proof: not solved */
  await p.click('[data-opt="right"]'); check(/Fix it at the source/.test(await p.$eval("#board", (n) => n.textContent)), id + ": the fix stage opens");
  await p.click('#board button:text-is("Ask Mason about the fix")'); check(await p.$("#board .mason-says") !== null, id + ": Mason gives a fix hint");
  await plan.wrong(p, v); await plan.proof(p, gw);
  check(!(await T(p, () => window.__e4.T.solved)), id + " " + seed + ": a wrong fix does not solve it");
  if (plan.afterWrong) await plan.afterWrong(p);
  await p.click('#board button:text-is("Put the network back as you found it")');
  check(await T(p, () => window.__e4.T.def.exhibits(window.__e4.T.sim, window.__e4.T.v)), id + ": putting the network back brings the fault back");
  /* the real fix, through the page, then the proof */
  await plan.fix(p, v); await plan.proof(p, gw);
  const solvedNow = await p.$("#board .solved") !== null && /Ticket .* solved/.test(await p.$eval("#board .solved h3", (n) => n.textContent).catch(() => ""));
  check(solvedNow, id + " " + seed + ": solved through the page");
  if (!solvedNow) { await ctx.close(); continue; }   /* the rest needs a solved ticket: record the failure by name, don't crash */
  /* the progress is kept */
  await p.reload(); await p.waitForTimeout(350);
  check(await p.$("#board .solved") !== null, id + ": still solved after a reload");
  const qtext = await p.$eval('#queue [data-t="' + id + '"]', (n) => n.textContent).catch(() => "(not in the queue)");   /* missing from the queue: a named failure, not a crash */
  check(/Solved 1×|solved 1×/.test(qtext), id + ": the queue counts it solved (" + qtext + ")");
  check(await p.$eval('#queue [data-t="' + id + '"] .st', (n) => getComputedStyle(n).borderTopStyle === "none" && parseFloat(getComputedStyle(n).paddingTop) === 0).catch(() => false), id + ": the solved status is words in the queue, not the summary's box");
  const s1 = await T(p, () => window.__e4.T.seed);
  await p.click('#board button:text-is("Try another one like this")'); await p.waitForTimeout(80);
  check((await T(p, () => window.__e4.T.seed)) !== s1 && !(await T(p, () => window.__e4.T.solved)), id + ": a fresh house, unsolved");
  } catch (e) { check(false, id + " " + seed + ": stopped: " + String(e.message).split("\n")[0]); }
  await ctx.close();
}

/* the small office's tickets on the desk: locked for a fresh student (an office ticket left as current opens HOME-01 instead),
   listed for one who has finished Home; the card and the title say it's the office */
if (!process.env.ONLY || process.env.ONLY === "tickets-office") {
  {
    const ctx = await B.newContext({ viewport: { width: 1400, height: 900 } });
    await ctx.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-network-v1", JSON.stringify({ current: "SO-01", t: { "SO-01": { seed: 11 } }, solved: {} })); sessionStorage.setItem("seeded", "1"); } });
    const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push("office tickets locked: " + e.message)); await p.goto(base + "index.html"); await p.waitForTimeout(350);
    if (plant) await p.evaluate(plant);
    check((await T(p, () => window.__e4.T.def.id)) === "HOME-01", "office tickets: a fresh student with SO-01 left as current lands on HOME-01 (the level is locked)");
    await p.click('#left [data-level="2"]'); await p.waitForTimeout(60);
    check(!!(await p.$("#lockpanel")) && (await p.$$('#queue [data-t^="SO-"]')).length === 0, "office tickets: for a fresh student the small office's queue is the lock panel, no tickets");
    await ctx.close();
  }
  {
    const { p, ctx } = await page("SO-02", 2025);
    const q = await p.$$eval('#queue [data-t^="SO-"]', (l) => l.map((b) => b.dataset.t + ":" + (b.getAttribute("aria-disabled") === "true" ? "off" : "on")));
    check(q.join(",") === "SO-01:on,SO-02:on,SO-03:on,SO-04:on,SO-05:on,SO-06:on,SO-07:on,SO-08:on,SO-09:on,SO-10:on,SO-11:on,SO-12:on,SO-13:on,SO-14:on,SO-15:on", "office tickets: the level 2 queue lists SO-01 to SO-15 (" + q.join(",") + ")");
    check(/office network/.test(await p.$eval("#tk .from", (n) => n.textContent)) && /Tier 2 · Small office/.test(await p.$eval("#labtitle", (n) => n.textContent)), "office tickets: the card says office network, the title Tier 2 · Small office");
    check(!!(await p.$('#devtabs [data-d="msw"]')) && !!(await p.$('#devtabs [data-d="tech"]')), "office tickets: the managed switch and your laptop have device buttons");
    await ctx.close();
  }
}

/* the three views share the ticket; each left column opens tickets; the map and the plan open devices */
if (!process.env.ONLY) {
  let { p, ctx } = await page("HOME-03", 99, "lab-bench.html");
  check(/Lab HOME-03/.test(await p.$eval("#labtitle", (n) => n.textContent)), "bench: the bar names the lab");
  await p.click('.shelves [data-t="HOME-05"]'); await p.waitForTimeout(60);
  check((await T(p, () => window.__e4.T.def.id)) === "HOME-05", "bench: a shelf item opens its lab");
  check((await p.$$('.shelves [aria-disabled="true"]')).length >= 20, "bench: later labs shown, not openable");
  await p.goto(base + "service-map.html"); await p.waitForTimeout(350);
  check((await T(p, () => window.__e4.T.def.id)) === "HOME-05", "map: the same ticket follows to the next view");
  await p.click('#map [data-site="hq"]'); check(/Opens at Level 4/.test(await p.$eval("#card", (n) => n.textContent)), "map: a later site says when it opens");
  await p.click('#map [data-site="homes"]'); await p.click('#card [data-t="HOME-02"]'); await p.waitForTimeout(60);
  check((await T(p, () => window.__e4.T.def.id)) === "HOME-02", "map: a client-home ticket opens");
  await p.goto(base + "index.html"); await p.waitForTimeout(350);
  await p.click('#net [data-d="router"]'); check(/Terminal · Home router/.test(await p.$eval("#termtitle", (n) => n.textContent)), "desk: the map opens a device");
  await p.click("#vPhy"); await p.click('#plan [data-d="modem"]'); check(/Terminal · Cable modem/.test(await p.$eval("#termtitle", (n) => n.textContent)), "desk: the floor plan opens a device");
  await p.focus('#plan [data-d="printer"]'); await p.keyboard.press("Enter"); check(/Terminal · Printer/.test(await p.$eval("#termtitle", (n) => n.textContent)), "desk: Enter on the floor plan opens a device");
  await p.click("#dys"); await p.goto(base + "lab-bench.html"); await p.waitForTimeout(300);
  check(await p.evaluate(() => document.body.classList.contains("dys")), "easier reading stays on across pages");
  await p.click("#mHelp"); check(await p.evaluate(() => document.getElementById("help").open), "Help opens");
  await p.keyboard.press("Escape");
  /* the instructor's tools: behind the PIN, answers only in the instructor's window */
  await p.click("#mInst"); check(await p.$("#inst[open] #instpin") !== null, "instructor: asks for the PIN");
  await p.fill("#instpin", "1234"); await p.press("#instpin", "Enter"); check(/isn't right/.test(await p.$eval("#inst .msg", (n) => n.textContent).catch(() => "")), "instructor: a wrong PIN is refused");
  check(await p.$("#inst #instt") === null, "instructor: nothing unlocked by a wrong PIN");
  if (await p.$("#inst #instpin")) { await p.fill("#instpin", "3693"); await p.press("#instpin", "Enter"); }
  const unlockedNow = await p.$("#inst #instt") !== null; check(unlockedNow, "instructor: 3693 unlocks the tools");
  if (unlockedNow) {
  await p.selectOption("#instt", "HOME-12"); await p.fill("#insts", "4242"); await p.click('#inst button:text-is("Open it")'); await p.waitForTimeout(80);
  check((await T(p, () => window.__e4.T.def.id)) === "HOME-12" && (await T(p, () => window.__e4.T.seed)) === 4242, "instructor: the demo opens the chosen ticket on the chosen house");
  await p.click('#inst button:text-is("Show the fault and the fix")');
  const right = await T(p, () => window.__e4.T.opts.find((o) => o.right).text);
  check((await p.$eval("#inst .inst-out", (n) => n.textContent)).indexOf(right) >= 0, "instructor: the fault and the fix are shown");
  check((await p.$eval("#board", (n) => n.textContent)).indexOf("Right answer") < 0 && !(await T(p, () => window.__e4.T.diagnosed)), "instructor: nothing is revealed or answered on the student's board");
  await p.click('#inst button:text-is("Show all of Mason\'s help")'); check(/Rung 1[\s\S]*Rung 2[\s\S]*Rung 3/.test(await p.$eval("#inst .inst-out", (n) => n.textContent)), "instructor: every rung of help is shown");
  await p.click("#inst .x"); await p.reload(); await p.waitForTimeout(300); await p.click("#mInst");
  check(await p.$("#inst #instt") !== null, "instructor: stays unlocked in this tab after a reload");
  await p.click('#inst button:text-is("Lock the instructor tools")'); check(await p.$("#inst #instpin") !== null, "instructor: Lock asks for the PIN again");
  }
  const src = await p.evaluate(async () => (await (await fetch("js/desk/instructor.js")).text()) + (await (await fetch("js/desk/app.js")).text()));
  check(src.indexOf("3693") < 0, "instructor: the PIN itself isn't written in the page's code");
  await ctx.close();
}
/* build mode: each client job done entirely through the page, as a student would, on three houses */
async function bpage(job, seed) {
  const ctx = await B.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(([j, s]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-build-v1", JSON.stringify({ current: j, j: { [j]: { seed: s } }, done: {} })); sessionStorage.setItem("seeded", "1"); } }, [job, seed]);
  const p = await ctx.newPage(); p.setDefaultTimeout(5000); p.on("pageerror", (e) => errs.push("build " + job + ": " + e.message));
  await p.goto(base + "build.html"); await p.waitForTimeout(350);
  if (plant) await p.evaluate(plant);
  return { p, ctx };
}
const place = async (p, d, room) => { await p.selectOption("#bmDev", d); await p.selectOption("#bmRoom", room); await p.click("#bmPlace"); await p.waitForTimeout(40); };
const lay = async (p, a, ap, b, bp) => { await p.selectOption("#bmAd", a); await p.selectOption("#bmAp", ap); await p.selectOption("#bmBd", b); await p.selectOption("#bmBp", bp); await p.click("#bmLay"); await p.waitForTimeout(40); };
const checkJob = async (p) => { await p.click("#doCheck"); await p.waitForTimeout(40); return p.$eval("#check", (n) => n.textContent); };
const BJ = (p, f) => p.evaluate(f);
const J3crossed = (t) => /has power \(its light is on\), but no link/.test(t);
for (const job of ["J1", "J2", "J3", "J4", "J5", "J6", "J7", "J8", "J9", "J10", "FB"].filter((k) => !process.env.ONLY || k === process.env.ONLY)) for (const seed of [11, 2025, 777777, 3]) {
  if (seed === 3 && job !== "J3") continue;   /* house 3 has the camera with the heater: J3 is driven on both cameras */
  const { p, ctx } = await bpage(job, seed);
  const tag = "build " + job + " " + seed + ": ";
  try {
  check((await BJ(p, () => window.__e4b.T.seed)) === seed && (await BJ(p, () => window.__e4b.T.def.id)) === job, tag + "opens the job on the house asked for");
  const boxed = await BJ(p, () => Object.keys(window.__e4b.T.sim.d).filter((k) => window.__e4b.T.sim.d[k].boxed));
  check((await p.$$eval(".tray li", (l) => l.length)) === boxed.length, tag + "everything still boxed is in the tray, and nothing else");
  check(await p.$$eval("#devtabs [data-d]", (l, ids) => ids.every((id) => l.some((b) => b.dataset.d === id)), await BJ(p, () => Object.keys(window.__e4b.T.sim.d).filter((k) => !["isp", "wall"].includes(k) && !window.__e4b.T.sim.d[k].boxed))), tag + "every device out of its box has a device button");
  check(await p.$$eval("#bmDev option", (l, bx) => bx.every((id) => l.some((o) => o.value === id)), boxed), tag + "every boxed device can be placed from the form");
  check(boxed.every((k) => true) && !(await p.$('#plan [data-d="' + boxed[0] + '"]')) && !(await p.$('#devtabs [data-d="' + boxed[0] + '"]')), tag + "a boxed device is on neither the plan nor the device buttons");
  let t = await checkJob(p);
  check(/Check 1:/.test(t) && (await p.$$("#check .rq.bad")).length === (await BJ(p, () => window.__e4b.T.def.reqs.filter((q) => (window.__e4b.T.def.already || []).indexOf(q.id) < 0).length)), tag + "the first check finds the work to do (every line but those already met)");
  check(await p.$$eval("#check .rq.bad", (l) => l.every((x) => { const mk = x.querySelector(".mk"), st = getComputedStyle(mk); return /Not met yet/.test(x.textContent) && /✕/.test(mk.textContent) && st.display !== "none" && st.visibility !== "hidden" && parseFloat(st.fontSize) >= 14 && getComputedStyle(x).boxShadow !== "none"; })), tag + "each unmet line is marked three ways (the words, the cross, the inset rule), never colour alone");
  if (job === "J1") {
    await place(p, "router", "living"); await place(p, "pc", "office"); await place(p, "tv", "living");
    check(!!(await p.$('#plan [data-d="router"]')) && !!(await p.$('#devtabs [data-d="pc"]')), tag + "placed devices appear on the plan and as device buttons");
    /* undo takes back the last change */
    await place(p, "tv", "garage").catch(() => {}); check(/Not placed/.test(await p.$eval("#bmPmsg", (n) => n.textContent).catch(() => "")) || (await BJ(p, () => window.__e4b.T.sim.net.rooms.tv)) === "garage", tag + "moving an uncabled device works");
    await p.click("#bmUndo"); await p.waitForTimeout(40);
    check((await BJ(p, () => window.__e4b.T.sim.net.rooms.tv)) === "living" && /Undone/.test(await p.$eval("#bmUmsg", (n) => n.textContent)), tag + "Undo takes back the last change");
    /* the tempting mistake: the modem into a LAN port, and Mason's rungs on it */
    await lay(p, "modem", "ETH", "router", "LAN 1");
    check(/3 m/.test(await p.$eval("#runs", (n) => n.textContent)), tag + "the run's length shows in the Cable runs list");
    await checkJob(p);   /* the router line's second failing check (the first was at the start, the router still boxed) */
    check((await BJ(p, () => window.__e4b.T.fails.router)) === 2 && !(await p.$("#check .mason-says")), tag + "no help for two failing checks");
    t = await checkJob(p); check(/Mason \(where to look\)/.test(t), tag + "rung 1 at the third failing check");
    t = await checkJob(p); check(/Mason \(the principle\)/.test(t), tag + "rung 2 at the fourth");
    t = await checkJob(p); check(/It's one of these two: .+, or .+\./.test(t) && (await p.$$("#check .struck li")).length >= 1, tag + "rung 3 narrows to two, with what it ruled out");
    t = await checkJob(p); check(/It's one of these two/.test(t), tag + "rung 3 stays, check after check");
    await p.click('#runs tr:has-text("Cable modem, ETHERNET") button:text-is("Pull")'); await p.waitForTimeout(40);
    check(!(await BJ(p, () => window.__e4b.T.sim.cableAt("modem", "ETH"))), tag + "Pull takes the cable out");
    await lay(p, "modem", "ETH", "router", "WAN"); await lay(p, "router", "LAN 1", "pc", "NIC"); await lay(p, "router", "LAN 2", "tv", "LAN");
    check(/14 m, the living room to the office/.test(await p.$eval("#runs", (n) => n.textContent)), tag + "the run to the office is 14 m, through the wall");
    /* the router fresh from its box: rename, new Wi-Fi password, new admin password */
    const home = await BJ(p, () => window.__e4b.T.v.home);
    await dev(p, "router"); await tab(p, "Wi-Fi");
    check(/printed on the router's label/.test(await p.$eval(".pane", (n) => n.textContent)), tag + "the Wi-Fi page says the password is the label's");
    await p.fill('.devform input[name="ssid"]', home); await p.click('.devform button:text-is("Save")'); await p.waitForTimeout(40);
    await p.click('.pane button:text-is("Change the Wi-Fi password")'); await p.waitForTimeout(40);
    await tab(p, "Status"); await p.click('.pane button:text-is("Change the admin password")'); await p.waitForTimeout(40);
    check(/Changed from the factory one/.test(await p.$eval(".pane", (n) => n.textContent)), tag + "the Status page says the admin password changed");
    await dev(p, "phone"); await p.click('.pane button:text-is("Join ' + home + ' (enter the password)")'); await p.waitForTimeout(40);
    check(/Joined/.test(await p.$eval(".pane", (n) => n.textContent)), tag + "the phone joins by name");
    await dev(p, "laptop"); await tab(p, "Wi-Fi"); await p.click('.pane li:has-text("' + home + '") button:text-is("Connect (enter the password)")'); await p.waitForTimeout(40);
  } else if (job === "J3") {
    const heat = await BJ(p, () => window.__e4b.T.v.heat), inj = heat ? "injector2" : "injector";
    check(/In the van: a single-port 802\.3af PoE injector \(15\.4 W out\) and a dual-port 802\.3at PoE\+ injector \(30 W out per port\)/.test(await p.$eval("#bm", (n) => n.textContent)), tag + "the limits name both injectors' budgets");
    if (heat) {   /* the 802.3af one first: it starts, on limited power, and the camera's own page says so */
      await place(p, "injector", "office"); await place(p, "camera", "porch");
      await lay(p, "switch", "4", "injector", "DATA IN"); await lay(p, "injector", "PoE OUT", "camera", "LAN");
      await dev(p, "camera"); check(/limited\. The heater and night vision are off/.test(await p.$eval(".pane", (n) => n.textContent)), tag + "the camera's page says its power is limited");
      t = await checkJob(p); check(/its power is limited/.test(t), tag + "the check says the power is limited");
      await p.click('#runs tr:has-text("DATA + POWER OUT") button:text-is("Pull")'); await p.waitForTimeout(40);
      await p.click('#runs tr:has-text("DATA IN") button:text-is("Pull")'); await p.waitForTimeout(40);
      await place(p, "injector2", "office");
      /* the dual-port PoE+ injector, as photographed: its four ports by their printed names; this time its second pair */
      await p.selectOption("#bmAd", "injector2"); const ports = await p.$$eval("#bmAp option", (l) => l.map((o) => o.textContent.replace(/ \(in use\)$/, "")));
      check(JSON.stringify(ports) === JSON.stringify(["DATA IN 1", "DATA IN 2", "DATA + POWER OUT 1", "DATA + POWER OUT 2"]), tag + "the lay form lists the PoE+ injector's ports by their printed names " + JSON.stringify(ports));
      await lay(p, "switch", "4", "injector2", "DATA IN 2"); await lay(p, "injector2", "PoE OUT", "camera", "LAN");
      t = await checkJob(p); check(J3crossed(t), tag + "crossed pairs: the camera has power from output 1 but no link, as the check says");
      check(/No link/.test(await p.$eval('#runs tr:has-text("Camera")', (n) => n.textContent)), tag + "crossed pairs: the runs table shows the camera's run with no link (the data never crosses pairs)");
      await p.click('#runs tr:has-text("DATA + POWER OUT 1") button:text-is("Pull")'); await p.waitForTimeout(40);
      await lay(p, "injector2", "PoE OUT 2", "camera", "LAN");
      check(/DATA \+ POWER OUT 2/.test(await p.$eval("#runs", (n) => n.textContent)), tag + "the runs table names the output by its printed name");
    } else {
      await place(p, inj, "office"); await place(p, "camera", "porch");
      await lay(p, "switch", "4", inj, "DATA IN"); await lay(p, inj, "PoE OUT", "camera", "LAN");
    }
    check(/38 m, the office to by the front door/.test(await p.$eval("#runs", (n) => n.textContent)), tag + "the run to the porch is 38 m");
    await dev(p, "camera"); check(/Power(PoE\+ \(802\.3at\)|PoE \(802\.3af\)): full/.test((await p.$eval(".pane", (n) => n.textContent)).replace(/\s+/g, "")) || /: full/.test(await p.$eval(".pane", (n) => n.textContent)), tag + "the camera's page says full power");
    const cam = await BJ(p, () => window.__e4b.T.sim.addr("camera").ip);
    await dev(p, "router"); await tab(p, "DHCP clients"); await p.click('.pane button[aria-label^="Reserve ' + cam + '"]'); await p.waitForTimeout(40);
    await tab(p, "Port forwarding");
    await p.fill('.devform input[name="name"]', "Camera"); await p.fill('.devform input[name="ext"]', "8443"); await p.fill('.devform input[name="ip"]', cam); await p.fill('.devform input[name="port"]', "443");
    await p.click('.devform button:text-is("Add")'); await p.waitForTimeout(40);
    check(/Added: outside port 8443 goes to/.test(await p.$eval(".pane", (n) => n.textContent)), tag + "the router says the forward was added");
    await dev(p, "phone"); await p.click('.pane button:text-is("Open the camera app on mobile data")'); await p.waitForTimeout(40);
    check(/Camera app: connected/.test(await p.$eval(".pane", (n) => n.textContent)), tag + "the camera app connects from outside");
  } else if (job === "J5") {
    const g = (await BJ(p, () => window.__e4b.T.v.surname)).toUpperCase() + "-GUEST", home = await BJ(p, () => window.__e4b.T.sim.d.router.wifi.ssid);
    await dev(p, "router"); await tab(p, "Wi-Fi");
    await p.check('.devform input[name="gon"][value="1"]'); await p.fill('.devform input[name="gssid"]', g);
    check(await p.isChecked('.devform input[name="isolate"]'), tag + "the guest network keeps guests off the home network by default");
    await p.click('.devform button:text-is("Save the guest network")'); await p.waitForTimeout(40);
    check(/No password yet: anyone in range can join/.test(await p.$eval(".pane", (n) => n.textContent)), tag + "the router says the new guest network has no password yet");
    await p.click('.pane button:text-is("Set a guest password")'); await p.waitForTimeout(40);
    await dev(p, "guest"); await p.click('.pane button:text-is("Join ' + home + ' (enter the password)")'); await p.waitForTimeout(40);   /* the old habit: the home password */
    t = await checkJob(p); check(/the house's own network/.test(t), tag + "the check says the visitor is on the house's own network");
    await dev(p, "guest"); await p.click('.pane li:has-text("' + g + '") button:text-is("Connect (enter the password)")'); await p.waitForTimeout(40);
    check(/connected, address 192\.168\.\d+\.\d+/.test(await p.$eval(".pane", (n) => n.textContent)), tag + "the visitor's phone joins the guest network");
  } else if (job === "FB") {
    check(/every device in the van/i.test(await p.$eval("#bm", (n) => n.textContent)) && (await p.$$(".tray li")).length >= 8, tag + "free build: everything is in the van");
    const home = await BJ(p, () => window.__e4b.T.v.home);
    await place(p, "router", "living"); await place(p, "tv", "living");
    await lay(p, "modem", "ETH", "router", "WAN"); await lay(p, "router", "LAN 2", "tv", "LAN");
    await dev(p, "router"); await tab(p, "Wi-Fi"); await p.fill('.devform input[name="ssid"]', home); await p.click('.devform button:text-is("Save")'); await p.waitForTimeout(40);
    await p.click('.pane button:text-is("Change the Wi-Fi password")'); await p.waitForTimeout(40);
    await tab(p, "Status"); await p.click('.pane button:text-is("Change the admin password")'); await p.waitForTimeout(40);
    await dev(p, "phone"); await p.click('.pane button:text-is("Join ' + home + ' (enter the password)")'); await p.waitForTimeout(40);
    await dev(p, "laptop"); await tab(p, "Wi-Fi"); await p.click('.pane li:has-text("' + home + '") button:text-is("Connect (enter the password)")'); await p.waitForTimeout(40);
  } else if (job === "J6") {
    const home = await BJ(p, () => window.__e4b.T.v.home);
    await place(p, "router", "living");
    await lay(p, "modem", "ETH", "router", "WAN"); await lay(p, "router", "LAN 1", "switch", "1"); await lay(p, "router", "LAN 2", "tv", "LAN");
    await dev(p, "phone"); check(/Not connected/.test(await p.$eval(".pane", (n) => n.textContent)), tag + "the phone waits for its network");
    await dev(p, "router"); await tab(p, "Wi-Fi"); await p.fill('.devform input[name="ssid"]', home); await p.click('.devform button:text-is("Save")'); await p.waitForTimeout(40);
    await p.click('.pane button:text-is("Type in the client\'s Wi-Fi password (the card on the fridge)")'); await p.waitForTimeout(40);
    await tab(p, "Status"); await p.click('.pane button:text-is("Change the admin password")'); await p.waitForTimeout(40);
    await dev(p, "phone"); check(/Connected to /.test(await p.$eval(".pane", (n) => n.textContent)), tag + "the phone rejoins by itself, untouched");
  } else if (job === "J7") {
    const r = await BJ(p, () => ({ ip: window.__e4b.T.sim.d.router.lan.ip, mask: window.__e4b.T.sim.d.router.lan.mask, pre: window.__e4b.T.sim.net.prefix }));
    await dev(p, "pc"); await tab(p, "Network settings");
    await p.check('.devform input[name="mode"][value="static"]'); await p.fill('.devform input[name="ip"]', r.pre + ".6"); await p.fill('.devform input[name="mask"]', r.mask); await p.fill('.devform input[name="gw"]', r.ip);
    await p.fill('.devform input[name="dns1"]', ""); await p.click('.devform button:text-is("Save")'); await p.waitForTimeout(40);   /* the classic: no DNS */
    t = await checkJob(p); check(/names don't look up/.test(t), tag + "a fixed address with no DNS: the check says names don't look up");
    await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ping rafiki-it.example"); check(/could not find host/.test(await term(p)), tag + "ping by name fails on the PC itself");
    await tab(p, "Network settings"); await p.fill('.devform input[name="dns1"]', r.ip); await p.click('.devform button:text-is("Save")'); await p.waitForTimeout(40);
  } else if (job === "J8") {
    const v = await BJ(p, () => window.__e4b.T.v);
    await dev(p, "laptop"); await type(p, "netsh wlan show networks mode=bssid");
    check(/Parker-Family/.test(await term(p)), tag + "the survey on the old laptop lists the neighbours heard in the kitchen");
    await dev(p, "router"); await tab(p, "Wi-Fi"); await p.selectOption('.devform select[name="ch24"]', String(v.clear)); await p.click('.devform button:text-is("Save")'); await p.waitForTimeout(40);
    await dev(p, "laptop"); await tab(p, "Wi-Fi"); await p.click('.pane button:text-is("Run a speed test")'); await p.waitForTimeout(40);
    const sp = +((await p.$eval(".pane", (n) => n.textContent)).match(/Speed test: (\d+) Mb\/s/) || [0, 0])[1];
    check(sp >= 50, tag + "the old laptop's own speed test is fast now (" + sp + " Mb/s)");
  } else if (job === "J9") {
    await dev(p, "laptop"); await type(p, "netsh wlan show drivers"); check(!/WPA3/.test(await term(p)), tag + "the old laptop's adapter lists no WPA3");
    await dev(p, "router"); await tab(p, "Wi-Fi"); await p.selectOption('.devform select[name="sec"]', "WPA3-Personal"); await p.click('.devform button:text-is("Save")'); await p.waitForTimeout(40);
    t = await checkJob(p); check(/Laptop: can't connect/.test(t), tag + "WPA3 only: the check says the old laptop can't connect");
    await dev(p, "router"); await tab(p, "Wi-Fi"); await p.selectOption('.devform select[name="sec"]', "WPA2/WPA3-Personal"); await p.click('.devform button:text-is("Save")'); await p.waitForTimeout(40);
  } else if (job === "J10") {
    await p.click('#runs tr:has-text("Smart TV, LAN") button:text-is("Pull")'); await p.waitForTimeout(40);
    await place(p, "tv", "upstairs"); await lay(p, "router", "LAN 2", "tv", "LAN");
    await p.click('#runs tr:has-text("Printer, NETWORK") button:text-is("Pull")'); await p.waitForTimeout(40);
    await place(p, "printer", "kitchen"); await lay(p, "router", "LAN 3", "printer", "NET");
    check(/15 m, the living room to the back bedroom upstairs/.test(await p.$eval("#runs", (n) => n.textContent)), tag + "the TV's new run is 15 m upstairs");
    await dev(p, "pc"); await tab(p, "Printers"); await p.click('.pane button:text-is("Print a test page")'); await p.waitForTimeout(40);
    check(/it printed/.test(await p.$eval(".pane .res", (n) => n.textContent)), tag + "the office PC still prints to the moved printer");
  } else if (job === "J4") {
    await place(p, "mesh", "upstairs");   /* in the dead spot itself: its link back is lost */
    t = await checkJob(p); check(/status ring is amber/.test(t) && /44%/.test(t), tag + "in the bedroom with no way back: the check says the ring is amber and the laptop still gets 44%");
    await dev(p, "mesh"); check(/too weak to hold a link/.test(await p.$eval(".pane", (n) => n.textContent)), tag + "the mesh node's page says its backhaul is too weak");
    await place(p, "mesh", "landing");
    await dev(p, "laptop"); await tab(p, "Wi-Fi"); check(/5 GHz/.test(await p.$eval(".pane", (n) => n.textContent)), tag + "the laptop moves to the mesh node's 5 GHz");
  } else {
    await place(p, "switch", "office"); await place(p, "pc", "office"); await place(p, "printer", "office");
    await lay(p, "router", "LAN 1", "switch", "1"); await lay(p, "switch", "2", "pc", "NIC"); await lay(p, "switch", "3", "printer", "NET");
    const pre = await BJ(p, () => window.__e4b.T.sim.net.prefix), r = await BJ(p, () => ({ ip: window.__e4b.T.sim.d.router.lan.ip, mask: window.__e4b.T.sim.d.router.lan.mask, end: window.__e4b.T.sim.d.router.dhcp.end }));
    /* first a fixed address inside the range: it prints today, and the check says why that won't do */
    const inside = pre + "." + (+r.end.split(".")[3] - 2);
    await dev(p, "printer"); await p.check('.devform input[name="mode"][value="static"]'); await p.fill('.devform input[name="ip"]', inside); await p.fill('.devform input[name="mask"]', r.mask); await p.fill('.devform input[name="gw"]', r.ip); await p.click('.devform button:text-is("Save")'); await p.waitForTimeout(40);
    await dev(p, "pc"); await tab(p, "Printers"); await p.fill('.devform input[name="port"]', inside); await p.click('.devform button:text-is("Save")'); await p.waitForTimeout(40);
    await p.click('.pane button:text-is("Print a test page")'); check(/it printed/.test(await p.$eval(".pane .res", (n) => n.textContent)), tag + "a printer inside the range prints today");
    t = await checkJob(p); check(/one the router can also hand to another device/.test(t), tag + "the check says the address is one the router hands out");
    await dev(p, "printer"); await p.fill('.devform input[name="ip"]', pre + ".5"); await p.click('.devform button:text-is("Save")'); await p.waitForTimeout(40);
    await dev(p, "pc"); await tab(p, "Printers"); await p.fill('.devform input[name="port"]', pre + ".5"); await p.click('.devform button:text-is("Save")'); await p.waitForTimeout(40);
  }
  t = await checkJob(p);
  const n = await BJ(p, () => window.__e4b.T.def.reqs.length);
  check(new RegExp(n + " of " + n + " met").test(t) && /Job .* done/.test(t), tag + "every line met through the page (" + (t.match(/\d+ of \d+ met/) || ["?"])[0] + ")");
  check(await p.$$eval("#check .rq.ok", (l) => l.every((x) => /Met/.test(x.textContent) && /✓/.test(x.querySelector(".mk").textContent))), tag + "met lines marked with the tick and the word too");
  await p.reload(); await p.waitForTimeout(350);
  check(/Job .* done/.test(await p.$eval("#check", (n) => n.textContent)) && /done 1×|Done 1×/.test(await p.$eval('#queue [data-j="' + job + '"]', (n) => n.textContent)), tag + "still done after a reload, and the list counts it");
  await p.click("#vLog"); check(!!(await p.$('#net [data-d="router"]')) && !(await p.$("#net[hidden]")), tag + "the logical view shows what was built");
  const s1 = await BJ(p, () => window.__e4b.T.seed);
  await p.click('#check button:text-is("Start this job again (a new house)")'); await p.waitForTimeout(80);
  check((await BJ(p, () => window.__e4b.T.seed)) !== s1 && !(await BJ(p, () => window.__e4b.T.done)), tag + "a fresh house, the work to do again");
  } catch (e) { check(false, tag + "stopped: " + String(e.message).split("\n")[0]); }   /* a broken page fails by name; it doesn't stop the run */
  await ctx.close();
}
if (!process.env.ONLY) {
  const { p, ctx } = await bpage("J1", 4242);
  await p.click('.chrome nav[aria-label="Mode"] a:text-is("Tickets")'); await p.waitForTimeout(300);
  check(/index\.html$/.test(p.url()) && !!(await p.$("#board")), "mode: Tickets goes to the Ticket Desk");
  await p.click('.chrome nav[aria-label="Mode"] a:text-is("Build")'); await p.waitForTimeout(300);
  check(/build\.html$/.test(p.url()) && (await BJ(p, () => window.__e4b.T.seed)) === 4242, "mode: Build comes back to the same job");
  await p.click("#mInst"); await p.fill("#instpin", "3693"); await p.press("#instpin", "Enter");
  check(await p.$("#inst #instt") !== null, "build instructor: 3693 unlocks");
  if (await p.$("#inst #instt")) {
    await p.selectOption("#instt", "J2"); await p.fill("#insts", "5150"); await p.click('#inst button:text-is("Open it")'); await p.waitForTimeout(80);
    check((await BJ(p, () => window.__e4b.T.def.id)) === "J2" && (await BJ(p, () => window.__e4b.T.seed)) === 5150, "build instructor: the demo opens the chosen job on the chosen house");
    await p.click('#inst button:text-is("Show one way to do the job")');
    check(/Place the switch/.test(await p.$eval("#inst .inst-out", (n) => n.textContent)) && !/Place the switch/.test(await p.$eval("main", (n) => n.textContent)), "build instructor: one way to do it, in the instructor's window only");
    await p.click('#inst button:text-is("Show all of Mason\'s help")'); check(/Rung 1[\s\S]*Rung 2/.test(await p.$eval("#inst .inst-out", (n) => n.textContent)), "build instructor: all of Mason's help");
  }
  const src = await p.evaluate(async () => (await (await fetch("js/build/app.js")).text()) + (await (await fetch("js/build/jobs.js")).text()));
  check(src.indexOf("3693") < 0, "build: the PIN isn't written in the page's code");
  await ctx.close();
}

/* Level 2, the small office: the lock between the levels (a fresh student, one who has finished Home, the instructor),
   then SO-J1 and SO-J2 done entirely through the page: the console cable, the serial terminal, ? and Tab, the password
   prompts hidden, the switch's command line, the old switch's cables pulled, SSH from the front desk PC */
if (!process.env.ONLY || process.env.ONLY === "office") {
  const { LEVELS } = await import("../js/desk/levels.js");
  const homeDone = { t: { solved: Object.fromEntries(LEVELS[0].tickets.map((id) => [id, 1])) }, j: Object.fromEntries(LEVELS[0].jobs.map((id) => [id, 1])) };
  async function opage(file, o) {
    const ctx = await B.newContext({ viewport: { width: 1400, height: 900 } });
    await ctx.addInitScript((o) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-network-v1", JSON.stringify(Object.assign({ t: {}, solved: {} }, o.net || {}))); localStorage.setItem("e4-build-v1", JSON.stringify(o.build || { j: {}, done: {} })); sessionStorage.setItem("seeded", "1"); } }, o);
    const p = await ctx.newPage(); p.setDefaultTimeout(5000); p.on("pageerror", (e) => errs.push("office " + file + ": " + e.message));
    await p.goto(base + file); await p.waitForTimeout(350);
    if (plant) await p.evaluate(plant);
    return { p, ctx };
  }
  const lv = (p, n) => p.$eval('#left [data-level="' + n + '"]', (b) => ({ text: b.textContent, locked: b.parentNode.classList.contains("locked"), dashed: getComputedStyle(b).borderStyle === "dashed", grey: getComputedStyle(b).backgroundColor === "rgb(238, 240, 245)", lock: !!b.querySelector('.lk[aria-hidden="true"]') }));
  const threeWays = (L) => L.locked && L.lock && /Locked: opens when Home is finished/.test(L.text) && L.dashed && L.grey;
  /* a fresh student: the small office is locked, marked three ways, and nothing opens it */
  for (const file of ["build.html", "build.html#job=SO-J1", "index.html"]) {
    const { p, ctx } = await opage(file, {}); const tag = "levels, fresh student, " + file + ": ";
    try {
      check(threeWays(await lv(p, 2)), tag + "Level 2 is locked, marked three ways (the lock and its words, the dashed edge, the grey ground)");
      check(!(await lv(p, 1)).locked && /0 of 15 tickets, 0 of 10 work orders done/.test((await lv(p, 1)).text), tag + "Level 1 is open and counts both tickets and work orders");
      if (file !== "index.html") check((await BJ(p, () => window.__e4b.T.def.id)) === "J1", tag + "a locked level's job never opens (back to J1)");
      await p.click('#left [data-level="2"]'); await p.waitForTimeout(60);
      const lp = await p.$eval("#lockpanel", (n) => n.textContent).catch(() => "");
      check(/Finish the home level to open the small office/.test(lp) && /15 tickets \(on the Ticket Desk\) and 10 work orders \(in Build\) to go/.test(lp) && /HOME-01/.test(lp) && /J10/.test(lp), tag + "the lock panel says what's left, item by item");
      if (file !== "index.html") {
        check(await p.$$eval("#queue button.locked", (l, n) => l.length === n && l.every((b) => b.getAttribute("aria-disabled") === "true" && /Locked/.test(b.textContent)), LEVELS[1].jobs.length), tag + "the small office's " + LEVELS[1].jobs.length + " work orders are listed, locked");
        await p.click('#queue [data-j="SO-J1"]').catch(() => {}); await p.waitForTimeout(60);
        check((await BJ(p, () => window.__e4b.T.def.id)) === "J1", tag + "clicking a locked work order opens nothing");
      } else check(!(await p.$('#left a[href^="build.html#job="]')), tag + "the Ticket Desk links no locked work orders");
    } catch (e) { check(false, tag + "stopped: " + String(e.message).split("\n")[0]); }
    await ctx.close();
  }
  /* the instructor's PIN opens every level for the tab; "every level on this computer" outlasts the PIN */
  {
    const { p, ctx } = await opage("build.html", {}); const tag = "levels, instructor: ";
    try {
      await p.click("#mInst"); await p.fill("#instpin", "3693"); await p.press("#instpin", "Enter"); await p.waitForTimeout(60);
      check(!(await lv(p, 2)).locked && /Opened by your instructor/.test((await lv(p, 2)).text), tag + "3693 opens Level 2, and it says the instructor opened it");
      await p.click('#inst button:text-is("Lock the instructor tools")'); await p.waitForTimeout(60);
      check(threeWays(await lv(p, 2)), tag + "locking the tools locks the level again");
      await p.fill("#instpin", "3693"); await p.press("#instpin", "Enter"); await p.waitForTimeout(60);
      await p.click("#instLevels"); await p.waitForTimeout(40);
      check(/Lock the levels again/.test(await p.$eval("#instLevels", (n) => n.textContent)), tag + "the button turns into Lock the levels again");
      await p.click('#inst button:text-is("Lock the instructor tools")'); await p.waitForTimeout(60);
      check(!(await lv(p, 2)).locked, tag + "every level stays open on this computer after the tools are locked");
      await p.reload(); await p.waitForTimeout(350);
      check(!(await lv(p, 2)).locked, tag + "and after a reload");
      await p.click("#mInst"); await p.fill("#instpin", "3693"); await p.press("#instpin", "Enter"); await p.waitForTimeout(60);
      await p.click("#instLevels"); await p.click('#inst button:text-is("Lock the instructor tools")'); await p.waitForTimeout(60);
      check(threeWays(await lv(p, 2)), tag + "Lock the levels again locks them on this computer");
      const src = await p.evaluate(async () => { let t = ""; for (const f of ["js/desk/levels.js", "js/desk/levelsui.js", "js/desk/instructor.js", "js/build/app.js", "js/build/office.js"]) t += await (await fetch(f)).text(); return t; });
      check(src.indexOf("3693") < 0, tag + "the PIN isn't written in the code");
    } catch (e) { check(false, tag + "stopped: " + String(e.message).split("\n")[0]); }
    await ctx.close();
  }
  /* Home finished: the small office opens by itself, on both pages */
  {
    const { p, ctx } = await opage("index.html", { net: homeDone.t, build: { j: {}, done: homeDone.j } }); const tag = "levels, Home finished: ";
    try {
      check(/✓ Finished: 15 of 15 tickets, 10 of 10 work orders/.test((await lv(p, 1)).text) && !(await lv(p, 2)).locked, tag + "Level 1 finished, Level 2 open, on the Ticket Desk");
      await p.click('#left [data-level="2"]'); await p.waitForTimeout(60);
      check((await p.$$('#left a[href="build.html#job=SO-J1"]')).length === 1, tag + "the desk links the small office's work orders into Build");
      await p.click('#left a[href="build.html#job=SO-J1"]'); await p.waitForTimeout(400);
      check((await BJ(p, () => window.__e4b.T.def.id)) === "SO-J1" && /Level 2 · Small office/.test(await p.$eval("#labtitle", (n) => n.textContent)), tag + "the link opens SO-J1 in Build, titled Level 2 · Small office");
    } catch (e) { check(false, tag + "stopped: " + String(e.message).split("\n")[0]); }
    await ctx.close();
  }
  const ser = async (p, line) => { await type(p, line); };
  const promptNow = (p) => p.$eval(".term .prompt", (n) => n.textContent);
  for (const job of ["SO-J1", "SO-J2", "SO-J3", "SO-J4", "SO-J5", "SO-J6", "SO-J7", "SO-J8", "SO-J9", "SO-J10"].filter((k) => !process.env.JOB || k === process.env.JOB)) for (const seed of [11, 2025, 777777]) {
    const { p, ctx } = await opage("build.html", { net: homeDone.t, build: { current: job, j: { [job]: { seed } }, done: homeDone.j } });
    const tag = "office " + job + " " + seed + ": ";
    try {
      const plan = await BJ(p, () => window.__e4b.T.sim.net.plan);
      check((await BJ(p, () => window.__e4b.T.def.id)) === job && (await BJ(p, () => window.__e4b.T.seed)) === seed, tag + "opens the job on the office asked for");
      check(await p.$$eval("#bmRoom option", (l) => l.map((o) => o.textContent).join("|")) === "Network closet|Front desk|Open-plan office|Manager's office|Meeting room", tag + "the Place form lists the office's rooms");
      let t = await checkJob(p);
      check((await p.$$("#check .rq.bad")).length === (await BJ(p, () => window.__e4b.T.def.reqs.filter((q) => (window.__e4b.T.def.already || []).indexOf(q.id) < 0).length)), tag + "the first check finds the work to do");
      await dev(p, "tech");
      check(/Serial terminal · COM3/.test(await term(p)), tag + "your laptop opens on its serial terminal");
      if (job === "SO-J1") {
        await ser(p, ""); check(/Nothing answers on COM3/.test(await term(p)), tag + "with no console cable, nothing answers");
        await place(p, "msw", "front"); check(/Not placed: The managed switch goes in the closet rack/.test(await p.$eval("#bmPmsg", (n) => n.textContent)), tag + "the managed switch has a fixed place in the rack");
        await place(p, "msw", "closet");
        check(!!(await p.$('#plan [data-d="msw"]')) && !!(await p.$('#devtabs [data-d="msw"]')), tag + "unboxed: on the plan and a device button");
        await lay(p, "tech", "USB-C", "msw", "CONSOLE");
        check(/Console: connected/.test(await p.$eval("#runs", (n) => n.textContent)) && /1\.8 m/.test(await p.$eval("#runs", (n) => n.textContent)), tag + "the console cable is in the runs table, 1.8 m, connected");
        check(!!(await p.$("#plan path.run-con")), tag + "the console cable is drawn on the plan as its own kind of run");
        await dev(p, "tech"); await ser(p, "");
        check((await promptNow(p)) === "Switch>", tag + "Enter wakes the console: Switch>");
        await p.fill(".term .cmdin", "en"); await p.press(".term .cmdin", "Tab");
        check((await p.inputValue(".term .cmdin")) === "enable ", tag + "Tab completes en to enable");
        await p.fill(".term .cmdin", ""); await p.press(".term .cmdin", "?"); await p.waitForTimeout(40);
        check(/enable/.test(await term(p)) && /show/.test(await term(p)) && (await p.inputValue(".term .cmdin")) === "", tag + "? lists the commands at once, without Enter");
        await ser(p, "enable"); check((await promptNow(p)) === "Switch#", tag + "enable: Switch#");
        await ser(p, "configure terminal"); await ser(p, "hostname " + plan.hostname);
        check((await promptNow(p)) === plan.hostname + "(config)#", tag + "the prompt takes the new name in global configuration");
        await p.click("#bmUndo"); await p.waitForTimeout(60);
        check((await BJ(p, () => window.__e4b.T.sim.d.msw.sw.hostname)) === "Switch" && /typed on the switch's command line/.test(await p.$eval("#bmUmsg", (n) => n.textContent)), tag + "Undo takes back the last line typed on the switch");
        await dev(p, "tech"); await ser(p, "");
        await ser(p, "enable"); await ser(p, "configure terminal"); await ser(p, "hostname " + plan.hostname); await ser(p, "enable secret " + plan.secret);
        await ser(p, "line console 0"); check((await promptNow(p)) === plan.hostname + "(config-line)#", tag + "line configuration mode in the prompt");
        await ser(p, "password " + plan.console); await ser(p, "login"); await ser(p, "end");
        t = await checkJob(p); check(/survive|saved|startup/i.test(t) && (await p.$$("#check .rq.bad")).length === 1, tag + "configured but not saved: only the saving line is not met");
        await dev(p, "tech"); await ser(p, "copy running-config startup-config"); await ser(p, "");
        check(/\[OK\]/.test(await term(p)), tag + "copy running-config startup-config: [OK]");
        /* the console now asks for its password: hidden as it's typed, and never in the scrollback */
        await ser(p, "disable"); await ser(p, "exit"); await ser(p, "");
        const before = (await term(p)).length;   /* the password was typed in the open as a config line: from here on it must never show */
        check((await p.getAttribute(".term .cmdin", "type")) === "password" && (await promptNow(p)) === "Password: ", tag + "the console asks for its password, and the box hides what's typed");
        await ser(p, "wrong-one"); await ser(p, plan.console);
        check((await promptNow(p)) === plan.hostname + ">" && (await term(p)).slice(before).indexOf(plan.console) < 0 && (await term(p)).indexOf("wrong-one") < 0, tag + "logged in; a password typed at a prompt never shows in the scrollback");
        await ser(p, "enable"); check((await p.getAttribute(".term .cmdin", "type")) === "password", tag + "enable asks for the secret, hidden");
        await ser(p, plan.secret); check((await promptNow(p)) === plan.hostname + "#", tag + "the secret opens privileged mode");
        await dev(p, "msw"); check(/SYSTEM/.test(await p.$eval(".pane", (n) => n.textContent)) && /CONSOLE|console cable/.test(await p.$eval(".pane", (n) => n.textContent)), tag + "the switch's Lights tab shows its own lights and the console cable");
      } else if (job === "SO-J4") {
        /* the IPAM sheet, by hand: one block too small first (the row marked, the field flagged, the reason given), Undo, then a plan that fits */
        const groups = plan.ipam.groups, good = await BJ(p, () => window.__e4b.T.def.solve(window.__e4b.T.v)[0].rows);
        const F6 = ["net", "mask", "first", "last", "bc", "gw"];
        const fill = async (rows) => { for (let i = 0; i < rows.length; i++) for (const f of F6) await p.fill("#ipam" + i + f, rows[i][f]); await p.click("#ipamSave"); await p.waitForTimeout(60); };
        check((await p.$$("#ipam fieldset.blk")).length === groups.length && /needs \d+ addresses/.test(await p.$eval("#ipam legend", (n) => n.textContent)), tag + "the IPAM sheet has a card per group, each saying how many addresses it needs");
        const st = groups.findIndex((g) => g[0] === "Staff"), wrong = good.map((r) => Object.assign({}, r));
        wrong[st].mask = "/" + (+good[st].mask.slice(1) + 1);
        await fill(wrong);
        const row = await p.$eval("#ipamRow" + st, (n) => ({ cls: n.className, text: n.textContent, bad: n.querySelector("#ipam" + n.id.slice(7) + "mask").getAttribute("aria-invalid") }));
        check(/badrow/.test(row.cls) && row.bad === "true" && /usable addresses/.test(row.text) && /✕/.test(row.text), tag + "a block too small: its row marked (edge, inset rule, the words), its mask flagged, the reason given");
        check(!new RegExp("/" + good[st].mask.slice(1) + "\\b").test(row.text), tag + "the sheet never says the right mask");
        t = await checkJob(p); check(/fewer usable addresses/.test(t), tag + "the check says a block is too small");
        await p.click("#bmUndo"); await p.waitForTimeout(60);
        check((await p.inputValue("#ipam0net")) === "" && /saving the IPAM sheet/.test(await p.$eval("#bmUmsg", (n) => n.textContent)), tag + "Undo takes back saving the sheet");
        await fill(good);
        check((await p.$$("#ipam fieldset.goodrow")).length === groups.length && new RegExp(groups.length + " of " + groups.length + " blocks check out").test(await p.$eval("#ipamSum", (n) => n.textContent)), tag + "every block checks out");
      } else if (job === "SO-J5") {
        /* the banner, saved first; a spare port opened but not saved; the laptop's Ethernet in it; the TFTP server started; a copy of
           the RUNNING configuration first (the port open, not saved: the wrong one), caught; then the saved one, twice, read in the
           TFTP tab and listed in the laptop's own Command Prompt; the cable pulled and the port shut again */
        const lapIp = await BJ(p, () => window.__e4b.T.v.lapIp), esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), back = plan.hostname.toLowerCase() + "-confg";
        await dev(p, "tech"); await ser(p, "");
        for (const l of [plan.console, "enable", plan.secret, "configure terminal", "banner motd #" + plan.banner + "#", "end", "copy running-config startup-config", "", "exit", ""]) await ser(p, l);
        const wake = await term(p);
        check(wake.lastIndexOf(plan.banner) > wake.lastIndexOf("con0 is now available") && wake.lastIndexOf(plan.banner) < wake.lastIndexOf("User Access Verification"), tag + "the console wakes with the banner, then asks for the password");
        /* cabled first, into a port still shut: no link, no address; then the port opened from the console brings both */
        await lay(p, "tech", "ETH", "msw", "4");
        check(/Your laptop, ETHERNET[^]*?No link/.test(await p.$eval("#runs", (n) => n.textContent)), tag + "your laptop's Ethernet in port 4, still shut: in the runs table, no link");
        await dev(p, "tech"); await tab(p, "TFTP server");
        check(/Stopped/.test(await p.$eval(".tftp", (n) => n.textContent)), tag + "the TFTP server tab: stopped at first");
        await p.click('.tftp button:text-is("Start the TFTP server")'); await p.waitForTimeout(40);
        check(/Running[^]*No network: Ethernet has no link/.test(await p.$eval(".tftp", (n) => n.textContent)), tag + "started on a port still shut: no link, nothing to listen on");
        await tab(p, "Serial terminal");
        for (const l of [plan.console, "enable", plan.secret, "configure terminal", "interface gi0/4", "no shutdown", "end"]) await ser(p, l);
        check(/Your laptop, ETHERNET[^]*?Link, 1 Gb\/s/.test(await p.$eval("#runs", (n) => n.textContent)), tag + "port 4 opened: the laptop's run has a link");
        await tab(p, "TFTP server");
        check(new RegExp("Running[^]*" + esc(lapIp) + ", UDP port 69").test(await p.$eval(".tftp", (n) => n.textContent)), tag + "started: it listens on the address the office's router gave the laptop");
        await tab(p, "Serial terminal"); await ser(p, "copy running-config tftp:");
        check((await promptNow(p)) === "Address or name of remote host []? ", tag + "copy asks for the server's address");
        await ser(p, lapIp); check((await promptNow(p)) === "Destination filename [" + back + "]? ", tag + "then the file name, offering the switch's own (" + back + ")");
        await ser(p, ""); check(/!!\n\d+ bytes copied in/.test(await term(p)), tag + "!! and the bytes copied");
        t = await checkJob(p); check(/differs from show startup-config/.test(t), tag + "a copy of the running configuration with the port open, not saved: the check says it isn't the saved one");
        await dev(p, "tech");
        for (const l of ["copy startup-config tftp:", lapIp, "", "copy startup-config tftp:", lapIp, plan.baseline]) await ser(p, l);
        await tab(p, "TFTP server");
        const files = await p.$$eval(".tftp .tfiles li b", (l) => l.map((x) => x.textContent));
        check(files.length === 2 && files[0] === back && files[1] === plan.baseline, tag + "the TFTP tab lists the backup (replaced) and the baseline");
        await p.click('.tftp button[aria-label="Read ' + plan.baseline + '"]'); await p.waitForTimeout(40);
        const txt = await p.$eval(".tftpfile pre", (n) => n.textContent);
        check(txt.includes("banner motd ^C" + plan.banner + "^C") && /interface GigabitEthernet0\/4\n shutdown\n/.test(txt), tag + "Read: the baseline holds the banner, and port 4 shut, as saved");
        await tab(p, "Command Prompt"); await type(p, "ipconfig");
        check(new RegExp("IPv4 Address[ .]*: " + esc(lapIp)).test(await term(p)) && /C:\\Users\\tech>/.test(await promptNow(p)), tag + "your laptop's own Command Prompt: its address by ipconfig");
        await type(p, "dir C:\\TFTP-Root"); check(new RegExp(esc(plan.baseline)).test(await term(p)) && /2 File\(s\)/.test(await term(p)), tag + "dir C:\\TFTP-Root lists the two files");
        await p.click('#runs tr:has-text("Your laptop, ETHERNET") button:text-is("Pull")'); await p.waitForTimeout(40);
        t = await checkJob(p); check(/not disabled/.test(t), tag + "the cable pulled, the port still open: the check says so");
        await dev(p, "tech"); await tab(p, "Serial terminal");
        for (const l of ["configure terminal", "interface gi0/4", "shutdown", "end"]) await ser(p, l);
        await tab(p, "Physical"); await p.waitForTimeout(60);
        check(/ETHERNET: empty\./.test(await p.$eval(".pane", (n) => n.textContent)) && /USB serial adapter is plugged in/.test(await p.$eval(".pane", (n) => n.textContent)), tag + "your laptop's Physical tab: Ethernet empty, the serial adapter in");
      } else if (job === "SO-J6") {
        /* the replacement from its box: cabled as the backup says, a temporary address of the records' own on VLAN 1, your laptop on a
           spare port, the backup copied in (the prompt takes the office's name), the keys made again, the changed key seen at the front
           desk and checked against the switch's own fingerprint before it's forgotten, saved, the laptop's cable pulled */
        const lapIp = await BJ(p, () => window.__e4b.T.v.lapIp), back = plan.hostname.toLowerCase() + "-confg", esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        check(/Managed switch/.test(await p.$eval(".tray", (n) => n.textContent).catch(() => "")), tag + "the replacement is in the box tray");
        await place(p, "msw", "closet"); await lay(p, "tech", "USB-C", "msw", "CONSOLE");
        await lay(p, "router", "LAN 1", "msw", "1"); await lay(p, "msw", "2", "pc", "NIC"); await lay(p, "msw", "3", "printer", "NET");
        await dev(p, "tech"); await ser(p, "");
        check((await promptNow(p)) === "Switch>", tag + "the replacement wakes with its factory prompt, asking for nothing");
        for (const l of ["enable", "configure terminal", "interface vlan 1", "ip address " + plan.ip + " " + plan.mask, "no shutdown", "end"]) await ser(p, l);
        await lay(p, "tech", "ETH", "msw", "4");
        await dev(p, "tech"); await tab(p, "TFTP server");
        const files = await p.$$eval(".tftp .tfiles li b", (l) => l.map((x) => x.textContent));
        check(files.indexOf(back) >= 0 && files.indexOf(plan.baseline) >= 0, tag + "the TFTP tab still holds last visit's backup and baseline");
        await p.click('.tftp button:text-is("Start the TFTP server")'); await p.waitForTimeout(40);
        await tab(p, "Serial terminal"); await ser(p, "copy tftp: running-config");
        check((await promptNow(p)) === "Address or name of remote host []? ", tag + "copy tftp: asks for the server");
        await ser(p, lapIp); check((await promptNow(p)) === "Source filename []? ", tag + "then the file to fetch");
        await ser(p, back); check((await promptNow(p)) === "Destination filename [running-config]? ", tag + "then where it goes, offering running-config");
        await ser(p, "");
        check(new RegExp("Loading " + esc(back) + " from " + esc(lapIp) + " \\(via Vlan1\\): !\\n\\[OK - \\d+ bytes\\]").test(await term(p)) && (await promptNow(p)) === plan.hostname + "#", tag + "the backup loads, and the prompt takes the office's name");
        t = await checkJob(p); check(/connection refused/.test(t) && !/factory settings/.test(t), tag + "the check: the configuration is back; SSH is refused (no keys)");
        await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ssh " + plan.user + "@" + plan.ip);
        check(/port 22: Connection refused/.test(await term(p)), tag + "SSH from the front desk PC: refused, no keys on the new switch");
        await dev(p, "tech"); for (const l of ["configure terminal", "crypto key generate rsa modulus 2048", "end", "show crypto key mypubkey rsa"]) await ser(p, l);
        const own = ((await term(p)).match(/Fingerprint \(SHA256, as SSH clients show it\): (SHA256:\S+)/g) || []).pop() || "";
        await dev(p, "pc"); await type(p, "ssh " + plan.user + "@" + plan.ip);
        const warn = await term(p), fp = (warn.match(/The fingerprint for the RSA key sent by the remote host is\n(SHA256:\S+)\./) || [])[1];
        check(/REMOTE HOST IDENTIFICATION HAS CHANGED/.test(warn) && !!fp && own.indexOf(fp) >= 0, tag + "the front desk PC warns the key changed; its fingerprint is the new switch's own");
        await type(p, "ssh-keygen -R " + plan.ip); check(/known_hosts updated/.test(await term(p)), tag + "ssh-keygen -R forgets the old key");
        await type(p, "ssh " + plan.user + "@" + plan.ip); check(/Permanently added/.test(await term(p)), tag + "SSH again: the new key is added");
        await type(p, plan.userPw); check((await promptNow(p)) === plan.hostname + ">", tag + "and the office's login works (the backup's hashed secret)");
        await type(p, "exit");
        await dev(p, "tech"); await ser(p, "copy running-config startup-config"); await ser(p, "");
        await p.click('#runs tr:has-text("Your laptop, ETHERNET") button:text-is("Pull")'); await p.waitForTimeout(40);
      } else if (job === "SO-J7") {
        /* the new hire's PC unboxed at their desk and cabled to a spare port (shut, so no link), the port opened and named, the PC online
           by itself, saved; the backup goes stale and the check says so; refreshed from your laptop on the router's spare port */
        const lapIp = await BJ(p, () => window.__e4b.T.v.lapIp), esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        check(/New hire's PC/.test(await p.$eval(".tray", (n) => n.textContent).catch(() => "")), tag + "the new hire's PC is in the box tray");
        await place(p, "hire", "open"); await lay(p, "msw", "5", "hire", "NIC");
        check(/New hire's PC, NIC[^]*?12 m[^]*?No link|Managed switch, port 5[^]*?New hire's PC[^]*?No link/.test(await p.$eval("#runs", (n) => n.textContent)), tag + "the 12 m run to the new desk: no link, its port is shut");
        await dev(p, "tech"); await ser(p, "");
        for (const l of [plan.console, "enable", plan.secret, "show interfaces status"]) await ser(p, l);
        check(/Gi0\/5\s+disabled/.test(await term(p)), tag + "show interfaces status: Gi0/5 disabled, as every spare");
        for (const l of ["configure terminal", "interface gi0/5", "description " + plan.desc.hire, "no shutdown", "end"]) await ser(p, l);
        await dev(p, "hire"); await tab(p, "Command Prompt"); await type(p, "ipconfig");
        const hip = ((await term(p)).match(/IPv4 Address[ .]*: ([\d.]+)/) || [])[1] || "";
        check(!!hip && !/^169\.254/.test(hip), tag + "the port opened: the new hire's PC has its address from the router (" + hip + ")");
        await type(p, "ping " + (await BJ(p, () => window.__e4b.T.sim.d.printer.ifaces[0].cfg.ip)));
        check(/Reply from/.test(await term(p)), tag + "and it reaches the printer");
        await dev(p, "tech"); await ser(p, "copy running-config startup-config"); await ser(p, "");
        t = await checkJob(p); check(/differs from show startup-config/.test(t), tag + "saved: the backup on your laptop is now out of date, and the check says so");
        await lay(p, "tech", "ETH", "router", "LAN 2");
        await dev(p, "tech"); await tab(p, "TFTP server"); await p.click('.tftp button:text-is("Start the TFTP server")'); await p.waitForTimeout(40);
        await tab(p, "Serial terminal");
        for (const l of ["copy startup-config tftp:", lapIp, ""]) await ser(p, l);
        check(/!!\n\d+ bytes copied in/.test(await term(p)), tag + "the saved configuration copied again under the switch's own name");
        await p.click('#runs tr:has-text("Your laptop, ETHERNET") button:text-is("Pull")'); await p.waitForTimeout(40);
        void esc;
      } else if (job === "SO-J8") {
        /* the printer offline in the manager's office: its new run found in the runs table, on a shut port; the port opened with the
           printer's settings, and show interfaces proves the duplex; the old port's label taken off and the port shut; the backup refreshed */
        const lapIp = await BJ(p, () => window.__e4b.T.v.lapIp), np = await BJ(p, () => window.__e4b.T.v.newPort), prIp = await BJ(p, () => window.__e4b.T.sim.d.printer.ifaces[0].cfg.ip);
        const runs = await p.$eval("#runs", (n) => n.textContent);
        check(new RegExp("Managed switch, port " + np + "[^]*?Office printer, NET[^]*?22 m[^]*?No link").test(runs), tag + "the runs table: the cabler's 22 m run from the printer lands on port " + np + ", no link");
        check(/Managed switch, port 3[^]*?Open-plan wall jack/.test(runs) && !!(await p.$('#devtabs [data-d="ojack"]')), tag + "the old run is still in port 3, to the open-plan office's wall jack, which has a device button");
        await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ping " + prIp);
        check(/Request timed out|Destination host unreachable/.test(await term(p)), tag + "the front desk PC can't reach the printer");
        await dev(p, "tech"); await ser(p, "");
        for (const l of [plan.console, "enable", plan.secret, "show interfaces status"]) await ser(p, l);
        check(new RegExp("Gi0/" + np + "\\s+disabled").test(await term(p)) && new RegExp("Gi0/3\\s+" + plan.desc.printer + "\\s+notconnect").test(await term(p)), tag + "show interfaces status: the new port disabled, the old one still named for the printer, notconnect");
        for (const l of ["configure terminal", "interface gi0/" + np, "description " + plan.desc.printer, "speed 100", "duplex full", "no shutdown", "interface gi0/3", "no description", "no speed", "no duplex", "shutdown", "end", "show interfaces gi0/" + np]) await ser(p, l);
        const sh = await term(p); check(/Full-duplex, 100Mb\/s/.test(sh.slice(sh.lastIndexOf("GigabitEthernet0/" + np + " is"))), tag + "show interfaces on the new port: full duplex, 100 Mb/s");
        await dev(p, "pc"); await type(p, "ping " + prIp); check(/Reply from/.test(await term(p)), tag + "the front desk PC reaches the printer again");
        await dev(p, "tech"); await ser(p, "copy running-config startup-config"); await ser(p, "");
        await lay(p, "tech", "ETH", "router", "LAN 2");
        await dev(p, "tech"); await tab(p, "TFTP server"); await p.click('.tftp button:text-is("Start the TFTP server")'); await p.waitForTimeout(40);
        await tab(p, "Serial terminal"); for (const l of ["copy startup-config tftp:", lapIp, ""]) await ser(p, l);
        await p.click('#runs tr:has-text("Your laptop, ETHERNET") button:text-is("Pull")'); await p.waitForTimeout(40);
      } else if (job === "SO-J9") {
        /* no cord and no map: the runs table hides which back port each run is on; each run toned at its far end (the three desks and both
           empty wall jacks) and found with the probe; the panel's back takes no cord; each desk patched to the switch port named for it; the
           map written and saved */
        const v = await BJ(p, () => ({ P: window.__e4b.T.v.P, set: window.__e4b.T.v.set })), found = {};
        const runs = await p.$eval("#runs", (n) => n.textContent);
        check((runs.match(/Patch panel, a run punched down at the back/g) || []).length === 5 && !/punched down at the back\)/.test(runs), tag + "the runs table lists the five runs at the panel's back, without saying which port each is on");
        p.setDefaultTimeout(30000);   /* each Physical tab builds its 3D model: on a busy machine that holds the page for seconds */
        for (const id of ["pc", "printer", "hire", "ojack", "mjack"]) {
          await dev(p, id); if (!/jack$/.test(id)) await tab(p, "Physical");
          await p.click('.cabs li:has-text("' + (/jack$/.test(id) ? "run from this jack" : "wall jack") + '") button:text-is("Put the tone generator on it")'); await p.waitForTimeout(40);
          await dev(p, "pp"); await p.click("#probeBtn"); await p.waitForTimeout(40);
          found[id] = ((await p.$eval(".phys", (n) => n.textContent)).match(/The probe screams at the back of port (\d+)/) || [])[1];
        }
        p.setDefaultTimeout(5000);
        check(Object.keys(v.P).every((id) => found[id] === v.P[id]), tag + "the tone and the probe find every run's panel port (" + Object.keys(found).map((k) => k + " " + found[k]).join(", ") + ")");
        await p.selectOption("#bmAd", "pp");
        check(!(await p.$$eval("#bmAp option", (l) => l.some((o) => /R$/.test(o.value)))), tag + "the Lay form offers only the panel's front ports");
        await dev(p, "tech"); await ser(p, ""); for (const l of [plan.console, "enable", plan.secret, "show interfaces status"]) await ser(p, l);
        const st = await term(p);
        check(["pc", "printer", "hire"].every((id) => new RegExp(v.set[id].replace("GigabitEthernet", "Gi").replace("/", "\\/") + "\\s+" + plan.desc[id] + "\\s+notconnect").test(st)), tag + "show interfaces status: each desk's port named, notconnect");
        for (const id of ["pc", "printer", "hire"]) await lay(p, "pp", found[id], "msw", v.set[id].replace("GigabitEthernet0/", ""));
        check(/Patch panel, port \d+[^]*?0\.5 m/.test(await p.$eval("#runs", (n) => n.textContent)), tag + "each patch cord is 0.5 m");
        t = await checkJob(p); check(/cable map is empty/.test(t), tag + "patched: the check says the map is still empty");
        const room = { pc: "front", printer: "manager", hire: "open", ojack: "open", mjack: "meeting" };
        for (const id of Object.keys(room)) await p.selectOption("#cm" + found[id], room[id]);
        await p.click("#cmapSave"); await p.waitForTimeout(60);
        check(/Saved/.test(await p.$eval("#cmapSum", (n) => n.textContent)), tag + "the map says Saved");
        await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ping 203.0.113.80"); check(/Reply from 203\.0\.113\.80/.test(await term(p)), tag + "the front desk PC is online through the panel");
      } else if (job === "SO-J10") {
        /* the back office switch placed; the fibre refused into empty slots; a single-mode module tried at the closet end and caught by the
           check, swapped for an SX; the closet's fibre port opened and named, light in both directions; the back office PC online; the
           closet switch saved and backed up; your laptop carried to the back office for the new switch's console, named, locked, saved */
        const lapIp = await BJ(p, () => window.__e4b.T.v.lapIp), prIp = await BJ(p, () => window.__e4b.T.sim.d.printer.ifaces[0].cfg.ip);
        check(/Back office switch/.test(await p.$eval(".tray", (n) => n.textContent).catch(() => "")), tag + "the back office switch is in the box tray");
        await place(p, "bsw", "closet"); check(/goes in the back office/.test(await p.$eval("#bmPmsg", (n) => n.textContent)), tag + "the back office switch has its own place, in the back office");
        await place(p, "bsw", "meeting");
        await lay(p, "msw", "SFP1", "bsw", "SFP1"); check(/Put a module in the .*SFP1 first: the fibre's LC plug goes into the module/.test(await p.$eval("#bmLmsg", (n) => n.textContent)), tag + "no module, no fibre: the Lay form says so");
        p.setDefaultTimeout(30000);   /* a Physical tab builds its 3D model */
        await dev(p, "msw"); await tab(p, "Physical");
        await p.click('.acts:has-text("SFP1: empty") button:text-is("Put in a 1000BASE-LX module")'); await p.waitForTimeout(60);
        await dev(p, "bsw"); await tab(p, "Physical");
        await p.click('.acts:has-text("SFP1: empty") button:text-is("Put in a 1000BASE-SX module")'); await p.waitForTimeout(60);
        p.setDefaultTimeout(5000);
        await lay(p, "msw", "SFP1", "bsw", "SFP1");
        check(/Managed switch, SFP1[^]*?Back office switch, SFP1[^]*?35 m/.test(await p.$eval("#runs", (n) => n.textContent)), tag + "the fibre run, 35 m, between the two SFP1 slots");
        await lay(p, "bsw", "1", "mpc", "NIC");
        t = await checkJob(p); check(/single-mode/.test(t), tag + "an LX at the closet end: the check reads the module against the run");
        p.setDefaultTimeout(30000); await dev(p, "msw"); await tab(p, "Physical");
        await p.click('.acts:has-text("SFP1: 1000BASE-LX") button:text-is("Swap in a 1000BASE-SX module")'); await p.waitForTimeout(60); p.setDefaultTimeout(5000);
        await dev(p, "tech"); await tab(p, "Serial terminal"); await ser(p, "");
        for (const l of [plan.console, "enable", plan.secret, "show interfaces status"]) await ser(p, l);
        check(/Gi0\/25\s+disabled/.test(await term(p)), tag + "show interfaces status: the fibre port Gi0/25 disabled, as every spare");
        for (const l of ["configure terminal", "interface gi0/25", "description " + plan.desc.fibre, "no shutdown", "end", "show interfaces transceiver"]) await ser(p, l);
        check(/Gi0\/25\s+33\.8\s+3\.29\s+-5\.6\s+-6\.1/.test(await term(p)), tag + "show interfaces transceiver: light both ways on Gi0/25");
        await ser(p, "copy running-config startup-config"); await ser(p, "");
        await dev(p, "mpc"); await tab(p, "Command Prompt"); await type(p, "ipconfig");
        if (/169\.254\./.test(await term(p))) await type(p, "ipconfig /renew");
        await type(p, "ping " + prIp); check(/Reply from/.test(await term(p)), tag + "the back office PC reaches the printer across the fibre");
        await lay(p, "tech", "ETH", "router", "LAN 2");
        await dev(p, "tech"); await tab(p, "TFTP server"); await p.click('.tftp button:text-is("Start the TFTP server")'); await p.waitForTimeout(40);
        await tab(p, "Serial terminal"); for (const l of ["copy startup-config tftp:", lapIp, ""]) await ser(p, l);
        await p.click('#runs tr:has-text("Your laptop, ETHERNET") button:text-is("Pull")'); await p.waitForTimeout(40);
        await p.click('#runs tr:has-text("Your laptop, USB-C") button:text-is("Pull")'); await p.waitForTimeout(40);
        await lay(p, "tech", "USB-C", "bsw", "CONSOLE"); check(/same room/.test(await p.$eval("#bmLmsg", (n) => n.textContent)), tag + "the console cable doesn't reach the back office from the closet");
        await place(p, "tech", "meeting"); await lay(p, "tech", "USB-C", "bsw", "CONSOLE");
        await dev(p, "tech"); await tab(p, "Serial terminal"); await ser(p, "");
        check((await promptNow(p)) === "Switch>", tag + "the back office switch's console: a factory prompt");
        for (const l of ["enable", "configure terminal", "hostname " + plan.bswHost, "enable secret " + plan.secret, "line console 0", "password " + plan.console, "login", "end", "copy running-config startup-config", ""]) await ser(p, l);
        check((await promptNow(p)) === plan.bswHost + "#", tag + "named " + plan.bswHost + " and saved");
      } else if (job === "SO-J3") {
        /* the printer's port, as found: half duplex, and the late collisions climb each time you look */
        await dev(p, "tech"); await ser(p, "");
        for (const l of [plan.console, "enable", plan.secret]) await ser(p, l);
        await ser(p, "show interfaces gi0/3"); const t1 = await term(p); await ser(p, "show interfaces gi0/3");
        const lates = [...(await term(p)).matchAll(/(\d+) late collision/g)].map((m) => +m[1]);
        check(/Half-duplex, 100Mb\/s/.test(t1) && lates.length >= 2 && lates[lates.length - 1] > lates[lates.length - 2], tag + "show interfaces on the printer's port: half duplex, late collisions climbing (" + lates.slice(-2).join(" then ") + ")");
        t = await checkJob(p); check(/late collisions climb/.test(t) || (await p.$$("#check .rq.bad")).length === 3, tag + "the first check finds the descriptions, the printer's port and the unused ports to do");
        for (const l of ["configure terminal", "interface gi0/1", "description " + plan.desc.router, "interface gi0/2", "description " + plan.desc.pc, "interface gi0/3", "description " + plan.desc.printer, "speed 100", "duplex full"]) await ser(p, l);
        check((await promptNow(p)) === plan.hostname + "(config-if)#", tag + "interface configuration mode in the prompt");
        await ser(p, "interface range gi0/4 - 28");
        check((await promptNow(p)) === plan.hostname + "(config-if-range)#", tag + "interface range mode in the prompt");
        await ser(p, "shutdown"); await ser(p, "end"); await ser(p, "show interfaces status");
        const st = await term(p);
        check(new RegExp("Gi0/3\\s+" + plan.desc.printer + "\\s+connected\\s+1\\s+full\\s+100\\b").test(st), tag + "show interfaces status: the printer's port named, connected, full duplex, 100");
        check(/Gi0\/4\s+disabled/.test(st) && /Gi0\/28\s+disabled/.test(st), tag + "show interfaces status: the spare ports and fibre slots disabled");
        await ser(p, "show interfaces gi0/3"); const t3 = await term(p);
        check(/Full-duplex, 100Mb\/s/.test(t3.slice(t3.lastIndexOf("GigabitEthernet0/3 is"))) && /\b0 late collision/.test(t3.slice(t3.lastIndexOf("GigabitEthernet0/3 is"))), tag + "the printer's port now full duplex with no late collisions");
        t = await checkJob(p); check((await p.$$("#check .rq.bad")).length === 1, tag + "not saved yet: only the saving line is not met");
        await dev(p, "tech"); await ser(p, "copy running-config startup-config"); await ser(p, "");
      } else {
        for (const port of ["2", "3"]) { await p.click('#runs tr:has-text("Old 8-port switch, port ' + port + '") button:text-is("Pull")'); await p.waitForTimeout(40); }
        await p.click('#runs tr:has-text("Office router, LAN 1") button:text-is("Pull")'); await p.waitForTimeout(40);
        await lay(p, "router", "LAN 1", "msw", "1"); await lay(p, "msw", "2", "pc", "NIC"); await lay(p, "msw", "3", "printer", "NET");
        check(/18 m, the network closet to the front desk/.test(await p.$eval("#runs", (n) => n.textContent)), tag + "the run to the front desk is 18 m");
        await dev(p, "tech"); await ser(p, "");
        check((await p.getAttribute(".term .cmdin", "type")) === "password", tag + "the saved console password is asked for after the move");
        for (const l of [plan.console, "enable", plan.secret, "configure terminal", "interface vlan 1"]) await ser(p, l);
        check((await promptNow(p)) === plan.hostname + "(config-if)#", tag + "interface configuration mode in the prompt");
        for (const l of ["ip address " + plan.ip + " " + plan.mask, "no shutdown", "exit", "ip default-gateway " + plan.gw, "ip domain-name " + plan.domain, "crypto key generate rsa modulus 2048", "username " + plan.user + " secret " + plan.userPw, "line vty 0 15", "login local", "transport input ssh", "end"]) await ser(p, l);
        /* SSH from the front desk PC before saving: it works now; the check still wants it saved */
        await dev(p, "pc"); await tab(p, "Command Prompt");
        await type(p, "telnet " + plan.ip); check(/Could not open connection to the host, on port 23/.test(await term(p)), tag + "Telnet from the PC is refused");
        await type(p, "ssh " + plan.user + "@" + plan.ip);
        check((await promptNow(p)) === plan.user + "@" + plan.ip + "'s password: " && (await p.getAttribute(".term .cmdin", "type")) === "password", tag + "ssh asks for the user's password, hidden");
        await type(p, plan.userPw); check((await promptNow(p)) === plan.hostname + ">", tag + "SSH from the PC logs in to the switch");
        await type(p, "show ip interface brief"); check(new RegExp("Vlan1\\s+" + plan.ip.replace(/\./g, "\\.")).test(await term(p)), tag + "show ip interface brief over SSH shows VLAN 1's address");
        await type(p, "exit"); check(new RegExp("Connection to " + plan.ip.replace(/\./g, "\\.") + " closed").test(await term(p)) && /C:\\Users\\/.test(await promptNow(p)), tag + "exit closes the SSH session, back at Windows' prompt");
        t = await checkJob(p); check((await p.$$("#check .rq.bad")).length === 1, tag + "not saved yet: only the saving line is not met");
        await dev(p, "tech"); await ser(p, "copy running-config startup-config"); await ser(p, "");
        await p.click("#vLog"); await p.waitForTimeout(40);
        check(new RegExp(plan.ip.replace(/\./g, "\\.")).test(await p.$eval('#net [data-d="msw"]', (n) => n.textContent)), tag + "the logical diagram shows the switch's management address");
        await p.click("#vPhy");
      }
      t = await checkJob(p);
      const n = await BJ(p, () => window.__e4b.T.def.reqs.length);
      check(new RegExp(n + " of " + n + " met").test(t) && /Job .* done/.test(t), tag + "every line met through the page (" + (t.match(/\d+ of \d+ met/) || ["?"])[0] + ")");
      await p.click("#vLog"); await p.waitForTimeout(60);
      const pn = await labelsClear(p, "net"); check(pn.n > 0 && !pn.out.length, tag + "the finished office's logical diagram: all " + pn.n + " port names on it, clear of every label, tile and other port name" + (pn.out.length ? " (" + pn.out.join("; ") + ")" : ""));
      await p.click("#vPhy"); await p.waitForTimeout(40);
      const fp = await labelsClear(p, "plan"); check(fp.n > 0 && !fp.out.length, tag + "the finished office's floor plan: all " + fp.n + " names of devices and rooms on it, clear of each other and of every tile" + (fp.out.length ? " (" + fp.out.join("; ") + ")" : ""));
      await dysClear(p, tag + "the finished office");
      await p.reload(); await p.waitForTimeout(350);
      check(/Job .* done/.test(await p.$eval("#check", (n) => n.textContent)) && /done 1×|Done 1×/.test(await p.$eval('#queue [data-j="' + job + '"]', (n) => n.textContent)), tag + "still done after a reload, and the list counts it");
      if (job === "SO-J2") check(new RegExp("1 of " + LEVELS[1].jobs.length + " work orders done").test((await lv(p, 2)).text) && !/on the way/.test((await lv(p, 2)).text), tag + "the level counts its work orders, and says nothing more is coming (" + (await lv(p, 2)).text + ")");
    } catch (e) { check(false, tag + "stopped: " + String(e.message).split("\n")[0]); }
    await ctx.close();
  }
}

/* the small office complete (18 October 2026: its 10 work orders and 15 tickets all built): with every ticket solved and every work
   order but the last done, finishing the last one finishes the level and opens the small business (19 October 2026) */
if (!process.env.ONLY || process.env.ONLY === "office") {
  const { LEVELS } = await import("../js/desk/levels.js");
  const net = { t: {}, solved: Object.fromEntries(LEVELS[0].tickets.concat(LEVELS[1].tickets).map((id) => [id, 1])) };
  const lastJob = LEVELS[1].jobs[LEVELS[1].jobs.length - 1];
  const built = { j: {}, done: Object.fromEntries(LEVELS[0].jobs.concat(LEVELS[1].jobs.slice(0, -1)).map((id) => [id, 1])) };
  const ctx = await B.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(([n, b]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-network-v1", JSON.stringify(n)); localStorage.setItem("e4-build-v1", JSON.stringify(b)); sessionStorage.setItem("seeded", "1"); } }, [net, built]);
  const p = await ctx.newPage(); p.setDefaultTimeout(5000); p.on("pageerror", (e) => errs.push("office finished: " + e.message));
  const tag = "levels, the small office finished: ";
  try {
    await p.goto(base + "build.html"); await p.waitForTimeout(350);
    if (plant) await p.evaluate(plant);
    check(/More work orders/i.test(await p.$eval("#queue", (n) => n.textContent)) === false, tag + "the small office's work orders list says nothing more is coming");
    await p.evaluate((id) => { const c = window.__e4b; c.openJob(id, true, 2026); const J = c.T; J.def.solve(J.v, J.sim).forEach((a) => c.act(a)); }, lastJob);
    await p.click("#doCheck"); await p.waitForTimeout(150);   /* the real button: it's what counts a job done */
    const box = await p.$eval("#check", (n) => n.textContent);
    check(/Level 2 finished/.test(box) && /The small business is open: level 3/.test(box), tag + lastJob + "'s done box says Level 2 is finished, and the small business is open");
    check(!/on the way/.test(box), tag + "and no longer says more is on the way");
    await p.goto(base + "index.html"); await p.waitForTimeout(350);
    const L2 = await p.$eval('#left [data-level="2"]', (n) => n.textContent), L3 = await p.$eval('#left [data-level="3"]', (n) => n.textContent);
    check(/Finished: 15 of 15 tickets, 10 of 10 work orders/.test(L2), tag + "Level 2 says finished, 15 of 15 tickets and 10 of 10 work orders (" + L2 + ")");
    check(/^Level 3 · Small business0 of \d+ work orders done · more work orders and its tickets on the way$/.test(L3) && !(await p.$eval('#left [data-level="3"]', (n) => n.parentNode.classList.contains("locked"))), tag + "Level 3 is open, counts its work orders, and says more is on the way (" + L3 + ")");
    await p.click('#left [data-level="2"]'); await p.waitForTimeout(60);
    check(!/on the way|built later/i.test(await p.$eval("#queue", (n) => n.textContent)), tag + "the desk's queue for the small office says nothing more is coming");
  } catch (e) { check(false, tag + "stopped: " + String(e.message).split("\n")[0]); }
  await ctx.close();
}

/* Level 3, the small business (19 October 2026): the lock (the small office not finished, then finished), then SB-J1 and SB-J2
   done entirely through the page, every step as a student takes it: the Place and Lay forms, the Pull buttons in the runs table,
   the serial terminal on the router's and the switch's console, each PC's Command Prompt. Along the way, what the page shows:
   the router's prompt, passwords hidden, its Lights and Physical tabs, NAT's translations, the trunk, both drawings */
if (!process.env.ONLY || process.env.ONLY === "business") {
  const { LEVELS } = await import("../js/desk/levels.js");
  const solvedTo = (n) => ({ t: {}, solved: Object.fromEntries(LEVELS.slice(0, n).flatMap((L) => L.tickets).map((id) => [id, 1])) });
  const doneTo = (n) => Object.fromEntries(LEVELS.slice(0, n).flatMap((L) => L.jobs).map((id) => [id, 1]));
  async function zpage(file, o) {
    const ctx = await B.newContext({ viewport: { width: 1400, height: 900 } });
    await ctx.addInitScript((o) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-network-v1", JSON.stringify(o.net)); localStorage.setItem("e4-build-v1", JSON.stringify(o.build)); sessionStorage.setItem("seeded", "1"); } }, o);
    const p = await ctx.newPage(); p.setDefaultTimeout(5000); p.on("pageerror", (e) => errs.push("business " + file + ": " + e.message));
    await p.goto(base + file); await p.waitForTimeout(350);
    if (plant) await p.evaluate(plant);
    return { p, ctx };
  }
  const lv = (p, n) => p.$eval('#left [data-level="' + n + '"]', (b) => ({ text: b.textContent, locked: b.parentNode.classList.contains("locked"), dashed: getComputedStyle(b).borderStyle === "dashed", lock: !!b.querySelector('.lk[aria-hidden="true"]') }));
  /* the small office not finished: Level 3 locked, three ways; finished: open, and the desk links its work orders into Build */
  {
    const { p, ctx } = await zpage("build.html", { net: solvedTo(1), build: { j: {}, done: doneTo(1) } }); const tag = "levels, the small office not finished: ";
    try {
      const L = await lv(p, 3);
      check(L.locked && L.lock && L.dashed && /Locked: opens when Small office is finished/.test(L.text), tag + "Level 3 is locked, marked three ways");
      await p.click('#left [data-level="3"]'); await p.waitForTimeout(60);
      check(await p.$$eval("#queue button.locked", (l) => l.length >= 2 && l.every((b) => b.getAttribute("aria-disabled") === "true")), tag + "its work orders are listed, locked");
    } catch (e) { check(false, tag + "stopped: " + String(e.message).split("\n")[0]); }
    await ctx.close();
  }
  {
    const { p, ctx } = await zpage("index.html", { net: solvedTo(2), build: { j: {}, done: doneTo(2) } }); const tag = "levels, the small office finished: ";
    try {
      check(!(await lv(p, 3)).locked, tag + "Level 3 is open on the Ticket Desk");
      await p.click('#left [data-level="3"]'); await p.waitForTimeout(60);
      check((await p.$$('#left a[href="build.html#job=SB-J1"]')).length === 1, tag + "the desk links the small business's work orders into Build");
      await p.click('#left a[href="build.html#job=SB-J1"]'); await p.waitForTimeout(400);
      check((await BJ(p, () => window.__e4b.T.def.id)) === "SB-J1" && /Level 3 · Small business/.test(await p.$eval("#labtitle", (n) => n.textContent)), tag + "the link opens SB-J1 in Build, titled Level 3 · Small business");
    } catch (e) { check(false, tag + "stopped: " + String(e.message).split("\n")[0]); }
    await ctx.close();
  }
  /* one step of a solution, the way a student takes it on the page */
  const step = async (p, a) => {
    if (a.t === "place") return place(p, a.dev, a.room);
    if (a.t === "lay") return lay(p, a.a.dev, a.a.port, a.b.dev, a.b.port);
    if (a.t === "pull") { const i = await p.evaluate((id) => window.__e4b.T.sim.net.cables.findIndex((c) => c.id === id), a.cable); check(i >= 0, "the cable to pull, " + a.cable + ", is in the runs table"); await p.click("#runs tbody tr:nth-child(" + (i + 1) + ") button"); await p.waitForTimeout(40); return; }
    if (a.t === "cmd" && a.cli) { if ((await p.$eval("#devtabs [aria-pressed=true]", (n) => n.dataset.d).catch(() => "")) !== "tech") await dev(p, "tech"); if (!(await p.$('.win-tabs button[aria-selected="true"]:text-is("Serial terminal")'))) await tab(p, "Serial terminal"); return type(p, a.line); }
    if (a.t === "cmd") { await dev(p, a.dev); await tab(p, "Command Prompt"); return type(p, a.line); }
    throw new Error("no page step for " + JSON.stringify(a));
  };
  const promptNow = (p) => p.$eval(".term .prompt", (n) => n.textContent);
  for (const job of ["SB-J1", "SB-J2"].filter((k) => !process.env.JOB || k === process.env.JOB)) for (const seed of [11, 2025, 777777]) {
    const { p, ctx } = await zpage("build.html", { net: solvedTo(2), build: { current: job, j: { [job]: { seed } }, done: doneTo(2) } });
    const tag = "business " + job + " " + seed + ": ";
    try {
      const plan = await BJ(p, () => window.__e4b.T.sim.net.plan), rooms = await BJ(p, () => window.__e4b.T.sim.net.roomNames);
      check((await BJ(p, () => window.__e4b.T.def.id)) === job && (await BJ(p, () => window.__e4b.T.seed)) === seed && /Level 3 · Small business/.test(await p.$eval("#labtitle", (n) => n.textContent)), tag + "opens the job on the business asked for, under Level 3");
      check(await p.$$eval("#bmRoom option", (l) => l.map((o) => o.textContent).join("|")) === Object.values(rooms).join("|"), tag + "the Place form lists the business's own rooms (" + Object.values(rooms).join(", ") + ")");
      const lim = await p.$eval(".limits", (n) => n.textContent);
      check([plan.rtHost, plan.rtSecret, plan.rtConsole].concat(job === "SB-J2" ? [plan.swHost, plan.swSecret, plan.swConsole, plan.vlans.staff.name, plan.vlans.staff.gw] : [plan.lanGw]).every((x) => lim.indexOf(x) >= 0), tag + "the limits carry the business's records the job needs");
      await checkJob(p);
      check((await p.$$("#check .rq.bad")).length === (await BJ(p, () => window.__e4b.T.def.reqs.filter((q) => (window.__e4b.T.def.already || []).indexOf(q.id) < 0).length)), tag + "the first check finds the work to do");
      const sol = await BJ(p, () => { const T = window.__e4b.T; return T.def.solve(T.v, T.sim); });
      if (job === "SB-J1") {
        check(!(await p.$('#plan [data-d="rtr"]')) && /Business router/.test(await p.$eval(".tray", (n) => n.textContent)), tag + "the business router starts in its box, off the plan");
        await place(p, "rtr", "counter"); check(/Not placed/.test(await p.$eval("#bmPmsg", (n) => n.textContent)), tag + "the router has its place in the closet rack: anywhere else is refused");
        await step(p, sol[0]);
        check((await p.getAttribute('#plan [data-d="rtr"] use', "href")) === "#p-brouter" && !!(await p.$('#devtabs [data-d="rtr"]')), tag + "unboxed: on the plan with its own icon, and a device button");
        await step(p, sol[1]);
        check(/Console: connected/.test(await p.$eval("#runs", (n) => n.textContent)), tag + "the console cable is in the runs table, connected");
        await step(p, sol[2]); check((await promptNow(p)) === "Router>", tag + "Enter wakes the router's console: Router>");
        let k = 3;
        for (; k < sol.length && sol[k].t === "cmd" && sol[k].cli; k++) await step(p, sol[k]);
        check((await promptNow(p)) === plan.rtHost + "#", tag + "the router's command line took every line: its prompt is " + plan.rtHost + "#");
        check(!/% Invalid|% Incomplete|% Ambiguous/.test(await term(p)), tag + "no line was refused");
        for (; k < sol.length; k++) await step(p, sol[k]);
        await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ping 8.8.8.8");
        check(/Reply from 8\.8\.8\.8/.test(await term(p)), tag + "the " + (await BJ(p, () => window.__e4b.T.sim.d.pc.label)) + " pings out through the new router");
        const pcIp = await BJ(p, () => window.__e4b.T.sim.addr("pc").ip);
        await step(p, { t: "cmd", dev: "tech", cli: true, line: "show ip nat translations" });
        check(new RegExp(pcIp.replace(/\./g, "\\.") + ":\\d+").test(await term(p)), tag + "show ip nat translations lists the PC's address, translated");
        await dev(p, "rtr"); await tab(p, "Lights");
        const L = await p.$eval(".win-body", (n) => n.innerText);
        check(/GE 0\/0[\s\S]*cable modem/.test(L) && /GE 0\/1[\s\S]*closet switch/.test(L) && /PWR\s*on/.test(L), tag + "the router's Lights tab: power on, GE 0/0 to the modem, GE 0/1 to the closet switch");
        await p.click("#vLog"); await p.waitForTimeout(40);
        check(new RegExp(plan.lanGw.replace(/\./g, "\\.")).test(await p.$eval('#net [data-d="rtr"]', (n) => n.textContent)), tag + "the logical diagram shows the router's inside address");
        await p.click("#vPhy");
      } else {
        check(!(await p.$('#devtabs [data-d="router"]')) && !(await p.$('#plan [data-d="router"]')), tag + "the provider's router is gone: no device button, not on the plan");
        for (const a of sol) {
          await step(p, a);
          if (a.t === "cmd" && a.line === plan.swConsole) check((await p.getAttribute(".term .cmdin", "type")) === "password" || /#|>$/.test(await promptNow(p)), tag + "the console password is typed hidden");
        }
        check(!/% Invalid|% Incomplete|% Ambiguous/.test(await term(p)), tag + "no line was refused on the router");
        await step(p, { t: "cmd", dev: "tech", cli: true, line: "show ip interface brief" });
        check(new RegExp(plan.lanPort.replace(/\//g, "\\/") + "\\." + plan.vlans.staff.id + "\\s+" + plan.vlans.staff.gw.replace(/\./g, "\\.")).test(await term(p)), tag + "show ip interface brief lists the staff subinterface at its gateway");
        await dev(p, "pc"); await tab(p, "Command Prompt"); await type(p, "ipconfig");
        check(new RegExp(plan.vlans.staff.net.replace(/\.0$/, "").replace(/\./g, "\\.") + "\\.").test(await term(p)), tag + "the PC has a staff address");
        const pr = await BJ(p, () => window.__e4b.T.sim.d.printer.ifaces[0].cfg.ip);
        await type(p, "ping " + pr); check(new RegExp("Reply from " + pr.replace(/\./g, "\\.")).test(await term(p)), tag + "the PC on the staff VLAN reaches the printer on the old network, through the router");
      }
      const t = await checkJob(p), n = await BJ(p, () => window.__e4b.T.def.reqs.length);
      check(new RegExp(n + " of " + n + " met").test(t) && /Job .* done/.test(t), tag + "every line met through the page (" + (t.match(/\d+ of \d+ met/) || ["?"])[0] + ")");
      await p.click("#vLog"); await p.waitForTimeout(60);
      const pn = await labelsClear(p, "net"); check(pn.n > 0 && !pn.out.length, tag + "the finished business's logical diagram: every port name and device name on it, clear of each other and every tile" + (pn.out.length ? " (" + pn.out.join("; ") + ")" : ""));
      await p.click("#vPhy"); await p.waitForTimeout(40);
      const fp = await labelsClear(p, "plan"); check(fp.n > 0 && !fp.out.length, tag + "the finished business's floor plan: all " + fp.n + " names of devices and rooms on it, clear of each other and of every tile" + (fp.out.length ? " (" + fp.out.join("; ") + ")" : ""));
      await dysClear(p, tag + "the finished business");
      await p.reload(); await p.waitForTimeout(350);
      check(/Job .* done/.test(await p.$eval("#check", (n) => n.textContent)) && /done 1×|Done 1×/.test(await p.$eval('#queue [data-j="' + job + '"]', (n) => n.textContent)), tag + "still done after a reload, and the list counts it");
    } catch (e) { check(false, tag + "stopped: " + String(e.message).split("\n")[0]); }
    await ctx.close();
  }
  /* SB-J3 (stage 2): the guest Wi-Fi on the ceiling access point, through the page. The access point's address is found as a
     student finds it (the router's DHCP bindings), its page opened in the manager's PC's web browser and the guest network added
     with the page's own form; the visitor's phone joins by name with the password typed in (a wrong one first) */
  const go = async (p, url) => { await p.fill('.browser input[name="url"]', url); await p.click(".browser .urlbar button"); await p.waitForTimeout(60); return p.$eval(".browser", (n) => n.textContent); };
  for (const seed of !process.env.JOB || process.env.JOB === "SB-J3" ? [11, 2025, 777777] : []) {
    const job = "SB-J3", { p, ctx } = await zpage("build.html", { net: solvedTo(2), build: { current: job, j: { [job]: { seed } }, done: doneTo(2) } });
    const tag = "business " + job + " " + seed + ": ";
    try {
      const plan = await BJ(p, () => window.__e4b.T.sim.net.plan);
      check((await BJ(p, () => window.__e4b.T.def.id)) === job && (await BJ(p, () => window.__e4b.T.seed)) === seed, tag + "opens the job on the business asked for");
      check(!(await p.$('#plan [data-d="ap"]')) && !(await p.$('#devtabs [data-d="ap"]')) && /access point/i.test(await p.$eval(".tray", (n) => n.textContent)), tag + "the access point starts in its box: off the plan, no device button");
      await checkJob(p);
      check((await p.$$("#check .rq.bad")).length === (await BJ(p, () => window.__e4b.T.def.reqs.filter((q) => (window.__e4b.T.def.already || []).indexOf(q.id) < 0).length)), tag + "the first check finds the work to do");
      await dev(p, "mgr"); await tab(p, "Web browser");
      check(/Type an address/.test(await p.$eval(".browser", (n) => n.textContent)), tag + "the manager's PC has a web browser, its address bar empty");
      let W = await go(p, plan.lanGw);
      check(/refused to connect/.test(W) && /ERR_CONNECTION_REFUSED/.test(W), tag + "the router's address in the browser: refused (it's managed from its command line)");
      const sol = await BJ(p, () => { const T = window.__e4b.T; return T.def.solve(T.v, T.sim); });
      for (const a of sol) {
        if (a.t === "apnet") {
          await step(p, { t: "cmd", dev: "tech", cli: true, line: "show ip dhcp binding" });
          const out = await term(p), pre = plan.lan.replace(/\.0$/, "."), ips = [...out.matchAll(/^(\d+\.\d+\.\d+\.\d+)\s/gm)].map((m) => m[1]).filter((ip) => ip.startsWith(pre));
          check(!/% Invalid|% Incomplete|% Ambiguous/.test(out), tag + "no line was refused on the router");
          const apIp = await BJ(p, () => window.__e4b.T.sim.addr("ap").ip);
          check(ips.length === 1 && ips[0] === apIp, tag + "show ip dhcp binding on the router: one lease on the old network, the access point's (" + ips.join(", ") + ")");
          check(!(await p.$eval('#net [data-d="ap"]', (n) => n.textContent)).includes(apIp), tag + "the logical diagram doesn't give the access point's address away");
          await dev(p, "mgr"); await tab(p, "Web browser"); W = await go(p, ips[0]);
          check(/Access point/.test(W) && /isn't broadcasting any network yet/.test(W), tag + "that address in the manager's PC's browser: the access point's page, no networks yet");
          await p.fill('.webpage input[name="ssid"]', a.net.ssid); await p.selectOption('.webpage select[name="sec"]', a.net.sec);
          await p.fill('.webpage input[name="psk"]', "short"); await p.fill('.webpage input[name="vlan"]', String(a.net.vlan));
          await p.click('.webpage button[type="submit"]'); await p.waitForTimeout(60);
          check(/Not saved: A WPA2 or WPA3 password is 8 to 63 characters/.test(await p.$eval(".webpage", (n) => n.textContent)), tag + "a password too short: not saved, and the page says why");
          await p.fill('.webpage input[name="psk"]', a.net.psk); await p.click('.webpage button[type="submit"]'); await p.waitForTimeout(60);
          W = await p.$eval(".webpage", (n) => n.textContent);
          check(new RegExp("Saved: " + a.net.ssid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " is broadcasting, tagged VLAN " + a.net.vlan).test(W) && /VLAN \d+Remove/.test(W), tag + "Save: the guest network is listed, tagged");
          continue;
        }
        if (a.t === "joinssid") {
          await dev(p, "guest"); await tab(p, "Wi-Fi");
          const li = () => p.locator(".pane .cabs li", { hasText: a.ssid });
          check(await li().count() === 1, tag + "the visitor's phone hears the guest network");
          await li().locator('input[name="pass"]').fill("not-the-password"); await li().locator("button").click(); await p.waitForTimeout(60);
          check(/the password was refused/.test(await p.$eval(".pane", (n) => n.textContent)), tag + "a wrong password typed on the phone: refused");
          await li().locator('input[name="pass"]').fill(a.pass); await li().locator("button").click(); await p.waitForTimeout(60);
          W = await p.$eval(".pane", (n) => n.textContent);
          check(/joined, address \d+\.\d+\.\d+\.\d+\. Internet: OK/.test(W) && /Connected to/.test(W), tag + "the guest password: joined, an address, the internet");
          continue;
        }
        await step(p, a);
      }
      const t = await checkJob(p), n = await BJ(p, () => window.__e4b.T.def.reqs.length);
      check(new RegExp(n + " of " + n + " met").test(t) && /Job .* done/.test(t), tag + "every line met through the page (" + (t.match(/\d+ of \d+ met/) || ["?"])[0] + ")");
      await dev(p, "ap"); await tab(p, "Physical");
      check(/light ring round its face: on, blue: on the network, broadcasting 1 network/.test(await p.$eval(".m3d-says", (n) => n.textContent)), tag + "the access point's Physical tab: its ring on, blue, broadcasting one network");
      await p.click("#vLog"); await p.waitForTimeout(60);
      const pn = await labelsClear(p, "net"); check(pn.n > 0 && !pn.out.length, tag + "the finished business's logical diagram: every name and port dot clear" + (pn.out.length ? " (" + pn.out.join("; ") + ")" : ""));
      await p.click("#vPhy"); await p.waitForTimeout(40);
      const fp = await labelsClear(p, "plan"); check(fp.n > 0 && !fp.out.length, tag + "the finished business's floor plan: every name clear" + (fp.out.length ? " (" + fp.out.join("; ") + ")" : ""));
      await dysClear(p, tag + "the finished business");
      await p.reload(); await p.waitForTimeout(350);
      check(/Job .* done/.test(await p.$eval("#check", (n) => n.textContent)), tag + "still done after a reload");
    } catch (e) { check(false, tag + "stopped: " + String(e.message).split("\n")[0]); }
    await ctx.close();
  }
}

console.log(errs.length ? "PAGE ERRORS\n" + [...new Set(errs)].join("\n") : "no page errors");
console.log(bad.length ? "FAIL\n" + bad.join("\n") : "PASS: " + steps + " checks, every built ticket worked end to end through the page (three houses each, plus one for every variant of a fault those missed), the views, the instructor tools, the reload");
await B.close(); srv.close();
process.exit(bad.length || errs.length ? 1 : 0);
