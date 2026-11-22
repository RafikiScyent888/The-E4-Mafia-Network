/* Level 4, work order 10: the central DHCP server. ISC's dhcpd on the file server (js/net/dhcpd.js, js/net/linux.js): its file read
   the way dhcpd reads it, with dhcpd's own messages; the service as systemd runs it (status, the journal, enabled or not, started at
   boot); the editor and its permissions; relayed requests answered from the file's subnets, with the options it gives, reservations,
   addresses that answer skipped, a pool that runs out, a network it doesn't know. Each on a campus as CP-J10 finds it. */
import test from "node:test";
import assert from "node:assert/strict";
import { CAMPUS_JOBS } from "../js/build/campus.js";
import * as B from "../js/build/engine.js";
import { Sim } from "../js/net/sim.js";
import { exec, editingOf } from "../js/net/cmd.js";
import * as D from "../js/net/dhcpd.js";
import { session, exec as swExec } from "../js/net/swcli.js";

const J10 = CAMPUS_JOBS.find((d) => d.id === "CP-J10"), J9 = CAMPUS_JOBS.find((d) => d.id === "CP-J9");
const base = B.open(J10, 5151), NET = JSON.stringify(base.sim.net);
const fresh = () => { const s = new Sim(JSON.parse(NET)); s.cli = {}; return s; };
const P = base.v.plan, S = P.srv, V = P.vlans;
const sh = (sim, id, line, text) => exec(sim, id, line, false, text);
const login = (sim) => { sh(sim, "fsrv", ""); sh(sim, "fsrv", S.user); return sh(sim, "fsrv", S.pw); };
const write = (sim, path, text) => { const r = sh(sim, "fsrv", "sudo nano " + path); const r2 = secretAsked(sim) ? sh(sim, "fsrv", S.pw) : r; const w = sh(sim, "fsrv", "^O", text); sh(sim, "fsrv", "^X"); return { open: r2, w: w }; };
const secretAsked = (sim) => sim.cli.fsrv && sim.cli.fsrv.lx.mode === "sudo";
const sub = (k, extra) => "subnet " + V[k].net + " netmask 255.255.255.0 {\n  range " + V[k].net.replace(/0$/, "21") + " " + V[k].net.replace(/0$/, "254") + ";\n  option routers " + V[k].gw + ";\n" + (extra || "") + "}\n";
const GOOD = "option domain-name-servers 203.0.113.53, 203.0.113.54;\ndefault-lease-time 86400;\n\nsubnet " + V.servers.net + " netmask 255.255.255.0 {\n}\n" + sub("svc") + sub("bench");
const IFACE = D.DEFAULTS_TEXT.replace('INTERFACESv4=""', 'INTERFACESv4="eno1"');
/* the service desk's relay on both distribution switches pointed at the file server */
function relayToServer(sim, k) {
  for (const id of ["dist1", "dist2"]) { const r = sim.d[id].sw.svis[V[k].id]; r.helpers = [S.fsrv.ip]; }
  sim.bump(); sim.leaseChanged();
}
const journal = (sim) => sim.d.fsrv.lx.dhcpd.journal.join("\n");

