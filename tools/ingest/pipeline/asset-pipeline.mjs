import sharp from 'sharp';
import { sanitizeFilename, inferExtension } from '../lib/filename-sanitize.mjs';
import { collectMediaUrls } from '../lib/collect-media-urls.mjs';
import { convertGifToMp4, isAnimatedGif, isFfmpegAvailable } from '../lib/gif-to-mp4.mjs';

export { collectMediaUrls, collectMediaUrls as collectImageUrls };

let ffmpegChecked = false;
let ffmpegReady = false;

async function ensureFfmpegStatus() {
  if (!ffmpegChecked) {
    ffmpegReady = await isFfmpegAvailable();
    ffmpegChecked = true;
    if (!ffmpegReady) {
      // eslint-disable-next-line no-console
      console.warn('[ingest] ffmpeg not found — animated GIFs will be kept as GIF');
    }
  }
  return ffmpegReady;
}

/**
 * Download, optimize, and store assets. Returns manifest before HTML compile.
 * @param {object} options
 * @param {string[]} options.imageUrls Absolute media URLs to process
 * @param {string} options.pageSlug Page slug for media folder
 * @param {import('../adapters/storage-interface.mjs').StorageAdapter} options.storage Storage adapter
 * @returns {Promise<Record<string, string>>} AssetManifest sourceUrl → publicPath
 */
export async function processAssets({ imageUrls, pageSlug, storage }) {
  const manifest = {};
  const mediaPrefix = `pages/${pageSlug}/media`;
  await storage.ensureFolder(mediaPrefix);

  let index = 0;
  await Promise.all(imageUrls.map(async (sourceUrl) => {
    if (manifest[sourceUrl]) return;
    try {
      const response = await fetch(sourceUrl, {
        headers: { 'User-Agent': 'EDS-Ingest/1.0' },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) return;

      const contentType = response.headers.get('content-type') || '';
      let buffer = Buffer.from(await response.arrayBuffer());
      let ext = inferExtension(sourceUrl, contentType);

      if (ext === 'gif' && (await ensureFfmpegStatus()) && (await isAnimatedGif(buffer))) {
        const mp4Buffer = await convertGifToMp4(buffer);
        if (mp4Buffer) {
          buffer = mp4Buffer;
          ext = 'mp4';
          // eslint-disable-next-line no-console
          console.log(`[ingest] Converted GIF → MP4: ${sourceUrl.split('/').pop()}`);
        }
      }

      if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
        buffer = await sharp(buffer)
          .rotate()
          .toFormat(ext === 'png' ? 'png' : 'jpeg', { quality: 85 })
          .toBuffer();
      }

      index += 1;
      const baseName = sanitizeFilename(sourceUrl);
      const filename = `${baseName}-${index}.${ext === 'jpeg' ? 'jpg' : ext}`;
      const relativePath = `${mediaPrefix}/${filename}`;
      const publicPath = await storage.uploadAsset(buffer, relativePath, contentType);
      manifest[sourceUrl] = publicPath;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[ingest] Skipped asset ${sourceUrl}: ${err.message}`);
    }
  }));

  return manifest;
}

/**
 * Rewrite media references in DOM using AssetManifest.
 * @param {Element} root DOM root
 * @param {string} baseUrl Original page URL
 * @param {Record<string, string>} manifest AssetManifest
 */
export function applyAssetManifest(root, baseUrl, manifest) {
  const rewrite = (raw) => {
    if (!raw || raw.startsWith('data:')) return raw;
    try {
      const absolute = new URL(raw, baseUrl).href;
      return manifest[absolute] || raw;
    } catch {
      return raw;
    }
  };

  root.querySelectorAll('img[src]').forEach((img) => {
    img.setAttribute('src', rewrite(img.getAttribute('src')));
  });

  root.querySelectorAll('video[src], video source[src]').forEach((el) => {
    el.setAttribute('src', rewrite(el.getAttribute('src')));
  });

  root.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    if (/\.(gif|mp4|webm|mov)(\?|$)/i.test(href)) {
      anchor.setAttribute('href', rewrite(href));
    }
  });
}
