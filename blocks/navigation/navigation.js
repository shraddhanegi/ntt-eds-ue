import { createOptimizedPicture, decorateIcons } from '../../scripts/aem.js';
import { getThemeMegaMenuStyle } from '../../scripts/theme-config.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const TOOL_STYLES = ['primary', 'globe', 'search', 'contact'];
const DEFAULT_LOGO_SRC = `${window.hlx.codeBasePath}/icons/nttdata-logo.svg`;
const DEFAULT_CONTACT_HREF = 'https://www.nttdata.com/global/en/contact-us';
const DESKTOP_BREAKPOINT = 1024;

function splitByHr(root) {
  const chunks = [];
  let buffer = [];

  [...root.childNodes].forEach((node) => {
    if (node.nodeName === 'HR') {
      if (buffer.length) {
        chunks.push(buffer);
        buffer = [];
      }
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      buffer.push(node);
    }
  });

  if (buffer.length) chunks.push(buffer);
  return chunks;
}

function wrapElements(elements) {
  const wrapper = document.createElement('div');
  elements.forEach((el) => wrapper.append(el));
  return wrapper;
}

function getLabelFromChunk(chunk) {
  const wrapper = wrapElements(chunk);
  const heading = wrapper.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) return heading.textContent.trim();

  const labelParagraph = [...wrapper.querySelectorAll('p')].find((p) => (
    !p.querySelector('a[href]') && !p.querySelector('picture, img')
    && p.textContent.trim()
    && !['_self', '_blank', ...TOOL_STYLES].includes(p.textContent.trim())
  ));
  if (labelParagraph) return labelParagraph.textContent.trim();

  const link = wrapper.querySelector('a[href]');
  if (link?.textContent.trim() && !link.textContent.trim().startsWith('/')
    && !link.textContent.trim().startsWith('http')) {
    return link.textContent.trim();
  }

  return '';
}

function getLinkFromChunk(chunk) {
  const wrapper = wrapElements(chunk);
  const anchors = [...wrapper.querySelectorAll('a[href]')];
  const contentLink = anchors.find((a) => !['_self', '_blank'].includes(a.textContent.trim()));
  return contentLink || anchors[0] || null;
}

function getTargetFromChunk(chunk, link) {
  const wrapper = wrapElements(chunk);
  const targetParagraph = [...wrapper.querySelectorAll('p')].find((p) => (
    ['_self', '_blank'].includes(p.textContent.trim())
  ));
  if (targetParagraph) return targetParagraph.textContent.trim();
  if (link?.target === '_blank') return '_blank';
  if (link?.getAttribute('rel')?.includes('external')) return '_blank';
  return '_self';
}

function getIconFromChunk(chunk) {
  const wrapper = wrapElements(chunk);
  return wrapper.querySelector('picture img, img:not(picture img)') || null;
}

function applyLinkAttributes(anchor, target) {
  if (target === '_blank') {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.classList.add('nav-external');
  }
}

function buildLink(label, href, target, icon) {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.textContent = label;
  applyLinkAttributes(anchor, target);

  if (icon) {
    const iconWrap = document.createElement('span');
    iconWrap.className = 'nav-link-icon';
    const optimized = createOptimizedPicture(icon.src, icon.alt || '', false, [{ width: '48' }]);
    moveInstrumentation(icon, optimized.querySelector('img'));
    iconWrap.append(optimized);
    anchor.prepend(iconWrap);
  }

  return anchor;
}

function parseMegaColumns(megaChunks) {
  return megaChunks.map((columnChunk) => {
    const wrapper = wrapElements(columnChunk);
    const title = getLabelFromChunk(columnChunk);
    const links = [];

    wrapper.querySelectorAll('a[href]').forEach((link) => {
      links.push({
        label: link.textContent.trim(),
        href: link.href,
        target: getTargetFromChunk([link.parentElement], link),
        icon: link.parentElement?.querySelector('img') || null,
      });
    });

    return { title, links };
  }).filter((col) => col.title || col.links.length);
}

