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
/* every variant on every run: the seeds, plus a business for each variant they miss (a ticket picks its variant first, from the seed
   alone, so it's found without building anything). Without it, SEEDS=6 left a variant of SB-03, SB-06, SB-09 and SB-10 untried */
import { rng, hash } from "../js/net/util.js";
const seedsOf = (def, n) => { const base = seeds.slice(0, n || seeds.length); if (!def.kinds) return base; const kind = (s) => rng(hash(def.id + ":" + s)).pick(def.kinds), have = new Set(base.map(kind)), extra = [];
  for (let s = 1; have.size < def.kinds.length && s < 2000; s++) if (!have.has(kind(s))) { have.add(kind(s)); extra.push(s); }
  return base.concat(extra); };
const inNet = (ip, net, len) => { const n = (x) => x.split(".").reduce((a, b) => a * 256 + +b, 0), m = 2 ** 32 - 2 ** (32 - (len || 24)); return Math.floor(n(ip) / 2 ** (32 - (len || 24))) === Math.floor(n(net) / 2 ** (32 - (len || 24))); };
const seeds = Array.from({ length: N }, (_, i) => 5000 + i * 7919);
const pc = (line) => ({ t: "cmd", dev: "pc", line }), mgr = (line) => ({ t: "cmd", dev: "mgr", line });
const out = (T, acts) => acts.map((a) => (E.act(T, a) || {}).out || "").join("");
/* SSH from the manager's PC to the closet switch, privileged; then configuration lines; then saved */
const ssh = (T) => { const p = T.v.plan; return [mgr("ssh " + p.user + "@" + p.swIp), mgr(p.userPw), mgr("enable"), mgr(p.swSecret)]; };
const conf = (T, lines) => ssh(T).concat([mgr("configure terminal")], lines.map(mgr), [mgr("end")]);
const SAVE = [mgr("copy running-config startup-config"), mgr("")];
const staff = (T) => T.v.plan.vlans.staff;
/* a switch's configuration, as a student reaches it: the closet switch over SSH from the manager's PC, the back switch at your laptop's console */
const tech = (line) => ({ t: "cmd", dev: "tech", line, cli: true });
const onSw = (T, sw, lines, save) => { const p = T.v.plan; const L = ["configure terminal"].concat(lines, ["end"], save === false ? [] : ["copy running-config startup-config", ""]);
  return sw === "bsw" ? ["", p.swConsole, "enable", p.swSecret].concat(L, ["disable", "exit"]).map(tech) : ssh(T).concat(L.map(mgr), [mgr("exit")]); };
/* SB-02: whoever lost the network asks again, and proves it */
const again = (T) => T.v.kind === "staff" ? [{ t: "cmd", dev: "bpc", line: "ipconfig /renew" }] : T.v.kind === "guest" ? [{ t: "radio", dev: "guest", on: false }, { t: "radio", dev: "guest", on: true }] : [];
const back = (T) => ["vlan " + T.v.vlan, "name " + T.v.vname];
/* SB-03: whoever lost the network asks again; the trunk's line typed on its port */
const again3 = (T) => T.v.kind === "back" ? [{ t: "cmd", dev: "bpc", line: "ipconfig /renew" }] : T.v.kind === "ap" ? [{ t: "radio", dev: "guest", on: false }, { t: "radio", dev: "guest", on: true }] : [];
const trunk3 = (T, line, save) => onSw(T, "msw", ["interface " + T.v.short, line], save);
/* SB-04: the router over SSH from the manager's PC; the devices that restarted ask again */
const onRt = (T, lines, save) => { const p = T.v.plan; return [mgr("ssh " + p.user + "@" + p.vlans.staff.gw), mgr(p.userPw), mgr("enable"), mgr(p.rtSecret), mgr("configure terminal")].concat(lines.map(mgr), [mgr("end")], save === false ? [] : SAVE, [mgr("exit")]); };
/* SB-08: the trunk's port on whichever switch, and the PCs that lost their network asking again */
const port8 = (sw) => sw === "msw" ? "interface gi0/23" : "interface gi0/24";
const again8 = (T) => T.v.devs.map((id) => ({ t: "cmd", dev: id, line: "ipconfig /renew" }));
/* SB-09: the ends that were changed, and the back room asking again */
const ends9 = (T) => T.v.kind === "auto-auto" ? ["msw", "bsw"] : T.v.kind === "access-closet" ? ["msw"] : ["bsw"];
const again9 = () => ["bpc", "dpc1", "dpc2"].map((id) => ({ t: "cmd", dev: id, line: "ipconfig /renew" }));
/* SB-10: the subinterfaces put back (a new tag clears the address, so it goes back on too), and whatever lost its network asking again */
const radioOn = [{ t: "radio", dev: "guest", on: false }, { t: "radio", dev: "guest", on: true }];
const again10 = (T) => T.v.kind === "printers" ? [] : T.v.kind === "guest" ? radioOn : [{ t: "cmd", dev: "dpc1", line: "ipconfig /renew" }, { t: "cmd", dev: "dpc2", line: "ipconfig /renew" }].concat(radioOn);
const subs10 = (T) => { const v = T.v, V = v.plan.vlans, B = v.before;
  if (v.kind !== "swap") return ["interface " + v.sub, "encapsulation dot1Q " + v.vlan, "ip address " + B[v.sub].ip + " " + B[v.sub].mask];
  return ["interface " + v.gs, "no encapsulation dot1Q", "interface " + v.ds, "encapsulation dot1Q " + V.dept.id, "ip address " + B[v.ds].ip + " " + B[v.ds].mask, "interface " + v.gs, "encapsulation dot1Q " + V.guest.id, "ip address " + B[v.gs].ip + " " + B[v.gs].mask]; };
