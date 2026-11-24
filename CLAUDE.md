# The E4 Mafia Network — project context

Read this first in any session touching this repo. The global rules in
`/root/.claude/CLAUDE.md` (and `/root/.claude/exam-prep-coach.md`) apply
here and win over anything below.

**Live site:** https://rafikiscyent888.github.io/The-E4-Mafia-Network/
**Status (9 November 2026): Level 3 (the small business) goes live stage by stage: stage 1 (the business, its router and switch on the page, work orders SB-J1 and SB-J2), stage 2 (SB-J3, guest Wi-Fi on a ceiling access point: the access point's page through a business PC's web browser, the visitor's phone, the ring in 3D), stage 3 (SB-J4, the back of house on its own switch over a trunk with its allowed list and native VLAN), stage 4 (SB-J5, two dome cameras on PoE injectors on a VLAN of their own, each one's fixed address set on its own page, port forwards tested from the manager's phone on mobile data) stage 5 (SB-J6, hardening after a card-payment check: SSH only, no readable passwords, guarded ports, DHCP snooping and ARP inspection, the closet cabinet locked, live 2 November 2026) stage 6 (SB-J7, the provider's fixed address: the block in CIDR only, the mask worked out by hand, the default route added by hand, the cameras opened at the new address from the manager's phone, live 8 November 2026) stage 7 (SB-J8, the printers' VLAN: the printer moved onto a network of its own, its fixed address on its panel, every PC's printer port changed, the guests' list given a line in the right place, live 9 November 2026), stage 8 (SB-J9, the router rebuilt from its backup: a replacement router racked, its backup copied in over TFTP from your laptop, keys made again, live 9 November 2026) and stage 9 (SB-J10, a new department end to end: a room of its own, its VLAN, its block in CIDR worked out by hand, its pool, a reservation for the manager's PC, an access list letting only the manager in, live 9 November 2026 with the business floor plan fixed: every run routed round the devices, a bigger closet, nothing on a wall) are live, every work order built. **Its tickets go live one at a time, smallest first: the business Ticket Desk opened with SB-01 (the wrong VLAN on a port), live 9 November 2026; SB-02 (a VLAN deleted after the weekend) live 9 November 2026; SB-03 (a VLAN left off a trunk) live 10 November 2026; SB-04 (a DHCP pool handing out the wrong gateway) live 15 November 2026; SB-05 (the router's default route wrong) live 15 November 2026; SB-06 (NAT's inside and outside the wrong way round) live 15 November 2026; SB-07 (a VLAN left out of NAT) live 15 November 2026; SB-08 (a native VLAN mismatch on the back trunk) live 15 November 2026; SB-09 (the trunk between the switches never forms) live 15 November 2026; SB-10 (a router subinterface tagged for the wrong VLAN) live 15 November 2026; SB-11 (a pool with nothing left to lend) live 15 November 2026; SB-12 (an access list that blocks far more than it should) live 15 November 2026; SB-13 (an access list applied the wrong way) live 15 November 2026; SB-14 (the printer's address handed out) live 15 November 2026; SB-15 (VLAN hopping) live 16 November 2026;** see "Level 3: the business Ticket Desk and SB-01" and the notes for each ticket below. The level opens once the small office is finished. **Level 3 is complete: all 10 work orders and 15 tickets, live 16 November 2026, so it no longer carries `planned`.** See "Level 3, the small business" below.**
**After E4 (the owner, 28 October 2026): proof of hands-on skill built into the labs** (technician's reports, resume lines, level certificates with a verify page on the hub, an Add to LinkedIn button, interview cards; two tiers, "Completed" and "Instructor verified"). The plan and its open questions are in the owner's doc "Hands-on proof from the labs: plan" (https://claude.ai/artifact/SpwGhuG7e4gNufyTvhJhRk). The owner: finish E4 first, build this after, and have everything finished and updated before presenting it to anyone.
**Status (19 October 2026): Level 2 (the small office) is complete and live: the level lock, work orders SO-J1 to SO-J10, tickets SO-01 to SO-15 with the office's records on each, the managed switch, the closet rack and patch panel, SFP modules and fibre, the IPAM sheet (in build mode and on the Ticket Desk), your laptop's TFTP server. See "Level 2, stage 1", "Level 2, SO-J3", "Level 2, SO-J4", "Level 2, SO-J5", "Level 2, tickets SO-01 to 05", "Level 2, tickets SO-06, SO-07 and SO-09", "Level 2, ticket SO-08", "Level 2, ticket SO-10", "Level 2: the office's records on office tickets; tickets SO-11 to SO-15" and "Level 2: work orders SO-J6 to SO-J10, the small office complete" below.**
**Earlier status (11 October 2026): the real site, builds 1 to 4 and build mode, is live: fifteen home tickets, the live 3D models in every Physical tab, and the instructor tools (PIN), build mode J1 to J10 and free build**, linked
from the Under the Hood tile (decision 6). See "The real site" below. The owner, 11
October 2026: **"Build it like the preview you gave me just keep the layout
exactly the same just remove the C with A bars."** Confirmed with the owner
the same day: the three view buttons stay above the bars as the real way to
switch; the preview words, the "Earlier previews" line and the
C-with-A-bars page (`preview/approach-c2.html`) are gone; students land on
the **Ticket Desk**; the Network+ (V9) objectives read that day are current.

**Earlier status (10 October 2026):** model previews, batches 1 to 4, are up for the
owner's approval at `preview/models.html` (not linked from anywhere).
Batch 1: cable modem, fiber ONT, home router, 5-port switch, mesh node
(and its weak-link amber state). Batch 2: RJ45 T568B and T568A, bad
termination, damaged cable, RJ11, RJ11 beside RJ45, coax F-type. Batch 3,
rebuilt part by part to the owner's photos after "You are missing so much
detail. The requirement is to look real life as possible" (10 October
2026): desktop PC, laptop, network printer, smart TV, PoE IP camera,
data/voice wall plate, each with its cables plugged in as photographed.
The owner approved batch 3, 10 October 2026: **"Now, that is what I am
talking about."** Batch 3 is the bar for every model from here on: matched
part by part to the photo, cables plugged in as photographed, real print,
real finishes, on the bench with shadows, and checked photo-beside-render
from the photo's own angle.
Order set by the owner, 10 October 2026: "Start with 1 and then do 2":
batch 1 rebuilt to the batch 3 standard (done: modem, ONT, router,
switch and the stacked pair, mesh node front/back/weak), then batch 2
(done: the cables on concrete as photographed, clear plugs, the damaged
run's hump and tears), then batch 4 (done: cable tester main and remote,
crimper, 110 punch-down, tone generator and inductive probe, loopback
plug, the screwdriver set on its ESD mat, and the tools laid out as
photographed; `tools.js`), then the home-level workspace and first ticket
preview.
- Clear plastic (plugs): near-zero face-on opacity (0.012) with a sharp
  Fresnel rim (power 3, 0.8), front faces only; inner channel walls use
  the faint variant. The owner called the 0.08 version "kinda cloudy":
  every plastic layer adds a film. Physical transmission was tried and
  dropped (it veiled the wires white and dulled the gold), and so was a
  highlight term read from the lit colour (it clouded the whole plug).
  Wire insulation keeps a low environment reflection, or the colours
  wash to pastel.
- Detail pass, 10 October 2026, after the owner: "The crimper needs to be
  way more like the photo. The tone generator and inductive probe. As
  well as the screw driver set. The RJ45 is also kinda of cloudy." All
  four rebuilt; the owner: "The remakes look better."
- LEDs: a lit LED is emissive only (a lit base colour pushes it to white),
  with a glow sprite on layer 1. The viewer draws glows in their own pass
  after the ambient occlusion (AO darkens everything beside a raised edge,
  glow included, which sliced the glows), and hides a glow whose LED faces
  away or has something solid in front of it.

**Models** (`assets/models/`): procedural three.js, real millimetres, front
+Z, every port a named group (`port:LAN 1`) with userData for the build to
light and cable. three.js r160 is vendored in `assets/three/` (MIT),
including the post-processing addons the viewer uses: nothing is fetched
at runtime.
- `parts.js`: the shared pieces. Jacks stand proud of their panel (a jack
  flush inside a body is hidden by the body's face). `mat(color, {metal,
  rough, grain, brushed})`: before 10 October 2026 `metal` and `rough` were
  handed to three.js under the wrong names and silently ignored, so every
  "metal" part rendered as matte plastic. Fixed; keep the mapping.
- `surface.js`: the realism layer. Grain is worked in the shader from each
  mesh's own millimetres (same size on a button and a panel); finishes
  (plastic, brushed, painted steel, rubber); `perforated` (real holes, alpha
  tested); `printLines` (the outline boxes printed round port groups);
  barcodes, generic regulatory marks (no brand marks), printed labels; the
  wood and concrete the gear sits on.
- `cables.js`: plugs with the moulded boot (`rj45Plug({boot})`), `plugInto`
  a jack, `cableFrom` to run the cable on in the device's own coordinates
  down to the bench, `iecC13` mains plug and cord. Jacket legends at real
  size (about 2.5 mm letters).
- `endpoints.js`: batch 3. Rear ports in a tower stand on end (the board is
  on its side); the camera's port pocket is a real flat cut into the round
  base (`pocketWall`), not a pad floating on it.
- The viewer (`preview/`): wood bench (concrete for the camera), soft
  shadows, ambient occlusion (GTAO), per-model `view`, `light`, `stage`,
  `frame`, `focus` (close-up on a named panel); `__preview.cam()` for
  scripted shots matched to the owner's photos.
- Check a model by putting the owner's photo beside a render from the same
  angle and distance; a wide render hides missing detail.

## SAVE POINT (10 November 2026): Level 3's tickets, going live one at a time

The owner, 10 November 2026: "create a save point here." Where everything stands:

- **Live on `main`:** the business Ticket Desk with SB-01 (9 November, 72f420e), SB-02 (9 November, c151323), SB-03
  (10 November, a344844), SB-04 (15 November), SB-05 (15 November, d5503e7), SB-06 (15 November), SB-07 (15 November), SB-08 (15 November), SB-09 (15 November), SB-10 (15 November), SB-11 (15 November), SB-12 (15 November), SB-13 (15 November), SB-14 (15 November), SB-15 (16 November). Each went up from a tree staged off `main` with the later tickets cut out
  (`python3 tools/wip/stage.py N DEST`), then `tools/wip/golive.sh DEST "message"` (makes the live worktree, branch
  `save/level3-sb01` at `/home/user/e4-sb01`, exactly that tree, and commits; push with `git push origin HEAD:main` and
  `HEAD:save/level3-sb01`), then `main` merged back into this branch keeping this branch's full files and `main`'s CLAUDE.md.
- **This branch (`save/level3-tickets`, worktree `/home/user/e4-sbt`)** holds SB-01 to SB-12, every one with `kinds` (its
  variants; the tests add a business for any variant the seeds miss).
- **SB-04 went live 15 November 2026,** after every check passed on its staged tree (412 tests, drive 566 checks, 17
  contrast states, plants 6 of 6).
- **SB-05 went live 15 November 2026,** after every check passed on its staged tree (420 tests, the full drive 5,128
  checks, 20 contrast states, plants 7 of 7: two Node plants missed at first, both closed, see its notes).
- **SB-06 went live 15 November 2026,** after every check passed on its staged tree (427 tests, drive 814 checks on
  the newer browser, 22 contrast states, plants 4 of 4).
- **SB-07 went live 15 November 2026,** after every check passed on its staged tree (434 tests, drive 934 checks,
  24 contrast states, plants 4 of 4).
- **SB-08 went live 15 November 2026,** after every check passed on its staged tree (441 tests, the full drive
  5,496 checks, 26 contrast states, plants as in its notes).
- **SB-09 went live 15 November 2026,** after every check passed on its staged tree (448 tests, drive 1,180 checks,
  27 contrast states, plants as in its notes).
- **SB-10 went live 15 November 2026,** after every check passed on its staged tree (455 tests, drive 1,299 checks,
  30 contrast states, plants as in its notes).
- **SB-11 went live 15 November 2026,** after every check passed on its staged tree (462 tests, drive 1,425 checks,
  33 contrast states, plants as in its notes).
- **SB-12 went live 15 November 2026,** after every check passed on its staged tree (481 tests, drive 1,545 checks,
  36 contrast states, plants as in its notes).
- **SB-13 went live 15 November 2026,** after every check passed on its staged tree (489 tests, drive 1,665 checks,
  39 contrast states, plants as in its notes).
- **SB-14 went live 15 November 2026,** after every check passed on its staged tree (499 tests, the full drive 6,287
  checks, the models 202, 42 contrast states, plants as in its notes). The label printer still has no 3D model: the
  owner was asked for photographs on 15 November.
- **SB-15 went live 16 November 2026,** after every check passed on its staged tree (509 tests, the full drive 6,451
  checks, the models 202, 45 contrast states, plants as in its notes). All fifteen Level 3 tickets are live.
- **Level 3 complete, live 16 November 2026:** with all 25 built, `planned` and the "more tickets on the way" wording are gone
  (`js/desk/levels.js`). The drive finishes Level 3 through the page (every ticket solved, every work order but the last done, the
  last one finished): the done box says Level 3 is finished and the campus is still being built, Level 3 says Finished, 15 of 15
  tickets and 10 of 10 work orders, Level 4 says it's built later (`tools/drive.mjs`); `tests/levels.test.js` holds Level 3
  complete (failing on the old file). Checked on its own tree: `npm test` 509 of 509; the business-ticket drive 2,022 checks and
  the small office's 647; 54 contrast states (the levels and the business tickets), 166,749 text runs; 2 page plants (the old
  wording put back, a 26th piece waited for), both caught.
- **Level 4 (Campus), stage 1, live 17 November 2026:** Rafiki's HQ on the page with work orders CP-J1 to CP-J4 (lock down the
  access ports, the spanning-tree root, LACP between the distribution switches, the gateways onto distribution switch 1). Level 3
  finished opens it; it still carries `planned: 25` and says more work orders and its tickets are on the way. With it, two fixes
  for every level: `ipconfig /release` then `/renew` (the address came back as released) and the sticky columns following the
  bars when they grow. The Level 3 complete checks now expect the campus to open, not to be built later. See "Stage 1 on the page"
  in "Level 4, the campus" below.
- **Level 4, stage 2, live 17 November 2026:** CP-J5 (OSPF across the core: the core switches installed, the default from the edge
  router, the statics and the old link retired) and CP-J6 (distribution switch 2 joins, every gateway shared by standby). With them,
  for every level: a switch port facing a shut port now says notconnect; port security works the links out once a pass (a campus
  work order opens in about a second, not five). See the CP-J5 and CP-J6 notes in "Level 4, the campus" below.
- **Level 4, CP-J7, live 22 November 2026:** a new floor end to end (the fourth floor's training room: its access switch from the box,
  its VLAN on three switches and the bundle, its spanning-tree root, its gateway by standby, the edge router's pool and both relays, the
  desks locked down, the floor surviving distribution switch 1). With it, for every level: a work order's reload about twice as fast
  (each switch's VLAN settings fixed once, its links and a relay's way to its helper kept for a pass), and a dead link's diamond kept
  clear of other port names (on a phone it bled into "Gi0/2", 6.47:1). See the CP-J7 notes in "Level 4, the campus" below.
- **Level 4, CP-J8, live 22 November 2026:** the Training Annex on a collapsed core (one layer 3 switch as its core and distribution, an
  access switch for the classroom, single-mode fibre into core switch 2, routed and in OSPF); on the logical diagram a block of its own
  with the fibre a labelled stub at each end, on the floor plan its own band and the duct's route. With it, for every level: a pass of
  the links skipped after a command that changed nothing (every earlier work order replays the same, step by step), and the OSPF lines'
  new first cause, the link itself down. See the CP-J8 notes in "Level 4, the campus" below.
- **Level 4, CP-J9, live 22 November 2026:** jumbo frames for the backup network: two Linux rack servers (the file server in the data room,
  the backup server for the 2F closet), each with two ports, a backup VLAN of its own across four switches, `system mtu jumbo` saved and put
  into effect by a reload, each server's backup port at 9000 in its netplan file, a 9000-byte ping that mustn't be cut up passing both
  ways, and still passing with distribution switch 1 off. With it, for every level: a Linux command line on a server (its console, SSH from
  a desk PC, sudo, `ip`, `ping`, `ethtool`, netplan, reboot), MTU and jumbo frames in the simulation (giants, a receiver's drops). The rack
  server has no 3D model: it waits for the owner's photographs. See the CP-J9 notes in "Level 4, the campus" below.
- **Level 4, CP-J10, live 22 November 2026:** the central DHCP server: ISC's dhcpd on the file server, set up in nano (every desk network's
  subnet, its range, gateway, DNS servers and lease time, the server's own network, the help desk PC's reservation, eno1 only), started and
  enabled; every relay moved to it; the edge router's pools taken out; every desk asking again; still working with distribution switch 1 off.
  With it, for every level: nano, systemctl, journalctl, `dhcpd -t` and the lease list on a server, and DHCP served from a server through a
  relay. See the CP-J10 notes in "Level 4, the campus" below.
- **Level 4's tickets go live one at a time, smallest first (the owner's order):** CP-01, CP-02, CP-03, CP-04, CP-05, CP-06 live (23 November 2026), each after its own checks on a tree staged from its own commit (unit tests, its drive, its contrast states and plants). See "Level 4, the campus" below for each ticket.
- **Next, in the owner's order:** the rest of Level 4: the campus's Ticket Desk and its 15 tickets, smallest first; then Level 5
  (Enterprise). The owner, 17 November 2026: "Please keep building it all out.
  We will come back and make changes once I go through it." 
- **The container was rebuilt on 15 November 2026:** the worktrees were made again from the pushed branches, and the browser
  is now Chromium 1243 (`/opt/pw-browsers/chromium`): run the drive, AAA and models tools with `CHROME=/opt/pw-browsers/chromium`.
- **SB-14 and SB-15 are built** on `save/level3-sb14` and `save/level3-sb15` (worktrees `/home/user/e4-sb14`, `/home/user/e4-sb15`;
  SB-15's branch has SB-14's in it), each with notes in its `tools/wip/notes/`. They are merged into this branch after SB-13
  is live. SB-14's label printer has no 3D model yet: the owner was asked for photographs.
- **SB-06 to SB-09:** built and passing in Node; each goes live the same way. SB-08 carries shared code (the console's native
  VLAN mismatch log in `js/net/cmd.js`): full drive there too. Notes still to write (each from its section of
  `js/tickets/business.js` and its WRONG entry in the tests).
- **SB-10** (a router subinterface tagged for the wrong VLAN: printers, guests, the department's and guests' swapped; never
  the staff VLAN, or no PC could reach the router to fix it): Node tests pass, drive 119 checks, Node plants 5 of 5 (two
  wrong fixes added on the way). Notes in `tools/wip/notes/sb10.md` (results to fill in).
- **SB-11** (a pool with nothing left to lend: the guests' pool lending for ever after a market day, an exclusion leaving the
  staff pool one address, the same in the department's): built before "the printer's address handed out" because it needs
  nothing new in the business (the owner: "Keep building everything in order of increasing in size"). Node tests pass, drive
  126 checks; the drive caught its summary crashing on the guests' variant (fixed; every summary is now built on every
  variant in the tests, with a plant). Its plants and contrast states are written, not yet run.
- **SB-12** (an access list that blocks far more than it should: the guests' list without its last permit, the
  department's likewise, a printers' list of one deny): Node tests pass; its drive plan is written, not yet run; contrast
  states and plants still to write.
- **Still to build, re-sized 10 November 2026:** SB-13 an access list applied the wrong way (configuration only); then the two
  that need a new device, last: "the printer's address handed out" (a label printer at the counter on the printers' VLAN,
  on a closet switch spare port, which took the printer's address while the printer was off, from a printers' pool keeping
  back only .1 to .19: positions on both drawings and the drive's drawing checks) and VLAN hopping (a device that negotiates
  a trunk on a port left dynamic). Tell the owner the order changed and why when they go live; the titles are theirs.
- **Found on the way and worth keeping:** the card never gave a VLAN's name (now "20 · named STAFF · ..."); every value a fix
  types is now read off the card by the drive; the plant script runs the tests on 6 businesses, which had left a variant of
  SB-03, SB-06, SB-09 and SB-10 untried (fixed with `kinds`); several plants hit one of two guards (re-aimed at both); the
  router answers `show interfaces <subinterface>` (with its access lists), not `show ip interface <subinterface>`.
- **Checks per stage:** unit tests, the business-ticket drive, the business-ticket contrast states, the ticket's own plants
  (`python3 tools/plants-business-tickets.py SB-0N`, in a throwaway copy; a plant naming a ticket not on the desk is
  skipped); the full drive where shared code changes (SB-05, SB-08) and on the last. Background runs default to a 30-minute
  limit: give long ones the 2-hour limit.

## What it is

The Network+ (V9) Under the Hood build: an **interactive networking model**,
our own, **not a recreation of Cisco Packet Tracer** (owner, 9 October 2026:
"I dont want to recreate the packet tracer"). Static HTML/CSS/vanilla JS, no
build step, served from `main` by GitHub Pages.

- **Build mode:** students build their own networks: place devices, cable
  them, configure them. Each build has a goal the model checks by sending
  real traffic through what they built.
- **Troubleshoot mode:** prebuilt networks with a generated fault, proven
  present before a student sees it.
- **Faults:** everything the Network+ objectives list, plus the common
  real-world faults technicians meet, generated so students don't memorise
  them (owner agreed this wording, 9 October 2026).
- **Command line on every device that really has one** (owner: "they need
  to learn the commands and how to move around a network"): routers,
  switches and firewalls get an industry-standard network CLI with our own
  unbranded device names; PCs get Windows Command Prompt; servers get Linux.
  Home routers and access points use a web page, as real ones do.
- **Levels:** home, then small office, small business, campus, enterprise
  (data center, WAN, cloud).

## The owner's decisions, 9 October 2026

1. **Repo:** this one, The-E4-Mafia-Network.
2. **Setting:** Rafiki's IT Services again, with **fresh code**: nothing
   copied from the Core 1 or Core 2 builds.
3. **Commands:** the industry-standard style; students must learn the
   commands and how to move around a network.
4. **3D models:** the owner supplies the photographs, because the models
   must be real-world accurate. The shot list given to the owner is below.
5. **First slice:** the home level: build mode with its goal checker, and
   troubleshooting tickets for the faults that fit a home network, plus the
   standing five extra scenarios. Then climb a level at a time.
6. **Placement:** the Under the Hood Labs tile (repo `under-the-hood-labs`
   and the Command Center's tile), **between A+ Core 2 and Security
   Start-up Firewall**. Add the link only once the first slice is live.
   **Done 11 October 2026**, once the home level's tickets and build mode
   were live: "The E4 Mafia Network" is link 3 of 5 on the standalone
   tile page (`under-the-hood-labs`, commit adcee28) and in the Command
   Center 2.0 hub's Under the Hood tile (commit 88eb475), linking to
   https://rafikiscyent888.github.io/The-E4-Mafia-Network/ (the address
   GitHub's own Pages deployment reports). Both repos' `verify/page.mjs`
   expect it in that place.

## Built like the real world, as one giant teaching tool

The owner, 10 October 2026: **"I want this to built like you would do in the
real world however as one gaint teaching tool."** So the configuration is
the real job, done with the real commands on each device, and the model
proves the result by sending traffic through it: a VLAN either carries the
traffic or it doesn't, for the real reason. Every configuration skill is
also a troubleshooting skill: what can be configured can be broken in a
ticket, found with the show commands and fixed with the configuration ones.

What students configure, by level (agreed 10 October 2026):

| Level | Configuration |
|---|---|
| **Home** | IP plan (address, mask, gateway, DNS); the router's web page (DHCP range, Wi-Fi name and security, port forwarding); static addresses for a printer or camera |
| **Small office** | First managed switch: hostname, passwords, remote management, port settings (speed, duplex, shutting unused ports); subnetting the office into blocks |
| **Small business** | VLANs (create, access ports, trunks with allowed and native VLANs); inter-VLAN routing on router subinterfaces; a DHCP scope per VLAN; ACLs; NAT/PAT; a guest network kept apart |
| **Campus** | Layer 3 switches with a gateway per VLAN; spanning tree (root bridge, port roles, protections); link aggregation; OSPF; first-hop redundancy with a virtual gateway; MTU and jumbo frames; port security |
| **Enterprise** | BGP to the providers; route selection across static, OSPF and EIGRP; a screened subnet and firewall zones; site-to-site and remote-access VPN; a cloud network (VPC, security groups, cloud gateway); SNMP, syslog, NTP, port mirroring |

**Subnetting is by hand:** students work out classful, CIDR and VLSM plans
themselves and record them in an IPAM sheet; the model catches overlaps,
wrong masks and gateways outside the subnet. No built-in calculator does it
for them, and Mason's hints point at the principle, never the answer.

## THE GOAL — read this before designing anything

The owner, 10 October 2026: **"I need to get them comfortable using commands
to troubleshoot and move around the network devices to solve problems
using the network sims as a base."**

So the command line is the centre of the build, not a feature of it:
- moving around: console into a device, SSH from one device to the next,
  find the next hop with neighbour discovery and the routing table, exit
  back; the prompt always says where you are and which mode you're in
- the modes and the help: user and privileged EXEC, global and interface
  configuration, `?` and tab completion, `show` before `configure`
- troubleshooting by evidence from commands on each device (show,
  ping, traceroute, ipconfig, nslookup, arp), then the fix, then verify
- the Network-Sims scenarios are the base for the tickets
Build mode, the diagrams and the 3D models serve this goal.

**One giant interactive network** (owner, 10 October 2026: "I want to turn
the sims into one gaint interactive one with all network topologies
applied"). The sims are not separate exercises: their scenarios happen
inside one connected network that contains every topology on the
objectives. Proposed placement, shown to the owner for confirmation:
client homes (star round the home router, plus wireless mesh); small
office (star on a switch); Rafiki's IT Services HQ (three-tier: core,
distribution, access); a smaller building (collapsed core); branch offices
(hub and spoke back to HQ); a leased line between two sites
(point-to-point); the data center (spine and leaf); the core routers
joining HQ, data center and cloud (mesh); the whole thing (hybrid). Each
sim's scenario sits where it fits (STP in the campus switches, routing
tables on the WAN, ACLs at the firewall, VLSM in the address plan), and
students move around all of it from the command line.

## More decisions, 10 October 2026

- **Network-Sims is a knowledge base**, as Core-2-Sims was for Core 2: each
  sim becomes a ticket set (the sim itself plus five more), the sims' own
  keys stand, Extra training covers the objectives no sim covers, and an
  Exam Practice view lays each sim out the way the exam does.
- **Both build modes:** client jobs (a work order: rooms, devices,
  requirements, limits such as 100 m runs and the PoE budget, the model
  checks the job against it) as the main path, and free build.
  **No budget** (owner, 10 October 2026: "We are not worried about budget").
- **Instructor tools behind the instructor PIN** (kept in the owner's private notes, never in this public repo): choose a specific fault for a class
  demonstration, show the fault and the fix after class, unlock any level.
- **Defaults the owner did not object to:** a logical diagram and a
  physical view (house floor plan, closet rack in 3D) plus a terminal
  panel; console-cable setup first, then SSH, web pages for home gear;
  Mason as team lead and coach with the program's ladder and rules; a
  packet step-through showing headers change hop by hop; Wi-Fi shaped by
  walls, distance and neighbours' networks; AAA, a persistent dyslexia
  toggle, the full footer, progress saved in the browser.
- **"Don't build yet"** (owner, 10 October 2026): photographs still coming.

### Photographs received (10 October 2026)

Home level, in the session, not in the repo: a mesh node (front, side,
back with WAN/LAN/12V ports, bottom label, status LED), a cable modem
(front LEDs POWER/DS/US/ONLINE/LINK-ACT; back coax F-type, Ethernet,
reset, power), a fiber ONT (POWER/PON/ALARM/LINK-ACT/ETHERNET; green SC/APC
fiber port, Ethernet, 12V DC), a home wireless router (four antennas;
INTERNET/WAN, LAN 1-4, RESET, WPS, power), a 5-port unmanaged gigabit
switch (front ports with link LEDs, back power). Brand marks in the photos
stay off the models.

Then the rest of the home list, the same day: RJ11 beside RJ45 (two shots),
straight-through (T568B) and crossover (T568A end) connectors, a bad
termination (jacket out, too much untwist), a kinked and crushed cable, a
compression F-type coax connector, a data/voice wall plate (Ethernet and
telephone), a desktop PC rear panel, a laptop's Ethernet side, a network
printer (port with link/activity LEDs, control panel showing its IP), a
smart TV rear panel, a PoE dome IP camera, a cable tester (main and remote,
pins 1-8 and G), and the tools (RJ45/11 crimper, 110 punch-down, tone
generator, inductive probe, RJ45 loopback plug). **The home-level list is
complete.**
Plus one the owner added: an **electronics screwdriver set** (precision
bits in a case, a driver handle), shown on an ESD mat with tweezers: the
technician's bench kit for opening equipment.

Accuracy notes for the models (the photos are reference, the standards
win): wire colour order follows TIA-568 T568A/T568B exactly, not the
photo's pixels; RJ11 is a 6-position connector (2 conductors for one line,
4 for two lines), not "4-pin"; garbled text in the photos (tester screen,
labels) is replaced with correct wording; sides a photo doesn't show follow
the standard design for that device and are previewed before use.

## Workspace and structure: C with A's bars chosen (11 October 2026)

The owner, 11 October 2026: **"I want it to look like packet tracer,
however, I want to make it my own design. I want three different
approaches. One giant network that grows really does not make sense for
the objectives, correct? We need to talk about this some more with
previews."** And: **"I am going to turn up the settings once I am happy
with what we talk about. So, lets get talking."** Nothing is built until
the owner picks.

So the "one giant network" decision above is **reopened**. Three previews
(not linked from the site) in `preview/`:
- `approach-a.html` **Lab Bench**: separate labs on shelves by domain,
  each its own small network (like Packet Tracer activity files); the
  closest look to Packet Tracer (canvas, device palette, step-through
  list, device window docked beside the network).
- `approach-b.html` **Service Map**: Rafiki's service area as a map of
  separate sites, each sized to its objectives, linked only where an
  objective needs it (WAN, leased line, VPN, BGP, cloud); every topology
  at the site where it really belongs. A table maps sites to objectives
  and to the Network-Sims.
- `approach-c.html` **Ticket Desk**: the help-desk queue first; each
  ticket generates the network it needs; logical diagram plus the house
  floor plan, device terminals, a notebook, the six-option diagnosis.
All three use the same home network and ticket HOME-01, our own device
icons, the photo-accurate 3D models in each device's Physical tab, AAA
(checked on painted pixels, desk and phone, easier reading on and off,
with plants), the persistent easier-reading toggle, the full footer.
Diagrams keep a readable size on a phone and scroll inside their box.
Label plates (`E4plates` in the previews' shared script) pad 2 SVG units
above and below the text: at 1 unit a floor plan drawn small left the
last pixel row of a label over a cable line.

**The owner's pick, 11 October 2026: C, the Ticket Desk, with A's two
top bars** ("I like C the best, however, add this from A right above
Queue, Home 01, Terminal"). Preview: `preview/approach-c2.html`. Then, the
same day: **"that top piece right there ... from A, I want it across
everything, and I want the command prompt to stay right there on the
right-hand side ... and I want the terminal options always on top as
well ... so that way they can either click on the actual network map
itself, or they can click right above there for quicker access."** So:
- A's two bars (the app bar with Labs/Ticket/View/Notebook/Help and
  easier reading; the toolbar with Logical/Physical, the ticket title,
  Live/Step through) span the whole page and stay at the top while it
  scrolls (`.chrome`, sticky). On a phone (under 760px) they scroll away,
  or they would fill half the screen.
- Three columns: queue, ticket (diagram, then the diagnosis under it),
  terminal. The terminal column stays on screen on the right while the
  page scrolls (sticky under the bars; `--chromeH` is set from the bars'
  real height). Under 1100px the columns stack.
- Above the terminal, always on top of it, a button for every device in
  the ticket's network (all ten in HOME-01); the pressed one is the open
  device, and the terminal heading names it ("Terminal · Printer").
  Devices also open from the logical map and from the floor plan (click,
  Enter or Space). The terminal is a fixed pane here, so it has no Close.
- The owner, after clicking through: "I didn't fully comprehend and slow
  down to think when I was clicking between the tabs." The previews stay
  up for the owner to take their time with.
- Checks for this layout: AAA on painted pixels in scrolled positions too
  (the bars and terminal over scrolled content; only the part of a line
  really on top is measured), and a click test of every way to open a
  device; both shown to fail on planted defects.

**A, B and C again, in the chosen layout** (owner, 11 October 2026:
"Please add A and B and C back with layout of C with A bars", then "I
want to see them again"; asked, the owner chose three pages in the same
layout over one page with all three). `preview/workspace-a.html`,
`workspace-b.html` and `workspace-c.html`, built from one template, so the
bars, the ticket, the diagram, the diagnosis, the terminal and the
notebook are identical (the click test compares them). Only the left
column changes, with the bar's title line and the explanation underneath:
- A, Lab Bench: one shelf per exam domain (with the doc's percentages),
  labs on each; the troubleshooting shelf open on HOME-01.
- B, Service Map: the service area drawn tall to fit the column, one site
  per row, the links as arcs down the left (the longer the link, the
  wider the arc); the whole row picks a site; the site's card underneath.
  Two map labels are shortened to fit (Annex, Bakery ×3); the card keeps
  the full names.
- C, Ticket Desk: the queue.
The earlier previews (approach-a, -b, -c) stay, linked from the banner;
`approach-c2.html` (C with A bars) was removed at the owner's word, with
every link to it. The contrast checker opens every shelf (`details`)
before measuring and skips text that isn't on screen.

**Home fault tickets** (owner, 11 October 2026: "lets cover the most
common top 5 with 5 harder ones as well"). Built into the real site as
the preview showed them (HOME-01 to 05 in build 1; 06 to 10 next):
common: HOME-01 cable unplugged or broken (no link, "Media
disconnected"); HOME-02 no DHCP lease (APIPA 169.254); HOME-03 wrong DNS
or gateway (connected but no websites); HOME-04 Wi-Fi interference,
channel or distance; HOME-05 modem or provider down (ONLINE light off).
Harder: HOME-06 IP address conflict (static printer inside the DHCP
range); HOME-07 DHCP pool exhausted; HOME-08 slow link from a damaged
pair (100 Mb/s) shown on the tester; HOME-09 double NAT or port forward
(the camera from outside); HOME-10 rogue DHCP (a second router handing
out 10.0.0.x). Each generates variants, plus the standing five extra.

**What the student sees first**: the Ticket Desk (owner, 11 October 2026).

## The real site (build 1, 11 October 2026)

Three pages, one desk: `index.html` (Ticket Desk, where students land),
`lab-bench.html`, `service-map.html`. Each is a small static shell (the
view buttons, the bars, the three columns, the how-to box, the footer,
the Help dialog); `js/desk/app.js` fills it. Only the left column, the
bar's title line and the how-to box differ between them. The ticket, its
network and the progress are shared, so a ticket follows the student from
view to view.

**The engine** (`js/net/`, no page code, tested under Node):
- `home.js`: the home template. A seed decides the client, the LAN
  (192.168.1/0/50/86.x), the DHCP range, which switch port is which, the
  neighbours' Wi-Fi. Layout positions for the diagram and the floor plan.
- `sim.js`: the simulation. Cables (seated, crushed, damaged pairs: 100
  Mb/s), the coax and the modem's sync, Wi-Fi (signal by room and band,
  co-channel interference from the neighbours, band steering), layer 2
  (who hears whom), DHCP (the DORA exchange, pools, reservations,
  APIPA), ARP, routing through the router and NAT, DNS servers that
  really answer or don't. Every change goes through `apply()`.
- `cmd.js`: the Windows Command Prompt (ipconfig with /all /release
  /renew /flushdns, ping with -n -t, tracert, nslookup, arp -a, netsh wlan
  show interfaces / networks mode=bssid, getmac, hostname, cls, help).
  Output follows Windows' own formatting (the label strings are Windows'
  exact 39-character labels). Windows Firewall drops pings to the PCs, as
  it does by default. Interference loses a steady share of pings spread
  through each run, so four pings on a lossy link always show it.
- `pages.js`: every device's tabs and pages as data: the router's admin
  (Status, LAN & DHCP, DHCP clients, Wi-Fi), the modem's lights and
  status page (DOCSIS log lines), the switch's port lights (green 1 Gb/s,
  amber 10/100), the PC's network settings, the laptop's Wi-Fi, the
  printer panel, camera, TV, mesh, phone; the Physical tab (look at a
  plug, reseat, cable tester, swap the cable, tighten the coax, restart).

**Tickets** (`js/tickets/`): `home.js` defines each ticket: `build(seed)`
plants the fault; `exhibits` proves it is really there (a ticket moves to
the next seed if a generated house ever fails to show it; the tests
assert none ever does); six options (one right, five near misses each
with the reason it's wrong); rung 1 and rung 2 text; three fix hints;
`fixed` (the real cause is fixed); `proves` (what a command must show
afterwards: a reply from something other than the computer itself, so
`ping 127.0.0.1` never counts); the notebook's evidence rules; the
summary. `engine.js` runs a ticket: actions, the board and its ladder
(nothing for wrong picks 1 and 2, rung 1 at 3, rung 2 at 4, rung 3 at 5
and every one after: strikes with reasons until two remain, never the
right one; reset clears the board, not the count), the fix hints,
putting the network back as found, saving (the seed plus the actions that
changed the network, replayed exactly on load).

**Built in build 1:** HOME-01 cable (PC end out, switch end out, or
crushed under a chair: the tester shows pins 1, 2, 3, 6 open); HOME-02
DHCP switched off (the new laptop gets 169.254; fix: turn it on, then
renew); HOME-03 wrong DNS handed out by the router (a mistyped copy of
the provider's 203.0.113.53 from the welcome letter); HOME-04 2.4 GHz
channel 6 crowded by neighbours in the back bedroom (fix: the quiet one
of 1 and 11; the other has a strong neighbour too); HOME-05 a loose coax
F-connector at the modem or the wall (DS blinking, ONLINE off). HOME-06
to 10 showed in the queue as "Coming next" until build 2.

**Built in build 2 (11 October 2026), the five harder ones:** HOME-06 IP
conflict (the printer's fixed address is the DHCP range's first address;
the new TV asked first and got it too; test pages print or fail depending
on who answers ARP; fixes: move the printer out of the range and repoint
the PC's printer port, or reserve the address and restart the TV, or
shrink the range and restart the TV; restarting the TV alone gets it the
same address back); HOME-07 pool exhausted (ten addresses leased for a
week, last weekend's party guests' leases still held; the guest's phone
joins and gives itself 169.254; fix: widen the range, then turn the
phone's Wi-Fi off and on; a shorter lease does not free today's leases);
HOME-08 damaged pairs 4, 5, 7, 8 (the link comes up at 100 Mb/s, amber on
the switch; speed test on the PC about 94 Mb/s against the laptop's
hundreds; the kink shows at one end only; fix: swap the cable; reseating
can't help); HOME-09 port forward to the camera's old address (no
reservation; after the power cut the phone got the camera's old address;
the camera app on mobile data is refused; fixed only when the forward
points at the camera AND the camera's address is reserved: the forward
alone works for now, and Mason says so, "Will it still work after the
next power cut?"); HOME-10 rogue DHCP (an old router on a free switch
port, not on the documented diagram, only on the floor plan; it answers
the laptop and the TV first; fix: unplug it or turn its DHCP off, then
renew the laptop and restart the TV). Engine additions: a rogue router
(`net.extra.rogueWins` decides who it answers first), port forwarding
with `outside(port)`, a speed test, the PC's printer port and test page,
"turn Wi-Fi off and on" on phones, reservations and port forwards on the
router's pages, the printer's own TCP/IP panel. A ticket solved by just
opening a page (HOME-07, HOME-08) is counted like any other: the drive
test found the first version didn't count it.

**The Physical tab: the live 3D models (build 3, 11 October 2026).** The
owner: "Yes go straight on, those five look right" (stage 3, then stage 4).
Every device with a Physical tab shows its approved model, live and
turnable, set to what the simulation says right now:
- `js/net/physical.js` (pure, node-tested) works out what the model shows:
  each port's plug in, out (hanging loose) or none, a coax screwed on or
  loose, the lights (lit, dark, blinking; green, amber for a 10/100 link
  on the switch, blue for ONLINE), a split cable at the end the kink is
  near (HOME-08), the crushed run behind the PC's desk (HOME-01), and
  what is on the printer's and TV's screens (their real addresses). The
  laptop's screen shows Command Prompt waiting: what it says is for the
  student to find out. The same facts are written out under the model
  ("What you can see on it"), so nothing depends on seeing colour. The
  old router in HOME-10 is drawn with the home router model, LAN 1 only.
- `js/desk/model3d.js` (loaded the first time a Physical tab opens; the
  pages carry the three.js import map) builds the model from
  `assets/models`, then sets it to that state: pulls plugs out and lays
  their cable again from where the plug now is, removes the photo's cables
  where the house has none, backs the coax off its thread, paints the
  lights, blinks DS/US about once a second (steady for anyone who asks
  for less motion). ONE canvas and ONE WebGL context for the whole page:
  the canvas moves into whichever Physical tab is open. It draws only
  while something changes, then once more with ambient occlusion. Named
  views per device (Back ports, Front lights, Top lights, Ports close-up,
  Cable run, Control panel, Screen), Turn left/right, Closer, Further,
  Reset view, and **Enlarge** (the same model in a big window, for anyone
  who needs it larger). Without WebGL it falls back to the still
  (`assets/stills/`, which shows every cable in) and says so; the words
  still say what the model shows.
- The model files gained options, with the approved look as the default
  (the preview page is unchanged): `homeRouter({ wan, lans })`,
  `unmanagedSwitch({ plugged })`, `laptop({ screen })`,
  `networkPrinter({ screen })`, `smartTV({ screen })`,
  `ipCamera({ ipLine })`; `cableFrom` records how each run was laid
  (so a plug can be pulled and its run re-laid) and takes `crush` and
  `split` damage.

**Build 4 (11 October 2026): five more home tickets and the instructor
tools.** The owner: "Yes go straight on, those five look right." Objectives
doc re-read that day (Network+ V9 unchanged). In the queue as "Tier 1 ·
Home · five more":
- **HOME-11** the printer's subnet mask typed wrong (/29 or /28, chosen so
  the office PC and the router are both off its network). It answers ARP
  but its replies never come back: `route()` now checks the reply path too
  (`canReply`); ping says Request timed out and arp -a shows its hardware
  address. Fix: the mask on its control panel. (Incorrect IP/subnet mask.)
- **HOME-12** the office PC's static default gateway left at the old
  router's address (.254 on this network, or the old network's .1). It
  prints but nothing leaves the house. Fix: the PC's new **Edit IP
  settings** form (Network settings tab): the gateway, or Automatic.
  (Incorrect gateway, default routes.)
- **HOME-13** PoE: every house now has a **PoE injector** (802.3af) in the
  office between the switch and the camera, as a real non-PoE switch needs;
  the camera runs on power down its cable (`poePowered`), and the injector
  passes the link straight through, so the switch light goes dark with the
  camera. The fault: its adapter unplugged, or a cheap passive 24 V
  injector bought as a replacement. Fix on the injector's Physical tab
  (plug it in / swap in an 802.3af one). Its 3D model (`poeInjector`) was
  matched to the owner's photograph on 11 October 2026 (see "PoE
  injectors matched to the photo" below). (PoE, power considerations.)
- **HOME-14** the router set to WPA3-Personal only; the old laptop's
  adapter stops at WPA2 (`netsh wlan show drivers`, new). Wi-Fi security is
  now real (`canSec`/`usesSec`, a Security choice on the router's Wi-Fi
  page). Fix: WPA2/WPA3 (transition); WPA2 alone works but Mason says it
  took WPA3 from everything else. (Wireless encryption, authentication.)
- **HOME-15** an evil twin: an open hotspot outside with the house's name
  and a fake "router update" page; the laptop joined it and the password
  went into the page. A saved profile is for open or secured networks, not
  both; netsh lists the name twice; the laptop's Wi-Fi tab now lists the
  networks in range with Connect, and Forget; the router's Wi-Fi page shows
  its radios' BSSIDs and can change the Wi-Fi password (`wifi.gen`), after
  which every device needs it again (phone: Re-enter the Wi-Fi password).
  Fixed only when the laptop is back on the real network AND the password
  has been changed AND the phone has the new one. (Evil twin, rogue devices.)
- Device IP settings (printer panel, PC form) now take any well-formed
  setting, right or wrong for the network, as real devices do; before,
  their error messages would have given HOME-11 and 12 away.
- On the diagram the injector sits right of the switch, its label to the
  right (a new label side) and its own port names left to its Physical tab;
  on the floor plan it is on the office's lower left. The red diamond for a
  dead run now sits halfway along the run itself, and the "red dashed run"
  key is on the garage floor, clear of every label.
- Fixed with it: the switch's Physical tab said "Patch cable to the iP
  camera" (names are lower-cased only when the first word is a plain
  capitalised word: "office PC", "IP camera", "PoE injector").

**The instructor tools** (menu: Instructor; the instructor PIN, the owner's
standing PIN). Only a hash of the PIN is in the code; it unlocks for that
browser tab (sessionStorage), so the next student on the computer doesn't
inherit it. Inside: open any ticket on a chosen house number for a
demonstration (the same number always builds the same house); show the
open ticket's right answer, cause, fix, fix hints and the proof that
counts; show all of Mason's help at once (rung 1, rung 2, and the reasons
rung 3 strikes); clear this computer's progress; lock again. Everything
shows in the instructor's window, never on the student's board. (A static
site can't truly hide anything: this keeps answers out of casual reach.)
"Unlock any level" (on the owner's 10 October list) comes with the second
level: only the home level exists, so nothing is locked yet.

**Build mode, B1 (`build.html`, 11 October 2026).** The first slice
(decision 5, 9 October) is the home level's build mode with its goal
checker as well as the tickets; `preview/build-mode.html` (not linked)
showed it first. The owner said "Keep going", so it is built with the
defaults stated to them: the flow is place, cable, set up, then "Check the
job"; placing and cabling are done from lists (keyboard and screen-reader
friendly; drag can come later if wanted); the five jobs as previewed. It
goes up in three verified pushes: **B1** the build page, its
engine and checker, J1 and J2; **B2** J3 (the porch camera and the PoE
budget) and J4 (Wi-Fi to every room: mesh placement); **B3** J5 (a guest
Wi-Fi kept apart), free build, the five extra jobs, then the Under the Hood
tile link (decision 6). All three are live (B3 went up as B3a, B3b and the
tile link, 11 October 2026). The Tickets | Build switch is in every page's bar.

- **The house as the technician finds it** (`js/build/jobs.js`,
  `factory`): the modem already in by the living-room outlet (the
  provider's coax stays), the router at factory settings (Wi-Fi named
  `ROUTER-` plus four hex digits, its Wi-Fi and admin passwords those
  printed on the label, no reservations, no forwards), everything else in
  its box. A later job starts from the earlier job's work already done
  (`settle`). `net.extra.build` marks a build house.
- **The simulation's build pieces** (`js/net/sim.js`): devices `boxed`
  (off, on neither drawing, no device button); `place` (a room; the modem
  and the camera have fixed places, `FIXED_ROOM`; a cabled device must have
  its cables pulled first); `lay` (two free ports from `PORTS`; the cable
  is as long as `runLength` says between the rooms, 3 m inside one room);
  `pull` (never the provider's coax); a copper run over `COPPER_MAX` (100 m)
  has no link (no room in this house is that far: the tests stretch one to
  prove it); the Wi-Fi renamed (`ssid`, 1 to 32 printable characters) and
  the router's admin password changed (`admin.gen`); `wanCable()` finds
  the modem-to-WAN cable whatever it's called (into a LAN port it isn't
  one). Wi-Fi signal rows for an access point in any room. In a build house
  a device on 169.254 keeps asking for an address, as Windows does every
  few minutes, so cabling the router in after the switch still works; the
  tickets keep the moment frozen.
- **Each line of a work order is an ordered list of causes**: everything
  that could stop it, in the order a technician would rule them out (in its
  box, wrong room, no cable, no link, not on the router's house side, own
  IP settings, the router offline, gateway or DNS). The first one really
  there is what the check saw (its evidence line); every one before it is
  ruled out by the network itself. Mason's rung 3 (`engine.narrow`) uses
  exactly that: the real cause and its nearest neighbour, in an order that
  doesn't give it away, and every cause before it struck with its reason.
  Nothing after the real cause is struck, because the network hasn't ruled
  those out. Rung 1 is where to look, rung 2 the principle; the count is
  per line, every failing check of it (the one at the start counts), and
  resets when the line is met. Never what to type or where to plug.
- **J1 Move-in:** the router online through its WAN port; the office PC
  and the TV wired, in their rooms; the phone and the laptop on the Wi-Fi;
  the Wi-Fi renamed with a new password; the admin password changed.
  Joining before the rename, or before the new password, means joining
  again (the check says the device is looking for the old name, or has the
  old password). **J2 Home office:** the PC wired in the office; the printer
  on a fixed address the router will never hand out (set by hand outside
  the range, or reserved and then restarted to pick it up); the PC prints
  to it; one cable through the office wall (a switch shares it); everything
  that worked still works. A printer inside the range prints today and
  fails the check, which says why.
- **The page** (`js/build/app.js`): the jobs list (work orders, then
  "Your own": free build); the work order (the client's words, Mason, the order's
  lines, the limits); what's still in its box; Place or move a device;
  Lay a cable (the run's length shown before it is laid; ports in use
  listed but not choosable); Undo the last change; Put the house back as
  you found it (checks, Mason's count and notes kept); the floor plan
  (placed devices only: each in its usual spot when that's its room and
  it's clear, otherwise the first clear place in its room, tile and name
  kept off everything else; laid runs drawn between the devices' real
  places, bowed so two never share a line, red dashed with a diamond when
  down); the Cable runs table (ends, length, link marked with the words
  and a tick or cross, Pull); Check the job (each line marked three ways:
  the tick or cross, the colour with its inset rule, and "Met" or "Not met
  yet", with what the check saw; "you've changed the house since this
  check"); Mason; the Job done box (what was built, Start this job again,
  Next job). The terminal and device pages are the Ticket Desk's own; a
  router fresh from its box shows the label's password in its Status page
  (Change the admin password) and on its Wi-Fi page (the name editable);
  a phone not on the network as it's now called shows Join <name>. Job
  notes. Progress in `e4-build-v1`. The instructor window (same PIN) has
  build tools: a job on a chosen house number, one way to do it (`answer`;
  any way the network accepts passes), all of Mason's help, clearing build
  progress.

**Build mode, B2 (11 October 2026): J3 and J4.**
- **J3 The porch camera** (PoE budget). The house starts as J2 left it.
  In the van: an 802.3af PoE injector (15.4 W out, about 13 W at the
  device) and an 802.3at PoE+ one (30 W out, 25.5 W at the device), two
  devices of kind `injector` (`injector`, `injector2`). The camera is one
  of two by the house: a plain one (up to 6.5 W, 802.3af: either injector
  works) or one with a heater for the winters (up to 25.5 W, 802.3at). On
  802.3af the heater camera starts on limited power, with no heater and no
  night vision (`sim.poeShort`, `POE`); its Web page says so, its status
  light blinks amber, and its box label in the limits says what it needs.
  Lines: the camera on the porch powered over its cable and on the network
  (no power from a switch port or from DATA IN; the injector's adapter;
  DATA IN cabled to the house side); enough power for everything it does;
  its address never changes (the printer's line made general:
  `fixedCauses`); viewable from away (the phone's camera app over mobile
  data: a forward of outside port 8443 to the camera's port 443, which the
  camera's Web page states, as its manual would); everything that worked
  still works. A router fresh from its box has an "Add a port forward"
  form and Remove buttons on its Port forwarding page.
- **J4 Wi-Fi to every room** (mesh placement). The laptop is in the back
  bedroom upstairs, on 44% from the router downstairs; video calls need
  about 45%. In a build house the mesh node's link back to the router is
  worked out (`sim.meshLink`): a cable from its WAN or LAN port that
  leads to the router's house side (wired backhaul), or the router's
  5 GHz signal where it stands, 40% or more. A build house's upstairs is
  drawn as the back bedroom and a new **landing** at the top of the stairs
  (the router's 5 GHz reaches it at 56%; it reaches the bedroom at 80%).
  Two right answers: the node on the landing, or in the bedroom with a
  cable back. In the bedroom with no cable its link is lost (24%): the
  status ring is amber and its page says why. The tickets' mesh and
  injector are unchanged (a test holds them to it).
- **3D models:** the camera prints its PoE class by its port (the heater
  camera says "PoE+ 802.3at": the photographed housing, only the printed
  text changes). The PoE+ injector became the dual-port one in the owner's
  photograph, 11 October 2026 (below).
- Found by the new checks while building: a mesh node wired back to the
  router broadcast no Wi-Fi (its access points had been limited to the
  wireless case); the Place form left out a device with a fixed place
  still in its box (the camera could not be unboxed onto its mount); and
  AAA caught the 38 m camera run painting over "KITCHEN" at 1.01:1 (the
  plan drew runs over the rooms' names, which the tickets' fixed runs
  had always missed): the rooms' names now go above the runs.

**Build mode, B3a (11 October 2026): J5 and free build.**
- **J5 A guest Wi-Fi kept apart** (segmentation, guest networks). Every
  build house's router has a guest network, off as it comes from the box
  (`router.guest`): its own name, its own password (open until one is
  set), its own subnet (`192.168.<home + 100>.x`) with its own DHCP pool,
  and "Keep guests off the home network" ticked by default. Guests reach
  the internet; with isolation on, the router drops anything they send
  towards the home network (`route` fails "blocked", so a ping times
  out), and the home side can't reach them either. The router's Wi-Fi
  page has the Guest network section; Status shows it; DHCP clients list
  guests' leases. A phone with more than one network in range shows the
  list to pick from. A visitor's phone waits in the kitchen. Lines: a
  guest network with its own name and password; the visitor online on it
  (given the home password, it's on the home network: the check says so);
  guests reach none of the house's devices; the house's own devices stay
  on the home network. A second guest password change makes the visitor
  join again; the home network is untouched by it.
- **Free build** ("Your own" in the jobs list): an empty house, every
  device in the van (router, switch, PC, printer, TV, camera, both PoE
  injectors, mesh node). No work order: the check tests the health of
  whatever is built: every device set up is online (worked from the bottom
  up: the router, the wired devices, the camera, the mesh node's link,
  the phone and laptop), no two devices share an address (nor the
  router's own), the router hardened, every cable within 100 m and with a
  link. Mason's ladder works on it like any job.
- Found by the drive: the visitor's phone had no device button on the
  build page (the page's own device list didn't include it), so a check
  now asserts every device out of its box has one.

**Build mode, B3b (11 October 2026): the five more jobs, J6 to J10** (the
standing rule: five more scenarios on top of every new area). Each reuses
what the simulation already models; each starts from J2's working house.
- **J6 The replacement router.** The old one died; the new one, a different
  model, is in its box (its own factory name and label passwords). Lines:
  online; the Wi-Fi as it was, the same name and the client's password
  (typed in from "the card on the fridge", a button on its Wi-Fi page, so
  every device rejoins by itself); everything back online; the admin
  password changed. A new password works only if every device is joined
  again by hand, and the check says the devices had to be touched. The
  house's devices keep their leases, as real ones do.
- **J7 A fixed address for the office PC.** Lines: fixed and never handed
  out (set by hand outside the range, or reserved and restarted); still
  online, names and all (a fixed address with no DNS is the classic
  mistake: the check says names don't look up, and ping by name fails on
  the PC itself); the laptop reaches it; nothing broken.
- **J8 The old laptop in the kitchen.** An old 2.4 GHz-only, WPA2 laptop;
  the router's 2.4 GHz on Auto, which picks the channel quiet at the
  router. The kitchen hears that channel loud (the house decides which of
  1, 6 and 11 is clear where). Lines: online; 50 Mb/s or more on the old
  laptop in the kitchen; nothing broken. The way through is a survey on
  the laptop (`netsh wlan show networks mode=bssid`) and the channel set
  by hand.
- **J9 WPA3, with one old laptop.** Every Wi-Fi device on the strongest
  security it can use: WPA3 only cuts the old laptop off, WPA2 holds the
  phone back, transition mode does both.
- **J10 Moving day.** The TV to the back bedroom, wired; the printer to the
  kitchen, wired, on its same fixed address, the office PC still printing
  to it. Cables come out before devices move.
- Each job lists the lines already met before any work (`already`: the job
  is not to break them); the tests and the drive check exactly those. A
  failing line always has two causes or more, so Mason's third rung can
  narrow (J9's line was given its second, and free build's empty house its
  router-in-its-box neighbour, when the tests caught them).

**PoE injectors matched to the photo (11 October 2026).** The owner sent a
photograph of two injectors side by side ("Remember to match the details";
a sharper copy followed). Both rebuilt part by part (`home-gear.js`), and
both are on the preview page (`preview/models.html`: the pair as
photographed, then each one):
- **Single-port PoE injector** (`poeInjector`, the tickets' injector and
  build mode's 802.3af one): black, rounded edges, an inset front panel;
  SINGLE-PORT GIGABIT PoE INJECTOR and MODEL top left; POWER (blue) and
  STATUS (green) square light pipes on the model's line; DATA IN and
  DATA + POWER OUT in silver jacks with no lights; the flow line with the
  power bolt between them; "PoE Power Output" along the bottom; ribbed
  grooves down both edges of the lid with the print between them; the
  power cord into the **left side**, low at the front, its moulded plug and
  ribbed strain relief. Lights: POWER blue while its adapter is in, STATUS
  green while it powers the device on its output.
- **Dual-port PoE+ injector** (`poeInjectorDual`, build mode's `injector2`,
  `dual: true`): the rugged shell, chamfered at every corner, a bumper rim
  round the front panel and the lid with grey triangles on the lid's
  corners; two DATA IN jacks with no lights, DATA + POWER OUT over two
  jacks with green corner lights, Active PoE+ top right; the power budget
  along the bottom; the cord into the **right side** with its flared
  moulding. Active PoE+ is lit while its adapter is in; each output's
  corner lights while that output powers a device.
- What differs from the photo, as told to the owner: the standards' own
  figures are printed (802.3af: DC 48V ⎓ 0.32A, 15.4 W; 802.3at: DC 54V ⎓
  0.56A, 30 W a port, a 60 W budget for two), not the photo's 50V 1A and
  54V 2.2A/1.1A; the single's model number follows (POE-GI-48V); the logo
  badge on the PoE+ lid is left off (brand marks stay off); the photo's
  arrows under the PoE+ jacks became each jack's pair number with an
  arrow, so a student can read which input goes with which output.
- **The second pair is real in the simulation** ("what students see on the
  model is what they can actually use"): `injector2` has four ports
  (`DUAL_PORTS`: DATA IN, DATA IN 2, PoE OUT, PoE OUT 2; the sim's names are
  unchanged so saved progress replays). `POE_PAIR` pairs them; an output
  carries on only its own input's link (`cableUp`), power comes from either
  output (`poeSource`), and the second pair is its own node (`nodeOf`
  `injector2:2`) so the two pairs are never bridged. Every list a student
  reads uses the names printed on the injector (`portName`): DATA +
  POWER OUT for the single's output; DATA IN 1, DATA IN 2, DATA + POWER
  OUT 1 and 2 on the dual. J3's cause for a missing input names the input
  of the same pair; its limits say "single-port" and "dual-port (30 W out
  per port)".
- The 3D views are now Ports close-up, Lights (on the front, as
  photographed), Label on top and Power cord.
- Checks added, each shown to fail on a plant: the dual drawn as the single,
  its output lights ignoring the sim, Active PoE+ dark, a jack named
  differently on the model and in the sim, the pairs bridged, any cable
  passing through, power only from the first output, the single's POWER
  drawn green (the viewer repaints it from the sim, so only both wrong
  draws green: planted both, and caught); the drive lays the camera across
  the pairs on the page: the check says it has power but no link, and the
  runs table shows the run with No link. (The drive's first version read
  only the job's diagnosis, which comes from the work order's causes, and
  missed the "any cable passes through" plant; the runs table reads the
  network itself and catches it.)

## Level 2, the small office: agreed 11 October 2026, preview first

Proposed to the owner after the injectors went live, with the objectives doc
re-read the same day (Network+ V9 unchanged). The owner: **"Yes to the
scope."** On subnetting by hand on the IPAM sheet: **"I really like this."**
**"Yes to all of what you propose. that is what I am looking for."**

- **Scope:** one managed switch in a small closet rack. The command line
  first: the console cable, the modes, `?` and Tab, the hostname and
  passwords, a management address on VLAN 1 with a default gateway, SSH only
  (no Telnet), port speed, duplex and descriptions, unused ports shut,
  saving; then SSH to it from the office PC. Subnetting by hand on the IPAM
  sheet (the network catches overlaps, wrong masks and gateways outside the
  subnet; it never computes the answer). VLANs wait for the small business.
  Five work orders and ten tickets (five common, five harder), plus the
  standing five extra of each; the base is the Network-Sims Switch CLI Output
  Analysis, Switch Port Configuration and VLSM-CIDR sims.
- **Levels lock** (owner): **"I want the student to finish each level before
  moving on and when they finish the objectives that they are suppose to be
  learning, the next level unlocks for them. This is self pace and guided
  learning lab."** And: **"Yes, instructor pin unlocks everything."** A level
  is finished when every one of its tickets and work orders is done (each
  objective lists the work that teaches it); free build doesn't count.
- **Photographs received** (11 October 2026): the managed switch, 24 ports
  and 4 SFP, front and rear (model MSW-2800G); a 6U wall rack with a 24-port
  Cat6 patch panel, its own "6U Wall Rack" panel and a shelf with an 8-port
  gigabit switch; the console cable (RJ45 to DB-9) with a USB-C serial
  adapter, a USB-A one and a laptop.
- **3D models** (`assets/models/office-gear.js`, on `preview/models.html`
  under "Small office (level 2)", not yet in any live page):
  `managedSwitch` (ports `port:1` to `port:24`, `port:SFP1` to `SFP4`,
  `port:CONSOLE`, `port:MGMT`, `port:USB CONSOLE`, `port:AC IN`; lights by
  role: SYSTEM, POWER, PSU, FAN and their FAULT lights, the key), `sfpCage`,
  `sfpModule` (with its LC duplex cord), `patchPanel24` (`port:P1` to `P24`),
  `desktopSwitch8`, `wallRack6U` (as photographed; `{ managed: true }` for
  the office's version with the managed switch under the patch panel),
  `db9Plug`, `usbCPlug`, `usbAPlug`, `consoleKit`. The laptop takes an
  optional `title` for its screen's window (a serial terminal in the console
  scene; the default is unchanged). Differences from the photos, told to
  the owner on the comparison sheet: 12 port columns numbered odd on top,
  even below (the photo shows 15 with repeats); "(FRONT)"/"(REAR)" captions
  left off; MGMT under CONSOLE (the photo has a USB symbol); AC INPUT
  100-240V~ (the photo's ⎓ is DC); the unlabelled light cluster drawn as
  power and fan lights with amber fault lights; a fourth, empty SFP slot;
  the console photo's brand, logo and captions left off (a console runs at
  9600 baud by default, not the caption's 115200); the console cable's DB-9
  female, joined to the adapter's male.
- **The switch's command line** (`js/net/swcli.js`, pure, node-tested in
  `tests/office.test.js`): user and privileged EXEC, global, interface,
  interface-range and line configuration; `?` help (after a space: what
  comes next; after letters: the words starting with them; `do` gets EXEC's
  help); Tab completion; any unique abbreviation; "% Ambiguous command",
  "% Incomplete command.", "% Invalid input detected at '^' marker." with the
  caret under the bad word; `| include/exclude/begin/section`. Running vs
  startup configuration: only `copy running-config startup-config` or
  `write memory` survives `reload` (which asks to save unsaved changes);
  enable secret (stored as a hash, never shown in plain text), enable
  password, console and vty passwords with `login` / `login local`,
  `username ... secret`, `ip domain-name`, `crypto key generate rsa` (needs a
  hostname other than Switch and a domain), `transport input ssh`, VLAN 1's
  address (refused on a physical port, with the reason), `ip default-gateway`,
  speed/duplex/description/shutdown; a forced speed the far end doesn't
  match drops the link; show running-config, startup-config, version,
  ip interface brief, interfaces (status, one port with counters), mac
  address-table. Our own unbranded switch: no brand word anywhere (a test
  walks every help list and output).
- **The IPAM checker** (`js/net/ipam.js`): per row (network, mask or prefix,
  first and last usable, broadcast, gateway) it catches a mask too small for
  the hosts, a network that isn't where its block begins, a block outside
  the office's, overlaps (on both rows), wrong first/last/broadcast, a
  gateway outside the block or on its network or broadcast address; a note
  when a smaller block would do (VLSM). A test proves no message ever
  contains a right value.
- **The preview page** (`preview/small-office.html`, not linked): the
  site's bars and three columns; the levels with the lock (see it as a
  student who finished Home, one still on Home, or the instructor); what the
  level teaches, objective by objective from the doc; the work orders and
  tickets planned (each ticket's planned fault shown in the preview only);
  work order SO-J1 with a live check that reads the switch you configured
  (marked three ways); the rack diagram and the logical diagram; the IPAM
  sheet as cards, with a plan full of mistakes to show what it catches; the
  live console on the right. AAA on painted pixels across its states,
  scrolled positions too; the checker caught the switch's label spilling out
  of its dark box with easier reading on (fixed), and SVG text painted with
  a fill attribute it couldn't hide (now `fill: currentColor`, as on the
  site's own diagrams). `tools/aaa.mjs` skips its hover step on a page
  without the view buttons (the model previews).
- **The PIN stays as the owner set it** (owner, 12 October 2026). It is kept in the owner's private notes, not here: the owner, 17
  November 2026, "remove the pin for now". The drive reads it from `E4_PIN`.
  The preview's instructor view now asks for it, checked as the live
  Instructor menu checks it (only the hash 4061435687 is in the code; the
  unlock lasts for the browser tab under the same sessionStorage key, so
  unlocking in either place counts in both; a Lock button closes it). A
  drive of it (wrong PIN refused, the PIN opening every level, Lock, asked
  again after locking, the PIN nowhere in the page's code) was shown to fail
  on a planted wrong hash.
- **Next:** the owner's go-ahead on the preview, then the build. Given 12 October
  2026: **"Keep building"**.

### Level 2, stage 1: live 17 October 2026

Built on the branch `save/level2-stage1` (the owner asked for a save point on
12 October 2026), finished and merged 17 October 2026. **Stage 1 of 5**: the
level lock on the live site and the instructor's "open every level"; Level 2
visible, locked until Home is finished; work orders SO-J1 and SO-J2; the
managed switch and the old 8-port switch live in the Physical tab.

**Stage by stage** (the owner, 17 October 2026, asked whether Level 2 should
go live a stage at a time or all at once: **"Stage by stage"**). Each stage
goes live once it's verified. A level still being built carries `planned` in
`js/desk/levels.js` (the small office: 25, that is 10 work orders and 15
tickets); it can't count as finished until all of them exist, so Level 3
can't open early. The queues say "More work orders and tickets are on the
way"; with everything built so far done, the done box says "That's
everything on the small office so far", and Level 3's lock panel says the
small office is still being built. Set `planned` to the real total, or drop
it, when the last stage lands. (Dropped for the small office on 19 October
2026, with SO-J10.)

**What stage 1 added:**
- `js/net/office.js`: the office template (six businesses, the closet, front
  desk, open-plan office, manager's office, meeting room; the old 8-port switch
  running the office; the managed switch in its box; your laptop with its
  console cable; the plan: hostname, management address, gateway, domain,
  secret, console password, SSH user).
- The simulation: the managed switch (`mswitch`, its command line from
  `swcli.js`), the console cable (USB-C to CONSOLE, same room, 1.8 m, serial,
  not part of the network), the serial terminal on your laptop, `ssh` and
  `telnet` from Windows' Command Prompt (refused without keys; **512-bit keys:
  "Protocol major versions differ: 2 vs. 1"**, the switch offers only SSH 1),
  a power cut keeping only what was saved.
- `js/build/office.js`: SO-J1 (rack it, console, name, secret, console
  password, save, the office untouched) and SO-J2 (move the office onto the
  new switch, VLAN 1 address, default gateway, SSH only with a local user,
  saved). Undo takes back a line typed to a switch (`cli: true` actions).
- `js/desk/levels.js` (the five levels, progress read from both pages' saves,
  `isOpen`: level 1 always, others when the one before is finished, or the
  instructor's tab unlock `e4-instructor`, or "every level on this computer"
  `e4-levels-open`), `js/desk/levelsui.js` (the levels list and the lock panel:
  locked marked three ways, the lock and its words, the dashed edge, the grey
  ground). Both pages show the levels in the left column; build mode lists the
  chosen level's work orders (locked ones can't open; `build.html#job=ID`
  opens one, if its level is open); the Ticket Desk links Level 2's work
  orders into Build. The instructor dialog has a Levels section (open every
  level on this computer / lock them again); locking the tools relocks.
- The terminal (`js/desk/window.js`): the prompt follows the mode, a password
  asked for is hidden and never echoed, `?` answers at once, Tab completes,
  every line (an empty one too) goes to a switch; the serial terminal's intro
  (COM3, 9600 8N1). The managed switch's Lights tab shows SYSTEM and POWER and
  its ports green at any speed.
- Drawings (`js/desk/draw.js`): the office floor plan and logical layout, a
  managed-switch icon, the console cable as its own kind of link (blue, solid).
- 3D (`js/desk/model3d.js`): `msw` (the managed switch with its plugged ports
  and console cable; views Front close-up, Console port, Rear) and `switch8`
  (the old 8-port, now with `cords: true` patch cables so a pulled plug hangs).
- Checks: `npm test` 163 of 163 (10 office-job tests); `ONLY=office node
  tools/drive.mjs` 152 checks pass (levels as a fresh student, Home finished,
  the instructor; SO-J1 and SO-J2 done entirely through the page on three
  offices each). Plants: `tools/plants-office-page.py` (11 page defects, all
  caught) and `tools/plants-office-node.py` (Node defects, all caught except
  one that no interface path can reach: the console working with the switch
  off, since a placed switch is never left off; the guard is defensive).

- Finishing checks, 17 October 2026: AAA on painted pixels across the 14
  Level 2 states (now in `tools/aaa-states.json`; `ONLY=office,levels node
  tools/aaa.mjs tools/aaa-states.json` runs just them) and two scrolled
  ones; the checker caught the logical diagram printing the managed
  switch's labels over your laptop's (the console cable ran straight between
  them): the laptop now sits below and right of the switch. A lightened lock
  panel was planted and caught. `ONLY=office node tools/models.mjs`: the
  managed switch's console plug, lights and port plugs drawn as the sim
  says, and the old switch emptied after the move; it caught the old
  switch's POWER light sitting 0.6 mm from port 1's (a dark port 1 read as
  lit; moved). `tools/plants-office-models.py`: 5 plants, all caught.
  `tests/levels.test.js` proves a level still being built is never
  finished (shown to fail on the old rule). The lock panel now says when
  the level before is still being built. Totals at merge: `npm test` 166
  of 166; `ONLY=office node tools/drive.mjs` 157 checks; `node
  tools/models.mjs` 94 checks; `tools/plants-office-page.py` 13 plants
  (two new: a level finished before it's all built, the done box silent
  about more coming), all caught. The drive clicks the real Check button
  (`#doCheck`): the page hook's `check()` re-checks without counting the
  job done.

### Level 2, SO-J3 (stage 2, first work order): live 17 October 2026

Each verified work order goes live on its own (rule 1), so Level 2 grows a
work order at a time inside the stages.
- **The office printer** is an older model: its network card is fixed at
  100 Mb/s, full duplex, and can't negotiate (`cfg.speed`/`cfg.duplex` in
  `js/net/office.js`). A switch port left on auto senses its speed but not
  its duplex and falls back to half: a **duplex mismatch**. The link stays
  up; `show interfaces` on that port says Half-duplex, and the late
  collisions (and collisions, output errors) climb every time you look,
  on the simulation's clock (`duplexEnds` and the mismatch counters in
  `swcli.js`; the half-duplex end counts late collisions, the full end CRC
  errors and runts). Since SO-J2's move the printer's port shows it: SO-J3's
  client says printing crawls. SO-01 (printing slow) builds on the same.
- **SO-J3, The ports:** every port in use described as the office's records
  say (`plan.desc`: UPLINK-ROUTER, FRONT-DESK-PC, OFFICE-PRINTER; checked by
  the device cabled there, so the description must match what's really on
  the port; case doesn't matter); the printer's port set by hand to 100,
  full (causes: no link, left on auto, forced half, duplex set but speed
  still auto); every unused port and fibre slot shut down, every port in use
  on (causes: a port in use shut, copper ports live, fibre slots live);
  saved; everything still works. It starts from SO-J2's work done.
- **A check never changes the network:** `sim.switchLinks(id)` works the
  links out without storing them; the printer check reads that. (A first
  version called `syncSwitch` from the check, which stamped the clock into
  the saved links and broke the exact-replay test; caught by it.)
- Checks: `npm test` 168 of 168 (SO-J3's tempting wrong ways, and the late
  collisions climbing then stopping at 0 once the port matches); the office
  drive 199 checks (SO-J3 typed through the page on three offices: show
  interfaces twice, the fix, show interfaces status, saved); AAA on three
  new states (the brief and the climbing counters, the check with Mason's
  third rung, done) and the stage-by-stage states now follow whichever work
  order is last; page plants 16 (new: late collisions that never climb, a
  mismatch with no errors, interface range stopping at the copper ports);
  Node plants 13 (new: a port left on auto accepted, the fibre slots left
  live accepted), all caught but the known unreachable one.

### Level 2, SO-J4: live 17 October 2026

- **The address plan** (`plan.ipam` in `js/net/office.js`): the office's /24
  and four groups (Staff, Guests, Printers and servers, Network gear) with
  head counts from their own random stream (`ipamPlan`, seed ^ 0x1ba3), so
  every other part of the office is drawn exactly as before.
- **The IPAM sheet in build mode** (`ipamSheet` in `js/build/app.js`, shown
  when a job has `ipam: true`): a card per group (network, mask or /prefix,
  first and last usable, broadcast, gateway), typed by hand. Saving is an
  action (`{ t: "ipam", rows }`, in the engine's `STATE` list, so Undo takes
  it back and a saved job replays it; the replay test caught it missing).
  What the checker (`js/net/ipam.js`) finds is shown for the saved sheet:
  each row marked three ways (edge colour, inset rule, the words), each
  wrong field flagged, the reason given, never the right value.
- **SO-J4, Subnet the office:** every group's block written (causes: empty,
  a blank row, an unreadable network or mask); big enough and no bigger
  (VLSM); on its own boundary, inside the range, no overlaps; first usable,
  last usable and broadcast right; the gateway the first usable, the
  office's convention (blank, unusable, usable but not the first). Nothing
  on the network changes; the plan is for the small business's VLANs. Any
  plan the checker accepts passes (the tests try smallest-first with dotted
  masks). The instructor's "one way" shows a worked plan.
- Checks: `npm test` 169 (SO-J4's tempting wrong ways; the Undo test logs
  in first when a job did no switch work); the office drive 235 (the sheet
  filled through the page: a block too small marked and explained, never
  the right mask, Undo, then a plan that fits); AAA on three states (empty,
  mistakes with Mason's third rung, done); page plants 19 (new: a row never
  marked, saving not undoable, the sheet naming the right mask) and Node
  plants 16 (new: a block too big, overlaps, a gateway not the first
  usable, each accepted), all caught but the known unreachable one.

### Level 2, SO-J5: live 17 October 2026

- **The switch** (`js/net/swcli.js`):
  - `banner motd`: the first character after `motd` is the delimiter and the
    message runs to the next one. On one line it ends there; if the line ends
    first, the message carries on over the following lines ("Enter TEXT
    message. End with the character 'X'.", no prompt meanwhile). A delimiter
    that turns up in the wording cuts the banner short, as on the real thing.
    `show running-config` prints it as `banner motd ^C...^C`. It shows as the
    console wakes (before "User Access Verification"), before a Telnet
    password, and after an SSH login. `banner` is in `CONFIG_KEYS`, so it is
    saved and reloaded like the rest.
  - `copy running-config tftp:` and `copy startup-config tftp:`: "Address or
    name of remote host []?", then "Destination filename [<hostname in lower
    case>-confg]?", then `!!` and the bytes copied, or `.....` and "%Error
    opening tftp://host/file (Timed out)". `tftp://host/file` on the line
    fills both defaults. With nothing saved: "%Error opening
    nvram:/startup-config (No such file or directory)". The file is the
    configuration from its first `!` to `end` (`configText`). The session's
    `tftp` callback, given by `cmd.js`, does the sending.
- **Your laptop** (`js/net/office.js`, `cmd.js`, `pages.js`, `window.js`):
  - Its own Ethernet port (`ETH`, the ETHERNET on its model). It asks for an
    address by DHCP when plugged in; its hardware address comes from its own
    random stream (seed ^ 0x7ec4), so every office is drawn as before.
  - Tabs: Serial terminal, **Command Prompt** (Windows', with `dir`; its own
    logins, kept under `tech/win`, so an SSH session there is separate from
    the console), **TFTP server** (start or stop it; what it listens on; the
    files received, each with Read; the server log), and **Physical**.
  - The TFTP server (`tech.tftp`; `{ t: "tftp", on }` is in the engine's
    `STATE`) takes a file only while running, from a switch that can reach it.
    A file of the same name is replaced. Windows' firewall still drops ping to
    the laptop, as on any Windows computer.
  - The 3D model (`techLaptop` in `office-gear.js`): the photographed laptop
    with its Ethernet cable when it's cabled, the serial adapter's USB-C plug
    and grey cord while the console cable is in. On screen: the TFTP server
    while it runs, otherwise the serial terminal or Command Prompt.
- **An opened port brings DHCP** (`cmd.js` `exec`): links are worked out
  again after every command, so a device cabled to a port brought up by
  `no shutdown` gets its link and asks for an address. Before this, the
  laptop on a port opened after it was cabled got no address at all.
- **Two cables between the same two devices** (your laptop's console and
  Ethernet to the switch) are drawn side by side on the logical diagram. The
  first stays where it always ran; the second fans out from the busier
  device, with its port label further along, clear of the other labels.
- **SO-J5, a warning banner, a backup and a baseline:**
  - The banner is the records' wording (`plan.banner`). Causes: none; only
    part of it (the delimiter in the wording); other words. Case and spacing
    don't matter, so several lines are fine.
  - Saved.
  - A backup under the switch's own name, and the baseline under the records'
    name (`plan.baseline`). Both must hold what's saved. Causes, in order:
    - the server isn't running, and the laptop isn't on the network (these
      two count only while nothing has landed at all);
    - no copy, or a copy under another name;
    - a copy of the running configuration taken with changes not saved;
    - a copy older than the last save.
  - Your laptop unplugged, every spare port shut again, every port in use on.
  - Everything still works.
  - **The trap, on purpose:** opening a spare port and saving it, copying,
    then shutting it and saving again leaves a stale backup. The way through
    is to copy the startup configuration while the opened port isn't saved,
    or to plug the laptop into a spare router port. Mason's opening line:
    "Know which configuration you're copying before you copy it."
  - The instructor's "one way" uses the address the laptop will be given
    (`v.lapIp`, from the router's `offer`, which changes nothing).
- **Checks:**
  - `npm test`: 171, with two new SO-J5 tests. They cover the tempting wrong
    ways, two other right ways (the router's port; a running copy once all
    is saved), the prompts, the two terminals, and the TFTP tab matching the
    model.
  - The office drive: 295 checks. SO-J5 is done through the page on three
    offices, with a copy of the running configuration caught on the way.
  - AAA: six SO-J5 states, all passing.
  - `ONLY=office node tools/models.mjs`: 42 checks.
  - Plants, all caught: page 8 new; Node 8 new (with the known unreachable
    one still missed); models 3 new.
  - The plant scripts now run in whichever checkout they're in.
- **A blind spot in `tools/aaa.mjs`:** it skips text clipped by a scrolling
  ancestor, but not text clipped by its own element. So a `pre` that scrolls
  itself, or a screen-reader-only span, is measured where it isn't painted.
  Keep scrolling text inside a scrolling box, as the terminals and the TFTP
  reader do. The checker isn't changed yet.

### Level 2, tickets SO-01 to 05: live 18 October 2026

Objectives doc re-read 18 October 2026 (Network+ V9 unchanged) and the
mapping shown to the owner before building: SO-01 and SO-02 under
"Cabling and physical interface issues" (increasing counters, port
status), SO-03 under "Configuration management" (production, backup,
baseline configurations), SO-04 under the same troubleshooting item (TX/RX
transposed), SO-05 under "Access and management" (SSH, console). The owner:
"looks great." These are the tickets planned on the small-office preview.
- **`js/tickets/office.js`.** Each ticket starts from the office as SO-J1 to
  SO-J5 left it (`settled`: the managed switch named, locked, on the
  office's address with SSH only, its ports described, the spares shut, the
  banner, all saved). The fault is planted as it really got there: lines
  typed at the switch's console (`onSwitch`) or a power cut. The board, the
  ladder, the notebook and the proof are the home tickets' engine.
  - **Saved, or it isn't fixed.** A fix that works but only lives in the
    running configuration is proven by the student's own test, isn't the
    fix, and Mason says so (`partial`). SO-02 also counts the whole range
    reopened as not fixed ("spare ports are live again"); SO-05 counts
    Telnet left on.
  - **SO-01, printing slow and sometimes failing.** The printer's port back
    on auto, or forced to half; the printer is fixed at 100 full. Fix: 100,
    full, by hand, saved.
  - **SO-02, one desk has no network.** The front desk PC's port shut, from
    an insurer's list typed in wrong. Fix: that port alone, saved.
  - **SO-03, Friday's changes gone.** Friday's change (a login for the new
    office manager, or the switch's new management address from the address
    plan) made and never saved; Sunday's power cut. The ticket gives
    Friday's notes. `show version` says it came back by power-on, up 1 day 9
    hours. Fix: the change again, saved.
  - **SO-05, can't SSH.** Three variants: a replacement switch loaded from
    the backup (keys don't travel in a configuration file), the vty lines on
    Telnet only, or the vty lines on a line password instead of login local.
    Refused and denied are the evidence that tells them apart.
  - **SO-04, the back office's new switch won't link (TX/RX transposed).**
    The office has turned its meeting room into a back office: an old 10/100
    switch (`meet`, the 5-port housing printed UNMANAGED 5-PORT FAST
    ETHERNET SWITCH, "10/100 Mbps · MDI-X ports (no auto-MDIX)") with a desk
    on it (`mpc`), on a 26 m straight-through run to the closet switch's
    gi0/5. Auto-MDIX is off on gi0/5: one port's "lock-down", or a
    contractor's template run on ports 1 to 24. Both ends are MDI-X, so each
    transmits on the other's transmit pair: no link, notconnect, the desk on
    169.254. Evidence: the tester passes every pin and says straight-through;
    show running-config shows `no mdix auto`; the old switch's lights and
    label. Two fixes count: `mdix auto` on the port (saved), or a crossover
    cable from the van (the Physical tab). Then the desk asks for its address
    again (`ipconfig /renew`; a ticket keeps its moment frozen, so nothing
    asks for it). The drive does one fix on each variant.
- **What the simulation gained:**
  - A duplex mismatch costs the device packets (`sim.mismatched`, `hop`):
    pings lose about a third; test pages crawl and every third one fails.
    This is SO-J3's brief made real.
  - The printer's control panel says its card is fixed at 100 Mb/s full.
  - `show version` says what brought the switch back (`sw.restart`: power-on
    or reload); a ticket can set how long it has been up (`uptimeFixed`).
  - Switch commands report what they printed and which computer typed them
    (`facts.out`, `facts.dev`), so the notebook can read them. SSH reports
    each denied login.
  - The ticket engine takes the TFTP server action.
  - **Cable wiring and auto-MDIX** (`sim.pairsMeet`, used by `cableUp` and the
    switch's own view of its links): a cable is straight-through, or
    crossover (`wiring`). A link comes up if either end swaps its pairs by
    itself (auto-MDIX: every device unless `mdix: false`, a managed switch's
    port unless `no mdix auto`), or if the cable crosses the pairs exactly
    where both ends are the same kind (switch to switch). The managed
    switch's ports take `mdix auto` / `no mdix auto`, on from the box, shown
    in `show running-config`. An old 10/100 device caps its links at 100
    (`maxMbps`). The office's Physical tabs offer "Swap in a crossover
    cable" (`{ t: "crossover" }`); "Swap in a new cable" is straight-through.
    The tester says how a cable is wired.
- **The desk:** each level's tickets in the queue ("Tier 2 · Small office ·
  tickets"), on the shelves (Small office, locked until Home is done) and on
  the map (the small office's site lists them once the level is open). The
  title and the ticket card say which level and "office network". The
  managed switch and your laptop have device buttons. A ticket on a locked
  level doesn't open: the desk falls back to HOME-01.
- **Checks:**
  - `npm test`: 200. `tests/office-tickets.test.js` runs each ticket on 150
    offices: the fault in real output (half duplex and climbing late
    collisions, Media disconnected and a disabled port, power-on, refused or
    denied), six options, the real fix and its proof, the tempting wrong
    fixes, unsaved and Mason's word, a self-ping proving nothing, the
    ladder, exact replay, and no hint naming a password or the fix's command.
  - `ONLY=tickets-office node tools/drive.mjs`: 316 checks. Every variant
    through the desk; a fresh student can't open them; the queue, card and
    title.
  - AAA on four desk states, all passing.
  - Node plants: 6 new, all caught (`tools/plants-office-node.py`, which now
    takes names).
  - Page plants: 8 in `tools/plants-office-tickets-page.py`, run in a
    throwaway worktree (`git worktree add --detach`) so the real one is never
    left holding a planted defect.
  - A ticket missing from the queue is now a named failure in the drive,
    not a crash.

### Level 2, tickets SO-06, SO-07 and SO-09: live 18 October 2026

The order agreed with the owner: SO-04 live, then SO-06, 07 and 09, then SO-08
and SO-10 with the rack and patch panel in the Physical tab.
- **SO-06, the switch answers nothing from the office PC** (the preview's
  title). The preview said "its management mask or gateway wrong". It's built
  as the mask or the address wrong, because a wrong gateway can't stop the PC
  reaching the switch on its own network. That's one of the near misses, with
  its reason.
  - **Mask variant** (only when the switch's host number is 5 or more): /28 or
    /30, chosen so the PC and the gateway are both off the switch's network.
    The switch answers the ARP (`arp -a` has its hardware address), but its
    reply goes nowhere: Request timed out.
  - **Address variant:** a digit slipped in the third octet (40 becomes 4, 12
    becomes 21), so the switch is on another network: Destination host
    unreachable.
  - The brief gives the office's records. Fix: VLAN 1 back to the records,
    saved. A mask that happens to work but isn't the records' isn't the fix,
    and Mason says so.
- **SO-07, the spare PC on the front desk won't connect.** The preview's title
  was "A desk links, then nothing"; it's renamed because there's no link at
  all.
  - The front desk's port was fixed at 1000 a year ago, for the PC it had then.
    The spare from the storeroom has a 10/100 card: `maxMbps` 100, "Fast
    Ethernet Adapter (10/100)" in `ipconfig /all`, and its Network settings say
    "a 10/100 Mbps adapter".
  - **New rule in the simulation:** a speed forced above what the far end (or
    the cable) can run gives no link. `cableUp` applies it, and so does the
    switch's own `linkFails`, so `show interfaces status` says notconnect.
  - Fix: `speed auto` (or 100 or 10), saved. Fixing the duplex as well, while
    the PC negotiates, is a mismatch, and Mason says so.
- **SO-09, two groups fighting over addresses** (two IPAM blocks overlap).
  - **The story:** ready for next year's VLANs, the office has started using
    SO-J4's sheet. The router now hands out only the Staff block (its
    gateway, the router, kept out), and each fixed device took the first
    address after its block's gateway, keeping the office's mask and gateway.
  - **The fault:** one block was written on top of another: Network gear over
    Printers and servers, or the other way round, starting at the same
    address. So the printer and the switch both got the same address.
    Checked, the sheet flags only the two blocks' overlap.
  - **What the student sees:**
    - test pages print every other time;
    - SSH from the front desk takes turns between asking for a password and
      Connection refused;
    - `arp -a` shows the two hardware addresses in turn;
    - the switch's console logs `%IP-4-DUPADDR: Duplicate address ... on
      Vlan1, sourced by xxxx.xxxx.xxxx` once a session.
  - **Fixed** when every row of the sheet checks out, the switch and the
    printer are each inside their own group's block (usable, not the block's
    gateway), on the office's mask and gateway, with no clash, the switch
    saved, and the PC printing to the printer's address.
    - Either block may be the one moved.
    - Any plan the sheet accepts passes.
    - Ending the clash while the sheet still overlaps isn't the fix, and Mason
      says so.
  - **The sheet on the Ticket Desk:** under the ticket, for a ticket with
    `ipam: true`. The form is now `js/desk/ipamui.js`, shared with build mode.
    - **Check the sheet** (`ipamcheck`) is evidence and changes nothing.
    - **Save the sheet** (`ipam`, in the engine's `STATE_CHANGING`) is
      replayed like the rest.
    - What's wrong shows only once the sheet has been checked or saved.
    - The sheet is redrawn only by its own buttons and a new ticket, so what's
      typed survives commands run meanwhile.
- **Two devices on one address** (`sim.turn`): tries take turns per computer
  and address, whatever is sent (test pages, SSH), and the ARP table holds
  whoever answered last.
  - Before this, printing alternated on the simulation's action counter, so a
    command typed between two prints kept the same device answering.
  - HOME-06 passes unchanged.
- **Checks:**
  - `npm test`: 229. `tests/office-tickets.test.js` covers each new ticket on
    150 offices. For SO-09 it adds: any plan the sheet accepts, with either
    block moved, fixes it; ending the clash while the sheet still overlaps
    doesn't.
  - The full drive: 2501 checks. SO-06 and SO-07 go through the desk on every
    variant: the office-ticket run is 523 checks, and SO-09 on its own is 84.
    For SO-09 that includes the sheet checked, then corrected and saved, and
    the switch or the printer moved.
  - AAA: 7 new states, 13,911 text runs, all passing. A pale colour planted on
    the desk's sheet was caught.
  - `node tools/models.mjs`: 108 checks.
  - Node plants: 15 new, all caught. One SO-09 plant (the sheet left
    overlapping, accepted) was missed at first. That showed a missing case,
    the clash ended by moving the other device, which is now a wrong fix in
    the tests.
  - Page plants: 4 new, all caught by named checks. The drive now names a
    ticket that isn't built instead of crashing on it.

### Level 2, ticket SO-08: live 18 October 2026

- **SO-08, "The cable map says port 7; the cable isn't in port 7"** (the
  preview's title, word for word: the map always claims port 7, and the
  manager's real port changes from office to office).
  - **The office:** last week's new cabling runs every desk's wall jack back
    to a 24-port patch panel in the closet rack. Each run is punched down
    behind a port, and a short blue cord joins that port's front to the
    switch. The front desk and the printer are re-cabled through the panel
    onto the switch ports they had.
    - The installer took the old 8-port switch away: the panel stands where
      it was.
    - The manager's new PC is in the manager's office (`mgr`).
    - The meeting room has an empty wall jack (`mjack`).
  - **The fault:** the installer's cable map has the manager's run and the
    meeting room's the wrong way round, and he patched from the map. Port 7
    goes to the meeting room's empty jack, so gi0/4 (MANAGER-PC, opened and
    saved for it) is notconnect, and the manager's PC has no link.
  - **The way through:**
    - put the tone generator on the manager's cable at the desk;
    - run the probe along the back of the panel, which sounds at the real
      port;
    - move the cord ("Move this cord to port ...");
    - put the cable map right.
  - **Fixed** when the manager's PC is online, the map names the right room
    for every port with a run (and nothing for a port without one), and the
    front desk and the printer still work.
    - The cord moved but the map left wrong isn't the fix, and Mason says so.
    - So is the front desk's cord moved onto the manager's run.
- **The patch panel in the simulation** (`kind: "patchpanel"`, `PANEL_PORTS`):
  ports "1" to "24" at the front and "1R" to "24R" punched down at the back.
  - `viaPanel(c)` turns a cable into either side into one path, from the
    device at one end to the device at the other. The lengths are added, the
    worse condition wins, and it's a crossover only if just one of the two
    crosses. It's null with nothing on the other side, or a plug out at the
    panel.
  - `cableUp`, `speed`, `switchLinks` and `mismatched` all go through it.
    `nodeOf` keeps each port its own node.
  - A wall jack (`kind: "jack"`) has a run behind it and nothing plugged in,
    so it carries no link. Both `cableUp` and the switch's own view say so.
  - New actions:
    - `tone` (the tone generator on a run, kept in `net.extra.tone`);
    - `probe` (it sounds at the back of the port the toned run lands on);
    - `repatch` (a cord moved to a free front port; an occupied one is
      refused);
    - `cablemap` (the office's map as records).
- **On the page:**
  - The cable map sits under the ticket (`js/desk/cablemapui.js`), a room
    for each panel port.
  - The panel's Physical tab:
    - its cords, with "Move this cord to port ...";
    - its runs at the back, unlabelled ("Look at the punch-down", the
      tester);
    - "Run the probe along the back of the panel".
  - A desk's cable whose run goes to the panel, and the wall jack, take
    "Put the tone generator on it".
  - The logical diagram leaves the panel out: a patched path is one link from
    the switch to the device.
  - The floor plan shows the panel in the closet and its runs out to the
    rooms. The cords stay inside the rack: drawn, they put a red diamond on
    the switch's label.
- **3D:** the patch panel's Physical tab is the photographed 6U wall rack.
  - `wallRack6U({ managed: true })` now takes `patches`, `tabs` and
    `swLights`. With none of them it draws exactly as previewed.
  - The tabs carry what the installer wrote from his map.
  - Views: Patch panel close-up, Ports 1 to 12, Panel and switch, Switch
    ports close-up.
  - The bottom-row ports' lights are sampled from below, the top row's from
    above: the cords hang in front of the others.
  - The wall jack is the photographed data/voice plate, empty.
- **Checks:**
  - `npm test`: 236. SO-08 is tested on 150 offices: the fault in what a
    student sees (ipconfig, show interfaces status, the switch's lights
    page, the tester, the probe with and without a tone, the panel's list
    naming no rooms), the real fix, the tempting wrong ones, the ladder and
    replay. A cord onto a port that has one is refused.
  - The full drive: 2582 checks. SO-08 alone is 81, through the page on every
    variant: tone, probe, the cord moved, the map saved.
  - AAA: 5 new states, 9,805 text runs, all passing.
  - `node tools/models.mjs`: 126 checks. The rack case (office 11, so the
    cords hang the same every run) checks the cords in exactly the patched
    ports and the switch's lights, then moves the cord through the page and
    checks again.
  - Plants, all caught:
    - Node: 8 new.
    - Ticket Desk page: 3 new.
    - Models: 2 new.
  - **Six older plants had drifted** off their code. Each is fixed and was
    shown to fail again:
    - SO-02's proof line, which has matched SO-07's too since SO-07 went
      live;
    - the back office switch's button and its model;
    - the IPAM sheet's move to `ipamui.js`;
    - the build engine's state list (since SO-J5).

    Before a plant run, check each anchor matches its file exactly once.

### Level 2, ticket SO-10: live 18 October 2026

- **SO-10, the fibre link to the back office is dark** (the preview's title).
  - **The office:** the back office (the meeting room) is on a second managed
    switch of the photographed model (`bsw`), joined to the closet switch's
    SFP1 (gi0/25, BACK-OFFICE-FIBRE, opened and saved) by an orange OM2
    multimode run. The installer chose fibre because the run passes the
    lift's motor room. The back office PC is on `bsw` port 1, on 169.254.
  - **Variants:**
    - the closet's module is a 1000BASE-LX (1310 nm, single-mode);
    - the back office's module is the LX;
    - the closet's slot holds an SFP+ 10GBASE-SR. Its light is right, but a
      1 Gb/s SFP slot can't run a 10 Gb/s module.
  - **What the student sees:**
    - `show interfaces status`: notconnect with the module's type, or
      err-disabled;
    - `show interfaces transceiver`: -5.6 dBm sent and -40.0 received (no
      light), or unsupported;
    - `show inventory`: the module's PID;
    - the console logs %PHY-4-UNSUPPORTED_TRANSCEIVER and %PM-4-ERR_DISABLE
      for the SFP+;
    - each end's module label and bail colour, read with "Look at the plug";
    - the back office switch's lights page (`bsw-lights`).
  - **Fix:** swap the wrong module for a 1000BASE-SX from the van, on the
    Physical tab, then renew the back office PC. These don't fix it:
    - swapping the LC pair (it breaks a good link too);
    - matching the other end to the LX (single-mode modules on multimode);
    - restarts.
  - It has no "works but isn't saved" state, so the tests' unsaved check is
    skipped for it (`UNSAVED` returns null).
- **SFP in the simulation** (`SFP_MODULES`, `swPort`): a managed switch's
  slots are "SFP1" to "SFP4", the switch's gi0/25 to gi0/28, holding modules
  in `x.sfp`. Each module has its wavelength, the fibre it's made for, its
  speed, its bail colour (black SX, blue LX) and its label.
  - A fibre cable (`kind: "fibre"`, `fiber`, `jacket`, `polarity`) links only
    when all of these hold (`fibreUp`):
    - both plugs are in;
    - both modules can run in their slots;
    - the two modules use the same wavelength;
    - each module suits the fibre;
    - the LC pair isn't flipped;
    - both switches are on and both ports open.
  - The switch's own view gives each slot with a module its type, PID,
    light, and unsupported state.
  - New actions: `sfp` (swap a module), `polarity` (swap the LC pair at one
    end).
- **On the page:**
  - The fibre cord takes "Look at the plug" and "Swap the LC pair over at
    this end".
  - Each switch with modules offers "Swap in a 1000BASE-SX/LX module".
  - Fibre is royal green on both drawings, solid when up and red dashes when
    down.
  - The lights pages are per device (`msw-lights`, `bsw-lights`): before
    this, every managed switch said `msw-lights`.
- **3D:** `managedSwitch` takes `sfpBail` and `sfpText`, so each module is
  drawn with its bail colour and its cord's jacket print. The slot lights
  follow the sim. The managed switch has a new view, "Fibre slots".
- **Checks:**
  - `npm test`: 243.
  - The full drive: 2678 checks. SO-10 alone is 96, every variant through
    the page: the commands, both ends' labels read, the LC pair swapped as a
    wrong fix, the module swapped.
  - AAA: 4 new states, 7,830 text runs. The SFP+ state was confirmed to open
    office 11 (states take `ticket` and `seed`; `c.go` restores the seeded
    office once the level is unlocked).
  - `node tools/models.mjs`: 134 checks. The SO-10 case (office 2025) checks
    the module in each slot, its bail colour (blue LX, black SX) and the
    slot's light, then swaps the module through the page and checks again.
  - Node plants: 8. Seven are caught.
    - The eighth, "any two modules link" (the wavelength check removed), is
      unreachable with these modules: an SX and an LX never both sit on
      fibre made for them, so the fibre check always decides first. It's
      kept as a defensive guard, for a multimode-capable LX one day.
    - A redundant err-disabled line in `status()` was removed (an
      unsupported module already fails the link), and its plant now aims at
      the err-disabled text, where it's caught.
  - Page plants: 3 new, all caught. Two renamed now that there are two back
    office switches.
  - Models plants: 2, caught.
  - The build page's "console drawn as patch cable" plant was put back on its
    line after the fibre run style joined it, and is caught.

### Level 2: the office's records on office tickets; tickets SO-11 to SO-15: live 18 October 2026

- **The office's records, on every office ticket** (found 18 October 2026,
  writing SO-12). The office tickets never told students the switch's
  passwords. Every office ticket from SO-01 to SO-10 starts at the console,
  which asks for the console password, and each office has its own. So no
  student could have logged in.
  - The page drive never saw it, because it read the passwords from inside
    the simulation: written and reachable are different claims.
  - Every office ticket's card now carries "The office's records": the
    switch, its management address, mask and gateway, the console password,
    the enable secret, and the SSH login (`officeRecords` in
    `js/desk/app.js`). A ticket can change a line where its story says the
    records changed (`records(v)`): SO-03's new address from Friday's notes,
    SO-09's address from the IPAM sheet.
  - The drive now reads the passwords off the page (`rec()`), and a plant
    hiding the records makes it fail.
- **SO-11 to SO-15, "five more on the same skills"** (the preview's line).
  - **SO-11, copying files to the front desk PC crawls.** The front desk's
    port is fixed at 1000 or 100, full duplex; the PC negotiates and falls
    back to half. The other way round from SO-01: the switch's end is the
    full-duplex one, so it counts CRC errors and runts.
    - Fix: speed and duplex back to automatic, saved.
    - Both ends at half (no errors, half duplex) isn't the fix, and Mason
      says so.
  - **SO-12, anyone with a console cable gets straight in.** An insurer's
    auditor found the console's login turned off, with its password still
    in the configuration, or cleared too.
    - Fix: the console password from the records, and `login`, saved.
    - Proof: log out and wake the console again; it asks.
  - **SO-13, SSH warns the switch's identity has changed.** The switch's
    RSA keys were made again (a contractor, or a warranty replacement). The
    front desk PC remembers the old key, and OpenSSH prints its real warning
    and stops.
    - Simulation: the switch's `keyGen`, saved with its keys; `hostKey(sw)`
      gives the SHA256 fingerprint; `show crypto key mypubkey rsa` shows
      it.
    - The PC's `knownHosts` exists only in SO-13's office, so every other
      ticket's SSH is unchanged.
    - `ssh-keygen -R <address>` removes a host's line (it's in Help).
    - The lesson: compare the warning's fingerprint with the switch's own
      before trusting it. "A man in the middle" is the near miss.
  - **SO-14, the printer moved desks and now the front desk is offline.**
    SO-08's patch panel with its map right this time. The printer's cord was
    moved across correctly; the front desk's was "tidied" into the printer's
    old port (its run now to an empty jack) or a spare port.
    - The map, the probe and the tone show it.
    - Fix: put the front desk's cord back in its port.
  - **SO-15, the fibre went dark after it was cleaned.** SO-10's fibre with
    the right modules, its LC pair put back crossed. The installer's light
    meter passed both strands, which rules out a break.
    - Fix: swap the LC pair at one end, then renew.
- The serial terminal's facts now say when the switch is asking for a
  password (`asked`): its "Password:" is the prompt, not output.
- **The diagram's port markers kept off device labels** (live 19 October 2026
  as its own push, before this one). With easier reading on, the red diamond
  on SO-04's and SO-10's dead links sat on the managed switch's label (2.95:1,
  caught by AAA). The logical diagram now draws its devices first, measures
  their labels in the font in use, and slides a marker along its line until
  it's clear. Switching easier reading, and the fonts arriving, redraw it.
- **Checks:**
  - `npm test`: 278.
  - The full drive: 3,115 checks. Every office ticket's passwords are read
    off the page; SO-11 to SO-15 go through the desk on every variant.
  - AAA: 5 new states (11,222 text runs). The full set, 141 states and
    286,053 text runs, was run with the port-marker fix: 140 pass. The one
    failure is the instructor's PIN dialog: the PIN box's focus ring overlaps
    the bottom of its label (1.71:1), live on `main` before today too. Fixed
    19 October 2026 as its own push after SO-J10: the gap between a form
    label's words and its box (`.devform label.f`) is 7 px, clear of the focus
    ring (3 px out, 2 px offset). Calibrated: 3 px fails, 7 px passes; the PIN
    dialog's state passes in the full run.
  - `node tools/models.mjs`: 134 checks.
  - Node plants: 9 new, all caught. Page plants: the office's records left
    off the ticket (105 failing checks) and SO-11 to SO-15 left off the desk,
    both caught.

### Level 2: work orders SO-J6 to SO-J10, the small office complete: live 19 October 2026

The five extra work orders, as the small-office preview named them ("a failed
switch rebuilt from its backup, a new hire's desk, the printer moved, the cable
map, a fibre link to the back office"). Each starts from the one before it done,
as SO-J1 to SO-J5 do. With them the small office has all its 10 work orders and
15 tickets, so `planned` is gone from `js/desk/levels.js`: finishing every
ticket and work order finishes Level 2, and the done box says the small
business is still being built.

- **SO-J6, a failed switch, rebuilt from its backup.** The switch died
  overnight; the replacement (the same model, `sw.unit` 2, so its SSH keys
  differ) is in its box, and the office manager pulled the old one's cables.
  The backup from SO-J5 is on your laptop.
  - Lines: the replacement racked with your laptop on its console; it runs the
    backup line for line (causes: still factory; in the startup configuration
    but never reloaded; a part not as the backup has it, named); the router and
    both desks on the ports the backup sets up for them; SSH from the front desk
    PC works again (no keys: a file never carries them; the PC remembers the old
    key); saved; your laptop unplugged and the spares shut; the office runs.
  - The front desk PC holds the old switch's key (`knownHosts`), so SSH prints
    OpenSSH's warning. The lesson: check the warning's fingerprint against
    `show crypto key mypubkey rsa`, then `ssh-keygen -R`.
  - Other right ways: copy into startup-config and reload (answer no when it
    asks to save, or the factory settings are saved over the backup); your
    laptop on the router's LAN 2.
- **The switch takes a configuration back from a file** (`js/net/swcli.js`):
  `copy tftp: running-config` merges the file's lines in as commands (an
  interface the file doesn't shut keeps its state); `copy tftp: startup-config`
  replaces what's saved, as a switch starting from it would have it (an
  interface the file names comes up unless it says shutdown), keeping the keys
  saved before. Prompts and errors as the real thing: the server, the source
  file, the destination; "Accessing ...", "Loading ... (via Vlan1): !",
  "[OK - n bytes]", "%SYS-5-CONFIG_I"; "No such file or directory", "Timed
  out". The TFTP server logs each read. Hashes stay hashes: `enable secret 5`,
  `username ... secret 5`, `password 7` keep what the file had, and `pwOk`
  checks a typed password against a plain or hashed one everywhere a password
  is checked.
- **SO-J7, a new hire's desk.** A PC in its box (`hire`), its desk in the
  open-plan office, the run 12 m. Lines: at the desk, cabled to the switch
  (straight into the router is the near miss); its port open and named as the
  records say (`plan.desc.hire`, from a stream of its own); online and
  printing; every other spare still shut and your laptop unplugged; saved; the
  backup refreshed (it goes stale the moment the change is saved); everything
  else still works. A range opened instead of the one port is caught.
- **SO-J8, the printer moved.** Staff moved it to the manager's office; the
  cabler's new 22 m run is in a spare port (shut). The old run is still in
  port 3, ending at the open-plan office's empty wall jack (`ojack`). Lines:
  the printer back online; its new port 100 Mb/s full duplex; every port's
  description true (the old port still named for the printer is the near
  miss); the old port shut with the spares; saved; the backup refreshed;
  everyone else still online. Laying the printer's run into port 3, where its
  settings already are, passes too.
- **SO-J9, the cable map.** The cablers redid the cabling: every run (the
  front desk, the printer, the new hire, both empty wall jacks) is punched down
  at the back of a new patch panel, the old 8-port switch is gone, nothing is
  patched, and there's no map. Lines: every desk patched through the panel to
  the switch and online; each desk on the port set up for it; the cable map
  right for every run, the empty jacks too; the spares still shut; saved and
  backed up (nothing on the switch needs to change). The tone and the probe
  find each run; the runs table doesn't say which back port a run is on
  (`endLabel`); the Lay form offers only the panel's front ports, and the
  simulation refuses a cord into the back. A patch cord in the rack is 0.5 m.
  `onMsw` follows a path through the panel.
- **SO-J10, a fibre link to the back office.** The meeting room becomes the
  back office: a second managed switch in its box (`bsw`, with a place of its
  own: `fixed` on the device), its PC (`mpc`), and the installer's OM2 run.
  Both switches' SFP slots are empty; the van has 1000BASE-SX, 1000BASE-LX and
  a 10GBASE-SR SFP+. Lines: the fibre link up (causes: in its box, the run not
  plugged in, an SFP+ in an SFP slot, a single-mode module on the multimode
  run, two different modules, the closet's port shut); the closet's fibre port
  open and named (`plan.desc.fibre`); the back office PC online and printing;
  the new switch named (`plan.bswHost`), its enable secret and console
  password the office's; both switches saved; the closet switch's backup
  refreshed; everything else still works. The console cable is 1.8 m: your
  laptop has to go to the back office.
  - The simulation: a fibre run is laid between two SFP slots that hold
    modules (OM2 multimode, the run's length plus 9 m the long way round); an
    empty slot takes a module from the van ("Put in a ... module", build mode
    only; the tickets keep their swaps).
- **On the build page:** the patch panel, the wall jacks, the back office
  switch and PC, and the new hire's PC have device buttons; the cable map form
  (`js/desk/cablemapui.js`, now with its own note) shows on a job with
  `cablemap: true`; the build engine takes the tone, the probe, cords moved, the
  map, modules and the LC pair, as the Ticket Desk's does.
- **The Ticket Desk's queue** says nothing more is coming once a level's
  tickets are all built.
- **The drawings, found by AAA on SO-J10's finished office:**
  - On the floor plan the printer, moved to the manager's office, sat on the
    room's name (4.84:1), and your laptop, carried to the back office, sat on
    the back office switch's label (1.01:1). The meeting room is wider now
    (`OFFICE_ROOM_BOX`: the open-plan office 300 to 660, the meeting room 660
    to 980), its devices laid out for four: the switch above, its PC, the wall
    jack and your laptop in a row (your laptop's spot there is its `alt`).
    Build mode keeps each room's whole name clear of the devices it places
    (`MANAGER'S OFFICE` is wider than the 140 units it used to keep).
  - A first version also sized each device's space on the plan by its name's
    width. The drive's new floor-plan check found it put the old 8-port switch
    on top of the router in the closet, SO-J1 to SO-J8, and AAA never saw it
    (text painted over text still measures dark on light). That sizing is gone:
    every device keeps the same 88-unit space as before.
  - On the logical diagram a port's name goes where it's clear of every
    device's label and tile and every port name already placed, measured as
    drawn: the near side of its line, the far side, further along, or on the
    line past its dot. "CONSOLE" had run off the right edge.
  - Build mode drew the logical diagram while it was hidden behind the floor
    plan, where nothing can be measured, so the port-marker fix did nothing
    there. Both pages now draw it again when it's shown.
- **Checks:**
  - `npm test`: 284.
  - The full drive: 3,401 checks. Each work order is done entirely through the
    page on three offices: SO-J6 88 checks (the changed key's fingerprint
    read off the warning and matched to `show crypto key mypubkey rsa`),
    SO-J7 70, SO-J8 67, SO-J9 73 (every run found with the tone and the
    probe), SO-J10 83 with the small office finished; then both drawings of
    every finished office work order (60 checks, below).
  - The drive checks both drawings of every finished office work order as
    painted (`labelsClear` in `tools/drive.mjs`): on the logical diagram every
    port name inside the diagram and clear of every device's label and tile and
    every other port name; on the floor plan every device's and room's name
    clear of each other and of every tile. Shown to fail on three plants: the
    name-width sizing put back ("Router" on "Old 8-port switch", SO-J1), the
    room-name space back at 140 ("MANAGER'S OFFICE" on a tile, SO-J8), and the
    redraw-on-show taken out ("CONSOLE" and "USB-C" off the diagram, "SFP1" on
    "Managed switch", SO-J10). The port-name search taken out fails it too.
  - AAA: 24 new states (SO-J6 6, SO-J7 4, SO-J8 4, SO-J9 4, SO-J10 6). The
    whole set, 165 states and 357,552 text runs, passes (run in two halves,
    19 October 2026). After the name-width sizing came out, the 46 build-mode
    office and level states were run again: all pass, 123,608 text runs.
    - The meeting room put back as it was is caught (1.01:1 "Back office
      switch", on the finished office's floor plan).
    - AAA can't see the logical diagram's port names going off the edge or a
      name painted over another's: those plants pass it, and the drive's
      drawing check above catches them.
  - `node tools/models.mjs`: 141. A new SO-J10 case found a module put into an
    empty slot wasn't drawn until a fibre went in (the 3D view took any plug
    out of a port the sim calls empty): a bare module now stays.
  - Plants, all caught: Node 30 new; page 14 new; models 2 new and 2 re-aimed.
    The plants found two gaps in the tests, both closed: keys travelling in a
    copy into startup, and a cord into an empty back port of the panel.

## Level 3, the small business: groundwork (stage 1 live 25 October 2026)

The owner, 19 October 2026: **"Do 3, then 4, and 5."** The Network+ (V9)
objectives were read from the doc the same day (unchanged) and shown to the
owner with the plan for Level 3 (10 work orders, 15 tickets) and the
photographs the new 3D models need (a business router, a ceiling access
point). Nothing of Level 3 is linked from the site yet. Built so far, every
piece node-tested (`tests/business-cli.test.js`, `tests/business-sim.test.js`;
`npm test` 316):
- **The managed switch's VLANs** (`swcli.js`): VLAN mode (`vlan 10`, `name`),
  access ports (a missing VLAN is made, with the real message), trunks
  (allowed lists: a bare list replaces, `add`/`remove`/`except`/`all`/`none`;
  native VLAN; `nonegotiate`), DTP worked out with the far end (`operMode`:
  access, trunk, dynamic auto, dynamic desirable), `interface vlan N` up only
  while a port that's up carries the VLAN, `show vlan brief`, `show interfaces
  trunk`, `show interfaces gi0/N switchport`, VLANs in the file and back. A
  switch saved before VLANs came reads as from the box (`fix`).
- **The parser serves more than one device** (`registerOS`): the switch and the
  business router, each with its tree, prompts, configuration keys, factory
  state and running configuration. A global command typed in a sub-mode runs as
  a global command, as on the real thing.
- **The business router BR-4200** (`rtcli.js`, our own unbranded name until the
  owner's photographs give the model): routed ports shut from the box;
  subinterfaces (`encapsulation dot1Q` before the address); static and default
  routes, longest match; DHCP pools and excluded addresses; standard, extended
  and named access lists (first match, the implicit deny); NAT inside/outside,
  PAT and static NAT; `show ip route`, `ip interface brief`, `ip dhcp
  binding/pool`, `ip nat translations`, `access-lists`, `lldp neighbors`.
- **The simulation** (`sim.js`): layer 2 by VLAN (`linkEdges`: untagged at each
  end, tagged where both ends carry the VLAN; a native mismatch joins two VLANs);
  links end to end through the patch panel and through a PoE injector
  (`viaInjector`, which passes tagged frames); routing through the router
  (`routeBR`: the access list in, the longest match, the list out, NAT to the
  provider, the reply back through the same lists); the router's own traffic
  (`routeFromRouter`); DHCP from its pools with the conflict check; the business
  access point (`bap`: each SSID on its own VLAN, `joinssid`); LLDP (`lldpOf`).
  Checks never change the network (tested).
- **Commands** (`cmd.js`): the console, SSH and Telnet reach the router; pings
  through it come back with the TTL one less and count on access list lines and
  NAT translations; tracert through it, blocked or not.
- **Before going live**, the full Level 2 drive and AAA had to be run again on
  this branch, since it changes the switch's parser and the simulation the small
  office runs on. Done for stage 1, 25 October 2026 (below).
- **The owner's answers, 19 October 2026:**
  - The photographs (the router's front in a rack, a sharper copy; the access
    point on its ceiling plate) gave the models `businessRouter` and `ceilingAP`
    (`assets/models/business-gear.js`, on `preview/models.html` under Small
    business). The router's rear and sides and the access point's top aren't in
    the photos and are drawn as usual: **"You can draw them and if I do not like
    it. I will send you photos to the level of details and real world accuracy
    that I am looking for."**
  - **"Yes to the router question"**: the router has all ten ports the model
    shows, numbered GigabitEthernet0/0 to 0/7 (copper) and 0/8 and 0/9 (the two
    SFP slots printed WAN).
  - **"Yes to the level 3 plans"**: six small businesses (a vet clinic, a dental
    practice, a bakery café, a physio clinic, a bike shop, a bookshop café); 10
    work orders (the new router online with NAT/PAT and DHCP; a staff VLAN with
    its trunk and subinterface; guest Wi-Fi on a ceiling access point with an
    access list; the back of house on a second switch over a trunk with its
    allowed list and native VLAN; the cameras' VLAN and a port forward; then
    hardening, a new department end to end, the printers' VLAN, a router rebuilt
    from its backup, the provider's fixed address) and 15 tickets (the wrong
    VLAN, a VLAN off the trunk, native mismatch, the wrong tag, a trunk that never
    forms, a deleted VLAN, VLAN hopping, the pool's wrong gateway, a pool run out,
    the printer's address handed out, an access list that blocks everything, one
    applied the wrong way, a VLAN left out of NAT, the wrong default route, NAT
    inside and outside swapped). Built stage by stage, each stage live once
    verified.

### Level 3, stage 1: the business and SB-J1, SB-J2 (19 October 2026)

- **The business** (`js/net/business.js`, `makeBusiness(seed)`): one of the six,
  as the technician finds it. The provider's router runs one flat network (its
  Wi-Fi off: `wifi.off`, so `aps()` skips it); the closet switch is set up as the
  small office's was (name, secret, console, a user for SSH, VLAN 1's address,
  port descriptions, unused ports shut, saved); the BR-4200 is in its box. Staff
  PCs on switch ports 1, 2 and 4 (the counter's PC, the manager's PC, the back's
  PC), the printer on 3 at `.20`. Its rooms are the business's own (a clinic's
  reception and treatment rooms, a café's kitchen): `roomNames`, drawn from
  `BUSINESS_ROOM_BOX`, positions in `BUSINESS_LAYOUT`.
- **SB-J1** (`js/build/business.js`): rack and console, the name and passwords,
  the provider's side (DHCP from the provider), the inside port as the gateway
  every device already uses, NAT with PAT, the router's DHCP pool keeping the
  gear's addresses back, every PC online again (a PC that hasn't renewed still
  asks the old router for names: its own cause), saved. **SB-J2**: the staff
  VLAN on the switch, the trunk to the router (a router never negotiates DTP, so
  a port left dynamic stays access: its own cause), the subinterface (any number
  on the inside port that tags the staff VLAN counts; the records' number is a
  convention), its pool, the PCs moved and renewed, printing across the router,
  both devices saved. The provider's router is collected between the two.
- **The page**: `draw.js` has a `SITES` table (the office and the business: layout,
  room boxes, rooms, names, fixed runs, names on the plan); the business router has
  its own icon (`brouter`); `build/app.js` says rooms by the business's names
  (`inRoom`). The router has a **Lights** tab (PWR, SYS, ACT, ALM, a row per
  cabled port) and a **Physical** tab: `businessRouter` drawn from the simulation
  (plugs where the cables are, each copper port's link light, the status lights,
  the SFP slots' LNK/ACT, the console cable), with a **Ports close-up** view (from
  the whole front a port's light is three pixels across).
- **Fixed on the way, Level 2 too:** every PC's Network settings tab (the manager's
  PC's and the new hire's were blank: only the front desk PC's was ever filled in);
  a Printers tab only on a PC with a printer set up; a console cable can't join two
  CONSOLE ports (the switch's and the router's both counted as console ends); the
  console wording names the router where it's the router; a switch's two-digit
  ports read "(port 24)" in cable names; names lower-cased mid-sentence with
  `/^[A-Z](?=[a-z])/`, so "Manager's office" reads "the manager's office".
- **Level 3 opens** when the small office is finished: `planned: 25`, `coming`
  says more work orders and its tickets are on the way.
- **Checks:** `tests/business-jobs.test.js` (150 businesses: the work still to do
  for the real reason, the solution passing, the tempting wrong ways failing their
  line for their cause, other right ways passing, replay and undo, Mason's ladder,
  no help naming a name, password, VLAN or address, random work never breaking the
  checker); `ONLY=business node tools/drive.mjs` (the lock; SB-J1 and SB-J2 on
  three businesses each, every step through the page's own forms, buttons and
  terminals; the router's prompt, its Lights tab, NAT's translations, the trunk,
  both drawings measured); `ONLY=business node tools/models.mjs` (the router's
  lights sampled from the rendered pixels, its plugs); the AAA states named
  "business:". The drive's drawing check now measures the diagram's device names
  and addresses too (it found the manager's PC's name and the printer's address
  off the diagram, and "Business router" on "Manager's PC"). Plants: a cause
  dropped, the native VLAN read as not allowed, an address in a hint, a stale
  lease never named, a single-cause line, a solution missing a renew; on the page,
  the router's Lights empty, the home router's icon, the colliding layout, a
  house's rooms offered, the provider's router never collected; in 3D, every port
  lit, the power light dark, no plugs drawn. Each failed as it should.

### Level 3, stage 1: finishing checks and two fixes (25 October 2026)

- **Port dots kept off names.** With easier reading on, port 1's own dot on the
  business's logical diagram sat on the bottom of its "1" (AAA 4.98:1, SB-J1 and
  SB-J2 done): the larger font reached down to the dot. A port's name is now
  placed clear of its own dot and every dot already drawn, and its dot clear of
  every name already placed; a name on its line moves on past its dot; a dot with
  no name slides off port names. Dots are measured as painted: a round dot 7 from
  its middle (6 and its 1 ring), a diamond 9.5. A first version measured them a
  unit bigger and pushed SO-J10's "CONSOLE" off the diagram, which the full drive
  caught; at the painted size it sits where it always did.
- **The drive's drawing check** (`labelsClear` in `tools/drive.mjs`) now finds a
  dot on any name, and `dysClear` measures both drawings of every finished office
  and business work order again with easier reading on. Both failed on the old
  code, in both fonts.
- **A link through a PoE injector** (found building stage 2, fixed here first:
  Level 1's porch camera sits behind one). The simulation joined the cables either
  side of an injector checking only the device-side cable, so a shut switch port,
  or a plug out on the switch side, still let traffic through. The injector's link
  now sees the far port too (`cableUp`), and a path through it is up only if every
  cable on it is (`edges`). Tested both ways in `tests/business-sim.test.js`
  (failing before the fix).
- **Totals before going live:** `npm test` 327 of 327; `node tools/drive.mjs`
  in full 3,591 checks (every level; `ONLY=office` 647 and `ONLY=business` 130 of
  them, both drawings of every finished work order in both fonts); `node
  tools/models.mjs` 162 checks; AAA on painted pixels, all 178 states and 394,632
  text runs, every one passing (run in two halves side by side: `tools/aaa.mjs`
  takes any states file, so states 1 to 100 and 101 to 178 ran at once).

### Level 3, stage 2: SB-J3, guest Wi-Fi on the ceiling access point (live 25 October 2026)

The owner's answers, 25 October 2026: getting into the access point's settings
stays as built (**"Keep it that way"**: the student finds its address, then types
it into a browser on the manager's PC), and so does the DHCP trap (**"Keep it that
way"**: a guests' access list with no DHCP line leaves guests on 169.254, with
Mason's hints pointing at it).
- **The simulation:** `addGuestKit` (js/net/business.js: the access point and a
  PoE injector boxed, the visitor's phone, `BUSINESS_SIGNAL`); the guest network's
  records (`guestSsid`, `guestPw`, `apPort` 5, `apDesc`, `guestAcl`). An access list
  in on an interface sees DHCP's DISCOVER. The access point's networks carry their
  password and joining checks the one typed (`joinssid` with `pass`); `apnet` (add,
  change or remove a network, validated as a real one is); an access point's own
  address is on its untagged side (`owners`).
- **SB-J3** (js/build/business.js): 12 lines; the VLAN, subinterface and pool
  checks shared with SB-J2. Tempting wrong ways each fail their own line; other
  right ways pass (`tests/business-jobs.test.js`).
  - **Mason on the DHCP trap:** with the visitor joined but no address, the
    visitor line's rung 1 points at what's applied where the guests' traffic comes
    in and what it has counted (`show ip interface`, `show access-lists`); rung 2
    gives the principle (a phone with no address asks with a broadcast from
    0.0.0.0 to UDP port 67; an access list ends with a deny you never see). Neither
    names the list, the line to add or any address; otherwise the general hints.
- **The page:**
  - **A web browser on every business PC** (`browse` in js/net/pages.js, the
    pane in js/desk/window.js): an address bar, then the page or the browser's own
    words. The request goes through the simulation as TCP to port 443 (80 for
    http://), so a VLAN with no way through or an access list stops it for the
    real reason. Only the access point has a page: the router and switches refuse
    (managed from their command lines), a Windows PC times out (its firewall), a
    name isn't found. The page never changes the network (it reads the owner of
    the address without taking a turn). No house or office PC has a browser.
  - **The access point's page:** its name, model, address, uplink and clients;
    its networks (name, security, VLAN tag, Remove); "Add or change a network"
    (`apnet`), with the access point's own errors. It never shows a password.
  - **Its address isn't given away:** the logical diagram shows "DHCP" under it.
    The student reads it from `show ip dhcp binding` on the router (the one lease
    on the old network) or the switch's LLDP neighbours.
  - **The visitor's phone at the business:** the networks it hears, each with a
    password box and Join (`joinssid`); "the password is wrong" when it is. (The
    house's phone page read `sim.d.router.wifi`, which the business doesn't have.)
  - **The access point's Physical tab:** `ceilingAP` drawn from the simulation, no
    bench under it (`stage: "none"`). Its light ring: off with no power, amber with
    power but no link on its uplink, blinking blue on the network with nothing set
    up, blue while it broadcasts; the same in words. Views: Light ring, Port bay
    (top). Its label's hardware address stays covered, as on every model.
  - On the diagram it's "Access point" (its device label), in line with the
    injector and the manager's PC; the visitor's phone sits clear of the printer's
    address (the drive found both collisions, the second only with easier reading
    on).
- **Checks:**
  - `npm test` 335 of 335. `tests/business-page.test.js`: the browser, the phone,
    the ring, the DHCP trap's hints (failing on the old ones); 10 plants in a
    throwaway copy, all caught once two gaps were closed (the no-change check now
    covers each computer's ARP table and turns, and a house's and an office's PCs
    are held to having no browser).
  - `ONLY=business JOB=SB-J3 node tools/drive.mjs`: 74 checks on three
    businesses, every step through the page: the address read from the router,
    the page opened in the browser, a password too short refused, the network
    saved, a wrong password on the phone refused, both drawings in both fonts.
    `python3 tools/plants-business-page.py`: 9 page plants, each run in a
    throwaway copy through that drive, all caught.
  - `ONLY=business node tools/models.mjs` 33: the ring sampled on the ring (blue
    broadcasting, amber with its port shut, dark unplugged, blue with nothing set
    up) and the plug out of ETH once unplugged. It found the plug never moving
    (the port was listed as "ETH (PoE IN)", the model's is "ETH"); a ring planted
    to ignore the simulation is caught.
  - AAA on the 8 "business: SB-J3" states, 23,668 text runs, all passing. It found
    the access point's tile shadowing "SHOP FLOOR" on the plan on a phone with
    easier reading on (6.04:1); its spot is lower now.
  - **Totals before going live:** `npm test` 335 of 335; `node tools/drive.mjs` in
    full 3,660 checks; `node tools/models.mjs` 170; AAA on painted pixels, all 186
    states and 418,936 text runs passing (in two halves side by side; the second
    reached the two-hour limit for a background run at 81 of its 93, and its last
    12 ran on their own).
- `tools/wip/`: scripts used while building (run from the repo root): `sbrun.mjs`,
  `sb3net.mjs`, `sb3page.mjs` (SB-J3's page parts in Node), `l3geo.mjs`,
  `l3shot.mjs`, `rtr3d.mjs`. Not part of the site.

### Level 3, stage 3: SB-J4, the back of house on its own switch (25 October 2026)

Built as the owner approved on 25 October 2026 ("Ok that works. thank you" to
the plan: SB-J4 to SB-J10, then the 15 tickets, then Levels 4 and 5).
- **The simulation:** `addBackSwitch` (js/net/business.js) brings a second
  MSW-2800G in its box, a unit of its own (its own keys), with one place: its
  shelf in the back room (the Place form takes it nowhere else, as with the
  office's back office switch). The records: `bswHost`; `trunk` (the closet
  switch's port 23 to the back switch's port 24, each end's description);
  `backPort` 1. Trunks use the records' unused VLAN as native (`vlans.native`).
- **SB-J4** (js/build/business.js), 8 lines:
  - the back switch on its shelf, with the business's name and passwords
  - the staff VLAN on it, named as the records say
  - the trunk, both ends as the records say. Its causes: no cable, the wrong
    ports, an end shut, an end not a trunk, an end left to negotiate (DTP),
    the staff VLAN not carried, VLANs carried that the back doesn't use, the
    two native VLANs differing, the native VLAN left at 1, the descriptions
  - the back PC on the back switch: off its old run, on the records' port,
    open, in the staff VLAN, described, a staff address, online, printing
  - nothing left open: the new switch's spares, the closet's old port 4 and
    its old description
  - everything that worked still works
  - each switch saved, each its own line
- **How the trunk is judged:** each end is worked out as it negotiates with the
  other (`carries` given the far end's mode). A back end left on dynamic auto
  really does trunk with a closet end set to trunk, so it is its own cause
  ("dtp"), not "not a trunk". No `ipconfig /renew` is needed: the PC stays in
  the same VLAN and subnet and its lease is still good, so skipping it is not a
  mistake. The rack line was dropped: the back switch can't be placed anywhere
  else, so "in the wrong room" could never happen, and "still in its box" is
  the first cause of every line that needs it.
- **The walk-through's console cable numbers** come from the runs already laid
  (`net.extra.runs`). The first test now plays every walk-through exactly as
  written. The tests' helper swaps any console pull for whichever console cable
  is in, so a wrong number was never seen in Node (a plant proved it, before
  the change).
- **Found and fixed on the way, for every level:**
  - `interface range` takes a list, `gi0/2 - 23 , gi0/25 - 28` (single ports
    too), as IOS does: the natural way to shut the back switch's spares.
  - A refused cable names each device as it would be said mid-sentence ("The
    back switch is still in its box", "Your laptop's USB-C …", "The ISP …").
    Every business label read capitalised there ("The Closet switch's port …").
  - **The logical diagram draws every line first, then keeps each port's name
    and dot off every other cable's line** (a dot with room to see it is clear),
    and each dot off every dot already drawn. With your laptop back in the
    closet, the trunk's "23" sat just under the console line and the reception
    PC's "1" on it, so either read as the console's.
    - Where lines crowd too close for that, it relaxes step by step. First it
      looks in its own half of its line clear of every name, tile and dot. If
      that half is all taken, it looks further along its line, its dot still
      before the far end's own. Only then does it use the default spot.
    - The first full drive found the printer's "3" on the reception PC's "1"
      at the closet switch's corner in SB-J1 to SB-J3. The "1", kept off the
      printer's line, had taken the spot the "3" fell back to.
  - **The managed switch's 3D model has a "Lower row lights" view.** The lower
    row's jacks are upside down with their lights under the plug, so from above
    a plugged port's lights hide behind its own plug, as on the real thing
    until you crouch. The back switch's trunk in port 24 was drawn lit but
    couldn't be seen (and the closet switch's port 24, the router's trunk, since
    SB-J1). The view is nearly level and from the right; the front close-up
    stays as it was, for the top row.
- **The page:** your laptop has a spot of its own on the diagram when it's
  carried to the back room (right of the back PC's line, its name to its
  right): at its closet spot its console line to the back switch was too short
  to carry both port names, and "USB-C" sat on "Back switch".
- **Checks:**
  - `tests/business-jobs.test.js`: SB-J4's tempting wrong ways each fail their
    own line for their own cause, and other right ways pass (one range with a
    comma, names spelled out, `switchport nonegotiate` at both ends, the PC's
    port left to default, no renew). The help checks now cover the back
    switch's name, the trunk's descriptions and the native VLAN.
    `tests/business-sim.test.js`: the refusals' wording. `tests/office.test.js`:
    range lists.
  - `ONLY=business JOB=SB-J4 node tools/drive.mjs`: 80 checks on three
    businesses, every step through the page. They cover the closet refused for
    the back switch, the console cable refused from the closet (1.8 m),
    `Switch>` from the box, the back switch taking every line, the closet's
    `show interfaces trunk`, the back PC pinging out, and both drawings in both
    fonts, with your laptop at the back switch and when it's done.
  - The drive's drawing check now also fails on two port dots on each other,
    and on a port name or dot on another cable's line (each line, name and dot
    carries its cable's id).
  - `ONLY=business node tools/models.mjs`: the back switch's lights and plugs
    as the simulation says, done and part way (port 24 dark while the closet
    end is shut), the lower row read from its own view.
  - Plants, each shown to fail:
    - `python3 tools/plants-business-node.py`: 13, all caught (one missed at
      first, the walk-through's console numbers, until the first test played
      walk-throughs as written).
    - `python3 tools/plants-business-page.py SB-J4`: 6 page plants, all caught.
    - `python3 tools/plants-business-models.py`: 4, all caught. The page and
      models plants each run in a throwaway copy.
  - **Totals before going live:** `npm test` 338 of 338; `node tools/drive.mjs`
    in full 3,735 checks (`ONLY=business` 274); `node tools/models.mjs` 188
    checks; AAA on painted pixels, all 195 states and 445,642 text runs passing
    (in four parts, two at a time, each under the two-hour limit for a
    background run; SB-J4's 9 states measured again after the last drawing
    change). One run of `node tools/models.mjs` alongside the full drive failed
    HOME-05's DS blink (it samples 12 times, 230 ms apart, and a loaded machine
    stalls the render loop); run alone it passed.
- `tools/wip/`: `sb4net.mjs` (the trunk by hand), `sb4cases.mjs` (what each
  tempting wrong way fails), `sb4shot.mjs` (both drawings at three points, the
  back switch's front), `ray24.mjs` (what sits between the camera and a port's
  light), `l3labels.mjs` (a finished business job's port names as placed, and
  a picture). Not part of the site.

### 3D views antialiased (live 26 October 2026)

The owner, looking at the dome cameras' preview: **"Will they be this pixelated?"**
- Partly the preview's screenshots (software graphics at standard density, then
  shrunk). But it was also a real fault, on every screen. Every 3D view draws
  its frame through post-processing (the ambient shading, then the LED glows),
  and that renders into buffers of its own with no multisampling. So the
  renderer's `antialias` did nothing, and every edge came out stair-stepped.
- The composer now gets a 4x multisampled buffer (`WebGLRenderTarget` with
  `samples: 4`), in `js/desk/model3d.js` and in `preview/preview.js`. A
  close-up before and after showed the stair-steps gone.
- Checked before going live: `node tools/models.mjs` 188 of 188 (every light
  still reads as it should); AAA on the 28 states that show a 3D model, 65,436
  text runs passing.

### Level 3, stage 4: SB-J5, the cameras' VLAN and a port forward (live 27 October 2026)

The owner's decisions, 26 October 2026 (talked out before building):
- **The cameras, from the owner's photographs** of a ceiling dome under a
  suspended ceiling and a wall dome on a junction box. Asked for "real world
  detail", then "the cabling needs to match that level of detail". Approved:
  **"That is the level of detail that I am looking for."** These are
  `ceilingDome` and `wallDome` in `assets/models/business-gear.js`, on
  `preview/models.html`. The detail is the bar for every model from here on:
  - the camera's seams and screws, the gimballed eyeball, the coated lens, the
    infrared ring, the status light
  - fissured ceiling tiles, the grid, the J-hook and hanger wire; painted
    concrete, the junction box's glands, the conduit's saddle clip
  - printed jackets, ribbed strain reliefs, the Y-splitter, capped DC jacks,
    cable ties, TIA-606 ID flags
  - plenum-rated cable above a ceiling, riser-rated along a wall, nail-in clips
- **Where:** the ceiling dome in the waiting area, the wall dome at the back
  door in the back room.
- **Power: "A PoE injector each"**, one in the closet for the ceiling dome and
  one in the back room for the wall dome. Neither switch has PoE.
- **Fixed addresses: "On each camera's own page".** The cameras start on DHCP.
  The student finds each one's address (as with the access point), opens its
  page in the manager's PC's browser, and sets a static address outside the
  pool.
- **The outside test: "Manager's phone on mobile data".** Wi-Fi off, the
  phone's browser opens the business's public address and port, as the
  manager would from home.
- Asked about the previews, **"Will they be this pixelated?"**: the 3D views'
  antialiasing fault above, fixed and live first.

**What was built** (the owner: **"Yes, go ahead and build SB-J5"**, then, after a pause for the flash cards, **"Go back to
SB-J5 and finish it"**):
- **The simulation** (`js/net/sim.js`, `js/net/business.js`):
  - `addCameraKit` brings the two cameras (`dcam`: `cam1` the ceiling dome, `cam2` the wall dome), an 802.3af injector for
    each (`cinj1`, `cinj2`, labelled CAM-01 and CAM-02), and the manager's phone (`mphone`: `cell`, its Wi-Fi off, not on
    the diagram). The records: `cams` (each camera's switch and port, its port's description, its fixed address's host
    number, its outside port 8443 or 8444), `camExcl` 20, `camAcl` CAMERAS-IN.
  - The cameras start on DHCP and serve their page on 80 and 443. A camera on 169.254 asks again once a pool exists, but
    not while the pool is still being typed (`poolOpen`), or it would catch a lease with no default router.
  - **From outside** (`fromInternet`): in through the provider-side interface's list, sent on only by a static NAT entry
    (`ip nat inside source static tcp <inside> <port> interface <wan> <port>`), and only between nat outside and nat
    inside, then routed, out through the inside interface's list, to whoever answers ARP and listens on that port. The
    camera's reply goes back to its own gateway and through the same lists (a list remembers nothing). Each failure says
    why (`why`: provider, nobody, wan, acl-in, no-forward, outside, no-route, inside, acl-out, arp, port, gateway, reply);
    nothing changes the network. `show ip nat translations` lists the static forwards before any traffic.
  - A phone's Wi-Fi radio (`radio`, in the engine's state list). On mobile data the phone is out on the internet: a
    private address means nothing, and the business's own address goes through its forwards. On the guest Wi-Fi the
    router doesn't loop its own forwards back inside: refused.
- **SB-J5** (`js/build/business.js`), 15 lines: each camera installed (its own injector, in the records' rooms, the
  injector's PoE OUT to the camera, DATA IN to the records' switch and port); the cameras' VLAN on both switches; their
  ports (open, described, **set as access**: a camera by an outside door is the easiest thing to unplug, and a port left
  to negotiate would trunk with a laptop); the trunks (the allowed list added to, not replaced: replacing it drops staff
  and the back PC); the router's subinterface (NAT's inside, or no forward reaches it; no NAT list, the cameras never go
  out); the pool (the first twenty kept back, where the fixed addresses are; no DNS needed); each fixed address on the
  camera's own page; the cameras starting nothing (a packet that arrives counts, whether or not its reply gets back, so a
  list applied out is caught); both pages from the manager's PC; both from the phone on mobile data (a forward to the
  plain page on 80 is its own cause: the manager's password in plain text); everything still working; three saves.
  `subCauses` and `poolCauses` take the cameras' wording (`W`, `NAT_WHY`). The guests' DHCP trap comes back if the list
  goes on before the cameras have leases: the fixed line's hints point at it.
- **The page:**
  - **The camera's own page** in the browser (`camPage` in `js/desk/window.js`): a live picture (drawn, greyscale, its
    name and LIVE on a black band), what it is, and its settings form (DHCP or fixed). Saved with a new address, the
    browser is left at the old one, which now says the page has gone from there. Reached from outside, the settings are
    shown and not changeable. A secure request to a forward to the plain page gets the browser's SSL error, plain http to
    the secure page a 400.
  - **The manager's phone**: a device button and a place on the plan (its desk), no place on the logical diagram; its
    Wi-Fi tab has a Turn Wi-Fi on/off button.
  - **The diagram is drawn taller** with the cameras (`CAM_H`): the ceiling camera's injector under the closet switch and
    the camera down to its left (so its line clears the injector's name), the back door camera and its injector on a row
    of their own; the visitor's phone moves under the access point (`cams` positions in `BUSINESS_LAYOUT`). A camera
    shows "DHCP" until it's fixed, then its address. A camera's injector reads "PoE injector" with its camera's tag under
    it, and "Injector CAM-0x" on the plan.
  - **The floor plan** grows a strip outside, under a back door in the back room's wall: the back door camera is drawn
    there ("OUTSIDE THE BACK DOOR"); the back PC moves right on the plan so its long name clears the camera's injector.
  - Positions were searched with `tools/wip/sb5lay.mjs`, which scores a layout in both fonts at four points in the job
    (nothing done, the cameras cabled with their ports shut, your laptop at the back switch, done): names and tiles on
    each other, port names and dots on other lines, and **a line under another device's name or tile**. Lines may pass
    under their own device's name (its plate masks them). Six businesses, all clean.
  - **3D** (`domeCeiling`, `domeWall` in `js/desk/model3d.js`; `physicalState`): the status light off with no power,
    blinking blue with power and no network (no link, or no address), on once on the network; the same in words; the
    cable in the pigtail's coupler, or hanging out of it. Views: In its ceiling, Above the tile, Its pigtail close up;
    Its cables close up.
- **Checks:**
  - `tests/business-cams.test.js` (the simulation, 40 businesses) and SB-J5 in `tests/business-jobs.test.js`: the
    tempting wrong ways each failing their own line for their own cause, other right ways passing (the allowed list
    given whole, `eq https`, a DHCP line in the list, the address in the forward, a subinterface numbered its own way,
    a wider excluded range), the help never naming the list, the descriptions, the outside ports or an address.
  - `ONLY=business JOB=SB-J5 node tools/drive.mjs`: on three businesses, every step through the page, the cameras'
    leases read from `show ip dhcp binding` and each camera's page opened at its lease and its address fixed there; the
    phone on mobile data, on the guest Wi-Fi (refused), and back; both drawings in both fonts, mid-job and done.
  - `ONLY=business node tools/models.mjs`: both cameras done (the status light sampled on, blue; the words; the cable in
    the pigtail's coupler; drawn as the ceiling or the wall dome), the back door camera unplugged (off, the plug out),
    and part way (blinking with power and no network; off, no plug, before its injector is cabled).
  - AAA: 12 SB-J5 states. The live picture's caption first measured 1.01:1: SVG text painted by a `fill` attribute,
    which the checker neither reads nor hides. It is now `fill: currentColor` from CSS, measured again passing (3,146
    runs), and a dark caption planted fails 8 lines.
  - Plants, each shown to fail:
    - `python3 tools/plants-business-node.py`: 13 new, all caught (a camera on the other camera's injector, an injector
      in the wrong room, a port left to negotiate, the trunk's allowed list replaced, a forward to the plain page,
      HTTPS to the staff PCs left open, no lease read as merely DHCP, the pool keeping only ten back, an address in a
      hint, the walk-through's console cable, the reply and the gateway never checked from outside, a camera catching
      the pool half typed). The run takes over two hours, so it was finished in two goes.
    - `python3 tools/plants-business-page.py SB-J5`: 9 new, all caught. Two were first caught only because the drive
      stalled on a click (the phone's Wi-Fi switch doing nothing, the ceiling camera with no device button); each now
      fails a named check first. SB-J3's "form's error" plant had come to match twice (the camera's page has the same
      line) and was re-anchored.
    - `python3 tools/plants-business-models.py`: 3 new (the status light lit whatever the state, no cable drawn, the wall
      dome drawn as the ceiling one), all caught.
  - **The drive and the 3D view's first frame.** The full drive stopped SB-J3 on one business: a click timed out after the
    access point's Physical tab opened. Timed (`node tools/wip/aptime.mjs`): the first 3D frame and the first shaded one
    compile their shaders, which under software graphics holds the page about four seconds (with or without the 4x
    multisampling: 4.0-4.8 s with it, 3.8-4.1 s without), and a loaded machine pushes the next click past its 5 s. A
    student with a graphics card doesn't see this. The drive's `tab` now waits for a Physical tab to settle
    (`settle3d`: the model mounted and its shaded frame drawn, read from `debug().settled` in `js/desk/model3d.js`) and
    doesn't click an open Physical tab again, as a student wouldn't. Shown both ways under the same CPU load: the old
    helper stopped SB-J3 777777, the new one passed all 74 checks.
  - **HOME-05's blink check** (`tools/models.mjs`) failed once with nothing else running: twelve samples all saw DS off.
    Each sample draws a shaded frame, about a second under software graphics with the multisampling, so samples 230 ms
    apart could stay in step with the half-second blink. The gaps now vary (230 to 740 ms) and it looks for up to forty
    samples. Run again alone it passed; with the blink planted off (`const on = true`, in a throwaway copy) exactly
    that check fails ("saw green").
  - **Totals before going live:** `npm test` 348 of 348; `node tools/drive.mjs` in full 3,855 checks (`ONLY=business`
    394); `node tools/models.mjs` 202 of 202; AAA on painted pixels, all 207 states and 492,928 text runs passing (in four
    parts, two at a time).
- `tools/wip/` (not part of the site): `sb5net.mjs` (the cameras' network by hand), `sb5job.mjs` (each line at the start
  and after the solution), `sb5lay.mjs` (the layout search above), `sb5page.mjs` (the camera's page, the phone and the 3D
  tabs, screenshotted), `camshot.mjs` (the dome previews at a pixel density), `aptime.mjs` (how long a click takes with the
  access point's 3D view open, and the page's long tasks).

### Level 3, stage 5: SB-J6, hardening after a card-payment check (live 2 November 2026)

The Network+ (V9) objectives were read from the owner's doc on 28 October 2026: the Network+ section is word for word
the copy saved on 30 September (`Network-quizzes/verify/objectives-netplus-2026-09-30.md`). SB-J6 draws on Network
security (security features and defense: "device hardening, NAC, key management, ACL ... trusted vs. untrusted zones";
types of attacks: "VLAN hopping, MAC flooding, ARP poisoning/spoofing ... rogue devices/services"; audits and
compliance: "PCI DSS"; physical security: "cameras and locks"; logical security: "least privilege") and Network
operations (access and management: "SSH ... console").

The owner's decisions, 28 October 2026 (talked out before building):
- **The reason: "Card payment check"**: the card processor's PCI DSS check flagged the business's network.
- **The lines proposed and shown:** the router managed by SSH only (Telnet off, its keys, the business's user; the
  switch learned this in SO-J2, the router hasn't); only the staff VLAN reaches the router's remote lines (an access
  list on the lines); no password readable in any configuration, on the router and both switches; idle sessions log
  out (console and remote lines); port security on the staff PCs' ports, one device each; unused ports shut and parked
  in an unused VLAN; access ports can't become trunks (VLAN hopping); the router silent to the provider (LLDP off on
  its outside port, its web server off); the closet rack locked; everything still works; every device saved.
- **"Both, with ARP inspection"**: DHCP snooping (DHCP answers trusted only from the uplinks) and Dynamic ARP
  Inspection, two more lines.
- **Port security: "Shut the port"**: a violation err-disables the port until it's reset (its light out in 3D).
- **The rack lock: the owner's photographs** (28 October): a full-height cabinet, a black hexagon-perforated front door
  in its frame, hinged on the left, a silver-grey side panel; a black recessed rectangular latch housing with rounded
  corners, two screws (top centre, lower right), a black paddle handle folded flat in its left half, a chrome key
  cylinder at upper right, a silver key on a split ring with a blue tag (its writing left off). The owner sent the full
  cabinet when asked which rack, so it's modelled as photographed and shown on `preview/models.html` for approval
  before SB-J6 uses it; the door's back, the cabinet's top and back are drawn, for the owner to review. The photographs
  are kept out of the repo (only modelled from).

**SAVE POINT, 30 October 2026: SB-J6 paused by the owner** ("Pause on this for now. Create a save point."), for the test
banks' new score card, question map, filters and retest-the-wrong-ones option, which come first (Core 1, Core 2, Network+,
Security+, CySA+), then back here. That plan: the owner's doc "Test banks: score card, question map and filters (plan)"
(https://claude.ai/artifact/6vcGwyvSsrwfHBWaKp6rq5); the order is also in `/root/.claude/CLAUDE.md`. Everything below is on `save/level3-stage5`, not live; `main` is SB-J5.

**Resumed 1 November 2026** (the owner: "Lets get back to the E4 mafia network"), the test banks done and live. The
objectives doc was re-read that day: its Network+ (V9) section is unchanged from the 30 September copy.

Built and checked so far:
- **The cabinet** (`closetCabinet` in `assets/models/business-gear.js`; `cabinetLatch`, `cabinetKey`, `phillips`,
  `rrExtrude`): five views on `preview/models.html` (`cab`, `cab-latch`, `cab-locked`, `cab-open`, `cab-back`), shots sent
  to the owner on 28 October. **Approved by the owner, 31 October 2026** ("Approved"), for SB-J6's lock line. Options: `open`
  (degrees), `locked`, `key` (false: taken out), `contents`. The perforation is blended (not cut at a threshold) so it
  doesn't break into a grid of dots from across the room; holes `d: 4.0` at `pitch: 6` read as dark as the photograph.
- **The engine** (`js/net/swcli.js`, `rtcli.js`, `sim.js`, `cmd.js`):
  - Switch: `switchport port-security` (refused on a dynamic port, as on the real thing), `maximum`, `violation
    protect|restrict|shutdown`, `mac-address sticky [H.H.H]` (turning sticky on keeps what was already learned; off, it
    goes back to learned); `ip dhcp snooping`, `ip dhcp snooping vlan`, `ip dhcp snooping trust`; `ip arp inspection vlan`,
    `ip arp inspection trust`; `show port-security [interface | address]`, `show ip dhcp snooping [binding]`, `show ip arp
    inspection [interfaces]`; err-disabled in `show interfaces status` and `show interfaces`. Settings in `ports[n].ps`,
    `snoop`, `dai` (configuration); what it learns as it runs in `psRun` and `snoopBind` (never saved; a reload clears them).
  - Both: `exec-timeout` kept (`con.timeout`, `vty.timeout`), `access-class NAME in` on the vty lines (`vty.acl`), in the
    running configuration. Router: `no lldp transmit|receive` per port, `no lldp run`, honoured by the switch's LLDP view.
  - `cmd.js`: SSH and Telnet are refused ("Connection refused") from a source the vty access list denies.
  - `sim.js`: every layer-2 edge keeps its cable's ends, so `l2Path` knows the port a frame comes into each switch by.
    `snoopBlock` (answers on an untrusted port dropped, in `dhcpServers`; `snoopDrops` says where), `snoopLearn` (a lease
    through an untrusted port binds the client to it; release and snooping off remove it), `arpBlock`/`arpBlocked` (ARP both
    ways checked against the bindings at each inspecting switch: in `route`, `routeBR`, `routeFromRouter`, `fromInternet`;
    the failure carries `dai`), `behindPort` and `portSecurity` (after each change, in `relink`).
  - Fixed while building: a switch saved before a setting existed read as changed (keys compared in saved order); now
    compared in the configuration's own order.
  - Hand runs (`tools/wip/sb6net.mjs [seed] [notrust|cams|old]`) show the real gotchas: clients with leases from before
    snooping are dropped by ARP inspection until they ask again; the router's port must be trusted for both; inspection on
    the cameras' VLAN or the old network drops the fixed addresses (forwards fail at ARP; printing stops).
- **Records** (`js/net/business.js`): `plan.vtyAcl` (MGMT-ONLY, SSH-STAFF or ADMIN-IN) and `plan.idle` (5 or 7 minutes:
  under the default 10, so leaving the lines alone never meets them), from a stream of their own (`rng(seed ^ 0x6a11)`), so
  every earlier business comes out exactly as before.
- **Checks:** `tests/business-harden.test.js` (5 tests, 20 businesses); 10 Node plants in `tools/plants-business-node.py`,
  all caught; business tests 75 of 75.
- **One change from the lines shown to the owner, agreed 31 October 2026** ("OK, drop it"): "its web server off" is
  dropped: this router never had one (SB-J3 checks its address is refused in a browser), so line 8 is LLDP off on the
  outside port only.

**Built 1 November 2026, the work order** (`SB6` in `js/build/business.js`; on `save/level3-stage5`, not live):
- **Its start:** SB-J5 done, then `addCabinet` (`js/net/business.js`): `net.cabinet = { open: true, locked: false, key:
  true, holds: ["rtr", "msw"] }`, the door standing open, unlocked, its key in the lock. `already`: still, saved, swsaved,
  bswsaved; every other line starts unmet for its real reason (checked on 25 businesses).
- **The cabinet in the simulation** (`sim.js`): the action `{ t: "cabinet", values: { open | locked | key } }`, one at a
  time; the lock turns only with the key in and the door shut, a locked door doesn't open. `cabinetBars`: with the door
  shut, a cable laid or pulled at the router or the closet switch, or either powered off and on, is refused ("... is in the
  closet cabinet, and its door is shut: open it first"); the back switch isn't in it. Recorded for replay (`engine.js`
  STATE). A refused power-cycle now says so (`pages.js` `physical`), not "Restarted".
- **The lines and their causes, in order** (each first cause still on is the one shown; rung 3 strikes those before it):
  - `ssh`: domain, keys, small (under 768 bits), user, userpw, login (not `login local`), telnet (`telnet` or `all`), none.
  - `vtyacl`: none, out (applied out), missing (a list that doesn't exist lets everyone in), staff (shut out too), wide
    (lets in the guest or cameras' network, the old network or the internet), name (works, but not the records' name).
  - `pwenc`: per device (router, closet, back), `-enable` (an enable password beside the secret: plain, or type 7 with
    the words saying anyone can reverse it), `-service` (no `service password-encryption`).
  - `idle`: per device, `-never` (`exec-timeout 0 0` on con or vty), `-long` (none set, the default ten minutes, or over
    the records' minutes; seconds count, so `exec-timeout 0 300` is five minutes).
  - `psec`: the first staff PC whose port isn't right: cable, off, err (err-disabled), max, viol (restrict or protect),
    sticky (none stuck), wrong (another device's address stuck); then ap (port security on the access point's port) and
    uplink (on a trunk to the router or the other switch).
  - `park`: cvlan, cname, bvlan, bname (the parking VLAN on each switch, named PARKING), open, mode (left to negotiate or
    a trunk), vlan (a spare in a VLAN that's in use). Spare means a copper port with nothing cabled to it.
  - `access`: dyn, trunk: the ports with a PC, the printer, a camera or a laptop at the far end (followed through an
    injector); the access point's port is a trunk and isn't counted.
  - `lldp`: inside (turned off on the inside port instead), rx (`no lldp receive` only), wan. `no lldp run` passes.
  - `snoop`, per switch: `-vlans` (not every staff and guest VLAN it carries), `-on` (set but never turned on), `-trust`
    (the way to the router untrusted), `-device` (a device's or the access point's port trusted).
  - `dai`, per switch: `-vlans`, `-blind` (inspected where it doesn't snoop), `-fixed` (the cameras' VLAN or VLAN 1:
    fixed addresses have no bindings), `-trust`, `-device`.
  - `rack`: open, unlocked, key (locked, the key left in the lock).
  - `still`: err (a staff PC's port shut by port security), lease (no address: answers dropped), stale (its lease from
    before snooping), arp (dropped by inspection though bound), net, print, guest, cams (from outside), ap.
- **The walk-through:** the router (domain, keys of 2048, the user, the standard list, the lines, the timeouts,
  password-encryption, `no lldp transmit` on Gi0/0, saved); the closet switch (encryption, timeouts, port security on 1 and
  2 with sticky, the printer's port 3 set as access, the parking VLAN, the spares `gi0/4 , gi0/7 - 22` parked and shut,
  snooping and inspection on staff and guest trusting 24, saved); the laptop to the back room, the back switch the same
  (port security on 1, spares `gi0/3 - 23`, staff only, trusting 24); every staff PC renews, the visitor's phone rejoins;
  then the cabinet shut, locked, its key taken out.
- **Fixed while building:** `transport input ssh telnet` (or `telnet ssh`) read as SSH only, so Telnet left on would
  have passed; both words now take both (`all`), as on the real thing.
- **Checks:** `tests/business-sb6.test.js` (7 tests, 25 businesses): as found and solved; the router's wrong ways
  (Telnet left on, both taken, 512-bit keys, no `login local`, `permit any`, a list shutting staff out, applied out, a
  missing list, the wrong name, a type 7 enable password, encryption left off, `0 0`, fifteen minutes, LLDP left on, only
  `no lldp receive`, LLDP off inside, not saved), each failing its own line and nothing else where that's the point; the
  switches' (no sticky, restrict, maximum 2, port security on the access point's port, which then shuts the visitor out,
  and on the trunk, the parking VLAN made by the access line and never named, spares unparked, left to negotiate, opened,
  the printer's port left negotiating or made a trunk or put in staff, which stops printing, the router's port untrusted
  for DHCP (nobody renewing gets an address) or for ARP, snooping never turned on, a PC's or the access point's port
  trusted, inspection on the cameras' VLAN or VLAN 1, the back switch not snooping, not saved); clients never renewed; the
  cabinet's three wrong ways; other right ways (1024-bit keys, an extended list, seconds, `no lldp run`, the settings in
  full, the inter-switch trunk trusted, the cabinet locked first and opened again); the cabinet's rules (refusals change
  nothing; it replays); checking changes nothing. In `tests/business-jobs.test.js`: SB-J6's names (its list, the domain,
  PARKING, the parking VLAN, the idle minutes) added to what no hint may say, a VLAN's number now caught in any case ("VLAN
  998" was missed), Mason's words at each count of failing checks read straight from the first unmet line (the same words,
  a sixth of the time), and SB-J6's random walk given its own hardening lines and cabinet actions.

**The page (1 November 2026):**
- **The cabinet is a device of its own,** `sim.d.cab` (kind `cabinet`, `holds: ["rtr", "msw"]`, its state `open`, `locked`,
  `key`), so it has a button (after the back switch) and one tab, **Physical**: its 3D model (`closetCabinet`, approved), the
  model's words (door, lock and key, what's inside and whether it can be reached), a table (Door, Lock, Key, Inside), and
  three buttons that name what they do ("Shut the door" / "Open the door", "Lock it" / "Unlock it", "Take the key out" /
  "Put the key in"); a refusal is said in the result line ("It's locked: unlock it first."). The 3D viewer draws one model at
  a time, which is why it isn't on the router's tab. Shut and open are two models (`cabinet`, `cabinetOpen` in `model3d.js`),
  each framed afresh (`mount` now reframes when a device's model changes); the shut one offers "The latch close up" and "Its
  top and back", the open one "The gear inside". It stands on the concrete stage.
- **The floor plan:** a dashed frame round the router and the closet switch, "CABINET: OPEN / SHUT / LOCKED / LOCKED, KEY IN"
  between them; the frame opens the cabinet's window. Not on the logical diagram (it's the network).
- **The router and the closet switch** say on their Physical tabs that they're in the cabinet and whether the door lets
  their ports be reached. With the door shut, reseating, unplugging or swapping a cable at them is refused too.
- **Fixed:** the cable table's Pull said "Pulled the cable" even when refused; it now says "Not pulled: ..." with why.
- **The visitor's phone has its Wi-Fi switch now** ("Turn Wi-Fi off" / "Turn Wi-Fi on", as the manager's phone has): once
  connected, its Wi-Fi tab offered nothing that made it ask again for an address, so after snooping a student had no way
  to give it a lease snooping could see. The walk-through turns its Wi-Fi off and on (`radio`).
- **The plan's cabinet label** paints with `currentColor` and sits on a plate like every name on the plan (`.cabl` in the
  plates' selectors): AAA found it at 1.04:1 first (the checker hides lettering by its colour, and a fixed fill hid
  nothing), then down to 1.00:1 on a phone (the cable runs showing through its letters with only a halo behind them).
- **Checks:** `tools/drive.mjs` SB-J6 (three businesses, the whole job through the page: the limits, the cabinet's button and
  tab, the plan's words, the switch's `show port-security` and `show ip dhcp snooping`, a cable laid at the rack with the
  door shut refused in words, Open the door refused when locked, every line met, the plan and the router's tab after, a
  reload); nine states in `tools/aaa-states.json`; `tools/wip/sb6page.mjs` screenshots the page.
- **Plants:** 27 Node plants for SB-J6 in `tools/plants-business-node.py` (the job's causes, the cabinet, the engine, the
  page's refused power-cycle, the transport fix); 6 page plants in `tools/plants-business-page.py`.
- **Found by the plants:** the plant tool never ran `tests/business-sb6.test.js` (an edit to its run list built the change
  and never wrote it), so every SB-J6 plant came back missed with no failing test; the list now has it.

**Going live (the owner, 1 November 2026: "Go live when checks pass").** Found and fixed on the way:
- **The business PC's test page**: since SB-J2 staff print through the router, and "Print a test page" counted only a
  printer on the PC's own network, so it said nothing printed on every business while the work order's check said printing
  worked (live since stage 1; no drive ever pressed it). It now says what the check says, and still says nothing printed when
  the router can't get the page there (`printTest` in `js/net/sim.js`; tested both ways, failing on the old code).
- **The camera picture's LIVE** measured 6.33:1 on a phone with easier reading on (the wider font reached the edge of its
  white plate). The plate is bigger and LIVE is held to 36 units on it (`textLength`). The live site's own copy passed the
  same state, so it sat at the margin; both camera-page states pass.
- **Two SB-J5 states** that open a camera's window now wait for its 3D view to settle: under load one combination in eight
  read a heading while the first frame drew (1.71:1); alone they passed.
- **Totals before going live:** `npm test` 361 of 361; `node tools/drive.mjs` in full 3,936 checks (the SB-J5 drive alone
  125, after the test page and badge changes); `node tools/models.mjs` 202 of 202; AAA on painted pixels, all 216 states and
  528,064 text runs passing (the SB-J3, SB-J5 and SB-J6 states on the branch, the other 187 in four parts on a
  snapshot of it); plants: 27 Node and 6 page for SB-J6, all caught.

**The order from here, set by the owner on 1 November 2026: "Keep building everything in order of increasing in
size."** Smallest first, as sized that day from what the engine already had: SB-J6 finished and live; SB-J7, the
provider's fixed address (a static outside address and a default route, both already in the router's command line);
SB-J8, the printers' VLAN (a VLAN, a subinterface, the printer's panel and the PCs' printer port, all there already);
SB-J9, the router rebuilt from its backup (a replacement router, and the router copying a file in over TFTP, which only
the switch does today); SB-J10, a new department end to end (new devices, a VLAN, a pool, kept apart); the 15 tickets (no
business tickets exist yet: the Ticket Desk for the business first, then each ticket, smallest first); Level 4 (Campus);
Level 5 (Enterprise). Each piece still has its objectives shown and its details talked out with the owner before it's
built. Numbered in the order they go live, so students never see a gap (the plan of 19 October listed them without
numbers): until then these notes called the fixed address SB-J10 and the new department SB-J7.

**The owner's answers, 1 November 2026, after the SB-J6 preview** (the work order, the cabinet's Physical tab open and
locked, the latch, the plan's frame): SB-J6 **"Go live when checks pass"**. For SB-J10, the objectives shown (Network+
IPv4 addressing: public vs. private, subnetting, CIDR; routing technologies: static routing, NAT, PAT; troubleshooting
routing issues: default routes, incorrect gateway/IP/subnet mask) and the lines proposed (the router's provider port gets
the fixed address and mask from the provider's letter; a default route to the provider's gateway for that block; everyone
still online through PAT, printing still works; both cameras open from the manager's phone at the fixed address; saved;
built as SB-J7, on `save/level3-stage6`):
- **At the start: "Still online"**: switch-over day; the old changing address works until the technician moves the router.
- **The letter: "CIDR only, e.g. /29"**: the student works out the mask by hand (the subnetting-by-hand rule).

### Level 3, SB-J7: the provider's fixed address (built 1 November 2026, on `save/level3-stage6`)

Built after SB-J6 and goes live after it (stage 6 merges into `main` once stage 5 is there).
- **The records** (`addFixedLine` in `js/net/business.js`, its own random stream `seed ^ 0x7f10`, so every business before it
  comes out as it always has): a /28, /29 or /30 from 192.0.2.0/24 (the documentation range); the provider's gateway is the
  block's first or last usable address, the business's address another usable one. Set on `isp.fixed` and `plan.fixed`
  (`ip`, `len`, `mask`, `gw`, `net`, `bcast`). The limits give the block in CIDR only, never the mask.
- **The simulation** (`js/net/sim.js`): the router's provider side (`rtWan`) carries its address and gateway, by DHCP or set
  by hand; a default route only goes out to the provider if it's DHCP's or its next hop is the provider's gateway
  (`wanHopOk`); NAT translates to whatever address that port has (`publicIp`). From outside (`fromInternet`): the fixed
  address reaches nothing until the router has it (`notyet`); once moved, the old address reaches nothing (`old`); an answer
  needs a way back out (`back`).
- **SB-J7** (`js/build/business.js`), 5 lines: the provider port has the letter's address (causes: shut, still DHCP, none,
  the gateway's address typed as the router's, the block's network or broadcast address, another address, the wrong mask);
  the way out is a default route to the provider's gateway (none: an address set by hand brings no route; the old gateway,
  which isn't on the block so never goes in the table; a next hop on no network; the port named instead of the gateway; a
  next hop in the block that isn't the gateway; set but not in the table yet; in the table but no internet); both cameras
  open from the manager's phone at the fixed address (not yet, the provider side down, no way back, no forward); everything
  still works (staff, printing, guests, the access point's page, the cabinet locked again if opened); the router saved.
  `already`: still, saved. The walk-through works over SSH from the manager's PC (SB-J6 let the staff VLAN in); the console
  in the cabinet also passes, as long as the cabinet is locked again with its key taken away.
- **Realistic on the way:** the block's network address typed with the block's mask is refused at the router ("Bad mask /29
  for address"), as on the real thing; typed with a /24 it's taken, and the line says what's wrong.
- **The page:** the diagram labels the business router by its inside address, never its provider side (`subOf` leaves out the
  port whose link goes to the modem), so the fixed address set by hand doesn't take over the router's label.
- **Checks:** `tests/business-sb7.test.js` (4 tests, 25 businesses: as found, the tempting wrong ways, the other right ways,
  checking changes nothing); `ONLY=business JOB=SB-J7 node tools/drive.mjs` 59 checks on three businesses (the letter in the
  limits with no mask, the phone before and after, SSH from the manager's PC, tracert through the provider's gateway, both
  drawings in both fonts, a reload); 5 AAA states in `tools/aaa-states.json`; Node plants 10 (all caught); page plants 3.

**Going live (the owner, 8 November 2026, after the SB-J7 to SB-J9 preview: "Go ahead with SB-J7").**
- **Totals before going live**, run on a snapshot of this branch: `npm test` 365 of 365; `node tools/drive.mjs` in full 3,990
  checks; `node tools/models.mjs` 202 of 202; AAA on painted pixels, all 221 states and 546,254 text runs passing (in four
  parts; SB-J7's own 5 states 16,124 runs); page plants 3 of 3 caught (`python3 tools/plants-business-page.py SB-J7`).
- **Two plants had drifted off their code** (each must match its file exactly once before a plant run): SB-J6's "the
  walk-through never renews the staff PCs" (SB-J6's solve now turns the guest phone's Wi-Fi off and on where it used to
  rejoin) and the page plant "SB-J4: the back switch has no device button" (the device order has had the cabinet since
  SB-J6). Re-aimed and run again, both caught: the first fails two tests; the second stops the SB-J4 drive when the
  device's tray can't be found, rather than at a named check.

### Level 3, SB-J8: the printers' VLAN (built 1 November 2026, on `save/level3-stage7`)

The lines shown to the owner on 1 November 2026, with the Network+ objectives they draw on (VLANs and inter-VLAN routing,
IPv4 addressing, ACLs, troubleshooting incorrect IP/gateway): the printers' VLAN on the closet switch named as the records
say; the printer's port in it; the router's subinterface as its gateway; the printer's fixed address on its control panel;
staff print at the new address (the reception PC's printer port changed, the back PC reaches it); guests can't reach the
printers (the guests' list needs a line); everything still works (ARP inspection on the printers' VLAN would break the fixed
address); router and closet switch saved. Goes live after SB-J7.
- **The records** (`addPrinterVlan` in `js/net/business.js`, nothing random, so every business before it is unchanged): the
  printers' VLAN from the business's VLAN set (50, 55, 150 or 65), named PRINTERS, on 10.<site>.<vlan>.0/24 with its gateway
  .1; the printer's fixed address on it keeps its host number (`plan.printerIp`).
- **The story:** the card company's follow-up letter asks why the printer still shares a network with the switches and the
  access point. Moving it opens a hole on purpose: the guests' list (SB-J3) denies the staff network and the old network,
  then permits everything, so the printer's new network is open to guests until a line goes in ahead of that permit.
- **SB-J8** (`js/build/business.js`), 9 lines: `pvlan` (none, its name: a VLAN made by putting the port in it is named
  after its number); `pport` (not on the closet switch, shut, not an access port, still in the old VLAN or another, its
  description); `psub` (none, on the wrong port, the wrong tag, the wrong address, down, the trunk to the router not
  carrying it); `pfixed` (DHCP, the old address, another address, the mask, the gateway: blank, the old network's, or
  another); `pprint` (the printer not at its new address yet, ARP inspection dropping it, the reception PC can't reach it,
  its printer port still naming the old address, the back PC, the manager's PC); `pguest`, judged on the list in on the
  guests' subinterface for raw printing (9100), IPP (631), the web page (443, 80) and ping, to the printer and to another
  address on its network (no list applied, a missing list, a deny below the permit that never matches, no line at all,
  some of the traffic stopped, the printer stopped but not its network); `still` (staff, guests, the access point's page,
  both cameras from outside at the fixed address, the cabinet); both saves. `already`: still, saved, swsaved.
- **The walk-through** works from the manager's PC over SSH: the closet switch at its management address (across the
  router, new with SB-J8), then the router, where the guests' line goes in as `35 deny ip <guests> <printers>`; then the
  printer's control panel and the reception PC's Printers tab.
- **Named access lists take sequence numbers** (`js/net/rtcli.js`), as on the real thing: `35 deny ...` in a named list's
  mode goes in by its number (a number already used: "% Duplicate sequence number"), `no 40` or `no <the line>` takes one
  out, the other lines keep their numbers and their match counts (`aclSeqs`, `freezeSeqs`, `shiftHits`), `show
  access-lists` prints the numbers and the configuration doesn't. A line typed with no number goes in ten after the last.
  The parser matches a number against a `<a-b>` entry (`match` in `js/net/swcli.js`); `?` lists it as "Sequence Number";
  Tab leaves a number as typed. Permit, deny and remark now take abbreviations in a named list's mode.
- **SSH and Telnet cross the business router** (`js/net/cmd.js`): before, they reached only a device on the PC's own
  network. They're routed now, judged by the router's lists as TCP 22 and 23, so an access list can stop SSH and still let
  ping through (tested).
- **Checks:** `tests/business-sb8.test.js` (6 tests: as found and solved, with the visitor's phone reaching the printer when
  the line is missing and not when it's there; 20 tempting wrong ways, each failing its own line; other right ways: the
  list's last line taken out and put back after the deny, any source, a subinterface numbered its own way, the panel first,
  the closet switch's console with the cabinet locked again after; checking changes nothing; sequence numbers; SSH across
  the router). `tests/business-jobs.test.js` covers SB-J8 in its shared tests (the printers' VLAN's name and number added to
  what no hint may say; its own random walk lines and printer actions). `ONLY=business JOB=SB-J8 node tools/drive.mjs`: 47
  checks on three businesses (the test page before and after, `show access-lists` read back with 35 between 30 and 40,
  the printer's panel, the diagram's new address, both drawings in both fonts, a reload). 7 AAA states; 5 page plants.
- **Node plants: 16, all caught.** Two were missed at first, and each showed a gap in the tests, both closed: a hint naming
  the printers' subinterface (`GigabitEthernet0/1.150`) passed the no-giveaway test, which banned `vlan 150` and `dot1Q 150`
  but not the number after a subinterface's dot (now banned for every VLAN, on every business job); and a line taken out of
  a list renumbering the rest passed, because the test only took lines out after an insert had already fixed every number
  (it now takes one out of a list whose numbers were never fixed).

**Going live (the owner, 8 November 2026: "Go ahead with SB-J8").**
- **A wording fix first, from the preview:** a café's brief said "Reception prints all day". The brief, the printing line's
  evidence and rung 1, and the answer now name the business's own front PC (the reception, till or counter PC, `name(sim,
  "pc")`) and its back PC. SB-J1's "Every PC is online" line had the same fixed words ("The reception, manager's and
  back-of-house PCs") and takes the PCs' names too.
- **Totals before going live**, run on a snapshot of this branch: `npm test` 371 of 371; `node tools/drive.mjs` in full 4,032
  checks; `node tools/models.mjs` 202 of 202; AAA on painted pixels, all 228 states and 573,198 text runs passing (in four
  parts); its 5 page plants and 16 Node plants caught when it was built.

### Level 3, stage 8: SB-J9, the router rebuilt from its backup (talked out 2 November 2026, live 9 November 2026)

The Network+ (V9) objectives were read from the owner's doc on 2 November 2026 (the Network+ section unchanged) and shown
with the lines proposed: Network operations ("Configuration management: production, backup, baseline configurations";
"Disaster recovery: ... MTTR ... and testing"; "Access and management: ... SSH ... console"), Network security ("device
hardening ... key management"), Network troubleshooting (the methodology). Lines proposed: the replacement racked in the
closet cabinet with your laptop on its console; it runs the backup line for line (factory, in startup but never reloaded,
a part not as the backup has it); SSH from a staff PC works again (keys never travel in a file); everyone back online,
guests apart, the printers on their VLAN; both cameras from the manager's phone at the fixed address; saved, your laptop
unplugged, the cabinet locked again with its key away.

**The owner's answers, 2 November 2026:**
- **The backup: "Current"**: taken right after the printers' VLAN went in; the lesson is the restore itself, and the
  keys a file never carries.
- **The failure: "Its power supply"**: the old router died overnight, its lights dark, and it won't power on.
- **The restore: "Either way passes"**: copied into the running configuration and saved, or copied into startup and
  reloaded, as on SO-J6; a copy into startup never reloaded is caught.

**What was built** (2 November 2026, on `save/level3-stage8`):
- **The failure** (`addRouterFailure` in `js/net/business.js`, its own random stream `seed ^ 0x9b01`, so every business before
  it is unchanged): the router's saved configuration becomes the backup on your laptop's TFTP server, under the router's own
  name (`<hostname>-confg`), with the write in the server's log; the server stopped. The manager's PC remembers the old
  router's key (`knownHosts`, as the office's front desk PC does in SO-J6). The dead router's cables are pulled; the
  replacement is the same model with a hardware address and a unit of its own, so its keys differ, boxed; the cabinet stays
  locked with its key with the manager. `plan.backup` holds the name and the text.
- **SB-J9** (`js/build/business.js`), 8 lines: `rack` (SB-J1's: in its box, no console, not seated); `cabled` (the modem and
  the closet switch on the ports the backup sets up: the modem missing or in another port, the switch missing, in another
  router port, or in a switch port that isn't the trunk); `restored` (factory, in startup and never reloaded, a part not as
  the backup has it, named by `rtSectionOf`: "interface Gi0/0", "the access list GUEST-IN", "the DHCP pool ..."); `ssh` (the
  manager's PC can't reach it, no keys, short keys, the lines, the old key remembered); `back` (staff online and printing,
  guests online and kept apart, the access point's page); `remote` (both cameras at the fixed address, with "still in its
  box" first); saved; `tidy` (your laptop's network cable out, then the cabinet's three causes). `already`: tidy.
- **The real behaviour the job teaches:** a merge into the running configuration never opens a port (a running
  configuration prints `shutdown` for a shut port and nothing for an open one, and a router's ports come shut from the box),
  so after `copy tftp: running-config` the provider's port and the inside port stay shut and the line names them; copied
  into startup and reloaded, every interface the file names comes up. Answering yes to "save?" before the reload saves the
  factory settings over the file. The temporary address on the laptop's port goes when the file is applied (the file shuts
  that port and clears its address).
- **Your laptop's address by hand**: a router fresh from its box hands out nothing, so the laptop needs a fixed address on
  the port it's cabled to. Its new **Network settings** tab is the PCs' (the Edit IP settings form, no speed test), and its
  Command Prompt takes Windows' `netsh interface ipv4 set address name="Ethernet" static <address> <mask> [gateway]`
  (also `address/prefix`, `none`, and `source=dhcp`), with Windows' own errors for a wrong name or mask (`netshAddress` in
  `js/net/cmd.js`; in Help).
- **Fixed for every level:** `no shutdown` on the console was answered before the links were worked out again, so a cabled
  port read as down (since SB-J1, every cabled router port opened said "changed state to down"). The console now syncs after
  the command and reports a port that came up as up, with its `%LINEPROTO-5-UPDOWN` line (`linkNews` in `js/net/cmd.js`;
  `portUp` in `js/net/swcli.js`). A port with nothing plugged in still says down.
- **Checks:** `tests/business-sb9.test.js` (5 tests, 12 businesses: as found and solved, the backup current with the
  printers' subinterface in it; 13 tempting wrong ways; other right ways: the merge with each port opened by hand, the
  address by netsh, another network for the transfer; checking changes nothing; the laptop's tab, netsh and the link
  message). The shared tests cover SB-J9 (the backup's name in what no hint may say; its own random walk lines and
  actions). `ONLY=business JOB=SB-J9 node tools/drive.mjs`: 62 checks on three businesses (the cabinet refusing the router
  while locked, the TFTP tab listing the backup, the address set in the laptop's Network settings, `[OK - n bytes]`, the
  reload, the manager's PC's changed-key warning with its fingerprint matched to `show crypto key mypubkey rsa` on the
  console, SSH asking for the password after, a test page, both drawings in both fonts, a reload). 13 Node plants, all
  caught (the plant tool takes `TESTS="..."` to run just the tests named), 3 page plants, 6 AAA states.
  - A first plant (the replacement given the old router's keys by taking away its unit number) was missed: the replacement
    has a hardware address of its own and the key is made from it too, so the plant never planted what it named. It now
    makes the replacement a copy of the old router (its hardware address, no unit of its own), and is caught.

**Going live (the owner, 8 November 2026: "Go ahead with SB-J9"; 9 November: "Go ahead with SB-J9 when checks pass").**
Found and fixed on the way:
- **A page plant missed:** "the TFTP server tab lists no files" passed the drive, which looked for the backup's name
  anywhere in the tab, and the server log names it too. The drive now reads the files-received list (`ul.tfiles`); the
  plant fails that check, and SB-J9's drive passes it (62 checks).
- **SB-J9's contrast states, measured for the first time**, failed two:
  - at SB-J9's start the old router is gone, the cabinet's frame holds only the closet switch, and its label, at the
    frame's middle, fell behind the switch's tile (6.25:1). The label now sits just above the lowest device's tile.
  - part way, the router-to-switch run is down and its diamond, halfway, sat on "Business router" and the cabinet's label
    (1.08:1). A down-run diamond (`js/desk/draw.js`) now starts halfway and slides along its run to the first spot clear
    of every name, label, tile and diamond; on a run covered end to end it takes a spot clear of the words, on a tile's
    edge. Where halfway is clear it stays, so no other plan changes. Both states fail on the old code and pass now.
- **The first full drive** stopped once, "SB-J4 2025: page.click: Timeout 5000ms exceeded", at a load average of 11 on 4
  cores; SB-J4's drive alone then passed 80 of 80. After the plan fix the whole drive was run again: 4,089 checks, clean.
- **Totals before going live**, run on a snapshot of this branch after the plan fix: `npm test` 376 of 376; `node
  tools/drive.mjs` in full 4,089 checks; `node tools/models.mjs` 202 of 202; AAA on painted pixels, all 234 states and
  595,244 text runs passing (in four parts); page plants 3 of 3 caught.

### Level 3, stage 9: SB-J10, a new department, end to end (talked out 2 November 2026, live 9 November 2026)

The Network+ (V9) objectives read from the owner's doc on 2 November 2026 and shown: Network implementation (switching:
"VLANs, interface configuration"; routing: "NAT, PAT ... subinterfaces"), Networking concepts ("IPv4 addressing: ...
subnetting (VLSM, CIDR)"), Network operations ("Network services: DHCP", "Documentation: ... IPAM", "Change management:
request process tracking"), Network security ("Network segmentation: ... guest, and BYOD", "Security features and defense:
device hardening ... ACL ... trusted vs. untrusted zones", "Logical security: ... least privilege, role-based access
control"). Lines proposed: the department's two PCs out of their boxes, in their room, cabled to the records' switch ports;
its VLAN on both switches and the trunk between them carrying it (added to, not replaced); their ports access, described,
port-secured as SB-J6 set the staff PCs', out of the parking VLAN; the router's subinterface as their gateway, NAT and a
pool of their own; snooping and inspection on the new VLAN; kept apart as the records say, printing and online; everything
else still works; all three devices saved.

**The owner's answers, 2 November 2026:**
- **The department: "Each business its own"**: the vet clinic's pharmacy, the dental practice's billing office, the
  bakery's office, the physio clinic's billing desk, the bike shop's parts desk, the bookshop's office.
- **Where: "A new room"**: a small room added to the floor plan, off the back room, its runs to the back switch.
- **Kept apart: "Only the manager's PC"**: guests and the other staff are kept off the department's PCs; the department
  still prints and gets online. An access list on the department's own subinterface, and the manager's PC given a fixed
  address so the list can name it.
- **Its subnet: "A block to work out"**: the records give a smaller block in CIDR only (a /27 for up to 30 devices, say),
  as the provider's letter did in SB-J7, so the mask, the gateway and the pool's range are worked out by hand.

**As built (2 November 2026, on `save/level3-stage9`):**
- **Where it starts:** SB-J9 done, then you come back with your laptop and its cables (SB-J9's first line keeps the laptop on
  the router's console, so SB-J10's `start` takes its cables away, as a technician arriving for a new job), then
  `addDepartment` (`js/net/business.js`, a stream of its own): each business's department from `DEPARTMENTS` (the vet's
  pharmacy, the dental billing office, the bakery's office, the physio billing desk, the bike shop's parts desk, the bookshop's
  office), its room `dept` off the back room (on the plan below it, `BUSINESS_ROOM_BOX.dept`, a door in the back room's wall;
  runs: 8 m from the back room), its VLAN from the business's VLAN set (`dept`), a /26, /27 or /28 inside
  10.<site>.<vlan>.0 that is never the first block, its gateway the first usable address; the two PCs in their boxes in the
  back room, for the back switch's ports 3 and 4 (parked by SB-J6), their descriptions from their names; the list's name
  (`<VLAN name>-ACCESS`); the manager's address, `.7`, `.8` or `.9` of the staff network (inside the ten the staff pool
  keeps back, so nothing else is ever handed it).
- **The router's reservations (new):** a DHCP pool takes `host A.B.C.D [mask|/len]` (no mask: the address's class mask, as
  on IOS), `client-identifier H.H.H` and `hardware-address H.H.H`, each with `no`; a pool is a network or a host, never both.
  `manualFor` (`js/net/rtcli.js`) matches a binding on the client identifier a client sends, 01 (Ethernet) then its MAC
  (`clientIdOf`): a hardware-address binding is for clients that send none (BOOTP), so it never matches a Windows PC, as on
  the real thing. What a binding doesn't set comes from the network pool its address falls inside; a binding wider than that
  pool (the class mask) inherits nothing. `rtOffer` in `js/net/sim.js` gives a bound client its address and nothing else.
  `show ip dhcp binding` now lists every client by the client ID it sent (`01aa.bbcc.ddee.ff`), a reservation as Infinite,
  Manual; `show ip dhcp pool` and the running configuration show host pools as IOS does.
- **Fourteen lines:** the PCs placed and cabled (`dplace`); the VLAN on both switches, named, the trunk carrying it added to,
  not replaced (`dvlan`); the ports open, access, in the VLAN, out of parking, described (`dport`); port security as the staff
  PCs' (`dpsec`); the subinterface with the block's first address and mask (`dsub`: the habit's /24, the last address, the
  network or broadcast address are causes of their own); the department's pool (`dpool`: a whole /24, another block, the
  habit's .1 as gateway, no DNS, a pool matching no subinterface, an in-list stopping requests, snooping dropping answers);
  printing and online (`dnet`: a lease from before the pool was put right, no NAT inside, NAT's line missing, with the mask
  for the wildcard, or covering part of the block, the list's unseen deny stopping replies, inspection where nothing is
  snooped, a lease from before snooping, the printer's replies stopped); snooping and inspection on the back switch
  (`dguard`); the manager's reservation (`mgrip`: set by hand and dropped by inspection, no reservation, by hardware address,
  the MAC without 01, another identifier, another address, the class mask, not renewed, the wrong gateway); only the manager
  in (`dapart`: judged on every list a packet meets there and back, for file sharing, remote desktop and ping, to the PCs and
  to either end of the block; no list, a missing list, another name, the list in, the staff denied above the manager, staff
  or guests let in all or some ways, a list naming the two PCs not the block, the manager not at the address the list names);
  everything still works, now including snooping and inspection still guarding the staff and guest VLANs (`still`); the
  three saves. The records give the block in CIDR and never its mask, gateway, wildcard or broadcast.
- **Other right ways that pass:** the list in on the subinterface judging what the department sends back; guests kept off by
  a numbered line in their own list; the reservation's mask as a prefix; NAT's line for every 10. network of the site;
  snooping and inspection on the closet switch too.
- **The page:** the new room on the plan (taller, `viewBox` to 660) once the records add it; the two PCs on the diagram in a
  column of their own left of the back switch (the diagram widens to the left, `-176 -26 1012 716`, once either is out of its
  box), so their lines cross nothing; on the plan, their runs come down either side of the back PC. Both PCs have device
  buttons, their own windows (Command Prompt, Network settings, Web browser) and the PC's 3D model.
- **Checks:** `tests/business-sb10.test.js` (as found on 25 businesses with the records checked, the router's bindings, the
  binding table, 34 tempting wrong ways each failing its own line plus the block's network and broadcast refused as the gateway,
  five other right ways); the shared tests take SB-J10 in
  (the ladder, no help naming the department's VLAN, block, list, ports, descriptions or the manager's client ID, its random
  walk, replay and undo): 16 of 16. `tools/drive.mjs` has an SB-J10 block (three businesses, through the page); nine AAA
  states; 28 Node plants and 4 page plants written.

**From the save point to going live (2 to 9 November 2026).**
- **The three things the first drive found**, changed at the save point, were driven again and pass: the department's PCs
  answer pings (`echo: true`, their firewalls opened for it, as the records say), "Dispensing PC" sits inside the diagram
  (x -90, the `viewBox` from -180), and the PCs' names no longer collide on the plan.
- **The floor plan relaid (8 November 2026).** The department's room is `dept: [800, 520, 980, 770]` (plan `viewBox` height
  765), its first PC up at the right under the door (910, 580) and its second lower and to the left (880, 700). With the room
  there, the back switch (785, 360), the back PC (895, 315) and your laptop carried to the back room (925, 435) have spots of
  their own (`dept` in `BUSINESS_LAYOUT`). Found by scoring layouts on all six businesses, both fonts, at the start, with the
  PCs cabled and done: no run under a device it doesn't join, no name (with its plate) on a wall, a tile or another name.
- **A check for it in the page drive** (`planRunsClear`, `planBothFonts` in `tools/drive.mjs`): measured as painted, sampling
  along each run, at SB-J10's start, with the PCs cabled and done, in both fonts. Seven older problems, live since SB-J5 and
  waiting for the owner's word, were listed in `OLD_PLAN` and skipped. Calibrated: 86 pass on the new layout, 12 fail with the
  first PC put back straight above the second (now a page plant).
- **Plants:** Node 28 of 28 caught (26, and the two hint plants through `tests/business-jobs.test.js`); the anchors listed at the
  save point were lengthened or re-aimed first (SB-J6's sticky and restrict, SB-J10's "late", the walk-through's renew, the
  SB-J4 laptop's spot). Page 5 of 5 caught. One, the department's PCs left out of the page's device list, was first caught
  only by the drive stalling in the Place form; the drive now checks by name that the Place form offers both PCs and that
  each has a device button once out of its box (9 November 2026).
- **The preview** (https://claude.ai/artifact/Dh189hwGd2kZUhPzbncGLw): the work order and its limits, the room, the terminals,
  the reservation trap with Mason's third rung, both drawings in both fonts, the floor plan before and after.

**Going live (the owner, 9 November 2026: "Go ahead with SB-J10 when checks pass and dont get stuck this time").**
- **On its own branch** (a snapshot of `save/level3-stage9` with SB-J9's plan fix merged in): `npm test` 381 of 381;
  `node tools/drive.mjs` in full 4,170 checks (SB-J10's own block 92 with the two new checks); `node tools/models.mjs` 202 of
  202; page plants 5 of 5 caught; AAA on painted pixels, 242 of the 243 states passing. **The one that failed:** "SB-J10 a
  department PC's Command Prompt" (the bike shop, business 4242), where the back switch's run to the parts PC, bowed as every
  run then was, touched the end of the department room's name "PARTS DESK" (6.04:1). Putting the name at the room's foot on
  the old drawing moved the problem (the second PC's run then passed under "Pharmacy PC"); the floor plan fix below routes
  every run off the rooms' names and has the name at the room's foot already.
- **So SB-J10 goes live together with the floor plan fix** ("Yes, fix all fourteen", the same day; its before/after preview:
  https://claude.ai/artifact/WsTvgRyN2iKxUVu9VonJsf), from `save/level3-plan-fix` with `save/level3-stage9` merged in, after
  the whole set of checks passed on that: see "Level 3: the business floor plan fixed" below.
- **Still to raise with the owner:** the instructor PIN is written in this public repo's `CLAUDE.md` and in `tools/drive.mjs`,
  and Pages serves both, so a student could read it; it was there before SB-J6. Removing it from the files and choosing a new
  PIN (the old one stays in the history) is the owner's call.

### Level 3: the business floor plan fixed (live 9 November 2026, with SB-J10)

The owner, 9 November 2026: **"Yes, fix all fourteen"**: the fourteen kinds of problem a scan of every business work order
found on the floor plan (six businesses, the start and the finish of SB-J1 to SB-J10, both fonts): runs under a device they
don't join (its tile or its name), names on walls, "Closet switch" on "Provider's router", the cabinet's label on a wall or
on the closet switch's tile. 1,476 counts in all; the cabinet's label on the switch's tile went live fixed with SB-J9, which
left 13 kinds and 1,464 counts on the plan as SB-J10 went live. After the fix: none, counted the same way.
- **Each business run finds its own way** (`routeRuns` in `js/desk/draw.js`, the business only; the house and the office are
  unchanged). Before, every laid run was a fixed bow between its two devices. Now the devices and their names are drawn first,
  then each run takes the least bent of 441 cubic curves (`CURVES`: the run pushed aside a third and two thirds of the way
  along, by up to 170 units either way) that passes under no other device's tile or name (with 5 units round each and the
  plate), stays on the plan, keeps off the rooms' names, doesn't run along a wall (crossing one at a shallow angle is some
  way beside it; beyond 70 units counts as along it), keeps off the cabinet's label unless it joins two things the cabinet
  holds, and doesn't run beside a run already laid. The shortest runs are laid first, so a console cable or a run inside one
  room goes straight and the long ones find their way round it. The routes found for a layout are kept (`ROUTES`), so the
  plan redrawn after every action costs about 4 ms; working them out the first time, about 60 ms. A down run's diamond sits
  halfway along its route.
- **A bigger network closet:** `BUSINESS_ROOM_BOX.closet` `[30, 30, 360, 420]` (it was `[30, 30, 300, 370]`), the counter and
  the waiting area starting at 360, the entrance under the closet down to the front wall (`businessRooms` and `businessNames`
  follow the closet's box: the entrance, its door into the waiting area and its name). The closet's two columns at 115 and
  280, its rows at 105, 225 and 345: "Business router", "Closet switch" and the cabinet's label clear of its walls in either
  font, and room for a run from the left column to pass between the right column's devices (at rows 100 apart there were
  about 10 units, and the ceiling camera's run had to run along the waiting area's wall to get out).
- **The cabinet's label is kept inside the closet** whatever its state says ("LOCKED, KEY IN" is the longest).
- **The back room from SB-J4 on is laid out as SB-J10 first had it:** the back switch low on the left (785, 360), under the
  room's name so the trunk comes in below it; the back PC up on the right (895, 315); your laptop, carried there, low on the
  right (925, 435). Placed afresh, the laptop took the trunk's only way in. Nothing moves when the department's room appears.
- **Small moves:** the back door camera's injector to (740, 455), off the back room's wall and clear of the back PC's name;
  the access point to (450, 400), opening the way into the waiting area under its name; the reception PC to (430, 130), clear
  of the closet's new wall; the department's second PC to (880, 680); the department's room's name at its foot, since its runs
  come in at the top of a room too narrow to keep them off a name there.
- **The drive** (`tools/drive.mjs`): `OLD_PLAN` is gone, nothing is skipped. `planRunsClear` now also fails a run under a
  room's name, a run along a wall for more than 80 units away from its ends, and the cabinet's label on a wall. A new section,
  "every business work order's floor plan" (`JOB=plans`), checks every business work order at its start, with the cabinet's
  key in its lock (where the work order puts it in) and at its finish, on six businesses (seeds 1, 2, 3, 4, 5, 10: one of
  each), in both fonts: 263 checks.
- **Plants** (each in a throwaway copy, through `JOB=plans`): 9 written. Caught: the runs bowed as before (252 checks fail), the closet at its old size (252), the
  cabinet's label not kept inside the closet (12, with the key in its lock), the back door camera's injector back on the wall
  (144), the room round names and tiles taken away (252), a room's name hiding a run costing nothing (252), running along a
  wall costing nothing (158), the department's room's name back at its head (12); and the plan as it was before the fix (252).
  Missed: your laptop placed afresh in the back room. With the back switch and the back PC where they now are, it lands at
  (890, 418), clear, beside its own spot (925, 435), so nothing fails; its own spot is kept so it always sits where SB-J10 has
  it, whatever the search finds first. `tools/wip/planall.mjs` on the final code: 0 problems of any kind (1,464 before).
- **Going live (the owner, 9 November 2026: "Go ahead when checks pass Please fix everything", then "keep going push it
  all. I will make changes after going through it").** Pushed at the owner's word while the full checks were still running
  on a snapshot of this branch (25a4beb, SB-J10 merged in). Passed before the push: the drive's every-plan check (263 checks);
  `tools/wip/planall.mjs`, 0 problems of any kind; the plants above, 8 of 9 caught; the contrast state that failed on SB-J10's
  own branch, passing on the combined code (3,448 text runs); and SB-J10 on its own branch: `npm test` 381 of 381, the full
  drive 4,170 checks, the 3D models 202 of 202, its page plants 5 of 5. Still running at the push, on the combined code,
  and all passing since: `npm test` 381 of 381; the full page drive 4,434 checks; the 3D models 202 of 202; SB-J10's page
  plants 5 of 5; and all 243 contrast states on painted pixels (in four parts of about 61; a worker restart stopped parts 3
  and 4 part way, and their remaining states were run on their own).
- `tools/wip/` (not part of the site): `planall.mjs` (scores the plan as built, or candidate layouts through a `__layTry`
  hook added to `pos()` in a scratch copy, on every business work order, start and finish, both fonts, counting every kind of
  problem; a candidate that names no closet width keeps the closet as built), `planshot.mjs` (the plan screenshotted at chosen
  points, for previews).

### Level 3: the business Ticket Desk and SB-01, the wrong VLAN on a port (built 9 November 2026, on `save/level3-sb01`)

The owner, 9 November 2026: **"Yes to all five, keep going"**, to the plan for the business's tickets: (1) each starts from
the business as SB-J10 leaves it, nobody logged in, the fault typed in and saved by whoever caused it; (2) the business's
records on every ticket card; (3) "Tier 3 · Small business" on the queue, the shelves and the map, locked until the small
office is finished, the level still being built until all 15 exist; (4) smallest first: wrong VLAN on a port, deleted VLAN,
VLAN off the trunk, the pool's wrong gateway, the wrong default route, NAT inside and outside swapped, a VLAN left out of NAT,
native mismatch, a trunk that never forms, the wrong tag on a subinterface, the printer's address handed out, a pool run out,
an access list that blocks everything, one applied the wrong way, VLAN hopping; (5) live one at a time, each after its own
checks. Objectives read 9 November 2026 (Network+ V9 unchanged).
- **`js/tickets/business.js`.** `settled(seed)`: SB-J10 started and solved, then frozen as a ticket keeps its moment (no
  logins, the TFTP server closed, `extra.build` off). `onSwitch(sim, id, lines)` types the fault at a switch, privileged.
  `businessRecords(v, sim)` is the card's records: the router (SSH from a staff PC at the staff gateway; its console in the
  locked cabinet, the key with the manager), the closet switch (SSH at its address), the back switch (at its console, your
  laptop on its console cable in the back room, where SB-J10 leaves it), the enable secrets, the console passwords, the SSH
  login, the printer, and the VLAN plan a row each (staff, guests, cameras, printers, the department, native, parking,
  VLAN 1). A ticket can replace them with `records(v, sim)`. `BUSINESS_TICKETS`, `BUSINESS_COMING`.
- **SB-01, "One staff PC can't print or reach the others".** The counter PC's port (gi0/1 on the closet switch) put in
  another VLAN and saved, three ways, each with its own story in the brief:
  - **guest:** the card-machine company setting up their terminal on the guests' network. The PC gets a guest's address:
    online, but kept off the printer and the staff, as every guest is.
  - **parking:** the manager working through the card processor's checklist, typing the spare ports in from the list with
    port 1 among them (`interface range gi0/1 , gi0/4 , gi0/7 - 22`). 169.254, nothing works.
  - **cameras:** the camera company in the closet. 169.254 (the cameras' list stops anything else asking for an address).
  - The board: the right answer and five near misses (a fixed address on the wrong network, the staff pool run out, the trunk
    no longer carrying staff, port security, and the guests' list blocking it or a faulty cable), each with the evidence that
    rules it out. Evidence: ipconfig and ipconfig /all on the PC, no reply from the printer, the internet answering (guest),
    `show interfaces status`, `show interfaces gi0/1 switchport`, `show vlan brief`, `show running-config`, the router's
    `show ip dhcp binding` (guest).
  - **Fixed** when the port is an access port in the staff VLAN, running and saved, the PC on a staff address from DHCP,
    online and reaching the printer, the manager's PC still online, and every spare port still parked and shut. Unsaved,
    spares unparked, or not the records' way: Mason says which. **Proof:** a ping from the PC to the printer that gets
    replies, or a test page; the internet proves nothing (a guest reaches it before the fix).
  - Hints never name a VLAN number, a password, the port or the fix's commands.
- **The desk** (`js/desk/app.js`, `left.js`, `levels.js`, `levelsui.js`): Level 3's `tickets` are `BUSINESS_TICKETS`, its
  `coming` "more tickets on the way" (every work order is built); "0 of 1 ticket" in the singular; the queue's tier "Tier 3 ·
  Small business · tickets"; the shelves' Small business group (locked until the small office is finished); the map's small
  business site lists its tickets; the title and the card say small business and business network; the business's own
  device buttons (`BIZ_DEVICES`; a device still in its box has none). The lock panel and build mode's done box say what the
  level has coming (`L.coming`).
- **The ticket engine** takes the business pages' actions: `joinssid`, `apnet`, `radio`, `cabinet` (replayed with the rest).
- **Found and fixed on the way:**
  - The desk's floor plan was drawn while hidden behind the logical diagram, where nothing can be measured, and never drawn
    again once shown: the business's runs were routed round nothing (the drive's run check: five runs under names on SB-01).
    `setView` now draws both drawings again whichever is shown, as build mode does.
  - A ticket's plan was drawn from the layout's fixed spots, so your laptop, on the back switch's console in the back room,
    was drawn in the closet with its console cable across the plan. A business ticket now places each device where the work
    orders put it, as build mode draws it (`planSpots`).
  - The desk plated the floor plan's names without the cabinet's label: "CABINET: LOCKED" at 1.00:1 (AAA). It now plates
    `.cabl` as build mode does.
  - **Step through crashed** on a ping across the business router to a network nothing answers on (found writing SB-02: the
    printers' VLAN taken out of the closet switch). `route()` gives `no-reply` with no device for it, and the trace read the
    device's name off it. It now steps to the router's unanswered ARP (`trace` in `js/net/cmd.js`); a test in
    `tests/business-sim.test.js` fails without the fix. Could have been met in live build mode (SB-J8, the printers' VLAN not
    yet on the trunk). Switch and router output also say which device printed it now (`facts.on`).
- **Checks:**
  - `tests/business-tickets.test.js` (30 businesses; a business takes half a second to build): the fault in the commands
    themselves, the board, the real fix and proof, seven tempting wrong fixes (a renew, restarts, a staff address typed in,
    every spare unparked with it, another wrong VLAN, the port bounced), unsaved, proof before the fix and the internet
    proving nothing, the ladder, exact replay (an SSH session, the visitor's Wi-Fi off, the manager's phone joining the guests'
    network, the cabinet's key), no hint naming a VLAN, a password or a command, and the records carrying every login, each
    one tried (SSH to the switch and the router, your laptop's console on the back switch).
  - `ONLY=tickets-business node tools/drive.mjs`: SB-01 on four businesses (every variant), every step through the page, the
    logins read off the card; both drawings in both fonts, your laptop drawn in the back room; the lock for a student still
    on the small office; the queue, card, title, records, device buttons, shelves and map. 159 checks; a business ticket must open on the business asked for (a fault that didn't show would move it to the next business, and every variant could quietly become one: a plant did exactly that and passed until this check).
  - AAA: 7 states (the card and its records, SSH from the manager's PC, the board at rung 3, solved, the floor plan, the
    shelves, the map), all passing; the floor plan's state failed first ("CABINET: LOCKED" 1.00:1, above) and passes since. `tools/aaa.mjs` now exits 1 when anything fails (it always exited 0, its verdict only in its last line).
  - `python3 tools/plants-business-tickets.py` (in a throwaway copy): 27 plants (14 page, 11 Node, 2 contrast), all caught. The
    first run caught 23; each of the 4 it missed showed a gap, closed and run again:
    - SB-01's fault planted on the wrong port: every ticket quietly fell back to the one variant still showing a fault (a ticket
      moves to the next business when its fault doesn't show). Now the drive's "opens on the business asked for" check.
    - every spare port unparked accepted: the test's wrong fix also moved the printer's port, so it failed for that and the
      spare-port check was never reached. The wrong fix now touches the spares alone.
    - the cabinet's label without its plate, the records' passwords faint: both states failed, but `tools/aaa.mjs` always
      exited 0 and the plant script read the exit code. The tool now exits 1 on a failure, and the script reads the verdict.
  - **Totals before going live** (on a snapshot of this branch, 78413a3's code): `npm test` 391 of 391; `node tools/drive.mjs` in full 4,597 checks; AAA on every Ticket Desk state (the desk's floor plan changed for every site), 95 states and 190,709 text runs, and the 10 scrolled states (2,687 runs), all passing. Build mode's states weren't run again: nothing it draws changed.
- `tools/wip/` (not part of the site): `sbt.mjs` (the business as SB-J10 leaves it, with commands typed and faults planted),
  `sb01.mjs` (SB-01 end to end in Node), `sbtpage.mjs` (a business ticket on the desk: its card, buttons and screenshots).

### Level 3: SB-02, a VLAN deleted after the weekend (built 9 November 2026, on `save/level3-tickets`)

Second of the 15, smallest first, live on its own after its own checks (the owner: "Yes to all five, keep going"). The
tickets after it are built on `save/level3-tickets` and go live one at a time from a tree staged off `main` with the later
ones cut out (`python3 tools/wip/stage.py N DEST`: each later ticket's section of `js/tickets/business.js`, its drive plan,
its contrast states; shared code goes live with the first ticket that needs it).
- **SB-02, "Part of the business went dark after the weekend".** Someone tidying a switch deleted a VLAN "that wasn't being
  used", and saved. Its ports stay assigned to it and go inactive, and the trunks stop carrying it, as on the real thing.
  Three ways, each with its own story in the brief:
  - **staff, on the back switch:** a work-experience student tidied it; the back PC (the only staff port there) restarted on
    Monday and sits on 169.254, while the department's PCs beside it are fine.
  - **printers, on the closet switch:** the student who helps out took out "leftovers"; nobody prints, everyone is online.
  - **guests, on the closet switch:** the manager following the card processor's checklist; no access port there is in the
    guests' VLAN (it rides the trunk to the access point), so it looked unused. Visitors join and get 169.254.
  - The board: the right answer and five near misses (the port moved to another VLAN, the trunk no longer allowing it, the
    port shut, the router's subinterface shut, and the staff pool run out, the printer's address changed or the guest
    password changed), each with the evidence that rules it out. Evidence: ipconfig on the back PC, the phone's 169.254, a
    test page or a ping to the printer failing, `show vlan brief` without it, `show interfaces gi0/N switchport` ("Access
    Mode VLAN: N (Inactive)"), `show interfaces status` ("connected unassigned"), `show interfaces trunk` (allowed, not
    active), `show running-config` (ports set for a VLAN the switch doesn't have).
  - **Fixed** when the VLAN is back on its switch with the records' name, running and saved, every VLAN each switch had still
    there, and whoever lost it back (the back PC on a staff address from DHCP, every staff PC printing, or the visitor online
    on a guest address). Back with the switch's own name for it (`VLAN0020`, made by assigning a port or by `vlan N` alone),
    unsaved, or with another VLAN lost on the way: Mason says which. **Proof:** a ping from the back PC past itself, a test
    page or a ping to the printer, or the visitor's phone online (its Wi-Fi off and on, or its Wi-Fi page saying the internet
    is reached).
  - The ticket opens on the device that lost its network (`affected` can now be worked out from the ticket's variant).
- **Found and fixed on the way:** the fix asks for the VLAN named as the records name it, and the card's VLAN plan never gave
  a name: only each VLAN's number, block and gateway. The drive typed the name from inside the simulation, so it passed
  (written and reachable are different claims). Each VLAN row on the card now gives its name ("20 · named STAFF · ..."), on
  every business ticket; the records test checks every VLAN's name is there, the drive types the name it reads off the card,
  and a plant leaving the names off fails both.
- **Shared code going live with it:** a phone's Wi-Fi switched on now reports its address and whether it reaches the internet
  (the engine's `radio` facts), so turning it off and on proves the guests' fix; `js/desk/app.js` takes `affected` as a
  function.
- **The plants file stays whole:** a plant names its ticket ("SB-05: ..."), and a plant whose ticket isn't on the desk yet is
  skipped and said so. Shared-code plants carry the name of the ticket whose checks catch them.
- **Checks** (on the staged tree, SB-01 and SB-02 only):
  - `tests/business-tickets.test.js` (30 businesses): the fault in the commands themselves (the VLAN missing from
    `show vlan brief`, its port inactive and unassigned, a trunk still allowing it), the board, the real fix and proof, six
    tempting wrong fixes (a renew alone, a power cycle, the VLAN back with the switch's own name, made on the other switch,
    the trunk told to carry it, back with the parking VLAN lost on the way, back and saved with nothing asked again), unsaved, proof before the fix, the ladder, exact
    replay, no hint naming a VLAN, a password or a command.
  - `ONLY=tickets-business node tools/drive.mjs`: SB-01 and SB-02 on every variant through the page, the VLAN's name typed from
    the card, Step through on the printers' variant (the router's ARP for the printer unanswered): 294 checks.
  - AAA: 4 SB-02 states (the back switch's console, the visitor's phone with no address, the card and the refused test page,
    solved) with SB-01's and the desk's business states: 11 states, 29,878 text runs, all passing.
  - `python3 tools/plants-business-tickets.py SB-02` (in a throwaway copy): 12 plants (5 page, 7 Node), all caught. The first
    run caught 10; each of the 2 it missed showed a gap, closed and run again:
    - the VLAN put back unsaved: the plant took out one of two guards ("every VLAN each switch had, saved" covers the VLAN
      too), so it's aimed at both.
    - the back PC left on 169.254 accepted: no wrong fix put the VLAN back without the device asking again. Now one does.
  - **Every variant on every run:** each ticket lists its variants (`kinds`), and the tests add a business for any variant
    their seeds miss (a ticket picks its variant first, from the seed alone, so it's found without building anything). The
    plant script runs the tests on 6 businesses, and that had left a variant of SB-03, SB-06, SB-09 and SB-10 untried.
  - **Totals before going live** (on the staged tree): `npm test` 398 of 398; `node tools/drive.mjs` in full 4,728 checks; the
    business tickets' 11 contrast states; SB-02's plants 12 of 12.
- `tools/wip/`: `sb02.mjs`, `sb02run.mjs` (SB-02 end to end in Node), `stage.py` (above).

### Level 3: SB-03, a VLAN left off a trunk (built 9 November 2026, on `save/level3-tickets`)

Third of the 15, live on its own after its own checks, staged as SB-02 was (`tools/wip/stage.py 3`).
- **SB-03, "Some things stopped working, others right next to them didn't".** A trunk on the closet switch no longer
  carries a VLAN, and saved; every VLAN is still on both switches. Three ways, each with its own story:
  - **back:** the company that set up the department came back to check their work and typed the department's VLAN onto the
    trunk to the back switch without `add` (`switchport trunk allowed vlan <dept>` replaces the list). The back PC and the
    back door camera go dark; the department's PCs beside them don't.
  - **ap:** the manager, from the card processor's checklist ("ports carrying only what they need"), tidied the access
    point's trunk down to VLAN 1. Visitors join and get 169.254; the access point's light stays blue.
  - **router:** a nephew's hardening checklist gave the router's trunk a list of its own, every VLAN in use but the printers'.
    Nobody prints; everything else works, the internet too.
  - The board: the right answer and five near misses (the VLANs deleted, a native VLAN mismatch, the trunk stopped trunking,
    a port or the access point's network moved to another VLAN, and the back switch failed, the guest password changed or
    the printer's address changed), each with the evidence that rules it out. Evidence: the back PC's 169.254 and the
    department's PC still replying, the phone's 169.254, a test page or a ping to the printer failing, `show interfaces
    trunk` (the port's allowed list), `show vlan brief` (every VLAN still there, active), `show running-config` (the
    port's `switchport trunk allowed vlan` line).
  - **Fixed** when the trunk carries what it lost again and nothing it didn't carry before (the router's trunk carried every
    VLAN, so every VLAN in use), running and saved, and whatever lost its network is back. `allowed vlan all` on the back's
    or the access point's trunk works and isn't the fix (it carries VLANs the far end has no use for, the guests' included);
    unsaved isn't either: Mason says which. **Proof:** a ping from the back PC past itself, the visitor's phone online, or a
    test page or a ping to the printer.
- **Checks** (on the staged tree, SB-01 to SB-03):
  - `tests/business-tickets.test.js` (30 businesses): the fault in the commands themselves, the board, the real fix and its
    proof, the tempting wrong fixes (a renew, a power cycle, the list replaced again with only what was lost, SB-02's fix of
    making the VLANs again, the native VLAN changed, `allowed vlan all`, the back switch's end added to when it carries them
    already), unsaved, proof before the fix, the ladder, exact replay, no hint naming a VLAN or
    the trunk's command.
  - `ONLY=tickets-business node tools/drive.mjs`: every variant through the page; the VLANs to add read off the card's VLAN
    plan. SB-01 to SB-03 and the desk's business checks: 413 checks.
  - AAA: 3 SB-03 states (`show interfaces trunk` over SSH, the department's PC printing beside the dark back PC with the
    notebook, solved) with the business tickets'
    others: 14 states, 38,666 text runs, all passing.
  - `python3 tools/plants-business-tickets.py SB-03` (in a throwaway copy): 5 plants (2 page, 3 Node), all caught. The first
    run caught 4: the one missed (the department left off the back trunk) took out one of two guards, the department online,
    while "the trunk carries everything it did before" covers it too. It's aimed at both now, and caught.
  - **Totals before going live** (on the staged tree): `npm test` 405 of 405; `ONLY=tickets-business node tools/drive.mjs`
    413 checks; the 14 contrast states; the plants 5 of 5. Only `js/tickets/business.js` changes on the site, and only the
    business tickets read it, so the full drive waits for the next stage that changes shared code (SB-05).
- `tools/wip/sb03run.mjs`: SB-03 end to end in Node.

### Level 3: SB-04, a DHCP pool handing out the wrong gateway (built 9 November 2026, on `save/level3-tickets`)

Fourth of the 15, live on its own after its own checks, staged as the others are (`tools/wip/stage.py 4`).
- **SB-04, "Devices restarted this morning can't get past their own network".** A pool on the router hands out the wrong
  default router, and saved. Devices that asked since take it: their own VLAN works (the router's own address on it answers),
  nothing past it does. Devices that didn't ask again are fine, which is the clue in the brief. Three ways:
  - **staff:** a nephew "tidying the address settings" gave the staff pool the old flat network's gateway (copied from the LAN
    pool above it) or the network's last address. The counter's PC and the back PC, off over the weekend, can't get online or
    print; the manager's PC, never turned off, is fine.
  - **dept:** the department's company, checking their work, gave its pool the first address of the whole /24 instead of its
    own block's. Its two PCs lose the internet and the printer after their weekly restart.
  - **guest:** a friend gave the guests' pool the network's last address. Phones join, connect, and get no internet.
  - The board: the right answer and five near misses (the router's address on the VLAN changed, the trunk no longer carrying
    the VLAN, NAT no longer translating it, the wrong DNS servers, the pool run out), each with the evidence that rules it
    out. Evidence: `ipconfig` on a PC that restarted (the wrong gateway, from DHCP), a ping to the router's own address on
    its VLAN replying and one past it failing, the phone's Wi-Fi page (connected, no internet), `show running-config` on the
    router (the pool's `default-router`).
  - **Fixed** when every pool's default router is as it was, running and saved, and the devices that restarted have asked
    again and have the right gateway, from DHCP, and are online. A device that hasn't asked again, unsaved, or a gateway
    typed in on the PC: Mason says which. **Proof:** a device that restarted reaching the printer or the internet, or the
    visitor's phone online.
- **Checks** (on the staged tree, SB-01 to SB-04):
  - `tests/business-tickets.test.js` (30 businesses, every variant): the fault in the commands themselves, the board, the real
    fix and its proof, the tempting wrong fixes (renews, the router restarted, the pool put right with nobody asking again,
    the DNS changed instead, the router's own address moved to the wrong gateway, the gateway typed in on each PC), unsaved,
    proof before the fix, the ladder, exact replay, no hint naming the pool's commands.
  - `ONLY=tickets-business node tools/drive.mjs`: every variant through the page, the router reached over SSH from the
    manager's PC with the logins off the card, the gateway read off the card's VLAN plan. SB-01 to SB-04 and the desk's
    business checks: 566 checks.
  - AAA: 3 SB-04 states (`ipconfig` on a PC that restarted with the router's own address answering, the router's DHCP pools
    over SSH, the visitor's phone connected with no internet) with the business tickets' others: 17 states, 47,504 text runs,
    all passing.
  - `python3 tools/plants-business-tickets.py SB-04` (in a throwaway copy): 6 plants (2 page, 4 Node), all caught on the first
    run.
  - **Totals before going live** (on the staged tree): `npm test` 412 of 412; `ONLY=tickets-business node tools/drive.mjs` 566
    checks; the 17 contrast states; the plants 6 of 6. Only `js/tickets/business.js` changes on the site.
- `tools/wip/sb04run.mjs`: SB-04 end to end in Node.

### Level 3: SB-05, the router's default route wrong (built 9 November 2026, on `save/level3-tickets`)

Fifth of the 15, live on its own after its own checks.
- **SB-05, "Nothing gets out to the internet; everything inside still works".** Everything inside works, VLAN to VLAN, the
  printer too; nothing gets out, and the cameras can't be seen from outside. Three ways:
  - **slip:** the provider's engineer, on the phone, read out numbers to type: the default route's next hop is another usable
    address on the provider's block, misheard.
  - **inside:** a nephew decided "the way out should point at our own network" and pointed the default route at the old flat
    network's last address.
  - **removed:** the manager, working through the card processor's checklist, took out a line they didn't recognise: no default
    route at all ("Gateway of last resort is not set").
  - The board: the right answer and five near misses (NAT no longer translating, the provider port's fixed address lost, the
    provider's line down, DNS unreachable, an access list dropping internet traffic), each with the evidence that rules it
    out. Evidence: a ping to the internet failing and one to the printer replying, `tracert` stopping after the router,
    `show ip route` (the gateway of last resort) against the provider's letter on the card, `show running-config`.
  - **Fixed** when the router has exactly one default route, to the provider's gateway from the card, running and saved, and
    the PCs get online and still reach the printer. The right route left beside the wrong one, a route through another
    gateway, or unsaved: Mason says which. **Proof:** a ping or a `tracert` from a staff PC reaching the internet.
- **Shared code going live with it:**
  - **The provider's gateway answers a ping**, from the router and through it (found writing SB-05: a student checking the
    line from the router was told it was dead, though everything routed through it worked). `routeBR` and `routeFromRouter`
    in `js/net/sim.js`; a test in `tests/business-sim.test.js` fails without it.
  - **The provider on the card:** a row with the fixed address and its block, the provider's gateway and DNS servers (the
    letter from SB-J7), on every business ticket.
- **Checks** (on the staged tree, SB-01 to SB-05):
  - `tests/business-tickets.test.js` (30 businesses, every variant): the fault in the commands themselves, the board, the real
    fix and its proof, the tempting wrong fixes (the router restarted, the provider port bounced, another wrong next hop
    added, a route out of the inside port, the right route added beside the wrong one), unsaved, proof before the fix (a
    `tracert` to the router itself proving nothing), the ladder, exact replay, no hint naming the route.
  - `ONLY=tickets-business node tools/drive.mjs`: every variant through the page, the provider's gateway read off the card and
    pinged from the router. Run as part of the full drive (below).
  - AAA: SB-05's 3 states (`tracert` stopping at the router with the provider's letter on the card, `show ip route` with
    no gateway of last resort, solved) with the business tickets' others: 20 states, 57,794 text runs, all passing.
  - `python3 tools/plants-business-tickets.py SB-05` (in a throwaway copy): 7 plants (3 page, 4 Node), all caught.
    Two Node plants were missed at first. A `tracert` to the router itself counted as proof went uncaught because no test
    ever ran one: the proof test now runs a `tracert` to the PC's own router, for every ticket. The right route left beside
    the wrong one counted as fixed was hidden by a second guard (the PCs are offline too: the router uses the first of two
    equal routes), so that plant now takes both.
  - **Totals before going live:** `npm test` 420 of 420; the full drive 5,128 checks (every level, the business tickets
    SB-01 to SB-05 among them); the 20 contrast states; the plants 7 of 7. On the site, `js/tickets/business.js` and
    `js/net/sim.js` change.
- `tools/wip/sb05run.mjs`: SB-05 end to end in Node.

### Level 3: SB-06, NAT's inside and outside the wrong way round (built 9 November 2026, on `save/level3-tickets`)

Sixth of the 15, live on its own after its own checks (15 November 2026).

- **SB-06, "The internet is down, but the router itself can still reach it".** Nothing that needs translating gets out, while
  everything inside works and the router itself still reaches the internet (its own traffic needs no translating). Three ways:
  every interface's role swapped (from a forum post calling the provider's side "inside, where the internet comes in"); the
  provider port marked inside as well (the line copied onto it); or the staff subinterface marked outside (the wrong line
  copied when it was edited), so only the staff are cut off.
  - The board: the right answer and five near misses, each with the evidence that rules it out. Evidence: a ping to the
    internet failing from a PC and succeeding from the router, `show ip nat translations` empty, `show ip interface brief`
    and `show running-config` (each interface's `ip nat inside` or `outside`) against the records.
  - **Fixed** when every interface's NAT role is as the records have it, running and saved, and the PCs get online; part of
    the roles put right, a role given to the printers' subinterface that it never had, or unsaved: Mason says which.
    **Proof:** a ping from a staff PC reaching the internet.
- **Checks** (on the staged tree, SB-01 to SB-06):
  - `tests/business-tickets.test.js` (30 businesses, every variant): the fault in the commands themselves (a ping out failing
    from a PC and succeeding from the router, each interface's NAT role in `show running-config`), the board, the real fix
    and its proof, the tempting wrong fixes (the router restarted, NAT's list widened to `permit any`, the provider port
    bounced, only part of the roles put right, the printers' subinterface given a role it never had), unsaved, proof before
    the fix, the ladder, exact replay, no hint naming the NAT commands.
  - `ONLY=tickets-business node tools/drive.mjs`: every variant through the page: 814 checks, and 814 again after
    the container was rebuilt on 15 November 2026 with a newer browser (Chromium 1243 at `/opt/pw-browsers/chromium`; the
    tools take `CHROME=` for it).
  - AAA: SB-06's 2 states (the router reaching the internet itself with its NAT translations, the board at rung 3 with the
    notebook) with the business tickets' others: 22 states, 64,506 text runs, all passing.
  - `python3 tools/plants-business-tickets.py SB-06` (in a throwaway copy): 4 plants (1 page, 3 Node), all caught.
  - **Totals before going live:** `npm test` 427 of 427; the drive 814 checks; the 22 contrast
    states; the plants 4 of 4. Only `js/tickets/business.js` changes on the site.

### Level 3: SB-07, a VLAN left out of NAT (built 9 November 2026, on `save/level3-tickets`)

Seventh of the 15, live on its own after its own checks (15 November 2026).

- **SB-07, "One group of devices can't reach the internet; the others can".** The router's NAT list (access list 1, the
  networks to translate) no longer matches one VLAN: rebuilt from an older copy of the records without the department's block;
  the guests' line "tightened" to the network's own address (wildcard 0.0.0.0); or the staff line retyped with a digit
  dropped. That VLAN's devices get addresses and work inside, and never reach the internet; the others are fine.
  - Evidence: the VLAN's ping to the internet failing while another VLAN's succeeds, `show access-lists 1` and
    `show running-config` against the card's VLAN plan (every network and its block, so each wildcard is worked out by hand).
  - **Fixed** when the list matches every network it did and nothing it didn't, running and saved; `permit any` (it would
    translate the printers and the cameras too), the wrong line left beside the right one, or the list taken away: Mason
    says which. **Proof:** a ping to the internet from that VLAN, or the visitor's phone online.
- **Checks** (on the staged tree, SB-01 to SB-07):
  - `tests/business-tickets.test.js` (30 businesses, every variant): the fault in the commands themselves (that VLAN's ping to
    the internet failing while another's succeeds, `show access-lists` with no line for its network), the board, the real fix
    and its proof, the tempting wrong fixes (the router restarted, `access-list 1 permit any`, the subinterface's NAT role set
    again though it was right, the list taken away, the right line added with the wrong one left in), unsaved, proof before
    the fix, the ladder, exact replay, no hint naming the list's command.
  - `ONLY=tickets-business node tools/drive.mjs` (on the newer browser): every variant through the page: 934 checks.
  - AAA: SB-07's 2 states (`show access-lists` over SSH with NAT's list missing one network, solved) with the business
    tickets' others: 24 states, 71,360 text runs, all passing.
  - `python3 tools/plants-business-tickets.py SB-07` (in a throwaway copy): 4 plants (1 page, 3 Node), all caught. One, "a
    list that permits anything counts", missed at first: it looked for the words `permit any`, which the router keeps as
    `0.0.0.0 255.255.255.255`, so the planted defect never fired. Re-aimed at that, it's caught.
  - **Totals before going live:** `npm test` 434 of 434; the drive 934 checks; the 24 contrast states; the
    plants 4 of 4. Only `js/tickets/business.js` changes on the site.

### Level 3: SB-08, a native VLAN mismatch on the back trunk (built 9 November 2026, on `save/level3-tickets`)

Eighth of the 15, live on its own after its own checks (15 November 2026).

- **SB-08, "The back room's link carries everything but one network".** One end of the trunk between the closet switch
  (gi0/23) and the back switch (gi0/24) has its native VLAN changed from the records' unused one to a VLAN in use: the back
  switch's end set to the staff VLAN, the closet's end set to the staff VLAN, or the closet's end set to the department's.
  That VLAN goes dark in the back room; the others, still tagged, carry on.
  - **Shared code going live with it:** each switch's console logs the mismatch it hears from its neighbour,
    `%LLDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch discovered on GigabitEthernet0/24 (n), with <switch>
    GigabitEthernet0/23 (m).`, once a session (`nativeLog` in `js/net/cmd.js`), as the real thing does: the clue a student
    reads first, at your laptop on the back switch's console.
  - Evidence: the PCs on 169.254, the console's log, `show interfaces trunk` at both ends (each end's native VLAN) against
    the card's native VLAN.
  - **Fixed** when both ends' native VLAN is the card's, running and saved, and the PCs that lost their network asked again
    and are online. Matching the other end to the changed one works and carries a VLAN in use untagged, which the records
    forbid: Mason says so. **Proof:** a PC that lost its network reaching the printer.
- **Checks** (on the staged tree, SB-01 to SB-08):
  - `tests/business-tickets.test.js` (30 businesses, every variant): the fault in the commands themselves (the back room's
    PCs on 169.254 in that VLAN while the other VLAN on the same trunk still works, the back switch's console logging the
    mismatch, `show interfaces trunk` at both ends; an SSH session isn't sent the console's log), the board, the real fix and
    its proof, the tempting wrong fixes (renews alone, the switch restarted, the other end matched to it, the native VLAN put
    back to 1 rather than the records' unused one, the allowed list, the port bounced), unsaved, proof before the fix, the
    ladder, exact replay, no hint naming the native VLAN command.
  - The full drive (`node tools/drive.mjs`, every level, on the newer browser): 5,496 checks, the business tickets SB-01 to
    SB-08 among them.
  - AAA: SB-08's 2 states (the back switch's console logging the mismatch with `show interfaces trunk`, solved) with the
    business tickets' others: 26 states, 78,274 text runs, all passing.
  - `python3 tools/plants-business-tickets.py SB-08` (in a throwaway copy): 5 plants (2 page, 3 Node), all caught: the mismatch never logged on the console, the other end matched to it counted, the native VLAN put back unsaved counted, a hint naming the native VLAN command, and SB-08 left off the desk.
  - **Totals before going live:** `npm test` 441 of 441; the full drive 5,496 checks; the 26
    contrast states; the plants as above. On the site, `js/tickets/business.js` and `js/net/cmd.js` change.

### Level 3: SB-09, the trunk between the switches never forms (built 9 November 2026, on `save/level3-tickets`)

Ninth of the 15, live on its own after its own checks (15 November 2026).

- **SB-09, "Everything in the back room is off the network at once".** Both ends put back to negotiate (dynamic auto, "the
  factory setting": two ends that only answer never trunk), the closet's end made an access port (a desk's settings pasted
  onto the wrong port), or the back switch's end made one. Every VLAN in the back room goes dark at once: the back PC, the
  department's PCs, the back door camera.
  - Evidence: `show interfaces trunk` at both ends (the link isn't trunking), `show interfaces gi0/2x switchport`
    (administrative and operational modes), `show interfaces status` (the link connected in a VLAN, not trunk).
  - **Fixed** when both ends are set to trunk outright, running and saved, and the back room is online. An end left on
    dynamic desirable makes the trunk form and isn't the records' way (a port left to negotiate can be talked into trunking
    by whatever is plugged into it): Mason says so. **Proof:** a back room PC reaching the printer or the internet.
- **Checks** (on the staged tree, SB-01 to SB-09):
  - `tests/business-tickets.test.js` (30 businesses, every variant): the fault in the commands themselves (the back room's
    PCs on 169.254, an end of the link running as an access port in `show interfaces switchport`, the back switch's own ports
    still up, out front still working), the board, the real fix and its proof, the tempting wrong fixes (renews alone, the back
    switch restarted, both ends left negotiating (dynamic desirable: it trunks, and isn't the records' way), only the end that
    was right already set, the allowed list on a port that isn't a trunk, the ports bounced), unsaved, proof before the fix,
    the ladder, exact replay, no hint naming the mode command.
  - `ONLY=tickets-business node tools/drive.mjs` (on the newer browser): every variant through the page: 1,180 checks.
  - AAA: SB-09's state (the back switch's end of the link: `show interfaces switchport` and status) with the business
    tickets' others: 27 states, 82,278 text runs, all passing.
  - `python3 tools/plants-business-tickets.py SB-09` (in a throwaway copy): 4 plants (1 page, 3 Node), all caught: an end left negotiating counted, the trunk put back unsaved counted, a hint naming the mode command, and SB-09 left off the desk.
  - **Totals before going live:** `npm test` 448 of 448; the drive 1,180 checks; the 27 contrast states;
    the plants as above. Only `js/tickets/business.js` changes on the site.

### Level 3: SB-10, a router subinterface tagged for the wrong VLAN (built 9 November 2026, on `save/level3-tickets`)

Tenth of the 15, live on its own after its own checks (15 November 2026).

Tenth of the 15 ("the wrong tag on a subinterface"), live on its own after its own checks.
- **SB-10, "One part of the business lost its way through the router".** The address on each of the router's
  subinterfaces is right; the tag decides which VLAN hears it. Three ways, each with its own story:
  - **printers:** a nephew learning networking retyped the printers' subinterface "to check he understood it", with the tag a
    digit off (ten times it, a tenth of it, or its digits reversed, never a VLAN in use), and typed the address in again after
    it. Nobody prints; everything else works, the internet too.
  - **guest:** the same to the guests' subinterface, by someone "just reading" the guest settings. Visitors join and get
    169.254; the access point's light stays blue.
  - **swap:** the company that set up the department wiped the department's and the guests' subinterfaces by mistake and typed
    both back from their notes with each other's tags. The department's PCs, after their weekly restart, get guests' addresses
    (online, behind the guests' access list, no printer); a visitor's phone gets an address in the department's block.
  - **Why never the staff VLAN:** with the staff subinterface on the wrong tag no PC could reach the router to fix it (its
    remote lines take only the staff VLAN, and its console is in the locked cabinet). Found designing the ticket; the
    variants keep the manager's PC's way in.
  - The board: the right answer and five near misses (the trunk no longer carrying the VLAN, the VLAN deleted, the
    subinterface shut, the router's address on the VLAN changed, and the printer's address changed, the guest password
    changed or the access point moving the guest network), each with the evidence that rules it out. Evidence: the test page
    and the internet, the phone's 169.254, the department PC's guests' address, the phone's address in the department's
    block, `show interfaces <subinterface>` ("Vlan ID") or `show running-config` (`encapsulation dot1Q`) against the card's
    VLAN plan, the closet switch's `show interfaces trunk` (the VLAN allowed and active to the router), the router's
    `show ip interface brief` (every subinterface up and up on its address).
  - **Fixed** when every subinterface has its tag, address and mask as before, running and saved, and whatever lost its
    network is back (every PC printing; the visitor online on a guests' address; the department's PCs on their own block,
    printing, and the visitor on a guests' address). A new tag clears a subinterface's address (as on the real thing), so the
    fix is the tag and the address; in the swap one tag must be freed first (the router refuses a tag another subinterface
    still has). Unsaved, or a device still holding the address it was given: Mason says which. **Proof:** a test page or a
    ping to the printer, the visitor's phone online, or a department PC reaching the printer.
- **Checks** (on the staged tree, SB-01 to SB-10):
  - `tests/business-tickets.test.js` (30 businesses, every variant): the fault in the commands themselves (`show ip interface
    brief`, `show interfaces` on every subinterface, `show running-config`, the switch's trunk), the board, the real fix and its
    proof, the tempting wrong fixes (renews, the router restarted, the tag back with no address, the trunk told to carry the
    wrong tag, the subinterface bounced, the address back on the wrong mask; in the swap the department's put right and the
    guests' left untagged, both right and nothing asked again, the department asked again and the visitor's phone not, the tag
    refused while the other subinterface has it), unsaved, proof before the fix, the ladder, exact replay, no hint naming a
    VLAN, an address or the commands (`encapsulation dot1q`, `ip address`, `no encapsulation` on the hint test's list).
  - `ONLY=tickets-business node tools/drive.mjs` (on the newer browser): every variant through the page, each VLAN's tag,
    gateway and block read off the card, the subinterface found by its address in `show ip interface brief`: 1,299 checks.
  - AAA: SB-10's 3 states (the router over SSH, a department PC on a guests' address with Mason's third rung, solved) with the
    business tickets' others: 30 states, 92,790 text runs, all passing.
  - `python3 tools/plants-business-tickets.py SB-10` (in a throwaway copy): 6 plants (1 page, 5 Node), all caught: a tag put back unsaved counted, a subinterface with its tag back and no address counted, the visitor left with the department's address counted, a hint naming the fix's command, SB-10 left off the desk, and any ping to the printer proving the swap. That last one missed at first: no test had a device the fault never touched (a staff PC, which always reached the printer) try to prove the department's fix. The proof test now has the counter's PC and the manager's PC ping the printer after the swap is fixed, and it's caught.
  - **Totals before going live:** `npm test` 455 of 455; the drive 1,299 checks; the 30 contrast states;
    the plants as above. Only `js/tickets/business.js` changes on the site.

### Level 3: SB-11, a pool with nothing left to lend (built 10 November 2026, on `save/level3-tickets`)

Eleventh of the 15, live on its own after its own checks (15 November 2026).

Built before "the printer's address handed out", which needs a new device in the business: the owner's rule, "Keep building
everything in order of increasing in size". The titles are the owner's; only the order changed.
- **SB-11, "New devices get no address; everything already on carries on".** Three ways:
  - **guest:** the guests' pool set to lend for ever ("so customers never have to join again") the week before a market day;
    every address since lent to a phone that left that afternoon (`show ip dhcp binding`: page after page of "Infinite").
    Today's visitor joins and gets 169.254.
  - **staff:** an exclusion added "for the tablets we'll set by hand" keeps back .11 to .253, leaving one address: the
    counter's PC asked first and took it; the back PC gets 169.254.
  - **dept:** the department's company kept back all but the last address of its block "for the label printers and
    scanners they're adding": one PC got it, the other gets 169.254.
  - Evidence: the 169.254, the PC that asked first still working, `show ip dhcp pool` (the pool's total, leased and
    excluded: nothing left), `show ip dhcp binding`, `show running-config` (the lease, or the added exclusion).
  - **Fixed** when the pools keep back what the router kept back before (the added line taken out, the router's own left),
    the guests' pool lends for a day again and its leases are let go, running and saved, and whatever had no address asked
    again and is online. Let go but still lending for ever, the router's own exclusion taken out instead, or unsaved: Mason
    says which. **Proof:** the visitor's phone online, or the PC that had no address reaching the printer or the internet.
  - Found by the drive: its summary built every variant's sentence at once and crashed on the guests' (no exclusion line).
    Fixed; the tests now build every ticket's summary on every variant, with a plant.
- **Checks** (on the staged tree, SB-01 to SB-11):
  - `tests/business-tickets.test.js` (30 businesses, every variant): the fault in the commands themselves (`show ip dhcp pool`
    with nothing left to lend, `show running-config`, the guests' `lease infinite` and the market's phones lent for ever, the
    added exclusion; a PC on 169.254 while the one that asked first works), the board, the real fix and its proof, the
    tempting wrong fixes (the device asking again alone, the router restarted, the guests' lease set to a day with every
    address still lent, the leases let go with the pool still lending for ever, the exclusion taken out and nothing asked
    again, the router's own exclusion taken out instead, an address typed in on the PC, and on every variant the fix with
    every exclusion the router had taken out as well), unsaved, proof before the fix, the ladder, exact replay, no hint naming
    the pool's commands; the summary built on every variant.
  - `ONLY=tickets-business node tools/drive.mjs` (on the newer browser): every variant through the page: 1,425 checks.
  - AAA: SB-11's 3 states (the router over SSH with nothing left to lend, the visitor's phone with no address and Mason's
    third rung, solved) with the business tickets' others: 33 states, 103,412 text runs, all passing.
  - `python3 tools/plants-business-tickets.py SB-11` (in a throwaway copy): 7 plants (1 page, 6 Node), all caught: SB-11 left off
    the desk, a pool's fix left unsaved, the guests' pool still lending for ever, a hint naming the pool's commands, a ping
    from another PC counted as proof, the summary building every variant's sentence at once, and the router's own exclusions
    taken out as well. That last one was missed at first: no wrong fix in the tests took out the router's own exclusions along
    with the added one, a mistake technicians make. It is now a wrong fix on every variant, and the plant, run again, is caught.
  - **Totals before going live:** `npm test` 462 of 462; the drive 1,425 checks; the 33 contrast states;
    the plants as above. Only `js/tickets/business.js` changes on the site.

### Level 3: SB-12, an access list that blocks far more than it should (built 10 November 2026, on `save/level3-tickets`)

Twelfth of the 15, live on its own after its own checks (15 November 2026).

- **SB-12, "An access list on the router blocks far more than it should".** Three ways:
  - **guest:** the guests' list lost its last line, the guests' network permitted to anywhere, taken out by someone who read
    it as "guests can do anything". Guests get an address (the first line lets DHCP through) and nothing else.
  - **dept:** the department's list lost its last line, `permit ip any any`: only the manager's PC, on its first line,
    still reaches the department, and nothing the department sends gets its answer back in.
  - **printers:** a new list of one deny on the printers' subinterface, written from the card processor's checklist
    "printers must not reach the internet". The implicit deny drops every reply the printer sends; the printers' VLAN was
    never translated, so it could never reach the internet anyway.
  - Evidence: the symptom; `show interfaces <subinterface>` (which list, which way); `show access-lists` read to the end.
  - **Fixed** when every list the router had is as it had it, applied as it had them, running and saved (an unapplied list
    left over does nothing and is let be). A permit put ahead of the denies works and lets through what they were there to
    stop, a printers' list given a permit, or unsaved: Mason says which. **Proof:** the visitor's phone online, a
    department PC reaching the printer or the internet, or a test page.
  - The router answers `show interfaces <subinterface>` (with its access lists), not `show ip interface <subinterface>`:
    the hint and the tests use the one that exists.
- **Going live with it, found by its plants (every ticket):** the plant "guests reaching the printer count as working"
  went uncaught, because no test put the visitor's phone anywhere but the guests' network. A student can: on the access point's
  page, the guests' Wi-Fi with its VLAN left blank puts it on the access point's own network, among the business's own
  devices. Probed on every ticket and variant (15 November 2026):
  - **SB-07 (live) counted it fixed:** the list put right and the guests moved, the phone online among the staff, its internet
    the proof. Its check now wants the phone online on the guests' own network, as the other tickets' do.
  - **Mason's word was wrong on eight variants** (SB-02, SB-03, SB-04, SB-07, SB-10, SB-11, SB-12, SB-13): "it hasn't saved
    it" with the fault still there, "a permit ahead of the denies" when nobody wrote one. On every ticket Mason now says first
    that the visitor's phone isn't on the guests' network (`guestMoved`, `GUEST_MOVED` in `js/tickets/business.js`).
  - A test on every ticket, every variant: the Wi-Fi moved alone, and the real fix with the guests moved first: never fixed,
    and Mason says where the phone is. Two plants (the word left out, SB-07's old check), and SB-12's plant is now caught.
- **Checks** (on the staged tree, SB-01 to SB-12):
  - `tests/business-tickets.test.js` (30 businesses, every variant): the fault in the commands themselves (`show interfaces`
    on the subinterface, which list and which way; `show access-lists` read to the end, no permit to anywhere left last), the
    symptom (the visitor's phone with an address and no internet; the department getting nothing back while the manager's
    PC still reaches it; a test page failing while the internet works), the board, the real fix and its proof, the tempting
    wrong fixes (the list's last line asked for again alone, the router restarted, the permit put first ahead of the denies,
    the list taken off its subinterface, the printers' list given a permit, the printers' list deleted and left named on
    the subinterface), unsaved, proof before the fix, the ladder, exact replay, no hint naming the list's commands; the
    summary built on every variant.
  - `ONLY=tickets-business node tools/drive.mjs` (on the newer browser): every variant through the page: 1,545 checks.
  - AAA: SB-12's 3 states (the router over SSH with the list on the subinterface and `show access-lists`, the visitor's
    phone connected with no internet and Mason's third rung, solved) with the business tickets' others: 36 states,
    114,294 text runs, all passing.
  - `python3 tools/plants-business-tickets.py SB-12` (in a throwaway copy): 8 plants (1 page, 7 Node), all caught: SB-12 left off
    the desk, a list put right unsaved, the permit put ahead of the denies, guests reaching the printer counted as working
    (missed on the first run, before the test of the guests moved onto the business's own network; caught by it), a hint
    naming the list's command, the internet counted as proof of the printers' fix, Mason's word on the phone left out (7
    tickets failing), and SB-07's old check on the phone (SB-07 failing).
  - **Totals before going live:** `npm test` 481 of 481; the drive 1,545 checks; the 36 contrast states;
    the plants as above. Only `js/tickets/business.js` changes on the site.

### Level 3: SB-13, an access list applied the wrong way (built 15 November 2026, on `save/level3-tickets`)

Thirteenth of the 15, live on its own after its own checks (15 November 2026).

- **SB-13, "An access list is on the router, just not where it works".** The lists themselves are right; where and which way
  they face is not. Three ways:
  - **guest-out:** the guests' list turned to face out of the guests' subinterface, so it filters the replies coming back
    to them: guests get an address, from the router itself, and nothing else.
  - **dept-in:** the department's list turned to face in on the department's subinterface: it stops nothing, and the staff
    and guests can reach the department's PCs (the department's owner noticed; everything else works).
  - **dept-staff:** the department's list moved to face out of the staff's subinterface: the same, from the other side.
  - Evidence: the phone with no internet, or the counter's PC reaching a department PC; `show access-lists` (the list
    untouched); `show interfaces` and `show running-config` (where it's applied, which way).
  - **Fixed** when every list is on the interfaces, facing the ways, the router had them, running and saved, and the
    guests are online and kept off the staff, or the staff and guests are kept out of the department and the manager let
    in. The right way added with the wrong one left, the list in on the staff's subinterface (the staff kept out, the
    guests not), or unsaved: Mason says which. **Proof:** the visitor's phone online, or a staff PC's ping to a
    department PC stopped by the router (`kind: "blocked"`).
- **Checks** (on the staged tree, SB-01 to SB-13):
  - `tests/business-tickets.test.js` (30 businesses, every variant): the fault in the commands themselves (`show access-lists`
    with the list untouched; `show interfaces` on the guests', department's and staff's subinterfaces, which way it faces),
    the symptom (the visitor's phone with an address and no internet; the counter's PC reaching a department PC while
    everything else works), the board, the real fix and its proof, the tempting wrong fixes (the list asked for again alone,
    the router restarted, the guests' list taken off altogether, the guests' list in as well with out still on, the list in
    on the staff's subinterface, out on the department's again with the wrong one left, and the lists' own lines changed with
    the fix: the guests' list turned the right way with its line keeping guests off the staff taken out, the department's put
    back where it was without its guests' line), unsaved, proof before the fix (a ping to an address in the department's
    block that nothing answers among it), the ladder, exact replay, no hint naming the
    access-group command; the summary built on every variant; the guests' Wi-Fi moved onto the business's own network.
  - `ONLY=tickets-business node tools/drive.mjs` (on the newer browser): every variant through the page: 1,665 checks.
  - AAA: SB-13's 3 states (the router over SSH with the list's lines and the subinterface it faces, the counter's PC
    reaching the department and Mason's third rung, solved) with the business tickets' others: 39 states,
    125,528 text runs, all passing.
  - `python3 tools/plants-business-tickets.py SB-13` (in a throwaway copy): 6 plants (1 page, 5 Node), all caught: SB-13 left off
    the desk, a list put back unsaved, the wrong way left beside the right way, a hint naming the access-group command, and
    two missed at first. Guests reaching the department counted as working: no wrong fix changed a list's own lines (now one
    does on each variant). Any failed ping counted as the department's proof: after the fix the router stops every such
    ping, and no test pinged an address nothing answers on before it (now one does). Both, run again, are caught.
  - **Totals before going live:** `npm test` 489 of 489; the drive 1,665 checks; the 39 contrast states;
    the plants as above. Only `js/tickets/business.js` changes on the site.

### Level 3: SB-14, the printer's address handed out (built 15 November 2026, on `save/level3-sb14`)

Fourteenth of the 15, live on its own after its own checks (15 November 2026).

The owner's title for it: "the printer's address handed out". Built after SB-13 because it needs a new device (the owner: "Keep
building everything in order of increasing in size").
- **SB-14, "Half of what we print never comes out".** While the printer was away for repair, the supplier set up a label printer
  at the counter, on a closet switch spare (gi0/7, described LABEL-PRINTER, in the printers' VLAN, saved), and it ended up on
  the printer's own address. Nothing noticed while the printer was away: the router checks an address answers before lending
  it, and nothing did. The printer came back on its fixed address, and since then the two take turns answering the router: one
  page prints, the next goes to the label printer ("Windows says the printer is offline"). Three ways:
  - **pool:** a printers' pool the supplier made on the router (PRINTERS) keeps back `.1` up to one short of the printer, so the
    first address it lends is the printer's.
  - **reserved:** the supplier's pool keeps the printer back (`.1` to `.29`), and a reservation (LABEL-PRINTER, the label
    printer's client identifier) gives it "the printers' address from your records" anyway.
  - **static:** the supplier typed the records card's printer address into the label printer by hand.
  - **The label printer is in none of the records and not on the diagram** (nobody told the technician: the records are the
    documentation). It's on the floor plan, at the counter, with a device button and its own control panel.
  - The board: the right answer, the other two ways the label printer could have come by the address (each ruled out by the
    router's bindings, its configuration or the label printer's panel), and three near misses (a duplex mismatch on the
    printer's port, the printer's address changed at the repair shop, the printer's port in another VLAN). Evidence: two test
    pages (one vanishes, the next prints); `show ip arp` on the router after each (the printer's address at one hardware address,
    then the other); `show ip dhcp binding` (Automatic, Manual, or no lease); `show running-config` (the pool and what it keeps
    back, or the reservation); both printers' control panels; `show mac address-table` (two devices in the printers' VLAN) and
    `show interfaces status` (Gi0/7, LABEL-PRINTER) on the closet switch. A ping always replies: both of them answer.
  - **Fixed** when the printer is on its records address and the only device answering there, the router can't lend that
    address (running or saved), the label printer has an address of its own on the printers' network (the printers' mask and
    gateway, nobody else's, reachable), a fixed one outside anything the router lends or a lent one from a pool or reservation
    still there, the router saved, and the counter's PC prints. Any way that leaves it so counts: the kept-back range widened,
    the printer's address excluded, the pool taken away and the label printer set by hand, the reservation moved or removed,
    a proper pool made to lend from. **Proof:** a test page that prints with only the printer answering at its address.
  - Mason says why when pages print but it isn't fixed: the printer moved instead; the label printer unplugged, its port shut
    or left with no address; its fixed address one the pool can lend; the pool still able to lend the printer's address (the
    next time the printer's off); its lease from a pool that's gone; the router not saved.
  - The label printer has no Physical tab: a label printer isn't a model the program has, and models are built from the owner's
    photographs (asked for, 15 November 2026). It asks for an address again when its control panel is saved on DHCP ("The
    printer restarted its network").
- **Shared code going live with it:**
  - **The router's ARP table:** `show ip arp` and `show arp` on the router (`rtArp` in `js/net/sim.js`, read through the router's
    live view): its own address on each interface that's up (no age), then each device it hears on its inside networks, by the
    hardware address that answered last. Two devices on one address take turns, so the entry flips between them. A test in
    `tests/business-sim.test.js` (3 plants caught: the flip ignored, its own addresses left out, `show arp` missing).
  - **A test page across the router to a shared address takes turns** (`printTest`, committed first on this branch), as it
    always did on the PC's own network.
  - **Any printer's control panel and form** (the label printer's), and a printer panel with no address no longer reads the
    provider's router (gone from the business since SB-J2).
  - The floor plan: the label printer at the counter; with it there, the counter's PC and printer move up (`lp` in
    `BUSINESS_LAYOUT`), found by scoring spots on all six businesses in both fonts with the drive's own drawing checks. At the
    first spot tried the trunk to the back switch rerouted under the waiting room's name.
- **Checks** (on the staged tree, SB-01 to SB-14, the branch merged into `save/level3-tickets`):
  - `tests/business-tickets.test.js` (30 businesses, every variant): the fault in the commands (`show ip arp` flipping
    between two hardware addresses, `show ip dhcp binding`, the pool or the reservation in `show running-config`), the board,
    the real fix and its proof, 13 to 17 tempting wrong fixes a variant, unsaved, other right ways, the ladder, replay, no hint
    naming the fix's command; the guests' Wi-Fi moved onto the business's own network; `tests/business-sim.test.js`: the
    router's ARP table.
  - `node tools/drive.mjs` in full (shared code goes live with it), on the newer browser: 6,287 checks.
  - `node tools/models.mjs` (the floor plan and the Physical tab's models): 202 checks.
  - AAA: SB-14's 3 states (the router's ARP and bindings over SSH, the label printer's panel on the floor plan with Mason's
    third rung, solved) with the business tickets' others: 42 states, 136,256 text runs, all passing.
  - `DRIVE_ONLY=SB-14 python3 tools/plants-business-tickets.py SB-14` (in a throwaway copy): 11 plants (5 page, 6 Node), all caught: SB-14
    left off the desk, the label printer left off the floor plan, its device button gone, the router's ARP table never
    flipping, the counter's PC and printer left where they were under the label printer (20 failing checks), the pool left
    lending the printer's address, a fixed address the pool can lend, a lease from a pool that's gone, put right unsaved, a
    page printing with the clash still there counted as proof, a hint naming the pool's command.
  - **Totals before going live:** `npm test` 499 of 499; the full drive 6,287 checks; the models 202; the 42 contrast
    states; the plants as above. Site files changing: `js/tickets/business.js`, `js/net/sim.js`, `js/net/rtcli.js`,
    `js/net/business.js`, `js/net/pages.js`, `js/net/physical.js`, `js/desk/draw.js`, `js/desk/app.js`, `js/desk/window.js`.

### Level 3: SB-15, VLAN hopping (built 15 November 2026, on `save/level3-sb15`)

Fifteenth of the 15, live on its own after its own checks (16 November 2026).

The owner's title for it: "VLAN hopping". Built last of the fifteen because it needs a new device, a laptop that negotiates a
trunk (the owner: "Keep building everything in order of increasing in size").
- **SB-15, "One device seen on every network at once".** VLAN hopping by switch spoofing. A closet switch spare (gi0/9) was
  reopened for something that never came, and left so it negotiates trunking (DTP). A laptop nobody owns, which asks to trunk as
  attack tools do, is plugged into its socket on the customers' side of the counter: the port became a trunk, and the laptop
  sits in every VLAN it carries. The card processor's monitoring emailed: one device seen on the staff, cameras' and the
  department's networks at once. Three ways:
  - **auto:** the sign company set the socket up for a screen (that turned out to need Wi-Fi) with the switch's box settings:
    no access VLAN, left to negotiate (dynamic auto). The laptop asks; the port answers.
  - **desirable:** the sign company's technician set the port to ask for a trunk itself (dynamic desirable) "so the screen's
    box can carry its own network". Even a device that only answers trunks.
  - **vlan:** the camera company gave the port the cameras' VLAN for a third camera still on order, and left the mode at the
    box's: an access VLAN set doesn't make an access port. `show running-config` has `switchport access vlan` and no
    `switchport mode` line.
  - **The laptop is in none of the records and not on the diagram.** It's on the floor plan at the counter (the label
    printer's spot from SB-14: the waiting area, the back room and the department's room have no space clear of their runs),
    with a device button and a Physical tab: the program's laptop model, locked, its owner gone.
  - The board: the right answer and five near misses (double tagging on a native VLAN in use, port security off, an access
    list gone so the VLANs route, the guest Wi-Fi letting visitors in, the router's pools leasing it an address on every
    network), each with the evidence that rules it out. Evidence: `show interfaces trunk` (gi0/9 trunking, auto or desirable,
    beside the records' trunks), `show interfaces gi0/9 switchport` (Administrative Mode dynamic, Operational Mode trunk),
    `show mac address-table` (the laptop's one hardware address in every VLAN on gi0/9), `show interfaces status` (connected,
    trunk), `show running-config` (the camera variant), the laptop's cable, and on the closet switch's console
    `%DTP-5-TRUNKPORTON: Port Gi0/9 has become dot1q trunk`.
  - **Fixed** when gi0/9 is as the records keep a spare (an access port, in the parking VLAN, shut), running and saved; the
    switches' own trunks as they were; everyone still online and printing. Unplugging the laptop isn't needed (and alone
    isn't the fix). Mason says why when it isn't: the laptop unplugged and the port still negotiating; shut but still left to
    negotiate; set as access but open or not parked; the switches' own trunks broken on the way; not saved. `switchport
    nonegotiate` and port security are refused on a port left to negotiate, as on the real thing. **Proof:** `show interfaces
    trunk` on the switch, gi0/9 no longer among them.
- **Shared code going live with it:**
  - **A device can negotiate a trunk** (`dtp` on a device; `dtpOf`, `linkEdges` and `switchLinks` in `js/net/sim.js`): where
    a port left to negotiate trunks with it, it's in every VLAN the port carries, and the switch learns its hardware address in
    each. A computer never asks: a port left to negotiate stays access with one. A test in `tests/business-sim.test.js` (4
    plants caught).
  - **The switch's console logs a port that negotiated itself into a trunk** (`trunkLog` in `js/net/cmd.js`), once a session.
  - The counter's PC and printer move up for any ticket's device at the counter (SB-14's `lp`, now for either).
- **Checks** (on the staged tree, SB-01 to SB-15, the branch merged into `save/level3-tickets`):
  - `tests/business-tickets.test.js` (30 businesses, every variant): the fault in the switch's own output (`show interfaces
    trunk`, `show interfaces gi0/9 switchport`, `show mac address-table`, the console's `%DTP-5-TRUNKPORTON`), the board, the
    real fix and its proof, 8 tempting wrong fixes, unsaved, other right ways (the laptop unplugged too; nonegotiate and the
    description taken off as well), the ladder, replay, no hint naming the fix's command; the guests' Wi-Fi moved onto the
    business's own network; `tests/business-sim.test.js`: a device that negotiates a trunk.
  - `node tools/drive.mjs` in full (shared code goes live with it), on the newer browser: 6,451 checks.
  - `node tools/models.mjs` (the laptop's Physical tab among the models): 202 checks.
  - AAA: SB-15's 3 states (the closet switch's trunks and address table over SSH, the laptop's Physical tab on the floor
    plan with Mason's third rung, solved) with the business tickets' others: 45 states, 147,712 text runs, all passing.
  - `DRIVE_ONLY=SB-15 python3 tools/plants-business-tickets.py SB-15` (in a throwaway copy): 11 plants (5 page, 6 Node), all
    caught: SB-15 left off the desk, the unknown laptop left off the floor plan, its device button gone, the switch learning it
    in one VLAN only, a laptop that asks to trunk never getting one (the fault then shows on no business, and the drive stops),
    put right unsaved, a spare shut but left to negotiate, a spare left open, the switches' own trunks broken on the way, a hint
    naming the mode command, any show interfaces trunk counted as proof.
  - **Totals before going live:** `npm test` 509 of 509; the full drive 6,451 checks; the models 202; the 45
    contrast states; the plants as above. Site files changing: `js/tickets/business.js`, `js/net/sim.js`, `js/net/cmd.js`,
    `js/net/business.js`, `js/net/pages.js`, `js/net/physical.js`, `js/desk/draw.js`, `js/desk/app.js`.

**Checks:** `npm test` (Node: every client job on 150 houses: the work
to do at the start for the real reason, the scripted solution passing,
other right ways passing, each tempting wrong way failing its line for
its cause, checking changing nothing, exact replay, Mason's ladder and
two options forever, no help naming an address, a port or the network's
name, cabling in any order, and 40-step random building never breaking
the checker; every ticket on 150 houses: the fault shows
in the commands themselves, the board, the real fix and the tempting
wrong fixes, proof only after the fix and never from a self-ping, the
ladder, exact replay, no hint names the answer); `node tools/drive.mjs`
(the page: both client jobs done entirely through the page on three
houses each, with the modem in a LAN port first and Mason's rungs on it,
Pull, Undo, the printer inside the range caught, reload, the views, the
Tickets | Build switch and the instructor's build tools; every ticket worked end to end on three houses each, plus a
house for every variant of a fault those three missed (it found HOME-01's
PC-end unplug and HOME-13's passive injector were never driven), through
the terminal, the forms and the Physical tab; the rungs; red marked three
ways; a wrong fix not solving; putting the network back; reload keeps
progress; the three views; easier reading persisting; the instructor
tools: a wrong PIN refused, the PIN unlocking, the demo opening the chosen
house, nothing revealed on the board, the PIN not in the code); AAA on painted
pixels across 86 states (32 of them build mode) plus scrolled positions,
measured with WebGL on so
the 3D model's buttons and the Enlarge window are measured too (and one
state with it off, for the fallback); `node tools/models.mjs` (the 3D
models in a real browser: the colour actually drawn at each light the
student must read, sampled from the rendered pixels; pulled plugs out of
their ports by distance; the loose coax off its thread; empty ports empty;
DS really blinking; one WebGL context however many tabs are opened;
Enlarge; the no-WebGL fallback). Each check was shown to fail on planted
defects (the 3D checker: lights ignoring the sim, amber drawn green, plugs
never pulled, the coax never loosened, the photo's cables left in, damage
never drawn, a new renderer on every open, lights never blinking; build
mode: rung 3 striking causes the network hadn't ruled out, the Wi-Fi line
ignoring the password, no DHCP retry, the ladder a rung early, checking
that changed the network, two runs through the wall allowed, a printer
inside the range accepted, no 100 m limit, a hint naming the network's
name or a port, a replay dropping an action, a stale reservation accepted,
the modem-in-a-LAN-port cause never named; on the page, the inset rule or
the mark removed from an unmet line, progress lost on reload, the modem's
cable diverted to a LAN port). The AAA tool now scrolls to the top before
a full-page measurement: a focused button had scrolled the page, and a
full-page shot then paints the sticky bars over the middle of it. B2's
plants: no PoE budget, any backhaul holding, any cable counting as wired,
a forward to any camera port accepted, power taken from DATA IN, the
weak-signal line at 40% (the house's 44% would pass); on the page, a
boxed camera missing from the Place form. B3's plants: guest isolation
ignored, the guest password checked against the home one, no guest DHCP,
address clashes or long runs never seen, the visitor on the home network
not named, the client's password doing nothing, DNS never checked, any
speed counting as fast, WPA2 accepted for WPA3 devices, a moved printer's
printing not checked; on the page, the visitor's phone without a device
button.

## Level 4, the campus: the owner's decisions, 15 November 2026

The owner, asked to choose before anything is built: **"Go with your recommendations, Rafiki's HQ"**. So:
- **Site:** Rafiki's IT Services' own headquarters, three-tier (core, distribution, access), and a second, smaller building on a
  collapsed core, joined to HQ by fibre (the placement agreed 10 October 2026).
- **First-hop redundancy:** the industry-standard `standby` commands, as the rest of the command line; the teaching says VRRP is
  the open standard that does the same job.
- **OSPF:** a single area at the campus; several areas wait for Enterprise.
- **Spanning tree:** the rapid, per-VLAN kind, with the classic port states taught beside it.
- **Objectives** (Network+ V9, the owner's doc read 15 November 2026, unchanged since 30 September), the parts Campus covers,
  quoted: Network topologies: "three-tier, and collapsed core"; Routing technologies: "dynamic routing (… OSPF), route
  selection, … FHRP, VIP"; Switching technologies: "VLANs, interface configuration, spanning tree, MTU, and jumbo frames";
  Network services issues: "switching issues (STP, VLAN assignment, ACLs), routing issues (routing table and default routes)";
  Cabling and physical interface issues: "interface issues (increasing counters, port status), and hardware issues (…
  transceiver mismatch …)"; Performance issues: "congestion, latency, packet loss"; Types of attacks: "MAC flooding, … rogue
  devices/services" (port security answers them); Transceivers and connectors: "SC, LC, … MPO" (the fibre between buildings).
- **What students configure** (the table above): Layer 3 switches with a gateway per VLAN; spanning tree (root bridge, port
  roles, protections); link aggregation; OSPF; first-hop redundancy with a virtual gateway; MTU and jumbo frames; port security.
- **Order, smallest first** (the owner's rule): work orders first, as Level 3 had them: port security at the access layer (the
  engine already enforces it), the switch gateways, link aggregation, the spanning-tree root, OSPF, the virtual gateway, jumbo
  frames for the backup network; then 15 tickets, smallest first, with the standing five extra scenarios.
- **New to the engine:** routing on a switch (its VLAN interfaces as gateways), spanning tree, link aggregation, OSPF, the
  virtual gateway, MTU. Port security and switch VLAN interfaces exist already.
- **3D models:** a Layer 3 switch with fibre uplink slots, SFP transceivers, LC patch cords: the owner was asked for photographs
  on 15 November 2026 (as for SB-14's label printer). The engine and command line are built first; the models when they come.
- **The plan, approved 16 November 2026: "Yes to the level 4 plans, build it out".** The site: Rafiki's IT Services' own HQ,
  three floors, three tiers (two layer 3 core switches; two layer 3 distribution switches bundled with LACP, the VLAN gateways
  with standby and the spanning-tree root; an access switch per floor, wired to both distribution switches; 1F the service
  desk and the data room, 2F the technicians' bench, 3F management; VLANs for the service desk, the bench, the office, servers,
  printers and management; the internet router at the edge originating the default route into OSPF), and the Training Annex
  on a collapsed core (one layer 3 switch as core and distribution, an access switch for the classroom) over single-mode fibre,
  routed and in OSPF. **10 work orders**, smallest first: (1) lock down the access ports (port security, portfast, BPDU guard);
  (2) gateways onto the distribution switch (VLAN interfaces and ip routing, the router-on-a-stick retired); (3) the
  distribution pair bundled with LACP; (4) the spanning-tree root where it belongs (distribution 1 primary, 2 secondary); (5)
  OSPF across the core, the default originated at the edge; (6) the virtual gateway (distribution 2 joins with standby); (7)
  jumbo frames for the backup network (the backup server and its Linux command line); (8) the Training Annex on a collapsed
  core; (9) DHCP relay (ip helper-address) to a central DHCP server; (10) a new floor end to end. **15 tickets**: the wrong
  root bridge; BPDU guard err-disabling a port (a desk switch); port security err-disabling a port (a visitor's laptop); a
  port-channel member suspended (half the bandwidth); LACP passive at both ends; OSPF stuck in EXSTART (MTU); an OSPF area
  mismatch after a replacement; a passive interface on the uplink; the default route not originated; the standby virtual
  address mistyped on one switch; no preempt after maintenance; jumbo frames on the server but not a switch; a stale static
  route looping (TTL expired); a wrong mask on a routed link; mismatched transceivers on the inter-building fibre. 3D models
  need the owner's photographs: a layer 3 switch with fibre slots, SFP transceivers, LC cords, a rack server.
- **Groundwork, built 15 November 2026 on `save/level4-campus`** (worktree `/home/user/e4-l4`; stage 1 went live 17 November
  2026, below; `later: true` came off `levels.js` with it):
  - **The layer 3 switch, MSW-3900X** (`newSwitch({ l3: true })`, its own command line registered as `l3switch`, so the office's
    and the business's switches are unchanged, tested): `ip routing`; `no switchport` makes a routed port (on no VLAN, its own
    address; switchport settings refused on it; `switchport` makes it a switch port again); static routes by next hop (only
    while it's on a connected network) or by interface, with a distance; `show ip route` in the router's format with each
    route's distance and metric (routing off: the switch's default gateway and an empty redirect cache, as the real thing says);
    the lines in the running configuration and back in from a file; `show ip interface brief` with routed ports' addresses.
    The table and longest match are in `js/net/l3.js` (pure); `l3Ifs`, `l3Table`, `l3Route` in `swcli.js`.
  - **The simulation** (`sim.js`): a routed port is a node of its own on layer 2 (`l3Node`) and answers ARP there
    (`routedAddrs`); a host's gateway on a switch that routes sends its packet on `routeL3`: the longest match at each switch,
    on to the next hop's switch while the route says so, until the destination's own network; each switch crossed takes one off
    the TTL (`routers`; ping's reply shows it); no route says so (Destination net unreachable from that switch); a next hop that
    never answers, a loop, or no way back (the destination's route to the sender is checked too) each get no reply. The switch's
    own ping goes by its table (`routeFromL3`). A switch that routes takes a reply by its own table (`canReply`). OSPF's learned
    routes will come in through `learned(id)` and the session's `live("learned")`.
  - **Link aggregation (LACP)**, on both switch models (access switches bundle their uplinks too): `channel-group <1-48> mode
    active|passive|on` (no proprietary modes), which makes the port-channel the first time ("Creating a port-channel interface
    Port-channel 1"); `interface port-channel N` reaches every member, and its switchport settings are its own as well
    (`sw.pcs`, made only when used, so a switch without one saves and reads exactly as before); `show etherchannel summary` (Po
    SU/SD; each member P bundled, I stand-alone, s suspended, D down); `show interfaces port-channel N` (its bandwidth the
    bundled members' speeds added up). Each member works its state out from the far end (`chanOf`, `farDev` on each switch
    link): active with active or passive bundles, passive with passive never does, on bundles without asking (its far end,
    if LACP, stands alone), a member whose VLAN settings aren't the port-channel's or whose far end is another switch is
    suspended: line protocol down, and it carries nothing (`linkEdges`). `tests/campus-lag.test.js` (7).
  - **Spanning tree, rapid and per VLAN** (`js/net/stp.js`, pure; on both switch models: every switch runs it): per VLAN, each
    group of switches joined in it elects the lowest bridge ID (priority plus the VLAN, then the address); root ports by the
    lowest path cost (short method: 1 Gb/s 4, 100 Mb/s 19; a port-channel of two 3, of three or more 2), designated ports the
    end nearer the root, every other port between switches an alternate, blocking; a port to anything that isn't a switch is
    designated (an edge port with portfast). The simulation (`stpVlan`, `stpAll`, cached until a switch or cable changes)
    leaves a blocked port's VLANs out of what it carries (`linkEdges`), but only where a loop is possible at all (`stpLoops`:
    fewer than two switch-to-switch cables, or no group with more links than a tree, and nothing is worked out, so the office's
    and the business's networks run exactly as before). Commands: `spanning-tree mode rapid-pvst|pvst`, `spanning-tree vlan
    <list> priority <in 4096s>` (the real refusal listing the allowed values), `root primary` (24576, or 4096 under a lower root
    it finds now) and `root secondary` (28672), `no spanning-tree vlan`; on a port `spanning-tree portfast` (with the real
    warning), `bpduguard enable|disable`, `cost`; `show spanning-tree [vlan N]` in the real layout (root ID, "This bridge is the
    root", bridge ID with its sys-id-ext, each port's role, state, cost, Prio.Nbr, P2p and Edge). BPDU guard after each change
    (`bpduGuard`): a port with it on that hears another switch is err-disabled until it's shut and opened. The settings are made
    only when used (`sw.stp`, `p.stp`), so saved switches read as before. A switch's console on the page gets `swLive` (its
    tree, and the routes a protocol will learn). `tests/campus-stp.test.js` (7).
  - **OSPF in one area** (`js/net/ospf.js`, pure; the layer 3 switch only): `router ospf <pid>` (one process; its own mode,
    `(config-router)#`), `network <addr> <wildcard> area <n>`, `router-id`, `passive-interface <if> | default` (and `no` for
    the exceptions), `default-information originate` (only with a default route of its own), `auto-cost reference-bandwidth`
    (with the real warning to keep it the same everywhere); on a routed port or VLAN interface `ip ospf cost`, `ip ospf
    priority`, `ip mtu`. Neighbours on each segment (a layer 2 broadcast domain) need the same area, subnet and mask, neither
    passive, different router IDs; a different MTU leaves them in EXSTART. The DR is the highest priority, then router ID (set
    by hand, or the highest interface address: on a switch with a provider port, that one); two that are neither stop at 2WAY.
    Routes: the lowest total cost (each interface out on the way, then the far router's own into the network; the reference
    bandwidth 100 by default, so a gigabit costs 1); a passive network still advertised; a default originated arrives as
    `O*E2` with metric 1. The simulation (`ospfAll`, cached like the spanning tree) feeds them to the table through `learned`
    at distance 110, so routing across switches (`routeL3`) uses them. `show ip ospf neighbor`, `show ip ospf interface brief`,
    `show ip protocols`, `show ip route [ospf]`. `tests/campus-ospf.test.js` (7).
  - **First-hop redundancy: standby** (the layer 3 switch only): on a VLAN interface or routed port `standby <0-255> ip <virtual>`
    (refused outside the interface's subnet, as the real thing does), `priority`, `preempt`, and `no` for each. Per group on a
    segment, the election (`hsrpTick`, after each change in `relink`, its result kept in `net.extra.hsrp` so a saved network
    replays it): the active router stays active while it's up with an address, unless one with a higher priority and preempt
    set comes along; when it goes, the best of the rest (highest priority, then highest address) takes over. Only the active
    router answers ARP for the virtual address (`hsrpVips` in `owners`), so the hosts' gateway follows it. `show standby
    [brief]` (each group's state: Active, Standby, Listen, Init; who's active and standby; the virtual address).
    `tests/campus-hsrp.test.js` (6).
  - **Checks:** `tests/campus-l3.test.js` (6), `tests/campus-sim.test.js` (6), `tests/campus-lag.test.js` (7), `tests/campus-stp.test.js` (7), `tests/campus-ospf.test.js` (7), `tests/campus-hsrp.test.js` (6); `python3 tools/plants-campus-node.py` (in a
    throwaway copy): 47 plants, all caught (one standby plant missed twice: a switch that's off isn't a member and an interface
    that's down is on a segment of its own, so only an interface up with no address reaches that guard; the test now has it). Two missed at first: one hit only one of the two `ip routing` guards (re-aimed at
    both), and "a suspended member still carries frames" passed because the test's suspended member was an access port that
    couldn't carry the VLAN anyway (the test now suspends a trunk that still carries it). The existing suites run unchanged
    against it (home, office, business command line, simulation and page, with the campus's: 239 of 239). The business's
    ticket tests ran within noise of the tickets branch on a loaded machine (time them again on an idle one before going live).
- **The campus and its first work orders, built 16 November 2026 on `save/level4-campus`** (not on any page yet):
  - **The order, re-sized by the owner's rule for the rest of E4** ("Keep building everything in order of increasing in size"):
    the spanning-tree root and the LACP bundle are smaller than moving the gateways, so they come first. The work orders are
    numbered in the order they go live: **CP-J1** lock down the access ports, **CP-J2** the spanning-tree root, **CP-J3** LACP
    between the distribution switches, **CP-J4** the gateways onto distribution switch 1. Tell the owner the order changed and
    why when they go live; the titles are theirs.
  - **The campus template** (`js/net/campus.js`, `makeCampus(seed)`): Rafiki's HQ as the technician finds it: the edge router
    (BR-4200) running router-on-a-stick, a subinterface and DHCP pool per VLAN, NAT; two MSW-3900X distribution switches,
    routing off, joined by two trunks; an access switch per floor uplinked to both; the 2F access switch the root of every VLAN
    (left at the defaults, it has the lowest address); the core switches in their boxes; every switch named, locked, SSH only, on
    the management VLAN, saved. The seed decides the addresses (10.b.V.0/24, the VLAN's number its third octet), the VLAN
    numbers and the passwords. `tests/campus-site.test.js`.
  - **CP-J1** (port security, sticky, one device, shutdown; portfast and BPDU guard on every desk port; the uplinks untouched,
    the spares still parked): over SSH from the service desk PC. **CP-J2**: distribution switch 1 the root of every VLAN in use,
    distribution switch 2 the secondary (causes: the 2F switch still root, another access switch root after the 2F one was
    pushed down, distribution switch 2 root; for the backup: left at the default, an access switch beating it, a tie, below the
    primary). **CP-J3**: the two links one port-channel by LACP (causes: two separate trunks with one blocked, one end bundled,
    one link left out, passive with passive, on with LACP, a member suspended, a member down, forced on at both ends), still
    carrying every VLAN in use. **CP-J4**: distribution switch 1 every VLAN's gateway (its VLAN interfaces take the .1 the devices
    already use, the management VLAN's too: it answers there from now on), its port 24 routed on a /30 to the edge router (the
    mask worked out by hand), a default route one way and the campus's /16 the other, NAT kept on the edge router, DHCP relayed to
    the edge router's pools (work order 9 moves the pools to a central server), the subinterfaces removed. Worked from the
    console (Mason: over SSH you're standing on the branch you're cutting): ready first with the new interfaces shut, then the
    edge router, then back to switch 1 to cut over. Each work order starts from the one before it done (a test holds them to it).
  - **The simulation gained** (it touches `routeBR` and `routeFromRouter`, which the live business runs on, so the full drive is
    needed before any of it goes live):
    a layer 3 switch's next hop can be a business router, which carries the packet on (`routeBR` from `routeL3`); the router routes
    on through a layer 3 switch, its own traffic and passing traffic; a source routed in from another router needs a route back
    (`wayBack`); a loop between them stops (a depth guard). **DHCP relay:** `ip helper-address` on a VLAN interface or routed port
    (`relays`, `relayOf`; keys `rtr@relay|switch|interface|helper`): the router answers from its pool for the relaying interface's
    network, if the request gets there and the offer gets back; the lease names the helper as its server. Fixed: `switchport trunk
    allowed vlan add/remove` typed on a port-channel changed its members but not its own record (the members suspended for
    nothing).
  - **Checks:** `tests/campus-jobs.test.js` (each work order: the start, the walk-through, the tempting wrong ways each failing
    their own line for their own cause, other right ways, no help naming a password, an address or a VLAN number, each starting
    from the one before done); `tests/campus-edge.test.js` (8: the cut-over by hand on 8 campuses). Plants
    (`python3 tools/plants-campus-node.py`, in a throwaway copy): CP-J1 12, CP-J2 11, CP-J3 14, all caught (5 missed at first,
    each a test gap closed or a plant re-aimed at both of two guards); the relay and routing handoff 12, all caught; CP-J4's 15 (run on 4 campuses, `SEEDS=4 TESTS=tests/campus-jobs.test.js`).
- **Stage 1 on the page (CP-J1 to CP-J4), built 16 November 2026, live 17 November 2026** (from commit 2964011 with the levels
  checks' fix, 038d825):
  - `levels.js`: Level 4 has its work orders, `planned: 25`, and says more work orders and its tickets are on the way. Level 3
    finished opens it; the desk links its work orders into Build.
  - The build page lists them, gives every campus device a button (`ORDER`), and says rooms by the campus's names.
  - `draw.js`: the campus is a site of its own (`SITES.campus`, `campusRooms`, `campusNames`; positions in `CAMPUS_LAYOUT`,
    rooms in `CAMPUS_ROOM_BOX`). The logical diagram in tiers, wider than the others (`-44 -26 1150 710`): the provider, the modem
    and the edge router; the core (boxed until CP-J5); the distribution pair; an access switch per floor, its name beside it; the
    desks staggered on two rows under their floor's switch, so their names never meet. Icons by what a device is on the campus
    (`iconOf`; a new `l3switch` icon). The floor plan in three bands, one a floor (1F the data room, three rows of devices 85 apart,
    and the service desk; 2F and 3F each a closet and a room), its runs routed round the devices as the business's are; the 1F
    access switch sits by the service desk's wall, so its runs don't cross the data room. Switches show their management address.
  - Every campus PC and printer has a Physical tab (`MODEL_OF`, `STILL`). **The MSW-3900X is drawn with the MSW-2800G's model**
    until its photographs come, and its words say so first (the ports and lights are in the same places, so what they show is this
    switch's): never passed off as its own.
  - Checks: `ONLY=campus node tools/drive.mjs` (the lock, each work order through the page on three campuses, the Physical tabs, both
    drawings in both fonts, every work order's floor plan at its start and done on six campuses); the campus contrast states
    (`ONLY=campus node tools/aaa.mjs tools/aaa-states.json`); `python3 tools/plants-campus-page.py` (8 page plants, in a throwaway
    copy). CP-J1's drive passed (39 checks) after the drawings were re-laid: "CABLE IN" on a tile (the provider too near the modem),
    three addresses off the logical diagram's foot, the 1F access switch's runs under the distribution switch's tile.
  - **Two fixes for every level, found by the campus's checks:**
    - **`ipconfig /release` then `/renew`** (`js/net/cmd.js`): after a release the adapter has no address, and ipconfig took that
      to mean the media was disconnected: it said so, and `/renew` refused. Now the media is the link itself, as on Windows: a
      released adapter shows no IPv4 address and a blank gateway, still connected, and `/renew` asks again; unplugged is still
      Media disconnected. Found by CP-J4's drive (the drives had only ever used `/renew` on its own). `tests/home.test.js` holds
      it (failing on the old code).
    - **The sticky columns follow the bars** (`js/desk/app.js`, `js/build/app.js`): `--chromeH` was measured only at load and on a
      window resize, so a long work-order title wrapping, or easier reading's font arriving, made the bars taller and the terminal
      column ran off the foot of the screen, its input line out of reach. A `ResizeObserver` measures again whenever the bars
      change size. Found by the contrast states (CP-J4's long title with easier reading on, 1.06:1 on the terminal's lines); the
      drive checks the two agree, and a page plant taking the fix out is caught.
  - **The Level 3 complete checks** (`tools/drive.mjs`, `tests/levels.test.js`) said the campus is built later; with stage 1 they
    say Level 3 finished opens the campus, which counts its work orders and says more are on the way (both shown to fail with
    `later: true` put back).
  - **Checks before going live, on the stage 1 tree:** `npm test` 575 of 575; the full drive on 2964011, every check passing but the two Level 3
    complete ones (fixed above; their block run again on the stage 1 tree, 10 checks; the campus's parts: the lock 5, CP-J1 39,
    CP-J2 41, CP-J4 54, CP-J3 and the drawing plans in the whole run); `node tools/models.mjs` 202, 0 failed;
    the 10 campus contrast states and the 10 levels states (23,732 text runs) all passing; plants, all caught: page 9
    (`tools/plants-campus-page.py`), Node CP-J1 12, CP-J2 11, CP-J3 14, CP-J4 15, the routing handoff and relay 12
    (`tools/plants-campus-node.py`, `SEEDS=4`, `TESTS=` naming the suite, each in a throwaway copy).
  - **Not in stage 1:** OSPF on the BR-4200 (13a1478, the groundwork for CP-J5, with `tests/campus-rtospf.test.js`) stays on
    `save/level4-campus` until CP-J5 goes live.
- **CP-J5, OSPF across the core, built 17 November 2026 on `save/level4-campus`** (not live):
  - **The installer's night** (`installCore` in `js/net/campus.js`, called from CP-J5's start): both core switches out of their
    boxes in the data room, named, locked, routing on, each routed port addressed and described from the records (`CORE_LINKS`,
    `coreLinks`: seven /30s in 10.b.255.0/24 after CP-J4's link, the end nearer the provider on the first usable address), the
    spares shut, saved; five links cabled (the edge router's Gi0/2 and Gi0/3 to each core switch's port 24, the cores' ports 21
    together, each core's port 1 to distribution switch 1's ports 19 and 20). The cores' ports 2, for distribution switch 2, are
    addressed but not cabled until it joins (CP-J6): cabled, they drew two red links nobody was meant to touch, and core switch
    1's port 2 left at nearly the core-to-core link's angle, its name on that line.
  - **CP-J5** (`js/build/campus.js`), 13 lines: the edge router's two ends (address, shut, down); distribution switch 1's two ends
    (still a switch port, address, shut, down); OSPF neighbours on every link, the first link short of FULL judged in order (a
    router not running OSPF, the link in no network statement, passive, another area, MTU); every VLAN in use advertised but
    passive on distribution switch 1, the provider's side not in OSPF; every VLAN at the edge router by both core switches (not
    advertised, not learned, still over the old link, by one core switch only); distribution switch 1's way out OSPF's default (not
    originated, not reaching it, hidden behind its own static); the statics retired; the old link retired, both ends shut; NAT
    (an edge link to the core not inside); DHCP still relayed (the classic trap: the helper still on the old link's address, gone
    with it); everyone working; both core switches answering from the service desk (no way there, or no way back); all four saved.
    Worked from the console. The walk-through numbers its console cables from the ones CP-J4 laid (`v.runs`).
  - **Equal-cost paths** (`js/net/ospf.js`): every path of the same lowest cost is kept, up to four, lowest next hop first (`paths`;
    `nh` and `iface` are the first, which traffic follows); `show ip route` on both models prints each under the first, as the
    real thing does. A network two routers have at the same cost gets both; the nearest router originating a default wins, ties
    share.
  - **A switch port down when the far port is shut** (`switchLinks` in `js/net/sim.js`, every level): a switch's own view of a link
    listed the far end whatever its port said, so a port facing another switch's shut port, or a router's, said up/up while the
    cable carried nothing (traffic already stopped: `cableUp` checked both ends). Now it's notconnect, and a routed port facing a
    shut port loses its connected network. `tests/links-far.test.js` (2, both failing on the old code).
  - **The logical diagram:** the edge router moved over the middle of the core (x 560): at x 380 the old link to distribution
    switch 1 ran straight through core switch 1, and their port names sat on each other. The core switches spread wider than the
    distribution pair (x 300 and 820). CP-J1 to CP-J4's drawings measured again on six campuses: all clear.
  - **Checks:** `tests/campus-jobs.test.js` CP-J5's wrong ways (17, each its own line and cause) and other right ways (one
    statement for every link, interfaces passive one at a time, router IDs, the relay by core switch 2's side, the old cable pulled);
    the drive through the page on three campuses (63 checks: OSPF neighbours and the two-path default over SSH, tracert through a core
    switch, the renew relayed to the new address) and its drawings on six (36); its 3 contrast states pass (13,854 text runs); its
    Node plants and those for equal-cost paths and the far port all caught (one missed at first, a network two routers have: the
    test had no such case; it does now).
- **CP-J6, the virtual gateway, built 17 November 2026 on `save/level4-campus`** (not live):
  - Its start cables distribution switch 2's two links to the core (`coreCables`). **CP-J6** (`js/build/campus.js`), 10 lines:
    distribution switch 2 routes, its links routed and up (ip routing off, still a switch port, address, shut, down); an OSPF
    neighbour of both core switches (`nbrCausesFor(CORE6)`); every VLAN advertised, passive; its own interface on every VLAN (the
    records give it the third address); distribution switch 1 off the gateway addresses (the second); one standby group per VLAN on
    both, the gateway its virtual address (none on either, the two in different groups, the virtual address mistyped, a group not
    numbered for its VLAN); distribution switch 1 active, and active again after a restart (tried on a copy: off, then on; without
    preempt, or at the default priority, switch 2 keeps it); **if distribution switch 1 fails** (switched off on a copy of the network,
    `copyOf`, so a check never changes the real one): switch 2 answers every gateway, at the right address, every PC stays online,
    and DHCP is still relayed; everyone working; both saved. Worked from the console, switch 1 first so it's active before switch 2
    joins.
  - **The active switch answers at its virtual address from other networks too** (`routeL3`): a ping from the service desk to the
    management VLAN's gateway got no reply, where the real thing answers.
  - **A work order's start was slow:** each starts from the one before it done, so CP-J6 replays every earlier walk-through (4.7 s in
    Node, past the drive's 5 s reload in the browser). Port security worked out the whole network's links again for every secured
    port after every command; now once a pass (`portSecurity`, every level). CP-J6's start is 1.3 s.
  - **The drawing:** distribution switch 2's port 2 (to the 2F access switch) landed where the 3F switch's link to distribution switch
    1 crosses it. A port's name now tries the stretch nearer its device before giving up on other lines (`draw.js`), and the 2F
    access switch sits at x 600 on the logical diagram.
  - **Checks:** CP-J6's wrong ways (16) and other right ways (switch 2 first, then switch 1 taking over by preempt; other priorities;
    preempt on both; interfaces passive one at a time); its drive's own checks (`show standby brief` on both switches over SSH, the
    management VLAN's virtual gateway answering a ping); its Node plants all caught (one missed at first, "switch 2 active passes":
    no test ever ended with switch 2 active; one does now, switch 2 configured first with switch 1 at the default priority).
- **Stage 2 (CP-J5 and CP-J6), live 17 November 2026** (from 0cfec71). Checked on its tree: `npm test` 587 of 587 (on e4a91cd; the
  final commit adds one test case, `tests/campus-jobs.test.js` run again on it, 15 of 15, 12 campuses); the whole campus drive (every check but a
  written-in count of the campus's work orders, now read from the level; the lock run again, 5); the full drive 6,965 checks, every level; `node
  tools/models.mjs` 202, 0 failed; the campus and levels contrast states, 25, 84,802 text runs; every earlier work order's logical
  diagram compared under the live and the new drawing code (home, office and business, start and done, two seeds, both fonts: 240
  drawings, all the same; the comparison calibrated on CP-J1, where the 2F switch moved: all 8 different); the plants for CP-J5,
  CP-J6, equal-cost paths, the far port and the virtual address, all caught.

- **CP-J7, a new floor end to end, built 17 November 2026 on `save/level4-campus`** (the owner, 17 November 2026: "Keep building,
  do the new floor next"; objectives read that day, Network+ V9 unchanged):
  - **The fourth floor** (`js/net/campus.js`): the 4F closet and the training room (`CAMPUS_FLOORS`, `CAMPUS_RUN`, `CAMPUS_ROOM_BOX`,
    the room names); the training VLAN per set (`TRAIN_V`: 60, 160, 235; `plan.train`), the 4F access switch in its box from the
    factory, its place fixed in the 4F closet (`acc4`, `plan.sw.acc4`, its uplinks `plan.up.acc4` to each distribution switch's port
    4), two training PCs (`tr1`, `tr2`, `plan.desks4`) from a stream of their own (seed ^ 0x4f4f), so every other part of the campus
    is drawn as before. CP-J7's start takes the PCs out of their boxes; the switch stays in its.
  - **CP-J7** (`js/build/campus.js`), 13 lines: racked and uplinked (in its box, no uplink, the wrong ports, a port shut); set up as
    every switch (name, secret, console, SSH, management address, gateway); the VLAN on three switches; the trunks (not a trunk, still
    negotiating, the native VLAN, the training or management VLAN left off a hop, the bundle between the distribution switches without
    it); its spanning-tree root (left to the defaults, the 4F switch has the lowest address and wins; switch 2; no backup); its gateway
    by standby, switch 1 active; the edge router's pool (none, the default router, DNS, nothing kept back); both relays; the desk ports
    locked down as every desk here, the spares parked; the PCs online (no address, not in OSPF); the floor surviving switch 1 (on a
    copy); everyone else working; saved (met at the start: a switch from its box has nothing unsaved). Worked from the console: your
    laptop carried to the 4F closet, then back to the data room.
  - **The drawings:** the logical diagram can't grow wider without shrinking every name (it scales to its column), so the access row is
    four across the same width, staggered (1F and 3F up, 2F and 4F down), names to the right; the desks on two rows lower down; the
    diagram taller (`-44 -26 1150 820`). Your laptop's spot moved up by the provider; carried to the 4F closet it has a spot beside the
    new switch (`alt.c4`). The floor plan has a fourth band (`20 20 970 975`), and the 2F and 3F closets are wider (to 260), leaving the
    4F switch's riser runs a corridor past the switches below. Every campus work order's drawings changed with it and were measured
    again.
  - **Found on the way:** a hint said "169.254", which the help check read as VLAN 254 on the campuses where that's the management
    VLAN; it names the address type instead.
  - **Faster, for every level** (a campus work order's reload replays every step; CP-J7's took 7.6 s, past the drive's 5 s limit):
    - the links worked out once per computation that can't change them (`withEdges`), and spanning tree, standby and OSPF with them
      (`scoped`); worked out again when a port is shut mid-pass (`edgesChanged`); the console's duplicate-address look once a session;
    - a switch's VLAN settings fixed once per configuration (`fix` in `js/net/swcli.js`, a WeakSet; any of its four settings missing
      again, as a test strips them in place, and it runs in full);
    - within one pass a switch's view of its links (`switchLinks`) and a relay's way to its helper kept (`leased`), and dropped when a
      lease changes (`dhcp`, `release`) or a port shuts.
    - CP-J7 in Node: its start 2.2 s to 1.5 s, its 163 steps replayed 3.1 s to 1.4 s; the browser's reload 7.6 s to 2.7 s. The same
      output and network after every step as before, on every office, business and campus work order, three seeds each (3,816 steps).
  - **A dead link's diamond kept clear of other port names** (`DOT_GAP` in `js/desk/draw.js`): on a phone the diagram is drawn small,
    and the edge router's shut link's diamond, touching "Gi0/2"'s plate, bled into the name's pixels (6.47:1, CP-J7 done on campus
    4242: AAA caught it). Only the diamond keeps the 4-unit gap: the round dots sit as close on every level and measure clean. No
    drawing on the home, office or business levels moved (240 compared, names and dots).
  - **Checks before going live** (on the tree that went live): `npm test` 591 of 591; the full drive 7,061 checks (every level), then `ONLY=campus` 605 on the tree with the
    diamond fix; AAA on painted pixels, all 28 campus and levels states, 101,772 text runs; every office, business and
    campus work order replayed step by step against the code before the speed-up, the same output and network after every step;
    `node tools/models.mjs` 202 of 202;
    plants: CP-J7's 31 Node plants, the 11 on the code the speed-up touched (the relay, a far end shut, the standby address, SB-J6's
    port security, re-aimed), the 3 on the speed-up's own guards (two missed until `tests/links-far.test.js` held the kept links to
    a port shut or a lease changed mid-pass), the 12 campus page plants (three new for CP-J7), every one caught.
- **CP-J8, the Training Annex on a collapsed core, built 18 to 22 November 2026 on `save/level4-annex`** (worktree
  `/home/user/e4-anx`; the owner, 17 November 2026: "Please keep building it all out. We will come back and make changes once I go
  through it."; objectives read 17 November 2026, Network+ V9 unchanged: "collapsed core", "fiber", "SC, LC", "OSPF", "VLANs",
  "DHCP", "physical vs. logical diagrams", "transceiver mismatch"):
  - **The Annex** (`js/net/campus.js`): across the car park, its two rooms (`acomms` the Annex comms room, `class` the classroom: in
    `CAMPUS_FLOORS`, `CAMPUS_RUN`, at 185 m and more from the main building, past copper's 100 m, and `CAMPUS_ROOM_BOX`); its VLANs
    per set (`ANNEX_V`: the classroom 70/170/236, its own management 71/171/237, each its subnet's third octet); `plan.annex` (the
    core's and access switch's names and addresses, the link: core switch 2's SFP1 to the Annex core's SFP1 on the next /30 of the
    core's block, `10.b.255.32/30`, each end described; the uplink, access port 24 to core port 1; the desks); the Annex core
    (`anxc`, an MSW-3900X with four empty fibre slots) and access switch (`anxa`, an MSW-2800G) in their boxes, fixed in the comms
    room, and the classroom's two PCs (`cl1`, `cl2`) from a stream of their own (seed ^ 0xa11e), so every other part of the campus is
    drawn as before. `CAMPUS_FIBRE`: the duct to the Annex carries OS2 single-mode (`lay` in `js/net/sim.js` takes a fibre's type from
    the rooms it joins; the office's OM2 multimode otherwise, as before). CP-J8's start takes the classroom PCs out of their boxes and
    gives core switch 2 its fibre slots, so no earlier work order's pages or saved progress change.
  - **CP-J8** (`js/build/campus.js`), 16 lines: racked and uplinked; the fibre up (in its box, copper across the car park, no module,
    not plugged in, the wrong slots, an SFP+ in a 1 Gb/s slot, a multimode module on the single-mode run, a port shut); each Annex
    switch set up as every switch here (the core with routing on, managed on the Annex's management VLAN as its gateway; the access
    switch its gateway the core); the link routed at both ends on the records' addresses, described; OSPF neighbours across the
    fibre (a new first cause for every core link: the link itself down, before "no network statement covers it": a down interface
    isn't in OSPF at all); both VLANs on both Annex switches; the trunk between them; the classroom's gateway on the Annex core, both
    its networks in OSPF and passive; the edge router's pool; the Annex core's relay; the desks locked down, the spares parked; the
    classroom PCs online; both Annex switches answering from the service desk; everyone else working; saved.
  - **The drawings:** the logical diagram can't take the Annex beside the main building (it would shrink every name), so the Annex is
    a framed block of its own under it ("THE TRAINING ANNEX, ACROSS THE CAR PARK"), and a link between the two buildings (the fibre)
    is drawn as a labelled stub at each end, "To the Annex core switch" at core switch 2 and "To core switch 2" at the Annex core, as
    a diagram of two buildings shows it (`annexOn`, `ANNEX_Y`, `stubEnd`, `stubName` in `js/desk/draw.js`; the stubs' tags are port
    names to the drawing checks). The floor plan gets a fifth band under the main building once anything of the Annex is out of its
    box, and the duct's fibre a fixed route: down between the data room's names, along under them to the riser, down beside the
    closets, out under the car park, in by the comms room's far wall (the run router's curves all crossed a room's name). The Annex
    switches show their management addresses.
  - **A pass skipped when nothing changed** (`js/net/cmd.js`, `js/net/sim.js`): each work order's start replays every earlier one, so
    CP-J8 opened in 3 s. A pass of the links after a command now runs only if the command changed something a pass reads (every
    switch's and router's configuration, every device's interfaces, each console's mode: `netPrint`, compared before and after), and
    the pass a command's own action starts is skipped when nothing has changed since the last one (`ver`, `bump`, `relinkIfChanged`;
    each step of a pass settles in one go, so a second changes nothing). `relink` itself is unchanged, for the starts that change the
    network directly. Every earlier work order replays the same, output and network after every step (3,987 steps, three seeds).
  - **The drive's wall rule** (`tools/drive.mjs`): it added up every sample near any wall, 80 samples whatever a run's length, so the
    1,600-unit duct counted every floor it crossed as 20 units along a wall. It now takes the longest stretch beside a wall, sampled
    every 4 units; its other tests keep their 80 samples. Calibrated with a plant laying the duct along the data room's wall.
  - **Checks:** `npm test` 593 of 593 (CP-J8's wrong ways, 24, and other right ways: a statement per network, passive one interface at
    a time, the trunk's list a line at a time, the relay to the edge router's other link; and a new test: the PCs waiting on a pool
    get their addresses the moment it's finished being typed); `ONLY=campus JOB=CP-J8` 72 checks (three campuses: the classroom PC's
    address and tracert across the fibre, OSPF FULL at core switch 2, the Annex access switch's trunk over SSH, the block and stubs,
    each Annex switch under its address, the Annex's band and the duct's route, both drawings in both fonts, the reload);
    `ONLY=campus JOB=plans` 288 (all eight work orders' drawings, start and done, six campuses, both fonts); the full drive 7,166
    checks (every level); `node tools/models.mjs` 202 of 202; AAA on all 31 campus and
    levels states, 120,705 text runs (CP-J8's three new); 240 diagrams on the other levels unchanged, names and dots. Plants: CP-J8's
    20 Node plants and the pass-skip's first (a line that changed something given no pass), caught; the console's mode left out of
    what a pass reads missed until the pool test above, then caught; two are defensive and unreachable today, as earlier unreachable
    guards are kept: a lease that doesn't bump (a lease changes nothing a pass reads, and a command that gives one shows in the
    print anyway) and a start that doesn't bump (no start changes anything a pass would act on: it unboxes uncabled PCs, adds empty
    slots). Page plants: CP-J8's six (the block, the classroom PCs' buttons, the Annex's band, the duct's route, the switches'
    addresses: missed until the drive checked them, then caught; the duct along a wall, caught by the reworked wall rule) and the
    three re-aimed, all caught.
- **CP-J9, jumbo frames for the backup network, built 22 November 2026 on `save/level4-jumbo`** (worktree `/home/user/e4-jmb`; the owner,
  17 November 2026: "Please keep building it all out. We will come back and make changes once I go through it."; objectives read 22 November
  2026, Network+ V9 unchanged: "Switching technologies: VLANs, interface configuration, spanning tree, MTU, and jumbo frames"; also
  "Network services: DHCP" for the next one, and "Disaster recovery" for the backup on another floor). Built smaller first: CP-J9 before the
  central DHCP server, which needs a file editor on the server too.
  - **The rack servers** (`js/net/campus.js`): the file server (`fsrv`, `rit-files`) in the data room and the backup server (`bksrv`,
    `rit-backup`) for the 2F closet, a copy kept on another floor (both `kind: "server"`, Linux). Each has two ports: `eno1` on the servers
    VLAN (its gateway the VLAN's), `eno2` on the backup network (no gateway), every port MTU 1500 from the supplier; their netplan file in
    `lx.netplan`. The backup network (`plan.backup`: `BACKUP_V` 80, 180, 238, named BACKUP, 10.b.V.0/24, not routed); the servers' records
    (`plan.srv`: the user and password, each server's addresses, its switch and ports, 5 and 6 on the 1F and 2F access switches). Both in their
    boxes from a stream of their own (seed ^ 0x5e4f), so every earlier part of the campus is drawn as before. CP-J9's start puts the file server
    in (`fileServer`: out of its box, both cables in, the 1F switch's port 5 set up for it in the servers VLAN, logged in first: the switch is
    locked by then).
  - **The Linux command line** (`js/net/linux.js`, pure over the simulation; `tests/campus-jumbo.test.js`): the server's own console (its login
    prompt, `Login incorrect`, the message of the day) or SSH from a desk PC (`ssh user@address` in `cmd.js`; three wrong passwords, `Permission
    denied (publickey,password)`); bash's prompt; `sudo` asking once a session (`Sorry, try again.`, three tries), `sudo -i` and exit; `ip a`,
    `ip -br a`, `ip link`, `ip -s link show eno2` (RX errors), `ip route` (`linkdown`), `ip link set dev eno2 mtu 9000` (root only:
    `RTNETLINK answers: Operation not permitted`; 68 to 9216, the card's range); `ping` Linux's way (`-c`, `-s`, `-M do`, `-I`; without `-c` it's
    stopped after four, `^C`; `local error: message too long, mtu=1500`, `Frag needed and DF set`, `Destination Host Unreachable`; a Windows PC's
    firewall drops it); `ethtool`; `cat` and `ls` (the netplan file is root's only, as on Ubuntu 24.04); `netplan get`, `netplan set
    ethernets.eno2.mtu=9000` (the file only), `netplan apply`; `reboot` (it comes back with its netplan file: what `ip link` alone set is gone;
    over SSH, `closed by remote host`); a restart from the Physical tab the same. What it doesn't take (`ip addr add`, `ip link set ... down`) it
    says so in plain words. `help` lists it all.
  - **The simulation** (`js/net/sim.js`): a server's second port is a node of its own (`nodeOf`), never bridged to its first; its own address,
    hardware address and link (`ifAddr`, `ifNode`, `ifFor`, `addrIn`, `macOf(id, ip)`); a packet leaves by the port on its destination's network.
    **MTU and jumbo frames** (`sized`, which changes nothing): a packet over the sending port's MTU is cut up, or refused with the don't-fragment
    bit; across layer 2 nothing can cut it, so the first switch whose MTU it's over drops it, counted as a giant on the port it came in by
    (`giant`, `giantsAt`; the ping counts them, the check never does), and a receiver whose MTU it's over drops it too (RX errors); the echo comes
    back the same size and has to fit the same way back; a gateway with the don't-fragment bit says it needs fragmenting.
  - **The switches** (`js/net/swcli.js`, both models): `system mtu jumbo <1500-9198>` with the real message ("will not take effect until the
    next reload"), `no system mtu jumbo`, in the running configuration and saved like the rest (`jumbo`); in effect from the next reload
    (`jumboRun`; a reload or a power cut starts it from what was saved); `show system mtu` (with "On next reload" while it waits); `show
    interfaces` gives the MTU in effect and its giants.
  - **CP-J9** (`js/build/campus.js`), 14 lines: the backup server racked and cabled (in its box, a port with no cable, on the wrong port); the
    backup VLAN on all four switches it crosses, named; the trunks it crosses carrying it, both ends, and the bundle; its spanning-tree root
    distribution switch 1, switch 2 next (left to the defaults the 2F access switch's lower address wins); the servers' four switch ports (shut,
    the wrong VLAN, not an edge port with BPDU guard, described); the backup server on the servers network; the two servers reaching each other
    on the backup network; every switch on the way passing jumbo frames, in effect now (none set, set below 9000, set but waiting for a reload);
    each server's eno2 at 9000 and its eno1 left at 1500; a 9000-byte packet both ways without being cut up (what `ping -M do -s 8972` shows:
    refused at the sender, dropped at a switch, dropped at the receiver); kept over a restart (each server's netplan file, each switch's saved
    configuration); still running, jumbo and all, with distribution switch 1 off (on a copy); everyone else working; the four switches saved.
    The records give the switches' passwords and the servers' login. Worked from the console in the data room and the 2F closet, each switch
    saved then reloaded in the maintenance window; then each server's own console.
  - **The page:** a server has a Console tab (the rack's keyboard and screen: every line goes to it, an empty one too) and a Physical tab
    listing its cables, saying its 3D model waits for photographs of a real one (`noModel`): **the rack server's model needs the owner's
    photographs**, asked for on 15 November 2026. **The drawings:** on the logical diagram each server straight below its access switch on a
    row of its own, the 1F and 2F desks stepping aside for their lanes once the file server is in (`srv` in `CAMPUS_LAYOUT`); on the floor plan
    the data room drawn wider (taking room the service desk had spare, its three devices moved along) and the 2F closet wider, the file server
    beside the 1F access switch, the backup server beside the 2F one (`campusBox`, `srvIn`); your laptop, carried there, takes the
    closet's first clear place (a spot of its own beside the backup server was tried and dropped: with the closet wider it changed nothing
    any check could see).
    Every earlier campus work order's two drawings are the same markup as on `main` (96 compared: eight work orders, three campuses, start and
    done, both fonts).
  - **Known, not fixed:** part way through a work order, with your laptop on a distribution switch's console, its CONSOLE label can touch that
    switch's name on the logical diagram. CP-J7's drawings on `main` do the same; only the start and the finish are held to the drawing rule.
    CP-J9's own part way (your laptop on the 2F switch's console) is held to it: the drive measures the floor plan there, in both fonts.
  - **Checks, on its tree:** `npm test` 603 of 603 (`tests/campus-jumbo.test.js` 7: the console and sudo, `ip`, netplan and a reboot, two
    nodes a server, giants and a receiver's drops, the switches' jumbo MTU on both models, SSH to a server; in `tests/campus-jobs.test.js`
    CP-J9's 22 tempting wrong ways each failing its own line for its own cause, and its other right ways); the CP-J9 drive 64 and its
    drawings on six campuses 36; the full drive 7,278 (run alone: run beside the contrast sweep, SB-J5 stopped on a
    click that timed out, and passed on its own); the models 202; AAA on the 36 campus and levels states (5 new), 150,989 text runs;
    every earlier campus work order's two drawings the same markup as `main`'s (96, eight work orders, three campuses, start and done, both
    fonts; the comparison shown to fail with the wider rooms planted on a campus still without its file server: 24 of 24 different).
    Plants, all caught: Node 13 on the engine (jumbo, servers, Linux) and 31 on CP-J9's causes; page 7 (the servers without buttons, a
    server without its Console tab, the servers off the logical diagram, the Physical tab silent about the model, the 2F closet and the data
    room not widened, the desks not stepping aside). The full unit run caught a hint saying "20 of IP header" on a campus with a VLAN 20
    (the rule: no hint names a VLAN's number): rung 2 now says it in words.
- **CP-J10, the central DHCP server, built 22 November 2026 on `save/level4-dhcp`** (worktree `/home/user/e4-jmb`; objectives read 22 November
  2026, Network+ V9 unchanged: "Network services: DHCP"; "Network services issues: address pool exhaustion, and incorrect gateway/IP/subnet
  mask"; "Ports and protocols: DHCP"; "Traffic types: broadcast"). Decided, for the owner to change: ISC's `isc-dhcp-server` (its file is the
  easiest to read; Kea is ISC's newer one), on the file server already in the data room (no new device), edited in nano.
  - **The DHCP server** (`js/net/dhcpd.js`, pure): Ubuntu's sample `/etc/dhcp/dhcpd.conf` (every subnet commented out) and
    `/etc/default/isc-dhcp-server` (`INTERFACESv4=""`), as the package leaves them. The file read as dhcpd reads it: global and per-subnet
    options (`domain-name-servers`, `routers`, `subnet-mask`, `broadcast-address`, `domain-name`), lease times, `authoritative`, subnet
    declarations with their ranges, host declarations (`hardware ethernet`, `fixed-address`); dhcpd's own messages with the line and a caret
    (`semicolon expected.`, noticed on the next word's line as the real one does; `bad subnet number/mask combination.`; `Address range ...
    not on net ...!`; `no option named ... in space dhcp`; dashes in a hardware address; `unexpected end of file`; `Dynamic and static leases
    present for ...`). Starting: each port named in INTERFACESv4 (or every port when it's empty) listened on only if its own network has a
    subnet declaration (`No subnet declaration for eno1 (...)`), `Not configured to listen on any interfaces!`, `No such device`. A lease:
    the subnet holding the relay's address (`unknown network segment` when none), a reservation by hardware address, else the client's own
    address back or the lowest free one, skipping one that answers (`Abandoning IP address ...: pinged before offer`), `no free leases`;
    DNS servers given by name are dropped (it can't look them up).
  - **The server's command line** (`js/net/linux.js`): `nano` (`vi` says the editor here is nano): unwritable without sudo, `[ Error writing
    ...: Permission denied ]`; each write (`^O`, the text with it) and leaving (`^X`) is a line sent to the server, so done, undone and
    replayed like any other. `systemctl` (status as systemd prints it, start, stop, restart, enable and disable with their symlink lines,
    `--now`, is-active, is-enabled; reload not applicable; without sudo, `Interactive authentication required.`); a failed start says nothing
    until you look (the unit runs dhcpd in the foreground); `journalctl -u` (and `-n`); `dhcpd -t -cf`; `dhcp-lease-list`; the leases file.
    The service reads its files only as it starts (a file written later waits for a restart); enabled, it starts at boot (a reboot, or a
    restart from the Physical tab). The installer's first start failed (the sample file) and was disabled: that's in its journal. Before
    CP-J10 the server has none of it (`Unit isc-dhcp-server.service could not be found.`).
  - **The simulation** (`js/net/sim.js`): a relay reaches a server running dhcpd that listens on the port holding the helper address, if
    the answer can get back to the relay's address; DORA in the server's journal (`DHCPDISCOVER ... via`, `DHCPOFFER`, `DHCPREQUEST`,
    `DHCPACK`), the lease (its mask, routers, DNS servers, lease time) on the PC; `ipconfig /release` is `DHCPRELEASE ... (found)`.
  - **CP-J10** (`js/build/campus.js`), 11 lines: the file declares every pooled network (service desk, bench, office, training, the
    classroom) and its own; each subnet's range (the twenty-first to the last), its routers option (the shared standby gateway, the Annex
    core's for the classroom), the campus's DNS servers, a day's lease; the help desk PC's reservation (its hardware address, the records'
    address, outside the range); eno1 only; running from its files as they are, and enabled; every relay to the file server and nowhere else
    (both distribution switches, the Annex core); the edge router's pools and excluded addresses gone; every PC's lease from the file server
    (the help desk PC on its reservation); with distribution switch 1 off, every HQ desk still gets an address and out; everyone works;
    saved. The walk-through: the server first (both files in nano, `dhcpd -t`, `enable --now`), the relays and the edge router from the data
    room, the Annex core from its comms room, then every desk asks again. Its records carry the help desk PC's hardware address and the edge
    router's pools as the work order starts (`v.dh`), so the walk-through needs no simulation.
  - **The page** (`js/desk/window.js`, `css/e4.css`): nano in the Console tab (and over SSH in a PC's Command Prompt): it takes the whole
    terminal, as on the real thing (the scrollback back when it closes); the title bar with the whole path (wrapped in a narrow column) and
    Modified; the status line ([ Read 71 lines ], [ Wrote ... lines ]); Ctrl+O asks File Name to Write (Enter or Ctrl+C), Ctrl+X asks Save
    modified buffer? (Y, N, Ctrl+C) when there are changes; every key a real button too. Inverted title bar and keys, as nano's.
  - **Checks, on its tree:** `npm test` 614 of 614 (`tests/campus-dhcpd.test.js` 9: the parser and dhcpd's messages, starting it, the service and
    the journal, the editor and its permissions, a relayed request and its lease, a port it doesn't listen on, what a lease can't carry and
    an answer with no way back, a check changing nothing, the server before the package; in `tests/campus-jobs.test.js` CP-J10's tempting
    wrong ways, every cause reached, and its other right ways: the sample edited in place, started then enabled, a root shell, the interface
    unquoted, two ranges, DNS in each subnet, a reboot to start it); the CP-J10 drive 73 (every step through the page, nano's other ways out
    over SSH: no sudo, changes not written) and its drawings on six campuses 36; the full drive 7,391 (run alone); the models 202; AAA on the 41 campus and
    levels states (5 new: the install's failure, the question to save, the write refused, dhcpd -t on a broken file, done), 179,057 text runs;
    every earlier campus work order's two drawings the same markup as `main`'s (108: nine work orders, three campuses, start and done, both
    fonts). Plants, all caught: Node 15 on the engine and 42 on CP-J10's causes (three engine ones missed at first, each a test missing:
    named DNS servers, the running server's copy, the answer's way back through a gateway taken away; all closed); page 5 (one missed at first:
    the box's height cap, invisible until a question shows; the drive now checks the answers are on screen, and the editor is 12 rows, so it
    fits a 1000-pixel window with a question showing).
  - **The AAA checker's sampling (`tools/aaa.mjs`, 22 November 2026):** a text's background was sampled from the pixel row and column its box
    starts in, rounded down: a box starting at y 7841.98 took in row 7841, 98% outside it. In the full-page screenshot that row, a pixel off
    from where it was measured, held the anti-aliased edge of a line beside the label's plate, so CP-J9's finished campus failed on a phone
    with easier reading on ("2", 6.47:1) once CP-J10's row moved the page down by 51.22 pixels (`main` landed on a different fraction and
    passed). It now starts at the first pixel whose middle is inside the box and ends where it did, so it only ever samples less: no state
    that passed can fail. Calibrated on that state: it passes; the port numbers moved 3 pixels off their plates onto the lines fail (2.05:1);
    the port numbers pale fail (3.55:1).
  - **Known, not fixed (found 22 November 2026):** with your laptop out of the data room (carried to the Annex in CP-J8 and CP-J10), core
    switch 1's run to distribution switch 2 passes under "Distribution switch 1" on the floor plan. The router (`routeRuns`) has no clear curve
    for it in any state: the data room's four columns of devices, each name about 160 units wide, leave corridors under 10 units, so every
    curve crosses a name's margin; with your laptop in its place the curve chosen stays in the margin, without it the run goes under the plate.
    The finished drawings pass. The fix is a roomier data room, which redraws every campus work order: to be done and checked on its own.
    CP-J10's part-way check measures the plan's names and tiles there, not its runs.
  - **Known, not fixed:** a campus work order takes about four seconds to open or reload (measured on an idle machine: CP-J8 3.5, CP-J9 4,
    CP-J10 3.6 to 3.9): each rebuilds its starting campus by replaying every work order before it. Keeping each one's starting campus would
    make it quick; not done yet. The drive gives a campus reload 15 seconds (it had 5, and a busy machine once went over).
  - **Found on the way, for every level:** three CP-J7 node plants had matched twice since CP-J9 added lines like theirs, and one Linux
    plant no longer matched after `reboot()` gained the service: all four re-aimed and caught (CP-J7's "still in its box" needed a test of its
    own). The plant script's anchors are now all checked to match once.
- **The campus's Ticket Desk and CP-01, built 22 November 2026 on `save/level4-dhcp`** (worktree `/home/user/e4-jmb`; objectives read 22
  November 2026, Network+ V9 unchanged: "Types of attacks: MAC flooding, … rogue devices/services" and the port security that answers them;
  "Cabling and physical interface issues: interface issues (… port status)"). The owner's order: the campus's 15 tickets smallest first, each
  live on its own after its checks, then Level 5.
  - **Every campus ticket starts from the finished campus** (`js/tickets/campus.js`, `settled(seed)`): CP-J10's starting campus with its
    walk-through replayed through the same commands a student types, then frozen as a ticket keeps its moment (no command line left open,
    no trace, not a build). So a campus ticket opens in about four seconds, as a work order does.
  - **Rafiki's records on every campus ticket** (`campusRecords`): the switches by name and management address (the Annex's too, and the
    core switches at their consoles), the edge router by SSH, the enable secret, the console password, the SSH login, the servers, the desks,
    each VLAN (`id · named NAME · network/24 · gateway`, the native and parking VLANs), the desk ports' protections. The drive reads every
    value it types off the card.
  - **CP-01, a desk PC dead to the network after a visitor plugged in** (the smallest: nothing new in the engine). A visitor unplugged a desk
    PC's cable and plugged in their own laptop; port security (sticky, one address, shut down on a violation, from CP-J1) saw a second
    address and err-disabled the port; the PC's cable went back in and the port stayed shut. Three variants: the finance PC (3F), bench PC
    2 (2F), the help desk PC (1F). The evidence: Media disconnected on the PC; over SSH from the other desk PC on that switch, `show
    interfaces status` (err-disabled), `show port-security interface` (Secure-shutdown, one violation, the visitor's address the last
    source), `show port-security address` (the PC's own address still the sticky one). The fix: shut the port and open it again; the
    records' port security kept, running and saved. Wrong fixes: `no shutdown` alone (still err-disabled), the PC restarted or its cable
    reseated, port security switched off or loosened (Mason: it works, but the next stranger's laptop would too), maximum 2, restrict.
  - **The desk:** Level 4 lists its tickets in the queue ("Tier 4 · Campus · tickets", more on the way), on the troubleshooting shelf
    (Campus, locked until the small business is finished) and on the map (Rafiki HQ and the Annex). The card says campus network; the title
    "Site: Rafiki HQ and the Training Annex · Level 4: Campus"; the campus's devices have buttons. A campus ticket on a locked level opens
    HOME-01 instead.
  - **Found and fixed, live since stage 1:** the queue's campus work orders had no titles (`TITLES` in `js/desk/levels.js` left out
    `CAMPUS_JOBS`). A plant puts it back and the drive catches it.
  - **The finance PC 10 units lower on the logical diagram** (`fin` y 590 to 600 in `js/net/campus.js`): with its link dead, both ends'
    diamonds (bigger than the round dots) left no clear place for "NIC" on the short line, and it landed on the 3F printer's line (the drive's
    drawing check). 600 is the least that fits: 610 put "Finance PC" a pixel onto the manager's PC's tile. Every campus drawing has the
    finance PC 10 units lower.
  - **Checks, on its tree:** `npm test` 622 of 622; the campus tickets drive 140 checks; the full drive passed every check but two old
    ones that expected Level 4 to have no tickets (the campus block's and the levels block's lines for Level 4: both now count the tickets),
    and the levels part run again after the fix (`ONLY=business`, 978 checks, passing); the models 202 (run alone); 48 contrast states,
    204,723 text runs, all passing; plants: Node 9, two missed at first and closed with tests (port security weakened only in the saved
    copy; the proof pinged from inside the campus), page 12, all caught.
- **The order of the campus's tickets, re-sized 22 November 2026** (the owner's rule: "Keep building everything in order of increasing in
  size"). The configuration-only faults first, each on one device; anything needing a new device or a console a ticket can't reach yet
  later. BPDU guard (proposed second) needs a spare managed switch at a desk, so it moves to the end. Built so far, on
  `save/level4-tickets` (worktree `/home/user/e4-cpt`), one commit each: CP-02 ef225ed, CP-03 b24e884, CP-04 80f6714.
- **CP-02, no way out of the network since the weekend's maintenance:** the contractor's OSPF hardening template (`passive-interface
  default`, typed again on a switch that already had it, so the exceptions are wiped) on one layer 3 switch, saved. Two variants:
  distribution switch 1 (HQ cut off: its desks get Destination net unreachable from their gateway; the Annex still reaches the
  internet, but not the file server, whose replies go to switch 1) and the Annex core (the classroom cut off). The edge router would be a
  third, but with its OSPF silent it has no way back to any desk, so only its console reaches it, and a campus ticket can't carry your
  laptop to a console yet (no laying cables in a ticket): it comes later with a ticket that adds that. Evidence: tracert stopping at the
  gateway; over SSH (a desk on the switch's own networks reaches it), `show ip ospf neighbor` empty, `show ip protocols` "(every interface
  but none)", `show ip route` "Gateway of last resort is not set", the uplinks up and up. The fix: `no passive-interface` for each port
  facing a router, the template kept, saved. Wrong fixes, each tested: the template taken off (`no passive-interface default`: Mason says
  OSPF now talks out of the desks' ports), one uplink of two, a static default (alone it fails on OSPF; on top of the real fix it works and
  Mason names it), unsaved, distribution switch 2 changed, the classroom's VLAN interface opened instead.
- **CP-03, a whole floor reaches only itself after Saturday's change:** distribution switch 1's standby virtual address for one floor's
  VLAN retyped wrong (.11, .10 or .100) and saved; switch 1 is still active (priority 110, preempt), so the group answers the typo and
  nobody answers the gateway the desks use. Four variants, one a floor. Evidence: the desk's records' gateway in ipconfig, its ping
  unanswered and no ARP entry for it, distribution switch 1's own address on the floor answering, `show standby brief` (on either switch)
  showing the typo. The desk can't reach the switches' management addresses: SSH from a desk on another floor (rung 1 says so). The fix:
  `standby N ip` back to the gateway on switch 1, saved. Wrong fixes: switch 1 out of the group (switch 2 answers alone), switch 2 matched
  to the typo, unsaved, the desk given the typo as its gateway by hand.
- **CP-04, distribution switch 2 still the gateway after Saturday's reload:** nothing is down; the monitoring flagged switch 2 active for
  one VLAN since switch 1's firmware reload (`show version`: up two days, returned to ROM by reload). That group's line on switch 1 was
  changed in the failover test and saved: preempt taken off, or the priority taken back to 100 (a tie with switch 2's, and the higher
  address wins). Each variant's fix is the other's near miss on the board, and tried as a wrong fix. The proof is `show standby brief` on
  switch 1, active for the group. The drive reads 110 off switch 1's lines for its other groups (the records don't give priorities).
  Wrong fixes: the other variant's fix, switch 2 lowered (switch 1 preempts only in the priority variant), switch 2 bounced (switch 1
  active, Mason says only because switch 2 dropped out), unsaved.
- **CP-05, no internet anywhere on the campus, though everything inside works:** the edge router stopped handing its default into OSPF.
  Two causes, each saved on the edge router, each the other's near miss: `default-information originate` tidied away (it still has the
  provider's default), or its internet port left on the line's address typed by hand after the provider's visit (no lease, so no default
  of its own to originate). Every desk's gateway answers Destination net unreachable; distribution switch 1 has both cores FULL and no
  gateway of last resort; SSH to the edge router (it still has routes back) shows which. Rafiki's records now say the internet port takes
  its address, and the provider's default, by DHCP. Wrong fixes: a default typed on the edge router (works in the port variant, and Mason
  says the provider can change its gateway), one on distribution switch 1 (the core has no way out either), the other variant's fix,
  unsaved.
- **CP-06, monitoring says the root bridge moved to an access switch:** the contractor's "standard settings" gave one floor's access switch
  a bridge priority for its VLAN (0, 4096, 8192 or 20480) below distribution switch 1's; it won the root election. Nothing is down. The
  proof is `show spanning-tree vlan` on distribution switch 1: this bridge is the root. Wrong fixes: switch 1 lowered further (Mason: if
  switch 1 fails, the access switch wins, not switch 2), the access switch raised above switch 1 but not to the default, unsaved, another
  VLAN's priority taken off. `spanning-tree vlan N priority 32768` counts as the default.
- **CP-07, monitoring flags the bundle between the distribution switches:** the contractor's standardising left both ends of the LACP
  bundle passive (neither starts it: every link (I), Po1 down at both ends) or forced one end on (it bundles alone, `-` for protocol; the
  other end hears no LACP and stands alone). The records have both ends active, so one end active facing a passive one works and Mason
  says one end still only waits. The drive reads which ends to change off their configurations.
- **CP-08, the bundle between the distribution switches running on one link:** one member changed by itself (a VLAN taken off its allowed
  list, or its native VLAN back to 1) and saved: suspended (s), the bundle up on the other. The drive finds the suspended link and the line
  that differs from Port-channel1's. Wrong fixes: the port-channel changed to match the link, the link bounced, the link taken out of the
  bundle, unsaved.
- **CP-09, an OSPF neighbour on distribution switch 1 not coming up:** one uplink's IP MTU lowered for a VPN test (EXSTART with that core),
  or core switch 1's router ID copied onto distribution switch 1 (no neighbour with core 1). The engine already models both (`ospf.js`).
  Nothing is down. Wrong fixes: the other uplink lowered too, a different router ID typed (works, and Mason says the records let each
  router pick its own), the uplink bounced, unsaved.
- **CP-10, a desk on one floor gets no address since the weekend:** both distribution switches' relay for one floor's VLAN put back from an
  old change sheet: to the edge router's old address (its pools went in CP-J10), the backup server's (one digit off the file server's), or
  none. The desk was restarted and gave itself 169.254; the other desk on the floor keeps its lease. The DHCP server's log has nothing from
  the floor. The fix: both relays, saved, then the desk asks again (the proof renews first). Wrong fixes: one switch only (Mason: with it
  off, the floor gets nothing), an address by hand, unsaved, the edge router as the relay.
- **CP-11, the Annex cut off after its core switch was tidied:** the Annex core's end of the fibre re-addressed and saved: a wider mask
  (/29 or /28: the ends still ping each other, but OSPF won't make neighbours of ends whose masks differ) or an address in another block
  (.37, .38 or .41: the ends can't reach each other). Rafiki's records now give the fibre's addressing ("The fibre between the buildings").
  Wrong fixes: half the fix, a static default on the Annex core (no way back for the replies), the port bounced, unsaved.
- **Plants per ticket:** `tools/plants-campus-tickets.py` (in a throwaway copy). A page plant named for a ticket ("CP-03: ...") runs that
  ticket's drive; the desk's plants run `ONLY=campus-desk`; `KINDS=node` (or page, aaa) runs one kind.

## Objectives

Read from the owner's "All updated Objectives" Google Doc
(`1C9MhVjNyXHJ_i3mPthaBNRmB3A0_sG8UJmzv_H3Lddo`) on 9 October 2026 and again
on 11 October 2026 (unchanged), and shown to the owner; re-read again for
build mode B1 the same day (unchanged). **Re-read it at the start of every build**: this is a
snapshot. Domains: Networking concepts (23%), Network implementation (20%),
Network operations (19%), Network security (14%), Network troubleshooting
(24%). The doc gives no numbered sub-objectives; invent none.

## Photographs for the 3D models

Asked for, not yet received. What was asked: for each item, front, back,
both sides, top, and close-ups of ports, LEDs (powered on) and the label;
straight-on, plain background, soft light, no flash glare; the make and
model (for real dimensions and port layout); real serials, MAC addresses
and Wi-Fi passwords covered. Brand logos stay off the models.

Home level (needed first): cable modem, fiber ONT, home wireless router,
small unmanaged switch, mesh/home access point, RJ45 patch cable ends
(straight-through and crossover, wire order visible), a bad termination and
a damaged cable, coax with F-type, RJ11 beside RJ45, keystone wall jack,
desktop PC back panel and laptop Ethernet port, network printer, smart TV
and IP camera ports, cable tester (both units), crimper, punch-down tool,
tone and probe, loopback plug.

Later levels: managed 24/48-port switch with SFP slots and console port,
PoE switch, business router, firewall appliance, ceiling access point,
patch panel (front and punch-down back), 2-post and 4-post racks, 1U/2U
server front and back, NAS, rack UPS, SFP/SFP+ transceivers, fiber
connectors SC/LC/ST/MPO, single-mode and multimode fiber patch cables, DAC
cable, BNC, console cable, demarc/smart jack, 66 and 110 blocks, badge
reader, door lock, security camera.

## Footer

The full Cyber Warrior Program wording, as on every site.