function parseNavItemFromChunk(chunk) {
  const wrapper = wrapElements(chunk);
  const nestedHr = wrapper.querySelector('hr');

  if (nestedHr) {
    const megaChunks = splitByHr(wrapper).slice(1);
    const parentChunk = splitByHr(wrapper)[0] || chunk;
    const parentLink = getLinkFromChunk(parentChunk);
    const label = getLabelFromChunk(parentChunk) || parentLink?.textContent.trim() || '';

    return {
      label,
      href: parentLink?.href || '#',
      target: getTargetFromChunk(parentChunk, parentLink),
      icon: getIconFromChunk(parentChunk),
      megaColumns: parseMegaColumns(megaChunks),
      sourceRow: null,
    };
  }

  const link = getLinkFromChunk(chunk);
  const label = getLabelFromChunk(chunk) || link?.textContent.trim() || '';

  return {
    label,
    href: link?.href || '#',
    target: getTargetFromChunk(chunk, link),
    icon: getIconFromChunk(chunk),
    megaColumns: [],
    sourceRow: null,
  };
}

function parseLegacyNavItem(li) {
  const topLink = li.querySelector(':scope > a[href], :scope > p > a[href], :scope > p strong > a[href]');
  const labelParagraph = [...li.querySelectorAll(':scope > p')].find((p) => !p.querySelector('a[href]'));
  const label = labelParagraph?.textContent.trim()
    || topLink?.textContent.trim() || '';

  return {
    label,
    href: topLink?.href || '#',
    target: topLink?.target === '_blank' ? '_blank' : '_self',
    icon: li.querySelector(':scope picture img, :scope > img'),
    sourceRow: li,
  };
}

function parseNavItems(root) {
  const legacyList = root.querySelector(':scope > ul, :scope ul');
  if (legacyList) {
    return [...legacyList.querySelectorAll(':scope > li')].map(parseLegacyNavItem);
  }

  const hrCell = root.querySelector('hr') ? root : null;
  if (hrCell) {
    return splitByHr(hrCell).map((chunk) => parseNavItemFromChunk(chunk));
  }

  return [];
}

function getToolStyleFromChunk(chunk, link) {
  const wrapper = wrapElements(chunk);
  const styleParagraph = [...wrapper.querySelectorAll('p')].find((p) => (
    TOOL_STYLES.includes(p.textContent.trim())
  ));
  if (styleParagraph) return styleParagraph.textContent.trim();
  if (link?.classList.contains('primary') || link?.closest('strong')) return 'primary';
  return '';
}

function parseTools(root) {
  const items = [];
  const buttonLink = root.querySelector('a.button, a.primary, .button-container a, p a[href]');

  if (root.querySelector('hr')) {
    splitByHr(root).forEach((chunk) => {
      const link = getLinkFromChunk(chunk);
      const label = getLabelFromChunk(chunk) || link?.textContent.trim() || '';
      const style = getToolStyleFromChunk(chunk, link);

      if (!link && style === 'search') {
        items.push({
          label: label || 'Search',
          href: '#',
          target: '_self',
          icon: null,
          style: 'search',
        });
        return;
      }

      if (!link) return;

      items.push({
        label,
        href: link.href,
        target: getTargetFromChunk(chunk, link),
        icon: getIconFromChunk(chunk),
        style,
      });
    });
    return items;
  }

  if (buttonLink) {
    items.push({
      label: buttonLink.textContent.trim(),
      href: buttonLink.href,
      target: buttonLink.target === '_blank' ? '_blank' : '_self',
      icon: root.querySelector('img'),
      style: buttonLink.classList.contains('primary') ? 'primary' : '',
    });
  }

  return items;
}

