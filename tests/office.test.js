/* Level 2 groundwork: the managed switch's command line (js/net/swcli.js)
   and the IPAM sheet's checker (js/net/ipam.js). */
import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../js/net/swcli.js";
import { checkSheet, prefixOf } from "../js/net/ipam.js";

const LINKS = { "GigabitEthernet0/1": { mac: "0019.e8a1.0001" }, "GigabitEthernet0/2": { mac: "a4bb.6d12.0a02", speed: "100" } };
function login(sw) { const S = C.session(sw || C.newSwitch({ links: LINKS })); return S; }
function type(S, lines) { let r = null; const all = []; lines.forEach(function (l) { r = C.exec(S, l); all.push.apply(all, r.out); }); return { r: r, all: all }; }

test("a switch fresh from its box: no passwords, the factory name, user then privileged mode", () => {
  const S = login();
  assert.equal(C.promptOf(S), "Switch>");
  assert.equal(type(S, ["enable"]).r.prompt, "Switch#");
  assert.equal(type(S, ["configure terminal"]).r.prompt, "Switch(config)#");
  assert.equal(type(S, ["interface gi0/3"]).r.prompt, "Switch(config-if)#");
  assert.equal(type(S, ["line console 0"]).r.prompt, "Switch(config-line)#", "line works from inside interface mode, as on the real thing");
  assert.equal(type(S, ["end"]).r.prompt, "Switch#");
});

test("any unique start of a word works; an ambiguous or wrong one says so, with the caret under the bad word", () => {
  const S = login(); type(S, ["en"]);
  assert.equal(type(S, ["conf t"]).r.prompt, "Switch(config)#");
  type(S, ["end"]);
  assert.match(type(S, ["sh run"]).all.join("\n"), /hostname Switch/);
  assert.match(type(S, ["co ru st"]).all[0], /% Ambiguous command/, "co is configure or copy");
  const bad = C.exec(S, "show runing-config");
  assert.equal(bad.out[1], "% Invalid input detected at '^' marker.");
  assert.equal(bad.out[0].indexOf("^"), "Switch#".length + "show ".length, "the caret sits under the word that's wrong");
  assert.equal(C.exec(S, "show").out[0], "% Incomplete command.");
});

test("? lists what can come next; after letters, the words that start with them; Tab finishes a word", () => {
  const S = login();
  assert.ok(C.exec(S, "?").out.some((l) => /enable\s+Turn on privileged commands/.test(l)));
  type(S, ["enable"]);
  const h = C.exec(S, "show ?"); assert.ok(h.out.some((l) => /running-config/.test(l))); assert.equal(h.keep, "show ");
  assert.match(C.exec(S, "sh r?").out[0], /running-config/);
  type(S, ["configure terminal"]);
  assert.ok(C.exec(S, "do show ?").out.some((l) => /running-config/.test(l)), "do runs EXEC commands, and its help is EXEC's");
  assert.equal(C.complete(S, "hostn"), "hostname ");
  assert.equal(C.complete(S, "int"), "interface ");
});

test("an enable secret is asked for, three tries; it never shows in plain text", () => {
  const S = login(); type(S, ["enable", "configure terminal", "enable secret Ledger2026", "end", "disable"]);
  let r = C.exec(S, "enable"); assert.equal(r.prompt, "Password: "); assert.equal(r.secret, true);
  r = C.exec(S, "nope"); assert.equal(r.prompt, "Password: ");
  r = C.exec(S, "Ledger2026"); assert.equal(r.prompt, "Switch#");
  const run = type(S, ["show running-config"]).all.join("\n");
  assert.match(run, /enable secret 5 /); assert.doesNotMatch(run, /Ledger2026/);
  type(S, ["disable", "enable"]); type(S, ["a"]); type(S, ["b"]); r = C.exec(S, "c");
  assert.deepEqual(r.out, ["% Bad secrets"]); assert.equal(r.prompt, "Switch>");
});

test("the console asks for its password only when the line has a password and login", () => {
  const sw = C.newSwitch(); let S = login(sw);
  type(S, ["enable", "configure terminal", "line console 0", "password Closet42", "end"]);
  assert.equal(C.session(sw).mode, "user", "a password without login is never asked for");
  type(S, ["configure terminal", "line console 0", "login", "end"]);
  S = C.session(sw); assert.equal(S.mode, "login");
  assert.equal(C.exec(S, "Closet42").prompt, "Switch>");
});