test("dhcpd reads its file as the real one does: the sample has no subnet; a missing semicolon, a bad subnet, a range off its net, an option it doesn't know, dashes in a hardware address, a brace never closed", () => {
  let c = D.parse(D.SAMPLE); assert.equal(c.errors.length, 0); assert.equal(c.subnets.length, 0); assert.deepEqual(c.global.opts["domain-name-servers"], ["ns1.example.org", "ns2.example.org"]); assert.equal(c.global.lease, 600);
  c = D.parse("subnet 10.1.2.0 netmask 255.255.255.0 {\n  range 10.1.2.21 10.1.2.254\n  option routers 10.1.2.1;\n}\n");
  assert.equal(c.errors[0].msg, "semicolon expected."); assert.equal(c.errors[0].line, 3, "dhcpd notices on the next line, where the next word is");
  let L = D.errorLines(c); assert.equal(L[0], D.CONF + " line 3: semicolon expected."); assert.equal(L[1], "  option routers 10.1.2.1;"); assert.equal(L[2], "  ^"); assert.equal(L[3], "Configuration file errors encountered -- exiting");
  c = D.parse("subnet 10.1.2.5 netmask 255.255.255.0 {\n}\n"); assert.match(c.errors[0].msg, /^subnet 10\.1\.2\.5 netmask 255\.255\.255\.0: bad subnet number\/mask combination\.$/);
  c = D.parse("subnet 10.1.2.0 netmask 255.255.255.0 {\n  range 10.1.3.21 10.1.3.254;\n}\n"); assert.equal(c.errors[0].msg, "Address range 10.1.3.21 to 10.1.3.254 not on net 10.1.2.0/255.255.255.0!");
  c = D.parse("option gateway 10.1.2.1;\n"); assert.equal(c.errors[0].msg, "no option named gateway in space dhcp");
  c = D.parse("host a {\n  hardware ethernet 02-11-22-33-44-55;\n  fixed-address 10.1.2.15;\n}\n"); assert.equal(c.errors[0].msg, "semicolon expected."); assert.equal(c.errors[0].col, 22, "under the first dash");
  c = D.parse("subnet 10.1.2.0 netmask 255.255.255.0 {\n  range 10.1.2.21 10.1.2.254;\n"); assert.equal(c.errors[0].msg, "unexpected end of file");
  c = D.parse("range 10.1.2.21 10.1.2.254;\n"); assert.equal(c.errors[0].msg, "range declaration not allowed here.");
  c = D.parse("subnet 10.1.2.0 netmask 255.255.255.0 {\n  range 10.1.2.10 10.1.2.254;\n}\nhost a {\n  hardware ethernet 02:11:22:33:44:55;\n  fixed-address 10.1.2.15;\n}\n");
  assert.equal(c.errors.length, 0); assert.deepEqual(c.warnings, ["Dynamic and static leases present for 10.1.2.15."]); assert.equal(c.hosts[0].mac, "02:11:22:33:44:55");
  assert.deepEqual(D.interfacesOf(IFACE), ["eno1"]); assert.deepEqual(D.interfacesOf(D.DEFAULTS_TEXT), []); assert.deepEqual(D.interfacesOf("INTERFACESv4=eno1\n"), ["eno1"]);
});

test("starting dhcpd: no subnet for a port means it ignores that port; no port to listen on, or a port that isn't there, and it exits", () => {
  const ifs = [{ name: "eno1", ip: "10.1.240.10", mask: "255.255.255.0", mac: "02:aa:bb:cc:dd:01" }, { name: "eno2", ip: "10.1.180.10", mask: "255.255.255.0", mac: "02:aa:bb:cc:dd:02" }];
  let r = D.start(D.SAMPLE, D.DEFAULTS_TEXT, ifs); assert.equal(r.ok, false); assert.equal(r.why, "nolisten");
  assert.ok(r.log.indexOf("No subnet declaration for eno1 (10.1.240.10).") >= 0 && r.log.indexOf("No subnet declaration for eno2 (10.1.180.10).") >= 0 && r.log.indexOf("Not configured to listen on any interfaces!") >= 0);
  r = D.start("subnet 10.1.240.0 netmask 255.255.255.0 {\n}\n", 'INTERFACESv4="eth0"', ifs); assert.equal(r.ok, false); assert.equal(r.why, "nodev"); assert.ok(r.log.some((l) => l === 'Error getting hardware address for "eth0": No such device'));
  r = D.start("subnet 10.1.240.0 netmask 255.255.255.0 {\n}\n", D.DEFAULTS_TEXT, ifs); assert.equal(r.ok, true); assert.deepEqual(r.listen, ["eno1"], "eno2's network isn't declared: ignored, not fatal");
  assert.ok(r.log.indexOf("Listening on LPF/eno1/02:aa:bb:cc:dd:01/10.1.240.0/24") >= 0 && r.log.indexOf("Server starting service.") >= 0);
  r = D.start("subnet 10.1.240.0 netmask 255.255.255.0 {\n}\nsubnet 10.1.180.0 netmask 255.255.255.0 {\n}\n", D.DEFAULTS_TEXT, ifs); assert.deepEqual(r.listen, ["eno1", "eno2"], "left empty, it serves the backup network too");
  r = D.start("subnet 10.1.240.0 netmask 255.255.255.0 {\n}\nsubnet 10.1.180.0 netmask 255.255.255.0 {\n}\n", IFACE, ifs); assert.deepEqual(r.listen, ["eno1"]);
});

