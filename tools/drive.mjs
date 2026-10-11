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
  }
};

for (const [id, plan] of Object.entries(PLAN).filter(([k]) => !process.env.ONLY || k === process.env.ONLY)) for (const seed of [11, 2025, 777777]) {
  let { p, ctx } = await page(id, seed);
  const v = await T(p, () => window.__e4.T.v), gw = await T(p, () => window.__e4.T.sim.d.router.lan.ip);
  check(await T(p, () => window.__e4.T.def.exhibits(window.__e4.T.sim, window.__e4.T.v)), id + " " + seed + ": fault present at load");
  await plan.look(p);
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
  check(await p.$("#board .solved") !== null && /Ticket .* solved/.test(await p.$eval("#board .solved h3", (n) => n.textContent).catch(() => "")), id + " " + seed + ": solved through the page");
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
  await ctx.close();
}
console.log(errs.length ? "PAGE ERRORS\n" + [...new Set(errs)].join("\n") : "no page errors");
console.log(bad.length ? "FAIL\n" + bad.join("\n") : "PASS: " + steps + " checks, every built ticket worked end to end through the page (3 houses each), the views, the reload");
await B.close(); srv.close();
process.exit(bad.length || errs.length ? 1 : 0);
