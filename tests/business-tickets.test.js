/* Tier 3 small-business tickets, checked on many generated businesses each:
   the fault shows in what a student would type (the switches' and the
   router's own show commands over SSH from a staff PC, ipconfig, ping), the
   board is one right and five near misses, the real fix works and is proven,
   the tempting wrong fixes don't (a fix that isn't saved works today, isn't
   the fix, and Mason says so), the ladder climbs as the program's rule says,
   a saved ticket replays exactly, and the business's records on the card
   carry what a technician needs to log in. A business takes half a second to
   build (SB-J1 to SB-J10 replayed), so fewer seeds than the office's 150. */
import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_TICKETS, businessRecords } from "../js/tickets/business.js";
import * as E from "../js/tickets/engine.js";
import { exec } from "../js/net/cmd.js";

const N = Number(process.env.SEEDS || 30);
const seeds = Array.from({ length: N }, (_, i) => 5000 + i * 7919);
const pc = (line) => ({ t: "cmd", dev: "pc", line }), mgr = (line) => ({ t: "cmd", dev: "mgr", line });
const out = (T, acts) => acts.map((a) => (E.act(T, a) || {}).out || "").join("");
/* SSH from the manager's PC to the closet switch, privileged; then configuration lines; then saved */
const ssh = (T) => { const p = T.v.plan; return [mgr("ssh " + p.user + "@" + p.swIp), mgr(p.userPw), mgr("enable"), mgr(p.swSecret)]; };
const conf = (T, lines) => ssh(T).concat([mgr("configure terminal")], lines.map(mgr), [mgr("end")]);
const SAVE = [mgr("copy running-config startup-config"), mgr("")];
const staff = (T) => T.v.plan.vlans.staff;

const FIX = {
  "SB-01": (T) => conf(T, ["interface gi0/1", "switchport access vlan " + staff(T).id]).concat(SAVE, [pc("ipconfig /renew")])
};
const PROOF = {
  "SB-01": (T) => [pc("ping " + T.v.printer)]
};
const UNSAVED = {
  "SB-01": (T) => conf(T, ["interface gi0/1", "switchport access vlan " + staff(T).id]).concat([pc("ipconfig /renew")])
};
/* tempting fixes that treat a symptom, or the wrong part: none may fix it */
const WRONG = {
  "SB-01": (T) => {
    const S = staff(T), p = T.v.plan, other = [p.vlans.guest, p.vlans.cameras, p.vlans.dept].find((x) => x.id !== T.v.vlan && x.id !== S.id);
    return [
      [pc("ipconfig /renew")], [{ t: "power", dev: "pc" }], [{ t: "power", dev: "msw" }, pc("ipconfig /renew")],
      [{ t: "client", dev: "pc", values: { mode: "static", ip: S.gw.replace(/\.1$/, ".99"), mask: "255.255.255.0", gw: S.gw, dns: p.dns } }],   /* a staff address typed in on a port still in another VLAN */
      conf(T, ["interface range gi0/1 , gi0/4 , gi0/7 - 22", "switchport access vlan " + S.id]).concat(SAVE, [pc("ipconfig /renew")]),   /* the checklist's range typed again with the staff VLAN: the PC back, every spare unparked with it (still shut) */
      conf(T, ["interface gi0/1", "switchport access vlan " + other.id]).concat(SAVE, [pc("ipconfig /renew")]),   /* the wrong VLAN again */
      conf(T, ["interface gi0/1", "shutdown", "no shutdown"]).concat(SAVE, [pc("ipconfig /renew")])
    ];
  }
};
const SYMPTOM = {
  "SB-01": (T) => {
    const v = T.v, ip = E.act(T, pc("ipconfig")).out;
    if (v.kind === "guest") { assert.match(ip, new RegExp("IPv4 Address[ .]*: " + v.plan.vlans.guest.net.replace(/0$/, "").replace(/\./g, "\\."))); assert.ok(E.act(T, pc("ping 8.8.8.8")).facts.replies > 0, "a guest gets out"); }
    else assert.match(ip, /Autoconfiguration IPv4 Address[ .]*: 169\.254\./);
    assert.match(E.act(T, pc("ipconfig /all")).out, /DHCP Enabled[ .]*: Yes/);
    assert.equal(E.act(T, pc("ping " + v.printer)).facts.replies, 0, "no printer");
    const o = out(T, ssh(T).concat([mgr("show interfaces status"), mgr("show interfaces gi0/1 switchport"), mgr("show vlan brief"), mgr("show running-config")]));
    assert.match(o, new RegExp("^Gi0/1\\s+\\S+\\s+connected\\s+" + v.vlan + "\\s", "m"));
    assert.match(o, new RegExp("Access Mode VLAN: " + v.vlan + " \\("));
    assert.match(o, new RegExp("interface GigabitEthernet0/1\\n description \\S+\\n switchport access vlan " + v.vlan + "\\n switchport mode access\\n"));
    assert.match(o, new RegExp("^Gi0/2\\s+MANAGER-PC\\s+connected\\s+" + staff(T).id + "\\s", "m"), "the manager's PC is still in the staff VLAN");
    assert.ok(E.act(T, mgr("exit")) && E.act(T, mgr("ping " + v.printer)).facts.replies > 0, "the manager's PC still prints");
  }
};