test("the service: installed, failed and disabled; status and the journal say why; start and enable need sudo; a failed start is silent until you look; enabled, it starts at boot", () => {
  const sim = fresh(); login(sim);
  let r = sh(sim, "fsrv", "systemctl status isc-dhcp-server");
  assert.match(r.out, /^× isc-dhcp-server\.service - ISC DHCP IPv4 server/); assert.match(r.out, /; disabled; preset: enabled\)/); assert.match(r.out, /Active: failed \(Result: exit-code\) since Fri 2026-11-20 16:24:03 UTC; 2 days/);
  assert.match(sh(sim, "fsrv", "journalctl -u isc-dhcp-server").out, /Not configured to listen on any interfaces!/);
  assert.equal(sh(sim, "fsrv", "systemctl is-enabled isc-dhcp-server").out.trim(), "disabled");
  assert.match(sh(sim, "fsrv", "systemctl start isc-dhcp-server").out, /Failed to start isc-dhcp-server\.service: Interactive authentication required\./);
  r = sh(sim, "fsrv", "sudo systemctl restart isc-dhcp-server"); r = sh(sim, "fsrv", S.pw);
  assert.equal(r.out.trim(), "", "systemd starts dhcpd and says nothing: it exits a moment later");
  assert.match(sh(sim, "fsrv", "systemctl status isc-dhcp-server").out, /Active: failed \(Result: exit-code\) since Sun 2026-11-22/);
  write(sim, D.CONF, GOOD); write(sim, D.DEFAULTS, IFACE);
  assert.equal(sh(sim, "fsrv", "systemctl is-active isc-dhcp-server").out.trim(), "failed", "a file written changes nothing until it starts again");
  r = sh(sim, "fsrv", "sudo systemctl enable --now isc-dhcp-server"); assert.match(r.out, /Created symlink \/etc\/systemd\/system\/multi-user\.target\.wants\/isc-dhcp-server\.service/);
  r = sh(sim, "fsrv", "systemctl status isc-dhcp-server"); assert.match(r.out, /^● /); assert.match(r.out, /Active: active \(running\)/); assert.match(r.out, /-cf \/etc\/dhcp\/dhcpd\.conf eno1/); assert.match(r.out, /Listening on LPF\/eno1\//);
  assert.match(sh(sim, "fsrv", "sudo systemctl reload isc-dhcp-server").out, /Job type reload is not applicable/);
  sh(sim, "fsrv", "sudo reboot"); assert.equal(sim.d.fsrv.lx.dhcpd.state, "active", "enabled: it starts at boot");
  login(sim); sh(sim, "fsrv", "sudo systemctl disable isc-dhcp-server"); sh(sim, "fsrv", S.pw);
  sh(sim, "fsrv", "sudo reboot"); assert.equal(sim.d.fsrv.lx.dhcpd.state, "inactive", "disabled: it stays off after a restart");
  const s2 = fresh(); login(s2); write(s2, D.CONF, GOOD); sh(s2, "fsrv", "sudo systemctl enable isc-dhcp-server"); s2.apply({ t: "power", dev: "fsrv" }); assert.equal(s2.d.fsrv.lx.dhcpd.state, "active", "a restart from the Physical tab, the same");
});

test("the editor: without sudo the file opens unwritable and won't write; with sudo it writes; ^X leaves; the running server keeps the copy it read until it starts again", () => {
  const sim = fresh(); login(sim);
  let r = sh(sim, "fsrv", "nano " + D.CONF); assert.equal(r.edit.status, "[ File '" + D.CONF + "' is unwritable ]"); assert.equal(r.edit.text, D.SAMPLE); assert.ok(editingOf(sim, "fsrv"));
  r = sh(sim, "fsrv", "^O", GOOD); assert.equal(r.edit.status, "[ Error writing " + D.CONF + ": Permission denied ]"); assert.equal(sim.d.fsrv.lx.files[D.CONF].text, D.SAMPLE);
  sh(sim, "fsrv", "^X"); assert.equal(editingOf(sim, "fsrv"), null);
  assert.match(sh(sim, "fsrv", "cat " + D.CONF).out, /Sample configuration file for ISC dhcpd/, "the file is readable by anyone");
  const w = write(sim, D.CONF, GOOD); assert.equal(w.open.edit.status, "[ Read 71 lines ]"); assert.equal(w.w.edit.status, "[ Wrote " + (GOOD.split("\n").length - 1) + " lines ]");
  assert.equal(sh(sim, "fsrv", "cat " + D.CONF).out.trim(), GOOD.trim());
  assert.match(sh(sim, "fsrv", "vim " + D.CONF).out, /The editor on this console is nano/);
  write(sim, D.DEFAULTS, IFACE); sh(sim, "fsrv", "sudo systemctl start isc-dhcp-server"); assert.equal(sim.d.fsrv.lx.dhcpd.state, "active");
  write(sim, D.CONF, GOOD + sub("office"));
  assert.ok(!sim.d.fsrv.lx.dhcpd.run.conf.subnets.some((x) => x.net === V.office.net), "still running the copy it read at start");
  relayToServer(sim, "office"); exec(sim, "mgr", "ipconfig /release"); exec(sim, "mgr", "ipconfig /renew");
  assert.ok(!sim.d.mgr.ifaces[0].lease, "the office's PCs still unanswered: the running server hasn't read the new subnet");
  sh(sim, "fsrv", "sudo systemctl restart isc-dhcp-server"); assert.ok(sim.d.fsrv.lx.dhcpd.run.conf.subnets.some((x) => x.net === V.office.net));
  exec(sim, "mgr", "ipconfig /renew"); assert.equal(sim.d.mgr.ifaces[0].lease && sim.d.mgr.ifaces[0].lease.server, S.fsrv.ip, "restarted, it answers them");
  const t = sh(sim, "fsrv", "dhcpd -t -cf " + D.CONF); assert.match(t.out, /Config file: \/etc\/dhcp\/dhcpd\.conf/);
  write(sim, D.CONF, GOOD.replace("default-lease-time 86400;", "default-lease-time 86400"));
  assert.match(sh(sim, "fsrv", "dhcpd -t -cf " + D.CONF).out, /line \d+: semicolon expected\.\n[\s\S]*Configuration file errors encountered -- exiting/);
});

