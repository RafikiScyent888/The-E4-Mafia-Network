# The E4 Mafia Network — project context

Read this first in any session touching this repo. The global rules in
`/root/.claude/CLAUDE.md` (and `/root/.claude/exam-prep-coach.md`) apply
here and win over anything below.

**Live site:** https://rafikiscyent888.github.io/The-E4-Mafia-Network/
**Status (27 October 2026): Level 3 (the small business) goes live stage by stage: stage 1 (the business, its router and switch on the page, work orders SB-J1 and SB-J2), stage 2 (SB-J3, guest Wi-Fi on a ceiling access point: the access point's page through a business PC's web browser, the visitor's phone, the ring in 3D), stage 3 (SB-J4, the back of house on its own switch over a trunk with its allowed list and native VLAN) and stage 4 (SB-J5, two dome cameras on PoE injectors on a VLAN of their own, each one's fixed address set on its own page, port forwards tested from the manager's phone on mobile data) are live; the level opens once the small office is finished, with `planned: 25` until all its work orders and tickets exist. See "Level 3, the small business" below.**
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
- **Instructor tools behind PIN 3693:** choose a specific fault for a class
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

**The instructor tools** (menu: Instructor; PIN 3693, the owner's
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
- **The PIN stays 3693** (owner, 12 October 2026: "The pin is to be 3693").
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
tools: a wrong PIN refused, 3693 unlocking, the demo opening the chosen
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
