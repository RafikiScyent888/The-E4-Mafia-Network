/* Level 4, work order 9: the rack servers' Linux command line (js/net/linux.js), their two ports in the simulation, MTU and jumbo frames
   (a switch's system jumbo MTU waiting for a reload, a frame too big dropped at the first switch it's over, counted as a giant), and SSH
   to a server from a desk PC. Each on a campus as CP-J9 finds it. */
import test from "node:test";
import assert from "node:assert/strict";
import { CAMPUS_JOBS } from "../js/build/campus.js";
import * as B from "../js/build/engine.js";
import { Sim } from "../js/net/sim.js";
import { exec, prompt, secretNext } from "../js/net/cmd.js";
import { newSwitch, session, exec as swExec } from "../js/net/swcli.js";

const J9 = CAMPUS_JOBS.find((d) => d.id === "CP-J9");
const base = B.open(J9, 4242), NET = JSON.stringify(base.sim.net);
const fresh = () => new Sim(JSON.parse(NET));
const P = base.v.plan, S = P.srv, Bk = P.backup;
const sh = (sim, id, line, win) => exec(sim, id, line, win);
const login = (sim, id) => { sh(sim, id, ""); sh(sim, id, S.user); return sh(sim, id, S.pw); };
const lay = (sim, a, b) => sim.apply({ t: "lay", a: a, b: b });
/* the backup server racked and cabled, its switch ports opened in their VLANs (the backup VLAN made on the 2F switch only, so the two
   servers' backup ports aren't joined yet) */
function racked(sim) {
  sim.apply({ t: "place", dev: "bksrv", room: "c2" });
  lay(sim, { dev: "bksrv", port: "eno1" }, { dev: "acc2", port: S.bksrv.ports.eno1 }); lay(sim, { dev: "bksrv", port: "eno2" }, { dev: "acc2", port: S.bksrv.ports.eno2 });
  const sw = sim.d.acc2.sw, Q = session(sw);
  ["", P.console, "enable", P.secret, "configure terminal", "vlan " + Bk.id, "name " + Bk.name, "exit", "interface gi0/5", "switchport mode access", "switchport access vlan " + P.vlans.servers.id, "no shutdown", "exit", "interface gi0/6", "switchport mode access", "switchport access vlan " + Bk.id, "no shutdown", "end"].forEach((l) => swExec(Q, l));
  sim.bump(); sim.relink(sim.links()); return sim;
}

test("a server's console: its login prompt, a wrong password refused, bash's prompt, sudo asking once, logout back to the login prompt", () => {
  const sim = fresh();
  assert.equal(prompt(sim, "fsrv"), S.fsrv.host + " login: ");
  sh(sim, "fsrv", S.user); assert.equal(prompt(sim, "fsrv"), "Password: "); assert.ok(secretNext(sim, "fsrv"));
  let r = sh(sim, "fsrv", "wrong-pw"); assert.match(r.out, /Login incorrect/); assert.equal(prompt(sim, "fsrv"), S.fsrv.host + " login: ");
  r = login(sim, "fsrv"); assert.match(r.out, /Welcome to Ubuntu 24\.04/); assert.equal(prompt(sim, "fsrv"), S.user + "@" + S.fsrv.host + ":~$ ");
  r = sh(sim, "fsrv", "sudo ip link set dev eno2 mtu 9000"); assert.equal(prompt(sim, "fsrv"), "[sudo] password for " + S.user + ": "); assert.ok(secretNext(sim, "fsrv"));
  r = sh(sim, "fsrv", "nope"); assert.match(r.out, /Sorry, try again\./);
  r = sh(sim, "fsrv", S.pw); assert.equal(sim.d.fsrv.ifaces[1].mtu, 9000, "the second password works and the command runs");
  r = sh(sim, "fsrv", "sudo ip link set dev eno2 mtu 1500"); assert.equal(sim.d.fsrv.ifaces[1].mtu, 1500, "sudo doesn't ask again this session");
  r = sh(sim, "fsrv", "sudo -i"); assert.equal(prompt(sim, "fsrv"), "root@" + S.fsrv.host + ":~# ");
  sh(sim, "fsrv", "exit"); assert.equal(prompt(sim, "fsrv"), S.user + "@" + S.fsrv.host + ":~$ ");
  r = sh(sim, "fsrv", "__root__"); assert.match(r.out, /command not found/); assert.equal(prompt(sim, "fsrv"), S.user + "@" + S.fsrv.host + ":~$ ", "no way to root but sudo");
  r = sh(sim, "fsrv", "exit"); assert.equal(prompt(sim, "fsrv"), S.fsrv.host + " login: ");
});

