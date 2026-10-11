# The E4 Mafia Network — project context

Read this first in any session touching this repo. The global rules in
`/root/.claude/CLAUDE.md` (and `/root/.claude/exam-prep-coach.md`) apply
here and win over anything below.

**Live site:** https://rafikiscyent888.github.io/The-E4-Mafia-Network/
**Status (11 October 2026): the real site, builds 1 to 3, is live: all ten home tickets, and the live 3D models in every Physical tab** (not yet linked
from the Under the Hood tile). See "The real site" below. The owner, 11
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

**Checks:** `npm test` (Node: every ticket on 150 houses: the fault shows
in the commands themselves, the board, the real fix and the tempting
wrong fixes, proof only after the fix and never from a self-ping, the
ladder, exact replay, no hint names the answer); `node tools/drive.mjs`
(the page: every ticket worked end to end on three houses each, through
the terminal, the forms and the Physical tab; the rungs; red marked three
ways; a wrong fix not solving; putting the network back; reload keeps
progress; the three views; easier reading persisting); AAA on painted
pixels across 44 states plus scrolled positions, measured with WebGL on so
the 3D model's buttons and the Enlarge window are measured too (and one
state with it off, for the fallback); `node tools/models.mjs` (the 3D
models in a real browser: the colour actually drawn at each light the
student must read, sampled from the rendered pixels; pulled plugs out of
their ports by distance; the loose coax off its thread; empty ports empty;
DS really blinking; one WebGL context however many tabs are opened;
Enlarge; the no-WebGL fallback). Each check was shown to fail on planted
defects (the 3D checker: lights ignoring the sim, amber drawn green, plugs
never pulled, the coax never loosened, the photo's cables left in, damage
never drawn, a new renderer on every open, lights never blinking).

## Objectives

Read from the owner's "All updated Objectives" Google Doc
(`1C9MhVjNyXHJ_i3mPthaBNRmB3A0_sG8UJmzv_H3Lddo`) on 9 October 2026 and again
on 11 October 2026 (unchanged), and shown to the owner. **Re-read it at the start of every build**: this is a
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