function parseBlock(block) {
  const rows = [...block.children];
  let logo = null;
  let logoLink = null;
  let navItemsRoot = null;
  let toolsRoot = null;

  rows.forEach((row, index) => {
    const cell = row.querySelector(':scope > div') || row;
    const hasNav = cell.querySelector('ul, hr');
    const hasTool = cell.querySelector('a.button, a.primary, strong a[href], .button-container');

    if (!navItemsRoot && hasNav) {
      navItemsRoot = cell;
      return;
    }

    if (!toolsRoot && (hasTool || (index === rows.length - 1 && cell.querySelector('a[href]')))) {
      toolsRoot = cell;
      return;
    }

    if (!navItemsRoot && !toolsRoot && cell.querySelector('a[href], picture, img')) {
      if (!logoLink) logoLink = cell.querySelector('a[href]');
      if (!logo) logo = cell.querySelector('picture img, img');
    }
  });

  return {
    logo,
    logoLink,
    navItems: navItemsRoot ? parseNavItems(navItemsRoot) : [],
    tools: toolsRoot ? parseTools(toolsRoot) : [],
  };
}

function buildMegaColumn(column) {
  const col = document.createElement('div');
  col.className = 'nav-mega-column';

  if (column.title) {
    const title = document.createElement('p');
    title.className = 'nav-mega-column-title';
    title.textContent = column.title;
    col.append(title);
  }

  const list = document.createElement('ul');
  list.className = 'nav-mega-column-links';
  column.links.forEach((link) => {
    const li = document.createElement('li');
    li.append(buildLink(link.label, link.href, link.target, link.icon));
    list.append(li);
  });
  col.append(list);
  return col;
}

function buildMegaPanel(item, megaMenuStyle) {
  const panel = document.createElement('div');
  panel.className = 'nav-mega-panel';
  panel.hidden = true;

  const inner = document.createElement('div');
  inner.className = 'nav-mega-panel-inner';

  const grid = document.createElement('div');
  grid.className = 'nav-mega-columns';
  item.megaColumns.forEach((column) => {
    grid.append(buildMegaColumn(column));
  });
  inner.append(grid);

  if (megaMenuStyle === 'mega-corporate' && item.href && item.href !== '#') {
    const featured = document.createElement('div');
    featured.className = 'nav-mega-featured';
    const featuredLink = buildLink(`Explore ${item.label}`, item.href, item.target, null);
    featuredLink.classList.add('button', 'primary');
    featured.append(featuredLink);
    inner.append(featured);
  }

  panel.append(inner);
  return panel;
}

function closeMegaItem(item) {
  item.classList.remove('is-open');
  const trigger = item.querySelector('.nav-mega-trigger');
  const panel = item.querySelector('.nav-mega-panel');
  trigger?.setAttribute('aria-expanded', 'false');
  if (panel) panel.hidden = true;
}

function closeAllMegaPanels(nav, except) {
  nav.querySelectorAll('.nav-item-has-mega.is-open').forEach((item) => {
    if (item !== except) closeMegaItem(item);
  });
}

function openMegaItem(item) {
  closeAllMegaPanels(item.closest('nav'), item);
  item.classList.add('is-open');
  const trigger = item.querySelector('.nav-mega-trigger');
  const panel = item.querySelector('.nav-mega-panel');
  trigger?.setAttribute('aria-expanded', 'true');
  if (panel) panel.hidden = false;
}

function buildNavItem(item, megaMenuStyle) {
  const li = document.createElement('li');

  if (item.megaColumns?.length) {
    li.classList.add('nav-item-has-mega');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'nav-mega-trigger';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.textContent = item.label;

    const panel = buildMegaPanel(item, megaMenuStyle);
    li.append(trigger, panel);
    if (item.sourceRow) moveInstrumentation(item.sourceRow, li);
    return li;
  }

  const link = buildLink(item.label, item.href, item.target, item.icon);
  li.append(link);
  if (item.sourceRow) moveInstrumentation(item.sourceRow, li);
  return li;
}