test("a relayed request: the lease from the file's subnet (its gateway, the DNS servers, the lease time) and the exchange in the log; a release; a network it doesn't know; an address that answers skipped; a reservation; a pool that runs out", () => {
  const sim = fresh(); login(sim);
  write(sim, D.CONF, GOOD + "host hd {\n  hardware ethernet " + D.macNorm(sim.d.hd1.ifaces[0].mac) + ";\n  fixed-address " + P.dhcp.resv.ip + ";\n}\n"); write(sim, D.DEFAULTS, IFACE);
  sh(sim, "fsrv", "sudo systemctl start isc-dhcp-server"); relayToServer(sim, "svc");
  exec(sim, "sd1", "ipconfig /release"); exec(sim, "sd1", "ipconfig /renew");
  const l = sim.d.sd1.ifaces[0].lease; assert.equal(l.server, S.fsrv.ip); assert.equal(l.gw, V.svc.gw); assert.deepEqual(l.dns, ["203.0.113.53", "203.0.113.54"]); assert.equal(l.hours, 24); assert.equal(l.ip, V.svc.net.replace(/0$/, "21"));
  const m = D.macNorm(sim.d.sd1.ifaces[0].mac), J = journal(sim);
  assert.match(J, new RegExp("DHCPDISCOVER from " + m + " via " + V.svc.net.replace(/0$/, "2"))); assert.match(J, new RegExp("DHCPACK on " + l.ip.replace(/\./g, "\\.") + " to " + m + " \\(RIT-SERVICE-DESK-PC\\)"));
  assert.match(sh(sim, "fsrv", "dhcp-lease-list").out, new RegExp(m + "\\s+" + l.ip.replace(/\./g, "\\.")));
  assert.match(sh(sim, "fsrv", "cat " + D.LEASES).out, new RegExp("lease " + l.ip.replace(/\./g, "\\.") + " \\{[\\s\\S]*hardware ethernet " + m));
  exec(sim, "hd1", "ipconfig /release"); exec(sim, "hd1", "ipconfig /renew"); assert.equal(sim.d.hd1.ifaces[0].lease.ip, P.dhcp.resv.ip, "the reservation");
  exec(sim, "sd1", "ipconfig /release"); assert.match(journal(sim), /DHCPRELEASE of [\d.]+ from [0-9a-f:]+ \(RIT-SERVICE-DESK-PC\) via [\d.]+ \(found\)/);
  relayToServer(sim, "office"); exec(sim, "mgr", "ipconfig /release"); exec(sim, "mgr", "ipconfig /renew");
  assert.ok(!sim.d.mgr.ifaces[0].lease, "no subnet for the office network: no answer"); assert.match(journal(sim), /via [\d.]+: unknown network segment/);
  /* an address something already answers on is skipped (dhcpd pings first); a range of one runs out */
  const s2 = fresh(); login(s2); write(s2, D.CONF, GOOD.replace(sub("svc"), sub("svc").replace(/range [\d.]+ [\d.]+;/, "range " + V.svc.net.replace(/0$/, "22") + " " + V.svc.net.replace(/0$/, "22") + ";"))); write(s2, D.DEFAULTS, IFACE);
  sh(s2, "fsrv", "sudo systemctl start isc-dhcp-server"); relayToServer(s2, "svc");
  exec(s2, "sd1", "ipconfig /release"); exec(s2, "sd1", "ipconfig /renew");
  assert.ok(!s2.d.sd1.ifaces[0].lease, "the help desk PC still answers at .22 (the edge router lent it): the one address is taken"); assert.match(journal(s2), /Abandoning IP address [\d.]+\.22: pinged before offer/); assert.match(journal(s2), /no free leases/);
});