test("only what's saved survives a reload; the reload asks to save unsaved changes", () => {
  const sw = C.newSwitch(); let S = login(sw);
  type(S, ["enable", "configure terminal", "hostname BL-CLOSET-SW1", "end"]);
  assert.equal(C.unsaved(sw), true);
  let r = C.exec(S, "reload"); assert.match(r.prompt, /Save\? \[yes\/no\]/);
  r = C.exec(S, "no"); assert.match(r.prompt, /Proceed with reload/);
  C.exec(S, "");
  assert.equal(sw.hostname, "Switch", "not saved: the factory name came back");
  S = login(sw); type(S, ["enable", "configure terminal", "hostname BL-CLOSET-SW1", "end", "copy running-config startup-config", ""]);
  assert.equal(C.unsaved(sw), false);
  C.reload(sw); assert.equal(sw.hostname, "BL-CLOSET-SW1", "saved: it survives");
  S = login(sw); type(S, ["enable", "configure terminal", "hostname OTHER", "end", "write memory"]); C.reload(sw); assert.equal(sw.hostname, "OTHER");
});

test("ports: shut and no shut, a forced speed the far end doesn't match, descriptions, ranges", () => {
  const sw = C.newSwitch({ links: LINKS }), S = login(sw);
  type(S, ["enable", "configure terminal", "interface gi0/1", "shutdown", "end"]);
  assert.match(type(S, ["show ip interface brief | include 0/1 "]).all.join("\n"), /GigabitEthernet0\/1\s+unassigned\s+YES unset\s+administratively down\s+down/);
  type(S, ["configure terminal", "interface gi0/1", "no shutdown", "speed 100", "end"]);
  assert.match(type(S, ["show interfaces status | include Gi0/1 "]).all[0], /\sconnected\s/, "forced 100 against a far end that negotiates: it links");
  sw.links["GigabitEthernet0/1"].speed = "1000";
  assert.match(type(S, ["show interfaces status | include Gi0/1 "]).all[0], /notconnect/, "100 against a fixed 1000: no link");
  type(S, ["configure terminal", "interface gi0/2", "description Front desk printer", "end"]);
  assert.match(type(S, ["show interfaces status | include Gi0/2 "]).all[0], /Front desk printer\s+connected/);
  type(S, ["configure terminal", "interface range gi0/13 - 24", "shutdown", "end"]);
  assert.equal(Object.keys(sw.ports).filter((n) => sw.ports[n].shutdown).length, 12);
  /* a list: each part names its own type; a single port is a part too */
  type(S, ["configure terminal", "interface range gi0/3 - 4 , gi0/7, gi0/25 - 28", "shutdown", "end"]);
  assert.deepEqual(["3", "4", "7", "25", "26", "27", "28"].map((k) => sw.ports["GigabitEthernet0/" + k].shutdown), [true, true, true, true, true, true, true]);
  assert.equal(Object.keys(sw.ports).filter((n) => sw.ports[n].shutdown).length, 19);
  type(S, ["configure terminal"]);
  for (const bad of ["interface range gi0/3 - 4 , 7", "interface range gi0/3 - 4 ,", "interface range gi0/9 - 5", "interface range gi0/27 - 29"]) assert.match(C.exec(S, bad).out[0], /Invalid input/, bad);
});

test("the switch's own address goes on VLAN 1; SSH needs a name and a domain before its keys", () => {
  const sw = C.newSwitch(), S = login(sw);
  type(S, ["enable", "configure terminal", "interface gi0/5"]);
  assert.match(C.exec(S, "ip address 192.168.40.2 255.255.255.0").out[0], /Invalid input/);
  type(S, ["interface vlan 1"]);
  assert.match(C.exec(S, "ip address 192.168.40.2 255.255.0.255").out[0], /Invalid input/, "not a mask");
  type(S, ["ip address 192.168.40.2 255.255.255.0", "no shutdown", "exit"]);
  assert.equal(sw.vlan1.ip, "192.168.40.2"); assert.equal(sw.vlan1.shutdown, false);
  assert.match(C.exec(S, "crypto key generate rsa modulus 2048").out[0], /domain-name first/);
  type(S, ["ip domain-name office.lan"]);
  assert.match(C.exec(S, "crypto key generate rsa modulus 2048").out[0], /hostname other than Switch/);
  type(S, ["hostname BL-CLOSET-SW1", "crypto key generate rsa", "2048", "line vty 0 15", "transport input ssh", "login local", "end"]);
  assert.equal(sw.rsa, 2048); assert.equal(sw.vty.transport, "ssh"); assert.equal(sw.vty.login, "local");
});

test("output filters: include, exclude, begin, section", () => {
  const S = login(); type(S, ["enable"]);
  assert.deepEqual(type(S, ["show running-config | include hostname"]).all, ["hostname Switch"]);
  assert.equal(type(S, ["show running-config | begin line con"]).all[0], "line con 0");
  assert.deepEqual(type(S, ["show running-config | section vty"]).all, ["line vty 0 15", " transport input telnet"]);
  assert.ok(type(S, ["show running-config | exclude interface"]).all.every((l) => !/interface/.test(l)));
});