function buildTool(tool) {
  if (tool.style === 'search') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-tool nav-tool-search';
    button.setAttribute('aria-label', tool.label || 'Search');
    const icon = document.createElement('span');
    icon.className = 'icon icon-search';
    button.append(icon);
    decorateIcons(button);
    return button;
  }

  if (tool.style === 'contact') {
    const link = document.createElement('a');
    link.href = tool.href || DEFAULT_CONTACT_HREF;
    link.className = 'nav-tool nav-tool-contact';
    link.setAttribute('aria-label', tool.label || 'Contact Us');
    applyLinkAttributes(link, tool.target);
    const icon = document.createElement('span');
    icon.className = 'icon icon-contact';
    link.append(icon);
    decorateIcons(link);
    return link;
  }

  if (tool.style === 'globe') {
    const link = document.createElement('a');
    link.href = tool.href || '#';
    link.className = 'nav-tool nav-tool-globe';
    link.setAttribute('aria-label', tool.label || 'Select region');
    applyLinkAttributes(link, tool.target);
    const icon = document.createElement('span');
    icon.className = 'icon icon-globe';
    link.append(icon);
    if (tool.label) {
      const label = document.createElement('span');
      label.className = 'nav-tool-label';
      label.textContent = tool.label;
      link.append(label);
    }
    decorateIcons(link);
    return link;
  }

  const link = buildLink(tool.label, tool.href, tool.target, tool.icon);
  if (tool.style === 'primary') {
    link.classList.add('button', 'primary');
    const wrapper = document.createElement('p');
    wrapper.className = 'button-container';
    wrapper.append(link);
    return wrapper;
  }
  link.classList.add('nav-tool');
  return link;
}

function hasContactTool(tools) {
  return tools.some((tool) => tool.style === 'contact');
}

function getContactTool(tools) {
  const contact = tools.find((tool) => tool.style === 'contact');
  if (contact) return contact;
  return {
    label: 'Contact Us',
    href: DEFAULT_CONTACT_HREF,
    target: '_self',
    icon: null,
    style: 'contact',
  };
}

function isContactNavItem(item, contactTool) {
  const label = item.label?.trim().toLowerCase();
  const itemHref = item.href?.replace(/\/$/, '') || '';
  const contactHref = (contactTool.href || DEFAULT_CONTACT_HREF).replace(/\/$/, '');
  return label === 'contact us' || itemHref === contactHref;
}

function buildDrawerSubmenuLinks(item) {
  const links = [];

  if (item.megaColumns?.length) {
    item.megaColumns.forEach((column) => {
      column.links.forEach((subLink) => {
        links.push(subLink);
      });
    });
  }

  return links;
}

function buildDrawerItem(item) {
  const li = document.createElement('li');
  li.className = 'nav-drawer-item';
  const submenuLinks = buildDrawerSubmenuLinks(item);

  if (submenuLinks.length) {
    li.classList.add('nav-drawer-item--has-children');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-drawer-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = item.label;

    const submenu = document.createElement('ul');
    submenu.className = 'nav-drawer-submenu';
    submenuLinks.forEach((subLink) => {
      const subLi = document.createElement('li');
      subLi.append(buildLink(subLink.label, subLink.href, subLink.target, subLink.icon));
      submenu.append(subLi);
    });

    toggle.addEventListener('click', () => {
      const isOpen = li.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    li.append(toggle, submenu);
    return li;
  }

  li.append(buildLink(item.label, item.href, item.target, item.icon));
  return li;
}

function buildDrawerContact(tool) {
  const li = document.createElement('li');
  li.className = 'nav-drawer-item nav-drawer-contact';

  const link = document.createElement('a');
  link.href = tool.href || DEFAULT_CONTACT_HREF;
  link.className = 'nav-drawer-contact-link';
  applyLinkAttributes(link, tool.target);

  const icon = document.createElement('span');
  icon.className = 'icon icon-contact';
  link.append(icon);

  const label = document.createElement('span');
  label.className = 'nav-drawer-contact-label';
  label.textContent = tool.label || 'Contact Us';
  link.append(label);

  decorateIcons(link);
  li.append(link);
  return li;
}

function buildHamburger() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'nav-hamburger';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'nav-drawer');
  button.setAttribute('aria-label', 'Open menu');
  button.innerHTML = '<span></span><span></span><span></span>';
  return button;
}

