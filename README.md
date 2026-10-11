# The E4 Mafia Network

Network+ Under the Hood: an interactive home and office network you troubleshoot from the command line, part of the Cyber Warrior Program.

- `index.html` — the Ticket Desk (students start here)
- `lab-bench.html` — the same labs, on shelves by exam domain
- `service-map.html` — Rafiki's service area, site by site

Instructors: the Instructor menu (PIN) opens demonstrations, answers and progress tools.

Static HTML, CSS and vanilla JavaScript; nothing to build. GitHub Pages serves `main`. The 3D models use three.js, kept in `assets/three/` and loaded only when a device's Physical tab is opened.

Checks (developer tools, not needed to run the site):

- `npm test` — the network engine and every ticket, under Node
- `node tools/drive.mjs` — works every ticket end to end through the page (needs Playwright's Chromium)
- `node tools/aaa.mjs tools/aaa-states.json` — WCAG AAA contrast on painted pixels
- `node tools/models.mjs` — the live 3D models in the Physical tab: each fault's lights and plugs as actually drawn (WebGL, software)

Cyber Warrior Program — built by an instructor, for students, to make certification study more interactive. For educational purposes only. Not affiliated with, endorsed by, or sponsored by CompTIA®. All trademarks belong to their respective owners.
