import { parseHTML } from 'linkedom';

/**
 * Append a cell node into a block row.
 * @param {Document} document DOM document
 * @param {Element} rowEl Row wrapper
 * @param {Node|string} cell Cell content
 */
function appendCell(document, rowEl, cell) {
  const cellDiv = document.createElement('div');
  if (!cell) {
    rowEl.append(cellDiv);
    return;
  }
  if (cell instanceof document.defaultView.Node) {
    cellDiv.append(cell);
  } else if (typeof cell === 'string') {
    cellDiv.innerHTML = cell;
  }
  rowEl.append(cellDiv);
}

/**
 * Minimal WebImporter shim for Helix import rules in Node.
 * @param {Document} document DOM document
 * @returns {object}
 */
export function createWebImporter(document) {
  const remove = (root, selectors) => {
    selectors.forEach((sel) => {
      root.querySelectorAll(sel).forEach((el) => el.remove());
    });
  };

  return {
    Blocks: {
      createBlock(doc, { name, cells }) {
        const block = doc.createElement('div');
        block.className = `${name} block`;
        (cells || []).forEach((row) => {
          const rowDiv = doc.createElement('div');
          const items = Array.isArray(row) ? row : [row];
          items.forEach((cell) => appendCell(doc, rowDiv, cell));
          block.append(rowDiv);
        });
        return block;
      },

      getMetadata(doc) {
        const title = doc.querySelector('title')?.textContent?.trim() || '';
        const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const image = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
        return { title, description, image };
      },

      getMetadataBlock(doc, meta) {
        const block = doc.createElement('div');
        block.className = 'metadata block';
        Object.entries(meta).forEach(([key, value]) => {
          if (!value) return;
          const row = doc.createElement('div');
          const keyCell = doc.createElement('div');
          keyCell.textContent = key;
          const valCell = doc.createElement('div');
          valCell.textContent = String(value);
          row.append(keyCell, valCell);
          block.append(row);
        });
        return block;
      },
    },

    DOMUtils: { remove },

    FileUtils: {
      sanitizePath(path) {
        return String(path || '/').replace(/\/+/g, '/');
      },
    },
  };
}

/**
 * Parse HTML string into a Linkedom document with WebImporter global.
 * @param {string} html HTML source
 * @returns {{ document: Document, WebImporter: object, window: Window }}
 */
export function createDomEnvironment(html) {
  const { document, window } = parseHTML(html);
  const WebImporter = createWebImporter(document);
  return { document, WebImporter, window };
}

/**
 * Serialize an element and its children to HTML string.
 * @param {Element} el Root element
 * @returns {string}
 */
export function serializeElement(el) {
  if (!el) return '';
  return el.outerHTML;
}