function closeNavMenu(nav, hamburger) {
  nav.classList.remove('nav-open');
  document.body.classList.remove('nav-scroll-lock');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-label', 'Open menu');
  nav.querySelector('.nav-overlay')?.setAttribute('aria-hidden', 'true');
  const drawer = nav.querySelector('.nav-drawer');
  drawer?.setAttribute('aria-hidden', 'true');
  if (drawer) drawer.inert = true;
}

function openNavMenu(nav, hamburger) {
  nav.classList.add('nav-open');
  document.body.classList.add('nav-scroll-lock');
  hamburger.setAttribute('aria-expanded', 'true');
  hamburger.setAttribute('aria-label', 'Close menu');
  nav.querySelector('.nav-overlay')?.setAttribute('aria-hidden', 'false');
  const drawer = nav.querySelector('.nav-drawer');
  drawer?.setAttribute('aria-hidden', 'false');
  if (drawer) drawer.inert = false;
  drawer?.querySelector('.nav-drawer-item > a, .nav-drawer-toggle')?.focus();
}

function toggleNavMenu(nav, hamburger) {
  if (nav.classList.contains('nav-open')) {
    closeNavMenu(nav, hamburger);
    hamburger.focus();
  } else {
    openNavMenu(nav, hamburger);
  }
}

function setupMegaMenuInteractions(nav) {
  const mediaQuery = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
  const megaItems = [...nav.querySelectorAll('.nav-item-has-mega')];
  if (!megaItems.length) return;

  let closeTimer;

  const scheduleClose = (item) => {
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      if (!item.matches(':hover') && !item.querySelector('.nav-mega-panel:hover')) {
        closeMegaItem(item);
      }
    }, 200);
  };

  megaItems.forEach((item) => {
    const trigger = item.querySelector('.nav-mega-trigger');
    const panel = item.querySelector('.nav-mega-panel');

    trigger?.addEventListener('click', (event) => {
      event.preventDefault();
      if (item.classList.contains('is-open')) {
        closeMegaItem(item);
        return;
      }
      openMegaItem(item);
    });

    item.addEventListener('mouseenter', () => {
      if (!mediaQuery.matches) return;
      window.clearTimeout(closeTimer);
      openMegaItem(item);
    });

    item.addEventListener('mouseleave', () => {
      if (!mediaQuery.matches) return;
      scheduleClose(item);
    });

    panel?.addEventListener('mouseenter', () => {
      window.clearTimeout(closeTimer);
    });

    panel?.addEventListener('mouseleave', () => {
      if (!mediaQuery.matches) return;
      scheduleClose(item);
    });

    panel?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMegaItem(item);
        trigger?.focus();
      }
    });
  });

  document.addEventListener('click', (event) => {
    if (!mediaQuery.matches) return;
    if (event.target.closest('.nav-item-has-mega')) return;
    closeAllMegaPanels(nav);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllMegaPanels(nav);
  });

  const handleBreakpointChange = () => {
    if (!mediaQuery.matches) closeAllMegaPanels(nav);
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleBreakpointChange);
  } else {
    mediaQuery.addListener(handleBreakpointChange);
  }
}

