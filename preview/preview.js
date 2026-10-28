/* The model preview page: pick a model, turn it, read what it is built
   from. window.__preview lets a script take the renders for the owner. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import * as SURF from "../assets/models/surface.js";
import * as GEAR from "../assets/models/home-gear.js";
import * as CAB from "../assets/models/cables.js";
import * as END from "../assets/models/endpoints.js";
import * as TOOL from "../assets/models/tools.js";
import * as OFF from "../assets/models/office-gear.js";
import * as BIZ from "../assets/models/business-gear.js";

/* how a cable lies on the bench behind its plug: [x, y, dz] back from the jacket's end, dropping to the bench */
const RUN_L = [[0, -0.6, 8], [0, -2.0, 18], [-3, -2.55, 34], [-14, -2.55, 62], [-36, -2.55, 100], [-64, -2.55, 140]];
const RUN_R = [[0, -0.6, 8], [0, -2.0, 18], [3, -2.55, 34], [14, -2.55, 62], [36, -2.55, 100], [64, -2.55, 140]];
const RUN_SIDE = [[0, -0.6, 8], [0, -2.0, 18], [0.5, -2.55, 40], [2, -2.55, 80], [3, -2.55, 120]];
const RUN_L11 = [[0, -0.6, 6], [0, -1.8, 14], [-3, -2.4, 28], [-12, -2.4, 54], [-30, -2.4, 90], [-56, -2.4, 130]];
const MODELS = [
  { id: "modem", view: [0.95, 0.42, -1.0], light: [0.6, 1.3, -1.0], frame: [-60, 0, -110, 60, 180, 90], group: "Network gear", name: "Cable modem", build: GEAR.cableModem,
    photo: "From your photo of the cable modem, front and back, cables plugged in as photographed.",
    shows: ["The rounded top, the glossy face: POWER, DS, US (green), ONLINE (blue), LINK/ACT", "Back: the label (serial and MAC covered), CABLE IN with the white coax screwed on, the yellow ETHERNET port with its yellow cable, RESET, the power cord", "Vent rows near the top of each side, the slatted panel below them"],
    standards: ["The brand where your photo has one is replaced by CABLE MODEM / DOCSIS 3.0"] },
  { id: "modem-front", view: [0.45, 0.25, 1], light: [0.5, 1.2, 1.0], frame: [-40, 10, 60, 40, 170, 90], group: "Network gear", name: "Cable modem, front", build: GEAR.cableModem,
    photo: "The same modem from the front.",
    shows: ["ONLINE blue: the modem has registered with the provider. DS and US are the downstream and upstream channels."] },
  { id: "ont", stage: "none", view: [0.45, 0.05, 1], light: [-0.4, 1.0, 1.1], frame: [-75, -40, 0, 75, 205, 40], group: "Network gear", name: "Fiber ONT", build: GEAR.fiberOnt,
    photo: "From your photo of the fiber ONT on the wall.",
    shows: ["FIBER ONT underlined, HOME TERMINAL", "POWER, PON, LINK/ACT, ETHERNET green; ALARM off", "Underneath: the green SC/APC fiber connector, the yellow patch cable and the 12V cord hanging down", "Vent slits and the barcode down the side"],
    standards: ["Green on a fiber connector means APC (angle-polished): it must only ever mate with green", "The fiber cord's jacket is yellow, the colour for single-mode (TIA-598); your photo's cord is green"] },
  { id: "router", view: [0.3, 0.32, -1], light: [0.5, 1.3, -1.0], frame: [-150, 0, -200, 150, 230, 90], group: "Network gear", name: "Home wireless router", build: GEAR.homeRouter,
    photo: "From your photo of the router's back panel.",
    shows: ["Back: INTERNET (WAN) in yellow, LAN 1-4 in their printed frame, RESET, WPS, DC IN", "Cables in INTERNET (yellow), LAN 1 and LAN 2 (black), LAN 4 (white) and the power cord; LAN 3 empty, its lights off", "Four hinged antennas, the label and barcode sticker underneath (Wi-Fi details covered)"] },
  { id: "router-back", focus: "panel:Back ports", view: [0, 0.18, -1], light: [0.3, 1.2, -1.0], group: "Network gear", name: "Router, back ports close-up", build: GEAR.homeRouter,
    photo: "The same router, close in on its ports.",
    shows: ["The WAN port is where the modem's cable goes; the LAN ports feed the home"] },
  { id: "switch", view: [0.6, 0.4, 1], light: [0.6, 1.3, 0.9], frame: [-110, 0, -60, 90, 40, 140], group: "Network gear", name: "5-port unmanaged switch", build: function () { return GEAR.unmanagedSwitch(); },
    photo: "From your photo of the two stacked 5-port switches.",
    shows: ["Metal case, cover over base, screws on the sides", "Power light; ports 1-5 in a silver bezel, two green lights each; UNMANAGED 5-PORT GIGABIT SWITCH above", "Patch cables in ports 1-4 (yellow, grey, grey, dark grey); port 5 empty, its lights off", "Angled side vents; the power jack and cord on the side"] },
  { id: "switch-stack", view: [0.55, 0.3, 1], light: [0.6, 1.3, 0.9], frame: [-90, 0, -50, 90, 66, 80], group: "Network gear", name: "Two switches stacked", build: GEAR.switchStack,
    photo: "As in your photo: two switches, one on the other.",
    shows: ["Unmanaged switches simply join more devices to the network: no settings, no command line"] },
  { id: "mesh", view: [-0.75, 0.3, -1], light: [-0.6, 1.3, -0.9], frame: [-70, 0, -110, 70, 160, 70], group: "Network gear", name: "Mesh Wi-Fi node", build: function () { return GEAR.meshNode(); },
    photo: "From your photo of the mesh nodes, with its callouts.",
    shows: ["The back plate: vent dots, WAN / INTERNET (yellow cable), LAN (black cable, link light on), 12V DC IN with its polarity mark", "The cooling vents round the top cap; vents round the foot", "The side strip: vents, the amber light, RESET", "The status light ring at the front; the label, pads and keyhole underneath"] },
  { id: "mesh-front", view: [0.5, 0.25, 1], light: [0.5, 1.2, 1.0], group: "Network gear", name: "Mesh node, front and side", build: function () { return GEAR.meshNode(); },
    photo: "The same node from the front and its side strip.",
    shows: ["Status light green: a good link to the next node"] },
  { id: "mesh-weak", view: [-1, 0.25, 0.45], light: [-0.6, 1.3, 0.9], group: "Network gear", name: "Mesh node, weak link (amber)", build: function () { return GEAR.meshNode("weak"); },
    photo: "The same node with its lights amber, as in your photo's distant node.",
    shows: ["Amber on the side strip and the front ring: placed too far from the next node"] },
  { id: "injectors", view: [0.08, 0.42, 1], light: [0.5, 1.3, 1.0], frame: [-200, 0, -80, 200, 70, 120], group: "Network gear", name: "The two PoE injectors, as photographed", build: function () { const g = new THREE.Group(), a = GEAR.poeInjector(), b = GEAR.poeInjectorDual(); a.position.x = -95; b.position.set(80, 0, -4); g.add(a, b); return g; },
    photo: "From your photo of the two injectors side by side (11 October 2026).",
    shows: ["Single-port PoE injector on the left, dual-port PoE+ injector on the right, cables in as photographed", "The photo's wording and layout; the standards' own figures printed (802.3af 48 V 15.4 W; 802.3at 54 V 30 W a port)", "The logo badge on the PoE+ lid left off, as ruled"] },
  { id: "injector", view: [0.12, 0.3, 1], light: [0.5, 1.3, 1.0], frame: [-110, 0, -80, 60, 50, 120], group: "Network gear", name: "Single-port PoE injector (802.3af)", build: function () { return GEAR.poeInjector(); },
    photo: "The left one in your photo.",
    shows: ["SINGLE-PORT GIGABIT PoE INJECTOR and its model top left; POWER (blue) and STATUS (green) square lights", "DATA IN and DATA + POWER OUT in silver jacks with no lights; the flow line with the power bolt under them", "PoE Power Output: DC 48V ⎓ 0.32A along the bottom (the photo's 50V 1A is not an 802.3af figure)", "Ribbed grooves down both edges of the lid; the power cord into the left side with its ribbed strain relief"] },
  { id: "injector-dual", view: [0.12, 0.3, 1], light: [0.5, 1.3, 1.0], frame: [-70, 0, -80, 150, 64, 120], group: "Network gear", name: "Dual-port PoE+ injector (802.3at)", build: function () { return GEAR.poeInjectorDual(); },
    photo: "The right one in your photo.",
    shows: ["The rugged shell: chamfered corners, the bumper rim round the front panel and the lid, grey accents at the lid's corners", "Two DATA IN jacks, then DATA + POWER OUT over two jacks with green corner lights; Active PoE+ top right", "The photo's arrows under the jacks printed as the pair numbers (1 with 1, 2 with 2)", "Total PoE Power Budget DC 54V ⎓ 1.1A (60W) and Port max DC 54V ⎓ 0.56A (30W): the 802.3at figures", "The power cord into the right side with its flared moulding"] },
  { id: "rj45b", stage: "concrete", view: [0.25, 0.75, 0.62], light: [0.3, 1.4, 0.7], frame: [-8, 0, -14, 8, 10, 12], group: "Cables and connectors", name: "RJ45, straight-through (T568B)", build: function () { return CAB.onBench(function () { return CAB.rj45Plug({ standard: "T568B", run: RUN_L }); }, 5.6); },
    photo: "From your photo of the straight-through and crossover ends, on the bench as photographed.",
    shows: ["Pin 1 to 8: white/orange, orange, white/green, blue, white/blue, green, white/brown, brown", "Seen through clear plastic: the wires run to the front, each under its gold contact", "The jacket held inside the plug by the strain relief; the collar and its side bosses at the back"],
    standards: ["Wire order exactly as TIA-568 T568B, not the photo's pixels"] },
  { id: "rj45a", stage: "concrete", view: [0.25, 0.75, 0.62], light: [0.3, 1.4, 0.7], frame: [-8, 0, -14, 8, 10, 12], group: "Cables and connectors", name: "RJ45, crossover end (T568A)", build: function () { return CAB.onBench(function () { return CAB.rj45Plug({ standard: "T568A", run: RUN_R }); }, 5.6); },
    photo: "From the same photo: the crossover cable's T568A end.",
    shows: ["Pin 1 to 8: white/green, green, white/orange, blue, white/blue, orange, white/brown, brown", "A crossover is T568A on one end and T568B on the other"],
    standards: ["Wire order exactly as TIA-568 T568A"] },
  { id: "pair-ab", stage: "concrete", view: [0, 0.62, 0.78], light: [0.2, 1.4, 0.8], frame: [-26, 0, -8, 26, 10, 8], group: "Cables and connectors", name: "Straight-through beside crossover", build: function () {
      const g = new THREE.Group(); const a = CAB.onBench(function () { return CAB.rj45Plug({ standard: "T568B", run: RUN_SIDE }); }, 5.6); a.rotation.y = Math.PI / 2; a.position.x = -14;
      const b = CAB.onBench(function () { return CAB.rj45Plug({ standard: "T568A", run: RUN_SIDE }); }, 5.6); b.rotation.y = -Math.PI / 2; b.position.x = 14; g.add(a, b); return g; },
    photo: "As in your photo: the two ends nose to nose.",
    shows: ["Left, T568B: the orange pair on pins 1-2. Right, T568A: the green pair on pins 1-2. Same cable, different pin-out."] },
  { id: "rj45bad", stage: "concrete", view: [-1, 0.32, 0.22], light: [-0.4, 1.4, 0.8], frame: [-8, 0, -48, 8, 13, 13], group: "Cables and connectors", name: "RJ45, bad termination", build: function () { return CAB.onBench(function () { return CAB.rj45Plug({ standard: "T568B", termination: "bad", run: RUN_SIDE }); }, 5.6); },
    photo: "From your photo: jacket out, too much untwist.",
    shows: ["The jacket stops well outside the plug, its end ragged, a few loose fibres", "The strain relief grips bare wires, not jacket: one pull and they come out", "The pairs untwisted far too far: crosstalk"] },
  { id: "damaged", stage: "concrete", view: [0.05, 0.22, 1], light: [0.3, 1.4, 0.8], frame: [-80, 0, -10, 80, 28, 12], group: "Cables and connectors", name: "Damaged cable", build: function () { return CAB.onBench(CAB.damagedCable, 3.05); },
    photo: "From your photo: kinked and crushed (category fail).",
    shows: ["A hard kink with the pairs pulled out of the tear in a loop", "A crushed flat section, torn open, broken conductors and bare copper splayed out", "Flakes of jacket and snipped wire on the bench", "A run like this fails the cable tester"] },
  { id: "rj11", stage: "concrete", view: [0.25, 0.75, 0.62], light: [0.3, 1.4, 0.7], frame: [-6, 0, -11, 6, 8, 9], group: "Cables and connectors", name: "RJ11 (phone)", build: function () { return CAB.onBench(function () { return CAB.rj11Plug({ lines: 2, run: RUN_L11 }); }, 4.4); },
    photo: "From your photos of RJ11 beside RJ45.",
    shows: ["Six positions, four wires: black, red, green, yellow (two phone lines)", "Smaller than RJ45, on round grey cable as photographed"],
    standards: ["RJ11 is a 6-position plug: 2 wires for one line, 4 for two. Your photo's “4-pin” label is a common mistake, not used here."] },
  { id: "pair", stage: "concrete", view: [0, 0.75, 0.66], light: [0.2, 1.4, 0.8], frame: [-18, 0, -14, 18, 10, 12], group: "Cables and connectors", name: "RJ11 beside RJ45", build: function () {
      const g = new THREE.Group(); const a = CAB.onBench(function () { return CAB.rj11Plug({ lines: 2, run: RUN_L11 }); }, 4.4); a.position.x = -10;
      const b = CAB.onBench(function () { return CAB.rj45Plug({ standard: "T568B", jacket: 0x1c1d20, run: RUN_R }); }, 5.6); b.position.x = 10; g.add(a, b); return g; },
    photo: "As in your photos: the two side by side for size, on the bench.",
    shows: ["RJ11: 6 positions, 9.6 mm wide, on grey cable", "RJ45: 8 positions, 11.7 mm wide, on black Cat6"] },
  { id: "coax", stage: "concrete", view: [0.75, 0.3, 0.6], light: [0.5, 1.3, 0.8], frame: [-8, 0, -24, 8, 12, 14], group: "Cables and connectors", name: "Coax, F-type connector", build: function () { return CAB.onBench(function () { return CAB.coaxF({ run: [[0, -0.6, 10], [0, -2.0, 25], [-4, -2.7, 50], [-16, -2.7, 90], [-40, -2.7, 140]] }); }, 6.15); },   /* resting on a flat of the hex */
    photo: "From your photo of the coax F-connector.",
    shows: ["A compression F-type on black RG6: sleeve, knurled body, 7/16-inch hex nut", "The copper centre conductor standing just proud of the nut"],
    standards: ["A male F-type's nut is threaded on the INSIDE (it screws onto the modem's threaded barrel). Your photo shows threads outside; the model follows the real connector."] },
  { id: "msw", view: [0.42, 0.42, 1], light: [0.5, 1.3, 1.0], frame: [-250, 0, -140, 250, 50, 260], group: "Small office (level 2)", name: "Managed 24-port switch, 4 SFP", build: function () { return OFF.managedSwitch(); },
    photo: "From your photo of the managed switch, front (11 October 2026).",
    shows: ["MANAGED SWITCH 24-PORT + 4 SFP and MODEL: MSW-2800G; the Speed/Link and Link/Activity key", "24 ports in two rows in their grey frames, green lights in each jack's corners; a grey patch cable in port 10", "SFP1 to SFP4 in their bracket: fiber in three (grey, grey, orange), the fourth empty", "Power and fan lights under the power symbol; CONSOLE over the console port, MGMT under it; the USB console port; SYSTEM and POWER", "Silver rack ears with their slots; vent holes down the sides"] },
  { id: "msw-front", focus: "panel:Front", view: [0.06, 0.12, 1], light: [0.3, 1.2, 1.0], group: "Small office (level 2)", name: "Managed switch, front close-up", build: function () { return OFF.managedSwitch(); },
    photo: "The same switch, close in on its front.",
    shows: ["Ports numbered as stacked jacks are: odd on top, even below (the photo's numbering repeats; a 24-port switch has 12 columns)"] },
  { id: "msw-rear", view: [0.5, 0.3, -1], light: [0.5, 1.3, -1.0], frame: [-40, 0, -150, 250, 50, -110], group: "Small office (level 2)", name: "Managed switch, rear", build: function () { return OFF.managedSwitch(); },
    photo: "From your photo of the switch's rear.",
    shows: ["The name, the AC inlet, AC INPUT 100-240V~ 2A (the photo's ⎓ is the DC sign; this input is AC)", "The fan with its guard and four screws, VENTILATION beside it", "The regulatory label and the MAC label, the address covered"] },
  { id: "rack", stage: "none", view: [0.25, 0.12, 1], light: [-0.4, 1.1, 1.0], frame: [-270, 0, -60, 270, 320, 60], group: "Small office (level 2)", name: "6U wall rack, as photographed", build: function () { return OFF.wallRack6U(); },
    photo: "From your photo of the wall rack (11 October 2026).",
    shows: ["The light grey frame on the wall, the front rails with square holes three to a U", "The 24-port Cat6 patch panel: four groups of six, a write-on tab over each jack, its number under it; grey cords looping down from ports 6 to 13", "The rack's own panel: 6U Wall Rack and its marks", "The vented shelf with the 8-port gigabit switch: its grid of lights, seven grey cords looping down"] },
  { id: "rack-office", stage: "none", view: [0.25, 0.12, 1], light: [-0.4, 1.1, 1.0], frame: [-270, 0, -60, 270, 320, 60], group: "Small office (level 2)", name: "The small office's rack: patch panel and managed switch", build: function () { return OFF.wallRack6U({ managed: true }); },
    photo: "The same rack as the small office will use it: the managed switch mounted under the patch panel.",
    shows: ["Short blue cords from patch panel ports 1 to 10 down to switch ports 1 to 10", "The empty shelf below, ready for more gear"] },
  { id: "console", view: [0.1, 0.62, 1], light: [0.4, 1.3, 0.9], frame: [-220, 0, -100, 480, 120, 470], group: "Small office (level 2)", name: "Console cable and serial adapters", build: function () { return OFF.consoleKit(); },
    photo: "From your photo of the console cable (11 October 2026).",
    shows: ["The grey console cable: its RJ45 in the switch's CONSOLE port, the cord coiled on the bench", "Its DB-9 (female: the computer end) joined to the USB serial adapter's DB-9 (male), metal hoods with knurled thumbscrews", "The adapter's grey cord to its USB-C plug in the laptop", "A USB-A serial adapter lying in front, for a computer without USB-C", "The photo's captions are left off the parts; a console runs at 9600 baud by default (the caption's 115200 is not the default)", "The switch's brand mark in the photo is left off"] },
  { id: "br", view: [0.42, 0.28, 1], light: [0.5, 1.3, 1.0], frame: [-250, 0, -160, 250, 50, 300], group: "Small business (level 3)", name: "Business router (BR-4200)", build: function () { return BIZ.businessRouter(); },
    photo: "From your photo of the router in its rack, front (19 October 2026). The photo shows the front only: the rear and sides follow the usual design and are for you to check.",
    shows: ["The slate-blue 1U face: the vent at the left; PWR, SYS, ACT and ALM lights (ALM amber, off) and the recessed RESET", "WAN 0/8 and 0/9: two fibre (SFP) slots stacked, orange multimode cords in both, their link and activity lights, the yellow strip under them", "CON: the console port, the USB console port under it", "Eight copper gigabit ports, GE 0/0 to 0/7 on the yellow strip, yellow and blue patch cables in six, the long vent above them", "USB 0 and USB 1; the power section: the rocker, the AC inlet, PSU and FAN lights, the fan", "Not in the photo, drawn as usual: the rear (vents, the ground stud, the labels with the serial number and MAC address covered) and the sides (vents, rack ears)", "The photo's brand mark and series name are left off: BUSINESS ROUTER and MODEL: BR-4200, our own"] },
  { id: "br-front", focus: "panel:Front", view: [0.06, 0.1, 1], light: [0.3, 1.2, 1.0], group: "Small business (level 3)", name: "Business router, front close-up", build: function () { return BIZ.businessRouter(); },
    photo: "The same router, close in on its front.",
    shows: ["Every port named as the command line names it: GigabitEthernet0/0 to 0/7 (copper), 0/8 and 0/9 (fibre)"] },
  { id: "br-rear", view: [0.5, 0.3, -1], light: [0.5, 1.3, -1.0], frame: [-40, 0, -170, 250, 50, -130], group: "Small business (level 3)", name: "Business router, rear (not in the photo)", build: function () { return BIZ.businessRouter(); },
    photo: "Not in your photo: drawn as such a router's rear usually is, for you to check.",
    shows: ["Three vents, the brass ground stud, the regulatory label and the MAC label (covered)"] },
  { id: "ap", stage: "none", view: [0.3, -0.42, 1], light: [0.4, -1.2, 0.8], frame: [-180, -60, -180, 180, 30, 180], group: "Small business (level 3)", name: "Ceiling access point, as photographed", build: function () { return BIZ.ceilingAP(); },
    photo: "From your photo of the access point on the ceiling (19 October 2026), seen from below as in the photo.",
    shows: ["The white disc with its rounded edge, the light ring round the middle (blue: on the network)", "On its metal mounting plate under the ceiling tile, the white cable coming in over the plate", "The photo's centre mark (a brand's) is left off"] },
  { id: "ap-top", stage: "none", view: [0.2, 1, 0.3], light: [0.3, 1.3, 0.6], frame: [-110, -40, -110, 110, 10, 110], group: "Small business (level 3)", name: "Ceiling access point, its top (not in the photo)", build: function () { return BIZ.ceilingAP({ mounted: false, cable: false }); },
    photo: "Not in your photo: its top, drawn as such an access point's usually is, for you to check.",
    shows: ["The recessed port bay: ETH (PoE IN), the one network port, powered over its cable; the RESET pinhole", "The four lugs that twist into the mounting plate; the label (MAC and serial covered)"] },
  { id: "cam-ceil", stage: "none", view: [0.35, -0.5, 1], light: [0.4, -1.2, 0.8], frame: [-85, -85, -85, 85, 10, 85], group: "Small business (level 3)", name: "Ceiling dome camera, as photographed", build: function () { return BIZ.ceilingDome(); },
    photo: "From your photo of the dome camera on the ceiling (26 October 2026), seen from below as in the photo.",
    shows: ["The white housing and its trim ring under the ceiling tile, the white grid round the tile", "The smoked bubble, and inside it the black eyeball: the lens, and the ring of twelve infrared lights round it", "The small blue status light on the housing's side (from your second photo): on the network"] },
  { id: "cam-ceil-room", stage: "none", view: [0.6, -0.55, 0.9], light: [0.4, -1.2, 0.8], frame: [-750, -100, -200, 200, 20, 760], group: "Small business (level 3)", name: "Ceiling dome camera, in its ceiling", build: function () { return BIZ.ceilingDome(); },
    photo: "The same camera, further back: the ceiling round it as in your photo.",
    shows: ["The suspended ceiling's fissured tiles and the white T-bar grid between them", "A flat LED panel light in one tile and a smoke alarm on another, as in the photo"] },
  { id: "cam-ceil-top", stage: "none", view: [0.35, 1, 0.75], light: [0.3, 1.3, 0.6], frame: [-20, 0, -140, 380, 140, 70], group: "Small business (level 3)", name: "Ceiling dome camera, above the tile (not in the photo)", build: function () { return BIZ.ceilingDome(); },
    photo: "Not in your photo: what a technician sees lifting the tile, drawn as such a camera usually comes, for you to check.",
    shows: ["The steel backing plate the camera screws through, the pigtail up out of its grommet", "The pigtail's Y-splitter: the LAN lead to its waterproof RJ45 coupler (PoE in: the camera's power comes over the network cable), the DC lead to its capped jack, never used", "The network cable plugged in, its waterproof sleeve slid back, its ID flag (CAM-01, WAITING AREA); plenum-rated (CAT6 CMP PLENUM printed on it), as cable above a ceiling must be, up into a J-hook on its hanger wire rather than lying on the tiles", "A tag on the pigtail: MAC and serial covered"] },
  { id: "cam-ceil-split", stage: "none", view: [0.15, 1, 0.6], light: [0.3, 1.3, 0.6], frame: [30, 10, -10, 120, 30, 60], group: "Small business (level 3)", name: "Ceiling dome camera, its pigtail close up (not in the photo)", build: function () { return BIZ.ceilingDome(); },
    photo: "Close in on the camera's pigtail above the tile, for you to check.",
    shows: ["The pigtail's printed jacket; the moulded Y-splitter where it divides, a ribbed strain relief on each lead", "The DC lead's barrel jack, knurled, its rubber cap on", "The waterproof coupler's thread and ribbed boot, the tag with the MAC covered"] },
  { id: "cam-wall-leads", view: [0.4, 0.1, 1], light: [0.5, 1.2, 1.0], frame: [-70, 20, 0, 70, 210, 90], group: "Small business (level 3)", name: "Wall dome camera, its cables close up", build: function () { return BIZ.wallDome(); },
    photo: "Close in on the cables under the junction box.",
    shows: ["The LAN pigtail out of the left gland to its coupler, hanging open end down so rain runs off below it", "The spare DC lead out of the right gland, brought across and tied back to the pigtail with a cable tie, its jack capped", "The network cable plugged in, its waterproof sleeve slid back, its ID flag (CAM-02, BACK DOOR), then along the wall in nail-in clips; its jacket printed CAT6 CMR RISER"] },
  { id: "cam-wall", view: [0.45, 0.12, 1], light: [0.5, 1.2, 1.0], frame: [-130, 60, -10, 130, 360, 150], group: "Small business (level 3)", name: "Wall dome camera, as photographed", build: function () { return BIZ.wallDome(); },
    photo: "From your photo of the dome camera on the junction box (26 October 2026). The brand mark on the housing is left off.",
    shows: ["The grey junction box screwed to the concrete wall at its four corners, the conduit coming down into its top", "The white housing on the box's front, looking out and down: the smoked bubble, the black eyeball, its lens and infrared ring", "The blue status light beside the bubble, as in the photo", "Two cable glands in the box's bottom: out of one the pigtail and its RJ45 coupler with the network cable in it, out of the other the capped DC lead"] },
  { id: "cab", view: [-0.42, 0.06, 1], light: [-0.3, 1.2, 1.0], frame: [-330, 380, -60, 330, 1720, 60], group: "Small business (level 3)", name: "Closet cabinet, as photographed", build: function () { return BIZ.closetCabinet(); },
    photo: "From your photo of the locking cabinet (28 October 2026), seen from the front left as in the photo.",
    shows: ["The black front door: a hexagon perforation inside a solid frame, the frame wider down the latch side", "Its hinges down the left edge, the silver-grey side panel beside them", "Through the perforation, the closet's gear on its rails: the patch panel, the managed switch, the router", "The latch on the right, the key in it with its tag hanging below"] },
  { id: "cab-latch", view: [0.02, 0.04, 1], light: [-0.2, 1.1, 1.0], frame: [150, 900, -10, 310, 1070, 40], group: "Small business (level 3)", name: "Closet cabinet, its latch close up", build: function () { return BIZ.closetCabinet(); },
    photo: "From your close-up of the latch (28 October 2026).",
    shows: ["The black housing with rounded corners, held by two screws: top centre and lower right", "The black paddle handle folded flat in its left half, under its pivot block", "The chrome key cylinder at the upper right, the key in it", "The split ring, the blue tag with its paper insert (the writing on it left off), the spare key on the ring"] },
  { id: "cab-locked", view: [0.02, 0.04, 1], light: [-0.2, 1.1, 1.0], frame: [150, 900, -10, 310, 1070, 40], group: "Small business (level 3)", name: "Closet cabinet, locked and the key taken away", build: function () { return BIZ.closetCabinet({ locked: true, key: false }); },
    photo: "The same latch as it should be left: locked, and the key taken away (in SB-J6, a key left hanging in the lock doesn't count as locked).",
    shows: ["The keyway turned across: locked", "No key, ring or tag in the lock"] },
  { id: "cab-open", view: [0.55, 0.18, 1], light: [0.3, 1.2, 1.0], frame: [-700, 0, -1000, 380, 2000, 650], group: "Small business (level 3)", name: "Closet cabinet, its door open (not in the photo)", build: function () { return BIZ.closetCabinet({ open: 105 }); },
    photo: "Not in your photos: the door swung open, drawn as such a cabinet usually comes, for you to check.",
    shows: ["The door's back: the frame and the perforated sheet's folded lip", "The 19-inch rails with their square holes, front and back", "The gear on the front rails: the patch panel at eye height, the managed switch under it, the router under that, blanking panels over the empty spaces", "The plinth on four levelling feet"] },
  { id: "cab-back", view: [0.5, 0.55, -1], light: [0.3, 1.3, -0.8], frame: [-340, 0, -1060, 340, 2040, 40], group: "Small business (level 3)", name: "Closet cabinet, its top and back (not in the photo)", build: function () { return BIZ.closetCabinet(); },
    photo: "Not in your photos: the top and the back, drawn as such a cabinet usually comes, for you to check.",
    shows: ["The top cover with its vent slots", "The rear door, perforated like the front, shut", "The side panels' lock tabs"] },
  { id: "pc", view: "back3", light: [0.6, 1.3, -1.0], frame: [-115, 0, -250, 115, 270, 195], group: "Devices on the network", name: "Desktop PC", build: END.desktopPC,
    photo: "From your photo of the desktop PC's back, cables plugged in as photographed.",
    shows: ["The brushed I/O plate with every port standing on end, as in a tower: Wi-Fi antenna connectors, DP (x2), HDMI, USB 3.2 (x4), USB-C, USB 2.0, LAN, and six audio jacks", "The Ethernet cable plugged in, link light on, running down to the bench", "The fan behind its wire guard, VENTILATION printed above and beside it", "MADE IN TAIWAN and the MAC sticker with its barcode", "The PSU's honeycomb face, its I/O switch, the mains cord plugged in, PSU (1000W) printed beside it", "The model label PC MODEL: XTR-5800 with its regulatory marks; serial and MAC covered"],
    standards: ["The I/O plate is the ATX size (158.75 x 44.45 mm)", "The top of the plate is cut off in your photo: the model puts the Wi-Fi antenna connectors there, as on boards with built-in Wi-Fi. Say if you'd rather it plain.", "Audio jacks in the standard colours and order (C/SUB orange, REAR black, SIDE grey; IN blue, OUT green, MIC pink)"] },
  { id: "pc-io", focus: "panel:I/O plate", view: "back", light: [0.6, 1.3, -1.0], group: "Devices on the network", name: "Desktop PC, I/O plate close-up", build: END.desktopPC,
    photo: "The same PC, close in on the ports.",
    shows: ["LAN: green link light on, amber activity light on: the cable is plugged in and passing traffic", "Each port labelled the way students will be asked for it"] },
  { id: "laptop", view: [-1, 0.55, 0.85], light: [-0.7, 1.3, 0.9], group: "Devices on the network", name: "Laptop", build: END.laptop,
    photo: "From your photo of the laptop's Ethernet side.",
    shows: ["Bead-blasted aluminium with a polished, diamond-cut edge", "Left side, from the hinge: the drop-jaw ETHERNET port open round a grey patch cable (link and activity lights on), two blue SS USB-A in black frames, USB-C, AUDIO, each labelled above, then the vents", "A full keyboard with its legends, the glass trackpad", "On screen: Command Prompt, ipconfig exactly as Windows prints it"] },
  { id: "laptop-ports", focus: "panel:Left side ports", view: [-1, 0.25, 0.35], light: [-0.7, 1.3, 0.9], group: "Devices on the network", name: "Laptop, port side close-up", build: END.laptop,
    photo: "The same laptop, close in on its left side.",
    shows: ["The drop-jaw: the bottom of the port hinges down so a full-size RJ45 fits a thin laptop"] },
  { id: "printer", light: [0.6, 1.3, 0.9], group: "Devices on the network", name: "Network printer", build: END.networkPrinter,
    photo: "From your photos of the network printer: its control panel and its back.",
    shows: ["Two-tone, as photographed: charcoal top cover, light grey body", "The control panel on the cover's sloped front: CONTROL PANEL, NP-1000 SERIES, the amber light, the colour screen, POWER lit green, CANCEL, the arrow pad with OK, STATUS", "Top output tray with its paper stop; the paper cassette below", "Back: NETWORK in its printed box with LINK / ACT, the patch cable plugged in; USB (B); SERIAL; the mains inlet, switch and cord", "The label with barcode and regulatory marks, serial and MAC covered"],
    standards: ["The screen's wording is corrected from the photo: STATUS: ONLINE (192.168.1.100), then IP ADDRESS 192.168.1.100"] },
  { id: "printer-panel", focus: "panel:Control panel", view: [0.15, 0.75, 0.66], light: [0.3, 1.3, 1.0], group: "Devices on the network", name: "Printer, control panel close-up", build: END.networkPrinter,
    photo: "The same printer, close in on its screen.",
    shows: ["Where a technician reads a printer's IP address without a computer"] },
  { id: "printer-back", focus: "panel:Ports", view: [-0.35, 0.2, -1], light: [-0.4, 1.2, -1.0], group: "Devices on the network", name: "Printer, back ports close-up", build: END.networkPrinter,
    photo: "From your photo of the printer's back.",
    shows: ["NETWORK in its printed box: green link light, amber activity light, the patch cable plugged in", "USB (B) and SERIAL beside it: the older ways to connect a printer"] },
  { id: "tv", view: [-0.75, 0.32, -1], light: [-0.5, 1.2, -1.0], group: "Devices on the network", name: "Smart TV", build: END.smartTV,
    photo: "From your photo of the smart TV's rear panel.",
    shows: ["The silver-grey back with the deep port bay, its rim rounded", "On the black strip: HDMI 1-4 standing on end, two USB, LAN with the Ethernet cable plugged in, the AV jacks, ANT/CABLE IN, DC IN", "Beside them, in printed boxes: HDMI 1 (ARC/eARC) to HDMI 4, USB (5V 0.5A), USB (HDD), OPTICAL DIGITAL AUDIO OUT, AV IN (COMPOSITE/AUDIO), ANTENNA / CABLE IN, DC IN", "ETHERNET and the network icon outside the bay, the label with barcode, VESA mounts, speaker grilles", "From the front: the screen on its network status page"],
    standards: ["Composite AV in is three jacks (red, white, yellow); your photo shows two. ANT/CABLE IN is the same F-type as the modem's CABLE IN."] },
  { id: "tv-panel", focus: "panel:Connection panel", view: [-0.25, 0.1, -1], light: [-0.4, 1.2, -1.0], group: "Devices on the network", name: "Smart TV, connection panel close-up", build: END.smartTV,
    photo: "The same TV, close in on its connection panel.",
    shows: ["LAN with link and activity lights: a wired TV is one less device fighting for Wi-Fi"] },
  { id: "camera", stage: "concrete", view: [1, 0.5, 0.75], light: [0.7, 1.3, 0.9], frame: [-70, 0, -70, 125, 112, 125], group: "Devices on the network", name: "PoE IP camera", build: END.ipCamera,
    photo: "From your photo of the PoE IP camera, on concrete as photographed.",
    shows: ["The white base and grey foot, the black lens looking out of the round opening in the white shroud", "The label printed on the base (MODEL: IPC-6000D, MAC covered, IP: 192.168.1.50) and its barcode, the screw beside it", "The port pocket cut into the base: the cable gland with its cable, the gigabit PoE port (lights on) with the patch cable plugged in, (Data + Power) and Gigabit IP Camera Port · 10/100/1000 printed above", "The rubber weather cap, pulled off and lying beside it"],
    standards: ["Printed beside the port: PoE 802.3af, the standard a PoE camera uses (your photo's “Passive PoE” is a non-standard kind)"] },
  { id: "camera-port", stage: "concrete", focus: "panel:PoE port", view: [0.91, 0.3, 0.41], light: [0.7, 1.3, 0.9], group: "Devices on the network", name: "IP camera, PoE port close-up", build: END.ipCamera,
    photo: "The same camera, close in on its port.",
    shows: ["One RJ45 for both data and power: no power brick at the camera"] },
  { id: "wallplate", stage: "none", view: [0.18, 0.06, 1], light: [-0.5, 0.9, 1.1], frame: [-62, -85, 0, 95, 70, 50], group: "Devices on the network", name: "Data/voice wall plate", build: END.wallPlate,
    photo: "From your photo of the data/voice wall plate.",
    shows: ["NETWORKING PORT; the yellow ETHERNET keystone with a yellow patch cable (green boot) plugged in", "The grey TELEPHONE keystone with the phone cord plugged in", "DATA / VOICE, the printed boxes round each jack, two screws"],
    standards: ["Single-gang plate, its screws 83.3 mm apart as the standard sets them", "An RJ11 plug fits an RJ45 jack but not the other way round: the jacks are drawn at their real sizes"] },
  { id: "wallplate-empty", stage: "none", view: [0.1, 0.05, 1], light: [-0.5, 0.9, 1.1], frame: [-45, -65, 0, 45, 65, 10], group: "Devices on the network", name: "Wall plate, nothing plugged in", build: function () { return END.wallPlate({ plugged: false }); },
    photo: "The same plate with the cables out, to see the jacks.",
    shows: ["Eight gold contacts in the Ethernet jack, four in the telephone jack (one or two lines)"] },
  { id: "tester", stage: "concrete", view: [0.12, 0.3, 1], light: [0.3, 1.3, 1.0], frame: [-110, 0, -40, 115, 110, 30], group: "Tools and the bench kit", name: "Cable tester, main and remote", build: TOOL.cableTester,
    photo: "From your photo of the cable tester, main unit and remote joined by a short patch cable.",
    shows: ["Main: the LCD (CAT6 TEST - T568B, progress 100%, pins 1-8 and G, PASS), the green panel with a light per pin, all lit", "Remote: its own row of lights, REMOTE, the PASS - ALL PAIRS window", "The short black patch cable plugged into both"],
    standards: ["The photo's screen text is garbled (\u201cPasss 1- 02B\u201d); the screen shows the correct wording", "A tester checks each wire end to end, in order: a crossed or open wire lights out of order or not at all"] },
  { id: "tester-screen", stage: "concrete", focus: "panel:Main unit", view: [0.1, 0.15, 1], light: [0.3, 1.3, 1.0], group: "Tools and the bench kit", name: "Cable tester, main unit close-up", build: TOOL.cableTester,
    photo: "The same tester, close in on the main unit.",
    shows: ["The fault row above stays dark; every pass light is lit, 1 to 8 and G (the shield)"] },
  { id: "crimper", stage: "concrete", view: [0.35, 0.95, 0.55], light: [0.4, 1.4, 0.6], group: "Tools and the bench kit", name: "RJ45/RJ11 crimper", build: TOOL.crimper,
    photo: "From your photo of the RJ45/11 crimp tool.",
    shows: ["The blue steel head with its 8P (RJ45) and 6P (RJ11) dies, the teeth that press the contacts down", "The cutting blade along the edge, the stripping notch, the ratchet", "The slim blue handle with its black inset; the big black-gripped handle with blue edges"] },
  { id: "punch", stage: "concrete", view: [0.4, 0.8, 0.8], light: [0.4, 1.4, 0.7], group: "Tools and the bench kit", name: "110 punch-down tool", build: TOOL.punchDown,
    photo: "From your photo of the 110 punch-down.",
    shows: ["The grey ribbed body, the 110 label, the white end cap", "The yellow impact sleeve, the black collar, the 110 blade with its cutting side"],
    standards: ["The cutting side of the blade faces the waste end of the wire when you punch it down"] },
  { id: "tone", stage: "concrete", view: [0.3, 0.95, 0.6], light: [0.4, 1.4, 0.7], frame: [-50, 0, -80, 50, 34, 90], group: "Tools and the bench kit", name: "Tone generator", build: TOOL.toneGenerator,
    photo: "From your photo of the tone generator and probe.",
    shows: ["The off-white case, the grey face: LCD (TONE ON, MODE ALT, LINE OPEN), the red power button, MODE, the arrow pad and OK, TONE GENERATOR", "Its lead out of the bottom, across the bench"] },
  { id: "probe", stage: "concrete", view: [0.25, 0.95, 0.6], light: [0.4, 1.4, 0.7], frame: [-120, 0, -24, 120, 30, 24], group: "Tools and the bench kit", name: "Inductive probe", build: TOOL.inductiveProbe,
    photo: "From the same photo: the inductive probe.",
    shows: ["The wand tapering to its black tip, the grey face, INDUCTIVE PROBE, the push button, the sensitivity mark, the green light", "The speaker grille at the back: you hear the tone when the tip is near the right wire"] },
  { id: "loopback", stage: "concrete", view: [0.35, 0.75, 0.6], light: [0.3, 1.4, 0.7], frame: [-8, 0, -14, 8, 10, 12], group: "Tools and the bench kit", name: "RJ45 loopback plug", build: function () { const g = new THREE.Group(); const p = TOOL.loopbackPlug(); p.position.y = 5.6; g.add(p); return g; },
    photo: "From the same photo: the RJ45 loopback plug.",
    shows: ["Seen through the clear plug: each wire runs in at one pin and turns round inside to another", "The grey moulded hood at the back"],
    standards: ["Wired 1 to 3 and 2 to 6 (and 4 to 7, 5 to 8 for gigabit): a port hears its own transmit, so its link light should come on"] },
  { id: "tools", stage: "concrete", view: [0.05, 0.62, 1], light: [0.3, 1.4, 0.8], frame: [-270, 0, -130, 280, 50, 170], group: "Tools and the bench kit", name: "The tools together, as photographed", build: TOOL.toolLayout,
    photo: "As in your photo: crimper, punch-down, tone generator, probe and loopback plug on the bench.",
    shows: ["Every tool at its real size beside the others"] },
  { id: "kit", stage: "none", view: [0.55, 0.5, 1], light: [0.4, 1.4, 0.9], frame: [-340, 0, -150, 200, 120, 160], group: "Tools and the bench kit", name: "Screwdriver set on the ESD mat", build: TOOL.screwdriverKit,
    photo: "From your photo of the electronics screwdriver set on an ESD mat with tweezers.",
    shows: ["The aluminium case open: the lid's chart of bit types, four rows of precision bits labelled on the holder", "The driver: knurled black grip, blue end, steel shaft, its bit on the set", "The ESD tweezers, a parts tray with screws", "The blue ESD mat on the white bench, its grounding snap and print"],
    standards: ["Bit types as real kits carry them: Phillips, flathead, Torx and security Torx, pentalobe, tri-wing, hex, triangle, square, spanner", "Brand names on the case and lid are left off"] },
  { id: "kit-case", stage: "none", focus: "panel:Bit case", view: [0.3, 0.7, 1], light: [0.4, 1.4, 0.9], group: "Tools and the bench kit", name: "Screwdriver set, the bits close-up", build: TOOL.screwdriverKit,
    photo: "The same set, close in on the bits.",
    shows: ["Each row's sizes printed on the holder in front of it"] }
];

