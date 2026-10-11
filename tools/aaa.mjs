// AAA on painted pixels for the real site, state by state.
// node tools/aaa.mjs tools/aaa-states.json [plantCSS]   states: [{name, page, ticket, seed, setup, mode: "full"|"view"}]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import url from 'node:url';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..'), T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { const rel = decodeURIComponent(q.url.split('?')[0].split('#')[0]).slice(1) || 'index.html'; fs.readFile(path.join(ROOT, rel), (e, b) => { r.writeHead(e ? 404 : 200, { 'content-type': T[path.extname(rel)] || 'application/octet-stream' }); r.end(e ? '' : b); }); }).listen(0);
const pw = await import(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright/index.mjs'); const { chromium } = pw.default || pw;
const B = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--headless=new', '--no-sandbox'] });
const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const states = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), plant = process.argv[3] || '';
let total = 0, allBad = [], errs = [];
for (const st of states) {
  const bad = []; let n = 0;
  for (const vp of [{ w: 1400, h: 900 }, { w: 380, h: 800 }]) for (const dys of [false, true]) for (const hov of (st.mode === 'view' ? [false] : [false, true])) {
    const ctx = await B.newContext({ viewport: { width: vp.w, height: vp.h }, reducedMotion: 'reduce' });   /* no smooth scrolling mid-measurement */
    await ctx.addInitScript(([t, s, d]) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('e4-network-v1', JSON.stringify({ current: t, t: { [t]: { seed: s } }, solved: {} })); localStorage.setItem('e4-dyslexia', d ? '1' : '0'); sessionStorage.setItem('seeded', '1'); } } catch (e) {} }, [st.ticket || 'HOME-01', st.seed || 1234, dys]);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(st.name + ': ' + e.message));
    await p.goto('http://127.0.0.1:' + srv.address().port + '/' + (st.page || 'index.html')); await p.waitForTimeout(400);
    if (st.setup) { await p.evaluate(st.setup); await p.waitForTimeout(250); }
    if (plant) await p.addStyleTag({ content: plant });
    if (hov) { await p.hover('nav.views a'); await p.waitForTimeout(120); }
    await p.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; })); await p.waitForTimeout(60);
    const view = st.mode === 'view';
    const pe = await p.addStyleTag({ content: '*{pointer-events:auto!important}' });
    const runs = await p.evaluate((view) => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let t;
      while ((t = w.nextNode())) { if (!t.textContent.trim()) continue; const el = t.parentElement; if (el.closest('canvas,script,style,noscript')) continue;
        if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) continue;
        const cs = getComputedStyle(el); const r = document.createRange(); r.selectNodeContents(t); let op = 1; for (let a = el; a && a.nodeType === 1; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);   /* text dimmed by opacity keeps its colour value: blend it as it paints */
        for (const b of r.getClientRects()) { if (b.width <= 2 || b.height <= 2) continue;
          if (!view) { let clipped = false; for (let a = el.parentElement; a; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll|hidden)/.test(s.overflowX + s.overflowY)) { const c = a.getBoundingClientRect(); if (b.left < c.left - 1 || b.right > c.right + 1 || b.top < c.top - 1 || b.bottom > c.bottom + 1) { clipped = true; break; } } } if (clipped) continue;
            out.push({ t: t.textContent.trim().slice(0, 34), c: cs.color, op: op, s: parseFloat(cs.fontSize), b: parseInt(cs.fontWeight) >= 700, x: b.x + scrollX, y: b.y + scrollY, w: b.width, h: b.height }); continue; }
          if (b.bottom < 1 || b.top > innerHeight - 1 || b.right < 1 || b.left > innerWidth - 1) continue;
          const mine = (x, y) => { const h = document.elementFromPoint(x, y); return h && (h === el || el.contains(h)); };
          const x0 = Math.max(0, b.left), x1 = Math.min(innerWidth - 1, b.right), y0 = Math.max(0, b.top), y1 = Math.min(innerHeight - 1, b.bottom), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
          let top = null, bot = null, lef = null, rig = null;
          for (let y = Math.ceil(y0); y <= y1; y++) if (mine(cx, y)) { if (top === null) top = y; bot = y; }
          for (let x = Math.ceil(x0); x <= x1; x += 2) if (mine(x, cy)) { if (lef === null) lef = x; rig = x; }
          if (top === null || lef === null) continue;
          if (top > Math.ceil(y0)) top++; if (bot < Math.floor(y1)) bot--; if (lef > Math.ceil(x0)) lef += 2; if (rig < x1 - 2) rig -= 2; if (bot < top || rig < lef) continue;
          out.push({ t: t.textContent.trim().slice(0, 34), c: cs.color, op: op, s: parseFloat(cs.fontSize), b: parseInt(cs.fontWeight) >= 700, x: lef, y: top, w: rig - lef + 1, h: bot - top + 1 }); } }
      return out; }, view);
    await pe.evaluate(n => n.remove());
    await p.addStyleTag({ content: '*{color:transparent!important;text-shadow:none!important;caret-color:transparent!important}' });
    const png = (await p.screenshot({ fullPage: !view })).toString('base64');
    const grounds = await p.evaluate(async ({ png, runs }) => { const im = new Image(); im.src = 'data:image/png;base64,' + png; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      return runs.map(r => { const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y)); const d = g.getImageData(x0, y0, Math.max(1, Math.min(Math.floor(r.w), im.width - x0)), Math.max(1, Math.min(Math.floor(r.h), im.height - y0))).data; const px = []; for (let i = 0; i < d.length; i += 16) px.push([d[i], d[i + 1], d[i + 2]]); return px; }); }, { png, runs });
    runs.forEach((r, i) => { n++; const fg = r.c.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3); const need = (r.s >= 24 || (r.b && r.s >= 18.66)) ? 4.5 : 7; const al = (r.c.match(/rgba\([^)]*,\s*([\d.]+)\)/) ? parseFloat(r.c.match(/rgba\([^)]*,\s*([\d.]+)\)/)[1]) : 1) * (r.op == null ? 1 : r.op); let worst = 99; for (const q of grounds[i]) { const eff = fg.map((v, k) => al * v + (1 - al) * q[k]); worst = Math.min(worst, ratio(eff, q)); } if (worst < need) bad.push(`${vp.w}px dys=${dys} hover=${hov}: ${worst.toFixed(2)}:1 "${r.t}"`); });
    if (!view) { const wide = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); if (wide) bad.push(`${vp.w}px: scrolls sideways`); }
    await ctx.close();
  }
  total += n;
  console.log((bad.length ? 'FAIL ' : 'pass ') + st.name + ' (' + n + ' runs)' + (bad.length ? '\n   ' + [...new Set(bad)].slice(0, 8).join('\n   ') : ''));
  allBad.push(...bad);
}
console.log(errs.length ? 'PAGE ERRORS\n' + [...new Set(errs)].join('\n') : 'no page errors');
console.log(allBad.length ? 'FAIL overall' : `PASS overall: ${total} text runs across ${states.length} states, AAA on painted pixels (desk + phone, easier reading on/off, hover)`);
await B.close(); srv.close();