test("ip shows each port's state, MTU and address; ip link set needs root and stays within the card's range; ip route", () => {
  const sim = fresh(); login(sim, "fsrv");
  let r = sh(sim, "fsrv", "ip a");
  assert.match(r.out, /2: eno1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 .*state UP/);
  assert.match(r.out, new RegExp("inet " + S.fsrv.ip.replace(/\./g, "\\.") + "/24 brd"));
  assert.match(r.out, /3: eno2: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 .*state DOWN/, "its backup port's switch port is parked and shut");
  r = sh(sim, "fsrv", "ip -br a"); assert.match(r.out, /eno1\s+UP\s+/); assert.match(r.out, /eno2\s+DOWN\s+/);
  r = sh(sim, "fsrv", "ip link set dev eno2 mtu 9000"); assert.match(r.out, /RTNETLINK answers: Operation not permitted/); assert.equal(sim.d.fsrv.ifaces[1].mtu, 1500);
  sh(sim, "fsrv", "sudo ip link set dev eno2 mtu 9300"); r = sh(sim, "fsrv", S.pw); assert.match(r.out, /mtu greater than device maximum/);
  r = sh(sim, "fsrv", "sudo ip link set dev eno9 mtu 9000"); assert.match(r.out, /Cannot find device "eno9"/);
  r = sh(sim, "fsrv", "ip route"); assert.match(r.out, new RegExp("default via " + P.vlans.servers.gw.replace(/\./g, "\\.") + " dev eno1"));
  assert.match(r.out, new RegExp(Bk.net.replace(/\./g, "\\.") + "/24 dev eno2 proto kernel scope link src " + S.fsrv.bip.replace(/\./g, "\\.") + " linkdown"));
  r = sh(sim, "fsrv", "frobnicate"); assert.match(r.out, /frobnicate: command not found/);
});

test("netplan: the file needs root; set writes the file only; apply puts it into effect; a reboot keeps it, and loses what ip link alone set", () => {
  const sim = fresh(); login(sim, "fsrv");
  let r = sh(sim, "fsrv", "cat /etc/netplan/50-cloud-init.yaml"); assert.match(r.out, /Permission denied/);
  r = sh(sim, "fsrv", "netplan get"); assert.match(r.out, /PermissionError/);
  sh(sim, "fsrv", "sudo netplan get ethernets.eno2.mtu"); r = sh(sim, "fsrv", S.pw); assert.equal(r.out.trim(), "null");
  sh(sim, "fsrv", "sudo netplan set ethernets.eno2.mtu=9000"); assert.equal(sim.d.fsrv.ifaces[1].mtu, 1500, "set writes the file, nothing more");
  r = sh(sim, "fsrv", "sudo cat /etc/netplan/50-cloud-init.yaml"); assert.match(r.out, /eno2:\n {6}addresses:\n {6}- "[\d.]+\/24"\n {6}mtu: 9000/);
  sh(sim, "fsrv", "sudo netplan apply"); assert.equal(sim.d.fsrv.ifaces[1].mtu, 9000);
  sh(sim, "fsrv", "sudo ip link set dev eno1 mtu 4000"); assert.equal(sim.d.fsrv.ifaces[0].mtu, 4000);
  r = sh(sim, "fsrv", "sudo reboot"); assert.match(r.out, /The system will reboot now!/); assert.equal(prompt(sim, "fsrv"), S.fsrv.host + " login: ");
  assert.equal(sim.d.fsrv.ifaces[0].mtu, 1500, "ip link's 4000 is gone"); assert.equal(sim.d.fsrv.ifaces[1].mtu, 9000, "the netplan file's 9000 stays");
  login(sim, "fsrv"); r = sh(sim, "fsrv", "sudo netplan set ethernets.eno2.mtu=lots"); r = sh(sim, "fsrv", S.pw); assert.match(r.out, /invalid unsigned int value 'lots'/);
  r = sh(sim, "fsrv", "sudo netplan set ethernets.eno7.mtu=9000"); assert.match(r.out, /unknown interface 'eno7'/);
});