test("a running server hears a relay only on a port it listens on: told to serve the backup network alone, the desks' requests to eno1 go unanswered", () => {
  const sim = fresh(); login(sim);
  write(sim, D.CONF, GOOD + "subnet " + P.backup.net + " netmask 255.255.255.0 {\n}\n"); write(sim, D.DEFAULTS, D.DEFAULTS_TEXT.replace('INTERFACESv4=""', 'INTERFACESv4="eno2"'));
  sh(sim, "fsrv", "sudo systemctl start isc-dhcp-server"); assert.equal(sim.d.fsrv.lx.dhcpd.state, "active"); assert.deepEqual(sim.d.fsrv.lx.dhcpd.run.listen, ["eno2"]);
  relayToServer(sim, "svc"); exec(sim, "sd1", "ipconfig /release"); exec(sim, "sd1", "ipconfig /renew");
  assert.ok(!sim.d.sd1.ifaces[0].lease, "nothing answers on eno1"); assert.ok(!/DHCPDISCOVER/.test(journal(sim)), "and nothing reaches dhcpd");
});

test("what a lease can't carry, and an answer that can't get back: DNS servers given by name reach no PC; with the servers network's shared gateway taken off both switches, the server hears the relay but its answer has no way back", () => {
  let sim = fresh(); login(sim); write(sim, D.CONF, GOOD.replace(/option domain-name-servers [^;]+;/, "option domain-name-servers ns1.example.org, ns2.example.org;")); write(sim, D.DEFAULTS, IFACE);
  sh(sim, "fsrv", "sudo systemctl start isc-dhcp-server"); relayToServer(sim, "svc"); exec(sim, "sd1", "ipconfig /release"); exec(sim, "sd1", "ipconfig /renew");
  assert.equal(sim.d.sd1.ifaces[0].lease.server, S.fsrv.ip); assert.deepEqual(sim.d.sd1.ifaces[0].lease.dns, [], "names, which dhcpd can't look up here: no DNS servers at all");
  sim = fresh(); login(sim); write(sim, D.CONF, GOOD); write(sim, D.DEFAULTS, IFACE); sh(sim, "fsrv", "sudo systemctl start isc-dhcp-server"); relayToServer(sim, "svc");
  for (const id of ["dist1", "dist2"]) { const Q = session(sim.d[id].sw); ["", P.console, "enable", P.secret, "configure terminal", "interface vlan " + V.servers.id, "no standby " + V.servers.id, "end"].forEach((l) => swExec(Q, l)); }
  sim.bump(); sim.leaseChanged(); sim.relink(sim.links());
  exec(sim, "sd1", "ipconfig /release"); exec(sim, "sd1", "ipconfig /renew");
  assert.ok(!sim.d.sd1.ifaces[0].lease, "the server's gateway gone: its answer can't get back to the relay");
});

test("working it out changes nothing: a check of who answers a PC's request leaves the server's log and leases as they were", () => {
  const sim = fresh(); login(sim); write(sim, D.CONF, GOOD); write(sim, D.DEFAULTS, IFACE); sh(sim, "fsrv", "sudo systemctl start isc-dhcp-server"); relayToServer(sim, "svc");
  const before = JSON.stringify(sim.d.fsrv.lx.dhcpd);
  assert.ok(sim.dhcpServers("sd1").some((k) => /^fsrv@relay\|/.test(k))); B.check({ def: J10, sim: sim, v: base.v, fails: {}, checks: 0, net: [] });
  assert.equal(JSON.stringify(sim.d.fsrv.lx.dhcpd), before);
});

test("before the package: CP-J9's file server has no DHCP server at all", () => {
  const J = B.open(J9, 5151), sim = J.sim; sim.cli = {}; login(sim);
  assert.equal(sh(sim, "fsrv", "systemctl status isc-dhcp-server").out.trim(), "Unit isc-dhcp-server.service could not be found.");
  assert.equal(sh(sim, "fsrv", "dhcpd -t").out.trim(), "dhcpd: command not found");
  assert.ok(!/dhcpd\.conf/.test(sh(sim, "fsrv", "help").out), "its help doesn't list the DHCP server's commands");
  assert.match(sh(sim, "fsrv", "cat " + D.CONF).out, /No such file or directory/);
});