const canvas = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xd8d5cf);
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
/* a warm key light that casts soft shadows, and a cool fill from behind so backs aren't black */
const key = new THREE.DirectionalLight(0xfff3e4, 2.3); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0xe6eeff, 0.7); fill.position.set(-1.2, 1, -1.6); scene.add(fill);
const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 5000);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true;

/* what the gear sits on, as in the photographs: a wooden bench (or
   concrete for the camera), fading out softly at its edges */
const fade = (function () { const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d");
  const gr = g.createRadialGradient(256, 256, 60, 256, 256, 256); gr.addColorStop(0, "#fff"); gr.addColorStop(0.55, "#fff"); gr.addColorStop(1, "#000");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; })();
const STAGES = { wood: SURF.woodTex(), concrete: SURF.concreteTex() };
const stageMat = SURF.grain(new THREE.MeshStandardMaterial({ map: STAGES.wood, alphaMap: fade, transparent: true, roughness: 0.62, depthWrite: true, envMapIntensity: 0.5 }), { grain: 0.12, scale: 0.6 });
const stage = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), stageMat); stage.rotation.x = -Math.PI / 2; stage.receiveShadow = true; scene.add(stage);

/* ambient occlusion: the darkening in recesses, port openings and where things meet */
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(640, 480, { type: THREE.HalfFloatType, samples: 4 }));   /* multisampled: post-processing's own buffers otherwise skip the antialiasing */
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, 800, 600); gtao.blendIntensity = 1.0; composer.addPass(gtao);
/* print (labels, legends) is paper-thin: leave it out of the occlusion depth, as the pass already does for glows */
gtao.overrideVisibility = function () {
  const cache = this._visibilityCache;
  this.scene.traverse(function (o) { cache.set(o, o.visible); if (o.isPoints || o.isLine || o.userData.print || (o.material && o.material.userData && o.material.userData.clear)) o.visible = false; });   /* and clear plastic, so what's inside it isn't shaded as if behind a wall */
};
/* the LED glows, drawn after the shading: only those whose LED faces the camera with nothing in between */
const glowCam = new THREE.PerspectiveCamera(), glowPass = new RenderPass(scene, glowCam); glowPass.clear = false; composer.addPass(glowPass);
const glowRender = glowPass.render.bind(glowPass);
glowPass.render = function () { const bg = scene.background; scene.background = null; glowRender.apply(null, arguments); scene.background = bg; };   /* a colour background would force a clear */
const ray = new THREE.Raycaster(), halos = [];
function updateGlows() {
  glowCam.copy(camera); glowCam.layers.set(1);
  if (!current) return;
  const solid = []; current.traverse(function (o) { if (o.isMesh && !o.userData.print && o.visible && !(o.material && o.material.userData && o.material.userData.clear)) solid.push(o); });
  const P = new THREE.Vector3(), N = new THREE.Vector3(), Q = new THREE.Quaternion();
  halos.forEach(function (h) {
    if (!h.parent.userData.on) { h.visible = false; return; }
    h.getWorldPosition(P); h.parent.getWorldQuaternion(Q); N.set(0, 0, 1).applyQuaternion(Q);
    const to = camera.position.clone().sub(P), dist = to.length(); to.normalize();
    if (N.dot(to) < 0.08) { h.visible = false; return; }
    ray.set(camera.position, P.clone().sub(camera.position).normalize()); ray.far = dist - 0.3;
    h.visible = ray.intersectObjects(solid, false).length === 0;
  });
}
composer.addPass(new OutputPass());
let dirty = true;