test("a server's two ports are two nodes: never bridged, each answering on its own network; a desk PC can't reach the backup network", () => {
  const sim = racked(fresh());
  const r1 = sim.route("sd1", S.bksrv.ip); assert.ok(!r1.fail && (r1.local || r1.routed), "the service desk reaches the backup server's own address");
  const r2 = sim.route("sd1", S.bksrv.bip); assert.ok(r2.fail, "the backup network isn't routed: " + JSON.stringify(r2.fail));
  assert.notEqual(sim.ifNode("bksrv", 0), sim.ifNode("bksrv", 1));
  const dom = sim.domain(sim.ifNode("bksrv", 1)); assert.ok(!dom.has("bksrv"), "its backup port's network doesn't reach its own port 1");
  assert.equal(sim.macOf("bksrv", S.bksrv.bip), sim.d.bksrv.ifaces[1].mac);
  const links = sim.switchLinks("acc2"); assert.equal(links["GigabitEthernet0/6"].mac.replace(/\./g, ""), sim.d.bksrv.ifaces[1].mac.replace(/-/g, ""), "the switch sees the backup port's own hardware address");
});

test("jumbo frames: a frame over a switch's MTU is dropped there and counted as a giant; over the receiver's, dropped as it arrives; a big ping that mustn't be cut up says so", () => {
  const sim = racked(fresh());
  /* join the two backup ports at the ordinary size: the backup VLAN up the 1F switch's uplinks, across both distribution switches, down the 2F's */
  const conf = (id, lines) => { const Q = session(sim.d[id].sw); ["", P.console, "enable", P.secret, "configure terminal"].concat(lines, ["end"]).forEach((l) => swExec(Q, l)); };
  conf("acc1", ["vlan " + Bk.id, "exit", "interface range gi0/23 - 24", "switchport trunk allowed vlan add " + Bk.id, "exit", "interface gi0/6", "switchport mode access", "switchport access vlan " + Bk.id, "no shutdown", "exit"]);
  ["dist1", "dist2"].forEach((id) => conf(id, ["vlan " + Bk.id, "exit", "interface range gi0/1 - 2", "switchport trunk allowed vlan add " + Bk.id, "exit", "interface port-channel 1", "switchport trunk allowed vlan add " + Bk.id, "exit"]));
  conf("acc2", ["interface range gi0/23 - 24", "switchport trunk allowed vlan add " + Bk.id, "exit"]);
  sim.bump(); sim.relink(sim.links());
  assert.ok(sim.sized("fsrv", S.bksrv.bip, 84, true).ok, "the ordinary size gets through");
  assert.equal(sim.sized("fsrv", S.bksrv.bip, 9000, true).why, "local", "the file server's own MTU refuses it first");
  login(sim, "fsrv"); let r = sh(sim, "fsrv", "ping -M do -s 8972 -c 4 " + S.bksrv.bip);
  assert.match(r.out, /8972\(9000\) bytes of data/); assert.match(r.out, /ping: local error: message too long, mtu=1500/); assert.match(r.out, /4 packets transmitted, 0 received, \+4 errors, 100% packet loss/);
  sh(sim, "fsrv", "sudo ip link set dev eno2 mtu 9000"); sh(sim, "fsrv", S.pw);
  const g = sim.sized("fsrv", S.bksrv.bip, 9000, true); assert.equal(g.why, "giant"); assert.equal(g.at.dev, "acc1", "dropped at the first switch on the way");
  const before = JSON.stringify(sim.net); sim.sized("fsrv", S.bksrv.bip, 9000, true); assert.equal(JSON.stringify(sim.net), before, "working it out changes nothing");
  r = sh(sim, "fsrv", "ping -M do -s 8972 -c 4 " + S.bksrv.bip); assert.match(r.out, /4 packets transmitted, 0 received, 100% packet loss/); assert.doesNotMatch(r.out, /bytes from/);
  assert.equal(sim.giantsAt("acc1", g.at.port), 4, "each one counted on the port it came in by");
  const Q = session(sim.d.acc1.sw); ["", P.console, "enable", P.secret].forEach((l) => swExec(Q, l)); sim.syncSwitch("acc1");
  assert.match(swExec(Q, "show interfaces " + g.at.port.replace("GigabitEthernet", "gi")).out.join("\n"), /\b4 giants/);
  /* every switch on the way made jumbo and reloaded; then the backup server's own port is the one too small */
  ["acc1", "dist1", "dist2", "acc2"].forEach((id) => conf(id, ["system mtu jumbo 9000", "end", "copy running-config startup-config", "", "reload", ""]));
  sim.bump(); sim.relink(sim.links());
  assert.equal(sim.sized("fsrv", S.bksrv.bip, 9000, true).why, "receiver");
  login(sim, "bksrv"); sh(sim, "bksrv", "sudo ip link set dev eno2 mtu 9000"); sh(sim, "bksrv", S.pw);
  assert.ok(sim.sized("fsrv", S.bksrv.bip, 9000, true).ok, "9000 bytes all the way, both ends and every switch");
  r = sh(sim, "fsrv", "ping -M do -s 8972 -c 2 " + S.bksrv.bip); assert.match(r.out, /8980 bytes from [\d.]+: icmp_seq=1 ttl=64/); assert.match(r.out, /2 packets transmitted, 2 received, 0% packet loss/);
});

