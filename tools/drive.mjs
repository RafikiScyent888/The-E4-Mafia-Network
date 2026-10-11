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
const { HOME_TICKETS } = await import("../js/tickets/home.js"); const EN = await import("../js/tickets/engine.js");
/* three houses each, plus more until every variant of the fault (which end, which kind) has been driven through the page */
function seedsFor(id) {
  const def = HOME_TICKETS.find((d) => d.id === id), key = (T) => JSON.stringify([T.v.kind, T.v.end, T.v.kink]), out = [11, 2025, 777777], seen = new Set(out.map((s) => key(EN.open(def, s))));
  for (let s = 1; s < 400; s++) { const k = key(EN.open(def, s)); if (!seen.has(k)) { seen.add(k); out.push(s); } }
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
  await ctx.addInitScript(([t, s]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("e4-network-v1", JSON.stringify({ current: t, t: { [t]: { seed: s } }, solved: {} })); sessionStorage.setItem("seeded", "1"); } }, [ticket, seed]);
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(ticket + ": " + e.message));
  await p.goto(base + (file || "index.html")); await p.waitForTimeout(350);
  if (plant) await p.evaluate(plant);
  return { p, ctx };
}
const dev = async (p, id) => { await p.click('#devtabs [data-d="' + id + '"]'); await p.waitForTimeout(40); };
const tab = async (p, name) => { await p.click('.win-tabs button:text-is("' + name + '")'); await p.waitForTimeout(40); };
const type = async (p, line) => { await p.fill(".term .cmdin", line); await p.press(".term .cmdin", "Enter"); await p.waitForTimeout(40); };
const term = (p) => p.$eval(".term pre", (n) => n.textContent);
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

for (const [id, plan] of Object.entries(PLAN).filter(([k]) => !process.env.ONLY || k === process.env.ONLY)) for (const seed of seedsFor(id)) {
  let { p, ctx } = await page(id, seed);
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
  const qtext = await p.$eval('#queue [data-t="' + id + '"]', (n) => n.textContent);
  check(/Solved 1×|solved 1×/.test(qtext), id + ": the queue counts it solved (" + qtext + ")");
  check(await p.$eval('#queue [data-t="' + id + '"] .st', (n) => getComputedStyle(n).borderTopStyle === "none" && parseFloat(getComputedStyle(n).paddingTop) === 0), id + ": the solved status is words in the queue, not the summary's box");
  const s1 = await T(p, () => window.__e4.T.seed);
  await p.click('#board button:text-is("Try another one like this")'); await p.waitForTimeout(80);
  check((await T(p, () => window.__e4.T.seed)) !== s1 && !(await T(p, () => window.__e4.T.solved)), id + ": a fresh house, unsolved");
  await ctx.close();
}

/* the three views share the ticket; each left column opens tickets; the map and the plan open devices */
{
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
{
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

console.log(errs.length ? "PAGE ERRORS\n" + [...new Set(errs)].join("\n") : "no page errors");
console.log(bad.length ? "FAIL\n" + bad.join("\n") : "PASS: " + steps + " checks, every built ticket worked end to end through the page (three houses each, plus one for every variant of a fault those missed), the views, the instructor tools, the reload");
await B.close(); srv.close();
process.exit(bad.length || errs.length ? 1 : 0);
