import { chromium } from 'playwright';

const URL = 'http://localhost:3000/drafts/whydhams/ue-home';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
const failed = [];
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const report = await page.evaluate(() => {
  const txt = (el) => (el ? el.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) : null);
  const q = (sel) => document.querySelector(sel);
  const all = (sel) => [...document.querySelectorAll(sel)];
  return {
    bodyClass: document.body.className,
    pending: all('[data-block-status="wh-pending"]').map((b) => b.dataset.whBlock),
    header: {
      logoImg: q('.wh-logo img')?.getAttribute('src')?.slice(-40) || null,
      nav: all('.wh-header nav a').map((a) => a.textContent.trim()),
      buttons: all('.wh-header a.button, .wh-header .wh-header-actions a').map((a) => a.textContent.trim()),
    },
    hero: { headline: txt(q('.wh-hero-container h1')), video: !!q('.wh-hero-container video') },
    intro: {
      heading: txt(q('.wh-intro-container h2')),
      img: !!q('.wh-intro-container img'),
      cta: txt(q('.wh-intro-container a.button')),
    },
    icons: all('.wh-icons li, .wh-icons .wh-icons-item').map((i) => ({ label: txt(i), img: !!i.querySelector('img') })),
    quad: {
      heading: txt(q('.wh-quad h2')),
      cards: all('.wh-quad li, .wh-quad .wh-quad-card').map((c) => ({
        title: txt(c.querySelector('h3')), img: !!c.querySelector('img'), cta: txt(c.querySelector('a')),
      })),
    },
    testimonials: {
      heading: txt(q('.wh-testimonials h2')),
      slides: all('.wh-testimonials blockquote, .wh-testimonials .wh-testimonials-item').length,
    },
    alt: {
      heading: txt(q('.wh-quad-alternate h2')),
      cards: all('.wh-quad-alternate li, .wh-quad-alternate .wh-quad-alternate-item').map((c) => ({
        title: txt(c.querySelector('h3')), img: !!c.querySelector('img'), cta: txt(c.querySelector('a')),
      })),
    },
  };
});

console.log(JSON.stringify(report, null, 2));
console.log('\nCONSOLE ERRORS:', errors.length ? errors : 'none');
console.log('FAILED REQUESTS:', failed.length ? failed : 'none');

const height = await page.evaluate(() => document.body.scrollHeight);
let i = 0;
for (let y = 0; y < height; y += 900) {
  /* eslint-disable no-await-in-loop */
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `.tmp/shot-${String(i).padStart(2, '0')}.png` });
  i += 1;
}
console.log(`\nwrote ${i} screenshots, page height ${height}`);
await browser.close();