const again4 = (T) => T.v.devs.flatMap((id) => id === "guest" ? [{ t: "radio", dev: "guest", on: false }, { t: "radio", dev: "guest", on: true }] : [{ t: "cmd", dev: id, line: "ipconfig /renew" }]);

const FIX = {
  "SB-01": (T) => conf(T, ["interface gi0/1", "switchport access vlan " + staff(T).id]).concat(SAVE, [pc("ipconfig /renew")]),
  "SB-02": (T) => onSw(T, T.v.sw, back(T)).concat(again(T)),
  "SB-03": (T) => trunk3(T, "switchport trunk allowed vlan add " + T.v.lost.join(",")).concat(again3(T)),
  "SB-04": (T) => onRt(T, ["ip dhcp pool " + T.v.pool, "default-router " + T.v.gw]).concat(again4(T)),
  "SB-05": (T) => onRt(T, (T.v.wrong ? ["no ip route 0.0.0.0 0.0.0.0 " + T.v.wrong] : []).concat(["ip route 0.0.0.0 0.0.0.0 " + T.v.gw])),
  "SB-06": (T) => onRt(T, Object.keys(T.v.roles).flatMap((n) => ["interface " + n, "ip nat " + T.v.roles[n]])),
  "SB-07": (T) => onRt(T, ["no access-list 1"].concat(T.v.before.map((k) => "access-list 1 " + k))).concat(T.v.kind === "guest" ? [{ t: "radio", dev: "guest", on: false }, { t: "radio", dev: "guest", on: true }] : []),
  "SB-08": (T) => onSw(T, T.v.end, [port8(T.v.end), "switchport trunk native vlan " + T.v.native]).concat(again8(T)),
  "SB-09": (T) => ends9(T).flatMap((sw) => onSw(T, sw, [port8(sw), "switchport mode trunk"])).concat(again9()),
  "SB-10": (T) => onRt(T, subs10(T)).concat(again10(T))
};
const PROOF = {
  "SB-01": (T) => [pc("ping " + T.v.printer)],
  "SB-02": (T) => T.v.kind === "staff" ? [{ t: "cmd", dev: "bpc", line: "ping " + T.v.printer }] : T.v.kind === "printers" ? [{ t: "print" }] : [{ t: "radio", dev: "guest", on: false }, { t: "radio", dev: "guest", on: true }],   /* connected already, the phone's page offers no Join: Wi-Fi off and on */
  "SB-03": (T) => T.v.kind === "back" ? [{ t: "cmd", dev: "bpc", line: "ping " + T.v.printer }] : T.v.kind === "router" ? [{ t: "print" }] : [{ t: "radio", dev: "guest", on: false }, { t: "radio", dev: "guest", on: true }],
  "SB-04": (T) => T.v.kind === "guest" ? [{ t: "view", dev: "guest", key: "wifi" }] : [{ t: "cmd", dev: T.v.devs[0], line: "ping " + T.v.printer }],
  "SB-05": () => [pc("tracert 8.8.8.8"), pc("ping 8.8.8.8")],
  "SB-06": () => [pc("ping 8.8.8.8")],
  "SB-07": (T) => T.v.kind === "guest" ? [{ t: "view", dev: "guest", key: "wifi" }] : [{ t: "cmd", dev: T.v.dev, line: "ping 8.8.8.8" }],
  "SB-08": (T) => [{ t: "cmd", dev: T.v.devs[0], line: "ping " + T.v.printer }],
  "SB-09": (T) => [{ t: "cmd", dev: "bpc", line: "ping " + T.v.printer }],
  "SB-10": (T) => T.v.kind === "printers" ? [{ t: "print" }] : T.v.kind === "guest" ? radioOn : [{ t: "cmd", dev: "dpc1", line: "ping " + T.v.printer }]
};
const UNSAVED = {
  "SB-01": (T) => conf(T, ["interface gi0/1", "switchport access vlan " + staff(T).id]).concat([pc("ipconfig /renew")]),
  "SB-02": (T) => onSw(T, T.v.sw, back(T), false).concat(again(T)),
  "SB-03": (T) => trunk3(T, "switchport trunk allowed vlan add " + T.v.lost.join(","), false).concat(again3(T)),
  "SB-04": (T) => onRt(T, ["ip dhcp pool " + T.v.pool, "default-router " + T.v.gw], false).concat(again4(T)),
  "SB-05": (T) => onRt(T, (T.v.wrong ? ["no ip route 0.0.0.0 0.0.0.0 " + T.v.wrong] : []).concat(["ip route 0.0.0.0 0.0.0.0 " + T.v.gw]), false),
  "SB-06": (T) => onRt(T, Object.keys(T.v.roles).flatMap((n) => ["interface " + n, "ip nat " + T.v.roles[n]]), false),
  "SB-07": (T) => onRt(T, ["no access-list 1"].concat(T.v.before.map((k) => "access-list 1 " + k)), false).concat(T.v.kind === "guest" ? [{ t: "radio", dev: "guest", on: false }, { t: "radio", dev: "guest", on: true }] : []),
  "SB-08": (T) => onSw(T, T.v.end, [port8(T.v.end), "switchport trunk native vlan " + T.v.native], false).concat(again8(T)),
  "SB-09": (T) => ends9(T).flatMap((sw) => onSw(T, sw, [port8(sw), "switchport mode trunk"], false)).concat(again9()),
  "SB-10": (T) => onRt(T, subs10(T), false).concat(again10(T))
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
  },
  "SB-02": (T) => {
    const v = T.v, other = v.sw === "msw" ? "bsw" : "msw", port = { staff: "gi0/1", printers: "gi0/3", guest: "gi0/5" }[v.kind], trunk = v.kind === "guest" ? "gi0/5" : "gi0/24";
    return [
      again(T), [{ t: "power", dev: v.sw }].concat(again(T)),
      onSw(T, v.sw, v.kind === "guest" ? ["vlan " + v.vlan] : ["interface " + port, "switchport access vlan " + v.vlan]).concat(again(T)),   /* back with the switch's own name for it */
      onSw(T, other, back(T)).concat(again(T)),   /* made on the other switch */
      onSw(T, v.sw, ["interface " + trunk, "switchport trunk allowed vlan add " + v.vlan]).concat(again(T)),   /* the trunk told to carry what the switch no longer has */
      onSw(T, v.sw, back(T).concat(["no vlan " + v.plan.vlans.parking.id])).concat(again(T))   /* back, with another VLAN lost on the way */
    ].concat(v.kind === "printers" ? [] : [onSw(T, v.sw, back(T))]);   /* back and saved, and whatever lost its network never asked again (the printer's address is fixed: nothing to ask) */
  },
  "SB-03": (T) => {
    const v = T.v, L = [again3(T), [{ t: "power", dev: "msw" }].concat(again3(T)),
      trunk3(T, "switchport trunk allowed vlan " + v.lost.join(",")).concat(again3(T)),   /* the same mistake again: the list replaced with what was lost */
      onSw(T, "msw", v.lost.map((id) => "vlan " + id)).concat(again3(T)),   /* SB-02's fix: the VLANs are there already */
      trunk3(T, "switchport trunk native vlan 1").concat(again3(T))];
    if (v.kind !== "router") L.push(trunk3(T, "switchport trunk allowed vlan all").concat(again3(T)));   /* works, and carries VLANs the far end has no use for */
    if (v.kind === "back") L.push(onSw(T, "bsw", ["interface gi0/24", "switchport trunk allowed vlan add " + v.lost.join(",")]).concat(again3(T)));   /* the far end, which carries them already */
    return L;
  },
  "SB-04": (T) => {
    const v = T.v, d0 = v.devs[0], L = [again4(T), [{ t: "power", dev: "rtr" }].concat(again4(T)),
      onRt(T, ["ip dhcp pool " + v.pool, "default-router " + v.gw]).concat([]),   /* the pool put right, the devices never asking again */
      onRt(T, ["ip dhcp pool " + v.pool, "dns-server 8.8.8.8"]).concat(again4(T)),   /* DNS changed instead */
      onRt(T, ["interface GigabitEthernet0/1." + (v.kind === "staff" ? v.plan.vlans.staff.id : v.kind === "dept" ? v.plan.vlans.dept.id : v.plan.vlans.guest.id), "ip address " + v.wrong + " " + (v.len === 24 ? "255.255.255.0" : ["255.255.255.128", "255.255.255.192", "255.255.255.224", "255.255.255.240"][v.len - 25])]).concat(again4(T))];   /* the router moved to the wrong gateway's address */
    if (d0 !== "guest") L.push([{ t: "client", dev: d0, values: { mode: "static", ip: T.sim.addr(d0).ip, mask: T.sim.addr(d0).mask, gw: v.gw, dns: v.plan.dns } }].concat(v.devs.slice(1).map((id) => ({ t: "client", dev: id, values: { mode: "static", ip: T.sim.addr(id).ip, mask: T.sim.addr(id).mask, gw: v.gw, dns: v.plan.dns } }))));   /* the gateway typed in on each PC */
    return L;
  },
  "SB-05": (T) => {
    const v = T.v, F = v.plan.fixed, L = [[{ t: "power", dev: "rtr" }, pc("ping 8.8.8.8")],
      onRt(T, ["interface GigabitEthernet0/0", "shutdown", "no shutdown"]),   /* the provider's port bounced */
      onRt(T, ["ip route 0.0.0.0 0.0.0.0 " + (v.wrong || F.gw.replace(/\d+$/, (x) => String(+x === +F.ip.split(".")[3] - 1 ? +x - 1 : +F.ip.split(".")[3])))]),   /* another wrong next hop added */
      onRt(T, ["ip route 0.0.0.0 0.0.0.0 GigabitEthernet0/1"])];   /* out the inside port */
    if (v.wrong) L.push(onRt(T, ["ip route 0.0.0.0 0.0.0.0 " + v.gw]));   /* the right one added beside the wrong one */
    return L;
  },
  "SB-06": (T) => {
    const v = T.v, staff = ["interface " + v.sub, "ip nat inside"], wan = ["interface GigabitEthernet0/0", "ip nat outside"];
    return [[{ t: "power", dev: "rtr" }, pc("ping 8.8.8.8")],
      onRt(T, ["access-list 1 permit any"]),   /* NAT's list widened: it was never the list */
      onRt(T, ["interface GigabitEthernet0/0", "shutdown", "no shutdown"]),
      v.kind === "sub" ? onRt(T, wan.concat(["interface GigabitEthernet0/0", "ip nat inside"])) : onRt(T, staff),   /* only part of it put right */
      onRt(T, Object.keys(v.roles).flatMap((n) => ["interface " + n, "ip nat " + v.roles[n]]).concat(["interface GigabitEthernet0/1." + v.plan.vlans.printers.id, "ip nat inside"]))];   /* right, and the printers' subinterface given a role it never had */
  },
  "SB-07": (T) => {
    const v = T.v, again = v.kind === "guest" ? [{ t: "radio", dev: "guest", on: false }, { t: "radio", dev: "guest", on: true }] : [];
    const L = [[{ t: "power", dev: "rtr" }].concat(again), onRt(T, ["access-list 1 permit any"]).concat(again),   /* works, and translates what never should be (the printers, the cameras) */
      onRt(T, ["interface GigabitEthernet0/1." + (v.kind === "dept" ? v.plan.vlans.dept.id : v.kind === "guest" ? v.plan.vlans.guest.id : v.plan.vlans.staff.id), "ip nat inside"]).concat(again),   /* the subinterface's role, which was right */
      onRt(T, ["no access-list 1"]).concat(again)];   /* the list taken away altogether */
    if (v.kind !== "dept") L.push(onRt(T, ["access-list 1 permit " + v.net + " " + v.wild]).concat(again));   /* the right line added, the wrong one left in */
    return L;
  },
  "SB-08": (T) => {
    const v = T.v;
    return [again8(T), [{ t: "power", dev: v.end }].concat(again8(T)),
      onSw(T, v.far, [port8(v.far), "switchport trunk native vlan " + v.vlan]).concat(again8(T)),   /* the other end matched to it: works, a VLAN in use untagged */
      onSw(T, v.end, [port8(v.end), "switchport trunk native vlan 1"]).concat(again8(T)),   /* back to the default, not the records' */
      onSw(T, v.end, [port8(v.end), "switchport trunk allowed vlan add " + v.vlan]).concat(again8(T)),   /* the allowed list, which was never the trouble */
      onSw(T, v.end, [port8(v.end), "shutdown", "no shutdown"]).concat(again8(T))];
  },
  "SB-09": (T) => {
    const e = ends9(T);
    return [again9(), [{ t: "power", dev: "bsw" }].concat(again9()),
      e.flatMap((sw) => onSw(T, sw, [port8(sw), "switchport mode dynamic desirable"])).concat(again9()),   /* left negotiating: it trunks, and isn't the records' way */
      onSw(T, e[0] === "msw" ? "bsw" : "msw", [port8(e[0] === "msw" ? "bsw" : "msw"), "switchport mode trunk"]).concat(again9()),   /* the end that was right already */
      e.flatMap((sw) => onSw(T, sw, [port8(sw), "switchport trunk allowed vlan all"])).concat(again9()),   /* the allowed list, on a port that isn't a trunk */
      e.flatMap((sw) => onSw(T, sw, [port8(sw), "shutdown", "no shutdown"])).concat(again9())];
  },
  "SB-10": (T) => {
    const v = T.v, V = v.plan.vlans, L = [again10(T), [{ t: "power", dev: "rtr" }].concat(again10(T))];
    if (v.kind !== "swap") {
      L.push(onRt(T, ["interface " + v.sub, "encapsulation dot1Q " + v.vlan]).concat(again10(T)));   /* the tag back, and its address gone with the old one */
      L.push(onSw(T, "msw", ["interface gi0/24", "switchport trunk allowed vlan add " + v.wrong]).concat(again10(T)));   /* the trunk told to carry the tag the router has */
      L.push(onRt(T, ["interface " + v.sub, "shutdown", "no shutdown"]).concat(again10(T)));   /* the subinterface bounced */
      L.push(onRt(T, ["interface " + v.sub, "encapsulation dot1Q " + v.vlan, "ip address " + v.before[v.sub].ip + " 255.255.255.128"]).concat(again10(T)));   /* the address back on the wrong mask: it works, and isn't the records' */
    } else {
      const B = v.before;
      L.push(onRt(T, ["interface " + v.gs, "no encapsulation dot1Q", "interface " + v.ds, "encapsulation dot1Q " + V.dept.id, "ip address " + B[v.ds].ip + " " + B[v.ds].mask]).concat(again10(T)));   /* the department's put right, the guests' left with no tag */
      L.push(onRt(T, subs10(T)));   /* both right, and nothing asked again: the department's PCs keep guests' addresses, the phone the department's */
      L.push(onRt(T, subs10(T)).concat([{ t: "cmd", dev: "dpc1", line: "ipconfig /renew" }, { t: "cmd", dev: "dpc2", line: "ipconfig /renew" }]));   /* the department asked again, the visitor's phone didn't */
      L.push(onRt(T, ["interface " + v.ds, "encapsulation dot1Q " + V.dept.id]).concat(again10(T)));   /* refused: the guests' subinterface still has that tag */
    }
    return L;
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
  },
  "SB-09": (T) => {
    const v = T.v, p = v.plan;
    for (const id of ["bpc", "dpc1"]) assert.match(E.act(T, { t: "cmd", dev: id, line: "ipconfig" }).out, /Autoconfiguration IPv4 Address[ .]*: 169\.254\./);
    const b = out(T, ["", p.swConsole, "enable", p.swSecret, "show interfaces gi0/24 switchport", "show interfaces status", "disable", "exit"].map(tech));
    const c = out(T, ssh(T).concat([mgr("show interfaces gi0/23 switchport"), mgr("exit")]));
    assert.match(b + c, /Operational Mode: static access/, "an end of the link runs as an access port");
    assert.match(b, /Administrative Mode: (static access|dynamic auto|trunk)/); assert.match(c, /Administrative Mode: (static access|dynamic auto|trunk)/);
    assert.match(b, /^Gi0\/1\s+\S+\s+connected/m, "the back switch's own ports are up");
    assert.ok(E.act(T, pc("ping " + v.printer)).facts.replies > 0, "out front works");
  },
  "SB-08": (T) => {
    const v = T.v, p = v.plan;
    for (const id of v.devs) assert.match(E.act(T, { t: "cmd", dev: id, line: "ipconfig" }).out, /Autoconfiguration IPv4 Address[ .]*: 169\.254\./);
    assert.ok(E.act(T, { t: "cmd", dev: v.kind === "dept-closet" ? "bpc" : "dpc1", line: "ping " + v.printer }).facts.replies > 0, "the other VLAN on the same trunk still works");
    const b = out(T, ["", p.swConsole, "enable", p.swSecret, "show interfaces trunk", "disable", "exit"].map(tech));
    assert.match(b, new RegExp("%LLDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch discovered on GigabitEthernet0/24 \\(" + (v.end === "bsw" ? v.vlan : v.native) + "\\), with " + p.swHost + " GigabitEthernet0/23 \\(" + (v.end === "msw" ? v.vlan : v.native) + "\\)\\."), "the back switch's console logs it");
    assert.match(b, new RegExp("Gi0/24\\s+on\\s+802\\.1q\\s+trunking\\s+" + (v.end === "bsw" ? v.vlan : v.native) + "\\n"));
    const c = out(T, ssh(T).concat([mgr("show interfaces trunk"), mgr("exit")]));
    assert.match(c, new RegExp("Gi0/23\\s+on\\s+802\\.1q\\s+trunking\\s+" + (v.end === "msw" ? v.vlan : v.native) + "\\n"));
    assert.doesNotMatch(c, /NATIVE_VLAN_MISMATCH/, "an SSH session isn't sent the console's log");
  },
  "SB-07": (T) => {
    const v = T.v, p = v.plan;
    if (v.kind === "guest") { const w = E.act(T, { t: "view", dev: "guest", key: "wifi" }); assert.ok(w.facts.connected && !w.facts.internet && !w.facts.apipa, "the visitor: connected, an address, no internet"); }
    else { assert.equal(E.act(T, { t: "cmd", dev: v.dev, line: "ping 8.8.8.8" }).facts.replies, 0, "that VLAN gets nothing from the internet"); assert.ok(E.act(T, { t: "cmd", dev: v.dev, line: "ping " + v.printer }).facts.replies > 0, "and works inside"); }
    assert.ok(E.act(T, { t: "cmd", dev: v.kind === "dept" ? "pc" : "dpc1", line: "ping 8.8.8.8" }).facts.replies > 0, "another VLAN gets out");
    const o = out(T, [mgr("ssh " + p.user + "@" + p.vlans.staff.gw), mgr(p.userPw), mgr("enable"), mgr(p.rtSecret), mgr("show access-lists")]);
    const list = o.split("Standard IP access list 1\n")[1].split(/\n(?=\S)/)[0];
    assert.ok(list.indexOf(" " + v.net + " " + v.wild) < 0, "the list has no line matching that network");
  },
  "SB-06": (T) => {
    const v = T.v, p = v.plan;
    assert.equal(E.act(T, pc("ping 8.8.8.8")).facts.replies, 0, "the PC gets nothing from the internet");
    assert.ok(E.act(T, pc("ping " + v.printer)).facts.replies > 0, "inside works");
    assert.equal(E.act(T, { t: "cmd", dev: "dpc1", line: "ping 8.8.8.8" }).facts.replies > 0, v.kind === "sub", "the department gets out only when only the staff VLAN is wrong");
    const o = out(T, [mgr("ssh " + p.user + "@" + p.vlans.staff.gw), mgr(p.userPw), mgr("enable"), mgr(p.rtSecret), mgr("ping 8.8.8.8"), mgr("show running-config")]);
    assert.match(o, /Success rate is 100 percent/, "the router itself reaches the internet");
    const role = (n) => ((o.split("interface " + n + "\n")[1] || "").split("!")[0].match(/ip nat (inside|outside)/) || [])[1];
    assert.equal(role("GigabitEthernet0/0"), v.kind === "sub" ? "outside" : "inside"); assert.equal(role(v.sub), v.kind === "wan" ? "inside" : "outside");
  },
  "SB-05": (T) => {
    const v = T.v, p = v.plan;
    assert.equal(E.act(T, pc("ping 8.8.8.8")).facts.replies, 0, "nothing gets out");
    assert.ok(E.act(T, pc("ping " + v.printer)).facts.replies > 0, "inside works, across the router");
    const tr = E.act(T, pc("tracert 8.8.8.8")); assert.match(tr.out, new RegExp("1\\s+.*" + p.vlans.staff.gw.replace(/\./g, "\\.")), "the first hop is the router");
    assert.match(tr.out, v.wrong ? /Request timed out/ : /Destination net unreachable/);
    const o = out(T, [mgr("ssh " + p.user + "@" + p.vlans.staff.gw), mgr(p.userPw), mgr("enable"), mgr(p.rtSecret), mgr("show ip route"), mgr("ping " + p.fixed.gw)]);
    assert.match(o, v.wrong ? new RegExp("Gateway of last resort is " + v.wrong.replace(/\./g, "\\.")) : /Gateway of last resort is not set/);
    assert.match(o, /!!!!!|Success rate is [1-9]/, "the router reaches the provider's gateway");
  },
  "SB-04": (T) => {
    const v = T.v, p = v.plan;
    if (v.kind === "guest") { const w = E.act(T, { t: "view", dev: "guest", key: "wifi" }); assert.ok(w.facts.connected && !w.facts.internet && !w.facts.apipa, "the visitor's phone: connected, an address, no internet"); }
    else for (const id of v.devs) {
      assert.match(E.act(T, { t: "cmd", dev: id, line: "ipconfig" }).out, new RegExp("Default Gateway[ .]*: " + v.wrong.replace(/\./g, "\\.") + "\\n"));
      assert.ok(E.act(T, { t: "cmd", dev: id, line: "ping " + v.gw }).facts.replies > 0, "the router's own address on the VLAN answers");
      assert.match(E.act(T, { t: "cmd", dev: id, line: "ping " + v.printer }).out, /Destination host unreachable|transmit failed\. General failure/);   /* a gateway on its own network that nobody answers at, or one off it altogether */
    }
    assert.ok(E.act(T, mgr("ping " + v.printer)).facts.replies > 0, "the manager's PC, which never restarted, is fine");
    const o = out(T, [mgr("ssh " + p.user + "@" + p.vlans.staff.gw), mgr(p.userPw), mgr("enable"), mgr(p.rtSecret), mgr("show running-config")]);
    assert.match(o, new RegExp("ip dhcp pool " + v.pool + "\\n network \\S+ \\S+\\n default-router " + v.wrong.replace(/\./g, "\\.") + "\\n"));
  },
  "SB-03": (T) => {
    const v = T.v, p = v.plan, o = out(T, ssh(T).concat(["show interfaces trunk", "show vlan brief"].map(mgr)));
    for (const id of v.lost) assert.match(o, new RegExp("^" + id + "\\s+\\S+\\s+active", "m"), "VLAN " + id + " is still on the closet switch");
    const row = (o.split("Vlans allowed on trunk\n")[1] || "").split("\n").find((l) => l.startsWith(v.short.replace("gi", "Gi") + " ")) || "";
    for (const id of v.lost) assert.ok(!row.split(/\s+/)[1].split(",").some((x) => { const [a, b] = x.split("-").map(Number); return id >= a && id <= (b || a); }), "the trunk no longer allows " + id + " (" + row + ")");
    E.act(T, mgr("exit"));
    if (v.kind === "back") {
      assert.match(E.act(T, { t: "cmd", dev: "bpc", line: "ipconfig" }).out, /Autoconfiguration IPv4 Address[ .]*: 169\.254\./);
      assert.ok(E.act(T, { t: "cmd", dev: "dpc1", line: "ping " + v.printer }).facts.replies > 0, "the department, on the same back switch, still works");
    } else if (v.kind === "router") {
      assert.equal(E.act(T, { t: "print" }).facts.print, "fail"); assert.equal(E.act(T, mgr("ping " + v.printer)).facts.replies, 0, "nobody reaches the printer");
      assert.ok(E.act(T, pc("ping 8.8.8.8")).facts.replies > 0, "everything else works, the internet too");
    } else {
      E.act(T, { t: "radio", dev: "guest", on: false }); assert.ok(E.act(T, { t: "radio", dev: "guest", on: true }).facts.apipa, "the visitor joins and gets 169.254");
      assert.ok(T.sim.addr("pc").kind === "dhcp" && T.sim.addr("mgr").kind === "dhcp", "the staff are fine");
    }
  },
  "SB-10": (T) => {
    const v = T.v, V = v.plan.vlans, p = v.plan;
    const o = out(T, [mgr("ssh " + p.user + "@" + V.staff.gw), mgr(p.userPw), mgr("enable"), mgr(p.rtSecret), mgr("show ip interface brief"), mgr("show running-config")].concat(Object.keys(v.before).map((n) => mgr("show interfaces " + n))));
    E.act(T, mgr("exit"));
    for (const n of Object.keys(v.before)) assert.match(o, new RegExp(n.replace(/[./]/g, "\\$&") + "\\s+" + v.before[n].ip.replace(/\./g, "\\.") + "\\s+YES\\s+\\S+\\s+up\\s+up"), n + " up and up on the records' address");
    const tagOf = (n) => Number((o.match(new RegExp(n.replace(/[./]/g, "\\$&") + " is [^]*?Vlan ID\\s+(\\d+)")) || [])[1]);
    if (v.kind !== "swap") { assert.equal(tagOf(v.sub), v.wrong, "show interfaces gives the wrong tag"); assert.match(o, new RegExp("interface " + v.sub.replace(/[./]/g, "\\$&") + "\\n[^!]* encapsulation dot1Q " + v.wrong + "\\n")); }
    else { assert.equal(tagOf(v.ds), V.guest.id); assert.equal(tagOf(v.gs), V.dept.id); }
    const t = out(T, ssh(T).concat([mgr("show interfaces trunk")])); E.act(T, mgr("exit"));
    const act = (t.split("Vlans allowed and active in management domain\n")[1] || "").split("\n").find((l) => /^Gi0\/24\s/.test(l)) || "";
    for (const k of v.kind === "swap" ? ["dept", "guest"] : [v.kind]) assert.ok(act.split(/\s+/)[1].split(",").some((x) => { const [a, b] = x.split("-").map(Number); return V[k].id >= a && V[k].id <= (b || a); }), "the switch's trunk to the router carries the " + k + " VLAN, active (" + act + ")");
    if (v.kind === "printers") { assert.equal(E.act(T, { t: "print" }).facts.print, "fail"); assert.equal(E.act(T, pc("ping " + v.printer)).facts.replies, 0); assert.ok(E.act(T, pc("ping 8.8.8.8")).facts.replies > 0, "the internet works"); }
    else if (v.kind === "guest") assert.ok(E.act(T, { t: "joinssid", dev: "guest", ssid: p.guestSsid, pass: p.guestPw }).facts.apipa, "the visitor joins and gets 169.254");
    else {
      assert.match(E.act(T, { t: "cmd", dev: "dpc1", line: "ipconfig" }).out, new RegExp("IPv4 Address[ .]*: " + V.guest.net.replace(/0$/, "").replace(/\./g, "\\.")), "a department PC has a guests' address");
      assert.equal(E.act(T, { t: "cmd", dev: "dpc1", line: "ping " + v.printer }).facts.replies, 0, "and can't print");
      const ph = E.act(T, { t: "radio", dev: "guest", on: false }) && E.act(T, { t: "radio", dev: "guest", on: true }).facts; assert.ok(inNet(ph.ip, V.dept.net, V.dept.len), "the visitor's phone has an address in the department's block (" + ph.ip + ")");
    }
  },
  "SB-02": (T) => {
    const v = T.v, p = v.plan;
    const o = v.sw === "bsw" ? out(T, ["", p.swConsole, "enable", p.swSecret, "show vlan brief", "show interfaces gi0/1 switchport", "show interfaces status", "show interfaces trunk"].map(tech))
      : out(T, ssh(T).concat(["show vlan brief", "show interfaces gi0/3 switchport", "show interfaces status", "show interfaces trunk"].map(mgr)));
    assert.doesNotMatch(o, new RegExp("^" + v.vlan + "\\s+\\S+\\s+active", "m"), "show vlan brief has no VLAN " + v.vlan);
    const allowed = (o.split("Vlans allowed on trunk\n")[1] || "").split("\n\n")[0].split("\n").map((l) => l.trim().split(/\s+/)[1] || "");
    assert.ok(allowed.some((list) => list.split(",").some((x) => { const [a, b] = x.split("-").map(Number); return v.vlan >= a && v.vlan <= (b || a); })), "a trunk still allows it (" + allowed.join(" | ") + ")");
    if (v.kind === "staff") {
      assert.match(o, new RegExp("Access Mode VLAN: " + v.vlan + " \\(Inactive\\)")); assert.match(o, /^Gi0\/1\s+\S+\s+connected\s+unassigned/m);
      assert.match(E.act(T, { t: "cmd", dev: "bpc", line: "ipconfig" }).out, /Autoconfiguration IPv4 Address[ .]*: 169\.254\./);
      assert.ok(T.sim.addr("dpc1").kind === "dhcp" && E.act(T, pc("ping " + v.printer)).facts.replies > 0, "the department and the front still work");
    } else if (v.kind === "printers") {
      assert.match(o, new RegExp("Access Mode VLAN: " + v.vlan + " \\(Inactive\\)")); assert.match(o, /^Gi0\/3\s+PRINTER\s+connected\s+unassigned/m);
      assert.equal(E.act(T, { t: "print" }).facts.print, "fail"); E.act(T, mgr("exit")); assert.equal(E.act(T, mgr("ping " + v.printer)).facts.replies, 0, "nobody reaches the printer");
    } else {
      assert.ok(E.act(T, { t: "joinssid", dev: "guest", ssid: p.guestSsid, pass: p.guestPw }).facts.apipa, "the visitor joins and gets 169.254");
      assert.ok(T.sim.addr("pc").kind === "dhcp" && T.sim.addr("mgr").kind === "dhcp", "the staff are fine");
    }
  }
};

