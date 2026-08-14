import fs from 'fs/promises';
import path from 'path';
import { createDomEnvironment } from '../lib/dom-env.mjs';
import { generateSeoSlug } from '../lib/slug.mjs';
import {
  normalizeHex, ensureReadableText, darkenHex, contrastRatio,
} from '../lib/wcag-contrast.mjs';

import { projectThemesDir } from '../lib/project-root.mjs';
import { processAssets } from './asset-pipeline.mjs';

/**
 * Load parent theme CSS from styles/themes/ when reusing an existing theme.
 * @param {string} themeSlug Theme class name
 * @param {object} [projectConfig={}] Host project config
 * @returns {Promise<string|null>}
 */
async function loadParentThemeCss(themeSlug, projectConfig = {}) {
  const source = path.join(projectThemesDir(projectConfig), `${themeSlug}.css`);
  try {
    return await fs.readFile(source, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Mirror generated theme CSS into styles/themes/ for local AEM CLI preview.
 * @param {string} themeSlug Theme class name
 * @param {string} themeCss CSS content
 * @param {object} [projectConfig={}] Host project config
 */
async function mirrorThemeCssForLocalDev(themeSlug, themeCss, projectConfig = {}) {
  const dest = path.join(projectThemesDir(projectConfig), `${themeSlug}.css`);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, themeCss, 'utf8');
}

/**
 * Derive theme class slug from source URL hostname.
 * @param {string} url Source URL
 * @returns {string} e.g. theme-wyndhamgrandclearwater
 */
export function generateThemeSlug(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const base = hostname.split('.').slice(0, -1).join('-') || hostname;
    return `theme-${generateSeoSlug(base)}`;
  } catch {
    return 'theme-imported';
  }
}

/**
 * Derive mega menu CSS class from theme slug.
 * @param {string} themeSlug theme-* class name
 * @returns {string}
 */
export function themeToMegaClass(themeSlug) {
  return themeSlug.replace(/^theme-/, 'mega-');
}

/**
 * Sanitize a computed font-family string into a safe CSS font stack.
 * Drops generic-looking system fallbacks the browser injects and keeps the
 * author's declared family names plus a trailing generic fallback.
 * @param {string} raw Computed fontFamily value
 * @param {string} genericFallback Generic family to guarantee at the end
 * @returns {string|null}
 */
function sanitizeFontFamily(raw, genericFallback = 'sans-serif') {
  if (!raw || typeof raw !== 'string') return null;
  const families = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (!families.length) return null;
  const generic = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);
  const hasGeneric = families.some((f) => generic.has(f.toLowerCase().replace(/["']/g, '')));
  const stack = families.slice(0, 3);
  if (!hasGeneric) stack.push(genericFallback);
  return stack.join(', ');
}

/**
 * Build validated theme token set from scraped color and font samples.
 * @param {object} samples Puppeteer color samples
 * @param {object} [fonts={}] Puppeteer font-family samples
 * @returns {object}
 */
export function buildThemeTokens(samples = {}, fonts = {}) {
  const bodyBg = normalizeHex(samples.body?.bg) || '#ffffff';
  const bodyText = normalizeHex(samples.body?.color) || '#333333';
  let headerBg = normalizeHex(samples.header?.bg) || normalizeHex(samples.nav?.bg);
  const ctaBg = normalizeHex(samples.cta?.bg) || normalizeHex(samples.cta?.color);
  const h1Color = normalizeHex(samples.h1?.color);
  const linkColorSample = normalizeHex(samples.link?.color);
  const footerBg = normalizeHex(samples.footer?.bg);
  const ctaRadius = samples.cta?.borderRadius && samples.cta.borderRadius !== '0px'
    ? samples.cta.borderRadius : '4px';

  const isLight = (hex) => {
    if (!hex) return true;
    const val = parseInt(hex.replace('#', ''), 16);
    const r = (val >> 16) & 255;
    const g = (val >> 8) & 255;
    const b = val & 255;
    return (r * 299 + g * 587 + b * 114) / 1000 > 200;
  };

  if (!headerBg || isLight(headerBg)) {
    headerBg = ctaBg || h1Color || '#0b1f3a';
  }

  const brandPrimary = headerBg;
  const brandPrimaryDark = darkenHex(brandPrimary, 0.2);
  const brandAccent = ctaBg?.startsWith('#') ? ctaBg : (h1Color || '#0072ce');
  const textColor = ensureReadableText(bodyBg, bodyText);
  let linkColor = '#0066cc';
  if (linkColorSample && contrastRatio(linkColorSample, bodyBg) >= 3) {
    linkColor = linkColorSample;
  } else if (contrastRatio(brandAccent, bodyBg) >= 3) {
    linkColor = brandAccent;
  }

  const bodyFont = sanitizeFontFamily(fonts.body, 'sans-serif');
  const headingFont = sanitizeFontFamily(fonts.heading || fonts.body, 'sans-serif');

  return {
    brandPrimary,
    brandPrimaryDark,
    brandAccent,
    brandAccentSecondary: normalizeHex(samples.h1?.color) || '#ffc400',
    brandBorder: '#d9e2ec',
    backgroundColor: bodyBg,
    textColor,
    linkColor,
    headingColor: h1Color,
    footerBg: footerBg && !isLight(footerBg) ? footerBg : brandPrimary,
    ctaRadius,
    bodyFont,
    headingFont,
    googleFontsImport: (fonts.webfontLinks || [])[0] || null,
  };
}

/**
 * Generate theme CSS file content.
 * @param {string} themeSlug body class name
 * @param {object} tokens Theme tokens
 * @returns {string}
 */
export function generateThemeCss(themeSlug, tokens) {
  const fontImport = tokens.googleFontsImport
    ? `@import url("${tokens.googleFontsImport}");\n\n`
    : '';
  const fontVars = tokens.bodyFont || tokens.headingFont
    ? `  --body-font-family: ${tokens.bodyFont || 'var(--body-font-family)'};
  --heading-font-family: ${tokens.headingFont || tokens.bodyFont || 'var(--heading-font-family)'};
`
    : '';

  return `/*
 * Auto-generated theme from URL ingest pipeline
 */

${fontImport}body.${themeSlug} {
  --background-color: ${tokens.backgroundColor};
  --light-color: #f4f6f8;
  --dark-color: #1a1a1a;
  --text-color: ${tokens.textColor};
  --text-muted-color: #666;
  --link-color: ${tokens.linkColor};
  --link-hover-color: ${darkenHex(tokens.linkColor, 0.15)};
  --link-on-dark-hover: rgb(255 255 255 / 80%);
  --brand-primary: ${tokens.brandPrimary};
  --brand-primary-dark: ${tokens.brandPrimaryDark};
  --brand-accent: ${tokens.brandAccent};
  --brand-accent-secondary: ${tokens.brandAccentSecondary};
  --brand-border: ${tokens.brandBorder};
  --brand-footer-bg: ${tokens.footerBg || tokens.brandPrimary};
  --brand-button-radius: ${tokens.ctaRadius || '4px'};
  --ntt-navy: var(--brand-primary);
  --ntt-navy-dark: var(--brand-primary-dark);
  --ntt-accent: var(--brand-accent);
  --ntt-border: var(--brand-border);
${fontVars}}
`;
}

/**
 * Resolve scraped logo URL to an ingested public asset path.
 * @param {object|null} logoMeta Logo descriptor from DOM scrape
 * @param {string} baseUrl Source page URL
 * @param {import('../adapters/storage-interface.mjs').StorageAdapter} storage
 * @returns {Promise<object|null>}
 */
async function resolveBrandLogo(logoMeta, baseUrl, storage) {
  if (!logoMeta?.src) return null;
  if (logoMeta.inlineSvg && logoMeta.src.startsWith('data:image/svg+xml,')) {
    const svgContent = decodeURIComponent(logoMeta.src.replace(/^data:image\/svg\+xml,/, ''));
    await storage.ensureFolder('pages/_brand/media');
    const relativePath = 'pages/_brand/media/site-logo.svg';
    await storage.uploadDocument(svgContent, relativePath);
    const publicSrc = `${storage.getPublicPathPrefix()}/${relativePath}`;
    return { ...logoMeta, src: publicSrc };
  }
  try {
    const abs = new URL(logoMeta.src, baseUrl).href;
    const manifest = await processAssets({
      imageUrls: [abs],
      pageSlug: '_brand',
      storage,
    });
    const publicSrc = manifest[abs];
    if (!publicSrc) return logoMeta;
    return { ...logoMeta, src: publicSrc };
  } catch {
    return logoMeta;
  }
}

/**
 * Build EDS logo row HTML for navigation/footer blocks.
 * @param {object|null} logo Resolved logo descriptor
 * @param {string} baseUrl Fallback home URL
 * @param {string} [fallbackLabel] Text-only fallback label
 * @returns {string}
 */
function buildLogoRow(logo, baseUrl, fallbackLabel = 'Home') {
  if (logo?.src) {
    const href = logo.href || baseUrl;
    const alt = logo.alt || fallbackLabel;
    return `<p><a href="${escapeHtml(href)}" title="${escapeHtml(alt)}"><picture><img src="${escapeHtml(logo.src)}" alt="${escapeHtml(alt)}"></picture></a></p>`;
  }
  return `<p><a href="${escapeHtml(baseUrl)}">${escapeHtml(fallbackLabel)}</a></p>`;
}

/**
 * Parse scraped nav HTML into EDS navigation block rows.
 * @param {string} navHtml Raw nav outer HTML
 * @param {string} baseUrl Page URL for resolving links
 * @param {object|null} [scrapedLogo=null] Logo extracted from header/nav
 * @returns {{ logoRow: string, navRow: string, toolsRow: string }|null}
 */
export function parseNavToEdsRows(navHtml, baseUrl, scrapedLogo = null) {
  if (!navHtml?.trim()) return null;

  const wrapped = `<!DOCTYPE html><html><body>${navHtml}</body></html>`;
  const { document } = createDomEnvironment(wrapped);
  const nav = document.querySelector('nav') || document.body;
  const logoImg = nav.querySelector('a[href] img, .logo img, header img, img[class*="logo" i], img[src*="logo" i]');
  const logoAnchor = logoImg?.closest('a');
  let logoRow = '';
  if (scrapedLogo?.src) {
    logoRow = buildLogoRow(scrapedLogo, baseUrl);
  } else if (logoImg && logoAnchor) {
    const src = logoImg.getAttribute('src') || '';
    const alt = logoImg.getAttribute('alt') || 'Site logo';
    const href = logoAnchor.getAttribute('href') || baseUrl;
    logoRow = buildLogoRow({ src, alt, href }, baseUrl);
  } else {
    logoRow = buildLogoRow(null, baseUrl);
  }

  const navParts = [];
  const rootList = nav.querySelector(':scope > ul, ul');

  const appendSimpleItem = (link) => {
    navParts.push('<hr>');
    navParts.push('<hr>');
    navParts.push(`<p><a href="${link.href}">${link.textContent.trim()}</a></p>`);
  };

  const appendMegaItem = (label, href, columns) => {
    navParts.push('<hr>');
    navParts.push('<hr>');
    navParts.push(`<p>${label}</p>`);
    navParts.push(`<p><a href="${href}">${label}</a></p>`);
    columns.forEach((column) => {
      navParts.push('<hr>');
      const firstLink = column.links[0];
      if (column.title && firstLink && column.title !== firstLink.textContent.trim()) {
        navParts.push(`<p>${column.title}</p>`);
      }
      column.links.forEach((subLink) => {
        navParts.push(`<p><a href="${subLink.href}">${subLink.textContent.trim()}</a></p>`);
      });
    });
  };

  if (rootList) {
    [...rootList.children].filter((li) => li.tagName === 'LI').forEach((li) => {
      const topLink = li.querySelector(':scope > a[href]');
      const nestedUl = li.querySelector(':scope > ul');
      if (nestedUl && topLink) {
        const columns = [...nestedUl.querySelectorAll(':scope > li')].map((subLi) => {
          const subLink = subLi.querySelector(':scope > a[href]');
          const deepLinks = [...subLi.querySelectorAll(':scope > ul a[href]')];
          return {
            title: subLink?.textContent.trim() || '',
            links: deepLinks.length ? deepLinks : (subLink ? [subLink] : []),
          };
        }).filter((col) => col.links.length);
        appendMegaItem(topLink.textContent.trim(), topLink.href, columns);
      } else if (topLink) {
        appendSimpleItem(topLink);
      }
    });
  } else {
    const paragraphs = [...nav.querySelectorAll(':scope p, p')].filter((p) => nav.contains(p));
    let index = 0;
    while (index < paragraphs.length) {
      const current = paragraphs[index];
      const label = current.textContent.trim();
      const currentLink = current.querySelector('a[href]');
      const next = paragraphs[index + 1];
      const nextLink = next?.querySelector('a[href]');

      if (!currentLink && nextLink && next.textContent.trim() === label) {
        const columns = [];
        index += 2;
        while (index < paragraphs.length) {
          const candidate = paragraphs[index];
          const candidateLink = candidate.querySelector('a[href]');
          const upcoming = paragraphs[index + 1];
          const upcomingLink = upcoming?.querySelector('a[href]');
          if (!candidateLink
            && upcomingLink
            && upcoming.textContent.trim() === candidate.textContent.trim()) {
            break;
          }
          if (!candidateLink && !candidateLink) {
            index += 1;
            continue;
          }
          if (candidateLink && upcomingLink && upcoming.textContent.trim() === candidate.textContent.trim()) {
            break;
          }
          if (candidateLink) {
            columns.push({
              title: candidate.textContent.trim(),
              links: [candidateLink],
            });
          }
          index += 1;
          if (columns.length && index < paragraphs.length) {
            const peek = paragraphs[index];
            const peekNext = paragraphs[index + 1];
            if (!peek.querySelector('a[href]')
              && peekNext?.querySelector('a[href]')
              && peekNext.textContent.trim() === peek.textContent.trim()) {
              break;
            }
          }
        }
        appendMegaItem(label, nextLink.href, columns);
      } else if (currentLink) {
        appendSimpleItem(currentLink);
        index += 1;
      } else {
        index += 1;
      }
    }
  }

  const navRow = navParts.length
    ? navParts.join('\n            ')
    : '<hr>\n            <p><a href="/">Home</a></p>';

  const toolsRow = `<hr>
                <p>search</p>
                <p>Search</p>`;

  return { logoRow, navRow, toolsRow };
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveLink(href, baseUrl) {
  if (!href) return '';
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

function resolveSocialPlatform(anchor) {
  const haystack = [
    anchor.className,
    anchor.getAttribute('data-section') || '',
    anchor.getAttribute('aria-label') || '',
  ].join(' ').toLowerCase();

  if (haystack.includes('instagram')) return 'instagram';
  if (haystack.includes('linkedin')) return 'linkedin';
  if (haystack.includes('youtube')) return 'youtube';
  if (haystack.includes('twitter') || /\bx\b/.test(haystack)) return 'x';
  if (haystack.includes('facebook')) return 'facebook';
  return '';
}

/**
 * Parse scraped footer HTML into EDS footer block rows.
 * @param {string} footerHtml Raw footer outer HTML
 * @param {string} baseUrl Page URL for resolving links
 * @param {object|null} [scrapedLogo=null] Logo extracted from footer/header
 * @returns {{ topRows: string, siteRows: string, bottomRows: string }|null}
 */
export function parseFooterToEdsRows(footerHtml, baseUrl, scrapedLogo = null) {
  if (!footerHtml?.trim()) return null;

  const wrapped = `<!DOCTYPE html><html><body>${footerHtml}</body></html>`;
  const { document } = createDomEnvironment(wrapped);
  const footer = document.querySelector('footer') || document.body;

  const logoLink = footer.querySelector('a.logo, .footer-col_1 a.logo, a[class*="logo"]');
  const logoImg = logoLink?.querySelector('img');
  const siteName = logoLink?.querySelector('span')?.textContent.trim()
    || logoImg?.getAttribute('alt')
    || 'Site';

  const contactAnchor = footer.querySelector(
    'a[href*="contact"], .secondary-navigation a[href*="contact"]',
  ) || footer.querySelector('.secondary-navigation a[href], .footer-navigation a[href]');

  const contactHref = resolveLink(contactAnchor?.getAttribute('href'), baseUrl);
  const contactLabel = contactAnchor?.textContent.trim() || 'Contact Us';

  const topRows = `<div>
    <div>
      <div><h2>${escapeHtml(siteName)}</h2></div>
      <div><p>${escapeHtml(contactLabel)}</p></div>
      <div><p><a href="${escapeHtml(contactHref || baseUrl)}">${escapeHtml(contactHref || contactLabel)}</a></p></div>
    </div>
  </div>`;

  const logoHref = resolveLink(logoLink?.getAttribute('href'), baseUrl) || baseUrl;
  let logoSrc = logoImg?.getAttribute('src') || '';
  let logoAlt = logoImg?.getAttribute('alt') || siteName;
  if (scrapedLogo?.src) {
    logoSrc = scrapedLogo.src;
    logoAlt = scrapedLogo.alt || logoAlt;
  }
  if (!logoSrc) {
    logoSrc = '';
  }

  const siteParts = [logoSrc ? `<div>
      <div>
        <p>
          <a href="${escapeHtml(logoHref)}" title="${escapeHtml(logoAlt)}">
            <picture>
              <img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(logoAlt)}">
            </picture>
          </a>
        </p>
      </div>
    </div>` : `<div><div><p><a href="${escapeHtml(logoHref)}">${escapeHtml(siteName)}</a></p></div></div>`];

  const navAnchors = [...footer.querySelectorAll(
    '.secondary-navigation a[href], .footer-navigation .secondary-navigation a[href]',
  )];
  const seenNav = new Set();
  navAnchors.forEach((anchor) => {
    const href = resolveLink(anchor.getAttribute('href'), baseUrl);
    if (!href || seenNav.has(href)) return;
    seenNav.add(href);
    const label = anchor.textContent.trim() || href;
    siteParts.push(`<div>
      <div>
        <p>${escapeHtml(label)}</p>
        <p><a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>
      </div>
    </div>`);
  });

  const bottomParts = [];
  const copyright = footer.querySelector('.copyright')?.textContent.trim();
  if (copyright) {
    bottomParts.push(`<div>
      <div><p>${escapeHtml(copyright)}</p></div>
    </div>`);
  }

  const legalAnchors = [...footer.querySelectorAll('.tertiary-navigation a[href]')];
  const seenLegal = new Set();
  legalAnchors.forEach((anchor) => {
    const href = resolveLink(anchor.getAttribute('href'), baseUrl);
    if (!href || href === '#' || seenLegal.has(href)) return;
    seenLegal.add(href);
    const label = anchor.textContent.trim() || href;
    bottomParts.push(`<hr>
      <p>${escapeHtml(label)}</p>
      <p><a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>`);
  });

  const socialAnchors = [...footer.querySelectorAll('.social-media a[href]')];
  const seenSocial = new Set();
  socialAnchors.forEach((anchor) => {
    const href = resolveLink(anchor.getAttribute('href'), baseUrl);
    const platform = resolveSocialPlatform(anchor);
    if (!href || !platform || seenSocial.has(platform)) return;
    seenSocial.add(platform);
    const label = anchor.getAttribute('aria-label')?.split(' ')[0] || platform;
    bottomParts.push(`<hr>
      <p>${escapeHtml(platform)}</p>
      <p><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></p>`);
  });

  if (!bottomParts.length) {
    bottomParts.push(`<div>
      <div><p>Copyright © ${escapeHtml(siteName)}</p></div>
    </div>`);
  }

  return {
    topRows,
    siteRows: siteParts.join('\n    '),
    bottomRows: bottomParts.join('\n    '),
  };
}

/**
 * Build full footer.plain.html fragment document.
 * @param {{ topRows: string, siteRows: string, bottomRows: string }} rows Footer rows
 * @returns {string}
 */
export function buildFooterPlainHtml(rows) {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>Footer</title>
  </head>
  <body>
    <main>
      <div>
        <div class="section">
          <div>
            <div class="footer-top block">
              ${rows.topRows}
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="section">
          <div class="section-metadata">
            <div><div>Style</div><div>navy</div></div>
          </div>
          <div>
            <div class="footer-site block">
              ${rows.siteRows}
            </div>
          </div>
          <div>
            <div class="footer-bottom block">
              ${rows.bottomRows}
            </div>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`;
}

/**
 * Build full nav.plain.html fragment document.
 * @param {{ logoRow: string, navRow: string, toolsRow: string }} rows Nav rows
 * @returns {string}
 */
export function buildNavPlainHtml(rows) {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>Navigation</title>
  </head>
  <body>
    <main>
      <div>
        <div class="section">
          <div>
            <div class="navigation block">
              <div>
                <div>
                  ${rows.logoRow || '<p><a href="/">Home</a></p>'}
                </div>
              </div>
              <div>
                <div>
                  ${rows.navRow}
                </div>
              </div>
              <div>
                <div>
                  ${rows.toolsRow}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`;
}

/**
 * Generate theme CSS + nav fragment and upload via storage adapter.
 * @param {object} options
 * @param {string} options.url Source URL
 * @param {string} options.navHtml Scraped nav HTML
 * @param {string} [options.footerHtml] Scraped footer HTML
 * @param {object} options.themeColors Color samples from Puppeteer
 * @param {import('../adapters/storage-interface.mjs').StorageAdapter} options.storage
 * @param {boolean} [options.mirrorToRepoStyles=false] Copy theme CSS to styles/themes/
 * @param {string} [options.themeOverride] Use this theme class instead of URL-derived slug
 * @param {string} [options.megaClassOverride] Mega menu class when using parent theme
 * @param {boolean} [options.useParentTheme=false] Copy CSS from styles/themes/ instead of scraping
 * @param {object} [options.projectConfig={}] Host EDS project config (projectRoot)
 * @param {object|null} [options.logoMeta=null] Header/nav logo from scrape
 * @param {object|null} [options.footerLogoMeta=null] Footer logo from scrape
 * @returns {Promise<{ themeSlug: string, megaClass: string, themeCssPath: string, navPath: string, footerPath: string }>}
 */
export async function generateThemeArtifacts({
  url, navHtml, footerHtml, themeColors, storage, mirrorToRepoStyles = false,
  themeOverride, megaClassOverride, useParentTheme = false, projectConfig = {},
  logoMeta = null, footerLogoMeta = null, fonts = {},
}) {
  const themeSlug = themeOverride || generateThemeSlug(url);
  const megaClass = megaClassOverride || themeToMegaClass(themeSlug);

  let themeCss;
  if (useParentTheme && themeOverride) {
    themeCss = await loadParentThemeCss(themeOverride, projectConfig);
    if (!themeCss) {
      // eslint-disable-next-line no-console
      console.warn(`[ingest] Parent theme ${themeOverride} not found in styles/themes/; generating from scraped colors`);
      themeCss = generateThemeCss(themeSlug, buildThemeTokens(themeColors, fonts));
    } else {
      // eslint-disable-next-line no-console
      console.log(`[ingest] Using parent theme: ${themeOverride}`);
    }
  } else {
    const tokens = buildThemeTokens(themeColors, fonts);
    themeCss = generateThemeCss(themeSlug, tokens);
    if (tokens.googleFontsImport) {
      // eslint-disable-next-line no-console
      console.log(`[ingest] Matched source webfont: ${tokens.googleFontsImport}`);
    }
  }

  const themeRelativePath = `themes/${themeSlug}.css`;
  await storage.ensureFolder('themes');
  await storage.uploadDocument(themeCss, themeRelativePath);
  if (mirrorToRepoStyles) {
    await mirrorThemeCssForLocalDev(themeSlug, themeCss, projectConfig);
  }

  const publicPrefix = storage.getPublicPathPrefix();
  const navPath = `${publicPrefix}/nav`;
  const footerPath = `${publicPrefix}/footer`;

  const resolvedNavLogo = await resolveBrandLogo(logoMeta || footerLogoMeta, url, storage);
  const resolvedFooterLogo = await resolveBrandLogo(
    footerLogoMeta || logoMeta,
    url,
    storage,
  );

  const navRows = parseNavToEdsRows(navHtml, url, resolvedNavLogo);
  if (navRows) {
    await storage.uploadDocument(buildNavPlainHtml(navRows), 'nav.plain.html');
    // eslint-disable-next-line no-console
    console.log('[ingest] Navigation fragment: nav.plain.html');
    if (resolvedNavLogo?.src) {
      // eslint-disable-next-line no-console
      console.log(`[ingest] Nav logo: ${resolvedNavLogo.src}`);
    }
  }

  const footerRows = parseFooterToEdsRows(footerHtml, url, resolvedFooterLogo);
  if (footerRows) {
    await storage.uploadDocument(buildFooterPlainHtml(footerRows), 'footer.plain.html');
    // eslint-disable-next-line no-console
    console.log('[ingest] Footer fragment: footer.plain.html');
  }

  // eslint-disable-next-line no-console
  console.log(`[ingest] Theme: ${themeSlug} (${themeRelativePath})`);

  return {
    themeSlug,
    megaClass,
    themeCssPath: themeRelativePath,
    navPath,
    footerPath,
  };
}
