import puppeteer from 'puppeteer';
import { CHROME_SELECTORS } from '../lib/import-rules.mjs';

const AUTO_SCROLL_SCRIPT = async () => {
  await new Promise((resolve) => {
    let totalHeight = 0;
    const distance = 100;
    const timer = setInterval(() => {
      const { scrollHeight } = document.body;
      window.scrollBy(0, distance);
      totalHeight += distance;
      if (totalHeight >= scrollHeight) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });
};

/**
 * Resolve lazy-loaded image src attributes in the page.
 */
const RESOLVE_LAZY_IMAGES = () => {
  document.querySelectorAll('img[data-src], img[data-lazy-src]').forEach((img) => {
    const lazy = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
    if (lazy && !img.getAttribute('src')) img.setAttribute('src', lazy);
  });
};

/**
 * Sample computed colors from key page regions for theme generation.
 * @param {import('puppeteer').Page} page Puppeteer page
 * @returns {Promise<object>}
 */
async function extractThemeColors(page) {
  return page.evaluate(() => {
    const getStyle = (el) => {
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        color: cs.color,
        borderRadius: cs.borderRadius,
      };
    };

    const { body } = document;
    const header = document.querySelector('header')
      || document.querySelector('[class*="header" i], [id*="header" i]');
    const nav = document.querySelector('header nav, nav.primary-nav, nav');
    const h1 = document.querySelector('main h1, [role="main"] h1, h1');
    const cta = document.querySelector(
      'main a[class*="btn" i], main .cta a, main a.button, header a[class*="btn" i], .hero a[href]',
    );
    const link = document.querySelector('main a:not([class*="btn" i])');
    const footer = document.querySelector('footer, .l-footer, #footer');
    const sections = [...document.querySelectorAll('main > section, main > div')].slice(0, 3);

    return {
      body: getStyle(body),
      header: getStyle(header),
      nav: getStyle(nav),
      h1: getStyle(h1),
      cta: getStyle(cta),
      link: getStyle(link),
      footer: getStyle(footer),
      sections: sections.map((el) => getStyle(el)),
    };
  });
}

/**
 * Extract font families and any external webfont stylesheets used by the source page.
 * @param {import('puppeteer').Page} page Puppeteer page
 * @returns {Promise<object>}
 */
async function extractFonts(page) {
  return page.evaluate(() => {
    const familyOf = (el) => {
      if (!el) return '';
      return window.getComputedStyle(el).fontFamily || '';
    };

    const { body } = document;
    const h1 = document.querySelector('main h1, h1');
    const nav = document.querySelector('header nav, nav.primary-nav, nav');
    const cta = document.querySelector(
      'main a[class*="btn" i], main .cta a, main a.button, header a[class*="btn" i]',
    );

    const webfontLinks = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .map((link) => link.href)
      .filter((href) => /fonts\.googleapis\.com|use\.typekit\.net|fonts\.adobe\.com/i.test(href));

    return {
      body: familyOf(body),
      heading: familyOf(h1),
      nav: familyOf(nav),
      cta: familyOf(cta),
      webfontLinks: [...new Set(webfontLinks)],
    };
  });
}

/**
 * Inject a real <img> for hero/banner regions whose visual is a CSS background-image,
 * so the asset pipeline and block conversion pick it up like any other content image.
 * Mutates the DOM in the page context before serialization.
 */
const INJECT_BACKGROUND_HERO_IMAGES = () => {
  const heroSelectors = [
    '.hero', '[class*="hero" i]', '[class*="banner" i]', '[class*="mainvisual" i]',
    '[class*="jumbotron" i]', '[class*="masthead" i]',
  ];
  const main = document.querySelector('main') || document.body;
  const seen = new Set();

  heroSelectors.forEach((sel) => {
    main.querySelectorAll(sel).forEach((el) => {
      if (seen.has(el)) return;
      if (el.querySelector('img[src], picture, video')) return;

      let node = el;
      let bg = '';
      let depth = 0;
      while (node && depth < 3 && !bg) {
        const cs = window.getComputedStyle(node);
        const match = cs.backgroundImage && cs.backgroundImage.match(/url\(["']?(.+?)["']?\)/);
        const [, matchedUrl] = match || [];
        if (matchedUrl && !matchedUrl.startsWith('data:')) {
          bg = matchedUrl;
          break;
        }
        node = node.firstElementChild;
        depth += 1;
      }

      if (bg) {
        seen.add(el);
        const img = document.createElement('img');
        img.src = bg;
        img.alt = el.getAttribute('aria-label') || el.getAttribute('title') || '';
        el.insertBefore(img, el.firstChild);
      }
    });
  });
};

/**
 * Extract SEO metadata from the rendered page.
 * @param {import('puppeteer').Page} page Puppeteer page
 * @returns {Promise<object>}
 */
async function extractPageMeta(page) {
  return page.evaluate(() => {
    const getMeta = (sel) => document.querySelector(sel)?.getAttribute('content') || '';
    return {
      title: document.title?.trim() || '',
      description: getMeta('meta[name="description"]'),
      ogTitle: getMeta('meta[property="og:title"]'),
      ogDescription: getMeta('meta[property="og:description"]'),
      ogImage: getMeta('meta[property="og:image"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
      robots: getMeta('meta[name="robots"]') || 'index, follow',
    };
  });
}

/**
 * Launch Puppeteer with system Chrome when bundled browser is unavailable.
 * @returns {Promise<import('puppeteer').Browser>}
 */
async function launchBrowser() {
  const options = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  } else {
    options.channel = 'chrome';
  }
  try {
    return await puppeteer.launch(options);
  } catch {
    delete options.channel;
    return puppeteer.launch({ ...options, headless: true });
  }
}

/**
 * Render external URL and extract main content, nav, and SEO metadata.
 * @param {string} url Source page URL
 * @returns {Promise<{
 *   url: string, mainHtml: string, navHtml: string, footerHtml: string,
 *   meta: object, themeColors: object, fonts: object,
 * }>}
 */
export async function ingestDom(url) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    await page.evaluate(AUTO_SCROLL_SCRIPT);
    await page.evaluate(RESOLVE_LAZY_IMAGES);
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});

    const meta = await extractPageMeta(page);
    const themeColors = await extractThemeColors(page);
    const fonts = await extractFonts(page);
    await page.evaluate(INJECT_BACKGROUND_HERO_IMAGES);

    const {
      mainHtml, navHtml, footerHtml, logoMeta, footerLogoMeta,
    } = await page.evaluate((chromeSelectors) => {
      const header = document.querySelector('header');
      const nav = document.querySelector(
        'header nav, nav.primary-nav, nav, [role="navigation"], .primary-nav, .navigation',
      );
      const footer = document.querySelector('footer, .l-footer, #footer');

      const findLogo = (scope) => {
        const root = scope || document;
        const selectors = [
          'a.logo img',
          '.logo img',
          'a[class*="logo" i] img',
          '[class*="logo" i] img',
          '.brand img',
          'a[href="/"] img',
          'a[href="./"] img',
          'img[src*="logo" i]',
          'img[alt*="logo" i]',
          'img[alt*="wyndham" i]',
          'header a img',
        ];
        for (let i = 0; i < selectors.length; i += 1) {
          const img = root.querySelector(selectors[i]);
          if (img?.src && !img.src.startsWith('data:')) {
            const anchor = img.closest('a');
            return {
              src: img.src,
              alt: img.alt || '',
              href: anchor?.href || window.location.origin,
            };
          }
        }

        const logoLink = root.querySelector('a.logo, a[class*="logo" i], .logo a, header .brand a');
        const svg = logoLink?.querySelector('svg') || root.querySelector('header svg, .logo svg');
        if (svg && logoLink) {
          const serializer = new XMLSerializer();
          const svgMarkup = serializer.serializeToString(svg);
          if (svgMarkup) {
            return {
              src: `data:image/svg+xml,${encodeURIComponent(svgMarkup)}`,
              alt: logoLink.getAttribute('aria-label') || logoLink.textContent.trim() || 'Site logo',
              href: logoLink.href || window.location.origin,
              inlineSvg: true,
            };
          }
        }

        const logoEl = root.querySelector('.logo, a.logo, [class*="logo" i]');
        if (logoEl) {
          const bg = window.getComputedStyle(logoEl).backgroundImage;
          const match = bg && bg.match(/url\(["']?(.+?)["']?\)/);
          if (match?.[1]) {
            const anchor = logoEl.closest('a') || (logoEl.tagName === 'A' ? logoEl : null);
            return {
              src: match[1],
              alt: logoEl.getAttribute('aria-label') || 'Site logo',
              href: anchor?.href || window.location.origin,
            };
          }
        }

        return null;
      };

      const logoMeta = findLogo(header) || findLogo(nav);
      const footerLogoMeta = findLogo(footer);

      const capturedNavHtml = nav?.outerHTML || header?.outerHTML || '';
      const capturedFooterHtml = footer?.outerHTML || '';

      chromeSelectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          if (el.closest('main')) return;
          if (sel === 'nav' && !el.closest('header')) return;
          el.remove();
        });
      });

      const main = document.querySelector('main') || document.body;
      return {
        mainHtml: main.innerHTML,
        navHtml: capturedNavHtml,
        footerHtml: capturedFooterHtml,
        logoMeta,
        footerLogoMeta,
      };
    }, CHROME_SELECTORS);

    return {
      url, mainHtml, navHtml, footerHtml, logoMeta, footerLogoMeta, meta, themeColors, fonts,
    };
  } finally {
    await browser.close();
  }
}
