/**
 * Regenerates a draft that mirrors the markup AEM's Universal Editor renders for
 * /content/ntt-eds/global/wyndham-clearwater, so the blocks can be checked locally.
 */
import { mkdir, writeFile } from 'node:fs/promises';

const CDN = 'https://symphony.cdn.tambourine.com/wyndham-grand-clearwater-beach/media/';
const BASE = '/content/ntt-eds/global/wyndham-clearwater';

const link = (href) => `<a href="${href}">${href}</a>`;
/** `key | value` row, as emitted for a `key-value: true` block */
const kv = (k, v) => `    <div>\n      <div>${k}</div>\n      <div>${v}</div>\n    </div>`;
/** a block's own field on a non key-value block renders as a single instrumented cell */
const own = (name, v) => `    <div>\n      <div data-aue-prop="${name}">${v}</div>\n    </div>`;
/** an instrumented item row, one cell per model field in order */
const item = (comp, cells) => `    <div data-aue-component="${comp}" data-aue-model="${comp}">\n${
  cells.map((c) => `      <div>${c}</div>`).join('\n')}\n    </div>`;

const block = (name, rows) => `  <div data-aue-component="${name}" data-aue-model="${name}" class="${name}">\n${rows.join('\n')}\n  </div>`;
const metadata = (style) => `  <div class="section-metadata">\n    <div>\n      <div>style</div>\n      <div>${style}</div>\n    </div>\n  </div>`;
const section = (inner, style) => `<div>\n${inner}\n${metadata(style)}\n</div>`;

const navs = [['Rooms', 'rooms'], ['Offers', 'offers'], ['Dining', 'dining'], ['Spa', 'spa'], ['Meetings', 'meetings']];

const header = section(block('wh-header', [
  kv('signInUrl', link('https://www.wyndhamhotels.com/wyndham-rewards')),
  kv('bookNowUrl', link('https://www.wyndhamgrandclearwater.com/booking')),
  `    <div data-aue-component="wh-logo" data-aue-model="wh-logo">\n      <div>${link('https://www.wyndhamgrandclearwater.com/m/assets/svg/logo-footer.svg')}</div>\n      <div>Wyndham Grand Clearwater Beach</div>\n      <div>${link(BASE)}</div>\n    </div>`,
  ...navs.map(([label, slug]) => item('wh-nav-item', [label, link(`${BASE}/${slug}`)])),
]), 'navy');

const hero = section(block('wh-hero-container', [
  kv('headline', 'The Most Stylish Spot Under The Sun'),
  kv('videoUrl', link(`${CDN}hero-homepage-5bfc16be5a237.mp4`)),
  kv('videoTitle', 'Hero video'),
]), 'hero-container');

const intro = section(block('wh-intro-container', [
  kv('imageAlignment', 'left'),
  kv('image', link('https://www.wyndhamgrandclearwater.com/assets/images/jpg/ClearwaterPool-Image.jpg')),
  kv('heading', 'Escape To Clearwater Beach'),
  kv('description', 'Warm and inviting with a splash of excitement, Wyndham Grand Clearwater Beach is a AAA 4 Diamond hotel lining the scenic Gulf shore. We have everything you need to make each moment of your Clearwater escape memorable.'),
  kv('ctaText', 'View Rooms &amp; Suites'),
  kv('ctaLink', link(`${BASE}/rooms`)),
]), 'intro-container');

const icons = section(block('wh-icons', [
  item('wh-icon-item', [link(`${CDN}wyndhamgrandclearwaterbeach-benefitnow-bestprice-66a80019b58a7.svg`), 'Best Price Guarantee', '']),
  item('wh-icon-item', [link(`${CDN}wyndhamgrandclearwaterbeach-benefitnow-discount-66a80105d7563.svg`), 'Exclusive Packages and Offers', link(`${BASE}/offers`)]),
  item('wh-icon-item', [link(`${CDN}wyndhamgrandclearwaterbeach-benefitnow-calendar-66a8010685468.svg`), 'Flexible Reservations', '']),
  item('wh-icon-item', [link(`${CDN}wyndhamgrandclearwaterbeach-benefitnow-camera-66a80106c2def.svg`), 'Live Beach Camera', '']),
]), 'icons');

const quad = section(block('wh-quad', [
  own('heading', 'Top Reasons'),
  item('wh-quad-item', [link(`${CDN}WGCB-Homepage-TopReasons-Image2-5bd9fd5461e40.jpg`), 'Prime Beachfront Location', 'Take advantage of all that this renowned area has to offer, from world-class activities, shopping, and dining, to attractions highlighted with local flavor.', 'Explore The Area', link(`${BASE}/offers`)]),
  item('wh-quad-item', [link(`${CDN}wgcb-homepage-stepsfromthesand-65fdad1e036c8.jpg`), 'Steps from the Sand', 'Miles of white sand beaches and sparkling sea are just outside our front door.', 'View Rooms', link(`${BASE}/rooms`)]),
  item('wh-quad-item', [link(`${CDN}WGCB-Homepage-TopReasons-Image3-5bd9fd7ea794d.jpg`), 'Meetings &amp; Events', 'Plan an event at our destination hotel, featuring over 22,000 square feet of flexible space.', 'Learn More', link(`${BASE}/meetings`)]),
]), 'columns-new');

const testimonials = section(block('wh-testimonials', [
  own('heading', 'Our Guests Say It Best'),
  item('wh-testimonial-item', ['Ready To Book Again!', 'We were very happy with the location and extremely happy with the cleanliness of the entire place, inside and out.', '-@andrewcano']),
  item('wh-testimonial-item', ['Great Experience', 'A great experience with the Wyndham Grand. All aspects of the trip and hotel services and stay were top notch.', '-@kmpalmieri']),
]), 'awards-new');

const retreat = section(block('wh-quad-alternate', [
  own('heading', 'A Clearwater Beach Retreat'),
  item('wh-quad-alternate-item', ['left', link(`${CDN}WGCB-Homepage-Weedings-5bd9ff68367fa.jpg`), 'How to make it The Biggest Day', 'With its white sand beaches and crystal blue water, Clearwater Beach destination weddings are memorable and fun.', 'View More', link(`${BASE}/weddings`)]),
  item('wh-quad-alternate-item', ['right', link(`${CDN}WGCB-Homepage-Meetings-5bd9ff29609f3.jpg`), 'Turn Events Into Grand Occasions', 'Our team will be there to ensure that your event is flawlessly executed.', 'View More', link(`${BASE}/meetings`)]),
]), 'columns-altern');

const html = [header, hero, intro, icons, quad, testimonials, retreat].join('\n');
await mkdir('drafts/whydhams', { recursive: true });
await writeFile('drafts/whydhams/ue-home.plain.html', `${html}\n`, 'utf8');
console.log(`wrote drafts/whydhams/ue-home.plain.html (${html.length} bytes)`);
