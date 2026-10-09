# The E4 Mafia Network — project context

Read this first in any session touching this repo. The global rules in
`/root/.claude/CLAUDE.md` (and `/root/.claude/exam-prep-coach.md`) apply
here and win over anything below.

**Live site:** https://rafikiscyent888.github.io/The-E4-Mafia-Network/
**Status (9 October 2026):** nothing built yet. Decisions are agreed (below);
next is a preview of the home-level workspace and the first ticket, for the
owner's go-ahead before any build.

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

## Objectives

Read from the owner's "All updated Objectives" Google Doc
(`1C9MhVjNyXHJ_i3mPthaBNRmB3A0_sG8UJmzv_H3Lddo`) on 9 October 2026 and shown
to the owner. **Re-read it at the start of every build**: this is a
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