let current = null, curModel = null, radius = 100, center = new THREE.Vector3();
const VIEWS = { three: [1, 0.55, 1.15], back3: [0.75, 0.42, -1.15], front: [0, 0.08, 1], back: [0, 0.08, -1], left: [-1, 0.08, 0], right: [1, 0.08, 0], top: [0, 1, 0.001], bottom: [0, -1, 0.001] };
let frameBox = new THREE.Box3();
function look(v) {
  const d = new THREE.Vector3().fromArray(Array.isArray(v) ? v : (VIEWS[v] || VIEWS.three)).normalize();
  const c = frameBox.getCenter(new THREE.Vector3()), corners = [];
  for (let k = 0; k < 8; k++) corners.push(new THREE.Vector3(k & 1 ? frameBox.max.x : frameBox.min.x, k & 2 ? frameBox.max.y : frameBox.min.y, k & 4 ? frameBox.max.z : frameBox.min.z));
  let dist = radius * 4;
  for (let it = 0; it < 6; it++) {
    camera.position.copy(c).addScaledVector(d, dist); camera.near = dist / 60; camera.far = dist * 30;
    camera.up.set(0, 1, 0); if (Math.abs(d.y) > 0.99) camera.up.set(0, 0, (curModel && curModel.pointAway ? 1 : -1) * Math.sign(d.y));   /* plugs: pointing away, pin 1 on the left */
    camera.lookAt(c); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    let m = 0; corners.forEach(function (p) { const q = p.clone().project(camera); m = Math.max(m, Math.abs(q.x), Math.abs(q.y)); });
    dist *= m / 0.82;
  }
  camera.position.copy(c).addScaledVector(d, dist); camera.updateProjectionMatrix();
  controls.target.copy(c); controls.update(); dirty = true;
  document.querySelectorAll("[data-view]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.view === v)); });
}
function show(id, view) {
  const m = MODELS.find(function (x) { return x.id === id; }) || MODELS[0];
  if (current) { scene.remove(current); }
  current = m.build(); curModel = m; scene.add(current);
  halos.length = 0; current.traverse(function (o) { if (o.userData.halo) halos.push(o); });
  /* everything solid casts a shadow; print and clear plastic don't */
  current.traverse(function (o) { if (!o.isMesh) return; const mt = o.material; o.receiveShadow = true;
    o.castShadow = !(o.userData.print || (mt && mt.userData && mt.userData.clear) || (mt && mt.transparent && (mt.opacity < 0.6 || !mt.alphaTest))); if (mt && mt.alphaTest) o.castShadow = true; });
  const b = new THREE.Box3().setFromObject(current), s = new THREE.Sphere(); b.getBoundingSphere(s); center.copy(s.center); radius = s.radius;
  /* the bench under it, the shadow camera round it, AO sized to it */
  const st = m.stage || "wood"; stage.visible = st !== "none";
  if (stage.visible) { const S = radius * 7; stage.scale.set(S, S, 1); stage.position.set(s.center.x, b.min.y - 0.02, s.center.z);
    stageMat.map = STAGES[st] || STAGES.wood; stageMat.map.repeat.set(S / (st === "concrete" ? 600 : 900), S / (st === "concrete" ? 600 : 900)); stageMat.needsUpdate = true; }
  const kd = new THREE.Vector3().fromArray(m.light || [0.55, 1.25, 0.8]).normalize();
  key.position.copy(s.center).addScaledVector(kd, radius * 4); key.target.position.copy(s.center);
  const sc = key.shadow.camera, ext = radius * 2.2; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = radius * 0.5; sc.far = radius * 9; sc.updateProjectionMatrix();
  key.shadow.bias = -0.0003; key.shadow.normalBias = radius * 0.0015;
  gtao.updateGtaoMaterial({ radius: Math.max(0.6, radius * 0.07), distanceExponent: 1.6, thickness: Math.max(0.5, radius * 0.05), scale: 1.0, samples: 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  frameBox = m.frame ? new THREE.Box3(new THREE.Vector3().fromArray(m.frame.slice(0, 3)), new THREE.Vector3().fromArray(m.frame.slice(3))) : b;
  if (m.focus) { const f = current.getObjectByName(m.focus); if (f) { current.updateMatrixWorld(true); frameBox = new THREE.Box3().setFromObject(f); frameBox.expandByScalar(4); } }   /* a close-up on one panel */
  document.getElementById("name").textContent = m.name;
  document.getElementById("photo").textContent = m.photo;
  const n = document.getElementById("notes"); n.innerHTML = "";
  const h = document.createElement("p"); h.innerHTML = "<strong>What it shows</strong>"; n.appendChild(h);
  const ul = document.createElement("ul"); m.shows.forEach(function (t) { const li = document.createElement("li"); li.textContent = t; ul.appendChild(li); }); n.appendChild(ul);
  if (m.standards) { const h2 = document.createElement("p"); h2.innerHTML = "<strong>Standards applied</strong>"; n.appendChild(h2);
    const u2 = document.createElement("ul"); m.standards.forEach(function (t) { const li = document.createElement("li"); li.textContent = t; u2.appendChild(li); }); n.appendChild(u2); }
  document.querySelectorAll("#list button").forEach(function (bt) { bt.setAttribute("aria-pressed", String(bt.dataset.id === m.id)); });
  look(view || m.view || "three");
  try { history.replaceState(null, "", "#" + m.id); } catch (e) {}
}
/* the list, by group */
const list = document.getElementById("list"); let lastGroup = null, ul = null;
MODELS.forEach(function (m) {
  if (m.group !== lastGroup) { const h = document.createElement("h2"); h.textContent = m.group; list.appendChild(h); ul = document.createElement("ul"); list.appendChild(ul); lastGroup = m.group; }
  const li = document.createElement("li"), b = document.createElement("button"); b.type = "button"; b.dataset.id = m.id; b.textContent = m.name;
  b.addEventListener("click", function () { show(m.id); }); li.appendChild(b); ul.appendChild(li);
});
document.querySelectorAll("[data-view]").forEach(function (b) { b.addEventListener("click", function () { look(b.dataset.view); }); });

function size() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true; }
window.addEventListener("resize", size); size();
controls.addEventListener("change", function () { dirty = true; });
(function loop() { controls.update(); if (dirty) { dirty = false; updateGlows(); composer.render(); } requestAnimationFrame(loop); })();
show((location.hash || "").slice(1) || "modem");

/* easier reading: on stays on, across pages and visits */
const dys = document.getElementById("dys");
function setDys(on) { document.body.classList.toggle("dys", on); dys.setAttribute("aria-pressed", String(on)); dys.textContent = "Easier reading: " + (on ? "on" : "off"); try { localStorage.setItem("e4-dyslexia", on ? "1" : "0"); } catch (e) {} }
let stored = null; try { stored = localStorage.getItem("e4-dyslexia"); } catch (e) {}
setDys(stored === "1");
dys.addEventListener("click", function () { setDys(!document.body.classList.contains("dys")); });

/* for scripted close-ups: put the camera exactly here, looking there */
function cam(c, t, fov) { camera.fov = fov || 35; camera.position.fromArray(c); controls.target.fromArray(t); camera.near = 0.5; camera.far = 20000; camera.updateProjectionMatrix(); controls.update(); dirty = true; updateGlows(); composer.render(); }
window.__preview = { cam: cam, show: show, look: look, ids: MODELS.map(function (m) { return m.id; }), render: function () { updateGlows(); composer.render(); }, current: function () { return current; } };