for (const def of BUSINESS_TICKETS) {
  test(def.id + ": the fault shows on every generated business, in the commands themselves", () => {
    let reseeded = 0;
    for (const s of seeds) { const T = E.open(def, s); if (T.seed !== s) reseeded++; assert.ok(def.exhibits(T.sim, T.v)); assert.equal(T.fixed, false); SYMPTOM[def.id](T); }
    assert.equal(reseeded, 0, "every seed should show its fault without moving on");
  });
  test(def.id + ": six options, one right, five near misses each with its reason", () => {
    for (const s of seeds.slice(0, 12)) {
      const T = E.open(def, s);
      assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1);
      for (const o of T.opts) { assert.ok(o.text && o.text.length > 10); if (!o.right) assert.ok(o.why && o.why.length > 20, o.id); }
      assert.equal(new Set(T.opts.map((o) => o.text)).size, 6);
    }
  });
  test(def.id + ": the real fix fixes it and is proven; the tempting wrong fixes don't; unsaved works but isn't the fix", () => {
    for (const s of seeds) {
      for (const wrong of WRONG[def.id](E.open(def, s))) {
        const T = E.open(def, s); for (const a of wrong) E.act(T, a);
        assert.equal(T.fixed, false, def.id + " seed " + s + " wrong fix " + JSON.stringify(wrong.map((a) => a.line || a.t)) + " should not fix");
      }
      let T = E.open(def, s);
      for (const a of UNSAVED[def.id](T)) E.act(T, a);
      assert.equal(T.fixed, false, def.id + " seed " + s + ": not saved isn't fixed");
      for (const a of PROOF[def.id](T)) E.act(T, a);
      assert.equal(T.proven, false); assert.ok(T.partial && /hasn't saved it/.test(T.partial), def.id + " seed " + s + ": Mason says it works but isn't saved (" + T.partial + ")");
      T = E.open(def, s); E.guess(T, "right");
      for (const a of FIX[def.id](T)) E.act(T, a);
      assert.equal(T.fixed, true, def.id + " seed " + s + " real fix");
      for (const a of PROOF[def.id](T)) E.act(T, a);
      assert.equal(T.proven, true, def.id + " seed " + s + " proof"); assert.equal(T.solved, true);
    }
  });
  test(def.id + ": a proof run before the fix does not count, the internet proves nothing, and nor does a ping to itself", () => {
    for (const s of seeds.slice(0, 6)) {
      const T = E.open(def, s); for (const a of PROOF[def.id](T)) E.act(T, a); assert.equal(T.proven, false);
      E.act(T, pc("ping 8.8.8.8")); E.act(T, { t: "print" });
      assert.equal(T.proven, false); assert.equal(T.partial, null, "a guest reaching the internet isn't the fix half done");
      E.guess(T, "right"); for (const a of FIX[def.id](T)) E.act(T, a); assert.equal(T.fixed, true);
      const byFix = T.proven;
      E.act(T, pc("ping 127.0.0.1")); E.act(T, pc("ping -n 6 " + T.sim.addr("pc").ip));
      assert.equal(T.proven, byFix, "pinging itself proves nothing");
      for (const a of PROOF[def.id](T)) E.act(T, a); assert.equal(T.proven, true);
    }
  });
  test(def.id + ": the ladder climbs 0, 0, rung 1, rung 2, then narrows to two after a reset, for ever", () => {
    const T = E.open(def, seeds[5]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
    assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0);
    assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
    assert.equal(E.guess(T, wrongs[3]).ruledOut, true, "a red pick stays red");
    E.resetBoard(T); assert.equal(E.live(T).length, 6); assert.equal(T.wrong, 4, "reset keeps the count");
    assert.equal(E.guess(T, wrongs[4]).rung, 3);
    const L = E.live(T); assert.equal(L.length, 2); assert.ok(L.some((o) => o.right)); assert.ok(T.struck.every((x) => x.why));
    for (let k = 0; k < 3; k++) { E.resetBoard(T); const w = E.live(T).find((o) => !o.right).id; assert.equal(E.guess(T, w).rung, 3); assert.equal(E.live(T).length, 2); }
  });
  test(def.id + ": a saved ticket replays exactly, the SSH session and the business's own pages included", () => {
    for (const s of seeds.slice(0, 8)) {
      const T = E.open(def, s);
      for (const a of ssh(T).concat([mgr("show interfaces status"), mgr("exit"), pc("ipconfig /all"), pc("ping -n 3 " + T.v.printer), { t: "print" },
        { t: "radio", dev: "guest", on: false }, { t: "radio", dev: "mphone", on: true }, { t: "joinssid", dev: "mphone", ssid: T.v.plan.guestSsid, pass: T.v.plan.guestPw }, { t: "cabinet", values: { key: true } }])) E.act(T, a);
      assert.ok(T.sim.wifiLink("mphone") && T.sim.wifiLink("mphone").connected && !(T.sim.wifiLink("guest") || {}).connected, "the pages' actions really changed the business (the visitor's Wi-Fi off, the manager's phone on the guests' network)");
      for (const a of FIX[def.id](T)) E.act(T, a);
      const R = E.restore(def, JSON.parse(JSON.stringify(E.save(T))));
      assert.equal(R.fixed, T.fixed); assert.deepEqual(R.evidence, T.evidence);
      assert.equal(JSON.stringify(R.sim.net), JSON.stringify(T.sim.net));
      assert.equal(exec(R.sim, "pc", "ping -n 5 " + T.v.printer).out.replace(/time[<=]\d+ms/g, ""), exec(T.sim, "pc", "ping -n 5 " + T.v.printer).out.replace(/time[<=]\d+ms/g, ""));
    }
  });
  test(def.id + ": the brief and every hint never name the right answer, a password, a VLAN number or the fix's command", () => {
    for (const s of seeds.slice(0, 12)) {
      const T = E.open(def, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
      const texts = [def.rung1(T.v, T.sim), def.rung2(T.v, T.sim), ...def.fixHints(T.v, T.sim), def.brief(T.v, T.sim).quote, def.mason].map((x) => x.toLowerCase());
      for (const x of texts) {
        assert.ok(x.indexOf(right) < 0, x);
        for (const bad of [p.rtSecret, p.rtConsole, p.swSecret, p.swConsole, p.userPw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, def.id + " names a password: " + x);
        for (const n of Object.values(p.vlans).map((V) => String(V.id))) assert.ok(!new RegExp("\\b" + n + "\\b").test(x), def.id + " names VLAN " + n + ": " + x);
        for (const cmd of ["switchport access", "switchport mode", "copy running-config", "write memory", "interface gi", "ipconfig /renew"]) assert.ok(x.indexOf(cmd) < 0, def.id + " names the fix's command: " + x);
      }
    }
  });
}

test("the business's records on the card carry every login, the switches' and router's addresses and the VLAN plan", () => {
  const T = E.open(BUSINESS_TICKETS[0], seeds[0]), p = T.v.plan, rows = businessRecords(T.v, T.sim), all = rows.map((r) => r[0] + ": " + r[1]).join("\n");
  for (const x of [p.rtHost, p.swHost, p.bswHost, p.rtSecret, p.rtConsole, p.swSecret, p.swConsole, p.user, p.userPw, p.swIp, p.vlans.staff.gw, p.printerIp]) assert.ok(all.indexOf(x) >= 0, "the records give " + x);
  for (const k of ["staff", "guest", "cameras", "printers", "dept", "native", "parking"]) assert.ok(rows.some((r) => / VLAN$/.test(r[0]) && new RegExp("^" + p.vlans[k].id + " · ").test(r[1])), "the VLAN plan gives " + k);
  for (const k of ["staff", "guest", "cameras", "printers", "dept"]) assert.ok(rows.some((r) => r[1].indexOf(p.vlans[k].net + "/") >= 0 && r[1].indexOf("gateway " + p.vlans[k].gw) >= 0), "and " + k + "'s block and gateway");
  /* the records are what a student logs in with: SSH to the closet switch and to the router from the manager's PC, the back switch at your laptop's console */
  assert.match(out(T, ssh(T).concat([mgr("show running-config")])), new RegExp("hostname " + p.swHost));
  E.act(T, mgr("exit"));
  assert.match(out(T, [mgr("ssh " + p.user + "@" + p.vlans.staff.gw), mgr(p.userPw), mgr("enable"), mgr(p.rtSecret), mgr("show running-config")]), new RegExp("hostname " + p.rtHost));
  E.act(T, mgr("exit"));
  const tech = (line) => ({ t: "cmd", dev: "tech", line, cli: true });
  assert.match(out(T, [tech(""), tech(p.swConsole), tech("enable"), tech(p.swSecret), tech("show running-config")]), new RegExp("hostname " + p.bswHost), "your laptop is on the back switch's console");
});

test("SB-01: an investigation from the PC and over SSH fills the notebook", () => {
  const def = BUSINESS_TICKETS[0], T = E.open(def, 4242);
  for (const a of [pc("ipconfig"), pc("ping " + T.v.printer)].concat(ssh(T), [mgr("show interfaces status"), mgr("show interfaces gi0/1 switchport"), mgr("show vlan brief"), mgr("show running-config")])) E.act(T, a);
  assert.deepEqual(T.evidence.map((e) => e.id), ["ipc", "noprint", "status", "swport", "vlans", "run"]);
});