test("no brand names anywhere: not in any output, prompt or help line", () => {
  const S = login(), seen = [];
  const walk = function (prefix) { const r = C.exec(S, prefix + "?"); seen.push.apply(seen, r.out); return r.out; };
  ["", "show ", "show ip ", "show interfaces "].forEach((p) => walk(p)); type(S, ["enable"]); ["", "show ", "copy ", "configure "].forEach((p) => walk(p));
  type(S, ["configure terminal"]); ["", "interface ", "line ", "ip ", "crypto key generate ", "no "].forEach((p) => walk(p));
  type(S, ["interface gi0/1"]); ["", "speed ", "duplex ", "no "].forEach((p) => walk(p));
  type(S, ["end"]); ["show version", "show running-config", "show interfaces gi0/1", "show interfaces status", "show mac address-table"].forEach((l) => seen.push.apply(seen, C.exec(S, l).out));
  assert.doesNotMatch(seen.join("\n"), /cisco|catalyst|\bios\b|juniper|aruba|netgear|tp-link/i);
});

/* ---------------------------------------------------------------- the IPAM sheet */
const GOOD = [
  { name: "Staff", hosts: 40, net: "192.168.40.0", mask: "/26", first: "192.168.40.1", last: "192.168.40.62", bc: "192.168.40.63", gw: "192.168.40.1" },
  { name: "Guests", hosts: 25, net: "192.168.40.64", mask: "255.255.255.224", first: "192.168.40.65", last: "192.168.40.94", bc: "192.168.40.95", gw: "192.168.40.65" },
  { name: "Printers", hosts: 10, net: "192.168.40.96", mask: "/28", first: "192.168.40.97", last: "192.168.40.110", bc: "192.168.40.111", gw: "192.168.40.97" },
  { name: "Gear", hosts: 6, net: "192.168.40.112", mask: "/29", first: "192.168.40.113", last: "192.168.40.118", bc: "192.168.40.119", gw: "192.168.40.113" }
];
const sheet = (rows) => checkSheet("192.168.40.0/24", rows);
const mod = (i, k, v) => GOOD.map((r, j) => (j === i ? Object.assign({}, r, { [k]: v }) : r));
const fields = (res) => res.issues.map((x) => x.field);

test("IPAM: a right VLSM plan passes every row, with no notes", () => {
  const res = sheet(GOOD); assert.ok(res.every((r) => r.ok && !r.notes.length), JSON.stringify(res));
  assert.equal(prefixOf("255.255.255.192"), 26); assert.equal(prefixOf("/29"), 29); assert.equal(prefixOf("255.0.255.0"), null);
});

test("IPAM: each kind of mistake is caught in the field it's in", () => {
  assert.deepEqual(fields(sheet(mod(0, "mask", "/27"))[0]).filter((f) => f === "mask"), ["mask"], "too small for 40 hosts");
  assert.ok(fields(sheet(mod(2, "net", "192.168.40.100"))[2]).includes("net"), "not where a /28 begins");
  const ov = sheet(mod(1, "net", "192.168.40.32"));
  assert.ok(ov[1].issues.some((x) => /Overlap/.test(x.text)) && ov[0].issues.some((x) => /Overlap/.test(x.text)), "an overlap shows on both rows");
  assert.ok(sheet(mod(3, "net", "192.168.41.0"))[3].issues.some((x) => /outside the office/.test(x.text)));
  assert.ok(sheet(mod(1, "gw", "192.168.40.1"))[1].issues.some((x) => x.field === "gw" && /outside this block/.test(x.text)));
  assert.ok(sheet(mod(1, "gw", "192.168.40.95"))[1].issues.some((x) => x.field === "gw" && /broadcast address/.test(x.text)));
  assert.ok(sheet(mod(1, "gw", "192.168.40.64"))[1].issues.some((x) => x.field === "gw" && /network address/.test(x.text)));
  ["first", "last", "bc"].forEach((k) => assert.ok(fields(sheet(mod(2, k, "192.168.40.105"))[2]).includes(k), k));
  assert.ok(sheet(mod(0, "mask", "/25"))[0].notes.length, "too big: a note that a smaller block would do");
  assert.equal(sheet([{ name: "X", hosts: 4 }])[0].empty, true);
});

test("IPAM: no message ever gives the right value away", () => {
  const right = GOOD.flatMap((r) => [r.net, r.first, r.last, r.bc, r.gw, r.mask.replace("/", "")]);
  const wrongs = [mod(0, "mask", "/27"), mod(2, "net", "192.168.40.100"), mod(1, "net", "192.168.40.32"), mod(2, "first", "192.168.40.99"), mod(2, "last", "192.168.40.109"), mod(2, "bc", "192.168.40.112"), mod(1, "gw", "192.168.40.1")];
  wrongs.forEach((rows) => sheet(rows).forEach((r, i) => r.issues.forEach((x) => {
    right.filter((v) => v !== rows[i].net && v !== rows[i].gw).forEach((v) => { if (/\./.test(v)) assert.ok(!new RegExp("(^|[^\\d.])" + v.replace(/\./g, "\\.") + "(?![\\d.]*\\d)").test(x.text), "gave away " + v + ": " + x.text); });   /* whole addresses only: .100 is not .1 */
  })));
});
