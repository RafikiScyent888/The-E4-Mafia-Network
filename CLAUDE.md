# The E4 Mafia Network — project context

Read this first in any session touching this repo. The global rules in
`/root/.claude/CLAUDE.md` (and `/root/.claude/exam-prep-coach.md`) apply
here and win over anything below.

**Live site:** https://rafikiscyent888.github.io/The-E4-Mafia-Network/
**Status (11 October 2026): the real site, builds 1 to 4 and build mode, is live: fifteen home tickets, the live 3D models in every Physical tab, and the instructor tools (PIN), build mode J1 to J10 and free build**, linked
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
