import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve('.');
const ratio = process.argv[2] || '4x5';            // 4x5 | 1x1
const SIZE = ratio === '1x1' ? { w: 1080, h: 1080 } : { w: 1080, h: 1350 };
const OUT = path.join(ROOT, 'out', ratio);
fs.mkdirSync(OUT, { recursive: true });

const candidates = [
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  process.env.CHROME_PATH,
].filter(Boolean);
const exe = candidates.find(p => fs.existsSync(p));

const browser = await chromium.launch({ executablePath: exe, args: ['--font-render-hinting=none', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1500 }, deviceScaleFactor: 2 });

await page.goto('file://' + path.join(ROOT, 'slides.html'));

// square variant: shrink the canvas + trim the vertical type scale
if (ratio === '1x1') {
  await page.addStyleTag({ content: `
    :root{--H:1080px;--pad:74px;}
    h1{font-size:104px;} h1.m{font-size:88px;} h1.s{font-size:74px;}
    .eyebrow{margin-bottom:26px;font-size:18px;} .rule{margin:28px 0 24px;}
    .lede{font-size:24px;max-width:700px;} .body{padding:30px 0;}
    .mark{width:150px;}
    .row{padding:26px 0 24px;} .row h3{font-size:33px;} .row p{font-size:21px;}
    .pain{gap:20px;} .pain div{font-size:25px;}
    .card{padding:26px 28px 24px;} .ex{padding:15px 0;} .chart{height:104px;}
    .stat{padding:28px 0;} .stat .v{font-size:86px;width:240px;} .stat .k{font-size:23px;}
    .col li{font-size:21px;} .col{padding-top:28px;}
    .btn{padding:21px 38px;font-size:21px;} .cta-meta{margin-top:26px;}
  `});
}

await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(700);

const slides = await page.$$('.slide');
const names = ['01-hero','02-problem','03-fix','04-delivery','05-tracking','06-both-sides','07-numbers','08-cta'];
for (let i = 0; i < slides.length; i++) {
  const file = path.join(OUT, `${names[i] || 'slide-' + (i + 1)}.png`);
  await slides[i].screenshot({ path: file });
  console.log('✓', path.relative(ROOT, file));
}
await browser.close();
console.log(`\n${slides.length} slides · ${SIZE.w}×${SIZE.h} @2x → out/${ratio}/`);