function setupNavInteractions(nav, hamburger) {
  const overlay = nav.querySelector('.nav-overlay');
  const drawer = nav.querySelector('.nav-drawer');
  const mediaQuery = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);

  hamburger.addEventListener('click', () => toggleNavMenu(nav, hamburger));
  overlay?.addEventListener('click', () => {
    closeNavMenu(nav, hamburger);
    hamburger.focus();
  });

  drawer?.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      closeNavMenu(nav, hamburger);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('nav-open')) {
      closeNavMenu(nav, hamburger);
      hamburger.focus();
    }
  });

  const handleBreakpointChange = () => {
    if (mediaQuery.matches && nav.classList.contains('nav-open')) {
      closeNavMenu(nav, hamburger);
    }
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleBreakpointChange);
  } else {
    mediaQuery.addListener(handleBreakpointChange);
  }
}

/**
 * loads and decorates the navigation block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const {
    logo, logoLink, navItems, tools,
  } = parseBlock(block);

  const megaMenuStyle = getThemeMegaMenuStyle();
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.className = `navigation ${megaMenuStyle}`;

  const bar = document.createElement('div');
  bar.className = 'nav-bar';

  const brand = document.createElement('div');
  brand.className = 'nav-brand';
  const brandAnchor = document.createElement('a');
  brandAnchor.href = logoLink?.href || '/';
  brandAnchor.title = logoLink?.title || 'NTT DATA Home';

  if (logo) {
    const img = logo.tagName === 'IMG' ? logo : logo.querySelector('img');
    if (img) {
      if (img.src.includes('.svg')) {
        const logoImg = document.createElement('img');
        logoImg.src = img.src;
        logoImg.alt = img.alt || 'NTT DATA';
        moveInstrumentation(img, logoImg);
        brandAnchor.append(logoImg);
      } else {
        const pic = createOptimizedPicture(img.src, img.alt || 'NTT DATA', false, [{ width: '280' }]);
        moveInstrumentation(img, pic.querySelector('img'));
        brandAnchor.append(pic);
      }
    }
  } else {
    const logoImg = document.createElement('img');
    logoImg.src = DEFAULT_LOGO_SRC;
    logoImg.alt = 'NTT DATA';
    brandAnchor.append(logoImg);
  }

  brand.append(brandAnchor);
  bar.append(brand);

  const sections = document.createElement('div');
  sections.className = 'nav-sections';
  const resolvedTools = [...tools];
  if (!hasContactTool(resolvedTools)) {
    resolvedTools.push({
      label: 'Contact Us',
      href: DEFAULT_CONTACT_HREF,
      target: '_self',
      icon: null,
      style: 'contact',
    });
  }
  const contactTool = getContactTool(resolvedTools);

  const list = document.createElement('ul');
  navItems.forEach((item) => {
    if (!isContactNavItem(item, contactTool)) {
      list.append(buildNavItem(item, megaMenuStyle));
    }
  });
  sections.append(list);
  bar.append(sections);

  const toolsEl = document.createElement('div');
  toolsEl.className = 'nav-tools';
  resolvedTools.forEach((tool) => {
    toolsEl.append(buildTool(tool));
  });
  bar.append(toolsEl);

  const hamburger = buildHamburger();
  bar.append(hamburger);

  const overlay = document.createElement('div');
  overlay.className = 'nav-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const drawer = document.createElement('aside');
  drawer.className = 'nav-drawer';
  drawer.id = 'nav-drawer';
  drawer.setAttribute('aria-hidden', 'true');
  drawer.setAttribute('aria-label', 'Main menu');

  const drawerNav = document.createElement('nav');
  drawerNav.className = 'nav-drawer-nav';
  const drawerList = document.createElement('ul');
  drawerList.className = 'nav-drawer-list';
  navItems.forEach((item) => {
    if (!isContactNavItem(item, contactTool)) {
      drawerList.append(buildDrawerItem(item));
    }
  });
  drawerList.append(buildDrawerContact(contactTool));
  drawerNav.append(drawerList);
  drawer.append(drawerNav);
  drawer.inert = true;

  nav.append(bar, overlay, drawer);
  setupNavInteractions(nav, hamburger);
  setupMegaMenuInteractions(nav);

  moveInstrumentation(block, nav);
  block.replaceChildren(nav);
}