test("system mtu jumbo waits for a reload, is in the configuration, and is lost at a reload if it wasn't saved", () => {
  for (const l3 of [false, true]) {
    const sw = newSwitch({ l3 }), Q = session(sw), run = (l) => swExec(Q, l).out.join("\n");
    ["", "enable", "configure terminal"].forEach(run);
    assert.match(run("system mtu jumbo 9000"), /will not take effect until the next reload/);
    assert.match(run("system mtu jumbo 9999"), /Invalid input/);
    run("end");
    assert.match(run("show system mtu"), /System Jumbo MTU size is 1500 bytes\nOn next reload, System Jumbo MTU will be 9000 bytes/);
    assert.match(run("show running-config"), /\nsystem mtu jumbo 9000\n/);
    assert.match(run("show interfaces gi0/1"), /MTU 1500 bytes/);
    run("reload"); run("no"); run("");   /* not saved: the factory settings come back */
    ["", "enable"].forEach(run); assert.match(run("show system mtu"), /System Jumbo MTU size is 1500 bytes\nRouting/);
    ["configure terminal", "system mtu jumbo 9000", "end", "copy running-config startup-config", "", "reload", ""].forEach(run);
    ["", "enable"].forEach(run); assert.match(run("show system mtu"), /System Jumbo MTU size is 9000 bytes\nRouting/); assert.match(run("show interfaces gi0/1"), /MTU 9000 bytes/);
  }
});

test("SSH from a desk PC to a server: its password, bash, exit closes the connection; three wrong passwords and it gives up", () => {
  const sim = racked(fresh());
  let r = sh(sim, "sd1", "ssh " + S.user + "@" + S.bksrv.ip); assert.equal(prompt(sim, "sd1"), S.user + "@" + S.bksrv.ip + "'s password: "); assert.ok(secretNext(sim, "sd1"));
  r = sh(sim, "sd1", S.pw); assert.match(r.out, /Welcome to Ubuntu/); assert.equal(prompt(sim, "sd1"), S.user + "@" + S.bksrv.host + ":~$ ");
  r = sh(sim, "sd1", "hostname"); assert.equal(r.out.trim(), S.bksrv.host);
  r = sh(sim, "sd1", "exit"); assert.match(r.out, new RegExp("Connection to " + S.bksrv.ip.replace(/\./g, "\\.") + " closed\\.")); assert.match(prompt(sim, "sd1"), /^C:\\Users\\/);
  sh(sim, "sd1", "ssh " + S.user + "@" + S.bksrv.ip); sh(sim, "sd1", "a"); sh(sim, "sd1", "b"); r = sh(sim, "sd1", "c");
  assert.match(r.out, /Permission denied \(publickey,password\)/); assert.match(prompt(sim, "sd1"), /^C:\\Users\\/);
  r = sh(sim, "sd1", "ssh " + S.user + "@" + S.bksrv.bip); assert.match(r.out, /Connection timed out|unreachable/, "the backup network isn't reached from a desk");
  /* a reboot over SSH closes it from the far end */
  sh(sim, "sd1", "ssh " + S.user + "@" + S.bksrv.ip); sh(sim, "sd1", S.pw); sh(sim, "sd1", "sudo reboot"); r = sh(sim, "sd1", S.pw);
  assert.match(r.out, /closed by remote host/); assert.match(prompt(sim, "sd1"), /^C:\\Users\\/);
});