for (const def of BUSINESS_TICKETS) {
  test(def.id + ": the fault shows on every generated business, in the commands themselves", () => {
    let reseeded = 0;
    for (const s of seedsOf(def)) { const T = E.open(def, s); if (T.seed !== s) reseeded++; assert.ok(def.exhibits(T.sim, T.v)); assert.equal(T.fixed, false); SYMPTOM[def.id](T); }
    assert.equal(reseeded, 0, "every seed should show its fault without moving on");
  });
  test(def.id + ": six options, one right, five near misses each with its reason", () => {
    for (const s of seedsOf(def, 12)) {
      const T = E.open(def, s);
      assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1);
      for (const o of T.opts) { assert.ok(o.text && o.text.length > 10); if (!o.right) assert.ok(o.why && o.why.length > 20, o.id); }
      assert.equal(new Set(T.opts.map((o) => o.text)).size, 6);
    }
  });
  test(def.id + ": the real fix fixes it and is proven; the tempting wrong fixes don't; unsaved works but isn't the fix", () => {
    for (const s of seedsOf(def)) {
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
    for (const s of seedsOf(def, 6)) {
      const T = E.open(def, s); for (const a of PROOF[def.id](T)) E.act(T, a); assert.equal(T.proven, false);
      E.act(T, pc("ping 8.8.8.8")); E.act(T, { t: "print" });
      assert.equal(T.proven, false); assert.equal(T.partial, null, "a guest reaching the internet isn't the fix half done");
      E.guess(T, "right"); for (const a of FIX[def.id](T)) E.act(T, a); assert.equal(T.fixed, true);
      const byFix = T.proven;
      E.act(T, pc("ping 127.0.0.1")); E.act(T, pc("ping -n 6 " + T.sim.addr("pc").ip));
      E.act(T, { t: "cmd", dev: "bpc", line: "ping 127.0.0.1" }); E.act(T, { t: "cmd", dev: "bpc", line: "ping " + T.sim.addr("bpc").ip });
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
    for (const s of seedsOf(def, 8)) {
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
    for (const s of seedsOf(def, 12)) {
      const T = E.open(def, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
      const texts = [def.rung1(T.v, T.sim), def.rung2(T.v, T.sim), ...def.fixHints(T.v, T.sim), def.brief(T.v, T.sim).quote, def.mason].map((x) => x.toLowerCase());
      for (const x of texts) {
        assert.ok(x.indexOf(right) < 0, x);
        for (const bad of [p.rtSecret, p.rtConsole, p.swSecret, p.swConsole, p.userPw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, def.id + " names a password: " + x);
        for (const n of Object.values(p.vlans).map((V) => String(V.id))) assert.ok(!new RegExp("\\b" + n + "\\b").test(x), def.id + " names VLAN " + n + ": " + x);
        for (const cmd of ["switchport access", "switchport mode", "switchport trunk", "allowed vlan", "default-router", "ip dhcp pool", "ip route 0", "ip nat inside", "ip nat outside", "access-list 1", "copy running-config", "write memory", "interface gi", "ipconfig /renew", "encapsulation dot1q", "ip address 1", "no encapsulation"]) assert.ok(x.indexOf(cmd) < 0, def.id + " names the fix's command: " + x);
      }
    }
  });
}

test("the business's records on the card carry every login, the switches' and router's addresses and the VLAN plan", () => {
  const T = E.open(BUSINESS_TICKETS[0], seeds[0]), p = T.v.plan, rows = businessRecords(T.v, T.sim), all = rows.map((r) => r[0] + ": " + r[1]).join("\n");
  for (const x of [p.rtHost, p.swHost, p.bswHost, p.rtSecret, p.rtConsole, p.swSecret, p.swConsole, p.user, p.userPw, p.swIp, p.vlans.staff.gw, p.printerIp]) assert.ok(all.indexOf(x) >= 0, "the records give " + x);
  for (const k of ["staff", "guest", "cameras", "printers", "dept", "native", "parking"]) assert.ok(rows.some((r) => / VLAN$/.test(r[0]) && new RegExp("^" + p.vlans[k].id + " · ").test(r[1])), "the VLAN plan gives " + k);
  for (const k of ["staff", "guest", "cameras", "printers", "dept", "native", "parking"]) assert.ok(rows.some((r) => / VLAN$/.test(r[0]) && r[1].indexOf(p.vlans[k].id + " · named " + p.vlans[k].name + " · ") === 0), "the VLAN plan names " + k + "'s VLAN as the switches name it (" + p.vlans[k].name + ")");   /* a VLAN made again goes by the records' name (SB-02) */
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
